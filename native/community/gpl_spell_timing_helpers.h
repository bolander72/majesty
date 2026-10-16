#pragma once
#include "gpl_integer_helpers.h"

namespace MajestyCommunity {
enum class SpellTimingHelper { Remaining, Commit };

// Old's learned-spell container is a singly linked list. The modern mod
// manager's doubly linked layout must never be applied to these actors.
template <class Ops>
int CommitOldSpellCooldown(Ops &ops, std::uint32_t unit, std::uint32_t description) {
    using namespace MajestyNativeTiming;
    if (!ops.valid(unit, 0x160) || ops.read(unit) != 0x0068098cU)
        return kUnsupported;
    if (!ops.valid(description, 0x1c))
        return kUnsupported;
    const auto game = ops.read(description + 0x18);
    if (!ops.valid(game, 0x10) || ops.read(game + 0x0c) > 0x7fffffffU)
        return kUnsupported;
    const auto count = ops.read(unit + 0x15c), head = ops.read(unit + 0x154),
               tail = ops.read(unit + 0x158);
    if (count > 65536 || !ops.valid(head, 4) || !ops.valid(tail, 4))
        return kUnsupported;
    auto node = ops.read(head);
    const auto end = ops.read(tail), identity = ops.read(description + 4);
    for (std::uint32_t i = 0; i < count; ++i) {
        if (!node || node == end || node == head || !ops.valid(node, 16))
            return kUnsupported;
        if (ops.read(node + 4) == identity) {
            // Literal CastSpell write order; do not dispatch the spell, edit
            // learned spells, or change the adjacent availability byte.
            const auto timeout = ops.read(game + 0x0c), now = ops.now();
            ops.write(node + 0x0c, timeout);
            ops.write(node + 8, now);
            return 1;
        }
        node = ops.read(node);
    }
    return node == end ? 0 : kUnsupported;
}

template <class Ops>
int OldEffectorRemaining(Ops &ops, std::uint32_t unit, std::uint32_t description) {
    using namespace MajestyNativeTiming;
    if (!ops.valid(unit, 4))
        return kInvalid;
    const auto table = ops.read(unit);
    if (!ops.valid(table + 0x140, 4) || ops.read(table + 0x140) != 0x005b4570U)
        return kUnsupported;
    const auto effect = ops.call(0x005b4570U, unit, {ops.read(description + 4)});
    if (!effect)
        return 0;
    if (!ops.valid(effect, 4))
        return kUnsupported;
    const auto effectTable = ops.read(effect);
    if (!ops.valid(effectTable + 0x180, 4) || ops.read(effectTable + 0x180) != 0x005b2e10U)
        return kUnsupported;
    const auto order = ops.call(0x005b2e10U, effect, {1, 9});
    if (!order)
        return kNoExpiry;
    if (!ops.valid(order, 0x30) || ops.read(order + 0x10) != 9 || ops.read(order + 0x2c) != 0x100d)
        return kUnsupported;
    return Remaining(ops.now(), ops.read(order + 8), ops.read(order + 0x0c),
                     ops.read(order + 0x18));
}

template <class Ops>
bool ExecuteSpellTimingHelper(Ops &ops, SpellTimingHelper helper, std::uint32_t context) {
    NativeIntegerArguments arguments;
    if (!arguments.read(ops, context))
        return false;
    using namespace MajestyNativeTiming;
    int result = kInvalid;
    const auto agent = arguments.values[1], name = arguments.values[2];
    if (agent && name && ops.read(agent + 4) == 5 && ops.read(name + 4) == 3) {
        const auto description =
            ops.timingDescription(name, helper == SpellTimingHelper::Commit, result);
        if (description) {
            const auto unit = ops.unit(agent);
            result = !unit ? kInvalid
                     : helper == SpellTimingHelper::Commit
                         ? CommitOldSpellCooldown(ops, unit, description)
                         : OldEffectorRemaining(ops, unit, description);
        }
    }
    // Resolve and consume every input before storing the GPL return value.
    ops.write(arguments.integers[0], static_cast<std::uint32_t>(result));
    return true;
}
} // namespace MajestyCommunity
