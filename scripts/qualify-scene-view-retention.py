#!/usr/bin/env python3
"""Check current scene-view tests, Node reachability evidence and staged sources."""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    output = ROOT/'output/scene-view-terminal-qualified.json'
    output.unlink(missing_ok=True)
    observed_path = ROOT/'output/scene-view-retention-observed.json'
    observed = json.loads(observed_path.read_text())
    assert observed['qualified']
    assert observed['retainedRetiredViews'] == 4 and observed['retainedIterators'] == 20
    assert observed['retainedBoundMethods'] == 8 and observed['retainedProviderCallbacks'] == 5
    assert observed['collectedRetiredBackingBuffers'] == 392 and observed['currentBackingBuffersReachableBeforeClose'] == 98
    assert observed['closedSceneBackingBuffersCollected'] == 196 and observed['totalBackingBuffersCollectedAfterClose'] == 588
    assert observed['retainedViewsAfterClose'] == 5 and observed['retainedIteratorsAfterClose'] == 25
    assert observed['retainedBoundMethodsAfterClose'] == 10 and observed['retainedProviderCallbacksAfterClose'] == 6
    assert observed['closeDrainedSnapshotCleanup'] and observed['closedSceneIteratorsNotAdvancedUntilAfterGarbageCollection']
    assert observed['retiredIteratorsNotAdvancedUntilAfterGarbageCollection']
    assert observed['capturedMapControlStillRetainsValue'] and observed['clearedRawIteratorControlStillRetainsValue']
    assert 1 <= observed['gcPasses'] <= 8
    assert 1 <= observed['closeGcPasses'] <= 8
    assert observed['sceneResidentBytesHighWater'] <= 1462258
    for name, digest in observed['sourceSha256'].items():
        assert sha(ROOT/name) == digest
    tests = {}
    for name, expected in [('scene-close-focused.log', 35), ('scene-close-workspace-tests.log', 247)]:
        text = (ROOT/'output'/name).read_text()
        matches = re.findall(r'ℹ pass (\d+)', text)
        assert matches and int(matches[-1]) == expected and 'ℹ fail 0' in text
        tests[name] = expected
    regression_path = ROOT/'output/checkpoint-lease-retention-observed.json'
    regression = json.loads(regression_path.read_text())
    assert regression['collectedBackingSources'] == 204 and regression['retainedExpiredReaders'] == 204
    for name, digest in regression['sourceSha256'].items():
        assert sha(ROOT/name) == digest
    stage_path = ROOT/'output/scene-view-stage.json'
    stage = json.loads(stage_path.read_text())
    assert stage['playerHtmlUnchanged'] and stage['wasmArtifactSizeAndMtimeUnchanged']
    for name, digest in stage['stagedModulesSha256'].items():
        assert sha(ROOT/'web/world'/name) == sha(ROOT/'upstream/majesty-recomp/build/web-site/world'/name) == digest
    for flag in ['browserInspected', 'opfsAccessed', 'gameLaunched', 'nativeBuildRun',
                 'browserMemoryMeasured', 'crashResolved', 'liveNativePagingQualified']:
        assert observed[flag] is False
    sources = ['web/world/scene-view.mjs', 'web/world/terrain-scene.mjs', 'web/world/view.mjs',
        'tests/terrain-scene.test.mjs', 'tests/native-atlas.test.mjs',
        'scripts/check-scene-view-retention.mjs', 'scripts/qualify-scene-view-retention.py']
    evidence = [observed_path, regression_path, stage_path,
        ROOT/'output/scene-close-focused.log', ROOT/'output/scene-close-workspace-tests.log',
        ROOT/'output/scene-view-retention.log', ROOT/'output/checkpoint-source-reuse-retention.log']
    result = dict(qualified=True, scope='scene-owned JavaScript views and Node/V8 retired-buffer reachability',
        focusedTestsPassed=35, workspaceTestsPassed=247, sceneTestLogsAreHistorical=True,
        collectedRetiredBackingBuffers=392,
        retainedRetiredViews=4, retainedIterators=20, retainedBoundMethods=8, retainedProviderCallbacks=5,
        currentBackingBuffersReachableBeforeClose=98, unadvancedIteratorRetentionChecked=True,
        closedSceneBackingBuffersCollected=196, totalBackingBuffersCollectedAfterClose=588,
        retainedViewsAfterClose=5, retainedIteratorsAfterClose=25, retainedBoundMethodsAfterClose=10,
        retainedProviderCallbacksAfterClose=6, closeDrainedSnapshotCleanup=True,
        closedSceneUnadvancedIteratorRetentionChecked=True,
        atlasModeSwitchClosesPreviousScene=True, queuedAndInFlightCloseTested=True,
        clearedRawMapIteratorNegativeControlPassed=True, failedHandoffAndOverlapReuseTested=True,
        checkpointBackingSourcesStillCollected=204, stagedModulesSha256=stage['stagedModulesSha256'],
        playerHtmlPreserved=True, wasmArtifactSizeAndMtimePreserved=True,
        sourceSha256={name: sha(ROOT/name) for name in sources},
        evidenceSha256={str(p.relative_to(ROOT)): sha(p) for p in evidence},
        gameLaunched=False, browserInspected=False, nativeBuildRun=False, opfsAccessed=False,
        browserMemoryMeasured=False, originalProfilesModified=False,
        liveNativePagingQualified=False, crashResolved=False, goalCompleted=False)
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, workspaceTests=247, collectedRetiredBackingBuffers=392,
        totalBackingBuffersCollectedAfterClose=588, unadvancedIteratorsRetained=25, gameLaunches=0)))


if __name__ == '__main__':
    main()
