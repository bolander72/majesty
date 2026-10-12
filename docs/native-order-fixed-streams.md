# Original fixed streams in private order loading

The subsequent [private UNIT attachment run](native-order-unit-attachment.md)
also executes original UNIT getters/writing/clearing: 338401 checks / 198 trials.
The counts and evidence below describe the preceding stream integration.

The bank fixture now uses the original fixed `strstreambuf` constructor
`0064a97f`, input/output stream constructors, scalar/raw serializers, status
conversion and destruction. Its stream hooks observe original bodies through
the SDK; they no longer substitute byte copies or status codes. The Majesty
wrapper borrows the original C++ stream. Loading allocation hooks still return
pre-reserved journal storage, and factory initialization/destruction remain real.

Each stream borrows a private span capped at 2048 bytes. Fixed construction
disables buffer growth; original overflow returns failure instead of allocating
a larger span. Stream and buffer destructors retain their caller-owned storage.
The fixture initializes and destroys each stream outside journal authority and
reuses its bounded scratch allocations. This does not qualify live actor
publication or prove complete native/browser memory bounds.

The standalone probe passes **21545 checks / 64 span trials / 514 calls** with
no stream or allocator hooks. Eight cycles cover both directions at 4, 12, 56
and 2048 bytes. Exact transfers, failed extra scalar operations, sticky status,
span sentinels, original destructors and per-trial guest heap baseline recovery
pass. Original read-past-end status is `2000000a`; write-past-end status is 29.

The integrated bank fixture passes **251203 checks / 198 trials / 6992 native
top-level calls**. It executes 4428 stream setup/teardown calls over 1107 stream
lifecycles and observes 24415 original operations. All 89 copied actor profiles
plus one synthetic missing kind-1 profile pass under two fills. Four truncated
input controls now return original status `2000000a`, replacing modeled status
7; failed kind-4 zero-path requests and allocation/name refusals still pass.
180 healthy graphs are destroyed through 850 calls and 2308 tracked original
CRT frees. Each actor trial recovers guest heap totals; its 704-byte maximum
rounded delta excludes process and stream scratch storage, host metadata,
executable, arena and browser.

The first standalone probe timed out on a critical-section wait. The fixture
had allocated 76 bytes for an input stream whose original virtual `ios` base
and embedded critical section require 92 bytes. Correcting the allocation to
the original file-wrapper size resolved that failure. Three focused builds ran
serially with one job; final standalone/bank CTests took 0.57/0.68 seconds.
No runtime source changed. The static audit pins 12 methods, 15 instruction
sites, four buffer vtable entries and critical-section import identities.

Reproduce sequentially:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-order-streams.py
cd upstream/majesty-recomp
.venv/bin/python tools/test.py --native-test native_order_stream_tests --jobs 1
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
```

Current evidence is `output/native-order-fixed-stream-observed.json` and its
two copied CTest logs. Earlier reports preserve historical source identities.
Copied checkpoints and served WASM remain unchanged. Published actor reference,
navigation and clock reconciliation, full rollback, continuous live paging,
independent internet co-op and full-world/browser resource bounds are unfinished.
The host-app crash remains unresolved; browser/WASM testing stays suspended.
