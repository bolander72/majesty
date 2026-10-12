# Message queues during named-world travel

The named-world session already reaches the original queue free path between each
pair of tested visits. Do not enable the earlier menu-driven orphan-queue retirement
fixture here: its retained-queue finding does not carry over to this lifecycle.

Official native165 and owned trial037 run five visits:
home, generated west neighbor, saved home, saved neighbor, saved home. The
opt-in observer keeps only the preceding queue descriptor, map, buffer and
manager addresses. A wrapper delegates the original CRT free and records
completed frees for those four addresses. Freed identities are never admitted
for later image inspection, even if an allocator reuses the address.

At the first populated queue in each visit, a bounded complete registration
walk and exact live allocation/message checks validate the current queue.
Observation preserves world identity, clock, heap bytes/block count and hook
count after installing its one fixed free observer. No queue is retired or
gameplay state rewritten by this fixture. The owned Ready-snapshot and profile
requirements keep it out of ordinary native play; Emscripten never calls it.

All four departure/arrival cycles produce free mask7: the preceding queue descriptor, map and
4096-byte buffer each reached a completed original free, while the manager
remained. After the final save, normal gameplay produces a sixth observation:
the queue descriptor stays registered, while its prior map and buffer reached
completed original frees (mask6). A checkpoint serial advances on that save
without a region attach; the inspector distinguishes this final observation
from the five actual visits. The fixed free mask covers the interval between
observations; it does not identify the precise save, quit or load phase of each
free.

The four saved loads match the existing full typed restoration comparison;
155 ticks run across the captured visits, with32 tracked world-root frees.
Build PID80118 and game PID80694 are absent after exit0. Native RSS samples peak
at188710912 bytes (180MiB). This short trial establishes neither sustained
native/browser memory bounds nor a memory reduction. It observes completed
free calls, not an exhaustive alias analysis or all message-queue families.
No browser or served engine is changed.

Evidence:

- `output/native-session-queue-observation-001-observed.json` binds the stopped
  native log, compiled sources, saved worlds and full restoration comparison.
- `output/native-session-queue-observation-001-controls.json` records22 refused
  contradictions of actual observations, including stale identities, claimed
  validity after frees, missing/replayed rows and altered read-only guards.
- `output/native-region-restoration-generation-165-preserved.json` archives
  the36 compiled inputs, executable, symbols and trial evidence. Five route
  contract tests also pass.

Reproduce with a fresh attempt/build number, retaining the existing private
input exports and using only the official build wrapper:

```sh
python3 scripts/build-native-world-residency.py --attempt 165
python3 scripts/run-native-region-session.py output/native-world-residency-build-165.json output/native-hero-return-pair-001-published.json upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-iIyAMK/Selected_Entity_Revision.json --attempt 37 --world restoration --capture-ready-state --observe-queues --route west,east,west,east
node --max-old-space-size=256 scripts/inspect-native-region-session.mjs output/native-region-session-attempt-037.json output/native-session-queue-observation-001-observed.json
node --max-old-space-size=256 scripts/check-native-session-queue-observation.mjs output/native-region-session-attempt-037.json output/native-session-queue-observation-001-observed.json output/native-session-queue-observation-001-controls.json
```

The app-crash browser-launch suspension stays in force. Continuous browser
travel, shared co-op region activation, independent internet completion and
sustained browser bounds remain unfinished.
