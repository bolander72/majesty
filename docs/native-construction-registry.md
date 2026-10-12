# Actor registry before the first terrain finalizer

The successful base-world setup creates one registry group before the
[first normal/shading call](native-construction-finalizer.md). That group is
kind `3`, which the original registered-actor lookup selects. A non-null world
registry pointer therefore does not imply that actors have already been placed.
The group's actor list and ID tree are initialized empty.

| Structure | Verified constructor state |
| --- | --- |
| World `+0x84` | Registry-container pointer |
| Container `+4`, `+8` | Linked-list sentinel and group count; count becomes 1 |
| Group `+4` | Kind 3 |
| Group vtable | `0068a3a4` |
| Group `+0x0c` | Embedded actor-list head with zero value |
| Group `+0x10`, `+0x14` | Both link to group `+0x0c` |
| Group `+0x18` | Actor-list count 0 |
| Group `+0x24` | Actor-ID tree header |
| Tree header left/right | Both link to the header itself |
| Tree header parent | Global nil sentinel from `006d8590` |
| Group `+0x2c` | Actor-tree count 0 |

World setup calls `005ba670` with kind 3, installs the specialized group vtable,
and inserts the group into its initially empty container. `005a10d0`, the
registered-actor lookup, selects that same kind and dispatches group slot
`+0x28` to `005ba8d0`, then `00596670`. Registration broadcasts through
`00596a40` to group slot zero, `00596570`, which updates the tree and actor list.
This connects the constructor fields to actor indexing rather than inferring
their purpose from field offsets alone.

The tree lower-bound method `005976d0` returns its header when the root equals
the global nil sentinel. On that branch it does not read the requested key.
`00596670` then recognizes the header and returns zero. The verified 26-
instruction empty path does not read the actor-list links or either count.
Consequently, an empty lookup result cannot establish that both representations
are empty or consistent. The original query is not an emptiness validator.

A future border hook must check the complete container/group links and both
empty representations, alongside the exact construction frame, terrain
receiver, valid pointers/buffers and fresh-generation scope. The global nil
sentinel and allocated headers must be valid and non-null. The initial
spatial-grid pointer being null is an additional condition, not a substitute
for registry checks. Allocation failures and partially initialized structures
do not satisfy this successful-setup contract.

The audit verifies 50 anchors, 13 complete instruction ranges and four virtual
slots. It reruns the preceding construction/generation ordering audits. The
qualifier compares the saved report with current pinned original bytes,
rejects an unpinned synthetic input before PE decoding, and checks the empty
query's branch/dataflow sequence. It does not execute native instructions,
construct a live world, insert/remove actors or inspect browser storage.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-construction-registry.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-construction-registry.py
```

Evidence: `output/native-construction-registry-audit.json` and
`output/native-construction-registry-terminal-qualified.json`, with matching
source hashes and small logs. Runtime modules are unchanged; the preceding
242 JavaScript tests were not repeated for this static analysis.

This establishes the original setup shape and a stronger proposed guard. It
does not prove that shape still holds at a live callback, close every constructor
helper/global alias, exclude unregistered actors, or establish that later
operations preserve border heights. This static audit did not install a runtime
guard or border hook. Subsequent [connected-generation work](native-connected-terrain.md)
checks the derived world's 17 empty groups in an isolated opt-in native hook.
Live native paging and co-op publication remain unqualified, and
browser/game launches remain suspended while the host-app crash is unresolved.
