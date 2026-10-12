# Recovering a failed local campaign completion save

A shared victory already writes chapter completion to the selected local
profile without a game login. Previously, a failed write could retry only if
another victory message arrived. Duplicate messages also replaced the saved
status text. A game/transport failure prevented subsequent messages from
initiating another save.

The campaign panel now retains a confirmed victory for the lifetime of its
page and offers **Retry local save** when opening storage or committing the
completion fails. Retrying performs the local completion write; it does not
poll or repeat a native gameplay action. A previously confirmed result can
still be saved after the runtime reports failure. Results arriving only after
that failure are ignored, as before.

Game status and local save status have separate outputs. The panel announces
saved completion only after the existing IndexedDB transaction completes.
An individual request's success event is insufficient; an aborted transaction
leaves the result retryable. Every opened connection closes after its attempt.
Invalid or ambiguous profile names open no database and expose no retry action.
The selected profile and campaign/relay return link remain unchanged.

After the completion transaction commits, the panel now offers the next chapter
with the same local profile, relay and shared rules. Both players choose that
chapter and start a new room; kingdoms are not carried between chapters. The
link stays hidden during a pending or failed save and appears after a successful
retry, including when a confirmed victory is saved after the runtime stops.
The last chapter returns to the campaign page instead of claiming that earlier,
possibly unplayed chapters are complete.

The campaign page recommends the earliest unfinished chapter in the selected
profile, updates that recommendation after a committed reset, and displays a
replay message when all three are complete. Failed storage reads are shown as
unavailable rather than inferred completion. Relay edits apply to both the
recommendation and the individual chapter links.

The current progression change passes 21 focused Node tests across
`tests/campaign-progress.test.mjs` and `tests/campaign-launcher.test.mjs`, including
the actual session and launcher modules under mock DOM/runtime events. It has
been staged without changing the WASM binary. Live chapter-to-chapter gameplay,
party migration and separate-household play remain unverified; no browser or
game process was launched for this change.

The adapter retains one confirmed-victory flag, one committed flag and at most
one save promise. Duplicate victory notifications initiate no further save
attempts, and concurrent retry callbacks receive the same pending promise.
There is no retry timer, background worker or growing result queue. Match-state
notifications are also deduplicated until the state changes. Explicit retry
avoids repeatedly attempting a blocked/full store on every duplicate result.

Twelve focused progress/adapter tests and all 252 workspace JavaScript tests
pass in Node. The actual shipped session module runs against mock DOM/session
events. Tests cover 1,000 duplicate notifications during an outstanding open,
shared retry promises, failed opens, aborted writes, duplicate outcomes,
completion after runtime failure, retries after failure, profile isolation and
defeat/wrong-chapter/late-result rejection. One integration test uses the actual
completion function's transaction handlers to abort a request that already
reported success, then commits its explicit retry. Both connections close and
the save-status output changes only on the committed attempt.

```sh
node --test --test-concurrency=1 tests/campaign-progress.test.mjs
node --test --test-concurrency=1 tests/*.test.mjs
python3 scripts/stage-world.py
```

The changed session module is staged in the existing site; its source and
staged hashes match. Player HTML content and the existing WASM artifact's
size/mtime remain unchanged. Evidence is in
`output/campaign-save-recovery-terminal-verified.json`,
`output/campaign-save-recovery-stage.json` and the focused/workspace test logs.
No game/browser launch, native build, native CPU fixture or original-profile
access ran in this pass.

This retains an unsaved confirmed result in the current page. Durable chapter
completion exists only after storage commits. Recovering an uncommitted result
after page closure, restoring a disconnected native match, independent-household
internet play and offline-party campaign continuation still need implementation
or qualification. Mock events do not verify actual browser rendering or storage
retention across an app crash. The crash remains unresolved, game launches stay
suspended and the full development goal remains active.
