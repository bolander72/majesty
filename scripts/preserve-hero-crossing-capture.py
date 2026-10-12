#!/usr/bin/env python3
"""Freeze qualified actual native capture and controlled JS replay; no game assets."""
import hashlib,json,os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/hero-crossing-capture-generation-307'
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(4096),b''):h.update(block)
    return h.hexdigest()
def data(name):
    path=ROOT/name
    assert path.stat().st_size<256*1024
    return json.loads(path.read_text())
def main():
    assert not OUT.exists(),'Preserve existing evidence'
    build=data('output/native-world-residency-build-307.json')
    assert build['nativeBuildQualified'] and build['exitCode']==0
    compiled={}
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for name,digest in build[group].items():
            assert name not in compiled and sha(ROOT/name)==digest
            compiled[name]=digest
    assert len(compiled)==54
    assert sha(ROOT/'upstream/majesty-recomp/build/recomp/pop_smoke')==build['nativeExecutableSha256']
    assert sha(ROOT/'upstream/majesty-recomp/build/recomp/gen/symbols.json')==build['nativeSymbolsSha256']
    for number in [15,16,17,18]:
        attempt=data(f'output/native-hero-binding-attempt-{number:03}.json')
        assert attempt['nativeSessionTerminal'] and attempt['nativeExitCode']==0 and attempt['ownedProducerAbsent']
        assert attempt['stopReason'] is None and attempt['compiledSourceSha256']==compiled
        try:os.kill(attempt['nativePid'],0)
        except ProcessLookupError:pass
        else:raise AssertionError('Native process still live')
        assert sha(Path(attempt['log']))==attempt['logSha256']
        assert attempt['preservedBefore']==attempt['preservedAfter']
        assert attempt['sourceCheckpointUnchanged'] and attempt['startupFixtureUnchanged']
        if number<17:
            assert not attempt['nativeSelectedHeroCrossingQualified'] and not attempt['selectedHeroBindingTrialQualified']
        else:
            assert attempt['selectedHeroBindingTrialQualified'] and attempt['nativeHeroSaveHandshakeQualified']
            assert sha(Path(attempt['heldSave']['checkpoint']['filename']))==attempt['heldSave']['sha256']
        if number==17:
            assert attempt['nativeSelectedHeroCrossingQualified'] and attempt['nativeCrossing']['clock']==103500
            assert attempt['heldSave']['clock']==103500
    startup=data('output/hero-crossing-source-original-001.json')
    assert startup['originalSelectedCrossingSourceStartupQualified'] and startup['sourceCheckpointUnchanged']
    for name,digest in startup['sourceSha256'].items():assert sha(ROOT/name)==digest
    for key in ['sourceCheckpoint','producerOriginalCheckpoint']:
        assert sha(Path(startup[key]['filename']))==startup[key]['sha256']
    crossing=data('output/hero-live-save-original-008.json')
    manual=data('output/hero-live-save-original-009.json')
    assert crossing['originalNativeCrossingCapturePublicationQualified']
    assert not manual['originalNativeCrossingCapturePublicationQualified']
    assert crossing['crossingRefusal']['savedPositionRefusalQualified']
    assert manual['crossingRefusal']['physicalParentRefusalQualified']
    for live,number in [(crossing,17),(manual,18)]:
        assert live['originalNativeHeldCheckpointLivePublicationQualified'] and live['originalFilesUnchanged']
        assert live['worldLeaseRetained'] and live['publication']['ownerRevision']==1
        assert live['stats']['activeIO']==0 and live['stats']['peakIO']==1
        assert live['crossingRefusal']['additionalWrites']==0
        assert live['travel']['originalNativeHeldPairLayoutQualified'] and live['travel']['additionalWrites']==0
        assert live['nativeAttempt']['sha256']==sha(ROOT/f'output/native-hero-binding-attempt-{number:03}.json')
    assert crossing['publication']['travel']['savedActorPositionVerified']
    assert crossing['publication']['clock']==103500
    previous=data('output/hero-native-crossing-generation-306/manifest.json')
    sources={str(Path(row['source']).relative_to(ROOT)) for row in previous['sources']}
    sources.update(['tests/hero-crossing-source-original.test.mjs','scripts/preserve-hero-crossing-capture.py'])
    evidence=['output/native-world-residency-build-307.json','output/native-world-residency-build-307.log',
        'output/hero-crossing-source-original-001.json','output/hero-crossing-source-original-001.tests.log',
        'output/hero-live-save-original-008.json','output/hero-live-save-original-008.tests.log',
        'output/hero-live-save-original-009.json','output/hero-live-save-original-009.tests.log',
        'output/hero-native-crossing-regression-002.log']
    for number in [15,16,17,18]:
        evidence.extend([f'output/native-hero-binding-attempt-{number:03}.json',f'output/native-hero-binding-attempt-{number:03}.log'])
    OUT.mkdir()
    def preserve(name,kind):
        source=ROOT/name
        assert source.is_relative_to(ROOT) and '/original/' not in name and not name.startswith('../')
        assert source.is_file() and 0<source.stat().st_size<8*1024*1024
        target=OUT/kind/name;target.parent.mkdir(parents=True,exist_ok=True)
        with source.open('rb') as src,target.open('xb') as dst:
            for block in iter(lambda:src.read(4096),b''):dst.write(block)
        digest=sha(source);assert sha(target)==digest
        return dict(source=str(source),preserved=str(target),sha256=digest,bytes=source.stat().st_size)
    manifest=dict(version=1,sources=[preserve(name,'source') for name in sorted(sources)],
        evidence=[preserve(name,'evidence') for name in evidence],compiledInputs=54,compiledSourceSha256=compiled,
        actualNativeBoundaryCrossingCaptureQualified=True,originalCrossingCheckpointPublicationReplayQualified=True,
        originalManualCheckpointPublicationReplayQualified=True,contentFingerprintControlled=True,browserUsed=False,
        realBrowserPublicationQualified=False,destinationActivationQualified=False,sourceRetirementQualified=False,
        ownershipTransferQualified=False,cooperativeMatchesQualified=False,independentInternetMatchesQualified=False,
        goalComplete=False)
    with (OUT/'manifest.json').open('x') as stream:json.dump(manifest,stream,indent=2);stream.write('\n')
    print(json.dumps(dict(sources=len(manifest['sources']),evidence=len(manifest['evidence']),
        actualNativeBoundaryCrossingCaptureQualified=True,browserUsed=False,goalComplete=False)))
if __name__=='__main__':main()
