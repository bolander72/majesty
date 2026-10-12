# Saved NPC scheduling and original removal

The isolated transfer fixture now restores original AI scheduling for one relocated
grounded NPC, persists that queue entry, and resumes AI after a fresh original
full-world reload. These are native tests in copied profiles. They do not establish
a committed ownership handoff, general hero transfer, continuous regions, or browser
resource bounds. Browser launches remain suspended during the host-app crash
investigation; the served WASM has not changed.

## What changed and what passed

The prior [movement fixture](native-inflight-move.md) published the UNIT and script
ID tree but left the script outside both manager queues. Native commands moved the
actor, while normal GPL updates could not find it. The original creation lifecycle
uses queue insertion 00633fd0; its complete pinned instruction range is included in
output/native-npc-schedule-instruction-audit.json.

Attempt 009 appends agent 79 for UNIT 510 through that original insertion routine,
under the scheduler baton and outside hooks. It requires no existing membership,
preserves the actor and agent header, checks every other runtime queue member, and
releases scratch storage. Full saves immediately before and after preserve all 504
UNIT/GPL/attachment records. Their saved queues change only from
[7,6,5,4,3,2,1] to [7,6,5,4,3,2,1,79]; the second queue [8,9,10] and saved selector
remain unchanged. All queued IDs resolve to saved agents and are unique across
both queues in this fixture.

The new checkpointAgentQueues iterator reads at most 4096 bytes at a time and
does not retain queue contents. It must be exhausted before trusting earlier
entries because later manager data may fail. Its structural API does not promise
referential closure; the fixture checker adds membership and uniqueness checks,
bounded to this world's 11 agents and 504 records. Full save byte counts differ
by three bytes: the entry contributes four bytes while the Before/After save labels
have different lengths. File-size growth alone is not scheduling evidence.

Attempt 010 loads the exact Joint_Schedule_After.GMP in a different profile and
native process. It only inspects restored membership, with no insertion or script
activation edits. All three original actor writers match the durable state. Over
240 ticks, both attempts record 260 balanced original agent updates, 2600 balanced
context calls, 40 context actions, 484 balanced command dispatches, and 41 Path
calls. Sampled positions and navigation cells change; declared physical footprint,
drawing registration and backlinks remain valid. Six delegating observer hooks are
removed at completion. This observes registration rather than proving rendered pixels.

Attempt 011 separately loads the same scheduled checkpoint and removes the NPC
through the original complete removal routine and deferred script drain. The
owned queued entry is present before removal and absent afterward. Both runtime
and saved queues preserve every other entry and the saved selector. UNIT 510,
GPL 79 and its ORDR attachment disappear; all 501 other entity records remain
byte-identical. Live CRT allocation count falls by 98 without backing-heap growth.
This proves logical reclamation for this actor; it is not browser RSS measurement.
Fresh loading of the departed world remains unverified.

## Evidence and reproduction

- output/native-npc-schedule-current-observed.json: insertion and saved queues,
  504 unchanged records, original AI/context observation.
- output/native-npc-schedule-motion-observed.json: attempt 009 movement and AI.
- output/native-npc-scheduled-reload-motion-observed.json: attempt 010 saved-queue
  reload, exact writers, native movement and AI without reinsertion.
- output/native-npc-scheduled-departure-observed.json: attempt 011 queue removal,
  501 unchanged records and 98 reclaimed allocations.
- output/native-npc-schedule-controls-observed.json: 17 offline refusal cases,
  including missing actions, duplicate/unknown queued IDs, selector/order changes
  and an unrelated entity mutation.
- output/native-npc-scheduled-reload-controls-observed.json: 28 offline refusals,
  including unbalanced AI delegation and missing restored membership.
- output/native-npc-scheduled-departure-controls-observed.json: 24 offline refusals,
  including duplicate/unknown saved queue IDs, changed order and selector.
- output/native-npc-schedule-backcompat-controls.json: prior four-hook command-only
  run still passes its 19 refusal cases.
- output/native-npc-scheduled-reload-js-tests.log: 39 focused checkpoint tests pass.
- output/native-npc-schedule-reload-build.log: official jobs-one smoke build, exit 0.

Use fresh attempt numbers and output names. First produce the qualified checkpoint
and identity evidence described by the linked movement fixture. Then:

```sh
python3 scripts/run-native-joint-reload.py \
  output/native-inflight-move-checkpoint-observed.json \
  output/native-inflight-move-identity-observed.json \
  --attempt <fresh-number> --observe-motion --schedule-npc
python3 scripts/check-native-joint-reload.py \
  output/<new-manifest>.json --output output/<new-reload-proof>.json
node scripts/check-native-npc-schedule.mjs \
  output/<new-reload-proof>.json output/<new-schedule-proof>.json
python3 scripts/run-native-joint-reload.py \
  output/native-inflight-move-checkpoint-observed.json \
  output/native-inflight-move-identity-observed.json \
  --attempt <another-fresh-number> --observe-motion \
  --reload-scheduled output/<new-schedule-proof>.json
python3 scripts/check-native-joint-motion.py \
  output/<new-scheduled-reload-manifest>.json --output output/<new-motion-proof>.json
```

For separate removal, inspect the schedule proof with
scripts/inspect-native-npc-departure.mjs, then use --reload-scheduled with
--depart-npc <new-preflight> instead of --observe-motion. The same reload and
departure checkers apply. Never combine reinsertion, motion and departure modes.
Run at most one heavy native/build process at a time. Continue with a fresh
departed-world reload, original-source departure, a durable ownership/reference
ledger and repeated region crossings before claiming an expanding original world.

The subsequent [departed-world reload fixture](native-npc-departed-reload.md)
qualifies attempt 012: the removed NPC remains absent and a new original full
save preserves all 501 surviving entity records and saved queues. Original-source
departure, paired ownership commits and repeated crossings remain open.
