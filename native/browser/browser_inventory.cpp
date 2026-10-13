// Installed Gold HD scripts name inventory queries absent from the pinned engine.
// Bridge its legacy inventory using original GPL values and list ownership.
#include "platform/os.h"
#include "runtime/guest.h"
#include "runtime/imports.h"
#include <cstdio>
#include <cstring>
#include <array>

extern "C" void fn_00424f10(X86 *);

namespace {
bool enabled() {
  const char *value = recomp_env("RULE_INVENTORY_COMPAT");
  return value && std::strcmp(value, "1") == 0;
}

struct Call {
  X86 extra;
  uint32_t scratch;
  explicit Call(X86 *c) : extra(*c), scratch(c->r[R_ESP] - 256) {
    // Temporaries stay above the nested guest stack, below the caller's args.
    extra.r[R_ESP] -= 512;
  }
  uint32_t method(uint32_t self, uint32_t address) {
    extra.r[R_ECX] = self;
    return guest_call(&extra, address);
  }
  uint32_t ref(uint32_t value, uint32_t offset) {
    return method(value, rd32(rd32(value) + offset));
  }
  uint32_t value(uint32_t context, uint32_t index) {
    return rd32(rd32(rd32(context + 4) + index * 4));
  }
  void error(const char *message) {
    std::fprintf(stderr, "[inventory] %s\n", message);
    gm_put_str(scratch + 64, message, 160);
    // Original cdecl GplException formatter and stdcall MSVC throw, as in
    // CreateNewInventoryItem (004232a2..004232bb). No fabricated GPL value.
    guest_call(&extra, 0x006292f0u, scratch, scratch + 64);
    guest_call(&extra, 0x0064cf1fu, scratch, 0x0069c678u);
  }
};

uint32_t runtime() {
  return rd32(rd32(0x007218b4u) + 0x10);
}

void get_items(X86 *c) {
  Call call(c);
  const uint32_t context = arg(c, 0);
  const uint32_t list = call.ref(call.value(context, 0), 0x34);
  const uint32_t agent = call.ref(call.value(context, 1), 0x5c);
  const uint32_t unit = call.method(agent, 0x00625ce0u);
  if (!unit)
    return; // The newer API also returns a real empty list for an invalid agent.

  // 004233d0/00491c50/004d6f10: world registry +c4, NOT unit +c4.
  // Tree nodes hold raw item ID +c and owning unit ID +10. The collection
  // owns legacy INV items, including clones; never substitute an empty list.
  const uint32_t collection = rd32(rd32(0x0071c68cu) + 0x10) + 0xc4;
  const uint32_t head = rd32(collection + 4);
  const uint32_t nil = rd32(0x006d8b58u);
  // Constructor 004d6530 and insertion 004d7810 keep size at +c;
  // +8 is the multimap's duplicate-key flag, not its size.
  const uint32_t count = rd32(collection + 0xc);
  const uint32_t owner = rd32(unit + 0x60);
  if (!head || !gm_valid(head, 12) || !nil || !gm_valid(nil, 12)) {
    call.error("GetInventoryItems: malformed legacy inventory header");
    return;
  }
  uint32_t node = rd32(head), visited = 0, added = 0;
  while (node != head) {
    if (!node || !gm_valid(node, 0x14) || visited++ >= count) {
      call.error("GetInventoryItems: malformed legacy inventory tree");
      return;
    }
    const uint32_t item = rd32(node + 0xc);
    if (rd32(node + 0x10) == owner) {
      if ((item & 0x00ffffffu) != 0x00564e49u) {
        call.error("GetInventoryItems: unsupported non-legacy inventory item");
        return;
      }
      call.extra.r[R_ECX] = rd32(runtime() + 0x1c);
      const uint32_t value = guest_call(&call.extra, 0x0062a810u, 1u);
      wr32(call.ref(value, 0x28), item);
      wr32(call.scratch, value);
      // Virtual +0x34 returns the embedded std::list at GplList+8
      // (0063a400), not the outer GPL value. Its head is wrapper+4.
      call.extra.r[R_ECX] = list;
      // Original std::list<GplValue*> insert: adopts the pooled integer.
      guest_call(&call.extra, 0x0063a310u, call.scratch + 4,
                 rd32(list + 4), call.scratch);
      ++added;
    }
    // Original tree iterator increment, as used by DeleteInventoryItem's
    // ownership scan (004d6995). Preserve its end-sentinel semantics.
    wr32(call.scratch + 8, node);
    call.method(call.scratch + 8, 0x004d77c0u);
    node = rd32(call.scratch + 8);
  }
  if (visited != count) {
    call.error("GetInventoryItems: legacy inventory size mismatch");
    return;
  }
  const char *debug = recomp_env("BROWSER_FRONTIER_GENERATION_DEBUG");
  if (debug && std::strcmp(debug, "1") == 0) {
    static unsigned reports = 0;
    if (reports++ < 32)
      std::fprintf(stderr, "[inventory] GetInventoryItems owner=%08x count=%u\n",
                   owner, added);
  }
}

void get_drop_type(X86 *c) {
  Call call(c);
  const uint32_t context = arg(c, 0);
  const uint32_t item = rd32(call.ref(call.value(context, 1), 0x28));
  // 2018 helper 0051fc00: integer 0..255 denotes a legacy item index;
  // raw INV identifiers have drop type 1. Generalized inventory is absent
  // from the pinned engine; non-inventory identifiers have drop type 0.
  const bool legacy = item <= 255 || (item & 0xffffffu) == 0x564e49u;
  wr32(call.ref(call.value(context, 0), 0x28), legacy ? 1u : 0u);
}

void can_drop(X86 *c) {
  Call call(c);
  const uint32_t context = arg(c, 0);
  const uint32_t item = rd32(call.ref(call.value(context, 1), 0x28));
  // 2018 callback 00432210 uses GetInventoryItemDropType != 0. The
  // installed Drop_QItems script separately excludes market/bazaar items.
  const bool legacy = item <= 255 || (item & 0xffffffu) == 0x564e49u;
  wr8(call.ref(call.value(context, 0), 0x2c), legacy ? 1u : 0u);
}

void get_agent_type(X86 *c) {
  Call call(c);
  const uint32_t context = arg(c, 0);
  call.ref(call.value(context, 1), 0x28);
  // Modern 0051fc60's verified legacy/default string at 0075a670.
  // Set through the old owning TString operator; no host pointer escapes.
  const uint32_t string = call.ref(call.value(context, 0), 0x30);
  gm_put_str(call.scratch, "Resource_Items", 32);
  call.extra.r[R_ECX] = string;
  guest_call(&call.extra, 0x004e3fc0u, call.scratch);
}

// Read-only diagnostic against actual carriers in a running, isolated solo
// world. All temporary values use the original GPL pool and are returned to
// it. No inventory, hero, quest objective or random state is changed.
uint32_t audit_value(Call &call, uint32_t type) {
  call.extra.r[R_ECX] = rd32(runtime() + 0x1c);
  return guest_call(&call.extra, 0x0062a810u, type);
}

void audit_release(Call &call, uint32_t value) {
  call.extra.r[R_ECX] = rd32(runtime() + 0x1c);
  guest_call(&call.extra, 0x0062aa20u, value);
}

void audit_query(Call &call, const char *name, uint32_t result,
                 uint32_t first, uint32_t second = 0) {
  const uint32_t size = uint32_t(std::strlen(name));
  gm_put_str(call.scratch + 16, name, 64);
  wr32(call.scratch, call.scratch + 16);
  wr32(call.scratch + 4, size);
  wr32(call.scratch + 8, size);
  call.extra.r[R_ECX] = rd32(runtime() + 8);
  const uint32_t fn = guest_call(&call.extra, 0x00631b40u, call.scratch);
  if (!fn) {
    call.error("Inventory audit: required native binding missing");
    return;
  }
  // Native GPL context's argument vector contains pointers to value slots;
  // slot zero is the result. Match 004233d0's actual calling convention.
  const uint32_t context = call.scratch + 80;
  const uint32_t vector = call.scratch + 96, slots = call.scratch + 112;
  const uint32_t values[] = {result, first, second};
  const uint32_t count = second ? 3u : 2u;
  wr32(context + 4, vector);
  wr32(context + 8, vector + count * 4);
  for (uint32_t i = 0; i < count; ++i) {
    wr32(vector + i * 4, slots + i * 4);
    wr32(slots + i * 4, values[i]);
  }
  guest_call(&call.extra, rd32(fn + 0x14), context, 0u, 0u);
}

bool audit_carrier(X86 *c, uint32_t owner, uint32_t &audited_items) {
  Call call(c);
  // The ownership tree stores native object IDs, not GPL agent IDs.
  // FindInventoryItem (004234bc..004234fb) resolves the native object and
  // reads its EA attribute before constructing the original GPL agent.
  call.extra.r[R_ECX] = rd32(rd32(0x0071c68cu) + 0x10);
  const uint32_t unit = guest_call(&call.extra, 0x005a10d0u, owner);
  if (!unit || !gm_valid(unit, 0x64)) {
    std::fprintf(stderr, "[inventory] Audit carrier=%08x native object unavailable\n", owner);
    return false;
  }
  wr32(call.scratch + 128, 0x4541u);
  call.extra.r[R_ECX] = unit + 4;
  guest_call(&call.extra, 0x00426700u, call.scratch + 132,
             call.scratch + 128);
  const uint32_t attribute = rd32(call.scratch + 132);
  if (attribute == rd32(unit + 8) || !gm_valid(attribute, 0x14)) {
    std::fprintf(stderr, "[inventory] Audit carrier=%08x GPL agent unavailable\n", owner);
    return false;
  }
  const uint32_t agent_id = rd32(attribute + 0x10);
  const uint32_t agent = audit_value(call, 5);
  call.extra.r[R_ECX] = agent;
  guest_call(&call.extra, 0x006254c0u, agent_id);
  const uint32_t input = audit_value(call, 1);
  const uint32_t integer = audit_value(call, 1);
  const uint32_t boolean = audit_value(call, 6);
  const uint32_t string = audit_value(call, 3);
  uint32_t items = 0;
  bool passed = call.method(agent, 0x00625ce0u) == unit;
  // Repeat using released/reused original list storage to catch retained
  // contents and broken pooled integer ownership, not just first allocation.
  for (unsigned repeat = 0; repeat < 2; ++repeat) {
    const uint32_t list = audit_value(call, 4);
    audit_query(call, "GetInventoryItems", list, agent);
    const uint32_t head = rd32(list + 0xc), count = rd32(list + 0x10);
    if (!count || (repeat && count != items))
      passed = false;
    items = count;
    uint32_t node = rd32(head), seen = 0;
    while (node != head && seen < count) {
      ++seen;
      const uint32_t item = rd32(call.ref(rd32(node + 8), 0x28));
      passed = passed && (item & 0xffffffu) == 0x564e49u;
      if (!repeat && seen <= 32)
        std::fprintf(stderr, "[inventory] Audit item carrier=%08x id=%08x\n",
                     owner, item);
      for (uint32_t argument : {item, item >> 24}) {
        wr32(call.ref(input, 0x28), argument);
        audit_query(call, "GetInventoryItemDropType", integer, input);
        passed = passed && rd32(call.ref(integer, 0x28)) == 1;
        audit_query(call, "CanDropInventoryItem", boolean, input);
        passed = passed && rd8(call.ref(boolean, 0x2c)) != 0;
        audit_query(call, "GetInventoryItemAgentType", string, input);
        const uint32_t text = call.ref(string, 0x30);
        passed = passed && gm_str(rd32(text)) == "Resource_Items";
      }
      // Independent existing intrinsic checks the carrier's attributes,
      // rather than reinterpreting the inventory ownership map again.
      wr32(call.ref(input, 0x28), item >> 24);
      audit_query(call, "AgentHasInventoryItem", boolean, input, agent);
      passed = passed && rd8(call.ref(boolean, 0x2c)) != 0;
      node = rd32(node);
    }
    passed = passed && node == head && seen == count;
    audit_release(call, list);
  }
  for (uint32_t value : {string, boolean, integer, input, agent})
    audit_release(call, value);
  audited_items += items;
  std::fprintf(stderr,
               "[inventory] Audit carrier=%08x items=%u metadata-membership-reuse=%s\n",
               owner, items, passed ? "pass" : "FAIL");
  return passed;
}
} // namespace

extern "C" void majesty_browser_inventory_audit(X86 *c) {
  const char *debug = recomp_env("BROWSER_INVENTORY_DEBUG");
  if (!enabled() || !debug || std::strcmp(debug, "1") != 0)
    return;
  Call call(c);
  const uint32_t collection = rd32(rd32(0x0071c68cu) + 0x10) + 0xc4;
  const uint32_t head = rd32(collection + 4), count = rd32(collection + 0xc);
  std::array<uint32_t, 32> owners{};
  uint32_t carriers = 0, visited = 0, node = rd32(head);
  while (node != head && visited++ < count) {
    const uint32_t owner = rd32(node + 0x10);
    bool known = false;
    for (uint32_t i = 0; i < carriers; ++i)
      known = known || owners[i] == owner;
    if (!known) {
      if (carriers == owners.size()) {
        std::fprintf(stderr, "[inventory] Audit limited to 32 carriers\n");
        break;
      }
      owners[carriers++] = owner;
    }
    wr32(call.scratch, node);
    call.method(call.scratch, 0x004d77c0u);
    node = rd32(call.scratch);
  }
  uint32_t audited_items = 0;
  bool passed = carriers != 0;
  for (uint32_t i = 0; i < carriers; ++i)
    passed = audit_carrier(c, owners[i], audited_items) && passed;
  passed = passed && node == head && visited == count && audited_items == count;
  std::fprintf(stderr,
               "[inventory] Audit complete carriers=%u collection-items=%u audited-items=%u result=%s\n",
               carriers, count, audited_items, passed ? "pass" : "FAIL");
}

extern "C" void majesty_browser_inventory_register(X86 *c) {
  fn_00424f10(c);
  if (!enabled())
    return;
  Call call(c);
  const struct Binding {
    const char *name;
    void (*fn)(X86 *);
    uint32_t type;
  } bindings[] = {{"GetInventoryItems", get_items, 4},
                  {"GetInventoryItemDropType", get_drop_type, 1},
                  {"GetInventoryItemAgentType", get_agent_type, 3},
                  {"CanDropInventoryItem", can_drop, 6}};
  for (const auto &binding : bindings) {
    const uint32_t length = uint32_t(std::strlen(binding.name));
    gm_put_str(call.scratch + 16, binding.name, 64);
    // Registry insertion copies this borrowed name through original TString
    // constructors. Repeated runtime initialization preserves existing APIs.
    wr32(call.scratch, call.scratch + 16);
    wr32(call.scratch + 4, length);
    wr32(call.scratch + 8, length);
    const uint32_t target = imports_alloc_trampoline(
        "MajestyCompat", binding.name, binding.fn, ARGC_CDECL);
    call.extra.r[R_ECX] = rd32(runtime() + 8);
    const uint32_t args[] = {call.scratch, target, binding.type, 0, 0};
    guest_call(&call.extra, 0x00631c00u, args, 5);
  }
  std::fprintf(stderr, "[inventory] Legacy inventory compatibility registered\n");
}
