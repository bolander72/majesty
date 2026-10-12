# Unavailable cooperative destinations

The production Begin adapter previously returned false after capturing a
shared source checkpoint when its adjacent destination was missing, damaged,
changed, unreadable through the owned profile, or had invalid saved RNG/clock
metadata. The transition controller attempts a proposal once, so that refusal
left the source paused until a separate original resume action.

The adapter now queues the original secondary resume command in those
pre-Begin destination refusal paths, after rechecking the exact joined epoch,
host/pause owner, complete roster, local kingdom selection, profile, world
roots, captured frame/clock and source checkpoint bytes. It grants no new
read, unload or graph-construction permission. Source and target files remain
preserved. The controller still makes one attempt per pause; this does not add
every-frame file I/O, retries, timers or new resident worlds.

The agreement must remain identical to its pre-Begin snapshot. An all-zero
snapshot means no agreement, with the live provider checked separately.
Otherwise only an unchanged Complete or Canceled record with a canonical
bounded descriptor and valid sorted roster is allowed. Prepared, Committed,
changed or malformed agreements refuse recovery. Connection loss and changed
source state also refuse. This applies before any Begin submission; a failure
after unloading still requires the existing Loaded/Complete protocol.

The official no-game transition target passes1212 checks, including refusal
of changed agreements, pending stages, dirty empty snapshots and malformed
terminal records. The original pause/resume fixture passes10945 checks and671
guarded calls without a world, game loop, browser, renderer or audio device.
That existing fixture covers original queue/dispatcher contracts, not a
production Begin invocation. It passed before the final target-refusal
branches were consolidated; the final source compiles into private WASM027.

Candidate027 has57 frozen compiled inputs and a complete125-file isolated
launcher package. Static inspection verifies its sources, protocol exports,
original memory contract and linked unavailable-destination branch without
instantiating the module. Its SHA-256 is
`be1b5409f55eda5e871422c7030e79d4aa3bc49570ed8f5735015347b5f26592`.
Its one-job build process tree sampled peak335.22 MiB. That is build-process
memory, not browser or game memory. The isolated package's profile guard and
actual player HTML pass7 terminal checks. Keyboard fixes are included too.

Actual shared unavailable-destination recovery and fresh co-op region
generation remain unqualified. No WASM game launches, actual co-op travel,
second original native game or live-player publication occurs here. The live
candidate025 engine and player hashes, inodes and timestamps remain unchanged.
That qualification occurred under the earlier suspension. The user removed
the browser launch suspension on2026-10-07; actual co-op recovery is still
unqualified.

Proof, logs, final compiled sources and package hashes are in
`output/coop-unavailable-destination-001/manifest.json`.


Candidate049 adds source recovery for pre-commit cancellation and unavailable
neighbors. A canceled prepared proposal is admitted only for the exact
serial/canonical descriptor/current sorted party and original pause owner.
The relay's existing tests confirm that cancel after commit ends the room;
it cannot authorize source recovery. An unavailable destination before Begin
uses an unchanged empty or terminal snapshot. Its recovery serial is local
correlation only: no proposal or target read is sent, and the relay's next
serial is not consumed. Both paths retain the source roots, frame/clock,
local kingdom binding, profile and match-generation token. Replacement,
connection loss, changed party or destructive load refuses recovery.

Transfer handles and exclusive received temporary files close on admission.
Source and selected checkpoint files remain intact. Only the host queues the
original secondary resume command, once, from the existing004179a9 input
seam after outgoing queue preparation. Completion requires original phase3,
no pending phase and the cleared pause owner at the unchanged source boundary.
The controls retain their coordinates and unlock only on the matching source
resume announcement; queueing alone grants no UI travel permission.

Focused tests:18340 checks/0 failures/750 guarded calls in the original
pause/GPL/geometry suite with synthetic source admission cases;1298 pure
transition checks/0 failures;35 production relay tests;9 controls/DOM tests.
The source cases test both kingdoms, replacement/invalid roots, changed
frame/clock/match type/player mapping and refusal without writes or allocation.
They do not construct a world or execute the production cancellation adapter.
Candidate048 packages the canceled-proposal implementation;049 additionally
covers unavailable destinations. Actual paired recovery, shared destination
resume, original saved return and repeated browser residency remain unverified.
No WASM game was launched and no player profile was read or modified.


Candidate050 additionally excludes original replay mode2 from retained-source
resume admission. Original005a4600 can leave its outgoing resume queued at a
rebuilt frame0. Live modes1/3 remain eligible subject to the existing exact
source/party/proposal guards. This guard has original component and synthetic
source tests; actual paired source recovery remains unverified.
