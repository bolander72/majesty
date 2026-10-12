# Preserving empty native orders in arrival preparation

Actor-arrival preparation now accepts the pinned native order attachment's
canonical empty representation. It retains a separate 60-byte `order` record,
changes only its saved actor-ID prefix, and preserves the three version-1,
count-zero banks exactly. There is no order reference or navigation state to
remap in this representation. All six bank words are rechecked in the copied
record, so a bank changing after planning is rejected before records escape.
The native import fixture does **not** yet consume
this optional fourth record; this is preparation support, not playable travel.

The later [UNIT-level loading fixture](native-unit-order-loading.md) now executes
original empty-bank construction, reading, replacement, writing and clearing
under bounded stream/allocation models. It also identifies unchecked allocation
accesses and replacement ownership hazards. This narrows the reader gap but does
not change the native import fixture or qualify playable travel.

`web/world/orders.mjs` exhausts attachment metadata, validates only the selected
actor's order state and rejects duplicate selected attachments, extra components,
wrong sizes, unknown bank versions, nonzero counts and truncation. Orders of
other actors remain opaque. Preparation continues to refuse active/populated
orders and quest inventory. Container and script-reference checks still apply.
The added record is exactly 60 bytes; existing unit/agent/container caps are
unchanged. File requests remain at most 4 KiB and metadata scanning retains
only one page and the selected attachment.

The pinned unit writer `005b1be0` loops over three banks. Its original bank
presence predicate `005b2f40` delegates to getter `005b2b80`; a null bank pointer
selects the empty branch, which emits the six words `1,0,1,0,1,0`. A controlled
CPU fixture executes these original methods under two stack-fill patterns with
all bank pointers null. Integer stream I/O is modeled; no real serializer file
or order reader runs. All nine relevant initial slots across the observed
building, ground and vehicle tables are checked against the pinned executable.

Both calls pass, executing 228 original instructions in total. At most one
24,576-byte guest mapping set exists, and all mappings are unmapped and checked
empty after each call. This is a fixture address-space bound, not process RSS,
browser memory or allocator-reuse evidence. Allocated empty-bank callbacks,
restoration through the original order reader and live hero crossing remain
unqualified.

Twenty-two focused order/arrival tests and all 270 JavaScript tests pass. Tests
cover complete bank/payload preservation with only the actor identity changed,
page crossings, Blob adapters, duplicate/malformed records, unsupported states,
late attachment corruption and bounded I/O. Existing guard arrival packages
without orders retain their prior shape. Read-only preparation of the existing
Scions guard against its saved destination reproduces the preceding complete
plan and all three record digests exactly.

Read-only inspection of the existing copied Scions and Brashnard checkpoints
finds **89 order attachments and no canonical empty attachment**. Those saved
orders remain unsupported by the arrival preparer; this is not qualification of
a real hero's orders. Their file identities remain unchanged, reads are at most
4 KiB and no engine executes. The copies are 317,365 and 1,298,525 bytes.

The next populated-order dependency is now identified: the vehicle bank getter
`004300e0` constructs a class with initial table `00683148`. Its writer
`005e4e20` emits bank version/count, then an entry discriminator from entry
`+0x10` and calls the entry's virtual writer at `+8`. The reader is `005e4d20`.
These initial constructor/table/writer anchors are checked statically; populated
entry layouts, dynamic live types, targets and timers still need qualification.
The preparer never guesses their length or reference semantics.

Reproduce from the workspace root:

```sh
node --test tests/checkpoint-orders.test.mjs tests/checkpoint-arrival.test.mjs
upstream/majesty-recomp/.venv/bin/python scripts/check-native-empty-orders.py
node scripts/inspect-native-empty-orders.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
node --test tests/*.test.mjs
```

Evidence is in `output/empty-orders-focused.log`,
`output/empty-orders-workspace.log`,
`output/native-empty-orders-emulated-observed.json` and
`output/native-empty-orders-snapshots-observed.json`. Code remains source only;
no staging, native/WASM build, browser or game launch ran. Original profiles and
the served game are unchanged. App crashes remain unresolved and launches stay
suspended. Active hero orders, native arrival consumption, terrain continuity,
full native resource bounds and the full cooperative/expanding-world goal
remain unfinished.
