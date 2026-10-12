# Browser startup hashing

The native named-world travel path already reaches original message-queue,
map and buffer frees across four tested travel transitions. This rules out applying
the earlier fixture's orphan-queue cleanup to this path. It does not establish
sustained browser bounds; see [native queue lifetime](native-session-queue-lifetime.md).

The generated expanding-map view now also closes its region stream on page
departure, preventing late reads from generating terrain and discarding queued
work while an accepted save settles. Source29/staged6 focused tests pass without
a browser launch. This is stream lifecycle qualification, not a whole-browser
memory bound. See [expanding-map shutdown](expanding-map-shutdown.md).

The staged Majesty player now hashes imported game content with one module
worker, using serial reads of at most 64 KiB. Previously, the compatibility
check called `File.arrayBuffer()` for every asset before WebGPU initialization.
The largest file in the local original input is 120,696,276 bytes (about
115 MiB). That establishes a large individual input buffer in the old path;
it does not establish why the ChatGPT host app crashed.

`web/world/content-hash.mjs` accepts one File/Blob at a time and has no payload
queue. The worker reads slices and uses the existing incremental SHA-256
implementation. The player closes it in `finally`, including a failed read.
Worker failure, clone failure, a malformed response or a mismatched request
identifier rejects startup hashing and terminates the worker. No fallback
allocates a whole asset buffer on the UI thread.

The asset-path sorting, rule selection, SHA-256 values and final manifest
format remain the same. Mod changes still change both asset and session
identity. Session-rule changes and compatible host engine rebuilds do not
change checkpoint content identity. The staged paired-save diagnostic uses
the same hashing implementation, so it does not reintroduce the old input
buffer when validating imported content.

Reproduce staging without recompiling or launching the game:

```sh
python3 scripts/stage-world.py
python3 scripts/stage-browser-transfer-fixture.py
node --test tests/content-hash.test.mjs
```

Ten terminal tests cover chunk bounds, independent Node SHA-256 comparison,
actual module execution in a Node worker with structured-cloned Blobs, bounded
accepted work, cleanup/error paths, and byte-for-byte session/checkpoint
identity agreement between the legacy function and the actual staged function.
They reject whole-file main-thread reads in a controlled fixture. The complete
JavaScript suite passed 137 tests at that milestone; with subsequent native
terrain window tests, it now passes 147.

This qualifies the algorithm and staged control flow, not browser OPFS,
structured-clone memory behavior, startup time or whole-process/GPU memory.
The largest tested synthetic Blob is just over 1 MiB; the large original asset
was inspected by file size only. Imported path metadata still grows with the
installed content set. The SHA implementation performs its work in JavaScript,
so faster total startup than native WebCrypto has not been established.

The user-requested restriction on in-app WASM tests remains in force. No game,
browser or native build was started for this change. Actual browser memory
measurement and expanding native terrain remain unqualified.
