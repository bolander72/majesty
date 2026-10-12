# Saved selection and view state during regional reloads

Native158 adds two temporary runtime hooks for original saved-world phase2
initialization in the solo named-region session. Fresh generation and ordinary
gameplay keep their original selection behavior. The hooks are removed before
the first Ready checkpoint and resumed simulation tick.

The original selected-unit iteration at005ba870 requests `(selected=0,
notify=1)` through virtual slot+5c, returning to005ba8aa. For a selected actor
belonging to the attached native world, the wrapper supplies selected=1 to the
original005b6a80 method. Notifications still run; all other actor flags must
remain unchanged. The caller's argument bytes are restored after RET8.

The original main-camera target rebind calls00438ac0 from0043a5cd with the
already-restored current target. This rebuilds the native target tree but also
resets saved history/mode. For this redundant initialization call only, retain
four scalar DWORDs at view+18/+20/+24/+28 and three bytes at+30/+31/+32 across
the original method. No saved-file edit, skipped original method, actor pointer
catalogue or comparison masking is involved. One live-world identity and two
handles exist only during initialization; callback snapshots are stack locals.

Official158 build and trial030/PID42691 terminate normally. Thirteen visits
through five kingdoms complete407 original ticks. All nine saved loads retain
actor records and the complete GSGL payload. Six saved selected flags survive
the reset iteration, and nine original target rebinds run. Hook removal returns
to the pre-initialization count before each Ready capture. The pinned original
audit checks25 instructions across five complete methods. Fourteen contradictory
Ready traces refuse, and68 focused controller/storage/terrain tests pass.

Full restoration is still false: eight of nine saved loads match. The first
return to-1_0 changes six terrain opaque words from0x80 to0x80000081 and changes
the notification-containing ORDR section; no actor or global UI root changes.
No height changes during this reload. These reveal/notification bits remain
primary state and are not ignored.44 derived shading bytes also rebuild under
the existing independently documented comparison contract.

Shared heights are also unqualified. Before the first tick, the northern
-1_-1 bottom vertex32 is-4 while the southern-1_0 top vertex32 is
-3.6322021484375. The existing initialization watchpoint at vertex31 is
unchanged and the single-vertex writer observer reports zero border calls.
This reproduces a seam failure despite00428d70 protection; it does not identify
the other writer. Never infer successful seamless travel from the UI fix.

96 tracked root frees and peak sampled RSS191102976 bytes describe this short
native run. They do not establish a sustained browser memory bound. Co-op
regional activation, complete multiplayer matches, independent internet play,
navigation and rendered UI validation remain unfinished. Browser game launches
remain suspended under the workspace crash constraints.

Evidence:

- output/native-world-residency-build-158.json
- output/native-region-session-attempt-030.json
- output/native-region-session-restoration-010-observed.json
- output/native-session-ui-restoration-001-instruction-audit.json
- output/native-session-ui-restoration-001-observed.json
- output/native-session-ui-restoration-001-terrain-differences.json
- output/native-session-ui-restoration-001-initial-seams.json
- output/native-session-restoration-controls-004.json
- output/native-region-restoration-generation-158-preserved.json

Reproduce the stopped comparison using fresh output names:

```sh
node scripts/inspect-native-region-session.mjs output/native-region-session-attempt-030.json output/restoration-FRESH.json
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-session-ui-restoration.py --output output/ui-instructions-FRESH.json
node scripts/inspect-native-session-ui-restoration.mjs output/native-region-session-attempt-030.json output/restoration-FRESH.json output/ui-instructions-FRESH.json output/ui-observed-FRESH.json
```

The full inspector intentionally exits1 while terrain comparisons fail. The UI
component retains that false full-state result in its separate scoped report.

The same Frontier source compiles into unstaged WASM candidate006 through the
official one-job tool. Static inspection checks candidate identities and memory
settings without module instantiation. Served artifacts remain unchanged.
Initial memory is still512MiB, maximum4GiB and eight preloaded workers; no browser
performance improvement or safe launch is established. See
output/wasm-session-candidate-006-{build,observed}.json.
