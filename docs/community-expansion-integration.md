# Community expansion integration

Adventurers Guild, The Royal Menagerie and More Heroes have been acquired and
verified in private staging. Their shared source composes with the installed
Alchemist Lab, Bards Hall and Phantoms Haunt. The original SDK compiles the
adapted common/base/expansion libraries with all 1,476 expected definitions.
This is source/compiler qualification, not playable native/browser integration.
Production and player saves have not changed.

## Original inputs

| Mod | Original package | Binding |
| --- | --- | --- |
| Adventurers Guild | Creator's 1.0.0 release ZIP | Git `4684853b1c3c37a5aa5c8a8db34cc26fd50c389c`; SHA-256 `8f5b847c0ec7f3795f7f6528a1b8b22e76b23f83291728bdd276ff255356649e` |
| Royal Menagerie | Steam Workshop 3796459696 | Manifest 2691728586177823327; 14 files; 86,062,467 bytes |
| More Heroes | Steam Workshop 2106634312 | Manifest 6687461410276579576; 13 files; 842,997 bytes |

Per-file hashes, original manifest identities and required media records are in
`content/community-expansions/*/source-contract.json`. No original art, audio,
binary, creator GPL source, player save or run log is committed. Download
availability does not establish a blanket redistribution license.

## Implemented source compatibility

`inspect-community-expansion-package.py` checks every acquired file, rejects
linked/escaping or changed inputs, checks CAM/bytecode bounds and XML entities,
and retains explicit unplayable/unpublished status. Standard More Heroes
remains a Standard mod; it does not receive an invented Merge declaration.

`prepare-community-expansion-gpl.py` uses the clean, pinned creator Manager
release source read-only. It preserves the existing guild parent/child dialog
IDs, reserves separate output IDs for the new panels, and invokes the original
Standard source/bytecode reproduction proof through a platform compiler
launcher. The launcher uses the unchanged original SDK compiler in an isolated
Wine prefix; it does not replace or skip that proof. Manager files are not
changed.

Two explicit additive source resolutions preserve both sets of content:

- Random recruitment includes all 13 More Heroes classes plus the existing
  Alchemist and Phantom. The prior Haunt/Paladin restriction remains. The
  expanded pool exists only in the Northern Expansion view.
- Guild lookup adds each new class's original guild while preserving all stock
  and previously installed community guild mappings and the original fallback.

More Heroes adds seven spellcasting titles to the shapeshifting potion's
Medusa branch but omits matching expiry cleanup. Its private adaptation adds
the same title predicate to the stock cleanup. All original application
instructions and ranged-first precedence remain. Both the original package
and corrected private source reproduce their respective bytecode with the
original compiler. Actual potion round-trip gameplay remains unqualified.

`stage-community-expansion-legacy-gpl.py` carries the current qualified fixes
into the new creator result using structural three-way merging. It updates
both original exports and their first-wins VM aliases, moves edition-specific
definitions out of the common library, and refuses unresolved edits or
overlapping routes. Its route tables contain 157 base and 158 expansion entries,
within the existing 256-entry bound. All six protected Phantom health/spell
functions remain byte-for-byte identical, and Fire Balm retains its existing
campaign guard alongside the new potion quest credit.

The Standard package remains a separate input to creator composition, which
emits only its merged exports. The legacy stage now materializes all 115
remaining scoped definitions and adds 23 missing stock-function routes.
Seven composed definitions retain their merged behavior. All 204 expansion
definitions compile, while common and base bytecode remain exactly unchanged.

The common compiler output is 37,265,667 bytes. The compiler wrapper therefore
permits up to 64 MiB for compiler outputs while keeping source-input limits at
16 MiB. Full container and definition-set checks still apply. Compilation peaked
at 122.8 MiB RSS and completed in 33.24 seconds with the private quest hooks.

All 13 More Heroes decision trees now participate in Adventurers Guild quests.
Ten retain the creator's exact stock anchor boundaries. Fallen Angel and
Timewalker use their existing Bazaar continuations; Mystic resumes after its
combat check and considers work after entertainment. Structural comparison
unwraps the two new guards and reproduces each complete original tree, including
else ownership and decision priority. Shared reset/death hooks are not duplicated.
Native quest gameplay remains to be tested.

The native resource stage encodes 50 units and 26 actions with no unsupported
fields. It imports Standard descriptions only into the Northern Expansion,
assigns 33 collision-checked actor identities, and converts all 31 help cards.
All 162 prior community descriptions remain unchanged. A native-scale contact
sheet verifies the four new Palace emblems beside a stock emblem: 25 by 25,
opaque, and framed with the original native rim.

The 26-file private patch set appends six world images and ten interface images
to the deployed archives. Every prior image, tile and palette payload remains
unchanged except CUR1's checked extension: all existing cursor animation sets
retain their complete resolved bytes. Phantom's native spell glyphs, current
voice corrections and campaign art remain in place. The new guild's original
audio is appended without transcoding. `native-resource-verification.json`
binds these inputs and outputs; it does not claim controller/gameplay acceptance.

## Verification and continuation

The four map/movement intrinsics now have an original 1.5.1.2 native adapter.
`world-query-verification.json` binds the isolated official native tests and a
controlled native game run: actual map masks and unit/type movement rates
matched the original objects, a bounded frontier search found an unexplored
cell, and invalid inputs preserved output values. That owned game exited
normally after 43 seconds at 160.9 MiB peak RSS. The live module predates final
formatting; the formatted source separately passes the official native tests.
This is a component control with legacy bootstrap registries, not qualification
of the new guild actors, panels, saves, browser runtime or co-op.

`source-integration-verification.json` binds the source stages, original
compiler and outputs, exact package inspections, source policies and the
remaining acceptance work. 34 focused tests pass: 21 expansion boundary/source
tests, three media tests, three Phantom resilience tests and seven existing
namespace tests. The three native building-emblem tests also pass.

The new source/resources must not be put into the public collection yet.
Required next work is the original 1.5.1.2 native controller and intrinsic port,
resource/actor import, More Heroes quest participation, and ordinary gameplay
acceptance. Verify native UI at stock scale, paid construction/recruitment,
quest rewards, monster capture/taming/rental, death/teardown, potion expiry,
save/fresh reload, existing saves and bounded paired co-op. Only then prepare
the publication/media review and a source-bound deployment gate.

Private stages use separate directories and preserve all originals. Never
resume retired Lost Trail/Wayfinder content or substitute stock reskins for
the acquired mechanics and artwork.
