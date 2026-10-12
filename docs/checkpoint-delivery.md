# Bounded checkpoint delivery on the room relay

The relay and native DirectPlay provider now implement checkpoint delivery
alongside the existing room agreement. The gated game file sender/receiver is connected in native182 and private
WASM017, with live execution still unverified. Local relay and fake-provider
verification do not establish
completed co-op travel or internet gameplay. No running service or served game
was updated for this change.

The native bridge must bind every command/event to its current exact joined
epoch, frozen roster and canonical game descriptor. The relay binds the wire
serial to the current room proposal and authenticates senders through their
socket/player membership. Descriptors remain opaque to the relay. No host
path, guest address or actor pointer crosses the network.

## Wire contract

Use the existing `recomp-directplay-v1` WebSocket endpoint and 20-byte DPR1
header. Opcode13 is a checkpoint RPC; event110 is its asynchronous delivery
event. Words are little-endian u32. RPC request IDs remain strictly increasing.
All commands start with action and proposal serial; Enable uses serial0.

| Action | Fields following action and serial | Meaning |
| --- | --- | --- |
| 6 Enable | length-prefixed `checkpoint-delivery-v1` | Negotiate before a proposal; requires registered player and prior barrier negotiation. Reply is u32 version1. |
| 0 Request | exact length-prefixed proposal descriptor | Guest needs the target file. One request per guest/proposal; host must also have negotiated delivery. |
| 1 Offer | recipient ID, total bytes | Host answers a requesting guest; total1..64 MiB. |
| 2 Chunk | recipient ID, sequence, byte count, raw bytes | Host sends exactly min(16384, remaining bytes). |
| 3 Acknowledge | host ID, sequence | Guest acknowledges Offer sequence0 or the current Chunk. |
| 4 End | recipient ID, sequence | Host reports all declared bytes sent and acknowledged. |
| 5 End acknowledgement | host ID, sequence | Guest reports verified received bytes; enables its later Ready vote. |

Every event starts with action, serial, authenticated sender ID and recipient
ID. Request has no further fields. Offer appends total bytes. Chunk appends
sequence, byte count and raw bytes. Acknowledgement, End and End acknowledgement
append sequence. Enable produces only an RPC reply. Other successful commands
also have empty RPC reply bodies; acknowledgements arrive as separate events.

Offer waits for acknowledgement0. Chunks start at sequence1 and advance once
each. End uses the next sequence after the final Chunk, and waits for the
distinct End acknowledgement. Wrong roles/recipients, stale serials, duplicate
requests/acknowledgements, overlapping events and premature End/Ready are
refused. Unnegotiated hosts receive no new delivery events.

## Bounds and acknowledgement meaning

The relay retains scalar progress for at most three recipients in a frozen
four-player party. Each recipient has one outstanding Offer, Chunk or End;
the host cannot pipeline payloads before acknowledgement. Every nonfinal Chunk is16 KiB, limiting a64 MiB transfer to4096 Chunks per
recipient rather than millions of tiny acknowledged messages. A maximum Chunk
event is16428 bytes including the header. Transfer records retain no payload.
Normal socket queue byte/entry caps still apply to all message types together.
Queue admission occurs before progress advances, so an enqueue failure cannot
claim that bytes were forwarded.

Accepted requests/acknowledgements refresh the30-second idle deadline, bounded
by a fixed600-second total transfer deadline starting at the first request.
Rejected and duplicate traffic cannot extend either deadline. After all Ready
votes, the ordinary30-second load deadline applies. Cancellation, expiry,
disconnect and room completion release the delivery records; disconnect still
ends the entire room. No smaller party receives implicit resume permission.

End acknowledgement does not certify a loaded world or grant load permission.
The game bridge must write bounded chunks to an admitted private staging file,
flush and check its size/SHA-256 against the canonical descriptor before End
acknowledgement. It then imports/selects that file through the region store
before Ready. The existing Ready adapter performs its own file/hash/profile,
epoch/roster and paused-world checks. Original rebuilding must complete before
Loaded; all Loaded votes remain necessary before resume.

An already verified local target can send Ready without requesting delivery.
The native bridge should process delivery completion and close its owned file
handles before handing control to the shared attachment coordinator.

## Real DirectPlay connection update

Native012 subsequently passes767 reported checks over an owned public TLS
endpoint, including the same stopped save, fixture agreement and cancellation.
Both clients and the relay remain on this Mac. [Public protocol evidence and
scope](native-public-protocol.md) distinguish this internet route from a full
original game or play between independent participants.

The subsequent stopped-save check transfers an independently pinned317,365-byte
original kingdom in20 bounded chunks in each direction on actual native sockets.
Attempt006 reports681 passing checks; a default synthetic regression reports326.
The reference peer's Ready/Loaded votes remain fixture-only, with no original
import/graph load/resume. See [the frozen stopped-save evidence and resource
scope](native-directplay-network.md). This advances real-byte delivery without
qualifying two live kingdoms, independent internet play or browser performance.

The native Mac SDK now hosts and joins actual rooms through its guest COM ABI
and default platform WebSockets against the production relay.329 reported
checks pass across four connections: synthetic chunk delivery, fixture shared
agreement, partial cancellation with room continuity, ordinary packets and
peer loss. No original world/save is exercised. The fixture coordinates
consumption of Complete before another Begin; the game must prove its own
pause/resume ordering. See [native-directplay-network.md](native-directplay-network.md).

## Native transport update (native183)

The Mac socket stub is replaced by Foundation WebSockets, with actual local
socket verification described in [native-websocket.md](native-websocket.md).
The earlier native182 file/SDK results below predate that transport connection.
Actual DirectPlay room and original-game shared loading remain unverified.

## Game file connection (native182 / private WASM017)

The opt-in paused-world path in browser_frontier.cpp now negotiates delivery
before host Begin. It freezes source roots, profile, original pause owner,
frame/clock, local kingdom binding and exact room proposal. Existing local
checkpoints use the Ready adapter; clients lacking the target request that
exact descriptor from the verified pause owner. The host sends only its
admitted, hash-verified selected target file.

CoopCheckpointTransferFile in coop_checkpoint.h owns at most one descriptor
and streams canonical16 KiB chunks. Received files use exclusive
.CoopReceived- temporary siblings
inside the admitted selected profile save hierarchy. The receiver verifies
size, fsync/close, SHA-256 and the current paused agreement before EndAck.
It then uses the existing import/Ready adapter to publish the agreed revision,
vote Ready and remove only its owned inbox file. It never renames/removes the
host source or stores a whole file in memory. The caller excludes concurrent
replacement/writes; filesystem fsync is not a promise of OPFS/directory
power-loss durability.

The coordinator owns at most three host source handles, one receiver and one
16 KiB notice/scratch buffer. It processes at most three delivery/file steps
per original paused tick, keeping original network/UI ticks running. Each
RPC retains the provider's existing timeout; bounded steps do not establish
measured responsive latency. All transfer handles close before shared
attachment. Cancel clears partial input while preserving the source room;
loss/mismatch rejects the exact room and uses the existing original pause
setter to prevent a one-sided gameplay tick. Existing load/rebuild/Loaded/
Complete/resume coordination remains separate.

Ready certifies a peer's local checkpoint, so a host can be Ready while serving
others. A requesting client cannot Ready before EndAck, and the native decoder
still refuses Committed with any unfinished requested lane. A verified
pre-commit Cancel permits a crossing refused action to preserve the source
room; other uncertain sent actions fail closed.

The official real-file target passes1608 checks, including twenty50003-byte
streams with an independently fixed SHA-256, canonical payloads, corruption,
partial input, before/after guard loss, cancellation/destruction cleanup and
import preserving host revision. The fake-provider target passes34151 checks,
including host local readiness, premature-commit refusal and crossing Cancel.
Results and source snapshots are in parent output/native-coop-checkpoint-005/
and output/native-checkpoint-delivery-004/.

The official native182 game build succeeds. A disposable solo restoration
regression makes99 original gameplay ticks across three visits, matches both
saved loads' full typed state and observes16 root disposals;14 trace refusal
controls pass. That run has the shared-read flag absent and does not execute
this new delivery coordinator. Private WASM017 builds and its bounded static
inspection finds the linked game inbox/delivery protocol without instantiating
the module. Source/binary/profile/evidence snapshots are preserved in parent
output/native-region-restoration-generation-182-preserved.json.

Actual game Request/Offer/Chunk/EndAck/import/Ready, shared read/attach/rebuild,
peer resume and victory remain unverified. Native socket support, fresh co-op
region generation, full-match completion, independent internet participation,
browser responsiveness and sustained browser memory bounds remain unfinished.
No relay was restarted and no served browser file was replaced. Browser launch
suspension remains in force because the host-app crash is unresolved.

## Executed verification

Run from the parent workspace:

```sh
upstream/majesty-recomp/.venv/bin/python -m unittest discover -s tests -p test_checkpoint_delivery.py -v
upstream/majesty-recomp/.venv/bin/python -m unittest discover -s tests -p 'test_room*.py' -v
```

The final frozen run passes47 tests:21 delivery tests and26 existing room/
agreement tests. Three new cases use actual local WebSocket connections: a
409773-byte synthetic stream to a temporary file with matching SHA-256 followed
by explicit Ready/Loaded votes, refusal to pipeline before acknowledgement,
and disconnect cleanup. Four-player scalar/window bounds,64 MiB declared size
without payload allocation, deadlines, saturation and malformed input are
covered by direct dispatch cases.

Exact sources/test log/results are frozen in parent output/relay-checkpoint-
delivery-002/ and output/relay-checkpoint-delivery-002-observed.json. Test
PID10436 exits0 and is absent. The descriptor and payload are synthetic;
these tests do not load Majesty, execute a game-owned Ready/Loaded transition,
measure browser memory, or involve an independent internet participant.

## Native provider connection

The C-compatible seam in kit/runtime/native_seam.h now exposes
recomp_network_checkpoint_enable, recomp_network_checkpoint_action and
recomp_network_checkpoint_poll. The production provider in kit/dx/directplay.cpp
decodes opcode13/event110 separately from the original game's Receive queue.
Calls require the guest baton and one unambiguous exact joined epoch. A stale
call cannot open or reconnect a socket. Negotiation must precede Begin.

The game supplies its verified host player ID when requesting the exact
proposal descriptor. Every delivery event must match the current Prepared
serial, frozen roster, local recipient and expected role. The provider keeps
three scalar lanes at most, polled in rotation to prevent starvation, each
with one pending notice; only a client's
Chunk notice retains payload, at most16 KiB. Empty polls clear the output
header without touching its16 KiB payload array. Consuming a notice releases
its payload and permits the next acknowledgement/send. The provider never
accumulates a save or writes a file.

Rejected incoming events or uncertain sent delivery commands lose the exact
session. An ordinary negotiation refusal preserves the legacy room. Cancel,
loss, Close and the next proposal clear delivery state. Committed requires
all requested lanes complete. The final host EndAck notice survives an
immediately following Committed event so the caller can close its file handles;
a new Begin refuses an unconsumed prior notice. Ready, Loaded and game
pause/load/resume remain separate operations.

Run the official directplay_contract_tests target from the game directory
as documented in its docs/testing.md. The final frozen native run passes34114
checks, including the existing DirectPlay regressions and new checkpoint
cases. New coverage includes all4096 chunks of a64 MiB declared stream,
canonical final-chunk sizing, client payload copying, three host lanes,
early Offer/Chunk/End/Ack events before RPC replies, completion interleaving,
cancellation, stale epochs, absence of baton, malformed/duplicate/wrong-role
messages and uncertain replies. This uses a fake transport that immediately
discards sent payload; it does not transfer a real64 MiB file over a socket.
Exact inputs, test binary and CTest log are frozen in parent
output/native-checkpoint-delivery-003/; the test process exits0 and is absent.
The earlier native001 run is preserved as a failed four-player test fixture,
corrected in002 and passing with fair lane polling in003; it is not a passing result.

The Mac native transport now connects real sockets, while the game sender/
receiver has not executed against a real room.
Full shared load/resume, fresh co-op region generation, full-match completion,
independent internet testing and sustained browser memory bounds remain open.
Browser launch suspension remains in force while the host-app crash is unresolved.
