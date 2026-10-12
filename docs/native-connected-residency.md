# Generated kingdoms across unload and return

The retained message-queue [lifetime observation](native-page-owner-lifetime.md)
now identifies live descriptors with one pending message after each unload.
It does not establish safe retirement or a memory bound.

## Committed hero kingdoms in one process

Build082 and `native-hero-region-travel-attempt-001.json` complete four visits
through the original Load Game menu in one native process, exit0. A native-only
`BROWSER_STREAMING_REGISTERED_HERO_RESIDENCY_FIXTURE=v1` option starts the
existing save/dispose/load lifecycle in home0_0; generated-region initialization
keeps its older remote-first order. Each visit completes20 original ticks and
publishes its original full save before original dispatcher teardown. All six
tracked world roots are freed exactly once before the next world loads.

| Visit | Kingdom | Loaded clock | Saved clock |
| --- | --- | ---: | ---: |
| 0 | Home0_0 | 31,800 | 32,800 |
| 1 | Remote1_0 | 24,250 | 25,250 |
| 2 | Home0_0 | 32,800 | 33,800 |
| 3 | Remote1_0 | 25,250 | 26,250 |

Independent `native-hero-region-travel-001-observed.json` checks actual selected
revision2 exports, all four saved returns, keyed entities and attachments,
queues, gameplay sections, clocks and both RNGs. Only previously audited save
metadata, terrain shading cache and identical ORDR serialization permutations
are normalized. Home504/GPL28 stays physically inside registered469/GPL7 with
reciprocal rosters, one queue entry and the original Rest_at_guild context.
Remote554/GPL48/effect555 stay absent; native-less45 remains exact and unscheduled.
All intermediate saved pairs pass registered single-owner checks. The state
reader now requires the exact declared unscheduled-agent set; omitted schedules,
imaginary proxies and duplicate declarations fail. Legacy callers still require
all agents scheduled.46 focused tests pass, including home-first trace/refusal
and dormant-agent cases. Reinspection of legacy attempt007 retains its four
successful cycles and original first-load failure; no older failure is promoted.

Native process32163 ran56,736ms; maximum sampled RSS185,876,480B (about177MiB).
Post-unload guest heap grows from23,060,256 to23,168,256B for the two home visits,
and24,381,904 to24,608,480B for remote visits. Four visits do not demonstrate a
plateau or sustained native/browser memory bound. Original selected stores,
producer worlds and settings remain unchanged. Exact generation082 is retained
in `native-hero-region-travel-generation-082-preserved.json`.

This qualifies original kingdom save/unload/return with a resident hero; the
Load Game menu drives transitions. Seamless spatial crossing, automatic travel,
browser integration, full rest completion and cooperative publication remain
unfinished. Served WASM is unchanged and browser game testing stays suspended.

The subsequent [idle tile cleanup trial](native-idle-tile-release.md) reaches
four safe original menu-entry boundaries but finds no eligible buffers.
Subsequent bounded counters/event replay show0,1,0,0 tracked survivors, with the
one zero-reference entry failing descriptor admission and30 allocations occurring
after the final sweep. It reclaims zero bytes; allocation growth remains
unresolved.

The [actual saved-kingdom heap captures](native-hero-region-heap.md) reuse native088
and retain full return/ownership qualification. A229376-byte group appears once;
4096-byte queue blocks grow9→12. Their live ownership needs further qualification
before retirement. No memory bound or performance gain is claimed.

## Earlier generated-world trial

The connected-terrain prototype now has an original-engine unload/revisit
trial. One native process loads the saved `1_0` kingdom, saves and unloads it,
does the same for `0_0`, then returns to both evolving kingdoms. Every return
preserves the preceding saved unit, script, attachment and queue records, both
random generators, game clock and world sections. Initial loads still change
primary fields, so full generated-region handoff remains unqualified.

## Integration and observed run

The existing native residency path already owns original checkpoint writing,
latest-file replacement, original phase requests and dispatcher teardown.
The new native-only `BROWSER_STREAMING_CONNECTED_RESIDENCY_FIXTURE=v1` mode
uses that path for two 128-cell generated maps with 256 × 256 actor grids.
It requires an owned `actor-arrival-fixture-connected-residency-*` profile,
the existing persistence fixture and matching terrain/grid dimensions.
The older alternating 256/512-grid mission mode retains its original checks.
No new destructor, raw free, browser activation or hero insertion is introduced.

Official one-job build 039 succeeds. Its executable SHA-256 is
`833418ee3da2860c42253dad0141f32bf2a7ba49fbf357d18c9c0564b390ece0`;
streaming source SHA-256 is
`4c724cf643988eb977e59bce59a1685a092be897bbfb19b167a2804c9deba20b`.
The generated inputs come from the preceding qualified build-038 saves.

Attempt 001 observes three visits and one return. Attempt 002 observes four
visits, including both returns, and exits successfully after 55.72 seconds:

| Visit | Region | Clock restored | Clock saved after 20 completed ticks | Saved units |
| --- | --- | ---: | ---: | ---: |
| 0 | `1_0` | 8,600 | 9,600 | 441 |
| 1 | `0_0` | 8,750 | 9,750 | 444 |
| 2 | `1_0` | 9,600 | 10,600 | 441 |
| 3 | `0_0` | 9,750 | 10,750 | 444 |

Each saved after-state is the exact source of that region's next before-state.
Both returns have no entity/command/queue differences or root-section
differences under the comparison described below. All six tracked world,
factory, terrain, grid and pointer-table roots are freed once on every exit.
The next original load starts only after that exit. Latest region files match
their final original snapshots. This observes one active native kingdom at a
time; the Load Game menu still drives the transitions.

Maximum sampled RSS is 184,500,224 bytes (about 176 MiB), below the runner's
512 MiB ceiling. Four short visits and sampled RSS do not establish sustained
native, WASM, browser or GPU memory limits. Original generated saves and
settings remain unchanged; all writes are within the new owned fixture.

## First-load failures remain failures

The first native load changes these saved primary fields:

- One building in each kingdom changes its primary flags word from 513 to
  512: IDs 529 in `1_0` and 475 in `0_0`.
- The version-6 GSGL word at payload offset 24 changes from zero to 533 or 477.
- In `1_0`, the opaque vertex word at cell coordinates `(28,126)` changes two
  bytes. Its height remains unchanged. No such terrain change occurs in `0_0`.
- Original ORDR serialization ordering also differs on the initial loads;
  keyed attachment bytes remain available for exact comparison.

The original load-transform investigation below narrows these fields' semantics.
They are not ignored, repaired
by guessing, or described as confirmed data loss. The report explicitly sets
`firstGeneratedLoadsPreserved` and `fullGeneratedRegionHandoffQualified` false.
The newly verified returns do not erase the first-load failure. Resolve these
original-loader transformations before enabling general generated-region travel.

## Independent checks

`scripts/run-native-connected-residency.py` first rechecks the actual generated
save digests and shared height edge, then copies them into a new profile. It
requires the current build/source tuple and no concurrent native game/build.
It uses 4,096-byte native checkpoint copies, exact-PID resource sampling, a
duration ceiling and one native process. Default four visits cover both returns.

`scripts/check-native-connected-residency.mjs` independently parses every
snapshot and rechecks sources, build, stopped PID, original input saves, latest
publications and trace ordering. Save labels and validated calendar timestamps
are excluded; the original loader's audited per-vertex shading cache is also
normalized. All heights, opaque vertex words, cells, headers, entity/attachment
records, schedules, RNG values and other world fields remain exact. Primary
differences still fail. A missing or changed revisit aborts qualification.

Twelve focused tests pass. Fourteen additional controls use copied observations
from the actual four-visit run and refuse incomplete/duplicate disposal,
missing publications, active-world leftovers, zero/two frees, incomplete ticks,
unsafe checkpoint timing, changed RNG/clock and a changed actual unit. Actual
game files and traces remain unchanged. This verifies these components; it
does not turn the incomplete first-load handoff into an overall pass.

Evidence: `output/native-connected-residency-attempt-002.json`,
`output/native-connected-residency-002-observed.json`,
`output/native-connected-residency-controls-002-observed.json` and
`output/native-connected-residency-initial-differences.json` (attempt 001).
Run the inspector/controls with fresh output filenames to preserve prior reports.

The exact build-039 executable and three game sources are copied and rehashed
with 4,096-byte buffers in
`output/native-connected-residency-generation-preserved.json`. That archive
retains the successful return/disposal observations and the explicit incomplete
first-load qualification. It is not registered as a fully qualified handoff or
as a replacement for the earlier committed-mission generation.

## Original load transformations

Native attempts 003 and 004 repeat the four visits with three temporary,
delegating observers. Both runs exit normally and still preserve both warm
returns and original disposal. They retain the same first-load failures.
The observers are removed before the residency snapshot and baseline hook count;
they never edit live or saved fields.

Attempt 004 identifies the original causes of two differences:

- After the original primary read, view-target method `00438ac0`, called from
  `0043a5cd`, changes player controls `+20` from zero to target 533 in `1_0`
  and 477 in `0_0`. Original export `00438140` and writer `00436200` place
  this previous mini-view target in GSGL payload DWORD 24.
- Original visibility rebuild `005b6330` for building 549 calls `005afe20`
  from `005b649b` (return `005b64a0`). It reveals player zero around `(26,123)`
  with radius 3. The observed vertex `(28,126)` changes from `00000080` to
  `80000081`: player mask 1 is added and a notification is queued with bit 31.
  Building 549's full saved record remains unchanged. Neither bit is discarded
  from the persistence comparison.

The initial toggle observer did not observe the building flag changes.
Pinned original vtable slot `+5c` instead resolves to selection setter
`005b6a80..005b6ac7`; it sets or clears unit flag bit zero and takes two
arguments. Slot `+60` is the separate toggle. Ghidra omitted the setter start,
and native attempt 005 exits with code 6 when the SDK refuses that observer.
It is a failed trial, not additional gameplay evidence.

The game config now declares the complete setter entry. Ordinary build 043
does not regenerate translation metadata, so it is insufficient for that new
observer. Official one-job build 044 completes successfully with `--regenerate`.
Fresh native attempt 006 completes four visits and exits zero after 56.49
seconds, with maximum sampled RSS 183,123,968 bytes (about 175 MiB).
Its version-2 observer traces both building flag changes to original selection
setter `005b6a80`, called from `005ba8aa` with arguments `(0,1)`. The caller is
the original selected-unit iteration at `005ba870..005ba8c9`; it requests
deselection through the unit virtual method. Both warm visits have zero
observed selection, view-target or watched terrain-word transformations.
The runner now checks the recorded current symbol digest and all three eligible
method entries before launching an observer trial, preventing a repeat of the
missing-symbol launch.

`scripts/audit-native-connected-load-transforms.py` pins 23 instruction anchors
and six unit virtual slots. `--verify-report` rechecks a saved audit against
the original PE. A separate stopped inspector checks trace ownership, exact
saved selection changes, the complete GSGL payload and full terrain payload
against the observed causes. The independent attempt-006 inspector passes:
the recorded original methods explain all measured primary first-load changes,
and both warm returns and original world teardown still pass. This qualifies
the causes, not unchanged initial restoration or full regional handoff. No
live or saved field is repaired or ignored. Fifteen focused JavaScript tests pass, including rejection of
unexplained terrain bits, lost hook removal, duplicate/out-of-range events and
extra unit changes. The five game-config tests also pass.

Evidence includes terminal manifests and observations 003/004,
`output/native-connected-load-transforms-setter-audit.json` and exact native
generation archives for builds 040/041/044. Attempt-006 evidence is
`output/native-connected-residency-006-observed.json` and
`output/native-connected-load-transforms-006-observed.json`. The exact build-044
binary, three sources and symbol metadata are retained in
`output/native-connected-load-observer-generation-044-preserved.json`.
The archives retain first-load failure;
they do not qualify full handoff. The served WASM remains untouched.

Arbitrary hero transfer still needs reference/inventory closure beyond the
existing mission-NPC trial. Seamless transitions, neighboring material/lighting,
cooperative publication, full competitive completion, independent internet play
and browser resource qualification remain unfinished. The served WASM is
unchanged; browser game testing remains suspended under the workspace rules.

## Initialize fresh regions before publication

Build 045 adds an explicit native-only initialization path for fresh generated
inputs. The first two original loads attach their worlds, restore the saved
RNGs through original setters, and take the original before/after full saves at
one pre-tick boundary. The after-save becomes that region's latest checkpoint.
The wrapper then requests original dispatcher teardown and returns before
calling the original simulation tick. It never forces selection, view-target,
terrain, queue or entity fields. Staged generated inputs remain unchanged.
Existing gameplay, older residency fixtures and browser builds retain their
original tick behavior.

This is a distinct initialization stage, not an exception to the saved-state
comparison. The raw generator-save first-load failures above remain recorded.
Initialization only qualifies when the previously audited original causes
explain those changes, its before/after saves preserve all compared gameplay
state and raw terrain, and both initialized regions return unchanged.

Native attempt 007 completes this sequence and exits zero:

| Visit | Region | Stage | Completed ticks | Clock before | Clock after |
| --- | --- | --- | ---: | ---: | ---: |
| 0 | `1_0` | Initialize and publish | 0 | 8,600 | 8,600 |
| 1 | `0_0` | Initialize and publish | 0 | 8,750 | 8,750 |
| 2 | `1_0` | Return and play | 20 | 8,600 | 9,600 |
| 3 | `0_0` | Return and play | 20 | 8,750 | 9,750 |

Independent saved-file and original-instruction checks pass. Both zero-tick
initialization snapshots retain identical entities, GPL, attachments, queues,
clocks, RNGs, world sections and raw terrain; labels/calendar are validated
metadata. All tracked roots free once on each exit. Both return loads match
their initialized publications under the existing audited shading comparison,
and show zero observed original load-transform events. The original generated
save digests and settings remain unchanged.

Twenty-six controls corrupt copies of actual stopped observations in memory
and are refused, including omitted/duplicate initialization, an entered tick,
changed clock/RNG/unit/queue/raw terrain, incomplete publication and invalid
teardown. Nine focused JavaScript tests pass; the previous actual four-visit
trace still passes with twenty ticks per visit. Native attempt 007 takes
56.45 seconds and samples at most 182,943,744 RSS bytes (about 175 MiB).
This short native test does not qualify sustained browser memory or travel.

Reproduce after a current official build with recorded symbols:

```sh
python3 scripts/run-native-connected-residency.py \
  output/native-world-residency-build-045.json \
  output/native-connected-terrain-attempt-011.json \
  output/native-connected-terrain-attempt-012.json \
  --attempt <fresh-number> --observe-load-transforms --initialize-generated-regions
```

Evidence is `output/native-connected-residency-007-observed.json`,
`output/native-connected-load-transforms-007-observed.json` and
`output/native-connected-residency-controls-007-observed.json`.
`generatedRegionInitializationQualified` is true only in the complete cause
inspector. `firstGeneratedLoadsPreserved` and
`fullGeneratedRegionHandoffQualified` remain false: seamless travel,
player-hero transfer, cooperative publication and browser qualification still
need implementation and verification.

The next player-hero input is now available: an original UI-recruited Warrior
in initialized `0_0`, with its actual guild-home, script and attached-unit
records. [The hero capture](native-generated-hero.md) records the independent
outside-guild and inside-guild observations and the remaining transfer work.
