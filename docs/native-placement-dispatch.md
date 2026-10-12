# Placement dependencies and height-writer inventory

The pinned original executable resolves the generation placement path through
world slot `+0x64` (`005a1480`). That wrapper converts coordinates with
`0042ff70` and `0042f060`, then calls world slot `+0x68` (`005a1350`).
The wrapper returns with 32 argument bytes removed; the initializer removes
36. A future interception must preserve the ABI of the specific entry.

The initializer obtains an actor through world slot `+0x60` (`0042c3d0`),
resolves its descriptor through `005a2120`, and registers it through world
slot `+0x6c` (`005a12e0`) before the following initialization callbacks.
It also writes three position words at actor offsets `+0x48`, `+0x4c` and
`+0x50`.

Five factory-installed actor tables share these seven initial targets:

| Actor slot | Initial target | Direct initializer call site |
| --- | --- | --- |
| `+0x40` | `005a1960` | `005a13de` |
| `+0x48` | `005a1a00` | `005a13ee`, conditional |
| `+0x20` | `005a2670` | `005a142f` |
| `+0x04` | `005a22c0` | `005a143b` |
| `+0x10` | `005a2430` | `005a1444` |
| `+0xb8` | `005b3550` | `005a144b` |
| `+0x34` | `005a2250` | `005a1455` |

The tables are `0067f96c`, `0068098c`, `0067fe6c`, `0068071c` and
`00680444`. The factory's eight switch entries, special MSGF branch and
fallback are verified locally. The fallback `005a12d0` returns null. This
closes the dispatch skeleton, not the constructor or callback call graphs.
Initial table values do not prove that an earlier callback cannot change a
later virtual target, including through modified content.

Actor slot `+0x20` is not the terrain height method at the same slot offset.
Its initial target `005a2670` conditionally updates actor `+0x70`, then calls
actor slot `+0xb8` at `005a2680`. Seven direct sites therefore do not bound
the number of calls or their effects. The shared callback bodies and their
nested calls remain dependencies for terrain-border safety.

The separate bulk height writer `005f1ae0` contains a conditional vertex-word
store at `005f1bf6`. Its iteration selects rows 1 through cell height and
columns 0 through cell width minus one. It can reach the left and bottom
edges while excluding the top and right edges. Its numeric operation and
caller ordering are not qualified here.

A reference inventory finds one four-byte little-endian word for point-height
method `005f1a40`, at terrain vtable slot `0068b680`, and none for bulk method
`005f1ae0`. Executable-section scans find no E8/E9 relative-call/jump encodings
targeting either entry. These are encoding inventories, not proof of absent
callers or unreachable code. Computed targets, other encodings and external
scripts or mods are outside that inventory.

The audit verifies 48 instruction anchors, 39 virtual slots and eight switch
targets. Its qualifier compares the report with fresh pinned bytes, rejects
an unpinned fixture before PE decoding, and independently checks reference
scan arithmetic with forward calls, backward jumps and truncated inputs.
No original instructions are executed, and no game, browser or native build
is launched. Runtime modules are unchanged; the preceding 242 JavaScript
tests were not rerun for this analysis.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-placement-dispatch.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-placement-dispatch.py
```

Evidence is in `output/native-placement-dispatch-audit.json` and
`output/native-placement-dispatch-terminal-qualified.json`, with source hashes
and matching small logs. A safe border-mutation hook, preservation through
later geometry operations and live native paging remain unqualified. The
subsequent [callback dependency audit](native-placement-callbacks.md) resolves
local initialization bodies into spatial-grid wrappers, parent/attached actor
recursion and an unresolved global-manager notification. Their full call graphs
and lifetimes remain open. The browser/game launch suspension
remains in force while the host-app crash is unresolved.
