# Private actor restoration before publication

The game-owned original order-reader adapter now refuses actors with a nonzero
native identity (`UNIT+60`) or world association (`UNIT+84`). It also requires
the pinned vehicle table, original UNIT reader, bank-allocation return site and
bank-field offset before calling the controller. These are necessary checks for
the private construction path, not proof that no other alias or callback exists.
The caller still qualifies construction, stopped execution and ownership.

The focused original-code fixture passes **420137 checks / 201 trials / 6310
native calls**. Seven new controls cover nonzero identity, world association,
both together and each of four mismatched reader sites. Each refuses before
claim consumption, preserves the attempted object's bytes and the CPU, leaves
the controller failure state clear and retains the same four hooks. A subsequent
valid load still succeeds. All 90 original complete private vehicle lifecycles,
450 pooled allocations/frees, existing refusal/truncation controls and per-trial
heap/pool recovery continue to pass. Partial UNIT buffers explicitly initialize
identity/world fields to zero; the full objects get their state from the actual
original constructor with factory argument zero.

A new pinned executable audit follows the actual version-9 PRIMARY branch.
The earlier unit lifecycle audit identifies a similar version-3/4 branch; those
addresses must not be substituted for version 9. Version selection is checked
at `005c024f`, construction at `005c0286`, registration at `005c02fb`, description
resolution at `005c0308`, position restoration at `005c0314..005c032f` and cell
dispatch at `005c0337`. The registration method assigns identity/world fields
and broadcasts into registry groups. The selected actor group changes both its
ID tree and actor list. The actor can therefore be discoverable before the rest
of its state has finished loading.

Version 9 always dispatches the cell method. The pinned initial vehicle method
skips mutation for an actor with a parent when its `0x80` state flag is clear.
Otherwise it removes old spatial membership, stores cell coordinates, inserts
new spatial membership and can invoke a global observer. A nonzero parent alone
is insufficient to exclude those side effects. Pausing the gameplay loop does
not undo registry or spatial exposure.

The audit verifies 10 complete methods, 40 instruction anchors and seven virtual
slots against the pinned PE. It refuses an unpinned input before PE parsing.
This is static evidence: the spatial insertion body and runtime target of the
global observer are not closed or executed by this audit. Other PRIMARY
versions/tables and deferred publication remain unqualified.

The current full actor arrival fixture calls the original PRIMARY reader, which
registers its new actor before returning. Its returned object cannot be passed
to this private order adapter. The next integration needs a staged full UNIT
loader that constructs outside the world registry, preserves original PRIMARY
and vehicle secondary state, handles or defers spatial callbacks, loads verified
orders, resolves destination references/navigation/clocks and qualifies failed
construction cleanup. Publication and scheduling follow successful preparation.
Simply loosening the private admission check would leave that problem unresolved.

A [staged original actor adapter](native-actor-stage.md) is now implemented and
configured for native compilation. Official regeneration admits the PRIMARY
method as a hookable function entry. The isolated native fixture now passes 64
complete private restore/delete cycles and one pre-registration refusal cleanup.
Parented serialization borrows read-only source context; populated orders,
destination bindings and live publication remain unfinished. The extended static
audit covers 12 methods and 48 anchors. Earlier reports retain historical counts.

Reproduce:

```sh
upstream/majesty-recomp/.venv/bin/python scripts/audit-native-actor-publication.py
cd upstream/majesty-recomp
.venv/bin/python tools/test.py --native-test native_order_bank_read_hook_tests --jobs 1
```

Evidence: `output/native-actor-publication-audit.json`,
`output/native-order-unpublished-admission-observed.json` and its copied CTest log.
The preceding reusable-hook reports keep their historical source hashes.
No production arrival consumption, continuous world paging, independent WAN
play or whole-browser memory bound is qualified. No browser/WASM launch, build
or staging occurred; the unresolved host-app crash suspension remains in force.
