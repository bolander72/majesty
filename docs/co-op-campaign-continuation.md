# Continue a shared campaign

After the original victory notices, both players receive shared victory and
their own browser records chapter completion. Acknowledge the original
multiplayer notice to let the shared result callback finish.

Choose **Next chapter**. The setup keeps the relay, room, starting coordinate,
your role and your own local profile. It removes the previous checkpoint's
resume token. An expanding campaign requires a new world name for the next
chapter, preserving the earlier world's saved regions. The host chooses that
name and sends the resulting invitation; the guest selects their own existing
profile. Both rejoin and start through the original lobby.

Each chapter starts new kingdoms. Region travel within one chapter retains the
same expedition; changing chapters starts the next expedition. Completion is
stored separately from native game saves, and neither requires a game login.
Use **Save and pause** and the resume preparation page to continue a saved
expedition later with both players present.

Frontend075 fixes the continuation link running into the saved-progress message
and wrapping into an unreliable click target. Both now occupy separate rows,
and the link remains hidden until completion has actually been committed.

Actual current-engine tests qualified Chapter 1 shared victory over public WSS,
persisted completion in both isolated profiles, normal continuation clicks for
both roles, an invitation without a profile or stale resume, and a fresh
Chapter 2 start with two kingdoms. The new world saved revision 1 at clock
26250; the earlier world retained revision 5 at clock 31900 with unchanged
committed digest. All owned game tabs and temporary relays/tunnels were closed.
56 focused campaign/navigation checks pass. No native or WASM rebuild was
needed.

Frontend076 displays each kingdom’s reported treasury
and the gold still needed for Chapters 2 and 3. A target reached message waits
for the original shared result; it does not record chapter completion itself.
The native engine and victory objectives are unchanged. The saved Chapter 2
checkpoint has both kingdoms at 30,015 gold, with 85 each still needed.

The current-engine candidate076 pair has now finished Chapter 2 through public
WSS at 30,105 gold each. Both named profiles retained 2 of 3 completed chapters
after game release and reopening. The setup’s Campaign progress link now
retains its own profile and world rather than showing Default. Chapter 3 began
in a separate world and saved revision 1 at clock 106300, with 30,075 gold each.
Preparing that ninth resume exposed the old eight-copy limit. Preparation now
bounds the separate lobby copies at 64 files and 64 MiB, scans file metadata only,
and preserves all existing copies and checkpoint slots. Actual ninth-copy
preparation succeeded and both original saved-game readers admitted that
checkpoint; 82 focused checks pass. Release076 is published locally. Its six
entry routes and nine changed modules passed HTTP/hash verification; the
published entry's browser trial remains pending because the browser pane
could not attach. No game launched during that failure. Chapter 3 victory
remains pending. Evidence: `output/campaign076-chapter2-victory-observations.json`,
`output/campaign076-profile-progress-after-chapter2.json` and
`output/campaign076-chapter3-save-observations.json`.

Evidence: `output/campaign075-qualified.json`. Both clients ran on one Mac
through a public relay. This milestone does not qualify independent-household
play, Chapter 3 completion in this expanding expedition, competitive match
completion, or sustained browser resource limits.

Frontend publication evidence: `output/campaign076-qualified.json` and
`output/campaign076-publication/publication.json`. Qualification covers the
tested progress and resume fixes; it does not declare Chapter 3 complete.

Browser availability recovered through an isolated owned Chrome profile.
Release076 actually ran a local-relay pair in the separate campaign077-ch3
world. Both kingdoms built Marketplace #1, researched Market Day and Healing
Potions, and upgraded to level 2 through the original interface. The original
Save Game command preserved `(Freestyle Game) 7 Days` in both test profiles;
the exported player backup was copied and ZIP integrity checked. The original
in-app profiles and their two completed chapters remain preserved separately.

The original lobby accepts an empty room name. Its valid `Created room ` log
was rejected by the frontend's nonempty-name parser, disabling the actual
host's Save and pause control. Release077 accepts that original observation
while keeping Joined guests read-only and rejecting malformed log lines.
86 focused checks pass. The real pair loaded its native 7 Days match, committed
managed revision 1 at clock 434100, closed both engines, prepared the verified
lobby copy, rejoined and continued with both kingdoms. It then committed
revision 2 at clock 485900, 496906 bytes, digest
04c3949b8eba244db3c982ccc97e872de235e326dbc40684c2df73d07bb1cf64.
Treasuries were 29,398 and 28,305 against the unchanged 35,000 target.
Chapter 3 completion remains unfinished; this pair used the local relay,
without a new public WSS or separate-household qualification.

The earlier construction trial lasted 1217 seconds, exceeding its planned
1200 seconds by 17 during native-save cleanup. The next save/resume trial
reserved 300 seconds for cleanup and released both engines at 430 seconds.
Owned Chrome process-tree RSS observations ranged up to 1723 MiB during these
checks; this does not establish sustained resource bounds or resolve the
previous host-app crash cause. Release077 publishes only this tested host
parser change, with prior076 qualification reused for unchanged components.
Evidence: `output/campaign077-qualified.json`,
`output/campaign077-publication/publication.json` and
`output/campaign077-reload-trial.json`.

The published077 entry subsequently resumed revision2 with both actual players
over public WSS. Continued native treasury changes reached 29,418 and 28,828,
and the host committed revision3 at clock511050,501895 bytes,digest
9ee9936c775f1b3e29e450cc83c9f9e008e513432fbb7e3384e598a5e4c55da7.
Both engines released after216seconds, within the trial deadline; the owned
public relay/tunnel reported terminal with zero peers and rooms. The updated
player backup was explicitly downloaded and ZIP integrity checked. The earlier
apparently stalled download had clicked Export while a completed archive was
already cached, so no download event would occur; clearing only the preserved
temporary archive before waiting for the new download succeeded.

Owned Chrome process-tree RSS reached2251MiB in the public trial; all owned
browser tabs and the test browser subsequently closed. No sustained resource
bound or crash fix is claimed. The original in-app host tab is still listed,
but CUA attachment was rejected by browser URL security policy. No alternate
mechanism was used to access those original tabs or storage. The new Chrome
test profiles remain separate from the original two-chapter campaign profiles.
Evidence: `output/campaign077-publication/published-entry-qualified.json`.

Release078 fixes the player-backup export error `Invalid Atlas record.` Native
Atlas travel writes `journey-v1` as bounded JSON text; the backup validator
previously rejected it because it required every Atlas value to be an object.
The error was reproduced using release077 and the actual native travel writer.
Backup validation now uses the same lightweight world-bound journey validator
as the travel path, retaining the original text. Unknown or malformed records
still fail validation. Both pending and arrived trips pass focused checks.
An isolated browser roundtrip through public OPFS/IndexedDB and the shipped
worker preview preserves native bytes, chapter completion, camera, regions
and travel text; conflict, rollback and cleanup checks also pass. No game
launched and original in-app profile storage was not accessed. Use the new
`/releases/player078/backups/` page; the immutable077 page retains its previous
validator. Evidence: `output/backup078-qualified.json` and
`output/backup078-publication/publication.json`.

The human-supplied 2026-10-09 backup now verifies and restores through the
shipped078 UI into a separate owned Chrome profile:565 native files and18
databases, including the actual native Atlas journey text. Both original named
profiles retain2of3 completed chapters. The original `campaign076-ch3` revision1
checkpoint is admitted by the native resume reader; both kingdoms play through
the local relay. A shared revision2 checkpoint saves at clock128700,433576bytes,
SHA256 `022fd9fe1f7a7515fa7ab1a38fb8e8e1bc4512bbc1af4cc3a51d5055fe7a4595`.
Both treasuries are30090. A new lobby copy verifies, and both released players
still show2completed chapters. Chapter3 victory remains unfinished.

A fresh567-file18-database export passes every entry digest check. Database
bytes and all prior native paths are preserved;16 earlier world-resume copies
retain their original digests. The supplied archive and original in-app
storage remain untouched. Owned engines and Chrome are released within413sec;
sampled owned process RSS peaked at2419.3MiB. A guest module fetch failed once
and recovered after reloading the same owned tab. This trial does not qualify
public WSS, independent-household play, sustained resource limits or a fix for
the earlier host-app crashes. Evidence:`output/campaign079-qualified.json`.
