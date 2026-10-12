# Original whole-world teardown and replacement

The original engine now has an observed whole-world disposal/reload path in one
native process. This advances actual region residency work beyond the earlier
modeled cache-retirement plan. It is not yet a seamless expanding world or a
browser memory qualification.

The opt-in native-only `BROWSER_STREAMING_WORLD_RESIDENCY_FIXTURE` probe loads
the actual committed revision6 maps in order1,0,1 (navigation extents256,512,256).
It accepts only owned `actor-arrival-fixture-*` profiles and solo Frontier mode.
At a safe original tick boundary, after20 observed original gameplay ticks,
it calls the original phase requester00416050 with argument1. Gameplay phase3
queues4; the next original00415e40 dispatcher iteration calls004170a0 after the
whole tick returns. There is no mid-tick destruction or manually inferred free.

The pinned listings show004170a0 clearing interface/script state, then calling
00597ad0. That method dispatches the original world scalar deleting destructor
and clears0071c68c. The00597980 base destructor retires the world-owned factory
and context. The probe's three SDK hooks delegate original phase requests,
teardown and CRT free0064d4b6. Fixed six-element arrays capture only the world,
factory, terrain, grid, navigation search table(+14), and cell-entry table(+18).
Each of these six addresses reaches the original CRT free exactly once per
teardown. Registry-entry totals include several original groups; they are not
unique UNIT counts. The original loader's UNIT visits separately match the
saved maps'488,1961,488 UNIT records.

Only after actual teardown returns does the fixture copy the next private
snapshot over its private Load Game file. Copy buffers are4096 bytes and source
size is capped at2MiB. Source worlds remain in that owned profile, outside the
SaveGame folder. The normal front-end Load Game input then restores the next
world. Canonical committed worlds, user profiles and served WASM are untouched.

Actual attempt005 (PID47785) stops successfully after all three complete cycles.
All eighteen tracked roots are freed, all three world pointers clear, all heap
consistency checks pass, and observer count stays3. The original current build
is from `output/native-world-residency-build-005.json`.

| Cycle | Navigation extent | Released guest heap bytes | Decrease in live CRT allocations |
| --- | ---: | ---: | ---: |
| 0 | 256 | 2,148,400 | 9,391 |
| 1 | 512 | 6,326,624 | 30,089 |
| 2 | 256 | 2,148,400 | 9,391 |

Post-unload guest heap at cycle2 is272,640 bytes below cycle0. CRT live allocation
count is197 above cycle0. Three cycles do not establish a sustained plateau;
remaining global caches/managers and opaque references need investigation.
Guest allocated-byte counts also do not establish process RSS, GPU usage,
WASM linear-memory capacity, or host-app crash safety.

The first attempts are retained. Attempts001/002 refuse before teardown because
of an invalid observer hook flag; this is corrected to `POP_HOOK_NO_GAME_VIEW`.
Attempts003/004 complete the first teardown and load the larger world, then the
accelerated clock consumes the timed input script and the smoke host requests
application exit before the second cycle finishes. Native exit0 and the generic
"all expectations met" line are insufficient. The independent gate refuses
those partial traces. Attempt005 uses real time and sufficient per-load waits;
the maps,20-tick requirement and six-root retirement checks stay the same.

Evidence:

- `output/native-world-residency-observed.json`: independently binds actual
  current native executable/sources, official build, committed exports, copied
  inputs, original loader visits, all cycles and resulting private input file.
- `output/native-world-residency-controls-observed.json`: unchanged actual
  successful trace passes before each of eleven contradictory-trace mutations;
  the actual earlier incomplete exit0 trace also refuses. No extra game launches.
- `output/native-committed-generation-preserved-observed.json`: preserves and
  rehashes the actual earlier e4321c3c generation and three sources before this
  engine change. The measured committed reload requalifies independently through
  that archive. Historical preparation admits only the exact prior helper/checker
  hashes; native/compiler/web inputs and reconstructed bytes stay exact.

Reproduce from the workspace root, with current committed receipt and current
official build. Preserve prior outputs and check for live game/build processes
before launching:

```sh
python3 scripts/build-native-world-residency.py --attempt NEW_BUILD_NUMBER
python3 scripts/run-native-world-residency.py \
  output/native-repeat-handoff-publication-observed.json \
  upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-0bies5/Selected_Entity_Revision.json \
  output/native-world-residency-build-NEW_BUILD_NUMBER.json --attempt NEW_RUN_NUMBER
node scripts/check-native-world-residency.mjs \
  output/native-world-residency-attempt-NEW_RUN_NUMBER.json output/FRESH_REPORT.json
node scripts/check-native-world-residency-controls.mjs \
  output/native-world-residency-attempt-NEW_RUN_NUMBER.json output/FRESH_CONTROLS.json
```

The subsequent [save/unload/revisit qualification](native-world-persistence.md)
now establishes per-visit evolving persistence, including both saved RNG states,
in a separate opt-in native run. The results above describe the earlier disposal
probe and do not imply that its own snapshots evolved.

The disposal test above restores fixed committed snapshots. The subsequent
persistence test saves progress before leaving. The next runtime steps are a
longer residency plateau test and generated adjacent terrain. Neither neighbor continuity,
automatic travel, simultaneous neighboring simulation nor cooperative region
handoff is qualified. The original solo-world restriction remains. Shared
defeat/full-match and independent internet gameplay also remain goal work.
Browser game testing stays suspended under the workspace crash constraint.
