# Original idle TILE cache release trial

This native-only experiment addresses retained tile buffers between original
kingdom unloads. It does not change the served WASM or qualify a browser memory
bound. Browser launches remain suspended following the host crashes.

## Method and limits

The existing allocation observer tracks a maximum of512 ordinary12208-byte
TILE buffers allocated by the original game. A candidate must still have its
live reciprocal cache entry and owner, an actual zero reference count, matching
TILE descriptor, validated entry-array allocation and cookie, and the exact
entry returned by the original registry resolver. Unknown baseline buffers,
nonzero references, foreign entries and ambiguous storage are retained.

The trial calls the original manager action2 with the arguments used by the
original release routine. It does not call the decrement routine on an already
zero reference count. The original translator's policy callback and destructor
own the decision to retain or free. No refcount rewrite, cache-link rewrite,
raw buffer free or replacement destructor is introduced.

After original dispatcher teardown, the menu-entry wrapper supplies the actual
CPU outside any SDK callback. The trial requires main-menu phase1, a null world,
unchanged saved clock, hook depth0, scheduler ownership and exactly one completed
exit pending. Every sweep logs the actual before/after guest heap and unchanged
world/clock/hooks. Its candidate storage check understands the original array's
four-byte count cookie; the interior entries pointer is not an allocation base.

The pinned executable audit checks six original instruction fragments and six
contradictory-instruction refusal controls. It covers the original zero-reference
branch, manager arguments/dispatch, policy retention, original destructor/reset
and array allocation cookie. Static qualification alone does not establish that
an actual buffer was released.

## Earlier results retained

- Build083 failed compilation before a game launched. The original seven-argument
  manager call now uses the supported pointer/count guest-call overload.
- Build084/hero-region-travel002 completed all four visits, exit0. Sweeps at the
  active checkpoints found zero eligible candidates and freed zero buffers.
  Original saves before/after each sweep and both kingdom returns compare
  correctly. This is an observed no-op, not a performance improvement. Exact084
  is preserved in native-idle-tile-release-active-generation-084-preserved.json.
- Build085 compiled but was not launched; the array-cookie gate was corrected
  before the next run.
- Build086/hero-region-travel003 completed four visits, exit0, but produced no
  idle sweep rows. native-idle-tile-release-idle-001-refused.json explicitly
  refuses cleanup qualification. A successful game exit is insufficient.
  The corrected integration uses existing front-end entry00490fc0 before the
  modal menu, rather than relying on a paint callback that the menu bypasses.

## Corrected idle boundary result

Build087/hero-region-travel004 completed all four original visits, exit0. All
four sweeps ran after original disposal and before the next load (or final
completion). They found zero eligible candidates and freed zero buffers; their
before/after guest heap was identical. No original manager cleanup call was
exercised. This validates the observed idle boundary only, not the candidate
release behavior or a performance improvement. The failed/no-op evidence stays
visible; broadening eligibility requires new ownership evidence.

Native PID35988 ran56,700ms with maximum sampled RSS184,172,544B (about176MiB).
All source worlds, settings, selected stores and receipts remain unchanged.
Post-unload heap still grows by108,000B across home visits and226,576B across
remote visits. There is no sustained memory bound. Independent native-idle-tile-release-idle-002-observed.json passes all saved
state, warm return and single-owner checks and explicitly reports
actualOriginalIdleTileBufferReleaseQualified:false. Exact087 is preserved in
native-idle-tile-release-idle-generation-087-preserved.json using4096-byte copies;
the exact tuple is registered for subsequent producer reinspection.

## Live candidate coverage at the chosen boundary

Build088/hero-region-travel005 adds bounded counters without changing any release
admission rule or adding a hook. Each sweep records successive counts for tracked
live buffers, live owners, reciprocal entries, zero references, live descriptor
storage, TILE tags, validated arrays and the original registry resolver. At most
four validated descriptor samples are logged per visit. No buffer payload is
captured and no invalid descriptor is dereferenced for the sample.

The four chosen disposal/menu-entry boundaries have tracked counts0,1,0,0. The
single candidate has a live owner, reciprocal entry and zero references, but its
descriptor storage does not pass the existing lifetime check. No descriptor,
TILE tag, array or resolver is admitted. All four sweeps free zero buffers and
leave their before/after heap unchanged. This does not prove that the descriptor
is dead, nor authorize broadening the storage check. The original release path
remains unexercised.

Independent native-idle-tile-gates-001-observed.json requalifies all four saved
returns, warm state and registered ownership; native-idle-tile-gates-generation-
088-preserved.json retains the exact source/executable/symbol tuple with4096-byte
copies. All producer worlds, settings, selected stores and receipts stay exact.
PID36967 completes56,759ms, exit0; maximum sampled RSS184,352,768B.

A separate native-idle-tile-allocation-coverage-001-observed.json replays181
original ordinary-buffer events:93 allocations and88 frees, including25 frees
without a prior observed allocation. Those origins stay unknown. Known survivors
at all four sweeps exactly reconcile with the counters.30 further known buffers
are allocated after the last sweep and remain at log end, totaling366,240
requested bytes. Therefore these early menu-entry sweeps do not cover all later
menu resources. Complete heap ownership, safe eviction and sustained native or
browser memory bounds remain unqualified. Other growing allocation groups still
require actual current-kingdom lifetime evidence; this path has reclaimed nothing.

The gate/coverage helpers reject missing or contradictory rows, invalid original
callers, unsuccessful frees, event gaps, duplicate live allocations and false
survivor counts. Legitimate freed-address reuse and unknown baseline frees remain
explicit. All46 focused tests pass with zero skips in native-idle-tile-gate-tests-
003.log. The earlier tests-002.log failure is preserved: the allocation replay
initially accepted a failed gate summary. It now requires the complete successful
summary format, and the refusal case passes.

## Reproduction and acceptance

Use the official one-job build runner, then
scripts/run-native-hero-region-travel.py with the current build, qualified actual
return publication, selected revision2 receipt, a fresh --attempt and
--release-idle-tiles. The runner owns a disposable profile and starts one native
process with a90-second deadline and512MiB RSS ceiling. Preserve all original
selected worlds, producer settings, receipts and stores.

Independently inspect the terminal run with inspect-native-hero-region-travel.mjs.
Require four actual original saves, original teardown of all six tracked roots,
exact initial and warm saved gameplay state, reciprocal hero guild residence,
single ownership and unchanged dormant remote proxy. Require four observed idle
sweeps between original exit and the next load, with no world or SDK callback
active. Claim actual release only if at least one buffer was actually freed;
zero-candidate or retained results remain no-ops. Sustained native/browser bounds
require further measured evidence even when some tile buffers can be reclaimed.

The focused idle-tile-release, connected-residency and entity-hero-home suites
pass38 tests with zero skips. They cover missing/contradictory release evidence,
unsafe boundaries, repeated retained candidates, freed-event reuse, observed
zero-candidate no-ops, absent sweeps, warm saved-state comparisons and reciprocal
registered hero ownership.
