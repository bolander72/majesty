# Browser controls for travel within one game session

The browser adapter can now drive the native named-world session without page
navigation when the engine acknowledges that feature. It admits the neighbor,
remembers the destination, then answers the native generic/direction action
poll. One pending trip tracks save, complete Quit Game cleanup, world disposal,
attachment and gameplay readiness. The current region, recovery links, four
travel buttons and URL update only after the matching attachment; controls stay
disabled until the destination is ready. There is no growing DOM or trip log.

This adapter is staged as JavaScript. The served WASM does not contain the new
native session path yet. A separate official WASM candidate now compiles with
the session path, but has not been staged or launched. The served game therefore
retains the existing save-and-navigation
behavior. Live browser activation, semantic loading and resource bounds remain
unqualified; the host-app crash suspension stays in force.

## Compiled engine candidate

Private WASM010 now includes the cached-frame pacing change described in
docs/presenter-repeat-pacing.md. The official one-job build completes and
static inspection passes; its18 frozen inputs include the presenter source.
All four served engine artifacts retain their hashes, inodes and modification
times. No module is instantiated and no browser is used. Evidence:
output/wasm-session-candidate-010-build.json and
output/wasm-session-candidate-010-observed.json. This candidate does not include
the later, test-only incoming-checkpoint writer.

Native161's four-lap49-visit trace now replays through both source and served
controllers:110 terminal checks pass in each, covering48 transitions with fixed
DOM, one held world lease and zero page navigation. The unstaged WASM009 candidate
also compiles/static-checks against current161 inputs while the served engine
stays unchanged. Evidence: output/native161-session-browser-001-observed.json
and output/wasm-session-candidate-009-observed.json. Browser input, gameplay and
sustained memory qualification remain false under the host-app crash suspension.

Native160's stopped thirteen-visit route now replays through both source and
served JavaScript controllers:110 checks pass in each set. All twelve region
changes retain fixed DOM node count and one held region capability, with zero
page navigation. The first served-copy run exposed two older modules missing
camera-boundary handling; its108/110 failure log is preserved. Only
native-session-controls.mjs and native.mjs were updated, with their prior bytes
backed up. HTTP reads confirm the two served modules match source. Camera
gestures in these checks are terminal fixtures, not physical browser input.
Evidence: output/native-session-boundary-001-staged.json and
output/native-session-boundary-001-http.json. All four served engine artifacts
retain their prior hashes, inodes and modification times. Unstaged WASM008
compiles and passes static identity/protocol/memory checks without module
instantiation; live browser activation remains unqualified.

Candidate003 extends the release contract to both original terrain buffers:
native116 passes96 tracked frees over twelve transitions; source146/staged95
tests pass. The controller is staged, and the new candidate compiles/static-
checks release=v2 while remaining unlaunched and separate from the served engine.

Candidate002 now includes [the original root-release contract](native-session-release.md).
The browser controller is staged and requires release/removal acknowledgements
when advertised. Native115 passes72 tracked frees across twelve transitions;
source145/staged94 terminal tests pass. The new candidate compiles and passes
static inspection but remains separate from the served engine and unlaunched.

The official single-job build completed successfully with `--no-web-stage` and
`--web-memory-growth conservative`. The new build-only option passes 19 builder
tests. The resource-guarded build preserved all four served engine artifacts
and its frozen source inputs; its process group is stopped. The candidate lives
in a private build directory recorded by
`output/wasm-session-candidate-001-build.json`.

`output/wasm-session-candidate-001-observed.json` verifies artifact hashes,
linked session protocol strings, shared imported memory metadata and the actual
compiled heap resize policy (5% growth with a 16 MiB excess cap). This is static
inspection without module instantiation. It establishes neither live browser
travel nor sustained memory bounds or resolution of the app crash. The candidate
remains separate from the served engine.

## Opt-in and storage lifetime

The versioned query flag is `RECOMP_RULE_FRONTIER_SESSION=v1`. It requires a
named, dedicated solo region with seeded generation1 and connected terrainv1.
Incomplete/duplicate flags and network settings fail before native injection.
The startup guard also validates a session flag supplied without a world.
The setting survives region and atlas URLs; ordinary startup stays unchanged.
Flags alone do not retrofit existing terrain into the connected layout.

The injected game retains its original exclusive world lease. A matching native
save/quit/unload/attach sequence advances that document's active-region read
capability and serial. Replacing the capability invalidates old reads without
releasing/reacquiring the game lock. Subsequent preflight checks are relative to
the new active region, not the initial URL. A confirmed source fallback completes
the native serial while retaining the source region and URL.

Journey metadata is written before the directional action can be consumed.
Storage failure or cancellation during that write never queues native travel.
The saved source remains the recovery option if the destination is new and has
not yet been saved. Native re-admission/save refusal permits retry without
advancing the serial; recovery metadata returns to the current region. After
consumption, native work drains through its acknowledgements. Pagehide/runtime
failure stops UI actions and ignores late activation while retaining the lease.

## Evidence

The [five-kingdom native route](native-session-multiway.md) now supplies a longer
actual trace: source143 and staged92 checks replay twelve region changes with
fixed DOM node count, one world lease and zero page navigation. This remains a
terminal fixture; no running browser or WASM trial is performed.

Source checks pass140 cases across session controls, startup, destination reads,
journeys, paired-session guards and profiles. The actual staged controller/DOM
adapter passes92 cases; storage regressions pass44. Both source and staged suites
replay the stopped official114 native trace through four trips, mapping only its
native filesystem root to the OPFS root. The replay uses the actual document
capability and verifies one held lock, four acknowledged region/URL changes,
zero navigation and neighbor access relative to the final active region.
It is a terminal DOM fixture, not a running browser or WASM trial.

The first replay expected a standalone Region checkpoint message which this
native path does not emit. Its failed source/log remain preserved. The corrected
replay uses the actual Session checkpoint events; no native trial is rerun.

`output/native-session-browser-002-staged.json` records all four source/staged/
localhost module hashes, preserved dependencies, test counts/log hashes and the
one changed startup condition. Previous modules/player HTML are preserved.
WASM inode, size and modification time remain unchanged. The consumed checkpoint
parser prefix matches source despite later, unstaged actor helpers.

```sh
MAJESTY_NATIVE_SESSION_TRACE=output/native-region-session-attempt-004.json node --test tests/frontier-controls.test.mjs tests/native-region-session-controls.test.mjs tests/realm-session.test.mjs tests/native-destination.test.mjs tests/player-startup-cancel.test.mjs tests/journey.test.mjs tests/paired-session.test.mjs tests/realm-profile.test.mjs
MAJESTY_DESTINATION_STAGED=1 MAJESTY_NATIVE_SESSION_TRACE=output/native-region-session-attempt-004.json node --test tests/frontier-controls.test.mjs tests/native-region-session-controls.test.mjs tests/native-destination.test.mjs
node --test tests/realm-store.test.mjs tests/region-store.test.mjs tests/realm-catalog.test.mjs tests/region-backup.test.mjs
```

Engine WASM delivery/live qualification, connected-layout compatibility for old
kingdoms, continuous camera/actor crossing, co-op region activation, complete
internet matches and sustained native/browser memory bounds remain required.
