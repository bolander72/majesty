# Initial UI cache registration arguments

The previous listener audit traced a cache word to the second caller argument,
but its callers and ownership were unknown. A bounded static audit now checks
two sites in `00437b10` and their initial constructor chain against the pinned
executable: five complete local ranges, 535 instructions, 31 anchors and two
vtable words. No original instruction executes.

| Call site | First argument | Second argument copied into cache metadata |
| --- | --- | --- |
| `00437d22` | Object loaded through `[ebp+8]` | Literal `80ffffff` |
| `00437d4a` | Object reached through the `005c3490` result's `+0x50` and `+8` fields | Literal `80cccccc` |

Both sites push the literal first, then the object argument, and invoke receiver
slot `+0xe8`. Under the audited registration ABI, the literal occupies entry
stack `+8` and becomes embedded cache value `+0x18` (node `+0x20`). These values
resemble packed display colors; that interpretation is an inference. The cache
consumer and color format are not qualified by this audit.

The caller selects factory `004384b0` variant 2. Its successful allocation path
allocates 160 bytes, invokes `0043ac50`, and stores the returned listener at the
factory object's `+8` field. The derived constructor calls `005c7b30` and then
installs table `00680f6c`. Both this table and base table `0068a8f0` initially
resolve registration slot `+0xe8` to `005c88f0`, which the
[cache lineage audit](native-listener-cache.md) already traced.

The factory selector is independently resolved to entry stack `+4`; its
embedded initializer returns without argument cleanup. The caller's literal
selector, variant branches, allocation, result store and derived table install
are pinned. Intervening calls and callbacks remain open: initial construction
does not prove the live table still has that target at either registration.
The second registration also depends on its lookup and null checks.

For future region unloading, these two sites provide concrete literal metadata
origins instead of an unidentified runtime argument. They do not establish
that all metadata is scalar, that these UI listeners belong to a retiring
region, or that raw peer pointers and dispatcher memberships have been removed.
Other callers, missing listing functions, dynamic table changes, record
consumers and complete actor/GPL teardown remain unqualified. No runtime hook
or cache pruning policy has been installed.

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-cache-callers.py
upstream/majesty-recomp/.venv/bin/python scripts/qualify-native-cache-callers.py
```

The qualifier compares saved evidence with a fresh audit, rejects unpinned
input before PE decoding, checks constructor ABI and stack placement, and uses
independent decoded fixtures to distinguish literal metadata from register
arguments. Evidence lives in `output/native-cache-callers-audit.json` and
`output/native-cache-callers-terminal-qualified.json`. Runtime files, saves and
profiles are unchanged; no game/browser launch, native build or CPU emulator
ran. The earlier 254 JavaScript tests were not repeated for unchanged runtime
code. The app crash remains unresolved and launches remain suspended.
