// Private stress-fixture builder. Never included in a public engine or content pack.
#include "pop_mod_api.h"
#include <cstdio>
#include <cstdint>
#include <cstdlib>
#include <initializer_list>
#include <vector>
POP_MOD_DECLARE_ABI();
namespace {
const PopModApi *host;
std::uint32_t hookId = 0;
unsigned index = 0;
std::vector<std::uint32_t> healing;
std::vector<std::uint32_t> guilds;
void need(bool ok) {
    if (!ok) {
        std::fputs("[kingdom-fixture] refused\n", stderr);
        std::abort();
    }
}
std::uint32_t read(std::uint32_t a) {
    std::uint32_t v = 0;
    need(host->guest_read_u32(host, a, &v) == POP_OK);
    return v;
}
std::uint32_t call(std::uint32_t a, std::uint32_t self,
                   std::initializer_list<std::uint32_t> args = {}) {
    std::uint32_t out = 0;
    need(host->guest_call(host, a, self, args.begin(), args.size(), &out) == POP_OK);
    return out;
}
void set(std::uint32_t u, std::uint32_t key, std::uint32_t v) {
    call(read(read(u) + 0x124), u, {key, v});
}
void tick(const PopModApi *, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    need(host->call_next(host, inv, cpu) == POP_OK);
    auto state = read(0x006d7670);
    if (!state || read(state) != 3 || read(state + 4))
        return;
    auto world = read(0x0071c68c), factory = world ? read(world + 4) : 0;
    if (!factory)
        return;
    for (auto it = healing.begin(); it != healing.end();) {
        const auto unit = call(0x005a10d0, factory, {*it});
        need(unit != 0);
        const auto maximum = call(0x005a1c40, unit, {0x01555041, 0});
        if (maximum > 1) {
            set(unit, 0x00555041, maximum);
            it = healing.erase(it);
        } else
            ++it;
    }
    if (index >= 120)
        return;
    auto palace = call(0x005a10d0, factory, {2518});
    if (!palace || read(palace + 0x6c) != 0x314a4241 || read(palace + 0x70))
        return;
    // Original raw creation followed by ordinary actor initialization. No saved
    // UNIT/agent records are copied or patched. A generated save must separately
    // prove brains, living actors, homes and spatial positions before benchmarking.
    const bool hero = index >= 80;
    const std::uint32_t resource = index < 10   ? 0x31564241
                                   : index < 50 ? 0x31454241
                                   : index < 80 ? 0x31654241
                                                : 0x314c5641;
    const auto slot = hero ? index - 80 : index;
    const auto x = 2500 + (slot % 10) * 256, y = 2500 + (slot / 10) * 256;
    auto unit =
        call(0x005a1350, factory, {hero ? 1u : 0u, resource, 0, 8, x << 11, y << 11, 0, 0, 0});
    need(unit != 0);
    if (hero) {
        need(guilds.size() == 10);
        auto home = guilds[(index - 80) / 4];
        call(0x00598e20, home + 0x94, {unit, home, 100});
    } else {
        set(unit, 0x01425041, 1);
        set(unit, 0x02425041, 1);
    }
    auto hp = call(0x005a1c40, unit, {0x01555041, 1});
    set(unit, 0x00555041, hp);
    call(read(read(unit) + 0x200), unit, {0, 0});
    call(read(read(unit) + 8), unit, {0});
    call(read(read(unit) + 0x18), unit);
    auto agent = call(0x005a1c40, unit, {0x4541, 0});
    std::fprintf(stderr,
                 "[kingdom-fixture] index=%u unit=%u resource=%08x agent=%u hp=%u position=%u,%u\n",
                 index, read(unit + 0x60), resource, agent, hp, x, y);
    need(agent != 0);
    healing.push_back(read(unit + 0x60));
    if (index < 10)
        guilds.push_back(unit);
    ++index;
    if (index == 120)
        host->log(host, "Private kingdom fixture created: 80 buildings and 40 heroes; save "
                        "validation pending.");
}
} // namespace
extern "C" POP_MOD_EXPORT PopModStatus pop_mod_init(const PopModApi *api) {
    host = api;
    return api->hook_install_ex(api, 0x005d9680, 0, tick, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW,
                                nullptr, &hookId);
}
extern "C" POP_MOD_EXPORT PopModStatus pop_mod_exit() {
    return POP_OK;
}
