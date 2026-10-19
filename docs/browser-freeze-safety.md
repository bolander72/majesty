# Browser freeze investigation and containment

The October 19 report describes a Mac-wide hang with repeating audio, most
often while using cheats and community content in Chrome. It is distinct from
an ordinary guest exception displayed by the game. No matching kernel panic
or GPU-reset report was found in the available DiagnosticReports directories.
That absence does not exclude a driver or kernel failure during a hard reset.

Local macOS memory-pressure snapshots from October 15 and 16 account tens of
GiB to a Chrome helper. These are OS page-accounting values, not proof of that
much resident RAM. The process name does not identify its service or a tab;
neither snapshot proves Majesty caused that allocation. The latest October 19
snapshot has a different largest process. Do not blame other applications or
claim the full-system hang is solved from these reports alone.

The player previously reported guest aborts/device loss without explicitly
ending all of its audio recovery, worker threads and graphics resources.
`hosting/runtime-safety.mjs` now supplies idempotent terminal cleanup. It stops
autoplay recovery, pauses the main loop, terminates the owned Emscripten
threads, closes the owned SDL audio context and destroys the device. An
intentional device destruction does not produce another device-loss error.
This applies to the root player and direct `/majesty/` player. Original saves
and game collections are untouched; a damaged running world is not saved.

The same module wraps the game's existing WebGPU device. It bounds estimated
allocation/upload bytes awaiting a queue fence, queue operations and
submissions, and rejects an oversized individual resource before allocating
it. A fence retires only its exact prefix, preserving charges for newer work.
Typed-array offsets/sizes use element units; texture writes use the copy
extent and row layout, rather than charging the entire WASM backing buffer.
Native GPU resources are not held in an additional registry. Wrappers retain
the genuine WebIDL device/queue identities and bind methods to their native
receivers; a Proxy cannot be supplied to canvas configuration.

The initial ceilings are 256 MiB per resource, 512 MiB of estimated unretired
allocation/uploads, 4096 operations and 128 submissions. These measure the
game's queued work; they are **not** a total GPU-memory limit, an FPS target,
or a browser-process memory monitor. Completed GPU resources, driver leaks,
other tabs and a blocked browser main thread cannot be bounded this way.
The existing native presenter also limits display frames in flight. The new
guard covers upload/allocation bursts outside that display-frame count.

Do not reproduce the reported system hang by exhausting memory. Qualification
uses normal gameplay under the external owned-browser resource guard, plus a
small synthetic over-budget request that the wrapper rejects before it reaches
WebGPU. Automated tests separately cover overlapping fences, stalled queues,
4K-sized allocations, compressed copies and cleanup after partial failure.
Long player sessions with the reported cheat/mod combinations still require
observation before claiming the original whole-Mac failure is fixed.

References: [Chrome memory investigation](https://developer.chrome.com/docs/devtools/memory-problems)
and [Emscripten main-thread blocking constraints](https://emscripten.org/docs/porting/pthreads.html).
