# Original factory manager in private bank loading

The subsequent [original fixed-stream integration](native-order-fixed-streams.md)
also removes modeled stream copies/status and passes 251203 checks / 198 trials.
The report, counts and controlled-stream scope below describe the manager run.

The private native bank fixture now executes the original singleton getter
`005da280`, its allocation and registry growth, cached lookups, and original
deletion through `005da4f0`. The simplified getter hook has been removed.
Initialization matches all 16 original key/creator pairs; the 20-byte manager
holds 128 live registry bytes within a checked 256-byte capacity limit. Eight
cached lookup controls retain the same singleton and guest heap totals. The
registry remains unchanged across actor trials, and original deletion clears
the singleton. Matching registry entries does not qualify their callback bodies.

One official, single-job native build passes **204017 checks / 198 trials /
2564 top-level native calls**. Ten calls explicitly cover manager initialization,
eight cached controls and deletion. Original readers also use the actual getter.
The fixture still destroys 180 healthy private graphs through 850 destruction
calls and 2308 tracked original CRT frees. Every actor trial returns guest heap
totals to baseline; the maximum actor delta is 704 rounded guest bytes, excluding
persistent process storage, host metadata, executable, arena and browser.

Stream primitives remain controlled and loading allocations return reserved
extents. This is private lifecycle qualification: production actor publication,
reference/navigation/clock reconciliation, full rollback, continuous region
paging and complete world/browser resource bounds remain unfinished. The host
app crash is unresolved; browser/WASM testing remains suspended.

Reproduce with the pinned executable and official game tools:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-order-manager.py
cd upstream/majesty-recomp
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
```

The static audit checks 11 instruction sites, including the cached fast path,
and 16 registry entries after verifying the executable hash. Current evidence
is `output/native-order-real-manager-observed.json` and its copied CTest log.
Copied checkpoints and served WASM identity remain unchanged. Earlier reports
retain their historical source hashes and modeled-manager scope.
