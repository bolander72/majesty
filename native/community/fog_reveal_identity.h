#pragma once
#include <cstdint>

namespace MajestyCommunity {
// Old's 0042ee50 rejects descriptor IDs outside the legacy V/B families before
// computing the native sight circle. Its synchronous call only computes fog
// coordinates/player masks and updates exploration; it does not dispatch GPL.
// Admit the real Alchemist for that call, then restore the shared descriptor.
// Neither the actor's ID nor its saved/GPL identity is changed.
template <class Ops, class Next>
bool WithAlchemistFogReveal(Ops &ops, std::uint32_t unit, Next next) {
    const auto descriptor = unit ? ops.read(unit + 0x80) : 0;
    const bool alchemist = descriptor && ops.read(unit + 0x5c) == 1 &&
                           ops.read(unit + 0x6c) == 0x31434c41U &&
                           ops.read(descriptor + 4) == 0x31434c41U;
    if (!alchemist) {
        next();
        return true;
    }
    const auto serial = ops.read(unit + 0x60);
    ops.write(descriptor + 4, 0x31435641U);
    next();
    const bool intact = ops.read(unit + 0x60) == serial && ops.read(unit + 0x6c) == 0x31434c41U &&
                        ops.read(unit + 0x80) == descriptor &&
                        ops.read(descriptor + 4) == 0x31435641U;
    ops.write(descriptor + 4, 0x31434c41U);
    return intact;
}
} // namespace MajestyCommunity
