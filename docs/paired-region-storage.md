# Stopped paired-region storage

`web/world/transfer-store.mjs` coordinates publication of two complete stopped
world snapshots. The original serializer and actor migration code must produce
and validate them first. It does not stop an engine, move an actor or expand the
native terrain grid.

The manifest uses the native `majesty-transfer-v1` format: slot, moved state,
two canonical region keys, each full-file length and SHA-256, and the expected
content identity. ASCII metadata is limited to 511 bytes. Source files are
bounded to 64 MiB each; copying and hashing use serial 4096-byte reads with an
incremental hash retaining one 64-byte block and one 64-word schedule. No full
GMP buffer is assembled by the coordinator. Hashing still reads each file in
full; metadata inspection can skip terrain, but integrity checking cannot.

A writer validates both currently selected files while holding an exclusive
lock. It checks the caller's predecessor manifest, stages the inactive source
and destination slots, checks the staged files independently, then publishes
one manifest. The previous pair stays selected until that publication completes.
Repeating an already-selected pair returns without writing. Changed predecessors
reject and require the caller to reload. Two slots per side retain four GMP
files regardless of the number of publications within this store.

`read()` verifies the selected pair and returns its identity. Use
`withSelected(consumer)` when copying selected file contents: it holds the read
lease throughout the callback, permits reads of at most 4096 bytes, and disables
the returned readers when the callback finishes. Holding a metadata object after
`read()` returns does not pin a reusable slot.

The OPFS adapter uses `createWritable()`/`close()` for publication and Web Locks
for participating readers/writers. Busy locks reject immediately rather than
accumulating queued transfers. All clients must share the same world-scoped
lock. The staged player now wraps paired startup with
`web/world/paired-session.mjs`: it validates the native fixture case/region/profile
scope, acquires that same exclusive lock before game startup, checks bounded
preparation metadata, and retains the lease for the document's lifetime. It
blocks a second loader and browser publication while the engine is present.
The wrapper does not release on runtime failure or pagehide after initialization;
neither proves native I/O has stopped. Web Locks releases the lease when the
browser destroys the owning context. A page hidden during preparation does not
start the game. There is no polling, timer or queued lock request.

This is a host guard for the ten copied diagnostic cases, not a general live
region handoff. C++ does not acquire Web Locks itself. Old cached/unwrapped game
pages must remain closed. Native CLI tools and older pages are outside this
protocol. Actual browser disposal, native worker termination, OPFS behavior and
sudden power-loss durability have not been tested.

The diagnostic prepares all cases under their exclusive locks before doing any
work. Inspection holds a shared lock throughout; corruption holds an exclusive
lock; publication uses the coordinator's lock. Its controls disable while an
operation runs so its selected case cannot change through the UI.

Run the lightweight terminal suite:

```sh
node --test tests/transfer-store.test.mjs
node --test tests/paired-session.test.mjs
node --test tests/*.test.mjs
```

Fifteen coordinator/hash/adapter tests pass, including real host file writes
and fresh store instances after injected publication failures. The OPFS adapter
test uses controlled writable-stream/lock doubles, not a browser. Four further
private qualification cases use actual previously qualified native GMP inputs
and the independent native typed inspector. They prove occupancy/relationships
in the selected stored bytes; no new engine launch, actual process interruption
or browser recovery is claimed. Thirteen additional startup/diagnostic tests
exercise the actual staged bootstrap, duplicate/invalid setting rejection,
loader/publication/inspection exclusion, failures before script injection,
navigation during preparation, retention after runtime failure, all-case
preparation locking and scope agreement with the native adapter. They use a
controlled lock service and DOM; simulated context disposal is not browser
verification. With the subsequent bounded content hashing addition, the
complete JavaScript suite passed 137 tests. Subsequent native terrain window
tests bring that to 147, including extraction under a selected-pair lease. See
[browser resource work](browser-resource-work.md).

The local browser diagnostic includes a stopped-publication control, prepared
by `scripts/stage-browser-transfer-fixture.py`. It must not be launched while
the repeated ChatGPT host-app crash remains unresolved. See the root AGENTS.md
and `output/app-crash-investigation.json`. Do not qualify browser behavior from
these terminal tests. The expanding world and multiplayer goal remains active.
