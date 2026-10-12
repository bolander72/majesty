# Releasing dormant checkpoint sources

Expired readers previously rejected further reads but closed over their backing
file sources. Keeping an old reader could therefore retain those sources after
the storage callback ended. This affected both independent native-region
checkpoints and paired checkpoints used for shared publication.

Both stores now use `CheckpointReadLease`. A reader retains its lease and scalar
source identifier; the lease owns at most 49 independent-region sources or two
paired sources. Cleanup marks the lease inactive and clears its source map on
success or failure. Expired readers cannot retain files through that map, read
again, or attach to a subsequent lease. Reads remain bounded to 4 KiB. A read
that finishes after revocation rejects before handing its bytes to a caller.
An already-running I/O operation can retain its own resources until it settles;
revocation does not cancel underlying I/O.

Selected readers now reuse the exact source whose size and SHA-256 were
validated. Previously both stores reopened the selected path after validation,
creating an additional source object for each checkpoint and potentially using
a replacement that had not passed validation. Metadata-only reads and commits
keep their existing return shapes; no checkpoint format changes.

Two new regression tests replace an in-memory path with different, same-sized
bytes after the original captured source has been hashed. The old code failed
both tests. Readers now consume the validated captured sources with one data
open per checkpoint; the next operation rejects the replaced file as damaged.
This assumes stable captured sources and cooperating writers using the shared
lock. Reusing a source cannot make a mutable adapter immutable or qualify OPFS
behavior during external file changes.

The paired terrain provider also clears its parsed-terrain map after its
snapshot callback. Native saves, manifests, locking, hashing and publication
formats are unchanged. No original profile or checkpoint is modified.

Five new Node tests check source-count limits, cleanup with escaped readers,
reads in flight during revocation, separation from subsequent leases, malformed
results and rejection before backing I/O. All 50 focused checkpoint/terrain
tests passed at introduction, as did all 242 workspace JavaScript tests then.
The subsequent [scene view and lifecycle cleanup](scene-view-ownership.md) passed
247 workspace tests. The current validated-source reuse change passes all 57
focused checkpoint/terrain tests and all 254 workspace JavaScript tests.

The bounded ownership probe runs the actual `NativeRealmStore.withRegions` and
`PairedCheckpointStore.withSelected` code with an in-memory adapter. Four cycles
each read 49 regional sources and two paired sources, alternating successful
and failed consumers. Validation and consumption now share each source object,
reducing data opens from 408 to 204 in this fixture. All 204 observed backing
source objects are collected while 204 expired readers
remain reachable. An expired reader using the previous closure shape retains
its source as a negative control. This is a Node/V8 reachability observation,
not a browser memory or operating-system resource measurement.

Reproduce without starting a browser or game:

```sh
node --test --test-concurrency=1 tests/checkpoint-lease.test.mjs tests/realm-store.test.mjs tests/terrain-scene.test.mjs tests/transfer-store.test.mjs
node --expose-gc scripts/check-checkpoint-lease-retention.mjs
python3 scripts/qualify-checkpoint-source-reuse.py
```

The updated modules are copied into the existing web site through
`scripts/stage-world.py`; staged and source module hashes match. No WASM build
or game/browser launch was performed. Evidence is in
`output/checkpoint-lease-retention-observed.json`,
`output/checkpoint-lease-terminal-qualified.json` and the corresponding focused,
workspace and retention logs under `output/checkpoint-source-reuse-*`. The probe records source hashes and Node/V8
versions and removes its previous evidence before running.
The qualifier checks the recorded test counts, current probe source identities
and staged module hashes. It records current source hashes after testing;
it does not rerun tests or establish when historical test logs were produced.

This closes a JavaScript ownership gap relevant to dormant-region unloading.
It does not bound engine actors, flat native terrain arrays, workers or GPU
resources, qualify live region paging or complete co-op publication. Actual
OPFS retention and live browser memory remain unmeasured. The host-app crash
is unresolved; browser/game launches remain suspended and the full development
goal remains active.
