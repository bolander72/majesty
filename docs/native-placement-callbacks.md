# Actor initialization reaches spatial and global state

The [placement dispatch audit](native-placement-dispatch.md) resolved seven
initial actor callbacks. The subsequent callback audit now checks 17 complete
local ranges in the pinned original executable: 550 instructions, 63 anchors,
41 call sites and 30 supplemental slots across five factory-installed tables.
Every local jump in these ranges lands on a decoded instruction boundary within
its range. Calls remain separate dependencies; local branch coverage does not
close a call graph.

Three ranges contain no calls: descriptor index query `005a1960`, descriptor
value query `005a1920`, and zero-result method `005a2250`. The index query can
write a supplied output pointer. Its signed index comparison is not a complete
bounds check. These findings do not authorize arbitrary receivers or arguments.

The other callback paths explain why camera eviction cannot establish that an
actor is safe to unload:

| Initial callback | Verified local dependency |
| --- | --- |
| `005a1a00`, slot `+0x48` | Invokes actor slot `+0x3c`, initially `005a1920`, then conditionally writes actor `+0x78` and `+0x44` |
| `005a2670`, slot `+0x20` | Conditionally writes actor `+0x70` and invokes slot `+0xb8` |
| `005a22c0`, slot `+0x04` | Looks up a descriptor through global `0071c6c8`, rebinds actor `+0x6c`/`+0x80`, calls component `actor +0x18` slot zero, then updates position through `005ad7a0` |
| `005a2430`, slot `+0x10` | Can invoke setup helpers `00628c60` and `00628410`; those call graphs remain open |
| `005b3550`, slot `+0xb8` | If global `0071c68c` is nonnull, obtains its `+0x1c` manager and invokes manager slot `+0x08`, passing the actor |

`005ad7a0` can call actor slots `+0xb8` and `+0xbc` both before and after its
position update. It writes actor position words `+0x48`, `+0x4c`, `+0x50`,
derives cell coordinates through `005ad5b0`, invokes cell-update slot `+0x9c`,
and calls refresh helper `005ad540`.

Across the five initial factory tables, slot `+0x9c` resolves to `005ad470`.
That method invokes slot `+0x98` before writing actor cell coordinates `+0x54`
and `+0x58`, then invokes slot `+0x94`. These resolve to wrappers `005ad400`
and `005ad3e0`, which read the parent world's spatial grid at world `+0x88`
and call grid methods `005b88a0` and `005b8630`. The wrappers are verified;
complete grid-method effects and update atomicity are outside this audit.
The cell-update method additionally invokes the dynamic function pointer at
`006ce230`, whose live target is unresolved.

Parent cell and position helpers `005ad420` and `005ad5b0` can resolve actor
parent IDs at `+0x74` through world actor lookup `005a10d0`, then recurse.
Refresh helper `005ad540` also recurses over attached actors and can notify
world `+0x30` through observer slot `+0x18`. Initial slot `+0xbc`, `005adca0`,
can invoke attached actors' `+0xb8` notifications. The attached container is
at actor `+0x94`; attached actors' live vtables are not established by the
five factory tables. Cycle behavior and recursion depth remain unqualified.

Refresh also reaches actor bounds method `005b36c0` through slot `+0xc4`.
That method invokes component, bounds and virtual methods and writes actor
bounding fields. Its callees remain dependencies. No complete exclusion of
later terrain edits, safe border hook or live native paging is claimed.

The subsequent [notification lifetime audit](native-notification-lifetime.md)
resolves the constructor-installed manager into a listener dispatcher. Its list
holds listeners, and base listener destruction removes the first matching
membership node. Derived notification bodies and live actor retention remain
open. A paging design
must account for global notifications, spatial-grid entries, parent/attached
actor references and observer state; a region's registry alone is insufficient.
For border generation, unresolved component/setup calls still prevent proving
that early joined heights survive initialization.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-placement-callbacks.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-placement-callbacks.py
```

The qualifier compares saved evidence with fresh pinned bytes and rejects an
unpinned input before PE decoding. Five synthetic flow checks distinguish
inventoried unknown calls from escaping jumps, jumps into instructions,
unresolved indirect jumps and missing returns. Evidence and source hashes are
saved in `output/native-placement-callbacks-audit.json` and
`output/native-placement-callbacks-terminal-qualified.json`, with small logs.
No original instructions are executed; no runtime files, saves, game, browser
or native build are changed or launched. Unchanged JavaScript tests were not
rerun. The crash remains unresolved and the launch suspension stays in force.
