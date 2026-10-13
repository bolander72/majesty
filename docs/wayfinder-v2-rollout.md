# Wayfinder v2 rollout

Rollout state: completed. Immutable GitHub assets are published at commit
`be50ee84ba92bed2f8f07e1a848d6f35fa17a84e`; the production root at
https://majesty.boland.co serves the qualified engine and thirteen v2 resources.
Source release `a92e958` deployed successfully. Live HTTP qualification is
`output/regression930-production-http-qualified.json`: normal game root, v2
default collection, matching engine bytes and no Blob asset references.

Publish the immutable engine archive and thirteen content resources on
`codex/assets`, then bind their commit URLs in the release descriptors and
publish authored source to `main`. Vercel builds the normal game at the root
with v2 as its default data collection. Asset-branch deployment remains disabled.

No user-save migration or destructive data operation is required. Audited
surfaces are native prototype IDs, Majesty profile identity, base/v1/v2 game
collections, original GMP save/reload, asset integrity manifests and Vercel
root routing. The base/v1 namespaces, prior releases and player backup paths
remain available. New source initializes additional actor fields through the
native scripts; it does not rewrite players’ save files.

Verification: original paid recruitment and save/reload, native HP effects,
fresh native quest selection/world entry, legacy content entry, build-time
resource/source hashes, then deployed root/catalog/engine/content hashes.
No co-op or whole-game requalification is implied.

Recovery: restore the previous source/release descriptors and redeploy. Keep
both immutable asset releases and all saved player profiles; do not clear OPFS.
