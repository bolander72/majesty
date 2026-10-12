# Original rectangle collector on isolated drawing buffers

The [listener rectangle audit](native-listener-rectangles.md) identified two
constructor buffers of 50 rectangles and an unchecked integer bank index.
These checks execute only pinned collector `00505860` and splitter `00505db0`
against synthetic drawing state. They launch no game or browser.

The instruction audit verifies 13 anchors and closes direct calls between the
two routines. It checks the splitter's unsigned maximum index of 15 and all
16 jump-table entries against decoded boundaries. There are no allocator or
import call sites, and the CPU checks use no allocator/import stubs.

The guest maps two original code pages, four synthetic state pages, two stack
pages and one return-sentinel page: 36,864 bytes total. That excludes Python,
Unicorn and audit-reader memory. Per-call limits are 40,000 instructions and
500,000 microseconds, with a 2,000,000-instruction total limit, bounded stack
and depth limit of 16. Those fixture limits are not installed in the game.

Completed evidence contains 806 original CPU calls:

- 768 collector calls: 64 updates for each combination of modes 0, 1 and 2
  with banks 0 and 1, replayed with clean and poisoned stack bytes.
- Four collector calls covering intersecting bounds in modes 1 and 2 with both
  stack patterns.
- Two collector calls covering empty-count insertion and full-count fallback.
- 32 direct splitter calls covering all 16 switch masks with both stack patterns.

Completed collector calls preserve input, inactive bank/count and buffer fences.
Writes remain within owned buffers, count fields and bounded stack. Counts stay
at or below 50. Replays match buffer payloads and instruction counts. The largest
sampled stream call uses 5,079 instructions; observed recursion reaches depth
two. The complete run, including stopped invalid-state starts, executes 508,582
instructions.

Empty-count insertion copies `[10, 20, 30, 40]` exactly. Full-count fallback
returns one configured full-bounds rectangle `[0, 0, 640, 480]`. Direct splitter
cases reach every audited switch target and preserve input rectangles. Outputs
occupy at most four 16-byte rectangles. An independent geometric oracle
partitions input/output edges and compares coverage with the existing rectangle
minus the incoming rectangle. All 16 representative masks match. Touching
edges, extreme integers, every numerical branch and general recursion remain
unqualified.

Two additional starts supply malformed state. An index of 2 attempts a read
beyond the two-buffer object layout; a count of 51 attempts a write beyond its
800-byte buffer. The fixture stops those accesses. The original routine does
not reject invalid state itself. Fence and ownership assertions apply only to
completed valid-input collector calls.

This supports the sampled collector operations with owned buffers and valid
bank/count/capacity invariants. It does not establish those invariants in a live
scene, prove actor-reference release, bound native world/actor memory or qualify
region paging. Engine integration still needs valid live drawing state and
scoped listener ownership before a region handoff.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-rectangle-collector.py
upstream/majesty-recomp/.venv/bin/python scripts/check-native-rectangle-collector.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-rectangle-collector.py
```

The qualifier checks fresh pinned instructions, source/evidence hashes, case
coverage and limits without repeating CPU execution. It rejects an unpinned
fixture before PE decoding and keeps live paging and crash-resolution flags
false. Evidence is in `output/native-rectangle-collector-audit.json`,
`output/native-rectangle-collector-emulated-observed.json` and
`output/native-rectangle-collector-terminal-qualified.json`, with small logs.
Original saves and profiles are untouched. No runtime source, build, game or
browser launch changes; unchanged JavaScript tests were not rerun. The host-app
crash remains unresolved and the launch suspension remains in force.
