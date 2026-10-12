# Native sampling and held crossing capture

The selected hero path now samples current aliases through the original native
registry and GPL manager immediately before and after one original simulation
tick. The shared implementation runs in native and WASM builds. Only scalar
poses/clocks survive a sample; it retains no actor pointer, graph, hook or
regional cache. A living outdoor actor must have the checked class/player,
actual GPL association and four original occupied navigation cells. Guild
attachment makes a sample unavailable rather than inventing outdoor coordinates.

The checked startup receipt supplies a bounded
`majesty-hero-halo-v1|region|saved-sha256` capsule. The player excludes URL
overrides and derives both actor and layout bindings after installed-content
hashing and saved-owner preflight, before GPU/WASM injection. Ordinary startup
deletes old bindings. The engine requires the capsule's region/digest to match
the selected checkpoint exactly. Region names alone never enable geometry.

If the accepted pose crosses one cardinal core boundary, its projected pose
must fit inside both physical maps. The engine rechecks the native/GPL guild
membership at the new clock, requests the original phase7 pause immediately,
and reuses the original held checkpoint writer. No subsequent simulation tick
is allowed to advance the crossing clock while paused. It emits a bounded
crossing event containing the same serial, actor, before/after clocks and
fractional poses. It does not issue a move order or edit hero AI.

The JS save session accepts that event only after bound/ready and only with the
checked layout capsule. It can supersede a queued, unconsumed manual save using
the same next serial, but cannot overlap a consumed save. Wrong identity,
serial, cardinal target, phase, footprint or clock refuses admission. A held
checkpoint and a writer failure must match the accepted crossing clock.

The actual HUD queues the scoped live publisher with this immutable request.
Publication verifies original saved actor/position and terrain before custody
writes, then the read-only held service validates the exact neighbor. The
opt-in prototype keeps the original kingdom paused afterward and exposes
**Continue in this kingdom**. This completes a saved-source capture and
inspection; it does not claim arrival or publish another owner. A refused
publication/neighbor resumes the source through the existing failed result.
Page departure cancels/drains the outstanding capability and suppresses late
completion. Normal paused input and original exit remain available.

The native capability is permanently closed when its game leaves play, ends,
changes region or becomes networked. Later ordinary gameplay cannot revive a
binding from a previously disposed kingdom. No lifetime allocation observer
or actor pointer is retained.

## Evidence and limits

Official one-job build305 succeeded. Code review then identified that the
native binding needed permanent revocation after its game ends; build306
includes that correction and succeeds with the same54 audited compilation
inputs. No generated translations, kit addresses or runtime files changed.

Trial012, using the later114000 save, exits0/absent in18.827s and completes
pause/save/resume, but its movement qualification correctly fails: the hero
is already at its entrance and becomes attached to the guild without an
outdoor position change. The trial is preserved, not relabeled as a movement
success. The runner now explicitly supports the separately verified original
113500 owner for this test.

`output/native-hero-binding-attempt-013.json` uses that earlier save and
production bindings with no private AI/actor activation fixture. It records
four actual original movement changes at113550,113700,113800 and113900,
preserves fractional coordinates, and completes the native manual
pause/save/resume at115550. It exits0/absent in18.779s with sampled
peak180371456B. This proves native sampling and the existing save handshake;
these poses stay inside the core and do not prove a boundary crossing.

Trial014 supplies a capsule for another digest. It exits0/absent in14.595s,
refuses before selected-owner admission/region ready, and retains ordinary
paused input. Both qualified trials preserve their prepared saves, original
sources, served assets and user registry. No browser was launched.

`output/hero-native-crossing-regression-002.log` records225 passing JS tests,
zero failures/skips, including actual HUD automatic-crossing capture/hold,
explicit continuation, neighbor refusal and cancellation, stale/native clock
events, halo capsules and launcher upgrades. Crossing events in these tests
are controlled fixtures; they do not establish live native/browser crossing.

Original startup013 qualifies the checked geometry receipt on real saved
kingdoms. `output/hero-live-save-original-007.json` replays trial013's actual
held checkpoint through production JS publication and neighbor admission.
It selects the verified seed only in a fresh private fixture, preserves the
original journal, advances that separate journal0→1 at115550, verifies the
saved physical-parent refusal with zero extra writes, and retains the game
lease. Reads/writes are at most4096B; peak I/O1, final0. Content is controlled
and filesystem-backed OPFS/Web Locks are used; browser durability is unproven.

`output/hero-native-crossing-site-001/manifest.json` freezes105 isolated files,
329 resolved relative imports and idempotent staging. Served pages are unchanged
and no WASM engine is included. Browser launches remain suspended for the
unresolved host-app crashes.

### Actual native crossing capture (307)

Official build307 adds a native-only, privately gated test driver. It calls the
existing original move virtual005b4870 once, preserving the hero's pose, saved
script context, clock and hooks immediately after that call. Production does
not issue this move. Hero AI remains ungated. The source and capture paths still
use the production bindings, before/after sampling, original pause and writer.

Trials015 and016 use the113500 UNIT513/GPL29 owner. The original move is accepted
but neither trial reaches a crossing or writes a held save. Both exit0/absent;
the longer interval does not establish a cause or fix. These failures remain
preserved and are not counted as successful crossings.

`output/hero-crossing-source-original-001.json` instead traces the preserved
94550 home save to the stopped original homeward activation producer. The save
contains outdoor UNIT508/GPL25 at fractional pose7273079,557056,139839, retaining
its actual guild469/GPL7. Current production enrollment/startup checks the
original graph and terrain, independently registers that hero under controlled
content and prepares the exact saved layout capsule. It does not migrate or
rewind the original native journal.

`output/native-hero-binding-attempt-017.json` qualifies an actual crossing:

- Original tick103450→103500 moves8246540,557056,86067 to
  8258702,557056,84309 across the eastern ownership boundary.
- Production capture requests the original pause and writes slot1 at the same
  accepted clock103500,335751B, SHA-256
  f2facc1d18bc001765883df2b6f5a6cc8e8c4530fb3de01ee85fb7598664d1c0.
- The native script acknowledges and resumes at103500 without an intervening
  simulation tick. The single process exits0/absent in32.804s, sampled
  peak180502528B. Source saves, prepared profile and served/user files remain
  unchanged.

`output/hero-live-save-original-008.json` replays that exact stopped native
event and checkpoint through the production JS session and live publisher.
The original save proves the accepted fractional pose, living outdoor actor,
native/GPL identity and original guild. A fabricated position refuses before
any custody write. The separate journal advances0→1 at103500; the held reader
admits the unchanged original retired eastern4050 kingdom. Both layouts check
16641 vertices/2480 protected shared vertices. Reads/writes are bounded4096B,
peak active I/O1, final0, with the same exclusive game lease retained.

This is real native crossing capture plus a controlled filesystem-backed
OPFS/Web Lock replay. Native acknowledgement was scripted after capture; it
does not prove simultaneous browser publication, browser durability or arrival
in the destination. The accepted source pose projects to132238,557056,84309 in
the eastern map, but its destination collision/activation is still unverified.

Trial018 rechecks the ordinary manual-save path using the unchanged113500
UNIT513/GPL29 source with current build307. It exits0/absent and completes the
save handshake. Original replay009 retains the stricter guild-parent refusal
and publishes the normal saved owner, confirming that the added crossing
source variant did not replace that separate qualification.

`scripts/preserve-hero-crossing-capture.py` freezes the current source and
evidence as `output/hero-crossing-capture-generation-307/manifest.json`, checks
all54 compiled inputs and stopped producers, and preserves failed trials015
and016 alongside the actual crossing and manual regressions. No binary game
assets are copied.

Source retirement, unload, saved destination load or new region
generation, actor import/collision activation and atomic ownership publication
remain unfinished. Complete cooperative campaign/competitive matches,
independent internet tests and sustained browser resource bounds also remain
requirements of the active full goal.

The next production handoff stage now prepares the captured journey's exact
remote guild reference under the held pair lease. The controller combines
neighbor inspection and preparation, preserves foreign proxies and uses the
original saved allocation counter to avoid retired IDs.259 regression checks
and the original crossing/manual-save replays pass. Shared native registration
and four-record arrival now pass separately in an isolated paused saved target;
isolated native activation also qualifies collision, drawing, original AI and
a remote-home return crossing. The connected controller still needs the full
source retirement, world load and ownership handoff.
See [guild preparation](hero-travel-home.md) and
[original hero import](hero-native-arrival.md).
