# Native order callback references

`web/world/order-callbacks.mjs` adds read-only callback inspection and a partial
edit plan for **base callback script-agent IDs**. This closes one reference
boundary needed to preserve commands during regional travel. Arrival still
rejects populated orders, and no complete command migration is qualified.

Each currently supported entry contains a base callback. The shared embedded
writer serializes its token at body word 10; kind 11's inherited version header
shifts that to word 11. The fixed 56-byte token contains a C-procedure ID at
word 0, a script ID at word 1, four reserved words and eight words of opaque
name data. The original name copy spans 32 bytes. The reader returns immutable
numeric copies without interpreting a name as an address, decoding it as text
or inferring references from numeric collisions.

Four leaf layouts also contain tokens:

| Kind | Debug label | Token body word |
| --- | --- | --- |
| 2 | missile callback | 30 |
| 5 | marker callback | 29 |
| 6 | follow callback | 30 |
| 11 | inherited marker callback | 30 |

Those leaf script IDs are exposed as raw `scriptId` values. Their destination
reference meaning remains unqualified. A nonzero leaf script ID rejects the
partial plan before any destination resolver is called.

The pinned native code distinguishes two namespaces. Bank dispatcher `005e5300`
looks up the token's C-procedure ID through the procedure registry and calls
the returned function. Base-order handler `005def50` instead passes the base
script ID to `00623850`, which queries manager `00633090` and changes the returned
agent's execution flags. The original agent lookup `006236b0` uses that same
manager query. Thus the base script field identifies a GPL agent; the procedure
ID must not be treated as a unit or agent ID. This establishes field provenance,
not complete callback effects or safe live execution in another region.

The static audit checks the executable SHA-256, 14 fully decoded ranges
(460 instructions), 39 instruction anchors, eight field labels and six virtual
slots. It verifies 28 callback token blocks from the twenty previously qualified
original writer replays. Those replays used modeled stream I/O and null external
name pointers. This pass does not execute native instructions or invoke original
order readers, script stopping or callback dispatch. Positive name copying is
statically inspected and remains unexecuted.

`checkpointOrderCallbackAgentPlan` fully traverses the selected order attachment
before consulting bindings. It permits at most 128 nonzero base reference sites,
requires positive 31-bit reserved destination IDs, resolves each distinct ID
once and rejects different source IDs mapped to the same destination agent.
Its frozen patches identify only four-byte script-ID fields, their expected
source values and replacement values. Procedure IDs, reserved data, names,
targets, clocks and paths are not edit sites. Every plan explicitly reports
`completeOrderMigration: false`. The resolver is a lookup of already reserved
IDs, not an allocator. A caller still needs an exclusive stopped source lease,
precondition revalidation, checked destination associations and all remaining
order migration rules before any application; this module provides no applier.

All 89 order attachments in the copied Scions and Brashnard snapshots pass the
new inspector, exposing 264 callback tokens (154 base and 110 leaf). The seven
nonzero base script IDs all match undeleted saved GPL agents associated with
the same actors as the respective orders. All leaf script IDs are zero in these
fixtures. Eight procedure IDs are nonzero. Identity plans cover all 89 records,
with seven script-ID sites; these source identity checks do not reserve or
validate destination IDs, classify heroes or prove restoration.

Both copied-file SHA-256 values and file identities remain unchanged. Diagnostic
I/O is serial, with reads no larger than 4 KiB, totaling 12,165,005 bytes. The
inspector retains only per-actor referenced bindings and eight samples per file,
with no regional agent catalogue. Separate per-file limits cap reads at
64 MiB / 16,384 requests, attachments and positive base sites at 128, and total
callback blocks at 1,024. These limits do not measure or bound browser heap,
native simulation, allocator reuse or resident process memory.

Six focused tests cover the eight supported base layouts, inherited token
offsets, numeric collisions, opaque copied values, resolver reuse, unsigned-ID
rejection, missing/invalid/aliased destination bindings, late malformed records,
unknown leaf references, absent/zero callbacks and the exact 128-site limit.
All 290 workspace JavaScript tests pass. Evidence is in
`output/native-order-callbacks-audit.json`,
`output/native-order-callbacks-snapshots-observed.json`, the focused/workspace
logs and `output/native-order-callbacks-terminal-verified.json`.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-order-callbacks.py
node --test tests/order-callbacks.test.mjs
node scripts/inspect-native-order-callbacks.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
node --test tests/*.test.mjs
```

Remaining targets, clocks, leaf callback semantics, additional entry kinds,
destination navigation and original order restoration still block populated
order arrival. No game/browser launch, native/WASM build or staging change ran.
Crashes remain unresolved and the launch suspension holds. Earlier qualification
reports retain their historical source hashes; the full co-op/expanding-world
goal is still active.
