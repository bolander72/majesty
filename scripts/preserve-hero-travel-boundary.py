#!/usr/bin/env python3
"""Freeze current crossing-save inputs and bounded evidence without game assets."""
import hashlib,json,os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/hero-travel-boundary-generation-304'
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
    build=data('output/native-world-residency-build-304.json')
    assert build['nativeBuildQualified'] and build['exitCode']==0
    compiled={}
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for name,digest in build[group].items():
            assert name not in compiled and sha(ROOT/name)==digest;compiled[name]=digest
    assert len(compiled)==54
    assert sha(ROOT/'upstream/majesty-recomp/build/recomp/pop_smoke')==build['nativeExecutableSha256']
    startup=data('output/hero-route-startup-original-012.json')
    assert startup['originalHaloStartupLayoutQualified'] and startup['originalJournalUnchanged']
    for name,digest in startup['sourceSha256'].items():assert sha(ROOT/name)==digest
    for receipt in [startup['receipt'],startup['continuation']['resumed']]:
        assert receipt['haloLayout']['verifiedVertices']==16641 and receipt['haloLayout']['sharedVertices']==2480
    live=data('output/hero-live-save-original-006.json');refusal=live['crossingRefusal'];travel=live['travel']
    assert live['originalNativeHeldCheckpointLivePublicationQualified'] and live['worldLeaseRetained'] and live['originalFilesUnchanged']
    assert refusal['forgedCrossingPublicationRefused'] and refusal['physicalParentRefusalQualified'] and refusal['additionalWrites']==0
    assert refusal['actualSavedPlacement']['parentUnitId']==469 and refusal['actualSavedPlacement']['stateFlags']==514
    assert live['publication']['clock']==115900 and live['publication']['ownerRevision']==2
    assert live['stats']['activeIO']==0 and live['stats']['peakIO']==1
    assert travel['originalNativeHeldPairLayoutQualified'] and travel['additionalWrites']==0 and travel['originalNeighborUnchanged']
    native=data('output/native-hero-binding-attempt-010.json')
    assert native['nativeSessionTerminal'] and native['nativeExitCode']==0 and native['ownedProducerAbsent']
    assert native['compiledSourceSha256']==compiled
    try:os.kill(native['nativePid'],0)
    except ProcessLookupError:pass
    else:raise AssertionError('Original producer is live')
    assert sha(Path(native['heldSave']['checkpoint']['filename']))==native['heldSave']['sha256']
    log=(ROOT/'output/hero-travel-boundary-regression-002.log').read_text()
    assert 'ℹ pass 218\nℹ fail 0\n' in log and 'ℹ skipped 0\n' in log
    overlay=data('output/hero-travel-boundary-site-001/manifest.json')
    assert overlay['stagingIdempotent'] and not overlay['browserUsed'] and not overlay['wasmIncluded']
    for name,digest in overlay['files'].items():assert sha(ROOT/'output/hero-travel-boundary-site-001'/name)==digest
    for name,digest in overlay['servedPagesUnchanged'].items():assert sha(ROOT/name)==digest
    previous=data('output/hero-travel-layout-generation-304/manifest.json')
    sources={str(Path(row['source']).relative_to(ROOT)) for row in previous['sources']}
    sources.update(['web/world/hero-travel-boundary.mjs','tests/hero-travel-boundary.test.mjs',
        'docs/hero-travel-boundary.md','scripts/preserve-hero-travel-boundary.py'])
    evidence=['output/hero-travel-boundary-focused-001.log','output/hero-travel-boundary-focused-002.log',
        'output/hero-travel-boundary-regression-001.log','output/hero-travel-boundary-regression-002.log',
        'output/hero-route-startup-original-012.json','output/hero-route-startup-original-012.tests.log',
        'output/hero-live-save-original-005.tests.log','output/hero-live-save-original-006.json',
        'output/hero-live-save-original-006.tests.log','output/hero-travel-boundary-site-001/manifest.json',
        'output/native-world-residency-build-304.json','output/native-hero-binding-attempt-010.json']
    OUT.mkdir()
    def preserve(name,kind):
        source=ROOT/name
        assert source.is_relative_to(ROOT) and '/original/' not in name and not name.startswith('../')
        assert 0<source.stat().st_size<8*1024*1024
        target=OUT/kind/name;target.parent.mkdir(parents=True,exist_ok=True)
        with source.open('rb') as f,target.open('xb') as out:
            for block in iter(lambda:f.read(4096),b''):out.write(block)
        digest=sha(source);assert sha(target)==digest
        return dict(kind=kind,source=str(source),preserved=str(target),sha256=digest,bytes=source.stat().st_size)
    saved_sources=[preserve(name,'source') for name in sorted(sources)]
    saved_evidence=[preserve(name,'evidence') for name in evidence]
    manifest=dict(version=1,sources=saved_sources,evidence=saved_evidence,compiledInputs=54,compiledSourceSha256=compiled,
        crossingSavePositionValidationTestsQualified=True,originalHaloStartupLayoutQualified=True,
        originalPhysicalParentCrossingRefusalQualified=True,javascriptTestsPassed=218,optionalTestsSkipped=0,
        boundedOriginalDataChecksPassed=2,browserUsed=False,nativeProcessesStarted=0,realOPFSDurabilityQualified=False,
        nativeMovementCrossingQualified=False,liveHeroCrossingQualified=False,cooperativeMatchesQualified=False,
        independentInternetMatchesQualified=False,goalComplete=False)
    with (OUT/'manifest.json').open('x') as f:json.dump(manifest,f,indent=2);f.write('\n')
    print(json.dumps(dict(sources=len(saved_sources),evidence=len(saved_evidence),compiledInputs=54,browserUsed=False,goalComplete=False)))
if __name__=='__main__':main()
