# Matched restored actors with nonzero command references

Four actual Brashnard checkpoint actors (2062, 2063, 2067 and 2073) now pass
64 private restoration/deletion cycles. Their matched command banks include
Move Path and Follow Unit targets to saved mobile actor 2087 and building 2120.
There are eight nonzero saved target fields, producing 128 exact target-field
round trips across the 16 cycles per actor. This extends the preceding
[Scions composition](native-actor-populated-stage.md), whose selected targets
were all zero. No target is rebound or activated in this test.

The source uses a version-0 UNIT container with two components and PRIMARY
version 9. Earlier "UNIT v2" wording referred imprecisely to this two-component
profile; the reader argument 2 is its component count. This distinction does not
change the qualified bytes or original loader behavior.

The fresh producer selects those four parentless living vehicle records from
the unchanged copied Brashnard save, verifies literal bank hashes and fresh
production reservation descriptors, and exhausts the typed target iterator.
Only referenced saved UNIT metadata is retained; both nonzero IDs must have
exactly one saved member. This proves saved membership, not target liveness,
destination existence, compatibility or complete reference closure.

The owned source fixture copies three preference/progress files and this pinned
checkpoint into a new directory. The smoke script selects its first save using
the diagnostic's Scions filename, but the file bytes are the Brashnard world.
Its original loader completes all 1960 UNIT visits. This copied filename does
not change the checkpoint's quest or source identity. Original profiles and
earlier fixture directories remain intact. The runner requires the world hash
to match the actor pack before starting the native process.

The first run loaded the world and exited successfully but completed no restore
cycles: the prior diagnostic selected a player-owned vehicle or a vehicle from
its 32-entry trace prefix. This world supplies neither candidate. The corrected
opt-in path reads a 16-byte pack hint and resolves its first identity through
the actual world factory. It requires the pinned vehicle table, matching saved
ID/world association and living state. Complete copied records are then checked
independently against original serialization before any private staging.

Attempt 002 passes every actor and command byte comparison, exact bank ownership
and circular links, 1152 original journal extent frees, original actor deletion,
selected source/counter preservation and per-cycle heap/pool/hook recovery.
Journal ownership remains until original stopped cleanup. Private IDs/world
associations stay zero. Navigation, source target IDs and dispatch stamps remain
literal source values, with no running command callback or destination binding.

Evidence is `output/native-actor-target-stage-attempt-002.json`, its log,
`output/native-actor-target-stage-observed.json` and the bounded NAS1 pack metadata.
The strict verifier rejects attempt 001 despite its successful host exit.

```sh
node scripts/prepare-native-actor-populated-stage.mjs \
  a-fresh-target-pack --target-cases
python3 scripts/check-native-actor-target-stage.py \
  output/native-actor-target-stage-attempt-002.json
```

Destination ID reservation/rebinding, complete actor/script reference closure,
destination navigation, activation, interrupted live cleanup and continuous
world paging remain unfinished. The [common clock probe](native-actor-clock-stage.md)
qualifies private arithmetic against synthetic destination snapshots only.
No browser/WASM operation occurred; the crash remains unresolved and the full
co-op campaign / real internet / expanding-world goal is active.
