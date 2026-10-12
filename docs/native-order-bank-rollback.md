# Original copied-bank loading and unpublished cleanup

The original three-bank payloads for all 89 actors in the copied Scions and
Brashnard checkpoints now pass original bank construction, loading, byte-identical
rewriting, low-level order removal and bank deletion. Both stack fills pass:
267 banks / 154 entries per fill. This extends the
[loaded-entry lifecycle](native-loaded-order-lifecycle.md) to native bank lists.
The world manager getter, allocator/free, streams and empty-name helpers remain
modeled. This is an unpublished initial-type bank fixture, not actor activation
or complete regional migration.

`scripts/prepare-native-order-bank-cases.mjs` checks path-storage admission, fully
traverses each attachment and compares parsed words with literal bank ranges in
the unchanged owned copies. The 89 captures contain 267 bank payloads and 31216
literal bytes. Each records filename/hash, actor identity, three offsets/counts,
payload hashes and unchanged words. Output JSON is 211380 bytes. Serial reads
total 11508093 bytes, with 4 KiB maximum reads and per-file 64 MiB / 16384-request
limits. Per-actor limits are three banks, four entries per bank, eight total
entries and 2048 bytes per bank. Captures are diagnostic fixtures, not a runtime
world catalogue.

Before CPU creation, the native runner checks capture source hashes and compares
every bank with the previously validated literal entry payloads, including
discriminators, order, counts, versions and contiguous source ranges. Duplicate
actor identities, changed bytes or oversized captures reject. No normalization
is allowed. Existing initial virtual slots and constructor allocation profiles
are pinned against the original executable hash.

The fixture reserves each 20-byte bank object and executes constructor
`004abcc0` / base `005e4c60`, which allocates its 12-byte sentinel. Bank ownership
is an opaque tag; no real UNIT is loaded. Original reader `005e4d20` invokes the
original factory and leaf readers, then allocates and links 12-byte nodes. The
manager getter returns a controlled initial manager table instead of accessing
live globals. Original writer `005e4e20` reproduces each literal bank and leaves
object/path storage unchanged. List links, tail/counts, unique membership and
allocation ownership are checked independently after loading and each removal.

Two distinct cleanup contracts matter:

- Bank deleting destructor `004abce0` / base `005e4cc0` releases list nodes,
  sentinel and bank storage. It **does not delete orders**. Two ownership
  controls delete a populated synthetic bank first, confirm its order remains
  allocated, and then explicitly delete that orphan.
- Low-level method `005e4f90` removes matching nodes and invokes the order's
  deleting destructor. It also deletes a nonnull order even without a matching
  node, so the caller must establish ownership and membership first. The fixture
  checks those preconditions, removes each unique owned order, then deletes the
  empty bank. Normal callback-based clearing is not used or qualified.

Four controls interrupt one copied path-bearing bank after the first entry's
discriminator or near the payload end, under two stack fills. The original bank
returns persistent stream error 7 but has already linked one or two entries.
The fixture stops further loading, skips rewriting and removes all linked state
before deleting all three banks. Every modeled allocation is released. These
controls qualify those unpublished partial graphs under the modeled all-or-none
primitive read contract; arbitrary partial copies, allocation failures, exception
unwinding and linked live actor rollback remain unverified.

There are 186 scenarios: 178 copied actor trials, two synthetic kind-1 trials,
four interruptions and two destructor ownership controls. They complete 2524
top-level original calls / 316092 original instructions. Peak guest mappings are
106496 bytes; all mappings are explicitly unmapped and checked empty after each
scenario. Modeled positive allocations peak at 556 bytes and finish at zero.
These are fixture request/address-space bounds, not browser memory, allocator
overhead, process RSS or complete native simulation bounds.

Each call is limited to 2048 steps/one second; the run has a one-million original
instruction budget. The arena is bounded at 2048 bump bytes, with at most 32
allocation/free events per scenario. Native reads/writes are restricted to live
owned extents, stack, controlled SEH/manager data and pinned read-only tables.
Freed extents become inaccessible and duplicate frees reject. Registers, stack,
normal SEH restoration and bank writer immutability are checked. Callbacks and
movement methods are outside the available instruction ranges.

Evidence JSON is capped at one MiB (642081 bytes). Compact results cover every
scenario; complete allocation/free traces are retained for eight ordinary trials
and all six interruption/ownership controls, with trace digests for the rest.
All captured names are empty. Positive-name release, real allocator behavior,
world manager lookup, active scheduling, destination references/navigation and
complete actor rollback remain unqualified.

```sh
node scripts/prepare-native-order-bank-cases.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
upstream/majesty-recomp/.venv/bin/python scripts/check-native-order-bank-rollback.py
```

Evidence: `output/native-order-bank-cases.json`,
`output/native-order-bank-rollback-emulated-observed.json`, their small logs and
`output/native-order-bank-rollback-terminal-verified.json`. Runtime JavaScript,
existing tests and prior fixture scripts are unchanged; the 308-test suite was
not repeated. No game/browser launch or native/WASM build ran. Served artifacts,
copied saves and player data are unchanged. App crashes remain unresolved and
launch suspension holds; the full cooperative/expanding-world goal stays active.
