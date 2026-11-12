# Root launch flow repair — November 12, 2026

Opening `https://majesty.boland.co/` must retain that URL, show the original loading
art and start the native game. Setup and deep-link pages remain maintenance tools;
normal visitors should not need them.

After PR #1 merged, the main-branch Git build published an older player than the
previous production deployment. Main ended at the More Heroes retirement release;
the published player already included the later qualified Dark Paladin and guild
usability releases from commit `0cd1ee7c710c3c303acb38d0d0fd262bb8a91bcd`.
A returning player's newer, legitimate cached resource hashes were absent from
the older updater's accepted versions. Its custom-content protection correctly
refused to overwrite them, but consequently stopped root startup and exposed the
launcher recovery link. The failure was reproduced in an isolated, previously
populated browser profile on the actual production root URL.

The repair keeps all PR #1 source changes. After the existing baseline build gates,
`published_player_release.py` requires and installs the **eight immutable files**
from the already published player. It verifies the old baseline, historical release
and qualification receipts, every payload hash, and the complete final artifact.
The resulting **149 output files match the previous production artifact exactly**.
The final player mounts the current collection at `/`; no launcher navigation is
needed. The historical source-policy hashes describe the original qualified build;
this installer replays its published files rather than rebuilding those policies.

The release pointer is mandatory. Deleting or forgetting it fails the build instead
of silently publishing the older baseline. Modified baselines, qualifications and
payloads are refused before build-output replacement. Unknown custom browser files
still receive the existing protection. The previously published updater already
accepts the older files served after PR #1, so those installations can update
normally too. No player profile or save is edited by this build step.

Validation: the complete Vercel build reproduces all 149 published files; 40 hosting
JavaScript tests and 40 focused Python tests (including PR #1 preservation/arithmetic
coverage), plus 14 subtests, pass. Fresh and cached browser launches both showed loading and reached the native
game menu at the unchanged root URL, without a setup/launcher step. The cached CAM
and Common library retained their exact bytes, hashes and modification times. No
page errors were recorded. Deployment results are recorded in the repair PR;
private captures and logs remain in `output/root-launch-flow/`.

## Centered startup and legacy entries

The older `/majesty/` page bypassed the root loading artwork. It now redirects to
`/` before initializing any engine, retaining its query and fragment (including
selected save profiles). The root canvas is centered in the viewport even while
the native initialization uses its initial dimensions.

Warm-cache startup also waits for the original loading image to decode and paint
before starting the engine. This prevents initialization from blocking its first
visible frame. At 1440×1000, the original 800×600 loading artwork was verified at
(320,200), exactly centered, followed by native menu startup at the root URL.
Browser captures show the centered loading artwork and subsequent native menu. The historical
published artifact still verifies first; only its two HTML entry pages then change.
All 147 engine, game-content, updater and support files remain byte-identical.

Nineteen focused build/presentation tests and 14 subtests pass. New executable
checks verify image-decode/paint ordering and preservation of profiles/fragments
when redirecting old links. This follow-up changes presentation and routing only.

## Rollout / Manual Operations

State: **none required** beyond the normal site deployment. Existing known release
resources update through the unchanged integrity-checked browser updater; current
pre-PR caches already match. No save migration, storage reset, secret change or
manual player action is required. Retired content stays disabled, with only the
previously approved Dark Paladin active. PR #1's candidate art/health tools remain
unchanged and are not newly installed by this repair.
