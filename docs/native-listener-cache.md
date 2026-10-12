# Peer-pointer and cached-record lifetime

The [listener resource audit](native-listener-resources.md) left two copied
record words opaque. The next pinned-byte audit traces their provenance and
separates cached records from the listener's raw peer-pointer list. It checks
10 decoded ranges, 438 instructions, 51 anchors and seven initial vtable words.
Local branch targets are closed; no original instruction or lifetime operation
executes.

| State on the listener | Layout and locally verified behavior |
| --- | --- |
| Dispatcher membership | Back-pointer at `+4`; the global dispatcher has a separate list of listeners |
| Reciprocal peers | Embedded list at `+8`, sentinel at `+0x10`, count at `+0x14`; 12-byte nodes store raw peer pointers at node `+8` |
| Third variant's cache | Collection at `+0x80`, sentinel at `+0x88`, count at `+0x8c`; 36-byte nodes contain embedded values |

The peer-link method `005c2d70` scans for the input pointer and returns early
when it is present. Otherwise it invokes the embedded list's slot `+4`, then
swaps endpoints and repeats. The constructor-installed list target `005c31e0`
allocates a 12-byte node, stores the raw argument pointer and increments the
count. This is a reciprocal-link path under valid list state, not proof of
repair for asymmetric membership. A missing or already-present membership
can cause an early return before the reverse endpoint is checked.

Peer unlink `005c2dd0` searches and removes a matching node, decrements the
endpoint's `+0x14` count, then swaps endpoints. Its local memory destinations
are an iterator stack temporary, the node's next/previous links and the peer
count. Its calls are two first-iterator reads and an original node free.
It does not locally change the keyed cache at `+0x80`. This distinction matters
for region retirement: removing reciprocal pointers does not by itself clear
cached records or establish that no other reference remains.

For the third constructor-installed listener table `0068a8f0`, registration
word `+0xe8` selects `005c88f0`. That body calls peer linking, obtains a four-word
record through the input's virtual slot `+0x58`, transforms it through its own
slot `+0x98`, and appends a cache record. There are no local conditional branches
around the append. Peer-pointer duplicate suppression therefore does not suppress
the subsequent cache append when that helper returns normally.

The two previously opaque copied words have these immediate sources:

| Embedded value word | Proven source in `005c88f0` |
| --- | --- |
| `+0x14` (node `+0x1c`) | Input object's `+0x1c` word; on the audited base listener construction path this came from its first constructor argument |
| `+0x18` (node `+0x20`) | The **second caller argument**, at entry stack `+8` |

The decompiled pseudocode misleadingly describes the second word as an
unaffiliated return-address value. A symbolic ESP walk through the original
wrapper resolves its read to entry `ESP +8`, rather than the return address at
entry `ESP`. The initial callee methods use the expected `RET 4` or `RET 12`
argument cleanup and the wrapper itself uses `RET 8`. This conclusion is
conditional on the expected ABI; it does not qualify dynamic input identity.
The second caller argument may itself be a pointer. Its meaning, ownership and
safe persistence across a restored engine remain unqualified.

The subsequent [isolated peer-method checks](native-listener-peers.md) exercise
valid reciprocal pairs with unrelated peers and guarded cache images. They
also confirm three asymmetric/duplicate cases with residual links. This is
synthetic original-CPU evidence with modeled allocation, not live detach.

Initial input slot `+0x58` targets `005c3020` across four audited tables. It
constructs the output from the input's four-word rectangle at `+0x24`, adjusts
it by offsets and invokes another virtual slot `+0x88`. The receiver's initial
slot `+0x98` targets `005c8230`, which transforms the rectangle using its
`+0x5c` parameter through `004f6bb9`. These remaining virtual/numeric effects
are open; the record lineage does not prove absence of actor references.

Cache update `005c7a00` and read `005c7a50` compare the key at node `+0x1c` and
operate on the **first** matching record. Both touch only the four record words
at node `+0x0c`, `+0x10`, `+0x14` and `+0x18`; they do not change keys, caller
metadata, list links or counts. A missing-key read leaves its output untouched.
Repeated keys can therefore retain distinct metadata while later lookups select
the earlier entry. Deduplicating or replacing these records requires caller
semantics; a blind patch would change original behavior.

The next safe detach work must qualify both peer endpoints, identify all cache
writers and callers, account for metadata ownership, and define cache residency
separately from dispatcher and peer-list membership. Neither helper guarantees
arbitrary malformed-list safety or complete reference release. This audit does
not qualify live region paging, complete world/actor/GPL teardown or bounded
native simulation.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-listener-cache.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-listener-cache.py
```

The qualifier compares evidence with a fresh audit, rechecks the executable
digest, and rejects unpinned input before PE decoding. Independent fixtures
check stack displacement and explicit memory-destination classification.
It verifies stack argument origins, callee cleanup, reciprocal endpoint swaps,
unconditional append, peer-unlink stores and first-match record-only writes.
Evidence is in `output/native-listener-cache-audit.json` and
`output/native-listener-cache-terminal-qualified.json`, with source/evidence
hashes and small logs. Runtime code, assets, saves and profiles are unchanged.
No game/browser launch, native build or CPU emulator ran. The prior 247
JavaScript tests were not repeated for unchanged runtime code. The app crash
remains unresolved, launches remain suspended and the full goal remains active.
