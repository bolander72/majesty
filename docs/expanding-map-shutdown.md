# Expanding-map stream shutdown

Leaving the map previously cleared the active region map without closing the
stream. A pending storage read could still finish and generate a new scene,
and queued stream actions had no terminal lifecycle. The native saved-terrain
scene already had a separate close operation; this repair concerns the
generated terrain/watchtower experiment.

`RegionStream.close()` now stops admission immediately and rejects queued
travel and building actions. It returns one stable drain promise. The current
storage operation may settle, but checks after each region read and outgoing
save prevent subsequent region reads or late terrain publication. Bulk result
maps are cleared even when shutdown interrupts processing. Once the current
operation settles, the stream clears resident regions and its store reference.

A tower write accepted before close completes normally if storage succeeds.
Its saved building survives a fresh stream reload. A failed write preserves
the earlier checkpoint, rejects its own action, and still allows shutdown to
finish. Shutdown does not abort an accepted durable write or flush unaccepted
queued actions. Existing region/pending-action limits remain unchanged; the
current scene stays accounted for until the drain finishes.

The map page calls this lifecycle on `pagehide`, rather than clearing only its
displayed regions. Six lifecycle tests cover idle shutdown, bulk and sequential
late reads, queued work, successful/failed accepted saves, and the actual page
handler. The last test executes the actual view module in a terminal DOM/event
fixture with a delayed region batch. After pagehide, no terrain is generated,
no scene is published, no later initializer runs, and the node count is fixed.
These are object-lifetime and operation-count checks, not measured process or
browser memory totals.

The source world/store/lifecycle suites pass29 tests. All six lifecycle cases
also pass against the actual served stream and view modules. Static localhost
GETs return those exact bytes. Both former module copies, tested inputs and
logs are preserved in `output/world-close-001`; the initial unsupported-close
failures and a corrected camera-read fixture expectation are retained there.
Evidence: `output/world-close-001-observed.json`.

Only the two served JavaScript modules change. Four engine artifacts and
`games.json` retain their hashes, inodes and mtimes. No browser, WASM instance,
native game or build starts. The private WASM013 site keeps its earlier archived
frontend. This does not establish native simulation unloading, co-op region
coordination, seamless exploration or sustained browser memory bounds; those
remain requirements of the active goal. The app-crash launch suspension stays
in force.
