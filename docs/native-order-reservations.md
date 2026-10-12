# Checked storage reservation for unpublished order banks

The current profile includes a one-byte base-name reservation for every order,
plus a one-byte leaf name for kinds 2/5/6/11, before its node. Its maximum is
518 descriptors; the combined 64 KiB cap includes these bytes. All 36 positive
allocation refusal and throw positions in the mixed eight-kind profile pass,
with 1088 requested bytes. Together with planner and claim-scope controls,
24 focused tests pass serially.

The new JS capture of 89 unchanged copied actors contains 1145 descriptors /
28060 requested bytes, written to `output/native-order-real-name-reservation-cases.json`.
The producer preserves the older capture. Direct native consumption now passes
178896 checks / 198 trials, including exact original field pointers and NUL
bytes. [Real name storage](native-order-empty-names.md) describes the private
native runner and its remaining live integration limits.
The 390-descriptor/24-position figures and native replay evidence below are
historical controlled-name results and exclude original name allocations.

`web/world/order-reservations.mjs` now reserves all storage for an initial
empty-name order attachment before exposing a journal to a loader. It uses the
[combined request admission](native-order-restore-bounds.md), so unsupported
names, oversized capacity, entry limits and late malformed records reject
before any allocation. No native methods run from this module, and arrival
remains gated pending full actor integration.

The frozen request profile contains bank objects and sentinels, followed by each
order object, applicable path buffer and list node. It has at most 390 descriptors
(six bank/head slots plus three per each of 128 entries), with combined positive
requests at most 64 KiB. A kind-4 zero-byte path request remains a descriptor
but calls no allocator. Absent attachments reserve nothing; three empty banks
reserve 96 bytes. Metadata and request-byte limits do not bound allocator
overhead, other actor state or complete native simulation memory.

`reserveCheckpointActorOrderStorage(source, unitId, port)` takes allocation and
free callbacks for **guest** storage. It returns a frozen journal only after all
requests succeed. `claim(request)` checks role, bank, entry index, kind and size,
returns the reserved guest address once, and rejects repeated/unexpected claims.
`assertFullyClaimed()` detects an incomplete successful load. Neither method
constructs an actor, remaps references or publishes state.

On reservation refusal or an allocation exception, the journal frees its completed
prefix in reverse order. Its release also covers unused storage and unlinked or
unpublished constructor blocks, so cleanup need not discover allocations by
walking bank pointers. Concurrent release calls share one cleanup, claims stop
as cleanup begins, and completed release is idempotent. If free refuses or throws,
the allocation remains owned; the thrown reservation error retains a `cleanup`
handle for retry. Other releasable blocks are still attempted.

The allocator port must provide all-or-none allocation, unique owned guest extents,
and definitive free outcomes: zero/null or an allocation exception has no new
extent; false/free exceptions leave the original extent owned. An invalid or
overlapping returned extent violates that contract. Known prefix storage is
released, but the journal remains `allocator-contract-violated` with the untrusted
result exposed for reconciliation. It does not report that cleanup is complete or
double-free a known alias. An allocator that frees and then throws cannot use this
port contract without an adapter that resolves the actual outcome.

All eight focused tests pass. They cover eight types, all 24 allocation-refusal
and all 24 allocation-throw positions in a mixed profile, reverse cleanup,
retained/retryable failed free, exact claim identity, concurrent/idempotent
release, zero-byte paths, empty/absent attachments, preallocation refusal,
the exact 390-descriptor limit and an overlapping-port result. All 321 workspace
JavaScript tests pass sequentially.

The original-CPU fixture consumes request profiles emitted by the JavaScript
module, not guessed native sizes. `scripts/prepare-native-order-reservations.mjs`
binds those profiles to the previously validated literal copied bank payloads.
All 89 copied actors contain 881 descriptors / 27796 requested bytes. Copied
file hashes and identities remain unchanged. The capture is 338229 bytes and
uses serial reads of at most 4 KiB, with per-file 64 MiB / 16384-request limits.
It retains diagnostic cases only, not a runtime world catalogue.

`scripts/check-native-reserved-order-banks.py` independently validates every
descriptor against the original factory sizes and the earlier literal entry
captures before creating a CPU. It reserves each extent first under a bounded
allocator model. Original bank constructors, original factory/leaf constructors,
readers and writers then receive those exact reserved addresses through strictly
matched allocation claims. Bank lists, membership, owner tags, empty names,
writer immutability, registers, stack and normal SEH restoration are checked.
All 89 actors pass under both stack fills with byte-identical bank rewrites.
Two synthetic kind-1 trials cover the type absent from the copies.

Six stream-failure trials interrupt a real bank after an entry discriminator,
just before a kind-4 body or near its end. The native reader may already have
linked a partial entry; all storage still belongs to the journal and is released
without callbacks or list traversal. A failed kind-4 read can request zero before
consuming saved capacity. In that case the fixture returns zero for the failed
read's zero request and retains the unused reserved path for rollback; this is
not successful path restoration or permission to publish incomplete claims.

Twenty-eight reservation-failure controls reject each of the 14 allocation
positions in a copied profile under both fills. They release the completed prefix
and invoke **no original native methods**. Unlike the unchecked
[UNIT loader](native-unit-order-loading.md), they never pass a failed allocation
into a constructor or reader. The original UNIT reader/getter is not called by
this fixture, and no existing populated actor is replaced.

There are 214 scenarios, 1644 completed top-level original calls and 274066
original instruction visits. Guest mappings peak at 106496 bytes and are
explicitly unmapped and checked empty after each scenario. Modeled positive
requests peak at 556 bytes and finish at zero. Per-call limits are 2048 steps /
one second, with a one-million-instruction total budget, 2048-byte arena and at
most 32 reservations per fixture case. Detailed traces are bounded and report
JSON is capped at one MiB.

The fixture models heap allocation/free, streams, empty-name helpers and manager
lookup. Raw journal cleanup releases only unpublished initial-profile extents;
original deleting destructors, real allocator behavior, positive-name cleanup,
exceptions and live callback/scheduler state are not qualified. A live adapter
still needs a stopped ownership lease, prepared-copy revalidation, scoped
allocation interception, destination references/navigation/clocks, actor rollback
and atomic publication. This reservation component is not installed in the
native/WASM import path and does not enable populated arrivals.

```sh
node --test tests/order-reservations.test.mjs
node scripts/prepare-native-order-reservations.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
upstream/majesty-recomp/.venv/bin/python scripts/check-native-reserved-order-banks.py
node --test --test-concurrency=1 tests/*.test.mjs
```

Evidence: `output/native-order-reservation-cases.json`,
`output/native-reserved-order-banks-emulated-observed.json`, their compact logs,
focused/workspace test logs and `output/native-order-reservations-terminal-verified.json`.
No game/browser launch or build ran. Served game artifacts and player data remain
unchanged; app-crash suspension continues and the full goal stays active.
