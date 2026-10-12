#!/usr/bin/env python3
"""Freeze current native sampling/crossing inputs; do not copy game assets."""
import hashlib,json,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/hero-native-crossing-generation-306'
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(4096),b''):h.update(block)
    return h.hexdigest()
def data(name):
    path=ROOT/name;assert path.stat().st_size<256*1024
    return json.loads(path.read_text())
def main():
    assert not OUT.exists(),'Preserve earlier snapshots'
    build=data('output/native-world-residency-build-306.json');assert build['nativeBuildQualified'] and build['exitCode']==0
    compiled={}
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for name,digest in build[group].items():assert name not in compiled and sha(ROOT/name)==digest;compiled[name]=digest
    assert len(compiled)==54
    assert sha(ROOT/'upstream/majesty-recomp/build/recomp/pop_smoke')==build['nativeExecutableSha256']
    assert sha(ROOT/'upstream/majesty-recomp/build/recomp/gen/symbols.json')==build['nativeSymbolsSha256']
    for attempt in [12,13,14]:
        proof=data(f'output/native-hero-binding-attempt-{attempt:03}.json')
        assert proof['nativeSessionTerminal'] and proof['nativeExitCode']==0 and proof['ownedProducerAbsent'] and proof['stopReason'] is None
        assert proof['compiledSourceSha256']==compiled
        try:os.kill(proof['nativePid'],0)
        except ProcessLookupError:pass
        else:raise AssertionError('Native producer is live')
        assert sha(Path(proof['log']))==proof['logSha256']
        if attempt==12:assert not proof['selectedHeroBindingTrialQualified'] and proof['nativeHeroSaveHandshakeQualified']
        else:assert proof['selectedHeroBindingTrialQualified']
        if attempt==13:
            assert proof['nativeSelectedHaloMotionQualified'] and len(proof['nativeHaloMotionSamples'])==4
            assert proof['nativeHeroSaveHandshakeQualified'] and proof['heldSave']['clock']==115550
            assert sha(Path(proof['heldSave']['checkpoint']['filename']))==proof['heldSave']['sha256']
        if attempt==14:assert proof['wrongHalo']
    startup=data('output/hero-route-startup-original-013.json')
    assert startup['originalHaloStartupLayoutQualified'] and startup['originalJournalUnchanged']
    for name,digest in startup['sourceSha256'].items():assert sha(ROOT/name)==digest
    live=data('output/hero-live-save-original-007.json')
    assert live['originalNativeHeldCheckpointLivePublicationQualified'] and live['worldLeaseRetained'] and live['originalFilesUnchanged']
    assert live['publication']['ownerRevision']==1 and live['publication']['clock']==115550
    assert live['isolatedStartingRevision']==0 and live['privateVerifiedSeedSelected']
    assert live['crossingRefusal']['physicalParentRefusalQualified'] and live['crossingRefusal']['additionalWrites']==0
    assert live['stats']['activeIO']==0 and live['stats']['peakIO']==1
    assert live['travel']['originalNativeHeldPairLayoutQualified'] and live['travel']['additionalWrites']==0
    log=(ROOT/'output/hero-native-crossing-regression-002.log').read_text()
    assert 'ℹ pass 225\nℹ fail 0\n' in log and 'ℹ skipped 0\n' in log
    overlay=data('output/hero-native-crossing-site-001/manifest.json')
    assert overlay['stagingIdempotent'] and not overlay['browserUsed'] and not overlay['wasmIncluded']
    for name,digest in overlay['files'].items():assert sha(ROOT/'output/hero-native-crossing-site-001'/name)==digest
    for name,digest in overlay['servedPagesUnchanged'].items():assert sha(ROOT/name)==digest
    previous=data('output/hero-travel-boundary-generation-304/manifest.json')
    sources={str(Path(r['source']).relative_to(ROOT)) for r in previous['sources']}
    sources.update(['docs/hero-native-crossing.md','scripts/preserve-hero-native-crossing.py'])
    evidence=['output/hero-native-crossing-focused-001.log','output/hero-native-crossing-regression-001.log',
        'output/hero-native-crossing-regression-002.log','output/native-world-residency-build-305.json',
        'output/native-world-residency-build-306.json','output/hero-route-startup-original-013.json',
        'output/hero-route-startup-original-013.tests.log','output/hero-live-save-original-007.json',
        'output/hero-live-save-original-007.tests.log','output/hero-native-crossing-site-001/manifest.json']
    for n in [12,13,14]:evidence.extend([f'output/native-hero-binding-attempt-{n:03}.json',f'output/native-hero-binding-attempt-{n:03}.log'])
    OUT.mkdir()
    def preserve(name,kind):
        source=ROOT/name;assert source.is_relative_to(ROOT) and '/original/' not in name and not name.startswith('../')
        assert 0<source.stat().st_size<8*1024*1024
        target=OUT/kind/name;target.parent.mkdir(parents=True,exist_ok=True)
        with source.open('rb') as f,target.open('xb') as out:
            for block in iter(lambda:f.read(4096),b''):out.write(block)
        digest=sha(source);assert sha(target)==digest
        return dict(kind=kind,source=str(source),preserved=str(target),sha256=digest,bytes=source.stat().st_size)
    manifest=dict(version=1,sources=[preserve(n,'source') for n in sorted(sources)],evidence=[preserve(n,'evidence') for n in evidence],
        compiledInputs=54,compiledSourceSha256=compiled,nativeSelectedHaloMotionQualified=True,nativeWrongHaloRefusalQualified=True,
        nativeManualSaveResumeQualified=True,controlledJavascriptCrossingHoldTestsQualified=True,javascriptTestsPassed=225,
        originalLivePublicationReplayQualified=True,browserUsed=False,liveBrowserPublicationQualified=False,
        actualNativeBoundaryCrossingQualified=False,destinationActivationQualified=False,ownershipTransferQualified=False,
        cooperativeMatchesQualified=False,independentInternetMatchesQualified=False,goalComplete=False)
    with (OUT/'manifest.json').open('x') as f:json.dump(manifest,f,indent=2);f.write('\n')
    print(json.dumps(dict(sources=len(manifest['sources']),evidence=len(manifest['evidence']),compiledInputs=54,browserUsed=False,goalComplete=False)))
if __name__=='__main__':main()
