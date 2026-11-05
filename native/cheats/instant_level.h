// Bulk form of the pinned SDK give_exp level-up arithmetic, without GPL replay.
#pragma once
#include <algorithm>
#include <cstdint>
#include <limits>

namespace MajestyInstantLevel {
struct Input {
    int level = 1, target = 1000, vitality = 1;
    int primary = 0, primaryValue = 0;
    int hp = 1, maxHp = 1, melee = 0, ranged = 0, dodge = 0, parry = 0;
    int sight = 0, range = 0, attackType = 0, critical = 0, reborn = 0;
    bool rangeIncrease = false, criticalIncrease = false, healer = false;
    std::uint32_t seed = 0;
};
struct Plan : Input {};
// Exact 004f6690 generator, including arithmetic shift and a draw for bound1.
inline std::uint32_t draw(std::uint32_t &seed, std::uint32_t bound) {
    const auto x = seed * 0x19660dU + 0x0ae135d3U;
    const auto shifted = (x >> 16) | ((x & 0x80000000U) ? 0xffff0000U : 0U);
    seed = ((shifted + x) ^ 0x6d25U) & 0x7fffffffU;
    return bound < 2 ? 0U : seed % bound;
}
inline bool add(int value, std::int64_t delta, int &out) {
    const auto n = std::int64_t(value) + delta;
    if (n < std::numeric_limits<int>::min() || n > std::numeric_limits<int>::max())
        return false;
    out = int(n);
    return true;
}
inline int skill(int value, int count) {
    return value < 98 ? int(std::min<std::int64_t>(98, std::int64_t(value) + count)) : value;
}
inline int distance(int value, int count) {
    if (value >= 550) return value;
    const auto steps = std::min<std::int64_t>(count, (550LL - value + 9) / 10);
    return int(std::int64_t(value) + steps * 10);
}
inline bool prepare(const Input &in, Plan &out) {
    if (in.level < 1 || in.target <= in.level || in.target > 1000 ||
        in.primary < 0 || in.primary > 4 || in.hp <= 0 || in.maxHp <= 0)
        return false;
    static_cast<Input &>(out) = in;
    const int count = in.target - in.level;
    int vitality = in.vitality;
    std::int64_t hpGain = 0;
    // At most999 cheap integer steps, with NO guest calls, notifications or
    // intermediate levels. Vitality-primary growth affects subsequent HP rolls.
    for (int level = in.level + 1; level <= in.target; ++level) {
        const auto bonus = std::uint32_t(std::max(1, vitality / 4));
        hpGain += bonus + draw(out.seed, bonus) + 1;
        if (in.primary == 3 && (level & 1) && !add(vitality, 1, vitality)) return false;
    }
    const int primaryGain = (in.target - 1) / 2 - (in.level - 1) / 2;
    if (!add(in.hp, hpGain, out.hp) || !add(in.maxHp, hpGain, out.maxHp) ||
        !add(in.primaryValue, primaryGain, out.primaryValue) ||
        (in.criticalIncrease && !add(in.critical, count, out.critical)) ||
        (in.healer && !add(in.reborn, count, out.reborn))) return false;
    if (in.attackType == 1) out.melee = skill(in.melee, count);
    if (in.attackType == 2) out.ranged = skill(in.ranged, count);
    out.dodge = skill(in.dodge, count);
    out.parry = skill(in.parry, count);
    if (in.rangeIncrease) {
        out.sight = distance(in.sight, count);
        out.range = distance(in.range, count);
    }
    out.level = in.target;
    return true;
}
} // namespace MajestyInstantLevel
