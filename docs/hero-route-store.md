# Registered heroes beyond a fixed region pair

The existing entity revision format binds custody to two regions. Replacing its
immutable identity on each hop would lose the hero's logical identity and home
registration. `HeroRouteStore` retains the original version2 identity byte for
byte while selecting custody in an arbitrary region journal. It is stopped-save
transaction code and is not connected to live movement or region activation yet.

Each visited region retains at most two GMP slots. A handoff stages the outgoing
checkpoint without the hero and the incoming checkpoint with the hero, checks
both, writes a hash-linked metadata node, and publishes one atomic head. Before
publication, a restart selects the old owner; afterward, it selects the new owner.
Staged worlds are checked again together immediately before publication. Recent
exact retries are idempotent; stale manifests and conflicting retries refuse.

Each journal node is bounded to4 KiB and changes at most two regions. Lookup walks
metadata sequentially and retains at most two selected entries; scoped consumers
receive at most two revocable checkpoint readers. Old snapshot references in the
journal are historical: lookup uses only the newest entry for each region and
never selects an overwritten historical slot. Metadata grows with transactions,
and finding an old or unvisited region takes linear history traversal. A durable
index or compaction remains necessary for long-running world performance.

The origin guild stays fixed. At home, native and GPL membership must agree with
custody. Elsewhere, the hero refers to an inert, unscheduled guild projection,
never an unrelated local building. Departed native IDs, script agents, queues,
physical children, container memberships and typed incoming GPL references must
be absent. Returning to a visited region requires fresh native and agent IDs.
The store currently admits no external reference bindings; it refuses rather
than discarding unknown hero script/order references. Arbitrary opaque native
reference closure and dependency lifetime are not established by these checks.

`prepareRouteRegisteredHeroArrival` uses the same original actor preparation
routine as paired transfers. Its region context is separate from the immutable
origin identity. This exposed and fixed an existing assumption: a departure from
a remote region always inserted a native guild parent on arrival. Remote-to-remote
travel now preserves the empty native-home group; only an actual return to the
origin guild restores its native membership. Existing paired preparations retain
their behavior.

## Verification

The ten relevant Node suites pass169 checks, including13 route-store cases:

```sh
node --test tests/hero-route-store.test.mjs tests/registered-hero-arrival.test.mjs \
  tests/entity-hero-home.test.mjs tests/entity-pair.test.mjs \
  tests/checkpoint-arrival.test.mjs tests/hero-home.test.mjs \
  tests/remote-home.test.mjs tests/remote-home-task.test.mjs \
  tests/hero-home-task.test.mjs tests/actor-family-clocks.test.mjs
```

Synthetic cases include three distinct regions and a fresh-alias return to the
same registered guild, complete expected actor-record comparisons for remote
and home arrivals, four publication interruption boundaries, staged-world
corruption, stale ownership, duplicate owners, escaped readers, and90 movements
with only six retained GMP slots across three regions. These are synthetic
checkpoint tests, not native gameplay or browser memory evidence. Logs001–003
preserve intermediate failures; log007 is the final169-check regression result.

The real-file qualification reads terminal original-native session057 exports:

```sh
node scripts/qualify-stopped-hero-route.mjs \
  output/native-region-session-attempt-057.json \
  output/hero-route-008-original-checkpoints.json
```

It seeds custody from the immutable exported home checkpoint, publishes the
normally evolved home departure as a save, and reopens the actual Warrior504/
GPL28 with the same entity and guild identity. Real-file reads and writes are
bounded to4 KiB, with one active read and two retained home GMP slots. The local
adapter is serial fixture supervision, not an OS or browser writer lock.

The generated `-1_0` checkpoint is refused for lacking a registered pure home
projection. A453-byte projection for fresh agent1001 is prepared and independently
validated against the immutable guild registration. It is an inert original GPL
record, not inserted into a synthesized receiving GMP. All source checkpoints,
the receipt, source manifest and original log remain hash-identical. The script
starts no game, service or browser and changes no player profile or served file.
Log005 preserves the incorrect preparation option, corrected in the subsequent
successful run. Report006 precedes the final staged-world recheck; report008
qualifies the current source.

## Remaining integration

Restore the prepared projection through the original runtime in the generated
region, qualify hero import there, then connect owner publication to original
departure/arrival and continuous seam movement. The shared world writer must
coordinate region saves and all heroes' custody; a separate private per-hero
journal cannot by itself arbitrate simultaneous heroes or other players changing
the same kingdom. Guild recruitment, death/destruction, remote home commands,
opaque dependencies, co-op activation and internet full-match testing remain
open. Browser launches remain suspended under the workspace crash constraints.
The full goal is active and incomplete.
