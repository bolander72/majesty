# Next content milestone

The new active goal covers the unfinished original Chapter3 campaign and a
fourth cooperative mission, Wardens of the Pact. Each network kingdom must
own a completed living Warriors Guild and Temple to Dauros and retain25000
gold. Gold and buildings are not pooled. The existing native objective remains
the authority; the browser only reports observations and persists actual shared
victory. Chapter4 is staged privately, not published or gameplay-qualified yet.

The frontend adds selection, invitations, continuation from Chapter3, world
navigation, checkpoint tokens, per-profile completion and backup validation for
Chapter4. Legacy1–3 completion records remain in their original databases.
New-format readers accept Chapter4; immutable older releases retain their
original three-chapter limits. This requires no engine rebuild: browser campaign
source and objective header match the source inputs of qualified WASM073.
98 focused JavaScript checks pass, including refusing readiness with missing
buildings, unreadable scans, another owner's contribution or insufficient gold;
local progress waits for the original shared result.

## First genuinely new hero and building

Proposed development pair: a Wayfinder recruited through a Trail Lodge, serving
exploration and regional expedition missions. These are proposed names and
behavior, not installed types. Existing ranger artwork/behavior can provide a
private baseline while unique content is implemented. Renaming a stock hero
alone will not count as delivery.

The local original SDK includes separate Majesty/Description XML documents
for character and building resources. MajestyTool provides CAM/text format
tooling. The current Lua surface intentionally has no allocation, guest writes
or hooks, and there is no general browser pack installer or hero-creation API.
Majesty Mod Manager demonstrates custom factories/recruitment but its current
GOG notes explicitly exclude1.5.1.2. The browser pins that executable; addresses
and newer Windows helpers cannot be copied into it.

Implementation starts by tracing the pinned resource registration, native
factory, recruitment UI and original saved-reader/writer dispatch. Verify
entries in the pinned listings and game configuration before installing any
adapter. Keep original construction, ownership, lifecycle and network commands.
Prepare one isolated pack with stable type IDs and content digest, and reject
missing/mismatched content without replacing saved kingdoms.

Acceptance for the pair requires ordinary building placement/completion, paid
recruitment of the new type, autonomous behavior and rewards, death/teardown,
original save/reload and both players observing matching state. Only then add
more characters, buildings, mission chains and the requested Middle-earth and
Arrakis packs. Bounded region residency and rendering remain requirements;
content should not introduce retained DOM elements for unseen regions.

Sources: local SDK and kit/mods/lua/bindings.cpp;
[MajestyTool](https://github.com/tytannial/MajestyTool),
[Mod Manager GOG compatibility](https://github.com/Phantomstar721/majesty-gold-hd-mod-manager/blob/main/docs/gog-support.md),
[Adventurers Guild reference](https://github.com/Phantomstar721/majesty-gold-hd-adventurers-guild).
Local audit:output/content080-extension-local-audit.json.

## First bounded Chapter4 browser trial

Two actual engines play the private candidate through the existing local relay.
Fortified Palaces, no monsters,30000starting gold and no cheats isolate the
construction objective. Both original guilds count; temples remain missing
and sufficient gold does not declare victory. Each kingdom recruits4warriors
through its native450gold action. The host upgrades to palace2 for3000gold.
Temple to Dauros appears at1600gold; the attempted location is refused and
no temple is constructed. Final treasuries25540/28515.

Save and pause commits world wardens080 revision1 at clock424700,359966bytes,
digest f575555548d3a743f82829b8edda50e886a44a49ff9dcbc7c4634d085317d2c6.
Host resume preparation verifies a separate original-lobby copy. The guest has
not yet received this save through the original native lobby reader; paired
reentry remains required. Both new profiles correctly retain0of4completions.
A fresh578-file20-database backup verifies the host checkpoint/lobby digests,
the earlier originalChapter3r2checkpoint and both original profiles' chapters1/2.
All owned engines and browser are closed within1153seconds; sampled aggregate
owned process RSS peaks at2107.4MiB. This is one bounded trial,
not a sustained performance or host-app crash qualification. No public WSS,
new hero/building type, shared Chapter4 outcome or publication is qualified.
Evidence:output/content080-local-observed.json.

## Original Chapter3 economy continuation081

Both restored original profiles admit revision2 through the native readers.
Ordinary1500gold marketplace construction is placed for both kingdoms. The
host recruits a500gold wizard, which dies to roaming wolves; native200gold
Farseeing then reveals a valid construction site. The host market reaches25of
200HP at the last inspection. The guest market completes200HP, holds125gold
in its coffers and starts MarketDay research. Healing Potions completion and
market upgrades are not qualified. Last observed treasuries28335/29200 remain
below the unchanged35000each requirement; no victory or Chapter3 completion
is claimed.

Shared revision3 commits clock700850/frame11443,537012bytes,
f31ea38caf33158982f52377c81cd663ac5b6761bb1f278894d9e4790a438631.
The host's separate original-lobby copy verifies. The guest must still receive
this revision through the original lobby transfer on the next paired resume.
A fresh580-file20-database backup verifies all entry digests, preserves every
prior native path, all previous database bytes and19older WorldResume copies,
including Wardens080r1. Original profiles retain only chapters1/2; new Wardens
profiles remain empty.

Owned engines are released at995seconds. A repeated export attempts to create
an archive while the completed temporary copy remains cached, so its automated
download stalls. The deadline guard and explicit close release owned Chrome;
confirmed closure at1243seconds exceeds the1200second cleanup deadline by43.
This overrun is recorded rather than qualified as an in-bounds trial. A separate
no-game browser clears only the temporary archive, downloads the fresh backup
successfully and closes. Next trials must reserve more time for cleanup and
trigger export through one awaited download action. Sampled peak owned RSS is
recorded in output/campaign081-trial.json; no sustained performance or host-app
crash fix is inferred. Evidence:output/campaign081-local-observed.json.

Next: resume original r3; complete the host market and guest research, upgrade
markets through their native prerequisites, and measure collected income before
adding further investment. Preserve shared checkpoints between bounded trials.
Wardens080r1 remains independently preserved for its construction/outcome trial.

The served078 player already streams its compatibility hash in64KiBchunks
through one worker, terminating it before native initialization. The raw kit
player's whole-file hash is replaced by staging; inspecting that raw source
does not identify the served player's memory behavior. No runtime change or
startup-memory cause is inferred from the3023.8MiB peak at elapsed120seconds.
Audit:output/campaign081-startup-hash-audit.json. Begin next engine cleanup by
800seconds and reserve60additional seconds for closing Chrome before the
1200second deadline. Trigger a fresh backup through one awaited download,
after clearing only any completed temporary archive.

## Original Chapter3 continuation082 and extension baseline

Both original profiles admit revision3 through native lobby readers. The guest
finishes Healing Potions research and pays1000gold for the marketplace upgrade,
which completes at level2 with250HP. The host pays100gold to place a Gnome Hovel
and2500gold for a Wizards Guild upgrade; their completion remains unqualified.
The marketplace remains85/200HP amid native monster attacks and worker deaths.
Last treasuries26325/28705 remain below35000each. Neither Chapter3 victory nor
persisted completion is claimed.

Revision4 commits at clock1239450/frame10772,536677bytes, SHA256
bd2aa37c5025ca512bed55f251d67c210ef3e0ee40a08a191302e08afbf4a423.
The host lobby copy matches; guest revision4 admission remains to be tested.
The582-file20-database backup passes CRC and every manifest digest, preserving
all prior database bytes and21older resume copies, including Wardens080r1.
Both engines and owned Chrome close within1100seconds, with2603MiB sampled
peak aggregate RSS and no guard stop. This does not qualify a crash fix.
Evidence:output/campaign082-local-observed.json and its backup verification.

A read-only standard-library PE audit verifies the pinned common UNIT factory
at0042c3d0, its kind jump table, class kind at UNIT+0x5c and independent
description ID at UNIT+0x6c. Kind1 calls the356-byte Vehicle constructor at
00433af0 with original vtable0068098c. These match the existing stopped-reader
actor adapter. They establish a baseline for description-driven content, not
a new recruitable hero. Description registration, autonomous agent behavior,
placement/recruitment routing and custom-type save/reload/co-op remain open.
The original executable and engine are unchanged.
Audit:scripts/audit-content-extension-path082.py and
output/content082-extension-path-audit.json.

## Bounded original Chapter3 trial083

Revision4 admits two original network kingdoms. Host Wizards Guild reaches
level2/500HP, and Enchant Tower becomes a visible400gold native action. Both
completed guest marketplace and451gold coffers are observed. A collector is
attacked near its palace, explaining why coffers do not imply treasury income.
The native Game Speed slider is moved near maximum. At last paired observation
treasuries are25675/28905, below35000each.

The owned browser unexpectedly exits during the subsequent gameplay trial.
The next screenshot command auto-relaunches an empty window, which is closed
immediately. No new relevant Chrome/Codex diagnostic report is found and the
sampled peak2838.2MiB is below the3072MiB guard ceiling. The exact cause and
relationship to speed, rendering or automation are unknown. No crash fix is
claimed. Both owned engines and browser are released; no post-revision4
gameplay checkpoint or Chapter3 victory is claimed. Revision4 and its verified
backup remain the latest durable original campaign save.
Evidence:output/campaign083-local-observed.json and trial.json.

## Wayfinder / Trail Lodge authoring083

The source draft in content/wayfinder-trail-lodge/ has stable WF01/WL01
description IDs and separate Wayfinder/Trail_Lodge prototypes. Wayfinder costs
425gold, has22HP and320vision, and prioritizes exploration ahead of optional
fights through its own decision tree. Trail Lodge costs900gold, has300HP and
four member slots. Its XML production list and GPL member title both name the
new hero; its member decision-tree field names wayfinder_tree. Purchased Ranger
and Rangers Guild art, sounds and lifecycle tasks are private inherited
baselines. Native menu/dialog compatibility still needs verification.

The purchased SDK establishes a broader authoring path than character XML
alone: mx_Hero_Data.dat selects active/basic/starting scripts, and
mx_Building_Data.dat provides guild member title and member decision tree. The
SDK example quest loads Descriptions plus GPL sources; its Guardhouse example
shows a Mod/DataConfiguration descriptor. The draft follows these source
formats but no pinned-engine custom loading or gameplay is yet qualified.

The preparation script checks1084SDK description IDs, names and all SDK data
prototype names, records every relevant source/output digest and refuses
collisions or a pre-existing output directory. Four focused integration/refusal
checks pass, including preserving original SDK bytes. Generated SDK-derived
XML and data remain private under output/wayfinder083-authoring/. The script
does not compile bytecode, install a mod, write a player save or publish files.
The original SDK compiler is available locally; Wine is not on PATH. A supported
compiler invocation and native resource/recruitment/save/co-op integration remain
required. This is an authoring milestone, not delivery of playable new types.
Evidence:output/content083-authoring-qualified.json.

## Original continuation084 and compiler host check

Both original profiles admit revision4. The native Game Speed slider is at its
midpoint. The shorter350second total gameplay cutoff leaves only26.9seconds of
simulation after lobby preparation; it is not useful sustained gameplay proof.
A shared revision5 nevertheless commits clock1266350/frame538,538799bytes,
SHA25651d248890bd856bce5bdfeef915dbafed50de5ea173cc930b22d92462a95021a.
The host's separate lobby copy matches. The exported native PRIM attributes
verify host Wizards Guild ABY2 with500HP and FirstStageBuilt1. Marketplace89HP
and Gnome Hovel25HP remain unfinished; no completion is inferred merely from
their description IDs. Last treasuries26375/28745 remain below35000each.

The fresh585-native-file20-database archive passes CRC and every entry digest.
All prior database bytes and23older WorldResume copies are unchanged; guest
revision4 lobby reception is verified in the archive. Revision5 guest admission
remains for the next resume. Both engines and owned Chrome are released within
571seconds, sampled peak2193.1MiB, with no unexpected browser exit observed.
This short trial does not prove the earlier browser failure fixed.
Evidence:output/campaign084-local-observed.json and backup-verified.json.

The app bundle contains an Intel x86_64 Wine loader, but its readonly version
probe returns bad CPU type on this arm64 host. Rosetta's runtime executable is
absent. The compiler itself is PE32 x86 and imports MSVCR90/MSVCP90 plus Windows
system DLLs; a recompiled-tool route would need a separate pinned configuration
and DLL/import support rather than substituting the game's executable. A user
question requests Rosetta installation approval. No installation, license
acceptance, compiler execution or modification of the purchased game wrapper
has occurred. Compiler availability on PATH alone was insufficient evidence.
The pinned old executable has no literal matches for DataConfiguration,
Descriptions or GPLSource in the audited ASCII/UTF16 scans. This is not proof
that loading is unsupported, but the SDK descriptor alone cannot qualify its
pinned-engine loader. No new hero/building gameplay is claimed.
Evidence:output/content084-compiler-host-probe.json, wine-architecture.json,
sdk-compiler-imports.json and pinned-loader-string-audit.json.

## Original continuation 085 and direct script dependencies

Original revision 5 admits the guest, whose native lobby copy is verified in the
new archive. Ordinary native tower enchantment, wizard recruitment and guild
upgrade actions were attempted during the paired trial. The stopped revision 6
provides stronger construction evidence: both Wizards Guilds have 500 HP and
FirstStageBuilt=1, three host Gnome Hovels have 75 HP and FirstStageBuilt=1, and
the host marketplace has 157 HP without FirstStageBuilt. Recruitment actions
do not establish surviving heroes; no new character types are installed.

The shared checkpoint is revision 6, clock 1592500, frame 6523, 542902 bytes,
SHA256 e59c94cc3671f0e8e9405062f637889f5113812062cfa8a86555e52e6764e5b2.
Treasuries at pause are 24823/26065; Chapter 3 has not been won. The 587-native-
file, 20-database backup passes CRC and every manifest digest, preserves all
prior native paths and database bytes, and preserves 25 older resume copies.
Both owned engines are released at 684.9 seconds and Chrome at 714.9 seconds;
peak sampled owned RSS is 2394.9 MiB. This does not resolve the prior crash.
Evidence: output/campaign085-local-observed.json,
output/campaign085-backup-verified.json and output/campaign085-stopped-units.json.

The Wayfinder authoring tool now checks direct function and expression
references against both original and expansion SDK source trees. Missing
runtime expressions and task functions are refused before output; comments
do not introduce dependencies. The SDK reference documents SpecifyIntent as
an engine builtin and explains that expressions resolve at load time. A source
compile alone therefore cannot qualify the pack. Native loader, transitive
dependencies, resource interfaces and gameplay remain separate pending gates.

Eight focused authoring/refusal checks pass. The revised private draft is in
output/wayfinder085-authoring, with source and output digests; the older draft
is retained. A new --output option supports separate draft directories and
refuses existing destinations. No compiler, native build, installer, player
save mutation or release publication occurs in this authoring step. Rosetta
installation approval remains pending. Evidence:
output/content085-authoring-qualified.json.

## Chapter 4 resume fix and paired continuation 086–087

The first Wardens paired resume returned both players to the menu with native
checkpoint preflight refusal. The native lobby policy still capped both token
parsing and request validity at Chapter 3. Its two bounds now permit Chapter 4,
matching the existing frontend and construction objective. The official focused
native test reproduced three Chapter 4 failures, then passed 31 checks after
the fix, including both roles and rejection of unsupported Chapters 0 and 5.

The initial default native test configuration stalled in optional Git version
lookup and an iCloud placeholder SDL stamp. The owned configuration tree was
stopped; the existing resume073-native-checks preset completed the focused
test. No compiler was invoked outside the official game tools. A bounded,
one-job incremental private WASM build then completed in 8.4 seconds with
952598528 bytes peak aggregate build RSS. Its 60 baseline inputs changed only
in coop_lobby_resume.h; the prior private engine artifacts were copied and
verified before rebuilding. Generated translations were not edited.

The fixed engine is in the separate content086 preview, SHA256
affc219635b0557b569d0eb3e63322b34bf740766180d1b3f5cc8eb8eaae10e7.
Both players now load the original Wardens revision 1 into their native maps.
The first guest page had a transient module-fetch failure; the endpoint returned
200 and one reload succeeded. Its cause is not established. Native mission
observations recognize both completed Warriors Guilds. Three attempted temple
preview locations remain refused; no temple purchase, creation or mission win
is claimed. A guest recruitment attempt is not confirmed by a paid action.

The shared revision 2 commits clock 825000, frame 8006, 358172 bytes, SHA256
b08d6462bae290b45777ff2a240b7f84060c5f0c665ea2c73a356d5720997ca5.
The stopped native save confirms both living ABV1 guilds with 700 HP and
FirstStageBuilt=1. Treasuries at pause are 26382/29058. The fresh 590-native-file,
20-database archive passes CRC and every entry digest, preserves all earlier
native paths and database bytes, preserves 27 older resume copies, and verifies
the guest's revision 1 lobby copy. Host committed and lobby-copy bytes match
revision 2. No Chapter 4 completion record has been written.

The owned engines are released at 715.3 seconds and Chrome at 836.2 seconds;
peak sampled owned browser RSS is 2368.1 MiB. Start saving earlier in future
trials to leave more teardown margin. The prior host-app crash cause remains
unresolved. Public release 078, the older content080 preview and original
Chapter 3 revision 6 remain preserved. Publication and mission completion are
pending. Evidence: output/content086-native-policy-result.txt,
output/private-resume073-wasm-086/build.json, output/content086-site.json,
output/content087-local-observed.json and output/wardens087-backup-verified.json.


### Muted construction trial 090

All owned test Chrome sessions now launch with `--mute-audio`; retain the same
private launch configuration on every command to preserve the isolated profile.
The paired revision2 resume succeeded after one verified transient module-fetch
reload. Existing construction trace reports collision reason1 at the rejected
positions. After16 native ArrowDown camera steps, host placement at map222,52
(screen760,120) passes flags1800 and1100, reason0. Ordinary paid1600-gold
construction creates a Temple to Dauros; native revision3 independently contains
owner0 ABP1 with400HP, built1. Guest ordinary3000-gold Palace upgrade completes;
both native ABJ2 records have700HP, built1. Guest temple previews remain rejected;
no shared victory or Chapter4 profile completion is claimed.

Revision3: frame5487, clock1099350,369553bytes, SHA256
`399c5858251bc5133679805b72692bec3c4d25f62d73875e5a461abfb09a4ebb`.
Backup593native files/20databases passes CRC and every entry digest. All prior
native paths,29older WorldResume copies and all prior database bytes are
preserved. Original Chapter3 revision6 is unchanged. See
`output/content090-local-observed.json`,
`output/wardens090-backup-verified.json` and
`output/wardens090-stopped-buildings.json`. Engines closed before600sec; the
planned520sec save margin was exceeded, so the next save trigger is480sec.
Browser closed and no owned Chrome descendants remain. This trial does not
establish a fix for historical host-app crashes. Public078 remains unchanged.


### Wardens shared completion: muted paired trial 092

Both players resume native revision3. Guest Temple to Dauros placement at
map38,182 (screen700,230 after12 ArrowUp camera steps) passes both native
collision checks, reason0. Ordinary1600-gold construction finishes; both living
Warriors Guilds and both living Dauros temples are complete with treasury
25892/25267, independently exceeding25000. Each client presents the original
"You are victorious" dialog and emits
`[campaign] Chapter 4 shared victory for 2 kingdoms`. Both campaign panels
report completion saved locally. Navigating away releases both engines; each
profile's campaign page independently shows Chapter4 Completed locally.

The completed player backup contains594native files and20databases. CRC and all
manifest hashes pass. All prior native paths and31older WorldResume copies remain
byte-identical. Only the two Wardens campaign databases change, from empty rows
to `[[4,true]]`; all other campaign/Atlas database bytes, including original
Chapter3 progress, are unchanged. Shipped content086 `inspectBundle` independently
accepts the entire archive and both new completion records. Latest resume remains
revision3 before victory; no post-victory checkpoint or resume is claimed.
Evidence: `output/content092-local-qualified.json`,
`output/wardens092-backup-verified.json`,
`output/wardens092-shipped-validator.json`, and original paired victory screenshots
`output/wardens092-host-result2.png` / `output/wardens092-guest-result2.png`.
Public078 is unchanged; the private four-chapter frontend is ready for release
qualification after the restored original Chapter3 work. New hero/building types
remain uncompiled prototypes, not playable additions.

A fresh-profile UI-only backup restore trial093 stopped before importing when
its1536MiB process ceiling was exceeded. No game engine launched. A subsequent
CLI observation automatically started a new owned browser; it was closed as soon
as observed. Both daemons have no remaining Chrome descendants. Restore UI
qualification remains incomplete; see `output/wardens093-restore-observed.json`.
Check guard-stop/stop markers before subsequent browser commands so automation
cannot restart a stopped trial. This is not evidence of a historical crash fix.


### Restored Chapter3 economics/defense: muted paired trial094

Both players load original revision6 on private content086; native admission
reports original clock1592500 and both kingdoms. Unenchanted wizard towers are
selected through their ground footprints. Ordinary400-gold enchantments are
confirmed on the host tower and both guest towers by paid deductions and native
Enchantment Duration controls; a host purple attack effect is visible. This does
not assert earlier enchantments were never bought. Workers and tax collectors
respawn normally but are under visible rat/wolf/hostile-caster attack.

Revision7 saves clock1785800/frame3866/552530bytes, SHA256
`a841efd890672d0158db6a01a86e4be44897835ac76cd3a5a48cc280dc7f1997`.
Native host marketplace remains unfinished161HP; guest completed level2 market
has fallen to37HP. Both palaces and upgraded wizard guilds remain complete.
Treasuries24783/26145 are below35000 each; no victory/profile completion claimed.
Permanent guardhouses near workers and markets are now the intended next
ordinary gameplay action, rather than additional fragile hero recruitment.

The596native/20database backup passes CRC, every manifest digest and shipped
`inspectBundle`. All32older WorldResume copies and all prior database bytes are
unchanged, including both Wardens Chapter4 completion records. See
`output/campaign094-local-observed.json`,
`output/campaign094-backup-verified.json`, and
`output/campaign094-stopped-economic-units.json`. Owned browser is closed with
no remaining Chrome descendants. The planned save/engine-release margin was
exceeded; future helper inputs must stop at450sec to allow immediate cleanup.
Public078, all old worlds and original assets remain unchanged.


### Original loading trial095 and separate Wardens release096

The muted paired original r7 loading trial095 stopped at3188.3MiB, exceeding
the3072MiB owned-process ceiling. No gameplay action or new managed checkpoint occurred. The guard closed Chrome; no owned processes remain. The r7
backup remains latest. Do not relaunch a stopped trial through an inspection
command. See output/campaign095-local-observed.json. This is a bounded stop,
not a historical host-app crash fix.

Wardens completion need not wait for an unrelated original Chapter3 save.
The byte-verified content086 package is now offered separately as player096.
Its only native change from the source-qualified engine is the Chapter4 resume
policy. Publication checks verify all compiled source digests, engine artifacts,
frontend baseline and package identity before creating the release. All63
focused frontend checks and10 publication tests pass; the earlier31 official
native policy checks are retained as evidence. The recorded092 shared victory,
both completion databases and fully validated archives qualify the content.

All139package files verify. All six release routes return HTTP200; served
engine lengths and games.json match the qualified build. Nine older releases
retain their paths and file metadata; default entrypoint bytes remain
unchanged. No player storage is read or written by publication. The versioned
release entry itself has not been browser-launched. Fresh restore UI,
post-victory native resume, independent households and sustained browser
resource bounds remain unqualified. Original Chapter3 still requires victory.
Wayfinder/TrailLodge remain uncompiled authoring drafts. Evidence:
output/content096-qualified.json and output/content096-publication/.


### Published-entry trial097 and safe user pause

The published player096 native menu launches, and the original Chapter3r7
checkpoint admits both roles with the native restored-two-kingdoms signal.
Paired admission then reaches3264.7MiB above3072MiB and the guard closes before
gameplay. No new managed checkpoint is created. All owned processes are gone.
See output/campaign097-local-observed.json. Staging alone is insufficient.

UI-only098 shows no installed extensions in normal Chrome UI. The internal
Discards page is disabled; its restriction is not bypassed. A spare-renderer
launch candidate099 shows lower idle RSS, but actual launch-flag verification
fails. CLI args require comma or newline separation; the candidate combined
space-separated flags incorrectly. This is not a qualified optimization,
and the project default remains verified --mute-audio only. Correct and
verify argument parsing before any further trial. See
output/browser099-unqualified.json. No game engine ran in these UI-only tests.

User requested a pause at the next safe stopping point. All owned browsers,
games and builds are stopped; existing local server and relay are preserved.
Original r7 backup, completed Wardens profiles, older releases and prototype
files remain preserved. New hero/building compiler approval remains pending.


### Published original gameplay103–105 and placement evidence

After the requested safe pause, the authoritative goal resumed. Trial103
played original Chapter3 on published player096 and committed revision8;
all34 older WorldResume copies and all20 database records remained byte-identical.
No guardhouse was placed. Its save-margin helper covered clicks but missed a
keyboard pan around453sec; the shared command wrapper now checks every input.

Trial104 admitted revision8 but crossed3072MiB and was closed by the watcher.
Its guest route was loaded once before correction to the full resume URL, so
the extra load limits memory comparisons. No new checkpoint or completed
gameplay input resulted. Trial105 prepared both full resume URLs before
launch. It played below the ceiling with peak2997.7MiB and released both
engines at424sec, before the450sec save deadline and600sec gameplay limit.
Actual mute and spare-renderer arguments were verified, but this does not
prove a causal memory improvement or resolve the historical host-app crash.

The shipped optional construction trace observed native rejection reason1
and collision masks1800/1100. At native point228,174 (screen1240,60 after
12 west and12 north arrow presses from r8), both tests returned0 and the
preview turned green. The subsequent ordinary build click was refused; the
paused screen reports obstruction and has no600gold deduction. The r9 native
save contains no ABE1 guardhouse. The intervening blocker is unidentified.
Do not treat a legal preview as a completed purchase or construction.

Revision9 is committed, exported and checked through the shipped validator.
All36 prior WorldResume copies and all20 database records remain byte-identical,
including both Wardens Chapter4 completions. Host Palace has105HP, guest
Palace550HP; host marketplace remains unfinished. Original Chapter3 victory
is still unqualified. The older healthy revisions and every backup remain
available; older-resume policy must be checked before attempting recovery.
The close-and-prepare-resume control is a link; trial105 incorrectly looked
for a button first, then used the shipped recovery link after guest disconnect.
The committed r9 checkpoint was recovered successfully. Future cleanup uses
the exact link role and closes host before guest. Owned Chrome is closed.

The new shared wrapper `scripts/run-owned-browser-command.py` consumes an
owned `*-trial.json` with `ownedDaemonPid`, `saveByUnix`, and the launch CLI
path in `browserCli` (or a configured agent-browser on PATH). Its matching
`*-browser.json` supplies the unchanged muted launch config on every command.
Stop markers and absent owned Chrome prohibit automatic relaunch. After the
save deadline, only inspection and explicitly named save/recovery/backup
controls remain available; keyboard, mouse, arbitrary eval and fresh game
navigation are refused. Eight focused policy regressions pass. Native engine,
game assets and generated translations were not changed in this continuation.
Evidence: output/campaign103-backup-verified.json,
output/campaign104-local-observed.json, output/campaign105-local-observed.json,
output/campaign105-backup-verified.json and output/campaign105-input-policy-checks.json.

### Safe pause after trials106–107

The user requested a pause. All owned trial processes and game engines are closed. Trial106 restored the preserved r7 backup through the shipped096 UI into isolated profile106; both Wardens profiles displayed Chapter4 completed. Trial107 resumed native original Chapter3 co-op from that restored branch and saved recovery r8 with one living gnome, host palace405HP and guest palace550HP. No surviving wizard was verified; no guardhouse or Chapter3 victory was achieved. The newer original r9 and its profile remain separate and preserved.

The recovery archive verifies598native files,20databases and all34prior resume copies unchanged. Peak owned RSS was2971.6MiB under3072MiB. The pause request receipt was at459seconds,9seconds beyond the450second save margin; engines were released at532seconds, before the600second target. Begin saving earlier on resumption. Evidence: `output/campaign106-restore-qualified.json`, `output/campaign107-local-observed.json`, and `output/campaign107-backup-verified.json`. Resume from profile106 using `output/campaign107-recovery-r8-invitation.txt` only after the user requests continuation.

## Recovery r10 and continued pause verification

The user resumed work from the paused checkpoint. Recovery trial109 completed
Wizards Guild3 through normal paid construction and used Lightning Storm;
trial111 then finished the host Marketplace and restored both castles to full
550HP. The recovery r10 save is553615 bytes, SHA-256
`180a01f0880dbd4c0bed3d44264ba8ad0d0f89bcb1c35d3b2f464cb156621373`.
`output/campaign111-recovery-r10-player-backup.zip` contains603 native files and
20 valid databases; all38 prior WorldResume copies, all previous native paths
and every prior database remain intact. No Wizard or Gnome survived the save.
Chapter3 victory is unfinished. This is the isolated profile106 recovery branch;
the original r9 profile079 and its backups remain separate and preserved.

A JS-only guest release change failed actual trial111 because only the host
emitted a checkpoint receipt. The replacement uses a read-only original native
guest pause observer, with host-only saves and invitation preparation. Native
pause checks and34 frontend checks pass. Its live guest link is unverified:
trials115/118/123 reached the3072MiB memory guard before restored gameplay and
were cleaned without changing r10. The optional compact-worker build passes24
build/policy checks and compilation, but did not qualify sustained paired memory.
An isolated optimized-link attempt is in progress; current releases are unchanged.

Private trial132 restores recovery r10 with the optimized131 engine, plays both
roles below the owned3072MiB ceiling and commits r11 (frame534,clock2251200,
547683bytes,SHA609f403b95fcf222a4e40317bbf21fff21492ad9222ae7eaeb718e67cb6789ef).
Actual guest pause UI, guest close link and guest reconnect guidance pass; host
resume preparation passes. The complete605-file backup preserves40 earlier
resume copies and all20 databases. Publication still needs a captured native
guest frame/clock tuple; fresh r11 trial134 is in progress. Original r9 and
release096 remain unchanged. This does not finish Chapter3 or compile new types.

Follow-up r11 trial134 crosses the3072MiB guard at3280.0MiB during native
startup; all owned engines/processes are closed and r11 remains intact.
Official targeted-link135 adds simplify-locals, merge-blocks and reorder-locals:
33.8s,1979.5MiB peak,100776692-byte WASM (7.75 percent below compact121).
No native source or generated translation changes. Private136 uses this build.
An owned UI-only inventory137 has one exposed tab but four renderer processes;
trial138 disables owned-profile extensions/background activity and preserves
Translate disable, lowering the initial UI sample to976.1MiB. This is a test
configuration observation, not an explanation or fix for the historical
host-app crash. Fresh paired qualification is pending; public/default releases
remain unchanged. Evidence: output/campaign134-local-observed.json,
output/private-resume073-wasm-135/build.json and output/coop136-site.json.

Local release139 publishes private136 after actual muted trial138 qualifies
restored revision11 in both native roles. The observed native pause tuples
match: epoch1/frame418/clock2272100. Host commits revision12, the actual guest
close link opens reconnect guidance without an old resume token, and host
resume preparation verifies a fresh copy. The607-file backup retains42 older
resume copies and all20 databases. All owned engines/browser are closed;
2636.9MiB sampled peak stays below the3072MiB guard. Focused frontend34,
build-policy24, publication22 and cleanup-policy8 checks and the official native
pause fixture pass. Six HTTP release routes hash-match the qualified package.
Defaults/older releases are preserved. Evidence: output/coop139-qualified.json,
output/coop139-publication/publication.json and served-verification.json.
This does not qualify prolonged gameplay, original Chapter3 victory, independent
internet play or compiled new characters/buildings; historical crashes remain
unresolved. Work continues from recoveryr12, with originalr9 kept separate.

Published release139 native follow-up147 restores revision12 in both roles,
plays the actual kingdoms, recruits one wizard for the displayed500-gold price,
and commits revision13 after actual host/guest pause tuples match at
epoch1/frame2211/clock2382650. The556270-byte checkpoint has SHA256
41ce04aadaaa44a24249a62ba42f16deaf177bf2f4011de9bbb42889a20b05c7.
The609-native-file/20-database backup retains44 earlier resume copies and all
prior database bytes. Both palaces have550HP; the committed save contains the
paid wizard alive with4HP. Treasury progress is11005/26200, so Chapter3 is
still unfinished. Peak owned RSS2899.8MiB stays below3072MiB; owned engines
and browser are released. Recovery13 is separate from original9. Evidence:
output/campaign147-local-observed.json and campaign147-backup-verified.json.

Official SDK content compiler trial145 succeeds using a complete, consistent
Wine1.7.55 filesystem from the published Boxedwine18R2 archive in isolated
muted browser WASM. The earlier minimal filesystem trial144 lacks the VC++2008
builtins and fails with0xc0000135. Trial145 exits0 and exports3462-byte
Wayfinder bytecode (SHA256
61a51da7b5a069a9839dc63ee97e50e77e47cf7d0243611f19db66faeeb19037),
with1622.2MiB peak and no host Wine/Rosetta installation or player-profile
access. Source archive, original compiler and output hashes are bound by
scripts/prepare-compiled-wayfinder-pack.py; all15 Wayfinder authoring/evidence
checks pass. Private compiled pack146 is neither installed nor published.
Pinned original loader004b9850/005953c0 consumes XmlDataRoot CAM/GPL groups;
SDK mmxml discovery is unverified. New DUNT resources, proper menu labels,
paid placement/recruitment, behavior, death, save/reload and matching co-op
content identity still require qualification. Evidence:
output/sdk145-local-observed.json, wayfinder149-compiled-verification.json
and wayfinder148-native-loader-plan.json.


## Native Wayfinder loading checkpoint (October11,2026)

Official one-job native build474 refreshed the desktop test engine against the
current co-op sources; build475 added an opt-in file-open-only trace. Both
completed normally under the3072MiB/600s build guard. The changed runtime source
was formatted through the official tool with the resident Xcode formatter.

The private native resource generator and its six focused tests bring the
authoring/compiler/native-resource total to21 passing checks. Its two new DUNT
identities preserve inherited art and attachments and link Trail Lodge production
to WF01. Trial170 opens the exact CAM and official SDK bytecode through the
pinned original loader, reaches the main menu, exits0 and uses128.2MiB peak.
The open-only log remains26,051bytes. Existing releases and browser profiles
are unchanged; no new-type placement, recruitment, behavior, save or co-op
qualification is implied.

Clean control168 retains original configuration and contains no private CAM/BCD.
It reproduces fresh beginner freestyle's GplException `bad conversion to list&`,
as did the pack-enabled trial164. The failure remains unresolved. Trial167's
per-read trace was guard-stopped at8MiB; the original receipt mislabels this as a
duration stop, corrected in its separate cleanup audit. All owned native
processes are released. The active goal continues from revision13 and the native
loading receipt; original Chapter3 victory and new-type gameplay remain pending.

## Mission-level native content initialization (October 11, 2026)

The authoring source now uses unused legacy-family identities AVz1/ABs1.
Private namespace180 shows the stock900-gold Trail Lodge menu entry separately
from Rangers Guild; original save/reload184 restores the isolated fresh world.
Fresh-world exception171 was resolved by enabling the already audited inventory
compatibility option in the desktop test configuration. Earlier168 notes describe
an incomplete test configuration, not a remaining fresh-map blocker.

Actual construction185 exposed a different original exception: missing
initialization data. Open-only tracing shows startup loads Wayfinder bytecode,
then mission entry reloads stock GPL without reopening the private file.
Private187 appends the unchanged bytecode after the expansion mission scripts;
the original creation path now reaches placement preview without that exception.
Its first site overlaps a building, and subsequent sites188/189 are refused for
collision or unrevealed ground. No treasury debit or new saved object is claimed.

The versioned config generator now appends GPL after every supported stock
mission dataset and retains the startup CAM load. Regression checks protect
stock script order, unrelated/unload groups and single description loading.
Only the expansion mission path has live verification so far.

Canonical compiled pack190 reuses SDK145 output only after all three compiler
inputs match the original archived draft byte for byte; the revised resource XML
is independently bound to authoring183. It does not claim a second compiler run.
New native pack191 and config192 derive directly from that canonical source.
The strict default full-archive compiler binding remains available. Ten compiler
binding checks and22 authoring/native/menu checks pass. Private site-survey193
continues paid construction qualification. No campaign, browser release or
purchased installation is changed. Evidence:
output/wayfinder192-native-content-checkpoint.json.

## Canonical native continuation checkpoint207

The versioned source uses AVz1/ABs1, exact official compiler input reuse190,
native resources191 and mission config192. Startup-only GPL loading was
insufficient: original mission entry replaces initialization tables. The fixed
mission load ordering reaches creation preview. Thirty-two focused checks pass.

Canonical fresh-world200 starts and saves normally (194.1MiB peak); original
reload201 succeeds (168.9MiB). Its actual kingdom location differs from the older
fixture180, so camera coordinates cannot be reused between worlds. Relative
pointer movements avoid repeated edge scrolling. Trials202–206 select the
proper palace and new Lodge but still receive original collision/fog refusals.
No paid debit, new saved Lodge, Wayfinder recruitment or browser/co-op new-type
qualification is claimed. All owned native trials are terminal and released.

Next work is stock setup/placement inspection and a clear ordinary test map or
normal kingdom exploration, then exact paid new-object/native-save verification.
Revision13, its verified609-file/20-database backup, completed Wardens and local
release139 remain preserved. The goal stays active. Evidence:
output/wayfinder207-continuation-checkpoint.json.

## Sparse original setup and placement control215

Stock manual UI208–211 reveals default Wizard Hold starts a library, Wizards
Guild and two towers. New Settlement starts only a level-one palace. Ordinary
setup212 selects New Settlement, Rat Scouts, no wandering monsters/events,
30000 starting gold and an80000-gold gather target. Its307339-byte original
save is preserved; native exit0,185.8MiB peak. This is a test world, not a new
published mission or new-type gameplay qualification.

Control213 actually selects stock Rogues Guild600 because the menu row order
changes; it is not counted as Lodge testing. Corrected214 verifies Trail Lodge900
selection and reaches original creation/preview but the three attempted sites
remain collision-refused (exit0,205.5MiB). No paid debit, saved Lodge or recruited
Wayfinder is claimed. Pixels and refusal messages alone do not establish the
exact collision cause. Next work inspects original placement checks and real
browser input versus native smoke input with canonical overlays. All owned
native processes are released; revision13 and old releases/assets are preserved.
Evidence: output/wayfinder215-continuation-checkpoint.json. Goal remains active.

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


October 11 continuation: release139 WASM imported the exact private Wayfinder/Lodge assets and native saves into an isolated muted profile. Trial233 used the original Recruit keyboard shortcut, charged425gold (29220 to28795), spawned Wayfinder601/agent24 and observed level2 defense. Its normal native save was exported through public OPFS:345108bytes, SHA256688ee98267acb685fb4adf65b44d5fa3d042a997b781fed0adbd5bc8e84f3da5. Offline checkpoint parsing confirms live ABs1/AVz1 objects and wayfinder_tree basicscript. Evidence: output/wayfinder233-browser-qualified.json. Browser mouse recruitment and fresh browser save reload remain unverified; hover over visible Recruit reports Scan through henchmen. Owned trials230–233 were closed;233 peak1946.3MiB, no guard stop.

Authoring236/compiled237/native238/menu239 prepares a separate APw1 guild interface with Trail Lodge/Wayfinder text, preserving every original AP47 widget/action and all unrelated strings. The three GPL compiler inputs remain byte-identical to the successful official SDK145 invocation; no new compiler invocation is claimed.35focused checks pass. Native240 loaded the new CAM but selecting the panel failed at return004168fc because original004ca4f0 recognizes only fixed panel IDs. A game-specific factory adapter now borrows the original AP47 controller for APw1, leaving its independently created window/string resource in place. Official native build480 and actual in-game qualification are pending. Older qualified pack191/192, all original assets, player139, and saved recoveryr13 remain preserved.


Native interface follow-up: official native480 passes with peak1123.9MiB; the APw1 controller alias resolves native240's null factory result. Actual native242/243 both exit0 (peaks196.3/187.0MiB) with ordinary mouse425gold recruitment. Native243 hover displays Recruit a Wayfinder; native242 saved live ABs1/AVz1 objects with the custom tree. Qualification is output/wayfinder243-interface-qualified.json. No new browser-interface or co-op qualification is implied. Private optimized WASM244 is now building through the unmodified official game tools, reusing private135 build outputs after preserving its artifacts and verifying published/default files use independent inodes.35content,6game-configuration and1private native-binding test pass.


## Short viewport recruitment correction (private native481/251)

The separate APw1 Trail Lodge panel is qualified in native243. Private WASM244
loads that panel and reloads browser233's native save in browser247; the
Wayfinder remains alive and reaches level3. Browser mouse recruitment still
hovered the henchmen control. Native248 proves the absolute window input path
works against the native800x600 layout. Inspection of the pinned1080p APMK
resource finds the actual overlap: its tracking buttons at824 move to377 when
the responsive height is633, inside the selected building panel182..427.

The adapter now uses the native single-tracker bottom anchors below1080px and
moves the extra1080p panels outside the input area. Five geometry tests check
the whole selection panel against other sidebar rectangles at minimum,633,720
and1079 heights. An opt-in RECOMP_SMOKE_VIEWPORT fixture publishes the same
logical viewport seam used by the browser. Official native481 passes, then
native251 at1280x633 shows the correct Wayfinder tooltip and ordinary mouse
recruitment:29210 gold becomes28785 and recruitment starts. Exit0, peak163.3MiB,
no guard stop. Native250 loaded the earlier construction save and is only
layout/startup evidence; it is not recruitment qualification.

Evidence: output/wayfinder251-short-viewport-qualified.json and
output/native-world-residency-build-481.json. Incremental private WASM252 is
underway with assertions, official tools, compact workers and resource guard
retained. No release or user profile changed. Matching-content co-op and actual
Wayfinder exploration remain unfinished, as does original Chapter3 recoveryr13.


### Browser mouse recruitment and native save (private253/254)

The bounded muted browser254 trial runs WASM252 at1280x633. The selected
Trail Lodge shows the Wayfinder tooltip, ordinary mouse recruitment starts
with425-gold price, and Recruited: Wayfinder appears with a live named hero.
Normal native saving creates a separate4Daysb slot (347910bytes, SHA256
458a2ec0190008d1c9b2d9db10de75d26cb592bf9f381fa8bea017657f12d4d3).
Its parsed original records contain live ABs1 unit526/agent10 and AVz1
unit600/agent23. All four earlier GMP saves retain their exact hashes.
The subsequent native Load menu selects that new slot and returns to gameplay;
exact reloaded hero selection/identity was not independently qualified in254.
Separate247 evidence already qualifies the earlier browser save's hero reload.

WASM252 passes the official one-job build under the3GiB guard at
1992785920bytes peak. Browser254 peaks1763.2MiB, no guard stop, and the owned
Chrome closes. Evidence: output/wayfinder254-browser-qualified.json and
output/wayfinder254-browser-object-audit.json. Private253 is a test candidate;
no published release, user tab/profile, original Chapter3r13 or Wardens
completion is changed. Matching-content co-op and exploration remain pending.


## Stable HD construction panel and preserved campaignr14 (native485/private264)

Trial255 proves an important limitation of the earlier short-height fix: the
extra HD selection widget4000 hosts the Buildings/construction panel. Moving
that widget offscreen hides construction. The corrected adapter retains the HD
artwork, removes complete optional secondary widget records and preserves the
primary tracking border. Its stable52-rectangle HUD uses the original native
construction fallback to selection2005 at every viewport size. The one tracker
uses the original single-panel bottom spacing. Other CAM resources and every
retained non-geometry native binding remain unchanged. Five source geometry/
binding checks pass. The native-generated1280x633 CAM matches all16 reference
resource payloads. Native262 (build485) opens Buildings, recruits a Wayfinder
for425gold, spawns it and saves live ABs1/AVz1 records. Exit0,169.9MiB peak.
Original800-art candidates257/259 were not selected: fixed decorative frames
remain at800x600 positions;259's guardhouse preview is correctly refused and
is not paid-construction evidence. Build484's preliminary51-count check was
corrected to measured52 before gameplay qualification.

Official private WASM263 passes; candidate264 is private. Paired browser265
restores original Chapter3r13 in both roles and opens the now-visible Buildings
window. Several guardhouse sites are refused by the original game. No new
paid construction or mission victory is claimed. Normal income reaches11335
and26320gold. Both roles pause at epoch1/frame3387/clock2552000; the host commits
revision14,569475bytes,SHA256
49682c3919a2289c66f95d07410e62af373cdbbf09af0c9cdc4712a3db997d44.
The trial guard closes owned Chrome at its deadline,2544.2MiB observed peak;
the host application remains alive. Zero-engine browser266 verifies the exact
public-storage hash, prepares a separate14 resume copy and downloads a complete
100177164-byte backup. All612 native entries,20 databases and46 earlier resume
copies validate; no old native path is missing and every old database matches.
The actual shipped264 validator passes archive/hash/path/Atlas/campaign schemas.
Browser266 closes normally at1160.9MiB peak; temporary backup copy is cleared.

Offline r14 units retain both550HP palaces, no live wizard and no guardhouse.
The r13 marketplace was already a ruin; income and defenses must be rebuilt
through valid native placement before the35000-each objective can complete.
Originalr13/r12 backups, older releases/default entrypoints, Wardens completion,
user tabs and new-character test profiles remain separate and preserved.
Evidence: output/wayfinder262-hud-qualified.json,
output/campaign265-local-observed.json and
output/campaign266-recovery-qualified.json. No independent-household internet,
full-match completion or historical host-app crash resolution is claimed.


## Native placement blockers and verified12 fallback (private272/274)

Browser267 resumes14 but cannot construct at the sampled town plots and ends
in shared defeat at45days; no new checkpoint is committed. Read-only original
query disassembly confirms the two masks traverse scene object occupancy. The
boundary policy only protects outer shared vertices, not these interior plots.
An opt-in bounded observer now identifies the original bitmap footprint and
blocking actor while retaining all original calls/results. Native270 reproduces
a refused guardhouse plot blocked by AVj2 peasant552, footprint8x5; normal
recruit/spawn/save continues, exit0/184.1MiB. Official486 and private WASM271 pass.

Browser273 identifies marketplace footprint14x10, guardhouse footprint8x5 and
its wider24x17 spacing bitmap. Real enemy buildings/monsters, automatic houses,
the palace and map bounds reject candidate plots. An inward camera view is
unexplored and returns original fog reason2. This evidence does not establish
a port collision bug and no placement checks are bypassed. The army-free14
world again suffers shared defeat at45days; owned Chrome closes,2360.6MiB peak.
Both tests preserve canonical14 recovery and produce no paid new construction.
The standalone native268 attempt correctly excludes the multiplayer save from
its Single Player menu; it is not a loaded-world or co-op qualification.

Offline inspection of the exact verified12 save (552396bytes, SHA256
05161e8d010b33855631c330c67d7a7450cf90a1d78243e0df4a6c5b75e78934)
finds host marketplace791 alive at183HP. Returning to that user-requested
recovery can protect/upgrade existing income and recruit defenders through
existing buildings before needing new plots. Revisions13/14 and their complete
backups remain preserved. Original Chapter3 victory is still unfinished.
Evidence: output/campaign273-local-observed.json,
output/campaign270-observer-qualified.json and
output/campaign274-r12-recovery-plan.json. No public release changes or new
internet/full-match/crash-fix qualification is claimed.


October11 recovery275/paired276:67 SHA-verified original12 files copied through public OPFS to fresh recovery275-host/guest profiles, preserving14. Private272/engine271 admits both native roles at revision12/clock2272100. Each kingdom pays500 for a Wizard; host casts an in-range1600 Lightning Storm. Marketplace dies and no Wizard survives. Both550HP castles remain at shared pause frame4439/clock2494050; fresh host13 checkpoint548949bytes SHAf3a5c0e254711013e64f2cf629991dbbdb96f09d318563396e891a61f76d01cc. Complete124335262-byte backup passes all entry digests/CRC and actual private272 schema validator; all612 prior native records and20 DBs unchanged. Owned muted Chrome closed, peak2904.9MiB, no guard stop; actual host31598 remains live. Original Chapter3 victory incomplete (9602/25790 versus35000 each). Parsed placement distinguishes guest town400,464/own GnomeHovel192,320 from host town3520,3616. Host minimap clicks cannot locate guest town; invitation control overlaps native upper-left minimap. Next action uses actual guest town and surviving own hovel. Evidence output/campaign276-local-observed.json, campaign276-backup-verified.json, campaign276-next-action-plan.json. No internet/full-match or crash-fix claim.


October11 private277/paired278–280 and compact recovery283: centered invitation summary leaves native upper-left minimap clear at1280x633;280 click8,14 reaches guest town.278 guarded at3184.6MiB during start; host31598 stayed live.279 agent HEAPU8 probe asserted unexported runtime getter in lobby; closed, no native world or checkpoint.280 normal UI-only retry uses direct guest route/requested Chrome WASM compilation tasks1, restores exact defense13 in both roles and shared14 pauseframe4295/clock2708800. No Gnome debit confirmed; selected50/75HP hovel dies during click window. Complete125447232-byte backup passes actual private277 schema/hash/CRC, preserves612 original native paths,89 earlier aliases and20 DBs. Hostpalace336HP/guest550HP;9842/25940 gold; original3 victory incomplete. Pinned original SDK identity correction: ABM1 WizardTower, ABf1 GnomeHovel, ABG1 Library, ABN1 Sewers, ABe1 GeneralHousing. Earlier contrary label claims are superseded; native raw ID/HP bytes remain valid.10 SHA-verified required original12 files1657081bytes installed through public OPFS into separate recovery283-host/guest with original14 marker unchanged; no game launched283. Next fast12 trial targets intact hostHovel1110 at3232,3264 immediately. Evidence280-local-observed,280-backup-verified,282-sdk-identity-corrections,283-recovery-installed. No internet/full-match/historical crash-fix claim; compiler flag effect not independently isolated.


October11 campaign285–290: original284 loss at43days is visually confirmed; it is not a verified shared campaign announcement or proved siege-only cause. Host SaveAndPause staysunconsumed behind original result dialog. Cooperative controls now expire unpolled requests at the existing10secdeadline into unconfirmed-checkpoint recovery, leaving consumed pauses intact. Native result wrapper emits pending result before original modal/fanout; pending frontend state cannot save victory or re-enable actions through stale start metadata. Final native result alone drives campaign completion.48 focused JS tests pass; native487/488 terminal0 (488 peak574.1MiB), currentWASM287 terminal0 peak2004811776bytes, private288 unpublished. Actual289 pair verifies original12 from current OPFS marker/alias, recruitsone100gold Gnome without progress-row clicks, waits30s, then saves both at epoch1/frame1862/clock2365200. LiveAVe1 unit3314/player0/hp3 and two550HP palaces confirmed in13 GMP557450bytes SHA48aff248b15565c2e5f05f64ed2a926cf017f03389f52f3096d8c01f7e07f700.128315019byte backup passes CRC/digests/private288 schemas; all684 prior native files/20 DBs unchanged. Original3 unfinished11344/26185 gold. Owned289 muted Chrome closesnormally, no guardstop; result-pending/timeout original runtime path not yet qualified. SDK VictoryCondition_Two winner branch also multiple_loss and KillThread; pinned491900/423090 EAX scalar getter verified. No cause or policy change inferred from that alone; nextactual outcome uses bounded optional64gate/32result records. Evidence289-local-observed,289-backup-verified,290-gold-result-analysis.


October12 paired291: private288/engine287 exact289r13 resume bothroles. Guest nativeBuildings menu shows stockGnomeHovel and Guardhouse;600gold guardhouse accepted atscreen1200,380,1500gold market at700,515 after minimap20,35. Common14 pauseepoch1/frame4288/clock2579600, GMP568702bytes SHAccf2ef1706df5d90dfd3ba642c9be5563ee7384e6f17e3628f517c4d5204a01a. Parsed ownedABE1 unit3410 andABH1 unit3595 both1HP, notcompleted; no finished-construction qualification. Hostcastle173HP/guild301HP, guestcastle550HP/guild500HP;11696/24255 gold; no liveGnome.129458540byte fullbackup passes CRC/all digests/private288 schemas; older native profiles/aliases and20DB unchanged. MutedownedChrome closednormally; no guardstop. Nexturgent originalhost LightningStorm defense through native spelltoolbar, then shortsharedsave; actual loss callback/recovery if castle falls. Earlier28913 archive preserved. Original3 victory/fullmatch/internet/crashfix unqualified. Evidence291-local-observed,291-backup-verified,291-native-all-units.


October12 paired292: private288/engine287 exact291r14 bothnative roles. Immediate original globalLightningStorm toolbar302,585 andtarget750,400 visiblycasts1600gold;15sec wait then common15 pauseepoch1/frame434/clock2601300. NativeGMP560424bytes SHAd4ef7d4e52e7db741a0c1d4721ea27b79b6af495b4171c38afd017f96c74ab59, hostcastle99HP/guest550HP,10121/24275 gold. Complete130591702byte backup CRC/digest/private288 schema validation passes; earlier native profiles/aliases/20DB unchanged. MutedownedChrome closesnormally; no guardstop/originaldefeat during this segment. Original3victory, completedincome construction, internet andhistoricalcrashfix stillunqualified. Originalpending-result branch notyetexecutedlive. Nextshort defense/worker-construction interval; preserveolder29114/28913 backups. Evidence292-local-observed,292-backup-verified,292-native-all-units.


October12 continuation293/295: native paired15 lobby admitted in293, but
match-start RSS3119.3MiB exceeded the3072MiB ceiling. Guard closed ownedChrome
before Storm inputs or a new checkpoint. HostApp31598 remains live. The295
baseline-only WASM compiler experiment loaded one native menu/lobby with
peak2246.9MiB and a1960.7MiB sample; a second engine was withheld, and the
owned browser was closed. This is not a compiler performance improvement.
Actual public OPFS read on the zero-engine backup page verifies current15
marker/frame434/clock2601300 and560424byte WorldResume alias SHA
d4ef7d4e52e7db741a0c1d4721ea27b79b6af495b4171c38afd017f96c74ab59 unchanged.
Private288 already hashes content with bounded64KiB worker reads; an unnecessary
294 candidate based on the older upstream template was withdrawn. Evidence:
output/campaign293-local-observed.json, output/campaign295-local-observed.json,
output/campaign294-candidate-withdrawn.json. Original3 victory and natural-ended
result/pending-save recovery remain unqualified; goal active.


October12 worker-pool continuation298/299/300: add opt-in lean startup pool2
to the official CMake/build CLI while standard8 and compact4 remain unchanged.
All pools can grow on demand; no stack, capacity, scheduling or game-rule change.
24focused policy/build checks pass. Official guardedWASM298 link exits0, with
peak2075672576bytes and exact source closure unchanged during build. Prior287
artifacts retained; prior private preset restored after link. Private299 is
staged from288 with source engine/manifest bytes unchanged. Actual300 native
menu observer reports536870912-byte linear capacity and2active/0idle workers.
The native pair joins its original15 lobby, butmatch-start RSS3149.1MiB triggers
cleanup beforeStorm/save. OwnedChrome closed and hostApp remains alive. This
is not a qualified memory improvement or complete playable pair. Source15
archive and original3 victory remain outstanding; no newcheckpoint committed.
Evidence: output/campaign298-worker-policy-tests.txt,
output/campaign298-build-policy-tests.txt,
output/private-resume073-wasm-298/build.json, output/campaign299-site.json,
output/campaign300-local-observed.json.


October12 fresh301 recovery/303/305: install10required files (1671903bytes)
from exact verified289 original13 archive using public OPFS with absent-destination
and per-file hashes. Old original14 and current28315 markers unchanged. Actual
303 pair restores13 on299/298, pays1600Storm and saves14 frame450/clock2387700.
Bothpalaces550, guilds700/500 andthree living peasants; full134117980byte
archive validates702older nativefiles/98aliases/20DB unchanged. Peak2765.9MiB.
Actual305 resumes14, pays1500guestMarketplace and saves15 frame2415/clock2508450.
Market3484 remains1HP/unbuilt. Guestworker agents391/393 are absent; saved
palace.num_peasants0/max2. Hostnew3506/agent494 remains5HP. Bothpalaces544/550,
guilds530/500, treasury10017/24795. Full135230362byte archive/hash/actual299
schema verifies705other nativefiles/102oldaliases/20DB unchanged. Peak2642.2MiB.
No completed marketplace/income/victory claimed. Oldbranches remain preserved.
Export automation errors: empty custom download anchor303 was corrected to a
visible labelled link in zero-engine304. A prior cache blocked305 export;
confirmed cache-clear response305 followed by zero-engine306 new export/download
and an awaited cache-clear success. All ownedChrome sessions closed; host app
alive. Native common guest pause clocks match committed markers. Different
checkpoint/profiles prevent attributing RSS differences to pool2 alone.
Evidence: output/campaign302-recovery-installed.json,
output/campaign303-local-observed.json, output/campaign305-local-observed.json,
output/campaign305-worker-state.json, output/campaign305-backup-verified.json.
Goal active: protect worker route/replenishment and host guild before restoring
market income and verifying original3 gold victory/persisted completion.


October12 continuation308/309/310: native alias list orders filenames, not
revision.307 older14 initiallyselected caught beforeStart, then corrected15
bySHA thirdrow; inputdeadline reached inlobby, closedwithoutworldstart/save.
Add trusted-token preplay exactLoadGame alias/revision reminder to game co-op
panel andresumeinstructions. Aliases/slots/auth unchanged.40focusedresumechecks
pass; olderVMfixture nowprovidesboundedfake requesttimers. Private309 changes
onlytwo frontendfiles;299 originals/engine retained. Actual310 confirmshint15
andexact21f20360... thirdrow with41daydescription; hint hides onsharedstart.
Hostpan8,14 showsguestareaunexplored; noremoteStormattempt andsharedvision
unqualified. GuestWizardTower selected385,280; nativeEnchantTower costs400
at100,385, changesdurationbar andshows purpleattack againstnearbywolf.16
saves activewiz_tower_scan andnativeattribute04425041 0->1, tower227HP.
Guestnewpeasant3689/agent526 HP10 returns; market3484 progresses1->17HP but
notcompleted. Bothpalaces416/550, guilds103/500, treasury10192/24535.
Commonframe2716/clock2644250/native574638byte SHA
bade695839c8a42323e2f24fd716e5d81b3362ae68af187d354ed85965351094.
Full136381655byte archiveCRC/digests/shipped309schema verifies705other
nativefiles/104oldaliases/20DB unchanged. DirectCLI download#export captures
the shippedUIautomaticdownload; awaitedcache-clear success beforeclose.
OwnedChromeclosed, hostappalive, peak3018.5MiB/noguard. Original3victory,
marketcompletion andinternet/fullmatch/crashfix remainunqualified. Nexturgent
step protects hostWizardGuild103HP via normalmagic/shortscriptedinterval.
Evidence: output/campaign308-resume-guidance-tests.txt,
output/campaign309-site.json, output/campaign310-local-observed.json,
output/campaign310-tower-agent-state.json, output/campaign310-backup-verified.json.


October12 continuation312: exactbade...16 alias selected with44daydescription;
nativepair restores on309/298. Immediate hostpan167,142, globalStorm302,585
at1011,283 pays1600 withvisibleeffect.10sec interval/common17 frame355/clock
2662000 save/native566014byte SHA
07f7a863d9e3ad4d4fe8d90c18e4637ffae477898723d88506ad7434247d82e3.
HostGuild3 still103->20HP: defense notstabilized. Palaces416/550, guestGuild500,
market3484 remains17HP/unbuilt; oneguestpeasant3744/agent529 HP10. Gold8617/24555.
Full137532809byte nativeCRC/digests/shipped309schema validates705other
files/106oldaliases/20DB unchanged. OwnedChromeclosed, hostappalive,
peak2582.9MiB/noguard. OriginalSDK peasant_go_build requiresadjacency, eligible
repairflags andbuilding HP growth; noinstantaneousrepairqualified. Preserve
stronger16/15 archives while assessing worker/repairpriority andconstruction.
Evidence: output/campaign312-local-observed.json,
output/campaign312-backup-verified.json. Goalactive; original3victory unfinished.


October12 continuation313/314: stopped17 GPL queue inspection proves guest
peasant529 activepeasant_go_build targetsmarket492, withpalace21 queue7/492,
busy1/num1/max2. Workerworld432,944 vsmarket480,992. Pinned originalSDK
peasant_basic/reconstruct_lists choosesqueued construction; repair eligibility
usesisrepaired/QuickRepair andpeasant_go_build requiresadjacency. No saved
state/rule modifications. Actual314 native17 pair30sec no-action interval
commits18 frame522/clock2688100/native568169byte SHA
00f847a6a5d36b8bd1c4b7830e7efe65f13606aebb9061b2473db3eed5762487.
Market3484 progresses17->65HP butnotbuilt. Hostguild20unchanged duringthis
segment; castles366/550. Newpeasants3842/536 hostand3845/537 guest10HP.
Treasuries8642/24575. Full138661586byte nativeCRC/hash/shipped309schema archive
verifies705other nativefiles/108oldaliases/20DB unchanged. OwnedChromeclosed,
hostappalive, peak2585.4MiB/noguard. Nextcontinueconstruction beforeclaiming
income, whilepreservingallstrongerbranches andoriginal3victory requirement.
Evidence: output/campaign313-queue-audit.json,
output/campaign313-worker-placement.json, output/campaign314-local-observed.json,
output/campaign314-backup-verified.json. Goalactive.


October12 continuation317-325: bounded muted paired321 resumes exact18 and
runs90sec withautomatic sharedsave/pause. Native19 frame1598 clock2768000,
557026bytes SHA1c5fd21854f19762d4e7175b43581f4484e713360f09823891904a6462db0dc2.
Market3484/492 reaches200HP/built1; castles288/550, guilds15/500.
Treasuries8737/24655. Native taxcollectors371/487 remain12HP insidepalaces;
marketrevenue/taxcollection isnotyetqualified. Native19GMP plusmarker/resume
links capturedthroughpublicOPFS andnative-onlyrecoveryZIP CRC/digestverified.
This isnotafullplayerbackup. Full19exports stalled inactualworker/backend
andmain-threadbackend; complete18archive remainslastfullbackup. Aborted
0bytecache/crswapremovedthroughshippedUI325 afteractualbrowserclosure.
No current20DB/705other-native/108aliases preservationclaim ismadeuntilfull
19capturecomparison. Original3shared35000gold victory remainsunfinished.

Launch317 stray barefeatureargument openedDNSerrorpage; newargsomitit.
Projectagent-browser.json cloudplaceholderblockedreads; preservedplaceholder
andrestoredresident mute-audiodefault. Initial0.39tab wasunresponsive;
freshownedtab +initialtabclose restoredhostmenu. Gueststandalone reopened
tab reachedmenu. IsolatedCLI0.31 alsofull-exportstalled, so workerpause
hypothesisisnotestablished. ProbeWorkers replyandreloadedbackupUIclearworks.
Source/backend/runtime/WASM unchanged. Allownedtrialsclosed; paired321peak
3062.8MiB/noguard, hostappalive. Currentcontinuation is
output/campaign326-continuation-checkpoint.json; evidence
output/campaign321-local-observed.json, output/campaign321-native19-captured.json,
output/campaign321-native-unit-audit.json. Nextlocateawaitedexportoperation
withboundedprogress, capturefull19 beforeadvancingnativeincome/defense.


October12 continuation327-332: privateclonedbackendlatest-operation trace
pinpointed5bytecoop-fresh-host-031/mod-settings.json hashreadstall; fresh
publicreadalsostalled. Originalfileatomicmovetopublicquarantineoutside
profiletree; canonicalpathrestoredexactverified18bytes.52preferenceprobe
finds13morestalled/39readableunchanged.13originalspreservedlikewiseand
verifiedrestored.444protectedsmallfilesthenreadable/allhashmatch18;
viewportfilewasnotchanged. Underlyingreadstallcauseisnotestablished.
Originalquarantinesretainedatmajesty/.backup-recovery-328/and330/; these
originalunreadablefilesareoutsidethefullplayerbundleprofiletree.

Complete19archive139778857bytes SHA
2c22ee8cf04b323a461448d50cadcdf59e68163aacbc03b6cf8c3473aebfc493
passesCRC/allentrydigests andactualprivate309schema:729nativefiles/20DB.
All705othernativefiles/110oldresumealiases/20previousDBbytesmatchcomplete18.
Native19GMPmatchespreviouslycapturedSHA/frame1598/clock2768000 exactly.
Completedtemporarycachecleared;allownedbrowsersclosed. Game/runtime/WASM
andproductionbackupexporterunchanged; private3tracecopiestemporarytestonly.

Paired332 native19exactaliasselectedfifthrow231;bothoriginalplayersReady.
Guestmodulefetchfailurebeforeenginebootstraprecoveredbyownedtabreload.
Hostcampaign/session importfailed, panelabsent despiteHTTP200/filespresent,
cachebustedretryalsofailed. NoStart/newsave; boundedtrialclosed. Thisisnot
original3victoryorincomequalification. Currentgold8737/24655, hostcastle288
andguild15; market200/built1. Nextfreshhostpageverifyallcontrollers before
Start,thenautomatic90sec/sharedsave. Activecheckpoint:
output/campaign333-continuation-checkpoint.json. No internet/fullmatch/crashfix.


October12 continuation334/335: zeroenginepreflight serialfetch/evaluation
of7campaignmodules succeeds(200/JavaScript); thennativehostcampaignpanel
loads beforebothoriginalroles resumeexact19alias1c5fd...fifthrow231.
Bounded90sec/noactions automaticsharedpause commits20 frame1350 clock2835500
559205bytes SHAaf4b3054087ea4bf4cf9cef9b08e50214a0e1ed299a67991dd76466f8b4d3d97.
Gold8737/24655 ->8822/24985. Market3484 retains200/built1, Revenue_Adjuster
125gold/30000msnativeagentstate. Exacttaxtransfernotindependentlyqualified;
oldtaxagent371deletedby20. Guestcastle550/guild2 500healthy. Hostcastle
288->55 andguild3deleted: nextunprotectedincomeinterval unsafe. Needordinary
defense/rescueorfreshisolatedearlierbranch; protectallold/newerarchives.

Complete20archive140887187bytes SHAbfcafbe350d59ce2f64a660f45419af744c52785801c268e4d2abf2bda89857f
passesCRC/allentrydigests/private309schema:731native/20DB,705otherfiles/112
oldaliases/20priorDBbytesunchanged. Temporarycachecleared; allownedbrowsers
closed; peak3003.1MiB/noguard. Controllerfind-linkexactfaileddespitevisible
snapshot; clickfresh@e6/@e2 succeeded. Guesttabactuallyclosedafterpause
beforeexport. No runtime/WASM/sourcechanges, internet/fullmatch/crashfix or
original3victoryclaim. Activecheckpoint output/campaign336-continuation-checkpoint.json;
evidence output/campaign334-local-observed.json andcampaign335-revenue-state.json.


October12 continuation337/338: stopped20placement audit centershostpalace
world3520,3616. Nineenemycharacterswithin650px:var gs,werewolf,ratmen/rats;
werewolf3482,3525 nearpalace. Hostownsurvivingbuildingsonlypalace3Gnomehovels
and2sewers; no hero/peasant/wizardguild. SDKSpells.gpl confirmsLightningStorm
compile_enemies radius150 andLightningBolt attack35max/16min. No rescueclaim.
Preservestrong19sourceinstead ofblindcastle55incomeinterval.

Exactverified19backup10nativefiles/1686828bytes stagedintofreshrescue337-host
andguest. PublicOPFSinstall verifiesallwrittenSHA, refusesexistingdestinations,
checksoriginalrecovery301-host20marker unchanged SHA
9782c6239081ee402595937a62c9bae9dfd1e4f94785d043fae730e292a63031.
2freshcampaignDB copyactual1/2completion fromresume073-browser-host/guest
recordsintheverified19bundle; no fabricated3completion. No nativeengine
launched; ownedbrowserclosed. Recovery URLs output/coop337-host-resume.txt
andguest. Source/native19bytesunmodified,20andallolderprofiles retained.
Gameplaydefense/newbranchresume/fullbranchbackupstillunqualified. Active
checkpoint output/campaign339-continuation-checkpoint.json; evidence
output/campaign337-saved-defense-audit.json, campaign338-recovery-installed.json.


October12 continuation340: exact19aliasfirstrow151 inrescue337-host loads;
bothoriginalnativeplayersReady. GuestinvitationURL initiallyopenssetup(no
engine); correctedactualdirectgameURL fromhostpath/profileguest/roleguest.
Sourcehostnativegamelabelcold073-live retaineddespiterescue337 roomquery;
actualguestjoins. NativeStart/shortopeningpan153,154 targetsStorm302,585
at750,400castle. ScreenshotexplicitOutofrange, no1600golddeduction.
Sharedpausefreshbranch20frame279/clock2781950/native559021bytes SHA
87a12527f23e6da0b062ce0f17fe5106d9115571dcef67c1b250bcfd7d3f6744.
Castle264/550, hostguild-1HP/agent0deleted, hostnewpeasant555HP10,guest2
peasantsalive. Gold8762/24675. No qualifiedStormdefense/rescue.

Full143772771byte archive SHA6bc4ef7dd3c3652873f5ef71dd959b92f1c47dc5cb86a909d93822f4491373d0
passesCRC/entrydigest/private309schema:745native/22DB. All731priornativefiles
and114prioraliases/20priorDBcontentsunchanged. FirstverifiercomparedDBZIP
positions;2newnamedprogressDB shiftindices. Correctidentitybydatabase.name
beforecomparison; allpriornames/hashpreserved. New2DBactual1/2copyretained.
Temporarycachecleared/allownedbrowsersclosed,peak2957.3MiB/noguard.
Rootgame/runtime/WASM unchanged. Nextordinarydefense/recruitment/building
withlivingworker; nohostspellguild. Original3stillunfinished. Activecheckpoint
output/campaign341-continuation-checkpoint.json.
