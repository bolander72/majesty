# Registered guild preparation for captured travel

The production crossing controller now calls `prepareNativeHeroTravel` after
publishing its accepted original checkpoint. A single bounded pair operation
checks the source and named destination, verifies both original terrain
layouts, and prepares the destination's immutable guild reference. It borrows
the game's retained world lease and does not create directories, write native
saves, retire actors, reserve runtime IDs or transfer ownership.

Only an actual captured crossing with a verified saved actor position can
begin preparation. The current selected journey head, saved owner digest,
region and native/GPL aliases must still equal the published capture. The
registered guild comes from that journal's validated immutable identity. A
caller cannot supply another guild, an arbitrary agent ID or a destination
clock. The operation reads only the selected source and one cardinal neighbor.

The existing remote-home planner reuses a canonical, unscheduled pure proxy
only for that exact logical guild. Duplicate matching proxies, native backlinks,
queued proxies and corrupted origin fields refuse. A proxy for another logical
guild remains unchanged. When no matching proxy exists, preparation produces
one bounded original GPL record for the original destination runtime to import.
The record carries its immutable home guild/region/world/content identity and
has no native unit or active script. No local destination building is borrowed.

`checkpointNextAgentId` reads the original GPL allocation counter following
the validated manager envelope. It exhausts the agent/chunk structure and
requires a positive signed counter above every surviving ID. Removed identities
remain consumed: the largest surviving ID is insufficient to derive the next
allocation. Original native fixture code already qualifies this counter's
allocation behavior. A proposal remains inert until the destination runtime
reserves an ID and acknowledges the imported record; a saved counter alone is
not that runtime acknowledgement.

Returned metadata is frozen; each access to the at-most1024B record returns a
copy. No original actor, checkpoint reader or visited-region cache escapes the
operation. Cancellation drains pending reads before clearing the save token,
and the exclusive game lease remains held. The controller stays paused while
preparation runs and suppresses late results after page departure. Refusal
uses the existing failed-save acknowledgement and resumes the source. An
uncreated neighbor returns `kind:new, home:null`: its native generation and
paused loading are still required before registered arrival can be prepared.

## Original-data verification

`output/hero-crossing-source-original-003.json` separately enrolls the preserved
original94550 UNIT508/GPL25 home save through current production startup. It
keeps the original activation producer/provenance and native source bytes
unchanged. The real native crossing capture from build307/trial017 remains
exact; no C++ source, executable or compiled input changed for this work.

`output/hero-live-save-original-011.json` replays that original accepted
103500 checkpoint through current production publication and the same
crossing preparation used by the controller. Its destination is the original
retired eastern4050 kingdom. The old pure proxy belongs to the legacy world
identity; the new enrollment therefore proposes a separate453B pure-home
record for its own immutable guild, preserving the old record and all source
and destination files. The proposal uses the original saved next agent ID38;
surviving agents alone would have incorrectly proposed removed ID37.

The proposal SHA-256 is
`b188866a07ba7c97db9dc7e05135133a034c6237a0b16fc99887555729db1ec4`.
Independent record verification checks its exact guild identity, native ID0,
empty functions and bounded metadata. Mutating a returned record copy cannot
alter the retained proposal. Source/destination/native/custody manifests remain
bound to the same accepted crossing and world lease; extra native/journal
writes are zero. Reads/writes are at most4096B, peak active I/O1, final0.

Original replay010 was an earlier two-operation draft and used proposed ID37.
It is preserved as historical evidence and superseded by011. The combined
inspection/preparation avoids duplicate full terrain preflights: total measured
controlled replay reads decrease4735→4293 (442 fewer), with identical write
counts. This is a filesystem-backed OPFS/Web Lock measurement, not a browser
performance or durability measurement.

Current original startup014 and live replay012 also preserve ordinary manual
saving with the actual113500 source and native018's115450 checkpoint. The
saved guild-parent refusal remains intact. The259-test regression passes with
zero failures/skips, including original allocation-counter validation, pure
home reuse/refusal, same-lease cancellation/draining and actual controller
holding/refusal/page-departure behavior. Focused003 passes100 tests. The earlier
focused002 failure was a test expectation that a refused preparation stayed
pending; production correctly made the failed acknowledgement immediately
available. The fixture was corrected and the failed result retained.

No browser or native game/build process was started this turn. Browser launches
remain suspended for the unresolved host-app crashes.

The next shared runtime stage now registers/reuses this proposal and imports
the actual four-record crossing hero in an isolated original paused neighbor.
Saved-graph inspection verifies original reservations and preservation of480
existing records. The browser controller still stops at preparation. Isolated
native activation now qualifies drawing, collision, AI and a physical remote-home
return crossing. Complete family integration, source retirement/unload and
paired ownership publication remain unfinished. Full cooperative/competitive
matches, independent internet transport tests and sustained browser resource
bounds remain requirements. See [original hero import](hero-native-arrival.md).
