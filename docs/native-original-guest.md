# Original guest initialization with a recorded host

The next original-engine check joins a native guest to a byte-preserved recording
from an actual, terminal native host. Only one native game runs at a time. This
can expose guest discovery, roster, Ready, world generation and initialization
failures without restarting the browser game. It cannot prove live synchronized
play, a shared campaign completion, independent internet play or browser bounds.

scripts/run-native-multiplayer-lobby.py now captures the original room descriptor
and server player snapshot alongside its existing bounded packet recording.
Earlier013/014 lack those snapshots and are deliberately refused by the guest
fixture. Capture a new host with the current native186 build and the existing
Start script, then run scripts/audit-native-lobby-packets.py on its terminal
observation before using it as --replay-host-report. Preserve every prior attempt.

The input loader requires the pinned executable/build/chapter, a terminal and
absent original producer, its successful Ready/Start/GoStatus packet audit bound
to the observation hash, authenticated server1/guest2 identities and unchanged
captured bytes. It copies all inputs into a fresh private output directory.
Room/password/player strings and packet payloads stay private; no binary content
is printed or published. Captures are limited to128 packets,65536 bytes per
packet and2MiB total. Original room/player records are limited to65536 bytes.

The replay creates a new room using the captured application/session settings
and original server player. The relay assigns a fresh session instance ID; game
payloads remain unchanged. It emits the recorded initial status only after the
guest actually joins. The guest's original Ready request permits the recorded
Ready echo and GameStart. The captured host GoStatus is withheld until this
guest emits its own original initialized-player vote. The fixture never creates
GoStatus or Loaded acknowledgements and does not answer later gameplay traffic.

Use a new attempt with matching inputs:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/run-native-multiplayer-lobby.py \
  --attempt <fresh-number> \
  --build-report output/native-world-residency-build-186.json \
  --settings-profile <owned-actor-arrival-fixture-profile> \
  --script upstream/majesty-recomp/smoke/native-multiplayer-join.script \
  --seconds 65 --coop-chapter 1 \
  --replay-host-report output/native-multiplayer-lobby-<host-attempt>-observed.json
```

The new guest smoke script selects the recorded room, joins, clicks Ready and
records four bounded scalar samples. Its room selection, joining and Ready positions are exercised in native018.
The guest name is made distinct through the original name dialog. A missing guest GoStatus or reference error fails the
driver. Seeing its vote alone does not prove the game entered gameplay; inspect
the original clock, phase, mode, roster bindings and tick evidence separately.
The recorded host owns no live world. Existing gameplay/full-match/browser
qualification fields remain false for this check.

Twelve focused tests pass, including frozen input/audit validation, refusal of
live or replayed host sources, changed bytes/builds/chapters, roster/version
checks, the actual guest's observed zero-valued status field, premature/spoofed
GoStatus rejection, duplicate Ready handling and a
real loopback WebSocket exchange through the unchanged production relay. Test
packets and peers are synthetic; no original game executes in these tests.

```sh
upstream/majesty-recomp/.venv/bin/python -m unittest discover \
  -s tests -p test_original_host_replay.py -v
```

## Actual original guest result (native186, capture015/replay018)

Capture015 preserves ten original host packets totaling1305 bytes plus the
original room/server snapshots. Its packet audit passes, its peak native RSS
is169967616 bytes and its producer exits cleanly before any guest starts.

Guest016 discovers the room but hits the original duplicate-name dialog.
Guest017 changes its name through the original dialog and joins, but the fixture
incorrectly rejects its real Not Ready request: the original guest sends0 in
its second status word, whereas the earlier worldless reference usedFFFFFFFF.
The corrected fixture accepts both observed representations without inferring
a kingdom binding from that field. A regression covers the actual zero shape.
Both failed attempts are retained, with no initialization qualification.

Guest018 joins as player2, sends its own original Ready and GoStatus, and receives
all ten captured host packets unchanged. The original campaign callback reports
Chapter1 started with two network kingdoms. The final scalar sample has a
present world/state, inactive Go wait and game clock550. Its private rendered
frame shows the loaded palace/map and Waiting for Other Players: the transcript
has ended and cannot provide live host turns. This proves original guest loading
and limited clock advancement, not ongoing synchronized play or a finished
mission. Parent output/native-multiplayer-lobby-018-guest-audit-final.json binds these
observations to their captured inputs.018 exits0 with no reference error or
resource stop, peaks at192348160 bytes (183.4MiB), closes its owned room and leaves
its producer absent. Existing qualification fields remain false.

WASM018 compilation and bounded static inspection also succeed without
publication or browser instantiation. Browser launches remain suspended under
AGENTS.md; served files, personal profiles, existing services and tabs remain
unchanged. No native game/build remains running after these terminal checks.
