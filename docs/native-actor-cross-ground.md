# Original ground heights at projected actor positions

Subsequent [grounded private arrival](native-actor-grounded-placement.md)
qualifies 64 restored candidates at destination height, restricted to source
mode-one records whose navigation cache is inactive. Live execution remains open.

Attempt 013 qualifies 64 read-only original terrain queries in the loaded Scions
world alongside the existing private coordinate-restoration fixture. Every
result matches both the shipped JavaScript sampler and independently executed
pinned x86 interpolation. Terrain headers, all 129-by-129 native vertex records,
output sentinels, heap totals, CRT pool occupancy and hooks remain unchanged.
Original UNIT writing/deletion and all prior route/coordinate checks still pass.
No actor Z is edited and no actor is activated.

## Original engine behavior

Original `005af220` accepts terrain, output pointer and Q16 terrain-cell X/Y.
Actor Q11 world X/Y can be supplied numerically unchanged because a terrain
cell spans 32 world units. The query obtains four 24-byte native vertices and
uses alternating triangle diagonals according to cell parity. Two signed Q16
multiplications floor their signed products; subtraction and final addition
retain 32-bit wrapping. Floating-point bilinear interpolation would differ.

The query returns zero for negative coordinates or when cell-plus-one is at
least the terrain dimension. The JavaScript sampler rejects those positions
before reading rather than interpreting the fallback as valid ground. Actual
Scions terrain dimensions are 128-by-128 with native vertex stride 129. The
sampler reads just one cell and its four compact vertices; copied-checkpoint
hashing/parsing reads at most 4096 bytes at a time.

Thirty-three instruction anchors also verify the original parentless
ground-placement routine `005adb60`: its terrain result is written directly
to actor Z. That complete routine invokes notifications and world refresh and
is not safe to invoke on the unpublished actor whose world pointer is zero.

## Saved elevation and the remaining transfer policy

The immutable Brashnard source and Scions destination checkpoints provide:

| Actor | Saved Z | Source ground | Saved Z minus source ground | Projected destination ground |
| --- | ---: | ---: | ---: | ---: |
| 2101 | 261580 | 261531 | 49 | 94946 |
| 2105 | 164479 | 164477 | 2 | 76535 |
| 2122 | 155121 | 155020 | 101 | 74714 |
| 2136 | 132242 | 133174 | -932 | 75896 |

All values are native Q16 height. The small source discrepancies are measured;
their cause is not yet qualified. Do not infer either an intentional flying
offset or an error to snap away. The Path start code resets a separate cache
through `005b9e20`, prepares movement through `005dfbf0`, then updates logical
cells; it does not directly clear actor Z. Movement/animation ownership and
update ordering must be traced before choosing a transfer height policy.

These are unrelated terrain checkpoints with explicitly supplied region
origins. The test does not establish shared terrain, durable entity identity,
intent-preserving command goals, live ownership handoff or continuous paging.
Cooperative full-match completion and internet gameplay qualification remain
open. Browser/WASM launches stay suspended after the host-app crashes; the
served WASM is unchanged and the full goal remains active.

## Verification and reproduction

The bounded CPU fixture executes 79 original queries: 66 triangle/rounding/wrap
vectors, five original out-of-range cases and eight sets of actual copied
checkpoint corners. It also executes the original height reader for all 32
sampled float heights. Each query permits only the audited original routines,
at most 400 instructions and 100 ms; the largest observed call is 235
instructions. All guest mappings are released. This CPU test uses a synthetic
terrain receiver with four real corner heights; attempt 013 separately verifies
64 calls on the actual loaded terrain.

Three focused JavaScript tests and a terminal qualifier compare the actual
sampler to the original vectors and eight copied samples. Twelve offline
controls reject wrong heights, source Z, dimensions, missing calls, changed
terrain, allocation imbalance, changed fixture identity, the actual prior
placement-only run, and invalid runner options. They launch no native process.

Preserve existing reports and use fresh basenames/attempt numbers:

```sh
node scripts/prepare-native-actor-ground.mjs
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-ground.py \
  --output output/native-ground-instruction-audit.json
upstream/majesty-recomp/.venv/bin/python scripts/check-native-ground-instructions.py \
  --output output/native-ground-emulated-observed.json
node scripts/qualify-native-ground.mjs
node --test --test-concurrency=1 tests/terrain-ground.test.mjs
```

After the official one-job native build, add `--ground-probe` to the existing
`--placement-probe --fresh-route-probe --landing-probe --invalidate-path
--navigation-probe` cross-destination runner. Qualify its terminal manifest
with `scripts/check-native-actor-cross-ground.py` and the controls script.

Actual evidence:

- `output/native-actor-cross-destination-attempt-013.json` / `.log`.
- `output/native-actor-cross-ground-observed.json`.
- `output/native-actor-cross-ground-controls-observed.json`.
- `output/native-ground-emulated-observed.json` and `native-ground-js-qualified.json`.
- `output/native-ground-instruction-audit.json`.
- `output/native-actor-ground-fixtures.bin` / `.json` (108-byte NGH1 pack).
