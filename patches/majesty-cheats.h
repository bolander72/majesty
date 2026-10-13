// Game-thread cheats for the pinned MajestyHD - Old.exe. See docs/browser-cheats.md.
#pragma once
#include "mods/mods_internal.h"
#include "runtime/guest.h"
#include "runtime/native_seam.h"
#include "platform/os.h"
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
constexpr int32_t hero_level = 1000, levels_per_frame = 32;
struct State {
  uint32_t world = 0, owner = 0, last_hero = 0;
  bool gold = false, levels = false;
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
  if (active.world != world || active.owner != owner) active = {world, owner};
  bool &enabled = value == "infinite gold" ? active.gold : active.levels;
  // Use a temporary mod allocation only for the original TString setter.
  // No guest string, actor pointer or hook CPU survives this callback.
  uint32_t message = 0;
  const char *reply = value == "infinite gold"
      ? (enabled ? "Infinite gold disabled." : "Infinite gold enabled.")
      : (enabled ? "Automatic hero leveling disabled."
                 : "Heroes will advance to level 1000.");
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
  std::fprintf(stderr, "[cheats] %.*s %s owner=%u\n", int(value.size()), value.data(),
               enabled ? "enabled" : "disabled", owner);
  // Original00480e00 is thiscall(TString*), returns recognition in EAX, pops4.
  mods_hook_return(api, cpu, 1, 4);
}

void install() {
  static bool attempted = false;
  if (attempted) return;
  attempted = true;
  uint32_t hook = 0;
  if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00480e00u, 0, input,
       POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &hook) != POP_OK)
    std::fprintf(stderr, "[cheats] Native cheat input unavailable\n");
  else std::fprintf(stderr, "[cheats] Native cheat input installed\n");
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

void heroes(X86 *c, uint32_t factory, uint32_t owner) {
  X86 extra = *c; extra.r[R_ECX] = factory;
  // Original heal cheat00495ce4 visits native group1 through005a10b0.
  const uint32_t group = guest_call(&extra, 0x005a10b0u, 1u);
  if (!group || !gm_valid(group, 0x30) || rd32(group + 4) != 1) return;
  const uint32_t count = rd32(group + 0x18), begin = rd32(group + 0x10),
                 end = rd32(group + 0x14);
  if (count > 4096 || !begin || !end || !gm_valid(begin, 4) || !gm_valid(end, 4)) return;
  uint32_t node = rd32(begin), stop = rd32(end), visited = 0;
  uint32_t next = 0, next_id = UINT32_MAX, first = 0, first_id = UINT32_MAX;
  while (node != stop) {
    if (visited++ >= count || !node || !gm_valid(node, 12)) return;
    const uint32_t unit = rd32(node + 8);
    if (!unit || !gm_valid(unit, 0x88) || rd32(unit + 0x84) != factory) return;
    if (rd32(unit + 0x70) == owner && !(rd32(unit + 0x64) & 4u)) {
      const uint32_t id = rd32(unit + 0x60);
      if (id && id < first_id) { first = unit; first_id = id; }
      if (id > active.last_hero && id < next_id) { next = unit; next_id = id; }
    }
    node = rd32(node);
  }
  if (visited != count || (!next && !first)) return;
  if (!next) { next = first; next_id = first_id; }
  active.last_hero = next_id; // Scalar cursor; actors are reacquired each frame.
  extra.r[R_ECX] = next;
  const int32_t hp = int32_t(guest_call(&extra, 0x005a1c40u, 0x00555041u, 0u));
  const int32_t current = level(c, next);
  if (hp <= 0 || current < 1 || current >= hero_level ||
      !guest_call(&extra, 0x004c8ea0u, next)) return;
  advance(c, next, std::min(hero_level, current + levels_per_frame));
  // Progression can morph a gnome or run authored class scripts. Reacquire
  // the actor by its original ID before inspecting the result.
  if (rd32(0x0071c68c) != active.world || rd32(active.world + 4) != factory) {
    active = {}; return;
  }
  extra.r[R_ECX] = factory;
  const uint32_t fresh = guest_call(&extra, 0x005a10d0u, next_id);
  if (!fresh || !gm_valid(fresh, 0x88) || rd32(fresh + 0x84) != factory ||
      rd32(fresh + 0x70) != owner) return;
  const int32_t after = level(c, fresh);
  if (after <= current) {
    active.levels = false; // A mod that caps levels cannot spin every frame.
    std::fprintf(stderr, "[cheats] Hero advancement refused; leveling disabled\n");
  } else if (after >= hero_level)
    std::fprintf(stderr, "[cheats] Hero %u reached level %d\n", next_id, after);
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
  // Leave a settled native pause untouched. Batches bound interpreter work.
  const uint32_t state = rd32(0x006d7670);
  if (active.levels && rd32(state) == 3 && !rd32(state + 4)) heroes(c, factory, owner);
}
} // namespace majesty_cheats
