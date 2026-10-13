// Observe the original unit serialization boundary before introducing region
// handoffs. This is a bounded opt-in trace, not a replacement serializer.
#include "mods/mods_internal.h"
#include "native_actor_stage.h"
#include "native_order_hooks.h"
#include "native_order_payload.h"
#include "platform/os.h"
#include "runtime/guest.h"
#include "runtime/loader.h"
#include "runtime/checkpoint_store.h"
#include <cerrno>
#include "runtime/memory.h"
#include "runtime/win32.h"
#include "runtime/native_seam.h"
#include <array>
#include <chrono>
#include <charconv>
#include <cstdio>
#include <cstring>
#include <memory>
#include <string_view>

extern "C" void fn_00435610(X86 *);
extern "C" void fn_004354d0(X86 *);
extern "C" void fn_005bfe50(X86 *);
extern "C" void fn_005c0bd0(X86 *);
extern "C" bool majesty_browser_frontier_joint_checkpoint(X86 *, bool);
extern "C" bool majesty_browser_frontier_joint_departure_checkpoint(X86 *, bool);
extern "C" bool majesty_browser_frontier_home_motion_checkpoint(X86 *, uint32_t);
extern "C" bool majesty_browser_frontier_joint_schedule_checkpoint(X86 *, bool);
extern "C" bool majesty_browser_frontier_joint_departed_reload_checkpoint(X86 *);
extern "C" bool majesty_browser_frontier_residency_restore(X86 *);
extern "C" bool majesty_browser_frontier_residency_region(X86 *, int32_t, int32_t, bool);
extern "C" void majesty_browser_campaign_building_fixture(X86 *);
extern "C" bool majesty_browser_frontier_joint_return_checkpoint(X86 *);
extern "C" bool majesty_browser_frontier_joint_evolved_checkpoint(X86 *);
extern "C" bool majesty_browser_frontier_registered_hero_checkpoint(X86 *);
extern "C" bool majesty_browser_frontier_registered_hero_reload_checkpoint(X86 *);
extern "C" bool majesty_browser_frontier_registered_hero_live_checkpoint(X86 *, bool);
extern "C" bool majesty_browser_frontier_regional_hero_checkpoint(X86 *);
extern "C" bool majesty_browser_frontier_registered_hero_departure_checkpoint(X86 *, bool);
extern "C" bool majesty_browser_frontier_outdoor_family_return_checkpoint(X86 *, unsigned);
extern "C" bool majesty_browser_frontier_outdoor_family_snapshot_checkpoint(X86 *, unsigned);
extern "C" bool majesty_browser_frontier_registered_hero_pair_reload_checkpoint(X86 *, unsigned);
extern "C" bool majesty_browser_frontier_registered_hero_return_checkpoint(X86 *);
extern "C" bool majesty_browser_frontier_registered_hero_return_live_checkpoint(X86 *, bool);
extern "C" bool majesty_browser_frontier_remote_hero_departure_checkpoint(X86 *, bool);
extern "C" bool majesty_browser_frontier_hero_return_pair_reload_checkpoint(X86 *, unsigned, bool);
extern "C" bool majesty_browser_frontier_halo_bundle_checkpoint(X86 *, bool);
extern "C" bool majesty_browser_frontier_halo_source_checkpoint(X86 *, bool);
extern "C" bool majesty_browser_frontier_halo_return_checkpoint(X86 *, unsigned);
extern "C" bool majesty_browser_frontier_halo_homeward_checkpoint(X86 *, unsigned);
extern "C" bool majesty_browser_frontier_halo_homeward_owner_checkpoint(X86 *, unsigned);
extern "C" bool majesty_browser_frontier_halo_saved_home_owner_checkpoint(X86 *, unsigned);
extern "C" bool majesty_browser_frontier_halo_return_live_checkpoint(X86 *, unsigned);
extern "C" bool majesty_browser_frontier_halo_return_owner_checkpoint(X86 *, unsigned);
extern "C" bool majesty_browser_frontier_halo_east_owner_checkpoint(X86 *, unsigned);
extern "C" bool majesty_browser_frontier_halo_home_leg_checkpoint(X86 *, unsigned);
extern "C" bool majesty_browser_frontier_halo_return_source_checkpoint(X86 *, bool);

namespace {
bool enabled() {
    static const bool value = [] {
        const char *flag = recomp_env("BROWSER_STREAMING_DEBUG");
        return flag && std::strcmp(flag, "1") == 0;
    }();
    return value;
}
struct Sample {
    uint32_t self = 0, table = 0, before = 0, after = 0;
    uint32_t factory = 0, registry = 0, id = 0, kind = 0, flags = 0, parent = 0;
    int32_t player = 0, x = 0, y = 0, z = 0, map_x = 0, map_y = 0;
    uint32_t lookup = 0;
    bool readable = false, returned = false;
    bool resolved = false;
};
// The guest scheduler serializes these callbacks. Retain only the first 32
// visits; never allocate a vector proportional to a kingdom's unit count.
std::array<Sample, 32> samples{};
static_assert(sizeof samples <= 4096, "Streaming samples must remain bounded");
// A single owned vehicle candidate avoids enlarging the prefix trace to find
// units late in the vehicle group. This is not a hero identity classification.
Sample owned_vehicle{};
uint64_t visits = 0;
bool active = false;
void connected_transform_observers_begin();
void connected_transform_observers_end();

bool browser_actor_fixture(bool destination) {
#ifdef __EMSCRIPTEN__
    const char *profile = recomp_env("PROFILE_DIR");
    const char *selected = recomp_env("RULE_FRONTIER_REGION");
    return profile && selected &&
           !std::strcmp(profile, destination ? "/opfs/majesty/profile/frontier_999912_999914"
                                             : "/opfs/majesty/profile/frontier_999913_999914") &&
           !std::strcmp(selected, destination ? "999912_999914" : "999913_999914");
#else
    return false;
#endif
}

bool isolated_fixture() {
    const char *profile = recomp_env("PROFILE_DIR");
    const char *selected = recomp_env("RULE_FRONTIER_REGION");
    std::string_view path(profile ? profile : "");
    constexpr std::string_view suffix = "/frontier_0_0";
    if (path.ends_with(suffix))
        path.remove_suffix(suffix.size());
    else
        path = {};
    const size_t slash = path.rfind('/');
    const std::string_view name = slash == path.npos ? std::string_view{} : path.substr(slash + 1);
    const bool native = selected && !std::strcmp(selected, "0_0") &&
                        name.starts_with("actor-arrival-fixture-") && name.size() > 22 &&
                        name.size() <= 80;
    bool browser = false;
#ifdef __EMSCRIPTEN__
    browser = profile && selected &&
              !std::strcmp(profile, "/opfs/majesty/profile/frontier_999915_999916") &&
              !std::strcmp(selected, "999915_999916");
#endif
    return enabled() && !recomp_env("RULE_FRONTIER_CHAPTER") &&
           (native || browser || browser_actor_fixture(false) || browser_actor_fixture(true));
}

void fields(Sample &sample) {
    sample.readable = sample.self && gm_valid(sample.self, 0x88);
    if (!sample.readable)
        return;
    sample.table = rd32(sample.self);
    sample.registry = rd32(sample.self + 0x84);
    sample.id = rd32(sample.self + 0x60);
    sample.kind = rd32(sample.self + 0x5c);
    sample.flags = rd32(sample.self + 0x64);
    sample.player = int32_t(rd32(sample.self + 0x70));
    sample.parent = rd32(sample.self + 0x74);
    sample.x = int32_t(rd32(sample.self + 0x48));
    sample.y = int32_t(rd32(sample.self + 0x4c));
    sample.z = int32_t(rd32(sample.self + 0x50));
}

void resolve(X86 *c, Sample &sample) {
    // Query only a successfully completed original root operation. Primary read
    // samples precede family finalization; a failed root may have destroyed them.
    // Require the audited factory layout and its live registry before lookup.
    if (!sample.readable || !sample.id || !sample.factory || sample.registry != sample.factory ||
        !gm_valid(sample.factory, 0x88))
        return;
    const uint32_t table = rd32(sample.factory);
    const uint32_t registry = rd32(sample.factory + 0x84);
    if (table != 0x00682950u || !gm_valid(table, 0x70) || !registry || !gm_valid(registry, 8) ||
        rd32(table + 0x60) != 0x0042c3d0u || rd32(table + 0x6c) != 0x005a12e0u ||
        c->r[R_ESP] < STACK_LIMIT + 1024 || c->r[R_ESP] > STACK_TOP)
        return;
    X86 extra = *c;
    extra.r[R_ESP] -= 512;
    extra.r[R_ECX] = sample.factory;
    sample.lookup = guest_call(&extra, 0x005a10d0u, sample.id);
    if (sample.lookup != sample.self || !gm_valid(sample.lookup, 0x88))
        return;
    // Original MapPosition resolves physical parents before shifting fixed
    // coordinates. Keep its output above the nested guest stack, below the
    // caller's current stack; no original registers or callback result change.
    const uint32_t output = c->r[R_ESP] - 256;
    extra.r[R_ECX] = sample.lookup;
    if (guest_call(&extra, 0x005ad740u, output) != output)
        return;
    sample.map_x = int32_t(rd32(output));
    sample.map_y = int32_t(rd32(output + 4));
    sample.resolved = true;
}

bool begin(const char *operation) {
    if (!enabled() || active)
        return false;
    active = true;
    visits = 0;
    samples = {};
    owned_vehicle = {};
    std::fprintf(stderr, "[streaming] Original %s begin\n", operation);
    return true;
}
void finish(X86 *c, const char *operation, uint32_t result, bool success) {
    active = false;
    const size_t retained = visits < samples.size() ? size_t(visits) : samples.size();
    for (size_t i = 0; i < retained; ++i) {
        Sample &sample = samples[i];
        if (success)
            resolve(c, sample);
        std::fprintf(stderr,
                     "[streaming] Unit-state visit=%zu self=%08x table=%08x "
                     "description-before=%08x description-after=%08x readable=%u "
                     "returned=%u\n",
                     i, sample.self, sample.table, sample.before, sample.after,
                     unsigned(sample.readable), unsigned(sample.returned));
        std::fprintf(stderr,
                     "[streaming] Unit-registration visit=%zu factory=%08x "
                     "registry=%08x id=%08x kind=%08x flags=%08x player=%d "
                     "parent=%08x fixed=%d,%d,%d lookup=%08x map=%d,%d "
                     "resolved=%u\n",
                     i, sample.factory, sample.registry, sample.id, sample.kind, sample.flags,
                     sample.player, sample.parent, sample.x, sample.y, sample.z, sample.lookup,
                     sample.map_x, sample.map_y, unsigned(sample.resolved));
    }
    if (success && owned_vehicle.self)
        resolve(c, owned_vehicle);
    std::fprintf(stderr,
                 "[streaming] Original %s end result=%08x visits=%llu retained=%zu "
                 "sample-bytes=%zu\n",
                 operation, result, static_cast<unsigned long long>(visits), retained,
                 sizeof samples);
}
} // namespace

extern "C" void majesty_browser_streaming_write(X86 *c) {
    // Pinned filesystem save wrapper 004359c0 dispatches this through +4.
    // Its original implementation returns BOOL in AL and consumes RET 8.
    const bool owned = begin("save");
    fn_00435610(c);
    if (owned)
        finish(c, "save", c->r[R_EAX], (c->r[R_EAX] & 0xff) != 0);
}
extern "C" void majesty_browser_streaming_read(X86 *c) {
    // Original named read reaches this higher deserialization lifecycle through
    // serializer slot +0x0c. Keep its integer result and rebuilt references.
    const bool owned = begin("load");
    if (owned) connected_transform_observers_begin();
    fn_004354d0(c);
    if (owned && c->r[R_EAX] != 0) connected_transform_observers_end();
    if (owned)
        finish(c, "load", c->r[R_EAX], c->r[R_EAX] == 0);
}
extern "C" void majesty_browser_streaming_unit_write(X86 *c) {
    // Cdecl callback 005c0bd0 receives (serializer, unit). Description key +6c
    // is independently assigned by listed 005a2120. Guest addresses are only
    // diagnostic values, never portable actor identities.
    const uint32_t self = gm_valid(c->r[R_ESP], 12) ? rd32(c->r[R_ESP] + 8) : 0;
    const bool observing = active;
    const uint64_t visit = observing ? visits++ : 0;
    if (observing && visit < samples.size()) {
        Sample &sample = samples[size_t(visit)];
        sample.self = self;
        fields(sample);
        sample.factory = sample.registry;
        if (sample.readable) {
            sample.table = rd32(self);
            sample.before = rd32(self + 0x6c);
        }
    }
    fn_005c0bd0(c);
    if (observing && visit < samples.size()) {
        Sample &sample = samples[size_t(visit)];
        sample.returned = true;
        if (sample.readable && gm_valid(self, 0x84))
            sample.after = rd32(self + 0x6c);
    }
}
extern "C" void majesty_browser_streaming_unit_read(X86 *c) {
    // 005c1f30 calls the primary reader with (serializer, factory, output).
    // 005bfe50 allocates the unit through the factory and writes it to output
    // at 005c0add. ECX contains the callback address, not a live unit pointer.
    const uint32_t output = gm_valid(c->r[R_ESP], 16) ? rd32(c->r[R_ESP] + 12) : 0;
    const uint32_t factory = gm_valid(c->r[R_ESP], 16) ? rd32(c->r[R_ESP] + 8) : 0;
    const bool observing = active;
    const uint64_t visit = observing ? visits++ : 0;
    fn_005bfe50(c);
    if (observing && !owned_vehicle.self && output && gm_valid(output, 4)) {
        Sample candidate{};
        candidate.self = rd32(output);
        candidate.factory = factory;
        fields(candidate);
        if (candidate.readable && candidate.kind == 1 && candidate.player == 0 &&
            (candidate.flags & 0x304u) == 0x200u) {
            candidate.after = rd32(candidate.self + 0x6c);
            candidate.returned = true;
            owned_vehicle = candidate;
        }
    }
    if (observing && visit < samples.size()) {
        Sample &sample = samples[size_t(visit)];
        sample.returned = true;
        const uint32_t self = output && gm_valid(output, 4) ? rd32(output) : 0;
        sample.self = self;
        sample.factory = factory;
        fields(sample);
        if (sample.readable) {
            sample.table = rd32(self);
            sample.after = rd32(self + 0x6c);
        }
    }
}

extern "C" void majesty_browser_streaming_factory_fixture(X86 *c) {
    // This mutates only an explicitly opted-in, isolated test world.
    // It is not a production arrival path and never writes a checkpoint.
    static bool attempted = false;
    const char *flag = recomp_env("BROWSER_STREAMING_FACTORY_FIXTURE");
    if (attempted || !flag || std::strcmp(flag, "1"))
        return;
    attempted = true;
    if (!isolated_fixture()) {
        std::fprintf(stderr, "[streaming] Factory fixture skipped: isolated profile required\n");
        return;
    }
    const uint32_t world = rd32(0x0071c68cu);
    const uint32_t factory = world && gm_valid(world, 0x14) ? rd32(world + 0x10) : 0;
    if (!factory || !gm_valid(factory, 0x88) || rd32(factory) != 0x00682950u ||
        c->r[R_ESP] < STACK_LIMIT + 1024 || c->r[R_ESP] > STACK_TOP) {
        std::fprintf(stderr, "[streaming] Factory fixture failed: original world unavailable\n");
        return;
    }
    uint32_t description = 0;
    for (const Sample &sample : samples) {
        if (!sample.readable || sample.kind != 1 || sample.factory != factory || !sample.after)
            continue;
        if (!description)
            description = sample.after;
        if (sample.player == 0 && sample.parent) {
            description = sample.after;
            break;
        }
    }
    if (!description) {
        std::fprintf(stderr, "[streaming] Factory fixture failed: retained vehicle unavailable\n");
        return;
    }
    X86 extra = *c;
    extra.r[R_ESP] -= 512;
    auto lookup = [&](uint32_t id) {
        extra.r[R_ECX] = factory;
        return guest_call(&extra, 0x005a10d0u, id);
    };
    const HeapStats baseline = heap_stats();
    for (unsigned trial = 0; trial != 64; ++trial) {
        const uint32_t before = rd32(factory + 0x28);
        const uint32_t expected = before < 0x7fffffffu ? before + 1 : 1;
        // A stale or incompatible allocator cannot replace an existing unit.
        if (lookup(expected)) {
            std::fprintf(stderr, "[streaming] Factory fixture failed: next ID occupied\n");
            return;
        }
        extra.r[R_ECX] = factory;
        const uint32_t unit = guest_call(&extra, 0x0042c3d0u, 1u, description);
        if (!unit || !gm_valid(unit, 0x164) || rd32(unit) != 0x0068098cu) {
            std::fprintf(stderr, "[streaming] Factory fixture failed: vehicle allocation\n");
            return;
        }
        extra.r[R_ECX] = factory;
        guest_call(&extra, 0x005a12e0u, unit, 1u, 0u);
        const uint32_t id = rd32(unit + 0x60);
        const uint32_t registered = lookup(id);
        const bool inserted = id == expected && registered == unit &&
                              rd32(unit + 0x84) == factory &&
                              (rd32(unit + 0x64) & 0x300u) == 0x200u;
        // Original factory removal broadcasts the ID to its collections and calls
        // the original scalar deleting destructor. No raw guest or host free.
        extra.r[R_ECX] = factory;
        guest_call(&extra, 0x005baf20u, unit);
        const uint32_t removed = lookup(id);
        const HeapStats after = heap_stats();
        const bool balanced = baseline.used_blocks == after.used_blocks &&
                              baseline.used_bytes == after.used_bytes &&
                              baseline.req_bytes == after.req_bytes;
        std::fprintf(stderr,
                     "[streaming] Factory fixture trial=%u description=%08x "
                     "unit=%08x counter-before=%08x id=%08x inserted=%u "
                     "after-removal=%08x heap-blocks=%u heap-bytes=%llu "
                     "heap-balanced=%u result=%s\n",
                     trial, description, unit, before, id, unsigned(inserted), removed,
                     after.used_blocks, static_cast<unsigned long long>(after.used_bytes),
                     unsigned(balanced), inserted && !removed && balanced ? "pass" : "fail");
        if (!inserted || removed || !balanced)
            return;
    }
    std::fprintf(stderr, "[streaming] Factory fixture completed trials=64 result=pass\n");
}

namespace {
constexpr size_t primary_limit = 65536;
using PrimaryBytes = std::array<uint8_t, primary_limit>;
// The original PRIMARY writer resolves parent cell coordinates through a live
// world association. Private actors deliberately lack that association. For
// this stopped, source-region diagnostic only, evaluate the original pure cell
// getter through the matching registered source actor. This borrows read-only
// parent context; it never assigns the private actor a world/ID or publishes it.
struct StageParentSerialization {
    X86 *cpu;
    uint32_t unit, source, handle = 0;
    uint64_t cookie = 0;
    unsigned calls = 0;
    bool failed = false;
    static void callback(const PopModApi *, pop_cpu_v1 *view, PopHookInvocation *inv, void *p) {
        auto &s = *static_cast<StageParentSerialization *>(p);
        const bool owned = s.cookie && guest_call_guarded_cookie(s.cpu) == s.cookie;
        if (owned && view->ecx == s.unit) {
            if (s.calls++ || !gm_valid(s.unit, 0x164) || !gm_valid(s.source, 0x164) ||
                rd32(s.unit) != 0x0068098c || rd32(s.source) != 0x0068098c || rd32(s.unit + 0x60) ||
                rd32(s.unit + 0x84) || !rd32(s.source + 0x60) || !rd32(s.source + 0x84) ||
                !rd32(s.unit + 0x74) || rd32(s.unit + 0x74) != rd32(s.source + 0x74) ||
                (rd32(s.unit + 0x64) & 0x80) || (rd32(s.source + 0x64) & 0x80)) {
                s.failed = true;
                guest_call_guarded_cancel(s.cpu, s.cookie, 0xbad10003);
                std::abort();
            }
            view->ecx = s.source;
        }
        if (mods_call_next(nullptr, inv, view) != POP_OK) {
            s.failed = true;
            if (owned)
                guest_call_guarded_cancel(s.cpu, s.cookie, 0xbad10003);
            std::abort();
        }
    }
    bool install() {
        return sched_holds_baton() && !mods_hook_depth() && mods_symbol_hookable(0x005ad420) &&
               mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005ad420, 0, callback, POP_HOOK_WRAP,
                                    POP_HOOK_NO_GAME_VIEW, this, &handle) == POP_OK;
    }
    bool remove() {
        if (!handle)
            return true;
        if (mods_hook_remove(MODS_OWNER_RUNTIME, handle) != POP_OK)
            return false;
        handle = 0;
        return true;
    }
};
bool primary_bytes(const char *path, PrimaryBytes &bytes, size_t &size, bool clear_id,
                   bool complete = false, bool normalize_id = true) {
    FILE *file = std::fopen(path, clear_id ? "r+b" : "rb");
    if (!file)
        return false;
    size = std::fread(bytes.data(), 1, bytes.size(), file);
    const bool bounded = std::fgetc(file) == EOF && !std::ferror(file);
    auto word = [&](size_t at) {
        uint32_t value = 0;
        std::memcpy(&value, bytes.data() + at, sizeof value);
        return value;
    };
    const size_t primary = complete ? 16 : 0;
    bool valid = bounded && size >= primary + 76 &&
                 std::memcmp(bytes.data() + primary, "PRIM", 4) == 0 && word(primary + 8) == 9;
    if (valid && complete) {
        const size_t secondary = primary + 16 + size_t(word(primary + 4));
        valid = std::memcmp(bytes.data(), "UNIT", 4) == 0 && word(4) == size - 16 && word(8) == 0 &&
                word(12) == 2 && word(primary + 4) >= 60 && word(primary + 12) == 0 &&
                secondary <= size - 16 && std::memcmp(bytes.data() + secondary, "SECD", 4) == 0 &&
                word(secondary + 8) == 2 && word(secondary + 12) == 0 &&
                size_t(word(secondary + 4)) == size - secondary - 16;
    }
    if (valid && normalize_id) {
        // PRIM's 16-byte chunk header precedes the 60-byte version-9 header.
        // Only the unit's own saved ID is normalized. External references are
        // intentionally untouched; this fixture does not activate the clone.
        const size_t identity = primary + 20;
        std::memset(bytes.data() + identity, 0, 4);
        if (clear_id) {
            valid = std::fseek(file, long(identity), SEEK_SET) == 0 &&
                    std::fwrite(bytes.data() + identity, 1, 4, file) == 4;
        }
    }
    return std::fclose(file) == 0 && valid;
}

uint32_t primary_file(X86 &extra, uint32_t scratch, const char *name, uint32_t factory,
                      uint32_t unit, bool write, uint32_t *read_result = nullptr,
                      bool complete = false, majesty::actors::UnitStage *stage = nullptr,
                      const majesty::actors::StageInput *stage_input = nullptr,
                      uint64_t *write_cookie = nullptr) {
    std::memset(gm_ptr(scratch), 0, 512);
    const uint32_t text = scratch + 256, wrapper = scratch + 16;
    const uint32_t chunk = scratch + 64, output = scratch + 128;
    const uint32_t context = scratch + 160;
    gm_put_str(text, name, 128);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3340u);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3590u, text, uint32_t(std::strlen(name)));
    extra.r[R_ECX] = wrapper;
    guest_call(&extra, write ? 0x004ee910u : 0x004ef470u, scratch, write ? 0x82u : 0xa0u,
               rd32(0x0068c7f0u));
    uint32_t restored = 0;
    uint32_t result = 0xffffffffu;
    majesty::actors::StageProfile profile{};
    const bool profiled = stage && stage_input;
    const bool profile_valid = ((stage == nullptr) == (stage_input == nullptr)) &&
                               (!profiled || majesty::actors::stage_profile(*stage_input, profile));
    const uint32_t components = profiled ? profile.components : 2;
    if (rd32(wrapper)) {
        wr32(chunk, 0x0067f744u);
        wr32(chunk + 0x0c, 0x10);
        if (write) {
            if (complete) {
                extra.r[R_ECX] = context;
                guest_call(&extra, 0x005c21f0u, 0u, wrapper);
                wr32(context + 8, 0x006bd874u);
                if (gm_valid(unit, 0x94) && rd32(unit) == 0x0068071c) {
                    majesty::actors::StageProfile reward{};
                    if (!majesty::actors::stage_profile(
                            {rd32(unit + 0x64), rd32(unit + 0x74), rd32(unit + 0x6c),
                             rd32(unit + 0x70), majesty::actors::StageClass::ExploreReward},
                            reward) || !gm_valid(unit, reward.bytes) ||
                        rd32(unit + 0x5c) != reward.kind) std::abort();
                    // Original RWRD serializer table has no SECONDARY writer.
                    // The VHCL table above would append an invalid extra component.
                    wr32(context + 8, 0x006bd89cu);
                }
                extra.r[R_ECX] = context;
                if (write_cookie) {
                    const uint32_t args[] = {0x54494e55u, unit};
                    const auto written =
                        guest_call_guarded(&extra, 0x005c22b0u, args, 2, write_cookie);
                    result = written.status == GuestCallGuardedStatus::Returned ? written.eax
                                                                                : 0xbad10003;
                } else {
                    result = guest_call(&extra, 0x005c22b0u, 0x54494e55u, unit);
                }
            } else {
                wr32(chunk + 0x18, wrapper);
                result = guest_call(&extra, 0x005c0bd0u, chunk, unit);
            }
        } else {
            wr32(chunk + 0x1c, wrapper);
            extra.r[R_ECX] = chunk;
            result = guest_call(&extra, 0x004ee840u);
            if (complete && profile_valid && !result && rd32(chunk + 4) == 0x54494e55u &&
                rd32(chunk + 0x20) == 0 && rd32(chunk + 0x24) == components) {
                extra.r[R_ECX] = context;
                guest_call(&extra, 0x005c1da0u, 0u, wrapper);
                wr32(context + 0x30, 0x006bd760u);
                extra.r[R_ECX] = context;
                if (profiled) {
                    const auto staged = stage->read(&extra, context, factory, output, *stage_input);
                    restored = staged.unit; // retain partial construction even after cancellation
                    result = staged.complete ? 0 : 0xbad10002;
                } else {
                    result = guest_call(&extra, 0x005c1f30u, 2u, factory, output);
                    restored = rd32(output);
                }
            } else if (!complete && !result && rd32(chunk + 4) == 0x4d495250u &&
                       rd32(chunk + 0x20) == 9) {
                result = guest_call(&extra, 0x005bfe50u, chunk, factory, output);
                restored = rd32(output);
            }
            if (complete && !restored && !result)
                result = 0xbad10002; // no constructor admitted for this UNIT header
        }
    }
    extra.r[R_ECX] = wrapper;
    guest_call(&extra, write ? 0x004eeb10u : 0x004ef680u);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3820u);
    if (write)
        return result == 0;
    // Even a failed primary read may have produced an object. The caller owns
    // its original factory removal; never hide it behind the status code.
    std::fprintf(stderr, "[streaming] %s reader result=%08x unit=%08x\n",
                 complete ? "Unit" : "Primary", result, restored);
    if (read_result)
        *read_result = result;
    return restored;
}

// A diagnostic composition of the actual original class/PRIMARY/SECD staging
// and private original order reader. No world registration, activation or save.
bool stage_empty_orders(X86 &extra, uint32_t unit) {
    const auto baseline = heap_stats();
    uint32_t buffer = heap_alloc(100, true), io = heap_alloc(92, true);
    uint32_t wrapper = heap_alloc(16, true), data = heap_alloc(24, true);
    if (!buffer || !io || !wrapper || !data) {
        for (uint32_t address : {buffer, io, wrapper, data})
            if (address)
                heap_free(address);
        return false; // no original object was constructed
    }
    auto invoke = [&](uint32_t fn, uint32_t receiver, const uint32_t *args, int count) {
        extra.r[R_ECX] = receiver;
        return guest_call_guarded(&extra, fn, args, count);
    };
    for (unsigned i = 0; i < 6; ++i)
        wr32(data + i * 4, i % 2 ? 0 : 1);
    uint32_t buffer_args[] = {data, 24, 0}, io_args[] = {buffer, 1};
    bool ok = invoke(0x0064a97f, buffer, buffer_args, 3).status == GuestCallGuardedStatus::Returned;
    ok = ok && invoke(0x0064b68a, io, io_args, 2).status == GuestCallGuardedStatus::Returned;
    if (!ok)
        return false; // do not guess which original stream objects completed
    wr32(wrapper, io);
    constexpr majesty::orders::EntryPoints sites{0x004abcc0,
                                                 0x005e4d20,
                                                 {0x005e4c71, 0x005da543, 0x005da579, 0x005da5e5,
                                                  0x005da61b, 0x005da651, 0x005da687, 0x005da6f3,
                                                  0x005da729, 0x005e0e39, 0x005e2b61, 0x005e4dc9},
                                                 0x00523485};
    majesty::orders::Request requests[6];
    for (unsigned i = 0; i < 6; ++i)
        requests[i] = {i % 2 ? majesty::orders::Role::Head : majesty::orders::Role::Bank, i / 2,
                       UINT32_MAX, 0, i % 2 ? 12u : 20u};
    majesty::orders::Journal journal;
    ok = journal.reserve(requests, 6, majesty::orders::heap_port());
    majesty::orders::AllocationBridge bridge(journal, sites);
    majesty::orders::ReaderHooks hooks(bridge);
    uint32_t addresses[6]{};
    for (unsigned i = 0; i < 6 && ok; ++i)
        addresses[i] = journal.find(requests[i].role, requests[i].bank)->address;
    ok = ok && hooks.install();
    if (ok) {
        const auto loaded =
            hooks.read_unit(&extra, unit, wrapper, {0x005b1b90, 0x0043010f, 0x0068098c, 0x88});
        ok = loaded.complete && loaded.guest.status == GuestCallGuardedStatus::Returned &&
             !loaded.guest.eax;
    }
    if (ok) {
        for (unsigned bank = 0; bank < 3; ++bank)
            ok = ok && rd32(unit + 0x88 + bank * 4) == addresses[bank * 2] &&
                 rd32(addresses[bank * 2] + 4) == unit && !rd32(addresses[bank * 2] + 16);
        ok = ok && bridge.handoff_unit_orders(unit);
    }
    if (ok) {
        for (uint32_t bank = 0; bank < 3; ++bank) {
            const auto cleared = invoke(0x005b2de0, unit, &bank, 1);
            ok = ok && cleared.status == GuestCallGuardedStatus::Returned &&
                 !rd32(unit + 0x88 + bank * 4);
        }
        for (uint32_t address : addresses)
            ok = ok && !heap_owns(address);
    } else if (journal.state() != majesty::orders::State::Transferred) {
        // Detach only exact borrowed bank fields before releasing stopped storage.
        for (unsigned bank = 0; bank < 3; ++bank)
            if (rd32(unit + 0x88 + bank * 4) == addresses[bank * 2])
                wr32(unit + 0x88 + bank * 4, 0);
    }
    if (!hooks.remove())
        std::abort(); // never resume with dangling fixture hook storage
    ok = journal.release() && ok;
    uint32_t no_delete = 0;
    ok =
        invoke(0x0064b65f, io + 12, &no_delete, 1).status == GuestCallGuardedStatus::Returned && ok;
    ok = invoke(0x0064aa1e, buffer, nullptr, 0).status == GuestCallGuardedStatus::Returned && ok;
    ok = heap_free(data) && heap_free(wrapper) && heap_free(io) && heap_free(buffer) && ok;
    const auto after = heap_stats();
    return ok && after.used_bytes == baseline.used_bytes &&
           after.used_blocks == baseline.used_blocks && after.req_bytes == baseline.req_bytes;
}

bool stage_pool_live(uint32_t &live) {
    live = 0;
    const uint32_t count = rd32(0x00723a7c), table = rd32(0x00723a80);
    if (count > 64 || !gm_valid(table, count * 20))
        return false;
    for (uint32_t i = 0; i < count; ++i) {
        const uint32_t control = rd32(table + i * 20 + 16);
        if (!gm_valid(control, 0x41c4))
            return false;
        for (uint32_t group = 0; group < 32; ++group) {
            uint32_t n = rd32(control + group * 0x204 + 0x144);
            if (n > UINT32_MAX - live)
                return false;
            live += n;
        }
    }
    return true;
}

// The graph remains journal-owned while destination semantics are pending.
// Original cleanup retires exact extents through its actual CRT free chain;
// no ownership handoff, world association or actor scheduling is permitted.
struct PendingOrderCleanup {
    majesty::orders::Journal &journal;
    const majesty::orders::Request *requests;
    uint32_t count;
    PopHookInvocation *inv = nullptr;
    pop_cpu_v1 *view = nullptr;
    uint32_t handle = 0, frees = 0;
    static uint32_t allocate(void *, uint32_t bytes) {
        return heap_alloc(bytes, false);
    }
    static bool release(void *p, uint32_t address, uint32_t) {
        auto &s = *static_cast<PendingOrderCleanup *>(p);
        if (!s.inv)
            return heap_free(address);
        return heap_owns(address) && mods_call_next(nullptr, s.inv, s.view) == POP_OK &&
               !heap_owns(address);
    }
    static void callback(const PopModApi *, pop_cpu_v1 *view, PopHookInvocation *inv, void *p) {
        auto &s = *static_cast<PendingOrderCleanup *>(p);
        const uint32_t address = rd32(view->esp + 4);
        if (!s.journal.cleanup_started() || !s.journal.eligible_cookie() || !address) {
            if (mods_call_next(nullptr, inv, view) != POP_OK)
                std::abort();
            return;
        }
        const majesty::orders::Request *request = nullptr;
        for (uint32_t i = 0; i < s.count; ++i) {
            const auto &r = s.requests[i];
            const auto *b = s.journal.find(r.role, r.bank, r.index);
            if (b && b->owned && b->claimed && b->address == address)
                request = &r;
        }
        if (!request || s.inv) {
            std::fprintf(stderr,
                         "[streaming] Populated cleanup refused address=%08x owned=%u nested=%u\n",
                         address, unsigned(request != nullptr), unsigned(s.inv != nullptr));
            std::abort(); // unknown ownership must not resume original free
        }
        s.inv = inv;
        s.view = view;
        if (!s.journal.retire(*request, address)) {
            std::fprintf(stderr,
                         "[streaming] Populated cleanup retire failed role=%u bank=%u index=%u\n",
                         unsigned(request->role), request->bank, request->index);
            std::abort();
        }
        s.inv = nullptr;
        s.view = nullptr;
        ++s.frees;
    }
};

struct StagedOrderClock {
    uint32_t offset, bank, index, kind, when, rate, delta, info;
};

struct StagedOrderTarget {
    uint32_t offset, bank, index, kind, before;
};

// Source capture for a stopped, isolated cross-world fixture. The supplied
// binding describes test inputs; it does not establish entity continuity.
struct CrossBindingSource {
    uint32_t before = 0, after = 0, kind = 0, description = 0, player = 0;
    uint32_t source_bytes = 0, destination_bytes = 0;
    uint32_t source_clock = 0;
    std::array<uint8_t, 4096> source{}, destination{};
};

bool live_banks_equal(X86 &extra, uint32_t unit, const uint8_t *payload, uint32_t bytes,
                      const char *save_name = nullptr) {
    if (!payload || bytes < 24 || bytes > 2048)
        return false;
    const auto baseline = heap_stats();
    const uint32_t buffer = heap_alloc(100, true), io = heap_alloc(92, true);
    const uint32_t wrapper = heap_alloc(16, true), data = heap_alloc(bytes + 32, false);
    if (!buffer || !io || !wrapper || !data)
        std::abort();
    std::memset(gm_ptr(data), 0xa5, bytes + 32);
    auto invoke = [&](uint32_t fn, uint32_t receiver, const uint32_t *args, int n) {
        extra.r[R_ECX] = receiver;
        return guest_call_guarded(&extra, fn, args, n);
    };
    const uint32_t b[] = {data + 16, bytes, data + 16}, i[] = {buffer, 1};
    if (invoke(0x0064a97f, buffer, b, 3).status != GuestCallGuardedStatus::Returned ||
        invoke(0x006497f3, io, i, 2).status != GuestCallGuardedStatus::Returned)
        std::abort(); // do not guess a partially constructed stream teardown
    wr32(wrapper, io);
    const auto written = invoke(0x005b1be0, unit, &wrapper, 1);
    bool equal = written.status == GuestCallGuardedStatus::Returned && !written.eax &&
                 !std::memcmp(gm_ptr(data + 16), payload, bytes);
    if (equal && save_name) {
        char path[1024];
        FILE *file =
            recomp_writable_path(save_name, path, sizeof path) ? std::fopen(path, "wb") : nullptr;
        equal = file && std::fwrite(gm_ptr(data + 16), 1, bytes, file) == bytes;
        if (file)
            equal = std::fclose(file) == 0 && equal;
    }
    const uint32_t deleting = 0;
    if (invoke(0x006497c8, io + 8, &deleting, 1).status != GuestCallGuardedStatus::Returned ||
        invoke(0x0064aa1e, buffer, nullptr, 0).status != GuestCallGuardedStatus::Returned)
        std::abort();
    for (uint32_t n = 0; n < 16; ++n)
        equal = equal && rd8(data + n) == 0xa5 && rd8(data + bytes + 16 + n) == 0xa5;
    equal = heap_free(data) && heap_free(wrapper) && heap_free(io) && heap_free(buffer) && equal;
    const auto after = heap_stats();
    return equal && after.used_bytes == baseline.used_bytes &&
           after.used_blocks == baseline.used_blocks && after.req_bytes == baseline.req_bytes;
}

// An isolated native fixture only. Original common dispatch runs on the actual
// private graph, but leaf handlers are observed and returned before executing.
// The destination clock is synthetic; no destination world is activated.
struct PrivateClockDispatch {
    majesty::orders::Journal &journal;
    X86 &extra;
    struct Binding {
        PrivateClockDispatch *owner;
        uint32_t fn, handle;
    };
    std::array<Binding, 3> bindings{
        {{this, 0x004ab8a0, 0}, {this, 0x005e1330, 0}, {this, 0x005e2ef0, 0}}};
    uint32_t order = 0, bank = 0, unit = 0, clock = 0, leaves = 0;
    bool failed = false;
    static void callback(const PopModApi *, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *p) {
        auto &s = *static_cast<Binding *>(p)->owner;
        if (!s.journal.eligible_cookie() || !s.order) {
            if (mods_call_next(nullptr, inv, cpu) != POP_OK)
                std::abort();
            return;
        }
        if (cpu->ecx != s.order || rd32(cpu->esp) != 0x005e53f3 || rd32(cpu->esp + 4) != s.unit ||
            rd32(cpu->esp + 8) != s.bank || rd32(cpu->esp + 12) || rd32(0x0071c6a8) != s.clock ||
            s.leaves || mods_hook_return(nullptr, cpu, 0, 12) != POP_OK) {
            s.failed = true;
            guest_call_guarded_cancel(&s.extra, s.journal.eligible_cookie(), 0xbad20001);
            std::abort();
        }
        ++s.leaves;
    }
    bool install() {
        for (const auto &b : bindings)
            if (!mods_symbol_hookable(b.fn))
                return false;
        for (auto &b : bindings)
            if (mods_hook_install_ex(MODS_OWNER_RUNTIME, b.fn, 0, callback, POP_HOOK_WRAP,
                                     POP_HOOK_NO_GAME_VIEW, &b, &b.handle) != POP_OK) {
                remove();
                return false;
            }
        return true;
    }
    void remove() {
        for (auto &b : bindings)
            if (b.handle) {
                if (mods_hook_remove(MODS_OWNER_RUNTIME, b.handle) != POP_OK)
                    std::abort();
                b.handle = 0;
            }
    }
};

bool probe_private_order_clocks(X86 &extra, majesty::orders::Journal &journal, uint32_t unit,
                                const StagedOrderClock *headers, uint8_t *expected, uint32_t bytes,
                                uint32_t trial) {
    constexpr uint32_t tables[] = {0x006830d8, 0x0068add8, 0x0068ae74};
    constexpr uint32_t kinds[] = {2, 4, 7};
    if (!sched_holds_baton() || mods_hook_depth() || journal.invocation_active() ||
        !journal.fully_claimed() || rd32(unit + 0x60) || rd32(unit + 0x84))
        return false;
    const uint32_t source_clock = rd32(0x0071c6a8);
    const uint32_t destinations[] = {source_clock, 0, source_clock + 0x80000000u, UINT32_MAX};
    const uint32_t destination_clock = destinations[trial % 4];
    std::array<const majesty::orders::Block *, 3> blocks{};
    std::array<std::array<uint8_t, 140>, 3> before{};
    auto word = [&](uint32_t at) {
        uint32_t value;
        std::memcpy(&value, expected + at, 4);
        return value;
    };
    PrivateClockDispatch dispatch{journal, extra};
    dispatch.unit = unit;
    for (uint32_t i = 0; i < 3; ++i) {
        const auto &h = headers[i];
        const auto *b = journal.find(majesty::orders::Role::Order, h.bank, h.index);
        const auto *bank = journal.find(majesty::orders::Role::Bank, h.bank);
        if (h.kind != kinds[i] || h.bank != (i == 2 ? 1u : 0u) || h.index != (i == 1 ? 1u : 0u) ||
            h.offset < 4 || h.offset > bytes || bytes - h.offset < 12 || word(h.offset) != h.when ||
            word(h.offset - 4) != h.rate || word(h.offset + 4) != h.delta ||
            word(h.offset + 8) != h.info || !b || !bank || !b->owned || !b->claimed ||
            b->request.kind != h.kind || b->request.bytes > 140 || b->request.bytes < 28 ||
            !gm_valid(b->address, b->request.bytes) || rd32(b->address) != tables[i] ||
            rd32(b->address + 16) != h.kind || rd32(b->address + 8) != h.when ||
            rd32(b->address + 12) != h.delta || rd32(b->address + 20) != h.rate ||
            rd32(b->address + 24) != h.info || rd32(tables[i] + 24) != dispatch.bindings[i].fn ||
            rd32(unit + 0x88 + h.bank * 4) != bank->address || rd32(bank->address) != 0x00683148 ||
            rd32(bank->address + 4) != unit)
            return false;
        for (uint32_t j = 0; j < i; ++j)
            if (h.offset == headers[j].offset)
                return false;
        blocks[i] = b;
        std::memcpy(before[i].data(), gm_ptr(b->address), b->request.bytes);
    }
    if (rd32(0x00683148 + 0x50) != 0x005e53c0 || !dispatch.install())
        return false;
    uint32_t calls = 0, leaves = 0, skipped = 0;
    bool ok = true;
    for (uint32_t i = 0; i < 3 && ok; ++i) {
        const auto &h = headers[i];
        const uint32_t order = blocks[i]->address;
        const uint32_t elapsed = source_clock - h.when;
        const uint32_t after = destination_clock - elapsed;
        const uint32_t advances[] = {0, UINT32_MAX, h.delta - elapsed - 1, h.delta - elapsed};
        const auto *bank = journal.find(majesty::orders::Role::Bank, h.bank);
        for (uint32_t advance : advances) {
            const bool due = !(h.info & 1) && h.delta <= uint32_t(elapsed + advance);
            for (unsigned side = 0; side < 2 && ok; ++side) {
                dispatch.order = order;
                dispatch.bank = bank->address;
                dispatch.clock = (side ? destination_clock : source_clock) + advance;
                dispatch.leaves = 0;
                wr32(order + 8, side ? after : h.when);
                wr32(0x0071c6a8, dispatch.clock);
                extra.r[R_ECX] = dispatch.bank;
                const auto result = journal.invoke(&extra, 0x005e53c0, &order, 1);
                // Restore the actual stopped clock even after a canceled probe.
                wr32(0x0071c6a8, source_clock);
                wr32(order + 8, h.when);
                dispatch.order = 0;
                ok = result.status == GuestCallGuardedStatus::Returned && !dispatch.failed &&
                     dispatch.leaves == unsigned(due) && journal.fully_claimed();
                ++calls;
                leaves += dispatch.leaves;
                skipped += !dispatch.leaves;
                for (unsigned j = 0; j < 3 && ok; ++j)
                    ok = !std::memcmp(gm_ptr(blocks[j]->address), before[j].data(),
                                      blocks[j]->request.bytes);
            }
        }
    }
    dispatch.remove();
    // Only commit private _when words after the complete probe succeeds.
    if (ok && calls == 24 && rd32(0x0071c6a8) == source_clock) {
        for (uint32_t i = 0; i < 3; ++i) {
            const uint32_t after = destination_clock - (source_clock - headers[i].when);
            wr32(blocks[i]->address + 8, after);
            std::memcpy(expected + headers[i].offset, &after, 4);
        }
    } else {
        ok = false;
    }
    std::fprintf(stderr,
                 "[streaming] Private clock probe source=%u destination=%u case=%u calls=%u "
                 "leaves=%u skipped=%u restored=%u headers=%u result=%s\n",
                 source_clock, destination_clock, trial % 4, calls, leaves, skipped,
                 unsigned(rd32(0x0071c6a8) == source_clock), ok ? 3u : 0u, ok ? "pass" : "fail");
    return ok;
}

bool bind_private_orders(X86 &extra, majesty::orders::Journal &journal, uint32_t unit,
                         uint32_t factory, const CrossBindingSource &binding,
                         const StagedOrderClock *clocks, const StagedOrderTarget *targets,
                         uint8_t *expected, uint32_t bytes, uint32_t &destination_clock) {
    if (!sched_holds_baton() || mods_hook_depth() || journal.invocation_active() ||
        !journal.fully_claimed() || rd32(unit + 0x60) || rd32(unit + 0x84) || !clocks || !targets ||
        !binding.before || !binding.after || binding.before == binding.after ||
        !gm_valid(factory, 0x88) || rd32(factory) != 0x00682950)
        return false;
    extra.r[R_ECX] = factory;
    const auto lookup = guest_call_guarded(&extra, 0x005a10d0, &binding.after, 1);
    const uint32_t target = lookup.eax;
    if (lookup.status != GuestCallGuardedStatus::Returned || !gm_valid(target, 0x164) ||
        rd32(target) != 0x0068098c || rd32(target + 0x5c) != binding.kind ||
        rd32(target + 0x60) != binding.after || rd32(target + 0x6c) != binding.description ||
        rd32(target + 0x70) != binding.player || rd32(target + 0x84) != factory ||
        (rd32(target + 0x64) & 4) || rd32(target + 0x74))
        return false;
    extra.r[R_ECX] = factory;
    const auto absent = guest_call_guarded(&extra, 0x005a10d0, &binding.before, 1);
    if (absent.status != GuestCallGuardedStatus::Returned || absent.eax)
        return false;
    destination_clock = rd32(0x0071c6a8);
    constexpr uint32_t kinds[] = {2, 4, 6}, tables[] = {0x006830d8, 0x0068add8, 0x0068ae44};
    std::array<const majesty::orders::Block *, 3> blocks{};
    auto word = [&](uint32_t at) {
        uint32_t value;
        std::memcpy(&value, expected + at, 4);
        return value;
    };
    for (uint32_t i = 0; i < 3; ++i) {
        const auto &h = clocks[i];
        const auto *b = journal.find(majesty::orders::Role::Order, h.bank, h.index);
        const auto *bank = journal.find(majesty::orders::Role::Bank, h.bank);
        if (h.kind != kinds[i] || h.bank != (i == 2 ? 1u : 0u) || h.index != (i == 1 ? 1u : 0u) ||
            h.offset < 4 || h.offset > bytes || bytes - h.offset < 12 || word(h.offset) != h.when ||
            word(h.offset - 4) != h.rate || word(h.offset + 4) != h.delta ||
            word(h.offset + 8) != h.info || !b || !bank || !b->owned || !b->claimed ||
            b->request.kind != h.kind || b->request.bytes < 60 || b->request.bytes > 200 ||
            !gm_valid(b->address, b->request.bytes) || rd32(b->address) != tables[i] ||
            rd32(b->address + 16) != h.kind || rd32(b->address + 8) != h.when ||
            rd32(b->address + 12) != h.delta || rd32(b->address + 20) != h.rate ||
            rd32(b->address + 24) != h.info || rd32(unit + 0x88 + h.bank * 4) != bank->address ||
            rd32(bank->address + 4) != unit)
            return false;
        for (uint32_t j = 0; j < i; ++j)
            if (h.offset == clocks[j].offset || b->address == blocks[j]->address)
                return false;
        blocks[i] = b;
    }
    for (uint32_t i = 0; i < 2; ++i) {
        const auto &t = targets[i];
        const auto &h = clocks[i + 1];
        if (t.kind != h.kind || t.bank != h.bank || t.index != h.index ||
            t.before != binding.before || t.offset > bytes || bytes - t.offset < 4 ||
            word(t.offset) != t.before || rd32(blocks[i + 1]->address + 0x38) != t.before ||
            (i && t.offset == targets[0].offset))
            return false;
        for (const auto &clock : std::array<StagedOrderClock, 3>{clocks[0], clocks[1], clocks[2]})
            if (t.offset == clock.offset)
                return false;
    }
    if (rd32(0x0071c6a8) != destination_clock)
        return false;
    // Every lookup and descriptor check precedes mutation. No guest calls,
    // allocations or yields occur while writing this still-private graph.
    for (uint32_t i = 0; i < 2; ++i) {
        wr32(blocks[i + 1]->address + 0x38, binding.after);
        std::memcpy(expected + targets[i].offset, &binding.after, 4);
    }
    for (uint32_t i = 0; i < 3; ++i) {
        const uint32_t after = destination_clock - (binding.source_clock - clocks[i].when);
        wr32(blocks[i]->address + 8, after);
        std::memcpy(expected + clocks[i].offset, &after, 4);
    }
    return true;
}

// Diagnostic admission for these unchanged cross-world inputs. All their
// existing coordinates lie outside the second world's grid. The original
// point query must reject them; no stale route is published or executed.
bool probe_cross_navigation(X86 &extra, majesty::orders::Journal &journal, uint32_t unit,
                            uint32_t factory, uint32_t trial) {
    auto refuse = [&](const char *reason) {
        std::fprintf(stderr, "[streaming] Cross navigation trial=%u admission=%s result=fail\n",
                     trial, reason);
        return false;
    };
    if (!sched_holds_baton() || mods_hook_depth() || journal.invocation_active() ||
        !journal.fully_claimed() || rd32(unit + 0x60) || rd32(unit + 0x84) ||
        !gm_valid(factory, 0x8c))
        return refuse("private-scope");
    const uint32_t grid = rd32(factory + 0x88);
    if (!gm_valid(grid, 0x50))
        return refuse("grid");
    const uint32_t width = rd32(grid + 0x48), height = rd32(grid + 0x4c);
    if (!width || !height || width > 2048 || height > 2048 || uint64_t(width) * height > 65536)
        return refuse("grid-bounds"); // bound this Scions diagnostic, not arbitrary worlds
    const uint32_t table_bytes = width * height * 4;
    const uint32_t search = rd32(grid + 0x14), actors = rd32(grid + 0x18);
    if (!gm_valid(search, table_bytes) || !gm_valid(actors, table_bytes))
        return refuse("grid-tables");
    auto digest = [](uint32_t address, uint32_t bytes) {
        uint64_t value = 14695981039346656037ull;
        for (uint32_t at = 0; at < bytes; ++at)
            value = (value ^ rd8(address + at)) * 1099511628211ull;
        return value;
    };
    const uint64_t grid_before = digest(grid, 0x50), search_before = digest(search, table_bytes),
                   actors_before = digest(actors, table_bytes), unit_before = digest(unit, 0x164);
    const auto *order = journal.find(majesty::orders::Role::Order, 0, 1);
    const auto *path = journal.find(majesty::orders::Role::Path, 0, 1);
    if (!order || !path || !order->owned || !order->claimed || !path->owned || !path->claimed ||
        order->request.kind != 4 || order->request.bytes != 100 ||
        rd32(order->address) != 0x0068add8 || rd32(order->address + 0x44) != path->address ||
        rd32(order->address + 0x4c) != 10 || rd32(order->address + 0x5c) != 10 ||
        rd32(order->address + 0x48) > 10 || path->request.bytes != 80)
        return refuse("owned-path-layout");
    const uint64_t order_before = digest(order->address, 100),
                   path_before = digest(path->address, 80);
    const auto heap_before = heap_stats();
    const uint32_t scratch = heap_alloc(32, false);
    if (!scratch)
        return refuse("scratch");
    std::memset(gm_ptr(scratch), 0xa5, 32);
    const uint32_t output = scratch + 8;
    extra.r[R_ECX] = unit;
    const auto position = guest_call_guarded(&extra, 0x005ad740, &output, 1);
    const int32_t actor_x = int32_t(rd32(output)) / 16, actor_y = int32_t(rd32(output + 4)) / 16;
    const uint32_t conversion[] = {output, order->address + 0x3c};
    extra.r[R_ECX] = 0;
    const auto destination = guest_call_guarded(&extra, 0x0043c640, conversion, 2);
    const int32_t destination_x = int32_t(rd32(output)), destination_y = int32_t(rd32(output + 4));
    bool ok = position.status == GuestCallGuardedStatus::Returned && position.eax == output &&
              destination.status == GuestCallGuardedStatus::Returned && destination.eax == output;
    uint32_t queried = 0;
    auto blocked = [&](int32_t x, int32_t y) {
        if (x >= 0 && y >= 0 && uint32_t(x) < width && uint32_t(y) < height)
            return false; // fail closed instead of entering an unaudited footprint branch
        const uint32_t args[] = {unit, uint32_t(x), uint32_t(y), 0, 0, 0};
        extra.r[R_ECX] = grid;
        const auto result = guest_call_guarded(&extra, 0x005b8eb0, args, 6);
        ++queried;
        return result.status == GuestCallGuardedStatus::Returned && (result.eax & 255) == 1;
    };
    ok = ok && blocked(actor_x, actor_y) && blocked(destination_x, destination_y);
    for (uint32_t i = 0; i < 10 && ok; ++i)
        ok =
            blocked(int32_t(rd32(path->address + i * 8)), int32_t(rd32(path->address + i * 8 + 4)));
    ok = ok && blocked(-1, 0) && blocked(int32_t(width), 0) && blocked(0, -1) &&
         blocked(0, int32_t(height));
    for (uint32_t at = 0; at < 32 && ok; ++at)
        if (at < 8 || at >= 16)
            ok = rd8(scratch + at) == 0xa5;
    ok = heap_free(scratch) && ok;
    const auto after = heap_stats();
    const bool unchanged =
        digest(grid, 0x50) == grid_before && digest(search, table_bytes) == search_before &&
        digest(actors, table_bytes) == actors_before && digest(unit, 0x164) == unit_before &&
        digest(order->address, 100) == order_before && digest(path->address, 80) == path_before &&
        rd32(factory + 0x88) == grid && after.used_bytes == heap_before.used_bytes &&
        after.used_blocks == heap_before.used_blocks && after.req_bytes == heap_before.req_bytes;
    ok = ok && unchanged && queried == 16;
    std::fprintf(stderr,
                 "[streaming] Cross navigation trial=%u grid=%u,%u actor=%d,%d destination=%d,%d "
                 "points=10 queried=%u blocked=%u unchanged=%u reuse-refused=%u result=%s\n",
                 trial, width, height, actor_x, actor_y, destination_x, destination_y, queried,
                 ok ? queried : 0, unsigned(unchanged), unsigned(ok), ok ? "pass" : "fail");
    return ok;
}

bool invalidate_private_path(majesty::orders::Journal &journal, const StagedOrderClock *clocks,
                             uint8_t *expected, uint32_t bytes, uint32_t trial,
                             bool composed = false) {
    if (!clocks || !expected || !journal.fully_claimed() || journal.invocation_active() ||
        !sched_holds_baton() || mods_hook_depth())
        return false;
    const auto &h = clocks[1];
    const auto *order = journal.find(majesty::orders::Role::Order, h.bank, h.index);
    const auto *path = journal.find(majesty::orders::Role::Path, h.bank, h.index);
    if (h.kind != 4 || h.offset < 20 || !order || !path || !order->owned || !order->claimed ||
        !path->owned || !path->claimed || order->request.bytes != 100 ||
        path->request.bytes != (composed ? 512u : 80u) || rd32(order->address) != 0x0068add8 ||
        rd32(order->address + 0x44) != path->address || rd32(order->address + 0x48) != 8 ||
        rd32(order->address + 0x4c) != 10 || rd32(order->address + 0x5c) != (composed ? 64u : 10u))
        return false;
    const uint32_t body = h.offset - 20;
    if (body > bytes || bytes - body < 220)
        return false;
    auto word = [&](uint32_t at) {
        uint32_t value;
        std::memcpy(&value, expected + at, 4);
        return value;
    };
    if (word(body) != 5 || word(body + 120) != 8 || word(body + 128) != (composed ? 64u : 10u) ||
        word(body + 136) != 10 || std::memcmp(expected + body + 140, gm_ptr(path->address), 80))
        return false;
    std::array<uint8_t, 100> before{};
    std::memcpy(before.data(), gm_ptr(order->address), before.size());
    // Preserve the owned capacity/buffer; the original writer omits unused
    // points when count is zero. The original cursor+1<count test now selects
    // replanning instead of reading the stale following point. No leaf runs.
    wr32(order->address + 0x48, 0);
    wr32(order->address + 0x4c, 0);
    std::memset(expected + body + 120, 0, 4);
    std::memset(expected + body + 136, 0, 4);
    const uint32_t points = body + 140;
    std::memmove(expected + points, expected + points + 80, bytes - points - 80);
    std::memset(expected + bytes - 80, 0xa5, 80);
    bool ok = rd32(order->address + 0x48) == 0 && rd32(order->address + 0x4c) == 0 &&
              rd32(order->address + 0x5c) == (composed ? 64u : 10u) &&
              rd32(order->address + 0x44) == path->address;
    for (uint32_t at = 0; at < before.size() && ok; ++at)
        if (!(at >= 0x48 && at < 0x50))
            ok = rd8(order->address + at) == before[at];
    std::fprintf(stderr,
                 "[streaming] %s path invalidate trial=%u old-count=10 count=0 cursor=0 "
                 "capacity=%u retained-bytes=%u serialized-bytes=%u replan-selected=%u result=%s\n",
                 composed ? "Composed" : "Cross", trial, composed ? 64u : 10u,
                 composed ? 512u : 80u, bytes - 80, unsigned(ok), ok ? "pass" : "fail");
    return ok;
}

struct ClassFootprint {
    uint32_t traits = 0, address = 0, width = 0, height = 0, stride = 0, mask = 0;
};

bool class_footprint(X86 &extra, uint32_t unit, ClassFootprint &shape) {
    if (!sched_holds_baton() || mods_hook_depth() || !gm_valid(unit, 0x164) ||
        rd32(unit) != 0x0068098c || rd32(unit + 0x60) || rd32(unit + 0x84) ||
        rd32(0x0068098c + 0xc0) != 0x0042c6b0)
        return false;
    const uint32_t description = rd32(unit + 0x80);
    shape.traits = gm_valid(description, 0x18) ? rd32(description + 0x14) : 0;
    if (!gm_valid(shape.traits, 0x40))
        return false;
    std::array<uint8_t, 0x164> before{};
    std::memcpy(before.data(), gm_ptr(unit), before.size());
    const uint32_t selector = 0;
    extra.r[R_ECX] = unit;
    const auto result = guest_call_guarded(&extra, 0x0042c6b0, &selector, 1);
    if (result.status != GuestCallGuardedStatus::Returned || !(rd32(shape.traits + 0x3c) & 1) ||
        result.eax != rd32(shape.traits + 0x2c) ||
        std::memcmp(before.data(), gm_ptr(unit), before.size()))
        return false;
    shape.address = result.eax;
    if (!shape.address)
        return true; // original point query selects its rectangle fallback
    if (!gm_valid(shape.address, 24))
        return false;
    shape.width = rd32(shape.address);
    shape.height = rd32(shape.address + 4);
    shape.stride = rd32(shape.address + 8);
    shape.mask = rd32(shape.address + 20);
    return shape.width && shape.width <= 16 && shape.height && shape.height <= 16 &&
           shape.stride >= (shape.width + 7) / 8 && shape.stride <= 16 &&
           gm_valid(shape.mask, shape.stride * shape.height);
}

bool probe_cross_landing(X86 &extra, uint32_t unit, uint32_t factory, uint32_t target_id,
                         uint32_t trial) {
    ClassFootprint shape;
    const uint32_t description = rd32(unit + 0x80);
    const uint32_t traits = gm_valid(description, 0x18) ? rd32(description + 0x14) : 0;
    if (!gm_valid(traits, 0x40) || !(rd32(traits + 0x3c) & 1) ||
        !class_footprint(extra, unit, shape) || !gm_valid(factory, 0x8c))
        return false; // class initialization belongs to the explicit warmup
    const int32_t left = int32_t(rd32(traits + 0x14)), top = int32_t(rd32(traits + 0x18)),
                  right = int32_t(rd32(traits + 0x1c)), bottom = int32_t(rd32(traits + 0x20));
    if (!shape.address && (!(rd32(traits + 0x3c) & 4) || left < -16 || top < -16 || right > 16 ||
                           bottom > 16 || left >= right || top >= bottom))
        return false; // an empty rectangle would falsely admit every interior point
    const uint32_t grid = rd32(factory + 0x88);
    if (!gm_valid(grid, 0x50) || rd32(grid + 0x48) != 256 || rd32(grid + 0x4c) != 256)
        return false;
    const uint32_t search = rd32(grid + 0x14), actors = rd32(grid + 0x18),
                   table_bytes = 256 * 256 * 4;
    if (!gm_valid(search, table_bytes) || !gm_valid(actors, table_bytes))
        return false;
    auto digest = [](uint32_t address, uint32_t bytes) {
        uint64_t value = 14695981039346656037ull;
        for (uint32_t at = 0; at < bytes; ++at)
            value = (value ^ rd8(address + at)) * 1099511628211ull;
        return value;
    };
    const uint64_t unit_before = digest(unit, 0x164), grid_before = digest(grid, 0x50),
                   search_before = digest(search, table_bytes),
                   actors_before = digest(actors, table_bytes),
                   traits_before = digest(traits, 0x40),
                   shape_before = shape.address ? digest(shape.address, 24) : 0,
                   mask_before =
                       shape.address ? digest(shape.mask, shape.stride * shape.height) : 0;
    const auto heap_before = heap_stats();
    const uint32_t scratch = heap_alloc(48, false);
    if (!scratch)
        return false;
    std::memset(gm_ptr(scratch), 0xa5, 48);
    extra.r[R_ECX] = factory;
    const auto target = guest_call_guarded(&extra, 0x005a10d0, &target_id, 1);
    bool ok = target.status == GuestCallGuardedStatus::Returned && gm_valid(target.eax, 0x164) &&
              rd32(target.eax + 0x60) == target_id && rd32(target.eax + 0x84) == factory;
    const uint32_t native_position = scratch + 8, grid_position = scratch + 24;
    if (ok) {
        extra.r[R_ECX] = target.eax;
        const auto position = guest_call_guarded(&extra, 0x005ad740, &native_position, 1);
        const uint32_t args[] = {grid_position, native_position};
        extra.r[R_ECX] = 0;
        const auto converted = guest_call_guarded(&extra, 0x0043c640, args, 2);
        ok = position.status == GuestCallGuardedStatus::Returned &&
             position.eax == native_position &&
             converted.status == GuestCallGuardedStatus::Returned && converted.eax == grid_position;
    }
    const int32_t centre_x = int32_t(rd32(grid_position)),
                  centre_y = int32_t(rd32(grid_position + 4));
    constexpr int32_t offsets[][2] = {{8, 0},  {8, 8},  {-8, 0},  {-8, 8}, {0, 8},   {-8, -8},
                                      {8, -8}, {0, -8}, {12, 0},  {12, 8}, {-12, 0}, {-12, 8},
                                      {0, 12}, {8, 12}, {-8, 12}, {0, -12}};
    std::array<std::array<int32_t, 2>, 2> admitted{};
    uint32_t accepted = 0, queried = 0;
    for (const auto &offset : offsets) {
        if (!ok || accepted == 2)
            break;
        const int32_t x = centre_x + offset[0], y = centre_y + offset[1];
        if (x < 16 || y < 16 || x >= 240 || y >= 240)
            continue;
        bool clear = true;
        for (uint32_t flags : {0x200u, 0x400u}) {
            // Point ABI: actor, x, y, collision flags, footprint selector,
            // callback. Original Path queries use selector zero for these cases.
            const uint32_t args[] = {unit, uint32_t(x), uint32_t(y), flags, 0, 0};
            extra.r[R_ECX] = grid;
            const auto result = guest_call_guarded(&extra, 0x005b8eb0, args, 6);
            ++queried;
            ok = result.status == GuestCallGuardedStatus::Returned && (result.eax & 255) <= 1;
            clear = clear && !(result.eax & 255);
            if (!ok)
                break;
        }
        if (ok && clear)
            admitted[accepted++] = {x, y};
    }
    for (uint32_t at = 0; at < 48 && ok; ++at)
        if (!(at >= 8 && at < 16) && !(at >= 24 && at < 32))
            ok = rd8(scratch + at) == 0xa5;
    ok = heap_free(scratch) && ok;
    const auto after = heap_stats();
    const bool unit_same = digest(unit, 0x164) == unit_before,
               grid_same = digest(grid, 0x50) == grid_before && rd32(factory + 0x88) == grid,
               search_same = digest(search, table_bytes) == search_before,
               actors_same = digest(actors, table_bytes) == actors_before,
               traits_same = digest(traits, 0x40) == traits_before,
               shape_same = !shape.address ||
                            (digest(shape.address, 24) == shape_before &&
                             digest(shape.mask, shape.stride * shape.height) == mask_before),
               heap_same = after.used_bytes == heap_before.used_bytes &&
                           after.used_blocks == heap_before.used_blocks &&
                           after.req_bytes == heap_before.req_bytes;
    const bool unchanged = unit_same && grid_same && search_same && actors_same && traits_same &&
                           shape_same && heap_same;
    ok = ok && unchanged && accepted == 2;
    std::fprintf(stderr,
                 "[streaming] Cross landing trial=%u centre=%d,%d first=%d,%d second=%d,%d "
                 "shape=%u,%u rectangle=%d,%d,%d,%d selector=0 flags=512,1024 queried=%u "
                 "admitted=%u unchanged=%u "
                 "unit-same=%u grid-same=%u search-same=%u actors-same=%u traits-same=%u "
                 "shape-same=%u heap-same=%u result=%s\n",
                 trial, centre_x, centre_y, admitted[0][0], admitted[0][1], admitted[1][0],
                 admitted[1][1], shape.width, shape.height, left, top, right, bottom, queried,
                 accepted, unsigned(unchanged), unsigned(unit_same), unsigned(grid_same),
                 unsigned(search_same), unsigned(actors_same), unsigned(traits_same),
                 unsigned(shape_same), unsigned(heap_same), ok ? "pass" : "fail");
    return ok;
}

// Observe the original resolver's choice for an occupied requested destination.
// This delegates the real method and never substitutes an arbitrary free cell.
struct ReturnRouteGoal {
    X86 &cpu;
    uint32_t factory, unit, requested_x, requested_y, handle = 0, calls = 0;
    uint64_t cookie = 0;
    std::array<uint32_t, 2> resolved{};
    static void callback(const PopModApi *, pop_cpu_v1 *c, PopHookInvocation *inv, void *p) {
        auto &s = *static_cast<ReturnRouteGoal *>(p);
        if (!s.cookie || guest_call_guarded_cookie(&s.cpu) != s.cookie) {
            if (mods_call_next(nullptr, inv, c) != POP_OK) std::abort();
            return;
        }
        const uint32_t output = rd32(c->esp + 4);
        if (s.calls || rd32(c->esp) != 0x005eafa6 || rd32(c->esp + 8) != s.factory ||
            rd32(c->esp + 12) != s.unit || rd32(c->esp + 24) != s.requested_x ||
            rd32(c->esp + 28) != s.requested_y || !gm_valid(output, 8)) std::abort();
        if (mods_call_next(nullptr, inv, c) != POP_OK || c->eax != output) std::abort();
        s.resolved = {rd32(output), rd32(output + 4)}; ++s.calls;
    }
};

template <size_t Words = 128>
bool probe_cross_route(X86 &extra, uint32_t unit, uint32_t factory, uint32_t trial, bool warm,
                       const std::array<uint32_t, 4> *endpoints = nullptr,
                       std::array<uint32_t, Words> *captured = nullptr,
                       uint32_t *captured_count = nullptr, uint32_t grid_extent = 256, uint32_t max_points = 64) {
    if ((max_points != 64 && max_points != 128) || max_points > Words / 2) return false;
    const uint32_t output_bytes = 32 + max_points * 8;
    const bool composed = endpoints != nullptr;
    const bool receiving_goal = grid_extent == 512 || (composed && max_points == 128);
    const char *label = composed ? "Composed" : "Cross";
    const auto points = endpoints ? *endpoints : std::array<uint32_t, 4>{119, 137, 103, 129};
    const uint32_t limit = composed ? 512 : 256;
    if (composed && (!captured || !captured_count || warm))
        return false;
    if (grid_extent != 256 && grid_extent != 512)
        return false;
    for (uint32_t value : points)
        if (value >= grid_extent)
            return false;
    // This stopped primitive uses explicit points already qualified in Scions.
    // It does not change the actor's position, target command or world association.
    if (!sched_holds_baton() || mods_hook_depth() || !gm_valid(unit, 0x164) ||
        rd32(unit) != 0x0068098c || rd32(unit + 0x60) || rd32(unit + 0x84) ||
        !gm_valid(factory, 0x8c))
        return false;
    const uint32_t grid = rd32(factory + 0x88), table_bytes = grid_extent * grid_extent * 4;
    if (!gm_valid(grid, 0x50) || rd32(grid + 0x48) != grid_extent || rd32(grid + 0x4c) != grid_extent)
        return false;
    const uint32_t search = rd32(grid + 0x14), actors = rd32(grid + 0x18);
    if (!gm_valid(search, table_bytes) || !gm_valid(actors, table_bytes))
        return false;
    // Never discard another search's dirty rectangle or pooled pointers.
    if (rd32(0x0071ca08) || rd32(0x0071ca10)) {
        std::fprintf(stderr, "[streaming] %s route preflight inherited-context=1\n", label);
        return false; // this fixture may retire only caches it created
    }
    for (uint32_t at = 0; at < table_bytes; at += 4)
        if (rd32(search + at)) {
            std::fprintf(stderr, "[streaming] %s route preflight search-busy=1 cell=%u\n", label,
                         at / 4);
            return false;
        }
    for (uint32_t at = 4; at <= 16; at += 4)
        if (rd32(grid + at) != UINT32_MAX) {
            std::fprintf(stderr, "[streaming] %s route preflight dirty-bounds=1 offset=%u\n", label,
                         at);
            return false;
        }
    auto digest = [](uint32_t address, uint32_t bytes) {
        uint64_t value = 14695981039346656037ull;
        for (uint32_t at = 0; at < bytes; ++at)
            value = (value ^ rd8(address + at)) * 1099511628211ull;
        return value;
    };
    const uint64_t unit_before = digest(unit, 0x164), grid_before = digest(grid, 0x50),
                   actors_before = digest(actors, table_bytes);
    const auto before = heap_stats();
    uint32_t pool_before = 0, pool_after = 0;
    if (!stage_pool_live(pool_before))
        return false;
    extra.r[R_ECX] = 0;
    const auto context = guest_call_guarded(&extra, 0x005ebfc0, nullptr, 0);
    if (context.status != GuestCallGuardedStatus::Returned || !gm_valid(context.eax, 28) ||
        rd32(0x0071ca10) != context.eax || rd32(context.eax + 0xc) != 8192 ||
        rd32(context.eax + 0x14) != 1024 || !gm_valid(rd32(context.eax + 8), 8192 * 28))
        return false;
    const uint32_t nodes = rd32(context.eax + 8), output = heap_alloc(output_bytes, false);
    if (!output)
        return false;
    std::memset(gm_ptr(output), 0xa5, output_bytes);
    bool ok = true;
    const std::array<std::array<uint32_t, 2>, 2> endpoint_points{{{points[0], points[1]}, {points[2], points[3]}}};
    for (uint32_t endpoint = 0; endpoint < 2; ++endpoint) {
        const auto &point = endpoint_points[endpoint];
        for (uint32_t flags : {0x200u, 0x400u}) {
            const uint32_t args[] = {unit, point[0], point[1], flags, 0, 0};
            extra.r[R_ECX] = grid;
            const auto clear = guest_call_guarded(&extra, 0x005b8eb0, args, 6);
            if (receiving_goal)
                std::fprintf(stderr, "[streaming] Return route endpoint x=%u y=%u flags=%u status=%u blocked=%u\n",
                    point[0], point[1], flags, unsigned(clear.status), clear.eax & 255);
            ok = ok && clear.status == GuestCallGuardedStatus::Returned &&
                ((receiving_goal && endpoint == 1) || !(clear.eax & 255));
        }
    }
    // Bound eight-neighbour expansion inside the original 8192-node pool.
    // Restore the shared default and retire this fixture's caches afterward.
    wr32(context.eax + 0x14, limit);
    const uint32_t args[] = {output + 16, max_points,        factory,   unit, points[0], points[1],
                             0,           points[2], points[3], 0,    0,         0x200};
    extra.r[R_ECX] = 0;
    ReturnRouteGoal goal{extra, factory, unit, points[2], points[3]};
    if (ok && receiving_goal &&
        (!mods_symbol_hookable(0x005e9b00) || mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005e9b00, 0,
            goal.callback, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, &goal, &goal.handle) != POP_OK)) std::abort();
    const auto route = ok ? guest_call_guarded(&extra, 0x005adef0, args, 12, &goal.cookie) : GuestCallGuardedResult{};
    goal.cookie = 0;
    if (goal.handle && mods_hook_remove(MODS_OWNER_RUNTIME, goal.handle) != POP_OK) std::abort();
    if (receiving_goal) {
        ok = ok && goal.calls == 1 && goal.resolved[0] < grid_extent && goal.resolved[1] < grid_extent;
        std::fprintf(stderr, "[streaming] Return route goal requested=%u,%u resolved=%u,%u observed=%u original=1\n",
            points[2], points[3], goal.resolved[0], goal.resolved[1], goal.calls);
    }
    wr32(context.eax + 0x14, 1024);
    const uint32_t count = route.eax, used_nodes = route.status == GuestCallGuardedStatus::Returned ? rd32(context.eax + 0x10) : 0;
    ok = ok && route.status == GuestCallGuardedStatus::Returned && count > 1 && count < max_points &&
         used_nodes > 0 && used_nodes <= 8 * limit + 1 && rd32(context.eax + 8) == nodes &&
         rd32(context.eax + 0xc) == 8192;
    uint32_t validated = 0;
    for (uint32_t i = 0; i < count && ok; ++i) {
        const uint32_t x = rd32(output + 16 + i * 8), y = rd32(output + 20 + i * 8);
        ok = x < grid_extent && y < grid_extent;
        if (!i)
            ok = ok && x == points[0] && y == points[1];
        else {
            const int32_t dx = int32_t(x) - int32_t(rd32(output + 8 + i * 8)),
                          dy = int32_t(y) - int32_t(rd32(output + 12 + i * 8));
            ok = ok && dx >= -1 && dx <= 1 && dy >= -1 && dy <= 1 && (dx || dy);
        }
        if (i + 1 == count)
            ok = ok && x == (receiving_goal ? goal.resolved[0] : points[2]) &&
                 y == (receiving_goal ? goal.resolved[1] : points[3]);
        const uint32_t point[] = {unit, x, y, 0x200, 0, 0};
        extra.r[R_ECX] = grid;
        const auto clear = guest_call_guarded(&extra, 0x005b8eb0, point, 6);
        ok = ok && clear.status == GuestCallGuardedStatus::Returned && !(clear.eax & 255);
        if (ok)
            ++validated;
    }
    bool redzones = count < max_points;
    for (uint32_t at = 0; at < output_bytes && redzones; ++at)
        if (at < 16 || at >= 16 + count * 8)
            redzones = rd8(output + at) == 0xa5;
    std::fprintf(stderr, "[streaming] %s route points warm=%u trial=%u count=%u values=", label,
                 unsigned(warm), trial, count);
    for (uint32_t i = 0; i < count && i < max_points; ++i)
        std::fprintf(stderr, "%s%u,%u", i ? ";" : "", rd32(output + 16 + i * 8),
                     rd32(output + 20 + i * 8));
    std::fprintf(stderr, "\n");
    // Original search leaves grid node pointers after copying coordinates.
    // Clear them before allowing the original pool to be reused.
    extra.r[R_ECX] = grid;
    const auto cleared = guest_call_guarded(&extra, 0x005b7e30, nullptr, 0);
    bool scratch_clear = cleared.status == GuestCallGuardedStatus::Returned;
    for (uint32_t at = 0; at < table_bytes && scratch_clear; at += 4)
        scratch_clear = !rd32(search + at);
    extra.r[R_ECX] = context.eax;
    const auto reset = guest_call_guarded(&extra, 0x005eb440, nullptr, 0);
    bool lists_empty =
        reset.status == GuestCallGuardedStatus::Returned && !rd32(context.eax + 0x10);
    for (uint32_t at : {0u, 4u}) {
        const uint32_t list = rd32(context.eax + at);
        lists_empty = lists_empty && gm_valid(list, 16) && rd32(list + 4) == rd32(list + 8);
    }
    if (!scratch_clear || !lists_empty || rd32(0x0071ca10) != context.eax)
        std::abort(); // never free nodes while a grid/list can still reference them
    // Both global caches were absent at entry and are owned by this stopped
    // fixture. Retire through their original process-teardown functions, after
    // removing every grid pointer into the node array. Never raw-free caches.
    extra.r[R_ECX] = 0;
    const auto goal_retired = guest_call_guarded(&extra, 0x005ea5b0, nullptr, 0);
    extra.r[R_ECX] = 0;
    const auto search_retired = guest_call_guarded(&extra, 0x005ec0f0, nullptr, 0);
    const bool caches_retired = goal_retired.status == GuestCallGuardedStatus::Returned &&
                                search_retired.status == GuestCallGuardedStatus::Returned &&
                                !rd32(0x0071ca08) && !rd32(0x0071ca10);
    std::array<uint32_t, Words> candidate{};
    if (ok)
        std::memcpy(candidate.data(), gm_ptr(output + 16), count * 8);
    ok = heap_free(output) && ok;
    const auto after = heap_stats();
    const int64_t bytes = int64_t(after.used_bytes) - int64_t(before.used_bytes),
                  blocks = int64_t(after.used_blocks) - int64_t(before.used_blocks);
    const bool preserved = digest(unit, 0x164) == unit_before &&
                           digest(grid, 0x50) == grid_before &&
                           digest(actors, table_bytes) == actors_before;
    const bool heap_ok = !bytes && !blocks && after.req_bytes == before.req_bytes;
    const bool pool_same = stage_pool_live(pool_after) && pool_before == pool_after;
    ok = ok && redzones && scratch_clear && lists_empty && caches_retired && preserved && heap_ok &&
         pool_same;
    std::fprintf(stderr,
                 "[streaming] %s route warm=%u trial=%u count=%u validated=%u capacity=%u "
                 "expansion-limit=%u used-nodes=%u node-capacity=8192 redzones=%u "
                 "scratch-clear=%u lists-empty=%u caches-retired=%u pool-same=%u preserved=%u "
                 "retained-bytes=%lld "
                 "retained-blocks=%lld result=%s\n",
                 label, unsigned(warm), trial, count, validated, max_points, limit, used_nodes,
                 unsigned(redzones), unsigned(scratch_clear), unsigned(lists_empty),
                 unsigned(caches_retired), unsigned(pool_same), unsigned(preserved),
                 static_cast<long long>(bytes), static_cast<long long>(blocks),
                 ok ? "pass" : "fail");
    if (ok && composed) {
        *captured = candidate;
        *captured_count = count;
    }
    return ok;
}

bool compose_private_move(X86 &extra, majesty::orders::Journal &journal, uint32_t unit,
                          uint32_t factory, const uint8_t *source_primary, uint32_t actor,
                          const StagedOrderClock *clocks, uint8_t *expected, uint32_t bytes,
                          uint32_t trial) {
    if (!source_primary || !clocks || !expected || bytes != 620 || clocks[0].offset < 20 ||
        !journal.fully_claimed() || journal.invocation_active() || !sched_holds_baton() ||
        mods_hook_depth() || !gm_valid(unit, 0x164) || rd32(unit + 0x60) || rd32(unit + 0x84) ||
        !gm_valid(factory, 0x84))
        return false;
    const auto *move = journal.find(majesty::orders::Role::Order, 0, 0);
    const uint32_t body = clocks[0].offset - 20;
    if (!move || !move->owned || !move->claimed || move->request.kind != 2 ||
        move->request.bytes != 92 || body > bytes - 176 || rd32(move->address) != 0x006830d8 ||
        rd32(move->address + 0x38) ||
        (rd32(move->address + 0x34) != 0 && rd32(move->address + 0x34) != 0x4000))
        return false;
    auto word = [](const uint8_t *data, uint32_t at) {
        int32_t value;
        std::memcpy(&value, data + at, 4);
        return value;
    };
    std::array<int32_t, 3> old{}, goal{};
    std::array<int32_t, 2> delta{};
    for (uint32_t axis = 0; axis < 3; ++axis) {
        old[axis] = int32_t(rd32(move->address + 0x3c + axis * 4));
        if (old[axis] != word(expected, body + 104 + axis * 4))
            return false;
        if (axis == 2)
            continue;
        const int64_t shift =
            int64_t(int32_t(rd32(unit + 0x48 + axis * 4))) - word(source_primary, 60 + axis * 4);
        const int64_t point = int64_t(old[axis]) + shift;
        // This stopped fixture translates a single 4096-pixel region origin.
        // The in-flight step must retain its exact remaining displacement and
        // land at the actor's independently translated logical navigation cell.
        if ((shift != 0 && shift != -8388608) || point < 0 || point >= 8388608 ||
            int64_t(old[axis]) != int64_t(word(source_primary, 72 + axis * 4)) * 32768 ||
            point != int64_t(int32_t(rd32(unit + 0x54 + axis * 4))) * 32768)
            return false;
        delta[axis] = int32_t(shift);
        goal[axis] = int32_t(point);
    }
    if ((delta[0] == 0) == (delta[1] == 0))
        return false;
    const uint32_t terrain = rd32(factory + 0x80);
    if (!gm_valid(terrain, 0x50) || rd32(terrain + 0x30) != 128 || rd32(terrain + 0x34) != 128 ||
        rd32(terrain + 0x38) != 129 || !gm_valid(rd32(terrain + 0x4c), 129 * 129 * 24) ||
        uint32_t(goal[0]) / 65536 + 1 >= 128 || uint32_t(goal[1]) / 65536 + 1 >= 128)
        return false;
    std::array<uint8_t, 92> before{};
    std::array<uint8_t, 0x164> actor_before{};
    std::memcpy(before.data(), gm_ptr(move->address), before.size());
    std::memcpy(actor_before.data(), gm_ptr(unit), actor_before.size());
    const auto baseline = heap_stats();
    const uint32_t output = heap_alloc(16, false);
    if (!output)
        return false;
    std::memset(gm_ptr(output), 0xa5, 16);
    const uint32_t sample[] = {output + 4, uint32_t(goal[0]), uint32_t(goal[1])};
    extra.r[R_ECX] = terrain;
    const auto height = journal.invoke(&extra, 0x005af220, sample, 3);
    bool ok = height.status == GuestCallGuardedStatus::Returned && height.eax == output + 4;
    for (uint32_t at = 0; at < 16; ++at)
        if (at < 4 || at >= 8)
            ok = ok && rd8(output + at) == 0xa5;
    goal[2] = int32_t(rd32(output + 4));
    ok = heap_free(output) && ok;
    const auto sampled = heap_stats();
    ok = ok && baseline.used_bytes == sampled.used_bytes &&
         baseline.used_blocks == sampled.used_blocks && baseline.req_bytes == sampled.req_bytes &&
         !std::memcmp(before.data(), gm_ptr(move->address), before.size()) &&
         !std::memcmp(actor_before.data(), gm_ptr(unit), actor_before.size());
    if (ok) {
        const uint32_t args[] = {uint32_t(goal[0]), uint32_t(goal[1]), uint32_t(goal[2])};
        extra.r[R_ECX] = move->address;
        const auto changed = journal.invoke(&extra, 0x005b7990, args, 3);
        ok = changed.status == GuestCallGuardedStatus::Returned;
        for (uint32_t at = 0; at < before.size() && ok; ++at)
            if (at < 0x3c || at >= 0x48)
                ok = rd8(move->address + at) == before[at];
        for (uint32_t axis = 0; axis < 3 && ok; ++axis)
            ok = int32_t(rd32(move->address + 0x3c + axis * 4)) == goal[axis];
        ok = ok && !std::memcmp(actor_before.data(), gm_ptr(unit), actor_before.size());
        if (ok)
            std::memcpy(expected + body + 104, goal.data(), 12);
    }
    std::fprintf(stderr,
                 "[streaming] Composed move actor=%u trial=%u old=%d,%d,%d delta=%d,%d "
                 "goal=%d,%d,%d remaining-preserved=1 point-only=%u actor-same=%u "
                 "scratch-released=1 result=%s\n",
                 actor, trial, old[0], old[1], old[2], delta[0], delta[1], goal[0], goal[1],
                 goal[2], unsigned(ok),
                 unsigned(!std::memcmp(actor_before.data(), gm_ptr(unit), actor_before.size())),
                 ok ? "pass" : "fail");
    return ok;
}

bool compose_private_route(X86 &extra, majesty::orders::Journal &journal, uint32_t unit,
                           uint32_t factory, const CrossBindingSource &binding,
                           const StagedOrderClock *clocks, uint8_t *expected, uint32_t bytes,
                           uint32_t trial, uint32_t &serialized_bytes) {
    if (!clocks || !expected || bytes != 620 || !journal.fully_claimed() ||
        journal.invocation_active() || !sched_holds_baton() || mods_hook_depth() ||
        !gm_valid(unit, 0x164) || rd32(unit + 0x60) || rd32(unit + 0x84) ||
        binding.source_bytes < 72 || binding.destination_bytes < 72 || clocks[1].offset < 20)
        return false;
    const uint32_t body = clocks[1].offset - 20;
    const auto *order = journal.find(majesty::orders::Role::Order, 0, 1);
    const auto *path = journal.find(majesty::orders::Role::Path, 0, 1);
    if (body > bytes - 220 || !order || !path || !order->owned || !order->claimed || !path->owned ||
        !path->claimed || order->request.bytes != 100 || path->request.bytes != 512 ||
        rd32(order->address) != 0x0068add8 || rd32(order->address + 0x38) != binding.after ||
        rd32(order->address + 0x44) != path->address || rd32(order->address + 0x48) ||
        rd32(order->address + 0x4c) || rd32(order->address + 0x5c) != 64)
        return false;
    auto word = [](const uint8_t *data, uint32_t at) {
        int32_t value;
        std::memcpy(&value, data + at, 4);
        return value;
    };
    std::array<int32_t, 2> old{}, offset{}, goal{};
    for (uint32_t axis = 0; axis < 2; ++axis) {
        old[axis] = int32_t(rd32(order->address + 0x3c + axis * 4));
        if (old[axis] != word(expected, body + 104 + axis * 4))
            return false;
        // The supplied entity mapping is a fixture policy. Preserve its saved
        // approach offset around the destination target, never a source route.
        const int64_t relative =
            int64_t(old[axis]) - (word(binding.source.data(), 60 + axis * 4) >> 11);
        const int64_t destination =
            (word(binding.destination.data(), 60 + axis * 4) >> 11) + relative;
        if (relative < INT32_MIN || relative > INT32_MAX || destination < 0 || destination >= 4096)
            return false;
        offset[axis] = int32_t(relative);
        goal[axis] = int32_t(destination);
    }
    std::array<uint8_t, 100> before{};
    std::memcpy(before.data(), gm_ptr(order->address), before.size());
    const uint32_t args[] = {uint32_t(goal[0]), uint32_t(goal[1])};
    extra.r[R_ECX] = order->address;
    const auto rebound = journal.invoke(&extra, 0x005e1aa0, args, 2);
    bool ok = rebound.status == GuestCallGuardedStatus::Returned && rebound.eax == args[0];
    for (uint32_t at = 0; at < before.size() && ok; ++at)
        if (!(at >= 0x3c && at < 0x44))
            ok = rd8(order->address + at) == before[at];
    for (uint32_t axis = 0; axis < 2 && ok; ++axis) {
        ok = rd32(order->address + 0x3c + axis * 4) == args[axis];
        std::memcpy(expected + body + 104 + axis * 4, args + axis, 4);
    }
    const std::array<uint32_t, 4> endpoints{rd32(unit + 0x48) / 2048 / 16,
                                            rd32(unit + 0x4c) / 2048 / 16, uint32_t(goal[0]) / 16,
                                            uint32_t(goal[1]) / 16};
    std::fprintf(stderr,
                 "[streaming] Composed goal trial=%u old=%d,%d offset=%d,%d goal=%d,%d "
                 "start=%u,%u end=%u,%u preserved=%u result=%s\n",
                 trial, old[0], old[1], offset[0], offset[1], goal[0], goal[1], endpoints[0],
                 endpoints[1], endpoints[2], endpoints[3], unsigned(ok), ok ? "pass" : "fail");
    std::array<uint32_t, 128> route{};
    uint32_t count = 0;
    ok = ok && probe_cross_route(extra, unit, factory, trial, false, &endpoints, &route, &count);
    if (!ok || count <= 1 || count >= 64 || rd32(order->address + 0x44) != path->address ||
        rd32(order->address + 0x48) || rd32(order->address + 0x4c) ||
        rd32(order->address + 0x5c) != 64 || journal.invocation_active())
        return false;
    const uint32_t points = body + 140, cleared_bytes = bytes - 80;
    if (points > cleared_bytes || cleared_bytes + count * 8 > 2048)
        return false;
    std::memcpy(gm_ptr(path->address), route.data(), count * 8);
    wr32(order->address + 0x4c, count);
    std::memmove(expected + points + count * 8, expected + points, cleared_bytes - points);
    std::memcpy(expected + points, route.data(), count * 8);
    std::memcpy(expected + body + 136, &count, 4);
    serialized_bytes = cleared_bytes + count * 8;
    std::fprintf(stderr,
                 "[streaming] Composed attachment trial=%u count=%u cursor=0 capacity=64 "
                 "owned-bytes=512 serialized-bytes=%u result=pass\n",
                 trial, count, serialized_bytes);
    return true;
}

bool compose_actor_script(X86 &extra, uint32_t factory, uint32_t unit, uint32_t source_unit,
                          uint32_t trial, const uint8_t *commands, uint32_t command_bytes);
bool native_identity_enabled();
bool stage_populated_orders(X86 &extra, uint32_t unit, const majesty::orders::Request *requests,
                            uint32_t count, const uint8_t *payload, uint32_t bytes,
                            const uint32_t *counts, const StagedOrderClock *clocks, uint32_t trial,
                            const CrossBindingSource *binding = nullptr,
                            const StagedOrderTarget *targets = nullptr, uint32_t factory = 0,
                            bool composed = false, bool replay = false, uint32_t script_actor = 0,
                            const uint8_t *source_primary = nullptr) {
    if (!payload || bytes < 24 || bytes > 2048 || count < 6 || count > 32)
        return false;
    if (replay &&
        (composed || binding || clocks || targets || count != 18 || bytes <= 548 ||
         (bytes - 540) % 8 || (bytes - 540) / 8 >= 64 || rd32(unit + 0x60) || rd32(unit + 0x84)))
        return false;
    const char *label = composed ? "Composed" : (replay ? "Replayed" : "Populated");
    std::array<majesty::orders::Request, 32> composed_requests{};
    std::array<uint8_t, 2048> composed_payload{};
    if (composed) {
        if (!binding || !targets || !clocks || bytes != 620 || clocks[1].offset < 20 ||
            clocks[1].offset - 20 > bytes - 220)
            return false;
        std::memcpy(composed_requests.data(), requests, count * sizeof *requests);
        std::memcpy(composed_payload.data(), payload, bytes);
        uint32_t paths = 0;
        for (uint32_t i = 0; i < count; ++i) {
            auto &request = composed_requests[i];
            if (request.role != majesty::orders::Role::Path)
                continue;
            if (request.bank != 0 || request.index != 1 || request.kind != 4 || request.bytes != 80)
                return false;
            request.bytes = 512;
            ++paths;
        }
        uint32_t capacity = 0;
        const uint32_t capacity_offset = clocks[1].offset - 20 + 128;
        std::memcpy(&capacity, payload + capacity_offset, 4);
        if (paths != 1 || capacity != 10)
            return false;
        capacity = 64;
        std::memcpy(composed_payload.data() + capacity_offset, &capacity, 4);
        requests = composed_requests.data();
        payload = composed_payload.data();
    }
    const uint32_t data_capacity = composed ? 2048 : bytes;
    uint32_t serialized_bytes = bytes;
    const auto baseline = heap_stats();
    uint8_t actor_before[0x164];
    std::memcpy(actor_before, gm_ptr(unit), sizeof actor_before);
    majesty::orders::Journal journal;
    PendingOrderCleanup cleanup{journal, requests, count};
    if (!journal.reserve(requests, count, {&cleanup, cleanup.allocate, cleanup.release}))
        return false;
    uint32_t buffer = heap_alloc(100, true), io = heap_alloc(92, true);
    uint32_t wrapper = heap_alloc(16, true), data = heap_alloc(data_capacity + 32, false);
    if (!buffer || !io || !wrapper || !data)
        std::abort(); // isolated fixture; never lose its still-owned journal
    std::memset(gm_ptr(data), 0xa5, data_capacity + 32);
    std::memcpy(gm_ptr(data + 16), payload, bytes);
    auto invoke = [&](uint32_t fn, uint32_t receiver, const uint32_t *args, int n) {
        extra.r[R_ECX] = receiver;
        return guest_call_guarded(&extra, fn, args, n);
    };
    auto open_stream = [&](bool output) {
        std::memset(gm_ptr(buffer), 0, 100);
        std::memset(gm_ptr(io), 0, 92);
        wr32(wrapper, 0);
        wr32(wrapper + 4, 0);
        uint32_t b[] = {data + 16, output ? serialized_bytes : bytes, output ? data + 16 : 0},
                 i[] = {buffer, 1};
        if (invoke(0x0064a97f, buffer, b, 3).status != GuestCallGuardedStatus::Returned ||
            invoke(output ? 0x006497f3 : 0x0064b68a, io, i, 2).status !=
                GuestCallGuardedStatus::Returned)
            std::abort();
        wr32(wrapper, io);
    };
    auto close_stream = [&](bool output) {
        uint32_t deleting = 0;
        if (invoke(output ? 0x006497c8 : 0x0064b65f, io + (output ? 8 : 12), &deleting, 1).status !=
                GuestCallGuardedStatus::Returned ||
            invoke(0x0064aa1e, buffer, nullptr, 0).status != GuestCallGuardedStatus::Returned)
            std::abort();
    };
    // Live manager 682ed0 creates the same 92-byte kind-2 layout at
    // 4a90b4 through derived constructor 4ab850. Keep the real manager;
    // its selected other kinds delegate to the original library factory.
    constexpr majesty::orders::EntryPoints sites{0x004abcc0,
                                                 0x005e4d20,
                                                 {0x005e4c71, 0x005da543, 0x004a90b4, 0x005da5e5,
                                                  0x005da61b, 0x005da651, 0x005da687, 0x005da6f3,
                                                  0x005da729, 0x005e0e39, 0x005e2b61, 0x005e4dc9},
                                                 0x00523485};
    majesty::orders::AllocationBridge bridge(journal, sites);
    auto allocation_trace = [](void *p, bool name, const majesty::orders::AllocationDecision &d) {
        if (d.action == majesty::orders::AllocationAction::Stop) {
            const auto &cpu = *static_cast<X86 *>(p);
            std::fprintf(
                stderr,
                "[streaming] Populated allocation stopped name=%u pc=%08x bytes=%u failure=%u\n",
                unsigned(name), rd32(cpu.r[R_ESP]), rd32(cpu.r[R_ESP] + 4), unsigned(d.failure));
        }
    };
    majesty::orders::ReaderHooks hooks(bridge, {&extra, allocation_trace});
    open_stream(false);
    bool ok = hooks.install();
    if (ok) {
        const auto loaded =
            hooks.read_unit(&extra, unit, wrapper, {0x005b1b90, 0x0043010f, 0x0068098c, 0x88});
        ok = loaded.complete && loaded.guest.status == GuestCallGuardedStatus::Returned &&
             !loaded.guest.eax && journal.fully_claimed();
        std::fprintf(stderr,
                     "[streaming] %s graph read complete=%u status=%u eax=%08x claimed=%u "
                     "failure=%u\n",
                     label, unsigned(loaded.complete), unsigned(loaded.guest.status),
                     loaded.guest.eax, unsigned(journal.fully_claimed()),
                     unsigned(bridge.failure()));
    }
    if (!hooks.remove())
        std::abort();
    close_stream(false);
    for (uint32_t bank = 0; bank < 3 && ok; ++bank) {
        const auto *b = journal.find(majesty::orders::Role::Bank, bank);
        const auto *h = journal.find(majesty::orders::Role::Head, bank);
        ok = b && h && rd32(unit + 0x88 + bank * 4) == b->address && rd32(b->address + 4) == unit &&
             rd32(b->address + 16) == counts[bank];
        uint32_t node = h ? rd32(h->address) : 0, previous = h ? h->address : 0;
        for (uint32_t i = 0; i < counts[bank] && ok; ++i) {
            const auto *n = journal.find(majesty::orders::Role::Node, bank, i);
            const auto *o = journal.find(majesty::orders::Role::Order, bank, i);
            ok = n && o && node == n->address && rd32(node + 4) == previous &&
                 rd32(node + 8) == o->address;
            if (ok) {
                previous = node;
                node = rd32(node);
            }
        }
        ok = ok && node == h->address && rd32(h->address + 4) == previous;
    }
    for (unsigned i = 0; i < sizeof actor_before && ok; ++i)
        if (i < 0x88 || i >= 0x94)
            ok = rd8(unit + i) == actor_before[i];
    std::fprintf(stderr, "[streaming] %s graph structure-and-actor=%u\n", label, unsigned(ok));
    std::array<uint8_t, 2048> expected{};
    expected.fill(0xa5);
    std::memcpy(expected.data(), payload, bytes);
    const char *navigation_flag = recomp_env("BROWSER_STREAMING_CROSS_NAVIGATION_FIXTURE");
    if (ok && !composed && !replay && navigation_flag && !std::strcmp(navigation_flag, "1"))
        ok = binding && probe_cross_navigation(extra, journal, unit, factory, trial);
    if (ok && clocks && !binding)
        ok =
            probe_private_order_clocks(extra, journal, unit, clocks, expected.data(), bytes, trial);
    if (ok && binding) {
        std::array<std::array<uint8_t, 200>, 3> snapshots{};
        std::array<const majesty::orders::Block *, 3> blocks{};
        for (uint32_t i = 0; i < 3; ++i) {
            blocks[i] = journal.find(majesty::orders::Role::Order, clocks[i].bank, clocks[i].index);
            if (!blocks[i] || blocks[i]->request.bytes > 200)
                std::abort();
            std::memcpy(snapshots[i].data(), gm_ptr(blocks[i]->address), blocks[i]->request.bytes);
        }
        uint32_t destination_clock = 0;
        for (uint32_t control = 0; control < 4; ++control) {
            auto wrong = *binding;
            std::array<StagedOrderTarget, 2> wrong_targets{targets[0], targets[1]};
            if (control == 0)
                wrong.after = 0x7ffffffe;
            if (control == 1)
                wrong.player = (wrong.player + 1) % 9;
            if (control == 2)
                wrong.description ^= 1;
            if (control == 3)
                ++wrong_targets[1].before;
            if (bind_private_orders(extra, journal, unit, factory, wrong, clocks,
                                    wrong_targets.data(), expected.data(), bytes,
                                    destination_clock) ||
                std::memcmp(expected.data(), payload, bytes))
                std::abort();
            for (uint32_t i = 0; i < 3; ++i)
                if (std::memcmp(snapshots[i].data(), gm_ptr(blocks[i]->address),
                                blocks[i]->request.bytes))
                    std::abort();
        }
        ok = bind_private_orders(extra, journal, unit, factory, *binding, clocks, targets,
                                 expected.data(), bytes, destination_clock);
        uint32_t stamps[3]{};
        for (uint32_t i = 0; i < 3 && ok; ++i) {
            stamps[i] = rd32(blocks[i]->address + 8);
            ok = stamps[i] == destination_clock - (binding->source_clock - clocks[i].when) &&
                 (!i || rd32(blocks[i]->address + 0x38) == binding->after);
            for (uint32_t at = 0; at < blocks[i]->request.bytes && ok; ++at)
                if (!(at >= 8 && at < 12) && !(i && at >= 0x38 && at < 0x3c))
                    ok = rd8(blocks[i]->address + at) == snapshots[i][at];
        }
        std::fprintf(stderr,
                     "[streaming] %s binding trial=%u before=%u after=%u source-clock=%u "
                     "destination-clock=%u refused=4 targets=2 clocks=3 when=%u,%u,%u result=%s\n",
                     composed ? "Composed" : "Cross", trial, binding->before, binding->after,
                     binding->source_clock, destination_clock, stamps[0], stamps[1], stamps[2],
                     ok ? "pass" : "fail");
    }
    const char *invalidate_flag = recomp_env("BROWSER_STREAMING_CROSS_REPLAN_FIXTURE");
    if (ok && !replay && invalidate_flag && !std::strcmp(invalidate_flag, "1"))
        ok = binding && navigation_flag && !std::strcmp(navigation_flag, "1") &&
             invalidate_private_path(journal, clocks, expected.data(), bytes, trial, composed);
    const char *landing_flag = recomp_env("BROWSER_STREAMING_CROSS_LANDING_FIXTURE");
    if (ok && !composed && !replay && landing_flag && !std::strcmp(landing_flag, "1"))
        ok = binding && invalidate_flag && !std::strcmp(invalidate_flag, "1") &&
             probe_cross_landing(extra, unit, factory, binding->after, trial);
    const char *route_flag = recomp_env("BROWSER_STREAMING_CROSS_ROUTE_FIXTURE");
    if (ok && !composed && !replay && route_flag && !std::strcmp(route_flag, "1"))
        ok = landing_flag && !std::strcmp(landing_flag, "1") &&
             probe_cross_route(extra, unit, factory, trial, false);
    const char *move_flag = recomp_env("BROWSER_STREAMING_REBASE_MOVE_FIXTURE");
    if (ok && composed && move_flag && !std::strcmp(move_flag, "1"))
        ok = compose_private_move(extra, journal, unit, factory, source_primary, script_actor,
                                  clocks, expected.data(), bytes, trial);
    if (ok && composed)
        ok = invalidate_flag && !std::strcmp(invalidate_flag, "1") &&
             compose_private_route(extra, journal, unit, factory, *binding, clocks, expected.data(),
                                   bytes, trial, serialized_bytes);
    const char *script_compose_flag = recomp_env("BROWSER_STREAMING_SCRIPT_COMPOSE_FIXTURE");
    if (ok && composed && script_compose_flag && !std::strcmp(script_compose_flag, "1"))
        ok = script_actor && compose_actor_script(extra, factory, unit, script_actor, trial,
                                                  expected.data(), serialized_bytes);
    if (ok && composed && native_identity_enabled()) {
        // Original ORDR publication (005f2920) marks a nonempty command bank
        // with bit one at UNIT+40. Preserve that original derived state until
        // owned destruction; do not rewind it to satisfy a private baseline.
        uint32_t marker;
        std::memcpy(&marker, actor_before + 0x40, 4);
        marker |= 1;
        std::memcpy(actor_before + 0x40, &marker, 4);
    }
    if (ok) {
        std::memset(gm_ptr(data + 16), 0xa5, data_capacity);
        open_stream(true);
        extra.r[R_ECX] = unit;
        const auto written = journal.invoke(&extra, 0x005b1be0, &wrapper, 1);
        ok =
            written.status == GuestCallGuardedStatus::Returned && !written.eax &&
            !std::memcmp(gm_ptr(data + 16), expected.data(), composed ? serialized_bytes : bytes) &&
            journal.state() == majesty::orders::State::Reserved;
        std::fprintf(stderr, "[streaming] %s graph writer equal=%u status=%u eax=%08x\n", label,
                     unsigned(ok), unsigned(written.status), written.eax);
        close_stream(true);
        if (ok && (composed || replay)) {
            char path[1024];
            FILE *file =
                recomp_writable_path(composed ? "Composed_Orders.bin" : "Replayed_Orders.bin", path,
                                     sizeof path)
                    ? std::fopen(path, "wb")
                    : nullptr;
            ok = file &&
                 std::fwrite(gm_ptr(data + 16), 1, serialized_bytes, file) == serialized_bytes;
            if (file)
                ok = std::fclose(file) == 0 && ok;
        }
    }
    if (!ok)
        std::abort(); // preserve failed graph; no inferred partial original teardown
    if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x0064d4b6, 0, cleanup.callback, POP_HOOK_WRAP,
                             POP_HOOK_NO_GAME_VIEW, &cleanup, &cleanup.handle) != POP_OK)
        std::abort();
    for (uint32_t bank = 0; bank < 3; ++bank) {
        const uint32_t address = rd32(unit + 0x88 + bank * 4);
        extra.r[R_ECX] = address;
        auto drained = journal.invoke_cleanup(&extra, 0x005e4ff0, nullptr, 0);
        std::fprintf(stderr, "[streaming] %s graph drain bank=%u status=%u count=%u frees=%u\n",
                     label, bank, unsigned(drained.status), rd32(address + 16), cleanup.frees);
        if (drained.status != GuestCallGuardedStatus::Returned || rd32(address + 16))
            std::abort();
        extra.r[R_ECX] = unit;
        if (journal.invoke_cleanup(&extra, 0x005b2de0, &bank, 1).status !=
                GuestCallGuardedStatus::Returned ||
            rd32(unit + 0x88 + bank * 4))
            std::abort();
    }
    uint32_t expected_frees = 0;
    for (uint32_t i = 0; i < count; ++i)
        expected_frees += requests[i].bytes != 0;
    std::fprintf(stderr, "[streaming] %s graph cleanup frees=%u expected=%u retained=%u\n", label,
                 cleanup.frees, expected_frees, journal.owned_request_bytes());
    if (mods_hook_remove(MODS_OWNER_RUNTIME, cleanup.handle) != POP_OK ||
        cleanup.frees != expected_frees || journal.owned_request_bytes() || !journal.release())
        std::abort();
    for (uint32_t i = 0; i < 16; ++i)
        ok = ok && rd8(data + i) == 0xa5 && rd8(data + data_capacity + 16 + i) == 0xa5;
    if (composed || replay) {
        for (uint32_t i = serialized_bytes; i < data_capacity && ok; ++i)
            ok = rd8(data + 16 + i) == 0xa5;
        ok = ok && !std::memcmp(actor_before, gm_ptr(unit), sizeof actor_before);
    }
    ok = heap_free(data) && heap_free(wrapper) && heap_free(io) && heap_free(buffer) && ok;
    const auto after = heap_stats();
    ok = ok && after.used_bytes == baseline.used_bytes &&
         after.used_blocks == baseline.used_blocks && after.req_bytes == baseline.req_bytes;
    if (composed || replay)
        std::fprintf(stderr,
                     "[streaming] %s graph recovery trial=%u bytes=%u actor-same=%u "
                     "heap-same=%u result=%s\n",
                     label, trial, serialized_bytes,
                     unsigned(!std::memcmp(actor_before, gm_ptr(unit), sizeof actor_before)),
                     unsigned(after.used_bytes == baseline.used_bytes &&
                              after.used_blocks == baseline.used_blocks &&
                              after.req_bytes == baseline.req_bytes),
                     ok ? "pass" : "fail");
    if (ok && composed) {
        std::array<uint8_t, 2048> saved{};
        char path[1024];
        FILE *file = recomp_writable_path("Composed_Orders.bin", path, sizeof path)
                         ? std::fopen(path, "rb")
                         : nullptr;
        ok = file && std::fread(saved.data(), 1, serialized_bytes, file) == serialized_bytes &&
             std::fgetc(file) == EOF && !std::ferror(file) &&
             !std::memcmp(saved.data(), expected.data(), serialized_bytes);
        if (file)
            ok = std::fclose(file) == 0 && ok;
        std::fprintf(stderr,
                     "[streaming] Composed disk replay trial=%u bytes=%u exact-file=%u result=%s\n",
                     trial, serialized_bytes, unsigned(ok), ok ? "pass" : "fail");
        ok = ok &&
             stage_populated_orders(extra, unit, requests, count, saved.data(), serialized_bytes,
                                    counts, nullptr, trial, nullptr, nullptr, factory, false, true);
    }
    return ok;
}

struct PopulatedStageCase {
    uint32_t id = 0, unit_bytes = 0, count = 0, bytes = 0, counts[3]{};
    std::array<uint8_t, 4096> unit{};
    std::array<majesty::orders::Request, 32> requests{};
    std::array<uint8_t, 2048> payload{};
    std::array<StagedOrderClock, 3> clocks{};
    std::array<StagedOrderTarget, 2> targets{};
};

bool script_namespace_witness(X86 &extra, uint32_t scratch, uint32_t factory, uint32_t unit,
                              bool source_side);
bool private_script_stage(X86 &extra, uint32_t scratch, uint32_t factory);
bool native_identity_enabled();
bool native_identity_warm(X86 &extra, uint32_t factory, uint32_t unit, uint32_t source_unit);

bool probe_cross_ground(X86 &extra, uint32_t temporary, uint32_t factory,
                        const PopulatedStageCase &c, const uint32_t *placement, uint32_t trial) {
    char path[1024];
    if (!recomp_writable_path("Ground_Samples.bin", path, sizeof path))
        return false;
    std::array<uint32_t, 27> words{};
    FILE *file = std::fopen(path, "rb");
    bool ok = file && std::fread(words.data(), 1, sizeof words, file) == sizeof words &&
              std::fgetc(file) == EOF && !std::ferror(file);
    if (file)
        ok = std::fclose(file) == 0 && ok;
    if (!ok || words[0] != 0x3148474e || words[1] != 1 || words[2] != 4)
        return false;
    const uint32_t *sample = nullptr;
    for (uint32_t i = 0; i < 4; ++i)
        if (words[3 + i * 6] == c.id) {
            if (sample)
                return false;
            sample = words.data() + 3 + i * 6;
        }
    if (!sample || sample[1] != placement[4] || sample[2] != placement[5] ||
        sample[3] != placement[6] || !gm_valid(factory, 0x84))
        return false;
    const uint32_t terrain = rd32(factory + 0x80);
    if (!gm_valid(terrain, 0x50))
        return false;
    const uint32_t width = rd32(terrain + 0x30), height = rd32(terrain + 0x34),
                   stride = rd32(terrain + 0x38), vertices = rd32(terrain + 0x4c),
                   vertex_bytes = 129 * 129 * 24;
    if ((width != 128 && width != 129) || (height != 128 && height != 129) || stride != 129 ||
        !gm_valid(vertices, vertex_bytes) || sample[1] / 65536 + 1 >= width ||
        sample[2] / 65536 + 1 >= height)
        return false;
    auto digest = [](uint32_t address, uint32_t bytes) {
        uint64_t value = 14695981039346656037ull;
        for (uint32_t at = 0; at < bytes; ++at)
            value = (value ^ rd8(address + at)) * 1099511628211ull;
        return value;
    };
    const auto before = heap_stats();
    const uint64_t terrain_before = digest(terrain, 0x50),
                   vertices_before = digest(vertices, vertex_bytes);
    const uint32_t hooks = mods_hooks_installed_count();
    uint32_t pool_before = 0, pool_after = 0;
    if (!stage_pool_live(pool_before))
        return false;
    std::array<uint8_t, 48> sentinels{};
    std::memcpy(sentinels.data(), gm_ptr(temporary), 48);
    const uint32_t output = temporary + 36, args[] = {output, sample[1], sample[2]};
    extra.r[R_ECX] = terrain;
    const auto result = guest_call_guarded(&extra, 0x005af220, args, 3);
    const int32_t ground = int32_t(rd32(output));
    const auto after = heap_stats();
    const bool preserved = digest(terrain, 0x50) == terrain_before &&
                           digest(vertices, vertex_bytes) == vertices_before;
    const bool balanced = before.used_bytes == after.used_bytes &&
                          before.used_blocks == after.used_blocks &&
                          before.req_bytes == after.req_bytes && stage_pool_live(pool_after) &&
                          pool_before == pool_after && mods_hooks_installed_count() == hooks;
    ok = result.status == GuestCallGuardedStatus::Returned && result.eax == output &&
         rd32(output) == sample[5] && preserved && balanced;
    for (uint32_t at = 0; at < 48; ++at)
        if (at < 36 || at >= 40)
            ok = ok && rd8(temporary + at) == sentinels[at];
    std::fprintf(stderr,
                 "[streaming] Cross ground actor=%u trial=%u terrain=%u,%u stride=%u "
                 "fixed=%d,%d source-z=%d source-ground=%d destination-ground=%d "
                 "preserved=%u balanced=%u result=%s\n",
                 c.id, trial, width, height, stride, int32_t(sample[1]), int32_t(sample[2]),
                 int32_t(sample[3]), int32_t(sample[4]), ground, unsigned(preserved),
                 unsigned(balanced), ok ? "pass" : "fail");
    // Diagnostic only: actor Z, saved motion state and command payloads remain unchanged.
    return ok;
}

bool ground_private_primary(const uint8_t *original, uint32_t bytes, uint32_t ground,
                            uint8_t *prepared) {
    auto word = [&](uint32_t at) {
        uint32_t value;
        std::memcpy(&value, original + at, 4);
        return value;
    };
    // PRIMARY's raw 60-byte block contains presence/mode. Cache version/value
    // follow it at 92/96. Refuse parented/flying/active-cache states before edits.
    if (bytes != 375 || word(0) != 0x54494e55 || word(16) != 0x4d495250 || word(24) != 9 ||
        word(56) || word(80) != 1 || word(84) != 1 || word(92) != 1 || word(96))
        return false;
    std::memcpy(prepared + 68, &ground, 4);
    return true;
}

bool probe_cross_placement(X86 &extra, uint32_t scratch, uint32_t factory,
                           const PopulatedStageCase &c, uint32_t trial,
                           const CrossBindingSource *binding = nullptr) {
    char path[1024];
    if (!recomp_writable_path("Cross_Placement.bin", path, sizeof path))
        return false;
    std::array<uint32_t, 63> words{};
    FILE *file = std::fopen(path, "rb");
    bool ok = file && std::fread(words.data(), 1, sizeof words, file) == sizeof words &&
              std::fgetc(file) == EOF && !std::ferror(file);
    if (file)
        ok = std::fclose(file) == 0 && ok;
    if (!ok || words[0] != 0x3150414e || words[1] != 2 || words[2] != 4 || c.unit_bytes != 375)
        return false;
    const uint32_t *placement = nullptr;
    for (uint32_t i = 0; i < 4; ++i)
        if (words[3 + i * 15] == c.id) {
            if (placement)
                return false;
            placement = words.data() + 3 + i * 15;
        }
    if (!placement)
        return false;
    auto original = [&](uint32_t at) {
        uint32_t value;
        std::memcpy(&value, c.unit.data() + at, 4);
        return value;
    };
    for (uint32_t axis = 0; axis < 3; ++axis)
        if (placement[1 + axis] != original(60 + axis * 4))
            return false;
    const int32_t dx = int32_t(placement[7]), dy = int32_t(placement[8]);
    if ((dx != 0 && dx != -4096) || (dy != 0 && dy != -4096) || placement[6] != placement[3] ||
        original(56))
        return false;
    for (uint32_t axis = 0; axis < 2; ++axis) {
        const int64_t translated =
            int64_t(int32_t(placement[1 + axis])) + int64_t(axis ? dy : dx) * 2048;
        if (translated < 0 || translated >= 4096 * 2048 ||
            uint64_t(translated) != placement[4 + axis] ||
            uint32_t(translated / 2048 / 16) != placement[9 + axis])
            return false;
        const int64_t cell = int64_t(original(72 + axis * 4)) + (axis ? dy : dx) / 16;
        if (original(72 + axis * 4) != placement[11 + axis] || cell < 0 || cell >= 256 ||
            uint32_t(cell) != placement[13 + axis])
            return false;
    }
    const uint32_t grid = gm_valid(factory, 0x8c) ? rd32(factory + 0x88) : 0;
    if (!gm_valid(grid, 0x50) || rd32(grid + 0x48) != 256 || rd32(grid + 0x4c) != 256)
        return false;
    const uint32_t search = rd32(grid + 0x14), actors = rd32(grid + 0x18),
                   table_bytes = 256 * 256 * 4;
    if (!gm_valid(search, table_bytes) || !gm_valid(actors, table_bytes))
        return false;
    auto digest = [](uint32_t address, uint32_t bytes) {
        uint64_t value = 14695981039346656037ull;
        for (uint32_t at = 0; at < bytes; ++at)
            value = (value ^ rd8(address + at)) * 1099511628211ull;
        return value;
    };
    const uint64_t grid_before = digest(grid, 0x50), search_before = digest(search, table_bytes),
                   actors_before = digest(actors, table_bytes);
    const auto before = heap_stats();
    const uint32_t hooks = mods_hooks_installed_count(), counter = rd32(factory + 0x28),
                   secondary = rd32(factory + 0x2c);
    uint32_t pool_before = 0, pool_after = 0;
    if (!stage_pool_live(pool_before))
        return false;
    std::array<uint8_t, 4096> expected = c.unit;
    std::memcpy(expected.data() + 60, placement + 4, 12);
    // PRIMARY v9 passes its saved logical cells to CELL. Moving actors' cells
    // can differ from floor(MapPosition/16); translate both original values.
    std::memcpy(expected.data() + 72, placement + 13, 8);
    const char *grounded_flag = recomp_env("BROWSER_STREAMING_GROUNDED_PLACEMENT_FIXTURE");
    const bool grounded = grounded_flag && !std::strcmp(grounded_flag, "1");
    uint32_t restored_z = placement[6], refused = 0;
    if (grounded) {
        const char *query_flag = recomp_env("BROWSER_STREAMING_CROSS_GROUND_FIXTURE");
        if (!query_flag || std::strcmp(query_flag, "1") ||
            !recomp_writable_path("Ground_Samples.bin", path, sizeof path))
            return false;
        std::array<uint32_t, 27> heights{};
        file = std::fopen(path, "rb");
        ok = file && std::fread(heights.data(), 1, sizeof heights, file) == sizeof heights &&
             std::fgetc(file) == EOF && !std::ferror(file);
        if (file)
            ok = std::fclose(file) == 0 && ok;
        if (!ok || heights[0] != 0x3148474e || heights[1] != 1 || heights[2] != 4)
            return false;
        const uint32_t *height = nullptr;
        for (uint32_t i = 0; i < 4; ++i)
            if (heights[3 + i * 6] == c.id) {
                if (height)
                    return false;
                height = heights.data() + 3 + i * 6;
            }
        if (!height || height[1] != placement[4] || height[2] != placement[5] ||
            height[3] != placement[6])
            return false;
        restored_z = height[5];
        const auto unchanged = expected;
        constexpr uint32_t offsets[] = {56, 80, 84, 92, 96}, wrong[] = {1, 0, 4, 2, 1};
        for (uint32_t i = 0; i < 5; ++i) {
            auto bad = c.unit;
            std::memcpy(bad.data() + offsets[i], wrong + i, 4);
            if (ground_private_primary(bad.data(), c.unit_bytes, restored_z, expected.data()) ||
                std::memcmp(expected.data(), unchanged.data(), sizeof expected))
                return false;
            ++refused;
        }
        if (!ground_private_primary(c.unit.data(), c.unit_bytes, restored_z, expected.data()))
            return false;
    }
    if (!recomp_writable_path("Placement_Primary.bin", path, sizeof path))
        return false;
    file = std::fopen(path, "wb");
    ok = file && std::fwrite(expected.data(), 1, c.unit_bytes, file) == c.unit_bytes;
    if (file)
        ok = std::fclose(file) == 0 && ok;
    majesty::actors::UnitStage stage;
    const majesty::actors::StageInput input{original(40), 0, original(48), original(52)};
    ok = ok && stage.install();
    uint32_t result = UINT32_MAX;
    const uint32_t unit = ok ? primary_file(extra, scratch, "Placement_Primary.bin", factory, 0,
                                            false, &result, true, &stage, &input)
                             : 0;
    if (!stage.remove())
        std::abort();
    ok = ok && unit && !result && stage.registry_deferred() && stage.spatial_deferred() &&
         !rd32(unit + 0x60) && !rd32(unit + 0x84) && !rd32(unit + 0x74) &&
         stage.cell_x() == placement[13] && stage.cell_y() == placement[14];
    for (uint32_t axis = 0; axis < 2 && ok; ++axis)
        ok = rd32(unit + 0x48 + axis * 4) == placement[4 + axis];
    ok = ok && rd32(unit + 0x50) == restored_z;
    ok = ok && rd32(unit + 0x54) == placement[13] && rd32(unit + 0x58) == placement[14];
    uint32_t cache = 0;
    if (ok && grounded) {
        cache = rd32(unit + 0x7c);
        ok = rd32(unit + 0x78) == 1 && gm_valid(cache, 12) && !rd32(cache) &&
             rd32(cache + 4) == original(100) && rd32(cache + 8) == original(104);
    }
    const uint32_t temporary = heap_alloc(48, false);
    if (!temporary)
        std::abort();
    std::memset(gm_ptr(temporary), 0xa5, 48);
    uint32_t queried = 0, clear_count = 0, cache_queries = 0;
    if (ok && grounded) {
        std::array<uint8_t, 0x164> actor_before{};
        std::array<uint8_t, 12> cache_before{};
        std::memcpy(actor_before.data(), gm_ptr(unit), sizeof actor_before);
        std::memcpy(cache_before.data(), gm_ptr(cache), sizeof cache_before);
        const uint32_t args[] = {unit, 0};
        extra.r[R_ECX] = grid;
        const auto inactive = guest_call_guarded(&extra, 0x005b91b0, args, 2);
        ++cache_queries;
        ok = inactive.status == GuestCallGuardedStatus::Returned && (inactive.eax & 255) == 1 &&
             !std::memcmp(actor_before.data(), gm_ptr(unit), sizeof actor_before) &&
             !std::memcmp(cache_before.data(), gm_ptr(cache), sizeof cache_before);
    }
    if (ok) {
        const uint32_t output = temporary + 8;
        extra.r[R_ECX] = unit;
        const auto position = guest_call_guarded(&extra, 0x005ad740, &output, 1);
        const uint32_t convert[] = {temporary + 24, output};
        extra.r[R_ECX] = 0;
        const auto converted = guest_call_guarded(&extra, 0x0043c640, convert, 2);
        ok = position.status == GuestCallGuardedStatus::Returned && position.eax == output &&
             converted.status == GuestCallGuardedStatus::Returned &&
             converted.eax == temporary + 24 && rd32(output) == placement[4] / 2048 &&
             rd32(output + 4) == placement[5] / 2048 && rd32(temporary + 24) == placement[9] &&
             rd32(temporary + 28) == placement[10];
        for (uint32_t which : {9u, 13u})
            for (uint32_t flags : {0x200u, 0x400u}) {
                const uint32_t point[] = {unit, placement[which], placement[which + 1], flags, 0,
                                          0};
                extra.r[R_ECX] = grid;
                const auto collision = guest_call_guarded(&extra, 0x005b8eb0, point, 6);
                ++queried;
                const bool clear =
                    collision.status == GuestCallGuardedStatus::Returned && !(collision.eax & 255);
                clear_count += clear;
                ok = ok && clear;
            }
    }
    const char *ground_flag = recomp_env("BROWSER_STREAMING_CROSS_GROUND_FIXTURE");
    const bool ground_probe = ground_flag && !std::strcmp(ground_flag, "1");
    if (ok && ground_probe)
        ok = probe_cross_ground(extra, temporary, factory, c, placement, trial);
    for (uint32_t at = 0; at < 48 && ok; ++at)
        if (!(at >= 8 && at < 16) && !(at >= 24 && at < 32) &&
            !(ground_probe && at >= 36 && at < 40))
            ok = rd8(temporary + at) == 0xa5;
    ok = heap_free(temporary) && ok;
    const char *composed_flag = recomp_env("BROWSER_STREAMING_COMPOSED_ARRIVAL_FIXTURE");
    const bool composed = composed_flag && !std::strcmp(composed_flag, "1");
    if (ok && composed)
        ok = grounded && binding &&
             stage_populated_orders(extra, unit, c.requests.data(), c.count, c.payload.data(),
                                    c.bytes, c.counts, c.clocks.data(), trial, binding,
                                    c.targets.data(), factory, true, false, c.id, c.unit.data());
    PrimaryBytes serialized{};
    size_t serialized_size = 0;
    const bool equal = ok &&
                       primary_file(extra, scratch, "Placement_Roundtrip.bin", factory, unit, true,
                                    nullptr, true) &&
                       recomp_writable_path("Placement_Roundtrip.bin", path, sizeof path) &&
                       primary_bytes(path, serialized, serialized_size, false, true) &&
                       serialized_size == c.unit_bytes &&
                       !std::memcmp(serialized.data(), expected.data(), c.unit_bytes);
    if (grounded) {
        const bool inactive = cache && gm_valid(cache, 12) && !rd32(cache);
        std::fprintf(stderr,
                     "[streaming] Cross grounded actor=%u trial=%u mode=1 cache-inactive=%u "
                     "z=%d refused=%u cache-queries=%u equal=%u result=%s\n",
                     c.id, trial, unsigned(inactive), int32_t(restored_z), refused, cache_queries,
                     unsigned(equal),
                     ok && inactive && equal && refused == 5 && cache_queries == 1 ? "pass"
                                                                                   : "fail");
        ok = ok && inactive && equal && refused == 5 && cache_queries == 1;
    }
    bool destroyed = false;
    if (unit && gm_valid(unit, 0x164) && rd32(unit) == 0x0068098c && !rd32(unit + 0x60) &&
        !rd32(unit + 0x84)) {
        extra.r[R_ECX] = unit;
        const uint32_t deleting = 1;
        const auto deleted = guest_call_guarded(&extra, 0x00433600, &deleting, 1);
        destroyed =
            deleted.status == GuestCallGuardedStatus::Returned && stage.acknowledge_destroyed(unit);
    }
    const auto after = heap_stats();
    const bool preserved = digest(grid, 0x50) == grid_before &&
                           digest(search, table_bytes) == search_before &&
                           digest(actors, table_bytes) == actors_before &&
                           rd32(factory + 0x28) == counter + unsigned(native_identity_enabled()) &&
                           rd32(factory + 0x2c) == secondary;
    const bool balanced = before.used_bytes == after.used_bytes &&
                          before.used_blocks == after.used_blocks &&
                          before.req_bytes == after.req_bytes && stage_pool_live(pool_after) &&
                          pool_before == pool_after && mods_hooks_installed_count() == hooks;
    ok = ok && equal && destroyed && preserved && balanced;
    std::fprintf(stderr,
                 "[streaming] Cross placement actor=%u trial=%u delta=%d,%d fixed=%d,%d,%d "
                 "grid=%u,%u cells=%u,%u "
                 "queried=%u clear=%u equal=%u destroyed=%u preserved=%u balanced=%u result=%s\n",
                 c.id, trial, dx, dy, int32_t(placement[4]), int32_t(placement[5]),
                 int32_t(restored_z), placement[9], placement[10], placement[13], placement[14],
                 queried, clear_count, unsigned(equal), unsigned(destroyed), unsigned(preserved),
                 unsigned(balanced), ok ? "pass" : "fail");
    if (composed)
        std::fprintf(stderr,
                     "[streaming] Composed arrival actor=%u trial=%u identity=0 world=0 grounded=1 "
                     "commands=1 equal=%u destroyed=%u preserved=%u balanced=%u result=%s\n",
                     c.id, trial, unsigned(equal), unsigned(destroyed), unsigned(preserved),
                     unsigned(balanced), ok ? "pass" : "fail");
    return ok;
}

bool warm_cross_class(X86 &extra, uint32_t scratch, uint32_t factory, const char *original_name,
                      const PopulatedStageCase &c) {
    auto word = [&](uint32_t at) {
        uint32_t value;
        std::memcpy(&value, c.unit.data() + at, 4);
        return value;
    };
    const auto before = heap_stats();
    const uint32_t hooks = mods_hooks_installed_count(), counter = rd32(factory + 0x28),
                   secondary = rd32(factory + 0x2c);
    majesty::actors::UnitStage stage;
    const majesty::actors::StageInput expected{word(40), 0, word(48), word(52)};
    bool ok = stage.install();
    uint32_t result = UINT32_MAX;
    const uint32_t unit = ok ? primary_file(extra, scratch, original_name, factory, 0, false,
                                            &result, true, &stage, &expected)
                             : 0;
    if (!stage.remove())
        std::abort();
    ok = ok && unit && !result && stage.registry_deferred() && stage.spatial_deferred() &&
         !rd32(unit + 0x60) && !rd32(unit + 0x84);
    const uint32_t description = ok ? rd32(unit + 0x80) : 0;
    const uint32_t traits = gm_valid(description, 0x18) ? rd32(description + 0x14) : 0;
    const uint32_t flags_before = gm_valid(traits, 0x40) ? rd32(traits + 0x3c) : 0;
    const bool ready_before = (flags_before & 5) == 5;
    ClassFootprint shape;
    ok = ok && class_footprint(extra, unit, shape);
    if (ok && !shape.address && !(rd32(traits + 0x3c) & 4)) {
        // The original rectangle fallback (5b85e0) lazily calls this bounds
        // initializer. Warm its shared class cache before per-cycle baselines.
        extra.r[R_ECX] = traits;
        const auto bounds = guest_call_guarded(&extra, 0x005ba280, nullptr, 0);
        ok = bounds.status == GuestCallGuardedStatus::Returned && (rd32(traits + 0x3c) & 4);
    }
    const uint32_t flags_after = gm_valid(traits, 0x40) ? rd32(traits + 0x3c) : 0;
    bool destroyed = false;
    if (unit && gm_valid(unit, 0x164) && rd32(unit) == 0x0068098c && !rd32(unit + 0x60) &&
        !rd32(unit + 0x84)) {
        extra.r[R_ECX] = unit;
        const uint32_t deleting = 1;
        const auto deleted = guest_call_guarded(&extra, 0x00433600, &deleting, 1);
        destroyed =
            deleted.status == GuestCallGuardedStatus::Returned && stage.acknowledge_destroyed(unit);
    }
    const auto after = heap_stats();
    const int64_t bytes = int64_t(after.used_bytes) - int64_t(before.used_bytes);
    const int64_t blocks = int64_t(after.used_blocks) - int64_t(before.used_blocks);
    ok = ok && destroyed && mods_hooks_installed_count() == hooks &&
         rd32(factory + 0x28) == counter && rd32(factory + 0x2c) == secondary && bytes >= 0 &&
         bytes <= 1024 * 1024 && blocks >= 0 && blocks <= 256 &&
         (!ready_before || (!bytes && !blocks && after.req_bytes == before.req_bytes));
    std::fprintf(
        stderr,
        "[streaming] Cross class warm actor=%u description=%u ready-before=%u shape=%u,%u "
        "cache-flags=%u,%u retained-bytes=%lld retained-blocks=%lld destroyed=%u result=%s\n",
        c.id, expected.description, unsigned(ready_before), shape.width, shape.height, flags_before,
        flags_after, static_cast<long long>(bytes), static_cast<long long>(blocks),
        unsigned(destroyed), ok ? "pass" : "fail");
    return ok;
}

bool warm_cross_route(X86 &extra, uint32_t scratch, uint32_t factory, const char *original_name,
                      const PopulatedStageCase &c) {
    auto word = [&](uint32_t at) {
        uint32_t value;
        std::memcpy(&value, c.unit.data() + at, 4);
        return value;
    };
    const auto before = heap_stats();
    const uint32_t hooks = mods_hooks_installed_count(), counter = rd32(factory + 0x28),
                   secondary = rd32(factory + 0x2c);
    uint32_t pool_before = 0, pool_after = 0;
    majesty::actors::UnitStage stage;
    const majesty::actors::StageInput expected{word(40), 0, word(48), word(52)};
    bool ok = stage_pool_live(pool_before) && stage.install();
    uint32_t result = UINT32_MAX;
    const uint32_t unit = ok ? primary_file(extra, scratch, original_name, factory, 0, false,
                                            &result, true, &stage, &expected)
                             : 0;
    if (!stage.remove())
        std::abort();
    ok = ok && unit && !result && stage.registry_deferred() && stage.spatial_deferred() &&
         !rd32(unit + 0x60) && !rd32(unit + 0x84) &&
         probe_cross_route(extra, unit, factory, 0, true);
    if (ok && native_identity_enabled())
        ok = native_identity_warm(extra, factory, unit, c.id);
    bool destroyed = false;
    if (unit && gm_valid(unit, 0x164) && rd32(unit) == 0x0068098c && !rd32(unit + 0x60) &&
        !rd32(unit + 0x84)) {
        extra.r[R_ECX] = unit;
        const uint32_t deleting = 1;
        const auto deleted = guest_call_guarded(&extra, 0x00433600, &deleting, 1);
        destroyed =
            deleted.status == GuestCallGuardedStatus::Returned && stage.acknowledge_destroyed(unit);
    }
    const auto after = heap_stats();
    const int64_t bytes = int64_t(after.used_bytes) - int64_t(before.used_bytes),
                  blocks = int64_t(after.used_blocks) - int64_t(before.used_blocks);
    ok = ok && destroyed && stage_pool_live(pool_after) && pool_after == pool_before &&
         mods_hooks_installed_count() == hooks &&
         rd32(factory + 0x28) == counter + unsigned(native_identity_enabled()) &&
         rd32(factory + 0x2c) == secondary && bytes >= 0 && bytes <= 1024 * 1024 && blocks >= 0 &&
         blocks <= 256;
    std::fprintf(stderr,
                 "[streaming] Cross route warm actor=%u retained-bytes=%lld retained-blocks=%lld "
                 "destroyed=%u pool-same=%u result=%s\n",
                 c.id, static_cast<long long>(bytes), static_cast<long long>(blocks),
                 unsigned(destroyed), unsigned(pool_after == pool_before), ok ? "pass" : "fail");
    return ok;
}

void populated_vehicle_trials(X86 &extra, uint32_t scratch, uint32_t factory,
                              const char *original_name, const char *restored_name,
                              const char *original_path, const char *restored_path,
                              PrimaryBytes &restored) {
    char path[1024];
    if (!recomp_writable_path("Populated_Order_Stage.bin", path, sizeof path))
        return;
    FILE *file = std::fopen(path, "rb");
    if (!file)
        return;
    std::array<uint8_t, 32768> input{};
    const size_t size = std::fread(input.data(), 1, input.size(), file);
    bool passed = std::fgetc(file) == EOF && !std::ferror(file);
    passed = std::fclose(file) == 0 && passed;
    size_t cursor = 0;
    auto take = [&](void *out, size_t bytes) {
        if (cursor > size || bytes > size - cursor)
            return false;
        std::memcpy(out, input.data() + cursor, bytes);
        cursor += bytes;
        return true;
    };
    uint32_t magic = 0, count = 0;
    const char *probe_flag = recomp_env("BROWSER_STREAMING_ORDER_CLOCK_FIXTURE");
    const bool clock_probe = probe_flag && !std::strcmp(probe_flag, "1");
    const char *cross_flag = recomp_env("BROWSER_STREAMING_CROSS_SOURCE_FIXTURE");
    const bool cross_source = cross_flag && !std::strcmp(cross_flag, "1");
    const char *destination_flag = recomp_env("BROWSER_STREAMING_CROSS_DESTINATION_FIXTURE");
    const bool cross_destination = destination_flag && !std::strcmp(destination_flag, "1");
    const bool cross = cross_source || cross_destination;
    const uint32_t expected_magic = cross ? 0x3353414eu : clock_probe ? 0x3253414eu : 0x3153414eu;
    passed = passed && !(cross && clock_probe) && !(cross_source && cross_destination) &&
             take(&magic, 4) && magic == expected_magic && take(&count, 4) && count == 4;
    std::array<PopulatedStageCase, 4> cases{};
    static_assert(sizeof(majesty::orders::Request) == 20);
    for (auto &c : cases) {
        uint32_t header[7]{};
        passed = passed && take(header, sizeof header);
        c.id = header[0];
        c.unit_bytes = header[1];
        c.count = header[2];
        c.bytes = header[3];
        std::memcpy(c.counts, header + 4, sizeof c.counts);
        passed = passed && c.id && c.unit_bytes >= 92 && c.unit_bytes <= c.unit.size() &&
                 c.count >= 6 && c.count <= c.requests.size() && c.bytes >= 24 &&
                 c.bytes <= c.payload.size() && take(c.unit.data(), c.unit_bytes) &&
                 take(c.requests.data(), c.count * sizeof c.requests[0]) &&
                 take(c.payload.data(), c.bytes);
        if (clock_probe || cross) {
            uint32_t headers = 0;
            static_assert(sizeof(StagedOrderClock) == 32);
            passed = passed && take(&headers, 4) && headers == c.clocks.size() &&
                     take(c.clocks.data(), sizeof c.clocks);
        }
        if (cross) {
            uint32_t targets = 0;
            static_assert(sizeof(StagedOrderTarget) == 20);
            passed = passed && take(&targets, 4) && targets == c.targets.size() &&
                     take(c.targets.data(), sizeof c.targets);
        }
        auto word = [&](size_t at) {
            uint32_t value;
            std::memcpy(&value, c.unit.data() + at, 4);
            return value;
        };
        passed = passed && !std::memcmp(c.unit.data(), "UNIT", 4) && word(12) == 2 &&
                 !std::memcmp(c.unit.data() + 16, "PRIM", 4) && word(24) == 9 && word(32) == 1 &&
                 word(36) == c.id && !(word(40) & 4) && !word(56) &&
                 c.counts[0] + c.counts[1] + c.counts[2] > 0 && c.counts[0] <= 128 &&
                 c.counts[1] <= 128 && c.counts[2] <= 128;
        std::memset(c.unit.data() + 36, 0, 4);
    }
    CrossBindingSource binding;
    uint32_t source_clock = 0, source_target = 0;
    if (cross) {
        uint32_t header[5]{};
        passed = passed && take(header, sizeof header);
        binding.before = header[0];
        binding.after = header[1];
        binding.kind = header[2];
        binding.description = header[3];
        binding.player = header[4];
        passed = passed && binding.before && binding.after && binding.before != binding.after &&
                 binding.kind == 1 && binding.player < 9 && take(&binding.source_bytes, 4) &&
                 binding.source_bytes >= 92 && binding.source_bytes <= binding.source.size() &&
                 take(binding.source.data(), binding.source_bytes) &&
                 take(&binding.destination_bytes, 4) && binding.destination_bytes >= 92 &&
                 binding.destination_bytes <= binding.destination.size() &&
                 take(binding.destination.data(), binding.destination_bytes);
        // Complete immutable source record is compared with the original writer.
        std::memset(binding.source.data() + 36, 0, 4);
        std::memset(binding.destination.data() + 36, 0, 4);
    }
    passed = passed && cursor == size;
    if (passed && cross_destination) {
        char capture_path[1024];
        uint32_t record[9]{};
        passed =
            recomp_writable_path("Cross_Source_Capture.bin", capture_path, sizeof capture_path);
        FILE *capture = passed ? std::fopen(capture_path, "rb") : nullptr;
        passed = passed && capture &&
                 std::fread(record, 1, sizeof record, capture) == sizeof record &&
                 std::fgetc(capture) == EOF && !std::ferror(capture);
        if (capture)
            passed = std::fclose(capture) == 0 && passed;
        passed = passed && record[0] == 0x3143414e && record[1] == 1 &&
                 record[3] == binding.before && record[4] == binding.kind &&
                 record[5] == binding.description && record[6] == binding.player &&
                 !(record[7] & 4) && !record[8];
        binding.source_clock = record[2];
    }
    if (passed && cross_source) {
        source_clock = rd32(0x0071c6a8);
        extra.r[R_ECX] = factory;
        source_target = guest_call(&extra, 0x005a10d0, binding.before);
        size_t target_size = 0;
        passed = gm_valid(source_target, 0x164) && rd32(source_target) == 0x0068098c &&
                 rd32(source_target + 0x5c) == binding.kind &&
                 rd32(source_target + 0x60) == binding.before &&
                 rd32(source_target + 0x6c) == binding.description &&
                 rd32(source_target + 0x70) == binding.player &&
                 !(rd32(source_target + 0x64) & 4) && !rd32(source_target + 0x74) &&
                 rd32(source_target + 0x84) == factory &&
                 primary_file(extra, scratch, restored_name, factory, source_target, true, nullptr,
                              true) &&
                 primary_bytes(restored_path, restored, target_size, false, true) &&
                 target_size == binding.source_bytes &&
                 !std::memcmp(restored.data(), binding.source.data(), target_size) &&
                 rd32(0x0071c6a8) == source_clock;
    }
    const char *script_flag = recomp_env("BROWSER_STREAMING_SCRIPT_WITNESS_FIXTURE");
    const bool script_witness = script_flag && !std::strcmp(script_flag, "1");
    if (passed && script_witness) {
        uint32_t target = source_target;
        if (cross_destination) {
            extra.r[R_ECX] = factory;
            target = guest_call(&extra, 0x005a10d0, binding.after);
        }
        passed = (cross_source || cross_destination) &&
                 script_namespace_witness(extra, scratch, factory, target, cross_source);
    }
    const char *stage_script_flag = recomp_env("BROWSER_STREAMING_PRIVATE_SCRIPT_STAGE_FIXTURE");
    if (passed && stage_script_flag && !std::strcmp(stage_script_flag, "1"))
        passed =
            cross_destination && script_witness && private_script_stage(extra, scratch, factory);
    const char *joint_flag = recomp_env("BROWSER_STREAMING_JOINT_CHECKPOINT_FIXTURE");
    if (passed && joint_flag && !std::strcmp(joint_flag, "1")) {
        passed =
            native_identity_enabled() && majesty_browser_frontier_joint_checkpoint(&extra, false);
        std::fprintf(stderr, "[streaming] Joint checkpoint baseline saved=%u result=%s\n",
                     unsigned(passed), passed ? "pass" : "fail");
    }
    if (passed) {
        const uint32_t before = rd32(0x0071c950);
        const auto manager = guest_call_guarded(&extra, 0x004a8e90, nullptr, 0);
        const auto cached = guest_call_guarded(&extra, 0x004a8e90, nullptr, 0);
        passed = manager.status == GuestCallGuardedStatus::Returned && manager.eax &&
                 gm_valid(manager.eax, 20) && rd32(manager.eax) == 0x00682ed0 &&
                 rd32(0x0071c950) == manager.eax &&
                 cached.status == GuestCallGuardedStatus::Returned && cached.eax == manager.eax;
        std::fprintf(
            stderr,
            "[streaming] Populated factory before=%08x after=%08x table=%08x cached=%u result=%s\n",
            before, manager.eax, gm_valid(manager.eax, 20) ? rd32(manager.eax) : 0,
            unsigned(cached.eax == manager.eax), passed ? "pass" : "fail");
    }
    unsigned completed = 0;
    for (auto &c : cases) {
        if (!passed)
            break;
        extra.r[R_ECX] = factory;
        const uint32_t preserved_id = cross_destination ? binding.after : c.id;
        const uint8_t *preserved_record =
            cross_destination ? binding.destination.data() : c.unit.data();
        const uint32_t preserved_bytes =
            cross_destination ? binding.destination_bytes : c.unit_bytes;
        const uint32_t source = guest_call(&extra, 0x005a10d0, preserved_id);
        passed = source && gm_valid(source, 0x164) && rd32(source) == 0x0068098c;
        size_t source_size = 0;
        passed =
            passed &&
            primary_file(extra, scratch, restored_name, factory, source, true, nullptr, true) &&
            primary_bytes(restored_path, restored, source_size, false, true) &&
            source_size == preserved_bytes &&
            !std::memcmp(restored.data(), preserved_record, preserved_bytes);
        if (!passed)
            break;
        if (cross_source) {
            passed = live_banks_equal(extra, source, c.payload.data(), c.bytes) &&
                     rd32(0x0071c6a8) == source_clock;
            std::fprintf(stderr,
                         "[streaming] Cross source actor=%u clock=%u live-banks=%u result=%s\n",
                         c.id, source_clock, unsigned(passed), passed ? "pass" : "fail");
            if (passed && script_witness)
                passed = script_namespace_witness(extra, scratch, factory, source, true);
            if (!passed)
                break;
        }
        const uint32_t source_world = rd32(source + 0x84);
        uint32_t counter = rd32(factory + 0x28);
        const uint32_t secondary = rd32(factory + 0x2c);
        auto baseline = heap_stats();
        uint32_t pool_before = 0;
        passed = stage_pool_live(pool_before);
        file = std::fopen(original_path, "wb");
        passed =
            passed && file && std::fwrite(c.unit.data(), 1, c.unit_bytes, file) == c.unit_bytes;
        if (file)
            passed = std::fclose(file) == 0 && passed;
        const char *landing_flag = recomp_env("BROWSER_STREAMING_CROSS_LANDING_FIXTURE");
        if (passed && landing_flag && !std::strcmp(landing_flag, "1")) {
            passed =
                cross_destination && warm_cross_class(extra, scratch, factory, original_name, c);
            const char *route_flag = recomp_env("BROWSER_STREAMING_CROSS_ROUTE_FIXTURE");
            if (passed && route_flag && !std::strcmp(route_flag, "1"))
                passed = warm_cross_route(extra, scratch, factory, original_name, c);
            baseline = heap_stats();
            passed = passed && stage_pool_live(pool_before);
            if (native_identity_enabled())
                counter = rd32(factory + 0x28);
        }
        for (unsigned trial = 0; trial < 16 && passed; ++trial) {
            uint32_t words[4];
            for (unsigned i = 0; i < 4; ++i)
                std::memcpy(&words[i], c.unit.data() + 40 + i * 4, 4);
            majesty::actors::UnitStage stage;
            const uint32_t hook_count = mods_hooks_installed_count();
            const majesty::actors::StageInput expected{words[0], 0, words[2], words[3]};
            passed = stage.install();
            uint32_t result = 0xffffffff;
            const uint32_t unit = passed ? primary_file(extra, scratch, original_name, factory, 0,
                                                        false, &result, true, &stage, &expected)
                                         : 0;
            if (!stage.remove())
                std::abort();
            const bool private_actor = unit && !result && stage.registry_deferred() &&
                                       stage.spatial_deferred() && !rd32(unit + 0x60) &&
                                       !rd32(unit + 0x84);
            const bool orders =
                private_actor &&
                stage_populated_orders(
                    extra, unit, c.requests.data(), c.count, c.payload.data(), c.bytes, c.counts,
                    (clock_probe || cross_destination) ? c.clocks.data() : nullptr, trial,
                    cross_destination ? &binding : nullptr,
                    cross_destination ? c.targets.data() : nullptr, factory);
            size_t restored_size = 0;
            bool equal =
                orders &&
                primary_file(extra, scratch, restored_name, factory, unit, true, nullptr, true) &&
                primary_bytes(restored_path, restored, restored_size, false, true) &&
                restored_size == c.unit_bytes &&
                !std::memcmp(restored.data(), c.unit.data(), c.unit_bytes);
            const char *placement_flag = recomp_env("BROWSER_STREAMING_CROSS_PLACEMENT_FIXTURE");
            if (equal && placement_flag && !std::strcmp(placement_flag, "1"))
                equal = cross_destination &&
                        probe_cross_placement(extra, scratch, factory, c, trial, &binding);
            bool destroyed = false;
            if (unit && gm_valid(unit, 0x164) && rd32(unit) == 0x0068098c && !rd32(unit + 0x60) &&
                !rd32(unit + 0x84)) {
                extra.r[R_ECX] = unit;
                uint32_t deleting = 1;
                const auto deleted = guest_call_guarded(&extra, 0x00433600, &deleting, 1);
                destroyed = deleted.status == GuestCallGuardedStatus::Returned &&
                            stage.acknowledge_destroyed(unit);
            }
            extra.r[R_ECX] = factory;
            const bool source_kept =
                guest_call(&extra, 0x005a10d0, preserved_id) == source &&
                rd32(source + 0x60) == preserved_id && rd32(source + 0x84) == source_world &&
                rd32(factory + 0x28) == counter + (native_identity_enabled() ? trial + 1 : 0) &&
                rd32(factory + 0x2c) == secondary;
            size_t final_size = 0;
            const bool source_unchanged =
                primary_file(extra, scratch, restored_name, factory, source, true, nullptr, true) &&
                primary_bytes(restored_path, restored, final_size, false, true) &&
                final_size == preserved_bytes &&
                !std::memcmp(restored.data(), preserved_record, preserved_bytes);
            const auto after = heap_stats();
            uint32_t pool_after = 0;
            const bool balanced = after.used_bytes == baseline.used_bytes &&
                                  after.used_blocks == baseline.used_blocks &&
                                  after.req_bytes == baseline.req_bytes &&
                                  stage_pool_live(pool_after) && pool_after == pool_before &&
                                  mods_hooks_installed_count() == hook_count;
            passed = passed && private_actor && orders && equal && destroyed && source_kept &&
                     source_unchanged && balanced;
            std::fprintf(
                stderr,
                "[streaming] Populated stage actor=%u trial=%u private=%u orders=%u equal=%u "
                "destroyed=%u source-kept=%u source-unchanged=%u balanced=%u result=%s\n",
                c.id, trial, unsigned(private_actor), unsigned(orders), unsigned(equal),
                unsigned(destroyed), unsigned(source_kept), unsigned(source_unchanged),
                unsigned(balanced), passed ? "pass" : "fail");
            if (passed)
                ++completed;
        }
        if (passed && cross_source)
            passed = live_banks_equal(extra, source, c.payload.data(), c.bytes) &&
                     rd32(0x0071c6a8) == source_clock;
    }
    if (passed && completed == 64 && cross_source) {
        extra.r[R_ECX] = factory;
        size_t target_size = 0;
        passed = guest_call(&extra, 0x005a10d0, binding.before) == source_target &&
                 primary_file(extra, scratch, restored_name, factory, source_target, true, nullptr,
                              true) &&
                 primary_bytes(restored_path, restored, target_size, false, true) &&
                 target_size == binding.source_bytes &&
                 !std::memcmp(restored.data(), binding.source.data(), target_size) &&
                 rd32(0x0071c6a8) == source_clock;
        char capture_path[1024];
        passed = passed && recomp_writable_path("Cross_Source_Capture.bin", capture_path,
                                                sizeof capture_path);
        FILE *capture = passed ? std::fopen(capture_path, "wbx") : nullptr;
        const uint32_t record[] = {0x3143414e,
                                   1,
                                   source_clock,
                                   binding.before,
                                   binding.kind,
                                   binding.description,
                                   binding.player,
                                   rd32(source_target + 0x64),
                                   rd32(source_target + 0x74)};
        passed =
            passed && capture && std::fwrite(record, 1, sizeof record, capture) == sizeof record;
        if (capture)
            passed = std::fclose(capture) == 0 && passed;
        std::fprintf(
            stderr,
            "[streaming] Cross source capture clock=%u target=%u unchanged=%u bytes=36 result=%s\n",
            source_clock, binding.before, unsigned(passed), passed ? "pass" : "fail");
    }
    std::fprintf(stderr, "[streaming] Populated stage completed actors=4 trials=%u result=%s\n",
                 completed, passed && completed == 64 ? "pass" : "fail");
}

void staged_vehicle_trials(X86 &extra, uint32_t scratch, uint32_t source, uint32_t factory,
                           const char *original_name, const char *restored_name,
                           const char *original_path, const char *restored_path,
                           PrimaryBytes &original, size_t original_size, PrimaryBytes &restored) {
    const HeapStats baseline = heap_stats();
    const uint32_t counter = rd32(factory + 0x28), secondary_counter = rd32(factory + 0x2c);
    const uint32_t source_id = rd32(source + 0x60);
    auto word = [&](size_t at) {
        uint32_t n;
        std::memcpy(&n, original.data() + at, 4);
        return n;
    };
    uint32_t pool_before = 0;
    bool passed =
        original_size >= 92 && word(32) == 1 && !(word(40) & 4) && stage_pool_live(pool_before);
    if (passed) {
        // The immutable file is valid. Deliberately mismatch the expected player
        // so the original complete constructor runs, then registration admission
        // cancels before identity/world/registry exposure. Reclaim the captured
        // class through its original destructor and require recovery before the
        // healthy trials start with new scopes.
        const majesty::actors::StageInput wrong{word(40), word(56), word(48), (word(52) + 1) % 9};
        const uint32_t hook_count = mods_hooks_installed_count();
        majesty::actors::UnitStage stage;
        bool installed = stage.install();
        uint32_t result = 0xffffffff;
        const uint32_t unit = installed ? primary_file(extra, scratch, original_name, factory, 0,
                                                       false, &result, true, &stage, &wrong)
                                        : 0;
        if (!stage.remove())
            std::abort();
        const bool constructed = unit && gm_valid(unit, 0x164) && rd32(unit) == 0x0068098c;
        const bool refused = result == 0xbad10002 &&
                             stage.failure() == majesty::actors::StageFailure::WrongInput &&
                             !stage.registry_deferred() && !stage.spatial_deferred();
        const bool private_actor = constructed && !rd32(unit + 0x60) && !rd32(unit + 0x84) &&
                                   !rd32(unit + 0x80) && !rd32(unit + 0x88) && !rd32(unit + 0x8c) &&
                                   !rd32(unit + 0x90);
        bool destroyed = false;
        if (private_actor) {
            extra.r[R_ECX] = unit;
            uint32_t deleting = 1;
            const auto deleted = guest_call_guarded(&extra, 0x00433600, &deleting, 1);
            destroyed = deleted.status == GuestCallGuardedStatus::Returned &&
                        stage.acknowledge_destroyed(unit);
        }
        extra.r[R_ECX] = factory;
        const bool source_kept = guest_call(&extra, 0x005a10d0, source_id) == source &&
                                 rd32(factory + 0x28) == counter &&
                                 rd32(factory + 0x2c) == secondary_counter;
        const auto after = heap_stats();
        const bool balanced = after.used_bytes == baseline.used_bytes &&
                              after.used_blocks == baseline.used_blocks &&
                              after.req_bytes == baseline.req_bytes;
        uint32_t pool_after = 0;
        const bool pool_balanced = stage_pool_live(pool_after) && pool_after == pool_before;
        const bool hooks_removed = mods_hooks_installed_count() == hook_count;
        const bool guard_clear = !mods_hook_depth() && !guest_call_guarded_cookie(&extra);
        passed = installed && constructed && refused && private_actor && destroyed && source_kept &&
                 balanced && pool_balanced && hooks_removed && guard_clear;
        std::fprintf(stderr,
                     "[streaming] Stage rollback constructed=%u refused=%u private=%u destroyed=%u "
                     "source-kept=%u heap-balanced=%u pool-balanced=%u hooks-removed=%u "
                     "guard-clear=%u result=%s\n",
                     unsigned(constructed), unsigned(refused), unsigned(private_actor),
                     unsigned(destroyed), unsigned(source_kept), unsigned(balanced),
                     unsigned(pool_balanced), unsigned(hooks_removed), unsigned(guard_clear),
                     passed ? "pass" : "fail");
    }
    unsigned completed = 0, spatial_deferred = 0;
    for (unsigned trial = 0; passed && trial < 64; ++trial) {
        // Alternate the original parented state and a private parentless control.
        // Both must preserve every serialized byte of their immutable input.
        const uint32_t parent = trial % 2 ? 0 : rd32(source + 0x74);
        std::memcpy(original.data() + 56, &parent, 4);
        FILE *file = std::fopen(original_path, "wb");
        passed = file && std::fwrite(original.data(), 1, original_size, file) == original_size;
        if (file)
            passed = std::fclose(file) == 0 && passed;
        majesty::actors::UnitStage stage;
        const uint32_t hook_count = mods_hooks_installed_count();
        const majesty::actors::StageInput input{word(40), parent, word(48), word(52)};
        passed = passed && stage.install();
        uint32_t result = 0xffffffff;
        uint32_t unit = passed ? primary_file(extra, scratch, original_name, factory, 0, false,
                                              &result, true, &stage, &input)
                               : 0;
        if (!stage.remove())
            std::abort(); // retain no callbacks into this stack frame
        const bool private_actor = unit && !result && stage.registry_deferred() &&
                                   rd32(unit + 0x60) == 0 && rd32(unit + 0x84) == 0 &&
                                   rd32(unit + 0x80) && rd32(factory + 0x28) == counter &&
                                   rd32(factory + 0x2c) == secondary_counter;
        spatial_deferred += unsigned(stage.spatial_deferred());
        const bool orders = private_actor && stage_empty_orders(extra, unit);
        size_t restored_size = 0;
        StageParentSerialization parent_context{&extra, unit, source};
        const bool writer_ready = orders && (!parent || parent_context.install());
        const bool written =
            writer_ready && primary_file(extra, scratch, restored_name, factory, unit, true,
                                         nullptr, true, nullptr, nullptr, &parent_context.cookie);
        parent_context.cookie = 0;
        if (!parent_context.remove())
            std::abort();
        const bool parent_context_valid =
            !parent_context.failed && parent_context.calls == unsigned(parent != 0);
        const bool equal = written && parent_context_valid &&
                           primary_bytes(restored_path, restored, restored_size, false, true) &&
                           restored_size == original_size &&
                           !std::memcmp(original.data(), restored.data(), original_size);
        bool destroyed = false;
        if (unit && gm_valid(unit, 0x164) && rd32(unit) == 0x0068098c && !rd32(unit + 0x60) &&
            !rd32(unit + 0x84)) {
            extra.r[R_ECX] = unit;
            uint32_t deleting = 1;
            const auto deleted = guest_call_guarded(&extra, 0x00433600, &deleting, 1);
            destroyed = deleted.status == GuestCallGuardedStatus::Returned &&
                        stage.acknowledge_destroyed(unit);
        }
        extra.r[R_ECX] = factory;
        const bool source_kept = guest_call(&extra, 0x005a10d0, source_id) == source;
        const auto after = heap_stats();
        const bool balanced = after.used_bytes == baseline.used_bytes &&
                              after.used_blocks == baseline.used_blocks &&
                              after.req_bytes == baseline.req_bytes;
        const bool hooks_removed = mods_hooks_installed_count() == hook_count;
        uint32_t pool_after = 0;
        const bool pool_balanced = stage_pool_live(pool_after) && pool_after == pool_before;
        passed = passed && pool_balanced && private_actor && orders && equal && destroyed &&
                 source_kept && balanced && hooks_removed;
        std::fprintf(
            stderr,
            "[streaming] Stage fixture trial=%u private=%u spatial-deferred=%u orders=%u equal=%u "
            "parent-context=%u destroyed=%u source-kept=%u heap-balanced=%u hooks-removed=%u "
            "pool-balanced=%u "
            "failure=%u result=%s\n",
            trial, unsigned(private_actor), unsigned(stage.spatial_deferred()), unsigned(orders),
            unsigned(equal), unsigned(parent_context_valid), unsigned(destroyed),
            unsigned(source_kept), unsigned(balanced), unsigned(hooks_removed),
            unsigned(pool_balanced), unsigned(stage.failure()), passed ? "pass" : "fail");
        if (passed)
            ++completed;
    }
    const uint32_t parent = rd32(source + 0x74);
    std::memcpy(original.data() + 56, &parent, 4);
    size_t restored_size = 0;
    const bool source_unchanged =
        primary_file(extra, scratch, restored_name, factory, source, true, nullptr, true) &&
        primary_bytes(restored_path, restored, restored_size, false, true) &&
        restored_size == original_size &&
        !std::memcmp(original.data(), restored.data(), original_size);
    std::fprintf(
        stderr,
        "[streaming] Stage fixture completed trials=%u spatial-deferred=%u source-unchanged=%u "
        "counters-unchanged=%u result=%s\n",
        completed, spatial_deferred, unsigned(source_unchanged),
        unsigned(rd32(factory + 0x28) == counter && rd32(factory + 0x2c) == secondary_counter),
        passed && completed == 64 && spatial_deferred == 32 && source_unchanged ? "pass" : "fail");
}
} // namespace

namespace {
void restore_fixture(X86 *c, bool complete) {
    static bool attempted[2] = {};
    const char *label = complete ? "Unit" : "Restore";
    const char *flag = recomp_env(complete ? "BROWSER_STREAMING_UNIT_FIXTURE"
                                           : "BROWSER_STREAMING_RESTORE_FIXTURE");
    if (attempted[complete] || !flag || std::strcmp(flag, "1"))
        return;
    attempted[complete] = true;
    if (!isolated_fixture()) {
        std::fprintf(stderr, "[streaming] %s fixture skipped: isolated profile required\n", label);
        return;
    }
    if (c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
        return;
    X86 extra = *c;
    extra.r[R_ESP] -= 512;
    uint32_t source = 0, factory = 0;
    if (complete && owned_vehicle.resolved && gm_valid(owned_vehicle.self, 0x164)) {
        extra.r[R_ECX] = owned_vehicle.factory;
        if (guest_call(&extra, 0x005a10d0u, owned_vehicle.id) == owned_vehicle.self) {
            source = owned_vehicle.self;
            factory = owned_vehicle.factory;
        }
    }
    for (const Sample &sample : samples) {
        if (source)
            break;
        if (!sample.readable || !sample.resolved || sample.kind != 1 ||
            (sample.flags & 0x304u) != 0x200u || !gm_valid(sample.self, 0x164))
            continue;
        extra.r[R_ECX] = sample.factory;
        if (guest_call(&extra, 0x005a10d0u, sample.id) != sample.self)
            continue;
        source = sample.self;
        factory = sample.factory;
        break;
    }
    // Populated diagnostics select their own saved actors. Some worlds have no
    // player-owned vehicle, and the bounded trace prefix may contain buildings
    // only. Resolve the pack's first identity through the actual world factory;
    // the complete immutable record is validated separately before staging.
    const char *populated_flag = recomp_env("BROWSER_STREAMING_POPULATED_STAGE_FIXTURE");
    if (!source && complete && populated_flag && !std::strcmp(populated_flag, "1")) {
        char pack_path[1024];
        uint32_t prefix[4]{};
        bool readable = false;
        if (recomp_writable_path("Populated_Order_Stage.bin", pack_path, sizeof pack_path)) {
            if (FILE *pack = std::fopen(pack_path, "rb")) {
                readable = std::fread(prefix, 1, sizeof prefix, pack) == sizeof prefix &&
                           !std::ferror(pack);
                readable = std::fclose(pack) == 0 && readable;
            }
        }
        const uint32_t world = rd32(0x0071c68c);
        const uint32_t selected_factory = gm_valid(world, 0x14) ? rd32(world + 0x10) : 0;
        if (readable &&
            (prefix[0] == 0x3153414e || prefix[0] == 0x3253414e || prefix[0] == 0x3353414e) &&
            prefix[1] == 4 && prefix[2] && gm_valid(selected_factory, 0x88) &&
            rd32(selected_factory) == 0x00682950) {
            extra.r[R_ECX] = selected_factory;
            const uint32_t selected = guest_call(&extra, 0x005a10d0, prefix[2]);
            if (gm_valid(selected, 0x164) && rd32(selected) == 0x0068098c &&
                rd32(selected + 0x60) == prefix[2] && rd32(selected + 0x84) == selected_factory &&
                !(rd32(selected + 0x64) & 4)) {
                source = selected;
                factory = selected_factory;
                std::fprintf(stderr, "[streaming] Populated source selected id=%u table=%08x\n",
                             prefix[2], rd32(selected));
            }
        }
    }
    char original_path[1024], restored_path[1024];
    const char *original_name = complete ? "Actor_Unit_Fixture.bin" : "Actor_Primary_Fixture.bin";
    const char *restored_name =
        complete ? "Actor_Unit_Restored_Fixture.bin" : "Actor_Restored_Fixture.bin";
    if (!source || !recomp_writable_path(original_name, original_path, sizeof original_path) ||
        !recomp_writable_path(restored_name, restored_path, sizeof restored_path)) {
        std::fprintf(stderr, "[streaming] %s fixture failed: source or paths unavailable\n", label);
        return;
    }
    const HeapStats baseline = heap_stats();
    const uint32_t scratch = heap_alloc(512, true);
    if (!scratch)
        return;
    auto original = std::make_unique<PrimaryBytes>();
    auto restored = std::make_unique<PrimaryBytes>();
    size_t original_size = 0, restored_size = 0;
    const uint32_t source_id = rd32(source + 0x60);
    bool passed =
        primary_file(extra, scratch, original_name, factory, source, true, nullptr, complete) &&
        primary_bytes(original_path, *original, original_size, true, complete);
    unsigned completed = 0;
    const HeapStats trial_baseline = heap_stats();
    std::fprintf(stderr,
                 "[streaming] %s fixture source=%08x id=%08x description=%08x "
                 "bytes=%zu serialized=%u baseline-blocks=%u baseline-bytes=%llu\n",
                 label, source, source_id, rd32(source + 0x6c), original_size, unsigned(passed),
                 trial_baseline.used_blocks,
                 static_cast<unsigned long long>(trial_baseline.used_bytes));
    if (complete)
        std::fprintf(stderr,
                     "[streaming] Unit fixture owner=%d parent=%08x name-length=%u "
                     "secondary-count=%u candidate-bytes=%zu\n",
                     int32_t(rd32(source + 0x70)), rd32(source + 0x74), rd32(source + 0xe0),
                     rd32(source + 0x15c), sizeof owned_vehicle);
    const char *stage_flag = recomp_env("BROWSER_STREAMING_STAGE_FIXTURE");
    if (complete && stage_flag && !std::strcmp(stage_flag, "1")) {
        const char *populated = recomp_env("BROWSER_STREAMING_POPULATED_STAGE_FIXTURE");
        if (passed && populated && !std::strcmp(populated, "1"))
            populated_vehicle_trials(extra, scratch, factory, original_name, restored_name,
                                     original_path, restored_path, *restored);
        else if (passed)
            staged_vehicle_trials(extra, scratch, source, factory, original_name, restored_name,
                                  original_path, restored_path, *original, original_size,
                                  *restored);
        heap_free(scratch);
        const bool files_removed =
            std::remove(original_path) == 0 && std::remove(restored_path) == 0;
        std::fprintf(stderr, "[streaming] Stage fixture files-removed=%u\n",
                     unsigned(files_removed));
        return;
    }
    for (unsigned trial = 0; passed && trial != 64; ++trial) {
        const uint32_t before = rd32(factory + 0x28);
        const uint32_t expected = before < 0x7fffffffu ? before + 1 : 1;
        extra.r[R_ECX] = factory;
        if (guest_call(&extra, 0x005a10d0u, expected)) {
            passed = false;
            break;
        }
        uint32_t reader_result = 0xffffffffu;
        const uint32_t unit = primary_file(extra, scratch, original_name, factory, 0, false,
                                           &reader_result, complete);
        if (!unit || !gm_valid(unit, 0x164)) {
            passed = false;
            break;
        }
        const uint32_t id = rd32(unit + 0x60);
        extra.r[R_ECX] = factory;
        const bool registered =
            !reader_result && id == expected && guest_call(&extra, 0x005a10d0u, id) == unit;
        const uint32_t attributes = rd32(unit + 8), helper = rd32(unit + 0x18);
        const uint32_t block = rd32(unit + 0x7c);
        // CRT small-block objects occupy subranges of larger guest allocations;
        // heap_owns() only recognizes the containing allocation's start.
        bool separate = attributes && gm_valid(attributes, 0x18) &&
                        attributes != rd32(source + 8) && helper && gm_valid(helper, 0x20) &&
                        helper != rd32(source + 0x18) &&
                        (!rd32(source + 0x7c) ||
                         (block && gm_valid(block, 0x0c) && block != rd32(source + 0x7c)));
        if (complete) {
            const uint32_t name = rd32(unit + 0xd8);
            separate = separate && rd32(unit + 0x154) != rd32(source + 0x154) &&
                       rd32(unit + 0x158) != rd32(source + 0x158) &&
                       (!rd32(source + 0xe0) ||
                        (name && gm_valid(name, 1) && name != rd32(source + 0xd8)));
        }
        const bool equal =
            registered && separate &&
            primary_file(extra, scratch, restored_name, factory, unit, true, nullptr, complete) &&
            primary_bytes(restored_path, *restored, restored_size, false, complete) &&
            original_size == restored_size &&
            std::memcmp(original->data(), restored->data(), original_size) == 0;
        // The primary reader already calls +9c and inserts independent units into
        // the collision grid. Factory removal alone leaves a freed pointer there.
        // Detach through original +98 before reclaiming this unactivated clone;
        // full gameplay death would also invoke its borrowed GPL associations.
        extra.r[R_ECX] = unit;
        guest_call(&extra, 0x005ad400u);
        extra.r[R_ECX] = factory;
        guest_call(&extra, 0x005baf20u, unit);
        extra.r[R_ECX] = factory;
        const bool removed = guest_call(&extra, 0x005a10d0u, id) == 0;
        const HeapStats after = heap_stats();
        const bool balanced = after.used_blocks == trial_baseline.used_blocks &&
                              after.used_bytes == trial_baseline.used_bytes &&
                              after.req_bytes == trial_baseline.req_bytes;
        passed = registered && separate && equal && removed && balanced;
        std::fprintf(stderr,
                     "[streaming] %s fixture trial=%u id=%08x registered=%u "
                     "separate=%u "
                     "bytes=%zu equal=%u removed=%u heap-blocks=%u heap-bytes=%llu "
                     "heap-balanced=%u result=%s\n",
                     label, trial, id, unsigned(registered), unsigned(separate), restored_size,
                     unsigned(equal), unsigned(removed), after.used_blocks,
                     static_cast<unsigned long long>(after.used_bytes), unsigned(balanced),
                     passed ? "pass" : "fail");
        if (passed)
            ++completed;
    }
    const bool source_unchanged =
        primary_file(extra, scratch, restored_name, factory, source, true, nullptr, complete) &&
        primary_bytes(restored_path, *restored, restored_size, false, complete) &&
        original_size == restored_size &&
        std::memcmp(original->data(), restored->data(), original_size) == 0;
    heap_free(scratch);
    const bool original_removed = std::remove(original_path) == 0;
    const bool restored_removed = std::remove(restored_path) == 0;
    const bool files_removed = original_removed && restored_removed;
    const HeapStats final = heap_stats();
    const bool balanced = final.used_blocks == baseline.used_blocks &&
                          final.used_bytes == baseline.used_bytes &&
                          final.req_bytes == baseline.req_bytes;
    std::fprintf(
        stderr,
        "[streaming] %s fixture completed trials=%u "
        "source-unchanged=%u files-removed=%u heap-balanced=%u result=%s\n",
        label, completed, unsigned(source_unchanged), unsigned(files_removed), unsigned(balanced),
        passed && completed == 64 && source_unchanged && files_removed && balanced ? "pass"
                                                                                   : "fail");
}
} // namespace

extern "C" void majesty_browser_streaming_restore_fixture(X86 *c) {
    restore_fixture(c, false);
}
extern "C" void majesty_browser_streaming_unit_fixture(X86 *c) {
    restore_fixture(c, true);
}

namespace {
// Per-agent records use GPL envelopes, not native UNIT chunk headers. This
// trusted-writer fixture keeps two fixed buffers and never registers a clone.
bool agent_bytes(const char *path, PrimaryBytes &bytes, size_t &size) {
    FILE *file = std::fopen(path, "rb");
    if (!file)
        return false;
    size = std::fread(bytes.data(), 1, bytes.size(), file);
    const bool bounded = std::fgetc(file) == EOF && !std::ferror(file);
    const bool closed = std::fclose(file) == 0;
    if (!bounded || !closed || size < 56)
        return false;
    auto word = [&](size_t at) {
        uint32_t value;
        std::memcpy(&value, bytes.data() + at, 4);
        return value;
    };
    const size_t attributes = word(8);
    return word(0) == size && word(4) == 2 && attributes >= 20 && attributes <= size - 36 &&
           word(12) == 0 && word(8 + attributes - 8) == 0 &&
           word(8 + attributes - 4) == 0xffffffffu && word(size - 8) == 0 &&
           word(size - 4) == 0xffffffffu;
}

uint32_t agent_file(X86 &extra, uint32_t scratch, const char *name, uint32_t agent, bool write) {
    std::memset(gm_ptr(scratch), 0, 512);
    const uint32_t text = scratch + 256, wrapper = scratch + 16;
    gm_put_str(text, name, 128);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3340u);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3590u, text, uint32_t(std::strlen(name)));
    extra.r[R_ECX] = wrapper;
    guest_call(&extra, write ? 0x004ee910u : 0x004ef470u, scratch, write ? 0x82u : 0xa0u,
               rd32(0x0068c7f0u));
    uint32_t result = 0xffffffffu;
    if (rd32(wrapper)) {
        extra.r[R_ECX] = agent;
        result = guest_call(&extra, write ? 0x00626740u : 0x006269b0u, wrapper);
    }
    extra.r[R_ECX] = wrapper;
    guest_call(&extra, write ? 0x004eeb10u : 0x004ef680u);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3820u);
    return result;
}

// GPL values return to their original pool, which can retain a newly allocated
// batch. Warm up once, then require all eight type capacities/free counts and
// guest live allocation totals to remain fixed through 64 further cycles.
using AgentPool = std::array<uint32_t, 16>;
bool agent_pool(uint32_t pool, AgentPool &state) {
    if (!pool || !gm_valid(pool, 0xa4) || rd32(pool + 0xa0))
        return false;
    for (uint32_t type = 1; type <= 8; ++type) {
        const uint32_t at = pool + (type + 1) * 16;
        const uint32_t start = rd32(at + 4), end = rd32(at + 8);
        const uint32_t limit = rd32(at + 12);
        if (end < start || limit < end || ((end - start) % 4) || ((limit - start) % 4))
            return false;
        state[(type - 1) * 2] = (end - start) / 4;
        state[(type - 1) * 2 + 1] = (limit - start) / 4;
    }
    return true;
}
} // namespace

extern "C" void majesty_browser_streaming_agent_fixture(X86 *c) {
    static bool attempted = false;
    const char *flag = recomp_env("BROWSER_STREAMING_AGENT_FIXTURE");
    if (attempted || !flag || std::strcmp(flag, "1"))
        return;
    attempted = true;
    if (!isolated_fixture()) {
        std::fprintf(stderr, "[streaming] Agent fixture skipped: isolated profile required\n");
        return;
    }
    if (!owned_vehicle.resolved || !gm_valid(owned_vehicle.self, 0x164) ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
        return;
    X86 extra = *c;
    extra.r[R_ESP] -= 512;
    const HeapStats baseline = heap_stats();
    const uint32_t scratch = heap_alloc(512, true);
    if (!scratch)
        return;
    const HeapStats held = heap_stats();
    // The original inventory bridge also uses this native attribute iterator.
    wr32(scratch + 128, 0x4541u);
    extra.r[R_ECX] = owned_vehicle.self + 4;
    guest_call(&extra, 0x00426700u, scratch + 132, scratch + 128);
    const uint32_t attribute = rd32(scratch + 132);
    const uint32_t id = attribute != rd32(owned_vehicle.self + 8) && gm_valid(attribute, 0x14)
                            ? rd32(attribute + 0x10)
                            : 0;
    const uint32_t runtime = guest_call(&extra, 0x00623b20u);
    auto lookup = [&](uint32_t number) {
        extra.r[R_ECX] = runtime;
        return guest_call(&extra, 0x006236b0u, number);
    };
    const uint32_t source = id && gm_valid(runtime, 0x38) ? lookup(id) : 0;
    const uint32_t pool = gm_valid(runtime, 0x38) ? rd32(runtime + 0x1c) : 0;
    char original_path[1024], restored_path[1024];
    const char *original_name = "Actor_Agent_Fixture.bin";
    const char *restored_name = "Actor_Agent_Restored_Fixture.bin";
    const bool available =
        source && gm_valid(source, 0x34) && rd32(source + 0x10) == id &&
        rd32(source + 0x20) == owned_vehicle.id && !rd8(source + 0x28) &&
        recomp_writable_path(original_name, original_path, sizeof original_path) &&
        recomp_writable_path(restored_name, restored_path, sizeof restored_path);
    if (!available) {
        heap_free(scratch);
        std::fprintf(stderr, "[streaming] Agent fixture failed: source or paths unavailable\n");
        return;
    }
    auto original = std::make_unique<PrimaryBytes>();
    auto restored = std::make_unique<PrimaryBytes>();
    size_t original_size = 0, restored_size = 0;
    bool passed = agent_file(extra, scratch, original_name, source, true) == 0 &&
                  agent_bytes(original_path, *original, original_size);
    std::fprintf(stderr,
                 "[streaming] Agent fixture source=%08x agent-id=%08x "
                 "native-id=%08x attributes=%u functions=%u bytes=%zu "
                 "serialized=%u\n",
                 source, id, owned_vehicle.id, rd32(rd32(source) + 0xc), rd32(source + 0xc),
                 original_size, unsigned(passed));
    HeapStats warmed = heap_stats();
    AgentPool warmed_pool{};
    unsigned completed = 0;
    for (unsigned trial = 0; passed && trial <= 64; ++trial) {
        const uint32_t before = rd32(runtime + 0x34);
        if (before >= 0x7ffffffeu) {
            passed = false;
            break;
        }
        const uint32_t clone = guest_call(&extra, 0x0064c616u, 0x34u);
        if (!clone || !gm_valid(clone, 0x34)) {
            passed = false;
            break;
        }
        extra.r[R_ECX] = clone;
        guest_call(&extra, 0x00625e70u);
        const uint32_t allocated_id = rd32(clone + 0x10);
        // Original 00623b30 returns the old EAX counter, then stores EDX=EAX+1.
        const bool allocated =
            allocated_id == before && rd32(runtime + 0x34) == before + 1 && !lookup(allocated_id);
        const uint32_t result = agent_file(extra, scratch, original_name, clone, false);
        const bool unregistered = lookup(id) == source && !lookup(allocated_id);
        const uint32_t attributes = rd32(clone), functions = rd32(clone + 8);
        const bool separate = attributes && gm_valid(attributes, 16) &&
                              attributes != rd32(source) &&
                              rd32(attributes + 4) != rd32(rd32(source) + 4) && functions &&
                              gm_valid(functions, 0x18) && functions != rd32(source + 8) &&
                              rd32(clone + 0x10) == id && rd32(clone + 0x20) == owned_vehicle.id &&
                              rd32(clone + 0x24) == 0;
        const bool equal = !result && separate &&
                           agent_file(extra, scratch, restored_name, clone, true) == 0 &&
                           agent_bytes(restored_path, *restored, restored_size) &&
                           original_size == restored_size &&
                           !std::memcmp(original->data(), restored->data(), original_size);
        // Unlike manager gameplay removal, this destructor releases only the
        // clone's storage/pool values; it does not run the source's death script.
        extra.r[R_ECX] = clone;
        guest_call(&extra, 0x00625fa0u);
        guest_call(&extra, 0x00645bc0u, clone);
        AgentPool after_pool{};
        const bool pool_valid = agent_pool(pool, after_pool);
        const HeapStats after = heap_stats();
        if (!trial) {
            warmed = after;
            warmed_pool = after_pool;
        }
        const bool balanced = after.used_blocks == warmed.used_blocks &&
                              after.used_bytes == warmed.used_bytes &&
                              after.req_bytes == warmed.req_bytes;
        const bool pool_stable = pool_valid && after_pool == warmed_pool;
        const bool source_registered = lookup(id) == source;
        passed = allocated && !result && unregistered && separate && equal && source_registered &&
                 balanced && pool_stable;
        std::fprintf(stderr,
                     "[streaming] Agent fixture phase=%s trial=%u reader=%08x "
                     "counter-before=%08x allocated-id=%08x allocated=%u unregistered=%u "
                     "separate=%u equal=%u "
                     "source-registered=%u heap-blocks=%u heap-bytes=%llu "
                     "heap-balanced=%u pool-stable=%u result=%s\n",
                     trial ? "steady" : "warmup", trial ? trial - 1 : 0, result, before,
                     allocated_id, unsigned(allocated), unsigned(unregistered), unsigned(separate),
                     unsigned(equal), unsigned(source_registered), after.used_blocks,
                     static_cast<unsigned long long>(after.used_bytes), unsigned(balanced),
                     unsigned(pool_stable), passed ? "pass" : "fail");
        if (passed && trial)
            ++completed;
    }
    const bool source_unchanged = agent_file(extra, scratch, restored_name, source, true) == 0 &&
                                  agent_bytes(restored_path, *restored, restored_size) &&
                                  original_size == restored_size &&
                                  !std::memcmp(original->data(), restored->data(), original_size);
    heap_free(scratch);
    const bool original_removed = std::remove(original_path) == 0;
    const bool restored_removed = std::remove(restored_path) == 0;
    const HeapStats final = heap_stats();
    const bool released =
        final.used_blocks + held.used_blocks - baseline.used_blocks == warmed.used_blocks &&
        final.used_bytes + held.used_bytes - baseline.used_bytes == warmed.used_bytes &&
        final.req_bytes + held.req_bytes - baseline.req_bytes == warmed.req_bytes;
    std::fprintf(stderr,
                 "[streaming] Agent fixture completed trials=%u source-unchanged=%u "
                 "files-removed=%u scratch-released=%u retained-blocks=%lld "
                 "retained-bytes=%lld result=%s\n",
                 completed, unsigned(source_unchanged),
                 unsigned(original_removed && restored_removed), unsigned(released),
                 static_cast<long long>(final.used_blocks) - baseline.used_blocks,
                 static_cast<long long>(final.used_bytes) - baseline.used_bytes,
                 passed && completed == 64 && source_unchanged && original_removed &&
                         restored_removed && released
                     ? "pass"
                     : "fail");
}

namespace {
// Trusted original-writer records only. This is an isolated identity/lifetime
// experiment, not an importer or a complete activated regional actor.
struct PairReference {
    size_t offset = 0;
    uint32_t before = 0;
};
struct PairPlan {
    std::array<PairReference, 1024> references{};
    size_t count = 0, identity = 0, native = 0;
    uint32_t values = 0;
    bool collect_contexts = false;
    std::array<size_t, 64> contexts{};
    size_t context_count = 0;
};
uint32_t pair_word(const PrimaryBytes &bytes, size_t at) {
    uint32_t value;
    std::memcpy(&value, bytes.data() + at, 4);
    return value;
}
void pair_put(PrimaryBytes &bytes, size_t at, uint32_t value) {
    std::memcpy(bytes.data() + at, &value, 4);
}
bool pair_name(const PrimaryBytes &bytes, size_t &at, size_t limit, size_t bound = 1024) {
    const size_t start = at;
    while (at < limit && at - start < bound)
        if (!bytes[at++])
            return true;
    return false;
}
bool pair_value(const PrimaryBytes &bytes, size_t &at, size_t limit, unsigned depth,
                PairPlan &plan) {
    if (depth > 32 || ++plan.values > 100000 || at + 4 > limit)
        return false;
    const uint32_t type = pair_word(bytes, at);
    at += 4;
    if (type == 0)
        return true;
    if (type == 1 || type == 2 || type == 5) {
        if (at + 4 > limit)
            return false;
        const uint32_t value = pair_word(bytes, at);
        if (type == 5 && value && value <= 0x7fffffffu) {
            if (plan.count == plan.references.size())
                return false;
            plan.references[plan.count++] = {at, value};
        }
        at += 4;
        return true;
    }
    if (type == 3)
        return pair_name(bytes, at, limit, primary_limit);
    if (type == 6) {
        if (at >= limit || bytes[at] > 1)
            return false;
        ++at;
        return true;
    }
    if (type == 7) {
        if (at + 8 > limit)
            return false;
        at += 8;
        return true;
    }
    if (type != 4 && type != 8)
        return false;
    size_t end = limit, children = limit;
    if (type == 4) {
        if (at + 20 > limit)
            return false;
        const size_t size = pair_word(bytes, at);
        if (size < 20 || size > limit - at || pair_word(bytes, at + 4))
            return false;
        end = at + size;
        children = end - 8;
        if (pair_word(bytes, children) || pair_word(bytes, children + 4) != 0xffffffffu)
            return false;
        at += 8;
    }
    if (at + 4 > children)
        return false;
    const uint32_t count = pair_word(bytes, at);
    at += 4;
    if (count > 100000 - plan.values || count > (children - at) / 4)
        return false;
    for (uint32_t i = 0; i != count; ++i)
        if (!pair_value(bytes, at, children, depth + 1, plan))
            return false;
    if (type == 4) {
        if (at != children)
            return false;
        at = end;
        return true;
    }
    if (at + 17 > limit || bytes[at + 16] > 1)
        return false;
    if (plan.collect_contexts) {
        if (plan.context_count == plan.contexts.size()) return false;
        plan.contexts[plan.context_count++] = at;
    }
    at += 17;
    for (unsigned slot = 0; slot != 2; ++slot) {
        if (at >= limit || bytes[at] > 1)
            return false;
        const bool present = bytes[at++];
        if (present && !pair_name(bytes, at, limit))
            return false;
    }
    return true;
}
bool pair_agent_plan(const PrimaryBytes &bytes, size_t size, uint32_t id, uint32_t native_id,
                     PairPlan &plan) {
    if (size < 56 || pair_word(bytes, 0) != size || pair_word(bytes, 4) != 2)
        return false;
    const size_t attributes = pair_word(bytes, 8), end = 8 + attributes;
    if (attributes < 20 || attributes > size - 36 || pair_word(bytes, 12) ||
        pair_word(bytes, end - 8) || pair_word(bytes, end - 4) != 0xffffffffu)
        return false;
    const uint32_t count = pair_word(bytes, 16);
    if (count > 100000)
        return false;
    size_t at = 20;
    for (uint32_t i = 0; i != count; ++i)
        if (!pair_name(bytes, at, end - 8) || !pair_value(bytes, at, end - 8, 0, plan))
            return false;
    if (at != end - 8 || end + 4 > size - 19)
        return false;
    at = end;
    const uint32_t functions = pair_word(bytes, at);
    at += 4;
    if (functions > 100000)
        return false;
    for (uint32_t i = 0; i != functions; ++i)
        if (!pair_name(bytes, at, size - 19))
            return false;
    if (at + 4 > size - 19 || pair_word(bytes, at) != id)
        return false;
    plan.identity = at;
    at += 4;
    if (!pair_name(bytes, at, size - 19) || at != size - 19 || pair_word(bytes, at) != native_id ||
        bytes[at + 4] || bytes[size - 10] > 1 || bytes[size - 9] > 1 ||
        pair_word(bytes, size - 8) || pair_word(bytes, size - 4) != 0xffffffffu)
        return false;
    plan.native = at;
    return true;
}
bool pair_native_ea(const PrimaryBytes &bytes, size_t size, uint32_t agent_id, size_t &ea) {
    // Complete UNIT + PRIM headers precede the audited 60-byte primary header.
    if (size < 108 || pair_word(bytes, 80) > 1)
        return false;
    const size_t primary_end = 32 + size_t(pair_word(bytes, 20));
    size_t at = 92;
    if (pair_word(bytes, 80)) {
        if (at + 16 > primary_end || pair_word(bytes, at) != 1)
            return false;
        at += 16;
    }
    if (primary_end > size || at + 8 > primary_end || pair_word(bytes, at) != 1)
        return false;
    const uint32_t count = pair_word(bytes, at + 4);
    at += 8;
    if (count > 100000 || count > (primary_end - at) / 8)
        return false;
    uint32_t previous = 0;
    bool found = false;
    for (uint32_t i = 0; i != count; ++i, at += 8) {
        const uint32_t key = pair_word(bytes, at);
        if (i && key <= previous)
            return false;
        previous = key;
        if (key == 0x4541u) {
            if (pair_word(bytes, at + 4) != agent_id)
                return false;
            ea = at + 4;
            found = true;
        }
    }
    return found;
}
bool pair_write(const char *path, const PrimaryBytes &bytes, size_t size) {
    FILE *file = std::fopen(path, "wb");
    if (!file)
        return false;
    const bool written = std::fwrite(bytes.data(), 1, size, file) == size;
    return std::fclose(file) == 0 && written;
}
using PairQueues = std::array<uint32_t, 12>;
PairQueues pair_queues(uint32_t manager) {
    PairQueues result{};
    // Name-index count, both active-list descriptors/selectors, deferred list.
    result[0] = rd32(manager + 0xc);
    for (unsigned i = 0; i != 6; ++i)
        result[i + 1] = rd32(manager + 0x10 + i * 4);
    for (unsigned i = 0; i != 5; ++i)
        result[i + 7] = rd32(manager + 0x38 + i * 4);
    return result;
}
bool script_namespace_witness(X86 &extra, uint32_t scratch, uint32_t factory, uint32_t unit,
                              bool source_side) {
    if (!sched_holds_baton() || mods_hook_depth() || !gm_valid(unit, 0x164) ||
        rd32(unit) != 0x0068098c || !rd32(unit + 0x60) || rd32(unit + 0x84) != factory)
        return false;
    char path[1024];
    if (!recomp_writable_path("Script_Witness_Pack.bin", path, sizeof path))
        return false;
    std::array<uint8_t, 32768> raw{};
    FILE *file = std::fopen(path, "rb");
    const size_t size = file ? std::fread(raw.data(), 1, raw.size(), file) : 0;
    bool ok = file && std::fgetc(file) == EOF && !std::ferror(file);
    if (file)
        ok = std::fclose(file) == 0 && ok;
    size_t cursor = 0;
    auto take = [&](void *out, size_t bytes) {
        if (cursor > size || bytes > size - cursor)
            return false;
        std::memcpy(out, raw.data() + cursor, bytes);
        cursor += bytes;
        return true;
    };
    uint32_t header[3]{};
    if (!ok || !take(header, sizeof header) || header[0] != 0x3157534e || header[1] != 1 ||
        header[2] != 6)
        return false;
    PrimaryBytes native{}, script{}, observed{};
    uint32_t agent_id = 0, script_bytes = 0;
    size_t unit_bytes = 0, observed_bytes = 0;
    const uint32_t unit_id = rd32(unit + 0x60), side = source_side ? 0 : 1;
    for (uint32_t i = 0; i < 6; ++i) {
        uint32_t record[5]{};
        if (!take(record, sizeof record) || record[0] > 1 || !record[1] || !record[2] ||
            record[3] < 108 || record[3] > 4096 || record[4] < 56 || record[4] > 4096 ||
            cursor > size || size_t(record[3]) + record[4] > size - cursor)
            return false;
        if (record[0] == side && record[1] == unit_id) {
            if (agent_id || !take(native.data(), record[3]) || !take(script.data(), record[4]))
                return false;
            agent_id = record[2];
            unit_bytes = record[3];
            script_bytes = record[4];
        } else
            cursor += record[3] + record[4];
    }
    if (cursor != size || !agent_id || pair_word(native, 36) != unit_id)
        return false;
    size_t ea = 0;
    PairPlan plan;
    if (!pair_native_ea(native, unit_bytes, agent_id, ea) ||
        !pair_agent_plan(script, script_bytes, agent_id, unit_id, plan))
        return false;
    const auto heap_before = heap_stats();
    const uint32_t hooks = mods_hooks_installed_count(), clock = rd32(0x0071c6a8);
    uint32_t crt_before = 0, crt_after = 0;
    if (!stage_pool_live(crt_before))
        return false;
    wr32(scratch + 128, 0x4541);
    extra.r[R_ECX] = unit + 4;
    const uint32_t lookup_args[] = {scratch + 132, scratch + 128};
    const auto ea_lookup = guest_call_guarded(&extra, 0x00426700, lookup_args, 2);
    const uint32_t node = rd32(scratch + 132);
    ok = ea_lookup.status == GuestCallGuardedStatus::Returned && node != rd32(unit + 8) &&
         gm_valid(node, 0x14) && rd32(node + 0x10) == agent_id;
    extra.r[R_ECX] = 0;
    const auto runtime_call = guest_call_guarded(&extra, 0x00623b20, nullptr, 0);
    const uint32_t runtime = runtime_call.eax;
    if (!ok || runtime_call.status != GuestCallGuardedStatus::Returned || !gm_valid(runtime, 0x38))
        return false;
    const uint32_t manager = rd32(runtime + 4), pool = rd32(runtime + 0x1c),
                   counter = rd32(runtime + 0x34);
    extra.r[R_ECX] = runtime;
    const auto found = guest_call_guarded(&extra, 0x006236b0, &agent_id, 1);
    const uint32_t agent = found.eax;
    AgentPool pool_before{}, pool_after{};
    if (found.status != GuestCallGuardedStatus::Returned || !gm_valid(agent, 0x34) ||
        rd32(agent + 0x10) != agent_id || rd32(agent + 0x20) != unit_id || rd8(agent + 0x28) ||
        !gm_valid(manager, 0x4c) || !agent_pool(pool, pool_before))
        return false;
    const auto queues_before = pair_queues(manager);
    const uint32_t registrations = rd32(manager + 0x34);
    std::array<uint8_t, 0x164> unit_before{};
    std::array<uint8_t, 0x34> agent_before{};
    std::memcpy(unit_before.data(), gm_ptr(unit), unit_before.size());
    std::memcpy(agent_before.data(), gm_ptr(agent), agent_before.size());
    uint32_t backlinks = 0;
    auto warm_backlink = [&](uint32_t observed_agent) {
        std::array<uint8_t, 0x34> before{};
        std::memcpy(before.data(), gm_ptr(observed_agent), before.size());
        const uint32_t native_id = rd32(observed_agent + 0x20),
                       old_cache = rd32(observed_agent + 0x24);
        if (!native_id)
            return false;
        extra.r[R_ECX] = factory;
        const auto native = guest_call_guarded(&extra, 0x005a10d0, &native_id, 1);
        if (native.status != GuestCallGuardedStatus::Returned || !gm_valid(native.eax, 0x164) ||
            rd32(native.eax + 0x60) != native_id || rd32(native.eax + 0x84) != factory ||
            (old_cache && old_cache != native.eax))
            return false;
        extra.r[R_ECX] = observed_agent;
        const auto cached = guest_call_guarded(&extra, 0x00626310, nullptr, 0);
        bool same = cached.status == GuestCallGuardedStatus::Returned && cached.eax == native.eax &&
                    rd32(observed_agent + 0x24) == native.eax;
        for (uint32_t at = 0; at < before.size() && same; ++at)
            if (!(at >= 0x24 && at < 0x28))
                same = rd8(observed_agent + at) == before[at];
        backlinks += same;
        return same;
    };
    // Original type-five writing refreshes a reference cache and invokes the
    // referenced agent's lazy native getter. Qualify its sole header write
    // before the steady writer baseline; never raw-revert the original cache.
    ok = ok && warm_backlink(agent);
    uint32_t resolved = 0;
    for (size_t i = 0; i < plan.count && ok; ++i) {
        const uint32_t id = plan.references[i].before;
        extra.r[R_ECX] = runtime;
        const auto referenced = guest_call_guarded(&extra, 0x006236b0, &id, 1);
        ok = referenced.status == GuestCallGuardedStatus::Returned &&
             gm_valid(referenced.eax, 0x34) && rd32(referenced.eax + 0x10) == id &&
             !rd8(referenced.eax + 0x28) && warm_backlink(referenced.eax);
        resolved += ok;
    }
    std::memcpy(agent_before.data(), gm_ptr(agent), agent_before.size());
    char name[128];
    std::snprintf(name, sizeof name, "Script_Witness_%u_%u.bin", side, unit_id);
    const bool equal = ok && recomp_writable_path(name, path, sizeof path) &&
                       !agent_file(extra, scratch, name, agent, true) &&
                       agent_bytes(path, observed, observed_bytes) &&
                       observed_bytes == script_bytes &&
                       !std::memcmp(observed.data(), script.data(), script_bytes);
    const bool unit_same = !std::memcmp(unit_before.data(), gm_ptr(unit), unit_before.size()),
               agent_same = !std::memcmp(agent_before.data(), gm_ptr(agent), agent_before.size()),
               counter_same = rd32(runtime + 0x34) == counter,
               registrations_same = rd32(manager + 0x34) == registrations,
               clock_same = rd32(0x0071c6a8) == clock,
               hooks_same = mods_hooks_installed_count() == hooks;
    const bool preserved =
        unit_same && agent_same && counter_same && registrations_same && clock_same && hooks_same;
    if (!preserved) {
        std::fprintf(stderr,
                     "[streaming] Script witness preservation unit-same=%u agent-same=%u "
                     "counter-same=%u registrations-same=%u clock-same=%u hooks-same=%u\n",
                     unsigned(unit_same), unsigned(agent_same), unsigned(counter_same),
                     unsigned(registrations_same), unsigned(clock_same), unsigned(hooks_same));
        for (uint32_t at = 0; at < agent_before.size(); at += 4) {
            uint32_t before_word;
            std::memcpy(&before_word, agent_before.data() + at, 4);
            if (before_word != rd32(agent + at))
                std::fprintf(
                    stderr,
                    "[streaming] Script witness agent-change offset=%u before=%08x after=%08x\n",
                    at, before_word, rd32(agent + at));
        }
    }
    const auto after = heap_stats();
    const bool heap_same = after.used_bytes == heap_before.used_bytes &&
                           after.used_blocks == heap_before.used_blocks &&
                           after.req_bytes == heap_before.req_bytes;
    const bool pool_same = agent_pool(pool, pool_after) && pool_before == pool_after &&
                           stage_pool_live(crt_after) && crt_before == crt_after;
    const bool queues_same = pair_queues(manager) == queues_before;
    ok = ok && equal && preserved && heap_same && pool_same && queues_same;
    std::fprintf(
        stderr,
        "[streaming] Script witness side=%u unit=%u agent=%u bytes=%u values=%u refs=%zu "
        "resolved=%u backlinks=%u clock=%u equal=%u preserved=%u heap-same=%u pool-same=%u "
        "queues-same=%u result=%s\n",
        side, unit_id, agent_id, script_bytes, plan.values, plan.count, resolved, backlinks, clock,
        unsigned(equal), unsigned(preserved), unsigned(heap_same), unsigned(pool_same),
        unsigned(queues_same), ok ? "pass" : "fail");
    return ok;
}
// Private cross-kingdom GPL restoration. No ID tree entry, active queue, native
// association or callback is published. Self IDs come from the original ctor;
// never rewind its counter after destruction.
bool private_script_stage(X86 &extra, uint32_t scratch, uint32_t factory) {
    if (!isolated_fixture() || !sched_holds_baton() || mods_hook_depth())
        return false;
    char path[1024];
    if (!recomp_writable_path("Script_Stage_Pack.bin", path, sizeof path))
        return false;
    std::array<uint8_t, 8192> raw{};
    FILE *file = std::fopen(path, "rb");
    const size_t size = file ? std::fread(raw.data(), 1, raw.size(), file) : 0;
    bool ok = file && std::fgetc(file) == EOF && !std::ferror(file);
    if (file)
        ok = std::fclose(file) == 0 && ok;
    size_t cursor = 0;
    auto take = [&](void *out, size_t bytes) {
        if (cursor > size || bytes > size - cursor)
            return false;
        std::memcpy(out, raw.data() + cursor, bytes);
        cursor += bytes;
        return true;
    };
    uint32_t header[10]{};
    if (!ok || !take(header, sizeof header) || header[0] != 0x3153474e || header[1] != 1 ||
        header[2] != 4 || header[3] != 4000 || header[4] != rd32(0x0071c6a8) || header[5] != 2352 ||
        header[6] != 5936 || header[7] != 1677 || header[8] != 2170 || header[9] != 2)
        return false;
    struct Case {
        uint32_t words[9]{};
        uint32_t references[8]{};
        PrimaryBytes script{};
    };
    auto cases = std::make_unique<std::array<Case, 4>>();
    const uint32_t units[] = {2101, 2105, 2122, 2136}, agents[] = {37, 41, 57, 69},
                   stamps[] = {8550, 8550, 8650, 8400};
    for (uint32_t i = 0; i < 4; ++i) {
        auto &value = (*cases)[i];
        auto *w = value.words;
        if (!take(w, sizeof value.words) || w[0] != units[i] || w[1] != agents[i] || w[2] < 56 ||
            w[2] > 4096 || w[7] != 4 || w[8] != 52 ||
            !take(value.references, sizeof value.references) || !take(value.script.data(), w[2]))
            return false;
        PairPlan plan;
        if (!pair_agent_plan(value.script, w[2], w[1], 0, plan) || plan.identity != w[3] ||
            plan.native != w[4] || plan.count != 4 || plan.values != w[8] || w[5] < 4 ||
            w[5] + 12 >= w[2] || w[6] + 8 >= w[2] || pair_word(value.script, w[5] - 4) != 300 ||
            pair_word(value.script, w[5]) != stamps[i] || pair_word(value.script, w[5] + 4) != 2 ||
            pair_word(value.script, w[5] + 8) || value.script[w[5] + 12] ||
            pair_word(value.script, w[6] - 4) != 7 || pair_word(value.script, w[6]) != header[7] ||
            pair_word(value.script, w[6] + 4) != header[8])
            return false;
        unsigned self = 0, leader = 0;
        for (size_t ref = 0; ref < 4; ++ref) {
            const uint32_t before = value.references[ref * 2 + 1];
            if (plan.references[ref].offset != value.references[ref * 2] ||
                plan.references[ref].before != (before == 12 ? 2 : before))
                return false;
            self += before == w[1];
            leader += before == 12;
        }
        if (self != 2 || leader != 2)
            return false;
    }
    if (cursor != size)
        return false;
    const uint32_t runtime = guest_call(&extra, 0x00623b20);
    if (!gm_valid(runtime, 0x38))
        return false;
    const uint32_t manager = rd32(runtime + 4), pool = rd32(runtime + 0x1c),
                   initial_counter = rd32(runtime + 0x34), clock = rd32(0x0071c6a8),
                   hooks = mods_hooks_installed_count(), factory_counter = rd32(factory + 0x28);
    if (!gm_valid(manager, 0x4c) || initial_counter >= 0x7fffffff - 68)
        return false;
    auto lookup = [&](uint32_t id) {
        extra.r[R_ECX] = runtime;
        return guest_call(&extra, 0x006236b0, id);
    };
    const uint32_t leader = lookup(2), registrations = rd32(manager + 0x34);
    if (!gm_valid(leader, 0x34) || rd32(leader + 0x20) != 497 || rd8(leader + 0x28))
        return false;
    const auto queues = pair_queues(manager);
    std::array<uint8_t, 0x34> leader_before{};
    std::memcpy(leader_before.data(), gm_ptr(leader), leader_before.size());
    HeapStats warmed = heap_stats();
    AgentPool warmed_pool{};
    uint32_t warmed_crt = 0, completed = 0;
    auto expected = std::make_unique<PrimaryBytes>();
    auto observed = std::make_unique<PrimaryBytes>();
    for (uint32_t round = 0; ok && round <= 16; ++round) {
        for (uint32_t i = 0; ok && i < 4; ++i) {
            const auto &value = (*cases)[i];
            const auto *w = value.words;
            const uint32_t before = rd32(runtime + 0x34);
            if (!before || lookup(before)) {
                ok = false;
                break;
            }
            const uint32_t clone = guest_call(&extra, 0x0064c616, 0x34u);
            if (!gm_valid(clone, 0x34)) {
                ok = false;
                break;
            }
            extra.r[R_ECX] = clone;
            guest_call(&extra, 0x00625e70);
            const bool allocated = rd32(clone + 0x10) == before &&
                                   rd32(runtime + 0x34) == before + 1 && !lookup(before);
            *expected = value.script;
            pair_put(*expected, w[3], before);
            for (size_t ref = 0; ref < 4; ++ref)
                if (value.references[ref * 2 + 1] == w[1])
                    pair_put(*expected, value.references[ref * 2], before);
            uint32_t reader = UINT32_MAX;
            bool written = false;
            if (allocated && recomp_writable_path("Script_Stage_Input.bin", path, sizeof path) &&
                pair_write(path, *expected, w[2]))
                reader = agent_file(extra, scratch, "Script_Stage_Input.bin", clone, false);
            const bool private_links = !reader && rd32(clone + 0x10) == before &&
                                       !rd32(clone + 0x20) && !rd32(clone + 0x24) &&
                                       !rd8(clone + 0x28) && !lookup(before) && lookup(2) == leader;
            const bool separate =
                !reader && gm_valid(rd32(clone), 16) && rd32(clone) != rd32(leader) &&
                rd32(rd32(clone) + 4) != rd32(rd32(leader) + 4) &&
                gm_valid(rd32(clone + 8), 0x18) && rd32(clone + 8) != rd32(leader + 8);
            char name[128];
            std::snprintf(name, sizeof name, "Script_Stage_%u_%u.bin", w[0], round);
            size_t observed_size = 0;
            if (private_links && separate && !agent_file(extra, scratch, name, clone, true) &&
                recomp_writable_path(name, path, sizeof path) &&
                agent_bytes(path, *observed, observed_size))
                written =
                    observed_size == w[2] && !std::memcmp(expected->data(), observed->data(), w[2]);
            const char *compose_flag = recomp_env("BROWSER_STREAMING_SCRIPT_COMPOSE_FIXTURE");
            if (!round && written && compose_flag && !std::strcmp(compose_flag, "1")) {
                wr32(scratch + 144, before);
                wr32(scratch + 148, clone);
                extra.r[R_ECX] = manager + 0x28;
                guest_call(&extra, 0x00634460, scratch + 128, scratch + 144);
                const uint32_t entry = rd32(scratch + 128);
                const bool inserted = rd8(scratch + 132) == 1 && lookup(before) == clone &&
                                      rd32(manager + 0x34) == registrations + 1;
                if (rd8(scratch + 132) != 1)
                    std::abort();
                extra.r[R_ECX] = manager + 0x28;
                guest_call(&extra, 0x006346a0, scratch + 128, entry);
                written = inserted && !lookup(before) && rd32(manager + 0x34) == registrations;
                std::fprintf(stderr,
                             "[streaming] Script compose tree warm agent=%u inserted=%u erased=%u "
                             "result=%s\n",
                             before, unsigned(inserted), unsigned(written),
                             written ? "pass" : "fail");
            }
            extra.r[R_ECX] = clone;
            guest_call(&extra, 0x00625fa0);
            guest_call(&extra, 0x00645bc0, clone);
            const auto after = heap_stats();
            AgentPool after_pool{};
            uint32_t crt = 0;
            const bool pools = agent_pool(pool, after_pool) && stage_pool_live(crt);
            const bool preserved =
                !lookup(before) && lookup(2) == leader &&
                !std::memcmp(leader_before.data(), gm_ptr(leader), leader_before.size()) &&
                rd32(runtime + 0x34) == before + 1 && rd32(manager + 0x34) == registrations &&
                pair_queues(manager) == queues && rd32(0x0071c6a8) == clock &&
                mods_hooks_installed_count() == hooks && rd32(factory + 0x28) == factory_counter;
            const bool balanced = !round || (after.used_bytes == warmed.used_bytes &&
                                             after.used_blocks == warmed.used_blocks &&
                                             after.req_bytes == warmed.req_bytes &&
                                             after_pool == warmed_pool && crt == warmed_crt);
            ok =
                allocated && private_links && separate && written && pools && preserved && balanced;
            std::fprintf(
                stderr,
                "[streaming] Script stage phase=%s actor=%u trial=%u old-agent=%u new-agent=%u "
                "clock=%u stamp=%u goal=%u,%u native=0 refs=4 reader=%u separate=%u "
                "equal=%u unregistered=%u preserved=%u balanced=%u result=%s\n",
                round ? "steady" : "warmup", w[0], round, w[1], before, clock,
                pair_word(*expected, w[5]), header[7], header[8], reader, unsigned(separate),
                unsigned(written), unsigned(private_links), unsigned(preserved), unsigned(balanced),
                ok ? "pass" : "fail");
            if (ok && round)
                ++completed;
            if (!round && i == 3) {
                warmed = after;
                warmed_pool = after_pool;
                warmed_crt = crt;
            }
        }
    }
    ok = ok && completed == 64 && rd32(runtime + 0x34) == initial_counter + 68;
    std::fprintf(stderr,
                 "[streaming] Script stage completed=%u constructor-count=%u counter-before=%u "
                 "counter-after=%u active=0 result=%s\n",
                 completed, rd32(runtime + 0x34) - initial_counter, initial_counter,
                 rd32(runtime + 0x34), ok ? "pass" : "fail");
    return ok;
}
bool native_identity_enabled() {
    const char *flag = recomp_env("BROWSER_STREAMING_NATIVE_IDENTITY_FIXTURE");
    return flag && !std::strcmp(flag, "1");
}
struct NativeRegistrySnapshot {
    struct Group {
        uint32_t address = 0, table = 0, kind = 0, list_count = 0, tree_count = 0;
        uint64_t members = 14695981039346656037ull;
        bool operator==(const Group &) const = default;
    };
    std::array<Group, 128> groups{};
    uint32_t count = 0;
    bool operator==(const NativeRegistrySnapshot &) const = default;
};
bool native_registry_snapshot(uint32_t factory, NativeRegistrySnapshot &out, uint32_t omit = 0,
                              const uint32_t *omit_family = nullptr, uint32_t family_count = 0) {
    out = {};
    if (!gm_valid(factory, 0x88) || family_count > 4 || (family_count && !omit_family))
        return false;
    const uint32_t registry = rd32(factory + 0x84);
    if (!gm_valid(registry, 12))
        return false;
    const uint32_t head = rd32(registry + 4);
    if (!gm_valid(head, 12))
        return false;
    uint32_t entry = rd32(head);
    while (entry != head) {
        if (out.count >= out.groups.size() || !gm_valid(entry, 12))
            return false;
        auto &g = out.groups[out.count++];
        g.address = rd32(entry + 8);
        if (!gm_valid(g.address, 0x30))
            return false;
        g.table = rd32(g.address);
        g.kind = rd32(g.address + 4);
        g.list_count = rd32(g.address + 0x18);
        g.tree_count = rd32(g.address + 0x2c);
        const uint32_t begin = rd32(g.address + 0x10), end = rd32(g.address + 0x14);
        if (!gm_valid(begin, 4) || !gm_valid(end, 4) || g.list_count > 4096 ||
            g.list_count != g.tree_count)
            return false;
        uint32_t node = rd32(begin), stop = rd32(end), visited = 0, omitted = 0;
        while (node != stop) {
            if (!gm_valid(node, 12) || visited++ >= g.list_count)
                return false;
            const uint32_t member = rd32(node + 8);
            bool excluded = omit && member == omit;
            for (uint32_t i = 0; i < family_count; ++i) excluded |= member == omit_family[i];
            if (excluded) {
                if (++omitted > (family_count ? family_count : 1u))
                    return false;
            } else
                for (uint32_t at : {4u, 8u}) {
                    g.members ^= rd32(node + at);
                    g.members *= 1099511628211ull;
                }
            node = rd32(node);
        }
        if (visited != g.list_count)
            return false;
        g.list_count -= omitted;
        g.tree_count -= omitted;
        entry = rd32(entry);
    }
    return out.count != 0;
}
// Original factory removal erases every registry group before invoking the
// scalar deleting destructor. Defer only this owned destructor under an exact
// guarded-call cookie so its still-owned command graph can drain afterward.
struct NativeRetirementDeferral {
    X86 &cpu;
    uint32_t unit, handle = 0, calls = 0;
    uint64_t cookie = 0;
    bool failed = false;
    static void callback(const PopModApi *, pop_cpu_v1 *c, PopHookInvocation *inv, void *context) {
        auto &s = *static_cast<NativeRetirementDeferral *>(context);
        if (!s.cookie || guest_call_guarded_cookie(&s.cpu) != s.cookie || c->ecx != s.unit) {
            if (mods_call_next(nullptr, inv, c) != POP_OK)
                std::abort();
            return;
        }
        if (s.calls || rd32(c->esp) != 0x005baf5f || rd32(c->esp + 4) != 1 ||
            mods_hook_return(nullptr, c, s.unit, 4) != POP_OK) {
            s.failed = true;
            guest_call_guarded_cancel(&s.cpu, s.cookie, 0xbad30001);
            std::abort();
        }
        ++s.calls;
    }
};
bool retire_native_identity(X86 &extra, uint32_t factory, uint32_t unit, uint32_t id,
                            const NativeRegistrySnapshot &before) {
    if (!id || rd32(unit + 0x60) != id || rd32(unit + 0x84) != factory ||
        rd32(rd32(unit)) != 0x00433600 || !mods_symbol_hookable(0x00433600))
        return false;
    NativeRetirementDeferral deferral{extra, unit};
    if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00433600, 0, deferral.callback, POP_HOOK_WRAP,
                             POP_HOOK_NO_GAME_VIEW, &deferral, &deferral.handle) != POP_OK)
        return false;
    extra.r[R_ECX] = factory;
    const auto retired = guest_call_guarded(&extra, 0x005baf20, &unit, 1, &deferral.cookie);
    deferral.cookie = 0;
    if (mods_hook_remove(MODS_OWNER_RUNTIME, deferral.handle) != POP_OK)
        std::abort();
    extra.r[R_ECX] = factory;
    const uint32_t found = guest_call(&extra, 0x005a10d0, id);
    NativeRegistrySnapshot after;
    const bool groups = native_registry_snapshot(factory, after) && before == after;
    if (retired.status != GuestCallGuardedStatus::Returned || deferral.failed ||
        deferral.calls != 1 || found || !groups || !gm_valid(unit, 0x164))
        return false;
    // Registry ownership has been retired through original methods. Reset only
    // the owned object's publication tags; never rewind the factory counter.
    wr32(unit + 0x60, 0);
    wr32(unit + 0x84, 0);
    return true;
}
bool publish_native_identity(X86 &extra, uint32_t factory, uint32_t unit, uint32_t &id) {
    const uint32_t before = rd32(factory + 0x28);
    if (before >= 0x7ffffffe || rd32(unit + 0x60) || rd32(unit + 0x84) ||
        (rd32(unit + 0x64) & 0x300) != 0x200)
        return false;
    extra.r[R_ECX] = factory;
    if (guest_call(&extra, 0x005a10d0, before + 1))
        return false;
    const uint32_t args[] = {unit, 1, 0};
    extra.r[R_ECX] = factory;
    const auto published = guest_call_guarded(&extra, 0x005a12e0, args, 3);
    id = rd32(unit + 0x60);
    extra.r[R_ECX] = factory;
    const uint32_t found = guest_call(&extra, 0x005a10d0, id);
    return published.status == GuestCallGuardedStatus::Returned && id == before + 1 &&
           rd32(factory + 0x28) == id && rd32(unit + 0x84) == factory && found == unit;
}
bool native_identity_warm(X86 &extra, uint32_t factory, uint32_t unit, uint32_t source_unit) {
    NativeRegistrySnapshot before;
    const uint32_t counter = rd32(factory + 0x28), flags = rd32(unit + 0x64);
    uint32_t id = 0;
    const bool lookup = native_registry_snapshot(factory, before) &&
                        publish_native_identity(extra, factory, unit, id);
    if (!lookup && !id) {
        const uint32_t registry = rd32(factory + 0x84);
        const auto &last = before.groups[before.count ? before.count - 1 : 0];
        std::fprintf(stderr,
                     "[streaming] Native registry snapshot refused count=%u declared=%u "
                     "last-kind=%u list=%u tree=%u\n",
                     before.count, gm_valid(registry, 12) ? rd32(registry + 8) : 0, last.kind,
                     last.list_count, last.tree_count);
    }
    const bool retired = lookup && retire_native_identity(extra, factory, unit, id, before) &&
                         rd32(unit + 0x64) == flags && rd32(factory + 0x28) == counter + 1;
    std::fprintf(stderr,
                 "[streaming] Native identity warm actor=%u before=%u id=%u groups=%u lookup=%u "
                 "retired=%u result=%s\n",
                 source_unit, counter, id, before.count, unsigned(lookup), unsigned(retired),
                 retired ? "pass" : "fail");
    return retired;
}
bool compose_actor_script(X86 &extra, uint32_t factory, uint32_t unit, uint32_t source_unit,
                          uint32_t trial, const uint8_t *commands, uint32_t command_bytes) {
    if (!isolated_fixture() || !sched_holds_baton() || mods_hook_depth() ||
        !gm_valid(unit, 0x164) || rd32(unit) != 0x0068098c || rd32(unit + 0x60) ||
        rd32(unit + 0x84) || !rd32(unit + 0x88) || !rd32(unit + 0x8c) || !rd32(unit + 0x90))
        return false;
    const uint32_t scratch = heap_alloc(512, true);
    if (!scratch)
        return false;
    char path[1024];
    if (!recomp_writable_path("Script_Stage_Pack.bin", path, sizeof path))
        std::abort();
    std::array<uint8_t, 8192> raw{};
    FILE *file = std::fopen(path, "rb");
    const size_t size = file ? std::fread(raw.data(), 1, raw.size(), file) : 0;
    bool ok = file && std::fgetc(file) == EOF && !std::ferror(file);
    if (file)
        ok = std::fclose(file) == 0 && ok;
    auto word = [&](size_t at) {
        uint32_t result;
        std::memcpy(&result, raw.data() + at, 4);
        return result;
    };
    ok = ok && size >= 40 && word(0) == 0x3153474e && word(4) == 1 && word(8) == 4 &&
         word(16) == rd32(0x0071c6a8);
    size_t cursor = 40;
    auto script = std::make_unique<PrimaryBytes>();
    uint32_t script_size = 0, source_agent = 0;
    for (uint32_t i = 0; ok && i < 4; ++i) {
        if (cursor > size || size - cursor < 68) {
            ok = false;
            break;
        }
        const uint32_t id = word(cursor), agent = word(cursor + 4), bytes = word(cursor + 8);
        if (bytes < 56 || bytes > 4096 || bytes > size - cursor - 68) {
            ok = false;
            break;
        }
        cursor += 68;
        if (id == source_unit) {
            if (script_size) {
                ok = false;
                break;
            }
            script_size = bytes;
            source_agent = agent;
            std::memcpy(script->data(), raw.data() + cursor, bytes);
        }
        cursor += bytes;
    }
    PairPlan plan;
    ok = ok && cursor == size && script_size && source_agent &&
         pair_agent_plan(*script, script_size, source_agent, 0, plan) && plan.count == 4;
    if (!ok) {
        heap_free(scratch);
        return false;
    }
    const uint32_t runtime = guest_call(&extra, 0x00623b20);
    if (!gm_valid(runtime, 0x38))
        std::abort();
    const uint32_t manager = rd32(runtime + 4), pool = rd32(runtime + 0x1c),
                   reserved = rd32(runtime + 0x34), hooks = mods_hooks_installed_count(),
                   clock = rd32(0x0071c6a8), counter = rd32(factory + 0x28),
                   secondary = rd32(factory + 0x2c), count = rd32(manager + 0x34);
    auto lookup = [&](uint32_t id) {
        extra.r[R_ECX] = runtime;
        return guest_call(&extra, 0x006236b0, id);
    };
    if (!reserved || reserved >= 0x7ffffffe || lookup(reserved))
        std::abort();
    const uint32_t leader = lookup(2);
    if (!gm_valid(leader, 0x34))
        std::abort();
    std::array<uint8_t, 0x164> unit_before{};
    std::array<uint8_t, 0x34> leader_before{};
    std::memcpy(unit_before.data(), gm_ptr(unit), unit_before.size());
    std::memcpy(leader_before.data(), gm_ptr(leader), leader_before.size());
    const auto queues = pair_queues(manager);
    const auto baseline = heap_stats();
    AgentPool pool_before{}, pool_after{};
    uint32_t crt_before = 0, crt_after = 0;
    if (!agent_pool(pool, pool_before) || !stage_pool_live(crt_before))
        std::abort();
    char before_name[128], unit_name[128], script_name[128], command_name[128];
    std::snprintf(before_name, sizeof before_name, "Script_Composed_Before_%u_%u.bin", source_unit,
                  trial);
    std::snprintf(unit_name, sizeof unit_name, "Script_Composed_Unit_%u_%u.bin", source_unit,
                  trial);
    std::snprintf(script_name, sizeof script_name, "Script_Composed_GPL_%u_%u.bin", source_unit,
                  trial);
    std::snprintf(command_name, sizeof command_name, "Script_Composed_Orders_%u_%u.bin",
                  source_unit, trial);
    auto native = std::make_unique<PrimaryBytes>();
    auto observed = std::make_unique<PrimaryBytes>();
    size_t native_size = 0, observed_size = 0, ea_offset = 0;
    ok = primary_file(extra, scratch, before_name, factory, unit, true, nullptr, true) &&
         recomp_writable_path(before_name, path, sizeof path) &&
         primary_bytes(path, *native, native_size, false, true) &&
         pair_native_ea(*native, native_size, source_agent, ea_offset);
    wr32(scratch + 128, 0x4541);
    extra.r[R_ECX] = unit + 4;
    guest_call(&extra, 0x00426700, scratch + 132, scratch + 128);
    const uint32_t ea_node = rd32(scratch + 132);
    ok = ok && ea_node != rd32(unit + 8) && gm_valid(ea_node, 0x14) &&
         rd32(ea_node + 0x10) == source_agent;
    if (!ok)
        std::abort();
    const uint32_t clone = guest_call(&extra, 0x0064c616, 0x34u);
    if (!gm_valid(clone, 0x34))
        std::abort();
    extra.r[R_ECX] = clone;
    guest_call(&extra, 0x00625e70);
    const bool allocated = rd32(clone + 0x10) == reserved && rd32(runtime + 0x34) == reserved + 1;
    pair_put(*script, plan.identity, reserved);
    unsigned self = 0, external = 0;
    for (size_t i = 0; i < plan.count; ++i) {
        if (plan.references[i].before == source_agent) {
            pair_put(*script, plan.references[i].offset, reserved);
            ++self;
        } else if (plan.references[i].before == 2)
            ++external;
    }
    if (!allocated || self != 2 || external != 2 ||
        !recomp_writable_path("Script_Composed_Input.bin", path, sizeof path) ||
        !pair_write(path, *script, script_size) ||
        agent_file(extra, scratch, "Script_Composed_Input.bin", clone, false))
        std::abort();
    wr32(scratch + 144, reserved);
    wr32(scratch + 148, clone);
    extra.r[R_ECX] = manager + 0x28;
    guest_call(&extra, 0x00634460, scratch + 128, scratch + 144);
    const uint32_t entry = rd32(scratch + 128);
    const bool inserted =
        rd8(scratch + 132) == 1 && lookup(reserved) == clone && rd32(manager + 0x34) == count + 1;
    if (!inserted)
        std::abort();
    // Only this fixture-owned existing EA value changes. Original typed lookup
    // identifies the node; complete UNIT writers prove the exact scalar edit.
    wr32(ea_node + 0x10, reserved);
    const bool publication = native_identity_enabled();
    NativeRegistrySnapshot registry_before;
    uint32_t native_id = 0;
    const uint32_t command_marker = rd32(unit + 0x40);
    if (publication) {
        if (command_marker || !native_registry_snapshot(factory, registry_before))
            std::abort();
        bool orders_group = false;
        for (uint32_t i = 0; i < registry_before.count; ++i)
            orders_group |= registry_before.groups[i].kind == 0x5244524f &&
                            registry_before.groups[i].table == 0x0068b6f0;
        extra.r[R_ECX] = unit;
        const bool nonempty = (guest_call(&extra, 0x005b2b50) & 0xff) != 0;
        if (!orders_group || !nonempty || rd32(unit + 0x40) != command_marker ||
            !publish_native_identity(extra, factory, unit, native_id) || rd32(clone + 0x24))
            std::abort();
        if (rd32(unit + 0x40) != (command_marker | 1))
            std::abort();
        const uint32_t expected_marker = command_marker | 1;
        std::memcpy(unit_before.data() + 0x40, &expected_marker, 4);
        extra.r[R_ECX] = clone;
        guest_call(&extra, 0x006263b0, native_id);
        pair_put(*native, 36, native_id);
        pair_put(*script, plan.native, native_id);
    } else {
        extra.r[R_ECX] = clone;
        guest_call(&extra, 0x00626340, unit);
    }
    extra.r[R_ECX] = clone;
    const uint32_t backlink = guest_call(&extra, 0x00626310);
    const bool linked = backlink == unit && rd32(clone + 0x24) == unit &&
                        rd32(clone + 0x20) == native_id && rd32(ea_node + 0x10) == reserved &&
                        lookup(reserved) == clone && rd32(unit + 0x60) == native_id &&
                        rd32(unit + 0x84) == (publication ? factory : 0);
    pair_put(*native, ea_offset, reserved);
    const bool unit_equal =
        linked && primary_file(extra, scratch, unit_name, factory, unit, true, nullptr, true) &&
        recomp_writable_path(unit_name, path, sizeof path) &&
        primary_bytes(path, *observed, observed_size, false, true, !publication) &&
        observed_size == native_size && !std::memcmp(observed->data(), native->data(), native_size);
    const bool script_equal = linked && !agent_file(extra, scratch, script_name, clone, true) &&
                              recomp_writable_path(script_name, path, sizeof path) &&
                              agent_bytes(path, *observed, observed_size) &&
                              observed_size == script_size &&
                              !std::memcmp(observed->data(), script->data(), script_size);
    const bool orders_equal =
        linked && live_banks_equal(extra, unit, commands, command_bytes, command_name);
    const char *joint_flag = recomp_env("BROWSER_STREAMING_JOINT_CHECKPOINT_FIXTURE");
    if (publication && source_unit == 2101 && trial == 0 && joint_flag &&
        !std::strcmp(joint_flag, "1")) {
        const bool saved = linked && unit_equal && script_equal && orders_equal &&
                           majesty_browser_frontier_joint_checkpoint(&extra, true);
        std::fprintf(stderr,
                     "[streaming] Joint checkpoint actor=%u trial=%u unit=%u agent=%u "
                     "saved=%u result=%s\n",
                     source_unit, trial, native_id, reserved, unsigned(saved),
                     saved ? "pass" : "fail");
        if (!saved)
            std::abort();
    }
    const bool unscheduled = pair_queues(manager) == queues;
    wr32(ea_node + 0x10, source_agent);
    extra.r[R_ECX] = clone;
    guest_call(&extra, 0x00626340, 0u);
    if (publication) {
        extra.r[R_ECX] = clone;
        guest_call(&extra, 0x006263b0, 0u);
    }
    const bool retired =
        !publication || retire_native_identity(extra, factory, unit, native_id, registry_before);
    if (publication)
        std::fprintf(stderr,
                     "[streaming] Native command marker actor=%u trial=%u before=%u after=%u "
                     "orders-group=1 nonempty=1 retired=%u result=%s\n",
                     source_unit, trial, command_marker, rd32(unit + 0x40), unsigned(retired),
                     retired && rd32(unit + 0x40) == (command_marker | 1) ? "pass" : "fail");
    const bool detached = retired && !rd32(clone + 0x24) && !rd32(clone + 0x20) &&
                          rd32(ea_node + 0x10) == source_agent;
    extra.r[R_ECX] = manager + 0x28;
    guest_call(&extra, 0x006346a0, scratch + 128, entry);
    const bool erased = !lookup(reserved) && rd32(manager + 0x34) == count;
    extra.r[R_ECX] = clone;
    guest_call(&extra, 0x00625fa0);
    guest_call(&extra, 0x00645bc0, clone);
    const auto after = heap_stats();
    const bool preserved =
        !std::memcmp(unit_before.data(), gm_ptr(unit), unit_before.size()) &&
        rd32(ea_node + 0x10) == source_agent && lookup(2) == leader &&
        !std::memcmp(leader_before.data(), gm_ptr(leader), leader_before.size()) &&
        pair_queues(manager) == queues && rd32(runtime + 0x34) == reserved + 1 &&
        rd32(0x0071c6a8) == clock && rd32(factory + 0x28) == counter + unsigned(publication) &&
        rd32(factory + 0x2c) == secondary && mods_hooks_installed_count() == hooks;
    if (!preserved) {
        std::fprintf(
            stderr,
            "[streaming] Native preservation unit=%u ea=%u leader=%u queues=%u script-counter=%u "
            "native-counter=%u secondary=%u clock=%u hooks=%u\n",
            unsigned(!std::memcmp(unit_before.data(), gm_ptr(unit), unit_before.size())),
            unsigned(rd32(ea_node + 0x10) == source_agent),
            unsigned(!std::memcmp(leader_before.data(), gm_ptr(leader), leader_before.size())),
            unsigned(pair_queues(manager) == queues),
            unsigned(rd32(runtime + 0x34) == reserved + 1),
            unsigned(rd32(factory + 0x28) == counter + unsigned(publication)),
            unsigned(rd32(factory + 0x2c) == secondary), unsigned(rd32(0x0071c6a8) == clock),
            unsigned(mods_hooks_installed_count() == hooks));
        for (uint32_t at = 0; at < unit_before.size(); at += 4) {
            uint32_t old;
            std::memcpy(&old, unit_before.data() + at, 4);
            if (old != rd32(unit + at))
                std::fprintf(
                    stderr,
                    "[streaming] Native unit header change offset=%u before=%08x after=%08x\n", at,
                    old, rd32(unit + at));
        }
    }
    const bool balanced =
        after.used_bytes == baseline.used_bytes && after.used_blocks == baseline.used_blocks &&
        after.req_bytes == baseline.req_bytes && agent_pool(pool, pool_after) &&
        pool_after == pool_before && stage_pool_live(crt_after) && crt_after == crt_before;
    ok = allocated && inserted && linked && unit_equal && script_equal && orders_equal &&
         unscheduled && detached && erased && preserved && balanced;
    heap_free(scratch);
    if (publication)
        std::fprintf(
            stderr,
            "[streaming] Script published actor=%u trial=%u old-agent=%u new-agent=%u "
            "unit-id=%u world=1 native-before=%u groups=%u lookup=1 backlink=%u "
            "self=2 leader=2 commands=%u unit-equal=%u script-equal=%u orders-equal=%u "
            "unscheduled=%u detached=%u retired=%u erased=%u preserved=%u balanced=%u result=%s\n",
            source_unit, trial, source_agent, reserved, native_id, counter, registry_before.count,
            unsigned(linked), command_bytes, unsigned(unit_equal), unsigned(script_equal),
            unsigned(orders_equal), unsigned(unscheduled), unsigned(detached), unsigned(retired),
            unsigned(erased), unsigned(preserved), unsigned(balanced), ok ? "pass" : "fail");
    else
        std::fprintf(stderr,
                     "[streaming] Script composed actor=%u trial=%u old-agent=%u new-agent=%u "
                     "unit-id=0 world=0 backlink=1 self=2 leader=2 commands=%u unit-equal=%u "
                     "script-equal=%u orders-equal=%u unscheduled=%u detached=%u erased=%u "
                     "preserved=%u balanced=%u result=%s\n",
                     source_unit, trial, source_agent, reserved, command_bytes,
                     unsigned(unit_equal), unsigned(script_equal), unsigned(orders_equal),
                     unsigned(unscheduled), unsigned(detached), unsigned(erased),
                     unsigned(preserved), unsigned(balanced), ok ? "pass" : "fail");
    return ok;
}
struct PairRendering {
    uint32_t handler = 0, head = 0, tail = 0, count = 0;
    uint64_t hash = 14695981039346656037ull;
    bool valid = false;
    bool operator==(const PairRendering &) const = default;
};
PairRendering pair_rendering(uint32_t factory) {
    PairRendering result;
    result.handler = rd32(factory + 0x30);
    if (!gm_valid(result.handler, 0x3c) || rd32(result.handler) != 0x0068b608u)
        return result;
    result.head = rd32(result.handler + 8);
    result.tail = rd32(result.handler + 0xc);
    result.count = rd32(result.handler + 0x38);
    if (result.count > 100000)
        return result;
    uint32_t previous = 0, node = result.head, visited = 0;
    while (node && visited < result.count) {
        if (!gm_valid(node, 0x14) || rd32(node) != previous)
            return result;
        // The original drawing-bank node is prev/next/depth/model-index/UNIT.
        // Include node identity and all five fields; retain no per-unit array.
        result.hash = (result.hash ^ node) * 1099511628211ull;
        for (unsigned offset = 0; offset != 0x14; offset += 4)
            result.hash = (result.hash ^ rd32(node + offset)) * 1099511628211ull;
        previous = node;
        node = rd32(node + 4);
        ++visited;
    }
    result.valid = !node && visited == result.count && previous == result.tail;
    return result;
}
void live_name(uint32_t context, char *out, size_t capacity) {
    const uint32_t function = rd32(context + 8);
    if (!gm_valid(function, 12))
        return;
    const uint32_t text = rd32(function), length = rd32(function + 8);
    if (length >= capacity || !gm_valid(text, length))
        return;
    for (uint32_t i = 0; i != length; ++i) {
        const uint8_t ch = rd8(text + i);
        out[i] = ch >= 32 && ch < 127 ? char(ch) : '?';
    }
}
struct LiveContext {
    uint32_t frame = 0, context = 0, delay = 0, before = 0, after = 0, flags = 0;
    bool ran = false, returned = false;
    char name[64]{};
};
struct LiveActor {
    uint32_t world = 0, factory = 0, runtime = 0, manager = 0;
    uint32_t unit = 0, unit_id = 0, agent = 0, agent_id = 0, tree_node = 0;
    uint32_t source_unit = 0, source_id = 0, source_agent = 0;
    uint32_t frame = 0, start = 0, calls = 0, returns = 0, contexts = 0, executed = 0;
    uint32_t agent_hook = 0, context_hook = 0, hooks_before = 0;
    uint32_t cleanup_scratch = 0;
    int32_t x = 0, y = 0;
    bool active = false, running = false, valid_links = true, valid_trace = true;
    uint32_t arrival_home = 0;
    uint64_t arrival_home_hash = 0;
    bool arrival = false, persist_arrival = false;
};
LiveActor live_actor;
bool arrival_checkpoint_ready = false;
std::array<LiveContext, 64> live_contexts{};
std::array<LiveContext, 8> live_executions{};
static_assert(sizeof live_contexts + sizeof live_executions + sizeof live_actor < 8192);
void live_agent_trace(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    const bool owned = live_actor.active && cpu->ecx == live_actor.agent;
    const bool prior_running = live_actor.running;
    if (owned) {
        ++live_actor.calls;
        live_actor.running = true;
    }
    const PopModStatus status = mods_call_next(api, inv, cpu);
    if (owned) {
        live_actor.valid_trace = live_actor.valid_trace && status == POP_OK;
        live_actor.running = prior_running;
        ++live_actor.returns;
    }
}
void live_context_trace(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    const bool owned =
        live_actor.active && live_actor.running && rd32(0x00720304u) == live_actor.agent;
    const uint32_t sequence = owned ? live_actor.contexts++ : 0;
    LiveContext sample{};
    if (owned && gm_valid(cpu->ecx, 0x45) && gm_valid(cpu->esp + 4, 4)) {
        sample.frame = rd32(cpu->esp + 4);
        sample.context = cpu->ecx;
        sample.delay = rd32(cpu->ecx + 0x34);
        sample.flags = rd32(cpu->ecx + 0x3c);
        sample.before = rd32(cpu->ecx + 0x38);
        live_name(cpu->ecx, sample.name, sizeof sample.name);
    }
    const PopModStatus status = mods_call_next(api, inv, cpu);
    if (owned) {
        sample.ran = (cpu->eax & 0xff) == 1;
        sample.returned = status == POP_OK;
        live_actor.valid_trace = live_actor.valid_trace && sample.returned;
        if (gm_valid(sample.context, 0x45))
            sample.after = rd32(sample.context + 0x38);
        if (sample.ran)
            live_executions[live_actor.executed++ % live_executions.size()] = sample;
        live_contexts[sequence % live_contexts.size()] = sample;
    }
}
bool live_remove_hooks() {
    bool removed = true;
    if (live_actor.agent_hook) {
        const bool ok = mods_hook_remove(MODS_OWNER_RUNTIME, live_actor.agent_hook) == POP_OK;
        removed = ok && removed;
        if (ok)
            live_actor.agent_hook = 0;
    }
    if (live_actor.context_hook) {
        const bool ok = mods_hook_remove(MODS_OWNER_RUNTIME, live_actor.context_hook) == POP_OK;
        removed = ok && removed;
        if (ok)
            live_actor.context_hook = 0;
    }
    return removed;
}
struct LiveDrawing {
    uint32_t kept = 0, excluded = 0;
    uint64_t hash = 14695981039346656037ull;
    bool valid = false;
    bool operator==(const LiveDrawing &) const = default;
};
LiveDrawing live_drawing(uint32_t factory, uint32_t unit) {
    LiveDrawing result;
    const PairRendering full = pair_rendering(factory);
    if (!full.valid)
        return result;
    for (uint32_t node = full.head; node; node = rd32(node + 4)) {
        if (rd32(node + 0x10) == unit) {
            ++result.excluded;
            continue;
        }
        ++result.kept;
        result.hash = (result.hash ^ node) * 1099511628211ull;
        for (unsigned offset = 8; offset != 0x14; offset += 4)
            result.hash = (result.hash ^ rd32(node + offset)) * 1099511628211ull;
    }
    result.valid = true;
    return result;
}

bool arrival_bytes(const char *path, PrimaryBytes &bytes, size_t &size) {
    FILE *file = std::fopen(path, "rb");
    if (!file)
        return false;
    size = std::fread(bytes.data(), 1, bytes.size(), file);
    const bool bounded = std::fgetc(file) == EOF && !std::ferror(file);
    return std::fclose(file) == 0 && bounded;
}
uint64_t arrival_home_hash(uint32_t home, uint32_t omit) {
    const uint32_t container = rd32(home + 0x94);
    if (!gm_valid(container, 16))
        return 0;
    const uint32_t first = rd32(container + 4), last = rd32(container + 8);
    if (last < first || (last - first) % 4 || last - first > 4096 || !gm_valid(first, last - first))
        return 0;
    uint64_t hash = 14695981039346656037ull;
    uint32_t members = 0;
    for (uint32_t at = first; at != last; at += 4) {
        const uint32_t group = rd32(at);
        if (!gm_valid(group, 0x18) || rd32(group) != home)
            return 0;
        hash = (hash ^ rd32(group + 4)) * 1099511628211ull;
        const uint32_t start = rd32(group + 0xc), end = rd32(group + 0x10);
        if (end < start || (end - start) % 8 || end - start > 8192 || !gm_valid(start, end - start))
            return 0;
        for (uint32_t item = start; item != end; item += 8) {
            if (++members > 1024)
                return 0;
            const uint32_t value = rd32(item), flags = rd32(item + 4);
            if (omit && value == omit && !(flags & 1))
                continue;
            hash = (hash ^ value) * 1099511628211ull;
            hash = (hash ^ flags) * 1099511628211ull;
        }
    }
    return hash;
}
bool arrival_contains(uint32_t owner, uint32_t kind, uint32_t member) {
    const uint32_t container = rd32(owner + 0x94);
    if (!gm_valid(container, 16))
        return false;
    const uint32_t first = rd32(container + 4), last = rd32(container + 8);
    if (last < first || last - first > 4096 || (last - first) % 4 || !gm_valid(first, last - first))
        return false;
    unsigned matches = 0;
    for (uint32_t at = first; at != last; at += 4) {
        const uint32_t group = rd32(at);
        if (!gm_valid(group, 0x18) || rd32(group) != owner)
            return false;
        if (rd32(group + 4) != kind)
            continue;
        const uint32_t start = rd32(group + 0xc), end = rd32(group + 0x10);
        if (end < start || end - start > 8192 || (end - start) % 8 || !gm_valid(start, end - start))
            return false;
        for (uint32_t item = start; item != end; item += 8)
            matches += rd32(item) == member && !(rd32(item + 4) & 1);
    }
    return matches == 1;
}
uint32_t arrival_container_file(X86 &extra, uint32_t scratch, const char *name, uint32_t factory,
                                uint32_t unit, bool write) {
    std::memset(gm_ptr(scratch), 0, 512);
    const uint32_t text = scratch + 256, wrapper = scratch + 16;
    gm_put_str(text, name, 128);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3340u);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3590u, text, uint32_t(std::strlen(name)));
    extra.r[R_ECX] = wrapper;
    guest_call(&extra, write ? 0x004ee910u : 0x004ef470u, scratch, write ? 0x82u : 0xa0u,
               rd32(0x0068c7f0u));
    uint32_t result = 0xffffffffu;
    if (rd32(wrapper)) {
        extra.r[R_ECX] = unit + 0x94;
        result = guest_call(&extra, write ? 0x005995c0u : 0x00599460u, factory, wrapper);
    }
    extra.r[R_ECX] = wrapper;
    guest_call(&extra, write ? 0x004eeb10u : 0x004ef680u);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3820u);
    return result;
}

struct DepartureList {
    uint32_t count = 0, matches = 0;
    uint64_t other_hash = 14695981039346656037ull;
    bool valid = false;
};
DepartureList departure_list_state(uint32_t list, uint32_t agent_id) {
    DepartureList state;
    if (!gm_valid(list, 0x14) || rd32(list) != 0x0068c2e0u || rd32(list + 4) != 4 ||
        rd32(list + 0x10) > 1024)
        return state;
    const uint32_t head = rd32(list + 0xc);
    if (!gm_valid(head, 12))
        return state;
    uint32_t previous = head;
    for (uint32_t node = rd32(head); node != head; node = rd32(node)) {
        if (!gm_valid(node, 12) || rd32(node + 4) != previous || ++state.count > rd32(list + 0x10))
            return state;
        const uint32_t value = rd32(node + 8);
        if (!gm_valid(value, 16))
            return state;
        if (rd32(value) == 0x0068c054u && rd32(value + 4) == 5 && rd32(value + 8) == agent_id)
            ++state.matches;
        else {
            state.other_hash = (state.other_hash ^ node) * 1099511628211ull;
            state.other_hash = (state.other_hash ^ value) * 1099511628211ull;
        }
        previous = node;
    }
    state.valid = state.count == rd32(list + 0x10) && rd32(head + 4) == previous;
    return state;
}
uint32_t departure_list(X86 &extra, uint32_t scratch, uint32_t agent, const char *key) {
    std::memset(gm_ptr(scratch), 0, 512);
    gm_put_str(scratch + 256, key, 128);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3340u);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3590u, scratch + 256, uint32_t(std::strlen(key)));
    extra.r[R_ECX] = agent;
    const uint32_t value = guest_call(&extra, 0x006263d0u, scratch);
    extra.r[R_ECX] = scratch;
    guest_call(&extra, 0x004e3820u);
    return value;
}

// Production selected-owner admission, shared by native and WASM builds.
// Inputs are current aliases from the verified custody snapshot, never the
// historical origin IDs. Keep every guest pointer within this one call.
extern "C" bool majesty_browser_streaming_restore_remote_hero_binding(X86 *,const uint32_t *);
extern "C" bool majesty_browser_streaming_selected_hero_ready(X86 *c,const uint32_t *binding) {
    if(!c||!binding||mods_hook_depth()||!sched_holds_baton()||
       c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    const uint32_t clock=binding[0],id=binding[1],agent_id=binding[2],description=binding[3],player=binding[4],
        home_id=binding[5],guild_id=binding[6],home_description=binding[7];
    // A loaded remote owner is already postloaded and scheduled by the original
    // loader. Rebind its existing graph and install the foreign-home guard;
    // importing or activating it again would duplicate scheduler membership.
    if(!home_id)return majesty_browser_streaming_restore_remote_hero_binding(c,binding);
    if(!id||!agent_id||!description||player>7||!home_id||!guild_id||!home_description||
       id==home_id||agent_id==guild_id)return false;
    const uint32_t world=rd32(0x0071c68c),state=rd32(0x006d7670),hooks=mods_hooks_installed_count();
    if(!gm_valid(world,0x14)||!gm_valid(state,0x50)||rd32(state)!=3||rd32(state+4)||rd32(0x0071c6a8)!=clock)return false;
    const uint32_t factory=rd32(world+0x10);if(!gm_valid(factory,0x8c))return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=factory;
    const uint32_t unit=guest_call(&extra,0x005a10d0u,id);
    extra.r[R_ECX]=factory;const uint32_t home=guest_call(&extra,0x005a10d0u,home_id);
    if(!gm_valid(unit,0x164)||!gm_valid(home,0x98)||rd32(unit+0x60)!=id||rd32(home+0x60)!=home_id||
       rd32(unit+0x6c)!=description||rd32(home+0x6c)!=home_description||rd32(unit+0x70)!=player||rd32(home+0x70)!=player||
       rd32(unit+0x84)!=factory||rd32(home+0x84)!=factory||(rd32(unit+0x64)&4)||(rd32(home+0x64)&4)||
       (rd32(unit+0x74)&&rd32(unit+0x74)!=home_id)||
       !arrival_contains(home,100,unit)||!arrival_contains(unit,101,home)||
       (rd32(unit+0x74)==home_id&&!arrival_contains(home,2,unit)))return false;
    const uint32_t runtime=guest_call(&extra,0x00623b20u);if(!gm_valid(runtime,0x38))return false;
    extra.r[R_ECX]=runtime;const uint32_t agent=guest_call(&extra,0x006236b0u,agent_id);
    extra.r[R_ECX]=runtime;const uint32_t guild=guest_call(&extra,0x006236b0u,guild_id);
    if(!gm_valid(agent,0x34)||!gm_valid(guild,0x34)||rd32(agent+0x10)!=agent_id||rd32(guild+0x10)!=guild_id||
       rd32(agent+0x20)!=id||rd32(guild+0x20)!=home_id||rd8(agent+0x28)||rd8(guild+0x28))return false;
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)return false;
    const uint32_t home_value=departure_list(extra,scratch,agent,"home");
    const bool linked=gm_valid(home_value,12)&&rd32(home_value)==0x0068c054u&&
        rd32(home_value+4)==5&&rd32(home_value+8)==guild_id;
    const auto members=departure_list_state(departure_list(extra,scratch,guild,"members"),agent_id);
    const bool freed=heap_free(scratch);
    return linked&&members.valid&&members.matches==1&&freed&&rd32(0x0071c68c)==world&&
        rd32(0x0071c6a8)==clock&&rd32(state)==3&&!rd32(state+4)&&mods_hooks_installed_count()==hooks;
}

bool departure_fixture(X86 *c) {
    static bool attempted = false;
    const char *flag = recomp_env("BROWSER_STREAMING_DEPARTURE_FIXTURE");
    if (attempted || !flag || std::strcmp(flag, "1"))
        return false;
    attempted = true;
    if (!isolated_fixture() || live_actor.active) {
        std::fprintf(stderr, "[streaming] Departure fixture skipped: isolated profile required\n");
        return false;
    }
#ifdef __EMSCRIPTEN__
    if (!browser_actor_fixture(false)) {
        std::fprintf(stderr, "[streaming] Departure fixture skipped: owned source "
                             "profile required\n");
        return false;
    }
#endif
    // An immutable stopped source has exactly two incoming external GPL refs,
    // both in this outpost's rosters. This probe is not a general deletion API.
    if (!owned_vehicle.resolved || owned_vehicle.id != 506 ||
        !gm_valid(owned_vehicle.self, 0x164) || c->r[R_ESP] < STACK_LIMIT + 65536 ||
        c->r[R_ESP] > STACK_TOP)
        return false;
    X86 extra = *c;
    extra.r[R_ESP] -= 512;
    const uint32_t scratch = heap_alloc(512, true);
    if (!scratch)
        return false;
    const uint32_t unit = owned_vehicle.self, factory = owned_vehicle.factory;
    const uint32_t runtime = guest_call(&extra, 0x00623b20u);
    if (!gm_valid(runtime, 0x38)) {
        heap_free(scratch);
        return false;
    }
    extra.r[R_ECX] = runtime;
    const uint32_t actor = guest_call(&extra, 0x006236b0u, 9u);
    extra.r[R_ECX] = runtime;
    const uint32_t home_agent = guest_call(&extra, 0x006236b0u, 7u);
    extra.r[R_ECX] = factory;
    const uint32_t home = guest_call(&extra, 0x005a10d0u, 502u);
    const uint32_t manager = rd32(runtime + 4);
    if (!gm_valid(actor, 0x34) || !gm_valid(home_agent, 0x34) || !gm_valid(home, 0x98) ||
        !gm_valid(manager, 0x4c)) {
        heap_free(scratch);
        return false;
    }
    const uint32_t guards = departure_list(extra, scratch, home_agent, "Guards");
    const uint32_t waiting = departure_list(extra, scratch, home_agent, "Waiting_Guards");
    const DepartureList before_guards = departure_list_state(guards, 9);
    const DepartureList before_waiting = departure_list_state(waiting, 9);
    const uint64_t home_hash = arrival_home_hash(home, unit);
    LiveDrawing before = live_drawing(factory, unit);
    const uint32_t excluded = before.excluded;
    before.excluded = 0;
    const uint32_t entries = rd32(manager + 0x34);
    const uint32_t queued = rd32(manager + 0x18) + rd32(manager + 0x24);
    bool valid = gm_valid(actor, 0x34) && gm_valid(home_agent, 0x34) && gm_valid(home, 0x98) &&
                 rd32(actor + 0x10) == 9 && rd32(actor + 0x20) == 506 && !rd8(actor + 0x28) &&
                 rd32(home_agent + 0x10) == 7 && rd32(home_agent + 0x20) == 502 &&
                 rd32(unit) == 0x0068098cu && rd32(unit + 0x74) == 502 &&
                 (rd8(0x006d16f0u) & 12) == 12 && !rd32(manager + 0x48) && before_guards.valid &&
                 before_guards.matches == 1 && before_waiting.valid &&
                 before_waiting.matches == 1 && home_hash && before.valid && excluded == 1 &&
                 arrival_contains(home, 100, unit) && arrival_contains(home, 2, unit) &&
                 arrival_contains(unit, 101, home);
    char paths[3][1024]{};
    const char *names[3] = {"Actor_Departure_Unit_Source.bin", "Actor_Departure_Agent_Source.bin",
                            "Actor_Departure_Container_Source.bin"};
    for (unsigned i = 0; i != 3; ++i)
        valid = recomp_writable_path(names[i], paths[i], sizeof paths[i]) && valid;
    // Persist complete original actor records before changing either ownership.
    valid = valid && primary_file(extra, scratch, names[0], factory, unit, true, nullptr, true) &&
            !agent_file(extra, scratch, names[1], actor, true) &&
            !arrival_container_file(extra, scratch, names[2], factory, unit, true);
    auto bytes = std::make_unique<PrimaryBytes>();
    size_t unit_size = 0, agent_size = 0, container_size = 0;
    valid = valid && arrival_bytes(paths[0], *bytes, unit_size) && unit_size == 390 &&
            pair_word(*bytes, 36) == 506 && pair_word(*bytes, 56) == 502 &&
            arrival_bytes(paths[1], *bytes, agent_size) && agent_size == 1838 &&
            arrival_bytes(paths[2], *bytes, container_size) && container_size == 32 &&
            pair_word(*bytes, 20) == 506 && pair_word(*bytes, 24) == 502;
    std::fprintf(stderr,
                 "[streaming] Departure prepared unit=506 agent=9 home=502 home-agent=7 "
                 "guards=%u waiting=%u unit-bytes=%zu agent-bytes=%zu container-bytes=%zu "
                 "valid=%u\n",
                 before_guards.count, before_waiting.count, unit_size, agent_size, container_size,
                 unsigned(valid));
    if (!valid) {
        heap_free(scratch);
        return false;
    }
    // Operator 5 removes equal values using the original comparison, pool return
    // and list unlink. A separate pooled operand outlives both removals.
    extra.r[R_ECX] = rd32(runtime + 0x1c);
    const uint32_t operand = guest_call(&extra, 0x0062a810u, 5u);
    if (!operand) {
        heap_free(scratch);
        return false;
    }
    extra.r[R_ECX] = operand;
    guest_call(&extra, 0x006254c0u, 9u);
    std::memset(gm_ptr(scratch), 0, 512);
    wr32(scratch + 64, operand);
    wr32(scratch + 32 + 0x18, scratch + 64);
    for (const uint32_t list : {guards, waiting}) {
        extra.r[R_ECX] = list;
        guest_call(&extra, 0x00639bb0u, scratch + 32, 5u);
    }
    extra.r[R_ECX] = rd32(runtime + 0x1c);
    guest_call(&extra, 0x0062aa20u, operand);
    const DepartureList after_guards = departure_list_state(guards, 9);
    const DepartureList after_waiting = departure_list_state(waiting, 9);
    const bool rosters = after_guards.valid && after_waiting.valid && !after_guards.matches &&
                         !after_waiting.matches && after_guards.count + 1 == before_guards.count &&
                         after_waiting.count + 1 == before_waiting.count &&
                         after_guards.other_hash == before_guards.other_hash &&
                         after_waiting.other_hash == before_waiting.other_hash;
    if (!rosters) {
        heap_free(scratch);
        std::fprintf(stderr, "[streaming] Departure fixture failed: roster removal\n");
        return false;
    }
    // The original complete unit-removal lifecycle clears its EA, removes the
    // agent's ID/queues into deferred destruction, clears relationships/orders,
    // unlinks rendering/spatial state and deletes the native factory entry.
    extra.r[R_ECX] = unit;
    guest_call(&extra, 0x005a21b0u);
    const bool deferred = rd32(manager + 0x48) == 1;
    extra.r[R_ECX] = manager;
    guest_call(&extra, 0x00633370u);
    extra.r[R_ECX] = runtime;
    const bool removed_agent = !guest_call(&extra, 0x006236b0u, 9u);
    extra.r[R_ECX] = factory;
    const bool removed_unit = !guest_call(&extra, 0x005a10d0u, 506u);
    const bool memberships = arrival_home_hash(home, 0) == home_hash;
    const bool rendering = live_drawing(factory, unit) == before;
    const bool queues = rd32(manager + 0x18) + rd32(manager + 0x24) + 1 == queued &&
                        rd32(manager + 0x34) + 1 == entries && !rd32(manager + 0x48);
    extra.r[R_ECX] = runtime;
    const bool home_script = guest_call(&extra, 0x006236b0u, 7u) == home_agent;
    extra.r[R_ECX] = factory;
    const bool home_native = guest_call(&extra, 0x005a10d0u, 502u) == home;
    heap_free(scratch);
    const bool passed = rosters && deferred && removed_agent && removed_unit && memberships &&
                        rendering && queues && home_script && home_native;
    std::fprintf(stderr,
                 "[streaming] Departure fixture completed rosters=%u deferred=%u "
                 "removed-agent=%u removed-unit=%u memberships=%u rendering=%u "
                 "queues=%u home-script=%u home-native=%u scratch-released=1 result=%s\n",
                 unsigned(rosters), unsigned(deferred), unsigned(removed_agent),
                 unsigned(removed_unit), unsigned(memberships), unsigned(rendering),
                 unsigned(queues), unsigned(home_script), unsigned(home_native),
                 passed ? "pass" : "fail");
    return passed;
}

void departure_reload_fixture(X86 *c) {
    static bool attempted = false;
    const char *flag = recomp_env("BROWSER_STREAMING_DEPARTURE_RELOAD_FIXTURE");
    if (attempted || !flag || std::strcmp(flag, "1"))
        return;
    attempted = true;
    if (!isolated_fixture()) {
        std::fprintf(stderr, "[streaming] Departure reload skipped: isolated profile required\n");
        return;
    }
#ifdef __EMSCRIPTEN__
    if (!browser_actor_fixture(false)) {
        std::fprintf(stderr, "[streaming] Departure reload skipped: owned source "
                             "profile required\n");
        return;
    }
#endif
    if (c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
        return;
    X86 extra = *c;
    extra.r[R_ESP] -= 512;
    const uint32_t runtime = guest_call(&extra, 0x00623b20u);
    const uint32_t world = rd32(0x0071c68cu);
    if (!gm_valid(runtime, 0x38) || !gm_valid(world, 0x14))
        return;
    const uint32_t factory = rd32(world + 0x10);
    if (!gm_valid(factory, 0x88))
        return;
    extra.r[R_ECX] = runtime;
    const bool agent_absent = !guest_call(&extra, 0x006236b0u, 9u);
    extra.r[R_ECX] = factory;
    const bool unit_absent = !guest_call(&extra, 0x005a10d0u, 506u);
    extra.r[R_ECX] = runtime;
    const uint32_t home_agent = guest_call(&extra, 0x006236b0u, 7u);
    extra.r[R_ECX] = factory;
    const uint32_t home = guest_call(&extra, 0x005a10d0u, 502u);
    if (!gm_valid(home_agent, 0x34) || !gm_valid(home, 0x98))
        return;
    extra.r[R_ECX] = home_agent;
    const bool home_pair =
        guest_call(&extra, 0x00626310u) == home && rd32(home_agent + 0x20) == 502;
    const uint32_t scratch = heap_alloc(512, true);
    if (!scratch)
        return;
    const DepartureList guards =
        departure_list_state(departure_list(extra, scratch, home_agent, "Guards"), 9);
    const DepartureList waiting =
        departure_list_state(departure_list(extra, scratch, home_agent, "Waiting_Guards"), 9);
    const bool rosters = guards.valid && waiting.valid && !guards.matches && !waiting.matches &&
                         !guards.count && !waiting.count;
    heap_free(scratch);
    std::fprintf(stderr,
                 "[streaming] Departure reload completed unit-absent=%u "
                 "agent-absent=%u home-pair=%u roster-clean=%u "
                 "scratch-released=1 result=%s\n",
                 unsigned(unit_absent), unsigned(agent_absent), unsigned(home_pair),
                 unsigned(rosters),
                 unit_absent && agent_absent && home_pair && rosters ? "pass" : "fail");
}

void arrival_persist_reload_fixture(X86 *c) {
    static bool attempted = false;
    const char *flag = recomp_env("BROWSER_STREAMING_ARRIVAL_PERSIST_RELOAD_FIXTURE");
    if (attempted || !flag || std::strcmp(flag, "1"))
        return;
    attempted = true;
    if (!isolated_fixture()) {
        std::fprintf(stderr, "[streaming] Arrival persistent reload skipped: "
                             "isolated profile required\n");
        return;
    }
#ifdef __EMSCRIPTEN__
    if (!browser_actor_fixture(true)) {
        std::fprintf(stderr, "[streaming] Arrival persistent reload skipped: owned "
                             "destination profile required\n");
        return;
    }
#endif
    if (c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
        return;
#ifdef __EMSCRIPTEN__
    constexpr uint32_t unit_id = 609, agent_id = 77;
#else
    constexpr uint32_t unit_id = 802, agent_id = 207;
#endif
    X86 extra = *c;
    extra.r[R_ESP] -= 512;
    const uint32_t runtime = guest_call(&extra, 0x00623b20u);
    const uint32_t world = rd32(0x0071c68cu);
    if (!gm_valid(runtime, 0x38) || !gm_valid(world, 0x14))
        return;
    const uint32_t factory = rd32(world + 0x10);
    if (!gm_valid(factory, 0x88))
        return;
    extra.r[R_ECX] = runtime;
    const uint32_t actor = guest_call(&extra, 0x006236b0u, agent_id);
    extra.r[R_ECX] = runtime;
    const uint32_t home_agent = guest_call(&extra, 0x006236b0u, 6u);
    extra.r[R_ECX] = factory;
    const uint32_t unit = guest_call(&extra, 0x005a10d0u, unit_id);
    extra.r[R_ECX] = factory;
    const uint32_t home = guest_call(&extra, 0x005a10d0u, 531u);
    if (!gm_valid(actor, 0x34) || !gm_valid(home_agent, 0x34) || !gm_valid(unit, 0x164) ||
        !gm_valid(home, 0x98)) {
        std::fprintf(stderr, "[streaming] Arrival persistent reload failed: "
                             "missing actor or home\n");
        return;
    }
    extra.r[R_ECX] = actor;
    bool links = guest_call(&extra, 0x00626310u) == unit && rd32(actor + 0x10) == agent_id &&
                 rd32(actor + 0x20) == unit_id && !rd8(actor + 0x28) &&
                 rd32(unit + 0x60) == unit_id && rd32(unit + 0x74) == 531;
    extra.r[R_ECX] = home_agent;
    links = links && guest_call(&extra, 0x00626310u) == home && rd32(home_agent + 0x20) == 531;
    const bool memberships = arrival_contains(home, 100, unit) && arrival_contains(home, 2, unit) &&
                             arrival_contains(unit, 101, home);
    const uint32_t scratch = heap_alloc(512, true);
    if (!scratch)
        return;
    const DepartureList guards =
        departure_list_state(departure_list(extra, scratch, home_agent, "Guards"), agent_id);
    const DepartureList waiting = departure_list_state(
        departure_list(extra, scratch, home_agent, "Waiting_Guards"), agent_id);
    wr32(scratch + 128, 0x4541u);
    extra.r[R_ECX] = unit + 4;
    guest_call(&extra, 0x00426700u, scratch + 132, scratch + 128);
    const uint32_t ea_node = rd32(scratch + 132);
    links = links && ea_node != rd32(unit + 8) && gm_valid(ea_node, 0x14) &&
            rd32(ea_node + 0x10) == agent_id;
    const bool rosters =
        guards.valid && waiting.valid && guards.matches == 1 && waiting.matches == 1;
    const LiveDrawing drawing = live_drawing(factory, unit);
    const bool rendering = drawing.valid && drawing.excluded == 1;
    heap_free(scratch);
    std::fprintf(stderr,
                 "[streaming] Arrival persistent reload completed unit=%u "
                 "agent=%u home=531 home-agent=6 links=%u memberships=%u "
                 "rosters=%u rendering=%u scratch-released=1 result=%s\n",
                 unit_id, agent_id, unsigned(links), unsigned(memberships), unsigned(rosters),
                 unsigned(rendering),
                 links && memberships && rosters && rendering ? "pass" : "fail");
}

void transfer_reload(X86 *c, bool moved, bool destination) {
    const char *flag = recomp_env("BROWSER_STREAMING_TRANSFER_RELOAD_FIXTURE");
    if (!flag || std::strcmp(flag, "1") || !enabled())
        return;
#ifdef __EMSCRIPTEN__
    if (!browser_actor_fixture(destination)) {
        std::fprintf(stderr, "[streaming] Transfer reload skipped: isolated profile required\n");
        return;
    }
#endif
    if (c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
        return;
    X86 extra = *c;
    extra.r[R_ESP] -= 512;
    const uint32_t runtime = guest_call(&extra, 0x00623b20u), world = rd32(0x0071c68cu);
    if (!gm_valid(runtime, 0x38) || !gm_valid(world, 0x14))
        return;
    const uint32_t factory = rd32(world + 0x10);
    if (!gm_valid(factory, 0x88))
        return;
#ifdef __EMSCRIPTEN__
    const uint32_t actor_id = destination ? 77 : 9;
    const uint32_t unit_id = destination ? 609 : 506;
#else
    const uint32_t actor_id = destination ? 207 : 9;
    const uint32_t unit_id = destination ? 802 : 506;
#endif
    const uint32_t home_id = destination ? 531 : 502;
    const uint32_t home_agent_id = destination ? 6 : 7;
    extra.r[R_ECX] = runtime;
    const uint32_t actor = guest_call(&extra, 0x006236b0u, actor_id);
    extra.r[R_ECX] = runtime;
    const uint32_t home_agent = guest_call(&extra, 0x006236b0u, home_agent_id);
    extra.r[R_ECX] = factory;
    const uint32_t unit = guest_call(&extra, 0x005a10d0u, unit_id);
    extra.r[R_ECX] = factory;
    const uint32_t home = guest_call(&extra, 0x005a10d0u, home_id);
    if (!gm_valid(home_agent, 0x34) || !gm_valid(home, 0x98))
        return;
    const bool present = destination ? moved : !moved;
    bool links = !actor && !unit;
    bool memberships = links, rendering = links;
    if (present) {
        links = gm_valid(actor, 0x34) && gm_valid(unit, 0x164);
        if (links) {
            extra.r[R_ECX] = actor;
            links = guest_call(&extra, 0x00626310u) == unit && rd32(actor + 0x10) == actor_id &&
                    rd32(actor + 0x20) == unit_id && !rd8(actor + 0x28) &&
                    rd32(unit + 0x60) == unit_id && rd32(unit + 0x74) == home_id;
            memberships = arrival_contains(home, 100, unit) && arrival_contains(home, 2, unit) &&
                          arrival_contains(unit, 101, home);
            const LiveDrawing drawing = live_drawing(factory, unit);
            rendering = drawing.valid && drawing.excluded == 1;
        } else {
            memberships = rendering = false;
        }
    }
    extra.r[R_ECX] = home_agent;
    links = links && guest_call(&extra, 0x00626310u) == home && rd32(home_agent + 0x20) == home_id;
    const uint32_t scratch = heap_alloc(512, true);
    if (!scratch)
        return;
    const DepartureList guards =
        departure_list_state(departure_list(extra, scratch, home_agent, "Guards"), actor_id);
    const DepartureList waiting = departure_list_state(
        departure_list(extra, scratch, home_agent, "Waiting_Guards"), actor_id);
    const bool rosters = guards.valid && waiting.valid && guards.matches == unsigned(present) &&
                         waiting.matches == unsigned(present);
    if (present && gm_valid(unit, 0x164)) {
        wr32(scratch + 128, 0x4541u);
        extra.r[R_ECX] = unit + 4;
        guest_call(&extra, 0x00426700u, scratch + 132, scratch + 128);
        const uint32_t ea = rd32(scratch + 132);
        links = links && ea != rd32(unit + 8) && gm_valid(ea, 0x14) && rd32(ea + 0x10) == actor_id;
    }
    heap_free(scratch);
    const bool passed = links && memberships && rosters && rendering;
    std::fprintf(stderr,
                 "[streaming] Transfer reload side=%s moved=%u "
                 "expected-present=%u unit=%u agent=%u links=%u memberships=%u "
                 "rosters=%u rendering=%u scratch-released=1 result=%s\n",
                 destination ? "destination" : "source", unsigned(moved), unsigned(present),
                 unit_id, actor_id, unsigned(links), unsigned(memberships), unsigned(rosters),
                 unsigned(rendering), passed ? "pass" : "fail");
}

bool arrival_rosters(X86 &extra, uint32_t scratch, uint32_t runtime, uint32_t home_agent,
                     uint32_t actor_id) {
    const uint32_t guards = departure_list(extra, scratch, home_agent, "Guards");
    const uint32_t waiting = departure_list(extra, scratch, home_agent, "Waiting_Guards");
    const DepartureList before_guards = departure_list_state(guards, actor_id);
    const DepartureList before_waiting = departure_list_state(waiting, actor_id);
    if (!before_guards.valid || !before_waiting.valid || before_guards.matches ||
        before_waiting.matches || before_guards.count >= 1024 || before_waiting.count >= 1024)
        return false;
    extra.r[R_ECX] = rd32(runtime + 0x1c);
    const uint32_t operand = guest_call(&extra, 0x0062a810u, 5u);
    if (!operand)
        return false;
    extra.r[R_ECX] = operand;
    guest_call(&extra, 0x006254c0u, actor_id);
    std::memset(gm_ptr(scratch), 0, 512);
    wr32(scratch + 64, operand);
    wr32(scratch + 32 + 0x18, scratch + 64);
    // Original operation 4 allocates and copies a separate pooled value,
    // inserting its node before the list sentinel. Each roster owns its copy.
    for (const uint32_t list : {guards, waiting}) {
        extra.r[R_ECX] = list;
        guest_call(&extra, 0x00639bb0u, scratch + 32, 4u);
    }
    extra.r[R_ECX] = rd32(runtime + 0x1c);
    guest_call(&extra, 0x0062aa20u, operand);
    const DepartureList after_guards = departure_list_state(guards, actor_id);
    const DepartureList after_waiting = departure_list_state(waiting, actor_id);
    return after_guards.valid && after_waiting.valid && after_guards.matches == 1 &&
           after_waiting.matches == 1 && after_guards.count == before_guards.count + 1 &&
           after_waiting.count == before_waiting.count + 1 &&
           after_guards.other_hash == before_guards.other_hash &&
           after_waiting.other_hash == before_waiting.other_hash;
}

void pair_fixture(X86 *c, bool retain, bool arrival = false) {
    static bool attempted[3]{};
    const char *persist_flag = recomp_env("BROWSER_STREAMING_ARRIVAL_PERSIST_FIXTURE");
    const bool persist_arrival = arrival && persist_flag && !std::strcmp(persist_flag, "1");
    const unsigned mode = arrival ? 2 : unsigned(retain);
    const char *flag = recomp_env(persist_arrival ? "BROWSER_STREAMING_ARRIVAL_PERSIST_FIXTURE"
                                  : arrival       ? "BROWSER_STREAMING_ARRIVAL_FIXTURE"
                                  : retain        ? "BROWSER_STREAMING_LIVE_FIXTURE"
                                                  : "BROWSER_STREAMING_PAIR_FIXTURE");
    if (attempted[mode] || !flag || std::strcmp(flag, "1"))
        return;
    attempted[mode] = true;
    const char *postload_flag = recomp_env("BROWSER_STREAMING_PAIR_POSTLOAD_FIXTURE");
    const bool postload_mode = retain || (postload_flag && !std::strcmp(postload_flag, "1"));
    if (!isolated_fixture() || live_actor.active) {
        std::fprintf(stderr, "[streaming] %s fixture skipped: isolated profile required\n",
                     retain ? "Live" : "Pair");
        return;
    }
#ifdef __EMSCRIPTEN__
    if (arrival && !browser_actor_fixture(true)) {
        std::fprintf(stderr, "[streaming] Arrival fixture skipped: owned destination "
                             "profile required\n");
        return;
    }
#endif
    if (retain)
        std::fprintf(stderr, "[streaming] Live fixture begin\n");
    if (!owned_vehicle.resolved || !gm_valid(owned_vehicle.self, 0x164) ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
        return;
    X86 extra = *c;
    extra.r[R_ESP] -= 512;
    const HeapStats baseline = heap_stats();
    const uint32_t scratch = heap_alloc(512, true);
    if (!scratch)
        return;
    const HeapStats held = heap_stats();
    const uint32_t source_unit = owned_vehicle.self;
    const uint32_t factory = owned_vehicle.factory;
    wr32(scratch + 128, 0x4541u);
    extra.r[R_ECX] = source_unit + 4;
    guest_call(&extra, 0x00426700u, scratch + 132, scratch + 128);
    const uint32_t attribute = rd32(scratch + 132);
    const uint32_t source_id = attribute != rd32(source_unit + 8) && gm_valid(attribute, 0x14)
                                   ? rd32(attribute + 0x10)
                                   : 0;
    const uint32_t runtime = guest_call(&extra, 0x00623b20u);
    if (!source_id || !gm_valid(runtime, 0x38)) {
        heap_free(scratch);
        std::fprintf(stderr, "[streaming] Pair fixture failed: missing runtime\n");
        return;
    }
    auto lookup = [&](uint32_t id) {
        extra.r[R_ECX] = runtime;
        return guest_call(&extra, 0x006236b0u, id);
    };
    const uint32_t source_agent = lookup(source_id);
    const uint32_t manager = rd32(runtime + 4), pool = rd32(runtime + 0x1c);
    const char *names[4] = {"Actor_Pair_Unit_Fixture.bin", "Actor_Pair_Agent_Fixture.bin",
                            "Actor_Pair_Unit_Restored_Fixture.bin",
                            "Actor_Pair_Agent_Restored_Fixture.bin"};
    char paths[4][1024];
    bool available = gm_valid(manager, 0x4c) && gm_valid(source_agent, 0x34) &&
                     rd32(source_agent + 0x10) == source_id &&
                     rd32(source_agent + 0x20) == owned_vehicle.id && !rd8(source_agent + 0x28);
    for (unsigned i = 0; i != 4; ++i)
        available = recomp_writable_path(names[i], paths[i], sizeof paths[i]) && available;
    if (!available) {
        heap_free(scratch);
        std::fprintf(stderr, "[streaming] Pair fixture failed: source or paths\n");
        return;
    }
    auto native = std::make_unique<PrimaryBytes>();
    auto script = std::make_unique<PrimaryBytes>();
    auto actual = std::make_unique<PrimaryBytes>();
    auto container = arrival ? std::make_unique<PrimaryBytes>() : nullptr;
    auto plan = std::make_unique<PairPlan>();
    size_t native_size = 0, script_size = 0, actual_size = 0, ea = 0;
    bool passed =
        !arrival &&
        primary_file(extra, scratch, names[0], factory, source_unit, true, nullptr, true) &&
        primary_bytes(paths[0], *native, native_size, true, true) &&
        agent_file(extra, scratch, names[1], source_agent, true) == 0 &&
        agent_bytes(paths[1], *script, script_size) &&
        pair_agent_plan(*script, script_size, source_id, owned_vehicle.id, *plan) &&
        pair_native_ea(*native, native_size, source_id, ea);
    uint32_t arrival_home = 0;
    uint64_t home_hash = 0;
    const char *container_names[2] = {"Actor_Arrival_Container_Work.bin",
                                      "Actor_Arrival_Container_Restored.bin"};
    char container_paths[2][1024]{};
    size_t container_size = 0;
    if (arrival) {
        constexpr const char *capsule_names[3] = {"Actor_Arrival_Unit_Source.bin",
                                                  "Actor_Arrival_Agent_Source.bin",
                                                  "Actor_Arrival_Container_Source.bin"};
        const char *const capsule_hashes[3] = {
            "15daacc8e2441d6f30692437ecd3c31159130480eb6ec0e501c92b10b0ae7234",
            "da70fd4a613451cc8f243118d270c6b3ac1a40551440f0f80de2165c7e324896",
            persist_arrival ? "606981469b268642a9a0f6950f476ee7f26e3874a85565eaf60e6829247baf5b"
                            : "71e8ae3bf29909bf90794e12827a5d06bcce8b7727757c6daa485289ff78926"
                              "3"};
        PrimaryBytes *buffers[3] = {native.get(), script.get(), container.get()};
        size_t *sizes[3] = {&native_size, &script_size, &container_size};
        passed = source_id == 9 && owned_vehicle.id == 536;
        for (unsigned i = 0; i < 3; ++i) {
            char path[1024]{};
            passed = passed && recomp_writable_path(capsule_names[i], path, sizeof path) &&
                     loader_hash_file(path) == capsule_hashes[i] &&
                     arrival_bytes(path, *buffers[i], *sizes[i]);
        }
        for (unsigned i = 0; i < 2; ++i)
            passed = recomp_writable_path(container_names[i], container_paths[i],
                                          sizeof container_paths[i]) &&
                     passed;
        extra.r[R_ECX] = factory;
        arrival_home = guest_call(&extra, 0x005a10d0u, 531u);
        extra.r[R_ECX] = runtime;
        const uint32_t home_agent = guest_call(&extra, 0x006236b0u, 6u);
        extra.r[R_ECX] = home_agent;
        passed = passed && gm_valid(arrival_home, 0x98) && gm_valid(home_agent, 0x34) &&
                 guest_call(&extra, 0x00626310u) == arrival_home &&
                 rd32(arrival_home + 0x6c) == 829243969u && rd32(arrival_home + 0x70) == 0 &&
                 native_size == 390 && script_size == 1838 &&
                 container_size == (persist_arrival ? 32u : 68u) && pair_word(*native, 36) == 506 &&
                 pair_word(*native, 56) == 502 &&
                 pair_agent_plan(*script, script_size, 9u, 506u, *plan) &&
                 pair_native_ea(*native, native_size, 9u, ea);
        if (passed) {
            pair_put(*native, 36, 0);
            pair_put(*native, 56, 531);
            home_hash = arrival_home_hash(arrival_home, 0);
            passed = home_hash != 0;
            // The pinned trusted CONT record has one logical-parent group (101).
            if (!persist_arrival)
                std::memmove(container->data(), container->data() + 36, 32);
            container_size = 32;
        }
        std::fprintf(stderr,
                     "[streaming] Arrival capsule source-unit=506 source-agent=9 "
                     "source-home=502 source-home-agent=7 destination-home=531 "
                     "destination-home-agent=6 unit-bytes=%zu agent-bytes=%zu "
                     "container-payload=%zu verified=%u home-hash=%016llx\n",
                     native_size, script_size, container_size, unsigned(passed),
                     static_cast<unsigned long long>(home_hash));
    }
    const uint32_t parent = rd32(source_unit + 0x74);
    if (passed && parent) {
        extra.r[R_ECX] = factory;
        passed = guest_call(&extra, 0x005a10d0u, parent) != 0;
    }
    size_t self_sites = 0;
    for (size_t i = 0; passed && i != plan->count; ++i) {
        const uint32_t before = plan->references[i].before;
        self_sites += before == source_id;
        passed = arrival ? (before == 9 || (before == 7 && lookup(6) != 0)) : lookup(before) != 0;
    }
    const PairQueues queues = pair_queues(manager);
    const PairRendering rendering = postload_mode ? pair_rendering(factory) : PairRendering{};
    passed = passed && (!postload_mode || rendering.valid);
    const uint32_t manager_count = rd32(manager + 0x34);
    std::fprintf(stderr,
                 "[streaming] Pair fixture source-unit=%08x source-agent=%08x "
                 "native-bytes=%zu agent-bytes=%zu values=%u sites=%zu "
                 "self-sites=%zu parent=%08x serialized=%u postload-mode=%u\n",
                 owned_vehicle.id, source_id, native_size, script_size, plan->values, plan->count,
                 self_sites, parent, unsigned(passed), unsigned(postload_mode));
    if (arrival && !passed) {
        heap_free(scratch);
        std::fprintf(stderr, "[streaming] Arrival fixture rejected before allocation\n");
        return;
    }
    HeapStats warmed = heap_stats();
    AgentPool warmed_pool{};
    unsigned completed = 0;
    // Warm the original pools, then require 64 complete arrival/removal cycles
    // in this stopped frame before retaining the final actor for live execution.
    for (unsigned trial = 0; passed && trial <= (arrival ? 65u : 64u); ++trial) {
        const uint32_t counter = rd32(runtime + 0x34);
        const uint32_t unit_before = rd32(factory + 0x28);
        const uint32_t expected_unit = unit_before < 0x7fffffffu ? unit_before + 1 : 1;
        const bool occupied_agent = lookup(counter) != 0;
        extra.r[R_ECX] = factory;
        if (counter >= 0x7ffffffeu || occupied_agent ||
            guest_call(&extra, 0x005a10d0u, expected_unit)) {
            passed = false;
            break;
        }
        const uint32_t clone = guest_call(&extra, 0x0064c616u, 0x34u);
        if (!clone || !gm_valid(clone, 0x34)) {
            passed = false;
            break;
        }
        extra.r[R_ECX] = clone;
        guest_call(&extra, 0x00625e70u);
        const uint32_t id = rd32(clone + 0x10);
        bool allocated = id == counter && rd32(runtime + 0x34) == counter + 1;
        if (!allocated || !id || id > 0x7fffffffu) {
            extra.r[R_ECX] = clone;
            guest_call(&extra, 0x00625fa0u);
            guest_call(&extra, 0x00645bc0u, clone);
            passed = false;
            break;
        }
        // Insert only the original ID-tree entry, not active queues/name bindings.
        wr32(scratch + 144, id);
        wr32(scratch + 148, clone);
        extra.r[R_ECX] = manager + 0x28;
        guest_call(&extra, 0x00634460u, scratch + 128, scratch + 144);
        const uint32_t node = rd32(scratch + 128);
        const bool created_entry = rd8(scratch + 132) == 1;
        const bool inserted =
            created_entry && lookup(id) == clone && rd32(manager + 0x34) == manager_count + 1;
        pair_put(*native, ea, id);
        uint32_t unit_result = 0xffffffffu, agent_result = 0xffffffffu;
        uint32_t unit = 0;
        bool equal = false, links = false, separate = false;
        bool finalized = !postload_mode, scheduled = !postload_mode;
        bool unscheduled = !postload_mode, queued = false;
        if (allocated && inserted && pair_write(paths[0], *native, native_size)) {
            unit = primary_file(extra, scratch, names[0], factory, 0, false, &unit_result, true);
            if (unit && gm_valid(unit, 0x164) && !unit_result &&
                rd32(unit + 0x60) == expected_unit) {
                pair_put(*script, plan->identity, id);
                pair_put(*script, plan->native, expected_unit);
                for (size_t i = 0; i != plan->count; ++i)
                    if (plan->references[i].before == source_id)
                        pair_put(*script, plan->references[i].offset, id);
                    else if (arrival && plan->references[i].before == 7)
                        pair_put(*script, plan->references[i].offset, 6);
                if (pair_write(paths[1], *script, script_size))
                    agent_result = agent_file(extra, scratch, names[1], clone, false);
                // Resolve the remapped native backlink through the original lazy
                // getter.
                extra.r[R_ECX] = clone;
                const uint32_t backlink = guest_call(&extra, 0x00626310u);
                wr32(scratch + 128, 0x4541u);
                extra.r[R_ECX] = unit + 4;
                guest_call(&extra, 0x00426700u, scratch + 132, scratch + 128);
                const uint32_t ea_node = rd32(scratch + 132);
                links = !agent_result && backlink == unit && rd32(clone + 0x10) == id &&
                        rd32(clone + 0x20) == expected_unit && lookup(id) == clone &&
                        ea_node != rd32(unit + 8) && gm_valid(ea_node, 0x14) &&
                        rd32(ea_node + 0x10) == id;
                if (links && postload_mode && rd32(unit) == 0x0068098cu &&
                    rd32(rd32(unit) + 0x1b4) == 0x005a2370u) {
                    // Match the native family reader's required original +1b4 call.
                    // This rebuilds description/helper/parent/rendering associations.
                    extra.r[R_ECX] = unit;
                    finalized = (guest_call(&extra, 0x005a2370u) & 0xff) == 1 &&
                                rd32(unit + 0x80) == rd32(source_unit + 0x80);
                    const uint32_t pending = rd32(manager + 0x3c);
                    if (finalized && (pending == manager + 0x10 || pending == manager + 0x1c)) {
                        const uint32_t count_before = rd32(pending + 8);
                        wr32(scratch + 144, clone);
                        extra.r[R_ECX] = pending;
                        guest_call(&extra, 0x00633fd0u, scratch + 128, rd32(pending + 4),
                                   scratch + 144);
                        const uint32_t queue_node = rd32(scratch + 128);
                        queued = true;
                        scheduled = gm_valid(queue_node, 12) && rd32(queue_node + 8) == clone &&
                                    rd32(pending + 8) == count_before + 1;
                    }
                }
                bool container_ok = !arrival;
                if (arrival && links && finalized && scheduled && !rd32(unit + 0x94)) {
                    std::fprintf(stderr,
                                 "[streaming] Arrival stage container-read unit=%08x home=%08x\n",
                                 unit, arrival_home);
                    pair_put(*container, 20, expected_unit);
                    pair_put(*container, 24, 531);
                    container_ok = pair_write(container_paths[0], *container, container_size) &&
                                   !arrival_container_file(extra, scratch, container_names[0],
                                                           factory, unit, false) &&
                                   arrival_contains(unit, 101, arrival_home);
                    std::fprintf(stderr, "[streaming] Arrival stage container-return ok=%u\n",
                                 unsigned(container_ok));
                    if (container_ok) {
                        extra.r[R_ECX] = arrival_home + 0x94;
                        const bool logical =
                            (guest_call(&extra, 0x00598e20u, unit, arrival_home, 100u) & 0xff) != 0;
                        std::fprintf(stderr, "[streaming] Arrival stage logical-return ok=%u\n",
                                     unsigned(logical));
                        extra.r[R_ECX] = arrival_home + 0x94;
                        const bool physical =
                            (guest_call(&extra, 0x00598e20u, unit, arrival_home, 2u) & 0xff) != 0;
                        std::fprintf(stderr, "[streaming] Arrival stage physical-return ok=%u\n",
                                     unsigned(physical));
                        container_ok = logical && physical &&
                                       arrival_contains(arrival_home, 100, unit) &&
                                       arrival_contains(arrival_home, 2, unit) &&
                                       arrival_contains(unit, 101, arrival_home) &&
                                       arrival_home_hash(arrival_home, unit) == home_hash;
                    }
                    container_ok = container_ok &&
                                   !arrival_container_file(extra, scratch, container_names[1],
                                                           factory, unit, true) &&
                                   arrival_bytes(container_paths[1], *actual, actual_size) &&
                                   actual_size == container_size &&
                                   !std::memcmp(container->data(), actual->data(), container_size);
                    std::fprintf(stderr,
                                 "[streaming] Arrival container original-read=%u logical=%u "
                                 "physical=%u own-parent=%u original-bytes=%u\n",
                                 unsigned(rd32(unit + 0x94) != 0),
                                 unsigned(arrival_contains(arrival_home, 100, unit)),
                                 unsigned(arrival_contains(arrival_home, 2, unit)),
                                 unsigned(arrival_contains(unit, 101, arrival_home)),
                                 unsigned(container_ok));
                }
                const uint32_t attributes = rd32(clone), functions = rd32(clone + 8);
                separate = gm_valid(attributes, 16) && attributes != rd32(source_agent) &&
                           rd32(attributes + 4) != rd32(rd32(source_agent) + 4) &&
                           gm_valid(functions, 0x18) && functions != rd32(source_agent + 8) &&
                           rd32(unit + 8) != rd32(source_unit + 8) &&
                           rd32(unit + 0x18) != rd32(source_unit + 0x18) &&
                           rd32(unit + 0x154) != rd32(source_unit + 0x154) &&
                           rd32(unit + 0x158) != rd32(source_unit + 0x158) &&
                           (!rd32(source_unit + 0xe0) ||
                            (rd32(unit + 0xd8) && rd32(unit + 0xd8) != rd32(source_unit + 0xd8)));
                equal =
                    links && separate && finalized && scheduled && container_ok &&
                    primary_file(extra, scratch, names[2], factory, unit, true, nullptr, true) &&
                    primary_bytes(paths[2], *actual, actual_size, false, true) &&
                    actual_size == native_size &&
                    !std::memcmp(native->data(), actual->data(), native_size) &&
                    agent_file(extra, scratch, names[3], clone, true) == 0 &&
                    agent_bytes(paths[3], *actual, actual_size) && actual_size == script_size &&
                    !std::memcmp(script->data(), actual->data(), script_size);
            }
        }
        if (retain && (!arrival || trial == 65) && allocated && inserted && links && finalized &&
            scheduled && separate && equal && (arrival || !rd32(unit + 0x94))) {
            if (arrival)
                std::fprintf(stderr,
                             "[streaming] Arrival preflight completed cycles=%u "
                             "home-preserved=1 heap-balanced=1 pool-stable=1\n",
                             completed);
            live_actor = {};
            live_actor.world = rd32(0x0071c68cu);
            live_actor.factory = factory;
            live_actor.runtime = runtime;
            live_actor.manager = manager;
            live_actor.unit = unit;
            live_actor.unit_id = expected_unit;
            live_actor.agent = clone;
            live_actor.agent_id = id;
            live_actor.tree_node = node;
            live_actor.source_unit = source_unit;
            live_actor.source_id = source_id;
            live_actor.source_agent = source_agent;
            live_actor.arrival = arrival;
            live_actor.persist_arrival = persist_arrival;
            live_actor.arrival_home = arrival_home;
            live_actor.arrival_home_hash = home_hash;
            const uint32_t state = rd32(0x006d7670u);
            live_actor.start = live_actor.frame = rd32(state + 0x28);
            live_actor.x = int32_t(rd32(unit + 0x48));
            live_actor.y = int32_t(rd32(unit + 0x4c));
            live_actor.hooks_before = mods_hooks_installed_count();
            const bool hooks =
                mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00626cf0u, 0, live_agent_trace,
                                     POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr,
                                     &live_actor.agent_hook) == POP_OK &&
                mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00639220u, 0, live_context_trace,
                                     POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr,
                                     &live_actor.context_hook) == POP_OK;
            // Original factory post-load applies +1b8 to every loaded unit after
            // family reading. Apply the same vehicle animation/controller stage.
            extra.r[R_ECX] = unit;
            const bool activated = hooks && rd32(rd32(unit) + 0x1b8) == 0x005a2420u &&
                                   (guest_call(&extra, 0x005a2420u) & 0xff) == 1;
            bool files_removed = true;
            for (const auto &path : paths)
                files_removed = std::remove(path) == 0 && files_removed;
            if (arrival)
                for (const auto &path : container_paths)
                    files_removed = std::remove(path) == 0 && files_removed;
            bool rosters = true;
            if (persist_arrival) {
                extra.r[R_ECX] = runtime;
                const uint32_t home_agent = guest_call(&extra, 0x006236b0u, 6u);
                rosters = activated && files_removed && gm_valid(home_agent, 0x34) &&
                          arrival_rosters(extra, scratch, runtime, home_agent, id);
                std::fprintf(stderr,
                             "[streaming] Arrival persistent rosters unit=%u agent=%u "
                             "home=531 home-agent=6 result=%s\n",
                             expected_unit, id, rosters ? "pass" : "fail");
            }
            if (activated && files_removed && rosters) {
                // Reserve cleanup output before yielding. Erasing the ID-tree node
                // must not depend on an allocation succeeding after destruction starts.
                live_actor.cleanup_scratch = scratch;
                live_actor.active = true;
                for (const uint32_t observed : {source_agent, clone}) {
                    const uint32_t head = rd32(observed + 8);
                    uint32_t visit = rd32(head);
                    for (unsigned i = 0; visit != head && i < 32; ++i) {
                        const uint32_t context = rd32(visit + 0x14);
                        if (!gm_valid(visit, 0x18) || !gm_valid(context, 0x45))
                            break;
                        char name[64]{};
                        live_name(context, name, sizeof name);
                        std::fprintf(stderr,
                                     "[streaming] Live initial owner=%s slot=%u context=%08x "
                                     "function=%s block=%08x flags=%u delay=%u stamp=%u\n",
                                     observed == clone ? "clone"
                                     : arrival         ? "destination-reference"
                                                       : "source",
                                     i, context, name, rd32(context + 8), rd32(context + 0x3c),
                                     rd32(context + 0x34), rd32(context + 0x38));
                        visit = rd32(visit);
                    }
                }
                // Resume a copied paused context only after byte equality. Already
                // active contexts keep their saved schedule. The original resume
                // method's third argument is the original script clock in ms.
                const uint32_t first = rd32(rd32(clone + 8));
                const uint32_t context = rd32(first + 0x14);
                const uint32_t resume_clock = rd32(0x0071c6a8u);
                const uint32_t flags_before = rd32(context + 0x3c);
                const uint32_t stamp_before = rd32(context + 0x38);
                const uint32_t remaining_before = rd32(context + 0x40);
                const bool resumed = !persist_arrival && (flags_before & 0x80) != 0;
                if (resumed) {
                    extra.r[R_ECX] = clone;
                    guest_call(&extra, 0x00626e30u, first + 8, 0, resume_clock);
                }
                std::fprintf(stderr,
                             "[streaming] Live resume clock-ms=%u called=%u flags-before=%u "
                             "flags-after=%u delay=%u stamp-before=%u stamp=%u "
                             "remaining-before=%u remaining=%u\n",
                             resume_clock, unsigned(resumed), flags_before, rd32(context + 0x3c),
                             rd32(context + 0x34), stamp_before, rd32(context + 0x38),
                             remaining_before, rd32(context + 0x40));
                std::fprintf(stderr,
                             "[streaming] Live fixture prepared unit=%08x agent=%08x "
                             "source-unit=%08x source-agent=%08x frame=%u parent=%08x "
                             "links=1 equal=1 finalized=1 animation=1 scheduled=1 "
                             "hooks=1 files-removed=1 cleanup-scratch=512 target-ticks=240\n",
                             expected_unit, id, owned_vehicle.id, source_id, live_actor.start,
                             rd32(unit + 0x74));
                return;
            }
            live_remove_hooks();
            if (persist_arrival && !rosters) {
                heap_free(scratch);
                std::fprintf(stderr, "[streaming] Arrival persistent fixture failed: roster "
                                     "ownership; private world must be discarded\n");
                return;
            }
        }
        // The synchronous fixture does not yield a frame with the clone queued.
        // Original unlink searches both active lists; it does not run a death
        // script.
        if (queued) {
            extra.r[R_ECX] = manager;
            guest_call(&extra, 0x006332c0u, clone);
            unscheduled = pair_queues(manager) == queues;
        }
        // Detach native spatial membership and erase just the ID-tree node before
        // destroying independent storage. Never enqueue a gameplay death callback.
        bool container_released = !arrival;
        if (unit && gm_valid(unit, 0x164)) {
            if (arrival) {
                extra.r[R_ECX] = unit;
                guest_call(&extra, 0x005a2280u);
                extra.r[R_ECX] = arrival_home + 0x94;
                guest_call(&extra, 0x00598ff0u, unit, 100u);
                // Normal unit removal clears its owned container separately from the
                // scalar destructor. The original method removes reciprocal members,
                // frees each group/vector and resets UNIT+94 before unit destruction.
                extra.r[R_ECX] = unit;
                guest_call(&extra, 0x005a22b0u);
                container_released = !rd32(unit + 0x94);
            }
            if (postload_mode) {
                // Original gameplay removal invokes the vehicle +b8 method before
                // spatial removal/destruction. Finalization has added rendering state.
                const uint32_t renderer = rd32(rd32(0x0071c68cu) + 0x1c);
                if (!trial)
                    std::fprintf(stderr,
                                 "[streaming] Pair render-remove renderer=%08x "
                                 "table=%08x method=%08x\n",
                                 renderer, rd32(renderer), rd32(rd32(renderer) + 8));
                extra.r[R_ECX] = unit;
                guest_call(&extra, 0x005b3550u);
                const uint32_t handler = rd32(factory + 0x30);
                if (!trial)
                    std::fprintf(stderr,
                                 "[streaming] Pair native-handler self=%08x table=%08x "
                                 "create=%08x remove=%08x helper-remove=%08x\n",
                                 handler, rd32(handler), rd32(rd32(handler) + 0x18),
                                 rd32(rd32(handler) + 0xc), rd32(rd32(rd32(unit + 0x18)) + 0x30));
                extra.r[R_ECX] = unit;
                guest_call(&extra, 0x005a21a0u);
            }
            extra.r[R_ECX] = unit;
            guest_call(&extra, 0x005ad400u);
            extra.r[R_ECX] = factory;
            guest_call(&extra, 0x005baf20u, unit);
        }
        if (created_entry) {
            extra.r[R_ECX] = manager + 0x28;
            guest_call(&extra, 0x006346a0u, scratch + 128, node);
        }
        extra.r[R_ECX] = clone;
        guest_call(&extra, 0x00625fa0u);
        guest_call(&extra, 0x00645bc0u, clone);
        extra.r[R_ECX] = factory;
        const bool removed = !guest_call(&extra, 0x005a10d0u, expected_unit) && !lookup(id) &&
                             rd32(manager + 0x34) == manager_count;
        bool sources = lookup(source_id) == source_agent;
        extra.r[R_ECX] = factory;
        sources = sources && guest_call(&extra, 0x005a10d0u, owned_vehicle.id) == source_unit;
        for (size_t i = 0; sources && i != plan->count; ++i)
            sources = lookup(plan->references[i].before) != 0;
        const bool queue_stable = pair_queues(manager) == queues;
        const bool render_stable = !postload_mode || pair_rendering(factory) == rendering;
        const HeapStats after = heap_stats();
        AgentPool after_pool{};
        const bool valid_pool = agent_pool(pool, after_pool);
        if (!trial) {
            warmed = after;
            warmed_pool = after_pool;
        }
        const bool balanced = after.used_blocks == warmed.used_blocks &&
                              after.used_bytes == warmed.used_bytes &&
                              after.req_bytes == warmed.req_bytes;
        const bool pool_stable = valid_pool && after_pool == warmed_pool;
        passed = allocated && inserted && !unit_result && !agent_result && links && finalized &&
                 scheduled && unscheduled && separate && equal && removed && sources &&
                 queue_stable && render_stable && balanced && pool_stable && container_released &&
                 (!arrival || arrival_home_hash(arrival_home, 0) == home_hash);
        std::fprintf(stderr,
                     "[streaming] Pair fixture phase=%s trial=%u unit=%08x "
                     "agent=%08x unit-reader=%08x agent-reader=%08x allocated=%u "
                     "inserted=%u links=%u separate=%u equal=%u removed=%u "
                     "sources=%u queues=%u postload=%u scheduled=%u "
                     "unscheduled=%u rendering=%u render-nodes=%u heap-blocks=%u "
                     "heap-bytes=%llu "
                     "heap-balanced=%u pool-stable=%u result=%s\n",
                     trial ? "steady" : "warmup", trial ? trial - 1 : 0, expected_unit, id,
                     unit_result, agent_result, unsigned(allocated), unsigned(inserted),
                     unsigned(links), unsigned(separate), unsigned(equal), unsigned(removed),
                     unsigned(sources), unsigned(queue_stable), unsigned(finalized),
                     unsigned(scheduled), unsigned(unscheduled), unsigned(render_stable),
                     rendering.count, after.used_blocks,
                     static_cast<unsigned long long>(after.used_bytes), unsigned(balanced),
                     unsigned(pool_stable), passed ? "pass" : "fail");
        if (passed && trial)
            ++completed;
        if (retain && !arrival)
            break;
    }
    if (arrival) {
        heap_free(scratch);
        for (const auto &path : paths)
            std::remove(path);
        for (const auto &path : container_paths)
            std::remove(path);
        std::fprintf(stderr,
                     "[streaming] Arrival fixture failed before retention "
                     "home-preserved=%u\n",
                     unsigned(arrival_home_hash(arrival_home, 0) == home_hash));
        return;
    }
    pair_put(*native, ea, source_id);
    pair_put(*script, plan->identity, source_id);
    pair_put(*script, plan->native, owned_vehicle.id);
    for (size_t i = 0; i != plan->count; ++i)
        pair_put(*script, plan->references[i].offset, plan->references[i].before);
    const bool source_unchanged =
        primary_file(extra, scratch, names[2], factory, source_unit, true, nullptr, true) &&
        primary_bytes(paths[2], *actual, actual_size, false, true) && actual_size == native_size &&
        !std::memcmp(native->data(), actual->data(), native_size) &&
        agent_file(extra, scratch, names[3], source_agent, true) == 0 &&
        agent_bytes(paths[3], *actual, actual_size) && actual_size == script_size &&
        !std::memcmp(script->data(), actual->data(), script_size);
    heap_free(scratch);
    bool files_removed = true;
    for (const auto &path : paths)
        files_removed = std::remove(path) == 0 && files_removed;
    const HeapStats final = heap_stats();
    const bool released =
        final.used_blocks + held.used_blocks - baseline.used_blocks == warmed.used_blocks &&
        final.used_bytes + held.used_bytes - baseline.used_bytes == warmed.used_bytes &&
        final.req_bytes + held.req_bytes - baseline.req_bytes == warmed.req_bytes;
    std::fprintf(stderr,
                 "[streaming] Pair fixture completed trials=%u "
                 "source-unchanged=%u files-removed=%u scratch-released=%u "
                 "retained-blocks=%lld retained-bytes=%lld result=%s\n",
                 completed, unsigned(source_unchanged), unsigned(files_removed), unsigned(released),
                 static_cast<long long>(final.used_blocks) - baseline.used_blocks,
                 static_cast<long long>(final.used_bytes) - baseline.used_bytes,
                 passed && completed == 64 && source_unchanged && files_removed && released
                     ? "pass"
                     : "fail");
}

// Natural command observation: fixed storage, four delegating hooks, no actor edits.
struct JointMotionTrace {
    struct Binding {
        uint32_t fn, handle = 0;
    };
    std::array<Binding, 6> hooks{
        {{0x005e53c0}, {0x004ab8a0}, {0x005e1330}, {0x005e2ef0}, {0x00626cf0}, {0x00639220}}};
    uint32_t unit = 0, agent = 0, factory = 0, runtime = 0, world = 0, unit_id = 0, agent_id = 0;
    uint32_t start = 0, last = UINT32_MAX, clock = 0, calls = 0, returns = 0, leaves = 0,
             leaf_returns = 0;
    uint32_t running = 0, path_calls = 0, samples = 0, changed = 0, hooks_before = 0;
    uint32_t extent = 256, hook_count = 4, agent_running = 0, agent_calls = 0, agent_returns = 0,
             context_calls = 0, context_returns = 0, executed = 0;
    int32_t x = 0, y = 0;
    bool active = false, valid = true, physical = true, drawing = true, scheduled = false;
};
JointMotionTrace joint_motion;
bool joint_motion_physical(uint32_t factory, uint32_t unit, uint32_t &cells,
                           uint32_t extent = 256) {
    cells = 0;
    const uint32_t grid = gm_valid(factory, 0x8c) ? rd32(factory + 0x88) : 0;
    if ((extent != 256 && extent != 512) || !gm_valid(grid, 0x50) || rd32(grid + 0x48) != extent ||
        rd32(grid + 0x4c) != extent)
        return false;
    const uint32_t entries = rd32(grid + 0x18), description = rd32(unit + 0x80);
    const uint32_t traits = gm_valid(description, 0x18) ? rd32(description + 0x14) : 0;
    if (!gm_valid(entries, extent * extent * 4) || !gm_valid(traits, 0x40) ||
        !(rd32(traits + 0x3c) & 1))
        return false;
    const int32_t cx = int32_t(rd32(unit + 0x54)), cy = int32_t(rd32(unit + 0x58));
    if (cx < 0 || cy < 0 || cx >= int32_t(extent) || cy >= int32_t(extent))
        return false;
    const uint32_t shape = rd32(traits + 0x2c);
    int32_t left, top, right, bottom;
    uint32_t mask = 0, stride = 0;
    if (shape) {
        if (!gm_valid(shape, 24) || !rd32(shape) || !rd32(shape + 4) || rd32(shape) > 16 ||
            rd32(shape + 4) > 16)
            return false;
        left = int32_t(rd32(shape + 12));
        top = int32_t(rd32(shape + 16));
        right = left + int32_t(rd32(shape));
        bottom = top + int32_t(rd32(shape + 4));
        stride = rd32(shape + 8);
        mask = rd32(shape + 20);
        if (stride < (rd32(shape) + 7) / 8 || stride > 16 ||
            !gm_valid(mask, stride * rd32(shape + 4)))
            return false;
    } else {
        if (!(rd32(traits + 0x3c) & 4))
            return false;
        left = int32_t(rd32(traits + 0x14));
        top = int32_t(rd32(traits + 0x18));
        right = int32_t(rd32(traits + 0x1c));
        bottom = int32_t(rd32(traits + 0x20));
    }
    if (left < -16 || top < -16 || right > 16 || bottom > 16 || left >= right || top >= bottom)
        return false;
    for (int32_t y = top; y < bottom; ++y)
        for (int32_t x = left; x < right; ++x) {
            if (mask && !(rd8(mask + uint32_t(y - top) * stride + uint32_t(x - left) / 8) &
                          (1u << (uint32_t(x - left) % 8))))
                continue;
            if (cx + x < 0 || cy + y < 0 || cx + x >= int32_t(extent) || cy + y >= int32_t(extent))
                continue;
            const uint32_t bucket =
                rd32(entries + (uint32_t(cy + y) * extent + uint32_t(cx + x)) * 4);
            if (!gm_valid(bucket, 32))
                return false;
            uint32_t found = 0;
            for (uint32_t slot = 0; slot < 8 && rd32(bucket + slot * 4); ++slot)
                found += rd32(bucket + slot * 4) == unit;
            if (found != 1)
                return false;
            ++cells;
        }
    return cells != 0;
}
static bool checked_halo_actor_pose(X86 *c,uint32_t id,uint32_t agent_id,uint32_t description,uint32_t player,int32_t *pose,uint32_t *cells) {
    if (!id || !agent_id || id>=0x7fffffffu || agent_id>=0x7fffffffu || !pose || !cells ||
        mods_hook_depth() || !sched_holds_baton() ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) return false;
    const uint32_t world=rd32(0x0071c68c),state=rd32(0x006d7670);
    if(!gm_valid(world,0x14)||!gm_valid(state,0x50)||rd32(state)!=3||rd32(state+4))return false;
    const uint32_t factory=rd32(world+0x10),clock=rd32(0x0071c6a8),hooks=mods_hooks_installed_count();
    if(!gm_valid(factory,0x8c))return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=factory;
    // Existing original native registry lookup. No agent cache or task lookup.
    const uint32_t unit=guest_call(&extra,0x005a10d0u,id);
    if(!gm_valid(unit,0x164)||rd32(unit+0x60)!=id||rd32(unit+0x6c)!=description||
       rd32(unit+0x70)!=player||rd32(unit+0x74)||rd32(unit+0x84)!=factory||(rd32(unit+0x64)&4)||
       !joint_motion_physical(factory,unit,*cells,256)||*cells!=4)return false;
    extra=*c;extra.r[R_ESP]-=32768;const uint32_t runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(runtime,0x38))return false;
    extra.r[R_ECX]=runtime;const uint32_t agent=guest_call(&extra,0x006236b0u,agent_id);
    if(!gm_valid(agent,0x34)||rd32(agent+0x10)!=agent_id||rd32(agent+0x20)!=id||rd8(agent+0x28))return false;
    for(uint32_t axis=0;axis<3;++axis)pose[axis]=int32_t(rd32(unit+0x48+axis*4));
    return rd32(0x0071c68c)==world&&rd32(0x0071c6a8)==clock&&
           mods_hooks_installed_count()==hooks&&rd32(state)==3&&!rd32(state+4);
}
extern "C" bool majesty_browser_streaming_selected_hero_pose(X86 *c,const uint32_t *binding,int32_t *pose,uint32_t *cells) {
    if(!c||!binding||!binding[3]||binding[4]>7)return false;
    return checked_halo_actor_pose(c,binding[1],binding[2],binding[3],binding[4],pose,cells);
}
#ifndef __EMSCRIPTEN__
static bool native_halo_actor_pose(X86 *c,uint32_t id,uint32_t agent_id,int32_t *pose,uint32_t *cells) {
    return checked_halo_actor_pose(c,id,agent_id,0x314c5641u,0,pose,cells);
}
#endif
extern "C" bool majesty_browser_streaming_halo_hero_pose(X86 *c,uint32_t id,int32_t *pose,uint32_t *cells) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag=recomp_env("BROWSER_FRONTIER_HALO_OBSERVE");
    return flag&&!std::strcmp(flag,"v1")&&id==481&&native_halo_actor_pose(c,id,17,pose,cells);
#endif
}
extern "C" bool majesty_browser_streaming_halo_session_actor_pose(X86 *c,uint32_t id,uint32_t agent,int32_t *pose,uint32_t *cells) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTOR"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");
    return flag&&!std::strcmp(flag,"v1")&&path.find("/actor-arrival-fixture-halo-world-session-")!=path.npos&&
        path.ends_with("/native-world-halo/frontier_0_0")&&native_halo_actor_pose(c,id,agent,pose,cells);
#endif
}
void joint_motion_remove() {
    for (auto &hook : joint_motion.hooks)
        if (hook.handle) {
            if (mods_hook_remove(MODS_OWNER_RUNTIME, hook.handle) != POP_OK)
                std::abort();
            hook.handle = 0;
        }
}
void joint_motion_callback(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv,
                           void *context) {
    auto &s = joint_motion;
    const uint32_t fn = static_cast<JointMotionTrace::Binding *>(context)->fn;
    if (fn == 0x00626cf0 || fn == 0x00639220) {
        const bool current =
            s.active && gm_valid(s.agent, 0x34) && rd32(s.agent + 0x10) == s.agent_id;
        const bool agent = fn == 0x00626cf0;
        const bool owned = current && (agent ? cpu->ecx == s.agent
                                             : s.agent_running && rd32(0x00720304) == s.agent);
        if (owned) {
            if (agent) {
                ++s.agent_calls;
                ++s.agent_running;
            } else
                ++s.context_calls;
        }
        const auto result = mods_call_next(api, inv, cpu);
        if (owned) {
            s.valid = s.valid && result == POP_OK;
            if (agent) {
                ++s.agent_returns;
                --s.agent_running;
            } else {
                ++s.context_returns;
                s.executed += (cpu->eax & 255) == 1;
            }
        }
        return;
    }
    const bool common = fn == 0x005e53c0;
    const bool current = s.active && gm_valid(s.unit, 0x88) && rd32(s.unit + 0x60) == s.unit_id;
    const bool owned =
        current &&
        (common ? (gm_valid(cpu->ecx, 8) && rd32(cpu->ecx + 4) == s.unit)
                : (s.running && gm_valid(cpu->esp + 4, 4) && rd32(cpu->esp + 4) == s.unit));
    if (owned) {
        if (common) {
            ++s.calls;
            ++s.running;
        } else {
            ++s.leaves;
            s.path_calls += fn == 0x005e1330;
        }
    }
    const auto result = mods_call_next(api, inv, cpu);
    if (owned) {
        s.valid = s.valid && result == POP_OK;
        if (common) {
            ++s.returns;
            --s.running;
        } else
            ++s.leaf_returns;
    }
}
void joint_motion_begin(uint32_t unit, uint32_t agent, uint32_t factory, uint32_t runtime,
                        bool returned = false) {
    const char *flag = recomp_env("BROWSER_STREAMING_JOINT_MOTION_FIXTURE");
    if (!flag || std::strcmp(flag, "1"))
        return;
    auto &s = joint_motion;
    const char *schedule = recomp_env("BROWSER_STREAMING_JOINT_SCHEDULE_FIXTURE");
    const char *restored = recomp_env("BROWSER_STREAMING_JOINT_SCHEDULE_RELOAD_FIXTURE");
    // Use the original loaded collision grid on either side of a journey.
    // A fresh returned-world reload has no activation flag to identify it.
    const uint32_t grid = gm_valid(factory, 0x8c) ? rd32(factory + 0x88) : 0;
    if (!gm_valid(grid, 0x50) || rd32(grid + 0x48) != rd32(grid + 0x4c) ||
        (rd32(grid + 0x48) != 256 && rd32(grid + 0x48) != 512))
        std::abort();
    s.extent = rd32(grid + 0x48);
    s.scheduled = returned ||
        (schedule && !std::strcmp(schedule, "1")) || (restored && !std::strcmp(restored, "1"));
    s.hook_count = s.scheduled ? 6 : 4;
    s.unit = unit;
    s.agent = agent;
    s.factory = factory;
    s.runtime = runtime;
    s.world = rd32(0x0071c68c);
    s.unit_id = rd32(unit + 0x60);
    s.agent_id = rd32(agent + 0x10);
    s.start = rd32(rd32(0x006d7670) + 0x28);
    s.clock = rd32(0x0071c6a8);
    s.x = int32_t(rd32(unit + 0x48));
    s.y = int32_t(rd32(unit + 0x4c));
    s.hooks_before = mods_hooks_installed_count();
    for (uint32_t i = 0; i < s.hook_count; ++i)
        if (!mods_symbol_hookable(s.hooks[i].fn))
            std::abort();
    for (uint32_t i = 0; i < s.hook_count; ++i) {
        auto &hook = s.hooks[i];
        if (mods_hook_install_ex(MODS_OWNER_RUNTIME, hook.fn, 0, joint_motion_callback,
                                 POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, &hook,
                                 &hook.handle) != POP_OK) {
            joint_motion_remove();
            std::abort();
        }
    }
    s.active = true;
    std::fprintf(stderr,
                 "[streaming] Joint motion begin unit=%u agent=%u frame=%u clock=%u fixed=%d,%d "
                 "hooks=%u bounded=1\n",
                 s.unit_id, s.agent_id, s.start, s.clock, s.x, s.y, s.hook_count);
}

struct DepartureQueues {
    struct Queue {
        uint32_t kept = 0;
        uint64_t hash = 14695981039346656037ull;
        bool operator==(const Queue &) const = default;
    };
    std::array<Queue, 2> queues{};
    uint32_t omitted = 0;
    bool operator==(const DepartureQueues &) const = default;
};
bool departure_queues(uint32_t manager, uint32_t omit, DepartureQueues &out) {
    out = {};
    for (uint32_t index = 0; index < 2; ++index) {
        const uint32_t offset = index ? 0x1c : 0x10;
        // Original 00633fc0 starts at *head; 006332c0 compares to head itself.
        const uint32_t head = rd32(manager + offset + 4), count = rd32(manager + offset + 8);
        if (count > 4096 || !gm_valid(head, 12))
            return false;
        uint32_t node = rd32(head), stop = head, visited = 0;
        auto &queue = out.queues[index];
        while (node != stop) {
            if (++visited > count || !gm_valid(node, 12))
                return false;
            const uint32_t owner = rd32(node + 8);
            if (!gm_valid(owner, 0x34))
                return false;
            if (omit && owner == omit) {
                if (++out.omitted > 1)
                    return false;
            } else {
                ++queue.kept;
                for (uint32_t value : {node, owner, rd32(owner + 0x10)})
                    queue.hash = (queue.hash ^ value) * 1099511628211ull;
            }
            node = rd32(node);
        }
        if (visited != count)
            return false;
    }
    return true;
}

bool joint_schedule(X86 &extra, uint32_t unit, uint32_t agent, uint32_t runtime) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    if (!sched_holds_baton() || mods_hook_depth() || !gm_valid(unit, 0x164) ||
        !gm_valid(agent, 0x34) || !gm_valid(runtime, 0x38) || rd32(agent + 0x24) != unit ||
        rd8(agent + 0x28))
        return false;
    const uint32_t manager = rd32(runtime + 4);
    if (!gm_valid(manager, 0x4c) || rd32(manager + 0x48))
        return false;
    const uint32_t pending = rd32(manager + 0x3c);
    if (pending != manager + 0x10 && pending != manager + 0x1c)
        return false;
    DepartureQueues before{}, after{};
    if (!departure_queues(manager, agent, before) || before.omitted ||
        !majesty_browser_frontier_joint_schedule_checkpoint(&extra, false))
        return false;
    std::array<uint8_t, 0x164> unit_before{};
    std::array<uint8_t, 0x34> agent_before{};
    std::memcpy(unit_before.data(), gm_ptr(unit), unit_before.size());
    std::memcpy(agent_before.data(), gm_ptr(agent), agent_before.size());
    const uint32_t count = rd32(pending + 8), output = heap_alloc(16, true);
    if (!output)
        return false;
    wr32(output + 8, agent);
    const uint32_t args[] = {output, rd32(pending + 4), output + 8};
    extra.r[R_ECX] = pending;
    const auto inserted = guest_call_guarded(&extra, 0x00633fd0, args, 3);
    const uint32_t node = rd32(output);
    bool ok = inserted.status == GuestCallGuardedStatus::Returned && gm_valid(node, 12) &&
              rd32(node + 8) == agent && rd32(pending + 8) == count + 1 &&
              departure_queues(manager, agent, after) && after.omitted == 1 &&
              !std::memcmp(unit_before.data(), gm_ptr(unit), unit_before.size()) &&
              !std::memcmp(agent_before.data(), gm_ptr(agent), agent_before.size());
    after.omitted = 0;
    ok = heap_free(output) && ok && after == before;
    const bool saved = ok && majesty_browser_frontier_joint_schedule_checkpoint(&extra, true);
    std::fprintf(stderr,
                 "[streaming] Joint schedule unit=%u agent=%u queue=%u before=%u after=%u "
                 "queued=1 others-preserved=%u actor-same=%u script-same=%u scratch-released=1 "
                 "before-saved=1 after-saved=%u result=%s\n",
                 rd32(unit + 0x60), rd32(agent + 0x10), pending == manager + 0x10 ? 0 : 1, count,
                 rd32(pending + 8), unsigned(after == before),
                 unsigned(!std::memcmp(unit_before.data(), gm_ptr(unit), unit_before.size())),
                 unsigned(!std::memcmp(agent_before.data(), gm_ptr(agent), agent_before.size())),
                 unsigned(saved), saved ? "pass" : "fail");
    return saved;
#endif
}

bool joint_departure(X86 &extra, uint32_t unit, uint32_t agent, uint32_t factory, uint32_t runtime,
                     uint32_t unit_id, uint32_t agent_id, uint32_t extent = 256) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    if (joint_motion.active || !sched_holds_baton() || mods_hook_depth() ||
        !gm_valid(unit, 0x164) || rd32(unit) != 0x0068098c || rd32(unit + 0x60) != unit_id ||
        rd32(unit + 0x84) != factory || rd32(unit + 0x74) || !gm_valid(agent, 0x34) ||
        rd32(agent + 0x10) != agent_id || rd32(agent + 0x20) != unit_id ||
        rd32(agent + 0x24) != unit || rd8(agent + 0x28) || !gm_valid(runtime, 0x38))
        return false;
    const uint32_t manager = rd32(runtime + 4), grid = rd32(factory + 0x88);
    if (!gm_valid(manager, 0x4c) || rd32(manager + 0x48) || !gm_valid(grid, 0x50) ||
        (extent != 256 && extent != 512) || rd32(grid + 0x48) != extent ||
        rd32(grid + 0x4c) != extent || !gm_valid(rd32(grid + 0x18), extent * extent * 4))
        return false;
    uint32_t footprint = 0;
    NativeRegistrySnapshot expected{};
    LiveDrawing drawing = live_drawing(factory, unit);
    if (!joint_motion_physical(factory, unit, footprint, extent) || !drawing.valid ||
        drawing.excluded != 1 || !native_registry_snapshot(factory, expected, unit))
        return false;
    drawing.excluded = 0;
    DepartureQueues expected_queues{}, actual_queues{};
    if (!departure_queues(manager, agent, expected_queues))
        return false;
    const uint32_t actor_queued = expected_queues.omitted;
    expected_queues.omitted = 0;
    const uint32_t entries = rd32(manager + 0x34),
                   queued = rd32(manager + 0x18) + rd32(manager + 0x24),
                   counter = rd32(factory + 0x28), script_counter = rd32(runtime + 0x34),
                   hooks = mods_hooks_installed_count();
    if (!entries || !queued || !majesty_browser_frontier_joint_departure_checkpoint(&extra, false))
        return false;
    const auto before = heap_stats();
    uint32_t pool_before = 0, pool_after = 0;
    if (!stage_pool_live(pool_before))
        return false;
    extra.r[R_ECX] = unit;
    const auto removed = guest_call_guarded(&extra, 0x005a21b0, nullptr, 0);
    const bool deferred =
        removed.status == GuestCallGuardedStatus::Returned && rd32(manager + 0x48) == 1;
    if (!deferred)
        std::abort(); // never guess whether the owned removal finished
    extra.r[R_ECX] = manager;
    const auto drained = guest_call_guarded(&extra, 0x00633370, nullptr, 0);
    extra.r[R_ECX] = factory;
    const bool unit_absent = guest_call(&extra, 0x005a10d0, unit_id) == 0;
    extra.r[R_ECX] = runtime;
    const bool agent_absent = guest_call(&extra, 0x006236b0, agent_id) == 0;
    NativeRegistrySnapshot after{};
    const bool groups = native_registry_snapshot(factory, after) && expected == after;
    const bool rendering = live_drawing(factory, unit) == drawing;
    const bool queues = drained.status == GuestCallGuardedStatus::Returned &&
                        rd32(manager + 0x34) + 1 == entries &&
                        rd32(manager + 0x18) + rd32(manager + 0x24) + actor_queued == queued &&
                        !rd32(manager + 0x48) && departure_queues(manager, 0, actual_queues) &&
                        actual_queues == expected_queues;
    const bool counters = rd32(factory + 0x28) == counter && rd32(runtime + 0x34) == script_counter;
    uint32_t physical_matches = 0;
    const uint32_t buckets = rd32(grid + 0x18);
    bool physical = true;
    for (uint32_t cell = 0; cell < extent * extent && physical; ++cell) {
        const uint32_t bucket = rd32(buckets + cell * 4);
        if (!bucket)
            continue;
        if (!gm_valid(bucket, 32)) {
            physical = false;
            break;
        }
        for (uint32_t slot = 0; slot < 8 && rd32(bucket + slot * 4); ++slot)
            physical_matches += rd32(bucket + slot * 4) == unit;
    }
    physical = physical && !physical_matches;
    const auto released = heap_stats();
    const bool pool_valid = stage_pool_live(pool_after);
    const bool reclaimed = pool_valid && pool_after < pool_before &&
                           released.used_bytes <= before.used_bytes &&
                           released.used_blocks <= before.used_blocks;
    const bool hooks_same = hooks == mods_hooks_installed_count();
    const bool valid = unit_absent && agent_absent && groups && rendering && queues && counters &&
                       physical && reclaimed && hooks_same;
    std::fprintf(stderr,
                 "[streaming] Joint departure resources entries=%u,%u queued=%u,%u "
                 "deferred=%u heap-bytes=%llu,%llu heap-blocks=%u,%u crt-live=%u,%u crt-valid=%u "
                 "actor-queued=%u\n",
                 entries, rd32(manager + 0x34), queued, rd32(manager + 0x18) + rd32(manager + 0x24),
                 rd32(manager + 0x48), static_cast<unsigned long long>(before.used_bytes),
                 static_cast<unsigned long long>(released.used_bytes), before.used_blocks,
                 released.used_blocks, pool_before, pool_after, unsigned(pool_valid), actor_queued);
    // A diagnostic snapshot remains private when resource qualification fails.
    const bool saved = unit_absent && agent_absent && groups && rendering && counters && physical &&
                       hooks_same && !rd32(manager + 0x48) &&
                       majesty_browser_frontier_joint_departure_checkpoint(&extra, true);
    std::fprintf(stderr,
                 "[streaming] Joint departure unit=%u agent=%u deferred=1 unit-absent=%u "
                 "agent-absent=%u groups=%u rendering=%u queues=%u counters=%u physical=%u "
                 "reclaimed=%u hooks-same=%u before-saved=1 after-saved=%u result=%s\n",
                 unit_id, agent_id, unsigned(unit_absent), unsigned(agent_absent), unsigned(groups),
                 unsigned(rendering), unsigned(queues), unsigned(counters), unsigned(physical),
                 unsigned(reclaimed), unsigned(hooks_same), unsigned(saved),
                 saved && valid ? "pass" : "fail");
    return saved && valid;
#endif
}

// Restore the evolved fixture's actual three commands while still unpublished.
// Original command storage stays journal-owned until route/clock validation.
bool private_return_orders(X86 &extra, uint32_t unit, uint32_t factory,
                           const uint8_t *source_unit, uint8_t *payload, uint32_t bytes,
                           std::array<uint32_t, 32> &addresses, uint32_t &address_count, uint32_t grid_extent, uint32_t max_points) {
    using namespace majesty::orders;
    if ((grid_extent != 256 && grid_extent != 512) || (max_points != 64 && max_points != 128)) return false;
    if (!source_unit || !payload || bytes < 24 || bytes > 2048 || rd32(unit + 0x60) ||
        rd32(unit + 0x84) || !sched_holds_baton() || mods_hook_depth()) return false;
    auto word = [&](uint32_t at) { uint32_t v = 0; if (at + 4 > bytes) std::abort(); std::memcpy(&v, payload + at, 4); return v; };
    PayloadPlan command_plan;
    if (!plan_order_payload(payload, bytes, command_plan) || command_plan.entry_count != 3 ||
        command_plan.request_count != 18 || command_plan.bank_counts != std::array<uint32_t, 3>{2, 1, 0}) return false;
    uint32_t body[3]{};
    constexpr uint32_t expected_kinds[] = {2, 4, 6};
    for (uint32_t entry = 0; entry < 3; ++entry) {
        const auto &e = command_plan.entries[entry];
        if (e.kind != expected_kinds[entry] || (e.kind == 4 && (!e.capacity || e.capacity > 128))) return false;
        body[entry] = e.body_offset;
    }
    const auto &requests = command_plan.requests;
    const auto &counts = command_plan.bank_counts;
    const uint32_t request_count = command_plan.request_count;
    const uint32_t original_path_count = word(body[1] + 136), original_cursor = word(body[1] + 120),
                   capacity = word(body[1] + 128), path_at = body[1] + 140;
    Journal journal;
    if (!journal.reserve(requests.data(), request_count, heap_port())) return false;
    uint32_t buffer = heap_alloc(100, true), io = heap_alloc(92, true), wrapper = heap_alloc(16, true), data = heap_alloc(2080, false);
    if (!buffer || !io || !wrapper || !data) std::abort();
    std::memset(gm_ptr(data), 0xa5, 2080); std::memcpy(gm_ptr(data + 16), payload, bytes);
    auto invoke = [&](uint32_t fn, uint32_t receiver, const uint32_t *args, int n) {
        extra.r[R_ECX] = receiver; return guest_call_guarded(&extra, fn, args, n);
    };
    const uint32_t b[] = {data + 16, bytes, 0}, i[] = {buffer, 1};
    if (invoke(0x0064a97f, buffer, b, 3).status != GuestCallGuardedStatus::Returned ||
        invoke(0x0064b68a, io, i, 2).status != GuestCallGuardedStatus::Returned) std::abort();
    wr32(wrapper, io);
    constexpr EntryPoints sites{0x004abcc0, 0x005e4d20,
        {0x005e4c71, 0x005da543, 0x004a90b4, 0x005da5e5, 0x005da61b, 0x005da651, 0x005da687, 0x005da6f3,
         0x005da729, 0x005e0e39, 0x005e2b61, 0x005e4dc9}, 0x00523485};
    AllocationBridge bridge(journal, sites); ReaderHooks hooks(bridge);
    bool ok = hooks.install();
    if (ok) {
        const auto loaded = hooks.read_unit(&extra, unit, wrapper, {0x005b1b90, 0x0043010f, 0x0068098c, 0x88});
        ok = loaded.complete && loaded.guest.status == GuestCallGuardedStatus::Returned && !loaded.guest.eax && journal.fully_claimed();
        std::fprintf(stderr, "[streaming] Return commands read complete=%u claimed=%u requests=%u bytes=%u failure=%u\n",
            unsigned(ok), unsigned(journal.fully_claimed()), request_count, bytes, unsigned(bridge.failure()));
    }
    if (!hooks.remove()) std::abort();
    const uint32_t no_delete = 0;
    if (invoke(0x0064b65f, io + 12, &no_delete, 1).status != GuestCallGuardedStatus::Returned ||
        invoke(0x0064aa1e, buffer, nullptr, 0).status != GuestCallGuardedStatus::Returned || !ok) std::abort();
    for (uint32_t bank = 0; bank < 3; ++bank) {
        const auto *bank_block = journal.find(Role::Bank, bank), *head = journal.find(Role::Head, bank);
        if (rd32(unit + 0x88 + bank * 4) != bank_block->address || rd32(bank_block->address + 4) != unit || rd32(bank_block->address + 16) != counts[bank]) std::abort();
        uint32_t node = rd32(head->address), previous = head->address;
        for (uint32_t index = 0; index < counts[bank]; ++index) {
            const auto *n = journal.find(Role::Node, bank, index), *o = journal.find(Role::Order, bank, index);
            if (node != n->address || rd32(node + 4) != previous || rd32(node + 8) != o->address) std::abort();
            previous = node; node = rd32(node);
        }
        if (node != head->address || rd32(head->address + 4) != previous) std::abort();
    }
    const auto *move = journal.find(Role::Order, 0, 0), *path_order = journal.find(Role::Order, 0, 1), *path = journal.find(Role::Path, 0, 1);
    if (rd32(move->address) != 0x006830d8 || rd32(move->address + 0x38) ||
        rd32(path_order->address) != 0x0068add8 || rd32(path_order->address + 0x44) != path->address ||
        rd32(path_order->address + 0x48) != original_cursor || rd32(path_order->address + 0x4c) != original_path_count ||
        rd32(path_order->address + 0x5c) != capacity || path->request.bytes != capacity * 8) std::abort();
    uint32_t source_position[2]{}; std::memcpy(source_position, source_unit + 60, 8);
    uint32_t goal[3]{};
    for (uint32_t axis = 0; axis < 2; ++axis) {
        const int64_t projected = int64_t(int32_t(rd32(move->address + 0x3c + axis * 4))) +
            int64_t(int32_t(rd32(unit + 0x48 + axis * 4))) - int32_t(source_position[axis]);
        if (projected < 0 || projected >= int64_t(grid_extent) * 32768) std::abort(); goal[axis] = uint32_t(projected);
    }
    const uint32_t terrain = rd32(factory + 0x80), sample = heap_alloc(4, false), sample_args[] = {sample, goal[0], goal[1]};
    if (!sample || !gm_valid(terrain, 0x50) || rd32(terrain + 0x30) != grid_extent / 2 || rd32(terrain + 0x34) != grid_extent / 2) std::abort();
    extra.r[R_ECX] = terrain;
    if (journal.invoke(&extra, 0x005af220, sample_args, 3).status != GuestCallGuardedStatus::Returned) std::abort();
    goal[2] = rd32(sample); if (!heap_free(sample)) std::abort();
    extra.r[R_ECX] = move->address;
    if (journal.invoke(&extra, 0x005b7990, goal, 3).status != GuestCallGuardedStatus::Returned) std::abort();
    std::memcpy(payload + body[0] + 104, goal, 12);
    // The owned original reader already receives the rebound Path goal. Drop
    // every source waypoint, reset its cursor, then request a real receiving route.
    wr32(path_order->address + 0x48, 0); wr32(path_order->address + 0x4c, 0);
    std::memset(gm_ptr(path->address), 0, path->request.bytes);
    if (goal[0] != rd32(unit + 0x54) * 32768 || goal[1] != rd32(unit + 0x58) * 32768) std::abort();
    const std::array<uint32_t, 4> endpoints{rd32(unit + 0x54), rd32(unit + 0x58),
        rd32(path_order->address + 0x3c) / 16, rd32(path_order->address + 0x40) / 16};
    ClassFootprint footprint;
    if (!class_footprint(extra, unit, footprint)) std::abort();
    std::array<uint32_t, 256> route{}; uint32_t route_count = 0;
    if (!probe_cross_route(extra, unit, factory, 0, false, &endpoints, &route, &route_count, grid_extent, max_points) || route_count > capacity) std::abort();
    std::memcpy(gm_ptr(path->address), route.data(), route_count * 8); wr32(path_order->address + 0x4c, route_count);
    const uint32_t tail_at = path_at + original_path_count * 8, tail_bytes = bytes - tail_at,
                   serialized_bytes = bytes - original_path_count * 8 + route_count * 8;
    if (serialized_bytes > 2048) std::abort();
    std::memmove(payload + path_at + route_count * 8, payload + tail_at, tail_bytes);
    std::memcpy(payload + path_at, route.data(), route_count * 8);
    const uint32_t zero = 0; std::memcpy(payload + body[1] + 120, &zero, 4); std::memcpy(payload + body[1] + 136, &route_count, 4);
    ok = live_banks_equal(extra, unit, payload, serialized_bytes, "Return_Orders_Observed.bin");
    address_count = request_count;
    for (uint32_t at = 0; at < request_count; ++at) addresses[at] = journal.find(requests[at].role, requests[at].bank, requests[at].index)->address;
    const uint32_t reserved_bytes = journal.owned_request_bytes();
    if (!ok || !bridge.handoff_unit_orders(unit) || journal.state() != State::Transferred || !journal.release()) std::abort();
    if (!heap_free(data) || !heap_free(wrapper) || !heap_free(io) || !heap_free(buffer)) std::abort();
    std::fprintf(stderr, "[streaming] Return commands restored requests=%u reserved-bytes=%u source-bytes=%u output-bytes=%u "
        "old-count=%u old-cursor=%u count=%u cursor=0 capacity=%u grid=%u move-goal=%u,%u,%u writer-equal=1 transferred=1 result=pass\n",
        request_count, reserved_bytes, bytes, serialized_bytes, original_path_count, original_cursor, route_count, capacity, grid_extent, goal[0], goal[1], goal[2]);
    return true;
}

// Native-only return consumer's first boundary: restore current UNIT/GPL state,
// reserve original IDs, roundtrip, then explicitly retire this private object.
// Commands, collision admission, activation and paired publication are pending.
bool private_return_fixture(X86 &extra, uint32_t factory, uint32_t runtime) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    if (!isolated_fixture() || !sched_holds_baton() || mods_hook_depth() ||
        !gm_valid(factory, 0x88) || !gm_valid(runtime, 0x38))
        return false;
    char path[1024];
    std::array<uint8_t, 8192> packet{};
    FILE *file = recomp_writable_path("Native_Return_Packet.bin", path, sizeof path)
                     ? std::fopen(path, "rb") : nullptr;
    const size_t bytes = file ? std::fread(packet.data(), 1, packet.size(), file) : 0;
    bool ok = file && std::fgetc(file) == EOF && !std::ferror(file);
    if (file) ok = std::fclose(file) == 0 && ok;
    uint32_t header[11]{};
    if (!ok || bytes < sizeof header) return false;
    std::memcpy(header, packet.data(), sizeof header);
    const uint32_t unit_bytes = header[7], script_bytes = header[8], orders_bytes = header[9], edits = header[10];
    const char *commands_flag = recomp_env("BROWSER_STREAMING_PRIVATE_RETURN_COMMANDS");
    const bool restore_commands = commands_flag && !std::strcmp(commands_flag, "1");
    const bool repeat = header[1] == 2;
    const char *repeat_flag = recomp_env("BROWSER_STREAMING_REPEAT_RETURN_FIXTURE");
    const bool repeat_requested = repeat_flag && !std::strcmp(repeat_flag, "1");
    const size_t header_bytes = sizeof header + (repeat ? 12 : 0);
    uint32_t receiving[3] = {2073, 12, 512};
    if (repeat && bytes >= header_bytes) std::memcpy(receiving, packet.data() + sizeof header, 12);
    const uint32_t grid_extent = receiving[2];
    if (header[0] != 0x3154524e || (header[1] != 1 && !repeat) || repeat != repeat_requested ||
        (!repeat && (header[2] != 510 || header[3] != 79 || header[4] != 2101 || header[5] != 37)) ||
        !header[2] || !header[3] || !header[4] || !header[5] || !receiving[0] || !receiving[1] ||
        header[2] >= 0x7ffffffe || header[3] >= 0x7ffffffe || header[4] >= 0x7ffffffe || header[5] >= 0x7ffffffe ||
        receiving[0] >= 0x7ffffffe || receiving[1] >= 0x7ffffffe ||
        (grid_extent != 256 && grid_extent != 512) || unit_bytes != 375 || script_bytes < 56 || script_bytes > 4096 ||
        orders_bytes < 24 || orders_bytes > 2048 || edits > 64 ||
        header_bytes + size_t(unit_bytes) + script_bytes + orders_bytes + size_t(edits) * 24 != bytes)
        return false;
    const uint32_t receiving_grid = rd32(factory + 0x88), receiving_terrain = rd32(factory + 0x80);
    if (!gm_valid(receiving_grid, 0x50) || rd32(receiving_grid + 0x48) != grid_extent ||
        rd32(receiving_grid + 0x4c) != grid_extent || !gm_valid(receiving_terrain, 0x50) ||
        rd32(receiving_terrain + 0x30) != grid_extent / 2 || rd32(receiving_terrain + 0x34) != grid_extent / 2) return false;
    auto native = std::make_unique<PrimaryBytes>();
    auto script = std::make_unique<PrimaryBytes>();
    auto observed = std::make_unique<PrimaryBytes>();
    std::memcpy(native->data(), packet.data() + header_bytes, unit_bytes);
    std::memcpy(script->data(), packet.data() + header_bytes + unit_bytes, script_bytes);
    std::array<uint8_t, 2048> commands{};
    if (restore_commands) {
        if (orders_bytes > commands.size()) return false;
        std::memcpy(commands.data(), packet.data() + header_bytes + unit_bytes + script_bytes, orders_bytes);
    }
    size_t ea = 0;
    PairPlan before_plan;
    if (pair_word(*native, 36) != header[2] || pair_word(*native, 56) ||
        !pair_native_ea(*native, unit_bytes, header[3], ea) ||
        !pair_agent_plan(*script, script_bytes, header[3], header[2], before_plan))
        return false;
    const uint32_t manager = rd32(runtime + 4), reserved = rd32(runtime + 0x34),
                   counter = rd32(factory + 0x28), clock = rd32(0x0071c6a8),
                   hooks = mods_hooks_installed_count();
    if (!gm_valid(manager, 0x4c) || !reserved || reserved <= header[5] || reserved >= 0x7ffffffe ||
        counter < header[4] || counter >= 0x7ffffffe || rd32(manager + 0x48)) return false;
    auto lookup = [&](uint32_t id) { extra.r[R_ECX] = runtime; return guest_call(&extra, 0x006236b0, id); };
    extra.r[R_ECX] = factory;
    const uint32_t leader_unit = guest_call(&extra, 0x005a10d0, receiving[0]), leader = lookup(receiving[1]);
    if (!gm_valid(leader, 0x34) || !gm_valid(leader_unit, 0x164) || lookup(reserved)) return false;
    extra.r[R_ECX] = leader;
    if (guest_call(&extra, 0x00626310) != leader_unit) return false;
    const auto queues = pair_queues(manager);
    const uint32_t entries = rd32(manager + 0x34);
    std::array<uint8_t, 0x34> leader_before{};
    std::memcpy(leader_before.data(), gm_ptr(leader), leader_before.size());
    NativeRegistrySnapshot registry_before;
    if (!native_registry_snapshot(factory, registry_before)) return false;
    uint32_t rows[64][6]{};
    size_t cursor = header_bytes + unit_bytes + script_bytes + orders_bytes;
    unsigned applied = 0;
    for (uint32_t i = 0; i < edits; ++i) {
        std::memcpy(rows[i], packet.data() + cursor, 24); cursor += 24;
        const auto *e = rows[i];
        const uint32_t limit = e[0] == 0 ? unit_bytes : e[0] == 1 ? script_bytes : orders_bytes;
        if (e[0] > 2 || e[1] > limit || limit - e[1] < 4 || e[3] > 3 || e[5] > 1) return false;
        for (uint32_t j = 0; j < i; ++j) if (rows[j][0] == e[0] && rows[j][1] == e[1]) return false;
        uint32_t before = 0;
        const uint8_t *data = e[0] == 0 ? native->data() : e[0] == 1 ? script->data() :
            packet.data() + header_bytes + unit_bytes + script_bytes;
        std::memcpy(&before, data + e[1], 4);
        if (before != e[2]) return false;
        if (e[0] == 2) {
            if (restore_commands) {
                if (e[3] != 0 && e[3] != 3) return false;
                const uint32_t after = e[3] == 3 ? clock - e[4] : e[4];
                if (e[5] && !after) return false;
                std::memcpy(commands.data() + e[1], &after, 4);
            }
            continue;
        }
        const uint32_t after = e[3] == 1 ? 0u : e[3] == 2 ? reserved : e[3] == 3 ? clock - e[4] : e[4];
        if (e[5] && !after) return false;
        pair_put(e[0] == 0 ? *native : *script, e[1], after); ++applied;
    }
    PairPlan restored_plan;
    if (!pair_agent_plan(*script, script_bytes, reserved, 0, restored_plan) || restored_plan.count != 4 ||
        pair_word(*native, 36) || pair_word(*native, ea) != reserved) return false;
    unsigned self = 0, external = 0;
    for (size_t i = 0; i < restored_plan.count; ++i) {
        self += restored_plan.references[i].before == reserved;
        external += restored_plan.references[i].before == receiving[1];
    }
    if (self != 2 || external != 2) return false;
    const uint32_t scratch = heap_alloc(512, true);
    if (!scratch) return false;
    for (const auto &record : {std::pair{"Return_Unit_Input.bin", native.get()}, std::pair{"Return_GPL_Input.bin", script.get()}}) {
        if (!recomp_writable_path(record.first, path, sizeof path) ||
            !pair_write(path, *record.second, record.first == std::string_view("Return_Unit_Input.bin") ? unit_bytes : script_bytes))
            std::abort();
    }
    const uint32_t clone = guest_call(&extra, 0x0064c616, 0x34u);
    if (!gm_valid(clone, 0x34)) std::abort();
    extra.r[R_ECX] = clone; guest_call(&extra, 0x00625e70);
    if (rd32(clone + 0x10) != reserved || rd32(runtime + 0x34) != reserved + 1) std::abort();
    majesty::actors::UnitStage stage;
    const majesty::actors::StageInput input{pair_word(*native, 40), 0, pair_word(*native, 48), pair_word(*native, 52)};
    uint32_t status = 0xffffffff;
    const bool installed = stage.install();
    const uint32_t unit = installed ? primary_file(extra, scratch, "Return_Unit_Input.bin", factory, 0, false, &status, true, &stage, &input) : 0;
    if (!stage.remove()) std::abort();
    std::fprintf(stderr, "[streaming] Private return stage unit=%08x status=%08x script=%u clock=%u applied=%u\n", unit, status, reserved, clock, applied);
    if (!installed || status || !gm_valid(unit, 0x164) || rd32(factory + 0x28) != counter ||
        agent_file(extra, scratch, "Return_GPL_Input.bin", clone, false)) std::abort();
    wr32(scratch + 144, reserved); wr32(scratch + 148, clone);
    extra.r[R_ECX] = manager + 0x28; guest_call(&extra, 0x00634460, scratch + 128, scratch + 144);
    const uint32_t entry = rd32(scratch + 128);
    if (rd8(scratch + 132) != 1 || lookup(reserved) != clone || rd32(manager + 0x34) != entries + 1) std::abort();
    std::array<uint32_t, 32> command_addresses{}; uint32_t command_count = 0;
    if (restore_commands && !private_return_orders(extra, unit, factory, packet.data() + header_bytes,
            commands.data(), orders_bytes, command_addresses, command_count, grid_extent, repeat ? 128 : 64)) std::abort();
    uint32_t native_id = 0;
    if (!publish_native_identity(extra, factory, unit, native_id) || native_id <= header[4]) std::abort();
    extra.r[R_ECX] = clone; guest_call(&extra, 0x006263b0, native_id);
    extra.r[R_ECX] = clone;
    const bool linked = guest_call(&extra, 0x00626310) == unit && rd32(clone + 0x24) == unit;
    pair_put(*native, 36, native_id); pair_put(*script, restored_plan.native, native_id);
    size_t observed_bytes = 0;
    const bool unit_equal = linked && primary_file(extra, scratch, "Return_Unit_Observed.bin", factory, unit, true, nullptr, true) &&
        recomp_writable_path("Return_Unit_Observed.bin", path, sizeof path) && primary_bytes(path, *observed, observed_bytes, false, true, false) &&
        observed_bytes == unit_bytes && !std::memcmp(native->data(), observed->data(), unit_bytes);
    const bool script_equal = linked && !agent_file(extra, scratch, "Return_GPL_Observed.bin", clone, true) &&
        recomp_writable_path("Return_GPL_Observed.bin", path, sizeof path) && agent_bytes(path, *observed, observed_bytes) &&
        observed_bytes == script_bytes && !std::memcmp(script->data(), observed->data(), script_bytes);
    std::fprintf(stderr, "[streaming] Private return writers unit=%u agent=%u links=%u unit-equal=%u script-equal=%u\n",
        native_id, reserved, unsigned(linked), unsigned(unit_equal), unsigned(script_equal));
    if (!(linked && unit_equal && script_equal && pair_queues(manager) == queues)) std::abort();
    const char *activate_flag = recomp_env("BROWSER_STREAMING_RETURN_ACTIVE_FIXTURE");
    if (activate_flag && !std::strcmp(activate_flag, "1")) {
        if (!restore_commands || rd32(rd32(unit) + 0x1b4) != 0x005a2370 ||
            rd32(rd32(unit) + 0x94) != 0x005ad3e0 || rd32(rd32(unit) + 0x1b8) != 0x005a2420) std::abort();
        const auto drawing_before = live_drawing(factory, unit);
        if (!drawing_before.valid || drawing_before.excluded) std::abort();
        // UNIT staging deferred the original cell insertion. Publish exactly
        // this actor's saved footprint through the original +94 method, then
        // reproduce original family/helper/render and animation finalization.
        extra.r[R_ECX] = unit; guest_call(&extra, 0x005ad3e0);
        uint32_t cells = 0;
        if (!joint_motion_physical(factory, unit, cells, grid_extent)) std::abort();
        extra.r[R_ECX] = unit;
        if (!(guest_call(&extra, 0x005a2370) & 255)) std::abort();
        extra.r[R_ECX] = unit; guest_call(&extra, 0x005a2420);
        const auto drawing_after = live_drawing(factory, unit);
        if (!drawing_after.valid || drawing_after.excluded != 1 || drawing_after.kept != drawing_before.kept ||
            drawing_after.hash != drawing_before.hash || !joint_motion_physical(factory, unit, cells, grid_extent)) std::abort();
        DepartureQueues queue_before{}, queue_after{};
        const uint32_t pending = rd32(manager + 0x3c);
        if ((pending != manager + 0x10 && pending != manager + 0x1c) ||
            !departure_queues(manager, clone, queue_before) || queue_before.omitted) std::abort();
        wr32(scratch + 144, clone);
        extra.r[R_ECX] = pending; guest_call(&extra, 0x00633fd0, scratch + 128, rd32(pending + 4), scratch + 144);
        if (!departure_queues(manager, clone, queue_after) || queue_after.omitted != 1) std::abort();
        queue_after.omitted = 0;
        if (queue_after != queue_before || rd32(factory + 0x28) != native_id || rd32(runtime + 0x34) != reserved + 1 ||
            rd32(0x0071c6a8) != clock || mods_hooks_installed_count() != hooks ||
            !majesty_browser_frontier_joint_return_checkpoint(&extra)) std::abort();
        const bool active_writers = primary_file(extra, scratch, "Return_Active_Unit.bin", factory, unit, true, nullptr, true) &&
            !agent_file(extra, scratch, "Return_Active_GPL.bin", clone, true);
        std::array<uint8_t, 2048> active_orders{};
        FILE *orders_file = recomp_writable_path("Return_Orders_Observed.bin", path, sizeof path) ? std::fopen(path, "rb") : nullptr;
        const size_t active_bytes = orders_file ? std::fread(active_orders.data(), 1, active_orders.size(), orders_file) : 0;
        const bool orders_ok = orders_file && active_bytes >= 24 && active_bytes < active_orders.size() && std::fgetc(orders_file) == EOF && !std::ferror(orders_file);
        if (orders_file) std::fclose(orders_file);
        if (!active_writers || !orders_ok || !live_banks_equal(extra, unit, active_orders.data(), active_bytes, "Return_Active_Orders.bin") || !heap_free(scratch)) std::abort();
        std::fprintf(stderr, "[streaming] Return active unit=%u agent=%u clock=%u physical=1 footprint=%u drawing=1 others-preserved=1 "
            "queued=1 queues-preserved=1 counters=1 hooks=1 ready-saved=1 active-writers=1 commands=1 retained=1 result=pass\n", native_id, reserved, clock, cells);
        joint_motion_begin(unit, clone, factory, runtime, true);
        return joint_motion.active;
    }
    extra.r[R_ECX] = clone; guest_call(&extra, 0x00626340, 0u);
    extra.r[R_ECX] = clone; guest_call(&extra, 0x006263b0, 0u);
    if (!retire_native_identity(extra, factory, unit, native_id, registry_before)) std::abort();
    if (restore_commands) {
        // Normal active-world teardown drains populated banks before deleting
        // them. A bank scalar destructor alone does not own command retirement.
        for (uint32_t bank = 0; bank < 3; ++bank) {
            const uint32_t bank_address = rd32(unit + 0x88 + bank * 4);
            extra.r[R_ECX] = bank_address; guest_call(&extra, 0x005e4ff0);
            if (rd32(bank_address + 16)) std::abort();
            extra.r[R_ECX] = unit; guest_call(&extra, 0x005b2de0, bank);
            if (rd32(unit + 0x88 + bank * 4)) std::abort();
        }
    }
    extra.r[R_ECX] = manager + 0x28; guest_call(&extra, 0x006346a0, scratch + 128, entry);
    extra.r[R_ECX] = clone; guest_call(&extra, 0x00625fa0); guest_call(&extra, 0x00645bc0, clone);
    extra.r[R_ECX] = unit; guest_call(&extra, 0x00433600, 1u);
    if (!stage.acknowledge_destroyed(unit)) std::abort();
    bool commands_freed = true;
    for (uint32_t i = 0; i < command_count; ++i) commands_freed = !heap_owns(command_addresses[i]) && commands_freed;
    if (restore_commands) std::fprintf(stderr, "[streaming] Return commands cleanup requests=%u all-extents-freed=%u result=%s\n",
        command_count, unsigned(commands_freed), commands_freed ? "pass" : "fail");
    extra.r[R_ECX] = factory;
    const bool absent = !guest_call(&extra, 0x005a10d0, native_id) && !lookup(reserved);
    NativeRegistrySnapshot registry_after;
    const bool groups = native_registry_snapshot(factory, registry_after) && registry_after == registry_before;
    const bool preserved = commands_freed && absent && groups && pair_queues(manager) == queues && rd32(manager + 0x34) == entries &&
        rd32(runtime + 0x34) == reserved + 1 && rd32(factory + 0x28) == counter + 1 && rd32(0x0071c6a8) == clock &&
        mods_hooks_installed_count() == hooks && !std::memcmp(leader_before.data(), gm_ptr(leader), leader_before.size());
    heap_free(scratch);
    std::fprintf(stderr, "[streaming] Private return completed source-unit=%u source-agent=%u unit=%u agent=%u clock=%u "
        "unit-equal=1 script-equal=1 absent=%u groups=%u queues=%u entries=%u hooks=%u commands-restored=%u active=0 result=%s\n",
        header[2], header[3], native_id, reserved, clock, unsigned(absent), unsigned(groups), unsigned(pair_queues(manager) == queues),
        rd32(manager + 0x34), unsigned(mods_hooks_installed_count() == hooks), unsigned(restore_commands), preserved ? "pass" : "fail");
    return preserved;
#endif
}
} // namespace

extern "C" void majesty_browser_streaming_pair_fixture(X86 *c) {
    pair_fixture(c, false);
}
extern "C" void majesty_browser_streaming_live_fixture(X86 *c) {
    pair_fixture(c, true);
}
extern "C" void majesty_browser_streaming_arrival_fixture(X86 *c) {
    pair_fixture(c, true, true);
}
extern "C" bool majesty_browser_streaming_departure_fixture(X86 *c) {
    return departure_fixture(c);
}
extern "C" void majesty_browser_streaming_departure_reload_fixture(X86 *c) {
    departure_reload_fixture(c);
}
extern "C" void majesty_browser_streaming_arrival_persist_reload_fixture(X86 *c) {
    arrival_persist_reload_fixture(c);
}
namespace {
// Native-only original world disposal observation. Fixed storage and delegating
// hooks; retirement belongs to the original outer dispatcher, never raw frees.
struct WorldResidencyProbe {
    struct BufferOwner { uint32_t buffer = 0, owner = 0, event = 0; };
    struct PageQueue {
        uint32_t buffer = 0, queue = 0, parent = 0, recipient = 0, event = 0;
        uint32_t parent_vtable = 0;
        uint32_t allocation_load = 0;
        bool queue_freed = false, parent_freed = false;
    };
    std::array<PageQueue, 512> page_queues{};
    std::array<BufferOwner, 512> buffer_owners{};
    std::array<uint32_t, 6> roots{}, freed{};
    uint32_t exit_hook = 0, free_hook = 0, phase_hook = 0, hooks_before = 0, phase_samples = 0;
    uint32_t loads = 0, exits = 0, ticks = 0, last_tick = UINT32_MAX, extent = 0;
    uint32_t free_calls = 0;
    uint32_t saved_clock = 0, saved_tick = 0;
    uint32_t allocation_hook = 0, allocation_events = 0;
    uint32_t page_events = 0;
    uint32_t travel_initial_clock = 0, travel_accepted = 0;
    uint64_t travel_poll_ns = 0;
    std::array<uint32_t, 7> travel_last_refused{};
    std::array<uint32_t, 9> coordinate_last_refused{};
    int32_t coordinate_x = 0, coordinate_y = 0, coordinate_target_x = 0, coordinate_target_y = 0;
    bool coordinate_refused_seen = false;
    bool generate_target = false, fresh_generated = false;
    bool travel_refused_seen = false;
    bool pages_enabled = false, page_context_enabled = false;
    bool tracking = false, requested = false, owner_enabled = false;
};
WorldResidencyProbe residency;
bool residency_travel_requests() {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_REGION_REQUEST_FIXTURE");
    if (!flag) return false;
    const char *automatic = recomp_env("BROWSER_STREAMING_AUTO_REGION_LOAD_FIXTURE");
    const char *registered = recomp_env("BROWSER_STREAMING_REGISTERED_HERO_RESIDENCY_FIXTURE");
    if ((std::strcmp(flag, "v1") && std::strcmp(flag, "v2")) || !automatic || std::strcmp(automatic, "v1") ||
        !registered || std::strcmp(registered, "v1")) std::abort();
    return true;
#endif
}
bool residency_coordinate_requests() {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_REGION_REQUEST_FIXTURE");
    return flag && !std::strcmp(flag, "v2") && residency_travel_requests();
#endif
}
bool residency_coordinate_filename(char *out, size_t size, int32_t x, int32_t y) {
    if (x < -1000000 || x > 1000000 || y < -1000000 || y > 1000000) return false;
    const int n = std::snprintf(out, size, "Residency_Region_%d_%d.GMP", x, y);
    return n > 0 && size_t(n) < size;
}
bool residency_coordinate_checkpoints() {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_COORDINATE_CHECKPOINT_FIXTURE");
    if (!flag) return false;
    if (std::strcmp(flag, "v1") || !residency_coordinate_requests()) std::abort();
    return true;
#endif
}
bool residency_coordinate_store(int32_t x, int32_t y, std::string &manifest,
    std::array<std::string, 2> &names, std::array<std::string, 2> &paths, std::string &content) {
    char name[96], path[1024];
    if (!residency_coordinate_filename(name, sizeof name, x, y)) return false;
    const std::string stem = std::string(name).substr(0, std::strlen(name) - 4);
    names = {name, stem + "_Recovery.GMP"};
    if (!recomp_writable_path((stem + ".checkpoint").c_str(), path, sizeof path)) return false;
    manifest = path;
    const char *identity = recomp_env("BROWSER_STREAMING_COORDINATE_CONTENT");
    if (!identity || std::strlen(identity) != 64) return false;
    for (unsigned i = 0; i < 64; ++i)
        if (!((identity[i] >= '0' && identity[i] <= '9') || (identity[i] >= 'a' && identity[i] <= 'f'))) return false;
    content = std::string("coordinate-v1:") + identity;
    for (unsigned i = 0; i < 2; ++i) {
        if (!recomp_writable_path(names[i].c_str(), path, sizeof path)) return false;
        paths[i] = path;
        // Refuse oversized/nonregular slots before the shared store hashes one.
        OsStat stat{};
        // An interrupted inactive write may be short/empty. The manifest's
        // selected slot owns size/digest admission; never promote the other.
        if (os_lstat(path, &stat) == 0 && (!stat.is_regular || stat.size > 2 * 1024 * 1024)) return false;
    }
    return true;
}
bool residency_coordinate_selected(int32_t x, int32_t y, std::string &selected) {
    std::string manifest, content; std::array<std::string, 2> names{}, paths{};
    if (!residency_coordinate_store(x, y, manifest, names, paths, content)) return false;
    const auto record = CheckpointStore(manifest, paths, content).read();
    if (record.status != CheckpointStore::Status::valid || record.size < 272 || record.size > 2 * 1024 * 1024) return false;
    selected = names[record.slot];
    return true;
}
bool residency_expansion() {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_REGION_EXPANSION_FIXTURE");
    if (!flag) return false;
    if (std::strcmp(flag, "v1") || !residency_coordinate_checkpoints()) std::abort();
    return true;
#endif
}
bool residency_coordinate_unexplored(int32_t x, int32_t y) {
    if (!residency_expansion()) return false;
    std::string marker, content; std::array<std::string, 2> names{}, paths{};
    if (!residency_coordinate_store(x, y, marker, names, paths, content)) return false;
    OsStat stat{};
    // Only ENOENT for all three paths is unexplored. Damaged manifests,
    // orphaned/partial slots and unreadable destinations must be preserved.
    for (const auto &path : {marker, paths[0], paths[1]})
        if (os_lstat(path.c_str(), &stat) == 0 || errno != ENOENT) return false;
    return true;
}
bool residency_coordinate_available(int32_t x, int32_t y) {
    char name[96], path[1024];
    std::string selected;
    if (residency_coordinate_checkpoints()) {
        if (!residency_coordinate_selected(x, y, selected)) return false;
    } else {
        if (!residency_coordinate_filename(name, sizeof name, x, y)) return false;
        selected = name;
    }
    if (!recomp_writable_path(selected.c_str(), path, sizeof path)) return false;
    FILE *f = std::fopen(path, "rb");
    if (!f) return false;
    std::array<uint32_t, 4> version{};
    bool ok = !std::fseek(f, 0, SEEK_END);
    const long size = ok ? std::ftell(f) : -1;
    ok = ok && size >= 272 && size <= 2 * 1024 * 1024 && !std::fseek(f, 0, SEEK_SET) &&
        std::fread(version.data(), 1, sizeof version, f) == sizeof version &&
        version == std::array<uint32_t, 4>{0x53524556, 256, 1, 0};
    return std::fclose(f) == 0 && ok;
}
bool residency_travel_tick_count(uint32_t ticks) {
    return residency_travel_requests() ? ticks > 0 && ticks <= 200 : ticks == 20;
}
bool residency_allocation_enabled() {
    const char *flag = recomp_env("BROWSER_STREAMING_WORLD_ALLOCATION_FIXTURE");
    return flag && !std::strcmp(flag, "1");
}
uint32_t residency_crt_payload_size(uint32_t pointer);
struct PageRegistration {
    struct Node { uint32_t address = 0, left = 0, parent = 0, right = 0, key = 0, queue = 0; };
    std::array<Node, 64> nodes{};
    uint32_t head = 0, leaf = 0, root = 0, count = 0, walked = 0;
    uint32_t recipient_node = 0, recipient_queue = 0, queue_references = 0;
};
bool residency_page_registration(const WorldResidencyProbe::PageQueue &entry, PageRegistration &tree) {
    if (entry.parent_freed || residency_crt_payload_size(entry.parent) != 696 ||
        !gm_valid(entry.parent, 688) || rd32(entry.parent) != 0x00682bc4) return false;
    tree.head = rd32(entry.parent + 0x50); tree.count = rd32(entry.parent + 0x58);
    tree.leaf = rd32(0x006d857c);
    if (tree.count > tree.nodes.size() || tree.head == tree.leaf ||
        residency_crt_payload_size(tree.head) != 24 || residency_crt_payload_size(tree.leaf) != 24 ||
        !gm_valid(tree.head, 24) || !gm_valid(tree.leaf, 24)) return false;
    tree.root = rd32(tree.head + 4);
    struct Pending { uint32_t address = 0, parent = 0; uint64_t lower = 0, upper = 0; };
    std::array<Pending, 64> pending{};
    unsigned used = 0;
    if (tree.root != tree.leaf) pending[used++] = {tree.root, tree.head, 0, uint64_t(UINT32_MAX) + 1};
    while (used) {
        const Pending item = pending[--used];
        if (tree.walked >= tree.nodes.size() || item.address == tree.head ||
            residency_crt_payload_size(item.address) != 24 || !gm_valid(item.address, 24)) return false;
        for (unsigned i = 0; i < tree.walked; ++i) if (tree.nodes[i].address == item.address) return false;
        PageRegistration::Node node{item.address, rd32(item.address), rd32(item.address + 4),
            rd32(item.address + 8), rd32(item.address + 12), rd32(item.address + 16)};
        if (node.parent != item.parent || node.key < item.lower || uint64_t(node.key) >= item.upper) return false;
        tree.nodes[tree.walked++] = node;
        if (node.key == entry.recipient) { tree.recipient_node = node.address; tree.recipient_queue = node.queue; }
        if (node.queue == entry.queue) ++tree.queue_references;
        if (node.left != tree.leaf) {
            if (used == pending.size()) return false;
            pending[used++] = {node.left, node.address, item.lower, node.key};
        }
        if (node.right != tree.leaf) {
            if (used == pending.size()) return false;
            pending[used++] = {node.right, node.address, uint64_t(node.key) + 1, item.upper};
        }
    }
    if (tree.walked != tree.count) return false;
    if (!tree.count) return rd32(tree.head) == tree.head && rd32(tree.head + 8) == tree.head;
    const PageRegistration::Node *first = &tree.nodes[0], *last = first;
    for (unsigned i = 1; i < tree.walked; ++i) {
        if (tree.nodes[i].key < first->key) first = &tree.nodes[i];
        if (tree.nodes[i].key > last->key) last = &tree.nodes[i];
    }
    return rd32(tree.head) == first->address && rd32(tree.head + 8) == last->address;
}
void residency_page_queue_sample(const WorldResidencyProbe::PageQueue &entry, const char *stage, unsigned visit) {
    // Observed allocation identities only. Never dereference a descriptor after
    // its original free, or admit heap_size's unknown-pointer sentinel.
    const bool queue_live = !entry.queue_freed && residency_crt_payload_size(entry.queue) == 56;
    const bool parent_live = !entry.parent_freed &&
        residency_crt_payload_size(entry.parent) == 0x2b8 && gm_valid(entry.parent, 0x2b0) &&
        rd32(entry.parent) == entry.parent_vtable;
    uint32_t count = 0, map = 0, capacity = 0, map_bytes = 0, first = 0, last = 0;
    bool map_live = false;
    if (queue_live && gm_valid(entry.queue, 48)) {
        count = rd32(entry.queue + 0x2c); map = rd32(entry.queue + 0x24);
        capacity = rd32(entry.queue + 0x28); map_bytes = residency_crt_payload_size(map);
        map_live = capacity && capacity <= 4096 && capacity <= map_bytes / 4 && gm_valid(map, map_bytes);
        for (unsigned i = 0; i < 2; ++i) {
            const uint32_t node = rd32(entry.queue + (i ? 0x20 : 0x10));
            if (map_live && !(node & 3) && node >= map && node - map <= map_bytes - 4)
                (i ? last : first) = rd32(node);
        }
    }
    std::fprintf(stderr, "[streaming] World page-owner event=%u visit=%u stage=%s buffer=%08x queue=%08x "
        "parent=%08x recipient=%u queue-freed=%u parent-freed=%u queue-live=%u parent-live=%u "
        "count=%u map=%08x capacity=%u map-bytes=%u map-live=%u first-buffer=%08x last-buffer=%08x "
        "default-queue=%08x tree-head=%08x tree-count=%u buffer-live=%u result=pass\n",
        entry.event, visit, stage, entry.buffer, entry.queue, entry.parent, entry.recipient,
        unsigned(entry.queue_freed), unsigned(entry.parent_freed), unsigned(queue_live), unsigned(parent_live),
        count, map, capacity, map_bytes, unsigned(map_live), first, last,
        parent_live ? rd32(entry.parent + 0x5c) : 0, parent_live ? rd32(entry.parent + 0x50) : 0,
        parent_live ? rd32(entry.parent + 0x54) : 0, unsigned(heap_size(entry.buffer) == 4096));
    PageRegistration tree;
    const bool complete = parent_live && residency_page_registration(entry, tree);
    std::fprintf(stderr, "[streaming] World page-registration event=%u visit=%u stage=%s queue=%08x parent=%08x "
        "recipient=%u head=%08x leaf=%08x root=%08x count=%u walked=%u recipient-node=%08x recipient-queue=%08x "
        "queue-references=%u default-match=%u complete=%u nodes=", entry.event, visit, stage, entry.queue,
        entry.parent, entry.recipient, tree.head, tree.leaf, tree.root, tree.count, tree.walked,
        tree.recipient_node, tree.recipient_queue, tree.queue_references,
        unsigned(parent_live && rd32(entry.parent + 0x5c) == entry.queue), unsigned(complete));
    if (!tree.walked) std::fputc('-', stderr);
    for (unsigned i = 0; i < tree.walked; ++i) {
        const auto &n = tree.nodes[i];
        std::fprintf(stderr, "%s%08x:%08x:%08x:%08x:%08x:%08x", i ? "," : "", n.address, n.left, n.parent, n.right, n.key, n.queue);
    }
    std::fprintf(stderr, " result=%s\n", complete ? "pass" : "refused");
}
void residency_allocation(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    // Observe the original CRT allocation; never allocate, free, or replace its
    // result. The first load predates this hook, so baseline blocks are unknown.
    const uint32_t stack = cpu->esp;
    if (!gm_valid(stack, 28)) std::abort();
    const uint32_t requested = rd32(stack + 4), return_pc = rd32(stack);
    const uint32_t owner_candidate = cpu->esi;
    const bool targeted = requested >= 12193 && requested <= 12208;
    const bool page_targeted = residency.pages_enabled && requested >= 4081 && requested <= 4096;
    uint32_t caller = 0, callee = 0;
    // Pinned operator_new/malloc -> _nh_malloc -> _heap_alloc layout. Match
    // both wrapper returns and their own flag, plus all three size arguments.
    if ((targeted || page_targeted) && return_pc == 0x0064d5c1 && rd32(stack + 12) == requested &&
        rd32(stack + 24) == requested) {
        if (rd32(stack + 8) == 0x0064c621 && rd32(stack + 16) == 1) callee = 0x0064c616;
        if (rd32(stack + 8) == 0x0064d5ae && rd32(stack + 16) == rd32(0x00723538)) callee = 0x0064d59f;
        if (callee) caller = rd32(stack + 20);
    }
    // The audited queue helper has 16 local bytes and three saved registers.
    // Together with the existing 28-byte CRT wrapper layout, its return is at
    // stack+56. Capture metadata while that actual invocation is still active;
    // it does not establish the queue's lifetime after its caller returns.
    std::array<uint32_t, 14> context{};
    uint32_t queue_parent = 0, queue_recipient = 0, queue_parent_vtable = 0;
    const bool queue_context = page_targeted && residency.page_context_enabled &&
        caller == 0x004a009a && callee == 0x0064c616;
    if (queue_context) {
        if (!gm_valid(stack, 60) || owner_candidate < 4 || !gm_valid(owner_candidate - 4, 0x34)) std::abort();
        context[0] = owner_candidate; context[1] = rd32(stack + 56);
        context[2] = rd32(owner_candidate - 4); context[3] = rd32(owner_candidate + 0x2c);
        context[4] = rd32(owner_candidate + 0x24); context[5] = rd32(owner_candidate + 0x28);
        context[6] = residency_crt_payload_size(context[4]);
        if (!context[6]) {
            const uint32_t direct_bytes = heap_size(context[4]);
            if (direct_bytes != UINT32_MAX) context[6] = direct_bytes;
        }
        context[7] = context[5] && context[5] <= 4096 && context[5] <= context[6] / 4 &&
            gm_valid(context[4], context[6]);
        context[8] = rd32(owner_candidate + 0x10); context[9] = rd32(owner_candidate + 0x20);
        for (unsigned i = 0; i < 2; ++i) {
            const uint32_t node = context[8 + i];
            if (context[7] && !(node & 3) && node >= context[4] && node - context[4] <= context[6] - 4) {
                context[10 + i] = rd32(node);
                context[12 + i] = context[10 + i] && heap_size(context[10 + i]) == 4096;
            }
        }
        // Original0049ff10 saves its caller's ESI at CRT stack+32 and
        // EDI at+28. Original005a4d80 sets ESI to the message manager and
        // EDI to its critical section at+138 before CALL005a4e0d.
        if (context[1] == 0x005a4e12 && gm_valid(stack, 64)) {
            const uint32_t candidate = rd32(stack + 32);
            const uint32_t reference = rd32(stack + 60);
            const uint32_t message = gm_valid(reference, 4) ? rd32(reference) : 0;
            const uint32_t vtable = gm_valid(candidate, 4) ? rd32(candidate) : 0;
            const uint32_t bytes = residency_crt_payload_size(candidate);
            const bool admitted = bytes == 0x2b8 && gm_valid(candidate, 0x2b0) &&
                rd32(stack + 28) == candidate + 0x138 && gm_valid(message, 0x1c);
            std::fprintf(stderr, "[streaming] World page-parent queue=%08x parent=%08x global=%08x "
                "vtable=%08x bytes=%u lock=%08x reference=%08x message=%08x admitted=%u result=pass\n",
                owner_candidate, candidate, rd32(0x006d8568), vtable, bytes, rd32(stack + 28),
                reference, message, unsigned(admitted));
            if (admitted) {
                queue_parent = candidate; queue_parent_vtable = vtable;
                queue_recipient = rd32(message + 0x10);
            }
        }
    }
    const auto result = mods_call_next(api, inv, cpu);
    if (result != POP_OK) std::abort();
    if (page_targeted && cpu->eax && heap_size(cpu->eax) == 4096) {
        if (++residency.page_events > 1024) std::abort();
        std::fprintf(stderr, "[streaming] World page event=%u op=alloc address=%08x "
            "input=%u heap-requested=4096 return-pc=%08x direct-caller=%08x direct-callee=%08x "
            "loads=%u exits=%u clock=%u result=pass\n", residency.page_events, cpu->eax,
            requested, return_pc, caller, callee, residency.loads, residency.exits, rd32(0x0071c6a8));
        if (queue_context) std::fprintf(stderr, "[streaming] World page-context event=%u queue=%08x "
            "push-caller=%08x prefix=%08x count=%u map=%08x capacity=%u map-bytes=%u map-live=%u "
            "first-node=%08x last-node=%08x first-buffer=%08x last-buffer=%08x first-live=%u last-live=%u result=pass\n",
            residency.page_events, context[0], context[1], context[2], context[3], context[4], context[5],
            context[6], context[7], context[8], context[9], context[10], context[11], context[12], context[13]);
        if (queue_context && queue_parent) {
            WorldResidencyProbe::PageQueue *slot = nullptr;
            for (auto &entry : residency.page_queues) if (!entry.buffer) { slot = &entry; break; }
            if (!slot) std::abort();
            *slot = {cpu->eax, owner_candidate, queue_parent, queue_recipient, residency.page_events,
                queue_parent_vtable, residency.loads, false, false};
            residency_page_queue_sample(*slot, "allocation", residency.exits);
        }
    }
    if (!targeted || !cpu->eax || heap_size(cpu->eax) != 12208) return;
    if (++residency.allocation_events > 1024) std::abort();
    if (residency.owner_enabled) {
        WorldResidencyProbe::BufferOwner *slot = nullptr;
        for (auto &entry : residency.buffer_owners) if (entry.buffer == cpu->eax) { slot = &entry; break; }
        if (!slot) for (auto &entry : residency.buffer_owners) if (!entry.buffer) { slot = &entry; break; }
        if (!slot) std::abort();
        // ESI belongs to the caller here: both audited allocation wrappers
        // preserve it. Record a candidate; validate its CRT lifetime at capture.
        const uint32_t owner = caller == 0x00529e70 && callee == 0x0064d59f &&
            gm_valid(owner_candidate, 0x38) && rd32(owner_candidate) == 0x00688a70 ? owner_candidate : 0;
        *slot = {cpu->eax, owner, residency.allocation_events};
    }
    std::fprintf(stderr, "[streaming] World allocation event=%u op=alloc address=%08x "
        "input=%u heap-requested=12208 return-pc=%08x direct-caller=%08x direct-callee=%08x loads=%u exits=%u "
        "clock=%u result=pass\n", residency.allocation_events, cpu->eax, requested, return_pc,
        caller, callee, residency.loads, residency.exits, rd32(0x0071c6a8));
}
bool residency_persistence() {
    const char *flag = recomp_env("BROWSER_STREAMING_WORLD_PERSISTENCE_FIXTURE");
    return flag && !std::strcmp(flag, "1");
}
bool connected_residency() {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_CONNECTED_RESIDENCY_FIXTURE");
    if (!flag) return false;
    // A separate native-only trial of the two generated 128-cell regions.
    // Preserve the older committed-mission 256/512-grid qualification.
    const char *profile = recomp_env("PROFILE_DIR");
    std::string_view path(profile ? profile : "");
    constexpr std::string_view suffix = "/frontier_0_0";
    if (std::strcmp(flag, "v1") || !path.ends_with(suffix) ||
        !isolated_fixture() || !residency_persistence()) std::abort();
    path.remove_suffix(suffix.size());
    const size_t slash = path.rfind('/');
    if (!path.substr(slash == path.npos ? 0 : slash + 1)
             .starts_with("actor-arrival-fixture-connected-residency-")) std::abort();
    return true;
#endif
}
bool connected_initialization() {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_CONNECTED_INITIALIZATION_FIXTURE");
    if (!flag) return false;
    if (std::strcmp(flag, "v1") || !connected_residency()) std::abort();
    return true;
#endif
}
unsigned residency_side(unsigned visit) {
    const char *flag = recomp_env("BROWSER_STREAMING_REGISTERED_HERO_RESIDENCY_FIXTURE");
    if (!flag) return (visit + 1) % 2;
    // Committed hero worlds begin at the owning home kingdom, then visit
    // its dormant neighbor. Reuse the original save/dispose/load lifecycle.
    // Fresh generated-region initialization remains a separate experiment.
    if (std::strcmp(flag, "v1") || !connected_residency() || connected_initialization())
        std::abort();
    return visit % 2;
}
unsigned residency_visit_limit();
bool residency_travel_ready() {
    if (!residency_travel_requests()) return true;
    auto &s = residency;
    const bool finish = s.loads + 1 == residency_visit_limit();
    if (residency_coordinate_requests()) {
        const std::array<uint32_t, 9> words{0x32565254, 2, s.loads + 1, uint32_t(s.coordinate_x),
            uint32_t(s.coordinate_y), uint32_t(s.coordinate_x), uint32_t(s.coordinate_y),
            rd32(0x0071c6a8), finish ? 2u : 0u};
        char temporary[1024], target[1024];
        if (!recomp_writable_path("Region_Travel_Ready.tmp", temporary, sizeof temporary) ||
            !recomp_writable_path("Region_Travel_Ready.bin", target, sizeof target)) return false;
        FILE *f = std::fopen(temporary, "wb");
        if (!f) return false;
        bool ok = std::fwrite(words.data(), 1, sizeof words, f) == sizeof words;
        ok = std::fclose(f) == 0 && ok && !std::rename(temporary, target);
        if (ok) {
            s.travel_initial_clock = words[7]; s.travel_poll_ns = 0;
            s.coordinate_refused_seen = false;
            std::fprintf(stderr, "[streaming] World coordinate-ready serial=%u visit=%u source=%d_%d clock=%u operation=%u bytes=36 result=pass\n",
                words[2], s.loads, s.coordinate_x, s.coordinate_y, words[7], words[8]);
        }
        return ok;
    }
    const std::array<uint32_t, 7> words{0x31565254, 1, s.loads + 1, residency_side(s.loads),
        finish ? residency_side(s.loads) : residency_side(s.loads + 1), rd32(0x0071c6a8), finish ? 2u : 1u};
    char temporary[1024], target[1024];
    if (!recomp_writable_path("Region_Travel_Ready.tmp", temporary, sizeof temporary) ||
        !recomp_writable_path("Region_Travel_Ready.bin", target, sizeof target)) return false;
    FILE *f = std::fopen(temporary, "wb");
    if (!f) return false;
    bool ok = std::fwrite(words.data(), 1, sizeof words, f) == sizeof words;
    ok = std::fclose(f) == 0 && ok && !std::rename(temporary, target);
    if (ok) {
        s.travel_initial_clock = words[5]; s.travel_poll_ns = 0;
        std::fprintf(stderr, "[streaming] World travel-ready serial=%u visit=%u source=%u target=%u clock=%u operation=%u bytes=28 result=pass\n",
            words[2], s.loads, words[3], words[4], words[5], words[6]);
    }
    return ok;
}
bool residency_take_travel_request() {
    auto &s = residency;
    const uint64_t now = os_monotonic_ns();
    if (now - s.travel_poll_ns < 200000000u) return false;
    s.travel_poll_ns = now;
    char path[1024];
    if (!recomp_writable_path("Region_Travel_Request.bin", path, sizeof path)) std::abort();
    FILE *f = std::fopen(path, "rb");
    if (!f) return false;
    if (residency_coordinate_requests()) {
        std::array<uint32_t, 9> words{};
        const bool exact = std::fread(words.data(), 1, sizeof words, f) == sizeof words && std::fgetc(f) == EOF && !std::ferror(f);
        const bool closed = std::fclose(f) == 0;
        const uint32_t visit = s.loads - 1, clock = rd32(0x0071c6a8), hooks = mods_hooks_installed_count();
        const int32_t x = int32_t(words[5]), y = int32_t(words[6]);
        const int64_t dx = int64_t(x) - s.coordinate_x, dy = int64_t(y) - s.coordinate_y;
        const bool finish = s.loads == residency_visit_limit();
        const bool neighbor = (dx == 1 || dx == -1) ? dy == 0 : dx == 0 && (dy == 1 || dy == -1);
        const bool common = exact && closed && words[0] == 0x32565254 && words[1] == 2 &&
            words[2] == s.loads && words[2] == s.travel_accepted + 1 &&
            int32_t(words[3]) == s.coordinate_x && int32_t(words[4]) == s.coordinate_y &&
            words[7] == s.travel_initial_clock && words[8] == (finish ? 2u : 1u);
        const bool saved = common && !finish && neighbor && residency_coordinate_available(x, y);
        const bool unexplored = common && !finish && neighbor && !saved && residency_coordinate_unexplored(x, y);
        const bool available = saved || unexplored;
        const bool admitted = common &&
            (finish ? x == s.coordinate_x && y == s.coordinate_y : available);
        if (!admitted) {
            if (!s.coordinate_refused_seen || words != s.coordinate_last_refused) {
                std::fprintf(stderr, "[streaming] World coordinate-request refused visit=%u serial=%u source=%d_%d target=%d_%d initial-clock=%u current-clock=%u completed-ticks=%u operation=%u accepted=%u exact=%u available=%u world-same=1 clock-same=1 hooks-same=1 result=pass\n",
                    visit, words[2], int32_t(words[3]), int32_t(words[4]), x, y, words[7], clock, s.ticks, words[8],
                    s.travel_accepted, unsigned(exact && closed), unsigned(available));
                s.coordinate_refused_seen = true; s.coordinate_last_refused = words;
            }
            return false;
        }
        if (std::remove(path)) std::abort();
        ++s.travel_accepted; s.coordinate_target_x = x; s.coordinate_target_y = y;
        s.generate_target = unexplored;
        if (unexplored) std::fprintf(stderr, "[streaming] World expansion admitted visit=%u target=%d_%d marker-absent=1 slots-absent=2 result=pass\n", visit, x, y);
        if (rd32(0x0071c68c) != s.roots[0] || rd32(0x0071c6a8) != clock || mods_hooks_installed_count() != hooks) std::abort();
        std::fprintf(stderr, "[streaming] World coordinate-request accepted visit=%u serial=%u source=%d_%d target=%d_%d initial-clock=%u current-clock=%u completed-ticks=%u operation=%u accepted=%u consumed=1 world-same=1 clock-same=1 hooks-same=1 result=pass\n",
            visit, words[2], s.coordinate_x, s.coordinate_y, x, y, words[7], clock, s.ticks, words[8], s.travel_accepted);
        return true;
    }
    std::array<uint32_t, 7> words{};
    const bool exact = std::fread(words.data(), 1, sizeof words, f) == sizeof words && std::fgetc(f) == EOF && !std::ferror(f);
    const bool closed = std::fclose(f) == 0;
    const uint32_t visit = s.loads - 1, clock = rd32(0x0071c6a8), hooks = mods_hooks_installed_count();
    const bool admitted = exact && closed && words[0] == 0x31565254 && words[1] == 1 && words[2] == s.loads &&
        words[2] == s.travel_accepted + 1 && words[3] == residency_side(visit) &&
        words[4] == residency_side(visit + (s.loads == residency_visit_limit() ? 0u : 1u)) &&
        words[5] == s.travel_initial_clock && words[6] == (s.loads == residency_visit_limit() ? 2u : 1u);
    if (!admitted) {
        if (!s.travel_refused_seen || words != s.travel_last_refused) {
            std::fprintf(stderr, "[streaming] World travel-request refused visit=%u serial=%u source=%u target=%u initial-clock=%u "
                "current-clock=%u completed-ticks=%u operation=%u accepted=%u exact=%u world-same=1 clock-same=1 hooks-same=1 result=pass\n",
                visit, words[2], words[3], words[4], words[5], clock, s.ticks, words[6], s.travel_accepted, unsigned(exact && closed));
            s.travel_refused_seen = true; s.travel_last_refused = words;
        }
        return false;
    }
    if (std::remove(path)) std::abort();
    ++s.travel_accepted;
    if (rd32(0x0071c68c) != s.roots[0] || rd32(0x0071c6a8) != clock || mods_hooks_installed_count() != hooks) std::abort();
    std::fprintf(stderr, "[streaming] World travel-request accepted visit=%u serial=%u source=%u target=%u initial-clock=%u "
        "current-clock=%u completed-ticks=%u operation=%u accepted=%u consumed=1 world-same=1 clock-same=1 hooks-same=1 result=pass\n",
        visit, words[2], words[3], words[4], words[5], clock, s.ticks, words[6], s.travel_accepted);
    return true;
}
// Observe the original cold-load transformations before changing the region
// persistence contract. These scoped callbacks never repair saved/live fields.
std::array<uint32_t, 3> connected_transform_hooks{};
unsigned connected_transform_visit = 0, connected_transform_events = 0;
unsigned connected_transform_version = 0;
void connected_transform_observer(const PopModApi *api, pop_cpu_v1 *cpu,
                                  PopHookInvocation *inv, void *opaque) {
    const uintptr_t kind = reinterpret_cast<uintptr_t>(opaque);
    const uint32_t self = cpu->ecx, caller = gm_valid(cpu->esp, 4) ? rd32(cpu->esp) : 0;
    uint32_t before = 0, address = 0, id = 0, mask = 0, radius = 0, arg0 = 0, arg1 = 0;
    int32_t x = 0, y = 0;
    if (kind == 1 && gm_valid(self, 0x88) && rd32(self + 0x60) &&
        gm_valid(rd32(self + 0x84), 0x8c) && rd32(rd32(self + 0x84)) == 0x00682950) {
        address = self + 0x64; before = rd32(address); id = rd32(self + 0x60);
        if (connected_transform_version == 2 && gm_valid(cpu->esp + 4, 8)) {
            arg0 = rd32(cpu->esp + 4); arg1 = rd32(cpu->esp + 8);
        }
    } else if (kind == 2 && gm_valid(self, 0x54) && rd32(self) == 0x0068b660 &&
               rd32(self + 0x38) == 129 && rd32(self + 0x3c) == 129 &&
               gm_valid(rd32(self + 0x4c), 129u * 129u * 24u) && gm_valid(cpu->esp + 4, 12)) {
        const uint32_t point = rd32(cpu->esp + 4);
        if (gm_valid(point, 8)) {
            x = int32_t(rd32(point)); y = int32_t(rd32(point + 4));
            mask = rd32(cpu->esp + 8); radius = rd32(cpu->esp + 12);
            address = rd32(self + 0x4c) + (126u * 129u + 28u) * 24u + 4;
            before = rd32(address);
            // Pinned position revelation and visibility rebuilding both
            // preserve their unit in ESI at these exact calls.
            if ((caller == 0x005ad513 || caller == 0x005b64a0) && gm_valid(cpu->esi, 0x88) &&
                gm_valid(rd32(cpu->esi + 0x84), 0x84) &&
                rd32(rd32(cpu->esi + 0x84) + 0x80) == self)
                id = rd32(cpu->esi + 0x60);
        }
    } else if (kind == 3 && gm_valid(self, 0x54) && gm_valid(cpu->esp + 4, 4)) {
        address = self + 0x20; before = rd32(address); id = rd32(cpu->esp + 4);
    }
    const auto result = mods_call_next(api, inv, cpu);
    if (result != POP_OK) std::abort();
    if (!address || !gm_valid(address, 4) || before == rd32(address)) return;
    if (++connected_transform_events > 64) std::abort();
    std::fprintf(stderr, "[streaming] Connected load transform visit=%u event=%u kind=%u "
        "caller=%08x self=%08x id=%u before=%08x after=%08x point=%d,%d mask=%08x radius=%u "
        "arg0=%u arg1=%u result=pass\n",
        connected_transform_visit, connected_transform_events, unsigned(kind), caller, self, id,
        before, rd32(address), x, y, mask, radius, arg0, arg1);
}
void connected_transform_observers_begin() {
    const char *flag = recomp_env("BROWSER_STREAMING_CONNECTED_LOAD_TRANSFORMS");
    if (!flag) return;
    if ((std::strcmp(flag, "v1") && std::strcmp(flag, "v2")) || !connected_residency() ||
        connected_transform_hooks[0] || !sched_holds_baton()) std::abort();
    connected_transform_version = !std::strcmp(flag, "v2") ? 2u : 1u;
    connected_transform_events = 0;
    const uint32_t targets[] = {connected_transform_version == 2 ? 0x005b6a80u : 0x005b6ad0u,
                                0x005afe20, 0x00438ac0};
    for (unsigned i = 0; i < 3; ++i) {
        const auto result = mods_hook_install_ex(MODS_OWNER_RUNTIME, targets[i], 0, connected_transform_observer,
                POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, reinterpret_cast<void *>(uintptr_t(i + 1)),
                &connected_transform_hooks[i]);
        if (result != POP_OK) {
            std::fprintf(stderr, "[streaming] Connected load observer refused target=%08x status=%d\n",
                targets[i], int(result));
            std::abort();
        }
    }
    std::fprintf(stderr, "[streaming] Connected load observers visit=%u version=%u installed=3 result=pass\n",
        connected_transform_visit, connected_transform_version);
}
void connected_transform_observers_end() {
    if (!connected_transform_hooks[0]) return;
    for (auto &hook : connected_transform_hooks) {
        if (!hook || mods_hook_remove(MODS_OWNER_RUNTIME, hook) != POP_OK) std::abort();
        hook = 0;
    }
    std::fprintf(stderr, "[streaming] Connected load observers visit=%u removed=3 events=%u result=pass\n",
        connected_transform_visit++, connected_transform_events);
}
unsigned residency_visit_limit() {
    static const unsigned limit = [] {
        const char *text = recomp_env("BROWSER_STREAMING_WORLD_RESIDENCY_VISITS");
        if (!text) return 3u;
        char *end = nullptr;
        const unsigned long count = std::strtoul(text, &end, 10);
        if (!*text || *end || count < 3 || count > 32 || !residency_persistence()) std::abort();
        return unsigned(count);
    }();
    return limit;
}
bool residency_survivors_enabled() {
    const char *flag = recomp_env("BROWSER_STREAMING_WORLD_SURVIVOR_FIXTURE");
    return flag && !std::strcmp(flag, "1");
}
uint32_t residency_crt_payload_size(uint32_t pointer) {
    // Identify an exact allocated block by walking its own committed page.
    // Looking at pointer-4 alone could mistake stale payload for a live header.
    if (!pointer || (pointer & 15)) return 0;
    const uint32_t count = rd32(0x00723a7c), table = rd32(0x00723a80);
    if (count > 64 || !gm_valid(table, count * 20)) return 0;
    for (uint32_t i = 0; i < count; ++i) {
        const uint32_t base = rd32(table + i * 20 + 12);
        if (pointer < base || pointer - base >= 0x100000) continue;
        if (heap_size(base) != 0x100000) return 0;
        const uint32_t group = (pointer - base) / 0x8000;
        if (rd32(table + i * 20 + 8) & (0x80000000u >> group)) return 0;
        const uint32_t page = base + ((pointer - base) & ~0xfffu), end = page + 0xffc;
        if (!gm_valid(page, 0x1000) || rd32(page + 8) != UINT32_MAX || rd32(end) != UINT32_MAX) return 0;
        uint32_t cursor = page + 12;
        for (uint32_t scanned = 0; cursor < end && scanned < 256; ++scanned) {
            const uint32_t raw = rd32(cursor), size = raw & ~1u;
            if (size < 16 || (size & 15) || size > end - cursor || rd32(cursor + size - 4) != raw) return 0;
            if (cursor + 4 == pointer) return (raw & 1) && size <= 1024 ? size - 8 : 0;
            if (cursor + 4 > pointer) return 0;
            cursor += size;
        }
        return 0;
    }
    return 0;
}
bool residency_cache_storage(uint32_t pointer, uint32_t &kind, uint32_t &base, uint32_t &bytes,
                             uint32_t required = 0x28) {
    // Cache nodes may be embedded in a large directly allocated index array.
    // Check exact allocation bounds, excluding CRT backing: a committed CRT
    // reservation alone does not establish that an interior small block lives.
    if (!pointer || (pointer & 3)) return false;
    bytes = residency_crt_payload_size(pointer);
    if (bytes >= required) { kind = 1; base = pointer; return true; }
    bytes = 0;
    const uint32_t count = rd32(0x00723a7c), table = rd32(0x00723a80);
    if (count > 64 || !gm_valid(table, count * 20)) return false;
    std::array<HeapAllocation, 64> rows{};
    uint32_t cursor = 0;
    for (unsigned pages = 0; pages < 256; ++pages) {
        const auto page = heap_read_allocations(cursor, rows.data(), rows.size());
        if (!page.valid || page.count > rows.size() || page.scanned > 256 || (!page.complete && page.cursor <= cursor)) return false;
        for (uint32_t i = 0; i < page.count; ++i) {
            const auto &row = rows[i];
            if (row.address > pointer) return false;
            if (pointer - row.address >= row.requested_bytes) continue;
            if (row.address == table) return false;
            for (uint32_t j = 0; j < count; ++j)
                if (row.address == rd32(table + j * 20 + 12) || row.address == rd32(table + j * 20 + 16)) return false;
            const uint32_t remaining = row.requested_bytes - (pointer - row.address);
            if (remaining < required || !gm_valid(pointer, required)) return false;
            kind = 2; base = row.address; bytes = row.requested_bytes;
            return true;
        }
        if (page.complete) return false;
        cursor = page.cursor;
    }
    return false;
}
bool residency_owner_capture(unsigned visit, const char *stage) {
    if (!residency.owner_enabled) return true;
    const auto started = std::chrono::steady_clock::now();
    const auto before = heap_stats();
    const uint32_t clock = rd32(0x0071c6a8), hooks = mods_hooks_installed_count();
    if (!sched_holds_baton() || before.used_blocks > 8192) return false;
    const uint32_t stage_id = !std::strcmp(stage, "load") ? 0 : !std::strcmp(stage, "before-exit") ? 1 : 2;
    char name[96], path[1024];
    std::snprintf(name, sizeof name, "Owners_Visit_%u_%s.bin", visit, stage);
    FILE *output = recomp_writable_path(name, path, sizeof path) ? std::fopen(path, "wbx") : nullptr;
    if (!output) return false;
    std::array<uint8_t, 72> bytes{};
    const auto write_words = [&](const uint32_t *words, size_t n) {
        for (size_t j = 0; j < n; ++j) for (unsigned k = 0; k < 4; ++k) bytes[j * 4 + k] = uint8_t(words[j] >> (k * 8));
        return std::fwrite(bytes.data(), 4, n, output) == n;
    };
    const std::array<uint32_t, 10> header{0x524e574f, 2, visit, stage_id, 12208, 512, 72, clock, hooks, residency.allocation_events};
    bool ok = write_words(header.data(), header.size()), complete = false;
    std::array<HeapAllocation, 64> allocations{};
    uint32_t cursor = 0, pages = 0, targets = 0, tracked = 0, linked = 0, referenced = 0;
    while (ok && !complete && pages < 256) {
        const auto page = heap_read_allocations(cursor, allocations.data(), allocations.size());
        ok = page.valid && page.count <= allocations.size() && page.scanned <= 256 &&
            (page.complete || page.cursor > cursor);
        if (!ok) break;
        for (uint32_t i = 0; i < page.count; ++i) {
            if (allocations[i].requested_bytes != 12208) continue;
            if (++targets > 512) { ok = false; break; }
            std::array<uint32_t, 18> row{}; row[0] = allocations[i].address;
            for (const auto &entry : residency.buffer_owners) if (entry.buffer == row[0]) {
                row[1] = entry.event; row[2] = entry.owner; ++tracked; break;
            }
            row[4] = residency_crt_payload_size(row[2]); row[3] = row[4] >= 0x38;
            if (row[3]) {
                row[5] = rd32(row[2]);
                if (row[5] == 0x00688a70) {
                    row[6] = rd32(row[2] + 0x24); row[7] = rd32(row[2] + 4); row[13] = rd32(row[2] + 0x14);
                    row[8] = residency_cache_storage(row[7], row[15], row[16], row[17]);
                    if (row[8]) row[9] = row[15] == 1 ? row[17] : row[17] - (row[7] - row[16]);
                    if (row[8]) {
                        row[10] = rd32(row[7] + 0x10); row[11] = rd32(row[7] + 0x14);
                        row[12] = rd32(row[7] + 0xc); row[14] = rd32(row[7] + 0x18);
                    }
                    if (row[6] == row[0] && !(row[13] & 0x10000)) {
                        ++linked;
                        if (row[8] && row[10] == row[2] && int32_t(row[11]) > 0) ++referenced;
                    }
                }
            }
            ok = write_words(row.data(), row.size()) && ok;
        }
        cursor = page.cursor; complete = page.complete; ++pages;
    }
    ok = std::fclose(output) == 0 && ok && complete;
    const auto after = heap_stats();
    const bool same = before.used_bytes == after.used_bytes && before.used_blocks == after.used_blocks &&
        before.req_bytes == after.req_bytes && before.total_allocs == after.total_allocs && before.total_frees == after.total_frees &&
        before.free_bytes == after.free_bytes && before.free_blocks == after.free_blocks;
    const auto elapsed = std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - started).count();
    ok = ok && same && rd32(0x0071c6a8) == clock && mods_hooks_installed_count() == hooks && elapsed <= 2000000;
    std::fprintf(stderr, "[streaming] World owners visit=%u stage=%s file=%s targets=%u tracked=%u "
        "linked=%u referenced=%u bytes=%u clock=%u hooks=%u world-null=%u heap-same=%u clock-same=%u "
        "hooks-same=%u elapsed-us=%llu result=%s\n", visit, stage, name, targets, tracked, linked, referenced,
        40 + targets * 72, clock, hooks, unsigned(!rd32(0x0071c68c)), unsigned(same),
        unsigned(rd32(0x0071c6a8) == clock), unsigned(mods_hooks_installed_count() == hooks),
        (unsigned long long)elapsed, ok ? "pass" : "fail");
    return ok;
}
bool residency_release_idle_tiles(X86 *c, unsigned visit, bool idle = false) {
#ifdef __EMSCRIPTEN__
    return true;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_IDLE_TILE_RELEASE_FIXTURE");
    if (!flag) return true;
    const char *hero = recomp_env("BROWSER_STREAMING_REGISTERED_HERO_RESIDENCY_FIXTURE");
    if (std::strcmp(flag, idle ? "v2" : "v1") || !hero || std::strcmp(hero, "v1") ||
        !connected_residency() || !residency.owner_enabled || !sched_holds_baton() ||
        mods_hook_depth() || c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
        return false;
    const uint32_t clock = rd32(0x0071c6a8), world = rd32(0x0071c68c);
    const auto hooks = mods_hooks_installed_count();
    const auto before = heap_stats();
    X86 extra = *c; extra.r[R_ESP] -= 32768;
    unsigned eligible = 0, freed = 0, retained = 0;
    unsigned tracked = 0, owners = 0, backlinks = 0, zero = 0;
    unsigned descriptors = 0, typed = 0, arrays = 0, resolved = 0, details = 0;
    const auto exact_storage = [](uint32_t pointer, uint32_t size) {
        if (!pointer || (pointer & 3) || !gm_valid(pointer, size)) return false;
        const uint32_t ordinary = heap_size(pointer);
        return (ordinary != UINT32_MAX && ordinary >= size) || residency_crt_payload_size(pointer) >= size;
    };
    const uint32_t manager = rd32(0x006d8ee0);
    if (!exact_storage(manager, 0x14) || rd32(manager) != 0x00685d84 ||
        rd32(0x00685d84 + 0x64) != 0x004f73a0) return false;
    // Only owners observed at the audited original ordinary TILE allocation
    // site are candidates. Unknown baseline blocks and referenced entries stay.
    // The original registry resolver must still return the very same entry.
    for (const auto record : residency.buffer_owners) {
        if (!record.buffer || heap_size(record.buffer) != 12208) continue;
        ++tracked;
        if (!record.owner ||
            !exact_storage(record.owner, 0x38) || rd32(record.owner) != 0x00688a70 ||
            rd32(record.owner + 0x24) != record.buffer || (rd32(record.owner + 0x14) & 0x10000)) continue;
        ++owners;
        const uint32_t entry = rd32(record.owner + 4);
        uint32_t kind = 0, base = 0, bytes = 0;
        if (!residency_cache_storage(entry, kind, base, bytes) || !gm_valid(entry, 0x30) ||
            (kind == 1 ? bytes < 0x30 : bytes - (entry - base) < 0x30) ||
            rd32(entry + 0x10) != record.owner) continue;
        ++backlinks;
        if (rd32(entry + 0x14)) continue;
        ++zero;
        const uint32_t descriptor = rd32(entry + 0x24), key = rd32(entry);
        if (!residency_cache_storage(descriptor, kind, base, bytes, 0x18) || !gm_valid(descriptor, 0x18)) continue;
        ++descriptors;
        if (details++ < 4) std::fprintf(stderr, "[streaming] Idle TILE candidate visit=%u event=%u "
            "descriptor=%08x type=%08x entries=%u array=%08x result=observed\n", visit,
            record.event, descriptor, rd32(descriptor), rd32(descriptor + 0x10), rd32(descriptor + 0x14));
        if (rd32(descriptor) != 0x454c4954) continue;
        ++typed;
        const uint32_t library = rd32(descriptor + 8);
        const uint32_t entries = rd32(descriptor + 0x10), array = rd32(descriptor + 0x14);
        // Original0055a400 allocates count*48+4 and publishes allocation+4.
        // Its array cookie must match; never treat the interior pointer as an
        // independent allocation or a CRT reservation as live payload.
        if (!entries || entries > 65536 || array < 4 ||
            !exact_storage(array - 4, entries * 0x30 + 4) || rd32(array - 4) != entries) continue;
        if (entry < array || entry - array >= entries * 0x30 || (entry - array) % 0x30) continue;
        ++arrays;
        extra.r[R_ECX] = descriptor;
        if (guest_call(&extra, 0x0055a150u, key) != entry) continue;
        ++resolved;
        if (rd32(entry + 0x14) || rd32(entry + 0x10) != record.owner) return false;
        ++eligible;
        // Match original00527c60's manager action2 arguments without its
        // decrement: this already-zero entry has no reference to release.
        // The original TILE translator retains its policy callback; no
        // refcount, cache link, resource field or destructor is substituted.
        extra.r[R_ECX] = manager;
        const std::array<uint32_t, 7> arguments{library, 0x454c4954u, key, entry, 2u, 0u, 0u};
        guest_call(&extra, 0x004f73a0u, arguments.data(), arguments.size());
        const bool gone = heap_size(record.buffer) == UINT32_MAX;
        const bool entry_cleared = !rd32(entry + 0x10) && !rd32(entry + 0x14);
        const bool entry_retained = rd32(entry + 0x10) == record.owner && !rd32(entry + 0x14) &&
            exact_storage(record.owner, 0x38) && rd32(record.owner + 4) == entry &&
            rd32(record.owner + 0x24) == record.buffer && heap_size(record.buffer) == 12208;
        const bool ok = gone ? entry_cleared : entry_retained;
        std::fprintf(stderr, "[streaming] Idle TILE release visit=%u event=%u key=%u descriptor=%08x "
            "entry=%08x owner=%08x buffer=%08x references=0 original=004f73a0 freed=%u retained=%u result=%s\n",
            visit, record.event, key, descriptor, entry, record.owner, record.buffer,
            unsigned(gone), unsigned(!gone), ok ? "pass" : "fail");
        if (!ok) return false;
        freed += gone; retained += !gone;
    }
    const auto after = heap_stats();
    const bool ok = rd32(0x0071c6a8) == clock && rd32(0x0071c68c) == world &&
        mods_hooks_installed_count() == hooks && heap_check().empty();
    std::fprintf(stderr, "[streaming] Idle TILE gates visit=%u tracked=%u owners=%u backlinks=%u "
        "zero=%u descriptors=%u typed=%u arrays=%u resolved=%u result=pass\n",
        visit, tracked, owners, backlinks, zero, descriptors, typed, arrays, resolved);
    std::fprintf(stderr, "[streaming] Idle TILE sweep visit=%u eligible=%u freed=%u retained=%u "
        "heap-before=%llu heap-after=%llu clock-same=%u world-same=%u hooks-same=%u%s result=%s\n",
        visit, eligible, freed, retained, (unsigned long long)before.used_bytes,
        (unsigned long long)after.used_bytes, unsigned(rd32(0x0071c6a8) == clock),
        unsigned(rd32(0x0071c68c) == world), unsigned(mods_hooks_installed_count() == hooks),
        idle ? " stage=idle world-null=1 hook-depth=0" : "", ok ? "pass" : "fail");
    return ok;
#endif
}
bool residency_heap_capture(unsigned visit, const char *stage) {
    const char *flag = recomp_env("BROWSER_STREAMING_WORLD_HEAP_FIXTURE");
    if (!flag || std::strcmp(flag, "1")) return true;
    const auto started = std::chrono::steady_clock::now();
    const auto before = heap_stats();
    const uint32_t clock = rd32(0x0071c6a8), hooks = mods_hooks_installed_count();
    const uint32_t stage_id = !std::strcmp(stage, "load") ? 0 : !std::strcmp(stage, "before-exit") ? 1 : 2;
    if (!sched_holds_baton() || before.used_blocks > 8192 || before.used_bytes > UINT32_MAX || before.req_bytes > UINT32_MAX) return false;
    char name[96], path[1024];
    std::snprintf(name, sizeof name, "Heap_Visit_%u_%s.bin", visit, stage);
    if (!recomp_writable_path(name, path, sizeof path)) return false;
    FILE *output = std::fopen(path, "wbx");
    if (!output) return false;
    const uint32_t crt_count = rd32(0x00723a7c), crt_table = rd32(0x00723a80);
    std::array<uint32_t, 64> crt_bases{}, crt_controls{};
    if (crt_count > 64 || !gm_valid(crt_table, crt_count * 20)) { std::fclose(output); return false; }
    for (unsigned i = 0; i < crt_count; ++i) {
        crt_bases[i] = rd32(crt_table + i * 20 + 12);
        crt_controls[i] = rd32(crt_table + i * 20 + 16);
    }
    std::array<uint8_t, 64 * 16> bytes{};
    const auto word = [&](size_t at, uint32_t value) {
        for (unsigned i = 0; i < 4; ++i) bytes[at + i] = uint8_t(value >> (i * 8));
    };
    const std::array<uint32_t, 10> header{0x50414548, 2, visit, stage_id, before.used_blocks,
        uint32_t(before.used_bytes), uint32_t(before.req_bytes), crt_count, clock, hooks};
    for (unsigned i = 0; i < header.size(); ++i) word(i * 4, header[i]);
    bool ok = std::fwrite(bytes.data(), 1, 40, output) == 40;
    std::array<HeapAllocation, 64> rows{};
    uint32_t cursor = 0, count = 0, pages = 0, largest_scan = 0, known_count = 0;
    uint64_t rounded = 0, requested = 0, known_bytes = 0;
    bool complete = false;
    while (ok && !complete && pages < 256) {
        const auto page = heap_read_allocations(cursor, rows.data(), rows.size());
        ok = page.valid && page.count <= rows.size() && page.scanned <= 256 &&
             (page.complete || page.cursor > cursor) && count + page.count <= 8192;
        if (!ok) break;
        for (unsigned i = 0; i < page.count; ++i) {
            ok = ok && rows[i].address > cursor && heap_size(rows[i].address) == rows[i].requested_bytes;
            cursor = rows[i].address;
            rounded += rows[i].rounded_bytes; requested += rows[i].requested_bytes;
            uint32_t kind = rows[i].address == crt_table ? 1 : 0;
            for (unsigned j = 0; j < crt_count; ++j) {
                if (rows[i].address == crt_controls[j]) kind = 2;
                if (rows[i].address == crt_bases[j]) kind = 3;
            }
            if (kind) { ++known_count; known_bytes += rows[i].rounded_bytes; }
            word(i * 16, rows[i].address); word(i * 16 + 4, rows[i].rounded_bytes);
            word(i * 16 + 8, rows[i].requested_bytes); word(i * 16 + 12, kind);
        }
        ok = ok && std::fwrite(bytes.data(), 16, page.count, output) == page.count;
        cursor = page.cursor; count += page.count; ++pages;
        largest_scan = page.scanned > largest_scan ? page.scanned : largest_scan;
        complete = page.complete;
    }
    ok = std::fclose(output) == 0 && ok;
    const auto after = heap_stats();
    const bool heap_same = before.used_bytes == after.used_bytes && before.used_blocks == after.used_blocks &&
        before.req_bytes == after.req_bytes && before.free_bytes == after.free_bytes && before.free_blocks == after.free_blocks &&
        before.total_allocs == after.total_allocs && before.total_frees == after.total_frees;
    const auto elapsed = std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - started).count();
    ok = ok && complete && count == before.used_blocks && rounded == before.used_bytes && requested == before.req_bytes &&
         known_count == crt_count * 2 + 1 && heap_same && clock == rd32(0x0071c6a8) && hooks == mods_hooks_installed_count() && elapsed <= 2000000;
    std::fprintf(stderr, "[streaming] World heap visit=%u stage=%s file=%s records=%u bytes=%u rounded=%llu requested=%llu "
        "known-count=%u known-bytes=%llu pages=%u largest-scan=%u clock=%u hooks=%u world-null=%u complete=%u heap-same=%u clock-same=%u hooks-same=%u "
        "elapsed-us=%llu result=%s\n", visit, stage, name, count, 40 + count * 16,
        (unsigned long long)rounded, (unsigned long long)requested, known_count, (unsigned long long)known_bytes, pages, largest_scan, clock, hooks,
        unsigned(!rd32(0x0071c68c)), unsigned(complete), unsigned(heap_same), unsigned(clock == rd32(0x0071c6a8)),
        unsigned(hooks == mods_hooks_installed_count()), (unsigned long long)elapsed, ok ? "pass" : "fail");
    return ok && residency_owner_capture(visit, stage);
}
bool residency_allocator(unsigned visit, const char *stage) {
    const char *flag = recomp_env("BROWSER_STREAMING_WORLD_ALLOCATOR_FIXTURE");
    if (!flag || std::strcmp(flag, "1")) return true;
    const auto started = std::chrono::steady_clock::now();
    const auto refused = [&](const char *reason, uint32_t a = 0, uint32_t b = 0) {
        std::fprintf(stderr, "[streaming] World allocator refused visit=%u stage=%s reason=%s a=%08x b=%08x\n",
                     visit, stage, reason, a, b);
        return false;
    };
    const auto before = heap_stats(); uint32_t crt_before = 0, crt_after = 0;
    const uint32_t clock = rd32(0x0071c6a8), hooks = mods_hooks_installed_count();
    const uint32_t count = rd32(0x00723a7c), table = rd32(0x00723a80);
    if (!sched_holds_baton() || !residency_survivors_enabled() || rd32(0x00723a8c) != 3 ||
        !stage_pool_live(crt_before) || !count || count > 64 || !gm_valid(table, count * 20)) return refused("table", count, table);
    const uint32_t table_bytes = heap_size(table);
    if (table_bytes == UINT32_MAX || table_bytes < count * 20 || table_bytes > 64 * 20) return refused("table-backing", table, table_bytes);
    uint64_t known_heap_bytes = (table_bytes + 15u) & ~15u;
    uint64_t live_bytes = 0, free_bytes = 0;
    uint32_t live_count = 0, committed = 0, walked = 0;
    std::array<uint32_t, 64> classes{};
    // Original0065545f walks eight4KiB pages per committed32KiB group.
    // Page sentinels are+8/+ffc, blocks start at+c, and matching boundary
    // tags encode16-byte-rounded size plus the low allocated bit. Read
    // headers/footers only; do not follow free lists or inspect payloads.
    for (uint32_t i = 0; i < count; ++i) {
        const uint32_t header = table + i * 20, mask = rd32(header + 8);
        const uint32_t base = rd32(header + 12), control = rd32(header + 16);
        if (!gm_valid(base, 0x100000) || !gm_valid(control, 0x41c4) ||
            heap_size(base) != 0x100000 || heap_size(control) != 0x41c4) return refused("pool-backing", base, control);
        known_heap_bytes += 0x100000 + 0x41d0;
        for (uint32_t group = 0; group < 32; ++group) {
            const uint32_t expected = rd32(control + 0x144 + group * 0x204);
            if (mask & (0x80000000u >> group)) {
                if (expected) return refused("uncommitted-live", group, expected);
                continue;
            }
            if (++committed > 512) return refused("committed-bound", committed);
            uint32_t group_live = 0;
            for (uint32_t page = 0; page < 8; ++page) {
                const uint32_t page_base = base + group * 0x8000 + page * 0x1000;
                const uint32_t end = page_base + 0xffc;
                if (rd32(page_base + 8) != UINT32_MAX || rd32(end) != UINT32_MAX) return refused("sentinel", page_base);
                uint32_t cursor = page_base + 12;
                while (cursor < end) {
                    if (++walked > 600000) return refused("walk-bound", walked);
                    const uint32_t raw = rd32(cursor), size = raw & ~1u;
                    if (size < 16 || (size & 15) || size > 0xff0 || size > end - cursor ||
                        rd32(cursor + size - 4) != raw) return refused("boundary-tag", cursor, raw);
                    if (raw & 1) {
                        if (size > 1024) return refused("live-size", cursor, size);
                        ++classes[size / 16 - 1]; ++group_live; ++live_count; live_bytes += size;
                    } else free_bytes += size;
                    cursor += size;
                }
                if (cursor != end) return refused("page-end", cursor, end);
            }
            if (group_live != expected) return refused("group-count", group_live, expected);
        }
    }
    if (live_count != crt_before || live_bytes + free_bytes != uint64_t(committed) * 8 * 0xff0 ||
        known_heap_bytes > before.used_bytes) return refused("accounting", live_count, crt_before);
    const auto after = heap_stats();
    const bool heap_same = before.used_bytes == after.used_bytes && before.used_blocks == after.used_blocks &&
        before.req_bytes == after.req_bytes && before.free_bytes == after.free_bytes &&
        before.free_blocks == after.free_blocks && before.total_allocs == after.total_allocs && before.total_frees == after.total_frees;
    const bool crt_same = stage_pool_live(crt_after) && crt_before == crt_after;
    const auto elapsed = std::chrono::duration_cast<std::chrono::microseconds>(std::chrono::steady_clock::now() - started).count();
    const bool ok = heap_same && crt_same && clock == rd32(0x0071c6a8) && hooks == mods_hooks_installed_count() && elapsed <= 2000000;
    std::fprintf(stderr, "[streaming] World allocator visit=%u stage=%s pools=%u committed-groups=%u walked=%u "
        "live-count=%u live-bytes=%llu free-bytes=%llu reserved-bytes=%llu known-heap-bytes=%llu "
        "other-heap-bytes=%llu heap-bytes=%llu heap-blocks=%u table-bytes=%u classes=", visit, stage, count, committed, walked,
        live_count, (unsigned long long)live_bytes, (unsigned long long)free_bytes, (unsigned long long)(uint64_t(count) * 0x100000),
        (unsigned long long)known_heap_bytes, (unsigned long long)(before.used_bytes - known_heap_bytes),
        (unsigned long long)before.used_bytes, before.used_blocks, table_bytes);
    for (unsigned i = 0; i < classes.size(); ++i) std::fprintf(stderr, "%s%u", i ? "," : "", classes[i]);
    std::fprintf(stderr, " world-null=%u heap-same=%u crt-same=%u clock-same=%u hooks-same=%u elapsed-us=%llu result=%s\n",
        unsigned(!rd32(0x0071c68c)), unsigned(heap_same), unsigned(crt_same), unsigned(clock == rd32(0x0071c6a8)),
        unsigned(hooks == mods_hooks_installed_count()), (unsigned long long)elapsed, ok ? "pass" : "fail");
    return ok && residency_heap_capture(visit, stage);
}
bool residency_survivors(unsigned visit, const char *stage) {
    if (!residency_survivors_enabled()) return true;
    if (residency.page_context_enabled) for (const auto &entry : residency.page_queues)
        if (entry.buffer) residency_page_queue_sample(entry, stage, visit);
    const auto refused = [&](const char *reason, uint32_t a = 0, uint32_t b = 0, uint32_t d = 0) {
        std::fprintf(stderr, "[streaming] World survivors refused visit=%u stage=%s reason=%s a=%08x b=%08x d=%08x\n",
                     visit, stage, reason, a, b, d);
        return false;
    };
    const auto before = heap_stats(); uint32_t crt_before = 0, crt_after = 0;
    const uint32_t clock = rd32(0x0071c6a8), hooks = mods_hooks_installed_count();
    const uint32_t environment = rd32(0x007218b4);
    if (!sched_holds_baton() || !stage_pool_live(crt_before) || !gm_valid(environment, 0x14)) return refused("environment", environment);
    const uint32_t runtime = rd32(environment + 0x10);
    if (!gm_valid(runtime, 0x38) || rd32(runtime) != 0x0068c02c) return refused("runtime", runtime, gm_valid(runtime, 4) ? rd32(runtime) : 0);
    std::array<uint32_t, 6> managers{};
    constexpr std::array<uint32_t, 6> sizes{0x14, 0x44, 0x3c, 0x20, 0x24, 0xc8};
    constexpr std::array<uint32_t, 5> tables{0x0068c214, 0x0068c3cc, 0x0068bf88, 0x0068c3b4, 0x0068c1f4};
    for (unsigned i = 0; i < 6; ++i) {
        managers[i] = rd32(runtime + 8 + i * 4);
        // Original006289e0 deletes and zeros runtime+c and+10 during
        // script initialization. Preserve absence; do not construct them.
        if ((i == 1 || i == 2) && !managers[i]) continue;
        if (!gm_valid(managers[i], sizes[i]) || (i < 5 && rd32(managers[i]) != tables[i])) return refused("manager", i, managers[i], gm_valid(managers[i], 4) ? rd32(managers[i]) : 0);
    }
    // Constructor-audited size fields. Runtime+c contains four16-byte
    // registry trees (0063ffa0/00641cd0), not four pointer vectors.
    const std::array<uint32_t, 10> trees{
        rd32(managers[0] + 0x10), managers[1] ? rd32(managers[1] + 0x10) : 0,
        managers[1] ? rd32(managers[1] + 0x20) : 0, managers[1] ? rd32(managers[1] + 0x30) : 0,
        managers[1] ? rd32(managers[1] + 0x40) : 0, managers[2] ? rd32(managers[2] + 0x10) : 0,
        managers[2] ? rd32(managers[2] + 0x38) : 0, rd32(managers[3] + 0x10), rd32(managers[4] + 0x10),
        rd32(managers[4] + 0x20)};
    for (uint32_t count : trees) if (count > 100000) return refused("registry-count", count);
    const uint32_t pool = managers[5];
    std::array<uint32_t, 9> free_used{}, free_capacity{};
    uint32_t master_used = 0, master_capacity = 0, total_capacity = 0;
    const auto vector = [&](uint32_t header, uint32_t &used, uint32_t &capacity) {
        const uint32_t begin = rd32(header + 4), end = rd32(header + 8), limit = rd32(header + 12);
        if (!begin) return (end == 0 && limit == 0) || refused("null-vector", header, end, limit);
        if (begin > end || end > limit || (limit - begin) % 4 || (end - begin) % 4 ||
            limit - begin > 1024 * 1024 || !gm_valid(begin, limit - begin)) return refused("vector-layout", begin, end, limit);
        used = (end - begin) / 4; capacity = (limit - begin) / 4;
        total_capacity += limit - begin;
        return total_capacity <= 1024 * 1024 || refused("aggregate-vector-bound", header, total_capacity);
    };
    // 0062a6a0/0062bbb0/0062abf0: master allocated-batch pointer vector,
    // nine reusable-value pointer vectors. Batches contain many values;
    // their count is not a bound on the free-value count. Read headers only; no callbacks,
    // traversals, guest writes, extra hooks or ownership changes.
    if (!vector(pool, master_used, master_capacity)) return false;
    for (unsigned i = 0; i < 9; ++i) {
        if (!vector(pool + 0x10 + 16 * i, free_used[i], free_capacity[i])) return false;
    }
    if (rd32(pool + 0xa0)) return refused("pool-destroying", pool, rd32(pool + 0xa0));
    const auto after = heap_stats();
    const bool ok = stage_pool_live(crt_after) && crt_before == crt_after &&
                    before.used_bytes == after.used_bytes && before.used_blocks == after.used_blocks &&
                    clock == rd32(0x0071c6a8) && hooks == mods_hooks_installed_count();
    std::fprintf(stderr, "[streaming] World survivors visit=%u stage=%s runtime=%08x "
        "managers=%08x,%08x,%08x,%08x,%08x,%08x trees=%u,%u,%u,%u,%u,%u,%u,%u,%u,%u "
        "batch-used=%u batch-cap=%u free-used=%u,%u,%u,%u,%u,%u,%u,%u,%u "
        "free-cap=%u,%u,%u,%u,%u,%u,%u,%u,%u vector-bytes=%u world-null=%u "
        "heap-same=%u crt-same=%u clock-same=%u hooks-same=%u result=%s\n", visit, stage, runtime,
        managers[0], managers[1], managers[2], managers[3], managers[4], managers[5],
        trees[0], trees[1], trees[2], trees[3], trees[4], trees[5], trees[6], trees[7], trees[8], trees[9],
        master_used, master_capacity,
        free_used[0], free_used[1], free_used[2], free_used[3], free_used[4], free_used[5], free_used[6], free_used[7], free_used[8],
        free_capacity[0], free_capacity[1], free_capacity[2], free_capacity[3], free_capacity[4], free_capacity[5], free_capacity[6], free_capacity[7], free_capacity[8],
        total_capacity, unsigned(!rd32(0x0071c68c)),
        unsigned(before.used_bytes == after.used_bytes && before.used_blocks == after.used_blocks),
        unsigned(crt_before == crt_after), unsigned(clock == rd32(0x0071c6a8)),
        unsigned(hooks == mods_hooks_installed_count()), ok ? "pass" : "fail");
    return ok;
}
void residency_phase(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    auto &s = residency;
    const uint32_t state = rd32(0x006d7670), phase = rd32(state);
    const uint32_t requested = gm_valid(cpu->esp + 4, 4) ? rd32(cpu->esp + 4) : UINT32_MAX;
    const bool sampled = cpu->ecx == state && s.phase_samples < 32;
    const auto result = mods_call_next(api, inv, cpu);
    if (sampled) {
        ++s.phase_samples;
        std::fprintf(stderr, "[streaming] World residency phase before=%u request=%u after=%u pending=%u result=%d\n",
            phase, requested, rd32(state), rd32(state + 4), int(result));
    }
}
bool residency_enabled() {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_WORLD_RESIDENCY_FIXTURE");
    return flag && !std::strcmp(flag, "1") && isolated_fixture();
#endif
}
bool residency_copy_file(const char *name, const char *destination) {
    char from[1024], to[1024];
    if (!recomp_writable_path(name, from, sizeof from) ||
        !recomp_writable_path(destination, to, sizeof to))
        return false;
    FILE *input = std::fopen(from, "rb"), *output = input ? std::fopen(to, "wb") : nullptr;
    bool ok = input && output;
    std::array<uint8_t, 4096> bytes{};
    size_t total = 0;
    while (ok) {
        const size_t n = std::fread(bytes.data(), 1, bytes.size(), input);
        total += n;
        ok = total <= 2 * 1024 * 1024 && std::fwrite(bytes.data(), 1, n, output) == n;
        if (n < bytes.size()) { ok = ok && std::feof(input) && !std::ferror(input); break; }
    }
    if (input) ok = std::fclose(input) == 0 && ok;
    if (output) ok = std::fclose(output) == 0 && ok;
    return ok && total != 0;
}
bool residency_copy(unsigned side) {
    if (residency_coordinate_requests()) {
        if (residency_coordinate_checkpoints()) {
            std::string selected;
            return residency_coordinate_selected(residency.coordinate_target_x, residency.coordinate_target_y, selected) &&
                residency_copy_file(selected.c_str(), "Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP");
        }
        char name[96];
        return residency_coordinate_filename(name, sizeof name, residency.coordinate_target_x, residency.coordinate_target_y) &&
            residency_copy_file(name, "Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP");
    }
    return residency_copy_file(side ? "Residency_Source_1.GMP" : "Residency_Source_0.GMP",
        "Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP");
}
bool residency_saved_rng(uint32_t &seed, uint32_t &game_seed) {
    char path[1024];
    if (!recomp_writable_path("Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP", path, sizeof path))
        return false;
    FILE *input = std::fopen(path, "rb");
    if (!input) return false;
    bool ok = !std::fseek(input, 0, SEEK_END);
    const long length = ok ? std::ftell(input) : -1;
    ok = ok && length >= 272 && length <= 2 * 1024 * 1024 && !std::fseek(input, 0, SEEK_SET);
    std::array<uint8_t, 1024> bytes{};
    const auto word = [&](unsigned at) {
        return uint32_t(bytes[at]) | uint32_t(bytes[at + 1]) << 8 |
               uint32_t(bytes[at + 2]) << 16 | uint32_t(bytes[at + 3]) << 24;
    };
    long at = 0; unsigned chunks = 0, found = 0, found_game = 0;
    while (ok && at < length) {
        ok = ++chunks <= 128 && length - at >= 16 &&
             std::fread(bytes.data(), 1, 16, input) == 16;
        if (!ok) break;
        const uint32_t size = word(4), version = word(8), count = word(12);
        ok = size <= uint32_t(length - at - 16);
        if (chunks == 1)
            ok = ok && !std::memcmp(bytes.data(), "VERS", 4) && size == 256 && version == 1 && !count;
        if (!ok) break;
        const long end = at + 16 + size;
        if (!std::memcmp(bytes.data(), "SVGD", 4)) {
            ok = !found_game++ && version == 10 && !count && size <= bytes.size() && size >= 33 &&
                 std::fread(bytes.data(), 1, size, input) == size;
            if (ok) {
                unsigned cursor = 0;
                for (unsigned string = 0; string < 2 && ok; ++string) {
                    const unsigned start = cursor;
                    while (cursor < size && cursor - start < 128 && bytes[cursor]) ++cursor;
                    ok = cursor > start && cursor < size && cursor - start < 128;
                    ++cursor;
                }
                // SVGD v10 reader00436770: two strings, clock DWORD,
                // calendar16, +34/+38 DWORDs, then saved gameplay RNG(+6c).
                ok = ok && cursor + 32 <= size;
                if (ok) { game_seed = word(cursor + 28); ok = game_seed != 0; }
            }
        }
        if (!std::memcmp(bytes.data(), "GPL ", 4)) {
            ok = !found++ && size >= 40 && version == 1 && !count &&
                 std::fread(bytes.data(), 1, 12, input) == 12 && word(0) == size && word(4) == 3;
            if (ok) {
                seed = word(8);
                ok = seed && !std::fseek(input, end - 8, SEEK_SET) &&
                     std::fread(bytes.data(), 1, 8, input) == 8 && !word(0) && word(4) == UINT32_MAX;
            }
        }
        ok = ok && !std::fseek(input, end, SEEK_SET);
        at = end;
    }
    ok = ok && at == length && found == 1 && found_game == 1 && !std::ferror(input);
    return std::fclose(input) == 0 && ok;
}
bool residency_restore_rng(X86 *c, unsigned visit) {
    uint32_t seed = 0, game_seed = 0;
    if (!residency_saved_rng(seed, game_seed) || c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
        return false;
    X86 extra = *c; extra.r[R_ESP] -= 32768;
    const uint32_t runtime = guest_call(&extra, 0x00623b20);
    if (!gm_valid(runtime, 0x38) || rd32(runtime) != 0x0068c02c) return false;
    const uint32_t before = rd32(runtime + 0x24), clock = rd32(0x0071c6a8);
    const auto hooks = mods_hooks_installed_count();
    const uint32_t game_rng = guest_call(&extra, 0x00601760);
    if (!gm_valid(game_rng, 8) || game_rng != 0x0071fc70) return false;
    const uint32_t game_before = rd32(game_rng + 4);
    extra.r[R_ECX] = game_rng;
    guest_call(&extra, 0x004f6710, game_seed);
    // 00623900 restores GPL v3 seed through 004f6710, then solo world
    // initialization at 00499344 reseeds it through 00623720. Resume from
    // the saved state after attachment using that same original setter.
    // Zero invokes a wall-clock seed in the original setter: refuse it.
    extra.r[R_ECX] = runtime;
    guest_call(&extra, 0x00623720, seed);
    const bool ok = rd32(game_rng) == game_seed && rd32(game_rng + 4) == game_seed &&
                    rd32(runtime + 0x20) == seed && rd32(runtime + 0x24) == seed &&
                    rd32(0x0071c6a8) == clock && mods_hooks_installed_count() == hooks;
    std::fprintf(stderr, "[streaming] World persistence rng visit=%u saved=%u before=%u after=%u "
        "clock-same=%u hooks-same=%u original-setter=00623720 result=%s\n", visit, seed, before,
        rd32(runtime + 0x24), unsigned(rd32(0x0071c6a8) == clock),
        unsigned(mods_hooks_installed_count() == hooks), ok ? "pass" : "fail");
    std::fprintf(stderr, "[streaming] World persistence gameplay-rng visit=%u saved=%u before=%u after=%u "
        "clock-same=%u hooks-same=%u original-setter=004f6710 result=%s\n", visit, game_seed,
        game_before, rd32(game_rng + 4), unsigned(rd32(0x0071c6a8) == clock),
        unsigned(mods_hooks_installed_count() == hooks), ok ? "pass" : "fail");
    return ok;
}
bool residency_snapshot(X86 *c, unsigned visit, bool after) {
    if (visit >= residency_visit_limit() || mods_hook_depth() || !sched_holds_baton()) return false;
    const uint32_t clock = rd32(0x0071c6a8);
    const auto hooks = mods_hooks_installed_count();
    const char *saved = after ? "Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP"
                             : "Documents/My Games/MajestyHD/SaveGame/Joint_Departed_Reload.GMP";
    const bool wrote = after ? majesty_browser_frontier_joint_evolved_checkpoint(c)
                             : majesty_browser_frontier_joint_departed_reload_checkpoint(c);
    char target[96], source_path[1024];
    std::snprintf(target, sizeof target, "Residency_Visit_%u_%s.GMP", visit, after ? "After" : "Before");
    bool ok = wrote && residency_copy_file(saved, target) &&
              recomp_writable_path(saved, source_path, sizeof source_path) && !std::remove(source_path);
    if (ok && after) {
        const unsigned side = residency_side(visit);
        char coordinate_name[96];
        if (residency_coordinate_requests() && !residency_coordinate_filename(coordinate_name, sizeof coordinate_name,
            residency.coordinate_x, residency.coordinate_y)) return false;
        if (residency_coordinate_checkpoints()) {
            std::string manifest, content; std::array<std::string, 2> names{}, paths{};
            ok = residency_coordinate_store(residency.coordinate_x, residency.coordinate_y, manifest, names, paths, content);
            if (ok) {
                CheckpointStore store(manifest, paths, content);
                ok = store.commit([&](int slot) { return residency_copy_file(target, names[slot].c_str()); });
                const auto record = store.read();
                ok = ok && record.status == CheckpointStore::Status::valid;
                std::fprintf(stderr, "[streaming] World coordinate-checkpoint visit=%u region=%d_%d slot=%d bytes=%llu digest=%s published=%u result=%s\n",
                    visit, residency.coordinate_x, residency.coordinate_y, record.slot,
                    (unsigned long long)record.size, record.digest.c_str(), unsigned(ok), ok ? "pass" : "fail");
            }
        } else {
        const char *current = residency_coordinate_requests() ? coordinate_name : side ? "Residency_Source_1.GMP" : "Residency_Source_0.GMP";
        char temporary_path[1024], current_path[1024];
        ok = residency_copy_file(target, "Residency_Latest.tmp") &&
             recomp_writable_path("Residency_Latest.tmp", temporary_path, sizeof temporary_path) &&
             recomp_writable_path(current, current_path, sizeof current_path) &&
             !std::rename(temporary_path, current_path);
        }
    }
    win32_invalidate_dir_cache();
    ok = ok && rd32(0x0071c6a8) == clock && mods_hooks_installed_count() == hooks;
    if (residency_coordinate_requests()) std::fprintf(stderr,
        "[streaming] World coordinate-snapshot visit=%u region=%d_%d stage=%s clock=%u latest-published=%u result=%s\n",
        visit, residency.coordinate_x, residency.coordinate_y, after ? "after" : "before", clock, unsigned(after && ok), ok ? "pass" : "fail");
    std::fprintf(stderr, "[streaming] World persistence snapshot visit=%u side=%u stage=%s clock=%u saved=%u "
        "state-clock-same=%u hooks-same=%u latest-published=%u copy-bound=4096 result=%s\n", visit,
        residency_side(visit), after ? "after" : "before", clock, unsigned(wrote),
        unsigned(rd32(0x0071c6a8) == clock), unsigned(mods_hooks_installed_count() == hooks),
        unsigned(after && ok), ok ? "pass" : "fail");
    return ok;
}
void residency_free(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    auto &s = residency;
    const uint32_t pointer = gm_valid(cpu->esp + 4, 4) ? rd32(cpu->esp + 4) : 0;
    const bool tracked = s.tracking;
    const bool allocation = s.allocation_hook && pointer && heap_size(pointer) == 12208;
    const bool page_allocation = s.pages_enabled && pointer && heap_size(pointer) == 4096;
    if (s.page_context_enabled) for (const auto &entry : s.page_queues)
        if (entry.buffer && pointer && (entry.queue == pointer || entry.parent == pointer))
            residency_page_queue_sample(entry, entry.queue == pointer ? "before-queue-free" : "before-parent-free", s.exits);
    if (tracked) ++s.free_calls;
    const auto result = mods_call_next(api, inv, cpu);
    if (s.page_context_enabled && pointer && result == POP_OK) for (auto &entry : s.page_queues) {
        if (entry.queue == pointer) entry.queue_freed = true;
        if (entry.parent == pointer) entry.parent_freed = true;
        if (entry.buffer == pointer) entry = {};
    }
    if (page_allocation) {
        if (result != POP_OK || heap_owns(pointer) || ++s.page_events > 1024) std::abort();
        std::fprintf(stderr, "[streaming] World page event=%u op=free address=%08x loads=%u "
            "exits=%u clock=%u freed=1 result=pass\n", s.page_events, pointer, s.loads, s.exits, rd32(0x0071c6a8));
    }
    if (allocation) {
        const bool freed = result == POP_OK && !heap_owns(pointer);
        if (++s.allocation_events > 1024) std::abort();
        std::fprintf(stderr, "[streaming] World allocation event=%u op=free address=%08x "
            "loads=%u exits=%u clock=%u freed=%u result=%s\n", s.allocation_events, pointer,
            s.loads, s.exits, rd32(0x0071c6a8), unsigned(freed), freed ? "pass" : "fail");
        if (!freed) std::abort();
        if (s.owner_enabled) for (auto &entry : s.buffer_owners) if (entry.buffer == pointer) entry = {};
    }
    if (tracked) {
        if (result != POP_OK) std::abort();
        for (size_t i = 0; i < s.roots.size(); ++i)
            if (pointer && pointer == s.roots[i]) ++s.freed[i];
    }
}
void residency_exit(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    auto &s = residency;
    const uint32_t state = rd32(0x006d7670);
    if (!s.requested || s.tracking || s.exits >= residency_visit_limit() || cpu->ecx != state ||
        rd32(state) != 4 || rd32(0x0071c68c) != s.roots[0]) std::abort();
    if (residency_persistence()) {
        const bool boundary = rd32(0x0071c6a8) == s.saved_clock && rd32(state + 0x28) == s.saved_tick;
        std::fprintf(stderr, "[streaming] World checkpoint exit visit=%u clock=%u tick=%u "
            "saved-clock=%u saved-tick=%u result=%s\n", s.exits, rd32(0x0071c6a8),
            rd32(state + 0x28), s.saved_clock, s.saved_tick, boundary ? "pass" : "fail");
        if (!boundary) std::abort();
    }
    if (!residency_survivors(s.exits, "before-exit") || !residency_allocator(s.exits, "before-exit")) std::abort();
    const auto before = heap_stats();
    uint32_t crt_before = 0, crt_after = 0;
    if (!stage_pool_live(crt_before) || !heap_check().empty()) std::abort();
    s.tracking = true; s.freed.fill(0); s.free_calls = 0;
    const auto result = mods_call_next(api, inv, cpu);
    s.tracking = false;
    const auto after = heap_stats();
    bool roots_freed = true;
    for (uint32_t n : s.freed) roots_freed = roots_freed && n == 1;
    const bool ok = result == POP_OK && !rd32(0x0071c68c) && stage_pool_live(crt_after) &&
                    crt_after < crt_before && after.used_bytes < before.used_bytes &&
                    roots_freed && heap_check().empty() &&
                    mods_hooks_installed_count() == s.hooks_before + (s.allocation_hook ? 4u : 3u);
    std::fprintf(stderr, "[streaming] World residency exit=%u extent=%u phase=%u pending=%u "
        "world-null=%u roots-freed=%u,%u,%u,%u,%u,%u free-calls=%u "
        "heap-before=%llu heap-after=%llu blocks-before=%u blocks-after=%u "
        "crt-before=%u crt-after=%u heap-valid=%u hooks-same=%u result=%s\n",
        s.exits, s.extent, rd32(state), rd32(state + 4), unsigned(!rd32(0x0071c68c)),
        s.freed[0], s.freed[1], s.freed[2], s.freed[3], s.freed[4], s.freed[5], s.free_calls,
        (unsigned long long)before.used_bytes, (unsigned long long)after.used_bytes,
        before.used_blocks, after.used_blocks, crt_before, crt_after, unsigned(heap_check().empty()),
        unsigned(mods_hooks_installed_count() == s.hooks_before + (s.allocation_hook ? 4u : 3u)), ok ? "pass" : "fail");
    if (!ok || !residency_survivors(s.exits, "after-exit") || !residency_allocator(s.exits, "after-exit")) std::abort();
    ++s.exits; s.requested = false;
    if (s.exits < residency_visit_limit()) {
        if (!s.generate_target && !residency_copy(residency_side(s.exits))) std::abort();
        if (residency_coordinate_requests()) {
            s.coordinate_x = s.coordinate_target_x; s.coordinate_y = s.coordinate_target_y;
            std::fprintf(stderr, "[streaming] World coordinate-activation visit=%u region=%d_%d roots-freed=6 saved-before-switch=1 result=pass\n",
                s.exits, s.coordinate_x, s.coordinate_y);
        }
    }
}
void residency_loaded(X86 *c) {
    if (!residency_enabled()) return;
    connected_transform_observers_end();
    auto &s = residency;
    if (!sched_holds_baton() || mods_hook_depth() || s.requested || s.loads != s.exits || s.loads >= residency_visit_limit()) {
        std::fprintf(stderr, "[streaming] World residency setup ownership refused baton=%u depth=%u loads=%u exits=%u\n", unsigned(sched_holds_baton()), mods_hook_depth(), s.loads, s.exits);
        std::abort();
    }
    if (!s.exit_hook) {
        s.hooks_before = mods_hooks_installed_count();
        const auto exit_result = mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x004170a0, 0, residency_exit, POP_HOOK_WRAP,
            POP_HOOK_NO_GAME_VIEW, nullptr, &s.exit_hook);
        const auto free_result = mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x0064d4b6, 0, residency_free, POP_HOOK_WRAP,
            POP_HOOK_NO_GAME_VIEW, nullptr, &s.free_hook);
        const auto phase_result = mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00416050, 0, residency_phase, POP_HOOK_WRAP,
            POP_HOOK_NO_GAME_VIEW, nullptr, &s.phase_hook);
        if (exit_result != POP_OK || free_result != POP_OK || phase_result != POP_OK) {
            std::fprintf(stderr, "[streaming] World residency setup hooks refused exit=%d free=%d phase=%d\n", int(exit_result), int(free_result), int(phase_result));
            std::abort();
        }
        if (residency_allocation_enabled()) {
            const char *owners = recomp_env("BROWSER_STREAMING_WORLD_OWNER_FIXTURE");
            s.owner_enabled = owners && !std::strcmp(owners, "1");
            const char *pages = recomp_env("BROWSER_STREAMING_WORLD_PAGE_FIXTURE");
            s.pages_enabled = pages && !std::strcmp(pages, "1");
            const char *page_context = recomp_env("BROWSER_STREAMING_WORLD_PAGE_CONTEXT_FIXTURE");
            s.page_context_enabled = s.pages_enabled && page_context && !std::strcmp(page_context, "1");
            const auto allocation_result = mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x0064d5dd, 0,
                residency_allocation, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &s.allocation_hook);
            std::fprintf(stderr, "[streaming] World allocation observer target=0064d5dd "
                "heap-requested=12208 event-limit=1024 installed=%u result=%s\n",
                unsigned(allocation_result == POP_OK), allocation_result == POP_OK ? "pass" : "fail");
            if (allocation_result != POP_OK) std::abort();
            if (s.pages_enabled) std::fprintf(stderr, "[streaming] World page observer target=0064d5dd "
                "heap-requested=4096 event-limit=1024 installed=1 result=pass\n");
        }
    }
    const uint32_t world = rd32(0x0071c68c);
    if (!gm_valid(world, 0x20) || rd32(world) != 0x0067f85c) {
        std::fprintf(stderr, "[streaming] World residency setup world refused address=%08x table=%08x\n", world, gm_valid(world, 4) ? rd32(world) : 0);
        std::abort();
    }
    const uint32_t factory = rd32(world + 0x10);
    if (!gm_valid(factory, 0x8c)) { std::fprintf(stderr, "[streaming] World residency setup factory refused\n"); std::abort(); }
    const uint32_t terrain = rd32(factory + 0x80), grid = rd32(factory + 0x88);
    if (!gm_valid(terrain, 0x38) || !gm_valid(grid, 0x50)) { std::fprintf(stderr, "[streaming] World residency setup terrain/grid refused\n"); std::abort(); }
    s.extent = rd32(grid + 0x48);
    const uint32_t expected_extent = connected_residency() ? 256u : (s.loads % 2 ? 512u : 256u);
    if (s.extent != expected_extent || rd32(grid + 0x4c) != s.extent ||
        !gm_valid(rd32(grid + 0x14), s.extent * s.extent * 4) ||
        !gm_valid(rd32(grid + 0x18), s.extent * s.extent * 4)) {
        std::fprintf(stderr, "[streaming] World residency setup dimensions refused extent=%u height=%u search=%08x entries=%08x\n", s.extent, rd32(grid + 0x4c), rd32(grid + 0x14), rd32(grid + 0x18));
        std::abort();
    }
    if (connected_residency() &&
        (!gm_valid(terrain, 0x54) || rd32(terrain + 0x30) != 128 ||
         rd32(terrain + 0x34) != 128 || rd32(terrain + 0x38) != 129 ||
         rd32(terrain + 0x3c) != 129 ||
         !gm_valid(rd32(terrain + 0x48), 128u * 128u * 8u) ||
         !gm_valid(rd32(terrain + 0x4c), 129u * 129u * 24u))) std::abort();
    s.roots = {world, factory, terrain, grid, rd32(grid + 0x14), rd32(grid + 0x18)};
    s.ticks = 0; s.last_tick = UINT32_MAX;
    uint32_t crt = 0; NativeRegistrySnapshot members{};
    if (!stage_pool_live(crt) || !native_registry_snapshot(factory, members) || !heap_check().empty()) { std::fprintf(stderr, "[streaming] World residency setup allocator/registry refused\n"); std::abort(); }
    uint32_t units = 0; for (uint32_t i = 0; i < members.count; ++i) units += members.groups[i].list_count;
    const auto heap = heap_stats();
    std::fprintf(stderr, "[streaming] World residency load=%u extent=%u registry-entries=%u "
        "world=%08x factory=%08x terrain=%08x grid=%08x search=%08x entries=%08x "
        "heap=%llu blocks=%u crt=%u hooks=%u result=pass\n", s.loads, s.extent, units,
        s.roots[0], s.roots[1], s.roots[2], s.roots[3], s.roots[4], s.roots[5],
        (unsigned long long)heap.used_bytes, heap.used_blocks, crt, mods_hooks_installed_count());
    if (residency_persistence() &&
        ((!s.fresh_generated && !residency_restore_rng(c, s.loads)) || !residency_snapshot(c, s.loads, false))) std::abort();
    if (!residency_survivors(s.loads, "load") || !residency_allocator(s.loads, "load")) std::abort();
    if (!residency_travel_ready()) std::abort();
    ++s.loads;
}
void residency_tick(X86 *c) {
    if (!residency_enabled() || !residency.loads || residency.requested || residency.loads == residency.exits) return;
    auto &s = residency;
    // Fresh generated regions attach and publish without a gameplay update.
    // The tick wrapper requests original dispatcher teardown instead below.
    if (connected_initialization() && s.loads <= 2) return;
    const uint32_t state = rd32(0x006d7670);
    if (!gm_valid(state, 0x50) || rd32(state) != 3 || rd32(0x0071c68c) != s.roots[0] ||
        !sched_holds_baton() || mods_hook_depth()) std::abort();
    const uint32_t tick = rd32(state + 0x28);
    if (tick == s.last_tick) return;
    s.last_tick = tick;
    if (!s.ticks) std::fprintf(stderr, "[streaming] World residency first-tick load=%u tick=%u phase=%u pending=%u\n", s.loads - 1, tick, rd32(state), rd32(state + 4));
    ++s.ticks;
    // Persistent worlds are saved by the post-original callback. Counting at
    // entry keeps the first-tick observation before any simulation updates.
    if (residency_persistence() || s.ticks < 20u) return;
    X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = state;
    // Original phase request sets pending4 from gameplay3; the next original
    // dispatcher iteration owns teardown after this entire tick returns.
    guest_call(&extra, 0x00416050, 1u);
    if (rd32(state) != 3 || rd32(state + 4) != 4) std::abort();
    s.requested = true;
    std::fprintf(stderr, "[streaming] World residency request=%u observed-ticks=%u pending=4 result=pass\n", s.exits, s.ticks);
}
} // namespace
extern "C" void majesty_browser_streaming_world_idle(X86 *c) {
#ifndef __EMSCRIPTEN__
    const char *flag = recomp_env("BROWSER_STREAMING_IDLE_TILE_RELEASE_FIXTURE");
    if (!flag || std::strcmp(flag, "v2")) return;
    static unsigned completed_exits = 0;
    const auto &s = residency;
    if (s.exits == completed_exits) return;
    const uint32_t state = rd32(0x006d7670);
    if (!gm_valid(state, 0x50) || rd32(state) != 1 || rd32(0x0071c68c) ||
        s.requested || s.loads != s.exits || s.exits != completed_exits + 1 ||
        rd32(0x0071c6a8) != s.saved_clock || mods_hook_depth() || !sched_holds_baton()) std::abort();
    if (!residency_release_idle_tiles(c, s.exits - 1, true) || rd32(0x0071c68c)) std::abort();
    completed_exits = s.exits;
#endif
}
extern "C" bool majesty_browser_streaming_world_auto_load(X86 *c) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_AUTO_REGION_LOAD_FIXTURE");
    if (!flag) return false;
    const char *registered = recomp_env("BROWSER_STREAMING_REGISTERED_HERO_RESIDENCY_FIXTURE");
    if (std::strcmp(flag, "v1") || !connected_residency() || connected_initialization() ||
        !registered || std::strcmp(registered, "v1") ||
        recomp_env("BROWSER_STREAMING_IDLE_TILE_RELEASE_FIXTURE")) std::abort();
    auto &s = residency;
    if (s.exits == residency_visit_limit()) return false;
    const uint32_t state = rd32(0x006d7670), clock = rd32(0x0071c6a8);
    static uint32_t accepted = 0;
    if (!gm_valid(state, 0x50) || rd32(state) != 1 || rd32(state + 0xc) != c->r[R_ECX] ||
        rd32(0x0071c68c) || s.requested || s.tracking || s.loads != s.exits || accepted != s.exits ||
        mods_hook_depth() || !sched_holds_baton() || (s.exits && clock != s.saved_clock)) std::abort();
    const uint32_t hooks = mods_hooks_installed_count();
    std::fprintf(stderr, "[streaming] World auto-load begin visit=%u side=%u phase=%u pending=%u world-null=1 "
        "loads=%u exits=%u accepted=%u clock=%u hook-depth=0 baton=1 result=pass\n",
        s.exits, residency_side(s.exits), rd32(state), rd32(state + 4), s.loads, s.exits, accepted, clock);
    // Initial fixture and each original exit publish exactly the next source
    // as Joint_Reload. The original named loader owns all guest graph rebuilds.
    bool restored = false;
    s.fresh_generated = residency_expansion() && s.generate_target;
    if (residency_expansion() && !majesty_browser_frontier_residency_region(c,
        s.coordinate_x, s.coordinate_y, s.fresh_generated)) std::abort();
    if (s.fresh_generated) restored = true;
    else restored = majesty_browser_frontier_residency_restore(c);
    s.generate_target = false;
    const uint32_t world = rd32(0x0071c68c);
    const bool ok = restored && rd32(state) == 1 && rd32(state + 4) == 2 &&
        gm_valid(world, 0x20) && rd32(world) == 0x0067f85c && mods_hooks_installed_count() == hooks &&
        s.loads == s.exits && !s.requested && !s.tracking;
    if (ok) ++accepted;
    std::fprintf(stderr, "[streaming] World auto-load attached visit=%u side=%u phase=%u pending=%u world=%08x "
        "accepted=%u hooks-same=%u original-attach=00415f30 menu-skipped=1 result=%s\n", s.exits,
        residency_side(s.exits), rd32(state), rd32(state + 4), world, accepted,
        unsigned(mods_hooks_installed_count() == hooks), ok ? "pass" : "fail");
    if (!ok) std::abort();
    return true;
#endif
}
extern "C" bool majesty_browser_streaming_world_initialization_exit(X86 *c) {
    if (!connected_initialization()) return false;
    auto &s = residency;
    if (!s.loads || s.loads > 2 || s.loads == s.exits) return false;
    const uint32_t state = rd32(0x006d7670);
    if (s.requested || s.ticks || s.last_tick != UINT32_MAX || !gm_valid(state, 0x50) ||
        rd32(state) != 3 || rd32(state + 4) || rd32(0x0071c68c) != s.roots[0] ||
        !sched_holds_baton() || mods_hook_depth() || c->r[R_ESP] < STACK_LIMIT + 65536 ||
        c->r[R_ESP] > STACK_TOP) std::abort();
    // Both full original saves run at the same pre-tick attachment boundary.
    // No selection/fog field is forced; their initial loader changes remain
    // observable. The staged generated save is retained separately by runner.
    if (!residency_snapshot(c, s.loads - 1, true)) std::abort();
    s.saved_clock = rd32(0x0071c6a8); s.saved_tick = rd32(state + 0x28);
    std::fprintf(stderr, "[streaming] World checkpoint initialized visit=%u clock=%u tick=%u "
        "completed-ticks=0 original-tick-skipped=1 hook-depth=%u baton=%u result=pass\n",
        s.exits, s.saved_clock, s.saved_tick, mods_hook_depth(), unsigned(sched_holds_baton()));
    X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = state;
    guest_call(&extra, 0x00416050, 1u);
    if (rd32(state) != 3 || rd32(state + 4) != 4 || rd32(0x0071c6a8) != s.saved_clock ||
        rd32(state + 0x28) != s.saved_tick) std::abort();
    s.requested = true;
    std::fprintf(stderr, "[streaming] World residency request=%u observed-ticks=0 pending=4 result=pass\n", s.exits);
    return true;
}
namespace {
bool residency_orphan_queue_release_enabled() {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag = recomp_env("BROWSER_STREAMING_ORPHAN_QUEUE_RELEASE_FIXTURE");
    if (!flag) return false;
    if (std::strcmp(flag, "v1") || !connected_residency() || connected_initialization() ||
        !residency.pages_enabled || !residency.page_context_enabled ||
        recomp_env("BROWSER_STREAMING_IDLE_TILE_RELEASE_FIXTURE")) std::abort();
    return true;
#endif
}
bool residency_retire_orphan_queues(X86 *c) {
    auto &s = residency;
    const uint32_t world = rd32(0x0071c68c), clock = rd32(0x0071c6a8);
    const uint32_t hooks = mods_hooks_installed_count(), state = rd32(0x006d7670);
    if (!residency_orphan_queue_release_enabled() || !world || world != s.roots[0] || s.requested ||
        s.loads != s.exits + 1 || !residency_travel_tick_count(s.ticks) || !gm_valid(state, 0x50) || rd32(state) != 3 ||
        rd32(state + 4) || mods_hook_depth() || !sched_holds_baton()) return false;
    unsigned observed = 0, retained = 0, eligible = 0, released = 0;
    for (const auto &slot : s.page_queues) {
        if (!slot.buffer) continue;
        const auto entry = slot; // Original free hooks clear this fixed slot.
        ++observed;
        PageRegistration before;
        if (!residency_page_registration(entry, before)) return false;
        if (before.queue_references || rd32(entry.parent + 0x5c) == entry.queue) { ++retained; continue; }
        uint32_t map = 0, front = 0, message = 0, vtable = 0, message_bytes = 0, nested = 0;
        bool admitted = entry.allocation_load && entry.allocation_load < s.loads && !entry.queue_freed &&
            !entry.parent_freed && residency_crt_payload_size(entry.queue) == 56 && heap_size(entry.buffer) == 4096;
        if (admitted) {
            map = rd32(entry.queue + 0x24); front = rd32(entry.queue + 0xc);
            admitted = residency_crt_payload_size(map) == 8 && gm_valid(map, 8) &&
                rd32(entry.queue + 0x28) == 2 && rd32(entry.queue + 0x2c) == 1 &&
                rd32(entry.queue + 0x10) == map + 4 && rd32(entry.queue + 0x20) == map + 4 &&
                rd32(map + 4) == entry.buffer && rd32(entry.queue + 4) == entry.buffer &&
                rd32(entry.queue + 8) == entry.buffer + 4096 && rd32(entry.queue + 0x14) == entry.buffer &&
                rd32(entry.queue + 0x18) == entry.buffer + 4096 && front >= entry.buffer &&
                front - entry.buffer <= 4088 && rd32(entry.queue + 0x1c) == front + 8 && gm_valid(front, 8);
        }
        if (admitted) {
            message = rd32(front); message_bytes = residency_crt_payload_size(message);
            vtable = gm_valid(message, 4) ? rd32(message) : 0;
            admitted = message_bytes == 40 && gm_valid(message, 28) && vtable == 0x00682d04 &&
                rd32(message + 0x10) == entry.recipient;
            if (admitted) {
                nested = rd32(message + 8);
                admitted = residency_crt_payload_size(nested) == 56 && gm_valid(nested, 48) && rd32(nested + 0x2c) <= 128;
            }
        }
        std::fprintf(stderr, "[streaming] World queue-release candidate visit=%u event=%u queue=%08x buffer=%08x "
            "parent=%08x recipient=%u allocation-load=%u current-load=%u registered=%u default-match=0 "
            "map=%08x front=%08x message=%08x vtable=%08x message-bytes=%u nested=%08x admitted=%u result=pass\n",
            s.loads - 1, entry.event, entry.queue, entry.buffer, entry.parent, entry.recipient,
            entry.allocation_load, s.loads, before.queue_references, map, front, message, vtable, message_bytes,
            nested, unsigned(admitted));
        if (!admitted) continue;
        ++eligible;
        const auto heap_before = heap_stats();
        const uint32_t default_queue = rd32(entry.parent + 0x5c);
        X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = entry.queue;
        // Original destructor consumes reference wrappers and invokes original
        // message destructors; it owns buffer/map release. Delete only the
        // exact observed descriptor after successful original draining.
        guest_call(&extra, 0x00497cf0);
        bool empty = !rd32(entry.queue + 0x2c);
        for (unsigned offset = 4; offset <= 0x20; offset += 4) empty = empty && !rd32(entry.queue + offset);
        const bool storage_freed = !heap_owns(entry.buffer) && !residency_crt_payload_size(map);
        if (!empty || !storage_freed || residency_crt_payload_size(entry.queue) != 56) return false;
        guest_call(&extra, 0x00645bc0, entry.queue);
        PageRegistration after;
        const bool tree_same = residency_page_registration(entry, after) && before.head == after.head &&
            before.leaf == after.leaf && before.root == after.root && before.count == after.count &&
            before.walked == after.walked && !std::memcmp(before.nodes.data(), after.nodes.data(), before.walked * sizeof(PageRegistration::Node)) &&
            rd32(entry.parent + 0x5c) == default_queue;
        const auto heap_after = heap_stats();
        const bool ok = !residency_crt_payload_size(entry.queue) && tree_same &&
            rd32(0x0071c68c) == world && rd32(0x0071c6a8) == clock && mods_hooks_installed_count() == hooks &&
            rd32(state) == 3 && !rd32(state + 4) && heap_after.req_bytes < heap_before.req_bytes && heap_check().empty();
        std::fprintf(stderr, "[streaming] World queue-release retired visit=%u event=%u queue=%08x buffer=%08x "
            "original-destructor=00497cf0 original-delete=00645bc0 empty=%u buffer-freed=%u map-freed=%u "
            "descriptor-freed=%u tree-same=%u clock-same=%u world-same=%u hooks-same=%u requested-before=%llu "
            "requested-after=%llu result=%s\n", s.loads - 1, entry.event, entry.queue, entry.buffer, unsigned(empty),
            unsigned(!heap_owns(entry.buffer)), unsigned(!residency_crt_payload_size(map)),
            unsigned(!residency_crt_payload_size(entry.queue)), unsigned(tree_same), unsigned(rd32(0x0071c6a8) == clock),
            unsigned(rd32(0x0071c68c) == world), unsigned(mods_hooks_installed_count() == hooks),
            (unsigned long long)heap_before.req_bytes, (unsigned long long)heap_after.req_bytes, ok ? "pass" : "fail");
        if (!ok) return false;
        ++released;
    }
    std::fprintf(stderr, "[streaming] World queue-release sweep visit=%u observed=%u retained=%u eligible=%u released=%u "
        "clock=%u hook-depth=%u baton=%u result=pass\n", s.loads - 1, observed, retained, eligible, released,
        clock, mods_hook_depth(), unsigned(sched_holds_baton()));
    return released == eligible && rd32(0x0071c68c) == world && rd32(0x0071c6a8) == clock;
}
}
extern "C" void majesty_browser_streaming_world_completed_tick(X86 *c) {
    if (!residency_enabled() || !residency_persistence() || !residency.loads ||
        residency.requested || residency.loads == residency.exits) return;
    auto &s = residency;
    const uint32_t state = rd32(0x006d7670);
    if (!gm_valid(state, 0x50) || rd32(state) != 3 || rd32(state + 4) ||
        rd32(0x0071c68c) != s.roots[0] || !sched_holds_baton() || mods_hook_depth() ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP ||
        rd32(state + 0x28) != s.last_tick + 1) std::abort();
    if (residency_travel_requests()) {
        if (s.ticks > 200) std::abort();
        if (!residency_take_travel_request()) return;
    } else if (s.ticks < 20u) return;
    const char *idle_release = recomp_env("BROWSER_STREAMING_IDLE_TILE_RELEASE_FIXTURE");
    if (!residency_travel_tick_count(s.ticks) || !residency_snapshot(c, s.loads - 1, true)) std::abort();
    if (residency_orphan_queue_release_enabled()) {
        if (!residency_retire_orphan_queues(c)) std::abort();
        char target[96], path[1024];
        std::snprintf(target, sizeof target, "Residency_Visit_%u_PostQueueRelease.GMP", s.loads - 1);
        if (!majesty_browser_frontier_joint_evolved_checkpoint(c) ||
            !residency_copy_file("Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP", target) ||
            !recomp_writable_path("Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP", path, sizeof path) ||
            std::remove(path)) std::abort();
        win32_invalidate_dir_cache();
    }
    if (idle_release && !std::strcmp(idle_release, "v1")) {
        if (!residency_release_idle_tiles(c, s.loads - 1)) std::abort();
        // Save once more without publishing/changing the selected checkpoint.
        // The stopped inspector compares all gameplay fields before/after
        // cache release, as well as the next ordinary reload.
        char target[96];
        std::snprintf(target, sizeof target, "Residency_Visit_%u_PostRelease.GMP", s.loads - 1);
        if (!majesty_browser_frontier_joint_evolved_checkpoint(c) ||
            !residency_copy_file("Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP", target)) std::abort();
        char path[1024];
        if (!recomp_writable_path("Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP", path, sizeof path) ||
            std::remove(path)) std::abort();
        win32_invalidate_dir_cache();
    }
    s.saved_clock = rd32(0x0071c6a8); s.saved_tick = rd32(state + 0x28);
    std::fprintf(stderr, "[streaming] World checkpoint completed visit=%u clock=%u tick=%u "
        "entry-tick=%u completed-ticks=%u hook-depth=%u baton=%u result=pass\n",
        s.exits, s.saved_clock, s.saved_tick, s.last_tick, s.ticks, mods_hook_depth(),
        unsigned(sched_holds_baton()));
    // Pinned 00416050(request1, phase3) writes only pending4. On return the
    // original dispatcher consumes it and enters 004170a0 without a new tick.
    X86 extra = *c; extra.r[R_ESP] -= 32768; extra.r[R_ECX] = state;
    guest_call(&extra, 0x00416050, 1u);
    if (rd32(state) != 3 || rd32(state + 4) != 4 ||
        rd32(0x0071c6a8) != s.saved_clock || rd32(state + 0x28) != s.saved_tick) std::abort();
    s.requested = true;
    std::fprintf(stderr, "[streaming] World residency request=%u observed-ticks=%u pending=4 result=pass\n",
        s.exits, s.ticks);
}
extern "C" void majesty_browser_streaming_joint_reload_fixture(X86 *c) {
    residency_loaded(c);
    static bool attempted = false;
    const char *flag = recomp_env("BROWSER_STREAMING_JOINT_RELOAD_FIXTURE");
    if (attempted || !flag || std::strcmp(flag, "1"))
        return;
    attempted = true;
#ifdef __EMSCRIPTEN__
    return;
#else
    if (!isolated_fixture() || !sched_holds_baton() || mods_hook_depth() ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
        return;
    char path[1024];
    std::array<uint32_t, 4> ids{};
    FILE *input = recomp_writable_path("Joint_Reload_Expected.bin", path, sizeof path)
                      ? std::fopen(path, "rb")
                      : nullptr;
    bool ok = input && std::fread(ids.data(), 1, sizeof ids, input) == sizeof ids &&
              std::fgetc(input) == EOF && !std::ferror(input);
    if (input)
        ok = std::fclose(input) == 0 && ok;
    const char *departed_flag = recomp_env("BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE");
    const bool departed = departed_flag && !std::strcmp(departed_flag, "1");
    if (!ok || ids[0] != 0x31524a4e || ids[1] != (departed ? 2u : 1u) || !ids[2] || !ids[3])
        std::abort();
    const uint32_t world = rd32(0x0071c68c);
    const uint32_t factory = gm_valid(world, 0x14) ? rd32(world + 0x10) : 0;
    X86 extra = *c;
    extra.r[R_ESP] -= 32768;
    extra.r[R_ECX] = factory;
    const uint32_t unit = guest_call(&extra, 0x005a10d0, ids[2]);
    const uint32_t runtime = guest_call(&extra, 0x00623b20);
    extra.r[R_ECX] = runtime;
    const uint32_t agent = guest_call(&extra, 0x006236b0, ids[3]);
    if (departed) {
        bool exclusive = true;
        const char *active_return = recomp_env("BROWSER_STREAMING_RETURN_ACTIVE_FIXTURE");
        const bool returning = active_return && !std::strcmp(active_return, "1");
        for (const char *name :
             {"BROWSER_STREAMING_JOINT_MOTION_FIXTURE", "BROWSER_STREAMING_JOINT_SCHEDULE_FIXTURE",
              "BROWSER_STREAMING_JOINT_SCHEDULE_RELOAD_FIXTURE",
              "BROWSER_STREAMING_JOINT_DEPARTURE_FIXTURE"}) {
            const char *value = recomp_env(name);
            if (returning && !std::strcmp(name, "BROWSER_STREAMING_JOINT_MOTION_FIXTURE"))
                continue;
            exclusive = exclusive && (!value || std::strcmp(value, "1"));
        }
        const uint32_t manager = gm_valid(runtime, 0x38) ? rd32(runtime + 4) : 0;
        NativeRegistrySnapshot before{}, after{};
        DepartureQueues queues_before{}, queues_after{};
        const bool valid = exclusive && !unit && !agent && gm_valid(factory, 0x88) &&
                           gm_valid(manager, 0x4c) && !rd32(manager + 0x48) &&
                           native_registry_snapshot(factory, before) &&
                           departure_queues(manager, 0, queues_before);
        const uint32_t counter = valid ? rd32(factory + 0x28) : 0,
                       script_counter = valid ? rd32(runtime + 0x34) : 0,
                       hooks = mods_hooks_installed_count();
        const bool saved = valid && counter >= ids[2] && script_counter >= ids[3] &&
                           majesty_browser_frontier_joint_departed_reload_checkpoint(&extra);
        const bool groups = saved && native_registry_snapshot(factory, after) && before == after;
        const bool queues = saved && departure_queues(manager, 0, queues_after) &&
                            queues_before == queues_after && !rd32(manager + 0x48);
        const bool counters =
            saved && rd32(factory + 0x28) == counter && rd32(runtime + 0x34) == script_counter;
        const bool hooks_same = hooks == mods_hooks_installed_count();
        std::fprintf(
            stderr,
            "[streaming] Joint departed reload unit=%u agent=%u unit-absent=%u "
            "agent-absent=%u entries=%u queued=%u groups=%u queues-same=%u "
            "counters-same=%u native-counter=%u script-counter=%u hooks-same=%u "
            "roundtrip-saved=%u result=%s\n",
            ids[2], ids[3], unsigned(!unit), unsigned(!agent), valid ? rd32(manager + 0x34) : 0,
            valid ? rd32(manager + 0x18) + rd32(manager + 0x24) : 0, unsigned(groups),
            unsigned(queues), unsigned(counters), counter, script_counter, unsigned(hooks_same),
            unsigned(saved), saved && groups && queues && counters && hooks_same ? "pass" : "fail");
        const char *return_flag = recomp_env("BROWSER_STREAMING_PRIVATE_RETURN_FIXTURE");
        if (return_flag && !std::strcmp(return_flag, "1") &&
            !(saved && groups && queues && counters && hooks_same && private_return_fixture(extra, factory, runtime)))
            std::fprintf(stderr, "[streaming] Private return fixture result=fail\n");
        return;
    }
    if (!gm_valid(factory, 0x88) || !gm_valid(unit, 0x164) || !gm_valid(agent, 0x34))
        std::abort();
    extra.r[R_ECX] = agent;
    const uint32_t backlink = guest_call(&extra, 0x00626310);
    const uint32_t scratch = heap_alloc(512, true);
    if (!scratch)
        std::abort();
    wr32(scratch + 128, 0x4541);
    extra.r[R_ECX] = unit + 4;
    guest_call(&extra, 0x00426700, scratch + 132, scratch + 128);
    const uint32_t ea = rd32(scratch + 132);
    const bool linked = backlink == unit && rd32(unit + 0x60) == ids[2] &&
                        rd32(unit + 0x84) == factory && rd32(agent + 0x10) == ids[3] &&
                        rd32(agent + 0x20) == ids[2] && rd32(agent + 0x24) == unit &&
                        !rd8(agent + 0x28) && ea != rd32(unit + 8) && gm_valid(ea, 0x14) &&
                        rd32(ea + 0x10) == ids[3];
    const bool unit_written =
        primary_file(extra, scratch, "Joint_Reload_Unit.bin", factory, unit, true, nullptr, true);
    const bool script_written = !agent_file(extra, scratch, "Joint_Reload_GPL.bin", agent, true);
    std::array<uint8_t, 2048> orders{};
    input = recomp_writable_path("Script_Composed_Orders_2101_0.bin", path, sizeof path)
                ? std::fopen(path, "rb")
                : nullptr;
    const size_t size = input ? std::fread(orders.data(), 1, orders.size(), input) : 0;
    ok = input && size >= 24 && size < orders.size() && std::fgetc(input) == EOF &&
         !std::ferror(input);
    if (input)
        ok = std::fclose(input) == 0 && ok;
    const bool commands_equal = ok && live_banks_equal(extra, unit, orders.data(), uint32_t(size),
                                                       "Joint_Reload_Orders.bin");
    const bool released = heap_free(scratch);
    const char *schedule = recomp_env("BROWSER_STREAMING_JOINT_SCHEDULE_FIXTURE");
    const char *restored = recomp_env("BROWSER_STREAMING_JOINT_SCHEDULE_RELOAD_FIXTURE");
    bool scheduled = true;
    if (schedule && !std::strcmp(schedule, "1"))
        scheduled = linked && unit_written && script_written && commands_equal && released &&
                    joint_schedule(extra, unit, agent, runtime);
    if (restored && !std::strcmp(restored, "1")) {
        DepartureQueues queues{};
        const uint32_t manager = gm_valid(runtime, 0x38) ? rd32(runtime + 4) : 0;
        scheduled = !(schedule && !std::strcmp(schedule, "1")) && gm_valid(manager, 0x4c) &&
                    !rd32(manager + 0x48) && departure_queues(manager, agent, queues) &&
                    queues.omitted == 1;
        std::fprintf(stderr,
                     "[streaming] Joint scheduled reload unit=%u agent=%u queued=%u "
                     "queue-mutated=0 result=%s\n",
                     ids[2], ids[3], queues.omitted, scheduled ? "pass" : "fail");
    }
    if (linked && unit_written && script_written && commands_equal && released && scheduled)
        joint_motion_begin(unit, agent, factory, runtime);
    std::fprintf(stderr,
                 "[streaming] Joint reload unit=%u agent=%u links=%u unit-written=%u "
                 "script-written=%u commands-equal=%u scratch-released=%u result=%s\n",
                 ids[2], ids[3], unsigned(linked), unsigned(unit_written), unsigned(script_written),
                 unsigned(commands_equal), unsigned(released),
                 linked && unit_written && script_written && commands_equal && released ? "pass"
                                                                                        : "fail");
    if (!scheduled)
        std::fprintf(stderr, "[streaming] Joint schedule fixture result=fail\n");
    const char *departure = recomp_env("BROWSER_STREAMING_JOINT_DEPARTURE_FIXTURE");
    if (departure && !std::strcmp(departure, "1")) {
        const char *original_source =
            recomp_env("BROWSER_STREAMING_ORIGINAL_SOURCE_DEPARTURE_FIXTURE");
        const bool source_mode = original_source && !std::strcmp(original_source, "1");
        const char *repeat_flag = recomp_env("BROWSER_STREAMING_REPEAT_DEPARTURE_FIXTURE");
        const bool repeat_mode = repeat_flag && !std::strcmp(repeat_flag, "1");
        const uint32_t grid = rd32(factory + 0x88);
        const uint32_t extent = gm_valid(grid, 0x50) ? rd32(grid + 0x48) : 0;
        // Legacy source mode retains its pinned first pair. Repeated departure
        // uses the original loader's checked UNIT/GPL/backlinks and saved queue,
        // with the actual square navigation extent; no invented identity.
        const bool source_ids = !source_mode || (ids[2] == 2101 && ids[3] == 37);
        if (!(linked && unit_written && script_written && commands_equal && released) ||
            (repeat_mode && (source_mode || !isolated_fixture() ||
                (extent != 256 && extent != 512) || rd32(grid + 0x4c) != extent)) ||
            !source_ids ||
            !joint_departure(extra, unit, agent, factory, runtime, ids[2], ids[3],
                             repeat_mode ? extent : source_mode ? 512 : 256))
            std::fprintf(stderr, "[streaming] Joint departure fixture result=fail\n");
    }
#endif
}
extern "C" void majesty_browser_streaming_transfer_reload(X86 *c, bool moved, bool destination) {
    transfer_reload(c, moved, destination);
}
extern "C" bool majesty_browser_streaming_take_arrival_checkpoint() {
    const bool ready = arrival_checkpoint_ready;
    arrival_checkpoint_ready = false;
    return ready;
}
// Original positive GPL identities without a loaded native object are not
// valid game pieces. Qualify that boundary without detaching a real guild or
// changing a hero's home. This owned native-only trial never enables travel.
static void original_remote_home_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted = false;
    const char *flag = recomp_env("BROWSER_STREAMING_REMOTE_HOME_FIXTURE");
    const bool regional = flag && (!std::strcmp(flag, "region-create") || !std::strcmp(flag, "region-reload"));
    const bool reload = flag && (!std::strcmp(flag, "reload") || !std::strcmp(flag, "region-reload"));
    if (attempted || !flag || (!regional && !reload && std::strcmp(flag, "create"))) return;
    const char *profile = recomp_env("PROFILE_DIR"), *selected = recomp_env("RULE_FRONTIER_REGION");
    std::string_view path(profile ? profile : "");
    if (!selected) return;
    const std::string_view key(selected);
    if (key.empty() || key.size() > 24) return;
    const auto split = key.find('_');
    if (split == key.npos) return;
    int32_t x = 0, y = 0;
    const auto first = std::from_chars(key.data(), key.data() + split, x);
    const auto second = std::from_chars(key.data() + split + 1, key.data() + key.size(), y);
    char canonical[32];
    if (first.ec != std::errc{} || second.ec != std::errc{} || first.ptr != key.data() + split ||
        second.ptr != key.data() + key.size() || x < -1000000 || x > 1000000 || y < -1000000 || y > 1000000) return;
    std::snprintf(canonical, sizeof canonical, "%d_%d", x, y);
    if (key != canonical || (!regional && key != "1_0")) return;
    const std::string suffix = "/frontier_" + std::string(key);
    if (!path.ends_with(suffix)) return;
    path.remove_suffix(suffix.size());
    if (regional) {
        constexpr std::string_view world_suffix = "/native-world-hero-route";
        if (!path.ends_with(world_suffix)) return;
        path.remove_suffix(world_suffix.size());
    }
    const auto slash = path.rfind('/');
    const auto owned = path.substr(slash == path.npos ? 0 : slash + 1);
    const uint32_t state = rd32(0x006d7670), world = rd32(0x0071c68c);
    const std::string_view owned_prefix = regional ? "actor-arrival-fixture-hero-route-runtime-" : "actor-arrival-fixture-remote-home-";
    if (!enabled() || recomp_env("RULE_FRONTIER_CHAPTER") ||
        !owned.starts_with(owned_prefix) || owned.size() <= owned_prefix.size() || owned.size() > 80 ||
        !gm_valid(state, 0x50) || rd32(state) != 3 || !world || mods_hook_depth() ||
        !sched_holds_baton() || c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) return;
    attempted = true;
    X86 extra = *c; extra.r[R_ESP] -= 32768;
    const uint32_t runtime = guest_call(&extra, 0x00623b20u);
    if (!gm_valid(runtime, 0x38)) std::abort();
    const uint32_t manager = rd32(runtime + 4), clock = rd32(0x0071c6a8);
    if (!gm_valid(manager, 0x4c)) std::abort();
    const uint32_t counter = rd32(runtime + 0x34), count = rd32(manager + 0x34);
    const uint32_t hooks = mods_hooks_installed_count();
    const auto queues = pair_queues(manager);
    char proposal_path[1024], input_path[1024], observed_path[1024];
    if (!recomp_writable_path("Remote_Home_Proposal.GPL", proposal_path, sizeof proposal_path) ||
        !recomp_writable_path("Remote_Home_Input.GPL", input_path, sizeof input_path) ||
        !recomp_writable_path("Remote_Home_Observed.GPL", observed_path, sizeof observed_path)) std::abort();
    auto bytes = std::make_unique<PrimaryBytes>(), actual = std::make_unique<PrimaryBytes>();
    auto plan = std::make_unique<PairPlan>();
    size_t size = 0, actual_size = 0;
    if (!agent_bytes(proposal_path, *bytes, size) || size > 1024 || size < 56) std::abort();
    const uint32_t proposal = pair_word(*bytes, size - 24);
    if (!pair_agent_plan(*bytes, size, proposal, 0, *plan) || plan->count || plan->values != 9 ||
        pair_word(*bytes, 16) != 9 || pair_word(*bytes, plan->identity - 4) ||
        plan->identity != size - 24 || plan->native != size - 19) std::abort();
    auto lookup = [&](uint32_t id) {extra.r[R_ECX] = runtime; return guest_call(&extra, 0x006236b0u, id);};
    const uint32_t scratch = heap_alloc(512, true);
    if (!scratch) std::abort();
    uint32_t agent = 0, id = proposal;
    if (reload) agent = lookup(id);
    else {
        if (!counter || counter >= 0x7ffffffeu || lookup(counter)) std::abort();
        agent = guest_call(&extra, 0x0064c616u, 0x34u);
        if (!gm_valid(agent, 0x34)) std::abort();
        extra.r[R_ECX] = agent; guest_call(&extra, 0x00625e70u);
        id = rd32(agent + 0x10);
        if (id != counter || rd32(runtime + 0x34) != counter + 1) std::abort();
        pair_put(*bytes, plan->identity, id);
        if (!pair_write(input_path, *bytes, size) || agent_file(extra, scratch, "Remote_Home_Input.GPL", agent, false)) std::abort();
        wr32(scratch + 144, id); wr32(scratch + 148, agent);
        extra.r[R_ECX] = manager + 0x28;
        guest_call(&extra, 0x00634460u, scratch + 128, scratch + 144);
        if (rd8(scratch + 132) != 1 || lookup(id) != agent) std::abort();
    }
    const bool pure = gm_valid(agent, 0x34) && rd32(agent + 0x10) == id && !rd32(agent + 0x20) &&
                      !rd32(agent + 0x24) && !rd8(agent + 0x28) && rd32(rd32(agent) + 0xc) == 9 && !rd32(agent + 0xc);
    if (!pure) std::abort();
    extra.r[R_ECX] = agent;
    if (guest_call(&extra, 0x00626310u)) std::abort();
    extra.r[R_ECX] = scratch; guest_call(&extra, 0x006254c0u, id);
    extra.r[R_ECX] = scratch; const uint32_t valid = guest_call(&extra, 0x00625580u);
    const bool equal = !agent_file(extra, scratch, "Remote_Home_Observed.GPL", agent, true) &&
                       agent_bytes(observed_path, *actual, actual_size) && actual_size == size &&
                       !std::memcmp(bytes->data(), actual->data(), size);
    const bool preserved = pair_queues(manager) == queues && rd32(runtime + 0x34) == counter + unsigned(!reload) &&
        rd32(manager + 0x34) == count + unsigned(!reload) && rd32(0x0071c68c) == world &&
        rd32(0x0071c6a8) == clock && mods_hooks_installed_count() == hooks;
    heap_free(scratch);
    std::fprintf(stderr, "[streaming] Remote home phase=%s proposal=%u agent=%u native-id=0 attributes=9 bytes=%zu "
        "registered=%u pure=%u original-valid=%u serialized-equal=%u state-preserved=%u "
        "scheduled=0 hero-imported=0 travel-qualified=0 result=%s\n", reload ? "reload" : "create", proposal, id, size,
        unsigned(lookup(id) == agent), unsigned(pure), valid, unsigned(equal), unsigned(preserved),
        equal && preserved && !valid ? "pass" : "fail");
    if (!(equal && preserved && !valid)) std::abort();
    if (regional) std::fprintf(stderr,
        "[streaming] Regional home key=%s phase=%s agent=%u counter-before=%u counter-after=%u "
        "original-restored=1 owner-published=0 result=pass\n",
        selected, reload ? "reload" : "create", id, counter, rd32(runtime + 0x34));
    // The registered pure agent belongs to the original manager. Its ordinary
    // whole-world save/read/destructor owns it; never manually destroy it here.
#endif
}
// Only the original saved Newrecruit marker, in a disposable native profile.
// Run the actual leaf/callback to completion with two clock bases in separate
// fresh processes. The actual world clock is restored before the caller runs.
struct MarkerClockTrial {
    uint32_t unit=0,bank=0,order=0,clock=0,leaves=0,callbacks=0,completion=0,cleanup=0;
    uint32_t leaf_hook=0,callback_hook=0;
    static void leaf(const PopModApi *,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *p) {
        auto &s=*static_cast<MarkerClockTrial *>(p);
        if(cpu->ecx==s.order) {
            const uint32_t reason=rd32(cpu->esp+12);
            if(rd32(cpu->esp+4)!=s.unit||rd32(cpu->esp+8)!=s.bank||rd32(0x0071c6a8)!=s.clock)std::abort();
            if(!reason&&rd32(cpu->esp)==0x005e53f3)++s.leaves;
            else if(reason==1&&rd32(cpu->esp)==0x005e5383&&s.callbacks==2&&s.completion==1&&!s.cleanup)++s.cleanup;
            else std::abort();
        }
        if(mods_call_next(nullptr,inv,cpu)!=POP_OK)std::abort();
    }
    static void callback(const PopModApi *,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *p) {
        auto &s=*static_cast<MarkerClockTrial *>(p);
        if(rd32(cpu->esp+8)==s.unit) {
            // Original bank5300 uses embedded callback data to look up the
            // procedure, but passes the command itself as the fourth argument.
            if(rd32(cpu->esp)!=0x005e533b||rd32(cpu->esp+12)!=s.bank||rd32(cpu->esp+16)!=s.order||
               rd32(0x0071c6a8)!=s.clock) {
                std::fprintf(stderr,"[streaming] Marker callback refused return=%08x bank-same=%u data-delta=%d clock-same=%u reason=%u\n",
                    rd32(cpu->esp),unsigned(rd32(cpu->esp+12)==s.bank),int32_t(rd32(cpu->esp+16)-s.order),
                    unsigned(rd32(0x0071c6a8)==s.clock),rd32(cpu->esp+20));std::abort();
            }
            const uint32_t reason=rd32(cpu->esp+20);
            if(s.callbacks>=2||reason!=(s.callbacks?1u:2u))std::abort();
            ++s.callbacks;if(reason==2)++s.completion;
            std::fprintf(stderr,"[streaming] Marker callback clock=%u reason=%u id=4101 original-delegated=1\n",s.clock,reason);
        }
        const auto status=mods_call_next(nullptr,inv,cpu);
        if(status!=POP_OK){std::fprintf(stderr,"[streaming] Marker original callback failed status=%u\n",unsigned(status));std::abort();}
    }
};
static bool marker_banks_file(X86 &extra,uint32_t unit,uint32_t bytes,const char *name) {
    if(bytes!=24&&bytes!=128&&bytes!=152&&bytes!=172&&bytes!=208&&bytes!=300)return false;
    const auto before=heap_stats();
    const uint32_t buffer=heap_alloc(100,true),io=heap_alloc(92,true),wrapper=heap_alloc(16,true),data=heap_alloc(bytes+32,false);
    if(!buffer||!io||!wrapper||!data)std::abort();
    std::memset(gm_ptr(data),0xa5,bytes+32);
    extra.r[R_ECX]=buffer;guest_call(&extra,0x0064a97fu,data+16,bytes,data+16);
    extra.r[R_ECX]=io;guest_call(&extra,0x006497f3u,buffer,1u);wr32(wrapper,io);
    extra.r[R_ECX]=unit;bool ok=!guest_call(&extra,0x005b1be0u,wrapper);
    char path[1024];FILE *f=ok&&recomp_writable_path(name,path,sizeof path)?std::fopen(path,"wb"):nullptr;
    ok=f&&std::fwrite(gm_ptr(data+16),1,bytes,f)==bytes;if(f)ok=std::fclose(f)==0&&ok;
    extra.r[R_ECX]=io+8;guest_call(&extra,0x006497c8u,0u);
    extra.r[R_ECX]=buffer;guest_call(&extra,0x0064aa1eu);
    for(uint32_t i=0;i<16;++i)ok=ok&&rd8(data+i)==0xa5&&rd8(data+bytes+16+i)==0xa5;
    ok=heap_free(data)&&heap_free(wrapper)&&heap_free(io)&&heap_free(buffer)&&ok;
    const auto after=heap_stats();return ok&&before.used_bytes==after.used_bytes&&before.used_blocks==after.used_blocks&&before.req_bytes==after.req_bytes;
}
static void original_marker_clock_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted=false;const char *phase=recomp_env("BROWSER_STREAMING_MARKER_CLOCK_FIXTURE");
    const bool rebased=phase&&!std::strcmp(phase,"rebased");
    const char *profile=recomp_env("PROFILE_DIR");std::string_view path(profile?profile:"");
    constexpr std::string_view suffix="/frontier_0_0";
    if(attempted||!phase||(!rebased&&std::strcmp(phase,"baseline"))||!path.ends_with(suffix))return;
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');
    const auto owned=path.substr(slash==path.npos?0:slash+1);
    const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!isolated_fixture()||!owned.starts_with("actor-arrival-fixture-marker-clock-")||
       recomp_env("RULE_FRONTIER_CHAPTER")||!gm_valid(state,0x50)||rd32(state)!=3||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    attempted=true;X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t actual_clock=rd32(0x0071c6a8),factory=rd32(world+0x10),hooks=mods_hooks_installed_count();
    if(!gm_valid(factory,0x88)||actual_clock<25800||actual_clock>25900)std::abort();
    extra.r[R_ECX]=factory;const uint32_t effect=guest_call(&extra,0x005a10d0u,503u);
    extra.r[R_ECX]=factory;const uint32_t hero=guest_call(&extra,0x005a10d0u,502u);
    if(!gm_valid(effect,0x164)||!gm_valid(hero,0x164)||rd32(effect+0x60)!=503||rd32(effect+0x74)!=502||
       rd32(effect+0x6c)!=0x33485241||rd32(effect+0x64)&4)std::abort();
    const uint32_t bank=rd32(effect+0x8c),head=gm_valid(bank,20)?rd32(bank+12):0,node=gm_valid(head,12)?rd32(head):0;
    const uint32_t order=gm_valid(node,12)?rd32(node+8):0;
    if(!gm_valid(bank,20)||rd32(bank)!=0x00683148||rd32(bank+4)!=effect||rd32(bank+16)!=1||
       !gm_valid(order,92)||rd32(order)!=0x00689d74||rd32(order+16)!=5||rd32(order+8)!=25800||
       rd32(order+12)!=100||rd32(order+20)!=100||rd32(order+0x2c)!=4101||rd32(order+0x30)||
       rd32(order+0x50)||rd32(order+0x54))std::abort();
    char input_path[1024];std::array<uint8_t,209> input{};
    FILE *f=recomp_writable_path("Marker_Input_Orders.bin",input_path,sizeof input_path)?std::fopen(input_path,"rb"):nullptr;
    const size_t size=f?std::fread(input.data(),1,input.size(),f):0;const bool loaded=f&&size==208&&!std::ferror(f);if(f)std::fclose(f);
    if(!loaded||!live_banks_equal(extra,effect,input.data(),208))std::abort();
    MarkerClockTrial trial;trial.unit=effect;trial.bank=bank;trial.order=order;
    if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005abad0u,0,MarkerClockTrial::leaf,POP_HOOK_WRAP,
         POP_HOOK_NO_GAME_VIEW,&trial,&trial.leaf_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e3670u,0,MarkerClockTrial::callback,POP_HOOK_WRAP,
         POP_HOOK_NO_GAME_VIEW,&trial,&trial.callback_hook)!=POP_OK)std::abort();
    const uint32_t base=rebased?18250u:25800u,scratch=heap_alloc(512,true);if(!scratch)std::abort();
    if(rebased)wr32(order+8,base);
    std::fprintf(stderr,"[streaming] Marker clock begin phase=%s source=25800 destination=18250 actual=%u unit=503 hero=502 callback=4101 serialized-equal=1\n",phase,actual_clock);
    uint32_t steps=0;
    for(uint32_t advance=0;advance<=6400;advance+=50) {
        trial.clock=base+advance;wr32(0x0071c6a8,trial.clock);
        extra.r[R_ECX]=bank;guest_call(&extra,0x005e53c0u,order);
        wr32(0x0071c6a8,actual_clock);
        const uint32_t count=rd32(bank+16);if(count>1)std::abort();
        char name[80];std::snprintf(name,sizeof name,"Marker_%03u_Orders.bin",steps);
        if(!marker_banks_file(extra,effect,count?208u:24u,name))std::abort();
        std::snprintf(name,sizeof name,"Marker_%03u_Effect.UNIT",steps);
        if(!primary_file(extra,scratch,name,factory,effect,true,nullptr,true))std::abort();
        std::snprintf(name,sizeof name,"Marker_%03u_Hero.UNIT",steps);
        if(!primary_file(extra,scratch,name,factory,hero,true,nullptr,true))std::abort();
        std::fprintf(stderr,"[streaming] Marker step index=%u advance=%u clock=%u active=%u leaves=%u callbacks=%u completion=%u cleanup=%u flags=%u clock-restored=1\n",
            steps,advance,trial.clock,count,trial.leaves,trial.callbacks,trial.completion,trial.cleanup,rd32(effect+0x64));
        ++steps;if(!count)break;
    }
    if(rd32(bank+16)||trial.completion!=1||trial.callbacks!=2||trial.cleanup!=1||!trial.leaves||!(rd32(effect+0x64)&4)||rd32(0x0071c6a8)!=actual_clock||rd32(0x0071c68c)!=world)std::abort();
    if(mods_hook_remove(MODS_OWNER_RUNTIME,trial.leaf_hook)!=POP_OK||mods_hook_remove(MODS_OWNER_RUNTIME,trial.callback_hook)!=POP_OK||mods_hooks_installed_count()!=hooks||!heap_free(scratch))std::abort();
    std::fprintf(stderr,"[streaming] Marker clock complete phase=%s steps=%u leaves=%u callbacks=%u completion=1 cleanup=1 original-leaf=1 original-callback=1 clock-restored=1 hooks-removed=1 hero-transfer=0 result=pass\n",phase,steps,trial.leaves,trial.callbacks);
#endif
}
// Real registered-home capsule, before any task activation or owner publication.
// The fresh profile owns this entire experiment and its original whole save.
static void original_wait_effect_clock_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted = false;
    const char *phase = recomp_env("BROWSER_STREAMING_WAIT_EFFECT_CLOCK_FIXTURE");
    const bool rebased = phase && !std::strcmp(phase, "rebased");
    const char *profile = recomp_env("PROFILE_DIR");
    const std::string_view path(profile ? profile : "");
    const uint32_t state = rd32(0x006d7670), world = rd32(0x0071c68c);
    if (attempted || !phase || (!rebased && std::strcmp(phase, "baseline")) ||
        path.find("/actor-arrival-fixture-wait-effect-clock-") == path.npos ||
        !path.ends_with("/frontier_0_0") || recomp_env("RULE_FRONTIER_CHAPTER") ||
        !gm_valid(state, 0x50) || rd32(state) != 3 || !gm_valid(world, 0x14) ||
        mods_hook_depth() || !sched_holds_baton() ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) return;
    attempted = true;
    X86 extra = *c; extra.r[R_ESP] -= 32768;
    const uint32_t actual_clock = rd32(0x0071c6a8), factory = rd32(world + 0x10);
    const uint32_t hooks = mods_hooks_installed_count();
    if (!gm_valid(factory, 0x88) || actual_clock < 57650 || actual_clock > 57750) std::abort();
    extra.r[R_ECX] = factory; const uint32_t hero = guest_call(&extra, 0x005a10d0u, 504u);
    if (!gm_valid(hero, 0x164) || rd32(hero + 0x74)) std::abort();
    const uint32_t base = rebased ? 24250 : 57650, scratch = heap_alloc(512, true);
    if (!scratch) std::abort();
    for (uint32_t id : {528u, 529u}) {
        extra.r[R_ECX] = factory; const uint32_t unit = guest_call(&extra, 0x005a10d0u, id);
        const uint32_t interval = id == 528 ? 1000 : 3000;
        if (!gm_valid(unit, 0x164) || rd32(unit + 0x60) != id || rd32(unit + 0x74) != 504 ||
            rd32(unit + 0x64) != 544 || rd32(unit + 0x6c) != (id == 528 ? 0x31475241u : 0x33475241u)) std::abort();
        const uint32_t bank = rd32(unit + 0x8c), head = gm_valid(bank, 20) ? rd32(bank + 12) : 0;
        const uint32_t node = gm_valid(head, 12) ? rd32(head) : 0, order = gm_valid(node, 12) ? rd32(node + 8) : 0;
        if (!gm_valid(bank, 20) || rd32(bank) != 0x00683148 || rd32(bank + 4) != unit || rd32(bank + 16) != 1 ||
            !gm_valid(order, 52) || rd32(order) != 0x0068ad44 || rd32(order + 16) != 9 ||
            rd32(order + 8) != 57350 || rd32(order + 12) != interval || rd32(order + 20) != interval ||
            rd32(order + 0x2c) != 4109 || rd32(order + 0x30)) std::abort();
        char input_path[1024], name[96]; std::array<uint8_t, 129> input{};
        std::snprintf(name, sizeof name, "Wait_Input_%u.bin", id);
        FILE *file = recomp_writable_path(name, input_path, sizeof input_path) ? std::fopen(input_path, "rb") : nullptr;
        const size_t n = file ? std::fread(input.data(), 1, input.size(), file) : 0;
        const bool loaded = file && n == 128 && !std::ferror(file); if (file) std::fclose(file);
        if (!loaded || !live_banks_equal(extra, unit, input.data(), 128)) std::abort();
        if (rebased) wr32(order + 8, base - 300);
        std::fprintf(stderr, "[streaming] Wait clock begin phase=%s unit=%u parent=504 source=57650 destination=24250 actual=%u interval=%u age=300 serialized-equal=1\n",
            phase, id, actual_clock, interval);
        uint32_t steps = 0;
        for (uint32_t advance = 0; advance <= 3000; advance += 50) {
            wr32(0x0071c6a8, base + advance); extra.r[R_ECX] = bank;
            guest_call(&extra, 0x005e53c0u, order);
            wr32(0x0071c6a8, actual_clock);
            const uint32_t count = rd32(bank + 16);
            std::snprintf(name, sizeof name, "Wait_%u_%03u_Orders.bin", id, steps);
            if (count > 1 || !marker_banks_file(extra, unit, count ? 128u : 24u, name)) std::abort();
            std::snprintf(name, sizeof name, "Wait_%u_%03u_Unit.UNIT", id, steps);
            if (!primary_file(extra, scratch, name, factory, unit, true, nullptr, true)) std::abort();
            std::fprintf(stderr, "[streaming] Wait clock step unit=%u index=%u advance=%u clock=%u active=%u flags=%u clock-restored=1\n",
                id, steps, advance, base + advance, count, rd32(unit + 0x64));
            ++steps; if (!count) break;
        }
        if (rd32(bank + 16) || !(rd32(unit + 0x64) & 4) || rd32(0x0071c6a8) != actual_clock ||
            rd32(0x0071c68c) != world || mods_hooks_installed_count() != hooks) std::abort();
        std::fprintf(stderr, "[streaming] Wait clock complete phase=%s unit=%u steps=%u original-dispatch=1 deleted=1 clock-restored=1 hooks-unchanged=1 hero-transfer=0 result=pass\n",
            phase, id, steps);
    }
    if (!heap_free(scratch)) std::abort();
#endif
}

// Actual ARH2 effect from the outdoor saved hero. Keep this distinct from the
// previously qualified ARH3 recruit profile; original leaf/callback own expiry.
static void original_outdoor_marker_clock_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted = false;
    const char *phase = recomp_env("BROWSER_STREAMING_OUTDOOR_MARKER_CLOCK_FIXTURE");
    const bool rebased = phase && !std::strcmp(phase, "rebased");
    const char *profile = recomp_env("PROFILE_DIR");
    const std::string_view path(profile ? profile : "");
    const uint32_t state = rd32(0x006d7670), world = rd32(0x0071c68c);
    if (attempted || !phase || (!rebased && std::strcmp(phase, "baseline")) ||
        path.find("/actor-arrival-fixture-outdoor-marker-clock-") == path.npos ||
        !path.ends_with("/frontier_0_0") || recomp_env("RULE_FRONTIER_CHAPTER") ||
        !gm_valid(state, 0x50) || rd32(state) != 3 || !gm_valid(world, 0x14) ||
        mods_hook_depth() || !sched_holds_baton() ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) return;
    attempted = true;
    X86 extra = *c; extra.r[R_ESP] -= 32768;
    const uint32_t actual_clock = rd32(0x0071c6a8), factory = rd32(world + 0x10);
    const uint32_t hooks = mods_hooks_installed_count();
    if (!gm_valid(factory, 0x88) || actual_clock < 57650 || actual_clock > 57750) std::abort();
    extra.r[R_ECX] = factory; const uint32_t effect = guest_call(&extra, 0x005a10d0u, 527u);
    extra.r[R_ECX] = factory; const uint32_t hero = guest_call(&extra, 0x005a10d0u, 504u);
    if (!gm_valid(effect, 0x164) || !gm_valid(hero, 0x164) || rd32(effect + 0x60) != 527 ||
        rd32(effect + 0x74) != 504 || rd32(effect + 0x6c) != 0x32485241 ||
        rd32(effect + 0x64) != 2592 || rd32(hero + 0x74)) std::abort();
    const uint32_t bank = rd32(effect + 0x8c), head = gm_valid(bank, 20) ? rd32(bank + 12) : 0;
    const uint32_t node = gm_valid(head, 12) ? rd32(head) : 0, order = gm_valid(node, 12) ? rd32(node + 8) : 0;
    if (!gm_valid(bank, 20) || rd32(bank) != 0x00683148 || rd32(bank + 4) != effect || rd32(bank + 16) != 1 ||
        !gm_valid(order, 92) || rd32(order) != 0x00689d74 || rd32(order + 16) != 5 ||
        rd32(order + 8) != 57600 || rd32(order + 12) != 100 || rd32(order + 20) != 100 ||
        rd32(order + 0x2c) != 4101 || rd32(order + 0x30) || rd32(order + 0x50) || rd32(order + 0x54)) std::abort();
    char input_path[1024]; std::array<uint8_t, 209> input{};
    FILE *file = recomp_writable_path("Outdoor_Marker_Input_Orders.bin", input_path, sizeof input_path) ? std::fopen(input_path, "rb") : nullptr;
    const size_t n = file ? std::fread(input.data(), 1, input.size(), file) : 0;
    const bool loaded = file && n == 208 && !std::ferror(file); if (file) std::fclose(file);
    if (!loaded || !live_banks_equal(extra, effect, input.data(), 208)) std::abort();
    MarkerClockTrial trial; trial.unit = effect; trial.bank = bank; trial.order = order;
    if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005abad0u, 0, MarkerClockTrial::leaf, POP_HOOK_WRAP,
            POP_HOOK_NO_GAME_VIEW, &trial, &trial.leaf_hook) != POP_OK ||
        mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005e3670u, 0, MarkerClockTrial::callback, POP_HOOK_WRAP,
            POP_HOOK_NO_GAME_VIEW, &trial, &trial.callback_hook) != POP_OK) std::abort();
    const uint32_t base = rebased ? 24250 : 57650, scratch = heap_alloc(512, true);
    if (!scratch) std::abort();
    if (rebased) wr32(order + 8, base - 50);
    std::fprintf(stderr, "[streaming] Outdoor marker begin phase=%s source=57650 destination=24250 actual=%u unit=527 hero=504 callback=4101 age=50 serialized-equal=1\n", phase, actual_clock);
    uint32_t steps = 0;
    for (uint32_t advance = 0; advance <= 6400; advance += 50) {
        trial.clock = base + advance; wr32(0x0071c6a8, trial.clock);
        extra.r[R_ECX] = bank; guest_call(&extra, 0x005e53c0u, order);
        wr32(0x0071c6a8, actual_clock);
        const uint32_t count = rd32(bank + 16); if (count > 1) std::abort();
        char name[96]; std::snprintf(name, sizeof name, "Outdoor_Marker_%03u_Orders.bin", steps);
        if (!marker_banks_file(extra, effect, count ? 208u : 24u, name)) std::abort();
        std::snprintf(name, sizeof name, "Outdoor_Marker_%03u_Effect.UNIT", steps);
        if (!primary_file(extra, scratch, name, factory, effect, true, nullptr, true)) std::abort();
        std::snprintf(name, sizeof name, "Outdoor_Marker_%03u_Hero.UNIT", steps);
        if (!primary_file(extra, scratch, name, factory, hero, true, nullptr, true)) std::abort();
        std::fprintf(stderr, "[streaming] Outdoor marker step index=%u advance=%u clock=%u active=%u leaves=%u callbacks=%u completion=%u cleanup=%u flags=%u clock-restored=1\n",
            steps, advance, trial.clock, count, trial.leaves, trial.callbacks, trial.completion, trial.cleanup, rd32(effect + 0x64));
        ++steps; if (!count) break;
    }
    if (rd32(bank + 16) || trial.completion != 1 || trial.callbacks != 2 || trial.cleanup != 1 || !trial.leaves ||
        !(rd32(effect + 0x64) & 4) || rd32(0x0071c6a8) != actual_clock || rd32(0x0071c68c) != world) std::abort();
    if (mods_hook_remove(MODS_OWNER_RUNTIME, trial.leaf_hook) != POP_OK ||
        mods_hook_remove(MODS_OWNER_RUNTIME, trial.callback_hook) != POP_OK ||
        mods_hooks_installed_count() != hooks || !heap_free(scratch)) std::abort();
    std::fprintf(stderr, "[streaming] Outdoor marker complete phase=%s steps=%u leaves=%u callbacks=%u completion=1 cleanup=1 original-leaf=1 original-callback=1 clock-restored=1 hooks-removed=1 hero-transfer=0 result=pass\n", phase, steps, trial.leaves, trial.callbacks);
#endif
}

struct QueueEntryTrial {
    uint32_t hero = 0, guild = 0, factory = 0, bank = 0, order = 0;
    uint32_t lookups = 0;
    static void lookup(const PopModApi *, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *p) {
        auto &s = *static_cast<QueueEntryTrial *>(p);
        const bool selected = rd32(cpu->esp) == 0x005e3c9e && rd32(cpu->esp + 0x28) == s.hero;
        if (selected && (cpu->ecx != s.factory || rd32(cpu->esp + 4) != 469 || s.lookups)) std::abort();
        if (mods_call_next(nullptr, inv, cpu) != POP_OK) std::abort();
        if (selected) {
            if (cpu->eax != s.guild) std::abort(); ++s.lookups;
            std::fprintf(stderr, "[streaming] Queue entry lookup target=469 original-guild=1 original-delegated=1\n");
        }
    }
};
static void original_queue_entry_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static QueueEntryTrial trial;
    static bool completed = false;
    static uint32_t start_clock = 0, prior_hooks = 0, lookup_hook = 0;
    const char *flag = recomp_env("BROWSER_STREAMING_QUEUE_ENTRY_FIXTURE");
    const char *profile = recomp_env("PROFILE_DIR"); const std::string_view path(profile ? profile : "");
    const uint32_t state = rd32(0x006d7670), world = rd32(0x0071c68c);
    if (completed || !flag || std::strcmp(flag, "v1") ||
        path.find("/actor-arrival-fixture-queue-entry-") == path.npos || !path.ends_with("/frontier_0_0") ||
        recomp_env("RULE_FRONTIER_CHAPTER") || !gm_valid(state, 0x50) || rd32(state) != 3 ||
        !gm_valid(world, 0x14) || mods_hook_depth() || !sched_holds_baton() ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) return;
    X86 extra = *c; extra.r[R_ESP] -= 32768;
    const uint32_t clock = rd32(0x0071c6a8), factory = rd32(world + 0x10), hooks = mods_hooks_installed_count();
    if ((!trial.hero && clock != 57650) || !gm_valid(factory, 0x88)) std::abort();
    extra.r[R_ECX] = factory; const uint32_t hero = guest_call(&extra, 0x005a10d0u, 504u);
    extra.r[R_ECX] = factory; const uint32_t guild = guest_call(&extra, 0x005a10d0u, 469u);
    if (!gm_valid(hero, 0x164) || !gm_valid(guild, 0x164) || (!trial.hero && rd32(hero + 0x74))) std::abort();
    const uint32_t bank = rd32(hero + 0x8c), head = gm_valid(bank, 20) ? rd32(bank + 12) : 0;
    const uint32_t node = gm_valid(head, 12) ? rd32(head) : 0, order = gm_valid(node, 12) ? rd32(node + 8) : 0;
    if (!trial.hero && (!gm_valid(bank, 20) || rd32(bank + 16) != 1 || !gm_valid(order, 72) ||
        rd32(order) != 0x0068ae74 || rd32(order + 16) != 7 || rd32(order + 0x20) != 469 ||
        rd32(order + 0x2c) != 4099 || rd32(order + 0x30) || rd32(order + 0x18) ||
        rd32(order + 0x3c) != 1 || rd32(order + 0x40) != 1 || rd32(order + 8) != clock)) std::abort();
    char input_path[1024]; std::array<uint8_t, 301> input{};
    FILE *file = recomp_writable_path("Queue_Entry_Input_Orders.bin", input_path, sizeof input_path) ? std::fopen(input_path, "rb") : nullptr;
    const size_t n = file ? std::fread(input.data(), 1, input.size(), file) : 0;
    const bool loaded = file && n == 300 && !std::ferror(file); if (file) std::fclose(file);
    if (!loaded || (!trial.hero && !live_banks_equal(extra, hero, input.data(), 300))) std::abort();
    const uint32_t runtime = guest_call(&extra, 0x00623b20u), scratch = heap_alloc(512, true);
    if (!gm_valid(runtime, 0x38) || !scratch) std::abort();
    extra.r[R_ECX] = runtime; const uint32_t hero_agent = guest_call(&extra, 0x006236b0u, 28u);
    extra.r[R_ECX] = runtime; const uint32_t guild_agent = guest_call(&extra, 0x006236b0u, 7u);
    auto capture = [&](const char *phase, uint32_t bytes) {
        char name[96];
        for (const auto pair : {std::pair{hero, "Hero"}, std::pair{guild, "Guild"}}) {
            std::snprintf(name, sizeof name, "Queue_Entry_%s_%s.UNIT", phase, pair.second);
            if (!primary_file(extra, scratch, name, factory, pair.first, true, nullptr, true)) std::abort();
        }
        for (const auto pair : {std::pair{hero_agent, "Hero"}, std::pair{guild_agent, "Guild"}}) {
            std::snprintf(name, sizeof name, "Queue_Entry_%s_%s.GPL", phase, pair.second);
            if (agent_file(extra, scratch, name, pair.first, true)) std::abort();
        }
        std::snprintf(name, sizeof name, "Queue_Entry_%s_Orders.bin", phase);
        if (!marker_banks_file(extra, hero, bytes, name)) std::abort();
    };
    if (!trial.hero) {
        capture("Before", 300); trial = QueueEntryTrial{hero, guild, factory, bank, order};
        start_clock = clock; prior_hooks = hooks;
        if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005a10d0u, 0, QueueEntryTrial::lookup, POP_HOOK_WRAP,
                POP_HOOK_NO_GAME_VIEW, &trial, &lookup_hook) != POP_OK) std::abort();
        std::fprintf(stderr, "[streaming] Queue entry begin clock=57650 hero=504 guild=469 home=7 source-parent=0 cursor=1 count=1 serialized-equal=1\n");
        if (!heap_free(scratch)) std::abort(); return;
    }
    if (clock < start_clock || clock - start_clock > 6000 || trial.hero != hero || trial.guild != guild || trial.factory != factory) std::abort();
    if (rd32(hero + 0x74) != 469) {
        if (!heap_free(scratch)) std::abort(); return;
    }
    if (mods_hook_remove(MODS_OWNER_RUNTIME, lookup_hook) != POP_OK || mods_hooks_installed_count() != prior_hooks) std::abort();
    extra.r[R_ECX] = hero; const uint32_t parent = guest_call(&extra, 0x005a2260u);
    const uint32_t path_count = rd32(rd32(hero + 0x88) + 16);
    if (trial.lookups != 1 || parent != guild || rd32(hero + 0x74) != 469 ||
        rd32(rd32(hero + 0x8c) + 16) || path_count > 1 || rd32(0x0071c6a8) != clock || rd32(0x0071c68c) != world) std::abort();
    capture("After", path_count ? 172 : 24); completed = true;
    if (!heap_free(scratch)) std::abort();
    std::fprintf(stderr, "[streaming] Queue entry complete hero=504 parent=469 lookup=1 path-count=%u queue-count=0 clock=%u elapsed=%u original-ai=1 original-entry=1 hooks-removed=1 hero-transfer=0 result=pass\n", path_count, clock, clock - start_clock);
#endif
}

// Reserve every native command allocation before reading a private constructed
// UNIT. The caller validates identity/home/navigation before any activation.
static bool restore_private_family_orders(X86 &extra, uint32_t unit, const uint8_t *payload,
                                         uint32_t bytes, std::array<uint32_t, 32> &addresses,
                                         uint32_t &address_count,
                                         majesty::actors::StageClass object_class =
                                             majesty::actors::StageClass::Vehicle) {
    using namespace majesty::orders;
    PayloadPlan plan;
    majesty::actors::StageProfile profile{};
    if (!gm_valid(unit, 0x94) || !majesty::actors::stage_profile(
            {rd32(unit + 0x64), rd32(unit + 0x74), rd32(unit + 0x6c),
             rd32(unit + 0x70), object_class}, profile) ||
        !gm_valid(unit, profile.bytes) || rd32(unit) != profile.table ||
        rd32(unit + 0x5c) != profile.kind) return false;
    if (!payload || bytes > 2048 || !plan_order_payload(payload, bytes, plan) ||
        plan.request_count > addresses.size() || rd32(unit + 0x60) || rd32(unit + 0x84) ||
        !sched_holds_baton() || mods_hook_depth()) return false;
    Journal journal;
    if (!journal.reserve(plan.requests.data(), plan.request_count, heap_port())) return false;
    const uint32_t buffer = heap_alloc(100,true), io = heap_alloc(92,true),
                   wrapper = heap_alloc(16,true), data = heap_alloc(bytes + 32,false);
    if (!buffer || !io || !wrapper || !data) std::abort();
    std::memset(gm_ptr(data),0xa5,bytes + 32); std::memcpy(gm_ptr(data + 16),payload,bytes);
    auto invoke = [&](uint32_t fn,uint32_t receiver,const uint32_t *args,int n) {
        extra.r[R_ECX] = receiver; return guest_call_guarded(&extra,fn,args,n);
    };
    const uint32_t b[] = {data + 16,bytes,0}, i[] = {buffer,1};
    if (invoke(0x0064a97f,buffer,b,3).status != GuestCallGuardedStatus::Returned ||
        invoke(0x0064b68a,io,i,2).status != GuestCallGuardedStatus::Returned) std::abort();
    wr32(wrapper,io);
    constexpr EntryPoints sites{0x004abcc0,0x005e4d20,
        {0x005e4c71,0x005da543,0x004a90b4,0x005da5e5,0x005da61b,0x005da651,0x005da687,0x005da6f3,
         0x005da729,0x005e0e39,0x005e2b61,0x005e4dc9},0x00523485,0x005da6bd,0x005da75f,0x005da795};
    auto trace = [](void *p,bool name,const AllocationDecision &d) {
        if (d.action == AllocationAction::Stop) {
            const auto &cpu = *static_cast<X86 *>(p);
            std::fprintf(stderr,"[streaming] Family allocation refused name=%u pc=%08x bytes=%u failure=%u\n",
                unsigned(name),rd32(cpu.r[R_ESP]),rd32(cpu.r[R_ESP] + 4),unsigned(d.failure));
        }
    };
    AllocationBridge bridge(journal,sites); ReaderHooks hooks(bridge,{&extra,trace});
    bool ok = hooks.install();
    if (ok) {
        const auto loaded = hooks.read_unit(&extra,unit,wrapper,
            {0x005b1b90,0x0043010f,profile.table,0x88});
        ok = loaded.complete && loaded.guest.status == GuestCallGuardedStatus::Returned &&
             !loaded.guest.eax && journal.fully_claimed();
    }
    if (!hooks.remove()) std::abort();
    const uint32_t zero = 0;
    if (invoke(0x0064b65f,io + 12,&zero,1).status != GuestCallGuardedStatus::Returned ||
        invoke(0x0064aa1e,buffer,nullptr,0).status != GuestCallGuardedStatus::Returned || !ok) std::abort();
    for (uint32_t bank = 0; bank < 3; ++bank) {
        const auto *b = journal.find(Role::Bank,bank), *h = journal.find(Role::Head,bank);
        if (!b || !h || rd32(unit + 0x88 + bank * 4) != b->address ||
            rd32(b->address + 4) != unit || rd32(b->address + 16) != plan.bank_counts[bank]) std::abort();
        uint32_t node = rd32(h->address), previous = h->address;
        for (uint32_t index = 0; index < plan.bank_counts[bank]; ++index) {
            const auto *n = journal.find(Role::Node,bank,index), *o = journal.find(Role::Order,bank,index);
            if (!n || !o || node != n->address || rd32(node + 4) != previous || rd32(node + 8) != o->address) std::abort();
            previous = node; node = rd32(node);
        }
        if (node != h->address || rd32(h->address + 4) != previous) std::abort();
    }
    if (!live_banks_equal(extra,unit,payload,bytes)) std::abort();
    address_count = plan.request_count;
    for (uint32_t k = 0; k < address_count; ++k) {
        const auto &r = plan.requests[k]; addresses[k] = journal.find(r.role,r.bank,r.index)->address;
    }
    if (!bridge.handoff_unit_orders(unit) || !journal.release() || !heap_free(data) ||
        !heap_free(wrapper) || !heap_free(io) || !heap_free(buffer)) std::abort();
    std::fprintf(stderr,"[streaming] Family orders restored requests=%u requested-bytes=%u payload-bytes=%u exact=1 transferred=1 result=pass\n",
        address_count,plan.requested_bytes,bytes);
    return true;
}

namespace {
static void arm_halo_bundle_live(X86 &extra,uint32_t scratch,uint32_t world,
    uint32_t factory,uint32_t runtime,uint32_t manager,const uint32_t (&agents)[3],
    const uint32_t (&units)[4],const uint32_t (&ids)[4],bool reloaded=false,uint32_t retired_on_load=0);
static void halo_bundle_live_frame(X86 *c);
static void original_halo_source_retirement(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted=false;const char *flag=recomp_env("BROWSER_STREAMING_HALO_SOURCE_RETIRE"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(attempted||!flag||std::strcmp(flag,"1")||!path.ends_with("/frontier_0_0")||
       path.find("/actor-arrival-fixture-halo-world-bundle-")==path.npos||!enabled()||
       !gm_valid(phase,0x50)||rd32(phase)!=3||!gm_valid(world,0x14)||mods_hook_depth()||!sched_holds_baton())return;
    attempted=true;X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u),clock=rd32(0x0071c6a8);
    if(clock!=60650||!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))std::abort();
    const uint32_t manager=rd32(runtime+4),entries=rd32(manager+0x34),native_counter=rd32(factory+0x28),script_counter=rd32(runtime+0x34),hooks=mods_hooks_installed_count();
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    auto script=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t ids[]={481,492,494,495};uint32_t units[4]{};
    for(unsigned k=0;k<4;++k){units[k]=native(ids[k]);if(!gm_valid(units[k],0x94)||(rd32(units[k]+0x64)&4))std::abort();}
    const uint32_t hero_agent=script(17),flag_agent=script(21),guild=script(7),home=native(469);
    if(!gm_valid(hero_agent,0x34)||!gm_valid(flag_agent,0x34)||!gm_valid(guild,0x34)||!gm_valid(home,0x98)||
       rd32(hero_agent+0x20)!=481||rd32(flag_agent+0x20)!=492||rd32(guild+0x20)!=469||
       rd32(home+0x6c)!=0x31564241||rd32(units[0])!=0x0068098c||rd32(units[1])!=0x0068071c||
       rd32(units[2]+0x74)!=481||rd32(units[3]+0x74)!=481||
       !arrival_contains(home,100,units[0])||!arrival_contains(units[0],101,home)||
       !arrival_contains(units[0],101,units[1])||!arrival_contains(units[1],100,units[0]))std::abort();
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    const uint32_t members=departure_list(extra,scratch,guild,"members");const auto roster=departure_list_state(members,17);
    DepartureQueues q{},before_queues{},after_queues{};NativeRegistrySnapshot before{},after{};
    if(!roster.valid||roster.count!=1||roster.matches!=1||!departure_queues(manager,flag_agent,q)||q.omitted!=1||
       !native_registry_snapshot(factory,before,0,units,4)||!majesty_browser_frontier_halo_source_checkpoint(&extra,false))std::abort();
    // Remove the flag from its original pending queue, then capture the
    // remaining queue with only the retiring hero omitted.
    extra.r[R_ECX]=manager;guest_call(&extra,0x006332c0u,flag_agent);
    if(!departure_queues(manager,hero_agent,before_queues)||before_queues.omitted!=1)std::abort();
    extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t operand=guest_call(&extra,0x0062a810u,5u);
    if(!gm_valid(operand,16))std::abort();extra.r[R_ECX]=operand;guest_call(&extra,0x006254c0u,17u);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);
    extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,5u);
    extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);
    for(unsigned k=4;k--;){extra.r[R_ECX]=units[k];guest_call(&extra,0x005a21b0u);}
    extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
    const auto empty=departure_list_state(members,17);before_queues.omitted=0;
    for(uint32_t id:ids)if(native(id))std::abort();
    if(script(17)||script(21)||native(469)!=home||script(7)!=guild||!empty.valid||empty.count||empty.matches||empty.other_hash!=roster.other_hash||
       !native_registry_snapshot(factory,after)||after!=before||!departure_queues(manager,hero_agent,after_queues)||after_queues!=before_queues||
       rd32(manager+0x34)+2!=entries||rd32(manager+0x48)||rd32(factory+0x28)!=native_counter||rd32(runtime+0x34)!=script_counter||
       mods_hooks_installed_count()!=hooks||rd32(0x0071c6a8)!=clock||!majesty_browser_frontier_halo_source_checkpoint(&extra,true)||!heap_free(scratch))std::abort();
    extra.r[R_ECX]=phase;guest_call(&extra,0x00416050u,7u);
    if(rd32(phase)!=3||rd32(phase+4)!=7)std::abort();
    std::fprintf(stderr,"[streaming] Halo source retired clock=60650 units=481,492,494,495 agents=17,21 home=469/7 aliases-absent=1 roster-empty=1 other-registry-preserved=1 other-queues-preserved=1 original-removal=1 before-after-saved=1 original-pause=1 owner-published=0 result=pass\n");
#endif
}
static void retire_outdoor_family_home_source(X86 &extra,uint32_t scratch,uint32_t world,
    uint32_t factory,uint32_t runtime,uint32_t manager);
static void arm_outdoor_family_home_return(X86 &extra,uint32_t scratch,uint32_t world,
    uint32_t factory,uint32_t runtime,uint32_t manager,uint32_t agent,uint32_t guild,
    const uint32_t (&units)[4],const uint32_t (&ids)[4],const uint32_t (&counts)[4],
    const std::array<std::array<uint32_t,32>,4> &addresses);
static void arm_outdoor_family_home_route(X86 &extra, uint32_t scratch, uint32_t world,
    uint32_t factory, uint32_t runtime, uint32_t manager, uint32_t agent, uint32_t proxy,
    const uint32_t (&units)[4], const uint32_t (&ids)[4], const uint32_t (&counts)[4],
    const std::array<std::array<uint32_t,32>,4> &addresses);
static void arm_regional_hero_effects(X86 &extra,uint32_t scratch,uint32_t world,
    uint32_t factory,uint32_t runtime,uint32_t manager,uint32_t agent,uint32_t proxy,
    const uint32_t (&units)[4],const uint32_t (&ids)[4],const uint32_t (&counts)[4],
    const std::array<std::array<uint32_t,32>,4> &addresses);
static void arm_regional_hero_reload(X86 &extra,uint32_t scratch,uint32_t world,
    uint32_t factory,uint32_t runtime,uint32_t manager,uint32_t proxy);
}

// Native-only linked reader trial. The prepared pack binds all four UNITs,
// three GPL agents, both containers and four bank payloads. Nothing is queued
// or spatially activated; normal cleanup must finish before the next tick.
// Read the complete selected1500 family into its stopped60650 home world.
// This qualifies original import/model/roster restoration and cleanup only.
// Nothing is queued/spatially activated and no source owner is retired/published.
static void original_halo_return_import_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted=false;
    const char *flag=recomp_env("BROWSER_STREAMING_HALO_RETURN_IMPORT");
    if(!flag||attempted)return;
    const char *profile=recomp_env("PROFILE_DIR"),*selected=recomp_env("RULE_FRONTIER_REGION");
    std::string_view path(profile?profile:"");constexpr std::string_view suffix="/frontier_0_0";
    if(std::strcmp(flag,"1")||!path.ends_with(suffix)||!selected||std::strcmp(selected,"0_0"))std::abort();
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');
    const auto owned=path.substr(slash==path.npos?0:slash+1);
    if(!owned.starts_with("actor-arrival-fixture-halo-world-return-")||owned.size()>80||
       recomp_env("RULE_FRONTIER_CHAPTER")||!enabled())std::abort();
    const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!gm_valid(state,0x50)||rd32(state)!=3||!gm_valid(world,0x14))return;
    if(mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)std::abort();
    attempted=true;X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t clock=rd32(0x0071c6a8),factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if(clock!=60650||!gm_valid(factory,0x88)||!gm_valid(runtime,0x38))std::abort();
    const uint32_t manager=rd32(runtime+4),hooks=mods_hooks_installed_count(),counter=rd32(factory+0x28),
                   reserved=rd32(runtime+0x34);
    if(!gm_valid(manager,0x4c)||rd32(manager+0x48)||reserved<=17||reserved>=0x7ffffffe)std::abort();
    const uint32_t entries=rd32(manager+0x34);const auto queues=pair_queues(manager);
    const auto rendering_before=pair_rendering(factory);if(!rendering_before.valid)std::abort();
    NativeRegistrySnapshot registry_before;if(!native_registry_snapshot(factory,registry_before))std::abort();
    char pathbuf[1024],name[128];const char *binding=recomp_env("BROWSER_STREAMING_HALO_RETURN_BINDING");
    if(!binding||std::strlen(binding)!=64||!recomp_writable_path("Halo_Return.pack",pathbuf,sizeof pathbuf)||
       loader_hash_file_bounded(pathbuf,3416)!=binding)std::abort();
    std::array<uint8_t,3416> pack{};FILE *f=std::fopen(pathbuf,"rb");if(!f)std::abort();
    const bool read=std::fread(pack.data(),1,pack.size(),f)==pack.size()&&std::fgetc(f)==EOF&&!std::ferror(f);
    const bool closed=std::fclose(f)==0;if(!read||!closed)std::abort();
    constexpr uint32_t header[]={0x3152484d,1,7,1500,60650,3308};
    constexpr uint32_t sizes[]={442,1846,100,151,165,164,440},tags[]={0,1,2,0,0,3,3},
                       record_ids[]={510,510,510,513,516},unit_record[]={0,3,4};
    if(std::memcmp(pack.data(),header,sizeof header))std::abort();
    std::array<std::unique_ptr<PrimaryBytes>,7> records;size_t at=sizeof header;
    for(unsigned k=0;k<7;++k){uint32_t descriptor[3]{};std::memcpy(descriptor,pack.data()+at,12);at+=12;
        const uint32_t source=k<5?record_ids[k]:k==5?513u:516u;
        if(descriptor[0]!=tags[k]||descriptor[1]!=source||descriptor[2]!=sizes[k]||at+sizes[k]>pack.size())std::abort();
        records[k]=std::make_unique<PrimaryBytes>();std::memcpy(records[k]->data(),pack.data()+at,sizes[k]);at+=sizes[k];
    }
    if(at!=pack.size())std::abort();
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    auto write=[&](const char *n,const PrimaryBytes &b,size_t bytes){return recomp_writable_path(n,pathbuf,sizeof pathbuf)&&pair_write(pathbuf,b,bytes);};
    auto load=[&](const char *n,PrimaryBytes &b,size_t bytes){size_t found=0;return recomp_writable_path(n,pathbuf,sizeof pathbuf)&&arrival_bytes(pathbuf,b,found)&&found==bytes;};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    const uint32_t home=native(469),guild=lookup(7);
    if(!gm_valid(home,0x98)||!gm_valid(guild,0x34)||rd32(guild+0x20)!=469||native(481)||lookup(17)||lookup(reserved))std::abort();
    const uint32_t members=departure_list(extra,scratch,guild,"members");const auto roster=departure_list_state(members,reserved);
    if(!roster.valid||roster.count||roster.matches||agent_file(extra,scratch,"Halo_Return_Guild_Before.GPL",guild,true)||
       !majesty_browser_frontier_halo_return_checkpoint(&extra,0))std::abort();
    const uint32_t agent=guest_call(&extra,0x0064c616u,0x34u);if(!gm_valid(agent,0x34))std::abort();
    extra.r[R_ECX]=agent;guest_call(&extra,0x00625e70u);
    if(rd32(agent+0x10)!=reserved||rd32(runtime+0x34)!=reserved+1)std::abort();
    std::array<uint32_t,3> units{},ids{},counts{};std::array<std::array<uint32_t,32>,3> addresses{};
    constexpr uint32_t descriptions[]={0x314c5641,0x34475241,0x32425241},flags[]={512,544,2592},source_ids[]={510,513,516};
    for(unsigned k=0;k<3;++k){auto &b=*records[unit_record[k]];const uint32_t bytes=sizes[unit_record[k]];
        if(pair_word(b,36)!=100000+k||pair_word(b,40)!=flags[k]||pair_word(b,48)!=descriptions[k]||pair_word(b,52)||
           pair_word(b,56)!=(k?100000u:0u)||pair_word(b,72)!=223||pair_word(b,76)!=2)std::abort();
        if(!k){size_t ea=0;if(!pair_native_ea(b,bytes,1000,ea))std::abort();pair_put(b,ea,reserved);}
        pair_put(b,36,0);if(k)pair_put(b,56,ids[0]);
        std::snprintf(name,sizeof name,"Halo_Return_Input_%u.UNIT",source_ids[k]);if(!write(name,b,bytes))std::abort();
        majesty::actors::UnitStage stage;const majesty::actors::StageInput input{flags[k],k?ids[0]:0,descriptions[k],0};
        uint32_t status=UINT32_MAX;const bool installed=stage.install();
        units[k]=installed?primary_file(extra,scratch,name,factory,0,false,&status,true,&stage,&input):0;
        if(!stage.remove())std::abort();
        std::fprintf(stderr,"[streaming] Halo return stage source=%u status=%08x complete=%u failure=%u\n",source_ids[k],status,unsigned(installed&&units[k]&&!status),unsigned(stage.failure()));
        if(!installed||status||!units[k])std::abort();
        if(k&&!restore_private_family_orders(extra,units[k],records[4+k]->data()+36,sizes[4+k]-36,addresses[k],counts[k]))std::abort();
        if(!publish_native_identity(extra,factory,units[k],ids[k])||(!k&&ids[k]<=481))std::abort();pair_put(b,36,ids[k]);
    }
    auto &script=*records[1];PairPlan plan;
    if(!pair_agent_plan(script,sizes[1],1000,100000,plan))std::abort();
    pair_put(script,plan.identity,reserved);pair_put(script,plan.native,ids[0]);
    for(size_t j=0;j<plan.count;++j){const uint32_t before=plan.references[j].before;if(before!=1000&&before!=7)std::abort();if(before==1000)pair_put(script,plan.references[j].offset,reserved);}
    if(!write("Halo_Return_Agent_Input.GPL",script,sizes[1])||agent_file(extra,scratch,"Halo_Return_Agent_Input.GPL",agent,false))std::abort();
    wr32(scratch+144,reserved);wr32(scratch+148,agent);extra.r[R_ECX]=manager+0x28;guest_call(&extra,0x00634460u,scratch+128,scratch+144);
    if(rd8(scratch+132)!=1||lookup(reserved)!=agent||rd32(manager+0x34)!=entries+1)std::abort();
    extra.r[R_ECX]=agent;if(guest_call(&extra,0x00626310u)!=units[0])std::abort();
    auto &container=*records[2];std::memmove(container.data(),container.data()+36,64);size_t cursor=8;
    if(pair_word(container,0)!=1||pair_word(container,4)!=2)std::abort();
    for(unsigned g=0;g<2;++g){const uint32_t count=pair_word(container,cursor+4),kind=pair_word(container,cursor+8);
        if(pair_word(container,cursor)!=1||count!=(kind==101?1u:2u)||(kind!=101&&kind!=1)||pair_word(container,cursor+12)!=100000)std::abort();
        pair_put(container,cursor+12,ids[0]);cursor+=16;
        for(uint32_t j=0;j<count;++j,cursor+=8){const uint32_t proposal=pair_word(container,cursor);
            if(pair_word(container,cursor+4)!=1)std::abort();
            if(kind==101){if(proposal!=469)std::abort();}
            else{if(proposal<100001||proposal>100002)std::abort();pair_put(container,cursor,ids[proposal-100000]);}
        }
    }
    if(cursor!=64||!write("Halo_Return_Container_Input.bin",container,64)||
       arrival_container_file(extra,scratch,"Halo_Return_Container_Input.bin",factory,units[0],false)||
       !arrival_contains(units[0],101,home)||!arrival_contains(units[0],1,units[1])||!arrival_contains(units[0],1,units[2]))std::abort();
    extra.r[R_ECX]=home+0x94;if(!(guest_call(&extra,0x00598e20u,units[0],home,100u)&255)||!arrival_contains(home,100,units[0]))std::abort();
    extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t operand=guest_call(&extra,0x0062a810u,5u);if(!operand)std::abort();
    extra.r[R_ECX]=operand;guest_call(&extra,0x006254c0u,reserved);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,4u);
    const auto added=departure_list_state(members,reserved);if(!added.valid||added.count!=1||added.matches!=1||added.other_hash!=roster.other_hash)std::abort();
    // Version9 PRIMARY's compact model reader leaves attachment +18 as a
    // one-based model index. The original helper post-load resolves it to a
    // model pointer; its writer maps that pointer back to the saved index.
    // Run that original stage before writing. Do not rewrite the saved index
    // or manufacture a pointer, and defer spatial/drawing publication and AI.
    for(uint32_t unit:units){const uint32_t helper=rd32(unit+0x18);
        if(!gm_valid(helper,0x20)||rd32(helper)!=0x0068b4d4||rd32(rd32(helper)+4)!=0x005b54d0)std::abort();
        extra.r[R_ECX]=helper;if(!(guest_call(&extra,0x005b54d0u)&255))std::abort();
    }
    if(pair_rendering(factory)!=rendering_before||pair_queues(manager)!=queues)std::abort();
    std::fprintf(stderr,"[streaming] Halo return models original-helper-postload=3 drawing-preserved=1 queues-preserved=1 saved-state-rewritten=0 result=pass\n");
    auto observed=std::make_unique<PrimaryBytes>();
    for(unsigned k=0;k<3;++k){std::snprintf(name,sizeof name,"Halo_Return_Observed_%u.UNIT",source_ids[k]);
        const unsigned index=unit_record[k];if(!primary_file(extra,scratch,name,factory,units[k],true,nullptr,true)||!load(name,*observed,sizes[index])||std::memcmp(records[index]->data(),observed->data(),sizes[index]))std::abort();
        if(k){std::snprintf(name,sizeof name,"Halo_Return_Observed_%u_Orders.bin",source_ids[k]);if(!live_banks_equal(extra,units[k],records[4+k]->data()+36,sizes[4+k]-36,name))std::abort();}
    }
    if(agent_file(extra,scratch,"Halo_Return_Agent_Observed.GPL",agent,true)||!load("Halo_Return_Agent_Observed.GPL",*observed,sizes[1])||std::memcmp(script.data(),observed->data(),sizes[1])||
       arrival_container_file(extra,scratch,"Halo_Return_Container_Observed.bin",factory,units[0],true)||!load("Halo_Return_Container_Observed.bin",*observed,64)||std::memcmp(container.data(),observed->data(),64)||
       agent_file(extra,scratch,"Halo_Return_Guild_Imported.GPL",guild,true)||pair_queues(manager)!=queues||rd32(0x0071c6a8)!=clock||mods_hooks_installed_count()!=hooks||
       !majesty_browser_frontier_halo_return_checkpoint(&extra,1))std::abort();
    std::fprintf(stderr,"[streaming] Halo return records hero=%u agent=%u effects=%u,%u home=469/7 clock=60650 records=7 exact=1 native-roster=1 script-roster=1 scheduled=0 activation=0 source-retired=0 owner-published=0 result=pass\n",ids[0],reserved,ids[1],ids[2]);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,5u);
    extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);
    for(unsigned k=3;k--;){extra.r[R_ECX]=units[k];guest_call(&extra,0x005a21b0u);}
    extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
    const auto cleaned=departure_list_state(members,reserved);uint32_t freed=0;
    for(unsigned k=0;k<3;++k){if(native(ids[k]))std::abort();for(unsigned n=0;n<counts[k];++n){if(heap_owns(addresses[k][n]))std::abort();++freed;}}
    NativeRegistrySnapshot registry_after;
    if(lookup(reserved)||native(469)!=home||lookup(7)!=guild||!cleaned.valid||cleaned.count||cleaned.matches||cleaned.other_hash!=roster.other_hash||
       !native_registry_snapshot(factory,registry_after)||registry_before!=registry_after||rd32(manager+0x34)!=entries||pair_queues(manager)!=queues||
       pair_rendering(factory)!=rendering_before||
       rd32(factory+0x28)!=counter+3||rd32(runtime+0x34)!=reserved+1||rd32(0x0071c6a8)!=clock||mods_hooks_installed_count()!=hooks||
       agent_file(extra,scratch,"Halo_Return_Guild_Cleaned.GPL",guild,true)||!majesty_browser_frontier_halo_return_checkpoint(&extra,2)||!heap_free(scratch))std::abort();
    std::fprintf(stderr,"[streaming] Halo return cleanup requests=%u aliases-absent=1 native-roster-empty=1 script-roster-empty=1 registry-preserved=1 queues-preserved=1 original-removal=1 hooks-removed=1 result=pass\n",freed);
#endif
}

static void original_halo_bundle_import_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted = false;
    const char *flag = recomp_env("BROWSER_STREAMING_HALO_BUNDLE_IMPORT");
    if (!flag || attempted) return;
    const char *profile = recomp_env("PROFILE_DIR"), *selected = recomp_env("RULE_FRONTIER_REGION");
    const std::string_view path(profile ? profile : "");
    constexpr std::string_view suffix = "/frontier_0_-1";
    if (std::strcmp(flag,"v1") || !path.ends_with(suffix) || !selected || std::strcmp(selected,"0_-1")) std::abort();
    const auto parent = path.substr(0,path.size()-suffix.size());
    const auto slash = parent.rfind('/');
    const auto owned = parent.substr(slash == parent.npos ? 0 : slash+1);
    if (!owned.starts_with("actor-arrival-fixture-halo-world-bundle-") || owned.size()>80 ||
        recomp_env("RULE_FRONTIER_CHAPTER") || !enabled()) std::abort();
    const uint32_t state=rd32(0x006d7670), world=rd32(0x0071c68c);
    if (!gm_valid(state,0x50) || rd32(state)!=3 || !gm_valid(world,0x14)) return;
    if (mods_hook_depth() || !sched_holds_baton() || c->r[R_ESP]<STACK_LIMIT+65536 || c->r[R_ESP]>STACK_TOP) std::abort();
    attempted=true; X86 extra=*c; extra.r[R_ESP]-=32768;
    const uint32_t clock=rd32(0x0071c6a8),factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if (clock || !gm_valid(factory,0x88) || !gm_valid(runtime,0x38)) std::abort();
    const uint32_t manager=rd32(runtime+4),hooks=mods_hooks_installed_count(),counter=rd32(factory+0x28),
                   reserved=rd32(runtime+0x34);
    if (!gm_valid(manager,0x4c) || rd32(manager+0x48) || !reserved || reserved>=0x7ffffffc) std::abort();
    const uint32_t entries=rd32(manager+0x34);const auto queues=pair_queues(manager);
    NativeRegistrySnapshot before;
    if (!native_registry_snapshot(factory,before)) std::abort();
    char pathbuf[1024],name[128];
    const char *binding=recomp_env("BROWSER_STREAMING_HALO_BUNDLE_BINDING");
    if (!binding || std::strlen(binding)!=64 || !recomp_writable_path("Halo_Bundle.pack",pathbuf,sizeof pathbuf) ||
        loader_hash_file_bounded(pathbuf,5057)!=binding) std::abort();
    std::array<uint8_t,5057> pack{};
    FILE *file=std::fopen(pathbuf,"rb");
    if (!file) std::abort();
    const bool read=std::fread(pack.data(),1,pack.size(),file)==pack.size() && std::fgetc(file)==EOF && !std::ferror(file);
    const bool closed=std::fclose(file)==0;if (!read || !closed) std::abort();
    constexpr uint32_t header[]={0x3142484d,1,13,60650,0,4877};
    if (std::memcmp(pack.data(),header,sizeof header)) std::abort();
    constexpr uint32_t sizes[]={442,146,151,151,1843,443,64,32,564,332,128,128,453},
                       source_ids[]={481,492,494,495}, tags[]={0,0,0,0,1,1,2,2,3,3,3,3,4},
                       record_ids[]={481,492,494,495,481,492,481,492,481,492,494,495,0};
    std::array<std::unique_ptr<PrimaryBytes>,13> records;
    size_t at=sizeof header;
    for (unsigned k=0;k<13;++k) {
        uint32_t descriptor[3]{};
        if (at+12+sizes[k]>pack.size()) std::abort();
        std::memcpy(descriptor,pack.data()+at,12);at+=12;
        if (descriptor[0]!=tags[k] || descriptor[1]!=record_ids[k] || descriptor[2]!=sizes[k]) std::abort();
        records[k]=std::make_unique<PrimaryBytes>();std::memcpy(records[k]->data(),pack.data()+at,sizes[k]);at+=sizes[k];
    }
    if (at!=pack.size()) std::abort();
    const uint32_t scratch=heap_alloc(512,true);if (!scratch) std::abort();
    auto write=[&](const char *n,const PrimaryBytes &b,size_t bytes) {
        return recomp_writable_path(n,pathbuf,sizeof pathbuf) && pair_write(pathbuf,b,bytes);
    };
    auto load=[&](const char *n,PrimaryBytes &b,size_t bytes) {
        size_t found=0;return recomp_writable_path(n,pathbuf,sizeof pathbuf) && arrival_bytes(pathbuf,b,found) && found==bytes;
    };
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    uint32_t agents[3]{},map_entries[3]{},units[4]{},ids[4]{},counts[4]{};
    std::array<std::array<uint32_t,32>,4> command_addresses{};
    const auto actual_agent=[&](uint32_t proposal)->uint32_t {
        if (proposal<1000 || proposal>1002) std::abort();return reserved+proposal-1000;
    };
    for (unsigned k=0;k<3;++k) {
        if (lookup(reserved+k)) std::abort();
        agents[k]=guest_call(&extra,0x0064c616u,0x34u);if (!gm_valid(agents[k],0x34)) std::abort();
        extra.r[R_ECX]=agents[k];guest_call(&extra,0x00625e70u);
        if (rd32(agents[k]+0x10)!=reserved+k || rd32(runtime+0x34)!=reserved+k+1) std::abort();
    }
    constexpr uint32_t descriptions[]={0x314c5641,0x34415241,0x31475241,0x34475241},flags[]={512,545,544,544};
    for (unsigned k=0;k<4;++k) {
        auto &b=*records[k];
        if (pair_word(b,36)!=100000+k || pair_word(b,40)!=flags[k] || pair_word(b,48)!=descriptions[k] ||
            pair_word(b,52) || pair_word(b,56)!=(k>1?100000u:0u)) std::abort();
        if (k<2) {
            size_t ea=0;if (!pair_native_ea(b,sizes[k],1001+k,ea)) std::abort();pair_put(b,ea,reserved+1+k);
        }
        pair_put(b,36,0);if(k>1)pair_put(b,56,ids[0]);
        std::snprintf(name,sizeof name,"Halo_Input_%u.UNIT",source_ids[k]);
        if (!write(name,b,sizes[k])) std::abort();
        const auto object_class=k==1?majesty::actors::StageClass::ExploreReward:majesty::actors::StageClass::Vehicle;
        majesty::actors::UnitStage stage;
        const majesty::actors::StageInput input{flags[k],k>1?ids[0]:0,descriptions[k],0,object_class};
        uint32_t status=UINT32_MAX;const bool installed=stage.install();
        units[k]=installed?primary_file(extra,scratch,name,factory,0,false,&status,true,&stage,&input):0;
        if (!stage.remove()) std::abort();
        std::fprintf(stderr,"[streaming] Halo bundle stage source=%u status=%08x complete=%u failure=%u\n",
            source_ids[k],status,unsigned(installed&&units[k]&&!status),unsigned(stage.failure()));
        if (!installed || status || !units[k] || !restore_private_family_orders(extra,units[k],records[8+k]->data(),
                sizes[8+k],command_addresses[k],counts[k],object_class) ||
            !publish_native_identity(extra,factory,units[k],ids[k])) std::abort();
        pair_put(b,36,ids[k]);
    }
    const auto actual_unit=[&](uint32_t proposal)->uint32_t {
        if (proposal<100000 || proposal>100003) std::abort();return ids[proposal-100000];
    };
    for (unsigned k=0;k<3;++k) {
        const unsigned index=k?3+k:12;auto &b=*records[index];PairPlan plan;
        if (!pair_agent_plan(b,sizes[index],1000+k,k?100000+k-1:0,plan)) std::abort();
        if (plan.count!=(k==1?3u:k==2?2u:0u)) std::abort();
        pair_put(b,plan.identity,reserved+k);
        for (size_t j=0;j<plan.count;++j)pair_put(b,plan.references[j].offset,actual_agent(plan.references[j].before));
        if (k)pair_put(b,plan.native,ids[k-1]);
        std::snprintf(name,sizeof name,"Halo_Input_Agent_%u.GPL",k);
        if (!write(name,b,sizes[index]) || agent_file(extra,scratch,name,agents[k],false)) std::abort();
        wr32(scratch+144,reserved+k);wr32(scratch+148,agents[k]);extra.r[R_ECX]=manager+0x28;
        guest_call(&extra,0x00634460u,scratch+128,scratch+144);map_entries[k]=rd32(scratch+128);
        if (rd8(scratch+132)!=1 || lookup(reserved+k)!=agents[k] || rd32(manager+0x34)!=entries+k+1) std::abort();
    }
    for (unsigned k=0;k<3;++k) {
        extra.r[R_ECX]=agents[k];if (guest_call(&extra,0x00626310u)!=(k?units[k-1]:0u)) std::abort();
    }
    for (unsigned k=0;k<2;++k) {
        auto &b=*records[6+k];size_t cursor=8;const uint32_t groups=pair_word(b,4);
        if (pair_word(b,0)!=1 || groups!=(k?1u:2u)) std::abort();
        for(uint32_t g=0;g<groups;++g) {
            if(cursor+16>sizes[6+k] || pair_word(b,cursor)!=1)std::abort();
            const uint32_t members=pair_word(b,cursor+4),kind=pair_word(b,cursor+8);
            if(members>2 || (k?kind!=100:(kind!=1&&kind!=101)) || pair_word(b,cursor+12)!=100000+k)std::abort();
            pair_put(b,cursor+12,ids[k]);cursor+=16;
            for(uint32_t j=0;j<members;++j,cursor+=8) {
                if(cursor+8>sizes[6+k] || pair_word(b,cursor+4)!=1)std::abort();
                pair_put(b,cursor,actual_unit(pair_word(b,cursor)));
            }
        }
        if(cursor!=sizes[6+k])std::abort();
        std::snprintf(name,sizeof name,"Halo_Input_%u_Container.bin",source_ids[k]);
        if(!write(name,b,sizes[6+k]) || arrival_container_file(extra,scratch,name,factory,units[k],false))std::abort();
    }
    if (!arrival_contains(units[0],101,units[1]) || !arrival_contains(units[1],100,units[0]) ||
        !arrival_contains(units[0],1,units[2]) || !arrival_contains(units[0],1,units[3])) std::abort();
    auto observed=std::make_unique<PrimaryBytes>();
    for(unsigned k=0;k<4;++k) {
        std::snprintf(name,sizeof name,"Halo_Observed_%u.UNIT",source_ids[k]);
        if(!primary_file(extra,scratch,name,factory,units[k],true,nullptr,true) || !load(name,*observed,sizes[k]) ||
            std::memcmp(records[k]->data(),observed->data(),sizes[k]))std::abort();
        std::snprintf(name,sizeof name,"Halo_Observed_%u_Orders.bin",source_ids[k]);
        if(!live_banks_equal(extra,units[k],records[8+k]->data(),sizes[8+k],name))std::abort();
    }
    for(unsigned k=0;k<3;++k) {
        const unsigned index=k?3+k:12;std::snprintf(name,sizeof name,"Halo_Observed_Agent_%u.GPL",k);
        if(agent_file(extra,scratch,name,agents[k],true) || !load(name,*observed,sizes[index]) ||
            std::memcmp(records[index]->data(),observed->data(),sizes[index]))std::abort();
    }
    for(unsigned k=0;k<2;++k) {
        std::snprintf(name,sizeof name,"Halo_Observed_%u_Container.bin",source_ids[k]);
        if(arrival_container_file(extra,scratch,name,factory,units[k],true) || !load(name,*observed,sizes[6+k]) ||
            std::memcmp(records[6+k]->data(),observed->data(),sizes[6+k]))std::abort();
    }
    if(pair_queues(manager)!=queues || rd32(0x0071c6a8)!=clock || mods_hooks_installed_count()!=hooks)std::abort();
    std::fprintf(stderr,"[streaming] Halo bundle records hero=%u flag=%u effects=%u,%u home=%u agents=%u,%u clock=0 records=13 exact=1 reciprocal=1 native-home=0 scheduled=0 activation=0 owner-published=0 result=pass\n",
        ids[0],ids[1],ids[2],ids[3],reserved,reserved+1,reserved+2);
    const char *live=recomp_env("BROWSER_STREAMING_HALO_BUNDLE_LIVE");
    if(live&&!std::strcmp(live,"1")) {
        arm_halo_bundle_live(extra,scratch,world,factory,runtime,manager,agents,units,ids);
        if(!heap_free(scratch))std::abort();
        return;
    }
    for(unsigned k=4;k--;) {extra.r[R_ECX]=units[k];guest_call(&extra,0x005a21b0u);}
    extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
    if(lookup(reserved+1) || lookup(reserved+2) || lookup(reserved)!=agents[0] || rd32(manager+0x34)!=entries+1)std::abort();
    extra.r[R_ECX]=manager+0x28;guest_call(&extra,0x006346a0u,scratch+128,map_entries[0]);
    extra.r[R_ECX]=agents[0];guest_call(&extra,0x00625fa0u);guest_call(&extra,0x00645bc0u,agents[0]);
    uint32_t freed=0;
    for(unsigned k=0;k<4;++k) {
        extra.r[R_ECX]=factory;if(guest_call(&extra,0x005a10d0u,ids[k]))std::abort();
        for(uint32_t n=0;n<counts[k];++n){if(heap_owns(command_addresses[k][n]))std::abort();++freed;}
    }
    NativeRegistrySnapshot after;
    if(!native_registry_snapshot(factory,after) || after!=before || lookup(reserved) || rd32(manager+0x34)!=entries ||
        pair_queues(manager)!=queues || rd32(factory+0x28)!=counter+4 || rd32(runtime+0x34)!=reserved+3 ||
        rd32(0x0071c6a8)!=clock || mods_hooks_installed_count()!=hooks || !heap_free(scratch))std::abort();
    std::fprintf(stderr,"[streaming] Halo bundle cleanup requests=%u original-removal=1 aliases-absent=1 registry-preserved=1 queues-preserved=1 hooks-removed=1 result=pass\n",freed);
#endif
}

static void original_outdoor_family_import_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    const char *saved_reload=recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_RELOAD");
    const char *fresh_flag=recomp_env("BROWSER_STREAMING_SESSION_HOME_IMPORT_FIXTURE");
    const char *fresh_profile=recomp_env("PROFILE_DIR");
    const bool fresh_home=fresh_flag&&!std::strcmp(fresh_flag,"v1")&&fresh_profile&&std::string_view(fresh_profile).ends_with("/frontier_0_0");
    if (saved_reload && !std::strcmp(saved_reload,"1") && !fresh_home) return;
    static bool attempted = false;
    const char *flag = recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_FIXTURE"), *profile = recomp_env("PROFILE_DIR");
    const bool regional = flag && !std::strcmp(flag,"region-v1");
    const char *regional_effect_flag=recomp_env("BROWSER_STREAMING_REGIONAL_HERO_EFFECTS");
    const bool regional_effects=regional&&regional_effect_flag&&
        (!std::strcmp(regional_effect_flag,"v1")||!std::strcmp(regional_effect_flag,"motion-v1"));
    uint32_t regional_clock=0,regional_home_agent=0;
    std::string regional_key;
    if (regional) {
        const char *selected=recomp_env("RULE_FRONTIER_REGION");
        if (!selected) return;
        const std::string_view key(selected);const auto split=key.find('_');
        if (key.empty()||key.size()>24||split==key.npos) return;
        int32_t x=0,y=0;
        const auto a=std::from_chars(key.data(),key.data()+split,x);
        const auto b=std::from_chars(key.data()+split+1,key.data()+key.size(),y);
        char canonical[32];std::snprintf(canonical,sizeof canonical,"%d_%d",x,y);
        if (a.ec!=std::errc{}||b.ec!=std::errc{}||a.ptr!=key.data()+split||b.ptr!=key.data()+key.size()||
            x<-1000000||x>1000000||y<-1000000||y>1000000||key!=canonical||key=="0_0") return;
        regional_key=key;
        auto option=[](const char *name,uint32_t &out) {
            const char *value=recomp_env(name);if(!value)return false;
            const std::string_view text(value);const auto parsed=std::from_chars(text.data(),text.data()+text.size(),out);
            return !text.empty()&&parsed.ec==std::errc{}&&parsed.ptr==text.data()+text.size()&&std::to_string(out)==text;
        };
        if(!option("BROWSER_STREAMING_FAMILY_CLOCK",regional_clock)||
           !option("BROWSER_STREAMING_FAMILY_HOME_AGENT",regional_home_agent)||!regional_home_agent||regional_home_agent>=0x7fffffff) return;
    }
    const char *return_flag=recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_RETURN_FIXTURE");
    const bool returning=return_flag && !std::strcmp(return_flag,"1");
    const char *reload_flag=recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_RETURN_RELOAD");
    if (returning && reload_flag && !std::strcmp(reload_flag,"1")) return;
    const std::string_view path(profile ? profile : "");
    bool regional_profile=false;
    if (regional) {
        const std::string suffix="/native-world-regional-hero/frontier_"+regional_key;
        if(!path.ends_with(suffix))return;
        const auto root=path.substr(0,path.size()-suffix.size());const auto slash=root.rfind('/');
        const auto owned=root.substr(slash==root.npos?0:slash+1);
        constexpr std::string_view prefix="actor-arrival-fixture-regional-hero-runtime-";
        regional_profile=owned.starts_with(prefix)&&owned.size()>prefix.size()&&owned.size()<=80;
    }
    const uint32_t state = rd32(0x006d7670), world = rd32(0x0071c68c);
    if (attempted || !flag || (!regional&&std::strcmp(flag,"v1")) ||
        (regional?(!regional_profile||returning||!enabled()||recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_ROUTE_FIXTURE")||recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_FIXTURE")):
        (path.find("/actor-arrival-fixture-outdoor-family-") == path.npos || !path.ends_with(returning?"/frontier_0_0":"/frontier_1_0"))) ||
        recomp_env("RULE_FRONTIER_CHAPTER") || !gm_valid(state,0x50) || rd32(state) != 3 ||
        !gm_valid(world,0x14) || mods_hook_depth() || !sched_holds_baton() ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) return;
    attempted = true; X86 extra = *c; extra.r[R_ESP] -= 32768;
    const uint32_t clock = rd32(0x0071c6a8), factory = rd32(world + 0x10), runtime = guest_call(&extra,0x00623b20u);
    if (clock != (regional?regional_clock:returning?57650u:24250u) || !gm_valid(factory,0x88) || !gm_valid(runtime,0x38)) std::abort();
    const uint32_t manager = rd32(runtime + 4), reserved = rd32(runtime + 0x34), hooks = mods_hooks_installed_count();
    if (!gm_valid(manager,0x4c) || !reserved || reserved >= 0x7ffffffe || rd32(manager + 0x48)) std::abort();
    const uint32_t scratch = heap_alloc(512,true);
    if (!scratch) std::abort();
    if (returning) retire_outdoor_family_home_source(extra,scratch,world,factory,runtime,manager);
    auto lookup = [&](uint32_t id) { extra.r[R_ECX] = runtime; return guest_call(&extra,0x006236b0u,id); };
    const uint32_t home_agent=returning?7u:regional?regional_home_agent:45u;
    const uint32_t proxy = lookup(home_agent), entries = rd32(manager + 0x34), counter = rd32(factory + 0x28);
    if (!gm_valid(proxy,0x34) || lookup(reserved) ||
        (returning?rd32(proxy+0x20)!=469:rd32(proxy + 0x20)||rd32(proxy + 0x24))) std::abort();
    const char *regional_reload=recomp_env("BROWSER_STREAMING_REGIONAL_HERO_RELOAD");
    if(regional&&regional_reload&&!std::strcmp(regional_reload,"v1")){
        arm_regional_hero_reload(extra,scratch,world,factory,runtime,manager,proxy);
        if(!heap_free(scratch))std::abort();return;
    }
    const auto queues = pair_queues(manager); NativeRegistrySnapshot before;
    if (!native_registry_snapshot(factory,before)) std::abort();
    std::array<uint8_t,0x34> proxy_before{}; std::memcpy(proxy_before.data(),gm_ptr(proxy),proxy_before.size());
    const char *snapshot=recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_FIXTURE");
    if (snapshot && !std::strcmp(snapshot,"1") &&
        (!fresh_home && (returning || !majesty_browser_frontier_outdoor_family_snapshot_checkpoint(&extra,0)))) std::abort();
    const uint32_t agent = guest_call(&extra,0x0064c616u,0x34u);
    if (!scratch || !gm_valid(agent,0x34)) std::abort();
    extra.r[R_ECX] = agent; guest_call(&extra,0x00625e70u);
    if (rd32(agent + 0x10) != reserved || rd32(runtime + 0x34) != reserved + 1) std::abort();
    auto script = std::make_unique<PrimaryBytes>(), container = std::make_unique<PrimaryBytes>(), observed = std::make_unique<PrimaryBytes>();
    char filename[128], pathbuf[1024];
    auto load = [&](const char *name,PrimaryBytes &b,size_t expected) {
        size_t n = 0; return recomp_writable_path(name,pathbuf,sizeof pathbuf) && arrival_bytes(pathbuf,b,n) && n == expected;
    };
    auto write = [&](const char *name,const PrimaryBytes &b,size_t n) {
        return recomp_writable_path(name,pathbuf,sizeof pathbuf) && pair_write(pathbuf,b,n);
    };
    PairPlan script_plan;
    const uint32_t proposal_agent=regional?1000u:28u,proposal_hero=regional?100000u:504u;
    const size_t container_bytes=returning?72:regional?64:48;
    if (!load("Family_Proposal_Agent.GPL",*script,1850) || !pair_agent_plan(*script,1850,proposal_agent,proposal_hero,script_plan) ||
        !load("Family_Proposal_Container.bin",*container,container_bytes)) std::abort();
    pair_put(*script,script_plan.identity,reserved);
    for (size_t k = 0; k < script_plan.count; ++k) {
        const auto &r = script_plan.references[k];
        if (r.before != proposal_agent && r.before != (regional?home_agent:7u)) std::abort();
        pair_put(*script,r.offset,r.before == proposal_agent ? reserved : home_agent);
    }
    std::array<std::unique_ptr<PrimaryBytes>,4> unit_inputs;
    uint32_t units[4]{}, ids[4]{}, request_counts[4]{};
    std::array<std::array<uint32_t,32>,4> command_addresses{};
    constexpr uint32_t source_ids[] = {504,527,528,529}, descriptions[] = {0x314c5641,0x32485241,0x31475241,0x33475241},
                       flags[] = {512,2592,544,544}, order_bytes[] = {300,208,128,128};
    for (unsigned k = 0; k < 4; ++k) {
        unit_inputs[k] = std::make_unique<PrimaryBytes>(); auto &b = *unit_inputs[k]; const size_t n = k ? 151 : 442;
        const uint32_t proposed_id=regional?100000u+k:source_ids[k];
        std::snprintf(filename,sizeof filename,"Family_Proposal_%u.UNIT",source_ids[k]);
        if (!load(filename,b,n) || pair_word(b,36) != proposed_id || pair_word(b,40) != flags[k] ||
            pair_word(b,48) != descriptions[k] || pair_word(b,56) != (k ? proposal_hero : 0u)) std::abort();
        size_t ea = 0;
        if (!k) { if (!pair_native_ea(b,n,proposal_agent,ea)) std::abort(); pair_put(b,ea,reserved); }
        pair_put(b,36,0); pair_put(b,56,k ? ids[0] : 0);
        std::snprintf(filename,sizeof filename,"Family_Input_%u.UNIT",source_ids[k]);
        if (!write(filename,b,n)) std::abort();
        majesty::actors::UnitStage stage; const majesty::actors::StageInput input{flags[k],k ? ids[0] : 0,descriptions[k],0};
        uint32_t status = UINT32_MAX; const bool installed = stage.install();
        units[k] = installed ? primary_file(extra,scratch,filename,factory,0,false,&status,true,&stage,&input) : 0;
        if (!stage.remove()) std::abort();
        std::fprintf(stderr,"[streaming] Family unit stage source=%u status=%08x complete=%u failure=%u\n",
            source_ids[k],status,unsigned(installed && units[k] && !status),unsigned(stage.failure()));
        if (!installed || status || !gm_valid(units[k],0x164)) std::abort();
        auto orders = std::make_unique<PrimaryBytes>();
        std::snprintf(filename,sizeof filename,"Family_Proposal_%u_Orders.bin",source_ids[k]);
        if (!load(filename,*orders,order_bytes[k]) || !restore_private_family_orders(extra,units[k],orders->data(),order_bytes[k],command_addresses[k],request_counts[k]) ||
            !publish_native_identity(extra,factory,units[k],ids[k])) std::abort();
        pair_put(b,36,ids[k]);
        std::snprintf(filename,sizeof filename,"Family_Observed_%u_Orders.bin",source_ids[k]);
        if (!live_banks_equal(extra,units[k],orders->data(),order_bytes[k],filename)) std::abort();
    }
    pair_put(*script,script_plan.native,ids[0]);
    if (!write("Family_Input_Agent.GPL",*script,1850) || agent_file(extra,scratch,"Family_Input_Agent.GPL",agent,false)) std::abort();
    wr32(scratch + 144,reserved); wr32(scratch + 148,agent); extra.r[R_ECX] = manager + 0x28;
    guest_call(&extra,0x00634460u,scratch + 128,scratch + 144);
    if (rd8(scratch + 132) != 1 || lookup(reserved) != agent || rd32(manager + 0x34) != entries + 1) std::abort();
    extra.r[R_ECX] = agent; if (guest_call(&extra,0x00626310u) != units[0]) std::abort();
    const uint32_t child_offset=returning?32:regional?24:8;
    if (pair_word(*container,0) != 1 || pair_word(*container,4) != ((returning||regional)?2u:1u) || pair_word(*container,child_offset) != 1 ||
        pair_word(*container,child_offset+4) != 3 || pair_word(*container,child_offset+8) != 1 || pair_word(*container,child_offset+12) != proposal_hero) std::abort();
    if (regional) {
        const uint32_t header[]={1,2,1,0,101,proposal_hero};
        if(std::memcmp(container->data(),header,sizeof header))std::abort();
        pair_put(*container,20,ids[0]);
    }
    if (returning) {
        constexpr uint32_t header[]={1,2,1,1,101,504,469,1};
        if (std::memcmp(container->data(),header,sizeof header)) std::abort();
        pair_put(*container,20,ids[0]);
    }
    pair_put(*container,child_offset+12,ids[0]);
    for (unsigned k = 1; k < 4; ++k) {
        if (pair_word(*container,child_offset+8 + k * 8) != (regional?100000u+k:source_ids[k]) || pair_word(*container,child_offset+12 + k * 8) != 1) std::abort();
        pair_put(*container,child_offset+8 + k * 8,ids[k]);
    }
    if (!write("Family_Input_Container.bin",*container,container_bytes) || arrival_container_file(extra,scratch,"Family_Input_Container.bin",factory,units[0],false)) std::abort();
    for (unsigned k = 1; k < 4; ++k) if (!arrival_contains(units[0],1,units[k]) || rd32(units[k] + 0x74) != ids[0]) std::abort();
    if (arrival_contains(units[0],101,units[0])) std::abort(); // no substitute native home
    for (unsigned k = 0; k < 4; ++k) {
        std::snprintf(filename,sizeof filename,"Family_Observed_%u.UNIT",source_ids[k]); const size_t n = k ? 151 : 442;
        if (!primary_file(extra,scratch,filename,factory,units[k],true,nullptr,true) ||
            !load(filename,*observed,n) || std::memcmp(unit_inputs[k]->data(),observed->data(),n)) std::abort();
    }
    if (agent_file(extra,scratch,"Family_Observed_Agent.GPL",agent,true) || !load("Family_Observed_Agent.GPL",*observed,1850) ||
        std::memcmp(script->data(),observed->data(),1850) || arrival_container_file(extra,scratch,"Family_Observed_Container.bin",factory,units[0],true) ||
        !load("Family_Observed_Container.bin",*observed,container_bytes) || std::memcmp(container->data(),observed->data(),container_bytes) ||
        pair_queues(manager) != queues || rd32(0x0071c6a8) != clock || mods_hooks_installed_count() != hooks) std::abort();
    if (returning) {
        std::fprintf(stderr,"[streaming] Family return restored hero=%u effects=%u,%u,%u agent=%u clock=57650 exact=1 internal-links=3 home=469/7 source-retired=1 owner-published=0 result=pass\n",ids[0],ids[1],ids[2],ids[3],reserved);
        arm_outdoor_family_home_return(extra,scratch,world,factory,runtime,manager,agent,proxy,units,ids,request_counts,command_addresses);
        if (!heap_free(scratch)) std::abort();
        return;
    }
    std::fprintf(stderr,"[streaming] Family records hero=%u effects=%u,%u,%u agent=%u clock=%u exact=1 internal-links=3 home-proxy=%u home-native=0 scheduled=0 finalization=0 owner-published=0 result=pass\n",
        ids[0],ids[1],ids[2],ids[3],reserved,clock,home_agent);
    if(regional)std::fprintf(stderr,"[streaming] Regional hero key=%s clock=%u home=%u source-guild=469 pending-intercept=1 source-position-retained=1 activation=0 result=pass\n",regional_key.c_str(),clock,home_agent);
    if(regional_effects){
        arm_regional_hero_effects(extra,scratch,world,factory,runtime,manager,agent,proxy,units,ids,request_counts,command_addresses);
        if(!heap_free(scratch))std::abort();
        return;
    }
    const char *route = recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_ROUTE_FIXTURE");
    if (route && !std::strcmp(route,"v1")) {
        arm_outdoor_family_home_route(extra,scratch,world,factory,runtime,manager,agent,proxy,
                                     units,ids,request_counts,command_addresses);
        if (!heap_free(scratch)) std::abort();
        return;
    }
    // Original normal removal owns registered actors and their transferred
    // command storage. Remove children first, then the unscheduled hero/GPL.
    for (unsigned k = 4; k--;) {extra.r[R_ECX] = units[k]; guest_call(&extra,0x005a21b0u);}
    extra.r[R_ECX] = manager; guest_call(&extra,0x00633370u);
    uint32_t freed = 0;
    for (unsigned k = 0; k < 4; ++k) {
        extra.r[R_ECX] = factory; if (guest_call(&extra,0x005a10d0u,ids[k])) std::abort();
        for (uint32_t n = 0; n < request_counts[k]; ++n) {if (heap_owns(command_addresses[k][n])) std::abort(); ++freed;}
    }
    NativeRegistrySnapshot after;
    if (!native_registry_snapshot(factory,after) || after != before || lookup(reserved) || lookup(home_agent) != proxy ||
        std::memcmp(proxy_before.data(),gm_ptr(proxy),proxy_before.size()) || rd32(manager + 0x34) != entries ||
        pair_queues(manager) != queues || rd32(factory + 0x28) != counter + 4 || rd32(runtime + 0x34) != reserved + 1 ||
        rd32(0x0071c6a8) != clock || mods_hooks_installed_count() != hooks || !heap_free(scratch)) std::abort();
    std::fprintf(stderr,"[streaming] Family cleanup requests=%u original-removal=1 aliases-absent=1 registry-preserved=1 proxy-preserved=1 queues-preserved=1 hooks-removed=1 result=pass\n",freed);
#endif
}

static void original_registered_hero_import_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted=false;const char *flag=recomp_env("BROWSER_STREAMING_HERO_IMPORT_FIXTURE");
    const char *profile=recomp_env("PROFILE_DIR");std::string_view path(profile?profile:"");
    constexpr std::string_view suffix="/frontier_1_0";
    if(attempted||!flag||std::strcmp(flag,"1")||!path.ends_with(suffix))return;
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');
    const auto owned=path.substr(slash==path.npos?0:slash+1);
    const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c);
    const char *selected=recomp_env("RULE_FRONTIER_REGION");
    if(!enabled()||!selected||std::strcmp(selected,"1_0")||!owned.starts_with("actor-arrival-fixture-hero-import-")||owned.size()>80||
       recomp_env("RULE_FRONTIER_CHAPTER")||!gm_valid(state,0x50)||rd32(state)!=3||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    attempted=true;X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u),clock=rd32(0x0071c6a8);
    if(!gm_valid(factory,0x88)||!gm_valid(runtime,0x38)||clock<18250||clock>18300)std::abort();
    const uint32_t manager=rd32(runtime+4),hooks=mods_hooks_installed_count(),reserved=rd32(runtime+0x34);
    if(!gm_valid(manager,0x4c)||!reserved||reserved>=0x7ffffffe||rd32(manager+0x48))std::abort();
    const auto queues=pair_queues(manager);const uint32_t entries=rd32(manager+0x34);
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t proxy=lookup(45);if(!gm_valid(proxy,0x34)||rd32(proxy+0x20)||rd32(proxy+0x24)||lookup(reserved))std::abort();
    auto hero=std::make_unique<PrimaryBytes>(),effect=std::make_unique<PrimaryBytes>(),script=std::make_unique<PrimaryBytes>(),
         container=std::make_unique<PrimaryBytes>(),orders=std::make_unique<PrimaryBytes>(),observed=std::make_unique<PrimaryBytes>();
    char pathbuf[1024];
    auto load=[&](const char *name,PrimaryBytes &b,size_t expected){size_t n=0;return recomp_writable_path(name,pathbuf,sizeof pathbuf)&&arrival_bytes(pathbuf,b,n)&&n==expected;};
    auto write=[&](const char *name,const PrimaryBytes &b,size_t n){return recomp_writable_path(name,pathbuf,sizeof pathbuf)&&pair_write(pathbuf,b,n);};
    if(!load("Hero_Import_Hero_Proposal.UNIT",*hero,418)||!load("Hero_Import_Effect_Proposal.UNIT",*effect,151)||
       !load("Hero_Import_Agent_Proposal.GPL",*script,1846)||!load("Hero_Import_Container_Proposal.bin",*container,84)||
       !load("Hero_Import_Orders_Proposal.bin",*orders,244))std::abort();
    PairPlan plan;size_t ea=0;
    if(pair_word(*hero,36)!=100000||pair_word(*hero,56)||pair_word(*hero,40)!=512||
       pair_word(*hero,48)!=0x314c5641||pair_word(*effect,36)!=100001||pair_word(*effect,56)!=100000||
       pair_word(*effect,40)!=2592||pair_word(*effect,48)!=0x33485241||
       !pair_native_ea(*hero,418,1000,ea)||!pair_agent_plan(*script,1846,1000,100000,plan))std::abort();
    for(size_t i=0;i<plan.count;++i)if(plan.references[i].before!=1000&&plan.references[i].before!=45)std::abort();
    if(pair_word(*orders,0)!=100001||pair_word(*orders,80)!=18250||pair_word(*orders,100)!=4101||
       pair_word(*container,0)!=100000||pair_word(*container,48)||pair_word(*container,52)!=101||
       pair_word(*container,56)!=100000||pair_word(*container,64)!=1||pair_word(*container,68)!=1||
       pair_word(*container,72)!=100000||pair_word(*container,76)!=100001||pair_word(*container,80)!=1)std::abort();
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    const uint32_t agent=guest_call(&extra,0x0064c616u,0x34u);if(!gm_valid(agent,0x34))std::abort();
    extra.r[R_ECX]=agent;guest_call(&extra,0x00625e70u);
    if(rd32(agent+0x10)!=reserved||rd32(runtime+0x34)!=reserved+1)std::abort();
    pair_put(*hero,ea,reserved);pair_put(*script,plan.identity,reserved);
    for(size_t i=0;i<plan.count;++i)if(plan.references[i].before==1000)pair_put(*script,plan.references[i].offset,reserved);
    uint32_t units[2]{},ids[2]{};
    for(unsigned i=0;i<2;++i) {
        auto &b=i?*effect:*hero;const size_t n=i?151:418;const char *name=i?"Hero_Import_Effect_Input.UNIT":"Hero_Import_Hero_Input.UNIT";
        if(i)pair_put(b,56,ids[0]);
        // The private reader must request deferred, fresh identity. Keeping the
        // proposal here requests the original explicit-ID registration branch.
        pair_put(b,36,0);
        if(!write(name,b,n))std::abort();
        majesty::actors::UnitStage stage;const majesty::actors::StageInput input{pair_word(b,40),pair_word(b,56),pair_word(b,48),pair_word(b,52)};
        uint32_t status=UINT32_MAX;const bool installed=stage.install();
        units[i]=installed?primary_file(extra,scratch,name,factory,0,false,&status,true,&stage,&input):0;
        if(!stage.remove())std::abort();
        std::fprintf(stderr,"[streaming] Hero import stage part=%s status=%08x complete=%u failure=%u\n",i?"effect":"hero",status,unsigned(installed&&units[i]&&!status),unsigned(stage.failure()));
        if(!installed||status||!gm_valid(units[i],0x164)||!publish_native_identity(extra,factory,units[i],ids[i]))std::abort();
        pair_put(b,36,ids[i]);
    }
    pair_put(*script,plan.native,ids[0]);if(!write("Hero_Import_Agent_Input.GPL",*script,1846)||agent_file(extra,scratch,"Hero_Import_Agent_Input.GPL",agent,false))std::abort();
    wr32(scratch+144,reserved);wr32(scratch+148,agent);extra.r[R_ECX]=manager+0x28;
    guest_call(&extra,0x00634460u,scratch+128,scratch+144);
    if(rd8(scratch+132)!=1||lookup(reserved)!=agent||rd32(manager+0x34)!=entries+1)std::abort();
    extra.r[R_ECX]=agent;if(guest_call(&extra,0x00626310u)!=units[0])std::abort();
    std::memmove(container->data(),container->data()+36,48);pair_put(*container,20,ids[0]);pair_put(*container,36,ids[0]);pair_put(*container,40,ids[1]);
    if(!write("Hero_Import_Container_Input.bin",*container,48)||arrival_container_file(extra,scratch,"Hero_Import_Container_Input.bin",factory,units[0],false)||
       !arrival_contains(units[0],1,units[1]))std::abort();
    std::memmove(orders->data(),orders->data()+36,208);pair_put(*orders,44,clock);
    // Original reader, owner banks and marker allocator; no command emulation.
    if(!write("Hero_Import_Orders_Input.bin",*orders,208))std::abort();
    std::memset(gm_ptr(scratch),0,512);gm_put_str(scratch+256,"Hero_Import_Orders_Input.bin",128);
    extra.r[R_ECX]=scratch;guest_call(&extra,0x004e3340u);
    extra.r[R_ECX]=scratch;guest_call(&extra,0x004e3590u,scratch+256,uint32_t(std::strlen("Hero_Import_Orders_Input.bin")));
    extra.r[R_ECX]=scratch+16;guest_call(&extra,0x004ef470u,scratch,0xa0u,rd32(0x0068c7f0));
    extra.r[R_ECX]=units[1];const uint32_t order_result=guest_call(&extra,0x005b1b90u,scratch+16);
    extra.r[R_ECX]=scratch+16;guest_call(&extra,0x004ef680u);
    extra.r[R_ECX]=scratch;guest_call(&extra,0x004e3820u);
    if(order_result||!live_banks_equal(extra,units[1],orders->data(),208))std::abort();
    // Complete original family finalization. Scheduling remote home tasks is a
    // separate prerequisite, so neither native publication nor this save queues
    // the imported GPL agent for execution.
    for(uint32_t unit:units){extra.r[R_ECX]=unit;if(!(guest_call(&extra,0x005a2370u)&255))std::abort();}
    bool equal=true;
    for(unsigned i=0;i<2;++i){const char *name=i?"Hero_Import_Effect_Observed.UNIT":"Hero_Import_Hero_Observed.UNIT";const size_t expected=i?151:418;
        equal=equal&&primary_file(extra,scratch,name,factory,units[i],true,nullptr,true)&&load(name,*observed,expected)&&
              !std::memcmp((i?effect:hero)->data(),observed->data(),expected);}
    equal=equal&&!agent_file(extra,scratch,"Hero_Import_Agent_Observed.GPL",agent,true)&&load("Hero_Import_Agent_Observed.GPL",*observed,1846)&&!std::memcmp(script->data(),observed->data(),1846);
    if(!equal||pair_queues(manager)!=queues||mods_hooks_installed_count()!=hooks||rd32(0x0071c6a8)!=clock)std::abort();
    if(!majesty_browser_frontier_registered_hero_checkpoint(&extra))std::abort();
    std::fprintf(stderr,"[streaming] Hero import saved hero=%u effect=%u agent=%u proxy=45 clock=%u exact-records=1 original-finalization=1 scheduled=0 owner-published=0 travel-qualified=0 result=pass\n",ids[0],ids[1],reserved,clock);
    // The saved proof is inert. Remove these objects through the original
    // lifetime before ordinary frames resume, preserving all preexisting actors.
    for(unsigned i=2;i--;){extra.r[R_ECX]=units[i];guest_call(&extra,0x005a21b0u);}
    extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
    for(uint32_t id:ids){extra.r[R_ECX]=factory;if(guest_call(&extra,0x005a10d0u,id))std::abort();}
    if(lookup(reserved)||lookup(45)!=proxy||rd32(manager+0x34)!=entries||pair_queues(manager)!=queues||!heap_free(scratch))std::abort();
    std::fprintf(stderr,"[streaming] Hero import cleanup original-removal=1 aliases-absent=1 proxy-preserved=1 queues-preserved=1 hooks-removed=1 result=pass\n");
#endif
}
static void original_registered_hero_departure_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted=false;const char *flag=recomp_env("BROWSER_STREAMING_HERO_DEPARTURE_FIXTURE");
    const char *profile=recomp_env("PROFILE_DIR");std::string_view path(profile?profile:"");
    constexpr std::string_view suffix="/frontier_0_0";
    if(attempted||!flag||std::strcmp(flag,"1")||!path.ends_with(suffix))return;
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');
    const auto owned=path.substr(slash==path.npos?0:slash+1);
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!isolated_fixture()||!owned.starts_with("actor-arrival-fixture-hero-departure-")||!gm_valid(phase,0x50)||
       rd32(phase)!=3||!gm_valid(world,0x14)||mods_hook_depth()||!sched_holds_baton()||
       c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    attempted=true;X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u),clock=rd32(0x0071c6a8),hooks=mods_hooks_installed_count();
    if(clock!=25800||!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))std::abort();
    const uint32_t manager=rd32(runtime+4),native_counter=rd32(factory+0x28),script_counter=rd32(runtime+0x34);
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t hero=native(502),effect=native(503),home=native(469),agent=lookup(27),guild=lookup(7);
    if(!gm_valid(manager,0x4c)||rd32(manager+0x48)||!gm_valid(hero,0x164)||!gm_valid(effect,0x164)||
       !gm_valid(home,0x98)||!gm_valid(agent,0x34)||!gm_valid(guild,0x34)||rd32(hero+0x74)||rd32(effect+0x74)!=502||
       rd32(hero+0x6c)!=0x314c5641||rd32(effect+0x6c)!=0x33485241||rd32(home+0x6c)!=0x31564241||
       rd32(agent+0x20)!=502||rd32(guild+0x20)!=469||rd8(agent+0x28)||rd8(guild+0x28)||
       !arrival_contains(home,100,hero)||!arrival_contains(hero,101,home)||!arrival_contains(hero,1,effect))std::abort();
    extra.r[R_ECX]=agent;if(guest_call(&extra,0x00626310u)!=hero)std::abort();
    extra.r[R_ECX]=guild;if(guest_call(&extra,0x00626310u)!=home)std::abort();
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    const uint32_t members=departure_list(extra,scratch,guild,"members");
    const auto before_members=departure_list_state(members,27);
    DepartureQueues before_queues{},after_queues{};
    if(!before_members.valid||before_members.count!=1||before_members.matches!=1||
       !departure_queues(manager,agent,before_queues)||before_queues.omitted!=1)std::abort();
    const uint32_t entries=rd32(manager+0x34),grid=rd32(factory+0x88);
    if(!gm_valid(grid,0x50)||rd32(grid+0x48)!=256||rd32(grid+0x4c)!=256)std::abort();
    uint32_t cells=0;if(!joint_motion_physical(factory,hero,cells))std::abort();
    auto rendering=[&]() {
        LiveDrawing r;const auto all=pair_rendering(factory);if(!all.valid)return r;
        for(uint32_t node=all.head;node;node=rd32(node+4)) {
            const uint32_t u=rd32(node+0x10);if(u==hero||u==effect){++r.excluded;continue;}
            ++r.kept;r.hash=(r.hash^node)*1099511628211ull;
            for(uint32_t off=8;off!=0x14;off+=4)r.hash=(r.hash^rd32(node+off))*1099511628211ull;
        }
        r.valid=true;return r;
    };
    auto before_render=rendering();if(!before_render.valid||!before_render.excluded)std::abort();
    if(!primary_file(extra,scratch,"Hero_Departure_Hero_Before.UNIT",factory,hero,true,nullptr,true)||
       !primary_file(extra,scratch,"Hero_Departure_Effect_Before.UNIT",factory,effect,true,nullptr,true)||
       !primary_file(extra,scratch,"Hero_Departure_Guild_Before.UNIT",factory,home,true,nullptr,true)||
       agent_file(extra,scratch,"Hero_Departure_Agent_Before.GPL",agent,true)||
       agent_file(extra,scratch,"Hero_Departure_Guild_Before.GPL",guild,true)||
       !majesty_browser_frontier_registered_hero_departure_checkpoint(&extra,false))std::abort();
    std::fprintf(stderr,"[streaming] Hero departure prepared hero=502 effect=503 agent=27 guild=469 guild-agent=7 clock=25800 members=1 queued=1 physical=1 footprint=%u before-saved=1 result=pass\n",cells);
    // Remove only the typed guild list entry using original operator5 and pool
    // ownership. Stable logical guild membership belongs to the paired store.
    extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t operand=guest_call(&extra,0x0062a810u,5u);
    if(!gm_valid(operand,16))std::abort();extra.r[R_ECX]=operand;guest_call(&extra,0x006254c0u,27u);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+32+0x18,scratch+64);
    extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,5u);
    extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);
    const auto after_members=departure_list_state(members,27);
    if(!after_members.valid||after_members.count||after_members.matches||after_members.other_hash!=before_members.other_hash)std::abort();
    // Child first: use its original parent unlink/command/render retirement,
    // then retire the hero and its script through the original lifecycle.
    extra.r[R_ECX]=effect;guest_call(&extra,0x005a21b0u);
    if(native(503)||arrival_contains(hero,1,effect)||rd32(manager+0x48))std::abort();
    extra.r[R_ECX]=hero;guest_call(&extra,0x005a21b0u);
    if(rd32(manager+0x48)!=1)std::abort();extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
    if(native(502)||native(503)||lookup(27)||native(469)!=home||lookup(7)!=guild||rd32(manager+0x48)||
       arrival_contains(home,100,hero)||!departure_queues(manager,agent,after_queues)||after_queues.omitted||rd32(manager+0x34)+1!=entries)std::abort();
    before_queues.omitted=0;if(after_queues!=before_queues)std::abort();
    before_render.excluded=0;if(rendering()!=before_render)std::abort();
    const uint32_t buckets=rd32(grid+0x18);if(!gm_valid(buckets,256*256*4))std::abort();
    uint32_t matches=0;
    for(uint32_t cell=0;cell<256*256;++cell) {
        const uint32_t bucket=rd32(buckets+cell*4);if(!bucket)continue;if(!gm_valid(bucket,32))std::abort();
        for(uint32_t slot=0;slot<8&&rd32(bucket+slot*4);++slot){const uint32_t u=rd32(bucket+slot*4);matches+=u==hero||u==effect;}
    }
    if(matches||rd32(factory+0x28)!=native_counter||rd32(runtime+0x34)!=script_counter||rd32(0x0071c6a8)!=clock||mods_hooks_installed_count()!=hooks||
       !primary_file(extra,scratch,"Hero_Departure_Guild_After.UNIT",factory,home,true,nullptr,true)||
       agent_file(extra,scratch,"Hero_Departure_Guild_After.GPL",guild,true)||!heap_free(scratch)||
       !majesty_browser_frontier_registered_hero_departure_checkpoint(&extra,true))std::abort();
    std::fprintf(stderr,"[streaming] Hero departure removed hero=502 effect=503 agent=27 guild=469 guild-agent=7 clock=25800 members=0 native-members=0 aliases-absent=1 queue-absent=1 other-queues-preserved=1 drawing-absent=1 other-drawing-preserved=1 grid-absent=1 counters-preserved=1 hooks-preserved=1 after-saved=1 owner-published=0 travel-qualified=0 result=pass\n");
#endif
}
static void original_registered_hero_reload_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted=false;const char *flag=recomp_env("BROWSER_STREAMING_HERO_RELOAD_FIXTURE");
    const char *profile=recomp_env("PROFILE_DIR");std::string_view path(profile?profile:"");
    constexpr std::string_view suffix="/frontier_1_0";
    if(attempted||!flag||std::strcmp(flag,"1")||!path.ends_with(suffix))return;
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');
    const auto owned=path.substr(slash==path.npos?0:slash+1);
    const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c);
    const char *selected=recomp_env("RULE_FRONTIER_REGION");
    if(!enabled()||!selected||std::strcmp(selected,"1_0")||!owned.starts_with("actor-arrival-fixture-hero-reload-")||owned.size()>80||
       recomp_env("RULE_FRONTIER_CHAPTER")||!gm_valid(state,0x50)||rd32(state)!=3||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    attempted=true;X86 extra=*c;extra.r[R_ESP]-=32768;
    char pathbuf[1024];std::array<uint32_t,4> ids{};
    FILE *f=recomp_writable_path("Hero_Reload_Identity.bin",pathbuf,sizeof pathbuf)?std::fopen(pathbuf,"rb"):nullptr;
    const bool read=f&&std::fread(ids.data(),1,16,f)==16&&std::fgetc(f)==EOF&&!std::ferror(f);if(f)std::fclose(f);
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u),clock=rd32(0x0071c6a8),hooks=mods_hooks_installed_count();
    if(!read||ids!=std::array<uint32_t,4>{554,555,48,18250}||clock!=ids[3]||!gm_valid(factory,0x88)||!gm_valid(runtime,0x38))std::abort();
    const uint32_t manager=rd32(runtime+4);if(!gm_valid(manager,0x4c)||rd32(manager+0x48))std::abort();
    const auto queues=pair_queues(manager);
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t agent=lookup(ids[2]),proxy=lookup(45);
    uint32_t units[2]{};for(unsigned i=0;i<2;++i){extra.r[R_ECX]=factory;units[i]=guest_call(&extra,0x005a10d0u,ids[i]);}
    if(!gm_valid(agent,0x34)||!gm_valid(proxy,0x34)||!gm_valid(units[0],0x164)||!gm_valid(units[1],0x164)||
       rd32(agent+0x20)!=ids[0]||rd8(agent+0x28)||rd32(proxy+0x20)||rd32(proxy+0x24)||
       rd32(units[0]+0x74)||rd32(units[1]+0x74)!=ids[0]||rd32(units[0]+0x84)!=factory||rd32(units[1]+0x84)!=factory)std::abort();
    extra.r[R_ECX]=agent;if(guest_call(&extra,0x00626310u)!=units[0])std::abort();
    extra.r[R_ECX]=proxy;if(guest_call(&extra,0x00626310u))std::abort();
    if(!arrival_contains(units[0],1,units[1]))std::abort();
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    auto expected=std::make_unique<PrimaryBytes>(),observed=std::make_unique<PrimaryBytes>();
    auto load=[&](const char *name,PrimaryBytes &b,size_t length){size_t n=0;return recomp_writable_path(name,pathbuf,sizeof pathbuf)&&arrival_bytes(pathbuf,b,n)&&n==length;};
    bool equal=true;
    for(unsigned i=0;i<2;++i){const char *input=i?"Hero_Reload_Effect_Input.UNIT":"Hero_Reload_Hero_Input.UNIT";
        const char *output=i?"Hero_Reload_Effect_Observed.UNIT":"Hero_Reload_Hero_Observed.UNIT";const size_t size=i?151:418;
        equal=equal&&load(input,*expected,size)&&primary_file(extra,scratch,output,factory,units[i],true,nullptr,true)&&
              load(output,*observed,size)&&!std::memcmp(expected->data(),observed->data(),size);}
    equal=equal&&load("Hero_Reload_Agent_Input.GPL",*expected,1846)&&!agent_file(extra,scratch,"Hero_Reload_Agent_Observed.GPL",agent,true)&&
          load("Hero_Reload_Agent_Observed.GPL",*observed,1846)&&!std::memcmp(expected->data(),observed->data(),1846);
    equal=equal&&load("Hero_Reload_Orders_Input.bin",*expected,208)&&live_banks_equal(extra,units[1],expected->data(),208);
    if(!equal||pair_queues(manager)!=queues||rd32(0x0071c6a8)!=clock||mods_hooks_installed_count()!=hooks||
       !majesty_browser_frontier_registered_hero_reload_checkpoint(&extra))std::abort();
    std::fprintf(stderr,"[streaming] Hero reload saved hero=554 effect=555 agent=48 proxy=45 clock=18250 links=1 exact-records=1 original-full-load=1 scheduled=0 owner-published=0 travel-qualified=0 result=pass\n");
    for(unsigned i=2;i--;){extra.r[R_ECX]=units[i];guest_call(&extra,0x005a21b0u);}
    extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
    for(uint32_t id:{554u,555u}){extra.r[R_ECX]=factory;if(guest_call(&extra,0x005a10d0u,id))std::abort();}
    if(lookup(48)||lookup(45)!=proxy||!heap_free(scratch))std::abort();
    std::fprintf(stderr,"[streaming] Hero reload cleanup original-removal=1 aliases-absent=1 proxy-preserved=1 hooks-removed=1 result=pass\n");
#endif
}
static void original_home_validity_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted = false;
    const char *flag = recomp_env("BROWSER_STREAMING_HOME_VALIDITY_FIXTURE");
    if (attempted || !flag || std::strcmp(flag, "v1") || !isolated_fixture()) return;
    const uint32_t state = rd32(0x006d7670), world = rd32(0x0071c68c);
    if (!gm_valid(state, 0x50) || rd32(state) != 3 || !world ||
        mods_hook_depth() || !sched_holds_baton() ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) return;
    attempted = true;
    X86 extra = *c;
    extra.r[R_ESP] -= 32768;
    const uint32_t runtime = guest_call(&extra, 0x00623b20u);
    if (!gm_valid(runtime, 0x38)) std::abort();
    const uint32_t manager = rd32(runtime + 4), clock = rd32(0x0071c6a8);
    const uint32_t counter = rd32(runtime + 0x34), hooks = mods_hooks_installed_count();
    if (!gm_valid(manager, 0x38)) std::abort();
    const auto queues = pair_queues(manager);
    std::array<uint32_t, 3> agents{};
    constexpr std::array<uint32_t, 3> ids = {7, 12, 20};
    for (size_t i = 0; i < ids.size(); ++i) {
        extra.r[R_ECX] = runtime;
        agents[i] = guest_call(&extra, 0x006236b0u, ids[i]);
        if (!gm_valid(agents[i], 0x34) || rd32(agents[i] + 0x10) != ids[i] ||
            rd8(agents[i] + 0x28) || rd32(agents[i] + 0x20) != (i ? 0u : 469u))
            std::abort();
        // Resolve the existing local association through its original lazy
        // getter before taking the object comparison baseline.
        extra.r[R_ECX] = agents[i];
        const uint32_t native = guest_call(&extra, 0x00626310u);
        if (i ? native != 0 : !gm_valid(native, 0x88) || rd32(native + 0x60) != 469u)
            std::abort();
    }
    std::array<std::array<uint8_t, 0x34>, 3> before{};
    for (size_t i = 0; i < ids.size(); ++i)
        std::memcpy(before[i].data(), gm_ptr(agents[i]), before[i].size());
    const auto heap_before = heap_stats();
    const uint32_t scratch = heap_alloc(64, true);
    if (!scratch) std::abort();
    bool ok = true;
    for (size_t i = 0; i < ids.size(); ++i) {
        extra.r[R_ECX] = scratch;
        guest_call(&extra, 0x006254c0u, ids[i]);
        const bool reference = rd32(scratch) == 0x0068c054u && rd32(scratch + 4) == 5u &&
                               rd32(scratch + 8) == ids[i] && rd32(scratch + 12) == agents[i];
        extra.r[R_ECX] = scratch;
        const uint32_t valid = guest_call(&extra, 0x00625580u);
        const bool unchanged = !std::memcmp(before[i].data(), gm_ptr(agents[i]), before[i].size());
        const bool passed = reference && valid == (i ? 0u : 1u) && unchanged;
        ok = ok && passed;
        std::fprintf(stderr, "[streaming] Home validity id=%u native-id=%u native-loaded=%u "
            "deleted=%u reference=%u original-valid=%u unchanged=%u result=%s\n", ids[i],
            rd32(agents[i] + 0x20), unsigned(rd32(agents[i] + 0x24) != 0),
            unsigned(rd8(agents[i] + 0x28)), unsigned(reference), valid,
            unsigned(unchanged), passed ? "pass" : "fail");
    }
    heap_free(scratch);
    const auto heap_after = heap_stats();
    ok = ok && heap_before.used_blocks == heap_after.used_blocks &&
         heap_before.used_bytes == heap_after.used_bytes &&
         heap_before.req_bytes == heap_after.req_bytes && pair_queues(manager) == queues &&
         rd32(runtime + 0x34) == counter && rd32(0x0071c6a8) == clock &&
         rd32(0x0071c68c) == world && mods_hooks_installed_count() == hooks;
    std::fprintf(stderr, "[streaming] Home validity boundary clock=%u aliases=3 scratch=64 "
        "home-written=0 pure-agents-scheduled=0 state-preserved=%u result=%s\n",
        clock, unsigned(ok), ok ? "pass" : "fail");
    if (!ok) std::abort();
#endif
}
// Latch at the original use_building dispatch before its guard runs. Allow
// the original caller's context cleanup, then hold whole agent invocations
// from a quiescent frame. This native trial does not implement remote homes.
namespace {
struct HomeTaskState {
    uint32_t world = 0, runtime = 0, agent = 0, unit = 0;
    uint32_t hook = 0, dispatch_hook = 0, hooks_before = 0;
    uint32_t stage = 0, start = 0, held_calls = 0, resumed_calls = 0, building_calls = 0;
    uint32_t before_clock = 0, after_clock = 0;
    uint64_t fingerprint = 0;
    uint32_t skipped_dispatches = 0;
    bool fingerprint_ready = false, before_saved = false, release = false, running = false;
    bool motion_trial = false;
    uint32_t command_hook = 0, motion_start = 0, motion_resume = 0;
    uint32_t command_held = 0, command_resumed = 0, command_other = 0, motion_agent_held = 0;
    std::array<uint32_t, 5> motion_position{};
};
HomeTaskState home_task;
struct HomeTaskView {
    uint32_t home = 0, target = 0, active = 0, task = 0;
    uint32_t values = 0, contexts = 0;
    uint64_t fingerprint = 14695981039346656037ull;
    char function[64]{};
    bool going_home = false;
    uint32_t step = 0;
};
bool home_text(uint32_t string, const char *expected) {
    const size_t length = std::strlen(expected);
    if (!gm_valid(string, 12) || rd32(string + 8) != length) return false;
    const uint32_t text = rd32(string);
    if (!gm_valid(text, uint32_t(length + 1)) || rd8(text + uint32_t(length))) return false;
    for (size_t i = 0; i < length; ++i)
        if (rd8(text + uint32_t(i)) != uint8_t(expected[i])) return false;
    return true;
}
bool home_task_view(uint32_t agent, HomeTaskView &v, uint32_t agent_id = 27,
                    uint32_t unit_id = 502, uint32_t home_id = 7) {
    v.step = 1;
    if (!gm_valid(agent, 0x34) || rd32(agent + 0x10) != agent_id || rd32(agent + 0x20) != unit_id ||
        rd8(agent + 0x28)) return false;
    auto digest = [&](uint32_t at, uint32_t bytes) {
        if (!gm_valid(at, bytes)) return false;
        for (uint32_t i = 0; i < bytes; ++i) {
            v.fingerprint ^= rd8(at + i); v.fingerprint *= 1099511628211ull;
        }
        return true;
    };
    if (!digest(agent, 0x34)) return false;
    v.step = 2;
    const uint32_t attributes = rd32(agent), nil = rd32(0x006d7300u);
    if (!gm_valid(attributes, 16) || !gm_valid(nil, 32)) return false;
    const uint32_t head = rd32(attributes + 4), count = rd32(attributes + 12);
    if (!gm_valid(head, 32) || !count || count > 128) return false;
    std::array<uint32_t, 128> pending{}, seen{};
    uint32_t queued = 0, visited = 0;
    const uint32_t root = rd32(head + 4);
    if (root != nil) pending[queued++] = root;
    while (queued) {
        const uint32_t node = pending[--queued];
        if (!gm_valid(node, 32) || visited >= count) return false;
        for (uint32_t i = 0; i < visited; ++i) if (seen[i] == node) return false;
        seen[visited++] = node;
        for (uint32_t link : {rd32(node), rd32(node + 8)}) if (link != nil) {
            if (queued == pending.size()) return false;
            pending[queued++] = link;
        }
        const uint32_t value = rd32(node + 24);
        uint32_t *slot = nullptr;
        if (home_text(node + 12, "home")) slot = &v.home;
        else if (home_text(node + 12, "target")) slot = &v.target;
        else if (home_text(node + 12, "activescript")) slot = &v.active;
        else if (home_text(node + 12, "taskname")) slot = &v.task;
        if (slot) { if (*slot || !gm_valid(value, 8)) return false; *slot = value; }
    }
    v.values = visited;
    v.step = 3;
    if (visited != count || !v.home || !v.target || !v.active || !v.task ||
        !gm_valid(v.home, 16) || !gm_valid(v.target, 16) || !gm_valid(v.active, 0x45) ||
        !gm_valid(v.task, 20)) return false;
    if (rd32(v.home + 4) != 5 || rd32(v.target + 4) != 5 || rd32(v.active + 4) != 8 ||
        rd32(v.task + 4) != 3) return false;
    live_name(v.active, v.function, sizeof v.function);
    // Original00639220 promotes +0xc to +8 before dispatch. At this earlier
    // agent boundary the pending function is the effective next script.
    const uint32_t pending_function = rd32(v.active + 12);
    if (pending_function) {
        if (!gm_valid(pending_function, 12)) return false;
        const uint32_t text = rd32(pending_function), length = rd32(pending_function + 8);
        if (length >= sizeof v.function || !gm_valid(text, length)) return false;
        std::memset(v.function, 0, sizeof v.function);
        for (uint32_t i = 0; i < length; ++i) v.function[i] = char(rd8(text + i));
    }
    v.step = 4;
    v.going_home = rd32(v.home + 8) == home_id && rd32(v.target + 8) == home_id &&
                   home_text(v.task + 8, "go_home") && !std::strcmp(v.function, "use_building");
    if (!digest(v.home, 16) || !digest(v.target, 16) || !digest(v.active, 0x45) ||
        !digest(v.task, 20)) return false;
    const uint32_t bytes = rd32(v.task + 16), text = rd32(v.task + 8);
    v.step = 5;
    if (bytes > 64 || !digest(text, bytes + 1)) return false;
    const uint32_t list = rd32(agent + 8), functions = rd32(agent + 12);
    v.step = 6;
    // The original recruited Warrior has twelve named function contexts.
    // Keep a bounded compatible margin; a single AI queue entry is not the
    // count of all its named contexts.
    if (!gm_valid(list, 24) || functions > 16) return false;
    uint32_t node = rd32(list);
    while (node != list) {
        v.step = 7;
        if (!gm_valid(node, 24) || v.contexts >= functions) return false;
        const uint32_t context = rd32(node + 20);
        if (!digest(context, 0x45) || rd32(context + 4) != 8) return false;
        ++v.contexts; node = rd32(node);
    }
    v.step = 8;
    return v.contexts == functions;
}
void home_task_dispatch(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    auto &s = home_task;
    if (s.running && rd32(0x00720304u) == s.agent && gm_valid(cpu->ecx, 24) &&
        home_text(cpu->ecx, "use_building")) {
        if (s.stage < 2) {
            HomeTaskView view;
            if (!home_task_view(s.agent, view)) std::abort();
            if (!view.going_home && !s.stage) {
                if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
                return;
            }
            if (!view.going_home || !gm_valid(cpu->esp, 8)) std::abort();
            if (!s.stage) {
                s.stage = 1; s.start = rd32(0x0071c6a8);
                std::fprintf(stderr, "[streaming] Home task requested agent=27 unit=502 home=7 target=7 "
                    "task=go_home function=use_building clock=%u attributes=%u contexts=%u "
                    "boundary=dispatch before-guard=1\n", s.start, view.values, view.contexts);
            }
            // Original00639220 still owns its running flag and last-tick
            // cleanup after this void RET4. Do not undo those writes.
            if (++s.skipped_dispatches > 16 || mods_hook_return(api, cpu, 0, 4) != POP_OK)
                std::abort();
            return;
        }
        ++s.building_calls;
        if (s.building_calls == 1)
            std::fprintf(stderr, "[streaming] Home task original-building agent=27 unit=502 called=1\n");
    }
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
}
std::array<uint32_t, 5> home_motion_position(uint32_t unit) {
    return {rd32(unit + 0x48), rd32(unit + 0x4c), rd32(unit + 0x50),
            rd32(unit + 0x54), rd32(unit + 0x58)};
}
void home_task_command(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    auto &s = home_task;
    const bool owned = gm_valid(cpu->ecx, 8) && rd32(cpu->ecx + 4) == s.unit;
    if (owned && s.stage == 4) {
        if (!gm_valid(cpu->esp, 8) || !gm_valid(rd32(cpu->esp + 4), 0x1c) ||
            rd32(0x0071c68c) != s.world || home_motion_position(s.unit) != s.motion_position ||
            rd32(s.unit + 0x74) || ++s.command_held > 4096 ||
            mods_hook_return(api, cpu, 0, 4) != POP_OK) std::abort();
        return;
    }
    if (!owned && s.stage == 4 && ++s.command_other > 65536) std::abort();
    if (owned && s.stage == 5 && ++s.command_resumed > 4096) std::abort();
    if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
}
void home_task_agent(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    auto &s = home_task;
    static uint32_t reports = 0;
    if (gm_valid(cpu->ecx, 0x34) && rd32(cpu->ecx + 0x10) == 27 && reports++ < 4)
        std::fprintf(stderr, "[streaming] Home task invocation agent=27 matches=%u world-same=%u "
            "clock=%u native-id=%u\n", unsigned(cpu->ecx == s.agent),
            unsigned(rd32(0x0071c68c) == s.world), rd32(0x0071c6a8), rd32(cpu->ecx + 0x20));
    if (cpu->ecx != s.agent || rd32(0x0071c68c) != s.world) {
        if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
        return;
    }
    HomeTaskView v;
    if (!home_task_view(s.agent, v)) std::abort();
    if (s.stage == 4) {
        if (v.fingerprint != s.fingerprint || rd32(v.home + 8) != 7 || rd32(v.target + 8) != 7 ||
            !home_text(v.task + 8, "go_home") || std::strcmp(v.function, "travel_to") ||
            !gm_valid(cpu->esp, 12) || rd32(0x00720304u) || ++s.motion_agent_held > 4096 ||
            mods_hook_return(api, cpu, 0, 8) != POP_OK) std::abort();
        return;
    }
    static uint32_t target_reports = 0;
    if (!s.stage && rd32(v.home + 8) == 7 && rd32(v.target + 8) == 7 && target_reports++ < 4)
        std::fprintf(stderr, "[streaming] Home task candidate agent=27 task-home=%u active=%s "
            "pending=%u contexts=%u\n", unsigned(home_text(v.task + 8, "go_home")), v.function,
            unsigned(rd32(v.active + 12) != 0), v.contexts);
    if (s.stage == 1 && !s.release) {
        if (!v.going_home || (s.fingerprint_ready && v.fingerprint != s.fingerprint) || !gm_valid(cpu->esp, 12) ||
            rd32(0x00720304u) || mods_hook_return(api, cpu, 0, 8) != POP_OK) std::abort();
        HomeTaskView after;
        if (!home_task_view(s.agent, after) || after.fingerprint != v.fingerprint) std::abort();
        if (++s.held_calls > 4096) std::abort();
        return;
    }
    const bool resuming = s.stage == 1 && s.release;
    if (resuming) {
        if (!v.going_home || v.fingerprint != s.fingerprint) std::abort();
        s.stage = 2;
    }
    const bool prior = s.running; s.running = true;
    const auto status = mods_call_next(api, inv, cpu);
    s.running = prior;
    if (status != POP_OK) std::abort();
    if (s.stage == 2) ++s.resumed_calls;
    if (resuming)
        std::fprintf(stderr, "[streaming] Home task resumed agent=27 unit=502 clock=%u "
            "held-calls=%u original-returned=1 result=pass\n", rd32(0x0071c6a8), s.held_calls);
}
void home_task_frame(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted = false;
    const char *flag = recomp_env("BROWSER_STREAMING_HOME_TASK_FIXTURE");
    if (!flag || std::strcmp(flag, "v1") || !isolated_fixture()) return;
    auto &s = home_task;
    const uint32_t world = rd32(0x0071c68c), phase = rd32(0x006d7670);
    if (!gm_valid(phase, 0x50) || rd32(phase) != 3 || !world || mods_hook_depth() ||
        !sched_holds_baton() || c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) return;
    X86 extra = *c; extra.r[R_ESP] -= 32768;
    if (!attempted) {
        attempted = true; s.world = world;
        s.runtime = guest_call(&extra, 0x00623b20u);
        extra.r[R_ECX] = s.runtime; s.agent = guest_call(&extra, 0x006236b0u, 27u);
        if (!gm_valid(s.agent, 0x34)) std::abort();
        extra.r[R_ECX] = s.agent; s.unit = guest_call(&extra, 0x00626310u);
        HomeTaskView view;
        const bool readable = home_task_view(s.agent, view);
        if (!readable) {
            const uint32_t attributes = rd32(s.agent);
            std::fprintf(stderr, "[streaming] Home task refused attributes=%u visited=%u "
                "types=%u,%u,%u,%u contexts=%u step=%u task-bytes=%u functions=%u\n",
                gm_valid(attributes, 16) ? rd32(attributes + 12) : 0, view.values,
                gm_valid(view.home, 8) ? rd32(view.home + 4) : UINT32_MAX,
                gm_valid(view.target, 8) ? rd32(view.target + 4) : UINT32_MAX,
                gm_valid(view.active, 8) ? rd32(view.active + 4) : UINT32_MAX,
                gm_valid(view.task, 8) ? rd32(view.task + 4) : UINT32_MAX, view.contexts, view.step,
                gm_valid(view.task, 20) ? rd32(view.task + 16) : UINT32_MAX, rd32(s.agent + 12));
        }
        if (!gm_valid(s.unit, 0x164) || rd32(s.unit + 0x60) != 502 || !readable) std::abort();
        s.hooks_before = mods_hooks_installed_count();
        const char *motion = recomp_env("BROWSER_STREAMING_HOME_MOTION_FIXTURE");
        s.motion_trial = motion && !std::strcmp(motion, "1");
        if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00626cf0u, 0, home_task_agent,
            POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &s.hook) != POP_OK ||
            mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x006381b0u, 0, home_task_dispatch,
            POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &s.dispatch_hook) != POP_OK) std::abort();
        if (s.motion_trial && mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005e53c0u, 0,
            home_task_command, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &s.command_hook) != POP_OK)
            std::abort();
        std::fprintf(stderr, "[streaming] Home task installed agent=27 unit=502 attributes=%u "
            "contexts=%u active=%s result=pass\n", view.values, view.contexts, view.function);
    }
    if (s.world != world) std::abort();
    if (s.stage == 1 && (!s.before_saved || rd32(0x0071c6a8) - s.start >= 1000)) {
        if (!s.fingerprint_ready) {
            HomeTaskView settled;
            if (!home_task_view(s.agent, settled) || !settled.going_home) std::abort();
            s.fingerprint = settled.fingerprint; s.fingerprint_ready = true;
        }
        const uint32_t scratch = heap_alloc(512, true);
        if (!scratch) std::abort();
        const bool before = !s.before_saved;
        const char *name = before ? "Hero_Home_Held_Before.GPL" : "Hero_Home_Held_After.GPL";
        const uint32_t clock = rd32(0x0071c6a8);
        const bool wrote = !agent_file(extra, scratch, name, s.agent, true);
        heap_free(scratch);
        HomeTaskView view;
        if (!wrote || !home_task_view(s.agent, view) || view.fingerprint != s.fingerprint ||
            rd32(0x0071c6a8) != clock) std::abort();
        if (before) { s.before_saved = true; s.before_clock = clock; }
        else { s.release = true; s.after_clock = clock; }
        std::fprintf(stderr, "[streaming] Home task snapshot stage=%s clock=%u "
            "fingerprint=%016llx saved=1 result=pass\n", before ? "before" : "after", clock,
            (unsigned long long)view.fingerprint);
    }
    // Completing this gate trial requires original dispatch/return, not
    // eventual physical building entry. Neither is a regional handoff.
    if (s.stage == 2 && s.building_calls && s.resumed_calls) {
        const uint32_t parent = rd32(s.unit + 0x74);
        if (parent && parent != 469) std::abort();
        HomeTaskView resumed, after_write;
        if (!home_task_view(s.agent, resumed) || rd32(resumed.home + 8) != 7 ||
            rd32(resumed.target + 8) != 7 || !home_text(resumed.task + 8, "go_home") ||
            parent || std::strcmp(resumed.function, "travel_to")) std::abort();
        const uint32_t scratch = heap_alloc(512, true), clock = rd32(0x0071c6a8);
        if (!scratch) std::abort();
        const bool wrote = !agent_file(extra, scratch, "Hero_Home_Resumed.GPL", s.agent, true);
        heap_free(scratch);
        if (!wrote || !home_task_view(s.agent, after_write) ||
            after_write.fingerprint != resumed.fingerprint || rd32(0x0071c6a8) != clock) std::abort();
        std::fprintf(stderr, "[streaming] Home task continuation clock=%u home=7 target=7 "
            "task=go_home function=travel_to saved=1 result=pass\n", clock);
        if (s.motion_trial) {
            s.stage = 4; s.motion_start = clock; s.fingerprint = resumed.fingerprint;
            s.motion_position = home_motion_position(s.unit);
            if (!majesty_browser_frontier_home_motion_checkpoint(&extra, 0)) std::abort();
            HomeTaskView after_save;
            if (!home_task_view(s.agent, after_save) || after_save.fingerprint != s.fingerprint ||
                home_motion_position(s.unit) != s.motion_position || rd32(0x0071c6a8) != clock)
                std::abort();
            std::fprintf(stderr, "[streaming] Home motion held-before clock=%u agent=27 unit=502 "
                "position=%u,%u,%u,%u,%u original-saved=1 result=pass\n", clock,
                s.motion_position[0], s.motion_position[1], s.motion_position[2],
                s.motion_position[3], s.motion_position[4]);
        }
    }
    if (s.stage == 4 && rd32(0x0071c6a8) - s.motion_start >= 1000) {
        HomeTaskView view;
        const uint32_t clock = rd32(0x0071c6a8);
        if (!s.command_held || !s.motion_agent_held || !s.command_other ||
            home_motion_position(s.unit) != s.motion_position || rd32(s.unit + 0x74) ||
            !home_task_view(s.agent, view) || view.fingerprint != s.fingerprint ||
            !majesty_browser_frontier_home_motion_checkpoint(&extra, 1)) std::abort();
        HomeTaskView after_save;
        if (!home_task_view(s.agent, after_save) || after_save.fingerprint != s.fingerprint ||
            home_motion_position(s.unit) != s.motion_position || rd32(0x0071c6a8) != clock)
            std::abort();
        std::fprintf(stderr, "[streaming] Home motion held-after clock=%u agent=27 unit=502 "
            "command-held=%u agent-held=%u other-delegated=%u original-saved=1 result=pass\n",
            clock, s.command_held, s.motion_agent_held, s.command_other);
        s.stage = 5; s.motion_resume = clock;
    }
    if (s.stage == 5 && rd32(0x0071c6a8) - s.motion_resume >= 1000) {
        const uint32_t clock = rd32(0x0071c6a8), parent = rd32(s.unit + 0x74);
        const auto position = home_motion_position(s.unit);
        if (!s.command_resumed || (position == s.motion_position && !parent) ||
            (parent && parent != 469) || !majesty_browser_frontier_home_motion_checkpoint(&extra, 2))
            std::abort();
        std::fprintf(stderr, "[streaming] Home motion resumed clock=%u agent=27 unit=502 "
            "command-returned=%u parent=%u position=%u,%u,%u,%u,%u original-saved=1 result=pass\n",
            clock, s.command_resumed, parent, position[0], position[1], position[2], position[3], position[4]);
    }
    if ((!s.motion_trial && s.stage == 2 && s.building_calls && s.resumed_calls) ||
        (s.motion_trial && s.stage == 5 && rd32(0x0071c6a8) - s.motion_resume >= 1000)) {
        const uint32_t parent = rd32(s.unit + 0x74);
        if (mods_hook_remove(MODS_OWNER_RUNTIME, s.hook) != POP_OK ||
            mods_hook_remove(MODS_OWNER_RUNTIME, s.dispatch_hook) != POP_OK ||
            (s.motion_trial && mods_hook_remove(MODS_OWNER_RUNTIME, s.command_hook) != POP_OK) ||
            mods_hooks_installed_count() != s.hooks_before) std::abort();
        s.hook = s.dispatch_hook = s.command_hook = 0; s.stage = 3;
        std::fprintf(stderr, "[streaming] Home task gate-complete agent=27 unit=502 home=7 parent=%u "
            "held-calls=%u resumed-calls=%u original-building-calls=%u skipped-dispatches=%u "
            "hooks-removed=1 entry-qualified=0 travel-qualified=0 result=pass\n", parent,
            s.held_calls, s.resumed_calls, s.building_calls,
            s.skipped_dispatches);
    }
#endif
}
// A native destination trial of the actual original imported/reloaded Warrior.
// Full load already performs spatial/render/animation finalization. Publish only
// one original AI queue entry; retain a remote request before its dead-home guard.
// This is deliberately separate from selected regional ownership publication.
struct RegisteredHeroLive {
    uint32_t stage=0,world=0,factory=0,runtime=0,manager=0,unit=0,agent=0,proxy=0,effect=0;
    uint32_t start=0,hooks_before=0,agent_hook=0,dispatch_hook=0,command_hook=0;
    uint32_t agent_returned=0,agent_held=0,other_agents=0,hero_commands=0,effect_commands=0;
    uint32_t remote_clock=0,remote_dispatches=0,context_returned=0;
    uint64_t held_fingerprint=0;
    bool remote_requested=false,held_ready=false;
};
RegisteredHeroLive registered_hero_live;
struct RegisteredOrderMembers {
    uint32_t kept=0,matches=0;uint64_t hash=14695981039346656037ull;
};
bool registered_order_members(uint32_t factory,uint32_t unit,RegisteredOrderMembers &out) {
    out={};const uint32_t registry=rd32(factory+0x84);
    if(!gm_valid(registry,12))return false;
    const uint32_t head=rd32(registry+4);if(!gm_valid(head,12))return false;
    uint32_t entry=rd32(head),groups=0,found=0;
    while(entry!=head) {
        if(++groups>128||!gm_valid(entry,12))return false;
        const uint32_t group=rd32(entry+8);if(!gm_valid(group,0x30))return false;
        if(rd32(group+4)==0x5244524f) {
            if(++found!=1||rd32(group)!=0x0068b6f0)return false;
            const uint32_t begin=rd32(group+0x10),end=rd32(group+0x14),count=rd32(group+0x18);
            if(count>4096||count!=rd32(group+0x2c)||!gm_valid(begin,4)||!gm_valid(end,4))return false;
            const uint32_t stop=rd32(end);uint32_t node=rd32(begin),visited=0;
            while(node!=stop) {
                if(++visited>count||!gm_valid(node,12))return false;
                const uint32_t member=rd32(node+8);if(!gm_valid(member,0x88))return false;
                if(member==unit)++out.matches;
                else{++out.kept;for(uint32_t v:{member,rd32(member+0x60)})out.hash=(out.hash^v)*1099511628211ull;}
                node=rd32(node);
            }
            if(visited!=count)return false;
        }
        entry=rd32(entry);
    }
    return found==1&&out.matches<=1;
}
struct HaloBundleLive {
    uint32_t stage=0,world=0,factory=0,runtime=0,manager=0,start=0,extent=0,hooks_before=0;
    uint32_t agent_hook=0,context_hook=0,command_hook=0,samples=0,changed=0;
    std::array<uint32_t,3> agents{};
    std::array<uint32_t,4> units{},ids{},commands{};
    std::array<uint32_t,2> ai{},contexts{};
    std::array<int32_t,3> initial{},previous{};
    bool reloaded=false;
    uint32_t effect_retired=0,retired_on_load=0;
};
HaloBundleLive halo_bundle_live;
static void halo_bundle_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_bundle_live;int index=-1;
    if(s.stage==1)for(unsigned k=1;k<3;++k)if(cpu->ecx==s.agents[k])index=int(k-1);
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(index>=0&&++s.ai[index]>4096)std::abort();
}
static void halo_bundle_context(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_bundle_live;int index=-1;
    if(s.stage==1)for(unsigned k=1;k<3;++k)if(rd32(0x00720304u)==s.agents[k])index=int(k-1);
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(index>=0&&++s.contexts[index]>4096)std::abort();
}
static void halo_bundle_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_bundle_live;int index=-1;
    if(s.stage==1&&gm_valid(cpu->ecx,8))for(unsigned k=0;k<4;++k)
        if(s.units[k]&&rd32(cpu->ecx+4)==s.units[k])index=int(k);
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(index>=0&&++s.commands[index]>4096)std::abort();
}
static void arm_halo_bundle_live(X86 &extra,uint32_t scratch,uint32_t world,
    uint32_t factory,uint32_t runtime,uint32_t manager,const uint32_t (&agents)[3],
    const uint32_t (&units)[4],const uint32_t (&ids)[4],bool reloaded,uint32_t retired_on_load) {
    auto &s=halo_bundle_live;const uint32_t clock=rd32(0x0071c6a8);
    if(s.stage||(retired_on_load&&(!reloaded||retired_on_load!=4))||
       clock!=(reloaded?(retired_on_load?1000u:500u):0u))std::abort();
    s.start=clock;s.reloaded=reloaded;s.retired_on_load=retired_on_load;
    s.world=world;s.factory=factory;s.runtime=runtime;s.manager=manager;
    s.hooks_before=mods_hooks_installed_count();
    std::copy_n(agents,3,s.agents.begin());std::copy_n(units,4,s.units.begin());std::copy_n(ids,4,s.ids.begin());
    const uint32_t grid=rd32(factory+0x88);s.extent=gm_valid(grid,0x50)?rd32(grid+0x48):0;
    const uint32_t cx=rd32(units[0]+0x54),cy=rd32(units[0]+0x58);uint32_t cells=0;
    const bool physical=joint_motion_physical(factory,units[0],cells,s.extent);
    if(s.extent!=256||rd32(grid+0x4c)!=s.extent||cx>=s.extent||cy>=s.extent||
       (reloaded?(!physical||cells!=4):(physical||cells)))std::abort();
    if(!reloaded){
    extra.r[R_ECX]=grid;const uint32_t point[]={units[0],cx,cy,0x200u,0u,0u};
    const auto clearance=guest_call_guarded(&extra,0x005b8eb0u,point,6);
    if(clearance.status!=GuestCallGuardedStatus::Returned||(clearance.eax&255)) {
        std::fprintf(stderr,"[streaming] Halo bundle live refused boundary=collision cell=%u,%u result=fail\n",cx,cy);std::abort();
    }
    for(unsigned k=0;k<4;++k) {
        if(rd32(rd32(units[k])+0x1b4)!=0x005a2370u)std::abort();
        extra.r[R_ECX]=units[k];if(!(guest_call(&extra,0x005a2370u)&255))std::abort();
    }
    extra.r[R_ECX]=units[0];guest_call(&extra,0x005ad3e0u);
    }
    if(!joint_motion_physical(factory,units[0],cells,s.extent)||cells!=4)std::abort();
    for(unsigned k=0;k<4;++k) {
        if(retired_on_load&(1u<<k)){if(units[k])std::abort();continue;}
        if(rd32(rd32(units[k])+0x1b8)!=0x005a2420u||rd32(rd32(units[k])+0xa4)!=0x005b66f0u)std::abort();
        if(!reloaded){extra.r[R_ECX]=units[k];guest_call(&extra,0x005a2420u);}
        RegisteredOrderMembers before{},after{};
        if(!registered_order_members(factory,units[k],before))std::abort();
        if(!before.matches){extra.r[R_ECX]=units[k];guest_call(&extra,0x005b66f0u,0x5244524fu);}
        if(!registered_order_members(factory,units[k],after)||after.matches!=1||
           before.kept!=after.kept||before.hash!=after.hash)std::abort();
    }
    for(unsigned k=1;k<3;++k) {
        const uint32_t pending=rd32(manager+0x3c);DepartureQueues before{},after{};
        if((pending!=manager+0x10&&pending!=manager+0x1c)||
           !departure_queues(manager,agents[k],before)||before.omitted!=(reloaded?1u:0u))std::abort();
        if(reloaded)continue;
        wr32(scratch+144,agents[k]);extra.r[R_ECX]=pending;
        guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);
        if(!departure_queues(manager,agents[k],after)||after.omitted!=1)std::abort();
        after.omitted=0;if(after!=before)std::abort();
    }
    const auto drawing=live_drawing(factory,units[0]);
    if(!drawing.valid||drawing.excluded!=1||!majesty_browser_frontier_halo_bundle_checkpoint(&extra,false))std::abort();
    for(unsigned k=0;k<3;++k)s.initial[k]=s.previous[k]=int32_t(rd32(units[0]+0x48+k*4));
    if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,halo_bundle_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x006381b0u,0,halo_bundle_context,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.context_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,halo_bundle_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK)std::abort();
    s.stage=1;
    std::fprintf(stderr,"[streaming] Halo bundle live activated hero=%u flag=%u effects=%u,%u clock=%u footprint=4 drawing=1 command-members=%u queued=2 ready-saved=1 owner-published=0 result=pass\n",ids[0],ids[1],ids[2],ids[3],clock,retired_on_load?3u:4u);
}
static void original_halo_bundle_live_reload(X86 *c) {
#ifndef __EMSCRIPTEN__
    auto &s=halo_bundle_live;const char *flag=recomp_env("BROWSER_STREAMING_HALO_BUNDLE_RELOAD");
    if(s.stage||!flag||std::strcmp(flag,"1"))return;
    const char *profile=recomp_env("PROFILE_DIR"),*binding=recomp_env("BROWSER_STREAMING_HALO_BUNDLE_RELOAD_BINDING");
    const std::string_view path(profile?profile:"");const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!enabled()||!path.ends_with("/frontier_0_-1")||path.find("/actor-arrival-fixture-halo-world-bundle-")==path.npos||
       !binding||std::strlen(binding)!=64||recomp_env("BROWSER_STREAMING_HALO_BUNDLE_IMPORT")||
       !gm_valid(phase,0x50)||rd32(phase)!=3||!gm_valid(world,0x14)||mods_hook_depth()||!sched_holds_baton())return;
    const char *route_flag=recomp_env("BROWSER_STREAMING_HALO_ROUTE_SELECTED");
    const bool selected=route_flag&&!std::strcmp(route_flag,"1");
    if(route_flag&&!selected)std::abort();
    const uint32_t clock=selected?1000u:500u,bytes=selected?44u:36u;
    if(rd32(0x0071c6a8)!=clock)std::abort();
    char filename[1024];std::array<uint32_t,11> ids{};
    if(!recomp_writable_path("Halo_Live_Reload.ids",filename,sizeof filename)||
       loader_hash_file_bounded(filename,bytes)!=binding)std::abort();
    FILE *file=std::fopen(filename,"rb");const bool read=file&&std::fread(ids.data(),1,bytes,file)==bytes&&std::fgetc(file)==EOF&&!std::ferror(file);
    if(file)std::fclose(file);if(!read||ids[0]!=0x31524248||ids[1]!=clock||(selected&&(ids[9]!=4||ids[10]!=0)))std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))std::abort();const uint32_t manager=rd32(runtime+4);
    uint32_t units[4]{},actors[4]{},agents[3]{};
    for(unsigned k=0;k<4;++k){actors[k]=ids[k+2];extra.r[R_ECX]=factory;units[k]=guest_call(&extra,0x005a10d0u,actors[k]);
        if(selected&&k==2){if(units[k])std::abort();}else if(!gm_valid(units[k],0x94))std::abort();}
    for(unsigned k=0;k<3;++k){extra.r[R_ECX]=runtime;agents[k]=guest_call(&extra,0x006236b0u,ids[k+6]);if(!gm_valid(agents[k],0x34)||rd32(agents[k]+0x20)!=(k?actors[k-1]:0u))std::abort();}
    const bool hero_flag=arrival_contains(units[0],101,units[1]),flag_hero=arrival_contains(units[1],100,units[0]);
    if(rd32(units[0])!=0x0068098c||rd32(units[1])!=0x0068071c||(!selected&&rd32(units[2]+0x74)!=actors[0])||rd32(units[3]+0x74)!=actors[0]||
       (selected?(hero_flag||flag_hero):(!hero_flag||!flag_hero)))std::abort();
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    arm_halo_bundle_live(extra,scratch,world,factory,runtime,manager,agents,units,actors,true,selected?4u:0u);
    if(!heap_free(scratch))std::abort();
    if(selected)std::fprintf(stderr,"[streaming] Halo route owner reload clock=%u hero=%u flag=%u survivor=%u retired=%u home=%u agents=%u,%u imported=0 expired-effect-restored=0 reward-rejoined=0 result=pass\n",clock,actors[0],actors[1],actors[3],actors[2],ids[6],ids[7],ids[8]);
    else std::fprintf(stderr,"[streaming] Halo bundle fresh reload clock=500 hero=%u flag=%u effects=%u,%u home=%u agents=%u,%u imported=0 original-world-reader=1 result=pass\n",actors[0],actors[1],actors[2],actors[3],ids[6],ids[7],ids[8]);
#endif
}
static void halo_bundle_live_frame(X86 *c) {
#ifndef __EMSCRIPTEN__
    auto &s=halo_bundle_live;if(s.stage!=1)return;
    const uint32_t clock=rd32(0x0071c6a8);
    if(rd32(0x0071c68c)!=s.world||clock-s.start>600||mods_hook_depth()||!sched_holds_baton())std::abort();
    if(clock==s.start)return;
    X86 extra=*c;extra.r[R_ESP]-=32768;
    for(unsigned k=0;k<4;++k) {
        extra.r[R_ECX]=s.factory;
        const uint32_t actual=guest_call(&extra,0x005a10d0u,s.ids[k]);
        if(s.reloaded&&k==2&&!actual){
            if(s.retired_on_load&4)continue;
            if(clock<800||!s.commands[k])std::abort();
            if(!s.effect_retired){s.effect_retired=clock;std::fprintf(stderr,"[streaming] Halo bundle effect retired id=%u clock=%u original-commands=%u result=pass\n",s.ids[k],clock,s.commands[k]);}
            continue;
        }
        if(actual!=s.units[k]||(rd32(actual+0x64)&4)){
            std::fprintf(stderr,"[streaming] Halo bundle live refused boundary=actor clock=%u index=%u present=%u flags=%u result=fail\n",clock,k,unsigned(actual!=0),gm_valid(actual,0x68)?rd32(actual+0x64):0);std::abort();
        }
    }
    std::array<int32_t,3> pose{};for(unsigned k=0;k<3;++k)pose[k]=int32_t(rd32(s.units[0]+0x48+k*4));
    uint32_t cells=0;const auto drawing=live_drawing(s.factory,s.units[0]);
    if(!joint_motion_physical(s.factory,s.units[0],cells,s.extent)||cells!=4||!drawing.valid||drawing.excluded!=1)std::abort();
    if(++s.samples>32)std::abort();if(pose!=s.previous)++s.changed;s.previous=pose;
    if(clock-s.start<500)return;
    const bool hero_to_flag=arrival_contains(s.units[0],101,s.units[1]),flag_to_hero=arrival_contains(s.units[1],100,s.units[0]);
    std::fprintf(stderr,"[streaming] Halo bundle live endpoint clock=%u changed=%u ai=%u,%u contexts=%u,%u commands=%u,%u,%u,%u pose-same=%u reciprocal=%u,%u\n",clock,s.changed,s.ai[0],s.ai[1],s.contexts[0],s.contexts[1],s.commands[0],s.commands[1],s.commands[2],s.commands[3],unsigned(pose==s.initial),unsigned(arrival_contains(s.units[0],101,s.units[1])),unsigned(arrival_contains(s.units[1],100,s.units[0])));
    if(!s.changed||pose==s.initial||!s.ai[0]||!s.ai[1]||!s.contexts[0]||!s.contexts[1]||
       !s.commands[0]||!s.commands[1]||(!s.commands[2]&&!(s.retired_on_load&4))||!s.commands[3]||
       (s.reloaded?(hero_to_flag!=flag_to_hero):(!hero_to_flag||!flag_to_hero)))std::abort();
    if(s.reloaded)std::fprintf(stderr,"[streaming] Halo bundle reward association clock=%u present=%u native-reciprocal=1 original-contexts=%u result=pass\n",clock,unsigned(hero_to_flag),s.contexts[1]);
    if(!majesty_browser_frontier_halo_bundle_checkpoint(&extra,true))std::abort();
    if(mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK||
       mods_hook_remove(MODS_OWNER_RUNTIME,s.context_hook)!=POP_OK||
       mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK||mods_hooks_installed_count()!=s.hooks_before)std::abort();
    const uint32_t phase=rd32(0x006d7670);extra.r[R_ECX]=phase;guest_call(&extra,0x00416050u,7u);
    if(!gm_valid(phase,0x50)||rd32(phase)!=3||rd32(phase+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();
    s.stage=2;
    std::fprintf(stderr,"[streaming] Halo bundle live evolved clock=%u changed=%u ai=%u,%u contexts=%u,%u commands=%u,%u,%u,%u initial=%d,%d,%d accepted=%d,%d,%d footprint=4 drawing=1 reciprocal=1 evolved-saved=1 original-pause=1 hooks-removed=1 source-retired=0 owner-published=0 result=pass\n",clock,s.changed,s.ai[0],s.ai[1],s.contexts[0],s.contexts[1],s.commands[0],s.commands[1],s.commands[2],s.commands[3],s.initial[0],s.initial[1],s.initial[2],pose[0],pose[1],pose[2]);
#endif
}
static void retire_outdoor_family_home_source(X86 &extra,uint32_t scratch,uint32_t world,
    uint32_t factory,uint32_t runtime,uint32_t manager) {
    char path[1024];std::array<uint32_t,12> binding{};
    FILE *f=recomp_writable_path("Family_Return_Binding.bin",path,sizeof path)?std::fopen(path,"rb"):nullptr;
    const bool read=f&&std::fread(binding.data(),1,48,f)==48&&std::fgetc(f)==EOF&&!std::ferror(f);if(f)std::fclose(f);
    if (!read || binding!=std::array<uint32_t,12>{0x31525246,1,57650,504,28,469,7,24250,561,49,0,0} ||
        rd32(0x0071c68c)!=world || rd32(0x0071c6a8)!=57650) std::abort();
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const char *fresh_flag=recomp_env("BROWSER_STREAMING_SESSION_HOME_IMPORT_FIXTURE");
    if (fresh_flag&&!std::strcmp(fresh_flag,"v1")) {
        // This selected dormant world has already retired the old local aliases.
        // Do not restore a pre-imported home world or delete another local actor.
        for(uint32_t id:{504u,527u,528u,529u})if(native(id))std::abort();
        const uint32_t home=native(469),guild=lookup(7);
        if(lookup(28)||!gm_valid(home,0x98)||rd32(home+0x6c)!=0x31564241||!gm_valid(guild,0x34)||rd32(guild+0x20)!=469)std::abort();
        const auto roster=departure_list_state(departure_list(extra,scratch,guild,"members"),28);
        if(!roster.valid||roster.count||roster.matches||!majesty_browser_frontier_outdoor_family_return_checkpoint(&extra,1))std::abort();
        std::fprintf(stderr,"[streaming] Family return dormant home=469/7 clock=57650 aliases-absent=1 roster-empty=1 source-already-retired=1 original-removal=0 saved=1 result=pass\n");
        return;
    }
    uint32_t units[4]{};constexpr uint32_t ids[]={504,527,528,529},desc[]={0x314c5641,0x32485241,0x31475241,0x33475241};
    for(unsigned i=0;i<4;++i){units[i]=native(ids[i]);if(!gm_valid(units[i],0x164)||rd32(units[i]+0x6c)!=desc[i]||rd32(units[i]+0x74)!=(i?504u:0u))std::abort();}
    const uint32_t agent=lookup(28),guild=lookup(7),home=native(469),hooks=mods_hooks_installed_count();
    if(!gm_valid(agent,0x34)||!gm_valid(guild,0x34)||!gm_valid(home,0x98)||rd32(agent+0x20)!=504||rd32(guild+0x20)!=469||
        rd32(home+0x6c)!=0x31564241||!arrival_contains(home,100,units[0])||!arrival_contains(units[0],101,home))std::abort();
    for(unsigned i=1;i<4;++i)if(!arrival_contains(units[0],1,units[i]))std::abort();
    const uint32_t members=departure_list(extra,scratch,guild,"members"),entries=rd32(manager+0x34),
        native_counter=rd32(factory+0x28),script_counter=rd32(runtime+0x34);
    const auto roster=departure_list_state(members,28);DepartureQueues queues_before{},queues_after{};NativeRegistrySnapshot before,after;
    if(!roster.valid||roster.count!=1||roster.matches!=1||!departure_queues(manager,agent,queues_before)||queues_before.omitted!=1||
        !native_registry_snapshot(factory,before,0,units,4)||!majesty_browser_frontier_outdoor_family_return_checkpoint(&extra,0))std::abort();
    extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t operand=guest_call(&extra,0x0062a810u,5u);if(!gm_valid(operand,16))std::abort();
    extra.r[R_ECX]=operand;guest_call(&extra,0x006254c0u,28u);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);
    extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,5u);
    extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);
    for(unsigned i=4;i--;){extra.r[R_ECX]=units[i];guest_call(&extra,0x005a21b0u);}
    extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
    const auto empty=departure_list_state(members,28);queues_before.omitted=0;
    for(const auto id:ids)if(native(id))std::abort();
    if(lookup(28)||native(469)!=home||lookup(7)!=guild||!empty.valid||empty.count||empty.matches||empty.other_hash!=roster.other_hash||
        !native_registry_snapshot(factory,after)||before!=after||!departure_queues(manager,agent,queues_after)||queues_after!=queues_before||
        rd32(manager+0x34)+1!=entries||rd32(manager+0x48)||rd32(factory+0x28)!=native_counter||rd32(runtime+0x34)!=script_counter||
        rd32(0x0071c6a8)!=57650||mods_hooks_installed_count()!=hooks||!majesty_browser_frontier_outdoor_family_return_checkpoint(&extra,1))std::abort();
    std::fprintf(stderr,"[streaming] Family return source-retired hero=504 effects=527,528,529 agent=28 guild=469/7 clock=57650 aliases-absent=1 roster-empty=1 other-registry-preserved=1 other-queues-preserved=1 original-removal=1 saved=1 result=pass\n");
}
struct OutdoorFamilyHomeReturn {
    uint32_t world=0,factory=0,runtime=0,manager=0,agent=0,guild=0,home=0,agent_id=0,start=0;
    uint32_t hooks_before=0,agent_hook=0,command_hook=0,lookup_hook=0,agent_calls=0,other_agents=0,other_commands=0;
    std::array<uint32_t,4> units{},ids{},command_calls{};QueueEntryTrial entry{};
    bool active=false,complete=false;
};
OutdoorFamilyHomeReturn outdoor_family_return;
void outdoor_family_return_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=outdoor_family_return;const bool owned=s.active&&cpu->ecx==s.agent;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.active){auto &n=owned?s.agent_calls:s.other_agents;if(++n>65536)std::abort();}
}
void outdoor_family_return_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=outdoor_family_return;int index=-1;
    if(s.active&&gm_valid(cpu->ecx,8))for(unsigned i=0;i<4;++i)if(rd32(cpu->ecx+4)==s.units[i])index=int(i);
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.active){auto &n=index<0?s.other_commands:s.command_calls[unsigned(index)];if(++n>65536)std::abort();}
}
static void arm_outdoor_family_home_return(X86 &extra,uint32_t scratch,uint32_t world,
    uint32_t factory,uint32_t runtime,uint32_t manager,uint32_t agent,uint32_t guild,
    const uint32_t (&units)[4],const uint32_t (&ids)[4],const uint32_t (&counts)[4],
    const std::array<std::array<uint32_t,32>,4> &addresses) {
    auto &s=outdoor_family_return;if(s.active||s.complete)std::abort();
    s.world=world;s.factory=factory;s.runtime=runtime;s.manager=manager;s.agent=agent;s.guild=guild;
    s.agent_id=rd32(agent+0x10);s.start=rd32(0x0071c6a8);s.hooks_before=mods_hooks_installed_count();
    std::copy_n(units,4,s.units.begin());std::copy_n(ids,4,s.ids.begin());
    extra.r[R_ECX]=factory;s.home=guest_call(&extra,0x005a10d0u,469u);
    if(!gm_valid(s.home,0x98)||rd32(guild+0x20)!=469||!arrival_contains(units[0],101,s.home)){
        std::fprintf(stderr,"[streaming] Family return rejected boundary=home-link result=fail\n");std::abort();}
    const uint32_t members=departure_list(extra,scratch,guild,"members");const auto roster=departure_list_state(members,s.agent_id);
    if(!roster.valid||roster.count||roster.matches){std::fprintf(stderr,"[streaming] Family return rejected boundary=roster result=fail\n");std::abort();}
    extra.r[R_ECX]=s.home+0x94;if(!(guest_call(&extra,0x00598e20u,units[0],s.home,100u)&255)||!arrival_contains(s.home,100,units[0])){
        std::fprintf(stderr,"[streaming] Family return rejected boundary=reciprocal-home result=fail\n");std::abort();}
    extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t operand=guest_call(&extra,0x0062a810u,5u);if(!gm_valid(operand,16))std::abort();
    extra.r[R_ECX]=operand;guest_call(&extra,0x006254c0u,s.agent_id);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);
    extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,4u);
    extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);
    const auto added=departure_list_state(members,s.agent_id);HomeTaskView v;
    if(!added.valid||added.count!=1||added.matches!=1||added.other_hash!=roster.other_hash||
        !home_task_view(agent,v,s.agent_id,ids[0],7)||rd32(v.home+8)!=7||rd32(v.target+8)!=7||
        !home_text(v.task+8,"go_home")||std::strcmp(v.function,"travel_to")){
        std::fprintf(stderr,"[streaming] Family return rejected boundary=home-task step=%u function=%s count=%u matches=%u result=fail\n",v.step,v.function,added.count,added.matches);std::abort();}
    for(unsigned i=0;i<4;++i){extra.r[R_ECX]=units[i];if(!(guest_call(&extra,0x005a2370u)&255)){
        std::fprintf(stderr,"[streaming] Family return rejected boundary=finalization index=%u result=fail\n",i);std::abort();}}
    uint32_t cells=0;const auto drawing=live_drawing(factory,units[0]);
    const bool physical=joint_motion_physical(factory,units[0],cells);
    // The private UNIT reader defers grid admission. A full original GMP load
    // must establish the collision footprint before any ordinary actor update.
    if(physical||cells||!drawing.valid||drawing.excluded!=1){std::fprintf(stderr,"[streaming] Family return rejected boundary=deferred-placement physical=%u cells=%u drawing=%u draw-count=%u parent=%u result=fail\n",unsigned(physical),cells,unsigned(drawing.valid),drawing.excluded,rd32(units[0]+0x74));std::abort();}
    const uint32_t bank=rd32(units[0]+0x8c),head=gm_valid(bank,20)?rd32(bank+12):0,node=gm_valid(head,12)?rd32(head):0,
        order=gm_valid(node,12)?rd32(node+8):0;
    if(!gm_valid(bank,20)||rd32(bank+16)!=1||!gm_valid(order,72)||rd32(order+16)!=7||rd32(order+0x20)!=469||rd32(order+0x2c)!=4099){std::fprintf(stderr,"[streaming] Family return rejected boundary=queue-command result=fail\n");std::abort();}
    s.entry=QueueEntryTrial{units[0],s.home,factory,bank,order};
    const uint32_t pending=rd32(manager+0x3c);DepartureQueues before{},after{};
    if((pending!=manager+0x10&&pending!=manager+0x1c)||!departure_queues(manager,agent,before)||before.omitted)std::abort();
    wr32(scratch+144,agent);extra.r[R_ECX]=pending;guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);
    if(!departure_queues(manager,agent,after)||after.omitted!=1)std::abort();after.omitted=0;if(after!=before)std::abort();
    if(!majesty_browser_frontier_outdoor_family_return_checkpoint(&extra,2))std::abort();
    std::fprintf(stderr,"[streaming] Family return prepared hero=%u agent=%u guild=469/7 clock=57650 finalized=4 physical=0 drawing=1 native-roster=1 script-roster=1 queued=1 full-load-required=1 ordinary-updates=0 saved=1 owner-published=0 result=pass\n",ids[0],s.agent_id);
    extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t remove_operand=guest_call(&extra,0x0062a810u,5u);if(!gm_valid(remove_operand,16))std::abort();
    extra.r[R_ECX]=remove_operand;guest_call(&extra,0x006254c0u,s.agent_id);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,remove_operand);wr32(scratch+56,scratch+64);
    extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,5u);
    extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,remove_operand);
    extra.r[R_ECX]=manager;guest_call(&extra,0x006332c0u,agent);
    for(unsigned i=4;i--;){extra.r[R_ECX]=units[i];guest_call(&extra,0x005a21b0u);}
    extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
    uint32_t freed=0;for(unsigned i=0;i<4;++i){
        extra.r[R_ECX]=factory;if(guest_call(&extra,0x005a10d0u,ids[i]))std::abort();
        for(uint32_t j=0;j<counts[i];++j){if(heap_owns(addresses[i][j]))std::abort();freed++;}
    }
    extra.r[R_ECX]=runtime;if(guest_call(&extra,0x006236b0u,s.agent_id))std::abort();
    const auto empty=departure_list_state(members,s.agent_id);
    if(!empty.valid||empty.count||empty.matches||!departure_queues(manager,agent,after)||after!=before||
        rd32(0x0071c6a8)!=57650||mods_hooks_installed_count()!=s.hooks_before||freed!=42)std::abort();
    s.complete=true;
    std::fprintf(stderr,"[streaming] Family return prepared-cleanup requests=42 original-removal=1 aliases-absent=1 roster-empty=1 other-queues-preserved=1 hooks-preserved=1 saved-ready-retained=1 result=pass\n");
}
void outdoor_family_return_frame(X86 *c) {
#ifndef __EMSCRIPTEN__
    auto &s=outdoor_family_return;if(s.complete||mods_hook_depth()||!sched_holds_baton()||
        c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    if(!s.active){
        const char *flag=recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_RETURN_RELOAD"),*profile=recomp_env("PROFILE_DIR");
        const std::string_view path(profile?profile:"");const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
        if(!flag||std::strcmp(flag,"1")||path.find("/actor-arrival-fixture-outdoor-family-return-")==path.npos||!path.ends_with("/frontier_0_0")||
            !gm_valid(phase,0x50)||rd32(phase)!=3||!gm_valid(world,0x14))return;
        X86 extra=*c;extra.r[R_ESP]-=32768;char filename[1024];std::array<uint32_t,12> identity{};
        FILE *f=recomp_writable_path("Family_Return_Reload_Identity.bin",filename,sizeof filename)?std::fopen(filename,"rb"):nullptr;
        const bool read=f&&std::fread(identity.data(),1,48,f)==48&&std::fgetc(f)==EOF&&!std::ferror(f);if(f)std::fclose(f);
        if(!read||identity[0]!=0x314c5246||identity[1]!=1||identity[2]!=57650||identity[8]!=469||identity[9]!=7||identity[10]||identity[11]||rd32(0x0071c6a8)!=57650)std::abort();
        s.world=world;s.factory=rd32(world+0x10);s.runtime=guest_call(&extra,0x00623b20u);s.start=57650;s.agent_id=identity[7];
        if(!gm_valid(s.factory,0x8c)||!gm_valid(s.runtime,0x38))std::abort();s.manager=rd32(s.runtime+4);
        auto native=[&](uint32_t id){extra.r[R_ECX]=s.factory;return guest_call(&extra,0x005a10d0u,id);};
        auto lookup=[&](uint32_t id){extra.r[R_ECX]=s.runtime;return guest_call(&extra,0x006236b0u,id);};
        s.home=native(469);s.guild=lookup(7);s.agent=lookup(s.agent_id);
        constexpr uint32_t desc[]={0x314c5641,0x32485241,0x31475241,0x33475241};
        for(unsigned i=0;i<4;++i){s.ids[i]=identity[3+i];s.units[i]=native(s.ids[i]);
            if(!gm_valid(s.units[i],0x164)||rd32(s.units[i]+0x6c)!=desc[i]||rd32(s.units[i]+0x74)!=(i?s.ids[0]:0u))std::abort();}
        for(uint32_t id:{504u,527u,528u,529u})if(native(id))std::abort();
        if(lookup(28)||!gm_valid(s.agent,0x34)||!gm_valid(s.guild,0x34)||!gm_valid(s.home,0x98)||rd32(s.agent+0x20)!=s.ids[0]||rd32(s.guild+0x20)!=469)std::abort();
        HomeTaskView view;DepartureQueues queues{};uint32_t cells=0;const auto drawing=live_drawing(s.factory,s.units[0]);
        if(!home_task_view(s.agent,view,s.agent_id,s.ids[0],7)||rd32(view.home+8)!=7||rd32(view.target+8)!=7||!home_text(view.task+8,"go_home")||std::strcmp(view.function,"travel_to")||
            !departure_queues(s.manager,s.agent,queues)||queues.omitted!=1||!joint_motion_physical(s.factory,s.units[0],cells)||cells!=4||!drawing.valid||drawing.excluded!=1)std::abort();
        const uint32_t bank=rd32(s.units[0]+0x8c),head=gm_valid(bank,20)?rd32(bank+12):0,node=gm_valid(head,12)?rd32(head):0,order=gm_valid(node,12)?rd32(node+8):0;
        if(!gm_valid(order,72)||rd32(order+16)!=7||rd32(order+0x20)!=469||rd32(order+0x2c)!=4099)std::abort();
        s.entry=QueueEntryTrial{s.units[0],s.home,s.factory,bank,order};s.hooks_before=mods_hooks_installed_count();
        if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,outdoor_family_return_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)!=POP_OK||
            mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,outdoor_family_return_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK||
            mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005a10d0u,0,QueueEntryTrial::lookup,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,&s.entry,&s.lookup_hook)!=POP_OK||
            !majesty_browser_frontier_outdoor_family_return_checkpoint(&extra,2))std::abort();
        s.active=true;
        std::fprintf(stderr,"[streaming] Family return ready hero=%u agent=%u guild=469/7 clock=57650 finalized=4 physical=4 drawing=1 native-roster=1 script-roster=1 queued=1 guards=0 ordinary-only=1 saved=1 owner-published=0 result=pass\n",s.ids[0],s.agent_id);
        return;
    }
    const uint32_t clock=rd32(0x0071c6a8);
    if(rd32(0x0071c68c)!=s.world||clock<s.start||clock-s.start>6000)std::abort();
    if(clock-s.start<1000)return;
    X86 extra=*c;extra.r[R_ESP]-=32768;
    extra.r[R_ECX]=s.factory;if(guest_call(&extra,0x005a10d0u,s.ids[0])!=s.units[0])std::abort();
    extra.r[R_ECX]=s.runtime;if(guest_call(&extra,0x006236b0u,s.agent_id)!=s.agent)std::abort();
    if(s.entry.lookups!=1||rd32(s.units[0]+0x74)!=469||!arrival_contains(s.home,100,s.units[0])||
        !arrival_contains(s.home,2,s.units[0])||!arrival_contains(s.units[0],101,s.home)||!s.agent_calls||!s.other_agents||!s.command_calls[0])std::abort();
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    const uint32_t members=departure_list(extra,scratch,s.guild,"members");const auto roster=departure_list_state(members,s.agent_id);
    HomeTaskView view;if(!roster.valid||roster.count!=1||roster.matches!=1||!home_task_view(s.agent,view,s.agent_id,s.ids[0],7))std::abort();
    DepartureQueues queues{};if(!departure_queues(s.manager,s.agent,queues)||queues.omitted!=1||!majesty_browser_frontier_outdoor_family_return_checkpoint(&extra,3))std::abort();
    if(mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK||mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK||
        mods_hook_remove(MODS_OWNER_RUNTIME,s.lookup_hook)!=POP_OK||mods_hooks_installed_count()!=s.hooks_before||!heap_free(scratch))std::abort();
    s.active=false;s.complete=true;
    std::fprintf(stderr,"[streaming] Family return entered hero=%u agent=%u guild=469/7 clock=%u elapsed=%u lookup=1 parent=469 native-rosters=100,2 script-roster=1 queued=1 agent-calls=%u commands=%u,%u,%u,%u other-ai=%u other-commands=%u function=%s ordinary-only=1 saved=1 hooks-removed=1 owner-published=0 result=pass\n",
        s.ids[0],s.agent_id,clock,clock-s.start,s.agent_calls,s.command_calls[0],s.command_calls[1],s.command_calls[2],s.command_calls[3],s.other_agents,s.other_commands,view.function);
#endif
}
// Native-only gate for the actual four-record outdoor capsule. Neither the
// source guild ID nor the anonymous home proxy is a destination native guild.
// Pause both ingress paths before any original actor code can use that ID.
// Execute only the restored effects on ordinary ticks. Hold both hero ingress
// paths; its pending native guild reference and spatial placement stay gated.
struct RegionalHeroEffects {
    uint32_t world=0,factory=0,runtime=0,manager=0,agent=0,proxy=0,agent_id=0,home_id=0,start=0;
    uint32_t hooks_before=0,agent_hook=0,command_hook=0,agent_held=0,other_agents=0,other_commands=0;
    std::array<uint32_t,4> units{},ids{},counts{},commands{},finished{};
    std::array<std::array<uint32_t,32>,4> addresses{};
    std::array<uint8_t,320> binding{};
    uint64_t fingerprint=0;
    uint32_t extent=0,path_calls=0,move_calls=0,queue_held=0,motion_samples=0,last_motion_clock=UINT32_MAX;
    std::array<std::array<uint32_t,6>,256> motion{};
    uint32_t pause_anchor=0;
    bool active=false,complete=false,requested=false,moving=false,reloading=false;
};
RegionalHeroEffects regional_hero_effects;
bool regional_effects_view(HomeTaskView &v){
    auto &s=regional_hero_effects;
    // home_task_view fills an empty view and rejects duplicate named slots.
    // Rechecking an admission view must rebuild it rather than reuse its slots
    // or accumulated fingerprint.
    v=HomeTaskView{};
    return rd32(0x0071c68c)==s.world&&!rd32(s.proxy+0x20)&&!rd32(s.proxy+0x24)&&!rd8(s.proxy+0x28)&&
        home_task_view(s.agent,v,s.agent_id,s.ids[0],s.home_id)&&v.fingerprint==s.fingerprint&&
        rd32(v.home+8)==s.home_id&&rd32(v.target+8)==s.home_id&&home_text(v.task+8,"go_home")&&
        !std::strcmp(v.function,"travel_to");
}
void regional_effects_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *){
    auto &s=regional_hero_effects;
    if(s.active&&cpu->ecx==s.agent){
        HomeTaskView v;const bool valid=regional_effects_view(v);
        if(!valid||rd32(0x00720304u)||++s.agent_held>4096){
            std::fprintf(stderr,"[streaming] Regional home refused boundary=agent view=%u script-depth=%u held=%u clock=%u reload=%u result=fail\n",unsigned(valid),rd32(0x00720304u),s.agent_held,rd32(0x0071c6a8),unsigned(s.reloading));std::abort();
        }
        if(!s.requested){
            char entity[65]{},guild[65]{},world[65]{},content[65]{};
            std::memcpy(entity,s.binding.data()+32,64);std::memcpy(guild,s.binding.data()+96,64);
            std::memcpy(world,s.binding.data()+160,64);std::memcpy(content,s.binding.data()+224,64);
            const char *region=reinterpret_cast<const char *>(s.binding.data()+288);
            char request[2048],path[1024];
            const int n=std::snprintf(request,sizeof request,
                "{\"version\":1,\"kind\":\"registered-home-go_home\",\"entityId\":\"%s\",\"guildEntityId\":\"%s\","
                "\"worldId\":\"%s\",\"contentDigest\":\"%s\",\"receivingRegion\":\"%s\",\"homeRegion\":\"0_0\","
                "\"heroId\":%u,\"agentId\":%u,\"homeUnitId\":469,\"homeAgentId\":7,\"proxyAgentId\":%u,"
                "\"proxyNativeId\":0,\"pauseAnchorClockMs\":%u,\"requestClockMs\":%u,\"ownerPublished\":false}\n",
                entity,guild,world,content,region,s.ids[0],s.agent_id,s.home_id,s.pause_anchor,rd32(0x0071c6a8));
            if(n<=0||size_t(n)>=sizeof request||!recomp_writable_path("Regional_Home_Request.json",path,sizeof path))std::abort();
            FILE *f=std::fopen(path,"wb");if(!f)std::abort();
            const bool ok=std::fwrite(request,1,size_t(n),f)==size_t(n)&&!std::ferror(f);
            if(std::fclose(f)||!ok)std::abort();s.requested=true;
            std::fprintf(stderr,"[streaming] Regional home held hero=%u agent=%u proxy=%u clock=%u before-native-lookup=1 owner-published=0 result=pass\n",s.ids[0],s.agent_id,s.home_id,rd32(0x0071c6a8));
        }
        if(mods_hook_return(api,cpu,0,8)!=POP_OK)std::abort();return;
    }
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.active&&++s.other_agents>65536)std::abort();
}
void regional_effects_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *){
    auto &s=regional_hero_effects;int index=-1;
    if(s.active&&gm_valid(cpu->ecx,8)){
        const uint32_t owner=rd32(cpu->ecx+4);
        for(unsigned i=0;i<4;++i)if(s.units[i]&&owner==s.units[i])index=int(i);
    }
    if(index>=0&&++s.commands[index]>4096)std::abort();
    if(index==0){
        HomeTaskView v;const bool valid=regional_effects_view(v);
        if(!valid||!gm_valid(cpu->esp,8)){
            std::fprintf(stderr,"[streaming] Regional home refused boundary=command view=%u stack=%u clock=%u reload=%u result=fail\n",unsigned(valid),unsigned(gm_valid(cpu->esp,8)),rd32(0x0071c6a8),unsigned(s.reloading));std::abort();
        }
        const uint32_t order=rd32(cpu->esp+4),kind=gm_valid(order,20)?rd32(order+16):0;
        if(s.moving&&kind==4){
            if(cpu->ecx!=rd32(s.units[0]+0x88)||++s.path_calls>4096)std::abort();
            if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();return;
        }
        // The original Path creates its own Move1 in bank0. Admit only that
        // pinned class with its original1007 completion or no procedure,
        // without a script callback. Original1007 finalizes Move1 coordinates;
        // the retained foreign guild completion remains in held bank1.
        const bool original_move=gm_valid(order,0x5c)&&
            ((kind==1&&rd32(order)==0x0068ad74u&&(!rd32(order+0x2c)||rd32(order+0x2c)==0x1007))||
             (kind==2&&rd32(order)==0x006830d8u&&!rd32(order+0x2c)));
        if(s.moving&&original_move&&cpu->ecx==rd32(s.units[0]+0x88)&&!rd32(order+0x30)){
            if(++s.move_calls>4096||mods_call_next(api,inv,cpu)!=POP_OK)std::abort();return;
        }
        if(s.moving&&(kind!=7||cpu->ecx!=rd32(s.units[0]+0x8c))){
            std::fprintf(stderr,"[streaming] Regional motion refused boundary=command kind=%u table=%08x procedure=%u script=%u bank-main=%u bank-task=%u result=fail\n",kind,gm_valid(order,20)?rd32(order):0,gm_valid(order,0x34)?rd32(order+0x2c):0,gm_valid(order,0x34)?rd32(order+0x30):0,unsigned(cpu->ecx==rd32(s.units[0]+0x88)),unsigned(cpu->ecx==rd32(s.units[0]+0x8c)));std::abort();
        }
        if(s.moving)++s.queue_held;
        if(mods_hook_return(api,cpu,0,4)!=POP_OK)std::abort();return;
    }
    if(s.active&&index>0&&s.commands[index]==1)
        std::fprintf(stderr,"[streaming] Regional effect first index=%u clock=%u heap-base=%u flags=%u id=%u\n",unsigned(index),rd32(0x0071c6a8),unsigned(heap_owns(s.units[index])),rd32(s.units[index]+0x64),rd32(s.units[index]+0x60));
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.active&&index>0&&!s.finished[index]&&gm_valid(s.units[index],0x164)&&rd32(s.units[index]+0x60)==s.ids[index]&&(rd32(s.units[index]+0x64)&4)){
        s.finished[index]=rd32(0x0071c6a8);
        constexpr uint32_t source_ids[]={504,527,528,529};
        std::fprintf(stderr,"[streaming] Regional effect finished source=%u id=%u clock=%u elapsed=%u flags=%u original-dispatch=1 result=pass\n",
            source_ids[index],s.ids[index],s.finished[index],s.finished[index]-s.start,rd32(s.units[index]+0x64));
    }
    if(s.active&&index<0&&++s.other_commands>65536)std::abort();
}
static void arm_regional_hero_effects(X86 &extra,uint32_t scratch,uint32_t world,
    uint32_t factory,uint32_t runtime,uint32_t manager,uint32_t agent,uint32_t proxy,
    const uint32_t (&units)[4],const uint32_t (&ids)[4],const uint32_t (&counts)[4],
    const std::array<std::array<uint32_t,32>,4> &addresses){
    auto &s=regional_hero_effects;if(s.active||s.complete)std::abort();
    const char *mode=recomp_env("BROWSER_STREAMING_REGIONAL_HERO_EFFECTS");
    s.moving=mode&&!std::strcmp(mode,"motion-v1");
    s.world=world;s.factory=factory;s.runtime=runtime;s.manager=manager;s.agent=agent;s.proxy=proxy;
    s.start=rd32(0x0071c6a8);s.agent_id=rd32(agent+0x10);s.home_id=rd32(proxy+0x10);s.hooks_before=mods_hooks_installed_count();
    s.pause_anchor=s.start;
    std::copy_n(units,4,s.units.begin());std::copy_n(ids,4,s.ids.begin());std::copy_n(counts,4,s.counts.begin());s.addresses=addresses;
    char path[1024];FILE *f=recomp_writable_path("Regional_Home_Binding.bin",path,sizeof path)?std::fopen(path,"rb"):nullptr;
    const bool read=f&&std::fread(s.binding.data(),1,320,f)==320&&std::fgetc(f)==EOF&&!std::ferror(f);if(f)std::fclose(f);
    const uint32_t header[]={0x31485246,2,469,7,s.home_id,0x31564241,0,0};
    if(!read||std::memcmp(s.binding.data(),header,sizeof header)){
        std::fprintf(stderr,"[streaming] Regional effects refused boundary=binding read=%u home=%u result=fail\n",unsigned(read),s.home_id);std::abort();
    }
    for(unsigned i=32;i<288;++i)if(!((s.binding[i]>='0'&&s.binding[i]<='9')||(s.binding[i]>='a'&&s.binding[i]<='f')))std::abort();
    const char *region=recomp_env("RULE_FRONTIER_REGION");if(!region||std::strlen(region)>=16)std::abort();
    for(unsigned i=0;i<16;++i)if(s.binding[288+i]!=(i<std::strlen(region)?uint8_t(region[i]):0)||
        s.binding[304+i]!=(i<3?uint8_t("0_0"[i]):0))std::abort();
    HomeTaskView v;if(!home_task_view(agent,v,s.agent_id,s.ids[0],s.home_id)){
        std::fprintf(stderr,"[streaming] Regional effects refused boundary=task step=%u contexts=%u agent=%u hero=%u home=%u result=fail\n",v.step,v.contexts,s.agent_id,s.ids[0],s.home_id);std::abort();
    }s.fingerprint=v.fingerprint;
    if(!regional_effects_view(v)){
        std::fprintf(stderr,"[streaming] Regional effects refused boundary=view function=%s home=%u target=%u task-home=%u proxy-native=%u cache=%u deleted=%u result=fail\n",v.function,rd32(v.home+8),rd32(v.target+8),unsigned(home_text(v.task+8,"go_home")),rd32(proxy+0x20),rd32(proxy+0x24),rd8(proxy+0x28));std::abort();
    }
    if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,regional_effects_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,regional_effects_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK)std::abort();
    s.active=true;
    // Original first post-load binds the description and rebuilds vehicle
    // models. Without it the restored animation bank has no model and its
    // original leaf legitimately completes immediately. Keep the hero's AI
    // and commands gated; this stage does not insert its grid footprint.
    for(unsigned i=0;i<4;++i){
        extra.r[R_ECX]=units[i];
        if(rd32(rd32(units[i])+0x1b4)!=0x005a2370u||!(guest_call(&extra,0x005a2370u)&255)){
            std::fprintf(stderr,"[streaming] Regional effects refused boundary=postload index=%u result=fail\n",i);std::abort();
        }
    }
    if(s.moving){
        const uint32_t grid=rd32(factory+0x88),hero=units[0];
        s.extent=gm_valid(grid,0x50)?rd32(grid+0x48):0;
        const uint32_t cx=rd32(hero+0x54),cy=rd32(hero+0x58);
        uint32_t cells=0;
        if((s.extent!=256&&s.extent!=512)||rd32(grid+0x4c)!=s.extent||cx>=s.extent||cy>=s.extent||
           rd32(hero+0x48)/32768!=cx||rd32(hero+0x4c)/32768!=cy||
           joint_motion_physical(factory,hero,cells,s.extent)||cells||rd32(rd32(hero)+0x94)!=0x005ad3e0u)std::abort();
        extra.r[R_ECX]=grid;
        const uint32_t point[]={hero,cx,cy,0x200u,0u,0u};
        const auto clearance=guest_call_guarded(&extra,0x005b8eb0u,point,6);
        if(clearance.status!=GuestCallGuardedStatus::Returned)std::abort();
        const uint32_t blocked=clearance.eax&255;
        if(blocked){std::fprintf(stderr,"[streaming] Regional motion refused boundary=collision cell=%u,%u result=fail\n",cx,cy);std::abort();}
        extra.r[R_ECX]=hero;guest_call(&extra,0x005ad3e0u);
        if(!joint_motion_physical(factory,hero,cells,s.extent)||cells!=4)std::abort();
        const auto drawing=live_drawing(factory,hero);if(!drawing.valid||drawing.excluded!=1)std::abort();
        // Reproduce the second original post-load stage after all family
        // descriptions/models are restored. Hero AI and foreign Queue stay gated.
        for(unsigned i=0;i<4;++i){
            if(rd32(rd32(units[i])+0x1b8)!=0x005a2420u)std::abort();
            extra.r[R_ECX]=units[i];guest_call(&extra,0x005a2420u);
        }
        std::fprintf(stderr,"[streaming] Regional motion placed hero=%u grid=%u cell=%u,%u footprint=%u fixed=%u,%u,%u second-postload=4 path-cache-empty=1 queue-held=1 source-local-position-retained=1 global-continuity=0 owner-published=0 result=pass\n",ids[0],s.extent,cx,cy,cells,rd32(hero+0x48),rd32(hero+0x4c),rd32(hero+0x50));
    }
    for(unsigned i=0;i<4;++i){
        RegisteredOrderMembers before{},after{};
        if(!registered_order_members(factory,units[i],before)||rd32(rd32(units[i])+0xa4)!=0x005b66f0u){
            std::fprintf(stderr,"[streaming] Regional effects refused boundary=admission index=%u result=fail\n",i);std::abort();
        }
        extra.r[R_ECX]=units[i];guest_call(&extra,0x005b66f0u,0x5244524fu);
        if(!registered_order_members(factory,units[i],after)||after.matches!=1||before.kept!=after.kept||before.hash!=after.hash)std::abort();
    }
    const uint32_t pending=rd32(manager+0x3c);DepartureQueues before{},after{};
    if((pending!=manager+0x10&&pending!=manager+0x1c)||!departure_queues(manager,agent,before)||before.omitted){
        std::fprintf(stderr,"[streaming] Regional effects refused boundary=queue before=%u pending-valid=%u result=fail\n",before.omitted,unsigned(pending==manager+0x10||pending==manager+0x1c));std::abort();
    }
    wr32(scratch+144,agent);extra.r[R_ECX]=pending;guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);
    if(!departure_queues(manager,agent,after)||after.omitted!=1)std::abort();after.omitted=0;if(after!=before)std::abort();
    if(!primary_file(extra,scratch,"Regional_Effects_Before_Hero.UNIT",factory,units[0],true,nullptr,true)||
       agent_file(extra,scratch,"Regional_Effects_Before_Hero.GPL",agent,true)||
       !marker_banks_file(extra,units[0],300,"Regional_Effects_Before_Hero_Orders.bin")||
       agent_file(extra,scratch,"Regional_Effects_Before_Proxy.GPL",proxy,true))std::abort();
    std::fprintf(stderr,"[streaming] Regional effects armed hero=%u agent=%u clock=%u home=%u guards=2 effect-ordinary-ticks=1 hero-spatial-finalization=%u owner-published=0 result=pass\n",ids[0],s.agent_id,s.start,s.home_id,unsigned(s.moving));
}
static bool regional_reload_capture(X86 &extra,uint32_t scratch,const char *phase){
    auto &s=regional_hero_effects;char name[128];
    std::snprintf(name,sizeof name,"Regional_Reload_%s_Hero.UNIT",phase);
    if(!primary_file(extra,scratch,name,s.factory,s.units[0],true,nullptr,true))return false;
    std::snprintf(name,sizeof name,"Regional_Reload_%s_Hero.GPL",phase);
    if(agent_file(extra,scratch,name,s.agent,true))return false;
    std::snprintf(name,sizeof name,"Regional_Reload_%s_Hero_Orders.bin",phase);
    if(!marker_banks_file(extra,s.units[0],152,name))return false;
    std::snprintf(name,sizeof name,"Regional_Reload_%s_Proxy.GPL",phase);
    return !agent_file(extra,scratch,name,s.proxy,true);
}
static void arm_regional_hero_reload(X86 &extra,uint32_t scratch,uint32_t world,
    uint32_t factory,uint32_t runtime,uint32_t manager,uint32_t proxy){
    auto &s=regional_hero_effects;if(s.active||s.complete)std::abort();
    auto option=[](const char *name,uint32_t &out){
        const char *value=recomp_env(name);if(!value)return false;
        const std::string_view text(value);const auto parsed=std::from_chars(text.data(),text.data()+text.size(),out);
        return !text.empty()&&parsed.ec==std::errc{}&&parsed.ptr==text.data()+text.size()&&std::to_string(out)==text;
    };
    if(!option("BROWSER_STREAMING_REGIONAL_HERO_ID",s.ids[0])||!s.ids[0]||s.ids[0]>=0x7fffffff||
       !option("BROWSER_STREAMING_REGIONAL_HERO_AGENT",s.agent_id)||!s.agent_id||s.agent_id>=0x7fffffff||
       !option("BROWSER_STREAMING_REGIONAL_HERO_PAUSE_ANCHOR",s.pause_anchor))std::abort();
    s.world=world;s.factory=factory;s.runtime=runtime;s.manager=manager;s.proxy=proxy;
    s.start=rd32(0x0071c6a8);s.home_id=rd32(proxy+0x10);s.hooks_before=mods_hooks_installed_count();s.reloading=true;
    if(s.pause_anchor>s.start)std::abort();
    extra.r[R_ECX]=factory;s.units[0]=guest_call(&extra,0x005a10d0u,s.ids[0]);
    extra.r[R_ECX]=runtime;s.agent=guest_call(&extra,0x006236b0u,s.agent_id);
    if(!gm_valid(s.units[0],0x164)||rd32(s.units[0])!=0x0068098cu||rd32(s.units[0]+0x6c)!=0x314c5641||rd32(s.units[0]+0x74)||
       !gm_valid(s.agent,0x34)||rd32(s.agent+0x20)!=s.ids[0])std::abort();
    // Full-world loading leaves the process-local native backlink lazy. The
    // original record writer resolves it. Warm that same original cache before
    // fingerprinting; require every other live agent byte to remain unchanged.
    std::array<uint8_t,0x34> before_cache{};std::memcpy(before_cache.data(),gm_ptr(s.agent),before_cache.size());
    extra.r[R_ECX]=s.agent;
    if(guest_call(&extra,0x00626310u)!=s.units[0]||rd32(s.agent+0x24)!=s.units[0])std::abort();
    for(unsigned i=0;i<before_cache.size();++i)if((i<0x24||i>=0x28)&&before_cache[i]!=rd8(s.agent+i))std::abort();
    char path[1024];FILE *f=recomp_writable_path("Regional_Home_Binding.bin",path,sizeof path)?std::fopen(path,"rb"):nullptr;
    const bool read=f&&std::fread(s.binding.data(),1,320,f)==320&&std::fgetc(f)==EOF&&!std::ferror(f);if(f)std::fclose(f);
    const uint32_t header[]={0x31485246,2,469,7,s.home_id,0x31564241,0,0};
    if(!read||std::memcmp(s.binding.data(),header,sizeof header))std::abort();
    for(unsigned i=32;i<288;++i)if(!((s.binding[i]>='0'&&s.binding[i]<='9')||(s.binding[i]>='a'&&s.binding[i]<='f')))std::abort();
    const char *region=recomp_env("RULE_FRONTIER_REGION");if(!region||std::strlen(region)>=16)std::abort();
    for(unsigned i=0;i<16;++i)if(s.binding[288+i]!=(i<std::strlen(region)?uint8_t(region[i]):0)||s.binding[304+i]!=(i<3?uint8_t("0_0"[i]):0))std::abort();
    HomeTaskView v;if(!home_task_view(s.agent,v,s.agent_id,s.ids[0],s.home_id))std::abort();s.fingerprint=v.fingerprint;
    if(!regional_effects_view(v))std::abort();
    const uint32_t grid=rd32(factory+0x88);uint32_t cells=0;const auto drawing=live_drawing(factory,s.units[0]);
    s.extent=gm_valid(grid,0x50)?rd32(grid+0x48):0;
    if(!joint_motion_physical(factory,s.units[0],cells,s.extent)||cells!=4||!drawing.valid||drawing.excluded!=1)std::abort();
    for(unsigned i=0;i<3;++i){const uint32_t bank=rd32(s.units[0]+0x88+i*4);if(!gm_valid(bank,20)||rd32(bank+16)!=(i==1?1u:0u))std::abort();}
    const uint32_t bank=rd32(s.units[0]+0x8c),head=rd32(bank+12);
    const uint32_t node=gm_valid(head,12)?rd32(head):0,order=gm_valid(node,12)?rd32(node+8):0;
    if(!gm_valid(order,72)||rd32(order)!=0x0068ae74u||rd32(order+16)!=7||rd32(order+0x20)!=469||rd32(order+0x2c)!=0x1003||rd32(order+8)!=s.pause_anchor)std::abort();
    if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,regional_effects_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,regional_effects_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK)std::abort();
    s.active=true;
    // A whole-world reader already restored this actor's command registration.
    // Re-notifying it also touches the existing AI schedule. Admission must
    // verify the original registration, without repeating that notification.
    RegisteredOrderMembers members{};
    if(!registered_order_members(factory,s.units[0],members)||members.matches!=1){
        std::fprintf(stderr,"[streaming] Regional home refused boundary=reload-registration matches=%u result=fail\n",members.matches);std::abort();
    }
    std::array<uint32_t,22> addresses{},lengths{};
    std::array<std::array<uint8_t,69>,22> live_before{};unsigned captured=0;
    auto remember=[&](uint32_t at,uint32_t length){
        if(captured==addresses.size()||length>69||!gm_valid(at,length))std::abort();
        addresses[captured]=at;lengths[captured]=length;std::memcpy(live_before[captured++].data(),gm_ptr(at),length);
    };
    remember(s.agent,0x34);remember(v.home,16);remember(v.target,16);remember(v.active,0x45);remember(v.task,20);
    remember(rd32(v.task+8),rd32(v.task+16)+1);
    const uint32_t functions=rd32(s.agent+8);uint32_t cursor=rd32(functions);
    for(unsigned i=0;cursor!=functions;++i){if(i>=16||!gm_valid(cursor,24))std::abort();remember(rd32(cursor+20),0x45);cursor=rd32(cursor);}
    DepartureQueues queue{};if(!departure_queues(manager,s.agent,queue)||queue.omitted!=1||!regional_reload_capture(extra,scratch,"Before"))std::abort();
    for(unsigned i=0;i<captured;++i)for(unsigned j=0;j<lengths[i];++j)if(live_before[i][j]!=rd8(addresses[i]+j)){
        std::fprintf(stderr,"[streaming] Regional reload capture changed live group=%u offset=%u before=%u after=%u result=fail\n",i,j,live_before[i][j],rd8(addresses[i]+j));std::abort();
    }
    std::fprintf(stderr,"[streaming] Regional hero reload armed hero=%u agent=%u home=%u clock=%u pause-anchor=%u physical=4 drawing=1 queued=1 imported=0 guards=2 native-cache=1 owner-published=0 result=pass\n",s.ids[0],s.agent_id,s.home_id,s.start,s.pause_anchor);
}
static void regional_hero_reload_finish(X86 *c,uint32_t clock){
    auto &s=regional_hero_effects;if(clock-s.start<3000)return;
    uint32_t cells=0;const auto drawing=live_drawing(s.factory,s.units[0]);DepartureQueues before{},after{};
    if(!s.requested||!s.agent_held||!s.commands[0]||!s.other_agents||!s.other_commands||
       !joint_motion_physical(s.factory,s.units[0],cells,s.extent)||cells!=4||!drawing.valid||drawing.excluded!=1||
       !departure_queues(s.manager,s.agent,before)||before.omitted!=1)std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;const uint32_t scratch=heap_alloc(512,true);if(!scratch||!regional_reload_capture(extra,scratch,"After"))std::abort();
    auto a=std::make_unique<PrimaryBytes>(),b=std::make_unique<PrimaryBytes>();char path[1024],name[128];
    for(const char *suffix:{"Hero.UNIT","Hero.GPL","Hero_Orders.bin","Proxy.GPL"}){
        size_t n=0,m=0;std::snprintf(name,sizeof name,"Regional_Reload_Before_%s",suffix);
        if(!recomp_writable_path(name,path,sizeof path)||!arrival_bytes(path,*a,n))std::abort();
        std::snprintf(name,sizeof name,"Regional_Reload_After_%s",suffix);
        if(!recomp_writable_path(name,path,sizeof path)||!arrival_bytes(path,*b,m)||n!=m||std::memcmp(a->data(),b->data(),n))std::abort();
    }
    before.omitted=0;extra.r[R_ECX]=s.manager;guest_call(&extra,0x006332c0u,s.agent);
    if(!departure_queues(s.manager,s.agent,after)||after!=before)std::abort();
    extra.r[R_ECX]=s.units[0];guest_call(&extra,0x005a21b0u);extra.r[R_ECX]=s.manager;guest_call(&extra,0x00633370u);
    extra.r[R_ECX]=s.factory;if(guest_call(&extra,0x005a10d0u,s.ids[0]))std::abort();
    extra.r[R_ECX]=s.runtime;if(guest_call(&extra,0x006236b0u,s.agent_id))std::abort();
    if(mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK||mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK||mods_hooks_installed_count()!=s.hooks_before||!heap_free(scratch))std::abort();
    s.active=false;s.complete=true;
    std::fprintf(stderr,"[streaming] Regional hero reload cleanup elapsed=%u hero-held=%u agent-held=%u other-ai=%u other-commands=%u original-removal=1 hooks-removed=1 owner-published=0 result=pass\n",clock-s.start,s.commands[0],s.agent_held,s.other_agents,s.other_commands);
}
void regional_hero_effects_frame(X86 *c){
#ifndef __EMSCRIPTEN__
    auto &s=regional_hero_effects;if(!s.active||s.complete||mods_hook_depth()||!sched_holds_baton()||
        c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    const uint32_t clock=rd32(0x0071c6a8);HomeTaskView v;
    const bool valid=regional_effects_view(v);
    if(!valid||uint32_t(clock-s.start)>(s.moving?12000u:6000u)){
        std::fprintf(stderr,"[streaming] Regional home refused boundary=frame view=%u step=%u fingerprint-same=%u world-same=%u proxy-native=%u proxy-cache=%u proxy-retired=%u clock=%u start=%u reload=%u result=fail\n",unsigned(valid),v.step,unsigned(v.fingerprint==s.fingerprint),unsigned(rd32(0x0071c68c)==s.world),rd32(s.proxy+0x20),rd32(s.proxy+0x24),unsigned(rd8(s.proxy+0x28)),clock,s.start,unsigned(s.reloading));std::abort();
    }
    if(s.reloading){regional_hero_reload_finish(c,clock);return;}
    if(s.moving&&clock!=s.last_motion_clock){
        uint32_t cells=0;const auto drawing=live_drawing(s.factory,s.units[0]);
        if(s.motion_samples==s.motion.size()||!joint_motion_physical(s.factory,s.units[0],cells,s.extent)||cells!=4||!drawing.valid||drawing.excluded!=1)std::abort();
        s.motion[s.motion_samples++]={clock,rd32(s.units[0]+0x48),rd32(s.units[0]+0x4c),rd32(s.units[0]+0x50),rd32(s.units[0]+0x54),rd32(s.units[0]+0x58)};
        s.last_motion_clock=clock;
    }
    if(clock-s.start<3000)return;
    if(s.moving){
        const uint32_t bank=rd32(s.units[0]+0x88);
        if(!gm_valid(bank,20))std::abort();
        if(rd32(bank+16))return; // the original Path/Move lifetime owns completion
    }
    for(unsigned i=1;i<4;++i)if(!s.finished[i]){
        std::fprintf(stderr,"[streaming] Regional effects incomplete index=%u calls=%u heap-base=%u flags=%u id=%u elapsed=%u result=fail\n",i,s.commands[i],unsigned(heap_owns(s.units[i])),gm_valid(s.units[i],0x164)?rd32(s.units[i]+0x64):0,gm_valid(s.units[i],0x164)?rd32(s.units[i]+0x60):0,clock-s.start);std::abort();
    }
    constexpr uint32_t expected[]={0,450,700,2700};
    for(unsigned i=1;i<4;++i)if(s.finished[i]-s.start!=expected[i])std::abort();
    if(!s.requested||!s.agent_held||!s.commands[0]||!s.other_agents||!s.other_commands)std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    if(!primary_file(extra,scratch,"Regional_Effects_After_Hero.UNIT",s.factory,s.units[0],true,nullptr,true)||
       agent_file(extra,scratch,"Regional_Effects_After_Hero.GPL",s.agent,true)||
       !marker_banks_file(extra,s.units[0],s.moving?152:300,"Regional_Effects_After_Hero_Orders.bin")||
       agent_file(extra,scratch,"Regional_Effects_After_Proxy.GPL",s.proxy,true))std::abort();
    auto a=std::make_unique<PrimaryBytes>(),b=std::make_unique<PrimaryBytes>();char name[128],path[1024];
    for(const char *suffix:{"Hero.UNIT","Hero.GPL","Hero_Orders.bin","Proxy.GPL"}){
        if(s.moving&&(!std::strcmp(suffix,"Hero.UNIT")||!std::strcmp(suffix,"Hero_Orders.bin")))continue;
        size_t n=0,m=0;std::snprintf(name,sizeof name,"Regional_Effects_Before_%s",suffix);
        if(!recomp_writable_path(name,path,sizeof path)||!arrival_bytes(path,*a,n))std::abort();
        std::snprintf(name,sizeof name,"Regional_Effects_After_%s",suffix);
        if(!recomp_writable_path(name,path,sizeof path)||!arrival_bytes(path,*b,m)||n!=m||std::memcmp(a->data(),b->data(),n))std::abort();
    }
    if(s.moving){
        const uint32_t bank=rd32(s.units[0]+0x88);
        if(!s.path_calls||!s.move_calls||!s.queue_held||!gm_valid(bank,20)||rd32(bank+16)||s.motion_samples<2||
           (s.motion.front()[1]==s.motion[s.motion_samples-1][1]&&s.motion.front()[2]==s.motion[s.motion_samples-1][2])){
            std::fprintf(stderr,"[streaming] Regional motion incomplete path-calls=%u queue-held=%u remaining=%u samples=%u result=fail\n",s.path_calls,s.queue_held,gm_valid(bank,20)?rd32(bank+16):99,s.motion_samples);std::abort();
        }
        if(!recomp_writable_path("Regional_Motion_Samples.bin",path,sizeof path))std::abort();
        FILE *f=std::fopen(path,"wb");if(!f)std::abort();
        const bool ok=std::fwrite(s.motion.data(),24,s.motion_samples,f)==s.motion_samples&&!std::ferror(f);
        if(std::fclose(f)||!ok)std::abort();
        const auto &first=s.motion.front(),&last=s.motion[s.motion_samples-1];
        std::fprintf(stderr,"[streaming] Regional motion complete samples=%u path-calls=%u move-calls=%u queue-held=%u first=%u,%u last=%u,%u path-consumed=1 physical=4 drawing=1 guild-task-held=1 global-continuity=0 owner-published=0 result=pass\n",s.motion_samples,s.path_calls,s.move_calls,s.queue_held,first[1],first[2],last[1],last[2]);
        const char *save=recomp_env("BROWSER_STREAMING_REGIONAL_HERO_SAVE_FIXTURE");
        if(save&&!std::strcmp(save,"1")){
            if(!majesty_browser_frontier_regional_hero_checkpoint(&extra)||rd32(0x0071c6a8)!=clock||!regional_effects_view(v))std::abort();
            if(!primary_file(extra,scratch,"Regional_Motion_Saved_Hero.UNIT",s.factory,s.units[0],true,nullptr,true)||
               agent_file(extra,scratch,"Regional_Motion_Saved_Hero.GPL",s.agent,true)||
               !marker_banks_file(extra,s.units[0],152,"Regional_Motion_Saved_Hero_Orders.bin")||
               agent_file(extra,scratch,"Regional_Motion_Saved_Proxy.GPL",s.proxy,true))std::abort();
            for(const char *suffix:{"Hero.UNIT","Hero.GPL","Hero_Orders.bin","Proxy.GPL"}){
                size_t n=0,m=0;std::snprintf(name,sizeof name,"Regional_Effects_After_%s",suffix);
                if(!recomp_writable_path(name,path,sizeof path)||!arrival_bytes(path,*a,n))std::abort();
                std::snprintf(name,sizeof name,"Regional_Motion_Saved_%s",suffix);
                if(!recomp_writable_path(name,path,sizeof path)||!arrival_bytes(path,*b,m)||n!=m||std::memcmp(a->data(),b->data(),n))std::abort();
            }
            std::fprintf(stderr,"[streaming] Regional motion saved hero=%u agent=%u clock=%u original-whole-world-writer=1 held-records-same=1 owner-published=0 result=pass\n",s.ids[0],s.agent_id,clock);
        }
    }
    DepartureQueues before{},after{};
    if(!departure_queues(s.manager,s.agent,before)||before.omitted!=1)std::abort();before.omitted=0;
    extra.r[R_ECX]=s.manager;guest_call(&extra,0x006332c0u,s.agent);
    if(!departure_queues(s.manager,s.agent,after)||after!=before)std::abort();
    for(unsigned i=4;i--;){
        extra.r[R_ECX]=s.factory;const uint32_t live=guest_call(&extra,0x005a10d0u,s.ids[i]);
        if(live){if(live!=s.units[i])std::abort();extra.r[R_ECX]=live;guest_call(&extra,0x005a21b0u);}
    }
    extra.r[R_ECX]=s.manager;guest_call(&extra,0x00633370u);
    uint32_t freed=0;
    for(unsigned i=0;i<4;++i){
        extra.r[R_ECX]=s.factory;if(guest_call(&extra,0x005a10d0u,s.ids[i]))std::abort();
        for(uint32_t j=0;j<s.counts[i];++j){if(heap_owns(s.addresses[i][j]))std::abort();++freed;}
    }
    extra.r[R_ECX]=s.runtime;if(guest_call(&extra,0x006236b0u,s.agent_id))std::abort();
    if(freed!=42||mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK||mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK||
       mods_hooks_installed_count()!=s.hooks_before||!heap_free(scratch))std::abort();
    s.active=false;s.complete=true;
    std::fprintf(stderr,"[streaming] Regional effects cleanup elapsed=%u finished=450,700,2700 hero-held=%u agent-held=%u effect-calls=%u,%u,%u other-ai=%u other-commands=%u original-removal=1 requests=42 hooks-removed=1 owner-published=0 result=pass\n",clock-s.start,s.commands[0],s.agent_held,s.commands[1],s.commands[2],s.commands[3],s.other_agents,s.other_commands);
#endif
}
struct OutdoorFamilyHomeRoute {
    uint32_t world=0,factory=0,runtime=0,manager=0,agent=0,proxy=0,agent_id=0;
    uint32_t hooks_before=0,agent_hook=0,command_hook=0,request_clock=0;
    uint32_t start_clock=24250,pause_anchor_clock=24250;
    uint32_t agent_held=0,agent_other=0,command_other=0;
    std::array<uint32_t,4> units{},ids{},counts{},command_held{};
    std::array<std::array<uint32_t,32>,4> addresses{};
    std::array<uint8_t,320> binding{};
    uint64_t fingerprint=0;
    bool active=false,requested=false,complete=false,reloaded=false;
};
OutdoorFamilyHomeRoute outdoor_family_route;
bool outdoor_family_route_view(HomeTaskView &v) {
    auto &s=outdoor_family_route;
    v={};
    return rd32(0x0071c68c)==s.world && !rd32(s.proxy+0x20) && !rd32(s.proxy+0x24) && !rd8(s.proxy+0x28) &&
        home_task_view(s.agent,v,s.agent_id,s.ids[0],45) && v.fingerprint==s.fingerprint &&
        rd32(v.home+8)==45 && rd32(v.target+8)==45 && home_text(v.task+8,"go_home") &&
        !std::strcmp(v.function,"travel_to");
}
void outdoor_family_route_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=outdoor_family_route;
    if (s.active && cpu->ecx==s.agent) {
        HomeTaskView v;
        if (!outdoor_family_route_view(v) || rd32(0x00720304u) || !gm_valid(cpu->esp,12) ||
            ++s.agent_held>4096) std::abort();
        if (!s.requested) {
            s.request_clock=rd32(0x0071c6a8); s.requested=true;
            char entity[65]{},guild[65]{},world[65]{},content[65]{};
            std::memcpy(entity,s.binding.data()+32,64); std::memcpy(guild,s.binding.data()+96,64);
            std::memcpy(world,s.binding.data()+160,64); std::memcpy(content,s.binding.data()+224,64);
            char request[2048],path[1024];
            const int n=std::snprintf(request,sizeof request,
                "{\"version\":1,\"kind\":\"registered-home-go_home\",\"entityId\":\"%s\","
                "\"guildEntityId\":\"%s\",\"worldId\":\"%s\",\"contentDigest\":\"%s\","
                "\"receivingRegion\":\"1_0\",\"homeRegion\":\"0_0\",\"heroId\":%u,\"agentId\":%u,"
                "\"homeUnitId\":469,\"homeAgentId\":7,\"proxyAgentId\":45,\"proxyNativeId\":0,"
                "\"pauseAnchorClockMs\":%u,\"requestClockMs\":%u,\"ownerPublished\":false}\n",
                entity,guild,world,content,s.ids[0],s.agent_id,s.pause_anchor_clock,s.request_clock);
            if (n<=0 || size_t(n)>=sizeof request || !recomp_writable_path("Family_Home_Request.json",path,sizeof path)) std::abort();
            FILE *f=std::fopen(path,"wb");
            if (!f) std::abort();
            const bool written=std::fwrite(request,1,size_t(n),f)==size_t(n) && !std::ferror(f);
            if (std::fclose(f) || !written) std::abort();
            std::fprintf(stderr,"[streaming] Family route requested hero=%u agent=%u proxy=45 home=0_0/469/7 clock=%u pause-anchor=%u ordinary-ai=1 before-native-lookup=1 owner-published=0 result=pass\n",
                s.ids[0],s.agent_id,s.request_clock,s.pause_anchor_clock);
        }
        if (mods_hook_return(api,cpu,0,8)!=POP_OK) std::abort();
        return;
    }
    if (mods_call_next(api,inv,cpu)!=POP_OK) std::abort();
    if (s.active && ++s.agent_other>65536) std::abort();
}
void outdoor_family_route_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=outdoor_family_route;
    if (s.active && gm_valid(cpu->ecx,8)) {
        const uint32_t owner=rd32(cpu->ecx+4);
        for (unsigned i=0;i<4;++i) if (owner==s.units[i]) {
            HomeTaskView v;
            const bool view=outdoor_family_route_view(v),stack=gm_valid(cpu->esp,8);
            const bool context=stack&&gm_valid(rd32(cpu->esp+4),0x1c);
            if (!view || !stack || !context || ++s.command_held[i]>4096) {
                std::fprintf(stderr,"[streaming] Family command hold refused index=%u reloaded=%u view=%u step=%u contexts=%u stack=%u context=%u proxy-native=%u proxy-cache=%u clock=%u result=fail\n",
                    i,unsigned(s.reloaded),unsigned(view),v.step,v.contexts,unsigned(stack),unsigned(context),rd32(s.proxy+0x20),rd32(s.proxy+0x24),rd32(0x0071c6a8));std::abort();
            }
            if (mods_hook_return(api,cpu,0,4)!=POP_OK) std::abort();
            return;
        }
    }
    if (mods_call_next(api,inv,cpu)!=POP_OK) std::abort();
    if (s.active && ++s.command_other>65536) std::abort();
}
void outdoor_family_route_capture(X86 &extra,uint32_t scratch,const char *phase) {
    auto &s=outdoor_family_route; char name[128];
    constexpr uint32_t source_ids[]={504,527,528,529},sizes[]={300,208,128,128};
    for (unsigned i=0;i<4;++i) {
        std::snprintf(name,sizeof name,"Family_Route_%s_%u.UNIT",phase,source_ids[i]);
        if (!primary_file(extra,scratch,name,s.factory,s.units[i],true,nullptr,true)) std::abort();
        std::snprintf(name,sizeof name,"Family_Route_%s_%u_Orders.bin",phase,source_ids[i]);
        if (!marker_banks_file(extra,s.units[i],sizes[i],name)) std::abort();
    }
    std::snprintf(name,sizeof name,"Family_Route_%s_Agent.GPL",phase);
    if (agent_file(extra,scratch,name,s.agent,true)) std::abort();
    std::snprintf(name,sizeof name,"Family_Route_%s_Proxy.GPL",phase);
    if (agent_file(extra,scratch,name,s.proxy,true)) std::abort();
    std::snprintf(name,sizeof name,"Family_Route_%s_Container.bin",phase);
    if (arrival_container_file(extra,scratch,name,s.factory,s.units[0],true)) std::abort();
}
static void arm_outdoor_family_home_route(X86 &extra, uint32_t scratch, uint32_t world,
    uint32_t factory, uint32_t runtime, uint32_t manager, uint32_t agent, uint32_t proxy,
    const uint32_t (&units)[4], const uint32_t (&ids)[4], const uint32_t (&counts)[4],
    const std::array<std::array<uint32_t,32>,4> &addresses) {
    auto &s=outdoor_family_route;
    if (s.active || s.complete || rd32(0x0071c6a8)!=s.start_clock ||
        uint32_t(s.start_clock-s.pause_anchor_clock)>6000) std::abort();
    s.world=world;s.factory=factory;s.runtime=runtime;s.manager=manager;s.agent=agent;s.proxy=proxy;
    s.agent_id=rd32(agent+0x10);s.addresses=addresses;s.hooks_before=mods_hooks_installed_count();
    std::copy_n(units,4,s.units.begin());std::copy_n(ids,4,s.ids.begin());std::copy_n(counts,4,s.counts.begin());
    char path[1024];
    FILE *f=recomp_writable_path("Family_Route_Binding.bin",path,sizeof path)?std::fopen(path,"rb"):nullptr;
    const bool read=f && std::fread(s.binding.data(),1,s.binding.size(),f)==s.binding.size() && std::fgetc(f)==EOF && !std::ferror(f);
    if (f) std::fclose(f);
    constexpr uint32_t words[]={0x31485246,1,469,7,45,0x31564241,0,0};
    if (!read || std::memcmp(s.binding.data(),words,sizeof words)) {
        std::fprintf(stderr,"[streaming] Family route rejected boundary=binding read=%u result=fail\n",unsigned(read));std::abort();
    }
    for (unsigned i=32;i<288;++i) if (!((s.binding[i]>='0'&&s.binding[i]<='9')||(s.binding[i]>='a'&&s.binding[i]<='f'))) std::abort();
    for (unsigned i=288;i<320;++i) {
        const uint8_t expected=i==288?'1':i==304?'0':i==289||i==305?'_':i==290||i==306?'0':0;
        if (s.binding[i]!=expected) std::abort();
    }
    HomeTaskView v;
    if (!home_task_view(agent,v,s.agent_id,s.ids[0],45)) {
        std::fprintf(stderr,"[streaming] Family route rejected boundary=task step=%u contexts=%u result=fail\n",v.step,v.contexts);std::abort();
    }
    s.fingerprint=v.fingerprint;
    if (!outdoor_family_route_view(v)) {
        std::fprintf(stderr,"[streaming] Family route rejected boundary=home step=%u function=%s task-home=%u target=%u proxy-native=%u proxy-cache=%u proxy-deleted=%u result=fail\n",
            v.step,v.function,unsigned(home_text(v.task+8,"go_home")),rd32(v.target+8),rd32(proxy+0x20),rd32(proxy+0x24),rd8(proxy+0x28));std::abort();
    }
    auto proposal=std::make_unique<PrimaryBytes>(),observed=std::make_unique<PrimaryBytes>();size_t n=0,m=0;
    if (!recomp_writable_path("Family_Route_Proxy_Proposal.GPL",path,sizeof path) || !arrival_bytes(path,*proposal,n) || n!=453 ||
        agent_file(extra,scratch,"Family_Route_Bound_Proxy.GPL",proxy,true) ||
        !recomp_writable_path("Family_Route_Bound_Proxy.GPL",path,sizeof path) || !arrival_bytes(path,*observed,m) || m!=n ||
        std::memcmp(proposal->data(),observed->data(),n)) std::abort();
    if (mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,outdoor_family_route_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)!=POP_OK ||
        mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,outdoor_family_route_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK) std::abort();
    s.active=true;
    // Original notification admits populated banks to ordinary ORDR ticks;
    // guards are already installed, and no spatial finalization occurs here.
    for (unsigned i=0;i<4;++i) {
        RegisteredOrderMembers before{},after{};
        const bool known=registered_order_members(factory,units[i],before);
        const uint32_t notify=rd32(rd32(units[i])+0xa4);
        if (!known || notify!=0x005b66f0u) {
            std::fprintf(stderr,"[streaming] Family route rejected boundary=order-admission index=%u known=%u before=%u notify=%08x result=fail\n",i,unsigned(known),before.matches,notify);std::abort();
        }
        extra.r[R_ECX]=units[i];guest_call(&extra,0x005b66f0u,0x5244524fu);
        if (!registered_order_members(factory,units[i],after) || after.matches!=1 || before.kept!=after.kept || before.hash!=after.hash || !(rd32(units[i]+0x40)&1)) std::abort();
        // Here original identity publication follows bank restoration, so it
        // can already have admitted ORDR. Notification must remain idempotent.
        std::fprintf(stderr,"[streaming] Route order admission index=%u unit=%u before=%u after=1 other-members-preserved=1 result=pass\n",i,ids[i],before.matches);
    }
    const uint32_t pending=rd32(manager+0x3c);DepartureQueues before{},after{};
    if ((pending!=manager+0x10&&pending!=manager+0x1c) || !departure_queues(manager,agent,before) ||
        before.omitted!=(s.reloaded?1u:0u)) std::abort();
    if (!s.reloaded) {
        wr32(scratch+144,agent);extra.r[R_ECX]=pending;guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);
    }
    if (!departure_queues(manager,agent,after) || after.omitted!=1) std::abort();
    before.omitted=0;after.omitted=0;if (after!=before || !outdoor_family_route_view(v)) std::abort();
    outdoor_family_route_capture(extra,scratch,"Before");
    const char *snapshot=recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_FIXTURE");
    if (snapshot && !std::strcmp(snapshot,"1") && !majesty_browser_frontier_outdoor_family_snapshot_checkpoint(&extra,1)) std::abort();
    std::fprintf(stderr,"[streaming] Family route armed hero=%u agent=%u clock=%u queued=1 orders-admitted=4 guards=2 proxy-exact=1 other-queues-preserved=1 finalization=0 owner-published=0 result=pass\n",ids[0],s.agent_id,s.start_clock);
}
bool arm_saved_outdoor_family_route(X86 *c) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag=recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_RELOAD"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c);
    if (!flag || std::strcmp(flag,"1") || path.find("/actor-arrival-fixture-outdoor-family-snapshot-")==path.npos ||
        !path.ends_with("/frontier_1_0") || !gm_valid(state,0x50) || rd32(state)!=3 || !gm_valid(world,0x14)) return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;char filename[1024];std::array<uint32_t,12> identity{};
    FILE *f=recomp_writable_path("Family_Remote_Reload_Identity.bin",filename,sizeof filename)?std::fopen(filename,"rb"):nullptr;
    const bool read=f && std::fread(identity.data(),1,48,f)==48 && std::fgetc(f)==EOF && !std::ferror(f);if(f)std::fclose(f);
    const bool legacy=identity[1]==1,paused=identity[1]==2;
    const uint32_t pause_anchor=legacy?identity[2]:identity[9];
    if (!read || identity[0]!=0x314c4d46 || (!legacy&&!paused) || identity[8]!=45 ||
        (legacy&&(identity[2]!=24250||identity[9])) || !pause_anchor ||
        uint32_t(identity[2]-pause_anchor)>6000 || identity[10] || identity[11] ||
        rd32(0x0071c6a8)!=identity[2]) std::abort();
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if (!gm_valid(factory,0x8c) || !gm_valid(runtime,0x38)) std::abort();
    const uint32_t manager=rd32(runtime+4);
    if (!gm_valid(manager,0x4c) || rd32(manager+0x48)) std::abort();
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    uint32_t units[4]{},ids[4]{},counts[4]{};std::array<std::array<uint32_t,32>,4> addresses{};
    constexpr uint32_t desc[]={0x314c5641,0x32485241,0x31475241,0x33475241};
    for(unsigned i=0;i<4;++i){ids[i]=identity[3+i];units[i]=native(ids[i]);
        if (!ids[i] || ids[i]!=identity[3]+i || !gm_valid(units[i],0x164) || rd32(units[i]+0x6c)!=desc[i] ||
            rd32(units[i]+0x74)!=(i?ids[0]:0u)) std::abort();}
    const uint32_t agent=lookup(identity[7]),proxy=lookup(45);
    if (!gm_valid(agent,0x34) || rd32(agent+0x20)!=ids[0] || !gm_valid(proxy,0x34) ||
        rd32(proxy+0x20) || rd32(proxy+0x24) || rd8(proxy+0x28)) std::abort();
    // Full loading leaves the native association lazy. Resolve it through the
    // original getter before freezing the runtime fingerprint, as the private
    // importer already does. The home proxy must still resolve to no native.
    extra.r[R_ECX]=agent;if(guest_call(&extra,0x00626310u)!=units[0])std::abort();
    extra.r[R_ECX]=proxy;if(guest_call(&extra,0x00626310u))std::abort();
    uint32_t cells=0;const auto drawing=live_drawing(factory,units[0]);DepartureQueues queues{};
    if (!joint_motion_physical(factory,units[0],cells) || cells!=4 || !drawing.valid || drawing.excluded!=1 ||
        !departure_queues(manager,agent,queues) || queues.omitted!=1) std::abort();
    for(unsigned i=1;i<4;++i)if(!arrival_contains(units[0],1,units[i]))std::abort();
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    outdoor_family_route.reloaded=true;
    outdoor_family_route.start_clock=identity[2];outdoor_family_route.pause_anchor_clock=pause_anchor;
    arm_outdoor_family_home_route(extra,scratch,world,factory,runtime,manager,agent,proxy,units,ids,counts,addresses);
    if(!heap_free(scratch))std::abort();
    std::fprintf(stderr,"[streaming] Family reload admitted hero=%u agent=%u clock=%u original-full-load=1 physical=4 drawing=1 queued=1 internal-links=3 guards-before-update=2 owner-published=0 result=pass\n",ids[0],identity[7],identity[2]);
    if (paused) std::fprintf(stderr,"[streaming] Family reload clocks version=2 saved=%u pause-anchor=%u held-age=%u result=pass\n",identity[2],pause_anchor,uint32_t(identity[2]-pause_anchor));
    return true;
#endif
}
void outdoor_family_route_frame(X86 *c) {
#ifndef __EMSCRIPTEN__
    auto &s=outdoor_family_route;if (s.complete || mods_hook_depth() || !sched_holds_baton()) return;
    if (c->r[R_ESP]<STACK_LIMIT+65536 || c->r[R_ESP]>STACK_TOP) return;
    if(!s.active){arm_saved_outdoor_family_route(c);return;}
    const uint32_t clock=rd32(0x0071c6a8);HomeTaskView v;
    if (!outdoor_family_route_view(v) || uint32_t(clock-s.start_clock)>6000) std::abort();
    if (!s.requested || clock-s.request_clock<1000) return;
    for (const auto held:s.command_held) if (!held) std::abort();
    if (!s.agent_held || !s.agent_other || !s.command_other) std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;const uint32_t scratch=heap_alloc(512,true);if (!scratch) std::abort();
    outdoor_family_route_capture(extra,scratch,"After");
    // Compare complete writer records, not just positions or selected clocks.
    constexpr const char *suffixes[]={"504.UNIT","527.UNIT","528.UNIT","529.UNIT","504_Orders.bin","527_Orders.bin",
        "528_Orders.bin","529_Orders.bin","Agent.GPL","Proxy.GPL","Container.bin"};
    auto before=std::make_unique<PrimaryBytes>(),after=std::make_unique<PrimaryBytes>();char name[128],path[1024];
    for (const char *suffix:suffixes) {
        size_t n=0,m=0;std::snprintf(name,sizeof name,"Family_Route_Before_%s",suffix);
        if (!recomp_writable_path(name,path,sizeof path) || !arrival_bytes(path,*before,n)) std::abort();
        std::snprintf(name,sizeof name,"Family_Route_After_%s",suffix);
        if (!recomp_writable_path(name,path,sizeof path) || !arrival_bytes(path,*after,m) || n!=m || std::memcmp(before->data(),after->data(),n)) std::abort();
    }
    std::fprintf(stderr,"[streaming] Family route held clock=%u elapsed=%u agent-held=%u commands-held=%u,%u,%u,%u other-ai=%u other-commands=%u records-exact=11 pause-anchor=%u result=pass\n",
        clock,clock-s.request_clock,s.agent_held,s.command_held[0],s.command_held[1],s.command_held[2],s.command_held[3],s.agent_other,s.command_other,s.pause_anchor_clock);
    const char *snapshot=recomp_env("BROWSER_STREAMING_OUTDOOR_FAMILY_SNAPSHOT_FIXTURE");
    const bool saving=snapshot && !std::strcmp(snapshot,"1");
    if (saving && !majesty_browser_frontier_outdoor_family_snapshot_checkpoint(&extra,2)) std::abort();
    NativeRegistrySnapshot registry_before,registry_after;DepartureQueues queues_before{},queues_after{};
    const uint32_t entries=rd32(s.manager+0x34),native_counter=rd32(s.factory+0x28),script_counter=rd32(s.runtime+0x34);
    if (!native_registry_snapshot(s.factory,registry_before,0,s.units.data(),4) || !departure_queues(s.manager,s.agent,queues_before) || queues_before.omitted!=1) std::abort();
    queues_before.omitted=0;
    extra.r[R_ECX]=s.manager;guest_call(&extra,0x006332c0u,s.agent);
    if (!departure_queues(s.manager,s.agent,queues_after) || queues_after!=queues_before) std::abort();
    for (unsigned i=4;i--;) {extra.r[R_ECX]=s.units[i];guest_call(&extra,0x005a21b0u);}
    extra.r[R_ECX]=s.manager;guest_call(&extra,0x00633370u);
    uint32_t freed=0;
    for (unsigned i=0;i<4;++i) {
        extra.r[R_ECX]=s.factory;if (guest_call(&extra,0x005a10d0u,s.ids[i])) std::abort();
        for (uint32_t j=0;j<s.counts[i];++j) {if (heap_owns(s.addresses[i][j])) std::abort();++freed;}
    }
    extra.r[R_ECX]=s.runtime;if (guest_call(&extra,0x006236b0u,s.agent_id)) std::abort();
    extra.r[R_ECX]=s.runtime;if (guest_call(&extra,0x006236b0u,45u)!=s.proxy) std::abort();
    size_t proxy_before_bytes=0,proxy_after_bytes=0;
    if (agent_file(extra,scratch,"Family_Route_Cleaned_Proxy.GPL",s.proxy,true) ||
        !recomp_writable_path("Family_Route_Proxy_Proposal.GPL",path,sizeof path) || !arrival_bytes(path,*before,proxy_before_bytes) ||
        !recomp_writable_path("Family_Route_Cleaned_Proxy.GPL",path,sizeof path) || !arrival_bytes(path,*after,proxy_after_bytes) ||
        proxy_before_bytes!=453 || proxy_after_bytes!=453 || std::memcmp(before->data(),after->data(),453)) std::abort();
    if (!native_registry_snapshot(s.factory,registry_after) || registry_after!=registry_before ||
        !departure_queues(s.manager,s.agent,queues_after) || queues_after!=queues_before || rd32(s.manager+0x34)+1!=entries ||
        rd32(s.factory+0x28)!=native_counter || rd32(s.runtime+0x34)!=script_counter || rd32(0x0071c6a8)!=clock ||
        mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK || mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK ||
        mods_hooks_installed_count()!=s.hooks_before || !heap_free(scratch) || freed!=(s.reloaded?0u:42u)) std::abort();
    s.active=false;s.complete=true;
    if (saving && !majesty_browser_frontier_outdoor_family_snapshot_checkpoint(&extra,3)) std::abort();
    std::fprintf(stderr,"[streaming] Family route cleanup requests=%u original-removal=1 aliases-absent=1 registry-preserved=1 proxy-preserved=1 queues-preserved=1 hooks-removed=1 owner-published=0 result=pass\n",freed);
#endif
}
void registered_hero_live_dispatch(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=registered_hero_live;
    if(s.stage==1&&rd32(0x00720304u)==s.agent&&gm_valid(cpu->ecx,24)&&home_text(cpu->ecx,"use_building")) {
        HomeTaskView v;
        if(!home_task_view(s.agent,v,48,554,45)||rd32(v.home+8)!=45)std::abort();
        if(rd32(v.target+8)==45) {
            if(!v.going_home||rd32(s.proxy+0x20)||rd32(s.proxy+0x24)||rd8(s.proxy+0x28)||s.remote_requested)std::abort();
            s.remote_requested=true;s.remote_clock=rd32(0x0071c6a8);++s.remote_dispatches;
            if(mods_hook_return(api,cpu,0,4)!=POP_OK)std::abort();
            std::fprintf(stderr,"[streaming] Hero live remote-request hero=554 agent=48 home=45 target=45 task=go_home function=use_building clock=%u before-dead-guard=1 owner-published=0 result=pass\n",s.remote_clock);
            return;
        }
    }
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.stage==1&&rd32(0x00720304u)==s.agent&&++s.context_returned>65536)std::abort();
}
void registered_hero_live_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=registered_hero_live;
    const bool owned=s.stage==1&&cpu->ecx==s.agent;
    if(owned) {
        HomeTaskView v;
        if(rd32(0x0071c68c)!=s.world||!home_task_view(s.agent,v,48,554,45)||rd32(v.home+8)!=45)std::abort();
        if(s.remote_requested) {
            if(!v.going_home||(s.held_ready&&v.fingerprint!=s.held_fingerprint)||rd32(0x00720304u)||
               ++s.agent_held>4096||mods_hook_return(api,cpu,0,8)!=POP_OK)std::abort();
            return;
        }
    }
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(owned){if(++s.agent_returned>4096)std::abort();}
    else if(s.stage==1&&++s.other_agents>65536)std::abort();
}
void registered_hero_live_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=registered_hero_live;
    if(s.stage==1&&gm_valid(cpu->ecx,8)) {
        const uint32_t owner=rd32(cpu->ecx+4);
        if(owner==s.unit&&++s.hero_commands>65536)std::abort();
        if(owner==s.effect&&++s.effect_commands>65536)std::abort();
    }
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
}
void original_registered_hero_live_frame(X86 *c) {
#ifndef __EMSCRIPTEN__
    const char *flag=recomp_env("BROWSER_STREAMING_HERO_LIVE_FIXTURE"),*profile=recomp_env("PROFILE_DIR");
    std::string_view path(profile?profile:"");constexpr std::string_view suffix="/frontier_1_0";
    if(!flag||std::strcmp(flag,"1")||!path.ends_with(suffix))return;
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');
    const auto owned=path.substr(slash==path.npos?0:slash+1);
    const char *selected=recomp_env("RULE_FRONTIER_REGION");
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!enabled()||!selected||std::strcmp(selected,"1_0")||!owned.starts_with("actor-arrival-fixture-hero-live-")||owned.size()>80||
       recomp_env("RULE_FRONTIER_CHAPTER")||!gm_valid(phase,0x50)||rd32(phase)!=3||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    auto &s=registered_hero_live;if(s.stage==2)return;
    X86 extra=*c;extra.r[R_ESP]-=32768;
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=s.runtime;return guest_call(&extra,0x006236b0u,id);};
    auto native=[&](uint32_t id){extra.r[R_ECX]=s.factory;return guest_call(&extra,0x005a10d0u,id);};
    const uint32_t clock=rd32(0x0071c6a8);
    if(!s.stage) {
        s.world=world;s.factory=rd32(world+0x10);s.runtime=guest_call(&extra,0x00623b20u);s.start=clock;
        if(clock!=18250||!gm_valid(s.factory,0x8c)||!gm_valid(s.runtime,0x38))std::abort();
        s.manager=rd32(s.runtime+4);s.unit=native(554);s.effect=native(555);s.agent=lookup(48);s.proxy=lookup(45);
        if(!gm_valid(s.manager,0x4c)||rd32(s.manager+0x48)||!gm_valid(s.unit,0x164)||!gm_valid(s.effect,0x164)||
           !gm_valid(s.agent,0x34)||!gm_valid(s.proxy,0x34)||rd32(s.agent+0x20)!=554||rd8(s.agent+0x28)||
           rd32(s.proxy+0x20)||rd32(s.proxy+0x24)||rd8(s.proxy+0x28)||rd32(s.unit+0x74)||rd32(s.effect+0x74)!=554||
           rd32(s.unit+0x84)!=s.factory||rd32(s.effect+0x84)!=s.factory||!arrival_contains(s.unit,1,s.effect))std::abort();
        extra.r[R_ECX]=s.agent;if(guest_call(&extra,0x00626310u)!=s.unit)std::abort();
        HomeTaskView v;uint32_t cells=0;const auto drawing=live_drawing(s.factory,s.unit);
        const uint32_t grid=rd32(s.factory+0x88),extent=gm_valid(grid,0x50)?rd32(grid+0x48):0;
        const bool physical=joint_motion_physical(s.factory,s.unit,cells,extent);
        std::fprintf(stderr,"[streaming] Hero live loaded hero=554 effect=555 agent=48 proxy=45 clock=%u grid=%u physical=%u footprint=%u drawing=%u draw-count=%u\n",clock,extent,unsigned(physical),cells,unsigned(drawing.valid),drawing.excluded);
        if(!home_task_view(s.agent,v,48,554,45)||rd32(v.home+8)!=45||!physical||!drawing.valid||drawing.excluded!=1)std::abort();
        const uint32_t pending=rd32(s.manager+0x3c),scratch=heap_alloc(512,true);
        DepartureQueues before{},after{};
        if(!scratch||(pending!=s.manager+0x10&&pending!=s.manager+0x1c)||!departure_queues(s.manager,s.agent,before)||before.omitted)std::abort();
        if(agent_file(extra,scratch,"Hero_Live_Home_Before.GPL",s.proxy,true))std::abort();
        // Reading populated banks does not refresh their derived registry group.
        // Reproduce the original command-admission notification (unit +a4),
        // which tests nonempty banks and inserts this unit into ORDR updates.
        RegisteredOrderMembers orders_before{},orders_after{};
        const bool orders_known=registered_order_members(s.factory,s.effect,orders_before);
        const uint32_t effect_bank=rd32(s.effect+0x8c);
        std::fprintf(stderr,"[streaming] Hero live admission-before valid=%u matches=%u marker=%u bank-valid=%u bank-owner=%u bank-count=%u\n",unsigned(orders_known),orders_before.matches,rd32(s.effect+0x40),unsigned(gm_valid(effect_bank,20)),gm_valid(effect_bank,20)?unsigned(rd32(effect_bank+4)==s.effect):0,gm_valid(effect_bank,20)?rd32(effect_bank+16):0);
        if(!orders_known||orders_before.matches||
           rd32(rd32(s.effect)+0xa4)!=0x005b66f0u)std::abort();
        extra.r[R_ECX]=s.effect;guest_call(&extra,0x005b66f0u,0x5244524fu);
        const bool orders_refreshed=registered_order_members(s.factory,s.effect,orders_after);
        std::fprintf(stderr,"[streaming] Hero live admission-after valid=%u matches=%u kept-before=%u kept-after=%u hash-same=%u marker=%u\n",unsigned(orders_refreshed),orders_after.matches,orders_before.kept,orders_after.kept,unsigned(orders_before.hash==orders_after.hash),rd32(s.effect+0x40));
        if(!orders_refreshed||orders_after.matches!=1||
           orders_after.kept!=orders_before.kept||orders_after.hash!=orders_before.hash||!(rd32(s.effect+0x40)&1))std::abort();
        std::fprintf(stderr,"[streaming] Hero live effect-admitted effect=555 original-notify=1 before=0 after=1 other-members-preserved=1 marker=1 result=pass\n");
        std::array<uint8_t,0x164> unit_before{};std::array<uint8_t,0x34> agent_before{};
        std::memcpy(unit_before.data(),gm_ptr(s.unit),unit_before.size());std::memcpy(agent_before.data(),gm_ptr(s.agent),agent_before.size());
        wr32(scratch+144,s.agent);extra.r[R_ECX]=pending;
        guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);
        if(!departure_queues(s.manager,s.agent,after)||after.omitted!=1||
           std::memcmp(unit_before.data(),gm_ptr(s.unit),unit_before.size())||std::memcmp(agent_before.data(),gm_ptr(s.agent),agent_before.size()))std::abort();
        after.omitted=0;if(after!=before||!heap_free(scratch))std::abort();
        s.hooks_before=mods_hooks_installed_count();
        if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,registered_hero_live_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)!=POP_OK||
           mods_hook_install_ex(MODS_OWNER_RUNTIME,0x006381b0u,0,registered_hero_live_dispatch,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.dispatch_hook)!=POP_OK||
           mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,registered_hero_live_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK)std::abort();
        if(!majesty_browser_frontier_registered_hero_live_checkpoint(&extra,false))std::abort();
        s.stage=1;
        std::fprintf(stderr,"[streaming] Hero live activated hero=554 agent=48 clock=%u physical=1 drawing=1 queued=1 other-queues-preserved=1 actor-same=1 script-same=1 ready-saved=1 owner-published=0 result=pass\n",clock);
        return;
    }
    if(world!=s.world||lookup(48)!=s.agent||lookup(45)!=s.proxy||native(554)!=s.unit||clock-s.start>10000)std::abort();
    if(s.remote_requested&&!s.held_ready) {
        HomeTaskView v;if(!home_task_view(s.agent,v,48,554,45)||!v.going_home)std::abort();
        s.held_fingerprint=v.fingerprint;s.held_ready=true;
        const uint32_t scratch=heap_alloc(512,true);if(!scratch||agent_file(extra,scratch,"Hero_Live_Remote_Held_Before.GPL",s.agent,true)||!heap_free(scratch))std::abort();
    }
    if(clock-s.start<6000)return;
    HomeTaskView v;DepartureQueues queues{};
    const uint32_t grid=rd32(s.factory+0x88),extent=rd32(grid+0x48);uint32_t cells=0;
    const auto drawing=live_drawing(s.factory,s.unit);const uint32_t effect=native(555);
    const bool queue_ok=departure_queues(s.manager,s.agent,queues),view_ok=home_task_view(s.agent,v,48,554,45);
    const bool physical=joint_motion_physical(s.factory,s.unit,cells,extent);
    std::fprintf(stderr,"[streaming] Hero live validation clock=%u elapsed=%u agent-returned=%u other-agents=%u context-returned=%u effect-commands=%u queue-ok=%u queued=%u view-ok=%u home=%u physical=%u footprint=%u drawing=%u draw-count=%u effect-present=%u effect-flags=%u\n",clock,clock-s.start,s.agent_returned,s.other_agents,s.context_returned,s.effect_commands,unsigned(queue_ok),queues.omitted,unsigned(view_ok),view_ok?rd32(v.home+8):0,unsigned(physical),cells,unsigned(drawing.valid),drawing.excluded,unsigned(effect!=0),effect?rd32(effect+0x64):0);
    if(!s.agent_returned||!s.other_agents||!s.effect_commands||!s.context_returned||
       !queue_ok||queues.omitted!=1||!view_ok||rd32(v.home+8)!=45||
       !physical||!drawing.valid||drawing.excluded!=1||effect)std::abort();
    const uint32_t scratch=heap_alloc(512,true);if(!scratch||agent_file(extra,scratch,"Hero_Live_Home_After.GPL",s.proxy,true)||
       agent_file(extra,scratch,"Hero_Live_Agent_After.GPL",s.agent,true))std::abort();
    if(s.remote_requested&&(!s.agent_held||!s.held_ready||!v.going_home||v.fingerprint!=s.held_fingerprint||
       agent_file(extra,scratch,"Hero_Live_Remote_Held_After.GPL",s.agent,true)))std::abort();
    if(!heap_free(scratch)||!majesty_browser_frontier_registered_hero_live_checkpoint(&extra,true))std::abort();
    std::fprintf(stderr,"[streaming] Hero live evolved hero=554 agent=48 clock=%u elapsed=%u agent-returned=%u other-agents=%u context-returned=%u hero-commands=%u effect-commands=%u effect-absent=1 physical=1 footprint=%u drawing=1 queued=1 remote-requested=%u remote-held=%u evolved-saved=1 owner-published=0 travel-qualified=0 result=pass\n",clock,clock-s.start,s.agent_returned,s.other_agents,s.context_returned,s.hero_commands,s.effect_commands,cells,unsigned(s.remote_requested),s.agent_held);
    if(mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK||mods_hook_remove(MODS_OWNER_RUNTIME,s.dispatch_hook)!=POP_OK||
       mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK||mods_hooks_installed_count()!=s.hooks_before)std::abort();
    s.stage=2;extra.r[R_ECX]=s.unit;guest_call(&extra,0x005a21b0u);extra.r[R_ECX]=s.manager;guest_call(&extra,0x00633370u);
    if(native(554)||native(555)||lookup(48)||lookup(45)!=s.proxy||live_drawing(s.factory,s.unit).excluded)std::abort();
    DepartureQueues cleaned{};if(!departure_queues(s.manager,s.agent,cleaned)||cleaned.omitted)std::abort();
    std::fprintf(stderr,"[streaming] Hero live cleanup original-removal=1 aliases-absent=1 queue-absent=1 drawing-absent=1 proxy-preserved=1 hooks-removed=1 result=pass\n");
#endif
}
// Retire the actual remote owner before a separate paired return publication.
// The pure home proxy remains intact; original lifetime methods own all removal.
static void original_remote_hero_departure_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted=false;const char *flag=recomp_env("BROWSER_STREAMING_REMOTE_HERO_DEPARTURE_FIXTURE");
    const char *profile=recomp_env("PROFILE_DIR");std::string_view path(profile?profile:"");
    constexpr std::string_view suffix="/frontier_1_0";
    if(attempted||!flag||std::strcmp(flag,"1")||!path.ends_with(suffix))return;
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');
    const auto owned=path.substr(slash==path.npos?0:slash+1);
    const char *selected=recomp_env("RULE_FRONTIER_REGION");
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!enabled()||!selected||std::strcmp(selected,"1_0")||!owned.starts_with("actor-arrival-fixture-remote-hero-departure-")||
       owned.size()>80||recomp_env("RULE_FRONTIER_CHAPTER")||!gm_valid(phase,0x50)||rd32(phase)!=3||
       !gm_valid(world,0x14)||mods_hook_depth()||!sched_holds_baton()||
       c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    attempted=true;X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u),clock=rd32(0x0071c6a8),hooks=mods_hooks_installed_count();
    if(clock!=24250||!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))std::abort();
    const uint32_t manager=rd32(runtime+4),native_counter=rd32(factory+0x28),script_counter=rd32(runtime+0x34);
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t hero=native(554),agent=lookup(48),proxy=lookup(45);
    if(!gm_valid(manager,0x4c)||rd32(manager+0x48)||!gm_valid(hero,0x164)||!gm_valid(agent,0x34)||
       !gm_valid(proxy,0x34)||native(555)||rd32(hero+0x74)||rd32(hero+0x6c)!=0x314c5641u||
       rd32(hero+0x84)!=factory||rd32(agent+0x20)!=554||rd8(agent+0x28)||
       rd32(proxy+0x20)||rd32(proxy+0x24)||rd8(proxy+0x28))std::abort();
    extra.r[R_ECX]=agent;if(guest_call(&extra,0x00626310u)!=hero)std::abort();
    HomeTaskView task;DepartureQueues before{},after{};RegisteredOrderMembers orders_before{},orders_after{};
    if(!home_task_view(agent,task,48,554,45)||!task.going_home||rd32(task.home+8)!=45||rd32(task.target+8)!=45||
       !departure_queues(manager,agent,before)||before.omitted!=1||!registered_order_members(factory,hero,orders_before))std::abort();
    uint32_t cells=0;const uint32_t grid=rd32(factory+0x88);
    if(!gm_valid(grid,0x50)||rd32(grid+0x48)!=256||rd32(grid+0x4c)!=256||
       !joint_motion_physical(factory,hero,cells)||cells!=4)std::abort();
    auto drawing=live_drawing(factory,hero);if(!drawing.valid||drawing.excluded!=1)std::abort();
    const uint32_t entries=rd32(manager+0x34),scratch=heap_alloc(512,true);if(!scratch)std::abort();
    if(!primary_file(extra,scratch,"Remote_Departure_Hero_Before.UNIT",factory,hero,true,nullptr,true)||
       agent_file(extra,scratch,"Remote_Departure_Agent_Before.GPL",agent,true)||
       agent_file(extra,scratch,"Remote_Departure_Home_Before.GPL",proxy,true)||
       !majesty_browser_frontier_remote_hero_departure_checkpoint(&extra,false))std::abort();
    std::fprintf(stderr,"[streaming] Remote hero departure loaded hero=554 agent=48 proxy=45 clock=24250 queued=1 footprint=4 drawing=1 task=go_home function=use_building original-load=1 before-saved=1 result=pass\n");
    extra.r[R_ECX]=hero;guest_call(&extra,0x005a21b0u);
    if(rd32(manager+0x48)!=1)std::abort();extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
    if(native(554)||native(555)||lookup(48)||lookup(45)!=proxy||rd32(manager+0x48)||
       rd32(proxy+0x20)||rd32(proxy+0x24)||rd8(proxy+0x28)||rd32(manager+0x34)+1!=entries||
       !departure_queues(manager,agent,after)||after.omitted)std::abort();
    before.omitted=0;drawing.excluded=0;
    if(after!=before||live_drawing(factory,hero)!=drawing||!registered_order_members(factory,hero,orders_after)||
       orders_after.matches||orders_after.kept!=orders_before.kept||orders_after.hash!=orders_before.hash)std::abort();
    const uint32_t buckets=rd32(grid+0x18);if(!gm_valid(buckets,256*256*4))std::abort();uint32_t matches=0;
    for(uint32_t cell=0;cell<256*256;++cell) {
        const uint32_t bucket=rd32(buckets+cell*4);if(!bucket)continue;if(!gm_valid(bucket,32))std::abort();
        for(uint32_t slot=0;slot<8&&rd32(bucket+slot*4);++slot)matches+=rd32(bucket+slot*4)==hero;
    }
    if(matches||rd32(factory+0x28)!=native_counter||rd32(runtime+0x34)!=script_counter||
       rd32(0x0071c6a8)!=clock||mods_hooks_installed_count()!=hooks||
       agent_file(extra,scratch,"Remote_Departure_Home_After.GPL",proxy,true)||!heap_free(scratch)||
       !majesty_browser_frontier_remote_hero_departure_checkpoint(&extra,true))std::abort();
    std::fprintf(stderr,"[streaming] Remote hero departure removed hero=554 agent=48 proxy=45 clock=24250 aliases-absent=1 queue-absent=1 other-queues-preserved=1 drawing-absent=1 other-drawing-preserved=1 grid-absent=1 order-members-preserved=1 proxy-preserved=1 counters-preserved=1 hooks-preserved=1 after-saved=1 owner-published=0 travel-qualified=0 result=pass\n");
#endif
}
// Observe a fresh returned-world load under normal original AI. Every hook
// calls the original method; there is no remote-home gate or clock projection.
struct ReturnedHeroLive {
    uint32_t stage=0,world=0,factory=0,runtime=0,manager=0,unit=0,agent=0,home=0,guild=0,start=0;
    uint32_t hooks_before=0,agent_hook=0,dispatch_hook=0,command_hook=0;
    uint32_t agent_calls=0,other_calls=0,contexts=0,building_calls=0,commands=0;
    std::array<uint32_t,5> position{};
};
ReturnedHeroLive returned_hero_live;
void returned_hero_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=returned_hero_live;const bool owned=s.stage==1&&cpu->ecx==s.agent;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.stage==1){auto &n=owned?s.agent_calls:s.other_calls;if(++n>65536)std::abort();}
}
void returned_hero_dispatch(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=returned_hero_live;const bool owned=s.stage==1&&rd32(0x00720304u)==s.agent;
    const bool building=owned&&gm_valid(cpu->ecx,24)&&home_text(cpu->ecx,"use_building");
    if(building&&!s.building_calls) {
        HomeTaskView view;if(!home_task_view(s.agent,view,28,504,7)||!view.going_home)std::abort();
    }
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(owned&&++s.contexts>65536)std::abort();
    if(building&&++s.building_calls>4096)std::abort();
}
void returned_hero_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=returned_hero_live;const bool owned=s.stage==1&&gm_valid(cpu->ecx,8)&&rd32(cpu->ecx+4)==s.unit;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(owned&&++s.commands>65536)std::abort();
}
void original_returned_hero_live_frame(X86 *c) {
#ifndef __EMSCRIPTEN__
    const char *flag=recomp_env("BROWSER_STREAMING_HERO_RETURN_LIVE_FIXTURE"),*profile=recomp_env("PROFILE_DIR");
    std::string_view path(profile?profile:"");constexpr std::string_view suffix="/frontier_0_0";
    if(!flag||std::strcmp(flag,"1")||!path.ends_with(suffix))return;
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');const auto owned=path.substr(slash==path.npos?0:slash+1);
    const char *selected=recomp_env("RULE_FRONTIER_REGION");const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!enabled()||!selected||std::strcmp(selected,"0_0")||!owned.starts_with("actor-arrival-fixture-hero-return-live-")||owned.size()>80||
       recomp_env("RULE_FRONTIER_CHAPTER")||!gm_valid(phase,0x50)||rd32(phase)!=3||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    auto &s=returned_hero_live;if(s.stage==2)return;X86 extra=*c;extra.r[R_ESP]-=32768;
    if(!s.stage){s.world=world;s.factory=rd32(world+0x10);s.runtime=guest_call(&extra,0x00623b20u);s.start=rd32(0x0071c6a8);
        if(s.start!=25800||!gm_valid(s.factory,0x8c)||!gm_valid(s.runtime,0x38))std::abort();s.manager=rd32(s.runtime+4);}
    auto native=[&](uint32_t id){extra.r[R_ECX]=s.factory;return guest_call(&extra,0x005a10d0u,id);};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=s.runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t clock=rd32(0x0071c6a8);
    if(s.stage&& (world!=s.world||native(504)!=s.unit||lookup(28)!=s.agent||clock-s.start>10000))std::abort();
    if(s.stage&&clock-s.start<6000)return;
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    if(!s.stage) {
        s.unit=native(504);s.agent=lookup(28);s.home=native(469);s.guild=lookup(7);s.hooks_before=mods_hooks_installed_count();
        if(!gm_valid(s.manager,0x4c)||rd32(s.manager+0x48)||!gm_valid(s.unit,0x164)||!gm_valid(s.agent,0x34)||
           !gm_valid(s.home,0x98)||!gm_valid(s.guild,0x34)||rd32(s.agent+0x20)!=504||rd32(s.guild+0x20)!=469||rd32(s.unit+0x74))std::abort();
        extra.r[R_ECX]=s.agent;if(guest_call(&extra,0x00626310u)!=s.unit)std::abort();
        extra.r[R_ECX]=s.guild;if(guest_call(&extra,0x00626310u)!=s.home)std::abort();
        HomeTaskView view;DepartureQueues q{};uint32_t cells=0;const auto drawing=live_drawing(s.factory,s.unit);
        if(!home_task_view(s.agent,view,28,504,7)||!view.going_home||!arrival_contains(s.unit,101,s.home)||!arrival_contains(s.home,100,s.unit)||
           !departure_queues(s.manager,s.agent,q)||q.omitted!=1||!joint_motion_physical(s.factory,s.unit,cells,256)||cells!=4||!drawing.valid||drawing.excluded!=1)std::abort();
        const auto roster=departure_list_state(departure_list(extra,scratch,s.guild,"members"),28);
        if(!roster.valid||roster.count!=1||roster.matches!=1)std::abort();
        extra.r[R_ECX]=scratch;guest_call(&extra,0x006254c0u,7u);extra.r[R_ECX]=scratch;
        if(guest_call(&extra,0x00625580u)!=1||agent_file(extra,scratch,"Hero_Return_Live_Loaded_Agent.GPL",s.agent,true))std::abort();
        s.position=home_motion_position(s.unit);
        if(!heap_free(scratch)||!majesty_browser_frontier_registered_hero_return_live_checkpoint(&extra,false))std::abort();
        if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,returned_hero_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)!=POP_OK||
           mods_hook_install_ex(MODS_OWNER_RUNTIME,0x006381b0u,0,returned_hero_dispatch,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.dispatch_hook)!=POP_OK||
           mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,returned_hero_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK)std::abort();
        s.stage=1;std::fprintf(stderr,"[streaming] Hero return live loaded hero=504 agent=28 guild=469 guild-agent=7 clock=25800 queued=1 footprint=4 drawing=1 local-valid=1 task=go_home function=use_building original-load=1 loaded-saved=1 result=pass\n");return;
    }
    const uint32_t parent=rd32(s.unit+0x74);const bool moved=home_motion_position(s.unit)!=s.position;
    DepartureQueues q{};const auto drawing=live_drawing(s.factory,s.unit);uint32_t cells=0;
    const bool physical=parent==469||(!parent&&joint_motion_physical(s.factory,s.unit,cells,256));
    const auto roster=departure_list_state(departure_list(extra,scratch,s.guild,"members"),28);
    if(!heap_free(scratch))std::abort();const bool queue_valid=departure_queues(s.manager,s.agent,q);
    // Queue/physical/roster observations remain separate from task completion.
    std::fprintf(stderr,"[streaming] Hero return live validation clock=%u agent-returned=%u other-agents=%u contexts=%u building-returned=%u commands=%u moved=%u parent=%u queue-valid=%u queued=%u physical=%u cells=%u drawing-valid=%u draw-count=%u roster-valid=%u roster-count=%u\n",clock,s.agent_calls,s.other_calls,s.contexts,s.building_calls,s.commands,unsigned(moved),parent,unsigned(queue_valid),q.omitted,unsigned(physical),cells,unsigned(drawing.valid),drawing.excluded,unsigned(roster.valid),roster.count);
    if(!s.agent_calls||!s.other_calls||!s.contexts||!s.building_calls||!s.commands||(!moved&&!parent)||
       !departure_queues(s.manager,s.agent,q)||q.omitted!=1||!physical||!drawing.valid||drawing.excluded>1||
       !roster.valid||roster.count!=1||roster.matches!=1||!arrival_contains(s.unit,101,s.home)||!arrival_contains(s.home,100,s.unit)||
       !majesty_browser_frontier_registered_hero_return_live_checkpoint(&extra,true))std::abort();
    if(mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK||mods_hook_remove(MODS_OWNER_RUNTIME,s.dispatch_hook)!=POP_OK||
       mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK||mods_hooks_installed_count()!=s.hooks_before)std::abort();
    s.stage=2;
    std::fprintf(stderr,"[streaming] Hero return live evolved hero=504 agent=28 guild=469 clock=%u elapsed=%u agent-returned=%u other-agents=%u contexts=%u building-returned=%u commands=%u moved=%u parent=%u queued=1 rosters=1 evolved-saved=1 hooks-removed=1 gate-used=0 travel-qualified=0 result=pass\n",clock,clock-s.start,s.agent_calls,s.other_calls,s.contexts,s.building_calls,s.commands,unsigned(moved),parent);
#endif
}
// Restore the actual remote Warrior into its registered native guild. Original
// IDs, rosters and AI queue are published only in this owned native world; a
// paired regional return commit and normal AI execution remain separate.
void original_registered_hero_return_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted=false;const char *flag=recomp_env("BROWSER_STREAMING_HERO_RETURN_FIXTURE");
    const char *profile=recomp_env("PROFILE_DIR");std::string_view path(profile?profile:"");
    constexpr std::string_view suffix="/frontier_0_0";
    if(attempted||!flag||std::strcmp(flag,"1")||!path.ends_with(suffix))return;
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');const auto owned=path.substr(slash==path.npos?0:slash+1);
    const char *selected=recomp_env("RULE_FRONTIER_REGION");const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!enabled()||!selected||std::strcmp(selected,"0_0")||!owned.starts_with("actor-arrival-fixture-hero-return-")||owned.size()>80||
       recomp_env("RULE_FRONTIER_CHAPTER")||!gm_valid(state,0x50)||rd32(state)!=3||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    attempted=true;X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u),clock=rd32(0x0071c6a8),hooks=mods_hooks_installed_count();
    if(clock!=25800||!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))std::abort();
    const uint32_t manager=rd32(runtime+4),reserved=rd32(runtime+0x34);
    if(!gm_valid(manager,0x4c)||rd32(manager+0x48)||reserved<=27||reserved>=0x7ffffffe)std::abort();
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t home=native(469),guild=lookup(7),scratch=heap_alloc(512,true);
    if(!scratch||native(502)||native(503)||lookup(27)||lookup(reserved)||!gm_valid(home,0x98)||!gm_valid(guild,0x34)||rd32(guild+0x20)!=469)std::abort();
    extra.r[R_ECX]=guild;if(guest_call(&extra,0x00626310u)!=home)std::abort();
    const uint32_t members=departure_list(extra,scratch,guild,"members");const auto roster=departure_list_state(members,reserved);
    if(!roster.valid||roster.count||roster.matches||agent_file(extra,scratch,"Hero_Return_Guild_Before.GPL",guild,true))std::abort();
    const auto queues=pair_queues(manager);const uint32_t entries=rd32(manager+0x34);
    auto hero=std::make_unique<PrimaryBytes>(),script=std::make_unique<PrimaryBytes>(),container=std::make_unique<PrimaryBytes>(),observed=std::make_unique<PrimaryBytes>();
    char pathbuf[1024];auto load=[&](const char *name,PrimaryBytes &b,size_t size){size_t n=0;return recomp_writable_path(name,pathbuf,sizeof pathbuf)&&arrival_bytes(pathbuf,b,n)&&n==size;};
    auto write=[&](const char *name,const PrimaryBytes &b,size_t n){return recomp_writable_path(name,pathbuf,sizeof pathbuf)&&pair_write(pathbuf,b,n);};
    PairPlan plan;size_t ea=0;
    if(!load("Hero_Return_Hero_Proposal.UNIT",*hero,442)||!load("Hero_Return_Agent_Proposal.GPL",*script,1853)||
       !load("Hero_Return_Container_Proposal.bin",*container,84)||pair_word(*hero,36)!=100002||pair_word(*hero,56)||
       pair_word(*hero,40)!=512||pair_word(*hero,48)!=0x314c5641||!pair_native_ea(*hero,442,1002,ea)||
       !pair_agent_plan(*script,1853,1002,100002,plan))std::abort();
    for(size_t i=0;i<plan.count;i++)if(plan.references[i].before!=1002&&plan.references[i].before!=7)std::abort();
    const uint32_t agent=guest_call(&extra,0x0064c616u,0x34u);if(!gm_valid(agent,0x34))std::abort();
    extra.r[R_ECX]=agent;guest_call(&extra,0x00625e70u);
    if(rd32(agent+0x10)!=reserved||rd32(runtime+0x34)!=reserved+1)std::abort();
    pair_put(*hero,ea,reserved);pair_put(*script,plan.identity,reserved);
    for(size_t i=0;i<plan.count;i++)if(plan.references[i].before==1002)pair_put(*script,plan.references[i].offset,reserved);
    pair_put(*hero,36,0);if(!write("Hero_Return_Hero_Input.UNIT",*hero,442))std::abort();
    majesty::actors::UnitStage stage;const majesty::actors::StageInput input{pair_word(*hero,40),0,pair_word(*hero,48),pair_word(*hero,52)};
    uint32_t status=UINT32_MAX,id=0;const bool installed=stage.install();
    const uint32_t unit=installed?primary_file(extra,scratch,"Hero_Return_Hero_Input.UNIT",factory,0,false,&status,true,&stage,&input):0;
    if(!stage.remove())std::abort();
    std::fprintf(stderr,"[streaming] Hero return stage status=%08x complete=%u failure=%u\n",status,unsigned(installed&&unit&&!status),unsigned(stage.failure()));
    if(!installed||status||!gm_valid(unit,0x164)||!publish_native_identity(extra,factory,unit,id)||id<=502)std::abort();
    pair_put(*hero,36,id);pair_put(*script,plan.native,id);
    if(!write("Hero_Return_Agent_Input.GPL",*script,1853)||agent_file(extra,scratch,"Hero_Return_Agent_Input.GPL",agent,false))std::abort();
    wr32(scratch+144,reserved);wr32(scratch+148,agent);extra.r[R_ECX]=manager+0x28;guest_call(&extra,0x00634460u,scratch+128,scratch+144);
    if(rd8(scratch+132)!=1||lookup(reserved)!=agent||rd32(manager+0x34)!=entries+1)std::abort();
    extra.r[R_ECX]=agent;if(guest_call(&extra,0x00626310u)!=unit)std::abort();
    // The prepared CONT wrapper's48B PRIM payload owns empty child group1
    // and home group101 with the actual native guild469.
    std::memmove(container->data(),container->data()+36,48);
    if(pair_word(*container,12)!=1||pair_word(*container,16)!=101||pair_word(*container,20)!=100002||
       pair_word(*container,24)!=469||pair_word(*container,28)!=1||pair_word(*container,36)||
       pair_word(*container,40)!=1||pair_word(*container,44)!=100002)std::abort();
    pair_put(*container,20,id);pair_put(*container,44,id);
    if(!write("Hero_Return_Container_Input.bin",*container,48)||arrival_container_file(extra,scratch,"Hero_Return_Container_Input.bin",factory,unit,false)||
       !arrival_contains(unit,101,home))std::abort();
    extra.r[R_ECX]=home+0x94;
    if(!(guest_call(&extra,0x00598e20u,unit,home,100u)&255)||!arrival_contains(home,100,unit))std::abort();
    extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t operand=guest_call(&extra,0x0062a810u,5u);if(!operand)std::abort();
    extra.r[R_ECX]=operand;guest_call(&extra,0x006254c0u,reserved);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);
    extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,4u);
    const auto added=departure_list_state(members,reserved);HomeTaskView view;
    if(!added.valid||added.count!=1||added.matches!=1||added.other_hash!=roster.other_hash||
       !home_task_view(agent,view,reserved,id,7)||!view.going_home)std::abort();
    extra.r[R_ECX]=unit;if(!(guest_call(&extra,0x005a2370u)&255))std::abort();
    const uint32_t pending=rd32(manager+0x3c);DepartureQueues before{},after{};
    if(pair_queues(manager)!=queues||(pending!=manager+0x10&&pending!=manager+0x1c)||!departure_queues(manager,agent,before)||before.omitted)std::abort();
    wr32(scratch+144,agent);extra.r[R_ECX]=pending;guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);
    if(!departure_queues(manager,agent,after)||after.omitted!=1)std::abort();after.omitted=0;if(after!=before)std::abort();
    if(agent_file(extra,scratch,"Hero_Return_Agent_Observed.GPL",agent,true)||!load("Hero_Return_Agent_Observed.GPL",*observed,1853)||
       std::memcmp(script->data(),observed->data(),1853)||agent_file(extra,scratch,"Hero_Return_Guild_After.GPL",guild,true)||
       rd32(0x0071c6a8)!=clock||mods_hooks_installed_count()!=hooks||!majesty_browser_frontier_registered_hero_return_checkpoint(&extra))std::abort();
    std::fprintf(stderr,"[streaming] Hero return saved hero=%u agent=%u guild=469 guild-agent=7 clock=25800 native-members=1 script-members=1 queued=1 task=go_home function=use_building actor-records-preserved=1 original-full-save=1 owner-published=0 travel-qualified=0 result=pass\n",id,reserved);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);
    extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,5u);
    extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);
    extra.r[R_ECX]=unit;guest_call(&extra,0x005a21b0u);extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
    const auto cleaned=departure_list_state(members,reserved);
    if(native(id)||lookup(reserved)||native(469)!=home||lookup(7)!=guild||arrival_contains(home,100,unit)||
       !cleaned.valid||cleaned.count||pair_queues(manager)!=queues||rd32(manager+0x34)!=entries||
       mods_hooks_installed_count()!=hooks||!heap_free(scratch))std::abort();
    std::fprintf(stderr,"[streaming] Hero return cleanup aliases-absent=1 native-roster-empty=1 script-roster-empty=1 home-preserved=1 other-queues-preserved=1 hooks-preserved=1 result=pass\n");
#endif
}
// Reload one side of the actual committed registered-hero revision. Observe
// native occupancy and save through the original writer before any normal AI
// tick; destination cleanup then prevents an ungated remote-home dispatch.
void original_registered_hero_pair_reload_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted=false;
    const char *flag=recomp_env("BROWSER_STREAMING_HERO_PAIR_RELOAD_FIXTURE"),*profile=recomp_env("PROFILE_DIR");
    std::string_view path(profile?profile:"");
    const bool destination=path.ends_with("/frontier_1_0");
    const std::string_view suffix=destination?"/frontier_1_0":"/frontier_0_0";
    if(attempted||!flag||std::strcmp(flag,"1")||!path.ends_with(suffix))return;
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');
    const auto owned=path.substr(slash==path.npos?0:slash+1);
    const char *selected=recomp_env("RULE_FRONTIER_REGION");
    const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!enabled()||!selected||std::strcmp(selected,destination?"1_0":"0_0")||
       !owned.starts_with("actor-arrival-fixture-hero-pair-reload-")||owned.size()>80||
       recomp_env("RULE_FRONTIER_CHAPTER")||!gm_valid(state,0x50)||rd32(state)!=3||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    attempted=true;X86 extra=*c;extra.r[R_ESP]-=32768;
    char pathbuf[1024];std::array<uint32_t,4> ids{};
    FILE *f=recomp_writable_path("Hero_Pair_Reload_Identity.bin",pathbuf,sizeof pathbuf)?std::fopen(pathbuf,"rb"):nullptr;
    const bool read=f&&std::fread(ids.data(),1,16,f)==16&&std::fgetc(f)==EOF&&!std::ferror(f);if(f)std::fclose(f);
    const unsigned side=destination?1:0;const uint32_t clock=rd32(0x0071c6a8),hooks=mods_hooks_installed_count();
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if(!read||ids!=std::array<uint32_t,4>{0x31504852u,side,destination?554u:502u,destination?48u:27u}||
       clock!=(destination?24250u:25800u)||!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))std::abort();
    const uint32_t manager=rd32(runtime+4);if(!gm_valid(manager,0x4c)||rd32(manager+0x48))std::abort();
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    uint32_t unit=0,agent=0,home=0,cells=0,queued=0;
    if(destination) {
        unit=native(554);agent=lookup(48);home=lookup(45);
        if(!gm_valid(unit,0x164)||!gm_valid(agent,0x34)||!gm_valid(home,0x34)||native(555)||
           rd32(unit+0x6c)!=0x314c5641u||rd32(unit+0x74)||rd32(unit+0x84)!=factory||
           rd32(agent+0x20)!=554||rd8(agent+0x28)||rd32(home+0x20)||rd32(home+0x24)||rd8(home+0x28))std::abort();
        extra.r[R_ECX]=agent;if(guest_call(&extra,0x00626310u)!=unit)std::abort();
        extra.r[R_ECX]=home;if(guest_call(&extra,0x00626310u))std::abort();
        HomeTaskView view;DepartureQueues q{},hq{};
        const auto drawing=live_drawing(factory,unit);const uint32_t grid=rd32(factory+0x88);
        if(!home_task_view(agent,view,48,554,45)||!view.going_home||
           !gm_valid(grid,0x50)||rd32(grid+0x48)!=256||rd32(grid+0x4c)!=256||
           !joint_motion_physical(factory,unit,cells,256)||cells!=4||!drawing.valid||drawing.excluded!=1||
           !departure_queues(manager,agent,q)||q.omitted!=1||!departure_queues(manager,home,hq)||hq.omitted||
           agent_file(extra,scratch,"Hero_Pair_Reload_Agent.GPL",agent,true)||
           agent_file(extra,scratch,"Hero_Pair_Reload_Home.GPL",home,true))std::abort();
        queued=q.omitted;
    } else {
        unit=native(469);home=lookup(7);
        if(native(502)||native(503)||lookup(27)||!gm_valid(unit,0x98)||!gm_valid(home,0x34)||
           rd32(unit+0x6c)!=0x31564241u||rd32(home+0x20)!=469||rd8(home+0x28))std::abort();
        extra.r[R_ECX]=home;if(guest_call(&extra,0x00626310u)!=unit)std::abort();
        const auto roster=departure_list_state(departure_list(extra,scratch,home,"members"),27);
        if(!roster.valid||roster.count||roster.matches||agent_file(extra,scratch,"Hero_Pair_Reload_Home.GPL",home,true))std::abort();
    }
    if(!heap_free(scratch)||mods_hooks_installed_count()!=hooks||rd32(0x0071c6a8)!=clock||
       !majesty_browser_frontier_registered_hero_pair_reload_checkpoint(&extra,side))std::abort();
    std::fprintf(stderr,"[streaming] Hero pair reload saved side=%u clock=%u hero=%u agent=%u present=%u home=%u queued=%u footprint=%u effect-absent=1 original-full-load=1 saved=1 travel-qualified=0 result=pass\n",
        side,clock,ids[2],ids[3],unsigned(destination),destination?45u:7u,queued,cells);
    if(destination) {
        extra.r[R_ECX]=unit;guest_call(&extra,0x005a21b0u);extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
        DepartureQueues q{};if(native(554)||native(555)||lookup(48)||lookup(45)!=home||
           !departure_queues(manager,agent,q)||q.omitted||live_drawing(factory,unit).excluded)std::abort();
    }
    if(mods_hooks_installed_count()!=hooks)std::abort();
    std::fprintf(stderr,"[streaming] Hero pair reload cleanup side=%u original-removal=%u aliases-absent=1 home-preserved=1 hooks-preserved=1 result=pass\n",side,unsigned(destination));
#endif
}
struct HeroReturnPairReload {
    uint32_t stage=0,side=0,start=0,world=0,factory=0,runtime=0,manager=0,unit=0,agent=0,home=0,guild=0;
    uint32_t hook=0,hooks_before=0,hero_calls=0,other_calls=0;
};
HeroReturnPairReload hero_return_pair_reload;
void hero_return_pair_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=hero_return_pair_reload;const bool hero=s.stage==1&&s.agent&&cpu->ecx==s.agent;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.stage==1){auto &n=hero?s.hero_calls:s.other_calls;if(++n>65536)std::abort();}
}
void original_hero_return_pair_reload_frame(X86 *c) {
#ifndef __EMSCRIPTEN__
    const char *flag=recomp_env("BROWSER_STREAMING_HERO_RETURN_PAIR_RELOAD_FIXTURE"),*profile=recomp_env("PROFILE_DIR");
    std::string_view path(profile?profile:"");const bool remote=path.ends_with("/frontier_1_0");
    const std::string_view suffix=remote?"/frontier_1_0":"/frontier_0_0";
    if(!flag||std::strcmp(flag,"1")||!path.ends_with(suffix))return;
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');const auto owned=path.substr(slash==path.npos?0:slash+1);
    const char *selected=recomp_env("RULE_FRONTIER_REGION");const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!enabled()||!selected||std::strcmp(selected,remote?"1_0":"0_0")||
       !owned.starts_with("actor-arrival-fixture-hero-return-pair-reload-")||owned.size()>80||
       recomp_env("RULE_FRONTIER_CHAPTER")||!gm_valid(state,0x50)||rd32(state)!=3||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return;
    auto &s=hero_return_pair_reload;if(s.stage==2)return;X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t clock=rd32(0x0071c6a8);
    if(!s.stage){s.side=remote?1u:0u;s.start=clock;s.world=world;s.factory=rd32(world+0x10);s.runtime=guest_call(&extra,0x00623b20u);
        s.hooks_before=mods_hooks_installed_count();
        if(clock!=(remote?24250u:31800u)||!gm_valid(s.factory,0x8c)||!gm_valid(s.runtime,0x38))std::abort();
        s.manager=rd32(s.runtime+4);if(!gm_valid(s.manager,0x4c)||rd32(s.manager+0x48))std::abort();
    }else{if(world!=s.world||remote!=bool(s.side)||clock-s.start>10000)std::abort();if(clock-s.start<6000)return;}
    auto native=[&](uint32_t id){extra.r[R_ECX]=s.factory;return guest_call(&extra,0x005a10d0u,id);};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=s.runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    if(!s.stage){
        char pathbuf[1024];std::array<uint32_t,4> ids{};
        FILE *f=recomp_writable_path("Hero_Return_Pair_Identity.bin",pathbuf,sizeof pathbuf)?std::fopen(pathbuf,"rb"):nullptr;
        const bool read=f&&std::fread(ids.data(),1,16,f)==16&&std::fgetc(f)==EOF&&!std::ferror(f);if(f)std::fclose(f);
        if(!read||ids!=std::array<uint32_t,4>{0x32504852u,s.side,remote?554u:504u,remote?48u:28u})std::abort();
        if(!remote){s.unit=native(504);s.agent=lookup(28);s.home=native(469);s.guild=lookup(7);}
        else s.guild=lookup(45);
    }
    DepartureQueues queue{},home_queue{};uint32_t parent=0,queued=0,grid_matches=0;
    if(!remote){
        if(native(504)!=s.unit||lookup(28)!=s.agent||native(469)!=s.home||lookup(7)!=s.guild||
           !gm_valid(s.unit,0x164)||!gm_valid(s.agent,0x34)||!gm_valid(s.home,0x98)||!gm_valid(s.guild,0x34)||
           rd32(s.unit+0x6c)!=0x314c5641u||rd32(s.unit+0x74)!=469||rd32(s.unit+0x84)!=s.factory||
           rd32(s.agent+0x20)!=504||rd8(s.agent+0x28)||rd32(s.guild+0x20)!=469||rd8(s.guild+0x28)||
           !arrival_contains(s.home,100,s.unit)||!arrival_contains(s.home,2,s.unit)||!arrival_contains(s.unit,101,s.home))std::abort();
        extra.r[R_ECX]=s.agent;if(guest_call(&extra,0x00626310u)!=s.unit)std::abort();
        extra.r[R_ECX]=s.guild;if(guest_call(&extra,0x00626310u)!=s.home)std::abort();
        HomeTaskView view;const auto drawing=live_drawing(s.factory,s.unit);
        const auto roster=departure_list_state(departure_list(extra,scratch,s.guild,"members"),28);
        if(!home_task_view(s.agent,view,28,504,7)||rd32(view.home+8)!=7||rd32(view.target+8)!=7||
           std::strcmp(view.function,"Rest_at_guild")||!home_text(view.task+8,"")||
           !departure_queues(s.manager,s.agent,queue)||queue.omitted!=1||!drawing.valid||drawing.excluded!=1||
           !roster.valid||roster.count!=1||roster.matches!=1)std::abort();
        const uint32_t grid=rd32(s.factory+0x88);
        if(!gm_valid(grid,0x50)||rd32(grid+0x48)!=256||rd32(grid+0x4c)!=256)std::abort();
        const uint32_t buckets=rd32(grid+0x18);if(!gm_valid(buckets,256*256*4))std::abort();
        for(uint32_t cell=0;cell<256*256;++cell){const uint32_t bucket=rd32(buckets+cell*4);if(!bucket)continue;
            if(!gm_valid(bucket,32))std::abort();for(uint32_t slot=0;slot<8&&rd32(bucket+slot*4);++slot)grid_matches+=rd32(bucket+slot*4)==s.unit;}
        if(grid_matches)std::abort();parent=469;queued=queue.omitted;
        if(!s.stage&&agent_file(extra,scratch,"Hero_Return_Pair_Agent.GPL",s.agent,true))std::abort();
    }else{
        if(native(554)||native(555)||lookup(48)||lookup(45)!=s.guild||!gm_valid(s.guild,0x34)||
           rd32(s.guild+0x20)||rd32(s.guild+0x24)||rd8(s.guild+0x28)||
           !departure_queues(s.manager,s.guild,home_queue)||home_queue.omitted)std::abort();
        extra.r[R_ECX]=s.guild;if(guest_call(&extra,0x00626310u))std::abort();
    }
    if(!s.stage&&agent_file(extra,scratch,"Hero_Return_Pair_Home.GPL",s.guild,true))std::abort();
    if(!heap_free(scratch)||!majesty_browser_frontier_hero_return_pair_reload_checkpoint(&extra,s.side,s.stage!=0))std::abort();
    if(!s.stage){
        if(mods_hooks_installed_count()!=s.hooks_before||rd32(0x0071c6a8)!=s.start||
           mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,hero_return_pair_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.hook)!=POP_OK)std::abort();
        s.stage=1;std::fprintf(stderr,"[streaming] Hero return pair loaded side=%u clock=%u hero=%u agent=%u present=%u home=%u parent=%u queued=%u grid-matches=0 original-full-load=1 loaded-saved=1 result=pass\n",
            s.side,clock,remote?554u:504u,remote?48u:28u,unsigned(!remote),remote?45u:7u,parent,queued);return;
    }
    if(!s.other_calls||(!remote&&!s.hero_calls)||(remote&&s.hero_calls)||clock-s.start!=6000||
       mods_hook_remove(MODS_OWNER_RUNTIME,s.hook)!=POP_OK||mods_hooks_installed_count()!=s.hooks_before)std::abort();
    s.stage=2;std::fprintf(stderr,"[streaming] Hero return pair evolved side=%u clock=%u elapsed=6000 hero-returned=%u other-returned=%u present=%u home=%u parent=%u queued=%u original-ai=1 gate-used=0 evolved-saved=1 hooks-removed=1 travel-qualified=0 result=pass\n",
        s.side,clock,s.hero_calls,s.other_calls,unsigned(!remote),remote?45u:7u,parent,queued);
#endif
}
} // namespace

extern "C" bool majesty_browser_streaming_session_home_import_ready(X86 *c, bool reloaded) {
#ifndef __EMSCRIPTEN__
    const char *flag=recomp_env("BROWSER_STREAMING_SESSION_HOME_IMPORT_FIXTURE");
    const auto &s=outdoor_family_return;
    if(!flag||std::strcmp(flag,"v1")||!s.complete)return false;
    const char *profile=recomp_env("PROFILE_DIR");const std::string_view path(profile?profile:"");
    if(path.find("/actor-arrival-fixture-session-home-")==path.npos||!path.ends_with("/frontier_0_0")||
        rd32(0x0071c6a8)!=57650||mods_hook_depth()||!sched_holds_baton())std::abort();
    if(!reloaded)return true;
    X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t world=rd32(0x0071c68c),factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))std::abort();
    const uint32_t manager=rd32(runtime+4);auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t unit=native(s.ids[0]),agent=lookup(s.agent_id),home=native(469),guild=lookup(7);
    if(!gm_valid(unit,0x164)||!gm_valid(agent,0x34)||rd32(agent+0x20)!=s.ids[0]||rd32(unit+0x74)||
        !gm_valid(home,0x98)||!gm_valid(guild,0x34)||rd32(guild+0x20)!=469)std::abort();
    for(unsigned i=1;i<4;++i){const uint32_t effect=native(s.ids[i]);if(!gm_valid(effect,0x164)||rd32(effect+0x74)!=s.ids[0]||!arrival_contains(unit,1,effect))std::abort();}
    for(uint32_t id:{504u,527u,528u,529u})if(native(id))std::abort();if(lookup(28))std::abort();
    uint32_t cells=0;const auto drawing=live_drawing(factory,unit);DepartureQueues queues{};HomeTaskView view;
    if(!joint_motion_physical(factory,unit,cells)||cells!=4||!drawing.valid||drawing.excluded!=1||
        !arrival_contains(unit,101,home)||!arrival_contains(home,100,unit)||
        !home_task_view(agent,view,s.agent_id,s.ids[0],7)||!home_text(view.task+8,"go_home")||std::strcmp(view.function,"travel_to")||
        !departure_queues(manager,agent,queues)||queues.omitted!=1)std::abort();
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
    const auto roster=departure_list_state(departure_list(extra,scratch,guild,"members"),s.agent_id);
    if(!roster.valid||roster.count!=1||roster.matches!=1||!heap_free(scratch))std::abort();
    std::fprintf(stderr,"[streaming] Session home import ready hero=%u effects=%u,%u,%u agent=%u clock=57650 physical=4 drawing=1 native-home=469/7 script-roster=1 queued=1 new-this-session=1 ordinary-ticks=0 result=pass\n",s.ids[0],s.ids[1],s.ids[2],s.ids[3],s.agent_id);
    return true;
#else
    return false;
#endif
}

namespace {
// Retire only the selected northern family after the returned destination has
// independently completed original live play. Private reload, no publication.
void original_halo_return_source_retirement(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted=false;const char *flag=recomp_env("BROWSER_STREAMING_HALO_RETURN_SOURCE_RETIRE");
    if(!flag||attempted)return;
    const char *profile=recomp_env("PROFILE_DIR"),*binding=recomp_env("BROWSER_STREAMING_HALO_RETURN_SOURCE_BINDING");
    std::string_view path(profile?profile:"");constexpr std::string_view suffix="/frontier_0_-1";
    if(std::strcmp(flag,"1")||!path.ends_with(suffix)||!binding||std::strlen(binding)!=64||!enabled()||
       recomp_env("RULE_FRONTIER_CHAPTER")||recomp_env("BROWSER_STREAMING_HALO_RETURN_LIVE")||recomp_env("BROWSER_STREAMING_HALO_RETURN_IMPORT"))std::abort();
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');const auto owned=path.substr(slash==path.npos?0:slash+1);
    if(!owned.starts_with("actor-arrival-fixture-halo-world-return-retire-")||owned.size()>80)std::abort();
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c),clock=rd32(0x0071c6a8);
    if(!gm_valid(phase,0x50)||rd32(phase)!=3||!gm_valid(world,0x14))return;
    if(mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)std::abort();
    char filename[1024];std::array<uint32_t,9> ids{};
    if(!recomp_writable_path("Halo_Return_Source.ids",filename,sizeof filename)||loader_hash_file_bounded(filename,36)!=binding)std::abort();
    FILE *f=std::fopen(filename,"rb");if(!f)std::abort();
    const bool read=std::fread(ids.data(),1,36,f)==36&&std::fgetc(f)==EOF&&!std::ferror(f),closed=std::fclose(f)==0;
    if(!read||!closed||ids!=std::array<uint32_t,9>{0x31535248,1500,510,54,513,516,511,55,53}||clock!=ids[1])std::abort();
    attempted=true;X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))std::abort();const uint32_t manager=rd32(runtime+4);
    if(!gm_valid(manager,0x4c)||rd32(manager+0x48))std::abort();
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    auto script=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t units[]={native(ids[2]),native(ids[4]),native(ids[5])};
    for(unsigned k=0;k<3;++k)if(!gm_valid(units[k],0x164)||rd32(units[k])!=0x0068098c||
        (rd32(units[k]+0x64)&4)||rd32(units[k]+0x74)!=(k?ids[2]:0u)||rd32(units[k]+0x84)!=factory)std::abort();
    const uint32_t agent=script(ids[3]),marker=script(ids[7]),proxy=script(ids[8]),marker_unit=native(ids[6]);
    if(!gm_valid(agent,0x34)||!gm_valid(marker,0x34)||!gm_valid(proxy,0x34)||!gm_valid(marker_unit,0x94)||
       rd32(agent+0x20)!=ids[2]||rd32(marker+0x20)!=ids[6]||rd32(proxy+0x20)||native(512)||
       arrival_contains(units[0],101,marker_unit)||arrival_contains(marker_unit,100,units[0])||
       !arrival_contains(units[0],1,units[1])||!arrival_contains(units[0],1,units[2]))std::abort();
    const uint32_t entries=rd32(manager+0x34),native_counter=rd32(factory+0x28),script_counter=rd32(runtime+0x34),hooks=mods_hooks_installed_count();
    NativeRegistrySnapshot before{},after{};DepartureQueues queues_before{},queues_after{};
    if(!native_registry_snapshot(factory,before,0,units,3)||!departure_queues(manager,agent,queues_before)||queues_before.omitted!=1||
       !majesty_browser_frontier_halo_return_source_checkpoint(&extra,false))std::abort();
    // Original gameplay removal unlinks physical children, their native banks,
    // models and the hero, then manager cleanup retires the marked GPL alias.
    for(unsigned k=3;k--;){extra.r[R_ECX]=units[k];guest_call(&extra,0x005a21b0u);}
    extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);queues_before.omitted=0;
    for(uint32_t id:{ids[2],ids[4],ids[5]})if(native(id))std::abort();
    if(script(ids[3])||script(ids[7])!=marker||script(ids[8])!=proxy||native(ids[6])!=marker_unit||native(512)||
       !native_registry_snapshot(factory,after)||after!=before||!departure_queues(manager,agent,queues_after)||queues_after!=queues_before||
       rd32(manager+0x34)+1!=entries||rd32(manager+0x48)||rd32(factory+0x28)!=native_counter||rd32(runtime+0x34)!=script_counter||
       mods_hooks_installed_count()!=hooks||rd32(0x0071c6a8)!=clock||!majesty_browser_frontier_halo_return_source_checkpoint(&extra,true))std::abort();
    extra.r[R_ECX]=phase;guest_call(&extra,0x00416050u,7u);if(rd32(phase)!=3||rd32(phase+4)!=7)std::abort();
    std::fprintf(stderr,"[streaming] Halo return source retired clock=1500 units=510,513,516 agent=54 retained-flag=511/55 retained-home-proxy=53 aliases-absent=1 released-roster-preserved=1 other-registry-preserved=1 other-queues-preserved=1 original-removal=1 before-after-saved=1 original-pause=1 owner-published=0 result=pass\n");
#endif
}
struct HaloReturnLive {
    uint32_t stage=0,start=0,end=0,world=0,factory=0,runtime=0,manager=0,agent=0,guild=0,home=0;
    uint32_t hooks_before=0,agent_hook=0,context_hook=0,command_hook=0,samples=0,changed=0,ai=0,contexts=0,other_ai=0;
    bool in_agent=false;
    std::array<uint32_t,3> ids{},units{},commands{},retired{};
    std::array<int32_t,3> initial{},previous{};
};
HaloReturnLive halo_return_live;
void halo_return_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_return_live;const bool own=s.stage==1&&cpu->ecx==s.agent,prior=s.in_agent;
    if(own)s.in_agent=true;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(own){s.in_agent=prior;if(++s.ai>4096)std::abort();}
    else if(s.stage==1&&++s.other_ai>65536)std::abort();
}
void halo_return_context(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_return_live;const bool own=s.stage==1&&s.in_agent&&rd32(0x00720304u)==s.agent;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(own&&++s.contexts>4096)std::abort();
}
void halo_return_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_return_live;int index=-1;
    if(s.stage==1&&gm_valid(cpu->ecx,8))for(unsigned k=0;k<3;++k)
        if(!s.retired[k]&&rd32(cpu->ecx+4)==s.units[k])index=int(k);
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(index>=0&&++s.commands[index]>4096)std::abort();
}
// Fresh original whole-world load of the qualified return save. No second
// import or first-postload replay: the loader has already resolved model
// indices, parents, drawing and the physical grid. Only missing derived
// command membership and the returning agent's original queue are admitted.
void original_halo_return_live_frame(X86 *c) {
#ifndef __EMSCRIPTEN__
    auto &s=halo_return_live;const char *owner_flag=recomp_env("BROWSER_STREAMING_HALO_RETURN_OWNER");
    const bool owner=owner_flag!=nullptr;const char *live_flag=recomp_env("BROWSER_STREAMING_HALO_RETURN_LIVE");
    const char *flag=owner?owner_flag:live_flag;
    if(!flag||s.stage==2)return;
    const char *profile=recomp_env("PROFILE_DIR"),*binding=recomp_env(owner?"BROWSER_STREAMING_HALO_RETURN_OWNER_BINDING":"BROWSER_STREAMING_HALO_RETURN_LIVE_BINDING");
    std::string_view path(profile?profile:"");constexpr std::string_view suffix="/frontier_0_0";
    if(std::strcmp(flag,"1")||!path.ends_with(suffix)||!binding||std::strlen(binding)!=64||
       (owner&&live_flag)||recomp_env("BROWSER_STREAMING_HALO_RETURN_SOURCE_RETIRE")||
       recomp_env("BROWSER_STREAMING_HALO_RETURN_IMPORT")||recomp_env("RULE_FRONTIER_CHAPTER")||!enabled())std::abort();
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');const auto owned=path.substr(slash==path.npos?0:slash+1);
    if(!owned.starts_with(owner?"actor-arrival-fixture-halo-world-return-owner-":"actor-arrival-fixture-halo-world-return-live-")||owned.size()>80)std::abort();
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c),clock=rd32(0x0071c6a8);
    if(!gm_valid(phase,0x50)||rd32(phase)!=3||!gm_valid(world,0x14))return;
    if(mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;
    auto native=[&](uint32_t id){extra.r[R_ECX]=s.factory;return guest_call(&extra,0x005a10d0u,id);};
    auto checkpoint=[&](unsigned stage){return owner?majesty_browser_frontier_halo_return_owner_checkpoint(&extra,stage):
        majesty_browser_frontier_halo_return_live_checkpoint(&extra,stage);};
    if(!s.stage){
        char filename[1024];std::array<uint32_t,7> ids{};
        if(!recomp_writable_path(owner?"Halo_Return_Owner.ids":"Halo_Return_Live.ids",filename,sizeof filename)||loader_hash_file_bounded(filename,28)!=binding)std::abort();
        FILE *f=std::fopen(filename,"rb");if(!f)std::abort();
        const bool read=std::fread(ids.data(),1,28,f)==28&&std::fgetc(f)==EOF&&!std::ferror(f),closed=std::fclose(f)==0;
        if(!read||!closed||ids[0]!=(owner?0x314f5248u:0x314c5248u)||ids[1]!=(owner?63650u:60650u)||ids[2]!=(owner?64150u:63650u)||clock!=ids[1]||
           ids[3]<=481||ids[4]<=17||ids[5]!=ids[3]+1||ids[6]!=ids[3]+2)std::abort();
        s.start=clock;s.end=ids[2];s.world=world;s.factory=rd32(world+0x10);s.runtime=guest_call(&extra,0x00623b20u);
        if(!gm_valid(s.factory,0x8c)||!gm_valid(s.runtime,0x38))std::abort();s.manager=rd32(s.runtime+4);
        if(!gm_valid(s.manager,0x4c)||rd32(s.manager+0x48))std::abort();s.hooks_before=mods_hooks_installed_count();
        s.ids={ids[3],ids[5],ids[6]};for(unsigned k=0;k<3;++k){s.units[k]=native(s.ids[k]);
            if(owner&&k){if(s.units[k])std::abort();continue;}
            if(!gm_valid(s.units[k],0x164)||rd32(s.units[k])!=0x0068098c||(rd32(s.units[k]+0x64)&4)||
               rd32(s.units[k]+0x74)!=(k?s.ids[0]:0u)||rd32(s.units[k]+0x84)!=s.factory)std::abort();}
        extra.r[R_ECX]=s.runtime;s.agent=guest_call(&extra,0x006236b0u,ids[4]);
        extra.r[R_ECX]=s.runtime;s.guild=guest_call(&extra,0x006236b0u,7u);s.home=native(469);
        if(!gm_valid(s.agent,0x34)||!gm_valid(s.guild,0x34)||!gm_valid(s.home,0x98)||
           rd32(s.agent+0x20)!=s.ids[0]||rd32(s.guild+0x20)!=469||native(481))std::abort();
        extra.r[R_ECX]=s.agent;if(guest_call(&extra,0x00626310u)!=s.units[0])std::abort();
        const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();
        const uint32_t members=departure_list(extra,scratch,s.guild,"members");const auto roster=departure_list_state(members,ids[4]);
        uint32_t cells=0;const auto drawing=live_drawing(s.factory,s.units[0]);
        if(!roster.valid||roster.count!=1||roster.matches!=1||!arrival_contains(s.home,100,s.units[0])||
           !arrival_contains(s.units[0],101,s.home)||(!owner&&(!arrival_contains(s.units[0],1,s.units[1])||!arrival_contains(s.units[0],1,s.units[2])))||
           !joint_motion_physical(s.factory,s.units[0],cells,256)||cells!=4||!drawing.valid||drawing.excluded!=1||
           !checkpoint(0))std::abort();
        for(unsigned k=0;k<s.units.size();++k){const uint32_t unit=s.units[k];if(owner&&k)continue;RegisteredOrderMembers before{},after{};
            const bool before_valid=registered_order_members(s.factory,unit,before);
            std::fprintf(stderr,"[streaming] Halo return live command before id=%u valid=%u matches=%u kept=%u\n",rd32(unit+0x60),unsigned(before_valid),before.matches,before.kept);
            if(!before_valid)std::abort();
            // The qualified return has no hero ORDR record. Original reload
            // keeps it out of the command group until ordinary AI creates a
            // bank. Only the two effects carry saved commands at this point.
            const uint32_t expected=owner||k?1u:0u;
            // Journal-selected reload must already carry original derived
            // membership; it may not repair or synthesize a command bank.
            if(owner&&before.matches!=1)std::abort();
            if(!owner&&expected&&!before.matches){extra.r[R_ECX]=unit;guest_call(&extra,0x005b66f0u,0x5244524fu);}
            const bool after_valid=registered_order_members(s.factory,unit,after);
            std::fprintf(stderr,"[streaming] Halo return live command after id=%u valid=%u matches=%u kept=%u others-same=%u\n",rd32(unit+0x60),unsigned(after_valid),after.matches,after.kept,unsigned(before.kept==after.kept&&before.hash==after.hash));
            if(!after_valid||after.matches!=expected||before.kept!=after.kept||before.hash!=after.hash)std::abort();
        }
        DepartureQueues before{},after{};const uint32_t pending=rd32(s.manager+0x3c);
        const bool queue_valid=departure_queues(s.manager,s.agent,before);
        std::fprintf(stderr,"[streaming] Halo return live queue before valid=%u pending-valid=%u own=%u others=%u,%u\n",unsigned(queue_valid),unsigned(pending==s.manager+0x10||pending==s.manager+0x1c),before.omitted,before.queues[0].kept,before.queues[1].kept);
        if((pending!=s.manager+0x10&&pending!=s.manager+0x1c)||!queue_valid||before.omitted!=(owner?1u:0u))std::abort();
        if(!owner){wr32(scratch+144,s.agent);extra.r[R_ECX]=pending;guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);}
        const bool after_valid=departure_queues(s.manager,s.agent,after);
        std::fprintf(stderr,"[streaming] Halo return live queue after valid=%u own=%u others=%u,%u\n",unsigned(after_valid),after.omitted,after.queues[0].kept,after.queues[1].kept);
        if(!after_valid||after.omitted!=1)std::abort();after.omitted=0;before.omitted=0;if(after!=before)std::abort();
        if(!checkpoint(1)||!heap_free(scratch))std::abort();
        for(unsigned k=0;k<3;++k)s.initial[k]=s.previous[k]=int32_t(rd32(s.units[0]+0x48+k*4));
        if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,halo_return_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)!=POP_OK||
           mods_hook_install_ex(MODS_OWNER_RUNTIME,0x006381b0u,0,halo_return_context,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.context_hook)!=POP_OK||
           mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,halo_return_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK)std::abort();
        s.stage=1;
        if(owner)std::fprintf(stderr,"[streaming] Halo return owner ready hero=%u agent=%u clock=%u selected=1 original-load=1 imported=0 expired-effects-restored=0 queue-added=0 commands-repaired=0 model-postload-repeated=0 ready-saved=1 owner-published=0 result=pass\n",s.ids[0],ids[4],clock);
        else std::fprintf(stderr,"[streaming] Halo return live ready hero=%u agent=%u effects=%u,%u clock=%u loaded=1 footprint=4 drawing=1 native-home=469/7 queued=1 model-postload-repeated=0 records-rewritten=0 ready-saved=1 owner-published=0 result=pass\n",s.ids[0],ids[4],s.ids[1],s.ids[2],clock);
        return;
    }
    if(world!=s.world||clock<s.start||clock>s.end+100)std::abort();if(clock==s.start)return;
    for(unsigned k=0;k<3;++k){const uint32_t actual=native(s.ids[k]);
        if(owner&&k){if(actual)std::abort();continue;}
        if(!actual&&k){if(!s.commands[k])std::abort();if(!s.retired[k]){s.retired[k]=clock;
            std::fprintf(stderr,"[streaming] Halo return live effect retired id=%u clock=%u original-commands=%u result=pass\n",s.ids[k],clock,s.commands[k]);}continue;}
        if(actual!=s.units[k]||s.retired[k]||(rd32(actual+0x64)&4))std::abort();
    }
    std::array<int32_t,3> pose{};for(unsigned k=0;k<3;++k)pose[k]=int32_t(rd32(s.units[0]+0x48+k*4));
    uint32_t cells=0;const auto drawing=live_drawing(s.factory,s.units[0]);
    const uint32_t parent=rd32(s.units[0]+0x74);
    if(!drawing.valid||drawing.excluded>1)std::abort();
    if(owner&&parent){
        if(parent!=469||!arrival_contains(s.home,2,s.units[0]))std::abort();
        const uint32_t grid=rd32(s.factory+0x88);
        if(!gm_valid(grid,0x50)||rd32(grid+0x48)!=256||rd32(grid+0x4c)!=256)std::abort();
        const uint32_t buckets=rd32(grid+0x18);if(!gm_valid(buckets,256*256*4))std::abort();
        for(uint32_t cell=0;cell<256*256;++cell){const uint32_t bucket=rd32(buckets+cell*4);if(!bucket)continue;
            if(!gm_valid(bucket,32))std::abort();for(uint32_t slot=0;slot<8&&rd32(bucket+slot*4);++slot)cells+=rd32(bucket+slot*4)==s.units[0];}
        if(cells)std::abort();
    }
    else if(parent||!joint_motion_physical(s.factory,s.units[0],cells,256)||cells!=4||drawing.excluded!=1)std::abort();
    if(++s.samples>128)std::abort();if(pose!=s.previous)++s.changed;s.previous=pose;
    if(clock<s.end)return;
    std::fprintf(stderr,"[streaming] Halo return live endpoint clock=%u changed=%u ai=%u contexts=%u other-ai=%u commands=%u,%u,%u retired=%u,%u\n",clock,s.changed,s.ai,s.contexts,s.other_ai,s.commands[0],s.commands[1],s.commands[2],s.retired[1],s.retired[2]);
    if(!s.ai||!s.contexts||!s.other_ai||(owner?(!s.commands[0]||!s.changed):(!s.commands[1]||!s.commands[2])))std::abort();
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)std::abort();const uint32_t aid=rd32(s.agent+0x10);
    const uint32_t members=departure_list(extra,scratch,s.guild,"members");const auto roster=departure_list_state(members,aid);DepartureQueues queues{};
    if(!roster.valid||roster.count!=1||roster.matches!=1||!arrival_contains(s.home,100,s.units[0])||!arrival_contains(s.units[0],101,s.home)||
       !departure_queues(s.manager,s.agent,queues)||queues.omitted!=1||!checkpoint(2)||!heap_free(scratch))std::abort();
    if(mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK||mods_hook_remove(MODS_OWNER_RUNTIME,s.context_hook)!=POP_OK||
       mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK||mods_hooks_installed_count()!=s.hooks_before)std::abort();
    extra.r[R_ECX]=phase;guest_call(&extra,0x00416050u,7u);if(rd32(phase)!=3||rd32(phase+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();s.stage=2;
    if(owner)std::fprintf(stderr,"[streaming] Halo return owner evolved hero=%u agent=%u clock=%u ai=%u contexts=%u other-ai=%u commands=%u changed=%u initial=%d,%d,%d accepted=%d,%d,%d parent=%u footprint=%u drawing=%u native-home=469/7 queued=1 expired-effects-restored=0 evolved-saved=1 original-pause=1 hooks-removed=1 owner-published=0 result=pass\n",s.ids[0],aid,clock,s.ai,s.contexts,s.other_ai,s.commands[0],s.changed,s.initial[0],s.initial[1],s.initial[2],pose[0],pose[1],pose[2],parent,cells,drawing.excluded);
    else std::fprintf(stderr,"[streaming] Halo return live evolved hero=%u agent=%u clock=%u ai=%u contexts=%u other-ai=%u commands=%u,%u,%u changed=%u retired=%u,%u initial=%d,%d,%d accepted=%d,%d,%d footprint=4 drawing=1 native-home=469/7 queued=1 evolved-saved=1 original-pause=1 hooks-removed=1 source-retired=0 owner-published=0 result=pass\n",s.ids[0],aid,clock,s.ai,s.contexts,s.other_ai,s.commands[0],s.commands[1],s.commands[2],s.changed,s.retired[1],s.retired[2],s.initial[0],s.initial[1],s.initial[2],pose[0],pose[1],pose[2]);
#endif
}
}

// Original destination registration, shared by native and WASM. The caller
// must bind the record to its admitted loaded destination before invoking it.
// No actor pointer or namespace cache survives this call. A proposal ID must
// equal the CURRENT original allocation counter; reuse never allocates an ID.
extern "C" uint32_t majesty_browser_streaming_register_hero_home(X86 *c,const char *binding,
    uint32_t bytes_expected,uint32_t expected_clock,uint32_t proposed_id,bool reuse) {
    if(!c||!binding||std::strlen(binding)!=64||bytes_expected<56||bytes_expected>1024||
       !proposed_id||proposed_id>=0x7ffffffeu||mods_hook_depth()||!sched_holds_baton()||
       c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return 0;
    for(unsigned i=0;i<64;++i)if(!((binding[i]>='0'&&binding[i]<='9')||(binding[i]>='a'&&binding[i]<='f')))return 0;
    const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c),game=rd32(0x006d8568),hooks=mods_hooks_installed_count();
    if(!gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=expected_clock||
       !gm_valid(world,0x14)||!gm_valid(game,0x21c)||rd32(game+0x218)==2)return 0;
    X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))return 0;
    const uint32_t manager=rd32(runtime+4),counter=rd32(runtime+0x34),native_counter=rd32(factory+0x28);
    if(!gm_valid(manager,0x4c)||rd32(manager+0x48)||!counter||counter>=0x7ffffffeu||(!reuse&&proposed_id!=counter))return 0;
    char proposal_path[1024],input_path[1024],observed_path[1024];
    if(!recomp_writable_path("Frontier_Hero_Home.GPL",proposal_path,sizeof proposal_path)||
       !recomp_writable_path("Frontier_Hero_Home_Input.GPL",input_path,sizeof input_path)||
       !recomp_writable_path("Frontier_Hero_Home_Observed.GPL",observed_path,sizeof observed_path))return 0;
    OsStat st{};if(os_lstat(proposal_path,&st)||!st.is_regular||st.is_symlink||st.size!=bytes_expected||
       loader_hash_file_bounded(proposal_path,bytes_expected)!=binding)return 0;
    for(const char *path:{input_path,observed_path}){
        OsStat existing{};if(!os_lstat(path,&existing)&&(!existing.is_regular||existing.is_symlink))return 0;
    }
    auto bytes=std::make_unique<PrimaryBytes>();auto plan=std::make_unique<PairPlan>();size_t size=0;
    if(!agent_bytes(proposal_path,*bytes,size)||size!=bytes_expected||pair_word(*bytes,size-24)!=proposed_id||
       !pair_agent_plan(*bytes,size,proposed_id,0,*plan)||plan->count||plan->values!=9||pair_word(*bytes,16)!=9||
       pair_word(*bytes,plan->identity-4)||plan->identity!=size-24||plan->native!=size-19)return 0;
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    uint32_t agent=lookup(proposed_id);if(bool(agent)!=reuse)return 0;
    const uint32_t count=rd32(manager+0x34);const auto queues=pair_queues(manager);DepartureQueues queue_records{};
    NativeRegistrySnapshot before;if(!native_registry_snapshot(factory,before)||
       !departure_queues(manager,agent,queue_records)||queue_records.omitted)return 0;
    auto pure=[&]{return gm_valid(agent,0x34)&&lookup(proposed_id)==agent&&rd32(agent+0x10)==proposed_id&&
       !rd32(agent+0x20)&&!rd32(agent+0x24)&&!rd8(agent+0x28)&&gm_valid(rd32(agent),0x10)&&
       rd32(rd32(agent)+0xc)==9&&!rd32(agent+0xc);};
    if(reuse&&!pure())return 0;
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)return 0;
    if(!reuse){
        if(!pair_write(input_path,*bytes,size)){heap_free(scratch);return 0;}
        agent=guest_call(&extra,0x0064c616u,0x34u);if(!gm_valid(agent,0x34))std::abort();
        extra.r[R_ECX]=agent;guest_call(&extra,0x00625e70u);
        if(rd32(agent+0x10)!=proposed_id||rd32(runtime+0x34)!=counter+1)std::abort();
        if(agent_file(extra,scratch,"Frontier_Hero_Home_Input.GPL",agent,false))std::abort();
        wr32(scratch+144,proposed_id);wr32(scratch+148,agent);extra.r[R_ECX]=manager+0x28;
        guest_call(&extra,0x00634460u,scratch+128,scratch+144);
        if(rd8(scratch+132)!=1)std::abort();
        if(!pure())std::abort();
    }
    // Preserve existing attributes on reuse: compare original serialization
    // before returning its alias, rather than reading a replacement into it.
    extra.r[R_ECX]=agent;if(guest_call(&extra,0x00626310u))std::abort();
    if(agent_file(extra,scratch,"Frontier_Hero_Home_Observed.GPL",agent,true))std::abort();
    std::array<uint8_t,1024> actual{};FILE *file=std::fopen(observed_path,"rb");
    if(!file)std::abort();const size_t read=std::fread(actual.data(),1,actual.size(),file);
    const bool exact=read==size&&std::fgetc(file)==EOF&&!std::ferror(file);const bool closed=std::fclose(file)==0;
    NativeRegistrySnapshot after;DepartureQueues after_records{};
    const bool preserved=exact&&closed&&native_registry_snapshot(factory,after)&&before==after&&
       departure_queues(manager,agent,after_records)&&!after_records.omitted&&after_records==queue_records&&
       pair_queues(manager)==queues&&rd32(factory+0x28)==native_counter&&
       rd32(runtime+0x34)==counter+unsigned(!reuse)&&rd32(manager+0x34)==count+unsigned(!reuse)&&
       rd32(0x0071c68c)==world&&rd32(0x0071c6a8)==expected_clock&&rd32(state)==7&&!rd32(state+4)&&
       mods_hooks_installed_count()==hooks&&pure();
    if(!preserved||!heap_free(scratch))std::abort();
    const bool equal=!std::memcmp(bytes->data(),actual.data(),size);
    if(!equal){if(reuse)return 0;std::abort();}
    std::fprintf(stderr,"[streaming] Hero destination home mode=%s agent=%u bytes=%zu counter-before=%u counter-after=%u native-id=0 attributes=9 pure=1 original-valid=0 serialized-equal=1 registry-preserved=1 queues-preserved=1 clock=%u phase=7 scheduled=0 hero-imported=0 owner-published=0 result=pass\n",
       reuse?"reuse":"register",proposed_id,size,counter,rd32(runtime+0x34),expected_clock);
    return proposed_id;
}

// The original manager owns this unscheduled pure home; no native guild is
// invented. Only the actual paused destination may install the bound record.
extern "C" uint32_t majesty_browser_streaming_halo_session_proxy(X86 *c,const char *binding,uint32_t bytes_expected,uint32_t expected_clock) {
#ifdef __EMSCRIPTEN__
    return 0;
#else
    const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_HOME_PROXY"),*session=recomp_env("BROWSER_FRONTIER_HALO_SESSION"),
        *actor=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTOR"),*page=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTOR_PAGE"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");
    if(!flag||std::strcmp(flag,"v1")||!session||std::strcmp(session,"v1")||!actor||std::strcmp(actor,"v1")||
       !page||std::strcmp(page,"v1")||path.find("/actor-arrival-fixture-halo-world-session-")==path.npos||
       !path.ends_with("/native-world-halo/frontier_1_0")||!binding||std::strlen(binding)!=64||bytes_expected<56||bytes_expected>1024||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return 0;
    const char *epoch=recomp_env("BROWSER_FRONTIER_HALO_SESSION_DESTINATION_EPOCH");
    if((expected_clock!=0&&expected_clock!=50)||(epoch&&std::strcmp(epoch,"v1"))||bool(epoch)!=(expected_clock==50))return 0;
    const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c),hooks=mods_hooks_installed_count();
    if(!gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=expected_clock||!gm_valid(world,0x14))return 0;
    X86 extra=*c;extra.r[R_ESP]-=32768;const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))return 0;
    const uint32_t manager=rd32(runtime+4),counter=rd32(runtime+0x34),native_counter=rd32(factory+0x28);
    if(!gm_valid(manager,0x4c)||rd32(manager+0x48)||!counter||counter>=0x7ffffffeu)return 0;
    const uint32_t count=rd32(manager+0x34);const auto queues=pair_queues(manager);NativeRegistrySnapshot before;
    if(!native_registry_snapshot(factory,before))return 0;
    char proposal_path[1024],input_path[1024],observed_path[1024];
    if(!recomp_writable_path("Halo_Session_Home_Proposal.GPL",proposal_path,sizeof proposal_path)||
       !recomp_writable_path("Halo_Session_Home_Input.GPL",input_path,sizeof input_path)||
       !recomp_writable_path("Halo_Session_Home_Observed.GPL",observed_path,sizeof observed_path))return 0;
    OsStat st{};if(os_lstat(proposal_path,&st)||!st.is_regular||st.is_symlink||st.size!=bytes_expected||
       loader_hash_file_bounded(proposal_path,bytes_expected)!=binding)return 0;
    auto bytes=std::make_unique<PrimaryBytes>(),actual=std::make_unique<PrimaryBytes>();auto plan=std::make_unique<PairPlan>();
    size_t size=0,actual_size=0;if(!agent_bytes(proposal_path,*bytes,size)||size!=bytes_expected)return 0;
    const uint32_t proposal=pair_word(*bytes,size-24);
    if(!proposal||proposal>=0x7ffffffeu||!pair_agent_plan(*bytes,size,proposal,0,*plan)||plan->count||plan->values!=9||
       pair_word(*bytes,16)!=9||pair_word(*bytes,plan->identity-4)||plan->identity!=size-24||plan->native!=size-19)return 0;
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    if(lookup(counter))return 0;
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)return 0;
    const uint32_t agent=guest_call(&extra,0x0064c616u,0x34u);if(!gm_valid(agent,0x34))std::abort();
    extra.r[R_ECX]=agent;guest_call(&extra,0x00625e70u);
    const uint32_t id=rd32(agent+0x10);if(id!=counter||rd32(runtime+0x34)!=counter+1)std::abort();
    pair_put(*bytes,plan->identity,id);
    if(!pair_write(input_path,*bytes,size)||agent_file(extra,scratch,"Halo_Session_Home_Input.GPL",agent,false))std::abort();
    wr32(scratch+144,id);wr32(scratch+148,agent);extra.r[R_ECX]=manager+0x28;
    guest_call(&extra,0x00634460u,scratch+128,scratch+144);
    const bool pure=rd8(scratch+132)==1&&lookup(id)==agent&&rd32(agent+0x10)==id&&!rd32(agent+0x20)&&
        !rd32(agent+0x24)&&!rd8(agent+0x28)&&rd32(rd32(agent)+0xc)==9&&!rd32(agent+0xc);
    if(!pure)std::abort();extra.r[R_ECX]=agent;if(guest_call(&extra,0x00626310u))std::abort();
    extra.r[R_ECX]=scratch;guest_call(&extra,0x006254c0u,id);extra.r[R_ECX]=scratch;
    if(guest_call(&extra,0x00625580u)||agent_file(extra,scratch,"Halo_Session_Home_Observed.GPL",agent,true)||
       !agent_bytes(observed_path,*actual,actual_size)||actual_size!=size||std::memcmp(bytes->data(),actual->data(),size))std::abort();
    NativeRegistrySnapshot after;
    if(!native_registry_snapshot(factory,after)||before!=after||pair_queues(manager)!=queues||
       rd32(factory+0x28)!=native_counter||rd32(runtime+0x34)!=counter+1||rd32(manager+0x34)!=count+1||
       rd32(0x0071c68c)!=world||rd32(0x0071c6a8)!=expected_clock||rd32(state)!=7||rd32(state+4)||mods_hooks_installed_count()!=hooks||
       !heap_free(scratch))std::abort();
    std::fprintf(stderr,"[streaming] Halo session home proxy proposal=%u agent=%u bytes=%zu counter-before=%u counter-after=%u native-id=0 attributes=9 pure=1 original-valid=0 serialized-equal=1 registry-preserved=1 queues-preserved=1 clock=%u phase=7 scheduled=0 hero-imported=0 owner-published=0 result=pass\n",proposal,id,size,counter,counter+1,expected_clock);
    return id;
#endif
}

// Import the complete selected crossing family through original readers while
// the destination stays paused. IDs in the inert pack are proposals: original
// factories reserve each destination identity. Spatial/AI activation and the
// paired ownership commit are subsequent stages, never inferred from import.
extern "C" bool majesty_browser_streaming_halo_session_arrival(X86 *c,const char *binding,
    uint32_t bytes_expected,uint32_t source_hero,uint32_t source_agent,uint32_t source_clock,
    uint32_t proxy_id,uint32_t *aliases) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ARRIVAL"),*session=recomp_env("BROWSER_FRONTIER_HALO_SESSION"),
        *actor=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTOR"),*page=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTOR_PAGE"),
        *epoch=recomp_env("BROWSER_FRONTIER_HALO_SESSION_DESTINATION_EPOCH"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");
    if(!flag||std::strcmp(flag,"v1")||!session||std::strcmp(session,"v1")||!actor||std::strcmp(actor,"v1")||
       !page||std::strcmp(page,"v1")||!epoch||std::strcmp(epoch,"v1")||
       path.find("/actor-arrival-fixture-halo-world-session-")==path.npos||!path.ends_with("/native-world-halo/frontier_1_0")||
       !binding||std::strlen(binding)!=64||bytes_expected!=3786||!source_hero||!source_agent||!source_clock||!proxy_id||!aliases||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c),hooks=mods_hooks_installed_count();
    if(!gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||rd32(0x0071c6a8)!=50||!gm_valid(world,0x14))return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))return false;
    const uint32_t manager=rd32(runtime+4),reserved=rd32(runtime+0x34),native_counter=rd32(factory+0x28);
    if(!gm_valid(manager,0x4c)||rd32(manager+0x48)||!reserved||reserved>=0x7ffffffeu)return false;
    const uint32_t entries=rd32(manager+0x34);const auto queues=pair_queues(manager);const auto drawing=pair_rendering(factory);
    NativeRegistrySnapshot before;if(!drawing.valid||!native_registry_snapshot(factory,before))return false;
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t proxy=lookup(proxy_id);
    if(!gm_valid(proxy,0x34)||rd32(proxy+0x10)!=proxy_id||rd32(proxy+0x20)||rd32(proxy+0x24)||
       rd8(proxy+0x28)||rd32(rd32(proxy)+0xc)!=9||rd32(proxy+0xc)||lookup(reserved))return false;
    char pathbuf[1024],name[128];
    if(!recomp_writable_path("Halo_Session_Arrival.pack",pathbuf,sizeof pathbuf))return false;
    OsStat st{};if(os_lstat(pathbuf,&st)||!st.is_regular||st.is_symlink||st.size!=bytes_expected||
       loader_hash_file_bounded(pathbuf,bytes_expected)!=binding)return false;
    std::array<uint8_t,3786> pack{};FILE *file=std::fopen(pathbuf,"rb");if(!file)return false;
    const bool read=std::fread(pack.data(),1,pack.size(),file)==pack.size()&&std::fgetc(file)==EOF&&!std::ferror(file);
    const bool closed=std::fclose(file)==0;if(!read||!closed)return false;
    const uint32_t header[]={0x31415348,1,9,source_clock,50,source_hero,source_agent,proxy_id,100000,1000,3,3630};
    if(std::memcmp(pack.data(),header,sizeof header))return false;
    constexpr uint32_t sizes[]={442,165,151,151,1853,100,440,164,164},tags[]={0,0,0,0,1,2,3,3,3},
        descriptions[]={0x314c5641,0x32425241,0x31475241,0x33475241},flags[]={512,2592,544,544};
    std::array<std::unique_ptr<PrimaryBytes>,9> records;std::array<uint32_t,4> sources{};sources[0]=source_hero;
    size_t at=sizeof header;
    for(unsigned k=0;k<9;++k){uint32_t descriptor[3]{};
        if(at+12+sizes[k]>pack.size())return false;std::memcpy(descriptor,pack.data()+at,12);at+=12;
        if(descriptor[0]!=tags[k]||descriptor[2]!=sizes[k])return false;
        if(k>0&&k<4){if(!descriptor[1])return false;for(unsigned j=0;j<k;++j)if(sources[j]==descriptor[1])return false;sources[k]=descriptor[1];}
        else if(descriptor[1]!=(k<6?source_hero:sources[k-5]))return false;
        records[k]=std::make_unique<PrimaryBytes>();std::memcpy(records[k]->data(),pack.data()+at,sizes[k]);at+=sizes[k];
    }
    if(at!=pack.size())return false;
    size_t ea=0;auto script_plan=std::make_unique<PairPlan>();
    if(!pair_native_ea(*records[0],sizes[0],1000,ea)||
       !pair_agent_plan(*records[4],sizes[4],1000,100000,*script_plan))return false;
    for(size_t j=0;j<script_plan->count;++j)
        if(script_plan->references[j].before!=1000&&script_plan->references[j].before!=proxy_id)return false;
    for(unsigned k=0;k<4;++k){const auto &b=*records[k];
        if(pair_word(b,36)!=100000+k||pair_word(b,40)!=flags[k]||pair_word(b,48)!=descriptions[k]||
           pair_word(b,52)||pair_word(b,56)!=(k?100000u:0u)||pair_word(b,72)!=4||pair_word(b,76)!=8)return false;
    }
    for(unsigned k=0;k<3;++k)if(pair_word(*records[k+6],0)!=100001+k)return false;
    auto &container=*records[5];
    if(pair_word(container,0)!=100000||std::memcmp(container.data()+4,"CONT",4)||
       std::memcmp(container.data()+20,"PRIM",4))return false;
    // Full original CONT framing occupies36 bytes. The remaining64 bytes have
    // an empty remote-home group and all three physical children, in order.
    constexpr uint32_t expected_container[]={1,2,1,0,101,100000,1,3,1,100000,100001,1,100002,1,100003,1};
    if(std::memcmp(container.data()+36,expected_container,sizeof expected_container))return false;
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)return false;
    auto write=[&](const char *n,const PrimaryBytes &b,size_t bytes){return recomp_writable_path(n,pathbuf,sizeof pathbuf)&&pair_write(pathbuf,b,bytes);};
    auto load=[&](const char *n,PrimaryBytes &b,size_t bytes){size_t found=0;return recomp_writable_path(n,pathbuf,sizeof pathbuf)&&arrival_bytes(pathbuf,b,found)&&found==bytes;};
    const uint32_t agent=guest_call(&extra,0x0064c616u,0x34u);if(!gm_valid(agent,0x34))std::abort();
    extra.r[R_ECX]=agent;guest_call(&extra,0x00625e70u);
    if(rd32(agent+0x10)!=reserved||rd32(runtime+0x34)!=reserved+1)std::abort();
    std::array<uint32_t,4> units{},ids{},counts{};std::array<std::array<uint32_t,32>,4> addresses{};
    for(unsigned k=0;k<4;++k){auto &b=*records[k];pair_put(b,36,0);if(k)pair_put(b,56,ids[0]);else pair_put(b,ea,reserved);
        std::snprintf(name,sizeof name,"Halo_Session_Arrival_Input_%u.UNIT",sources[k]);if(!write(name,b,sizes[k]))std::abort();
        majesty::actors::UnitStage stage;const majesty::actors::StageInput input{flags[k],k?ids[0]:0,descriptions[k],0};
        uint32_t status=UINT32_MAX;const bool installed=stage.install();
        units[k]=installed?primary_file(extra,scratch,name,factory,0,false,&status,true,&stage,&input):0;
        if(!stage.remove())std::abort();
        std::fprintf(stderr,"[streaming] Halo session arrival stage source=%u status=%08x complete=%u failure=%u\n",sources[k],status,unsigned(installed&&units[k]&&!status),unsigned(stage.failure()));
        if(!installed||status||!units[k]||(k&&!restore_private_family_orders(extra,units[k],records[k+5]->data()+36,sizes[k+5]-36,addresses[k],counts[k]))||
           !publish_native_identity(extra,factory,units[k],ids[k]))std::abort();
        pair_put(b,36,ids[k]);
    }
    auto &script=*records[4];pair_put(script,script_plan->identity,reserved);pair_put(script,script_plan->native,ids[0]);
    for(size_t j=0;j<script_plan->count;++j)if(script_plan->references[j].before==1000)pair_put(script,script_plan->references[j].offset,reserved);
    if(!write("Halo_Session_Arrival_Agent_Input.GPL",script,sizes[4])||agent_file(extra,scratch,"Halo_Session_Arrival_Agent_Input.GPL",agent,false))std::abort();
    wr32(scratch+144,reserved);wr32(scratch+148,agent);extra.r[R_ECX]=manager+0x28;guest_call(&extra,0x00634460u,scratch+128,scratch+144);
    if(rd8(scratch+132)!=1||lookup(reserved)!=agent||rd32(manager+0x34)!=entries+1)std::abort();
    extra.r[R_ECX]=agent;if(guest_call(&extra,0x00626310u)!=units[0])std::abort();
    std::memmove(container.data(),container.data()+36,64);pair_put(container,20,ids[0]);pair_put(container,36,ids[0]);
    for(unsigned k=1;k<4;++k)pair_put(container,32+k*8,ids[k]);
    if(!write("Halo_Session_Arrival_Container_Input.bin",container,64)||
       arrival_container_file(extra,scratch,"Halo_Session_Arrival_Container_Input.bin",factory,units[0],false))std::abort();
    for(unsigned k=1;k<4;++k)if(!arrival_contains(units[0],1,units[k]))std::abort();
    // Resolve the compact original model indices once, before original writing.
    // Spatial publication and scheduling are deliberately deferred.
    for(uint32_t unit:units){const uint32_t helper=rd32(unit+0x18);
        if(!gm_valid(helper,0x20)||rd32(helper)!=0x0068b4d4||rd32(rd32(helper)+4)!=0x005b54d0)std::abort();
        extra.r[R_ECX]=helper;if(!(guest_call(&extra,0x005b54d0u)&255))std::abort();}
    auto observed=std::make_unique<PrimaryBytes>();
    for(unsigned k=0;k<4;++k){std::snprintf(name,sizeof name,"Halo_Session_Arrival_Observed_%u.UNIT",sources[k]);
        if(!primary_file(extra,scratch,name,factory,units[k],true,nullptr,true)||!load(name,*observed,sizes[k])||
           std::memcmp(records[k]->data(),observed->data(),sizes[k]))std::abort();
        if(k){std::snprintf(name,sizeof name,"Halo_Session_Arrival_Observed_%u_Orders.bin",sources[k]);
            if(!live_banks_equal(extra,units[k],records[k+5]->data()+36,sizes[k+5]-36,name))std::abort();}}
    if(agent_file(extra,scratch,"Halo_Session_Arrival_Agent_Observed.GPL",agent,true)||
       !load("Halo_Session_Arrival_Agent_Observed.GPL",*observed,sizes[4])||std::memcmp(script.data(),observed->data(),sizes[4])||
       arrival_container_file(extra,scratch,"Halo_Session_Arrival_Container_Observed.bin",factory,units[0],true)||
       !load("Halo_Session_Arrival_Container_Observed.bin",*observed,64)||std::memcmp(container.data(),observed->data(),64))std::abort();
    NativeRegistrySnapshot after;
    if(!native_registry_snapshot(factory,after,0,units.data(),4)||after!=before||pair_queues(manager)!=queues||pair_rendering(factory)!=drawing||
       lookup(proxy_id)!=proxy||rd32(factory+0x28)!=native_counter+4||rd32(runtime+0x34)!=reserved+1||
       rd32(manager+0x34)!=entries+1||rd32(0x0071c68c)!=world||rd32(0x0071c6a8)!=50||rd32(phase)!=7||rd32(phase+4)||
       mods_hooks_installed_count()!=hooks||!heap_free(scratch))std::abort();
    for(unsigned k=0;k<4;++k)aliases[k]=ids[k];aliases[4]=reserved;
    std::fprintf(stderr,"[streaming] Halo session arrival imported source=%u/%u hero=%u agent=%u effects=%u,%u,%u proxy=%u clock=50 records=9 exact=1 other-registry-preserved=1 queues-preserved=1 drawing-preserved=1 original-model-postload=4 scheduled=0 activation=0 owner-published=0 result=pass\n",
        source_hero,source_agent,ids[0],reserved,ids[1],ids[2],ids[3],proxy_id);
    return true;
#endif
}

// Original destination readers shared by native and WASM. Caller admission
// binds this inert package to the selected source and loaded paused target.
// Four-record outdoor hero contract: attached families require their full
// separately qualified importer, and are refused rather than discarded.
extern "C" bool majesty_browser_streaming_import_hero_arrival(X86 *c,const char *binding,uint32_t bytes_expected,
    uint32_t source_hero,uint32_t source_agent,uint32_t source_clock,uint32_t destination_clock,uint32_t proxy_id,uint32_t *aliases) {
    if(!c||!binding||std::strlen(binding)!=64||bytes_expected<96||bytes_expected>256*1024||
       !source_hero||!source_agent||!source_clock||!proxy_id||!aliases||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    for(unsigned i=0;i<64;++i)if(!((binding[i]>='0'&&binding[i]<='9')||(binding[i]>='a'&&binding[i]<='f')))return false;
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c),hooks=mods_hooks_installed_count();
    if(!gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||rd32(0x0071c6a8)!=destination_clock||!gm_valid(world,0x14)||!gm_valid(rd32(0x006d8568),0x21c)||rd32(rd32(0x006d8568)+0x218)==2)return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if(!(gm_valid(factory,0x8c)&&gm_valid(runtime,0x38)))return false;
    const uint32_t manager=rd32(runtime+4),reserved=rd32(runtime+0x34),counter=rd32(factory+0x28);
    if(!(gm_valid(manager,0x4c)&&!rd32(manager+0x48)&&reserved&&reserved<0x7ffffffeu))return false;
    const uint32_t entries=rd32(manager+0x34);const auto queues=pair_queues(manager);const auto drawing=pair_rendering(factory);DepartureQueues before_queues{};
    NativeRegistrySnapshot before;if(!(drawing.valid&&native_registry_snapshot(factory,before)))return false;
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t proxy=lookup(proxy_id);
    if(!(gm_valid(proxy,0x34)&&rd32(proxy+0x10)==proxy_id&&!lookup(reserved)&&departure_queues(manager,proxy,before_queues)))return false;
    const uint32_t home_id=rd32(proxy+0x20);uint32_t home=0;
    if(home_id){
        extra.r[R_ECX]=factory;home=guest_call(&extra,0x005a10d0u,home_id);
        extra.r[R_ECX]=proxy;const uint32_t linked=guest_call(&extra,0x00626310u);
        if(!(gm_valid(home,0x98)&&linked==home&&rd32(home+0x60)==home_id&&rd32(home+0x6c)==0x31564241&&
            !rd32(home+0x70)&&!(rd32(home+0x64)&4)))return false;
    }else if(!(!rd32(proxy+0x24)&&!rd8(proxy+0x28)&&gm_valid(rd32(proxy),0x10)&&
        rd32(rd32(proxy)+0xc)==9&&!rd32(proxy+0xc)&&!before_queues.omitted))return false;
    char pathbuf[1024];if(!(recomp_writable_path("Frontier_Hero_Arrival.pack",pathbuf,sizeof pathbuf)))return false;
    OsStat st{};if(!(!os_lstat(pathbuf,&st)&&st.is_regular&&!st.is_symlink&&st.size==bytes_expected&&loader_hash_file_bounded(pathbuf,bytes_expected)==binding))return false;
    std::vector<uint8_t> pack(bytes_expected);FILE *file=std::fopen(pathbuf,"rb");if(!(file!=nullptr))return false;
    const bool read=std::fread(pack.data(),1,pack.size(),file)==pack.size()&&std::fgetc(file)==EOF&&!std::ferror(file),closed=std::fclose(file)==0;
    if(!(read&&closed))return false;const uint32_t header[]={0x3141484d,1,4,source_clock,destination_clock,source_hero,source_agent,proxy_id,100000,1000,0,bytes_expected-96};
    if(!(!std::memcmp(pack.data(),header,sizeof header)))return false;
    std::array<uint32_t,4> sizes{};std::array<std::unique_ptr<PrimaryBytes>,4> records;size_t at=sizeof header;
    for(unsigned k=0;k<4;++k){if(!(at+12<=pack.size()))return false;uint32_t row[3]{};std::memcpy(row,pack.data()+at,12);at+=12;
        if(!(row[0]==k&&row[1]==source_hero&&row[2]>=56&&row[2]<=65536&&at+row[2]<=pack.size()))return false;sizes[k]=row[2];
        records[k]=std::make_unique<PrimaryBytes>();std::memcpy(records[k]->data(),pack.data()+at,sizes[k]);at+=sizes[k];}
    if(!(at==pack.size()&&sizes[0]>=80&&sizes[2]==(home?84u:76u)&&sizes[3]>=36))return false;
    auto &hero=*records[0],&script=*records[1],&container=*records[2],&order=*records[3];size_t ea=0;PairPlan plan;majesty::orders::PayloadPlan banks;
    if(!(pair_word(hero,36)==100000&&pair_word(hero,40)==512&&pair_word(hero,48)==0x314c5641&&!pair_word(hero,52)&&!pair_word(hero,56)&&
        pair_word(hero,72)>=2&&pair_word(hero,72)<254&&pair_word(hero,76)>=2&&pair_word(hero,76)<254&&
        pair_native_ea(hero,sizes[0],1000,ea)&&pair_agent_plan(script,sizes[1],1000,100000,plan)))return false;
    for(size_t j=0;j<plan.count;++j)if(!(plan.references[j].before==1000||plan.references[j].before==proxy_id))return false;
    if(!(pair_word(order,0)==100000&&!std::memcmp(order.data()+4,"ORDR",4)&&!std::memcmp(order.data()+20,"PRIM",4)&&
        majesty::orders::plan_order_payload(order.data()+36,sizes[3]-36,banks)))return false;
    const bool moving=banks.entry_count==3&&banks.bank_counts==std::array<uint32_t,3>{2,1,0}&&
        banks.entries[0].kind==2&&banks.entries[1].kind==4&&banks.entries[2].kind==7;
    const bool path_only=banks.entry_count==2&&banks.bank_counts==std::array<uint32_t,3>{1,1,0}&&
        banks.entries[0].kind==4&&banks.entries[1].kind==7;
    // A remote crossing may occur before the original Move leaf completes.
    // Preserve that leaf through the same original bank reader used on return
    // to a native home; do not drop it or invent a replacement command.
    if(home?!moving:!(moving||path_only))return false;
    constexpr uint32_t body[]={1,2,1,0,101,100000,1,0,1,100000};
    const uint32_t home_body[]={1,2,1,1,101,100000,home_id,1,1,0,1,100000};
    if(!(pair_word(container,0)==100000&&!std::memcmp(container.data()+4,"CONT",4)&&!std::memcmp(container.data()+20,"PRIM",4)&&
        !std::memcmp(container.data()+36,home?home_body:body,home?sizeof home_body:sizeof body)))return false;
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)return false;
    auto require=[](bool ok,const char *where){if(!ok){std::fprintf(stderr,"[streaming] Hero arrival invariant failed boundary=%s\n",where);std::abort();}};
    auto write=[&](const char *name,const PrimaryBytes &bytes,size_t n){return recomp_writable_path(name,pathbuf,sizeof pathbuf)&&pair_write(pathbuf,bytes,n);};
    auto load=[&](const char *name,PrimaryBytes &bytes,size_t n){size_t found=0;return recomp_writable_path(name,pathbuf,sizeof pathbuf)&&arrival_bytes(pathbuf,bytes,found)&&found==n;};
    const uint32_t members=home?departure_list(extra,scratch,proxy,"members"):0;
    const auto roster=home?departure_list_state(members,reserved):DepartureList{};
    if(home&&(!roster.valid||roster.matches)){require(heap_free(scratch),"refused-roster-release");return false;}
    require(agent_file(extra,scratch,"Hero_Arrival_Home_Before.GPL",proxy,true)==0,"home-before");
    const uint32_t agent=guest_call(&extra,0x0064c616u,0x34u);require(gm_valid(agent,0x34),"agent-allocation");
    extra.r[R_ECX]=agent;guest_call(&extra,0x00625e70u);require(rd32(agent+0x10)==reserved&&rd32(runtime+0x34)==reserved+1,"agent-reservation");
    pair_put(hero,36,0);pair_put(hero,ea,reserved);require(write("Hero_Arrival_Arrival_Unit_Input.UNIT",hero,sizes[0]),"unit-input");
    majesty::actors::UnitStage stage;const majesty::actors::StageInput input{512,0,0x314c5641,0};uint32_t status=UINT32_MAX,id=0;
    const bool installed=stage.install();const uint32_t unit=installed?primary_file(extra,scratch,"Hero_Arrival_Arrival_Unit_Input.UNIT",factory,0,false,&status,true,&stage,&input):0;
    require(stage.remove(),"stage-remove");std::fprintf(stderr,"[streaming] Hero destination arrival stage status=%08x complete=%u failure=%u\n",status,unsigned(installed&&unit&&!status),unsigned(stage.failure()));
    std::array<uint32_t,32> addresses{};uint32_t count=0;
    require(installed&&!status&&unit&&restore_private_family_orders(extra,unit,order.data()+36,sizes[3]-36,addresses,count)&&publish_native_identity(extra,factory,unit,id),"original-readers");
    pair_put(hero,36,id);pair_put(order,0,id);pair_put(script,plan.identity,reserved);pair_put(script,plan.native,id);
    for(size_t j=0;j<plan.count;++j)if(plan.references[j].before==1000)pair_put(script,plan.references[j].offset,reserved);
    require(write("Hero_Arrival_Arrival_Agent_Input.GPL",script,sizes[1])&&agent_file(extra,scratch,"Hero_Arrival_Arrival_Agent_Input.GPL",agent,false)==0,"script-reader");
    wr32(scratch+144,reserved);wr32(scratch+148,agent);extra.r[R_ECX]=manager+0x28;guest_call(&extra,0x00634460u,scratch+128,scratch+144);
    require(rd8(scratch+132)==1&&lookup(reserved)==agent&&rd32(manager+0x34)==entries+1,"script-registration");
    extra.r[R_ECX]=agent;require(guest_call(&extra,0x00626310u)==unit,"native-backlink");
    const size_t container_bytes=home?48:40;
    std::memmove(container.data(),container.data()+36,container_bytes);pair_put(container,20,id);pair_put(container,home?44:36,id);
    require(write("Hero_Arrival_Arrival_Container_Input.bin",container,container_bytes)&&arrival_container_file(extra,scratch,"Hero_Arrival_Arrival_Container_Input.bin",factory,unit,false)==0,"container-reader");
    if(home){
        require(arrival_contains(unit,101,home)&&!arrival_contains(home,100,unit),"home-parent");
        extra.r[R_ECX]=home+0x94;
        require((guest_call(&extra,0x00598e20u,unit,home,100u)&255)&&arrival_contains(home,100,unit),"native-roster");
        extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t operand=guest_call(&extra,0x0062a810u,5u);
        require(operand!=0,"roster-operand");extra.r[R_ECX]=operand;guest_call(&extra,0x006254c0u,reserved);
        std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);
        extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,4u);
        const auto added_members=departure_list_state(members,reserved);HomeTaskView view;
        require(added_members.valid&&added_members.count==roster.count+1&&added_members.matches==1&&
            added_members.other_hash==roster.other_hash&&home_task_view(agent,view,reserved,id,proxy_id)&&
            rd32(view.home+8)==proxy_id&&rd32(view.target+8)==proxy_id&&home_text(view.task+8,"go_home")&&
            (!std::strcmp(view.function,"travel_to")||!std::strcmp(view.function,"use_building")),"script-roster");
        extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);
    }
    const uint32_t helper=rd32(unit+0x18);require(gm_valid(helper,0x20)&&rd32(helper)==0x0068b4d4&&rd32(rd32(helper)+4)==0x005b54d0,"model");
    extra.r[R_ECX]=helper;require((guest_call(&extra,0x005b54d0u)&255)!=0,"model-resolve");
    auto observed=std::make_unique<PrimaryBytes>();
    require(primary_file(extra,scratch,"Hero_Arrival_Arrival_Unit_Observed.UNIT",factory,unit,true,nullptr,true)&&
        load("Hero_Arrival_Arrival_Unit_Observed.UNIT",*observed,sizes[0])&&!std::memcmp(hero.data(),observed->data(),sizes[0]),"unit-exact");
    require(agent_file(extra,scratch,"Hero_Arrival_Arrival_Agent_Observed.GPL",agent,true)==0&&load("Hero_Arrival_Arrival_Agent_Observed.GPL",*observed,sizes[1])&&
        !std::memcmp(script.data(),observed->data(),sizes[1])&&live_banks_equal(extra,unit,order.data()+36,sizes[3]-36,"Hero_Arrival_Arrival_Orders_Observed.bin"),"script-orders-exact");
    require(arrival_container_file(extra,scratch,"Hero_Arrival_Arrival_Container_Observed.bin",factory,unit,true)==0&&
        load("Hero_Arrival_Arrival_Container_Observed.bin",*observed,container_bytes)&&!std::memcmp(container.data(),observed->data(),container_bytes)&&
        agent_file(extra,scratch,"Hero_Arrival_Home_Observed.GPL",proxy,true)==0,"container-home-exact");
    NativeRegistrySnapshot after;DepartureQueues after_queues{};const std::array<uint32_t,1> added={unit};
    require(native_registry_snapshot(factory,after,0,added.data(),1)&&after==before&&departure_queues(manager,proxy,after_queues)&&after_queues==before_queues&&pair_queues(manager)==queues&&pair_rendering(factory)==drawing&&
        lookup(proxy_id)==proxy&&rd32(factory+0x28)==counter+1&&rd32(runtime+0x34)==reserved+1&&rd32(manager+0x34)==entries+1&&
        rd32(0x0071c68c)==world&&rd32(0x0071c6a8)==destination_clock&&rd32(phase)==7&&!rd32(phase+4)&&mods_hooks_installed_count()==hooks&&heap_free(scratch),"preserved-world");
    aliases[0]=id;aliases[1]=aliases[2]=aliases[3]=0;aliases[4]=reserved;
    if(home){
        std::fprintf(stderr,"[streaming] Hero native home arrival imported source=%u/%u hero=%u agent=%u home=%u/%u clock=%u records=4 commands=3 exact=1 native-roster=1 script-roster=1 registry-preserved=1 queues-preserved=1 drawing-preserved=1 original-readers=1 scheduled=0 activation=0 owner-published=0 result=pass\n",
            source_hero,source_agent,id,reserved,home_id,proxy_id,destination_clock);return true;
    }
    std::fprintf(stderr,"[streaming] Hero destination arrival imported source=%u/%u hero=%u agent=%u proxy=%u clock=%u records=4 commands=%u exact=1 registry-preserved=1 queues-preserved=1 drawing-preserved=1 original-readers=1 scheduled=0 activation=0 owner-published=0 result=pass\n",source_hero,source_agent,id,reserved,proxy_id,destination_clock,banks.entry_count);
    return true;
}


extern "C" bool majesty_browser_streaming_halo_saved_arrival(X86 *c,const char *binding,uint32_t bytes_expected,
    uint32_t source_hero,uint32_t source_agent,uint32_t source_clock,uint32_t destination_clock,uint32_t proxy_id,uint32_t *aliases) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_ARRIVAL"),*saved=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_DESTINATION"),
        *actor=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTOR"),*page=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTOR_PAGE"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");
    if(!flag||std::strcmp(flag,"v1")||!saved||std::strcmp(saved,"v1")||!actor||std::strcmp(actor,"v1")||!page||std::strcmp(page,"v1")||
       path.find("/actor-arrival-fixture-halo-world-session-")==path.npos||!path.ends_with("/native-world-halo/frontier_1_0")||
       !binding||std::strlen(binding)!=64||bytes_expected!=2856||!source_hero||!source_agent||!source_clock||destination_clock!=3750||proxy_id!=34||!aliases||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c),hooks=mods_hooks_installed_count();
    if(!gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||rd32(0x0071c6a8)!=destination_clock||!gm_valid(world,0x14))return false;
    auto require=[](bool ok,const char *where){if(!ok){std::fprintf(stderr,"[streaming] Halo saved arrival refused boundary=%s\n",where);std::abort();}};
    X86 extra=*c;extra.r[R_ESP]-=32768;const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    require(gm_valid(factory,0x8c)&&gm_valid(runtime,0x38),"runtime");
    const uint32_t manager=rd32(runtime+4),reserved=rd32(runtime+0x34),counter=rd32(factory+0x28);
    require(gm_valid(manager,0x4c)&&!rd32(manager+0x48)&&reserved&&reserved<0x7ffffffeu,"manager");
    const uint32_t entries=rd32(manager+0x34);const auto queues=pair_queues(manager);const auto drawing=pair_rendering(factory);
    NativeRegistrySnapshot before;require(drawing.valid&&native_registry_snapshot(factory,before),"registry");
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    const uint32_t proxy=lookup(proxy_id);
    require(gm_valid(proxy,0x34)&&rd32(proxy+0x10)==proxy_id&&!rd32(proxy+0x20)&&!rd32(proxy+0x24)&&!rd8(proxy+0x28)&&
        rd32(rd32(proxy)+0xc)==9&&!rd32(proxy+0xc)&&!lookup(reserved),"existing-home");
    char pathbuf[1024];require(recomp_writable_path("Halo_Session_Saved_Arrival.pack",pathbuf,sizeof pathbuf),"pack-path");
    OsStat st{};require(!os_lstat(pathbuf,&st)&&st.is_regular&&!st.is_symlink&&st.size==2856&&loader_hash_file_bounded(pathbuf,2856)==binding,"binding");
    std::array<uint8_t,2856> pack{};FILE *file=std::fopen(pathbuf,"rb");require(file!=nullptr,"open");
    const bool read=std::fread(pack.data(),1,pack.size(),file)==pack.size()&&std::fgetc(file)==EOF&&!std::ferror(file),closed=std::fclose(file)==0;
    require(read&&closed,"read");const uint32_t header[]={0x31534948,1,4,source_clock,destination_clock,source_hero,source_agent,proxy_id,100000,1000,0,2760};
    require(!std::memcmp(pack.data(),header,sizeof header),"header");
    constexpr uint32_t sizes[]={442,1850,76,392};std::array<std::unique_ptr<PrimaryBytes>,4> records;size_t at=sizeof header;
    for(unsigned k=0;k<4;++k){uint32_t row[3]{};std::memcpy(row,pack.data()+at,12);at+=12;
        require(row[0]==k&&row[1]==source_hero&&row[2]==sizes[k]&&at+sizes[k]<=pack.size(),"descriptor");
        records[k]=std::make_unique<PrimaryBytes>();std::memcpy(records[k]->data(),pack.data()+at,sizes[k]);at+=sizes[k];}
    require(at==pack.size(),"pack-end");
    auto &hero=*records[0],&script=*records[1],&container=*records[2],&order=*records[3];size_t ea=0;PairPlan plan;majesty::orders::PayloadPlan banks;
    require(pair_word(hero,36)==100000&&pair_word(hero,40)==512&&pair_word(hero,48)==0x314c5641&&!pair_word(hero,52)&&!pair_word(hero,56)&&
        pair_word(hero,72)>=2&&pair_word(hero,72)<254&&pair_word(hero,76)>=2&&pair_word(hero,76)<254&&
        pair_native_ea(hero,sizes[0],1000,ea)&&pair_agent_plan(script,sizes[1],1000,100000,plan),"actor");
    for(size_t j=0;j<plan.count;++j)require(plan.references[j].before==1000||plan.references[j].before==proxy_id,"script-references");
    require(pair_word(order,0)==100000&&!std::memcmp(order.data()+4,"ORDR",4)&&!std::memcmp(order.data()+20,"PRIM",4)&&
        majesty::orders::plan_order_payload(order.data()+36,356,banks)&&banks.entry_count==2&&banks.bank_counts==std::array<uint32_t,3>{1,1,0}&&
        banks.entries[0].kind==4&&banks.entries[1].kind==7,"orders");
    constexpr uint32_t body[]={1,2,1,0,101,100000,1,0,1,100000};
    require(pair_word(container,0)==100000&&!std::memcmp(container.data()+4,"CONT",4)&&!std::memcmp(container.data()+20,"PRIM",4)&&
        !std::memcmp(container.data()+36,body,sizeof body),"container");
    const uint32_t scratch=heap_alloc(512,true);require(scratch!=0,"scratch");
    auto write=[&](const char *name,const PrimaryBytes &bytes,size_t n){return recomp_writable_path(name,pathbuf,sizeof pathbuf)&&pair_write(pathbuf,bytes,n);};
    auto load=[&](const char *name,PrimaryBytes &bytes,size_t n){size_t found=0;return recomp_writable_path(name,pathbuf,sizeof pathbuf)&&arrival_bytes(pathbuf,bytes,found)&&found==n;};
    require(agent_file(extra,scratch,"Halo_Saved_Home_Before.GPL",proxy,true)==0,"home-before");
    const uint32_t agent=guest_call(&extra,0x0064c616u,0x34u);require(gm_valid(agent,0x34),"agent-allocation");
    extra.r[R_ECX]=agent;guest_call(&extra,0x00625e70u);require(rd32(agent+0x10)==reserved&&rd32(runtime+0x34)==reserved+1,"agent-reservation");
    pair_put(hero,36,0);pair_put(hero,ea,reserved);require(write("Halo_Saved_Arrival_Unit_Input.UNIT",hero,sizes[0]),"unit-input");
    majesty::actors::UnitStage stage;const majesty::actors::StageInput input{512,0,0x314c5641,0};uint32_t status=UINT32_MAX,id=0;
    const bool installed=stage.install();const uint32_t unit=installed?primary_file(extra,scratch,"Halo_Saved_Arrival_Unit_Input.UNIT",factory,0,false,&status,true,&stage,&input):0;
    require(stage.remove(),"stage-remove");std::fprintf(stderr,"[streaming] Halo saved arrival stage status=%08x complete=%u failure=%u\n",status,unsigned(installed&&unit&&!status),unsigned(stage.failure()));
    std::array<uint32_t,32> addresses{};uint32_t count=0;
    require(installed&&!status&&unit&&restore_private_family_orders(extra,unit,order.data()+36,356,addresses,count)&&publish_native_identity(extra,factory,unit,id),"original-readers");
    pair_put(hero,36,id);pair_put(order,0,id);pair_put(script,plan.identity,reserved);pair_put(script,plan.native,id);
    for(size_t j=0;j<plan.count;++j)if(plan.references[j].before==1000)pair_put(script,plan.references[j].offset,reserved);
    require(write("Halo_Saved_Arrival_Agent_Input.GPL",script,sizes[1])&&agent_file(extra,scratch,"Halo_Saved_Arrival_Agent_Input.GPL",agent,false)==0,"script-reader");
    wr32(scratch+144,reserved);wr32(scratch+148,agent);extra.r[R_ECX]=manager+0x28;guest_call(&extra,0x00634460u,scratch+128,scratch+144);
    require(rd8(scratch+132)==1&&lookup(reserved)==agent&&rd32(manager+0x34)==entries+1,"script-registration");
    extra.r[R_ECX]=agent;require(guest_call(&extra,0x00626310u)==unit,"native-backlink");
    std::memmove(container.data(),container.data()+36,40);pair_put(container,20,id);pair_put(container,36,id);
    require(write("Halo_Saved_Arrival_Container_Input.bin",container,40)&&arrival_container_file(extra,scratch,"Halo_Saved_Arrival_Container_Input.bin",factory,unit,false)==0,"container-reader");
    const uint32_t helper=rd32(unit+0x18);require(gm_valid(helper,0x20)&&rd32(helper)==0x0068b4d4&&rd32(rd32(helper)+4)==0x005b54d0,"model");
    extra.r[R_ECX]=helper;require((guest_call(&extra,0x005b54d0u)&255)!=0,"model-resolve");
    auto observed=std::make_unique<PrimaryBytes>();
    require(primary_file(extra,scratch,"Halo_Saved_Arrival_Unit_Observed.UNIT",factory,unit,true,nullptr,true)&&
        load("Halo_Saved_Arrival_Unit_Observed.UNIT",*observed,sizes[0])&&!std::memcmp(hero.data(),observed->data(),sizes[0]),"unit-exact");
    require(agent_file(extra,scratch,"Halo_Saved_Arrival_Agent_Observed.GPL",agent,true)==0&&load("Halo_Saved_Arrival_Agent_Observed.GPL",*observed,sizes[1])&&
        !std::memcmp(script.data(),observed->data(),sizes[1])&&live_banks_equal(extra,unit,order.data()+36,356,"Halo_Saved_Arrival_Orders_Observed.bin"),"script-orders-exact");
    require(arrival_container_file(extra,scratch,"Halo_Saved_Arrival_Container_Observed.bin",factory,unit,true)==0&&
        load("Halo_Saved_Arrival_Container_Observed.bin",*observed,40)&&!std::memcmp(container.data(),observed->data(),40)&&
        agent_file(extra,scratch,"Halo_Saved_Home_Observed.GPL",proxy,true)==0,"container-home-exact");
    NativeRegistrySnapshot after;const std::array<uint32_t,1> added={unit};
    require(native_registry_snapshot(factory,after,0,added.data(),1)&&after==before&&pair_queues(manager)==queues&&pair_rendering(factory)==drawing&&
        lookup(proxy_id)==proxy&&rd32(factory+0x28)==counter+1&&rd32(runtime+0x34)==reserved+1&&rd32(manager+0x34)==entries+1&&
        rd32(0x0071c68c)==world&&rd32(0x0071c6a8)==destination_clock&&rd32(phase)==7&&!rd32(phase+4)&&mods_hooks_installed_count()==hooks&&heap_free(scratch),"preserved-world");
    aliases[0]=id;aliases[1]=aliases[2]=aliases[3]=0;aliases[4]=reserved;
    std::fprintf(stderr,"[streaming] Halo saved arrival imported source=%u/%u hero=%u agent=%u proxy=%u clock=%u records=4 commands=2 exact=1 registry-preserved=1 queues-preserved=1 drawing-preserved=1 original-readers=1 scheduled=0 activation=0 owner-published=0 result=pass\n",source_hero,source_agent,id,reserved,proxy_id,destination_clock);
    return true;
#endif
}

namespace {
// The import reader already completed the original model resolver. Finish the
// remaining original +1b4 stages without interpreting its resolved pointers as
// saved one-based indices again. This cache applies to exactly one guarded
// +1b4 call and its already-successful helper; every other call proceeds.
struct HaloCompletedModel {
    X86 &cpu;uint32_t unit,helper,handle=0,calls=0;uint64_t cookie=0;
    static void callback(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *context){
        auto &s=*static_cast<HaloCompletedModel *>(context);
        if(!s.cookie||guest_call_guarded_cookie(&s.cpu)!=s.cookie||cpu->ecx!=s.helper){
            if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();return;}
        if(s.calls||rd32(cpu->esp)!=0x005a23feu||rd32(s.helper+0x10)!=s.unit||
           !gm_valid(rd32(s.unit+0x80),0x18)||mods_hook_return(api,cpu,1,0)!=POP_OK)std::abort();
        ++s.calls;
    }
};
struct HaloSessionActivation {
    uint32_t stage=0,world=0,factory=0,runtime=0,manager=0,agent=0,proxy=0,agent_id=0,proxy_id=0;
    uint32_t hooks_before=0,agent_hook=0,context_hook=0,command_hook=0,last_clock=50,remote_clock=0;
    uint32_t ai=0,held_ai=0,contexts=0,other_ai=0,samples=0;
    uint64_t held_fingerprint=0;
    std::array<uint32_t,4> ids{},units{},commands{},retired{};
    bool remote=false,held=false;
} halo_session_activation;
static bool halo_activation_home(HomeTaskView &v){const auto &s=halo_session_activation;
    return rd32(0x0071c68c)==s.world&&home_task_view(s.agent,v,s.agent_id,s.ids[0],s.proxy_id)&&v.going_home&&
        !rd32(s.proxy+0x20)&&!rd32(s.proxy+0x24)&&!rd8(s.proxy+0x28);}
static void halo_activation_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *){
    auto &s=halo_session_activation;const bool owned=s.stage==1&&cpu->ecx==s.agent;
    if(owned&&s.remote){HomeTaskView v;
        if(!halo_activation_home(v)||(s.held&&v.fingerprint!=s.held_fingerprint)||rd32(0x00720304u)||
           ++s.held_ai>4096||mods_hook_return(api,cpu,0,8)!=POP_OK)std::abort();
        return;}
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.stage==1){auto &count=owned?s.ai:s.other_ai;if(++count>65536)std::abort();}
}
static void halo_activation_context(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *){
    auto &s=halo_session_activation;const bool owned=s.stage==1&&rd32(0x00720304u)==s.agent;
    if(owned&&gm_valid(cpu->ecx,24)&&home_text(cpu->ecx,"use_building")){HomeTaskView v;
        if(!halo_activation_home(v)||s.remote)std::abort();s.remote=true;s.remote_clock=rd32(0x0071c6a8);
        if(mods_hook_return(api,cpu,0,4)!=POP_OK)std::abort();++s.contexts;
        std::fprintf(stderr,"[streaming] Halo session remote home hero=%u agent=%u proxy=%u clock=%u original-dispatch=1 before-building-guard=1 task-preserved=1 owner-published=0 result=pass\n",s.ids[0],s.agent_id,s.proxy_id,s.remote_clock);
        return;
    }
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();if(owned&&++s.contexts>4096)std::abort();
}
static void halo_activation_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *){
    auto &s=halo_session_activation;int index=-1;
    if(s.stage==1&&gm_valid(cpu->ecx,8))for(unsigned k=0;k<4;++k)if(s.units[k]&&rd32(cpu->ecx+4)==s.units[k])index=int(k);
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();if(index>=0&&++s.commands[index]>4096)std::abort();
}
}

extern "C" bool majesty_browser_streaming_halo_session_activate(X86 *c,const uint32_t *aliases,uint32_t proxy_id){
#ifdef __EMSCRIPTEN__
    return false;
#else
    auto rejected=[](const char *boundary){std::fprintf(stderr,"[streaming] Halo session activation refused boundary=%s result=fail\n",boundary);return false;};
    auto &s=halo_session_activation;const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTIVATE"),*arrival=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ARRIVAL"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(s.stage||!flag||std::strcmp(flag,"v1")||!arrival||std::strcmp(arrival,"v1")||!aliases||!proxy_id||
       path.find("/actor-arrival-fixture-halo-world-session-")==path.npos||!path.ends_with("/native-world-halo/frontier_1_0")||
       !gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||rd32(0x0071c6a8)!=50||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return rejected("admission");
    X86 extra=*c;extra.r[R_ESP]-=32768;s.world=world;s.factory=rd32(world+0x10);s.runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(s.factory,0x8c)||!gm_valid(s.runtime,0x38))return rejected("factory-runtime");s.manager=rd32(s.runtime+4);
    if(!gm_valid(s.manager,0x4c)||rd32(s.manager+0x48))return rejected("manager");
    auto native=[&](uint32_t id){extra.r[R_ECX]=s.factory;return guest_call(&extra,0x005a10d0u,id);};
    auto script=[&](uint32_t id){extra.r[R_ECX]=s.runtime;return guest_call(&extra,0x006236b0u,id);};
    s.agent_id=aliases[4];s.proxy_id=proxy_id;s.agent=script(s.agent_id);s.proxy=script(proxy_id);s.hooks_before=mods_hooks_installed_count();
    constexpr uint32_t descriptions[]={0x314c5641,0x32425241,0x31475241,0x33475241};
    for(unsigned k=0;k<4;++k){s.ids[k]=aliases[k];s.units[k]=native(aliases[k]);const auto unit=s.units[k];
        if(!aliases[k]||!gm_valid(unit,0x164)||rd32(unit+0x60)!=aliases[k]||rd32(unit+0x84)!=s.factory||
           rd32(unit+0x6c)!=descriptions[k]||rd32(unit+0x74)!=(k?aliases[0]:0u)||(rd32(unit+0x64)&4)||
           rd32(rd32(unit)+0x1b4)!=0x005a2370u||rd32(rd32(unit)+0x1b8)!=0x005a2420u)return rejected("native-family");
        if(k&&(!arrival_contains(s.units[0],1,unit)||aliases[k]!=aliases[0]+k))return rejected("family-container");}
    HomeTaskView view;const bool valid_home=gm_valid(s.agent,0x34)&&gm_valid(s.proxy,0x34)&&halo_activation_home(view);
    std::fprintf(stderr,"[streaming] Halo session activation home valid=%u view-step=%u going-home=%u named-contexts=%u function=%s\n",unsigned(valid_home),view.step,unsigned(view.going_home),view.contexts,view.function);
    if(!valid_home)return rejected("home-context");
    const uint32_t grid=rd32(s.factory+0x88),cx=rd32(s.units[0]+0x54),cy=rd32(s.units[0]+0x58);uint32_t cells=0;
    if(!gm_valid(grid,0x50)||rd32(grid+0x48)!=256||rd32(grid+0x4c)!=256||cx!=4||cy!=8||
       joint_motion_physical(s.factory,s.units[0],cells,256)||cells)return rejected("absent-spatial");
    extra.r[R_ECX]=grid;const uint32_t point[]={s.units[0],cx,cy,0x200u,0u,0u};
    const auto clearance=guest_call_guarded(&extra,0x005b8eb0u,point,6);
    if(clearance.status!=GuestCallGuardedStatus::Returned||(clearance.eax&255)){
        std::fprintf(stderr,"[streaming] Halo session activation refused boundary=collision cell=%u,%u result=fail\n",cx,cy);return false;}
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)return rejected("scratch");
    std::fprintf(stderr,"[streaming] Halo session activation stage=postload family=4 clock=50\n");
    for(uint32_t unit:s.units){const uint32_t helper=rd32(unit+0x18);
        if(!gm_valid(helper,0x20)||rd32(helper)!=0x0068b4d4||rd32(helper+0x10)!=unit)std::abort();
        HaloCompletedModel cached{extra,unit,helper};
        if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005b54d0u,0,cached.callback,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,&cached,&cached.handle)!=POP_OK)std::abort();
        extra.r[R_ECX]=unit;const auto done=guest_call_guarded(&extra,0x005a2370u,nullptr,0,&cached.cookie);cached.cookie=0;
        if(mods_hook_remove(MODS_OWNER_RUNTIME,cached.handle)!=POP_OK||done.status!=GuestCallGuardedStatus::Returned||!(done.eax&255)||cached.calls!=1)std::abort();
    }
    extra.r[R_ECX]=s.units[0];guest_call(&extra,0x005ad3e0u);
    if(!joint_motion_physical(s.factory,s.units[0],cells,256)||cells!=4)std::abort();
    for(unsigned k=0;k<4;++k){const uint32_t unit=s.units[k];extra.r[R_ECX]=unit;guest_call(&extra,0x005a2420u);
        RegisteredOrderMembers before{},after{};if(!registered_order_members(s.factory,unit,before)||rd32(rd32(unit)+0xa4)!=0x005b66f0u)std::abort();
        // The crossing capsule has three effect banks and no hero bank. Let
        // original AI create future hero commands; retain the saved absence.
        const uint32_t expected=k?1u:0u;
        if(k&&!before.matches){extra.r[R_ECX]=unit;guest_call(&extra,0x005b66f0u,0x5244524fu);}
        if(!registered_order_members(s.factory,unit,after)||after.matches!=expected||before.kept!=after.kept||before.hash!=after.hash)std::abort();}
    const auto drawing=live_drawing(s.factory,s.units[0]);const uint32_t pending=rd32(s.manager+0x3c);DepartureQueues before{},after{};
    if(!drawing.valid||drawing.excluded!=1||(pending!=s.manager+0x10&&pending!=s.manager+0x1c)||!departure_queues(s.manager,s.agent,before)||before.omitted)std::abort();
    wr32(scratch+144,s.agent);extra.r[R_ECX]=pending;guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);
    if(!departure_queues(s.manager,s.agent,after)||after.omitted!=1)std::abort();after.omitted=0;if(after!=before)std::abort();
    if(!heap_free(scratch)||mods_hooks_installed_count()!=s.hooks_before||rd32(0x0071c6a8)!=50||rd32(phase)!=7||rd32(phase+4))std::abort();
    if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,halo_activation_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x006381b0u,0,halo_activation_context,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.context_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,halo_activation_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK)std::abort();
    s.stage=1;
    std::fprintf(stderr,"[streaming] Halo session activated hero=%u agent=%u effects=%u,%u,%u proxy=%u clock=50 footprint=4 drawing=1 queued=1 original-collision=1 original-first-postload=4 completed-model-step-cached=4 original-second-postload=4 effect-orders-admitted=3 hero-bank-absent=1 remote-guard=1 owner-published=0 result=pass\n",s.ids[0],s.agent_id,s.ids[1],s.ids[2],s.ids[3],s.proxy_id);
    return true;
#endif
}

extern "C" bool majesty_browser_streaming_halo_session_activation_after_tick(X86 *c){
#ifdef __EMSCRIPTEN__
    return false;
#else
    auto &s=halo_session_activation;if(s.stage!=1)std::abort();const uint32_t clock=rd32(0x0071c6a8),phase=rd32(0x006d7670);
    if(rd32(0x0071c68c)!=s.world||!gm_valid(phase,0x50)||rd32(phase)!=3||rd32(phase+4)||clock!=s.last_clock+50||clock>3550||
       mods_hook_depth()||!sched_holds_baton())std::abort();
    s.last_clock=clock;
    X86 extra=*c;extra.r[R_ESP]-=32768;auto native=[&](uint32_t id){extra.r[R_ECX]=s.factory;return guest_call(&extra,0x005a10d0u,id);};
    for(unsigned k=0;k<4;++k){const uint32_t unit=native(s.ids[k]);
        if(k&&!unit){if(!s.commands[k])std::abort();if(!s.retired[k]){s.retired[k]=clock;s.units[k]=0;
            std::fprintf(stderr,"[streaming] Halo session effect retired unit=%u index=%u clock=%u original-commands=%u result=pass\n",s.ids[k],k,clock,s.commands[k]);}continue;}
        if(unit!=s.units[k]||s.retired[k]||!gm_valid(unit,0x164)||(rd32(unit+0x64)&4)||rd32(unit+0x74)!=(k?s.ids[0]:0u))std::abort();}
    uint32_t cells=0;const auto drawing=live_drawing(s.factory,s.units[0]);
    if(!joint_motion_physical(s.factory,s.units[0],cells,256)||cells!=4||!drawing.valid||drawing.excluded!=1||++s.samples>70)std::abort();
    if(s.remote){HomeTaskView view;if(!halo_activation_home(view))std::abort();if(!s.held){s.held_fingerprint=view.fingerprint;s.held=true;}
        else if(view.fingerprint!=s.held_fingerprint)std::abort();}
    if(clock<3550)return false;
    std::fprintf(stderr,"[streaming] Halo session activation endpoint clock=%u ai=%u held-ai=%u contexts=%u other-ai=%u commands=%u,%u,%u,%u retired=%u,%u,%u samples=%u\n",clock,s.ai,s.held_ai,s.contexts,s.other_ai,s.commands[0],s.commands[1],s.commands[2],s.commands[3],s.retired[1],s.retired[2],s.retired[3],s.samples);
    DepartureQueues queues{};
    if(!s.remote||!s.held||!s.ai||!s.held_ai||!s.contexts||!s.other_ai||!s.retired[1]||!s.retired[2]||!s.retired[3]||
       !departure_queues(s.manager,s.agent,queues)||queues.omitted!=1||
       mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK||mods_hook_remove(MODS_OWNER_RUNTIME,s.context_hook)!=POP_OK||
       mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK||mods_hooks_installed_count()!=s.hooks_before)std::abort();
    s.stage=2;
    std::fprintf(stderr,"[streaming] Halo session continuation hero=%u agent=%u proxy=%u clock=3550 ticks=70 footprint=4 drawing=1 queued=1 original-ai=1 original-effect-lifetimes=3 remote-home-before-guard=1 request-held=1 other-ai-running=1 hooks-removed=1 owner-published=0 result=pass\n",s.ids[0],s.agent_id,s.proxy_id);
    s.world=s.factory=s.runtime=s.manager=s.agent=s.proxy=0;s.units.fill(0);
    return true;
#endif
}

namespace {
// Saved neighbors retain populated command banks and an existing pure guild.
// Route a foreign travel_to before it asks the local engine for that guild,
// while original native commands, the hero scheduler and other AI keep running.
struct HaloSavedContinuation {
    uint32_t stage=0,world=0,factory=0,runtime=0,manager=0,unit=0,agent=0,proxy=0,id=0,agent_id=0;
    uint32_t last=3750,hooks_before=0,agent_hook=0,context_hook=0,command_hook=0,ai=0,other_ai=0,contexts=0,commands=0,samples=0;
    std::array<int32_t,3> previous{},accepted{};
    bool routed=false;
} halo_saved_continuation;
static bool halo_saved_home(HomeTaskView &v) {
    const auto &s=halo_saved_continuation;
    return home_task_view(s.agent,v,s.agent_id,s.id,34)&&rd32(v.home+8)==34&&rd32(v.target+8)==34&&
        home_text(v.task+8,"go_home")&&(!std::strcmp(v.function,"travel_to")||!std::strcmp(v.function,"use_building"))&&
        !rd32(s.proxy+0x20)&&!rd32(s.proxy+0x24)&&!rd8(s.proxy+0x28);
}
static void halo_saved_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_saved_continuation;const bool own=s.stage==1&&cpu->ecx==s.agent;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.stage==1){auto &n=own?s.ai:s.other_ai;if(++n>65536)std::abort();}
}
static void halo_saved_context(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_saved_continuation;
    if(s.stage==1&&rd32(0x00720304u)==s.agent&&gm_valid(cpu->ecx,24)&&
       (home_text(cpu->ecx,"travel_to")||home_text(cpu->ecx,"use_building"))) {
        HomeTaskView v;if(!s.routed||!halo_saved_home(v)||++s.contexts>4096||mods_hook_return(api,cpu,0,4)!=POP_OK)std::abort();
        return; // Keep the logical guild task pending; the bound physical leg runs.
    }
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
}
static void halo_saved_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_saved_continuation;const bool own=s.stage==1&&gm_valid(cpu->ecx,8)&&rd32(cpu->ecx+4)==s.unit;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();if(own&&++s.commands>65536)std::abort();
}
}
namespace {
// Exactly one loaded-world binding. End/dispatcher exit removes every hook
// and clears all guest addresses; no dormant kingdom is kept in this state.
struct HeroArrivalLive {
    bool live=false,routed=false;
    uint32_t world=0,factory=0,runtime=0,manager=0,unit=0,agent=0,proxy=0,id=0,agent_id=0,proxy_id=0;
    uint32_t home=0,home_id=0;
    uint32_t hooks_before=0,context_hook=0,agent_hook=0,command_hook=0,contexts=0,ai=0,other_ai=0,commands=0;
} hero_arrival_live;
bool hero_arrival_home(const HeroArrivalLive &s,HomeTaskView &v) {
    if(!(rd32(0x0071c68c)==s.world&&home_task_view(s.agent,v,s.agent_id,s.id,s.proxy_id)&&
        rd32(v.home+8)==s.proxy_id&&rd32(v.target+8)==s.proxy_id&&home_text(v.task+8,"go_home")&&
        (!std::strcmp(v.function,"travel_to")||!std::strcmp(v.function,"use_building"))&&
        gm_valid(s.proxy,0x34)&&rd32(s.proxy+0x10)==s.proxy_id&&!rd8(s.proxy+0x28)))return false;
    if(!s.home_id)return !rd32(s.proxy+0x20)&&!rd32(s.proxy+0x24);
    return gm_valid(s.home,0x98)&&rd32(s.proxy+0x20)==s.home_id&&rd32(s.proxy+0x24)==s.home&&
        rd32(s.home+0x60)==s.home_id&&rd32(s.home+0x6c)==0x31564241&&rd32(s.home+0x84)==s.factory&&
        rd32(s.home+0x70)==rd32(s.unit+0x70)&&!(rd32(s.home+0x64)&4)&&
        arrival_contains(s.home,100,s.unit)&&arrival_contains(s.unit,101,s.home);
}
bool hero_arrival_home(HomeTaskView &v) { return hero_arrival_home(hero_arrival_live,v); }
void hero_arrival_context(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=hero_arrival_live;
    if(s.live&&rd32(0x0071c68c)==s.world&&rd32(0x00720304u)==s.agent&&gm_valid(cpu->ecx,24)&&
       (home_text(cpu->ecx,"travel_to")||home_text(cpu->ecx,"use_building"))) {
        HomeTaskView view;
        if(!home_task_view(s.agent,view,s.agent_id,s.id,s.proxy_id))std::abort();
        // An enemy, reward or local building can become this hero's target.
        // Preserve original dispatch for those targets; only the registered
        // pure remote guild needs a physical regional return leg.
        if(rd32(view.target+8)==s.proxy_id){
            HomeTaskView remote;
            // Imported, admitted movement orders can already carry this leg.
            // Keep the foreign guild task pending without requiring a new
            // route command that would replace those original orders.
            if(!hero_arrival_home(remote)||mods_hook_return(api,cpu,0,4)!=POP_OK)std::abort();
            if(s.contexts<UINT32_MAX)++s.contexts;
#ifndef __EMSCRIPTEN__
            const char *restore=recomp_env("BROWSER_FRONTIER_HERO_REMOTE_RESTORE_TEST"),*profile=recomp_env("PROFILE_DIR");
            const std::string_view path(profile?profile:"");
            if(s.contexts==1&&restore&&!std::strcmp(restore,"v1")&&
               path.find("/actor-arrival-fixture-hero-binding-")!=path.npos&&path.ends_with("/frontier_-5_-1"))
                std::fprintf(stderr,"[streaming] Restored remote hero original context unit=%u agent=%u proxy=%u clock=%u original-callback=1 pure-home-preserved=1 new-route=0 result=pass\n",
                    s.id,s.agent_id,s.proxy_id,rd32(0x0071c6a8));
#endif
            return;
        }
    }
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
}
#ifndef __EMSCRIPTEN__
// These two observers exist only in the owned native qualification driver.
// Production installs only the foreign-home context guard.
void hero_arrival_test_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=hero_arrival_live;const bool own=s.live&&cpu->ecx==s.agent;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.live){auto &count=own?s.ai:s.other_ai;if(++count>65536)std::abort();}
}
void hero_arrival_test_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=hero_arrival_live;const bool own=s.live&&gm_valid(cpu->ecx,8)&&rd32(cpu->ecx+4)==s.unit;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();if(own&&++s.commands>65536)std::abort();
}
#endif
}

extern "C" void majesty_browser_streaming_end_hero_arrival() {
    auto &s=hero_arrival_live;if(!s.live)return;
    for(uint32_t handle:{s.command_hook,s.agent_hook,s.context_hook})
        if(handle&&mods_hook_remove(MODS_OWNER_RUNTIME,handle)!=POP_OK)std::abort();
    s={};
}
extern "C" void majesty_browser_streaming_hero_arrival_lifecycle() {
    const auto &s=hero_arrival_live;if(!s.live)return;
    const uint32_t state=rd32(0x006d7670);
    if(rd32(0x0071c68c)!=s.world||!gm_valid(state,8)||
       (rd32(state)!=3&&rd32(state)!=7&&rd32(state)!=8)||
       (rd32(state+4)&&rd32(state+4)!=3&&rd32(state+4)!=7&&rd32(state+4)!=8))
        majesty_browser_streaming_end_hero_arrival();
}

#ifndef __EMSCRIPTEN__
namespace {
struct HeroCollisionProbe {
    uint32_t hero=0,handle=0,calls=0,blocked=0;
    static void actor(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *opaque) {
        auto &p=*static_cast<HeroCollisionProbe *>(opaque);const uint32_t sp=cpu->esp;
        if(!gm_valid(sp,16)||rd32(sp+4)!=p.hero)std::abort();
        const uint32_t other=rd32(sp+8),flags=rd32(sp+12);
        if(!gm_valid(other,0x84)||flags!=0x200u||++p.calls>64)std::abort();
        if(mods_call_next(api,inv,cpu)!=POP_OK||cpu->esp!=sp+4)std::abort();
        if(cpu->eax&255){++p.blocked;
            std::fprintf(stderr,"[streaming] Hero collision blocker unit=%u description=%08x state=%08x grid=%u,%u pose=%d,%d,%d flags=%u original-predicate=1\n",
                rd32(other+0x60),rd32(other+0x6c),rd32(other+0x64),rd32(other+0x54),rd32(other+0x58),
                int32_t(rd32(other+0x48)),int32_t(rd32(other+0x4c)),int32_t(rd32(other+0x50)),flags);
        }
    }
};
}
#endif
extern "C" bool majesty_browser_streaming_probe_hero_collision(X86 *c,const uint32_t *aliases,uint32_t clock) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag=recomp_env("BROWSER_FRONTIER_HERO_COLLISION_REPLAY_TEST");
    const std::string profile=mods_overlay_profile_dir();const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!flag||std::strcmp(flag,"v1")||profile.find("/actor-arrival-fixture-hero-home-")==profile.npos||
       !profile.ends_with("/frontier_-1_-1")||!c||!aliases||!aliases[0]||!aliases[4]||aliases[1]||aliases[2]||aliases[3]||
       !gm_valid(state,0x50)||rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=clock||
       !gm_valid(world,0x14)||mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    const uint32_t factory=rd32(world+0x10);if(!gm_valid(factory,0x8c))return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=factory;
    const uint32_t unit=guest_call(&extra,0x005a10d0u,aliases[0]),grid=rd32(factory+0x88),hooks=mods_hooks_installed_count();
    if(!gm_valid(unit,0x164)||!gm_valid(grid,0x50)||rd32(grid+0x48)!=256||rd32(grid+0x4c)!=256)return false;
    const uint32_t cx=rd32(unit+0x54),cy=rd32(unit+0x58),table=rd32(unit);
    if(!gm_valid(table,0xc4)||cx>=256||cy>=256)return false;
    extra.r[R_ECX]=unit;const uint32_t zero=0;
    const auto mask=guest_call_guarded(&extra,rd32(table+0xc0),&zero,1);
    if(mask.status!=GuestCallGuardedStatus::Returned)return false;
    if(mask.eax){if(!gm_valid(mask.eax,0x18))return false;
        std::fprintf(stderr,"[streaming] Hero collision footprint width=%u height=%u stride=%u origin=%d,%d grid=%u,%u original-getter=1\n",
            rd32(mask.eax),rd32(mask.eax+4),rd32(mask.eax+8),int32_t(rd32(mask.eax+12)),int32_t(rd32(mask.eax+16)),cx,cy);
    }
    HeroCollisionProbe probe;probe.hero=unit;
    if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005f0db0u,0,probe.actor,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,&probe,&probe.handle)!=POP_OK)return false;
    extra.r[R_ECX]=grid;const uint32_t point[]={unit,cx,cy,0x200u,0u,0u};
    const auto clearance=guest_call_guarded(&extra,0x005b8eb0u,point,6);
    if(mods_hook_remove(MODS_OWNER_RUNTIME,probe.handle)!=POP_OK||mods_hooks_installed_count()!=hooks||
       clearance.status!=GuestCallGuardedStatus::Returned||rd32(state)!=7||rd32(state+4)||rd32(0x0071c6a8)!=clock||rd32(0x0071c68c)!=world)return false;
    std::fprintf(stderr,"[streaming] Hero collision replay completed hero=%u agent=%u grid=%u,%u clearance=%u predicate-calls=%u blockers=%u clock=%u original-query=1 ordinary-ticks=0 activated=0 scheduled=0 owner-published=0 hooks-removed=1 result=pass\n",
        aliases[0],aliases[4],cx,cy,clearance.eax&255,probe.calls,probe.blocked,clock);
    return true;
#endif
}

extern "C" bool majesty_browser_streaming_activate_hero_arrival(X86 *c,const uint32_t *aliases,uint32_t proxy_id,uint32_t clock) {
    auto &s=hero_arrival_live;const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c),game=rd32(0x006d8568);
    if(s.live||!c||!aliases||!aliases[0]||!aliases[4]||aliases[1]||aliases[2]||aliases[3]||!proxy_id||
       !gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||rd32(0x0071c6a8)!=clock||!gm_valid(world,0x14)||
       !gm_valid(game,0x21c)||rd32(game+0x218)==2||mods_hook_depth()||!sched_holds_baton()||
       c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    auto require=[](bool ok,const char *where){if(!ok){std::fprintf(stderr,"[streaming] Hero activation invariant failed boundary=%s\n",where);std::abort();}};
    X86 extra=*c;extra.r[R_ESP]-=32768;s.world=world;s.factory=rd32(world+0x10);s.runtime=guest_call(&extra,0x00623b20u);
    require(gm_valid(s.factory,0x8c)&&gm_valid(s.runtime,0x38),"runtime");s.manager=rd32(s.runtime+4);
    require(gm_valid(s.manager,0x4c)&&!rd32(s.manager+0x48),"manager");
    s.id=aliases[0];s.agent_id=aliases[4];s.proxy_id=proxy_id;
    extra.r[R_ECX]=s.factory;s.unit=guest_call(&extra,0x005a10d0u,s.id);
    extra.r[R_ECX]=s.runtime;s.agent=guest_call(&extra,0x006236b0u,s.agent_id);
    extra.r[R_ECX]=s.runtime;s.proxy=guest_call(&extra,0x006236b0u,proxy_id);
    if(gm_valid(s.proxy,0x34)){s.home_id=rd32(s.proxy+0x20);
        if(s.home_id){extra.r[R_ECX]=s.factory;s.home=guest_call(&extra,0x005a10d0u,s.home_id);}}
    HomeTaskView view;uint32_t cells=0;s.hooks_before=mods_hooks_installed_count();
    require(gm_valid(s.unit,0x164)&&gm_valid(s.proxy,0x34)&&rd32(s.unit+0x60)==s.id&&rd32(s.unit+0x6c)==0x314c5641&&
        !rd32(s.unit+0x74)&&!(rd32(s.unit+0x64)&4)&&hero_arrival_home(view)&&!std::strcmp(view.function,"travel_to"),"identity-home");
    const uint32_t grid=rd32(s.factory+0x88),cx=rd32(s.unit+0x54),cy=rd32(s.unit+0x58);const auto drawing=live_drawing(s.factory,s.unit);
    require(gm_valid(grid,0x50)&&rd32(grid+0x48)==256&&rd32(grid+0x4c)==256&&cx>=2&&cx<254&&cy>=2&&cy<254&&
        !joint_motion_physical(s.factory,s.unit,cells,256)&&!cells&&drawing.valid&&!drawing.excluded,"spatial-before");
    extra.r[R_ECX]=grid;const uint32_t point[]={s.unit,cx,cy,0x200u,0u,0u};const auto clearance=guest_call_guarded(&extra,0x005b8eb0u,point,6);
    require(clearance.status==GuestCallGuardedStatus::Returned,"collision-call");
    // Generated or restored kingdoms can contain a blocking footprint at the
    // exact incoming position. An ordinary negative collision query is an
    // admission refusal, before postload, drawing or scheduling. The caller
    // retains the captured recovery and closes this unpublished target.
    if(clearance.eax&255){
        std::fprintf(stderr,"[streaming] Hero arrival activation refused boundary=collision hero=%u agent=%u grid=%u,%u clearance=%u clock=%u phase=7 pending=0 original-query-returned=1 postload=0 drawing=0 scheduled=0 owner-published=0\n",
            s.id,s.agent_id,cx,cy,clearance.eax&255,clock);
        s={};return false;
    }
    const uint32_t table=rd32(s.unit),helper=rd32(s.unit+0x18);
    require(rd32(table+0x1b4)==0x005a2370u&&rd32(table+0x1b8)==0x005a2420u&&rd32(table+0x94)==0x005ad3e0u&&
        gm_valid(helper,0x20)&&rd32(helper)==0x0068b4d4&&rd32(helper+0x10)==s.unit,"postload-methods");
    HaloCompletedModel cached{extra,s.unit,helper};
    require(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005b54d0u,0,cached.callback,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,&cached,&cached.handle)==POP_OK,"model-cache");
    extra.r[R_ECX]=s.unit;const auto done=guest_call_guarded(&extra,0x005a2370u,nullptr,0,&cached.cookie);cached.cookie=0;
    require(mods_hook_remove(MODS_OWNER_RUNTIME,cached.handle)==POP_OK&&done.status==GuestCallGuardedStatus::Returned&&(done.eax&255)&&cached.calls==1,"first-postload");
    extra.r[R_ECX]=s.unit;guest_call(&extra,0x005ad3e0u);extra.r[R_ECX]=s.unit;guest_call(&extra,0x005a2420u);
    const auto after=live_drawing(s.factory,s.unit);RegisteredOrderMembers orders{};
    require(joint_motion_physical(s.factory,s.unit,cells,256)&&cells==4&&after.valid&&after.excluded==1&&after.kept==drawing.kept&&after.hash==drawing.hash&&
        registered_order_members(s.factory,s.unit,orders)&&orders.matches==1,"physical-drawing-orders");
    const uint32_t scratch=heap_alloc(512,true),pending=rd32(s.manager+0x3c);DepartureQueues qb{},qa{};
    require(scratch&&(pending==s.manager+0x10||pending==s.manager+0x1c)&&departure_queues(s.manager,s.agent,qb)&&!qb.omitted,"queue-before");
    wr32(scratch+144,s.agent);extra.r[R_ECX]=pending;guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);
    require(departure_queues(s.manager,s.agent,qa)&&qa.omitted==1,"queue-after");qa.omitted=0;
    require(qa==qb&&heap_free(scratch)&&mods_hooks_installed_count()==s.hooks_before,"preserved-queues");
    if(!s.home_id)require(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x006381b0u,0,hero_arrival_context,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.context_hook)==POP_OK,"remote-guard");
    s.live=true;
#ifndef __EMSCRIPTEN__
    const char *flag=recomp_env("BROWSER_FRONTIER_HERO_ACTIVATION_TEST"),*profile=recomp_env("PROFILE_DIR");const std::string_view path(profile?profile:"");
    const char *move_replay=recomp_env("BROWSER_FRONTIER_HERO_REMOTE_MOVE_REPLAY_TEST");
    const bool remote_move_replay=move_replay&&!std::strcmp(move_replay,"v1")&&path.ends_with("/frontier_-3_-1");
    if(flag&&!std::strcmp(flag,"v1")&&path.find("/actor-arrival-fixture-hero-home-")!=path.npos&&
       (path.ends_with("/frontier_1_0")||remote_move_replay)){
        require(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,hero_arrival_test_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)==POP_OK&&
            mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,hero_arrival_test_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)==POP_OK,"private-observers");}
#endif
    require(rd32(0x0071c6a8)==clock&&rd32(phase)==7&&!rd32(phase+4),"paused");
    if(s.home_id){
        require(!s.context_hook&&mods_hooks_installed_count()==s.hooks_before,"native-ai-ungated");
        std::fprintf(stderr,"[streaming] Hero native home activated hero=%u agent=%u home=%u/%u clock=%u footprint=4 drawing=1 queued=1 orders-admitted=1 original-collision=1 original-postload=1 completed-model-step-cached=1 native-ai-ungated=1 owner-published=0 result=pass\n",
            s.id,s.agent_id,s.home_id,s.proxy_id,clock);return true;
    }
    std::fprintf(stderr,"[streaming] Hero activated hero=%u agent=%u proxy=%u clock=%u footprint=4 drawing=1 queued=1 orders-admitted=1 original-collision=1 original-postload=1 completed-model-step-cached=1 remote-guard=1 owner-published=0 result=pass\n",s.id,s.agent_id,s.proxy_id,clock);
    return true;
}

extern "C" bool majesty_browser_streaming_route_hero_home(X86 *c,uint32_t x,uint32_t y) {
    auto &s=hero_arrival_live;HomeTaskView before,after;const uint32_t phase=rd32(0x006d7670),clock=rd32(0x0071c6a8);
    if(!s.live||s.home_id||s.routed||!c||x<32||x>4064||y<32||y>4064||!gm_valid(phase,8)||rd32(phase)!=7||rd32(phase+4)||
       !hero_arrival_home(before)||rd32(rd32(s.unit)+0x114)!=0x005b4870u||mods_hook_depth()||!sched_holds_baton()||
       c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    std::array<int32_t,3> position{};for(unsigned k=0;k<3;++k)position[k]=int32_t(rd32(s.unit+0x48+k*4));
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=s.unit;const uint32_t args[]={0u,x,y,0u,0u};guest_call(&extra,0x005b4870u,args,5);
    if(!hero_arrival_home(after)||after.fingerprint!=before.fingerprint||rd32(0x0071c6a8)!=clock)std::abort();
    for(unsigned k=0;k<3;++k)if(int32_t(rd32(s.unit+0x48+k*4))!=position[k])std::abort();
    s.routed=true;
    std::fprintf(stderr,"[streaming] Hero remote home leg hero=%u agent=%u proxy=%u clock=%u point=%u,%u original-command=005b4870 pose-written=0 task-preserved=1 owner-published=0 result=pass\n",s.id,s.agent_id,s.proxy_id,clock,x,y);
    return true;
}

extern "C" bool majesty_browser_streaming_active_hero_pose(X86 *c,int32_t *pose,uint32_t *stats) {
    const auto &s=hero_arrival_live;if(!s.live||!c||!pose||!stats||rd32(0x0071c68c)!=s.world||mods_hook_depth()||!sched_holds_baton()||
       c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=s.factory;const uint32_t unit=guest_call(&extra,0x005a10d0u,s.id);
    extra.r[R_ECX]=s.runtime;const uint32_t agent=guest_call(&extra,0x006236b0u,s.agent_id);
    uint32_t cells=0;HomeTaskView view;DepartureQueues queues{};const auto drawing=live_drawing(s.factory,s.unit);
    if(unit!=s.unit||agent!=s.agent||!hero_arrival_home(view)||(rd32(s.unit+0x64)&4)||rd32(s.unit+0x74)||
       !joint_motion_physical(s.factory,s.unit,cells,256)||cells!=4||!drawing.valid||drawing.excluded!=1||
       !departure_queues(s.manager,s.agent,queues)||queues.omitted!=1)return false;
    for(unsigned k=0;k<3;++k)pose[k]=int32_t(rd32(s.unit+0x48+k*4));
    stats[0]=s.ai;stats[1]=s.other_ai;stats[2]=s.contexts;stats[3]=s.commands;return true;
}

// Rebind only the currently activated original actor and registered native or remote
// home. No actor pointer is supplied by the publication controller.
extern "C" bool majesty_browser_streaming_active_hero_binding(X86 *c,const uint32_t *binding) {
    const auto &s=hero_arrival_live;int32_t pose[3]{};uint32_t stats[4]{};
    return s.live&&gm_valid(s.unit,0x164)&&binding&&binding[0]==rd32(0x0071c6a8)&&binding[1]==s.id&&binding[2]==s.agent_id&&
        binding[3]==0x314c5641u&&binding[4]==rd32(s.unit+0x70)&&binding[5]==s.home_id&&binding[6]==s.proxy_id&&
        majesty_browser_streaming_active_hero_pose(c,pose,stats);
}

// Restore custody of a selected, serialized remote owner. Only host binding
// state and its guard are created; original units, agents, orders, scheduling
// and clocks are never reconstructed or changed here.
extern "C" bool majesty_browser_streaming_restore_remote_hero_binding(X86 *c,const uint32_t *binding) {
    auto &live=hero_arrival_live;
    auto refuse=[](const char *where){
#ifndef __EMSCRIPTEN__
        const char *flag=recomp_env("BROWSER_FRONTIER_HERO_REMOTE_RESTORE_TEST"),*profile=recomp_env("PROFILE_DIR");
        const std::string_view path(profile?profile:"");
        if(flag&&!std::strcmp(flag,"v1")&&path.find("/actor-arrival-fixture-hero-binding-")!=path.npos&&path.ends_with("/frontier_-5_-1"))
            std::fprintf(stderr,"[streaming] Remote hero restore refused boundary=%s original-loader=1 binding-created=0\n",where);
#endif
        return false;
    };
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c),game=rd32(0x006d8568);
    if(!c||!binding||live.live||!binding[1]||!binding[2]||binding[2]>0x7fffffffu||
       binding[3]!=0x314c5641u||binding[4]>7||binding[5]||!binding[6]||binding[6]>0x7fffffffu||
       binding[2]==binding[6]||binding[7]!=0x31564241u||!gm_valid(phase,0x50)||rd32(phase)!=3||rd32(phase+4)||
       rd32(0x0071c6a8)!=binding[0]||!gm_valid(world,0x14)||!gm_valid(game,0x21c)||rd32(game+0x218)==2||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return refuse("phase-binding");
    HeroArrivalLive next;next.world=world;next.factory=rd32(world+0x10);
    if(!gm_valid(next.factory,0x8c))return refuse("factory");
    X86 extra=*c;extra.r[R_ESP]-=32768;next.runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(next.runtime,0x38))return refuse("runtime");next.manager=rd32(next.runtime+4);
    if(!gm_valid(next.manager,0x4c)||rd32(next.manager+0x48))return refuse("manager");
    next.id=binding[1];next.agent_id=binding[2];next.proxy_id=binding[6];
    extra.r[R_ECX]=next.factory;next.unit=guest_call(&extra,0x005a10d0u,next.id);
    extra.r[R_ECX]=next.runtime;next.agent=guest_call(&extra,0x006236b0u,next.agent_id);
    extra.r[R_ECX]=next.runtime;next.proxy=guest_call(&extra,0x006236b0u,next.proxy_id);
    if(!gm_valid(next.unit,0x164)||rd32(next.unit+0x60)!=next.id||rd32(next.unit+0x6c)!=binding[3]||
       rd32(next.unit+0x70)!=binding[4]||rd32(next.unit+0x74)||(rd32(next.unit+0x64)&4)||
       rd32(next.unit+0x84)!=next.factory||!gm_valid(next.agent,0x34)||rd32(next.agent+0x20)!=next.id||
       (rd32(next.agent+0x24)&&rd32(next.agent+0x24)!=next.unit)||rd8(next.agent+0x28)||!gm_valid(next.proxy,0x34)||
       rd32(next.proxy+0x20)||rd32(next.proxy+0x24))return refuse("aliases");
    HomeTaskView home;uint32_t cells=0;DepartureQueues queues{};RegisteredOrderMembers orders{};
    const auto drawing=live_drawing(next.factory,next.unit);
    if(!hero_arrival_home(next,home))return refuse("home-task");
    if(!joint_motion_physical(next.factory,next.unit,cells,256)||cells!=4)return refuse("physical");
    if(!drawing.valid||drawing.excluded!=1)return refuse("drawing");
    if(!departure_queues(next.manager,next.agent,queues)||queues.omitted!=1)return refuse("scheduler");
    if(!registered_order_members(next.factory,next.unit,orders))return refuse("orders");
    // A saved hero can finish its route before the next checkpoint. Original
    // 005b2b50 queries all three command banks; preserve its empty/nonempty
    // state rather than requiring an ORDR attachment for every live hero.
    const uint32_t order_marker=rd32(next.unit+0x40);
    extra.r[R_ECX]=next.unit;
    const auto banks=guest_call_guarded(&extra,0x005b2b50u,nullptr,0);
    if(banks.status!=GuestCallGuardedStatus::Returned||orders.matches!=unsigned((banks.eax&255)!=0)||
       rd32(next.unit+0x40)!=order_marker)return refuse("orders-banks");
    // A remote proxy carries nine immutable origin fields, not a local guild's
    // member roster. The hero's own home/target links were checked above.
    DepartureQueues proxy_queues{};
    if(!gm_valid(rd32(next.proxy),16)||rd32(rd32(next.proxy)+12)!=9||
       !departure_queues(next.manager,next.proxy,proxy_queues)||proxy_queues.omitted)return refuse("proxy-metadata");
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)return false;
    const uint32_t marker=departure_list(extra,scratch,next.proxy,"frontier_proxy"),
        description=departure_list(extra,scratch,next.proxy,"home_description"),
        player=departure_list(extra,scratch,next.proxy,"home_player");
    const bool metadata=gm_valid(marker,20)&&rd32(marker+4)==3&&home_text(marker+8,"majesty-remote-home-v1")&&
        gm_valid(description,12)&&rd32(description+4)==1&&rd32(description+8)==binding[7]&&
        gm_valid(player,12)&&rd32(player+4)==1&&rd32(player+8)==binding[4];
    if(!heap_free(scratch)||!metadata)return refuse("proxy-metadata-values");
    next.hooks_before=mods_hooks_installed_count();
    if(rd32(0x0071c68c)!=world||rd32(0x0071c6a8)!=binding[0]||rd32(phase)!=3||rd32(phase+4))return false;
    if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x006381b0u,0,hero_arrival_context,POP_HOOK_WRAP,
       POP_HOOK_NO_GAME_VIEW,nullptr,&next.context_hook)!=POP_OK)return false;
    next.live=true;live=next;
    std::fprintf(stderr,"[streaming] Selected remote hero restored unit=%u agent=%u proxy=%u clock=%u footprint=4 drawing=1 queued=1 orders=%u original-loader=1 remote-guard=1 imported=0 reactivated=0 native-cache-empty=%u result=pass\n",
        next.id,next.agent_id,next.proxy_id,binding[0],orders.matches,unsigned(!rd32(next.agent+0x24)));
    return true;
}

// Necessary admission for an absolute Path4 goal. This is not complete order
// migration: the stopped package still validates every command and waypoint.
// Read only the current registered hero's bounded live banks; retain no pointer
// and let original gameplay continue when its path belongs to this kingdom.
extern "C" bool majesty_browser_streaming_hero_path_goals_fit(X86 *c,
    const uint32_t *binding,int32_t dx,int32_t dy,int32_t *goal) {
    if(!c||!binding||!goal||binding[0]!=rd32(0x0071c6a8)||!binding[1]||!binding[2]||
       std::abs(int64_t(dx))+std::abs(int64_t(dy))!=3968||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    const uint32_t state=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!gm_valid(state,0x50)||rd32(state)!=3||rd32(state+4)||!gm_valid(world,0x14))return false;
    const uint32_t factory=rd32(world+0x10);if(!gm_valid(factory,0x8c))return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=factory;
    const uint32_t unit=guest_call(&extra,0x005a10d0u,binding[1]);
    if(!gm_valid(unit,0x164)||rd32(unit+0x60)!=binding[1]||rd32(unit+0x6c)!=binding[3]||
       rd32(unit+0x70)!=binding[4]||rd32(unit+0x74)||(rd32(unit+0x64)&4)||rd32(unit+0x84)!=factory)return false;
    uint32_t entries=0;bool fits=true;
    for(uint32_t index=0;index<3;++index){
        const uint32_t bank=rd32(unit+0x88+index*4);
        if(!bank)continue;
        if(!gm_valid(bank,20)||rd32(bank)!=0x00683148u||rd32(bank+4)!=unit)return false;
        const uint32_t head=rd32(bank+12),count=rd32(bank+16);
        if(count>128-entries||!gm_valid(head,12))return false;
        uint32_t node=rd32(head),previous=head;
        for(uint32_t n=0;n<count;++n){
            if(node==head||!gm_valid(node,12)||rd32(node+4)!=previous)return false;
            const uint32_t order=rd32(node+8);if(!gm_valid(order,20))return false;
            if(rd32(order+16)==4){
                // Pinned Path4 object+3c/+40 are native-world goal XY;
                // writer005e0e90 and conversion0043c640 preserve these words.
                if(!gm_valid(order,100)||rd32(order)!=0x0068add8u)return false;
                const int32_t x=int32_t(rd32(order+0x3c)),y=int32_t(rd32(order+0x40));
                if(x<0||y<0||x>=4096||y>=4096)return false;
                const int64_t projected_x=int64_t(x)+dx,projected_y=int64_t(y)+dy;
                if(projected_x<0||projected_y<0||projected_x>=4096||projected_y>=4096){
                    if(fits){goal[0]=x;goal[1]=y;}fits=false;
                }
            }
            ++entries;previous=node;node=rd32(node);
        }
        if(node!=head||rd32(head+4)!=previous)return false;
    }
    return fits&&rd32(0x0071c68c)==world&&rd32(0x0071c6a8)==binding[0]&&rd32(state)==3&&!rd32(state+4);
}

// At the captured source hold, obtain the original clearance rectangle before
// retiring the actor. Return only cell coordinates, never a source pointer.
extern "C" bool majesty_browser_streaming_hero_entry_bounds(X86 *c,
    const uint32_t *binding,uint32_t clock,int32_t *bounds) {
    if(!c||!binding||!bounds||!binding[1]||!binding[2]||binding[3]!=0x314c5641u||binding[4]>7||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c),hooks=mods_hooks_installed_count();
    if(!gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||rd32(0x0071c6a8)!=clock||!gm_valid(world,0x14))return false;
    const uint32_t factory=rd32(world+0x10);if(!gm_valid(factory,0x8c))return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=factory;
    const uint32_t unit=guest_call(&extra,0x005a10d0u,binding[1]),grid=rd32(factory+0x88);
    uint32_t cells=0;
    if(!gm_valid(unit,0x164)||rd32(unit)!=0x0068098cu||rd32(unit+0x60)!=binding[1]||
       rd32(unit+0x6c)!=binding[3]||rd32(unit+0x70)!=binding[4]||rd32(unit+0x74)||
       (rd32(unit+0x64)&4)||rd32(unit+0x84)!=factory||!joint_motion_physical(factory,unit,cells,256)||cells!=4)return false;
    extra.r[R_ECX]=unit;const uint32_t zero=0;
    const auto mask=guest_call_guarded(&extra,rd32(rd32(unit)+0xc0),&zero,1);
    // This enrolled hero uses the original rectangle path. A masked hero needs
    // a separately qualified entry footprint before generation may retire it.
    if(mask.status!=GuestCallGuardedStatus::Returned||mask.eax)return false;
    const uint32_t scratch=c->r[R_ESP]-64,cx=rd32(unit+0x54),cy=rd32(unit+0x58);
    const uint32_t args[]={cx,cy,rd32(unit+0x80),scratch};extra.r[R_ECX]=grid;
    const auto result=guest_call_guarded(&extra,0x005b85e0u,args,4);
    if(result.status!=GuestCallGuardedStatus::Returned)return false;
    for(unsigned i=0;i<4;++i)bounds[i]=int32_t(rd32(scratch+i*4));
    if(bounds[0]<0||bounds[1]<0||bounds[2]>=256||bounds[3]>=256||
       bounds[0]>=bounds[2]||bounds[1]>=bounds[3]||bounds[2]-bounds[0]>32||bounds[3]-bounds[1]>32||
       rd32(0x0071c68c)!=world||rd32(0x0071c6a8)!=clock||rd32(phase)!=7||rd32(phase+4)||mods_hooks_installed_count()!=hooks)return false;
    std::fprintf(stderr,"[streaming] Hero source entry bounds hero=%u agent=%u grid=%u,%u rectangle=%d,%d,%d,%d clock=%u original-formatter=005b85e0 source-held=1\n",
        binding[1],binding[2],cx,cy,bounds[0],bounds[1],bounds[2],bounds[3],clock);
    return true;
}

// Read only the authenticated captured GPL record. The planner chooses a
// bounded number of original ticks; it neither writes a save nor edits a clock.
extern "C" bool majesty_browser_streaming_hero_generation_ticks(const char *path,
    const uint32_t *binding,uint32_t clock,uint32_t *ticks) {
    if(!path||!binding||!binding[1]||!binding[2]||!clock||!ticks)return false;
    FILE *input=std::fopen(path,"rb");if(!input)return false;
    bool ok=!std::fseek(input,0,SEEK_END);const long length=ok?std::ftell(input):-1;
    ok=ok&&length>=272&&length<=64*1024*1024;
    auto word=[&](long at,uint32_t &value){
        std::array<uint8_t,4> b{};
        if(at<0||at>length-4||std::fseek(input,at,SEEK_SET)||std::fread(b.data(),1,4,input)!=4)return false;
        value=uint32_t(b[0])|uint32_t(b[1])<<8|uint32_t(b[2])<<16|uint32_t(b[3])<<24;return true;
    };
    auto name=[&](long &at,long limit){
        if(at<0||at>=limit||std::fseek(input,at,SEEK_SET))return false;
        for(unsigned n=0;n<1024&&at<limit;++n){const int ch=std::fgetc(input);++at;
            if(ch==EOF)return false;if(!ch)return true;}return false;
    };
    auto ending=[&](long end){uint32_t a=0,b=0;return word(end-8,a)&&word(end-4,b)&&!a&&b==UINT32_MAX;};
    auto bytes=std::make_unique<PrimaryBytes>();auto plan=std::make_unique<PairPlan>();plan->collect_contexts=true;
    long at=0;unsigned chunks=0,gpls=0,selected=0;uint32_t result=0;
    while(ok&&at<length){
        std::array<char,4> tag{};uint32_t size=0,version=0,count=0;
        ok=++chunks<=128&&length-at>=16&&!std::fseek(input,at,SEEK_SET)&&std::fread(tag.data(),1,4,input)==4&&
            word(at+4,size)&&word(at+8,version)&&word(at+12,count)&&size<=uint32_t(length-at-16);
        for(char ch:tag)ok=ok&&(ch==' '||(ch>='A'&&ch<='Z'));
        if(chunks==1)ok=ok&&!std::memcmp(tag.data(),"VERS",4)&&size==256&&version==1&&!count;
        if(!ok)break;const long end=at+16+size;
        if(!std::memcmp(tag.data(),"GPL ",4)){
            const long runtime=at+16,manager=runtime+12;uint32_t n=0,v=0;
            ok=!gpls++&&version==1&&!count&&size>=40&&word(runtime,n)&&n==size&&word(runtime+4,v)&&v==3&&
                ending(end)&&word(manager,n)&&n>=29&&n<=uint32_t(end-12-manager)&&
                manager+long(n)==end-12&&word(manager+4,v)&&v==2;
            const long manager_end=end-12,limit=manager_end-8;long cursor=manager+8;
            ok=ok&&word(cursor,n)&&n<=100000;cursor+=4;
            for(uint32_t i=0;ok&&i<n;++i){uint32_t id=0;ok=name(cursor,limit)&&cursor<=limit-4&&word(cursor,id)&&id;cursor+=4;}
            uint32_t agents=0,previous=0;
            ok=ok&&cursor<=limit-4&&word(cursor,agents)&&agents<=100000;cursor+=4;
            for(uint32_t i=0;ok&&i<agents;++i){
                uint32_t id=0,record_size=0,record_version=0;
                ok=cursor<=limit-12&&word(cursor,id)&&id>previous&&id<=0x7fffffffu&&
                    word(cursor+4,record_size)&&record_size>=56&&record_size<=uint32_t(limit-cursor-4)&&
                    word(cursor+8,record_version)&&record_version==2&&ending(cursor+4+record_size);
                previous=id;
                if(ok&&id==binding[2]){
                    ok=!selected++&&record_size<=bytes->size()&&!std::fseek(input,cursor+4,SEEK_SET)&&
                        std::fread(bytes->data(),1,record_size,input)==record_size&&
                        pair_agent_plan(*bytes,record_size,id,binding[1],*plan);
                    if(ok){
                        std::array<uint32_t,64> ages{};size_t active=0;
                        for(size_t j=0;ok&&j<plan->context_count;++j){const size_t p=plan->contexts[j];
                            const uint32_t delay=pair_word(*bytes,p),stamp=pair_word(*bytes,p+4),flags=pair_word(*bytes,p+8);
                            ok=!(*bytes)[p+16]&&!(flags&0xffffff7cu);
                            if(ok&&(flags&0x7fu)&&!(flags&0x80u)){
                                const uint32_t age=clock-stamp;ok=stamp&&delay<=0x7fffffffu&&age<=0x7fffffffu;
                                if(ok)ages[active++]=age;
                            }
                        }
                        for(uint32_t candidate=2;ok&&candidate<=66&&!result;++candidate){
                            bool eligible=true;for(size_t j=0;j<active;++j)if(ages[j]==candidate*50)eligible=false;
                            if(eligible)result=candidate;
                        }
                        ok=ok&&result>=2&&result<=66;
                    }
                }
                cursor+=4+record_size;
            }
            for(unsigned queue=0;ok&&queue<2;++queue){uint32_t q=0;
                ok=cursor<=limit-4&&word(cursor,q)&&q<=100000;cursor+=4;
                ok=ok&&q<=uint32_t((limit-cursor)/4);
                for(uint32_t j=0;ok&&j<q;++j){uint32_t id=0;ok=word(cursor,id)&&id&&id<=0x7fffffffu;cursor+=4;}
            }
            uint32_t next=0;
            ok=ok&&cursor+1==limit&&!std::fseek(input,cursor,SEEK_SET);const int selector=ok?std::fgetc(input):EOF;
            ok=ok&&(selector==0||selector==1)&&ending(manager_end)&&word(manager_end,next)&&next>previous&&next<=0x7fffffffu;
        }
        at=end;
    }
    ok=ok&&at==length&&gpls==1&&selected==1&&result>=2&&result<=66&&!std::ferror(input);
    const bool closed=!std::fclose(input);if(!ok||!closed)return false;*ticks=result;return true;
}

// Source-side half of a selected-hero handoff. The caller must retain the
// complete captured checkpoint before this irreversible live-world mutation.
// No source or destination custody is published here, and no guest address
// escapes this call. This first shared contract admits an outdoor Ranger
// without attached children, matching the complete arrival reader contract.
extern "C" bool majesty_browser_streaming_retire_selected_hero(X86 *c,const uint32_t *binding,uint32_t clock) {
    if(!c||!binding||mods_hook_depth()||!sched_holds_baton()||
       c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    const uint32_t id=binding[1],agent_id=binding[2],home_id=binding[5],guild_id=binding[6],
        phase=rd32(0x006d7670),world=rd32(0x0071c68c),game=rd32(0x006d8568),hooks=mods_hooks_installed_count();
    const bool remote=!home_id;
    if(!id||!agent_id||!guild_id||id==home_id||agent_id==guild_id||binding[3]!=0x314c5641u||binding[4]>7||!binding[7]||
       !gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||rd32(0x0071c6a8)!=clock||
       !gm_valid(world,0x14)||!gm_valid(game,0x21c)||rd32(game+0x218)==2)return false;
    const bool activated=hero_arrival_live.live;
    if((remote||activated)&&!majesty_browser_streaming_active_hero_binding(c,binding))return false;
    const uint32_t arrival_hooks=activated?uint32_t(bool(hero_arrival_live.context_hook))+uint32_t(bool(hero_arrival_live.agent_hook))+uint32_t(bool(hero_arrival_live.command_hook)):0;
    X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))return false;
    const uint32_t manager=rd32(runtime+4);if(!gm_valid(manager,0x4c)||rd32(manager+0x48))return false;
    auto native=[&](uint32_t n){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,n);};
    auto script=[&](uint32_t n){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,n);};
    const uint32_t unit=native(id),home=remote?0:native(home_id),agent=script(agent_id),guild=script(guild_id);
    if(!gm_valid(unit,0x164)||!gm_valid(agent,0x34)||!gm_valid(guild,0x34)||
       rd32(unit)!=0x0068098cu||rd32(unit+0x60)!=id||rd32(unit+0x6c)!=binding[3]||rd32(unit+0x70)!=binding[4]||
       rd32(unit+0x74)||(rd32(unit+0x64)&4)||rd32(unit+0x84)!=factory||
       rd32(agent+0x10)!=agent_id||rd32(agent+0x20)!=id||rd32(agent+0x24)!=unit||rd8(agent+0x28)||
       rd32(guild+0x10)!=guild_id||rd32(guild+0x20)!=home_id||rd32(guild+0x24)!=home||rd8(guild+0x28))return false;
    if(!remote&&(!gm_valid(home,0x98)||rd32(home+0x60)!=home_id||rd32(home+0x6c)!=binding[7]||
       rd32(home+0x70)!=binding[4]||(rd32(home+0x64)&4)||rd32(home+0x84)!=factory||
       !arrival_contains(home,100,unit)||!arrival_contains(unit,101,home)))return false;
    std::array<uint32_t,13> proxy_header{};
    if(remote){if(hero_arrival_live.unit!=unit||hero_arrival_live.agent!=agent||hero_arrival_live.proxy!=guild)return false;
        for(unsigned i=0;i<proxy_header.size();++i)proxy_header[i]=rd32(guild+i*4);}
    const uint32_t container=rd32(unit+0x94);if(!gm_valid(container,16))return false;
    const uint32_t first=rd32(container+4),last=rd32(container+8);
    if(last<first||(last-first)%4||last-first>4096||!gm_valid(first,last-first))return false;
    for(uint32_t at=first;at!=last;at+=4){const uint32_t group=rd32(at);
        if(!gm_valid(group,0x18)||rd32(group)!=unit)return false;
        if(rd32(group+4)==1&&rd32(group+0xc)!=rd32(group+0x10))return false;}
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)return false;
    const uint32_t home_value=departure_list(extra,scratch,agent,"home"),members=remote?0:departure_list(extra,scratch,guild,"members");
    const auto roster=departure_list_state(members,agent_id);DepartureQueues qb{},qa{};NativeRegistrySnapshot before{},after{};
    auto drawing=live_drawing(factory,unit);RegisteredOrderMembers orders_before{},orders_after{};uint32_t cells=0,pool_before=0,pool_after=0;
    const uint64_t home_contents=remote?0:arrival_home_hash(home,unit);
    const bool admitted=gm_valid(home_value,16)&&rd32(home_value)==0x0068c054u&&rd32(home_value+4)==5&&rd32(home_value+8)==guild_id&&
        (remote||(roster.valid&&roster.matches==1&&home_contents))&&native_registry_snapshot(factory,before,unit)&&
        departure_queues(manager,agent,qb)&&qb.omitted==1&&drawing.valid&&drawing.excluded==1&&
        registered_order_members(factory,unit,orders_before)&&orders_before.matches==1&&
        joint_motion_physical(factory,unit,cells,256)&&cells==4&&stage_pool_live(pool_before);
    if(!admitted){heap_free(scratch);return false;}
    auto require=[](bool ok,const char *where){if(!ok){std::fprintf(stderr,"[streaming] Selected hero retirement refused boundary=%s\n",where);std::abort();}};
    const uint32_t entries=rd32(manager+0x34),native_counter=rd32(factory+0x28),agent_counter=rd32(runtime+0x34);
    const std::array<uint32_t,4> rng{rd32(runtime+0x20),rd32(runtime+0x24),rd32(0x0071fc70u),rd32(0x0071fc74u)};
    const auto allocated=heap_stats();
    // Remove the original owning GPL membership, then use original actor
    // destruction and deferred script removal. Live containers are never
    // rewritten by the adapter.
    if(!remote){extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t operand=guest_call(&extra,0x0062a810u,5u);
    require(gm_valid(operand,16),"membership-operand");extra.r[R_ECX]=operand;guest_call(&extra,0x006254c0u,agent_id);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);
    extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,5u);
    extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);}
    extra.r[R_ECX]=unit;guest_call(&extra,0x005a21b0u);require(rd32(manager+0x48)==1,"deferred-count");
    extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);qb.omitted=0;drawing.excluded=0;
    const auto remaining=departure_list_state(members,agent_id);
    require(!native(id)&&!script(agent_id)&&script(guild_id)==guild,"retired-aliases");
    if(remote){for(unsigned i=0;i<proxy_header.size();++i)require(rd32(guild+i*4)==proxy_header[i],"remote-home-primary");}
    else require(native(home_id)==home&&remaining.valid&&!remaining.matches&&remaining.count+1==roster.count&&remaining.other_hash==roster.other_hash&&
        !arrival_contains(home,100,unit)&&arrival_home_hash(home,0)==home_contents,"home-and-aliases");
    require(native_registry_snapshot(factory,after)&&after==before&&departure_queues(manager,agent,qa)&&qa==qb&&
        live_drawing(factory,unit)==drawing&&registered_order_members(factory,unit,orders_after)&&!orders_after.matches&&
        orders_after.kept==orders_before.kept&&orders_after.hash==orders_before.hash&&!rd32(manager+0x48)&&
        rd32(manager+0x34)+1==entries&&rd32(factory+0x28)==native_counter&&rd32(runtime+0x34)==agent_counter,"other-world-state");
    const uint32_t grid=rd32(factory+0x88);require(gm_valid(grid,0x50)&&rd32(grid+0x48)==256&&rd32(grid+0x4c)==256,"grid");
    const uint32_t buckets=rd32(grid+0x18);require(gm_valid(buckets,256*256*4),"grid-buckets");
    for(uint32_t cell=0;cell<256*256;++cell){const uint32_t bucket=rd32(buckets+cell*4);if(!bucket)continue;
        require(gm_valid(bucket,32),"grid-bucket");for(uint32_t slot=0;slot<8&&rd32(bucket+slot*4);++slot)
            require(rd32(bucket+slot*4)!=unit,"grid-removal");}
    require(heap_free(scratch),"scratch-release");const auto released=heap_stats();
    require(stage_pool_live(pool_after)&&pool_after<pool_before&&released.used_bytes<allocated.used_bytes&&released.used_blocks<allocated.used_blocks&&
        rd32(0x0071c68c)==world&&rd32(0x0071c6a8)==clock&&rd32(phase)==7&&!rd32(phase+4)&&mods_hooks_installed_count()==hooks&&
        std::array<uint32_t,4>{rd32(runtime+0x20),rd32(runtime+0x24),rd32(0x0071fc70u),rd32(0x0071fc74u)}==rng,"released-resources-clock-rng-hooks");
    if(activated){majesty_browser_streaming_end_hero_arrival();require(!hero_arrival_live.live&&mods_hooks_installed_count()+arrival_hooks==hooks,"arrival-binding-release");}
    std::fprintf(stderr,"[streaming] Selected hero retired unit=%u agent=%u home=%u/%u clock=%u original-removal=1 aliases-absent=1 other-registry-preserved=1 other-queues-preserved=1 other-drawing-preserved=1 other-orders-preserved=1 grid-absent=1 home-preserved=1 counters-preserved=1 rng-preserved=1 released-bytes=%llu released-blocks=%u released-crt=%u owner-published=0 result=pass\n",
        id,agent_id,home_id,guild_id,clock,static_cast<unsigned long long>(allocated.used_bytes-released.used_bytes),allocated.used_blocks-released.used_blocks,pool_before-pool_after);
    if(remote)std::fprintf(stderr,"[streaming] Selected remote hero lifetime ended unit=%u agent=%u proxy=%u clock=%u proxy-primary-preserved=1 arrival-hooks-removed=%u active-binding-ended=1 result=pass\n",id,agent_id,guild_id,clock,arrival_hooks);
    if(activated&&!remote)std::fprintf(stderr,"[streaming] Selected native hero lifetime ended unit=%u agent=%u home=%u/%u clock=%u arrival-hooks-removed=%u active-binding-ended=1 result=pass\n",id,agent_id,home_id,guild_id,clock,arrival_hooks);
    return true;
}

extern "C" bool majesty_browser_streaming_halo_saved_activate(X86 *c,const uint32_t *aliases) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    auto &s=halo_saved_continuation;const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_ACTIVATE"),*arrival=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_ARRIVAL"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(s.stage||!flag||std::strcmp(flag,"v1")||!arrival||std::strcmp(arrival,"v1")||!aliases||!aliases[0]||!aliases[4]||aliases[1]||aliases[2]||aliases[3]||
       path.find("/actor-arrival-fixture-halo-world-session-")==path.npos||!path.ends_with("/native-world-halo/frontier_1_0")||
       !gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||rd32(0x0071c6a8)!=3750||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    auto require=[](bool ok,const char *where){if(!ok){std::fprintf(stderr,"[streaming] Halo saved activation refused boundary=%s\n",where);std::abort();}};
    X86 extra=*c;extra.r[R_ESP]-=32768;s.world=world;s.factory=rd32(world+0x10);s.runtime=guest_call(&extra,0x00623b20u);
    require(gm_valid(s.factory,0x8c)&&gm_valid(s.runtime,0x38),"runtime");s.manager=rd32(s.runtime+4);
    require(gm_valid(s.manager,0x4c)&&!rd32(s.manager+0x48),"manager");
    s.id=aliases[0];s.agent_id=aliases[4];extra.r[R_ECX]=s.factory;s.unit=guest_call(&extra,0x005a10d0u,s.id);
    extra.r[R_ECX]=s.runtime;s.agent=guest_call(&extra,0x006236b0u,s.agent_id);extra.r[R_ECX]=s.runtime;s.proxy=guest_call(&extra,0x006236b0u,34u);
    HomeTaskView view;uint32_t cells=0;s.hooks_before=mods_hooks_installed_count();
    require(gm_valid(s.unit,0x164)&&gm_valid(s.proxy,0x34)&&rd32(s.unit+0x60)==s.id&&rd32(s.unit+0x6c)==0x314c5641&&
        !rd32(s.unit+0x74)&&!(rd32(s.unit+0x64)&4)&&halo_saved_home(view)&&!std::strcmp(view.function,"travel_to"),"identity-home");
    const uint32_t grid=rd32(s.factory+0x88),cx=rd32(s.unit+0x54),cy=rd32(s.unit+0x58);const auto drawing=live_drawing(s.factory,s.unit);
    require(gm_valid(grid,0x50)&&rd32(grid+0x48)==256&&rd32(grid+0x4c)==256&&cx==4&&cy==17&&
        !joint_motion_physical(s.factory,s.unit,cells,256)&&!cells&&drawing.valid&&!drawing.excluded,"spatial-before");
    extra.r[R_ECX]=grid;const uint32_t point[]={s.unit,cx,cy,0x200u,0u,0u};const auto clearance=guest_call_guarded(&extra,0x005b8eb0u,point,6);
    require(clearance.status==GuestCallGuardedStatus::Returned&&!(clearance.eax&255),"collision");
    const uint32_t table=rd32(s.unit),helper=rd32(s.unit+0x18);
    require(rd32(table+0x1b4)==0x005a2370u&&rd32(table+0x1b8)==0x005a2420u&&rd32(table+0x94)==0x005ad3e0u&&
        gm_valid(helper,0x20)&&rd32(helper)==0x0068b4d4&&rd32(helper+0x10)==s.unit,"postload-methods");
    HaloCompletedModel cached{extra,s.unit,helper};
    require(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005b54d0u,0,cached.callback,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,&cached,&cached.handle)==POP_OK,"model-cache");
    extra.r[R_ECX]=s.unit;const auto done=guest_call_guarded(&extra,0x005a2370u,nullptr,0,&cached.cookie);cached.cookie=0;
    require(mods_hook_remove(MODS_OWNER_RUNTIME,cached.handle)==POP_OK&&done.status==GuestCallGuardedStatus::Returned&&(done.eax&255)&&cached.calls==1,"first-postload");
    extra.r[R_ECX]=s.unit;guest_call(&extra,0x005ad3e0u);extra.r[R_ECX]=s.unit;guest_call(&extra,0x005a2420u);
    const auto after=live_drawing(s.factory,s.unit);RegisteredOrderMembers orders{};
    require(joint_motion_physical(s.factory,s.unit,cells,256)&&cells==4&&after.valid&&after.excluded==1&&after.kept==drawing.kept&&after.hash==drawing.hash&&
        registered_order_members(s.factory,s.unit,orders)&&orders.matches==1,"physical-drawing-orders");
    const uint32_t scratch=heap_alloc(512,true),pending=rd32(s.manager+0x3c);DepartureQueues qb{},qa{};
    require(scratch&&(pending==s.manager+0x10||pending==s.manager+0x1c)&&departure_queues(s.manager,s.agent,qb)&&!qb.omitted,"queue-before");
    wr32(scratch+144,s.agent);extra.r[R_ECX]=pending;guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);
    require(departure_queues(s.manager,s.agent,qa)&&qa.omitted==1,"queue-after");qa.omitted=0;require(qa==qb&&heap_free(scratch)&&mods_hooks_installed_count()==s.hooks_before,"preserved-queues");
    for(unsigned k=0;k<3;++k)s.previous[k]=int32_t(rd32(s.unit+0x48+k*4));
    require(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,halo_saved_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)==POP_OK&&
        mods_hook_install_ex(MODS_OWNER_RUNTIME,0x006381b0u,0,halo_saved_context,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.context_hook)==POP_OK&&
        mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,halo_saved_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)==POP_OK,"observers");
    s.stage=1;
    std::fprintf(stderr,"[streaming] Halo saved activated hero=%u agent=%u proxy=34 clock=3750 footprint=4 drawing=1 queued=1 orders-admitted=1 original-collision=1 original-postload=1 completed-model-step-cached=1 remote-route-required=1 owner-published=0 result=pass\n",s.id,s.agent_id);
    return true;
#endif
}
extern "C" bool majesty_browser_streaming_halo_saved_route(X86 *c,uint32_t x,uint32_t y) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    auto &s=halo_saved_continuation;HomeTaskView before,after;
    if(s.stage!=1||s.routed||x!=32||y!=272||rd32(0x0071c6a8)!=3750||!halo_saved_home(before)||
       uint32_t(s.previous[1])/2048!=y||rd32(rd32(s.unit)+0x114)!=0x005b4870u||mods_hook_depth()||!sched_holds_baton())return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;extra.r[R_ECX]=s.unit;const uint32_t args[]={0u,x,y,0u,0u};guest_call(&extra,0x005b4870u,args,5);
    if(!halo_saved_home(after)||after.fingerprint!=before.fingerprint||rd32(0x0071c6a8)!=3750)return false;
    for(unsigned k=0;k<3;++k)if(int32_t(rd32(s.unit+0x48+k*4))!=s.previous[k])return false;
    s.routed=true;
    std::fprintf(stderr,"[streaming] Halo saved home leg hero=%u agent=%u proxy=34 clock=3750 point=32,272 next=0_0 original-command=005b4870 pose-written=0 task-preserved=1 owner-published=0 result=pass\n",s.id,s.agent_id);
    return true;
#endif
}
extern "C" bool majesty_browser_streaming_halo_saved_activation_after_tick(X86 *c) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    auto &s=halo_saved_continuation;const uint32_t clock=rd32(0x0071c6a8),phase=rd32(0x006d7670);
    if(s.stage!=1||!s.routed||rd32(0x0071c68c)!=s.world||!gm_valid(phase,0x50)||rd32(phase)!=3||rd32(phase+4)||
       clock!=s.last+50||clock>6750||mods_hook_depth()||!sched_holds_baton())std::abort();
    s.last=clock;HomeTaskView v;uint32_t cells=0;const auto drawing=live_drawing(s.factory,s.unit);
    if(!halo_saved_home(v)||(rd32(s.unit+0x64)&4)||rd32(s.unit+0x74)||!joint_motion_physical(s.factory,s.unit,cells,256)||cells!=4||
       !drawing.valid||drawing.excluded!=1||++s.samples>60)std::abort();
    for(unsigned k=0;k<3;++k)s.accepted[k]=int32_t(rd32(s.unit+0x48+k*4));
    if(s.accepted[0]>=64*2048){s.previous=s.accepted;return false;}
    if(s.previous[0]<64*2048||s.accepted[0]<32*2048||s.accepted[1]<64*2048||s.accepted[1]>=4032*2048||
       !s.ai||!s.other_ai||!s.contexts||!s.commands)std::abort();
    std::fprintf(stderr,"[streaming] Halo saved continuation crossed hero=%u agent=%u proxy=34 clock=%u previous-clock=%u previous=%d,%d,%d accepted=%d,%d,%d ai=%u other-ai=%u contexts=%u commands=%u ticks=%u original-movement=1 physical=4 drawing=1 task-preserved=1 owner-published=0 result=pass\n",
        s.id,s.agent_id,clock,clock-50,s.previous[0],s.previous[1],s.previous[2],s.accepted[0],s.accepted[1],s.accepted[2],s.ai,s.other_ai,s.contexts,s.commands,s.samples);
    if(mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK||mods_hook_remove(MODS_OWNER_RUNTIME,s.context_hook)!=POP_OK||
       mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK||mods_hooks_installed_count()!=s.hooks_before)std::abort();s.stage=2;
    return true;
#endif
}
extern "C" bool majesty_browser_streaming_halo_saved_retire(X86 *c,uint32_t id,uint32_t agent_id,uint32_t clock) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    auto &s=halo_saved_continuation;const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_RETURN"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");const uint32_t phase=rd32(0x006d7670);
    if(!flag||std::strcmp(flag,"v1")||s.stage!=2||id!=s.id||agent_id!=s.agent_id||clock!=s.last||clock!=4050||
       path.find("/actor-arrival-fixture-halo-world-session-")==path.npos||!path.ends_with("/native-world-halo/frontier_1_0")||
       rd32(0x0071c68c)!=s.world||rd32(0x0071c6a8)!=clock||!gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||
       mods_hook_depth()||!sched_holds_baton()||mods_hooks_installed_count()!=s.hooks_before||rd32(s.manager+0x48)||
       c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    auto require=[](bool ok,const char *where){if(!ok){std::fprintf(stderr,"[streaming] Halo saved retirement refused boundary=%s\n",where);std::abort();}};
    X86 extra=*c;extra.r[R_ESP]-=32768;NativeRegistrySnapshot before{},after{};DepartureQueues qb{},qa{};
    const uint32_t entries=rd32(s.manager+0x34),native_counter=rd32(s.factory+0x28),script_counter=rd32(s.runtime+0x34);
    auto drawing=live_drawing(s.factory,s.unit);HomeTaskView v;uint32_t cells=0;
    require(halo_saved_home(v)&&native_registry_snapshot(s.factory,before,s.unit)&&departure_queues(s.manager,s.agent,qb)&&qb.omitted==1&&
        drawing.valid&&drawing.excluded==1&&joint_motion_physical(s.factory,s.unit,cells,256)&&cells==4,"before");
    const auto allocated=heap_stats();uint32_t pool_before=0,pool_after=0;require(stage_pool_live(pool_before),"pool-before");
    extra.r[R_ECX]=s.unit;guest_call(&extra,0x005a21b0u);require(rd32(s.manager+0x48)==1,"deferred-removal");
    extra.r[R_ECX]=s.manager;guest_call(&extra,0x00633370u);
    extra.r[R_ECX]=s.factory;require(!guest_call(&extra,0x005a10d0u,id),"native-absent");
    extra.r[R_ECX]=s.runtime;require(!guest_call(&extra,0x006236b0u,agent_id),"script-absent");
    extra.r[R_ECX]=s.runtime;require(guest_call(&extra,0x006236b0u,34u)==s.proxy,"proxy-binding");
    qb.omitted=0;drawing.excluded=0;
    require(!rd32(s.manager+0x48)&&rd32(s.manager+0x34)+1==entries&&native_registry_snapshot(s.factory,after)&&after==before&&
        departure_queues(s.manager,s.agent,qa)&&qa==qb&&live_drawing(s.factory,s.unit)==drawing&&
        rd32(s.factory+0x28)==native_counter&&rd32(s.runtime+0x34)==script_counter&&
        !rd32(s.proxy+0x20)&&!rd32(s.proxy+0x24)&&!rd8(s.proxy+0x28),"remaining-world");
    const uint32_t grid=rd32(s.factory+0x88),buckets=rd32(grid+0x18);uint32_t matches=0;
    require(gm_valid(grid,0x50)&&rd32(grid+0x48)==256&&rd32(grid+0x4c)==256&&gm_valid(buckets,256*256*4),"grid");
    for(uint32_t cell=0;cell<256*256;++cell){const uint32_t bucket=rd32(buckets+cell*4);if(!bucket)continue;require(gm_valid(bucket,32),"bucket");
        for(uint32_t slot=0;slot<8&&rd32(bucket+slot*4);++slot)matches+=rd32(bucket+slot*4)==s.unit;}
    const auto released=heap_stats();require(!matches&&stage_pool_live(pool_after)&&pool_after<pool_before&&
        released.used_bytes<=allocated.used_bytes&&released.used_blocks<=allocated.used_blocks,"released-resources");
    require(rd32(0x0071c68c)==s.world&&rd32(0x0071c6a8)==clock&&mods_hooks_installed_count()==s.hooks_before,"clock-hooks");
    std::fprintf(stderr,"[streaming] Halo saved return retired hero=%u agent=%u proxy=34 clock=%u original-removal=1 aliases-absent=1 other-registry-preserved=1 other-queues-preserved=1 other-drawing-preserved=1 grid-absent=1 proxy-preserved=1 counters-preserved=1 released-bytes=%llu released-blocks=%u released-crt=%u owner-published=0 result=pass\n",
        id,agent_id,clock,static_cast<unsigned long long>(allocated.used_bytes-released.used_bytes),allocated.used_blocks-released.used_blocks,pool_before-pool_after);
    s.stage=3;s.unit=s.agent=0;return true;
#endif
}
extern "C" bool majesty_browser_streaming_halo_session_actor_move(X86 *c,uint32_t id,uint32_t agent_id,uint32_t x,uint32_t y) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_MOVE");
    int32_t pose[3]{};uint32_t cells=0;
    if(!flag||std::strcmp(flag,"v1")||x!=4064||y<64||y>=4032||
       !majesty_browser_streaming_halo_session_actor_pose(c,id,agent_id,pose,&cells)||uint32_t(pose[1])/2048!=y)return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;const uint32_t clock=rd32(0x0071c6a8),world=rd32(0x0071c68c),factory=rd32(world+0x10);
    const uint32_t runtime=guest_call(&extra,0x00623b20u);if(!gm_valid(runtime,0x38))return false;
    extra.r[R_ECX]=runtime;const uint32_t agent=guest_call(&extra,0x006236b0u,agent_id);
    extra.r[R_ECX]=factory;const uint32_t unit=guest_call(&extra,0x005a10d0u,id);
    HomeTaskView before,after;
    if(!gm_valid(unit,0x164)||rd32(rd32(unit)+0x114)!=0x005b4870u||
       !home_task_view(agent,before,agent_id,id,7)||!home_text(before.task+8,"go_home")||std::strcmp(before.function,"travel_to")||
       rd32(before.home+8)!=7||rd32(before.target+8)!=7)return false;
    const uint32_t args[]={0u,x,y,0u,0u};extra.r[R_ECX]=unit;guest_call(&extra,0x005b4870u,args,5);
    if(!home_task_view(agent,after,agent_id,id,7)||after.fingerprint!=before.fingerprint||
       rd32(0x0071c6a8)!=clock||rd32(0x0071c68c)!=world)return false;
    for(unsigned k=0;k<3;++k)if(int32_t(rd32(unit+0x48+k*4))!=pose[k])return false;
    std::fprintf(stderr,"[streaming] Halo session original move hero=%u agent=%u clock=%u point=%u,%u original-command=005b4870 pose-written=0 task-preserved=1 ungated-ai=1 result=pass\n",id,agent_id,clock,x,y);
    return true;
#endif
}
// Private native driver for the PRODUCTION crossing sampler. Issue the
// original move virtual once; never write a pose, clock or script context.
extern "C" bool majesty_browser_streaming_selected_hero_test_move(X86 *c,const uint32_t *binding) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag=recomp_env("BROWSER_FRONTIER_SELECTED_HERO_MOVE"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");
    if(!flag||std::strcmp(flag,"v1")||path.find("/actor-arrival-fixture-hero-binding-")==path.npos||
       !path.ends_with("/frontier_0_0")||!binding||!majesty_browser_streaming_selected_hero_ready(c,binding))return false;
    int32_t pose[3]{};uint32_t cells=0;
    if(!majesty_browser_streaming_selected_hero_pose(c,binding,pose,&cells))return false;
    const uint32_t y=uint32_t(pose[1])/2048,x=4064,id=binding[1],agent_id=binding[2],guild_id=binding[6];
    if(y<64||y>=4032||pose[0]<64*2048||pose[0]>=4032*2048)return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t clock=rd32(0x0071c6a8),world=rd32(0x0071c68c),factory=rd32(world+0x10),hooks=mods_hooks_installed_count();
    const uint32_t runtime=guest_call(&extra,0x00623b20u);if(!gm_valid(runtime,0x38))return false;
    extra.r[R_ECX]=runtime;const uint32_t agent=guest_call(&extra,0x006236b0u,agent_id);
    extra.r[R_ECX]=factory;const uint32_t unit=guest_call(&extra,0x005a10d0u,id);
    HomeTaskView before,after;
    if(!gm_valid(unit,0x164)||!gm_valid(rd32(unit),0x118)||rd32(rd32(unit)+0x114)!=0x005b4870u||
       !home_task_view(agent,before,agent_id,id,guild_id)||!home_text(before.task+8,"go_home")||
       std::strcmp(before.function,"travel_to")||rd32(before.home+8)!=guild_id||rd32(before.target+8)!=guild_id)return false;
    const uint32_t args[]={0u,x,y,0u,0u};extra.r[R_ECX]=unit;guest_call(&extra,0x005b4870u,args,5);
    if(!home_task_view(agent,after,agent_id,id,guild_id)||after.fingerprint!=before.fingerprint||
       rd32(0x0071c6a8)!=clock||rd32(0x0071c68c)!=world||mods_hooks_installed_count()!=hooks)return false;
    for(unsigned k=0;k<3;++k)if(int32_t(rd32(unit+0x48+k*4))!=pose[k])return false;
    std::fprintf(stderr,"[streaming] Selected hero original move unit=%u agent=%u clock=%u point=%u,%u original-command=005b4870 pose-written=0 task-preserved=1 ungated-ai=1 result=pass\n",id,agent_id,clock,x,y);
    return true;
#endif
}
extern "C" bool majesty_browser_streaming_halo_session_retire(X86 *c,uint32_t hero_id,uint32_t agent_id,
    uint32_t home_id,uint32_t guild_id,const uint32_t *children,uint32_t count) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_RETIRE"),*profile=recomp_env("PROFILE_DIR"),
        *session=recomp_env("BROWSER_FRONTIER_HALO_SESSION"),*actor=recomp_env("BROWSER_FRONTIER_HALO_SESSION_ACTOR");
    const std::string_view path(profile?profile:"");
    if(!flag||std::strcmp(flag,"v1")||!session||std::strcmp(session,"v1")||!actor||std::strcmp(actor,"v1")||
       path.find("/actor-arrival-fixture-halo-world-session-")==path.npos||
       !path.ends_with("/native-world-halo/frontier_0_0")||!hero_id||!agent_id||home_id!=469||guild_id!=7||
       count>3||(count&&!children)||mods_hook_depth()||!sched_holds_baton()||
       c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c),clock=rd32(0x0071c6a8),hooks=mods_hooks_installed_count();
    if(!gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||!gm_valid(world,0x14))return false;
    X86 extra=*c;extra.r[R_ESP]-=32768;const uint32_t factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(factory,0x8c)||!gm_valid(runtime,0x38))return false;const uint32_t manager=rd32(runtime+4);
    if(!gm_valid(manager,0x4c)||rd32(manager+0x48))return false;
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    auto script=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    std::array<uint32_t,4> ids{},units{};ids[0]=hero_id;
    for(uint32_t i=0;i<count;++i){ids[i+1]=children[i];if(!children[i]||children[i]==home_id)return false;
        for(uint32_t j=0;j<=i;++j)if(ids[j]==children[i])return false;}
    for(uint32_t i=0;i<=count;++i){units[i]=native(ids[i]);
        if(!gm_valid(units[i],0x164)||rd32(units[i])!=0x0068098cu||(rd32(units[i]+0x64)&4)||
           rd32(units[i]+0x74)!=(i?hero_id:0u)||rd32(units[i]+0x84)!=factory)return false;}
    if(rd32(units[0]+0x6c)!=0x314c5641u)return false;
    const uint32_t agent=script(agent_id),guild=script(guild_id),home=native(home_id);
    if(!gm_valid(agent,0x34)||!gm_valid(guild,0x34)||!gm_valid(home,0x98)||rd32(agent+0x20)!=hero_id||
       rd32(guild+0x20)!=home_id||rd32(home+0x6c)!=0x31564241u||!arrival_contains(home,100,units[0])||
       !arrival_contains(units[0],101,home))return false;
    for(uint32_t i=1;i<=count;++i)if(!arrival_contains(units[0],1,units[i]))return false;
    // The held snapshot declares the complete family. Refuse any additional
    // native child before invoking removal, even if it has no GPL association.
    const uint32_t container=rd32(units[0]+0x94);
    if(!gm_valid(container,16))return false;
    const uint32_t first=rd32(container+4),last=rd32(container+8);uint32_t child_members=0,child_groups=0;
    if(last<first||last-first>4096||(last-first)%4||!gm_valid(first,last-first))return false;
    for(uint32_t at=first;at!=last;at+=4){const uint32_t group=rd32(at);
        if(!gm_valid(group,0x18)||rd32(group)!=units[0])return false;if(rd32(group+4)!=1)continue;
        ++child_groups;const uint32_t begin=rd32(group+0xc),end=rd32(group+0x10);
        if(end<begin||(end-begin)%8||end-begin>24||!gm_valid(begin,end-begin))return false;
        child_members+=(end-begin)/8;
        for(uint32_t item=begin;item!=end;item+=8){uint32_t found=0;
            for(uint32_t i=1;i<=count;++i)found+=rd32(item)==units[i];
            if(found!=1||(rd32(item+4)&1))return false;}
    }
    if(child_members!=count||child_groups>1)return false;
    const uint32_t scratch=heap_alloc(512,true);if(!scratch)return false;
    const uint32_t members=departure_list(extra,scratch,guild,"members"),entries=rd32(manager+0x34),
        native_counter=rd32(factory+0x28),script_counter=rd32(runtime+0x34);
    const auto roster=departure_list_state(members,agent_id);DepartureQueues before_queues{},after_queues{};NativeRegistrySnapshot before{},after{};
    if(!roster.valid||roster.count!=1||roster.matches!=1||!departure_queues(manager,agent,before_queues)||before_queues.omitted!=1||
       !native_registry_snapshot(factory,before,0,units.data(),count+1)){heap_free(scratch);return false;}
    // Use the same original owning-list and gameplay-removal methods as the
    // qualified outward/homeward handoffs. Never rewrite the live containers.
    extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t operand=guest_call(&extra,0x0062a810u,5u);if(!gm_valid(operand,16))std::abort();
    extra.r[R_ECX]=operand;guest_call(&extra,0x006254c0u,agent_id);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);
    extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,5u);
    extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);
    for(uint32_t i=count+1;i--;){extra.r[R_ECX]=units[i];guest_call(&extra,0x005a21b0u);}
    extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);before_queues.omitted=0;
    const auto empty=departure_list_state(members,agent_id);
    for(uint32_t i=0;i<=count;++i)if(native(ids[i]))std::abort();
    if(script(agent_id)||native(home_id)!=home||script(guild_id)!=guild||!empty.valid||empty.count||empty.matches||empty.other_hash!=roster.other_hash||
       !native_registry_snapshot(factory,after)||before!=after||!departure_queues(manager,agent,after_queues)||after_queues!=before_queues||
       rd32(manager+0x34)+1!=entries||rd32(manager+0x48)||rd32(factory+0x28)!=native_counter||rd32(runtime+0x34)!=script_counter||
       rd32(0x0071c68c)!=world||rd32(0x0071c6a8)!=clock||rd32(phase)!=7||rd32(phase+4)||mods_hooks_installed_count()!=hooks||!heap_free(scratch))std::abort();
    std::fprintf(stderr,"[streaming] Halo session actor retired unit=%u agent=%u children=%u clock=%u phase=7 aliases-absent=1 roster-empty=1 other-registry-preserved=1 other-queues-preserved=1 original-removal=1 owner-published=0 result=pass\n",hero_id,agent_id,count,clock);
    return true;
#endif
}

namespace {
// Actual accepted east-to-home crossing. Read the saved Move/Path/Queue banks
// unchanged through owned original storage; never substitute an empty bank or
// reset the in-flight route. This held import trial retires its private clone
// before another tick. Collision/activation and paired publication are separate.
struct HaloHomewardLive {
    uint32_t stage=0,world=0,factory=0,runtime=0,manager=0,unit=0,agent=0,home=0,guild=0,id=0,agent_id=0;
    uint32_t start=84550,last=84550,hooks_before=0,agent_hook=0,context_hook=0,command_hook=0;
    uint32_t ai=0,other_ai=0,contexts=0,building=0,commands=0,samples=0,after_ticks=0,required_ticks=200;
    bool reloaded=false,saved_reloaded=false;
    std::array<uint32_t,5> initial{};
} halo_homeward_live;
static void halo_homeward_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_homeward_live;const bool own=s.stage==1&&cpu->ecx==s.agent;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.stage==1){auto &n=own?s.ai:s.other_ai;if(++n>65536)std::abort();}
}
static void halo_homeward_context(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_homeward_live;const bool own=s.stage==1&&rd32(0x00720304u)==s.agent;
    const bool building=own&&gm_valid(cpu->ecx,24)&&home_text(cpu->ecx,"use_building");
    if(building&&!s.building){HomeTaskView view;
        if(!home_task_view(s.agent,view,s.agent_id,s.id,7)||!view.going_home)std::abort();}
    // Observers always continue the original method, including native building
    // use. No remote proxy gate or substituted task is present in the home.
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(own&&++s.contexts>65536)std::abort();if(building&&++s.building>4096)std::abort();
}
static void halo_homeward_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_homeward_live;const bool own=s.stage==1&&gm_valid(cpu->ecx,8)&&rd32(cpu->ecx+4)==s.unit;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();if(own&&++s.commands>65536)std::abort();
}
static bool arm_halo_homeward_live(X86 &extra,uint32_t scratch,uint32_t world,uint32_t factory,uint32_t runtime,
    uint32_t manager,uint32_t unit,uint32_t agent,uint32_t home,uint32_t guild,uint32_t id,uint32_t agent_id) {
    const char *flag=recomp_env("BROWSER_STREAMING_HALO_HOMEWARD_ACTIVATE");if(!flag)return false;
    auto &s=halo_homeward_live;
    if(std::strcmp(flag,"1")||s.stage||rd32(0x0071c6a8)!=84550||mods_hook_depth()||!sched_holds_baton())std::abort();
    s.world=world;s.factory=factory;s.runtime=runtime;s.manager=manager;s.unit=unit;s.agent=agent;s.home=home;s.guild=guild;
    s.id=id;s.agent_id=agent_id;s.hooks_before=mods_hooks_installed_count();s.initial=home_motion_position(unit);
    HomeTaskView view;uint32_t cells=0;const uint32_t grid=rd32(factory+0x88),cx=rd32(unit+0x54),cy=rd32(unit+0x58);
    const auto before_drawing=live_drawing(factory,unit);
    if(!home_task_view(agent,view,agent_id,id,7)||!view.going_home||!arrival_contains(unit,101,home)||!arrival_contains(home,100,unit)||
       !gm_valid(grid,0x50)||rd32(grid+0x48)!=256||rd32(grid+0x4c)!=256||cx!=251||cy!=7||
       joint_motion_physical(factory,unit,cells,256)||cells||!before_drawing.valid||before_drawing.excluded)std::abort();
    extra.r[R_ECX]=grid;const uint32_t args[]={unit,cx,cy,0x200u,0u,0u};const auto clearance=guest_call_guarded(&extra,0x005b8eb0u,args,6);
    if(clearance.status!=GuestCallGuardedStatus::Returned||(clearance.eax&255)){
        std::fprintf(stderr,"[streaming] Halo homeward activation refused boundary=collision cell=%u,%u result=fail\n",cx,cy);std::abort();}
    const uint32_t table=rd32(unit),helper=rd32(unit+0x18);
    if(rd32(table+0x1b4)!=0x005a2370u||rd32(table+0x1b8)!=0x005a2420u||rd32(table+0x94)!=0x005ad3e0u||
       !gm_valid(helper,0x20)||rd32(helper)!=0x0068b4d4||rd32(helper+0x10)!=unit)std::abort();
    // The immediately preceding import already resolved the saved model once.
    // Complete only the remaining original postload work with its guarded cookie.
    HaloCompletedModel cached{extra,unit,helper};
    if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005b54d0u,0,cached.callback,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,&cached,&cached.handle)!=POP_OK)std::abort();
    extra.r[R_ECX]=unit;const auto done=guest_call_guarded(&extra,0x005a2370u,nullptr,0,&cached.cookie);cached.cookie=0;
    if(mods_hook_remove(MODS_OWNER_RUNTIME,cached.handle)!=POP_OK||done.status!=GuestCallGuardedStatus::Returned||!(done.eax&255)||cached.calls!=1)std::abort();
    extra.r[R_ECX]=unit;guest_call(&extra,0x005ad3e0u);extra.r[R_ECX]=unit;guest_call(&extra,0x005a2420u);
    const auto after_drawing=live_drawing(factory,unit);RegisteredOrderMembers before{},after{};
    if(!joint_motion_physical(factory,unit,cells,256)||cells!=4||!after_drawing.valid||after_drawing.excluded!=1||
       after_drawing.kept!=before_drawing.kept||after_drawing.hash!=before_drawing.hash||
       !registered_order_members(factory,unit,before)||before.matches!=1||rd32(table+0xa4)!=0x005b66f0u)std::abort();
    extra.r[R_ECX]=unit;guest_call(&extra,0x005b66f0u,0x5244524fu);
    if(!registered_order_members(factory,unit,after)||after.matches!=before.matches||after.kept!=before.kept||after.hash!=before.hash)std::abort();
    const uint32_t pending=rd32(manager+0x3c);DepartureQueues qbefore{},qafter{};
    if((pending!=manager+0x10&&pending!=manager+0x1c)||!departure_queues(manager,agent,qbefore)||qbefore.omitted)std::abort();
    wr32(scratch+144,agent);extra.r[R_ECX]=pending;guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);
    if(!departure_queues(manager,agent,qafter)||qafter.omitted!=1)std::abort();qafter.omitted=0;
    if(qafter!=qbefore||home_motion_position(unit)!=s.initial||rd32(0x0071c6a8)!=84550||mods_hooks_installed_count()!=s.hooks_before||
       !majesty_browser_frontier_halo_homeward_checkpoint(&extra,3))std::abort();
    if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,halo_homeward_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x006381b0u,0,halo_homeward_context,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.context_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,halo_homeward_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK)std::abort();
    s.stage=1;
    std::fprintf(stderr,"[streaming] Halo homeward activated hero=%u agent=%u home=469/7 clock=84550 footprint=4 drawing=1 queued=1 orders-admitted=1 original-collision=1 original-first-postload=1 completed-model-step-cached=1 original-second-postload=1 ungated-ai=1 ready-saved=1 owner-published=0 result=pass\n",id,agent_id);
    return true;
}
// The original full-world reader already restores spatial membership, drawing,
// command storage and AI queues. Observe that state without reimport/postload.
static void original_halo_homeward_owner_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    auto &s=halo_homeward_live;const char *saved=recomp_env("BROWSER_STREAMING_HALO_SAVED_HOME_OWNER"),*legacy=recomp_env("BROWSER_STREAMING_HALO_HOMEWARD_OWNER"),*flag=saved?saved:legacy;
    if(!flag||s.stage)return;
    if(saved&&legacy)std::abort();s.saved_reloaded=saved!=nullptr;
    const char *profile=recomp_env("PROFILE_DIR"),*binding=recomp_env(saved?"BROWSER_STREAMING_HALO_SAVED_HOME_OWNER_BINDING":"BROWSER_STREAMING_HALO_HOMEWARD_OWNER_BINDING");
    std::string_view path(profile?profile:"");constexpr std::string_view suffix="/frontier_0_0";
    if(std::strcmp(flag,"1")||!path.ends_with(suffix)||!binding||std::strlen(binding)!=64||!enabled()||
       recomp_env("BROWSER_STREAMING_HALO_HOMEWARD_IMPORT")||recomp_env("BROWSER_FRONTIER_HALO_SESSION")||recomp_env("RULE_FRONTIER_CHAPTER"))std::abort();
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');const auto owned=path.substr(slash==path.npos?0:slash+1);
    if(!owned.starts_with(saved?"actor-arrival-fixture-halo-world-saved-home-owner-":"actor-arrival-fixture-halo-world-homeward-owner-")||owned.size()>80)std::abort();
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c),clock=rd32(0x0071c6a8);
    if(!gm_valid(phase,0x50)||rd32(phase)!=3||!gm_valid(world,0x14))return;
    if(rd32(phase+4)||mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)std::abort();
    char filename[1024];std::array<uint32_t,9> ids{};const uint32_t bytes=saved?36u:32u;
    if(!recomp_writable_path(saved?"Halo_Saved_Home_Owner.ids":"Halo_Homeward_Owner.ids",filename,sizeof filename)||loader_hash_file_bounded(filename,bytes)!=binding)std::abort();
    FILE *f=std::fopen(filename,"rb");if(!f)std::abort();
    const bool read=std::fread(ids.data(),1,bytes,f)==bytes&&std::fgetc(f)==EOF&&!std::ferror(f),closed=std::fclose(f)==0;
    const auto expected=saved?std::array<uint32_t,9>{0x3153484fu,1,113500,114000,513,29,469,7,8}:std::array<uint32_t,9>{0x314f5748u,1,94550,95050,508,25,469,7,0};
    if(!read||!closed||ids!=expected||clock!=ids[2])std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;
    s.world=world;s.factory=rd32(world+0x10);s.runtime=guest_call(&extra,0x00623b20u);
    if(!gm_valid(s.factory,0x8c)||!gm_valid(s.runtime,0x38))std::abort();s.manager=rd32(s.runtime+4);
    if(!gm_valid(s.manager,0x4c)||rd32(s.manager+0x48))std::abort();
    auto native=[&](uint32_t id){extra.r[R_ECX]=s.factory;return guest_call(&extra,0x005a10d0u,id);};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=s.runtime;return guest_call(&extra,0x006236b0u,id);};
    s.id=ids[4];s.agent_id=ids[5];s.unit=native(s.id);s.agent=lookup(s.agent_id);s.home=native(ids[6]);s.guild=lookup(ids[7]);
    s.start=s.last=clock;s.required_ticks=10;s.reloaded=true;s.hooks_before=mods_hooks_installed_count();
    HomeTaskView view;uint32_t cells=0;DepartureQueues q{};RegisteredOrderMembers orders{};
    if(!gm_valid(s.unit,0x98)||!gm_valid(s.agent,0x34)||!gm_valid(s.home,0x98)||!gm_valid(s.guild,0x34)||
       native(saved?508u:496u)||lookup(saved?25u:22u)||!home_task_view(s.agent,view,s.agent_id,s.id,7)||
       rd32(view.home+8)!=7||rd32(view.target+8)!=7||!home_text(view.task+8,"go_home")||std::strcmp(view.function,"travel_to")||
       rd32(s.unit+0x64)&4||rd32(s.unit+0x74)||rd32(s.home+0x6c)!=0x31564241||rd32(s.guild+0x20)!=469||
       !arrival_contains(s.unit,101,s.home)||!arrival_contains(s.home,100,s.unit)||
       !joint_motion_physical(s.factory,s.unit,cells,256)||cells!=4||live_drawing(s.factory,s.unit).excluded!=1||
       !departure_queues(s.manager,s.agent,q)||q.omitted!=1||!registered_order_members(s.factory,s.unit,orders)||orders.matches!=1)std::abort();
    s.initial=home_motion_position(s.unit);
    auto checkpoint=[&](unsigned stage){return saved?majesty_browser_frontier_halo_saved_home_owner_checkpoint(&extra,stage):majesty_browser_frontier_halo_homeward_owner_checkpoint(&extra,stage);};
    if(!checkpoint(0)||!checkpoint(1)||rd32(0x0071c6a8)!=clock||
       mods_hooks_installed_count()!=s.hooks_before)std::abort();
    if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,halo_homeward_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x006381b0u,0,halo_homeward_context,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.context_hook)!=POP_OK||
       mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,halo_homeward_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK)std::abort();
    s.stage=1;
    std::fprintf(stderr,"[streaming] Halo %s owner reloaded hero=%u agent=%u home=469/7 clock=%u revision=%u footprint=4 drawing=1 queued=1 orders-admitted=1 imported=0 postload-replayed=0 queue-inserted=0 ungated-ai=1 original-reader=1 owner-published=0 result=pass\n",saved?"saved home":"homeward",s.id,s.agent_id,clock,saved?8u:6u);
#endif
}
static void halo_homeward_live_frame(X86 *c) {
#ifndef __EMSCRIPTEN__
    auto &s=halo_homeward_live;if(s.stage!=1)return;const uint32_t clock=rd32(0x0071c6a8),phase=rd32(0x006d7670);
    if(clock==s.last)return;
    if(rd32(0x0071c68c)!=s.world||!gm_valid(phase,0x50)||rd32(phase)!=3||rd32(phase+4)||clock!=s.last+50||clock>s.start+s.required_ticks*50||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;s.last=clock;++s.samples;
    auto native=[&](uint32_t id){extra.r[R_ECX]=s.factory;return guest_call(&extra,0x005a10d0u,id);};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=s.runtime;return guest_call(&extra,0x006236b0u,id);};
    if(native(s.id)!=s.unit||lookup(s.agent_id)!=s.agent||native(469)!=s.home||lookup(7)!=s.guild||rd32(s.unit+0x64)&4)std::abort();
    const uint32_t parent=rd32(s.unit+0x74);uint32_t cells=0;const auto drawing=live_drawing(s.factory,s.unit);DepartureQueues q{};
    const bool physical=parent==469||(!parent&&joint_motion_physical(s.factory,s.unit,cells,256)&&cells==4);
    if(!physical||!drawing.valid||drawing.excluded>1||!departure_queues(s.manager,s.agent,q)||q.omitted!=1||
       !arrival_contains(s.unit,101,s.home)||!arrival_contains(s.home,100,s.unit))std::abort();
    if(clock<s.start+s.required_ticks*50)return;
    const bool moved=home_motion_position(s.unit)!=s.initial;
    std::fprintf(stderr,"[streaming] Halo %s endpoint clock=%u ticks=%u ai=%u other-ai=%u contexts=%u building=%u commands=%u moved=%u parent=%u cells=%u drawing=%u\n",s.saved_reloaded?"saved home owner":s.reloaded?"homeward owner":"homeward",clock,s.samples,s.ai,s.other_ai,s.contexts,s.building,s.commands,unsigned(moved),parent,cells,drawing.excluded);
    if(s.samples!=s.required_ticks||!s.ai||!s.other_ai||!s.contexts||(!s.reloaded&&!s.building)||!s.commands||!moved)std::abort();
    if(mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK||mods_hook_remove(MODS_OWNER_RUNTIME,s.context_hook)!=POP_OK||
       mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK||mods_hooks_installed_count()!=s.hooks_before||
       !(s.saved_reloaded?majesty_browser_frontier_halo_saved_home_owner_checkpoint(&extra,2):s.reloaded?majesty_browser_frontier_halo_homeward_owner_checkpoint(&extra,2):
         majesty_browser_frontier_halo_homeward_checkpoint(&extra,4)))std::abort();
    extra.r[R_ECX]=phase;guest_call(&extra,0x00416050u,7u);
    if(rd32(phase)!=3||rd32(phase+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();s.stage=2;
    if(s.saved_reloaded)std::fprintf(stderr,"[streaming] Halo saved home owner evolved hero=%u agent=%u home=469/7 clock=%u ticks=10 original-ai=1 original-commands=1 moved=1 parent=%u queued=1 reciprocal-rosters=1 evolved-saved=1 hooks-removed=1 original-pause=1 owner-published=0 result=pass\n",s.id,s.agent_id,clock,parent);
    else if(s.reloaded)std::fprintf(stderr,"[streaming] Halo homeward owner evolved hero=%u agent=%u home=469/7 clock=%u ticks=10 original-ai=1 original-commands=1 moved=1 parent=%u queued=1 reciprocal-rosters=1 evolved-saved=1 hooks-removed=1 original-pause=1 owner-published=0 result=pass\n",s.id,s.agent_id,clock,parent);
    else std::fprintf(stderr,"[streaming] Halo homeward evolved hero=%u agent=%u home=469/7 clock=%u ticks=200 original-ai=1 ungated-building-use=1 original-commands=1 moved=1 parent=%u queued=1 reciprocal-rosters=1 evolved-saved=1 hooks-removed=1 original-pause=1 owner-published=0 result=pass\n",s.id,s.agent_id,clock,parent);
#endif
}
// Restore the actual accepted saved-east return through original readers.
// This native fixture stops before scheduling, activation or custody publication.
extern "C" bool majesty_browser_streaming_halo_saved_home_arrival(X86 *c,const char *binding,uint32_t *aliases) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_HOME_ARRIVAL"),
        *returned=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_RETURN"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!flag||std::strcmp(flag,"v1")||!returned||std::strcmp(returned,"v1")||!binding||std::strlen(binding)!=64||!aliases||
       path.find("/actor-arrival-fixture-halo-world-session-")==path.npos||!path.ends_with("/native-world-halo/frontier_0_0")||
       !gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP){std::fprintf(stderr,"[streaming] Halo saved home arrival refused boundary=admission\n");return false;}
    auto require=[](bool ok,const char *where){if(!ok){std::fprintf(stderr,"[streaming] Halo saved home arrival refused boundary=%s\n",where);std::abort();}};
    X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t clock=rd32(0x0071c6a8),factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    require(clock==103500&&gm_valid(factory,0x8c)&&gm_valid(runtime,0x38),"epoch");
    const uint32_t manager=rd32(runtime+4),hooks=mods_hooks_installed_count(),counter=rd32(factory+0x28),reserved=rd32(runtime+0x34);
    require(gm_valid(manager,0x4c)&&!rd32(manager+0x48)&&reserved>25&&reserved<0x7ffffffe,"manager");
    const uint32_t entries=rd32(manager+0x34);const auto queues=pair_queues(manager);const auto rendering=pair_rendering(factory);
    NativeRegistrySnapshot before;require(rendering.valid&&native_registry_snapshot(factory,before),"registry");
    char pathbuf[1024];
    require(binding&&std::strlen(binding)==64&&recomp_writable_path("Halo_Saved_Home_Arrival.pack",pathbuf,sizeof pathbuf)&&
        loader_hash_file_bounded(pathbuf,3016)==binding,"binding");
    OsStat packStat{};require(!os_lstat(pathbuf,&packStat)&&packStat.is_regular&&!packStat.is_symlink&&packStat.size==3016,"pack-file");
    std::array<uint8_t,3016> pack{};FILE *f=std::fopen(pathbuf,"rb");require(f!=nullptr,"open");
    const bool read=std::fread(pack.data(),1,pack.size(),f)==pack.size()&&std::fgetc(f)==EOF&&!std::ferror(f);
    const bool closed=std::fclose(f)==0;require(read&&closed,"read");
    constexpr uint32_t header[]={0x31524848,1,4,4050,103500,537,37,469,7,100000,1000,2920};
    constexpr uint32_t sizes[]={442,1850,84,544},tags[]={0,1,2,3};
    require(!std::memcmp(pack.data(),header,sizeof header),"header");
    std::array<std::unique_ptr<PrimaryBytes>,4> records;size_t at=sizeof header;
    for(unsigned k=0;k<4;++k){uint32_t descriptor[3]{};std::memcpy(descriptor,pack.data()+at,12);at+=12;
        require(descriptor[0]==tags[k]&&descriptor[1]==537&&descriptor[2]==sizes[k]&&at+sizes[k]<=pack.size(),"descriptor");
        records[k]=std::make_unique<PrimaryBytes>();std::memcpy(records[k]->data(),pack.data()+at,sizes[k]);at+=sizes[k];}
    require(at==pack.size(),"pack-end");
    auto &hero=*records[0],&script=*records[1],&container=*records[2],&order=*records[3];
    size_t ea=0;PairPlan plan;majesty::orders::PayloadPlan banks;
    require(pair_word(hero,36)==100000&&pair_word(hero,40)==512&&pair_word(hero,48)==0x314c5641&&
        !pair_word(hero,52)&&!pair_word(hero,56)&&pair_word(hero,60)==8246527&&pair_word(hero,64)==557056&&
        pair_word(hero,68)==85977&&pair_word(hero,72)==251&&pair_word(hero,76)==17&&
        pair_native_ea(hero,sizes[0],1000,ea)&&pair_agent_plan(script,sizes[1],1000,100000,plan),"actor");
    for(size_t j=0;j<plan.count;++j)require(plan.references[j].before==1000||plan.references[j].before==7,"script-references");
    require(pair_word(order,0)==100000&&!std::memcmp(order.data()+4,"ORDR",4)&&!std::memcmp(order.data()+20,"PRIM",4)&&
        majesty::orders::plan_order_payload(order.data()+36,508,banks)&&banks.entry_count==3&&
        banks.bank_counts==std::array<uint32_t,3>{2,1,0}&&banks.entries[0].kind==2&&banks.entries[1].kind==4&&banks.entries[2].kind==7,"orders");
    constexpr uint32_t home_container[]={1,2,1,1,101,100000,469,1,1,0,1,100000};
    require(pair_word(container,0)==100000&&!std::memcmp(container.data()+4,"CONT",4)&&
        !std::memcmp(container.data()+36,home_container,sizeof home_container),"container");
    const uint32_t scratch=heap_alloc(512,true);require(scratch!=0,"scratch");
    auto write=[&](const char *n,const PrimaryBytes &b,size_t bytes){return recomp_writable_path(n,pathbuf,sizeof pathbuf)&&pair_write(pathbuf,b,bytes);};
    auto load=[&](const char *n,PrimaryBytes &b,size_t bytes){size_t found=0;return recomp_writable_path(n,pathbuf,sizeof pathbuf)&&arrival_bytes(pathbuf,b,found)&&found==bytes;};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    const uint32_t home=native(469),guild=lookup(7);
    require(gm_valid(home,0x98)&&gm_valid(guild,0x34)&&rd32(home+0x6c)==0x31564241&&rd32(guild+0x20)==469&&
        !native(508)&&!lookup(25)&&!lookup(reserved),"home");
    const uint32_t members=departure_list(extra,scratch,guild,"members");const auto roster=departure_list_state(members,reserved);
    require(roster.valid&&!roster.count&&!roster.matches&&agent_file(extra,scratch,"Halo_Saved_Home_Arrival_Guild_Before.GPL",guild,true)==0,"before-save");
    const uint32_t agent=guest_call(&extra,0x0064c616u,0x34u);require(gm_valid(agent,0x34),"agent-allocation");
    extra.r[R_ECX]=agent;guest_call(&extra,0x00625e70u);
    require(rd32(agent+0x10)==reserved&&rd32(runtime+0x34)==reserved+1,"agent-reservation");
    pair_put(hero,36,0);pair_put(hero,ea,reserved);
    require(write("Halo_Saved_Home_Arrival_Unit_Input.UNIT",hero,sizes[0]),"unit-input");
    majesty::actors::UnitStage stage;const majesty::actors::StageInput input{512,0,0x314c5641,0};
    uint32_t status=UINT32_MAX,id=0;const bool installed=stage.install();
    const uint32_t unit=installed?primary_file(extra,scratch,"Halo_Saved_Home_Arrival_Unit_Input.UNIT",factory,0,false,&status,true,&stage,&input):0;
    require(stage.remove(),"stage-remove");
    std::fprintf(stderr,"[streaming] Halo saved home arrival stage status=%08x complete=%u failure=%u\n",status,unsigned(installed&&unit&&!status),unsigned(stage.failure()));
    std::array<uint32_t,32> addresses{};uint32_t count=0;
    require(installed&&!status&&unit&&restore_private_family_orders(extra,unit,order.data()+36,508,addresses,count)&&
        publish_native_identity(extra,factory,unit,id),"native-reader");pair_put(hero,36,id);pair_put(order,0,id);
    pair_put(script,plan.identity,reserved);pair_put(script,plan.native,id);
    for(size_t j=0;j<plan.count;++j)if(plan.references[j].before==1000)pair_put(script,plan.references[j].offset,reserved);
    require(write("Halo_Saved_Home_Arrival_Agent_Input.GPL",script,sizes[1])&&agent_file(extra,scratch,"Halo_Saved_Home_Arrival_Agent_Input.GPL",agent,false)==0,"script-reader");
    wr32(scratch+144,reserved);wr32(scratch+148,agent);extra.r[R_ECX]=manager+0x28;guest_call(&extra,0x00634460u,scratch+128,scratch+144);
    require(rd8(scratch+132)==1&&lookup(reserved)==agent&&rd32(manager+0x34)==entries+1,"script-register");
    extra.r[R_ECX]=agent;require(guest_call(&extra,0x00626310u)==unit,"native-backlink");
    std::memmove(container.data(),container.data()+36,48);pair_put(container,20,id);pair_put(container,44,id);
    require(write("Halo_Saved_Home_Arrival_Container_Input.bin",container,48)&&
        arrival_container_file(extra,scratch,"Halo_Saved_Home_Arrival_Container_Input.bin",factory,unit,false)==0&&arrival_contains(unit,101,home),"container-reader");
    extra.r[R_ECX]=home+0x94;require((guest_call(&extra,0x00598e20u,unit,home,100u)&255)&&arrival_contains(home,100,unit),"native-roster");
    extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t operand=guest_call(&extra,0x0062a810u,5u);require(operand!=0,"roster-operand");
    extra.r[R_ECX]=operand;guest_call(&extra,0x006254c0u,reserved);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,4u);
    const auto added=departure_list_state(members,reserved);HomeTaskView view;
    require(added.valid&&added.count==1&&added.matches==1&&added.other_hash==roster.other_hash&&
        home_task_view(agent,view,reserved,id,7)&&rd32(view.home+8)==7&&rd32(view.target+8)==7&&
        home_text(view.task+8,"go_home")&&!std::strcmp(view.function,"travel_to"),"script-roster");
    const uint32_t helper=rd32(unit+0x18);require(gm_valid(helper,0x20)&&rd32(helper)==0x0068b4d4&&rd32(rd32(helper)+4)==0x005b54d0,"model");
    extra.r[R_ECX]=helper;require((guest_call(&extra,0x005b54d0u)&255)!=0,"model-resolve");
    auto observed=std::make_unique<PrimaryBytes>();
    require(primary_file(extra,scratch,"Halo_Saved_Home_Arrival_Unit_Observed.UNIT",factory,unit,true,nullptr,true)&&
        load("Halo_Saved_Home_Arrival_Unit_Observed.UNIT",*observed,sizes[0])&&!std::memcmp(hero.data(),observed->data(),sizes[0]),"unit-exact");
    require(agent_file(extra,scratch,"Halo_Saved_Home_Arrival_Agent_Observed.GPL",agent,true)==0&&load("Halo_Saved_Home_Arrival_Agent_Observed.GPL",*observed,sizes[1])&&
        !std::memcmp(script.data(),observed->data(),sizes[1])&&live_banks_equal(extra,unit,order.data()+36,508,"Halo_Saved_Home_Arrival_Orders_Observed.bin"),"script-and-orders-exact");
    require(arrival_container_file(extra,scratch,"Halo_Saved_Home_Arrival_Container_Observed.bin",factory,unit,true)==0&&
        load("Halo_Saved_Home_Arrival_Container_Observed.bin",*observed,48)&&!std::memcmp(container.data(),observed->data(),48)&&
        agent_file(extra,scratch,"Halo_Saved_Home_Arrival_Guild_Imported.GPL",guild,true)==0&&pair_queues(manager)==queues&&pair_rendering(factory)==rendering&&
        rd32(0x0071c6a8)==clock&&mods_hooks_installed_count()==hooks,"imported-save");
    // Original membership insertion copies its operand. Release only the
    // temporary value; retain both reciprocal guild memberships and the actor.
    extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);
    NativeRegistrySnapshot after;const std::array<uint32_t,1> addedUnits={unit};
    require(native_registry_snapshot(factory,after,0,addedUnits.data(),1)&&after==before&&
        rd32(factory+0x28)==counter+1&&rd32(runtime+0x34)==reserved+1&&rd32(manager+0x34)==entries+1&&
        pair_queues(manager)==queues&&pair_rendering(factory)==rendering&&native(469)==home&&lookup(7)==guild&&
        rd32(0x0071c68c)==world&&rd32(0x0071c6a8)==103500&&rd32(phase)==7&&!rd32(phase+4)&&
        mods_hooks_installed_count()==hooks&&heap_free(scratch),"preserved-world");
    aliases[0]=id;aliases[1]=aliases[2]=aliases[3]=0;aliases[4]=reserved;
    std::fprintf(stderr,"[streaming] Halo saved home arrival imported source=537/37 hero=%u agent=%u home=469/7 clock=103500 records=4 commands=3 exact=1 native-roster=1 script-roster=1 registry-preserved=1 queues-preserved=1 drawing-preserved=1 scheduled=0 activation=0 owner-published=0 result=pass\n",id,reserved);
    return true;
#endif
}

namespace {
struct HaloSavedHomeContinuation {
    uint32_t stage=0,world=0,factory=0,runtime=0,manager=0,unit=0,agent=0,home=0,guild=0,id=0,agent_id=0;
    uint32_t last=103500,hooks_before=0,agent_hook=0,context_hook=0,command_hook=0,ai=0,other_ai=0,contexts=0,building=0,commands=0,samples=0;
    uint32_t agent_entries=0,context_entries=0,command_entries=0;
    std::array<uint32_t,5> initial{};
} halo_saved_home_continuation;
static void halo_saved_home_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_saved_home_continuation;const bool own=s.stage==1&&cpu->ecx==s.agent;
    if(own&&++s.agent_entries<=2)std::fprintf(stderr,"[streaming] Halo saved home AI enter clock=%u entry=%u\n",rd32(0x0071c6a8),s.agent_entries);
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(own&&s.agent_entries<=2)std::fprintf(stderr,"[streaming] Halo saved home AI returned clock=%u entry=%u\n",rd32(0x0071c6a8),s.agent_entries);
    if(s.stage==1){auto &n=own?s.ai:s.other_ai;if(++n>65536)std::abort();}
}
static void halo_saved_home_context(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_saved_home_continuation;const bool own=s.stage==1&&rd32(0x00720304u)==s.agent;
    const bool building=own&&gm_valid(cpu->ecx,24)&&home_text(cpu->ecx,"use_building");
    if(own&&++s.context_entries<=8){HomeTaskView v;const bool valid=home_task_view(s.agent,v,s.agent_id,s.id,7);
        std::fprintf(stderr,"[streaming] Halo saved home context enter clock=%u entry=%u callback=%08x valid=%u function=%s\n",rd32(0x0071c6a8),s.context_entries,gm_valid(cpu->ecx,24)?rd32(cpu->ecx+0x14):0,unsigned(valid),v.function);}
    // Home uses the real registered guild. Every observer continues the
    // original implementation, including travel_to and building use.
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(own&&s.context_entries<=8)std::fprintf(stderr,"[streaming] Halo saved home context returned clock=%u entry=%u\n",rd32(0x0071c6a8),s.context_entries);
    if(own&&++s.contexts>65536)std::abort();if(building&&++s.building>4096)std::abort();
}
static void halo_saved_home_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_saved_home_continuation;const bool own=s.stage==1&&gm_valid(cpu->ecx,8)&&rd32(cpu->ecx+4)==s.unit;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();if(own&&++s.commands>65536)std::abort();
}
}
extern "C" bool majesty_browser_streaming_halo_saved_home_activate(X86 *c,const uint32_t *aliases) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    auto &s=halo_saved_home_continuation;const char *flag=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_HOME_ACTIVATE"),*arrival=recomp_env("BROWSER_FRONTIER_HALO_SESSION_SAVED_HOME_ARRIVAL"),*profile=recomp_env("PROFILE_DIR");
    const std::string_view path(profile?profile:"");const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(s.stage||!flag||std::strcmp(flag,"v1")||!arrival||std::strcmp(arrival,"v1")||!aliases||!aliases[0]||!aliases[4]||aliases[1]||aliases[2]||aliases[3]||
       path.find("/actor-arrival-fixture-halo-world-session-")==path.npos||!path.ends_with("/native-world-halo/frontier_0_0")||
       !gm_valid(phase,0x50)||rd32(phase)!=7||rd32(phase+4)||rd32(0x0071c6a8)!=103500||!gm_valid(world,0x14)||
       mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)return false;
    auto require=[](bool ok,const char *where){if(!ok){std::fprintf(stderr,"[streaming] Halo saved home activation refused boundary=%s\n",where);std::abort();}};
    X86 extra=*c;extra.r[R_ESP]-=32768;s.world=world;s.factory=rd32(world+0x10);s.runtime=guest_call(&extra,0x00623b20u);
    require(gm_valid(s.factory,0x8c)&&gm_valid(s.runtime,0x38),"runtime");s.manager=rd32(s.runtime+4);
    require(gm_valid(s.manager,0x4c)&&!rd32(s.manager+0x48),"manager");
    s.id=aliases[0];s.agent_id=aliases[4];extra.r[R_ECX]=s.factory;s.unit=guest_call(&extra,0x005a10d0u,s.id);
    extra.r[R_ECX]=s.runtime;s.agent=guest_call(&extra,0x006236b0u,s.agent_id);extra.r[R_ECX]=s.runtime;s.guild=guest_call(&extra,0x006236b0u,7u);extra.r[R_ECX]=s.factory;s.home=guest_call(&extra,0x005a10d0u,469u);
    HomeTaskView view;uint32_t cells=0;s.hooks_before=mods_hooks_installed_count();
    require(gm_valid(s.unit,0x164)&&gm_valid(s.guild,0x34)&&gm_valid(s.home,0x98)&&rd32(s.guild+0x20)==469&&rd32(s.unit+0x60)==s.id&&rd32(s.unit+0x6c)==0x314c5641&&
        !rd32(s.unit+0x74)&&!(rd32(s.unit+0x64)&4)&&home_task_view(s.agent,view,s.agent_id,s.id,7)&&rd32(view.home+8)==7&&rd32(view.target+8)==7&&
        home_text(view.task+8,"go_home")&&!std::strcmp(view.function,"travel_to")&&arrival_contains(s.unit,101,s.home)&&arrival_contains(s.home,100,s.unit),"identity-home");
    const uint32_t grid=rd32(s.factory+0x88),cx=rd32(s.unit+0x54),cy=rd32(s.unit+0x58);const auto drawing=live_drawing(s.factory,s.unit);
    require(gm_valid(grid,0x50)&&rd32(grid+0x48)==256&&rd32(grid+0x4c)==256&&cx==251&&cy==17&&
        !joint_motion_physical(s.factory,s.unit,cells,256)&&!cells&&drawing.valid&&!drawing.excluded,"spatial-before");
    extra.r[R_ECX]=grid;const uint32_t point[]={s.unit,cx,cy,0x200u,0u,0u};const auto clearance=guest_call_guarded(&extra,0x005b8eb0u,point,6);
    require(clearance.status==GuestCallGuardedStatus::Returned&&!(clearance.eax&255),"collision");
    const uint32_t table=rd32(s.unit),helper=rd32(s.unit+0x18);
    require(rd32(table+0x1b4)==0x005a2370u&&rd32(table+0x1b8)==0x005a2420u&&rd32(table+0x94)==0x005ad3e0u&&
        gm_valid(helper,0x20)&&rd32(helper)==0x0068b4d4&&rd32(helper+0x10)==s.unit,"postload-methods");
    HaloCompletedModel cached{extra,s.unit,helper};
    require(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005b54d0u,0,cached.callback,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,&cached,&cached.handle)==POP_OK,"model-cache");
    extra.r[R_ECX]=s.unit;const auto done=guest_call_guarded(&extra,0x005a2370u,nullptr,0,&cached.cookie);cached.cookie=0;
    require(mods_hook_remove(MODS_OWNER_RUNTIME,cached.handle)==POP_OK&&done.status==GuestCallGuardedStatus::Returned&&(done.eax&255)&&cached.calls==1,"first-postload");
    extra.r[R_ECX]=s.unit;guest_call(&extra,0x005ad3e0u);extra.r[R_ECX]=s.unit;guest_call(&extra,0x005a2420u);
    const auto after=live_drawing(s.factory,s.unit);RegisteredOrderMembers orders{};
    require(joint_motion_physical(s.factory,s.unit,cells,256)&&cells==4&&after.valid&&after.excluded==1&&after.kept==drawing.kept&&after.hash==drawing.hash&&
        registered_order_members(s.factory,s.unit,orders)&&orders.matches==1,"physical-drawing-orders");
    const uint32_t scratch=heap_alloc(512,true),pending=rd32(s.manager+0x3c);DepartureQueues qb{},qa{};
    require(scratch&&(pending==s.manager+0x10||pending==s.manager+0x1c)&&departure_queues(s.manager,s.agent,qb)&&!qb.omitted,"queue-before");
    wr32(scratch+144,s.agent);extra.r[R_ECX]=pending;guest_call(&extra,0x00633fd0u,scratch+128,rd32(pending+4),scratch+144);
    require(departure_queues(s.manager,s.agent,qa)&&qa.omitted==1,"queue-after");qa.omitted=0;require(qa==qb&&heap_free(scratch)&&mods_hooks_installed_count()==s.hooks_before,"preserved-queues");
    s.initial=home_motion_position(s.unit);s.last=103500;
    require(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,halo_saved_home_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.agent_hook)==POP_OK&&
        mods_hook_install_ex(MODS_OWNER_RUNTIME,0x006381b0u,0,halo_saved_home_context,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.context_hook)==POP_OK&&
        mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,halo_saved_home_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)==POP_OK,"observers");
    s.stage=1;
    std::fprintf(stderr,"[streaming] Halo saved home activated hero=%u agent=%u home=469/7 clock=103500 footprint=4 drawing=1 queued=1 orders-admitted=1 original-collision=1 original-postload=1 completed-model-step-cached=1 ungated-ai=1 owner-published=0 result=pass\n",s.id,s.agent_id);
    return true;
#endif
}
extern "C" bool majesty_browser_streaming_halo_saved_home_after_tick(X86 *c) {
#ifdef __EMSCRIPTEN__
    return false;
#else
    auto &s=halo_saved_home_continuation;const uint32_t clock=rd32(0x0071c6a8),phase=rd32(0x006d7670);
    if(s.stage!=1||rd32(0x0071c68c)!=s.world||!gm_valid(phase,0x50)||rd32(phase)!=3||rd32(phase+4)||
       clock!=s.last+50||clock>113500||mods_hook_depth()||!sched_holds_baton())std::abort();
    uint32_t cells=0;DepartureQueues queue{};const auto drawing=live_drawing(s.factory,s.unit);
    if(!joint_motion_physical(s.factory,s.unit,cells,256)||cells!=4||!drawing.valid||drawing.excluded!=1||
       !departure_queues(s.manager,s.agent,queue)||queue.omitted!=1||rd32(s.unit+0x60)!=s.id||rd32(s.agent+0x20)!=s.id||
       rd32(s.guild+0x20)!=469||!arrival_contains(s.unit,101,s.home)||!arrival_contains(s.home,100,s.unit))std::abort();
    s.last=clock;++s.samples;
    if(s.samples==1||s.samples%50==0)std::fprintf(stderr,"[streaming] Halo saved home completed clock=%u ticks=%u ai=%u contexts=%u commands=%u\n",clock,s.samples,s.ai,s.contexts,s.commands);
    if(clock<113500)return false;
    const auto pose=home_motion_position(s.unit);
    if(s.samples!=200||!s.ai||!s.other_ai||!s.commands||pose==s.initial||rd32(s.unit+0x74)||
       (rd32(s.unit+0x64)&4)||mods_hook_remove(MODS_OWNER_RUNTIME,s.agent_hook)!=POP_OK||
       mods_hook_remove(MODS_OWNER_RUNTIME,s.context_hook)!=POP_OK||mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK||
       mods_hooks_installed_count()!=s.hooks_before)std::abort();
    s.stage=2;
    std::fprintf(stderr,"[streaming] Halo saved home continuation hero=%u agent=%u clock=113500 ticks=%u ai=%u other-ai=%u contexts=%u building=%u commands=%u initial=%d,%d,%d final=%d,%d,%d footprint=4 drawing=1 queued=1 rosters=1 ungated-ai=1 hooks-removed=1 owner-published=0 result=pass\n",
        s.id,s.agent_id,s.samples,s.ai,s.other_ai,s.contexts,s.building,s.commands,int32_t(s.initial[0]),int32_t(s.initial[1]),int32_t(s.initial[2]),int32_t(pose[0]),int32_t(pose[1]),int32_t(pose[2]));
    return true;
#endif
}

static void original_halo_homeward_import_trial(X86 *c) {
#ifndef __EMSCRIPTEN__
    static bool attempted=false;const char *flag=recomp_env("BROWSER_STREAMING_HALO_HOMEWARD_IMPORT");
    if(!flag||attempted)return;
    auto require=[](bool ok,const char *where){if(!ok){std::fprintf(stderr,"[streaming] Halo homeward refused boundary=%s\n",where);std::abort();}};
    const char *profile=recomp_env("PROFILE_DIR"),*selected=recomp_env("RULE_FRONTIER_REGION");
    std::string_view path(profile?profile:"");constexpr std::string_view suffix="/frontier_0_0";
    require(!std::strcmp(flag,"1")&&path.ends_with(suffix)&&selected&&!std::strcmp(selected,"0_0"),"scope");
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');const auto owned=path.substr(slash==path.npos?0:slash+1);
    require(owned.starts_with("actor-arrival-fixture-halo-world-homeward-")&&owned.size()<=80&&
        !recomp_env("RULE_FRONTIER_CHAPTER")&&enabled(),"fixture");
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c);
    if(!gm_valid(phase,0x50)||rd32(phase)!=3||!gm_valid(world,0x14))return;
    require(!rd32(phase+4)&&!mods_hook_depth()&&sched_holds_baton()&&c->r[R_ESP]>=STACK_LIMIT+65536&&c->r[R_ESP]<=STACK_TOP,"boundary");
    attempted=true;X86 extra=*c;extra.r[R_ESP]-=32768;
    const uint32_t clock=rd32(0x0071c6a8),factory=rd32(world+0x10),runtime=guest_call(&extra,0x00623b20u);
    require(clock==84550&&gm_valid(factory,0x8c)&&gm_valid(runtime,0x38),"epoch");
    const uint32_t manager=rd32(runtime+4),hooks=mods_hooks_installed_count(),counter=rd32(factory+0x28),reserved=rd32(runtime+0x34);
    require(gm_valid(manager,0x4c)&&!rd32(manager+0x48)&&reserved>22&&reserved<0x7ffffffe,"manager");
    const uint32_t entries=rd32(manager+0x34);const auto queues=pair_queues(manager);const auto rendering=pair_rendering(factory);
    NativeRegistrySnapshot before;require(rendering.valid&&native_registry_snapshot(factory,before),"registry");
    char pathbuf[1024];const char *binding=recomp_env("BROWSER_STREAMING_HALO_HOMEWARD_BINDING");
    require(binding&&std::strlen(binding)==64&&recomp_writable_path("Halo_Homeward.pack",pathbuf,sizeof pathbuf)&&
        loader_hash_file_bounded(pathbuf,3011)==binding,"binding");
    std::array<uint8_t,3011> pack{};FILE *f=std::fopen(pathbuf,"rb");require(f!=nullptr,"open");
    const bool read=std::fread(pack.data(),1,pack.size(),f)==pack.size()&&std::fgetc(f)==EOF&&!std::ferror(f);
    const bool closed=std::fclose(f)==0;require(read&&closed,"read");
    constexpr uint32_t header[]={0x31574848,1,4,3750,84550,532,35,469,7,100000,1000,2915};
    constexpr uint32_t sizes[]={442,1853,84,536},tags[]={0,1,2,3};
    require(!std::memcmp(pack.data(),header,sizeof header),"header");
    std::array<std::unique_ptr<PrimaryBytes>,4> records;size_t at=sizeof header;
    for(unsigned k=0;k<4;++k){uint32_t descriptor[3]{};std::memcpy(descriptor,pack.data()+at,12);at+=12;
        require(descriptor[0]==tags[k]&&descriptor[1]==532&&descriptor[2]==sizes[k]&&at+sizes[k]<=pack.size(),"descriptor");
        records[k]=std::make_unique<PrimaryBytes>();std::memcpy(records[k]->data(),pack.data()+at,sizes[k]);at+=sizes[k];}
    require(at==pack.size(),"pack-end");
    auto &hero=*records[0],&script=*records[1],&container=*records[2],&order=*records[3];
    size_t ea=0;PairPlan plan;majesty::orders::PayloadPlan banks;
    require(pair_word(hero,36)==100000&&pair_word(hero,40)==512&&pair_word(hero,48)==0x314c5641&&
        !pair_word(hero,52)&&!pair_word(hero,56)&&pair_word(hero,60)==8251848&&pair_word(hero,64)==250634&&
        pair_word(hero,68)==117986&&pair_word(hero,72)==251&&pair_word(hero,76)==7&&
        pair_native_ea(hero,sizes[0],1000,ea)&&pair_agent_plan(script,sizes[1],1000,100000,plan),"actor");
    for(size_t j=0;j<plan.count;++j)require(plan.references[j].before==1000||plan.references[j].before==7,"script-references");
    require(pair_word(order,0)==100000&&!std::memcmp(order.data()+4,"ORDR",4)&&!std::memcmp(order.data()+20,"PRIM",4)&&
        majesty::orders::plan_order_payload(order.data()+36,500,banks)&&banks.entry_count==3&&
        banks.bank_counts==std::array<uint32_t,3>{2,1,0}&&banks.entries[0].kind==2&&banks.entries[1].kind==4&&banks.entries[2].kind==7,"orders");
    constexpr uint32_t home_container[]={1,2,1,1,101,100000,469,1,1,0,1,100000};
    require(pair_word(container,0)==100000&&!std::memcmp(container.data()+4,"CONT",4)&&
        !std::memcmp(container.data()+36,home_container,sizeof home_container),"container");
    const uint32_t scratch=heap_alloc(512,true);require(scratch!=0,"scratch");
    auto write=[&](const char *n,const PrimaryBytes &b,size_t bytes){return recomp_writable_path(n,pathbuf,sizeof pathbuf)&&pair_write(pathbuf,b,bytes);};
    auto load=[&](const char *n,PrimaryBytes &b,size_t bytes){size_t found=0;return recomp_writable_path(n,pathbuf,sizeof pathbuf)&&arrival_bytes(pathbuf,b,found)&&found==bytes;};
    auto lookup=[&](uint32_t id){extra.r[R_ECX]=runtime;return guest_call(&extra,0x006236b0u,id);};
    auto native=[&](uint32_t id){extra.r[R_ECX]=factory;return guest_call(&extra,0x005a10d0u,id);};
    const uint32_t home=native(469),guild=lookup(7);
    require(gm_valid(home,0x98)&&gm_valid(guild,0x34)&&rd32(home+0x6c)==0x31564241&&rd32(guild+0x20)==469&&
        !native(496)&&!lookup(22)&&!lookup(reserved),"home");
    const uint32_t members=departure_list(extra,scratch,guild,"members");const auto roster=departure_list_state(members,reserved);
    require(roster.valid&&!roster.count&&!roster.matches&&agent_file(extra,scratch,"Halo_Homeward_Guild_Before.GPL",guild,true)==0&&
        majesty_browser_frontier_halo_homeward_checkpoint(&extra,0),"before-save");
    const uint32_t agent=guest_call(&extra,0x0064c616u,0x34u);require(gm_valid(agent,0x34),"agent-allocation");
    extra.r[R_ECX]=agent;guest_call(&extra,0x00625e70u);
    require(rd32(agent+0x10)==reserved&&rd32(runtime+0x34)==reserved+1,"agent-reservation");
    pair_put(hero,36,0);pair_put(hero,ea,reserved);
    require(write("Halo_Homeward_Unit_Input.UNIT",hero,sizes[0]),"unit-input");
    majesty::actors::UnitStage stage;const majesty::actors::StageInput input{512,0,0x314c5641,0};
    uint32_t status=UINT32_MAX,id=0;const bool installed=stage.install();
    const uint32_t unit=installed?primary_file(extra,scratch,"Halo_Homeward_Unit_Input.UNIT",factory,0,false,&status,true,&stage,&input):0;
    require(stage.remove(),"stage-remove");
    std::fprintf(stderr,"[streaming] Halo homeward stage status=%08x complete=%u failure=%u\n",status,unsigned(installed&&unit&&!status),unsigned(stage.failure()));
    std::array<uint32_t,32> addresses{};uint32_t count=0;
    require(installed&&!status&&unit&&restore_private_family_orders(extra,unit,order.data()+36,500,addresses,count)&&
        publish_native_identity(extra,factory,unit,id),"native-reader");pair_put(hero,36,id);pair_put(order,0,id);
    pair_put(script,plan.identity,reserved);pair_put(script,plan.native,id);
    for(size_t j=0;j<plan.count;++j)if(plan.references[j].before==1000)pair_put(script,plan.references[j].offset,reserved);
    require(write("Halo_Homeward_Agent_Input.GPL",script,sizes[1])&&agent_file(extra,scratch,"Halo_Homeward_Agent_Input.GPL",agent,false)==0,"script-reader");
    wr32(scratch+144,reserved);wr32(scratch+148,agent);extra.r[R_ECX]=manager+0x28;guest_call(&extra,0x00634460u,scratch+128,scratch+144);
    require(rd8(scratch+132)==1&&lookup(reserved)==agent&&rd32(manager+0x34)==entries+1,"script-register");
    extra.r[R_ECX]=agent;require(guest_call(&extra,0x00626310u)==unit,"native-backlink");
    std::memmove(container.data(),container.data()+36,48);pair_put(container,20,id);pair_put(container,44,id);
    require(write("Halo_Homeward_Container_Input.bin",container,48)&&
        arrival_container_file(extra,scratch,"Halo_Homeward_Container_Input.bin",factory,unit,false)==0&&arrival_contains(unit,101,home),"container-reader");
    extra.r[R_ECX]=home+0x94;require((guest_call(&extra,0x00598e20u,unit,home,100u)&255)&&arrival_contains(home,100,unit),"native-roster");
    extra.r[R_ECX]=rd32(runtime+0x1c);const uint32_t operand=guest_call(&extra,0x0062a810u,5u);require(operand!=0,"roster-operand");
    extra.r[R_ECX]=operand;guest_call(&extra,0x006254c0u,reserved);
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,4u);
    const auto added=departure_list_state(members,reserved);HomeTaskView view;
    require(added.valid&&added.count==1&&added.matches==1&&added.other_hash==roster.other_hash&&
        home_task_view(agent,view,reserved,id,7)&&view.going_home,"script-roster");
    const uint32_t helper=rd32(unit+0x18);require(gm_valid(helper,0x20)&&rd32(helper)==0x0068b4d4&&rd32(rd32(helper)+4)==0x005b54d0,"model");
    extra.r[R_ECX]=helper;require((guest_call(&extra,0x005b54d0u)&255)!=0,"model-resolve");
    auto observed=std::make_unique<PrimaryBytes>();
    require(primary_file(extra,scratch,"Halo_Homeward_Unit_Observed.UNIT",factory,unit,true,nullptr,true)&&
        load("Halo_Homeward_Unit_Observed.UNIT",*observed,sizes[0])&&!std::memcmp(hero.data(),observed->data(),sizes[0]),"unit-exact");
    require(agent_file(extra,scratch,"Halo_Homeward_Agent_Observed.GPL",agent,true)==0&&load("Halo_Homeward_Agent_Observed.GPL",*observed,sizes[1])&&
        !std::memcmp(script.data(),observed->data(),sizes[1])&&live_banks_equal(extra,unit,order.data()+36,500,"Halo_Homeward_Orders_Observed.bin"),"script-and-orders-exact");
    require(arrival_container_file(extra,scratch,"Halo_Homeward_Container_Observed.bin",factory,unit,true)==0&&
        load("Halo_Homeward_Container_Observed.bin",*observed,48)&&!std::memcmp(container.data(),observed->data(),48)&&
        agent_file(extra,scratch,"Halo_Homeward_Guild_Imported.GPL",guild,true)==0&&pair_queues(manager)==queues&&pair_rendering(factory)==rendering&&
        rd32(0x0071c6a8)==clock&&mods_hooks_installed_count()==hooks&&majesty_browser_frontier_halo_homeward_checkpoint(&extra,1),"imported-save");
    std::fprintf(stderr,"[streaming] Halo homeward imported hero=%u agent=%u home=469/7 clock=84550 records=4 commands=3 exact=1 native-roster=1 script-roster=1 scheduled=0 activation=0 owner-published=0 result=pass\n",id,reserved);
    if(arm_halo_homeward_live(extra,scratch,world,factory,runtime,manager,unit,agent,home,guild,id,reserved)){
        // The original list owns its copied membership value. Release the
        // temporary operand, as in the qualified live registered-home route.
        extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);
        require(heap_free(scratch),"activation-scratch-release");return;}
    std::memset(gm_ptr(scratch),0,512);wr32(scratch+64,operand);wr32(scratch+56,scratch+64);extra.r[R_ECX]=members;guest_call(&extra,0x00639bb0u,scratch+32,5u);
    extra.r[R_ECX]=rd32(runtime+0x1c);guest_call(&extra,0x0062aa20u,operand);
    extra.r[R_ECX]=unit;guest_call(&extra,0x005a21b0u);extra.r[R_ECX]=manager;guest_call(&extra,0x00633370u);
    const auto cleaned=departure_list_state(members,reserved);NativeRegistrySnapshot after;
    for(uint32_t n=0;n<count;++n)require(!heap_owns(addresses[n]),"command-release");
    require(!native(id)&&!lookup(reserved)&&native(469)==home&&lookup(7)==guild&&!arrival_contains(home,100,unit)&&
        cleaned.valid&&!cleaned.count&&!cleaned.matches&&cleaned.other_hash==roster.other_hash&&native_registry_snapshot(factory,after)&&after==before&&
        rd32(manager+0x34)==entries&&pair_queues(manager)==queues&&pair_rendering(factory)==rendering&&
        rd32(factory+0x28)==counter+1&&rd32(runtime+0x34)==reserved+1&&rd32(0x0071c6a8)==clock&&mods_hooks_installed_count()==hooks&&
        agent_file(extra,scratch,"Halo_Homeward_Guild_Cleaned.GPL",guild,true)==0&&majesty_browser_frontier_halo_homeward_checkpoint(&extra,2)&&heap_free(scratch),"cleanup");
    extra.r[R_ECX]=phase;guest_call(&extra,0x00416050u,7u);require(rd32(phase)==3&&rd32(phase+4)==7,"pause");
    std::fprintf(stderr,"[streaming] Halo homeward cleanup requests=%u aliases-absent=1 rosters-empty=1 registry-preserved=1 queues-preserved=1 drawing-preserved=1 original-removal=1 hooks-preserved=1 original-pause=1 result=pass\n",count);
#endif
}

struct HaloEastOwner {
    uint32_t stage=0,world=0,factory=0,runtime=0,manager=0,unit=0,agent=0,proxy=0;
    uint32_t hero_id=0,agent_id=0,proxy_id=0,start=0,end=0,last_clock=0,hook=0,hooks_before=0,held=0,other=0,samples=0;
    uint64_t fingerprint=0;
    std::array<int32_t,3> pose{};
    bool home_leg=false;
    uint32_t command_hook=0,commands=0;
    std::array<int32_t,3> previous{};
} halo_east_owner;
static bool halo_east_owner_home(HomeTaskView &v){const auto &s=halo_east_owner;
    return rd32(0x0071c68c)==s.world&&home_task_view(s.agent,v,s.agent_id,s.hero_id,s.proxy_id)&&v.going_home&&
        !rd32(s.proxy+0x20)&&!rd32(s.proxy+0x24)&&!rd8(s.proxy+0x28);}
static void halo_east_owner_agent(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_east_owner;
    if(s.stage==1&&cpu->ecx==s.agent){HomeTaskView v;
        if(!halo_east_owner_home(v)||v.fingerprint!=s.fingerprint||rd32(0x00720304u)||++s.held>4096||
           mods_hook_return(api,cpu,0,8)!=POP_OK)std::abort();
        return;
    }
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(s.stage==1&&++s.other>65536)std::abort();
}
static void halo_east_home_command(const PopModApi *api,pop_cpu_v1 *cpu,PopHookInvocation *inv,void *) {
    auto &s=halo_east_owner;const bool own=s.stage==1&&s.home_leg&&gm_valid(cpu->ecx,8)&&rd32(cpu->ecx+4)==s.unit;
    if(mods_call_next(api,inv,cpu)!=POP_OK)std::abort();
    if(own&&++s.commands>65536)std::abort();
}
static bool halo_east_home_retire(X86 &extra) {
    auto &s=halo_east_owner;const char *flag=recomp_env("BROWSER_STREAMING_HALO_EAST_HOME_RETIRE");
    if(!flag)return true;
    auto refused=[](const char *reason){std::fprintf(stderr,"[streaming] Halo home retirement refused reason=%s\n",reason);std::abort();};
    if(std::strcmp(flag,"1")||!s.home_leg||s.last_clock!=3750||rd32(0x0071c68c)!=s.world||
       rd32(s.manager+0x48)||mods_hook_depth()||mods_hooks_installed_count()!=s.hooks_before)refused("preflight");
    NativeRegistrySnapshot before{},after{};DepartureQueues queues_before{},queues_after{};
    const uint32_t entries=rd32(s.manager+0x34),native_counter=rd32(s.factory+0x28),script_counter=rd32(s.runtime+0x34);
    auto drawing=live_drawing(s.factory,s.unit);
    if(!native_registry_snapshot(s.factory,before,s.unit))refused("before-registry");
    if(!departure_queues(s.manager,s.agent,queues_before)||queues_before.omitted!=1)refused("before-queues");
    if(!drawing.valid||drawing.excluded!=1)refused("before-drawing");
    std::fprintf(stderr,"[streaming] Halo home retirement admitted clock=3750 registry-groups=%u queued=1 drawing=1\n",before.count);
    const auto allocated=heap_stats();uint32_t pool_before=0,pool_after=0;
    if(!stage_pool_live(pool_before))refused("before-pool");
    // The remote proxy owns no native roster. Retire the original UNIT with
    // its live Move/Path/Queue, then drain the original deferred GPL removal.
    extra.r[R_ECX]=s.unit;guest_call(&extra,0x005a21b0u);
    if(rd32(s.manager+0x48)!=1)refused("deferred-count");
    extra.r[R_ECX]=s.manager;guest_call(&extra,0x00633370u);
    extra.r[R_ECX]=s.factory;if(guest_call(&extra,0x005a10d0u,s.hero_id))refused("hero-present");
    extra.r[R_ECX]=s.runtime;if(guest_call(&extra,0x006236b0u,s.agent_id))refused("agent-present");
    extra.r[R_ECX]=s.runtime;if(guest_call(&extra,0x006236b0u,s.proxy_id)!=s.proxy)refused("proxy-rebound");
    queues_before.omitted=0;drawing.excluded=0;
    if(rd32(s.manager+0x48)||rd32(s.manager+0x34)+1!=entries)refused("manager-count");
    if(!native_registry_snapshot(s.factory,after)||after!=before)refused("after-registry");
    if(!departure_queues(s.manager,s.agent,queues_after)||queues_after!=queues_before)refused("after-queues");
    if(live_drawing(s.factory,s.unit)!=drawing)refused("after-drawing");
    if(rd32(s.factory+0x28)!=native_counter||rd32(s.runtime+0x34)!=script_counter)refused("alias-counters");
    if(rd32(s.proxy+0x20)||rd32(s.proxy+0x24)||rd8(s.proxy+0x28))refused("proxy-changed");
    const uint32_t grid=rd32(s.factory+0x88),buckets=rd32(grid+0x18);uint32_t matches=0;
    if(!gm_valid(grid,0x50)||rd32(grid+0x48)!=256||rd32(grid+0x4c)!=256||!gm_valid(buckets,256*256*4))std::abort();
    for(uint32_t cell=0;cell<256*256;++cell){const uint32_t bucket=rd32(buckets+cell*4);if(!bucket)continue;
        if(!gm_valid(bucket,32))std::abort();
        for(uint32_t slot=0;slot<8&&rd32(bucket+slot*4);++slot)matches+=rd32(bucket+slot*4)==s.unit;}
    const auto released=heap_stats();
    const bool pool_valid=stage_pool_live(pool_after);
    std::fprintf(stderr,"[streaming] Halo home retirement resources heap-bytes=%llu,%llu heap-blocks=%u,%u crt-live=%u,%u crt-valid=%u grid-matches=%u\n",
        static_cast<unsigned long long>(allocated.used_bytes),static_cast<unsigned long long>(released.used_bytes),
        allocated.used_blocks,released.used_blocks,pool_before,pool_after,unsigned(pool_valid),matches);
    if(matches)refused("grid-reference");
    // Original loaded actors/orders are allocated in the CRT stage pool.
    // Require their actual pool occupancy to fall and the separate guest heap
    // not to grow; a strict drop in both unrelated allocators is unsupported.
    if(!pool_valid||pool_after>=pool_before||released.used_bytes>allocated.used_bytes||released.used_blocks>allocated.used_blocks)refused("resources");
    if(rd32(0x0071c68c)!=s.world||rd32(0x0071c6a8)!=3750||mods_hooks_installed_count()!=s.hooks_before)refused("world-or-hooks");
    if(!majesty_browser_frontier_halo_home_leg_checkpoint(&extra,3))refused("retired-save");
    std::fprintf(stderr,"[streaming] Halo home leg retired hero=532 agent=35 proxy=34 clock=3750 original-removal=1 aliases-absent=1 other-registry-preserved=1 other-queues-preserved=1 other-drawing-preserved=1 grid-absent=1 proxy-preserved=1 counters-preserved=1 released-bytes=%llu released-blocks=%u released-crt=%u original-writer=1 owner-published=0 result=pass\n",
        static_cast<unsigned long long>(allocated.used_bytes-released.used_bytes),allocated.used_blocks-released.used_blocks,pool_before-pool_after);
    return true;
}
// Reload the actual selected eastern save without reimporting actors,
// replaying postload, inserting queues, or restoring already expired effects.
// Its captured remote-home request remains held before a local-only guard;
// other original world AI continues until the next completed save boundary.
static void original_halo_east_owner_frame(X86 *c) {
#ifndef __EMSCRIPTEN__
    auto &s=halo_east_owner;const char *flag=recomp_env("BROWSER_STREAMING_HALO_EAST_OWNER");
    if(!flag||s.stage==2)return;
    const char *profile=recomp_env("PROFILE_DIR"),*binding=recomp_env("BROWSER_STREAMING_HALO_EAST_OWNER_BINDING");
    std::string_view path(profile?profile:"");constexpr std::string_view suffix="/frontier_1_0";
    if(std::strcmp(flag,"1")||!path.ends_with(suffix)||!binding||std::strlen(binding)!=64||!enabled()||
       recomp_env("BROWSER_FRONTIER_HALO_SESSION")||recomp_env("RULE_FRONTIER_CHAPTER"))std::abort();
    path.remove_suffix(suffix.size());const auto slash=path.rfind('/');const auto owned=path.substr(slash==path.npos?0:slash+1);
    if(!owned.starts_with("actor-arrival-fixture-halo-world-east-owner-")||owned.size()>80)std::abort();
    const uint32_t phase=rd32(0x006d7670),world=rd32(0x0071c68c),clock=rd32(0x0071c6a8);
    if(!gm_valid(phase,0x50)||rd32(phase)!=3||!gm_valid(world,0x14))return;
    if(rd32(phase+4)||mods_hook_depth()||!sched_holds_baton()||c->r[R_ESP]<STACK_LIMIT+65536||c->r[R_ESP]>STACK_TOP)std::abort();
    X86 extra=*c;extra.r[R_ESP]-=32768;
    auto checkpoint=[&](unsigned stage){return s.home_leg?majesty_browser_frontier_halo_home_leg_checkpoint(&extra,stage):
        majesty_browser_frontier_halo_east_owner_checkpoint(&extra,stage);};
    auto native=[&](uint32_t id){extra.r[R_ECX]=s.factory;return guest_call(&extra,0x005a10d0u,id);};
    if(!s.stage){char filename[1024];std::array<uint32_t,8> ids{};
        if(!recomp_writable_path("Halo_East_Owner.ids",filename,sizeof filename)||loader_hash_file_bounded(filename,32)!=binding)std::abort();
        FILE *f=std::fopen(filename,"rb");if(!f)std::abort();
        const bool read=std::fread(ids.data(),1,32,f)==32&&std::fgetc(f)==EOF&&!std::ferror(f),closed=std::fclose(f)==0;
        if(!read||!closed||ids!=std::array<uint32_t,8>{0x314f4548u,1,3550,4050,532,35,34,5}||clock!=ids[2])std::abort();
        s.start=s.last_clock=ids[2];s.end=ids[3];s.hero_id=ids[4];s.agent_id=ids[5];s.proxy_id=ids[6];
        const char *leg_flag=recomp_env("BROWSER_STREAMING_HALO_EAST_HOME_LEG");s.home_leg=leg_flag!=nullptr;
        if(s.home_leg){const char *leg_binding=recomp_env("BROWSER_STREAMING_HALO_EAST_HOME_LEG_BINDING");std::array<uint32_t,14> leg{};
            if(std::strcmp(leg_flag,"1")||!leg_binding||std::strlen(leg_binding)!=64||
               !recomp_writable_path("Halo_Home_Leg.ids",filename,sizeof filename)||loader_hash_file_bounded(filename,56)!=leg_binding)std::abort();
            FILE *input=std::fopen(filename,"rb");if(!input)std::abort();
            const bool valid=std::fread(leg.data(),1,56,input)==56&&std::fgetc(input)==EOF&&!std::ferror(input),closed=std::fclose(input)==0;
            if(!valid||!closed||leg!=std::array<uint32_t,14>{0x314c4848u,1,3550,13550,532,35,34,5,48,126,1,0,0,0})std::abort();
            s.end=leg[3];}
        s.world=world;s.factory=rd32(world+0x10);s.runtime=guest_call(&extra,0x00623b20u);
        if(!gm_valid(s.factory,0x8c)||!gm_valid(s.runtime,0x38))std::abort();s.manager=rd32(s.runtime+4);
        if(!gm_valid(s.manager,0x4c)||rd32(s.manager+0x48))std::abort();s.unit=native(s.hero_id);
        extra.r[R_ECX]=s.runtime;s.agent=guest_call(&extra,0x006236b0u,s.agent_id);
        extra.r[R_ECX]=s.runtime;s.proxy=guest_call(&extra,0x006236b0u,s.proxy_id);
        if(!gm_valid(s.unit,0x164)||rd32(s.unit)!=0x0068098cu||rd32(s.unit+0x74)||rd32(s.unit+0x6c)!=0x314c5641u||
           rd32(s.unit+0x84)!=s.factory||(rd32(s.unit+0x64)&4)||!gm_valid(s.agent,0x34)||!gm_valid(s.proxy,0x34))std::abort();
        extra.r[R_ECX]=s.agent;if(guest_call(&extra,0x00626310u)!=s.unit)std::abort();
        for(uint32_t id:{533u,534u,535u})if(native(id))std::abort();
        for(unsigned k=0;k<3;++k)s.pose[k]=int32_t(rd32(s.unit+0x48+k*4));
        if(s.pose!=std::array<int32_t,3>{135015,258194,116930}||rd32(s.unit+0x54)!=4||rd32(s.unit+0x58)!=8)std::abort();
        RegisteredOrderMembers orders{};HomeTaskView home;DepartureQueues queues{};uint32_t cells=0;
        const auto drawing=live_drawing(s.factory,s.unit);
        if(!registered_order_members(s.factory,s.unit,orders)||orders.matches||!halo_east_owner_home(home)||
           !departure_queues(s.manager,s.agent,queues)||queues.omitted!=1||!joint_motion_physical(s.factory,s.unit,cells,256)||cells!=4||
           !drawing.valid||drawing.excluded!=1||!checkpoint(0))std::abort();
        s.fingerprint=home.fingerprint;s.hooks_before=mods_hooks_installed_count();
        s.previous=s.pose;
        if(s.home_leg){
            // Original $Move coordinate virtual+114 is 005b4870, RET20:
            // priority, two world-coordinate words, avoidance flags, user data.
            // It creates original command storage; never write pose/path/banks.
            if(rd32(rd32(s.unit)+0x114)!=0x005b4870u)std::abort();
            constexpr uint32_t move_args[]={0u,48u,126u,0u,0u};
            extra.r[R_ECX]=s.unit;guest_call(&extra,0x005b4870u,move_args,5);
            HomeTaskView after;RegisteredOrderMembers ready{};
            if(!halo_east_owner_home(after)||after.fingerprint!=s.fingerprint||!registered_order_members(s.factory,s.unit,ready)||ready.matches!=1)std::abort();
            for(unsigned k=0;k<3;++k)if(int32_t(rd32(s.unit+0x48+k*4))!=s.pose[k])std::abort();
            if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x005e53c0u,0,halo_east_home_command,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.command_hook)!=POP_OK)std::abort();
        }
        if(!checkpoint(1))std::abort();
        if(mods_hook_install_ex(MODS_OWNER_RUNTIME,0x00626cf0u,0,halo_east_owner_agent,POP_HOOK_WRAP,POP_HOOK_NO_GAME_VIEW,nullptr,&s.hook)!=POP_OK)std::abort();
        s.stage=1;
        if(s.home_leg)std::fprintf(stderr,"[streaming] Halo home leg ready hero=532 agent=35 proxy=34 clock=3550 goal=48,126 original-move=1 pose-written=0 request-preserved=1 owner-published=0 result=pass\n");
        else std::fprintf(stderr,"[streaming] Halo east owner ready hero=%u agent=%u proxy=%u clock=%u revision=5 footprint=4 drawing=1 queued=1 expired-effects=3 hero-bank-absent=1 postload-replayed=0 queues-inserted=0 request-held=1 original-writer=1 owner-published=0 result=pass\n",s.hero_id,s.agent_id,s.proxy_id,clock);
        return;
    }
    if(world!=s.world||clock!=s.last_clock+50||clock>s.end||++s.samples>(s.home_leg?200u:10u)||native(s.hero_id)!=s.unit)std::abort();s.last_clock=clock;
    HomeTaskView home;DepartureQueues queues{};RegisteredOrderMembers orders{};uint32_t cells=0;
    const auto drawing=live_drawing(s.factory,s.unit);
    if(!halo_east_owner_home(home)||home.fingerprint!=s.fingerprint||!registered_order_members(s.factory,s.unit,orders)||orders.matches!=(s.home_leg?1u:0u)||
       !departure_queues(s.manager,s.agent,queues)||queues.omitted!=1||!joint_motion_physical(s.factory,s.unit,cells,256)||cells!=4||!drawing.valid||drawing.excluded!=1)std::abort();
    std::array<int32_t,3> current{};for(unsigned k=0;k<3;++k){current[k]=int32_t(rd32(s.unit+0x48+k*4));
        if(!s.home_leg&&current[k]!=s.pose[k])std::abort();}
    for(uint32_t id:{533u,534u,535u})if(native(id))std::abort();
    if(s.home_leg){
        const bool crossed=current[0]<64*2048;
        if(current[0]<32*2048||current[0]>=4032*2048||current[1]<64*2048||current[1]>=4032*2048)std::abort();
        if(!crossed){s.previous=current;if(clock<s.end)return;
            std::fprintf(stderr,"[streaming] Halo home leg refused reason=no-accepted-crossing clock=%u commands=%u x=%d y=%d\n",clock,s.commands,current[0],current[1]);std::abort();}
        if(s.previous[0]<64*2048||!s.commands||!s.held||!s.other||
           mods_hook_remove(MODS_OWNER_RUNTIME,s.command_hook)!=POP_OK)std::abort();
    }else if(clock<s.end)return;
    if(!s.held||!s.other||mods_hook_remove(MODS_OWNER_RUNTIME,s.hook)!=POP_OK||mods_hooks_installed_count()!=s.hooks_before||
       !checkpoint(2))std::abort();
    if(s.home_leg&&!halo_east_home_retire(extra))std::abort();
    extra.r[R_ECX]=phase;guest_call(&extra,0x00416050u,7u);
    if(rd32(phase)!=3||rd32(phase+4)!=7||rd32(0x0071c6a8)!=clock)std::abort();
    if(s.home_leg)std::fprintf(stderr,"[streaming] Halo home leg crossed hero=532 agent=35 proxy=34 clock=%u ticks=%u held-ai=%u other-ai=%u commands=%u before=%d,%d,%d after=%d,%d,%d footprint=4 drawing=1 queued=1 request-preserved=1 original-pause=1 hooks-removed=1 owner-published=0 result=pass\n",clock,s.samples,s.held,s.other,s.commands,s.previous[0],s.previous[1],s.previous[2],current[0],current[1],current[2]);
    else std::fprintf(stderr,"[streaming] Halo east owner evolved hero=%u agent=%u proxy=%u clock=%u ticks=10 held-ai=%u other-ai=%u footprint=4 drawing=1 queued=1 expired-effects=3 request-preserved=1 evolved-saved=1 original-pause=1 hooks-removed=1 owner-published=0 result=pass\n",s.hero_id,s.agent_id,s.proxy_id,clock,s.held,s.other);
    s.stage=2;s.world=s.factory=s.runtime=s.manager=s.unit=s.agent=s.proxy=s.hook=0;
#endif
}
}

extern "C" void majesty_browser_streaming_halo_homeward_after_tick(X86 *c) {
#ifndef __EMSCRIPTEN__
    auto &s=halo_homeward_live;if(s.stage!=1)return;
    const uint32_t state=rd32(0x006d7670),clock=rd32(0x0071c6a8),timer=rd32(0x0071c634),model=rd32(0x006d8568);
    if(!gm_valid(state,0x50)||rd32(0x0071c68c)!=s.world||!gm_valid(timer,0x24)||!gm_valid(model,0x21c)||
       mods_hook_depth()||!sched_holds_baton())std::abort();
    if(s.after_ticks++<4)std::fprintf(stderr,"[streaming] Halo homeward completed tick phase=%u pending=%u clock=%u step=%u model-paused=%u samples=%u\n",
        rd32(state),rd32(state+4),clock,rd32(timer+0x20),rd32(model+0xc4),s.samples);
#endif
}

extern "C" void majesty_browser_streaming_joint_motion_tick(X86 *c) {
    original_halo_homeward_owner_trial(c);
    original_halo_homeward_import_trial(c);
    halo_homeward_live_frame(c);
    original_halo_east_owner_frame(c);
    original_halo_return_source_retirement(c);
    original_halo_return_live_frame(c);
    original_halo_return_import_trial(c);
    original_halo_bundle_import_trial(c);
    original_halo_source_retirement(c);
    original_halo_bundle_live_reload(c);
    halo_bundle_live_frame(c);
    original_hero_return_pair_reload_frame(c);
    original_remote_hero_departure_trial(c);
    original_returned_hero_live_frame(c);
    original_registered_hero_return_trial(c);
    original_registered_hero_pair_reload_trial(c);
    original_registered_hero_import_trial(c);
    original_registered_hero_departure_trial(c);
    original_registered_hero_reload_trial(c);
    original_registered_hero_live_frame(c);
    original_marker_clock_trial(c);
    original_wait_effect_clock_trial(c);
    original_outdoor_marker_clock_trial(c);
    original_queue_entry_trial(c);
    original_outdoor_family_import_trial(c);
    regional_hero_effects_frame(c);
    outdoor_family_route_frame(c);
    outdoor_family_return_frame(c);
    original_remote_home_trial(c);
    original_home_validity_trial(c);
    home_task_frame(c);
    residency_tick(c);
    auto &s = joint_motion;
    if (!s.active)
        return;
    const uint32_t state = rd32(0x006d7670);
    if (!gm_valid(state, 0x50) || rd32(0x0071c68c) != s.world) {
        s.active = false;
        joint_motion_remove();
        std::fprintf(stderr, "[streaming] Joint motion stopped world-replaced=1 result=fail\n");
        return;
    }
    if (rd32(state) != 3 || rd32(state + 0x28) == s.last || mods_hook_depth() ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
        return;
    s.last = rd32(state + 0x28);
    X86 extra = *c;
    extra.r[R_ESP] -= 32768;
    extra.r[R_ECX] = s.factory;
    const uint32_t unit = guest_call(&extra, 0x005a10d0, s.unit_id);
    extra.r[R_ECX] = s.runtime;
    const uint32_t agent = guest_call(&extra, 0x006236b0, s.agent_id);
    if (unit != s.unit || agent != s.agent || !gm_valid(unit, 0x164) || !gm_valid(agent, 0x34)) {
        s.active = false;
        joint_motion_remove();
        std::fprintf(stderr, "[streaming] Joint motion stopped registration-lost=1 result=fail\n");
        return;
    }
    const bool links = rd32(agent + 0x20) == s.unit_id && rd32(agent + 0x24) == unit;
    const int32_t x = int32_t(rd32(unit + 0x48)), y = int32_t(rd32(unit + 0x4c));
    const uint32_t elapsed = s.last - s.start, clock = rd32(0x0071c6a8);
    uint32_t cells = 0;
    const bool physical = joint_motion_physical(s.factory, unit, cells, s.extent);
    const auto drawing = live_drawing(s.factory, unit);
    s.valid = s.valid && links;
    s.physical = s.physical && physical;
    s.drawing = s.drawing && drawing.valid && drawing.excluded > 0;
    s.changed += x != s.x || y != s.y;
    if (!elapsed || elapsed % 16 == 0 || elapsed >= 240) {
        ++s.samples;
        std::fprintf(
            stderr,
            "[streaming] Joint motion sample elapsed=%u clock=%u fixed=%d,%d cells=%d,%d "
            "physical=%u footprint=%u drawing=%u marker=%u calls=%u leaves=%u path=%u links=%u\n",
            elapsed, clock, x, y, int32_t(rd32(unit + 0x54)), int32_t(rd32(unit + 0x58)),
            unsigned(physical), cells, drawing.valid ? drawing.excluded : 0, rd32(unit + 0x40),
            s.calls, s.leaves, s.path_calls, unsigned(links));
    }
    if (elapsed < 240)
        return;
    s.active = false;
    joint_motion_remove();
    const bool hooks = mods_hooks_installed_count() == s.hooks_before;
    const bool ai =
        !s.scheduled || (s.agent_calls && s.agent_calls == s.agent_returns && s.context_calls &&
                         s.context_calls == s.context_returns && s.executed);
    const bool pass = s.valid && hooks && s.calls && s.calls == s.returns && s.leaves &&
                      s.leaves == s.leaf_returns && s.path_calls && s.changed && clock > s.clock &&
                      s.physical && s.drawing && ai;
    std::fprintf(stderr,
                 "[streaming] Joint motion completed ticks=%u calls=%u returns=%u leaves=%u "
                 "leaf-returns=%u path=%u changed=%u physical=%u drawing=%u clock-advanced=%u "
                 "hooks-removed=%u valid=%u samples=%u result=%s\n",
                 elapsed, s.calls, s.returns, s.leaves, s.leaf_returns, s.path_calls, s.changed,
                 unsigned(s.physical), unsigned(s.drawing), unsigned(clock > s.clock),
                 unsigned(hooks), unsigned(s.valid), s.samples, pass ? "pass" : "fail");
    if (s.scheduled)
        std::fprintf(stderr,
                     "[streaming] Joint script motion completed ticks=%u agent-calls=%u "
                     "agent-returns=%u contexts=%u context-returns=%u executed=%u hooks-removed=%u "
                     "result=%s\n",
                     elapsed, s.agent_calls, s.agent_returns, s.context_calls, s.context_returns,
                     s.executed, unsigned(hooks), pass ? "pass" : "fail");
    const char *evolved = recomp_env("BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE");
    if (evolved && !std::strcmp(evolved, "1")) {
        const uint32_t manager = gm_valid(s.runtime, 0x38) ? rd32(s.runtime + 4) : 0;
        DepartureQueues before{}, after{};
        NativeRegistrySnapshot registry_before{}, registry_after{};
        const uint32_t native_counter = rd32(s.factory + 0x28),
                       script_counter = rd32(s.runtime + 0x34);
        const bool ready = pass && s.scheduled && elapsed == 240 && !s.running &&
                           !s.agent_running && sched_holds_baton() && gm_valid(manager, 0x4c) &&
                           !rd32(manager + 0x48) && departure_queues(manager, agent, before) &&
                           before.omitted == 1 && native_registry_snapshot(s.factory, registry_before);
        const bool saved = ready && majesty_browser_frontier_joint_evolved_checkpoint(&extra);
        const bool same = saved && departure_queues(manager, agent, after) && before == after &&
                          native_registry_snapshot(s.factory, registry_after) &&
                          registry_before == registry_after && !rd32(manager + 0x48) &&
                          rd32(s.factory + 0x28) == native_counter &&
                          rd32(s.runtime + 0x34) == script_counter && rd32(0x0071c6a8) == clock &&
                          int32_t(rd32(unit + 0x48)) == x && int32_t(rd32(unit + 0x4c)) == y &&
                          mods_hooks_installed_count() == s.hooks_before;
        std::fprintf(stderr,
                     "[streaming] Joint evolved checkpoint unit=%u agent=%u ticks=%u clock=%u "
                     "fixed=%d,%d queued=%u saved=%u state-same=%u hooks-same=%u result=%s\n",
                     s.unit_id, s.agent_id, elapsed, clock, x, y, before.omitted,
                     unsigned(saved), unsigned(same), unsigned(mods_hooks_installed_count() == s.hooks_before),
                     saved && same ? "pass" : "fail");
    }
}
// Native-only readiness for the selected returned Warrior. All movement and
// building exit remain original AI; two scalar observations bound the probe.
extern "C" bool majesty_browser_streaming_session_outdoor_hero(X86 *c) {
#ifndef __EMSCRIPTEN__
    const char *flag = recomp_env("BROWSER_FRONTIER_OUTDOOR_HERO_FIXTURE");
    if (!flag || std::strcmp(flag, "v1")) return true;
    const char *profile = recomp_env("PROFILE_DIR"), *session = recomp_env("RULE_FRONTIER_SESSION");
    const std::string_view path(profile ? profile : "");
    if (!session || std::strcmp(session, "v1") ||
        path.find("/actor-arrival-fixture-session-") == path.npos ||
        !path.ends_with("/frontier_0_0") || recomp_env("RULE_FRONTIER_CHAPTER") ||
        mods_hook_depth() || !sched_holds_baton() ||
        c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) return false;
    static unsigned observed = 0;
    const uint32_t world = rd32(0x0071c68c), clock = rd32(0x0071c6a8);
    if (!gm_valid(world, 0x14) || clock < 31800) return false;
    const uint32_t factory = rd32(world + 0x10);
    if (!gm_valid(factory, 0x8c)) return false;
    X86 extra = *c; extra.r[R_ESP] -= 32768;
    const uint32_t runtime = guest_call(&extra, 0x00623b20u);
    if (!gm_valid(runtime, 0x38)) return false;
    auto native = [&](uint32_t id) { extra.r[R_ECX] = factory; return guest_call(&extra, 0x005a10d0u, id); };
    auto agent = [&](uint32_t id) { extra.r[R_ECX] = runtime; return guest_call(&extra, 0x006236b0u, id); };
    const uint32_t unit = native(504), hero = agent(28), guild = native(469), home = agent(7);
    if (!gm_valid(unit, 0x164) || !gm_valid(hero, 0x34) || !gm_valid(guild, 0x98) ||
        !gm_valid(home, 0x34) || rd32(hero + 0x20) != 504 || rd32(home + 0x20) != 469 ||
        !arrival_contains(unit, 101, guild) || !arrival_contains(guild, 100, unit)) return false;
    const uint32_t parent = rd32(unit + 0x74);
    if (parent != 469 && parent != 0) return false;
    if ((observed == 1 && parent == 469) || observed == 2) return observed == 2 && parent == 0;
    if (!observed && parent != 469) return false;
    DepartureQueues queues{};
    if (!departure_queues(rd32(runtime + 4), hero, queues) || queues.omitted != 1) return false;
    uint32_t cells = 0;
    if (parent == 469) {
        if (!arrival_contains(guild, 2, unit)) return false;
    } else if (!joint_motion_physical(factory, unit, cells, 256) || !cells) return false;
    const auto drawing = live_drawing(factory, unit);
    if (!drawing.valid || drawing.excluded != 1) return false;
    ++observed;
    std::fprintf(stderr, "[streaming] Session hero observed phase=%s serial=0 region=0_0 hero=504 agent=28 home=7 guild=469 clock=%u parent=%u cells=%u queued=1 drawing=1 native-home=1 original-ai=1 x=%d y=%d z=%d result=pass\n",
        parent ? "resident" : "outdoor", clock, parent, cells,
        int32_t(rd32(unit + 0x48)), int32_t(rd32(unit + 0x4c)), int32_t(rd32(unit + 0x50)));
    return parent == 0;
#else
    (void)c; return true;
#endif
}

extern "C" bool majesty_browser_streaming_live_tick(X86 *c) {
    if (!live_actor.active)
        return false;
    const uint32_t world = rd32(0x0071c68cu), state = rd32(0x006d7670u);
    if (world != live_actor.world || !gm_valid(state, 0x50)) {
        live_actor.active = false;
        live_remove_hooks();
        heap_free(live_actor.cleanup_scratch);
        live_actor.cleanup_scratch = 0;
        std::fprintf(stderr, "[streaming] Live fixture failed: original world replaced\n");
        return false;
    }
    if (rd32(state) != 3)
        return true;
    if (c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP)
        return true;
    X86 extra = *c;
    extra.r[R_ESP] -= 512;
    extra.r[R_ECX] = live_actor.runtime;
    const uint32_t agent = guest_call(&extra, 0x006236b0u, live_actor.agent_id);
    extra.r[R_ECX] = live_actor.factory;
    const uint32_t unit = guest_call(&extra, 0x005a10d0u, live_actor.unit_id);
    if (agent != live_actor.agent || unit != live_actor.unit || !gm_valid(agent, 0x34) ||
        !gm_valid(unit, 0x164)) {
        live_actor.active = false;
        live_remove_hooks();
        heap_free(live_actor.cleanup_scratch);
        live_actor.cleanup_scratch = 0;
        std::fprintf(stderr, "[streaming] Live fixture failed: live registration lost\n");
        return false;
    }
    live_actor.frame = rd32(state + 0x28);
    const uint32_t elapsed = live_actor.frame - live_actor.start;
    extra.r[R_ECX] = agent;
    live_actor.valid_links = live_actor.valid_links && guest_call(&extra, 0x00626310u) == unit &&
                             rd32(agent + 0x20) == live_actor.unit_id;
    wr32(live_actor.cleanup_scratch + 128, 0x4541u);
    extra.r[R_ECX] = unit + 4;
    guest_call(&extra, 0x00426700u, live_actor.cleanup_scratch + 132,
               live_actor.cleanup_scratch + 128);
    const uint32_t ea_node = rd32(live_actor.cleanup_scratch + 132);
    live_actor.valid_links = live_actor.valid_links && ea_node != rd32(unit + 8) &&
                             gm_valid(ea_node, 0x14) && rd32(ea_node + 0x10) == live_actor.agent_id;
    if (live_actor.arrival)
        live_actor.valid_links = live_actor.valid_links &&
                                 arrival_contains(live_actor.arrival_home, 100, unit) &&
                                 arrival_contains(live_actor.arrival_home, 2, unit) &&
                                 arrival_contains(unit, 101, live_actor.arrival_home);
    if (elapsed < 240)
        return true;
    const uint32_t contexts = live_actor.contexts;
    for (uint32_t i = contexts > 16 ? contexts - 16 : 0; i < contexts; ++i) {
        const LiveContext &row = live_contexts[i % live_contexts.size()];
        std::fprintf(stderr,
                     "[streaming] Live context frame=%u function=%s delay=%u "
                     "before=%u after=%u flags=%u ran=%u returned=%u\n",
                     row.frame, row.name, row.delay, row.before, row.after, row.flags,
                     unsigned(row.ran), unsigned(row.returned));
    }
    const uint32_t executions = live_actor.executed;
    for (uint32_t i = executions > live_executions.size() ? executions - live_executions.size() : 0;
         i < executions; ++i) {
        const LiveContext &row = live_executions[i % live_executions.size()];
        std::fprintf(stderr,
                     "[streaming] Live execution frame=%u function=%s delay=%u "
                     "before=%u after=%u flags=%u ran=%u returned=%u\n",
                     row.frame, row.name, row.delay, row.before, row.after, row.flags,
                     unsigned(row.ran), unsigned(row.returned));
    }
    if (live_actor.persist_arrival) {
        extra.r[R_ECX] = live_actor.runtime;
        const uint32_t home_agent = guest_call(&extra, 0x006236b0u, 6u);
        const bool home_valid = gm_valid(home_agent, 0x34);
        DepartureList guards, waiting;
        if (home_valid) {
            guards = departure_list_state(
                departure_list(extra, live_actor.cleanup_scratch, home_agent, "Guards"),
                live_actor.agent_id);
            waiting = departure_list_state(
                departure_list(extra, live_actor.cleanup_scratch, home_agent, "Waiting_Guards"),
                live_actor.agent_id);
        }
        const bool rosters = home_valid && guards.valid && waiting.valid && guards.matches == 1 &&
                             waiting.matches == 1;
        live_actor.active = false;
        const bool hooks_removed =
            live_remove_hooks() && mods_hooks_installed_count() == live_actor.hooks_before;
        heap_free(live_actor.cleanup_scratch);
        live_actor.cleanup_scratch = 0;
        // Preserve the original paused schedule in a durable arrival. The earlier
        // import/removal probe separately exercises forced paused-context resume.
        arrival_checkpoint_ready = live_actor.valid_links && live_actor.valid_trace &&
                                   live_actor.calls && live_actor.calls == live_actor.returns &&
                                   rosters && hooks_removed;
        std::fprintf(stderr,
                     "[streaming] Arrival persistent completed ticks=%u unit=%u agent=%u "
                     "calls=%u returns=%u executed=%u links=%u rosters=%u hooks-removed=%u "
                     "scratch-released=1 checkpoint-ready=%u result=%s\n",
                     elapsed, live_actor.unit_id, live_actor.agent_id, live_actor.calls,
                     live_actor.returns, live_actor.executed, unsigned(live_actor.valid_links),
                     unsigned(rosters), unsigned(hooks_removed), unsigned(arrival_checkpoint_ready),
                     arrival_checkpoint_ready ? "pass" : "fail");
        return false;
    }
    const bool moved =
        int32_t(rd32(unit + 0x48)) != live_actor.x || int32_t(rd32(unit + 0x4c)) != live_actor.y;
    LiveDrawing before = live_drawing(live_actor.factory, unit);
    const uint32_t excluded = before.excluded;
    before.excluded = 0;
    const uint32_t queues_before =
        rd32(live_actor.manager + 0x18) + rd32(live_actor.manager + 0x24);
    const uint32_t entries_before = rd32(live_actor.manager + 0x34);
    extra.r[R_ECX] = live_actor.runtime;
    const bool source_agent_before =
        guest_call(&extra, 0x006236b0u, live_actor.source_id) == live_actor.source_agent;
    extra.r[R_ECX] = live_actor.factory;
    const bool source_unit_before =
        guest_call(&extra, 0x005a10d0u, owned_vehicle.id) == live_actor.source_unit;
    const HeapStats heap_before = heap_stats();
    // Compare immediately across removal: other original units can legitimately
    // change the home during the preceding 240 simulation ticks.
    const uint64_t home_before_cleanup =
        live_actor.arrival ? arrival_home_hash(live_actor.arrival_home, unit) : 0;
    live_actor.active = false;
    const bool hooks_removed =
        live_remove_hooks() && mods_hooks_installed_count() == live_actor.hooks_before;
    extra.r[R_ECX] = live_actor.manager;
    guest_call(&extra, 0x006332c0u, agent);
    // Original removal detaches the physical parent before notification/reset.
    extra.r[R_ECX] = unit;
    guest_call(&extra, 0x005a2280u);
    if (live_actor.arrival) {
        extra.r[R_ECX] = live_actor.arrival_home + 0x94;
        guest_call(&extra, 0x00598ff0u, unit, 100u);
        extra.r[R_ECX] = unit;
        guest_call(&extra, 0x005a22b0u);
    }
    const bool container_released = !live_actor.arrival || !rd32(unit + 0x94);
    extra.r[R_ECX] = unit;
    guest_call(&extra, 0x005b3550u);
    extra.r[R_ECX] = unit;
    guest_call(&extra, 0x005a21a0u);
    extra.r[R_ECX] = unit;
    guest_call(&extra, 0x005ad400u);
    extra.r[R_ECX] = live_actor.factory;
    guest_call(&extra, 0x005baf20u, unit);
    extra.r[R_ECX] = live_actor.manager + 0x28;
    guest_call(&extra, 0x006346a0u, live_actor.cleanup_scratch, live_actor.tree_node);
    heap_free(live_actor.cleanup_scratch);
    live_actor.cleanup_scratch = 0;
    extra.r[R_ECX] = agent;
    guest_call(&extra, 0x00625fa0u);
    guest_call(&extra, 0x00645bc0u, agent);
    extra.r[R_ECX] = live_actor.runtime;
    const bool removed_agent = !guest_call(&extra, 0x006236b0u, live_actor.agent_id);
    extra.r[R_ECX] = live_actor.factory;
    const bool removed_unit = !guest_call(&extra, 0x005a10d0u, live_actor.unit_id);
    const uint32_t queues_after = rd32(live_actor.manager + 0x18) + rd32(live_actor.manager + 0x24);
    const bool queues = queues_after + 1 == queues_before;
    const bool entries = rd32(live_actor.manager + 0x34) + 1 == entries_before;
    extra.r[R_ECX] = live_actor.runtime;
    const bool source_agent_after =
        guest_call(&extra, 0x006236b0u, live_actor.source_id) == live_actor.source_agent;
    extra.r[R_ECX] = live_actor.factory;
    const bool source_unit_after =
        guest_call(&extra, 0x005a10d0u, owned_vehicle.id) == live_actor.source_unit;
    const bool sources =
        source_agent_before && source_unit_before && source_agent_after && source_unit_after;
    const LiveDrawing after = live_drawing(live_actor.factory, unit);
    const bool rendering = after == before;
    std::fprintf(stderr,
                 "[streaming] Live drawing before=%u excluded=%u after=%u remaining=%u "
                 "before-valid=%u after-valid=%u before-hash=%016llx after-hash=%016llx\n",
                 before.kept, excluded, after.kept, after.excluded, unsigned(before.valid),
                 unsigned(after.valid), static_cast<unsigned long long>(before.hash),
                 static_cast<unsigned long long>(after.hash));
    const HeapStats heap_after = heap_stats();
    const bool released = heap_after.used_blocks < heap_before.used_blocks &&
                          heap_after.used_bytes < heap_before.used_bytes;
    const bool home_preserved =
        !live_actor.arrival || (home_before_cleanup && arrival_home_hash(live_actor.arrival_home,
                                                                         0) == home_before_cleanup);
    const bool passed = live_actor.valid_links && live_actor.valid_trace && live_actor.calls &&
                        live_actor.calls == live_actor.returns && live_actor.executed &&
                        removed_agent && removed_unit && queues && entries && rendering &&
                        released && sources && hooks_removed && home_preserved &&
                        container_released;
    if (live_actor.arrival)
        std::fprintf(stderr,
                     "[streaming] Arrival fixture completed ticks=%u executed=%u "
                     "home-preserved=%u container-links=%u container-released=%u "
                     "removed-agent=%u removed-unit=%u result=%s\n",
                     elapsed, live_actor.executed, unsigned(home_preserved),
                     unsigned(live_actor.valid_links), unsigned(container_released),
                     unsigned(removed_agent), unsigned(removed_unit),
                     passed && home_preserved ? "pass" : "fail");
    std::fprintf(stderr,
                 "[streaming] Live fixture completed ticks=%u calls=%u returns=%u "
                 "contexts=%u executed=%u moved=%u links=%u removed-agent=%u "
                 "removed-unit=%u queues=%u entries=%u rendering=%u released=%u "
                 "sources=%u trace=%u hooks-removed=%u scratch-released=%u "
                 "freed-blocks=%lld "
                 "freed-bytes=%lld result=%s\n",
                 elapsed, live_actor.calls, live_actor.returns, contexts, live_actor.executed,
                 unsigned(moved), unsigned(live_actor.valid_links), unsigned(removed_agent),
                 unsigned(removed_unit), unsigned(queues), unsigned(entries), unsigned(rendering),
                 unsigned(released), unsigned(sources), unsigned(live_actor.valid_trace),
                 unsigned(hooks_removed), unsigned(!live_actor.cleanup_scratch),
                 static_cast<long long>(heap_before.used_blocks) - heap_after.used_blocks,
                 static_cast<long long>(heap_before.used_bytes) - heap_after.used_bytes,
                 passed ? "pass" : "fail");
    return false;
}

// Owned native death-script trial. Exercise the stock fatal-palace path without
// manufacturing a network roster or declaring a cooperative result ourselves.
extern "C" void majesty_browser_streaming_palace_death_fixture(X86 *c) {
    majesty_browser_campaign_building_fixture(c);
#ifndef __EMSCRIPTEN__
    const char *flag = recomp_env("BROWSER_STREAMING_PALACE_DEATH_FIXTURE");
    if (!flag) return;
    const char *profile = recomp_env("PROFILE_DIR"), *selected = recomp_env("RULE_FRONTIER_REGION");
    std::string_view path(profile ? profile : "");
    constexpr std::string_view suffix = "/frontier_0_0";
    if (std::strcmp(flag, "v1") || !path.ends_with(suffix) || !selected || std::strcmp(selected, "0_0") ||
        !enabled() || recomp_env("RULE_FRONTIER_CHAPTER") || residency_enabled() || !isolated_fixture()) std::abort();
    path.remove_suffix(suffix.size());
    const auto slash = path.rfind('/');
    if (!path.substr(slash == path.npos ? 0 : slash + 1).starts_with("actor-arrival-fixture-palace-death-")) std::abort();
    struct Trial {
        uint32_t hook = 0, hooks_before = 0, palace = 0, unit_id = 0, player = 0, outcomes = 0, ticks = 0;
        bool attempted = false, completed = false;
        static void result(const PopModApi *api, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *opaque) {
            auto &s = *static_cast<Trial *>(opaque);
            if (!gm_valid(cpu->esp, 12)) std::abort();
            const uint32_t id = rd32(cpu->esp + 4), won = rd8(cpu->esp + 8), caller = rd32(cpu->esp);
            if (id == s.player) {
                // DeclareLoss's original callback calls the outcome directly.
                // Surrender instead enters it from replicated message case4.
                if (caller != 0x004265e5 || won || ++s.outcomes != 1) std::abort();
                std::fprintf(stderr, "[streaming] Palace death original-outcome unit=%u player=%u caller=%08x won=%u count=%u result=pass\n",
                    s.unit_id, id, caller, won, s.outcomes);
            }
            if (mods_call_next(api, inv, cpu) != POP_OK) std::abort();
        }
    };
    static Trial s;
    if (s.completed) return;
    if (!sched_holds_baton() || mods_hook_depth() || c->r[R_ESP] < STACK_LIMIT + 65536 || c->r[R_ESP] > STACK_TOP) std::abort();
    auto finish = [&] {
        if (mods_hook_remove(MODS_OWNER_RUNTIME, s.hook) != POP_OK || mods_hooks_installed_count() != s.hooks_before) std::abort();
        s.hook = 0; s.completed = true;
        std::fprintf(stderr, "[streaming] Palace death completed unit=%u player=%u original-declaration=1 outcomes=%u hooks-restored=1 ticks=%u result=pass\n",
            s.unit_id, s.player, s.outcomes, s.ticks);
    };
    if (s.attempted && s.outcomes) { finish(); return; }
    const uint32_t state = rd32(0x006d7670), world = rd32(0x0071c68c);
    if (!gm_valid(state, 0x50) || rd32(state) != 3 || !gm_valid(world, 0x14) || !rd32(world + 4)) return;
    if (s.attempted) { if (++s.ticks > 80) std::abort(); return; }
    const uint32_t factory = rd32(world + 0x10), local = rd32(state + 0x24), manager = rd32(0x006d8568);
    if (local >= 4 || !gm_valid(factory, 0x118) || rd32(factory) != 0x00682950 ||
        !gm_valid(manager, 0x21c) || rd32(manager + 0x218) == 2 || !heap_check().empty()) std::abort();
    X86 extra = *c; extra.r[R_ESP] -= 4096; extra.r[R_ECX] = factory;
    const uint32_t player = guest_call(&extra, rd32(rd32(factory) + 0x18), local);
    if (!gm_valid(player, 0x44)) std::abort();
    extra.r[R_ECX] = player;
    const uint32_t palace = guest_call(&extra, 0x0042ceb0);
    if (!gm_valid(palace, 0xd8) || rd32(palace + 0x84) != factory || rd32(palace + 0x70) != local ||
        !rd32(palace + 0x60) || !gm_valid(rd32(palace), 0xbc)) std::abort();
    extra.r[R_ECX] = palace;
    const int32_t hp = int32_t(guest_call(&extra, 0x005a1c40, 0x00555041u, 0u));
    if (hp <= 0 || hp > 1000000) std::abort();
    s.palace = palace; s.unit_id = rd32(palace + 0x60); s.player = local; s.hooks_before = mods_hooks_installed_count();
    if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x00482c50, 0, Trial::result, POP_HOOK_WRAP,
            POP_HOOK_NO_GAME_VIEW, &s, &s.hook) != POP_OK) std::abort();
    s.attempted = true; s.ticks = 1;
    std::fprintf(stderr, "[streaming] Palace death trigger unit=%u player=%u hp=%d setter=00431130 attribute=00555041 death-script=original result=pass\n",
        s.unit_id, local, hp);
    extra = *c; extra.r[R_ESP] -= 4096; extra.r[R_ECX] = palace;
    guest_call(&extra, 0x00431130, 0x00555041u, 0u);
    if (s.outcomes) finish();
#else
    (void)c;
#endif
}

namespace {
#ifndef __EMSCRIPTEN__
// Read-only qualification of queue replacement in the named-world session.
// Keep just the preceding registered queue, never a growing queue catalogue.
struct SessionQueueObservation {
  WorldResidencyProbe::PageQueue previous;
  uint32_t previous_map = 0, freed = 0, hook = 0;
  uint64_t observed_serial = UINT64_MAX;
  bool initialized = false, enabled = false;
} session_queue_observation;

void session_queue_free(const PopModApi *api, pop_cpu_v1 *cpu,
                        PopHookInvocation *inv, void *) {
  auto &s = session_queue_observation;
  const uint32_t pointer = gm_valid(cpu->esp + 4, 4) ? rd32(cpu->esp + 4) : 0;
  const std::array<uint32_t, 4> watched{s.previous.queue, s.previous_map,
                                        s.previous.buffer, s.previous.parent};
  const auto result = mods_call_next(api, inv, cpu);
  if (result != POP_OK)
    std::abort();
  for (unsigned i = 0; i < watched.size(); ++i)
    if (pointer && pointer == watched[i])
      s.freed |= 1u << i;
}

bool session_queue_image(const WorldResidencyProbe::PageQueue &entry,
                         uint32_t &map) {
  if (residency_crt_payload_size(entry.queue) != 56 ||
      !gm_valid(entry.queue, 48))
    return false;
  map = rd32(entry.queue + 0x24);
  const uint32_t buffer = entry.buffer, front = rd32(entry.queue + 0xc);
  if (!buffer || heap_size(buffer) != 4096 ||
      residency_crt_payload_size(map) != 8 || !gm_valid(map, 8) ||
      rd32(entry.queue + 0x28) != 2 || rd32(entry.queue + 0x2c) != 1 ||
      rd32(entry.queue + 0x10) != map + 4 ||
      rd32(entry.queue + 0x20) != map + 4 || rd32(map + 4) != buffer ||
      rd32(entry.queue + 4) != buffer ||
      rd32(entry.queue + 8) != buffer + 4096 ||
      rd32(entry.queue + 0x14) != buffer ||
      rd32(entry.queue + 0x18) != buffer + 4096 || front < buffer ||
      front - buffer > 4088 || rd32(entry.queue + 0x1c) != front + 8 ||
      !gm_valid(front, 8))
    return false;
  const uint32_t message = rd32(front);
  if (residency_crt_payload_size(message) != 40 || !gm_valid(message, 28) ||
      rd32(message) != 0x00682d04 || rd32(message + 0x10) != entry.recipient)
    return false;
  const uint32_t nested = rd32(message + 8);
  return residency_crt_payload_size(nested) == 56 && gm_valid(nested, 48) &&
         rd32(nested + 0x2c) <= 128;
}
#endif
} // namespace

extern "C" void
majesty_browser_streaming_session_queue_observe(X86 *c, uint64_t serial) {
#ifndef __EMSCRIPTEN__
  auto &s = session_queue_observation;
  if (!s.initialized) {
    s.initialized = true;
    const char *flag =
        recomp_env("BROWSER_FRONTIER_SESSION_QUEUE_OBSERVATION_FIXTURE");
    if (!flag)
      return;
    const char *profile = recomp_env("PROFILE_DIR"),
               *ready = recomp_env(
                   "BROWSER_FRONTIER_SESSION_READY_SNAPSHOT_FIXTURE");
    if (std::strcmp(flag, "v1") || !profile || !ready ||
        std::strcmp(ready, "v1") ||
        std::string_view(profile).find("/actor-arrival-fixture-session-") ==
            std::string_view::npos ||
        std::string_view(profile).find("/native-world-restoration/frontier_") ==
            std::string_view::npos)
      std::abort();
    s.enabled = true;
  }
  if (!s.enabled || s.observed_serial == serial)
    return;
  const uint32_t world = rd32(0x0071c68c), state = rd32(0x006d7670),
                 parent = rd32(0x006d8568);
  if (!c || serial > 64 || !world || !state || !gm_valid(state, 0x50) ||
      rd32(state) != 3 || rd32(state + 4) || !sched_holds_baton() ||
      mods_hook_depth() || c->r[R_ESP] < STACK_LIMIT + 65536 ||
      c->r[R_ESP] > STACK_TOP || residency_crt_payload_size(parent) != 696 ||
      !gm_valid(parent, 688) || rd32(parent + 0x218) == 2)
    std::abort();
  WorldResidencyProbe::PageQueue current;
  current.parent = parent;
  current.recipient = 1;
  PageRegistration tree;
  if (!residency_page_registration(current, tree) || tree.count != 1 ||
      !tree.recipient_queue)
    std::abort();
  current.queue = tree.recipient_queue;
  if (residency_crt_payload_size(current.queue) != 56 ||
      !gm_valid(current.queue, 48))
    std::abort();
  // Wait until the original queue has its first message/backing allocation.
  // An empty registration is not evidence for the earlier retirement family.
  if (!rd32(current.queue + 0x2c))
    return;
  current.buffer = rd32(current.queue + 4);
  uint32_t map = 0;
  if (!session_queue_image(current, map))
    std::abort();
  if (!s.hook &&
      mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x0064d4b6, 0,
                           session_queue_free, POP_HOOK_WRAP,
                           POP_HOOK_NO_GAME_VIEW, nullptr, &s.hook) != POP_OK)
    std::abort();
  const auto heap = heap_stats();
  const uint32_t clock = rd32(0x0071c6a8), hooks = mods_hooks_installed_count();
  const uint32_t previous_freed = s.freed;
  uint32_t previous_map = 0, previous_references = UINT32_MAX;
  const bool same_parent = s.previous.parent && s.previous.parent == parent;
  bool previous_valid = false;
  if (same_parent && !previous_freed) {
    PageRegistration previous_tree;
    previous_valid = session_queue_image(s.previous, previous_map) &&
                     previous_map == s.previous_map &&
                     residency_page_registration(s.previous, previous_tree);
    if (previous_valid)
      previous_references = previous_tree.queue_references;
  }
  const auto after = heap_stats();
  if (rd32(0x0071c68c) != world || rd32(0x0071c6a8) != clock ||
      mods_hooks_installed_count() != hooks ||
      after.used_bytes != heap.used_bytes ||
      after.used_blocks != heap.used_blocks || !heap_check().empty())
    std::abort();
  std::fprintf(stderr,
               "[frontier] Session queue observation serial=%llu clock=%u "
               "parent=%08x queue=%08x buffer=%08x map=%08x "
               "count=1 tree-count=1 default=%08x previous-serial=%llu "
               "previous-queue=%08x previous-buffer=%08x previous-map=%08x "
               "previous-freed=%u previous-valid=%u previous-references=%u "
               "read-only=1 heap-same=1 hooks-same=1 result=pass\n",
               static_cast<unsigned long long>(serial), clock, parent,
               current.queue, current.buffer, map, rd32(parent + 0x5c),
               static_cast<unsigned long long>(s.observed_serial),
               s.previous.queue, s.previous.buffer, s.previous_map,
               previous_freed, unsigned(previous_valid), previous_references);
  s.previous = current;
  s.previous_map = map;
  s.freed = 0;
  s.observed_serial = serial;
#else
  (void)c;
  (void)serial;
#endif
}
