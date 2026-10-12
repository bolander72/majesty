# Current WASM memory contract

Static inspection of the staged Majesty artifact confirms one imported
`env.memory`: minimum 8,192 pages (512 MiB), maximum 65,536 pages (4 GiB), shared.
The generated glue requests matching initial/maximum capacities. It preloads
eight workers and sends the same memory object to each. These are capacities
and source-level ownership observations, not eight separate 512 MiB heaps or
a measurement of physical RAM.

The inspector reads only section headers and import/memory metadata. Each pass
reads 12,365 bytes from the 108,718,147-byte artifact; its largest request is
53 bytes. It seeks past code, data and other section payloads. The code section
is 106,365,771 bytes; that file size is not a measurement of compiled-code RAM.
The script neither compiles nor instantiates the module. It checks file inode,
size and modification time before/after, and records that identity rather than
rehashing the entire artifact. Uninspected payload changes preserving that
identity are outside this evidence; the tool is not a full module validator.

The supported section/import grammar follows the
[WebAssembly binary module format](https://webassembly.github.io/spec/core/binary/modules.html)
and the shared-memory flag in the
[threads proposal](https://raw.githubusercontent.com/WebAssembly/threads/main/proposals/threads/Overview.md).
Unsupported limits/features, malformed bounds, oversized names/import counts
and metadata-read budgets fail closed. Inspection fixtures cover imported and
defined memory, a sparse 4 MiB skipped payload, and ten rejected inputs.

## Growth pressure

The staged `_emscripten_resize_heap` uses 20% geometric growth, capped at 96 MiB
above the request, with smaller 10% and 5% retries if growth fails. A numeric
mock executes only the extracted resize function; its heap view is an object
with a length field and its growth function records numbers. No WASM memory,
worker, module or large buffer is allocated.

When current capacity is 512 MiB and the request exceeds it by one byte, the
first attempt is **608.0625 MiB** after page alignment. If the first two
attempts fail, the third uses the smaller retry capacity. Five cases check
success, retry, complete refusal, a request at current capacity and a request
beyond the effective limit. The glue's effective heap limit is 4 GiB minus one
64 KiB page, below its declared memory maximum.

This identifies potential allocation pressure worth evaluating. It does not
prove those requests occurred during the host-app crashes, that a smaller cap
would improve performance, or that the same allocator handles both requests.
No memory policy has been changed. A lower growth cap needs build and runtime
qualification; a smaller startup heap would also need a matching module import
declaration. Merely editing the JavaScript initial capacity conflicts with the
current compiled contract.

## Native region implications

The current generated web configuration sets the guest arena to 256 MiB.
`mem_init` requests that arena through `os_vm_reserve`; the POSIX implementation
uses anonymous read/write `mmap`. The exact browser backing behavior and resident
page count are not qualified here. Main-stack configuration is 8 MiB and the
default pthread stack configuration is 16 MiB. Worker-stack allocation timing,
active thread count and total startup residency are unmeasured; multiplying
the idle pool count by stack size is not an observed allocation total.

Region retirement must release and reuse native allocations within that
arena, alongside bounded scene ownership. Hiding terrain or removing DOM
elements does not establish this. Lowering startup/growth settings cannot
substitute for bounded actor, script, cache and terrain lifetimes during travel.

```sh
python3 scripts/audit-wasm-memory-contract.py
node scripts/check-wasm-growth-policy.mjs
python3 scripts/qualify-wasm-memory-contract.py
```

Evidence is in `output/wasm-memory-contract-audit.json`,
`output/wasm-growth-policy-observed.json` and
`output/wasm-memory-contract-terminal-qualified.json`, with small logs and
source hashes. The qualifier compares a fresh artifact inspection, checks
parser fixtures and current growth-probe identities. Runtime artifacts,
settings, saves and profiles are unchanged. No game/browser launch, worker,
native build or WASM compilation ran. The previous 254 workspace tests were
not repeated for unchanged runtime code. The allocator-OOM crash investigation
still lacks a memory source and exact trigger; launches remain suspended and
the full co-op/open-world goal remains active.
