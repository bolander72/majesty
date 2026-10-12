# Local multiplayer save ownership

Co-op and competitive browser startup now acquire an exclusive, nonblocking
Web Lock for the selected local profile before file hashing, profile setup,
GPU creation or native script injection. Separate profiles can run as separate
participants. Peers on different machines may use identical local profile
names: these names never determine network player IDs or kingdom slots.

The default profile has its own empty-name lock, distinct from every valid
named profile. Duplicate profile/session parameters, raw profile path overrides
and combinations with solo Frontier region startup are refused before setup.
The verified profile is pinned through native preRun, including if history
changes the URL during preparation or script loading.

Preparation failures release an unused lease. Injection retains it for the
remaining document lifetime, including runtime errors and pagehide. Those
signals do not prove the original workers stopped writing. There is no timer,
background storage enumeration, lock-stealing or automatic game relaunch.
The existing named-world and paired-region guards remain independent.

The source checks pass79 tests, including actual staged startup, cancellation
during each preparation stage, rejection before hashing/GPU calls, immutable
profile routing, competing multiplayer sessions and the existing solo guards.
Invitation checks pass separately. An isolated candidate026 package also
passes the7 profile checks against its packaged module and actual player HTML.
The private candidate027 package also passes these7 checks against its
packaged module and player HTML. The earlier package uses candidate026; this JavaScript change needs
no new WASM compilation. The live game route is unchanged and has not been
reloaded. No browser game runs during this qualification.

This covers sessions launched with multiplayer/campaign/co-op parameters.
Legacy game pages already open, and ordinary solo startup without those
parameters, do not acquire this new profile lease. It is not a guarantee
against such older pages writing the same profile. The user removed the crash-related browser
launch hold on2026-10-07. Candidate028 browser qualification confirms that a second local multiplayer
tab is refused before native injection while its first game keeps the lease.
The profile guard and corrected keyboard engine are now published locally;
all7 checks also pass against the actual served player HTML and module. See
`output/browser-keyboard-028/manifest.json`. Shared fresh-region generation and independent
internet participants remain unqualified.

Source, isolated package hashes and test logs are preserved in
`output/multiplayer-profile-lease-001/manifest.json`.
