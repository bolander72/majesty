# Request-driven native region travel

Native096 makes the verified save/unload/automatic-restore lifecycle wait for an
explicit request during gameplay. A serial native controller publishes requests
inside its owned disposable profile; the game keeps playing until a valid one
arrives. Three neighbor requests are fulfilled by subsequent original loads;
a separate fourth operation saves/unloads and ends the trial. This is whole-
kingdom activation, not physical hero crossing or coordinated co-op travel.
The served browser build is unchanged and browser testing stays suspended.

## Bounded request contract

The native-only `BROWSER_STREAMING_REGION_REQUEST_FIXTURE=v1` requires the owned
automatic connected/registered-hero fixture. It is disabled under Emscripten.
Native ready/request records each contain seven little-endian32-bit words:

| Word | Meaning |
| ---: | --- |
|0|Magic31565254 (`TRV1`)|
|1|Version1|
|2|Serial, equal to the current load count|
|3|Current source side0 or1|
|4|Adjacent target side; final stop names the current side|
|5|Clock of the selected save at this load's initial checkpoint|
|6|Operation1: neighbor travel; operation2: finish the owned trial|

`Region_Travel_Ready.bin` is published by temporary-file rename after the initial
original checkpoint. The controller atomically replaces
`Region_Travel_Request.bin`. The game polls at most every200ms after complete
original ticks, reads28 bytes plus one EOF probe, and checks exact length,
magic/version, serial/acceptance counter, source, target, initial clock and
operation. Unknown, stale or replayed records are not admitted. A valid record
is removed before saving and requesting the original dispatcher exit. No guest
world, clock or hooks change during admission/refusal. Fixed buffers and poll
state do not grow with unit count or region count.

Only the completed original tick can accept a request. Saving, publication,
original pending-exit dispatch, six-root disposal, original named restoration
and normal interface rebuilding remain unchanged. The fixture caps each active
visit at200 ticks; this bounds a failed test waiting for a request and is not a
product gameplay timeout. Default fixtures still use20 ticks. The current two-
side route admits one neighboring region at a time; arbitrary region routing,
new-region generation and a general browser request transport remain unfinished.

## Actual gameplay and refusals

The controller waits1400,2100,1600 and2300ms after observing each ready record.
It first submits serial0, then submits a replay of the first accepted record in
the remote region. Both are actually refused while simulation continues. The
subsequent valid requests are accepted only at a completed original tick:

| Visit | Source | Operation/destination | Completed ticks | Before/after saved clock |
| ---: | --- | --- | ---: | --- |
|0|Home|Travel to remote|33|31,800→33,450|
|1|Remote|Travel to home|45|24,250→26,500|
|2|Home return|Travel to remote|37|33,450→35,300|
|3|Remote return|Finish trial|46|26,500→28,800|

The first refusal occurs at tick1/clock31,850 with accepted count0. The replay
refusal occurs at remote tick1/clock24,300 with accepted count1. All six emitted
packet digests, four ready records and measured publication delays reconcile
with native acceptance/refusal, selected initial clocks, full saved clocks,
original snapshots, disposal and the next region's readiness. Each admitted
neighbor destination is subsequently loaded. The final stop is not claimed as
a journey to an unvisited target.

Independent full saved-state inspection retains all prior comparison rules.
Every initial/warm restoration preserves compared typed entities, attachments,
orders, queues and both RNG states. Warrior504/GPL28 remains inside home guild
469/GPL7 with its original rest state; removed remote554/GPL48/effect555 stay
absent and pure45 stays exact/inert. Unique hero ownership passes across all
saved pairs.161 complete ticks,24 tracked root frees and12 complete heap captures
reconcile. All four post-cleanup original full saves preserve compared gameplay,
raw terrain and ownership. Three earlier-load orphan queues retire through
original methods; the4096-byte group remains9,9,9,9 (one observed current queue,
eight unobserved origins).393 page events /161 contexts /172 owner samples pass.

Thirty-five contradictory actual-log/publication copies refuse altered serials,
source/destination, initial/current clocks, operation, length, tick counts,
acceptance, consumption and unchanged-state flags, missing/duplicate observations,
changed packet digests/ready bytes and publication before the deliberate delay.
The earlier actual timed automatic trace cannot qualify requested travel. The
original log remains exact. These checks validate stopped evidence; dynamic
malformed packets beyond the two stale/replay cases remain untested.

## Build, resources and limits

Official one-job build094 compiles an initial24-byte proposal but is never run.
The contract is then revised to28 bytes with distinct travel/finish operations.
Build095 fails before game launch because the visit-limit helper needs a forward
declaration. Preserve that failed build/report. Corrected096 compiles and is
used for the only actual request test. No generated translation is edited.

Native process45277 exits0/no stop in31,155ms, max sampled RSS181,501,952 bytes
(173.09375MiB), under512MiB/45-second runner ceilings. No scripted mouse/key
input occurs. The controller polls its tiny ready file at50ms while resource
sampling stays about every2seconds. Original settings, selected kingdoms,
publication and receipt remain unchanged. Exact096 executable, sources and
symbols are synced/rehashed with4KiB transfers and registered.

Whole memory bounds are still unproven: ordinary requested bytes grow154,336
between home visits and decrease5,744 between remote visits. Different timing
and boot paths do not establish a speed/RSS improvement. Browser/WASM staging,
launches and browser request integration are zero. Spatial actor/coordinate
handoff, shared region activation, full campaigns/matches and independent
internet testing remain unfinished requirements of the active goal.

## Evidence and reproduction

- `output/native-world-residency-build-094.json`,095 and096 reports/logs
- `output/native-hero-region-request-attempt-001.json` and its log
- `output/native-hero-region-request-heap-001-observed.json`
- `output/native-request-queue-retirement-001-observed.json`
- `output/native-request-region-controls-001-observed.json`
- `output/native-request-region-travel-generation-096-preserved.json`
- `output/native-request-region-travel-001-artifact-observed.json`

With the exact096 build, actual revision2 publication/selected receipt, and no
other native game/build live, use `scripts/run-native-hero-region-request.py`
with `--capture-heap --capture-page-context --retire-orphan-queues` and a fresh
attempt. This launches one bounded native process and publishes only owned
profile request files. Wait for its actual terminal result, then use fresh
output names for these stopped inspectors:

```sh
node scripts/inspect-native-hero-region-request-heap.mjs output/native-hero-region-request-attempt-001.json output/native-hero-region-request-heap-001-observed.json
node scripts/inspect-native-request-queue-retirement.mjs output/native-hero-region-request-heap-001-observed.json output/native-request-queue-retirement-001-observed.json
node scripts/check-native-request-region-controls.mjs output/native-hero-region-request-heap-001-observed.json output/native-request-queue-retirement-001-observed.json output/native-request-region-controls-001-observed.json
```

Listed outputs already exist and must be preserved. Earlier automatic and
menu-driven qualification stays separate. Next travel work must carry a real
actor/camera destination through this request boundary and support arbitrary
neighbor activation, then coordinate that ownership with cooperative players.
