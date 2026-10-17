#include "hero_ui_runtime.h"
#include "runtime/guest.h"
#include "runtime/imports.h"
#include "runtime/memory.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace {
const RecompModule *presenters = nullptr;
bool rejected = false;
std::uint32_t addresses[2]{}, gateways[2]{};
std::uint8_t hooked[2]{};
[[noreturn]] void fail() {
    std::fprintf(stderr, "[community-hero-ui] refused original private presenter binding\n");
    std::abort();
}
void learned(X86 *cpu) {
    cpu->eip = 0x00470c00U;
    presenters->base_ptrs[0](cpu);
}
void effects(X86 *cpu) {
    cpu->eip = 0x00471030U;
    presenters->base_ptrs[1](cpu);
}
void (*const bodies[])(X86 *) = {learned, effects};
void wrapped(X86 *cpu, std::uint32_t index) {
    if (index >= 2)
        fail();
    bodies[index](cpu);
}
RecompHookFn hooks[] = {wrapped, wrapped};
RecompModule bridge{
    "majesty_community_hero_ui", 0, 0, addresses, 2, bodies, hooks, hooked, nullptr, 0, nullptr};
void forward(X86 *cpu, unsigned index) {
    if (!cpu || cpu->r[R_ESP] < 1024 || !gm_valid(cpu->r[R_ESP], 4))
        fail();
    X86 extra = *cpu;
    extra.r[R_ESP] -= 512;
    cpu->r[R_EAX] = guest_call(&extra, addresses[index], nullptr, 0);
}
void forwardLearned(X86 *cpu) {
    forward(cpu, 0);
}
void forwardEffects(X86 *cpu) {
    forward(cpu, 1);
}
} // namespace

extern "C" void majesty_collect_private_hero_ui(const RecompModule *module) {
    if (presenters || !module || !module->name ||
        std::strcmp(module->name, "majesty_private_hero_ui") || module->base != 0x00400000U ||
        module->end != 0x00726000U || module->func_count != 2 || !module->func_addrs ||
        !module->base_ptrs || module->func_addrs[0] != 0x00470c00U ||
        module->func_addrs[1] != 0x00471030U || !module->base_ptrs[0] || !module->base_ptrs[1]) {
        rejected = true;
        return;
    }
    presenters = module;
}

extern "C" std::uint32_t majesty_community_hero_ui_bridge(unsigned kind) {
#if !defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    return 0;
#else
    if (kind >= 2 || rejected || !presenters)
        return 0;
    if (!gateways[0]) {
        const auto storage = heap_alloc(32, true);
        if (!storage)
            fail();
        addresses[0] = storage;
        addresses[1] = storage + 16;
        bridge.base = storage;
        bridge.end = storage + 32;
        recomp_module_register(&bridge);
        const char *names[] = {"HeroLearned", "HeroEffects"};
        void (*const functions[])(X86 *) = {forwardLearned, forwardEffects};
        for (unsigned i = 0; i < 2; ++i) {
            if (imports_trampoline_for("MajestyCommunityCore", names[i]))
                fail();
            gateways[i] =
                imports_alloc_trampoline("MajestyCommunityCore", names[i], functions[i], 0);
            if (!gateways[i] || !imports_describe(gateways[i]) || imports_argc(gateways[i]) != 0)
                fail();
        }
    }
    return gateways[kind];
#endif
}
