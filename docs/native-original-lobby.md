# Original-game lobby over native WebSockets

Native183's pinned original game now reaches Multiplayer, explicitly selects
LAN/TCP-IP, creates a two-player room and exchanges its own packets through the
production relay. This is an original executable session, beyond the SDK-only
fixture. One lightweight Python reference peer joins the owned loopback room;
no second original engine or browser is launched.

The original host allocates server player1 and the reference receives player2.
The co-op agreement/binding helpers use arbitrary nonzero sorted IDs rather
than the SDK fixture's2/3; no adapter change is needed for the observed IDs.
The original UI shows Transport reference (v1.5.1.2) under Player Two, Not Ready.
The default lobby settings are Random (Beginner), Eliminate all foes. No map is
loaded, no Ready/Start is sent, and this run does not demonstrate a cooperative
scenario, two generated kingdoms, a completed match or shared regional travel.

## Original packet exchange

The native host sends seven packets totaling825 bytes to the reference in the
final008 run. The peer sends one52-byte original category0x100/type0x20 Not Ready
request. The original dispatcher processes it, broadcasts a type2 status and
updates the visible peer/version label. The relay forwards original payloads
unchanged; it does not fabricate the game response.

The pinned image sets the network body's XOR key0x31 at004bb00d. The original
00588370/00588390 transforms use the packet's key at+48 and leave its outer
category/type words intact.004536d0 constructs a type0x20 request with44 bytes
of status body. Its player/slot fields precede the readiness byte at+8, version
code at+10 and32-byte version label at+12. The version label is distinct from
DirectPlay's short/long player names. The final peer supplies both names and
version code0x106 with label1.5.1.2, and the original response echoes that status. Ready=true version admission is not exercised by008; the subsequent009/010
observations below do exercise it.

scripts/audit-native-lobby-packets.py verifies11 pinned instruction anchors,
the writer's virtual dispatch, packet sequence/authenticated endpoints, copied
payload SHA256, the Not Ready request and the original response. Captured bytes
are private ignored test data, never printed or published. Observation caps
are128 packets and2 MiB; no complete world/save is retained by the reference.

## Reproduction and bounds

From the parent workspace with prepared private inputs:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/run-native-multiplayer-lobby.py \
  --attempt <fresh-number> \
  --build-report output/native-world-residency-build-183.json \
  --settings-profile <owned-actor-arrival-fixture-profile> \
  --script upstream/majesty-recomp/smoke/native-multiplayer-lobby.script \
  --seconds 35 --greet-peer
```

The existing official native build must match all44 compiled game inputs and
the binary hash. Settings come only from an owned actor-arrival fixture under
build; the driver copies three settings/progress files into a fresh private
profile and copies no world save. It selects the registered60 FPS setting for that
owned profile. This setting is not evidence of measured gameplay performance.
At most one native game/build is allowed. The supervisor checks the producer,
samples native RSS, enforces a512 MiB ceiling and bounded deadline, explicitly
terminates/reaps an overrun before any subsequent run, and stops its owned relay.
Existing browser services, tabs, served files and source profiles stay unchanged.

Final008 exits0 with no stop reason or reference error. Its peak sampled native
RSS is151224320 bytes (about144.2 MiB), for this35-second lobby session only.
It does not bound browser, GPU, kernel or loaded-world resources, or isolate Foundation allocation costs.
Both sockets close, session loss reaches the reference, and the native PID is
terminal/absent. Frozen build183 sources/binary are reused; scripts, profile,
packet copies, logs, frames and audits are under output/native-multiplayer-lobby-008/.
The observed report and008 packet audit describe exactly what ran.

Earlier001..004 establish the input/name/protocol/session dialogs.005 joins and
records six original packets;006 preserves their bytes.007 proves a status echo
but mistakenly puts a marker into the version-label field and leaves the long
name empty. Its older name-confirmed field did not establish a player name;
a caveat is retained with the result.008 corrects both fields and renders the
expected name/version. All prior attempts are preserved.

## Next gameplay requirement

An original mode2 world must now load with its real roster/kingdom bindings,
pause through original ownership, transfer/import a selected cooperative save,
attach/rebuild, acknowledge Loaded and resume only after the full party agrees.
The reference's lobby status is not a loaded-world acknowledgement. The game
must also prove Complete consumption before another checkpoint proposal; the
SDK fixture's explicit packet handshake supplies no production game gate.
Fresh cooperative regions, full matches, independent internet participants and
sustained browser bounds remain unfinished. Browser launches stay suspended.

## Ready/Start and actual initialization wait

Native183 observations009/010 send the original Ready=true/version request and
click Start. The original host echoes readiness and emits GameStart(type3,
452 bytes) followed by GoStatus(type0x10,16 bytes). Its GoStatus body identifies
host player1 and initialized1; it is not a world checksum. Ten original packets
total1305 bytes. The worldless reference sends no GoStatus or Loaded vote.

The010 script uses28 bounded read-only scalar reads across four samples. At
four seconds after Start generation is still underway. At nine and27 seconds,
the world/manager roots remain present and stable, the original initialization
wait flag is1 and the game clock is0. The original00416c30 loop waits for all
player flags in NetManager+338 or its60000ms limit. A full loading bar does not
establish a playable map, kingdoms, heroes or gameplay synchronization.

The expanded audit checks21 pinned instruction anchors, Ready admission,
GameStart/GoStatus schema and both later wait samples.010 exits0 with no resource
stop/reference error, a161480704-byte peak sampled native RSS and an absent
producer.009/010 artifacts are frozen before changing the polling wrapper.
Browser testing remains suspended. This is a single host initialization wait,
not a completed match or a two-engine cooperative scenario.

Reproduce with a fresh attempt and matching official build, substituting
smoke/native-multiplayer-start.script for the lobby script, --seconds65 and
--ready-peer. The copied profile and reference remain disposable and bounded.

## Native initialization wait performance

Native186 lobby013/014 preserve the original Ready/Start/GoStatus schemas and
reduce one host's initialization wait CPU from100.26% to2.54% of a core in the
sequential comparison. Both producers exit cleanly. Earlier fixed-time samples
can still be generating; final scalar reads and the actual wait-entry marker
establish this narrower scope. See [the measured wait correction](native-loading-wait.md).
A configured chapter is not an observed campaign start. Browser performance,
real two-world synchronization and full matches remain unqualified.
