# Browser gameplay performance and stability

The October 15 investigation separates campaign simulation, presentation and
uncaught guest exits. The earlier Alchemist missing-campaign-functions fix and
fog fix remain enabled. A generic guest exit code does not identify the cause
of a later unrelated crash.

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
