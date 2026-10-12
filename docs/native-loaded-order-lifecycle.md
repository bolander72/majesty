# Original construction, copied-entry loading and deletion

`scripts/check-native-loaded-order-lifecycle.py` combines the original factory,
constructors, leaf/base/token readers, writers and deleting destructors in one
bounded CPU fixture. All 154 literal copied-save entries pass construction,
complete reading, byte-identical rewriting and deletion. Two synthetic kind-1
entries cover the supported type absent from those saves. This advances the
separate [fresh lifecycle](native-order-lifecycle.md) and
[copied-entry reader](native-checkpoint-order-readers.md) checks.

The original factory allocates the exact class extent, executes its constructor
and installs its initial tables. The original embedded table is mapped read-only;
the constructed pointer is not replaced by a synthetic table. Kind 7's constructor
allocates its ten-point buffer; kind 4's reader allocates its saved capacity.
Original instructions may access only current owned extents, the stack, initial
embedded table, factory jump table or controlled SEH slot. Freed extents become
inaccessible to original instructions.

After reading, the entire payload is consumed, kind and saved delay match source
words, and writing reproduces the exact bytes without changing object/path
storage. Before deletion every base/leaf name pointer must be zero. Original
deleting-destructor flag one releases path storage before the object where
applicable. Every nonzero modeled allocation is released once; unknown/duplicate
frees reject. No live modeled allocation remains at each case boundary. Saved
IDs/clocks are restored as data; callbacks, scheduling and movement never execute.

Thirty-two controls inject persistent stream error 7 before the first read or
before the final four payload bytes, under two stack fills for all eight types.
A failing primitive writes no destination bytes and stops consumption. The
original reader returns error with a potentially partial object. Early kind-4
failure can still request zero path bytes because capacity was not read; allocation
checks use the actual partial capacity, bounded at 80 bytes. Each failed object
is deleted directly without linking or rewriting it, releasing every nonzero
modeled allocation. Original payload bytes remain intact.

These controls qualify cleanup of these unlinked, empty-name failed entries
under the modeled stream contract. Arbitrary I/O failures, partially copied raw
blocks, bank rollback, exception unwinding and real allocator failure remain
unverified. The [original bank reader](native-order-bank-failures.md) still ignores
leaf errors and can link partial state; a checked importer must observe each leaf
result before linking.

There are 188 cases and **720 original calls / 113393 original instructions**:
156 successful lifecycles (154 literal, two synthetic) and 32 interrupted reads.
Instruction counts are construction 19400, reading 43243, writing 44219 and
deletion 6531. Allocation requests and free arguments each number 235, including
zero-size/null events. All cases finish with zero live modeled bytes. Request
extents peak at 180 bytes; guest mappings peak at 94208 bytes and are unmapped and
checked empty after each case. These are fixture bounds, not browser/process RSS
or total native simulation memory.

Each phase has a 1024-step/one-second limit; the run is capped at 250000 original
instructions. Payloads are at most 512 bytes, path storage at most 80 bytes and
JSON evidence at most one MiB (279225 bytes here). Register/stack preservation,
normal simulated SEH-chain restoration and writer immutability are checked.
No Windows exception dispatcher executes.

Allocation/free, scalar/raw/status streams and empty-name clear/copy helpers
remain modeled. All captured names are empty; positive-name allocation/release
is unverified. Banks, destination actors, publication, reference remapping and
full actor rollback are outside this fixture. The app crash is unresolved;
game/browser launches and builds remain suspended. Served game and player saves
are unchanged.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/check-native-loaded-order-lifecycle.py
```

A subsequent [copied-bank cleanup trial](native-order-bank-rollback.md) now
executes original construction/read/write/removal/deletion for all 89 actors'
three banks under bounded models. It checks unique membership and unpublished
partial-state cleanup; full actor rollback and live activation remain unverified.

Evidence: `output/native-loaded-order-lifecycle-emulated-observed.json`, its small
log and `output/native-loaded-order-lifecycle-terminal-verified.json`. Metadata,
capture generation, entry readers and fresh lifecycle scripts are unchanged and
source-bound dependencies. Runtime JavaScript/tests are unchanged, so the prior
308-test suite was not repeated. Complete bank cleanup, names, destination
navigation/references, native simulation paging, live hero travel and independent
household WAN qualification remain unfinished; the full goal stays active.
