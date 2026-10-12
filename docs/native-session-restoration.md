# State restoration across the expanding native route

Native161 repeats the complete route four times:49 visits and45 matching saved
loads, with384 tracked root frees. Tested height seams match; sampled native RSS
peaks at190480384 bytes. Post-disposal heap still varies, so sustained memory
bounds and browser qualification remain false. See
[native-session-endurance.md](native-session-endurance.md).

Native160 also protects the original virtual height-delta writer. Its actual
side/corner/interior controls pass, and all nine saved loads match across13
visits through five kingdoms. The tested shared-height strips match; this does
not identify the earlier seam failures or establish seamless browser travel.
See [native-boundary-delta-writer.md](native-boundary-delta-writer.md).

Native159 preserves exploration during saved actor-visibility rebuilding. All
nine saved loads in its thirteen-visit route pass the existing typed-state
comparison. Earlier shared-height failures remain unresolved and browser
qualification is still false. See
[native-saved-reveal-restoration.md](native-saved-reveal-restoration.md).

Native158 retains actor selection and complete global UI state across nine
saved loads; eight of nine full comparisons match. Remaining terrain reveal
bits and an initial shared-height mismatch keep full qualification false. See
[native-session-ui-restoration.md](native-session-ui-restoration.md).

Native157 now protects shared heights in the original single-vertex writer.
Real edge/interior controls and a thirteen-visit run are recorded in
[native-boundary-writer.md](native-boundary-writer.md). Full-state restoration
and protection against other terrain writers remain incomplete; the failed153
evidence below remains preserved.

Build153 adds an opt-in original-writer checkpoint before the first gameplay
tick of every named-region visit. It requires the disposable restoration world
and native requested-travel fixture. Ordinary sessions and Emscripten builds
perform no additional checkpoint I/O. The probe checks unchanged world, clock,
phase and hook count. One scalar tick count resets on attachment; no actor or
command guard is added.

The controller copies each committed Ready save before sending travel. The
inspector compares saved revisits with that kingdom's latest capture: keyed
actors, scripts, attachments, queues, RNGs and world sections. Existing
exclusions cover validated labels/date, derived shading and identical keyed
ORDR permutations. Building flags and global fields remain primary state.

Trial023 completed13 visits through five kingdoms and418 original ticks. Nine
saved loads were compared; five matched. Each new kingdom's first return changed
one building's selection flag513 to512. Scripts and attachments matched. GSGL
changed previous mini-view target0 to that building's ID and payload DWORD36
from1 to0. The pinned prior UI audit identifies selection bit0, previous-target
export and the original view-target method's mode reset. Exact restoration still
fails. Earlier initialized/warm returns are separate evidence in
native-connected-expansion.md.

Trial023's runner was edited during preflight, so its late recorded source hash
does not identify the loaded controller. Preserve its captures as observations;
do not accept it as the frozen-source trial. The controller now captures its
source at startup, refuses changes during preflight before native launch and
retains an exact copy. The inspector/archive verify that copy and independently
check all20 compiled inputs, executable and symbols against the official build.

Corrected trial024/PID38343 exits0 with the frozen controller source matching
its launch hash and all13 Ready captures. It repeats418 ticks and the five-of-nine
exact saved-load result. The full report remains qualified=false. Fourteen trace
refusals and51 browser-control/storage capability tests pass. Sampled RSS peaks
at188776448 bytes;96 tracked root frees are observed. Neither is a sustained
total resource bound.

The corrected run also finds four different shared height vertices between
`-1_-1` and `-1_0`, at border indices31..34 (global X -97..-94, Y0). The mismatch
already exists in the initial clock0 Ready captures and stays identical in the
later saves. Both original generation checks report border-changed=0. Therefore
that earlier boundary check does not cover the later initialization changes;
ordinary gameplay did not first introduce this mismatch. The native writer that
changes those heights is not identified by the stopped comparison. A complete
post-initialization seam/placement policy is still required before live crossing.

Evidence: output/native-region-session-restoration-005-observed.json,
output/native-session-restoration-controls-002.json and
output/native-session-border-drift-001.json. The exact20 native inputs, executable,
symbols, controller, captures and comparison evidence are preserved in
output/native-region-restoration-generation-153-preserved.json. Nothing masks
the failed building/global or seam checks to claim complete restoration.

Use fresh attempt/output names and one native game/build at a time:

```sh
python3 scripts/run-native-region-session.py output/native-world-residency-build-153.json output/native-hero-return-pair-001-published.json upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-iIyAMK/Selected_Entity_Revision.json --attempt FRESH --world restoration --capture-ready-state --route west,west,north,east,south,east,west,west,north,east,south,east
node scripts/inspect-native-region-session.mjs output/native-region-session-attempt-FRESH.json output/restoration-FRESH-observed.json
node scripts/check-native-session-restoration-controls.mjs output/native-region-session-attempt-FRESH.json output/restoration-FRESH-controls.json
```

Report qualified=false and inspector exit1 mean restoration failed even when
native travel completed. Fourteen trace controls refuse absent/duplicate captures,
wrong serial/region/clock, prior ticks, guards, changed world/hooks, failed saves
and incomplete routing. Inspector failures now produce compact terminal output.

Seamless hero crossing, co-op regional activation, browser crash recovery,
sustained browser resource limits and independent internet/full matches remain
unfinished. Browser launches stay suspended; served WASM and player profiles
are unchanged.
