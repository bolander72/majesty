# Generated northern kingdom and saved return

An actual original native kingdom now exists at `0_-1`, north of `0_0`.
Original generation, gameplay and Save Game succeed; all129 shared saved height
values match `0_0`'s northern border. This expands the previously qualified
three-coordinate set with a genuinely generated negative-coordinate kingdom.
It is native prototype evidence. Served WASM and browser controls are unchanged.

## Generation

Reuse official native108, already preserved and registered. Generation017/
PID60525 exits0 without a forced stop in40,783ms, maximum sampled RSS183,648,256
bytes. Original landscape classification requests128 cells on both axes; the
connected layout remains128 by128. The original new341,268-byte save contains
410 units,43 GPL agents and14 attachments at clock9000. Its SHA256 is
`14f043e72f8f286dc8e52cca03040d562a9275ca6af65856d2f3331c3087c847`.

Independent inspection reads all16,641 height vertices in bounded4KiB pieces,
checks the coordinate recipe and compares the129-vertex border against the
actual saved `0_0` kingdom. Original interior terrain changes remain admitted;
border heights must match exactly. Original settings stay unchanged. The
generic neighbor qualifier accepts supplied canonical adjacent coordinates;
it no longer needs a special third-kingdom coordinate in its checks.

## Initialize, unload and return

The original initialization runner now accepts independently generated adjacent
coordinates. It verifies the supplied files' complete terrain before launch and
retains their coordinates in the manifest. Its two slots remain fixture slots,
not global coordinates; the owned `frontier_0_0` directory is the fixture hub.
It does not change the product's active-region context or expose in-process
browser travel.

Initialization002/PID60632 exits0/no stop in55,723ms, maximum sampled
RSS183,156,736 bytes. Its four visits are:

| Region | Original ticks | Clock |
| --- | ---: | --- |
| `0_-1` initialization | 0 | 9000 → 9000 |
| `0_0` initialization | 0 | 8750 → 8750 |
| `0_-1` return | 20 | 9000 → 10000 |
| `0_0` return | 20 | 8750 → 9750 |

Both initialized return saves preserve all compared typed records, attachments,
queues, clocks and both RNGs under the existing audited save metadata/order/
shading policy. All six tracked native roots free at each exit,24 in total.

Raw generated first loads still fail unchanged-state comparisons: BLDG/ORDR/GSGL
change, including building472 in `0_-1` and475 in `0_0`. Agents, attachments,
queues, clocks and RNGs match. These failures remain reported separately; no
primary field is masked or rewritten to turn them into successful cold loads.
This turn does not independently establish the cause of the northern raw-load
changes. Warm return qualification starts from the original initialized save.

Post-unload heap totals also grow between each region's two visits. Four visits
and sampled RSS below the ceiling do not establish sustained native or browser
memory bounds. This run does not retire the earlier prototype's orphan queues
or qualify a four-region coordinate route.

## Reproduction and evidence

```sh
python3 scripts/run-native-connected-terrain.py output/native-world-residency-build-108.json --attempt 17 --region 0_-1
node scripts/qualify-native-connected-neighbor.mjs output/native-connected-terrain-attempt-017.json output/native-connected-terrain-attempt-011.json output/native-connected-north-001-observed.json
python3 scripts/run-native-connected-initialization.py output/native-world-residency-build-108.json output/native-connected-terrain-attempt-011.json output/native-connected-terrain-attempt-017.json --attempt 2
node scripts/check-native-connected-initialization.mjs output/native-connected-initialization-attempt-002.json output/native-connected-north-002-initialized.json
node --test --test-concurrency=1 tests/connected-height.test.mjs tests/connected-residency.test.mjs tests/connected-load-transforms.test.mjs
```

Use fresh attempt/output names when reproducing; preserve existing evidence.
The14 focused Node tests pass. Generation and initialization run sequentially,
with one native process at a time and512MiB RSS ceilings. No new native build,
browser launch or user-profile mutation is needed. Earlier initialization
runner/inspector sources are frozen in `output/connected-initialization-before-north-*`.

Automatic new-region creation during travel, natural hero crossing, shared
cooperative activation, full matches, independent internet play and sustained
engine/browser memory bounds remain unfinished requirements of the active goal.
Browser launches remain suspended while the repeated host-app crash is unresolved.
