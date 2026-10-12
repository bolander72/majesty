# Notification rectangles and drawing-buffer limits

The [dispatcher lifetime audit](native-notification-lifetime.md) identified four
derived listener notification entries. Their bodies now have a pinned local
instruction inventory, together with rectangle submission, clipping, collection
and constructor paths: 14 ranges, 985 instructions, 44 anchors and seven slots.
Local jumps land within their decoded ranges. Complete callee behavior remains
separate from that coverage.

| Notification entry | Local behavior |
| --- | --- |
| `005c49d0` | Copies four actor bounds words from `+0x98` to a stack rectangle, optionally scales them, then invokes listener slot `+0x18` |
| `005c4ab0` | Copies four input bounds words from `+0x28` to a stack rectangle, optionally scales them, then invokes listener slot `+0x18` |
| `005c85d0` | Depending on global flag `0071c82e`, submits a null rectangle or queries a point rectangle through listener slot `+0x40` before submission |
| `005c8620` | `RET 8` no-op |

The first two methods read listener scale at `+0x130`; the pinned comparison
constants are 0.5 and 1.0. Scaling calls the original conversion helper
`0064cc94`. Numeric behavior across all floating-point states is not qualified
by this static inventory.

Explicit memory destinations in these four callback bodies are exclusively
stack locations; two bodies have none. The first callback submits a copied
rectangle rather than forwarding its original actor pointer. This narrows
the direct retention path. Implicit stack writes, callees, pointer aliases and
other live listener types remain outside that conclusion. In particular, the
point-query path still receives the actor and calls `005ad740`, which reaches
the recursive parent-position helper `005ad5b0`.

Initial listener tables resolve submission slot `+0x18` to `005c2a10`,
`005c47c0` or `005c7fc0`. Those methods copy and clip a rectangle, set drawing
offsets through `00505600`, submit through `005057d0`, then reset offsets.
`005c47c0` additionally invokes visibility slot `+0x30`. Point conversion
invokes listener slot `+0x94`; its initial target `005c81f0` remains outside
this audit. Complete virtual call closure and alias safety are unqualified.

The submitted global word from `0071c670` eventually becomes the integer
buffer index in collector `00505860`. It is used to select counts at
`drawing +0x34 + index*4` and buffer pointers at `+0x3c + index*4`. Calling
that word a pointer in the earlier investigation was incorrect; the prior
audit and documentation have been corrected and requalified.

Constructor `005051a0` allocates two 800-byte rectangle buffers, records
capacity 50 at `+0x10`, and clears both counts. Each rectangle is 16 bytes:
the initial rectangle payload totals 1,600 bytes. This is a calculated payload
for this constructor, not a measurement or bound on total drawing/browser
or native simulation memory.

When the selected count equals capacity, the collector resets the count to
one and writes a rectangle spanning its configured bounds. The comparison is
equality, not greater-or-equal. It does not validate the index before reading
the selected count/pointer. Other branches merge or split rectangles and can
recurse through the collector. Split helper `00505db0` and the recursion bound
remain unqualified. A future streaming hook must establish valid bank indices,
owned buffers, capacity/count invariants and recursion behavior; it must not
assume malformed state is made safe by the full-buffer branch.

The subsequent [isolated collector checks](native-rectangle-collector.md)
execute original collector/splitter instructions on tiny synthetic buffers.
Sampled streams stay within owned buffers; all 16 splitter masks match an
independent coverage oracle. Invalid bank/count cases attempt out-of-range
accesses stopped by the fixture. Live-state validity and general recursion
remain unqualified.

This closes the local-body inventory for the four named notifications and
identifies a small constructor allocation. It does not exclude actor retention
through callees, prove geometry preservation, install a safe border hook or
qualify live native paging. The next dependencies are point conversion,
visibility and the collector's live state and split/recursion behavior.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-listener-rectangles.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-listener-rectangles.py
```

The qualifier compares saved reports with fresh pinned bytes, rejects an
unpinned fixture before PE decoding, and checks explicit destination
classification independently with stack-store, object-store and load encodings.
It also checks recursive dependencies and keeps live-bound/retention flags false.
Evidence is in `output/native-listener-rectangles-audit.json` and
`output/native-listener-rectangles-terminal-qualified.json`, with source hashes
and small logs. No original instructions execute, and no runtime files, saves,
profiles, game/browser launches or native builds change. Unchanged JavaScript
tests were not rerun. The host-app crash remains unresolved and the launch
suspension remains in force.
