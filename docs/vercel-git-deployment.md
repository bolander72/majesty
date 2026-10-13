# Vercel Git deployments

The `majesty` project is connected to `bolander72/majesty`, production branch
`main`. Its custom production domain is `https://majesty.boland.co/`.

`vercel.json` runs `python3 scripts/build-vercel.py`. The build downloads the
qualified browser release pinned in `deploy/hosted-release.json`, checks the
archive and every file against SHA-256 and byte counts, and creates Vercel
Build Output v3. No game installation archives, personal saves, credentials,
or generated engine binaries are committed to Git.

Authored files under `web/` overlay the pinned frontend during each Git build.
Changes to the engine or its player template require a newly qualified release
bundle and an updated release manifest. Publishing source alone never implies
that an engine change was compiled.

The root serves the real native player in one document. It automatically
prepares local game data when needed and stays at `/`; a returning visitor
reuses the completed import. Native scripts keep `/majesty/` as their base so
existing asset paths and saved profiles remain compatible. Existing deep links
remain available. `/?setup=1` opens the optional management interface.

Engine JavaScript, data and WASM URLs include their content hashes. Only URLs
matching the pinned hashes receive a year of immutable browser caching; the
unversioned paths and changing frontend code retain revalidation. Module
preloads shorten the startup dependency chain, and the root reuses the game
configuration already fetched during preparation. Brief import-status checks
skip the setup dashboard's storage estimates.

`deploy/loading-art.json` pins the original 800×600 PICT/SPLH loading picture
from the locally owned `Data/cinedata3.dat`. The image is hosted separately
from Git and verified during builds. The startup page preserves its aspect
ratio and removes it when the native menu is ready, or hides it on an error.
It presents no clickable substitute for the game's menu.

The native viewport adapter blanks the nine `Version #` characters embedded
in its SHA-pinned menu layout. It preserves record sizes and all control
bindings, and leaves the original game data intact. Web startup removes only
exact, hash-recognized text-resource shadows from the earlier attempted fix,
preserving customized profile resources and imported game files.

Audio startup attempts to resume the engine's existing SDL3 context as soon
as it is created, without altering native volume or mute settings. Trusted
clicks, taps and keys retry a suspended context. Browser autoplay policy may
still require the visitor's first interaction; the site cannot override that
policy. Owned tests remain muted.

The build retains cross-origin isolation and Brotli WASM delivery. A build
with an unavailable or changed release fails instead of publishing an empty
site. The qualified source release is `native-menu-layout580`, retaining the
previously verified call-return cache optimization and cleaning the menu label
inside the native layout adapter. A protected preview reached the original menu
with the placeholder absent. With autoplay permitted in the muted test browser,
audio was running before any interaction and its output contained nonzero PCM.
The full-screen loading layer uses black around proportionally fitted original
artwork. The gold M favicon is authored SVG.

Local verification:

```sh
python3 -m unittest discover -s tests -p test_vercel_git_build.py
node --test tests/hosting-root-player.test.mjs
python3 scripts/build-vercel.py
```
