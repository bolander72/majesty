# Original multiplayer initialization wait

The pinned original host accepts Ready and starts generating a world through
our owned native web relay. Its GoStatus packet contains host player1 and
initialized1; it is not a world checksum. A reference peer sends only lobby
readiness and has no world. It never sends GoStatus or Loaded acknowledgements.
The host therefore waits in original00416c30 with the game clock at0. The
original timeout remains60000ms. This is not playable two-engine gameplay.

## Failure and scheduler correction

The first native185 comparison (lobby011/012) enables cooperative chapter1 in
both hosts. The original spin uses100.43% of one core, and the8ms pause alone
uses100.52%, over approximately11.6-second windows after actual wait entry.
The failed result is preserved in output/native-loading-wait-001-audit.json.
The chapter's gameplay start callback is not observed before the peer wait;
configured rules do not establish a running co-op scenario.

The smoke host's idle callback polls without consuming its requested time.
The scheduler previously returned immediately from that callback, spinning
while a guest Sleep was pending. sched_wait_locked now completes only the
remaining slice on its interruptible condition variable when the host reports
no work. It rechecks baton ownership, completion, exit, queued signals and
eligible input under the mutex. A callback that consumed its slice gets no
second wait; queued events and returning workers keep their original paths.
The game wrapper separately relinquishes the baton for8ms only in Go waiting.
Ordinary gameplay polling and the original readiness protocol are unchanged.

A native regression records342289 idle polls during a30ms Sleep before the
scheduler correction, and one afterward. A callback that queues an actual
host signal releases the original event wait immediately. The official runtime
target passes2257 checks, with0 failures and3 skips. Two failures discovered
in the broader target concerned14 previously undescribed Win32 argument counts
and five intentionally malformed test signatures. Corrected declarations
preserve stdcall stack cleanup, while exact fixture identities remain the only
permitted unknown signatures. Function bodies still remain logging-only;
this does not implement DDE or the missing window/global-memory operations.
Counts were reviewed against primary Microsoft declarations, including
[DdeCreateDataHandle](https://learn.microsoft.com/en-us/windows/win32/api/ddeml/nf-ddeml-ddecreatedatahandle)
and [ScrollWindowEx](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-scrollwindowex).
The full source list and reviewed signatures are retained privately.

Native186 compiles the changes through the official one-job build. The repeated
original-game comparison (lobby013/014) passes: the control uses100.26% of one
core over11.63 seconds, and the corrected wait uses2.54% over11.80 seconds.
Peak native RSS is162.7MiB and166.9MiB respectively. Both preserve the original
packet schemas and close cleanly. Evidence is retained in
output/native-loading-wait-002-audit.json. This qualifies the native
initialization wait only; browser speed is not yet qualified. The48 recorded
input files include the scheduler, its declaration, user32, imports and the
focused runtime tests. Private WASM018 compiles successfully and passes bounded static linked-code
and memory-metadata checks. Its44 recorded source inputs are preserved; peak
sampled aggregate build RSS is1322.8MiB under the2GiB guard. It has not been
published or launched in the browser.

## Reproduction and scope

Use scripts/run-native-multiplayer-lobby.py with a fresh attempt, a matching
official build report, an owned actor-arrival settings fixture,
smoke/native-multiplayer-start.script, `--seconds 65`, --ready-peer and
`--coop-chapter 1`. Run the original-spin control first with
--original-loading-spin, then a candidate without it, sequentially. Both use
exactly the same build, settings, script and chapter rules. The reference's
fixture manifest includes the selected rule. Personal profiles are never used.

Audit each terminal report with scripts/audit-native-lobby-packets.py, then
compare with scripts/audit-native-loading-wait.py. CPU time is measured only
after the real native wait-entry marker. Earlier fixed-time samples may still
be generating the map; no second stable world root is invented. Typed packet
schema, session closure, source/profile/served-file hashes, bounded native RSS
and absence of both producers are checked. Original packet bodies can differ
between random map generations; shape preservation does not assert identical
payload bytes.

This scope is one original host's initialization wait. A second engine,
playable map/kingdoms, full matches, shared checkpoint loading, independent
internet participants and sustained browser resources remain unqualified.
Browser launches stay suspended, and served artifacts and existing services
are unchanged.
