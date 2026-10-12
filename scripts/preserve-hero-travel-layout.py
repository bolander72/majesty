#!/usr/bin/env python3
"""Preserve the current held source/neighbor geometry admission and its proofs."""
import hashlib,json,os
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/hero-travel-layout-generation-304'
def data(name):
    p=ROOT/name;assert p.stat().st_size<256*1024;return json.loads(p.read_text())
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(4096),b''):h.update(block)
    return h.hexdigest()
def main():
    assert not OUT.exists(),'Preserve previous archives'
    build=data('output/native-world-residency-build-304.json');assert build['nativeBuildQualified'] and build['exitCode']==0
    compiled={}
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for name,digest in build[group].items():assert name not in compiled and sha(ROOT/name)==digest;compiled[name]=digest
    assert len(compiled)==54
    assert sha(ROOT/'upstream/majesty-recomp/build/recomp/pop_smoke')==build['nativeExecutableSha256']
    startup=data('output/hero-route-startup-original-011.json')
    for name,digest in startup['sourceSha256'].items():assert sha(ROOT/name)==digest
    live=data('output/hero-live-save-original-004.json');travel=live['travel'];admission=travel['admission']
    assert live['originalNativeHeldCheckpointLivePublicationQualified'] and live['worldLeaseRetained'] and live['originalFilesUnchanged']
    assert travel['originalNativeHeldPairLayoutQualified'] and travel['additionalWrites']==0 and travel['originalNeighborUnchanged']
    assert admission['kind']=='saved' and admission['sourceRegion']=='0_0' and admission['targetRegion']=='1_0'
    for layout in [admission['layout'],admission['destinationLayout']]:
        assert layout['verifiedVertices']==16641 and layout['sharedVertices']==2480 and layout['largestTerrainRead']==1161
    assert live['stats']['activeIO']==0 and live['stats']['peakIO']==1
    assert live['stats']['largestRead']<=4096 and live['stats']['largestWrite']<=4096
    native=data('output/native-hero-binding-attempt-010.json');assert native['nativeHeroSaveHandshakeQualified'] and native['nativeSessionTerminal'] and native['nativeExitCode']==0
    try:os.kill(native['nativePid'],0)
    except ProcessLookupError:pass
    else:raise AssertionError('Original producer is live')
    assert native['compiledSourceSha256']==compiled
    assert sha(Path(native['heldSave']['checkpoint']['filename']))==native['heldSave']['sha256']
    assert sha(Path(travel['neighbor']['filename']))==travel['neighbor']['sha256']
    assert sha(Path(travel['publication']['filename']))==travel['publication']['sha256']
    log=(ROOT/'output/hero-travel-layout-regression-002.log').read_text()
    assert 'ℹ pass 209\nℹ fail 0\n' in log and 'ℹ skipped 0\n' in log
    previous=data('output/hero-live-save-generation-304/manifest.json')
    sources={str(Path(r['source']).relative_to(ROOT)) for r in previous['sources']}
    sources.update(['web/world/halo-checkpoint-layout.mjs','tests/halo-checkpoint-layout.test.mjs',
        'tests/fixtures/halo-terrain-checkpoint.mjs','docs/hero-travel-layout.md','scripts/preserve-hero-travel-layout.py'])
    evidence=['output/hero-travel-layout-tests-001.log','output/hero-travel-layout-tests-002.log',
        'output/hero-travel-layout-regression-002.log','output/hero-route-startup-original-011.json',
        'output/hero-route-startup-original-011.tests.log','output/hero-live-save-original-004.json',
        'output/hero-live-save-original-004.tests.log','output/native-world-residency-build-304.json',
        'output/native-hero-binding-attempt-010.json','output/native-hero-binding-attempt-010.log']
    OUT.mkdir()
    def preserve(name,kind):
        source=ROOT/name;assert source.is_relative_to(ROOT) and not name.startswith('../') and '/original/' not in name
        assert 0<source.stat().st_size<8*1024*1024
        target=OUT/kind/name;target.parent.mkdir(parents=True,exist_ok=True)
        with source.open('rb') as f,target.open('xb') as out:
            for block in iter(lambda:f.read(4096),b''):out.write(block)
        digest=sha(source);assert sha(target)==digest
        return dict(kind=kind,source=str(source),preserved=str(target),sha256=digest,bytes=source.stat().st_size)
    saved_sources=[preserve(name,'source') for name in sorted(sources)]
    saved_evidence=[preserve(name,'evidence') for name in evidence]
    manifest=dict(version=1,sources=saved_sources,evidence=saved_evidence,compiledSourceSha256=compiled,
        compiledInputs=54,heldSourceNeighborLayoutAdmissionQualified=True,originalNativeHeldPairLayoutQualified=True,
        javascriptTestsPassed=209,largestRead=4096,largestWrite=4096,browserUsed=False,nativeProcessesStarted=0,
        realOPFSDurabilityQualified=False,liveHeroCrossingQualified=False,cooperativeMatchesQualified=False,
        internetMatchesQualified=False,goalComplete=False)
    with (OUT/'manifest.json').open('x') as f:json.dump(manifest,f,indent=2);f.write('\n')
    print(json.dumps(dict(sources=len(saved_sources),evidence=len(saved_evidence),compiledInputs=54,browserUsed=False,goalComplete=False)))
if __name__=='__main__':main()
