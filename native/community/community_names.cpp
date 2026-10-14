// Game-specific adapter for the SHA-pinned DirectDraw guest. Disabled unless
// an explicit private MMFR path is supplied; no public launcher enables it yet.
#include "name_registration.h"
#include "RuntimeFeatureRegistry.h"
#include "platform/os.h"
#include "runtime/guest.h"
#include "runtime/imports.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>

extern "C" void fn_004cd8d0(X86 *);

namespace {
MajestyRuntimeFeatures::Registry features;
bool loaded = false;

void fail(const char *reason) {
    std::fprintf(stderr, "[community-names] refused: %s\n", reason);
    std::abort();
}

// File parsing finishes before any guest call. No scoped C++ owners cross a
// guest nonlocal jump; the registry persists for the owned engine's lifetime.
void load(const char *path) {
    if (loaded)
        return;
    const int fd = os_fd_open(path, OS_O_RDONLY);
    if (fd < 0)
        fail("explicit feature registry missing");
    OsStat stat{};
    if (os_fd_stat(fd, &stat) || stat.size < 16 || stat.size > 1024 * 1024) {
        os_fd_close(fd);
        fail("feature registry size invalid");
    }
    std::vector<unsigned char> bytes(static_cast<std::size_t>(stat.size));
    std::size_t done = 0;
    while (done < bytes.size()) {
        const auto n = os_fd_read(fd, bytes.data() + done, bytes.size() - done);
        if (n <= 0) {
            os_fd_close(fd);
            fail("feature registry truncated");
        }
        done += static_cast<std::size_t>(n);
    }
    os_fd_close(fd);
    // This goal only stages the actual v1 names/oils. Other versions require
    // their own capability implementation before accepting their extra data.
    if (bytes[4] != 1 || bytes[5] || bytes[6] || bytes[7])
        fail("unsupported feature registry version");
    std::string error;
    if (!MajestyRuntimeFeatures::ParseRegistry(bytes.data(), bytes.size(), &features, &error))
        fail(error.c_str());
    loaded = true;
}

struct GuestOps {
    X86 cpu;
    std::uint32_t scratch;
    explicit GuestOps(X86 *source) : cpu(*source), scratch(source->r[R_ESP] - 256) {
        cpu.r[R_ESP] -= 512;
    }
    bool ready(std::uint32_t registry) {
        return gm_valid(registry, 24) && rd32(registry + 0x14) == 1;
    }
    std::uint32_t read(std::uint32_t pointer) {
        return rd32(pointer);
    }
    void write(std::uint32_t pointer, std::uint32_t value) {
        wr32(pointer, value);
    }
    std::uint32_t slot(std::uint32_t registry, std::uint32_t id) {
        wr32(scratch, id);
        wr32(scratch + 4, 0);
        cpu.r[R_ECX] = registry + 4;
        // Old std::map insertion takes (iterator+bool output, key/value pair),
        // stdcall-ret8. On an existing key it does not overwrite its wrapper.
        guest_call(&cpu, 0x004cf220U, scratch + 16, scratch);
        const auto node = rd32(scratch + 16);
        return node && gm_valid(node, 20) ? node + 0x10 : 0;
    }
    std::uint32_t construct(const MajestyRuntimeFeatures::NameGeneratorRecord &record,
                            std::uint32_t resources) {
        const auto factory = guest_call(&cpu, 0x004ca050U);
        cpu.r[R_ECX] = factory;
        const std::uint32_t args[] = {record.namePartIds[0], record.namePartIds[1],
                                      record.namePartIds[2], record.namePartIds[3], resources};
        return guest_call(&cpu, 0x004ca470U, args, 5);
    }
    bool valid_generator(std::uint32_t pointer) {
        return gm_valid(pointer, 56) && rd32(pointer + 4) && rd32(pointer + 8) &&
               rd32(pointer + 12) && rd32(pointer + 16);
    }
    std::uint32_t allocate_wrapper() {
        return guest_call(&cpu, 0x0064c616U, 8U);
    }
    void destroy_generator(std::uint32_t pointer) {
        cpu.r[R_ECX] = pointer;
        guest_call(&cpu, rd32(rd32(pointer)), 1U);
    }
};
} // namespace

extern "C" void majesty_community_name_registry_construct(X86 *cpu) {
    const auto registry = cpu->r[R_ECX];
    fn_004cd8d0(cpu);
    const char *path = recomp_env("COMMUNITY_FEATURES_PATH");
    if (!path || !*path)
        return;
    load(path);
    GuestOps ops(cpu);
    const auto context = guest_call(&ops.cpu, 0x004ba7e0U);
    if (!context || !gm_valid(context, 0x164))
        fail("stock resource manager context unavailable");
    const auto resources = rd32(context + 0x160);
    for (const auto &record : features.nameGenerators) {
        const auto result = MajestyCommunity::RegisterNames(ops, registry, resources, record);
        if (result != MajestyCommunity::Registration::Installed)
            fail("stock registration lifecycle rejected requested generator");
    }
    std::fprintf(
        stderr, "[community-names] installed %zu requested generators through original lifecycle\n",
        features.nameGenerators.size());
}
