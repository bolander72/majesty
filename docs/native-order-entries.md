# Bounded populated-order record inspection

`web/world/order-entries.mjs` now streams the current pinned writer layouts for
native order kinds 1, 2, 4, 5, 6, 7, 10 and 11. This adds structural inspection needed before
commands can accompany heroes between regions. It does **not** enable populated
orders in arrival preparation or install a game hook.

| Saved kind | Initial leaf table | Writer | Leaf version | Fixed body bytes |
| --- | --- | --- | --- | --- |
| 1 | `0068ad74` | `005df370` | 2 | 132 |
| 2 | `0068a224` | `005b6df0` | 2 | 176 |
| 4 | `0068add8` | `005e0e90` | 5 | 140 |
| 5 | `00689d74` | `005ab7e0` | 1 | 176 |
| 6 | `0068ae44` | `005e2390` | 1 | 176 |
| 7 | `0068ae74` | `005e2c40` | 1 | 112 |
| 10 | `00689e80` | `005b24f0` | 1 | 120 |
| 11 | `0068af24` | `005e40c0` | 1 | 200 |

Each bank has a version/count pair. Each entry has its own version/kind pair,
followed by its leaf body. The body includes base version 1 and embedded version
2; kind 11 additionally wraps the kind-5 writer with its own version-1 header.
Its base/embedded/kind fields are therefore one word later. The copied kind
must match the bank's discriminator. The embedded serializer
also contains a fixed 56-byte token block. The parser returns immutable copies
of raw words. A separate [Follow Unit target iterator](native-follow-target.md)
now identifies kind 6's saved unit target from pinned producer, writer and
consumer provenance. Other fields remain opaque; numeric matches do not classify
them as world references or clocks.

A separate [callback reader](native-order-callbacks.md) now inspects base tokens
and four leaf tokens. Only base callback script IDs have agent provenance and
partial remapping plans; this does not qualify complete commands for arrival.

Kinds 4 and 7 add variable sequences of two-word path points after their bodies.
For kind 4,
The count is the last fixed-body word, copied from native object `+0x4c`; the
writer traverses the point array at `+0x44`. Kind 7's last body word copies the
count at `+0x40`, and its array is at `+0x38`. Point pairs stream in blocks no larger
than 4 KiB. They are exposed as raw words, with no coordinate conversion or
destination-navigation edits. Correct structural length alone does not qualify
reuse of a source-world path in another realm.

The [native reader storage gate](native-order-readers.md) additionally checks
kind 4's separate saved capacity at body word 32 and kind 7's initial ten-point
buffer. Structural parsing of larger paths does not qualify native restoration.

The selected attachment must contain one primary component and fit within
64 KiB. Admission limits are 1,024 entries and 4,096 points per path. Fixed entry
captures are at most 200 bytes; each path block is at most 4 KiB. Metadata scanning
uses the existing 4 KiB page. The iterator retains no world catalogue or complete
region buffer. Consumers must exhaust it: a later unsupported kind, malformed
bank, trailing data or duplicate selected attachment rejects the record even
after earlier entries were yielded. These bounds do not cap native simulation
or measure JavaScript heap/RSS.

The isolated CPU fixture verifies factory switch entries, constructor-installed
leaf tables, their writer slots and the embedded base table against the pinned
executable. It executes the eight leaf writers, original shared/token/point
serializers and original stack zero-fill routine. Integer, floating-word and raw
stream primitives are modeled. External token pointers stay null. Kinds 4 and 7 run
with both zero and three points; distinct stack fills produce identical bytes.
Twenty original calls execute 4,478 original instructions. One 65,536-byte guest
mapping set exists at a time, with all mappings explicitly unmapped and checked
empty after each case. This is not a process-memory or real allocator bound.

The JavaScript reader reproduces all twenty emitted payloads word for word. It
also fully parses **all 89** order attachments in the copied Scions and
Brashnard checkpoints, totaling 154 entries and 316 path points. This improves the prior four-kind
reader, which completed 50 records and refused the remaining 39. These files
exercise kinds 2, 4, 5, 6, 7, 10 and 11; kind 1 is covered by original-writer
and synthetic checks. Other kinds and older versions remain unsupported.
Snapshot identities remain unchanged. Diagnostic
reads are serial, at most 4 KiB, with a separate 64 MiB / 16,384-request per-file
budget and a 128-attachment limit. The actual inspection reads about 6.3 MiB
across both files, including whole-file compatibility hashing.

Ten focused tests and all 280 JavaScript tests pass. Tests cover all supported
fixed layouts, Blob adapters, empty/absent banks, unknown kinds/versions, late
failure, duplicate attachments, truncation, trailing data, entry/record limits,
page crossings, both path formats, inherited version guards, 600-point block
streaming and the exact 4,096-point admission
boundary without retaining a point catalogue. Negative point counts represented
as unsigned words and out-of-range counts are rejected. Raw payload words stay
unchanged; no reference or migration edit plan is emitted.

```sh
node --test tests/order-entries.test.mjs
upstream/majesty-recomp/.venv/bin/python scripts/check-native-order-writers.py
node scripts/inspect-native-orders.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
node --test tests/*.test.mjs
```

Evidence is in `output/native-order-writers-emulated-observed.json`,
`output/native-order-entries-snapshots-observed.json`,
`output/order-entries-focused.log` and `output/order-entries-workspace.log`.
Unsupported entry classes, symbolic token meaning, remaining target/clock semantics,
destination path reconciliation, original order-reader restoration and engine
integration remain unfinished. [Arrival preparation](native-empty-orders.md)
still accepts only empty orders. No game, browser, staging or native/WASM build
ran; served artifacts and player profiles are unchanged. Crashes remain unresolved,
launches stay suspended and the full cooperative/expanding-world goal is active.
