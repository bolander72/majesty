# Same-actor private script and command composition

Destination attempt 020 qualifies **64 simultaneous private UNIT/EA/GPL/command
compositions**. Four source NPC actors each run 16 cycles at qualified destination
coordinates and ground height, with rebound Path/Follow references, preserved
command ages and complete original routes. While the three actual command banks
remain attached, each actor receives a separately restored script with an original
constructor-reserved ID and age-preserving active context.

This extends [private script restoration](native-script-stage.md), which tested
separate clones. The actor's existing typed EA attribute is temporarily changed
to the reserved script ID. Original script ID-tree insertion makes its two self
references resolve to that exact clone; its two leader references resolve to
actual destination agent 2. Original setter `00626340` associates the clone's
cached native pointer with this exact actor. Original getter `00626310` returns
the same pointer. Three independently pinned instructions establish that setter's
sole write at agent header `+0x24` and four-byte stack cleanup.

## Scope of this association

The native actor's ID and world fields remain **zero**. Its script native-ID
field is also zero. The original cached backlink is explicitly prepared and
does not result from a native registry lookup. This verifies a private association,
not native identity publication or a durable paired reload. Methods that resolve
the saved native ID through the live world are not qualified for this private
object. No script is scheduled or executed. Published native identities and
natural lookup must precede gameplay activation.

The script ID tree is temporarily visible within the stopped fixture, but active,
deferred and name-index queue descriptors remain unchanged. Only the owned
actor's existing EA scalar changes, identified through original native attribute
lookup. No host pointer replaces a guest address. The supplied leader mapping
12 to2 and target-relative approach goal are fixture policies, not persistent
entity correspondence.

## Complete writers and teardown

Each cycle retains actual original writers for **UNIT, GPL and populated orders**:
192 joint artifacts total, plus 64 original grounded UNIT baselines. An independent
verifier starts from complete pinned source records, applies qualified coordinates,
ground/cell values and the one EA edit, and compares the full UNIT bytes. It
reconstructs all GPL identity/reference/stamp/destination edits and all command
timestamp/reference/goal/capacity/route edits, then compares every saved byte.
The script destination and Path goal are both `(1677,2170)` in every cycle.

Constructor reservations 79 through142 follow the 68 separate restoration
reservations in attempt020; the counter advances monotonically and is not rewound.
Four original ID-tree insert/erase warmups precede the measured steady baselines.
The private actor's EA is restored first, its script's cached backlink is cleared
through the original setter, the original ID-tree entry is erased, and the original
agent destructor/CRT free release the clone. All 64 cycles recover guest heap,
requested bytes, GPL pool and CRT occupancy. Actor header, restored EA, destination
leader header, registration count, queues, clock, factory counters and hooks are
preserved. This does not establish exhaustive linked-state or live alias closure.

Only after this unlinking does the existing original command cleanup run. All 64
grounded actor/command compositions and all 64 actual saved-file command replays
still pass, with complete route and allocator checks. The script association
itself is not replayed from a full world checkpoint.

## Evidence and reproduction

- `output/native-script-composed-arrival-observed.json`: 64 cycles, all 192
  joint writers and complete independently reconstructed expected data.
- `output/native-script-composed-arrival-controls-observed.json`: **35** offline
  refusals for corrupted links, IDs, exposure, scheduling, writer/teardown/allocator
  checks and actual UNIT/GPL/order files; no extra game launches.
- `output/native-script-composed-arrival-instruction-audit.json`: original
  cached-pointer setter plus the previously pinned original ID-tree operations.
- `output/native-script-composed-arrival-build.log`: official jobs-one build.

Add `--script-composed-arrival` to the preceding destination runner command with
`--private-script-stage --script-witness --composed-arrival` and its required
ground/navigation options, choosing a fresh attempt number. The runner rejects
missing dependencies before profile creation or process launch.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/check-native-script-composed-arrival.py \
  output/native-actor-cross-destination-attempt-020.json \
  --output output/<fresh-joint-report>.json
upstream/majesty-recomp/.venv/bin/python scripts/check-native-script-composed-arrival-controls.py \
  output/native-actor-cross-destination-attempt-020.json \
  --output output/<fresh-control-report>.json
```

Next: reserve/publish a native identity, establish original natural backlinks,
qualify joint reload and movement/script behavior, then safely activate and retire
live regional actors. Continuous native world expansion, persisted dormant state
and browser resource bounds remain open, together with complete co-op/shared
objectives/full-match completion and independent internet transport testing.
Browser/WASM launches remain suspended; the served WASM is unchanged.

The subsequent [world identity qualification](native-world-identity.md) adds
original native publication and natural script backlinks in attempt 024. Its
scope retains the original ORDR marker change and still excludes joint reload,
spatial insertion, scheduling and actor activation.
