# Reading actual saved order entries with original code

All **154 entries** in the 89 order attachments of the copied Scions and
Brashnard saves now round-trip through the pinned original leaf readers and
writers **without changing their payload bytes**. This extends the prior
synthetic reader fixture to actual captured entry data. It remains an isolated
component test: full order-bank construction, real stream/allocator behavior,
callbacks, actor restoration and active regional travel are unverified.

`scripts/prepare-native-order-reader-cases.mjs` first checks each attachment's
path-storage admission, then traverses its entries and point pairs. It compares
every parsed word with the literal bytes at that entry's file offset. After all
records and file identities pass, it publishes a bounded fixture artifact:
154 cases, 27,848 captured payload bytes and 151,327 bytes of JSON. The largest
payload is 220 bytes. Each case carries its file hash, actor/bank/index, source
range and payload hash. The artifact contains fixture data only and never edits
the source copies or player saves. Source generation and copied-file hashes are
bound in the evidence.

Capture reads are serial and at most 4 KiB, totaling 11,504,725 bytes across the
two files. Separate per-file limits cap diagnostic reads at 64 MiB / 16,384
requests and order attachments at 128. Global capture limits are 256 entries,
512 payload bytes per entry and one MiB of output. Tiny CPU trials additionally
require path capacity/count no greater than ten. This fixture catalogue is
bounded diagnostic data, not an expanding-world runtime catalogue.

The original-reader runner now has an explicit `--checkpoint-cases` mode. It
checks current producer source hashes, the artifact limit, record counts,
versions, lengths, path capacities, literal payload digests, source-file ranges,
duplicate offsets and source identity flags before creating a CPU instance.
Captured entries must have no normalizations. The field/capacity checks are
independent of the digest: editing and rehashing a capacity or version still
rejects unsafe input. Four lightweight Python controls cover these rejection
paths, changed/duplicate/oversized sources and successful schema validation of
the captured fixture. They do not instantiate CPUs or launch a game.

The runner executes the actual captured entries one at a time: **308 original
calls / 80,956 original instructions**, with 77,824 guest-mapped bytes at peak.
Each case is explicitly unmapped and checked empty afterward. Path buffers are
at most 80 controlled bytes. Both whole-input consumption and exact output
equality are checked, as are stack/preserved registers and unchanged fixture
data during serialization. The inputs exercise kinds 2, 4, 5, 6, 7, 10 and 11;
kind 1 remains covered by the synthetic fixture.

Scalar/raw/status stream primitives, empty-name clearing/copying and path
allocation are still modeled. All captured callback names are empty, and the
fixture checks that before modeling a copy. Positive name restoration is
unverified. Constructors are statically pinned and controlled object/table
storage is installed by the fixture; the original factory and bank reader do
not execute. The actual path allocations requested by these entry readers are
80 bytes, but no real allocator runs. IDs and clocks are preserved as data;
callbacks, target lookup, script scheduling and hero behavior do not execute.
Guest mapping limits do not measure browser heap or process RSS.

The default 22-case synthetic fixture still passes its 44 original calls and
10,114 instructions after the runner changes. Its four kind-4 capacity
normalizations remain explicitly recorded; the captured mode uses none.
The [copied-save path admission report](native-order-readers.md) is refreshed
against the current runner. Earlier terminal qualification reports retain
their historical source hashes instead of being rewritten to imply they tested
this version. Current combined evidence is in
`output/native-checkpoint-order-readers-terminal-verified.json`, alongside
`output/native-order-reader-cases.json`,
`output/native-checkpoint-order-readers-emulated-observed.json` and their small
logs. Four malformed-capture controls pass. Web runtime source and player data
are unchanged in this pass.

```sh
node scripts/prepare-native-order-reader-cases.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
upstream/majesty-recomp/.venv/bin/python tests/test_native_order_capture.py
upstream/majesty-recomp/.venv/bin/python scripts/check-native-order-readers.py \
  --checkpoint-cases output/native-order-reader-cases.json
upstream/majesty-recomp/.venv/bin/python scripts/check-native-order-readers.py
node scripts/inspect-native-order-read-bounds.mjs \
  output/checkpoint-unit-reference-browser/scions.GMP \
  output/checkpoint-unit-reference-browser/brashnard.GMP
```

The [combined loaded-entry lifecycle](native-loaded-order-lifecycle.md) now
executes original construction and deletion around these copied entry reads
and identical rewrites. Interrupted-read controls release their unlinked
empty-name state. Full bank construction and actor rollback remain unverified.

Complete native restoration, remaining command references/clocks, destination
navigation and live hero travel remain unfinished. No game/browser launch,
native/WASM build or staging operation ran. The served game is unchanged and
the app-crash suspension remains in force. The full co-op/expanding-world goal
is still active.
