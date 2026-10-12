# Bounded browser-player logging

The player now limits two logging sinks that could accumulate native trace
messages. Enabled diagnostic panels also share one pending animation-frame
update. The change is in the Kit player template and the staged Majesty page;
no WASM rebuild or game/browser launch was needed.

| Sink | Limit |
| --- | --- |
| Recent log history | 512 entries, each at most 2,048 UTF-16 code units |
| Console forwarding | 256 calls and 262,144 code units over the page lifetime |
| Console bursts | 16 calls per 1,000 ms accounting window |
| Pending diagnostic updates | One animation-frame callback shared by both panels |
| Runtime panel | Last 40 bounded entries |
| Network panel | Last 30 network entries within the bounded history |
| Failure details | Last 80 bounded entries |

These character limits are not measurements of heap bytes. Truncation copies
code units into a new string rather than retaining a substring of a potentially
large native trace. Unicode code units are preserved, including a surrogate
split at the boundary. Console output is dropped after its allowance; it is
never queued for a later drain. The recent tail remains available through
`window.recompLog`, including after console forwarding stops. Reloading a page
resets its allowances.

Only diagnostic rendering is deferred. Full runtime messages still dispatch
synchronously with their original contents. Disconnect controls, failed guest
exit status, and failure events remain immediate. Disabled diagnostic panels
schedule no animation-frame work. WebGPU error console forwarding uses the same
allowance.

Six new Node tests run the actual player script in a small mock DOM. They check
5,000 long stdout messages, 10,000 stderr messages before a frame, total and burst
console limits, Unicode truncation, full control-message delivery after budget
exhaustion, immediate disconnect/failure handling, and bounded failure details.
The five existing identity tests also pass. All 237 workspace JavaScript tests
pass. The Kit launcher unittest suite passes all three tests and now includes
the logging tests in its Node subprocess.

Run the focused checks from the workspace root:

```sh
node --test --test-concurrency=1 upstream/majesty-recomp/kit/web/player/tests/*.test.mjs
upstream/majesty-recomp/.venv/bin/python -m unittest discover -s upstream/majesty-recomp/kit/tests -p test_web_launcher.py
```

The staged page was rendered from the updated template using `game.toml`'s
title/app name, then passed through `scripts/stage-world.py`'s existing
`stage_player` function. Its diff contains the logging changes; existing content
hashing and world startup guards are preserved. The rendered result matches
exactly and staging is idempotent. The WASM file's size and modification time
were unchanged; its contents were not rehashed in this check.

Evidence: `output/player-logging-terminal-qualified.json`,
`output/player-logging-stage.json` and `output/player-logging-stage.diff`.
Focused Kit logs are under `upstream/majesty-recomp/kit/build/player-logging/`;
the workspace suite log is `output/player-logging-root-tests.log`.

This qualifies bounded logging behavior in terminal fixtures. It does not
measure the live game's frame rate or total memory, bound native message
formatting or control-event listeners, or qualify worker/GPU teardown. It does
not establish that logging caused the host-app allocator failure or that the
crash is fixed. The [crash investigation](app-crash-investigation.md) and the
browser/game launch suspension remain in force. The co-op and expanding-world
goal remains active.
