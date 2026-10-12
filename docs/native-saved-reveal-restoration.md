# Saved regional exploration survives initialization

Native159 extends the scoped saved-region UI adapter to preserve exploration
when original actor visibility rebuilding calls terrain reveal005afe20 from
005b64a0. World, terrain, actor and caller identities must match the attached
solo region. The original method receives a zero player mask for this replay,
so saved exploration and its notification queue remain authoritative. Its
original RET12 executes and the caller's argument bytes are restored afterward.
Spatial/unit visibility initialization outside this call still runs.

This is live initialization behavior, not saved-file repair or comparison
masking. Three temporary hooks and one live-world identity are removed before
Ready and the first ordinary tick. Fresh generation and subsequent reveal
calls retain original behavior. Rendered fog/UI and player exploration in the
browser remain unverified.

Official159/trial031/PID43791 exits0 after13 visits through five kingdoms and413
original ticks. All nine saved loads pass the existing typed-state comparison:
actors, scripts, attachments, queues, RNGs and world sections, including all
exploration/notification bits, selection flags and complete GSGL. Existing
validated exclusions still cover save labels/date, derived shading and
identical keyed ORDR permutations; these are not byte-identical save files.
307 original reveal replays, six selected flags and nine target rebinds are
exercised. Three hooks are removed before every saved Ready capture.

The stopped verifier binds all20 compiled sources, executable, symbols, frozen
controller, log and state comparison. Eight pinned original reveal instructions
prove the zero-mask predicate and RET. Seven contradictory replay traces and14
Ready trace contradictions refuse.68 focused JS checks pass.96 tracked root
frees and peak sampled RSS191873024 bytes cover this short native run, not a
sustained browser resource bound.

All compared shared height strips match in this run. Earlier153/158 failures
remain preserved and unresolved. The revised watchpoint at-1_0 vertex32 stays
at-262144 from generator return to Ready; it does not reproduce158's change.
No historical writer is identified by this successful route.

Static inspection finds another original height-writing path: terrain vtable
0068b660 slot+20 points to005f1a40..005f1ae0. Its52 instructions include direct
height stores at005f1a97/005f1ada and RET12. Current translation metadata labels
it a non-hookable block. Before adding protection, curate its complete entry,
regenerate through the official tool and exercise actual boundary/interior
guest calls. This is an additional writer, not evidence of the historical
failure's caller or cause. See output/native-terrain-delta-writer-001-static.json.

Evidence:

- output/native-world-residency-build-159.json
- output/native-region-session-attempt-031.json
- output/native-region-session-restoration-011-observed.json
- output/native-saved-reveal-001-instruction-audit.json
- output/native-saved-reveal-001-observed.json
- output/native-session-restoration-controls-005.json
- output/native-region-restoration-generation-159-preserved.json

The full stopped inspector passes without changing the comparison contract:

```sh
node scripts/inspect-native-region-session.mjs output/native-region-session-attempt-031.json output/restoration-FRESH.json
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-saved-reveal.py --output output/reveal-instructions-FRESH.json
node scripts/inspect-native-saved-reveal.mjs output/native-region-session-attempt-031.json output/restoration-FRESH.json output/reveal-instructions-FRESH.json output/reveal-observed-FRESH.json
```

The same Frontier source compiles into unstaged WASM007. Static parsing confirms
candidate identities and memory metadata without module instantiation. Served
artifacts remain unchanged. Initial memory remains512MiB, maximum4GiB and
worker pool8. Browser launches remain suspended under the crash constraints.
Seamless hero navigation, co-op region activation, full multiplayer matches,
independent internet testing and sustained browser memory bounds remain open;
the full goal is active.
