# Private commands in a second loaded kingdom

Subsequent [coordinate qualification](native-actor-cross-placement.md) preserves
fractional positions and distinct saved navigation cells through 64 private
restorations. These actors remain unpublished pending elevation and movement work.

The stopped native fixture now passes a source capture and 64 private restoration
cycles in a different loaded world. It edits only two typed Path/Follow targets
and three common command timestamps per restored actor. This is preparation for
region migration; actors are never published or activated during these trials.

The producer selects Brashnard actors 2101, 2105, 2122 and 2136. Their target 2073
and the explicitly supplied Scions target 497 share the same original vehicle
kind, description and player. The producer requires unchanged copied checkpoint
hashes, unique saved membership, living parentless records and fresh production
reservation descriptors. The 2073-to-497 binding is a fixture input. A matching
template/owner does not establish a persistent entity identity between regions.

The NAS3 pack is 6902 bytes, with four actor records, literal command payloads,
bounded reservation requests, three clock descriptors and two target descriptors
per actor, plus the original source/destination target UNIT records. The offline
source verifier decodes the binary pack independently and checks its typed field
offsets against the literal command bytes.

## Source observation

The original Brashnard loader visits all 1960 units. The live original lookup
resolves target 2073, whose complete serialized UNIT record matches the copied
source record with its own ID normalized for comparison. The original command
writer also matches each selected actor's literal copied bank payload before
and after its private restoration cycles.

The actual stopped global clock is **4000 ms**. It remains unchanged throughout
all 64 cycles and the final target lookup/serialization. Only after those checks
pass does the fixture exclusively create the 36-byte NAC1 source capture, which
contains the clock and observed target metadata. A later destination launch
revalidates the source observations and capture hash before creating its profile.

## Destination observation

The original Scions loader visits all 480 units. Each Brashnard actor is restored
privately using the actual destination factory and existing command manager.
Its own ID and world remain zero; registry and spatial exposure remain deferred.

The binding preflight resolves target 497 through the original lookup, requiring
its kind, description, player, living state, parent and destination factory.
The original lookup must also report that source-local target ID 2073 is absent.
All journal-owned command blocks, typed descriptors, original tables and old
field values are checked before any edit. The actual destination clock is
**8650 ms**. Each private timestamp becomes
`destinationClock - (sourceClock - oldWhen)` using unsigned 32-bit arithmetic.
The native global clock itself is never changed by this binding fixture.

Each cycle first rejects four controls: missing destination ID, wrong player,
wrong description and a mismatched second target descriptor. The last control
fails after earlier descriptors have been checked. All 256 refusals leave both
the complete private command objects and expected serialized payload unchanged.
After valid edits, every command byte outside the timestamp and selected target
fields remains unchanged. The original command writer matches the edited payload.

Across 64 cycles this verifies 128 target edits, 192 timestamp edits and 1152
original journal extent frees. Original DRAIN/UNIT_CLEAR and actor destruction
recover heap, pool and hook baselines each time. Target 497 retains its lookup,
world, ID and serialized UNIT record; factory identity counters remain unchanged.
No gameplay leaf handler is executed by this binding test.

## Reproduce and retained evidence

Generate a pack using a fresh output basename to preserve existing fixtures:

```sh
node scripts/prepare-native-actor-cross-bindings.mjs native-actor-cross-binding-repro
```

Native builds use the official single-job smoke build. The following runners
preserve existing attempts; choose fresh positive attempt numbers for new runs:

```sh
python3 scripts/run-native-actor-populated-stage-fixture.py \
  output/native-actor-target-stage-source.json --cross-source --attempt 1
python3 scripts/check-native-actor-cross-source.py \
  output/native-actor-cross-source-attempt-001.json
python3 scripts/run-native-actor-populated-stage-fixture.py \
  output/native-actor-populated-stage-attempt-005.json \
  --cross-destination output/native-actor-cross-source-observed.json --attempt 1
python3 scripts/check-native-actor-cross-destination.py \
  output/native-actor-cross-destination-attempt-001.json
```

The source and destination observed JSON reports retain separate native source
identities, terminal process records, copied profile/pack hashes and original
logs. The source binary predates the destination helper; its report must retain
that historical source identity. Six offline negative controls reject zero-cycle
observations, a changed destination command age, swapped worlds and a misplaced
source proof without starting a native game.

Destination coordinates, path validity/replanning, complete reference closure,
durable entity continuity, source removal, graph ownership handoff, publication,
activation and interruption recovery remain unqualified. Continuous region
persistence, bounded browser rendering/simulation memory, campaign completion and
independent internet multiplayer remain unfinished. Browser testing stays
suspended and the served WASM is unchanged. The full goal remains active.

The subsequent [original landing queries and point routes](native-actor-cross-route.md)
qualify nonempty class rectangles and full native search with owned cache
retirement; actor relocation and live activation remain unfinished.

The subsequent [destination navigation and invalidation tests](native-actor-cross-navigation.md)
qualify actual outside-grid rejection and private cached-route removal. They do
not yet qualify viable landing positions, original fresh path search or activation.
