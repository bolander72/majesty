# Community Alchemist Lab browser integration

The active content goal is Phantomstar721's actual **Custom Guild: Alchemist
Lab**, including its original animated Alchemist, three building stages, voices,
reagent economy, research and combat/sovereign alchemy. Lost Trail, Wayfinder and
Trail Lodge remain retired. Production still runs the original game.

## Source and package

- [Alchemist source](https://github.com/Phantomstar721/majesty-gold-hd-custom-guild-alchemist),
  pinned at `bb32bea97cf0a3bde4a02d9a6442a5ef11b56c29`.
- [Mod Manager source](https://github.com/Phantomstar721/majesty-gold-hd-mod-manager),
  pinned at `63a81840e0f9264067d7984ad0d2b39859fa1896`.
- [Actual Workshop package](https://steamcommunity.com/sharedfiles/filedetails/?id=3793509198),
  item `3793509198`, reported size 13,010,996 bytes and content manifest
  `5352500588909678435` on Workshop depot `73230`.

The source repository explicitly omits original media and compiled packages.
There is no GitHub release containing them. Do not replace the missing sprites,
audio or mechanics with stock content. The repository MIT notice is preserved
alongside the unchanged mod definition; the complete package's media distribution
terms still need review.

Valve's macOS SteamCMD bootstrap cannot run on this machine (Bad CPU type).
An isolated Node Steam client reached Valve anonymously and obtained item/depot
metadata, but Valve refused the manifest with **AccessDenied**. No user Steam
credentials were read or used. A Steam account entitled to download this item,
or a direct full-package handoff from its creator, is needed. Do not retry the
same anonymous request or work around the refusal.

Inspect an extracted package without installing it:

```sh
python3 scripts/inspect-alchemist-package.py /path/to/CustomGuildAlchemist \
  --receipt output/alchemist-package-inspected.json
```

This verifies the pinned declaration, referenced files, private actor/art
identities, native CAM bounds, audio presence, costs and declared combat actions.
It hashes the actual package files. Passing preflight does **not** qualify media
provenance, native runtime support, or gameplay. A different declaration needs a
source/version review before accepting it.

## Compatibility work completed

`web/content/community-runtime-registry.mjs` reads the community's MMCP v1
capability manifest and Alchemist's MMFR v1 name-generator/oil-row records. It
preserves private `NM18`/`HN69`–`HN72` identities and `ALo1`/`ALo2` descriptions.
It rejects truncation, duplicates, ordering errors, stock name collisions,
invalid encodings, unsupported schema versions and trailing bytes.

Tests use bytes produced by the pinned upstream Python encoder, rather than a
second invented implementation of the format. Separate checks refuse required
capabilities absent from the runtime and reject capability/feature disagreement.
These modules are preparatory code, currently outside the live launch path.

The existing Mod Manager DLL cannot run directly in WASM. Its supported GOG
executable is different from our pinned `MajestyHD - Old.exe`, SHA-256
`654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542`.
Read-only disassembly found a concrete layout mismatch: the original browser
guest allocates **36 bytes** for its shared AP07/AP10 controller, while the
Manager's audited GOG profile allocates **52 bytes**. Both old AP07/AP10 switch
arms reach the same allocation. Native addresses and structure offsets from the
newer DLL therefore cannot simply be copied into this engine.

Private evidence: `output/alchemist972-directdraw-controller-audit.json`.
This identifies candidate stock entry/constructor boundaries and their hashes;
it does not qualify complete vtables, callbacks, ownership or hooks.

## Next implementation and qualification

1. Obtain and inspect the full package. Preserve its authored media and original
   GPL/source/compiled bytecode as immutable inputs.
2. Audit the pinned guest's controller construction, vtables and destruction;
   name-generator registry and AP78 oil presenter; and resource/description
   loading. Adapt the real package to the legacy CAM/description format as needed.
3. Port the Manager's resolved MMCR recipes and native stock lifecycles: Brewing
   secondary panel, live reagent meter, queued research, research-gated upgrades,
   timed Vigor, one-shot Arcane Infusion, and targeted Philosopher's Stone.
   Do not replace these with custom DOM buttons or a renamed stock guild.
4. Install a separate private browser content collection using a production918
   source/runtime baseline. The unqualified SIMD947 experiment is unrelated and
   must not enter this build.
5. Prove paid construction/recruitment, private art/animations, reagents and
   research, combat mixtures, all sovereign transactions, and original saves/
   reloads in a silent isolated browser under the existing resource guard.
6. Publish versioned GitHub assets and the qualified normal-game integration only
   after these checks pass. Preserve original saves and all prior releases.

Focused checks:

```sh
node --test tests/community-runtime-registry.test.mjs
python3 -m unittest discover -s tests -p test_alchemist_package_inspection.py
```
