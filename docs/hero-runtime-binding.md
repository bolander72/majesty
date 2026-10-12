# Binding a prepared hero to the original engine

Selected-owner preparation now returns a bounded `runtimeBinding` alongside
its native checkpoint receipt. It uses the journal's **current** hero and home
aliases, the immutable hero/guild descriptions and kingdom number, the exact
selected GMP digest, and its saved clock. The origin's historical hero ID does
not select a returned or remapped actor. The wire form is canonical ASCII,
at most 256 characters, with no guest pointers or checkpoint buffers.

Player staging captures this input after verified content hashing and owner
preparation, before GPU/WASM injection. Its `preRun` sets
`RECOMP_FRONTIER_HERO_BINDING` from that receipt. URL overrides are rejected by
named-world configuration and excluded from environment copying. Ordinary
startup removes any unrelated binding. Existing staged players upgrade
idempotently; the served game has not been replaced.

The game-specific implementation uses the shared native/WASM source path.
Before the original reader runs, it requires the prepared selected
checkpoint digest and saved clock. After complete gameplay attachment, it
restores the saved GPL/game random seeds and finishes the existing scoped UI
restoration. It looks up the current hero and guild using the original native
and GPL registries, checks class/player/liveness, actual script associations,
reciprocal native membership, saved residence when applicable, the hero's
script `home`, and membership in the actual guild's script roster. It accepts
the binding before announcing region ready or permitting the first original
gameplay update. The lookups retain no actor/world pointer after the call and
install no persistent observer or AI/command hook.

A mismatch refuses admission. The game requests its normal paused dispatcher
state so original paused input, menus and Exit Game can run without advancing
the kingdom clock. Frontier disables save/travel actions and explains how to
return and prepare the journey again. Delayed ready/checkpoint messages cannot
re-enable those actions. Storage locking remains held by the injected game;
refusal is not proof of worker shutdown.

This is the production startup binding needed by the live hero handoff. It
does not implement source retirement, neighbor import, ownership publication,
cross-region activation or cooperative travel. Native home bindings support
living registered guilds and their verified selected heroes; pure remote home
proxies currently refuse before loading. Those require a production `go_home`
interception before original building use can resume safely. The JS capsule
can represent a proxy, but representation is not runtime support. Ordinary
kingdoms without the selected-hero flag retain their existing startup path.

The subsequent [live hero save path](hero-live-save.md) pauses and checkpoints
this bound kingdom, publishes progress under its existing world lease, and
waits for actual resumption. Cross-region hero handoff is still unfinished.

## Verification

`output/hero-runtime-binding-regression-001.log` records 309 passing tests,
including the actual staged player environment, selected save preparation,
canonical binding inputs, override rejection, UI refusal, custody storage and
the existing region disposal/attachment controls. These use controlled DOM,
OPFS and Web Locks, not a launched browser.

`output/hero-route-startup-original-007.json` binds production preparation to
the actual original selected home save and continued save. Its first capsule
selects hero513/agent29, guild469/agent7 at113500; subsequent publication and
startup select those same current aliases at114000 with the continued GMP
digest. Original inputs and the original custody journal remain unchanged.

`scripts/run-native-hero-binding.py` checks current official compiled inputs
and that preparation report, copies the selected kingdom into a new private
profile, then runs one bounded original engine. It preserves the prepared
fixture, source bytes, served browser files and primary registry. Native
content identity is separately controlled; this does not verify installed
browser assets. The supervisor permits one native game, 25 seconds, 512MiB
sampled RSS and 4MiB of log output. It checks the actual process is terminal
and absent, rather than interpreting a polling timeout as shutdown.

Native attempt002 with official build300 reaches the exact production binding
and region ready, exits0 in14.807s with sampled peak173,588,480 bytes, and
preserves its sources and prepared fixture. Attempt001's wait-only smoke
script had zero executable steps and ended early; its failed result is
preserved. Attempt003 deliberately supplies a missing hero alias. It verifies
the refusal boundary but reaches the deadline because the initial refusal
implementation skipped normal paused input. The code now requests the
original paused state. Native attempt004 with official build302 verifies
the same controlled wrong-hero refusal and exits0 normally in14.828s, with
sampled peak175,341,568 bytes and preserved source/prepared profile data.
Native attempt005 with that corrected build also admits the exact114000
hero/guild binding and reaches region ready, exiting0 in14.783s with sampled
peak172,130,304 bytes. Admission and refusal use the production feature flags;
no private halo actor, import, activation or AI fixture is enabled.

The final build303 also waits for a successfully checked source before
restoring saved RNG state, so an unavailable checkpoint cannot seed a fresh
world from uninitialized values. Current native attempt006 verifies refusal
and normal exit in14.822s (sampled peak169,361,408 bytes); attempt007 verifies
the exact selected hero/guild admission and normal exit in14.793s (sampled
peak174,112,768 bytes). Both preserve the copied GMP, original inputs and
prepared fixture. These current inputs and evidence are frozen in
`output/hero-runtime-binding-generation-303/manifest.json`.

`output/hero-runtime-binding-site-001/manifest.json` freezes an isolated
102-file launcher overlay, verifies305 relative imports and player staging
idempotence, and confirms the served launcher/player pages are unchanged.
It contains no standalone WASM engine. Browser launches remain suspended
under the host-app crash constraint. Full cooperative matches, independent
internet testing and seamless bounded world streaming remain requirements
of the active goal.
