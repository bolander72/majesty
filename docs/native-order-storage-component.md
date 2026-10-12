# Native ownership for unpublished order storage

The subsequent [tracked original cleanup](native-order-retirement.md) adds an
irreversible guarded destruction phase and exact extent retirement. Definite
refusal retains ownership; cancellation across a pending free latches its
uncertain outcome and prevents a guessed second free. Current ownership checks
total 1184. The native bank fixture now destroys 180 healthy private graphs
through original removal/destructors and 2308 tracked CRT frees. Live published
actor cleanup and full world resource bounds remain unqualified. Counts below
retain the scope and source identities of their earlier runs.

[Real empty names](native-order-empty-names.md) now require storage by default.
The maximum native profile is 518 descriptors, including typed one-byte strings;
the combined request cap remains 64 KiB. Current ownership checks total 1031.
The older 390-descriptor model below requires explicit controlled-name mode.

The newer [allocation scope controller](native-order-allocation-component.md)
now supplies guarded construction/read ordering and native matching in the bank
fixture. The latest real-name run has 831 scope checks and 178896 original-bank
checks, with direct current JS descriptor consumption. The 175167-check storage-integration run below retains historical source
hashes; journal behavior and generic guard code were unchanged by extraction.

The game-owned `native_order_storage.{h,cpp}` component now owns reservation,
claim and release for the compiled private bank-loading fixture. It stores at
most 390 descriptors for three banks and 128 initial entries, with a 64 KiB
combined request cap. It validates the complete typed profile before allocation
and copies descriptors before calling the allocator. Guest addresses remain
32-bit offsets; no host pointer is substituted.

Reservation failure releases the trusted prefix. A refused free retains its
extent for retry. Invalid or overlapping allocator returns latch an allocator
violation: their identities remain recorded for external reconciliation, and
the component does not guess that an unknown extent can be freed. Zero-byte
paths require a claim but own no allocation. Cleanup is explicit; callers must
keep the journal outside every frame that a guest nonlocal exit can skip.

`Journal::invoke` owns its guarded-call cookie and pins storage until that call
returns. A nested ordinary callback cannot claim the outer invocation's storage,
release it or recursively invoke the same journal. The generic runtime's new
`guest_call_guarded_active` query sees older guarded calls across the current
host thread's callback chain. It reports lifetime only; cancellation still
requires the eligible innermost cookie for the exact CPU.

The focused native ownership suite passes **498 checks**. It exercises each of
11 positive allocation-failure positions, frozen request identities, retryable
free refusal, an invalid allocation alias, all 390 descriptors, the request
byte limit and nested-callback lifetime. Its maximum-descriptor case admits and
claims storage; it does not execute a 128-entry original bank graph. The generic
guard suite passes **1073 checks**, including nested guards, ordinary callbacks,
foreign CPUs and foreign host threads.

The [compiled private bank fixture](native-bank-read-hooks.md) uses this actual
component and passes **175167 checks** across 196 trials, 1690 native calls and
1329 allocation hooks. One ordinary nested original getter hides the parent's
eligible cookie while the component remains pinned. Healthy bank rewrites,
12 owned allocation refusals and four sticky stream failures still pass. Every
trial returns guest heap block and byte totals to baseline; the largest private
actor journal adds 640 rounded guest heap bytes. These counters exclude host
metadata, the mapped executable, guest arena and browser/world memory.

Reproduce through the official game tools, sequentially:

```sh
cd upstream/majesty-recomp
.venv/bin/python tools/test.py --native-test native_order_storage_tests --jobs 1
.venv/bin/python tools/test.py --native-test guarded_call_tests --jobs 1
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
```

The bank fixture requires the private pinned executable/translations and the
input prepared by `scripts/prepare-native-order-hook-fixtures.py`. The ownership
suite uses controlled dispatch and requires no original executable or map.

The component is not yet included in the production `game.toml` native source
list or called by production actor arrival. Stream/name/manager helpers remain
controlled prerequisites, and the hook matcher remains test scaffolding.
Destination references, navigation, clocks, populated publication, original
nonlocal exits and live graph rollback remain unqualified. This proves private
storage ownership, not bounded live-world simulation or browser performance.

Current evidence is `output/native-order-storage-component-native-observed.json`
and its copied CTest logs. Earlier reports preserve their historical source
hashes. The served browser artifacts and copied checkpoints are unchanged; no
game entry, mission loop or browser was launched. The host-app crash remains
unresolved and browser/WASM launch suspension remains in force.
