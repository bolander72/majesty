#!/usr/bin/env python3
"""Verify matched actor/command composition from an observed terminal native run."""
import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
ROW = re.compile(r'^\[streaming\] Populated stage actor=(\d+) trial=(\d+) private=(\d+) '
                 r'orders=(\d+) equal=(\d+) destroyed=(\d+) source-kept=(\d+) '
                 r'source-unchanged=(\d+) balanced=(\d+) result=(pass|fail)$', re.M)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def recorded_native_sources(meta):
    names = ['upstream/majesty-recomp/browser_streaming.cpp', 'upstream/majesty-recomp/game.toml']
    recorded = meta.get('nativeSourceSha256', {})
    if any(not re.fullmatch(r'[0-9a-f]{64}', recorded.get(name, '')) for name in names):
        raise ValueError('Missing recorded native source identity; do not relabel a historical run')
    historical = meta.get('nativeSourceQualificationRecord')
    if historical:
        path = Path(historical['path']).resolve()
        if path.parent != ROOT / 'output' or path.stat().st_size > 2 * 1024 * 1024 or sha(path) != historical['sha256']:
            raise ValueError('Changed historical source qualification record')
        original = json.loads(path.read_text())
        if (original.get('qualified') is not True or
                any(original['sourceSha256'][name] != recorded[name] for name in names) or
                any(original['fixture'][key] != meta[key] for key in
                    ['log', 'nativePid', 'copiedCaseFileSha256'])):
            raise ValueError('Native source record does not match this observed run')
    elif meta.get('nativeSourceRecording') != 'source files observed at process launch':
        raise ValueError('Unknown native source recording provenance')
    return {name: recorded[name] for name in names}


def verify(manifest_path, *, actors=(497, 499, 501, 503), world_visits=480):
    if len(actors) != 4 or len(set(actors)) != 4 or not isinstance(world_visits, int) or world_visits <= 0:
        raise ValueError('Expected four distinct source actors and a positive world-load count')
    meta = json.loads(manifest_path.read_text())
    run = Path(meta['fixture']).resolve()
    profile = Path(meta['profile']).resolve()
    if (run.parent != (GAME / 'build').resolve() or
            not run.name.startswith('actor-arrival-fixture-stage-populated-') or
            profile != run / 'frontier_0_0'):
        raise ValueError('Expected an isolated populated stage fixture')
    if meta.get('nativeExitCode') != 0 or meta.get('nativeSessionTerminal') is not True:
        raise ValueError('Native session has not been observed terminal with successful exit')
    path = Path(meta['log'])
    if path.stat().st_size > 5 * 1024 * 1024:
        raise ValueError('Unexpected log size')
    log = path.read_text()
    rows = list(ROW.finditer(log))
    if len(rows) != 64:
        raise ValueError(f'Expected 64 populated cycles, observed {len(rows)}')
    for i, row in enumerate(rows):
        expected = [actors[i // 16], i % 16, *([1] * 7)]
        if list(map(int, row.groups()[:-1])) != expected or row.group(10) != 'pass':
            raise ValueError('Failed matched actor/command cycle: ' + str(i))
    required = [
        '[streaming] Populated stage completed actors=4 trials=64 result=pass',
        '[streaming] Stage fixture files-removed=1',
        f'[streaming] Original load end result=00000000 visits={world_visits}',
        'guest exit code:    0', 'undeliverable calls: none', 'all expectations met',
    ]
    if any(s not in log for s in required) or 'result=fail' in log or 'allocation stopped' in log:
        raise ValueError('Missing successful original world/game completion evidence')
    for text in [
        '[streaming] Populated graph read complete=1 status=0 eax=00000000 claimed=1 failure=0',
        '[streaming] Populated graph structure-and-actor=1',
        '[streaming] Populated graph writer equal=1 status=0 eax=00000000',
        '[streaming] Populated graph cleanup frees=18 expected=18 retained=0',
    ]:
        if log.count(text) != 64:
            raise ValueError('Missing graph lifecycle evidence: ' + text)
    factory = re.findall(r'Populated factory before=([0-9a-f]{8}) after=([0-9a-f]{8}) '
                         r'table=00682ed0 cached=1 result=pass', log)
    if len(factory) != 1 or factory[0][0] != factory[0][1] or factory[0][0] == '00000000':
        raise ValueError('Did not preserve the initialized live game factory')
    for name, expected in meta['sourceHashes'].items():
        if sha(Path(meta['source']) / name) != expected:
            raise ValueError('The source profile changed: ' + name)
        if name.endswith('.GMP') and sha(profile / name) != expected:
            raise ValueError('The fixture saved world changed: ' + name)
    pack = profile / 'Populated_Order_Stage.bin'
    if sha(pack) != meta['copiedCaseFileSha256']:
        raise ValueError('The copied case file changed')
    frames = []
    for name in ['load_menu', 'fixed_loaded15', 'fixed_loaded30']:
        frame = run / 'frames' / f'smoke_{name}_present.ppm'
        with frame.open('rb') as f:
            if [f.readline() for _ in range(3)] != [b'P6\n', b'800 600\n', b'255\n']:
                raise ValueError('Unexpected native frame')
        if frame.stat().st_size != 1440015:
            raise ValueError('Incomplete native frame')
        frames.append(dict(name=name, sha256=sha(frame)))
    wasm = (GAME / 'build/web-site/majesty/MajestyRecomp.wasm').stat()
    return dict(qualified=True, scope='matched private full UNIT and populated command-bank '
                'composition for four copied Scions vehicles using the actual game factory; '
                'stopped journal-owned original cleanup, no destination publication',
                actors=list(actors), originalWorldLoadVisits=world_visits, trials=64, commandsLoadedAndRemoved=192,
                originalJournalExtentFrees=1152, actorAndCommandBytesRoundTripEqual=True,
                actorFieldsOutsideBanksPreservedDuringRead=True,
                actualGameKind2FactoryUsed=True, liveManagerReplaced=False,
                sourceActorIdentitiesWorldsAndSerializedStatePreserved=True,
                heapPoolAndHookBaselinesRecoveredEachTrial=True,
                journalRetainsOwnershipUntilOriginalCleanup=True, graphOwnershipTransferred=False,
                destinationReferencesClocksNavigationQualified=False,
                actorActivationQualified=False, productionArrivalQualified=False,
                continuousStreamingQualified=False, wholeBrowserResourceBoundQualified=False,
                independentWanGameplayQualified=False, browserUsed=False, wasmBuildPerformed=False,
                crashResolved=False, goalCompleted=False, nativeFrames=frames, fixture=meta,
                evidenceSha256={str(path.relative_to(ROOT)): sha(path)},
                servedWasmIdentity=dict(size=wasm.st_size, inode=wasm.st_ino, mtimeNs=wasm.st_mtime_ns))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'output/native-actor-populated-stage-observed.json')
    args = parser.parse_args()
    report = verify(args.manifest)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report[k] for k in ['qualified', 'actors', 'trials',
                                           'originalJournalExtentFrees', 'continuousStreamingQualified']}))
