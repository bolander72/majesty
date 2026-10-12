# A recruited player hero in a generated kingdom

The connected-region prototype now has a living player-owned Warrior produced
through Majesty's original recruitment UI and original Save Game menu. This
provides a real hero input for extending travel beyond the previously tested
mission NPC. It does not yet qualify a hero crossing or alter the browser build.

The source is the initialized `0_0` publication from native residency attempt
007. Before launch, the runner independently checks zero-tick initialization,
both saved-state returns and the original loader transformations. It copies
that publication and settings into a fresh owned native profile, verifies the
current official build, and limits one native process to 512 MiB sampled RSS
and a 95-second wall-time ceiling. No actor or diagnostic fixture is enabled.

An initial stopped native view confirms that the existing Warriors Guild is
ready. Attempt 002 clicks its original Warrior recruitment button, continues
original gameplay and saves normally. The independent saved-file inspector
finds one new player-zero Warrior with script type `hero`, a valid original
`warrior_tree` context, its unique saved schedule and a reciprocal guild-home
association. The staged generated input and original settings remain unchanged.

| Actual attempt-002 record | Native identity | Saved state |
| --- | --- | --- |
| Warrior | UNIT 502 / GPL 27 | `AVL1`, player zero, independent placement at world `(3440,288)`; UNIT 418 bytes, GPL 1,846 bytes |
| Warriors Guild | UNIT 469 / GPL 7 | `ABV1`, same player; hero script `home` resolves to GPL 7 |
| Guild membership | CONT group kind 100 | Guild 469 lists hero 502 |
| Hero gameplay parent | CONT group kind 101 | Hero 502 lists guild 469 |
| Attached overlay | UNIT 503 | `ARH3`, physical parent 502, also in the hero's kind-1 group |
| Hero-held quest inventory | GSGL inventory table | No entries in this capture |

The installed original SDK definitions name `AVL1` as Warrior, `ABV1` as
Warriors Guild and `ARH3` as the `spawneffect_new` / “New recruit” overlay.
An attached overlay must not be mislabeled as held inventory or discarded by
assuming every attached unit is cosmetic. Its original lifecycle still matters.
No order attachment is present for the attempt-002 hero; the inspector records
that absence without inventing an empty serialized command payload.

Attempt 003 starts independently from the same initialized region, recruits
through the same button and allows more original gameplay. Its saved Warrior
is inside guild 469, with parent-dependent position and no attached overlay.
The inspector keeps that distinction explicit:
`requiresOriginalBuildingExitBeforeTravel=true`. It does not clear the parent
to make the actor eligible. These are separate recruitment producers with
world-local IDs; they are not one continuous hero journey or a stable global
identity demonstration.

Both native producers exit zero. Attempt 002 lasts 37.51 seconds and samples
at most 179,961,856 RSS bytes; attempt 003 lasts 52.49 seconds and samples at
most 179,044,352 bytes. Those short native observations do not qualify sustained
browser memory. The inspector rechecks actual original save digests, source
publication, build/source identity, settings, input script, stopped producer,
known typed references, reciprocal containers and scheduling. Complete opaque
reference closure, held-item migration and native hero transfer remain false.

## Reproduce

Use a fresh attempt number; keep previous saves and reports:

```sh
python3 scripts/run-native-generated-hero.py \
  output/native-connected-residency-attempt-007.json \
  --attempt <fresh-number> --recruit-at 150 385 --recruit-wait-ms 10000
node scripts/inspect-native-generated-hero.mjs \
  output/native-generated-hero-attempt-<number>.json \
  output/<fresh-hero-report>.json
```

The runner defaults to a longer 25,000 ms recruitment continuation. Omit
`--recruit-at` to inspect the guild UI without issuing recruitment input.
The coordinates apply to this owned `0_0` capture at 800 × 600, not arbitrary
player views. The runner never reads or writes a personal profile.

Current evidence is `output/native-generated-hero-002-current-observed.json`
and `output/native-generated-hero-003-observed.json`, with their terminal native
manifests and stopped frames. The earlier attempt-002 report is retained.

## Bounded dependency preparation

The original attempt-002 effect also has a separate 244-byte ORDR attachment:
three banks, with one kind-5 marker command in bank 1. Its saved dispatch stamp
is 25,800 ms, matching the original saved simulation clock. Its native callback
procedure is 4101 and its script callback IDs are zero. The effect must retain
this command state; substituting empty banks would discard its lifecycle state.

`web/world/arrival.mjs` now prepares an actor together with up to 16 explicitly
bound, scriptless physical children. It remaps fresh child identities, physical
parents and the actor's kind-1 memberships together. The selected records have
a combined 256 KiB ceiling and use serial reads of at most 4 KiB. SHA-256 copy
preconditions cover complete child and command records, including opaque state.
Nested or scripted children, external child memberships, child inventory,
missing children and occupied IDs refuse preparation. A populated child command
is limited to the checked marker layout with zero script callbacks and equal
source/destination simulation clocks. Unequal-clock leaf behavior remains
unqualified. Native allocation, callback behavior and effect lifetime must still
be verified before activation.

The stopped preparation utility creates five bounded records (2,751 bytes total)
from actual attempt 002. It uses the same checkpoint as its destination probe,
keeping guild 469 / GPL 7 and the actual 25,800 ms clock. This is **not a crossing,
a second kingdom, a guild projection or a playable modified save**. It produces
records for further original-runtime work without changing the source save.

```sh
node scripts/prepare-native-generated-hero.mjs \
  output/native-generated-hero-attempt-002.json \
  output/hero-arrival-preparation-<fresh-three-digit-number>
```

Package 001 is in `output/hero-arrival-preparation-001/arrival-preparation.json`.
An independent stopped byte comparison confirms that the effect UNIT changes
only its identity and physical parent, and its ORDR changes only the attachment
identity. Six actual-capture refusal controls cover omitted children, ID
collisions, unequal clocks, a missing guild binding, an unrelated building and
the actual neighboring kingdom without a home-guild projection. The attempt-003
inside-guild capture also refuses preparation until original building exit;
the utility never clears its parent. Evidence is in
`output/native-generated-hero-arrival-preparation-001-observed.json` and
`output/native-generated-hero-parent-refusal-001.json`. All 46 focused arrival,
order-layout, callback and allocation-bound tests pass. No native build/game
process, WASM staging or browser launch ran for this change.

## Required travel work

Persistent logical home registration and travel reservations are now described
in [hero homes](native-hero-homes.md). They preserve actual roster identity in
bounded storage; remote native projection and completed transfer remain open.

The guild also holds a typed GPL `members` list entry pointing to hero GPL 27
at saved offset 238790. This is separate from native group 100 pointing to
UNIT 502. Restoring the container alone would leave the old script reference.
Arrival preparation now retains this as `reciprocalScriptMemberships`, with
both source and destination guild aliases, list names/counts, the exact source
entry and the proposed fresh hero script ID. Original-runtime restoration and
the global guild roster/capacity obligation precede actor scheduling in the plan.
The source guild list is not edited by preparation.

The incoming-reference reader traverses the manager and typed values once,
retaining only references to the selected actor. Its limits are 100,000 typed
values, 1,024 selected reference sites and serial 4 KiB reads. It distinguishes
typed agents from ordinary integers and nested contexts from top-level lists.
Unbound/scalar/nested incoming references, duplicate roster entries and missing
or invalid destination lists refuse preparation. A 500-agent test verifies
bounded serial reads without repeatedly rescanning the manager or reading
dormant terrain.

Actual Warrior packages 002 and 003 add the guild script-list obligation; their
five binary payloads remain identical to package 001. Package 003 also binds
the current preparation-source digests. The actual saved input contains 1,277
typed values and two incoming hero references: guild `members[0]` and the hero's
own `activescript[1]`. The original NPC preparation still passes with unchanged
edits, ranges and native memberships, and now explicitly retains its `Guards`
and `Waiting_Guards` script lists. All 50 focused arrival and GPL tests pass.
Stopped evidence is in `output/native-generated-hero-home-membership-001-observed.json`
and `output/native-arrival-incoming-reference-regression-001.json`.

These are structural preparation checks. Persistent global home identity,
native guild-list restoration, remote-home routing and completed hero travel
remain unqualified. No native build/game or browser launch ran for this step.

The old NPC transfer assumes no physical parent, no associated container
members and a different script-reference pattern. This player hero has a
guild-home relationship in both native containers and GPL, and can move into
the guild under original AI. A hero handoff must preserve those relationships
and original building exit/entry behavior, reserve fresh destination IDs,
account for attached-unit lifetimes, and bind command/script references to
global entity identities. A zero-inventory capture does not qualify heroes
carrying quest items. An unresolved home must not silently become null or
an unrelated destination building.

Follow [connected residency](native-connected-residency.md) for regional
initialization and unload/return evidence. Seamless travel, cooperative regional
publication, browser resource bounds, full competitive completion and independent
internet qualification remain required by the active goal.
