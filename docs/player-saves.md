# Portable player saves and offline cooperative campaigns

Product direction recorded on 2026-10-02: playing, hosting and keeping progress
must work without a required game account. A player should be able to keep a
portable profile on their machine and optionally back it up to Google Drive
or another storage provider. Cloud storage is a destination for the same save,
not a prerequisite for simulation or multiplayer room membership.

Reaffirmed on 2026-10-03: a required game login must not be introduced for
campaign ownership or backup. The local profile is the player's durable
identity; a relay connection is temporary. Keeping the shared campaign at its
last agreed checkpoint while a member is absent remains the default proposal.
Offline solo continuation should create a separate branch. Optional delegated
control of an absent kingdom is a later, explicitly selected campaign policy.
The user reaffirmed keeping this work under the active goal. Optional cloud
backup must remain compatible with local play; shared continuation needs a
durable common checkpoint rather than dependence on a player's temporary room
connection. The pause/solo-branch policy above remains a proposal to implement
and test, not an available continuation feature.

## Current implementation

The Frontier map now offers a portable **independent saved kingdom** file.
Export reads one named world's committed native checkpoint in bounded pieces;
restore claims a fresh named world and refuses every existing world directory.
It preserves exact GMP bytes and content identity, then presents an explicit
resume link. Tests and a stopped original-file filesystem roundtrip pass;
browser OPFS/picker/gameplay execution was unverified during the historical crash
suspension, which the user lifted on 2026-10-08. This separate kingdom format excludes chapter/atlas progress, other kingdoms, co-op
continuation and connected actor ledgers. It is a first local save-file feature,
not a complete account. See [kingdom backups](native-region-backups.md).

The new Player backups page, published in `/releases/player072/`, exports the
complete local save collection: native files from every profile, all supported
campaign-completion databases and Frontier Atlas region/camera databases.
It needs no game account and excludes imported game/mod assets. The same ZIP can
be saved to a machine or manually copied to cloud storage. Provider integration
is not implemented.

The worker hashes files in 64 KiB chunks and streams the archive to a single
temporary browser copy. That completed archive remains valid after native
source saves change. A second export is refused until the player clears the
temporary copy after the first download finishes. Atlas export and restore read
one database at a time; restore inspection keeps only summaries. Limits are
3 GiB of save data, 12,000 native files, 256 databases and 16 MiB of metadata per
database. Exceeding a limit fails rather than silently dropping progress.

Import checks the entire archive's paths, counts, sizes, SHA-256 hashes and
database schemas before writing. It restores only into an empty native save
collection with no colliding progress databases. Existing data is not merged or
overwritten. The original game assets can already be imported in that browser.
Write failures roll back the newly created collection and owned databases.
A durable restore marker blocks new player startup after interruption; the
backup page can discard the incomplete restore. Database rollback preserves an
unowned database that appears after the initial conflict check. A crash between
creation of an empty database and publication of its ownership marker can leave
that empty database for manual recovery; storage publication is not one atomic
transaction across OPFS and IndexedDB.

Actual isolated browser OPFS/IndexedDB roundtrips preserve two synthetic native
files, named completion and Atlas camera/buildings. The trial also passes
conflict refusal, busy-profile refusal, database-failure rollback, a concurrent
database collision, interrupted-restore recovery, source-independent downloads
and the shipped controller/worker preview. Fixture storage is removed after
verification. The 78-test focused suite passes. Evidence:
`output/player-backup072-browser-qualified.json` and
`output/player-backup072-publication/published-entry-qualified.json`.
This qualifies storage copying; it has not yet loaded a native match from a new
complete player backup or established expanding-world stopped-session restart.
Players must close game, campaign and Atlas tabs for backup/restore. Older
unmodified releases cannot observe the new restore recovery marker.

The legacy launcher still offers Export saves and Import saves for the game's
profile files, including named profiles beneath that directory. Chapter
completion is currently in a separate IndexedDB database, and the experimental
atlas has its own region and camera database. Those databases are not included
in the legacy native-only ZIP. Import of that older format still writes into existing profile
paths; it is not a conflict-aware campaign restore.

Chapter completion now follows the launcher's named native profile. The campaign
page offers a local profile selector and passes that name to every chapter link,
including links with a relay address. The in-game campaign panel uses the same
profile for victory completion and its return link. Empty selection keeps the
original database and its existing completion records as the default profile;
named profiles use separate databases and do not inherit legacy completion.
No account or authentication is involved. These names are native save paths,
not yet the stable portable player/world identifiers described below.

All 64 JavaScript tests pass, including seven new progress/adapter cases.
An isolated-origin browser fixture injected the original victory announcement
into the shipped adapter, then exercised the actual campaign page and IndexedDB.
Named completion survived a closed/reopened tab; resetting one profile preserved
another profile's completion and the default's legacy records. Profile selection
preserved relay settings, and invalid names/duplicate profile parameters prevented
ambiguous launches. This qualifies local progress isolation, not a new engine match,
portable import/export or offline co-op continuation. Evidence:
`output/campaign-profile-qualified-observed.json`.

Unnamed atlas experiments retain their default database. Named worlds isolate
their atlas storage and native coordinate profiles beneath a world directory;
the new restore creates a fresh directory rather than taking over one with the
same coordinates. A complete account still needs stable portable identifiers
and conflict-aware progress/collection restoration beyond these local names.

Two local clients have restored retained native multiplayer saves with matching
checksums; the eleven-day Chapter 3 continuation now reaches shared victory.
That victory used clients that already had their native save files. A separate
fresh-guest trial now receives that checkpoint through the original transfer
and enters synchronized gameplay. Reconnect and host migration remain unqualified.
The relay assigns temporary session player IDs; those are not durable player
identities. Original multiplayer currently ends the room when a player leaves.
Closing the guest after durable restart produced the host's explicit
session-ended recovery overlay
(`output/coop-transferred-save-disconnect-observed.json`).
Do not promise that an absent player's kingdom can already continue offline.

A fresh guest missing the host's eleven-day save exercised the original
automatic file transfer. It failed with bounded-queue overflow and pinned
receiver metadata/packet-ownership defects. The repaired build removed overflow
and duplicate frees, but its original write-only OPEN_EXISTING mode still
could not create a guest's missing destination. The pinned receiver now permits
creation. The fresh `coop-transfer-empty-20261003d` guest accepted 1364 DATA
packets with advertised file CRC b859fb6d, passed original END validation and
loaded the selected save with reader result 0. Early original simulation
checksums match the host through frame 999. Both clients reached shared defeat.
After closing both browser processes and recreating the room, the guest loads
its retained received save without another transfer and again matches the host.
This is one successful local transfer and durable restart, not qualification of
all continuation paths. Evidence: `output/coop-empty-guest-transfer-observed.json`,
`output/coop-transferred-save-reload-observed.json`,
`output/coop-empty-guest-failed-observed.json` and
`output/coop-transfer-instruction-audit.json`.

The missing-file transfer repair has now also been checked against an existing
longer guest file. Its initial OPEN_ALWAYS mode left trailing data and caused
a checksum warning. The current receiver uses the original create-and-truncate
method; an isolated 2 MiB destination was replaced successfully, and six
simulation checksum pairs matched. Fresh browser processes then loaded the
received save without retransmission and matched three more checksum pairs.
This does not yet make incoming transfer
transactional: interrupted replacement and strict checksum-failure rejection
need separate work before shared save import can promise to retain the prior
complete checkpoint. Evidence: output/coop-stale-transfer-observed.json and
output/coop-stale-tail-failed-observed.json and
output/coop-stale-transfer-reload-observed.json.

Regional native checkpoints now have a two-file replacement transaction:
write and verify the inactive GMP, then publish a bounded manifest selecting
it. Failed publication retains the last committed world, and file hashes use
fixed scratch storage. This is implemented region-save recovery; a complete
portable account bundle and shared co-op checkpoint acknowledgments still
need their own implementation and qualification.

## Proposed player profile

Create a local profile automatically with a stable random identifier and a
player-selected display name. Export should include that profile's preferences,
chapter progress, native saves and campaign/region metadata, plus the required
content hashes. Import should preview the contained campaigns and restore into
a new profile by default, preserving existing progress. Players still import
their own game assets separately; a save bundle should not contain those assets.

Keep a versioned manifest with per-file sizes and hashes. Validate it and its
content requirements before activating a restore, and stage an import before
switching the active profile. Keep the previous complete checkpoint if an
import, storage write or cloud upload fails. Backups must work from the launcher
with the game stopped, rather than copying files midway through a native write.
Atlas regions should be exported incrementally from durable storage: a large
visited world must not be loaded into the active simulation just to back it up.

The implementation should support a downloaded backup first. Players can place
that file in any synced folder themselves. A direct Google Drive integration
would request Google authorization only when chosen; it would not create a
required Majesty login. Google's [Drive authorization documentation](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
describes per-file `drive.file` access. Provider tokens should stay outside the
portable gameplay save. A cloud file is a backup, not the authority deciding
which cooperative branch is current.

## Proposed cooperative continuation policy

The default shared campaign advances when its required players are present.
When someone is absent, anyone with the last shared save may start a separate
solo branch. Keep the shared checkpoint available for the group to resume;
label the solo branch clearly and never overwrite the shared continuation.
Branching is a proposed feature, not an existing menu option.

An optional “Continue while I’m away” campaign setting could later permit a
designated host to simulate the absent kingdom with AI or jointly agreed
control. Agree on that policy while forming the campaign. A returning player
would load the latest complete shared world, including changes to their kingdom,
rather than replaying a separate personal world into it. This requires engine
support and tested late joining or a coordinated restart; current lockstep
transport alone does not provide it. Nothing should keep simulating when all
players are offline unless the group explicitly chooses a persistent server.

Each shared checkpoint needs a campaign ID, branch ID, parent checkpoint hash,
ordered member/kingdom assignments, content identity, chapter and gameplay rule
settings, and simulation position. The current native regional content identity
tracks the executable and imported assets separately from session rule settings;
it is insufficient by itself to describe a shared campaign continuation.
All players must agree on that checkpoint before resuming. Two independently
advanced copies create two branches, not a silently merged world. Gold,
buildings, deaths, quest timers and region changes cannot safely be combined
by choosing the newest timestamp. The recovery UI should let the group select
a continuation while retaining both originals.

## Qualification before enabling shared continuation

1. Export one complete profile and restore it into a fresh isolated profile,
   including completion records and dormant regional checkpoints.
2. Start a saved co-op match with a guest that lacks the native file; transfer
   and validate a common checkpoint, then compare original checksums.
3. Disconnect either player during play and during save. Preserve the last
   acknowledged shared checkpoint and explain the resulting room state.
4. Restore a solo branch without changing the shared campaign; returning both
   players can still resume their original world.
5. Only then qualify optional absent-player control, rejoining and coordinated
   regional handoff on independent internet connections.
