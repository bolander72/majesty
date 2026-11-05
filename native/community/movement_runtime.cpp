#include "movement_runtime.h"
#include "runtime/guest.h"
#include "runtime/imports.h"
#include "runtime/memory.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>

namespace {
const RecompModule *movement = nullptr;
bool rejected = false;
std::uint32_t address = 0, gateway = 0;
std::uint8_t hooked = 0;
[[noreturn]] void fail() {
    std::fprintf(stderr, "[community-movement] refused private native order binding\n");
    std::abort();
}
void execute(X86 *cpu) {
    cpu->eip = 0x005b7490U;
    movement->base_ptrs[0](cpu);
}
void hookedExecute(X86 *cpu, std::uint32_t index) {
    if (index)
        fail();
    execute(cpu);
}
void (*const bodies[])(X86 *) = {execute};
RecompHookFn hooks[] = {hookedExecute};
RecompModule bridge{
    "majesty_community_movement", 0, 0, &address, 1, bodies, hooks, &hooked, nullptr, 0, nullptr};
void forward(X86 *cpu) {
    if (!cpu || cpu->r[R_ESP] < 1024 || !gm_valid(cpu->r[R_ESP], 16))
        fail();
    std::uint32_t args[3];
    for (unsigned i = 0; i < 3; ++i)
        args[i] = rd32(cpu->r[R_ESP] + 4 + i * 4);
    X86 extra = *cpu;
    extra.r[R_ESP] -= 512;
    cpu->r[R_EAX] = guest_call(&extra, address, args, 3);
}
} // namespace

extern "C" void majesty_collect_private_movement(const RecompModule *module) {
    if (movement || !module || !module->name ||
        std::strcmp(module->name, "majesty_private_movement") || module->base != 0x00400000U ||
        module->end != 0x00726000U || module->func_count != 1 || !module->func_addrs ||
        !module->base_ptrs || module->func_addrs[0] != 0x005b7490U || !module->base_ptrs[0]) {
        rejected = true;
        return;
    }
    movement = module;
}

extern "C" std::uint32_t majesty_community_movement_bridge() {
#if !defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    return 0;
#else
    if (rejected || !movement)
        return 0;
    if (!gateway) {
        address = heap_alloc(16, true);
        if (!address || imports_trampoline_for("MajestyCommunityCore", "MovementExecute"))
            fail();
        bridge.base = address;
        bridge.end = address + 16;
        recomp_module_register(&bridge);
        gateway = imports_alloc_trampoline("MajestyCommunityCore", "MovementExecute", forward, 3);
        if (!gateway || !imports_describe(gateway) || imports_argc(gateway) != 3)
            fail();
    }
    return gateway;
#endif
}
