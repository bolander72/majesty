#!/usr/bin/env python3
"""Verify original common dispatch on restored private graphs; no game launch."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MASK = 0xffffffff
PROBE = re.compile(r'^\[streaming\] Private clock probe source=(\d+) destination=(\d+) '
                   r'case=(\d+) calls=(\d+) leaves=(\d+) skipped=(\d+) restored=(\d+) '
                   r'headers=(\d+) result=(pass|fail)$', re.M)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(path):
    spec = importlib.util.spec_from_file_location('populated', ROOT / 'scripts/check-native-actor-populated-stage.py')
    populated = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(populated)
    report = populated.verify(path)
    meta = report['fixture']
    if meta.get('clockProbe') is not True:
        raise ValueError('The manifest does not select the private clock probe')
    audit_path = ROOT / 'output/native-order-clock-probe-audit.json'
    audit = json.loads(audit_path.read_text())
    pin = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
    if (audit.get('qualified') is not True or audit['executableSha256'] != pin or
            audit['anchors'] != 12 or audit['virtualSlots'] != 4 or len(audit['methods']) != 4 or
            audit['sourceSha256'] != sha(ROOT / 'scripts/audit-native-order-clock-probe.py') or
            sha(ROOT / 'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe') != pin):
        raise ValueError('Stale or incomplete original-code audit')
    symbols_path = ROOT / 'upstream/majesty-recomp/build/recomp/gen/symbols.json'
    symbols = json.loads(symbols_path.read_text())
    wanted = {'004ab8a0', '005e1330', '005e2ef0', '005e53c0'}
    entries = [r for r in symbols['functions'] if r['addr'] in wanted]
    if len(entries) != 4 or any(r['kind'] != 'entry' or r['provenance'] != 'config' or
                               r['hookable'] is not True for r in entries):
        raise ValueError('Original dispatch and leaf methods lack curated hookable entries')
    metadata_path = ROOT / 'output/native-actor-clock-stage-fixtures.json'
    pack = json.loads(metadata_path.read_text())
    if (pack['format'] != 'NAS2' or pack['sha256'] != meta['copiedCaseFileSha256'] or
            sha(metadata_path.with_suffix('.bin')) != pack['sha256'] or
            pack['sourceSha256'] != sha(ROOT / pack['source'])):
        raise ValueError('Missing unchanged typed clock fixture')
    rows = list(PROBE.finditer(Path(meta['log']).read_text()))
    if len(rows) != 64:
        raise ValueError('Expected 64 original dispatch probes')
    observations = []
    for i, row in enumerate(rows):
        source, destination, case, calls, leaves, skipped, restored, headers = map(int, row.groups()[:-1])
        expected_destination = [source, 0, (source + 0x80000000) & MASK, MASK][i % 4]
        if (source > MASK or destination != expected_destination or case != i % 4 or
                calls != 24 or restored != 1 or headers != 3 or row.group(9) != 'pass'):
            raise ValueError('Failed clock probe ' + str(i))
        actor = pack['cases'][i // 16]
        if actor['unitId'] != [497, 499, 501, 503][i // 16] or len(actor['clocks']) != 3:
            raise ValueError('Unmatched actor clock cases')
        expected_leaves = 0
        for h in actor['clocks']:
            elapsed = (source - h['when']) & MASK
            advances = [0, MASK, (h['delta'] - elapsed - 1) & MASK, (h['delta'] - elapsed) & MASK]
            expected_leaves += 2 * sum(not h['info'] & 1 and h['delta'] <= ((elapsed + advance) & MASK)
                                       for advance in advances)
        if leaves != expected_leaves or skipped != calls - leaves or not skipped:
            raise ValueError('Dispatch decisions disagree with unsigned-age boundary ' + str(i))
        observations.append(dict(actor=actor['unitId'], trial=i % 16, sourceClock=source,
                                 syntheticDestinationClock=destination, calls=calls,
                                 leafReturns=leaves, skipped=skipped))
    sources = ['upstream/majesty-recomp/browser_streaming.cpp',
               'scripts/prepare-native-actor-populated-stage.mjs',
               'scripts/run-native-actor-populated-stage-fixture.py',
               'scripts/check-native-actor-populated-stage.py',
               'scripts/check-native-actor-clock-stage.py',
               'scripts/audit-native-order-clock-probe.py',
               'upstream/majesty-recomp/game.toml',
               'web/world/order-dispatch-clock.mjs']
    report.update(scope='actual stopped source-clock capture and synthetic destination-clock '
                  'rebasing on four matched private restored actors; original common dispatcher '
                  'executes, leaf handlers return before gameplay effects, original writer '
                  'reproduces the edited payload, exact original cleanup reclaims storage',
                  actorAndCommandBytesRoundTripEqual=False,
                  actorBytesRoundTripEqual=True, originalWriterMatchesClockEditedPayload=True,
                  stoppedSourceClockCaptured=True, realSourceClockRestoredAfterEveryCall=True,
                  originalDispatchCalls=sum(o['calls'] for o in observations),
                  observedLeafReturns=sum(o['leafReturns'] for o in observations),
                  observedDispatchSkips=sum(o['skipped'] for o in observations),
                  privateDispatchHeadersRebased=192, syntheticDestinationClockCases=4,
                  actualLeafGameplayExecuted=False, actualDestinationWorldClockQualified=False,
                  navigationBytesUnchanged=True, destinationUnitReferencesQualified=False,
                  observations=observations, sourceSha256={p: sha(ROOT / p) for p in sources})
    report['sourceSha256'].update(populated.recorded_native_sources(meta))
    report['evidenceSha256'][str(metadata_path.relative_to(ROOT))] = sha(metadata_path)
    report['evidenceSha256'][str(audit_path.relative_to(ROOT))] = sha(audit_path)
    report['curatedFunctionEntries'] = entries
    report['generatedSymbolsSha256'] = sha(symbols_path)
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest', type=Path)
    p.add_argument('--output', type=Path, default=ROOT / 'output/native-actor-clock-stage-observed.json')
    args = p.parse_args()
    report = verify(args.manifest)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['qualified', 'trials', 'originalDispatchCalls',
                                           'observedLeafReturns', 'observedDispatchSkips',
                                           'continuousStreamingQualified']}))
