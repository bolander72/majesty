# Original UNIT order loading and failure boundary

The later [compiled private UNIT lifecycle](native-order-unit-attachment.md)
attaches already-validated banks, executes original getters/writing, then removes
orders before original UNIT clearing. All 180 healthy graphs recover storage and
null their bank pointers. It does not execute or fix the original UNIT reader's
unchecked allocation/replacement paths documented below.

A bounded original-CPU fixture now connects the UNIT-level order reader to
actual bank construction, reading, replacement and deletion. Empty banks load
and serialize correctly, and partial stream reads can be cleared. The reader
also exposes two unchecked allocation accesses and deletes existing bank lists
without deleting their orders. These are import-path constraints, not an
explanation of the unresolved host-app crashes.

Vehicle table `0068098c` supplies these verified initial slots:

| Slot | Original method | Role |
| --- | --- | --- |
| `+160` | `004300e0` | Get or construct bank |
| `+164` | `005b2de0` | Delete bank and clear its UNIT pointer |
| `+16c` | `005b2b80` | Get a nonempty bank |
| `+190` | `005b2f40` | Test bank presence for saving |
| `+1ac` | `005b1b90` | Read three banks |
| `+1b0` | `005b1be0` | Write three banks |

The three bank pointers occupy UNIT `+88`, `+8c` and `+90`. The reader first
invokes `+164` for all three, then invokes `+160` followed by the bank's reader.
It stops on a nonzero bank result and returns stream status. The bank getter
allocates 20 bytes and its original constructor allocates a 12-byte sentinel.
The bank's owner field receives the controlled UNIT address. The fixture does
not construct a complete original UNIT, register an actor or load UNIT/GPL state.

Twelve scenarios, six under each stack fill, establish the following:

- Loading the canonical six words `1,0,1,0,1,0` constructs three banks and
  requests 96 bytes, matching the [source admission estimate](native-order-restore-bounds.md).
  The original UNIT writer reproduces those six words without changing storage.
  Repeating the reader frees all old empty banks and constructs distinct new
  ones; peak modeled requests stay at 96 bytes. Clearing all three releases them.
- Interrupting primitive I/O at byte zero or byte twelve returns stream error 7
  with one or two constructed banks. The original UNIT clear methods release
  those partial empty graphs and leave all three pointers null.
- One original getter creates a bank, then the fixture seeds an opaque 88-byte
  order and a 12-byte list node. Reading replacements releases its node, sentinel
  and bank, but leaves the order allocated. Clearing the replacement banks still
  leaves those 88 bytes. Order fields are never read and no leaf is constructed
  or executed in this control; it tests ownership through the UNIT caller. This
  extends the earlier [bank destructor ownership finding](native-order-bank-rollback.md).
- Returning null for the 20-byte bank allocation reaches the unchecked read
  at `005b1bb9`. Returning null for the 12-byte sentinel allocation reaches the
  unchecked write at `005e4c78`, before the getter publishes the bank pointer.
  In the latter case the allocated 20-byte bank remains unreachable through the
  three UNIT pointers. Clearing those pointers alone cannot recover that storage.

The failure controls use memory guards to stop **before** the null data access.
The fixture maps four bytes at address zero solely for original FS:[0] handling;
guards distinguish that SEH slot from ordinary null data accesses. They do not
let a null write corrupt the fixture's SEH state. No original exception unwind,
allocation-failure recovery or process crash is qualified. The remaining seeded
order and failed-constructor bank are discarded by fixture teardown, not claimed
as successfully freed by the original methods.

This makes the integration contract more precise. Validate an immutable capsule
and budget before entering native code. Loading onto an existing populated actor
requires explicit owned-order cleanup before bank replacement. Allocation tracking
must include unpublished constructor storage, and all required allocations must
be checked before dependent access. A reader return/status alone cannot certify
complete restoration. The native arrival fixture still does not consume the
optional order capsule, and populated arrivals remain disabled.

All 38 completed top-level calls pass; four additional allocation-failure calls
stop at the expected guard. The fixture executes 5118 original instructions.
It maps at most 61440 guest bytes, explicitly unmaps everything after each case,
and caps per-call execution at 2048 steps / one second and total original
instructions at 20000. The bump arena is at most 1024 bytes; modeled positive
requests peak at 184 bytes including the seeded ownership control. Stream,
allocation and free helpers are modeled. Only pinned original function/table
ranges, bounded live extents, a controlled UNIT, stack and SEH slot are accessible.
These are fixture bounds, not a full simulation, process RSS or browser/GPU bound.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/check-native-unit-order-loading.py
```

Evidence: `output/native-unit-order-loading-emulated-observed.json`, its compact
log and `output/native-unit-order-loading-terminal-verified.json`. Existing
JavaScript/runtime code is unchanged, so the preceding 313-test workspace suite
was not repeated. No game/browser launch or native/WASM build ran. Served game
artifacts and player saves remain unchanged; crash suspension and the active goal
continue.
