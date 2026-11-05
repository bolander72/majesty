#include "private_template_bank.h"
#include "runtime/guest.h"

namespace {
MajestyCommunity::PrivateTemplateBank &bank() {
    static MajestyCommunity::PrivateTemplateBank value;
    return value;
}
bool collectionFailed = false;
constexpr unsigned bridgeCount = MajestyCommunity::privateTemplateBridgeCount;
std::uint32_t addresses[bridgeCount]{};
std::uint8_t hooked[bridgeCount]{};
bool installed = false;
constexpr unsigned groups[] = {0, 0, 1, 1, 2, 2, 3, 3, 3};
constexpr std::uint32_t originals[] = {0x00465510, 0x00465ac0, 0x00465510, 0x00465ac0, 0x00465510,
                                       0x00465ac0, 0x0047e680, 0x0047f1b0, 0x0047f530};

// This is a tail dispatch on the existing guest frame. No RAII owner or
// mutable selector spans the translated body: a native RET/SEH may leave this
// host frame through the original callback boundary.
template <unsigned Slot> void invoke(X86 *cpu) {
    const auto body = bank().find(groups[Slot], originals[Slot]);
    cpu->eip = originals[Slot];
    body(cpu);
}
// Each sequential refresh uses the original callback boundary and the same
// building/queue. Scratch CPU/stack state leaves the caller's frame intact.
void refreshThree(X86 *cpu) {
    X86 extra = *cpu;
    extra.r[R_ESP] -= 512;
    const auto controller = cpu->r[R_ECX];
    for (auto slot : {0U, 2U, 4U}) {
        extra.r[R_ECX] = controller;
        guest_call(&extra, addresses[slot]);
    }
    cpu->eip = rd32(cpu->r[R_ESP]);
    cpu->r[R_ESP] += 4;
    recomp_return(cpu);
}
void (*const bodies[bridgeCount])(X86 *) = {invoke<0>, invoke<1>,   invoke<2>, invoke<3>,
                                            invoke<4>, invoke<5>,   invoke<6>, invoke<7>,
                                            invoke<8>, refreshThree};
void hookedBody(X86 *cpu, std::uint32_t index) {
    bodies[index](cpu);
}
RecompHookFn hookBodies[bridgeCount] = {hookedBody, hookedBody, hookedBody, hookedBody, hookedBody,
                                        hookedBody, hookedBody, hookedBody, hookedBody, hookedBody};
[[maybe_unused]] RecompModule bridges{"majesty_private_template_bridges",
                                      0,
                                      0,
                                      addresses,
                                      bridgeCount,
                                      bodies,
                                      hookBodies,
                                      hooked,
                                      nullptr,
                                      0,
                                      nullptr};
} // namespace

extern "C" void majesty_collect_private_template(const RecompModule *module) {
    if (!bank().add(module))
        collectionFailed = true;
}

extern "C" bool majesty_private_templates_ready() {
    return !collectionFailed && bank().ready();
}

extern "C" bool majesty_install_private_template_bridges(std::uint32_t base) {
#if !defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    (void)base;
    return false;
#else
    constexpr std::uint32_t bytes = bridgeCount * 16;
    if (!majesty_private_templates_ready() || !g_mem || base % 16 || base < HEAP_BASE ||
        !gm_valid(base, bytes) || base > HEAP_LIMIT - bytes)
        return false;
    if (installed)
        return bridges.base == base;
    for (unsigned i = 0; i < recomp_module_count(); ++i) {
        const auto *other = recomp_module_at(i);
        if (base < other->end && base + bytes > other->base)
            return false;
    }
    for (unsigned i = 0; i < bridgeCount; ++i)
        addresses[i] = base + i * 16;
    bridges.base = base;
    bridges.end = base + bytes;
    recomp_module_register(&bridges);
    installed = true;
    return true;
#endif
}

extern "C" std::uint32_t majesty_private_template_bridge(unsigned slot) {
    return installed && slot < bridgeCount ? addresses[slot] : 0;
}
