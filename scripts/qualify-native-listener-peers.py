#!/usr/bin/env python3
"""Check current peer CPU evidence; qualification itself executes no x86."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
AUDITOR = ROOT/'scripts/audit-native-listener-cache.py'
PROBE = ROOT/'scripts/check-native-listener-peers.py'
spec = importlib.util.spec_from_file_location('peer_qualifier_audit', AUDITOR)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    output=ROOT/'output/native-listener-peers-terminal-qualified.json'
    output.unlink(missing_ok=True)
    audit_path=ROOT/'output/native-listener-cache-audit.json'
    cpu_path=ROOT/'output/native-listener-peers-emulated-observed.json'
    audit=json.loads(audit_path.read_text());observed=json.loads(cpu_path.read_text())
    exe=ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'
    assert audit==module.audit(exe)
    assert sha(exe)==observed['executableSha256']==module.PIN
    assert observed['instructionAuditSha256']==sha(audit_path)
    for name,digest in observed['sourceSha256'].items():assert sha(ROOT/name)==digest,name
    with tempfile.TemporaryDirectory(prefix='peer-cpu-pin-') as directory:
        fixture=Path(directory)/'unpinned.exe';fixture.write_bytes(b'MZ'+b'\0'*30)
        with patch.object(module.pefile,'PE',side_effect=AssertionError('Unpinned PE decoded')) as decode:
            try:module.audit(fixture)
            except ValueError as error:assert 'pinned executable' in str(error)
            else:raise AssertionError('Unpinned input accepted')
            assert decode.call_count==0
    assert observed['qualified'] and observed['originalInstructionsExecuted']
    assert observed['mappedGuestBytesPerFixture']==observed['peakMappedGuestBytes']==36864
    assert sum(m['bytes'] for m in observed['mappings'])==36864 and len(observed['mappings'])==8
    assert observed['finalMappedGuestBytes']==0 and observed['fixturesExplicitlyClosed']==6
    assert observed['cyclesPerReplay']==32 and observed['poisonReplays']==2
    assert observed['positiveCalls']==512
    assert observed['positiveNodeAllocations']==observed['positiveNodeFrees']==384
    metrics=observed['metrics']
    assert metrics['completedCalls']==523
    assert metrics['modeledAllocatorCalls']==390 and metrics['modeledFreeCalls']==387
    assert metrics['modeledAllocatorCalls']-metrics['modeledFreeCalls']==metrics['fixtureDisposedNegativeNodes']==3
    assert metrics['positiveOwnedBytesHighWater']==72
    assert metrics['fixturesCreated']==metrics['fixturesClosed']==6
    assert metrics['liveMappedGuestBytes']==0 and metrics['peakMappedGuestBytes']==36864
    assert 0<metrics['originalInstructions']<=observed['maxTotalInstructions']==500000
    assert 0<metrics['maxCallInstructions']<=observed['maxCallInstructions']==5000
    assert 0<metrics['maximumStackBytesUsed']<=256
    assert observed['maxCallTimeMicros']==200000 and observed['nullPeerCalls']==2
    assert len(observed['negativeControls'])==3
    assert [c['label'] for c in observed['negativeControls']]==[
        'existing-forward-link-does-not-repair-reverse',
        'missing-forward-unlink-leaves-reverse',
        'three-forward-one-reverse-duplicate-unlink-leaves-forward']
    assert all(c['remainingModeledNodes']==1 and c['asymmetricMembershipRemains'] for c in observed['negativeControls'])
    for flag in ['repeatedLinkDoesNotAllocateAnotherPeerNode','unrelatedPeersPreserved',
        'opaqueCacheImagesPreserved','allOtherObjectFieldsPreserved','allocatorFencesPreserved',
        'poisonReplayLogicalGraphsMatch','negativeCasesAreNotAutomaticallyRepaired']:
        assert observed[flag] is True
    for flag in ['allocatorFailureQualified','fullListenerDestructionClosureQualified',
        'actorReferenceRetentionExcluded','liveNativePagingQualified','browserUsed','gameLaunched',
        'nativeBuildRun','originalProfilesModified','browserMemoryMeasured','crashResolved','goalCompleted']:
        assert observed[flag] is False
    sources=[ROOT/name for name in observed['sourceSha256']]+[Path(__file__).resolve()]
    evidence=[audit_path,cpu_path,ROOT/'output/native-listener-peers-emulation.log',
        ROOT/'docs/native-listener-peers.md']
    result=dict(qualified=True,scope='original peer methods with synthetic ownership and modeled allocation',
        completedOriginalCalls=523,originalInstructions=metrics['originalInstructions'],
        positiveCalls=512,positiveNodeAllocations=384,positiveNodeFrees=384,
        positiveOwnedNodeBytesHighWater=72,peakMappedGuestBytes=36864,finalMappedGuestBytes=0,
        fixtureMappingsExplicitlyReleased=True,poisonReplays=2,unrelatedPeersAndCachesPreserved=True,
        allocatorFenceChecksPassed=True,asymmetricOrDuplicateResidualCases=3,
        negativeResidualNodesDisposedByFixture=3,negativeResidualNodesFreedByOriginal=False,
        cdeclAllocatorAndVolatileClobbersModeled=True,originalAllocatorQualified=False,
        unpinnedInputRejectedBeforePeDecode=True,isolatedOriginalInstructionsExecuted=True,
        qualifierExecutesOriginalInstructions=False,
        sourceSha256={str(p.relative_to(ROOT)):sha(p) for p in sources},
        evidenceSha256={str(p.relative_to(ROOT)):sha(p) for p in evidence},
        completeDetachQualified=False,fullListenerDestructionClosureQualified=False,
        actorReferenceRetentionExcluded=False,liveNativePagingQualified=False,
        gameLaunched=False,browserUsed=False,nativeBuildRun=False,originalProfilesModified=False,
        browserMemoryMeasured=False,crashResolved=False,goalCompleted=False)
    output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(dict(passed=True,originalCalls=523,positiveNodeFrees=384,
        peakMappedGuestBytes=36864,negativeResidualCases=3,gameLaunches=0)))


if __name__=='__main__':main()
