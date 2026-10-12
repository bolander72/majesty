# Expanding co-op persistence, candidate073

Status: implemented privately, incomplete qualification. Published player072 is unchanged.

The active goal covers a shared campaign that can be closed by both players,
reopened from its committed checkpoint, and continued with the same kingdoms,
chapter, world and region. A separate goal requirement is native gameplay from
a complete portable backup restored into a fresh collection.

The previous isolated lobby trial loaded the original regional checkpoint on
both clients and produced equal gameplay checksums at frames199 and399. It
then reached the original Chapter1 victory. This demonstrates original save
loading, not qualification of candidate073 or the full restart lifecycle.
Evidence: `output/coop-resume073-original-lobby-observed.json` and
`output/coop-resume073-original-after-release.json`.

## Implemented privately

- **Save and pause** asks the native host to use the existing original shared
  pause and checkpoint serializer. The UI confirms a save only after its
  receipt matches the observed epoch, frame and clock. Guests cannot request
  the host action. A failed resume proof disables these controls.
- The host closes the engine before **Prepare resume file** acquires its local
  named-profile lease. The unnamed shared profile root is refused rather than
  traversing other players’ profiles. An interrupted complete-player restore
  also blocks preparation. It scans a bounded hierarchy, parses the native marker, and
  hashes the committed full-world snapshot in64KiB chunks. The two checkpoint
  slots and marker remain unchanged.
- A separate `WorldResume_*` lobby file is byte-identical to that snapshot.
  The original multiplayer transfer can create this alias on a new guest
  profile without overwriting a `CoopTransitions_*` slot. Existing aliases
  must match; partial/conflicting files are preserved and refused. At most
  eight aliases are created per save folder.
- Resume invitations include the world, region, chapter, revision, native
  frame/clock, full snapshot hash/size and content/rules identities. Personal
  profiles remain local. The non-gameplay hint does not change the existing
  network rules digest. Ambiguous or mismatched hints fail before engine setup.
  The private v2 hint carries both the original launch coordinate and the saved
  coordinate. Travel must not rewrite `RECOMP_RULE_COOP_REGION` on reopening:
  that field belongs to the original network fingerprint, even when the saved
  kingdoms occupy a different region. Native admission validates the original
  settings before selecting the checkpoint's coordinate.
- The new native adapter observes the pinned original lobby reader. It grants
  current-world capture ownership only after validating the expected alias,
  both input hashes, original reader success/output, attached context, native
  clock, selected profile, current room epoch/roster and local kingdom binding.
  A failed proof also excludes otherwise-unvisited guest profiles. Host local
  metadata must match; guests cannot roll newer committed progress backward.
- Before calling the original startup function, the private native gate checks
  the selected lobby label, joined SDK roster and checkpoint path, bytes,
  saved clock and original rule identity. With fewer than two joined players it
  reports a waiting state and returns to the original caller without loading.
  Refusal emulates the pinned no-argument `RET`, preserving guest stack and
  registers. The original reader and attached-world proof still run afterward
  for an accepted start. Resume also requires a named local profile before
  browser engine setup. The full native adapter remains uncompiled/unqualified.
- The host still uses original Load Game, and both players use original
  Ready/Start. The shared save waits for the partner; offline continuation and
  AI takeover are not implemented.

## Verification and remaining work

102 focused JavaScript checks passed, covering checkpoint parsing, corruption,
leases, immutable copies, changed-checkpoint refusal, invitations, travel,
profile startup, campaign navigation and portable backups. Seven staged
profile-startup checks pass with the existing interrupted-backup guard before
hashing/GPU/injection. Logs: `output/coop-resume073-anchor-focused.log` and
`output/coop-resume073-start-guard-staged-tests.log`. The latest focused log is
`output/coop-resume073-start-guard-tests.log`.
Native checkpoint-policy tests were added to the official focused test target.
The separate official `native_coop_lobby_resume_tests` target passed17 compiled
checks with zero failures. It verifies token and SDK roster/selected-file
policy, including missing partners and malformed requests. It does not execute
the original loader, guest-return shim or full-world admission. Fingerprinted
evidence: `output/coop-resume073-native-start-policy-qualified.json`.

A storage-only browser fixture exported and restored 17 real native save files
(1,985,248 bytes), both test players' actual Chapter1 progress records and
explicitly synthetic Atlas metadata into an empty isolated OPFS/IndexedDB
collection. Every primary file hash and metadata row matched; the source
profiles were preserved and cached archives cleared. A follow-up verified a
separate resume copy for saved region3_-1 using initial region2_-1, with the
same original rule fields and all primary files unchanged. No game engine or
WASM launched. Evidence: `output/player-backup-native073-storage-qualified.json`
and `output/player-backup-native073-anchor-storage-qualified.json`. These
checks qualify storage and preparation; native gameplay remains unverified.

The retained restored collection, including its two immutable resume aliases,
was subsequently exported through the same browser backup module to a one-use
loopback receiver. The receiver exited after validating the archive hash.
`scripts/restore-native-backup073.mjs` inspected the complete portable archive
and materialized a fresh owned native test collection: all19 file hashes match,
all3 metadata databases are preserved, and all4 regional markers reference
their selected snapshot hashes. Evidence:
`output/player-backup-native073-restored-native-collection.json`. No native
game process has loaded this collection yet. The archived native449 executable
is identified for provenance only; it cannot qualify the new resume adapter.

An isolated local CMake contributor preset uses the installed command-line
SDK and existing Ninja binary. It avoids the obsolete SDK path and Git describe
of cloud-evicted submodule metadata. The first configure was interrupted while
existing CMake includes remained cloud-evicted. A retry reached an unnecessary
FFmpeg dependency that stalled in Git. Its confirmed build tree was stopped.
The focused native-policy preset now disables video, and official configure
succeeded. The full checkpoint-policy build compiled37 objects, then exited
without a test verdict: macOS canceled a read of the existing cloud-evicted
`kit/host/fixture_view.h`. The header has since downloaded and its size/hash
are recorded in `output/coop-resume073-cloud-header-hydrated.json`. The official
checkpoint suite subsequently passed1767 checks with0 failures; its original
CTest output and source/binary hashes are preserved in
`output/coop-resume073-native-checkpoint-qualified.json`. It exercised real
temporary-file publication and recovery, not original-engine gameplay.

The full native build is now running through `tools/build.py --target smoke`
with the separate `resume073-native-game` preset. It enables normal video
support. A local make bridge caps the official FFmpeg dependency’s fixed
`-j8` command at one job; compiler jobs are also limited to one. Both configure
and build inherit `DEVELOPER_DIR=/Library/Developer/CommandLineTools`. The
separate gen build was stopped after hydration; its completed objects remain
retained. The release dependency’s version lookup is bounded by
`GIT_CEILING_DIRECTORIES` at this game’s build directory, so it uses FFmpeg’s
pinned7.1.1 version instead of probing unrelated cloud-backed parent Git
metadata. Both changed adapters have compiled; their source/object hashes are
preserved in `output/coop-resume073-native-adapters-compiled.json`. The full
engine link remains pending. No new engine has been launched or published.

Before publication, finish the official native tests and WASM build, then
qualify a fresh live save → close both engines → prepare resume → reopen →
join/Ready/Start → save again → travel fresh/saved sequence. Verify distinct
kingdom ownership and matching gameplay checksums, and confirm refusal for a
missing partner or changed checkpoint. Independently qualify full portable
backup restore and native gameplay in a fresh save collection.

The latest supplied AGENTS.md reinstates the live WASM suspension while the
host-app crash remains unresolved. No WASM game launches or running-game
inspection are authorized under those current instructions. This limitation
does not prevent terminal tests or source work; the goal remains active.

The continuing official build has passed the Vulkan backend and is waiting on
the existing cloud-backed Metal host source. Its actual process/session remain
live; no replacement build is started on an observation timeout. The native
build-report producer now includes `coop_lobby_resume.h` in its checked input
hashes and accepts `--preset resume073-native-game`, so the new decoder cannot
be omitted from source qualification. The restored-profile trial still needs
the original lobby Load Game path; a synthetic peer has no continuing world
and cannot qualify live paired synchronization.

### Native full build and complete-backup trial (073)

The official normal-video, one-job native build completed all 612 scheduled
edges with exit 0. A second official up-to-date build bound the current source
closure and executable in `output/native-world-residency-build-473.json`;
`output/coop-resume073-native-full-build-qualified.json` records the boundary.
The new guards are compiled and linked. No new WASM engine was produced or
published, and this is not original-loader or paired-resume qualification.

`run-native-restored-backup073.py` copies every hash-qualified restored native
file for the selected owned profile, including its registry and real saves,
into an exclusive writable trial directory. It does not invent the missing
`questdata_majx.sav` or use the old three-settings-only fixture. The first
20-second UI trial stalled before its menu/frame, was stopped by its owned
40-second deadline, peaked below 70 MB, and preserved all source-backup hashes
(`output/native-restored-backup073-001/run.json`). Gameplay remains unverified;
a bounded startup investigation follows before any original saved-load claim.

The second bounded native startup trial identified `kit/tools/recomp/baseline/classic-modes.json` (13,597 bytes) as an opened cloud-evicted file. Download was requested; FileProvider reports downloading, but a 15-second coordinated read still timed out. The owned native game stopped at its deadline with all source backup hashes intact. Further game launch waits for actual readability. See `output/coop-resume073-native-backup-startup-wait.json`.

### Restored native profile reaches the original save-selection path

A complete hash-qualified restored host profile now reaches the original menu
and an owned loopback SDK room under the linked 473 engine. The settings page
has a legacy working-directory probe path: `RECOMP_RESOURCES_DIR` alone does
not redirect it. The isolated runner stages the unchanged existing packaged
display table at both resource paths and uses the owned resource directory as
its working directory. It does not replace the cloud-managed source file.

The single-player picker correctly lists no multiplayer GMP files. The
original multiplayer picker lists the actual 2_-1 and 3_-1 checkpoints and
both prepared resume aliases. Selecting the home alias restores participant
names Your Majesty and guest071 in the original lobby. The observed live
world pointer is still zero with no second player. This proves native profile
boot, GMP discovery and save-selection metadata only; original full reading,
continued gameplay, the new hinted pre-start guard and actual paired resume
are not qualified. See `output/player-backup-native073-menu-qualified.json`
and `output/player-backup-native073-save-selection-qualified.json`.

Each trial owns its native executable directory, writable profile and relay.
The loopback helper uses the existing production Relay with missing-Origin
native clients allowed, no browser Origin accepted, and no invented peer.
The final selected-save trial exited 0, peaked at 144,195,584 bytes, stopped
its owned relay, and preserved every source-backup hash. All existing player
releases remain unchanged; in-app WASM testing remains suspended.

### Absent-partner native observation and private browser build

The actual original native Start click with only the host present leaves the
restored GMP selection in its lobby and the world pointer at zero. The trial
exited 0, peaked at 133,169,152 bytes and preserved all source backup hashes.
This checks the original lobby only: the new hinted COOP_RESUME preflight did
not run, no original full reader was observed, and gameplay remains unverified.
Evidence: `output/player-backup-native073-absent-partner-qualified.json`.

The official tool's app target accepts the private web preset and builds the
same recomp_app target. `build-private-resume073-wasm.py` uses an owned Majesty
game view with current-source symlinks and the existing official translation,
so its configure outputs and web artifacts cannot overwrite current native or
web builds. It keeps one build job, conservative heap growth, an aggregate
1.5 GiB RSS ceiling, a 4 MiB log ceiling and a 20-minute deadline. It neither
stages a website nor launches WASM. The first configure stalled on a 331-byte
cloud-evicted SDK Python bytecode file and its confirmed owned group was stopped.
The second uses the bundled Python with a private bytecode cache; compiler
setup now waits on its cloud-evicted 1,005-byte encodings/utf_8.py source. The
exact source download is requested. Wrapper PID15828/session87682 is confirmed
live at roughly 56 MiB aggregate RSS; no compilation/linking claim is made.
Receipts: `output/private-resume073-wasm-001/build.json` and
`output/private-resume073-wasm-002/build.json`.

The second private browser build terminated at its 20-minute deadline before any game compilation or artifacts, with tracked source hashes unchanged and no owned build processes remaining. SDK cloud reads have blocked three consecutive goal turns; version/installer pin metadata remain unreadable despite bounded read/download requests. The completion audit remains negative for actual cold paired resume and native backup gameplay. Browser-game launch suspension in the latest supplied AGENTS.md remains binding. See `output/coop-resume073-blocked-audit.json`; existing releases and original player profiles are preserved.

### Renewed browser authorization and successful cold resume (2026-10-09)

The user explicitly lifted the launch suspension and root AGENTS.md now permits
bounded owned browser trials. The exact pinned Emscripten archive was recovered
outside cloud storage; the private official one-job WASM build completed with
unchanged source inputs. The descendant process guard observed a peak of
1,010,647,040 bytes. SDK/build receipts are output/sdk073-recovery.json and
output/private-resume073-wasm-004/build.json. Existing public releases are retained.

An actual fresh two-browser expanding expedition committed a native checkpoint
at clock3100, released both engines, prepared the host resume alias through the
public UI, and reopened the original lobby. The host remained in the lobby while
the guest was absent. Both original readers admitted the same checkpoint and
reported two restored kingdoms. Continued play committed revision2 at clock6300.
All owned tabs were closed. Evidence: output/coop-resume073-browser-cold-cycle-qualified.json.
This qualifies the local cold browser cycle; independent internet play, sustained
resource bounds and native backup gameplay remain unverified.

An earlier restored checkpoint at clock34550 immediately reached the Chapter1
condition. Its original remote-winner notice requires acknowledgment before
the shared result callback returns, as previously documented. Requesting Save
and pause while that notice was open did not establish a gameplay defect.

### Restored portable backup: real native/browser gameplay

The source-qualified native473 engine loaded the complete restored host profile
in an exclusive working copy and paired with a real private073 browser guest on
an owned loopback relay. Both original readers admitted region2_-1 at clock34550
and reported two kingdoms. Native captures show a warrior moving toward the
palace between live frames. The native world pointer was nonzero after loading.
This qualifies original full reading and continued native gameplay, not native
full-match completion or sustained native/browser synchronization. The native
trial exited0 normally, peaked at146,178,048 bytes and preserved every original
backup hash. The owned relay and browser were stopped. See
output/player-backup-native073-gameplay-qualified.json. Atlas backup metadata
remains synthetic; the campaign/native save bytes are original.

Reproduce the bounded pair with run-native-restored-backup073.py --paired-context:
the owned JSON explicitly carries the qualified native/WASM identities, original
resume token, unchanged content/rules and loopback relay address. The actual
browser partner must use the matching public invitation. The helper does not
create a reference player or claim generic cross-platform compatibility.

### Local qualified release073 published

The actual published-path pair restored revision2 at clock6300 with both
original readers and two kingdoms, then continued to revision3 at clock18000.
All owned test engines/tabs were released. 69 focused frontend/profile/backup
checks pass against the packaged release. The publisher verified135 package
files and retained legacy engine/metadata inodes and every older release.
Reversible entry redirects now select /releases/wasm073/. Evidence:
output/coop-resume073-published-pair-qualified.json and
output/browser-coop073-publication/publication.json. This completes this local
stopped-session resume/native-backup milestone. Independent internet testing,
long-session resource qualification and broader content work remain separate.
