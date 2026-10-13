// Responsive display adapter for the SHA-pinned DirectDraw Majesty executable.
// Only this guest thread rebuilds surfaces or writes game state; the browser
// main thread publishes a paired CSS viewport through native_seam.h.
#include "mods/mods_internal.h"
#include "native_received_transfer.h"
#include "platform/os.h"
#include "runtime/guest.h"
#include "runtime/loader.h"
#include "runtime/memory.h"
#include "runtime/native_seam.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

extern "C" {
void fn_004b9180(X86 *);
void fn_00415dd0(X86 *);
void fn_00489150(X86 *);
void fn_004da450(X86 *);
void fn_00462b30(X86 *);
void fn_00463170(X86 *);
void fn_004f5a80(X86 *);
void fn_004f49d0(X86 *);
void majesty_browser_campaign_input(X86 *);
void majesty_browser_frontier_idle(X86 *);
#ifndef __EMSCRIPTEN__
extern "C" void majesty_browser_native_coop_pause_poll(X86 *);
#endif
}

namespace {
// Verified in 004b9180.asm and 00462b30.asm: preferences/display dimensions.
constexpr uint32_t width_addr = 0x006cce10, height_addr = 0x006cce14,
                   depth_addr = 0x006cce0c;
int quality_height =
    0; // zero fits CSS pixels; a Graphics preset fixes logical height.
bool busy = false;
int resolution_menu_depth = 0;
int previous_quality = 0;
int seen_width = 0, seen_height = 0;
uint64_t changed_at = 0;
std::string generated_path;
std::vector<uint8_t> source, layout_data;
uint32_t main_start = 0, main_size = 0, panel_start = 0;
unsigned build_trace_depth = 0;

// Read-only details for the original placement query. Stack layouts are pinned
// in005b8eb0/005b8d50 and005f0db0: footprint dimensions/offsets belong to the
// bitmap mask, while unit identity/flags belong to the original actor object.
void trace_build_shape(const PopModApi *api, pop_cpu_v1 *cpu,
                       PopHookInvocation *inv, void *) {
  const uint32_t sp = cpu->esp;
  static unsigned reports = 0;
  static uint32_t last[2][5]{};
  if (build_trace_depth && reports < 64 && gm_valid(sp, 28)) {
    const uint32_t shape = rd32(sp + 24);
    if (shape && gm_valid(shape, 24)) {
      const uint32_t key[] = {rd32(sp + 8), rd32(sp + 12), rd32(sp + 16),
                              rd32(sp + 20), shape};
      const unsigned index = key[3] == 0x1800u ? 0 : 1;
      if (memcmp(last[index], key, sizeof key)) {
        memcpy(last[index], key, sizeof key);
        ++reports;
        fprintf(stderr, "[construction-shape] actor=%08x point=%d,%d mask=%x "
              "bitmap=%ux%u offset=%d,%d\n", rd32(sp + 8), int32_t(rd32(sp + 12)),
              int32_t(rd32(sp + 16)), rd32(sp + 20), rd32(shape), rd32(shape + 4),
              int32_t(rd32(shape + 12)), int32_t(rd32(shape + 16)));
      }
    }
  }
  mods_call_next(api, inv, cpu);
}
void trace_build_blocker(const PopModApi *api, pop_cpu_v1 *cpu,
                         PopHookInvocation *inv, void *) {
  const uint32_t sp = cpu->esp;
  const bool observe = build_trace_depth && gm_valid(sp, 16);
  const uint32_t actor = observe ? rd32(sp + 4) : 0,
                 blocker = observe ? rd32(sp + 8) : 0,
                 flags = observe ? rd32(sp + 12) : 0;
  mods_call_next(api, inv, cpu);
  static unsigned reports = 0;
  static uint32_t last[2][3]{};
  if (observe && (cpu->eax & 0xff) && reports < 64 &&
      blocker && gm_valid(blocker, 0x84)) {
    const uint32_t key[] = {actor, blocker, flags};
    const unsigned index = flags == 0x1800u ? 0 : 1;
    if (!memcmp(last[index], key, sizeof key)) return;
    memcpy(last[index], key, sizeof key);
    ++reports;
    const uint32_t id = rd32(blocker + 0x6c);
    char label[5] = {char(id), char(id >> 8), char(id >> 16), char(id >> 24), 0};
    for (int i = 0; i < 4; ++i)
      if (label[i] < 32 || label[i] > 126) label[i] = '?';
    fprintf(stderr, "[construction-blocker] actor=%08x blocker=%08x "
            "id=%s unit=%u player=%u flags=%x query=%x\n", actor, blocker, label,
            rd32(blocker + 0x60), rd32(blocker + 0x70), rd32(blocker + 0x64), flags);
  }
}

// Optional read-only trace of the two placement collision queries in
// 0043cb00.asm. Keep the original call, register result and stack cleanup.
// The bounded trace installs through the runtime's existing hook registry.
void trace_build_collision(const PopModApi *api, pop_cpu_v1 *cpu,
                           PopHookInvocation *inv, void *) {
  const uint32_t sp = cpu->esp, map = cpu->ecx;
  const bool valid = gm_valid(sp, 28) && gm_valid(map, 0x50);
  const uint32_t actor = valid ? rd32(sp + 4) : 0;
  const int32_t x = valid ? int32_t(rd32(sp + 8)) : 0;
  const int32_t y = valid ? int32_t(rd32(sp + 12)) : 0;
  const uint32_t flags = valid ? rd32(sp + 16) : 0;
  const uint32_t width = valid ? rd32(map + 0x48) : 0;
  const uint32_t height = valid ? rd32(map + 0x4c) : 0;
  ++build_trace_depth;
  mods_call_next(api, inv, cpu);
  --build_trace_depth;
  if (!valid)
    return;
  struct LastQuery {
    uint32_t actor = 0, result = 0xffffffffu;
    int32_t x = 0, y = 0;
  };
  static LastQuery last[2];
  static uint32_t reports = 0;
  // The two callers alternate query masks. Cache them separately so a
  // stationary preview does not emit two duplicate messages every frame.
  LastQuery &previous = last[flags == 0x1800u ? 0 : 1];
  const uint32_t result = cpu->eax & 0xff;
  if (reports < 256 && (actor != previous.actor || x != previous.x ||
                        y != previous.y || result != previous.result)) {
    ++reports;
    previous = {actor, result, x, y};
    fprintf(stderr,
            "[construction] collision actor=%08x point=%d,%d map=%ux%u "
            "flags=%x result=%u\n",
            actor, x, y, width, height, flags, result);
  }
}

void install_build_trace() {
  static bool attempted = false;
  if (attempted)
    return;
  attempted = true;
  uint32_t ids[2]{};
  const uint32_t returns[] = {0x0043d203u, 0x0043d23fu};
  for (int i = 0; i < 2; ++i)
    if (mods_hook_install_ex(
            MODS_OWNER_RUNTIME, 0x005b8eb0u, returns[i], trace_build_collision,
            POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &ids[i]) != POP_OK) {
      if (i)
        mods_hook_remove(MODS_OWNER_RUNTIME, ids[0]);
      fprintf(stderr, "[construction] collision trace unavailable\n");
      return;
    }
  uint32_t shape = 0, blocker = 0;
  if (mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005b8d50u, 0, trace_build_shape,
          POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &shape) != POP_OK ||
      mods_hook_install_ex(MODS_OWNER_RUNTIME, 0x005f0db0u, 0, trace_build_blocker,
          POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW, nullptr, &blocker) != POP_OK) {
    if (shape) mods_hook_remove(MODS_OWNER_RUNTIME, shape);
    fprintf(stderr, "[construction] detail trace unavailable\n");
  }
}

uint32_t word(const std::vector<uint8_t> &data, size_t at) {
  uint32_t v;
  memcpy(&v, data.data() + at, 4);
  return v;
}
void put(std::vector<uint8_t> &data, size_t at, int value) {
  const uint32_t v = uint32_t(value);
  memcpy(data.data() + at, &v, 4);
}
bool load_source() {
  if (!source.empty())
    return true;
  char path[1024];
  if (!recomp_readable_path("Data\\UIData_1920_1080.dat", path, sizeof path) ||
      loader_hash_file(path) !=
          "8f78769a4d4dfec01fd671dc308cd33b1ecacc3cc36c957f4f35743a40932c04")
    return false;
  const int fd = os_fd_open(path, OS_O_RDONLY);
  if (fd < 0)
    return false;
  OsStat st{};
  if (os_fd_stat(fd, &st) || st.size < 64 || st.size > 1024 * 1024) {
    os_fd_close(fd);
    return false;
  }
  std::vector<uint8_t> bytes(size_t(st.size));
  size_t done = 0;
  while (done < bytes.size()) {
    const int64_t n = os_fd_read(fd, bytes.data() + done, bytes.size() - done);
    if (n <= 0)
      break;
    done += size_t(n);
  }
  os_fd_close(fd);
  if (done != bytes.size() || memcmp(bytes.data(), "CYLBPC  \1\0\1\0", 12) ||
      word(bytes, 12) != 2)
    return false;
  size_t cursor = 36;
  uint32_t main_entry = 0;
  const size_t directory_end = cursor + word(bytes, 16);
  if (directory_end > bytes.size())
    return false;
  for (int section = 0; section < 2; ++section) {
    if (word(bytes, 24 + section * 8) != cursor || cursor + 8 > directory_end)
      return false;
    const bool menus = memcmp(bytes.data() + 20 + section * 8, "SMNU", 4) == 0;
    const uint32_t count = word(bytes, cursor);
    cursor += 8;
    for (uint32_t i = 0; i < count; ++i, cursor += 28) {
      if (cursor + 28 > directory_end)
        return false;
      uint32_t start = word(bytes, cursor + 20),
               size = word(bytes, cursor + 24);
      if (start < directory_end || start > bytes.size() ||
          size > bytes.size() - start)
        return false;
      if (menus && memcmp(bytes.data() + cursor, "APMK\0", 5) == 0) {
        main_start = start;
        main_size = size;
        main_entry = uint32_t(cursor);
      }
      if (menus && memcmp(bytes.data() + cursor, "APdb\0", 5) == 0 &&
          size == 13412)
        panel_start = start;
    }
  }
  if (cursor != directory_end || !main_start || !panel_start ||
      main_size != 6948)
    return false;
  // Keep the HD artwork and all first-panel bindings. The optional HD
  // selection4000 hosts construction; its absence makes the original
  // controller use selection2005, as in the native800x600 HUD. Remove that
  // widget and the second tracker, retaining the first tracker's right border.
  if (word(bytes, main_start + 5320) != 5 ||
      word(bytes, main_start + 5388) != 4000 ||
      word(bytes, main_start + 5480) != 0 ||
      word(bytes, main_start + 6944) != 0xffffffffu)
    return false;
  std::vector<uint8_t> main(bytes.begin() + main_start,
                            bytes.begin() + main_start + 5320);
  main.insert(main.end(), bytes.begin() + main_start + 5480,
              bytes.begin() + main_start + 5564);
  main.insert(main.end(), bytes.begin() + main_start + 6944,
              bytes.begin() + main_start + 6948);
  bytes.erase(bytes.begin() + main_start, bytes.begin() + main_start + main_size);
  bytes.insert(bytes.begin() + main_start, main.begin(), main.end());
  const int delta = int(main.size()) - int(main_size);
  cursor = 36;
  for (int section = 0; section < 2; ++section) {
    const uint32_t records = word(bytes, cursor);
    cursor += 8;
    for (uint32_t i = 0; i < records; ++i, cursor += 28) {
      const uint32_t start = word(bytes, cursor + 20);
      if (start > main_start)
        put(bytes, cursor + 20, int(start) + delta);
      if (cursor == main_entry)
        put(bytes, cursor + 24, int(main.size()));
    }
  }
  if (panel_start > main_start)
    panel_start = uint32_t(int(panel_start) + delta);
  main_size = uint32_t(main.size());
  // The SHA-pinned layout embeds a development placeholder in its menu.
  // Blank its glyphs without changing record sizes, bindings or source assets.
  constexpr char version_label[] = "Version #";
  const auto version = std::search(bytes.begin(), bytes.end(), version_label,
                                   version_label + sizeof(version_label) - 1);
  if (version != bytes.end())
    std::fill_n(version, sizeof(version_label) - 1, uint8_t(' '));
  source = std::move(bytes);
  return true;
}

// Match the measured 1080p layout's edge and center anchors. This changes
// world/HUD geometry, never sprite dimensions, resource IDs or input bindings.
bool make_layout(X86 *c, int w, int h) {
  if (!load_source() || w < 800 || h < 600 || w > 8192 || h > 8192)
    return false;
  char guest_path[128], path[1024];
  snprintf(guest_path, sizeof guest_path, "Data\\UIData_%d_%d.dat", w, h);
  if (!recomp_writable_path(guest_path, path, sizeof path))
    return false;
  auto data = source;
  const int dw = w - 1920, dh = h - 1080;
  int count = 0;
  for (uint32_t offset = 4; offset + 24 < main_size; offset += 4) {
    if (word(source, main_start + offset) != 2 ||
        (offset != 4 && word(source, main_start + offset - 8) != 0xffffffffu))
      continue;
    ++count;
    int x = int(word(source, main_start + offset + 4));
    int y = int(word(source, main_start + offset + 8));
    int rw = int(word(source, main_start + offset + 12));
    int rh = int(word(source, main_start + offset + 16));
    if (offset == 4) {
      rw = w;
      rh = h;
    } else {
      if (x >= 1800)
        x += dw;
      else if (offset == 248 || offset == 1668)
        x += int(std::floor(dw / 2.0));
      if (y >= 674)
        y += dh;
      if (offset == 88 || offset == 476 || offset == 3684)
        rw += dw;
      if (offset == 1828) {
        rw += dw;
        rh += dh;
      }
      if (offset == 3424 || offset == 5240)
        rh += dh;
      if (offset == 4112)
        y += dh;
      // The one tracking group retains the original single-panel spacing
      // at every size. Construction and selection share the native fallback.
      switch (offset) {
      case 964: y = h - 170; break;
      case 5004: case 3600: y = h - 171; break;
      case 3340: case 5324: y = h - 173; break;
      case 4860: y = h - 43; break;
      case 696: y = h - 27; break;
      case 1560: case 1920: case 2028: case 2144: case 2260:
      case 2376: case 4504: case 4744: y = h - 24; break;
      default: break;
      }
    }
    if (rw <= 0 || rh <= 0)
      return false;
    put(data, main_start + offset + 4, x);
    put(data, main_start + offset + 8, y);
    put(data, main_start + offset + 12, rw);
    put(data, main_start + offset + 16, rh);
  }
  if (count != 52)
    return false;
  put(data, main_start + 3716, 1312 + dw);
  constexpr int bottom[] = {11472, 11548, 11624, 11700, 11784, 11868, 12112,
                            12196, 12280, 12364, 12508, 12652, 13136};
  constexpr int center[] = {11944, 12028};
  for (int at : bottom)
    put(data, panel_start + at, int(word(source, panel_start + at)) + dh);
  for (int at : center)
    put(data, panel_start + at,
        int(word(source, panel_start + at)) + int(std::floor(dh / 2.0)));
  const int fd = os_fd_open(path, OS_O_WRONLY | OS_O_CREAT | OS_O_TRUNC);
  if (fd < 0)
    return false;
  size_t done = 0;
  while (done < data.size()) {
    const int64_t n = os_fd_write(fd, data.data() + done, data.size() - done);
    if (n <= 0)
      break;
    done += size_t(n);
  }
  os_fd_close(fd);
  if (done != data.size())
    return false;
  // Try to remove the previous generated layout from the writable tier.
  // The archive reader retains its open descriptor during the rebuild;
  // platforms that refuse removal while open can leave that file behind.
  if (!generated_path.empty() && generated_path != path)
    os_unlink(generated_path.c_str());
  layout_data = std::move(data);
  generated_path = path;
  recomp_invalidate_file_paths();
  // 004b9c40 chooses from a cached native layout catalogue. Rescan it
  // after creating a size, or it silently falls back to an older layout
  // when constructing subsequent menus/selection panels.
  const uint32_t layouts = rd32(0x0071c634);
  if (layouts && gm_valid(layouts, 0x4c)) {
    X86 extra = *c;
    extra.r[R_ECX] = layouts;
    guest_call(&extra, 0x004b9e70);
  }
  return ddraw_set_viewport_mode(w, h, 16) != 0;
}
bool target_size(int *w, int *h) {
  int vw, vh;
  if (!host_display_viewport_size(&vw, &vh) || vw <= 0 || vh <= 0)
    return false;
  double scale = quality_height ? double(quality_height) / vh : 1.0;
  scale = std::max({scale, 800.0 / vw, 600.0 / vh});
  *w = int(std::lround(vw * scale));
  *h = int(std::lround(vh * scale));
  return *w <= 8192 && *h <= 8192;
}
void save_quality() {
  char path[1024];
  if (!recomp_writable_path("browser-viewport.txt", path, sizeof path))
    return;
  const int fd = os_fd_open(path, OS_O_WRONLY | OS_O_CREAT | OS_O_TRUNC);
  if (fd < 0)
    return;
  char text[32];
  const int n = snprintf(text, sizeof text, "%d\n", quality_height);
  os_fd_write(fd, text, n);
  os_fd_close(fd);
}
// CYWindow child registration uses a bounded circular list: +0x44 points
// to the wrapper, wrapper+4 to its sentinel, each node+8 to the widget.
// Verified in FUN_004df260.asm and the CYWindow constructor 004e14e0.
std::vector<uint32_t> children(uint32_t root) {
  std::vector<uint32_t> result;
  if (!gm_valid(root, 0x48))
    return result;
  const uint32_t list = rd32(root + 0x44);
  if (!gm_valid(list, 12))
    return result;
  const uint32_t head = rd32(list + 4);
  if (!gm_valid(head, 12))
    return result;
  for (uint32_t node = rd32(head); node != head && result.size() < 512;
       node = rd32(node)) {
    if (!gm_valid(node, 12))
      break;
    const uint32_t widget = rd32(node + 8);
    if (gm_valid(widget, 0x48))
      result.push_back(widget);
  }
  return result;
}
void trace_inventory_quest_marker(X86 *c) {
  const char *debug = recomp_env("BROWSER_INVENTORY_DEBUG");
  if (!debug || strcmp(debug, "1"))
    return;
  // CYDialog's +4 is its CYWindow (0044e470 / 00489150). The window
  // resource ID and child geometry use the same verified fields as reflow.
  const uint32_t dialog = c->r[R_ECX];
  if (!gm_valid(dialog, 8))
    return;
  const uint32_t window = rd32(dialog + 4);
  if (!window || !gm_valid(window, 0x48) || rd32(window + 0x2c) != 0x30335041u)
    return;
  for (uint32_t child : children(window)) {
    if (rd32(child + 0x14) != 4017)
      continue;
    const int x = int(rd32(window + 4)) + int(rd32(child + 0x18));
    const int y = int(rd32(window + 8)) + int(rd32(child + 0x1c));
    static int last_x = -100000, last_y = -100000;
    static unsigned reports = 0;
    if ((x != last_x || y != last_y) && reports < 32) {
      last_x = x;
      last_y = y;
      ++reports;
      fprintf(stderr, "[inventory] Quest marker 4017 rect=%d,%d,%u,%u\n", x, y,
              rd32(child + 0x24), rd32(child + 0x20));
    }
    break;
  }
}
void set_rect(X86 *c, uint32_t widget, int x, int y, int w, int h) {
  X86 extra = *c;
  extra.r[R_ECX] = widget;
  const uint32_t args[] = {uint32_t(x), uint32_t(y), uint32_t(w), uint32_t(h),
                           0};
  // Original setter invalidates both old and new rectangles. Width is the
  // runtime member at +0x10, height +0x0c (the CAM record uses x,y,w,h).
  guest_call(&extra, 0x004e01f0, args, 5);
}
void set_widget_rect(X86 *c, uint32_t widget, int x, int y, int w, int h) {
  // CYWidget is a different class from its CYWindow owner. The original
  // property-2 parser calls virtual +0x114 with a left/top/right/bottom box
  // (0051cc30 -> 0051c390 -> 0051a8e0), including invalidation and placement.
  const uint32_t rect = heap_alloc(16);
  if (!rect)
    return;
  wr32(rect, x);
  wr32(rect + 4, y);
  wr32(rect + 8, x + w);
  wr32(rect + 12, y + h);
  X86 extra = *c;
  extra.r[R_ECX] = widget;
  guest_call(&extra, rd32(rd32(widget) + 0x114), rect);
  heap_free(rect);
}
int reflow_children(X86 *c, uint32_t root, const std::vector<uint8_t> &old_data,
                    uint32_t start, uint32_t size) {
  int matched = 0;
  for (uint32_t child : children(root)) {
    for (uint32_t at = 4; at + 24 < size; at += 4) {
      if (at == 4 || word(source, start + at) != 2 ||
          word(source, start + at - 8) != 0xffffffffu)
        continue;
      const size_t rect = start + at + 4;
      if (rd32(child + 0x18) != word(old_data, rect) ||
          rd32(child + 0x1c) != word(old_data, rect + 4) ||
          rd32(child + 0x24) != word(old_data, rect + 8) ||
          rd32(child + 0x20) != word(old_data, rect + 12))
        continue;
      ++matched;
      if (start == main_start && at == 3684) {
        // Property 42 has its own caption box. The original parser
        // (0051cc30) converts x,y,w,h to left,top,right,bottom and calls
        // virtual +0x1b8; retain that contract for the resized status.
        const uint32_t caption = heap_alloc(16);
        if (caption) {
          wr32(caption, 2);
          wr32(caption + 4, 3);
          wr32(caption + 8, word(layout_data, main_start + 3716) + 2);
          wr32(caption + 12, 25);
          X86 extra = *c;
          extra.r[R_ECX] = child;
          guest_call(&extra, rd32(rd32(child) + 0x1b8), caption);
          heap_free(caption);
        }
      }
      if (memcmp(old_data.data() + rect, layout_data.data() + rect, 16))
        set_widget_rect(c, child, int(word(layout_data, rect)),
                        int(word(layout_data, rect + 4)),
                        int(word(layout_data, rect + 8)),
                        int(word(layout_data, rect + 12)));
      break;
    }
  }
  return matched;
}
void reflow_windows(X86 *c, const std::vector<uint8_t> &old_data, int w, int h,
                    uint32_t old_primary, uint32_t old_offscreen, int old_w,
                    int old_h) {
  if (old_data.empty())
    return;
  const uint32_t dialog = rd32(0x006d830c);
  const uint32_t hud = gm_valid(dialog, 8) && dialog ? rd32(dialog + 4) : 0;
  // Active dialogs keep their state and controls; re-run native anchoring
  // against the replacement surface rather than recreating them.
  const uint32_t manager = rd32(0x006d8bc0);
  if (!manager || !gm_valid(manager, 8))
    return;
  const uint32_t list = rd32(manager + 4);
  if (!gm_valid(list, 12))
    return;
  const uint32_t head = rd32(list + 4);
  if (!gm_valid(head, 12))
    return;
  std::vector<uint32_t> windows;
  for (uint32_t node = rd32(head); node != head && windows.size() < 128;
       node = rd32(node)) {
    if (!gm_valid(node, 12))
      break;
    const uint32_t window = rd32(node + 8);
    if (gm_valid(window, 0x48))
      windows.push_back(window);
  }
  for (uint32_t window : windows) {
    // CYWindow's optional surface (+0x38) is borrowed, not refcounted.
    // Tooltips and auxiliary panels can still refer to the old device.
    const uint32_t parent = rd32(window + 0x38);
    if (parent && parent == old_primary)
      wr32(window + 0x38, rd32(0x007191b0));
    else if (parent && parent == old_offscreen)
      wr32(window + 0x38, rd32(0x0071c674));
    if (window != hud && rd32(window + 0x2c) == 0 &&
        int(rd32(window + 0x10)) == old_w && int(rd32(window + 0xc)) == old_h)
      set_rect(c, window, 0, 0, w, h);
  }
  if (std::find(windows.begin(), windows.end(), hud) != windows.end() &&
      rd32(hud + 0x2c) == 0x4b4d5041u) {
    const int count = reflow_children(c, hud, old_data, main_start, main_size);
    set_rect(c, hud, 0, 0, w, h);
    // Main view 0 is owned by the camera manager, not the HUD widget.
    // 00437e40 returns its descriptor; camera virtual +0x54 (005c2bc0)
    // accepts LTRB and recreates its backing store via +0x38/005c70a0.
    const uint32_t camera_manager = rd32(0x006d84b8);
    if (camera_manager && gm_valid(camera_manager, 0x10)) {
      wr32(camera_manager + 8, rd32(0x0071c844));
      X86 extra = *c;
      extra.r[R_ECX] = camera_manager;
      const uint32_t view = guest_call(&extra, 0x00437e40, 0u);
      const uint32_t camera = view && gm_valid(view, 12) ? rd32(view + 8) : 0;
      if (camera && gm_valid(camera, 0x140)) {
        const uint32_t rect = heap_alloc(16);
        if (rect) {
          extra = *c;
          extra.r[R_ECX] = hud;
          const uint32_t world = guest_call(&extra, 0x004df260, 2003u);
          if (!world || !gm_valid(world, 4)) {
            heap_free(rect);
            return;
          }
          extra = *c;
          extra.r[R_ECX] = world;
          guest_call(&extra, rd32(rd32(world) + 0x28), rect);
          extra = *c;
          extra.r[R_ECX] = camera;
          guest_call(&extra, rd32(rd32(camera) + 0x54), rect);
          // The base setter replaces the backing surface but leaves
          // constructor-owned clipping regions at their old bounds.
          // Match 005c2630 / 005c4040 / 005c70a0 initialization.
          const uint32_t cw = rd32(rect + 8) - rd32(rect);
          const uint32_t ch = rd32(rect + 12) - rd32(rect + 4);
          wr32(camera + 0x70, cw);
          wr32(camera + 0x74, ch);
          extra = *c;
          extra.r[R_ECX] = rd32(camera + 0x4c);
          guest_call(&extra, 0x005055b0, rect);
          const uint32_t local_clip = rd32(camera + 0xe8);
          if (local_clip) {
            const uint32_t args[] = {0, 0, cw, ch};
            extra = *c;
            extra.r[R_ECX] = local_clip;
            guest_call(&extra, 0x00505520, args, 4);
          }
          extra = *c;
          extra.r[R_ECX] = camera;
          guest_call(&extra, rd32(rd32(camera) + 0xc));
          fprintf(stderr, "[viewport] camera %08x %ux%u at %u,%u\n", camera,
                  rd32(camera + 0x2c) - rd32(camera + 0x24),
                  rd32(camera + 0x30) - rd32(camera + 0x28),
                  rd32(camera + 0x24), rd32(camera + 0x28));
          heap_free(rect);
        }
      }
    }
    fprintf(stderr, "[viewport] reflow matched %d HUD widgets\n", count);
  }
  for (uint32_t window : windows) {
    if (rd32(window + 0x2c) == 0x62645041u)
      reflow_children(c, window, old_data, panel_start, 13412);
    const uint32_t id = rd32(window + 0x2c);
    if (id == 0x35375041u || id == 0x32395041u) {
      // AP75 message box and AP92 command bar follow the bottom of
      // the world. AP75's child text area follows its window width.
      const int next_w =
          int(rd32(window + 0x10)) + (id == 0x35375041u ? w - old_w : 0);
      set_rect(c, window, int(rd32(window + 4)),
               int(rd32(window + 8)) + h - old_h, next_w,
               int(rd32(window + 0xc)));
      if (id == 0x35375041u) {
        X86 extra = *c;
        extra.r[R_ECX] = window;
        const uint32_t child = guest_call(&extra, 0x004df260, 1u);
        if (child && gm_valid(child, 0x28))
          set_widget_rect(c, child, 0, 0, next_w, int(rd32(window + 0xc)));
      }
    }
    if (window != hud && id != 0x35375041u && id != 0x32395041u) {
      X86 extra = *c;
      extra.r[R_ECX] = window;
      guest_call(&extra, 0x004e13f0);
    }
  }
}
void resize_at_boundary(X86 *c) {
  if (busy || resolution_menu_depth || !rd32(0x0071c674))
    return;
  const uint32_t state = rd32(0x006d7670);
  if (!state)
    return;
  const uint32_t phase = rd32(state);
  // Phase 2 owns quest loading; 4/5/6 run the front-end menus. Both the
  // world frame and CYDialogManager paint are safe rebuild boundaries.
  if (phase < 1 || phase > 8 || phase == 2)
    return;
  int w, h;
  if (!target_size(&w, &h))
    return;
  const uint64_t now = os_monotonic_ns();
  if (w != seen_width || h != seen_height) {
    seen_width = w;
    seen_height = h;
    changed_at = now;
    return;
  }
  if (now - changed_at < 180000000 ||
      (w == int(rd32(width_addr)) && h == int(rd32(height_addr))))
    return;
  busy = true;
  fprintf(stderr, "[viewport] rebuilding %dx%d in phase %u\n", w, h, phase);
  const auto old_data = layout_data;
  const uint32_t old_primary = rd32(0x007191b0),
                 old_offscreen = rd32(0x0071c674);
  const int old_w = int(rd32(width_addr)), old_h = int(rd32(height_addr));
  if (make_layout(c, w, h)) {
    // FUN_00462b30 owns device teardown, UI reload and world viewport
    // reattachment. Use a real guest call with an owned 3-word record.
    uint32_t mode = heap_alloc(12);
    if (mode) {
      wr32(mode, w);
      wr32(mode + 4, h);
      wr32(mode + 8, 16);
      X86 extra = *c;
      const uint32_t old_renderer = rd32(0x0071c844);
      const uint32_t render_state =
          old_renderer ? rd32(old_renderer + 0x2c) : 0;
      const uint32_t render_view = old_renderer ? rd32(old_renderer + 0x30) : 0;
      const uint32_t ok = guest_call(&extra, 0x00462b30, mode);
      fprintf(stderr,
              "[viewport] rebuilt device result %u; reflowing dialogs\n",
              ok & 0xff);
      heap_free(mode);
      if (ok & 0xff)
        reflow_windows(c, old_data, w, h, old_primary, old_offscreen, old_w,
                       old_h);
      if (ok & 0xff && rd32(0x006d84b8)) {
        const uint32_t renderer = rd32(0x0071c844);
        fprintf(stderr,
                "[viewport] restoring renderer state %08x view %u -> %08x\n",
                render_state, render_view, rd32(renderer + 0x2c));
        extra = *c;
        extra.r[R_ECX] = renderer;
        guest_call(&extra, rd32(rd32(renderer) + 0x50), render_state, 1u);
        extra = *c;
        extra.r[R_ECX] = renderer;
        guest_call(&extra, rd32(rd32(renderer) + 0x48), render_view, 1u);
      }

      const uint32_t surface = rd32(0x0071c674);
      extra = *c;
      extra.r[R_ECX] = surface;
      const uint32_t sw = guest_call(&extra, rd32(rd32(surface) + 0x14));
      extra = *c;
      extra.r[R_ECX] = surface;
      const uint32_t sh = guest_call(&extra, rd32(rd32(surface) + 0x1c));
      fprintf(stderr, "[viewport] %dx%d globals=%ux%u surface=%ux%u phase=%u\n",
              w, h, rd32(width_addr), rd32(height_addr), sw, sh, phase);
    }
  }
  busy = false;
}
} // namespace

extern "C" void majesty_browser_preferences(X86 *c) {
  fn_004b9180(c);
  int vw, vh;
  if (!host_display_viewport_size(&vw, &vh))
    return;
  char path[1024], text[32]{};
  if (recomp_readable_path("browser-viewport.txt", path, sizeof path)) {
    const int fd = os_fd_open(path, OS_O_RDONLY);
    if (fd >= 0) {
      os_fd_read(fd, text, sizeof text - 1);
      os_fd_close(fd);
    }
    int saved = 0;
    if (sscanf(text, "%d", &saved) == 1 && saved >= 600 && saved <= 2160)
      quality_height = saved;
  }
  int w, h;
  if (target_size(&w, &h) && make_layout(c, w, h)) {
    wr32(width_addr, w);
    wr32(height_addr, h);
    wr32(depth_addr, 16);
    fprintf(stderr, "[viewport] initial %dx%d (CSS %dx%d)\n", w, h, vw, vh);
  }
}
extern "C" void majesty_browser_frame(X86 *c) {
  majesty_received_transfer_poll();
  majesty_browser_campaign_input(c);
  resize_at_boundary(c);
  fn_00415dd0(c);
#ifndef __EMSCRIPTEN__
  majesty_browser_native_coop_pause_poll(c);
#endif
  // The original placement evaluator 0043cb00 stores its rejection reason
  // in 006d7d78. Observe changes after the frame without altering placement,
  // simulation or pointer state; useful for distinguishing UI from terrain
  // and prerequisite failures in multiplayer construction.
  static const bool build_debug = [] {
    const char *value = recomp_env("BROWSER_BUILD_DEBUG");
    return value && !strcmp(value, "1");
  }();
  if (build_debug) {
    install_build_trace();
    static uint32_t previous = 0xffffffffu;
    const uint32_t reason = rd32(0x006d7d78);
    if (reason != previous) {
      previous = reason;
      fprintf(stderr, "[construction] native placement reason=%u\n", reason);
    }
  }
}
extern "C" void majesty_browser_ui_frame(X86 *c) {
  resize_at_boundary(c);
  fn_004da450(c);

}
extern "C" void majesty_browser_menu_frame(X86 *c) {
  majesty_received_transfer_poll();
  majesty_browser_frontier_idle(c);
  resize_at_boundary(c);
  trace_inventory_quest_marker(c);
  fn_00489150(c);

}
extern "C" void majesty_browser_input_boundary(X86 *c) {
  const uint32_t state = rd32(0x006d7670);
  if (state && rd32(state) == 1)
    resize_at_boundary(c);
  fn_004f49d0(c);
  // Startup artwork is drawn without a CYWindow. Wait for a stable native
  // menu window in the input loop before revealing the browser canvas.
  static uint32_t ready_window = 0;
  static unsigned ready_polls = 0;
  static bool menu_ready = false;
  if (menu_ready || !state || !gm_valid(state, 4) || rd32(state) != 1)
    return;
  const uint32_t manager = rd32(0x006d8bc0);
  if (!manager || !gm_valid(manager, 8))
    return;
  const uint32_t list = rd32(manager + 4);
  if (!list || !gm_valid(list, 12))
    return;
  const uint32_t head = rd32(list + 4);
  if (!head || !gm_valid(head, 12))
    return;
  uint32_t window = 0;
  unsigned visited = 0;
  for (uint32_t node = rd32(head); node != head && visited++ < 128;
       node = rd32(node)) {
    if (!node || !gm_valid(node, 12))
      break;
    const uint32_t candidate = rd32(node + 8);
    if (candidate && gm_valid(candidate, 0x48) &&
        (rd32(candidate + 0x2c) & 0xffffu) == 0x5041u) {
      window = candidate;
      break;
    }
  }
  if (!window) {
    ready_window = 0;
    ready_polls = 0;
    return;
  }
  ready_polls = window == ready_window ? ready_polls + 1 : 1;
  ready_window = window;
  if (ready_polls >= 2) {
    menu_ready = true;
    fprintf(stderr, "[player] menu ready\n");
  }
}
extern "C" void majesty_browser_resolution(X86 *c) {
  int vw, vh;
  if (busy || !resolution_menu_depth || !host_display_viewport_size(&vw, &vh)) {
    fn_00462b30(c);
    return;
  }
  const uint32_t mode = rd32(c->r[R_ESP] + 4);
  const int input_w = int(rd32(mode)), input_h = int(rd32(mode + 4));
  // 00463439 is the original confirmation timeout/No rollback call.
  if (rd32(c->r[R_ESP]) == 0x00463439)
    quality_height = previous_quality;
  else
    quality_height = input_w == 800 && input_h == 600 ? 0 : input_h;
  int w, h;
  const auto old_data = layout_data;
  const uint32_t old_primary = rd32(0x007191b0),
                 old_offscreen = rd32(0x0071c674);
  const int old_w = int(rd32(width_addr)), old_h = int(rd32(height_addr));
  if (!target_size(&w, &h) || !make_layout(c, w, h)) {
    fn_00462b30(c);
    return;
  }
  // Original Graphics keeps its preset record for persistence and confirmation;
  // pass a separate record to its device rebuild with the actual browser
  // aspect.
  const uint32_t actual = heap_alloc(12);
  if (!actual) {
    fn_00462b30(c);
    return;
  }
  wr32(actual, w);
  wr32(actual + 4, h);
  wr32(actual + 8, 16);
  const uint32_t arg_at = c->r[R_ESP] + 4;
  wr32(arg_at, actual);
  fn_00462b30(c);
  wr32(arg_at, mode);
  heap_free(actual);
  if (c->r[R_EAX] & 0xff) {
    reflow_windows(c, old_data, w, h, old_primary, old_offscreen, old_w, old_h);
    fprintf(stderr, "[viewport] render height %d; device %ux%u\n",
            quality_height, rd32(width_addr), rd32(height_addr));
  }
}
extern "C" void majesty_browser_resolution_menu(X86 *c) {
  previous_quality = quality_height;
  ++resolution_menu_depth;
  fn_00463170(c);
  --resolution_menu_depth;
  if (host_display_viewport_size(&seen_width, &seen_height))
    save_quality();
  seen_width = seen_height = 0;
}
extern "C" void majesty_browser_resolution_label(X86 *c) {
  const uint32_t stack = c->r[R_ESP];
  // The one printf-style resolution label call in FUN_00462f70.asm.
  int vw, vh;
  if (!host_display_viewport_size(&vw, &vh) || rd32(stack) != 0x004630c9) {
    fn_004f5a80(c);
    return;
  }
  char text[48];
  const uint32_t w = rd32(stack + 12), h = rd32(stack + 16);
  if (w == 800 && h == 600)
    snprintf(text, sizeof text, "Fit browser (automatic)");
  else if (h == 2160)
    snprintf(text, sizeof text, "4K render quality");
  else
    snprintf(text, sizeof text, "%up render quality", h);
  const uint32_t label = heap_alloc(sizeof text);
  if (!label) {
    fn_004f5a80(c);
    return;
  }
  gm_put_str(label, text, sizeof text);
  const uint32_t format = rd32(stack + 8);
  wr32(stack + 8, label);
  fn_004f5a80(c);
  wr32(stack + 8, format);
  heap_free(label);
}
