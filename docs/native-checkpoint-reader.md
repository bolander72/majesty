# Native checkpoint metadata reader

The expanding-world prototype needs to identify saved units without restoring
every dormant kingdom or retaining all its terrain. `web/world/checkpoint.mjs`
now provides asynchronous metadata iterators for the pinned original GMP format.
This is inspection groundwork for actor handoff; it does not export, import,
activate or transfer an original unit.

`checkpointChunks(source)` yields top-level chunk ranges.
`checkpointUnits(source)` yields the building, vehicle, ground-unit, reward,
message-effect and off-map-unit records, including their primary description
keys, seven opaque saved words and component ranges. `source` exposes a byte
size and asynchronous `readAt(offset, length)` returning a `Uint8Array`.
`checkpointFile(file)` adapts a browser `File` or `Blob` using slice reads.

Each iterator owns one reusable 4 KiB page. It performs one source read at a
time and copies at most 36 metadata bytes from that page for parsing, including
records crossing a page boundary. It does not retain previously visited pages
or collect all units. Callers determine how many yielded records they retain.
The offline CLI keeps only 32 samples and hashes the metadata incrementally.
The underlying source may allocate a temporary page while satisfying a read;
4 KiB is the cache capacity, not a claim about total browser memory.

The current limits are 64 MiB per regional checkpoint, 100,000 unit records,
128 root chunks and eight components per unit. Malformed ranges, duplicate or
missing unit groups, invalid component counts, unsupported primary versions,
duplicate components and short reads reject the iterator. The file header's
record count is not universally a nested-chunk count: terrain vertices must
not be interpreted as chunk headers. Unknown root data and secondary component
payloads are skipped rather than validated as complete simulation state.

An iterator can yield earlier metadata before discovering a damaged later
record. Consumers must finish inspection successfully before publishing any
derived handoff or restore plan. Inspection does not validate all payloads,
external references, executable/content compatibility or a changing file.
The CLI checks the opened file's size and modification/change times again when
finished; a future transfer must additionally verify the committed checkpoint
identity and all content it uses. Guest addresses and the opaque saved words
must not be treated as portable actor identity.

## Qualification on 2026-10-03

The retained owned Scions save is 317365 bytes, SHA-256
`6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1`.
It contains three buildings, six vehicles and 471 ground units. All 480 parsed
records match an independent offline chunk reader. The first 32 description
keys also match the original native save callback observations. The independent
reference uses a whole small fixture offline; the production iterator does not.

For the CLI's root scan followed by its unit scan:

| Measurement | Uncached metadata reads | Fixed-page metadata reads |
| --- | ---: | ---: |
| Source read requests | 1485 | 26 |
| Bytes read | 33360 | 102250 |
| Largest individual read | 36 | 4096 |
| Retained CLI samples | 32 | 32 |

The page cache trades extra bytes per read for fewer asynchronous requests.
Counts, chunk ranges and sample metadata remain identical. This is an I/O
measurement, not a gameplay FPS or total-memory benchmark.

Ten new automated tests pass, including malformed input, page crossings, large
skipped terrain payloads, sequential read bounds and the standard Blob adapter.
The reader plus existing world/region-store tests pass 30 tests; the complete
JavaScript suite passes 39 tests. An isolated
in-app-browser File API check also locates all 480 units, matches the 32 samples,
makes 26 reads, keeps one read in flight and rejects truncated/oversized input.
Its test harness fetches the whole small fixture to construct a `File`; that
fixture setup is outside the reader and must not be counted as streaming proof.
The first browser assertion expected only a truncated-header error; the actual
truncated final payload correctly produced a boundary error. The corrected
assertion passed. The owned tab and temporary server were closed afterward.

Reproduce the offline inspection with an owned save:

```sh
node scripts/inspect-native-checkpoint.mjs '/absolute/path/to/owned-save.GMP'
node --test tests/checkpoint.test.mjs tests/world.test.mjs tests/region-store.test.mjs
python3 scripts/stage-world.py
```

Evidence: `output/checkpoint-unit-index-before-cache.json`,
`output/checkpoint-unit-index-observed.json`,
`output/checkpoint-reader-native-observed.json`,
`output/checkpoint-reader-browser-observed.json`,
`output/checkpoint-reader-browser-observed.png` and
`output/checkpoint-reader-tests.log` and
`output/checkpoint-reader-all-js-tests.log`.

The staged JavaScript module matches the qualified source. No native or WASM
code changed for this reader; the existing `ab45eba3...7bdb82` engine remains
in use. Original actor reference remapping, native terrain/navigation streaming,
cooperative region activation and independent internet play remain open work.

## Saved associations and inventory ownership

The reader now also exposes `checkpointAttachments(source)`,
`checkpointContainerEntries(source)` and `checkpointInventory(source)`.
These retain the same one-page cache and sequential reads, and yield records
without collecting a world-sized reference graph. Each diagnostic CLI phase
retains at most 32 samples. `scripts/inspect-native-unit-references.mjs`
reports counts, ranges, read measurements and an incremental metadata hash.

A separate strict pinned-PE audit verifies 1450 instructions and the ORDR,
CONT and GSGL descriptor callbacks. The original order/container group writers
write Unit+60 immediately before each associated chunk; the group readers look
up that saved ID in the native registry. The second raw word in a unit's PRIM
header is therefore its saved native unit ID. This adds one mapped field to
the seven raw words retained above; the other unmapped fields remain opaque.
Those IDs are scoped to one saved world and can collide between regions.
They must not be used as portable profile or actor identity.

Container state has counted groups and member pairs. Before writing, the
original code converts live owner/member pointers into saved IDs; member flag
bit 0 indicates an ID. It resolves them back to live pointers afterward, and
does the corresponding resolution during loading. The new reader reports the
group kind, group owner, member value and flags. A clear ID bit produces an
opaque value with `targetUnitId: null`; it is never dereferenced as a guest
pointer. Group kind numbers retain their native values; their gameplay names
have not been mapped.

Inventory pairs occur inside version-6 GSGL after 19 four-byte prefix words
and a counted definition-ID set. The pinned writer emits a count followed by
`(item ID, owner unit ID)` pairs. This is a global registry rather than a list
embedded in every hero's primary state. The iterator reads that table only;
remaining global, kingdom and quest data and original order target payloads
are still opaque. A complete hero transfer needs those references audited and
rebuilt before activation. Calling a low-level original serializer while its
pointer-to-ID conversion is in progress would not be a safe shortcut.

Current qualification:

| Owned checkpoint | Saved units | Order records | Container records | Container groups / members | Inventory pairs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Scions, `6e6a2ee1...76e2d1` | 480 | 7 | 4 | 5 / 6 | 0 |
| Brashnard, `31059d44...650e13` | 1960 | 82 | 1 | 1 / 0 | 7 |

Every association/group/member/inventory-owner ID in these fixtures resolves
to a saved unit. Complete metadata hashes and all sampled ranges match an
independent offline reader. All seven Brashnard item/carrier pairs additionally
match the recorded original native inventory queries from that exact file.
These are quest items on original map objects; held hero inventory, death
drops, pickup and exclusion rules are not qualified by this observation.
An earlier Brashnard fixture (`65b0bb45...2a1be`) was also inspected; it is
retained separately and was not compared to queries from the later file.

Eleven new association tests pass; the complete JavaScript suite passes 50
tests. The in-app-browser File API qualification compares every decoded record
in both fixtures with the independent reference. The Scions iterators each
make six reads (22453 bytes); Brashnard order/container inspection takes 14
reads (57344 bytes), and inventory takes seven (28672 bytes). Each iterator
keeps one read in flight with a maximum 4096-byte source request. Browser tests
also reject a truncated final payload even after earlier metadata was yielded,
which verifies that consumers must await successful completion. Test setup
materializes small fixture Files and reference arrays outside the iterator;
these observations do not prove a total browser-memory or FPS bound.

The browser tab and its temporary local fixture server were closed. Staging
matches the qualified source. The earlier 480-unit index, its metadata hash
and its 26 source reads remain identical. Native/WASM code and its staged
manifest identity are unchanged.

Reproduce the audit and inspection from the workspace root:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-unit-references.py
node scripts/inspect-native-unit-references.mjs '/absolute/path/to/owned-save.GMP'
node --test tests/*.test.mjs
```

Evidence: `output/native-unit-reference-audit.json`,
`output/checkpoint-unit-references-native-observed.json`,
`output/checkpoint-unit-references-scions.json`,
`output/checkpoint-unit-references-brashnard.json`,
`output/checkpoint-unit-references-browser-observed.json`,
`output/checkpoint-unit-references-browser-observed.png` and
`output/checkpoint-unit-reference-all-js-tests.log`. The audit rejects an
incorrect executable before decoding it; the negative result is retained in
`output/unit-reference-audit-wrong-exe.log`.

## Ownership, physical attachment and fixed placement

`checkpointPlacements(source)` now yields saved unit IDs, signed player
numbers, physical parent IDs, raw state flags and three signed fixed-position
components. It leaves the existing `checkpointUnits` metadata shape unchanged.
The CLI now includes a placement phase with at most 32 retained samples.

The expanded strict PE audit decodes 1657 instructions and verifies owner
getter/setter slots for the three vtables observed in the native unit samples
(building, ground and vehicle). The original GetUnitPlayerNumber binding calls
virtual slot +1c, whose implementation at 005a2660 returns Unit+70. This maps
saved primary word 5 to a player number, including the observed -1 owner value
for unowned ground scenery. The raw primary words still preserve unsigned bit
patterns; the placement API interprets the owner as a signed integer.

The original owner setter writes Unit+70 and calls virtual +b8 when it changes.
The GPL SetUnitPlayerNumber callback performs further game notifications.
Moving a hero into another kingdom therefore requires the original ownership
lifecycle rather than changing one saved word and assuming registration is
complete. This inspection module does not invoke either setter.

Physical parent Unit+74 and GPL gameplay parent are different relationships.
The former is primary word 6 and participates in position resolution. The
original fixed-position helper resolves that ID unless raw state flag bit 7
is set. Depending on the unit definition, it inherits the parent's position
or adds its own offset. The GPL GetParent callback instead queries container
kind 101 and skips reward-kind members. A physical parent must not be treated
as a hero's home building or substituted for those gameplay relationships.

The primary header copies Unit+48/+4c/+50 into bytes 28..39 as three signed
fixed coordinates. The original LocationOf path resolves physical attachment
and then shifts x/y arithmetically right by 11. For independent placements,
the new `mapPosition` applies that same shift. These are original game/GPL
coordinate units, not atlas cells, native terrain-vertex indices or global
coordinates in a combined world. For placements that depend on a parent,
`requiresParentPosition` is true and `mapPosition` is null. Compatible unit
definitions and the parent's resolved position are required before computing
that coordinate; raw saved offsets must not be reported as the result.

Placement inspection reads the seven primary words and the position together
in forward order with the same 4 KiB cache. A stress test exposed redundant
page reads when coordinates were fetched after the basic metadata iterator
had advanced. Reading positions during primary decoding reduces that
1,000-unit case from 23 reads / 92864 bytes to 19 reads / 76480 bytes, with an
identical metadata hash. This is an I/O improvement, not an FPS measurement.
Each source request remains at most 4096 bytes; metadata copies remain at
most 36 bytes, and no cache grows with the number of visited units or regions.

| Owned checkpoint | Placement records | Player 0 / player 7 / unowned | Parent-dependent placements | Reads / bytes |
| --- | ---: | ---: | ---: | ---: |
| Scions | 480 | 5 / 4 / 471 | 2 | 20 / 79797 |
| Brashnard | 1960 | 3 / 76 / 1881 | 0 | 69 / 282624 |

An independent offline scan matches every placement in these exact fixtures,
including signed values, ranges and null parent-dependent coordinates. All
physical parent IDs resolve to saved units. Browser File API qualification
also matches every placement, keeps one read in flight and rejects truncated
final data after earlier records have been yielded. Its fixture Files and
reference arrays are materialized outside the reader as test setup; total
browser memory is not qualified by those observations.

Seven placement tests pass, covering negative coordinates/owners, parent flags,
page crossings, bounded large scans, Blob slicing and incomplete position
headers. The complete JavaScript suite passes 57 tests. Prior order/container/
inventory metadata and the original 480-unit index remain identical. Source,
browser fixture and staged module match. The owned test tab and temporary
fixture server were closed; the native/WASM engine identity is unchanged.

Evidence: `output/checkpoint-placement-native-observed.json`,
`output/checkpoint-unit-placements-scions.json`,
`output/checkpoint-unit-placements-brashnard.json`,
`output/checkpoint-placement-browser-observed.json`,
`output/checkpoint-placement-browser-observed.png`,
`output/checkpoint-placement-scan-before.json`,
`output/checkpoint-placement-scan-after.json` and
`output/checkpoint-placement-all-js-tests.log`. The pinned audit again rejects
an incorrect executable. This qualifies instruction-backed placement metadata,
not a live LocationOf query or registration in a destination simulation.

The next engine handoff must remap saved IDs and physical/gameplay parents,
use the ownership lifecycle, preserve actor script state and timers, rebuild
orders/navigation and commit both regional checkpoints consistently. This
reader does not move a hero, resolve a combined world, stream native terrain
or implement cooperative region activation.
