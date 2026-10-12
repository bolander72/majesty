# Admitting saved geometry for hero travel

`inspectNativeHeroTravelDestination` reads the published, paused hero source
and one neighboring native checkpoint under the injected game's existing
exclusive world lease. Its caller must explicitly request `halo-v1` and the
exact pending save serial after live journal publication settles. It returns
bounded scalar receipts and never creates files, loads a second world, retires
an actor or publishes ownership.

The source marker must still match the native checkpoint captured at the held
save boundary. A saved neighbor must pass its digest, root boundaries and the
layout checks below. A missing neighbor marker permits a fresh destination
only when neither native slot exists; orphaned and empty files remain preserved.
No travel read may start during publication, overlap another travel read, use
another region/world, or survive completion of the held save. Ending or
abandoning the save cancels the read and drains pending I/O without releasing
the injected game's lease.

`requireCheckpointHaloLayout` validates the actual serialized MAP and MTER.
Both dimensions must be128 terrain cells. It reads one packed129-vertex row at
a time (1161 bytes) and checks all16641 heights survive original signed-Q16
serialization. It checks the2480 protected overlap heights against the
explicit halo-v1 global recipe. The native map's ownership core is124 cells,
with two overlapping terrain cells on each side. Region names alone never
authorize this interpretation of a saved kingdom.

Original building foundations may change interior terrain, so interior heights
must remain valid but need not equal the initial global recipe. Shading,
materials and all cell data stay untouched. A legacy128-cell origin, a different
region's overlap, a damaged protected height or an incompatible map extent
refuses admission. The implementation retains one terrain row rather than
copying a whole map or accumulating dormant region data in memory.

## Verification

`output/hero-travel-layout-regression-002.log` records209 passing tests. Cases
exercise the actual source/neighbor service under the live world lease,
explicit recipe and serial requirements, missing/orphaned neighbors, damaged
or stale source checkpoints, protected versus interior height changes,
negative and extreme region coordinates, and cancellation while I/O drains.
All reads remain at most4096 bytes and travel admission performs no writes.

`output/hero-live-save-original-004.json` uses current original startup011 and
the actual production-native paused save from trial010. It publishes the
original home hero513/29 at115900, then admits that source and the preserved
original eastern retirement checkpoint at4050 through the production held
read service. Both verify16641 heights/2480 shared vertices, match their exact
native markers and preserve every input. Admission adds zero writes, retains
the injected game's lease, peaks at one active I/O operation and leaves none
active after completion. This uses an isolated filesystem-backed OPFS/Web Lock
fixture and an explicitly controlled content fingerprint. It does not verify
real browser durability, a running WASM game or an actual hero crossing.

The initial validator required the recipe at every vertex. An original-data
check rejected that assumption because foundations legitimately alter interior
terrain. The corrected contract follows the original `connected_shared_vertex`
policy; it continues to require exact protected heights rather than relaxing
the shared seam.

The next [crossing-save boundary](hero-travel-boundary.md) checks selected-owner
geometry before startup writes and compares the paused save's actual actor
position with an explicit crossing request before publishing custody. Its
held read is limited to that request's destination. Native accepted movement
still needs to generate the request; saved geometry alone never proves travel.

This is the geometry admission stage of live hero travel. Native accepted
movement, retirement, unload, original destination generation/load, import,
collision activation and atomic ownership publication remain to be connected.
The HUD's registered-hero neighbor actions remain disabled. Browser launches
remain suspended and the full expanding-world/co-op/internet goal stays active.
