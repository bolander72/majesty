# DirectPlay over real native sockets

The subsequent [public TLS protocol check](native-public-protocol.md) passes767
reported checks using both SDK roles and real stopped kingdom bytes through an
owned temporary WSS endpoint. The relay and clients remain on the same Mac;
original-world loading, full games and independent participants are unqualified.

## Stopped original kingdom bytes

The optional `--owned-kingdom-snapshot` mode transfers the existing private
Source_Before.GMP fixture through the unchanged production relay and real native
DirectPlay provider. The input is independently pinned to SHA-256
`6e6a2ee125b68ce00ec25a46f205904e7cdd8f83ca009c10cf29e8e9ab76e2d1`.
It copies the stopped input privately; no player profile or running kingdom is
opened. Native host and guest roles run sequentially, with a Python reference
as their opposite peer. Both directions deliver 317,365 bytes in 20 chunks,
with at most one 16 KiB chunk awaiting acknowledgement. The native receiving
role checks every received chunk against the pinned file; the reference
receiving role also compares every chunk and hashes the complete stream.
Original input and private copy retain their full digests after both roles.

Attempt006 passes 681 reported checks (341 host, 340 guest). Both roles complete
the fixture Ready/Loaded agreement, cancel a subsequent partial transfer, keep
their source room usable and exchange ordinary packets before disconnecting.
Attempt007 preserves the default synthetic mode with 326 reported checks and
no failures. Reported check counts include timing-dependent polling checks.
All producers and their owned process groups are absent; both relays drain
their rooms/connections and served browser files retain their hashes/stamps.

The supervisor permits one official one-job build/test at a time. It samples
owned descendants and their process groups every 250 ms, retaining observed
groups through orphan reparenting. Limits are 768 MiB during compilation,
512 MiB for the SDK test, 180 seconds and 4 MiB of log output. These are sampled
stop thresholds, not allocation limits. Attempt006 peaks at 613.12 MiB including
compilation; SDK-phase samples peak at 70.22 MiB/69.92 MiB. Neither figure is an
original-game or browser memory measurement. A tiny child verifies bounded
normal-exit cleanup. Native pair execution remains separately approval-gated.

Failed004 records an interrupted build and initial cleanup PermissionError;
its actual producer/group are absent, but its original guard reason was not
persisted. Failed005 records a correct stop at the initial 512 MiB compiler
threshold and complete owned-group cleanup. Both attempts are retained. The
final guard records bounded samples and distinguishes build and SDK limits.

Run from the parent workspace with a fresh attempt:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/test-native-directplay-network.py \
  --attempt <fresh-number> --owned-kingdom-snapshot
```

Evidence: `output/native-directplay-network-006/run.json`,
`output/native-directplay-network-007/run.json` and
`output/native-directplay-stopped-save-001-preserved/preserved.json`.
This establishes delivery of real stopped save bytes, not game-owned import,
Ready/Loaded votes, original graph loading, synchronized kingdoms or resume.
The descriptor and reference votes remain fixture-only. Independent internet
participants and browser streaming/performance remain unqualified.

## Original synthetic fixture

The Mac transport is now exercised by the actual DirectPlay shim through its
original guest COM ABI and the checkpoint seams. An owned loopback instance of
scripts/room_relay.py serves an independent Python reference peer and one native
SDK test process. Hosting and joining run separately, with one official one-job
build/test at a time. Neither an original game world nor a browser is launched.

The unchanged production relay authenticates the two registered players and
forwards every RPC, event and ordinary packet over actual WebSockets. The test
uses the default platform transport, without direct relay dispatch or fake
transport injection. Host and guest have IDs2/3 and their real joined epoch.
The reference peer discovers and joins the native host's room through wire
listing RPCs; the native guest joins the reference host's instance through the
original Open/CreatePlayer ABI. Guest-call stack/return discipline is checked.

Each role negotiates checkpoint agreement/delivery, verifies the roster and
exact Prepared descriptor, and streams50003 synthetic patterned bytes in four
chunks with one outstanding chunk. The native receiving role verifies every
payload byte. Early recipient Ready and unacknowledged host chunks are refused.
Host Ready while serving is accepted. End/EndAck precede recipient Ready,
Committed and both fixture Loaded votes, ending in Complete.

A second proposal is canceled after one acknowledged16384-byte chunk.
Canceled clears the transfer, refuses later Ready/End and preserves the joined
epoch and two-player room. Ordinary packets still pass afterward. The reference
peer then disconnects; the native SDK revokes the epoch and refuses stale
checkpoint calls. The fixture has no save or gameplay authority: its votes
certify only its synthetic bytes and test ordering.

## Reproduction and evidence

```sh
upstream/majesty-recomp/.venv/bin/python scripts/test-native-directplay-network.py --attempt <fresh-number>
```

The runner invokes the official game tools/test.py wrapper with
--native-test directplay_network_tests --jobs1. CTest's network label excludes
this fixture-dependent target from the ordinary native suite. DirectPlay's
network URL is installed inside the test from NATIVE_DIRECTPLAY_TEST_URL;
the official wrapper's runtime-switch scrub stays intact. Missing fixture
settings fail. No ignored prior report is required to rerun the final driver.

Final native-directplay-network-003 reports163 host checks and166 guest checks,
all passing, on four actual local socket connections. Both50003-byte streams
match the independently computed SHA256 of the specified pattern. The owned
fixtures stop, both official producer PIDs are terminal/absent, and the served
browser artifacts stay unchanged.148 current handwritten source/config/tool
inputs, the test binary, generated configuration and per-role logs are frozen
in output/native-directplay-network-003/ and its observed report. Native183's
compiled game inputs and binary still match; no game rebuild is needed for
this addition to the test harness.

001 covers the successful transfer and disconnect.002's expanded guest test
fails because the reference host begins proposal2 before the guest observes
proposal1 Complete. The snapshot API exposes the latest agreement, so a new
Prepared can supersede Complete during a pump.003 coordinates consumption of
Complete with an ordinary packet before the next Begin; it does not modify
production ordering or prove that the game's resume path supplies this gate.
All older results are retained. Production pause/resume/proposal ordering must
be verified explicitly rather than treating this fixture handshake as evidence.

## Original lobby follow-on

A subsequent single original-game native run now creates a real room, admits
a reference peer and processes its original Not Ready/version request. Its
UI renders the expected name/version, and seven host packets total825 bytes.
See [native-original-lobby.md](native-original-lobby.md). That run loads no map
and launches no second engine; the SDK and original lobby qualifications still
supply no shared-world load/resume proof.

## Remaining gameplay qualification

The next run must exercise an original mode2 world and its paused source,
selected save, durable received inbox, SHA/import/Ready, original reader/type3
attachment/rebuild, Loaded, party-wide Complete and original resume, with live
provider/epoch and original kingdoms retained. A reference peer acknowledging
synthetic bytes cannot prove any of those game effects or simulate a second
original kingdom. Fresh cooperative regions remain unfinished as well.

Full co-op/competitive matches, an independent internet participant and sustained
browser memory/resource bounds remain unqualified. SDK public WSS succeeds in
the subsequent bounded protocol check; it does not establish original gameplay.
Browser launch suspension remains in force while the desktop crash is unresolved.
