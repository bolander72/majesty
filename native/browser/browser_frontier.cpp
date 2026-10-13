// Checkpoint one bounded native Majesty world before leaving a Frontier region.
// The original serializer owns buildings, agents, GPL threads and map state.
#include "coop_checkpoint.h"
#include "coop_lobby_resume.h"
#include "coop_connected.h"
#include "coop_restore.h"
#include "coop_source_abort.h"
#include "coop_pause.h"
#include "mods/mods_internal.h"
#include "platform/os.h"
#include "runtime/checkpoint_store.h"
#include "runtime/guest.h"
#include "runtime/loader.h"
#include "runtime/memory.h"
#include "runtime/native_seam.h"
#include "runtime/win32.h"
#include <array>
#include <charconv>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <string_view>
#include <tuple>

extern "C" void fn_00417730(X86 *);
extern "C" void fn_00416c30(X86 *);
extern "C" void fn_00490fc0(X86 *);
extern "C" void fn_004aef20(X86 *);
extern "C" void fn_004b23d0(X86 *);
extern "C" void fn_00428d70(X86 *);
// Existing hook-call helper also accepts runtime-owned callbacks, whose API
// context is null. It uses the active callback's CPU and restores every register.
PopModStatus mods_guest_call(const PopModApi *, uint32_t, uint32_t,
                             const uint32_t *, uint32_t, uint32_t *);
extern "C" void majesty_browser_inventory_audit(X86 *);
extern "C" void majesty_browser_streaming_factory_fixture(X86 *);
extern "C" void majesty_browser_streaming_restore_fixture(X86 *);
extern "C" void majesty_browser_streaming_unit_fixture(X86 *);
extern "C" void majesty_browser_streaming_agent_fixture(X86 *);
extern "C" void majesty_browser_streaming_pair_fixture(X86 *);
extern "C" void majesty_browser_streaming_live_fixture(X86 *);
extern "C" void majesty_browser_streaming_arrival_fixture(X86 *);
extern "C" bool majesty_browser_streaming_departure_fixture(X86 *);
extern "C" void majesty_browser_streaming_departure_reload_fixture(X86 *);
extern "C" bool majesty_browser_streaming_live_tick(X86 *);
extern "C" bool majesty_browser_streaming_take_arrival_checkpoint();
extern "C" bool majesty_browser_streaming_session_outdoor_hero(X86 *);
extern "C" bool majesty_browser_streaming_selected_hero_ready(X86 *,const uint32_t *);
extern "C" bool majesty_browser_streaming_selected_hero_pose(X86 *,const uint32_t *,int32_t *,uint32_t *);
extern "C" bool majesty_browser_streaming_selected_hero_test_move(X86 *,const uint32_t *);
extern "C" bool majesty_browser_streaming_retire_selected_hero(X86 *,const uint32_t *,uint32_t);
extern "C" bool majesty_browser_streaming_hero_generation_ticks(const char *,const uint32_t *,uint32_t,uint32_t *);
extern "C" bool majesty_browser_streaming_hero_entry_bounds(X86 *,const uint32_t *,uint32_t,int32_t *);
extern "C" bool majesty_browser_streaming_hero_path_goals_fit(X86 *,const uint32_t *,int32_t,int32_t,int32_t *);
static bool joint_fixture_checkpoint(X86 *,const std::string &,const char *,const char *,const char *);
extern "C" uint32_t majesty_browser_streaming_register_hero_home(X86 *,const char *,uint32_t,uint32_t,uint32_t,bool);
extern "C" bool majesty_browser_streaming_import_hero_arrival(X86 *,const char *,uint32_t,uint32_t,uint32_t,uint32_t,uint32_t,uint32_t,uint32_t *);
extern "C" bool majesty_browser_streaming_activate_hero_arrival(X86 *,const uint32_t *,uint32_t,uint32_t);
extern "C" bool majesty_browser_streaming_probe_hero_collision(X86 *,const uint32_t *,uint32_t);
extern "C" bool majesty_browser_streaming_route_hero_home(X86 *,uint32_t,uint32_t);
extern "C" bool majesty_browser_streaming_active_hero_pose(X86 *,int32_t *,uint32_t *);
extern "C" bool majesty_browser_streaming_active_hero_binding(X86 *,const uint32_t *);
extern "C" void majesty_browser_streaming_end_hero_arrival();
extern "C" void majesty_browser_streaming_hero_arrival_lifecycle();
extern "C" void majesty_browser_streaming_joint_reload_fixture(X86 *);
extern "C" void majesty_browser_streaming_joint_motion_tick(X86 *);
extern "C" void majesty_browser_streaming_world_completed_tick(X86 *);
extern "C" bool majesty_browser_streaming_halo_hero_pose(X86 *,uint32_t,int32_t *,uint32_t *);
extern "C" bool majesty_browser_streaming_halo_session_actor_pose(X86 *,uint32_t,uint32_t,int32_t *,uint32_t *);
extern "C" bool majesty_browser_streaming_halo_session_actor_move(X86 *,uint32_t,uint32_t,uint32_t,uint32_t);
extern "C" bool majesty_browser_streaming_halo_saved_home_activate(X86 *,const uint32_t *);
extern "C" bool majesty_browser_streaming_halo_saved_home_after_tick(X86 *);
extern "C" bool majesty_browser_streaming_halo_saved_home_arrival(X86 *,const char *,uint32_t *);
extern "C" bool majesty_browser_streaming_halo_saved_arrival(X86 *,const char *,uint32_t,uint32_t,uint32_t,uint32_t,uint32_t,uint32_t,uint32_t *);
extern "C" bool majesty_browser_streaming_halo_session_retire(X86 *,uint32_t,uint32_t,uint32_t,uint32_t,const uint32_t *,uint32_t);
extern "C" uint32_t majesty_browser_streaming_halo_session_proxy(X86 *,const char *,uint32_t,uint32_t);
extern "C" bool majesty_browser_streaming_halo_session_arrival(X86 *,const char *,uint32_t,uint32_t,uint32_t,uint32_t,uint32_t,uint32_t *);
extern "C" bool majesty_browser_streaming_halo_session_activate(X86 *,const uint32_t *,uint32_t);
extern "C" bool majesty_browser_streaming_halo_saved_activate(X86 *,const uint32_t *);
extern "C" bool majesty_browser_streaming_halo_saved_route(X86 *,uint32_t,uint32_t);
extern "C" bool majesty_browser_streaming_halo_saved_activation_after_tick(X86 *);
extern "C" bool majesty_browser_streaming_halo_saved_retire(X86 *,uint32_t,uint32_t,uint32_t);
extern "C" bool majesty_browser_streaming_halo_session_activation_after_tick(X86 *);
extern "C" void majesty_browser_streaming_session_queue_observe(X86 *, uint64_t);
extern "C" void majesty_browser_streaming_palace_death_fixture(X86 *);
extern "C" void majesty_browser_streaming_world_idle(X86 *);
extern "C" bool majesty_browser_streaming_world_auto_load(X86 *);
extern "C" bool majesty_browser_streaming_world_initialization_exit(X86 *);
extern "C" bool majesty_browser_streaming_session_home_import_ready(X86 *, bool);
extern "C" void majesty_browser_streaming_transfer_reload(X86 *, bool, bool);
extern "C" void majesty_browser_streaming_arrival_persist_reload_fixture(X86 *);

namespace {
#ifndef __EMSCRIPTEN__
static void native_coop_begin_fresh_neighbor(X86 *);
static void native_coop_target_snapshot(X86 *);
static void native_coop_target_progress_snapshot(X86 *, bool = false);
static void native_coop_saved_return_snapshot(X86 *);
static void native_coop_later_target_snapshot(X86 *);
#endif
struct Region {
  bool enabled = false;
  int x = 0, y = 0;
  std::string key;
  std::string checkpoint;
  uint32_t seed = 0;
};
uint32_t region_seed(int x, int y) {
  uint32_t hash = (71201u ^ uint32_t(x)) * 0x045d9f3bu ^ uint32_t(y) * 0x27d4eb2du;
  hash ^= hash >> 16; hash *= 0x045d9f3bu; hash ^= hash >> 16;
  const uint32_t seed = hash & 0x7fffffffu;
  return seed ? seed : 1u;
}
Region &region() {
  static Region value = [] {
    Region out;
    const char *raw = recomp_env("RULE_FRONTIER_REGION");
    if (!raw)
      return out;
    const std::string key(raw);
    const size_t split = key.find('_');
    int x = 0, y = 0;
    if (split == std::string::npos || key.size() > 24)
      return out;
    const auto a = std::from_chars(key.data(), key.data() + split, x);
    const auto b =
        std::from_chars(key.data() + split + 1, key.data() + key.size(), y);
    if (a.ec != std::errc{} || b.ec != std::errc{} ||
        a.ptr != key.data() + split || b.ptr != key.data() + key.size() ||
        x < -1000000 || x > 1000000 || y < -1000000 || y > 1000000 ||
        key != std::to_string(x) + "_" + std::to_string(y))
      return out;
    // Save in the region's dedicated profile; never replace a personal save.
    const char *profile = recomp_env("PROFILE_DIR");
    const std::string suffix = "/frontier_" + key;
    if (!profile || !std::string(profile).ends_with(suffix))
      return out;
    // Solo regions cannot restore or checkpoint a cooperative campaign.
    // Mirror the browser's selectedRegion check here as native hosts and
    // manually composed startup settings can bypass that UI validation.
    if (recomp_env("RULE_FRONTIER_CHAPTER")) {
      std::fprintf(
          stderr, "[frontier] Region unavailable: cooperative chapters require "
                  "a shared checkpoint; solo region controls are disabled\n");
      return out;
    }
    out.enabled = true;
    out.x = x;
    out.y = y;
    out.key = key;
    out.checkpoint = "Frontier_" + key;
    // Frontier v1's fixed world seed and signed coordinates. Unsigned
    // arithmetic is intentional: match the atlas's 32-bit region hash.
    out.seed = region_seed(x, y);
    return out;
  }();
  return value;
}
bool announced = false;
bool finished = false;
bool saving = false;
bool network_blocked = false;
bool restore_attempted = false;
uint64_t last_poll = 0;

bool generation_debug() {
  const char *debug = recomp_env("BROWSER_FRONTIER_GENERATION_DEBUG");
  return debug && std::strcmp(debug, "1") == 0;
}

bool seeded_generation() {
  // Experimental until a fresh generated region reaches normal gameplay.
  // Keep ordinary Frontier startup unchanged during that qualification.
  const char *enabled = recomp_env("RULE_FRONTIER_SEEDED_GENERATION");
  return enabled && std::strcmp(enabled, "1") == 0;
}

// Versioned opt-in; old kingdoms and ordinary freestyle retain their geometry.
bool connected_terrain() {
  const char *enabled = recomp_env("RULE_FRONTIER_CONNECTED_TERRAIN");
  return enabled && std::strcmp(enabled, "v1") == 0;
}

// Native-only geometry experiment. A restore requires explicit, hash-bound
// halo metadata; a region key never establishes the layout of an old save.
bool halo_session_fixture();
bool selected_hero_generation_geometry();
bool halo_terrain_fixture() {
#ifdef __EMSCRIPTEN__
  return false;
#else
  static const bool value=[] {
    const char *flag=recomp_env("BROWSER_FRONTIER_HALO_TERRAIN");
    if(!flag)return false;
    const char *profile=recomp_env("PROFILE_DIR"),*restore=recomp_env("RULE_FRONTIER_RESTORE");
    const char *reload=recomp_env("BROWSER_FRONTIER_HALO_RELOAD");
    const std::string_view path(profile?profile:"");const auto &r=region();
    const std::string suffix="/frontier_"+r.key;
    if(std::strcmp(flag,"v1")||!r.enabled||!seeded_generation()||!connected_terrain()||
       !restore||(recomp_env("RULE_FRONTIER_SESSION")&&!halo_session_fixture())||recomp_env("RULE_FRONTIER_CHAPTER")||!path.ends_with(suffix))std::abort();
    if (reload) {
      if (std::strcmp(reload,"v1")||std::strcmp(restore,"1")||
          recomp_env("BROWSER_FRONTIER_HALO_AUTOGENERATE")||
          recomp_env("BROWSER_FRONTIER_HALO_SNAPSHOT")||
          recomp_env("BROWSER_FRONTIER_HALO_EVOLVED_SNAPSHOT"))std::abort();
    } else if(std::strcmp(restore,"0"))std::abort();
    const auto parent=path.substr(0,path.size()-suffix.size());const auto slash=parent.rfind('/');
    const auto owned=parent.substr(slash==parent.npos?0:slash+1);
    constexpr std::string_view prefix="actor-arrival-fixture-halo-world-";
    if((!owned.starts_with(prefix)||owned.size()<=prefix.size()||owned.size()>80)&&!halo_session_fixture())std::abort();
    return true;
  }();return value;
#endif
}
int64_t connected_origin(int32_t coordinate) {
  return (selected_hero_generation_geometry()||halo_terrain_fixture())?int64_t(coordinate)*124-2:int64_t(coordinate)*128;
}
bool connected_shared_vertex(uint32_t x,uint32_t y) {
  return (selected_hero_generation_geometry()||halo_terrain_fixture())?(x<=4||y<=4||x>=124||y>=124):(x==0||y==0||x==128||y==128);
}

// Globally addressed gentle terrain. A 16-cell lattice and integer bilinear
// interpolation give exact Q16 heights at every shared vertex, including
// negative region coordinates. No RNG calls or retained world catalogue.
int32_t connected_height(int64_t x, int64_t y) {
  return majesty::coop_connected_height(x, y);
}

bool coop_connected_enabled() {
  const char *flag = recomp_env("RULE_COOP_REGION_GENERATION");
  return flag && !std::strcmp(flag, "v1");
}

bool coop_fresh_enabled() {
  const char *flag = recomp_env("RULE_COOP_FRESH_GENERATION");
  return coop_connected_enabled() && flag && !std::strcmp(flag, "v1");
}
// A single synchronous original constructor/generator call owns this token.
// It cannot be borrowed by a menu, quest or another transition.
struct CoopFreshConstruction {
  uint64_t epoch = 0;
  uint32_t serial = 0, generator = 0, configuration = 0;
  bool constructor_pending = false, generation_pending = false;
  majesty::CoopTransition target;
  recomp_network_session_v1 party{};
  bool agreement() const {
    recomp_network_session_v1 now{};
    recomp_network_barrier_v1 barrier{};
    return epoch && serial && coop_fresh_enabled() &&
           recomp_network_session_info(epoch, &now) &&
           !std::memcmp(&now, &party, sizeof now) &&
           recomp_network_barrier_snapshot(epoch, &barrier) &&
           majesty::coop_committed_generate(barrier, party, serial, target);
  }
} coop_fresh_construction;

// Shared terrain generation owns one coordinate, not the solo region/profile
// controller. Its initial entry is the original network-freestyle startup.
// The exact provider roster and generator are held only for construction.
struct CoopGeneration {
  Region selected;
  uint64_t epoch = 0;
  uint32_t generator = 0, context = 0, release_hook = 0;
  recomp_network_session_v1 party{};
  static void release(const PopModApi *, pop_cpu_v1 *, PopHookInvocation *, void *);
} coop_generation;
void CoopGeneration::release(const PopModApi *api, pop_cpu_v1 *cpu,
                             PopHookInvocation *inv, void *) {
  // Retire before any allocation can be reused by a fixed quest or solo game.
  if (cpu->ecx && cpu->ecx == coop_generation.context) {
    const uint32_t hook = coop_generation.release_hook;
    coop_generation = {};
    coop_generation.release_hook = hook;
  }
  if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
}
std::string_view content_identity();
bool connected_region_enabled() {
  return coop_generation.selected.enabled ||
         (region().enabled && seeded_generation() && connected_terrain());
}
bool coop_generation_party_unchanged() {
  recomp_network_session_v1 party{};
  return coop_generation.epoch &&
         recomp_network_session_info(coop_generation.epoch, &party) &&
         !std::memcmp(&party, &coop_generation.party, sizeof party);
}
Region initial_coop_generation(X86 *c) {
  Region out;
  const char *flag = recomp_env("RULE_COOP_REGION_GENERATION");
  const char *chapter = recomp_env("RULE_FRONTIER_CHAPTER");
  if (!flag || std::strcmp(flag, "v1") || !chapter ||
      std::strlen(chapter) != 1 || *chapter < '1' || *chapter > '4') return out;
  const uint32_t sp = c->r[R_ESP], state = rd32(0x006d7670);
  const char *name = recomp_env("RULE_COOP_WORLD"),
             *coordinate = recomp_env("RULE_COOP_REGION"),
             *manifest = recomp_env("NETWORK_MANIFEST");
  majesty::CoopCheckpointIdentity identity;
  recomp_network_session_v1 party{};
  const uint64_t epoch = recomp_network_session_epoch();
  if (!gm_valid(sp, 12) || rd32(sp) != 0x004bbe2du ||
      !gm_valid(state, 0x50) || rd32(state) != 1 || rd32(state + 4) ||
      rd32(0x0071c68c) || !epoch || !sched_holds_baton() || mods_hook_depth() ||
      !majesty::coop_checkpoint_identity(name ? name : "", coordinate ? coordinate : "0_0",
          content_identity(), manifest ? manifest : "", loader_exe_sha256(), identity) ||
      !recomp_network_session_info(epoch, &party) || party.player_count < 2 ||
      party.player_count > 4 || !party.local_player || party.local_player == UINT32_MAX)
    return out;
  for (uint32_t i = 0; i < 4; ++i)
    if (i < party.player_count
          ? !party.players[i] || party.players[i] == UINT32_MAX ||
                (i && party.players[i-1] >= party.players[i])
          : party.players[i] != 0) return out;
  if (!std::binary_search(party.players, party.players + party.player_count,
                         party.local_player)) return out;
  out.enabled = true;
  out.x = identity.x; out.y = identity.y;
  out.key = std::to_string(out.x) + "_" + std::to_string(out.y);
  out.seed = region_seed(out.x, out.y);
  coop_generation.epoch = epoch;
  coop_generation.party = party;
  coop_generation.generator = c->r[R_ECX];
  coop_generation.selected = out;
  return out;
}

Region committed_coop_generation(X86 *c) {
  Region out;
  auto &token = coop_fresh_construction;
  const uint32_t sp = c->r[R_ESP], state = rd32(0x006d7670);
  if (!token.constructor_pending || !token.agreement() ||
      !gm_valid(sp, 12) || c->r[R_ECX] != token.generator ||
      rd32(sp + 4) != token.configuration ||
      !gm_valid(state, 0x50) || rd32(state) != 7 || rd32(state + 4) ||
      rd32(0x0071c68c)) return out;
  token.constructor_pending = false;
  out.enabled = true; out.x = token.target.target_x; out.y = token.target.target_y;
  out.key = std::to_string(out.x) + "_" + std::to_string(out.y);
  out.seed = region_seed(out.x, out.y);
  coop_generation.epoch = token.epoch;
  coop_generation.party = token.party;
  coop_generation.generator = token.generator;
  coop_generation.selected = out;
  return out;
}

// A shared vertex belongs to both regions. A local foundation edit must not
// move it independently of its dormant neighbour. Delegate to the original
// single-vertex writer with its existing height; the caller still performs
// the original terrain/actor notifications. Never repair occupied geometry.
struct ConnectedBoundaryPolicy {
  uint32_t terrain = 0, handle = 0, delta_handle = 0;
  uint32_t protected_writes = 0, protected_deltas = 0;
  uint32_t protected_clamps = 0;
  uint32_t clamp_store(uint32_t address, uint32_t requested) {
    if (!terrain || !connected_region_enabled())
      return requested;
    if (!gm_valid(terrain, 0x54) || rd32(terrain) != 0x0068b660u ||
        rd32(terrain + 0x38) != 129 || rd32(terrain + 0x3c) != 129)
      std::abort();
    const uint32_t vertices = rd32(terrain + 0x4c);
    if (!gm_valid(vertices, 129u * 129u * 24u)) std::abort();
    if (address < vertices || address - vertices >= 129u * 129u * 24u ||
        (address - vertices) % 24u) return requested;
    const uint32_t index = (address - vertices) / 24u, x = index % 129u, y = index / 129u;
    if (!connected_shared_vertex(x,y)) return requested;
    const uint32_t before = rd32(address);
    if (before != requested && protected_clamps != UINT32_MAX) ++protected_clamps;
    return before;
  }
#ifndef __EMSCRIPTEN__
  uint32_t clamp_trace_handle = 0, clamp_trace_reports = 0;
  static void trace_clamp(const PopModApi *api, pop_cpu_v1 *cpu,
                          PopHookInvocation *inv, void *user) {
    auto &p = *static_cast<ConnectedBoundaryPolicy *>(user);
    const uint32_t self = cpu->ecx, sp = cpu->esp;
    const bool observe = self && self == p.terrain && gm_valid(self, 0x54) &&
        rd32(self) == 0x0068b660u && rd32(self + 0x38) == 129 &&
        rd32(self + 0x3c) == 129 && gm_valid(sp, 24);
    if (!observe) {
      if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
      return;
    }
    const uint32_t vertices = rd32(self + 0x4c), caller = rd32(sp);
    if (!gm_valid(vertices, 129u * 129u * 24u)) std::abort();
    std::array<uint32_t, 512> before{};
    const auto point = [](uint32_t i) -> std::array<uint32_t, 2> {
      if (i < 129) return {i, 0};
      if (i < 258) return {i - 129, 128};
      if (i < 385) return {0, i - 257};
      return {128, i - 384};
    };
    for (uint32_t i = 0; i < before.size(); ++i) {
      const auto xy = point(i);
      before[i] = rd32(vertices + (xy[1] * 129 + xy[0]) * 24);
    }
    // Observe the complete original multi-vertex clamp without changing its
    // arguments, vertex writes, notifications or return value.
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
    if (p.terrain != self || !gm_valid(self, 0x54) ||
        rd32(self + 0x4c) != vertices || cpu->esp != sp + 24)
      std::abort();
    unsigned changed = 0;
    for (uint32_t i = 0; i < before.size(); ++i) {
      const auto xy = point(i);
      const uint32_t after = rd32(vertices + (xy[1] * 129 + xy[0]) * 24);
      if (after == before[i]) continue;
      ++changed;
      if (p.clamp_trace_reports < 8 && changed <= 8)
        std::fprintf(stderr, "[frontier-clamp-trace] region=%s writer=005fd160 caller=%08x x=%u y=%u before=%d after=%d\n",
            region().key.c_str(), caller, xy[0], xy[1], int32_t(before[i]), int32_t(after));
    }
    if (changed && p.clamp_trace_reports < 8) {
      ++p.clamp_trace_reports;
      std::fprintf(stderr, "[frontier-clamp-trace] region=%s writer=005fd160 changed=%u original-call=1 arguments-unchanged=1\n",
          region().key.c_str(), changed);
    }
  }
#endif
  static void write(const PopModApi *api, pop_cpu_v1 *cpu,
                    PopHookInvocation *inv, void *user) {
    auto &p = *static_cast<ConnectedBoundaryPolicy *>(user);
    const uint32_t sp = cpu->esp, self = cpu->ecx;
    // Synthetic calls at these two former MOV sites have no point arguments.
    // Their native adapter performs one guarded store and an ordinary RET0.
    if (gm_valid(sp, 4) && (rd32(sp) == 0x005fd2bcu || rd32(sp) == 0x005fd2c8u)) {
      if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
      return;
    }
    uint32_t requested = 0; bool protect = false;
    if (self == p.terrain && self && connected_region_enabled() &&
        gm_valid(self,0x54) && rd32(self) == 0x0068b660u &&
        rd32(self + 0x30) == 128 && rd32(self + 0x34) == 128 &&
        rd32(self + 0x38) == 129 && rd32(self + 0x3c) == 129 && gm_valid(sp,12)) {
      const uint32_t point = rd32(sp + 4), vertices = rd32(self + 0x4c);
      if (gm_valid(point,8) && gm_valid(vertices,129u * 129u * 24u)) {
        const uint32_t x = rd32(point), y = rd32(point + 4);
        if (x <= 128 && y <= 128 && connected_shared_vertex(x,y)) {
          const uint32_t old = rd32(vertices + (y * 129 + x) * 24);
          requested = rd32(sp + 8); protect = requested != old;
          if (protect) {
            if (point < sp + 12 && sp < point + 8) std::abort();
            wr32(sp + 8,old);
            if (p.protected_writes != UINT32_MAX) ++p.protected_writes;
          }
        }
      }
    }
    if (mods_call_next(api,inv,cpu) != POP_OK) std::abort();
    if (protect) {
      if (cpu->esp != sp + 12) std::abort();
      // Preserve the caller's stack bytes after the original RET 8, too.
      wr32(sp + 8,requested);
    }
  }
  static void delta(const PopModApi *api, pop_cpu_v1 *cpu,
                    PopHookInvocation *inv, void *user) {
    auto &p = *static_cast<ConnectedBoundaryPolicy *>(user);
    const uint32_t sp = cpu->esp, self = cpu->ecx;
    uint32_t requested = 0, vertex = 0, before = 0;
    if (self == p.terrain && self && connected_region_enabled() &&
        gm_valid(self,0x54) && rd32(self) == 0x0068b660u &&
        rd32(self + 0x30) == 128 && rd32(self + 0x34) == 128 &&
        rd32(self + 0x38) == 129 && rd32(self + 0x3c) == 129 && gm_valid(sp,16)) {
      const uint32_t point = rd32(sp + 4), coefficient = rd32(sp + 12), vertices = rd32(self + 0x4c);
      if (gm_valid(point,8) && gm_valid(coefficient,12) && gm_valid(vertices,129u * 129u * 24u)) {
        const uint32_t x = rd32(point), y = rd32(point + 4);
        if (x <= 128 && y <= 128 && connected_shared_vertex(x,y)) {
          requested = rd32(sp + 8);
          if (requested) {
            // A zero delta keeps the original writer's fixed-point conversion
            // and return value, with no post-write repair of occupied geometry.
            // Its divisor must remain a finite nonzero float after changing
            // the argument; reject aliasing or invalid original call data.
            const uint32_t divisor = rd32(coefficient + 8) & 0x7fffffffu;
            if (!divisor || divisor >= 0x7f800000u ||
                (point < sp + 12 && sp + 8 < point + 8) ||
                (coefficient < sp + 12 && sp + 8 < coefficient + 12)) std::abort();
            vertex = vertices + (y * 129 + x) * 24; before = rd32(vertex);
            wr32(sp + 8,0);
            if (p.protected_deltas != UINT32_MAX) ++p.protected_deltas;
          }
        }
      }
    }
    if (mods_call_next(api,inv,cpu) != POP_OK) std::abort();
    if (vertex) {
      if (cpu->esp != sp + 16 || rd32(vertex) != before) std::abort();
      wr32(sp + 8,requested);
    }
  }
  void bind(uint32_t world) {
    terrain = 0;
    if (!connected_region_enabled()) return;
    if (!gm_valid(world,0x8c)) std::abort();
    const uint32_t target = rd32(world + 0x80);
    if (!gm_valid(target,0x54) || rd32(target) != 0x0068b660u ||
        rd32(target + 0x30) != 128 || rd32(target + 0x34) != 128 ||
        rd32(target + 0x38) != 129 || rd32(target + 0x3c) != 129 ||
        rd32(rd32(target) + 0x20) != 0x005f1a40u) std::abort();
    if (!handle && mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00428d70u,0,write,
        POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,this,&handle) != POP_OK) std::abort();
    if (!delta_handle && mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005f1a40u,0,delta,
        POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,this,&delta_handle) != POP_OK) std::abort();
#ifndef __EMSCRIPTEN__
    const char *trace = recomp_env("BROWSER_FRONTIER_BOUNDARY_CLAMP_TRACE");
    const std::string profile = mods_overlay_profile_dir();
    if (trace && !std::strcmp(trace, "v1") &&
        profile.find("/actor-arrival-fixture-session-") != profile.npos &&
        profile.find("/native-world-restoration/frontier_") != profile.npos) {
      if (!clamp_trace_handle && mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005fd160u,0,trace_clamp,
          POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,this,&clamp_trace_handle) != POP_OK) std::abort();
      clamp_trace_reports = 0;
    }
#endif
    if (coop_generation.selected.enabled) {
      coop_generation.context = world;
      if (!coop_generation.release_hook &&
          mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x004913d0u, 0,
              CoopGeneration::release, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW,
              nullptr, &coop_generation.release_hook) != POP_OK) std::abort();
    }
    terrain = target;
  }
} connected_boundary_policy;

extern "C" void majesty_browser_connected_store(X86 *c) {
  const uint32_t sp = c->r[R_ESP];
  if (gm_valid(sp, 4)) {
    const uint32_t returned = rd32(sp);
    if (returned == 0x005fd2bcu || returned == 0x005fd2c8u) {
      // These two declared instruction rewrites replace MOV [ESI],EAX/ECX.
      // Emulate exactly that store, retaining all registers and integer flags.
      // Only an active shared-boundary height substitutes its existing value;
      // the original clamp continues its flag, queue and notification work.
      const uint32_t requested = c->r[returned == 0x005fd2bcu ? R_EAX : R_ECX];
      wr32(c->r[R_ESI], connected_boundary_policy.clamp_store(c->r[R_ESI], requested));
      c->eip = returned; c->r[R_ESP] = sp + 4; recomp_return(c);
      return;
    }
  }
  // Every real point-writer call keeps its original arguments and RET8 ABI.
  fn_00428d70(c);
}

bool empty_construction_registry(uint32_t world, bool derived = false) {
  const uint32_t registry = rd32(world + 0x84);
  if (!registry || !gm_valid(registry, 12))
    return false;
  const uint32_t count = rd32(registry + 8);
  if (count != (derived ? 17u : 1u)) return false;
  const uint32_t head = rd32(registry + 4);
  if (!head || !gm_valid(head, 12))
    return false;
  const uint32_t nil = rd32(0x006d8590u);
  if (!nil || !gm_valid(nil, 12)) return false;
  uint32_t node = rd32(head), previous = head;
  bool actor_group = false;
  for (uint32_t i = 0; i < count; ++i) {
    if (!node || node == head || !gm_valid(node, 12) || rd32(node + 4) != previous) return false;
    const uint32_t group = rd32(node + 8);
    if (!group || !gm_valid(group, 0x30)) return false;
    const bool actors = rd32(group + 4) == 3;
    if (actors) {
      // 004911c0 calls 0042c490, which replaces the base kind-3 group
      // with this derived group using the same list/tree constructor.
      if (actor_group || rd32(group) != (derived ? 0x0067fe1cu : 0x0068a3a4u)) return false;
      actor_group = true;
    } else if (!derived) return false;
    // Check every group, including the derived world metadata groups.
    // All use the original actor-ID lookup and must have empty list/tree
    // representations before geometry changes; a zero spatial grid alone
    // does not prove that the registered stores are empty.
    const uint32_t table = rd32(group);
    if (!table || !gm_valid(table, 0x2c) || rd32(table + 0x28) != 0x005ba8d0u ||
        rd32(group + 0xc) || rd32(group + 0x10) != group + 0xc ||
        rd32(group + 0x14) != group + 0xc || rd32(group + 0x18) || rd32(group + 0x2c)) return false;
    const uint32_t tree = rd32(group + 0x24);
    if (!tree || !gm_valid(tree, 12) || rd32(tree) != tree ||
        rd32(tree + 4) != nil || rd32(tree + 8) != tree) return false;
    previous = node; node = rd32(node);
  }
  return actor_group && node == head && rd32(head + 4) == previous;
}

// An incoming actor reserves one bounded rectangle in a genuinely new region.
// Original placement queries retain every existing collision; the extra occupied
// space asks placement searches to choose another position, and the original
// optional-scenery loop skips occupied tiles before constructing their actors.
// No actor, terrain, saved region or original collision flags are rewritten.
struct HeroEntryReservation {
  std::string target;
  std::array<int32_t,4> bounds{};
  uint32_t grid=0,factory=0,rectangle_hook=0,mask_hook=0,ground_hook=0,queries=0,rejected=0,ground_rejected=0;
#ifndef __EMSCRIPTEN__
  uint32_t ground_trace=0;
#endif
  bool overlaps(int64_t left,int64_t top,int64_t right,int64_t bottom) const {
    return left<bounds[2]&&bounds[0]<right&&top<bounds[3]&&bounds[1]<bottom;
  }
  bool arm(const Region &destination,const int32_t *source) {
    if(!target.empty()||grid||rectangle_hook||mask_hook||ground_hook)return false;
    const int32_t dx=(region().x-destination.x)*248,dy=(region().y-destination.y)*248;
    std::array<int32_t,4> next{source[0]+dx,source[1]+dy,source[2]+dx,source[3]+dy};
    if(next[0]<0||next[1]<0||next[2]>=256||next[3]>=256||next[0]>=next[2]||next[1]>=next[3]||
       next[2]-next[0]>32||next[3]-next[1]>32)return false;
    target=destination.key;bounds=next;queries=rejected=ground_rejected=0;
    std::fprintf(stderr,"[frontier] Hero entry reserved source=%s target=%s rectangle=%d,%d,%d,%d source-pointers=0 target-absent=1\n",
        region().key.c_str(),target.c_str(),bounds[0],bounds[1],bounds[2],bounds[3]);
    return true;
  }
  void clear() {
    for(uint32_t handle:{rectangle_hook,mask_hook,ground_hook})
      if(handle&&mods_hook_remove(MODS_OWNER_RUNTIME,handle)!=POP_OK)std::abort();
    target.clear();bounds={};grid=factory=rectangle_hook=mask_hook=ground_hook=queries=rejected=ground_rejected=0;
#ifndef __EMSCRIPTEN__
    ground_trace=0;
#endif
  }
  static void rectangle(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *opaque) {
    auto &p=*static_cast<HeroEntryReservation *>(opaque);const uint32_t sp=cpu->esp;
    const bool active=cpu->ecx==p.grid&&p.grid&&!p.target.empty()&&region().key==p.target;
    uint32_t unit=0,radius=0;int32_t x=0,y=0;
    if(active){if(!gm_valid(sp,28))std::abort();unit=rd32(sp+8);x=int32_t(rd32(sp+12));y=int32_t(rd32(sp+16));radius=rd32(sp+24);}
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(!active)return;
    if(cpu->esp!=sp+28||!gm_valid(p.grid,0x50)||rd32(p.grid+0x48)!=256||rd32(p.grid+0x4c)!=256)std::abort();
    if(p.queries!=UINT32_MAX)++p.queries;
    if(cpu->eax&255)return;
    int64_t left=x,top=y,right=x,bottom=y;
    if(unit){
      if(!gm_valid(unit,0x84))std::abort();const uint32_t desc=rd32(unit+0x80);
      if(!gm_valid(desc,0x18))std::abort();const uint32_t shape=rd32(desc+0x14);
      // The delegated formatter initializes this exact cached rectangle.
      if(!gm_valid(shape,0x40)||!(rd32(shape+0x3c)&4))std::abort();
      left+=int32_t(rd32(shape+0x14));top+=int32_t(rd32(shape+0x18));
      right+=int32_t(rd32(shape+0x1c));bottom+=int32_t(rd32(shape+0x20));
    }
    left-=radius;top-=radius;right+=radius;bottom+=radius;
    // A null actor and zero radius is an original point placement query.
    if(!unit&&!radius){++right;++bottom;}
    if(p.overlaps(left,top,right,bottom))p.block(cpu,sp,"rectangle");
  }
  static void masked(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *opaque) {
    auto &p=*static_cast<HeroEntryReservation *>(opaque);const uint32_t sp=cpu->esp;
    const bool active=cpu->ecx==p.grid&&p.grid&&!p.target.empty()&&region().key==p.target;
    uint32_t mask=0;int32_t x=0,y=0;
    if(active){if(!gm_valid(sp,28))std::abort();x=int32_t(rd32(sp+12));y=int32_t(rd32(sp+16));mask=rd32(sp+24);}
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(!active)return;
    if(cpu->esp!=sp+28)std::abort();if(p.queries!=UINT32_MAX)++p.queries;if(cpu->eax&255)return;
    if(!gm_valid(mask,24))std::abort();
    const int32_t width=int32_t(rd32(mask)),height=int32_t(rd32(mask+4));
    if(width<=0||height<=0)return;
    const int64_t left=int64_t(x)+int32_t(rd32(mask+12)),top=int64_t(y)+int32_t(rd32(mask+16));
    if(!p.overlaps(left,top,left+width,top+height))return;
    const uint32_t stride=rd32(mask+8),data=rd32(mask+20);
    if(stride<(uint64_t(width)+7)/8)std::abort();
    // At most the reserved 32x32 cells are inspected, regardless of mask size.
    for(int64_t cy=p.bounds[1];cy<p.bounds[3];++cy)for(int64_t cx=p.bounds[0];cx<p.bounds[2];++cx){
      if(cx<left||cy<top||cx>=left+width||cy>=top+height)continue;
      const uint64_t at=uint64_t(data)+uint64_t(cy-top)*stride+uint64_t(cx-left)/8;
      if(at>UINT32_MAX||!gm_valid(uint32_t(at),1))std::abort();
      if(rd8(uint32_t(at))&(1u<<(uint32_t(cx-left)%8))){p.block(cpu,sp,"mask");return;}
    }
  }
  void block(pop_cpu_v1 *cpu,uint32_t sp,const char *kind) {
    if(rejected!=UINT32_MAX)++rejected;
    if(rejected<=8)std::fprintf(stderr,"[frontier] Hero entry placement refused target=%s kind=%s caller=%08x original-clear=1 reserved-overlap=1 count=%u\n",
        target.c_str(),kind,rd32(sp),rejected);
    cpu->eax=(cpu->eax&~255u)|1u;
  }
  static void ground(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *opaque) {
    auto &p=*static_cast<HeroEntryReservation *>(opaque);const uint32_t sp=cpu->esp;
#ifndef __EMSCRIPTEN__
    if(cpu->ecx==p.factory&&p.factory&&region().key==p.target&&gm_valid(sp,52)&&
       rd32(sp+8)==0x32304755u&&p.ground_trace<4){
      ++p.ground_trace;
      std::fprintf(stderr,"[frontier] Hero entry ground factory trace target=%s caller=%08x outer=%08x kind=%u description=%08x position=%d,%d,%d flags=%08x\n",
          p.target.c_str(),rd32(sp),rd32(sp+48),rd32(sp+4),rd32(sp+8),int32_t(rd32(sp+20)),int32_t(rd32(sp+24)),int32_t(rd32(sp+28)),rd32(sp+36));
    }
#endif
    // The original terrain-object loop checks this factory's null result and
    // advances to the next tile. Other factories/callers keep their behavior.
    // At this inner RET36 call, the wrapper's outer return is at SP+48.
    if(cpu->ecx==p.factory&&p.factory&&region().key==p.target&&gm_valid(sp,52)&&
       rd32(sp)==0x005a14c2u&&rd32(sp+48)==0x004b20d3u&&rd32(sp+4)==2&&
       !rd32(sp+12)&&rd32(sp+16)==0x40u&&rd32(sp+32)==UINT32_MAX&&!rd32(sp+36)){
      const int32_t fixed_x=int32_t(rd32(sp+20)),fixed_y=int32_t(rd32(sp+24));
      // This tile branch supplies exact integer terrain coordinates through
      // the original vector conversion. Each terrain cell is two nav cells.
      if(fixed_x<0||fixed_y<0||fixed_x>=128*65536||fixed_y>=128*65536||fixed_x%32768||fixed_y%32768)std::abort();
      const uint32_t cache=rd32(0x0071c6c8u),key=rd32(sp+8),scratch=sp-96;
      if(sp<STACK_LIMIT+65536||!gm_valid(cache,0x10)||!gm_valid(scratch,32))std::abort();
      wr32(scratch,key);const uint32_t lookup[]={scratch};uint32_t node=0;
      if(mods_guest_call(api,0x004665f0u,cache+8,lookup,1,&node)!=POP_OK)std::abort();
      if(node!=rd32(cache+0xc)&&gm_valid(node,0x14)&&rd32(node+0xc)==key){
        const uint32_t descriptor=rd32(node+0x10);
        if(descriptor){if(!gm_valid(descriptor,0x18))std::abort();
          const uint32_t args[]={uint32_t(fixed_x/32768),uint32_t(fixed_y/32768),descriptor,scratch+8};
          if(mods_guest_call(api,0x005b85e0u,p.grid,args,4,nullptr)!=POP_OK)std::abort();
          int32_t left=int32_t(rd32(scratch+8)),top=int32_t(rd32(scratch+12)),
              right=int32_t(rd32(scratch+16)),bottom=int32_t(rd32(scratch+20));
          const uint32_t traits=rd32(descriptor+0x14);if(!gm_valid(traits,0x40))std::abort();
          // Use the same shared footprint initializer as original selector-0
          // placement/spatial insertion. Its mask can extend past the cached
          // rectangle used by rectangular search queries.
          if(!(rd32(traits+0x3c)&1)&&mods_guest_call(api,0x005ba390u,traits,nullptr,0,nullptr)!=POP_OK)std::abort();
          const uint32_t mask=rd32(traits+0x2c);
          if(mask){if(!gm_valid(mask,24)||rd32(mask)>256||rd32(mask+4)>256)std::abort();
            left=fixed_x/32768+int32_t(rd32(mask+12));top=fixed_y/32768+int32_t(rd32(mask+16));
            right=left+int32_t(rd32(mask));bottom=top+int32_t(rd32(mask+4));}
          if(left>right||top>bottom)std::abort();
          if(p.overlaps(left,top,right,bottom)){
            if(p.ground_rejected!=UINT32_MAX)++p.ground_rejected;
            if(p.ground_rejected<=8)std::fprintf(stderr,"[frontier] Hero entry ground placement refused target=%s description=%08x grid=%d,%d rectangle=%d,%d,%d,%d original-formatter=1 before-construction=1 original-null-branch=004b20d7 count=%u\n",
                p.target.c_str(),key,fixed_x/32768,fixed_y/32768,left,top,right,bottom,p.ground_rejected);
            if(mods_hook_return(api,cpu,0,36)!=POP_OK)std::abort();return;
          }
        }
      }
    }
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
  }
  void bind(uint32_t world_factory) {
    if(target.empty())return;
    if(target!=region().key||grid||rectangle_hook||mask_hook||ground_hook||!gm_valid(world_factory,0x8c))std::abort();
    factory=world_factory;
    grid=rd32(factory+0x88);
    if(!gm_valid(grid,0x50)||rd32(grid+0x48)!=256||rd32(grid+0x4c)!=256||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005b8bc0u,0,rectangle,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,this,&rectangle_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005b8d50u,0,masked,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,this,&mask_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005a1350u,0,ground,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,this,&ground_hook)!=POP_OK)std::abort();
    std::fprintf(stderr,"[frontier] Hero entry placement guard target=%s rectangle=%d,%d,%d,%d empty-stores=1 original-queries=1\n",
        target.c_str(),bounds[0],bounds[1],bounds[2],bounds[3]);
  }
  void finish(uint32_t clock) {
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(target!=region().key||!grid||!rectangle_hook||!mask_hook||!ground_hook||!gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||
       rd32(0x0071c6a8)!=clock||!gm_valid(world,0x14)||!gm_valid(rd32(world+0x10),0x8c)||rd32(rd32(world+0x10)+0x88)!=grid)std::abort();
    std::fprintf(stderr,"[frontier] Hero entry placement finished target=%s queries=%u rejected=%u ground-rejected=%u clock=%u phase=7 pending=0 original-arrival-collision-required=1\n",
        target.c_str(),queries,rejected,ground_rejected,clock);clear();
  }
} hero_entry_reservation;

struct ConnectedGeneration {
  const Region &r;
  uint32_t generator = 0, handle = 0, world = 0, terrain = 0, vertices = 0;
  uint32_t factory_handle = 0, players_handle = 0;
  unsigned captured = 0, applied = 0;
  bool refused = false, constructed = false;
#ifndef __EMSCRIPTEN__
  bool entry_ground_fixture = false;
#endif

  ConnectedGeneration(const Region &region, X86 &cpu)
      : r(region), generator(cpu.r[R_ECX]) {
#ifndef __EMSCRIPTEN__
    const char *test=recomp_env("BROWSER_FRONTIER_HERO_ENTRY_GROUND_TEST");
    if(test){
      // Reproduce the proven fourth entry in a new owned halo fixture. This
      // short case has no source hero, retirement, import or ownership claim.
      if(std::strcmp(test,"v1")||!halo_terrain_fixture()||r.key!="-1_-1"||
         !hero_entry_reservation.target.empty())std::abort();
      hero_entry_reservation.target=r.key;hero_entry_reservation.bounds={251,127,253,129};
      entry_ground_fixture=true;
      std::fprintf(stderr,"[frontier] Hero entry isolated ground fixture target=%s rectangle=251,127,253,129 source-hero=0 imported=0 owner-published=0\n",r.key.c_str());
    }
#endif
  }

  ~ConnectedGeneration() {
#ifndef __EMSCRIPTEN__
    if(entry_ground_fixture){
      std::fprintf(stderr,"[frontier] Hero entry isolated ground fixture finished target=%s queries=%u rejected=%u ground-rejected=%u no-hero-activation=1\n",
          r.key.c_str(),hero_entry_reservation.queries,hero_entry_reservation.rejected,hero_entry_reservation.ground_rejected);
      hero_entry_reservation.clear();
    }
#endif
    for (uint32_t id : {handle, factory_handle, players_handle})
      if (id && mods_hook_remove(MODS_OWNER_RUNTIME, id) != POP_OK)
        std::abort();
  }

  static void factory(const PopModApi *api, pop_cpu_v1 *cpu,
                            PopHookInvocation *inv, void *user) {
    auto &state = *static_cast<ConnectedGeneration *>(user);
    const bool exact = gm_valid(cpu->esp, 4) && rd32(cpu->esp) == 0x004b297eu;
    mods_call_next(api, inv, cpu);
    if (exact)
      state.constructed = state.captured == 1 && cpu->eax == state.world &&
                          gm_valid(state.world, 0x8c) && rd32(state.world) == 0x00682950u;
  }

  bool install_stages() {
    return mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00491c70u, 0, factory,
               POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, this, &factory_handle) == POP_OK &&
           mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x004b2160u, 0, players,
               POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, this, &players_handle) == POP_OK;
  }

  bool empty_grid() const {
    const uint32_t grid = rd32(world + 0x88);
    if (!grid || !gm_valid(grid, 0x50) || rd32(grid) != 0x0068a25cu ||
        rd32(grid + 0x48) != 256 || rd32(grid + 0x4c) != 256)
      return false;
    const uint32_t paths = rd32(grid + 0x14), actors = rd32(grid + 0x18);
    if (!paths || !actors || !gm_valid(paths, 256u * 256u * 4u) ||
        !gm_valid(actors, 256u * 256u * 4u))
      return false;
    for (uint32_t i = 0; i < 256u * 256u; ++i)
      if (rd32(paths + i * 4) || rd32(actors + i * 4))
        return false;
    return true;
  }

  static void players(const PopModApi *api, pop_cpu_v1 *cpu,
                      PopHookInvocation *inv, void *user) {
    auto &state = *static_cast<ConnectedGeneration *>(user);
    if (gm_valid(cpu->esp, 4) && rd32(cpu->esp) == 0x004b2a5cu &&
        cpu->ecx == state.generator) {
      const bool valid = !state.refused && state.constructed && !state.applied &&
          state.captured == 1 && gm_valid(state.generator, 0x88) &&
          rd32(state.generator + 0x84) == state.world && gm_valid(state.world, 0x8c) &&
          rd32(state.world + 0x80) == state.terrain && gm_valid(state.terrain, 0x54) &&
          rd32(state.terrain + 0x4c) == state.vertices &&
          rd32(state.terrain + 0x30) == 128 && rd32(state.terrain + 0x34) == 128 &&
          rd32(state.terrain + 0x38) == 129 && rd32(state.terrain + 0x3c) == 129 &&
          gm_valid(state.vertices, 129u * 129u * 24u) &&
          empty_construction_registry(state.world, true) && state.empty_grid() &&
          cpu->esp >= 1024 && gm_valid(cpu->esp - 1024, 1024);
      if (!valid) {
        std::fprintf(stderr, "[frontier] Region %s connected terrain pre-placement refused "
                             "captured=%u constructed=%u registry-empty=%u grid-empty=%u\n", state.r.key.c_str(),
                     state.captured, unsigned(state.constructed),
                     unsigned(state.world && gm_valid(state.world, 0x8c) && empty_construction_registry(state.world, true)),
                     unsigned(state.world && gm_valid(state.world, 0x8c) && state.empty_grid()));
        const uint32_t registry = state.world && gm_valid(state.world, 0x8c) ? rd32(state.world + 0x84) : 0;
        if (registry && gm_valid(registry, 12)) {
          const uint32_t count = rd32(registry + 8), head = rd32(registry + 4);
          std::fprintf(stderr, "[frontier] Pre-player registry groups=%u\n", count);
          uint32_t node = head && gm_valid(head, 12) ? rd32(head) : 0;
          for (uint32_t i = 0; i < count && i < 16 && node != head && gm_valid(node, 12); ++i) {
            const uint32_t group = rd32(node + 8);
            if (!group || !gm_valid(group, 0x30)) break;
            const uint32_t tree = rd32(group + 0x24), table = rd32(group);
            std::fprintf(stderr, "[frontier] Pre-player group kind=%08x table=%08x lookup=%08x "
                                 "list-count=%u tree-count=%u list-value=%08x list-self=%u "
                                 "tree-self=%u tree-nil=%u\n", rd32(group + 4), table,
                gm_valid(table, 0x2c) ? rd32(table + 0x28) : 0, rd32(group + 0x18), rd32(group + 0x2c),
                rd32(group + 0xc), unsigned(rd32(group + 0x10) == group + 0xc && rd32(group + 0x14) == group + 0xc),
                unsigned(tree && gm_valid(tree, 12) && rd32(tree) == tree && rd32(tree + 8) == tree),
                unsigned(tree && gm_valid(tree, 12) && rd32(tree + 4) == rd32(0x006d8590u)));
            node = rd32(node);
          }
        }
        std::abort();
      }
      // The original terrain GPL generator has finished. Only now replace
      // geometry, while both registered and spatial actor stores are empty.
      for (uint32_t y = 0; y <= 128; ++y)
        for (uint32_t x = 0; x <= 128; ++x)
          wr32(state.vertices + (y * 129 + x) * 24,
               uint32_t(connected_height(connected_origin(state.r.x) + x,
                                         connected_origin(state.r.y) + y)));
      ++state.applied;
      connected_boundary_policy.bind(state.world);
      hero_entry_reservation.bind(state.world);
#ifndef __EMSCRIPTEN__
      const char *probe = recomp_env("BROWSER_FRONTIER_SESSION_READY_SNAPSHOT_FIXTURE");
      if (probe && !std::strcmp(probe,"v1")) {
        // Exercise the actual original writer while every actor store is
        // still empty. Four sides and four corners must retain their heights;
        // an interior edit must work, then restore through that same writer.
        const uint32_t point = cpu->esp - 64, count = connected_boundary_policy.protected_writes;
        uint32_t checks = 0;
        for (const auto xy : std::array<std::array<uint32_t,2>,9>{{
             {31,0},{31,128},{0,31},{128,31},{0,0},{128,0},{0,128},{128,128},{31,31}}}) {
          const auto [x,y] = xy; const uint32_t vertex = state.vertices + (y * 129 + x) * 24;
          const uint32_t before = rd32(vertex), args[] = {point,before + 65536u};
          wr32(point,x); wr32(point + 4,y); uint32_t result = 0;
          if (mods_guest_call(nullptr,0x00428d70u,state.terrain,args,2,&result) != POP_OK ||
              result != (y * 129 + x) * 3) std::abort();
          const bool interior = x == 31 && y == 31;
          if (rd32(vertex) != before + (interior ? 65536u : 0u)) std::abort();
          if (interior) {
            const uint32_t restore[] = {point,before};
            if (mods_guest_call(nullptr,0x00428d70u,state.terrain,restore,2,nullptr) != POP_OK || rd32(vertex) != before) std::abort();
          }
          ++checks;
        }
        if (connected_boundary_policy.protected_writes - count != 8 ||
            !empty_construction_registry(state.world,true) || !state.empty_grid()) std::abort();
        std::fprintf(stderr,"[frontier] Connected boundary writer region=%s edge-controls=8 interior-controls=1 original-writer=00428d70 empty-stores=1 result=pass\n",state.r.key.c_str());
        // Exercise the second original writer through its actual terrain
        // virtual slot. A vertical coefficient of 1 gives a one-unit delta.
        const uint32_t coefficient = cpu->esp - 48;
        wr32(coefficient,0); wr32(coefficient + 4,0); wr32(coefficient + 8,0x3f800000u);
        const uint32_t delta_count = connected_boundary_policy.protected_deltas;
        for (const auto xy : std::array<std::array<uint32_t,2>,9>{{
             {32,0},{32,128},{0,32},{128,32},{0,0},{128,0},{0,128},{128,128},{32,32}}}) {
          const auto [x,y] = xy; const uint32_t vertex = state.vertices + (y * 129 + x) * 24;
          const uint32_t before = rd32(vertex), args[] = {point,1u,coefficient};
          wr32(point,x); wr32(point + 4,y); uint32_t result = 0;
          if (mods_guest_call(nullptr,rd32(rd32(state.terrain) + 0x20),state.terrain,args,3,&result) != POP_OK)
            std::abort();
          const bool interior = x == 32 && y == 32;
          const uint32_t expected = before - (interior ? 65536u : 0u);
          if (rd32(vertex) != expected || result != expected) std::abort();
          if (interior) {
            const uint32_t restore[] = {point,before};
            if (mods_guest_call(nullptr,0x00428d70u,state.terrain,restore,2,nullptr) != POP_OK || rd32(vertex) != before)
              std::abort();
          }
        }
        if (connected_boundary_policy.protected_deltas - delta_count != 8 ||
            !empty_construction_registry(state.world,true) || !state.empty_grid()) std::abort();
        std::fprintf(stderr,"[frontier] Connected boundary delta writer region=%s edge-controls=8 interior-controls=1 "
            "original-writer=005f1a40 virtual-slot=32 empty-stores=1 result=pass\n",state.r.key.c_str());
        const uint32_t clamp_count = connected_boundary_policy.protected_clamps;
        for (uint32_t returned : {0x005fd2bcu, 0x005fd2c8u}) {
          for (const auto xy : std::array<std::array<uint32_t,2>,9>{{
               {31,0},{31,128},{0,31},{128,31},{0,0},{128,0},{0,128},{128,128},{31,31}}}) {
            const auto [x,y] = xy;
            const uint32_t vertex = state.vertices + (y * 129 + x) * 24, before = rd32(vertex);
            X86 extra{};
            for (unsigned i = 0; i < 8; ++i) extra.r[i] = 0x10101010u + i;
            extra.r[R_ESI] = vertex; extra.r[R_ESP] = cpu->esp - 16384;
            extra.r[returned == 0x005fd2bcu ? R_EAX : R_ECX] = before + 65536u;
            extra.eflags_cf = 1; extra.eflags_zf = 0; extra.eflags_sf = 1;
            extra.eflags_of = 1; extra.eflags_pf = 0; extra.eflags_af = 1;
            const X86 saved = extra;
            wr32(extra.r[R_ESP], returned); majesty_browser_connected_store(&extra);
            for (unsigned i = 0; i < 8; ++i)
              if (extra.r[i] != saved.r[i] + (i == R_ESP ? 4u : 0u)) std::abort();
            if (extra.eip != returned || extra.eflags_cf != saved.eflags_cf ||
                extra.eflags_zf != saved.eflags_zf || extra.eflags_sf != saved.eflags_sf ||
                extra.eflags_of != saved.eflags_of || extra.eflags_pf != saved.eflags_pf ||
                extra.eflags_af != saved.eflags_af ||
                rd32(vertex) != before + (x == 31 && y == 31 ? 65536u : 0u)) std::abort();
            if (x == 31 && y == 31) {
              extra = saved; extra.r[returned == 0x005fd2bcu ? R_EAX : R_ECX] = before;
              wr32(extra.r[R_ESP], returned); majesty_browser_connected_store(&extra);
              if (rd32(vertex) != before) std::abort();
            }
          }
        }
        if (connected_boundary_policy.protected_clamps - clamp_count != 16 ||
            !empty_construction_registry(state.world,true) || !state.empty_grid()) std::abort();
        std::fprintf(stderr,"[frontier] Connected clamp stores region=%s edge-controls=16 interior-controls=2 registers-same=1 flags-same=1 empty-stores=1 result=pass\n",state.r.key.c_str());
      }
#endif
      // This original virtual target is callable but was not declared as a
      // hook entry. Use the active callback's checked scratch stack and
      // retain the original CPU/x87 state through the existing SDK helper.
      const uint32_t args[] = {state.world + 0x5c, 0};
      if (mods_guest_call(nullptr, 0x005aebe0u, state.terrain, args, 2, nullptr) != POP_OK ||
          !state.unchanged(state.world, "pre-placement"))
        std::abort();
      std::fprintf(stderr, "[frontier] Region %s connected terrain v1 installed "
                           "before players vertices=16641 empty-grid-cells=65536\n", state.r.key.c_str());
    }
    mods_call_next(api, inv, cpu);
  }

  static void initialize(const PopModApi *api, pop_cpu_v1 *cpu,
                       PopHookInvocation *inv, void *user) {
    auto &state = *static_cast<ConnectedGeneration *>(user);
    const uint32_t sp = cpu->esp;
    // 005bb300 is a declared complete method. Its immediate caller is the
    // original base constructor, before grid creation/world publication.
    // The original method binds the description and invokes the finalizer.
    if (gm_valid(sp, 8) && rd32(sp) == 0x005bb7feu) {
      const uint32_t world = cpu->ecx;
      const uint32_t terrain = world && gm_valid(world, 0x8c) ?
                               rd32(world + 0x80) : 0;
      bool valid = !state.captured && world && gm_valid(world, 0x8c) &&
                   rd32(world) == 0x0068a2ecu && !rd32(world + 0x88) &&
                   // Constructor ESI still holds its just-computed cell width.
                   cpu->esi == 128 &&
                   rd32(world + 0x80) == terrain && terrain &&
                   gm_valid(terrain, 0x54) && rd32(terrain) == 0x0068b660u &&
                   empty_construction_registry(world) && state.generator &&
                   gm_valid(state.generator, 0x88) &&
                   !rd32(state.generator + 0x84);
      uint32_t vertices = 0, cells = 0;
      if (valid) {
        vertices = rd32(terrain + 0x4c);
        cells = rd32(terrain + 0x48);
        valid = rd32(terrain + 0x30) == 128 && rd32(terrain + 0x34) == 128 &&
                rd32(terrain + 0x38) == 129 && rd32(terrain + 0x3c) == 129 &&
                vertices && cells && gm_valid(vertices, 129u * 129u * 24u) &&
                gm_valid(cells, 128u * 128u * 8u);
      }
      // Capture a genuinely fresh original allocation before any mutation.
      uint32_t nonzero_height = UINT32_MAX;
      if (valid)
        for (uint32_t i = 0; i < 129u * 129u; ++i)
          if (rd32(vertices + i * 24) != 0) {
            nonzero_height = i;
            valid = false;
            break;
          }
      if (valid) {
        state.world = world;
        state.terrain = terrain;
        state.vertices = vertices;
        ++state.captured;
        std::fprintf(stderr,
                     "[frontier] Region %s fresh terrain captured before grid creation\n", state.r.key.c_str());
      } else {
        state.refused = true;
        std::fprintf(stderr,
                     "[frontier] Region %s connected terrain construction refused\n",
                     state.r.key.c_str());
        const auto observed = [](uint32_t address) {
          return gm_valid(address, 4) ? rd32(address) : UINT32_MAX;
        };
        std::fprintf(stderr,
            "[frontier] Construction refusal captured=%u world-valid=%u "
            "world-table=%08x grid=%08x cell-width=%u terrain=%08x "
            "terrain-table=%08x cells=%u,%u vertices=%u,%u "
            "registry-empty=%u generator-valid=%u generator-world=%08x "
            "first-nonzero-height=%u\n",
            state.captured, unsigned(world && gm_valid(world, 0x8c)),
            observed(world), observed(world + 0x88), cpu->esi, terrain,
            observed(terrain), observed(terrain + 0x30), observed(terrain + 0x34),
            observed(terrain + 0x38), observed(terrain + 0x3c),
            unsigned(world && gm_valid(world, 0x8c) && empty_construction_registry(world)),
            unsigned(state.generator && gm_valid(state.generator, 0x88)),
            observed(state.generator + 0x84), nonzero_height);
      }
    }
    // Construction remains unchanged; the original terrain generator still
    // runs before the explicit pre-player geometry step above.
    mods_call_next(api, inv, cpu);
  }

  bool unchanged(uint32_t returned_world, const char *stage = "generation", bool borders_only = false) const {
    if (refused || applied != 1 || returned_world != world ||
        !gm_valid(world, 0x8c) || rd32(world + 0x80) != terrain ||
        !gm_valid(terrain, 0x54) || rd32(terrain + 0x4c) != vertices ||
        !gm_valid(vertices, 129u * 129u * 24u))
      {
        std::fprintf(stderr, "[frontier] Connected terrain result refused "
                             "applied=%u refused=%u same-world=%u\n",
                     applied, unsigned(refused), unsigned(returned_world == world));
        return false;
      }
    uint32_t changed = 0, changed_border = 0;
    uint32_t first_x = 0, first_y = 0, first_actual = 0, first_expected = 0;
    for (uint32_t y = 0; y <= 128; ++y)
      for (uint32_t x = 0; x <= 128; ++x)
        {
          const uint32_t actual = rd32(vertices + (y * 129 + x) * 24);
          const uint32_t expected = uint32_t(connected_height(
              connected_origin(r.x) + x, connected_origin(r.y) + y));
          if (actual != expected) {
            if (!changed) {
              first_x = x; first_y = y; first_actual = actual; first_expected = expected;
            }
            ++changed;
            if (connected_shared_vertex(x,y))
              ++changed_border;
          }
        }
    std::fprintf(stderr, "[frontier] Region %s connected terrain comparison stage=%s "
                         "changed=%u border-changed=%u first=(%u,%u) "
                         "actual=%d expected=%d\n", r.key.c_str(), stage, changed,
                 changed_border, first_x, first_y, int32_t(first_actual), int32_t(first_expected));
    // The original engine may shape interior foundations during placement.
    // Shared boundaries remain strict; occupied terrain is never corrected.
    return borders_only ? !changed_border : !changed;
  }
};

struct GenerationCall {
  uint32_t frame = 0, target = 0, block = 0, sequence = 0;
  bool returned = false;
  char name[96]{};
};
#ifndef __EMSCRIPTEN__
// Observe the gap between generator return and gameplay readiness. The owned
// restoration probe does not replace a terrain write or retain a world after
// attachment; its hook is removed before the first ordinary tick.
struct PendingBorderProbe {
  uint32_t world = 0, terrain = 0, vertices = 0, handle = 0;
  uint32_t watched = 0;
  unsigned events = 0;
  static void write(const PopModApi *api, pop_cpu_v1 *cpu,
                    PopHookInvocation *inv, void *user) {
    auto &p = *static_cast<PendingBorderProbe *>(user);
    const uint32_t sp = cpu->esp;
    uint32_t x = UINT32_MAX, y = UINT32_MAX, before = 0, requested = 0, caller = 0;
    if (cpu->ecx == p.terrain && gm_valid(sp, 12)) {
      const uint32_t point = rd32(sp + 4);
      if (gm_valid(point, 8)) {
        x = rd32(point); y = rd32(point + 4);
        if (x <= 128 && y <= 128 && (x == 0 || y == 0 || x == 128 || y == 128)) {
          if (!gm_valid(p.vertices, 129u * 129u * 24u) || ++p.events > 64) std::abort();
          before = rd32(p.vertices + (y * 129 + x) * 24);
          requested = rd32(sp + 8); caller = rd32(sp);
        } else x = UINT32_MAX;
      }
    }
    mods_call_next(api, inv, cpu);
    if (x != UINT32_MAX) {
      const uint32_t phase = rd32(0x006d7670);
      std::fprintf(stderr,"[frontier] Initialization border write region=%s caller=%08x vertex=%u,%u before=%d requested=%d after=%d phase=%u clock=%u\n",
          region().key.c_str(),caller,x,y,int32_t(before),int32_t(requested),
          int32_t(rd32(p.vertices + (y * 129 + x) * 24)),
          phase && gm_valid(phase,4) ? rd32(phase) : UINT32_MAX,rd32(0x0071c6a8));
    }
  }
} pending_border_probe;
#endif
GenerationCall generation_calls[64];
uint32_t generation_call_count = 0;

void trace_generation_dispatch(const PopModApi *api, pop_cpu_v1 *cpu,
                               PopHookInvocation *inv, void *) {
  // 006381b0's receiver starts with the original +0/+4/+8 string, followed
  // by block +0xc, extra +0x10 and target +0x14 (006381f0/006381b0).
  const uint32_t self = cpu->ecx, sp = cpu->esp;
  const uint32_t sequence = generation_call_count++;
  GenerationCall &call = generation_calls[sequence % 64];
  call = {};
  call.frame = sp;
  call.sequence = sequence;
  if (self && gm_valid(self, 0x18) && gm_valid(sp, 8)) {
    call.target = rd32(self + 0x14);
    call.block = rd32(self + 0xc);
    const uint32_t text = rd32(self), length = rd32(self + 8);
    if (text && length < sizeof call.name && gm_valid(text, length)) {
      for (uint32_t i = 0; i < length; ++i) {
        const uint8_t ch = rd8(text + i);
        call.name[i] = ch >= 32 && ch < 127 ? char(ch) : '?';
      }
    }
  }
  mods_call_next(api, inv, cpu);
  // Nested calls can cycle the ring. Update only this still-owned slot.
  if (call.sequence == sequence)
    call.returned = true;
}

void report_generation_calls() {
  const uint32_t count = generation_call_count;
  for (uint32_t i = count > 16 ? count - 16 : 0; i < count; ++i) {
    const GenerationCall &call = generation_calls[i % 64];
    std::fprintf(stderr,
                 "[frontier] GPL call name=%s target=%08x block=%08x "
                 "frame=%08x returned=%u\n",
                 call.name, call.target, call.block, call.frame,
                 unsigned(call.returned));
  }
}

// Preserve the original invalid-list exception, but capture its callers
// before C++ exception construction removes the useful interpreter frames.
void trace_generation_list(const PopModApi *api, pop_cpu_v1 *cpu,
                           PopHookInvocation *inv, void *) {
  static unsigned reports = 0;
  if (reports++ < 16) {
    const std::string type = win32_describe_pointer(cpu->ecx);
    std::fprintf(stderr,
                 "[frontier] Invalid list caller=%08x value=%08x type=%s "
                 "stack=%08x returns:",
                 gm_valid(cpu->esp, 4) ? rd32(cpu->esp) : 0, cpu->ecx,
                 type.c_str(), cpu->esp);
    for (uint32_t caller : win32_stack_return_candidates(
             cpu->esp, 0x400, loader_image_base(), loader_image_limit(), 16))
      std::fprintf(stderr, " %08x", caller);
    std::fprintf(stderr, "\n");
    report_generation_calls();
    // Exact frames audited in the pinned PE: 00639a30 reserves 24 bytes;
    // its virtual AsList call adds 4. The caller 00639bb0 reserves 64
    // bytes and pushes one source argument. Verify both return PCs before
    // reading its instruction argument. Stack candidates alone are not
    // proof of ancestry, and inferred block entries are not hookable.
    if (gm_valid(cpu->esp, 0x70) && rd32(cpu->esp) == 0x00639a9du &&
        rd32(cpu->esp + 0x1c) == 0x00639bf2u) {
      const uint32_t instruction = rd32(cpu->esp + 0x68);
      if (instruction && gm_valid(instruction, 36)) {
        std::fprintf(stderr,
                     "[frontier] Failed list assignment instruction=%08x "
                     "operation=%u words:",
                     instruction, rd32(cpu->esp + 0x6c));
        for (unsigned word = 0; word < 9; ++word)
          std::fprintf(stderr, " %08x", rd32(instruction + word * 4));
        std::fprintf(stderr, "\n");
        const uint32_t frame = mods_hook_ancestor_stack(0x0061e4c0u);
        if (frame && gm_valid(frame, 12)) {
          const uint32_t context = rd32(frame + 4), block = rd32(frame + 8);
          if (block && gm_valid(block, 12)) {
            const uint32_t start = rd32(block + 4), count = rd32(block + 8);
            if (count && count <= 65536 && start &&
                gm_valid(start, count * 36) && instruction >= start &&
                (instruction - start) % 36 == 0 &&
                (instruction - start) / 36 < count) {
              const uint32_t index = (instruction - start) / 36;
              std::fprintf(stderr,
                           "[frontier] GPL block=%08x context=%08x "
                           "instruction=%u/%u\n",
                           block, context, index, count);
              // Capture only a small preceding window, never a full script
              // or an unbounded interpreter history.
              for (uint32_t i = index > 10 ? index - 10 : 0; i <= index; ++i) {
                const uint32_t at = start + i * 36;
                std::fprintf(stderr, "[frontier] GPL instruction %u:", i);
                for (unsigned word = 0; word < 9; ++word)
                  std::fprintf(stderr, " %08x", rd32(at + word * 4));
                std::fprintf(stderr, "\n");
              }
            }
          }
        }
      }
    }
  }
  mods_call_next(api, inv, cpu);
}

void trace_generation_interpreter(const PopModApi *api, pop_cpu_v1 *cpu,
                                  PopHookInvocation *inv, void *) {
  // The existing hook registry keeps unwind-aware ancestor stacks. It owns
  // this frame even if the original interpreter throws or longjmps.
  mods_call_next(api, inv, cpu);
}

void install_generation_trace() {
  static bool attempted = false;
  if (attempted)
    return;
  attempted = true;
  uint32_t id = 0, interpreter_id = 0, dispatch_id = 0;
  if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00624970u, 0,
                           trace_generation_list, POP_HOOK_WRAP,
                           POP_HOOK_NO_GAME_VIEW, nullptr, &id) != POP_OK)
    std::fprintf(stderr, "[frontier] Invalid-list observation unavailable\n");
  if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x0061e4c0u, 0,
                           trace_generation_interpreter, POP_HOOK_WRAP,
                           POP_HOOK_NO_GAME_VIEW, nullptr,
                           &interpreter_id) != POP_OK)
    std::fprintf(stderr, "[frontier] Interpreter observation unavailable\n");
  if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x006381b0u, 0,
                           trace_generation_dispatch, POP_HOOK_WRAP,
                           POP_HOOK_NO_GAME_VIEW, nullptr,
                           &dispatch_id) != POP_OK)
    std::fprintf(stderr, "[frontier] Function-call observation unavailable\n");
}

void observe_inventory_bindings(X86 *c) {
  static bool observed = false;
  if (observed)
    return;
  observed = true;
  // The original getter 00623b20 resolves 007218b4 -> +0x10; the runtime
  // keeps its function registry at +8 (00638d68..00638d70).
  const uint32_t holder = rd32(0x007218b4u);
  const uint32_t runtime =
      holder && gm_valid(holder, 0x14) ? rd32(holder + 0x10) : 0;
  const uint32_t registry =
      runtime && gm_valid(runtime, 12) ? rd32(runtime + 8) : 0;
  const uint32_t sp = c->r[R_ESP];
  if (!registry || !gm_valid(registry, 12) || sp < 256 ||
      !gm_valid(sp - 256, 256)) {
    std::fprintf(stderr, "[frontier] Inventory binding query unavailable\n");
    return;
  }
  for (const char *name :
       {"AgentHasInventoryItem", "GetInventoryItems",
        "GetInventoryItemDropType", "GetInventoryItemAgentType"}) {
    X86 extra = *c;
    extra.r[R_ESP] = sp - 256;
    const uint32_t object = sp - 128, text = sp - 112;
    const uint32_t length = uint32_t(std::strlen(name));
    // Temporary borrowed +0/+4/+8 string on unused diagnostic stack space;
    // 00631b40 and its comparison only read it. No allocation or ownership
    // transfer and no world/registry writes. The original getter decides.
    for (uint32_t i = 0; i <= length; ++i)
      wr8(text + i, uint8_t(name[i]));
    wr32(object, text);
    wr32(object + 4, length);
    wr32(object + 8, length);
    extra.r[R_ECX] = registry;
    const uint32_t function = guest_call(&extra, 0x00631b40u, object);
    const uint32_t target =
        function && gm_valid(function, 0x18) ? rd32(function + 0x14) : 0;
    std::fprintf(
        stderr,
        "[frontier] Inventory binding name=%s function=%08x target=%08x\n",
        name, function, target);
  }
}

// Observe exactly the terrain values included in 0049ceb0's original
// checksum, before the generated world begins simulation. No terrain copy,
// checksum result replacement or camera-dependent state is involved.
void generation_fingerprint(uint32_t context, const Region &r) {
  const uint32_t map =
      context && gm_valid(context, 0x84) ? rd32(context + 0x80) : 0;
  if (!map || !gm_valid(map, 0x50)) {
    std::fprintf(stderr,
                 "[frontier] Region %s terrain observation unavailable\n",
                 r.key.c_str());
    return;
  }
  const uint32_t width = rd32(map + 0x30), height = rd32(map + 0x34),
                 stride = rd32(map + 0x38), vertices = rd32(map + 0x4c);
  const uint64_t count = uint64_t(stride) * (height ? height - 1 : 0) + width;
  if (!width || !height || width > 1024 || height > 1024 || stride < width ||
      stride > 1025 || !vertices || count > 1025ull * 1024 ||
      !gm_valid(vertices, uint32_t(count * 24))) {
    std::fprintf(stderr,
                 "[frontier] Region %s terrain observation unavailable\n",
                 r.key.c_str());
    return;
  }
  uint32_t fingerprint = 2166136261u;
  for (uint32_t y = 0; y < height; ++y)
    for (uint32_t x = 0; x < width; ++x) {
      uint32_t value = rd32(vertices + (stride * y + x) * 24 + 4) & 0x7fffffffu;
      for (unsigned byte = 0; byte < 4; ++byte) {
        fingerprint = (fingerprint ^ (value & 0xffu)) * 16777619u;
        value >>= 8;
      }
    }
  std::fprintf(
      stderr, "[frontier] Region %s generated terrain %ux%u fingerprint=%08x\n",
      r.key.c_str(), width, height, fingerprint);
}

// A checkpoint is meaningful only for the imported content that made it.
// Native diagnostic hosts without a browser identity retain their existing
// behavior. Browser identities are generated from actual imported bytes,
// never from URL parameters or a mod's claimed version.
std::string_view content_identity() {
  const char *identity = recomp_env("CONTENT_IDENTITY");
  if (!identity)
    return {};
  const std::string_view value(identity);
  if (value.size() != 129 || value[64] != ':')
    return "invalid";
  for (size_t i = 0; i < value.size(); ++i)
    if (i != 64 && !((value[i] >= '0' && value[i] <= '9') ||
                     (value[i] >= 'a' && value[i] <= 'f')))
      return "invalid";
  return value;
}

extern "C" void majesty_browser_frontier_generation_settings(X86 *c) {
  const uint32_t release_hook = coop_generation.release_hook;
  coop_generation = {};
  coop_generation.release_hook = release_hook;
  Region r = initial_coop_generation(c);
  if (!r.enabled) r = committed_coop_generation(c);
  const bool shared = r.enabled;
  if (!shared) r = region();
  const uint32_t sp = c->r[R_ESP], generator = c->r[R_ECX];
  uint32_t connected_settings = 0;
  // Solo freestyle preset/custom Accept and the explicitly admitted shared
  // network-freestyle constructor only. Fixed quests and saved-world readers
  // retain their original settings and random state.
  if (r.enabled && (shared || seeded_generation()) && gm_valid(sp, 12) &&
      (shared || rd32(sp) == 0x00446a93u || rd32(sp) == 0x0045def6u)) {
    if (generation_debug()) {
      install_generation_trace();
      observe_inventory_bindings(c);
    }
    const uint32_t settings = rd32(sp + 4);
    if (settings && gm_valid(settings, 0x34)) {
      X86 extra = *c;
      if (shared || connected_terrain()) {
        // Original extent getter004ae120 copies configuration+24/+28
        // into generator+8c/+90. Pin these before construction: connected
        // regions use 128-cell terrain and its corresponding 256-cell grid.
        // Ordinary freestyle, fixed quests and saved readers are excluded.
        const uint32_t width = rd32(settings + 0x24), height = rd32(settings + 0x28);
        extra.r[R_ECX] = settings;
        guest_call(&extra, 0x004ae140u, 128u, 128u);
        const bool sized = rd32(settings + 0x24) == 128 && rd32(settings + 0x28) == 128;
        std::fprintf(stderr,
            "[frontier] Region %s connected extent cells=128,128 previous=%u,%u "
            "original-setter=004ae140 result=%s\n",
            r.key.c_str(), width, height, sized ? "pass" : "fail");
        if (!sized) std::abort();
        connected_settings = settings;
      }
      extra.r[R_ECX] = settings;
      // 004ae230 owns the configuration's +0x30 seed. 004aef20 reads it
      // via 004ae220 into generator+0x88, then seeds the original RNG.
      guest_call(&extra, 0x004ae230, r.seed);
      if (generation_debug())
        std::fprintf(stderr, "[frontier] Region %s generation seed=%u\n",
                     r.key.c_str(), r.seed);
    }
  }
  fn_004aef20(c);
  if (connected_settings) {
    // The original landscape classification overwrites generator+8c/+90
    // at004af834/004af83a after reading the requested dimensions. Apply the
    // opt-in connected extent after that initialization, while world+84 is
    // still null and before any generation/placement. The original getter
    // copies the two requested cells; no allocated world is resized.
    if (!gm_valid(generator, 0x94) || rd32(generator + 0x84) ||
        c->r[R_ESP] != sp + 12 || c->r[R_EAX] != generator ||
        rd32(generator + 0x88) != r.seed ||
        (shared && !coop_generation_party_unchanged())) std::abort();
    const uint32_t width = rd32(generator + 0x8c), height = rd32(generator + 0x90);
    X86 extra = *c;
    extra.r[R_ECX] = connected_settings;
    guest_call(&extra, 0x004ae120u, generator + 0x8c);
    const bool sized = rd32(generator + 0x8c) == 128 && rd32(generator + 0x90) == 128 &&
                       !rd32(generator + 0x84) && rd32(generator + 0x88) == r.seed;
    std::fprintf(stderr,
        "[frontier] Region %s connected generation extent cells=128,128 landscape=%u,%u "
        "original-getter=004ae120 world-null=1 seed-same=1 result=%s\n",
        r.key.c_str(), width, height, sized ? "pass" : "fail");
    if (!sized) std::abort();
  }
}

extern "C" void majesty_browser_frontier_generate(X86 *c) {
  connected_boundary_policy.terrain = 0; // No identity survives original disposal/reallocation.
  const bool shared = coop_generation.selected.enabled;
  const Region &r = shared ? coop_generation.selected : region();
  const uint32_t sp = c->r[R_ESP];
  const bool committed = shared && coop_fresh_construction.generation_pending &&
                         coop_fresh_construction.generator == c->r[R_ECX] &&
                         coop_fresh_construction.agreement();
  if (shared && (!gm_valid(sp, 4) || (!committed && rd32(sp) != 0x004bbecfu) ||
                 c->r[R_ECX] != coop_generation.generator ||
                 !coop_generation_party_unchanged())) std::abort();
  if (committed) coop_fresh_construction.generation_pending = false;
  const bool observe = r.enabled && (shared || seeded_generation()) && generation_debug() &&
                       gm_valid(sp, 4) &&
                       (rd32(sp) == 0x00446b22u || rd32(sp) == 0x0045df87u);
  const bool connected = shared || (r.enabled && seeded_generation() && connected_terrain() &&
                         gm_valid(sp, 4) &&
                         (rd32(sp) == 0x00446b22u || rd32(sp) == 0x0045df87u));
  ConnectedGeneration terrain{r, *c};
  if (connected && mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005bb300u, 0,
      ConnectedGeneration::initialize, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW,
      &terrain, &terrain.handle) != POP_OK) {
    std::fprintf(stderr, "[frontier] Connected terrain hook unavailable\n");
    std::abort();
  }
  if (connected && !terrain.install_stages()) {
    std::fprintf(stderr, "[frontier] Connected terrain stage hook unavailable\n");
    std::abort();
  }
  if (shared) {
    // Configuration construction seeds0071fc70, but original terrain-cell
    // routines use the independent006d8e80 RNG, initialized from time by
    // 004f6730. Seed that original owner before any shared world generation.
    // Fixed quests, solo generation and saved readers retain their behavior.
    if (!r.seed || !gm_valid(coop_generation.generator, 0x8c) ||
        rd32(coop_generation.generator + 0x88) != r.seed)
      std::abort();
    X86 extra = *c;
    const uint32_t terrain_rng = guest_call(&extra, 0x004f6730u);
    if (terrain_rng != 0x006d8e80u || !gm_valid(terrain_rng, 8))
      std::abort();
    extra.r[R_ECX] = terrain_rng;
    guest_call(&extra, 0x004f6710u, r.seed);
    if (rd32(terrain_rng) != r.seed || rd32(terrain_rng + 4) != r.seed ||
        !coop_generation_party_unchanged())
      std::abort();
    std::fprintf(stderr, "[coop-generation] Original terrain RNG seeded "
        "epoch=%llu region=%s seed=%u owner=006d8e80 "
        "original-setter=004f6710 gameplay-rng-separate=1 result=pass\n",
        (unsigned long long)coop_generation.epoch, r.key.c_str(), r.seed);
  }
  fn_004b23d0(c);
  if (connected) {
    const bool preserved = terrain.unchanged(c->r[R_EAX], "generation", true) &&
                           (!shared || coop_generation_party_unchanged());
    if (shared) {
      std::fprintf(stderr, "[coop-generation] Constructed epoch=%llu region=%s seed=%u players=%u extent=128,128 preserved=%u\n",
          (unsigned long long)coop_generation.epoch, r.key.c_str(), r.seed,
          coop_generation.party.player_count, unsigned(preserved));
      if (preserved) {
        // Compare actual final boundary heights across independently built
        // neighbors. Fixed-size output; no retained meshes or map catalogue.
        std::array<uint32_t, 4> edges{};
        edges.fill(2166136261u);
        for (uint32_t i = 0; i <= 128; ++i) {
          const std::array<uint32_t,4> indices = {i*129, i*129+128, i, 128*129+i};
          for (size_t side = 0; side < edges.size(); ++side) {
            const uint32_t height = rd32(terrain.vertices + indices[side]*24);
            for (uint32_t byte = 0; byte < 4; ++byte)
              edges[side] = (edges[side] ^ ((height >> (byte*8)) & 255u)) * 16777619u;
          }
        }
        std::fprintf(stderr, "[coop-generation] Edges region=%s west=%08x east=%08x north=%08x south=%08x\n",
            r.key.c_str(), edges[0], edges[1], edges[2], edges[3]);
      }
    }
    std::fprintf(stderr, "[frontier] Region %s connected terrain v1 generation "
                         "preserved=%u\n", r.key.c_str(), unsigned(preserved));
    // Never enter play with a partially installed or subsequently altered
    // experimental world. This path requires an explicit versioned opt-in.
    if (!preserved)
      std::abort();
#ifndef __EMSCRIPTEN__
    const char *probe = recomp_env("BROWSER_FRONTIER_SESSION_READY_SNAPSHOT_FIXTURE");
    if (probe && !std::strcmp(probe,"v1")) {
      auto &p = pending_border_probe;
      if (p.handle) std::abort();
      p = {}; p.world = terrain.world; p.terrain = terrain.terrain; p.vertices = terrain.vertices;
      if (mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00428d70u,0,PendingBorderProbe::write,
          POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,&p,&p.handle) != POP_OK) std::abort();
      if (r.key == "-1_0") {
        if (g_watch_len) std::abort();
        p.watched = p.vertices + 32u * 24u;
        g_watch_base = p.watched; g_watch_len = 4;
        std::fprintf(stderr,"[frontier] Initialization height watch region=%s vertex=32,0 before=%d armed=1\n",
            r.key.c_str(),int32_t(rd32(p.watched)));
      }
    }
#endif
  }
  if (observe)
    generation_fingerprint(c->r[R_EAX], r);
}

bool identity_path(const Region &r, char *path, size_t size) {
  return recomp_writable_path((r.checkpoint + ".identity").c_str(), path, size);
}

bool checkpoint_identity_matches(const Region &r) {
  const auto identity = content_identity();
  if (identity.empty())
    return true;
  if (identity == "invalid")
    return false;
  char path[1024];
  if (!identity_path(r, path, sizeof path))
    return false;
  const int fd = os_fd_open(path, OS_O_RDONLY);
  if (fd < 0)
    return false;
  char text[192];
  size_t done = 0;
  while (done < sizeof text) {
    const int64_t n = os_fd_read(fd, text + done, sizeof text - done);
    if (n <= 0) {
      if (n < 0)
        done = sizeof text;
      break;
    }
    done += size_t(n);
  }
  os_fd_close(fd);
  const std::string expected =
      "frontier-content-v1\n" + std::string(identity) + "\n";
  return std::string_view(text, done) == expected;
}

// The original path formatter owns SaveGame directory selection and extension.
// Resolve its CYString output through the Win32 sandbox rather than duplicating
// host directory conventions. All objects here remain 32-bit guest addresses.
std::string native_checkpoint_path(X86 *c, const std::string &label,
                                   int operation = WIN32_FILE_WRITE) {
  const uint32_t buffer = heap_alloc(uint32_t(label.size() + 1));
  const uint32_t name = heap_alloc(12, true), output = heap_alloc(12, true);
  if (!buffer || !name || !output) {
    if (buffer)
      heap_free(buffer);
    if (name)
      heap_free(name);
    if (output)
      heap_free(output);
    return {};
  }
  for (size_t i = 0; i <= label.size(); ++i)
    wr8(buffer + uint32_t(i), uint8_t(label.c_str()[i]));
  X86 extra = *c;
  extra.r[R_ECX] = name;
  guest_call(&extra, 0x004e3590, buffer, uint32_t(label.size()));
  extra = *c;
  extra.r[R_ECX] = output;
  guest_call(&extra, 0x004e3340);
  extra = *c;
  const uint32_t serializer = guest_call(&extra, 0x00435d00);
  std::string path;
  if (serializer && gm_valid(serializer, 12) &&
      rd32(serializer) == 0x00680c60) {
    // Pinned 00680c60 +0x4c = 00435c60, called by 004359c0 before writing.
    extra = *c;
    extra.r[R_ECX] = serializer;
    guest_call(&extra, 0x00435c60, output, name);
    const uint32_t text = rd32(output), length = rd32(output + 8);
    if (text && length && length < 1024 && gm_valid(text, length)) {
      std::string guest_path;
      for (uint32_t i = 0; i < length; ++i)
        guest_path += char(rd8(text + i));
      if (guest_path.find('\0') == std::string::npos)
        path = win32_host_path_op(guest_path, operation);
    }
  }
  for (uint32_t object : {name, output}) {
    extra = *c;
    extra.r[R_ECX] = object;
    guest_call(&extra, 0x004e3820);
    heap_free(object);
  }
  heap_free(buffer);
  return path;
}

std::array<std::string, 2> checkpoint_names(const Region &r) {
  return {r.checkpoint, r.checkpoint + "_Recovery"};
}

bool checkpoint_store(X86 *c, const Region &r, std::string &manifest,
                      std::array<std::string, 2> &paths) {
  if (content_identity() == "invalid")
    return false;
  char path[1024];
  if (!recomp_writable_path((r.checkpoint + ".checkpoint").c_str(), path,
                            sizeof path))
    return false;
  manifest = path;
  const auto names = checkpoint_names(r);
  for (int i = 0; i < 2; ++i)
    paths[i] = native_checkpoint_path(c, names[i]);
  return !paths[0].empty() && !paths[1].empty() && paths[0] != paths[1];
}

void report_checkpoint(const CheckpointStore::Record &record) {
  const char *debug = recomp_env("BROWSER_FRONTIER_CHECKPOINT_DEBUG");
  if (debug && !std::strcmp(debug, "1") &&
      record.status == CheckpointStore::Status::valid)
    std::fprintf(stderr, "[frontier] Checkpoint slot=%d bytes=%llu digest=%s\n",
                 record.slot, static_cast<unsigned long long>(record.size),
                 record.digest.c_str());
}

// The trusted two-region prototype has one coordinator while both simulations
// are stopped. Four data slots and one manifest retain the previous pair until
// both replacement worlds are flushed and verified. This is not a general
// multi-writer campaign store or a promise of power-loss durability.
class TransferStore {
public:
  static std::string_view region_key(int side) {
#ifdef __EMSCRIPTEN__
    return side ? "999912_999914" : "999913_999914";
#else
    return side ? "1_0" : "0_0";
#endif
  }
  struct Record {
    CheckpointStore::Status status = CheckpointStore::Status::invalid;
    int slot = -1;
    bool moved = false;
    std::array<uint64_t, 2> sizes{};
    std::array<std::string, 2> hashes{};
  };
  TransferStore(std::string root, std::string content)
      : root_(std::move(root)), content_(std::move(content)) {}
  std::string path(int side, int slot) const {
    return root_ + "/Frontier_Transfer_" + (side ? "Destination_" : "Source_") +
           std::to_string(slot) + ".GMP";
  }
  std::string manifest() const {
    return root_ + "/Frontier_Transfer.checkpoint";
  }
  static bool digest(std::string_view value) {
    if (value.size() != 64)
      return false;
    for (char c : value)
      if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')))
        return false;
    return true;
  }
  static const std::array<std::string, 2> &expected_hashes(bool moved) {
    static const std::array<std::string, 2> before = {
        "6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1",
        "83222090215e19ed3d1e3d2ea92df87d68cad77c3496ac3d3e4d8083112ba4b9"};
    static const std::array<std::string, 2> after = {
#ifdef __EMSCRIPTEN__
        "1da38fa924717370468c178af5790a12d72887648c169bbc111125fce161430e",
        "93938c504ab0312f7d61b4ca5b38e139ea48982c1b406165f883989bcfbf3e64"};
#else
        "526a868c232d5a38213750bf6d0d5319d52bbcefecaa077f8c38c30ad31ccb0e",
        "268fd0f8cfbcadf5ea2131d4d0321f6e9c93e53cca8ffbe4b75808c10f953160"};
#endif
    return moved ? after : before;
  }
  bool content_valid() const {
    if (content_.size() > 192)
      return false;
    for (unsigned char c : content_)
      if (c < 32 || c > 126)
        return false;
    return true;
  }
  Record read() const {
    Record out;
    OsStat stat{};
    const std::string marker = manifest();
    if (os_lstat(marker.c_str(), &stat) != 0) {
      struct Search {
        bool found = false;
      } search;
      const auto visit = [](const char *name, void *user) {
        if (std::strcmp(name, "Frontier_Transfer.checkpoint") == 0)
          static_cast<Search *>(user)->found = true;
        return 0;
      };
      if (os_listdir(root_.c_str(), visit, &search) == 0 && !search.found)
        out.status = CheckpointStore::Status::missing;
      return out;
    }
    if (!content_valid() || !stat.is_regular || !stat.size || stat.size >= 512)
      return out;
    char bytes[512];
    const int fd = os_fd_open(marker.c_str(), OS_O_RDONLY);
    if (fd < 0)
      return out;
    const int64_t used = os_fd_read(fd, bytes, sizeof bytes);
    const bool closed = os_fd_close(fd) == 0;
    if (!closed || used != int64_t(stat.size))
      return out;
    std::string_view text(bytes, size_t(used));
    if (text.back() != '\n' || std::count(text.begin(), text.end(), '\n') != 10)
      return out;
    const auto line = [&text]() {
      const size_t end = text.find('\n');
      const auto value = text.substr(0, end);
      text.remove_prefix(end + 1);
      return value;
    };
    if (line() != "majesty-transfer-v1")
      return out;
    const auto slot = line(), moved = line();
    if ((slot != "0" && slot != "1") || (moved != "0" && moved != "1") ||
        line() != region_key(0) || line() != region_key(1))
      return out;
    out.slot = slot[0] - '0';
    out.moved = moved == "1";
    for (int side = 0; side < 2; ++side) {
      const auto size = line(), hash = line();
      uint64_t n = 0;
      const auto parsed =
          std::from_chars(size.data(), size.data() + size.size(), n);
      if (parsed.ec != std::errc{} || parsed.ptr != size.data() + size.size() ||
          !n || n > 64u * 1024u * 1024u || size != std::to_string(n) ||
          !digest(hash))
        return {};
      const std::string filename = path(side, out.slot);
      if (os_lstat(filename.c_str(), &stat) != 0 || !stat.is_regular ||
          stat.size != n || loader_hash_file_bounded(filename.c_str(), n) != hash)
        return {};
      out.sizes[side] = n;
      out.hashes[side] = hash;
    }
    if (line() != content_ || !text.empty() ||
        out.hashes != expected_hashes(out.moved))
      return {};
    out.status = CheckpointStore::Status::valid;
    return out;
  }
  // Bounded copy/hash, independent of how many bytes the saved world contains.
  static bool copy(const std::string &from, const std::string &to,
                   uint64_t size, const std::string &hash) {
    OsStat stat{};
    if (!size || size > 64u * 1024u * 1024u || !digest(hash) ||
        os_lstat(from.c_str(), &stat) != 0 || !stat.is_regular ||
        stat.size != size || loader_hash_file_bounded(from.c_str(), size) != hash ||
        (os_lstat(to.c_str(), &stat) == 0 && !stat.is_regular))
      return false;
    const int in = os_fd_open(from.c_str(), OS_O_RDONLY);
    if (in < 0)
      return false;
    const int out =
        os_fd_open(to.c_str(), OS_O_WRONLY | OS_O_CREAT | OS_O_TRUNC);
    if (out < 0) {
      os_fd_close(in);
      return false;
    }
    char buffer[4096];
    uint64_t done = 0;
    bool valid = true;
    while (done < size && valid) {
      const size_t wanted =
          size_t(std::min<uint64_t>(sizeof buffer, size - done));
      const int64_t n = os_fd_read(in, buffer, wanted);
      if (n <= 0 || n > int64_t(wanted)) {
        valid = false;
        break;
      }
      size_t written = 0;
      while (written < size_t(n)) {
        const int64_t result =
            os_fd_write(out, buffer + written, size_t(n) - written);
        if (result <= 0 || result > n - int64_t(written)) {
          valid = false;
          break;
        }
        written += size_t(result);
      }
      done += uint64_t(n);
    }
    char extra;
    valid = valid && done == size && os_fd_read(in, &extra, 1) == 0 &&
            os_fd_fsync(out) == 0;
    const bool in_closed = os_fd_close(in) == 0;
    const bool out_closed = os_fd_close(out) == 0;
    return valid && in_closed && out_closed &&
           loader_hash_file_bounded(to.c_str(), size) == hash;
  }
  bool commit(const std::array<std::string, 2> &inputs,
              const std::array<std::string, 2> &hashes, bool moved,
              std::string_view fault) const {
    const Record old = read();
    if (!content_valid() || old.status == CheckpointStore::Status::invalid ||
        (!moved && old.status != CheckpointStore::Status::missing) ||
        (moved && old.status != CheckpointStore::Status::valid))
      return false;
    if (old.status == CheckpointStore::Status::valid && old.moved)
      return moved && old.hashes == hashes;
    const int next = old.slot == 0 ? 1 : 0;
    std::array<uint64_t, 2> sizes{};
    for (int side = 0; side < 2; ++side) {
      OsStat stat{};
      if (os_lstat(inputs[side].c_str(), &stat) != 0 || !stat.is_regular ||
          !copy(inputs[side], path(side, next), stat.size, hashes[side]))
        return false;
      sizes[side] = stat.size;
      if (side == 0) {
        if (fault == "fail-after-source")
          return false;
        if (fault == "interrupt-after-source") {
          std::fprintf(stderr,
                       "[frontier] Transfer interruption after source stage\n");
          std::fflush(stderr);
          std::_Exit(86);
        }
      }
    }
    const std::string text =
        "majesty-transfer-v1\n" + std::to_string(next) + "\n" +
        (moved ? "1\n" : "0\n") + std::string(region_key(0)) + "\n" +
        std::string(region_key(1)) + "\n" + std::to_string(sizes[0]) + "\n" +
        hashes[0] + "\n" + std::to_string(sizes[1]) + "\n" + hashes[1] + "\n" +
        content_ + "\n";
    const std::string temporary = manifest() + ".tmp";
    OsStat existing{};
    if (os_lstat(temporary.c_str(), &existing) == 0 && !existing.is_regular)
      return false;
    const int fd =
        os_fd_open(temporary.c_str(), OS_O_WRONLY | OS_O_CREAT | OS_O_TRUNC);
    if (fd < 0)
      return false;
    size_t done = 0;
    while (done < text.size()) {
      const int64_t n = os_fd_write(fd, text.data() + done, text.size() - done);
      if (n <= 0 || n > int64_t(text.size() - done))
        break;
      done += size_t(n);
    }
    const bool flushed = done == text.size() && os_fd_fsync(fd) == 0;
    const bool closed = os_fd_close(fd) == 0;
    if (fault == "interrupt-before-publish" && flushed && closed) {
      std::fprintf(
          stderr, "[frontier] Transfer interruption before pair publication\n");
      std::fflush(stderr);
      std::_Exit(87);
    }
    const bool published =
        flushed && closed && fault != "fail-before-publish" &&
        os_rename(temporary.c_str(), manifest().c_str()) == 0;
    if (!published)
      os_unlink(temporary.c_str());
    if (published && fault == "interrupt-after-publish") {
      std::fprintf(stderr,
                   "[frontier] Transfer interruption after pair publication\n");
      std::fflush(stderr);
      std::_Exit(88);
    }
    return published;
  }

private:
  std::string root_, content_;
};

bool transfer_requested() {
  const char *flag = recomp_env("RULE_FRONTIER_TRANSFER");
  return flag && !std::strcmp(flag, "1");
}
bool transfer_selected_moved = false;
bool transfer_root(const Region &r, std::string &root) {
#ifdef __EMSCRIPTEN__
  // These are copied stopped test kingdoms, never personal profiles. The
  // browser diagnostic owns each named case and permits one stopped writer.
  const char *profile = recomp_env("PROFILE_DIR");
  const char *trial = recomp_env("BROWSER_FRONTIER_TRANSFER_CASE");
  if (!r.enabled || !profile || !trial ||
      (r.key != TransferStore::region_key(0) &&
       r.key != TransferStore::region_key(1)) ||
      std::string(profile) != "/opfs/majesty/profile/frontier_" + r.key)
    return false;
  constexpr std::array<std::string_view, 10> cases = {
      "committed",        "retry",
      "fail-source",      "fail-publish",
      "interrupt-source", "interrupt-publish",
      "interrupt-after",  "corrupt-input",
      "corrupt-active",   "bad-moved"};
  if (std::find(cases.begin(), cases.end(), trial) == cases.end())
    return false;
  root = "/opfs/majesty/profile/actor-wasm-transfer-" + std::string(trial);
  OsStat stat{};
  return os_lstat(root.c_str(), &stat) == 0 && stat.is_dir &&
         !stat.is_symlink && os_lstat(profile, &stat) == 0 && stat.is_dir &&
         !stat.is_symlink;
#else
  const char *profile = recomp_env("PROFILE_DIR");
  if (!profile || !r.enabled || (r.key != "0_0" && r.key != "1_0"))
    return false;
  std::string_view path(profile);
  const std::string suffix = "/frontier_" + r.key;
  if (!path.ends_with(suffix))
    return false;
  path.remove_suffix(suffix.size());
  const size_t slash = path.rfind('/');
  const auto name = path.substr(slash == path.npos ? 0 : slash + 1);
  if (!name.starts_with("actor-arrival-fixture-") || name.size() <= 22 ||
      name.size() > 80)
    return false;
  OsStat stat{};
  const std::string parent(path);
  if (os_lstat(parent.c_str(), &stat) != 0 || !stat.is_dir || stat.is_symlink ||
      os_lstat(profile, &stat) != 0 || !stat.is_dir || stat.is_symlink)
    return false;
  root = path;
  return true;
#endif
}
bool transfer_checkpoint(X86 *c, const Region &r, std::string &name) {
  std::string root;
  if (!transfer_root(r, root)) {
    std::fprintf(stderr, "[frontier] Transfer unavailable: owned stopped pair "
                         "profile required\n");
    return false;
  }
  const TransferStore store(root, std::string(content_identity()));
  const char *raw = recomp_env("BROWSER_FRONTIER_TRANSFER_ACTION");
  const std::string_view action(raw ? raw : "");
  if (!action.empty()) {
    const bool initialize = action == "initialize";
    const bool recognized =
        initialize || action == "commit" || action == "fail-after-source" ||
        action == "fail-before-publish" || action == "interrupt-after-source" ||
        action == "interrupt-before-publish" ||
        action == "interrupt-after-publish";
    bool committed = false;
    if (recognized) {
      // These stopped source/destination worlds were independently qualified
      // with the original full loaders. No arbitrary source files are accepted.
      const std::array<std::string, 2> inputs = {
          root + (initialize ? "/Source_Before.GMP" : "/Source_After.GMP"),
          root + (initialize ? "/Destination_Before.GMP"
                             : "/Destination_After.GMP")};
      const auto &hashes = TransferStore::expected_hashes(!initialize);
      committed = store.commit(inputs, hashes, !initialize,
                               initialize || action == "commit" ? "" : action);
    }
    std::fprintf(stderr, "[frontier] Transfer action=%.*s published=%u\n",
                 int(action.size()), action.data(), unsigned(committed));
  }
  const auto record = store.read();
  if (record.status != CheckpointStore::Status::valid) {
    std::fprintf(stderr,
                 "[frontier] Transfer checkpoint invalid or unavailable\n");
    return false;
  }
  const int side = r.key == TransferStore::region_key(1) ? 1 : 0;
  name = r.checkpoint + "_Transfer";
  const std::string local = native_checkpoint_path(c, name),
                    temporary = local + ".tmp";
  if (local.empty() ||
      !TransferStore::copy(store.path(side, record.slot), temporary,
                           record.sizes[side], record.hashes[side]) ||
      os_rename(temporary.c_str(), local.c_str()) != 0) {
    if (!local.empty())
      os_unlink(temporary.c_str());
    return false;
  }
  transfer_selected_moved = record.moved;
  win32_invalidate_dir_cache();
  std::fprintf(stderr,
               "[frontier] Transfer selected region=%s moved=%u slot=%d "
               "source-hash=%s destination-hash=%s copy-buffer=4096\n",
               r.key.c_str(), unsigned(record.moved), record.slot,
               record.hashes[0].c_str(), record.hashes[1].c_str());
  return true;
}

bool active_checkpoint(X86 *c, const Region &r, std::string &name) {
  if (transfer_requested())
    return transfer_checkpoint(c, r, name);
  std::string manifest;
  std::array<std::string, 2> paths;
  if (!checkpoint_store(c, r, manifest, paths))
    return false;
  const CheckpointStore store(manifest, paths, std::string(content_identity()));
  const auto record = store.read();
  if (record.status == CheckpointStore::Status::valid) {
    report_checkpoint(record);
    name = checkpoint_names(r)[record.slot];
    return true;
  }
  if (record.status != CheckpointStore::Status::missing ||
      !checkpoint_identity_matches(r))
    return false;
  OsStat stat{};
  if (os_stat(paths[0].c_str(), &stat) != 0 || !stat.is_regular || !stat.size)
    return false;
  name = r.checkpoint;
  return true;
}

// One startup binding: selected region, original saved clock, current native
// and GPL aliases, classes/player, and exact selected GMP digest. No actor,
// checkpoint buffer or dormant world remains in this state.
struct SelectedHeroBinding {
  enum class SaveStage { idle,pausing,held,resuming } save_stage=SaveStage::idle;
  bool enabled=false, source_checked=false, admitted=false, failed=false, refusal_reported=false;
  bool halo_layout=false, before_valid=false, motion_announced=false, closed=false, retired=false, proxy_home=false, generated_halo=false;
#ifndef __EMSCRIPTEN__
  bool move_test_done=false;
#endif
  uint32_t before_clock=0,motion_samples=0,navigation_deferred=0;
  std::array<int32_t,3> before_pose{};
  uint32_t gpl_seed=0,game_seed=0;
  uint32_t save_serial=0,save_clock=0;
  uint64_t save_poll_ns=0;
  std::string key,digest,owner_manifest,capture_last_refused,retired_checkpoint,crossing_target;
  std::array<uint32_t,8> values{};
};
SelectedHeroBinding &selected_hero_binding() {
  static SelectedHeroBinding value=[] {
    SelectedHeroBinding b;
    const char *flag=recomp_env("RULE_FRONTIER_HERO_RESTORE"),*text=recomp_env("FRONTIER_HERO_BINDING");
    if(!flag&&!text)return b;
    b.enabled=true;
    if(!flag||std::strcmp(flag,"v1")||!text||strnlen(text,257)>256){b.failed=true;return b;}
    std::string_view remaining(text);std::array<std::string_view,12> fields{};
    for(size_t i=0;i<fields.size();++i){
      const auto split=remaining.find('|');
      if((i+1==fields.size())!=(split==remaining.npos)){b.failed=true;return b;}
      fields[i]=remaining.substr(0,split);
      if(i+1<fields.size())remaining.remove_prefix(split+1);
    }
    if(fields[0]!="majesty-hero-runtime-v1"||fields[1]!=region().key||
       (fields[7]!="native"&&fields[7]!="proxy")||!TransferStore::digest(std::string(fields[11]))){b.failed=true;return b;}
    b.proxy_home=fields[7]=="proxy";
    constexpr std::array<size_t,8> indexes{2,3,4,5,6,8,9,10};
    for(size_t i=0;i<indexes.size();++i){const auto item=fields[indexes[i]];
      const auto parsed=std::from_chars(item.data(),item.data()+item.size(),b.values[i]);
      if(parsed.ec!=std::errc{}||parsed.ptr!=item.data()+item.size()||item!=std::to_string(b.values[i])){b.failed=true;return b;}
    }
    const char *restore=recomp_env("RULE_FRONTIER_RESTORE");
    if(!region().enabled||!restore||std::strcmp(restore,"1")||transfer_requested()||
       recomp_env("RULE_FRONTIER_SESSION")||recomp_env("RULE_FRONTIER_CHAPTER")||
       !b.values[1]||!b.values[2]||b.values[2]>0x7fffffffu||!b.values[3]||b.values[4]>7||
       (b.proxy_home?b.values[5]!=0:!b.values[5])||!b.values[6]||b.values[6]>0x7fffffffu||!b.values[7]||
       b.values[1]==b.values[5]||b.values[2]==b.values[6]){b.failed=true;return b;}
    b.key=std::string(fields[1]);b.digest=std::string(fields[11]);
    if(const char *halo=recomp_env("FRONTIER_HERO_HALO_BINDING")){
      const std::string expected="majesty-hero-halo-v1|"+b.key+"|"+b.digest;
      if(strnlen(halo,257)>256||std::string_view(halo)!=expected){b.failed=true;return b;}
      b.halo_layout=true;
    }
    return b;
  }();return value;
}
bool session_saved_rng(const std::string &,uint32_t &,uint32_t &,uint32_t *);
bool selected_hero_refused(bool checkpoint) {
  auto &b=selected_hero_binding();b.failed=true;
  if(!b.refusal_reported){
    b.refusal_reported=true;
    std::fprintf(stderr,"[frontier] Selected hero %s refused region=%s\n",checkpoint?"checkpoint":"binding",region().key.c_str());
  }
  return false;
}
bool selected_hero_source(X86 *c,const std::string &name) {
  auto &b=selected_hero_binding();if(!b.enabled||b.admitted)return true;
  std::string manifest;std::array<std::string,2> paths;
  if(b.failed||b.source_checked||region().key!=b.key||!checkpoint_store(c,region(),manifest,paths))return selected_hero_refused(true);
  const auto record=CheckpointStore(manifest,paths,std::string(content_identity())).read();
  if(record.status!=CheckpointStore::Status::valid||record.digest!=b.digest||checkpoint_names(region())[record.slot]!=name){
    return selected_hero_refused(true);
  }
  uint32_t clock=0;
  if(!session_saved_rng(paths[record.slot],b.gpl_seed,b.game_seed,&clock)||clock!=b.values[0])return selected_hero_refused(true);
  b.source_checked=true;return true;
}
std::string selected_hero_small_text(const std::string &,size_t);
bool selected_hero_seed_owner(const std::string &);
bool selected_hero_ready(X86 *c) {
  auto &b=selected_hero_binding();if(!b.enabled||b.admitted)return true;
  if(b.failed)return selected_hero_refused(false);
  if(!b.source_checked||region().key!=b.key||!majesty_browser_streaming_selected_hero_ready(c,b.values.data())){
    return selected_hero_refused(false);
  }
#ifndef __EMSCRIPTEN__
  if(const char *seed=recomp_env("BROWSER_FRONTIER_HERO_INITIAL_OWNER_MANIFEST")){
    const char *test=recomp_env("BROWSER_FRONTIER_HERO_PUBLICATION_TEST"),*owned=recomp_env("BROWSER_FRONTIER_HERO_PUBLICATION_JOURNAL"),
        *profile=recomp_env("PROFILE_DIR");
    const std::string journal(owned?owned:""),path(profile?profile:""),head(seed);
    const std::string prefix="{\"version\":1,\"identitySha256\":\"",middle="\",\"revision\":0,\"nodeSha256\":\"";
    OsStat folder{};
    if(!test||std::strcmp(test,"v1")||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||!path.ends_with("/frontier_0_0")||
       journal.find("/actor-arrival-fixture-hero-route-")==journal.npos||journal.find("/../")!=journal.npos||
       os_lstat(journal.c_str(),&folder)||!folder.is_dir||folder.is_symlink||head.size()!=prefix.size()+64+middle.size()+64+3||
       !head.starts_with(prefix)||selected_hero_small_text(journal+"/Frontier_Hero_Route.checkpoint",512)!=head)std::abort();
    const auto identity=head.substr(prefix.size(),64),node=head.substr(prefix.size()+64+middle.size(),64);
    if(!TransferStore::digest(identity)||!TransferStore::digest(node)||head!=prefix+identity+middle+node+"\"}\n"||
       loader_hash_file_bounded((journal+"/Frontier_Hero_Route_Identity.json").c_str(),4096)!=identity||
       loader_hash_file_bounded((journal+"/Frontier_Hero_Route_Node_0.json").c_str(),65536)!=node)std::abort();
    b.owner_manifest=head;
  }
#endif
  if(const char *head=recomp_env("FRONTIER_HERO_OWNER_MANIFEST")){
    if(strnlen(head,513)>512||!selected_hero_seed_owner(head))return selected_hero_refused(false);
    b.owner_manifest=head;
  }
  b.admitted=true;
  std::fprintf(stderr,"[frontier] Selected hero bound region=%s unit=%u agent=%u home=%u/%u clock=%u original-registry=1 reciprocal-home=1\n",
      b.key.c_str(),b.values[1],b.values[2],b.values[5],b.values[6],b.values[0]);
  return true;
}

bool session_enabled();
bool session_saved_rng(const std::string &, uint32_t &, uint32_t &, uint32_t *);
bool halo_session_publish_layout(X86 *, const Region &);
bool halo_session_departure_checkpoint(X86 *);

bool restore_saved_configuration(X86 *c, uint32_t context) {
  // Original004355a3 copies the saved owning configuration only when the
  // current game's classifier returns0. Its classifier consults the previous
  // configuration's player count at game+29c, so a previous co-op world can
  // suppress that copy even when the newly read region is solo. Use the SVGD
  // configuration actually read by the complete serializer, for both freestyle
  // kinds0/2, through the same original owning assignment004ad0f0. Fixed quests
  // (kind1) have no freestyle configuration to restore.
  constexpr uint32_t metadata = 0x006d7ce0u;
  if (!c || !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      !gm_valid(context, 0x11c) || rd32(context) != 0x00682950u ||
      !gm_valid(metadata, 0x74)) return false;
  const uint32_t kind = rd32(metadata + 0x1c);
  if (kind == 1) return true;
  if (kind != 0 && kind != 2) return false;
  const uint32_t configuration = rd32(metadata + 0x60);
  if (!configuration || !gm_valid(configuration, 0x60)) return false;
  const auto valid_string = [](uint32_t at) {
    const uint32_t text = rd32(at), control = rd32(at + 4), length = rd32(at + 8);
    const uint32_t stride = (control & 0x01000000u) ? 2u : 1u;
    return length <= 4096 && (control & 0x00ffffffu) >= length &&
           text && gm_valid(text, (length + 1) * stride) &&
           !rd8(text + length * stride) &&
           (stride == 1 || !rd8(text + length * stride + 1));
  };
  if (!valid_string(configuration + 0x3c) ||
      !valid_string(configuration + 0x48)) return false;
  X86 extra = *c; extra.r[R_ESP] -= 32768;
  const uint32_t game = guest_call(&extra, 0x004d1080);
  const uint32_t saved_key = rd32(metadata + 0x5c);
  if (!game || !gm_valid(game, 0x2c8) || rd32(game + 0x264) != saved_key)
    return false;
  const uint32_t clock = rd32(context + 0x4c), world = rd32(0x0071c68c);
  extra.r[R_ECX] = game;
  const uint32_t previous_kind = guest_call(&extra, 0x004d2d80, 0x52525543u);
  extra.r[R_ECX] = game + 0x268;
  if (guest_call(&extra, 0x004ad0f0, configuration) != game + 0x268)
    return false;
  for (uint32_t offset = 0; offset < 0x3c; offset += 4)
    if (rd32(game + 0x268 + offset) != rd32(configuration + offset)) return false;
  const auto same_string = [](uint32_t a, uint32_t b) {
    const uint32_t length = rd32(a + 8), control = rd32(a + 4);
    const uint32_t stride = (control & 0x01000000u) ? 2u : 1u;
    return length == rd32(b + 8) &&
           (control & 0x01000000u) == (rd32(b + 4) & 0x01000000u) &&
           gm_valid(rd32(b), (length + 1) * stride) &&
           !std::memcmp(g_mem + rd32(a), g_mem + rd32(b), (length + 1) * stride);
  };
  extra.r[R_ECX] = game;
  const uint32_t restored_kind = guest_call(&extra, 0x004d2d80, 0x52525543u);
  if (restored_kind != kind || !same_string(configuration + 0x3c, game + 0x2a4) ||
      !same_string(configuration + 0x48, game + 0x2b0) ||
      rd8(configuration + 0x54) != rd8(game + 0x2bc) ||
      rd32(configuration + 0x58) != rd32(game + 0x2c0) ||
      rd32(configuration + 0x5c) != rd32(game + 0x2c4) ||
      rd32(game + 0x264) != saved_key || rd32(metadata + 0x60) != configuration ||
      rd32(metadata + 0x1c) != kind || rd32(context + 0x4c) != clock ||
      rd32(0x0071c68c) != world) return false;
  std::fprintf(stderr, "[frontier] Saved configuration restored kind=%u previous-kind=%u "
      "clock=%u original-copy=004ad0f0 world-preserved=1 result=pass\n",
      kind, previous_kind, clock);
  return true;
}

template<class Boundary>
bool clear_saved_names_at_boundary(X86 *c, const char *scope, Boundary boundary) {
  // SVGD00436770 appends names to its existing vector. The original writer
  // 00436ef0 clears that vector with004373e0 before refilling it. Repeat that
  // owning range destruction at a verified worldless boundary before a read;
  // never relax the single-player restored-name check or rewrite a saved name.
  const uint32_t metadata=0x006d7ce0u;
  if (!c || c->r[R_ESP]<STACK_LIMIT+65536 || c->r[R_ESP]>STACK_TOP ||
      rd32(0x0071c68c) || mods_hook_depth() || !sched_holds_baton() ||
      !boundary()) return false;
  const uint32_t begin=rd32(metadata+0x44),end=rd32(metadata+0x48),capacity=rd32(metadata+0x4c);
  if ((!begin&&(end||capacity)) || (begin&&(end<begin||capacity<end||(end-begin)%12||
      (capacity-begin)%12||capacity-begin>8*12||!gm_valid(begin,capacity-begin))))return false;
  const uint32_t count=(end-begin)/12;
  for(uint32_t at=begin;at<end;at+=12) {
    const uint32_t text=rd32(at),control=rd32(at+4),length=rd32(at+8);
    const uint32_t stride=(control&0x01000000u)?2u:1u;
    if(length>128||(control&0x00ffffffu)<length||!text||!gm_valid(text,(length+1)*stride)||
        rd8(text+length*stride)||(stride==2&&rd8(text+length*stride+1)))return false;
  }
  if(count){X86 extra=*c;extra.r[R_ESP]-=32768;guest_call(&extra,0x004373e0,begin,end);}
  if(rd32(metadata+0x44)!=begin||rd32(metadata+0x48)!=end||rd32(metadata+0x4c)!=capacity)return false;
  // Finish retiring ownership before a boundary check can pump a disconnected
  // peer. A refused read must not leave destructed strings in the live range.
  wr32(metadata+0x48,begin);
  if (rd32(0x0071c68c) || !boundary()) return false;
  std::fprintf(stderr,"[frontier] %s saved names cleared entries=%u original-destroy=004373e0 world-null=1 result=pass\n",scope,count);
  return true;
}
bool session_clear_saved_names(X86 *c, const char *scope) {
  const uint32_t state = rd32(0x006d7670);
  return clear_saved_names_at_boundary(c, scope, [&] {
    return gm_valid(state, 0x50) && rd32(0x006d7670) == state &&
           rd32(state) == 1 && !rd32(state + 4);
  });
}
#ifndef __EMSCRIPTEN__
// An immutable controller binding authorizes this private session's geometry,
// world and registered guild. Only identity scalars survive world disposal.
// There is no retained native graph or growing in-memory region catalogue.
struct HaloSessionBinding {
  bool initialized = false, enabled = false;
  std::string root, digest;
  std::array<std::string, 4> identity;
} halo_session_binding;

bool halo_session_root_valid() {
  const auto &s = halo_session_binding;
  const std::string name = s.root + "/Halo_Session.layout";
  OsStat st{};
  return s.enabled && !os_lstat(s.root.c_str(), &st) && st.is_dir && !st.is_symlink &&
      !os_lstat(name.c_str(), &st) && st.is_regular && !st.is_symlink && st.size && st.size <= 512 &&
      loader_hash_file_bounded(name.c_str(), st.size) == s.digest;
}

bool halo_session_fixture() {
  auto &s = halo_session_binding;
  if (s.initialized) return s.enabled;
  s.initialized = true;
  const char *flag = recomp_env("BROWSER_FRONTIER_HALO_SESSION");
  if (!flag) return false;
  const char *session = recomp_env("RULE_FRONTIER_SESSION"), *profile = recomp_env("PROFILE_DIR");
  const char *binding = recomp_env("BROWSER_FRONTIER_HALO_SESSION_BINDING");
  const char *terrain = recomp_env("BROWSER_FRONTIER_HALO_TERRAIN"), *reload = recomp_env("BROWSER_FRONTIER_HALO_RELOAD");
  const char *restore = recomp_env("RULE_FRONTIER_RESTORE"), *snapshot = recomp_env("BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT");
  const auto &r = region(); const std::string suffix = "/frontier_" + r.key;
  const std::string path(profile ? profile : "");
  if (std::strcmp(flag, "v1") || !session || std::strcmp(session, "v1") ||
      !terrain || std::strcmp(terrain,"v1") || !reload || std::strcmp(reload,"v1") ||
      !restore || std::strcmp(restore,"1") || !snapshot || std::strcmp(snapshot,"1") ||
      !seeded_generation() || !connected_terrain() || recomp_env("RULE_FRONTIER_CHAPTER") ||
      !r.enabled || !binding || !TransferStore::digest(binding) || !path.ends_with(suffix) ||
      path != mods_overlay_profile_dir() || content_identity().size() != 129) std::abort();
  s.root = path.substr(0, path.size() - suffix.size()); s.digest = binding;
  constexpr std::string_view leaf = "/native-world-halo";
  if (!s.root.ends_with(leaf)) std::abort();
  const std::string parent = s.root.substr(0, s.root.size() - leaf.size());
  const auto slash = parent.rfind('/'); const auto begin = slash == parent.npos ? 0 : slash + 1;
  const std::string_view owned(parent.data() + begin, parent.size() - begin);
  constexpr std::string_view prefix = "actor-arrival-fixture-halo-world-session-";
  OsStat st{};
  if (slash == parent.npos || !owned.starts_with(prefix) || owned.size() <= prefix.size() || owned.size() > 80 ||
      os_lstat(parent.c_str(), &st) || !st.is_dir || st.is_symlink) std::abort();
  s.enabled = true;
  if (!halo_session_root_valid()) std::abort();
  const std::string name = s.root + "/Halo_Session.layout";
  if (os_lstat(name.c_str(), &st)) std::abort();
  const int fd = os_fd_open(name.c_str(), OS_O_RDONLY);
  if (fd < 0) std::abort();
  std::array<char, 512> bytes{}; const int64_t used = os_fd_read(fd, bytes.data(), bytes.size());
  const bool closed = !os_fd_close(fd);
  if (!closed || used != int64_t(st.size)) std::abort();
  std::string_view text(bytes.data(), size_t(used)); std::array<std::string_view, 7> lines{};
  for (auto &line : lines) { const auto end = text.find('\n'); if (end == text.npos) std::abort(); line = text.substr(0, end); text.remove_prefix(end + 1); }
  if (!text.empty() || lines[0] != "majesty-halo-session-v1" || lines[1] != "halo-v1" || lines[6] != content_identity()) std::abort();
  for (size_t i = 0; i < s.identity.size(); ++i) {
    if (!TransferStore::digest(lines[i + 2])) std::abort(); s.identity[i] = lines[i + 2];
  }
  std::fprintf(stderr, "[frontier] Halo session admitted layout=halo-v1 root-bound=1 identities=4 retained-worlds=0 result=pass\n");
  return true;
}

std::string halo_session_layout_text(const Region &r, const CheckpointStore::Record &record) {
  std::string text = "majesty-halo-reload-v1\nhalo-v1\n" + r.key + "\n" +
      std::to_string(record.size) + "\n" + record.digest + "\n";
  for (const auto &identity : halo_session_binding.identity) text += identity + "\n";
  return text;
}
bool halo_session_layout_matches(const Region &r, const CheckpointStore::Record &record) {
  if (!halo_session_root_valid()) return false;
  const std::string path = halo_session_binding.root + "/frontier_" + r.key + "/Halo_Restore.layout";
  const std::string expected = halo_session_layout_text(r, record);
  OsStat st{};
  if (expected.size() > 512 || os_lstat(path.c_str(), &st) || !st.is_regular || st.is_symlink || st.size != expected.size()) return false;
  const int fd = os_fd_open(path.c_str(), OS_O_RDONLY); if (fd < 0) return false;
  std::array<char,512> bytes{}; const int64_t used = os_fd_read(fd,bytes.data(),bytes.size());
  const bool closed = !os_fd_close(fd);
  return closed && used == int64_t(expected.size()) && std::string_view(bytes.data(),size_t(used)) == expected;
}

bool halo_session_clear_saved_names(X86 *c) {
  return session_clear_saved_names(c, "Halo session");
}

struct HaloReload {
  bool pending = false, captured = false;
  uint32_t seed = 0, game_seed = 0, saved_clock = 0;
  std::string source_digest;
} halo_reload;

bool halo_reload_enabled() {
  const char *flag = recomp_env("BROWSER_FRONTIER_HALO_RELOAD");
  if(!flag)return false;
  if(std::strcmp(flag,"v1")||!halo_terrain_fixture())std::abort();
  return true;
}

// The owned controller derives this sidecar from a qualified original halo
// save. Bind both files, not just a region key or an identical map dimension.
bool halo_reload_admit(X86 *c,const std::string &name) {
  if(!halo_reload_enabled()||halo_reload.pending||halo_reload.captured)return false;
  const char *profile=recomp_env("PROFILE_DIR"),*binding=recomp_env("BROWSER_FRONTIER_HALO_RESTORE_BINDING");
  const std::string metadata=std::string(profile)+"/Halo_Restore.layout";
  OsStat st{};
  const bool session = halo_session_fixture();
  if(os_lstat(metadata.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>512)return false;
  if (session) {
    if (!halo_session_root_valid() || std::string(profile) != halo_session_binding.root + "/frontier_" + region().key) return false;
  } else if (!binding||!TransferStore::digest(binding)||loader_hash_file_bounded(metadata.c_str(),st.size)!=binding) return false;
  const int fd=os_fd_open(metadata.c_str(),OS_O_RDONLY);if(fd<0)return false;
  std::array<char,512> bytes{};const int64_t used=os_fd_read(fd,bytes.data(),bytes.size());
  const bool closed=os_fd_close(fd)==0;
  if(!closed||used!=int64_t(st.size))return false;
  std::string_view text(bytes.data(),size_t(used));std::array<std::string_view,9> lines{};
  for(auto &line:lines){const auto end=text.find('\n');if(end==text.npos)return false;line=text.substr(0,end);text.remove_prefix(end+1);}
  uint64_t size=0;const auto parsed=std::from_chars(lines[3].data(),lines[3].data()+lines[3].size(),size);
  if(!text.empty()||lines[0]!="majesty-halo-reload-v1"||lines[1]!="halo-v1"||lines[2]!=region().key||
     parsed.ec!=std::errc{}||parsed.ptr!=lines[3].data()+lines[3].size()||!size||size>64*1024*1024||lines[3]!=std::to_string(size))return false;
  for(size_t i=4;i<lines.size();++i)if(!TransferStore::digest(lines[i]))return false;
  if (session) for(size_t i=0;i<halo_session_binding.identity.size();++i)
    if (lines[i+5]!=halo_session_binding.identity[i])return false;
  const std::string source=native_checkpoint_path(c,name);
  if(source.empty()||os_lstat(source.c_str(),&st)||!st.is_regular||st.size!=size||
     loader_hash_file_bounded(source.c_str(),size)!=lines[4])return false;
  if (session) {
    std::string manifest; std::array<std::string,2> paths;
    if (!checkpoint_store(c,region(),manifest,paths)) return false;
    const auto selected=CheckpointStore(manifest,paths,std::string(content_identity())).read();
    if (selected.status!=CheckpointStore::Status::valid || selected.size!=size ||
        selected.digest!=lines[4] || paths[selected.slot]!=source || !halo_session_layout_matches(region(),selected)) return false;
  }
  halo_reload.source_digest=std::string(lines[4]);
  std::fprintf(stderr,"[frontier] Halo restore admitted key=%s layout=halo-v1 bytes=%llu source-sha256=%s metadata-bound=1 result=pass\n",region().key.c_str(),(unsigned long long)size,halo_reload.source_digest.c_str());
  return true;
}

bool halo_reload_terrain(uint32_t context) {
  if(!gm_valid(context,0x84))return false;
  const uint32_t terrain=rd32(context+0x80);
  if(!gm_valid(terrain,0x54)||rd32(terrain)!=0x0068b660u||rd32(terrain+0x30)!=128||
     rd32(terrain+0x34)!=128||rd32(terrain+0x38)!=129||rd32(terrain+0x3c)!=129)return false;
  const uint32_t vertices=rd32(terrain+0x4c);if(!gm_valid(vertices,129u*129u*24u))return false;
  unsigned checked=0;
  for(uint32_t y=0;y<=128;++y)for(uint32_t x=0;x<=128;++x)if(connected_shared_vertex(x,y)) {
    if(rd32(vertices+(y*129+x)*24)!=uint32_t(connected_height(connected_origin(region().x)+x,connected_origin(region().y)+y)))return false;
    ++checked;
  }
  return checked==2480;
}
#else
bool halo_reload_enabled(){return false;}
bool halo_session_fixture(){return false;}
#endif

// A resumed region is not a new player session. Phase 2 rebuilds the UI with
// the original methods, but its blanket deselection and redundant camera
// target binding otherwise discard serialized selection/history/mode. Retain
// these scalars only across those exact initialization calls. Saved exploration
// also remains authoritative while actor visibility is rebuilt. No dormant
// actor/view pointer, saved-file rewrite or comparison normalization is involved.
struct SessionUiRestore {
  uint32_t world = 0, hooks_before = 0, selected = 0, rebound = 0, reveals = 0;
  bool preserve_selection = true;
  std::array<uint32_t, 3> handles{};
  const void *boundary_user = nullptr;
  bool (*boundary_check)(const void *) = nullptr;

  bool owns_world() const {
    const uint32_t active = rd32(0x0071c68c), manager = rd32(0x006d8568);
    return world && gm_valid(world, 0x8c) && rd32(world) == 0x00682950u &&
        gm_valid(active, 8) && rd32(active + 4) == world &&
        gm_valid(manager, 0x21c) && majesty::coop_match_type(manager) &&
        (!boundary_check || boundary_check(boundary_user));
  }

  static void selection(const PopModApi *api, pop_cpu_v1 *cpu,
                        PopHookInvocation *inv, void *opaque) {
    auto &p = *static_cast<SessionUiRestore *>(opaque);
    const uint32_t sp = cpu->esp, self = cpu->ecx;
    bool preserve = false; uint32_t flags = 0;
    if (p.owns_world() && gm_valid(sp, 12) && rd32(sp) == 0x005ba8aau &&
        rd32(sp + 4) == 0 && rd32(sp + 8) == 1 && gm_valid(self, 0x88) &&
        rd32(self + 0x84) == p.world && rd32(self + 0x60) &&
        gm_valid(rd32(self), 0x60) && rd32(rd32(self) + 0x5c) == 0x005b6a80u) {
      flags = rd32(self + 0x64); preserve = p.preserve_selection && (flags & 1) != 0;
      // Keep the original notification argument and method implementation.
      if (preserve) wr32(sp + 4, 1);
    }
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
    if (preserve) {
      if (cpu->esp != sp + 12 || !p.owns_world() || rd32(self + 0x64) != flags)
        std::abort();
      wr32(sp + 4, 0);
      if (p.selected != UINT32_MAX) ++p.selected;
    }
  }

  static void target(const PopModApi *api, pop_cpu_v1 *cpu,
                     PopHookInvocation *inv, void *opaque) {
    auto &p = *static_cast<SessionUiRestore *>(opaque);
    const uint32_t sp = cpu->esp, self = cpu->ecx;
    bool preserve = false; uint32_t id = 0;
    std::array<uint32_t, 4> scalars{};
    std::array<uint8_t, 3> modes{};
    if (p.owns_world() && gm_valid(sp, 8) && rd32(sp) == 0x0043a5cdu &&
        gm_valid(self, 0x54) && rd32(self) == 0x00680df8u &&
        gm_valid(rd32(self + 8), 0x54) &&
        rd32(rd32(self + 8)) == 0x00680e14u) {
      id = rd32(sp + 4);
      preserve = id && id != 0x656e6f6eu && id == rd32(self + 0x1c);
      if (preserve) {
        scalars = {rd32(self + 0x18), rd32(self + 0x20),
                   rd32(self + 0x24), rd32(self + 0x28)};
        modes = {rd8(self + 0x30), rd8(self + 0x31), rd8(self + 0x32)};
      }
    }
    // Delegate to rebuild the original target tree and camera/UI bindings.
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
    if (preserve) {
      if (cpu->esp != sp + 8 || !p.owns_world() || rd32(self + 0x1c) != id)
        std::abort();
      wr32(self + 0x18, scalars[0]); wr32(self + 0x20, scalars[1]);
      wr32(self + 0x24, scalars[2]); wr32(self + 0x28, scalars[3]);
      wr8(self + 0x30, modes[0]); wr8(self + 0x31, modes[1]);
      wr8(self + 0x32, modes[2]);
      if (p.rebound != UINT32_MAX) ++p.rebound;
    }
  }

  static void reveal(const PopModApi *api, pop_cpu_v1 *cpu,
                     PopHookInvocation *inv, void *opaque) {
    auto &p = *static_cast<SessionUiRestore *>(opaque);
    const uint32_t sp = cpu->esp, self = cpu->ecx, unit = cpu->esi;
    uint32_t mask = 0; bool preserve = false;
    if (p.owns_world() && gm_valid(sp, 16) && rd32(sp) == 0x005b64a0u &&
        self == rd32(p.world + 0x80) && gm_valid(self, 0x54) &&
        rd32(self) == 0x0068b660u && rd32(self + 0x38) == 129 &&
        rd32(self + 0x3c) == 129 && gm_valid(unit, 0x88) &&
        rd32(unit + 0x84) == p.world && rd32(unit + 0x60) &&
        gm_valid(rd32(sp + 4), 8)) {
      mask = rd32(sp + 8); preserve = mask != 0;
      // Original 005afe20 with a zero mask leaves exploration and its
      // notification queue unchanged. Unit/spatial visibility initialization
      // outside this one replay call still runs. Ordinary reveal calls resume
      // once these scoped hooks are removed before the first gameplay tick.
      if (preserve) wr32(sp + 8, 0);
    }
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
    if (preserve) {
      if (cpu->esp != sp + 16 || !p.owns_world()) std::abort();
      wr32(sp + 8, mask);
      if (p.reveals != UINT32_MAX) ++p.reveals;
    }
  }

  void begin(uint32_t native_world, const void *user = nullptr,
             bool (*check)(const void *) = nullptr, bool keep_selection = true) {
    if (world || handles[0] || handles[1] || handles[2] || !sched_holds_baton()) std::abort();
    world = native_world; selected = rebound = reveals = 0;
    boundary_user = user; boundary_check = check;
    preserve_selection = keep_selection;
    if (!owns_world()) std::abort();
    hooks_before = mods_hooks_installed_count();
    if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005b6a80u, 0, selection,
          POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, this, &handles[0]) != POP_OK ||
        mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00438ac0u, 0, target,
          POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, this, &handles[1]) != POP_OK ||
        mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005afe20u, 0, reveal,
          POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, this, &handles[2]) != POP_OK)
      std::abort();
  }

  void end() {
    if (!world) return;
    if (!owns_world() || !sched_holds_baton() || mods_hook_depth()) std::abort();
    for (auto &handle : handles) {
      if (!handle || mods_hook_remove(MODS_OWNER_RUNTIME, handle) != POP_OK)
        std::abort();
      handle = 0;
    }
    if (mods_hooks_installed_count() != hooks_before) std::abort();
    std::fprintf(stderr, "[frontier] Session UI restored region=%s selected=%u "
        "rebound=%u reveals=%u removed=3 retained-worlds=0 result=pass\n",
        region().key.c_str(), selected, rebound, reveals);
    world = 0;
    boundary_user = nullptr; boundary_check = nullptr;
    preserve_selection = true;
  }
} session_ui_restore;

// A bounded native-only fixture owns one actual saved context during its
// ordinary attachment/rebuild. No fabricated world, provider or phase writes.
// The production coordinator must later bind this hold to a real relay epoch.
#ifndef __EMSCRIPTEN__
uint32_t session_completed_ticks();
struct CoopRebuildFixture {
  uint32_t stage = 0, load = 0, context = 0, state = 0, manager = 0, world = 0,
           frame = 0, clock = 0, ticks = 0;
  uint32_t tracked_packet = 0, tracked_reference = 0, packet_frees = 0,
           reference_frees = 0;
  uint32_t owner = 7, free_hook = 0, hooks_before = 0, waiting_ticks = 0;
  bool prepared_resume = false;
  static void freed(const PopModApi *api, pop_cpu_v1 *cpu,
                    PopHookInvocation *inv, void *opaque) {
    auto &p = *static_cast<CoopRebuildFixture *>(opaque);
    const uint32_t object = rd32(cpu->esp + 4);
    const bool packet = object && object == p.tracked_packet,
               reference = object && object == p.tracked_reference;
    if (mods_call_next(api, inv, cpu) != POP_OK)
      std::abort();
    if (packet) {
      ++p.packet_frees;
      p.tracked_packet = 0;
    }
    if (reference) {
      ++p.reference_frees;
      p.tracked_reference = 0;
    }
  }
  void arm(uint32_t loaded) {
    const char *flag = recomp_env("BROWSER_COOP_REBUILD_HOLD_FIXTURE");
    if (!flag || (std::strcmp(flag, "v1") && std::strcmp(flag, "v2")))
      return;
    prepared_resume = !std::strcmp(flag, "v2");
    const std::string profile = mods_overlay_profile_dir();
    if (stage || !session_enabled() ||
        profile.find("/actor-arrival-fixture-session-") == profile.npos ||
        profile.find("/native-world-restoration/frontier_") == profile.npos ||
        !gm_valid(loaded, 0x11c) || rd32(loaded) != 0x00682950)
      std::abort();
    context = loaded;
    owner = 7; waiting_ticks = free_hook = 0;
    tracked_packet = tracked_reference = packet_frees = reference_frees = 0;
    stage = 1;
  }
  bool same() const {
    return state == rd32(0x006d7670) && manager == rd32(0x006d8568) &&
           world == rd32(0x0071c68c) && gm_valid(world, 0x18) &&
           rd32(world + 4) == context && rd32(state + 0x28) == frame &&
           rd32(0x0071c6a8) == clock && rd32(manager + 0x218) == 1 &&
           session_completed_ticks() == ticks;
  }
  void log(const char *step) const {
    std::fprintf(
        stderr,
        "[coop-rebuild-fixture] Hold load=%u region=%s step=%s context=%08x "
        "phase=%u pending=%u owner=%u frame=%u clock=%u gameplay-ticks=%u "
        "cpu-same=1 original=1 record-frees=%u,%u hooks-same=1 network=0 "
        "result=pass\n",
        load, region().key.c_str(), step, context, rd32(state), rd32(state + 4),
        rd32(manager + 0x27c), frame, clock, ticks, packet_frees,
        reference_frees);
  }
  void rebuilt(X86 *c) {
    if (!stage)
      return;
    if (stage != 1)
      std::abort();
    state = rd32(0x006d7670);
    manager = rd32(0x006d8568);
    world = rd32(0x0071c68c);
    if (!gm_valid(state, 0x50) || !gm_valid(manager, 0x2b0) ||
        !gm_valid(world, 0x18) || rd32(world + 4) != context ||
        rd32(state) != 2 || rd32(state + 4) != 3 || rd32(manager + 0x218) != 1)
      std::abort();
    frame = rd32(state + 0x28);
    clock = rd32(0x0071c6a8);
    ticks = session_completed_ticks();
    // The prepared sender requires the actual local player. Unlike v1's
    // direct local dispatch, this fixture never changes player identity.
    if (prepared_resume) {
      owner = rd32(manager + 0x8c);
      if (owner == UINT32_MAX || rd32(manager + 0xc8)) std::abort();
    }
    const X86 before = *c;
    // Refusal controls use the actual graph and phase2, without a fake header.
    const auto heap = heap_stats();
    X86 bad = *c;
    bad.r[R_ESP] = STACK_LIMIT + 65535;
    if (majesty::coop_hold_rebuilt_context(nullptr, context, owner) ||
        majesty::coop_hold_rebuilt_context(c, 0, owner) ||
        majesty::coop_hold_rebuilt_context(c, context + 4, owner) ||
        majesty::coop_hold_rebuilt_context(c, context, UINT32_MAX) ||
        majesty::coop_hold_rebuilt_context(&bad, context, owner) || !same() ||
        rd32(state) != 2 || rd32(state + 4) != 3 ||
        std::memcmp(c, &before, sizeof before))
      std::abort();
    const auto after = heap_stats();
    if (heap.used_bytes != after.used_bytes ||
        heap.used_blocks != after.used_blocks ||
        heap.total_allocs != after.total_allocs ||
        heap.total_frees != after.total_frees ||
        !majesty::coop_hold_rebuilt_context(c, context, owner) || !same() ||
        std::memcmp(c, &before, sizeof before))
      std::abort();
    stage = 2;
    log("pending");
  }
  void before_tick(X86 *c) {
    if (!stage)
      return;
    if (prepared_resume && stage >= 4) {
      if (!same() || rd32(state) != 7 || rd32(state + 4) ||
          rd32(manager + 0x27c) != owner || ++waiting_ticks > 120)
        std::abort();
      return;
    }
    if (stage != 2 || !same() || rd32(state) != 7 || rd32(state + 4) ||
        rd32(manager + 0x27c) != owner)
      std::abort();
    const X86 before = *c;
    if (majesty::coop_hold_rebuilt_context(c, context, owner) || !same() ||
        rd32(state) != 7 || rd32(state + 4) ||
        std::memcmp(c, &before, sizeof before))
      std::abort();
    log("settled");
    stage = 3;
  }
  void after_tick(X86 *c) {
    if (!stage)
      return;
    if (prepared_resume && stage >= 4) {
      if (!same() || rd32(state) != 7) std::abort();
      if (!rd32(state + 4) && rd32(manager + 0x27c) == owner) return;
      if (stage != 5 || rd32(state + 4) != 3 ||
          rd32(manager + 0x27c) != UINT32_MAX || tracked_packet ||
          tracked_reference || packet_frees != 1 || reference_frees != 1 ||
          !free_hook || mods_hook_depth() ||
          mods_hook_remove(MODS_OWNER_RUNTIME, free_hook) != POP_OK ||
          mods_hooks_installed_count() != hooks_before || !heap_check().empty())
        std::abort();
      free_hook = 0;
      log("resume-pending");
      stage = 0; context = state = manager = world = 0; ++load;
      return;
    }
    if (stage != 3 || !same() || rd32(state) != 7 || rd32(state + 4) ||
        rd32(manager + 0x27c) != owner)
      std::abort();
    log("paused-tick");
    if (prepared_resume) { stage = 4; return; }
    const X86 before = *c;
    const auto heap = heap_stats();
    const uint32_t pace = rd32(0x006c066c), autosave = rd32(0x006d8548);
    X86 extra = *c;
    extra.r[R_ESP] -= 32768;
    const uint32_t packet = guest_call(&extra, 0x0064c616, 0x28u);
    if (!packet)
      std::abort();
    extra = *c;
    extra.r[R_ESP] -= 32768;
    extra.r[R_ECX] = packet;
    guest_call(&extra, 0x005a38c0);
    wr32(packet + 8, 1);
    wr32(packet + 12, owner);
    wr32(packet + 0x1c, 0);
    wr32(packet + 0x20, pace);
    wr32(packet + 0x24, autosave);
    extra = *c;
    extra.r[R_ESP] -= 32768;
    const uint32_t reference = guest_call(&extra, 0x0064c616, 4u);
    if (!reference)
      std::abort();
    wr32(reference, 1);
    const uint32_t hooks = mods_hooks_installed_count();
    uint32_t observer = 0;
    tracked_packet = packet;
    tracked_reference = reference;
    if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00645bc0u, 0, freed,
                             POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, this,
                             &observer) != POP_OK)
      std::abort();
    extra = *c;
    extra.r[R_ESP] -= 32768;
    extra.r[R_ECX] = manager;
    // Local qualification only. Real co-op resume must use005a4820 to
    // replicate the command after every participant's Loaded vote.
    guest_call(&extra, 0x005a5610, packet, reference);
    if (!observer || mods_hook_remove(MODS_OWNER_RUNTIME, observer) != POP_OK ||
        mods_hooks_installed_count() != hooks || mods_hook_depth() ||
        tracked_packet || tracked_reference || packet_frees != 1 ||
        reference_frees != 1)
      std::abort();
    const auto after = heap_stats();
    if (!same() || rd32(state) != 7 || rd32(state + 4) != 3 ||
        rd32(manager + 0x27c) != UINT32_MAX || rd32(0x006c066c) != pace ||
        rd32(0x006d8548) != autosave ||
        std::memcmp(c, &before, sizeof before) ||
        heap.used_bytes != after.used_bytes ||
        heap.used_blocks != after.used_blocks ||
        // Original CRT pools can reuse suballocations inside a live arena
        // block. The scoped original-free observer verifies both objects;
        // arena counters must balance, rather than inventing two heap calls.
        after.total_allocs - heap.total_allocs !=
            after.total_frees - heap.total_frees ||
        !heap_check().empty()) {
      std::fprintf(
          stderr,
          "[coop-rebuild-fixture] Resume refusal same=%u phase=%u pending=%u "
          "owner=%u pace=%u/%u autosave=%u/%u cpu=%u heap=%llu/%llu "
          "blocks=%u/%u allocs=%llu frees=%llu packet-live=%u ref-live=%u\n",
          unsigned(same()), rd32(state), rd32(state + 4), rd32(manager + 0x27c),
          rd32(0x006c066c), pace, rd32(0x006d8548), autosave,
          unsigned(!std::memcmp(c, &before, sizeof before)),
          (unsigned long long)after.used_bytes,
          (unsigned long long)heap.used_bytes, after.used_blocks,
          heap.used_blocks,
          (unsigned long long)(after.total_allocs - heap.total_allocs),
          (unsigned long long)(after.total_frees - heap.total_frees),
          unsigned(heap_owns(packet)), unsigned(heap_owns(reference)));
      std::abort();
    }
    log("resume-pending");
    stage = 0;
    context = state = manager = world = 0;
    ++load;
  }
  void input(X86 *c) {
    if (!prepared_resume || stage != 4 || !c || !sched_holds_baton() ||
        mods_hook_depth() || !gm_valid(c->r[R_ESP], 4) ||
        rd32(c->r[R_ESP]) != 0x004179a9u || c->r[R_ECX] != state) return;
    if (!same() || rd32(state) != 7 || rd32(state + 4) ||
        rd32(manager + 0x27c) != owner || rd32(manager + 0x8c) != owner)
      std::abort();
    const X86 before = *c;
    if (!majesty::enqueue_coop_resume(c, owner) ||
        std::memcmp(c, &before, sizeof before)) std::abort();
    const uint32_t batch = rd32(manager + 0x44),
                   deque = gm_valid(batch, 0x1c) ? rd32(batch + 8) : 0,
                   first = gm_valid(deque, 0x30) ? rd32(deque + 0xc) : 0;
    if (!gm_valid(first, 8) || rd32(deque + 0x2c) != 1) std::abort();
    tracked_packet = rd32(first); tracked_reference = rd32(first + 4);
    if (!gm_valid(tracked_packet, 0x28) || !gm_valid(tracked_reference, 4) ||
        rd32(tracked_packet + 8) != 1 || rd32(tracked_packet + 12) != owner)
      std::abort();
    hooks_before = mods_hooks_installed_count();
    if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00645bc0u, 0, freed,
          POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, this, &free_hook) != POP_OK)
      std::abort();
    stage = 5;
    std::fprintf(stderr, "[coop-rebuild-fixture] Prepared load=%u region=%s "
        "owner=%u local=%u input-return=004179a9 frame=%u clock=%u "
        "world=%08x queued=1 direct-dispatch=0 network=0 result=pass\n",
        load, region().key.c_str(), owner, rd32(manager + 0x8c), frame, clock, world);
  }
} coop_rebuild_fixture;
#endif
// This opt-in qualification uses the real reader's unattached graph, never an
// empty/fabricated context. Party/provider fields are explicit fixture metadata
// and are restored before ordinary attachment; no network pause is claimed.
void loaded_kingdom_binding_fixture(X86 *c, uint32_t context) {
  const char *flag = recomp_env("BROWSER_COOP_LOADED_BINDING_FIXTURE");
  if (!flag || std::strcmp(flag, "v1"))
    return;
  const std::string profile = mods_overlay_profile_dir();
  const uint32_t state = rd32(0x006d7670), manager = rd32(0x006d8568),
                 settings = rd32(0x006d87a0), world = rd32(0x0071c68c);
  if (!c || !sched_holds_baton() || mods_hook_depth() ||
      profile.find("/actor-arrival-fixture-session-") == profile.npos ||
      profile.find("/native-world-restoration/frontier_") == profile.npos ||
      !gm_valid(state, 0x50) || !gm_valid(manager, 0x2b0) ||
      !gm_valid(settings, 0x4f8) || !gm_valid(context, 0x11c) ||
      rd32(context) != 0x00682950 || rd32(rd32(context) + 0x20) != 0x005bbaf0 ||
      rd32(state) != 1 || rd32(state + 4) || world ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
    std::abort();
  std::array<uint8_t, 0x198> metadata{};
  std::array<uint8_t, 0x11c> graph_header{};
  std::memcpy(metadata.data(), g_mem + settings + 0x344, metadata.size());
  std::memcpy(graph_header.data(), g_mem + context, graph_header.size());
  const uint32_t phase = rd32(state), pending = rd32(state + 4),
                 local_slot = rd32(state + 0x24),
                 local_id = rd32(manager + 0x8c), mode = rd32(manager + 0x218),
                 selected = rd32(context + 0x24), clock = rd32(0x0071c6a8),
                 hooks = mods_hooks_installed_count();
  const X86 cpu = *c;
  const auto before = heap_stats();
  for (uint32_t local = 0; local < 2; ++local) {
    recomp_network_session_v1 expected{local == 0, 7 + local, 2, {7, 8, 0, 0}};
    wr32(state, 7); // Fixture boundary only; never enters the original loop.
    wr32(state + 4, 0);
    wr32(state + 0x24, local);
    wr32(manager + 0x8c, 7 + local);
    wr32(manager + 0x218, 2);
    wr32(settings + 0x344, 7);
    wr32(settings + 0x348, 8);
    wr32(settings + 0x34c, UINT32_MAX);
    wr32(settings + 0x350, UINT32_MAX);
    wr32(settings + 0x4d4, 2);
    std::array<uint8_t, 0x198> live{};
    std::memcpy(live.data(), g_mem + settings + 0x344, live.size());
    majesty::CoopLiveParty party;
    if (!party.capture(expected))
      std::abort();
    // Model the saved host's stale lobby fields, while keeping all graph
    // objects, original roots and caller-owned context unchanged.
    std::memset(g_mem + settings + 0x344, 0x55, live.size());
    if (!party.restore(expected) ||
        std::memcmp(live.data(), g_mem + settings + 0x344, live.size()) ||
        !majesty::coop_select_loaded_context(c, context, party.binding()) ||
        rd32(context + 0x24) != local)
      std::abort();
    auto wrong = party.binding();
    wrong.player += 100;
    if (majesty::coop_select_loaded_context(c, context, wrong) ||
        rd32(context + 0x24) != local)
      std::abort();
  }
  X86 extra = *c;
  extra.r[R_ESP] -= 32768;
  extra.r[R_ECX] = context;
  guest_call(&extra, 0x005bbaf0, selected);
  std::memcpy(g_mem + settings + 0x344, metadata.data(), metadata.size());
  wr32(state, phase);
  wr32(state + 4, pending);
  wr32(state + 0x24, local_slot);
  wr32(manager + 0x8c, local_id);
  wr32(manager + 0x218, mode);
  const auto after = heap_stats();
  if (rd32(0x006d7670) != state || rd32(0x006d8568) != manager ||
      rd32(0x006d87a0) != settings || rd32(0x0071c68c) != world ||
      rd32(0x0071c6a8) != clock ||
      std::memcmp(metadata.data(), g_mem + settings + 0x344, metadata.size()) ||
      std::memcmp(graph_header.data(), g_mem + context, graph_header.size()) ||
      std::memcmp(&cpu, c, sizeof cpu) ||
      hooks != mods_hooks_installed_count() ||
      before.used_bytes != after.used_bytes ||
      before.used_blocks != after.used_blocks ||
      before.total_allocs != after.total_allocs ||
      before.total_frees != after.total_frees || !heap_check().empty() ||
      mods_hook_depth() || recomp_callback_depth())
    std::abort();
  static uint32_t load = 0;
  std::fprintf(
      stderr,
      "[coop-read-fixture] Loaded binding load=%u region=%s context=%08x "
      "slots=0,1 ids=7,8 graph-restored=1 party-restored=1 cpu-same=1 "
      "heap-same=1 hooks-same=1 network=0 result=pass\n",
      load++, region().key.c_str(), context);
}

bool restore_checkpoint(X86 *c, const std::string &checkpoint_name,
                        uint32_t state) {
  if(!selected_hero_source(c,checkpoint_name))return false;
#ifndef __EMSCRIPTEN__
  // Every load, including a session revisit/fallback, receives the same layout,
  // selected-slot and saved-RNG admission before the original reader runs.
  if (halo_reload_enabled()) {
    const auto path = native_checkpoint_path(c, checkpoint_name);
    if (!halo_reload_admit(c, checkpoint_name) ||
        !session_saved_rng(path, halo_reload.seed, halo_reload.game_seed, &halo_reload.saved_clock)) {
      halo_reload = {}; return false;
    }
    if (halo_session_fixture() && !halo_session_clear_saved_names(c)) return false;
  }
#endif
  // Mirror the front-end Load Game lifecycle at 00463c44..00463c7d and
  // 0044abcc..0044ac03. The serializer's +0x40 resolves the checkpoint
  // by its native name and rebuilds the complete serialized object graph.
  X86 extra = *c;
  const uint32_t settings = guest_call(&extra, 0x004ba7e0);
  extra = *c;
  const uint32_t manager = guest_call(&extra, 0x00497990);
  extra = *c;
  const uint32_t renderer = guest_call(&extra, 0x004401c0);
  if (!settings || !manager || !renderer || !gm_valid(settings, 0x70) ||
      !gm_valid(manager, 0x21c) || !gm_valid(renderer, 4) ||
      rd32(manager + 0x218) == 2 || rd32(0x0071c68c))
    return false;
  const uint32_t renderer_vtable = rd32(renderer);
  if (!gm_valid(renderer_vtable, 0x48))
    return false;
  const uint32_t buffer = heap_alloc(uint32_t(checkpoint_name.size() + 1));
  const uint32_t name = heap_alloc(12, true);
  const uint32_t output = heap_alloc(4, true);
  if (!buffer || !name || !output) {
    if (buffer)
      heap_free(buffer);
    if (name)
      heap_free(name);
    if (output)
      heap_free(output);
    return false;
  }
  for (size_t i = 0; i <= checkpoint_name.size(); ++i)
    wr8(buffer + uint32_t(i), uint8_t(checkpoint_name.c_str()[i]));
  extra = *c;
  extra.r[R_ECX] = name;
  guest_call(&extra, 0x004e3590, buffer, uint32_t(checkpoint_name.size()));
  const uint32_t previous_loading = rd32(settings + 0x6c);
  wr32(settings + 0x6c, 1);
  extra = *c;
  const uint32_t loading = guest_call(&extra, 0x00623b20);
  extra = *c;
  extra.r[R_ECX] = loading;
  guest_call(&extra, 0x00623a70);
  extra = *c;
  extra.r[R_ECX] = renderer;
  guest_call(&extra, rd32(renderer_vtable + 0x44));
  extra = *c;
  const uint32_t serializer = guest_call(&extra, 0x00435d00);
  uint32_t result = 2;
  if (serializer && gm_valid(serializer, 12) &&
      rd32(serializer) == 0x00680c60) {
    extra = *c;
    extra.r[R_ECX] = serializer;
    result = guest_call(&extra, 0x00435940, name, output);
  }
  const uint32_t context = rd32(output);
  if (result == 0 && context && gm_valid(context, 4) &&
      !restore_saved_configuration(c, context)) {
    // A complete graph read may still fail configuration admission. It has
    // not been attached to the manager: release that owned graph before the
    // caller considers recovery, rather than retaining a second world.
    if (rd32(0x0071c68c) || !gm_valid(context, 0x11c) ||
        rd32(context) != 0x00682950u) std::abort();
    extra = *c; extra.r[R_ECX] = context;
    guest_call(&extra, 0x004913d0, 1u);
    result = 2;
    std::fprintf(stderr, "[frontier] Saved configuration refused owned-context-released=1 result=refused\n");
  }
  const bool restored = result == 0 && context && gm_valid(context, 4);
  if (restored) {
    loaded_kingdom_binding_fixture(c, context);
#ifndef __EMSCRIPTEN__
    coop_rebuild_fixture.arm(context);
#endif
    extra = *c;
    extra.r[R_ECX] = manager;
    guest_call(&extra, rd32(rd32(manager) + 0x20), context);
  } else {
    wr32(settings + 0x6c, previous_loading);
  }
  extra = *c;
  extra.r[R_ECX] = renderer;
  guest_call(&extra, rd32(renderer_vtable + 0x40));
  extra = *c;
  extra.r[R_ECX] = name;
  guest_call(&extra, 0x004e3820);
  heap_free(output);
  heap_free(name);
  heap_free(buffer);
  if (!restored) {
#ifndef __EMSCRIPTEN__
    if (halo_reload_enabled()) halo_reload = {};
#endif
    return false;
  }
  // A menu-free boot has not received pointer input yet. The Win32 model's
  // initial (0,0) triggers Majesty's edge scroll and immediately loses the
  // restored camera. Seed only the emulated client pointer, not the physical
  // mouse; subsequent real input continues through the normal host path.
  const int width = int(rd32(0x006cce10));
  const int height = int(rd32(0x006cce14));
  const uint32_t window = host_main_window();
  if (window && width >= 800 && width <= 8192 && height >= 600 &&
      height <= 8192)
    host_set_client_cursor_pos(window, width / 2, height / 2);
  // 00415f30 attaches the loaded context and queues phase 2; 00416c30
  // then rebuilds the normal gameplay interfaces and enters phase 3.
  extra = *c;
  extra.r[R_ECX] = state;
  guest_call(&extra, 0x00415f30, context, 0u);
  wr32(manager + 0x218, 1);
  const uint32_t active = rd32(0x0071c68c);
  if (active && gm_valid(active,8)) connected_boundary_policy.bind(rd32(active + 4));
  if (session_enabled() || halo_reload_enabled() || (selected_hero_binding().enabled&&!selected_hero_binding().admitted)) {
    if (!active || !gm_valid(active, 8)) std::abort();
    session_ui_restore.begin(rd32(active + 4));
  }
#ifndef __EMSCRIPTEN__
  if (halo_reload_enabled()) halo_reload.pending = true;
#endif
  return true;
}

bool write_context_checkpoint(X86 *c, const std::string &checkpoint_name,
                              uint32_t context) {
  const uint32_t buffer = heap_alloc(uint32_t(checkpoint_name.size() + 1));
  const uint32_t name = heap_alloc(12, true);
  if (!buffer || !name) {
    if (buffer)
      heap_free(buffer);
    if (name)
      heap_free(name);
    return false;
  }
  for (size_t i = 0; i <= checkpoint_name.size(); ++i)
    wr8(buffer + uint32_t(i), uint8_t(checkpoint_name.c_str()[i]));
  X86 extra = *c;
  extra.r[R_ECX] = name;
  // CYString's length-qualified ANSI constructor, verified 004e3590.
  guest_call(&extra, 0x004e3590, buffer, uint32_t(checkpoint_name.size()));
  extra = *c;
  const uint32_t serializer = guest_call(&extra, 0x00435d00);
  bool saved = false;
  if (serializer && gm_valid(serializer, 12)) {
    // 0049ca80 uses this exact save wrapper with world+4. The pinned
    // 00680c60 vtable's +0x44 slot is 004359c0, which formats the path,
    // writes the whole native world, and returns the original save result.
    extra = *c;
    extra.r[R_ECX] = serializer;
    saved = (guest_call(&extra, 0x004359c0, name, context) & 0xff) != 0;
  }
  extra = *c;
  extra.r[R_ECX] = name;
  guest_call(&extra, 0x004e3820);
  heap_free(name);
  heap_free(buffer);
  return saved;
}
bool write_checkpoint(X86 *c, const std::string &checkpoint_name,
                      uint32_t world) {
  return write_context_checkpoint(c, checkpoint_name, rd32(world + 4));
}
#ifndef __EMSCRIPTEN__
void native_coop_readback(X86 *, const recomp_network_session_v1 &,
                         majesty::CoopPauseBoundary);
struct NativeCoopReadbackRequest {
  bool armed = false;
  uint64_t epoch = 0;
  uint32_t world = 0;
  recomp_network_session_v1 party{};
  majesty::CoopPauseBoundary paused{};
};
NativeCoopReadbackRequest native_coop_readback_request;
bool native_coop_phase2_before_tick(X86 *);
bool native_coop_readback_before_tick(X86 *c) {
  if (native_coop_phase2_before_tick(c)) {
    if (!majesty::coop_complete_outer_tick(c)) std::abort();
    return true;
  }
  auto &request = native_coop_readback_request;
  if (!request.armed) return false;
  if (!c || !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      rd32(c->r[R_ESP]) != 0x00415e88u ||
      recomp_network_session_epoch() != request.epoch ||
      rd32(0x0071c68c) != request.world) std::abort();
  request.armed = false;
  std::fprintf(stderr, "[coop-read-fixture] Deferred read entered outer-tick return=00415e88 renderer-call-active=0\n");
  native_coop_readback(c, request.party, request.paused);
  // Complete the original plain RET after requesting its phase6 exit. The
  // dispatcher must consume that request before any next frame/render body.
  if (!majesty::coop_complete_outer_tick(c)) std::abort();
  return true;
}
// Serial original-engine initialization tests must start the same match.
// Set only the owned host's scenario seed before its original GameStart
// serializer. The serializer, receiver, world builder and votes remain original.
// This native fixture is absent from browser builds and grants no shared resume.
struct NativeCoopInitializationSeed {
  uint32_t seed = 0, handle = 0;
  bool consumed = false;
  std::string profile;
  static void start(const PopModApi *api, pop_cpu_v1 *cpu,
                    PopHookInvocation *inv, void *opaque) {
    auto &fixture = *static_cast<NativeCoopInitializationSeed *>(opaque);
    const uint32_t settings = rd32(0x006d87a0), state = rd32(0x006d7670);
    const uint64_t epoch = recomp_network_session_epoch();
    recomp_network_session_v1 party{};
    const bool network = epoch && recomp_network_session_info(epoch, &party);
    const bool settings_valid = gm_valid(settings, 0x4f8);
    if (fixture.consumed || !network || !party.host ||
        party.local_player != 1 || party.player_count != 2 ||
        party.players[0] != 1 || party.players[1] != 2 ||
        mods_overlay_profile_dir() != fixture.profile || rd32(0x0071c68c) ||
        !gm_valid(state, 0x50) || !settings_valid ||
        rd32(settings + 0x320) != 2 ||
        rd32(settings + 0x344) != 1 || rd32(settings + 0x348) != 2) {
      std::fprintf(stderr, "[coop-init-fixture] Admission refused network=%u host=%u local=%u count=%u ids=%u,%u world=%08x state-valid=%u settings-valid=%u settings-4e0=%u settings-count=%u settings-ids=%u,%u profile-same=%u consumed=%u\n",
          unsigned(network), party.host, party.local_player, party.player_count,
          party.players[0], party.players[1], rd32(0x0071c68c),
          unsigned(gm_valid(state, 0x50)), unsigned(settings_valid),
          settings_valid ? rd32(settings + 0x4e0) : 0,
          settings_valid ? rd32(settings + 0x320) : 0,
          settings_valid ? rd32(settings + 0x344) : 0,
          settings_valid ? rd32(settings + 0x348) : 0,
          unsigned(mods_overlay_profile_dir() == fixture.profile), unsigned(fixture.consumed));
      std::abort();
    }
    const uint32_t previous = rd32(settings + 0x144);
    wr32(settings + 0x144, fixture.seed);
    fixture.consumed = true;
    std::fprintf(stderr, "[coop-init-fixture] Original host seed configured seed=%u previous=%u epoch=%llu phase=%u settings-offset=144 before-GameStart=1 live-second-engine=0\n",
        fixture.seed, previous, (unsigned long long)epoch, rd32(state));
    if (mods_call_next(api, inv, cpu) != POP_OK ||
        recomp_network_session_epoch() != epoch ||
        rd32(0x006d87a0) != settings || rd32(settings + 0x144) != fixture.seed)
      std::abort();
  }
  void install() {
    const char *raw = recomp_env("NATIVE_COOP_INITIAL_SEED");
    if (!raw || handle) return;
    const size_t length = strnlen(raw, 12);
    const auto parsed = std::from_chars(raw, raw + length, seed);
    profile = mods_overlay_profile_dir();
    if (!length || length > 10 || parsed.ec != std::errc{} ||
        parsed.ptr != raw + length || !seed || seed > 0x7fffffffu ||
        profile.find("/output/native-multiplayer-lobby-") == profile.npos ||
        !profile.ends_with("/owned-profile") ||
        mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00452b50u, 0, start,
            POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, this, &handle) != POP_OK)
      std::abort();
  }
} native_coop_initialization_seed;

extern "C" bool majesty_browser_native_coop_pause_requested(uint64_t, uint32_t, uint32_t);
struct NativeCoopPauseRequest {
  bool armed = false, queued = false;
  uint64_t epoch = 0;
  uint32_t world = 0, state = 0, manager = 0, settings = 0, slot = 0;
  recomp_network_session_v1 party{};
  std::string profile;
  void input(X86 *c) {
    if (!armed || queued || !c || !sched_holds_baton() || mods_hook_depth() ||
        !gm_valid(c->r[R_ESP], 4) || rd32(c->r[R_ESP]) != 0x004179a9u ||
        c->r[R_ECX] != state) return;
    recomp_network_session_v1 now{};
    majesty::CoopPlayerBinding selected;
    if (recomp_network_session_epoch() != epoch ||
        !recomp_network_session_info(epoch, &now) ||
        std::memcmp(&now, &party, sizeof party) || !party.host ||
        mods_overlay_profile_dir() != profile || rd32(0x0071c68c) != world ||
        rd32(0x006d7670) != state || rd32(0x006d8568) != manager ||
        rd32(0x006d87a0) != settings || rd32(state) != 3 || rd32(state + 4) ||
        rd32(state + 0x28) > 10 || rd32(0x0071c6a8) > 500 ||
        !majesty::coop_player_binding(now, selected) || selected.slot != slot)
    {
      std::fprintf(stderr, "[coop-pause-fixture] Input admission refused epoch-same=%u party-same=%u host=%u profile-same=%u world-same=%u state-same=%u manager-same=%u settings-same=%u phase=%u pending=%u frame=%u clock=%u slot=%u expected-slot=%u\n",
          unsigned(recomp_network_session_epoch() == epoch), unsigned(!std::memcmp(&now, &party, sizeof party)), party.host,
          unsigned(mods_overlay_profile_dir() == profile), unsigned(rd32(0x0071c68c) == world),
          unsigned(rd32(0x006d7670) == state), unsigned(rd32(0x006d8568) == manager), unsigned(rd32(0x006d87a0) == settings),
          rd32(state), rd32(state + 4), rd32(state + 0x28), rd32(0x0071c6a8), selected.slot, slot);
      std::abort();
    }
    const X86 before = *c;
    if (!majesty_browser_native_coop_pause_requested(epoch, world, party.local_player) ||
        std::memcmp(c, &before, sizeof before)) {
      std::fprintf(stderr, "[coop-pause-fixture] Prepared pause refused phase=%u pending=%u frame=%u clock=%u queue=%08x mode=%u input-return=004179a9\n",
          rd32(state), rd32(state + 4), rd32(state + 0x28), rd32(0x0071c6a8),
          rd32(manager + 0x34), rd32(manager + 0x218));
      std::abort();
    }
    queued = true;
    std::fprintf(stderr, "[coop-pause-fixture] Original pause queued epoch=%llu local=%u slot=%u frame=%u clock=%u original-control=005a38c0 original-sender=005a46a0 input-return=004179a9 phase-unmodified=1 production-action=1\n",
        (unsigned long long)epoch, party.local_player, slot, rd32(state + 0x28), rd32(0x0071c6a8));
  }
} native_coop_pause_request;

// One actual original host or guest, replayed initialization only. Capture complete
// original worlds at tick boundaries without manufacturing a second engine,
// frame packets, player records or gameplay commands.
void native_coop_world_snapshot(X86 *c) {
  static unsigned stage = 0;
  struct IncomingSource {
    uint64_t epoch = 0;
    uint32_t world = 0, context = 0, state = 0, manager = 0, settings = 0;
    recomp_network_session_v1 party{};
    std::string profile;
  };
  static IncomingSource incoming_source;
  const char *flag = recomp_env("NATIVE_COOP_WORLD_SNAPSHOT");
  const char *pause_flag = recomp_env("NATIVE_COOP_WORLD_PAUSE");
  const char *incoming_flag = recomp_env("NATIVE_COOP_WORLD_INCOMING_PAUSE");
  const bool local_pause = pause_flag && !std::strcmp(pause_flag, "v1");
  const bool incoming_pause = incoming_flag && !std::strcmp(incoming_flag, "v1");
  const bool pause = local_pause || incoming_pause;
  if ((pause_flag && !local_pause) || (incoming_flag && !incoming_pause) ||
      (local_pause && incoming_pause)) std::abort();
  if (!flag || std::strcmp(flag, "v1") || stage == 2)
    return;
  const std::string profile = mods_overlay_profile_dir();
  if (profile.find("/output/native-multiplayer-lobby-") == profile.npos ||
      !profile.ends_with("/owned-profile") || !c || saving ||
      !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
    std::abort();
  const uint32_t state = rd32(0x006d7670), world = rd32(0x0071c68c),
                 settings = rd32(0x006d87a0), manager = rd32(0x006d8568);
  if (!gm_valid(state, 0x50) ||
      rd32(state) != (pause && stage == 1 ? 7u : 3u) || rd32(state + 4) ||
      !gm_valid(world, 0x18) || !gm_valid(settings, 0x4f8) ||
      !gm_valid(manager, 0x2b0))
    return;
  const uint32_t context = rd32(world + 4), registry = rd32(world + 0x10),
                 clock = rd32(0x0071c6a8), frame = rd32(state + 0x28);
  if (!gm_valid(context, 0x84) || !gm_valid(registry, 0x118))
    std::abort();
  if (stage == 1 && clock < 500)
    return;
  recomp_network_session_v1 party{};
  const uint64_t epoch = recomp_network_session_epoch();
  majesty::CoopPlayerBinding binding;
  if (!epoch || !recomp_network_session_info(epoch, &party) ||
      party.player_count != 2 || party.local_player != (party.host ? 1u : 2u) ||
      party.players[0] != 1 || party.players[1] != 2 ||
      !majesty::coop_player_binding(party, binding) ||
      binding.slot != (party.host ? 0u : 1u) ||
      (stage == 0 && clock != 0))
    std::abort();
  const uint32_t phase = rd32(state);
  majesty::CoopPauseBoundary paused{};
  if (incoming_pause && (party.host || party.local_player != 2 ||
      rd32(world) != 0x0067f85c || context != registry ||
      rd32(context) != 0x00682950 || rd32(manager + 0xc0) != context ||
      rd32(context + 0x24) != binding.slot)) std::abort();
  if (incoming_pause && stage == 0)
    incoming_source = {epoch, world, context, state, manager, settings, party, profile};
  if (phase == 7 && (
      (local_pause && (!party.host || !native_coop_pause_request.queued)) ||
      !majesty::coop_pause_boundary(incoming_pause ? 1u : party.local_player, paused) ||
      paused.frame != frame || paused.clock != clock)) std::abort();
  if (incoming_pause && stage == 1 &&
      (incoming_source.epoch != epoch || incoming_source.world != world ||
       incoming_source.context != context || incoming_source.state != state ||
       incoming_source.manager != manager || incoming_source.settings != settings ||
       incoming_source.profile != profile ||
       std::memcmp(&incoming_source.party, &party, sizeof party) ||
       paused.owner != 1 || frame != 11 || clock != 550)) std::abort();
  const auto unchanged = [&] {
    recomp_network_session_v1 now{};
    majesty::CoopPlayerBinding selected;
    return recomp_network_session_epoch() == epoch &&
           recomp_network_session_info(epoch, &now) &&
           !std::memcmp(&party, &now, sizeof party) &&
           majesty::coop_player_binding(now, selected) &&
           selected.slot == binding.slot && selected.player == binding.player &&
           rd32(0x006d7670) == state && rd32(state) == phase && !rd32(state + 4) &&
           rd32(state + 0x28) == frame && rd32(0x0071c6a8) == clock &&
           rd32(0x0071c68c) == world && rd32(world + 4) == context &&
           rd32(world + 0x10) == registry && rd32(0x006d87a0) == settings &&
           rd32(0x006d8568) == manager && mods_overlay_profile_dir() == profile;
  };
  X86 scratch = *c;
  scratch.r[R_ESP] -= 32768;
  const char *label = stage ? "Coop_World_Progress" : "Coop_World_Ready";
  const std::string path = native_checkpoint_path(&scratch, label);
  if (!path.starts_with(profile + "/") || !path.ends_with(std::string(label) + ".GMP") ||
      !unchanged())
    std::abort();
  saving = true;
  const bool saved = majesty::coop_preserve_save_name(
      &scratch, [&] { return write_checkpoint(&scratch, label, world); });
  saving = false;
  if (!saved || !unchanged())
    std::abort();
  unsigned kingdoms = 0;
  for (uint32_t slot = 0; slot < 4; ++slot) {
    const uint32_t player_id = rd32(settings + 0x344 + slot * 4);
    if (player_id == UINT32_MAX)
      continue;
    X86 extra = scratch;
    extra.r[R_ECX] = registry;
    const uint32_t player = guest_call(&extra, rd32(rd32(registry) + 0x18), slot);
    if (!gm_valid(player, 4) || !gm_valid(rd32(player), 0x24))
      std::abort();
    extra = scratch;
    extra.r[R_ECX] = player;
    const int32_t gold = int32_t(guest_call(&extra, rd32(rd32(player) + 0x20), 0x00505041));
    std::fprintf(stderr, "[coop-world-fixture] Kingdom stage=%u slot=%u network-player=%u gold=%d original-getter=1\n",
                 stage, slot, player_id, gold);
    ++kingdoms;
  }
  if (kingdoms != 2 || !unchanged())
    std::abort();
  std::fprintf(stderr, "[coop-world-fixture] Snapshot stage=%u label=%s epoch=%llu local=%u slot=%u frame=%u clock=%u kingdoms=%u original-writer=1 before-tick=1 live-second-engine=0\n",
               stage, label, (unsigned long long)epoch, party.local_player,
               binding.slot, frame, clock, kingdoms);
  if (phase == 7)
    std::fprintf(stderr, "[coop-pause-fixture] Settled original pause epoch=%llu local=%u slot=%u owner=%u frame=%u clock=%u phase=7 pending=0 live-second-engine=0\n",
        (unsigned long long)epoch, party.local_player, binding.slot, paused.owner, frame, clock);
  if (incoming_pause && phase == 7)
    std::fprintf(stderr, "[coop-incoming-pause-fixture] Settled original host command epoch=%llu local=2 slot=1 owner=1 frame=11 clock=550 phase=7 pending=0 source-party-same=1 context-bound=1 local-pause-queued=0 live-second-engine=0\n",
        (unsigned long long)epoch);
  ++stage;
  if (stage == 2 && recomp_env("NATIVE_COOP_WORLD_BEGIN_FRESH")) {
    if (!local_pause || incoming_pause || phase != 7 ||
        recomp_env("NATIVE_COOP_WORLD_READBACK") || !unchanged()) std::abort();
    native_coop_begin_fresh_neighbor(c);
    if (!unchanged()) std::abort();
  }
  const char *readback = recomp_env("NATIVE_COOP_WORLD_READBACK");
  if (readback && std::strcmp(readback, "v1") && std::strcmp(readback, "v2") &&
      std::strcmp(readback, "v3")) std::abort();
  if (readback && stage == 2) {
    if (!pause || phase != 7 || !unchanged()) std::abort();
    auto &request = native_coop_readback_request;
    if (request.armed) std::abort();
    request = {true, epoch, world, party, paused};
    std::fprintf(stderr, "[coop-read-fixture] Read deferred until outer original tick\n");
  }
  if (local_pause && stage == 1) {
    auto &request = native_coop_pause_request;
    if (!party.host || request.armed || frame || clock || !unchanged()) std::abort();
    request.armed = true; request.epoch = epoch; request.world = world;
    request.state = state; request.manager = manager; request.settings = settings;
    request.slot = binding.slot; request.party = party; request.profile = profile;
    const char *production_pause = recomp_env("RULE_COOP_TRANSITION_PAUSE");
    if (!production_pause || std::strcmp(production_pause, "v1") ||
        !os_native_request_action("coop-transition-pause")) std::abort();
    std::fprintf(stderr, "[coop-pause-fixture] Production pause action armed epoch=%llu local=%u slot=%u original-actions=1\n",
        (unsigned long long)epoch, party.local_player, binding.slot);
  }
}
#endif
// Paused engines keep rendering but do not enter the simulation tick adapter.
// Sample after the original frame returns, with the scheduler baton retained.
#ifndef __EMSCRIPTEN__
extern "C" void majesty_browser_native_coop_pause_poll(X86 *c) {
  if (recomp_env("NATIVE_COOP_WORLD_PAUSE") ||
      recomp_env("NATIVE_COOP_WORLD_INCOMING_PAUSE")) native_coop_world_snapshot(c);
  native_coop_target_snapshot(c);
  native_coop_saved_return_snapshot(c);
  native_coop_later_target_snapshot(c);
  // The final available original input can leave a running world waiting
  // without another simulation tick. The frame-return hook already owns the
  // scheduler baton; use the same original-writer and unchanged-state guard.
  if (recomp_env("NATIVE_COOP_WORLD_TARGET_LATER_PROGRESS"))
    native_coop_target_progress_snapshot(c, true);
}
#endif
extern "C" bool
majesty_browser_coop_checkpoint(X86 *c, uint64_t epoch, uint32_t owner,
                                const majesty::CoopCheckpointIdentity &identity,
                                const recomp_network_session_v1 &expected,
                                majesty::CoopCheckpointStore::Record &out) {
  out = {};
  const char *enabled = recomp_env("RULE_COOP_CHECKPOINT");
  if (!enabled || std::strcmp(enabled, "v1") || !c || !epoch ||
      !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      !majesty::CoopCheckpointStore::valid_identity(identity) ||
      expected.host > 1 || expected.player_count < 2 ||
      expected.player_count > 4 ||
      bool(expected.host) != (owner == expected.local_player) ||
      !std::binary_search(expected.players, expected.players + expected.player_count, owner))
    return false;
  const char *manifest = recomp_env("NETWORK_MANIFEST");
  const std::string_view network(manifest ? manifest : "");
  const auto content = content_identity();
  if (content.size() != 129 || network.size() != 194 || network[64] != ':' ||
      network[129] != ':' || content.substr(0, 64) != loader_exe_sha256() ||
      !majesty::coop_detail::digest(network.substr(0, 64)) ||
      network.substr(65, 64) != content.substr(0, 64) ||
      majesty::coop_detail::text(identity.content) != content ||
      majesty::coop_detail::text(identity.rules) != network.substr(130))
    return false;
  const uint32_t world = rd32(0x0071c68c), session = rd32(0x006d87a0);
  if (!world || !gm_valid(world, 0x18) || !session || !gm_valid(session, 0x4f8))
    return false;
  const uint32_t data = rd32(world + 4), registry = rd32(world + 0x10);
  if (!data || !gm_valid(data, 4) || !registry || !gm_valid(registry, 0x118))
    return false;
  majesty::CoopPauseBoundary paused;
  majesty::CoopPlayerBinding binding;
  if (!majesty::coop_pause_boundary(owner, paused) ||
      !majesty::coop_player_binding(expected, binding))
    return false;
  const uint32_t state = rd32(0x006d7670);
  const std::string profile = mods_overlay_profile_dir();
  if (profile.empty())
    return false;
  const auto still_paused = [&] {
    recomp_network_session_v1 current{};
    majesty::CoopPauseBoundary boundary;
    majesty::CoopPlayerBinding current_binding;
    if (!recomp_network_session_info(epoch, &current) ||
        std::memcmp(&current, &expected, sizeof current) ||
        rd32(0x0071c68c) != world || rd32(0x006d87a0) != session ||
        rd32(world + 4) != data || rd32(world + 0x10) != registry ||
        std::string_view(mods_overlay_profile_dir()) != profile ||
        !majesty::coop_pause_boundary(owner, boundary) ||
        boundary.frame != paused.frame || boundary.clock != paused.clock ||
        rd32(0x006d7670) != state ||
        !majesty::coop_player_binding(current, current_binding) ||
        current_binding.slot != binding.slot || current_binding.player != binding.player)
      return false;
    return true;
  };
  if (!still_paused())
    return false;
  // Both file slots have private adapter labels. Never use the selected
  // personal save name or change the current profile/world routing.
  char writable[1024];
  if (!recomp_writable_path("CoopTransitions_probe", writable, sizeof writable))
    return false;
  // 00435c60 replaces a label's directory with the original save root.
  // Keep world/region identity in the basename, not a nested path.
  const std::string key =
      "CoopTransitions_" +
      std::string(majesty::coop_detail::text(identity.world)) + "_" +
      std::to_string(identity.x) + "_" + std::to_string(identity.y);
  X86 scratch = *c;
  scratch.r[R_ESP] -= 32768;
  const std::array<std::string, 2> names = {key + "_0", key + "_1"};
  const std::array<std::string, 2> paths = {
      native_checkpoint_path(&scratch, names[0]),
      native_checkpoint_path(&scratch, names[1])};
  if (!paths[0].starts_with(profile + "/") ||
      !paths[1].starts_with(profile + "/"))
    return false;
  const auto slash = paths[0].find_last_of('/');
  if (slash == paths[0].npos ||
      paths[1].substr(0, paths[1].find_last_of('/')) !=
          paths[0].substr(0, slash))
    return false;
  const std::string parent = paths[0].substr(0, slash);
  if (!majesty::coop_checkpoint_parent(profile, parent) ||
      paths[0].substr(slash + 1) != names[0] + ".GMP" ||
      paths[1].substr(slash + 1) != names[1] + ".GMP" || !still_paused())
    return false;
  const majesty::CoopCheckpointStore store(parent + "/" + key + ".checkpoint",
                                           paths, identity);
  if (!still_paused() ||
      !majesty_browser_coop_checkpoint_capture_allowed(c, epoch) ||
      !still_paused())
    return false;
  X86 extra = scratch;
  const uint32_t renderer = guest_call(&extra, 0x004401c0);
  if (!renderer || !gm_valid(renderer, 4) || !gm_valid(rd32(renderer), 0x54))
    return false;
  const uint32_t table = rd32(renderer);
  extra = scratch;
  extra.r[R_ECX] = renderer;
  const uint32_t previous = guest_call(&extra, rd32(table + 0x30));
  extra = scratch;
  extra.r[R_ECX] = renderer;
  guest_call(&extra, rd32(table + 0x44));
#ifndef __EMSCRIPTEN__
  // A recorded second peer voted on a particular original full file, whose
  // calendar changes on every new writer invocation. As for the first source
  // replay, import that unchanged file into an unvisited owned store, while
  // independently saving the actual live paused graph for stopped comparison.
  // This never replaces the world, clock, inputs or the peer's vote bytes.
  if (const char *replay = recomp_env("NATIVE_COOP_WORLD_RETURN_SOURCE_IMPORT");
      replay && identity.x == 1 && identity.y == 0 && store.unvisited()) {
    const std::string incoming = profile + "/captured-return-source";
    const majesty::CoopCheckpointStore source(incoming + "/source.checkpoint",
        {incoming + "/source_0.GMP", incoming + "/source_1.GMP"}, identity);
    const auto agreed = source.read();
    recomp_network_barrier_v1 previous_barrier{};
    if (std::strcmp(replay, "v1") || epoch != 1 || owner != 1 || !expected.host ||
        expected.local_player != 1 || expected.player_count != 2 ||
        expected.players[0] != 1 || expected.players[1] != 2 || binding.slot ||
        profile.find("/output/native-multiplayer-lobby-") == profile.npos ||
        !profile.ends_with("/owned-profile") ||
        majesty::coop_detail::text(identity.world) != "native-terrain-fixture" ||
        paused.frame != 31 || paused.clock != 1550 || !store.unvisited() ||
        !recomp_network_barrier_snapshot(epoch, &previous_barrier) ||
        previous_barrier.serial != 1 || previous_barrier.stage != 3 ||
        agreed.status != majesty::CoopCheckpointStore::Status::valid ||
        agreed.revision != 1 || agreed.frame != 31 || agreed.clock != 1550 ||
        !still_paused()) std::abort();
    const X86 before = *c;
    const char *label = "Coop_World_Return_Source";
    const std::string current_path = native_checkpoint_path(&scratch, label);
    if (!current_path.starts_with(profile + "/") ||
        !current_path.ends_with("/Coop_World_Return_Source.GMP") ||
        !majesty::coop_preserve_save_name(c, [&] {
          return write_checkpoint(&scratch, label, world);
        }) || !still_paused() || std::memcmp(c, &before, sizeof before)) std::abort();
    const bool saved = store.import_file(incoming + "/source_" +
        std::to_string(agreed.slot) + ".GMP", agreed, still_paused, out);
    const auto selected = store.read();
    if (!saved || selected.status != majesty::CoopCheckpointStore::Status::valid ||
        selected.frame != agreed.frame || selected.clock != agreed.clock ||
        selected.revision != agreed.revision || selected.bytes != agreed.bytes ||
        selected.digest != agreed.digest || !still_paused()) std::abort();
    majesty_browser_coop_checkpoint_captured(epoch, identity);
    extra = scratch; extra.r[R_ECX] = renderer;
    guest_call(&extra, rd32(table + 0x50), previous, 1u);
    win32_invalidate_dir_cache();
    std::fprintf(stderr, "[coop-return-source-import-fixture] Imported epoch=1 serial=2 source=1_0 revision=1 frame=31 clock=1550 current-original-writer=1 original-world-unmodified=1\n");
    return true;
  }
  // Later stopped-peer votes bind to an exact writer file, including calendar
  // bytes. Import only an explicitly staged owned source after Complete. Save
  // the actual paused graph separately before publication; never replace its
  // clock, inputs, party, world or context with the recorded file.
  if (const char *replay = recomp_env("NATIVE_COOP_WORLD_TRAVEL_SOURCE_IMPORT")) {
    if (std::strcmp(replay, "v1") || epoch != 1 || owner != 1 ||
        !expected.host || expected.local_player != 1 ||
        expected.player_count != 2 || expected.players[0] != 1 ||
        expected.players[1] != 2 || binding.slot ||
        profile.find("/output/native-multiplayer-lobby-") == profile.npos ||
        !profile.ends_with("/owned-profile") ||
        majesty::coop_detail::text(identity.world) != "native-terrain-fixture")
      std::abort();
    recomp_network_barrier_v1 previous_barrier{};
    if (!recomp_network_barrier_snapshot(epoch, &previous_barrier) ||
        !still_paused()) std::abort();
    if (previous_barrier.stage == 3 && previous_barrier.serial >= 2 &&
        previous_barrier.serial < 16) {
      const uint32_t next = previous_barrier.serial + 1;
      const std::string incoming = profile + "/captured-travel-source-" +
                                   std::to_string(next);
      OsStat marker{};
      if (os_lstat((incoming + "/source.checkpoint").c_str(), &marker) == 0) {
        if (!marker.is_regular || marker.is_symlink || !marker.size ||
            marker.size > 768) std::abort();
        const majesty::CoopCheckpointStore source(incoming + "/source.checkpoint",
            {incoming + "/source_0.GMP", incoming + "/source_1.GMP"}, identity);
        const auto agreed = source.read(), prior = store.read();
        if (agreed.status != majesty::CoopCheckpointStore::Status::valid ||
            prior.status != majesty::CoopCheckpointStore::Status::valid ||
            prior.revision == UINT64_MAX || agreed.revision != prior.revision + 1 ||
            agreed.frame != paused.frame || agreed.clock != paused.clock ||
            !still_paused()) std::abort();
        const X86 before = *c;
        const std::string label = "Coop_World_Travel_Source_" + std::to_string(next);
        const std::string current_path = native_checkpoint_path(&scratch, label);
        if (!current_path.starts_with(profile + "/") ||
            !current_path.ends_with("/" + label + ".GMP") ||
            !majesty::coop_preserve_save_name(c, [&] {
              return write_checkpoint(&scratch, label.c_str(), world);
            }) || !still_paused() || std::memcmp(c, &before, sizeof before))
          std::abort();
        const bool imported = store.import_file(incoming + "/source_" +
            std::to_string(agreed.slot) + ".GMP", agreed, still_paused, out);
        const auto selected = store.read();
        if (!imported || selected.status != majesty::CoopCheckpointStore::Status::valid ||
            selected.frame != agreed.frame || selected.clock != agreed.clock ||
            selected.revision != agreed.revision || selected.bytes != agreed.bytes ||
            selected.digest != agreed.digest || !still_paused()) std::abort();
        majesty_browser_coop_checkpoint_captured(epoch, identity);
        extra = scratch; extra.r[R_ECX] = renderer;
        guest_call(&extra, rd32(table + 0x50), previous, 1u);
        win32_invalidate_dir_cache();
        std::fprintf(stderr,
            "[coop-travel-source-import-fixture] Imported epoch=1 serial=%u "
            "source=%d_%d revision=%llu frame=%u clock=%u "
            "current-original-writer=1 original-world-unmodified=1\n",
            next, identity.x, identity.y, (unsigned long long)agreed.revision,
            paused.frame, paused.clock);
        return true;
      }
    }
  }
#endif
  const bool saved = store.commit(
      paused.frame, paused.clock,
      [&](int slot) {
        return majesty::coop_preserve_save_name(
            c, [&] { return write_checkpoint(&scratch, names[slot], world); });
      },
      still_paused, out);
  if (saved && still_paused())
    majesty_browser_coop_checkpoint_captured(epoch, identity);
  extra = scratch;
  extra.r[R_ECX] = renderer;
  guest_call(&extra, rd32(table + 0x50), previous, 1u);
  win32_invalidate_dir_cache();
  return saved;
}
bool session_saved_rng(const std::string &, uint32_t &, uint32_t &,
                       uint32_t *saved_clock = nullptr);

struct CoopCheckpointLocation {
  std::string marker;
  std::array<std::string, 2> paths, labels;
  majesty::CoopCheckpointIdentity identity;
  majesty::CoopCheckpointStore store() const { return {marker, paths, identity}; }
};
bool coop_checkpoint_location(X86 *c, const majesty::CoopCheckpointIdentity &identity,
                              std::string_view profile, CoopCheckpointLocation &out) {
  const std::string key = "CoopTransitions_" +
      std::string(majesty::coop_detail::text(identity.world)) + "_" +
      std::to_string(identity.x) + "_" + std::to_string(identity.y);
  out = {}; out.identity = identity;
  out.labels = {key + "_0", key + "_1"};
  X86 scratch = *c; scratch.r[R_ESP] -= 32768;
  out.paths = {native_checkpoint_path(&scratch, out.labels[0]),
               native_checkpoint_path(&scratch, out.labels[1])};
  const auto slash = out.paths[0].find_last_of('/');
  if (slash == out.paths[0].npos ||
      out.paths[1].substr(0, out.paths[1].find_last_of('/')) != out.paths[0].substr(0, slash))
    return false;
  const auto parent = out.paths[0].substr(0, slash);
  if (!majesty::coop_checkpoint_parent(profile, parent) ||
      out.paths[0].substr(slash + 1) != out.labels[0] + ".GMP" ||
      out.paths[1].substr(slash + 1) != out.labels[1] + ".GMP") return false;
  out.marker = parent + "/" + key + ".checkpoint";
  return true;
}
bool coop_same_record(const majesty::CoopCheckpointStore::Record &a,
                       const majesty::CoopCheckpointStore::Record &b) {
  return a.status == majesty::CoopCheckpointStore::Status::valid &&
         b.status == a.status && a.slot == b.slot && a.revision == b.revision &&
         a.bytes == b.bytes && a.frame == b.frame && a.clock == b.clock &&
         a.digest == b.digest;
}
// Retain one locally published source record across Ready and destructive
// replacement. Host/guest files can differ in local view metadata; each is
// bound to the same original paused frame, clock, room and proposal.
struct CoopRetainedSource {
  uint64_t epoch = 0;
  uint32_t serial = 0, owner = 0, world = 0, context = 0, registry = 0;
  std::string profile;
  CoopCheckpointLocation location;
  majesty::CoopCheckpointStore::Record record;
  majesty::CoopTransitionWire wire;
  bool retained(uint64_t joined, uint32_t next, uint32_t host,
                const majesty::CoopTransition &target) const {
    majesty::CoopTransitionWire encoded;
    return epoch == joined && serial == next && owner == host &&
           profile == mods_overlay_profile_dir() &&
           majesty::encode_coop_transition(target, encoded) && encoded.view() == wire.view() &&
           record.frame == target.frame && record.clock == target.clock &&
           coop_same_record(record, location.store().read());
  }
} coop_retained_source;

static bool coop_prepare_unavailable_source(
    X86 *, uint64_t, uint32_t, const majesty::CoopCheckpointIdentity &,
    const majesty::CoopCheckpointIdentity &, const recomp_network_session_v1 &,
    const majesty::CoopPauseBoundary &, const recomp_network_barrier_v1 &);

extern "C" bool majesty_browser_coop_checkpoint_begin(
    X86 *c, uint64_t epoch, uint32_t owner, int32_t dx, int32_t dy,
    const majesty::CoopCheckpointIdentity &source,
    const majesty::CoopCheckpointStore::Record &captured,
    const recomp_network_session_v1 &expected, uint32_t &serial) {
  serial = 0;
  const char *flag = recomp_env("RULE_COOP_SHARED_READ");
  if (!flag || std::strcmp(flag, "v1") || !c || !epoch ||
      !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      !expected.host || owner != expected.local_player ||
      (int64_t(dx) < 0 ? -int64_t(dx) : dx) +
              (int64_t(dy) < 0 ? -int64_t(dy) : dy) !=
          1 ||
      captured.status != majesty::CoopCheckpointStore::Status::valid)
    return false;
  majesty::CoopCheckpointIdentity current;
  majesty::CoopPauseBoundary paused;
  majesty::CoopLiveParty retained;
  if (!majesty_browser_coop_current_identity(epoch, current) ||
      current.world != source.world || current.content != source.content ||
      current.rules != source.rules || current.x != source.x ||
      current.y != source.y || !majesty::coop_pause_boundary(owner, paused) ||
      captured.frame != paused.frame || captured.clock != paused.clock ||
      !retained.capture(expected))
    return false;
  const int64_t x = int64_t(source.x) + dx, y = int64_t(source.y) + dy;
  if (x < -1000000 || x > 1000000 || y < -1000000 || y > 1000000)
    return false;
  const uint32_t world = rd32(0x0071c68c), data = rd32(world + 4),
                 registry = rd32(world + 0x10), state = rd32(0x006d7670);
  const auto binding = retained.binding();
  if (!data || !gm_valid(data, 0x11c) || rd32(data) != 0x00682950 ||
      !registry || !gm_valid(registry, 0x118))
    return false;
  const std::string profile = mods_overlay_profile_dir();
  const auto guard = [&] {
    recomp_network_session_v1 party{};
    majesty::CoopPauseBoundary boundary;
    majesty::CoopPlayerBinding selected;
    return recomp_network_session_info(epoch, &party) &&
           !std::memcmp(&party, &expected, sizeof party) &&
           rd32(0x0071c68c) == world && rd32(world + 4) == data &&
           rd32(world + 0x10) == registry && rd32(0x006d7670) == state &&
           std::string_view(mods_overlay_profile_dir()) == profile &&
           majesty::coop_pause_boundary(owner, boundary) &&
           boundary.frame == paused.frame && boundary.clock == paused.clock &&
           majesty::coop_player_binding(party, selected) &&
           selected.slot == binding.slot && selected.player == binding.player;
  };
  if (profile.empty() || !guard() || recomp_network_barrier_enable(epoch) ||
      recomp_network_checkpoint_enable(epoch) || !guard())
    return false;
  recomp_network_barrier_v1 previous{};
  recomp_network_barrier_snapshot(epoch, &previous);
  if ((previous.stage && previous.stage != 3 && previous.stage != 4) ||
      previous.serial == UINT32_MAX || !guard())
    return false;
  X86 scratch = *c;
  scratch.r[R_ESP] -= 32768;
  const auto paths_for = [&](const majesty::CoopCheckpointIdentity &identity,
                             std::string &marker,
                             std::array<std::string, 2> &paths,
                             std::array<std::string, 2> &labels) {
    const std::string key =
        "CoopTransitions_" +
        std::string(majesty::coop_detail::text(identity.world)) + "_" +
        std::to_string(identity.x) + "_" + std::to_string(identity.y);
    labels = {key + "_0", key + "_1"};
    paths = {native_checkpoint_path(&scratch, labels[0]),
             native_checkpoint_path(&scratch, labels[1])};
    const auto slash = paths[0].find_last_of('/');
    if (slash == paths[0].npos ||
        paths[1].substr(0, paths[1].find_last_of('/')) !=
            paths[0].substr(0, slash))
      return false;
    const std::string parent = paths[0].substr(0, slash);
    if (!majesty::coop_checkpoint_parent(profile, parent) ||
        paths[0].substr(slash + 1) != labels[0] + ".GMP" ||
        paths[1].substr(slash + 1) != labels[1] + ".GMP")
      return false;
    marker = parent + "/" + key + ".checkpoint";
    return true;
  };
  const auto same = [](const majesty::CoopCheckpointStore::Record &a,
                       const majesty::CoopCheckpointStore::Record &b) {
    return a.status == majesty::CoopCheckpointStore::Status::valid &&
           a.slot == b.slot && a.revision == b.revision && a.bytes == b.bytes &&
           a.frame == b.frame && a.clock == b.clock && a.digest == b.digest;
  };
  std::string source_marker, target_marker;
  std::array<std::string, 2> source_paths, target_paths, source_labels,
      target_labels;
  auto target_identity = source;
  target_identity.x = int32_t(x);
  target_identity.y = int32_t(y);
  if (!paths_for(source, source_marker, source_paths, source_labels) ||
      !paths_for(target_identity, target_marker, target_paths, target_labels) ||
      !guard())
    return false;
  const majesty::CoopCheckpointStore source_store(source_marker, source_paths,
                                                  source),
      target_store(target_marker, target_paths, target_identity);
  if (!same(source_store.read(), captured))
    return false;
  const auto destination_unavailable = [&] {
    // No Begin has been sent, and the original source graph is still held.
    // A fresh/corrupt neighbor is unavailable, rather than a reason to leave
    // the whole party paused forever. A changed/pending agreement refuses
    // recovery; it never grants permission to resume an unloaded source.
    recomp_network_barrier_v1 current_barrier{};
    recomp_network_barrier_snapshot(epoch, &current_barrier);
    const bool prepared =
        majesty::coop_source_abort_permission(previous, current_barrier) &&
        guard() && same(source_store.read(), captured) && guard() &&
        coop_prepare_unavailable_source(c, epoch, owner, source, target_identity,
                                        expected, paused, previous);
    std::fprintf(
        stderr,
        "[coop-load] Destination unavailable epoch=%llu region=%d_%d "
        "source-recovery-prepared=%u begin-sent=0\n",
        (unsigned long long)epoch, target_identity.x, target_identity.y,
        unsigned(prepared));
    return false;
  };
  const auto saved = target_store.read();
  const bool fresh = coop_fresh_enabled() && target_store.unvisited();
  if (!fresh && (saved.status != majesty::CoopCheckpointStore::Status::valid ||
      native_checkpoint_path(&scratch, target_labels[saved.slot],
                             WIN32_FILE_READ) != target_paths[saved.slot]))
    return destination_unavailable();
  majesty::CoopTransition target;
  target.world = source.world;
  target.content = source.content;
  target.rules = source.rules;
  target.source_x = source.x;
  target.source_y = source.y;
  target.target_x = target_identity.x;
  target.target_y = target_identity.y;
  target.frame = captured.frame;
  target.clock = captured.clock;
  target.source_revision = captured.revision;
  target.source_bytes = captured.bytes;
  target.source_digest = captured.digest;
  target.target_saved = !fresh;
  if (!fresh) {
    target.target_revision = saved.revision;
    target.target_bytes = saved.bytes;
    target.target_digest = saved.digest;
    if (!session_saved_rng(target_paths[saved.slot], target.target_gpl_seed,
                           target.target_game_seed, &target.target_clock) ||
        target.target_clock != saved.clock || !same(target_store.read(), saved))
      return destination_unavailable();
  } else if (!target_store.unvisited()) {
    return destination_unavailable();
  }
  if (!same(source_store.read(), captured) || !guard())
    return false;
  majesty::CoopTransitionWire wire;
  const uint32_t next = previous.serial + 1;
  if (!majesty::encode_coop_transition(target, wire) ||
      recomp_network_barrier_action(epoch, 1, next, wire.bytes.data(),
                                    uint32_t(wire.size)))
    return false;
  recomp_network_barrier_v1 proposal{};
  const bool observed = recomp_network_barrier_snapshot(epoch, &proposal);
  if (observed && proposal.stage == 4 && proposal.serial == next &&
      proposal.descriptor_bytes == wire.size &&
      !std::memcmp(proposal.descriptor, wire.bytes.data(), wire.size))
    return false; // Ordinary pre-commit cancellation keeps the source room.
  if (!guard() || !observed ||
      !majesty::coop_agreement_matches(proposal, expected, next, target, 1)) {
    recomp_network_reject_session(epoch);
    return false;
  }
  serial = next;
  std::fprintf(
      stderr,
      "[coop-load] Begin epoch=%llu serial=%u region=%d_%d bytes=%llu\n",
      (unsigned long long)epoch, serial, target.target_x, target.target_y,
      (unsigned long long)target.target_bytes);
  return true;
}

#ifndef __EMSCRIPTEN__
static void native_coop_begin_fresh_neighbor(X86 *c) {
  static bool attempted = false;
  const char *flag = recomp_env("NATIVE_COOP_WORLD_BEGIN_FRESH");
  const std::string profile = mods_overlay_profile_dir();
  recomp_network_session_v1 party{};
  const uint64_t epoch = recomp_network_session_epoch();
  majesty::CoopCheckpointIdentity identity;
  majesty::CoopPauseBoundary paused;
  if (attempted || !flag || std::strcmp(flag, "v1") || !c ||
      !sched_holds_baton() || mods_hook_depth() ||
      profile.find("/output/native-multiplayer-lobby-") == profile.npos ||
      !profile.ends_with("/owned-profile") || !coop_fresh_enabled() ||
      !epoch || !recomp_network_session_info(epoch, &party) ||
      !party.host || party.local_player != 1 || party.player_count != 2 ||
      party.players[0] != 1 || party.players[1] != 2 ||
      !majesty_browser_coop_current_identity(epoch, identity) ||
      identity.x != 0 || identity.y != 0 ||
      !majesty::coop_pause_boundary(1, paused) ||
      paused.frame != 11 || paused.clock != 550) std::abort();
  attempted = true;
  const X86 before = *c;
  majesty::CoopCheckpointStore::Record captured;
  uint32_t serial = 0;
  // A stopped replay may retain the previously inspected original source.
  // Import it through the checked store; never replace any live world state.
  const char *import_flag = recomp_env("NATIVE_COOP_WORLD_SOURCE_IMPORT");
  const bool importing = import_flag && !std::strcmp(import_flag, "v1");
  if (import_flag && !importing) std::abort();
  if (importing) {
    CoopCheckpointLocation local;
    const std::string incoming = profile + "/captured-coop-source";
    const majesty::CoopCheckpointStore source(incoming + "/source.checkpoint",
        {incoming + "/source_0.GMP", incoming + "/source_1.GMP"}, identity);
    const auto agreed = source.read();
    const uint32_t world = rd32(0x0071c68c), state = rd32(0x006d7670);
    const auto guard = [&] {
      recomp_network_session_v1 now{};
      majesty::CoopPauseBoundary boundary;
      return recomp_network_session_epoch() == epoch &&
          recomp_network_session_info(epoch, &now) &&
          !std::memcmp(&now, &party, sizeof party) &&
          mods_overlay_profile_dir() == profile &&
          rd32(0x0071c68c) == world && rd32(0x006d7670) == state &&
          majesty::coop_pause_boundary(1, boundary) &&
          boundary.frame == 11 && boundary.clock == 550;
    };
    if (!coop_checkpoint_location(c, identity, profile, local) ||
        !local.store().unvisited() || agreed.status != majesty::CoopCheckpointStore::Status::valid ||
        agreed.revision != 1 || agreed.frame != 11 || agreed.clock != 550 ||
        !guard() || !local.store().import_file(incoming + "/source_" +
          std::to_string(agreed.slot) + ".GMP", agreed, guard, captured) ||
        !coop_same_record(captured, local.store().read()) || !guard()) std::abort();
    win32_invalidate_dir_cache();
    std::fprintf(stderr, "[coop-source-import-fixture] Imported epoch=1 serial=1 "
        "source=0_0 revision=1 frame=11 clock=550 original-world-unmodified=1\n");
  } else if (!majesty_browser_coop_checkpoint(c, epoch, 1, identity, party, captured)) {
    std::abort();
  }
  if (captured.revision != 1 || captured.frame != 11 || captured.clock != 550 ||
      !majesty_browser_coop_checkpoint_begin(c, epoch, 1, 1, 0, identity, captured,
                                            party, serial) || serial != 1 ||
      std::memcmp(c, &before, sizeof before)) std::abort();
  recomp_network_barrier_v1 proposal{};
  majesty::CoopTransition target;
  if (!recomp_network_barrier_snapshot(epoch, &proposal) || proposal.stage != 1 ||
      proposal.serial != serial || proposal.descriptor_bytes > sizeof proposal.descriptor ||
      !majesty::decode_coop_transition(
          {reinterpret_cast<const char *>(proposal.descriptor), proposal.descriptor_bytes}, target) ||
      target.target_saved || target.source_x != 0 || target.source_y != 0 ||
      target.target_x != 1 || target.target_y != 0 ||
      target.source_revision != captured.revision || target.source_bytes != captured.bytes ||
      target.source_digest != captured.digest) std::abort();
  std::fprintf(stderr, "[coop-begin-fixture] Prepared epoch=%llu serial=1 local=1 slot=0 "
      "source=0_0 target=1_0 source-revision=1 frame=11 clock=550 "
      "original-source-capture=%u production-begin=1 peer-ready=0 peer-loaded=0 live-second-engine=0\n",
      (unsigned long long)epoch, importing ? 0u : 1u);
}
#endif

extern "C" bool majesty_browser_coop_checkpoint_ready(
    X86 *c, uint64_t epoch, uint32_t owner, uint32_t serial,
    const majesty::CoopTransition &target,
    const recomp_network_session_v1 &expected, const char *incoming) {
  static uint64_t attempted_epoch = 0;
  static uint32_t attempted_serial = 0;
  static bool store_checked = false, import_attempted = false, voted = false;
  const char *flag = recomp_env("RULE_COOP_SHARED_READ");
  if (!flag || std::strcmp(flag, "v1") || !c || !epoch || !serial ||
      !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      (attempted_epoch == epoch && serial < attempted_serial))
    return false;
  majesty::CoopCheckpointIdentity source;
  majesty::CoopTransitionWire wire;
  majesty::CoopPauseBoundary paused;
  majesty::CoopLiveParty retained;
  if (!majesty_browser_coop_current_identity(epoch, source) ||
      target.world != source.world || target.content != source.content ||
      target.rules != source.rules || target.source_x != source.x ||
      target.source_y != source.y ||
      !majesty::encode_coop_transition(target, wire) ||
      (!target.target_saved && !coop_fresh_enabled()) ||
      !majesty::coop_pause_boundary(owner, paused) ||
      target.frame != paused.frame || target.clock != paused.clock ||
      !retained.capture(expected) ||
      !std::binary_search(expected.players,
                          expected.players + expected.player_count, owner))
    return false;
  const uint32_t world = rd32(0x0071c68c), data = rd32(world + 4),
                 registry = rd32(world + 0x10), state = rd32(0x006d7670);
  const auto binding = retained.binding();
  if (!data || !gm_valid(data, 0x11c) || rd32(data) != 0x00682950 ||
      !registry || !gm_valid(registry, 0x118))
    return false;
  const std::string profile = mods_overlay_profile_dir();
  const auto agreement = [&] {
    recomp_network_session_v1 current{};
    recomp_network_barrier_v1 barrier{};
    majesty::CoopPauseBoundary boundary;
    majesty::CoopPlayerBinding selected;
    return recomp_network_session_info(epoch, &current) &&
           !std::memcmp(&current, &expected, sizeof current) &&
           recomp_network_barrier_snapshot(epoch, &barrier) &&
           majesty::coop_ready_permission(barrier, expected, serial, target,
                                          true) &&
           rd32(0x0071c68c) == world && rd32(world + 4) == data &&
           rd32(world + 0x10) == registry && rd32(0x006d7670) == state &&
           std::string_view(mods_overlay_profile_dir()) == profile &&
           majesty::coop_pause_boundary(owner, boundary) &&
           boundary.frame == paused.frame && boundary.clock == paused.clock &&
           majesty::coop_player_binding(current, selected) &&
           selected.slot == binding.slot && selected.player == binding.player;
  };
  if (profile.empty() || !agreement())
    return false;
  if (attempted_epoch != epoch || attempted_serial != serial) {
    attempted_epoch = epoch;
    attempted_serial = serial;
    store_checked = import_attempted = voted = false;
  }
  if (voted)
    return true;
  const bool importing = incoming && *incoming;
  if (importing ? import_attempted : store_checked)
    return false;
  auto identity = source;
  identity.x = target.target_x;
  identity.y = target.target_y;
  const std::string key =
      "CoopTransitions_" +
      std::string(majesty::coop_detail::text(identity.world)) + "_" +
      std::to_string(identity.x) + "_" + std::to_string(identity.y);
  const std::array<std::string, 2> labels = {key + "_0", key + "_1"};
  X86 scratch = *c;
  scratch.r[R_ESP] -= 32768;
  const std::array<std::string, 2> paths = {
      native_checkpoint_path(&scratch, labels[0]),
      native_checkpoint_path(&scratch, labels[1])};
  const auto slash = paths[0].find_last_of('/');
  if (slash == paths[0].npos ||
      paths[1].substr(0, paths[1].find_last_of('/')) !=
          paths[0].substr(0, slash))
    return false;
  const std::string parent = paths[0].substr(0, slash);
  if (!majesty::coop_checkpoint_parent(profile, parent) ||
      paths[0].substr(slash + 1) != labels[0] + ".GMP" ||
      paths[1].substr(slash + 1) != labels[1] + ".GMP" || !agreement())
    return false;
  const majesty::CoopCheckpointStore store(parent + "/" + key + ".checkpoint",
                                           paths, identity);
  const auto retain_source = [&] {
    CoopCheckpointLocation local_source;
    if (!coop_checkpoint_location(c, source, profile, local_source) || !agreement())
      return false;
    auto record = local_source.store().read();
    if (expected.host) {
      if (record.status != majesty::CoopCheckpointStore::Status::valid ||
          record.revision != target.source_revision || record.bytes != target.source_bytes ||
          record.digest != target.source_digest || record.frame != target.frame ||
          record.clock != target.clock) return false;
    } else if (!majesty_browser_coop_checkpoint(c, epoch, owner, source, expected, record)) {
      return false;
    }
    if (record.frame != target.frame || record.clock != target.clock ||
        !coop_same_record(record, local_source.store().read()) ||
        !agreement()) return false;
    coop_retained_source = {};
    coop_retained_source.epoch = epoch; coop_retained_source.serial = serial;
    coop_retained_source.owner = owner; coop_retained_source.profile = profile;
    coop_retained_source.world = world; coop_retained_source.context = data;
    coop_retained_source.registry = registry;
    coop_retained_source.location = local_source; coop_retained_source.record = record;
    coop_retained_source.wire = wire;
    return true;
  };
  if (!target.target_saved) {
    if (importing || !coop_fresh_enabled() || !store.unvisited() || !agreement())
      return false;
    store_checked = true; // One source capture attempt per proposal.
    if (!retain_source() || !store.unvisited() || !agreement()) return false;
    if (recomp_network_barrier_action(epoch, 2, serial, wire.bytes.data(), uint32_t(wire.size))) {
      recomp_network_reject_session(epoch);
      return false;
    }
    voted = true;
    std::fprintf(stderr, "[coop-load] Ready fresh epoch=%llu serial=%u local-source-revision=%llu\n",
        (unsigned long long)epoch, serial, (unsigned long long)coop_retained_source.record.revision);
    return true;
  }
  if (importing) {
    size_t length = 0;
    while (length < 1024 && incoming[length])
      ++length;
    if (length == 1024)
      return false;
    const std::string path(incoming, length);
    const auto split = path.find_last_of('/');
    if (split == path.npos ||
        !majesty::coop_checkpoint_parent(profile, path.substr(0, split)))
      return false;
    majesty::CoopCheckpointStore::Record agreed, imported;
    agreed.status = majesty::CoopCheckpointStore::Status::valid;
    agreed.revision = target.target_revision;
    agreed.bytes = target.target_bytes;
    agreed.clock = target.target_clock;
    agreed.digest = target.target_digest;
    // No target frame exists on the wire. Imported metadata uses0; the load
    // coordinator separately checks the actual rebuilt frame/clock/RNG.
    import_attempted = true;
    if (!store.import_file(path, agreed, agreement, imported, os_rename,
                           majesty::CoopCheckpointStore::ImportPolicy::shared_target)) {
      recomp_network_reject_session(epoch);
      return false;
    }
    win32_invalidate_dir_cache();
  }
  store_checked = true;
  const auto record = store.read();
  if (record.status != majesty::CoopCheckpointStore::Status::valid ||
      record.revision != target.target_revision ||
      record.bytes != target.target_bytes ||
      record.clock != target.target_clock ||
      record.digest != target.target_digest ||
      native_checkpoint_path(&scratch, labels[record.slot], WIN32_FILE_READ) !=
          paths[record.slot] ||
      !agreement())
    return false;
  if (!retain_source() || !agreement()) return false;
  if (recomp_network_barrier_action(epoch, 2, serial, wire.bytes.data(),
                                    uint32_t(wire.size))) {
    recomp_network_reject_session(epoch);
    return false;
  }
  voted = true;
  std::fprintf(stderr, "[coop-load] Ready epoch=%llu serial=%u imported=%u local-source-revision=%llu\n",
               (unsigned long long)epoch, serial, importing ? 1u : 0u,
               (unsigned long long)coop_retained_source.record.revision);
  return true;
}

// guest_call's return sentinel normally completes its callback immediately.
// These translated entry overrides have work after the original RET: the
// constructor reapplies the connected extent, and generation verifies terrain
// and removes its temporary hooks. An owned root wrap lets the runtime defer
// that callback return until the entire override and its cleanup have finished.
struct CoopGenerationCallbacks {
  std::array<uint32_t, 5> handles{};
  const void *retirement_user = nullptr;
  bool (*retirement_check)(const void *) = nullptr;
  uint32_t retirement_state = 0;
  bool retirement_held = false;
  static void forward(const PopModApi *api, pop_cpu_v1 *cpu,
                      PopHookInvocation *inv, void *) {
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
  }
  static void selected_player(const PopModApi *api, pop_cpu_v1 *cpu,
                              PopHookInvocation *inv, void *) {
    if (coop_fresh_construction.epoch && !rd32(0x0071c68c) &&
        gm_valid(cpu->esp, 4))
      std::fprintf(stderr, "[coop-generation] Unattached player query caller=%08x phase=%u generator-context=%08x\n",
                   rd32(cpu->esp), rd32(rd32(0x006d7670)),
                   rd32(coop_fresh_construction.generator + 0x84));
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
  }
  static void hud_gold(const PopModApi *api, pop_cpu_v1 *cpu,
                       PopHookInvocation *inv, void *) {
    auto &token = coop_fresh_construction;
    // Original004846d0 is the display listener, not the gold mutator.
    // Its AP-property branch reads the published local player and updates
    // controls2006/4464; both original exits RET16. Fresh startup has no old
    // in-game listener. During committed replacement the prior listener is
    // still subscribed, so hold only this display notification until the
    // original post-attachment rebuild refreshes the HUD.
    if (token.epoch && !rd32(0x0071c68c) && gm_valid(cpu->esp, 20) &&
        rd32(cpu->esp + 12) == 0x00505041u) {
      const uint32_t context = rd32(token.generator + 0x84), state = rd32(0x006d7670);
      if (!token.agreement() || !gm_valid(context, 0x11c) ||
          rd32(context) != 0x00682950u || !gm_valid(state, 0x50) ||
          rd32(state) != 7 || rd32(state + 4)) std::abort();
      std::fprintf(stderr, "[coop-generation] Held detached HUD gold refresh serial=%u\n", token.serial);
      if (mods_hook_return(api, cpu, 0u, 16u) != POP_OK) std::abort();
      return;
    }
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
  }
  static void retirement_phase(const PopModApi *api, pop_cpu_v1 *cpu,
                                PopHookInvocation *inv, void *user) {
    auto &self = *static_cast<CoopGenerationCallbacks *>(user);
    // Preserve the original complete interface/script/world teardown. Its
    // final request9 is an application exit when called from phase7. Hold
    // only that request at its pinned caller, after the exact committed
    // source has been disposed and the unchanged network pause revalidated.
    if (self.retirement_user && self.retirement_check &&
        !self.retirement_held && cpu->ecx == self.retirement_state &&
        gm_valid(cpu->esp, 8) && rd32(cpu->esp) == 0x0041712eu &&
        rd32(cpu->esp + 4) == 9 && self.retirement_check(self.retirement_user)) {
      self.retirement_held = true;
      if (mods_hook_return(api, cpu, cpu->eax, 4u) != POP_OK) std::abort();
      return;
    }
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
  }
  bool install_retirement() {
    return mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00416050u, 0,
                               retirement_phase, POP_HOOK_WRAP,
                               POP_HOOK_NO_GAME_VIEW, this, &handles[4]) == POP_OK;
  }
  bool install() {
    const std::array<uint32_t, 2> entries = {0x004aef20u, 0x004b23d0u};
    for (size_t i = 0; i < entries.size(); ++i)
      if (mods_hook_install_ex(MODS_OWNER_RUNTIME, entries[i], 0, forward,
                              POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr,
                              &handles[i]) != POP_OK) return false;
    if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x004846d0u, 0,
                            hud_gold, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW,
                            nullptr, &handles[3]) != POP_OK) return false;
    if (!install_retirement()) return false;
    return mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00416980u, 0,
                               selected_player, POP_HOOK_WRAP,
                               POP_HOOK_NO_GAME_VIEW, nullptr,
                               &handles[2]) == POP_OK;
  }
  ~CoopGenerationCallbacks() {
    for (uint32_t handle : handles)
      if (handle && mods_hook_remove(MODS_OWNER_RUNTIME, handle) != POP_OK)
        std::abort();
  }
};

// During committed travel the web Loaded barrier follows the complete rebuild.
// Repeating the original GoStatus initialization inside that rebuild deadlocks
// before either peer can vote Loaded. Hide only the owning connection member
// at original00416cdc's one conditional read, then restore it at00416eda before
// the remaining rebuild. The SDK provider and its COM reference stay owned.
// Ordinary startup never installs this scope. Each caller supplies the exact
// authorization boundary; the owned native method component grants no barrier.
template<class Boundary>
class CoopRebuildLoadingScope {
  Boundary boundary_;
  uint32_t manager_ = 0, connection_ = 0;
  std::array<uint32_t, 2> handles_{};
  bool hidden_ = false, restored_ = false;
  static void manager_get(const PopModApi *api, pop_cpu_v1 *cpu,
                          PopHookInvocation *inv, void *opaque) {
    auto &p = *static_cast<CoopRebuildLoadingScope *>(opaque);
    const uint32_t caller = gm_valid(cpu->esp, 4) ? rd32(cpu->esp) : 0;
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
    if (caller != 0x00416cdcu) return;
    if (p.hidden_ || p.restored_ || !p.boundary_() ||
        cpu->eax != p.manager_ || rd32(p.manager_ + 0xc8) != p.connection_)
      std::abort();
    wr32(p.manager_ + 0xc8, 0u);
    p.hidden_ = true;
  }
  static void settings_get(const PopModApi *api, pop_cpu_v1 *cpu,
                           PopHookInvocation *inv, void *opaque) {
    auto &p = *static_cast<CoopRebuildLoadingScope *>(opaque);
    const uint32_t caller = gm_valid(cpu->esp, 4) ? rd32(cpu->esp) : 0;
    if (caller == 0x00416edau) {
      if (!p.hidden_ || p.restored_ || !p.boundary_() ||
          rd32(p.manager_ + 0xc8)) std::abort();
      wr32(p.manager_ + 0xc8, p.connection_);
      p.hidden_ = false; p.restored_ = true;
    }
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
  }
 public:
  explicit CoopRebuildLoadingScope(Boundary boundary) : boundary_(boundary) {}
  bool install() {
    manager_ = rd32(0x006d8568);
    if (!sched_holds_baton() || mods_hook_depth() || !boundary_() ||
        !gm_valid(manager_, 0x2b0)) return false;
    connection_ = rd32(manager_ + 0xc8);
    if (!connection_ || !gm_valid(connection_, 4) ||
        !gm_valid(rd32(connection_), 4)) return false;
    return mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00497990u, 0,
               manager_get, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, this,
               &handles_[0]) == POP_OK &&
           mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x004ba7e0u, 0,
               settings_get, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, this,
               &handles_[1]) == POP_OK;
  }
  bool completed() const {
    return restored_ && !hidden_ && rd32(0x006d8568) == manager_ &&
           rd32(manager_ + 0xc8) == connection_;
  }
  ~CoopRebuildLoadingScope() {
    if (hidden_) {
      if (rd32(0x006d8568) != manager_ || rd32(manager_ + 0xc8)) std::abort();
      wr32(manager_ + 0xc8, connection_);
    }
    for (uint32_t handle : handles_)
      if (handle && mods_hook_remove(MODS_OWNER_RUNTIME, handle) != POP_OK)
        std::abort();
  }
};

// Read one full original context after the source world has been disposed.
// The caller supplies its exact authorization boundary: the production caller
// binds committed travel, and the native component binds its owned paused party.
// This leaf supplies no attachment, Loaded vote or resume permission.
template<class Boundary>
bool read_coop_saved_context(X86 *c, uint32_t serializer, uint32_t label,
                             uint32_t output, uint32_t settings,
                             Boundary boundary) {
  if (!c || !gm_valid(serializer, 12) || rd32(serializer) != 0x00680c60 ||
      !gm_valid(label, 12) || !gm_valid(output, 4) ||
      !gm_valid(settings, 0x4f8) || rd32(0x0071c68c) || !boundary()) return false;
  X86 extra = *c; extra.r[R_ESP] -= 32768;
  wr32(settings + 0x6c, 1);
  const uint32_t gpl = guest_call(&extra, 0x00623b20);
  if (!gm_valid(gpl, 0x38) || rd32(gpl) != 0x0068c02cu || !boundary() ||
      !clear_saved_names_at_boundary(c, "Cooperative saved read", boundary))
    return false;
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = gpl;
  guest_call(&extra, 0x00623a70);
  return boundary() && majesty::coop_preserve_save_name(c, [&] {
    extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = serializer;
    const uint32_t result = guest_call(&extra, 0x00435940, label, output);
    std::fprintf(stderr, "[coop-read] Original reader result=%u context=%08x world-null=%u\n",
        result, rd32(output), unsigned(!rd32(0x0071c68c)));
    return result == 0 && restore_saved_configuration(c, rd32(output));
  });
}

#ifndef __EMSCRIPTEN__
bool session_restore_rng(X86 *, uint32_t, uint32_t);
// Exercise the complete original rebuild method while the owned native party
// remains paused. Only its terminal request3 at the pinned rebuild caller is
// held. This is a method component, not a phase2 dispatcher or shared barrier.
struct NativeCoopReadbackRebuildHold {
  uint64_t epoch = 0;
  recomp_network_session_v1 party{};
  uint32_t state = 0, world = 0, context = 0, handle = 0;
  bool held = false;
  static void phase(const PopModApi *api, pop_cpu_v1 *cpu,
                    PopHookInvocation *inv, void *opaque) {
    auto &p = *static_cast<NativeCoopReadbackRebuildHold *>(opaque);
    if (cpu->ecx == p.state && gm_valid(cpu->esp, 8) &&
        rd32(cpu->esp) == 0x00417077u && rd32(cpu->esp + 4) == 3) {
      recomp_network_session_v1 now{};
      if (p.held || recomp_network_session_epoch() != p.epoch ||
          !recomp_network_session_info(p.epoch, &now) ||
          std::memcmp(&now, &p.party, sizeof now) ||
          rd32(0x006d7670) != p.state || rd32(p.state) != 7 ||
          rd32(p.state + 4) != 5 || rd32(0x0071c68c) != p.world ||
          rd32(p.world + 4) != p.context || rd32(p.world + 0x10) != p.context ||
          rd8(p.state + 0x4c) != 0) std::abort();
      p.held = true;
      if (mods_hook_return(api, cpu, cpu->eax, 4u) != POP_OK) std::abort();
      return;
    }
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
  }
  ~NativeCoopReadbackRebuildHold() {
    if (handle && mods_hook_remove(MODS_OWNER_RUNTIME, handle) != POP_OK)
      std::abort();
  }
};
// One owned actual-party phase2 component. Scheduling is explicitly native
// controlled, not a committed web proposal. The original outer dispatcher
// consumes pending2; original rebuild then the production hold queue7. No
// native hook suppresses terminal3 and no reference Ready/Loaded vote is sent.
struct NativeCoopPhase2Readback {
  enum class Stage { idle, queued, held };
  bool from_host_checkpoint = false;
  Stage stage = Stage::idle;
  uint64_t epoch = 0;
  uint32_t state = 0, manager = 0, settings = 0, world = 0, context = 0,
           owner = 0, clock = 0, gpl_seed = 0, game_seed = 0,
           renderer = 0, render_state = 0, names = 0, held_tick_entries = 0, gpl = 0;
  recomp_network_session_v1 party{};
  std::string profile;
  bool roots() const {
    recomp_network_session_v1 now{};
    majesty::CoopPlayerBinding binding;
    return stage != Stage::idle && sched_holds_baton() &&
        recomp_network_session_epoch() == epoch &&
        recomp_network_session_info(epoch, &now) && !std::memcmp(&now, &party, sizeof now) &&
        mods_overlay_profile_dir() == profile && rd32(0x006d7670) == state &&
        gm_valid(state, 0x50) && rd32(0x006d8568) == manager && gm_valid(manager, 0x2b0) &&
        rd32(0x006d87a0) == settings && gm_valid(settings, 0x4f8) &&
        rd32(0x0071c68c) == world && gm_valid(world, 0x20) &&
        rd32(world) == 0x0067f85c && rd32(world + 4) == context &&
        rd32(world + 0x10) == context && gm_valid(context, 0x11c) &&
        rd32(context) == 0x00682950 && rd32(manager + 0xc0) == context &&
        majesty::coop_match_type(manager) && rd32(manager + 0x27c) == owner &&
        majesty::coop_player_binding(party, binding) && binding.slot == (party.host ? 0u : 1u) &&
        rd32(context + 0x24) == binding.slot && rd32(0x0071c6a8) == clock;
  }
  void arm(X86 *c, uint32_t attached_context,
           const recomp_network_session_v1 &actual_party,
           majesty::CoopPauseBoundary paused, uint32_t saved_gpl_seed,
           uint32_t saved_game_seed, uint32_t saved_renderer,
           uint32_t saved_render_state, uint32_t saved_names, bool host_checkpoint) {
    if (stage != Stage::idle || !majesty::coop_outer_tick_boundary(c)) std::abort();
    epoch = recomp_network_session_epoch(); party = actual_party;
    state = rd32(0x006d7670); manager = rd32(0x006d8568); settings = rd32(0x006d87a0);
    world = rd32(0x0071c68c); context = attached_context; profile = mods_overlay_profile_dir();
    owner = paused.owner; clock = paused.clock; gpl_seed = saved_gpl_seed;
    game_seed = saved_game_seed; renderer = saved_renderer; render_state = saved_render_state;
    names = saved_names; held_tick_entries = 0; stage = Stage::queued;
    from_host_checkpoint = host_checkpoint;
    const char *incoming = recomp_env("NATIVE_COOP_WORLD_INCOMING_PAUSE");
    if (!roots() || party.host > 1 || party.local_player != (party.host ? 1u : 2u) ||
        (!party.host && (!incoming || std::strcmp(incoming, "v1"))) || owner != 1 ||
        profile.find("/output/native-multiplayer-lobby-") == profile.npos ||
        !profile.ends_with("/owned-profile") || rd32(state) != 7 || rd32(state + 4) != 5 ||
        rd32(state + 0x28) != paused.frame || rd8(state + 0x4c) ||
        rd32(context + 0x4c) != 0 || !gm_valid(renderer, 0x4c) ||
        rd32(renderer) != 0x00681100) std::abort();
    // The production adapter does this only with an exact committed barrier.
    // This component controls only its private target scheduling; it cannot
    // qualify that adapter or claim a peer has prepared/loaded a live world.
    wr32(state + 4, 2u);
    std::fprintf(stderr, "[coop-phase2-fixture] Queued original dispatcher pending=2 phase=7 native-only-scheduling=1 committed-coordinator=0 ready-votes=0 loaded-votes=0\n");
  }
  bool rebuild(X86 *c) {
    if (stage == Stage::idle) return false;
    if (stage != Stage::queued || !roots() || !majesty::coop_outer_rebuild_boundary(c) ||
        c->r[R_ECX] != state || rd32(state) != 2 || rd32(state + 4)) std::abort();
    std::fprintf(stderr, "[coop-phase2-fixture] Original rebuild entered return=00415e7f phase=2 pending=0 terminal-request3-suppressed=0\n");
    const auto boundary = [&] {
      return roots() && rd32(state) == 2 &&
          (rd32(state + 4) == 0 || rd32(state + 4) == 3) && !rd8(state + 0x4c);
    };
    CoopRebuildLoadingScope loading(boundary);
    if (!loading.install()) std::abort();
    session_ui_restore.begin(context, &boundary, [](const void *p) {
      return (*static_cast<const decltype(boundary) *>(p))();
    }, !from_host_checkpoint);
    fn_00416c30(c);
    session_ui_restore.end();
    if (!loading.completed() || !roots() || rd32(state) != 2 || rd32(state + 4) != 3 ||
        rd32(state + 0x28) || rd32(context + 0x4c) != clock) std::abort();
    std::fprintf(stderr, "[coop-phase2-fixture] Original rebuild returned phase=2 pending=3 frame=0 clock=%u context-clock=%u connection-owned=1\n", clock, rd32(context + 0x4c));
    if (!majesty::coop_hold_rebuilt_context(c, context, owner) || !roots()) std::abort();
    stage = Stage::held;
    std::fprintf(stderr, "[coop-phase2-fixture] Production hold returned phase=2 pending=7 owner=%u frame=0 clock=%u original-pause=004a5c00 ready-votes=0 loaded-votes=0 resume-controls=0\n", owner, clock);
    return true;
  }
  bool finish(X86 *c) {
    if (stage != Stage::held) return false;
    if (!majesty::coop_outer_tick_boundary(c) || mods_hook_depth() || !roots() ||
        rd32(state) != 7 || rd32(state + 4) || rd32(state + 0x28) ||
        rd32(context + 0x4c) != clock) {
      std::fprintf(stderr, "[coop-phase2-fixture] Hold boundary refused tick-entries=%u phase=%u pending=%u frame=%u clock=%u expected-clock=%u context-clock=%u\n", held_tick_entries, rd32(state), rd32(state + 4), rd32(state + 0x28), rd32(0x0071c6a8), clock, rd32(context + 0x4c));
      std::abort();
    }
    if (!held_tick_entries) {
      std::fprintf(stderr, "[coop-phase2-fixture] Dispatcher settled hold phase=7 pending=0 owner=%u frame=0 clock=%u original-tick-body-entered=0\n", owner, clock);
      if (!session_restore_rng(c, gpl_seed, game_seed) || !roots()) std::abort();
      X86 extra = *c; extra.r[R_ESP] -= 32768;
      gpl = guest_call(&extra, 0x00623b20);
      std::fprintf(stderr, "[coop-read-fixture] Saved RNG restored scripting=%u gameplay=%u clock=%u original-gpl-setter=00623720 original-game-setter=004f6710 loaded-votes=0\n", gpl_seed, game_seed, clock);
    }
    const auto seeds = [&] {
      return gm_valid(gpl, 0x38) && rd32(gpl) == 0x0068c02c &&
          rd32(gpl + 0x20) == gpl_seed && rd32(gpl + 0x24) == gpl_seed &&
          rd32(0x0071fc70) == game_seed && rd32(0x0071fc74) == game_seed;
    };
    if (!seeds()) {
      std::fprintf(stderr, "[coop-phase2-fixture] Paused RNG refused tick-entries=%u scripting=%u expected=%u gameplay=%u expected-game=%u\n", held_tick_entries, rd32(gpl + 0x20), gpl_seed, rd32(0x0071fc70), game_seed);
      std::abort();
    }
    // Let real paused network/UI bodies return twice. The next outer entry
    // checks that neither body advanced the frozen world/frame/clock before
    // serialization. No reference post-load packet is fabricated.
    if (held_tick_entries < 2) {
      ++held_tick_entries;
      std::fprintf(stderr, "[coop-phase2-fixture] Paused original tick admitted ordinal=%u phase=7 pending=0 frame=0 clock=%u peer-loaded-votes=0\n", held_tick_entries, clock);
      return false;
    }
    std::fprintf(stderr, "[coop-phase2-fixture] Paused original ticks returned count=2 phase=7 pending=0 frame=0 clock=%u context-clock=%u owner=%u\n", clock, rd32(context + 0x4c), owner);
    const auto guard = [&] {
      return roots() && rd32(state) == 7 && !rd32(state + 4) &&
          !rd32(state + 0x28) && rd32(context + 0x4c) == clock && seeds();
    };
    CoopGenerationCallbacks callbacks;
    const std::array<uint32_t, 2> getters = {0x00435d00u, 0x004401c0u};
    for (size_t i = 0; i < getters.size(); ++i)
      if (mods_hook_install_ex(MODS_OWNER_RUNTIME, getters[i], 0,
          CoopGenerationCallbacks::forward, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW,
          nullptr, &callbacks.handles[i]) != POP_OK) std::abort();
    if (!guard()) std::abort();
    const uint32_t metadata = 0x006d7ce0;
    if ((rd32(metadata + 0x48) - rd32(metadata + 0x44)) / 12 != names ||
        !majesty::coop_preserve_save_name(c, [&] {
          X86 extra = *c; extra.r[R_ESP] -= 32768;
          return write_context_checkpoint(&extra, "Coop_World_Readback", context);
        }) || !guard()) std::abort();
    std::fprintf(stderr, "[coop-read-fixture] Complete epoch=%llu local=%u slot=%u owner=%u frame=0 clock=%u names-before=%u names-after=%u original-reader=00435940 original-writer=004359c0 attached=1 rebuilt=1 party-same=1 loaded-votes=0 resume-controls=0 result=pass\n", (unsigned long long)epoch, party.local_player, rd32(state + 0x24), owner, clock, names, names);
    const auto call = [&](uint32_t entry, uint32_t self, auto... args) {
      X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = self;
      return guest_call(&extra, entry, args...);
    };
    call(0x004170a0u, state); call(0x00497ca0u, manager, 0u);
    const uint32_t gpl = call(0x00623b20u, 0u); call(0x00623a70u, gpl);
    recomp_network_session_v1 now{};
    if (rd32(0x0071c68c) || rd32(state) != 7 || rd32(state + 4) != 6 ||
        rd32(state + 0x28) || rd32(0x0071c6a8) != clock ||
        recomp_network_session_epoch() != epoch || !recomp_network_session_info(epoch, &now) ||
        std::memcmp(&now, &party, sizeof now) || !gm_valid(renderer, 0x4c) ||
        rd32(renderer) != 0x00681100) std::abort();
    call(rd32(rd32(renderer) + 0x50), renderer, render_state, 1u);
    call(0x00416050u, state, 9u);
    std::fprintf(stderr, "[coop-read-fixture] Target disposed original-exit-request=9 pending=%u world-null=%u\n", rd32(state + 4), unsigned(!rd32(0x0071c68c)));
    stage = Stage::idle; context = world = 0;
    return true;
  }
} native_coop_phase2_readback;
bool native_coop_phase2_before_tick(X86 *c) {
  return native_coop_phase2_readback.finish(c);
}
// A single real original host, after its actual production pause. Exercise the
// full read leaf without inventing a committed barrier or a peer Loaded vote.
// Attach through the original setter for serialization, then dispose and exit.
// This performs no committed agreement, phase rebuild, Loaded vote or resume.
void native_coop_readback(X86 *c, const recomp_network_session_v1 &expected,
                          majesty::CoopPauseBoundary paused) {
  const uint64_t epoch = recomp_network_session_epoch();
  const uint32_t state = rd32(0x006d7670), manager = rd32(0x006d8568),
      settings = rd32(0x006d87a0), world = rd32(0x0071c68c);
  const std::string profile = mods_overlay_profile_dir();
  majesty::CoopLiveParty party;
  bool disposed = false;
  const char *readback_mode = recomp_env("NATIVE_COOP_WORLD_READBACK");
  const bool dispatch_rebuild = readback_mode && !std::strcmp(readback_mode, "v3");
  const bool rebuild_method = dispatch_rebuild ||
      (readback_mode && !std::strcmp(readback_mode, "v2"));
  uint32_t expected_frame = paused.frame;
  uint32_t attached_world = 0, attached_context = 0;
  const auto guard = [&] {
    recomp_network_session_v1 now{};
    majesty::CoopPlayerBinding selected;
    return c && sched_holds_baton() &&
        recomp_network_session_epoch() == epoch &&
        recomp_network_session_info(epoch, &now) && !std::memcmp(&now, &expected, sizeof now) &&
        mods_overlay_profile_dir() == profile && rd32(0x006d7670) == state &&
        rd32(0x006d8568) == manager && rd32(0x006d87a0) == settings &&
        gm_valid(state, 0x50) && gm_valid(manager, 0x2b0) &&
        gm_valid(settings, 0x4f8) && rd32(state) == 7 &&
        rd32(state + 4) == (attached_world ? 5u : 0u) &&
        rd32(state + 0x28) == expected_frame && rd32(0x0071c6a8) == paused.clock &&
        rd32(manager + 0x27c) == paused.owner &&
        majesty::coop_player_binding(expected, selected) && selected.slot == (expected.host ? 0u : 1u) &&
        (attached_world ? rd32(0x0071c68c) == attached_world &&
                          gm_valid(attached_world, 0x20) &&
                          rd32(attached_world) == 0x0067f85c &&
                          rd32(attached_world + 4) == attached_context &&
                          rd32(attached_world + 0x10) == attached_context &&
                          rd32(manager + 0xc0) == attached_context :
          disposed ? !rd32(0x0071c68c) : rd32(0x0071c68c) == world);
  };
  const auto fail = [&](const char *stage) {
    std::fprintf(stderr, "[coop-read-fixture] Refused stage=%s phase=%u pending=%u world=%08x frame=%u clock=%u owner=%u\n",
        stage, rd32(state), rd32(state + 4), rd32(0x0071c68c), rd32(state + 0x28),
        rd32(0x0071c6a8), rd32(manager + 0x27c));
    std::abort();
  };
  const char *incoming = recomp_env("NATIVE_COOP_WORLD_INCOMING_PAUSE");
  if (mods_hook_depth() || !epoch || expected.host > 1 ||
      expected.local_player != (expected.host ? 1u : 2u) ||
      (!expected.host && (!incoming || std::strcmp(incoming, "v1"))) || paused.owner != 1 ||
      profile.find("/output/native-multiplayer-lobby-") == profile.npos ||
      !profile.ends_with("/owned-profile") || !guard() || !party.capture(expected)) fail("admission");
  const uint32_t metadata = 0x006d7ce0u;
  const uint32_t names_before = (rd32(metadata + 0x48) - rd32(metadata + 0x44)) / 12;
  if (names_before != 2) fail("source-names");
  const char *host_readback = recomp_env("NATIVE_COOP_WORLD_HOST_READBACK");
  if (host_readback && (std::strcmp(host_readback, "v1") || expected.host ||
      !incoming || std::strcmp(incoming, "v1") || !dispatch_rebuild))
    fail("host-checkpoint-admission");
  const char *source_name = host_readback ? "Coop_Host_Checkpoint" : "Coop_World_Progress";
  const uint32_t source_name_size = uint32_t(std::strlen(source_name) + 1);
  if (host_readback)
    std::fprintf(stderr, "[coop-host-read-fixture] Original host checkpoint selected label=Coop_Host_Checkpoint local=2 slot=1 owner=1 clock=550 offline-copy=1 shared-barrier=0\n");
  uint32_t saved_gpl_seed = 0, saved_game_seed = 0, saved_clock = 0;
  if (rebuild_method && (!session_saved_rng(native_checkpoint_path(c, source_name),
      saved_gpl_seed, saved_game_seed, &saved_clock) || saved_clock != paused.clock))
    fail("saved-rng-admission");
  const uint32_t buffer = heap_alloc(source_name_size), label = heap_alloc(12, true),
      output = heap_alloc(4, true);
  if (!buffer || !label || !output) fail("arguments");
  std::memcpy(g_mem + buffer, source_name, source_name_size);
  CoopGenerationCallbacks callbacks;
  const std::array<uint32_t, 2> getter_entries = {0x00435d00u, 0x004401c0u};
  for (size_t i = 0; i < getter_entries.size(); ++i)
    if (mods_hook_install_ex(MODS_OWNER_RUNTIME, getter_entries[i], 0,
        CoopGenerationCallbacks::forward, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW,
        nullptr, &callbacks.handles[i]) != POP_OK) fail("getter-hooks");
  X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = label;
  guest_call(&extra, 0x004e3590, buffer, source_name_size - 1);
  extra = *c; extra.r[R_ESP] -= 32768;
  const uint32_t serializer = guest_call(&extra, 0x00435d00);
  extra = *c; extra.r[R_ESP] -= 32768;
  const uint32_t renderer_before = rd32(0x0071c844u);
  const uint32_t renderer = guest_call(&extra, 0x004401c0);
  const uint32_t renderer_table = renderer && gm_valid(renderer, 4) ? rd32(renderer) : 0;
  std::fprintf(stderr, "[coop-read-fixture] Renderer getter returned=%08x global-before=%08x global-after=%08x table=%08x\n",
      renderer, renderer_before, rd32(0x0071c844u), renderer_table);
  if (!renderer || !gm_valid(renderer, 0x4c) || renderer_table != 0x00681100u ||
      rd32(renderer_table + 0x30) != 0x005cd990u ||
      rd32(renderer_table + 0x44) != 0x005cd850u ||
      rd32(renderer_table + 0x50) != 0x00440710u) fail("renderer");
  if (!guard() || !callbacks.install_retirement()) fail("retirement-hook");
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = renderer;
  const uint32_t render_state = guest_call(&extra, rd32(rd32(renderer) + 0x30));
  std::fprintf(stderr, "[coop-read-fixture] Renderer state captured value=%u\n", render_state);
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = renderer;
  guest_call(&extra, rd32(rd32(renderer) + 0x44));
  std::fprintf(stderr, "[coop-read-fixture] Renderer suspended\n");
  callbacks.retirement_user = &guard; callbacks.retirement_state = state;
  callbacks.retirement_check = [](const void *p) {
    return (*static_cast<const decltype(guard) *>(p))();
  };
  disposed = true;
  std::fprintf(stderr, "[coop-read-fixture] Full source teardown begin original=004170a0\n");
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = state;
  guest_call(&extra, 0x004170a0);
  std::fprintf(stderr, "[coop-read-fixture] Full source teardown returned held=%u world=%08x\n", unsigned(callbacks.retirement_held), rd32(0x0071c68c));
  callbacks.retirement_user = nullptr; callbacks.retirement_check = nullptr;
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = manager;
  guest_call(&extra, 0x00497ca0, 0u);
  std::fprintf(stderr, "[coop-read-fixture] Original manager context cleared\n");
  if (!callbacks.retirement_held || !guard() ||
      !majesty::coop_retire_network_buffers(c, expected, paused) || !guard()) fail("source-disposal");
  std::fprintf(stderr, "[coop-read-fixture] Source disposed epoch=%llu frame=%u clock=%u owner=%u world-null=1 party-same=1\n",
      (unsigned long long)epoch, paused.frame, paused.clock, paused.owner);
  if (!read_coop_saved_context(c, serializer, label, output, settings, guard)) fail("original-reader");
  const uint32_t context = rd32(output);
  if (!gm_valid(context, 0x11c) || rd32(context) != 0x00682950)
    fail("typed-context");
  // The full reader returns a context before the attachment/start lifecycle
  // restores its time. Preserve and report that value; never manufacture a
  // matching save clock in this unattached reader component.
  const uint32_t context_clock = rd32(context + 0x4c);
  std::fprintf(stderr, "[coop-read-fixture] Unattached context clock=%u preserved-global-clock=%u\n",
      context_clock, rd32(0x0071c6a8));
  if (!party.restore(expected)) fail("restored-party");
  if (!majesty::coop_select_loaded_context(c, context, party.binding()) || !guard())
    fail("restored-selection");
  const uint32_t names_after = (rd32(metadata + 0x48) - rd32(metadata + 0x44)) / 12;
  if (names_after != names_before) fail("loaded-names");
  if (!guard()) fail("pre-attachment");
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = state;
  guest_call(&extra, 0x00415f30, context, 3u);
  attached_context = context;
  attached_world = rd32(0x0071c68c);
  if (!attached_world || !guard()) fail("original-attachment");
  std::fprintf(stderr, "[coop-read-fixture] Original attachment method=00415f30 kind=3 pending=5 rebuilt=0 party-same=1 clock=%u context-clock=%u\n",
      rd32(0x0071c6a8), rd32(context + 0x4c));
  if (dispatch_rebuild) {
    extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = label;
    guest_call(&extra, 0x004e3820); heap_free(output); heap_free(label); heap_free(buffer);
    native_coop_phase2_readback.arm(c, context, expected, paused, saved_gpl_seed,
        saved_game_seed, renderer, render_state, names_after, host_readback != nullptr);
    return; // Original outer dispatcher owns phase2 and the subsequent hold.
  }
  if (rebuild_method) {
    NativeCoopReadbackRebuildHold hold;
    hold.epoch = epoch; hold.party = expected; hold.state = state;
    hold.world = attached_world; hold.context = context;
    if (rd8(state + 0x4c) || mods_hook_install_ex(MODS_OWNER_RUNTIME,
        0x00416050u, 0, NativeCoopReadbackRebuildHold::phase, POP_HOOK_WRAP,
        POP_HOOK_NO_GAME_VIEW, &hold, &hold.handle) != POP_OK)
      fail("rebuild-method-admission");
    std::fprintf(stderr, "[coop-read-fixture] Original rebuild method begin entry=00416c30 phase=7 pending=5 dispatcher-phase2=0\n");
    const auto rebuild_boundary = [&] {
      recomp_network_session_v1 now{};
      return sched_holds_baton() && recomp_network_session_epoch() == epoch &&
          recomp_network_session_info(epoch, &now) && !std::memcmp(&now, &expected, sizeof now) &&
          rd32(0x006d7670) == state && rd32(0x006d8568) == manager &&
          rd32(0x006d87a0) == settings && mods_overlay_profile_dir() == profile &&
          rd32(state) == 7 && rd32(state + 4) == 5 && !rd8(state + 0x4c) &&
          rd32(0x0071c6a8) == paused.clock && rd32(0x0071c68c) == attached_world &&
          rd32(attached_world + 4) == context && rd32(attached_world + 0x10) == context;
    };
    CoopRebuildLoadingScope loading(rebuild_boundary);
    if (!loading.install()) fail("rebuild-loading-scope");
    session_ui_restore.begin(context, &rebuild_boundary, [](const void *p) {
      return (*static_cast<const decltype(rebuild_boundary) *>(p))();
    });
    extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = state;
    guest_call(&extra, 0x00416c30);
    session_ui_restore.end();
    expected_frame = 0;
    if (!loading.completed() || !hold.held || !guard() || rd32(context + 0x4c) != paused.clock)
      fail("rebuild-method-result");
    std::fprintf(stderr, "[coop-read-fixture] Original loading scope restored connection-owned=1 startup-votes-replayed=0 web-loaded-votes=0\n");
    std::fprintf(stderr, "[coop-read-fixture] Original rebuild method returned entry=00416c30 terminal-request3-held=1 phase=7 pending=5 frame=%u clock=%u context-clock=%u party-same=1 dispatcher-phase2=0 loaded-votes=0 resume-controls=0\n",
        rd32(state + 0x28), rd32(0x0071c6a8), rd32(context + 0x4c));
    // The production coordinator performs this same leaf after rebuild and
    // before its actual Loaded vote. Independently read this owned source's
    // saved RNG metadata; restore it without supplying any synthetic vote.
    if (!session_restore_rng(c, saved_gpl_seed, saved_game_seed) || !guard())
      fail("saved-rng-restoration");
    std::fprintf(stderr, "[coop-read-fixture] Saved RNG restored scripting=%u gameplay=%u clock=%u original-gpl-setter=00623720 original-game-setter=004f6710 loaded-votes=0\n",
        saved_gpl_seed, saved_game_seed, rd32(0x0071c6a8));
  }
  if (!majesty::coop_preserve_save_name(c, [&] {
      extra = *c; extra.r[R_ESP] -= 32768;
      return write_context_checkpoint(&extra, "Coop_World_Readback", context);
    }) || !guard()) fail("loaded-writer");
  std::fprintf(stderr, "[coop-read-fixture] Complete epoch=%llu local=%u slot=%u owner=%u frame=%u clock=%u names-before=%u names-after=%u original-reader=00435940 original-writer=004359c0 attached=1 rebuilt=%u party-same=1 loaded-votes=0 resume-controls=0 result=pass\n",
      (unsigned long long)epoch, expected.local_player, rd32(state + 0x24), paused.owner, expected_frame, paused.clock, names_before, names_after, unsigned(rebuild_method));
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = state;
  guest_call(&extra, 0x004170a0);
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = manager;
  guest_call(&extra, 0x00497ca0, 0u);
  extra = *c; extra.r[R_ESP] -= 32768;
  const uint32_t gpl = guest_call(&extra, 0x00623b20);
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = gpl;
  guest_call(&extra, 0x00623a70);
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = label;
  guest_call(&extra, 0x004e3820); heap_free(output); heap_free(label); heap_free(buffer);
  recomp_network_session_v1 final_party{};
  if (rd32(0x0071c68c) || rd32(state) != 7 || rd32(state + 4) != 6 ||
      rd32(state + 0x28) != expected_frame || rd32(0x0071c6a8) != paused.clock ||
      recomp_network_session_epoch() != epoch ||
      !recomp_network_session_info(epoch, &final_party) ||
      std::memcmp(&final_party, &expected, sizeof expected)) fail("target-disposal");
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = renderer;
  guest_call(&extra, rd32(rd32(renderer) + 0x50), render_state, 1u);
  extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = state;
  guest_call(&extra, 0x00416050, 9u);
  std::fprintf(stderr, "[coop-read-fixture] Target disposed original-exit-request=9 pending=%u world-null=%u\n",
      rd32(state + 4), unsigned(!rd32(0x0071c68c)));
}
#endif

extern "C" bool majesty_browser_coop_checkpoint_read(
    X86 *c, uint64_t epoch, uint32_t owner, uint32_t serial,
    const majesty::CoopTransition &target,
    const recomp_network_session_v1 &expected, uint32_t &context) {
  context = 0;
  static uint64_t consumed_epoch = 0;
  static uint32_t consumed_serial = 0;
  const char *enabled = recomp_env("RULE_COOP_SHARED_READ");
  if (!enabled || std::strcmp(enabled, "v1") || !c || !epoch || !serial ||
      !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      (consumed_epoch == epoch && consumed_serial == serial))
    return false;
  if (!target.target_saved ||
      !coop_retained_source.retained(epoch, serial, owner, target)) return false;
  majesty::CoopCheckpointIdentity source;
  if (!majesty_browser_coop_current_identity(epoch, source) ||
      target.world != source.world || target.content != source.content ||
      target.rules != source.rules || target.source_x != source.x ||
      target.source_y != source.y)
    return false;
  majesty::CoopPauseBoundary paused;
  majesty::CoopLiveParty party;
  if (!majesty::coop_pause_boundary(owner, paused) ||
      !party.capture(expected) || target.frame != paused.frame ||
      target.clock != paused.clock ||
      !std::binary_search(expected.players,
                          expected.players + expected.player_count, owner))
    return false;
  const uint32_t world = rd32(0x0071c68c), data = rd32(world + 4),
                 registry = rd32(world + 0x10);
  if (!data || !gm_valid(data, 0x11c) || rd32(data) != 0x00682950 ||
      !registry || !gm_valid(registry, 0x118) ||
      world != coop_retained_source.world ||
      data != coop_retained_source.context || registry != coop_retained_source.registry)
    return false;
  const std::string profile = mods_overlay_profile_dir();
  const uint32_t state = rd32(0x006d7670), manager = rd32(0x006d8568),
                 settings = rd32(0x006d87a0);
  if (!gm_valid(state, 0x50) || !gm_valid(manager, 0x2b0) ||
      !gm_valid(settings, 0x4f8) ||
      rd32(rd32(manager) + 0x20) != 0x00497ca0u) return false;
  bool disposed = false;
  const auto agreement = [&] {
    recomp_network_session_v1 current{};
    recomp_network_barrier_v1 barrier{};
    return recomp_network_session_info(epoch, &current) &&
           !std::memcmp(&current, &expected, sizeof current) &&
           recomp_network_barrier_snapshot(epoch, &barrier) &&
           majesty::coop_committed_read(barrier, expected, serial, target) &&
           rd32(0x006d7670) == state && rd32(0x006d8568) == manager &&
           rd32(0x006d87a0) == settings &&
           std::string_view(mods_overlay_profile_dir()) == profile &&
           (disposed ? !rd32(0x0071c68c) : rd32(0x0071c68c) == world &&
                       rd32(world + 4) == data && rd32(world + 0x10) == registry);
  };
  if (profile.empty() || !agreement())
    return false;
  majesty::CoopCheckpointIdentity identity = source;
  identity.x = target.target_x;
  identity.y = target.target_y;
  const std::string key =
      "CoopTransitions_" +
      std::string(majesty::coop_detail::text(identity.world)) + "_" +
      std::to_string(identity.x) + "_" + std::to_string(identity.y);
  const std::array<std::string, 2> labels = {key + "_0", key + "_1"};
  X86 scratch = *c;
  scratch.r[R_ESP] -= 32768;
  const std::array<std::string, 2> paths = {
      native_checkpoint_path(&scratch, labels[0]),
      native_checkpoint_path(&scratch, labels[1])};
  const auto slash = paths[0].find_last_of('/');
  if (slash == paths[0].npos ||
      paths[1].substr(0, paths[1].find_last_of('/')) !=
          paths[0].substr(0, slash))
    return false;
  const std::string parent = paths[0].substr(0, slash);
  if (!majesty::coop_checkpoint_parent(profile, parent) ||
      paths[0].substr(slash + 1) != labels[0] + ".GMP" ||
      paths[1].substr(slash + 1) != labels[1] + ".GMP")
    return false;
  const majesty::CoopCheckpointStore store(parent + "/" + key + ".checkpoint",
                                           paths, identity);
  const auto selected = store.read();
  if (selected.status != majesty::CoopCheckpointStore::Status::valid ||
      selected.revision != target.target_revision ||
      selected.bytes != target.target_bytes ||
      selected.clock != target.target_clock ||
      selected.digest != target.target_digest ||
      native_checkpoint_path(&scratch, labels[selected.slot],
                             WIN32_FILE_READ) != paths[selected.slot] ||
      !agreement())
    return false;
  const uint32_t buffer =
                     heap_alloc(uint32_t(labels[selected.slot].size() + 1)),
                 label = heap_alloc(12, true), output = heap_alloc(4, true);
  if (!buffer || !label || !output) {
    if (buffer)
      heap_free(buffer);
    if (label)
      heap_free(label);
    if (output)
      heap_free(output);
    return false;
  }
  std::memcpy(g_mem + buffer, labels[selected.slot].c_str(),
              labels[selected.slot].size() + 1);
  X86 extra = scratch;
  extra.r[R_ECX] = label;
  guest_call(&extra, 0x004e3590, buffer,
             uint32_t(labels[selected.slot].size()));
  extra = scratch;
  const uint32_t serializer = guest_call(&extra, 0x00435d00);
  extra = scratch;
  const uint32_t renderer = guest_call(&extra, 0x004401c0);
  uint32_t render_state = 0;
  const bool renderer_valid =
      renderer && gm_valid(renderer, 4) && gm_valid(rd32(renderer), 0x54);
  bool suspended = false;
  bool attempted = false, loaded = false;
  uint32_t owned = 0;
  CoopGenerationCallbacks callbacks;
  const auto retirement_guard = [&] {
    majesty::CoopPlayerBinding selected;
    return agreement() && rd32(state) == 7 && !rd32(state + 4) &&
           rd32(state + 0x28) == paused.frame &&
           rd32(0x0071c6a8) == paused.clock && rd32(manager + 0x27c) == owner &&
           majesty::coop_player_binding(expected, selected) &&
           selected.slot == party.binding().slot &&
           selected.player == party.binding().player;
  };
  majesty::CoopPauseBoundary before_read;
  if (serializer && gm_valid(serializer, 12) &&
      rd32(serializer) == 0x00680c60 && renderer_valid && agreement() &&
      majesty::coop_pause_boundary(owner, before_read) &&
      before_read.frame == paused.frame && before_read.clock == paused.clock &&
      retirement_guard() && callbacks.install_retirement()) {
    extra = scratch;
    extra.r[R_ECX] = renderer;
    render_state = guest_call(&extra, rd32(rd32(renderer) + 0x30));
    extra = scratch;
    extra.r[R_ECX] = renderer;
    guest_call(&extra, rd32(rd32(renderer) + 0x44));
    suspended = true;
    // One destructive attempt begins with the original full source teardown.
    // This removes UI/script bindings before the saved GPL state is read and
    // frees the source graph before allocating the target graph.
    consumed_epoch = epoch;
    consumed_serial = serial;
    attempted = true;
    callbacks.retirement_user = &retirement_guard;
    callbacks.retirement_state = state;
    callbacks.retirement_check = [](const void *opaque) {
      return (*static_cast<const decltype(retirement_guard) *>(opaque))();
    };
    disposed = true;
    extra = scratch; extra.r[R_ECX] = state;
    guest_call(&extra, 0x004170a0);
    callbacks.retirement_user = nullptr;
    callbacks.retirement_check = nullptr;
    extra = scratch; extra.r[R_ECX] = manager;
    guest_call(&extra, 0x00497ca0, 0u);
    if (callbacks.retirement_held && retirement_guard() &&
        coop_retained_source.retained(epoch, serial, owner, target) &&
        coop_same_record(selected, store.read()) &&
        majesty::coop_retire_network_buffers(c, expected, paused) &&
        retirement_guard()) {
      std::fprintf(stderr, "[coop-load] Source network buffers retired serial=%u\n", serial);
      // Match original front-end00463c56/00463c60: use reader mode1
      // and reset GPL before00435940 reconstructs it. party.restore below
      // restores the live multiplayer startup mode along with its roster.
      loaded = read_coop_saved_context(c, serializer, label, output,
                                       settings, retirement_guard);
      std::fprintf(stderr, "[coop-load] Saved source teardown epoch=%llu serial=%u pause-held=1 loaded=%u\n",
                   (unsigned long long)epoch, serial, unsigned(loaded));
    }
    if (loaded)
      owned = rd32(output);
  }
  extra = scratch;
  extra.r[R_ECX] = label;
  guest_call(&extra, 0x004e3820);
  heap_free(output);
  heap_free(label);
  heap_free(buffer);
  // The freed source address may be reused by the original allocator.
  const bool typed = disposed && owned && !rd32(0x0071c68c) &&
                     gm_valid(owned, 0x11c) && rd32(owned) == 0x00682950;
  // +9c is a map configuration property: fresh startup004bbedd copies the
  // generator's first word (configuration+38), and00435700 saves it. It is
  // not the simulation frame. The attachment coordinator verifies the target
  // frame/clock/RNG after rebuild; this leaf verifies the complete file digest.
  loaded = loaded && typed &&
           (!coop_connected_enabled() ||
            majesty::coop_connected_context(owned, target.target_x, target.target_y)) &&
           agreement() && party.restore(expected) &&
           majesty::coop_select_loaded_context(c, owned, party.binding()) &&
           agreement();
  if (!loaded) {
    if (typed) {
      extra = scratch;
      extra.r[R_ECX] = owned;
      guest_call(&extra, 0x004913d0, 1u);
    }
  }
  if (suspended) {
    extra = scratch;
    extra.r[R_ECX] = renderer;
    guest_call(&extra, rd32(rd32(renderer) + 0x50), render_state, 1u);
  }
  if (!loaded) {
    if (attempted)
      recomp_network_reject_session(epoch);
    return false;
  }
  context = owned;
  return true;
}

bool session_restore_rng(X86 *, uint32_t, uint32_t);
// Construct exactly one agreed fresh context using the original freestyle
// configuration/generator, without entering the solo menu or resetting the
// network provider. Every member has published its paused source before Ready.
static bool coop_generate_committed(X86 *c, uint64_t epoch, uint32_t owner,
    uint32_t serial, const majesty::CoopTransition &target,
    const recomp_network_session_v1 &expected, uint32_t &context) {
  context = 0;
  if (!coop_fresh_enabled() || target.target_saved || coop_fresh_construction.epoch ||
      !coop_retained_source.retained(epoch, serial, owner, target)) return false;
  majesty::CoopCheckpointIdentity source;
  majesty::CoopPauseBoundary paused;
  majesty::CoopLiveParty retained;
  if (!majesty_browser_coop_current_identity(epoch, source) ||
      source.world != target.world || source.content != target.content || source.rules != target.rules ||
      source.x != target.source_x || source.y != target.source_y ||
      !majesty::coop_pause_boundary(owner, paused) || paused.frame != target.frame ||
      paused.clock != target.clock || !retained.capture(expected)) return false;
  const uint32_t old_world = rd32(0x0071c68c), state = rd32(0x006d7670),
                 manager = rd32(0x006d8568), settings = rd32(0x006d87a0);
  const auto binding = retained.binding();
  if (old_world != coop_retained_source.world || !gm_valid(old_world, 0x20) ||
      rd32(old_world) != 0x0067f85cu || rd32(old_world + 4) != coop_retained_source.context ||
      rd32(old_world + 0x10) != coop_retained_source.registry ||
      !majesty::coop_connected_context(rd32(old_world + 4), source.x, source.y) ||
      rd32(rd32(manager) + 0x20) != 0x00497ca0u ||
      rd32(settings + 0x320) != expected.player_count) return false;
  const std::string profile = mods_overlay_profile_dir();
  auto destination = source;
  destination.x = target.target_x; destination.y = target.target_y;
  CoopCheckpointLocation target_location;
  if (!coop_checkpoint_location(c, destination, profile, target_location) ||
      !target_location.store().unvisited()) return false;
  bool disposed = false, clock_reset = false;
  const auto guard = [&] {
    recomp_network_session_v1 now{};
    recomp_network_barrier_v1 barrier{};
    majesty::CoopPlayerBinding selected;
    if (!recomp_network_session_info(epoch, &now) || std::memcmp(&now, &expected, sizeof now) ||
        !recomp_network_barrier_snapshot(epoch, &barrier) ||
        !majesty::coop_committed_generate(barrier, expected, serial, target) ||
        rd32(0x006d7670) != state || rd32(0x006d8568) != manager || rd32(0x006d87a0) != settings ||
        rd32(state) != 7 || rd32(state + 4) || rd32(state + 0x28) != paused.frame ||
        rd32(0x0071c6a8) != (clock_reset ? 0u : paused.clock) ||
        rd32(manager + 0x27c) != owner || profile != mods_overlay_profile_dir() ||
        !majesty::coop_player_binding(now, selected) || selected.slot != binding.slot ||
        selected.player != binding.player) return false;
    return disposed ? !rd32(0x0071c68c) : rd32(0x0071c68c) == old_world &&
        rd32(old_world + 4) == coop_retained_source.context &&
        rd32(old_world + 0x10) == coop_retained_source.registry;
  };
  if (!guard()) return false;
  // Original004bbb90 reserves0x138 bytes for this generator (+c4..+1fc)
  // and converts the0xdc-byte live freestyle settings through004bc540.
  const uint32_t configuration = heap_alloc(0x60, true), generator = heap_alloc(0x138, true),
                 snapshot = heap_alloc(0xdc, true);
  if (!configuration || !generator || !snapshot) {
    if (configuration) heap_free(configuration);
    if (generator) heap_free(generator);
    if (snapshot) heap_free(snapshot);
    return false;
  }
  std::memcpy(g_mem + snapshot, g_mem + settings + 0x74, 0xdc);
  const auto call = [&](uint32_t address, uint32_t self, auto... args) {
    X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = self;
    return guest_call(&extra, address, args...);
  };
  call(0x004ace50u, configuration);
  call(0x004bc540u, 0u, configuration, snapshot);
  const uint32_t seed = region_seed(target.target_x, target.target_y);
  call(0x004ae140u, configuration, 128u, 128u);
  call(0x004ae230u, configuration, seed);
  const uint32_t renderer = call(0x004401c0u, 0u);
  const bool renderer_valid = renderer && gm_valid(renderer, 4) && gm_valid(rd32(renderer), 0x54);
  bool constructed = false, success = false, suspended = false;
  // Qualify every needed registration before disposing the source world.
  CoopGenerationCallbacks callbacks;
  const bool callbacks_ready = callbacks.install();
  if (!callbacks_ready)
    std::fprintf(stderr, "[coop-generation] Callback installation refused serial=%u\n", serial);
  uint32_t owned = 0, render_state = 0;
  // Refuse malformed accumulated save metadata before destroying any graph.
  constexpr uint32_t metadata = 0x006d7ce0u;
  const uint32_t begin = rd32(metadata + 0x44), end = rd32(metadata + 0x48), capacity = rd32(metadata + 0x4c);
  const bool metadata_valid = end >= begin && capacity >= end && (end - begin) % 12 == 0 &&
      capacity - begin <= 8 * 12 && (!begin || gm_valid(begin, capacity - begin));
  if (callbacks_ready && renderer_valid && metadata_valid && rd32(configuration + 0x24) == 128 &&
      rd32(configuration + 0x28) == 128 && rd32(configuration + 0x30) == seed &&
      guard() && target_location.store().unvisited() &&
      coop_retained_source.retained(epoch, serial, owner, target) && guard()) {
    render_state = call(rd32(rd32(renderer) + 0x30), renderer);
    call(rd32(rd32(renderer) + 0x44), renderer); suspended = true;
    callbacks.retirement_user = &guard;
    callbacks.retirement_state = state;
    callbacks.retirement_check = [](const void *opaque) {
      return (*static_cast<const decltype(guard) *>(opaque))();
    };
    // Original full teardown retires interface/GPL bindings BEFORE deleting
    // the source graph, releasing the old interface's script references.
    // Target rebuild's missing-agent failure remains separately investigated.
    // The scoped final-phase hold preserves the network pause, not any graph.
    disposed = true;
    call(0x004170a0u, state);
    callbacks.retirement_user = nullptr;
    callbacks.retirement_check = nullptr;
    call(0x00497ca0u, manager, 0u);
    if (callbacks.retirement_held && guard() && target_location.store().unvisited() &&
        majesty::coop_retire_network_buffers(c, expected, paused) && guard()) {
      std::fprintf(stderr, "[coop-load] Source network buffers retired serial=%u\n", serial);
      std::fprintf(stderr, "[coop-generation] Original source interface/world teardown completed serial=%u pause-held=1\n", serial);
      call(0x00436680u, metadata);
      call(0x004365f0u, metadata);
      // Match original004bbe06/004bbe0c: downstream generation and the
      // serializer also consult the game's owning configuration, not only
      // the generator's seed. Its original assignment deep-copies strings.
      const uint32_t game = call(0x004d1080u, 0u);
      if (!game || !gm_valid(game, 0x2c8)) std::abort();
      call(0x004ad0f0u, game + 0x268, configuration);
      const uint32_t gpl = call(0x00623b20u, 0u);
      call(0x00623a70u, gpl);
      call(0x004c38b0u, 0u);
      if (guard() && session_restore_rng(c, seed, seed)) {
        auto &token = coop_fresh_construction;
        token = {}; token.epoch = epoch; token.serial = serial; token.target = target;
        token.party = expected; token.generator = generator; token.configuration = configuration;
        token.constructor_pending = true;
        call(0x004aef20u, generator, configuration, expected.player_count);
        constructed = true;
        if (!token.constructor_pending && guard() && token.agreement()) {
          token.generation_pending = true;
          owned = call(0x004b23d0u, generator);
          if (!token.generation_pending && guard() && token.agreement() && owned &&
              rd32(generator + 0x84) == owned &&
              majesty::coop_connected_context(owned, target.target_x, target.target_y)) {
            // The original startup004bbedd copies this map property and
            //004bbf17 resets the fresh clock; neither field is a phase write.
            wr32(owned + 0x9c, rd32(generator));
            wr32(0x0071c6a8, 0u); clock_reset = true;
            success = retained.restore(expected) && guard() &&
                      majesty::coop_select_loaded_context(c, owned, binding) && guard() &&
                      target_location.store().unvisited() &&
                      coop_retained_source.retained(epoch, serial, owner, target);
          }
        }
        token = {};
      }
    }
  }
  if (constructed) call(0x004b04c0u, generator);
  call(0x004ad0a0u, configuration);
  heap_free(snapshot); heap_free(generator); heap_free(configuration);
  if (!success && owned && gm_valid(owned, 0x11c) && rd32(owned) == 0x00682950u)
    call(0x004913d0u, owned, 1u);
  if (suspended) call(rd32(rd32(renderer) + 0x50), renderer, render_state, 1u);
  if (!success) {
    if (disposed) recomp_network_reject_session(epoch);
    return false;
  }
  context = owned;
  std::fprintf(stderr, "[coop-generation] Committed context epoch=%llu serial=%u region=%d_%d source-retained=1 source-disposed=1\n",
      (unsigned long long)epoch, serial, target.target_x, target.target_y);
  return true;
}

bool session_restore_rng(X86 *, uint32_t, uint32_t);
struct CoopLoadCoordinator {
  enum class Stage { idle, attaching, held, voted, resume_sent, failed };
  Stage stage = Stage::idle;
  uint64_t epoch = 0, consumed_epoch = 0, active_epoch = 0, live_generation = 0;
  uint32_t serial = 0, consumed_serial = 0, owner = UINT32_MAX, context = 0,
           world = 0, registry = 0, state = 0, manager = 0, settings = 0,
           gpl = 0, active_world = 0, match_type = 0, expected_gpl_seed = 0, expected_game_seed = 0;
  bool loaded = false;
  uint32_t script_trace = 0;
  uint32_t mapping_trace = 0, creation_trace = 0, agent_calls = 0,
           agent_enabled_calls = 0;
  bool script_reported = false;
  majesty::CoopTransition target;
  majesty::CoopTransitionWire wire;
  majesty::CoopPlayerBinding binding;
  majesty::CoopCheckpointIdentity active_identity;
  recomp_network_session_v1 party{};
  std::string profile;

  static void agent_creation(const PopModApi *api, pop_cpu_v1 *cpu,
                             PopHookInvocation *inv, void *user) {
    auto &self = *static_cast<CoopLoadCoordinator *>(user);
    if (self.stage == Stage::attaching) {
      ++self.agent_calls;
      if (rd32(0x006d16f0) & 8u) ++self.agent_enabled_calls;
    }
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
  }
  static void selected_unit(const PopModApi *api, pop_cpu_v1 *cpu,
                            PopHookInvocation *inv, void *user) {
    auto &self = *static_cast<CoopLoadCoordinator *>(user);
    const bool observe = self.stage == Stage::attaching &&
        gm_valid(cpu->esp, 4) && rd32(cpu->esp) == 0x00472d03u &&
        gm_valid(cpu->ecx, 0x20);
    const uint32_t ui = cpu->ecx,
                   id = observe ? rd32(ui + 0x1c) : 0,
                   factory = observe ? rd32(ui + 0x18) : 0;
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
    if (!observe) return;
    const uint32_t unit = cpu->eax;
    uint32_t agent = 0, found = 0;
    if (gm_valid(unit, 0x88)) {
      // Original00426700's native-property tree: header atunit+8,
      // root header+4, left/right atnode+0/+8, key/value at+c/+10.
      const uint32_t header = rd32(unit + 8), nil = rd32(0x006d7628);
      uint32_t node = gm_valid(header, 12) ? rd32(header + 4) : 0;
      for (uint32_t depth = 0; depth < 64 && node && node != nil &&
           node != header && gm_valid(node, 0x14); ++depth) {
        const uint32_t key = rd32(node + 0xc);
        if (key == 0x4541u) { found = 1; agent = rd32(node + 0x10); break; }
        node = rd32(node + (key < 0x4541u ? 8u : 0u));
      }
    }
    std::fprintf(stderr,
        "[coop-load] Castle query ui=%08x unit-id=%u unit=%08x factory=%08x context=%08x parent-context=%08x EA-present=%u EA=%u creation-calls=%u enabled-calls=%u flags=%08x\n",
        ui, id, unit, factory, self.context,
        gm_valid(unit, 0x88) ? rd32(unit + 0x84) : 0,
        found, agent, self.agent_calls, self.agent_enabled_calls,
        rd32(0x006d16f0));
  }

  static void script_agent(const PopModApi *api, pop_cpu_v1 *cpu,
                           PopHookInvocation *inv, void *user) {
    auto &self = *static_cast<CoopLoadCoordinator *>(user);
    // Pinned00625910's value getter saves104 bytes before pushing the
    // agent ID and the lookup return. The caller therefore lies112 bytes
    // above006236b0's entry stack. Observe the original lookup unchanged.
    const bool observe = self.stage == Stage::attaching &&
        !self.script_reported && gm_valid(cpu->esp, 0x80) &&
        rd32(cpu->esp) == 0x00625997u;
    const uint32_t id = observe ? rd32(cpu->esp + 4) : 0,
                   entry_sp = cpu->esp,
                   caller = observe ? rd32(cpu->esp + 0x70) : 0,
                   value = observe ? cpu->esi : 0,
                   argument = observe ? rd32(cpu->esp + 0x74) : 0;
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
    if (observe && !cpu->eax) {
      self.script_reported = true;
      std::fprintf(stderr,
          "[coop-load] Missing script agent id=%08x getter-caller=%08x value=%08x argument=%08x\n",
          id, caller, value, argument);
      // A bounded stack observation identifies candidate original call
      // returns for offline verification; it is not an unwound call chain.
      std::fprintf(stderr, "[coop-load] Script stack candidates");
      uint32_t count = 0;
      for (uint32_t offset = 0x70; offset < 8192 && count < 24; offset += 4) {
        if (entry_sp > STACK_TOP || offset > STACK_TOP - entry_sp ||
            !gm_valid(entry_sp + offset, 4)) break;
        const uint32_t address = rd32(entry_sp + offset);
        if (address >= 0x00400005u && address < 0x00660000u &&
            gm_valid(address - 5, 5) && rd8(address - 5) == 0xe8) {
          std::fprintf(stderr, " %x:%08x", offset, address);
          ++count;
        }
      }
      std::fprintf(stderr, "\n");
    }
  }
  void clear_script_trace() {
    for (uint32_t *handle : {&script_trace, &mapping_trace, &creation_trace}) {
      if (*handle && mods_hook_remove(MODS_OWNER_RUNTIME, *handle) != POP_OK)
        std::abort();
      *handle = 0;
    }
  }

  static bool enabled() {
    static const bool on = [] {
      const char *flag = recomp_env("RULE_COOP_SHARED_READ");
      return flag && !std::strcmp(flag, "v1");
    }();
    return on;
  }
  bool agreement(recomp_network_barrier_v1 &barrier) const {
    recomp_network_session_v1 current{};
    return recomp_network_session_info(epoch, &current) &&
           !std::memcmp(&current, &party, sizeof current) &&
           recomp_network_barrier_snapshot(epoch, &barrier) &&
           (majesty::coop_committed_read(barrier, party, serial, target) ||
            (coop_fresh_enabled() && majesty::coop_committed_generate(barrier, party, serial, target)) ||
            majesty::coop_resume_permission(barrier, party, serial, target,
                                            loaded));
  }
  bool roots() const {
    majesty::CoopPlayerBinding now;
    return world && world == rd32(0x0071c68c) && gm_valid(world, 0x18) &&
           rd32(world) == 0x0067f85cu &&
           state == rd32(0x006d7670) && gm_valid(state, 0x50) &&
           manager == rd32(0x006d8568) && gm_valid(manager, 0x2b0) &&
           settings == rd32(0x006d87a0) && gm_valid(settings, 0x4f8) &&
           context && context == rd32(world + 4) && gm_valid(context, 0x11c) &&
           rd32(context) == 0x00682950 &&
           rd32(context + 0x24) == binding.slot && registry == context &&
           registry == rd32(world + 0x10) && gm_valid(registry, 0x118) &&
           rd32(manager + 0xc0) == context &&
           rd32(manager + 0x218) == match_type &&
           std::string_view(mods_overlay_profile_dir()) == profile &&
           majesty::coop_player_binding(party, now) &&
           now.slot == binding.slot && now.player == binding.player;
  }
  bool clocks() const {
    return rd32(state + 0x28) == 0 && rd32(0x0071c6a8) == target.target_clock;
  }
  bool seeds() const {
    return gpl && gm_valid(gpl, 0x38) && rd32(gpl) == 0x0068c02c &&
           rd32(gpl + 0x20) == expected_gpl_seed &&
           rd32(gpl + 0x24) == expected_gpl_seed &&
           rd32(0x0071fc70) == expected_game_seed &&
           rd32(0x0071fc74) == expected_game_seed;
  }
  void stop_playing(X86 *c) const {
    const uint32_t current = rd32(0x006d7670);
    if (!c || !sched_holds_baton() || mods_hook_depth() ||
        !gm_valid(current, 0x50) || c->r[R_ESP] < STACK_LIMIT + 65536 ||
        c->r[R_ESP] > STACK_TOP)
      return;
    const uint32_t phase = rd32(current), pending = rd32(current + 4);
    // Preserve ordinary exit/cleanup. Both original pause and its phase setter
    // return early when current7 already equals the requested7, even pending3.
    // service() must skip the next original gameplay tick at phase3 entry;
    // this original setter then queues7 before any world/frame/clock update.
    if (phase != 2 && phase != 3 && phase != 7)
      return;
    if (pending && pending != 3 && pending != 7)
      return;
    const uint32_t live = rd32(0x0071c68c);
    const uint32_t next = gm_valid(live, 0x18) && rd32(live + 4) ? 7 : 1;
    X86 extra = *c;
    extra.r[R_ESP] -= 32768;
    extra.r[R_ECX] = current;
    guest_call(&extra, 0x00416050, next);
  }
  void fail(X86 *c, const char *reason) {
    clear_script_trace();
    if (stage != Stage::failed) {
      std::fprintf(stderr,
                   "[coop-load] Rejected epoch=%llu serial=%u reason=%s\n",
                   (unsigned long long)epoch, serial, reason);
      recomp_network_reject_session(epoch);
    }
    stage = Stage::failed;
    stop_playing(c);
  }
  void rebuilt(X86 *c) {
    if (stage != Stage::attaching)
      return;
    clear_script_trace();
    // Hold first. A provider query can discover loss/reset and must never
    // leave original phase2's pending3 eligible for one-sided advancement.
    if (!majesty::coop_hold_rebuilt_context(c, context, owner)) {
      fail(c, "rebuild-hold");
      return;
    }
    recomp_network_barrier_v1 barrier{};
    if (!roots() || !clocks() || !agreement(barrier) || barrier.stage != 2) {
      fail(c, "rebuilt-party");
      return;
    }
    stage = Stage::held;
    std::fprintf(
        stderr, "[coop-load] Held epoch=%llu serial=%u slot=%u clock=%u\n",
        (unsigned long long)epoch, serial, binding.slot, target.target_clock);
  }
  // Called before and after the original paused network/UI tick. It grants
  // no early return during a healthy pause: the original network pump runs.
  bool service(X86 *c, bool input_boundary = false) {
    if (stage == Stage::idle || stage == Stage::attaching)
      return false;
    const uint32_t live = rd32(0x0071c68c), current = rd32(0x006d7670);
    if (stage == Stage::failed) {
      if (!live || (live != world && (recomp_network_session_epoch() != epoch ||
                                      rd32(0x006d8568) != manager ||
                                      rd32(0x006d87a0) != settings))) {
        stage = Stage::idle;
        context = world = registry = state = manager = settings = gpl = 0;
        profile.clear();
        return false;
      }
      stop_playing(c);
      return gm_valid(current, 0x50) && rd32(current) == 3;
    }
    recomp_network_barrier_v1 barrier{};
    if (!roots() || !clocks() || !agreement(barrier)) {
      fail(c, "loaded-party");
      return gm_valid(current, 0x50) && rd32(current) == 3;
    }
    const uint32_t phase = rd32(state), pending = rd32(state + 4);
    const bool complete =
        majesty::coop_resume_permission(barrier, party, serial, target, loaded);
    if (phase == 3 || pending == 3) {
      if (!complete || !seeds() || rd32(manager + 0x27c) != UINT32_MAX) {
        fail(c, "early-resume");
        return phase == 3;
      }
      if (phase == 3 && !pending) {
        active_epoch = epoch;
        active_world = world;
        majesty::coop_detail::copy(majesty::coop_detail::text(target.world),
                                   active_identity.world);
        active_identity.content = target.content;
        active_identity.rules = target.rules;
        active_identity.x = target.target_x;
        active_identity.y = target.target_y;
        std::fprintf(stderr,
                     "[coop-load] Resumed epoch=%llu serial=%u region=%d_%d\n",
                     (unsigned long long)epoch, serial, target.target_x,
                     target.target_y);
        const auto resources = heap_stats();
        std::fprintf(stderr,
            "[coop-load] Resources epoch=%llu serial=%u heap-bytes=%llu blocks=%u world=%08x context=%08x\n",
            (unsigned long long)epoch, serial,
            (unsigned long long)resources.used_bytes, resources.used_blocks,
            world, context);
        stage = Stage::idle;
        context = world = registry = state = manager = settings = gpl = 0;
        profile.clear();
      }
      return false;
    }
    if (phase != 7 || pending || rd32(manager + 0x27c) != owner) {
      fail(c, "pause-boundary");
      return phase == 3;
    }
    if (!loaded) {
      if (barrier.stage != 2 || !session_restore_rng(c, expected_gpl_seed,
                                                     expected_game_seed)) {
        fail(c, "loaded-rng");
        return false;
      }
      X86 extra = *c;
      extra.r[R_ESP] -= 32768;
      gpl = guest_call(&extra, 0x00623b20);
      if (!roots() || !clocks() || !seeds() || !agreement(barrier) ||
          barrier.stage != 2 ||
          recomp_network_barrier_action(epoch, 3, serial, wire.bytes.data(),
                                        uint32_t(wire.size))) {
        fail(c, "loaded-vote");
        return false;
      }
      loaded = true;
      stage = Stage::voted;
      std::fprintf(stderr, "[coop-load] Loaded epoch=%llu serial=%u slot=%u\n",
                   (unsigned long long)epoch, serial, binding.slot);
      return false;
    }
    if (!seeds()) {
      fail(c, "paused-rng");
      return false;
    }
    // Original005a4250 replaces the outgoing secondary queue at tick entry.
    // Send only from004179a9's existing input seam, after that preparation
    // and before original005a4600 transmits it. Before/after-tick service
    // may observe permission, but cannot enqueue into a discarded batch.
    if (complete && party.host && input_boundary && stage != Stage::resume_sent) {
      if (party.local_player != owner ||
          !majesty::enqueue_coop_resume(c, owner)) {
        fail(c, "resume-send");
        return false;
      }
      stage = Stage::resume_sent;
      std::fprintf(stderr, "[coop-load] Resume queued epoch=%llu serial=%u\n",
                   (unsigned long long)epoch, serial);
    }
    return false;
  }
} coop_load;

#ifndef __EMSCRIPTEN__
// Owned native evidence only. Keep the admitted held graph so that a later
// original writer can observe real progress after the coordinator clears its
// transient loading pointers. This fixture never changes clocks or inputs.
static CoopLoadCoordinator native_coop_progress_held;
static bool native_coop_progress_armed = false;
static void native_coop_target_snapshot(X86 *c) {
  static bool captured = false;
  const char *flag = recomp_env("NATIVE_COOP_WORLD_TARGET_SNAPSHOT");
  if (!flag || captured) return;
  if (std::strcmp(flag, "v1")) std::abort();
  auto &p = coop_load;
  if (p.stage != CoopLoadCoordinator::Stage::voted || !p.loaded) return;
  const std::string profile = mods_overlay_profile_dir();
  recomp_network_barrier_v1 barrier{};
  if (!c || saving || !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      profile.find("/output/native-multiplayer-lobby-") == profile.npos ||
      !profile.ends_with("/owned-profile") || profile != p.profile ||
      p.epoch != 1 || p.serial != 1 || p.target.target_saved ||
      p.target.target_x != 1 || p.target.target_y != 0 || p.target.target_clock ||
      p.party.player_count != 2 || p.party.players[0] != 1 || p.party.players[1] != 2 ||
      p.party.local_player != (p.party.host ? 1u : 2u) ||
      p.binding.slot != (p.party.host ? 0u : 1u) ||
      !p.roots() || !p.clocks() || !p.seeds() || !p.agreement(barrier) ||
      barrier.stage != 2 || rd32(p.state) != 7 || rd32(p.state + 4) ||
      rd32(p.state + 0x28) || rd32(p.manager + 0x27c) != p.owner ||
      !coop_retained_source.retained(p.epoch, p.serial, p.owner, p.target))
    std::abort();
  const X86 before = *c;
  const uint32_t world = p.world, context = p.context;
  const auto unchanged = [&] {
    recomp_network_barrier_v1 current{};
    return p.stage == CoopLoadCoordinator::Stage::voted && p.loaded &&
      p.world == world && p.context == context && p.roots() && p.clocks() &&
      p.seeds() && p.agreement(current) && current.stage == 2 &&
      rd32(p.state) == 7 && !rd32(p.state + 4) && !rd32(p.state + 0x28) &&
      rd32(p.manager + 0x27c) == p.owner && mods_overlay_profile_dir() == profile &&
      coop_retained_source.retained(p.epoch, p.serial, p.owner, p.target);
  };
  X86 scratch = *c;
  scratch.r[R_ESP] -= 32768;
  const char *label = "Coop_World_Target";
  const std::string path = native_checkpoint_path(&scratch, label);
  if (!path.starts_with(profile + "/") || !path.ends_with("/Coop_World_Target.GMP") ||
      !unchanged()) std::abort();
  saving = true;
  const bool saved = majesty::coop_preserve_save_name(
      &scratch, [&] { return write_checkpoint(&scratch, label, world); });
  saving = false;
  if (!saved || !unchanged() || std::memcmp(c, &before, sizeof before)) std::abort();
  captured = true;
  if (const char *progress = recomp_env("NATIVE_COOP_WORLD_TARGET_PROGRESS")) {
    if (std::strcmp(progress, "v1") || native_coop_progress_armed) std::abort();
    native_coop_progress_held = p;
    native_coop_progress_armed = true;
  }
  std::fprintf(stderr,
      "[coop-target-fixture] Snapshot epoch=1 serial=1 local=%u slot=%u region=1_0 "
      "frame=0 clock=0 original-writer=1 source-retained=1 coordinator-loaded=1 "
      "peer-loaded=0 resume-controls=0 live-second-engine=0\n",
      p.party.local_player, p.binding.slot);
}

static void native_coop_target_progress_snapshot(X86 *c, bool frame_return) {
  static unsigned captured = 0;
  // Keep the first500 save at the original tick adapter. A frame-return
  // callback may run inside its input wait before gameplay RNG advances.
  if (frame_return && !captured) return;
  const char *flag = recomp_env("NATIVE_COOP_WORLD_TARGET_PROGRESS");
  if (!flag) return;
  if (std::strcmp(flag, "v1")) std::abort();
  const char *later_flag = recomp_env("NATIVE_COOP_WORLD_TARGET_LATER_PROGRESS");
  if (later_flag && std::strcmp(later_flag, "v1")) std::abort();
  if (captured >= (later_flag ? 2u : 1u)) return;
  const uint32_t snapshot_clock = captured ? 1000u : 500u;
  if (!native_coop_progress_armed || coop_load.stage != CoopLoadCoordinator::Stage::idle ||
      coop_load.active_epoch != 1) return;
  const uint32_t clock = rd32(0x0071c6a8);
  if (clock < snapshot_clock) return;
  auto &held = native_coop_progress_held;
  if (!held.roots() || !gm_valid(held.gpl, 0x38)) std::abort();
  const uint32_t frame = rd32(held.state + 0x28),
                 gpl_seed = rd32(held.gpl + 0x20),
                 gpl_current = rd32(held.gpl + 0x24),
                 game_seed = rd32(0x0071fc70),
                 game_current = rd32(0x0071fc74);
  const auto unchanged = [&] {
    recomp_network_barrier_v1 barrier{};
    return held.roots() && held.agreement(barrier) && barrier.stage == 3 &&
      coop_load.stage == CoopLoadCoordinator::Stage::idle &&
      coop_load.active_epoch == 1 && coop_load.active_world == held.world &&
      coop_load.active_identity.x == 1 && coop_load.active_identity.y == 0 &&
      rd32(held.state) == 3 && !rd32(held.state + 4) &&
      rd32(held.state + 0x28) == frame && rd32(0x0071c6a8) == snapshot_clock &&
      rd32(held.manager + 0x27c) == UINT32_MAX &&
      gm_valid(held.gpl, 0x38) && rd32(held.gpl) == 0x0068c02c &&
      rd32(held.gpl + 0x20) == gpl_seed && rd32(held.gpl + 0x24) == gpl_current &&
      rd32(0x0071fc70) == game_seed && rd32(0x0071fc74) == game_current &&
      coop_retained_source.retained(held.epoch, held.serial, held.owner, held.target);
  };
  if (!c || saving || !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      clock != snapshot_clock || frame != snapshot_clock / 50 || !unchanged()) std::abort();
  const X86 before = *c;
  X86 scratch = *c;
  scratch.r[R_ESP] -= 32768;
  const char *label = captured ? "Coop_Target_Later_Progress" : "Coop_Target_Progress";
  const std::string path = native_checkpoint_path(&scratch, label);
  if (!path.starts_with(held.profile + "/") ||
      !path.ends_with(std::string("/") + label + ".GMP") || !unchanged()) std::abort();
  saving = true;
  const bool saved = majesty::coop_preserve_save_name(
      &scratch, [&] { return write_checkpoint(&scratch, label, held.world); });
  saving = false;
  if (!saved || !unchanged() || std::memcmp(c, &before, sizeof before)) std::abort();
  ++captured;
  std::fprintf(stderr,
      "[%s] Snapshot epoch=1 serial=1 local=%u slot=%u region=1_0 "
      "frame=%u clock=%u original-writer=1 complete=1 running=1 source-retained=1 "
      "clock-input-phase-writes=0 live-second-engine=0\n",
      snapshot_clock == 500 ? "coop-progress-fixture" : "coop-later-progress-fixture",
      held.party.local_player, held.binding.slot, frame, snapshot_clock);
  // Queue the ordinary production action at an observed simulation boundary.
  // A wall-clock script cannot reproduce the source descriptor when startup
  // duration changes. This owned native fixture never edits a frame or input.
  if (snapshot_clock == 1000) {
    if (const char *request = recomp_env("NATIVE_COOP_WORLD_RETURN_AT_PROGRESS")) {
      if (std::strcmp(request, "v1") || !held.party.host ||
          !os_native_request_action("coop-travel-west")) std::abort();
      std::fprintf(stderr, "[coop-return-fixture] Production west action armed epoch=1 serial=1 frame=20 clock=1000 original-actions=1\n");
    }
  }
}

static void native_coop_saved_return_snapshot(X86 *c) {
  static bool captured = false;
  const char *flag = recomp_env("NATIVE_COOP_WORLD_RETURN_SNAPSHOT");
  if (!flag || captured) return;
  if (std::strcmp(flag, "v1")) std::abort();
  auto &p = coop_load;
  if (p.serial != 2 || p.stage != CoopLoadCoordinator::Stage::voted || !p.loaded) return;
  const std::string profile = mods_overlay_profile_dir();
  recomp_network_barrier_v1 barrier{};
  if (!c || saving || !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      profile.find("/output/native-multiplayer-lobby-") == profile.npos ||
      !profile.ends_with("/owned-profile") || profile != p.profile || p.epoch != 1 ||
      !p.target.target_saved || p.target.target_x || p.target.target_y || p.target.target_clock != 550 ||
      p.party.player_count != 2 || p.party.players[0] != 1 || p.party.players[1] != 2 ||
      p.party.local_player != (p.party.host ? 1u : 2u) ||
      p.binding.slot != (p.party.host ? 0u : 1u) || !p.roots() || !p.clocks() || !p.seeds() ||
      !p.agreement(barrier) || barrier.stage != 2 || rd32(p.state) != 7 || rd32(p.state + 4) ||
      rd32(p.manager + 0x27c) != p.owner ||
      !coop_retained_source.retained(p.epoch, p.serial, p.owner, p.target)) std::abort();
  const X86 before = *c;
  const uint32_t world = p.world, context = p.context;
  const auto unchanged = [&] {
    recomp_network_barrier_v1 current{};
    return p.stage == CoopLoadCoordinator::Stage::voted && p.loaded &&
      p.world == world && p.context == context && p.roots() && p.clocks() && p.seeds() &&
      p.agreement(current) && current.stage == 2 && rd32(p.state) == 7 && !rd32(p.state + 4) &&
      rd32(p.manager + 0x27c) == p.owner && mods_overlay_profile_dir() == profile &&
      coop_retained_source.retained(p.epoch, p.serial, p.owner, p.target);
  };
  X86 scratch = *c; scratch.r[R_ESP] -= 32768;
  const char *label = "Coop_World_Return_Target";
  const std::string path = native_checkpoint_path(&scratch, label);
  if (!path.starts_with(profile + "/") || !path.ends_with("/Coop_World_Return_Target.GMP") || !unchanged()) std::abort();
  saving = true;
  const bool saved = majesty::coop_preserve_save_name(
      &scratch, [&] { return write_checkpoint(&scratch, label, world); });
  saving = false;
  if (!saved || !unchanged() || std::memcmp(c, &before, sizeof before)) std::abort();
  captured = true;
  std::fprintf(stderr, "[coop-return-fixture] Snapshot epoch=1 serial=2 local=%u slot=%u region=0_0 frame=0 clock=550 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0\n",
      p.party.local_player, p.binding.slot);
}

// Serialize each later held world before replaying any peer Loaded. The
// qualifier reads these complete original files, rather than inferring rebuilt
// gameplay from a Loaded event or from the imported checkpoint alone.
static void native_coop_later_target_snapshot(X86 *c) {
  static std::array<bool, 17> captured{};
  const char *flag = recomp_env("NATIVE_COOP_WORLD_LATER_TARGET_SNAPSHOT");
  if (!flag) return;
  if (std::strcmp(flag, "v1")) std::abort();
  auto &p = coop_load;
  if (p.serial < 3 || p.serial > 16 || captured[p.serial] ||
      p.stage != CoopLoadCoordinator::Stage::voted || !p.loaded) return;
  const std::string profile = mods_overlay_profile_dir();
  recomp_network_barrier_v1 barrier{};
  if (!c || saving || !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      profile.find("/output/native-multiplayer-lobby-") == profile.npos ||
      !profile.ends_with("/owned-profile") || profile != p.profile || p.epoch != 1 ||
      p.party.player_count != 2 || p.party.players[0] != 1 || p.party.players[1] != 2 ||
      p.party.local_player != (p.party.host ? 1u : 2u) ||
      p.binding.slot != (p.party.host ? 0u : 1u) ||
      !p.roots() || !p.clocks() || !p.seeds() || !p.agreement(barrier) ||
      barrier.stage != 2 || rd32(p.state) != 7 || rd32(p.state + 4) ||
      rd32(p.manager + 0x27c) != p.owner ||
      !coop_retained_source.retained(p.epoch, p.serial, p.owner, p.target))
    std::abort();
  const X86 before = *c;
  const uint32_t serial = p.serial, world = p.world, context = p.context;
  const auto unchanged = [&] {
    recomp_network_barrier_v1 current{};
    return p.serial == serial && p.stage == CoopLoadCoordinator::Stage::voted && p.loaded &&
      p.world == world && p.context == context && p.roots() && p.clocks() && p.seeds() &&
      p.agreement(current) && current.stage == 2 && rd32(p.state) == 7 && !rd32(p.state + 4) &&
      rd32(p.manager + 0x27c) == p.owner && mods_overlay_profile_dir() == profile &&
      coop_retained_source.retained(p.epoch, serial, p.owner, p.target);
  };
  X86 scratch = *c; scratch.r[R_ESP] -= 32768;
  const std::string label = "Coop_World_Travel_Target_" + std::to_string(serial);
  const std::string path = native_checkpoint_path(&scratch, label);
  if (!path.starts_with(profile + "/") ||
      !path.ends_with("/" + label + ".GMP") || !unchanged()) std::abort();
  saving = true;
  const bool saved = majesty::coop_preserve_save_name(
      &scratch, [&] { return write_checkpoint(&scratch, label.c_str(), world); });
  saving = false;
  if (!saved || !unchanged() || std::memcmp(c, &before, sizeof before)) std::abort();
  captured[serial] = true;
  const auto resources = heap_stats();
  std::fprintf(stderr,
      "[coop-travel-target-fixture] Snapshot epoch=1 serial=%u local=%u slot=%u "
      "region=%d_%d saved=%u frame=0 clock=%u original-writer=1 source-retained=1 "
      "coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0 "
      "heap-bytes=%llu blocks=%u\n",
      serial, p.party.local_player, p.binding.slot, p.target.target_x,
      p.target.target_y, unsigned(p.target.target_saved), p.target.target_clock,
      (unsigned long long)resources.used_bytes, resources.used_blocks);
}
#endif

bool coop_cancel_source_input(X86 *c);
extern "C" void majesty_browser_coop_resume_input(X86 *c) {
#ifndef __EMSCRIPTEN__
  coop_rebuild_fixture.input(c);
  native_coop_pause_request.input(c);
#endif
  if (!CoopLoadCoordinator::enabled() || !c || !sched_holds_baton() ||
      mods_hook_depth() || !gm_valid(c->r[R_ESP], 4) ||
      rd32(c->r[R_ESP]) != 0x004179a9u ||
      c->r[R_ECX] != rd32(0x006d7670)) return;
  if (!coop_cancel_source_input(c)) coop_load.service(c, true);
}

namespace {
uint64_t coop_lobby_rejected_epoch = 0;
uint32_t coop_lobby_rejected_world = 0;
}
extern "C" bool
majesty_browser_coop_current_identity(uint64_t epoch,
                                      majesty::CoopCheckpointIdentity &out) {
  const char *name = recomp_env("RULE_COOP_WORLD"),
             *raw = recomp_env("RULE_COOP_REGION"),
             *network = recomp_env("NETWORK_MANIFEST");
  out = {};
  if (epoch && epoch == coop_lobby_rejected_epoch &&
      rd32(0x0071c68c) == coop_lobby_rejected_world) return false;
  if (!epoch || !majesty::coop_checkpoint_identity(
                    name ? name : "", raw ? raw : "0_0", content_identity(),
                    network ? network : "", loader_exe_sha256(), out))
    return false;
  if (coop_load.active_epoch == epoch) {
    if (!coop_load.active_world || coop_load.active_world != rd32(0x0071c68c) ||
        out.world != coop_load.active_identity.world ||
        out.content != coop_load.active_identity.content ||
        out.rules != coop_load.active_identity.rules) {
      out = {};
      return false;
    }
    out = coop_load.active_identity;
  }
  return true;
}

namespace {
struct CoopLobbyResumeObservation {
  majesty::CoopLobbyResume request;
  recomp_network_session_v1 party{};
  uint64_t epoch = 0;
  uint32_t context = 0;
  std::string profile, path;
  bool selected = false, seen = false, reading = false, loaded = false;
} coop_lobby_resume;
bool coop_lobby_resume_source(X86 *c, CoopCheckpointLocation &location) {
  auto &p = coop_lobby_resume;
  recomp_network_session_v1 current{};
  majesty::CoopCheckpointIdentity identity;
  if (!c || !p.epoch || !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      recomp_network_session_epoch() != p.epoch ||
      !recomp_network_session_info(p.epoch, &current) ||
      std::memcmp(&current, &p.party, sizeof current) ||
      p.profile != mods_overlay_profile_dir() ||
      !majesty_browser_coop_current_identity(p.epoch, identity) ||
      identity.world != p.request.identity.world ||
      identity.content != p.request.identity.content ||
      identity.rules != p.request.identity.rules ||
      identity.x != p.request.initial_x || identity.y != p.request.initial_y)
    return false;
  // COOP_REGION remains the original launch coordinate in the rules hash.
  // Only the verified reader input can select another saved coordinate.
  identity.x = p.request.identity.x;
  identity.y = p.request.identity.y;
  if (!coop_checkpoint_location(c, identity, p.profile, location) ||
      !majesty::coop_lobby_resume_local(p.request, location.store(), p.party.host != 0))
    return false;
  const auto slash = location.paths[0].find_last_of('/');
  const std::string expected = location.paths[0].substr(0, slash + 1) +
                               p.request.label() + ".GMP";
  if (!p.path.empty() && p.path != expected) return false;
  OsStat file{};
  if (os_lstat(expected.c_str(), &file) || !file.is_regular || file.is_symlink ||
      file.size != p.request.record.bytes ||
      loader_hash_file_bounded(expected.c_str(), p.request.record.bytes) !=
          majesty::coop_detail::text(p.request.record.digest)) return false;
  uint32_t seed = 0, game_seed = 0, clock = 0;
  if (!session_saved_rng(expected, seed, game_seed, &clock) ||
      clock != p.request.record.clock) return false;
  // File reads can yield in the browser. A departed peer or changed profile
  // cannot be admitted using the roster sampled before those reads.
  recomp_network_session_v1 final_party{};
  if (recomp_network_session_epoch() != p.epoch ||
      !recomp_network_session_info(p.epoch, &final_party) ||
      std::memcmp(&final_party, &p.party, sizeof final_party) ||
      p.profile != mods_overlay_profile_dir()) return false;
  p.path = expected;
  return true;
}
} // namespace

extern "C" bool majesty_browser_coop_lobby_resume_begin(X86 *c,
                                                       const char *label) {
  coop_lobby_resume = {};
  const char *hint = recomp_env("COOP_RESUME");
  const bool requested = hint && *hint;
  const auto refused = [] {
    coop_lobby_resume = {};
    std::fprintf(stderr, "[coop-resume] Refused checkpoint preflight\n");
    return false;
  };
  if (!coop_fresh_enabled() ||
      coop_load.stage != CoopLoadCoordinator::Stage::idle)
    return requested ? refused() : true;
  coop_lobby_rejected_epoch = 0;
  coop_lobby_rejected_world = 0;
  // A stopped-process lobby restore must earn its own admission. Neither a
  // previous world address nor a matching URL can retain the old ownership.
  coop_load.active_epoch = 0;
  coop_load.active_world = 0;
  coop_load.active_identity = {};
  ++coop_load.live_generation;
  if (!requested) return true;
  auto &p = coop_lobby_resume;
  p.selected = true;
  const char *chapter = recomp_env("RULE_FRONTIER_CHAPTER");
  if (!majesty::coop_lobby_resume_parse(hint, p.request) || !chapter ||
      std::to_string(p.request.chapter) != chapter) return refused();
  p.epoch = recomp_network_session_epoch();
  p.profile = mods_overlay_profile_dir();
  if (p.profile.empty() || !recomp_network_session_info(p.epoch, &p.party))
    return refused();
  if (p.party.player_count < 2) {
    coop_lobby_resume = {};
    std::fprintf(stderr, "[coop-resume] Waiting for partner before loading\n");
    return false;
  }
  CoopCheckpointLocation location;
  if (!label || !majesty::coop_lobby_resume_start_ready(p.request, p.party, label) ||
      !coop_lobby_resume_source(c, location)) return refused();
  return true;
}
extern "C" void majesty_browser_coop_lobby_resume_read(X86 *c,
                                                        const char *label) {
  auto &p = coop_lobby_resume;
  if (!p.selected || p.seen) return;
  p.seen = true;
  CoopCheckpointLocation location;
  if (!label || p.request.label() != label ||
      !coop_lobby_resume_source(c, location)) return;
  p.reading = true;
}
extern "C" void majesty_browser_coop_lobby_resume_result(uint32_t result,
                                                          uint32_t context) {
  auto &p = coop_lobby_resume;
  if (!p.reading) return;
  p.reading = false;
  if (!result && context && gm_valid(context, 4)) {
    p.context = context;
    p.loaded = true;
  }
}
extern "C" void majesty_browser_coop_lobby_resume_admit(X86 *c) {
  auto &p = coop_lobby_resume;
  if (!p.selected) return;
  const uint32_t world = rd32(0x0071c68c), settings = rd32(0x006d87a0);
  majesty::CoopPlayerBinding binding;
  CoopCheckpointLocation location;
  const bool admitted = p.loaded && world && gm_valid(world, 8) &&
      rd32(world + 4) == p.context && settings && gm_valid(settings, 0x70) &&
      rd32(settings + 0x6c) == 3 &&
      rd32(0x0071c6a8) == p.request.record.clock &&
      majesty::coop_player_binding(p.party, binding) &&
      coop_lobby_resume_source(c, location) &&
      world == rd32(0x0071c68c) && rd32(world + 4) == p.context &&
      settings == rd32(0x006d87a0) && rd32(settings + 0x6c) == 3 &&
      rd32(0x0071c6a8) == p.request.record.clock &&
      majesty::coop_player_binding(p.party, binding);
  if (admitted) {
    coop_load.active_epoch = p.epoch;
    coop_load.active_world = world;
    coop_load.active_identity = p.request.identity;
    std::fprintf(stderr,
        "[coop-resume] Admitted epoch=%llu region=%d_%d revision=%llu clock=%u\n",
        (unsigned long long)p.epoch, p.request.identity.x, p.request.identity.y,
        (unsigned long long)p.request.record.revision, p.request.record.clock);
  } else {
    // Also deny an unvisited guest profile: missing local metadata must not
    // let a failed lobby proof masquerade as an ordinary fresh-world capture.
    coop_lobby_rejected_epoch = recomp_network_session_epoch();
    coop_lobby_rejected_world = world;
    std::fprintf(stderr,
        "[coop-resume] Refused original-read=%u world-attached=%u\n",
        unsigned(p.loaded), unsigned(world && gm_valid(world, 8) && rd32(world + 4) == p.context));
  }
  // Proof is consumed once at original startup, never reused by later ticks.
  coop_lobby_resume = {};
}

extern "C" bool
majesty_browser_coop_checkpoint_capture_allowed(X86 *c, uint64_t epoch) {
  if (CoopLoadCoordinator::enabled()) {
    recomp_network_session_v1 party{};
    recomp_network_barrier_v1 barrier{};
    // The SDK clears the snapshot and returns0 when no proposal exists.
    // Pump first, then revalidate the actual party so loss cannot look idle.
    recomp_network_barrier_snapshot(epoch, &barrier);
    if (!recomp_network_session_info(epoch, &party)) return false;
    const bool retained = coop_retained_source.epoch == epoch &&
                          coop_retained_source.serial == barrier.serial;
    if (!majesty::coop_source_checkpoint_writable(party, barrier, retained)) {
      static uint64_t reported_epoch = 0;
      static uint32_t reported_serial = 0;
      if ((barrier.stage == 1 || barrier.stage == 2) &&
          (reported_epoch != epoch || reported_serial != barrier.serial)) {
        reported_epoch = epoch; reported_serial = barrier.serial;
        std::fprintf(stderr,
          "[coop-load] Source publication frozen epoch=%llu serial=%u stage=%u local=%u retained=%u\n",
          (unsigned long long)epoch, barrier.serial, barrier.stage,
          party.local_player, unsigned(retained));
      }
      return false;
    }
  }
  if (!coop_fresh_enabled()) return true;
  if (!c || !epoch || !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
    return false;
  majesty::CoopCheckpointIdentity identity;
  if (!majesty_browser_coop_current_identity(epoch, identity)) return false;
  const uint32_t world = rd32(0x0071c68c);
  const std::string profile = mods_overlay_profile_dir();
  CoopCheckpointLocation location;
  if (!world || profile.empty() ||
      !coop_checkpoint_location(c, identity, profile, location)) return false;
  const bool admitted = coop_load.active_epoch == epoch &&
                        coop_load.active_world == world;
  return location.store().capture_allowed(admitted) &&
         recomp_network_session_epoch() == epoch &&
         rd32(0x0071c68c) == world && profile == mods_overlay_profile_dir();
}

extern "C" void majesty_browser_coop_checkpoint_captured(
    uint64_t epoch, const majesty::CoopCheckpointIdentity &identity) {
  if (!coop_fresh_enabled()) return;
  // Only the successful serializer's final exact pause/party guard calls
  // here. Admit this source for later captures in the same live session.
  coop_load.active_epoch = epoch;
  coop_load.active_world = rd32(0x0071c68c);
  coop_load.active_identity = identity;
}

extern "C" void majesty_browser_coop_fresh_campaign() {
  if (!coop_fresh_enabled() ||
      coop_load.stage != CoopLoadCoordinator::Stage::idle) return;
  // Starting another match in the same room can reuse guest addresses.
  // A fresh campaign must establish ownership again; a committed travel
  // rebuild is attaching here and retains its in-flight source identity.
  coop_load.active_epoch = 0;
  coop_load.active_world = 0;
  coop_load.active_identity = {};
  coop_lobby_rejected_epoch = 0;
  coop_lobby_rejected_world = 0;
  ++coop_load.live_generation;
}

extern "C" bool
majesty_browser_coop_checkpoint_attach(X86 *c, uint64_t epoch, uint32_t owner,
                                       uint32_t serial,
                                       const majesty::CoopTransition &target,
                                       const recomp_network_session_v1 &party) {
  auto &p = coop_load;
  if (!p.enabled() || !c || !epoch || !serial || !sched_holds_baton() ||
      mods_hook_depth() || p.stage != CoopLoadCoordinator::Stage::idle ||
      (p.consumed_epoch == epoch && serial <= p.consumed_serial) ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
    return false;
  majesty::CoopPlayerBinding binding;
  majesty::CoopPauseBoundary paused;
  recomp_network_session_v1 current{};
  recomp_network_barrier_v1 barrier{};
  majesty::CoopTransitionWire wire;
  if (!majesty::coop_player_binding(party, binding) ||
      !majesty::coop_pause_boundary(owner, paused) ||
      (party.host && party.local_player != owner) ||
      !recomp_network_session_info(epoch, &current) ||
      std::memcmp(&party, &current, sizeof party) ||
      !recomp_network_barrier_snapshot(epoch, &barrier) ||
      !(majesty::coop_committed_read(barrier, party, serial, target) ||
        (coop_fresh_enabled() && majesty::coop_committed_generate(barrier, party, serial, target))) ||
      !majesty::encode_coop_transition(target, wire))
    return false;
  p.epoch = p.consumed_epoch = epoch;
  p.serial = p.consumed_serial = serial;
  p.owner = owner;
  p.party = party;
  p.target = target;
  p.expected_gpl_seed = target.target_saved ? target.target_gpl_seed : region_seed(target.target_x, target.target_y);
  p.expected_game_seed = target.target_saved ? target.target_game_seed : p.expected_gpl_seed;
  p.wire = wire;
  p.binding = binding;
  p.loaded = false;
  p.gpl = 0;
  p.profile = mods_overlay_profile_dir();
  p.state = rd32(0x006d7670);
  p.manager = rd32(0x006d8568);
  p.match_type = rd32(p.manager + 0x218);
  p.settings = rd32(0x006d87a0);
  p.world = rd32(0x0071c68c);
  p.registry = rd32(p.world + 0x10);
  p.context = rd32(p.world + 4);
  p.stage = CoopLoadCoordinator::Stage::attaching;
  p.script_reported = false;
  p.agent_calls = p.agent_enabled_calls = 0;
  const char *trace = recomp_env("TRACE_EXCEPTION");
  if (trace && !std::strcmp(trace, "1") &&
      (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x006236b0u, 0,
                           CoopLoadCoordinator::script_agent, POP_HOOK_WRAP,
                           POP_HOOK_NO_GAME_VIEW, &p, &p.script_trace) != POP_OK ||
       mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00481ec0u, 0,
                           CoopLoadCoordinator::selected_unit, POP_HOOK_WRAP,
                           POP_HOOK_NO_GAME_VIEW, &p, &p.mapping_trace) != POP_OK ||
       mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00628410u, 0,
                           CoopLoadCoordinator::agent_creation, POP_HOOK_WRAP,
                           POP_HOOK_NO_GAME_VIEW, &p, &p.creation_trace) != POP_OK)) {
    p.fail(c, "script-trace-registration");
    return false;
  }
  uint32_t context = 0;
  const bool prepared = target.target_saved
      ? majesty_browser_coop_checkpoint_read(c, epoch, owner, serial, target, party, context)
      : coop_generate_committed(c, epoch, owner, serial, target, party, context);
  if (!prepared) {
    p.fail(c, target.target_saved ? "checkpoint-read" : "fresh-generation");
    return false;
  }
  if (!p.agreement(barrier) || barrier.stage != 2) {
    X86 extra = *c;
    extra.r[R_ESP] -= 32768;
    extra.r[R_ECX] = context;
    guest_call(&extra, 0x004913d0, 1u);
    p.fail(c, "pre-attach-party");
    return false;
  }
  p.context = context;
  X86 extra = *c;
  extra.r[R_ESP] -= 32768;
  extra.r[R_ECX] = p.state;
  // Original00415f30 owns this single full context from this point. Kinds0/3
  // share the branch publishing both world+4 (selected-player context) and
  // world+10 (registry) through the original setters. Kind2 is registry-only.
  // The existing provider, match type and exact joined party remain checked.
  guest_call(&extra, 0x00415f30, context, 3u);
  p.world = rd32(0x0071c68c);
  p.registry = gm_valid(p.world, 0x18) ? rd32(p.world + 0x10) : 0;
  if (!p.roots() || !p.agreement(barrier) || barrier.stage != 2 ||
      !majesty::coop_queue_attached_rebuild(c, context, owner, barrier, party,
                                           serial, target) ||
      rd32(p.state) != 7 || rd32(p.state + 4) != 2) {
    p.fail(c, "attached-party");
    return false;
  }
  std::fprintf(stderr, "[coop-load] Committed rebuild queued epoch=%llu serial=%u\n",
               (unsigned long long)epoch, serial);
  if (coop_connected_enabled()) {
    // The source destructor retired its coordinate during original teardown.
    // Bind the admitted saved context only after ownership has transferred and
    // the exact committed party and original roots have been revalidated.
    if (!majesty::coop_connected_context(context, target.target_x, target.target_y)) {
      p.fail(c, "connected-return-geometry");
      return false;
    }
    const uint32_t hook = coop_generation.release_hook;
    coop_generation = {};
    coop_generation.release_hook = hook;
    coop_generation.epoch = epoch;
    coop_generation.party = party;
    auto &selected = coop_generation.selected;
    selected.enabled = true;
    selected.x = target.target_x;
    selected.y = target.target_y;
    selected.key = std::to_string(selected.x) + "_" + std::to_string(selected.y);
    selected.seed = region_seed(selected.x, selected.y);
    connected_boundary_policy.bind(context);
    std::fprintf(stderr,
        "[coop-load] Connected return bound epoch=%llu serial=%u region=%s\n",
        (unsigned long long)epoch, serial, selected.key.c_str());
  }
  std::fprintf(stderr, "[coop-load] Attached epoch=%llu serial=%u slot=%u\n",
               (unsigned long long)epoch, serial, binding.slot);
  return true;
}

// One frozen proposal owns at most three source handles, one received file and
// one 16 KiB notice. Service runs before attachment and does at most three
// protocol/file steps per original paused tick, preserving network/UI pumping.
struct CoopDeliveryCoordinator {
  struct Sender {
    uint32_t peer = 0;
    bool acknowledged = false;
    majesty::CoopCheckpointTransferFile file;
  };
  std::array<Sender, 3> senders{};
  majesty::CoopCheckpointTransferFile received;
  recomp_network_checkpoint_v1 notice{};
  recomp_network_session_v1 party{};
  majesty::CoopTransition target;
  majesty::CoopTransitionWire wire;
  majesty::CoopPlayerBinding binding;
  recomp_network_barrier_v1 before_begin{};
  uint64_t epoch = 0, generation = 0;
  uint32_t serial = 0, owner = 0, world = 0, context = 0, registry = 0,
           state = 0, manager = 0, settings = 0, match_type = 0;
  bool requested = false, local_target = false, ready = false,
       delivered = false, failed = false, recovering = false, resume_sent = false,
       unavailable = false;
  std::string profile, parent, source_path;

  void clear() {
    for (auto &sender : senders) {
      sender.file.reset();
      sender.peer = 0;
      sender.acknowledged = false;
    }
    received.reset();
    epoch = generation = 0;
    serial = owner = world = context = registry = state = manager = settings = match_type = 0;
    requested = local_target = ready = delivered = failed = recovering = resume_sent = unavailable = false;
    profile.clear();
    parent.clear();
    source_path.clear();
    party = {};
    target = {};
    wire = {};
    binding = {};
    before_begin = {};
    notice.action = notice.serial = notice.from = notice.to = notice.value =
        notice.bytes = 0;
  }
  bool canceled() const {
    recomp_network_session_v1 now{};
    recomp_network_barrier_v1 proposal{};
    return epoch && serial && (unavailable || wire.size) &&
           recomp_network_session_info(epoch, &now) &&
           !std::memcmp(&now, &party, sizeof now) &&
           recomp_network_barrier_snapshot(epoch, &proposal) &&
           (unavailable ? majesty::coop_source_abort_permission(before_begin, proposal)
                        : majesty::coop_canceled_source_permission(proposal, party, serial, target, owner));
  }
  bool source_roots() const {
    const majesty::CoopSourceResumeBoundary source{
        world, context, registry, state, manager, settings, match_type,
        target.frame, target.clock, binding};
    return coop_load.stage == CoopLoadCoordinator::Stage::idle &&
           generation == coop_load.live_generation &&
           std::string_view(mods_overlay_profile_dir()) == profile &&
           source.matches(party);
  }
  bool recover_cancel() {
    majesty::CoopPauseBoundary boundary;
    if (!canceled() || !source_roots() ||
        !majesty::coop_pause_boundary(owner, boundary) ||
        boundary.frame != target.frame || boundary.clock != target.clock)
      return false;
    if (!recovering) {
      for (auto &sender : senders) sender.file.reset();
      received.reset();
      recovering = true;
      if (unavailable)
        std::fprintf(stderr, "[coop-load] Unavailable epoch=%llu serial=%u source=%d_%d\n",
                     (unsigned long long)epoch, serial, target.source_x, target.source_y);
      else
        std::fprintf(stderr, "[coop-load] Canceled epoch=%llu serial=%u source=%d_%d\n",
                     (unsigned long long)epoch, serial, target.source_x, target.source_y);
    }
    return true;
  }
  bool recovery_service(X86 *c, bool input_boundary = false) {
    if (!recovering) return false;
    const uint32_t phase = gm_valid(state, 0x50) ? rd32(state) : UINT32_MAX,
                   pending = gm_valid(state, 0x50) ? rd32(state + 4) : UINT32_MAX;
    if (!canceled() || !source_roots()) {
      fail(c, "canceled-source-changed");
      return phase == 3;
    }
    if ((phase == 7 && pending == 3) || (phase == 3 && !pending)) {
      if (rd32(manager + 0x27c) != UINT32_MAX) {
        fail(c, "canceled-resume-owner");
        return phase == 3;
      }
      if (phase == 3) {
        std::fprintf(stderr, "[coop-load] Source resumed epoch=%llu serial=%u region=%d_%d\n",
                     (unsigned long long)epoch, serial, target.source_x, target.source_y);
        clear();
      }
      return false;
    }
    if (phase != 7 || pending || rd32(manager + 0x27c) != owner) {
      fail(c, "canceled-pause-boundary");
      return phase == 3;
    }
    // The same original input seam used by shared arrival preserves this
    // secondary control packet through tick preparation and network send.
    if (input_boundary && party.host && !resume_sent) {
      if (!majesty::enqueue_coop_resume(c, owner)) {
        fail(c, "canceled-resume-send");
        return false;
      }
      resume_sent = true;
      std::fprintf(stderr, "[coop-load] Source resume queued epoch=%llu serial=%u\n",
                   (unsigned long long)epoch, serial);
    }
    return false;
  }
  void fail(X86 *c, const char *reason) {
    if (!recovering && recover_cancel()) {
      return;
    }
    for (auto &sender : senders)
      sender.file.reset();
    received.reset();
    if (!failed) {
      std::fprintf(stderr,
                   "[coop-transfer] Rejected epoch=%llu serial=%u reason=%s\n",
                   (unsigned long long)epoch, serial, reason);
      recomp_network_reject_session(epoch);
    }
    recovering = false;
    failed = true;
    coop_load.stop_playing(c);
  }
  bool stopped(X86 *c) {
    if (!failed)
      return false;
    const uint32_t live = rd32(0x0071c68c), current = rd32(0x006d7670);
    if (!live || live != world) {
      clear();
      return false;
    }
    coop_load.stop_playing(c);
    return gm_valid(current, 0x50) && rd32(current) == 3;
  }
  bool agreement() const {
    recomp_network_session_v1 now{};
    recomp_network_barrier_v1 barrier{};
    majesty::CoopPauseBoundary boundary;
    majesty::CoopPlayerBinding selected;
    return generation == coop_load.live_generation &&
           recomp_network_session_info(epoch, &now) &&
           !std::memcmp(&now, &party, sizeof now) &&
           recomp_network_barrier_snapshot(epoch, &barrier) &&
           (majesty::coop_agreement_matches(barrier, party, serial, target,
                                            1) ||
            majesty::coop_agreement_matches(barrier, party, serial, target,
                                            2)) &&
           std::string_view(mods_overlay_profile_dir()) == profile &&
           rd32(0x0071c68c) == world && gm_valid(world, 0x18) &&
           rd32(world + 4) == context && gm_valid(context, 0x11c) &&
           rd32(context) == 0x00682950 && rd32(world + 0x10) == registry &&
           gm_valid(registry, 0x118) && rd32(0x006d7670) == state &&
           rd32(0x006d8568) == manager &&
           majesty::coop_pause_boundary(owner, boundary) &&
           boundary.frame == target.frame && boundary.clock == target.clock &&
           majesty::coop_player_binding(now, selected) &&
           selected.slot == binding.slot && selected.player == binding.player;
  }
  bool start(X86 *c, uint64_t joined, const recomp_network_session_v1 &members,
             const recomp_network_barrier_v1 &proposal,
             const majesty::CoopTransition &next) {
    majesty::CoopCheckpointIdentity identity;
    majesty::CoopPauseBoundary paused;
    majesty::CoopLiveParty retained;
    const uint32_t live_manager = rd32(0x006d8568);
    if (!gm_valid(live_manager, 0x2b0) || c->r[R_ESP] < STACK_LIMIT + 65536 ||
        c->r[R_ESP] > STACK_TOP ||
        (!target_saved(next) && !(coop_fresh_enabled() && !next.target_saved)) ||
        !majesty_browser_coop_current_identity(joined, identity) ||
        next.world != identity.world || next.content != identity.content ||
        next.rules != identity.rules || next.source_x != identity.x ||
        next.source_y != identity.y ||
        !majesty::coop_agreement_matches(proposal, members, proposal.serial,
                                         next, 1) ||
        !majesty::coop_pause_boundary(rd32(live_manager + 0x27c), paused) ||
        paused.frame != next.frame || paused.clock != next.clock ||
        !retained.capture(members))
      return false;
    const uint32_t host = rd32(live_manager + 0x27c);
    if (!std::binary_search(members.players,
                            members.players + members.player_count, host) ||
        bool(members.host) != (members.local_player == host))
      return false;
    clear();
    epoch = joined;
    generation = coop_load.live_generation;
    serial = proposal.serial;
    owner = host;
    party = members;
    target = next;
    binding = retained.binding();
    profile = mods_overlay_profile_dir();
    world = rd32(0x0071c68c);
    context = rd32(world + 4);
    registry = rd32(world + 0x10);
    state = rd32(0x006d7670);
    manager = live_manager;
    settings = rd32(0x006d87a0);
    match_type = rd32(manager + 0x218);
    if (!majesty::encode_coop_transition(target, wire) || profile.empty() ||
        !agreement())
      return false;
    identity.x = target.target_x;
    identity.y = target.target_y;
    const std::string key =
        "CoopTransitions_" +
        std::string(majesty::coop_detail::text(identity.world)) + "_" +
        std::to_string(identity.x) + "_" + std::to_string(identity.y);
    const std::array<std::string, 2> labels = {key + "_0", key + "_1"};
    X86 scratch = *c;
    scratch.r[R_ESP] -= 32768;
    const std::array<std::string, 2> paths = {
        native_checkpoint_path(&scratch, labels[0]),
        native_checkpoint_path(&scratch, labels[1])};
    const auto slash = paths[0].find_last_of('/');
    if (slash == paths[0].npos ||
        paths[1].substr(0, paths[1].find_last_of('/')) !=
            paths[0].substr(0, slash))
      return false;
    parent = paths[0].substr(0, slash);
    if (!majesty::coop_checkpoint_parent(profile, parent) ||
        paths[0].substr(slash + 1) != labels[0] + ".GMP" ||
        paths[1].substr(slash + 1) != labels[1] + ".GMP" || !agreement())
      return false;
    const majesty::CoopCheckpointStore store(parent + "/" + key + ".checkpoint",
                                             paths, identity);
    if (!target.target_saved) {
      local_target = coop_fresh_enabled() && store.unvisited();
      return local_target && agreement();
    }
    const auto selected = store.read();
    local_target =
        selected.status == majesty::CoopCheckpointStore::Status::valid &&
        selected.revision == target.target_revision &&
        selected.bytes == target.target_bytes &&
        selected.clock == target.target_clock &&
        selected.digest == target.target_digest &&
        native_checkpoint_path(&scratch, labels[selected.slot],
                               WIN32_FILE_READ) == paths[selected.slot];
    if (party.host && !local_target)
      return false;
    if (local_target)
      source_path = paths[selected.slot];
    return agreement();
  }
  static bool target_saved(const majesty::CoopTransition &t) {
    return t.target_saved && t.target_bytes &&
           t.target_bytes <= majesty::CoopCheckpointStore::maximum_bytes;
  }
  bool action(uint32_t kind, uint32_t peer, uint32_t value,
              const void *data = nullptr, uint32_t bytes = 0) {
    return agreement() &&
           recomp_network_checkpoint_action(epoch, kind, serial, peer, value,
                                            data, bytes) == 0 &&
           agreement();
  }
  bool handle() {
    if (notice.serial != serial || notice.to != party.local_player ||
        !agreement())
      return false;
    const auto guard = [&] { return agreement(); };
    if (party.host) {
      Sender *sender = nullptr;
      for (auto &item : senders)
        if (item.peer == notice.from)
          sender = &item;
      if (notice.action == 0) {
        if (sender)
          return false;
        for (auto &item : senders)
          if (!item.peer) {
            sender = &item;
            break;
          }
        if (!sender || !local_target ||
            !sender->file.open_source(profile, source_path, target.target_bytes,
                                      target.target_digest, guard))
          return false;
        sender->peer = notice.from;
        return action(1, sender->peer, uint32_t(target.target_bytes));
      }
      if (!sender || sender->acknowledged)
        return false;
      if (notice.action == 5) {
        if (!sender->file.complete() || notice.value != sender->file.sequence())
          return false;
        sender->file.reset();
        sender->acknowledged = true;
        return true;
      }
      if (notice.action != 3 || sender->file.complete() ||
          notice.value + 1 != sender->file.sequence())
        return false;
      const uint32_t sequence = sender->file.sequence();
      if (sender->file.offset() == sender->file.bytes())
        return sender->file.finish(guard) && action(4, sender->peer, sequence);
      uint32_t size = 0;
      return sender->file.read_chunk(sequence, notice.data, sizeof notice.data,
                                     size, guard) &&
             action(2, sender->peer, sequence, notice.data, size);
    }
    if (!requested || local_target || notice.from != owner)
      return false;
    if (notice.action == 1)
      return notice.value == target.target_bytes &&
             received.open_receiver(profile, parent, target.target_bytes,
                                    target.target_digest, guard) &&
             action(3, owner, 0);
    if (notice.action == 2)
      return received.write_chunk(notice.value, notice.data, notice.bytes,
                                  guard) &&
             action(3, owner, notice.value);
    if (notice.action == 4)
      return notice.value == received.sequence() && received.finish(guard) &&
             action(5, owner, notice.value);
    return false;
  }
  bool service(X86 *c) {
    if (!agreement()) {
      fail(c, "paused-party");
      return false;
    }
    if (!party.host && !local_target && !requested) {
      requested = true;
      if (!action(0, owner, 0, wire.bytes.data(), uint32_t(wire.size))) {
        fail(c, "request");
        return false;
      }
    }
    for (unsigned step = 0; step < 3; ++step) {
      if (!recomp_network_checkpoint_poll(epoch, &notice))
        break;
      if (!handle()) {
        fail(c, "delivery");
        return false;
      }
    }
    if (!agreement()) {
      fail(c, "delivery-party");
      return false;
    }
    recomp_network_barrier_v1 proposal{};
    if (!recomp_network_barrier_snapshot(epoch, &proposal)) {
      fail(c, "delivery-snapshot");
      return false;
    }
    if (proposal.stage == 2) {
      const bool complete =
          ready &&
          std::all_of(senders.begin(), senders.end(),
                      [](const auto &sender) {
                        return !sender.peer || sender.acknowledged;
                      }) &&
          (!requested || delivered);
      if (!complete) {
        fail(c, "premature-commit");
        return false;
      }
      clear(); // All handles closed and received file already imported before
               // attachment.
      return true;
    }
    if (!ready && (local_target || received.complete())) {
      const char *incoming = local_target ? nullptr : received.path().c_str();
      if (!majesty_browser_coop_checkpoint_ready(c, epoch, owner, serial,
                                                 target, party, incoming)) {
        fail(c, "ready");
        return false;
      }
      ready = true;
      if (received.complete()) {
        delivered = true;
        received.reset();
      } // Only our exclusive sibling; selected checkpoint is a copy.
      // Preserve the fact of verified delivery until Committed, after deleting
      // the now-imported temporary file. The SDK has its own completed lane.
    }
    return false;
  }
} coop_delivery;

static bool coop_prepare_unavailable_source(
    X86 *c, uint64_t epoch, uint32_t owner,
    const majesty::CoopCheckpointIdentity &source,
    const majesty::CoopCheckpointIdentity &destination,
    const recomp_network_session_v1 &party,
    const majesty::CoopPauseBoundary &paused,
    const recomp_network_barrier_v1 &previous) {
  auto &p = coop_delivery;
  majesty::CoopPlayerBinding selected;
  if (!c || !epoch || !sched_holds_baton() || mods_hook_depth() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      !party.host || party.local_player != owner || p.epoch || p.failed ||
      coop_load.stage != CoopLoadCoordinator::Stage::idle || previous.serial == UINT32_MAX ||
      !majesty::coop_player_binding(party, selected)) return false;
  p.clear();
  p.epoch = epoch; p.generation = coop_load.live_generation;
  p.owner = owner; p.party = party; p.binding = selected;
  // Local recovery correlation only. No Begin or target descriptor is sent;
  // the relay's actual proposal serial is unchanged and can still be reused.
  p.serial = previous.serial + 1; p.before_begin = previous; p.unavailable = true;
  p.target.world = source.world; p.target.content = source.content; p.target.rules = source.rules;
  p.target.source_x = source.x; p.target.source_y = source.y;
  p.target.target_x = destination.x; p.target.target_y = destination.y;
  p.target.frame = paused.frame; p.target.clock = paused.clock;
  p.profile = mods_overlay_profile_dir();
  p.world = rd32(0x0071c68c); p.state = rd32(0x006d7670);
  p.manager = rd32(0x006d8568); p.settings = rd32(0x006d87a0);
  if (gm_valid(p.world, 0x20)) {
    p.context = rd32(p.world + 4); p.registry = rd32(p.world + 0x10);
  }
  if (gm_valid(p.manager, 0x2b0)) p.match_type = rd32(p.manager + 0x218);
  if (p.profile.empty() || !p.recover_cancel()) { p.clear(); return false; }
  return true;
}

bool coop_cancel_source_input(X86 *c) {
  if (!coop_delivery.recovering) return false;
  coop_delivery.recovery_service(c, true);
  return true;
}

bool coop_load_before_tick(X86 *c) {
  if (!CoopLoadCoordinator::enabled() || !majesty::coop_outer_tick_boundary(c))
    return false;
  if (coop_delivery.failed)
    return coop_delivery.stopped(c);
  if (coop_delivery.recovering)
    return coop_delivery.recovery_service(c);
  if (coop_load.stage != CoopLoadCoordinator::Stage::idle)
    return coop_load.service(c);
  const uint32_t state = rd32(0x006d7670), manager = rd32(0x006d8568);
  static uint64_t enabled_epoch = 0;
  const uint64_t joined = recomp_network_session_epoch();
  if (joined && joined != enabled_epoch && gm_valid(manager, 0x2b0) &&
      majesty::coop_match_type(manager)) {
    recomp_network_session_v1 members{};
    majesty::CoopPlayerBinding local;
    if (recomp_network_session_info(joined, &members) &&
        majesty::coop_player_binding(members, local)) {
      enabled_epoch = joined; // One negotiation attempt per join, no RPC loop.
      if (recomp_network_barrier_enable(joined) ||
          recomp_network_checkpoint_enable(joined))
        std::fprintf(stderr, "[coop-load] Enable refused epoch=%llu\n",
                     (unsigned long long)joined);
    }
  }
  if (coop_delivery.epoch) {
    recomp_network_barrier_v1 existing{};
    if (!joined || joined != coop_delivery.epoch ||
        !recomp_network_barrier_snapshot(coop_delivery.epoch, &existing)) {
      coop_delivery.fail(c, "room-lost");
      return coop_delivery.stopped(c);
    }
    if (existing.stage == 4) {
      if (!coop_delivery.recover_cancel()) {
        coop_delivery.fail(c, "canceled-source");
        return coop_delivery.failed ? coop_delivery.stopped(c) : false;
      }
      return coop_delivery.recovery_service(c);
    } else if (existing.serial != coop_delivery.serial ||
               !coop_delivery.agreement()) {
      coop_delivery.fail(c, "proposal-changed");
      return coop_delivery.stopped(c);
    }
  }
  if (!gm_valid(state, 0x50) || rd32(state) != 7 || rd32(state + 4) ||
      !gm_valid(manager, 0x2b0) || !majesty::coop_match_type(manager))
    return false;
  const uint64_t epoch = recomp_network_session_epoch();
  recomp_network_session_v1 party{};
  recomp_network_barrier_v1 barrier{};
  majesty::CoopTransition target;
  if (!epoch || !recomp_network_session_info(epoch, &party) ||
      !recomp_network_barrier_snapshot(epoch, &barrier) ||
      (barrier.stage != 1 && barrier.stage != 2) ||
      barrier.descriptor_bytes > sizeof barrier.descriptor ||
      !majesty::decode_coop_transition(
          {reinterpret_cast<const char *>(barrier.descriptor),
           barrier.descriptor_bytes},
          target))
    return false;
  if (barrier.stage == 1 && !coop_delivery.epoch) {
    if (!coop_delivery.start(c, epoch, party, barrier, target)) {
      // start may have refused before assigning its frozen source identity.
      coop_delivery.epoch = epoch;
      coop_delivery.serial = barrier.serial;
      coop_delivery.world = rd32(0x0071c68c);
      coop_delivery.fail(c, "admission");
      return coop_delivery.stopped(c);
    }
  }
  if (coop_delivery.epoch) {
    if (!coop_delivery.service(c))
      return coop_delivery.failed ? coop_delivery.stopped(c) : false;
    if (!recomp_network_barrier_snapshot(epoch, &barrier) ||
        barrier.stage != 2) {
      recomp_network_reject_session(epoch);
      return false;
    }
  } else if (barrier.stage == 1) {
    return false;
  }
  const bool attached = majesty_browser_coop_checkpoint_attach(
      c, epoch, rd32(manager + 0x27c), barrier.serial, target, party);
  return attached || coop_load.stage != CoopLoadCoordinator::Stage::idle;
}
bool checkpoint(X86 *c, const Region &r, uint32_t world) {
  if (transfer_requested())
    return false; // A one-sided save cannot replace the jointly selected pair.
  // Mirror original autosave's renderer lifecycle at 004177f1..00417823:
  // retain its state, suspend rendering, write, then restore that state.
  X86 extra = *c;
  const uint32_t renderer = guest_call(&extra, 0x004401c0);
  if (!renderer || !gm_valid(renderer, 4))
    return false;
  const uint32_t vtable = rd32(renderer);
  if (!gm_valid(vtable, 0x54))
    return false;
  extra = *c;
  extra.r[R_ECX] = renderer;
  const uint32_t previous = guest_call(&extra, rd32(vtable + 0x30));
  extra = *c;
  extra.r[R_ECX] = renderer;
  guest_call(&extra, rd32(vtable + 0x44));
  std::string manifest;
  std::array<std::string, 2> paths;
  bool saved = false;
  if (checkpoint_store(c, r, manifest, paths)) {
    const CheckpointStore store(manifest, paths,
                                std::string(content_identity()));
    int legacy_slot = -1;
    bool available = true;
    OsStat marker{};
    if (os_lstat(manifest.c_str(), &marker) != 0) {
      OsStat stat{};
      if (os_lstat(paths[0].c_str(), &stat) == 0) {
        available =
            stat.is_regular && stat.size && checkpoint_identity_matches(r);
        legacy_slot = 0;
      }
    }
    const auto names = checkpoint_names(r);
    if (available) {
      // Opt-in qualification only: exercise failure after the original GMP
      // serializer succeeds, without modifying simulation or personal saves.
      const char *inject =
          recomp_env("BROWSER_FRONTIER_CHECKPOINT_FAIL_PUBLISH");
      const bool fail_publish = inject && !std::strcmp(inject, "1");
      const auto reject_publish = +[](const char *, const char *) {
        std::fprintf(stderr,
                     "[frontier] Checkpoint publication failure injected\n");
        return -1;
      };
      saved = store.commit(
          [&](int slot) { return write_checkpoint(c, names[slot], world); },
          legacy_slot, fail_publish ? reject_publish : os_rename);
      const char *debug = recomp_env("BROWSER_FRONTIER_CHECKPOINT_DEBUG");
      if (debug && !std::strcmp(debug, "1"))
        report_checkpoint(store.read());
    }
    win32_invalidate_dir_cache();
  }
  extra = *c;
  extra.r[R_ECX] = renderer;
  guest_call(&extra, rd32(vtable + 0x50), previous, 1u);
  return saved && (!halo_session_fixture() || halo_session_publish_layout(c, r));
}

// Publish only metadata for the checkpoint the original writer just selected.
// A failed sidecar write prevents travel; it never admits an unbound save.
// This private prototype does not claim a recoverable joint publication of
// the original manifest and the layout sidecar after a process interruption.
bool halo_session_publish_layout(X86 *c, const Region &r) {
#ifdef __EMSCRIPTEN__
  return false;
#else
  if (!halo_session_fixture() || !halo_session_root_valid()) return false;
  std::string manifest; std::array<std::string,2> paths;
  if (!checkpoint_store(c,r,manifest,paths)) return false;
  const auto selected = CheckpointStore(manifest,paths,std::string(content_identity())).read();
  if (selected.status != CheckpointStore::Status::valid || selected.size > 64*1024*1024) return false;
  const std::string text = halo_session_layout_text(r,selected);
  const std::string name = halo_session_binding.root + "/frontier_" + r.key + "/Halo_Restore.layout";
  const std::string temporary = name + ".tmp";
  OsStat st{}; errno = 0;
  if (text.size() > 512 || (os_lstat(name.c_str(),&st) == 0 && (!st.is_regular || st.is_symlink))) return false;
  const int fd = os_fd_open(temporary.c_str(),OS_O_WRONLY|OS_O_CREAT|OS_O_EXCL);
  if (fd < 0) return false;
  size_t at = 0;
  while (at < text.size()) { const int64_t n = os_fd_write(fd,text.data()+at,text.size()-at);
    if (n <= 0 || n > int64_t(text.size()-at)) break; at += size_t(n); }
  const bool flushed = at == text.size() && !os_fd_fsync(fd), closed = !os_fd_close(fd);
  const bool published = flushed && closed && !os_rename(temporary.c_str(),name.c_str());
  if (!published) os_unlink(temporary.c_str());
  if (!published || !halo_session_layout_matches(r,selected)) return false;
  std::fprintf(stderr,"[frontier] Halo session checkpoint layout key=%s slot=%d bytes=%llu source-sha256=%s root-bound=1 result=pass\n",
      r.key.c_str(),selected.slot,(unsigned long long)selected.size,selected.digest.c_str());
  return true;
#endif
}

#ifndef __EMSCRIPTEN__
struct HeroActivationTest {
  unsigned stage=0,ticks=0;uint32_t last=0,start=0,hooks=0;
  bool remote_move_replay=false;
  std::array<uint32_t,5> aliases{};std::array<int32_t,3> previous{},accepted{};
} hero_activation_test;
void hero_activation_test_snapshot(X86 *c,const char *name){
  const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c),clock=rd32(0x0071c6a8),hooks=mods_hooks_installed_count();
  if(rd32(state)!=7||rd32(state+4)||saving)std::abort();
  X86 extra=*c;extra.r[R_ESP]-=32768;saving=true;const bool ok=write_checkpoint(&extra,name,world);saving=false;
  if(!ok||rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=clock||rd32(0x0071c68c)!=world||mods_hooks_installed_count()!=hooks)std::abort();
}
bool hero_activation_test_before_tick(X86 *c){
  auto &s=hero_activation_test;if(!s.stage)return false;const uint32_t state=rd32(0x006d7670);
  if(!gm_valid(state,8))std::abort();
  if(s.stage==3){if(rd32(state)==3||(rd32(state)==7&&rd32(state+4)==3))std::abort();return false;}
  if(s.stage!=2)return false;
  if(rd32(0x0071c6a8)!=s.last)std::abort();if(rd32(state)==3&&rd32(state+4)==7)return false;
  if(rd32(state)!=7||rd32(state+4))std::abort();
  hero_activation_test_snapshot(c,"Hero_Activation_Crossed");
  majesty_browser_streaming_end_hero_arrival();
  std::array<int32_t,3> absent{};std::array<uint32_t,4> stats{};
  if(mods_hooks_installed_count()!=s.hooks||majesty_browser_streaming_active_hero_pose(c,absent.data(),stats.data()))std::abort();
  hero_activation_test_snapshot(c,"Hero_Activation_Closed");s.stage=3;
  std::fprintf(stderr,"[frontier] Hero activation test completed hero=%u agent=%u clock=%u ticks=%u original-pause=1 hooks-removed=1 binding-cleared=1 owner-published=0 result=pass\n",
    s.aliases[0],s.aliases[4],s.last,s.ticks);return false;
}
void hero_activation_test_after_tick(X86 *c){
  auto &s=hero_activation_test;if(s.stage!=1)return;
  const uint32_t clock=rd32(0x0071c6a8),state=rd32(0x006d7670);if(clock==s.last)return;
  if(s.remote_move_replay)std::fprintf(stderr,"[frontier] Hero remote Move replay tick clock=%u last=%u phase=%u pending=%u ticks=%u\n",
    clock,s.last,rd32(state),rd32(state+4),s.ticks);
  if(clock!=s.last+50||rd32(state)!=3||rd32(state+4)||++s.ticks>40)std::abort();
  std::array<uint32_t,4> stats{};
  const bool pose_valid=majesty_browser_streaming_active_hero_pose(c,s.accepted.data(),stats.data());
  if(s.remote_move_replay)std::fprintf(stderr,"[frontier] Hero remote Move replay pose valid=%u ticks=%u previous=%d,%d,%d accepted=%d,%d,%d ai=%u other-ai=%u contexts=%u commands=%u\n",
    unsigned(pose_valid),s.ticks,s.previous[0],s.previous[1],s.previous[2],s.accepted[0],s.accepted[1],s.accepted[2],stats[0],stats[1],stats[2],stats[3]);
  if(!pose_valid)std::abort();
  s.last=clock;
  if(s.remote_move_replay){
    // The captured original travel_to is delayed300ms; its first callback
    // can follow the first two movement ticks. Wait for original scheduling,
    // within the existing40-tick bound, without changing its saved timer.
    if(s.ticks<2||!stats[2])return;
    if(s.accepted==s.previous||!stats[0]||!stats[3])std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
    if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();s.stage=2;
    std::fprintf(stderr,"[frontier] Hero remote Move replay gameplay held hero=%u agent=%u from-clock=%u clock=%u previous=%d,%d,%d accepted=%d,%d,%d ai=%u other-ai=%u contexts=%u commands=%u ticks=%u original-movement=1 new-route=0 phase=3 pending=7 owner-published=0 result=pass\n",
      s.aliases[0],s.aliases[4],s.start,clock,s.previous[0],s.previous[1],s.previous[2],s.accepted[0],s.accepted[1],s.accepted[2],stats[0],stats[1],stats[2],stats[3],s.ticks);
    return;
  }
  if(s.accepted[0]>=64*2048){s.previous=s.accepted;return;}
  if(s.previous[0]<64*2048||s.accepted[0]<32*2048||s.accepted[1]<64*2048||s.accepted[1]>=4032*2048||
     !stats[0]||!stats[1]||!stats[2]||!stats[3])std::abort();
  X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
  if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();s.stage=2;
  std::fprintf(stderr,"[frontier] Hero active crossing hero=%u agent=%u clock=%u previous-clock=%u previous=%d,%d,%d accepted=%d,%d,%d ai=%u other-ai=%u contexts=%u commands=%u ticks=%u footprint=4 drawing=1 queued=1 original-movement=1 phase=3 pending=7 owner-published=0 result=pass\n",
    s.aliases[0],s.aliases[4],clock,clock-50,s.previous[0],s.previous[1],s.previous[2],s.accepted[0],s.accepted[1],s.accepted[2],stats[0],stats[1],stats[2],stats[3],s.ticks);
}
#endif

// Native-only driver for the shared production registration primitive. This
// keeps its isolated destination paused before its first original update.
// It is not a second-world browser loader or a custody transfer capability.
bool hero_home_registration_test_before_tick(X86 *c) {
#ifdef __EMSCRIPTEN__
  return false;
#else
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_HOME_TEST");
  if(!flag||std::strcmp(flag,"v1"))return false;
  static unsigned stage=0;if(stage==2)return false;
  const char *profile=recomp_env("PROFILE_DIR"),*digest=recomp_env("BROWSER_FRONTIER_HERO_HOME_TEST_BINDING"),
    *source=recomp_env("BROWSER_FRONTIER_HERO_HOME_TEST_SOURCE"),*mode=recomp_env("BROWSER_FRONTIER_HERO_HOME_TEST_MODE");
  const char *replay=recomp_env("BROWSER_FRONTIER_HERO_COLLISION_REPLAY_TEST");
  const bool collision_replay=replay&&!std::strcmp(replay,"v1");
  if(replay&&!collision_replay)std::abort();
  const char *move_replay=recomp_env("BROWSER_FRONTIER_HERO_REMOTE_MOVE_REPLAY_TEST");
  const bool remote_move_replay=move_replay&&!std::strcmp(move_replay,"v1");
  if(move_replay&&(!remote_move_replay||collision_replay||
     !recomp_env("BROWSER_FRONTIER_HERO_ARRIVAL_TEST")||
     std::strcmp(recomp_env("BROWSER_FRONTIER_HERO_ARRIVAL_TEST"),"v1")||
     !recomp_env("BROWSER_FRONTIER_HERO_ACTIVATION_TEST")||
     std::strcmp(recomp_env("BROWSER_FRONTIER_HERO_ACTIVATION_TEST"),"v1")))std::abort();
  const std::string key=remote_move_replay?"-3_-1":collision_replay?"-1_-1":"1_0";
  const std::string_view path(profile?profile:"");
  if(path.find("/actor-arrival-fixture-hero-home-")==path.npos||!path.ends_with("/frontier_"+key)||
    region().key!=key||!digest||std::strlen(digest)!=64||!source||std::strlen(source)!=64||!mode||
    (std::strcmp(mode,"register")&&std::strcmp(mode,"bad-digest")&&std::strcmp(mode,"wrong-counter")))std::abort();
  auto number=[](const char *key){
    const char *text=recomp_env(key);uint32_t n=0;if(!text)std::abort();const size_t length=std::strlen(text);
    const auto result=std::from_chars(text,text+length,n);
    if(!length||result.ec!=std::errc()||result.ptr!=text+length||std::to_string(n)!=text)std::abort();return n;
  };
  const uint32_t clock=number("BROWSER_FRONTIER_HERO_HOME_TEST_CLOCK"),bytes=number("BROWSER_FRONTIER_HERO_HOME_TEST_BYTES"),
    id=number("BROWSER_FRONTIER_HERO_HOME_TEST_ID"),state=rd32(0x006d7670),world=rd32(0x0071c68c);
  if(!gm_valid(state,0x50)||!gm_valid(world,0x14)||!rd32(world+4))return false;
  if(mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return true;
  if(finished||network_blocked||saving)std::abort();
  if(stage==0){
    if(rd32(state)!=3)return false;if(rd32(state+4))return true;
    std::string marker;std::array<std::string,2> paths;
    if(!restore_attempted||!checkpoint_store(c,region(),marker,paths)||rd32(0x0071c6a8)!=clock)std::abort();
    const auto selected=CheckpointStore(marker,paths,std::string(content_identity())).read();
    if(selected.status!=CheckpointStore::Status::valid||selected.digest!=source)std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
    if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();stage=1;
    std::fprintf(stderr,"[frontier] Hero home test pausing region=%s clock=%u phase=3 pending=7 ordinary-ticks=0\n",key.c_str(),clock);return true;
  }
  if(rd32(state)==3&&rd32(state+4)==7)return true;
  if(rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=clock)std::abort();
  stage=2;const uint32_t hooks=mods_hooks_installed_count();X86 extra=*c;extra.r[R_ESP]-=32768;
  auto snapshot=[&](const char *name){saving=true;const bool ok=write_checkpoint(&extra,name,world);saving=false;
    if(!ok||rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=clock||rd32(0x0071c68c)!=world||mods_hooks_installed_count()!=hooks)std::abort();};
  snapshot("Hero_Home_Before");
  const uint32_t actual=majesty_browser_streaming_register_hero_home(c,digest,bytes,clock,id,false);
  const bool refused=std::strcmp(mode,"register");
  if(refused){if(actual)std::abort();snapshot("Hero_Home_Refused");
    std::fprintf(stderr,"[frontier] Hero home test refused mode=%s region=1_0 clock=%u phase=7 ordinary-ticks=0 saved=1 result=pass\n",mode,clock);return false;}
  if(actual!=id)std::abort();snapshot("Hero_Home_Registered");
  if(majesty_browser_streaming_register_hero_home(c,digest,bytes,clock,id,true)!=id||
    majesty_browser_streaming_register_hero_home(c,digest,bytes,clock,id,false)||
    majesty_browser_streaming_register_hero_home(c,digest,bytes,clock+1,id,true))std::abort();
  snapshot("Hero_Home_Reused");
  std::fprintf(stderr,"[frontier] Hero home test completed region=%s agent=%u clock=%u phase=7 ordinary-ticks=0 saved=1 reuse-same=1 duplicate-refused=1 wrong-clock-refused=1 result=pass\n",key.c_str(),id,clock);
  const char *arrival=recomp_env("BROWSER_FRONTIER_HERO_ARRIVAL_TEST");
  if(arrival){
    if(std::strcmp(arrival,"v1"))std::abort();
    const char *bound=recomp_env("BROWSER_FRONTIER_HERO_ARRIVAL_TEST_BINDING");
    if(!bound||std::strlen(bound)!=64)std::abort();
    const uint32_t pack_bytes=number("BROWSER_FRONTIER_HERO_ARRIVAL_TEST_BYTES"),
      source_id=number("BROWSER_FRONTIER_HERO_ARRIVAL_TEST_UNIT"),source_agent=number("BROWSER_FRONTIER_HERO_ARRIVAL_TEST_AGENT"),
      source_clock=number("BROWSER_FRONTIER_HERO_ARRIVAL_TEST_CLOCK");
    std::array<uint32_t,5> aliases{};const std::string bad(64,'f');
    if(majesty_browser_streaming_import_hero_arrival(c,bad.c_str(),pack_bytes,source_id,source_agent,source_clock,clock,id,aliases.data())||
       majesty_browser_streaming_import_hero_arrival(c,bound,pack_bytes,source_id,source_agent,source_clock,clock+1,id,aliases.data())||
       std::any_of(aliases.begin(),aliases.end(),[](uint32_t v){return v!=0;}))std::abort();
    snapshot("Hero_Arrival_Refused");
    if(!majesty_browser_streaming_import_hero_arrival(c,bound,pack_bytes,source_id,source_agent,source_clock,clock,id,aliases.data())||
       !aliases[0]||!aliases[4]||aliases[1]||aliases[2]||aliases[3])std::abort();
    snapshot("Hero_Arrival_Imported");
    std::fprintf(stderr,"[frontier] Hero arrival test completed source=%u/%u hero=%u agent=%u proxy=%u clock=%u phase=7 ordinary-ticks=0 saved=1 bad-digest-refused=1 wrong-clock-refused=1 scheduled=0 activated=0 owner-published=0 result=pass\n",
      source_id,source_agent,aliases[0],aliases[4],id,clock);
    if(collision_replay){
      if(!majesty_browser_streaming_probe_hero_collision(c,aliases.data(),clock))std::abort();
      snapshot("Hero_Collision_Probe_After");return false;
    }
    const char *activation=recomp_env("BROWSER_FRONTIER_HERO_ACTIVATION_TEST");
    if(activation){
      if(std::strcmp(activation,"v1"))std::abort();
      auto invalid=aliases;invalid[1]=1;
      if(majesty_browser_streaming_activate_hero_arrival(c,invalid.data(),id,clock)||
         majesty_browser_streaming_activate_hero_arrival(c,aliases.data(),id,clock+1))std::abort();
      snapshot("Hero_Activation_Refused");
      auto &test=hero_activation_test;test.aliases=aliases;test.start=test.last=clock;test.hooks=hooks;
      if(!majesty_browser_streaming_activate_hero_arrival(c,aliases.data(),id,clock)||
         majesty_browser_streaming_activate_hero_arrival(c,aliases.data(),id,clock))std::abort();
      hero_activation_test_snapshot(c,"Hero_Activation_Ready");
      test.remote_move_replay=remote_move_replay;
      if(!remote_move_replay){
        const uint32_t goal_x=number("BROWSER_FRONTIER_HERO_ACTIVATION_TEST_GOAL_X"),goal_y=number("BROWSER_FRONTIER_HERO_ACTIVATION_TEST_GOAL_Y");
        if(!majesty_browser_streaming_route_hero_home(c,goal_x,goal_y))std::abort();
      }
      if(!majesty_browser_streaming_active_hero_pose(c,test.previous.data(),std::array<uint32_t,4>{}.data()))std::abort();
      hero_activation_test_snapshot(c,remote_move_replay?"Hero_Activation_Unrouted":"Hero_Activation_Routed");test.stage=1;
      extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,3u);
      if(rd32(state)!=7||rd32(state+4)!=3||rd32(0x0071c6a8)!=clock)std::abort();
    }
  }
  return false;
#endif
}

void selected_hero_save_abandon() {
  auto &b=selected_hero_binding();
  if(b.save_stage==SelectedHeroBinding::SaveStage::idle)return;
  std::fprintf(stderr,"[frontier] Hero save abandoned serial=%u region=%s\n",b.save_serial,b.key.c_str());
  b.save_stage=SelectedHeroBinding::SaveStage::idle;
}
bool selected_hero_departure_action(X86 *);
bool selected_hero_generation_action(X86 *);
bool selected_hero_refresh_save_owner(X86 *);
#ifndef __EMSCRIPTEN__
// Owned native drivers queue the ordinary browser action, rather than replacing
// its production consumer, when qualifying complete staged departures.
bool selected_hero_page_test(X86 *);
bool selected_hero_remote_retire_test(X86 *);
bool selected_hero_repeat_retire_test(X86 *);
std::string selected_hero_small_text(const std::string &,size_t);
bool selected_hero_capture_selected(X86 *,const std::string &,uint32_t,std::string &,std::string &);
uint32_t selected_hero_generation_test_count() {
  const char *repeat=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_GENERATION_TEST"),*count=recomp_env("BROWSER_FRONTIER_HERO_GENERATION_JOURNEYS");
  const bool again=repeat&&!std::strcmp(repeat,"v1");
  if(count){if(!again||std::strlen(count)!=1||count[0]<'3'||count[0]>'8')std::abort();return uint32_t(count[0]-'0');}
  return again?2u:1u;
}
const char *selected_hero_generation_test_region(uint32_t index) {
  constexpr const char *keys[]={"0_0","1_0","1_-1","0_-1","-1_-1","-2_-1","-3_-1","-4_-1","-5_-1"};
  if(index>=9)std::abort();return keys[index];
}
bool selected_hero_generation_request_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_GENERATION_TEST");if(!flag)return false;
  auto &b=selected_hero_binding();const char *raw=recomp_env("PROFILE_DIR");const std::string path(raw?raw:"");
  const uint32_t state=rd32(0x006d7670),clock=rd32(0x0071c6a8);
  const uint32_t count=selected_hero_generation_test_count();
  if(std::strcmp(flag,"v1")||!b.halo_layout||!b.admitted||b.closed||!b.save_serial||b.save_serial>count||
     b.key!=selected_hero_generation_test_region(b.save_serial-1)||clock!=b.save_clock||
     b.save_stage!=SelectedHeroBinding::SaveStage::held||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||
     !path.ends_with("/frontier_"+b.key)||!gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4))std::abort();
  const auto now=os_monotonic_ns();if(now-b.save_poll_ns<100000000u)return false;b.save_poll_ns=now;
  const auto marker=selected_hero_small_text(path+"/Frontier_Hero_Generation_Action.txt",128);
  if(marker.empty())return false;static uint32_t serial=0,sequence=0;
  if(serial!=b.save_serial){serial=b.save_serial;sequence=0;}
  const std::string prefix="majesty-hero-generation-action-v1|"+std::to_string(serial)+"|";
  if(!marker.starts_with(prefix)||marker.back()!='\n')std::abort();uint32_t next=0;
  const auto n=std::from_chars(marker.data()+prefix.size(),marker.data()+marker.size()-1,next);
  if(n.ec!=std::errc{}||n.ptr!=marker.data()+marker.size()-1||marker!=prefix+std::to_string(next)+"\n")std::abort();
  if(next==sequence)return false;if(next!=sequence+1)std::abort();sequence=next;
  if(!os_native_request_action(("frontier-hero-generate-"+std::to_string(serial)).c_str()))std::abort();
  return selected_hero_generation_action(c);
}
bool selected_hero_public_request_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_PUBLIC_REQUEST_TEST");if(!flag)return false;
  auto &b=selected_hero_binding();const char *raw=recomp_env("PROFILE_DIR");const std::string path(raw?raw:"");
  const uint32_t state=rd32(0x006d7670),clock=rd32(0x0071c6a8);
  if(std::strcmp(flag,"v1")||!b.halo_layout||!b.admitted||b.closed||clock!=b.save_clock||
     b.save_stage!=SelectedHeroBinding::SaveStage::held||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||
     !path.ends_with("/frontier_"+b.key)||!gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4))std::abort();
  if(b.save_serial!=1&&b.save_serial!=2&&b.save_serial!=4&&b.save_serial!=6)return false;
  const auto now=os_monotonic_ns();if(now-b.save_poll_ns<100000000u)return false;b.save_poll_ns=now;
  const auto ack=selected_hero_small_text(path+"/Frontier_Hero_Capture_Published.txt",512);
  if(ack.empty()||(b.save_serial!=1&&!ack.starts_with("majesty-hero-capture-published-v1|"+std::to_string(b.save_serial)+"|")))return false;
  std::string head,head_hash;
  if(!selected_hero_capture_selected(c,ack,clock,head,head_hash)){
    if(ack!=b.capture_last_refused){b.capture_last_refused=ack;
      std::fprintf(stderr,"[frontier] Hero captured publication refused serial=%u region=%s clock=%u phase=7 pending=0\n",b.save_serial,b.key.c_str(),clock);}return false;
  }
  static uint32_t serial=0,sequence=0;if(serial!=b.save_serial){serial=b.save_serial;sequence=0;}
  const auto marker=selected_hero_small_text(path+"/Frontier_Hero_Departure_Action.txt",128);
  const std::string prefix="majesty-hero-departure-action-v1|"+std::to_string(serial)+"|";
  if(marker.empty()||!marker.starts_with(prefix))return false;
  if(marker.back()!='\n')std::abort();uint32_t next=0;
  const auto n=std::from_chars(marker.data()+prefix.size(),marker.data()+marker.size()-1,next);
  if(n.ec!=std::errc{}||n.ptr!=marker.data()+marker.size()-1||marker!=prefix+std::to_string(next)+"\n")std::abort();
  if(next==sequence)return false;if(next!=sequence+1)std::abort();sequence=next;
  if(!os_native_request_action(("frontier-hero-travel-"+std::to_string(serial)).c_str()))std::abort();
  return selected_hero_departure_action(c);
}
bool selected_hero_retire_test(X86 *c) {
  if(recomp_env("BROWSER_FRONTIER_HERO_GENERATION_TEST"))return selected_hero_generation_request_test(c);
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_RETIRE_TEST");if(!flag)return false;
  if(recomp_env("BROWSER_FRONTIER_HERO_PUBLIC_REQUEST_TEST"))return selected_hero_public_request_test(c);
  auto &b=selected_hero_binding();if(b.proxy_home)return selected_hero_remote_retire_test(c);
  if(b.save_serial==4)return selected_hero_repeat_retire_test(c);
  const char *profile=recomp_env("PROFILE_DIR");const std::string_view path(profile?profile:"");
  const uint32_t clock=rd32(0x0071c6a8),state=rd32(0x006d7670);
  if(std::strcmp(flag,"1")||!b.halo_layout||b.key!="0_0"||!b.admitted||b.closed||b.save_serial!=1||clock!=b.save_clock||
     b.save_stage!=SelectedHeroBinding::SaveStage::held||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||
     !path.ends_with("/frontier_0_0")||!gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4))std::abort();
  std::string captured_head,captured_hash;
  if(recomp_env("BROWSER_FRONTIER_HERO_INITIAL_OWNER_MANIFEST")){
    const auto now=os_monotonic_ns();if(now-b.save_poll_ns<100000000u)return false;b.save_poll_ns=now;
    const std::string ack=selected_hero_small_text(std::string(path)+"/Frontier_Hero_Capture_Published.txt",512);
    if(ack.empty())return false;
    if(!selected_hero_capture_selected(c,ack,clock,captured_head,captured_hash)){
      if(ack!=b.capture_last_refused){b.capture_last_refused=ack;
        std::fprintf(stderr,"[frontier] Hero captured publication refused serial=1 region=0_0 clock=%u phase=7 pending=0\n",clock);}return false;
    }
  }
  if(const char *request=recomp_env("BROWSER_FRONTIER_HERO_SOURCE_REQUEST_TEST")){
    if(std::strcmp(request,"v1"))std::abort();
    // Private qualification queues exactly the ordinary named action. The
    // staged mailbox is inert until this monotonically numbered test event.
    static uint32_t sequence=0;const std::string marker=selected_hero_small_text(std::string(path)+"/Frontier_Hero_Departure_Action.txt",128);
    const std::string prefix="majesty-hero-departure-action-v1|1|";
    if(marker.empty())return false;
    if(!marker.starts_with(prefix)||marker.back()!='\n')std::abort();
    uint32_t next=0;const auto n=std::from_chars(marker.data()+prefix.size(),marker.data()+marker.size()-1,next);
    if(n.ec!=std::errc{}||n.ptr!=marker.data()+marker.size()-1||marker!=prefix+std::to_string(next)+"\n")std::abort();
    if(next==sequence)return false;if(next!=sequence+1)std::abort();sequence=next;
    if(!os_native_request_action(("frontier-hero-travel-"+std::to_string(b.save_serial)).c_str()))std::abort();
    return selected_hero_departure_action(c);
  }
  auto snapshot=[&](const char *name){return joint_fixture_checkpoint(c,name,"BROWSER_FRONTIER_HERO_RETIRE_TEST","0_0","actor-arrival-fixture-hero-binding-");};
  if(!snapshot("Hero_Source_Before"))std::abort();
  auto invalid=b.values;invalid[1]=UINT32_MAX;
  if(majesty_browser_streaming_retire_selected_hero(c,b.values.data(),clock+1)||
     majesty_browser_streaming_retire_selected_hero(c,invalid.data(),clock)||!snapshot("Hero_Source_Refused"))std::abort();
  if(!majesty_browser_streaming_retire_selected_hero(c,b.values.data(),clock)||!snapshot("Hero_Source_Retired")||
     majesty_browser_streaming_retire_selected_hero(c,b.values.data(),clock)||rd32(0x0071c6a8)!=clock||rd32(state)!=7||rd32(state+4))std::abort();
  b.retired_checkpoint="Hero_Source_Retired";
  b.closed=true;b.retired=true;b.before_valid=false;b.save_stage=SelectedHeroBinding::SaveStage::idle;
  if(!captured_head.empty()){
    b.owner_manifest=captured_head;
    std::fprintf(stderr,"[frontier] Hero first capture selected serial=1 region=0_0 clock=%u manifest-sha256=%s before-retirement=1 phase=7 pending=0\n",clock,captured_hash.c_str());
  }
  std::fprintf(stderr,"[frontier] Hero source retirement completed serial=1 region=0_0 unit=%u agent=%u clock=%u captured-save-preserved=1 retired-saved=1 wrong-clock-refused=1 wrong-alias-refused=1 duplicate-refused=1 binding-closed=1 phase=7 pending=0 owner-published=0 result=pass\n",b.values[1],b.values[2],clock);
  selected_hero_page_test(c);
  return true;
}
#endif
// Returns true only while an original dispatcher transition is pending.
// Held saves use ordinary phase7 input ticks, keeping menus and exit alive.
bool selected_hero_save_before_tick(X86 *c) {
  auto &b=selected_hero_binding();if(!b.enabled||!b.admitted||b.closed)return false;
  if(mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
  const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c),manager=rd32(0x006d8568);
  if(!gm_valid(state,0x50)||!gm_valid(world,0x14)||!gm_valid(manager,0x21c)||
     rd32(manager+0x218)==2||finished||network_blocked||region().key!=b.key){b.closed=true;selected_hero_save_abandon();return false;}
  const uint32_t phase=rd32(state),pending=rd32(state+4),clock=rd32(0x0071c6a8);
  auto transition=[&](uint32_t next){
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,next);
    if(rd32(state)!=phase||rd32(state+4)!=next||rd32(0x0071c6a8)!=clock)std::abort();
  };
  if(b.save_stage==SelectedHeroBinding::SaveStage::pausing){
    if(phase==3&&pending==7)return true;
    if(phase!=7||pending||clock!=b.save_clock){selected_hero_save_abandon();return false;}
    saving=true;const bool saved=checkpoint(c,region(),world);saving=false;
    if(rd32(0x0071c68c)!=world||rd32(0x0071c6a8)!=clock||rd32(state)!=7||rd32(state+4))std::abort();
    std::string manifest;std::array<std::string,2> paths;
    if(!saved||!checkpoint_store(c,region(),manifest,paths)){
      transition(3);b.save_stage=SelectedHeroBinding::SaveStage::resuming;
      std::fprintf(stderr,"[frontier] Hero save failed serial=%u region=%s clock=%u phase=7 pending=3\n",b.save_serial,b.key.c_str(),clock);return true;
    }
    const auto record=CheckpointStore(manifest,paths,std::string(content_identity())).read();uint32_t seed=0,game_seed=0,saved_clock=0;
    if(record.status!=CheckpointStore::Status::valid||!session_saved_rng(paths[record.slot],seed,game_seed,&saved_clock)||saved_clock!=clock)std::abort();
    b.save_stage=SelectedHeroBinding::SaveStage::held;
    std::fprintf(stderr,"[frontier] Hero save held serial=%u region=%s clock=%u slot=%d bytes=%llu sha256=%s phase=7 pending=0\n",
        b.save_serial,b.key.c_str(),clock,record.slot,(unsigned long long)record.size,record.digest.c_str());
  }
  if(b.save_stage==SelectedHeroBinding::SaveStage::resuming){
    if(phase==7&&pending==3)return true;
    if(phase!=3||pending||clock!=b.save_clock){selected_hero_save_abandon();return false;}
    b.save_stage=SelectedHeroBinding::SaveStage::idle;
    std::fprintf(stderr,"[frontier] Hero save resumed serial=%u region=%s clock=%u phase=3 pending=0\n",b.save_serial,b.key.c_str(),clock);
  }
  const uint64_t now=os_monotonic_ns();
  if(b.save_stage==SelectedHeroBinding::SaveStage::held){
    if(phase!=7||pending||clock!=b.save_clock){selected_hero_save_abandon();return false;}
#ifndef __EMSCRIPTEN__
    if(selected_hero_retire_test(c))return rd32(state)==4;
#endif
    if(now-b.save_poll_ns>=100000000u){
      b.save_poll_ns=now;
      if(selected_hero_departure_action(c)||selected_hero_generation_action(c))return rd32(state)==4;
      if(os_browser_take_action("frontier-hero-save-finish")){
        const std::string suffix="-"+std::to_string(b.save_serial);
        const bool saved=os_browser_take_action(("frontier-hero-save-saved"+suffix).c_str());
        const bool failed=!saved&&os_browser_take_action(("frontier-hero-save-failed"+suffix).c_str());
        if(saved||failed){
          if(saved&&!b.owner_manifest.empty()&&!selected_hero_refresh_save_owner(c)){
            std::fprintf(stderr,"[frontier] Hero save publication refused serial=%u region=%s clock=%u phase=7 pending=0\n",b.save_serial,b.key.c_str(),clock);return false;
          }
          transition(3);b.save_stage=SelectedHeroBinding::SaveStage::resuming;
          std::fprintf(stderr,"[frontier] Hero save released serial=%u region=%s clock=%u result=%s phase=7 pending=3\n",
              b.save_serial,b.key.c_str(),clock,saved?"saved":"failed");return true;
        }
      }
    }
    return false;
  }
  if(phase!=3||pending||saving||now-b.save_poll_ns<100000000u)return false;
  b.save_poll_ns=now;
  if(b.save_serial<UINT32_MAX&&os_browser_take_action("frontier-hero-save")){
    b.crossing_target.clear();++b.save_serial;b.save_clock=clock;transition(7);b.save_stage=SelectedHeroBinding::SaveStage::pausing;return true;
  }
  return false;
}

// Scalar sampling surrounds one ORIGINAL tick. A checked startup capsule ties
// the layout to the loaded saved kingdom; names alone cannot enable geometry.
bool selected_hero_current_pose(X86 *c,const SelectedHeroBinding &b,int32_t *pose,uint32_t *cells) {
  if(!b.proxy_home)return majesty_browser_streaming_selected_hero_pose(c,b.values.data(),pose,cells);
  auto binding=b.values;binding[0]=rd32(0x0071c6a8);uint32_t stats[4]{};
  if(!majesty_browser_streaming_active_hero_binding(c,binding.data())||!majesty_browser_streaming_active_hero_pose(c,pose,stats))return false;
  *cells=4;return true;
}
void selected_hero_motion_before_tick(X86 *c) {
  auto &b=selected_hero_binding();b.before_valid=false;
  if(!b.halo_layout||!b.admitted||b.failed||b.closed||b.save_stage!=SelectedHeroBinding::SaveStage::idle||
     finished||network_blocked||saving||region().key!=b.key)return;
  const uint32_t state=rd32(0x006d7670),manager=rd32(0x006d8568);
  if(!gm_valid(state,0x50)||rd32(state)!=3||rd32(state+4)||!gm_valid(manager,0x21c)||rd32(manager+0x218)==2)return;
  uint32_t cells=0;b.before_clock=rd32(0x0071c6a8);
  b.before_valid=selected_hero_current_pose(c,b,b.before_pose.data(),&cells);
  if(b.before_valid&&!b.motion_announced){
    b.motion_announced=true;
    std::fprintf(stderr,"[frontier] Hero halo observing region=%s unit=%u agent=%u clock=%u pose=%d,%d,%d native-cells=%u original-registry=1\n",
        b.key.c_str(),b.values[1],b.values[2],b.before_clock,b.before_pose[0],b.before_pose[1],b.before_pose[2],cells);
  }
#ifndef __EMSCRIPTEN__
  const char *move=recomp_env("BROWSER_FRONTIER_SELECTED_HERO_MOVE");
  if(b.before_valid&&!b.move_test_done&&move&&!std::strcmp(move,"v1")){
    b.move_test_done=true;auto binding=b.values;binding[0]=b.before_clock;
    if(!majesty_browser_streaming_selected_hero_test_move(c,binding.data()))
      std::fprintf(stderr,"[frontier] Selected hero original move refused region=%s\n",b.key.c_str());
  }
#endif
}
void selected_hero_motion_after_tick(X86 *c) {
  auto &b=selected_hero_binding();const bool before_valid=b.before_valid;b.before_valid=false;
  if(!before_valid||b.save_stage!=SelectedHeroBinding::SaveStage::idle||finished||network_blocked||
     region().key!=b.key||b.save_serial==UINT32_MAX)return;
  std::array<int32_t,3> accepted{};uint32_t cells=0;
  if(!selected_hero_current_pose(c,b,accepted.data(),&cells))return;
  const uint32_t clock=rd32(0x0071c6a8);
  if(clock<=b.before_clock||accepted==b.before_pose)return;
  if(b.motion_samples<UINT32_MAX)++b.motion_samples;
  if(b.motion_samples<=4)
    std::fprintf(stderr,"[frontier] Hero halo motion region=%s unit=%u agent=%u previous-clock=%u clock=%u previous=%d,%d,%d accepted=%d,%d,%d native-cells=%u original-tick=1\n",
        b.key.c_str(),b.values[1],b.values[2],b.before_clock,clock,b.before_pose[0],b.before_pose[1],b.before_pose[2],accepted[0],accepted[1],accepted[2],cells);
  constexpr int32_t low=64*2048,high=4032*2048,physical=4096*2048,core=3968*2048;
  const auto inside=[](const std::array<int32_t,3> &p){return p[0]>=low&&p[0]<high&&p[1]>=low&&p[1]<high;};
  if(!inside(b.before_pose)||inside(accepted))return;
  const int dx=accepted[0]<low?-1:accepted[0]>=high?1:0,dy=accepted[1]<low?-1:accepted[1]>=high?1:0;
  if(std::abs(dx)+std::abs(dy)!=1||std::abs(region().x+dx)>1000000||std::abs(region().y+dy)>1000000)return;
  const std::array<int32_t,3> projected={accepted[0]-dx*core,accepted[1]-dy*core,accepted[2]};
  for(const auto &p:{accepted,projected})for(size_t axis=0;axis<2;++axis)
    if(p[axis]<0||p[axis]>=physical||p[axis]/32768<2||p[axis]/32768>=254)return;
  auto binding=b.values;binding[0]=clock;
  if(!(b.proxy_home?majesty_browser_streaming_active_hero_binding(c,binding.data()):majesty_browser_streaming_selected_hero_ready(c,binding.data())))return;
  // A path can briefly step into the shared strip while still routing toward
  // a goal in this kingdom. Keep that original route here rather than pause
  // for an import that cannot represent its absolute goal in the neighbor.
  int32_t goal[2]={INT32_MIN,INT32_MIN};
  if(!majesty_browser_streaming_hero_path_goals_fit(c,binding.data(),-dx*3968,-dy*3968,goal)){
    if(b.navigation_deferred<UINT32_MAX)++b.navigation_deferred;
    if(b.navigation_deferred<=4)
      std::fprintf(stderr,"[frontier] Hero boundary deferred region=%s target=%d_%d unit=%u agent=%u clock=%u goal=%d,%d original-orders-preserved=1 original-gameplay-continues=1 phase=3 pending=0\n",
          b.key.c_str(),region().x+dx,region().y+dy,b.values[1],b.values[2],clock,goal[0],goal[1]);
    return;
  }
  const uint32_t state=rd32(0x006d7670);
  X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
  if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();
  ++b.save_serial;b.save_clock=clock;b.save_stage=SelectedHeroBinding::SaveStage::pausing;
  b.crossing_target=std::to_string(region().x+dx)+"_"+std::to_string(region().y+dy);
  std::fprintf(stderr,"[frontier] Hero crossing serial=%u region=%s target=%d_%d previous-clock=%u clock=%u unit=%u agent=%u previous=%d,%d,%d accepted=%d,%d,%d phase=3 pending=7 original-tick=1 native-cells=%u\n",
      b.save_serial,b.key.c_str(),region().x+dx,region().y+dy,b.before_clock,clock,b.values[1],b.values[2],
      b.before_pose[0],b.before_pose[1],b.before_pose[2],accepted[0],accepted[1],accepted[2],cells);
}

// One process, one loaded kingdom. The exclusive named-world lease belongs to
// the browser document; this engine path never keeps dormant guest objects.
struct RegionSession {
  enum class Stage { idle, leaving, unloaded } stage = Stage::idle;
  bool enabled = false, initialized = false;
  uint32_t exit_hook = 0, saved_world = 0, saved_clock = 0;
  uint32_t pending_seed = 0, pending_game_seed = 0;
  uint32_t home_import_phase = 0, home_import_source_clock = 0;
  uint64_t serial = 0, poll_ns = 0;
#ifndef __EMSCRIPTEN__
  uint32_t completed_ticks = 0;
#endif
  Region previous, target;
  std::string root;
  std::string refused_packet;
  // Temporary disposal observer: eight identities, no growing allocation list.
  uint32_t release_hook = 0, release_hooks_before = 0;
  std::array<uint32_t, 8> release_roots{}, release_freed{};
  HeapStats release_heap_before{};
  bool release_tracking = false;
  bool crossing_enabled = false, border_announced = false;
  int border_direction = -1;
  uint64_t border_since = 0, border_gesture = 0, camera_sample_serial = UINT64_MAX;
  uint32_t scroll_hook = 0;
  int32_t scroll_x = 0, scroll_y = 0;
  uint64_t scroll_ns = 0, scroll_serial = UINT64_MAX;
  uint32_t scroll_seen = 0, scroll_accepted = 0, camera_probe_remaining = 0;
  uint64_t camera_probe_ns = 0;
  bool camera_valid = false, arrival_pending = false;
  int arrival_direction = -1;
  int64_t camera_x = 0, camera_y = 0, arrival_source_x = 0, arrival_source_y = 0;
};
RegionSession &region_session() { static RegionSession value; return value; }
// Scalar admission survives source disposal. RegionSession retains only its
// existing eight temporary disposal roots, which it clears before target load.
struct SelectedHeroTravel {
  enum class Stage { idle,loading,pausing,initializing,generated,held,ready,resuming,failed } stage=Stage::idle;
  std::string target,digest,active_digest,retired_digest,ready_packet,published_head,published_manifest,last_refused;
  uint32_t clock=0;
  uint64_t active_size=0,retired_size=0,poll_ns=0,input_poll_ns=0;
  std::array<uint32_t,5> aliases{};
  uint32_t home_unit=0,home_agent=0;
  bool generating=false,initialized=false;
  uint32_t initialization_ticks=0,initialization_target_ticks=0;
#ifndef __EMSCRIPTEN__
  uint32_t generation_checks=0;
#endif
} selected_hero_travel;
void selected_hero_arrival_refused() {
  auto &t=selected_hero_travel;const auto &b=selected_hero_binding();t.stage=SelectedHeroTravel::Stage::failed;
  std::fprintf(stderr,"[frontier] Hero arrival refused serial=%u source=%s target=%s clock=%u phase=7 pending=0 captured-recovery-preserved=1 owner-published=0\n",
      b.save_serial,b.key.c_str(),t.target.c_str(),t.clock);
}
bool selected_hero_generation_geometry() {
  const auto &t=selected_hero_travel;const auto &b=selected_hero_binding();
  return (t.generating&&t.stage!=SelectedHeroTravel::Stage::idle&&region().key==t.target)||
      (b.generated_halo&&b.enabled&&b.admitted&&b.halo_layout&&region().key==b.key)||
      // A verified remote restore needs the saved layout during original view
      // construction, before the fully loaded hero can be admitted.
      (b.proxy_home&&b.enabled&&b.source_checked&&!b.failed&&b.halo_layout&&region().key==b.key);
}
#ifndef __EMSCRIPTEN__
uint32_t session_completed_ticks() { return region_session().completed_ticks; }
#endif

// 00438040 receives original (dx,dy,view-index) scroll input. The camera
// clamp can clear +54/+58 before idle, so retain only this input's scalars,
// time and session serial; never retain a camera pointer or alter the call.
void session_scroll(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
  auto &s = region_session();
  if (s.scroll_seen < UINT32_MAX) ++s.scroll_seen;
  const uint32_t state = rd32(0x006d7670);
  if (s.crossing_enabled && s.stage == RegionSession::Stage::idle && !finished && !network_blocked &&
      cpu->ecx == rd32(0x006d84b8) && gm_valid(cpu->esp, 16) && rd32(cpu->esp + 12) == 0 &&
      gm_valid(state, 8) && rd32(state) == 3 && !rd32(state + 4)) {
    s.scroll_x = int32_t(rd32(cpu->esp + 4)); s.scroll_y = int32_t(rd32(cpu->esp + 8));
    s.scroll_ns = os_monotonic_ns(); s.scroll_serial = s.serial;
    if (s.scroll_accepted < UINT32_MAX) ++s.scroll_accepted;
  }
  mods_call_next(api, inv, cpu);
}

void session_release_free(const PopModApi *api, pop_cpu_v1 *cpu,
                          PopHookInvocation *inv, void *) {
  auto &s = region_session();
  const bool tracking = s.release_tracking;
  const uint32_t pointer = tracking && gm_valid(cpu->esp + 4, 4)
                               ? rd32(cpu->esp + 4) : 0;
  const auto result = mods_call_next(api, inv, cpu);
  if (!tracking) return;
  if (result != POP_OK) std::abort();
  for (size_t i = 0; i < s.release_roots.size(); ++i)
    if (pointer && pointer == s.release_roots[i]) ++s.release_freed[i];
}

void session_release_begin(uint32_t world) {
  connected_boundary_policy.terrain = 0;
  auto &s = region_session();
  if (s.release_hook || s.release_tracking || mods_hook_depth() ||
      !sched_holds_baton() || !gm_valid(world, 0x20) ||
      rd32(world) != 0x0067f85c) std::abort();
  const uint32_t factory = rd32(world + 0x10);
  if (!factory || !gm_valid(factory, 0x8c)) std::abort();
  const uint32_t terrain = rd32(factory + 0x80), grid = rd32(factory + 0x88);
  if (!terrain || !grid || !gm_valid(terrain, 0x54) || !gm_valid(grid, 0x50) ||
      rd32(terrain + 0x30) != 128 || rd32(terrain + 0x34) != 128 ||
      rd32(terrain + 0x38) != 129 || rd32(terrain + 0x3c) != 129 ||
      rd32(grid + 0x48) != 256 || rd32(grid + 0x4c) != 256) std::abort();
  s.release_roots = {world, factory, terrain, grid, rd32(grid + 0x14), rd32(grid + 0x18),
                     rd32(terrain + 0x48), rd32(terrain + 0x4c)};
  constexpr std::array<uint32_t, 8> spans{4, 4, 4, 4, 256u * 256u * 4u,
                                         256u * 256u * 4u, 128u * 128u * 8u,
                                         129u * 129u * 24u};
  for (size_t i = 0; i < s.release_roots.size(); ++i) {
    if (!s.release_roots[i] || !gm_valid(s.release_roots[i], spans[i])) std::abort();
    for (size_t j = 0; j < i; ++j)
      if (s.release_roots[i] == s.release_roots[j]) std::abort();
  }
  s.release_freed.fill(0); s.release_hooks_before = mods_hooks_installed_count();
  s.release_heap_before = heap_stats();
  if (!heap_check().empty() ||
      mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x0064d4b6, 0, session_release_free,
                           POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr,
                           &s.release_hook) != POP_OK) std::abort();
  s.release_tracking = true;
}

void session_release_end() {
  auto &s = region_session();
  if (!s.release_hook || s.release_tracking || mods_hook_depth() ||
      mods_hook_remove(MODS_OWNER_RUNTIME, s.release_hook) != POP_OK ||
      mods_hooks_installed_count() != s.release_hooks_before) std::abort();
  s.release_hook = 0; s.release_roots.fill(0); s.release_freed.fill(0);
  std::fprintf(stderr, "[frontier] Session release observer removed serial=%llu hooks=%u retained-roots=0\n",
               (unsigned long long)s.serial, mods_hooks_installed_count());
}

std::string session_profile(const Region &r) {
  return region_session().root + "/frontier_" + r.key;
}
bool session_paths(const Region &r, std::string &manifest,
                   std::array<std::string, 2> &paths) {
  const auto profile = session_profile(r);
  manifest = profile + "/" + r.checkpoint + ".checkpoint";
  const auto names = checkpoint_names(r);
  for (size_t i = 0; i < paths.size(); ++i)
    paths[i] = profile + "/Documents/My Games/MajestyHD/SaveGame/" + names[i] + ".GMP";
  return true;
}

// Read the two original saved RNG values before Load Game's solo attachment
// reseeds them. Same audited SVGD-v10/GPL-v3 layout as residency_saved_rng;
// bounded metadata only, not a whole GMP buffer or a dormant native graph.
bool session_saved_rng(const std::string &path, uint32_t &seed,
                       uint32_t &game_seed, uint32_t *saved_clock) {
  seed = game_seed = 0;
  if (saved_clock)
    *saved_clock = 0;
  FILE *input = std::fopen(path.c_str(), "rb");
  if (!input)
    return false;
  bool ok = !std::fseek(input, 0, SEEK_END);
  const long length = ok ? std::ftell(input) : -1;
  ok = ok && length >= 272 && length <= 64 * 1024 * 1024 &&
       !std::fseek(input, 0, SEEK_SET);
  std::array<uint8_t, 1024> bytes{};
  const auto word = [&](unsigned at) {
    return uint32_t(bytes[at]) | uint32_t(bytes[at + 1]) << 8 |
           uint32_t(bytes[at + 2]) << 16 | uint32_t(bytes[at + 3]) << 24;
  };
  long at = 0;
  unsigned chunks = 0, found = 0, found_game = 0;
  while (ok && at < length) {
    ok = ++chunks <= 128 && length - at >= 16 &&
         std::fread(bytes.data(), 1, 16, input) == 16;
    if (!ok)
      break;
    const uint32_t size = word(4), version = word(8), count = word(12);
    ok = size <= uint32_t(length - at - 16);
    for (unsigned i = 0; i < 4; ++i)
      ok = ok && (bytes[i] == ' ' || (bytes[i] >= 'A' && bytes[i] <= 'Z'));
    if (chunks == 1)
      ok = ok && !std::memcmp(bytes.data(), "VERS", 4) && size == 256 &&
           version == 1 && !count;
    if (!ok)
      break;
    const long end = at + 16 + size;
    if (!std::memcmp(bytes.data(), "SVGD", 4)) {
      ok = !found_game++ && version == 10 && !count && size <= bytes.size() &&
           size >= 33 && std::fread(bytes.data(), 1, size, input) == size;
      if (ok) {
        unsigned cursor = 0;
        for (unsigned string = 0; string < 2 && ok; ++string) {
          const unsigned start = cursor;
          while (cursor < size && cursor - start < 128 && bytes[cursor])
            ++cursor;
          ok = cursor > start && cursor < size && cursor - start < 128;
          ++cursor;
        }
        ok = ok && cursor + 32 <= size;
        if (ok) {
          game_seed = word(cursor + 28);
          if (saved_clock)
            *saved_clock = word(cursor);
          ok = game_seed != 0;
        }
      }
    }
    if (!std::memcmp(bytes.data(), "GPL ", 4)) {
      ok = !found++ && size >= 40 && version == 1 && !count &&
           std::fread(bytes.data(), 1, 12, input) == 12 && word(0) == size &&
           word(4) == 3;
      if (ok) {
        seed = word(8);
        ok = seed && !std::fseek(input, end - 8, SEEK_SET) &&
             std::fread(bytes.data(), 1, 8, input) == 8 && !word(0) &&
             word(4) == UINT32_MAX;
      }
    }
    ok = ok && !std::fseek(input, end, SEEK_SET);
    at = end;
  }
  ok = ok && at == length && found == 1 && found_game == 1 &&
       !std::ferror(input);
  const bool result = std::fclose(input) == 0 && ok;
  if (!result) {
    seed = game_seed = 0;
    if (saved_clock)
      *saved_clock = 0;
  }
  return result;
}
extern "C" bool majesty_browser_coop_saved_metadata(const char *path,
                                                    uint32_t &clock,
                                                    uint32_t &seed,
                                                    uint32_t &game_seed) {
  clock = seed = game_seed = 0;
  if (!path)
    return false;
  size_t length = 0;
  while (length < 1024 && path[length])
    ++length;
  return length && length < 1024 &&
         session_saved_rng(std::string(path, length), seed, game_seed, &clock);
}

enum class SessionAdmission { refused, fresh, saved };
SessionAdmission session_admit(const Region &r, std::string &name,
                               uint32_t &seed, uint32_t &game_seed) {
  std::string manifest; std::array<std::string, 2> paths;
  session_paths(r, manifest, paths);
  // OPFS has no symlinks; native hosts must also preserve named-world path
  // ownership through every directory rather than following a neighbor link.
  for (const auto &path : {region_session().root, session_profile(r),
       session_profile(r) + "/Documents", session_profile(r) + "/Documents/My Games",
       session_profile(r) + "/Documents/My Games/MajestyHD",
       session_profile(r) + "/Documents/My Games/MajestyHD/SaveGame"}) {
    OsStat st{}; errno = 0;
    if (os_lstat(path.c_str(), &st) == 0) {
      if (!st.is_dir || st.is_symlink) return SessionAdmission::refused;
    } else if (errno != ENOENT) return SessionAdmission::refused;
  }
  bool absent = true;
  for (const auto &path : {manifest, paths[0], paths[1]}) {
    OsStat st{}; errno = 0;
    const int result = os_lstat(path.c_str(), &st);
    if (result == 0) {
      absent = false;
      if (!st.is_regular || st.is_symlink || st.size > 64 * 1024 * 1024) return SessionAdmission::refused;
    } else if (errno != ENOENT) return SessionAdmission::refused;
  }
  if (absent) return SessionAdmission::fresh;
  const CheckpointStore store(manifest, paths, std::string(content_identity()));
  const auto record = store.read();
  if (record.status != CheckpointStore::Status::valid || record.size > 64 * 1024 * 1024 ||
      !session_saved_rng(paths[record.slot], seed, game_seed)) return SessionAdmission::refused;
#ifndef __EMSCRIPTEN__
  if (halo_session_fixture() && !halo_session_layout_matches(r,record)) return SessionAdmission::refused;
#endif
  name = checkpoint_names(r)[record.slot]; return SessionAdmission::saved;
}

void session_select(const Region &next) {
  const auto profile = session_profile(next);
  mods_overlay_set_profile_dir(profile.c_str());
  if (std::string(mods_overlay_profile_dir()) != profile ||
      os_setenv("RECOMP_PROFILE_DIR", profile.c_str()) != 0 ||
      os_setenv("RECOMP_RULE_FRONTIER_REGION", next.key.c_str()) != 0) std::abort();
  region() = next;
  announced = false; finished = false; network_blocked = false; last_poll = 0;
}

void session_exit(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
  auto &s = region_session();
  const bool leaving = s.stage == RegionSession::Stage::leaving;
  const uint32_t state = rd32(0x006d7670);
  if (leaving && (cpu->ecx != state || rd32(state) != 4 ||
      rd32(0x0071c68c) != s.saved_world || rd32(0x0071c6a8) != 0)) std::abort();
  const auto result = mods_call_next(api, inv, cpu);
  if (!leaving) return;
  if (result != POP_OK || rd32(0x0071c68c)) std::abort();
  // Original CRT frees must acknowledge every owned root before another world
  // can be generated. Never dereference old roots or free them ourselves.
  if (!s.release_tracking || !s.release_hook ||
      mods_hooks_installed_count() != s.release_hooks_before + 1 ||
      !heap_check().empty()) std::abort();
  for (uint32_t count : s.release_freed) if (count != 1) std::abort();
  s.release_tracking = false;
  const auto released = heap_stats();
  std::fprintf(stderr, "[frontier] Session released serial=%llu region=%s roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288 heap-before=%llu heap-after=%llu blocks-before=%u blocks-after=%u clock=0\n",
               (unsigned long long)s.serial, s.previous.key.c_str(),
               (unsigned long long)s.release_heap_before.used_bytes,
               (unsigned long long)released.used_bytes,
               s.release_heap_before.used_blocks, released.used_blocks);
  // Original 004170a0 has disposed the previous world. Only now can save
  // routing change; mods_overlay_set_profile_dir also clears the dir cache.
#ifndef __EMSCRIPTEN__
  if (halo_session_fixture()) {
    if (halo_reload.pending) std::abort();
    halo_reload = {};
  }
#endif
  session_select(s.target); s.stage = RegionSession::Stage::unloaded;
  s.saved_world = 0;
  std::fprintf(stderr, "[frontier] Session unloaded serial=%llu source=%s target=%s world-null=1 profile=%s\n",
      (unsigned long long)s.serial, s.previous.key.c_str(), s.target.key.c_str(), mods_overlay_profile_dir());
}

bool session_enabled() {
  auto &s = region_session();
  if (s.initialized) return s.enabled;
  s.initialized = true;
  const char *flag = recomp_env("RULE_FRONTIER_SESSION");
  if (!flag || std::strcmp(flag, "v1")) return false;
  const Region &r = region(); const char *raw = recomp_env("PROFILE_DIR");
  if (!r.enabled || !raw || transfer_requested() || !seeded_generation() || !connected_terrain() ||
      content_identity().size() != 129 || recomp_env("BROWSER_STREAMING_WORLD_RESIDENCY_FIXTURE")) return false;
  const std::string profile(raw),suffix = "/frontier_" + r.key;
  if (!profile.ends_with(suffix) || profile != mods_overlay_profile_dir()) return false;
  s.root = profile.substr(0, profile.size() - suffix.size());
  const auto slash = s.root.find_last_of('/');
  const auto directory = slash == std::string::npos ? s.root : s.root.substr(slash + 1);
  constexpr std::string_view prefix = "native-world-";
  if (!directory.starts_with(prefix)) return false;
  const auto world = directory.substr(prefix.size());
  if (world.empty() || world.size() > 40) return false;
  for (char ch : world) if (!((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '-')) return false;
  if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x004170a0, 0, session_exit,
      POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &s.exit_hook) != POP_OK) return false;
  s.enabled = true;
  const char *crossing = recomp_env("RULE_FRONTIER_CROSSING");
  s.crossing_enabled = crossing && !std::strcmp(crossing, "v1");
  if (s.crossing_enabled && mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00438040, 0, session_scroll,
      POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &s.scroll_hook) != POP_OK) s.crossing_enabled = false;
#ifndef __EMSCRIPTEN__
  const char *probe = recomp_env("BROWSER_FRONTIER_CAMERA_PROBE");
  if (s.crossing_enabled && probe && !std::strcmp(probe, "v1") &&
      s.root.find("/actor-arrival-fixture-session-") != std::string::npos) s.camera_probe_remaining = 16;
#endif
  std::fprintf(stderr, "[frontier] Session enabled version=v1 region=%s root=%s release=v2%s\n",
      r.key.c_str(), s.root.c_str(), s.crossing_enabled ? " crossing=v1" : "");
  return true;
}

// Original 00436ef0 collects a solo save's display name from profile+4;
// 00436770 loaded that name into the SVGD vector at metadata+44. A new,
// empty profile must adopt the imported name before the first checkpoint.
// Existing local names remain authoritative. Use the original owning string
// assignment, including UTF-16, without aliasing loaded metadata or rewriting
// the input save. Only one current profile value is retained across regions.
bool session_restore_empty_profile_name(X86 *c) {
  const uint32_t profile = rd32(0x0071c634), metadata = 0x006d7ce0;
  // Desktop004ba120 derives the4c-byte profile from00594450's28-byte base.
  // Both original types own the same string at+4; validate the actual type.
  if (!gm_valid(profile, 0x28) ||
      (rd32(profile) != 0x0068979cu &&
       !(rd32(profile) == 0x006832b8u && gm_valid(profile, 0x4c))) ||
      !gm_valid(metadata, 0x74)) {
    std::fprintf(stderr,"[frontier-profile] Restore refused reason=profile-layout profile=%08x vtable=%08x\n",profile,gm_valid(profile,4)?rd32(profile):0); return false;
  }
  if (rd32(profile + 0xc)) return true;
  const uint32_t begin = rd32(metadata + 0x44), end = rd32(metadata + 0x48);
  const uint32_t count = rd32(metadata + 0x34), capacity = rd32(metadata + 0x4c);
  if (!count || count > 4 || !begin || end < begin || end - begin != count * 12 ||
      capacity < end || (capacity - begin) % 12 || capacity - begin > 8 * 12 ||
      !gm_valid(begin, capacity - begin)) {
    std::fprintf(stderr,"[frontier-profile] Restore refused reason=saved-name-vector count=%u begin=%08x end=%08x\n",rd32(metadata+0x34),begin,end); return false;
  }
  if (count > 1) {
    // Original00436ef0 gets multiplayer names from the session's roster,
    // rather than the local profile. They are not an account identity: never
    // choose a party member's name to initialize this machine's blank profile.
    // Keep the full original vector intact; solo serialization may subsequently
    // produce its own single-name header and is not a shared network readback.
    for (uint32_t at = begin; at < end; at += 12) {
      const uint32_t text = rd32(at), flags = rd32(at + 4), size = rd32(at + 8),
                     stride = (flags & 0x01000000u) ? 2u : 1u;
      if (size > 128 || (flags & 0x00ffffffu) < size || !text ||
          !gm_valid(text, (size + 1) * stride) || rd8(text + size * stride) ||
          (stride == 2 && rd8(text + size * stride + 1)))
        return false;
    }
    std::fprintf(stderr, "[frontier] Session profile preserved region=%s saved-player-count=%u local-name-empty=1 party-name-inherited=0 source-same=1 result=pass\n",
                 region().key.c_str(), count);
    return true;
  }
  const uint32_t length = rd32(begin + 8), control = rd32(begin + 4), source = rd32(begin);
  if (!length) return true;
  const uint32_t stride = (control & 0x01000000u) ? 2u : 1u;
  if (length > 128 || (control & 0x00ffffffu) < length ||
      !gm_valid(source, (length + 1) * stride) ||
      rd8(source + length * stride) || (stride == 2 && rd8(source + length * stride + 1)) ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
      mods_hook_depth() || !sched_holds_baton()) {
    std::fprintf(stderr,"[frontier-profile] Restore refused reason=source-or-boundary length=%u control=%08x source-valid=%u depth=%u baton=%u\n",length,control,unsigned(gm_valid(source,(length+1)*stride)),mods_hook_depth(),unsigned(sched_holds_baton())); return false;
  }
  std::array<uint8_t, 258> before{};
  const uint32_t bytes = (length + 1) * stride, clock = rd32(0x0071c6a8);
  std::memcpy(before.data(), g_mem + source, bytes);
  X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = profile + 4;
  guest_call(&extra, 0x004e4180, begin);
  const uint32_t assigned = rd32(profile + 4);
  if (rd32(0x0071c634) != profile || rd32(profile + 0xc) != length ||
      ((rd32(profile + 8) ^ control) & 0x01000000u) || assigned == source ||
      !gm_valid(assigned, bytes) || std::memcmp(g_mem + assigned, before.data(), bytes) ||
      rd32(begin) != source || rd32(begin + 4) != control || rd32(begin + 8) != length ||
      std::memcmp(g_mem + source, before.data(), bytes) || rd32(0x0071c6a8) != clock) {
    std::fprintf(stderr,"[frontier-profile] Restore refused reason=owning-copy\n"); return false;
  }
  std::fprintf(stderr, "[frontier] Session profile initialized region=%s name-characters=%u encoding=%u saved-player-count=1 original-copy=004e4180 clock-same=1 source-same=1 result=pass\n",
      region().key.c_str(), length, stride * 8);
  return true;
}

bool session_restore_rng(X86 *c, uint32_t seed, uint32_t game_seed) {
  X86 extra = *c; extra.r[R_ESP] -= 32768;
  const uint32_t runtime = guest_call(&extra, 0x00623b20);
  extra = *c; extra.r[R_ESP] -= 32768;
  const uint32_t game_rng = guest_call(&extra, 0x00601760);
  if (!seed || !game_seed || !gm_valid(runtime, 0x38) || rd32(runtime) != 0x0068c02c || game_rng != 0x0071fc70) return false;
  const uint32_t clock = rd32(0x0071c6a8);
  extra.r[R_ECX] = game_rng; guest_call(&extra, 0x004f6710, game_seed);
  extra.r[R_ECX] = runtime; guest_call(&extra, 0x00623720, seed);
  return rd32(runtime + 0x20) == seed && rd32(runtime + 0x24) == seed &&
         rd32(game_rng) == game_seed && rd32(game_rng + 4) == game_seed && rd32(0x0071c6a8) == clock;
}

bool session_menu(X86 *c) {
  if (!session_enabled()) return false;
  auto &s = region_session(); const uint32_t state = rd32(0x006d7670);
  if (s.stage != RegionSession::Stage::unloaded) return false;
  if (!gm_valid(state, 0x50) || rd32(state) != 1 || rd32(state + 4) || rd32(0x0071c68c) ||
      rd32(state + 0xc) != c->r[R_ECX] || mods_hook_depth() || !sched_holds_baton() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) std::abort();
  session_release_end();
  bool restored = false; std::string name; uint32_t seed = 0, game_seed = 0;
  auto admission = session_admit(region(), name, seed, game_seed);
  // Recheck absence after disposal too. A save which appeared meanwhile must
  // not silently convert an admitted generation into a different saved load.
  if(selected_hero_travel.generating&&selected_hero_travel.stage==SelectedHeroTravel::Stage::loading&&
     admission!=SessionAdmission::fresh)admission=SessionAdmission::refused;
  if(admission!=SessionAdmission::refused&&selected_hero_travel.stage==SelectedHeroTravel::Stage::loading){
    // Original00436770 appends player names to the global saved metadata.
    // Reset its owning object after disposal, before loading or generating,
    // using its original destructor/constructor pair. This also releases
    // the old configuration and strings rather than accumulating entries.
    constexpr uint32_t metadata=0x006d7ce0u;
    if(!gm_valid(metadata,0x74))std::abort();
    const uint32_t begin=rd32(metadata+0x44),end=rd32(metadata+0x48),capacity=rd32(metadata+0x4c);
    if(end<begin||capacity<end||(end-begin)%12||capacity-begin>8*12||
       (begin&&!gm_valid(begin,capacity-begin)))std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=metadata;guest_call(&extra,0x00436680u);
    extra.r[R_ECX]=metadata;
    if(guest_call(&extra,0x004365f0u)!=metadata||rd32(metadata+0x44)||rd32(metadata+0x48)||rd32(metadata+0x4c)||
       rd32(metadata+0x60)||rd32(0x0071c68c)||rd32(state)!=1||rd32(state+4))std::abort();
    std::fprintf(stderr,"[frontier] Hero travel saved metadata reset original-destructor=00436680 original-constructor=004365f0 retained-names=0 world-null=1 result=pass\n");
  } else if (admission != SessionAdmission::refused &&
             !session_clear_saved_names(c, "Session")) {
    // Release only appended names here; each saved read independently restores
    // its owning scenario configuration after the complete graph is read.
    std::abort();
  }
  if (admission == SessionAdmission::fresh) {
    X86 extra = *c; extra.r[R_ESP] -= 32768;
    guest_call(&extra, 0x00446e70, 0x30335041u, 5000u, 0x006d8630u);
    extra = *c; extra.r[R_ESP] -= 32768;
    guest_call(&extra, 0x00446910, 0x30335041u, 0x006d8630u);
    restored = rd32(state + 4) == 2 && rd32(0x0071c68c);
  } else if (admission == SessionAdmission::saved) {
    restored = restore_checkpoint(c, name, state);
  }
  if(!restored&&selected_hero_travel.generating)
    selected_hero_travel.stage=SelectedHeroTravel::Stage::failed;
  if (!restored && !rd32(0x0071c68c) && rd32(state) == 1 && !rd32(state + 4)) {
    s.arrival_pending = false; // A fallback keeps the saved source camera.
    session_select(s.previous);
    admission = session_admit(region(), name, seed, game_seed);
    restored = admission == SessionAdmission::saved && restore_checkpoint(c, name, state);
    std::fprintf(stderr, "[frontier] Session fallback serial=%llu region=%s restored=%u\n",
        (unsigned long long)s.serial, region().key.c_str(), unsigned(restored));
  }
  s.stage = RegionSession::Stage::idle;
#ifndef __EMSCRIPTEN__
  s.completed_ticks = 0;
#endif
  if (!restored) { std::fprintf(stderr, "[frontier] Session unavailable region=%s\n", region().key.c_str()); return false; }
  // Attachment phase2 later reseeds GPL. Apply the saved seeds at the next
  // complete solo gameplay boundary, before a single resumed original tick.
  s.pending_seed = seed; s.pending_game_seed = game_seed;
  std::fprintf(stderr, "[frontier] Session attached serial=%llu region=%s mode=%s phase=%u pending=%u\n",
      (unsigned long long)s.serial, region().key.c_str(), admission == SessionAdmission::fresh ? "new" : "saved",
      rd32(state), rd32(state + 4));
  return true;
}

// Read the current main camera through the original view getter. The pinned
// camera audit verifies this class, scroll intent, origin and clamp geometry.
// No camera/world pointer survives the call; only one edge gesture is retained.
struct SessionCamera {
  uint32_t manager = 0, tree = 0, head = 0, view = 0, kind = 0, camera = 0, vtable = 0;
  bool valid = false;
  int64_t x = 0, y = 0, max_x = 0, max_y = 0;
};
SessionCamera session_camera_read(X86 *c) {
  SessionCamera result;
  const uint32_t manager = rd32(0x006d84b8);
  uint32_t camera = 0, tree = 0, head = 0, view = 0, view_kind = 0, view_camera = 0;
  if (gm_valid(manager, 0x10)) {
    tree = rd32(manager + 0xc);
    head = gm_valid(tree, 12) ? rd32(tree + 8) : 0;
    if (gm_valid(head, 12)) {
      X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = manager;
      view = guest_call(&extra, 0x00437e40, 0u);
      if (gm_valid(view, 12)) {
        view_kind = rd32(view + 4); view_camera = rd32(view + 8);
        if (view_kind == 1) camera = view_camera;
      }
    }
  }
  result.manager = manager; result.tree = tree; result.head = head;
  result.view = view; result.kind = view_kind; result.camera = camera;
  result.vtable = gm_valid(view_camera, 4) ? rd32(view_camera) : 0;
  // Gameplay's 0043a4b0 constructor calls the base camera constructor,
  // then installs 00680e14. Its origin override delegates to 005c2980.
  if (gm_valid(camera, 0x140) && (rd32(camera) == 0x0068a784 || rd32(camera) == 0x00680e14)) {
    const int64_t width = int32_t(rd32(camera + 0x2c)) - int64_t(int32_t(rd32(camera + 0x24)));
    const int64_t height = int32_t(rd32(camera + 0x30)) - int64_t(int32_t(rd32(camera + 0x28)));
    const int64_t extent_x = int32_t(rd32(camera + 0xe0)), extent_y = int32_t(rd32(camera + 0xe4));
    result.x = int32_t(rd32(camera + 0x34)); result.y = int32_t(rd32(camera + 0x38));
    result.max_x = extent_x - width; result.max_y = extent_y - height;
    result.valid = width > 0 && height > 0 && width <= 16384 && height <= 16384 &&
        result.max_x > 0 && result.max_y > 0 && extent_x <= 16777216 && extent_y <= 16777216 &&
        result.x >= 0 && result.y >= 0 && result.x <= result.max_x && result.y <= result.max_y;
  }
  return result;
}

// Enter through the opposite camera edge, retaining the source's orthogonal
// position. The original setter rebuilds its transform/minimap; no raw camera
// writes or old-world pointer survives disposal. Complete before ready/ticks.
bool session_camera_arrival(X86 *c) {
  auto &s = region_session();
  if (!s.arrival_pending) return true;
  if (mods_hook_depth() || !sched_holds_baton() || c->r[R_ESP] < STACK_LIMIT + 65536 ||
      c->r[R_ESP] > STACK_TOP || s.arrival_direction < 0 || s.arrival_direction > 3) return false;
  const auto camera = session_camera_read(c);
  if (!camera.valid) return false;
  const uint32_t setter = rd32(camera.vtable + 0x6c);
  if (setter != (camera.vtable == 0x00680e14 ? 0x0043a910u : 0x005c2980u)) return false;
  int64_t x = std::clamp(s.arrival_source_x, int64_t(0), camera.max_x);
  int64_t y = std::clamp(s.arrival_source_y, int64_t(0), camera.max_y);
  if (s.arrival_direction == 0) x = camera.max_x;
  if (s.arrival_direction == 3) x = 0;
  if (s.arrival_direction == 1) y = camera.max_y;
  if (s.arrival_direction == 2) y = 0;
  X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = camera.camera;
  guest_call(&extra, setter, uint32_t(x), uint32_t(y));
  const auto after = session_camera_read(c);
  if (!after.valid || after.camera != camera.camera || after.x != x || after.y != y) return false;
  std::fprintf(stderr, "[frontier] Session camera arrived serial=%llu region=%s direction=%d x=%lld y=%lld max-x=%lld max-y=%lld source-x=%lld source-y=%lld clock=%u\n",
      (unsigned long long)s.serial, region().key.c_str(), s.arrival_direction,
      (long long)x, (long long)y, (long long)after.max_x, (long long)after.max_y,
      (long long)s.arrival_source_x, (long long)s.arrival_source_y, rd32(0x0071c6a8));
  s.arrival_pending = false; s.camera_valid = false;
  return true;
}

void session_camera_boundary(X86 *c, uint64_t now) {
  auto &s = region_session();
  if (!s.crossing_enabled) return;
  const auto camera = session_camera_read(c);
  const auto x = camera.x, y = camera.y, max_x = camera.max_x, max_y = camera.max_y;
  const bool valid = camera.valid;
  s.camera_valid = valid; s.camera_x = x; s.camera_y = y;
  int direction = -1;
  int64_t dx = 0, dy = 0;
  if (s.scroll_serial == s.serial && now >= s.scroll_ns && now - s.scroll_ns <= 250000000u) {
    dx = s.scroll_x; dy = s.scroll_y;
  }
  if (valid) {
      const int horizontal = x == 0 && dx < 0 ? 0 : x == max_x && dx > 0 ? 3 : -1;
      const int vertical = y == 0 && dy < 0 ? 1 : y == max_y && dy > 0 ? 2 : -1;
      if (horizontal < 0) direction = vertical;
      else if (vertical < 0) direction = horizontal;
      else if (std::abs(dx) != std::abs(dy)) direction = std::abs(dx) > std::abs(dy) ? horizontal : vertical;
  }
  if (s.camera_sample_serial != s.serial) {
    s.camera_sample_serial = s.serial;
    std::fprintf(stderr, "[frontier] Session camera serial=%llu region=%s valid=%u x=%lld y=%lld max-x=%lld max-y=%lld dx=%lld dy=%lld manager=%08x tree=%08x head=%08x view=%08x kind=%u camera=%08x vtable=%08x\n",
        (unsigned long long)s.serial, region().key.c_str(), unsigned(valid),
        (long long)x, (long long)y, (long long)max_x, (long long)max_y, (long long)dx, (long long)dy,
        camera.manager, camera.tree, camera.head, camera.view, camera.kind, camera.camera, camera.vtable);
  }
  if (s.camera_probe_remaining && now - s.camera_probe_ns >= 1000000000u) {
    --s.camera_probe_remaining; s.camera_probe_ns = now;
    // The pinned original getter only queries GetCursorPos/ScreenToClient;
    // this owned native fixture records the coordinates input actually sees.
    X86 extra = *c; extra.r[R_ESP] -= 32768;
    const uint32_t point = extra.r[R_ESP] + 64; // Above the cloned callee stack.
    guest_call(&extra, 0x004f6430, point, point + 4);
    std::fprintf(stderr, "[frontier] Session camera probe serial=%llu region=%s valid=%u x=%lld y=%lld dx=%lld dy=%lld scroll-seen=%u scroll-accepted=%u input-paused=%u pointer-x=%d pointer-y=%d\n",
        (unsigned long long)s.serial, region().key.c_str(), unsigned(valid), (long long)x, (long long)y,
        (long long)dx, (long long)dy, s.scroll_seen, s.scroll_accepted,
        unsigned(rd8(0x006d766c)), int32_t(rd32(point)), int32_t(rd32(point + 4)));
  }
  if (direction < 0) {
    s.border_direction = -1; s.border_since = 0; s.border_announced = false; return;
  }
  if (s.border_direction != direction) {
    s.border_direction = direction; s.border_since = now; s.border_announced = false; return;
  }
  if (!s.border_announced && now - s.border_since >= 1000000000u && s.border_gesture < 9007199254740991ull) {
    s.border_announced = true; ++s.border_gesture;
    const char *names[] = {"west", "north", "south", "east"};
    std::fprintf(stderr, "[frontier] Session boundary serial=%llu region=%s direction=%s gesture=%llu x=%lld y=%lld max-x=%lld max-y=%lld dx=%lld dy=%lld held-ms=%llu\n",
        (unsigned long long)s.serial, region().key.c_str(), names[direction], (unsigned long long)s.border_gesture,
        (long long)x, (long long)y, (long long)max_x, (long long)max_y, (long long)dx, (long long)dy,
        (unsigned long long)((now - s.border_since) / 1000000u));
  }
}

int session_direction() {
  auto &s = region_session();
#ifndef __EMSCRIPTEN__
  const char *halo_requests = recomp_env("BROWSER_FRONTIER_HALO_SESSION_REQUEST");
  if (halo_requests) {
    // The private supervisor waits for observed Ready boundaries. Its bounded
    // packet publishes the same named-action pair as the real native UI; the
    // ordinary consumer below still decides and executes the transition.
    static uint32_t sequence = 0;
    if (std::strcmp(halo_requests,"v1") || !halo_session_fixture() || !halo_session_root_valid()) std::abort();
    const std::string path = s.root + "/Halo_Session_Request.txt";
    OsStat st{};
    if (!os_lstat(path.c_str(),&st)) {
      if (!st.is_regular || st.is_symlink || !st.size || st.size>128) std::abort();
      const int fd=os_fd_open(path.c_str(),OS_O_RDONLY);if(fd<0)std::abort();
      std::array<char,128> bytes{};const int64_t used=os_fd_read(fd,bytes.data(),bytes.size());
      const bool closed=!os_fd_close(fd);if(!closed||used!=int64_t(st.size))std::abort();
      std::string_view text(bytes.data(),size_t(used));std::array<std::string_view,5> lines{};
      for(auto &line:lines){const auto end=text.find('\n');if(end==text.npos)std::abort();line=text.substr(0,end);text.remove_prefix(end+1);}
      uint32_t next=0;const auto parsed=std::from_chars(lines[1].data(),lines[1].data()+lines[1].size(),next);
      if(!text.empty()||lines[0]!="halo-session-request-v1"||parsed.ec!=std::errc{}||parsed.ptr!=lines[1].data()+lines[1].size()||
          !next||next>64||lines[1]!=std::to_string(next))std::abort();
      if(next>sequence) {
        if(next!=sequence+1||lines[2]!=std::to_string(s.serial)||lines[3]!=region().key||
            lines[4].size()!=1||lines[4][0]<'0'||lines[4][0]>'4')std::abort();
        const unsigned direction=unsigned(lines[4][0]-'0');
        const char *names[]={"frontier-travel-west","frontier-travel-north","frontier-travel-south","frontier-travel-east"};
        const bool queued=direction<4?os_native_request_actions("frontier-travel",names[direction]):os_native_request_action("frontier-checkpoint");
        if(!queued)std::abort();sequence=next;
        std::fprintf(stderr,"[frontier] Halo session named request sequence=%u serial=%llu region=%s direction=%u queued=1\n",
            sequence,(unsigned long long)s.serial,region().key.c_str(),direction);
      }
    } else if(errno!=ENOENT)std::abort();
  }
  const char *test = recomp_env("BROWSER_FRONTIER_SESSION_REQUEST_FIXTURE");
  if (test && !std::strcmp(test, "v1") && s.root.find("/actor-arrival-fixture-session-") != std::string::npos) {
    const std::string path = s.root + "/Session_Request.txt";
    FILE *input = std::fopen(path.c_str(), "rb"); if (!input) return -1;
    char buffer[128]; const size_t n = std::fread(buffer, 1, sizeof buffer, input);
    const bool read_ok = !std::ferror(input);
    const bool good = std::fclose(input) == 0 && read_ok;
    if (!good || n == sizeof buffer) return -1;
    const std::string packet(buffer, n);
    const std::string expected = "session-request-v1\n" + std::to_string(s.serial + 1) + "\n" + region().key + "\n";
    if (packet.size() == expected.size() + 2 && packet.starts_with(expected) &&
        packet.back() == '\n' && packet[expected.size()] >= '0' && packet[expected.size()] <= '4')
      return packet[expected.size()] - '0';
    if (packet != s.refused_packet) {
      s.refused_packet = packet;
      std::fprintf(stderr, "[frontier] Session request refused region=%s serial=%llu\n", region().key.c_str(), (unsigned long long)s.serial);
    }
    return -1;
  }
#endif
  const char *actions[] = {"frontier-travel-west", "frontier-travel-north", "frontier-travel-south", "frontier-travel-east"};
  // One browser-main-thread round trip at idle, not four per heartbeat. A
  // pending trip enables the subsequent direction poll, which consumes it.
  if (!os_browser_take_action("frontier-travel")) return -1;
  for (int i = 0; i < 4; ++i) if (os_browser_take_action(actions[i])) return i;
  return -1;
}

void session_tick(X86 *c) {
  if (!session_enabled() || saving || finished || network_blocked) return;
  auto &s = region_session(); const uint32_t state = rd32(0x006d7670), world = rd32(0x0071c68c);
  if (s.stage != RegionSession::Stage::idle || !gm_valid(state, 0x50) || rd32(state) != 3 || rd32(state + 4) ||
      !gm_valid(world, 0x14) || !rd32(world + 4) || mods_hook_depth() || !sched_holds_baton() ||
      c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) return;
  const uint32_t manager = rd32(0x006d8568);
  if (!gm_valid(manager, 0x21c) || rd32(manager + 0x218) == 2) return;
  const auto now = os_monotonic_ns(); if (now - s.poll_ns < 100000000u) return; s.poll_ns = now;
  session_camera_boundary(c, now);
#ifndef __EMSCRIPTEN__
  // The owned departure fixture waits for ordinary AI to leave its real
  // building. It never relocates an actor or changes the guild membership.
  if (s.serial == 0 && !majesty_browser_streaming_session_outdoor_hero(c)) return;
#endif
  const int direction = session_direction(); if (direction < 0) return;
  Region target = region();
  if (direction < 4) {
    constexpr int dx[] = {-1, 0, 0, 1}, dy[] = {0, -1, 1, 0};
    target.x += dx[direction]; target.y += dy[direction];
    if (target.x < -1000000 || target.x > 1000000 || target.y < -1000000 || target.y > 1000000) return;
    target.key = std::to_string(target.x) + "_" + std::to_string(target.y);
    target.checkpoint = "Frontier_" + target.key; target.seed = region_seed(target.x, target.y);
    std::string name; uint32_t seed = 0, game_seed = 0;
    if (session_admit(target, name, seed, game_seed) == SessionAdmission::refused) {
      std::fprintf(stderr, "[frontier] Session destination refused source=%s target=%s\n", region().key.c_str(), target.key.c_str()); return;
    }
    if (s.crossing_enabled && !s.camera_valid) {
      std::fprintf(stderr, "[frontier] Session destination refused source=%s target=%s\n", region().key.c_str(), target.key.c_str()); return;
    }
  }
#ifndef __EMSCRIPTEN__
  if (halo_session_fixture() && !halo_session_departure_checkpoint(c)) std::abort();
#endif
  saving = true; const bool saved = checkpoint(c, region(), world); saving = false;
  if (!saved) { std::fprintf(stderr, "[frontier] Session checkpoint failed region=%s\n", region().key.c_str()); return; }
  ++s.serial;
  std::fprintf(stderr, "[frontier] Session checkpoint serial=%llu region=%s clock=%u direction=%d\n",
      (unsigned long long)s.serial, region().key.c_str(), rd32(0x0071c6a8), direction);
  if (direction == 4) return;
  s.arrival_pending = s.crossing_enabled; s.arrival_direction = direction;
  s.arrival_source_x = s.camera_x; s.arrival_source_y = s.camera_y; s.camera_valid = false;
  s.previous = region(); s.target = target;
  s.border_direction = -1; s.border_since = 0; s.border_announced = false;
  s.saved_world = world; s.saved_clock = rd32(0x0071c6a8);
  session_release_begin(world);
  X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = state;
  // Original Quit Game00416590 requests phase4, clears settings+6c and calls
  // the manager's cleanup. A bare phase request leaves save-loading mode set:
  // original fresh actor constructors then omit their GPL agents entirely.
  guest_call(&extra, 0x00416590);
  // Manager cleanup0049a440 resets the global game clock before disposal.
  // Saved returns restore their own clock; a new kingdom starts at zero.
  const uint32_t settings = rd32(0x006d87a0);
  if (rd32(state) != 4 || rd32(state + 4) != 4 || rd32(0x0071c68c) != world ||
      rd32(0x0071c6a8) != 0 || !gm_valid(settings, 0x70) || rd32(settings + 0x6c)) std::abort();
  std::fprintf(stderr, "[frontier] Session quit serial=%llu region=%s saved-clock=%u clock=0 loading=0\n",
      (unsigned long long)s.serial, region().key.c_str(), s.saved_clock);
  s.stage = RegionSession::Stage::leaving;
}

// Begin the original unload/load lifecycle only after captured source
// retirement. A saved destination is reauthenticated before the source leaves;
// generation and ownership publication remain separate admission steps.
bool selected_hero_begin_travel(X86 *c,int direction,const char *digest,uint32_t destination_clock,bool generating=false,uint32_t initialization_ticks=0) {
  auto &b=selected_hero_binding();auto &s=region_session();auto &travel=selected_hero_travel;
  if(!c||(generating?(digest!=nullptr||destination_clock||initialization_ticks<2||initialization_ticks>66||!seeded_generation()||!connected_terrain()):
     (initialization_ticks||!digest||strnlen(digest,65)!=64||!TransferStore::digest(digest)))||direction<0||direction>3||
     !b.enabled||!b.admitted||!b.retired||!b.closed||b.retired_checkpoint.empty()||!b.halo_layout||b.save_stage!=SelectedHeroBinding::SaveStage::idle||
     travel.stage!=SelectedHeroTravel::Stage::idle||s.stage!=RegionSession::Stage::idle||s.serial==UINT64_MAX||
     region().key!=b.key||mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
  const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c),game=rd32(0x006d8568);
  if(!gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=b.save_clock||
     !gm_valid(world,0x14)||!gm_valid(game,0x21c)||rd32(game+0x218)==2)return false;
  const char *raw=recomp_env("PROFILE_DIR");if(!raw)return false;
  const std::string profile(raw),suffix="/frontier_"+b.key;
  if(!profile.ends_with(suffix)||profile!=mods_overlay_profile_dir())return false;
  const std::string root=profile.substr(0,profile.size()-suffix.size());
  const bool reuse=s.enabled&&s.initialized&&s.exit_hook&&s.root==root&&s.target.key==b.key&&
      !s.crossing_enabled&&!s.scroll_hook&&!s.saved_world&&!s.release_hook&&!s.release_tracking&&!s.pending_seed&&!s.pending_game_seed;
  if((s.enabled||s.exit_hook)&&!reuse)return false;
  const auto slash=root.find_last_of('/');const auto directory=root.substr(slash==root.npos?0:slash+1);
  bool owned=directory.starts_with("native-world-")&&directory.size()>13&&directory.size()<=53;
  if(owned)for(char ch:directory)if(!((ch>='a'&&ch<='z')||(ch>='0'&&ch<='9')||ch=='-'))owned=false;
#ifndef __EMSCRIPTEN__
  const char *test=recomp_env("BROWSER_FRONTIER_HERO_PAGE_TEST");
  owned=owned||(test&&!std::strcmp(test,"v1")&&directory.starts_with("actor-arrival-fixture-hero-binding-")&&directory.size()<=80);
#endif
  if(!owned)return false;
  Region target=region();constexpr int dx[]={-1,0,0,1},dy[]={0,-1,1,0};target.x+=dx[direction];target.y+=dy[direction];
  if(target.x < -1000000||target.x>1000000||target.y < -1000000||target.y>1000000)return false;
  target.key=std::to_string(target.x)+"_"+std::to_string(target.y);target.checkpoint="Frontier_"+target.key;target.seed=region_seed(target.x,target.y);
  const std::string previous_root=s.root;s.root=root;std::string name,marker;std::array<std::string,2> paths;uint32_t seed=0,game_seed=0,clock=0;
  const auto admission=session_admit(target,name,seed,game_seed);session_paths(target,marker,paths);
  if(generating){if(admission!=SessionAdmission::fresh){s.root=previous_root;return false;}}
  else {
    const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();
    if(admission!=SessionAdmission::saved||saved.status!=CheckpointStore::Status::valid||saved.digest!=digest||
       !session_saved_rng(paths[saved.slot],seed,game_seed,&clock)||clock!=destination_clock){s.root=previous_root;return false;}
  }
  const std::string retired_path=native_checkpoint_path(c,b.retired_checkpoint.c_str());OsStat retired{};
  if(os_lstat(retired_path.c_str(),&retired)||!retired.is_regular||retired.is_symlink||!retired.size||retired.size>64u*1024*1024){s.root=previous_root;return false;}
  uint32_t retired_seed=0,retired_game_seed=0,retired_clock=0;
  if(!session_saved_rng(retired_path,retired_seed,retired_game_seed,&retired_clock)||retired_clock!=b.save_clock){s.root=previous_root;return false;}
  if(!reuse&&mods_hook_install_ex(MODS_OWNER_RUNTIME,0x004170a0,0,session_exit,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.exit_hook)!=POP_OK){s.root=previous_root;return false;}
  s.initialized=true;s.enabled=true;++s.serial;s.previous=region();s.target=target;s.saved_world=world;s.saved_clock=b.save_clock;
  travel.retired_size=retired.size;travel.retired_digest=loader_hash_file_bounded(retired_path.c_str(),retired.size);
  travel.target=target.key;travel.digest=digest?digest:"";travel.clock=destination_clock;travel.generating=generating;
  travel.initialization_target_ticks=initialization_ticks;travel.stage=SelectedHeroTravel::Stage::loading;
  session_release_begin(world);X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416590u);
  const uint32_t settings=rd32(0x006d87a0);
  if(rd32(state)!=4||rd32(state+4)!=4||rd32(0x0071c68c)!=world||rd32(0x0071c6a8)||!gm_valid(settings,0x70)||rd32(settings+0x6c))std::abort();
  s.stage=RegionSession::Stage::leaving;
  std::fprintf(stderr,"[frontier] Hero travel leaving serial=%llu source=%s target=%s captured-clock=%u target-clock=%u original-quit=1 owner-published=0 result=pass\n",(unsigned long long)s.serial,b.key.c_str(),target.key.c_str(),b.save_clock,destination_clock);
  return true;
}
#ifndef __EMSCRIPTEN__
bool selected_hero_repeat_page_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_PAGE_TEST");if(!flag)return false;
  auto &b=selected_hero_binding();auto &s=region_session();
  if(!b.closed||!b.retired||b.save_serial!=4||b.key!="0_0"||s.serial!=2||
     selected_hero_travel.stage!=SelectedHeroTravel::Stage::idle)return false;
  const char *profile=recomp_env("PROFILE_DIR");const std::string path(profile?profile:"");
  if(std::strcmp(flag,"v1")||b.proxy_home||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||!path.ends_with("/frontier_0_0"))std::abort();
  const std::string text=selected_hero_small_text(path+"/Frontier_Hero_Repeat_Ready.txt",256);if(text.empty())return false;
  std::string_view remaining(text);std::array<std::string_view,6> fields{};
  for(unsigned i=0;i<fields.size();++i){const auto at=remaining.find(i+1==fields.size()?'\n':'|');
    if(at==remaining.npos)std::abort();fields[i]=remaining.substr(0,at);remaining.remove_prefix(at+1);}
  uint32_t clock=0;uint64_t size=0;const auto n=std::from_chars(fields[3].data(),fields[3].data()+fields[3].size(),clock),
      z=std::from_chars(fields[4].data(),fields[4].data()+fields[4].size(),size);
  if(!remaining.empty()||fields[0]!="majesty-hero-repeat-ready-v1"||fields[1]!="4"||fields[2]!="1_0"||
     n.ec!=std::errc{}||n.ptr!=fields[3].data()+fields[3].size()||fields[3]!=std::to_string(clock)||
     z.ec!=std::errc{}||z.ptr!=fields[4].data()+fields[4].size()||fields[4]!=std::to_string(size)||!size||size>64u*1024*1024||!TransferStore::digest(fields[5]))std::abort();
  const std::string digest(fields[5]);Region target=region();target.x=1;target.y=0;target.key="1_0";target.checkpoint="Frontier_1_0";
  std::string marker;std::array<std::string,2> paths;session_paths(target,marker,paths);
  const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();
  if(saved.status!=CheckpointStore::Status::valid||saved.size!=size||saved.digest!=digest)std::abort();
  if(selected_hero_begin_travel(c,3,std::string(64,'0').c_str(),clock)||selected_hero_begin_travel(c,3,digest.c_str(),clock+1)||
     !joint_fixture_checkpoint(c,"Hero_Repeat_Source_Paging_Refused","BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT","0_0","actor-arrival-fixture-hero-binding-"))std::abort();
  if(!selected_hero_begin_travel(c,3,digest.c_str(),clock))std::abort();
  std::fprintf(stderr,"[frontier] Hero repeated neighbor paging admitted serial=4 region=1_0 clock=%u bytes=%llu sha256=%s reused-exit-hook=1 wrong-digest-refused=1 wrong-clock-refused=1 current-retirement-bound=1 recovery-preserved=1 result=pass\n",clock,(unsigned long long)size,digest.c_str());
  return true;
}
bool selected_hero_home_page_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_HOME_PAGE_TEST");if(!flag)return false;
  auto &b=selected_hero_binding();auto &s=region_session();
  const bool repeat=b.save_serial==6;
  const char *repeat_flag=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_HOME_PAGE_TEST");
  if(repeat&&(!repeat_flag||std::strcmp(repeat_flag,"v1")))return false;
  if(!b.proxy_home||!b.closed||!b.retired||(b.save_serial!=2&&!repeat)||s.serial!=(repeat?3u:1u)||selected_hero_travel.stage!=SelectedHeroTravel::Stage::idle)return false;
  const char *profile=recomp_env("PROFILE_DIR");const std::string path(profile?profile:"");
  if(std::strcmp(flag,"v1")||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||!path.ends_with("/frontier_1_0")||b.key!="1_0")std::abort();
  const std::string text=selected_hero_small_text(path+(repeat?"/Frontier_Hero_Repeat_Home_Ready.txt":"/Frontier_Hero_Home_Ready.txt"),256);if(text.empty())return false;
  std::string_view remaining(text);std::array<std::string_view,6> fields{};
  for(unsigned i=0;i<fields.size();++i){const auto at=remaining.find(i+1==fields.size()?'\n':'|');
    if(at==remaining.npos)std::abort();fields[i]=remaining.substr(0,at);remaining.remove_prefix(at+1);}
  uint32_t clock=0;uint64_t size=0;const auto n=std::from_chars(fields[3].data(),fields[3].data()+fields[3].size(),clock),
      z=std::from_chars(fields[4].data(),fields[4].data()+fields[4].size(),size);
  if(!remaining.empty()||fields[0]!="majesty-hero-home-ready-v1"||fields[1]!=std::to_string(b.save_serial)||fields[2]!="0_0"||
     n.ec!=std::errc{}||n.ptr!=fields[3].data()+fields[3].size()||fields[3]!=std::to_string(clock)||
     z.ec!=std::errc{}||z.ptr!=fields[4].data()+fields[4].size()||fields[4]!=std::to_string(size)||!size||size>64u*1024*1024||!TransferStore::digest(fields[5]))std::abort();
  const std::string digest(fields[5]);Region target=region();target.x=0;target.y=0;target.key="0_0";target.checkpoint="Frontier_0_0";
  std::string marker;std::array<std::string,2> paths;session_paths(target,marker,paths);
  const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();if(saved.status!=CheckpointStore::Status::valid||saved.size!=size||saved.digest!=digest)std::abort();
  if(selected_hero_begin_travel(c,0,std::string(64,'0').c_str(),clock)||selected_hero_begin_travel(c,0,digest.c_str(),clock+1)||
     !joint_fixture_checkpoint(c,repeat?"Hero_Repeat_Remote_Source_Paging_Refused":"Hero_Remote_Source_Paging_Refused","BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT","1_0","actor-arrival-fixture-hero-binding-"))std::abort();
  if(!selected_hero_begin_travel(c,0,digest.c_str(),clock))std::abort();
  std::fprintf(stderr,"[frontier] Hero home paging admitted serial=%u region=0_0 clock=%u bytes=%llu sha256=%s reused-exit-hook=1 wrong-digest-refused=1 wrong-clock-refused=1 recovery-preserved=1 result=pass\n",b.save_serial,clock,(unsigned long long)size,digest.c_str());
  return true;
}
#endif
// Complete arrival in the already loaded, paused destination. The source
// aliases and accepted clock come from the admitted captured binding. Only
// newly reserved destination aliases survive this call; custody is still
// unpublished, and original simulation stays held for paired publication.
// Both foreign and native-guild arrivals expose readiness only after activation
// and an original checkpoint; the selected pair receipt remains the resume gate.
void selected_hero_arrival_checkpoint(X86 *c) {
  auto &t=selected_hero_travel;const auto &b=selected_hero_binding();
  const uint32_t state=rd32(0x006d7670);
  saving=true;const bool saved=checkpoint(c,region(),rd32(0x0071c68c));saving=false;
  std::string marker;std::array<std::string,2> paths;
  if(!saved||!checkpoint_store(c,region(),marker,paths))std::abort();
  const auto active=CheckpointStore(marker,paths,std::string(content_identity())).read();uint32_t seed=0,game_seed=0,clock=0;
  if(active.status!=CheckpointStore::Status::valid||!session_saved_rng(paths[active.slot],seed,game_seed,&clock)||clock!=t.clock||rd32(state)!=7||rd32(state+4))std::abort();
  t.active_digest=active.digest;t.active_size=active.size;
  t.ready_packet="majesty-hero-travel-ready-v1|"+std::to_string(b.save_serial)+"|"+t.target+"|"+std::to_string(t.clock)+"|"+
      std::to_string(t.aliases[0])+"|"+std::to_string(t.aliases[4])+"|"+std::to_string(t.home_agent)+"|"+std::to_string(active.size)+"|"+active.digest;
  std::fprintf(stderr,"[frontier] Hero travel publication held receipt=%s phase=7 pending=0 ordinary-ticks=0\n",t.ready_packet.c_str());
  t.stage=SelectedHeroTravel::Stage::ready;
}
bool selected_hero_attach_arrival(X86 *c,const char *home_digest,uint32_t home_bytes,uint32_t home_id,
                                  const char *pack_digest,uint32_t pack_bytes) {
  auto &t=selected_hero_travel;const auto &b=selected_hero_binding();
  const uint32_t state=rd32(0x006d7670);
  if(!c||!home_digest||!pack_digest||strnlen(home_digest,65)!=64||strnlen(pack_digest,65)!=64||
     !TransferStore::digest(home_digest)||!TransferStore::digest(pack_digest)||t.stage!=SelectedHeroTravel::Stage::held||
     !b.retired||!b.closed||!b.admitted||region().key!=t.target||!gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4)||
     rd32(0x0071c6a8)!=t.clock||!home_bytes||home_bytes>1024||!pack_bytes||pack_bytes>256*1024||!home_id||
     mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
  const char *raw=recomp_env("PROFILE_DIR");if(!raw)return false;
  for(const auto &[name,bytes,digest]:{std::tuple{"Frontier_Hero_Home.GPL",home_bytes,home_digest},
                                    std::tuple{"Frontier_Hero_Arrival.pack",pack_bytes,pack_digest}}){
    const std::string path=std::string(raw)+"/"+name;OsStat st{};
    if(os_lstat(path.c_str(),&st)||!st.is_regular||st.is_symlink||st.size!=bytes||
       loader_hash_file_bounded(path.c_str(),bytes)!=digest)return false;
  }
  auto snapshot=[&](const char *name){
#ifndef __EMSCRIPTEN__
    const char *flag=recomp_env("BROWSER_FRONTIER_HERO_JOIN_TEST");
    if(flag&&(!std::strcmp(flag,"v1"))&&!joint_fixture_checkpoint(c,name,"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",t.target.c_str(),"actor-arrival-fixture-hero-binding-"))std::abort();
#endif
  };
  snapshot("Hero_Home_Before");
  if(majesty_browser_streaming_register_hero_home(c,home_digest,home_bytes,t.clock,home_id,false)!=home_id){t.stage=SelectedHeroTravel::Stage::failed;return false;}
  snapshot("Hero_Home_Registered");
  if(majesty_browser_streaming_register_hero_home(c,home_digest,home_bytes,t.clock,home_id,true)!=home_id){t.stage=SelectedHeroTravel::Stage::failed;return false;}
  snapshot("Hero_Home_Reused");
  std::array<uint32_t,5> aliases{};
#ifndef __EMSCRIPTEN__
  const char *test=recomp_env("BROWSER_FRONTIER_HERO_JOIN_TEST");
  if(test&&!std::strcmp(test,"v1")){
    const std::string bad(64,'f');
    if(majesty_browser_streaming_import_hero_arrival(c,bad.c_str(),pack_bytes,b.values[1],b.values[2],b.save_clock,t.clock,home_id,aliases.data())||
       majesty_browser_streaming_import_hero_arrival(c,pack_digest,pack_bytes,b.values[1],b.values[2],b.save_clock,t.clock+1,home_id,aliases.data()))std::abort();
  }
#endif
  snapshot("Hero_Arrival_Refused");
  if(!majesty_browser_streaming_import_hero_arrival(c,pack_digest,pack_bytes,b.values[1],b.values[2],b.save_clock,t.clock,home_id,aliases.data())){
    t.stage=SelectedHeroTravel::Stage::failed;return false;
  }
  snapshot("Hero_Arrival_Imported");
  if(!majesty_browser_streaming_activate_hero_arrival(c,aliases.data(),home_id,t.clock)){selected_hero_arrival_refused();return false;}
  t.aliases=aliases;t.home_agent=home_id;t.stage=SelectedHeroTravel::Stage::ready;snapshot("Hero_Travel_Target_Active");
  std::fprintf(stderr,"[frontier] Hero travel arrival ready source=%u/%u source-clock=%u region=%s hero=%u agent=%u home=%u clock=%u original-import=1 activated=1 paused=1 ordinary-ticks=0 owner-published=0 result=pass\n",
      b.values[1],b.values[2],b.save_clock,t.target.c_str(),aliases[0],aliases[4],home_id,t.clock);
  selected_hero_arrival_checkpoint(c);
  return true;
}

std::string selected_hero_small_text(const std::string &path,size_t limit=4096) {
  OsStat st{};if(os_lstat(path.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>limit)return {};
  FILE *f=std::fopen(path.c_str(),"rb");if(!f)return {};
  std::string bytes(size_t(st.size),'\0');const size_t n=std::fread(bytes.data(),1,bytes.size(),f);
  const bool good=n==bytes.size()&&!std::ferror(f),closed=!std::fclose(f);return good&&closed?bytes:std::string{};
}

// Resolve only this loaded hero's named-world journal. Native qualification
// may substitute its separately owned journal; no request supplies a path.
std::string selected_hero_journal() {
  const auto &b=selected_hero_binding();const char *raw=recomp_env("PROFILE_DIR");
  const auto &t=selected_hero_travel;
  const bool generated_target=t.generating&&t.stage!=SelectedHeroTravel::Stage::idle&&b.closed&&b.retired&&region().key==t.target;
  const std::string profile(raw?raw:""),suffix="/frontier_"+(generated_target?t.target:b.key);
  if(profile!=mods_overlay_profile_dir()||!profile.ends_with(suffix))return {};
  const auto root=profile.substr(0,profile.size()-suffix.size());const auto slash=root.find_last_of('/');
  if(generated_target&&root!=region_session().root)return {};
  const auto name=root.substr(slash==root.npos?0:slash+1);
#ifndef __EMSCRIPTEN__
  const char *test=recomp_env("BROWSER_FRONTIER_HERO_PUBLICATION_TEST"),*owned=recomp_env("BROWSER_FRONTIER_HERO_PUBLICATION_JOURNAL");
  if(test&&!std::strcmp(test,"v1")){
    const std::string journal(owned?owned:"");const auto split=journal.find_last_of('/');
    if(!name.starts_with("actor-arrival-fixture-hero-binding-")||split==journal.npos||
       !journal.substr(split+1).starts_with("actor-arrival-fixture-hero-route-")||journal.find("/../")!=journal.npos)return {};
    return journal;
  }
#endif
  if(!name.starts_with("native-world-")||name.size()<=13||name.size()>53)return {};
  for(char ch:name)if(!((ch>='a'&&ch<='z')||(ch>='0'&&ch<='9')||ch=='-'))return {};
  return root+"/hero-route";
}
bool selected_hero_seed_owner(const std::string &head) {
  const auto journal=selected_hero_journal();if(journal.empty()||head.size()>512||
      selected_hero_small_text(journal+"/Frontier_Hero_Route.checkpoint",512)!=head)return false;
  const std::string prefix="{\"version\":1,\"identitySha256\":\"",middle="\",\"revision\":",last=",\"nodeSha256\":\"";
  if(!head.starts_with(prefix)||head.size()<prefix.size()+64+middle.size()+last.size()+68)return false;
  const auto identity=head.substr(prefix.size(),64);const size_t start=prefix.size()+64+middle.size(),end=head.find(last,start);
  if(!TransferStore::digest(identity)||head.substr(prefix.size()+64,middle.size())!=middle||end==head.npos)return false;
  uint32_t revision=0;const auto parsed=std::from_chars(head.data()+start,head.data()+end,revision);
  const auto node_hash=head.substr(end+last.size(),64);OsStat folder{};
  if(parsed.ec!=std::errc{}||parsed.ptr!=head.data()+end||!TransferStore::digest(node_hash)||
      head!=prefix+identity+middle+std::to_string(revision)+last+node_hash+"\"}\n"||
      os_lstat(journal.c_str(),&folder)||!folder.is_dir||folder.is_symlink||
      loader_hash_file_bounded((journal+"/Frontier_Hero_Route_Identity.json").c_str(),4096)!=identity)return false;
  const auto path=journal+"/Frontier_Hero_Route_Node_"+std::to_string(revision)+".json",node=selected_hero_small_text(path);
  const auto &b=selected_hero_binding();
  return !node.empty()&&loader_hash_file_bounded(path.c_str(),node.size())==node_hash&&
      node.find("\"ownerRegion\":\""+b.key+"\"")!=node.npos&&node.find("\"sha256\":\""+b.digest+"\"")!=node.npos&&
      node.find("\"alias\":{\"unitId\":"+std::to_string(b.values[1])+",\"agentId\":"+std::to_string(b.values[2])+"},\"homeAlias\":{\"kind\":\""+(b.proxy_home?"proxy":"native")+"\",\"unitId\":"+
        std::to_string(b.values[5])+",\"agentId\":"+std::to_string(b.values[6])+"}")!=node.npos;
}

// One canonical, bounded browser staging contract. It contains no arbitrary
// paths and retains no checkpoint or actor pointers across world disposal.
struct HeroNativeHomeInput {
  uint32_t serial=0,source_clock=0,clock=0,source_unit=0,source_agent=0,home_unit=0,home_agent=0,pack_bytes=0,home_bytes=0;
  bool proxy=false,reuse=false;
  std::string source,target,source_manifest,target_manifest,owner_manifest,pack_digest,home_digest;
};
bool selected_hero_parse_native_home_input(std::string_view text,HeroNativeHomeInput &out) {
  if(text.empty()||text.size()>4096)return false;
  HeroNativeHomeInput r;
  auto literal=[&](std::string_view expected){if(!text.starts_with(expected))return false;text.remove_prefix(expected.size());return true;};
  auto number=[&](uint32_t &n){const size_t end=text.find_first_not_of("0123456789");
    if(!end||end==text.npos)return false;const auto raw=text.substr(0,end);
    const auto parsed=std::from_chars(raw.data(),raw.data()+raw.size(),n);
    if(parsed.ec!=std::errc{}||parsed.ptr!=raw.data()+raw.size()||raw!=std::to_string(n))return false;
    text.remove_prefix(end);return true;};
  auto string=[&](std::string &value){if(!literal("\""))return false;value.clear();
    while(!text.empty()){
      char ch=text.front();text.remove_prefix(1);if(ch=='\"')return true;
      if(ch=='\\'){
        if(text.empty())return false;ch=text.front();text.remove_prefix(1);
        if(ch=='n')ch='\n';else if(ch!='\"'&&ch!='\\')return false;
      }else if(static_cast<unsigned char>(ch)<32||static_cast<unsigned char>(ch)>126)return false;
      value.push_back(ch);
    }return false;};
  std::string filename,kind,home_kind;
  if(!literal("{\"version\":1,\"kind\":")||!string(kind)||
     (kind!="majesty-hero-native-home-input-v1"&&kind!="majesty-hero-proxy-home-input-v1"))return false;
  r.proxy=kind=="majesty-hero-proxy-home-input-v1";
  if(!literal(",\"serial\":")||!number(r.serial)||
     !literal(",\"sourceRegion\":")||!string(r.source)||!literal(",\"targetRegion\":")||!string(r.target)||
     !literal(",\"sourceClock\":")||!number(r.source_clock)||!literal(",\"destinationClock\":")||!number(r.clock)||
     !literal(",\"sourceAlias\":{\"unitId\":")||!number(r.source_unit)||!literal(",\"agentId\":")||!number(r.source_agent)||
     !literal("},\"homeAlias\":{\"kind\":")||!string(home_kind)||home_kind!=(r.proxy?"proxy":"native")||
     !literal(",\"unitId\":")||!number(r.home_unit)||!literal(",\"agentId\":")||!number(r.home_agent)||
     !literal("},\"sourceNativeManifest\":")||!string(r.source_manifest)||!literal(",\"destinationNativeManifest\":")||!string(r.target_manifest)||
     !literal(",\"ownerManifest\":")||!string(r.owner_manifest))return false;
  if(r.proxy){std::string home_filename,admission;
    if(!literal(",\"home\":{\"filename\":")||!string(home_filename)||home_filename!="Frontier_Hero_Home.GPL"||
       !literal(",\"admission\":")||!string(admission)||(admission!="reserve-new"&&admission!="reuse-existing")||
       !literal(",\"size\":")||!number(r.home_bytes)||r.home_bytes<56||r.home_bytes>1024||
       !literal(",\"sha256\":")||!string(r.home_digest)||!TransferStore::digest(r.home_digest)||!literal("}"))return false;
    r.reuse=admission=="reuse-existing";
  }
  if(!literal(",\"package\":{\"filename\":")||!string(filename)||
     !literal(",\"size\":")||!number(r.pack_bytes)||!literal(",\"sha256\":")||!string(r.pack_digest)||!literal("}}\n")||!text.empty())return false;
  auto region_coords=[](const std::string &key,std::array<int32_t,2> &coords){
    const auto split=key.find('_');if(key.size()>24||split==key.npos)return false;
    for(unsigned i=0;i<2;++i){const auto raw=std::string_view(key).substr(i?split+1:0,i?key.size()-split-1:split);
      const auto parsed=std::from_chars(raw.data(),raw.data()+raw.size(),coords[i]);
      if(parsed.ec!=std::errc{}||parsed.ptr!=raw.data()+raw.size()||raw!=std::to_string(coords[i])||coords[i]<-1000000||coords[i]>1000000)return false;}
    return true;};
  std::array<int32_t,2> source{},target{};
  if(!r.serial||!r.source_unit||!r.source_agent||r.source_agent>0x7fffffffu||
     (r.proxy?r.home_unit!=0:!r.home_unit)||!r.home_agent||r.home_agent>=(r.proxy?0x7ffffffeu:0x80000000u)||
     r.pack_bytes<96||r.pack_bytes>256*1024||filename!="Frontier_Hero_Arrival.pack"||!TransferStore::digest(r.pack_digest)||
     r.source_manifest.empty()||r.source_manifest.size()>511||r.target_manifest.empty()||r.target_manifest.size()>511||
     r.owner_manifest.empty()||r.owner_manifest.size()>512||!region_coords(r.source,source)||!region_coords(r.target,target)||
     std::abs(source[0]-target[0])+std::abs(source[1]-target[1])!=1)return false;
  out=std::move(r);return true;
}
// Compare the entire canonical pure-agent record against the immutable guild
// registration. A package digest alone cannot authorize another logical home.
bool selected_hero_proxy_input_home(const std::string &identity,const HeroNativeHomeInput &r,const std::string &profile) {
  const std::string prefix="\"registeredHome\":{\"version\":1,\"worldId\":";
  const auto begin=identity.find(prefix);if(begin==identity.npos||identity.find(prefix,begin+1)!=identity.npos)return false;
  std::string_view text(identity.data()+begin+prefix.size(),identity.size()-begin-prefix.size());
  auto literal=[&](std::string_view expected){if(!text.starts_with(expected))return false;text.remove_prefix(expected.size());return true;};
  auto string=[&](std::string &value){if(!literal("\""))return false;const auto end=text.find('"');
    if(end==text.npos||end>64)return false;value=std::string(text.substr(0,end));
    for(char ch:value)if(static_cast<unsigned char>(ch)<32||ch=='\\')return false;text.remove_prefix(end+1);return true;};
  auto number=[&](uint32_t &n){const auto end=text.find_first_not_of("0123456789");if(!end||end==text.npos)return false;
    const auto value=text.substr(0,end);const auto p=std::from_chars(value.data(),value.data()+value.size(),n);
    if(p.ec!=std::errc{}||p.ptr!=value.data()+value.size()||value!=std::to_string(n))return false;text.remove_prefix(end);return true;};
  std::string world,content,guild,origin,origin_digest;uint32_t unit=0,agent=0,description=0,player=0;
  if(!string(world)||!TransferStore::digest(world)||!literal(",\"contentDigest\":")||!string(content)||!TransferStore::digest(content)||
     !literal(",\"guildEntityId\":")||!string(guild)||!TransferStore::digest(guild)||!literal(",\"home\":{\"region\":")||!string(origin)||
     origin.empty()||origin.size()>24||origin==r.target||!literal(",\"unitId\":")||!number(unit)||!unit||
     !literal(",\"agentId\":")||!number(agent)||!agent||agent>0x7fffffffu||!literal(",\"description\":")||!number(description)||
     !literal(",\"playerNumber\":")||!number(player)||!literal(",\"originCheckpointSha256\":")||!string(origin_digest)||
     !TransferStore::digest(origin_digest)||!literal("}"))return false;
  const auto &b=selected_hero_binding();
  if(description!=b.values[7]||player!=b.values[4]||
     (!b.proxy_home&&(origin!=r.source||unit!=b.values[5]||agent!=b.values[6])))return false;
  std::array<uint8_t,1024> canonical{};size_t at=0;bool valid=true;
  auto word=[&](uint32_t n){if(at+4>canonical.size()){valid=false;return;}
    for(unsigned k=0;k<4;++k)canonical[at++]=uint8_t(n>>(k*8));};
  auto zero_string=[&](std::string_view value){if(at+value.size()+1>canonical.size()){valid=false;return;}
    for(char ch:value)canonical[at++]=uint8_t(ch);canonical[at++]=0;};
  auto envelope=[&](uint32_t version){const auto start=at;word(0);word(version);return start;};
  auto end=[&](size_t start){word(0);word(UINT32_MAX);if(!valid||start+4>at)return;
    const auto size=uint32_t(at-start);for(unsigned k=0;k<4;++k)canonical[start+k]=uint8_t(size>>(k*8));};
  auto attribute_string=[&](std::string_view name,std::string_view value){zero_string(name);word(3);zero_string(value);};
  auto attribute_number=[&](std::string_view name,uint32_t value){zero_string(name);word(1);word(value);};
  const auto record=envelope(2),attributes=envelope(0);word(9);
  attribute_string("content_digest",content);attribute_string("frontier_proxy","majesty-remote-home-v1");attribute_string("guild_entity_id",guild);
  attribute_number("home_agent_id",agent);attribute_number("home_description",description);attribute_number("home_player",player);
  attribute_string("home_region",origin);attribute_number("home_unit_id",unit);attribute_string("world_id",world);end(attributes);
  word(0);word(r.home_agent);zero_string("");word(0);if(at+7>canonical.size())return false;
  canonical[at++]=0;word(0);canonical[at++]=0;canonical[at++]=0;end(record);
  if(!valid||at!=r.home_bytes)return false;
  const auto actual=selected_hero_small_text(profile+"/Frontier_Hero_Home.GPL",1024);
  return actual.size()==at&&!std::memcmp(actual.data(),canonical.data(),at);
}
bool selected_hero_native_home_input_selected(X86 *c,const std::string &text,HeroNativeHomeInput &input) {
  HeroNativeHomeInput r;const auto &b=selected_hero_binding();const auto &t=selected_hero_travel;const auto &s=region_session();
  const uint32_t state=rd32(0x006d7670);
  if(!c||!selected_hero_parse_native_home_input(text,r)||!b.enabled||!b.admitted||!b.closed||!b.retired||
     (t.stage!=SelectedHeroTravel::Stage::held&&!(t.stage==SelectedHeroTravel::Stage::generated&&t.generating&&t.initialized))||
     r.serial!=b.save_serial||r.source!=b.key||r.target!=t.target||region().key!=r.target||
     r.source_clock!=b.save_clock||r.clock!=t.clock||r.source_unit!=b.values[1]||r.source_agent!=b.values[2]||
     r.owner_manifest!=b.owner_manifest||!gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=r.clock||
     mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
  std::string source_marker,target_marker;std::array<std::string,2> source_paths,target_paths;
  session_paths(s.previous,source_marker,source_paths);session_paths(s.target,target_marker,target_paths);
  if(s.previous.key!=r.source||s.target.key!=r.target||selected_hero_small_text(source_marker,511)!=r.source_manifest||
     selected_hero_small_text(target_marker,511)!=r.target_manifest)return false;
  const auto source=CheckpointStore(source_marker,source_paths,std::string(content_identity())).read(),
      target=CheckpointStore(target_marker,target_paths,std::string(content_identity())).read();
  uint32_t seed=0,game_seed=0,clock=0;
  if(source.status!=CheckpointStore::Status::valid||target.status!=CheckpointStore::Status::valid||target.digest!=t.digest||
     !session_saved_rng(source_paths[source.slot],seed,game_seed,&clock)||clock!=r.source_clock||
     !session_saved_rng(target_paths[target.slot],seed,game_seed,&clock)||clock!=r.clock)return false;
  std::string journal=s.root+"/hero-route";
#ifndef __EMSCRIPTEN__
  const char *test=recomp_env("BROWSER_FRONTIER_HERO_PUBLICATION_TEST"),*owned=recomp_env("BROWSER_FRONTIER_HERO_PUBLICATION_JOURNAL");
  if(test&&!std::strcmp(test,"v1")){
    if(!owned||s.root.find("/actor-arrival-fixture-hero-binding-")==s.root.npos)return false;
    journal=owned;const auto split=journal.find_last_of('/');
    if(split==journal.npos||!journal.substr(split+1).starts_with("actor-arrival-fixture-hero-route-")||journal.find("/../")!=journal.npos)return false;
  }
#endif
  OsStat folder{};const std::string prefix="{\"version\":1,\"identitySha256\":\"";
  if(os_lstat(journal.c_str(),&folder)||!folder.is_dir||folder.is_symlink||!r.owner_manifest.starts_with(prefix)||
     selected_hero_small_text(journal+"/Frontier_Hero_Route.checkpoint",512)!=r.owner_manifest)return false;
  const std::string identity_hash=r.owner_manifest.substr(prefix.size(),64),identity_path=journal+"/Frontier_Hero_Route_Identity.json",
      identity=selected_hero_small_text(identity_path,4096);
  const std::string home="\"home\":{\"region\":\""+r.target+"\",\"unitId\":"+std::to_string(r.home_unit)+",\"agentId\":"+std::to_string(r.home_agent)+
      ",\"description\":"+std::to_string(b.values[7])+",\"playerNumber\":"+std::to_string(b.values[4])+",\"originCheckpointSha256\":\"";
  if(!TransferStore::digest(identity_hash)||identity.empty()||loader_hash_file_bounded(identity_path.c_str(),identity.size())!=identity_hash||
     (!r.proxy&&identity.find(home)==identity.npos))return false;
  const char *profile=recomp_env("PROFILE_DIR");if(!profile)return false;
  if(r.proxy){const std::string path=std::string(profile)+"/Frontier_Hero_Home.GPL";OsStat st{};
    if(os_lstat(path.c_str(),&st)||!st.is_regular||st.is_symlink||st.size!=r.home_bytes||
       loader_hash_file_bounded(path.c_str(),r.home_bytes)!=r.home_digest||!selected_hero_proxy_input_home(identity,r,profile))return false;}
  const std::string pack=std::string(profile)+"/Frontier_Hero_Arrival.pack";OsStat st{};
  if(os_lstat(pack.c_str(),&st)||!st.is_regular||st.is_symlink||st.size!=r.pack_bytes||loader_hash_file_bounded(pack.c_str(),r.pack_bytes)!=r.pack_digest)return false;
  input=std::move(r);return true;
}

bool selected_hero_attach_proxy_home_input(X86 *c,const HeroNativeHomeInput &input,const std::string &text) {
  auto &t=selected_hero_travel;auto &b=selected_hero_binding();bool qualify=false;
#ifndef __EMSCRIPTEN__
  const char *test=recomp_env("BROWSER_FRONTIER_HERO_JOIN_TEST");qualify=test&&!std::strcmp(test,"v1");
  if(qualify){
    const std::array<std::pair<std::string,std::string>,6> controls{{{"\"serial\":"+std::to_string(input.serial)+",","\"serial\":0,"},
      std::pair{"\"sourceClock\":"+std::to_string(input.source_clock)+",","\"sourceClock\":"+std::to_string(input.source_clock+1)+","},
      std::pair{"\"homeAlias\":{\"kind\":\"proxy\",\"unitId\":0,","\"homeAlias\":{\"kind\":\"proxy\",\"unitId\":1,"},
      std::pair{"\"ownerManifest\":","\"unexpectedOwner\":"},
      std::pair{input.home_digest,std::string(64,'f')},
      std::pair{"\"unitId\":0,\"agentId\":"+std::to_string(input.home_agent)+"}","\"unitId\":0,\"agentId\":"+std::to_string(input.home_agent+1)+"}"}}};
    for(const auto &[needle,replacement]:controls){auto bad=text;const auto at=bad.find(needle);if(at==bad.npos)std::abort();bad.replace(at,needle.size(),replacement);
      HeroNativeHomeInput refused;if(selected_hero_native_home_input_selected(c,bad,refused))std::abort();}
    HeroNativeHomeInput refused;if(selected_hero_native_home_input_selected(c,text+" ",refused)||
        selected_hero_native_home_input_selected(c,std::string(4097,'x'),refused))std::abort();
  }
#endif
  const bool repeat=input.reuse;
  auto snapshot=[&](const char *fresh,const char *reused){
#ifndef __EMSCRIPTEN__
    if(qualify&&!joint_fixture_checkpoint(c,repeat?reused:fresh,"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",t.target.c_str(),"actor-arrival-fixture-hero-binding-"))std::abort();
#endif
  };
  if(t.generating)hero_entry_reservation.finish(t.clock);
  snapshot("Hero_Home_Before","Hero_Repeat_Home_Before");
  if(qualify&&majesty_browser_streaming_register_hero_home(c,input.home_digest.c_str(),input.home_bytes,t.clock,input.home_agent,!repeat))std::abort();
  if(majesty_browser_streaming_register_hero_home(c,input.home_digest.c_str(),input.home_bytes,t.clock,input.home_agent,repeat)!=input.home_agent){
    t.stage=SelectedHeroTravel::Stage::failed;return false;}
  if(!repeat){snapshot("Hero_Home_Registered","Hero_Repeat_Home_Reused");
    if(majesty_browser_streaming_register_hero_home(c,input.home_digest.c_str(),input.home_bytes,t.clock,input.home_agent,true)!=input.home_agent){
      t.stage=SelectedHeroTravel::Stage::failed;return false;}}
  snapshot("Hero_Home_Reused","Hero_Repeat_Home_Reused");
  std::array<uint32_t,5> aliases{};
  if(qualify){const std::string bad(64,'f');
    if(majesty_browser_streaming_import_hero_arrival(c,bad.c_str(),input.pack_bytes,b.values[1],b.values[2],b.save_clock,t.clock,input.home_agent,aliases.data())||
       majesty_browser_streaming_import_hero_arrival(c,input.pack_digest.c_str(),input.pack_bytes,b.values[1],b.values[2],b.save_clock,t.clock+1,input.home_agent,aliases.data())||
       majesty_browser_streaming_import_hero_arrival(c,input.pack_digest.c_str(),input.pack_bytes,b.values[1],b.values[2],b.save_clock,t.clock,UINT32_MAX,aliases.data()))std::abort();}
  snapshot("Hero_Arrival_Refused","Hero_Repeat_Arrival_Refused");
  if(!majesty_browser_streaming_import_hero_arrival(c,input.pack_digest.c_str(),input.pack_bytes,b.values[1],b.values[2],b.save_clock,t.clock,input.home_agent,aliases.data())){
    t.stage=SelectedHeroTravel::Stage::failed;return false;}
  snapshot("Hero_Arrival_Imported","Hero_Repeat_Arrival_Imported");
  if(qualify){auto invalid=aliases;invalid[1]=1;
    if(majesty_browser_streaming_activate_hero_arrival(c,invalid.data(),input.home_agent,t.clock)||
       majesty_browser_streaming_activate_hero_arrival(c,aliases.data(),input.home_agent,t.clock+1))std::abort();}
  if(repeat)snapshot("Hero_Arrival_Activation_Refused","Hero_Repeat_Activation_Refused");
  if(!majesty_browser_streaming_activate_hero_arrival(c,aliases.data(),input.home_agent,t.clock)){selected_hero_arrival_refused();return false;}
  if(qualify&&majesty_browser_streaming_activate_hero_arrival(c,aliases.data(),input.home_agent,t.clock))std::abort();
  auto binding=b.values;binding[0]=t.clock;binding[1]=aliases[0];binding[2]=aliases[4];binding[5]=0;binding[6]=input.home_agent;
  if(!majesty_browser_streaming_active_hero_binding(c,binding.data()))std::abort();
  snapshot("Hero_Travel_Target_Active","Hero_Repeat_Target_Active");t.aliases=aliases;t.home_unit=0;t.home_agent=input.home_agent;
  if(repeat)std::fprintf(stderr,"[frontier] Hero repeated neighbor arrival held serial=%u region=%s source=%u/%u source-clock=%u hero=%u agent=%u home=%u clock=%u existing-home-reused=1 wrong-digest-refused=%u wrong-clock-refused=%u wrong-home-refused=%u activated=1 duplicate-refused=%u fresh-proxy-binding=1 phase=7 pending=0 ordinary-ticks=0 owner-published=0 result=pass\n",
      input.serial,t.target.c_str(),b.values[1],b.values[2],b.save_clock,aliases[0],aliases[4],input.home_agent,t.clock,unsigned(qualify),unsigned(qualify),unsigned(qualify),unsigned(qualify));
  else std::fprintf(stderr,"[frontier] Hero travel arrival ready source=%u/%u source-clock=%u region=%s hero=%u agent=%u home=%u clock=%u original-import=1 activated=1 paused=1 ordinary-ticks=0 owner-published=0 result=pass\n",
      b.values[1],b.values[2],b.save_clock,t.target.c_str(),aliases[0],aliases[4],input.home_agent,t.clock);
  std::fprintf(stderr,"[frontier] Hero proxy home input consumed serial=%u source=%s target=%s source-clock=%u target-clock=%u bytes=%u admission=%s staged-manifests-verified=1 selected-owner-verified=1 immutable-home-record-verified=1 canonical-input=1 control-refusals=%u phase=7 ordinary-ticks=0\n",
      input.serial,input.source.c_str(),input.target.c_str(),input.source_clock,input.clock,input.pack_bytes,repeat?"reuse-existing":"reserve-new",qualify?8u:0u);
  selected_hero_arrival_checkpoint(c);return true;
}

// Consume the same input staged by the browser. Full activation and checkpoint
// are the ordinary path; native qualification may stop at intermediate stages.
// Custody publication remains a separate gate before any original game tick.
bool selected_hero_attach_native_home_input(X86 *c) {
  const char *profile=recomp_env("PROFILE_DIR");if(!profile)return false;
  const std::string text=selected_hero_small_text(std::string(profile)+"/Frontier_Hero_Travel_Input.json");
  HeroNativeHomeInput input;if(!selected_hero_native_home_input_selected(c,text,input))return false;
  if(input.proxy)return selected_hero_attach_proxy_home_input(c,input,text);
  auto &t=selected_hero_travel;auto &b=selected_hero_binding();bool qualify=false,activate=true,publish=true;
#ifndef __EMSCRIPTEN__
  const bool repeat=b.save_serial==6;const char *test=recomp_env("BROWSER_FRONTIER_HERO_JOIN_TEST");
  qualify=test&&!std::strcmp(test,"v1");
  if(qualify){
    const char *activation=recomp_env(repeat?"BROWSER_FRONTIER_HERO_REPEAT_HOME_ACTIVATE_TEST":"BROWSER_FRONTIER_HERO_HOME_ACTIVATE_TEST"),
        *publication=recomp_env(repeat?"BROWSER_FRONTIER_HERO_REPEAT_HOME_PUBLISH_TEST":"BROWSER_FRONTIER_HERO_HOME_PUBLISH_TEST");
    if((activation&&std::strcmp(activation,"v1"))||(publication&&std::strcmp(publication,"v1")))std::abort();
    activate=activation!=nullptr;publish=publication!=nullptr;
    const std::array<std::pair<std::string,std::string>,4> controls{{{"\"serial\":"+std::to_string(input.serial)+",","\"serial\":0,"},
      std::pair{"\"sourceClock\":"+std::to_string(input.source_clock)+",","\"sourceClock\":"+std::to_string(input.source_clock+1)+","},
      std::pair{"\"unitId\":"+std::to_string(input.home_unit)+",\"agentId\":"+std::to_string(input.home_agent)+"}","\"unitId\":1,\"agentId\":"+std::to_string(input.home_agent)+"}"},
      std::pair{"\"ownerManifest\":","\"unexpectedOwner\":"}}};
    for(const auto &[needle,replacement]:controls){
      std::string bad=text;const auto at=bad.find(needle);if(at==bad.npos)std::abort();bad.replace(at,needle.size(),replacement);
      HeroNativeHomeInput refused;if(selected_hero_native_home_input_selected(c,bad,refused))std::abort();
    }
    HeroNativeHomeInput refused;
    if(selected_hero_native_home_input_selected(c,text+" ",refused)||selected_hero_native_home_input_selected(c,std::string(4097,'x'),refused))std::abort();
  }
#endif
  auto snapshot=[&](const char *name){
#ifndef __EMSCRIPTEN__
    if(qualify){const std::string label=b.save_serial==6?"Hero_Repeat_Return_Home"+std::string(name).substr(std::strlen("Hero_Return_Home")):name;
      if(!joint_fixture_checkpoint(c,label.c_str(),"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",t.target.c_str(),"actor-arrival-fixture-hero-binding-"))std::abort();}
#endif
  };
  snapshot("Hero_Return_Home_Before");std::array<uint32_t,5> aliases{};
#ifndef __EMSCRIPTEN__
  if(qualify){const std::string bad(64,'f');
    if(majesty_browser_streaming_import_hero_arrival(c,bad.c_str(),input.pack_bytes,b.values[1],b.values[2],b.save_clock,t.clock,input.home_agent,aliases.data())||
       majesty_browser_streaming_import_hero_arrival(c,input.pack_digest.c_str(),input.pack_bytes,b.values[1],b.values[2],b.save_clock,t.clock+1,input.home_agent,aliases.data())||
       majesty_browser_streaming_import_hero_arrival(c,input.pack_digest.c_str(),input.pack_bytes,b.values[1],b.values[2],b.save_clock,t.clock,UINT32_MAX,aliases.data()))std::abort();}
#endif
  snapshot("Hero_Return_Home_Refused");
  if(!majesty_browser_streaming_import_hero_arrival(c,input.pack_digest.c_str(),input.pack_bytes,b.values[1],b.values[2],b.save_clock,t.clock,input.home_agent,aliases.data()))return false;
  snapshot("Hero_Return_Home_Imported");t.aliases=aliases;t.home_unit=input.home_unit;t.home_agent=input.home_agent;
  std::fprintf(stderr,"[frontier] Hero return home import held serial=%u region=%s source=%u/%u source-clock=%u hero=%u agent=%u home=%u/%u clock=%u wrong-digest-refused=%u wrong-clock-refused=%u wrong-home-refused=%u ordinary-ticks=0 activated=0 owner-published=0 result=pass\n",
      b.save_serial,t.target.c_str(),b.values[1],b.values[2],b.save_clock,aliases[0],aliases[4],t.home_unit,t.home_agent,t.clock,unsigned(qualify),unsigned(qualify),unsigned(qualify));
  if(!activate)return true;
#ifndef __EMSCRIPTEN__
  if(qualify){auto invalid=aliases;invalid[1]=1;
    if(majesty_browser_streaming_activate_hero_arrival(c,invalid.data(),t.home_agent,t.clock)||
       majesty_browser_streaming_activate_hero_arrival(c,aliases.data(),t.home_agent,t.clock+1))std::abort();}
#endif
  snapshot("Hero_Return_Home_Activation_Refused");
  if(!majesty_browser_streaming_activate_hero_arrival(c,aliases.data(),t.home_agent,t.clock)){selected_hero_arrival_refused();return false;}
  auto binding=b.values;binding[0]=t.clock;binding[1]=aliases[0];binding[2]=aliases[4];binding[5]=t.home_unit;binding[6]=t.home_agent;
  if(!majesty_browser_streaming_active_hero_binding(c,binding.data()))std::abort();
#ifndef __EMSCRIPTEN__
  if(qualify){auto wrong=binding;wrong[5]=0;
    if(majesty_browser_streaming_activate_hero_arrival(c,aliases.data(),t.home_agent,t.clock)||majesty_browser_streaming_route_hero_home(c,32,272)||
       majesty_browser_streaming_active_hero_binding(c,wrong.data()))std::abort();}
#endif
  snapshot("Hero_Return_Home_Active");
  std::fprintf(stderr,"[frontier] Hero return home activation held serial=%u region=%s hero=%u agent=%u home=%u/%u clock=%u wrong-alias-refused=%u wrong-clock-refused=%u duplicate-refused=%u remote-route-refused=%u fresh-native-binding=1 ordinary-ticks=0 phase=7 pending=0 owner-published=0 result=pass\n",
      b.save_serial,t.target.c_str(),aliases[0],aliases[4],t.home_unit,t.home_agent,t.clock,unsigned(qualify),unsigned(qualify),unsigned(qualify),unsigned(qualify));
  std::fprintf(stderr,"[frontier] Hero native home input consumed serial=%u source=%s target=%s source-clock=%u target-clock=%u bytes=%u staged-manifests-verified=1 selected-owner-verified=1 registered-home-verified=1 canonical-input=1 control-refusals=%u phase=7 ordinary-ticks=0\n",
      input.serial,input.source.c_str(),input.target.c_str(),input.source_clock,input.clock,input.pack_bytes,qualify?6u:0u);
  if(publish)selected_hero_arrival_checkpoint(c);return true;
}
// Validate a selected same-owner capture using its actual home kind. The
// browser's game lease and the private native driver use this same gate.
bool selected_hero_capture_selected(X86 *c,const std::string &ack,uint32_t clock,std::string &head,std::string &head_hash) {
  const auto &b=selected_hero_binding();const auto journal=selected_hero_journal();
  if(b.owner_manifest.empty()||journal.empty())return false;
  std::string marker;std::array<std::string,2> paths;
  if(!checkpoint_store(c,region(),marker,paths))return false;const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();
  if(saved.status!=CheckpointStore::Status::valid)return false;
  const std::string prefix="majesty-hero-capture-published-v1|"+std::to_string(b.save_serial)+"|"+b.key+"|"+std::to_string(clock)+"|"+
      std::to_string(b.values[1])+"|"+std::to_string(b.values[2])+"|"+std::to_string(b.values[6])+"|"+std::to_string(saved.size)+"|"+saved.digest+"|";
  bool accepted=ack.starts_with(prefix)&&ack.size()==prefix.size()+65&&ack.back()=='\n';
  head_hash=accepted?ack.substr(prefix.size(),64):std::string{};
  const std::string head_path=journal+"/Frontier_Hero_Route.checkpoint";head=selected_hero_small_text(head_path,512);
  const std::string hp="{\"version\":1,\"identitySha256\":\"",middle="\",\"revision\":",last=",\"nodeSha256\":\"";
  std::string identity,node_hash,node;uint32_t revision=0;
  if(accepted){
    OsStat folder{};accepted=TransferStore::digest(head_hash)&&!os_lstat(journal.c_str(),&folder)&&folder.is_dir&&!folder.is_symlink&&
        head.starts_with(hp)&&head.size()>=hp.size()+64+middle.size()+last.size()+68&&loader_hash_file_bounded(head_path.c_str(),head.size())==head_hash;
    if(accepted){identity=head.substr(hp.size(),64);const size_t start=hp.size()+64+middle.size(),end=head.find(last,start);
      accepted=TransferStore::digest(identity)&&head.substr(hp.size()+64,middle.size())==middle&&end!=head.npos;
      if(accepted){const auto n=std::from_chars(head.data()+start,head.data()+end,revision);node_hash=head.substr(end+last.size(),64);
        accepted=n.ec==std::errc{}&&n.ptr==head.data()+end&&revision&&head.substr(start,end-start)==std::to_string(revision)&&TransferStore::digest(node_hash)&&
            head==hp+identity+middle+std::to_string(revision)+last+node_hash+"\"}\n"&&loader_hash_file_bounded((journal+"/Frontier_Hero_Route_Identity.json").c_str(),4096)==identity;}}
    if(accepted){const std::string node_path=journal+"/Frontier_Hero_Route_Node_"+std::to_string(revision)+".json";node=selected_hero_small_text(node_path);
      accepted=!node.empty()&&loader_hash_file_bounded(node_path.c_str(),node.size())==node_hash&&
          node.find("\"previous\":"+b.owner_manifest.substr(0,b.owner_manifest.size()-1)+",\"kind\":\"save\",\"ownerRegion\":\""+b.key+"\"")!=node.npos;
      int match=-1;
      for(int slot=0;accepted&&slot<2;++slot){const std::string entry="{\"region\":\""+b.key+"\",\"slot\":"+std::to_string(slot)+
          ",\"alias\":{\"unitId\":"+std::to_string(b.values[1])+",\"agentId\":"+std::to_string(b.values[2])+"},\"homeAlias\":{\"kind\":\""+(b.values[5]?"native":"proxy")+"\",\"unitId\":"+std::to_string(b.values[5])+",\"agentId\":"+
          std::to_string(b.values[6])+"},\"world\":{\"size\":"+std::to_string(saved.size)+",\"sha256\":\""+saved.digest+"\"}}";
        if(node.find("\"changes\":["+entry+"]}\n")!=node.npos){if(match!=-1){accepted=false;break;}match=slot;}}
      if(accepted){const std::string world_path=journal+"/Frontier_Hero_Route_"+b.key+"_"+std::to_string(match)+".GMP";OsStat st{};
        accepted=match>=0&&!os_lstat(world_path.c_str(),&st)&&st.is_regular&&!st.is_symlink&&st.size==saved.size&&loader_hash_file_bounded(world_path.c_str(),saved.size)==saved.digest;}
    }
  }
  return accepted;
}

bool selected_hero_refresh_save_owner(X86 *c) {
  auto &b=selected_hero_binding();const auto journal=selected_hero_journal();if(journal.empty())return false;
  std::string marker;std::array<std::string,2> paths;if(!checkpoint_store(c,region(),marker,paths))return false;
  const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();uint32_t seed=0,game_seed=0,clock=0;
  if(saved.status!=CheckpointStore::Status::valid||!session_saved_rng(paths[saved.slot],seed,game_seed,&clock)||clock!=b.save_clock)return false;
  const auto head=selected_hero_small_text(journal+"/Frontier_Hero_Route.checkpoint",512);
  if(head==b.owner_manifest){const auto previous=b.digest;b.digest=saved.digest;const bool same=selected_hero_seed_owner(head);b.digest=previous;return same;}
  const auto hash=loader_hash_file_bounded((journal+"/Frontier_Hero_Route.checkpoint").c_str(),head.size());
  const std::string ack="majesty-hero-capture-published-v1|"+std::to_string(b.save_serial)+"|"+b.key+"|"+std::to_string(b.save_clock)+"|"+
      std::to_string(b.values[1])+"|"+std::to_string(b.values[2])+"|"+std::to_string(b.values[6])+"|"+std::to_string(saved.size)+"|"+saved.digest+"|"+hash+"\n";
  std::string selected,selected_hash;if(!selected_hero_capture_selected(c,ack,b.save_clock,selected,selected_hash)||selected!=head)return false;
  b.owner_manifest=head;return true;
}

bool selected_hero_departure_selected(X86 *c,const std::string &text,HeroNativeHomeInput &input,int &direction,std::string &head_hash) {
  auto &b=selected_hero_binding();auto &s=region_session();HeroNativeHomeInput r;
  const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c),manager=rd32(0x006d8568);
  if(!c||!selected_hero_parse_native_home_input(text,r)||!b.enabled||!b.admitted||b.closed||b.retired||!b.halo_layout||
     b.save_stage!=SelectedHeroBinding::SaveStage::held||r.serial!=b.save_serial||r.source!=b.key||r.source!=region().key||
     r.target!=b.crossing_target||r.source_clock!=b.save_clock||r.source_unit!=b.values[1]||r.source_agent!=b.values[2]||
     finished||network_blocked||saving||mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP||
     !gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=b.save_clock||!gm_valid(world,0x14)||
     !gm_valid(manager,0x21c)||rd32(manager+0x218)==2||s.stage!=RegionSession::Stage::idle||
     selected_hero_travel.stage!=SelectedHeroTravel::Stage::idle)return false;
  const auto journal=selected_hero_journal();const char *raw=recomp_env("PROFILE_DIR");if(journal.empty()||!raw)return false;
  const std::string profile(raw),suffix="/frontier_"+b.key,root=profile.substr(0,profile.size()-suffix.size()),target_profile=root+"/frontier_"+r.target;
  if(s.enabled&&(!s.initialized||!s.exit_hook||s.root!=root||s.target.key!=b.key||s.crossing_enabled||s.scroll_hook||s.saved_world||
      s.release_hook||s.release_tracking||s.pending_seed||s.pending_game_seed))return false;
  if(!s.enabled&&s.exit_hook)return false;
  if(selected_hero_small_text(target_profile+"/Frontier_Hero_Travel_Input.json",4096)!=text)return false;
  std::string marker;std::array<std::string,2> paths;if(!checkpoint_store(c,region(),marker,paths))return false;
  if(selected_hero_small_text(marker,511)!=r.source_manifest)return false;
  const auto source=CheckpointStore(marker,paths,std::string(content_identity())).read();
  const auto target_marker=target_profile+"/Frontier_"+r.target+".checkpoint",save_root=target_profile+"/Documents/My Games/MajestyHD/SaveGame/Frontier_"+r.target;
  if(selected_hero_small_text(target_marker,511)!=r.target_manifest)return false;
  const std::array<std::string,2> target_paths{save_root+".GMP",save_root+"_Recovery.GMP"};
  const auto target=CheckpointStore(target_marker,target_paths,std::string(content_identity())).read();uint32_t seed=0,game_seed=0,clock=0;
  if(source.status!=CheckpointStore::Status::valid||target.status!=CheckpointStore::Status::valid||
      !session_saved_rng(paths[source.slot],seed,game_seed,&clock)||clock!=r.source_clock||
      !session_saved_rng(target_paths[target.slot],seed,game_seed,&clock)||clock!=r.clock)return false;
  const auto head=selected_hero_small_text(journal+"/Frontier_Hero_Route.checkpoint",512);
  if(head!=r.owner_manifest)return false;
  const auto digest=loader_hash_file_bounded((journal+"/Frontier_Hero_Route.checkpoint").c_str(),head.size());std::string selected,selected_hash;
  const std::string ack="majesty-hero-capture-published-v1|"+std::to_string(r.serial)+"|"+b.key+"|"+std::to_string(b.save_clock)+"|"+
      std::to_string(b.values[1])+"|"+std::to_string(b.values[2])+"|"+std::to_string(b.values[6])+"|"+std::to_string(source.size)+"|"+source.digest+"|"+digest+"\n";
  if(!selected_hero_capture_selected(c,ack,b.save_clock,selected,selected_hash)||selected!=head)return false;
  const std::string hp="{\"version\":1,\"identitySha256\":\"";if(!head.starts_with(hp))return false;
  const auto identity=selected_hero_small_text(journal+"/Frontier_Hero_Route_Identity.json",4096);
  if(identity.empty()||loader_hash_file_bounded((journal+"/Frontier_Hero_Route_Identity.json").c_str(),identity.size())!=head.substr(hp.size(),64))return false;
  if(r.proxy){const auto name=target_profile+"/Frontier_Hero_Home.GPL";OsStat st{};
    if(os_lstat(name.c_str(),&st)||!st.is_regular||st.is_symlink||st.size!=r.home_bytes||
       loader_hash_file_bounded(name.c_str(),r.home_bytes)!=r.home_digest||!selected_hero_proxy_input_home(identity,r,target_profile))return false;
  }else{
    const std::string home="\"home\":{\"region\":\""+r.target+"\",\"unitId\":"+std::to_string(r.home_unit)+",\"agentId\":"+std::to_string(r.home_agent)+
       ",\"description\":"+std::to_string(b.values[7])+",\"playerNumber\":"+std::to_string(b.values[4])+",\"originCheckpointSha256\":\"";
    if(identity.find(home)==identity.npos)return false;
  }
  const auto pack=target_profile+"/Frontier_Hero_Arrival.pack";OsStat st{};
  if(os_lstat(pack.c_str(),&st)||!st.is_regular||st.is_symlink||st.size!=r.pack_bytes||loader_hash_file_bounded(pack.c_str(),r.pack_bytes)!=r.pack_digest)return false;
  FILE *f=std::fopen(pack.c_str(),"rb");if(!f)return false;
  std::array<uint32_t,12> words{};bool good=std::fread(words.data(),4,12,f)==12;
  const std::array<uint32_t,12> expected{0x3141484du,1,4,r.source_clock,r.clock,r.source_unit,r.source_agent,r.home_agent,100000,1000,0,r.pack_bytes-96};
  good=good&&words==expected;uint32_t at=48;
  for(uint32_t kind=0;good&&kind<4;++kind){std::array<uint32_t,3> descriptor{};
    good=std::fread(descriptor.data(),4,3,f)==3&&descriptor[0]==kind&&descriptor[1]==r.source_unit&&descriptor[2]&&
        descriptor[2]<=64u*1024&&uint64_t(at)+12+descriptor[2]<=r.pack_bytes;
    if(good){at+=12+descriptor[2];good=!std::fseek(f,long(descriptor[2]),SEEK_CUR);}}
  good=good&&at==r.pack_bytes&&!std::ferror(f);const bool closed=!std::fclose(f);if(!good||!closed)return false;
  // A remote home requires the imported actor's live interception. The
  // original enrolled hero has no arrival binding. Its native guild/actor
  // ownership is checked by retire_selected_hero at this held phase, before
  // that function mutates the source. selected_hero_ready is phase-3 only.
  auto binding=b.values;binding[0]=b.save_clock;
  if(b.proxy_home&&!majesty_browser_streaming_active_hero_binding(c,binding.data()))return false;
  const auto split=r.target.find('_');int32_t x=0,y=0;
  std::from_chars(r.target.data(),r.target.data()+split,x);std::from_chars(r.target.data()+split+1,r.target.data()+r.target.size(),y);
  direction=x<region().x?0:y<region().y?1:y>region().y?2:3;input=std::move(r);head_hash=selected_hash;return true;
}

bool selected_hero_departure_snapshot(X86 *c,const char *label) {
  if(std::strcmp(label,"Hero_Travel_Source_Retired")&&std::strcmp(label,"Hero_Source_Retired"))return false;
  const uint32_t world=rd32(0x0071c68c);X86 extra=*c;const uint32_t renderer=guest_call(&extra,0x004401c0);
  if(!gm_valid(renderer,4)||!gm_valid(rd32(renderer),0x54))return false;const auto table=rd32(renderer);
  extra=*c;extra.r[R_ECX]=renderer;const uint32_t previous=guest_call(&extra,rd32(table+0x30));
  extra=*c;extra.r[R_ECX]=renderer;guest_call(&extra,rd32(table+0x44));
  saving=true;const bool saved=write_checkpoint(c,label,world);saving=false;
  extra=*c;extra.r[R_ECX]=renderer;guest_call(&extra,rd32(table+0x50),previous,1u);win32_invalidate_dir_cache();
  const auto filename=native_checkpoint_path(c,label);OsStat st{};uint32_t seed=0,game_seed=0,clock=0;
  return saved&&!os_lstat(filename.c_str(),&st)&&st.is_regular&&!st.is_symlink&&st.size&&st.size<=64u*1024*1024&&
      session_saved_rng(filename,seed,game_seed,&clock)&&clock==selected_hero_binding().save_clock;
}

bool selected_hero_retire_captured(X86 *c,uint32_t clock) {
  // The arrival binding's clock precedes the held crossing. Validate retirement
  // against that captured state while retaining the authenticated actor IDs.
  auto binding=selected_hero_binding().values;binding[0]=clock;
  return majesty_browser_streaming_retire_selected_hero(c,binding.data(),clock);
}

// The unexplored request binds the CURRENT captured journal and accepted
// crossing. There is deliberately no target actor/package until original
// generation has attached a real kingdom. Never use this to replace a save.
bool selected_hero_generation_action(X86 *c) {
  auto &b=selected_hero_binding();auto &s=region_session();auto &t=selected_hero_travel;
  if(!os_browser_take_action(("frontier-hero-generate-"+std::to_string(b.save_serial)).c_str()))return false;
  auto refused=[&](){std::fprintf(stderr,"[frontier] Hero generation request refused serial=%u region=%s clock=%u source-held=1\n",
      b.save_serial,b.key.c_str(),b.save_clock);return false;};
  const char *flag=recomp_env("RULE_FRONTIER_HERO_GENERATION"),*raw=recomp_env("PROFILE_DIR");
  const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c),manager=rd32(0x006d8568);
  if(!c||!flag||std::strcmp(flag,"v1")||!raw||!b.enabled||!b.admitted||b.closed||b.retired||!b.halo_layout||
     b.save_stage!=SelectedHeroBinding::SaveStage::held||!b.save_serial||b.key!=region().key||
     !seeded_generation()||!connected_terrain()||finished||network_blocked||saving||mods_hook_depth()||!sched_holds_baton()||
     c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP||!gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4)||
     rd32(0x0071c6a8)!=b.save_clock||!gm_valid(world,0x14)||!gm_valid(manager,0x21c)||rd32(manager+0x218)==2||
     s.stage!=RegionSession::Stage::idle||t.stage!=SelectedHeroTravel::Stage::idle)return refused();
  Region target=region();int direction=-1;constexpr int dx[]={-1,0,0,1},dy[]={0,-1,1,0};
  for(int d=0;d<4;++d){const int x=region().x+dx[d],y=region().y+dy[d];
    if(x>=-1000000&&x<=1000000&&y>=-1000000&&y<=1000000&&b.crossing_target==std::to_string(x)+"_"+std::to_string(y)){
      direction=d;target.x=x;target.y=y;target.key=b.crossing_target;target.checkpoint="Frontier_"+target.key;target.seed=region_seed(x,y);break;}}
  if(direction<0)return refused();
  const std::string profile(raw),suffix="/frontier_"+b.key;
  if(!profile.ends_with(suffix)||profile!=mods_overlay_profile_dir())return refused();
  const auto root=profile.substr(0,profile.size()-suffix.size()),leaf=root.substr(root.find_last_of('/')+1);
  bool owned=leaf.starts_with("native-world-")&&leaf.size()>13&&leaf.size()<=53;
  if(owned)for(char ch:leaf)if(!((ch>='a'&&ch<='z')||(ch>='0'&&ch<='9')||ch=='-'))owned=false;
#ifndef __EMSCRIPTEN__
  const char *test=recomp_env("BROWSER_FRONTIER_HERO_PAGE_TEST");
  owned=owned||(test&&!std::strcmp(test,"v1")&&leaf.starts_with("actor-arrival-fixture-hero-binding-")&&leaf.size()<=80);
#endif
  if(!owned||s.serial==UINT64_MAX||
     (s.enabled&&(!s.initialized||!s.exit_hook||s.root!=root||s.target.key!=b.key||s.crossing_enabled||s.scroll_hook||s.saved_world||
       s.release_hook||s.release_tracking||s.pending_seed||s.pending_game_seed))||(!s.enabled&&s.exit_hook))return refused();
  const auto journal=selected_hero_journal();if(journal.empty())return refused();
  std::string marker;std::array<std::string,2> paths;if(!checkpoint_store(c,region(),marker,paths))return refused();
  const auto source=CheckpointStore(marker,paths,std::string(content_identity())).read();uint32_t seed=0,game_seed=0,clock=0;
  const auto source_manifest=selected_hero_small_text(marker,511),head=selected_hero_small_text(journal+"/Frontier_Hero_Route.checkpoint",512);
  if(source.status!=CheckpointStore::Status::valid||source_manifest.empty()||head.empty()||
     !session_saved_rng(paths[source.slot],seed,game_seed,&clock)||clock!=b.save_clock)return refused();
  const auto head_hash=loader_hash_file_bounded((journal+"/Frontier_Hero_Route.checkpoint").c_str(),head.size());
  const std::string ack="majesty-hero-capture-published-v1|"+std::to_string(b.save_serial)+"|"+b.key+"|"+std::to_string(b.save_clock)+"|"+
      std::to_string(b.values[1])+"|"+std::to_string(b.values[2])+"|"+std::to_string(b.values[6])+"|"+
      std::to_string(source.size)+"|"+source.digest+"|"+head_hash+"\n";
  std::string captured,captured_hash;
  if(!selected_hero_capture_selected(c,ack,b.save_clock,captured,captured_hash)||captured!=head)return refused();
  auto quote=[](const std::string &value){std::string out="\"";
    for(char ch:value){if(ch=='\n')out+="\\n";else{if(ch=='\"'||ch=='\\')out+='\\';out+=ch;}}return out+'\"';};
  const std::string expected="{\"version\":1,\"kind\":\"majesty-hero-generation-input-v1\",\"serial\":"+std::to_string(b.save_serial)+
      ",\"sourceRegion\":"+quote(b.key)+",\"targetRegion\":"+quote(target.key)+",\"sourceClock\":"+std::to_string(b.save_clock)+
      ",\"sourceAlias\":{\"unitId\":"+std::to_string(b.values[1])+",\"agentId\":"+std::to_string(b.values[2])+"},\"homeAlias\":{\"kind\":\""+
      (b.proxy_home?"proxy":"native")+"\",\"unitId\":"+std::to_string(b.values[5])+",\"agentId\":"+std::to_string(b.values[6])+"},\"sourceNativeManifest\":"+
      quote(source_manifest)+",\"ownerManifest\":"+quote(head)+",\"generation\":{\"layout\":\"halo-v1\",\"seed\":"+std::to_string(target.seed)+
      ",\"nativeCells\":128,\"coreCells\":124}}\n";
  const auto text=selected_hero_small_text(profile+"/Frontier_Hero_Generation_Request.json",4096);
  if(text!=expected)return refused();
  const auto previous_root=s.root;s.root=root;std::string name;seed=game_seed=0;
  const auto admission=session_admit(target,name,seed,game_seed);s.root=previous_root;
  if(admission!=SessionAdmission::fresh)return refused();
  uint32_t initialization_ticks=0;
  if(!majesty_browser_streaming_hero_generation_ticks(paths[source.slot].c_str(),b.values.data(),b.save_clock,&initialization_ticks)||
     loader_hash_file_bounded(paths[source.slot].c_str(),source.size)!=source.digest)return refused();
  std::array<int32_t,4> entry_bounds{};
  if(!majesty_browser_streaming_hero_entry_bounds(c,b.values.data(),b.save_clock,entry_bounds.data()))return refused();
  // Validate and arm while the source is intact. Only cell coordinates survive
  // its original retirement/unload; binding waits for the empty target grid.
  if(!hero_entry_reservation.arm(target,entry_bounds.data()))return refused();
  if(!selected_hero_retire_captured(c,b.save_clock)){hero_entry_reservation.clear();return refused();}
  b.closed=true;b.retired=true;b.before_valid=false;b.save_stage=SelectedHeroBinding::SaveStage::idle;
  b.owner_manifest=head;b.retired_checkpoint="Hero_Travel_Source_Retired";
  if(!selected_hero_departure_snapshot(c,b.retired_checkpoint.c_str())){
    hero_entry_reservation.clear();
    t.stage=SelectedHeroTravel::Stage::failed;
    std::fprintf(stderr,"[frontier] Hero generation recovery failed serial=%u captured-recovery-preserved=1\n",b.save_serial);return true;}
  std::fprintf(stderr,"[frontier] Hero generation request consumed serial=%u source=%s target=%s bytes=%zu selected-owner-verified=1 crossing-verified=1 target-absent-verified=1 source-retired=1 phase=7 pending=0\n",
      b.save_serial,b.key.c_str(),target.key.c_str(),text.size());
  if(!selected_hero_begin_travel(c,direction,nullptr,0,true,initialization_ticks)){
    hero_entry_reservation.clear();
    t.stage=SelectedHeroTravel::Stage::failed;
    std::fprintf(stderr,"[frontier] Hero generation load refused serial=%u captured-recovery-preserved=1\n",b.save_serial);}
  return true;
}

bool selected_hero_departure_action(X86 *c) {
  auto &b=selected_hero_binding();const std::string action="frontier-hero-travel-"+std::to_string(b.save_serial);
  if(!os_browser_take_action(action.c_str()))return false;
  const char *raw=recomp_env("PROFILE_DIR");if(!raw)return false;
  const auto text=selected_hero_small_text(std::string(raw)+"/Frontier_Hero_Travel_Request.json",4096);
  HeroNativeHomeInput input;int direction=-1;std::string head_hash;
  if(!selected_hero_departure_selected(c,text,input,direction,head_hash)){
    std::fprintf(stderr,"[frontier] Hero departure request refused serial=%u region=%s clock=%u phase=7 pending=0\n",b.save_serial,b.key.c_str(),b.save_clock);return false;
  }
  bool qualify=false,public_later=false;const char *audit=nullptr;
#ifndef __EMSCRIPTEN__
  public_later=recomp_env("BROWSER_FRONTIER_HERO_PUBLIC_REQUEST_TEST")&&b.save_serial!=1;
  if(public_later){
    audit=b.save_serial==2?"Hero_Remote_Source":b.save_serial==4?"Hero_Repeat_Source":b.save_serial==6?"Hero_Repeat_Remote_Source":nullptr;
    if(!audit)std::abort();auto binding=b.values;binding[0]=b.save_clock;
    if(!majesty_browser_streaming_active_hero_binding(c,binding.data())||
       !joint_fixture_checkpoint(c,(std::string(audit)+"_Before").c_str(),"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",b.key.c_str(),"actor-arrival-fixture-hero-binding-"))std::abort();
    auto invalid=binding;invalid[1]=UINT32_MAX;auto foreign=binding;foreign[5]=b.proxy_home?469:0;
    if(majesty_browser_streaming_retire_selected_hero(c,binding.data(),b.save_clock+1)||
       majesty_browser_streaming_retire_selected_hero(c,invalid.data(),b.save_clock)||
       majesty_browser_streaming_retire_selected_hero(c,foreign.data(),b.save_clock)||
       !joint_fixture_checkpoint(c,(std::string(audit)+"_Refused").c_str(),"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",b.key.c_str(),"actor-arrival-fixture-hero-binding-"))std::abort();
  }
  const char *test=recomp_env("BROWSER_FRONTIER_HERO_SOURCE_REQUEST_TEST");qualify=test&&!std::strcmp(test,"v1");
  qualify=qualify&&!public_later;
  if(qualify){
    if(b.save_serial!=1||b.key!="0_0"||b.proxy_home)std::abort();
    if(!joint_fixture_checkpoint(c,"Hero_Source_Before","BROWSER_FRONTIER_HERO_RETIRE_TEST","0_0","actor-arrival-fixture-hero-binding-"))std::abort();
    auto invalid=b.values;invalid[1]=UINT32_MAX;
    if(majesty_browser_streaming_retire_selected_hero(c,b.values.data(),b.save_clock+1)||
       majesty_browser_streaming_retire_selected_hero(c,invalid.data(),b.save_clock)||
       !joint_fixture_checkpoint(c,"Hero_Source_Refused","BROWSER_FRONTIER_HERO_RETIRE_TEST","0_0","actor-arrival-fixture-hero-binding-"))std::abort();
  }
#endif
  if(!selected_hero_retire_captured(c,b.save_clock))return false;
  b.closed=true;b.retired=true;b.before_valid=false;b.save_stage=SelectedHeroBinding::SaveStage::idle;
  b.owner_manifest=input.owner_manifest;b.retired_checkpoint=qualify?"Hero_Source_Retired":"Hero_Travel_Source_Retired";
  if(!selected_hero_departure_snapshot(c,b.retired_checkpoint.c_str())){
    selected_hero_travel.stage=SelectedHeroTravel::Stage::failed;
    std::fprintf(stderr,"[frontier] Hero departure recovery failed serial=%u region=%s captured-recovery-preserved=1\n",b.save_serial,b.key.c_str());return true;
  }
#ifndef __EMSCRIPTEN__
  if(public_later){
    auto binding=b.values;binding[0]=b.save_clock;
    const std::string retired=std::string(audit)+"_Retired";
    if(!joint_fixture_checkpoint(c,retired.c_str(),"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",b.key.c_str(),"actor-arrival-fixture-hero-binding-")||
       majesty_browser_streaming_retire_selected_hero(c,binding.data(),b.save_clock)||majesty_browser_streaming_active_hero_binding(c,binding.data()))std::abort();
    b.retired_checkpoint=retired;
    if(b.proxy_home)std::fprintf(stderr,"[frontier] Hero remote source retirement completed serial=%u region=1_0 unit=%u agent=%u proxy=%u clock=%u manifest-sha256=%s captured-journal-selected=1 captured-save-preserved=1 retired-saved=1 wrong-clock-refused=1 wrong-alias-refused=1 wrong-home-refused=1 duplicate-refused=1 binding-closed=1 phase=7 pending=0 retired-pair-published=0 result=pass\n",b.save_serial,b.values[1],b.values[2],b.values[6],b.save_clock,head_hash.c_str());
    else std::fprintf(stderr,"[frontier] Hero repeated source retirement completed serial=4 region=0_0 unit=%u agent=%u home=%u/%u clock=%u manifest-sha256=%s captured-journal-selected=1 captured-save-preserved=1 retired-saved=1 wrong-clock-refused=1 wrong-alias-refused=1 wrong-home-refused=1 duplicate-refused=1 active-binding-ended=1 phase=7 pending=0 result=pass\n",b.values[1],b.values[2],b.values[5],b.values[6],b.save_clock,head_hash.c_str());
  }
  if(qualify){
    if(majesty_browser_streaming_retire_selected_hero(c,b.values.data(),b.save_clock))std::abort();
    std::fprintf(stderr,"[frontier] Hero first capture selected serial=1 region=0_0 clock=%u manifest-sha256=%s before-retirement=1 phase=7 pending=0\n",b.save_clock,head_hash.c_str());
    std::fprintf(stderr,"[frontier] Hero source retirement completed serial=1 region=0_0 unit=%u agent=%u clock=%u captured-save-preserved=1 retired-saved=1 wrong-clock-refused=1 wrong-alias-refused=1 duplicate-refused=1 binding-closed=1 phase=7 pending=0 owner-published=0 result=pass\n",b.values[1],b.values[2],b.save_clock);
  }
#endif
  const char *profile=recomp_env("PROFILE_DIR");const std::string suffix="/frontier_"+input.source;
  const auto root=std::string(profile).substr(0,std::strlen(profile)-suffix.size());
  const auto target_marker=selected_hero_small_text(root+"/frontier_"+input.target+"/Frontier_"+input.target+".checkpoint",511);
  const auto first=target_marker.find('\n',target_marker.find('\n')+1),last=target_marker.find('\n',first+1);
  // The marker was authenticated above; retain only the target digest for the
  // existing loader. A failed unload leaves the captured recovery selected.
  const auto digest_start=last+1,digest_end=target_marker.find('\n',digest_start);
  const auto target_digest=target_marker.substr(digest_start,digest_end-digest_start);
  std::fprintf(stderr,"[frontier] Hero departure request consumed serial=%u source=%s target=%s bytes=%zu selected-owner-verified=1 crossing-verified=1 destination-input-verified=1 source-retired=1 phase=7 pending=0\n",input.serial,input.source.c_str(),input.target.c_str(),text.size());
  if(!selected_hero_begin_travel(c,direction,target_digest.c_str(),input.clock)){
    selected_hero_travel.stage=SelectedHeroTravel::Stage::failed;
    std::fprintf(stderr,"[frontier] Hero departure load refused serial=%u captured-recovery-preserved=1\n",b.save_serial);
  }
  return true;
}
#ifndef __EMSCRIPTEN__
// A second outward retirement uses the actual current native-guild binding,
// after publishing this original accepted crossing capture under its new IDs.
bool selected_hero_repeat_retire_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_DEPARTURE_TEST");if(!flag)return false;
  auto &b=selected_hero_binding();const char *profile=recomp_env("PROFILE_DIR");const std::string path(profile?profile:"");
  const uint32_t clock=rd32(0x0071c6a8),state=rd32(0x006d7670);
  if(std::strcmp(flag,"v1")||b.proxy_home||b.closed||!b.admitted||b.key!="0_0"||b.save_serial!=4||clock!=b.save_clock||
     b.save_stage!=SelectedHeroBinding::SaveStage::held||!gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4)||
     path.find("/actor-arrival-fixture-hero-binding-")==path.npos||!path.ends_with("/frontier_0_0"))std::abort();
  const auto now=os_monotonic_ns();if(now-b.save_poll_ns<100000000u)return false;b.save_poll_ns=now;
  const std::string ack=selected_hero_small_text(path+"/Frontier_Hero_Capture_Published.txt",512);
  if(!ack.starts_with("majesty-hero-capture-published-v1|4|"))return false;
  std::string head,head_hash;if(!selected_hero_capture_selected(c,ack,clock,head,head_hash)){
    if(ack!=b.capture_last_refused){b.capture_last_refused=ack;
      std::fprintf(stderr,"[frontier] Hero captured publication refused serial=4 region=0_0 clock=%u phase=7 pending=0\n",clock);}return false;
  }
  auto binding=b.values;binding[0]=clock;if(!majesty_browser_streaming_active_hero_binding(c,binding.data()))std::abort();
  auto snapshot=[&](const char *name){if(!joint_fixture_checkpoint(c,name,"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT","0_0","actor-arrival-fixture-hero-binding-"))std::abort();};
  snapshot("Hero_Repeat_Source_Before");auto invalid=binding;invalid[1]=UINT32_MAX;auto foreign=binding;foreign[5]=0;
  if(majesty_browser_streaming_retire_selected_hero(c,binding.data(),clock+1)||majesty_browser_streaming_retire_selected_hero(c,invalid.data(),clock)||
     majesty_browser_streaming_retire_selected_hero(c,foreign.data(),clock))std::abort();snapshot("Hero_Repeat_Source_Refused");
  if(!selected_hero_retire_captured(c,clock))std::abort();snapshot("Hero_Repeat_Source_Retired");
  if(majesty_browser_streaming_retire_selected_hero(c,binding.data(),clock)||majesty_browser_streaming_active_hero_binding(c,binding.data())||
     rd32(0x0071c6a8)!=clock||rd32(state)!=7||rd32(state+4))std::abort();
  b.retired_checkpoint="Hero_Repeat_Source_Retired";
  b.owner_manifest=head;b.closed=true;b.retired=true;b.before_valid=false;b.save_stage=SelectedHeroBinding::SaveStage::idle;
  std::fprintf(stderr,"[frontier] Hero repeated source retirement completed serial=4 region=0_0 unit=%u agent=%u home=%u/%u clock=%u manifest-sha256=%s captured-journal-selected=1 captured-save-preserved=1 retired-saved=1 wrong-clock-refused=1 wrong-alias-refused=1 wrong-home-refused=1 duplicate-refused=1 active-binding-ended=1 phase=7 pending=0 result=pass\n",
    binding[1],binding[2],binding[5],binding[6],clock,head_hash.c_str());return true;
}
bool selected_hero_remote_retire_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_REMOTE_RETIRE_TEST");if(!flag)return false;
  auto &b=selected_hero_binding();const char *profile=recomp_env("PROFILE_DIR"),*owned=recomp_env("BROWSER_FRONTIER_HERO_PUBLICATION_JOURNAL");
  const std::string path(profile?profile:""),journal(owned?owned:"");const uint32_t state=rd32(0x006d7670),clock=rd32(0x0071c6a8);
  const uint32_t serial=b.save_serial;const bool repeat=serial==6;
  const char *return_test=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_RETURN_TEST");
  if(std::strcmp(flag,"v1")||!b.proxy_home||b.key!="1_0"||!b.admitted||b.closed||(serial!=2&&!repeat)||
     (repeat&&(!return_test||std::strcmp(return_test,"v1")))||clock!=b.save_clock||
     b.save_stage!=SelectedHeroBinding::SaveStage::held||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||!path.ends_with("/frontier_1_0")||
     journal.find("/actor-arrival-fixture-hero-route-")==journal.npos||journal.find("/../")!=journal.npos||
     !gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4)||b.owner_manifest.empty())std::abort();
  const auto now=os_monotonic_ns();if(now-b.save_poll_ns<100000000u)return false;b.save_poll_ns=now;
  const std::string ack=selected_hero_small_text(path+"/Frontier_Hero_Capture_Published.txt",512);if(ack.empty())return false;
  if(repeat&&!ack.starts_with("majesty-hero-capture-published-v1|6|"))return false;
  std::string head,head_hash;const bool accepted=selected_hero_capture_selected(c,ack,clock,head,head_hash);
  if(!accepted){if(ack!=b.capture_last_refused){b.capture_last_refused=ack;
      std::fprintf(stderr,"[frontier] Hero captured publication refused serial=%u region=1_0 clock=%u phase=7 pending=0\n",serial,clock);}return false;}
  auto binding=b.values;binding[0]=clock;
  if(!majesty_browser_streaming_active_hero_binding(c,binding.data()))std::abort();
  auto snapshot=[&](const char *name){return joint_fixture_checkpoint(c,name,"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT","1_0","actor-arrival-fixture-hero-binding-");};
  if(!snapshot(repeat?"Hero_Repeat_Remote_Source_Before":"Hero_Remote_Source_Before"))std::abort();
  auto wrong=binding;wrong[1]=UINT32_MAX;auto wrong_home=binding;wrong_home[5]=469;
  if(majesty_browser_streaming_retire_selected_hero(c,binding.data(),clock+1)||majesty_browser_streaming_retire_selected_hero(c,wrong.data(),clock)||
     majesty_browser_streaming_retire_selected_hero(c,wrong_home.data(),clock)||!snapshot(repeat?"Hero_Repeat_Remote_Source_Refused":"Hero_Remote_Source_Refused"))std::abort();
  if(!selected_hero_retire_captured(c,clock)||!snapshot(repeat?"Hero_Repeat_Remote_Source_Retired":"Hero_Remote_Source_Retired")||
     majesty_browser_streaming_retire_selected_hero(c,binding.data(),clock)||majesty_browser_streaming_active_hero_binding(c,binding.data())||
     rd32(0x0071c6a8)!=clock||rd32(state)!=7||rd32(state+4))std::abort();
  b.retired_checkpoint=repeat?"Hero_Repeat_Remote_Source_Retired":"Hero_Remote_Source_Retired";
  b.owner_manifest=head;b.closed=true;b.retired=true;b.before_valid=false;b.save_stage=SelectedHeroBinding::SaveStage::idle;
  std::fprintf(stderr,"[frontier] Hero remote source retirement completed serial=%u region=1_0 unit=%u agent=%u proxy=%u clock=%u manifest-sha256=%s captured-journal-selected=1 captured-save-preserved=1 retired-saved=1 wrong-clock-refused=1 wrong-alias-refused=1 wrong-home-refused=1 duplicate-refused=1 binding-closed=1 phase=7 pending=0 retired-pair-published=0 result=pass\n",serial,b.values[1],b.values[2],b.values[6],clock,head_hash.c_str());
  return true;
}
#endif
// The document's held world lease authorizes the receipt writer. Also require
// the selected head/node and both published GMPs to match the held native pair.
bool selected_hero_publication_selected(const std::string &head_hash) {
  auto &t=selected_hero_travel;const auto &b=selected_hero_binding();const auto &s=region_session();
  std::string journal=s.root+"/hero-route";
#ifndef __EMSCRIPTEN__
  const char *test=recomp_env("BROWSER_FRONTIER_HERO_PUBLICATION_TEST"),*owned=recomp_env("BROWSER_FRONTIER_HERO_PUBLICATION_JOURNAL");
  if(test&&!std::strcmp(test,"v1")){
    if(!owned||s.root.find("/actor-arrival-fixture-hero-binding-")==s.root.npos)return false;
    journal=owned;const auto split=journal.find_last_of('/');
    if(split==journal.npos||!journal.substr(split+1).starts_with("actor-arrival-fixture-hero-route-")||journal.find("/../")!=journal.npos)return false;
  }
#endif
  OsStat st{};if(os_lstat(journal.c_str(),&st)||!st.is_dir||st.is_symlink)return false;
  const std::string head_path=journal+"/Frontier_Hero_Route.checkpoint",head=selected_hero_small_text(head_path,512);
  const std::string prefix="{\"version\":1,\"identitySha256\":\"",middle="\",\"revision\":",last=",\"nodeSha256\":\"";
  if(!head.starts_with(prefix)||head.size()<prefix.size()+64+middle.size()+last.size()+68||loader_hash_file_bounded(head_path.c_str(),head.size())!=head_hash)return false;
  const std::string identity=head.substr(prefix.size(),64);if(!TransferStore::digest(identity)||head.substr(prefix.size()+64,middle.size())!=middle)return false;
  const size_t start=prefix.size()+64+middle.size(),end=head.find(last,start);if(end==head.npos)return false;
  uint32_t revision=0;const auto number=std::from_chars(head.data()+start,head.data()+end,revision);
  if(number.ec!=std::errc{}||number.ptr!=head.data()+end||!revision||head.substr(start,end-start)!=std::to_string(revision))return false;
  const std::string node_hash=head.substr(end+last.size(),64);
  if(!TransferStore::digest(node_hash)||head!=prefix+identity+middle+std::to_string(revision)+last+node_hash+"\"}\n"||
     loader_hash_file_bounded((journal+"/Frontier_Hero_Route_Identity.json").c_str(),4096)!=identity)return false;
  const std::string node_path=journal+"/Frontier_Hero_Route_Node_"+std::to_string(revision)+".json",node=selected_hero_small_text(node_path);
  if(node.empty()||loader_hash_file_bounded(node_path.c_str(),node.size())!=node_hash||
     node.find("\"kind\":\"handoff\",\"ownerRegion\":\""+t.target+"\"")==node.npos||node.find("\"identitySha256\":\""+identity+"\"")==node.npos)return false;
  if(!b.owner_manifest.empty()&&node.find("\"previous\":"+b.owner_manifest.substr(0,b.owner_manifest.size()-1)+",\"kind\":\"handoff\"")==node.npos)return false;
  auto entry=[&](bool target,int slot){return std::string("{\"region\":\"")+(target?t.target:b.key)+"\",\"slot\":"+std::to_string(slot)+
      ",\"alias\":{\"unitId\":"+std::to_string(target?t.aliases[0]:b.values[1])+",\"agentId\":"+std::to_string(target?t.aliases[4]:b.values[2])+
      "},\"homeAlias\":{\"kind\":\""+((target?t.home_unit:b.values[5])?"native":"proxy")+"\",\"unitId\":"+std::to_string(target?t.home_unit:b.values[5])+",\"agentId\":"+
      std::to_string(target?t.home_agent:b.values[6])+"},\"world\":{\"size\":"+std::to_string(target?t.active_size:t.retired_size)+
      ",\"sha256\":\""+(target?t.active_digest:t.retired_digest)+"\"}}";};
  for(bool target:{false,true}){int matched=-1;for(int slot=0;slot<2;++slot)if(node.find(entry(target,slot))!=node.npos){if(matched!=-1)return false;matched=slot;}
    if(matched<0)return false;const std::string path=journal+"/Frontier_Hero_Route_"+(target?t.target:b.key)+"_"+std::to_string(matched)+".GMP";
    OsStat world{};const uint64_t size=target?t.active_size:t.retired_size;
    if(os_lstat(path.c_str(),&world)||!world.is_regular||world.is_symlink||world.size!=size||
       loader_hash_file_bounded(path.c_str(),size)!=(target?t.active_digest:t.retired_digest))return false;
  }
  t.published_manifest=head;return true;
}
#ifndef __EMSCRIPTEN__
void selected_hero_repeat_join_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_IMPORT_TEST");if(!flag)return;
  auto &b=selected_hero_binding();auto &t=selected_hero_travel;
  const char *profile=recomp_env("PROFILE_DIR");const std::string path(profile?profile:"");
  if(std::strcmp(flag,"v1")||b.proxy_home||!b.closed||!b.retired||b.save_serial!=4||b.key!="0_0"||t.target!="1_0"||
     t.stage!=SelectedHeroTravel::Stage::held||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||!path.ends_with("/frontier_1_0"))std::abort();
  if(!selected_hero_attach_native_home_input(c))std::abort();
}
void selected_hero_join_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_JOIN_TEST");if(!flag)return;
  if(selected_hero_binding().save_serial==4){selected_hero_repeat_join_test(c);return;}
  const bool repeat=selected_hero_binding().save_serial==6;
  if(repeat){
    const char *repeat=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_HOME_PAGE_TEST");
    if(!repeat||std::strcmp(repeat,"v1")||!selected_hero_binding().proxy_home||selected_hero_travel.target!="0_0")std::abort();
    if(!recomp_env("BROWSER_FRONTIER_HERO_REPEAT_HOME_IMPORT_TEST"))return;
  }
  if(selected_hero_binding().proxy_home){const char *home=recomp_env("BROWSER_FRONTIER_HERO_HOME_PAGE_TEST");
    if(!home||std::strcmp(home,"v1")||selected_hero_travel.target!="0_0"||(selected_hero_binding().save_serial!=2&&!repeat))std::abort();
    const char *import=recomp_env(repeat?"BROWSER_FRONTIER_HERO_REPEAT_HOME_IMPORT_TEST":"BROWSER_FRONTIER_HERO_HOME_IMPORT_TEST");if(!import)return;
    const char *profile=recomp_env("PROFILE_DIR");const std::string_view path(profile?profile:"");
    if(std::strcmp(import,"v1")||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||!path.ends_with("/frontier_0_0"))std::abort();
    if(!selected_hero_attach_native_home_input(c))std::abort();
    return;}
  const char *page=recomp_env("BROWSER_FRONTIER_HERO_PAGE_TEST"),*profile=recomp_env("PROFILE_DIR");const std::string_view path(profile?profile:"");
  if(std::strcmp(flag,"v1")||!page||std::strcmp(page,"v1")||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||!path.ends_with("/frontier_1_0"))std::abort();
  if(recomp_env("BROWSER_FRONTIER_HERO_INITIAL_OWNER_MANIFEST")){
    if(!selected_hero_attach_native_home_input(c))std::abort();return;
  }
  auto number=[](const char *key){const char *raw=recomp_env(key);if(!raw)std::abort();uint32_t n=0;const size_t size=std::strlen(raw);
    const auto parsed=std::from_chars(raw,raw+size,n);if(parsed.ec!=std::errc{}||parsed.ptr!=raw+size||std::to_string(n)!=raw)std::abort();return n;};
  if(!selected_hero_attach_arrival(c,recomp_env("BROWSER_FRONTIER_HERO_JOIN_HOME_DIGEST"),number("BROWSER_FRONTIER_HERO_JOIN_HOME_BYTES"),
      number("BROWSER_FRONTIER_HERO_JOIN_HOME_ID"),recomp_env("BROWSER_FRONTIER_HERO_JOIN_PACK_DIGEST"),number("BROWSER_FRONTIER_HERO_JOIN_PACK_BYTES")))std::abort();
}
#endif
#ifndef __EMSCRIPTEN__
bool selected_hero_repeat_resume_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_PUBLISH_TEST");if(!flag)return false;
  auto &b=selected_hero_binding();if(b.closed||!b.proxy_home||(b.save_serial!=4&&b.save_serial!=5)||b.key!="1_0")return false;
  const char *profile=recomp_env("PROFILE_DIR");const std::string path(profile?profile:"");
  if(std::strcmp(flag,"v1")||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||!path.ends_with("/frontier_1_0"))std::abort();
  static bool pausing=false,held=false;const uint32_t state=rd32(0x006d7670),clock=rd32(0x0071c6a8);
  if(held){
    const char *save=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_SAVE_TEST");if(!save)return false;
    static bool accepted=false,resumed=false;
    if(accepted){
      const char *again=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_RETURN_TEST");if(!again||resumed)return false;
      if(std::strcmp(again,"v1"))std::abort();if(rd32(state)==7&&rd32(state+4)==3)return true;
      if(rd32(state)!=3||rd32(state+4)||clock!=b.save_clock||!majesty_browser_streaming_active_hero_binding(c,b.values.data()))std::abort();
      resumed=true;b.before_valid=false;b.motion_announced=false;b.motion_samples=0;
      std::fprintf(stderr,"[frontier] Hero repeated neighbor continued serial=5 region=1_0 unit=%u agent=%u home=%u clock=%u original-resume=1 fresh-proxy-binding=1 phase=3 pending=0 result=pass\n",b.values[1],b.values[2],b.values[6],clock);return true;
    }
    if(std::strcmp(save,"v1")||b.save_serial!=5||rd32(state)!=7||rd32(state+4)||clock!=b.save_clock)std::abort();
    const auto now=os_monotonic_ns();if(now-b.save_poll_ns<100000000u)return false;b.save_poll_ns=now;
    const std::string ack=selected_hero_small_text(path+"/Frontier_Hero_Capture_Published.txt",512);
    if(!ack.starts_with("majesty-hero-capture-published-v1|5|"))return false;
    std::string head,head_hash;if(!selected_hero_capture_selected(c,ack,clock,head,head_hash)){
      if(ack!=b.capture_last_refused){b.capture_last_refused=ack;std::fprintf(stderr,"[frontier] Hero captured publication refused serial=5 region=1_0 clock=%u phase=7 pending=0\n",clock);}return false;}
    auto binding=b.values;binding[0]=clock;if(!majesty_browser_streaming_active_hero_binding(c,binding.data()))std::abort();
    std::string marker;std::array<std::string,2> paths;if(!checkpoint_store(c,region(),marker,paths))std::abort();
    const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();if(saved.status!=CheckpointStore::Status::valid)std::abort();
    b.values=binding;b.owner_manifest=head;b.digest=saved.digest;accepted=true;
    std::fprintf(stderr,"[frontier] Hero repeated neighbor save accepted serial=5 region=1_0 unit=%u agent=%u home=%u clock=%u manifest-sha256=%s selected-capture-verified=1 fresh-proxy-binding=1 phase=7 pending=0 result=pass\n",b.values[1],b.values[2],b.values[6],clock,head_hash.c_str());
    if(const char *again=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_RETURN_TEST")){
      if(std::strcmp(again,"v1"))std::abort();X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,3u);
      if(rd32(state)!=7||rd32(state+4)!=3||rd32(0x0071c6a8)!=clock)std::abort();}
    return true;
  }
  if(pausing){
    if(rd32(state)==3&&rd32(state+4)==7)return true;
    if(rd32(state)!=7||rd32(state+4)||clock!=b.values[0]+100||b.save_stage!=SelectedHeroBinding::SaveStage::idle)std::abort();
    if(!joint_fixture_checkpoint(c,"Hero_Repeat_Target_Played","BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT","1_0","actor-arrival-fixture-hero-binding-"))std::abort();
    held=true;std::fprintf(stderr,"[frontier] Hero repeated neighbor gameplay held serial=4 region=1_0 unit=%u agent=%u home=%u start-clock=%u clock=%u original-ticks=2 fresh-proxy-binding=1 phase=7 pending=0 saved=1 result=pass\n",b.values[1],b.values[2],b.values[6],b.values[0],clock);
    if(const char *save=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_SAVE_TEST")){
      if(std::strcmp(save,"v1"))std::abort();saving=true;const bool saved=checkpoint(c,region(),rd32(0x0071c68c));saving=false;
      std::string marker;std::array<std::string,2> paths;if(!saved||!checkpoint_store(c,region(),marker,paths))std::abort();
      const auto current=CheckpointStore(marker,paths,std::string(content_identity())).read();uint32_t seed=0,game_seed=0,saved_clock=0;
      if(current.status!=CheckpointStore::Status::valid||!session_saved_rng(paths[current.slot],seed,game_seed,&saved_clock)||saved_clock!=clock||rd32(state)!=7||rd32(state+4))std::abort();
      b.save_serial=5;b.save_clock=clock;
      std::fprintf(stderr,"[frontier] Hero repeated neighbor save held receipt=majesty-hero-travel-ready-v1|5|1_0|%u|%u|%u|%u|%llu|%s phase=7 pending=0 ordinary-ticks=0\n",clock,b.values[1],b.values[2],b.values[6],(unsigned long long)current.size,current.digest.c_str());
    }
    return false;
  }
  if(rd32(state)!=3||rd32(state+4)||b.save_stage!=SelectedHeroBinding::SaveStage::idle||clock<b.values[0]||clock>b.values[0]+100)std::abort();
  if(clock<b.values[0]+100)return false;
  X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
  if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();pausing=true;return true;
}
bool selected_hero_repeat_home_resume_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_HOME_PUBLISH_TEST");if(!flag)return false;
  auto &b=selected_hero_binding();if(b.closed||b.proxy_home||(b.save_serial!=6&&b.save_serial!=7)||b.key!="0_0")return false;
  const char *profile=recomp_env("PROFILE_DIR");const std::string path(profile?profile:"");
  if(std::strcmp(flag,"v1")||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||!path.ends_with("/frontier_0_0"))std::abort();
  static bool pausing=false,held=false;const uint32_t state=rd32(0x006d7670),clock=rd32(0x0071c6a8);
  if(held){
    const char *save=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_HOME_SAVE_TEST");if(!save)return false;
    static bool accepted=false;if(accepted)return false;
    if(std::strcmp(save,"v1")||rd32(state)!=7||rd32(state+4)||clock!=b.save_clock||b.save_serial!=7)std::abort();
    const auto now=os_monotonic_ns();if(now-b.save_poll_ns<100000000u)return false;b.save_poll_ns=now;
    const std::string ack=selected_hero_small_text(path+"/Frontier_Hero_Capture_Published.txt",512);if(ack.empty())return false;
    std::string head,head_hash;if(!selected_hero_capture_selected(c,ack,clock,head,head_hash)){
      if(ack!=b.capture_last_refused){b.capture_last_refused=ack;
        std::fprintf(stderr,"[frontier] Hero captured publication refused serial=7 region=0_0 clock=%u phase=7 pending=0\n",clock);}return false;
    }
    auto binding=b.values;binding[0]=clock;if(!majesty_browser_streaming_active_hero_binding(c,binding.data()))std::abort();
    std::string marker;std::array<std::string,2> paths;if(!checkpoint_store(c,region(),marker,paths))std::abort();
    const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();if(saved.status!=CheckpointStore::Status::valid)std::abort();
    b.values=binding;b.owner_manifest=head;b.digest=saved.digest;accepted=true;
    std::fprintf(stderr,"[frontier] Hero repeated home save accepted serial=7 region=0_0 unit=%u agent=%u home=%u/%u clock=%u manifest-sha256=%s selected-capture-verified=1 fresh-native-binding=1 phase=7 pending=0 result=pass\n",
        b.values[1],b.values[2],b.values[5],b.values[6],clock,head_hash.c_str());return true;
  }
  if(pausing){
    if(rd32(state)==3&&rd32(state+4)==7)return true;
    auto binding=b.values;binding[0]=clock;
    if(rd32(state)!=7||rd32(state+4)||clock!=b.save_clock+300||
       !majesty_browser_streaming_active_hero_binding(c,binding.data())||
       !joint_fixture_checkpoint(c,"Hero_Repeat_Return_Home_Played","BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT","0_0","actor-arrival-fixture-hero-binding-"))std::abort();
    held=true;
    std::fprintf(stderr,"[frontier] Hero return home gameplay held serial=6 region=0_0 unit=%u agent=%u home=%u/%u from-clock=%u clock=%u ticks=6 original-gameplay=1 fresh-native-binding=1 phase=7 pending=0 result=pass\n",
        b.values[1],b.values[2],b.values[5],b.values[6],b.save_clock,clock);
    if(const char *save=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_HOME_SAVE_TEST")){
      if(std::strcmp(save,"v1")||b.save_serial!=6)std::abort();
      saving=true;const bool written=checkpoint(c,region(),rd32(0x0071c68c));saving=false;
      std::string marker;std::array<std::string,2> paths;if(!written||!checkpoint_store(c,region(),marker,paths))std::abort();
      const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();uint32_t seed=0,game_seed=0,saved_clock=0;
      if(saved.status!=CheckpointStore::Status::valid||!session_saved_rng(paths[saved.slot],seed,game_seed,&saved_clock)||saved_clock!=clock||rd32(state)!=7||rd32(state+4))std::abort();
      b.save_serial=7;b.save_clock=clock;b.save_stage=SelectedHeroBinding::SaveStage::idle;
      std::fprintf(stderr,"[frontier] Hero repeated home save held receipt=majesty-hero-travel-ready-v1|7|0_0|%u|%u|%u|%u|%llu|%s phase=7 pending=0 ordinary-ticks=0\n",
          clock,b.values[1],b.values[2],b.values[6],(unsigned long long)saved.size,saved.digest.c_str());
    }
    return true;
  }
  if(clock<b.save_clock+300)return false;
  if(clock!=b.save_clock+300||rd32(state)!=3||rd32(state+4)||region_session().completed_ticks!=6)std::abort();
  X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
  if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();pausing=true;return true;
}
bool selected_hero_home_resume_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_HOME_PUBLISH_TEST");if(!flag)return false;
  auto &b=selected_hero_binding();if(b.closed||b.proxy_home||(b.save_serial!=2&&b.save_serial!=3)||b.key!="0_0")return false;
  if(std::strcmp(flag,"v1"))std::abort();
  static bool pausing=false,held=false;const uint32_t state=rd32(0x006d7670),clock=rd32(0x0071c6a8);
  if(held){
    const char *save=recomp_env("BROWSER_FRONTIER_HERO_HOME_SAVE_TEST");if(!save)return false;
    static bool accepted=false,resumed=false;
    if(accepted){
      const char *repeat=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_DEPARTURE_TEST");if(!repeat)return false;
      if(std::strcmp(repeat,"v1"))std::abort();if(resumed)return false;
      if(rd32(state)==7&&rd32(state+4)==3)return true;
      if(rd32(state)!=3||rd32(state+4)||clock!=b.save_clock||!majesty_browser_streaming_active_hero_binding(c,b.values.data()))std::abort();
      b.move_test_done=false;b.motion_announced=false;b.motion_samples=0;b.before_valid=false;resumed=true;
      std::fprintf(stderr,"[frontier] Hero home departure resumed serial=3 region=0_0 unit=%u agent=%u home=%u/%u clock=%u original-resume=1 fresh-native-binding=1 phase=3 pending=0 result=pass\n",
        b.values[1],b.values[2],b.values[5],b.values[6],clock);return true;
    }
    if(std::strcmp(save,"v1")||rd32(state)!=7||rd32(state+4)||clock!=b.save_clock)std::abort();
    const auto now=os_monotonic_ns();if(now-b.save_poll_ns<100000000u)return false;b.save_poll_ns=now;
    const char *profile=recomp_env("PROFILE_DIR");const std::string path(profile?profile:"");
    if(path.find("/actor-arrival-fixture-hero-binding-")==path.npos||!path.ends_with("/frontier_0_0"))std::abort();
    const std::string ack=selected_hero_small_text(path+"/Frontier_Hero_Capture_Published.txt",512);if(ack.empty())return false;
    std::string head,head_hash;if(!selected_hero_capture_selected(c,ack,clock,head,head_hash)){
      if(ack!=b.capture_last_refused){b.capture_last_refused=ack;
        std::fprintf(stderr,"[frontier] Hero captured publication refused serial=3 region=0_0 clock=%u phase=7 pending=0\n",clock);}return false;
    }
    auto binding=b.values;binding[0]=clock;if(!majesty_browser_streaming_active_hero_binding(c,binding.data()))std::abort();
    std::string marker;std::array<std::string,2> paths;if(!checkpoint_store(c,region(),marker,paths))std::abort();
    const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();if(saved.status!=CheckpointStore::Status::valid)std::abort();
    b.values=binding;b.owner_manifest=head;b.digest=saved.digest;accepted=true;
    std::fprintf(stderr,"[frontier] Hero home save accepted serial=3 region=0_0 unit=%u agent=%u home=%u/%u clock=%u manifest-sha256=%s selected-capture-verified=1 fresh-native-binding=1 phase=7 pending=0 result=pass\n",
      b.values[1],b.values[2],b.values[5],b.values[6],clock,head_hash.c_str());
    if(const char *repeat=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_DEPARTURE_TEST")){
      if(std::strcmp(repeat,"v1"))std::abort();X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,3u);
      if(rd32(state)!=7||rd32(state+4)!=3||rd32(0x0071c6a8)!=clock)std::abort();
    }
    return true;
  }
  if(pausing){
    if(rd32(state)==3&&rd32(state+4)==7)return true;
    if(rd32(state)!=7||rd32(state+4)||clock!=b.save_clock+300)std::abort();
    auto binding=b.values;binding[0]=clock;
    if(!majesty_browser_streaming_active_hero_binding(c,binding.data())||
       !joint_fixture_checkpoint(c,"Hero_Return_Home_Played","BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT","0_0","actor-arrival-fixture-hero-binding-"))std::abort();
    held=true;
    std::fprintf(stderr,"[frontier] Hero return home gameplay held serial=2 region=0_0 unit=%u agent=%u home=%u/%u from-clock=%u clock=%u ticks=6 original-gameplay=1 fresh-native-binding=1 phase=7 pending=0 result=pass\n",
      b.values[1],b.values[2],b.values[5],b.values[6],b.save_clock,clock);
    if(const char *save=recomp_env("BROWSER_FRONTIER_HERO_HOME_SAVE_TEST")){
      if(std::strcmp(save,"v1")||b.save_serial!=2)std::abort();
      saving=true;const bool written=checkpoint(c,region(),rd32(0x0071c68c));saving=false;
      std::string marker;std::array<std::string,2> paths;if(!written||!checkpoint_store(c,region(),marker,paths))std::abort();
      const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();uint32_t seed=0,game_seed=0,saved_clock=0;
      if(saved.status!=CheckpointStore::Status::valid||!session_saved_rng(paths[saved.slot],seed,game_seed,&saved_clock)||saved_clock!=clock||rd32(state)!=7||rd32(state+4))std::abort();
      b.save_serial=3;b.save_clock=clock;
      std::fprintf(stderr,"[frontier] Hero home save held receipt=majesty-hero-travel-ready-v1|3|0_0|%u|%u|%u|%u|%llu|%s phase=7 pending=0 ordinary-ticks=0\n",
        clock,b.values[1],b.values[2],b.values[6],(unsigned long long)saved.size,saved.digest.c_str());
    }
    return true;
  }
  if(clock<b.save_clock+300)return false;
  if(clock!=b.save_clock+300||rd32(state)!=3||rd32(state+4)||region_session().completed_ticks!=6)std::abort();
  X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
  if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();pausing=true;return true;
}
#endif
// Qualification observes two original gameplay ticks after the shared resume
// gate. It uses the ordinary pause and writer; it never imports or publishes.
#ifndef __EMSCRIPTEN__
bool selected_hero_generated_resume_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_GENERATED_ARRIVAL_TEST");if(!flag)return false;
  auto &b=selected_hero_binding();if(!b.generated_halo||b.closed||b.retired)return false;
  const uint32_t count=selected_hero_generation_test_count();
  static bool pausing=false,held=false;static std::string observed;
  if(observed==b.key&&held)return false; // The first world may continue to its next crossing.
  if(observed!=b.key){observed=b.key;pausing=held=false;}
  if(std::strcmp(flag,"v1")||!b.save_serial||b.save_serial>count||
     b.key!=selected_hero_generation_test_region(b.save_serial)||b.save_clock<100||b.save_clock>3300||b.save_clock%50)std::abort();
  const uint32_t state=rd32(0x006d7670),clock=rd32(0x0071c6a8);
  if(held)return false; // Original paused frame body keeps input/exit responsive.
  if(pausing){
    if(rd32(state)==3&&rd32(state+4)==7)return true;
    auto binding=b.values;binding[0]=clock;
    if(rd32(state)!=7||rd32(state+4)||clock!=b.save_clock+100||region_session().completed_ticks!=b.save_clock/50+2||
       !majesty_browser_streaming_active_hero_binding(c,binding.data())||
       !joint_fixture_checkpoint(c,"Hero_Generated_Neighbor_Played","BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",b.key.c_str(),"actor-arrival-fixture-hero-binding-"))std::abort();
    held=true;
    std::fprintf(stderr,"[frontier] Hero generated neighbor gameplay held serial=%u region=%s unit=%u agent=%u home=0/%u from-clock=%u clock=%u ticks=2 original-gameplay=1 fresh-proxy-binding=1 phase=7 pending=0 result=pass\n",
        b.save_serial,b.key.c_str(),b.values[1],b.values[2],b.values[6],b.save_clock,clock);
    if(b.save_serial<count){
      X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,3u);
      if(rd32(state)!=7||rd32(state+4)!=3||rd32(0x0071c6a8)!=clock)std::abort();
      std::fprintf(stderr,"[frontier] Hero generated exploration continued serial=%u region=%s clock=%u direction=%s original-resume=1 fresh-proxy-binding=1 phase=7 pending=3\n",
          b.save_serial,b.key.c_str(),clock,b.save_serial==1?"north":"west");
    }
    return true;
  }
  if(clock<b.save_clock+100)return false;
  if(clock!=b.save_clock+100||rd32(state)!=3||rd32(state+4))std::abort();
  X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
  if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();pausing=true;return true;
}
#endif
bool selected_hero_travel_before_tick(X86 *c) {
  auto &travel=selected_hero_travel;if(travel.stage==SelectedHeroTravel::Stage::idle){
#ifndef __EMSCRIPTEN__
    if(selected_hero_generated_resume_test(c))return true;
    if(selected_hero_repeat_resume_test(c))return true;
    if(selected_hero_repeat_home_resume_test(c))return true;
    return selected_hero_home_resume_test(c);
#else
    return false;
#endif
  }
  // A failed request keeps its captured recovery selected. It may have failed
  // before unload, so the target clock/region are not valid assertions here.
  if(travel.stage==SelectedHeroTravel::Stage::failed){os_sleep_us(5000);return true;}
  const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c);auto &s=region_session();
  if(!gm_valid(state,0x50)||mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return true;
  if(travel.stage==SelectedHeroTravel::Stage::loading){
    if(rd32(state)!=3||rd32(state+4))return true;
    if(!gm_valid(world,0x14)||region().key!=travel.target||s.stage!=RegionSession::Stage::idle||s.saved_world||
       s.release_hook||s.release_tracking||rd32(0x0071c6a8)!=travel.clock)std::abort();
    if(!travel.generating){
      std::string marker;std::array<std::string,2> paths;
      if(!checkpoint_store(c,region(),marker,paths))std::abort();
      const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();
      if(saved.status!=CheckpointStore::Status::valid||saved.digest!=travel.digest)std::abort();
    }
    session_ui_restore.end();
    if(s.pending_seed||s.pending_game_seed){if(!session_restore_empty_profile_name(c)||!session_restore_rng(c,s.pending_seed,s.pending_game_seed))std::abort();s.pending_seed=s.pending_game_seed=0;}
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
    if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=travel.clock)std::abort();travel.stage=SelectedHeroTravel::Stage::pausing;
    return true;
  }
  if(travel.stage==SelectedHeroTravel::Stage::resuming){
    if(rd32(state)==7&&rd32(state+4)==3)return true;
    auto &b=selected_hero_binding();auto binding=b.values;binding[0]=travel.clock;binding[1]=travel.aliases[0];binding[2]=travel.aliases[4];binding[5]=travel.home_unit;binding[6]=travel.home_agent;
    if(rd32(state)!=3||rd32(state+4)||rd32(0x0071c6a8)!=travel.clock||region().key!=travel.target||
       !majesty_browser_streaming_active_hero_binding(c,binding.data()))std::abort();
    b.values=binding;b.key=travel.target;b.digest=travel.active_digest;b.owner_manifest=travel.published_manifest;b.proxy_home=travel.home_unit==0;b.generated_halo=travel.generating;b.closed=false;b.retired=false;b.retired_checkpoint.clear();
    b.save_clock=travel.clock;b.save_stage=SelectedHeroBinding::SaveStage::idle;b.before_valid=false;b.motion_announced=false;b.motion_samples=0;b.navigation_deferred=0;
    std::fprintf(stderr,"[frontier] Hero travel resumed serial=%u region=%s unit=%u agent=%u home=%s/%u/%u clock=%u manifest-sha256=%s original-resume=1 fresh-binding=1 phase=3 pending=0\n",
        b.save_serial,b.key.c_str(),b.values[1],b.values[2],b.proxy_home?"proxy":"native",b.values[5],b.values[6],travel.clock,travel.published_head.c_str());
    travel=SelectedHeroTravel{};return true; // Rebind before the first original gameplay tick.
  }
  if(travel.stage==SelectedHeroTravel::Stage::initializing){
    // Generation owns only this fresh target. Give the original scheduler a
    // nonzero clock before preparing any imported hero scheduling context.
    // These are ordinary world ticks, with no guest clock assignment.
    if(rd32(state)==7&&rd32(state+4)==3)return true;
    const auto &b=selected_hero_binding();const auto journal=selected_hero_journal();
    if(!travel.generating||travel.initialized||!b.closed||!b.retired||journal.empty()||
       selected_hero_small_text(journal+"/Frontier_Hero_Route.checkpoint",512)!=b.owner_manifest||
       rd32(state)!=3||rd32(state+4)||region().key!=travel.target||rd32(0x0071c6a8)!=travel.clock||
       s.stage!=RegionSession::Stage::idle||s.release_hook||s.release_tracking||s.saved_world||
       travel.initialization_target_ticks<2||travel.initialization_target_ticks>66||
       travel.initialization_ticks>=travel.initialization_target_ticks)std::abort();
    const uint32_t before=travel.clock;
    fn_00417730(c);
    if(rd32(state)!=3||rd32(state+4)||rd32(0x0071c68c)!=world||rd32(0x0071c6a8)!=before+50)std::abort();
    travel.clock=rd32(0x0071c6a8);++travel.initialization_ticks;
#ifndef __EMSCRIPTEN__
    ++s.completed_ticks;
#endif
    if(travel.initialization_ticks==travel.initialization_target_ticks){
      X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
      if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=travel.clock)std::abort();
      travel.initialized=true;travel.stage=SelectedHeroTravel::Stage::pausing;
    }
    return true;
  }
  if(rd32(state)==3&&rd32(state+4)==7)return true;
  if(rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=travel.clock||region().key!=travel.target)std::abort();
  if(travel.stage==SelectedHeroTravel::Stage::pausing){
    if(travel.generating){
      const auto &b=selected_hero_binding();const uint32_t context=rd32(world+4);
      if(travel.initialization_target_ticks<2||travel.initialization_target_ticks>66||
         travel.clock!=(travel.initialized?travel.initialization_target_ticks*50:0u)||
         travel.initialization_ticks!=(travel.initialized?travel.initialization_target_ticks:0u)||
         !b.closed||!b.retired||s.pending_seed||s.pending_game_seed||s.saved_world||s.release_hook||s.release_tracking||
         !gm_valid(context,0x84))std::abort();
      const uint32_t terrain=rd32(context+0x80);
      if(!gm_valid(terrain,0x54)||rd32(terrain)!=0x0068b660u||rd32(terrain+0x30)!=128||rd32(terrain+0x34)!=128||
         rd32(terrain+0x38)!=129||rd32(terrain+0x3c)!=129||connected_boundary_policy.terrain!=terrain)std::abort();
      const uint32_t vertices=rd32(terrain+0x4c);if(!gm_valid(vertices,129u*129u*24u))std::abort();
      uint32_t shared=0;
      for(uint32_t y=0;y<=128;++y)for(uint32_t x=0;x<=128;++x)if(connected_shared_vertex(x,y)){
        if(rd32(vertices+(y*129+x)*24)!=uint32_t(connected_height(connected_origin(region().x)+x,connected_origin(region().y)+y)))std::abort();++shared;}
      if(shared!=2480)std::abort();
      saving=true;const bool wrote=checkpoint(c,region(),world);saving=false;
      std::string marker;std::array<std::string,2> paths;
      if(!wrote||!checkpoint_store(c,region(),marker,paths))std::abort();
      const auto saved=CheckpointStore(marker,paths,std::string(content_identity())).read();uint32_t seed=0,game_seed=0,clock=0;
      if(saved.status!=CheckpointStore::Status::valid||!session_saved_rng(paths[saved.slot],seed,game_seed,&clock)||clock!=travel.clock||
         rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=travel.clock)std::abort();
      travel.digest=saved.digest;travel.stage=SelectedHeroTravel::Stage::generated;travel.poll_ns=os_monotonic_ns();
      if(travel.initialized){
        std::fprintf(stderr,"[frontier] Hero generation initialized serial=%u source=%s target=%s clock=%u slot=%d bytes=%llu sha256=%s layout=halo-v1 shared-vertices=2480 original-generator=1 original-writer=1 source-roots-cleared=1 phase=7 pending=0 original-ticks=%u hero-imported=0 owner-published=0\n",
            b.save_serial,b.key.c_str(),travel.target.c_str(),clock,saved.slot,(unsigned long long)saved.size,saved.digest.c_str(),travel.initialization_ticks);
      }else{
        std::fprintf(stderr,"[frontier] Hero generation held serial=%u source=%s target=%s clock=0 slot=%d bytes=%llu sha256=%s layout=halo-v1 shared-vertices=2480 original-generator=1 original-writer=1 source-roots-cleared=1 phase=7 pending=0 ordinary-ticks=0 hero-imported=0 owner-published=0\n",
            b.save_serial,b.key.c_str(),travel.target.c_str(),saved.slot,(unsigned long long)saved.size,saved.digest.c_str());
        const auto journal=selected_hero_journal();
        if(journal.empty()||selected_hero_small_text(journal+"/Frontier_Hero_Route.checkpoint",512)!=b.owner_manifest)std::abort();
        X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,3u);
        if(rd32(state)!=7||rd32(state+4)!=3||rd32(0x0071c6a8))std::abort();
        travel.stage=SelectedHeroTravel::Stage::initializing;
      }
      return true;
    }
    travel.stage=SelectedHeroTravel::Stage::held;
#ifndef __EMSCRIPTEN__
    const char *flag=recomp_env("BROWSER_FRONTIER_HERO_PAGE_TEST");if(flag){
      const char *label=selected_hero_binding().save_serial==6?"Hero_Repeat_Return_Home_Held":selected_hero_binding().save_serial==4?"Hero_Repeat_Target_Held":selected_hero_binding().proxy_home?"Hero_Travel_Home_Held":"Hero_Travel_Target_Held";
      const std::string snapshot=recomp_env("BROWSER_FRONTIER_HERO_REMOTE_BACKTRACK_CROSSINGS")?
          "Hero_Travel_Home_Held_"+std::to_string(selected_hero_binding().save_serial):label;
      if(std::strcmp(flag,"v1")||!joint_fixture_checkpoint(c,snapshot.c_str(),"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",travel.target.c_str(),"actor-arrival-fixture-hero-binding-"))std::abort();}
#endif
    std::fprintf(stderr,"[frontier] Hero travel target held serial=%llu region=%s clock=%u original-load=1 ordinary-ticks=0 source-roots-cleared=1 phase=7 pending=0 owner-published=0 result=pass\n",(unsigned long long)s.serial,travel.target.c_str(),travel.clock);
#ifndef __EMSCRIPTEN__
    selected_hero_join_test(c);
#endif
  }
  // The new checkpoint is input to destination-home/package preparation.
  // Keep both identity and clock stable until that distinct admission exists.
  if(travel.stage==SelectedHeroTravel::Stage::generated){
    if(travel.initialized){
      const auto now=os_monotonic_ns();
      if(now-travel.input_poll_ns>=100000000u){
        travel.input_poll_ns=now;
        if(selected_hero_attach_native_home_input(c))return true;
      }
    }
#ifndef __EMSCRIPTEN__
    if(recomp_env("BROWSER_FRONTIER_HERO_GENERATION_TEST")&&travel.generation_checks<UINT32_MAX){
      ++travel.generation_checks;
      if(os_monotonic_ns()-travel.poll_ns>=1000000000u&&travel.generation_checks>=8){
        std::fprintf(stderr,"[frontier] Hero generation stable serial=%u target=%s clock=%u observed-boundaries=%u elapsed-ns=%llu phase=7 pending=0 ordinary-ticks=0\n",
            selected_hero_binding().save_serial,travel.target.c_str(),travel.clock,travel.generation_checks,(unsigned long long)(os_monotonic_ns()-travel.poll_ns));
        travel.generation_checks=UINT32_MAX;
      }
    }
#endif
    // A held kingdom still needs original paused input, frame pacing and host
    // message processing. Skipping the complete body spins the dispatcher and
    // prevents normal window-close/test termination. Phase7 excludes world
    // simulation; any requested phase change closes this generation capability
    // before another original gameplay tick can run.
    fn_00417730(c);
    if(rd32(state)==7&&!rd32(state+4)){
      if(rd32(0x0071c6a8)!=travel.clock||rd32(0x0071c68c)!=world)std::abort();
    }else{
      travel.stage=SelectedHeroTravel::Stage::failed;
      std::fprintf(stderr,"[frontier] Hero generation pause ended serial=%u target=%s phase=%u pending=%u captured-recovery-preserved=1 gameplay-blocked=1\n",
          selected_hero_binding().save_serial,travel.target.c_str(),rd32(state),rd32(state+4));
    }
    return true;
  }
  if(travel.stage==SelectedHeroTravel::Stage::held){
#ifndef __EMSCRIPTEN__
    // The private driver may intentionally stop after import alone.
    if(!recomp_env("BROWSER_FRONTIER_HERO_JOIN_TEST"))
#endif
    {
      const auto now=os_monotonic_ns();if(now-travel.poll_ns<100000000u)return false;travel.poll_ns=now;
      selected_hero_attach_native_home_input(c);
    }
  }
  if(travel.stage==SelectedHeroTravel::Stage::ready){
    const auto now=os_monotonic_ns();if(now-travel.poll_ns<100000000u)return false;travel.poll_ns=now;
    const char *profile=recomp_env("PROFILE_DIR");if(!profile)return false;
    const std::string ack=selected_hero_small_text(std::string(profile)+"/Frontier_Hero_Travel_Published.txt",512);
    if(ack.empty())return false;
    const std::string prefix="majesty-hero-travel-published-v1"+travel.ready_packet.substr(std::strlen("majesty-hero-travel-ready-v1"))+"|";
    bool accepted=ack.size()==prefix.size()+65&&ack.starts_with(prefix)&&ack.back()=='\n';
    const std::string head=accepted?ack.substr(prefix.size(),64):std::string{};
    std::string marker;std::array<std::string,2> paths;
    if(accepted){accepted=TransferStore::digest(head)&&checkpoint_store(c,region(),marker,paths);
      if(accepted){const auto record=CheckpointStore(marker,paths,std::string(content_identity())).read();
        accepted=record.status==CheckpointStore::Status::valid&&record.size==travel.active_size&&record.digest==travel.active_digest&&
            selected_hero_publication_selected(head);}}
    if(!accepted){if(ack!=travel.last_refused){travel.last_refused=ack;
      std::fprintf(stderr,"[frontier] Hero travel publication refused serial=%u region=%s clock=%u phase=7 pending=0\n",selected_hero_binding().save_serial,travel.target.c_str(),travel.clock);}
      return false;}
    auto binding=selected_hero_binding().values;binding[0]=travel.clock;binding[1]=travel.aliases[0];binding[2]=travel.aliases[4];binding[5]=travel.home_unit;binding[6]=travel.home_agent;
    if(!majesty_browser_streaming_active_hero_binding(c,binding.data()))std::abort();
#ifndef __EMSCRIPTEN__
    const char *test=recomp_env("BROWSER_FRONTIER_HERO_PUBLICATION_TEST");if(test&&!std::strcmp(test,"v1")){
      const bool repeat=selected_hero_binding().save_serial==4;
      const std::string snapshot=recomp_env("BROWSER_FRONTIER_HERO_REMOTE_BACKTRACK_CROSSINGS")?
          "Hero_Travel_Target_Published_"+std::to_string(selected_hero_binding().save_serial):
          travel.home_unit?(selected_hero_binding().save_serial==6?"Hero_Repeat_Return_Home_Published":"Hero_Return_Home_Published"):repeat?"Hero_Repeat_Target_Published":"Hero_Travel_Target_Published";
      if(!joint_fixture_checkpoint(c,snapshot.c_str(),"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",travel.target.c_str(),"actor-arrival-fixture-hero-binding-"))std::abort();
      if(!travel.home_unit&&!recomp_env("BROWSER_FRONTIER_HERO_REMOTE_BACKTRACK_TEST")){
      int32_t pose[3]{};uint32_t stats[4]{};
      const char *fresh=recomp_env("BROWSER_FRONTIER_HERO_REPEAT_GENERATION_TEST");
      const bool north=fresh&&!std::strcmp(fresh,"v1")&&selected_hero_binding().save_serial==1;
      const bool across=fresh&&!std::strcmp(fresh,"v1")&&selected_hero_binding().save_serial>=3;
      if(!majesty_browser_streaming_active_hero_pose(c,pose,stats)||
         !majesty_browser_streaming_route_hero_home(c,north?128u:32u,north?32u:across?2048u:uint32_t(pose[1])/2048)||
         !joint_fixture_checkpoint(c,repeat?"Hero_Repeat_Target_Routed":"Hero_Travel_Target_Routed","BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",travel.target.c_str(),"actor-arrival-fixture-hero-binding-"))std::abort();
      }
    }
#endif
    travel.published_head=head;X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,3u);
    if(rd32(state)!=7||rd32(state+4)!=3||rd32(0x0071c6a8)!=travel.clock)std::abort();travel.stage=SelectedHeroTravel::Stage::resuming;
    std::fprintf(stderr,"[frontier] Hero travel publication accepted serial=%u region=%s clock=%u manifest-sha256=%s both-worlds-verified=1 phase=7 pending=3\n",
        selected_hero_binding().save_serial,travel.target.c_str(),travel.clock,head.c_str());return true;
  }
  return false; // Allow original paused UI input without a simulation update.
}
#ifndef __EMSCRIPTEN__
bool selected_hero_page_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_PAGE_TEST");if(!flag)return false;
  const char *digest=recomp_env("BROWSER_FRONTIER_HERO_PAGE_DIGEST"),*raw=recomp_env("BROWSER_FRONTIER_HERO_PAGE_CLOCK");uint32_t clock=0;
  if(std::strcmp(flag,"v1")||!raw)std::abort();const size_t n=std::strlen(raw);const auto parsed=std::from_chars(raw,raw+n,clock);
  if(parsed.ec!=std::errc{}||parsed.ptr!=raw+n||std::to_string(clock)!=raw||!selected_hero_begin_travel(c,3,digest,clock))std::abort();
  return true;
}
#endif

// Complete a fresh private import through the original full-world reader,
// without advancing simulation or retaining actor pointers across disposal.
bool session_home_import_reload(X86 *c) {
#ifdef __EMSCRIPTEN__
  return false;
#else
  const char *flag = recomp_env("BROWSER_STREAMING_SESSION_HOME_IMPORT_FIXTURE");
  if (!flag || std::strcmp(flag, "v1")) return false;
  auto &s = region_session();
  if (!session_enabled() || s.root.find("/actor-arrival-fixture-session-home-") == s.root.npos ||
      !s.root.ends_with("/actor-arrival-fixture-outdoor-family-snapshot-bridge/native-world-home")) std::abort();
  if (region().key != "0_0" || !announced || s.stage != RegionSession::Stage::idle) return false;
  if (s.home_import_phase == 2) return false;
  if (s.home_import_phase == 1) {
    if (!majesty_browser_streaming_session_home_import_ready(c, true)) std::abort();
    s.home_import_phase = 2; return false;
  }
  if (!majesty_browser_streaming_session_home_import_ready(c, false)) return false;
  const uint32_t world = rd32(0x0071c68c), state = rd32(0x006d7670);
  if (s.serial != 1 || !gm_valid(world, 0x14) || !gm_valid(state, 0x50) || rd32(state) != 3 ||
      rd32(state + 4) || rd32(0x0071c6a8) != 57650 || mods_hook_depth() || !sched_holds_baton()) std::abort();
  const std::string prepared = native_checkpoint_path(c, "Family_Return_Ready"); OsStat st{};
  const std::string digest = loader_hash_file(prepared.c_str());
  if (os_lstat(prepared.c_str(), &st) || !st.is_regular || st.is_symlink || !st.size ||
      st.size > 64 * 1024 * 1024 || digest.size() != 64) std::abort();
  std::string marker; std::array<std::string, 2> paths; session_paths(region(), marker, paths);
  const CheckpointStore store(marker, paths, std::string(content_identity()));
  if (!store.commit([&](int slot) { return TransferStore::copy(prepared, paths[slot], st.size, digest); })) std::abort();
  s.home_import_source_clock = s.saved_clock;
  s.saved_world = world; s.saved_clock = 57650; s.previous = region(); s.target = region();
  s.home_import_phase = 1; session_release_begin(world);
  X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = state; guest_call(&extra, 0x00416590);
  const uint32_t settings = rd32(0x006d87a0);
  if (rd32(state) != 4 || rd32(state + 4) != 4 || rd32(0x0071c68c) != world || rd32(0x0071c6a8) ||
      !gm_valid(settings, 0x70) || rd32(settings + 0x6c)) std::abort();
  s.stage = RegionSession::Stage::leaving;
  std::fprintf(stderr, "[frontier] Session home import reload serial=1 region=0_0 saved-clock=57650 prepared-hash=%s source-clock=%u ordinary-ticks=0\n",
      digest.c_str(), s.home_import_source_clock);
  return true;
#endif
}

// Native qualification bridge for durable ownership before the first restored
// gameplay tick. The JS owner store is the writer; the engine acknowledges only
// the exact paused request and selected files. No player/browser profile gate
// enables this fixture, and it never writes gameplay phase or guest pointers.
#ifndef __EMSCRIPTEN__
struct SessionOwnerPause {
  bool held = false, resumed = false;
  uint32_t world = 0, state = 0, clock = 0;
  uint64_t poll_ns = 0, skipped = 0;
  std::string directory, request_digest, previous_manifest, identity_digest;
  std::string home_digest, source_digest, last_refused;
  uint64_t home_size = 0, source_size = 0;
};
SessionOwnerPause &session_owner_pause() { static SessionOwnerPause p; return p; }
std::string owner_small_file(const std::string &name, size_t limit = 4096) {
  OsStat st{};
  if (os_lstat(name.c_str(), &st) || !st.is_regular || st.is_symlink || !st.size || st.size > limit) return {};
  FILE *f = std::fopen(name.c_str(), "rb"); if (!f) return {};
  std::string bytes(size_t(st.size), '\0'); const size_t n = std::fread(bytes.data(), 1, bytes.size(), f);
  const bool good = n == bytes.size() && !std::ferror(f); const bool closed = !std::fclose(f);
  return good && closed ? bytes : std::string{};
}
bool owner_digest(std::string_view v) {
  return v.size() == 64 && std::all_of(v.begin(), v.end(), [](char c) {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
  });
}
bool owner_lines(std::string_view bytes, std::array<std::string, 6> &lines) {
  lines.back().clear();
  for (size_t i = 0; i + 1 < lines.size(); ++i) {
    auto &line = lines[i];
    const size_t end = bytes.find('\n'); if (end == bytes.npos) return false;
    line = bytes.substr(0, end); bytes.remove_prefix(end + 1);
  }
  return bytes.empty();
}
bool owner_atomic_file(const std::string &name, const std::string &text) {
  const std::string temp = name + ".tmp";
  const int f = os_fd_open(temp.c_str(), OS_O_WRONLY | OS_O_CREAT | OS_O_TRUNC); if (f < 0) return false;
  size_t at = 0; while (at < text.size()) {
    const int64_t n = os_fd_write(f, text.data() + at, text.size() - at); if (n <= 0) break; at += size_t(n);
  }
  const bool good = at == text.size() && !os_fd_fsync(f); const bool closed = !os_fd_close(f);
  if (good && closed && !os_rename(temp.c_str(), name.c_str())) return true;
  os_unlink(temp.c_str()); return false;
}
bool session_owner_hold(X86 *c) {
  const char *flag = recomp_env("BROWSER_FRONTIER_OWNER_PAUSE_FIXTURE");
  if (!flag || std::strcmp(flag, "v1")) return false;
  auto &p = session_owner_pause(); if (p.resumed) return false;
  auto &s = region_session();
  if (!session_enabled() || s.root.find("/actor-arrival-fixture-session-home-") == std::string::npos ||
      !s.root.ends_with("/actor-arrival-fixture-outdoor-family-snapshot-bridge/native-world-home")) std::abort();
  if (!p.held) {
    if (s.serial != 1 || region().key != "0_0" || !announced || s.arrival_pending ||
        s.pending_seed || s.pending_game_seed) return false;
    const char *directory = recomp_env("BROWSER_FRONTIER_OWNER_REVISION_FIXTURE_DIR"),
               *nonce = recomp_env("BROWSER_FRONTIER_OWNER_PAUSE_NONCE");
    p.directory = directory ? directory : "";
    const size_t slash = p.directory.rfind('/'); OsStat st{};
    if (!nonce || !owner_digest(nonce) || slash == p.directory.npos ||
        !p.directory.substr(slash + 1).starts_with("actor-arrival-fixture-entity-revision-live-session-") ||
        p.directory.find("/../") != p.directory.npos || os_lstat(p.directory.c_str(), &st) ||
        !st.is_dir || st.is_symlink) std::abort();
    const auto previous = owner_small_file(p.directory + "/Frontier_Revision.checkpoint", 256);
    std::array<std::string, 6> lines;
    if (!owner_lines(previous, lines) || lines[0] != "majesty-entity-revision-v1" || lines[1] != "1" ||
        lines[2] != "5" || !owner_digest(lines[3]) || !owner_digest(lines[4]) || !lines[5].empty()) std::abort();
    p.identity_digest = lines[3]; p.previous_manifest = loader_hash_file((p.directory + "/Frontier_Revision.checkpoint").c_str());
    if (loader_hash_file((p.directory + "/Frontier_Revision_Identity.json").c_str()) != p.identity_digest) std::abort();
    p.world = rd32(0x0071c68c); p.state = rd32(0x006d7670); p.clock = rd32(0x0071c6a8);
    if (p.clock != 57650 || !gm_valid(p.state, 0x50) || rd32(p.state) != 3 || rd32(p.state + 4) ||
        !gm_valid(p.world, 0x14) || !rd32(p.world + 4) || mods_hook_depth() || !sched_holds_baton()) std::abort();
    saving = true; const bool saved = checkpoint(c, region(), p.world); saving = false; if (!saved) std::abort();
    std::string manifest; std::array<std::string, 2> paths;
    session_paths(region(), manifest, paths); const auto home = CheckpointStore(manifest, paths, std::string(content_identity())).read();
    Region source_region = s.previous;
    if (s.home_import_phase == 2) { source_region.x=1;source_region.y=0;source_region.key="1_0";source_region.checkpoint="Frontier_1_0"; }
    const uint32_t source_clock = s.home_import_phase == 2 ? s.home_import_source_clock : s.saved_clock;
    session_paths(source_region, manifest, paths); const auto source = CheckpointStore(manifest, paths, std::string(content_identity())).read();
    if (home.status != CheckpointStore::Status::valid || source.status != CheckpointStore::Status::valid) std::abort();
    p.home_digest = home.digest; p.home_size = home.size; p.source_digest = source.digest; p.source_size = source.size;
    const std::string request = std::string("native-owner-pause-v1\n") + nonce + "\n1\n0_0\n" + std::to_string(p.clock) + "\n" +
        p.home_digest + "\n" + std::to_string(source_clock) + "\n" + p.source_digest + "\n" +
        loader_hash_file((p.directory + "/Frontier_Revision.checkpoint").c_str()) + "\n530\n31\n";
    const std::string request_path = s.root + "/Owner_Pause.txt";
    if (!owner_atomic_file(request_path, request)) std::abort(); p.request_digest = loader_hash_file(request_path.c_str());
    p.held = true;
    std::fprintf(stderr, "[frontier] Owner paused serial=1 region=0_0 clock=%u home-hash=%s source-clock=%u source-hash=%s request-hash=%s\n",
        p.clock, p.home_digest.c_str(), source_clock, p.source_digest.c_str(), p.request_digest.c_str());
  }
  if (rd32(0x0071c68c) != p.world || rd32(0x006d7670) != p.state || rd32(0x0071c6a8) != p.clock ||
      rd32(p.state) != 3 || rd32(p.state + 4) || s.serial != 1) std::abort();
  ++p.skipped; const auto now = os_monotonic_ns();
  if (now - p.poll_ns >= 100000000u) {
    p.poll_ns = now;
    const std::string ack = owner_small_file(s.root + "/Owner_Resume.txt", 512);
    std::array<std::string, 6> lines;
    bool accepted = owner_lines(ack, lines) && lines[0] == "native-owner-resume-v1" && lines[1] == p.request_digest &&
        owner_digest(lines[2]) && lines[3] == "6" && owner_digest(lines[4]) && lines[5].empty();
    if (accepted) {
      const std::string marker = owner_small_file(p.directory + "/Frontier_Revision.checkpoint", 256);
      const std::string expected = "majesty-entity-revision-v1\n0\n6\n" + p.identity_digest + "\n" + lines[4] + "\n";
      const std::string state_path = p.directory + "/Frontier_Revision_State_0.json";
      const std::string state = owner_small_file(state_path);
      const std::string worlds = "\"worlds\":[{\"size\":" + std::to_string(p.home_size) + ",\"sha256\":\"" + p.home_digest +
          "\"},{\"size\":" + std::to_string(p.source_size) + ",\"sha256\":\"" + p.source_digest + "\"}]";
      accepted = marker == expected && loader_hash_file((p.directory + "/Frontier_Revision.checkpoint").c_str()) == lines[2] &&
          loader_hash_file(state_path.c_str()) == lines[4] &&
          loader_hash_file((p.directory + "/Frontier_Revision_Identity.json").c_str()) == p.identity_digest &&
          state.find("\"previous\":\"" + p.previous_manifest + "\"") != state.npos &&
          state.find("\"kind\":\"handoff\",\"ownerSide\":0,\"visitedSides\":3,\"aliases\":[{\"unitId\":530,\"agentId\":31}") != state.npos &&
          state.find(worlds) != state.npos &&
          loader_hash_file((p.directory + "/Frontier_Revision_Source_0.GMP").c_str()) == p.home_digest &&
          loader_hash_file((p.directory + "/Frontier_Revision_Destination_0.GMP").c_str()) == p.source_digest;
    }
    if (accepted) {
      p.held = false; p.resumed = true;
      std::fprintf(stderr, "[frontier] Owner resumed serial=1 region=0_0 clock=%u revision=6 skipped=%llu request-hash=%s manifest-hash=%s\n",
          p.clock, (unsigned long long)p.skipped, p.request_digest.c_str(), lines[2].c_str());
      return false;
    }
    if (!ack.empty() && ack != p.last_refused) {
      p.last_refused = ack; std::fprintf(stderr, "[frontier] Owner acknowledgement refused serial=1 region=0_0 clock=%u\n", p.clock);
    }
  }
  os_sleep_us(5000); return true;
}
#else
bool session_owner_hold(X86 *) { return false; }
#endif

} // namespace

// Two immutable original full-world saves for the isolated joint-actor test.
// Reuse the original named writer and autosave renderer lifecycle; this does
// not select or replace a player's active Frontier checkpoint.
static bool joint_fixture_checkpoint(X86 *c, const std::string &label, const char *fixture_flag,
                                     const char *key = "0_0", const char *prefix = "actor-arrival-fixture-") {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env(fixture_flag);
    const char *profile = recomp_env("PROFILE_DIR");
    std::string_view path(profile ? profile : "");
    const std::string suffix = std::string("/frontier_") + key;
    if (!path.ends_with(suffix))
        return false;
    path.remove_suffix(suffix.size());
    const size_t slash = path.rfind('/');
    const auto owned = path.substr(slash == path.npos ? 0 : slash + 1);
    const Region &r = region();
    const uint32_t world = rd32(0x0071c68c), manager = rd32(0x006d8568);
    const char *expansion = recomp_env("BROWSER_STREAMING_REGION_EXPANSION_FIXTURE");
    const bool expanding_snapshot = expansion && !std::strcmp(expansion, "v1") &&
        !std::strcmp(key, "0_0") &&
        ((label == "Joint_Departed_Reload" && !std::strcmp(fixture_flag, "BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE")) ||
         (label == "Joint_Evolved" && !std::strcmp(fixture_flag, "BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE")));
    const char *family_session = recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_SESSION_FIXTURE");
    // The combined native test uses the session's named-world root inside an
    // owned fixture. Keep this exception specific to its receiving and prepared home snapshots;
    // ordinary named worlds and every other checkpoint fixture retain their
    // original ownership gate.
    const char *home_import = recomp_env("BROWSER_STREAMING_SESSION_HOME_IMPORT_FIXTURE");
    const bool home_snapshot = home_import && !std::strcmp(home_import,"v1") &&
        !std::strcmp(fixture_flag,"BROWSER_STREAMING_OUTDOOR_FAMILY_RETURN_FIXTURE") &&
        !std::strcmp(prefix,"actor-arrival-fixture-outdoor-family-return-") && !std::strcmp(key,"0_0") &&
        (label=="Family_Return_Departed" || label=="Family_Return_Ready");
    const bool remote_snapshot = !std::strcmp(fixture_flag,"BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_FIXTURE") &&
        !std::strcmp(prefix,"actor-arrival-fixture-outdoor-family-snapshot-") && !std::strcmp(key,"1_0");
    const bool owned_family_session = family_session && !std::strcmp(family_session, "v1") &&
        (remote_snapshot || home_snapshot) && owned == "native-world-home" &&
        path.find("/actor-arrival-fixture-session-home-") != path.npos &&
        path.ends_with("/actor-arrival-fixture-outdoor-family-snapshot-bridge/native-world-home") &&
        session_enabled() && region_session().root == path &&
        region_session().stage == RegionSession::Stage::idle;
    const bool owned_halo_session = halo_session_fixture() && halo_session_root_valid() &&
        !std::strcmp(fixture_flag,"BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT") &&
        !std::strcmp(prefix,"actor-arrival-fixture-halo-world-session-") &&
        owned == "native-world-halo" && path == halo_session_binding.root &&
        session_enabled() && region_session().root == path &&
        region_session().stage == RegionSession::Stage::idle && region_session().serial <= 64 &&
        (label == "Halo_Session_Reloaded_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Generated_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Departed_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Actor_Crossed_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Actor_Held_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Actor_Retired_" + std::to_string(region_session().serial) ||
         (recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_ARRIVAL") && region_session().serial == 1 &&
          (label == "Halo_Session_Saved_Arrival_Before_1" || label == "Halo_Session_Saved_Arrival_Imported_1")) ||
         (recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_ACTIVATE") && region_session().serial == 1 &&
          (label == "Halo_Session_Saved_Activation_Ready_1" || label == "Halo_Session_Saved_Route_Ready_1" || label == "Halo_Session_Saved_Continuation_Crossed_1")) ||
         (recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_RETURN") &&
          ((region_session().serial == 1 && label == "Halo_Session_Saved_Return_Retired_1") ||
           (region_session().serial == 2 && label == "Halo_Session_Return_Home_Held_2"))) ||
         (recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_HOME_ARRIVAL") && region_session().serial == 2 &&
          label == "Halo_Session_Saved_Home_Imported_2") ||
         (recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_HOME_ACTIVATE") && region_session().serial == 2 &&
          (label == "Halo_Session_Saved_Home_Ready_2" || label == "Halo_Session_Saved_Home_Evolved_2")) ||
         (recomp_env("BROWSER_FRONTIER_HALO_SESSION_MOVE") && region_session().serial == 0 &&
          (label == "Halo_Session_Move_Before_0" || label == "Halo_Session_Move_Ready_0")) ||
         label == "Halo_Session_Destination_Held_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Destination_Epoch_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Proxy_Before_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Proxy_Ready_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Arrival_Before_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Arrival_Imported_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Activation_Before_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Activation_Ready_" + std::to_string(region_session().serial) ||
         label == "Halo_Session_Activation_Evolved_" + std::to_string(region_session().serial));
    if (!flag || std::strcmp(flag, "1") || (!owned.starts_with(prefix) && !owned_family_session && !owned_halo_session) ||
        owned.size() > 80 || !r.enabled || (r.key != key && !expanding_snapshot) || mods_hook_depth() ||
        !sched_holds_baton() || !gm_valid(world, 0x14) || !rd32(world + 4) ||
        !gm_valid(manager, 0x21c) || rd32(manager + 0x218) == 2)
        return false;
    const auto filename = native_checkpoint_path(c, label);
    OsStat stat{};
    if (filename.empty() || os_lstat(filename.c_str(), &stat) == 0)
        return false;
    X86 extra = *c;
    const uint32_t renderer = guest_call(&extra, 0x004401c0);
    if (!gm_valid(renderer, 4) || !gm_valid(rd32(renderer), 0x54))
        return false;
    const uint32_t table = rd32(renderer);
    extra = *c;
    extra.r[R_ECX] = renderer;
    const uint32_t previous = guest_call(&extra, rd32(table + 0x30));
    extra = *c;
    extra.r[R_ECX] = renderer;
    guest_call(&extra, rd32(table + 0x44));
    const bool saved = write_checkpoint(c, label, world);
    extra = *c;
    extra.r[R_ECX] = renderer;
    guest_call(&extra, rd32(table + 0x50), previous, 1u);
    win32_invalidate_dir_cache();
    return saved && os_lstat(filename.c_str(), &stat) == 0 && stat.is_regular && stat.size > 0 &&
           stat.size <= 64 * 1024 * 1024;
#endif
}

namespace {
bool halo_session_departure_checkpoint(X86 *c) {
  return joint_fixture_checkpoint(c,"Halo_Session_Departed_"+std::to_string(region_session().serial),
      "BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",region().key.c_str(),"actor-arrival-fixture-halo-world-session-");
}
}

extern "C" bool majesty_browser_frontier_joint_checkpoint(X86 *c, bool populated) {
    return joint_fixture_checkpoint(c, populated ? "Joint_Actor_2101_0" : "Joint_Actor_Before",
                                    "BROWSER_STREAMING_JOINT_CHECKPOINT_FIXTURE");
}

#ifndef __EMSCRIPTEN__
// One actual hero, scalar tick endpoints only. A crossing save is followed by
// a whole-simulation hold at the existing complete original tick boundary.
// No hero position, path, AI state, RNG or guest pointer is retained/edited.
struct HaloHeroMotion {
    bool held=false, before_valid=false, bounty_queued=false, held_captured=false, retired=false;
    bool paged=false,destination_pause_requested=false,destination_captured=false;
    bool saved_destination=false,movement_queued=false;
    uint32_t proxy_agent_id=0;
    bool epoch_stepping=false,epoch_captured=false;
    uint32_t destination_clock=0;
    bool arrival_imported=false,activation_started=false,activation_complete=false;
    bool return_paging=false,return_home_paused=false,return_home_captured=false,return_home_imported=false,return_home_activation_started=false,return_home_activation_complete=false;
    std::array<uint32_t,5> arrival_aliases{};
    int crossing_x=0,crossing_y=0;
    std::array<int32_t,3> before{};
    uint32_t before_clock=0,held_clock=0,samples=0,changed=0;
    uint64_t held_poll_ns=0;
    bool session_actor=false;
    uint32_t unit_id=481,agent_id=17,start_clock=58850;
    uint32_t bounty_x=3072,bounty_y=32;
} halo_hero_motion;

static bool halo_session_actor_enabled() {
    static bool initialized=false,enabled=false;
    if(initialized)return enabled;initialized=true;
    const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTOR");if(!flag)return false;
    const char *binding=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTOR_BINDING");
    const char *snapshot=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT");
    const char *reward=recomp_env("BROWSER_FRONTIER_HALO_EXPLORE_BOUNTY");
    if(std::strcmp(flag,"v1")||!halo_session_fixture()||!halo_session_root_valid()||!halo_reload_enabled()||
        !session_enabled()||region().key!="0_0"||region_session().serial||!snapshot||std::strcmp(snapshot,"1")||
        !reward||std::strcmp(reward,"1000")||recomp_env("BROWSER_FRONTIER_HALO_OBSERVE")||
        recomp_env("BROWSER_FRONTIER_HALO_SESSION_REQUEST")||!binding||!TransferStore::digest(binding))std::abort();
    const std::string name=halo_session_binding.root+"/Halo_Session_Actor.ids";
    OsStat st{};if(os_lstat(name.c_str(),&st)||!st.is_regular||st.is_symlink||st.size!=36||
        loader_hash_file_bounded(name.c_str(),36)!=binding)std::abort();
    const int fd=os_fd_open(name.c_str(),OS_O_RDONLY);if(fd<0)std::abort();
    std::array<uint32_t,9> words{};const int64_t used=os_fd_read(fd,words.data(),36);const bool closed=!os_fd_close(fd);
    if(!closed||used!=36||words[0]!=0x31415348u||words[1]!=1||!words[2]||!words[3]||!words[4]||
        words[3]>=0x7fffffffu||words[4]>=0x7fffffffu||!words[5]||!words[6]||
        words[7]<32||words[7]>4064||words[8]!=32)std::abort();
    // This first running adapter supports the selected home kingdom. It never
    // infers a current alias from the immutable origin's historical unit ID.
    auto &s=halo_hero_motion;s.session_actor=true;s.unit_id=words[3];s.agent_id=words[4];s.start_clock=words[2];
    s.bounty_x=words[7];s.bounty_y=words[8];
    if(words[5]!=469||words[6]!=7)std::abort();
    const char *saved=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_DESTINATION");
    if(saved) {
        const char *digest=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_BINDING");
        const std::string filename=halo_session_binding.root+"/Halo_Session_Saved.ids";
        if(std::strcmp(saved,"v1")||!digest||!TransferStore::digest(digest))std::abort();
        OsStat stat{};if(os_lstat(filename.c_str(),&stat)||!stat.is_regular||stat.is_symlink||stat.size!=32)std::abort();
        if(loader_hash_file_bounded(filename.c_str(),32)!=digest)std::abort();
        const int input=os_fd_open(filename.c_str(),OS_O_RDONLY);if(input<0)std::abort();
        std::array<uint32_t,8> admission{};const auto used=os_fd_read(input,admission.data(),32);const bool closed=!os_fd_close(input);
        if(!closed||used!=32||admission[0]!=0x31534448u||admission[1]!=1||admission[2]!=s.start_clock||
           admission[3]!=s.unit_id||admission[4]!=s.agent_id||!admission[5]||admission[5]%50||
           admission[6]!=34||admission[7]!=3)std::abort();
        s.saved_destination=true;s.destination_clock=admission[5];
    }
    enabled=true;
    std::fprintf(stderr,"[frontier] Halo session actor admitted unit=%u agent=%u native-home=%u/%u start-clock=%u identity-bound=1 result=pass\n",
        s.unit_id,s.agent_id,words[5],words[6],s.start_clock);
    return true;
}

static bool halo_observed_pose(X86 *c,int32_t *pose,uint32_t *cells) {
    const auto &s=halo_hero_motion;
    return s.session_actor?majesty_browser_streaming_halo_session_actor_pose(c,s.unit_id,s.agent_id,pose,cells):
        majesty_browser_streaming_halo_hero_pose(c,s.unit_id,pose,cells);
}

static bool halo_actor_checkpoint(X86 *c,bool held) {
    const auto &s=halo_hero_motion;
    return s.session_actor?joint_fixture_checkpoint(c,std::string(held?"Halo_Session_Actor_Held_":"Halo_Session_Actor_Crossed_")+std::to_string(region_session().serial),
        "BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",region().key.c_str(),"actor-arrival-fixture-halo-world-session-"):
        joint_fixture_checkpoint(c,held?"Halo_Hero_Held":"Halo_Hero_Crossed","BROWSER_FRONTIER_HALO_CROSSING_SNAPSHOT","0_0","actor-arrival-fixture-halo-world-");
}

struct HaloBountyTrace {
    struct Binding {uint32_t fn,handle=0,calls=0;};
    std::array<Binding,4> bindings{{{0x004a7960u},{0x004a7810u},{0x004a7600u},{0x005a45c0u}}};
    uint32_t hooks_before=0;
    bool active=false;
    static void observe(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *opaque) {
        auto &b=*static_cast<Binding *>(opaque);
        const uint32_t sp=cpu->esp,clock=rd32(0x0071c6a8);++b.calls;
        if(b.calls>(b.fn==0x005a45c0u?1024u:16u))std::abort();
        if(b.fn==0x005a45c0u) {
            // 00417730 initializes a new command batch in 005a4250 before
            // processing input, then sends it through 005a45c0. Enqueuing
            // before the tick targets the previous batch, which gets replaced.
            // Submit this private trial's normal UI request immediately before
            // the original send, without altering the batch or hero AI.
            if(!halo_hero_motion.bounty_queued) {
                const uint32_t manager=cpu->ecx;
                const auto &actor=halo_hero_motion;
                if(clock!=actor.start_clock+50||!gm_valid(manager,0x21c)||rd32(manager)!=0x00682bc4u||
                   rd32(manager+0x218)!=1||!gm_valid(sp,4)||rd32(sp)!=0x004179bbu)std::abort();
                const uint32_t batch=rd32(manager+0x34);
                if(!gm_valid(batch,0x1c)||rd32(batch)!=0x00682d04u)std::abort();
                const uint32_t queue=rd32(batch+8);
                if(!gm_valid(queue,0x30))std::abort();
                const uint32_t before=rd32(queue+0x2c);
                constexpr char label[]="Flag_Explore";
                const uint32_t name=heap_alloc(sizeof label);if(!name)std::abort();
                for(size_t i=0;i<sizeof label;++i)wr8(name+uint32_t(i),uint8_t(label[i]));
                const std::array<uint32_t,6> arguments={name,0u,actor.bounty_x,actor.bounty_y,1000u,1u};
                uint32_t result=0;
                if(mods_guest_call(api,0x0043ef50u,0,arguments.data(),uint32_t(arguments.size()),&result)!=POP_OK)std::abort();
                heap_free(name);halo_hero_motion.bounty_queued=true;
                if(rd32(manager+0x34)!=batch||rd32(batch+8)!=queue||rd32(queue+0x2c)!=before+1||rd32(0x0071c6a8)!=clock)std::abort();
                std::fprintf(stderr,"[frontier] Halo explore bounty queued key=0_0 point=%u,%u reward=1000 clock=%u batch-before=%u batch-after=%u original-ui-helper=0043ef50 original-message=004a7960 original-send=005a45c0 hero-ai-edited=0 result=pass\n",actor.bounty_x,actor.bounty_y,clock,before,before+1);
            }
        } else if(b.fn==0x004a7960u||b.fn==0x004a7600u) {
            if(!gm_valid(sp,40))std::abort();
            std::fprintf(stderr,"[frontier] Halo bounty call method=%08x count=%u clock=%u factory=%08x model=%08x point=%u,%u player=%u options=%u target=%u reward=%u original-call=1\n",b.fn,b.calls,clock,rd32(sp+4),rd32(sp+8),rd32(sp+16),rd32(sp+20),rd32(sp+24),rd32(sp+28),rd32(sp+32),rd32(sp+36));
        } else {
            if(!gm_valid(sp,8))std::abort();const uint32_t packet=rd32(sp+4);
            if(!gm_valid(packet,40))std::abort();
            std::fprintf(stderr,"[frontier] Halo bounty receiver count=%u clock=%u model=%08x point=%u,%u player=%u reward=%u original-call=1\n",b.calls,clock,rd32(packet+8),rd32(packet+16),rd32(packet+20),rd32(packet+24),rd32(packet+36));
        }
        if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
        if(b.fn==0x004a7600u) {
            const uint32_t unit=cpu->eax;
            std::fprintf(stderr,"[frontier] Halo bounty created count=%u clock=%u unit=%u model=%08x original-return=1\n",b.calls,rd32(0x0071c6a8),gm_valid(unit,0x88)?rd32(unit+0x60):0,gm_valid(unit,0x88)?rd32(unit+0x6c):0);
        }
    }
    void begin() {
        if(active||mods_hook_depth()||!sched_holds_baton())std::abort();
        hooks_before=mods_hooks_installed_count();
        for(auto &b:bindings)if(mods_hook_install_ex(MODS_OWNER_RUNTIME,b.fn,0,observe,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,&b,&b.handle)!=POP_OK)std::abort();
        active=true;
    }
    void end() {
        if(!active)return;
        if(mods_hook_depth()||!sched_holds_baton())std::abort();
        for(auto &b:bindings){if(!b.handle||mods_hook_remove(MODS_OWNER_RUNTIME,b.handle)!=POP_OK)std::abort();b.handle=0;}
        if(mods_hooks_installed_count()!=hooks_before)std::abort();active=false;
        std::fprintf(stderr,"[frontier] Halo bounty trace removed=4 sender=%u receiver=%u creator=%u send-ticks=%u retained-worlds=0 result=pass\n",bindings[0].calls,bindings[1].calls,bindings[2].calls,bindings[3].calls);
    }
} halo_bounty_trace;

static bool halo_hero_observation_enabled() {
    if(halo_session_actor_enabled())return true;
    const char *flag=recomp_env("BROWSER_FRONTIER_HALO_OBSERVE");
    if(!flag)return false;
    if(std::strcmp(flag,"v1")||!halo_reload_enabled()||region().key!="0_0")std::abort();
    return true;
}
static bool halo_hero_before_tick(X86 *c) {
    if(!halo_hero_observation_enabled())return false;
    auto &s=halo_hero_motion;
    if(!halo_reload.captured||halo_reload.pending||mods_hook_depth()||!sched_holds_baton())std::abort();
    if(s.paged) {
        // The fresh neighbour attaches at zero. A bound request may permit
        // exactly one ordinary tick to establish a non-sentinel timer epoch.
        const auto &session=region_session();const uint32_t state=rd32(0x006d7670);
        if(s.return_paging) {
            if(s.return_home_activation_started) {
                const uint32_t clock=rd32(0x0071c6a8);
                if(session.serial!=2||region().key!="0_0"||session.stage!=RegionSession::Stage::idle||!announced||
                   !gm_valid(state,0x50)||rd32(state+4)||clock<103500||clock>113500||clock%50||session.completed_ticks!=(clock-103500)/50||
                   (s.return_home_activation_complete?(clock!=113500||rd32(state)!=7):rd32(state)!=3))std::abort();
                return false; // Admit the original gameplay or paused presentation tick.
            }
            if(session.serial!=2||region().key!="0_0"||session.stage!=RegionSession::Stage::idle||!announced||
               session.completed_ticks||!gm_valid(state,0x50)||rd32(state+4)||rd32(0x0071c6a8)!=s.held_clock)std::abort();
            if(!s.return_home_paused) {
                if(rd32(state)!=3)std::abort();X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
                if(rd32(state)!=3||rd32(state+4)!=7)std::abort();s.return_home_paused=true;return true;
            }
            if(rd32(state)!=7)std::abort();
            if(!s.return_home_captured) {
                if(!joint_fixture_checkpoint(c,"Halo_Session_Return_Home_Held_2","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","0_0","actor-arrival-fixture-halo-world-session-"))std::abort();
                s.return_home_captured=true;
                std::fprintf(stderr,"[frontier] Halo saved return home held serial=2 key=0_0 clock=%u phase=7 ordinary-ticks=0 source-retired=1 incoming-imported=0 owner-published=0 result=pass\n",s.held_clock);
            }
            const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_HOME_ARRIVAL");
            if(flag&&std::strcmp(flag,"v1"))std::abort();
            if(flag&&!s.return_home_imported) {
                const std::string packet=owner_small_file(halo_session_binding.root+"/Halo_Session_Saved_Home_Arrival.txt",512);
                if(!packet.empty()) {
                    const std::string source=halo_session_binding.root+"/frontier_1_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Saved_Continuation_Crossed_1.GMP",
                        held=halo_session_binding.root+"/frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Return_Home_Held_2.GMP";
                    OsStat sourceStat{},homeStat{};char packPath[1024];
                    if(os_lstat(source.c_str(),&sourceStat)||!sourceStat.is_regular||sourceStat.is_symlink||!sourceStat.size||sourceStat.size>2*1024*1024||
                       os_lstat(held.c_str(),&homeStat)||!homeStat.is_regular||homeStat.is_symlink||!homeStat.size||homeStat.size>2*1024*1024||
                       !recomp_writable_path("Halo_Saved_Home_Arrival.pack",packPath,sizeof packPath))std::abort();
                    const std::string binding=loader_hash_file_bounded(packPath,3016);
                    const std::string expected="halo-session-saved-home-arrival-v1\n2\n0_0\n4050\n103500\n"+
                        loader_hash_file_bounded(source.c_str(),sourceStat.size)+"\n"+loader_hash_file_bounded(held.c_str(),homeStat.size)+"\n"+binding+"\n3016\n";
                    if(binding.size()!=64||packet!=expected||!majesty_browser_streaming_halo_saved_home_arrival(c,binding.c_str(),s.arrival_aliases.data())||
                       !joint_fixture_checkpoint(c,"Halo_Session_Saved_Home_Imported_2","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","0_0","actor-arrival-fixture-halo-world-session-"))std::abort();
                    s.return_home_imported=true;
                    std::fprintf(stderr,"[frontier] Halo saved home arrival saved serial=2 key=0_0 hero=%u agent=%u clock=103500 records=4 original-writer=1 scheduled=0 activation=0 owner-published=0 result=pass\n",s.arrival_aliases[0],s.arrival_aliases[4]);
                }
            }
            const char *activate=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_HOME_ACTIVATE");
            if(activate&&std::strcmp(activate,"v1"))std::abort();
            if(activate&&s.return_home_imported) {
                const std::string packet=owner_small_file(halo_session_binding.root+"/Halo_Session_Saved_Home_Activate.txt",512);
                if(!packet.empty()) {
                    const std::string imported=native_checkpoint_path(c,"Halo_Session_Saved_Home_Imported_2");OsStat st{};
                    if(os_lstat(imported.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>2*1024*1024)std::abort();
                    const std::string expected="halo-session-saved-home-activate-v1\n2\n0_0\n103500\n113500\n"+loader_hash_file_bounded(imported.c_str(),st.size)+"\n";
                    if(packet!=expected||!majesty_browser_streaming_halo_saved_home_activate(c,s.arrival_aliases.data())||
                       !joint_fixture_checkpoint(c,"Halo_Session_Saved_Home_Ready_2","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","0_0","actor-arrival-fixture-halo-world-session-"))std::abort();
                    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,3u);
                    if(rd32(state)!=7||rd32(state+4)!=3||rd32(0x0071c6a8)!=103500)std::abort();s.return_home_activation_started=true;
                    std::fprintf(stderr,"[frontier] Halo saved home activation ready serial=2 key=0_0 clock=103500 phase=7 pending=3 original-writer=1 original-resume=1 owner-published=0 result=pass\n");
                    return true;
                }
            }
            return false;
        }
        if(s.activation_started) {
            const uint32_t clock=rd32(0x0071c6a8);
            if(s.saved_destination) {
                if(!s.retired||!s.arrival_imported||session.serial!=1||region().key!="1_0"||session.stage!=RegionSession::Stage::idle||
                   !announced||!gm_valid(state,0x50)||rd32(state+4)||clock<3750||clock>6750||clock%50||session.completed_ticks!=(clock-3750)/50||
                   (s.activation_complete?(clock!=s.destination_clock||rd32(state)!=7):rd32(state)!=3))std::abort();
                const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_RETURN");
                if(flag&&std::strcmp(flag,"v1"))std::abort();
                if(flag&&s.activation_complete) {
                    const std::string packet=owner_small_file(halo_session_binding.root+"/Halo_Session_Saved_Return_Page.txt",512);
                    if(!packet.empty()) {
                        const std::string crossed=native_checkpoint_path(c,"Halo_Session_Saved_Continuation_Crossed_1");OsStat st{};
                        if(os_lstat(crossed.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>2*1024*1024)std::abort();
                        const std::string expected="halo-session-saved-return-page-v1\n1\n1_0\n0_0\n4050\n103500\n"+loader_hash_file_bounded(crossed.c_str(),st.size)+"\n";
                        if(packet!=expected||clock!=4050)std::abort();
                        Region target=region();target.x=target.y=0;target.key="0_0";target.checkpoint="Frontier_0_0";target.seed=region_seed(0,0);
                        std::string name;uint32_t seed=0,game_seed=0;
                        if(session_admit(target,name,seed,game_seed)!=SessionAdmission::saved)std::abort();
                        std::string manifest;std::array<std::string,2> paths;session_paths(target,manifest,paths);
                        const auto names=checkpoint_names(target);const unsigned slot=name==names[0]?0:name==names[1]?1:2;uint32_t saved_clock=0;
                        if(slot>1||!session_saved_rng(paths[slot],seed,game_seed,&saved_clock)||saved_clock!=s.held_clock||s.held_clock!=103500||
                           !majesty_browser_streaming_halo_saved_retire(c,s.arrival_aliases[0],s.arrival_aliases[4],clock)||
                           !joint_fixture_checkpoint(c,"Halo_Session_Saved_Return_Retired_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","1_0","actor-arrival-fixture-halo-world-session-"))std::abort();
                        const uint32_t world=rd32(0x0071c68c),manager=rd32(0x006d8568);
                        if(!gm_valid(world,0x14)||!rd32(world+4)||!gm_valid(manager,0x21c)||rd32(manager+0x218)!=1||saving||finished||network_blocked)std::abort();
                        saving=true;const bool saved=checkpoint(c,region(),world);saving=false;
                        if(!saved||rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=clock)std::abort();
                        auto &next=region_session();++next.serial;next.previous=region();next.target=target;next.saved_world=world;next.saved_clock=clock;
                        next.arrival_pending=false;next.camera_valid=false;session_release_begin(world);
                        X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416590u);
                        if(rd32(state)!=4||rd32(state+4)!=4||rd32(0x0071c68c)!=world||rd32(0x0071c6a8))std::abort();
                        next.stage=RegionSession::Stage::leaving;s.return_paging=true;
                        std::fprintf(stderr,"[frontier] Halo saved return page serial=2 source=1_0 target=0_0 source-clock=4050 home-clock=103500 original-quit=1 checkpoint-bound=1 owner-published=0 result=pass\n");
                        return true;
                    }
                }
                return false;
            }
            if(!s.retired||!s.arrival_imported||session.serial!=1||region().key!="1_0"||
               session.stage!=RegionSession::Stage::idle||!announced||!gm_valid(state,0x50)||rd32(state+4)||
               clock<50||clock>3550||clock%50||session.completed_ticks!=clock/50)std::abort();
            if(s.activation_complete) {
                if(clock!=3550||rd32(state)!=7)std::abort();
            } else if(clock>=3550||rd32(state)!=3)std::abort();
            return false;
        }
        if(!s.retired||session.serial!=1||region().key!=std::to_string(s.crossing_x)+"_"+std::to_string(s.crossing_y)||
           session.stage!=RegionSession::Stage::idle||!announced||session.completed_ticks!=(s.saved_destination?0u:s.destination_clock?1u:0u)||
           rd32(0x0071c6a8)!=s.destination_clock||!gm_valid(state,0x50)||rd32(state+4))std::abort();
        if(s.epoch_stepping) {
            if(rd32(state)!=3||s.destination_clock||!s.destination_captured||s.proxy_agent_id)std::abort();
            return false; // Exactly this original simulation tick is admitted.
        }
        if(!s.destination_pause_requested) {
            if(rd32(state)!=3)std::abort();
            X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;
            guest_call(&extra,0x00416050u,7u);
            if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=s.destination_clock)std::abort();
            s.destination_pause_requested=true;return true;
        }
        if(rd32(state)!=7)std::abort();
        if(!s.destination_captured) {
            if(!joint_fixture_checkpoint(c,"Halo_Session_Destination_Held_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",
                region().key.c_str(),"actor-arrival-fixture-halo-world-session-"))std::abort();
            s.destination_captured=true;
            std::fprintf(stderr,"[frontier] Halo session destination held serial=1 key=%s clock=%u phase=7 ordinary-ticks=0 source-retired=1 actor-imported=0 owner-published=0 result=pass\n",region().key.c_str(),s.destination_clock);
        }
        // Saved neighbors retain their restored epoch and existing pure home.
        // Never use the fresh-world epoch/proxy path for a visited kingdom.
        if(s.saved_destination) {
            const char *arrival=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_ARRIVAL");
            if(arrival&&std::strcmp(arrival,"v1"))std::abort();
            const uint64_t now=os_monotonic_ns();
            if(arrival&&!s.arrival_imported&&now-s.held_poll_ns>=100000000u) {
                s.held_poll_ns=now;
                const std::string packet=owner_small_file(halo_session_binding.root+"/Halo_Session_Saved_Arrival.txt",512);
                if(!packet.empty()) {
                    const std::string source=halo_session_binding.root+"/frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Actor_Held_0.GMP",
                        destination=native_checkpoint_path(c,"Halo_Session_Destination_Held_1"),pack=session_profile(region())+"/Halo_Session_Saved_Arrival.pack";
                    auto digest=[](const std::string &name,uint64_t limit){OsStat st{};
                        if(os_lstat(name.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>limit)std::abort();
                        return loader_hash_file_bounded(name.c_str(),st.size);};
                    const std::string source_hash=digest(source,2*1024*1024),destination_hash=digest(destination,2*1024*1024),pack_hash=digest(pack,2856);
                    const std::string expected="halo-session-saved-arrival-v1\n1\n1_0\n"+std::to_string(s.held_clock)+"\n"+
                        std::to_string(s.destination_clock)+"\n"+source_hash+"\n"+destination_hash+"\n"+pack_hash+"\n2856\n";
                    if(packet!=expected||s.destination_clock!=3750||region().key!="1_0"||
                       !joint_fixture_checkpoint(c,"Halo_Session_Saved_Arrival_Before_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","1_0","actor-arrival-fixture-halo-world-session-")||
                       !majesty_browser_streaming_halo_saved_arrival(c,pack_hash.c_str(),2856,s.unit_id,s.agent_id,s.held_clock,s.destination_clock,34,s.arrival_aliases.data())||
                       !joint_fixture_checkpoint(c,"Halo_Session_Saved_Arrival_Imported_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","1_0","actor-arrival-fixture-halo-world-session-"))std::abort();
                    s.arrival_imported=true;s.proxy_agent_id=34;
                    std::fprintf(stderr,"[frontier] Halo saved arrival saved serial=1 key=1_0 hero=%u agent=%u clock=3750 records=4 source-retired=1 original-writer=1 scheduled=0 activation=0 owner-published=0 result=pass\n",s.arrival_aliases[0],s.arrival_aliases[4]);
                }
            }
            const char *activate=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_ACTIVATE");
            if(activate&&std::strcmp(activate,"v1"))std::abort();
            if(activate&&s.arrival_imported) {
                const std::string packet=owner_small_file(halo_session_binding.root+"/Halo_Session_Saved_Activate.txt",512);
                if(!packet.empty()) {
                    const std::string imported=native_checkpoint_path(c,"Halo_Session_Saved_Arrival_Imported_1");OsStat st{};
                    if(os_lstat(imported.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>2*1024*1024)std::abort();
                    const std::string expected="halo-session-saved-activate-v1\n1\n1_0\n3750\n32\n272\n0_0\n"+loader_hash_file_bounded(imported.c_str(),st.size)+"\n";
                    if(packet!=expected||!majesty_browser_streaming_halo_saved_activate(c,s.arrival_aliases.data())||
                       !joint_fixture_checkpoint(c,"Halo_Session_Saved_Activation_Ready_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","1_0","actor-arrival-fixture-halo-world-session-")||
                       !majesty_browser_streaming_halo_saved_route(c,32,272)||
                       !joint_fixture_checkpoint(c,"Halo_Session_Saved_Route_Ready_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","1_0","actor-arrival-fixture-halo-world-session-"))std::abort();
                    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,3u);
                    if(rd32(state)!=7||rd32(state+4)!=3||rd32(0x0071c6a8)!=3750)std::abort();s.activation_started=true;
                    std::fprintf(stderr,"[frontier] Halo saved activation ready serial=1 key=1_0 clock=3750 phase=7 pending=3 original-writer=1 original-resume=1 owner-published=0 result=pass\n");
                    return true;
                }
            }
            return false; // Original paused presentation, no simulation tick.
        }
        const char *epoch=recomp_env("BROWSER_FRONTIER_HALO_SESSION_DESTINATION_EPOCH");
        if(epoch&&std::strcmp(epoch,"v1"))std::abort();
        if(epoch&&!s.destination_clock) {
            if(s.proxy_agent_id||region().key!="1_0")std::abort();
            const std::string packet=owner_small_file(halo_session_binding.root+"/Halo_Session_Destination_Epoch.txt",512);
            if(!packet.empty()) {
                const std::string held=native_checkpoint_path(c,"Halo_Session_Destination_Held_1");OsStat st{};
                if(os_lstat(held.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>64*1024*1024)std::abort();
                const std::string expected="halo-session-destination-epoch-v1\n1\n1_0\n0\n50\n"+loader_hash_file_bounded(held.c_str(),st.size)+"\n";
                if(packet!=expected)std::abort();
                X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;
                guest_call(&extra,0x00416050u,3u);
                if(rd32(state)!=7||rd32(state+4)!=3||rd32(0x0071c6a8))std::abort();
                s.epoch_stepping=true;
                std::fprintf(stderr,"[frontier] Halo session epoch resume serial=1 key=1_0 clock=0 phase=7 pending=3 original-resume=1 ticks-permitted=1 result=pass\n");
                return true;
            }
            return false; // Await the bound request with original paused ticks.
        }
        if(epoch&&!s.epoch_captured) {
            if(s.destination_clock!=50||!joint_fixture_checkpoint(c,"Halo_Session_Destination_Epoch_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",
                region().key.c_str(),"actor-arrival-fixture-halo-world-session-"))std::abort();
            s.epoch_captured=true;
            std::fprintf(stderr,"[frontier] Halo session epoch held serial=1 key=1_0 clock=50 phase=7 ordinary-ticks=1 original-writer=1 original-clock=1 actor-imported=0 owner-published=0 result=pass\n");
        }
        if(!s.proxy_agent_id) {
            const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_HOME_PROXY");if(flag&&std::strcmp(flag,"v1"))std::abort();
            const uint64_t now=os_monotonic_ns();
            if(flag&&now-s.held_poll_ns>=100000000u) {
                s.held_poll_ns=now;
                const std::string packet=owner_small_file(halo_session_binding.root+"/Halo_Session_Home_Proxy.txt",512);
                if(!packet.empty()) {
                    if(region().key!="1_0")std::abort();
                    const std::string held=native_checkpoint_path(c,epoch?"Halo_Session_Destination_Epoch_1":"Halo_Session_Destination_Held_1"),proposal=session_profile(region())+"/Halo_Session_Home_Proposal.GPL";
                    OsStat st{};if(os_lstat(held.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>64*1024*1024)std::abort();
                    const std::string held_hash=loader_hash_file_bounded(held.c_str(),st.size);
                    if(os_lstat(proposal.c_str(),&st)||!st.is_regular||st.is_symlink||st.size<56||st.size>1024)std::abort();
                    const std::string proxy_hash=loader_hash_file_bounded(proposal.c_str(),st.size);
                    const std::string expected="halo-session-home-proxy-v1\n1\n1_0\n"+std::to_string(s.destination_clock)+"\n"+held_hash+"\n"+proxy_hash+"\n"+std::to_string(st.size)+"\n";
                    if(packet!=expected)std::abort();
                    // Paused presentation still updates saved display state.
                    // Capture its actual state at this request boundary, then
                    // forbid any original tick between the two insertion saves.
                    if(!joint_fixture_checkpoint(c,"Halo_Session_Proxy_Before_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",
                        region().key.c_str(),"actor-arrival-fixture-halo-world-session-"))std::abort();
                    s.proxy_agent_id=majesty_browser_streaming_halo_session_proxy(c,proxy_hash.c_str(),uint32_t(st.size),s.destination_clock);
                    if(!s.proxy_agent_id||!joint_fixture_checkpoint(c,"Halo_Session_Proxy_Ready_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",
                        region().key.c_str(),"actor-arrival-fixture-halo-world-session-"))std::abort();
                    std::fprintf(stderr,"[frontier] Halo session proxy ready serial=1 key=1_0 agent=%u clock=%u phase=7 original-writer=1 ordinary-ticks=%u hero-imported=0 owner-published=0 result=pass\n",s.proxy_agent_id,s.destination_clock,unsigned(bool(s.destination_clock)));
                }
            }
        }
        if(s.proxy_agent_id&&!s.arrival_imported) {
            const char *arrival=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ARRIVAL");
            if(arrival&&std::strcmp(arrival,"v1"))std::abort();
            const uint64_t now=os_monotonic_ns();
            if(arrival&&now-s.held_poll_ns>=100000000u) {
                s.held_poll_ns=now;
                const std::string packet=owner_small_file(halo_session_binding.root+"/Halo_Session_Arrival.txt",512);
                if(!packet.empty()) {
                    if(s.destination_clock!=50||!s.epoch_captured||region().key!="1_0")std::abort();
                    const std::string source=halo_session_binding.root+"/frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Actor_Held_0.GMP",
                        ready=native_checkpoint_path(c,"Halo_Session_Proxy_Ready_1"),pack=session_profile(region())+"/Halo_Session_Arrival.pack";
                    auto bounded_hash=[](const std::string &name,uint64_t maximum){OsStat st{};
                        if(os_lstat(name.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>maximum)std::abort();
                        return loader_hash_file_bounded(name.c_str(),st.size);};
                    const std::string source_hash=bounded_hash(source,2*1024*1024),ready_hash=bounded_hash(ready,2*1024*1024),
                        pack_hash=bounded_hash(pack,3786);
                    const std::string expected="halo-session-arrival-v1\n1\n1_0\n"+std::to_string(s.held_clock)+"\n50\n"+
                        source_hash+"\n"+ready_hash+"\n"+pack_hash+"\n3786\n";
                    if(packet!=expected||!joint_fixture_checkpoint(c,"Halo_Session_Arrival_Before_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",
                        region().key.c_str(),"actor-arrival-fixture-halo-world-session-"))std::abort();
                    if(!majesty_browser_streaming_halo_session_arrival(c,pack_hash.c_str(),3786,s.unit_id,s.agent_id,s.held_clock,
                        s.proxy_agent_id,s.arrival_aliases.data())||!joint_fixture_checkpoint(c,"Halo_Session_Arrival_Imported_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",
                        region().key.c_str(),"actor-arrival-fixture-halo-world-session-"))std::abort();
                    s.arrival_imported=true;
                    std::fprintf(stderr,"[frontier] Halo session arrival saved serial=1 key=1_0 hero=%u agent=%u effects=%u,%u,%u clock=50 phase=7 original-writer=1 ordinary-ticks=1 scheduled=0 activation=0 owner-published=0 result=pass\n",
                        s.arrival_aliases[0],s.arrival_aliases[4],s.arrival_aliases[1],s.arrival_aliases[2],s.arrival_aliases[3]);
                }
            }
        }
        if(s.arrival_imported) {
            const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTIVATE");
            if(flag&&std::strcmp(flag,"v1"))std::abort();
            const uint64_t now=os_monotonic_ns();
            if(flag&&now-s.held_poll_ns>=100000000u) {
                s.held_poll_ns=now;
                const std::string packet=owner_small_file(halo_session_binding.root+"/Halo_Session_Activate.txt",512);
                if(!packet.empty()) {
                    const std::string imported=native_checkpoint_path(c,"Halo_Session_Arrival_Imported_1");OsStat st{};
                    if(os_lstat(imported.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>2*1024*1024)std::abort();
                    const std::string expected="halo-session-activate-v1\n1\n1_0\n50\n3550\n"+loader_hash_file_bounded(imported.c_str(),st.size)+"\n";
                    if(packet!=expected||s.destination_clock!=50||!s.epoch_captured||region().key!="1_0"||
                       !joint_fixture_checkpoint(c,"Halo_Session_Activation_Before_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",
                           region().key.c_str(),"actor-arrival-fixture-halo-world-session-")||
                       !majesty_browser_streaming_halo_session_activate(c,s.arrival_aliases.data(),s.proxy_agent_id)||
                       !joint_fixture_checkpoint(c,"Halo_Session_Activation_Ready_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",
                           region().key.c_str(),"actor-arrival-fixture-halo-world-session-"))std::abort();
                    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,3u);
                    if(rd32(state)!=7||rd32(state+4)!=3||rd32(0x0071c6a8)!=50)std::abort();
                    s.activation_started=true;
                    std::fprintf(stderr,"[frontier] Halo session activation ready serial=1 key=1_0 clock=50 phase=7 pending=3 original-writer=1 original-resume=1 owner-published=0 result=pass\n");
                    return true;
                }
            }
        }
        return false; // Original paused input/presentation tick only.
    }
    if(s.held) {
        const uint32_t state=rd32(0x006d7670);
        if(rd32(0x0071c6a8)!=s.held_clock||!gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4))std::abort();
        const uint64_t now=os_monotonic_ns();
        if(now-s.held_poll_ns>=100000000u) {
            s.held_poll_ns=now;
            bool requested=os_browser_take_action("frontier-checkpoint");
            if(s.session_actor&&!s.held_captured) {
                const std::string packet=owner_small_file(halo_session_binding.root+"/Halo_Session_Actor_Hold.txt",512);
                if(!packet.empty()) {
                    const auto source=native_checkpoint_path(c,"Halo_Session_Actor_Crossed_"+std::to_string(region_session().serial));
                    OsStat st{};if(os_lstat(source.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>64*1024*1024)std::abort();
                    const std::string expected="halo-session-actor-hold-v1\n"+std::to_string(region_session().serial)+"\n"+region().key+"\n"+
                        std::to_string(s.unit_id)+"\n"+std::to_string(s.agent_id)+"\n"+std::to_string(s.held_clock)+"\n"+
                        loader_hash_file_bounded(source.c_str(),st.size)+"\n";
                    if(packet!=expected)std::abort();requested=true;
                }
            }
            if(requested&&!s.held_captured) {
                if(!halo_actor_checkpoint(c,true))std::abort();
                s.held_captured=true;
                std::fprintf(stderr,"[frontier] Halo crossing held checkpoint clock=%u phase=7 original-writer=1 original-paused-ticks=1 result=pass\n",s.held_clock);
            }
            if(s.session_actor&&s.held_captured&&!s.retired) {
                const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_RETIRE");
                if(flag&&std::strcmp(flag,"v1"))std::abort();
                const std::string packet=flag?owner_small_file(halo_session_binding.root+"/Halo_Session_Actor_Retire.txt",512):std::string{};
                if(!packet.empty()) {
                    const std::string ids_name=halo_session_binding.root+"/Halo_Session_Actor_Retire.ids";
                    OsStat st{};if(os_lstat(ids_name.c_str(),&st)||!st.is_regular||st.is_symlink||st.size!=48)std::abort();
                    const std::string held=native_checkpoint_path(c,"Halo_Session_Actor_Held_"+std::to_string(region_session().serial));
                    if(os_lstat(held.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>64*1024*1024)std::abort();
                    const std::string expected="halo-session-actor-retire-v1\n"+std::to_string(region_session().serial)+"\n"+region().key+"\n"+
                        std::to_string(s.held_clock)+"\n"+loader_hash_file_bounded(held.c_str(),st.size)+"\n"+loader_hash_file_bounded(ids_name.c_str(),48)+"\n";
                    if(packet!=expected||region_session().serial||region().key!="0_0")std::abort();
                    const int fd=os_fd_open(ids_name.c_str(),OS_O_RDONLY);if(fd<0)std::abort();
                    std::array<uint32_t,12> ids{};const auto used=os_fd_read(fd,ids.data(),48);const bool closed=!os_fd_close(fd);
                    if(!closed||used!=48||ids[0]!=0x31525348u||ids[1]!=1||ids[2]!=s.held_clock||ids[3]!=s.unit_id||
                       ids[4]!=s.agent_id||ids[5]!=469||ids[6]!=7||ids[7]>3||ids[11])std::abort();
                    for(unsigned i=ids[7];i<3;++i)if(ids[8+i])std::abort();
                    if(!majesty_browser_streaming_halo_session_retire(c,ids[3],ids[4],ids[5],ids[6],ids.data()+8,ids[7])||
                       !joint_fixture_checkpoint(c,"Halo_Session_Actor_Retired_0","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","0_0","actor-arrival-fixture-halo-world-session-"))std::abort();
                    s.retired=true;
                    std::fprintf(stderr,"[frontier] Halo session retired checkpoint clock=%u phase=7 original-writer=1 source-journal-unchanged=1 owner-published=0 result=pass\n",s.held_clock);
                }
            }
            if(s.session_actor&&s.retired) {
                const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTOR_PAGE");
                if(flag&&std::strcmp(flag,"v1"))std::abort();
                const std::string packet=flag?owner_small_file(halo_session_binding.root+"/Halo_Session_Actor_Page.txt",512):std::string{};
                if(!packet.empty()) {
                    auto &session=region_session();const uint32_t world=rd32(0x0071c68c);
                    if(session.serial||session.stage!=RegionSession::Stage::idle||region().key!="0_0"||
                       !gm_valid(world,0x14)||!rd32(world+4)||std::abs(s.crossing_x)+std::abs(s.crossing_y)!=1||
                       c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP||saving||finished||network_blocked)std::abort();
                    const std::string retired=native_checkpoint_path(c,"Halo_Session_Actor_Retired_0");OsStat st{};
                    if(os_lstat(retired.c_str(),&st)||!st.is_regular||st.is_symlink||!st.size||st.size>64*1024*1024)std::abort();
                    Region target=region();target.x=s.crossing_x;target.y=s.crossing_y;
                    target.key=std::to_string(target.x)+"_"+std::to_string(target.y);
                    target.checkpoint="Frontier_"+target.key;target.seed=region_seed(target.x,target.y);
                    const std::string expected="halo-session-actor-page-v1\n0\n0_0\n"+target.key+"\n"+std::to_string(s.held_clock)+"\n"+
                        loader_hash_file_bounded(retired.c_str(),st.size)+"\n";
                    if(packet!=expected)std::abort();
                    std::string name;uint32_t seed=0,game_seed=0;
                    const auto admitted=session_admit(target,name,seed,game_seed);
                    if(s.saved_destination) {
                        if(target.key!="1_0"||admitted!=SessionAdmission::saved)std::abort();
                        std::string manifest;std::array<std::string,2> paths;session_paths(target,manifest,paths);
                        const auto names=checkpoint_names(target);const unsigned slot=name==names[0]?0:name==names[1]?1:2;
                        uint32_t clock=0;if(slot>1||!session_saved_rng(paths[slot],seed,game_seed,&clock)||clock!=s.destination_clock)std::abort();
                    } else if(admitted!=SessionAdmission::fresh)std::abort();
                    const uint32_t manager=rd32(0x006d8568);
                    if(!gm_valid(manager,0x21c)||rd32(manager+0x218)!=1)std::abort();
                    // The normal private two-slot writer and bound layout are
                    // durable before original teardown can release anything.
                    saving=true;const bool saved=checkpoint(c,region(),world);saving=false;
                    if(!saved||rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=s.held_clock||rd32(0x0071c68c)!=world)std::abort();
                    ++session.serial;session.previous=region();session.target=target;
                    session.saved_world=world;session.saved_clock=s.held_clock;
                    session.arrival_pending=false;session.camera_valid=false;
                    session_release_begin(world);
                    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;
                    guest_call(&extra,0x00416590u);
                    const uint32_t settings=rd32(0x006d87a0);
                    if(rd32(state)!=4||rd32(state+4)!=4||rd32(0x0071c68c)!=world||rd32(0x0071c6a8)||
                       !gm_valid(settings,0x70)||rd32(settings+0x6c))std::abort();
                    session.stage=RegionSession::Stage::leaving;s.paged=true;s.held=false;s.before_valid=false;
                    std::fprintf(stderr,"[frontier] Halo session actor page serial=1 source=0_0 target=%s saved-clock=%u phase=4 pending=4 clock=0 original-quit=1 checkpoint-bound=1 owner-published=0 result=pass\n",target.key.c_str(),s.held_clock);
                    return true; // Quit already ran; no old-world tick follows.
                }
            }
        }
        // Run the original paused tick: it keeps input and presentation alive
        // while phase7 excludes the original clock, GPL and world updates.
        return false;
    }
    const char *bounty=recomp_env("BROWSER_FRONTIER_HALO_EXPLORE_BOUNTY");
    const char *move=recomp_env("BROWSER_FRONTIER_HALO_SESSION_MOVE");
    if(move&&!s.movement_queued) {
        if(std::strcmp(move,"v1")||!s.session_actor||s.samples||rd32(0x0071c6a8)!=s.start_clock)std::abort();
        std::array<int32_t,3> pose{};uint32_t cells=0;
        if(!halo_observed_pose(c,pose.data(),&cells)||pose[1]<64*2048||pose[1]>=4032*2048||
           !joint_fixture_checkpoint(c,"Halo_Session_Move_Before_0","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","0_0","actor-arrival-fixture-halo-world-session-")||
           !majesty_browser_streaming_halo_session_actor_move(c,s.unit_id,s.agent_id,4064,uint32_t(pose[1])/2048)||
           !joint_fixture_checkpoint(c,"Halo_Session_Move_Ready_0","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","0_0","actor-arrival-fixture-halo-world-session-"))std::abort();
        s.movement_queued=true;
    }
    if(bounty&&!move&&!halo_bounty_trace.active&&!s.bounty_queued) {
        if(std::strcmp(bounty,"1000")||rd32(0x0071c6a8)!=s.start_clock||s.samples)std::abort();
        halo_bounty_trace.begin();
    }
    uint32_t cells=0;s.before_clock=rd32(0x0071c6a8);
    s.before_valid=halo_observed_pose(c,s.before.data(),&cells);
    return false;
}
static void halo_hero_after_tick(X86 *c) {
    if(!halo_hero_observation_enabled())return;
    auto &s=halo_hero_motion;
    if(s.paged) {
        if(s.return_home_activation_started&&!s.return_home_activation_complete) {
            if(majesty_browser_streaming_halo_saved_home_after_tick(c)) {
                const uint32_t state=rd32(0x006d7670);
                if(!joint_fixture_checkpoint(c,"Halo_Session_Saved_Home_Evolved_2","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","0_0","actor-arrival-fixture-halo-world-session-"))std::abort();
                X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
                if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=113500)std::abort();s.return_home_activation_complete=true;
                std::fprintf(stderr,"[frontier] Halo saved home continuation held serial=2 key=0_0 clock=113500 phase=3 pending=7 original-writer=1 original-pause=1 ordinary-ticks=200 owner-published=0 result=pass\n");
            }
            return;
        }
        if(s.activation_started&&!s.activation_complete) {
            if(s.saved_destination) {
                if(majesty_browser_streaming_halo_saved_activation_after_tick(c)) {
                    const uint32_t state=rd32(0x006d7670),clock=rd32(0x0071c6a8);
                    if(!joint_fixture_checkpoint(c,"Halo_Session_Saved_Continuation_Crossed_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT","1_0","actor-arrival-fixture-halo-world-session-"))std::abort();
                    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
                    if(rd32(state)!=3||rd32(state+4)!=7||clock<3800||clock>6750)std::abort();s.destination_clock=clock;s.activation_complete=true;
                    std::fprintf(stderr,"[frontier] Halo saved continuation held serial=1 key=1_0 clock=%u phase=3 pending=7 original-writer=1 original-pause=1 owner-published=0 result=pass\n",clock);
                }
                return;
            }
            if(majesty_browser_streaming_halo_session_activation_after_tick(c)) {
                const uint32_t state=rd32(0x006d7670);
                if(!joint_fixture_checkpoint(c,"Halo_Session_Activation_Evolved_1","BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",
                    region().key.c_str(),"actor-arrival-fixture-halo-world-session-"))std::abort();
                X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,7u);
                if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=3550)std::abort();
                s.destination_clock=3550;s.activation_complete=true;
                std::fprintf(stderr,"[frontier] Halo session activation evolved serial=1 key=1_0 clock=3550 phase=3 pending=7 original-writer=1 original-pause=1 ordinary-ticks=71 owner-published=0 result=pass\n");
            }
            return;
        }
        if(s.epoch_stepping) {
            const uint32_t state=rd32(0x006d7670);const auto &session=region_session();
            if(!gm_valid(state,0x50)||rd32(state)!=3||rd32(state+4)||rd32(0x0071c6a8)!=50||session.serial!=1||
               session.completed_ticks||s.destination_clock||s.proxy_agent_id||region().key!="1_0")std::abort();
            X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;
            guest_call(&extra,0x00416050u,7u);
            if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=50)std::abort();
            s.destination_clock=50;s.epoch_stepping=false;
            std::fprintf(stderr,"[frontier] Halo session epoch tick serial=1 key=1_0 before-clock=0 clock=50 phase=3 pending=7 original-tick=1 original-pause=1 ticks-permitted=0 result=pass\n");
        }
        return;
    }
    if(s.held||!s.before_valid)return;
    std::array<int32_t,3> accepted{};uint32_t cells=0;
    if(!halo_observed_pose(c,accepted.data(),&cells))return;
    const uint32_t clock=rd32(0x0071c6a8);
    if(halo_bounty_trace.active&&clock-s.start_clock>=17000)halo_bounty_trace.end();
    if(clock<s.before_clock||++s.samples>1024)std::abort();
    if(accepted==s.before)return;
    ++s.changed;
    if(s.changed<=8||s.changed%20==0)
        std::fprintf(stderr,"[frontier] Halo hero motion key=0_0 unit=%u sample=%u changed=%u clock=%u pose=%d,%d,%d native-cells=%u original-tick=1 result=pass\n",s.unit_id,s.samples,s.changed,clock,accepted[0],accepted[1],accepted[2],cells);
    constexpr int32_t low=64*2048,high=4032*2048,physical=4096*2048,core=3968*2048;
    const auto inside=[](const std::array<int32_t,3> &p){return p[0]>=low&&p[0]<high&&p[1]>=low&&p[1]<high;};
    if(inside(accepted))return;
    if(!inside(s.before))std::abort();
    const int dx=accepted[0]<low?-1:accepted[0]>=high?1:0;
    const int dy=accepted[1]<low?-1:accepted[1]>=high?1:0;
    if(std::abs(dx)+std::abs(dy)!=1)std::abort();
    const std::array<int32_t,3> destination={accepted[0]-dx*core,accepted[1]-dy*core,accepted[2]};
    for(const auto &p:{accepted,destination})for(unsigned axis=0;axis<2;++axis)
        if(p[axis]<0||p[axis]>=physical||p[axis]/32768<2||p[axis]/32768>=254)std::abort();
    halo_bounty_trace.end();
    if(!halo_actor_checkpoint(c,false))std::abort();
    s.held=true;s.held_clock=clock;s.crossing_x=dx;s.crossing_y=dy;
    const uint32_t state=rd32(0x006d7670);
    if(!gm_valid(state,0x50)||rd32(state)!=3||rd32(state+4))std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;
    guest_call(&extra,0x00416050u,7u);
    if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();
    std::fprintf(stderr,"[frontier] Halo hero crossed source=0_0 destination=%d_%d unit=%u agent=%u previous-clock=%u clock=%u previous=%d,%d,%d accepted=%d,%d,%d projected=%d,%d,%d native-cells=%u samples=%u changed=%u original-tick=1 original-writer=1 simulation-held=1 source-retired=0 owner-published=0 result=pass\n",dx,dy,s.unit_id,s.agent_id,s.before_clock,clock,s.before[0],s.before[1],s.before[2],accepted[0],accepted[1],accepted[2],destination[0],destination[1],destination[2],cells,s.samples,s.changed);
}
#endif

extern "C" bool majesty_browser_frontier_joint_departure_checkpoint(X86 *c, bool removed) {
    return joint_fixture_checkpoint(c, removed ? "Joint_Departure_After" : "Joint_Departure_Before",
                                    "BROWSER_STREAMING_JOINT_DEPARTURE_FIXTURE");
}

extern "C" bool majesty_browser_frontier_home_motion_checkpoint(X86 *c, uint32_t stage) {
    const char *names[] = {"Home_Motion_Before", "Home_Motion_After", "Home_Motion_Resumed"};
    return stage < 3 && joint_fixture_checkpoint(c, names[stage],
                                                 "BROWSER_STREAMING_HOME_MOTION_FIXTURE");
}

extern "C" bool majesty_browser_frontier_joint_schedule_checkpoint(X86 *c, bool scheduled) {
    return joint_fixture_checkpoint(c, scheduled ? "Joint_Schedule_After" : "Joint_Schedule_Before",
                                    "BROWSER_STREAMING_JOINT_SCHEDULE_FIXTURE");
}

extern "C" bool majesty_browser_frontier_joint_departed_reload_checkpoint(X86 *c) {
    return joint_fixture_checkpoint(c, "Joint_Departed_Reload",
                                    "BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE");
}

extern "C" bool majesty_browser_frontier_joint_evolved_checkpoint(X86 *c) {
    return joint_fixture_checkpoint(c, "Joint_Evolved",
                                    "BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE");
}

extern "C" bool majesty_browser_frontier_registered_hero_checkpoint(X86 *c) {
    return joint_fixture_checkpoint(c, "Hero_Import_Ready", "BROWSER_STREAMING_HERO_IMPORT_FIXTURE",
                                    "1_0", "actor-arrival-fixture-hero-import-");
}

extern "C" bool majesty_browser_frontier_registered_hero_reload_checkpoint(X86 *c) {
    return joint_fixture_checkpoint(c, "Hero_Reload_Ready", "BROWSER_STREAMING_HERO_RELOAD_FIXTURE",
                                    "1_0", "actor-arrival-fixture-hero-reload-");
}

extern "C" bool majesty_browser_frontier_registered_hero_live_checkpoint(X86 *c, bool after) {
    return joint_fixture_checkpoint(c, after ? "Hero_Live_Evolved" : "Hero_Live_Ready",
                                    "BROWSER_STREAMING_HERO_LIVE_FIXTURE", "1_0",
                                    "actor-arrival-fixture-hero-live-");
}

extern "C" bool majesty_browser_frontier_regional_hero_checkpoint(X86 *c) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const Region &r=region();
    const char *profile=recomp_env("PROFILE_DIR"),*mode=recomp_env("BROWSER_STREAMING_REGIONAL_HERO_EFFECTS");
    std::string_view path(profile?profile:"");
    const std::string suffix="/native-world-regional-hero/frontier_"+r.key;
    if(!r.enabled||r.key=="0_0"||!mode||std::strcmp(mode,"motion-v1")||!path.ends_with(suffix))return false;
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');
    const auto owned=path.substr(slash==path.npos?0:slash+1);
    if(!owned.starts_with("actor-arrival-fixture-regional-hero-runtime-")||owned.size()>80)return false;
    return joint_fixture_checkpoint(c,"Regional_Hero_Moved","BROWSER_STREAMING_REGIONAL_HERO_SAVE_FIXTURE",
                                    r.key.c_str(),"native-world-regional-hero");
#endif
}

extern "C" bool majesty_browser_frontier_registered_hero_departure_checkpoint(X86 *c, bool after) {
    return joint_fixture_checkpoint(c, after ? "Hero_Departure_After" : "Hero_Departure_Before",
                                    "BROWSER_STREAMING_HERO_DEPARTURE_FIXTURE", "0_0",
                                    "actor-arrival-fixture-hero-departure-");
}

extern "C" bool majesty_browser_frontier_outdoor_family_return_checkpoint(X86 *c, unsigned stage) {
    const char *labels[]={"Family_Return_Source","Family_Return_Departed","Family_Return_Ready","Family_Return_Entered"};
    return stage<4 && joint_fixture_checkpoint(c,labels[stage],"BROWSER_STREAMING_OUTDOOR_FAMILY_RETURN_FIXTURE",
        "0_0","actor-arrival-fixture-outdoor-family-return-");
}

extern "C" bool majesty_browser_frontier_outdoor_family_snapshot_checkpoint(X86 *c, unsigned stage) {
    constexpr const char *labels[]={"Family_Remote_Source","Family_Remote_Ready","Family_Remote_Held","Family_Remote_Departed"};
    return stage<4 && joint_fixture_checkpoint(c,labels[stage],"BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_FIXTURE",
        "1_0","actor-arrival-fixture-outdoor-family-snapshot-");
}

extern "C" bool majesty_browser_frontier_registered_hero_pair_reload_checkpoint(X86 *c, unsigned side) {
    if(side>1)return false;
    return joint_fixture_checkpoint(c, side?"Hero_Pair_Reload_Destination":"Hero_Pair_Reload_Source",
                                    "BROWSER_STREAMING_HERO_PAIR_RELOAD_FIXTURE", side?"1_0":"0_0",
                                    "actor-arrival-fixture-hero-pair-reload-");
}

extern "C" bool majesty_browser_frontier_halo_bundle_checkpoint(X86 *c,bool after) {
    return joint_fixture_checkpoint(c,after?"Halo_Bundle_Evolved":"Halo_Bundle_Activated",
        "BROWSER_STREAMING_HALO_BUNDLE_LIVE","0_-1","actor-arrival-fixture-halo-world-bundle-");
}

extern "C" bool majesty_browser_frontier_halo_return_checkpoint(X86 *c,unsigned stage) {
    constexpr const char *labels[]={"Halo_Return_Before","Halo_Return_Imported","Halo_Return_Cleaned"};
    return stage<3 && joint_fixture_checkpoint(c,labels[stage],"BROWSER_STREAMING_HALO_RETURN_IMPORT",
        "0_0","actor-arrival-fixture-halo-world-return-");
}
extern "C" bool majesty_browser_frontier_halo_homeward_checkpoint(X86 *c,unsigned stage) {
    constexpr const char *labels[]={"Halo_Homeward_Before","Halo_Homeward_Imported","Halo_Homeward_Cleaned","Halo_Homeward_Ready","Halo_Homeward_Evolved"};
    return stage<5 && joint_fixture_checkpoint(c,labels[stage],"BROWSER_STREAMING_HALO_HOMEWARD_IMPORT",
        "0_0","actor-arrival-fixture-halo-world-homeward-");
}
extern "C" bool majesty_browser_frontier_halo_homeward_owner_checkpoint(X86 *c,unsigned stage) {
    constexpr const char *labels[]={"Halo_Homeward_Owner_Loaded","Halo_Homeward_Owner_Ready","Halo_Homeward_Owner_Evolved"};
    return stage<3 && joint_fixture_checkpoint(c,labels[stage],"BROWSER_STREAMING_HALO_HOMEWARD_OWNER",
        "0_0","actor-arrival-fixture-halo-world-homeward-owner-");
}
extern "C" bool majesty_browser_frontier_halo_saved_home_owner_checkpoint(X86 *c,unsigned stage) {
    constexpr const char *labels[]={"Halo_Saved_Home_Owner_Loaded","Halo_Saved_Home_Owner_Ready","Halo_Saved_Home_Owner_Evolved"};
    return stage<3 && joint_fixture_checkpoint(c,labels[stage],"BROWSER_STREAMING_HALO_SAVED_HOME_OWNER",
        "0_0","actor-arrival-fixture-halo-world-saved-home-owner-");
}
extern "C" bool majesty_browser_frontier_halo_return_live_checkpoint(X86 *c,unsigned stage) {
    constexpr const char *labels[]={"Halo_Return_Live_Loaded","Halo_Return_Live_Ready","Halo_Return_Live_Evolved"};
    return stage<3 && joint_fixture_checkpoint(c,labels[stage],"BROWSER_STREAMING_HALO_RETURN_LIVE",
        "0_0","actor-arrival-fixture-halo-world-return-live-");
}

extern "C" bool majesty_browser_frontier_halo_return_owner_checkpoint(X86 *c,unsigned stage) {
    constexpr const char *labels[]={"Halo_Return_Owner_Loaded","Halo_Return_Owner_Ready","Halo_Return_Owner_Evolved"};
    return stage<3 && joint_fixture_checkpoint(c,labels[stage],"BROWSER_STREAMING_HALO_RETURN_OWNER",
        "0_0","actor-arrival-fixture-halo-world-return-owner-");
}

extern "C" bool majesty_browser_frontier_halo_east_owner_checkpoint(X86 *c,unsigned stage) {
    const char *labels[]={"Halo_East_Owner_Loaded","Halo_East_Owner_Ready","Halo_East_Owner_Evolved"};
    return stage<3 && joint_fixture_checkpoint(c,labels[stage],"BROWSER_STREAMING_HALO_EAST_OWNER",
        "1_0","actor-arrival-fixture-halo-world-east-owner-");
}

extern "C" bool majesty_browser_frontier_halo_home_leg_checkpoint(X86 *c,unsigned stage) {
    constexpr const char *labels[]={"Halo_Home_Leg_Loaded","Halo_Home_Leg_Ready","Halo_Home_Leg_Crossed","Halo_Home_Leg_Retired"};
    return stage<4 && joint_fixture_checkpoint(c,labels[stage],
        "BROWSER_STREAMING_HALO_EAST_OWNER","1_0",
        "actor-arrival-fixture-halo-world-east-owner-");
}


extern "C" bool majesty_browser_frontier_halo_source_checkpoint(X86 *c,bool after) {
    return joint_fixture_checkpoint(c,after?"Halo_Source_Retired":"Halo_Source_Before",
        "BROWSER_STREAMING_HALO_SOURCE_RETIRE","0_0","actor-arrival-fixture-halo-world-bundle-");
}

extern "C" bool majesty_browser_frontier_halo_return_source_checkpoint(X86 *c,bool after) {
    return joint_fixture_checkpoint(c,after?"Halo_Return_Source_Retired":"Halo_Return_Source_Before",
        "BROWSER_STREAMING_HALO_RETURN_SOURCE_RETIRE","0_-1","actor-arrival-fixture-halo-world-return-retire-");
}

extern "C" bool majesty_browser_frontier_registered_hero_return_checkpoint(X86 *c) {
    return joint_fixture_checkpoint(c,"Hero_Return_Ready","BROWSER_STREAMING_HERO_RETURN_FIXTURE",
                                    "0_0","actor-arrival-fixture-hero-return-");
}

extern "C" bool majesty_browser_frontier_registered_hero_return_live_checkpoint(X86 *c, bool after) {
    return joint_fixture_checkpoint(c,after?"Hero_Return_Live_Evolved":"Hero_Return_Live_Loaded",
                                    "BROWSER_STREAMING_HERO_RETURN_LIVE_FIXTURE","0_0",
                                    "actor-arrival-fixture-hero-return-live-");
}

extern "C" bool majesty_browser_frontier_remote_hero_departure_checkpoint(X86 *c, bool after) {
    return joint_fixture_checkpoint(c,after?"Remote_Departure_After":"Remote_Departure_Before",
                                    "BROWSER_STREAMING_REMOTE_HERO_DEPARTURE_FIXTURE","1_0",
                                    "actor-arrival-fixture-remote-hero-departure-");
}

extern "C" bool majesty_browser_frontier_hero_return_pair_reload_checkpoint(X86 *c, unsigned side, bool after) {
    if(side>1)return false;
    const char *label=side?(after?"Hero_Return_Pair_Evolved_Destination":"Hero_Return_Pair_Loaded_Destination"):
                           (after?"Hero_Return_Pair_Evolved_Source":"Hero_Return_Pair_Loaded_Source");
    return joint_fixture_checkpoint(c,label,"BROWSER_STREAMING_HERO_RETURN_PAIR_RELOAD_FIXTURE",
                                    side?"1_0":"0_0","actor-arrival-fixture-hero-return-pair-reload-");
}

extern "C" bool majesty_browser_frontier_joint_return_checkpoint(X86 *c) {
    return joint_fixture_checkpoint(c, "Joint_Return_Ready",
                                    "BROWSER_STREAMING_RETURN_ACTIVE_FIXTURE");
}

// Native-only automatic residency trial. Reuse the verified original named
// restore/attach lifecycle; ownership and visit admission belong to streaming.
extern "C" bool majesty_browser_frontier_residency_restore(X86 *c) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_AUTO_REGION_LOAD_FIXTURE");
    const uint32_t state = rd32(0x006d7670);
    if (!flag || std::strcmp(flag, "v1") || !region().enabled || !gm_valid(state, 0x50) ||
        rd32(state) != 1 || rd32(state + 0xc) != c->r[R_ECX] || rd32(0x0071c68c) ||
        mods_hook_depth() || !sched_holds_baton() || c->r[R_ESP] < STACK_LIMIT + 65536 ||
        c->r[R_ESP] > STACK_TOP) return false;
    return restore_checkpoint(c, "Joint_Reload", state);
#endif
}

// The original Beginner preset shared by native regional generation trials.
// Call only at the front-end boundary, after checking the active state/world.
static bool generate_native_region_preset(X86 *c, const Region &r, uint32_t state) {
    const uint32_t hooks = mods_hooks_installed_count();
    const bool halo = halo_terrain_fixture();
    const uint32_t initial_boundary_hooks = unsigned(connected_boundary_policy.handle != 0) +
                                            unsigned(connected_boundary_policy.delta_handle != 0);
    X86 extra = *c; extra.r[R_ESP] -= 32768;
    guest_call(&extra, 0x00446e70, 0x30335041u, 5000u, 0x006d8630u);
    extra = *c; extra.r[R_ESP] -= 32768;
    guest_call(&extra, 0x00446910, 0x30335041u, 0x006d8630u);
    const uint32_t world = rd32(0x0071c68c);
    const uint32_t context = gm_valid(world,8) ? rd32(world+4) : 0;
    // A cold fresh map installs the two persistent boundary writers for the
    // first time. Later region generation already has them. Admit exactly
    // those owned registrations, never arbitrary hook-count growth.
    const uint32_t expected_hooks = hooks + (halo ? 2 - initial_boundary_hooks : 0);
    const bool hooks_balanced = mods_hooks_installed_count() == expected_hooks &&
        (!halo || (connected_boundary_policy.handle && connected_boundary_policy.delta_handle &&
                   context && gm_valid(context,0x84) && connected_boundary_policy.terrain==rd32(context+0x80)));
    const bool ok = rd32(state) == 1 && rd32(state + 4) == 2 &&
        gm_valid(world, 0x20) && rd32(world) == 0x0067f85c &&
        hooks_balanced;
    std::fprintf(stderr, "[frontier] Region generated key=%s world=%08x phase=%u pending=%u hooks-same=%u original-preset=00446910 result=%s\n",
                 r.key.c_str(), world, rd32(state), rd32(state + 4),
                 unsigned(mods_hooks_installed_count() == hooks), ok ? "pass" : "fail");
    if(halo)std::fprintf(stderr,"[frontier] Halo generation hooks initial=%u final=%u boundary-before=%u boundary-after=2 balanced=%u\n",
        hooks,mods_hooks_installed_count(),initial_boundary_hooks,unsigned(hooks_balanced));
    return ok;
}

// Original menu-boundary generation for the native expanding-world prototype.
// Retain one active coordinate, never a catalogue of dormant game objects.
extern "C" bool majesty_browser_frontier_residency_region(X86 *c, int32_t x, int32_t y,
                                                          bool generate) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_REGION_EXPANSION_FIXTURE");
    const char *requests = recomp_env("BROWSER_STREAMING_REGION_REQUEST_FIXTURE");
    const uint32_t state = rd32(0x006d7670);
    auto &r = region();
    if (!flag || std::strcmp(flag, "v1") || !requests || std::strcmp(requests, "v2") ||
        !r.enabled || x < -1000000 || x > 1000000 || y < -1000000 || y > 1000000 ||
        !gm_valid(state, 0x50) || rd32(state) != 1 || rd32(state + 4) ||
        rd32(state + 0xc) != c->r[R_ECX] || rd32(0x0071c68c) || mods_hook_depth() ||
        !sched_holds_baton() || c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
        !seeded_generation() || !connected_terrain() || transfer_requested()) return false;
    r.x = x; r.y = y; r.key = std::to_string(x) + "_" + std::to_string(y);
    r.checkpoint = "Frontier_" + r.key; r.seed = region_seed(x, y);
    announced = false; finished = false; network_blocked = false;
    std::fprintf(stderr, "[frontier] Region context key=%s seed=%u generate=%u world-null=1 result=pass\n",
                 r.key.c_str(), r.seed, unsigned(generate));
    if (!generate) return true;
    // These original preset routines construct configuration and generate/
    // attach the world exactly as the solo Beginner menu selection does.
    // The normal seeded/connected generation wrappers still qualify every
    // constructor and pre-placement write; no generated code is edited.
    return generate_native_region_preset(c, r, state);
#endif
}

extern "C" void majesty_browser_frontier_menu(X86 *c) {
#ifndef __EMSCRIPTEN__
    if(recomp_env("BROWSER_FRONTIER_HALO_TERRAIN"))(void)halo_terrain_fixture();
    const char *halo_generate = recomp_env("BROWSER_FRONTIER_HALO_AUTOGENERATE");
    if (halo_generate && !restore_attempted) {
        const uint32_t state = rd32(0x006d7670);
        if (std::strcmp(halo_generate,"1") || !halo_terrain_fixture() ||
            !gm_valid(state,0x50) || rd32(state)!=1 || rd32(state+4) ||
            rd32(state+0xc)!=c->r[R_ECX] || rd32(0x0071c68c) ||
            mods_hook_depth() || !sched_holds_baton() ||
            c->r[R_ESP]<STACK_LIMIT+65536 || c->r[R_ESP]>STACK_TOP ||
            transfer_requested()) std::abort();
        restore_attempted=true;
        if(!generate_native_region_preset(c,region(),state))std::abort();
        c->eip=rd32(c->r[R_ESP]);c->r[R_ESP]+=8;return;
    }
#endif
    if (session_menu(c)) {
        c->eip = rd32(c->r[R_ESP]); c->r[R_ESP] += 8; return;
    }
    // This original front-end entry occurs after dispatcher disposal, before
    // the modal menu loop. Menu painting can bypass the paint wrapper.
    majesty_browser_streaming_world_idle(c);
    if (majesty_browser_streaming_world_auto_load(c)) {
        // Same original thiscall RET4 completion as the existing automatic
        // checkpoint path. The outer dispatcher consumes pending phase2.
        c->eip = rd32(c->r[R_ESP]);
        c->r[R_ESP] += 8;
        return;
    }
    const Region &r = region();
    const char *automatic = recomp_env("RULE_FRONTIER_RESTORE");
    const uint32_t state = rd32(0x006d7670);
    // Enter before the original front-end's modal menu loop, never from a
    // paint callback inside it. One attempt per engine instance avoids loops
    // after returning to the menu or finding a new region without a save.
    if (r.enabled && !restore_attempted && automatic && !std::strcmp(automatic, "1") && state &&
        gm_valid(state, 0x50) && rd32(state) == 1 && rd32(state + 0xc) == c->r[R_ECX]) {
        restore_attempted = true;
        std::string checkpoint_name;
        if (!active_checkpoint(c, r, checkpoint_name)) {
            std::fprintf(stderr, "[frontier] Region %s checkpoint content unavailable\n",
                         r.key.c_str());
            fn_00490fc0(c);
            return;
        }
        std::fprintf(stderr, "[frontier] Region %s restoring checkpoint\n", r.key.c_str());
        if (restore_checkpoint(c, checkpoint_name, state)) {
            if (session_enabled()) {
                std::string name; uint32_t seed = 0, game_seed = 0;
                if (session_admit(r, name, seed, game_seed) != SessionAdmission::saved) std::abort();
                region_session().pending_seed = seed; region_session().pending_game_seed = game_seed;
            }
            std::fprintf(stderr, "[frontier] Region %s checkpoint restored\n", r.key.c_str());
            // Original 00490fc0 is thiscall with one argument and RET 4.
            c->eip = rd32(c->r[R_ESP]);
            c->r[R_ESP] += 8;
            return;
        }
        std::fprintf(stderr, "[frontier] Region %s checkpoint unavailable\n", r.key.c_str());
    }
    fn_00490fc0(c);
}

extern "C" void majesty_browser_frontier_frame(X86 *c) {
  const Region &r = region();
  if (!r.enabled || saving || finished)
    return;
  const uint32_t world = rd32(0x0071c68c), state = rd32(0x006d7670);
  // 00415e40 dispatches gameplay in phase 3 (7/8 are paused overlays).
  if (!world || !state || !gm_valid(world, 0x14) || !gm_valid(state, 0x50) ||
      rd32(state) != 3 || !rd32(world + 4))
    return;
  // Separate native checkpoints currently support solo worlds only.
  // Network regions need a replicated handoff and coordinated save/load.
  // Original autosave 00417730 uses this manager's +0x218 mode to
  // exclude network worlds (2), including a host with no guest yet.
  const uint32_t manager = rd32(0x006d8568);
  if (manager && gm_valid(manager, 0x21c) && rd32(manager + 0x218) == 2) {
    if (!network_blocked)
      std::fprintf(stderr, "[frontier] Network region handoff unavailable\n");
    network_blocked = true;
    return;
  }
  network_blocked = false;
  auto &hero=selected_hero_binding();
  if(hero.enabled&&!hero.admitted){
    // Presentation can reach this frame wrapper inside another guest call.
    // Wait for the outer complete boundary before reading the registered actor.
    if(rd32(state+4)||mods_hook_depth()||!sched_holds_baton()||
        c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    if(!hero.failed&&hero.source_checked){
      session_ui_restore.end();
      if(!session_restore_empty_profile_name(c)||!session_restore_rng(c,hero.gpl_seed,hero.game_seed))std::abort();
    }
  }
#ifndef __EMSCRIPTEN__
  if(halo_reload_enabled() && halo_reload.pending) {
    const uint32_t context=rd32(world+4);
    if(halo_reload.captured||rd32(0x0071c6a8)!=halo_reload.saved_clock||
       !halo_reload_terrain(context)||connected_boundary_policy.terrain!=rd32(context+0x80))std::abort();
    session_ui_restore.end();
    if(!session_restore_empty_profile_name(c)||
       !session_restore_rng(c,halo_reload.seed,halo_reload.game_seed))std::abort();
    const bool session = halo_session_fixture();
    const std::string label = session ? "Halo_Session_Reloaded_" + std::to_string(region_session().serial) : "Halo_Region_Reloaded";
    if(!joint_fixture_checkpoint(c,label,session?"BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT":"BROWSER_FRONTIER_HALO_RELOAD_SNAPSHOT",r.key.c_str(),
        session?"actor-arrival-fixture-halo-world-session-":"actor-arrival-fixture-halo-world-"))std::abort();
    if (session) {
      auto &s = region_session();
      if (s.pending_seed != halo_reload.seed || s.pending_game_seed != halo_reload.game_seed) std::abort();
      std::fprintf(stderr,"[frontier] Session rng restored region=%s gpl=%u game=%u clock=%u\n",
          r.key.c_str(),s.pending_seed,s.pending_game_seed,rd32(0x0071c6a8));
      s.pending_seed = s.pending_game_seed = 0;
    }
    halo_reload.pending=false;halo_reload.captured=true;
    std::fprintf(stderr,"[frontier] Halo restore ready key=%s layout=halo-v1 clock=%u shared-vertices=2480 ui-restored=1 rng-restored=1 original-reader=1 original-writer=1 source-sha256=%s result=pass\n",r.key.c_str(),rd32(0x0071c6a8),halo_reload.source_digest.c_str());
  }
  if (halo_session_fixture() && !announced && !halo_reload.captured) {
    // A truly absent neighbour uses the existing original fresh-world path.
    // Publish its geometry only after complete gameplay attachment, before
    // its first tick. Revisited regions always take the bound restore path.
    const uint32_t context = rd32(world+4);
    if (halo_reload.pending || rd32(0x0071c6a8) || !halo_reload_terrain(context) ||
        connected_boundary_policy.terrain != rd32(context+0x80) ||
        !joint_fixture_checkpoint(c,"Halo_Session_Generated_" + std::to_string(region_session().serial),
            "BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT",r.key.c_str(),"actor-arrival-fixture-halo-world-session-")) std::abort();
    saving = true; const bool saved = checkpoint(c,r,world); saving = false;
    if (!saved) std::abort();
    halo_reload.captured = true;
    std::fprintf(stderr,"[frontier] Halo session generated ready serial=%llu key=%s clock=0 shared-vertices=2480 ordinary-ticks=0 original-generator=1 original-writer=1 layout-bound=1 result=pass\n",
        (unsigned long long)region_session().serial,r.key.c_str());
  }
#endif
  if(halo_terrain_fixture()) {
    static bool captured=false;
    const char *snapshot=recomp_env("BROWSER_FRONTIER_HALO_SNAPSHOT");
    if(!captured&&snapshot&&!std::strcmp(snapshot,"1")) {
      const uint32_t context=rd32(world+4);
      if(!gm_valid(context,0x84)||connected_boundary_policy.terrain!=rd32(context+0x80)||
         !joint_fixture_checkpoint(c,"Halo_Region_Saved","BROWSER_FRONTIER_HALO_SNAPSHOT",r.key.c_str(),"actor-arrival-fixture-halo-world-"))std::abort();
      captured=true;
      std::fprintf(stderr,"[frontier] Halo region saved key=%s layout=halo-v1 native-cells=128 core-cells=124 halo-cells=2 origin-cells=%lld,%lld clock=%u fresh-generation=1 original-writer=1 result=pass\n",r.key.c_str(),(long long)connected_origin(r.x),(long long)connected_origin(r.y),rd32(0x0071c6a8));
    }
    // A second immutable save captures ordinary play and player recruitment.
    // The private controller supplies real UI input; this does not create,
    // reposition, pause or edit any hero or its original AI.
    static bool evolved_captured=false;
    const char *evolved=recomp_env("BROWSER_FRONTIER_HALO_EVOLVED_SNAPSHOT");
    if(evolved) {
      if(std::strcmp(evolved,"1"))std::abort();
      const uint32_t clock=rd32(0x0071c6a8),context=rd32(world+4);
      if(!evolved_captured&&clock>=20000) {
        if(!captured||!gm_valid(context,0x84)||connected_boundary_policy.terrain!=rd32(context+0x80)||
           !joint_fixture_checkpoint(c,"Halo_Region_Evolved","BROWSER_FRONTIER_HALO_EVOLVED_SNAPSHOT",r.key.c_str(),"actor-arrival-fixture-halo-world-"))std::abort();
        evolved_captured=true;
        std::fprintf(stderr,"[frontier] Halo evolved saved key=%s layout=halo-v1 clock=%u original-writer=1 ordinary-simulation=1 result=pass\n",r.key.c_str(),clock);
      }
    }
  }
  if (session_enabled()) {
    auto &s = region_session();
    session_ui_restore.end();
    if (s.pending_seed || s.pending_game_seed) {
      if (!session_restore_empty_profile_name(c)) std::abort();
      if (!session_restore_rng(c, s.pending_seed, s.pending_game_seed)) std::abort();
      std::fprintf(stderr, "[frontier] Session rng restored region=%s gpl=%u game=%u clock=%u\n",
          r.key.c_str(), s.pending_seed, s.pending_game_seed, rd32(0x0071c6a8));
      s.pending_seed = 0; s.pending_game_seed = 0;
    }
#ifndef __EMSCRIPTEN__
    const char *before_camera = recomp_env("BROWSER_FRONTIER_SESSION_CAMERA_SNAPSHOT_FIXTURE");
    if (before_camera && !std::strcmp(before_camera, "v1") && !announced) {
      static uint64_t captured_serial = UINT64_MAX;
      const char *requests = recomp_env("BROWSER_FRONTIER_SESSION_REQUEST_FIXTURE");
      const char *ready = recomp_env("BROWSER_FRONTIER_SESSION_READY_SNAPSHOT_FIXTURE");
      if (!requests || std::strcmp(requests, "v1") || !ready || std::strcmp(ready, "v1") ||
          !s.crossing_enabled || s.root.find("/actor-arrival-fixture-session-") == s.root.npos ||
          !s.root.ends_with("/native-world-restoration") || s.serial > 64 ||
          s.stage != RegionSession::Stage::idle || s.completed_ticks || rd32(state + 4) ||
          mods_hook_depth() || !sched_holds_baton() || c->r[R_ESP] < STACK_LIMIT + 65536 ||
          c->r[R_ESP] > STACK_TOP) std::abort();
      if (captured_serial != s.serial) {
        const auto camera = session_camera_read(c);
        if (!camera.valid) return;
        const uint32_t clock = rd32(0x0071c6a8), hooks = mods_hooks_installed_count();
        X86 extra = *c; extra.r[R_ESP] -= 32768;
        // A unique original full save survives the immediate Ready checkpoint.
        // The fixture retains no old-world pointer or in-memory snapshot.
        saving = true;
        const bool saved = write_checkpoint(&extra, "Frontier_Restored_" + std::to_string(s.serial), world);
        saving = false;
        const auto after = session_camera_read(c);
        if (!saved || rd32(0x0071c68c) != world || rd32(0x0071c6a8) != clock ||
            rd32(state) != 3 || rd32(state + 4) || mods_hooks_installed_count() != hooks ||
            !after.valid || after.camera != camera.camera || after.x != camera.x || after.y != camera.y)
          std::abort();
        captured_serial = s.serial;
        std::fprintf(stderr, "[frontier] Session restored snapshot serial=%llu region=%s clock=%u "
            "before-arrival=1 ordinary-ticks=0 guards=0 world-same=1 hooks-same=1 "
            "camera-x=%lld camera-y=%lld saved=1\n", (unsigned long long)s.serial,
            r.key.c_str(), clock, (long long)camera.x, (long long)camera.y);
      }
    }
#endif
    if (!session_camera_arrival(c)) return;
  }
  if (!announced) {
    if(!selected_hero_ready(c))return;
#ifndef __EMSCRIPTEN__
    if (pending_border_probe.handle) {
      auto &p = pending_border_probe;
      if (p.world != rd32(world + 4) || mods_hook_remove(MODS_OWNER_RUNTIME,p.handle) != POP_OK) std::abort();
      if (p.watched) {
        if (g_watch_base != p.watched || g_watch_len != 4) std::abort();
        g_watch_len = 0; g_watch_base = 0;
        std::fprintf(stderr,"[frontier] Initialization height watch region=%s vertex=32,0 after=%d armed=0\n",
            r.key.c_str(),int32_t(rd32(p.watched)));
      }
      std::fprintf(stderr,"[frontier] Initialization border observer region=%s events=%u removed=1\n",r.key.c_str(),p.events);
      p = {};
    }
#endif
    announced = true;
    std::fprintf(stderr, "[frontier] Region %s ready\n", r.key.c_str());
#ifndef __EMSCRIPTEN__
    // The multi-kingdom qualification captures the original complete writer
    // before any resumed gameplay. Keep the probe confined to a disposable
    // requested-travel profile; ordinary/browser sessions do no extra I/O.
    const char *ready_snapshot = recomp_env("BROWSER_FRONTIER_SESSION_READY_SNAPSHOT_FIXTURE");
    if (ready_snapshot && !std::strcmp(ready_snapshot,"v1")) {
      const auto &s = region_session();
      const char *requests = recomp_env("BROWSER_FRONTIER_SESSION_REQUEST_FIXTURE");
      if (!session_enabled() || !requests || std::strcmp(requests,"v1") ||
          s.root.find("/actor-arrival-fixture-session-") == s.root.npos ||
          !s.root.ends_with("/native-world-restoration") || s.serial > 64 ||
          s.stage != RegionSession::Stage::idle || s.completed_ticks ||
          s.pending_seed || s.pending_game_seed || rd32(state + 4) ||
          mods_hook_depth() || !sched_holds_baton()) std::abort();
      const uint32_t clock = rd32(0x0071c6a8), hooks = mods_hooks_installed_count();
      saving = true; const bool saved = checkpoint(c,r,world); saving = false;
      if (!saved || rd32(0x0071c68c) != world || rd32(0x0071c6a8) != clock ||
          rd32(state) != 3 || rd32(state + 4) || mods_hooks_installed_count() != hooks) std::abort();
      std::fprintf(stderr,"[frontier] Session ready snapshot serial=%llu region=%s clock=%u ordinary-ticks=0 guards=0 world-same=1 hooks-same=1 saved=1\n",
          (unsigned long long)s.serial,r.key.c_str(),clock);
    }
    // Recovery qualification observes ordinary startup before its first update.
    // Only the owned fresh process can request this original-writer snapshot;
    // it installs no actor/command guard and never changes gameplay phase.
    const char *recovery = recomp_env("BROWSER_FRONTIER_RECOVERY_SNAPSHOT_FIXTURE");
    if (recovery && !std::strcmp(recovery,"v1")) {
      const auto &s = region_session();
      if (!session_enabled() || r.key != "0_0" || s.serial || s.stage != RegionSession::Stage::idle ||
          s.root.find("/actor-arrival-fixture-session-recovery-") == s.root.npos ||
          !s.root.ends_with("/native-world-recovery") || s.pending_seed || s.pending_game_seed ||
          rd32(state + 4) || mods_hook_depth() || !sched_holds_baton()) std::abort();
      saving = true; const bool saved = checkpoint(c,r,world); saving = false;
      if (!saved) std::abort();
      std::fprintf(stderr,"[frontier] Recovery ready snapshot region=0_0 clock=%u ordinary-ticks=0 actor-guards=0 saved=1\n",rd32(0x0071c6a8));
    }
#endif

    majesty_browser_inventory_audit(c);
    majesty_browser_streaming_factory_fixture(c);
    majesty_browser_streaming_restore_fixture(c);
    majesty_browser_streaming_unit_fixture(c);
    majesty_browser_streaming_agent_fixture(c);
    majesty_browser_streaming_pair_fixture(c);
    majesty_browser_streaming_joint_reload_fixture(c);
    majesty_browser_streaming_live_fixture(c);
    majesty_browser_streaming_arrival_fixture(c);
    if (majesty_browser_streaming_departure_fixture(c)) {
      saving = true;
      const bool saved = checkpoint(c, r, world);
      saving = false;
      std::fprintf(stderr, "[frontier] Departure source checkpoint saved=%u\n",
                   unsigned(saved));
    }
    majesty_browser_streaming_departure_reload_fixture(c);
    majesty_browser_streaming_arrival_persist_reload_fixture(c);
    if (transfer_requested())
      majesty_browser_streaming_transfer_reload(
          c, transfer_selected_moved, r.key == TransferStore::region_key(1));
  }
  // Keep this isolated actor trial out of the checkpoint writer until it has
  // completed or explicitly failed. It observes original simulation ticks.
  majesty_browser_streaming_joint_motion_tick(c);
  if (majesty_browser_streaming_live_tick(c))
    return;
  if (majesty_browser_streaming_take_arrival_checkpoint()) {
    saving = true;
    const bool saved = checkpoint(c, r, world);
    saving = false;
    std::fprintf(stderr, "[frontier] Arrival destination checkpoint saved=%u\n",
                 unsigned(saved));
  }
  // Avoid a synchronous browser-main-thread round trip on every game frame.
  const uint64_t now = os_monotonic_ns();
  if (now - last_poll < 100000000u)
    return;
  last_poll = now;
  if(selected_hero_binding().enabled&&selected_hero_binding().admitted)return;
  if (!os_browser_take_action("frontier-checkpoint"))
    return;
  saving = true;
  // The inactive GMP is written first. A verified manifest rename is the
  // only publication point, leaving the previous world intact on failure.
  const bool saved = checkpoint(c, r, world);
  saving = false;
  std::fprintf(stderr, "[frontier] Region %s checkpoint %s\n", r.key.c_str(),
               saved ? "saved" : "failed");
}
extern "C" void majesty_browser_coop_rebuild(X86 *c) {
#ifndef __EMSCRIPTEN__
  if (native_coop_phase2_readback.rebuild(c)) return;
#endif
  if (coop_load.stage == CoopLoadCoordinator::Stage::attaching) {
    // This entry is dispatched by the original phase2 outer loop. Refusing
    // before its body still requires the original call's plain return.
    if (!majesty::coop_outer_rebuild_boundary(c) ||
        c->r[R_ECX] != coop_load.state) std::abort();
    const auto boundary = [&] {
      recomp_network_barrier_v1 barrier{};
      return c && sched_holds_baton() && coop_load.roots() &&
          coop_load.agreement(barrier) && barrier.stage == 2 &&
          rd32(coop_load.state) == 2 &&
          (rd32(coop_load.state + 4) == 0 || rd32(coop_load.state + 4) == 3) &&
          rd32(0x0071c6a8) == coop_load.target.target_clock;
    };
    CoopRebuildLoadingScope loading(boundary);
    if (!loading.install()) {
      coop_load.fail(c, "rebuild-loading-admission");
      if (!majesty::coop_complete_outer_rebuild(c)) std::abort();
      return;
    }
    if (coop_load.target.target_saved)
      session_ui_restore.begin(coop_load.context, &boundary, [](const void *p) {
        return (*static_cast<const decltype(boundary) *>(p))();
      }, coop_load.party.host != 0);
    fn_00416c30(c);
    if (coop_load.target.target_saved) session_ui_restore.end();
    if (!loading.completed()) {
      coop_load.fail(c, "rebuild-loading-restoration");
      return;
    }
  } else fn_00416c30(c);
  coop_load.rebuilt(c);
#ifndef __EMSCRIPTEN__
  coop_rebuild_fixture.rebuilt(c);
#endif
}
extern "C" void majesty_browser_streaming_halo_homeward_after_tick(X86 *);
#ifndef __EMSCRIPTEN__
// Owned restart-to-visited-neighbor trial: original movement and production
// crossing, save, retirement, load and publication own the actual handoff.
static bool selected_remote_backtrack_test(X86 *c) {
  const char *flag=recomp_env("BROWSER_FRONTIER_HERO_REMOTE_BACKTRACK_TEST");if(!flag)return false;
  const char *raw=recomp_env("PROFILE_DIR");const std::string profile(raw?raw:"");
  if(std::strcmp(flag,"v1")||profile.find("/actor-arrival-fixture-hero-binding-")==profile.npos)std::abort();
  static unsigned stage=0,completed=0;static uint32_t initial_clock=0,arrival_clock=0;
  unsigned crossings=1;
  if(const char *count=recomp_env("BROWSER_FRONTIER_HERO_REMOTE_BACKTRACK_CROSSINGS")){
    const auto end=count+std::strlen(count);const auto parsed=std::from_chars(count,end,crossings);
    if(parsed.ec!=std::errc{}||parsed.ptr!=end||crossings<1||crossings>8||std::to_string(crossings)!=count)std::abort();
  }
  const char *source=completed%2?"-4_-1":"-5_-1",*target=completed%2?"-5_-1":"-4_-1";
  auto &b=selected_hero_binding();const uint32_t state=rd32(0x006d7670),clock=rd32(0x0071c6a8);
  if(!b.admitted||!gm_valid(state,8)||!sched_holds_baton()||mods_hook_depth())return false;
  const uint32_t phase=rd32(state),pending=rd32(state+4);
  auto transition=[&](uint32_t next){X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;guest_call(&extra,0x00416050u,next);
    if(rd32(state)!=phase||rd32(state+4)!=next||rd32(0x0071c6a8)!=clock)std::abort();};
  if(!stage){
    if(phase!=3||pending||b.key!=source||!b.proxy_home||b.closed)return false;
    initial_clock=clock;transition(7);stage=1;return true;
  }
  if(stage==1){
    if(phase==3&&pending==7)return true;
    const std::string label=crossings==1?"Hero_Remote_Return_Routed":"Hero_Remote_Return_Routed_"+std::to_string(completed+1);
    if(phase!=7||pending||clock!=initial_clock||b.key!=source||
       !majesty_browser_streaming_route_hero_home(c,completed%2?32u:4064u,2048)||
       !joint_fixture_checkpoint(c,label.c_str(),"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",b.key.c_str(),"actor-arrival-fixture-hero-binding-"))std::abort();
    transition(3);stage=2;return true;
  }
  if(stage==2){
    if(phase==7&&pending==3)return true;
    if(phase!=3||pending||clock!=initial_clock||b.key!=source)std::abort();
    stage=3;std::fprintf(stderr,"[frontier] Remote backtrack route started source=%s target=%s clock=%u original-command=1 pose-written=0\n",source,target,clock);
  }
  if(stage==3){
    if(b.key!=target||b.closed||selected_hero_travel.stage!=SelectedHeroTravel::Stage::idle)return false;
    if(!arrival_clock)arrival_clock=b.save_clock;
    if(phase!=3||pending||clock<arrival_clock+300)return false;
    if(clock!=arrival_clock+300)std::abort();transition(7);stage=4;return true;
  }
  if(stage==4){
    if(phase==3&&pending==7)return true;
    const std::string label=crossings==1?"Hero_Remote_Return_Played":"Hero_Remote_Return_Played_"+std::to_string(completed+1);
    if(phase!=7||pending||clock!=arrival_clock+300||b.key!=target||
       !joint_fixture_checkpoint(c,label.c_str(),"BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT",b.key.c_str(),"actor-arrival-fixture-hero-binding-"))std::abort();
    stage=5;++completed;std::fprintf(stderr,"[frontier] Remote backtrack gameplay held region=%s unit=%u agent=%u proxy=%u from-clock=%u clock=%u ticks=6 original-gameplay=1 phase=7 pending=0 result=pass\n",b.key.c_str(),b.values[1],b.values[2],b.values[6],arrival_clock,clock);
    std::fprintf(stderr,"[frontier] Remote backtrack cycle held serial=%u region=%s from-clock=%u clock=%u completed=%u target=%u phase=7 pending=0 result=pass\n",b.save_serial,b.key.c_str(),arrival_clock,clock,completed,crossings);
  }
  if(stage==5){
    if(completed<crossings&&phase==7&&!pending&&
       selected_hero_small_text(profile+"/Frontier_Hero_Backtrack_Continue.txt",128)=="majesty-remote-backtrack-continue-v1|"+std::to_string(completed)+"\n"){
      initial_clock=arrival_clock=0;transition(3);stage=0;return true;
    }
    // Keep the original paused input/message pump alive while holding the
    // observed clock. Otherwise the owned smoke host cannot close normally.
    if(phase==7&&!pending){fn_00417730(c);
      if(rd32(state)==7&&!rd32(state+4)&&rd32(0x0071c6a8)!=arrival_clock+300)std::abort();}
    return true;
  }
  return false;
}
#endif
extern "C" void majesty_browser_frontier_tick(X86 *c) {
  majesty_browser_streaming_hero_arrival_lifecycle();
#ifndef __EMSCRIPTEN__
  if (native_coop_readback_before_tick(c)) return;
  native_coop_world_snapshot(c);
  native_coop_target_snapshot(c);
  native_coop_target_progress_snapshot(c);
  if (native_coop_readback_before_tick(c)) return;
  if(selected_remote_backtrack_test(c))return;
#endif
#ifndef __EMSCRIPTEN__
  static uint32_t remote_restore_trace_count=0;bool remote_restore_trace=false;
  const char *remote_restore_test=recomp_env("BROWSER_FRONTIER_HERO_REMOTE_RESTORE_TEST"),*remote_restore_profile=recomp_env("PROFILE_DIR");
  const std::string_view remote_restore_path(remote_restore_profile?remote_restore_profile:"");
  if(remote_restore_trace_count<4&&remote_restore_test&&!std::strcmp(remote_restore_test,"v1")&&
     remote_restore_path.find("/actor-arrival-fixture-hero-binding-")!=remote_restore_path.npos&&
     remote_restore_path.ends_with("/frontier_-5_-1")&&selected_hero_binding().admitted){
    remote_restore_trace=true;++remote_restore_trace_count;
    const uint32_t state=rd32(0x006d7670),settings=rd32(0x006d87a0);
    if(gm_valid(state,8)&&gm_valid(settings,0x70))std::fprintf(stderr,
        "[frontier] Remote restore tick entry sample=%u phase=%u pending=%u clock=%u loading=%u before-original=1\n",
        remote_restore_trace_count,rd32(state),rd32(state+4),rd32(0x0071c6a8),rd32(settings+0x6c));
  }
#endif
#ifndef __EMSCRIPTEN__
  if(selected_hero_repeat_page_test(c))return;
  if(selected_hero_home_page_test(c))return;
#endif
  if(selected_hero_travel_before_tick(c))return;
#ifndef __EMSCRIPTEN__
  if(hero_activation_test_before_tick(c))return;
#endif
  // Saved cooperative worlds can fail in GPL cleanup long after generation.
  // This diagnostic reuses the bounded ring and original exception path,
  // independently of regional seeding, checkpoints or gameplay rules.
  static const bool trace_failure = [] {
    const char *value = recomp_env("TRACE_GPL_FAILURE");
    return value && !std::strcmp(value, "1");
  }();
  if (trace_failure) {
    install_generation_trace();
    observe_inventory_bindings(c);
  }
  // 00417730 performs autosave before updating the clock, GPL threads,
  // world and message queues. 00415dd0 is later, midway through that tick;
  // a checkpoint there could mix pre-update and post-update state.
  if (coop_load_before_tick(c)) {
    if (!majesty::coop_complete_outer_tick(c)) std::abort();
    return;
  }
  if (session_home_import_reload(c)) return;
  if (session_owner_hold(c)) return;
  if (hero_home_registration_test_before_tick(c)) return;
  majesty_browser_frontier_frame(c);
  // Refused admission must not fall through to an original simulation tick.
  // Await full attachment when phase3 still has a pending dispatcher action.
  const auto &hero_binding=selected_hero_binding();
  if(hero_binding.enabled&&!hero_binding.admitted){
    const uint32_t state=rd32(0x006d7670);
    if(hero_binding.failed&&gm_valid(state,0x50)&&!mods_hook_depth()&&sched_holds_baton()&&
       c->r[R_ESP]>=STACK_LIMIT+65536&&c->r[R_ESP]<=STACK_TOP){
      if(rd32(state)==3&&!rd32(state+4)){
        // A failed binding must still allow original paused input and Exit
        // Game. Request the normal dispatcher transition before any update.
        const uint32_t clock=rd32(0x0071c6a8);
        X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=state;
        guest_call(&extra,0x00416050u,7u);
        if(rd32(state)!=3||rd32(state+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();
      }else if(rd32(state)==7&&!rd32(state+4)){
        // Original paused ticks handle messages without advancing the world.
        const uint32_t clock=rd32(0x0071c6a8);fn_00417730(c);
        // A normal Quit Game may request phase4 and reset the clock here.
        // Only a still-paused, unchanged dispatcher must preserve its clock.
        if(rd32(state)==7&&!rd32(state+4)&&rd32(0x0071c6a8)!=clock)std::abort();
      }
    }
    return;
  }
  if(selected_hero_save_before_tick(c))return;
#ifndef __EMSCRIPTEN__
  if(halo_hero_before_tick(c))return;
#endif
  if (session_home_import_reload(c)) return;
  if (session_owner_hold(c)) return;
  if (region_session().arrival_pending) return; // Await a validated camera before the first tick.
  // Native-only generated-region initialization publishes the fully attached
  // world and asks the original dispatcher to unload before any gameplay tick.
  // Default gameplay and every browser build retain the original tick below.
  if (majesty_browser_streaming_world_initialization_exit(c))
    return;
#ifndef __EMSCRIPTEN__
  const uint32_t tick_state = rd32(0x006d7670);
  const bool gameplay_tick = gm_valid(tick_state, 0x50) && rd32(tick_state) == 3;
  coop_rebuild_fixture.before_tick(c);
#endif
  selected_hero_motion_before_tick(c);
  fn_00417730(c);
#ifndef __EMSCRIPTEN__
  if(remote_restore_trace)std::fprintf(stderr,"[frontier] Remote restore tick body sample=%u clock=%u original-body-returned=1\n",
      remote_restore_trace_count,rd32(0x0071c6a8));
  hero_activation_test_after_tick(c);
#endif
  selected_hero_motion_after_tick(c);
  if(selected_hero_binding().save_stage==SelectedHeroBinding::SaveStage::held){
    const uint32_t state=rd32(0x006d7670);
    if(gm_valid(state,8)&&rd32(state)==7&&!rd32(state+4)&&rd32(0x0071c6a8)!=selected_hero_binding().save_clock)std::abort();
  }
  majesty_browser_streaming_halo_homeward_after_tick(c);
#ifndef __EMSCRIPTEN__
  halo_hero_after_tick(c);
#endif
  if (CoopLoadCoordinator::enabled()) coop_load.service(c);
#ifndef __EMSCRIPTEN__
  if (gameplay_tick && session_enabled() && region_session().completed_ticks < UINT32_MAX)
    ++region_session().completed_ticks;
  if (session_enabled())
    majesty_browser_streaming_session_queue_observe(c, region_session().serial);
  coop_rebuild_fixture.after_tick(c);
#endif
  session_tick(c);
  // Native residency saves after the complete original tick, before the
  // dispatcher can consume a pending exit. It is disabled in browser builds.
  majesty_browser_streaming_world_completed_tick(c);
  majesty_browser_streaming_palace_death_fixture(c);
}
extern "C" void majesty_browser_frontier_idle(X86 *c) {
#ifndef __EMSCRIPTEN__
  native_coop_initialization_seed.install();
#endif
  majesty_browser_streaming_hero_arrival_lifecycle();
  if (!region().enabled || (!announced && !finished) || saving)
    return;
  const uint32_t state = rd32(0x006d7670);
  if (state && gm_valid(state, 4)) {
    const uint32_t phase = rd32(state);
    if (phase == 3 || phase == 7 || phase == 8)
      return;
  }
  announced = false;
  if(selected_hero_binding().admitted)selected_hero_binding().closed=true;
  selected_hero_save_abandon();
  finished = false;
  last_poll = 0;
  os_browser_take_action("frontier-checkpoint");
  std::fprintf(stderr, "[frontier] Region not playing\n");
}

extern "C" void majesty_browser_frontier_result(uint32_t player, uint32_t won) {
  const Region &r = region();
  const uint32_t state = rd32(0x006d7670), world = rd32(0x0071c68c);
  if (!r.enabled || finished || !state || !gm_valid(state, 0x50) || !world ||
      !gm_valid(world, 8) || !rd32(world + 4))
    return;
  // Original 00482c50 compares its player argument with state+0x24 before
  // opening the local result screen. NPC and remote outcomes do not end it.
  const uint32_t phase = rd32(state);
  if (player != rd32(state + 0x24) || (phase != 3 && phase != 7 && phase != 8))
    return;
  const uint32_t manager = rd32(0x006d8568);
  if (manager && gm_valid(manager, 0x21c) && rd32(manager + 0x218) == 2)
    return;
  finished = true;
  if(selected_hero_binding().admitted)selected_hero_binding().closed=true;
  selected_hero_save_abandon();
  // Consume an already queued request and never publish a pending identity
  // or touch the previous GMP after the original quest has settled.
  os_browser_take_action("frontier-checkpoint");
  std::fprintf(stderr, "[frontier] Region %s %s\n", r.key.c_str(),
               won ? "completed" : "defeated");
}

extern "C" void majesty_browser_frontier_resume(X86 *) {
  const Region &r = region();
  const uint32_t state = rd32(0x006d7670), world = rd32(0x0071c68c);
  // Original 00416c30 selects the local kingdom through 004169a0 while
  // rebuilding a freshly attached world in phase 2. Ordinary kingdom/camera
  // selection must never clear a result latch in phases 3/7/8. Modal menu
  // paint alone is insufficient: original Load Game can bypass that callback.
  if (!r.enabled || !state || !gm_valid(state, 0x50) || rd32(state) != 2 ||
      !world || !gm_valid(world, 8) || !rd32(world + 4))
    return;
  const uint32_t manager = rd32(0x006d8568);
  if (manager && gm_valid(manager, 0x21c) && rd32(manager + 0x218) == 2)
    return;
  if (finished) {
    os_browser_take_action("frontier-checkpoint");
    std::fprintf(stderr, "[frontier] Region %s playable world attached\n",
                 r.key.c_str());
  }
  finished = false;
  announced = false;
  last_poll = 0;
}
