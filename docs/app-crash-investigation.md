# Host-app crash investigation and testing restriction

The user reported repeated ChatGPT app crashes during in-app WASM work and
asked us to be cautious. Browser/game startup and running-game browser inspection
remain suspended. Use lightweight terminal checks and static analysis, keep
outputs small, and preserve player profiles and user tabs. This restriction
also prevents qualifying the pending browser co-op recovery and live paging
flows; passing component checks does not satisfy those requirements.

The three existing reports are dated October 3 at 08:03, 08:38 and 08:46 local
time. They show `EXC_BREAKPOINT` / `SIGTRAP` on `Chrome_IOThread` in the host's
Codex Framework. The nearest exported inspector symbols are around 20 MB away
from the reported instruction addresses. Their names do not identify the
actual crashing functions.

`scripts/audit-app-crash-allocator.py` reads only those selected saved reports,
bounded Mach-O headers and 360 code bytes per supported case. It never launches
the app, browser or game, attaches to a process, reads browser/profile storage,
or persists complete crash reports. The older framework binary is unavailable,
so the first report retains its original report-level classification.

For the two newer reports, the installed arm64 framework's UUID matches the
crash image. Thirty-one decoded instruction anchors verify the relevant call
chain and allocator diagnostic fields. The saved trap bytes match the installed
binary exactly. The code stores the diagnostic names `va_size`, `alloc`,
`commit` and `size`, then passes its size argument through the allocation-failure
wrappers into an immediate trap. The recorded x19 value is 2,097,152 bytes;
the original caller also supplies that immediate size.

This is strong evidence for the Chromium allocator's OOM path, inferred from
the compiled signature and primary source rather than recovered debug symbols.
The [allocator implementation](https://chromium.googlesource.com/chromium/src/+/0941a8e04be3c036279fa82a9d44bd391c504a8e/base/allocator/partition_allocator/src/partition_alloc/partition_root.cc)
records those same diagnostic fields before termination.
[Chromium's investigation guidance](https://chromium.googlesource.com/experimental/chromium/src/+/HEAD/docs/memory/oom.md)
distinguishes commit limits, virtual address-space limits and excessive requests.
Those categories cannot be distinguished from this evidence alone. A 2 MiB
failed request does not measure the app's total usage or establish which earlier
activity consumed the exhausted resource.

No crash-time totals, allocator-pool/commit limits, full stack memory or exact
initiating action have been recovered. WASM startup/inspection correlates with
the report times, but that correlation does not prove it caused all memory
consumption. A subsequent read-only system snapshot reports a 24 GiB machine
and 73% system-wide memory free; it cannot reconstruct earlier pressure.
Process labels did not identify app residency, so no app RSS measurement is
claimed. Current free memory does not establish that restarting the test is safe.

Reproduce the bounded code audit with the existing Python environment:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-app-crash-allocator.py
```

Evidence: `output/app-crash-allocator-audit.json`,
`output/app-crash-investigation.json` and
`output/app-crash-memory-snapshot.json`. The source identity and exact hashes
of the four small inspected code windows are recorded in the allocator audit.
No app binary, game runtime, service or original save is changed. The active
game-development goal retains its full co-op, internet and expanding-world
scope; this diagnosis does not qualify recovery or complete that goal.

A subsequent source fix [bounds browser-player logging](player-logging.md):
native console forwarding has lifetime and burst allowances, log entries have
bounded copied text, and diagnostic panels share one pending frame update.
Terminal fixtures qualify those limits while preserving immediate runtime
messages. No game or browser was launched; this is a resource reduction, not
evidence that the host-app crash is resolved.
