# Matched private actors with populated commands

Four copied Scions of Chaos vehicle records (497, 499, 501 and 503) now pass
64 original restore/delete cycles with their matching populated command banks.
Each has Move, Move Path and queued movement commands. Original full UNIT
serialization and command-bank serialization match their input bytes; only the
private actor's own saved identity is normalized to zero. Commands retain their
literal source references, timestamps, coordinates and routes in this baseline.

These are version-0 UNIT containers with two components and PRIMARY version 9.
The component-reader argument 2 is a count, not the saved UNIT version.

The original game uses factory table `00682ed0`, sharing singleton `0071c950`
with the library manager. Its 92-byte kind-2 object is allocated at return site
`004a90b4` and constructed by `004ab850`, which invokes base constructor
`005b6c70` and installs table `006830d8`. The earlier bare order fixture used the
library manager and a different allocation return site. The actual manager is
preserved; only the isolated diagnostic's precise kind-2 allocation site changes.
The factory audit pins four complete methods, 16 anchors and two virtual slots.
It does not qualify every game-specific order override.

Each graph remains owned by the reservation journal. The original UNIT order
reader borrows the exact typed storage. Bank owners and circular links are
checked; actor bytes outside the bank fields remain unchanged. Original bank
draining followed by UNIT clearing frees exactly the reserved extents through
the original CRT free chain. The journal retires those individual extents only
under its own guarded cleanup invocation. All 192 commands and 1152 reserved
extents are reclaimed across the 64 cycles, followed by original actor deletion.
Heap totals, pooled allocation counts and diagnostic hook counts return to their
baselines each time. Selected source identities, world associations, original
actor bytes and world identity counters remain unchanged.

This is private composition, **not ownership handoff or activation**. All eight
recognized target fields in these four actors are zero. Their success therefore
does not qualify nonzero destination references. Destination paths, clocks,
associations and full interrupted cleanup remain separate requirements. An
unexpected partial graph failure stops the owned test process; it does not
provide a recovery algorithm for a running player's world.

`scripts/prepare-native-actor-populated-stage.mjs` regenerates the bounded NAS1
pack using the production reservation planner and literal copied command bytes.
Fresh reproduction yields the same 5383-byte pack. The isolated runner creates
a new owned profile, preserves earlier attempts and source saves, waits for the
actual native process, and records its terminal outcome. The verifier requires
every complete cycle, original loaded-world completion, continued smoke captures
and unchanged source/copy hashes. A successful host exit with zero completed
cycles is explicitly rejected.

Evidence is `output/native-actor-populated-stage-attempt-005.json`, its log,
`output/native-actor-populated-stage-observed.json` and
`output/native-game-order-factory-audit.json`. The final focused original bank
regression passes 420137 checks / 201 trials / 6310 calls / 1892 allocation hooks.
All five game configuration checks pass. Failed earlier native attempts are
retained separately, including the refusal of the unqualified game allocation.

```sh
node scripts/prepare-native-actor-populated-stage.mjs a-fresh-owned-basename
python3 scripts/check-native-actor-populated-stage.py \
  output/native-actor-populated-stage-attempt-005.json
```

The subsequent [private clock probe](native-actor-clock-stage.md) tests changes
to the common dispatch timestamp on this composition. It does not establish
complete command migration. The [Brashnard matched target test](native-actor-target-stage.md)
adds 64 cycles with literal nonzero Path/Follow references, without rebinding.
No browser/WASM game launch or WASM staging occurred;
the app crash remains unresolved. Live region paging, whole-browser resource
bounds, full campaign completion and independent WAN gameplay remain unfinished.
