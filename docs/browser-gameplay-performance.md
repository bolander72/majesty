# Browser gameplay performance and stability

The October 15 investigation separates campaign simulation, presentation and
uncaught guest exits. The earlier Alchemist missing-campaign-functions fix and
fog fix remain enabled. A generic guest exit code does not identify the cause
of a later unrelated crash.

## Reduce complete-image CPU bookkeeping

The current priority is responsiveness and visible stalls rather than a target
frame-rate number. `patches/recomp-kit-cpu-snapshot-present.patch` adds an
explicit complete-image CPU path. The browser's qualified DirectDraw engine
already publishes a full owned image; it no longer also builds exact masks,
row-map nodes and per-rectangle pixel/coverage copies for these CPU-only lock
writes. It computes the same exact changed bounds for overlapping-lock rebasing.
Retained-pointer detection, revisions, palette leases and frame ownership stay
in place. Unchanged locks still produce no new content.

The runtime option is off by default. The Git site builder enables
`RECOMP_DDRAW_CPU_SNAPSHOT_ONLY=1` only when the renderer descriptor, engine and
[native/browser proof](../deploy/cpu-snapshot-verification.json) agree.
A snapshot frame explicitly tells UI extraction to use its complete image,
including the native cursor, rather than incomplete replay records. Textures,
GPU-backed or dirty generations and mixed GPU frames keep exact recording.
Creating a GPU device closes a pending CPU image before recording GPU work.
Fallback recording reuses map nodes for continuing exact spans and skips GPU
coverage cleanup when no GPU copy or dirty pixels exist.

This is an incremental patch on the qualified `pixel-mask1744` kit, not a bare
upstream bootstrap. Apply with `patch -p1`; build and test only through official
`tools/build.py` and `tools/test.py`. Native DirectDraw, pixel kernels, UI layer,
presenter and host checks pass. Actual WASM SIMD kernel checks also pass.

In matched continuous scrolling through the same 111-building mission input at
1280×633, the 95th-percentile displayed-image gap decreased from 33.95 to
18.13 ms; the longest gap decreased from 66.92 to 36.06 ms. Six gaps over 50 ms
became zero in these short samples. This measures scrolling smoothness, not
exact click-to-visible latency. A fresh logical profile reloaded the exact
ordinary save with all 111 completed, full-health buildings and 32 surviving
heroes with saved AI. Native Guardhouse and Palace cards, a live resize to
1920×1080, extended scrolling, Options and resuming play were checked visually.
The larger-view trial had no gap over 100 ms during its 39-second sample; it
has no matched older-engine control.

Image resolution, simulation timing, saved profiles and content collections
are unchanged. No general freeze/crash fix or lag-free kingdom-size guarantee
is established. Reverting the release commit restores the prior renderer;
a manual manifest rollback must also remove the CPU renderer descriptor so its
flag cannot be enabled with an older engine. Player data needs no migration.

## Exact SIMD change masks

`patches/recomp-kit-exact-pixel-mask.patch` batches the 16-bit recorder's exact
per-pixel change-mask generation in eight-pixel WASM SIMD groups. It retains
whole-row equality filters, changed-row bounds, row maps and rectangle merging.
The mask remains one byte per pixel with exactly 0/1 coverage; the helper never
loads beyond a row or writes beyond the caller's mask. Portable formats and
tails keep exact scalar comparisons. No persistent buffer or kingdom-sized
cache is added. The patch also includes the CPU-only write fast path below.

Apply this incremental patch from the previously qualified baseline-reuse kit
root with `patch -p1 -i /absolute/path/to/recomp-kit-exact-pixel-mask.patch`.
It is not a bootstrap patch for an unmodified upstream kit. Use the official
`tools/test.py` targets `pixel_kernel_tests`, `dx_tests` and `host_tests`, and
`tools/build.py`; never edit generated translations.

The official pixel-kernel suite passes 4,957,386 checks on both portable native
and WASM SIMD builds. Tests compare every output mask and bounds against a
byte-wise oracle across four formats, unaligned inputs, row tails and all 256
eight-lane combinations. DirectDraw passes 182,820 checks, and host tests for
the included write fast path pass 4,175,535 checks. Scoped literal and repository
boundary checks pass, and the patch round-trips to the bound source exactly.

The isolated WASM mask benchmark alternates old/new order and mutates its input.
Across sparse, block and full-row changes at 640 and 1280 pixels with three
alignments, its geometric mean speedup is 2.32 times (range 1.28 to 3.70).
This is helper time, not whole-game FPS. Existing exact recording and native
simulation, actor updates, frame ownership, resolution and saves retain their
contracts.

[The source-bound qualification receipt](../deploy/exact-pixel-mask-verification.json)
records the ordinary save and fresh-profile reload, plus these short camera-pan
samples on the same 111-building input with normal optimizing V8:

| Viewport | Prior release | Exact mask candidate | Change |
| --- | ---: | ---: | ---: |
| 800 × 633 | 50.31 fresh FPS | 57.13 fresh FPS | +13.5% |
| 1280 × 633 | 35.00 fresh FPS | 43.33 fresh FPS | +23.8% |

The 800-pixel sample's 95th-percentile fresh-frame gap fell from 34.00 to
18.55 ms; at 1280 pixels it changed from 34.80 to 33.82 ms. Aggregate owned
browser CPU remained about 1.15–1.18 cores, slightly higher for the candidate;
no total CPU reduction is established. These are camera-motion measurements,
not comparisons against the stationary scene's roughly 20 changed frames/s.
Both use the same muted isolated launch configuration, one compilation task,
60-Hz frame setting and unchanged 2400 MiB resource ceiling.

The candidate's ordinary save retains all 111 completed, full-health buildings
and 35 surviving heroes with saved AI. A fresh logical profile restored that
exact hash-bound save, continued into Day 1 and showed a native Guardhouse at
200/200 HP. All qualification browsers closed normally. The synthetic input
is not the user's Siege save. These samples do not qualify sustained 60 FPS,
other resolutions, arbitrary kingdom sizes or a fix for recurring crashes.

## CPU-only write fast path

[The private candidate](../deploy/cpu-only-write-candidate.json) moves the existing
GPU surface-generation check ahead of the dynamic legacy-writeback setting
lookup. Recorded writes without a GPU copy need neither binding nor upload.
This avoids repeated environment lookups per pixel span without caching the
setting or changing write records, simulation or save behavior.
The standalone patch remains archived at
`patches/experimental/recomp-kit-cpu-only-write-fastpath.patch`.

The official `host_tests` suite passes 4,175,535 checks, including stale
surface generations, dynamic setting changes and partial-write pixel fidelity.
The official browser build, world, ordinary save and fresh-profile reload pass.
The generated save retains 111 completed buildings and 29 surviving heroes
with saved AI; the native Guardhouse card displays 200/200 HP after reload.

With normal optimizing V8, the matched stationary samples measured 20.22
versus 20.40 fresh frames/s and 1.096 versus 1.115 aggregate CPU cores. This
establishes no meaningful average performance gain. A separate moving-camera
sample reached 56.70 fresh frames/s: a stationary scene's changed-frame rate
is not a general rendering cap. Do not compare those different workloads as
a 20-to-57 FPS improvement.

Earlier trials hit the unchanged 2400 MiB owned-browser guard and remain failed
trials. The subsequent isolated launch configuration prevents Chrome's hidden
new-tab/address-popup preloads; it retains GPU rendering, normal optimizing
V8 and the same resource ceiling. It is a test-launch configuration, not a
change to visitors' browser settings. Browser storage was accessed only through
public OPFS APIs. The private catalog uses production's `campaign3` collection;
older `campaign3test3` measurements are not interchangeable.

## Reuse the synchronized primary baseline

`patches/recomp-kit-present-baseline-reuse.patch` removes a duplicate full-surface
comparison during recorded primary-surface writes. `surface_pixels_changed`
first resynchronizes the retained-pointer baseline, then synchronously presents
the same pixels under the guest baton. That internal present now reuses the
successful resynchronization. There is no intervening guest execution.

The shortcut is a call argument, never persistent surface state. Independent
presents still scan for unannounced writes through retained pointers, including
stores after Unlock. If no baseline exists, resynchronization reports failure
and the normal discovery path runs. Frame ownership, write records, readbacks,
texture uploads, simulation timing and save formats retain their contracts.
No frame buffers or kingdom-sized caches are added.

This is an incremental patch for the qualified runtime described below, not a
bootstrap patch for a bare upstream kit. Apply from that kit root with
`patch -p1 -i /absolute/path/to/recomp-kit-present-baseline-reuse.patch` and use
the official `tools/test.py --native-test dx_tests --jobs 1` and `tools/build.py`.
The added regression verifies exactly one present for a recorded primary
Unlock and exactly one later present containing a new retained-pointer write.

Qualification is bound by
[the baseline reuse receipt](../deploy/present-baseline-reuse-verification.json).
The official DirectDraw suite passes 182,820 checks. A muted, isolated browser
loaded the synthetic 111-building/41-hero/30-guard input, generated an ordinary
save, and a fresh owned profile restored that exact save with all 111 buildings
and 36 surviving heroes with saved AI. Both used `--liftoff-only` to keep browser
compilation memory bounded; this does not qualify normal optimizing-browser FPS.

The matched 20-second sample measured 21.22 versus 21.29 fresh frames/s, 1.159
versus 1.162 aggregate CPU cores, and 67.35 versus 67.40 ms 95th-percentile gaps.
These results do not establish a meaningful overall speedup. The candidate's
bounded CPU capture confirms the duplicate present-side scan is absent; the
necessary resynchronization scan remains. Earlier profile percentages include
the prior SIMD change and different world progress, so they cannot isolate this
patch's contribution. No general crash or lag-free large-kingdom claim is made.

## One upload per completed frame

`patches/recomp-kit-present-coalescing.patch` changes the host presentation
boundary. Previously each intermediate DirectDraw primary present expanded the
whole image to RGBA and uploaded it, even when later writes belonged to the
same unsealed frame. The presenter now copies the latest guest pixels and
palette immediately, then expands and uploads once when sealing that frame.

The owned copy is necessary: guest pixels, their format, dimensions and palette
can change before seal. Explicit RGBA and GPU presents supersede an older
pending CPU snapshot. Frame capture flushes pending pixels before consuming
the image. The renderer still publishes complete immutable frames and retains
the original frame order and simulation timing.

A single service conversion buffer serves real uploads; fake test targets keep
their pixels for assertions. This avoids retaining an RGBA conversion buffer
in every real frame-pool slot. The raw snapshot pool follows the existing
presenter target lifetime and does not grow with kingdom population.

Apply the patch from the existing patched recomp-kit source root using
`patch -p1 -i /absolute/path/to/recomp-kit-present-coalescing.patch`, then build
through the official `tools/build.py`. Do not edit generated translations.
Run `tools/test.py --native-test presenter_service_tests --jobs 1` through the
appropriate isolated native preset. The added cases exercise a burst of primary
presents, final-palette ownership, padded RGB565 input, format and size changes,
and superseding RGBA images.

## Held-out changed-pixel experiment

`patches/experimental/recomp-kit-pixel-diff.patch` is an inactive experiment.
It removes the lock-diff bitmap and row maps using exact SIMD changed runs and
two sorted span vectors. Native and WASM SIMD kernel checks (4,628,513 each),
the DirectDraw suite and the presentation suite pass. However its browser
sample delivered 14.54 fresh frames/s and 1.124 CPU cores, compared with 19.17
frames/s and 1.090 cores for the upload-only change. These short runs cannot
isolate every source of variation, but do not qualify a gameplay improvement.
The experiment is excluded from the release and the active runtime source was
restored. Do not apply it as a shipped performance fix.

## Qualification

The official native `presenter_service_tests` suite passes (1/1). Its burst case submits 102 primary presents and verifies one flush at seal, with the final palette and pixels preserved.

The upload-only build passed the browser comparison, ordinary native saving,
fresh-profile reload of that exact generated save, and the Alchemist Lab,
Members, character-card and Stats panel regression. The Alchemist world ran
from Day 12 into Day 14. All owned trials were muted and isolated.
`deploy/gameplay-performance-verification.json` binds the engine, source,
tests, samples and limitations.

At 1280 by 633, the same original mission input produced these 20-second
steady-world samples with light frame timing enabled and no CPU profiler:

| Measure | Prior production engine | Upload once per frame |
| --- | ---: | ---: |
| Fresh frames/s | 17.60 | 19.17 |
| Aggregate owned-browser CPU cores | 1.429 | 1.090 |
| Median fresh-frame interval | 50.16 ms | 50.03 ms |
| 95th-percentile interval | 100.68 ms | 73.94 ms |

This is about 24% less CPU, 9% more fresh frames and 27% lower 95th-percentile
frame gaps in this sample. Display refresh remained about 60 Hz; repeated
frames are excluded from the fresh-frame rate. These are short measurements
of this existing mission, not a 60-FPS guarantee or qualification of the
user's larger Siege kingdom. The initial short
Chrome CPU capture included mission loading; it is not a mature-kingdom FPS
benchmark. Its memory guard closed the owned test browser after profiling.
No general crash fix, memory-leak fix or large-kingdom speedup is claimed from
that capture.

The original-mission comparison fixture is the already-supplied October 9
Quest for the Holy Chalice Day 4 save. A stopped metadata read counted 2,355
world objects, ten player-owned buildings and six player-owned vehicle-family
actors. The original save and player profile are preserved; performance trials
use copies in separate owned profiles.

The renderer optimization does not establish a fix for recurring ordinary-play
crashes. Those exits were not reproduced in these bounded trials. An earlier
CPU-profiling trial hit its memory guard during loading; later non-profiling
comparisons and regression checks closed normally. The mature Siege kingdom
remains unqualified.

## Wide SIMD pixel comparisons

`patches/recomp-kit-wide-pixel-compare.patch` keeps the existing recorder and
frame buffers. Apply it with `patch -p1` to the existing qualified runtime
that already contains `dx/pixel_compare.h` and `pixel_kernel_tests`; it is an
incremental patch, not a replacement for the earlier runtime preparation.
It first checks 16 bytes, retaining a cheap early mismatch,
then compares four SIMD vectors per branch on longer equal stretches. Scalar
tails and the portable implementation retain their previous behavior. No read
crosses the requested span. No additional image allocation, resolution change,
simulation change or generated-translation edit is involved.

The official `pixel_kernel_tests` target passes 3,676,361 checks on both native
and actual WASM SIMD builds, including every mismatch position through 256
bytes and unaligned boundaries. The explicit `pixel_compare_bench` target is
excluded from normal test builds and test labels. Run it through official
`tools/test.py --native-test pixel_compare_bench --jobs 1` in the WASM preset.
Its 48 cases compare the prior loop and new loop at 256, 1280, 2560 and 7680
bytes, with three alignments and equal/first/middle/last mismatch patterns.
Inputs are mutated each iteration; matching checksums prevent dead-code timing.
The measured aggregate fell from 400.19 to 239.43 ms, about 40% less helper
time. Equal stretches were 1.70 times faster; first-byte mismatches were
essentially unchanged. This is a helper benchmark, not a whole-game FPS claim.

The separate private original-mission stress fixture contains 111 completed,
full-health buildings, 41 living level-1-to-6 heroes and 30 city guards. It adds
ten real Warriors' Guilds, forty guardhouses, thirty houses and forty Warriors
through original actor creation, original births and native home membership;
ordinary housing and guard spawning continue afterward. It is a synthetic
performance workload, not an authored campaign or ordinary paid construction
qualification. Its original native save is SHA256
`d271672fc9a813fbbd36fd3e226e908b2a5003013b1e577bd758bc06af0a9882`.
The source-only builder in `native/performance/private_kingdom_fixture.cpp`
is not linked into public engines. Use it only in an isolated copied profile
of the bound Holy Chalice input; keep the generated worlds private.
`scripts/inspect-performance-kingdom.mjs INPUT.GMP SHA256 OUTPUT.json` refuses
an unbound save and reports living actors, completion, health and saved AI.

Browser correctness checks use the exact engine actually requested from
`/majesty/MajestyRecomp.wasm`, with HTTP bytes verified against its SHA256.
Updating the root catalog or a second root-level engine copy alone is
insufficient. The new engine restored the large original world, displayed a
stock guardhouse at 200/200 HP, continued combat/tax collection, and exported
an ordinary generated GMP retaining all 111 completed/full-health buildings
and 38 surviving heroes. These correctness trials use V8's `--liftoff-only`
test flag to bound compilation memory; no normal optimizing-browser speedup
is inferred from them. The official Node WASM benchmark uses its normal
compiler. See `deploy/wide-pixel-compare-verification.json` for bound evidence.

## Rejected CPU-band recording experiment

`patches/experimental/recomp-kit-cpu-band-records.patch` is inactive. It records
whole changed row bands for opted-in CPU-only 16-bit surfaces, leaving textures
and Direct3D on exact spans. Correctness tests passed, but the correctly bound
large-kingdom sample gave 23.85 fresh frames/s versus 24.18 with it disabled,
with no meaningful CPU improvement. The guard stopped that trial at 2640 MiB
while opening its menu, before save qualification. A subsequent unchanged
production-engine startup also reached its guard at 2546 MiB. These stops do
not identify the exhausted host resource or prove which allocation caused it.
The experiment remains excluded and the original DirectDraw source is restored.
Earlier apparent comparisons used the old nested engine and were discarded.
No general crash fix or lag-free kingdom-size guarantee is claimed.
