#!/usr/bin/env python3
"""Freeze a qualified shared original arrival generation without game assets."""
import argparse,hashlib,json,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(4096),b''):h.update(block)
    return h.hexdigest()
def data(path):
    assert path.is_file() and 0<path.stat().st_size<256*1024
    return json.loads(path.read_text())
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--build',type=int,required=True);parser.add_argument('--attempt',type=int,required=True)
    parser.add_argument('--inspection',type=int,required=True)
    parser.add_argument('--activation-inspection',type=int);parser.add_argument('--binding-regression',type=int)
    args=parser.parse_args();activation=bool(args.activation_inspection)
    assert min(args.build,args.attempt,args.inspection)>0
    kind='activation' if activation else 'arrival'
    out=ROOT/f'output/hero-{kind}-generation-{args.build}';assert not out.exists(),'Preserve prior archive'
    build_name=f'output/native-world-residency-build-{args.build:03}.json';build=data(ROOT/build_name)
    attempt_name=f'output/native-hero-{kind}-attempt-{args.attempt:03}.json';attempt=data(ROOT/attempt_name)
    checked_name=f'output/native-hero-arrival-{args.inspection:03}-observed.json';checked=data(ROOT/checked_name)
    assert build['nativeBuildQualified'] and build['exitCode']==0 and checked['nativeHeroArrivalQualified']
    assert attempt['nativeHeroArrivalTrialQualified'] and attempt['nativeSessionTerminal'] and attempt['nativeExitCode']==0
    assert attempt['ownedProducerAbsent'] and attempt['stopReason'] is None
    assert checked['manifest']['sha256']==sha(ROOT/attempt_name)
    if activation:
        activation_name=f'output/native-hero-activation-{args.activation_inspection:03}-observed.json';active=data(ROOT/activation_name)
        assert active['nativeHeroActivationQualified'] and attempt['nativeHeroActivationTrialQualified']
        assert active['manifest']['sha256']==sha(ROOT/attempt_name)
        assert active['importQualification']['sha256']==sha(ROOT/checked_name)
        checked['sourceSha256'].update(active['sourceSha256'])
    try:os.kill(attempt['nativePid'],0)
    except ProcessLookupError:pass
    else:raise AssertionError('Native producer remains live')
    compiled={}
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for name,digest in build[group].items():
            assert name not in compiled and sha(ROOT/name)==digest
            compiled[name]=digest
    assert len(compiled)==54 and attempt['compiledSourceSha256']==compiled
    assert sha(ROOT/'upstream/majesty-recomp/build/recomp/pop_smoke')==build['nativeExecutableSha256']==attempt['nativeExecutableSha256']
    assert sha(Path(attempt['log']))==attempt['logSha256'] and attempt['preservedBefore']==attempt['preservedAfter']
    prep=data(Path(attempt['arrivalPreparation']['filename']))
    assert sha(Path(attempt['arrivalPreparation']['filename']))==attempt['arrivalPreparation']['sha256']
    for row in attempt['worlds']+[prep['sourceWorld'],prep['destinationWorld'],prep['pack']]:assert sha(Path(row['filename']))==row['sha256']
    base=data(Path(prep['registrationArchive']['filename']))
    assert sha(Path(prep['registrationArchive']['filename']))==prep['registrationArchive']['sha256']
    reusable={str(Path(r['source']).relative_to(ROOT)):r for r in base['sources']}
    sources=set(checked['sourceSha256'])
    for name,digest in checked['sourceSha256'].items():assert sha(ROOT/name)==digest
    sources.update(['scripts/preserve-hero-arrival.py','scripts/run-native-hero-home.py','docs/hero-native-arrival.md',
        'docs/hero-travel-home.md','docs/hero-native-crossing.md','CHANGELOG.md','upstream/majesty-recomp/docs/analysis.md'])
    evidence=[build_name,f'output/native-world-residency-build-{args.build:03}.log',attempt_name,
        f'output/native-hero-{kind}-attempt-{args.attempt:03}.log',checked_name,
        str(Path(attempt['arrivalPreparation']['filename']).relative_to(ROOT)),
        'output/hero-native-arrival-regression-001.log']
    tests=(ROOT/evidence[-1]).read_text();assert 'tests 67' in tests and 'pass 67' in tests and 'fail 0' in tests and 'skipped 0' in tests
    if activation:
        evidence.extend([activation_name,str(Path(attempt['activationPreparation']['filename']).relative_to(ROOT)),
            'output/hero-native-activation-regression-001.log'])
        tests=(ROOT/evidence[-1]).read_text();assert 'tests 45' in tests and 'pass 45' in tests and 'fail 0' in tests and 'skipped 0' in tests
    if args.binding_regression:
        name=f'output/native-hero-binding-attempt-{args.binding_regression:03}.json';reg=data(ROOT/name)
        assert reg['nativeSelectedHeroCrossingQualified'] and reg['nativeSessionTerminal'] and reg['nativeExitCode']==0 and reg['ownedProducerAbsent']
        assert reg['compiledSourceSha256']==compiled and reg['preservedBefore']==reg['preservedAfter']
        try:os.kill(reg['nativePid'],0)
        except ProcessLookupError:pass
        else:raise AssertionError('Binding regression producer remains live')
        assert sha(Path(reg['log']))==reg['logSha256']
        evidence.extend([name,f'output/native-hero-binding-attempt-{args.binding_regression:03}.log'])
    out.mkdir()
    def freeze(name,kind):
        source=ROOT/name;assert source.is_relative_to(ROOT) and source.is_file() and not source.is_symlink()
        assert '/original/' not in name and 0<source.stat().st_size<8*1024*1024
        digest=sha(source)
        if kind=='source' and name in reusable and reusable[name]['sha256']==digest:
            row=reusable[name];assert sha(Path(row['preserved']))==digest;return dict(row,reused=True)
        target=out/kind/name;target.parent.mkdir(parents=True,exist_ok=True)
        with source.open('rb') as src,target.open('xb') as dst:
            for block in iter(lambda:src.read(4096),b''):dst.write(block)
        assert sha(target)==digest
        return dict(source=str(source),preserved=str(target),bytes=source.stat().st_size,sha256=digest,reused=False)
    report=dict(version=1,nativeHeroArrivalQualified=True,nativeHeroActivationQualified=activation,compiledInputs=54,compiledSourceSha256=compiled,
        nativeExecutableSha256=build['nativeExecutableSha256'],registrationArchive=prep['registrationArchive'],
        sources=[freeze(n,'source') for n in sorted(sources)],evidence=[freeze(n,'evidence') for n in evidence],
        exactImportedRecords=checked['exactImportedRecords'],unrelatedRecordComparisons=checked['unrelatedRecordComparisons'],
        destinationActivated=activation,sourceRetired=False,sourceUnloaded=False,ownerTransferred=False,browserUsed=False,goalComplete=False)
    with (out/'manifest.json').open('x') as stream:json.dump(report,stream,indent=2);stream.write('\n')
    print(json.dumps(dict(nativeHeroArrivalQualified=True,sources=len(report['sources']),
        copiedSources=sum(not r['reused'] for r in report['sources']),evidence=len(evidence),browserUsed=False,goalComplete=False)))
if __name__=='__main__':main()
