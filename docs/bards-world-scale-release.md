# Bards Hall size correction

The earlier PR #1 prepared private scale candidates; it did not change the
published game. This release installs a Bards-only candidate at **70% of the
previous width and height**, for levels 1, 2 and 3. Alchemist Lab and Dark
Paladin's Guild retain their published artwork and scale.

`deploy/bards-world-scale-release.json` pins the immutable asset commit, both
edition URLs, the old and new CAM hashes, and the three generated content
bindings. The build applies those bindings after the published-player and root
presentation repairs. It changes neither HTML page, the engine, gameplay
bytecode, collection identifiers nor profile/save paths.

The updater accepts the previous published CAM as an eligible update and keeps
all older accepted versions. Unknown customized files still require explicit
handling. Existing worlds need no conversion. Players can save their game,
reload the page and load their save to use the smaller artwork.

Reproduce the asset with the pinned original CAM and installed art requirements:

```bash
.venv-pr/bin/python scripts/prepare-bards-world-scale.py \
  --source output/pr-1-verification/Community-main.cam \
  --out output/bards-art-70 --guild bards --percent 70
```

The output is 45,174,784 bytes, SHA256
`0baa6c3051eb16a0de9ae024e07c941ff6bcb426b564ee0803b3654a06e5d765`.
Only BDG1/BDG2/BDG3 world frames and their matching placement geometry and
attachments change. Original tile slots, palettes, unrelated images and the
native framed sidebar sets remain byte-identical. Independent parsing accepts
208 image references. Representative visible bounds shrink from 222×203 to
155×141, 232×294 to 162×204 and 241×338 to 169×236.

The qualification receipt records native placement, upgrades and saved-world
checks against the exact published engine and unchanged gameplay libraries.
Private screenshots, browser profiles, saves and run logs remain outside Git.
Restoration and build-anything cheats bound construction time and raid
interference; these trials qualify size, placement and persistence rather than
game balance.

Rollout/manual-data audit: none required. Both immutable asset responses are
verified before binding publication. The known-version browser update handles
the resource replacement; no database, secret, profile or save-format migration
is involved, and the centered direct-root loading flow is preserved.
