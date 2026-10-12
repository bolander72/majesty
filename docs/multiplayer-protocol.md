# Browser room protocol v1

The local relay is `scripts/room_relay.py`, using Python 3.12 and
`websockets==15.0.1`. It provides the original game's DirectPlay session and
packet operations over browser WebSockets. It does not simulate the game.
The runtime adapter is `kit/dx/directplay.cpp` in the pinned source patch.

The relay source now also supports an explicitly negotiated checkpoint
agreement for two-to-four-player parties, with separate all-party load and
resume permissions.26 focused tests pass, including real local WebSocket
connections. The native provider now exposes exact-session agreement commands
and bounded snapshots; its focused fake-transport suite passes12434 checks.
The game-owned region loader does not use it yet; cooperative travel remains
disabled. See [co-op region agreement](coop-region-agreement.md).
The running relay was not restarted for this change.

## Running and joining

Run `./scripts/play.sh` and, in a second terminal, `./scripts/multiplayer.sh`.
The local client is http://localhost:8000/majesty/ and the relay is
ws://localhost:8002/rooms. Both are running in this development workspace.
Choose Multiplayer, enter a name, select **Play Over LAN (TCP/IP)**, and Accept.
That original menu label selects the browser relay adapter. Steam and Galaxy
remain disabled because their newer menu IDs cannot be dispatched by the pinned
executable. Create Game opens a room; another browser selects it and Join Game.
The guest selects Ready, then the host selects Start Game.

For two tabs in one browser, the second client can use
`?profile=multiplayer-guest` to keep writable profiles separate while sharing
imported game data. Each browser still needs its own legitimately installed
assets imported through the launcher. `?relay=wss%3A%2F%2Fexample.org%2Frooms`
selects another relay. The original lobby lists compatible open rooms.

The staged `/multiplayer/` page offers co-op or competitive selection, the co-op
chapter, a room name, a relay URL and a local profile. **Copy invitation** produces
a version-1 link with shared settings. Guests choose their own local profile;
the host's profile, private URL parameters and passwords are not copied. Default
host/guest profiles are separate for two tabs on the same browser.

The invitation identifies a room by its displayed name. The host still enters
that name in Create Game; the guest selects it in the original room list. It is
not a server-assigned room identity, reserved room or automatic join. The game
panel updates the invitation to the name actually created/joined, from the
existing native runtime message. Session loss clears that invitation. Standard
co-op links include the inventory compatibility rule; competitive links do not
add cooperative rules. Sessions with other custom rule parameters cannot
advertise a silently incompatible standard invitation.

Invitations need a game site and relay reachable by both players. Localhost
addresses only refer to each player's own machine. HTTPS sites require a WSS
relay. The setup page rejects ambiguous settings and embedded URL credentials;
Clipboard permission failure leaves a manual-copy field. This entry flow passes
37 focused Node tests with campaign progression. Browser rendering, live invite
joining and independent-household gameplay remain unverified while launches
are suspended; the WASM binary is unchanged.

The default relay accepts origins http://localhost:8000 and
http://localhost:8001, listens only on 127.0.0.1, and negotiates subprotocol
`recomp-directplay-v1` at `/rooms`. For remote play, serve the client over HTTPS,
proxy the relay through WSS, and supply the client origin with `--origin`.
Repeat `--origin` for additional allowed sites. Configure reverse-proxy limits
as appropriate. A temporary public TLS relay has been exercised; independent
internet connections and adverse WAN latency remain unverified.

An eight-worker local co-op run qualified original construction without
changing placement rules: a blacksmith completed, a marketplace order charged
both clients the same 1,425 gold, and its construction panel reached
200/200 HP. Player 2 placed a separate 1,500-gold marketplace foundation.
Thirty-four native checksums matched through frame 6799
(`36831ca5`) across those orders. Earlier nearby positions failed the native
proximity query; farther valid positions were accepted. Chapter 3 victory
remained unqualified in that run. A subsequent public-WSS match completed
both players' Embassies at 300/300 HP and qualified bidirectional allied
settlement visibility. Player 2 completed a Rangers Guild, recruited Calerian
of Treldan Wood, and Player 1 could see that Ranger exploring the shared map.
All 58 captured original checksums matched through frame 11599 (`9431c749`),
including completed level-2 marketplaces and their research.
This later trial uses the content-bound 108,606,511-byte WASM build and still
runs both clients on one Mac; independent-household qualification and
Chapter 3 victory remain unfinished. Detailed
resource observations are in [the Frontier notes](frontier-world.md).

That public-relay match also used the host's original Save Game menu. It
reported Game Saved and subsequently listed an 8-Day save with both players.
At that point, shared-session restoration was unverified; the existence of
that entry did not establish reconnect, coordinated region travel or resume.
A later 9-Day save also reported success. The trial ended below Chapter 3's
gold objective; both test engines and the temporary tunnel were retired.

The first fresh host/guest engines on the local relay exercised the original
multiplayer Load Game path. Both saves persisted in the host profile and
the 9-Day file restored lobby assignments. Both clients failed at Start:
a null call returning to `004169b6`, exit `3221225477` (`C0000005`), before
gameplay resumed. The files were preserved. See the Frontier notes and
`output/coop-native-resume-failed-observed.json` records that historical failure.
The selected lobby filename is now copied through the original owning setter
before startup reads it. Fresh host/guest clients restored the retained nine-day
match and matched engine checksums; host surrender after loading reached shared
defeat and the original loss screens. See
`output/coop-resume-controls-observed.json` and the current Frontier notes.
Both peers already had native save files. Transfer to a guest without its file,
reconnect and independent-household resume remain unqualified.

A longer local-relay Chapter 3 replay restored those nine-day saves on the
108,638,756-byte transactional-checkpoint build. All 104 captured original
checksums matched through frame 20799 (`dff95385`). Ordinary tax income reached
34,505 / 34,530 gold, then both clients exited with `e06d7363` before the
35,000-per-kingdom objective. Neither shared victory nor completion was
recorded. The exception's type and caller were not traced in this run, so this
does not establish its cause. The original saves are retained for a focused
exception-trace replay. Evidence: `output/chapter3-resume-exception-observed.json`.

An eleven-day-save replay with exception tracing again stopped both peers
before completion, at 31,802 / 31,531 gold. All 60 captured checksums matched
through frame 11999 (`3a15d885`). The exception is the original GPL "bad
conversion to list&"; this trace did not capture its initiating script.
`RECOMP_TRACE_GPL_FAILURE=1` now enables the bounded named-script/list diagnostic
for saved cooperative worlds without changing inventory or simulation rules.
Evidence: `output/chapter3-traced-exception-observed.json`.

The new GPL diagnostic reproduced those exact 60 checksum pairs and captured
both peers failing in hero death cleanup: `Drop_Immediate_Items` calls the
missing `GetInventoryItems`; `NullFunction` returns a GPL null which the script
then assigns to a list at instruction 12/36. The known original inventory
binding resolves correctly on both clients. The existing opt-in inventory
bridge is being qualified against the retained save on both peers; it remains
disabled by default. Evidence: `output/chapter3-gpl-diagnostic-observed.json`.

The bridge-enabled replay completed Chapter 3. Both original named reads
returned zero; the formerly failing hero death returned a genuine empty
inventory list for owner `0000089f` on both peers. Ordinary income reached
35,202 / 35,306 gold. All 100 captured checksums matched through frame 19999
(`26691e07`). After acknowledging the original multiplayer winner notice,
both clients displayed "You are victorious" and saved completion locally.
The experimental chapter links now select the inventory compatibility rule,
including when the relay URL changes. This is a local-relay trial on one Mac;
independent internet connections and nonempty hero item drops remain open.
Evidence: `output/chapter3-compat-victory-observed.json`.

Portable saves without a required game login and offline campaign continuation
are recorded in [the player save design](player-saves.md). Solo branching and
absent-player control are proposed features; current sessions still terminate
when a participant leaves.

The campaign panel now cancels queued shared actions on connection loss or
receive overflow and ignores late results from that ended session. A victory
confirmed before loss can still finish saving locally or be retried. The small
served JavaScript repair passes 44 focused source tests and 44 served-module
tests without a browser/game launch; live disconnect recovery remains
unverified. See [campaign disconnect recovery](campaign-disconnect-recovery.md).

For a temporary public relay, keep `scripts/multiplayer.sh` running and start
`./scripts/relay-tunnel.sh` in another terminal. Use the printed HTTPS hostname
as `wss://<hostname>/rooms` in the campaign relay field. This exposes the room
relay on port 8002; game files remain on the local HTTP server. Stop the tunnel
with Ctrl-C after testing. An optional argument chooses another relay port.
The helper uses an isolated empty configuration, leaving existing Cloudflare
configuration untouched. A test without isolation inherited other ingress
rules and returned HTTP 404; the isolated endpoint passed both a TLS protocol
handshake and the two native browser clients' connection checks. Cloudflare
documents the existing-configuration limitation for
[Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Identity and membership

HELLO supplies three lowercase SHA-256 values separated by colons: the staged
WASM engine, the pinned original executable identity, and imported content.
The launcher hashes actual imported file bytes and sorted paths before engine
startup; profile/save data and generated viewport overlays are separate.
The relay lists and accepts rooms only for identical identities. The game
application GUID must also match; the original JOIN path may pass a zero
application GUID and only the instance GUID. In that case, the instance GUID
and exact engine/content identity still determine the room.

A room receives a random instance GUID. Player IDs are assigned by the relay;
ID 1 is reserved for the host's server player. Each connection owns one player.
Only the host can change the session description, and only a player's owner
can publish its name or data. Session passwords are checked on joining and
omitted from lists and roster snapshots. Visibility labels from newer assets
are not a storefront friends/authentication system.

## Wire format

Every message is a binary WebSocket frame. Integers are unsigned little-endian
32-bit values. The 20-byte header is:

| Field | Value |
| --- | --- |
| magic | `0x31525044` (`DPR1`) |
| version | `1` |
| operation | operation below |
| request | increasing nonzero RPC ID; zero for sends/events |
| status | zero in client requests; HRESULT in replies |

Replies set operation bit `0x80000000` and echo request. Strings are a byte
length followed by ANSI bytes, without a terminator or embedded NUL. Ordinary
strings are limited to 255 bytes, passwords to 64. A session is the 80-byte
DPSESSIONDESC2 layout with guest pointer fields at offsets 48 and 52 zeroed,
followed by name and password strings. A player is ID, flags, short-name string,
long-name string, data length and data bytes. No guest addresses or host
pointers are transmitted.

| Request | Operation | Body / successful reply |
| --- | --- | --- |
| HELLO | 1 | identity string / empty |
| LIST | 2 | application GUID + flags / count + session descriptions |
| CREATE | 3 | session / session + count + players |
| JOIN | 4 | session / session + count + players |
| PLAYER | 5 | player with provisional ID / assigned ID |
| SEND | 6 | sequence + sender + recipient + delivery flags + original payload |
| LEAVE | 7 | empty / empty |
| SESSION | 8 | session / session |
| DATA | 9 | owned ID + data length + bytes / empty |
| NAME | 10 | owned ID + short and long strings / empty |
| DESTROY | 11 | owned ID / empty |

| Event | Operation | Body |
| --- | --- | --- |
| Session changed | 101 | session |
| Player created | 102 | player count + player |
| Player destroyed | 103 | player count + player |
| Player data changed | 104 | player count + player |
| Player name changed | 105 | player count + player |
| Game packet | 106 | recipient sequence + sender + recipient + unchanged payload |
| Session lost | 107 | empty |
| Send accepted | 108 | sender sequence |

SEND is asynchronous. Each connection's sequence starts at 1; the relay checks
it and assigns a separate ordered sequence to each recipient. Sender identity
must match the connection. Recipient 0 broadcasts to other players; an explicit
local recipient can receive a loopback. The adapter passes transport flags
`0x1b` and accepts original SendEx async/no-completion flags separately. The
engine's `0x201` asynchronous guaranteed sends return E_PENDING and produce a
DPSYS_SENDCOMPLETE only after SEND_ACK. ACK means relay acceptance and enqueue,
not recipient simulation consumption. Original payloads and their in-game
lockstep/checksum protocol remain unchanged. Per-message priority scheduling
and SendEx timeouts are not implemented; the measured engine sends zero for
those fields. Group, chat and other unimplemented COM APIs fail explicitly;
the original game carries its lobby/chat commands in its own packets.

## Bounds, scheduling and disconnects

Game payloads and player data are limited to 65,536 bytes. Frames are limited
to 66,560 bytes. The relay supports at most 128 connections, 64 rooms and 16
players per room. Relay and adapter queues each have 256 messages and a 2 MiB
byte ceiling; browser transport receive frames have a separate 64-message
ceiling. Invalid frames, identity/sequence violations and queue overflow close
or terminate the affected session. RPC and relay writes have 10-second bounds.

Browser callbacks only enqueue owned host bytes and signal a thread-safe guest
event. They never read guest pointers. Guest calls decode replies and relocate
32-bit pointers while holding the cooperative scheduler baton. RPC waits yield
that baton, allowing WebSocket callbacks and the browser UI to run. Receive
honors size negotiation, peek, and sender/recipient filters.

Any player's leave or transport failure terminates the first-version room and
notifies the other clients. There is no host migration, reconnect replay or
resumption. These would require a separate measured recovery contract. The
relay owns routing and membership, but is not an authoritative simulation or
competitive anti-cheat service.

## Verification

The automated relay tests use real pairs of WebSockets and exercise room
joining, roster updates, 100 ordered unchanged commands, acceptance replies,
content mismatch, password handling, ownership and disconnects. Native COM
checks cover pointer relocation, small buffers, peek, async send completion,
sequence gaps and bounded-queue session loss.

The browser test uses two original-engine clients and a Random (Beginner)
competitive skirmish, not a cooperative campaign. The launcher enables the
original `-dochecksums` option. `?RECOMP_NETWORK_DEBUG=1` exposes its checksum
reports in a collapsible Multiplayer diagnostics panel; comparison is by
simulation frame, not browser render frame. The native observer preserves the
original logger and mismatch checks. See README.md for the measured gameplay
result and remaining limitations.

A subsequent opt-in Frontier Pact co-op chapter completed through a temporary
public Cloudflare TLS/WebSocket relay. Both original clients recognized two
network kingdoms, reached native victory and persisted chapter completion.
Seven checksums matched through the finish (frame 1200=`292f215b`). Both clients
ran on one machine: this proves public relay traversal, not separate-household
qualification. No game assets or HTTP game server were exposed by the tunnel.

The engine/content compatibility digest now also includes sorted, validated
`RECOMP_RULE_` parameters. A room's chapter is fixed before engine startup;
duplicate rule keys and invalid values fail startup rather than ambiguously
selecting a ruleset. A generic bounded runtime log and runtime-message event
support the separate campaign UI. See [Frontier qualification](frontier-world.md)
for the cooperative objective and expanding-world boundaries.

Chapter 2 also completed with shared native victory after both kingdoms held
the required 30,100 gold (30,592 and 30,120 observed). Eight simulation checks
matched during the corrected economic run. Treasury and survival chapters
therefore have actual completion evidence; chapter 3 victory remains
unqualified. Both clients used the same temporary public TLS relay.

Shared defeat was subsequently verified through a confirmed surrender on the
local relay: both clients reached native loss screens, four checksums matched,
and chapter 3 remained incomplete after reloading the campaign selector. The
browser adapter uses the original replicated loss command. This qualification
does not yet include defeat caused by palace destruction.

A further Chapter 3 run through an isolated public TLS tunnel matched 36
original simulation checks from frame 199 (`2d89c3dd`) through frame 7199
(`2b528ccb`). Both native clients reached the loss screen after a confirmed
shared surrender; chapter 3 remained Ready to play after reloading the selector.
The run used Frontier Settlements, No Monsters (Last Palace Standing) - L,
K'Hal-Kratis, map 985825682, 30,000 starting gold and disabled cheats. Treasury
reached 30,270 for each kingdom. Marketplace orders did not activate in this
run; no successful construction or Chapter 3 victory is claimed. Browser
captures are `output/coop-chapter3-public-host-loss.png` and
`output/coop-chapter3-public-guest-loss.png`. Both clients ran on the same machine.
The temporary tunnel was stopped after the test.

After the browser wait, overlay and memory changes, Chapter 1 was replayed
through another isolated public TLS relay with the final optimized build.
Both original clients reached native victory and saved chapter completion.
Seven checksums matched through frame 1200 (`e3371a98`), and both clients'
linear memory remained at 512 MiB through completion. The screenshots are
`output/coop-performance-512m-host-victory.png` and
`output/coop-performance-512m-guest-victory.png`. The owned temporary tunnel
was stopped afterward. This run used two clients on one Mac; it does not
qualify separate-machine internet play, Chapter 3 victory or measured FPS.

The later Chapter 3 replay reached shared economic victory from the retained
eleven-day save on the local relay, with 100 matching original checksums and
local completion on both peers. It used the explicit inventory compatibility
option; nonempty hero item drops and independent internet connections remain
unqualified. The recorded result is
`output/chapter3-compat-victory-observed.json`. All three chapters now have
completion evidence, superseding the earlier Chapter 3 status above.


### Frontend074 public-relay recovery qualification

The unchanged release073 engine now has reproducible same-origin HTTPS/WSS hosting and disconnect recovery in the workspace frontend. Two real browser clients on this Mac restored revision3 clock18000 through the production relay on a temporary public TLS route, saved revision4 clock24550, released both engines, recovered the latest committed checkpoint and rejoined with a fresh invitation. Both original readers admitted revision4 and continued to revision5 clock31900. The host recover link removes the old launch hint; the guest requests a new invitation and retains their local profile. An isolated Caddy/Compose test passed static isolation headers, WASM MIME/range, real two-client TLS room join, 100 ordered binary commands, disconnect and strict origin/subprotocol refusal.84 focused JS/Python checks pass. The owned browser tabs, relay/tunnel group and Docker test stack were released; user profiles, services, tabs and old releases are preserved. Evidence: workspace output/internet074-qualified.json and output/internet074-hosting-tls-qualified.json. This proves public-relay gameplay on one Mac and hosting preparation; independent-household play, permanent deployment, competitive match completion and sustained browser resource bounds remain unqualified. No native or WASM rebuild was needed.


### Frontend075 campaign continuation

Actual current-engine browser clients through public WSS restored Chapter1 revision5 clock31900 and both completed shared victory. Each local profile retained one completed chapter after game release and reopening campaign progress. The next-chapter anchor previously ran into the progress message and wrapped across two lines; normal center clicks could miss the text. The frontend now reveals progress and the link as separate block rows after a committed completion. Both real corrected links navigated to Chapter2 setup, preserving personal role/profile and dropping the old resume. A new world name was required; the host-generated shared invitation excluded both profile and resume. Both clients started Chapter2 with two kingdoms at 30000/30100 treasury progress, then saved the new campaign075-ch2 world at revision1 clock26250. The earlier cold073-oct09 checkpoint remains revision5 clock31900 with identical digest.56 focused checks pass. All owned game tabs and three bounded relay/tunnel groups were released, without a native/WASM rebuild. Evidence: workspace output/campaign075-qualified.json. Separate-household gameplay, current-engine later chapter completion, competitive completion and sustained browser resource bounds remain outside this milestone.
