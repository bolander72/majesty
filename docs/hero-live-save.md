# Saving a registered hero during gameplay

The selected-hero path now connects the Frontier save buttons to a shared
native/WASM pause/checkpoint/resume sequence. Its source is assembled into an
isolated launcher overlay; the served browser game has not been replaced or
launched. Browser durability remains unverified under the host-app crash
constraint.

After the prepared hero is bound to its original native/script registries and
the kingdom reaches ready, **Save hero journey** requests the next serial.
The engine requests its original paused dispatcher (phase7), verifies the
clock is unchanged through that transition, then uses the existing original
serializer and alternating native checkpoint store. It reports only the
serial, region, saved clock, selected slot, size and digest. No hero pointer or
save-body buffer remains in the bridge. Paused original input and exit remain
available while publication is pending.

`publishNativeHeroGameSave` belongs to this document's prepared, injected game.
It borrows that game's lifetime exclusive world lease, reads the exact
reported native checkpoint, and permits writes only in that named world's
`hero-route` directory. It cannot replace native saves, visit another region,
write another world, or release the engine lease. Publication selects the
current journal head, checks the loaded hero/home aliases, fully validates
the checkpoint roots and reciprocal guild membership, and checks its clock
against the held event before publishing. The previous journal clock cannot
move backwards. An identical selected checkpoint needs no new revision.

The JS save session acknowledges success or failure only after publication
settles. The engine requests original gameplay (phase3) and reports actual
resumption at the same held clock. Save-and-return waits for this event and
completion of outstanding publication I/O before navigation. A failed save
resumes without navigating. Interrupted or uncertain atomic publication is
resolved from the durable journal head; cancellation never releases the
injected game's lease. Leaving the paused state, finishing the quest, leaving
the page or a runtime failure disables further journey saves and drains work.

Hero links consume their startup parameters at ready. The recovery link keeps
the captured hero identity so that a subsequent launch prepares the current
journal again; the region menu and Frontier links remain ordinary links.
Neighbor travel is disabled for a registered hero until the actual
retirement/import/activation path is connected. Ordinary region saves retain
their existing controls.

## Evidence and limits

`output/hero-live-save-tests-004.log` records120 passing focused tests.
`output/hero-live-save-regression-001.log` records249 passing tests and three
explicitly skipped optional original-data cases. The original-data checks
were separately run with their required inputs. Controlled DOM tests drive
the actual HUD adapter through pending publication, both failure forms,
native release/resume, page departure and completion refusal. Controlled
storage tests cover multiple saves, strict checkpoint/clock/actor admission,
read/write/stream-creation cancellation, uncertain head publication, retry and
retention of the real test game lease. All service reads/writes are at most
4KiB and performed sequentially.

Official build304 compiles the shared engine source using the existing54
compiled inputs. Native trial010, with production selected-hero flags and no
private halo/import/AI fixture, loads hero513/agent29 and guild469/agent7 at
clock114000. Original gameplay advances to115900; the engine saves a335853-byte
checkpoint, holds phase7, accepts the script's saved acknowledgement, and
resumes phase3 at115900. It exits0/absent in18.780s, sampled peak179159040B.
Trial011 independently acknowledges failed publication and verifies the same
native resume sequence, exiting0/absent in18.766s, sampled peak179208192B.
The script acknowledgements qualify the native handshake; they do not establish
that a browser published the journal concurrently.

Earlier trials008/009 captured before the first gameplay update because the
request was queued during loading. Their handshake ran, but the qualification
correctly failed its elapsed-gameplay requirement. Those attempts are preserved.
The corrected script supplies the original window input before requesting a
save; the engine implementation did not change for those retries.

`output/hero-live-save-original-002.json` independently replays trial010's
actual bounded native held event and checkpoint through the production JS
session, startup and live journal publisher in an isolated filesystem-backed
OPFS fixture. Publication advances the separately enrolled journal from
revision1 to2, keeps hero513/29, validates the actual guild, selects clock115900,
and leaves the original native output, source journal and native marker/body
unchanged. A second startup remains denied after resumption. The controlled
content fingerprint is explicitly recorded; this does not prove compatibility
with installed browser assets, real OPFS/Web Lock durability or live WASM
execution. The service retains no active I/O after completion, peaks at one
operation, and uses at most4096-byte reads/writes.

`output/hero-live-save-site-001/manifest.json` preserves the isolated103-file
launcher overlay, checks312 relative imports, staging idempotence and unchanged
served pages. It contains no executable WASM engine. Current inputs and evidence
are preserved in `output/hero-live-save-generation-304/manifest.json`.

The subsequent [held geometry admission](hero-travel-layout.md) validates the
published source and one saved neighbor while the game remains paused. It
preserves the same world lease and does not yet execute the actor handoff.

The full goal remains active: seamless hero movement and bounded active regions,
cooperative region ownership and campaign objectives, complete shared matches,
independent internet qualification and sustained browser memory bounds remain
unfinished. This save path supplies persistence needed by live exploration.
