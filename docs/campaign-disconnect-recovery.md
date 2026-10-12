# Campaign actions after a disconnected room

The campaign panel now handles the runtime's exact connection-loss and receive
overflow messages. Both end the panel's current session, disable surrender,
discard any pending surrender command, and tell the player to reload before
creating or joining another room. Later queued chapter-start, restore and result
messages cannot re-enable the panel or save an unconfirmed victory.

An already confirmed victory remains independent of the session: a pending local
completion transaction may commit, and an aborted transaction can be retried
without playing again. A completed match keeps its `finished` event; a lost
unfinished match publishes one `interrupted` event. Neither event creates new
DOM nodes. Engine failure follows the same shared-action cleanup.

Victory and defeat now also discard a surrender queued before the result.
The click handler refuses actions when disabled or outside a playing match;
the native action poll checks that the match is still playing. A legitimate
two-click surrender is consumed once. Original replicated surrender commands
and engine victory/defeat predicates are unchanged.

Four regressions reproduced against the previous panel. After the fix, the
campaign-progress, campaign-launcher and multiplayer-invitation suites pass
44 tests against source and another 44 against the actual served campaign
module. Tests cover queued action cancellation, late messages, duplicate loss,
pending victory storage, retry after disconnect, and ordinary surrender.
These are terminal DOM/event and storage fixtures; no browser or game launches.

Only `build/web-site/campaign/session.mjs` is replaced. Its previous bytes and
the tested source inputs/logs are preserved in `output/campaign-disconnect-001`.
A static localhost GET returns the exact changed module. The four served
engine files and launcher `games.json` retain hashes, inodes and mtimes.
Evidence: `output/campaign-disconnect-001-observed.json`.

The isolated WASM013 package retains its previously archived frontend; this
later served JavaScript repair does not rewrite that historical package.
Live disconnect behavior, coordinated campaign checkpoints, offline branches,
co-op region travel and independent internet completion remain unverified or
unfinished. The app-crash browser launch suspension remains in force.
