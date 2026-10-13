# Faster browser home menu

The latest hosted frontend shows a lightweight capture of the original home
menu immediately. The native engine still initializes in the background;
this is an improvement to visible startup and accepting a menu choice, not a
claim that original initialization now completes in a fraction of a second.

`web/hosting/home-menu.html` has accessible controls aligned to the captured
1280x633 menu. The image keeps its proportions at other viewport sizes. Only
one pending choice is forwarded when the native menu announces readiness.
`home-menu.mjs` sends SDL3 Pointer Events, derives native click anchors from the
actual viewport messages (including saved quality settings), and leaves fatal
errors visible. Root and child messages must match both origin and window.
The root uses one same-origin engine frame, keeping the art on screen throughout
asset preparation and the handoff. Page navigation releases that engine normally.

The normal entry no longer imports `app.js` or refreshes every setup card.
`launcher-client.mjs` uses a temporary import worker for the selected edition
and releases it before native startup. `/?setup=1` retains the original setup
dashboard. Engine JS/data/WASM are preloaded in parallel with preparation.
Early Exit Game leaves immediately; native Exit Game reports to the root so
its successful exit can navigate the top-level page to boland.co.

Pass `--home-menu-art` to the hosting builder with a private 1280x633 WebP capture
of the verified original menu. Capture 551 is 223,068 bytes. The builder limits
it to 2 MiB, verifies its header and records its SHA. Game artwork remains outside
Git, alongside the existing private engine and original assets.

Silent staged trials 554/556 measured the first home paint at 0.27/0.50 seconds
on fresh origins and 0.15 seconds on a repeat visit. Trial 556 clicked Play Game
before preparation completed and automatically reached the native name prompt;
a repeat early Adjust Settings choice reached the native settings menu. Engine
readiness still took 8.43 seconds on the repeat visit and 37.22 seconds on a fresh
origin including the 570 MB asset archive's download, verification and import.
Peak owned browser RSS was 2,317 MiB, below the 3,072 MiB ceiling; the test browser
was closed. The focused frontend/hash/import tests pass all 26 checks. No native
engine, co-op protocol, save schema or content bytes were changed by this frontend
work. The content authoring goal is paused at its saved SDK checkpoint.

Production release 557 deployed frontend commit `f915910` to the existing
Majesty project. Public trial 558 measured the home paint at 0.293 seconds and
native readiness at 9.04 seconds. Exit Game, followed by Yes, navigated the
top-level browser to `https://www.boland.co/`. Nine public file/hash/isolation
checks passed, including the unchanged Brotli engine. The owned browser was
closed at a 2,152 MiB peak. Evidence is preserved in
`output/startup558-public-verification.json`. Production is available at
`https://majesty-tau.vercel.app/`; the assigned custom domain still does not
resolve. Older release 538 remains available for rollback.

## Earlier engine and hash-cache improvement

The October 12 startup investigation measured the previous published engine at
15.9–16.7 seconds from the player page to its native menu in an isolated Chrome
profile with game data already installed. Approximately five seconds reread
and hashed the installation; another eleven seconds ran original initialization.
The canvas stayed hidden until the real menu readiness message.

## Changes

`web/hosting/content-cache.mjs` stores file digests separately from saves in
`majesty-startup-cache/<dataId>.json`. Ordinary solo launches reuse entries only
when actual OPFS file sizes and nonzero modification times match. Changed,
added or deleted files are reflected in the identity. Corrupt/unavailable caches
fall back to real hashing; cancellation closes the worker and rejects partial
results. The cache has 1 MiB/8,192-record limits. Multiplayer, managed worlds,
hero restoration and rules beyond inventory compatibility require fresh hashes.
Content/session/checkpoint identity serialization remains unchanged.

The engine uses native WASM setjmp/longjmp and C++ exceptions, retaining guest
exception handling and assertions. `patches/recomp-kit-startup-import-copy.patch`
replaces a hot `snprintf("%s")` with the same bounded, terminated stack copy.
The stack copy remains valid when the called shim grows the trampoline vector
or performs a guest nonlocal return. Call observers and diagnostics are retained.
Generated translations were not edited.

## Reproducing the engine

Apply the focused import-copy patch in the kit after the existing browser/video
patches. Build through the official `tools/build.py` app target, one job, with
the existing web preset and these compile/link settings:

```text
CMAKE_C_FLAGS=-pthread -sSUPPORT_LONGJMP=wasm
CMAKE_CXX_FLAGS=-pthread -sSUPPORT_LONGJMP=wasm -fwasm-exceptions
CMAKE_EXE_LINKER_FLAGS_RELEASE=-O1 -sASSERTIONS=1 -sBINARYEN_EXTRA_PASSES=--dce,--optimize-instructions,--simplify-locals,--merge-blocks,--reorder-locals,--vacuum --emit-symbol-map -sSUPPORT_LONGJMP=wasm -fwasm-exceptions
RECOMP_WEB_WORKER_POOL=lean
RECOMP_WEB_MEMORY_GROWTH=conservative
RECOMP_VIDEO=ON
```

The Emscripten SDK used was 6.0.10. Keep the existing pinned pthread FFmpeg
7.1.1 dependency, one-job wrapper and Bink decoder configuration. Compile and
link settings must both select WASM nonlocal returns; C++ also needs the matching
exception mode. The qualified engine is
`6469a87f6381fa7c6398a1f4ffb97951d4981297347b7caaa1dae6aa47c8371b`.

## Validation and limits

- Official native gate 534 and official WASM build 535 succeeded. Focused native
  runtime testing 534 completed 2,274 checks with zero failures and three skips.
  New cases cover descriptor truncation, termination and table growth.
- All 21 focused hash-cache, automatic-launch and asset preparation tests passed.
  Six before/after compatibility identity cases matched exactly.
- Silent, guarded Chrome trial 536 reached the native menu in 8.0 seconds, then
  7.66 seconds on another launch. Hashing fell to 19–27 ms. This measures local
  player-page startup with cached game data, not first-install download time.
- The same trial verified Play Game, name acceptance, quest selection, the Bink
  briefing, Goals, and actual Holy Chalice gameplay at 1280×633. Its peak owned
  browser RSS was approximately 2,055 MiB; it was closed after verification.
- The WASM payload fell from 102,442,156 to 90,332,669 bytes; Brotli transfer size
  is 7,009,811 bytes. Compression round-trip and pinned hashes were verified.

First launch still hashes current game data and pays download/installation costs.
This change does not establish full quest completion, new co-op qualification,
all-browser compatibility or host-app crash recovery. It preserves existing
save formats and keeps startup/loading/checking messages hidden. Publish the
matching engine/JS/data and updated `games.json` together through
`scripts/prepare-vercel-site.py`. The prior ui516 prebuilt is retained for rollback.

## Production verification

Release 538 deployed source commit `4540e07` to the existing production project.
Public HTTP verification 539 confirmed status 200, the matching decoded engine
SHA, Brotli encoding, WASM MIME type, both edition engine identities and isolation
headers. The deployed page contains the cache module and no private timing probe.
A silent owned browser entered the native menu automatically from the site root.
The first launch after this update took 13.85 seconds to initialize the hash
cache; the next took 8.14 seconds. These measurements used previously installed
game data and do not include a fresh asset download. The browser was closed;
its peak owned RSS was approximately 2,095 MiB.

The working production URL is `https://majesty-tau.vercel.app/`.
`majesty.boland.co` remains assigned to the deployment but did not resolve in
this verification. No account, save-schema, backend or environment migration is
required for this release; the optional hash cache populates automatically.
