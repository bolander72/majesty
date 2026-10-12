# Partial native order dispatch clock plan

`web/world/order-dispatch-clock.mjs` prepares read-only timestamp edits for the
eight supported order layouts. It accepts caller-supplied **stopped source and
destination clock snapshots** from original address `0071c6a8`. These clocks
are not inferred from arbitrary saved runtime words. It does not apply edits,
reserve objects or enable populated-order arrival.

The pinned original bank dispatcher `005e53c0`, reached through initial bank
vtable `00683148 + 50`, calculates unsigned elapsed milliseconds:

```text
elapsed = (clock - when) modulo 2^32
dispatch = kind != 0 && delta <= elapsed && (info & 1) == 0
newWhen = (destinationClock - elapsed) modulo 2^32
```

It invokes the order's update slot `+18` with owner, bank and selector zero.
Zero timestamps receive no sentinel treatment in this common dispatcher.
Its unsigned arithmetic differs from the separate GPL context scheduler's
guarded rebasing rules. Rebasing preserves elapsed time at capture and under
equal subsequent clock advances, including wraparound. It preserves dispatch
eligibility; it does not prove the behavior of the leaf update.

Native header fields are `_when +8`, `_delta +c`, `_rate +14`, `_info +18`.
Original debug loads/labels and twenty prior original writer replays bind
these fields to saved words 5/6/4/7. Inherited kind 11 shifts each saved index
by one. The plan changes only `_when`, leaving delays, rates and flags intact.

Preparation fully consumes the checked attachment before returning a frozen
plan. It rejects invalid uint32 clocks, malformed or duplicate records,
unsupported versions/types and more than 128 headers. No source buffer is
edited. Complete reference, callback, navigation and other timer semantics
remain independent requirements for eventual arrival.

Five focused tests pass, covering all eight layouts, zero/wrap, strict delay
boundaries, pause flags, empty records, invalid clocks and late rejection. All
304 workspace JavaScript tests pass with test concurrency one. Reproduce with:

```sh
node --test --test-concurrency=1 tests/order-dispatch-clock.test.mjs
upstream/majesty-recomp/.venv/bin/python scripts/check-native-order-dispatch-clock.py
```

The bounded original CPU fixture completes 280 dispatch calls / 4772 original
instructions. Synthetic clocks and two stack fills yield matching dispatch
decisions before and after rebasing; 140 leaf invocations are modeled and
their argument frames checked. Actual leaf updates never execute. Peak mapped
guest memory is 20480 bytes, with zero mapped bytes after each case. This is a
fixture guest bound, not a measurement of process, browser or world memory.
There are no native allocator calls and no game, browser or build launch.

Evidence is `output/native-order-dispatch-clock-emulated-observed.json` and
`output/native-order-dispatch-clock-terminal-verified.json`. Source hashes bind
the evidence to this component. Actual stopped-clock capture, destination
restoration, complete command migration, native simulation paging and live
hero crossing remain unqualified. The host-app crash is unresolved and the
game/browser launch suspension remains in force.
