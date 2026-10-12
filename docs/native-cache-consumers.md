# Cached rectangle consumers and residency

A bounded static audit follows the cache metadata identified by the
[caller audit](native-cache-callers.md) into drawing. It checks six complete
local ranges, 586 instructions, 39 anchors and two initial vtable words against
the pinned executable. No original CPU instruction executes.

Both initial listener tables `0068a8f0` and derived `00680f6c` select `005c8760`
at slot `+0x4c`. This method traverses the cache using its sentinel at listener
`+0x88`; each node supplies its four rectangle words and metadata at node
`+0x20`. The metadata becomes the fifth argument of `005004b0`.

That outline routine calls rectangle fill `00500330` four times along each of
its four coordinate-order branches. A bounded stack-provenance check follows
all four paths and confirms the same metadata reaches every fill as argument
five. Six static fill-call sites implement those paths. A negative fixture
replaces the metadata stack read with the adjacent coordinate read and is
rejected. These checks assume the expected callee ABI; they do not execute
geometry or surface callbacks.

The fill body reads that argument into a numeric register, tests bit 31 to
select a call to `005071b0`, performs explicit packing for 8- and 16-bit surface
formats, and passes the result into surface operations. Thus this cached word
has a concrete pixel-value use in the audited drawing path. The earlier
`80ffffff` and `80cccccc` literals reach this numeric use if the live receiver
follows the initial table. The high bit is a conversion discriminator here;
this is not evidence of alpha-channel semantics. The converter, surface
methods, clip globals and pixel-writing routine remain open dependencies.

## Updates preserve cached membership

`005c8630` finds the first record whose key at node `+0x1c` matches the input
object's key, submits its prior rectangle, queries/transforms the new rectangle,
and replaces four rectangle words. Its only explicit writes outside its own
stack are node `+0x0c`, `+0x10`, `+0x14` and `+0x18`. It does not locally replace
the key or metadata, change list links/counts, free a node or remove duplicates.
Its virtual callees remain unqualified.

The derived update `0043bf90` similarly reads through first-key helper
`005c7a50` and writes through `005c7a00`, using the input's `+0x1c` key and the
listener's `+0x80` collection. Its terrain/numeric/virtual dependencies are not
closed by identifying those calls.

Drawing traverses every cached node rather than selecting by key. Its explicit
writes are stack temporaries; it does not consume or clear the cache. Repeated
keys can therefore remain resident and be drawn even though updates select the
first match. No cache-count cap or scoped record-removal path has been qualified.
The earlier collection-destructor audit frees the entire collection; it does
not establish a safe reusable region-retirement operation.

For native paging, peer membership, dispatcher membership and cached drawing
records still need separate lifetime rules. Numeric metadata use does not
prove absence of actor references in the other graphs or all cache consumers.
No runtime pruning hook or actor-unload policy has been installed.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-cache-consumers.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-cache-consumers.py
```

The qualifier compares evidence with fresh pinned bytes, rejects unpinned
inputs before PE decoding, checks explicit memory destinations and verifies
outline stack provenance on every local branch path. Evidence is in
`output/native-cache-consumers-audit.json` and
`output/native-cache-consumers-terminal-qualified.json`. This qualifies local
data flow, not live listener identity, transitive callback effects or bounded
native simulation. Runtime code, saves and profiles are unchanged. No browser,
game, native build or CPU emulator ran. The previous 254 JavaScript tests were
not repeated for unchanged runtime files. The app crash remains unresolved,
launches remain suspended and the full goal stays active.
