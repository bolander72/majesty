# Source publication

The initial GitHub publication captures the local development source on
October 12, 2026. The repository is private and its source branch is `main`.

The root repository contains browser modules, scripts, tests, documentation,
deployment examples and the Wayfinder/Trail Lodge draft. Upstream changes are
captured in `patches/majesty-browser-defaults.patch` and
`patches/recomp-kit-browser.patch`, rather than committing the ignored upstream
checkout or private game files. These refreshed patches include the current
native co-op implementation, added headers, smoke scripts and native tests.

The patches apply to the inputs pinned by `scripts/setup.sh`:

- Majesty Recomp: `21186b12979414f6eb4a83db47a1283a8d8fbfea`.
- Recomp Kit: `eb32cc42623e0e9e868b9d27423a57d5a5cba56b`.

The source audit used clean upstream checkouts and compared resident authored
files with the captured versions. Existing patch content preserves older
cloud-only modified headers and scripts. Their byte sizes match and their
modification dates precede the original patches. The cloud-only `globals.toml`
was recovered from an exact cached source snapshot; its SHA-256 matches the
latest recorded native build. Seven small cloud-only browser modules were
captured from identical copies in player139 and the current private test site.
The unavailable local originals were preserved. Publication audit details stay
in ignored `output/github-*.json` files.

Install your own purchased Majesty Gold HD files to build or play. Original
assets, executables, compiled modules, generated translations, tool downloads,
personal save/profile data and trial logs remain local. A source checkout does
not include a playable game download.

Publishing the repository does not deploy the relay or website and does not
migrate or replace browser saves. Setup and deployment remain separate steps.
The current full-match, content-installation and historical crash limitations
in the README still apply.

## Initial publication checks

Both refreshed patches apply cleanly to fresh checkouts of the pinned upstream
commits and reproduce every captured modified/added source file (49 game files
and 78 runtime files). The 1,457 staged files contain no game assets, personal
saves, binaries or detected private-key/token patterns.

The complete JavaScript run with the patched upstream source present reports
1,240 tests: 1,211 passed, 7 failed and 22 skipped. The failures are in saved-realm
provider, automatic crossing, player-backup and map-close tests. They remain open
in this development snapshot; publication does not claim the complete suite is
green. Native builds and browser gameplay were not restarted for publication.
