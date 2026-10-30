# Changelog

## Dark Paladin medieval preview — October 30, 2026

- Replace the guild thumbnail with a painted candlelit interior and the round building with an original Gothic stone hall, slate roof and distinct upgrade tiers. Preserve native framing and the 25-pixel Palace emblem.
- Add native level 2 and 3 upgrades, capacities of 4 and 5, and a scoped worker callback for existing prototype saves.
- Use the stock male Warrior voice bank consistently for Dark Paladins. Other classes and main production remain unchanged.

## Zoo capture cursor preview — October 29, 2026

- Restore the native green capture flag and reward amount beside the pointer before placement. Extend the active cursor table with the existing Zoo artwork so another interface archive cannot hide it.
- Preserve all existing cursor animations, capture mechanics, prices, saved worlds and the current engine.

## More Heroes retirement — October 29, 2026

- Keep Adventurers Guild and The Royal Menagerie active. Disable More Heroes construction and recruitment and restore the earlier random hero pool.
- Preserve all existing hero definitions, artwork and scripts for older saves. Fresh games provide a clean comparison for the reported exception; its cause has not been established.
- Retain the existing single-player engine and Phantom fixes. Distinct character and native UI artwork is required before any future More Heroes reintroduction.

## Community expansions and single-player delivery — October 28, 2026

- Integrate Adventurers Guild, The Royal Menagerie and all 13 classes from the original More Heroes Standard package alongside the existing guilds.
- Restore the four shared follower markers and preserve void callbacks in generated native action bridges, fixing saved-world monster deaths and paid taming exceptions.
- Use native framed menus, building emblems, quest rows and a compact captive list. Preserve original quest, capture, rental and taming mechanics and prices.
- Remove co-op launchers, invitations, network startup settings and the native Multiplayer entry. Preserve single-player worlds, profiles, backups and archived shared progress.

## Phantom survivability and Eternal Soul — October 28, 2026

- Fix Eternal Soul's high-level HP multiplication overflowing the original GPL expression accumulator and killing its caster. Scale current HP with bounded integer long division, preserve exact rounded health proportions, and keep a living one-HP hero alive when the effect begins or expires.
- Give Phantoms 18 additional starting HP, eight additional vitality, faster natural regeneration, and a 35-percent retreat threshold. Retain their original spells, artwork, equipment and undead healing restrictions.
- Upgrade existing living Phantoms once with the same vitality/recovery changes and an HP allowance for already-earned levels. Preserve damage taken and the original Eternal Soul lifecycle; persist the upgrade marker through ordinary saves.
- Let anchored Phantoms choose safe home retreat at low health instead of the stock last-stand gamble. Preserve Call to Grave's existing level, cooldown and destination checks.
- Change only composed shared gameplay bytecode in the original and Northern collections. Keep the engine, stock hero stats, resource identities and player-profile format unchanged.

## Campaign resources, Fire Balm and mixed-guild saves — October 20, 2026

- Restore 44 original Northern resource dependencies needed by community scripts in original campaigns, with their actual callbacks, constants, art and sound. Preserve existing resource identities and the stock Hero prototype.
- Fix Fire Balm's missing attack-action field on original Ranger, Rogue and Elf saves. Use the native VM's string ownership, preserve existing attack values, reject unsupported classes and duplicate active buffs, and restore attacks on expiry. Shared helpers load in both campaign editions.
- Verify original campaign play/save/reload and Northern paid recruitment of all five community classes across three completed guilds with the reported cheats active. Verify Now You Die on ordinary and hostile sewers, persisted deaths and a fresh reload of the mixed party.
- Bind the nine resource updates and compatible engine at release time; preserve prior qualification records, player saves, profiles and customized content. All 169 other native objects are retained byte-for-byte.
- These targeted game fixes do not establish a whole-Mac hard-freeze fix. Historical performance measurements retain their original engine bindings.

## Healers in original campaigns — October 19, 2026

- Fix a reproduced script exception after recruiting a Healer alongside community guilds: shared AI queried Northern Expansion’s `turn_undead_healer`, which the original campaign does not define.
- Treat only that audited, absent expansion spell as unavailable. Defined actions retain the original spell, level and cooldown checks; other missing names still report errors.
- Preserve existing game resources, saves, profiles and renderer optimizations.

## Community guilds in original campaigns — October 19, 2026

- Fix Bards Hall completion in original campaigns by restoring the Hall’s legacy capacity field from its real native guild limit, including old saves and upgrades.
- Fix Bard AI queries for five Northern-only effects when those definitions are absent from the current campaign. Preserve defined effects and all other native checks.
- Update only the two verified community script files in existing installations, preserving saves, original collections and customized files. Cache the verified revision to keep later startup fast.

## Reuse completed GPU composites — October 19, 2026

- Remove the full-screen GPU texture allocation on each fresh image. Reuse storage only after GPU frames, captures and cached-image consumers release their leases.
- In the matched 800×600 interval, reduce new composite textures from 124 in 5.11 seconds to zero after warmup. At 1080p the pooled trial stayed below 372 MiB GPU physical footprint through 52 seconds of scrolling; the prior engine crossed the 1 GiB test limit.
- Verify native ownership/failure/resolution controls, five cheats, ordinary saving and a fresh-session reload. Retain the exact native game/core objects, content, audio, simulation and profile identity. This addresses a measured GPU allocation/reclamation problem; it does not establish that every historical whole-Mac freeze has the same cause.

## Browser freeze containment — October 19, 2026

- Stop the owned main loop, workers, audio recovery/context and graphics device on terminal runtime failure or page exit. Avoid leaving audio playback running behind a game error.
- Bound estimated unretired GPU allocation/uploads and submission backlogs, rejecting over-budget work before sending it to WebGPU. Preserve actual WebIDL device identity and original saves.
- Investigate local Mac memory-pressure reports without attributing an unidentified Chrome helper to Majesty. These containment changes do not establish that the reported whole-Mac hang is resolved.

## Community guilds and Phantom spell icons — October17,2026

- Add Phantomstar’s Bards Hall and Phantoms Haunt beside Alchemist Lab, using the community’s actual heroes, building artwork, voices, scripts and mechanics.
- Fix Phantom ability icons using source artwork and native list/hover presentation. Reconcile saved research visuals after world entry, construction and ownership changes.
- Verify native projectiles, combat/effect controls, ordinary browser saving/fresh reload, and automatic composed-content import at the normal root game. Keep the original save-profile identity and prior collections.
- Distribute the engine and source-bound resources through immutable GitHub assets. Retain the qualified renderer and archive prior performance measurements under their original engine; no new performance benchmark is claimed.

## Additional community mechanics — private work, October17,2026

- Verify actual Ice Lance and Arcane Note projectiles, Dancer Flourish and Deflect, Resonance/Crescendo, and undead healing restrictions through the original engine.
- Reconcile the creator's research visual callbacks after Old-edition world entry, construction and ownership changes, preserving original saved ledgers and native overlay exit animations.
- Verify Frost Armor freeze refresh, building rejection and native expiry. Preserve all saves and profiles while removing another504MiB of obsolete owned test executables and caches.
- Advanced Phantom and final browser checks still precede public activation.

## Phantom icons and mechanics checks — private work, October 17, 2026

- Give Phantom spell rows icons derived from the creator's frost artwork, using native list geometry and hover descriptions. Verify native/browser Ice Lance and the Troubadour/Spellsinger panels.
- Verify actual creator effect application, non-stacking refresh, expiry and restoration for Eternal Soul, Chill, Gravechill, Valor and Countermelody in an isolated original-engine component trial. Check Chronicles wrapper results and hiring state controls.
- Preserve original gameplay bytecode and player progress; ordinary combat/shopping and remaining lifecycle checks still precede deployment.

## Community ability UI — private work, October 17, 2026

- Render source-authored ability and enchantment labels, icons and hover descriptions through the original native hero lists. Verify the Dancer panel in native and browser builds.
- Retain production's fixed shared-memory views in private browser bundles, correcting empty test saves without changing WASM. Verify an ordinary save and a fresh-profile browser reload with all five community hero types alive.
- Recover 2.7 GiB by removing obsolete owned build caches and test executables. Preserve all player saves, profiles, backups, original game inputs and releases. Advanced guild mechanics remain under verification; production content is unchanged.

## Community guild integration — private work, October 16, 2026

- Verify paid Bards Hall and Phantoms Haunt upgrades through level3, then save and freshly reload a kingdom containing their four authentic heroes alongside a living Alchemist and completed Lab.
- Preserve native Palace icon frames. Implement the creator's temporary movement modifiers and original spell-caster tracking; verify a controlled March speed increase and expiry through the original engine.
- Link a private browser core against the production runtime objects. Browser gameplay remains unqualified: the initial import stopped at the host disk limit. These guilds are not activated in the public build.

## Original Vampiric Revenge demo — October 15, 2026

- Expose Cyberlore's original demo quest through an unused native campaign slot, with its original map, briefing, objectives, events and building restrictions.
- Retain stock missions, the Alchemist pack, existing player profiles and prior game-data collections. Reuse the native bonus medallion with its hover animation and transparent map edges.
- Verify browser selection, world creation, an ordinary save, fresh-runtime reload and continued play into Day2. A complete victory playthrough has not been repeated.

## Faster kingdom scrolling and memory copies — October 15, 2026

- Find exact changed-row edges without scanning the unused interior; batch safe REP MOVS copies while preserving x86 overlap, flags, dirty bounds and watchpoints.
- In a matched 1080p kingdom sample, reduce the 95th-percentile display gap from 34.25 to 18.73 ms and pauses over 50 ms from ten to two. Preserve native cards, resolution, simulation and ordinary save/reload; no general crash fix or overall resource reduction is claimed.
- Apply lessons from Qwasm, D3Wasm and wipEout. Exclude the growable-memory-view experiment after its owned browser reached the existing resource guard.

## Smoother CPU-rendered kingdoms — October 15, 2026

- Publish the complete native CPU image without also building redundant per-pixel replay records. Preserve resolution, native UI, simulation, profiles and saves; retain exact GPU/texture recording and device transitions.
- In the matched large-kingdom scrolling sample, reduce the longest display gap from 67 to 36 ms and remove six brief hitches over 50 ms. This is a bounded sample, not a guarantee for every mission.
- Verify original saving/reloading, building cards, larger-view scrolling, native Options and resuming play. Enable the new path only with its qualified engine.

## Exact SIMD change masks — October 15, 2026

- Batch exact 16-bit changed-pixel mask generation with WASM SIMD, preserving native recording, simulation and save behavior. Skip redundant dynamic setting lookups for writes without a GPU surface.
- Pass native/WASM pixel checks, DirectDraw and host regressions, plus ordinary browser saving and fresh-profile reload of a 111-building kingdom.
- Short matched camera-motion samples improve from 50.31 to 57.13 fresh FPS at 800×633 and 35.00 to 43.33 at 1280×633. Wider views remain below 60 FPS; no general crash fix is claimed.

## Reuse synchronized primary pixels — October 15, 2026

- Reuse the current DirectDraw pixel baseline during synchronous presentation after a recorded primary write, avoiding a second full-surface scan. Independent presents still discover later retained-pointer writes.
- Preserve frame storage, simulation and saves. Pass 182,820 DirectDraw checks and a 111-building browser world/save/reload trial.
- The matched short sample remains about 21 fresh frames/s, with no meaningful CPU reduction established; this is not a claim that large-kingdom lag or recurring crashes are fixed.

## Wide SIMD pixel comparisons — October 15, 2026

- Compare long pixel rows in four-vector batches while preserving early mismatches, exact bounds and the existing frame storage. Retain the original simulation, graphics and save format.
- Pass 3,676,361 native and WASM kernel checks; the explicit WASM helper benchmark takes about 40% less time. This is not a whole-game FPS claim.
- Add a private source-only 111-building/41-hero stress fixture and hash-bound save inspector. Keep the unsuccessful CPU-band recorder experiment out of production.

## Instant level-1000 cheat — October 15, 2026

- Replace repeated 32-level script batches with one native stat calculation and one final level update per hero. Observe new recruits and stop scanning completed heroes every frame.
- Preserve normal health rolls, primary growth, skill caps, range and class counters; retain the original Gnome transition. Keep the single-player, ownership and living-hero restrictions.

## Browser mission rendering — October 15, 2026

- Expand and upload the final DirectDraw primary image once per sealed frame, avoiding repeated intermediate conversions and GPU uploads. Preserve native graphics, simulation timing, content and player saves.
- Verify native presentation tests, an existing original mission comparison, ordinary save/reload and Alchemist panels. The short mission sample used about 24% less CPU and delivered 9% more fresh frames; larger Siege kingdoms and recurring random crashes remain unqualified.
- Hold out a second pixel-diff experiment because its browser sample performed worse.

## Alchemist fog of war — October 15, 2026

- Let the real community Alchemist pass the legacy sight-circle resource-ID check, so it reveals unexplored terrain using its current sight range and player ownership.
- Preserve the original hero, character card, mechanics, saved identity and exploration. Apply the fix to existing saves without replacing characters or revealing the entire map.
- Verify native old/fixed controls, browser exploration and selection, and an ordinary save/reload.

## Alchemist original-mission recruitment — October 14, 2026

- Include the official expansion helper dependencies used by the community Alchemist in its script library, fixing the original-mission exit at first recruitment or Bazaar shopping.
- Preserve the creator's gameplay, existing hero identities and saves; refresh content separately from player profiles.
- Verify Brashnard recruitment, an ordinary browser save and a fresh browser reload. Require original-campaign recruitment qualification when publishing content.

## Original Majesty cursor — October 14, 2026

- Keep the browser arrow hidden when SDL updates its inline canvas cursor style, preventing a second cursor over the game.

- Enable the original software cursor in the browser, preserving its artwork, animation, hotspot and contextual states. Hide the browser arrow over the ready game canvas.

## Alchemist map selection — October 14, 2026

- Allow the community Alchemist to pass the original map selection and hover predicates. Its ALC1 identity previously matched a legacy exclusion for effect actors.
- Preserve the real identity before character-card dispatch, after each map callback and in saved games. Keep stock selection and native card panels.
- Verify direct selection of both Alchemists natively, then direct browser selection, Stats and an ordinary Day13 save/reload with no temporary identity in the save.

## Private Alchemist research adapter — October 14, 2026

- Check the original building identity when submitting research, allowing player zero's single-player Laboratory to reach native validation. Preserve original construction, health and gold checks.
- Add focused controls for player zero, missing identities and missing command owners. Browser research and the remaining alchemy mechanics still require qualification before release.
- Preserve the original recruitment order when queued research reaches native dispatch before the next simulation update, preventing a completed research command from being restored as recruitment.

## Community Alchemist development — October 13, 2026

- Credit Phantomstar721 for Alchemist Lab and Majesty Mod Manager; record Mike's confirmation of creator permission for original mod media distribution.
- Preserve the authentic community source, package bindings and original mechanics while preparing legacy descriptions and native name registration.
- Add native Laboratory/Brewing ownership and authored reagent-display adapters, with original MMCR parsing and focused lifecycle/quantity tests. Research and sovereign controls remain unfinished.
- The adapters pass focused native fixtures but remain uninstalled. Alchemist Lab is not yet playable or released; production remains the original game.

## Retire Lost Trail — October 13, 2026

- Remove Lost Trail, Wayfinders and Trail Lodges from the live root game and setup catalog. Retired edition links mount original game data; cached custom packs are no longer selected or updated.
- Preserve player profiles, saves, the original game collection and archived content/source releases. Cancel Lost Trail narration work.
- Record a pinned community-content review of Alchemist Lab, Phantoms Haunt and Bards Hall, including their runtime and asset requirements. No unqualified community content is published.

## Lost Trail native map hover — October 13, 2026

- Restore warm gold background lighting when the native map marker is hovered. Keep the normal landmark unchanged and preserve map texture, coastline, transparent borders and native selection controls.
- Upgrade both earlier map-art versions in the cache without changing player profiles or saves.

## Trail Lodge native UI icon — October 13, 2026

- Give the Palace building-list Lodge icon the same 25×25 beveled native frame and dark inset as stock building emblems. Preserve world sprites, hero art, animations and gameplay.
- Upgrade the cached artwork atlas without changing saves or reimporting the game. Record native UI consistency requirements in AGENTS.md for future UI additions.

## Original Lost Trail campaign landmark — October 13, 2026

- Replace the duplicated rectangular peninsula with original transparent lodge, pine-tree and trail art placed on the existing eastern peninsula. The coastline, sea texture and map grid remain continuous.
- Upgrade the one cached map artwork resource before launch, without reimporting the game or changing profiles, saves, mission controls or gameplay. Preserve customized artwork and verify downloads before atomic replacement.
- Qualified in a muted, bounded browser: native selector, Lost Trail briefing/objectives and original world entry. The playable terrain and other briefing illustrations remain inherited prototypes.

## GitHub asset distribution

- Move live game, engine, loading artwork and content resources into the public
  Majesty repository's asset branch. Pin downloads to immutable Git commits.
- Stream seventeen small parts into the unchanged original ZIP, verifying
  each part and the full archive before import. Keep cached games and saves.
- Download the large game payload directly from GitHub instead of Vercel Blob.

## Lost Trail browser content

- Add The Lost Trail to the normal native quest selector, with Wayfinder heroes
  and Trail Lodge buildings. Native ordinary victory and completion persistence
  passed; browser selection, world entry and original save/reload passed on the
  unchanged WASM598 engine.
- Prepare twelve source-bound patches under 1 MiB from the qualified native
  resources. Keep the original game collection, stock quests and existing
  profile paths; managed co-op/frontier worlds keep their original data.
- Root startup continues directly into the game. New terrain and mission art
  remain unfinished: this mission uses Fertile Plain geometry and borrowed art.

## Private Lost Trail mission qualification

- Count the kingdom's completed Lodges and living Wayfinders across the whole
  map, including heroes resting inside buildings. Recompile through the
  original SDK and preserve the mission identity and existing saved world.
- Add a bounded read-only save inspector for original HP, completion, ownership,
  hidden/inside actors and the Lost Trail victory flag. The mission remains a
  private candidate pending combat, victory and completion persistence checks.

## Single-player cheat codes

- Add `infinite gold` and `level 1000` to Majesty's original Enter-key cheat input.
  Re-enter a code to disable its automatic effect. Hero levels use the original
  progression script in bounded batches and include future recruits.
- Keep original cheats intact; automatic effects reset when leaving the quest
  and refuse joined multiplayer sessions.

## Native home-screen startup

- Remove the experimental menu capture, click queue and embedded player.
- Keep early engine preloads and preparation of only the selected edition.
- Cache immutable return-address lookups in the engine. Alternating browser
  trials reached the actual native menu in 7.0 seconds versus 8.5 seconds,
  an approximately 18% improvement with cached game data.

## Private SDK mission authoring

- Verify The Lost Trail GPL compilation with the original compiler.
- Stage the original RGS editor with pinned private MFC runtime dependencies and
  export an initial Northern Expansion template with a starter-town unit pattern.
- Preserve and repackage the matching SDK project/template for authoring resume.
  Terrain, enemy placement and playable mission integration remain unfinished.

## Faster home menu

- Cache unchanged solo game-file hashes to avoid rereading the whole installation
  on every launch. Multiplayer and managed-world checks still hash current bytes.
- Use native WASM exception/nonlocal-return support and replace per-import
  formatted call-name copies with bounded string copies.
- Local returning-player menu startup fell from about 16 seconds to 7.7–8 seconds.
  First visits still require downloading and verifying game data.

## Hosted browser startup

- Deploy the verified static engine/frontend to Vercel and attach
  `majesty.boland.co`; Cloudflare DNS remains the domain activation step.
- Automatically download/cache the asset bundle and enter the native game on
  the first visit; reuse the cached copy on returning visits. `/?setup=1` keeps file management accessible.
- Supply isolation headers and serve a compressed, checksum-verified WASM
  artifact. Game assets are served from Vercel Blob; player saves remain local.


## In development: Wayfinder browser content edition

- Add reproducible packaging for the gameplay-qualified Wayfinder and Trail Lodge
  resources, retaining the original game ZIP.
- Stage a separate launcher entry and import namespace; edition saves use a
  dedicated Majesty profile included by existing player backups. Changed packs,
  busy profiles and unrelated existing kingdoms are refused before startup.
- Browser installation and release publication remain under verification.

## Local release 139: shared co-op pause and reconnect

- Player 2 observes the game's shared pause and can close its engine through
  “Close game and request resume invitation.” The reconnect page explains how
  to join the host's fresh invitation with the same local profile. The host
  continues to own checkpoint creation and region travel.
- Publish the update at `/releases/player 139/` with Wardens and the existing
  campaign. The default launcher and earlier releases stay available.
- Fresh restored co-op trial 138 verifies both native kingdoms, matching pause
  frame 418/clock 2272100, committed recovery revision 12, guest reconnect and host
  resume preparation. Its backup preserves 42 earlier resume copies and all 20
  campaign databases. All owned engines and the muted test browser are closed.
- The optimized engine is 7.75 percent smaller than compact 121. It retains
  assertions and optimizer validation, and preloads four pthread workers.
  Additional live threads can still create workers. The bounded trial peaks
  at 2636.9 MiB with owned-profile extensions/background activity disabled.
  Another engine trial crossed the memory guard; longer-session stability and
  the historical host-app crashes remain unresolved.
- Verification includes 34 frontend tests,24 build-policy checks,22 publication
  checks,8 cleanup-policy checks and the official native pause fixture. All
  six release routes serve the qualified files. Chapter 3 full victory, internet
  full-match play and new compiled hero/building types remain unfinished.

## Local release096: Wardens of the Pact

- Offer the fourth co-op construction mission at `/releases/player096/`,
  keeping the default launcher and all nine older releases unchanged.
  Both players completed the mission, acknowledged the original victory
  dialogs and saved Chapter 4 completion in their separate profiles.
- Include the native Chapter 4 checkpoint resume fix. Both roles resumed
  the same saved map; complete backups preserve earlier native saves and
  other profile databases. Post-victory native resume and a fresh-profile
  restore UI remain unverified.
- Release checks passed: 63 frontend tests, 10 publication tests and the
  previously verified 31 native resume-policy checks. All six release routes
  serve successfully. The versioned release entry has not been browser-launched.
- Keep all owned browser tests muted. An original Chapter 3 paired loading
  trial stopped at its memory ceiling; the original revision 7 backup remains
  unchanged. Sustained resource bounds and the historical app crash remain open.

## In development: new hero and recruitment building

- Fix the native checkpoint resume policy rejecting Chapter 4 even though
  the frontend already offers Wardens. Host and guest resume checks pass for
  Chapters 1–4; unsupported chapters remain rejected. The private WASM build
  passes; both players load Wardens, save a shared checkpoint and complete
  the mission. The fix is included in local release096.
- Check the Wayfinder draft's direct script dependencies against both SDK
  datasets and preserve separate authoring revisions. Eight focused checks
  pass; the new hero/building pair is not yet compiled or playable.
- Add Wardens of the Pact to the private browser campaign candidate: each kingdom needs a completed living Warriors Guild and Temple to Dauros and25000gold. Show actual per-kingdom construction/gold observations without declaring victory locally.
- Carry Chapter4 through invitations, world navigation, checkpoint resumes, per-profile progress and full player backups. Preserve earlier chapter records and immutable releases.
-98focused JavaScript checks passed during authoring. New recruitable hero and building types remain to implement on the pinned1.5.1.2 engine.


## Unreleased

- Release078 fixes "Invalid Atlas record" during player-backup export after
  native region travel. Atlas journey recovery is bounded JSON text, whereas
  the previous validator accepted only region/camera objects. Backups now
  preserve and validate that text against its world through the shared travel
  validator. Pending/arrived records, malformed metadata rejection, native
  bytes, chapter progress and Atlas data pass 27 focused checks and an isolated
  browser storage roundtrip. The engine and existing saves are unchanged.

- Release077 fixes disabled co-op host checkpoint controls when the original
  lobby accepts an empty room name. The native Created/Joined observation
  determines the role; guests remain read-only. An actual two-player test
  loaded the native 7 Days save, committed a managed checkpoint, closed both
  games, resumed both kingdoms and committed a later revision. Both kingdoms
  built, researched and upgraded markets through normal play on release076.
  86 focused checks pass; the engine is unchanged. Chapter 3 victory remains
  unfinished.
  The published release also resumed the pair over public WSS and committed
  revision 3 before both engines and the temporary public relay were closed.
  This tests two clients on one Mac, rather than separate-household play.

- Candidate076 shows each co-op kingdom’s reported treasury and remaining
  objective gold. Reaching the displayed target waits for the original shared
  victory before recording completion. It rejects inconsistent observations
  and stops updating after disconnect. Published locally as release076 with
  the unchanged engine.
  Multiplayer setup’s Campaign progress link now retains the selected local
  profile and world instead of accidentally opening Default. Focused checks
  and actual paired Chapter2 victory/persisted completion pass.
  A ninth shared-world resume now fits a metadata-only budget of 64 copies and
  64 MiB; older immutable copies and committed slots are preserved. Actual
  Chapter 3 saved-copy preparation, paired original checkpoint admission and
  82 focused checks pass, plus four publication checks. All six local entry
  routes and nine changed modules pass HTTP/hash verification. Chapter 3
  completion and the newly published entry’s browser trial remain unfinished.

- Frontend075 separates saved campaign progress and the next-chapter link into
  clear rows, fixing missed clicks when the link wrapped across lines. Actual
  public-WSS co-op verifies Chapter1 victory, independent persisted progress,
  next-chapter clicks, a fresh Chapter2 party and its committed save while
  preserving the earlier world.56 focused checks pass; engine unchanged.

- Frontend074 adds self-hosted HTTPS/WSS hosting with a same-origin room relay
  and checkpoint recovery after a disconnect. A real two-browser public-relay
  trial restored, played, saved, closed, rejoined from the newer checkpoint and
  saved again. The guest gets a fresh-invitation recovery page. Hosting proxy
  checks and 84 focused checks pass; the engine and original profiles are
  preserved. Separate-household play and a permanent deployment remain open.

- Candidate073 qualifies expanding co-op save → close both games → reopen and
  rejoin → continue through the original saved-game readers. Both kingdoms
  restore at the saved clock; continued play commits the next checkpoint. A
  complete portable backup also loads and continues in the source-qualified
  native engine with a real browser partner. Browser launches are authorized
  again under bounded testing. The verified local versioned release073 is published; independent internet
  play and sustained resource bounds remain open.

- Native438/host146 executes the committed fresh-region load, Loaded and
  original resume using unchanged recorded recipient votes. Strict full-world
  comparison exposes an uninitialized original GPL agent save field; equality
  and live paired gameplay remain unqualified. Published player unchanged.

- Native437/guest141 now saves and independently verifies both kingdoms in the
  committed fresh neighbor, preserved generation settings and all129 shared-edge
  heights. Private WASM068 passes static checks. Host load/shared resume and
  browser publication remain unfinished; the published player is unchanged.

- Preserve the agreed source checkpoint during cooperative travel proposals.
  The original host now publishes its source, proposes the east neighbor and
  sends its own Ready vote without a delayed pause-save replacing that source.
  Native436/host136 and 21 evidence controls pass; private WASM067 compiles and
  passes static checks. Original guest137 executes its own Ready, committed
  neighbor generation/rebuild and Loaded using the captured real host messages.
  It waits without host Loaded/resume; full target comparison and shared resume
  remain unfinished. The published player is unchanged.

- Queue cooperative travel pause requests at the original prepared input
  boundary. The native production pause action now settles and saves both
  kingdoms at clock550. Release preceding saved player-name strings before
  shared reads under the same paused-party guard; actual shared read/resume
  remains unqualified. Five-visit saved-load regression passes all four saved
  comparisons. Private WASM058 compiles/static/packages; served player unchanged.

- Initialize multiplayer startup timing from the original configured frame
  interval, preventing uninitialized data in world-start messages. A strict
  recorded-peer check now starts both original native roles, preserves both
  kingdoms and completes ten ticks per role. Full save differences remain
  recorded. Private WASM057 compiles, passes static checks and packages without
  a browser launch; live synchronization and shared resume remain unqualified. See
  docs/native-cooperative-initialization.md.

- Restore each saved region's owning scenario configuration through the
  original game copy routine. A previous multiplayer world could suppress
  that original load step and change a returning solo neighbor's settings.
  The neighbor and both subsequent two-kingdom home returns now match their
  saved data in native tests; the solo regression passes all four comparisons.
  Private WASM056 builds and passes static checks. Shared gameplay remains
  unqualified and the served player is unchanged.

- Preserve blank local profile identity when importing a valid multiplayer
  name vector, and release appended saved-name strings before region loads.
  Actual co-op saves contain both playable castles and building/script data.
  Native saved returns preserve both home kingdoms; the established solo
  regression passes four exact comparisons over five visits. Native396's
  co-op-derived fixture exposed the scenario header issue repaired above;
  paired gameplay remains unqualified.

- Fix saved-region UI restoration aborting on an unused fourth hook slot.
  Track the three installed hooks. A native saved-world fixture now resumes
  through actual prepared input and ordinary transmission/dispatch; five
  region visits and four matching saved-load comparisons pass. Private
  WASM052 builds and passes static inspection; paired co-op remains unverified.

- Retire old-region network command buffers before fresh and saved cooperative
  travel rebuilds, while preserving the paused party and provider state.
  Keep valid empty reference counters for the next frame preparation. Eight
  component cycles return heap use to baseline; the focused native suite
  passes 26,558 checks. Private candidate051 builds and passes static inspection.
  Paired travel and whole-browser memory use still require verification.

- Extend original co-op resume-command verification through the prepared
  transmitter and per-player receive ring. Twelve component cycles deliver
  and dispatch the command once, free its packet/reference once, and return
  component heap usage to baseline. The focused suite passes20,142 checks.
  This adds no runtime publication or paired-gameplay qualification.

- Requalify the current native web transport through public TLS WebSockets.
  Sequential host/join tests pass415 assertions for checkpoint delivery,
  barrier agreement, cancellation and ordinary packets against the production
  relay with a reference peer. All152 frozen inputs match current sources;
  owned test processes stop cleanly. This does not qualify paired gameplay.

- Refuse cooperative region travel in the original replay mode before pausing
  or saving. Its transmitter can leave the resume packet queued at a rebuilt
  frame of zero. Live travel admission accepts modes1/3, and the controls
  explain replay refusal. The original component suite passes18,503 checks;
  all10 travel-control tests pass. Private candidate050 builds and passes
  static inspection; paired shared resume and saved return remain unverified.

- Recover the source region after a cooperative proposal is canceled before
  load is committed, or a neighboring save is unavailable before a proposal.
  Resume uses the original prepared input/secondary queue and checks the exact
  source roots, paused clock, roster, profile and match generation. Travel
  controls wait for the matching source resume instead of staying disabled.
  Target load permission remains separate; changed or committed agreements
  refuse source recovery. Focused controls/relay/native checks pass; actual
  paired cancellation recovery remains unqualified.

- Preserve the live cooperative startup mode across saved return, alongside
  player IDs, names and local kingdom selection. The reader's temporary mode1
  no longer replaces the retained multiplayer selector. Both players and both
  startup selectors are covered by the focused native suite:18,202 checks,
  0 failures. Candidate047 builds, passes static inspection and is packaged
  privately; actual paired saved return remains unqualified.

- Retain each participant's source checkpoint before Ready for saved-region
  travel as well as fresh-region travel. Saved return now uses the original
  source interface/world teardown, holds the exact cooperative pause, then
  prepares the saved-load flag and resets GPL before the original reader.
  The freed source address may be reused for the restored graph. Private
  candidate046 builds and passes static inspection. The original GPL reset,
  pause/resume and geometry suite passes18,174 checks; actual paired saved
  return and browser resource residency remain unqualified.

- Correct private cooperative region initialization and resume timing.
  Fresh regions now run the original InitializeGpl setup; paired run043
  created both kingdoms' agents and reached the shared Loaded barrier.
  Resume now enters the original input step after outgoing queue preparation.
  The original queue/dispatcher suite passes17,608 checks with0 failures.
  Private candidate045 builds and passes static inspection; actual shared
  resume, saved return and repeated co-op residency remain unqualified.

- Preserve saved cooperative worlds when starting another fresh match with
  the same world name. Refuse travel before pausing and refuse capture before
  serialization unless the region is unvisited or belongs to the admitted
  live session. Interrupted save artifacts also refuse. Show a saved-progress
  explanation in the private travel controls. Checkpoint tests pass1,649
  checks; all33 related JavaScript tests pass. Candidate045 is packaged
  privately; candidate045 also clears stale live-world ownership when a new
  campaign starts in the same room. The published player remains candidate028.

- Add private co-op travel controls and shared-world invitations. Only the
  native room host can request travel; action polling consumes the request
  once and keeps controls disabled until shared resume. Idle polling performs
  no DOM writes. Partners receive the same world rules with separate local
  profiles.32 focused controls, invitation and profile checks pass.
  Browser035 generates the same connected neighbor on both players after
  retaining source saves, but shared arrival and saved return remain
  unfinished. These changes are not published in candidate028.

- Add a private opt-in initial co-op terrain adapter using the original network
  freestyle constructor, shared coordinates/seed, exact provider roster and
  connected128-cell geometry. Native382 constructs the0_0 region with two
  configured players; this is one original host plus a worldless reference.
  Fresh neighboring-region travel remains unfinished and this adapter is not
  published in candidate028.

- Preserve queued Shift state for keyboard translation. A quick browser
  Shift+1 chord now enters `!` instead of `1`, and the host emits one character
  per key. The actual gate passes455 checks (six failures before this fix),
  and runtime passes2262 checks with0 failures and3 existing skips. Private
  candidate028 reproduces and fixes the original dialog behavior. Its
  multiplayer profile lease rejects a second local writer before game startup.
  Candidate028 is published locally after those browser checks, with the old
  site preserved and no server restart or user-profile edits.

- Recover an unchanged cooperative source after a destination is unavailable
  before Begin: recheck the exact party, pause boundary, source checkpoint and
  unchanged terminal agreement, then queue the original resume command.
  Prepared/Committed or changed state refuses recovery. The1212 transition
  policy checks and10945 original pause/queue checks pass. Private WASM027
  compiles the final adapter; its isolated launcher passes7 profile checks.
  Actual co-op recovery and fresh region generation remain unqualified; no
  browser game runs or live engine publication occurs.

- Protect a selected local multiplayer profile with an exclusive Web Lock
  before hashing, GPU setup or native injection. Separate participant profiles
  remain independent; later URL edits cannot redirect the leased save path.
  Preserve ownership after injected-engine failures, and refuse mixed solo
  region settings. All79 related source checks pass; the isolated package
  passes7 profile checks. Existing live pages and unflagged solo startup do
  not acquire this new lease. The served player remains unchanged.

- Reduce generated expanding-map preview drawing calls by batching equal
  ground tiles in rows and forest paths per region, and culling offscreen
  towers. Identical 1920x1080 terrain uses1129 fills instead of10200.
  Preserve tile colours, forest circles and clipped buildings without caches
  or additional DOM. All65 source and isolated-stage checks pass;39 checks
  pass against the two locally published preview modules. Browser FPS and
  whole-app memory are unmeasured; the live game engine remains unchanged.

- Stop duplicate keyboard characters in normal guest message loops. The host
  now posts key transitions; USER32 TranslateMessage owns character generation,
  including US ASCII punctuation, shifted digits, keypad and editing keys.
  The actual gate regression reproduces three failures before the fix. A new
  headless input target passes342 checks; the official runtime target passes
  2258 checks with0 failures and3 existing skips. Private WASM candidate026
  and native381 compile the fix; one original native lobby verifies scripted
  Shift+1 punctuation. The served engine is unchanged and browser testing
  remains suspended.

- Preserve a completed browser Chapter 1 co-op match: both original victory
  screens and both real shared-victory callbacks, with completion saved in
  separate profiles. The 180-second observation deadline was exceeded;
  checksum capture, separate internet connections and total browser resource
  bounds remain unqualified. Latest workspace instructions suspend further
  game launches while the app crash remains unresolved.

- Refresh the current checkpoint when selecting an already displayed saved
  kingdom. Refuse damaged saves without replacing the complete map or claiming
  selection succeeded. Keep ordinary dragging on the existing read-free pan
  path. Both regressions reproduce before the fix; all69 focused tests pass
  afterwards. Two genuine original saves also verify updated unit markers,
  corrupt-read preservation and100 read-free pans. Source only; no browser
  launch or served-game update.

- Verify eight saved-world transfers through both the browser API and actual
  UI controller using original native saves and importer evidence. The controlled
  DOM retains21 elements and one game lease, updates arrival bindings, preserves
  seven dormant kingdoms and restores the final published owner read-only.
  These copied-file Node replays do not qualify live browser/OPFS resources or
  multiplayer regional travel. No served-game update or browser launch occurs.

- Verify eight successive saved-kingdom crossings in one original native
  engine, completing four out-and-back trips and ownership revision33.
  Independent inspection checks32 exact imported reader records, saved movement,
  source retirement, reused pure homes, terrain and seven untouched dormant
  kingdoms. All64 tracked world roots release; peak combined native RSS201.8MiB.
  Native-only test snapshots now use unique trip names and copied-file receipt
  mailboxes update atomically. Browser execution and sustained browser resources
  remain unverified.

- Exercise repeated original-engine travel between saved remote kingdoms.
  The first complete out-and-back native test preserves both pure home records,
  imports fresh hero aliases, resumes original movement and selects custody at
  revision21. Independent saved-record inspection passes for both trips, with
  seven other dormant worlds unchanged. Peak combined native RSS198.3MiB.
  A longer test exposes a reused immutable test snapshot name; native-only
  snapshots now carry trip suffixes. Browser/co-op resource claims remain open.

- Verify an original-engine return to a previously saved remote kingdom.
  Restore the selected dormant checkpoint, reuse its pure guild reference,
  import/activate the hero with fresh IDs and publish the saved pair at
  revision19 before resuming six original ticks. Independent inspection checks
  all four imported records,528 retained actor records, saved movement, terrain
  and seven unchanged dormant entries. Native test005 exits0 at203.4MiB peak
  combined RSS. This remains native copied-fixture evidence; browser execution,
  sustained memory, co-op world travel and full matches remain unverified.

- Package private WASM candidate025 with the current remote-owner restart fix.
  Static restore/co-op/travel linkage checks pass; all63 browser sources match
  eight-transfer controls replay022 and49 shared inputs match both native375
  restore cases. No browser launch or served-game update occurred.

- Restore progressed remote heroes after their route finishes. Compare the
  original engine's three-bank empty/nonempty query with factory ORDR membership
  instead of requiring an order attachment for every live hero. Publish the real
  held18000 checkpoint into a copied journal at revision17, preserve all eight
  dormant regions, then reload and save36100 through the original engine.
  Independent inspection verifies the original IDs, one queued hero, exact proxy,
  height words and completed empty route. This remains native copied-fixture
  evidence; browser persistence, co-op travel and full matches remain unfinished.

- Resume a saved remote hero owner using its original checkpoint-loaded
  actor and pure guild proxy. Accept the prepared proxy binding, retain original
  native/script IDs and scheduling, and expose source-verified halo geometry
  during view construction. Native restore010 advances from100 to18000,
  dispatches the original AI callback and saves; independent inspection checks
  movement, ownership links, the exact proxy and all16641 terrain heights.
  Peak native RSS170.9MiB. The copied developer fixture records its current
  executable checkpoint label; live browser play and content migration remain
  unverified. Original saves and served artifacts remain unchanged.

- Extend the native expansion trial to eight generated regions. Independent
  inspection verifies original imports/orders/gameplay, source retirement,
  eight world-root releases per departure and all dormant saves at revision16.
  The eight-region supervisor report exceeds its old256KiB metadata limit after
  both producers exit0; preserve the original evidence and recover completion
  read-only. Keep a fixed512KiB limit for this aggregate. Peak native/worker
  RSS252.7MiB; final post-unload guest heap grows2258160B, so no plateau is claimed.
  Eight-transfer browser API/controls replays retain21 panel elements and prepare
  restart read-only. These are controlled replays; live browser resources and
  multiplayer regional travel remain unverified. Served artifacts are unchanged.

- Before an apparent hero crossing, keep original gameplay running when its
  absolute Path4 goal cannot fit the neighboring kingdom. Preserve an active
  Move2 leaf alongside Path4/Queue7 when importing into a remote region, using
  the existing original bank reader. Build364/native073 and independent
  inspection011 complete six new-region arrivals, retain every dormant kingdom
  and verify all imported order bytes. That run carries only Path4/Queue7 at
  its boundaries. Build368 separately replays the exact stopped three-command
  case through import, activation, original movement and its delayed callback
  without replacing the route. Keep the foreign guild task pending when an
  admitted original movement leg exists. Independent replay inspection checks
  imported records, scheduling and saved movement; original custody is unchanged.
  Six-transfer API/controls replays018/019 preserve all dormant
  worlds and read-only revision12 restart with a21-element panel. Private WASM
  candidate023 builds and packages the current guard fix; static checkpoint/
  generation checks and all63 browser/49 shared native source comparisons pass.
  Live browser play remains unverified, and served artifacts are unchanged.

- Restore a visited remote kingdom from the hero journal before preparing its
  return, just as for the original home. Preserve the earlier native departure
  slot, reuse the saved guild proxy and reject a different dormant checkpoint.
- When a crossing save succeeds but neighbor preparation fails, acknowledge
  the capture as saved before resuming so the original native owner can refresh.
  The focused save, route, controller and navigation suites pass143 checks.
  Actual native071 backtracking replay004 restores the original retired world
  and proxy62, but its out-of-region original order still refuses migration;
  this does not qualify a fifth arrival or continuous expansion.

- Reserve the incoming hero's original clearance footprint while generating
  a fresh kingdom. Placement searches retain original collisions, and the
  original optional-ground loop skips overlapping scenery before construction
  through its existing null-result branch. Remove the temporary guards before
  home/import/activation; saved kingdoms still enforce normal arrival refusal.
  Build361/native070 and independent inspection010 pass four consecutive new
  arrivals, continued original gameplay, custody and all eight source-root
  releases. Isolated generation018 verifies three omitted ground tiles and
  unchanged shared halo heights. Six-region travel, browser execution and
  sustained browser memory remain unverified; the served WASM is unchanged.

- Preserve captured recovery when the original collision query rejects an
  incoming hero. Stop the unpublished arrival before postload/drawing/scheduling,
  notify the browser travel controls and pace the failed engine state instead
  of asserting on an ordinary collision rejection. Native066 reproduces this
  fourth-region refusal without an engine abort; independent inspection checks
  source custody and no target ownership/hero scheduling. Native070 later
  qualifies a fourth fresh arrival with the entry reservation above; live
  WASM verification remains unfinished.

- Build and package a current private WASM candidate with fresh-region travel.
  Guard the native-only qualification tick counter in shared initialization;
  original game ticks and shared initialization accounting are unchanged.
  Official web build020 and static artifact checks pass. The private launcher
  packages124 files and records183 inputs; all63 browser source files match the
  three-transfer controller replay. No served files/profiles or toolkit/generated
  game code changed. Live WASM travel and sustained browser resources remain
  unqualified; browser launch suspension stays in force.

- Replay all three native062 fresh-kingdom transfers through the current browser
  APIs and actual travel-control source, accepting the safe150ms initialization
  and matching all original importer capsules. Preserve all three dormant
  kingdoms; prepare final revision6 restart without writes; refuse restarting
  in each departed region. The controlled panel remains21 elements and accepts
  save serial4. The earlier two-journey archive still passes. These source/DOM/
  filesystem replays do not establish live WASM or sustained browser resources.

- Complete three successive native fresh-region hero transfers, retaining
  all three departed kingdoms and releasing eight tracked roots per departure.
  Choose a bounded original initialization duration from captured GPL timers
  to avoid creating zero-stamp sentinels; the browser independently verifies
  the duration. Native062/independent008 pass, including all12 original context
  fields and ages. Peak combined RSS254.2MiB; sustained memory remains unverified.
  Existing two-journey browser-source replays and focused scheduling/save tests
  pass. No browser/WASM build, staging or launch; crash suspension remains.

- Verify two successive fresh-kingdom journeys through the current browser
  APIs and actual travel-control source using native060's unchanged game saves.
  Both capsules match the original importer inputs. The controller updates
  URLs/bindings, retains21 panel elements, preserves both dormant kingdoms and
  accepts save serial3. Final-owner restart preparation is read-only; stale
  source restores, old generation receipts and cold checkpoints refuse.
  These are controlled DOM/filesystem replays with substituted content labels
  and publication digests. Live browser/WASM receipt consumption, rendering,
  sustained resource bounds and multiplayer qualification remain unfinished;
  no browser or native build/game launch occurred in this step.

- Verify the same hero through two newly generated original kingdoms in one
  bounded native process. Publish each retired/active pair, release all eight
  departed-world roots and retain both dormant kingdoms. Remove an out-of-map
  consumed Path prefix from arrival inputs while preserving its current/future
  route and capacity.41 focused checks,32 isolated original-code calls and an
  actual-save browser API replay pass. Build349/native060 exits normally in
  44.848s with239.5MiB peak sampled aggregate RSS. Independent saved-state,
  journal, terrain and path inspection passes. This remains a short native
  expansion trial; live browser travel, sustained bounds and multiplayer
  qualification are unfinished. Browser launches remain suspended.

- Connect the browser travel controls to fresh neighboring kingdoms. Wait for
  actual initialized generation, prepare/stage the hero under the existing game
  lock, and use paired ownership publication before resume. Preserve recovery
  on failure, add preparation retry, and buffer arrivals during input close.
  Focused checks and a real-native-save replay pass; the replay produces the
  exact original home/package inputs. Live browser/native receipt consumption,
  repeated expansion and multiplayer qualification remain unfinished. The
  browser bundle has not been rebuilt or launched; crash suspension remains.

- Complete one controlled hero arrival into an original newly generated kingdom.
  Initialize it with two normal game ticks, pause/save at clock100 and prepare
  its remote home and hero package without changing scheduling sentinels.
  Use the shared original importer and paired ownership/resume gate, then verify
  two resumed ticks and registered hero state in actual saves. Official348/native058
  exit normally; independent pair/terrain/AI queue inspection passes. Browser
  controls, repeated new-region exploration and multiplayer qualification remain
  unfinished; browser launches stay suspended.

- Verify an original fresh neighboring kingdom through a captured hero crossing.
  Official build346/native056 refuse six invalid requests, retire the source,
  release all eight world roots, generate/save the neighbor and hold clock0.
  Fix a busy paused loop found in native055 by processing the original paused
  input/frame body; native056 exits normally within31s and peaks near235MiB
  aggregate RSS. Independent snapshot/terrain/custody inspection passes.
  Hero import at clock0 correctly refuses a scheduling zero-stamp collision;
  original initialization ticks are needed before import. Browser launches stay
  suspended; continuous expansion and the full goal remain unfinished.

- Add an authenticated request for generating an unexplored hero-travel neighbor
  under the injected game's existing lease. Preserve captured ownership and all
  existing/orphaned saves; exact retries issue no writes or native action. Add
  the shared native consumer and original unload/generate/pause/checkpoint path,
  holding the new halo kingdom before gameplay or hero import.80 focused checks
  pass; official builds343/344 compile. Actual generation consumption, new-region
  import/resume and browser operation are still unverified or unfinished.

- Verify all four source travel actions through the shared consumer in one
  controlled native journey. Destination inputs are prepared before retirement;
  both returns and the second departure consume their staged ordinary actions.
  Official build342/native054 complete two round trips and the final home save.
  Independent inspection verifies12 registered snapshots, actor queue cleanup,
  fresh arrival IDs, all8 released roots and the persisted dormant neighbor.
  Destination activation still uses owned test drivers; live browser travel and
  the new profile publisher's native receipt consumption remain unverified.

- Recover an arrival retry after acknowledgement close reports failure even
  though the engine has resumed and advanced its native save. Retain a small
  same-document capability after full pair/layout verification; retry rechecks
  both selected journal snapshots and the exact existing acknowledgement,
  without another write or native rollback. Injected lease/cancellation and
  next-save behavior are covered by focused checks and four original-save
  replays with later native captures. Live browser durability and receipt
  consumption remain unverified; browser launches stay suspended.

- Connect browser travel controls to staged departure, paired arrival publication
  and the engine's confirmed resume. Preserve fresh actor IDs, serials and the
  next crossing when events arrive before publication finishes; allow arrival
  publication retry. 122 focused JavaScript checks and recorded native event
  replay pass. Fix shared retirement to use the held crossing clock. Official
  build341/native053 complete two round trips and all21 saved-world checks pass.
  Later retirements exercise the shared helper through private journey drivers;
  repeated public actions and live browser travel remain unverified. Browser
  launches stay suspended; interrupted receipt recovery remains incomplete.

- Add browser arrival ownership publication under the injected game's existing
  world lease. Authenticate the retired source and activated destination, select
  both through the journal, and write only the destination's resume receipt.
  Exact retries write nothing; cancelled or uncertain writes preserve recovery.
  Rebind to fresh hero IDs only after the engine confirms resume, revoking old
  readers while retaining the game lock.106 focused checks and all four recorded
  native arrival replays pass. Player-facing travel controls and live browser
  receipt consumption remain pending; browser game launches stay suspended.

- Connect the shared native source consumer to the staged browser travel
  request and separate named action. Authenticate the selected captured owner,
  both saved kingdoms and complete destination input before original retirement,
  recovery save and unload/load. Staging alone leaves the source held; ten
  altered requests are refused before retirement. Official build340 and native
  trial052 complete both round trips; all21 saved-world checks and88 focused
  JavaScript checks pass. The browser startup bridge supplies the verified owner
  head and refuses URL overrides. Browser controls and paired publication/resume
  coordination remain unfinished; browser game testing stays suspended.

- Add the browser's bounded source travel request under its existing game
  lease. It requires the exact successfully staged destination capability,
  rechecks ownership/native snapshots and all destination inputs, and writes
  only `Frontier_Hero_Travel_Request.json`. Retries write nothing; cancellation
  drains before ending the held save. Fresh/reused guilds and native-home
  requests pass focused checks; both original337 outward inputs reproduce
  exactly. Native action consumption and player-facing browser travel remain
  unfinished, so this request does not release the hero or kingdom.

- Use the browser transfer input for the first outward hero trip as well as
  revisits and native-home returns. Select the actual held capture before
  source retirement, refuse six invalid capture receipts, and preserve/clear
  the consumed receipt before later home saves reuse its mailbox. Official
  build337 and native trial050 complete two trips; all21 saved-world checks
  pass. Public browser travel, new-region generation and multiplayer completion
  remain unfinished. See [first outward transfer](docs/hero-native-arrival.md).

- Consume browser-staged outward hero inputs in the loaded native neighbor.
  Bind the entire remote guild record to the immutable registration, import
  and activate while paused, and retain the ownership-publication gate before
  resume. A supervised native revisit and both returns pass; first outward
  JSON consumption and end-to-end browser travel remain unfinished.

- Prepare and stage browser outward hero transfers for both reused and fresh
  remote guild references. Fresh preparation uses a bounded read-only save
  projection; staging changes only three fixed transfer input files. Both
  recorded native import packages match exactly. Native consumption of the
  outward JSON and end-to-end browser region travel remain unfinished.

- Consume browser-staged native-guild return inputs in the shared runtime after
  the destination loads. Validate both native manifests, the current journal,
  registered guild and bounded package, then import/activate while paused.
  A supervised native journey passes two returns through this contract; public
  browser retirement, loading and receipt coordination remain unfinished.

- Restore the journal-selected dormant home before browser return preparation.
  Rotate the native loader checkpoint while preserving the previous departure
  slot, reject newer or incompatible home state, and recover cancelled writes.
  Focused and recorded-save checks pass; live browser travel remains unfinished.

- Stage browser native-guild returns into two fixed destination input files.
  Recheck the paused source, selected owner and destination before publishing
  the input manifest; exact retries perform no writes. Cancellation drains
  pending writes while retaining the game lock. Native handoff consumption
  and live browser import remain unfinished.

- Share the native-guild return capsule between browser crossing preparation
  and native workers. The browser controller now prepares the four original
  actor/script/container/order records with a 256KiB total package limit.
  Recorded original-engine bytes match exactly; live browser loading and
  import remain unfinished.

- Connect browser hero return preparation to the selected dormant native guild.
  Refuse stale departure saves and mismatched kingdoms, retain the game's world
  lock, and drain cancelled reads. This prepares the return; live browser
  retirement, loading, import and resume are still unfinished.

- Publish a returned hero with its actual registered native guild instead of
  a remote proxy. Stopped tests using the real connected saves select both
  worlds atomically, reject invalid returns and recover interrupted writes;
  the outbound route still passes. Live native return acknowledgement/resume
  and browser integration remain unfinished. See
  [returned pair publication](docs/hero-native-arrival.md).

- Activate the returned hero through shared original collision/postload,
  drawing and scheduling while its home stays paused. Distinguish its native
  guild from a remote reference, preserve every record and append one AI queue
  entry. Returned-owner publication/resume and browser integration remain
  unfinished. See [native-guild return activation](docs/hero-native-arrival.md).

- Import the actual returning traveller into its original native guild through
  shared original-game readers and restore both native/script memberships.
  A connected native journey preserves its current orders, every unrelated
  record and the selected recovery journal. Home activation/publication/resume
  and browser integration remain unfinished. See
  [native guild return import](docs/hero-native-arrival.md).

- Reuse the original travel session to unload the retired eastern region and
  restore the actual saved home kingdom before gameplay. A connected native
  trial preserves its actors, guild, queues, clocks/RNG and published recovery
  while freeing the outgoing world. Home hero import/resume and browser
  integration remain unfinished. See [saved home loading](docs/hero-native-arrival.md).

- Extend original traveller removal to its active remote-home binding. Retain
  the home reference, remove its native/script/queue/order state and release
  the activation guard after the captured save is selected. A connected native
  trial verifies every remaining record and the complete saved-world changes.
  Actual home arrival and browser integration remain unfinished. See
  [remote-source retirement](docs/hero-native-arrival.md).

- Publish the resumed traveller's next original crossing capture using its
  current hero and remote-home IDs. A native run saves the second held crossing
  as journal revision3, preserves the dormant home and previous slots, refuses
  stale bindings and retries without writes. Remote-source retirement, actual
  return and browser integration remain unfinished. See
  [second held capture](docs/hero-native-arrival.md).

- Consume a held-arrival publication receipt in the original engine. Verify
  the selected metadata and both saved worlds, refuse stale receipts, and
  resume with the new hero/home IDs before the first gameplay tick. A native
  run captures the next homeward crossing after six original ticks while other
  actors progress. Second-capture publication, completed return and browser
  integration remain unfinished. See [published native resume](docs/hero-native-arrival.md).

- Add the production publication adapter for a held hero arrival. Verify its
  captured owner and both saved clocks, commit the pair and reread the new
  owner before creating a receipt bound to its fresh IDs and selected save.
  Cancelled operations return no resume receipt. Native receipt consumption
  and connected gameplay resume remain unfinished. See
  [held-publication receipt](docs/hero-native-arrival.md).

- Connect the traveller's original import and activation to source disposal
  and saved-neighbor loading in one native process. Preserve all484 actor
  records through activation and append its AI entry once while paused.
  Independent checks bind the actual crossing capture to the prepared capsule.
  Journal publication, connected resume and browser integration remain
  unfinished. See [connected arrival](docs/hero-native-arrival.md).

- Qualify atomic journal publication of the connected native handoff's actual
  retired source and activated target. Disposable journals recover at four
  interrupted write boundaries and reject duplicate ownership, absent actors
  and unscheduled arrivals. Preserve the captured recovery checkpoint and
  original enrollment. Live publication, acknowledgement and browser resume
  remain unfinished. See [connected pair publication](docs/hero-native-arrival.md).

- Connect captured-hero source retirement to original world disposal and saved
  neighbor loading in one native engine. Verify eight source allocations freed
  before target load and preserve the neighbor's gameplay state before its first
  tick. Reset owning saved metadata through original routines between loads.
  Traveller import and custody publication at this held point remain unfinished.
  See [connected travel loading](docs/hero-native-arrival.md).

- Add shared original-engine retirement for a captured selected hero. A native
  trial follows the actual crossing, retains the recovery save and removes
  only the departing hero and its guild membership. Stopped-save inspection
  verifies remaining records, queues, terrain and RNG. Connected world loading
  and browser custody publication remain unfinished. See
  [selected source retirement](docs/hero-native-arrival.md).

- Activate an imported crossing hero through original collision, drawing,
  movement and AI in an isolated native destination. A remote-home return leg
  crosses the region boundary while other kingdom AI continues, then pauses
  and releases the added runtime hooks. Connected browser travel, source
  retirement and custody publication remain unfinished. See
  [original hero activation](docs/hero-native-arrival.md).

- Add shared original-engine destination registration and outdoor hero readers.
  Isolated native tests register/reuse the exact remote guild reference, reject
  invalid requests and import the actual boundary-crossing hero with original
  reserved IDs. Independent saved-graph checks preserve480 existing records,
  terrain, RNG and queues. The connected browser handoff remains
  unfinished. See [original hero import](docs/hero-native-arrival.md).

- Prepare a captured hero's immutable guild reference for its saved neighbor
  under the current game lease. Reuse only the exact unscheduled pure proxy,
  preserve other guilds and use the original saved allocation counter for a
  new proposal. Combine preparation with neighbor inspection to avoid repeated
  terrain reads;259 checks and original-save replay pass. Native registration
  and destination arrival remain unfinished. See
  [guild preparation](docs/hero-travel-home.md).

- Connect selected-hero native pose sampling to automatic held crossing
  requests and checked source/neighbor reads. Keep the prototype paused with
  an explicit continuation control while destination activation is unfinished.
  Actual original movement now qualifies crossing capture and a save at the
  accepted clock; production publication verifies that save and its neighbor
  in a controlled filesystem replay.225 JS regression tests pass. Destination
  arrival and browser publication remain unqualified.
  See [native crossing capture](docs/hero-native-crossing.md).

- Verify optional hero travel geometry before startup checkpoint writes.
  Bind a crossing save to the current hero, exact accepted tick and serialized
  outdoor position before publishing its journal; preserve the supplied
  destination through held admission.218 focused tests and original-save
  preflight/physical-parent refusal checks pass. Native movement and the actor
  handoff remain unfinished. See [crossing saves](docs/hero-travel-boundary.md).

- Add held source/neighbor geometry admission for registered hero travel.
  Require the explicit overlapping layout, exact published native checkpoint
  and current save serial. Verify protected terrain heights in bounded rows,
  preserve interior foundation edits and orphaned saves, and drain cancelled
  reads under the game lease.209 regression tests and the original home/eastern
  save check pass. Actor retirement and destination activation remain
  unfinished. See [hero travel geometry](docs/hero-travel-layout.md).

- Connect registered hero saves to a native pause/checkpoint/resume sequence.
  Publish only the current hero journal under the injected game's exclusive
  world lease; keep native saves unchanged, reject mismatched clocks/aliases,
  drain cancelled I/O and recover uncertain acknowledgements without another
  revision. Native successful/failed acknowledgement checks and original-save
  publication pass. Browser durability and cross-region hero travel remain
  unverified. See [live hero saves](docs/hero-live-save.md).

- Bind a prepared saved hero to the original engine using its current aliases,
  exact kingdom save, clock and actual guild. Verify original native/GPL
  associations and reciprocal membership before gameplay; preserve the saved
  random seeds and UI through attachment. Refused heroes use original paused
  input so menus and exit remain available. All 309 regression tests pass;
  actual native admission and controlled refusal are qualified. Browser
  runtime and live hero crossing remain unfinished. See
  [engine hero binding](docs/hero-runtime-binding.md).

- Add Frontier controls to register one verified saved hero, publish the latest
  stopped kingdom into its journey and prepare a resume link. Preserve existing
  origins and orphan files, reject stale selections and drain cancelled work
  when leaving the map. All 264 regression tests and the original-save launcher
  check pass. An isolated launcher overlay is assembled; the served game stays
  unchanged and browser runtime use remains unverified. See
  [saved hero journey controls](docs/hero-route-launcher.md).

- Connect a stopped native gameplay checkpoint back to the registered hero
  journal, preserving the previous selected world across interrupted saves and
  avoiding duplicate publication on retry. Verify the original continued home
  save at clock 114000 through publication and subsequent startup preparation.
  All 177 regression tests and the original-data check pass; live browser save
  driving and co-op region activation remain unfinished. See
  [stopped native gameplay saves](docs/hero-route-native-save.md).

- Verify selected-owner startup against the original saved kingdom in an
  isolated test world, preserving its bytes, guild roster and saved clock.
  Remove duplicate owner validation during startup; the controlled original
  save workflow uses 291 fewer file reads. All 167 regression tests and the
  original-data projection check pass. No game or browser was launched. See
  [selected-owner startup](docs/hero-route-native-restore.md).

- Connect an opt-in selected hero owner to the original native region loader
  during staged player startup, after content verification and before GPU/WASM
  injection. Preserve the custody journal, refuse replacing a different native
  save, drain cancelled startup work under the existing world lock and consume
  bootstrap links only at region ready. All 165 focused regression tests pass;
  the served game was not rebuilt or launched. See
  [selected-owner startup](docs/hero-route-native-restore.md).

- Add a browser file-storage adapter and identity discovery for the verified
  hero custody journal. Use the named world's existing lock and one journal
  directory, preserve saved state across interrupted and uncertain writes,
  and reject a different hero/world/content identity. Focused tests and a
  read-only check against the original home/east saves pass. Live browser hero
  travel remains unfinished. See [browser custody storage](docs/hero-route-browser-storage.md).

- Release checkpoint backing files immediately when region travel is cancelled,
  including idle consumers and pending reads. Add cancellation to hero owner,
  destination and arrival reads without changing custody publication. Focused
  tests and three read-only checks against the original saved round trip pass;
  no browser game was launched. See [checkpoint read cancellation](docs/checkpoint-read-cancellation.md).

- Save both verified crossings of the native home/east/home trip through the
  paired custody journal, then reload its selected home owner through the
  original engine. Eight interruption recoveries and five zero-write refusals
  pass; reload verification matches 1,530 records and observes ten more original
  ticks. Browser travel, co-op regions and internet full matches remain
  unfinished. See [saved round-trip publication](docs/halo-region-layout.md#saved-round-trip-publication-and-selected-home-reload-298).

- Activate the returning hero and resume its original AI in the restored home
  region in the native prototype. Verification compares all 509 records at
  activation, then observes 200 original ticks with movement, guild building
  use, scheduling and reciprocal memberships intact. Paired custody saving,
  selected reload and browser qualification remain unfinished. See
  [saved home continuation](docs/halo-region-layout.md#saved-home-activation-and-original-gameplay-297).

- Import the hero's accepted saved-region return into the restored home in
  the native prototype. Original readers preserve four actor records,
  populated movement commands and both reciprocal guild memberships;
  independent checks preserve 503 unrelated home records. Home activation,
  custody publication and browser qualification remain unfinished. See
  [saved home arrival](docs/halo-region-layout.md#saved-region-return-imported-into-held-home-294).

- Complete the native prototype's saved-east retirement and second world
  unload, then restore home before its first simulation tick. Verification
  preserves all 479 remaining eastern records and passes 1,489 save/reload
  record comparisons. Home-arrival records are prepared; importing and
  activating the returning hero and publishing custody remain unfinished.
  See [saved return paging](docs/halo-region-layout.md#saved-return-retirement-and-held-home-reload-292).

- Resume a hero in a previously saved neighboring kingdom and route its
  return-home task across the next regional boundary. Native verification
  confirms original collision, drawing, scheduling and movement, with the guild
  and global destination preserved. Importing that return into home and saving
  custody remain unfinished. See [saved-region continuation](docs/halo-region-layout.md#saved-neighbor-activation-and-original-homeward-leg-291).

- Restore a traveling hero into a previously saved neighboring kingdom through
  the original engine readers. Independent checks verify all four imported
  records and 479 unchanged existing records, including the retained guild
  reference and movement commands. Gameplay activation and persistent custody
  remain unfinished. See [saved-region import](docs/halo-region-layout.md#original-import-into-a-saved-neighbor-290).

- Detect an original hero movement crossing, retire the departing actor and
  restore a previously visited kingdom at its saved clock in the native
  prototype. Preserve the hero's global home goal when preparing its return
  or onward transfer. Destination import and browser qualification remain
  unfinished. See [saved-neighbor hero departure](docs/halo-region-layout.md#original-hero-departure-and-saved-neighbor-hold-288).

- Scroll across saved-region boundaries and return through the original camera
  and save/load paths in the native prototype. Both trips preserve saved state
  and release the departing world's main allocations. Automatic hero custody
  and browser qualification remain unfinished. See
  [pointer-driven region travel](docs/halo-region-layout.md#pointer-driven-saved-region-travel-286).

- Page between the returned home and saved eastern region repeatedly in one
  native game process. Five visits preserve saved actor state, free all eight
  world roots at each unload and retain two checkpoint slots per region.
  Pointer-driven browser travel and co-op region paging remain unfinished. See
  [repeated home/east paging](docs/halo-region-layout.md#returned-home-and-east-paging-in-one-session-286).

- Save the returning hero and its retired eastern region together in the
  native prototype, then reload the selected home save through the original
  engine and continue its movement. Four interruption recoveries and two
  invalid-save refusals pass; reload checks preserve all 504 saved records.
  Browser travel and co-op regions remain unfinished. See
  [saved homeward return](docs/halo-region-layout.md#paired-homeward-publication-and-selected-home-reload-286).

- Resume a returning hero's original AI and movement in its saved home region
  in the private native prototype. Independent inspection verifies 494 exact
  records at activation and ten seconds of original gameplay afterward.
  Paired return publication and browser travel remain unfinished. See
  [homeward continuation](docs/halo-region-layout.md#original-homeward-activation-and-gameplay-continuation-284).

- Restore a crossing hero's populated movement commands and registered guild
  in its saved home kingdom in the private native prototype. Independent
  inspection verifies four exact imported records, 488 unchanged unrelated
  records, both guild rosters, complete world roots and original cleanup.
  Resuming home-region gameplay and publishing the return remain unfinished.
  See [homeward import](docs/halo-region-layout.md#original-homeward-retirement-and-home-import-279281).

- Qualify original homeward movement across an open-world region boundary in
  the private native prototype. A saved eastern hero reloads, receives the
  original movement command, and crosses west while preserving its real home
  task. The next step is restoring the home region and publishing the return.
  Browser travel remains unverified. See
  [homeward movement](docs/halo-region-layout.md#qualified-original-homeward-movement-276).

- Qualify private native destination activation and paired regional saves.
  The crossing hero resumes original AI, keeps its home/position, and all three
  effects expire through original commands. Independent inspection verifies484
  exact activation records. Four interrupted-save recoveries and two invalid
  world refusals pass before selecting source/destination together under one
  hero owner. Browser travel and co-op regions remain unverified. See
  [activation and saves](docs/halo-region-layout.md#qualified-destination-activation-and-paired-publication-272).


- Import the crossing hero and all three attached effects into the newly loaded
  region through original engine readers and ID reservations. Independent
  inspection verifies nine exact imported records, all 506 prior destination
  records unchanged, preserved timer ages and global position, and unchanged
  terrain, RNG and queues at the import boundary. The following native
  activation/save milestone qualifies resumed AI and paired custody. This is a
  private native prototype. See [running hero import](docs/halo-region-layout.md#running-destination-hero-import).

- Preserve the traveling hero's original guild through a pure home reference
  in the newly loaded region. Original runtime registration and saving pass;
  all 514 existing destination records, terrain, global state and AI queues
  remain unchanged across insertion. Initial preparation refused a special zero
  timer value in a brand-new region; a later ordinary tick resolves it. See
  [original guild reference](docs/halo-region-layout.md#original-home-reference-after-running-travel).

- Connect the running hero crossing and source retirement to the original
  same-process unload/load cycle. The old region releases all eight tracked
  roots; a fresh eastern region attaches and stays paused at clock zero.
  Independent checks preserve 1,438 checkpoint records and verify 7,440 shared
  height values. Destination hero import and paired ownership publication
  remain unfinished. This remains a private native prototype. See
  [crossing region transition](docs/halo-region-layout.md#running-crossing-region-transition).

- Remove the crossing hero and its complete attached family through original
  engine methods while the source stays paused. A saved-file check confirms
  nine records removed, 488 unrelated records unchanged, only the expected
  guild roster departure, and no dangling typed references. The actual player
  ownership journal remains unchanged until destination activation is ready.
  This is still a native prototype. See [running source removal](docs/halo-region-layout.md#running-source-removal).

- Observe the journal-selected hero crossing an overlapping region boundary
  under the original AI, then pause and save at the accepted movement tick.
  Independent checks preserve the complete paused world, guild membership and
  988 actor records across reload/hold comparisons. Prepare the newly observed
  reward bubble and three-second attached timer without dropping their state;
  42 focused checks pass. Destination activation and automatic browser travel
  remain unfinished. See [selected-hero crossing](docs/halo-region-layout.md#journal-selected-hero-crossing).

- Connect overlapping native regions to the original session save/unload/load
  cycle. Five visits include a newly generated eastern neighbor and two home
  returns; all eight roots free on each of four exits. Independent inspection
  preserves 1,922 actor records, queues, RNG and world state, and checks 12,400
  shared terrain vertices. A mismatched layout refuses before unloading.
  Clear saved player names through the original destructor before another
  read. This remains a private native prototype; hero crossings, browser travel,
  co-op activation and sustained browser memory bounds remain unfinished. See
  [same-process regions](docs/halo-region-layout.md#same-process-overlapping-region-session).

- Load the journal-selected returned home in a fresh original native engine.
  All 489 saved actor records and existing queues survive unchanged; the hero
  resumes its own AI and commands without another import or scheduling repair.
  Expired effects stay absent. The verified continuation publishes as revision4
  with three interrupted-save recoveries and four retained checkpoint slots.
  Seamless browser travel and full multiplayer qualification remain open. See
  [selected-home reload](docs/halo-region-layout.md#journal-selected-home-reload-and-save).

- Complete a stopped-save homeward handoff in the private native test journal.
  Original removal retires the northern Warrior and both effects; all 455
  unrelated records remain exact. Revision3 selects that retired source and the
  home kingdom after verified gameplay together. Four interrupted commits
  recover, duplicate ownership and a deleted home guild refuse, and only four
  checkpoint slots remain. Seamless browser travel and multiplayer qualification
  remain open. See [return ownership](docs/halo-region-layout.md#original-source-retirement-and-return-publication).

- Resume the returned Warrior through three seconds of original native gameplay.
  All 494 actor records survive reload and scheduling exactly; the AI creates
  its own commands, the hero moves, and both carried effects expire naturally.
  The saved Wait deadline is preserved. Build252 and independent save inspection
  pass; source retirement, ownership publication, seamless browser travel and
  multiplayer completion remain unfinished. See [live return](docs/halo-region-layout.md#original-live-home-continuation).

- Import the selected northern Warrior and both current effects back into its
  original home guild in an isolated native game. Resolve saved animation
  references through the original helper initialization before exporting them.
  Seven individual records and all seven records in the whole-game save match
  exactly; 485 unrelated records remain unchanged and original cleanup restores
  all 487 baseline records. Official build249 and the bounded native trial pass.
  Live return activation, custody publication, browser travel and full co-op
  completion remain unfinished. See [home import](docs/halo-region-layout.md#original-home-import-and-cleanup).

- Add bounded native payload/request admission for inherited Animate Extended13,
  including both original empty-name reservations and its optional pinned factory
  allocation site. Literal ARB2 commands pass four original x86 reader/writer
  round trips; 22 existing command round trips also pass. Both official native
  storage targets pass, including 1,947 allocation checks and missing-leaf-name
  cancellation. These storage/CPU checks alone do not qualify activation or
  automatic return; the later build249 home import is recorded above.

- Prepare the journal-selected northern Warrior for its immutable home guild
  with all current physical children, including the new ARB2 extended animation.
  Correct inherited command timer/callback offsets and account for its original
  100-byte allocation request. Seven inert records preserve global placement,
  matching terrain height, original AI and unsigned timer age; independent
  replay checks preserve every other byte. 111 focused tests pass. Original
  import, live return crossing and browser/co-op integration remain unqualified.
  See [return preparation](docs/halo-region-layout.md#prepare-the-selected-hero-for-home).

- Resume the kingdom selected by the registered-hero journal in the original
  native engine, preserving its expired effect and released reward roster.
  Eleven linked records load exactly and ordinary AI/timers continue through
  the next save; revision2 selects that evolved world. Current-owner export
  opens no dormant checkpoints and revokes its bounded reader afterward.
  Seventeen route checks pass. Automatic crossing/return and browser/co-op
  qualification remain open. See [overlapping regions](docs/halo-region-layout.md).

- Retire the actual crossing Warrior, Explore flag and two effects from the
  source native region through original removal methods. Independent stopped
  saves preserve485 unrelated records exactly and show only the expected guild
  roster departure. Select the retired source and evolved northern destination
  together through the registered-hero journal, preserving ordinary AI targets
  and the immutable guild. Four interrupted publications recover; duplicate
  ownership and a deleted target refuse. Continuous runtime travel, browser
  memory limits and full multiplayer completion remain unfinished. See
  [overlapping regions](docs/halo-region-layout.md).

- Reload the evolved northern native region in a fresh game process. All13
  hero/flag/effect/script/container/command records survive exactly before
  resumed play. Original AI and commands continue through clock1000; the
  short-lived effect expires at800 and the flag releases its hero with matching
  script/native rosters. A further whole-world save passes independent checks.
  Source retirement, single-owner publication and browser integration remain
  unfinished. See [overlapping regions](docs/halo-region-layout.md).

- Activate the transferred Warrior, Explore flag and two effects in the
  northern native region. Original postload, collision, command registration
  and scheduling let the hero move and both scripts execute. Save the whole
  world before and after 500ms of ordinary play, then pause through the original
  game mechanism. Independent saved-reference checks pass. Fresh reload,
  source retirement, ownership and seamless browser travel remain unfinished.
  See [overlapping regions](docs/halo-region-layout.md).

- Restore a complete stopped hero/Explore-flag transfer with its two effects,
  reciprocal memberships, original commands and remote guild proxy through
  the original native readers. All 13 original writebacks match exactly;
  original cleanup frees 49 command reservations. Eleven corruption controls
  pass. Correct flag command admission, its single-component writer and
  parent-derived effect navigation while preserving relative effect poses.
  Official build239 and the isolated native trial pass. Movement/AI activation,
  source retirement and playable seamless travel remain unfinished; the
  browser build is unchanged. See [overlapping regions](docs/halo-region-layout.md).

- Add an explicit original Explore reward class to private region restoration.
  Its one-component save and336-byte object retain the flag's original factory
  and command-bank methods. Class admission tests and native build235 pass;
  linked hero/flag import and playable seamless travel remain unfinished.
  See [overlapping regions](docs/halo-region-layout.md).

- Preserve the crossing Warrior's Explore flag animation/marker and both
  current temporary effects in prepared transfer payloads. Add pinned frame
  command12 support to the original reader's storage planner and scoped
  allocator. The native build, three storage suites and71 focused JavaScript
  checks pass. Original reader execution of the combined hero/reward bundle,
  source retirement and playable seamless travel remain unfinished.
  See [overlapping regions](docs/halo-region-layout.md).

- Prepare the actual crossing Warrior's in-flight Move, Path and Queue for the
  northern map without discarding commands. Preserve elevation, cursors and
  dispatch ages; all13 saved route points have equal original ground in both
  maps. A564-byte original-reader payload is prepared, and65 focused checks
  pass. Reward command12 and the current attached effects still need transfer
  support before native import, retirement and ownership publication.
  See [overlapping regions](docs/halo-region-layout.md).

- Verify an original Warrior crossing the northern ownership boundary after a
  normal Explore reward request. Correct the private request's command-batch
  timing; original pause keeps the interface running while the saved hero stays
  unchanged. Recognize reciprocal Explore reward membership without treating
  it as another guild. All63 focused tests pass. Destination import, ownership,
  continuous browser travel and full co-op completion remain unfinished.
  See [overlapping regions](docs/halo-region-layout.md).

- Resume an actual recruited Warrior in a saved overlapping native region.
  Explicit layout/save admission preserves hero and guild records, terrain,
  saved RNG and UI before play resumes. Original AI then leaves the guild and
  begins exploration;50 focused tests pass. Seamless crossing and browser
  verification remain unfinished. See [overlapping regions](docs/halo-region-layout.md).

- Generate and save two fresh native maps with overlapping terrain while
  retaining the original fixed-size allocations. All645 shared heights and25
  fractional ground samples match;27 focused tests pass. Hero crossing, automatic
  initial camera and browser qualification remain unfinished. See
  [overlapping regions](docs/halo-region-layout.md).

- Prepare repeated remote hero hops while preserving the original registered
  guild completion. Resolve the immutable native guild reference even when the
  departing world has only a pure proxy; keep remote lookup guarded and reject
  unrelated guilds/callbacks. All62 focused arrival/custody tests pass, and the
  actual native saved Queue prepares for remote/home destinations. Live seam
  movement remains unfinished. See [repeated hero travel](docs/remote-hero-order-arrival.md).

- Verify fresh native reload of the moved hero using the original whole-world
  reader. Preserve all actor, AI, home and pending command bytes through ordinary
  ticks, resolve the original lazy actor cache before guarding state, and remove
  the private hero cleanly. Native218 passes; guild tasks remain held and seamless
  crossing/browser qualification remain unfinished. See
  [regional hero reload](docs/native-regional-hero.md).

- Save the moved native hero through the original whole-world writer in a
  private generated-region checkpoint. Independently verify its complete actor,
  AI, guild projection and pending Queue records, with expired effects absent
  and both empty container groups preserved. Native211 exits cleanly. Fresh
  reload, global continuity and ownership transfer remain unfinished. See
  [regional hero checkpoint](docs/native-regional-hero.md).

- Verify original hero Path execution on the generated kingdom's collision
  grid, while keeping its foreign guild Queue and AI paused. Native210 completes
  the destination route with76 observed samples, preserves every UNIT byte
  outside pose, retains the pending Queue/GPL and exits cleanly after normal
  cleanup. Global seam placement, save/reload and ownership remain unfinished.
  See [regional hero movement](docs/native-regional-hero.md).

- Run the restored outdoor hero's three effects on ordinary ticks in the
  generated west kingdom. Rebuild animation resources through the original
  post-load stage, verify450/700/2700ms lifetimes and keep both hero commands
  paused before foreign guild lookup. Native203 exits cleanly; all36 records
  and unchanged saves/settings/browser files verify independently. Hero
  movement and ownership transfer remain unfinished. See
  [regional hero execution](docs/native-regional-hero.md).

- Restore the preserved Warrior family through the original engine in the
  generated west kingdom, using its actual clock and inert guild identity.
  Verify all actor/command/script/container bytes, then remove the unscheduled
  family and free42 original command allocations. One isolated native run
  exits cleanly; activation, placement and ownership transfer remain unfinished.
  See [native regional hero restoration](docs/native-regional-hero.md).

- Preserve the actual outdoor Warrior's populated Path/Queue commands and
  three original effects in a generated-region arrival capsule. Independently
  verify all3753 copied bytes, reject five altered capsules, and pass251 focused
  checks. Keep the native guild completion reference explicit and require
  interception before activation. Runtime import and continuous travel remain
  unfinished. See [active hero arrival](docs/hero-active-arrival.md).

- Restore a registered guild's inert record through the original runtime in a
  generated kingdom, save it through the ordinary checkpoint action, and verify
  a fresh native reload with the same agent23. Two isolated sequential runs exit
  cleanly below169MiB sampled RSS; original inputs and served files are preserved.
  Active hero/effect orders still refuse arrival rather than losing state. Co-op
  plan010 is prepared against native196 without launching a pair. See [regional
  guild identity](docs/native-regional-home.md).

- Add stopped registered-hero custody across arbitrary region keys with one
  atomic handoff selection, two GMP slots per visited region, and bounded
  checkpoint readers. Fix remote-to-remote arrival to retain an empty native
  guild link. All169 relevant checks pass; preserved original Warrior saves
  reopen with the same identity, and a453-byte home projection is prepared for
  the generated west kingdom. Live import, shared-world integration and browser
  qualification remain unfinished. See [hero routes](docs/hero-route-store.md).

- Admit native UI gate/direction names together and test regional travel with
  the request-file fixture disabled. Native195 visits five times across three
  kingdoms, generates two neighbors, restores both revisits and frees32 tracked
  original roots before saving home. The final original game frame is reviewed;
  334 platform checks pass. Browser bounds, hero crossings and live co-op remain
  open. See [ordinary UI travel](docs/native-ui-travel.md).

- Connect native named UI requests to the game's existing handlers. One
  isolated native game completes its region route and ten ordinary checkpoint
  saves. The final platform suite passes282 checks, and the script parser
  passes with assertions enabled. Prepare a bounded guest-surrender co-op test
  against native194; no pair or browser starts. The latest native shared-defeat
  test and full expanding-world/browser goal remain unqualified. See [native named
  controls](docs/native-named-actions.md).

- Add coordinate conversion for a pending actor movement step across adjacent
  regions, preserving signed Q11 fractional position and rejecting overlapping,
  distant and ambiguous-corner destinations. Keep the saved-position converter
  byte-identical for existing preparations. All12 coordinate tests pass; the
  new primitive is not connected to live engine movement or owner handoff yet.
  See [pending actor crossing](docs/actor-region-crossing.md).

- Stream source save backups to a fresh ZIP in a chosen folder using 64 KiB
  reads, awaited writes and a temporary disk index. Keep the download fallback
  without whole-save ArrayBuffers, and avoid replacing existing backups through
  the Save As picker. Fourteen focused checks and the launcher suite pass;
  browser memory/runtime and gameplay qualification remain open. Source only;
  served files are unchanged. See [save exports](docs/save-export-streaming.md).

- Restore saved RNGs before arrival camera movement and verify both complete
  native world boundaries separately. Native192 passes all three saved loads
  and five view transforms across four directions. All74 focused checks pass,
  including48 contradictions and reparsed changed-save controls. Refresh the
  unexecuted co-op plan007; browser/full-match/resource qualification stays open.
  See [restoration before arrival](docs/native-before-camera.md).

- Verify native camera edge travel west, north, south and east with bounded
  original input, five visits and32 tracked world releases. Fix the four-turn
  fixture's512-step overflow and preserve its pre-world failure. All73 focused
  checks pass. The strict home comparison remains incomplete after an intended
  saved camera-coordinate change; browser and multiplayer qualification remain
  open. See [cardinal travel](docs/native-cardinal-camera.md).

- Restore an empty Frontier profile's saved solo display name through the
  original owning string routine and isolate native region tests' registry and
  runtime files. Native191 completes15 visits/13 kingdoms with all three full
  saved-state comparisons matching,112 root releases and about184MiB sampled
  peak. Preserve type-guard failures and refresh the unexecuted co-op plan006.
  Browser/full-match qualification remains open. See [profile restoration](docs/native-profile-restoration.md).

- Protect two original terrain clamp stores at connected region boundaries.
  Native188 completes15 visits through13 kingdoms with intact shared heights,
  matching saved returns,192 edge/24 interior controls and112 root releases.
  Initial imported-save header metadata still differs; full restoration and
  browser qualification remain false. Preserve the shorter partial run and exact
  compiled artifacts. See [terrain repair](docs/native-clamp-store.md).

- Exercise a wider native expansion route and preserve its failure: fresh `-3_0` generation changes five west-edge vertices after three completed visits. A bounded native-only observer in private build187 confirms the original multi-vertex clamp as the writer; both owned runs stop, original inputs and served artifacts remain unchanged. No repair or successful wider route is claimed. See [expansion failure and next repair](docs/native-expanding-voyage.md).

- Release Frontier map resources on departure: close saved-kingdom cursors and revoke stale rows, cancel queued camera writes and exports, revoke temporary backup URLs, drain accepted storage work and reduce canvas backing dimensions to 1 × 1. Admitted restores finish atomically without late UI publication. All82 focused Node tests pass; the earlier wrong test inspection API failure is retained. Browser memory/crash safety and playable connected regions remain unverified; served artifacts are unchanged. See [view lifetime](docs/frontier-view-lifetime.md).

- Verify the native room/checkpoint protocol through an owned temporary public TLS route: both SDK roles stream the pinned stopped kingdom, complete fixture agreement, cancel a partial transfer and retain their rooms. Public012 passes767 reported checks; loopback013 passes679. Protect and normalize the secret test route, wait for measured DNS cache expiry and require a real HELLO before starting native tests. Original worlds, independent-machine games and browser bounds remain unqualified; all owned processes stop and served files remain unchanged.

- Verify delivery of a pinned stopped kingdom over the real native WebSocket provider in both directions: 317,365 bytes in 20 bounded chunks, matching complete digests, canceled partial transfers and retained rooms. The stopped-save fixture passes681 checks and the default synthetic regression passes326. Preserve resource-stop failures and monitor one-job build/test descendants separately. No original world is loaded; shared gameplay/resume, internet and browser qualification remain unfinished.

- Batch adjacent saved-map cells of the same colour and skip offscreen marker windows without adding raster caches or surfaces. Two pinned native saves render 16,384 cells in 513 terrain calls, with the exact pre-batching software raster preserved through eviction/return and a fresh reader. Focused source tests cover clipping, altitude colours, unit markers and view lifecycle. Browser frame rate and memory remain unverified; served files are unchanged.

- Prepare live original-native co-op verification with isolated executable/state directories, a shared512MiB sampled memory guard, two-minute deadline, bounded packet observation and explicit binding to a reviewed plan. Five supervisor and three relay-observer tests pass; a single native host isolation probe passes at148.4MiB. The two-instance run awaits the human exception required by AGENTS.md; browser launches remain suspended.

- Verify original native guest loading against a terminal original-host recording: player2 joins, emits its own Ready/GoStatus, advances to clock550 and starts Chapter1 with two network kingdoms. Preserve all ten original host packets unchanged and retain duplicate-name/status-field failures. Twelve focused fixture tests pass. The loaded map waits for live host turns; synchronized matches, shared save/resume and browser qualification remain unfinished.

- Reduce the pinned original multiplayer initialization wait from100.26% to2.54% of one CPU core in a sequential native186 comparison. Preserve original packets/timeouts, yield for8ms during initialization and complete unconsumed scheduler idle slices without losing queued signals. The official runtime target passes2257 checks with3 skips. Private WASM018 compiles and passes static linked-code/memory checks; full gameplay, browser performance and matches remain unqualified. Served browser files remain unchanged.

- Verify the pinned original game's native lobby through the real WebSocket relay: create a room, admit a reference peer, process its original Not Ready/version request and render its matching player label. Preserve seven original packets (825 bytes), pin-checked instruction/schema evidence and a bounded35-second144.2 MiB native observation. No map, second engine, co-op load/resume, full match, independent internet or browser qualification is claimed; served browser files remain unchanged.

- Qualify native DirectPlay hosting/joining through real Mac WebSockets and the production room relay:329 reported checks pass across four local connections, covering synthetic checkpoint agreement, partial cancellation with retained rooms, ordinary packets and disconnects. Preserve the failed premature-next-proposal fixture and explicitly coordinate Complete consumption in the final fixture. Original-world load/resume, production proposal ordering, full-match/internet/browser qualification remain unfinished; served browser files are unchanged.

- Add native Mac WebSocket transport using Foundation, with bounded binary
  queues, negotiated protocol checks, platform TLS handling and retired-token
  callback cleanup.153 checks pass across35 actual local connections; portable
  platform checks pass212 and native183 builds. Actual DirectPlay/game co-op,
  successful public WSS and browser qualification remain unfinished; served
  files and existing services are unchanged.

- Connect the gated co-op game service to checkpoint delivery with owned
  profile file streams, verified EndAck, import/Ready and cleanup before shared
  attachment. Native182/private WASM017 build;1608 real-file and34151 fake
  provider checks pass. An ordinary native regression matches both saved
  loads across99 gameplay ticks. Actual game delivery/shared loading, native
  sockets, fresh co-op regions and browser qualification remain unfinished;
  served files and running services are unchanged.

- Connect bounded checkpoint delivery to the native DirectPlay provider and C
  seam. Bind incoming bytes to the joined epoch, proposal, roster and role;
  consume one notice per recipient before acknowledgement, and rotate lanes
  so fast peers cannot starve other members. The official fake-provider suite
  passes34114 checks, including a full4096-chunk maximum-size sequence and
  completion/cancellation/error cases. Game file handling, actual network
  loading and browser delivery remain unconnected; served files are unchanged.

- Add separately negotiated checkpoint delivery to the room relay: one16 KiB
  chunk per recipient awaiting acknowledgement, exact proposal/role checks,
  bounded idle/total deadlines and End acknowledgement before Ready.47 tests
  pass, including real local WebSocket delivery and prior room regressions.
  The native game bridge and live co-op travel remain unfinished; the running
  service and served game are unchanged.

- Wire gated co-op travel actions to original pause/capture and host proposal
  for a saved neighboring region. Verify its actual saved clock and RNG seeds
  against the selected checkpoint before Begin. Native181 and private WASM016
  build;10945 focused checks and a real two-load restoration regression pass.
  Production proposals, transfer delivery, fresh co-op regions and shared
  load/resume remain unqualified. Served files are unchanged.

- Add bounded import of an agreed target checkpoint, preserving the host's
  revision and refusing corrupt, stale or conflicting saves. Add a gated Ready
  adapter that verifies existing targets or imports a private received file
  before voting once. Native180 links;919 real-file checks and9258 original
  pause/agreement fixture checks pass. Incoming transfer hookup and live shared
  load/resume remain unfinished; the browser game is unchanged.

- Add a gated co-op shared-load coordinator with exact room/roster/descriptor
  guards, original type3 attachment and rebuild hold, one Loaded vote, and
  Complete-gated original secondary resume. Native179 compiles;8821 focused
  fixture checks and a two-load native restoration regression pass. The live
  coordinator, shared transfer/Ready, peer resume and browser play remain
  unqualified; served files are unchanged.

- Verify an original pause immediately after saved-world rebuilding, before
  gameplay starts. Two real saved loads hold through an original paused tick,
  resume through the original local dispatcher, and match their expected typed
  state. Original command/reference frees and temporary-hook removal are
  observed. Native178/trial041 passes94 gameplay ticks and seven checks;
  live co-op Loaded voting and replicated resume remain unfinished.

- Verify both kingdom selections on actual saved native worlds using a
  disposable party fixture, then restore its temporary metadata before normal
  attachment. Both saved loads match their full expected state before resumed
  gameplay; three visits complete95 original ticks. Correct a false shared-read
  guard that treated a map configuration property as the simulation frame.
  Native174 compiles. Live co-op read/attach/resume remains unfinished; no
  browser launch or served engine change occurs.

- Add an opt-in game-owned shared-checkpoint reader that requires the exact
  committed room agreement and verified target file, retains the live party,
  and selects the local kingdom on the returned original context. It hands
  ownership to a future attachment coordinator; shared attach/rebuild/resume
  remains unfinished. Native172 compiles; the focused fixture passes6135
  checks for pause/metadata/admission, without executing a full shared read.
  No served engine change or browser launch occurs.

- Wire opt-in paused host checkpoint saving into the co-op adapter. Freeze
  world/content/rules identity before pause, preserve the original Save UI
  name, and select a bounded two-slot checkpoint only while exact session,
  roster, owner and frame remain valid. Focused storage checks pass846,
  original pause/string/path/binding checks6057 and fake-provider checks12923;
  native171
  links. Flat checkpoint names preserve world/region identity through the
  original formatter. Admit the original multilevel profile save hierarchy and
  map network player IDs to kingdom slots instead of indexing by player ID. Live paired saving/loading and browser delivery remain
  unfinished.

- Add an opt-in co-op pause adapter using Majesty's original sender and
  owning command queue. It waits for the settled paused phase instead of
  treating enqueueing as a checkpoint boundary. The focused native suite
  passes 5257 checks and native167 links; live shared saving, region travel
  and browser delivery remain unfinished.

- Verify the original network-control pause/resume dispatcher in a stopped
  native fixture: 20 cycles preserve frame/clock and release all 60 commands
  and reference counters. Modal pause UI is suppressed and deferred phase
  copying is emulated; live replicated pause and region travel remain open.

- Define a bounded canonical co-op region descriptor covering checkpoint
  digests/revisions, content/rules, neighboring regions, simulation frame/clock
  and saved RNG values. The focused native codec suite passes 1163 checks.
  Live shared pause/save/load/resume integration remains unfinished.

- Bound the paired-region checkpoint store's SHA-256 checks by each admitted
  file size (at most 64 MiB), using a fixed 16 KiB buffer. Oversized regular
  files are refused before payload reads, with a one-byte overflow probe if
  input grows during reading. Eighteen focused native checks pass and native166
  links. Shared co-op travel and browser activation remain unfinished.

- Connect checkpoint agreement to the native DirectPlay provider with exact
  room epochs, bounded snapshots and strict permission/roster validation.
  The official fake-transport suite passes12434 checks. Game-owned shared
  loading and browser delivery remain unfinished; served files are unchanged.

- Add opt-in checkpoint agreement to the WebSocket room relay. Every party
  member must agree before load permission and report loading before resume
  permission; missing peers after permission end the room.26 focused tests
  pass, including real local connections. Native co-op travel integration
  remains unfinished; the running relay and browser game are unchanged.

- Verify original message-queue frees during five native named-world visits.
  This lifecycle already frees the preceding queue between visits; the earlier
  orphan-queue cleanup must not be applied here. All four saved loads match,
  and no extra queue cleanup or browser engine change is made.

- Shut down the generated expanding-map stream when its page leaves: refuse
  new work, discard queued actions, and prevent late region reads from creating
  terrain. An accepted save settles before resident state is released. Source
  suites pass 29 tests and six lifecycle tests pass against the two updated
  served JavaScript modules. No game/browser launch or engine change occurs.

- Recheck every co-op kingdom's current gold and required buildings when a
  victory request arrives, replacing cached readiness from an earlier script
  observation. The bounded shared predicate passes 135 native rule checks and
  the official native build succeeds. Browser delivery and shared-match
  verification of this change remain unfinished.

- Disable campaign shared actions on relay loss or receive overflow, cancel
  queued surrender after victory/defeat, and ignore late results after a
  disconnected room. Previously confirmed victory saves remain retryable.
  Source and served campaign/invitation suites each pass 44 tests; the served
  JavaScript is updated without a browser launch or engine change.

- Assemble an unserved WASM candidate with checkpoint disconnect cleanup,
  matching launcher/engine identity, and campaign/multiplayer/world pages.
  Private staging now accepts an explicit site directory. Static package and
  focused startup/session tests pass; browser gameplay remains unverified.

- Verify original edge-scrolling input for both departure into a generated
  kingdom and return to saved home. Native saved-state restoration and tracked
  world disposal pass; continuous browser rendering and co-op travel remain
  unfinished. The served game is unchanged.

- Close rejected checkpoint sessions even after relay-reported loss, clearing
  stale packets and pending completions without duplicating loss notifications.
  The opt-in receiver requests the original lobby leave path after rejection;
  focused native tests verify notification dispatch and manager reset. Live
  room exit and browser activation remain unverified; served files are unchanged.

- Correct incoming-save sender binding to the original source-player ID,
  independently of the packet's XOR key. A real GMP now passes through the
  original receive queue, FILE dispatcher and packet destruction with an
  identical output file. Network matches and browser activation remain open.

- Verify a real owned GMP through the staged receiver and a subsequent native
  kingdom load, neighbor generation and saved return. The opt-in adapter
  remains unserved.

- Connect incoming-checkpoint staging to original packet getters and filename
  resolution behind an opt-in flag. Exact-session failure rejection passes the
  focused native provider tests. The original-packet fixture passes 2125 checks,
  including allowing system-loss cleanup notifications through the failure
  gate. Real network matches and browser delivery remain open. The served game
  is unchanged.

- Cap cached frame submissions at the chosen Graphics FPS limit while keeping
  fresh frames and resize handling responsive. Focused native fake presenter
  checks pass and a private WASM candidate compiles; the served game is unchanged.

- Prepare a bounded incoming-checkpoint staging writer. Real native temporary
  file tests preserve the prior save on failed or interrupted replacement;
  multiplayer receiver integration and browser delivery remain unfinished.

- Verify experimental saved-region restoration across four native travel laps:
  all45 saved loads match over49 visits, with tracked disposal on every
  transition. Sustained browser memory limits and seamless travel remain open.

- Update the served experimental region controller's camera-boundary adapter.
  Source and served JavaScript pass110 terminal checks against the latest
  native route; the served engine and browser-play qualification are unchanged.

- Extend experimental shared-border protection to the original virtual
  height-delta writer. Native side/corner/interior controls and nine saved
  reload comparisons pass. Seamless browser travel remains unverified.

- Preserve saved exploration and terrain notifications while a solo region
  initializes. Nine native saved loads pass the existing state comparison;
  browser delivery, seamless travel and earlier seam failures remain open.

- Retain saved building selection and view state while the original UI
  initializes a resumed solo region. Nine native loads preserve these fields;
  terrain restoration, seamless travel and browser delivery remain unfinished.

- Preserve shared-edge heights against original single-vertex terrain edits
  in the experimental connected-world adapter. Interior edits remain enabled;
  the policy binds one live terrain and clears it before region disposal.
  Native engine controls and a thirteen-visit route pass the height checks.
  Other writers, seamless travel and browser delivery remain unverified.

- Recover the native prototype after a controlled stop between durable home
  ownership publication and engine acknowledgement. A separate process restores
  the committed actor, script and attachment state before gameplay, resumes
  ordinary guild entry and saves its later progress with the dormant peer.
  Browser crash recovery and seamless world travel remain unfinished.

- Import a returning hero and its attached effects from the current native
  session into the saved dormant home kingdom. Complete collision placement
  through an original save/load cycle before ownership publication or gameplay.
  Verify all actor/script/attachment records across reload and ordinary guild
  entry afterward. This removes the prepared-home-world input from the native
  prototype; seamless travel and browser activation remain unfinished.

- Pause the restored native home world before its first gameplay tick, publish
  its checked ownership pair while the engine remains alive, and resume only
  after the matching receipt and saved files validate. Incorrect and premature
  acknowledgements keep simulation paused. This remains a supervised native
  prototype with a preserved home import; browser activation is unfinished.

- Run remote-family retirement, latest receiving save, original world disposal,
  home restoration and ordinary guild entry in one native session. Publish and
  export that session's checked stopped world pair while retaining the later
  receiving state. Live atomic owner publication and browser activation remain
  unfinished; the prepared home import is still reused from a preserved run.

- Restore the selected held hero world at its actual saved clock while retaining
  the earlier family pause anchor. The native guarded restore no longer rolls
  the selected world back to the fixture's initial clock. Check every saved
  actor/script/attachment before the first update, guarded evolution and
  original retirement; retain compatibility with the older reload format.

- Resolve an outdoor remote hero's saved `go_home` task through its registered
  home region, including the original queued guild-entry target. Prepare one
  stopped return under the selected ownership lease and retain its commit for
  interruption retries. Check the runtime selector against the captured native
  return and guild-entry saves. Live native/browser activation remains unfinished.

- Prepare a selected outdoor hero's script and command timestamps together from
  the two saved world clocks. Preserve inactive/paused contexts and command ages,
  including attached Wait effects, within a256KiB record budget. Original native
  import and fresh full-world reload preserve the projected records, collision
  placement and scheduling. Ordinary remote execution and browser activation
  remain unfinished.

- Connect actual stopped outdoor, receiving, held and returned snapshots into
  one saved hero round trip. Revisions4/5 select the guarded receiving owner;
  revision6 restores the sole home owner and revision7 selects its ordinary
  guild entry. Export the checked final home selection, then load it through
  the original named-world session without family guards and verify two
  evolving saves. Pending remote selections remain unexportable. This is a
  native saved-world prototype; active spatial crossing and browser activation
  remain unfinished.

- Reload the saved receiving hero/effect family through the original full-world
  path with real collision/drawing membership and one AI queue entry. Install
  remote-home guards before its first update, preserve complete saved records
  through the hold, then verify original removal. The original native getter
  resolves the hero's lazy cache before taking the hold fingerprint. Selected
  handoff, active remote continuation and browser activation remain unfinished.

- Save the actual receiving kingdom before/after guarded outdoor-family
  admission and after original retirement. Complete saved hero/effect records,
  script, commands, child links and one AI queue entry pass inspection against
  the selected outdoor source. Other actors' records survive admission/removal.
  Full saved-family reload, selected handoff and browser activation remain open.

- Select the existing hero's actual outdoor native save under revision3 in a
  fresh stopped copy of the saved pair. Identity, guild membership and the
  dormant kingdom remain unchanged. Four interrupted writes recover a complete
  pair, seven invalid saves are refused, and the native-loading tools export
  and verify both selected worlds. This prepares the next regional transfer;
  seamless travel and browser activation remain unfinished.

- Restore the actual held hero/effect records in their original home kingdom
  with fresh identities, retire the old local copy, and verify guild entry
  through ordinary native updates after a full original world reload. Complete
  reload records and reciprocal native/script membership pass inspection.
  Active owner publication, seamless travel and browser release remain unfinished.
  See docs/native-session-release.md.

- Hold a restored outdoor hero and its three effects through ordinary native
  AI and command updates while its registered home is in another region.
  A one-second trial preserves all 11 complete records, emits one home request,
  lets other actors run and frees all 42 tracked command allocations on cleanup.
  Home-region loading and actual travel are unfinished; browser artifacts are
  unchanged. See docs/native-session-release.md.

- Restore the actual outdoor hero, three effects, script record and commands in
  a copied native receiving kingdom with fresh local identities. Independent
  checks confirm complete records, internal links and original cleanup of all
  42 command reservations. The family remains outside the AI queue; guild routing,
  spatial activation and owner publication are unfinished. Browser artifacts
  are unchanged. See docs/native-session-release.md.

- Add bounded native storage planning for nine saved command kinds and use it
  in the existing return loader. The original reader restores all four actual
  outdoor hero/effect payloads, preserves their serialized bytes, transfers
  command ownership and frees them through original deletion. Actor activation
  and cross-region movement remain unfinished; browser artifacts are unchanged.

- Identify the original queued guild-entry UNIT reference and add its bounded
  transfer plan. A copied native kingdom completes the real hero's route and
  guild entry through ordinary AI after50ms, preserving script home and its
  occupied guild slot. Dormant-home routing and destination restoration remain
  unfinished; browser artifacts are unstaged. See docs/native-session-release.md.

- Preserve the actual outdoor hero's ARH2 animation across region clocks.
  Two original native runs match complete effect/hero/order records through
  five animation calls, completion and cleanup after450ms. Compose verified
  clock plans for all three attached effects; destination import and the
  hero's navigation remain unfinished. Browser launch suspension continues.

- Add bounded clock preparation for the outdoor hero's original ARG1/ARG3
  timed effects. Two stopped native runs retain their full records and expire
  after the same700/2700ms at both region clock bases. Actual-source controls
  reject150 altered records/clock inputs. Destination import, navigation,
  animated-effect migration and browser activation remain unfinished. See
  docs/native-session-release.md.

- Qualify an original-AI outdoor hero departure in the native session fixture.
  The saved Warrior leaves its real guild after resting and retains its home,
  occupied guild slot and queue. Three visits/saved return pass. Transfer of
  its live navigation and attached effects remains unfinished; browser artifacts
  are unchanged. See docs/native-session-release.md.

- Add an opt-in camera boundary prototype for named solo worlds, using the
  original main-view scroll input and existing durable session admission.
  Native camera-driven departure, saved return and opposite-edge arrival before
  simulation resume pass. Source controller checks pass68. This is whole-kingdom
  travel; seamless hero/co-op crossing remains unfinished. Browser artifacts are unstaged;
  browser launch suspension remains in force. See docs/native-session-release.md.

- Include terrain cell/vertex buffers in session disposal acknowledgements.
  Twelve native transitions pass96 tracked frees; source146/staged95 tests and
  23 contradictions pass. Actual scheduled populations replace an incorrect
  fixed20-agent validation assumption; its refusal is preserved. Controller is
  staged; separate WASM candidate compiles/static-checks release=v2. Sustained
  browser bounds remain unqualified. See docs/native-session-release.md.

- Require six observed original root frees and temporary observer removal before
  named-world session activation. Twelve native transitions pass72 frees;
  source145/staged94 checks and19 contradictions pass. One JS controller is
  staged; a separate WASM candidate compiles/static-checks the contract. Served
  engine, browser suspension and unfinished sustained bounds remain unchanged.
  See docs/native-session-release.md.

- Verify thirteen native session visits through five kingdoms, including four
  original generated kingdoms, saved returns and five shared height borders.
  Source143/staged92 checks replay twelve trips with fixed DOM and one world
  lease; twelve contradictory checks pass. Browser activation and sustained
  resource bounds remain unqualified. See docs/native-session-multiway.md.

- Compile a separate official WASM candidate containing named-world session
  travel with conservative heap growth. Nineteen build-tool tests and static
  candidate checks pass. The guarded build has stopped; served engine artifacts
  are unchanged. Live browser gameplay and resource bounds remain unqualified.
  See docs/browser-region-session.md.

- Add browser controls for the native session path: validate neighbors and
  remember travel before consumption, then require matching native save, quit,
  unload, attach and ready events. Update region links/URL and revoke old read
  capabilities while retaining the game lock. Source140, staged92 and storage44
  checks pass, including replay of the actual native trace. Four JS modules and
  one startup guard are staged; served WASM is unchanged and live gameplay is
  unqualified. See docs/browser-region-session.md.

- Initialize native generated kingdoms through the original full Quit Game
  lifecycle before switching named-world profiles. Five visits now create20 AI
  agents in the new kingdom and restore them on return; clocks/RNGs, actual
  nested save routing and129 border heights pass. Twelve contradictory checks
  reject retained worlds/loading mode and the earlier actual zero-agent save.
  Browser delivery and sustained memory bounds remain open. See
  docs/native-region-session.md.

- Check named-world neighbors before asking the browser game to save and leave.
  Damaged, incompatible or unregistered saved data keeps the current kingdom
  active. Read under the game's existing world lease; cancel pending checks on
  gameplay/page transitions. Source136, related47 and staged30 checks pass.
  Three JavaScript modules are staged; WASM is unchanged and browser gameplay
  remains unqualified. See docs/native-destination-admission.md.

- Generate an actually unexplored neighboring kingdom during native coordinate
  travel. Five visits generate it once, preserve both kingdoms' progress and
  restore the new kingdom on return;30 tracked roots free and129 border heights
  match. Existing partial saves refuse. Eighteen actual-trace controls,26 focused
  JS checks and five config tests pass. Browser delivery and sustained memory
  bounds remain open. Later inspection found zero AI agents in the generated
  kingdom; playable generation remains unqualified pending the lifecycle fix.
  See docs/native-coordinate-expansion.md.

- Stop saved-world map hashing and terrain reads when closing the view or
  leaving the page. Drain a read already in progress before releasing its
  world lock, and close late-created scenes before loading terrain. All110
  focused checks pass. Browser gameplay and total memory remain unqualified;
  game launches stay suspended. See docs/saved-atlas-cancellation.md.

- Publish native coordinate-fixture saves through two verified slots per
  kingdom. Eight actual visits preserve compared saved state; a damaged
  existing neighbor refuses before unload, and a valid committed save loads
  with an empty inactive slot. Browser delivery remains unfinished. See
  docs/native-coordinate-checkpoints.md for evidence and limits.

- Cancel player preparation when leaving the page before game injection.
  Stop compatibility hashing, prevent later GPU/WASM startup, and destroy a
  device returned after cancellation. Preserve initialized-game storage leases.
  Thirty-six focused tests pass; staged HTML matches localhost. WASM is unchanged
  and browser game testing remains suspended. See docs/player-startup-cancellation.md.

- Qualify eight native coordinate visits through four actual kingdoms, including
  the initialized northern neighbor. Encode negative destinations correctly in
  the controller. Per-region saved state passes;48 tracked roots free and seven
  replaced queues retire. Other memory grows. Thirteen focused Node tests and18
  actual-trace refusal controls pass; browser/co-op delivery remains unfinished.

- Generate and save an original northern kingdom at0_-1; its129 shared border
  heights match0_0. Generalize the native initialization runner to inspected
  adjacent coordinates. Four sequential visits preserve initialized return
  state;14 focused terrain/lifecycle tests pass. Browser delivery, automatic
  exploration, co-op activation and sustained memory bounds remain open.

- Reduce the fourth mission's building-registry traversal to one shared pass
  for up to four kingdoms, with fixed result storage and ownership checks.
  Two native reloads verify11 building visits for a four-owner query instead of
  four repeated walks. Native108 and five game-configuration tests pass. This native source
  optimization is not staged in the browser yet.

- Qualify original Warriors Guild and Temple to Dauros construction in separate
  native trials: normal placement, completion to700/400HP and original Save Game
  produce new buildings with typed completion flags. Preserve six earlier
  UI/refusal probes. Shared co-op completion and browser delivery remain open. See
  docs/native-ui-building-construction.md.

- Reload both ordinary construction saves in native107. The existing campaign
  predicate counts the newly built instance when the older building is excluded
  and excludes the type when both completion flags are cleared. Both restore
  before another tick; two native reloads and five configuration tests pass.
  Browser delivery and shared mission completion remain unfinished.

- Implement a fourth co-op objective in native source: each kingdom needs a
  completed Warriors Guild, Temple to Dauros and25,000 gold. One native trial
  verifies the building predicate and rejects unfinished or foreign buildings;
  exact native106 is preserved. Shared completion and
  browser delivery remain unqualified; the launcher still offers three chapters
  and served WASM is unchanged. See docs/coop-construction-mission.md.

- Add recovery for ordinary saved region travel in named solo worlds. Persist
  one bounded trip after native checkpoint confirmation; Frontier offers the
  destination and saved source, including after arrival at an unsaved kingdom.
  Failed writes stay in the current kingdom; late loading/result/network/runtime
  transitions cancel delayed navigation. Close temporary view stores without
  retaining pagehide listeners. 154 focused Node tests pass; browser execution
  remains suspended and WASM is unchanged. See docs/world-travel-recovery.md.

- Qualify native coordinate travel through three actual kingdoms. Six visits
  preserve each region's latest original saved state and advance241 ticks;
  invalid requests refuse,36 tracked roots free, and six post-cleanup saves
  pass. Other allocations grow, so sustained memory bounds remain unproven.
  Browser/co-op activation and hero crossing remain unfinished. See
  docs/native-coordinate-multiway.md.

- Generate and initialize a third native connected kingdom at `0_1`. Apply the
  128-cell extent through original routines after landscape classification and
  before construction; preserve the earlier size-mismatch failures. Original
  gameplay/save, exact neighboring height seams, zero-tick initialization and
  full saved warm-return comparisons pass. Multi-way coordinate travel and
  browser/co-op integration remain unfinished. See docs/native-connected-expansion.md.

- Add native-only coordinate destination requests to original region activation.
  Version2 binds serial/source/target/clock in 36 bytes, refuses missing or
  non-cardinal destinations, and switches coordinates after original save and
  teardown. Native099 qualifies the known pair over 165 ticks and five actual
  refusals; preserve098's missing replay-observation failure. Full saved-state,
  heap and post-cleanup checks pass. Browser, additional regions and spatial/
  co-op travel remain unqualified. See docs/native-coordinate-travel.md.

- Add a Saved kingdoms list to named Frontier maps. Each action scans at most
  128 directory entries and retains eight destination rows, using one cursor
  and no GMP body reads. Selection loads checked saved terrain and preserves
  the world-specific play link. Busy worlds refuse; refresh closes old cursors.
  126 focused Node tests and stopped original-save projection visits pass.
  No native/browser launch or WASM change; seamless/co-op region travel remains
  unfinished. See docs/saved-kingdom-navigation.md.

- Add independent saved-kingdom export/restore to the Frontier map. Archive
  writes use 4 KiB pieces; fallback downloads are capped at 4 MiB. Restore
  validates the file and claims a fresh named world under its existing lease,
  refusing existing directories and publishing only verified native snapshots.
  110 focused Node tests and an exact stopped original-file roundtrip pass.
  Complete profiles, co-op continuation and connected actor ledgers are excluded;
  no game launches or WASM changes. See docs/native-region-backups.md.

- Qualify the original solo palace death path in one owned native trial:
  palace475 starts at700HP, original HP/death-script handling reaches the
  direct DeclareLoss callback, and one original defeat is observed before
  restoring the hook count. Exact native097 and unchanged input evidence are
  preserved. Co-op palace loss, outpost recovery and full competitive/internet
  matches remain unverified. See docs/native-palace-death.md.

- Batch Frontier map camera writes after 250 ms of idle time, or after two
  seconds of continuous movement. Pointer bursts load one latest destination
  per frame. One active write and one pending position bound camera storage
  work; failed writes retain the newest position without a background retry
  loop. Release and native-region navigation flush pending camera metadata.
  Region/building persistence remains durable before eviction. Node tests
  exercise the shipped handlers and slow/failing storage; browser launches
  remain suspended and no WASM change is made.

- Add native request-driven region transitions at completed original ticks.
  Three neighbor requests reach their destinations, with a separate final stop;
  stale and replayed packets refuse while gameplay continues. Actual visits run
  33/45/37/46 ticks and preserve full compared saved state, hero ownership and
  four post-cleanup saves.35 altered evidence cases refuse. Preserve the initial
  compile-only proposal and declaration failure; exact native096 is archived.
  Browser/spatial hero travel/co-op activation remain unfinished; served WASM
  and browser suspension are unchanged. See docs/native-request-region-travel.md.

- Add a native-only automatic region lifecycle using the existing original
  named loader after verified world disposal. Four committed-kingdom visits
  restore, play, save, unload and return with no scripted input or menu selection.
  All saved states/hero ownership,12 heap captures and four post-cleanup saves
  pass;28 altered automatic-trace cases refuse. Exact native093 is preserved.
  Spatial hero travel, co-op activation and browser resource safety remain
  unfinished; served WASM and browser suspension stay unchanged. See
  docs/native-automatic-region-travel.md.

- Reuse exact native092 for twelve committed-hero kingdom visits. All saved
  restores,12 post-cleanup saves,36 heap captures,240 ticks and72 tracked root
  frees pass. Original methods retire11 orphan queues; the tracked4KiB group
  stays9 blocks throughout.49 changed actual-log controls refuse. Preserve the
  stopped inspector's inherited log-cap refusal and fix only the new long-run
  cap. Whole memory bounds, seamless travel and browser/co-op integration remain
  unfinished; no browser launch or rebuild runs. See
  docs/native-repeated-region-travel.md.

- Qualify original recipient-tree replacement across four saved kingdom visits,
  then retire three observed orphaned queues through the original native
  destruction methods. Four post-cleanup saves preserve compared gameplay,
  terrain and hero ownership; the tracked4KiB allocation group remains9 blocks
  instead of growing9→12.45 changed-log controls refuse. Exact native091/092
  are preserved. This is a native-only trial; other allocation growth, sustained
  resource bounds and browser/co-op cleanup remain unfinished. See
  docs/native-orphan-queue-retirement.md.

- Identify retained native message-queue descriptors across four actual saved
  kingdom returns. Each surviving4KiB buffer remains linked to a live queue
  containing one pending message; an empty-buffer cleanup is not appropriate.
  All saved state/ownership and twelve heap captures pass, with20 altered-log
  controls refusing. Preserve the earlier observer-aborted attempt and correct
  its vtable expectation and raw tree-word label. No cleanup or speed gain is
  claimed. Exact native090 is preserved; browser build remains unchanged.

- Reuse native088 to measure allocation growth across the four committed hero
  kingdom visits. All saved state/ownership and twelve complete heap captures
  qualify;20 contradictory actual-metadata controls refuse. A229376-byte group
  appears once and remains, while4096-byte queue blocks grow9→12. No eviction
  or performance gain is claimed. Browser build and game suspension stay exact.

- Reconcile idle buffer eligibility with actual original allocation/free events.
  Four saved kingdom returns retain their state and single hero ownership. The
  one tracked zero-reference survivor fails descriptor admission;30 buffers
  allocated later by the menu remain explicit. No cleanup or performance gain
  is claimed. Exact native088 is preserved and46 focused tests pass. Browser
  build and game-launch suspension remain unchanged.

- Add a native-only idle TILE cleanup experiment at the original front-end
  entry after world disposal. Four corrected sweeps complete without altering
  their heap, clock or world; no eligible buffers are found, so no performance
  improvement is claimed. Preserve the active-checkpoint no-op and missing
  paint-callback failure. Six pinned instruction/refusal controls and38 focused
  tests pass. Browser build and game-launch suspension remain unchanged.

- Verify four original save/unload/load visits in one native process for the
  committed hero worlds. Both initial loads and returns preserve the saved
  kingdom state and unique hero ownership.46 focused tests pass. This uses the
  Load Game menu; seamless browser travel and sustained memory bounds remain
  unfinished, and the served WASM is unchanged.

- Verify fresh original loading and six seconds of normal AI in both committed
  return regions. Preserve every selected typed record and queue before updates;
  the home hero remains inside its guild and the remote hero stays absent.
  Add a bounded single-pass check for references to a removed script agent.
  All100 focused tests pass. Continuous travel, full rest completion and browser
  integration remain unfinished; the served browser build is unchanged.

- Retire the actual remote Warrior through original native methods and publish
  its departed region together with the returned hero's home-region save under
  one stopped owner revision. Preserve other actors and the remote home record;
  four publication interruption cases and six invalid requests pass. Original
  saves/stores remain unchanged, and74 focused tests pass. Fresh returned paired
  native reload, seamless travel and browser integration remain unfinished.

- Verify that a returned Warrior resumes original AI after a fresh native load
  and enters its registered guild. Allow registered heroes to save while inside
  that guild when physical membership, both guild rosters and the AI queue
  agree; reject stale or conflicting residence.74 relevant tests pass. Paired
  return publication, full rest completion and browser travel remain unfinished.

- Restore the actual remote Warrior to its original native guild in an owned
  native trial. Preserve the saved home task across regional clocks, rebuild
  both guild rosters and queue the returned hero through original methods.
  Full-save inspection and50 relevant tests pass. Normal returned AI, paired
  return publication and browser travel remain unfinished.

- Export registered-hero revisions with guild identity and verify both actual
  committed worlds through fresh original native loaders. Re-saved units,
  agents, orders, containers and AI queues match the committed inputs.44 relevant
  tests pass. Return routing, continuous region travel and browser integration
  remain unfinished.

- Verify original source hero/effect retirement and publish the actual source
  and evolved destination saves under one registered owner revision. Preserve
  guild identity and its logical slot; four stopped interruption cases and
  exact retries pass. Fresh paired reload, return travel and browser integration
  remain unfinished.44 relevant ownership/revision tests pass.

- Qualify original destination AI for a restored Warrior and reconnect its
  saved recruit effect to normal command updates. Preserve an actual remote
  return-home request before the original dead-home guard while other agents
  continue. Native ready/evolved saves, original cleanup and 85 focused tests
  pass. Regional handoff, return travel and browser integration remain unfinished.

- Verify fresh original native save loading of an imported Warrior, attached
  recruit effect and registered home reference. Original re-save preserves all
  five imported records exactly. Live travel, hero AI, owner handoff and browser
  integration remain unfinished; the served browser build is unchanged.

- Add explicit registered-hero arrival preparation for remote guild identities
  and returns to the actual native guild. Prepared records participate in
  synthetic ownership transfers without losing the logical guild slot. Read
  clocks from selected saves and retain bounded record copies. All 150 focused
  tests pass; the actual saved hero still refuses unqualified cross-clock
  animation migration. Live travel and the browser build remain unfinished.

- Add explicit registered-hero ownership with a native home and remote guild
  identity. Existing original saves now select one initial Warrior owner and
  reopen without changing either world; exact retries write nothing. Fourteen
  new tests cover membership checks and synthetic transfer recovery. Actual
  hero travel and browser integration remain unfinished.

- Add an inert remote-guild identity record and reuse existing records when
  preparing repeated arrivals. Original native allocation, full-save and reload
  preserve its 453 bytes without a local building or active guild script.
  All 124 focused tests pass. Hero import, return routing and browser travel
  remain unfinished; the served browser build is unchanged.

- Add a bounded return-home task resolver that reads registered guild identity
  and verified hero ownership under one storage lock. It preserves origin IDs
  across changed local aliases and rejects stale, foreign or conflicting tasks.
  All 116 focused tests pass. Existing native saves resolve local home tasks;
  remote routing and live/browser integration remain unfinished.

- Verify a coordinated native Warrior script/command hold with complete saved
  unit, script, orders and attached effect preserved while other units continue.
  Original release completes local guild entry and removes all three hooks.
  All 73 focused tests pass. Remote homes, regional hero travel and general
  suspension still need implementation; the served browser build is unchanged.

- Verify a native original Warrior's local-home script pause and resume before
  the building-use guard. Full held script records remain identical for one
  second; original code resumes to travel and both temporary hooks are removed.
  All 68 focused tests pass. This is a native script gate; physical hero freeze,
  remote homes and playable regional hero travel remain unfinished.

- Verify the original remote-home rejection boundary in an isolated native
  kingdom: a loaded guild passes game-piece validity, while registered script
  agents without buildings fail it. Preserve the previous initialization and
  recruitment build for reproducible checks. All 64 focused tests pass; native
  home routing and playable hero travel remain unfinished.

- Add bounded persistent guild-home registration, alias lookup and travel
  reservation/cancellation. The actual saved Warrior retains its home and
  occupied logical slot across disk reopen and exact retries. Connect the
  registration to actor preparation while refusing unqualified remote homes.
  All 62 focused home/arrival/GPL tests pass. Native routing, recruitment-slot
  enforcement and completed hero travel remain unfinished; the browser build
  is unchanged.

- Retain reciprocal guild script lists in actor-arrival preparation alongside
  native container memberships. Reject incoming references that cannot be
  preserved. Use one bounded typed-reference traversal; the original Warrior
  and earlier NPC inputs pass without changing their prepared payloads. All 50
  focused arrival/GPL tests pass. Persistent remote homes and playable hero
  crossings remain unfinished; no game/browser launch or WASM rebuild ran.

- Extend stopped actor-arrival preparation to retain bounded physical effects,
  their original marker commands and parent/container links. The actual recruited
  Warrior produces five records totaling 2,751 bytes. Reject unresolved guilds,
  omitted effects, collisions and unsupported clocks; require original building
  exit for the inside-guild capture. All 46 focused tests pass. This prepares
  original-runtime inputs; cross-region hero travel remains unfinished and the
  served WASM is unchanged.

- Add checkpointed travel to neighboring native regions and center atlas returns
  on the current region. Preserve one pending destination and cancel it on save
  failure, loading, mission outcome or network handoff rejection. Clip legal
  world-edge preload margins. All 72 focused tests pass; live browser travel,
  hero transfer and full resource bounds remain unverified.

- Add a Play together page for co-op and competitive sessions, separate default
  local host/guest profiles, and shareable chapter/room/relay invitations. Update
  the in-game link to the room actually created or joined and clear it on session
  loss. Joining still uses the original lobby. All 37 focused invitation and
  campaign tests pass; no game/browser launch or WASM rebuild ran.

- Add co-op campaign continuation after locally committed shared victory,
  retaining the selected profile and relay. Recommend the earliest unfinished
  chapter and update it after a successful completion reset. Each chapter
  still starts a new room and kingdom; live chapter transitions remain
  unverified. All 21 focused launcher/progress tests pass without launching
  the browser or game.

- Save verified returned gameplay as revision 5 with the dormant world unchanged
  and exact retries. Prepare the next NPC crossing from that actual state with
  typed positions, targets and clock ages. Audit the newly observed Wait order
  and add bounded stopped inspection. Runtime repeat crossing remains unfinished;
  no native build/game process or browser launch for this step.

- Verify separate serial original-engine loading of both committed return worlds.
  The active NPC restores exact writers and its saved schedule, runs 240 further
  movement/AI ticks, and saves again. The departed world preserves all 527 other
  records and queues. Exclusive ownership remains valid after both reloads.
  Continuous world paging and browser memory remain unfinished.

- Commit both original native return snapshots as ownership revision4, with stable
  identity and owner2142/GPL72 in region0_0. Verify exact retries, eight retained
  files,4096-byte serial I/O and stale launch refusal. Fresh paired loading and
  bounded region residency remain unfinished; served WASM is unchanged.

- Remove the selected evolved NPC through original engine routines and verify
  fresh loading of the departed world. Preserve527 other records and queues,
  then prepare an exclusive paired return request with fresh2142/GPL72 identity.
  Add historical stopped-evidence reconstruction while retaining current launch
  guards. Publication, fresh paired loading and bounded region residency are open.

- Verify a fresh original load of the returned NPC's evolved world. Restore all
  three writer records and the saved schedule without reinsertion, then run240
  further ticks with31 Path calls and40 AI actions and inspect another full save.
  The motion observer reads the loaded collision grid size. Outgoing removal,
  paired ownership publication and bounded region residency remain unfinished.

- Activate the evolved NPC in the isolated native receiving world through original
  spatial, drawing and AI scheduling methods. Verify240 ticks,37 original Path
  calls and40 AI actions, then inspect the original evolved full save. Initial
  insertion preserves all2111 other entity records and saved queues. Fresh reload,
  outgoing removal and paired ownership publication remain unfinished.

- Restore the evolved NPC's actual current commands in the isolated native return
  fixture. Preserve dispatch ages and Move displacement, use original occupied-goal
  resolution to rebuild38 receiving waypoints, verify all three writers and drain
  all18 owned command allocations through original methods. Pass26 refusal controls
  and39 focused tests. Actor activation and paired return publication remain open;
  browser launches stay suspended and served WASM is unchanged.

- Restore the evolved NPC's UNIT/GPL state in an isolated native return fixture.
  Allocate fresh IDs through original methods, rebase the live script clock,
  verify exact original writers and clean up registry/queue membership. Pass39
  focused tests and17 copied-profile refusal controls. Commands, activation and
  paired return publication remain unfinished; browser launches stay suspended.

- Prepare the latest evolved NPC for return: verify typed departure references,
  retain bounded original writer records, reverse known leader bindings, sample
  receiving terrain and defer fresh IDs, clock rebasing and destination paths.
  This is a read-only capsule; native return and ownership publication are still
  pending. Browser launches remain suspended.

- Load a selected evolved revision through serial original-engine source and
  destination reloads, then publish the continued original save as revision 3.
  Preserve dormant state and entity identity, reject stale launches, and verify
  a zero-write CLI retry with eight retained files. Pass 68 focused tests and
  100 offline refusal controls. Real return crossings and browser integration
  remain unfinished; browser launches stay suspended.

- Publish the real NPC arrival and two evolved saves as bounded revisions under
  one persistent identity. Recover after four actual worker exits, reject stale
  writes, preserve exact retries and retain eight files per pair. Pass 68 focused
  tests and 11 existing export corruption controls. Correct stopped-file checks
  for metadata-only ctime changes while retaining inode/mtime/content checks.
  New revision engine integration and real return crossings remain unfinished;
  browser launches stay suspended and served WASM is unchanged.

- Save the transferred NPC's evolved original world and resume it in a fresh
  engine with its changed position, clock, script and commands. Verify two
  240-tick gameplay intervals and a second changed full save; reject 54 offline
  capture/reload corruptions. Ownership revisions and repeated region crossings
  remain unfinished. Browser launches stay suspended and served WASM is unchanged.

- Publish one stopped original NPC transfer with a persistent identity and bound
  source/destination saves. Recover complete ownership after three worker exits,
  then verify both original-engine reloads from the same selected export receipt,
  including destination AI/movement. Pass54 focused tests and19 export/paired
  corruption controls. Repeated crossings and browser qualification remain open;
  browser launches stay suspended and served WASM is unchanged.

- Verify removal and fresh reload of the actual copied Brashnard source NPC,
  preserving all 2,111 other entity records and remaining script queues. Reclaim
  98 allocator blocks and reject 24 removal/37 reload corruptions. Source and
  destination persisted states still require paired ownership publication;
  browser launches stay suspended and served WASM is unchanged.

- Verify a fresh original load of the isolated NPC departure snapshot: removed
  native/script identities remain absent, and a new original full save preserves
  all 501 surviving entity records and both script queues. Reject 37 offline
  corruption cases. Region ownership handoff and continuous streaming remain open;
  browser launches stay suspended and served WASM is unchanged.

- Restore an isolated transferred NPC's AI scheduling through the original queue
  routine and verify that a fresh saved-world load resumes AI without reinsertion.
  Preserve 504 entity records when scheduling and 501 others when removing the
  scheduled NPC; reclaim 98 allocator blocks. Browser launches stay suspended.
  Continuous regions, ownership handoff and browser resource bounds remain open.

- Qualify isolated original removal of a relocated NPC, its script and commands,
  preserving 501 other records, remaining script queues and identity counters.
  Verify reclamation of 97 allocator blocks and reject 20 offline corruptions.
  Fresh departure reload, full script scheduling and two-world handoff remain open.
  Browser launches stay suspended and served WASM is unchanged.

- Correct an opt-in native transfer fixture's cached in-flight Move destination
  through original terrain and coordinate setters. Verify64 compositions and
  one fresh full reload with240 natural movement ticks and41 original Path calls.
  Reject19 offline motion corruptions. Continuous regions and browser resource
  bounds remain open; served WASM is unchanged and browser launches stay suspended.

- Add isolated original full-world save/reload qualification for a grounded NPC
  with its script and populated commands. Preserve501 existing records, verify
  exact joint records in a fresh481-unit original load and reject37 offline
  corruption cases. Active movement, source/destination handoff, expanding regions
  and browser bounds remain open; served WASM and browser suspension are unchanged.

- Qualify opt-in original native identity publication and natural script backlinks
  across 64 grounded NPC compositions, with 192 exact writer records and 68
  monotonic reservations/registry retirements. Pin and require the original ORDR
  command-marker bit instead of rewinding it. Joint reload, movement, activation,
  continuous regions and browser bounds remain open; served WASM is unchanged.

- Compose private grounded actors, scripts and populated commands simultaneously
  across 64 cycles. Verify 192 complete original writer artifacts, reserved script
  identities, exact EA edits and original cached backlinks with allocation recovery.
  Native identity publication, natural lookup, joint reload and activation remain
  open; browser launches stay suspended and served WASM is unchanged.

- Qualify 64 private destination script restorations with original reserved IDs,
  typed reference edits, preserved timer ages and goals matching rebound Paths.
  Compare all 68 original writer files and reject 28 offline corruptions.
  Six original script namespace witnesses and 26 refusal controls also pass.
  Script/actor composition and live activation remain open; served WASM is unchanged.

- Compose grounded private actors with rebound commands and complete original
  routes in owned 64-point storage. Qualify 64 cycles and 64 actual saved-file
  graph replays with independent writer comparisons and allocator recovery.
  Live activation, continuous native regions and browser resource bounds remain
  unfinished; browser launches stay suspended and served WASM is unchanged.

- Qualify 64 private actor restorations at actual destination ground height,
  restricted to parentless mode-one records with inactive navigation caches.
  Verify original cache consumers, exact writers, 320 unchanged refusal checks
  and heap/pool/grid recovery. Live command transfer and activation remain open.

- Add a bounded native terrain ground sampler with the original alternating
  triangles and signed Q16 arithmetic. Verify 79 original CPU cases and 64
  loaded-destination queries with terrain/allocator preservation. Observe small
  saved source-height differences; keep actor Z unchanged pending movement policy.

- Qualify 64 private original actor restorations with fractional region-origin
  transforms and independently translated saved navigation cells. All 256
  original collision checks, exact serialization and allocation cleanup pass.
  Terrain elevation and live crossings remain open; browser launches stay suspended.

- Qualify original destination class collision queries and 68 full native point
  routes across four restored actors. Clear temporary grid pointers and retire
  fixture-owned search caches through original cleanup, recovering heap and CRT
  pool occupancy every time. Live crossings and browser memory bounds remain open;
  browser launch suspension and the existing served WASM remain unchanged.

- Verify actual destination-grid rejection of stale source positions/routes in
  the native region fixture. Clear private cached Path cursor/count, reproduce
  shortened original serialization and reclaim all retained buffers across
  64 cycles. Fresh destination routes and live activation remain unfinished.

- Qualify private restored Path/Follow target edits in a second loaded kingdom,
  using an actual source clock capture and actual destination clock. Verify
  64 cycles, 128 reference edits, 192 timestamp edits and 256 unchanged refusal
  controls. Navigation, entity continuity and live activation remain unfinished;
  the served browser build is unchanged and crash suspension remains in force.

- Verify private restored-command timing across four clock domains with 1536
  original dispatch calls and exact writer/cleanup results. Restore four matched
  Brashnard actors with nonzero Path/Follow references across 64 cycles; the
  diagnostic now finds selected actors even without a player-owned vehicle.
  Destination rebinding, activation and continuous world streaming remain open.

- Restore four copied configured actors with their matching populated command
  banks. Verify 64 native cycles, exact original serialization and 1152 original
  reservation frees without publishing or activating actors. Use the actual
  game's kind-2 factory and retain journal ownership through cleanup.

- Restore original configured vehicles privately before registry/spatial
  exposure. Verify 64 native restore/delete cycles with empty order banks,
  byte-equal PRIMARY/secondary serialization and heap/pool recovery; qualify
  cleanup after a pre-registration refusal. Parented serialization uses read-only
  source context. Live actor publication and playable world streaming remain
  unfinished; browser testing stays suspended.

- Refuse registered or world-associated actors at the private order loader.
  Verify unchanged state on seven admission failures and retain all 201 native
  restoration passes. Audit early registry/spatial exposure in PRIMARY loading;
  full staged actor arrival remains unfinished.

- Move private original order-reader interception into reusable game-owned SDK
  hooks. Verify all 201 restoration trials, partial hook installation rollback,
  cancellation and explicit removal. Production actor arrival remains unfinished.

- Qualify original private vehicle construction and deletion around guarded
  order restoration: 90 complete objects reclaim all 450 pooled allocations.
  Declare the verified GPL resource cleanup entry and verify cache teardown.
  Configured hero arrival and playable world streaming remain unfinished.

- Add explicit ownership handoff for successfully restored private UNIT orders.
  Ninety graphs pass original drain-and-delete cleanup without journal frees;
  changed-owner and stale-reader controls refuse handoff. Full actor arrival
  and playable world streaming remain unfinished.

- Add a guarded whole-UNIT order-reader mode and declare the verified bank
  reader as a function entry for SDK observers. All 201 private original-code
  trials pass, including bank allocation refusals and stopped partial cleanup.
  Populated production arrival remains disabled pending full actor integration.

- Verify loaded order banks through a private UNIT's original getters, writer
  and clearing methods. All 180 healthy graphs serialize exactly and clear
  their bank pointers with tracked memory recovery; 198 trials pass.
  Complete actor construction and live region publication remain unfinished.

- Replace modeled private-loader stream operations with original fixed-span
  C++ streams. All 198 bank trials pass, including original truncation failures
  and 180 graph destructions. A separate 64-trial probe verifies transfer,
  overflow failure and heap recovery. Browser testing remains suspended.

- Execute original factory-manager initialization, cached lookup and deletion
  in the private bank fixture. All 16 registry entries match and 198 trials
  pass; live actor publication and continuous region paging remain unfinished.

- Track original private order-bank destruction in the ownership journal.
  All 180 healthy graphs release their extents through original routines;
  interrupted frees remain explicit and are not guessed or freed twice.
  Live published actor unloading and full-world resource bounds remain unfinished.

- Verify original CRT name allocation/replacement/cleanup without allocator
  interception. Eight 128-name cycles recycle cleared storage and retain a
  stable guest pool; 216281 checks pass. Live actor ownership handoff and
  whole-world resource bounds remain unfinished; browser testing stays suspended.

- Feed JavaScript's real-name reservation descriptors directly into the private
  native loader. All 178896 checks / 198 trials pass with guest heap cleanup;
  live actor publication and expanding-world resource bounds remain unfinished.

- Include original empty-name allocations in JavaScript request budgets and
  scoped claims. All 24 focused tests pass; the 89 copied actor profiles now
  include 264 name bytes. Browser testing remains suspended during the crash
  investigation; no native build or browser launch was needed for this change.

- Reserve the original empty-name copier's one-byte allocations instead of
  treating empty names as free. Native profiles require typed name storage
  by default; original name bodies pass in 198 private bank-loading trials.
  Live actor integration and browser memory bounds remain unfinished.

- Move native order-allocation matching into game-owned guarded construction
  and read scopes. The original bank fixture now uses this controller:
  519 scope checks and 172954 original-bank checks pass. Live actor arrival
  and production allocator-hook installation remain unfinished.

- Add a game-owned native order-storage journal with bounded admission,
  retryable cleanup and storage pinning across nested callbacks. It now backs
  the private bank fixture: 498 ownership, 1073 guard and 175167 bank checks pass.
  Production actor integration remains unfinished; browser testing stays suspended.

- Verify compiled original bank/factory/leaf loading through all twelve native
  allocation hook sites. All 89 copied profiles and a synthetic missing type
  pass, including allocation refusal and stream failure controls: 147121 checks.
  Production actor loading and world resource bounds remain unfinished.

- Verify private original bank construction and allocation rejection through
  real native hooks: 184 checks pass. Fix normal callbacks skipping root
  wrap/after cleanup; all 1,066 stop-boundary regressions pass. Production
  controller integration and actor rollback remain unfinished.

- Compile and verify an opt-in native invocation stop boundary for future
  reserved order loading: 1,066 native checks and eight tooling tests pass.
  Production adapter integration and full actor rollback remain unverified; browser/game
  testing stays suspended.

- Add scoped order-allocation claim decisions for twelve verified native call
  sites. All 1280 original-code allocation frames match and all 329 JS tests pass;
  the live native hook remains uninstalled.

- Add checked order-storage reservation and retryable ownership cleanup before
  native loading. Original methods consume all 89 copied actor profiles under
  bounded models; failed reservations enter no native methods. All 321 JS tests pass.

- Verify original UNIT empty-bank loading/replacement/cleanup under bounded
  helper models. Populated replacement leaves orders allocated; unchecked bank
  and sentinel failures require tracked allocation and checked native loading.

- Add read-only initial order-bank request admission with combined object/list/
  path accounting, canonical empty names and a 64 KiB cap. All 89 copied actor
  estimates match both native fixtures; all 313 JavaScript tests pass.

- Load, rewrite and clean up all copied native three-bank graphs under bounded
  helper models. Bank deletion does not release orders; low-level owned removal
  also cleans up four interrupted loads. Full actor rollback remains gated.

- Round-trip all copied order entries through original construction, reading,
  rewriting and deletion under bounded models. Thirty-two interrupted-read
  cases also release unlinked empty-name state; bank/actor rollback stays gated.

- Execute original order factory and fresh constructor/deleting-destructor
  chains for eight types under bounded allocation models. Kind 7's unchecked
  inner allocation requires explicit path readiness before future loading.

- Qualify original order-bank failure control flow under bounded helper models.
  Partial insertion and ignored leaf errors require checked loading and rollback;
  existing source admission rejects three unsafe version/kind fixture inputs.

- Inspect typed source navigation fields and canonical path cursors for native
  Move Path and queued movement orders. All 39 copied paths and 308 JavaScript
  tests pass; source routes still require destination reconciliation.

- Add partial common-dispatch clock rebasing for eight order layouts, including
  unsigned wrap, zero stamps and pause flags. Bounded original CPU checks and
  all 304 JavaScript tests pass; live clock capture and full migration stay gated.

- Add partial UNIT-target binding plans for Move, Move Path, Follow Unit and
  Init Action orders. All 54 nonzero fields in the copied saves match saved
  units; destination compatibility and complete command migration stay gated.

- Round-trip all 154 literal copied-save order entries through original native
  leaf readers/writers under bounded fixture models, without normalizing bytes.
  Full-bank construction, callbacks and live restoration remain unverified.

- Execute bounded original order reader/writer round trips and add path storage
  admission. Kind 7 is limited to its ten-point constructor buffer; kind 4's
  saved capacity and aggregate storage are checked. Populated arrival stays gated.

- Add read-only order callback inspection and partial base script-agent
  remapping plans. All seven nonzero base IDs in the copied saves match their
  actors' agents. Unknown leaf references reject; populated arrival stays gated.

- Identify kind 6 Follow Unit targets through pinned original producer, writer
  and consumer code. All 25 targets in the copied saves match saved units;
  populated-order migration and live hero travel remain disabled.

- Extend native order inspection to kinds 6, 7, 10 and 11, covering every
  order attachment in the two copied checkpoint fixtures. Migration remains
  disabled until reference, clock and navigation semantics are qualified.

- Add bounded structural inspection of populated native order kinds 1, 2, 4
  and 5, including streamed path points. Target/clock semantics and playable
  command migration remain unfinished.

- Preserve the canonical three-bank empty native order attachment during actor
  arrival preparation, changing only its actor identity. Active orders and
  engine consumption of the new record remain unfinished.

- Add bounded, read-only native cache retirement plans. Synthetic list tests
  and isolated original lookup/update checks preserve surviving records;
  live engine retirement and complete regional cleanup remain unfinished.

- Prepare an opt-in conservative WASM growth profile in the official build
  tool. Configuration and numeric model checks pass; the served game has not
  been rebuilt with this profile.

- Regional and paired checkpoint readers reuse the source that passed validation,
  reducing file opens and avoiding consumption of an unvalidated replacement.

- Shared campaign victories can retry a failed local completion save from the
  game panel, including after the game stops. Save status stays visible across
  duplicate result messages, and simultaneous retries share one save attempt.


- Extend isolated native NPC restoration to explicit receiving leader and map
  size, with bounded128-point original routes. The next continued NPC restores,
  runs original movement/AI, saves, and reloads in the smaller receiving map.
  Preserve exact earlier native build evidence across source updates. Eight
  corruption controls pass; outgoing removal/paired handoff, continuous world
  paging and browser integration remain unfinished.


- Complete the next original NPC outgoing removal/fresh reload and paired save
  publication with fresh receiving identity, exact retries and bounded storage.
  Seven invalid handoff requests preserve the selected save on copied stores.
  Committed paired native loads and genuine expanding-world residency remain
  unfinished; the browser launch suspension stays active.

- Verify fresh original-engine reloads of both committed transfer maps: the
  receiving character continues original movement/AI, the other map preserves
  surviving state without a duplicate, and both resulting saves retain exclusive
  character ownership. Native region unloading and browser memory qualification
  remain unfinished; browser game testing stays suspended.

- Add an isolated native probe for the original whole-world disposal path.
  Three map loads and teardowns release the tracked world/navigation roots and
  retain a valid heap. The independent gate rejects incomplete exit0 runs and
  contradictory retirement traces. Save-before-unload, generated adjacency,
  sustained residency bounds and browser integration remain unfinished.

- Save evolving original region state before native unload and restore it on
  revisit, including both original RNG states. Independent full-section and
  entity checks pass;15 corrupt/stale-state or trace cases refuse. Generated
  adjacency, seamless travel, sustained residency bounds and browser/co-op
  integration remain unfinished. Browser game testing stays suspended.

- Extend the native persisted-world diagnostic to bounded longer journeys.
  Twelve visits preserve all saved state and retire72 tracked roots. Audit the
  original unit-ID-keyed order-container serialization and retain all command
  bytes across its observed permutation. Twenty-four corrupt/stale/trace/resource
  cases refuse. Native RSS samples and remaining retained allocations are
  recorded; sustained memory bounds and browser integration remain unqualified.

- Measure original scripting registries and reusable value-pool storage during
  twelve native save/unload/revisit cycles. Preserve original null registry
  slots and audited reconstruction between loads; record batches separately
  from individual values. All36 observations qualify, and25 contradictory
  observations refuse. Registry counts and batch counts remain stable while
  retained heap/CRT allocations rise; investigate other owners and nested
  resources before changing storage retirement. Browser testing stays suspended.

- Add bounded original CRT boundary-tag accounting to the native region journey.
  Thirty-six observations reconcile live size classes, committed page capacity,
  known CRT pool backing and remaining heap bytes. Thirty contradictory
  observations refuse; all persisted revisits still qualify. The larger-region
  increase includes one additional pool reservation and other heap allocations;
  live small-block byte growth is much smaller. No allocator retirement changes
  or browser launches; sustained memory bounds remain unfinished.

- Add bounded runtime heap metadata pagination, with 978 focused checks passing,
  and qualify 36 read-only captures across 12 native region visits. Remaining
  allocation size groups locate growth without inferring safe cleanup. Record
  the 50 ms save-to-teardown gap on all visits; exact pre-teardown checkpointing,
  sustained memory bounds and continuous travel remain unfinished. The broader
  runtime suite still reports two import-coverage failures. Browser testing
  remains suspended because of the app crashes.

- Correct native region persistence to save after the complete original tick
  and request exit before another simulation update. Twelve visits retain saved
  state with zero clock/tick advance through teardown. Original dispatcher and
  phase jump tables are audited. Retained allocation growth, generated terrain,
  seamless travel and browser/co-op integration remain unfinished.

- Trace the original data-loader allocation behind retained 12,208-byte heap
  blocks. Twelve native visits preserve saved state while recording 182
  allocations and 180 frees; 20 contradictory trace/instruction cases refuse.
  This size group largely turns over between loads and settles on later visits.
  Audit its original buffer replacement/destruction path before considering
  cleanup. Live ownership, other heap growth and sustained memory bounds remain
  unqualified; browser testing stays suspended.

- Observe native data-buffer owners and embedded cache reference counts across
  twelve original region visits. Qualified cache entries retain buffers with
  zero references at the observed boundaries; 36 contradictory cache checks
  refuse. A separate 4 KiB allocation group grows by 48 KiB, directing further
  tracing. No eviction or performance improvement is claimed. Browser launches
  remain suspended; the served WASM is unchanged. See docs/native-buffer-cache.md.

- Trace retained 4 KiB world allocations to the original per-tick message queue
  and pin its caller. Twelve visits record 396 allocations and 383 frees;
  corrected active caller metadata is qualified across four further visits.
  Reject an unknown-size sentinel in the diagnostic probe and preserve the
  unqualified attempt. Queue retirement and sustained memory limits remain
  unfinished; browser game testing stays suspended. See docs/native-page-queues.md.

- Load a private reconciled-border map and save it through Majesty's original
  native menu. All 16,641 height bit patterns, opaque vertex words and 16,384
  cell records survive; 202 cached shading bytes change. Preserve the source
  draft and isolate the test profile, with one native process and bounded
  duration/RSS sampling. This proves one modified-terrain load/save, not
  continuous travel, navigation, co-op terrain publication or browser memory
  limits. See docs/native-terrain-reconciliation.md.

- Show saved buildings and mobile units on the Frontier altitude map, colored
  by kingdom and rendered on the existing canvas. Stream placement metadata
  under the world read lease, omit unresolved parent positions, and retain at
  most 64 markers per loaded window. Include marker buffers in scene memory
  accounting and retire them with offscreen terrain. Sixty-two focused tests
  and one real stopped native save pass; browser canvas and full-engine memory
  qualification remain suspended. See docs/native-atlas.md.

- Generate two experimental neighboring Frontier kingdoms with one global
  height recipe. Install geometry after original terrain generation and before
  player setup, with empty registry/grid checks and original normal rebuilding.
  Both kingdoms render and save through Majesty's original engine; all 129
  shared edge heights match. Six focused tests pass. Seamless travel, matching
  edge materials/lighting and sustained engine memory remain unfinished; the
  served browser build is unchanged. See docs/native-connected-terrain.md.

- Extend the native unload/revisit prototype to both generated neighboring
  kingdoms. Four serial visits preserve each region's evolving original save
  on return, including entities, commands, queues, clocks and RNG; all six
  tracked roots are freed once on each exit. Keep first-load primary-field
  differences as explicit qualification failures. Twelve tests and fourteen
  corruption controls pass; full handoff, hero transfer and sustained browser
  memory remain unfinished. See docs/native-connected-residency.md.

- Initialize both generated neighboring kingdoms through the original loader
  and save them before any simulation tick in the native prototype. Both
  initialized checkpoints return with saved gameplay state intact, then play
  and unload through original methods. Preserve raw generated inputs and their
  measured first-load changes. Nine focused tests and 26 copied-observation
  refusal controls pass. Seamless browser travel and sustained resource limits
  remain unfinished. See docs/native-connected-residency.md.

- Add an isolated native recruitment runner for initialized generated kingdoms.
  Original UI recruitment and saving produce a player-owned Warrior with its
  actual guild-home, script schedule and attached-unit records. Keep inside-
  and outside-guild captures distinct, and leave hero travel unqualified.
  See docs/native-generated-hero.md; the served browser build is unchanged.

- Default newly constructed GPL agent saved scalars deterministically; preserve
  existing nonzero saved values through the original reader. Five native solo
  visits and four saved returns pass. Full co-op world equality still refuses
  terrain/UI differences; browser publication remains unchanged.

- Seed the separate original terrain RNG for agreed co-op generation and
  initialize omitted new view values while preserving existing saves. Native
  host/recipient fresh worlds now match, and both original roles resume through
  unchanged recorded peer messages. Live paired play remains unqualified;
  the published browser player is unchanged.

- Qualify matching stopped original co-op progression after fresh travel at
  clock500/frame10. Add a guarded native original-writer observation preserving
  departure saves and a narrowly audited local advisor-clock comparison, with
  93 focused tests and23 refusal controls. Private WASM069 static qualified;
  live paired play/saved co-op return remain unfinished and browser suspension
  remains in force.

- Replay the bounded actual original host completion stream with its latency Ping intact. Original recipient175 produces its own same-timestamp Pong; full gameplay matches at clock500 and the recipient advances to1500. 84 focused tests pass. No live paired or later full-state qualification; browser publication unchanged.

- Verify full original co-op gameplay equality at clock1000/frame20 after fresh travel. Fourteen unchanged captured guest inputs receive authentic relay ACKs; timed delivery preserves their50ms two-frame cadence. Extend the owned smoke script ten seconds because its earlier EOF cut off input delivery.103 focused tests and10 evidence controls pass. Both recorded roles preserve both kingdoms and matching37 changed unit records after500; saved cooperative return and live paired browser play remain unfinished.

- Verify the original co-op host's second pause and saved west-return proposal. Both full region stores are retained: current1_0 atclock1450 and unchangedhome0_0 atclock550. Actual SDK serial2 Begin/local Ready execute;157 focused tests pass. Second-trip peer votes, return completion and live paired/browser play remain unfinished.

- Allow guarded co-op saved-target import when the host and local view saves share a region revision and clock. Preserve the local file in the other slot, verify authoritative bytes before selecting them, and retain older-revision rejection. Official native checkpoint tests/build pass; saved return gameplay qualification and browser publication remain pending.

- Qualify native cooperative saved-return checkpoint import/Ready and original recipient saved-reader Loaded after fresh travel; preserve both kingdoms’ matching neighboring-region state atclock1550 and original homeclock550. Added recorded second Ready commit gating. Shared return resume and browser publication remain pending.

- Independently qualify full native recipient saved-home preservation after fresh co-op travel. Native-only deterministic return trigger and held-home writer added. Recorded second-source import now preserves actual captured source bytes while saving the live graph for comparison; shared return resume still pending.

- Fix the native cooperative replay startup race: wait for the host player to register in a newly published empty room before joining. Real-relay regression reproduces delayed registration and verifies unchanged initialization packet ordering.

- Verify native cooperative saved-home Complete/resume for both recorded roles, preserving both kingdoms and full authoritative gameplay. Retire the completed first-trip input observer before later resumes and gate second host Loaded/resume on the recipient original reader/full writer.149 focused checks pass; repeated residency and live paired browser play remain pending.

- Verify continued native co-op home gameplay and a third saved-neighbor proposal. Preserve both castles/all ten home buildings and both earlier region checkpoints; admit seven unchanged actual peer inputs through real relay ACKs. Home advances torevision2 atclock1650.160 focused checks pass; third shared arrival and repeated residency remain pending.

- Native448 recipient258 now transfers/imports the exact saved neighbor and
  completes its original third saved reader/rebuild/Ready/Loaded while retaining
  updated home1650/revision2 and both kingdoms.213 focused checks and independent
  stopped-save inspection pass. Third host load/shared resume and repeated
  residency remain unfinished; browser publication is unchanged.

- Native449 independently verifies the full third saved-neighbor reader/rebuild/held writer, preserving both castles, buildings, owned mobile actors and all authoritative gameplay atclock1550. Adds native-only later-trip source/full writer fixtures and real-barrier third resume gating;261 focused checks pass. Third host/shared resume and repeated residency remain pending; published browser player unchanged.

- Qualify native449 host280 third saved-neighbor load/full writer/Complete/resume, preserving its actual departing home and restored neighbor. Reduce inactive fixture report writes; recipient third resume and repeated residency remain pending. Browser publication unchanged.

- Qualify native449 original third saved-neighbor Complete/resume for both recorded roles, preserving full source/target gameplay and both kingdoms. Third-completion fixture admits exactly one additional authenticated RPC with refusal coverage;269 focused tests pass. Repeated residency, shared campaign outcomes and live paired/browser publication remain pending.

On 2026-10-08, after explicit user authorization lifted the browser suspension, private WASM070 passed an actual two-browser co-op trial through the local WebSocket relay. Both clients resumed five transfers across `0_0`, `1_0` and `1_-1`, including two fresh generations and saved returns. Ten sampled original-engine checksum pairs matched; after the fifth transfer, both original result screens confirmed victory and both profiles saved shared Chapter 1 completion. Opening the campaign pages after releasing the games confirmed one completed chapter per profile. The original multiplayer winner notice requires acknowledgement before the shared result callback returns; the intermediate notice was initially misread as a mission bug. Five resumed managed-heap samples stayed around29MiB; they do not establish sustained browser/GPU resource bounds. Independent internet connections, longer paired residency and publication remain pending. The served default player028 is preserved. Evidence: `output/browser-coop070-five-trips-qualification.json`;38 focused JavaScript tests and official WASM/static/package checks pass.

- Center the multiplayer invitation tab above the game so its collapsed control leaves the upper-left minimap accessible. Private277 candidate; browser confirmation pending.

- Bound unacknowledged co-op pause/travel requests and offer recovery without claiming a new save. Distinguish an original result being settled from final shared completion. Private288 normal paired saving verified; original end-dialog recovery verification pending.

- Fix the original loading artwork extraction so its right edge no longer wraps
  and the bottom logo is fully visible.
- Keep the loading artwork at its smaller original size from the start, centered
  on black and fitted proportionally on smaller screens.
- Author a private v2 Wayfinder/Trail Lodge candidate with original sprite art,
  melee/staff equipment and scouting/support scripts. Native art and paid
  recruitment are exercised; ability scheduling and release remain unqualified.
