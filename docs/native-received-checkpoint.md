# Retain the prior save while receiving its replacement

The original multiplayer receiver currently opens its final destination with
CREATE_ALWAYS, so an interrupted transfer can replace a complete local save
with partial data. Its END path reports a CRC mismatch and then continues its
ordinary metadata cleanup. These are prerequisites to fix before coordinated
co-op checkpoints or shared regional handoff can depend on received files.

`native_received_checkpoint.cpp` now provides a game-owned staging writer. It
accepts one admitted writable destination, requires consecutive DATA sequence
numbers, caps each append at 4096 bytes and the entire file at 64 MiB, and
creates an exclusive sibling stage. END flushes the file, rereads it with one
4096-byte scratch buffer, checks exact received length and the original
reflected CRC-32, closes it, then replaces the destination with one rename.
Every prior failure retains the destination and cleans up the owned stage.
An overlapping BEGIN refuses without discarding the earlier transfer's state.
The caller must admit a writable profile path and exclude other writers.

The official focused native test passes 88 checks using real temporary files.
It covers a fresh destination, replacement of a longer file, bad CRC, changed
and truncated stages, wrong/duplicate sequences, empty/oversized input, the
64 MiB disk limit, destructor cleanup, invalid paths and denied publication.
A child process exits without destructors after a partial write. The prior
checkpoint remains unchanged; a fresh writer uses a different stage and
successfully publishes while retaining the old orphan for later reclamation.
No game or browser process is launched. All payload/scratch buffers stay fixed;
the disk-limit test streams 64 MiB rather than allocating that amount in RAM.
The pinned audit matches all 256 original CRC-table entries and ten receiver
instruction anchors. Evidence and exact source/binary copies are recorded in
`output/native-received-checkpoint-001-observed.json`. This establishes CRC
compatibility and writer behavior, not original receiver execution.

Run from `upstream/majesty-recomp`:

```sh
.venv/bin/python kit/tools/test.py --game-dir "$PWD" --native-test native_received_checkpoint_tests --jobs 1
```

The writer is now linked into the configured game native sources, with an
original-packet adapter behind `RECOMP_BROWSER_RECEIVED_CHECKPOINT=staged-v1`.
It uses the original packet getters and owning filename strings, then requires
an admitted writable profile path. The original dispatcher retains sole packet
destruction ownership. A failed transfer abandons its stage and rejects the
exact joined DirectPlay session; the dispatch gate consumes already-decoded
game-start packets before they can resume gameplay. Native menu/frame polling
abandons an active transfer after disconnect. The default path and served
engine remain unchanged. The original-packet fixture now passes 2125 checks
with 367 guarded original/COM calls and 18 failed-transfer cases. It verifies
missing and existing destinations, replacement of a longer file, multi-DATA
publication, malformed BEGIN names/length, denied writable admission,
constructor-field sender faults and sequence errors, oversize/empty DATA, bad CRC, premature start, disconnect
and fresh rejoin. The failed gate initially swallowed original category-3
system notifications; the regression now passes and lets session loss reach
the original dispatcher while discarding category-0x100 game packets.
Exact sources, binary and results are preserved in
`output/native-received-packet-005/observed.json`; the eight failing notification
checks are retained in `output/native-received-packet-003/observed.json`.

The official `directplay_contract_tests` target now passes 9001 checks,
including rejection of queued input and pending completion, one session-loss
event, an idempotent repeat, fresh joins on a reused provider, stale tokens,
and ambiguous provider selection. It uses a fake transport; it proves the
provider seam, not a network match. Exact sources, binary and results are in
`output/native-received-directplay-003/observed.json`. The packet fixture uses
real private files and the pinned guest image with a fake transport. It does
not run the full original dispatcher cleanup, load a real GMP world, play a
match or test either co-op role across a network. Those checks remain required
before enabling the adapter. Browser OPFS replacement semantics, directory power-loss durability,
writer exclusion, orphan reclamation and peer checkpoint agreement remain
unverified.

The existing solo region router still refuses network handoff. Co-op streaming
must preserve all participating castles, buildings and heroes; it cannot unload
another player's kingdom merely because it leaves one camera's view. Full
co-op/competitive matches, an independent internet peer and sustained browser
resource limits remain part of the active goal.

## Real save transfer and native kingdom load

The private real-file mode passes4300 checks/715 guarded calls. It streams an
unchanged336981-byte owned GMP through83 original DATA packets, publishes the
file, verifies it using original file-CRC routine00512b90 (38c3a254), and exports
an identical SHA-256 copy. The driver preserves the original source and copied
source, freezes15 fixture inputs and records the actual test binary/CTest trace.
Evidence: output/native-received-real-002.json. Attempt001 ran only baseline
checks because the official runner stripped inherited switches; its report
correctly refuses qualification. Explicit CTest fixture configuration fixes it.

Official native162 then loads that received export through the existing named
profile path in private trial035. It completes100 ordinary game ticks across
three visits/two kingdoms, generates the western neighbor and returns home.
Both complete typed saved-load comparisons match, with16 tracked root frees.
18 native RSS samples peak at183992320 bytes (about175.5MiB). These are finite
native observations, not a browser or sustained memory bound. Evidence:
output/native-received-load-001-observed.json and the34 compiled inputs plus51
preserved evidence files in output/native-region-restoration-generation-162-preserved.json.
This is a sequential transfer fixture followed by solo gameplay; no network
co-op role or full original packet-dispatch cleanup runs.

A subsequent dispatcher review found that category 0x100 dispatch overwrites
packet +48 from manager +4f0 before FILE handling. The old adapter treated
that word as sender; the constructor-only fault cases did not qualify peer
identity. The manager initializes it to 0x31, and the original packet methods
use its low byte for XOR encoding/decoding. See
output/native-received-sender-001-review.json. The preserved real-file/solo-load
proof above remains valid within its scope and predates the correction below.

Unstaged WASM011 compiles and passes bounded static protocol/memory inspection,
including the new receiver markers and29 frozen production inputs. Served
artifacts retain hashes, inodes and mtimes; no WASM instance starts. Its prior
RSS monitor counted only the wrapper process group, excluding compiler groups.
That number cannot support a total build-memory claim. The future monitor now
follows descendants as well; five synthetic ownership controls pass. See
output/wasm-session-candidate-011-resource-scope-review.json. Browser testing
remains suspended under the unresolved host-app crash constraint.

## Correct source identity and original receive queue

The adapter now uses original packet virtual +8 to get the owning source
reference, then source virtual +10 for the DirectPlay ID. The pinned audit
checks 21 instructions and six vtable slots, including the original transport
source setter, upper network ID getter, XOR methods, FILE dispatch and outer
packet destruction. The packet's high-level forwarder setter also replaces
its raw source reference; the fixture now supplies each peer's own original
wrapper. Evidence: output/native-received-sender-009-audit.json.

The direct-dispatch fixture passes 4642 checks/699 guarded calls, with 51 FILE
dispatches and 19 failed-transfer cases. It accepts correctly encoded packets
from source ID 7 across protocol keys 49/0/8, rejects foreign source ID 8 DATA
or END even when the key stays 49, and rejects absent or zero-ID source
references. All player and packet constructors/getters/setters/destructors are
original guest calls. Guest ABI, source and wrapper counts, prior destination
preservation, disconnect/rejoin and the system-loss gate are checked. Exact
sources/binary/trace: output/native-received-sender-008/observed.json.

The current fixture goes further: original deque push_back 0044bc50 admits
each packet to the real manager queue, and outer receiver 00456670 drains it,
calls configured FILE dispatch and deletes it. The fixture neither reads nor
deletes that freed packet afterward. Source/wrapper counts return to their
baseline after every drain, the queue empties, and world/phase stay unchanged.
A failed GameStart-gate assertion never authorizes starting an uninitialized
world. Real-file attempt004 passes 9693 checks/1387 guarded calls with 136 FILE
dispatches and 157 outer queue dispatches. Its 336981-byte GMP is sent in 83
DATA packets, matches original CRC 38c3a254 and exact SHA-256, and retains the
unchanged source. The report freezes 15 inputs and the actual binary/trace:
output/native-received-real-004.json. No game world or browser starts.

Failed fixture attempts remain recorded: 002 used stack scratch overwritten
by guest calls, 003/004 mismatched constructor/dispatcher XOR keys, 005 reached
an uninitialized GameStart path after an expected rejection failed, and 007
assigned the local wrapper to foreign/missing source cases. They are not
qualification evidence. Attempt006 isolates old-receiver rejection of valid
same-peer packets under changing keys, but does not qualify foreign sender
cases because its wrapper setup was still wrong. The corrected, fully frozen
008 and real-file004 are the positive evidence.

The transport remains fake. Actual original system-loss handler cleanup,
network peer registries and both co-op roles, browser OPFS publication, writer
exclusion/orphan reclamation and coordinated peer agreement still need checks.
The staged receiver remains opt-in and unserved; this does not establish a
network match or co-op region travel.

Private WASM012 compiles the corrected receiver and passes static inspection
of 29 recorded production source hashes and its linked receiver markers. The
served files retain hashes, inodes and mtimes; no WASM instance starts. Its
one-job build has three resource samples across the wrapper and descendants,
with sampled aggregate RSS maximum 833437696 bytes (about 795 MiB). This is
a short build observation, not an enforced instantaneous peak or browser
memory bound. Build PID 69855 is absent after terminal exit 0. Evidence:
output/wasm-session-candidate-012-build.json and
output/wasm-session-candidate-012-observed.json. Browser testing stays suspended.

## Natural loss cleanup and original lobby exit request

The old exact-epoch rejection returned immediately when a relay LostEvent
had already marked its provider lost, leaving the socket and gameplay queues
behind. The provider now distinguishes rejected from merely lost: it closes
the transport, releases receive scratch, clears messages/replies/completions,
and retains only an unread genuine system-loss notification. If Receive has
already consumed the notification, rejection does not create another. Repeat
rejection closes only once; a replacement epoch is unaffected. The focused
fake DirectPlay suite passes 9044 checks. Its first failing regression and
fixture correction (withhold the fake transport's automatic SendEx ACK to
actually leave a completion pending) are preserved separately in attempt004.
Positive exact sources/binary/trace: output/native-received-directplay-005/observed.json.

Original session-loss notification category 3/kind 2 dispatches to 0045523c,
which logs and returns through reference cleanup; it does not leave the room.
On the first accepted exact-epoch rejection, the opt-in receiver now sets
curated multiplayer_lobby_exit at 006d7ff0. The original lobby reads this after
00456670 drains its packet queue, branches to 00458150, resets its transfer
context and manager, then clears the flag. No reset runs inside a packet
callback. Natural loss after completed END is detected as well; ordinary
COM Close and stale epochs do not set the flag. The pinned audit independently
matches 32 instructions/eight table slots, including notification dispatch and
the deferred leave branch: output/native-received-sender-010-audit.json.

The stopped original-packet fixture now converts loss notifications, binds
their original forwarder references, enqueues and drains them through the real
dispatcher and deleting destructor. Counts return to baseline, the queue is
empty and world/phase remain unchanged. It consumes the real provider loss
notification for natural losses during and after transfer, verifies the exit
request, and confirms repeats create neither another close nor notification.
It separately invokes original 004bbad0 with an empty transfer context and
004ba850 on the drained manager, proving local-source reference release and
a fresh empty manager. Its synthetic peer wrappers remain local-class objects;
this does not qualify a real remote player registry or an active transfer
context destructor.

Real-file attempt006 passes 10821 checks/1533 guarded calls, 144 FILE dispatches,
190 outer queue dispatches and 23 original loss dispatches. The 336981-byte
GMP still matches original CRC 38c3a254 and exact SHA-256; original/copy inputs
remain unchanged. Sixteen inputs, test binary and trace are frozen under
output/native-received-real-006.json. The fixture explicitly clears the exit
flag before COM rejoin as setup; it does not execute the modal lobby leave
loop. Modal lobby exit, active-match teardown, peer agreement, independent
internet gameplay and browser/OPFS activation remain unverified. The receiver
is opt-in and unserved; WASM012 predates this cleanup change.

## Private WASM013 and isolated launch package

Official one-job WASM013 compiles the cleanup change, exits0, and its build
PID77116 is absent. The source receipt records30 production files, including
globals.toml. Static inspection finds the new loss reason strings and verifies
the existing shared-memory metadata and conservative growth settings without
instantiating WASM.21 finite aggregate build-RSS samples peak at618594304 bytes
(about590MiB); they are not an instantaneous or browser memory bound.
See output/wasm-session-candidate-013-build.json and013-observed.json.

A private launch site is then assembled using the official web launcher tool
and scripts/stage-world.py's new explicit `--site` destination. Its games.json
engine digest matches the actual candidate WASM; the engine/glue/data match
their build receipt. The staged player retains bounded compatibility hashing,
startup cancellation and campaign/multiplayer/world module links.91 package
files and123 recorded production/frontend inputs are copied and rehashed;
the running site's four engine files and games.json retain hashes, inodes and
mtimes. No server starts and no browser/WASM instance launches.

Evidence: output/wasm-session-candidate-013-site.json, with its isolated site
path and file/input hashes, and013-site-tests.tap for focused startup,
campaign progression and invitations. The package still exposes only the
three existing chapters; native chapter4 remains unqualified for shared play.
This is a reviewable unserved package, not browser gameplay or OPFS/publication
recovery qualification. The app-crash suspension remains in force.

For a justified fresh build, use a fresh positive number and existing official
one-job build/inspection tools. After successful static inspection, package
without serving it:

```sh
python3 scripts/prepare-wasm-session-site.py output/wasm-session-candidate-014-build.json output/wasm-session-candidate-014-site.json
```

The helper refuses an existing output/site and a live recorded build PID,
verifies compiled/artifact hashes, and protects the served files. It does not
install a candidate into the running site or establish that activation is safe.
