#!/usr/bin/env python3
"""Verify build-policy configuration, modeled growth and preserved game artifact."""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    output = ROOT/'output/web-memory-policy-terminal-qualified.json'
    output.unlink(missing_ok=True)
    config_path = ROOT/'output/web-memory-policy-config-observed.json'
    model_path = ROOT/'output/conservative-growth-policy-observed.json'
    config, model = json.loads(config_path.read_text()), json.loads(model_path.read_text())
    assert config['qualified'] and model['qualified']
    assert config['defaultPolicy'] == 'legacy' and config['cmakeScriptRuns'] == 2
    assert config['policies']['conservative']['step'] == 0.05
    assert config['policies']['conservative']['excessCapBytes'] == 16777216
    assert model['cases'] == 8 and model['testOnlyConstantsSubstituted'] and not model['servedGlueEdited']
    assert model['modeledFirstAttemptReductionBytes'] == 83886080
    assert model['policies']['conservative']['first']['attemptedCapacitiesBytes'] == [553713664]
    assert model['policies']['legacy']['first']['attemptedCapacitiesBytes'] == [637599744]
    retries = model['policies']['conservative']['retry']['attemptedCapacitiesBytes']
    assert len(retries) == 3 and all(retries[i] < retries[i-1] for i in (1, 2))
    for observed in (config, model):
        for path, digest in observed['sourceSha256'].items():
            assert sha(ROOT/path) == digest
    for path, digest in model['evidenceSha256'].items():
        assert sha(ROOT/path) == digest
    kit = ROOT/'upstream/majesty-recomp/kit'
    tests = [(kit/'build/web-memory-build-tests.log', 17), (kit/'build/web-memory-policy-tests.log', 2)]
    for path, count in tests:
        text = path.read_text()
        assert re.search(r'Ran '+str(count)+r' tests in ', text) and '\nOK\n' in text
        assert '\nFAILED' not in text
    help_path = ROOT/'output/web-memory-policy-cli-help.log'
    assert '--web-memory-growth {legacy,conservative}' in help_path.read_text()
    before_path = ROOT/'output/web-memory-policy-artifact-before.json'
    before = json.loads(before_path.read_text())
    identity = before['artifactIdentity']
    stat = (ROOT/identity['path']).stat()
    assert (stat.st_ino, stat.st_size, stat.st_mtime_ns) == (identity['inode'], identity['size'], identity['mtimeNs'])
    glue = 'upstream/majesty-recomp/build/web-site/majesty/MajestyRecomp.js'
    assert sha(ROOT/glue) == before['glueSha256']
    sources = list(config['sourceSha256'])+list(model['sourceSha256'])+[
        'upstream/majesty-recomp/kit/tests/test_build_py.py',
        'upstream/majesty-recomp/kit/tests/test_web_memory_policy.py',
        'upstream/majesty-recomp/kit/README.md', 'upstream/majesty-recomp/kit/CHANGELOG.md',
        'scripts/qualify-web-memory-policy.py', 'docs/conservative-web-memory.md', 'CHANGELOG.md']
    evidence = [config_path, model_path, help_path, before_path, *(path for path, _ in tests),
        ROOT/'output/web-memory-policy-config.log', ROOT/'output/conservative-growth-policy.log']
    result = dict(qualified=True, scope='build-option wiring, CMake function evaluation and test-only numeric growth model',
        buildToolTestsPassed=17, cmakePolicyTestsPassed=2, modeledGrowthCasesPassed=8,
        conservativeStep=0.05, conservativeExcessCapBytes=16777216,
        modeledFirstAttemptBytes=553713664, modeledFirstAttemptReductionBytes=83886080,
        retryCapacitiesDecrease=True, defaultPolicy='legacy', officialGameWrapperHelpChecked=True,
        servedGlueHashUnchanged=True, servedWasmSizeMtimeAndInodeUnchanged=True,
        compiledConservativePolicyQualified=False, gameplayPerformanceQualified=False,
        realWasmMemoryAllocated=False, hostProjectConfigured=False, nativeBuildRun=False,
        gameLaunched=False, browserUsed=False, originalProfilesModified=False,
        browserMemoryMeasured=False, liveNativePagingQualified=False, crashResolved=False, goalCompleted=False,
        sourceSha256={name: sha(ROOT/name) for name in dict.fromkeys(sources)},
        evidenceSha256={str(path.relative_to(ROOT)): sha(path) for path in evidence})
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, buildToolTests=17, cmakePolicyTests=2,
        modeledGrowthCases=8, modeledFirstAttemptMiB=528.0625, nativeBuildRun=False)))


if __name__ == '__main__':
    main()
