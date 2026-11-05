# Browser cheat codes

In a single-player quest, press **Enter**, type a code, and press **Enter**
again. Codes are case-insensitive. The game displays a confirmation in its
normal message area.

| Code | Effect |
| --- | --- |
| `infinite gold` | Replenishes your treasury to at least 9,999,999 gold after spending. |
| `level 1000` | Sets your living heroes to level 1000 in one update, including later recruits. |

Enter the same code again to disable its automatic effect. Existing gold,
levels and earned stats remain. Effects reset when leaving the quest; they
are not account settings. Save files retain ordinary game attributes, but
the automatic cheat switches must be entered again after loading.

Hero levels are set in one update, including later recruits. The host computes
normal health rolls and stat progression in cheap native arithmetic, then
commits the final level and stats through the original unit property setter.
It does not replay hundreds of interpreted level-up scripts, display intermediate
levels, or keep cycling through completed heroes. Normal damage deficits,
primary-stat growth, skill caps, range growth, healer rebirths and critical
chance growth are retained. An expansion Gnome's one-time level-eight class
change uses the original script before the final jump.

Only a bounded local arithmetic loop remains for randomized health gains; it
contains no guest calls, UI events or level changes. Its original PRNG state
is consumed exactly. Later recruits are observed at the original creation
boundary and receive their final attributes after initialization, at the
next settled frame boundary. Native pausing also pauses this update.
Overflow or an unsupported hero attribute schema safely disables the effect.

The original cheat codes and input stay intact. The two new codes preserve
the game's cheat-enabled setting and refuse a joined multiplayer session.
They do not apply to another player's kingdom, enemies, buildings or corpses.

## Native implementation

`patches/majesty-cheats.h` is copied into the private upstream game directory
by `scripts/setup.sh`; `patches/majesty-cheats.patch` attaches its tick to the
existing game-thread frame adapter. It does not edit generated translations,
the runtime, original assets or the pinned executable.

Addresses and ABI were verified against the generated listings for the
SHA-pinned `MajestyHD - Old.exe`:

- `00480a56..00480a6c`: original cheat-enabled input dispatch (`settings+9c`).
- `00480e00`: original `thiscall(TString*)` cheat handler, `RET 4`.
- `004e3fc0` / `004e5530`: native string assignment and encoding layout.
- `00495b83..00495ba0`: player lookup and `APP` gold adjustment.
- `00495d52..00495dfa`: hero predicate, level getter, script invocation.
- `005a10b0` / `005969a0`: original native group lookup; unit ownership at `+70`.
- The owned SDK's base/expansion `give_exp` scripts define `advance_to_level`.

All writes occur with the guest thread's baton. The input wrapper returns
through the supported hook API; feedback uses the original string setter.
Traversal is capped at 4096 nodes, validates the list before changing an
actor, and retains only a scalar ID cursor between frames. Dormant cheats
perform no unit scans. Gold deltas are clamped within signed 32-bit range.

## Initial release verification

Native engine `native-cheats598` (`4f36119bda15e259a49cb3fc8d8032e94613b808030e30af476d10a5e27eba5a`)
passed the official guarded WASM build and a muted single-player browser trial
on October 13, 2026 UTC. The native UI showed 9,999,999 gold, paid warrior
recruitment completed, and Sir Gurdain the Loyal reached level 1000 with
8,032 HP. With both effects disabled, another recruit stayed at level 11;
re-enabling advancement took him to 1000 with 7,968 HP. Dead heroes retained
their original levels and town workers had no level added. The original
`fill this bag` code still returned its native confirmation and added 10,000.
No browser page errors were recorded; the owned browser was closed afterward.
Private evidence: `output/cheats600-hero-proof.json`,
`output/cheats600-reactivate-proof.json` and native UI screenshots.
This does not qualify multiplayer cheats or every hero class.

`native/browser/` contains the authored browser adapters missing from the
pinned upstream checkout. Setup stages missing adapters before applying
incremental patches and preserves existing native edits. Reapplying the cheat
patch to the staged viewport reproduces the exact native source used by the
qualified build. Original game assets and generated translations remain
private and are excluded from this repository.

## Instant-level arithmetic checks

`native/cheats/instant_level.h` owns the pure stat calculation. Setup stages it
beside the game-specific cheat adapter. An independent scalar SDK progression
reference compares health, damage deficit, PRNG state, primary growth, caps,
range overshoot and class counters across 2,880 inputs; refusal controls check
overflow, dead heroes and invalid targets.

Prepare an existing owned native fixture with
`python3 scripts/prepare-instant-level-tests.py --game-dir /absolute/fixture`,
then run its official `kit/tools/test.py --game-dir /absolute/fixture
--native-test instant_hero_level_tests --jobs 1 --preset YOUR_NATIVE_PRESET`.
`scripts/verify-instant-level-bindings.py /absolute/MajestyHD\ -\ Old.exe`
requires `pefile`, `capstone` and `unicorn`; it checks original property
registrations/value-reference slots and emulates 1,344 original random draws.
Do not modify generated translations or apply the held-out rendering experiment.

The instant implementation is qualified by `deploy/instant-level-verification.json`.
Normal muted browser trials verified original-mission Gnomes, existing and later
Alchemist recruits, native cards, toggles and ordinary saves. Measured per-hero
commits were 1.1–1.7 ms. A fresh owned profile restored the exact Alchemist save
with all four heroes still at 1000 and their saved maximum health intact. That
reload used V8's baseline-only compiler after one normal reload reached its
2400 MiB guard; the normal gameplay trials used the standard optimizing mode.
This is not a general crash fix or qualification of every modded class.
