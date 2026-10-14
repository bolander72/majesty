// Private Old-engine adapter. This source is not installed in the public game.
#include "controller_lifecycle.h"
#include "resource_meter.h"
#include "platform/os.h"
#include "runtime/guest.h"
#include <cstdio>
#include <cstdlib>
#include <vector>

extern "C" void fn_004ca4f0(X86 *);
extern "C" void fn_00465f00(X86 *);
extern "C" void fn_00465270(X86 *);
extern "C" void fn_0047a360(X86 *);
extern "C" void fn_0047a760(X86 *);
extern "C" void fn_0047aae0(X86 *);

namespace {
MajestyStockControllers::Registry recipes;
MajestyCommunity::PanelLifecycle lifecycle(recipes);
bool loaded = false;

void fail(const char *reason) {
    std::fprintf(stderr, "[community-panels] refused: %s\n", reason);
    std::abort();
}

bool enabled() {
    const char *path = recomp_env("COMMUNITY_CONTROLLERS_PATH");
    if (!path || !*path)
        return false;
    if (loaded)
        return true;
    const int fd = os_fd_open(path, OS_O_RDONLY);
    if (fd < 0)
        fail("explicit controller registry missing");
    OsStat stat{};
    if (os_fd_stat(fd, &stat) || stat.size < 44 ||
        stat.size > MajestyStockControllers::kMaximumRegistryBytes) {
        os_fd_close(fd);
        fail("invalid controller registry size");
    }
    std::vector<unsigned char> bytes(static_cast<std::size_t>(stat.size));
    std::size_t done = 0;
    while (done < bytes.size()) {
        const auto n = os_fd_read(fd, bytes.data() + done, bytes.size() - done);
        if (n <= 0) {
            os_fd_close(fd);
            fail("truncated controller registry");
        }
        done += static_cast<std::size_t>(n);
    }
    os_fd_close(fd);
    if (bytes[4] != 20 || bytes[5] || bytes[6] || bytes[7])
        fail("only the acquired MMCRv20 is staged");
    std::string error;
    if (!MajestyStockControllers::ParseRegistry(bytes.data(), bytes.size(), &recipes, &error))
        fail(error.c_str());
    // Parse and retain all seven recipe families. This file implements only
    // native parent/child ownership and Brewing navigation, not their commands.
    loaded = true;
    return true;
}

std::uint32_t family(X86 *source, std::uint32_t controller) {
    X86 extra = *source;
    extra.r[R_ESP] -= 512;
    extra.r[R_ECX] = controller;
    const auto unit = guest_call(&extra, 0x00481ec0U);
    if (!unit || !gm_valid(unit, 0x84))
        fail("private controller has no original unit context");
    const auto descriptor = rd32(unit + 0x80);
    if (!descriptor || !gm_valid(descriptor, 8))
        fail("private controller has no original unit descriptor");
    return rd32(descriptor + 4) & 0x00ffffffU;
}

struct MeterOps {
    X86 cpu;
    explicit MeterOps(X86 *source) : cpu(*source) {
        cpu.r[R_ESP] -= 512;
    }
    std::uint32_t unit(std::uint32_t controller) {
        cpu.r[R_ECX] = controller;
        return guest_call(&cpu, 0x00481ec0U);
    }
    std::uint32_t window(std::uint32_t controller) {
        return gm_valid(controller, 36) ? rd32(controller + 0x14) : 0;
    }
    std::int32_t attribute(std::uint32_t unit, std::uint32_t id) {
        cpu.r[R_ECX] = unit;
        return static_cast<std::int32_t>(guest_call(&cpu, 0x005a1c40U, id, 0U));
    }
    void visible(std::uint32_t window, std::uint32_t control, bool shown) {
        cpu.r[R_ECX] = window;
        guest_call(&cpu, rd32(rd32(window) + 0x20), control, shown ? 1U : 0U);
    }
    void integer(std::uint32_t window, std::uint32_t control, std::int32_t value) {
        cpu.r[R_ECX] = window;
        const std::uint32_t args[] = {control, static_cast<std::uint32_t>(value), 0U};
        guest_call(&cpu, rd32(rd32(window) + 0x5c), args, 3);
    }
};

void present_meter(X86 *cpu, std::uint32_t controller, std::uint64_t generation) {
    const auto session = lifecycle.find(controller);
    if (!session.recipe || session.parent || session.generation != generation)
        return;
    MeterOps ops(cpu);
    for (const auto &meter : recipes.meters)
        if (meter.panelKey == session.recipe->panelKey)
            MajestyCommunity::PresentResourceMeter(ops, controller, meter);
}
} // namespace

extern "C" void majesty_community_dialog_factory(X86 *cpu) {
    if (!enabled()) {
        fn_004ca4f0(cpu);
        return;
    }
    const auto arguments = cpu->r[R_ESP] + 4;
    const auto requested = rd32(arguments);
    const auto selector = lifecycle.selector(requested);
    const auto window = rd32(arguments + 4), context = rd32(arguments + 8);
    if (selector != requested)
        wr32(arguments, selector);
    fn_004ca4f0(cpu);
    if (selector == requested)
        return;
    // Restore the caller's argument after the original stdcall return. Keep
    // every original result register, actual resource/window and context intact.
    wr32(arguments, requested);
    const auto controller = cpu->r[R_EAX];
    if (!controller || !gm_valid(controller, 36) ||
        !lifecycle.capture(controller, requested, window, context))
        fail("original private panel construction failed");
}

extern "C" void majesty_community_guild_control(X86 *cpu) {
    const auto controller = cpu->r[R_ECX];
    const auto session = lifecycle.find(controller);
    const auto command = rd32(cpu->r[R_ESP] + 4);
    if (!session.parent || !session.recipe || command != session.recipe->openCommandId) {
        fn_00465f00(cpu);
        return;
    }
    const auto child = lifecycle.child(controller, command, family(cpu, controller));
    if (!child)
        fail("private panel recipe does not match its building family");
    X86 extra = *cpu;
    extra.r[R_ESP] -= 512;
    extra.r[R_ECX] = controller;
    // The original opener discovers the existing unit when context is zero,
    // constructs the private resource, and owns keep/remove-parent decisions.
    cpu->r[R_EAX] = guest_call(&extra, 0x0047c5c0U, child, 0U);
    cpu->eip = rd32(cpu->r[R_ESP]);
    cpu->r[R_ESP] += 8; // original AP10 command's ret4
}

extern "C" void majesty_community_guild_destroy(X86 *cpu) {
    const auto controller = cpu->r[R_ECX];
    const auto generation = lifecycle.find(controller).generation;
    fn_00465270(cpu);
    lifecycle.destroyed(controller, generation);
}

extern "C" void majesty_community_brewing_destroy(X86 *cpu) {
    const auto controller = cpu->r[R_ECX];
    const auto generation = lifecycle.find(controller).generation;
    fn_0047a360(cpu);
    lifecycle.destroyed(controller, generation);
}

extern "C" void majesty_community_brewing_setup(X86 *cpu) {
    const auto controller = cpu->r[R_ECX];
    const auto generation = lifecycle.find(controller).generation;
    fn_0047a760(cpu);
    present_meter(cpu, controller, generation);
}

extern "C" void majesty_community_brewing_event(X86 *cpu) {
    const auto controller = cpu->r[R_ECX];
    const auto generation = lifecycle.find(controller).generation;
    fn_0047aae0(cpu);
    // Stock events can destroy/recreate a panel. Only refresh that same owned
    // instance if it survived; never read the deleted parent as a fallback.
    present_meter(cpu, controller, generation);
}
