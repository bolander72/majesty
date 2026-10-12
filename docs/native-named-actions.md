# Native named controls for cooperative testing

The native host can now publish the same boolean names that the browser UI
supplies to the game. `action frontier-surrender` in a smoke script reaches
`os_browser_take_action("frontier-surrender")` in the existing campaign input
handler. That handler still checks the active chapter, settled state and local
network kingdom, then asks the original game to publish its replicated loss
command. The host supplies no guest address, kingdom ID or result value.

The request store has16 fixed entries and names of at most63 ASCII letters,
digits, underscores or hyphens. Producers and consumers share a mutex. Each
name is consumed once; duplicates coalesce without extending the original
one-second lifetime. A full store refuses a new distinct name. Unhandled
requests expire and explicit input-context teardown can clear the store.
The smoke host treats the new command as input, ending its host turn before
the following command. Refusal fails the run. Accepted requests are not proof
that the game accepted or applied the operation.

The browser still uses its main-thread `recomp-action-poll` event. Its native
request API refuses; it does not gain an additional script or network endpoint.
These source changes do not publish a browser build.

## Verification

The official focused platform target checks validity, exact name matching,
single consumption, duplicate coalescing, expiry, full-store refusal, reuse,
clear and concurrent native producers. The script parser now has an official
CPU-only target, with assertions enabled in Release builds. It checks the new
verb, timings, maximum name length and refusal of missing, extra and invalid
arguments. Its old counter fixture now uses selected-game configuration
instead of another game's raw addresses. The first failing run is retained.
The optional historical game scripts are absent here and were not checked.

The final platform run reports282 checks and zero failures. It includes a
clock-ordering regression: an older producer sample cannot expire a newer
request while waiting for the mutex. Four provenance tests and21 focused
Python controller/script checks pass. Nine first-party native files pass the
kit formatter. Official one-job builds193 and194 succeed.

The isolated native193 session056 runs the original game across
`0_0 -> -1_0 -> 0_0`. Fifteen smoke requests queue; ten reach the ordinary
checkpoint handler and produce original saves in the active region. The
remaining requests may expire during loading. No request refuses and no
checkpoint fails. The original game completes the route and exits0; its PID
is absent. Eighteen finite samples over35.750 seconds peak at189,939,712 bytes
(about181MiB). This is a short native observation, not a sustained bound.
Developer registry/runtime files, source saves/settings and refusal sentinels
remain unchanged. The served browser artifacts retain their hashes, inodes
and timestamps.

This gameplay observation binds native193 before the clock-ordering fix.
Its exact source/evidence archive is output/native-actions-generation-193;
the isolated session retains its exact executable. Native194 includes the
tested race correction but has not run a new original-game session. Neither
result qualifies co-op surrender or browser gameplay.

Evidence: output/native-actions-007-platform-clock.log,
output/native-actions-004-parser.log, output/native-actions-002-provenance.tap,
output/native-actions-012-pair-focused.log,
output/native-world-residency-build-193.json,
output/native-world-residency-build-194.json and
output/native-region-session-attempt-056.json/.log. The initial parser failure
and the failed Python3.14 preparation import remain preserved. The successful
preparation uses the existing Python3.12 environment with websockets installed;
no dependency installation or service startup is needed.

The native build recorder binds five additional inputs as a complete group:
the request header, script header/parser, smoke executor and host CMake file.
The recorder uses its running Python interpreter for the official build tool.
The source-count validator admits archived pre-action builds and refuses a
partially recorded new group. Counting alone does not validate file contents;
the actual session runners compare the recorded digests.

## Subsequent ordinary UI travel

Native195 adds paired native admission and verifies the ordinary regional
travel controls with the request-file fixture disabled. Session057 makes four
trips, restores saved revisits and releases32 tracked original roots. The
co-op preparation then was plan009/native195; current plan010 binds native196
after the subsequent original guild-record work. Plan008 below describes the
prior preserved generation. See [ordinary UI travel](native-ui-travel.md).

## Remaining gameplay checks

The native co-op surrender test still requires two real games and the pending
human exception to the one-heavy-process rule. Current plan008 binds native194,
all53 compiled inputs and seven supervisor inputs. It selects Chapter2 and
guest surrender through the new smoke command, preserving every original
script step. Preparation starts zero games and zero services. Its120-second
deadline,512MiB combined sampled guard and4MiB per-peer log limit remain
unchanged. The old plan007 remains archived and is stale against the current
source tree. A request queued in a
single game cannot establish shared defeat, multiplayer synchronization or
full-match completion. Browser launches remain suspended while the host-app
crash is unresolved. Continuous hero crossings, co-op region activation,
independent-machine internet play and sustained browser bounds remain open.
