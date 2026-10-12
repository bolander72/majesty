# Majesty in the browser

Local WebAssembly build of the original Majesty engine, using
[majesty-recomp](https://github.com/veritr1x/majesty-recomp) and its
[recomp-kit](https://github.com/veritr1x/recomp-kit) runtime.

This is an active development project. Local browser gameplay, two-player
co-op save/resume, responsive rendering, regional world travel and portable
player backups have been exercised in bounded trials. The Wayfinder hero and
Trail Lodge building pass private native and browser construction, recruitment
and save/reload trials; general installation and matching-content co-op remain
unfinished. The restored Chapter 3 co-op mission has not yet reached victory.
Separate-network full matches and the historical host-app crash cause remain
unverified. Later sections retain individual qualification limits.

The repository contains the authored browser source, tooling, tests, content
drafts and patches for the pinned upstream game/runtime. Purchased game assets,
executables, generated translations, compiled WASM, personal saves and local
trial output are excluded. See [the source publication notes](docs/source-publication.md).

## Current content milestone

The current priority is playable new content: make the verified Wayfinder hero
and Trail Lodge available through ordinary browser content installation, then
add a new mission that uses them. The authored sources are in
`content/wayfinder-trail-lodge/`. Native and browser paid recruitment and saves
have been exercised privately. A separate browser import and launch to the actual
main menu now pass; release publication and a new mission remain unfinished.

Co-op joining, shared saves and resume have already been exercised. Completing
the restored Chapter 3 mission is deferred and is not a prerequisite for this
content milestone. Full-match and separate-network verification remain open
work, to be revisited when a content or network change requires it. Preserve
existing campaign progress and checkpoints while developing new content.

## Hosted game

The static browser engine is deployed at <https://majesty-tau.vercel.app>.
`majesty.boland.co` is attached to the Vercel project and awaits its Cloudflare
DNS record: CNAME `majesty` → `7f0010370b549dbf.vercel-dns-017.com`, DNS only.
The root loads Majesty’s native menu automatically. A new browser downloads
and verifies the hosted asset bundle, caches it locally, then starts the engine.
There is no file picker or welcome screen. Use `/?setup=1` only for optional
file/save management outside the normal game entry.

Imports and saves belong to their website origin. A localhost collection is
separate from the hosted domain; use the player backup page to carry existing
saves across. No login is required. The static deployment contains the engine and frontend;
the classic asset bundle is delivered separately through Vercel Blob. Player
saves stay local. Original assets and personal saves remain excluded from Git.
The Wayfinder entry requires its separately prepared content import for now.
The multiplayer relay still requires its own production hosting/configuration;
this static deployment does not establish public co-op readiness.

Prepare a static deployment from a pinned local frontend receipt:

```sh
python3 scripts/prepare-vercel-site.py \
  --source-package upstream/majesty-recomp/build/frontend-wayfinder396/site-edition.json \
  --automatic-assets output/hosting403-automatic-assets.json \
  --output output/hosting403
```

Choose a new output directory for each preparation. The builder verifies every
source file, compresses WASM with a verified roundtrip, supplies COOP/COEP headers,
and creates Vercel Build Output v3. Link that output directory explicitly to the
`majesty` project, verify its owner/project, then deploy with
`vercel deploy --prebuilt --prod`. Engine artifacts are local build inputs;
pushing this source repository alone does not rebuild or redeploy the engine.

## Play locally

```sh
./scripts/play.sh
```

Open <http://localhost:8000/> in a browser with WebGPU support. On first use,
choose **Import ZIP…**, select `output/majesty-game.zip`, then choose **Play**.
Each browser stores its own imported copy and saves. Game files stay local.
The browser build skips the opening movies. After loading the engine and game
data, it opens the original main menu; the first launch can take several seconds.

Keep the server running while playing. An optional first argument selects
another port, for example `./scripts/play.sh 8001`; a different port uses a
separate browser storage area.

## Responsive view and optional render quality

The game automatically fits the browser viewport. Resizing the window changes
its world view and moves the HUD's edge controls; sprites retain their proportions.
There is no gameplay viewport picker. Small screens use a uniformly fitted
800×600 minimum logical layout, retaining the browser's aspect ratio.

From **Adjust Settings → Screen Resolution**, choose **Fit browser (automatic)**
for the default behavior. The other presets set a preferred rendering height:
1080p, 1440p or 4K, with width calculated from the current browser shape.
These rows are labeled as render quality rather than fixed viewport sizes.
Choose **Apply**, then confirm **Yes** within ten seconds. Cancel or timeout
restores the previous setting. This preference is stored in the browser profile.
Original sprites and fonts retain their existing detail; higher rendering heights
show more world space and make the original interface smaller on a small screen.

The adapter creates a transient interface layout from the installed game's
verified native 1080p asset. It updates the guest's DirectDraw surfaces, camera,
clipping regions and active HUD together on the game thread. The canvas fills the
browser using its current CSS dimensions, including dynamic mobile viewport height.

The generated ZIP includes the responsive layouts. For a browser with an
older import, regenerate it and import it again; importing game data preserves
the separate player profile and saves:

```sh
python3 scripts/import-game.py upstream/majesty-recomp/original/gog
```

The generator accepts only the measured native-layout SHA-256
`8f78769a4d4dfec01fd671dc308cd33b1ecacc3cc36c957f4f35743a40932c04`.
Generated game assets stay in the ignored ZIP and are not included in source.

## Build

```sh
./scripts/setup.sh "/path/to/GOG Games/Majesty Gold HD"
```

On this Mac the installation argument is optional: the script defaults to the
existing Majesty Gold HD app's GOG directory. Setup requires Python 3.12, an
OpenJDK installation, and Xcode's build tools. `MAJESTY_PYTHON` and
`MAJESTY_JAVA_HOME` override the Python executable and JDK directory.

Setup installs tools locally in `.tools/`, verifies the original executable,
exports its functions through Ghidra, packages the game data for local import,
and builds the browser target. It links the installed game into the upstream
checkout's ignored `original/gog` directory.

For subsequent builds:

```sh
./scripts/build-web.sh
./scripts/build-web.sh --regenerate  # after changing translation rules
```

The supported executable is the bundled `MajestyHD - Old.exe`, SHA-256
`654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542`.

## Pinned inputs

- Majesty Recomp: `21186b12979414f6eb4a83db47a1283a8d8fbfea`.
- Recomp Kit: `eb32cc42623e0e9e868b9d27423a57d5a5cba56b`.
- Emscripten: `6.0.10`.
- Ghidra: `12.1.3`, with locally built Apple Silicon native components.

The WASM build and launcher are in
`upstream/majesty-recomp/build/web-site`. Original assets, generated game code,
tool installations, binaries, and browser profiles are local build inputs and
outputs; they are excluded from this repository.

Local source patches in `patches/` add a bounded cache for the browser's imported
files, use absolute canvas mouse input, preserve short clicks across the game's
button polls, and skip intros through Majesty's own `-nointro` option. Setup
applies them without replacing unrelated local changes.

The browser starts with eight preloaded thread workers and 512 MiB of WASM
linear memory. Workers and memory can grow when needed. Optional
`?RECOMP_BROWSER_RESOURCE_DEBUG=1` logs worker counts and memory-size changes;
these counters exclude GPU allocations and other browser memory. The multiplayer adapter reuses bounded receive storage on empty polls. Visible
performance statistics are prepared only at their four-per-second refresh
cadence. The Frontier atlas renders on demand and unloads distant regions.
Frame-rate and total browser-memory measurements remain separate qualification
work.

Regional browser checkpoints now record the exact imported content identity,
including mods. Automatic resume requires matching completed metadata;
older saves can be loaded through Majesty's original menu and checkpointed
again. A fresh browser save/leave/resume cycle has passed with this binding.
See [regional qualification](docs/frontier-world.md).

## Verification

WASM070 passes live two-browser co-op travel: a local five-transfer trial saved
shared Chapter 1 victory on both profiles, followed by 16 transfers across five
regions through a public TLS WebSocket relay. All 16 sampled checksum pairs in
the public trial match; shared surrender produces defeat on both clients and
does not mark either campaign complete. Resumed managed game allocations stay
between 28.7 and 29.2 MiB per client over that trial. This does not measure total
browser/GPU memory, transfer peaks or unlimited expansion. Both clients used
the same machine/network; separate internet connections remain untested.

The main entry routes now open `/releases/player072/`, which includes the
expanding co-op world launcher and portable player backups with the qualified,
unchanged WASM070 engine. Choose
**Expanding co-op world** on [Play together](http://localhost:8000/multiplayer/),
then select a shared world name, starting region and your personal save profile.
Invitations carry shared settings; each partner chooses their own profile.
The normal launcher flow passes a two-browser fresh-region transfer, saved
return and shared Chapter 1 victory. Both profiles retain completion, world and
region in campaign navigation. The interface passes 65 focused JavaScript tests.
New chapters require a new world name because regional checkpoints share a
world namespace across chapters. Both partners must be online; stopped expanding
world restart remains unverified. Saved returns are qualified during a running
match. Publication evidence is in
`output/world-launcher071-publication/published-entry-qualified.json`.
Versioned engine URLs preserve the engine files used by existing game tabs.
Player profiles and imported game files remain in the same browser storage.
See
[the travel evidence](docs/native-cooperative-world-saves.md).

The [co-op campaign page](http://localhost:8000/campaign/) now offers named local
save profiles without a game login. Chapter links use the selected native save
profile, and completion/reset records are separate for each profile. Existing
chapter completion remains with the default profile. The legacy save ZIP still
omits chapter and Atlas databases. The new [Player backups](http://localhost:8000/backups/)
page exports native save profiles, chapter completion and Atlas region/camera
databases together. Restore validates every file before writing and requires a
fresh save collection, preserving existing progress by refusing conflicts.
The worker streams native bytes into one completed temporary archive, independent
of subsequent native save changes. Clear that cached copy after its download
finishes. Real isolated OPFS/IndexedDB roundtrips, failure rollback, interrupted
restore recovery and the shipped worker preview pass; the combined focused suite
passes 78 tests. Game/mod assets are imported separately. The new backup has not
been used to launch a restored native match. Optional cloud integration and
offline co-op branches remain in [the save design](docs/player-saves.md).
The local progress change passes 64 JavaScript tests and an isolated browser
storage/adapter trial; that trial does not represent a new engine match.

The campaign page recommends the earliest unfinished chapter for the selected
profile. After shared victory is saved locally, the game panel offers the next
chapter with that profile and relay retained. Both players must choose the same
chapter and create or join a new room; each chapter starts a new kingdom.
The final chapter returns to campaign progress so unplayed chapters can still
be completed. The expanding-world Chapter 1 victory → campaign progress →
Chapter 2 setup flow has passed live browser qualification. Starting Chapter 2
from that setup has not been retested. The user authorized live browser tests
again on 2026-10-08; the historical host-app crash cause remains unresolved.

An opt-in isolated actor fixture now passes 64 original primary-record restorations
and removals in both native and WASM. The complete primary bytes match after a
fresh unit ID is normalized, guest heaps return to baseline, and both kingdoms
continue afterward. The test also exposed and repaired missing collision-grid
cleanup before deletion. This has not yet moved a hero between native regions;
full activation and external references remain open. See [restoration qualification](docs/frontier-world.md).

On this Apple Silicon Mac, the original executable translated and the full
Emscripten build completed. The current build ran **Quest for the Holy Chalice**
in the Codex browser, rendering the original palace, terrain, units, minimap,
and interface, with the mission clock and gold counter advancing. Mouse input
selected palace buildings, panned through the minimap and screen edge, and
ordered a gnome hovel: gold fell from 5,715 to 5,615 and the foundation appeared.
The hovel completed at 75/75 HP, could be selected, and recruited Quido Klup,
shown resting in its hero roster. The first playable browser milestone is
verified. A Beginner Random freestyle quest also ran during testing, but
another generation crashed as described below.

Local screenshot evidence is in `output/majesty-construction.jpg` and
`output/majesty-browser.jpg`.

The portable suite passed **414 tests**, with **4 skips**. The game configuration
suite passed **5 tests**. The final platform suite passed **212 checks**,
including repeated reads, backward seeks, window boundaries, EOF, refill
errors, press visibility, stalled-frame release, independent buttons, and
frame-counter wraparound. The full web target rebuilt after the input change.

On 2026-10-02, the browser saved the Holy Chalice mission, retained its profile
across the updated 167-file ZIP import, and reloaded the save at native 1080p
and 4K. Both modes rendered the expanded world view and accepted palace
selection; the relocated 4K Options button also opened its original dialog.
The original 800×600 setting was restored afterward. Evidence is in
`output/majesty-1080p.jpg`, `output/majesty-4k.jpg`, and
`output/majesty-resolution-settings.jpg`.

The layout suite passed **4 tests**, checking both target geometries, preserved
resources and control bindings, and rejection of unverified inputs. 1440p is
available and covered by those checks; mission play was exercised at 1080p
and 4K. This verifies resolution behavior, not a frame-rate target on a 4K
display. Run the layout checks with `python3 -m unittest discover -s tests -v`.

The responsive adapter was then exercised in the running Holy Chalice save:
839×853 → 1280×720 → 839×853 → 320×568 CSS (800×1420 logical) → 3840×2160
→ 1371×779. The world and HUD followed each size, palace selection and minimap
input worked, and the clock advanced from four to five days. This verifies
viewport fitting; a dedicated mobile touch layout remains future work.
Optional 1080p quality persisted across reload at 1231×1080 logical pixels in
a 972×853 CSS viewport. Declining 4K restored automatic 972×853 sizing, and
the normal browser profile was returned to automatic afterward.

Opening movies are excluded from this build. Audio, full campaign completion,
and an expanded world have not yet been verified. A two-client multiplayer
skirmish and all three co-op chapters have completion evidence below. Separate-household
internet play and a full competitive match remain unverified.
The random freestyle generator can throw an original game exception that the
runtime cannot yet unwind; a successful load does not establish its stability.

## Expansion investigation

An opt-in [Frontier co-op campaign](http://localhost:8000/campaign/) and a
[world streaming experiment](http://localhost:8000/world/) are now staged by
the build and play scripts. The world experiment uses one canvas, bounded
region loading and durable watchtowers. The atlas can now open a native region
in its own save profile, with a whole-world checkpoint control and automatic
restoration verified for a fresh Scions checkpoint. Seamless streaming and hero transfer are
unfinished. The generated atlas terrain is separate from Majesty’s terrain. See [implementation and remaining integration](docs/frontier-world.md)
for the engine constraints and exact qualification status.

The native Frontier panel now offers save-and-travel controls for the four
neighboring regions. It waits for a successful checkpoint before opening the
destination and restores that region's existing kingdom when available. A new
region still needs a game started there. Returning to the atlas centers it on
the region just visited. This adapter flow passes 72 focused JavaScript tests;
live browser travel and whole-browser memory bounds remain unverified.

In a named world's atlas, **Show saved Majesty terrain** now includes building
squares and mobile-unit markers colored by kingdom. The view reads the last
checkpoint, retains markers only for loaded windows, and draws them on the
existing canvas. Units inside buildings are omitted and crowded windows cap
their marker count. Sixty-two focused tests and an isolated native save with
three buildings and five mobile units pass. This is a saved-map view; dormant
kingdoms do not simulate and heroes do not cross regions yet. See
[saved atlas behavior and bounds](docs/native-atlas.md).

Playing and keeping progress should remain possible without a required game
login. Local portable profiles, optional cloud backup and proposed solo
branches while a co-op partner is away are recorded in
[the player save design](docs/player-saves.md). The launcher's current save ZIP
does not yet include chapter-completion or atlas databases; full portable
profiles and absent-player continuation are still future work.

Initial source and community research, 2026-10-01. The table records the
original investigation; current campaign and streaming status is described above.

| Feature | Existing foundation | First useful proof |
| --- | --- | --- |
| More maps and missions | The installed SDK includes quest templates, GPL scripts, character/building descriptions, CAM data and a compiled example quest. | Load one separate custom quest with a visible rule change in the pinned browser engine. Check its loader and bytecode compatibility first. |
| Cooperative skirmishes | Original multiplayer supports separate kingdoms, cooperation, visiting other kingdoms' buildings and team-aware rules. The browser transport now supports a synchronized two-player skirmish. | Verify an allied ruleset with shared victory and team behavior. |
| Cooperative campaign | Narrative quest scripts are available. Several, including Holy Chalice, select the first palace from a palace list. | Adapt one short quest for two allied palaces, with joint objectives and team victory/defeat; do not assume original quests become cooperative automatically. |
| Competitive mode | Stock victory scripts include gold targets and Last Palace Standing, plus team-number handling. | Run one repeatable two-player match with identical content and seeds, verified outcomes, and disconnect handling. |
| New hero classes and guilds | XML descriptions, GPL behavior and CAM artwork provide content extension points. Modern community tools add custom recruitment and interface support. | Recruit one distinct class, observe its behavior and abilities, then save and reload it. Port any required native support to our exact engine version. |
| Persistent expanding world | Separate missions and saves offer a possible regional foundation. Seamless world streaming has not been established. | Save one region, travel to another, and restore the first while preserving campaign progress. Audit engine map limits separately. |

### Networking boundary

The [Play together page](http://localhost:8000/multiplayer/) provides co-op or
competitive selection, a local save profile and shareable invitations with
the chapter, room name and relay. Invitations give guests a separate local
profile by default. The in-game invitation panel updates to the room actually
created or joined. Players still create/select that room in Majesty's original
lobby; a link does not automatically join it. The entry/invitation flow passes
37 focused JavaScript tests together with campaign progression, without a new
engine match. Live browser testing resumed with user authorization on 2026-10-08;
the earlier crash cause remains unresolved.

[Cyberlore's FAQ](https://www.cyberlore.com/majesty/majesty-faq.htm) and the
[original manual](https://cdn.akamai.steamstatic.com/steam/apps/25990/manuals/Majesty_Manual_HD.pdf)
describe cooperative and competitive multiplayer. The browser runtime now
implements room discovery, creation/joining, player rosters, ready/start and
unchanged original game packets over a self-hostable WebSocket relay. It uses
the original DirectPlay 4 ANSI and Lobby 3 ANSI call contracts without requiring
storefront accounts.

Run `./scripts/multiplayer.sh` in a second terminal alongside `./scripts/play.sh`.
In the game, choose **Multiplayer → Play Over LAN (TCP/IP) → Accept**; that
original label now selects the browser relay. Create Game opens a room; another
browser selects the room and Join Game. The guest clicks Ready, then the host
clicks Start Game. For two tabs sharing one import, use
[the separate guest profile](http://localhost:8000/majesty/?profile=multiplayer-guest)
for the second instance. The default relay is local port 8002.

On 2026-10-02, two browser clients loaded a **Random (Beginner) competitive
skirmish**, with separate kingdoms and Eliminate all foes. They produced **24
identical original-engine checksums**, every 200 simulation frames from 199
through 4799, without a mismatch. The host recruited two warriors and their
roster showed fighting/hunting with health changing. The guest constructed a
gnome hovel to 75/75 HP and recruited Narph Drep. Checksums continued to match
after those gameplay orders. Navigating the guest away terminated the room and
delivered session loss to the host. The browser player provides explicit
session-ended recovery. This verifies a short multiplayer encounter; it does
not establish a full victory or WAN performance.

The new Frontier Pact chapter subsequently finished with shared native victory
for both kingdoms over a temporary public TLS/WebSocket relay. Seven simulation
checksums matched through completion, and the chapter record survived reload.
Both clients ran on this machine; separate-household testing remains outstanding.
These are new cooperative freestyle chapters. Original narrative quests,
including Holy Chalice, still require separate cooperative adaptations.
The corrected treasury chapter also reached native victory for both kingdoms
at 30,592 and 30,120 gold, with eight matching checksums.
Chapter 3 also reached shared economic victory from the retained eleven-day
save, with 100 matching original checksums and local completion on both peers.
That replay used the explicit inventory compatibility option. Shared surrender defeat
has passed on both peers. Two fresh browser clients now also restore the
retained nine-day co-op save with matching engine checksums and shared campaign
controls; host surrender after loading reached both original defeat screens.
Those earlier clients already held their local save files. A fresh guest now
receives the host's save through the original transfer and enters the same
restored world with matching checksums. After closing both browser processes,
the guest loads its retained received file without a second transfer and
again matches the host's simulation. The transfer trial also reaches shared defeat.
A subsequent repair replaces an existing longer guest file without retaining
its trailing data; local peers match after transfer and after a fresh-process
reload without retransmission. Interrupted replacement remains unqualified.
The initial actor persistence probe recorded at most 32 original unit save/load
visits in 640 bytes. Native Scions save/reload visited 480 unit records with
matching sampled descriptions; cooperative browser restoration visited 2,019
on each peer with matching samples and five matching simulation checksums.
Cross-region hero handoff remains unfinished.
Independent-household resume remains unqualified. See
[current co-op evidence](docs/frontier-world.md).

The root suite passed 14 tests (four layout and ten relay), the game config
suite passed five, and native DirectPlay/platform CTest suites passed 2/2.
The portable kit suite passed 414 tests, with four skips.
Relay tests route 100 ordered unchanged binary packets between real WebSockets.
Native COM checks cover async send completion, pointer relocation, small
buffers, peek, sequence gaps and queue saturation. Protocol fields, bounds,
profile isolation and remote HTTPS/WSS setup are documented in
[the multiplayer protocol](docs/multiplayer-protocol.md).

The freeze after accepting GOG Galaxy was a guest menu loop while the HTTP
server remained responsive. The newer asset set's Steam/Galaxy IDs cannot be
dispatched by the pinned older executable, so those choices remain disabled
through the original UI. The supported LAN selection uses the browser adapter.

The project direction is a **documented, browser-native multiplayer protocol**,
independent of Steam, GOG Galaxy or other storefront services. Players can
create and join rooms through the original lobby; shareable invitations carry
the room name and settings for manual room selection. Storefront accounts are not part
of the protocol. The room service should be self-hostable, including a local
development deployment.

The transport uses **secure WebSockets (`wss://`)** between each
browser and a room relay (`ws://` for local development). WebSockets provide
the transport; our versioned messages define rooms, membership, game-packet
routing and lifecycle. HTTPS serves the client and ordinary service requests.
Cooperative and competitive sessions use the same transport with different
game rules. WebRTC data channels can be evaluated later if measurements justify
a peer-to-peer transport; they are not required for the first playable match.

The implemented first-version protocol includes:

- A version handshake and exact engine/content manifest hashes. A mismatch
  rejects the join before simulation starts.
- Room creation/join, server-assigned session and player identities, ready
  status, roster updates, host start and explicit leave/disconnect events.
- Binary guest packets with sender/recipient routing and bounded sizes and
  queues. Sender identity comes from the connection, not a client's claim.
  Preserve original payloads until their meaning and delivery flags are traced.
- Packet sequence numbers scoped to a connection/session, plus explicit
  session termination on a broken connection in the first version. Do not
  replay packets across reconnects without a measured recovery contract.

The relay routes packets and owns membership; it does not yet simulate Majesty
or establish competitive cheat resistance. Simulation authority, timing and
synchronization must follow the measured engine behavior. The first acceptance
check is two independent browser clients joining one room, constructing and
recruiting, and agreeing on results through an encounter and a disconnect.

The adapter behind Majesty's legacy multiplayer API must preserve session and
player identities, delivery guarantees and ordering, and integrate with the
guest scheduler. The pinned engine imports `DPLAYX.dll` ordinal 4 (the
five-argument ANSI lobby factory), and the non-lobbied path creates DirectPlay
4 ANSI and Lobby 3 ANSI objects through `CoCreateInstance`. Browser traces
confirmed provider enumeration, capabilities, compound-address negotiation,
initialization and session enumeration. The kit's separate
`weanetr.dll`/MLDPlay stubs belong to another game. Storefront SDKs are not
required by this target.
[Emscripten's networking documentation](https://emscripten.org/docs/porting/networking.html)
confirms browsers cannot access TCP sockets directly. Merely enabling a linker
flag or adding a lobby will not restore DirectPlay.

Two independent clients must agree on simulation outcomes before a campaign
or competitive mode can be accepted. Matching game/mod hashes, generated map
settings, seeds and command ordering are part of that check. The original engine's
lockstep/checksum checks have matched through the measured encounter; longer
matches and multiplayer save/resumption still need verification.
Shared control of a single kingdom would require an additional command and
ownership design beyond the original separate-kingdom model.

### Community content and version compatibility

[MajestyTool](https://github.com/tytannial/MajestyTool) extracts and repacks CAM
archives and converts text resources; its author documents packing-order and
filename limitations. It is useful format research, rather than a complete
content or multiplayer framework.

[Majesty Mod Manager](https://github.com/Phantomstar721/majesty-gold-hd-mod-manager)
provides script merging, custom buildings, recruitment panels and hero
integration. Its
[GOG compatibility notes](https://github.com/Phantomstar721/majesty-gold-hd-mod-manager/blob/main/docs/gog-support.md)
explicitly exclude **1.5.1.2**, our pinned DirectDraw executable. Its newer
1.5.2.28 native helpers and addresses cannot be applied directly to this build.
We can study those implementations and port behavior with verified locations,
or investigate a separate recompilation target for the newer executable.

[Adventurers Guild](https://github.com/Phantomstar721/majesty-gold-hd-adventurers-guild)
demonstrates a custom quest-board building with sixteen autonomous hero jobs;
it requires the Mod Manager. It is a useful design reference for keeping an
expanded world active, but its browser compatibility has not been tested.

Recommended order: with browser save/reload and a two-client skirmish verified,
qualify one custom quest; build a cooperative scenario and qualify full competitive matches;
qualify one new class; then connect missions into a persistent regional campaign.
Content tooling and the networking investigation can progress independently.


Frontier map dragging now loads one latest destination per frame and batches
optional camera-position writes, retaining one active write and one pending
position. Region and building saves keep their durable-before-eviction behavior.
See [map movement performance](docs/frontier-camera-performance.md) for the Node
checks and the limits of this change; browser launches are authorized again.

The Frontier map can export one saved native kingdom to a local file and restore
it into a fresh named world. It preserves exact checkpoint bytes, refuses
existing worlds and streams direct file saves in small pieces. This is an
independent kingdom backup, not full account or shared campaign continuation.
See [kingdom backups](docs/native-region-backups.md) for controls and qualification.

Named Frontier maps also offer a paginated **Saved kingdoms** list. It reads
small checkpoint metadata and shows eight destinations at a time. Selecting a
destination loads its checked saved terrain and keeps the native play link in
the same world. See [saved kingdom navigation](docs/saved-kingdom-navigation.md)
for the bounds, stopped-file checks and remaining browser qualification.

The active Frontier work also includes new characters, buildings, maps, missions
and mods, and lower browser resource use. Visible-tile clipping and redraw
coalescing reduce work in the atlas; native performance and resource use still
need measurements across repeated region travel. Content and qualification
requirements are recorded in [the Frontier notes](docs/frontier-world.md).

Future optional world expansions include a **Lord of the Rings / Middle-earth**
mission pack spanning the Shire, Mordor and the lands between, and a
**Dune / Arrakis** pack. They are planned content extensions, not installed
content. Each should supply its own connected regions, missions, factions,
characters, buildings and enemies through the same mod and streaming system,
with separate worlds and saves bound to the exact content version.
The [expansion plan](docs/world-expansions.md) records initial two-region slices,
proposed characters/buildings and setting-specific mechanics, pack compatibility,
co-op persistence and acceptance checks before growing either world.

The latest [connected-terrain prototype](docs/native-connected-terrain.md)
generates two neighboring kingdoms from global coordinates, lets the original
engine place and render their starting content, and saves both through the
original menu. All 129 shared edge heights match. This is an experimental
native qualification; seamless travel, matching edge materials/lighting and
browser resource limits remain unfinished, and the served WASM is unchanged.

A [four-visit native unload/return trial](docs/native-connected-residency.md)
now preserves both generated kingdoms' evolving state on return and frees all
six tracked world/grid roots on each exit. First loads still change primary
fields, so full generated handoff remains unqualified. This trial uses the
original Load Game menu; automatic hero travel is still unfinished.

Atlas edits and travel now run in order, with bounded pending actions and atomic
scene replacement. Missing regions load in one bounded storage transaction per
handoff; failed or incomplete batches keep the current view. Twenty-nine tests
and browser journeys verify tower persistence, camera restoration and bounded
terrain/DOM use. Sixty distant moves and two same-tab native save/return cycles
have been observed; prolonged native memory and performance remain unqualified.

Experimental Frontier links now select the inventory bridge and regional seed
used in startup qualification. Two neighboring native kingdoms have passed
fresh startup, checkpoint saving, return to Atlas and independent restoration.
They remain separate loaded worlds; seamless hero travel and co-op region
handoff are unfinished.

A native checkpoint metadata reader now locates saved units with a fixed 4 KiB
cache and skips dormant terrain payloads. All 480 records in an owned save
matched an independent reference; the browser File API check passed. Its
measured reads fell from 1485 to 26, with more bytes read per request. This
prepares actor handoff without activating units. See the
[reader qualification](docs/native-checkpoint-reader.md).

The reader also locates saved orders, container membership and global inventory
ownership. Two owned saves passed complete browser/reference comparisons;
seven quest-item/carrier pairs match original engine observations. All 50
JavaScript tests passed for that qualification. Hero transfer still requires reference remapping and
has not been enabled.

Ownership and position inspection now matches all 2440 units in two owned
saves, including unowned scenery and positions that depend on a physical
parent. Reading placement fields together avoids redundant page reads.
Browser checks and all 57 JavaScript tests pass; actual hero handoff remains
unfinished. The [placement notes](docs/native-checkpoint-reader.md) distinguish
physical attachment, gameplay parents and original game coordinates.

The opt-in native probe now also observes unit registration, saved ownership
and fixed positions, then queries the original registry and map-position helper
after a successful complete save/load. It retains 32 samples in 2304 bytes.
A cloned Scions restore and a fresh 502-unit save resolve every sampled ID to
its original unit, including examples of inherited and offset parent positions.
The factory and mandatory post-load lifecycle are verified against the pinned
executable. These observations prepare destination registration; no unit has
been transferred between native regions. See the [lifecycle evidence](docs/frontier-world.md).
Two local browser co-op peers also resolve every sampled unit, with matching
saved fields and live positions and five matching original simulation checksums.

An isolated factory fixture now creates, registers and removes basic units
through original engine methods in native and WASM builds. Both pass 64 cycles
with unique IDs, one reused allocation address and live guest heap usage
returning to baseline each time. A neighboring browser kingdom rejects the
fixture and remains playable. This does not restore a hero's full state or
move it between regions; see the [factory qualification](docs/frontier-world.md).

Optional Resource diagnostics (`RECOMP_MEMORY_DEBUG=1`) record up to eight
browser memory estimates locally in Atlas or the native game. Sampling runs
only when requested. Controlled Atlas/native observations and their limits
are recorded in [the Frontier notes](docs/frontier-world.md); estimates do not
prove a bound on total browser or GPU memory.

Browser Release builds omit debugging sections from the shipped WASM. The
measured module decreased from 347.76 MiB to 103.56 MiB; Debug builds retain
that information. This is a loading-size improvement, not a measured FPS gain.

Native profiling also caught completed exception checkpoints accumulating
during startup. Cleanup now handles the original unlink-before-stack-pop
epilogue. All 333 SEH checks pass, and a native run that previously stalled
now shows the main menu by its 10-second capture. The web build includes the
fix. A fresh Scions of Chaos kingdom has completed browser checkpoint/save,
leave and restoration in Frontier region (1,0). An older Brashnard checkpoint
still throws; general save compatibility, seamless regional travel and browser
frame-rate measurements remain unfinished. See [qualification](docs/frontier-world.md).
