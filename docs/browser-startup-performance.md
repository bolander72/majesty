# Faster browser home menu

The experimental menu capture and click queue were withdrawn at the user's
request. Only actual native-menu readiness counts as startup performance.
The selected-edition import worker and early resource preloads are retained.

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
