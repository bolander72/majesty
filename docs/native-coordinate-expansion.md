# Generate unexplored kingdoms during native travel

The native expanding-world prototype creates a missing neighboring kingdom
within the same process, advances its clock, saves it, and restores it on later visits.
This extends the earlier route through supplied saves: the western kingdom did
not have a marker or either save slot before launch. It is an original Beginner
freestyle kingdom with existing Majesty units and buildings, not new custom
character or building types. A later inspection found that this generated western
kingdom has zero GPL AI agents. These results qualify terrain generation and saved
returns, but do not qualify a playable new kingdom. The named-session work is
testing the original full Quit Game lifecycle to fix initialization; keep the
original111 artifacts and results as evidence of this defect.

## Actual five-visit result

Official111 / native expansion attempt002 (PID82636) exits0 after five visits,
174 original gameplay ticks and35,103ms. Maximum sampled native RSS is
188,907,520 bytes. No stop/resource guard triggers.

| Visit | Kingdom | Operation | Saved clock | Selected slot |
| ---: | --- | --- | --- | ---: |
| 0 | `0_0` | Restore committed home | 31800 → 33550 | 1 |
| 1 | `-1_0` | Generate unexplored west | 33550 → 35200 | 0 |
| 2 | `0_0` | Restore home progress | 33550 → 35300 | 0 |
| 3 | `-1_0` | Restore western progress | 35200 → 36900 | 1 |
| 4 | `0_0` | Restore home and finish | 35300 → 37150 | 1 |

Exactly one original generation event occurs. Independent inspection compares
every loaded return with its own preceding original full save, including typed
records, hero queues, memberships, both RNGs, clock and terrain under the existing
audited metadata/shading/order policy. No new primary-field mask is introduced.
The 129 vertices shared by home's west edge and the new kingdom's east edge
match exactly. Five original unloads free all six tracked roots each,30 total;
the original CRT and heap shrink at each disposal. Both final checkpoint markers
select the exact latest original full save for their kingdom.

Three actual refusals precede travel: a stale request, an existing partial
orphaned southern save and a non-neighbor. The partial save remains unchanged.
Original settings, selected hero worlds, receipt and publication are preserved.
Eighteen altered actual-trace controls reject missing/duplicate generation,
generation before disposal, wrong context, partial-save admission, retained
roots, missing publication, rewriting the fresh kingdom's RNG and altered wire
coordinates/serials. Twenty-six focused JavaScript and five game-config tests
also pass. Sampled RSS and five returns do not establish a sustained memory bound
or speed improvement.

## Original lifecycle and bounded context

The versioned native-only flag is `BROWSER_STREAMING_REGION_EXPANSION_FIXTURE=v1`.
It requires the existing coordinate-v2 request router and digest-verified
checkpoint fixture. A destination is unexplored only when marker and both slots
return ENOENT. Damaged, partial, orphaned or unreadable paths are existing data
and refuse; they are never silently replaced by generated terrain.

After source publication and original dispatcher disposal, the menu boundary
updates one active Region's key, seed and checkpoint name. There is no retained
catalogue of dormant native objects. For an unexplored destination, original
00446e70 constructs the Beginner preset and original00446910 generates and
attaches its world. Existing seed/extent/connected-terrain wrappers run normally;
constructor/player-setup guards and scoped hooks remain in force. Generation is
after old-world disposal, before the next gameplay tick. A fresh kingdom keeps
its own original generation RNGs. Saved returns use the existing original full
loader and audited RNG restoration. Generated translations are not edited.

These snapshots use the private native fixture's two verified coordinate slots,
with4KiB copies and16KiB hash scratch. Its compiled-artifact content identity is
distinct from browser imported-assets identity. This is not production named-
world storage integration, multi-region actor transfer or a co-op transaction.
External concurrent filesystem mutation and power-loss recovery remain untested.

## Evidence and reproduction

Current proof is `output/native-coordinate-expansion-003-observed.json`; actual
trace controls are `output/native-coordinate-expansion-004-controls-observed.json`.
Exact official111 executable, four compiled sources, symbols, controllers,
inspectors and both three-/five-visit proofs are preserved and rehashed in
`output/native-coordinate-expansion-generation-111-preserved.json`.

```sh
python3 scripts/build-native-world-residency.py --attempt FRESH
python3 scripts/run-native-coordinate-expansion.py output/native-world-residency-build-FRESH.json output/native-hero-return-pair-001-published.json upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-iIyAMK/Selected_Entity_Revision.json --attempt FRESH --visits 5
node scripts/inspect-native-coordinate-expansion.mjs output/native-coordinate-expansion-attempt-FRESH.json output/expansion-FRESH-observed.json
node scripts/check-native-coordinate-expansion-controls.mjs output/expansion-FRESH-observed.json output/expansion-FRESH-controls.json
```

Use fresh positive numeric attempts; build/run filenames pad them to three digits.
Only one heavy build/game may run at a time. Initial three-visit attempt001
(PID82097) independently qualifies107 ticks and generation/home return. Its first
inspector failed because it incorrectly expected the remote kingdom's pure45
queue exception in home; correcting to home's complete roster passes. The failed
source/log remain preserved. A controls invocation initially refused the 796KiB
proof under a256KiB input cap; the corrected1MiB cap and18 controls pass. No native
game failed in these two runs.

No browser game, browser build or web staging runs this turn. Served WASM is
unchanged and the host-app crash suspension remains in force. Browser in-process
activation, spatial hero crossing, cooperative world activation, complete internet
matches and sustained native/browser memory bounds remain unfinished.
