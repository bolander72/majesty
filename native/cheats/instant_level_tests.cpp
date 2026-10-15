#include "instant_level.h"
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <limits>
using namespace MajestyInstantLevel;
static unsigned checks;
static void check(bool ok) { ++checks; if (!ok) { std::fprintf(stderr, "failed check %u\n", checks); std::exit(1); } }
// Independent scalar transcription of the SDK rules, with one ordinary level
// at a time, compared with the bulk result. The runtime never executes this.
static Input reference(Input s) {
    while (s.level < s.target) {
        ++s.level;
        int bonus = s.vitality / 4;
        if (bonus < 1) bonus = 1;
        const std::uint32_t bits = s.seed * 1664525U + 182531539U;
        const auto signedValue = bits < 0x80000000U ? std::int64_t(bits) : std::int64_t(bits) - 0x100000000LL;
        const auto shift = signedValue >= 0 ? signedValue / 65536 : -((-signedValue + 65535) / 65536);
        s.seed = (std::uint32_t(shift + bits) ^ 27941U) & 0x7fffffffU;
        const int hp = bonus + (bonus <= 1 ? 0 : int(s.seed % unsigned(bonus))) + 1;
        s.maxHp += hp; s.hp += hp;
        if (s.level % 2 == 1) { ++s.primaryValue; if (s.primary == 3) ++s.vitality; }
        if (s.attackType == 1 && s.melee < 98) ++s.melee;
        if (s.attackType == 2 && s.ranged < 98) ++s.ranged;
        if (s.dodge < 98) ++s.dodge;
        if (s.parry < 98) ++s.parry;
        if (s.rangeIncrease) { if (s.sight < 550) s.sight += 10; if (s.range < 550) s.range += 10; }
        if (s.criticalIncrease) ++s.critical;
        if (s.healer) ++s.reborn;
    }
    return s;
}
int main() {
    for (int primary = 0; primary < 5; ++primary)
        for (int start : {1, 7, 8, 11, 33, 127, 500, 999})
            for (int vitality : {1, 3, 4, 15, 20, 72})
                for (int attack : {0, 1, 2})
                    for (std::uint32_t seed : {0U, 1U, 0x7fffffffU, 0xffffffffU}) {
                        Input in; in.level = start; in.primary = primary; in.primaryValue = vitality;
                        in.vitality = vitality; in.hp = 17; in.maxHp = 35;
                        in.attackType = attack; in.melee = 101; in.ranged = 22; in.parry = 97;
                        in.dodge = -5; in.rangeIncrease = true; in.sight = 545; in.range = 555;
                        in.criticalIncrease = true; in.critical = 3; in.healer = true; in.reborn = 2; in.seed = seed;
                        Plan out; check(prepare(in, out)); const auto expected = reference(in);
                        check(out.level == expected.level); check(out.hp == expected.hp);
                        check(out.maxHp == expected.maxHp); check(out.primaryValue == expected.primaryValue);
                        check(out.melee == expected.melee); check(out.ranged == expected.ranged);
                        check(out.parry == expected.parry); check(out.dodge == expected.dodge);
                        check(out.sight == expected.sight); check(out.range == expected.range);
                        check(out.critical == expected.critical); check(out.reborn == expected.reborn);
                        check(out.seed == expected.seed); check(out.maxHp - out.hp == 18);
                    }
    Input in; Plan out; in.maxHp = std::numeric_limits<int>::max(); check(!prepare(in, out));
    in = {}; in.level = 1000; check(!prepare(in, out));
    in.level = 0; check(!prepare(in, out));
    in = {}; in.hp = 0; check(!prepare(in, out));
    in = {}; in.primary = 5; check(!prepare(in, out));
    in = {}; in.target = 1001; check(!prepare(in, out));
    in = {}; in.rangeIncrease = false; in.criticalIncrease = false; in.healer = false;
    in.sight = 200; in.range = 180; in.critical = 3; in.reborn = 2; check(prepare(in, out));
    check(out.sight == 200 && out.range == 180 && out.critical == 3 && out.reborn == 2);
    std::printf("Instant level arithmetic: %u checks passed\n", checks);
}
