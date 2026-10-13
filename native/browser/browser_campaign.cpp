// Opt-in Frontier Pact: shared objectives over the pinned engine's original
// freestyle scripts. This is game-thread code; party decisions use replicated
// guest state, never camera/UI time or host-side progress storage.
#include "campaign_objective.h"
#include "coop_checkpoint.h"
#include "coop_pause.h"
#include "coop_restore.h"
#include "runtime/native_seam.h"
#include "mods/mods_internal.h"
#include "platform/os.h"
#include "runtime/guest.h"
#include "runtime/memory.h"
#include "runtime/win32.h"
#include <array>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string_view>

extern "C" void fn_004918e0(X86 *);
extern "C" void fn_00423060(X86 *);
extern "C" void fn_00491900(X86 *);
extern "C" void fn_00482c50(X86 *);
extern "C" void majesty_browser_frontier_result(uint32_t, uint32_t);
extern "C" void majesty_browser_coop_resume_input(X86 *);

namespace {
// One outstanding transition pause per exact joined epoch. No travel history.
struct TransitionPause {
  uint64_t epoch = 0;
  uint32_t world = 0, owner = 0;
  bool requested = false, observed = false, save_attempted = false,
       proposal_attempted = false;
  int32_t dx = 0, dy = 0;
  uint32_t proposal_serial = 0;
  recomp_network_session_v1 roster{};
  majesty::CoopCheckpointIdentity identity;
  majesty::CoopCheckpointStore::Record checkpoint;
} transition_pause;
struct GuestPauseNotice {
  uint64_t epoch = 0;
  uint32_t world = 0, frame = 0, clock = 0, owner = 0;
  bool paused = false;
} guest_pause_notice;
bool settled = false;
bool started = false;
std::array<int32_t, 4> reported_gold{};
std::array<uint32_t, 4> reported_buildings{};
bool reported = false;
int chapter() {
  const char *mode = recomp_env("RULE_FRONTIER_CHAPTER");
  if (mode && std::strlen(mode) == 1 && *mode >= '1' && *mode <= '4')
    return *mode - '0';
  return 0;
}
struct Party {
  uint32_t registry = 0;
  std::array<uint32_t, 4> ids{};
  int count = 0;
};
Party party() {
  Party out;
  // 004ba7e0 owns the session manager. 00482c50 reads +0x344 to
  // distinguish network kingdoms from NPCs. Its first four entries are
  // the playable slots; 004bae00 initializes unused entries to -1.
  const uint32_t manager = rd32(0x006d87a0), world = rd32(0x0071c68c);
  if (!manager || !world || !gm_valid(manager, 0x4f8) || !gm_valid(world, 0x14))
    return out;
  out.registry = rd32(world + 0x10);
  if (!out.registry || !gm_valid(out.registry, 0x118))
    return {};
  for (uint32_t i = 0; i < 4; ++i)
    if (rd32(manager + 0x344 + i * 4) != 0xffffffffu)
      out.ids[out.count++] = i;
  return out;
}
void transition_pause_input(X86 *c) {
  const char *flag = recomp_env("RULE_COOP_TRANSITION_PAUSE");
  if (!flag || std::strcmp(flag, "v1"))
    return;
  auto &p = transition_pause;
  const uint64_t epoch = recomp_network_session_epoch();
  const uint32_t world = rd32(0x0071c68c);
  if (!epoch || (p.epoch && (p.epoch != epoch || p.world != world)))
    p = {};
  // Only the host requests/serializes a save. Guests still need to observe the
  // original acknowledged pause so their browser can offer a release link.
  auto &notice = guest_pause_notice;
  if (!epoch || notice.epoch != epoch || notice.world != world)
    notice = {epoch, world};
  recomp_network_session_v1 guest_connection{};
  majesty::CoopCheckpointIdentity guest_identity;
  majesty::CoopPauseBoundary guest_boundary;
  const bool guest_paused = !settled && world &&
      recomp_network_session_info(epoch, &guest_connection) &&
      !guest_connection.host &&
      majesty::coop_guest_pause_boundary(guest_connection, guest_boundary) &&
      majesty_browser_coop_current_identity(epoch, guest_identity);
  if (guest_paused && (!notice.paused || notice.frame != guest_boundary.frame ||
                       notice.clock != guest_boundary.clock || notice.owner != guest_boundary.owner)) {
    notice = {epoch, world, guest_boundary.frame, guest_boundary.clock, guest_boundary.owner, true};
    std::fprintf(stderr,
                 "[coop-transition] Guest paused epoch=%llu owner=%u frame=%u clock=%u\n",
                 static_cast<unsigned long long>(epoch), notice.owner, notice.frame, notice.clock);
  } else if (!guest_paused && notice.paused) {
    notice.paused = false;
    std::fprintf(stderr, "[coop-transition] Guest resumed epoch=%llu\n",
                 static_cast<unsigned long long>(epoch));
  }
  if (p.requested) {
    majesty::CoopPauseBoundary boundary;
    if (!p.observed && majesty::coop_pause_boundary(p.owner, boundary)) {
      p.observed = true;
      std::fprintf(
          stderr,
          "[coop-transition] Paused epoch=%llu owner=%u frame=%u clock=%u\n",
          static_cast<unsigned long long>(epoch), boundary.owner,
          boundary.frame, boundary.clock);
    }
    const char *save = recomp_env("RULE_COOP_CHECKPOINT");
    if (p.observed && !p.save_attempted && save && !std::strcmp(save, "v1")) {
      p.save_attempted =
          true; // A failed save cannot turn every UI frame into I/O.
      if (majesty_browser_coop_checkpoint(c, p.epoch, p.owner, p.identity,
                                          p.roster, p.checkpoint)) {
        std::fprintf(stderr,
                     "[coop-transition] Checkpoint epoch=%llu revision=%llu "
                     "frame=%u clock=%u bytes=%llu digest=%s\n",
                     static_cast<unsigned long long>(p.epoch),
                     static_cast<unsigned long long>(p.checkpoint.revision),
                     p.checkpoint.frame, p.checkpoint.clock,
                     static_cast<unsigned long long>(p.checkpoint.bytes),
                     p.checkpoint.digest.data());
      } else
        std::fprintf(stderr,
                     "[coop-transition] Checkpoint refused epoch=%llu\n",
                     static_cast<unsigned long long>(p.epoch));
    }
    if (p.observed &&
        p.checkpoint.status == majesty::CoopCheckpointStore::Status::valid &&
        !p.proposal_attempted && (p.dx || p.dy)) {
      p.proposal_attempted = true;
      if (!majesty_browser_coop_checkpoint_begin(c, p.epoch, p.owner, p.dx,
                                                 p.dy, p.identity, p.checkpoint,
                                                 p.roster, p.proposal_serial))
        std::fprintf(
            stderr,
            "[coop-transition] Proposal refused epoch=%llu direction=%d,%d\n",
            (unsigned long long)p.epoch, p.dx, p.dy);
    }
    const uint32_t state = rd32(0x006d7670);
    if (p.observed && state && gm_valid(state, 0x50) && rd32(state) == 3 &&
        !rd32(state + 4))
      p = {};
  }
  if (!majesty::coop_prepared_input(c))
    return;
  bool request = os_browser_take_action("coop-transition-pause");
  int32_t dx = 0, dy = 0;
  const char *load = recomp_env("RULE_COOP_SHARED_READ"),
             *checkpoint = recomp_env("RULE_COOP_CHECKPOINT");
  if (load && !std::strcmp(load, "v1") && checkpoint &&
      !std::strcmp(checkpoint, "v1")) {
    struct Direction {
      const char *action;
      int32_t x, y;
    };
    const std::array<Direction, 4> directions = {{{"coop-travel-west", -1, 0},
                                                  {"coop-travel-east", 1, 0},
                                                  {"coop-travel-north", 0, -1},
                                                  {"coop-travel-south", 0, 1}}};
    for (const auto &direction : directions)
      if (os_browser_take_action(direction.action) && !request) {
        request = true;
        dx = direction.x;
        dy = direction.y;
      }
  }
  if (!request)
    return;
  if (!epoch || p.requested || settled) {
    std::fprintf(stderr, "[coop-transition] Request refused stage=availability epoch=%llu pending=%u settled=%u\n",
                 (unsigned long long)epoch, unsigned(p.requested), unsigned(settled));
    return;
  }
  const Party roster = party();
  const uint32_t manager = rd32(0x006d8568);
  if (roster.count < 2 || !world || !manager || !gm_valid(manager, 0x2b0) ||
      !rd32(world + 4) || !gm_valid(rd32(world + 4), 4)) {
    std::fprintf(stderr, "[coop-transition] Request refused stage=world kingdoms=%u\n", unsigned(roster.count));
    return;
  }
  const uint32_t owner = rd32(manager + 0x8c);
  if (rd32(manager + 0x218) == 2) {
    std::fprintf(stderr, "[coop-transition] Request refused stage=readback epoch=%llu\n",
                 (unsigned long long)epoch);
    return;
  }
  recomp_network_session_v1 connection{};
  majesty::CoopCheckpointIdentity identity;
  const char *save = recomp_env("RULE_COOP_CHECKPOINT");
  if (save && !std::strcmp(save, "v1")) {
    majesty::CoopPlayerBinding binding;
    const bool identified = majesty_browser_coop_current_identity(epoch, identity);
    const bool connected = identified && recomp_network_session_info(epoch, &connection);
    const bool bound = connected && connection.host &&
                       connection.player_count == uint32_t(roster.count) &&
                       majesty::coop_player_binding(connection, binding);
    if (!bound) {
      std::fprintf(stderr, "[coop-transition] Request refused stage=identity identified=%u connected=%u host=%u players=%u kingdoms=%u\n",
                   unsigned(identified), unsigned(connected), connection.host,
                   connection.player_count, unsigned(roster.count));
      return;
    }
    // Refuse before pausing or serializing: restarting a fresh match under
    // an existing world name must never replace that world's saved kingdom.
    if (!majesty_browser_coop_checkpoint_capture_allowed(c, epoch)) {
      std::fprintf(stderr, "[coop-transition] Request refused stage=saved-world epoch=%llu\n",
                   (unsigned long long)epoch);
      return;
    }
  }
  if (majesty::enqueue_coop_pause(c, owner)) {
    p = {};
    p.epoch = epoch;
    p.world = world;
    p.owner = owner;
    p.requested = true;
    p.dx = dx;
    p.dy = dy;
    p.roster = connection;
    p.identity = identity;
    std::fprintf(stderr,
                 "[coop-transition] Pause requested epoch=%llu owner=%u\n",
                 static_cast<unsigned long long>(epoch), owner);
  } else {
    const uint32_t state = rd32(0x006d7670);
    const bool valid_state = state && gm_valid(state, 0x50);
    std::fprintf(stderr, "[coop-transition] Request refused stage=pause match-type=%u phase=%u pending=%u\n",
                 rd32(manager + 0x218), valid_state ? rd32(state) : 0xffffffffu,
                 valid_state ? rd32(state + 4) : 0xffffffffu);
  }
}

void ally(X86 *c, const Party &p) {
  if (p.count < 2)
    return;
  // 00423ca0 implements SetPlayerTeamNumber with 004c9f70 on
  // registry+0xf8, then refreshes each playable player's visibility.
  uint32_t team = 0;
  for (uint32_t i = 0; i < 8; ++i)
    if (rd32(p.registry + 0xf8 + i * 4) & (1u << p.ids[0])) {
      team = i;
      break;
    }
  bool changed = false;
  for (int i = 1; i < p.count; ++i)
    if (!(rd32(p.registry + 0xf8 + team * 4) & (1u << p.ids[i]))) {
      X86 extra = *c;
      extra.r[R_ECX] = p.registry + 0xf8;
      guest_call(&extra, 0x004c9f70, p.ids[i], team);
      changed = true;
    }
  if (changed)
    for (uint32_t i = 0; i < 4; ++i) {
      X86 extra = *c;
      extra.r[R_ECX] = p.registry;
      const uint32_t player =
          guest_call(&extra, rd32(rd32(p.registry) + 0x18), i);
      if (player) {
        extra.r[R_ECX] = player;
        guest_call(&extra, 0x0042d7e0);
      }
    }
}
int32_t gold(X86 *c, const Party &p, uint32_t id) {
  if (!p.registry || !gm_valid(p.registry, 4))
    return 0;
  X86 extra = *c;
  extra.r[R_ECX] = p.registry;
  const uint32_t player = guest_call(&extra, rd32(rd32(p.registry) + 0x18), id);
  if (!player || !gm_valid(player, 4))
    return 0;
  // GetPlayerData("gold"), 00421e40, uses player virtual +0x20
  // with attribute APP (0x00505041), not an assumed player-field offset.
  extra.r[R_ECX] = player;
  return int32_t(guest_call(&extra, rd32(rd32(player) + 0x20), 0x00505041));
}
// Original palace lookup0042ceb0 traverses group0's native object list.
// Use the same iterator/getter, with bounded traversal and no retained actors.
// Bit0: completed Warriors Guild; bit1: completed Temple to Dauros.
// Invalid native registry/iteration returns UINT32_MAX, never objective-ready.
struct BuildingScan {
  std::array<uint32_t, 4> masks{};
  uint32_t visited = 0;
  bool valid = false;
};
BuildingScan buildings_for_owners(X86 *c, uint32_t factory,
                                  const std::array<uint32_t, 4> &owners,
                                  int participants) {
  if (!c || participants < 1 || participants > 4 || !factory ||
      !gm_valid(factory, 0x88) || !rd32(factory + 0x84) ||
      !gm_valid(rd32(factory + 0x84), 12))
    return {};
  for (int i = 0; i < participants; ++i) {
    if (owners[i] >= 8)
      return {};
    for (int j = 0; j < i; ++j)
      if (owners[j] == owners[i])
        return {};
  }
  X86 extra = *c;
  extra.r[R_ECX] = rd32(factory + 0x84);
  const uint32_t group = guest_call(&extra, 0x005969a0u, 0u, 0u);
  if (!group || !gm_valid(group, 0x30) || rd32(group + 4))
    return {};
  const uint32_t count = rd32(group + 0x18), begin = rd32(group + 0x10),
                 end = rd32(group + 0x14);
  if (count > 4096 || !begin || !end || !gm_valid(begin, 4) ||
      !gm_valid(end, 4))
    return {};
  uint32_t node = rd32(begin), stop = rd32(end);
  BuildingScan out;
  while (node != stop) {
    if (out.visited++ >= count || !node || !gm_valid(node, 12))
      return {};
    const uint32_t unit = rd32(node + 8);
    if (!unit || !gm_valid(unit, 0x88) || rd32(unit + 0x84) != factory)
      return {};
    const uint32_t kind = rd32(unit + 0x6c) & 0xffffffu;
    const uint32_t bit = kind == 0x00564241u   ? 1u
                         : kind == 0x00504241u ? 2u
                                               : 0u;
    int member = -1;
    if (bit && !(rd32(unit + 0x64) & 4u))
      for (int i = 0; i < participants; ++i)
        if (rd32(unit + 0x70) == owners[i]) {
          member = i;
          break;
        }
    if (member >= 0) {
      extra.r[R_ECX] = unit;
      const int32_t hp =
          int32_t(guest_call(&extra, 0x005a1c40u, 0x00555041u, 0u));
      extra.r[R_ECX] = unit;
      // ATTRIB_FirstStageBuilt registered by00419dc0 as A/P/B with type byte1.
      const uint32_t completed =
          guest_call(&extra, 0x005a1c40u, 0x01425041u, 0u);
      if (hp > 0 && completed == 1)
        out.masks[member] |= bit;
    }
    node = rd32(node);
  }
  out.valid = out.visited == count;
  return out.valid ? out : BuildingScan{};
}
uint32_t buildings(X86 *c, uint32_t factory, uint32_t owner) {
  const auto result = buildings_for_owners(c, factory, {owner, 0, 0, 0}, 1);
  return result.valid ? result.masks[0] : UINT32_MAX;
}
majesty::CampaignObjective objective(X86 *c, const Party &p, int mode) {
  majesty::CampaignObjective out;
  out.chapter = mode;
  out.participants = p.count;
  out.owners = p.ids;
  if (mode == 4) {
    const BuildingScan scan =
        buildings_for_owners(c, p.registry, p.ids, p.count);
    out.buildings_readable = scan.valid;
    for (int i = 0; i < p.count; ++i)
      out.buildings[i] = scan.valid ? scan.masks[i] : UINT32_MAX;
  }
  for (int i = 0; i < p.count; ++i)
    out.gold[i] = gold(c, p, p.ids[i]);
  return out;
}
} // namespace

extern "C" void majesty_browser_campaign_condition(X86 *c) {
  fn_004918e0(c);
  const int mode = chapter();
  if (!mode)
    return;
  c->r[R_EAX] = mode == 1 ? 2 : 1; // original survival / gold script
}
extern "C" void majesty_browser_campaign_start(X86 *c) {
  // Only the GPL GetVictoryConditionIndex callback starts the mission.
  // The getter above is also used by menus, saves and birth scripts and
  // must never change team state or reset the settled outcome there.
  fn_00423060(c);
  const int mode = chapter();
  if (!mode)
    return;
  majesty_browser_coop_fresh_campaign();
  const Party p = party();
  ally(c, p);
  settled = false;
  started = p.count >= 2;
  reported = false;
  std::fprintf(stderr,
               "[campaign] Chapter %d started with %d network kingdoms\n", mode,
               p.count);
}
extern "C" void majesty_browser_campaign_input(X86 *c) {
  transition_pause_input(c);
  majesty_browser_coop_resume_input(c);
  if (!chapter() || !started || settled)
    return;
  if (!os_browser_take_action("frontier-surrender"))
    return;
  const Party p = party();
  const uint32_t state = rd32(0x006d7670);
  if (!state || !gm_valid(state, 0x50) || p.count < 2)
    return;
  const uint32_t local_player = rd32(state + 0x24);
  bool member = false;
  for (int i = 0; i < p.count; ++i)
    member = member || p.ids[i] == local_player;
  if (!member)
    return;
  // 00480e00 sends loss through 00496390(4, state+0x24). This creates
  // the original replicated message; 00496310 consumes it on every peer
  // and dispatches 00495b40 case 4. Never settle a local-only outcome here.
  X86 extra = *c;
  guest_call(&extra, 0x00496390, 4u, local_player);
  std::fprintf(stderr, "[campaign] Surrender requested by kingdom %u\n",
               local_player + 1);
}

#ifndef __EMSCRIPTEN__
// Read-only observation for the owned native action fixture. The production
// handler alone consumes the action and queues the original pause control.
extern "C" bool majesty_browser_native_coop_pause_requested(
    uint64_t epoch, uint32_t world, uint32_t owner) {
  const auto &p = transition_pause;
  return p.requested && p.epoch == epoch && p.world == world && p.owner == owner;
}
#endif
extern "C" void majesty_browser_campaign_resume(X86 *) {
  const int mode = chapter();
  const uint32_t world = rd32(0x0071c68c);
  // Loading preserves original GPL timers, gold and alliances, but does
  // not rerun GetVictoryConditionIndex (the fresh-quest start callback).
  // Re-arm only host-side campaign controls after original world attachment.
  if (!mode || !world || !gm_valid(world, 8) || !rd32(world + 4))
    return;
  const Party p = party();
  if (p.count < 2)
    return;
  settled = false;
  started = true;
  reported = false;
  std::fprintf(stderr,
               "[campaign] Chapter %d restored with %d network kingdoms\n",
               mode, p.count);
}
extern "C" void majesty_browser_campaign_modifier(X86 *c) {
  const bool script = rd32(c->r[R_ESP]) == 0x004230aau;
  fn_00491900(c);
  const int mode = chapter();
  if (!mode)
    return;
  if (mode == 1) {
    c->r[R_EAX] = 1; // one original game day; game script owns its timer
    return;
  }
  const Party p = party();
  const int32_t target = majesty::campaign_gold_target(mode);
  if (!script) {
    c->r[R_EAX] = target;
    return;
  }
  const auto current = objective(c, p, mode);
  const bool ready = majesty::campaign_objective_ready(current);
  const auto &treasuries = current.gold;
  const auto &structures = current.buildings;
  if (!reported || treasuries != reported_gold ||
      structures != reported_buildings) {
    reported = true;
    reported_gold = treasuries;
    reported_buildings = structures;
    std::fprintf(stderr, "[campaign] Chapter %d treasury progress:", mode);
    for (int i = 0; i < p.count; ++i) {
      std::fprintf(stderr, " kingdom %u %d/%d;", p.ids[i] + 1, treasuries[i],
                   target);
      if (mode == 4)
        std::fprintf(
            stderr, " guild=%u dauros=%u readable=%u;",
            unsigned(structures[i] != UINT32_MAX && (structures[i] & 1)),
            unsigned(structures[i] != UINT32_MAX && (structures[i] & 2) != 0),
            unsigned(structures[i] != UINT32_MAX));
    }
    std::fprintf(stderr, " %s\n", ready ? "objective met" : "gathering gold");
  }
  // The original script uses a strict greater-than comparison. Equality
  // with the actual richest treasury blocks it without an artificial
  // integer maximum overflowing the GPL numeric comparison path.
  int32_t richest = 0;
  if (!ready)
    for (uint32_t id = 0; id < 8; ++id) {
      const int32_t value = gold(c, p, id);
      if (value > richest)
        richest = value;
    }
  c->r[R_EAX] = ready ? 0 : uint32_t(richest);
  // Optional bounded evidence for the stock script's richest-player test.
  // Its victory branch also declares losses and stops its own timer, so
  // observing the modifier and the following result must remain separate.
  static unsigned gate_reports = 0;
  const char *debug = recomp_env("BROWSER_CAMPAIGN_DEBUG");
  if (debug && !std::strcmp(debug, "1") && gate_reports++ < 64)
    std::fprintf(stderr,
                 "[campaign-debug] Gold gate chapter=%d participants=%d "
                 "ready=%u threshold=%u clock=%u\n",
                 mode, p.count, unsigned(ready), c->r[R_EAX],
                 rd32(0x0071c6a8u));
}

// One owned solo input tests the same production building predicate. It never
// fabricates a multiplayer roster or declares a win, and restores all edits
// before another original tick can execute.
extern "C" void majesty_browser_campaign_building_fixture(X86 *c) {
#ifndef __EMSCRIPTEN__
  const char *flag = recomp_env("BROWSER_CAMPAIGN_BUILDING_FIXTURE");
  if (!flag)
    return;
  const char *raw = recomp_env("PROFILE_DIR");
  std::string_view path(raw ? raw : "");
  constexpr std::string_view suffix = "/frontier_0_0";
  const bool batch = !std::strcmp(flag, "batch-v1");
  const bool constructed = batch || !std::strcmp(flag, "constructed-v1");
  if ((!constructed && std::strcmp(flag, "v1")) || !path.ends_with(suffix) ||
      chapter() || recomp_env("BROWSER_STREAMING_PALACE_DEATH_FIXTURE"))
    std::abort();
  path.remove_suffix(suffix.size());
  const auto slash = path.rfind('/');
  if (!path.substr(slash == path.npos ? 0 : slash + 1)
           .starts_with(constructed
                            ? "actor-arrival-fixture-building-constructed-"
                            : "actor-arrival-fixture-building-objective-"))
    std::abort();
  static bool completed = false;
  if (completed)
    return;
  const uint32_t state = rd32(0x006d7670u), world = rd32(0x0071c68cu),
                 manager = rd32(0x006d8568u);
  if (!gm_valid(state, 0x50) || rd32(state) != 3 || !gm_valid(world, 0x14) ||
      !rd32(world + 4))
    return;
  if (!sched_holds_baton() || mods_hook_depth() || !gm_valid(manager, 0x21c) ||
      rd32(manager + 0x218) == 2 || c->r[R_ESP] < STACK_LIMIT + 65536 ||
      c->r[R_ESP] > STACK_TOP || !heap_check().empty())
    std::abort();
  const uint32_t factory = rd32(world + 0x10), clock = rd32(0x0071c6a8u),
                 hooks = mods_hooks_installed_count();
  X86 extra = *c;
  extra.r[R_ESP] -= 4096;
  const uint32_t before = buildings(&extra, factory, 0),
                 other = buildings(&extra, factory, 1);
  if (constructed) {
    // These IDs come from independently inspected ordinary UI saves. The
    // new building must be resolved through the original live factory.
    extra.r[R_ECX] = factory;
    const uint32_t fresh = guest_call(&extra, 0x005a10d0u, 521u);
    if (!fresh || !gm_valid(fresh, 0x88))
      std::abort();
    const uint32_t kind = rd32(fresh + 0x6c) & 0xffffffu;
    const bool guild = kind == 0x00564241u;
    if (!guild && kind != 0x00504241u)
      std::abort();
    const uint32_t original_id = guild ? 469u : 466u;
    extra.r[R_ECX] = factory;
    const uint32_t original = guest_call(&extra, 0x005a10d0u, original_id);
    if (!original || !gm_valid(original, 0x88) || before != 3 || other != 0)
      std::abort();
    for (const uint32_t unit : {original, fresh}) {
      if (rd32(unit + 0x70) || rd32(unit + 0x84) != factory ||
          (rd32(unit + 0x6c) & 0xffffffu) != kind || (rd32(unit + 0x64) & 4u))
        std::abort();
      extra.r[R_ECX] = unit;
      if (int32_t(guest_call(&extra, 0x005a1c40u, 0x00555041u, 0u)) <= 0)
        std::abort();
      extra.r[R_ECX] = unit;
      if (guest_call(&extra, 0x005a1c40u, 0x01425041u, 0u) != 1)
        std::abort();
    }
    std::fprintf(stderr,
                 "[campaign-fixture] Constructed baseline kind=%s unit=521 "
                 "original=%u owner=0 mask=%u other-owner=1 mask=%u clock=%u\n",
                 guild ? "guild" : "temple", original_id, before, other, clock);
    extra.r[R_ECX] = original;
    guest_call(&extra, 0x00431130u, 0x01425041u, 0u);
    const uint32_t old_unfinished = buildings(&extra, factory, 0);
    extra.r[R_ECX] = fresh;
    guest_call(&extra, 0x00431130u, 0x01425041u, 0u);
    const uint32_t both_unfinished = buildings(&extra, factory, 0);
    extra.r[R_ECX] = original;
    guest_call(&extra, 0x00431130u, 0x01425041u, 1u);
    const uint32_t old_restored = buildings(&extra, factory, 0);
    extra.r[R_ECX] = fresh;
    guest_call(&extra, 0x00431130u, 0x01425041u, 1u);
    const uint32_t new_restored = buildings(&extra, factory, 0);
    const bool intact = rd32(0x0071c6a8u) == clock &&
                        mods_hooks_installed_count() == hooks &&
                        heap_check().empty();
    std::fprintf(
        stderr,
        "[campaign-fixture] Constructed filters original-unfinished=%u "
        "both-unfinished=%u original-restored=%u new-restored=%u intact=%u\n",
        old_unfinished, both_unfinished, old_restored, new_restored,
        unsigned(intact));
    if (old_unfinished != 3 || both_unfinished != (guild ? 2u : 1u) ||
        old_restored != 3 || new_restored != 3 || !intact)
      std::abort();
    if (batch) {
      const auto forward =
          buildings_for_owners(&extra, factory, {0, 1, 2, 3}, 4);
      const auto reverse =
          buildings_for_owners(&extra, factory, {3, 2, 1, 0}, 4);
      bool matches =
          forward.valid && reverse.valid && forward.visited == reverse.visited;
      for (uint32_t i = 0; i < 4; ++i)
        matches = matches &&
                  forward.masks[i] == buildings(&extra, factory, i) &&
                  forward.masks[i] == reverse.masks[3 - i];
      const bool refused =
          !buildings_for_owners(&extra, factory, {0, 0, 2, 3}, 4).valid &&
          !buildings_for_owners(&extra, factory, {0, 1, 2, 8}, 4).valid &&
          !buildings_for_owners(&extra, factory, {0, 1, 2, 3}, 0).valid &&
          !buildings_for_owners(&extra, factory, {0, 1, 2, 3}, 5).valid &&
          !buildings_for_owners(&extra, 0, {0, 1, 2, 3}, 4).valid;
      if (!matches || !refused || rd32(0x0071c6a8u) != clock ||
          mods_hooks_installed_count() != hooks || !heap_check().empty())
        std::abort();
      std::fprintf(stderr,
                   "[campaign-fixture] Batch registry owners=4 visits=%u "
                   "masks=%u,%u,%u,%u reversed=%u,%u,%u,%u invalid-refused=1\n",
                   forward.visited, forward.masks[0], forward.masks[1],
                   forward.masks[2], forward.masks[3], reverse.masks[0],
                   reverse.masks[1], reverse.masks[2], reverse.masks[3]);
    }
    completed = true;
    std::fprintf(stderr,
                 "[campaign-fixture] Constructed predicate completed kind=%s "
                 "restored=1 owner-filter=1 result=pass\n",
                 guild ? "guild" : "temple");
    return;
  }
  std::fprintf(stderr,
               "[campaign-fixture] Building baseline owner=0 mask=%u "
               "other-owner=1 mask=%u clock=%u\n",
               before, other, clock);
  if (before != 3 || other != 0)
    std::abort();
  uint32_t ids[2] = {469u, 466u};
  for (uint32_t i = 0; i < 2; ++i) {
    extra.r[R_ECX] = factory;
    const uint32_t unit = guest_call(&extra, 0x005a10d0u, ids[i]);
    if (!gm_valid(unit, 0x88) || rd32(unit + 0x70) ||
        rd32(unit + 0x84) != factory ||
        (rd32(unit + 0x6c) & 0xffffffu) != (i ? 0x00504241u : 0x00564241u))
      std::abort();
    extra.r[R_ECX] = unit;
    if (guest_call(&extra, 0x005a1c40u, 0x01425041u, 0u) != 1)
      std::abort();
    extra.r[R_ECX] = unit;
    guest_call(&extra, 0x00431130u, 0x01425041u, 0u);
    const uint32_t unfinished = buildings(&extra, factory, 0);
    extra.r[R_ECX] = unit;
    guest_call(&extra, 0x00431130u, 0x01425041u, 1u);
    const uint32_t restored = buildings(&extra, factory, 0);
    std::fprintf(
        stderr,
        "[campaign-fixture] Building construction unit=%u unfinished-mask=%u "
        "restored-mask=%u original-setter=00431130\n",
        ids[i], unfinished, restored);
    if (unfinished != (i ? 1u : 2u) || restored != 3)
      std::abort();
  }
  const bool invalid_owner = buildings(&extra, factory, 8) == UINT32_MAX;
  const bool invalid_factory = buildings(&extra, 0, 0) == UINT32_MAX;
  const bool same_clock = rd32(0x0071c6a8u) == clock,
             same_hooks = mods_hooks_installed_count() == hooks;
  const bool clean_heap = heap_check().empty();
  if (!invalid_owner || !invalid_factory || !same_clock || !same_hooks ||
      !clean_heap) {
    std::fprintf(
        stderr,
        "[campaign-fixture] Building integrity refused invalid-owner=%u "
        "invalid-factory=%u clock-same=%u hooks-same=%u heap-clean=%u\n",
        unsigned(invalid_owner), unsigned(invalid_factory),
        unsigned(same_clock), unsigned(same_hooks), unsigned(clean_heap));
    std::abort();
  }
  completed = true;
  std::fprintf(stderr,
               "[campaign-fixture] Building objective completed restored=1 "
               "owner-filter=1 unfinished-filter=1 invalid-refused=1 "
               "clock-same=1 hooks-same=1 result=pass\n");
#else
  (void)c;
#endif
}
extern "C" void majesty_browser_campaign_result(X86 *c) {
  const uint32_t sp = c->r[R_ESP];
  // Observe the original local outcome before a queued browser checkpoint
  // can reach the next tick. The regional adapter excludes network worlds.
  if (gm_valid(sp, 20))
    majesty_browser_frontier_result(rd32(sp + 4), rd8(sp + 8));
  const int mode = chapter();
  if (!mode || !gm_valid(sp, 20)) {
    fn_00482c50(c);
    return;
  }
  const Party p = party();
  const uint32_t id = rd32(sp + 4), won = rd32(sp + 8) & 0xff;
  static unsigned result_reports = 0;
  const char *debug = recomp_env("BROWSER_CAMPAIGN_DEBUG");
  if (debug && !std::strcmp(debug, "1") && result_reports++ < 32)
    std::fprintf(stderr,
                 "[campaign-debug] Original result chapter=%d player=%u "
                 "won=%u participants=%d settled=%u caller=%08x clock=%u\n",
                 mode, id, won, p.count, unsigned(settled), rd32(sp),
                 rd32(0x0071c6a8u));
  // A script modifier is only a prior observation. Recheck replicated gold
  // and buildings at the actual result callback before sharing a win.
  if (mode >= 2 && won && !settled &&
      !majesty::campaign_objective_ready(objective(c, p, mode))) {
    c->eip = rd32(sp);
    c->r[R_ESP] = sp + 4;
    return;
  }
  bool member = false;
  for (int i = 0; i < p.count; ++i)
    member = member || p.ids[i] == id;
  if (p.count < 2) {
    fn_00482c50(c);
    return;
  }
  if (!member) {
    // Stock gold scripts inspect all palaces, including NPC kingdoms.
    // NPC outcomes cannot settle a cooperative objective or eliminate
    // its participants after the script selects a wealthy NPC palace.
    if (!won || settled) {
      c->eip = rd32(sp);
      c->r[R_ESP] = sp + 4;
      return;
    }
    wr32(sp + 4, p.ids[0]);
  }
  if (settled) {
    // A shared win supersedes the stock gold script's subsequent
    // multiple_loss calls. Match outcome is settled once per quest.
    c->eip = rd32(sp);
    c->r[R_ESP] = sp + 4;
    return;
  }
  settled = true;
  // The original result call may open a modal dialog before returning. Stop
  // browser actions now, but retain the final message below as the only
  // confirmation that original result fanout has completed.
  std::fprintf(stderr,
               "[campaign] Chapter %d shared result pending %s for %d kingdoms\n",
               mode, won ? "victory" : "defeat", p.count);
  const uint32_t x = rd32(sp + 12), y = rd32(sp + 16);
  const X86 base = *c;
  fn_00482c50(c);
  for (int i = 0; i < p.count; ++i)
    if (p.ids[i] != (member ? id : p.ids[0])) {
      X86 extra = base;
      // Call the original routine directly to avoid recursive fanout.
      const uint32_t args[4] = {p.ids[i], won, x, y};
      for (int a = 3; a >= 0; --a) {
        extra.r[R_ESP] -= 4;
        wr32(extra.r[R_ESP], args[a]);
      }
      extra.r[R_ESP] -= 4;
      wr32(extra.r[R_ESP], extra.eip);
      fn_00482c50(&extra);
    }
  std::fprintf(stderr, "[campaign] Chapter %d shared %s for %d kingdoms\n",
               mode, won ? "victory" : "defeat", p.count);
}
