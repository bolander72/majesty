// Expose the pinned engine's own synchronization evidence through opt-in
// browser diagnostics. Observe its variadic logger; leave checks and results
// entirely with the original game. Format addresses were verified in 0049cc20.
#include "native_received_transfer.h"
#include "platform/os.h"
#include "runtime/guest.h"
#include "runtime/native_seam.h"
#include "runtime/win32.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
extern "C" void fn_004de6d0(X86 *);
extern "C" void fn_004169a0(X86 *);
extern "C" void fn_00435940(X86 *);
extern "C" void fn_004bbb90(X86 *);
extern "C" void fn_004588d0(X86 *);
extern "C" void fn_00454560(X86 *);
extern "C" void fn_004f6080(X86 *);
extern "C" void fn_00497a00(X86 *);
extern "C" void fn_00625e70(X86 *);
extern "C" bool majesty_browser_coop_lobby_resume_begin(X86 *, const char *);
extern "C" void majesty_browser_coop_lobby_resume_read(X86 *, const char *);
extern "C" void majesty_browser_coop_lobby_resume_result(uint32_t, uint32_t);
extern "C" void majesty_browser_coop_lobby_resume_admit(X86 *);
extern "C" void fn_004384b0(X86 *);
extern "C" void majesty_browser_campaign_resume(X86 *);
extern "C" void majesty_browser_frontier_resume(X86 *);

namespace {
bool lobby_resume_label(uint32_t name, char (&label)[97]) {
  label[0] = 0;
  if (!name || !gm_valid(name, 12)) return false;
  const uint32_t bytes = rd32(name), length = rd32(name + 8);
  const uint32_t stride = (rd32(name + 4) & 0x01000000u) ? 2 : 1;
  if (!length || length >= sizeof label || !bytes ||
      !gm_valid(bytes, length * stride)) return false;
  for (uint32_t i = 0; i < length; ++i) {
    const uint32_t ch = stride == 2 ? rd16(bytes + i * 2) : rd8(bytes + i);
    if (ch < 32 || ch > 126) { label[0] = 0; return false; }
    label[i] = char(ch);
  }
  label[length] = 0;
  return true;
}
} // namespace

extern "C" void majesty_browser_network_construct(X86 *c) {
  fn_00497a00(c);
  // The pinned constructor leaves manager+88 uninitialized. GameStart
  // 0045304b sends that member before0049929f sets it from006c0ea0, so a
  // fresh lobby can publish allocator leftovers as its time-per-frame value.
  // Initialize this scalar from the original configured global at creation;
  // saved reads and subsequent original match initialization still own it.
  const uint32_t manager = c->r[R_EAX], timing = rd32(0x006c0ea0u);
  if (!manager || !gm_valid(manager, 0x2b0) ||
      rd32(manager) != 0x00682bc4u || !timing || timing > 1000u)
    std::abort();
  wr32(manager + 0x88, timing);
  std::fprintf(stderr, "[network] Original manager timing initialized interval-ms=%u "
      "source=006c0ea0 original-constructor=00497a00 result=pass\n", timing);
}

// Original GPL agent construction leaves +2c undefined, although its v2
// writer00626877/0062687d serializes it and reader00626b89 restores it.
// Give new objects a deterministic initial value. The original reader runs
// afterward on saved loads and remains authoritative for an existing value.
extern "C" void majesty_browser_gpl_agent_construct(X86 *c) {
  const uint32_t self = c->r[R_ECX];
  fn_00625e70(c);
  const uint32_t agent = c->r[R_EAX];
  if (!self || agent != self || !gm_valid(agent, 0x34) ||
      rd32(agent + 0x20) || rd32(agent + 0x24) ||
      g_mem[agent + 0x28] || g_mem[agent + 0x30] ||
      g_mem[agent + 0x31] || g_mem[agent + 0x32])
    std::abort();
  wr32(agent + 0x2c, 0);
  static bool announced = false;
  if (!announced) {
    announced = true;
    std::fprintf(stderr, "[network] Original GPL agent saved scalar initialized "
        "offset=2c value=0 original-constructor=00625e70 saved-reader-preserved=1 result=pass\n");
  }
}

// New original views omit these five saved words. Default them before
// construction so original callbacks can still set them. Saved view setup
// 00437910 restores all five afterward; existing saved values remain owned
// by the original reader. The original GSGL collector already defaults its
// corresponding fields to zero in00435e10.
extern "C" void majesty_browser_view_construct(X86 *c) {
  const uint32_t view = c->r[R_ECX], sp = c->r[R_ESP];
  if (!view || !gm_valid(view, 0x58) || !gm_valid(sp, 28))
    std::abort();
  for (const uint32_t offset : {0x18u, 0x38u, 0x3cu, 0x40u, 0x44u})
    wr32(view + offset, 0);
  fn_004384b0(c);
  if (c->r[R_EAX] != view || c->r[R_ESP] != sp + 28 ||
      rd32(view) != 0x00680df8u)
    std::abort();
  static bool announced = false;
  if (!announced) {
    announced = true;
    std::fprintf(stderr, "[network] Original view saved defaults initialized "
        "offsets=18,38,3c,40,44 original-constructor=004384b0 "
        "saved-reader-preserved=1 result=pass\n");
  }
}

// 00416c30 sets 006d7678 only while it polls every player's original GoStatus.
// Preserve its message pump and original 60-second timeout, but relinquish the
// scheduler baton between polls. A platform sleep while holding the baton
// would prevent other guest threads and the host's event loop from progressing.
// The extra delay applies only to initialization; gameplay polls are unchanged.
extern "C" void majesty_browser_loading_poll(X86 *c) {
  fn_004f6080(c);
  if (rd32(0x006d7678) != 1)
    return;
  bool spin_fixture = false;
#ifndef __EMSCRIPTEN__
  // A controlled comparison may retain the original spin in an owned native
  // lobby fixture. Personal profiles and browser builds cannot opt into it.
  static const bool owned_fixture = [] {
    const char *profile = recomp_env("PROFILE_DIR");
    return profile &&
           std::strstr(profile, "/output/native-multiplayer-lobby-") &&
           std::strlen(profile) >= 14 &&
           !std::strcmp(profile + std::strlen(profile) - 14, "/owned-profile");
  }();
  static const bool original_spin = [] {
    const char *flag = recomp_env("NATIVE_MULTIPLAYER_SPIN_FIXTURE");
    return flag && !std::strcmp(flag, "v1");
  }();
  spin_fixture = owned_fixture && original_spin;
  static bool announced = false;
  const char *observe = recomp_env("NATIVE_MULTIPLAYER_WAIT_OBSERVE");
  if (!announced && owned_fixture && observe && !std::strcmp(observe, "v1")) {
    announced = true;
    std::fprintf(stderr,
                 "[network] Original initialization wait interval-ms=%u "
                 "spin-fixture=%u world-present=%u clock=%u\n",
                 spin_fixture ? 0u : 8u, unsigned(spin_fixture),
                 unsigned(rd32(0x0071c68c) != 0), rd32(0x0071c6a8));
  }
#endif
  if (!spin_fixture)
    guest_sleep_ms(8);
}

namespace {
// Fault injection for one incoming transfer in a deliberately named test
// profile. Seed its actual destination through the original filename resolver
// and filesystem, before the original BEGIN opens it. Ordinary profiles and
// startup do not write fixtures. The 2 MiB fixture is larger than the retained
// eleven-day transfer; fixed scratch storage avoids a second whole-save copy.
void seed_stale_transfer(X86 *c, uint32_t packet) {
  static bool attempted = false;
  const char *flag = recomp_env("BROWSER_TRANSFER_STALE_FIXTURE");
  const char *profile = recomp_env("PROFILE_DIR");
  const char *base = profile ? std::strrchr(profile, '/') : nullptr;
  if (attempted || !flag || std::strcmp(flag, "1") != 0 || !base ||
      std::strncmp(base + 1, "coop-transfer-stale-", 20) != 0)
    return;
  attempted = true;
  const uint32_t sp = c->r[R_ESP];
  if (sp < 16384 || !gm_valid(sp - 16384, 16384))
    return;
  const uint32_t scratch = sp - 8192;
  X86 extra = *c;
  extra.r[R_ESP] -= 16384;
  extra.r[R_ECX] = packet;
  const uint32_t body = guest_call(&extra, rd32(rd32(packet) + 0x38), scratch);
  if (rd32(scratch) != 164 || !body || !gm_valid(body, 164))
    return;
  const uint32_t name = scratch + 32, path = scratch + 48,
                 buffer = scratch + 128;
  extra.r[R_ECX] = name;
  guest_call(&extra, 0x004e3430, body + 4); // UTF-16 owning constructor.
  extra.r[R_ECX] = path;
  guest_call(&extra, 0x004e3340);
  const uint32_t manager = guest_call(&extra, 0x00435d00);
  extra.r[R_ECX] = manager;
  // 00435c60 takes the destination first and the source second: its +20
  // stack load supplies the source as ECX to copy-out method 004e3ce0.
  guest_call(&extra, rd32(rd32(manager) + 0x4c), path, name);
  const uint32_t fs = guest_call(&extra, 0x005019f0), table = rd32(fs);
  extra.r[R_ECX] = fs;
  const uint32_t handle = guest_call(&extra, rd32(table + 4), path, 1);
  uint32_t written = 0;
  if (handle != 0xffffffffu) {
    std::memset(g_mem + buffer, 0x5a, 4096);
    for (unsigned i = 0; i < 512; ++i) {
      extra.r[R_ECX] = fs;
      const uint32_t size =
          guest_call(&extra, rd32(table + 0x24), handle, buffer, 4096);
      if (size != 4096)
        break;
      written += size;
    }
    extra.r[R_ECX] = fs;
    guest_call(&extra, rd32(table + 0x1c), handle);
  }
  extra.r[R_ECX] = path;
  guest_call(&extra, 0x004e3820);
  extra.r[R_ECX] = name;
  guest_call(&extra, 0x004e3820);
  std::fprintf(stderr,
               "[resume] Stale destination fixture bytes=%u result=%s\n",
               written, written == 2097152 ? "pass" : "FAIL");
}
} // namespace

// The pinned multiplayer lobby stores the selected save in manager +2c
// (0044cbe0; its receiver calls it at 004553ad/00455993). Mode 3 startup
// instead uses manager +10 at 004bc056, which normally records the file
// loaded by 005c1830. A fresh process has not loaded that file yet. Bind
// startup to the lobby selection using the original owning string setter;
// never alias guest string storage or replace the serializer's result.
extern "C" void majesty_browser_multiplayer_start(X86 *c) {
  const uint32_t settings = rd32(0x006d87a0);
  const uint32_t manager = rd32(0x0071c634);
  const bool resume =
      settings && gm_valid(settings, 0x70) && rd32(settings + 0x6c) == 3;
  if (resume) {
    char label[97]{};
    if (manager && gm_valid(manager, 0x38))
      lobby_resume_label(manager + 0x2c, label);
    if (!majesty_browser_coop_lobby_resume_begin(c, label)) {
      // Original004bc3a3 is RET with no stack arguments. Refusal skips its
      // loader, not its return convention; preserve the caller's registers.
      const uint32_t sp = c->r[R_ESP];
      if (!gm_valid(sp, 4)) std::abort();
      c->eip = rd32(sp);
      c->r[R_ESP] = sp + 4;
      recomp_return(c);
      return;
    }
  }
  if (resume && manager && gm_valid(manager, 0x38) &&
      rd32(manager + 0x34) != 0) {
    X86 extra = *c;
    extra.r[R_ECX] = manager;
    guest_call(&extra, 0x005947d0, manager + 0x2c);
    const char *debug = recomp_env("BROWSER_RESUME_DEBUG");
    if (debug && std::strcmp(debug, "1") == 0)
      std::fprintf(
          stderr,
          "[resume] Multiplayer startup bound to lobby save (%u characters)\n",
          rd32(manager + 0x18));
  }
  fn_004bbb90(c);
  if (resume) {
    majesty_browser_coop_lobby_resume_admit(c);
    majesty_browser_campaign_resume(c);
  }
}

extern "C" void majesty_browser_named_read(X86 *c) {
  static const bool debug = [] {
    const char *value = recomp_env("BROWSER_RESUME_DEBUG");
    return value && std::strcmp(value, "1") == 0;
  }();
  static unsigned observed = 0;
  const uint32_t sp = c->r[R_ESP];
  const bool trace = debug && observed < 32 && gm_valid(sp, 12);
  const bool original_resume = gm_valid(sp, 12) && rd32(sp) == 0x004bc11du;
  uint32_t output = 0, caller = 0;
  char label[97] = {};
  bool complete_label = false;
  if (trace || original_resume) {
    if (trace) ++observed;
    caller = rd32(sp);
    output = rd32(sp + 8);
    const uint32_t name = rd32(sp + 4);
    // 004e3590 stores the pointer at +0, capacity/flags at +4 and
    // current length at +8. Do not inspect spare capacity as text.
    if (name && gm_valid(name, 12)) {
      const uint32_t bytes = rd32(name), length = rd32(name + 8);
      const uint32_t stride = (rd32(name + 4) & 0x01000000u) ? 2 : 1;
      const uint32_t used =
          length < sizeof label - 1 ? length : sizeof label - 1;
      complete_label = length && length < sizeof label && bytes && gm_valid(bytes, length * stride);
      if (bytes && gm_valid(bytes, used * stride))
        for (uint32_t i = 0; i < used; ++i) {
          const uint32_t ch =
              stride == 2 ? rd16(bytes + i * 2) : rd8(bytes + i);
          label[i] = ch >= 32 && ch <= 126 ? char(ch) : '?';
        }
    }
    if (trace) std::fprintf(stderr,
                 "[resume] Named reader caller=%08x name=%s output=%08x\n",
                 caller, label, output);
  }
  if (original_resume)
    majesty_browser_coop_lobby_resume_read(c, complete_label ? label : "");
  fn_00435940(c);
  if (original_resume)
    majesty_browser_coop_lobby_resume_result(c->r[R_EAX], output && gm_valid(output, 4) ? rd32(output) : 0);
  if (trace)
    std::fprintf(stderr, "[resume] Named reader result=%u context=%08x\n",
                 c->r[R_EAX], output && gm_valid(output, 4) ? rd32(output) : 0);
}

// Observe the pinned file receiver without taking ownership of its packet or
// changing its file result. Retain only the first few packet states, then emit
// them after END so a burst of original error dialogs cannot hide BEGIN.
extern "C" void majesty_browser_file_receive(X86 *c) {
  if (majesty_received_transfer_enabled()) {
    majesty_received_transfer_packet(c);
    return;
  }
  static const bool debug = [] {
    const char *value = recomp_env("BROWSER_RESUME_DEBUG");
    return value && std::strcmp(value, "1") == 0;
  }();
  struct Sample {
    uint32_t type, before, after, checksum, name, sequence;
  };
  static Sample samples[8] = {};
  static unsigned count = 0;
  uint32_t type = 0;
  uint32_t packet = 0;
  if (debug && gm_valid(c->r[R_ESP], 8)) {
    packet = rd32(c->r[R_ESP] + 4);
    if (packet && gm_valid(packet, 4)) {
      const uint32_t table = rd32(packet);
      if (table && gm_valid(table, 0x44)) {
        X86 extra = *c;
        extra.r[R_ECX] = packet;
        type = guest_call(&extra, rd32(table + 0x40));
      }
    }
  }
  if (type == 0x16)
    count = 0;
  if (type == 0x16)
    seed_stale_transfer(c, packet);
  const uint32_t before = debug ? rd32(0x006d7fcc) : 0;
  fn_004588d0(c);
  if (debug && count < 8)
    samples[count++] = {type,
                        before,
                        rd32(0x006d7fcc),
                        rd32(0x006d7f28),
                        rd16(0x006d7f2c),
                        rd32(0x006d7ff4)};
  if (type == 0x18) {
    for (unsigned i = 0; i < count; ++i)
      std::fprintf(stderr,
                   "[resume] Transfer sample=%u type=%02x handle=%08x->%08x "
                   "checksum=%08x name0=%04x sequence=%u\n",
                   i, samples[i].type, samples[i].before, samples[i].after,
                   samples[i].checksum, samples[i].name, samples[i].sequence);
    std::fprintf(
        stderr, "[resume] Transfer END handle=%08x checksum=%08x sequence=%u\n",
        rd32(0x006d7fcc), rd32(0x006d7f28), rd32(0x006d7ff4));
  }
}

extern "C" void majesty_browser_dispatch_receive(X86 *c) {
  if (majesty_received_transfer_blocks_dispatch(c)) {
    // Original 00456670 consumes a true result and deletes this packet once.
    // Discard already decoded game-start packets after a rejected checkpoint.
    const uint32_t sp = c->r[R_ESP];
    c->r[R_EAX] = 1;
    c->eip = rd32(sp);
    c->r[R_ESP] = sp + 4;
    return;
  }
  fn_00454560(c);
}

// 004169a0 selects the local kingdom and calls the world's +4 component,
// virtual slot +0x20. Observe the original pre-load caller and object graph;
// never skip a null dispatch or create an interface to conceal a bad load.
extern "C" void majesty_browser_local_player(X86 *c) {
  static const bool debug = [] {
    const char *value = recomp_env("BROWSER_RESUME_DEBUG");
    return value && std::strcmp(value, "1") == 0;
  }();
  static unsigned observed = 0;
  if (debug && observed < 64) {
    ++observed;
    const uint32_t sp = c->r[R_ESP], self = c->r[R_ECX];
    const uint32_t world = rd32(0x0071c68c);
    const uint32_t component =
        world && gm_valid(world, 8) ? rd32(world + 4) : 0;
    const uint32_t table =
        component && gm_valid(component, 4) ? rd32(component) : 0;
    const uint32_t target =
        table && gm_valid(table, 0x24) ? rd32(table + 0x20) : 0;
    const uint32_t state = rd32(0x006d7670);
    std::fprintf(
        stderr,
        "[resume] Local player caller=%08x self=%08x player=%u phase=%u "
        "world=%08x component=%08x vtable=%08x target=%08x\n",
        gm_valid(sp, 4) ? rd32(sp) : 0, self,
        gm_valid(sp, 8) ? rd32(sp + 4) : 0,
        state && gm_valid(state, 4) ? rd32(state) : 0, world, component, table,
        target);
  }
  fn_004169a0(c);
  majesty_browser_frontier_resume(c);
}

extern "C" void majesty_browser_network_log(X86 *c) {
  const char *debug = recomp_env("NETWORK_DEBUG");
  const uint32_t sp = c->r[R_ESP];
  if (debug && std::strcmp(debug, "1") == 0 && gm_valid(sp, 16)) {
    const uint32_t format = rd32(sp + 4);
    if (format == 0x006c17ccu)
      std::fprintf(stderr, "[network] Engine checksum frame=%u value=%08x\n",
                   rd32(sp + 8), rd32(sp + 12));
    else if (format == 0x006c1798u)
      std::fprintf(stderr, "[network] CHECKSUM FAILURE player=%u value=%08x\n",
                   rd32(sp + 8), rd32(sp + 12));
  }
  fn_004de6d0(c);
}
