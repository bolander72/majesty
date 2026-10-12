#!/usr/bin/env python3
"""Verify the bounded native staged-actor diagnostic; never launch a game."""
import argparse
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'upstream/majesty-recomp'
PIN = '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542'
TRIAL = re.compile(
    r'^\[streaming\] Stage fixture trial=(\d+) private=(\d+) spatial-deferred=(\d+) '
    r'orders=(\d+) equal=(\d+) parent-context=(\d+) destroyed=(\d+) source-kept=(\d+) heap-balanced=(\d+) '
    r'hooks-removed=(\d+) pool-balanced=(\d+) failure=(\d+) result=(pass|fail)$', re.M)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(manifest_path):
    manifest = json.loads(manifest_path.read_text())
    profile = Path(manifest['profile']).resolve()
    run = Path(manifest['fixture']).resolve()
    if (run.parent != (GAME / 'build').resolve() or
            not run.name.startswith('actor-arrival-fixture-stage-') or
            profile != run / 'frontier_0_0'):
        raise ValueError('Expected an owned isolated stage fixture profile')
    if manifest.get('nativeExitCode') != 0 or manifest.get('nativeSessionTerminal') is not True:
        raise ValueError('Verify only after observing the native session exit successfully')
    log_path = Path(manifest['log'])
    if log_path.stat().st_size > 5 * 1024 * 1024:
        raise ValueError('Unexpected diagnostic log size')
    log = log_path.read_text()
    rows = list(TRIAL.finditer(log))
    if len(rows) != 64:
        raise ValueError(f'Expected 64 completed actor trials, observed {len(rows)}')
    for i, row in enumerate(rows):
        values = list(map(int, row.groups()[:-1]))
        expected = [i, 1, i % 2, 1, 1, 1, 1, 1, 1, 1, 1, 0]
        if values != expected or row.group(13) != 'pass':
            raise ValueError(f'Actor trial {i} did not meet every private restoration invariant')
    required = [
        '[streaming] Stage rollback constructed=1 refused=1 private=1 destroyed=1 '
        'source-kept=1 heap-balanced=1 pool-balanced=1 hooks-removed=1 guard-clear=1 result=pass',
        '[streaming] Stage fixture completed trials=64 spatial-deferred=32 '
        'source-unchanged=1 counters-unchanged=1 result=pass',
        '[streaming] Stage fixture files-removed=1',
        '[streaming] Original load end result=00000000 visits=480',
        'guest exit code:    0', 'undeliverable calls: none', 'all expectations met',
    ]
    if any(text not in log for text in required) or 'result=fail' in log:
        raise ValueError('Missing successful actor/world/game completion evidence')
    symbols_path = GAME / 'build/recomp/gen/symbols.json'
    symbols = json.loads(symbols_path.read_text())
    if symbols['exe_sha256'] != PIN:
        raise ValueError('Translation catalogue does not match the pinned executable')
    primary = next(s for s in symbols['functions'] if s['addr'] == '005bfe50')
    if not (primary['hookable'] and primary['kind'] == 'entry' and
            primary['provenance'] == 'config'):
        raise ValueError('Original PRIMARY reader is not a configured hookable entry')
    source = Path(manifest['source'])
    for name, expected in manifest['sourceHashes'].items():
        if sha(source / name) != expected:
            raise ValueError('The source profile changed: ' + name)
        if name.endswith('.GMP') and sha(profile / name) != expected:
            raise ValueError('The fixture saved world changed: ' + name)
    frame_names = ['load_menu', 'fixed_loaded15', 'fixed_loaded30']
    frames = []
    for name in frame_names:
        path = run / 'frames' / f'smoke_{name}_present.ppm'
        with path.open('rb') as f:
            if f.readline() != b'P6\n' or f.readline() != b'800 600\n' or f.readline() != b'255\n':
                raise ValueError('Expected bounded 800x600 native frame: ' + name)
        if path.stat().st_size != len(b'P6\n800 600\n255\n') + 800 * 600 * 3:
            raise ValueError('Incomplete native frame: ' + name)
        frames.append(dict(name=name, size=path.stat().st_size, sha256=sha(path)))
    wasm = (GAME / 'build/web-site/majesty/MajestyRecomp.wasm').stat()
    return dict(
        qualified=True, scope='64 private original living vehicle UNIT-v2/PRIMARY-v9 '
        'restorations with empty original order banks, deferred registry/spatial exposure '
        'and original deletion in one isolated native loaded kingdom',
        trials=64, parentedTrials=32, parentlessSpatialDeferrals=32,
        originalPrimaryAndSecondaryRoundTripEqual=True,
        privateInputOwnSavedIdentityNormalizedToZero=True,
        parentedSerializationUsesReadOnlyRegisteredSourceContext=True,
        destinationParentResolutionQualified=False,
        originalEmptyOrderLoadTransferAndClear=True,
        heapAndPoolBaselinesRecoveredEachTrial=True,
        preRegistrationRefusalCleanupQualified=True,
        healthyRetryAfterStoppedConstructionQualified=True,
        sourceActorAndIdentityCountersPreserved=True, temporaryFilesRemoved=True,
        browserUsed=False, wasmBuildPerformed=False, crashResolved=False,
        populatedOrderIntegrationQualified=False, interruptedActorCleanupQualified=False,
        actorPublicationQualified=False, productionArrivalConsumptionQualified=False,
        continuousStreamingQualified=False, wholeBrowserResourceBoundQualified=False,
        independentWanGameplayQualified=False, goalCompleted=False,
        fixture=manifest, nativeFrames=frames,
        evidenceSha256={str(log_path.relative_to(ROOT)): sha(log_path),
                        str(symbols_path.relative_to(ROOT)): sha(symbols_path)},
        servedWasmIdentity=dict(size=wasm.st_size, inode=wasm.st_ino, mtimeNs=wasm.st_mtime_ns))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'output/native-actor-stage-observed.json')
    args = parser.parse_args()
    result = verify(args.manifest)
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ('qualified', 'trials', 'parentlessSpatialDeferrals',
                                           'continuousStreamingQualified', 'browserUsed')}))


if __name__ == '__main__':
    main()
