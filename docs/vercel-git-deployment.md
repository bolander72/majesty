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

The build retains cross-origin isolation and Brotli WASM delivery. A build
with an unavailable or changed release fails instead of publishing an empty
site. The qualified source release is `native-startup568`, with the previously
verified call-return cache optimization and no home-menu facade.

Local verification:

```sh
python3 -m unittest discover -s tests -p test_vercel_git_build.py
node --test tests/hosting-root-player.test.mjs
python3 scripts/build-vercel.py
```
