# Retained 4 KiB allocations and their queue caller

The preceding complete heap captures found 9–21 live allocations requested at
4,096 bytes after twelve original region teardowns. Address sets alone could
not attribute that growth. Build022 / persistence attempt015 adds an opt-in
size class to the existing original CRT allocation and free observers. It adds
no hooks, allocator replacements or guest frees. The first world load still
precedes hook installation, and realloc/calloc/non-CRT origins remain partial.

The run records 779 events: 396 allocations and 383 original frees. Every known
outer caller is independently checked against an actual direct CALL in the
pinned PE. Five call sites appear; 240 allocations come from `004a0095` in
original queue helper `0049ff10`, exactly twenty per world visit. After the
final teardown, thirteen target addresses match observed surviving allocations:
twelve match this queue path and one matches another call at `005ea6a5`. Eight
baseline addresses have unknown origins. Matching addresses do not prove logical
allocation identity across unobserved paths or justify freeing them.

The original queue path allocates a 4 KiB node and, when empty, an eight-byte
map. It sets capacity to two and initializes its iterator pairs around the
middle of the node. The queue still has a surviving node after each world exit.
Its owning caller and original retirement path needed further observation.
Twenty-eight altered trace/CALL cases refuse; all twelve original visits,
24 snapshots, ten persisted revisits, 240 completed ticks and 72 root frees pass.

Build023 / attempt016 adds a metadata-only queue caller observation. That run
is explicitly **unqualified**: the first fallback incorrectly treated
`heap_size`'s `UINT32_MAX` unknown-pointer result as a readable map size. Its
terminal exit is zero, but 73 of its 80 contexts carry that invalid sentinel.
The raw log and refusal report are preserved. It is not registered as a
qualified historical generation and contributes no positive map-lifetime claim.

Build024 / attempt017 rejects that sentinel and checks physical guest bounds.
Four original region visits collect eighty active queue-call contexts. The
audited helper prologue reserves sixteen local bytes and saves three registers.
Together with the independently audited 28-byte CRT call frame, the helper's
return is at hook stack `+56`. Its actual caller is `005a4e0d` in `005a4d80`,
which selects a recipient queue and pushes a message record. The direct CALL to
`0049ff10` is independently pinned. All eighty observed allocations begin with
queue count zero; bounds permit reading map entries only when storage is known.

These observations occur during an active call. They do not establish queue
lifetime or ownership after the caller returns or after world disposal. A live
small allocation at a stale map address can belong to something else. The
recorded prefix word is not assumed to be a vtable. No forced free or guessed
queue retirement is introduced.

The corrected four-visit run qualifies eight state snapshots, two persisted
revisits, eighty completed ticks and twenty-four root frees, with twenty
negative context/CALL controls refusing. The unknown-size sentinel is now an
explicit negative control. Two changed queue-layout instructions also refuse.
Twenty-nine resource samples reach 189,464,576 bytes RSS (180.7 MiB) over 56.5
seconds. Sampled native RSS does not measure browser peaks or establish a
performance improvement. Twelve-visit page findings remain separately
qualified; the four-visit context scope does not replace them.

Both qualified source/executable generations are preserved, synced and rehashed
with 4 KiB buffers. The next step is to observe the queue descriptor and its map
before and after original world disposal, locate its owning lifetime and verify
the original cleanup method. Sustained memory bounds, generated adjacent
terrain, continuous travel, cooperative handoff and internet full-match
completion remain unfinished. Browser game launches remain suspended, and the
served WASM is unchanged.

Reproduce with fresh attempt/report numbers using the existing persistence
runner plus `--pages`. Use `--page-context` for active caller metadata; the
corrected probe is build024, while build023 must remain unqualified.

```sh
python3 scripts/build-native-world-residency.py --attempt NEW_BUILD_NUMBER
python3 scripts/run-native-world-residency.py \
  output/native-repeat-handoff-publication-observed.json \
  upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-0bies5/Selected_Entity_Revision.json \
  output/native-world-residency-build-NEW_BUILD_NUMBER.json \
  --attempt NEW_RUN_NUMBER --persist --visits 12 --survivors --allocator --heap --allocation --owners --pages --page-context
node scripts/check-native-page-sites.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_PAGE_REPORT.json
node scripts/check-native-page-context.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_CONTEXT_REPORT.json
node scripts/check-native-page-context-controls.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_CONTROLS_REPORT.json
```

Evidence: `output/native-page-sites-observed.json`,
`output/native-page-sites-controls-observed.json`,
`output/native-page-context-refusal-observed.json`,
`output/native-page-context-observed.json`,
`output/native-page-context-controls-observed.json`,
`output/native-page-generation-preserved-observed.json` and
`output/native-queue-context-generation-preserved-observed.json`.

The actual committed-hero kingdoms now have a separate
[lifetime observation](native-page-owner-lifetime.md): retained descriptors and
maps remain allocated with one pending message after disposal. Current recipient-
tree membership and safe cleanup remain unfinished.
