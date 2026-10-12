# Notification dispatcher and listener lifetime

The [callback audit](native-placement-callbacks.md) found actor notification
`005b3550` reaching the manager at global owner `0071c68c`, offset `+0x1c`.
The new lifetime audit follows the original constructor, notification,
registration and destruction paths. It verifies 26 complete decoded ranges,
958 instructions, 63 anchors and 15 virtual slots in the pinned executable.
The derived-owner destructor has a separately verified tail jump into the
base destructor; all other local jumps remain within their decoded ranges.

This manager is a listener dispatcher. Its list contains listener pointers,
rather than the actor passed to a notification. That distinction changes the
next lifetime investigation: actor retention must be checked inside listeners.

| Structure | Verified local constructor/path |
| --- | --- |
| Global owner `+0x1c` | `005978c0` allocates 20 bytes and constructs dispatcher `005c3550` |
| Dispatcher vtable | `0068a640` |
| Dispatcher `+8`, `+0x0c` | Allocated list sentinel and count; initial count is zero |
| List node | 12 bytes: next at zero, previous at `+4`, listener value at `+8` |
| Dispatcher slot `+4` | Listener registration `005c3650` |
| Dispatcher slot `+8` | Actor-notification broadcast `005c33d0` |
| Dispatcher slot `+0x0c` | Alternate actor broadcast `005c3430` |
| Listener `+4` | Back-pointer written by registration |

`005c33d0` invokes each listed listener's slot `+0x20`, passing the notified
object and the global word read from `0071c670`. The subsequent rectangle
collector uses that word as a buffer index; describing it as a pointer was
incorrect. `005c3430` similarly uses listener
slot `+0x24`. The broadcast bodies have no explicit memory destinations;
implicit stack writes and effects inside called methods are excluded from
that inventory. The bodies therefore do not directly insert the notified actor
into their listener list, but a listener can still retain it or mutate that list.
After each callback the broadcast rechecks the list for the current listener
before advancing. This does not establish arbitrary mutation or lifetime safety.

The owner destructor `00597980` deletes its dispatcher through slot zero.
Dispatcher destructor `005c35a0` repeatedly invokes the first listener's slot
zero with deletion flag one, then frees remaining list nodes and the sentinel.
Progress through that deletion loop depends on listener callbacks removing
their memberships. Whole-dispatcher destruction therefore owns and destroys
listeners; it cannot serve as a region-scoped detach operation.

Base listener destructor `005c2760` reads the listener's `+4` back-pointer,
searches the dispatcher's list for itself, unlinks and frees the first matching
node, and decrements the dispatcher count. Registration `005c3650` allocates
and adds a node without checking existing membership. Duplicate registration
is therefore outside the safe lifetime assumptions. The generic list-remove
helper `005c3190` also removes only the first matching value and does not
clear the listener back-pointer. A future detach must account for both links,
including any listener callbacks and actor references that remain live.

The original base listener's notification slots are `RET 8` no-ops. Three
audited constructors call that base constructor and install these initial
tables:

| Constructor | Initial table | Actor slot `+0x20` | Alternate slot `+0x24` |
| --- | --- | --- | --- |
| `005c3890` | `0068a678` | Base no-op `005c2b60` | Base no-op `005c2b70` |
| `005c4040` | `0068a784` | `005c49d0` | `005c4ab0` |
| `005c7b30` | `0068a8f0` | `005c85d0` | `005c8620` |

These constructor-installed values do not establish the active listener set,
later vtable changes or an exhaustive set of listener types. The global owner
replacement method accepts a supplied object, so the constructor-derived
dispatcher target is also conditional on the live owner's identity. The
subsequent [notification rectangle audit](native-listener-rectangles.md)
inventories the four derived bodies and follows their copied rectangles into
drawing buffers. Complete callee effects and live actor retention remain open.
The subsequent [listener resource audit](native-listener-resources.md) pins
three derived destructors, drawing-buffer release and one collection's embedded
value layout. Its receiver is the address `node + 8`, not a payload pointer
stored there. Live overrides and opaque copied words remain unqualified.

The paging invariants are now more specific: each listener needs one membership
and a matching back-pointer; unloading a region must not destroy unrelated
listeners; and the relevant live listener overrides must release or preserve
their actor references deliberately. Neither complete listener destruction,
actor-reference release, bounded native simulation nor a safe terrain-border
hook is qualified by this static audit.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-notification-lifetime.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-notification-lifetime.py
```

The qualifier compares saved evidence to fresh pinned bytes, rejects an unpinned
fixture before PE decoding, checks explicit memory-destination classification
with independent store/load/push encodings, and checks the first-match removal
path and constructor variants. Evidence is in
`output/native-notification-lifetime-audit.json` and
`output/native-notification-lifetime-terminal-qualified.json`, with source hashes
and small logs. No original instructions or lifetime operations execute. Runtime
modules, saves and profiles remain untouched, with no game/browser launch or
native build. JavaScript tests were not rerun for unchanged runtime modules.
The host-app crash remains unresolved and the launch suspension remains in force.
