#!/usr/bin/env python3
"""Freeze the qualified shared registration code before further native edits."""
import hashlib,json,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/hero-home-registration-generation-308'
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(4096),b''):h.update(block)
    return h.hexdigest()
def data(name):
    path=ROOT/name;assert path.is_file() and path.stat().st_size<256*1024
    return json.loads(path.read_text())
def main():
    assert not OUT.exists(),'Preserve prior archive'
    compiled={};build=data('output/native-world-residency-build-308.json')
    assert build['nativeBuildQualified'] and build['exitCode']==0
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for name,digest in build[group].items():
            assert name not in compiled and sha(ROOT/name)==digest
            compiled[name]=digest
    assert len(compiled)==54
    assert sha(ROOT/'upstream/majesty-recomp/build/recomp/pop_smoke')==build['nativeExecutableSha256']
    previous=data('output/hero-crossing-capture-generation-307/manifest.json')
    preserved={str(Path(row['source']).relative_to(ROOT)):row for row in previous['sources']}
    sources=set(compiled)
    evidence=['output/native-world-residency-build-308.json','output/native-world-residency-build-308.log',
        'output/native-hero-home-preparation-001/preparation.json']
    for number,inspection in [(1,4),(2,2),(3,3)]:
        attempt_name=f'output/native-hero-home-attempt-{number:03}.json'
        inspection_name=f'output/native-hero-home-{inspection:03}-observed.json'
        attempt=data(attempt_name);checked=data(inspection_name)
        assert attempt['nativeSessionTerminal'] and attempt['ownedProducerAbsent'] and attempt['nativeExitCode']==0
        assert attempt['stopReason'] is None and attempt['compiledSourceSha256']==compiled
        try:os.kill(attempt['nativePid'],0)
        except ProcessLookupError:pass
        else:raise AssertionError('Native producer live')
        assert checked['manifest']['sha256']==sha(ROOT/attempt_name)
        assert checked['nativeHeroHomeRegistrationQualified']==(number==1)
        assert checked['nativeHeroHomeRefusalQualified']==(number!=1)
        assert attempt['preservedBefore']==attempt['preservedAfter'] and sha(Path(attempt['log']))==attempt['logSha256']
        for row in attempt['worlds']:assert sha(Path(row['filename']))==row['sha256']
        for name,digest in checked['sourceSha256'].items():
            assert sha(ROOT/name)==digest;sources.add(name)
        evidence.extend([attempt_name,f'output/native-hero-home-attempt-{number:03}.log',inspection_name])
    sources.add('scripts/preserve-hero-home-registration.py')
    OUT.mkdir()
    def freeze(name,kind):
        source=ROOT/name;assert source.is_relative_to(ROOT) and source.is_file() and not source.is_symlink()
        assert '/original/' not in name and 0<source.stat().st_size<8*1024*1024
        digest=sha(source)
        if kind=='source' and name in preserved and preserved[name]['sha256']==digest:
            row=preserved[name];assert sha(Path(row['preserved']))==digest
            return dict(row,reused=True)
        target=OUT/kind/name;target.parent.mkdir(parents=True,exist_ok=True)
        with source.open('rb') as src,target.open('xb') as dst:
            for block in iter(lambda:src.read(4096),b''):dst.write(block)
        assert sha(target)==digest
        return dict(source=str(source),preserved=str(target),bytes=source.stat().st_size,sha256=digest,reused=False)
    report=dict(version=1,originalNativeHeroHomeRegistrationQualified=True,originalNativeHeroHomeRefusalsQualified=True,
        compiledInputs=54,compiledSourceSha256=compiled,nativeExecutableSha256=build['nativeExecutableSha256'],
        sources=[freeze(n,'source') for n in sorted(sources)],evidence=[freeze(n,'evidence') for n in evidence],
        heroImported=False,ownerTransferred=False,browserUsed=False,goalComplete=False)
    with (OUT/'manifest.json').open('x') as stream:json.dump(report,stream,indent=2);stream.write('\n')
    print(json.dumps(dict(sources=len(report['sources']),copiedSources=sum(not r['reused'] for r in report['sources']),
        evidence=len(evidence),originalNativeHeroHomeRegistrationQualified=True,browserUsed=False)))
if __name__=='__main__':main()
