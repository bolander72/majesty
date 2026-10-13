# GitHub asset distribution

The Majesty repository is public at Mike's request. Runtime, artwork, original
game data and the qualified Wayfinder/Lost Trail resources are stored on its
`codex/assets` branch. The source and Vercel deployment stay on `main`.
The asset branch disables automatic Vercel deployments, keeping the large
payload out of source builds and preview jobs. No Git LFS is used.

The original 569806043-byte ZIP is split into seventeen files of at most32MiB.
`deploy/automatic-assets.json` pins their Git commit, sizes and SHA256 digests.
The browser writes each response directly into one OPFS ZIP, verifies each
part and the complete original archive, then invokes the existing importer.
Failed, reordered or truncated downloads abort without importing game data.
No part or whole archive is buffered in JavaScript memory.

`deploy/hosted-release.json`, `deploy/loading-art.json` and
`deploy/content-release.json` pin the other resources. Their bytes and engine
hashes are unchanged. The build downloads the small engine archive and artwork
from GitHub; fresh browsers download the large game archive and content patches
directly from GitHub. Vercel continues serving the small built player/frontend.
Returning players reuse their installed collections and existing save paths.

When updating assets, create an immutable commit on `codex/assets`, verify the
public raw file responses, and update source manifests to that commit. Never
put player saves, credentials or test browser profiles on the public branch.
Keep hashes and original SDK/compiler qualification bindings intact.

Legacy Blob URL validation remains for older edition manifests and rollback.
Active deployment manifests use GitHub. Old Blob copies must not be removed
before the replacement files and browser import are verified.
