# Departed NPC world reload

Native attempt 012 freshly loads the original full snapshot produced by
[scheduled NPC removal](native-npc-scheduling.md), then writes another original
full snapshot. UNIT 510 and script agent 79 stay absent. All 501 surviving entity
records and both saved script queues match the departed input byte for byte.
This closes the isolated removal/save/reload check; it does not commit a transfer
between two regions or establish continuous world expansion.

The runner independently recomputes the original departure proof before copying
its exact after snapshot into a new owned profile. It uses a separate process,
fixed 800x600 display and pinned clock. Its expected-identity file uses version 2
to describe absent identities; present-actor fixtures retain version 1. Insertion,
AI-motion observation and a second departure cannot be combined with this mode.

At the existing post-load boundary, the native fixture checks original factory
and script lookups, manager membership, registry lists and queues. It calls the
original full writer with the normal renderer suspend/resume lifecycle. That write
must preserve runtime queue membership, registry snapshots, identity counters and
hook count. No actor is constructed or activated. The original load visits all
480 remaining native units, manager entries and queues each contain 10 agents,
and the reported native/script counters are 510 and 80. These counters remain
above the removed identities; this checks an identity reservation floor and does
not independently decode every counter from the input file.

The stopped-file checker exhausts the UNIT, GPL, attachment and queue iterators.
Reads are capped at 4096 bytes. Record maps and queue sets are capped at this
fixture's 480 units, 10 agents, 11 attachments and 10 queue members. All surviving
records compare against the independently qualified departure snapshot, including
375/130-byte native bodies and complete scripts/commands. Saved queue order,
membership and selector also match. Every queued ID resolves to a saved agent
and appears only once. Different save labels mean whole-file hashes may differ;
equality is required for each entity record and the queues.

The native process terminated with exit 0 and no reported undeliverable calls or
gameplay faults. Thirty-seven offline refusal cases cover missing/failed loads,
reused processes, conflicting fixture modes, incomplete membership, counter floor
violations, changed surviving UNIT/GPL data, duplicate or removed queued IDs,
queue order/selector changes, resurrected NPC records and a present-actor fixture
version. Controls modify only copied evidence and launch no game or browser.

## Evidence and reproduction

- output/native-joint-reload-attempt-012.json/.log: terminal native run.
- output/native-npc-departed-reload-observed.json: original full reload and save,
  exact 501 surviving records, queues and removed identities.
- output/native-npc-departed-reload-controls-observed.json: 37 offline refusals.
- output/native-npc-departed-reload-build.log: official jobs-one smoke build,
  exit 0, existing unused-parameter and linker alignment warnings.

Use fresh output filenames and attempts. First qualify a departure with the
existing independent checker, then:

```sh
python3 scripts/run-native-joint-reload.py \
  output/native-inflight-move-checkpoint-observed.json \
  output/native-inflight-move-identity-observed.json \
  --attempt <fresh-number> \
  --reload-departed output/native-npc-scheduled-departure-observed.json
node scripts/check-native-npc-departed-reload.mjs \
  output/<new-manifest>.json output/<new-reload-proof>.json
node scripts/check-native-npc-departed-reload-controls.mjs \
  output/<new-manifest>.json output/<new-controls>.json
```

Browser launches remain suspended under the unresolved host-app crash constraint;
served WASM is unchanged. At most one heavy native/build process runs at a time.
The active goal still requires original Brashnard source departure, durable
ownership/reference mappings and paired commits, repeated region crossings,
bounded active simulation/browser resources, remaining co-op outcomes and
independent internet gameplay tests. The existing prototype's dormant regions
and single canvas do not by themselves prove these original-engine requirements.

The subsequent [original source removal fixture](native-original-source-departure.md)
qualifies Brashnard's actual NPC2101/GPL37 removal and fresh source reload, preserving
all2,111 other records. Paired ownership publication and repeated crossings remain open.
