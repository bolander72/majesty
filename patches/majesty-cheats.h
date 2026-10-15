// Game-thread cheats for the pinned MajestyHD - Old.exe. See docs/browser-cheats.md.
#pragma once
#include "mods/mods_internal.h"
#include "runtime/guest.h"
#include "runtime/native_seam.h"
#include "platform/os.h"
#include "majesty-instant-level.h"
#include <vector>
#include <algorithm>
#include <array>
#include <cstdio>
#include <cstring>
#include <string_view>

namespace majesty_cheats {
void characters(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
  static unsigned remaining = 32;
  if (remaining && gm_valid(cpu->esp, 12)) { --remaining; std::fprintf(stderr, "[cheats-input] character=%u flags=%u\n", rd32(cpu->esp+4), rd32(cpu->esp+8)); }
  mods_call_next(api, inv, cpu);
}

// Seven digits fit the original treasury widget without clipping.
constexpr int32_t gold_floor = 9999999;
constexpr int32_t hero_level = 1000;
struct PendingHero { uint32_t id; unsigned retries = 0; };
struct State {
  uint32_t world = 0, owner = 0;
  bool gold = false, levels = false, scan_heroes = false;
  std::vector<PendingHero> pending;
} active;

bool context(uint32_t &world, uint32_t &owner, bool settled = true) {
  const uint32_t state = rd32(0x006d7670), settings = rd32(0x006d87a0);
  world = rd32(0x0071c68c);
  // 00480a56..00480a6c admits the original cheat input through settings+9c.
  // Keep that switch and refuse a joined network session, including co-op.
  if (!state || !world || !settings || !gm_valid(state, 0x50) ||
      !gm_valid(world, 0x18) || !gm_valid(settings, 0xa0) ||
      (rd32(state) != 3 && rd32(state) != 7) || (settled && rd32(state + 4)) ||
      !rd32(settings + 0x9c) || recomp_network_session_epoch())
    return false;
  owner = rd32(state + 0x24); // Original004169a0 selects this kingdom.
  return owner < 8 && rd32(world + 4) && gm_valid(rd32(world + 4), 0x88);
}

// TString: pointer, capacity/encoding flags, length; verified004e4340/004e5530.
// Accept the same ASCII phrases from either native narrow or wide input.
bool phrase(uint32_t text, std::array<char, 64> &out) {
  if (!text || !gm_valid(text, 12)) return false;
  const uint32_t flags = rd32(text + 4), length = rd32(text + 8),
                 data = rd32(text), stride = flags & 0x1000000u ? 2u : 1u;
  if (!length || length > (flags & 0xffffffu) || length >= out.size() || !data ||
      !gm_valid(data, (length + 1) * stride)) return false;
  for (uint32_t i = 0; i < length; ++i) {
    uint32_t ch = stride == 2 ? rd16(data + i * stride) : rd8(data + i);
    if (!ch || ch > 127) return false;
    if (ch >= 'A' && ch <= 'Z') ch += 'a' - 'A';
    out[i] = char(ch);
  }
  return (stride == 2 ? rd16(data + length * stride) : rd8(data + length)) == 0;
}

void input(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
  static unsigned reports = 0;
  const char *debug = recomp_env("CHEAT_DEBUG");
  if (debug && !std::strcmp(debug,"1") && reports++ < 8 && gm_valid(cpu->esp,8)) { const uint32_t p=rd32(cpu->esp+4); if(gm_valid(p,12)) std::fprintf(stderr,"[cheats-input] handler string=%08x flags=%08x length=%u\n",rd32(p),rd32(p+4),rd32(p+8)); }
  std::array<char, 64> code{};
  const uint32_t text = gm_valid(cpu->esp, 8) ? rd32(cpu->esp + 4) : 0;
  if (!phrase(text, code)) { mods_call_next(api, inv, cpu); return; }
  std::string_view value(code.data());
  while (!value.empty() && value.front() == ' ') value.remove_prefix(1);
  while (!value.empty() && value.back() == ' ') value.remove_suffix(1);
  if (value != "infinite gold" && value != "level 1000") {
    mods_call_next(api, inv, cpu); return;
  }
  uint32_t world = 0, owner = 0;
  if (!context(world, owner)) { mods_call_next(api, inv, cpu); return; }
  if (active.world != world || active.owner != owner) {
    active = {}; active.world = world; active.owner = owner;
  }
  bool &enabled = value == "infinite gold" ? active.gold : active.levels;
  // Use a temporary mod allocation only for the original TString setter.
  // No guest string, actor pointer or hook CPU survives this callback.
  uint32_t message = 0;
  const char *reply = value == "infinite gold"
      ? (enabled ? "Infinite gold disabled." : "Infinite gold enabled.")
      : (enabled ? "Automatic hero leveling disabled."
                 : "Heroes are now level 1000.");
  if (mods_guest_alloc(MODS_OWNER_RUNTIME, 64, &message) != POP_OK) {
    mods_call_next(api, inv, cpu); return;
  }
  for (size_t i = 0; i <= std::strlen(reply); ++i) wr8(message + uint32_t(i), reply[i]);
  uint32_t result = 0;
  // Runtime-owned callbacks receive the minimal built-in API; its optional
  // guest_call tail is empty. Initialize the supported hooks API explicitly.
  PopModApi calls{};
  mods_fill_hooks_api(&calls);
  const PopModStatus status = calls.guest_call(&calls, 0x004e3fc0u, text, &message, 1, &result);
  mods_guest_free(MODS_OWNER_RUNTIME, message);
  if (status != POP_OK) { mods_call_next(api, inv, cpu); return; }
  enabled = !enabled;
  if (value == "level 1000") {
    active.scan_heroes = enabled;
    active.pending.clear();
  }
  std::fprintf(stderr, "[cheats] %.*s %s owner=%u\n", int(value.size()), value.data(),
               enabled ? "enabled" : "disabled", owner);
  // Original00480e00 is thiscall(TString*), returns recognition in EAX, pops4.
  mods_hook_return(api, cpu, 1, 4);
}

// The original build-anything flag skips NotBuildable and prerequisite
// checks. Exclude two internal resources at the construction-list insertion
// site, without changing their quest definitions, existing actors or saves.
// 00468c08 passes (out iterator, insertion node, row); the row's TString is
// followed by its four-byte resource ID at +0c. 00469eb0 returns the iterator
// and pops twelve bytes. Both layouts are verified in the pinned listings.
void construction_row(const PopModApi *api, pop_cpu_v1 *cpu,
                      PopHookInvocation *inv, void *) {
  if (!gm_valid(cpu->esp, 16) || rd32(cpu->esp) != 0x00468c0du) {
    mods_call_next(api, inv, cpu); return;
  }
  const uint32_t row = rd32(cpu->esp + 12);
  if (!row || !gm_valid(row, 16)) {
    mods_call_next(api, inv, cpu); return;
  }
  const uint32_t type = rd32(row + 12);
  // ABA0: placeholder_building (no GPL agent); ABJ4: EvilPalace.
  if (type != 0x30414241u && type != 0x344a4241u) {
    mods_call_next(api, inv, cpu); return;
  }
  const uint32_t result = rd32(cpu->esp + 4), position = rd32(cpu->esp + 8);
  if (!result || !position || !gm_valid(result, 4) || !gm_valid(position, 8)) {
    mods_call_next(api, inv, cpu); return;
  }
  wr32(result, position); // A skipped insert leaves the original list intact.
  mods_hook_return(api, cpu, result, 12);
}

void spawned(const PopModApi *, pop_cpu_v1 *, PopHookInvocation *, void *);

void install() {
  static bool attempted = false;
  if (attempted) return;
  attempted = true;
  uint32_t hook = 0;
  if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00480e00u, 0, input,
       POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &hook) != POP_OK)
    std::fprintf(stderr, "[cheats] Native cheat input unavailable\n");
  else std::fprintf(stderr, "[cheats] Native cheat input installed\n");
  uint32_t spawn_hook = 0;
  if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005a1350u, 0, spawned,
       POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &spawn_hook) != POP_OK)
    std::fprintf(stderr, "[cheats] New-hero observation unavailable\n");
  uint32_t construction_hook = 0;
  if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00469eb0u, 0, construction_row,
       POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &construction_hook) != POP_OK)
    std::fprintf(stderr, "[cheats] Construction safety filter unavailable\n");
  else std::fprintf(stderr, "[cheats] Construction safety filter installed\n");
  const char *debug = recomp_env("CHEAT_DEBUG");
  if (debug && !std::strcmp(debug,"1")) { uint32_t id=0; mods_hook_install_ex(MODS_OWNER_RUNTIME,0x004f4a10u,0,characters,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&id); }
}

void refill_gold(X86 *c, uint32_t factory, uint32_t owner) {
  X86 extra = *c;
  const uint32_t table = rd32(factory);
  if (!table || !gm_valid(table, 0x24)) return;
  extra.r[R_ECX] = factory;
  const uint32_t player = guest_call(&extra, rd32(table + 0x18), owner);
  if (!player || !gm_valid(player, 4) || !gm_valid(rd32(player), 0x24)) return;
  extra.r[R_ECX] = player;
  const int32_t gold = int32_t(guest_call(&extra, rd32(rd32(player) + 0x20), 0x00505041u));
  if (gold >= gold_floor) return;
  // Original FILL THIS BAG00495b94 uses player virtual+1c to adjust APP.
  // Clamp the delta to signed32; the floor leaves ample headroom for rewards.
  const int64_t delta = int64_t(gold_floor) - gold;
  extra.r[R_ECX] = player;
  guest_call(&extra, rd32(rd32(player) + 0x1c), 0x00505041u,
             uint32_t(std::min<int64_t>(delta, INT32_MAX)));
}

int32_t level(X86 *c, uint32_t unit) {
  X86 extra = *c; extra.r[R_ECX] = unit;
  // Exact original GROW UP00495dc7..00495dd0: ExperienceLevel type11.
  return int32_t(guest_call(&extra, 0x005a1c40u, 0x0b565041u, 0u));
}

void advance(X86 *c, uint32_t unit, int32_t target) {
  X86 extra = *c;
  if (extra.r[R_ESP] < STACK_LIMIT + 0x200) return;
  extra.r[R_ESP] -= 0x100;
  const uint32_t text = extra.r[R_ESP] + 0x80, script = extra.r[R_ESP] + 0x90;
  for (uint32_t off = 0x80; off < 0xd0; off += 4) wr32(extra.r[R_ESP] + off, 0);
  // Reproduce the original GROW UP script invocation00495d7c..00495dfa.
  // advance_to_level increments levels and HP/stats; it doesn't spawn effects.
  extra.r[R_ECX] = text; guest_call(&extra, 0x004e3520u, 0x006c0d88u);
  extra.r[R_ECX] = script; guest_call(&extra, 0x00629910u, text);
  extra.r[R_ECX] = text; guest_call(&extra, 0x004e3820u);
  extra.r[R_ECX] = script; guest_call(&extra, 0x00629bf0u);
  extra.r[R_ECX] = script; guest_call(&extra, 0x00629a20u, unit);
  extra.r[R_ECX] = script; guest_call(&extra, 0x00629a40u, uint32_t(target));
  extra.r[R_ECX] = script; guest_call(&extra, 0x00629c40u);
  extra.r[R_ECX] = script; guest_call(&extra, 0x006299b0u);
}

// Original actor creation returns the initialized unit in EAX. Record only its
// ID; hero_birth must finish before the frame boundary applies the final stats.
void spawned(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
  mods_call_next(api, inv, cpu);
  if (!active.levels) return;
  const uint32_t unit = cpu->eax;
  if (!unit || !gm_valid(unit, 0x88) || rd32(unit + 0x5c) != 1 ||
      rd32(unit + 0x70) != active.owner || !rd32(unit + 0x60)) return;
  const uint32_t id = rd32(unit + 0x60);
  for (const auto &p : active.pending) if (p.id == id) return;
  if (active.pending.size() >= 4096) { active.levels = false; return; }
  active.pending.push_back({id});
}

struct LevelOps {
  X86 cpu;
  explicit LevelOps(X86 *c) : cpu(*c) { cpu.r[R_ESP] -= 512; }
  uint32_t call(uint32_t fn, uint32_t self) {
    cpu.r[R_ECX] = self; return guest_call(&cpu, fn);
  }
  uint32_t attribute(uint32_t unit, uint32_t id) {
    cpu.r[R_ECX] = unit; return guest_call(&cpu, 0x005a1c40u, id, 0u);
  }
  void set(uint32_t unit, uint32_t id, int value) {
    cpu.r[R_ECX] = unit;
    guest_call(&cpu, rd32(rd32(unit) + 0x124), id, uint32_t(value));
  }
  uint32_t named(uint32_t agent, const char *name, uint32_t type, uint32_t slot) {
    const uint32_t text = cpu.r[R_ESP] + 128, ascii = text + 32;
    if (std::strlen(name) >= 64 || !gm_valid(text, 96)) return 0;
    for (unsigned i = 0; i <= std::strlen(name); ++i) wr8(ascii + i, name[i]);
    cpu.r[R_ECX] = text; guest_call(&cpu, 0x004e3520u, ascii);
    cpu.r[R_ECX] = agent;
    const uint32_t value = guest_call(&cpu, 0x006263d0u, text);
    cpu.r[R_ECX] = text; guest_call(&cpu, 0x004e3820u);
    if (!value || !gm_valid(value, 8) || rd32(value + 4) != type ||
        !gm_valid(rd32(value), slot + 4)) return 0;
    return call(rd32(rd32(value) + slot), value);
  }
  uint32_t agent(uint32_t unit, uint32_t runtime) {
    const auto id = attribute(unit, 0x4541u);
    if (!id) return 0;
    cpu.r[R_ECX] = runtime; return guest_call(&cpu, 0x006236b0u, id);
  }
};
// Core IDs come from original0041b940..0041e140 registrations. SetAttribute's
// unit virtual+124 is also used by the qualified native community adapter.
constexpr uint32_t vehicle_attr(unsigned index) { return 0x00565041u | (index << 24); }
enum class LevelResult { Skip, Applied, NotReady, Refused };
LevelResult instant_level(X86 *c, uint32_t factory, uint32_t id, uint32_t owner) {
  const auto refuse = [id](const char *why) {
    std::fprintf(stderr, "[cheats] Hero %u initialization refused: %s\n", id, why);
    return LevelResult::Refused;
  };
  LevelOps ops(c); ops.cpu.r[R_ECX] = factory;
  uint32_t unit = guest_call(&ops.cpu, 0x005a10d0u, id);
  if (!unit || !gm_valid(unit, 0x88) || rd32(unit + 0x84) != factory ||
      rd32(unit + 0x70) != owner || (rd32(unit + 0x64) & 4u)) return LevelResult::Skip;
  if (!guest_call(&ops.cpu, 0x004c8ea0u, unit)) return LevelResult::Skip;
  const auto current = int32_t(ops.attribute(unit, vehicle_attr(11)));
  if (current >= hero_level || int32_t(ops.attribute(unit, 0x00555041u)) <= 0)
    return LevelResult::Skip;
  if (current < 1) return LevelResult::NotReady;
  const auto runtime = ops.call(0x00623b20u, 0);
  if (!runtime || !gm_valid(runtime, 0x28)) return refuse("GPL runtime");
  uint32_t agent = ops.agent(unit, runtime);
  if (!agent) return LevelResult::NotReady;
  std::array<char, 64> title{};
  if (!phrase(ops.named(agent, "title", 3, 0x30), title)) return LevelResult::NotReady;
  // Only the expansion's one-time Gnome transformation needs interpreted work.
  // Finish at most seven low-level steps; the remaining jump is one bulk commit.
  if (std::string_view(title.data()) == "gnome" && current < 8) {
    advance(c, unit, 8);
    if (rd32(0x0071c68c) != active.world) return refuse("world changed");
    ops.cpu.r[R_ECX] = factory; unit = guest_call(&ops.cpu, 0x005a10d0u, id);
    if (!unit || !gm_valid(unit, 0x88) || rd32(unit + 0x84) != factory ||
        rd32(unit + 0x70) != owner) return refuse("Gnome identity changed");
    agent = ops.agent(unit, runtime);
    if (!agent) return refuse("Gnome script agent");
  }
  const auto primary = ops.named(agent, "PrimaryStat", 1, 0x28);
  const auto attack = ops.named(agent, "attacktype", 1, 0x28);
  if (!primary || !attack || !gm_valid(primary, 4) || !gm_valid(attack, 4)) return refuse("hero stat declarations");
  const auto primaryId = rd32(primary);
  if ((primaryId & 0xffffffu) != 0x565041u || (primaryId >> 24) > 4)
    return refuse("primary stat ID");
  const auto rangeFlag = ops.named(agent, "rangeIncrease", 6, 0x2c);
  const auto criticalFlag = ops.named(agent, "criticalIncrease", 6, 0x2c);
  const bool criticalIncrease = criticalFlag && gm_valid(criticalFlag, 1) && rd8(criticalFlag);
  const auto critical = criticalIncrease ? ops.named(agent, "critical_chance", 1, 0x28) : 0;
  const bool healer = std::string_view(title.data()) == "healer";
  const auto reborn = healer ? ops.named(agent, "Reborn_Counter", 1, 0x28) : 0;
  if ((criticalIncrease && !gm_valid(critical, 4)) || (healer && !gm_valid(reborn, 4)))
    return refuse("class counter declarations");
  MajestyInstantLevel::Input in;
  in.level = int32_t(ops.attribute(unit, vehicle_attr(11)));
  in.primary = primaryId >> 24;
  in.primaryValue = int32_t(ops.attribute(unit, primaryId));
  in.vitality = int32_t(ops.attribute(unit, vehicle_attr(3)));
  in.hp = int32_t(ops.attribute(unit, 0x00555041u));
  in.maxHp = int32_t(ops.attribute(unit, 0x01555041u));
  in.melee = int32_t(ops.attribute(unit, vehicle_attr(5)));
  in.ranged = int32_t(ops.attribute(unit, vehicle_attr(6)));
  in.parry = int32_t(ops.attribute(unit, vehicle_attr(7)));
  in.dodge = int32_t(ops.attribute(unit, vehicle_attr(9)));
  in.sight = int32_t(ops.attribute(unit, 0x03555041u));
  in.range = int32_t(ops.attribute(unit, vehicle_attr(14)));
  in.attackType = int32_t(rd32(attack));
  in.rangeIncrease = rangeFlag && gm_valid(rangeFlag, 1) && rd8(rangeFlag);
  in.criticalIncrease = criticalIncrease;
  in.critical = critical ? int32_t(rd32(critical)) : 0;
  in.healer = healer; in.reborn = reborn ? int32_t(rd32(reborn)) : 0;
  in.seed = rd32(runtime + 0x24);
  MajestyInstantLevel::Plan plan;
  if (!MajestyInstantLevel::prepare(in, plan)) return refuse("stat range or overflow");
  // Publish the PRNG state first, then a bounded number of ordinary property
  // changes. There are no intermediate level notifications or per-level GPL calls.
  wr32(runtime + 0x24, plan.seed);
  ops.set(unit, 0x01555041u, plan.maxHp); ops.set(unit, 0x00555041u, plan.hp);
  ops.set(unit, primaryId, plan.primaryValue);
  if (in.attackType == 1) ops.set(unit, vehicle_attr(5), plan.melee);
  if (in.attackType == 2) ops.set(unit, vehicle_attr(6), plan.ranged);
  ops.set(unit, vehicle_attr(7), plan.parry); ops.set(unit, vehicle_attr(9), plan.dodge);
  if (in.rangeIncrease) {
    ops.set(unit, 0x03555041u, plan.sight); ops.set(unit, vehicle_attr(14), plan.range);
  }
  if (critical) wr32(critical, uint32_t(plan.critical));
  if (reborn) wr32(reborn, uint32_t(plan.reborn));
  ops.set(unit, vehicle_attr(11), hero_level);
  return level(c, unit) == hero_level ? LevelResult::Applied : refuse("native level setter");
}

void heroes(X86 *c, uint32_t factory, uint32_t owner) {
  if (active.scan_heroes) {
    X86 extra = *c; extra.r[R_ECX] = factory;
    const uint32_t group = guest_call(&extra, 0x005a10b0u, 1u);
    if (!group || !gm_valid(group, 0x30) || rd32(group + 4) != 1) return;
    const uint32_t count = rd32(group + 0x18), begin = rd32(group + 0x10), end = rd32(group + 0x14);
    if (count > 4096 || !begin || !end || !gm_valid(begin, 4) || !gm_valid(end, 4)) return;
    uint32_t node = rd32(begin), stop = rd32(end), visited = 0;
    std::vector<PendingHero> found;
    while (node != stop) {
      if (visited++ >= count || !node || !gm_valid(node, 12)) return;
      const uint32_t unit = rd32(node + 8);
      if (!unit || !gm_valid(unit, 0x88) || rd32(unit + 0x84) != factory) return;
      if (rd32(unit + 0x70) == owner && !(rd32(unit + 0x64) & 4u) && rd32(unit + 0x60))
        found.push_back({rd32(unit + 0x60)});
      node = rd32(node);
    }
    if (visited != count) return;
    active.pending = std::move(found); active.scan_heroes = false;
  }
  if (active.pending.empty()) return;
  const auto started = os_monotonic_ns();
  unsigned applied = 0;
  auto pending = std::move(active.pending); active.pending.clear();
  for (auto row : pending) {
    const auto result = instant_level(c, factory, row.id, owner);
    if (rd32(0x0071c68c) != active.world || rd32(active.world + 4) != factory) {
      active = {}; return;
    }
    if (result == LevelResult::Refused || (result == LevelResult::NotReady && ++row.retries > 120)) {
      active.levels = false; active.pending.clear();
      std::fprintf(stderr, "[cheats] Instant hero initialization refused; leveling disabled\n");
      return;
    }
    if (result == LevelResult::NotReady) active.pending.push_back(row);
    if (result == LevelResult::Applied) ++applied;
  }
  if (applied) std::fprintf(stderr, "[cheats] Instant levels applied=%u pending=%zu us=%llu\n",
      applied, active.pending.size(), (unsigned long long)((os_monotonic_ns() - started) / 1000));
}

void observe_phase(uint32_t state) {
  if ((active.gold || active.levels) && state && gm_valid(state,8) &&
      rd32(state) != 3 && rd32(state) != 7) active = {};
}

void tick(X86 *c) {
  install();
  if (!active.gold && !active.levels) return;
  uint32_t world = 0, owner = 0;
  if (!context(world, owner, false) || active.world != world || active.owner != owner) {
    active = {}; return;
  }
  const uint32_t factory = rd32(world + 4);
  if (active.gold) refill_gold(c, factory, owner);
  // Leave a settled native pause untouched. Completed heroes need no scans.
  const uint32_t state = rd32(0x006d7670);
  if (active.levels && rd32(state) == 3 && !rd32(state + 4)) heroes(c, factory, owner);
}
} // namespace majesty_cheats
