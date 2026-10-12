# Native region save and departure controls

The shipped `web/world/native.mjs` adapter permits one single-player checkpoint
request from a playable region. A request stays busy both while queued and
after the native action poll consumes it. Repeated readiness announcements,
synthetic button clicks and additional polls cannot replace its save/leave
intent. Recovery links are hidden and their click handlers reject navigation
while a request is busy.

Only a consumed request's `checkpoint saved` announcement allows automatic
return to Frontier. A failed checkpoint keeps the player in the region,
cancels departure and permits an explicit retry. Existing checkpoint recovery
remains available after failure. The return URL retains the selected named
world and opted-in memory diagnostics, and centers the atlas on the region
being left rather than an older camera position.

The region panel also offers **Save and travel west/north/south/east**. A single
destination is retained alongside the checkpoint request. A successful consumed
save replaces the current document with the neighboring region's dedicated
profile and automatic restoration settings. Failed or cancelled saves discard
that destination. Controls remain disabled after departure is requested so
another click cannot start a second checkpoint before document replacement.
World-edge buttons are disabled, and legal edge atlas views clip their preload
margin to available regions.

Each region remains a separate Majesty kingdom. An existing checkpoint restores
on entry; a new region still requires starting a game there. Heroes do not
cross with the player, terrain seams are not continuous, and simultaneous
co-op travel remains unavailable. Page replacement is the current travel
mechanism, not an established browser memory bound.

Loading, menu, mission completion/defeat and network handoff rejection cancel
queued requests and departure intent. A consumed request remains busy until
its result drains; readiness cannot queue a replacement before that result.
An abandoned result cannot navigate or unlock non-playable controls. Runtime
failure disables saving and permits recovery navigation. A shared checkpoint
still rejects one-sided region saving.

The native interface exposes a boolean action and text announcements, without
request IDs. The adapter serializes requests and drains abandoned consumed
requests; it cannot distinguish an arbitrarily delayed duplicate result after
a subsequent request has already been consumed. Ordered native announcements
are still required. Missing acknowledgements leave a consumed request locked;
there is no timeout that guesses whether writing finished. Only these controls
are guarded: ordinary browser navigation and tab closure remain outside this
adapter.

Unrelated runtime logs are ignored before any control updates. There is no
polling timer, background task or additional file read in the DOM adapter.
Named-world lease ownership remains with the initialized player context;
save controls do not release it independently.

Qualification uses the actual shipped adapter in a Node VM with a small DOM
fixture, including consumed/queued races, failures and named-world URLs. These
terminal tests do not establish OPFS interruption recovery, engine disposal,
live region paging, seamless movement or co-op checkpoint publication. Browser
and game launches remain suspended under the user's host-app crash constraint.

The current neighboring-region and atlas return flow passes 72 focused tests
across `frontier-controls`, `world`, `realm-session` and `native-atlas`. They
exercise the shipped adapters, failure/cancellation, coordinate boundaries,
and centering the actual atlas view after a distant return. The 800-hop URL
round trip checks routing and namespaces; it is not an engine travel test.

Evidence: `output/frontier-save-controls-focused-tests.log`,
`output/frontier-save-controls-all-tests.log` and
`output/frontier-save-controls-terminal-qualified.json`.
