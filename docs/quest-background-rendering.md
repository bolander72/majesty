# Quest briefing rendering and quiet startup

The browser build previously compiled with `RECOMP_VIDEO=OFF`. The Bink fallback
reported a successful 640×480 movie but did not copy decoded pixels into the
screen buffer. The quest briefing uses a real 260×260 advisor movie. Old quest
map pixels consequently appeared over the advisor, text and controls.

`patches/recomp-kit-wasm-video.patch` enables FFmpeg static libraries for
Emscripten, preserving native shared-library behavior. The dependency is the
existing pinned FFmpeg 7.1.1 archive. Pthreads stay enabled for the threaded
runtime; Bink decoding uses the existing game worker with `thread_count=1`.
Build with `RECOMP_VIDEO=ON`; select the one-job dependency wrapper through
`RECOMP_FFMPEG_MAKE`, using an absolute path to
`scripts/make-native-video-one-job.py`. Use the official `tools/build.py` app
build with the existing web preset. Generated translations are unchanged.
Apply this focused patch after the existing `recomp-kit-browser.patch` using
`git apply --unidiff-zero`; apply the menu-ready patch in the game checkout with
the same option. Copy `patches/browser-button-latch.h` to `kit/host/button_latch.h`
if the existing browser patch checkout lacks this input helper. The restored
helper passed the existing two-frame/250 ms release checks.

`patches/majesty-menu-ready.patch` emits one public readiness message after the
native input loop observes a stable menu window in phase 1. Startup artwork
has no registered menu window. The hosted player keeps
its canvas invisible until this message, then reveals it after two animation
frames. File import, compatibility hashing and engine progress remain active
without displaying setup/loading/checking screens. Fatal errors retain recovery
controls. `?setup=1` remains an explicit maintenance route.

## Validation

- Official native compilation 511 qualified the clean decoder source with video
  disabled; 516 qualified the menu readiness change. These are compilation gates,
  not native video gameplay tests.
- Official WASM builds 494, 497 and 513 qualified with real video enabled and bounded
  resources. Temporary tracing and rejected redraw candidates were removed in 497.
- Silent isolated browser trial 495 decoded the advisor at 260×260, displayed a
  readable briefing at 800×600, opened Goals on Continue, and reached Holy Chalice
  gameplay after Start Quest.
- Trial498 started at 1280×633 and displayed a clean centered briefing and movie.
  No old quest map pixels covered the text or buttons.
- The 14 existing automatic-launch, streamed-asset and derived-content checks pass.

Exit Game followed by the original confirmation returned to `https://www.boland.co/`
in trial 502. Nonzero guest exits still display an error.

Trial 514 verified the native readiness message and captured the first visible
frame as the normal home menu. Startup progress and original loading artwork
remained hidden. All owned browser tests were silent and closed afterward.

## Remaining limits

Changing the viewport while the advisor movie is already playing produced a
black strip in trial 495. It cleared on Continue; starting at the wide size in 498
was clean. That separate live-resize behavior is not yet fixed. This change does
not establish co-op, internet-play or host-app crash recovery. Owned browsers are
muted, resource guarded and closed after each trial; player saves are preserved.

## Rollout

Deploy the qualified engine and matching JS/data together, update `games.json`
with its hash, and publish the quiet hosted page. No profile schema, saved game,
asset import or content-edition migration is required. The prior prebuilt 407
release is retained for rollback.
