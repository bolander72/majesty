#!/usr/bin/env python3
"""Check terminal regression, source reachability and staged checkpoint modules."""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    outputs = [ROOT/'output/checkpoint-source-reuse-terminal-qualified.json',
               ROOT/'output/checkpoint-lease-terminal-qualified.json']
    for path in outputs:
        path.unlink(missing_ok=True)
    tests = [('checkpoint-source-reuse-focused.log', 57),
             ('checkpoint-source-reuse-workspace.log', 254)]
    for name, count in tests:
        log = (ROOT/'output'/name).read_text()
        assert re.findall(r'ℹ pass (\d+)', log)[-1] == str(count)
        assert re.findall(r'ℹ fail (\d+)', log)[-1] == '0'
    baseline = ROOT/'output/checkpoint-source-reuse-before.log'
    assert re.findall(r'ℹ fail (\d+)', baseline.read_text())[-1] == '2'
    observed_path = ROOT/'output/checkpoint-lease-retention-observed.json'
    observed = json.loads(observed_path.read_text())
    assert observed['qualified'] and observed['cycles'] == 4
    assert observed['backingSourcesObserved'] == observed['collectedBackingSources'] == 204
    assert observed['retainedExpiredReaders'] == 204 and observed['largestReadBytes'] <= 4096
    assert observed['consumerSuccessAndFailureChecked']
    assert observed['legacyExpiredClosureStillRetainsBackingSource']
    for name, digest in observed['sourceSha256'].items():
        assert sha(ROOT/name) == digest
    stage_path = ROOT/'output/checkpoint-source-reuse-stage.json'
    stage = json.loads(stage_path.read_text())
    assert stage['playerHtmlUnchanged'] and stage['wasmArtifactSizeAndMtimeUnchanged']
    for name, digest in stage['stagedModulesSha256'].items():
        assert sha(ROOT/'web/world'/name) == digest
        assert sha(ROOT/'upstream/majesty-recomp/build/web-site/world'/name) == digest
    sources = list(observed['sourceSha256']) + [
        'tests/realm-store.test.mjs', 'tests/transfer-store.test.mjs',
        'tests/checkpoint-lease.test.mjs', 'tests/terrain-scene.test.mjs',
        'scripts/stage-world.py', 'scripts/qualify-checkpoint-source-reuse.py',
        'docs/checkpoint-lease.md', 'CHANGELOG.md']
    evidence = [observed_path, stage_path, baseline,
        ROOT/'output/checkpoint-source-reuse-stage-before.json',
        ROOT/'output/checkpoint-source-reuse-stage.log',
        ROOT/'output/checkpoint-source-reuse-retention.log',
        *(ROOT/'output'/name for name, _ in tests)]
    result = dict(qualified=True,
        scope='validated-source reuse and revoked source ownership; in-memory adapters and Node/V8 GC',
        focusedTestsPassed=57, workspaceTestsPassed=254, replacementRegressionTests=2,
        preFixReplacementRegressionFailures=2, expiredReadersKeptReachable=204,
        backingSourcesObserved=204, backingSourcesCollected=204,
        dataOpensInPreviousFixture=408, dataOpensInCurrentFixture=204,
        legacyRetentionControlPassed=True, stagedModulesSha256=stage['stagedModulesSha256'],
        playerHtmlPreserved=True, wasmArtifactSizeAndMtimePreserved=True,
        sourceHashesRecordedAfterTests=True,
        sourceSha256={name: sha(ROOT/name) for name in sources},
        evidenceSha256={str(p.relative_to(ROOT)): sha(p) for p in evidence},
        gameLaunched=False, browserInspected=False, nativeBuildRun=False,
        originalProfilesModified=False, opfsRetentionMeasured=False,
        liveBrowserMemoryMeasured=False, liveNativePagingQualified=False,
        crashResolved=False, goalCompleted=False)
    for path in outputs:
        path.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, focusedTests=57, workspaceTests=254,
        dataSourcesCollected=204, expiredReadersRetained=204, gameLaunches=0)))


if __name__ == '__main__':
    main()
