# Repeated travel between saved kingdoms

The browser API replay001 and actual UI-controller replay002 both pass all
eight saved-world transfers using the immutable build380/native005 evidence.
Controller002 runs the actual `web/world/native.mjs` source in a controlled DOM,
clicks each ordinary travel action, updates the hero binding after every arrival,
and retains21 panel elements and one injected game lease. Every prepared package
and pure home matches the original importer input exactly. Ownership ends at33,
seven other dormant kingdoms remain unchanged, and restoring the final published
arrival at23050 performs no writes. Seven stale departure requests and a stale
destination restore are refused. Both focused Node tests exit0.

Evidence: `output/hero-repeated-saved-browser-original-001.json` and
`output/hero-repeated-saved-browser-original-002.json`. These replays use copied
filesystem storage and controlled content labels/publication digests; no browser,
live OPFS or new native receipt consumer runs. The underlying historical journal
identity originates in the controlled startup fingerprint (`a`×64:`b`×64), not
the build369 executable fingerprint. The native checkpoints retain that journal
identity while recording a current-native executable label. Neither replay
qualifies browser content migration, real browser memory or multiplayer travel.

Build380/native roundtrip005 now qualifies eight actual crossings (four complete
out-and-back trips) in one original engine. Independent inspection002 passes
for all eight prepared packages and32 remapped reader records, original gameplay
and saved movement, retirement, queued membership, unchanged pure homes and
terrain, the full ownership chain17→33 and seven untouched dormant entries.
Both processes exit0 and are absent after170.892 seconds. Peak sampled combined
RSS is211615744B (201.8MiB), below the512MiB guard.

All eight unloads release eight tracked roots each. Post-unload guest heaps are
22818240,22789376,22934144,22765584,22853072,22793072,22901648 and22794112B.
Their observed range is168560B; the final unload is24128B below the first.
Comparing departures from the same kingdom, the first/last `-4_-1` unloads
differ by4736B and the first/last `-5_-1` unloads by83408B. These are observations
from this short native run, not a proven plateau or browser/GPU resource bound.
The final hero is578/script69/home61 in `-5_-1`, with original played clock23350.
The actor counts change during ordinary gameplay; the inspector compares import
preservation separately from later original simulation changes.

Qualified evidence: `output/native-hero-remote-roundtrip-005.json`,
`output/native-hero-remote-roundtrip-002-observed.json` and
`output/native-hero-remote-roundtrip-380-qualified/manifest.json`.

The native-only remote travel driver now supports two to eight alternating
crossings between the actual saved `-5_-1` and `-4_-1` kingdoms. Each departure
uses one original005b4870 command, original movement and a held crossing save;
no poses or simulation clocks are assigned. Production owner publication,
dormant restoration, arrival preparation, named travel action, retirement,
original loading/import/activation and paired publication perform the handoff.

After each arrival, six original ticks run before a test-only pause. The worker
retains immutable copies of the actual capture, dormant destination, loaded
destination, retired source, activated destination and four original reader
outputs. A separate test-only continuation marker permits the next original
command. It does not authorize retirement or replace the ordinary travel action.
Only two native kingdoms are visited; the other seven journal entries remain
dormant and unchanged. All original inputs and the original source journal are
preserved. The copied developer fixture retains the historical controlled hero identity and
records a current-native executable checkpoint label, as in the single-return
test. No live browser content migration is implied.

Build378/native roundtrip001 qualifies the first complete out-and-back journey:

| Trip | Destination | Captured source clock | Destination clock | Played clock | New hero/script | Pure home |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `-4_-1` | 18850 | 88600 | 88900 | 535/41 | 30 |
| 2 | `-5_-1` | 89600 | 18850 | 19150 | 572/66 | 61 |

Both processes exit0 and are absent after80.792 seconds. Peak sampled combined
RSS207978496B (198.3MiB). The two unloads free eight tracked world roots each;
post-unload guest heaps are22818240 and22789376B. These two measurements are
not evidence of a long-session plateau or browser memory bounds.

Independent inspection001 authenticates the54 compiled sources and producer,
worker/preparation/guard sources, verifies actual saved clocks and the custody
chain17→19→21, reconstructs each exact four-record package, and compares all
remapped original reader outputs. It checks528 and553 existing actor/attachment
records preserved during import, unique incoming backlinks, one scheduled
hero, unchanged unscheduled pure homes, removal of each departed hero, saved
movement, all16641 terrain height words and seven unchanged dormant entries.

The first longer run002 completes those two handoffs but aborts on its third
route snapshot: its immutable native-only filename already exists in the
revisited profile. The exact two-trip qualification, third-trip failure,
sources and saves are preserved in
`output/native-hero-remote-roundtrip-378-first/manifest.json`.
Build379 gives route and loaded-target snapshots an explicit trip suffix,
preserving earlier files. Run003 then loads/imports/activates the third kingdom
and selects custody at23, but its worker tries exclusive creation of the fixed
acknowledgement mailbox left by trip1. That failure leaves the game paused;
sources and saves are preserved in
`output/native-hero-remote-roundtrip-379-mailbox-refused/manifest.json`.
The copied-file worker now updates that bounded mailbox by temporary-file
rename, while retaining immutable per-trip receipt evidence. These corrections
change only native qualification code and its copied-file worker; no shared
WASM behavior is changed. Run004 then exposes the remaining native-only
post-publication snapshot collision on trip3. Its full state remains in
`output/native-hero-remote-roundtrip-379-published-snapshot-refused/manifest.json`.
Build380 suffixes that snapshot too; all snapshot calls in this native trial
path were reviewed before the successful eight-crossing005 run.

To reproduce, choose an unused attempt and observation filename and a current
qualified build. The supervisor permits only one original native game, uses
a512MiB combined RSS guard and gives each later action15 seconds for staging:

```sh
DEVELOPER_DIR=/Library/Developer/CommandLineTools python3 scripts/run-native-hero-remote-roundtrip.py \
  output/native-world-residency-build-380.json \
  output/hero-progressed-owner-restore-002-preparation.json --attempt <unused> --crossings 8
node --max-old-space-size=96 scripts/inspect-native-hero-remote-roundtrip.mjs \
  output/native-hero-remote-roundtrip-<attempt>.json \
  output/native-hero-remote-roundtrip-<unused>-observed.json
```

This qualifies actual original-engine travel in an owned copied filesystem.
It does not qualify cooperative regional travel, continuous rendering, live
OPFS, sustained browser/GPU resources or full-match multiplayer. The co-op
delivery/load code still needs the separately prepared two-game test and its
pending human exception. Browser launches remain suspended under AGENTS.md.
