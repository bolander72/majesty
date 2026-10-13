# Majesty distribution assets

Immutable distribution assets for https://majesty.boland.co/.
The source and deployment configuration are on the main branch of this repository.
This dedicated branch keeps large game data out of Vercel source checkouts.

The classic archive is split into 17 files, each below 32 MiB. The browser
streams them sequentially into one local ZIP and verifies every SHA256 plus
the complete original archive digest before import. No Git LFS is used.
Existing browser installations and player saves retain their identifiers.

`game-parts.json` and `resource-files.json` record sizes and digests. All files
are pinned by commit in the source branch's distribution manifests. This
branch contains no credentials or player saves. Terrain/menu artwork in
The Lost Trail uses existing game resources.
