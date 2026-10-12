# Partial UNIT bindings for native orders

`web/world/order-unit-bindings.mjs` adds a read-only reference iterator and
partial edit plans for four pinned native target fields. These extend the
earlier Follow Unit-only iterator without changing its behavior. No checkpoint
bytes are edited, no destination actor is allocated and populated-order arrival
remains disabled.

| Kind | Order class | Native field | Body word | Verified consumer |
| --- | --- | --- | --- | --- |
| 2 | Move | `+0x38` | 25 | `005b7430`, initial virtual slot `+0x1c` |
| 4 | Move Path | `+0x38` | 25 | `005e1330`, initial virtual slot `+0x18` |
| 6 | Follow Unit | `+0x38` | 25 | `005e2680`, initial virtual slot `+0x18` |
| 11 | Init Action | `+0x60` | 46 | `005e42d0`, registered procedure `0x1000` |

The original methods read these fields and pass them to world UNIT lookup
`005a10d0`. Kind 11's action callback is registered in the native procedure
table and reads the inherited action order's target; its extra version header
is accounted for in the word offset. This identifies that field's meaning
under the pinned action handler, not arbitrary replacement procedure behavior.
All four debug methods also label the field `_targetID`. Numeric matches alone
are not used to classify references: callback IDs, coordinates, action fields,
capacity and arbitrary user data remain outside these edit sites.

The static audit pins the executable SHA-256, 15 fully decoded local ranges
(303 instructions), 26 instruction anchors, four labeled formatting flows,
four initial consumer slots and the action procedure registration. Ten prior
original-writer replays reproduce the four native-field-to-body-word mappings.
The audit does not execute consumers, resolve a live world registry or establish
complete callback effects. The existing isolated captured-entry reader/writer
evidence remains source-compatible because its parser and runner are unchanged.

`checkpointOrderUnitReferencePlan` exhausts the full selected attachment before
consulting a resolver. Zero targets are preserved without asking for a binding.
Plans permit at most 128 nonzero sites, resolve each distinct source ID once,
require positive unsigned 32-bit destination IDs and reject different source
IDs that map to one destination. Resolvers must look up already reserved IDs,
not allocate actors. Frozen patches capture only the four-byte target field,
expected source value and replacement, together with bank/index/kind metadata.
Every result reports `completeOrderMigration: false`. Destination type,
ownership/association, source lease, precondition revalidation and all remaining
reference/clock/navigation rules still belong to the outer migration boundary;
this module provides no applier.

The copied Scions and Brashnard saves contain 89 order attachments and 92
qualified target fields: 31 Move, 32 Move Path, 25 Follow Unit and four Init
Action targets. **38 are zero; all 54 nonzero targets match exactly one saved
UNIT record.** All 89 source identity plans pass, with 54 unchanged-ID sites.
These prove saved membership and source identity behavior, not that targets are
alive, compatible or present in a destination realm. The inspector records
missing membership and verifies partial-plan rejection when it occurs; these
two unchanged fixtures have no missing targets.

Diagnostic I/O is serial and at most 4 KiB, totaling 26,738,573 bytes. Per-file
budgets limit reads to 64 MiB / 16,384 requests and attachments/target fields to
128. The inspector scans UNIT metadata separately for each nonzero target and
retains only per-actor referenced bindings, at most eight regular samples and
eight missing samples. It preserves no regional UNIT catalogue. Whole-file
hashes and file identities remain unchanged. These admission/I/O bounds do not
measure or bound browser heap, process RSS or complete native simulation.

Five focused tests cover the four layouts, the inherited target offset,
colliding opaque values, resolver caching, unsigned identities, frozen copied
plans, late malformed/unsupported/duplicate data, invalid/missing/aliased
bindings, zero targets and the exact 128-site limit. All 299 workspace JavaScript
tests pass. Evidence is in `output/native-order-unit-targets-audit.json`,
`output/native-order-unit-bindings-snapshots-observed.json`, their small logs,
the focused/workspace logs and
`output/native-order-unit-bindings-terminal-verified.json`.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-order-unit-targets.py
node --test tests/order-unit-bindings.test.mjs
node scripts/inspect-native-order-unit-bindings.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
node --test tests/*.test.mjs
```

Complete reference closure, other order kinds/fields, clocks, destination
navigation, full bank/actor restoration and live hero travel remain unfinished.
No game/browser launch, native/WASM build or staging change ran. The served game
is unchanged, crashes remain unresolved and the launch suspension holds. The
full co-op/expanding-world goal remains active.
