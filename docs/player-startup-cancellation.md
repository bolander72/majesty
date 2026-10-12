# Player preparation cancellation

Leaving the player page during compatibility checking previously allowed its
asynchronous preparation to continue toward GPU creation and game-script
injection. The game-specific staging script now registers one pagehide handler
for preparation. Departure aborts the game-manifest fetch, closes the existing
compatibility hashing worker, and prevents later startup at asynchronous
boundaries. Directory/file requests and WebGPU requests cannot all be cancelled;
their eventual results are checked before proceeding. A device returned after
departure is destroyed before installing its callbacks or injecting the game.

Hash and pagehide listeners are removed on success/failure. The preparation
handler ends at game injection. It never releases the storage lease of an
initialized engine or treats pagehide as evidence of native shutdown. Existing
paired/named world lease checks still pass. Compatibility fingerprints are
unchanged; the same imported assets and rules are still hashed.

`tests/player-startup-cancel.test.mjs` executes the staged startup in a terminal
VM with controlled asynchronous file/GPU operations. Ten cases cover delayed
game-list fetch, profile-directory lookup, compatibility hashing, adapter and
device creation in ordinary/named worlds. All prevent injection after departure;
only the device case destroys a returned device. Unused named-world leases and
all preparation listeners are released. Separate cases prove pending hash
termination and zero hashes started after a delayed file open returns. Repeated
staging is idempotent, and removal of the device cleanup refuses staging.

Together with existing content-hash and paired/named storage tests,36 tests
pass with no skips. These are mocked preparation checks, not browser gameplay
or crash-recovery verification. The first invocation waited on a fixture with
a missing required profile; its specific confirmed-live test processes were
terminated. The corrected fixture includes the profile and a10-second timeout.
Preserve log001; successful logs002/003 supersede it.

Only the player HTML was updated in the served site. A static HTTP read confirms
localhost8000 matches it exactly. WASM size/inode/mtime remain unchanged. No
browser, native game or native build ran. Browser launches remain suspended
under AGENTS.md because the repeated host-app crash remains unresolved.

Evidence: `output/player-startup-cancel-001-staged.json`,
`output/player-startup-cancel-003-tests.log`, and the preserved earlier staging
source/player HTML at `output/player-startup-before-cancel-*`.

Reproduce from the parent workspace:

```sh
node --test --test-concurrency=1 tests/player-startup-cancel.test.mjs tests/content-hash.test.mjs tests/realm-session.test.mjs tests/paired-session.test.mjs
```

The existing four-kingdom heap captures also narrow the next native memory
investigation. Requested69912/45808-byte groups appear after visit6 and disappear
by load7. Requested4224-byte blocks lose addresses and decline in count during
several destination loads. They cannot be described as continuously accumulating
from the post-unload totals alone. Snapshot address membership is not allocation
identity or proof of safe cleanup. Persistent45568/22032-byte groups and CRT
growth still need owner/cache-policy evidence. All24 captures were rehashed in
`output/native-coordinate-fourway-002-size-turnover.json`; no new game launched.
Sustained native/browser memory bounds remain unqualified.
