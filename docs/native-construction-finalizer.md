# First terrain finalization during world construction

The original first normal/shading call provides an earlier investigation point
than the current Frontier observer, which runs after generation returns. The
pinned local call sequence places this first finalization before spatial-grid
construction and before the generator receives the new world pointer.

| Sequence | Verified site |
| --- | --- |
| Generator calls world factory | `004b2979` → `00491c70` |
| Factory calls derived constructor | `00491cb9` → `004911c0` |
| Derived constructor calls base constructor | `004911f4` → `005bb6e0` |
| Base constructor installs base-world vtable | `005bb730`, `0068a2ec` |
| Terrain constructor initializes arrays and zero heights | `005fda70`, `005aeb70` |
| Terrain constructor installs terrain vtable | `005f19d9`, `0068b660` |
| Base constructor publishes its terrain pointer | `005bb7e6`, world `+0x80` |
| Base constructor calls terrain initializer | `005bb7f8` → slot `+0x98`, `005bb300` |
| Initializer calls first normal/shading finalizer | `005bb336` → terrain slot `+0x10`, `005aebe0` |
| Base constructor later constructs spatial grid | `005bb88b` → `005b7f00` |
| Derived constructor later installs its vtable | `004912c7`, `00682950` |
| Factory returns and generator stores the world | `004b297e`, generator `+0x84` |
| Explicit player/placement stages begin later | `004b2a57` and following calls |

This ordering changes the proposed hook context. At the first finalizer's entry,
the configuration pointer identifies the constructing world: subtract `0x5c`
from that pointer. The generator's `+0x84` has not yet received this world, and
requiring the later derived vtable would reject the intended construction call.
Both audited world vtables resolve terrain-description selection at slot
`+0x44` to the same method, `005d9910`.

The initializer has three description branches: zero, minus one, and a resource
description. Verified argument cleanup on all branches gives this entry stack:

| Offset from finalizer-entry ESP | Value |
| ---: | --- |
| `+0x00` | Immediate return address `005bb339` |
| `+0x04` | Configuration pointer, world `+0x5c` |
| `+0x08` | Null rectangle |
| `+0x0c` | Saved initializer ESI |
| `+0x10` | Outer initializer return address `005bb7fe` |
| `+0x14` | Terrain-description argument |

A future entry hook should require this complete 24-byte frame, matching terrain
receiver and world pointer, expected base/terrain vtables, valid dimensions and
owned buffers, and an empty spatial-grid pointer. An independently scoped,
opted-in fresh-generation context is also necessary; a matching frame alone
does not authorize terrain mutation. These are prospective guard requirements,
not installed runtime checks.

The subsequent [construction registry audit](native-construction-registry.md)
identifies one initially empty group-3 actor registry. Its actor list and ID
tree must both match their empty constructor shapes. An empty ID lookup does
not validate the list or counts, so it cannot replace those structural checks.

The [placement dispatch audit](native-placement-dispatch.md) follows later
generation placement into actor registration and seven shared initialization
targets. One target conditionally invokes another callback. Their complete
effects remain unresolved, so the earlier construction frame alone does not
establish that joined border heights survive generation.

The audit verifies 49 construction instruction anchors and four virtual slots,
and reruns the preceding generation audit's 43 anchors. Its qualifier checks
the saved report against current original bytes, rejects an unpinned synthetic
input before PE decoding, and derives the same entry frame by abstract stack
accounting over all three initializer paths. No native instructions are executed
by those checks. No runtime source, save, WASM build, browser or game process is
changed. The preceding 242 JavaScript tests apply to unchanged runtime modules;
they were not rerun for this static analysis.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-construction-finalizer.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-construction-finalizer.py
```

Evidence is in `output/native-construction-finalizer-audit.json` and
`output/native-construction-finalizer-terminal-qualified.json`, with matching
source hashes and small logs. Exploratory searches for height-adjustment
callers remain unqualified: unrelated classes share the same virtual slot
offset, so a `+0x20` call does not identify terrain mutation.

Local ordering does not prove a complete constructor call closure, absence of
all actors/global references, preservation of heights by later operations, or
navigation safety. No border-mutation hook, joined generated border or live
native paging is qualified. The next engine step is to close those dependencies
before implementing the guarded geometry handoff. The browser/game suspension
remains in force while the host-app crash is unresolved.
