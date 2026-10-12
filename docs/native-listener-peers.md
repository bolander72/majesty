# Original peer removal in an isolated fixture

The [peer/cache lineage audit](native-listener-cache.md) showed reciprocal raw
peer pointers and a separate cache that peer unlink does not locally change.
The new check executes four original methods—link `005c2d70`, unlink
`005c2dd0`, list append `005c31e0` and first-iterator read `005c3850`—on four
synthetic listener-shaped objects. No game, renderer, dispatcher, native world,
actor or script engine is initialized.

There are 523 completed original calls. Two replays, with zero and `0xd3`
register/stack/new-node fill, each perform 32 cycles of linking a three-object
triangle, repeating one existing link, removing that pair while retaining both
unrelated pairs, and removing the remaining pairs. The logical graph after
every operation matches an independent expected edge list in both replays.

Across those 512 calls, 384 modeled 12-byte peer-node allocations are matched
by 384 original free-entry requests. Every cycle ends with no live peer nodes.
The peak is six nodes, or 72 owned bytes. Repeated linking does not allocate an
additional node for an already-present valid pair. Unrelated pointers remain
linked until their own removal. Original operations preserve all object fields
other than the peer count, and preserve guarded opaque cache images in every
call. Those images demonstrate non-mutation, not live cache validity or metadata
ownership.

The allocator/free entries are modeled cdecl operations with deterministic
slot reuse. The model clobbers caller-volatile registers; saved registers and
argument/stack cleanup are checked on return. Every slot has leading/trailing
canaries. CPU read hooks allow only live owned fixture state, and write hooks
allow only stack state, peer counts, sentinel links and live peer nodes.
Execution must stay on decoded boundaries of the four methods or the two
explicit allocator/free stubs.

Three controls confirm limits of the original helper behavior:

| Synthetic membership before the call | Original operation | Remaining state |
| --- | --- | --- |
| A points to B; B has no reverse pointer | Link A to B | Existing pointer causes an early return; asymmetry remains |
| A has no B pointer; B points to A | Unlink A from B | Missing forward membership causes an early return; reverse pointer remains |
| A has three B pointers; B has one A pointer | Unlink A from B | Three nodes are freed; one forward pointer remains after reverse membership is exhausted |

The controls leave three residual nodes in total. They are explicitly disposed
by the fixture, **not freed by original cleanup**. Two additional null-peer
calls return without allocation or mutation. These results require valid,
reciprocal membership before relying on the helper for scoped detach. They do
not prove arbitrary malformed-list safety, complete detach, or absence of
references elsewhere.

Only one fixture owns mapped CPU pages at a time. Each maps 36,864 guest bytes:
original code, one read-only vtable page, two stub pages, fixed state, a guarded
node arena, stack and return sentinel. All six fixtures remove their hooks and
unmap every page before the next fixture is created; final mapped guest bytes
are zero. This is not a Python-host, process-RSS, CRT, WASM or browser memory
measurement. Calls have a 5,000-instruction and 200,000-microsecond ceiling,
with a 500,000 original-instruction total limit. The observed run executes
52,523 original instructions; the largest call has 158 instruction-hook steps
including modeled stub entries and uses 44 stack bytes.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/check-native-listener-peers.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-listener-peers.py
```

The existing cache audit must match fresh pinned bytes before CPU setup.
The executable digest is checked again after all cases. Evidence is in
`output/native-listener-peers-emulated-observed.json` and
`output/native-listener-peers-terminal-qualified.json`, with source/evidence
hashes and a small emulation log. The qualifier checks current source identity
and observed results without executing original instructions again; it also
rejects unpinned input before PE decoding.

Runtime modules, original assets, saves and profiles are unchanged. No game or
browser launch or native build ran, and unchanged JavaScript tests were not
repeated. Live callbacks, dispatcher detach, cache metadata ownership,
world/actor/GPL cleanup, native paging and actual allocator/worker/GPU resources
remain unqualified. The app crash remains unresolved, launches stay suspended
and the full development goal remains active.
