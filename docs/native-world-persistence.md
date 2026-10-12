# Original saves across region unload and revisit

The opt-in native residency probe now saves each evolving solo world before
the original dispatcher unloads it, publishes that region's latest private
snapshot, and restores its progress on revisit. This is an actual original
engine test using two existing mission fixtures. Continuous travel, generated
adjacent terrain, sustained memory bounds, and browser/co-op integration remain
unfinished. Browser game testing remains suspended after the host-app crashes.

The subsequent [twelve-visit residency test](native-world-journey-residency.md)
extends this prototype and records an audited ID-keyed attachment serialization
permutation. It preserves every command-container byte. Retained allocations
still grow over that run, so sustained memory bounds remain unqualified.

Actual attempt003 (PID52084, terminal exit0), from official one-job build008,
loads regions1,0,1. Each visit completes20 original50ms ticks. The first region
advances68650→69650, the second40000→41000, then the first resumes at69650 and
advances to70650. The supported transferred character retains its saved
position, schedule and commands on return, then continues moving. Its previous
alias remains absent and the unloaded region contains no duplicate character.

Before and after each visit, the existing original full-world writer produces
an immutable private snapshot. Only after an after-snapshot succeeds does a
4096-byte bounded copy and rename replace that region's private latest file.
Original dispatcher teardown still owns destruction; all six tracked roots
are freed once on each of the three exits. The next normal Load Game input
consumes the latest regional save. These snapshots are outside SaveGame except
for its single private menu input. Canonical committed transfer worlds and
player profiles are preserved. Close/rename is not qualified for power loss,
cross-process synchronization or browser storage durability.

The first persistence attempt restored entity records but exposed two original
RNG reload differences. The GPL v3 reader00623900 seeds its runtime+20/+24
through004f6710; later solo initialization00499344 reseeds it through00623720.
The separate gameplay RNG also differs on initial load. Original getter00601760
returns0071fc70; the original save collector004356ed records its +4 value into
SVGD metadata+6c, and00436c00 serializes it. The probe reads both saved seeds
using bounded original chunk metadata and applies original setters00623720
and004f6710 at the safe first gameplay boundary, before the first snapshot.
Zero seeds are refused because004f6710 treats zero as a request for clock time;
general zero-seed persistence remains unsupported by this probe.

Attempt002 corrects only scripting RNG and remains unqualified for complete
state preservation. Attempt003 corrects both. The independent gate compares
the initial committed saves to both first-load snapshots and the first region's
after-save to its revisited before-save. Every root section is compared in
order, including repeated PLYR sections; all entity records and queues are also
compared. It excludes only the validated save label and calendar timestamp
from SVGD equality. Original reader00436770 reads two NUL strings, a game-clock
DWORD, then00501f80 reads16 calendar bytes. The game clock, gameplay RNG, quest
name and all remaining metadata stay in equality. RNG bytes are never excluded.

Evidence:

- `output/native-world-persistence-observed.json`: binds successful stopped
  process, current executable/sources, official build, original producers and
  committed revision6 exports, copied initial inputs, six snapshots, three
  original teardown cycles, final regional publications, actual restored RNG
  values and continued character positions.
- `output/native-world-persistence-controls-final-observed.json`: independently
  requalifies the actual run, checks the unchanged positive before each case,
  rejects15 actual stale/altered saves or contradictory traces, and accepts
  a valid changed calendar timestamp. Copies use4096-byte I/O and never change
  actual game snapshots. No additional game process is launched by the gate.
- `output/native-world-persistence-attempt-001.json` and `...002.json`: retained
  incomplete RNG qualifications; successful native exit alone is insufficient.

Reproduce from the workspace root with fresh attempt/report numbers:

```sh
python3 scripts/build-native-world-residency.py --attempt NEW_BUILD_NUMBER
python3 scripts/run-native-world-residency.py \
  output/native-repeat-handoff-publication-observed.json \
  upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-0bies5/Selected_Entity_Revision.json \
  output/native-world-residency-build-NEW_BUILD_NUMBER.json \
  --attempt NEW_RUN_NUMBER --persist
node scripts/check-native-world-persistence.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_REPORT.json
node scripts/check-native-world-persistence-controls.mjs \
  output/native-world-persistence-attempt-NEW_RUN_NUMBER.json output/FRESH_CONTROLS.json
```

The next steps are longer original-engine residency measurements, retirement
of remaining caches/managers and opaque references, generated adjacent terrain,
and automatic travel. Separate solo snapshots cannot yet coordinate co-op
world transitions. Three visits do not establish a memory plateau or safe
browser resource usage; fixed guest arena capacity, process RSS and GPU memory
are separate measurements.
