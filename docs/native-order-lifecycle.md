# Original fresh order construction and cleanup

`scripts/check-native-order-lifecycle.py` executes the pinned factory `005da510`,
all eight supported original constructors, their shared token/base constructors,
original zero-fill and deleting destructor chains. Allocation and free operations
are modeled within a small owned arena. This extends the preceding
[bank failure investigation](native-order-bank-failures.md), whose factory and
leaf methods were modeled. No live world manager or bank reader executes here.

| Kind | Factory object request | Constructor | Deleting destructor |
| --- | --- | --- | --- |
| 1 | 88 bytes | `005df250` | `005df280` |
| 2 | 92 bytes | `005b6c70` | `005b6ce0` |
| 4 | 100 bytes | `005e0cc0` | `005e0d00` |
| 5 | 92 bytes | `005ab670` | `005ab6e0` |
| 6 | 92 bytes | `005e2220` | `005e2290` |
| 7 | 72 bytes | `005e2b20` | `005e2b80` |
| 10 | 76 bytes | `005b2430` | `005b2460` |
| 11 | 112 bytes | `005e4000` | `005e4030` |

The initial virtual table's deleting destructor slot and factory switch case
are pinned for each kind. Kind 11 executes the kind-5 constructor and cleanup
chain before/after its own field initialization. All objects have an empty base
token; kinds 2/5/6/11 also have empty leaf tokens. The original destructors do
not take a positive-name release branch in these fresh cases.

The fixture checks these behaviors under two stack/data fills:

- Each successful original constructor installs its expected initial table,
  initializes its inactive fields and restores the simulated SEH chain.
- Kind 7 additionally requests an 80-byte, ten-point path buffer. Ordinary
  fresh deletion frees the buffer before freeing the object.
- Outer allocation returning zero yields a null factory result for every
  supported kind, without constructing or freeing an object.
- Kind 7's inner buffer allocation returning zero still yields an object with
  `pathPointer == 0`. The constructor does not reject that failure. Its fresh
  deleting destructor calls modeled free with zero, then releases the object.
- Deleting-destructor flag one releases object storage. A kind-7 flag-zero
  control frees its path while retaining the destroyed object's allocation;
  the two release contracts must not be confused.

The base constructor leaves native `_delta +c` untouched. Both fill values
survive that field's construction; fresh orders are inactive with kind zero.
Normal enqueue supplies delay, and a successful original reader supplies the
saved delay. A future importer must require complete reads before dispatch and
verify required path storage before a reader writes through it. A nonnull
factory result alone does not prove readiness.

These are **fresh inactive objects**, not loaded-order cleanup qualification.
Saved tokens, names, paths, IDs and clocks are not restored in this trial.
Positive-name release, exception unwinding, real allocation failures, loaded
order ownership and bank/actor transaction rollback remain unverified. Normal
32-bit `FS:[0]` registration is emulated in one controlled four-byte slot;
no Windows exception dispatcher runs.

The trial completes 56 original factory/deletion calls across 36 scenarios,
executing 2796 original instructions. The static ranges contain 689 instructions
in 29 fully decoded ranges. Guest mappings peak at 69632 bytes and are explicitly
unmapped and checked empty after every scenario. Modeled live allocation requests
peak at 152 bytes. A flag-zero case deliberately retains 72 modeled bytes until
fixture teardown; flag-one cases leave none. These are controlled guest/request
bounds, not browser, process RSS, allocator overhead or total simulation memory.

Each call is limited to 1024 steps/one second, with a total 25000-instruction
budget. Reads and writes must stay in the stack, live allocation extents,
controlled SEH slot or the read-only factory jump table. Freed extents become
inaccessible to original instructions. Unknown/duplicate frees reject. Other
callee entries are unavailable; callbacks and name release cannot silently run.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/check-native-order-lifecycle.py
```

A subsequent [loaded-entry lifecycle](native-loaded-order-lifecycle.md) now
combines construction, reading, identical rewriting and deletion for all 154
copied entries. Thirty-two injected stream-error cases also release their
unlinked empty-name state. This extends the fresh ownership evidence; positive
names and full bank/actor rollback remain unverified.

Evidence is `output/native-order-lifecycle-emulated-observed.json`, its small
log and `output/native-order-lifecycle-terminal-verified.json`. The writer
metadata and prior copied-entry reader sources remain unchanged. Runtime
JavaScript/test files are unchanged, so the previous 308-test suite was not
repeated. No game/browser launch or native/WASM build ran; served artifacts and
player data remain unchanged. App crashes remain unresolved, launch suspension
holds and the full cooperative/expanding-world goal remains active.
