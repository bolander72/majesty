#!/usr/bin/env python3
"""Qualify current pinned CPU evidence without rerunning original instructions."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-rectangle-collector.py'
spec = importlib.util.spec_from_file_location('collector_audit', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    output = ROOT/'output/native-rectangle-collector-terminal-qualified.json'
    output.unlink(missing_ok=True)
    audit_path = ROOT/'output/native-rectangle-collector-audit.json'
    cpu_path = ROOT/'output/native-rectangle-collector-emulated-observed.json'
    audit = json.loads(audit_path.read_text())
    assert audit == module.audit(ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')
    with tempfile.TemporaryDirectory(prefix='collector-pin-') as directory:
        fixture = Path(directory)/'unpinned.exe'
        fixture.write_bytes(b'MZ'+b'\0'*30)
        with patch.object(module.pefile, 'PE', side_effect=AssertionError('Unpinned PE decoded')) as decode:
            try:
                module.audit(fixture)
            except ValueError as error:
                assert 'pinned executable' in str(error)
            else:
                raise AssertionError('Unpinned input accepted')
            assert decode.call_count == 0
    cpu = json.loads(cpu_path.read_text())
    assert cpu['executableSha256'] == audit['executableSha256'] == module.PIN
    assert cpu['verifiedInstructionAnchors'] == audit['verifiedInstructionAnchors'] == 13
    assert set(cpu['sourceSha256']) == {'scripts/audit-native-rectangle-collector.py',
        'scripts/check-native-rectangle-collector.py', 'scripts/audit-native-listener-rectangles.py'}
    for name, digest in cpu['sourceSha256'].items():
        assert sha(ROOT/name) == digest
    assert cpu['originalInstructionsExecuted'] and cpu['noAllocatorOrImportStubs']
    assert cpu['calls'] == 774 and cpu['directSplitterCalls'] == 32
    assert len(cpu['cases']) == 6 and {(c['mode'], c['bank']) for c in cpu['cases']} == {
        (mode, bank) for mode in [0, 1, 2] for bank in [0, 1]}
    assert all(c['updates'] == 64 and c['largestCount'] <= 50 for c in cpu['cases'])
    assert all(c['largestCallInstructions'] < cpu['maxCallInstructions'] for c in cpu['cases'])
    assert len(cpu['directedCases']) == 2 and {c['mode'] for c in cpu['directedCases']} == {1, 2}
    assert cpu['totalInstructions'] < cpu['maxTotalInstructions'] == 2_000_000
    assert cpu['guestMappedBytes'] == 36864
    assert cpu['maximumObservedRecursionDepth'] == 2 < cpu['maximumAllowedRecursionDepth'] == 16
    for flag in ['syntheticBufferOwnershipQualified', 'deterministicReplay', 'stackPoisonReplay',
                 'inputAndInactiveBankUnchanged', 'bufferCanariesUnchanged', 'fullCountFallbackQualified',
                 'emptyRectangleCopiesInputExactly', 'allSplitterSwitchTargetsVisited',
                 'sampledSplitterCoverageMatchesIndependentOracle']:
        assert cpu[flag]
    assert set(cpu['visitedSplitterTargets']) == set(audit['splitterSwitch']['targets'])
    assert len(cpu['directSplitterCases']) == 16
    assert {c['mask'] for c in cpu['directSplitterCases']} == set(range(16))
    assert all(c['count'] <= 4 and c['instructions'] < cpu['maxCallInstructions'] for c in cpu['directSplitterCases'])
    bad_bank, bad_count = cpu['invalidStateCases']
    assert bad_bank['bank'] == 2 and 'read outside owned fixture' in bad_bank['reason']
    assert bad_count['count'] == 51 and 'wrote outside owned buffers' in bad_count['reason']
    assert all(c['fixtureStoppedAccess'] for c in cpu['invalidStateCases'])
    assert cpu['invalidStatesStoppedByFixtureNotOriginalCode']
    assert cpu['ownershipAndCanaryAssertionsScope'] == 'completed valid-input collector calls only'
    for flag in ['allNumericGeometryQualified', 'allRecursionBoundQualified', 'liveBufferBoundsQualified',
                 'actorReferenceRetentionExcluded', 'boundedNativeSimulationQualified', 'liveNativePagingQualified',
                 'crashResolved']:
        assert cpu[flag] is False
    assert cpu['gameLaunches'] == cpu['browserLaunches'] == cpu['builds'] == 0
    source_paths = [AUDITOR, ROOT/'scripts/check-native-rectangle-collector.py', Path(__file__).resolve(),
        module.DEPENDENCY, ROOT/'scripts/audit-native-notification-lifetime.py',
        ROOT/'scripts/audit-native-placement-callbacks.py', ROOT/'scripts/audit-native-placement-dispatch.py']
    result = dict(qualified=True, scope='original collector on bounded synthetic drawing buffers only',
        executableSha256=module.PIN, completedOriginalCpuCalls=806, invalidCpuStartsStoppedByFixture=2,
        collectorCalls=774, splitterCalls=32, sampledSwitchMasks=16,
        sampledSplitterCoverageMatchesIndependentOracle=True,
        deterministicReplay=True, stackPoisonReplay=True, validCallsRespectOwnedBuffers=True,
        totalInstructions=cpu['totalInstructions'], guestMappedBytes=cpu['guestMappedBytes'],
        maximumObservedRecursionDepth=2, unpinnedInputRejectedBeforePeDecode=True,
        originalCodeRejectsInvalidState=False, nativeInstructionsExecutedByQualifier=False,
        allNumericGeometryQualified=False, liveBufferBoundsQualified=False,
        boundedNativeSimulationQualified=False, liveNativePagingQualified=False,
        gameLaunches=0, browserLaunches=0, builds=0, crashResolved=False, goalCompleted=False,
        sourceSha256={str(p.relative_to(ROOT)): sha(p) for p in source_paths},
        evidenceSha256={str(p.relative_to(ROOT)): sha(p) for p in [audit_path, cpu_path]})
    output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(dict(passed=True, originalCpuCalls=806, invalidStateStartsStoppedByFixture=2,
        sampledSwitchMasks=16, guestMappedBytes=36864, liveBufferBoundsQualified=False, gameLaunches=0)))


if __name__ == '__main__':
    main()
