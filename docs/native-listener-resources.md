# Listener resources that region teardown must account for

The [notification lifetime audit](native-notification-lifetime.md) identified
a global dispatcher whose list owns listeners. It did not close the derived
listener destruction paths. The new resource audit pins 13 complete decoded
ranges, 374 instructions, 71 anchors and four vtable slots to the original
executable. All local branch targets land on decoded instruction boundaries.
No destructor, allocator or original CPU instruction executes.

| Initial listener table | Deleting wrapper | Destructor body | Locally visible cleanup |
| --- | --- | --- | --- |
| `0068a678` | `005c3ae0` | `005c3b00` | Two virtual resource deletions and a resource-provider call |
| `0068a784` | `005c4220` | `005c4570` | Referenced object, drawing object at `+0xe8`, resource handle, component and embedded storage |
| `0068a8f0` | `005c7c20` | `005c7c40` | Referenced object, drawing object at `+0x98`, component, embedded-value collection and embedded storage |

Each body invokes base listener cleanup `005c2760` after its derived cleanup.
Each deleting wrapper then conditionally frees the listener object when the
deletion flag's low bit is set. This is whole-listener destruction; using it to
detach one region still requires proving that the listener and its resources
belong to that region and that unrelated listeners remain intact.

For two variants, drawing cleanup calls `00505490` before freeing the enclosing
drawing object through `00645bc0`. `00505490` visits precisely the pointer fields
at drawing-object `+0x3c` and `+0x40`, frees non-null arrays through `0064d4b6`,
and zeros both pointers. Its only explicit memory destination is that pointer
write. It does **not** reset the rectangle counts. The [rectangle audit](native-listener-rectangles.md)
separately identifies two initial 800-byte arrays. This destructor is a release
operation, not a buffer-reset routine that is ready for subsequent drawing.
The initial fixed arrays do not establish a bound for every listener resource.

The third listener's collection at `+0x80` has its sentinel at `+0x88` and
count at `+0x8c`. Its destruction loop unlinks each node, invokes slot zero with
flag zero on the **embedded object at the address `node + 8`**, then frees the
node. The word at `node + 8` is the embedded object's vtable, not a pointer to
an actor or a separately allocated payload. Treating it as such would use the
wrong receiver; separately freeing the embedded address would also violate the
node's allocation ownership. The sentinel is freed and head/count fields cleared.

The original insertion body `005c7930` allocates a 36-byte node and copies a
28-byte value into `node + 8` through `005c9d10`. That copy installs vtable
`0068a8e0`, whose slot zero is `005c7810`. On this initial target, deletion flag
zero only reinstalls the vtable and returns; it does not free the embedded value
or release its copied fields. The six copied words include a four-word input
record and two opaque words at value offsets `+0x14` and `+0x18`. Their meaning
and reference ownership are unqualified. No actor-reference absence follows
from identifying this record layout.
The subsequent [peer/cache lineage audit](native-listener-cache.md) identifies
the first word's input-object source and the second word's caller-argument
source. Its meaning and ownership remain unqualified; separate reciprocal
peer pointers also need cleanup.

Insertion increments the collection count without checking a maximum in that
body. An outer caller might constrain it, but that has not been established.
Native paging therefore needs an explicit collection-residency contract as
well as drawing-buffer bounds. Live embedded vtables, callback mutation and
the two opaque words must be accounted for before retaining or discarding
these nodes around an actor unload.

Nine indirect call sites in the three listener bodies still require live
recipient qualification. The audit inventories five cleanup/allocation targets
and the base listener body outside its own decoded ranges. Their complete
transitive effects remain open. This extends the existing
[world/component cleanup ordering](native-region-release.md), but does not
qualify complete world/actor/GPL teardown, scoped listener detach or bounded
native simulation.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-listener-resources.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-listener-resources.py
```

The qualifier compares saved evidence with a fresh pinned-byte audit, checks
the executable digest after inspection, and rejects an unpinned fixture before
PE decoding. Independent memory-destination fixtures distinguish a store from
a load, a push and an address calculation. Missing-return, escaping-branch and
indirect-branch fixtures are rejected. Drawing release ordering, embedded
receivers, initial value copy/destruction, wrapper flags and explicit stores
are checked against the decoded bodies.

Evidence is in `output/native-listener-resources-audit.json` and
`output/native-listener-resources-terminal-qualified.json`, with source/evidence
hashes and small logs. Runtime modules, original assets, saves and profiles
are unchanged. No game/browser launch, native build or CPU emulator ran.
The previous 247 JavaScript tests were not repeated for unchanged runtime code.
The app crash remains unresolved and browser/game launches remain suspended;
the full development goal remains active.
