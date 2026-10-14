// Private live-guest qualification through the official mod API; not a public
// content build.
#include "RuntimeFeatureRegistry.h"
#include "controller_lifecycle.h"
#include "name_registration.h"
#include "pop_mod_api.h"
#include "resource_meter.h"
#include <algorithm>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <vector>

POP_MOD_DECLARE_ABI();
namespace {
const PopModApi *host = nullptr;
MajestyRuntimeFeatures::Registry features;
MajestyStockControllers::Registry recipes;
MajestyCommunity::PanelLifecycle lifecycle(recipes);
std::uint32_t scratch = 0;
std::vector<std::uint32_t> hooks;
bool traceRecruitment = false;
bool attributeCompat = false;
std::uint32_t attributeFunction = 0;
bool traceArmed = false;
unsigned traceCalls = 0;
unsigned traceOperators = 0;
unsigned traceValues = 0;
std::vector<std::string> missingFunctions;
void require(bool ok, const char *why) {
    if (!ok) {
        std::fprintf(stderr, "[alchemist-native-probe] refused: %s\n", why);
        std::abort();
    }
}
std::uint32_t read(std::uint32_t a) {
    std::uint32_t v = 0;
    require(host->guest_read_u32(host, a, &v) == POP_OK, "guest read");
    return v;
}
void write(std::uint32_t a, std::uint32_t v) {
    require(host->guest_write_u32(host, a, v) == POP_OK, "guest write");
}
std::uint32_t call(std::uint32_t a, std::uint32_t self,
                   std::initializer_list<std::uint32_t> args = {}) {
    std::uint32_t v = 0;
    require(host->guest_call(host, a, self, args.begin(), static_cast<std::uint32_t>(args.size()),
                             &v) == POP_OK,
            "original guest call");
    return v;
}
void next(PopHookInvocation *inv, pop_cpu_v1 *cpu) {
    require(host->call_next(host, inv, cpu) == POP_OK, "original hook continuation");
}
void returned(pop_cpu_v1 *cpu, std::uint32_t value) {
    require(host->hook_return(host, cpu, value, 4) == POP_OK, "original ret4 discipline");
}
std::vector<unsigned char> file(const char *name, std::size_t limit) {
    std::ifstream in(std::string(host->mod_dir(host)) + "/" + name,
                     std::ios::binary | std::ios::ate);
    require(in.good(), "owned registry missing");
    const auto n = in.tellg();
    require(n > 0 && static_cast<std::size_t>(n) <= limit, "registry size");
    in.seekg(0);
    std::vector<unsigned char> bytes(static_cast<std::size_t>(n));
    in.read(reinterpret_cast<char *>(bytes.data()), n);
    require(in.good(), "registry incomplete");
    return bytes;
}
struct NameOps {
    bool ready(std::uint32_t p) {
        return read(p + 0x14) == 1;
    }
    std::uint32_t read(std::uint32_t a) {
        return ::read(a);
    }
    void write(std::uint32_t a, std::uint32_t v) {
        ::write(a, v);
    }
    std::uint32_t slot(std::uint32_t p, std::uint32_t id) {
        write(scratch, id);
        write(scratch + 4, 0);
        call(0x004cf220U, p + 4, {scratch + 16, scratch});
        const auto n = read(scratch + 16);
        return n ? n + 0x10 : 0;
    }
    std::uint32_t construct(const MajestyRuntimeFeatures::NameGeneratorRecord &r,
                            std::uint32_t resources) {
        return call(
            0x004ca470U, call(0x004ca050U, 0),
            {r.namePartIds[0], r.namePartIds[1], r.namePartIds[2], r.namePartIds[3], resources});
    }
    bool valid_generator(std::uint32_t p) {
        return read(p + 4) && read(p + 8) && read(p + 12) && read(p + 16);
    }
    std::uint32_t allocate_wrapper() {
        return call(0x0064c616U, 0, {8});
    }
    void destroy_generator(std::uint32_t p) {
        call(read(read(p)), p, {1});
    }
};
struct MeterOps {
    std::uint32_t unit(std::uint32_t p) {
        return call(0x00481ec0U, p);
    }
    std::uint32_t window(std::uint32_t p) {
        return read(p + 0x14);
    }
    std::int32_t attribute(std::uint32_t p, std::uint32_t id) {
        return static_cast<std::int32_t>(call(0x005a1c40U, p, {id, 0}));
    }
    void visible(std::uint32_t p, std::uint32_t id, bool show) {
        call(read(read(p) + 0x20), p, {id, show ? 1U : 0U});
    }
    void integer(std::uint32_t p, std::uint32_t id, std::int32_t v) {
        call(read(read(p) + 0x5c), p, {id, static_cast<std::uint32_t>(v), 0});
    }
};
void meter(std::uint32_t p, std::uint64_t generation) {
    const auto s = lifecycle.find(p);
    if (!s.recipe || s.parent || s.generation != generation)
        return;
    MeterOps ops;
    for (const auto &r : recipes.meters)
        if (r.panelKey == s.recipe->panelKey)
            MajestyCommunity::PresentResourceMeter(ops, p, r);
}
std::string guestString(std::uint32_t p) {
    const auto text = read(p), length = read(p + 8);
    require(length < 256, "attribute string bound");
    std::string result(length, '\0');
    for (std::uint32_t i = 0; i < length; ++i) {
        std::uint8_t ch = 0;
        require(host->guest_read_u8(host, text + i, &ch) == POP_OK, "attribute string read");
        result[i] = char(ch);
    }
    return result;
}
std::uint32_t valueRef(std::uint32_t value, std::uint32_t offset) {
    return call(read(read(value) + offset), value);
}
void addAttribute(std::uint32_t context) {
    // Native external-call arguments are references to GPL values. Resolve
    // the real agent and use its original attribute map, not a host sidecar.
    const auto value = [context](unsigned index) {
        return read(read(read(context + 4) + index * 4));
    };
    const auto agent = call(0x006255e0U, valueRef(value(1), 0x5c));
    require(agent != 0, "AddAttribute live agent");
    const auto name = valueRef(value(2), 0x30);
    const auto typeName = guestString(valueRef(value(3), 0x30));
    const auto input = value(4), type = read(input + 4);
    require((typeName == "boolean" && type == 6) || (typeName == "integer" && type == 1) ||
                (typeName == "function" && type == 8),
            "AddAttribute authored type agreement");
    if (call(0x00626440U, agent, {name}) & 0xff)
        return;
    const auto runtime = read(read(0x007218b4U) + 0x10), pool = read(runtime + 0x1c);
    std::uint32_t growthBefore[9];
    for (unsigned i = 0; i < 9; ++i)
        growthBefore[i] = read(pool + 0xa4 + i * 4);
    if (traceRecruitment)
        std::fprintf(stderr,
                     "[alchemist-pool-trace] attribute-before name=%s pool=%08x growth=%u\n",
                     guestString(name).c_str(), pool, read(pool + 0xbc));
    const auto copy = call(0x0062a810U, pool, {type});
    require(copy && read(copy + 4) == type, "AddAttribute original typed allocation");
    // Original list-copy path 00639ac0..00639ada allocates by type then
    // copies through virtual +18. Attribute insertion 006261c0 copies the
    // key and takes the value pointer; the original saver owns both.
    call(read(read(copy) + 0x18), copy, {input});
    if (!(call(0x006261c0U, agent, {name, copy}) & 0xff)) {
        call(0x0062aa20U, pool, {copy});
        require(false, "AddAttribute original insertion refused");
    }
    require(call(0x006263d0U, agent, {name}) == copy,
            "AddAttribute original map owns independent value");
    for (unsigned i = 0; i < 9; ++i)
        require(read(pool + 0xa4 + i * 4) == growthBefore[i],
                "AddAttribute preserves native pool growth settings");
    std::fprintf(stderr, "[alchemist-attributes] installed name=%s type=%u\n",
                 guestString(name).c_str(), type);
    if (traceRecruitment)
        std::fprintf(stderr, "[alchemist-pool-trace] attribute-after name=%s pool=%08x growth=%u\n",
                     guestString(name).c_str(), pool, read(pool + 0xbc));
}
void registerAttributes() {
    const auto prepareName = [](const char *name) {
        const auto length = std::strlen(name);
        require(length < 64, "attribute registration name bound");
        for (unsigned i = 0; i <= length; ++i)
            require(host->guest_write_u8(host, scratch + 128 + i, name[i]) == POP_OK,
                    "attribute registration string");
        write(scratch + 96, scratch + 128);
        write(scratch + 100, length);
        write(scratch + 104, length);
    };
    const auto runtime = read(read(0x007218b4U) + 0x10);
    for (const char *name : {"SetAttribute"}) {
        prepareName(name);
        require(call(0x00631b40U, read(runtime + 8), {scratch + 96}) != 0,
                "stock void binding exists");
        const auto type = call(0x00631ba0U, read(runtime + 8), {scratch + 96});
        require(type == 0, "stock void registry type");
        if (traceRecruitment)
            std::fprintf(stderr, "[alchemist-attributes] stock-void name=%s type=%u\n", name, type);
    }
    prepareName("AddAttribute");
    // The recognized dispatcher hook below implements only this registered
    // external name. NullFunction itself and all other calls stay original.
    // Void is the original None value type 0. Type 10 is the registry's
    // missing-symbol fallback and must never be allocated from the nine
    // value buckets: its index overlaps the pool's growth settings.
    call(0x00631c00U, read(runtime + 8), {scratch + 96, 0x005a9600U, 0, 0, 0});
    require(call(0x00631ba0U, read(runtime + 8), {scratch + 96}) == 0,
            "AddAttribute registered as original None result");
    attributeFunction = call(0x00631b40U, read(runtime + 8), {scratch + 96});
    require(attributeFunction && read(attributeFunction + 20) == 0x005a9600U,
            "AddAttribute registered dispatch identity");
}
void hook(const PopModApi *, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    const auto target = cpu->target, self = cpu->ecx;
    if (target == 0x0062a6a0U) {
        next(inv, cpu);
        std::fprintf(stderr, "[alchemist-pool-trace] constructor pool=%08x growth=%u\n", self,
                     read(self + 0xbc));
        return;
    }
    if (target == 0x0062a7c0U) {
        const auto type = read(cpu->esp + 4), count = read(cpu->esp + 8);
        next(inv, cpu);
        std::fprintf(stderr,
                     "[alchemist-pool-trace] setter pool=%08x type=%u growth=%u boolean=%u\n", self,
                     type, count, read(self + 0xbc));
        return;
    }
    if (target == 0x0062abf0U) {
        const auto type = read(cpu->esp + 4), count = read(cpu->esp + 8);
        next(inv, cpu);
        if (traceArmed && type == 6) {
            const auto bucket = self + (type + 1) * 16;
            std::fprintf(stderr,
                         "[alchemist-pool-trace] boolean-growth count=%u pool=%08x "
                         "start=%08x end=%08x capacity=%08x\n",
                         count, self, read(bucket + 4), read(bucket + 8), read(bucket + 12));
        }
        return;
    }
    if (target == 0x0062a810U || target == 0x0062a890U) {
        const auto type = read(cpu->esp + 4), caller = read(cpu->esp), instruction = cpu->esi;
        next(inv, cpu);
        if (traceArmed && traceValues++ < 1024) {
            std::uint32_t actual = 0, vtable = 0, boolean = 0;
            if (cpu->eax) {
                host->guest_read_u32(host, cpu->eax, &vtable);
                host->guest_read_u32(host, cpu->eax + 4, &actual);
                if (vtable)
                    host->guest_read_u32(host, vtable + 0x2c, &boolean);
            }
            std::fprintf(
                stderr,
                "[alchemist-value-trace] requested=%u actual=%u value=%08x "
                "vtable=%08x bool-method=%08x allocator=%08x caller=%08x instruction=%08x\n",
                type, actual, cpu->eax, vtable, boolean, target, caller, instruction);
            if (caller == 0x0061e586U) {
                std::fprintf(stderr,
                             "[alchemist-result-trace] operation=%u result-ref=%08x "
                             "left-ref=%08x left-value=%08x right-ref=%08x right-value=%08x\n",
                             read(instruction), read(instruction + 16), read(instruction + 20),
                             read(read(instruction + 20)), read(instruction + 24),
                             read(read(instruction + 24)));
            }
            if (type == 6 && actual != type) {
                const auto bucket = self + (type + 1) * 16;
                const auto start = read(bucket + 4), end = read(bucket + 8);
                std::fprintf(stderr,
                             "[alchemist-pool-trace] invalid-boolean pool=%08x "
                             "start=%08x end=%08x capacity=%08x\n",
                             self, start, end, read(bucket + 12));
                if (end >= start && end - start <= 4096) {
                    for (auto at = end > start + 64 ? end - 64 : start; at < end; at += 4)
                        std::fprintf(stderr, "[alchemist-pool-trace] slot=%08x value=%08x\n", at,
                                     read(at));
                }
            }
        }
        return;
    }
    if (target == 0x00424f10U) {
        next(inv, cpu);
        registerAttributes();
        return;
    }
    if (target == 0x00631b40U) {
        const auto name = read(cpu->esp + 4);
        next(inv, cpu);
        if (!cpu->eax && missingFunctions.size() < 64) {
            const auto text = guestString(name);
            // The interpreter also probes constants in the function registry
            // before resolving them elsewhere. Those misses are expected.
            if (!text.empty() && text[0] != '#' &&
                std::find(missingFunctions.begin(), missingFunctions.end(), text) ==
                    missingFunctions.end()) {
                missingFunctions.push_back(text);
                std::fprintf(stderr, "[alchemist-recruit-trace] missing-function=%s\n",
                             text.c_str());
            }
        }
        return;
    }
    // Optional, bounded observation of the authored hero's GPL execution.
    // Read the original function object's string and operator arguments;
    // continue every call unchanged, including the guest's failure path.
    if (target == 0x006381b0U) {
        if (attributeCompat && self == attributeFunction) {
            addAttribute(read(cpu->esp + 4) + 0x14);
            returned(cpu, 0);
            return;
        }
        if (!traceRecruitment) {
            next(inv, cpu);
            return;
        }
        char name[128] = {};
        const auto text = read(self), length = read(self + 8);
        bool valid = text && length && length < sizeof name;
        for (std::uint32_t i = 0; valid && i < length; ++i) {
            std::uint8_t ch = 0;
            valid = host->guest_read_u8(host, text + i, &ch) == POP_OK;
            name[i] = ch >= 32 && ch < 127 ? char(ch) : '?';
        }
        if (valid) {
            if (std::strstr(name, "Alchemist_birth") || std::strstr(name, "alchemist_birth"))
                traceArmed = true;
            if (traceArmed && traceCalls++ < 2048)
                std::fprintf(stderr, "[alchemist-recruit-trace] call=%s block=%08x target=%08x\n",
                             name, read(self + 12), read(self + 20));
        }
        next(inv, cpu);
        return;
    }
    if (target == 0x0063cb20U) {
        const auto sp = cpu->esp;
        const auto operation = read(sp + 4), left = read(sp + 8), right = read(sp + 12);
        next(inv, cpu);
        if (traceArmed && traceOperators++ < 256)
            std::fprintf(stderr,
                         "[alchemist-recruit-trace] operator=%u left-type=%u "
                         "right-type=%u result=%08x\n",
                         operation, left, right, cpu->eax);
        return;
    }
    if (target == 0x004cd8d0U) {
        next(inv, cpu);
        NameOps ops;
        const auto context = call(0x004ba7e0U, 0);
        for (const auto &r : features.nameGenerators)
            require(MajestyCommunity::RegisterNames(ops, self, read(context + 0x160), r) ==
                        MajestyCommunity::Registration::Installed,
                    "native NM18 registration");
        host->log(host, "Alchemist NM18 installed through original generator lifecycle.");
        return;
    }
    if (target == 0x004ca4f0U) {
        const auto a = cpu->esp + 4, requested = read(a), selected = lifecycle.selector(requested),
                   window = read(a + 4), context = read(a + 8);
        if (requested != selected)
            write(a, selected);
        next(inv, cpu);
        if (requested != selected) {
            write(a, requested);
            require(lifecycle.capture(cpu->eax, requested, window, context),
                    "private factory result");
            host->log(host, "Alchemist private panel constructed through original factory.");
        }
        return;
    }
    const auto s = lifecycle.find(self);
    if (target == 0x00465f00U && s.parent && s.recipe &&
        read(cpu->esp + 4) == s.recipe->openCommandId) {
        const auto unit = call(0x00481ec0U, self), family = read(read(unit + 0x80) + 4) & 0xffffffU,
                   child = lifecycle.child(self, read(cpu->esp + 4), family);
        require(child != 0, "private building family");
        returned(cpu, call(0x0047c5c0U, self, {child, 0}));
        return;
    }
    if (target == 0x0047a790U && s.recipe && !s.parent && read(cpu->esp + 4) == 0x1f4dU) {
        const auto unit = call(0x00481ec0U, self);
        if (!unit) {
            returned(cpu, 0);
            return;
        }
        const auto manager = call(0x00415b40U, 0), window = read(self + 0x14);
        call(read(read(window) + 0x14), window);
        call(0x00416890U, manager, {s.recipe->parentDialogId, unit, 0, 0});
        returned(cpu, 1);
        return;
    }
    next(inv, cpu);
    if (target == 0x00465270U || target == 0x0047a360U)
        lifecycle.destroyed(self, s.generation);
    if (target == 0x0047a760U || target == 0x0047aae0U)
        meter(self, s.generation);
}
} // namespace
extern "C" POP_MOD_EXPORT PopModStatus pop_mod_init(const PopModApi *api) {
    if (!api || api->size < offsetof(PopModApi, guest_call) + sizeof(api->guest_call) ||
        !api->guest_call || !api->hook_install_ex)
        return POP_E_ABI;
    host = api;
    const char *trace = std::getenv("RECOMP_ALCHEMIST_RECRUIT_TRACE");
    traceRecruitment = trace && !std::strcmp(trace, "1");
    const char *attributes = std::getenv("RECOMP_ALCHEMIST_ATTRIBUTE_COMPAT");
    attributeCompat = attributes && !std::strcmp(attributes, "1");
    const auto n = file("features.bin", 1024 * 1024),
               c = file("controllers.bin", MajestyStockControllers::kMaximumRegistryBytes);
    std::string error;
    require(n.size() >= 8 && n[4] == 1 && !n[5] && !n[6] && !n[7], "MMFR version");
    require(c.size() >= 8 && c[4] == 20 && !c[5] && !c[6] && !c[7], "MMCR version");
    require(MajestyRuntimeFeatures::ParseRegistry(n.data(), n.size(), &features, &error),
            "original MMFR parser");
    require(MajestyStockControllers::ParseRegistry(c.data(), c.size(), &recipes, &error),
            "original MMCR parser");
    if (host->guest_alloc(host, 256, &scratch) != POP_OK)
        return POP_E_RANGE;
    for (const auto a :
         {0x004cd8d0U, 0x004ca4f0U, 0x00465f00U, 0x00465270U, 0x0047a360U, 0x0047a760U}) {
        std::uint32_t id = 0;
        const auto status = host->hook_install_ex(host, a, 0, hook, POP_HOOK_WRAP,
                                                  POP_HOOK_NO_GAME_VIEW, nullptr, &id);
        if (status != POP_OK)
            return status;
        hooks.push_back(id);
    }
    host->log(host, "Private Alchemist names/factory/setup probe loaded; Back/event entries "
                    "require official function discovery and remain unhooked.");
    if (traceRecruitment || attributeCompat) {
        std::vector<std::uint32_t> extraHooks{0x006381b0U};
        if (traceRecruitment)
            extraHooks.push_back(0x0063cb20U);
        if (traceRecruitment)
            extraHooks.push_back(0x00631b40U);
        if (traceRecruitment)
            extraHooks.push_back(0x0062a810U);
        if (traceRecruitment)
            extraHooks.push_back(0x0062a890U);
        if (traceRecruitment)
            extraHooks.push_back(0x0062abf0U);
        if (traceRecruitment) {
            extraHooks.push_back(0x0062a6a0U);
            extraHooks.push_back(0x0062a7c0U);
        }
        if (attributeCompat)
            extraHooks.push_back(0x00424f10U);
        for (const auto a : extraHooks) {
            std::uint32_t id = 0;
            const auto status = host->hook_install_ex(host, a, 0, hook, POP_HOOK_WRAP,
                                                      POP_HOOK_NO_GAME_VIEW, nullptr, &id);
            if (status != POP_OK)
                return status;
            hooks.push_back(id);
        }
    }
    return POP_OK;
}
extern "C" POP_MOD_EXPORT PopModStatus pop_mod_exit() {
    for (const auto id : hooks)
        host->hook_remove(host, id);
    hooks.clear();
    if (scratch)
        host->guest_free(host, scratch);
    scratch = 0;
    attributeFunction = 0;
    return POP_OK;
}
