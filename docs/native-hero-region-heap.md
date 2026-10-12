# Allocation growth in the committed hero kingdoms

Build088 is reused without a rebuild or native source change. The existing
metadata observers are enabled by the new --capture-heap runner option. One
owned native process visits home0_0, remote1_0, home0_0, remote1_0 through original
Load Game, completes20 original ticks per visit, publishes its full original
save and unloads through the original dispatcher. No browser launches or new
hooks are introduced. All original producer worlds, settings, selected stores
and receipts remain unchanged.

## Actual qualification

native-hero-region-travel-attempt-006.json records native PID37644, exit0,55,805ms
and maximum sampled RSS190,447,616B (about182MiB). The512MiB RSS ceiling and
90-second deadline remain unchanged. In-app game testing stays suspended.

native-hero-region-heap-001-observed.json independently requalifies all four
actual saved returns and reciprocal registered hero ownership. It reads twelve
complete allocation-metadata captures: load, before-exit and after-exit for each
visit. Each binary is bounded to40+8192*16 bytes and read with4096-byte requests.
The actual captures contain about27–29KiB each; they record addresses, sizes and
known CRT-backing kinds, without guest payload. Complete counts and totals match
the original log, CRT accounting and post-unload trace. Saved clocks match, all
six original roots disappear, and observers preserve heap/CRT/clock/hook counters.

The existing978-check native heap-reader result has exactly matching runtime
sources and is reused rather than rerun. Twenty contradictory copies of actual
metadata refuse while the original remains unchanged. These cover malformed
headers, stale visits/stages, changed totals and counts, overlapping/misaligned/
out-of-arena records, invalid sizes, backing misclassification, truncation and
trailing records. native-hero-region-heap-controls-004-observed.json records the
controls. The earlier three preflight failures remain explicit: the complete
JSON report exceeded the initial256KiB limit, and visits0 and1 contained no
229376-byte target. Only this report's input cap becomes512KiB; binary bounds
remain unchanged. The controls choose the first actual capture with that size,
then independently parse its original binary, rather than invent a target.

## What grows, and what does not yet establish a leak

| Comparison | Total post-unload guest heap drift | CRT backing drift | Live small-CRT bytes drift |
| --- | ---: | ---: | ---: |
| Home visits0→2 | +120,208B | 0B | +12,384B |
| Remote visits1→3 | +226,576B | 0B | +1,776B |

Ordinary size-group changes reconcile exactly to total drift. The home drift
is12,208B larger than in the earlier trial because this cold capture contains
one fewer buffer of that size; gameplay state still compares exactly. This does
not establish why resource occupancy differs between trials.

The largest positive size-group difference is229,376B, matching the original
8192×28-byte search-array constructor allocation at005ebffb/005ec01d. This is
static size evidence only, not a live owner identification. Actual post-unload
counts for that size are0,0,1,1. One block appears during the later home visit
and remains during remote return. It is **not** an observed new block after every
visit. The pattern is consistent with lazy cache initialization and does not
prove an unbounded navigation leak or authorize eviction. Original process
teardown005ec0f0 frees its currently registered search array; live global/array
ownership would need direct observation before changing that lifecycle.

The4096-byte group does grow at every measured unload:

| Visit | Kingdom | Live4096-byte blocks | Matched observed allocations | Unknown origins |
| ---: | --- | ---: | ---: | ---: |
| 0 | Home | 9 | 1 | 8 |
| 1 | Remote | 10 | 2 | 8 |
| 2 | Home | 11 | 3 | 8 |
| 3 | Remote | 12 | 4 | 8 |

The228 original page allocation/free events reconcile with these live metadata
records. All matched survivors originate at returnPC004a009a, the original
queue helper's CALL004a0095 to operator new. Each observed direct CALL is checked
against the pinned executable. Eight baseline blocks retain unknown origins;
realloc/calloc and unobserved paths remain limitations. Address/call-site matches
are not proof of logical ownership or safe retirement.

The next performance target is this growing queue group and its actual owner
lifetime in these kingdoms, rather than forced search-array or TILE eviction.
Other ordinary groups and live small-CRT objects also change. Four visits cannot
establish a sustained native/browser memory bound, and no performance improvement
has been made by this observation.

## Reproduction

Use the existing official build088 while its exact source/executable/symbol
identity still matches, or make one official one-job build after a native change.
Run the usual committed-hero travel runner with a fresh attempt and --capture-heap,
then inspect its terminal manifest with inspect-native-hero-region-heap.mjs and
check-native-hero-region-heap-controls.mjs. Preserve all earlier attempts. Only one
native process/build may be live. The source-matched native088 artifact is already
preserved in native-idle-tile-gates-generation-088-preserved.json; this actual run
and its heap evidence use that same exact tuple. Served WASM is unchanged.
