# Original palace death and defeat

Native097 qualifies one owned solo palace death through the original engine.
Palace UNIT475 / GPL11 belongs to player0 in the stopped committed home kingdom.
Its saved description is a palace, not an outpost that previously replaced one.
The runtime finds it through the original player's palace getter0042ceb0 and
reads 700 HP through the original attribute getter005a1c40.

At the completed original gameplay tick, the native-only fixture calls original
attribute routine00431130 with ATTRIB_HP00555041 and value0. This is a controlled
HP change in a disposable copy, not an enemy combat test. The original routine
writes the attribute, handles its native death flags and invokes
`Unit_Call_Deathscript` through the original script machinery. The fixture does
not call DeclareLoss, send a surrender message or write a result flag.

One delegating observer sees original outcome00482c50 for player0/won0 with
return PC004265e5. That return is the original GPL DeclareLoss callback's direct
call to the outcome routine. It differs from surrender's replicated message
case4 path. The observer always delegates to the original routine; after it
returns, the fixture removes the observer and checks the restored hook count.
One trigger, one outcome and one completion reconcile in the actual log. The
process exits0/no stop. All source saves, copied input, settings, publication and
selected receipt remain unchanged.

The supplied Northern Expansion SDK palace-death script contains another branch:
a built outpost can become the new palace and receive the old palace's data,
instead of immediately declaring loss. That branch still needs an actual engine
trial. A future co-op test must distinguish loss of a palace from final loss of
the kingdom, rather than infer defeat solely from zero palace HP.

## Qualification and limits

- Five pinned x86 fragments cover HP registration, palace lookup, attribute
  reading, HP/death-script handling and the direct DeclareLoss call. Five
  changed-instruction controls refuse; original SDK source digests are recorded.
- The stopped inspector independently finds UNIT475 in the exact input save,
  verifies family/player/palace description, matches all three native events,
  validates resource/input/source/artifact hashes and refuses six contradictory
  log copies. Its initial wrong export import is preserved as a failed
  inspection; correcting the reader does not rerun the game.
- PID46811 exits0 in24,790ms; max sampled RSS240,566,272B (229.421875MiB), under
  the runner's512MiB/45-second ceilings. This is one lifetime, not a sustained
  memory bound or a performance improvement.
- Exact097 executable, native sources, symbols and campaign adapter are archived
  using4KiB transfers. No generated translation is edited.
- No browser launch, WASM staging/rebuild or multiplayer match occurs. The served
  WASM's size/inode/nanosecond mtime remain unchanged. The native fixture is
  disabled under Emscripten and requires its owned profile and explicit flag.

This qualifies the solo engine death/declaration path. Shared co-op palace-loss
fanout, both player roles, NPC and outpost cases, full competitive victory,
independent internet matches and expanding-world simulation bounds remain open.
The existing shared-result adapter is unchanged. Do not present this trial as a
completed cooperative match.

## Evidence and reproduction

- `output/native-world-residency-build-097.json` and log
- `output/native-palace-death-attempt-001.json` and log
- `output/native-palace-death-layout-001-observed.json`
- `output/native-palace-death-inspection-001-refused.json`
- `output/native-palace-death-001-observed.json`
- `output/native-palace-death-generation-097-preserved.json`
- `output/native-palace-death-001-artifact-observed.json`

With no other native game/build running, use a fresh positive attempt and fresh
output names. Existing evidence must be preserved:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-palace-death.py --output output/native-palace-death-layout-002-observed.json
python3 scripts/run-native-palace-death.py output/native-world-residency-build-097.json output/native-hero-return-pair-001-published.json upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-iIyAMK/Selected_Entity_Revision.json --side 0 --attempt 2
node scripts/inspect-native-palace-death.mjs output/native-palace-death-attempt-002.json output/native-palace-death-002-observed.json
```

The runner requires the current build's exact hashes and validates the selected
revision2 source before launch; the inspector uses the qualified layout001 audit.
It copies the home kingdom and settings into an owned disposable profile and
uses two scripted menu selections to load it. It never opens a personal profile.
Wait for the actual terminal result before starting another native process.
