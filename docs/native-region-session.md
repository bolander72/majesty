# Native named-world travel session

The opt-in `RULE_FRONTIER_SESSION=v1` path changes kingdoms within one native
process using actual named-world profiles and original game save, quit, unload,
generation and load routines. It keeps one mutable active Region context;
dormant kingdoms remain saved files. This is native qualification, not a staged
browser feature or continuous camera/hero crossing.

## Initialization fix and actual result

Earlier coordinate-generation111 and named-session112 paths advanced the new
kingdom's clock and saved buildings/terrain, but initialized zero GPL AI agents.
Original save loading leaves settings+6c set. The dispatcher-only exit request
did not perform the full Quit Game cleanup before fresh generation.

Official114 calls original Quit Game00416590 after source publication. It clears
settings+6c and calls manager cleanup0049a440, which also resets the game clock
to zero. The dispatcher then disposes the world through004170a0. Only after
world-null does `mods_overlay_set_profile_dir` change save routing and invalidate
the runtime directory cache. A generated kingdom starts at zero; saved returns
restore their own clocks and both RNGs before the next original gameplay tick.
Generated translations are not edited.

Actual attempt004/PID87702 exits0 after five visits and167 gameplay ticks:

| Visit | Kingdom | Operation | Saved clock | AI agents |
| ---: | --- | --- | ---: | ---: |
| 1 | `0_0` | Restore committed home | 33400 | 27 |
| 2 | `-1_0` | Generate west | 1750 | 20 |
| 3 | `0_0` | Restore home | 35050 | 29 |
| 4 | `-1_0` | Restore west | 3400 | 20 |
| 5 | `0_0` | Restore home and save | 36750 | 29 |

Both final markers select their latest digest-verified original full saves.
The129 shared border heights match; shading bytes differ. Stale/wrong-source
requests, a partial southern save and a symlinked northern profile refuse
before departure. Original selected worlds, settings, publication and receipt
remain unchanged, as do the orphan and symlink-vault sentinel. The world name
`9-session` exercises parity with web names starting with a digit. Maximum
sampled RSS is190,693,376B; this is not a sustained resource bound.

## Evidence and failures

`output/native-region-session-004-observed.json` independently parses all five
full saves, requires initialized agents and validates actual lifecycle ordering,
profile routing, saved clocks/RNGs, border heights and final markers. It does not
compare every restored field before the first tick.
`output/native-region-session-006-controls.json` passes12 contradictions,
including rejection of the actual earlier438-unit/zero-agent western save.
Five game-configuration tests pass. Exact114 source/executable/symbols and
evidence are preserved in `output/native-region-session-generation-114-preserved.json`.

Attempt001/002 under112 complete but fail playable generation; exact112 is
preserved. Attempt003 under113 aborts at first departure because its guard
incorrectly expects the clock to survive Quit Game; exact113/failure are
preserved. The initial controls invocation removed only one of several repeated
symlink-refusal logs. It is retained as a failed check; removing all such logs
correctly makes the validator reject the contradiction.

## Reproduction and limits

Use fresh positive numeric attempts; one heavy native build/game at a time:

```sh
python3 scripts/build-native-world-residency.py --attempt FRESH
python3 scripts/run-native-region-session.py output/native-world-residency-build-FRESH.json output/native-hero-return-pair-001-published.json upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-iIyAMK/Selected_Entity_Revision.json --attempt FRESH --world 9-session
node scripts/inspect-native-region-session.mjs output/native-region-session-attempt-FRESH.json output/session-FRESH-observed.json
node scripts/check-native-region-session-controls.mjs output/native-region-session-attempt-FRESH.json output/native-region-session-attempt-002.json output/session-FRESH-controls.json
```

The controller owns a fresh `actor-arrival-fixture-session-*` directory and
drives the production opt-in path through a native-only request fixture. It
does not use the older residency/travel fixture or flat reload slots. Tests use
compiled-artifact identity, not browser imported-assets identity. Destination
metadata/digests are admitted before source checkpointing; generation requires
marker and both slots genuinely absent.

Browser controls now have a tested/staged adapter (docs/browser-region-session.md);
engine WASM delivery and live activation, full typed restoration comparison,
co-op region activation, spatial actor/camera crossing and sustained browser/native
resource bounds remain unfinished. Served WASM is unchanged; browser/game launches
remain suspended while host-app crashes are unresolved.
