# Wayfinder and Trail Lodge private content

The Trail Lodge is a separate recruitment building (ABs1) for the new Wayfinder
hero (AVz1). It costs900 gold, has300 hit points and supports four Wayfinders at
425 gold each. Its inherited Move Camp action is labelled800 gold; relocation
has not yet been verified. The Wayfinder is intended for scouting/exploration.
Its sight is320 and base health22; automatic home defense is verified, while
its autonomous exploration and cross-region behavior remain under test.

Private native and browser trials qualify paid construction, completed Lodge
persistence, paid recruitment, hero spawning and original native saves. Native
and browser reload evidence is retained separately. The own APw1 interface
uses Wayfinder recruitment text, and private browser253 fixes mouse recruitment
in short responsive viewports. Ranger artwork, sound, equipment and inherited
lifecycle tasks remain temporary private references to the purchased SDK.

Current evidence is output/wayfinder229-native-qualified.json,
output/wayfinder243-interface-qualified.json and
output/wayfinder254-browser-qualified.json. Matching-content co-op, exploration,
general browser pack installation and release publication are unfinished. The
prepared pack is installed only in isolated owned tests; existing campaigns and
user profiles are preserved. The sections below retain the preparation commands
and historical qualification stages. Choose new output directories for new runs.

From the workspace root, prepare local SDK-derived files with:

```sh
python3 scripts/prepare-wayfinder-pack.py
```

The output is confined to `output/wayfinder083-authoring/`. The script refuses
description/prototype collisions, missing inherited fields and incomplete SDK
inputs. It records source and output digests and does not start a compiler or
game. Generated SDK-derived material stays private and out of version control.

For a revised draft, use a new private directory rather than replacing the old
one:

```sh
python3 scripts/prepare-wayfinder-pack.py --output output/wayfinder085-authoring
```

The preparation step resolves the decision tree's direct task/function names
and expressions against both original Majesty and Northern Expansion SDK
scripts. It records the providing files and their digests. `SpecifyIntent` is
an engine builtin documented in the purchased SDK's GPL Reference. Unknown
functions or expressions are refused before output is written; symbols in
comments are ignored. This is a direct dependency check, not proof that all
inherited resources or transitive scripts work with both datasets. Expressions
resolve at load time, so bytecode compilation alone will not prove readiness.

Still required: verify the pinned
engine's mod/resource loading, supply a native placement/recruitment interface
with correct labels and actions, and qualify ordinary construction, paid
recruitment, autonomous behavior, death, original save/reload and matching co-op
state. Browser pack installation and saved content identity checks are not
implemented. Do not load this draft into an existing campaign.

The official SDK example invokes its compiler from the `GPL` directory with:

```text
Gplbcc.exe -in Wayfinder.gplproj -out Wayfinder.bcd -stdout
```

Compile in a separate copy and place successful output at
`Data/Wayfinder.bcd`. The original 32-bit Windows compiler has now run successfully in a private,
muted browser trial using the complete Wine filesystem from Boxedwine 18R2.
No host Wine or Rosetta installation was needed. Trial145 returned exit0 and
produced 3462 bytes of bytecode; its SHA256 is
`61a51da7b5a069a9839dc63ee97e50e77e47cf7d0243611f19db66faeeb19037`.
The minimal runtime in trial144 failed because its VC++2008 implementations
were absent. Compiler success leaves every native gameplay and co-op check
listed above pending. The compiled private pack is not installed or published.

The actual compiler output is bound to its exact draft inputs with:

```sh
python3 scripts/prepare-compiled-wayfinder-pack.py \
  --draft output/wayfinder085-authoring \
  --bytecode output/sdk145-Wayfinder.bcd \
  --observed output/sdk145-local-observed.json \
  --runtime output/sdk145-runtime-final.json \
  --stage output/sdk145-stage.json \
  --app output/sdk144-boxedwine-site/sdk145/wayfinder144.zip \
  --output output/wayfinder146-compiled
```

Existing output directories are refused. The tool verifies the original
compiler exit, archive/source hashes, absence of pre-existing bytecode, output
hash and bytecode container. It does not load the pack into a campaign.

After producing a compiled pack for the current authoring, prepare the private
legacy resource and mission configuration with:

```sh
python3 scripts/prepare-wayfinder-native-resources.py \
  --compiled-pack output/wayfinder190-compiled \
  --output output/wayfinder191-native-resources

python3 scripts/prepare-wayfinder-native-menu.py \
  --native-pack output/wayfinder191-native-resources \
  --output output/wayfinder192-native-menu
```

It generates two separate DUNT description records and a CAM resource archive,
checks collisions against 556 original and expansion descriptions, and preserves
the inherited art/attachment payloads. Only verified cost, health, sight, recruit
delay and membership fields are changed; the Lodge's native production link
points to AVz1. The legacy mission configuration is an uninstalled candidate.
The current32 focused authoring, compiler-binding, native-resource and menu
checks pass. Actual paid gameplay and co-op persistence remain pending.

Private native trial170 has now reached the original main menu with the loader
opening both `DataMX/Wayfinder-units.cam` and `DataMX/Wayfinder.bcd`. The files
match the resource and official compiler receipts. The owned process exited0
and peaked at128.2MiB. This establishes the loading route, while exact live
prototype identity, build-menu integration, paid recruitment and persistence
remain unqualified. No browser release or player campaign was modified.

Fresh beginner freestyle creation currently throws the original GPL exception
`bad conversion to list&`. A clean native control with the original configuration
and both private archives absent reproduces it. This port failure must be
resolved or a separately verified original mission path used before fresh-world
playability is claimed. Registry counts alone are not used as identity proof.

For a bounded resource-loading trace, the native runtime now accepts
`RECOMP_TRACE_FILE_OPENS=1`. It records file opens without enabling the much larger
per-read `RECOMP_TRACE_FILES` log. The original per-read trace trial167 stopped
at its8MiB output ceiling; its owned process was released. Trial170's open-only
log is26,051bytes. Evidence is private in `output/wayfinder170-local-observed.json`.

## Native identity and gameplay checkpoint (October 11, 2026)

The current source uses independent legacy-family identities `AVz1` (Wayfinder)
and `ABs1` (Trail Lodge). Earlier WF01/WL01 artifacts remain historical private
experiments; the compiled146 example above binds that older draft and cannot
be passed to the revised native-resource generator as canonical content.
Authoring183 checks1084 SDK description IDs. Namespace control180 exposes a
separate Trail Lodge entry at900gold in the stock palace building menu, while
Rangers Guild remains available. Original normal save/reload184 succeeds for
the isolated fresh map; it contains no new Lodge or Wayfinder yet.

The earlier fresh-map list exception was reproduced by native tests omitting
`RECOMP_RULE_INVENTORY_COMPAT=1`. Trial171 enables the existing, audited inventory
compatibility bridge and runs the fresh map normally. This corrects the earlier
unresolved-failure note above; no inventory cheat or mission shortcut was added.

Actual construction185 reaches the original creation path but throws
`couldn't find initialization data`. The official bytecode includes both
initialization records, and the current loader trace shows it opens during
startup but does not reopen after the mission-specific stock GPL reload. A
private release-group reload control is in progress. Placement, recruitment,
new-object persistence and co-op remain unqualified. Twenty focused authoring,
native-resource and dependency/menu tests pass; compiler-binding tests are a
separate suite. Purchased assets, old campaigns and browser releases are preserved.

The mission-level reload fix now reaches the original placement preview in
private187. The versioned config generator appends Wayfinder GPL after stock
mission scripts; supported groups are Rel0, Rel2, Relp and Rel3. Expansion
placement preview is verified; other datasets and paid placement still need
live checks. New compiled pack190 binds authoring183 to the previous actual
compiler output after proving all three GPL inputs byte-identical. Resource XML
changes do not require rerunning the compiler. Use `--compiled-draft` explicitly
for this path; any changed or additional compiler input is refused. Canonical
native resources191 and menu/config192 are private, uninstalled candidates.
Thirty-two focused source/evidence tests pass. Construction-site qualification
continues; refused placement previews are not paid construction.

To bind the revised identities to the existing successful compiler trial without
claiming another invocation:

```sh
python3 scripts/prepare-compiled-wayfinder-pack.py \
  --draft output/wayfinder183-authoring \
  --compiled-draft output/wayfinder085-authoring \
  --bytecode output/sdk145-Wayfinder.bcd \
  --observed output/sdk145-local-observed.json \
  --runtime output/sdk145-runtime-final.json \
  --stage output/sdk145-stage.json \
  --app output/sdk144-boxedwine-site/sdk145/wayfinder144.zip \
  --output output/wayfinder190-compiled
```

These are preserved local evidence directories; choose new output directories
for another preparation. A changed GPL source, data file or project requires a
fresh official compilation. Trials200/201 qualify canonical fresh-world startup,
normal save and reload. Placement previews through206 are still refused by
original collision or fog rules; no paid Lodge, recruited Wayfinder or new-object
persistence is claimed. Native trial navigation must derive the actual kingdom
location, and relative movement avoids repeatedly panning the map at screen edges.

## Paid Trail Lodge and completion checkpoint224

Original-query trace221 shows the first refused site passes mask1800 and fails
terrain-inclusive mask1100 inside256x256 bounds. Nearby original grid236/200 in
trial222 passes both. A normal click pays900gold (30000->29100) and creates
Trail Lodge ABs1, unit526, player0, native agent10. Two original peasants construct
its300HP building; its315725-byte normal save retains the exact new identity.

Stock Game Speed is increased through the ordinary Levels control in isolated
profile224. The341118-byte save has the same unit/agent, state513->512,26 initialized
agent attributes, titleTrail_Lodge and member_titleWayfinder. Normal reload225
renders the completed Lodge. Recruitment and new-hero behavior/persistence are
still pending; no browser or co-op new-type claim is made. Originalr13 and user
settings/releases remain untouched. Evidence: output/wayfinder224-building-qualified.json.

Temporary duplicate query observer source was removed after the existing
caller-scoped BROWSER_BUILD_DEBUG observer was found. Native479 rebuilds the
original source closure; no collision bypass or game-code change remains from
that duplicate observer. Original placement results remain authoritative.

## Native Wayfinder recruitment and lifecycle qualification229

Correct completed Lodge selection226 displays the425-gold recruit button.
Normal recruitment227 charges425 (29210->28785), reports Recruited: Wayfinder
and creates AVz1 unit590/agent22 named Ayodon Gnarlswood. The345278-byte original
save retains both ABs1 and AVz1. The hero title isWayfinder, Original_typeHero,
and basic/starting function bindings arewayfinder_tree. Active berserk_defend
reflects the original automatic home-defense response during enemy attack.

Normal reload228 renders the hero alive with the same personal name and level3
caption. Enemy attacks destroy the completed Lodge; the following save retains
the hero590/agent22 alive with titleWayfinder, active berserk, basic homeless and
cleared home reference. The ruined ABs1 object has no live agent. This verifies
real recruitment, defense, save/reload and stock building-loss lifecycle; it does
not qualify map exploration, new-type browser/co-op play, full mission completion
or historical host-app crash fixes. Borrowed Ranger art and the inherited Recruit
a Ranger tooltip remain temporary interface limitations.

Native reports222/224/225/226/227/228 all exit0 without guard stops; observed
peaks151.5/185.6/173.0/181.3/170.5/179.5MiB. All owned processes are released.
The pre-destruction227 save and the earlier completed224 save are copied to
output/wayfinder229-preserved. Originalr13, Wardens and all browser releases remain
unchanged. Goal remains active for browser/co-op integration and Chapter3 victory.
Evidence: output/wayfinder229-native-qualified.json.
