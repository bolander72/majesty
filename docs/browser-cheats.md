# Browser cheat codes

In a single-player quest, press **Enter**, type a code, and press **Enter**
again. Codes are case-insensitive. The game displays a confirmation in its
normal message area.

| Code | Effect |
| --- | --- |
| `infinite gold` | Replenishes your treasury to at least 9,999,999 gold after spending. |
| `level 1000` | Advances your living heroes to level 1000, including later recruits. |

Enter the same code again to disable its automatic effect. Existing gold,
levels and earned stats remain. Effects reset when leaving the quest; they
are not account settings. Save files retain ordinary game attributes, but
the automatic cheat switches must be entered again after loading.

Hero advancement runs in batches of up to 32 levels for one unit per native
frame, cycling through your units. Large kingdoms take longer. It uses the
original `advance_to_level` script invoked by `grow up`, so each level applies
normal health and stat progression, with the original skill limits. Pausing
also pauses advancement. A script/mod that refuses advancement disables the
automatic leveling rather than retrying indefinitely.

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

## Release verification

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
