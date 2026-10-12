# Frontier map movement and camera saves

The Frontier map now coalesces pointer movement into one latest destination per
animation frame. Its region loader still serializes scene changes and publishes
only complete scenes. Releasing the pointer consumes its final queued position,
then flushes optional camera metadata after the move settles.

Camera position writes are separate from kingdom and building saves. They wait
for 250 ms of idle time, with a two-second maximum wait during continuous motion.
Only one storage write can run at a time, and only the latest additional position
is retained. Positions are copied as two numbers; arbitrary input fields are not
retained. Opening the selected native region flushes camera metadata first.
Hiding the document requests a best-effort flush; browser termination or closing
storage does not guarantee that optional view metadata reaches disk.

An optional camera failure keeps the committed map playable. It retains the
latest unsaved position for a later move or explicit flush, and reports the
failure without starting a repeating retry loop. A stale result cannot clear a
newer building or travel error. Kingdom checkpoints and watchtower writes retain
their existing durable-before-eviction behavior.

On map departure the source camera writer now closes: it cancels timers,
discards queued optional positions, drains an accepted transaction and suppresses
late UI reports. No background retry runs afterward. Explicit region links still
flush first; an abrupt departure can retain an older saved camera position.
See [view lifetime](frontier-view-lifetime.md) for current component qualification.

The Node tests use the shipped map handlers, real region/terrain adapters and
bounded fake DOM/frame scheduling. A 1,000-event pointer burst produces one final
footprint read batch. A separate 1,000-position metadata burst writes only its
last position; slow storage retains one active write and one pending position.
Continuous-motion, quota, supersession, retry, release, map-mode switching, 4K
buffer bounds, native links and failed terrain loads are covered. The focused
camera/map/storage/control run passes 77 tests.

This reduces avoidable map loading and camera transactions in the Frontier
projection. It is not a measured browser FPS, GPU-memory or original-engine
simulation improvement. No browser or WASM game was launched, no native process
was started, and the served WASM remains unchanged. Seamless original-engine
travel, cooperative region activation and sustained browser memory qualification
remain unfinished.

Evidence: `output/frontier-camera-batching-001-observed.json` and its test log.
Run the relevant checks with:

```sh
node --test --test-concurrency=1 tests/camera-checkpoint.test.mjs tests/native-atlas.test.mjs tests/world.test.mjs tests/region-store.test.mjs tests/frontier-controls.test.mjs
```
