#!/usr/bin/env python3
"""Qualify shared original home registration in one isolated paused destination."""
import argparse,asyncio,importlib.util,json,os,re,tempfile,time
from pathlib import Path
from lib.native_pair_guard import owned_rows,stop_owned,stop_reason
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('hero_home_guard',ROOT/'scripts/run-native-regional-home.py')
guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard);sha=guard.sha
def record(path):return dict(filename=str(path),bytes=path.stat().st_size,sha256=sha(path))
async def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('build',type=Path);parser.add_argument('preparation',type=Path)
    parser.add_argument('--attempt',type=int,required=True);parser.add_argument('--mode',choices=['register','bad-digest','wrong-counter'],default='register')
    parser.add_argument('--arrival-preparation',type=Path)
    parser.add_argument('--activation-preparation',type=Path)
    args=parser.parse_args();kind='activation' if args.activation_preparation else 'arrival' if args.arrival_preparation else 'home'
    if args.activation_preparation and not args.arrival_preparation:parser.error('Activation requires the exact arrival preparation')
    out=ROOT/f'output/native-hero-{kind}-attempt-{args.attempt:03}.json';log=out.with_suffix('.log')
    if args.attempt<1 or out.exists() or log.exists():parser.error('Preserve prior trials')
    guard.idle();build_path=args.build.resolve();build=guard.bounded_json(build_path)
    prep_path=args.preparation.resolve();prep=guard.bounded_json(prep_path)
    if not prep.get('nativeHeroHomePrepared') or not prep.get('originalFilesUnchanged') or prep['region']!='1_0' or prep.get('runtimeRegistered'):
        parser.error('Verified unregistered destination home required')
    for name,digest in prep['sourceSha256'].items():
        if sha(ROOT/name)!=digest:parser.error('Preparation source changed')
    for row in [prep['proof'],prep['captureArchive'],prep['stoppedCaptureAttempt']]:
        if sha(Path(row['filename']))!=row['sha256']:parser.error('Preparation provenance changed')
    capture=guard.bounded_json(Path(prep['stoppedCaptureAttempt']['filename']))
    if not capture.get('nativeSessionTerminal') or not capture.get('ownedProducerAbsent') or capture['nativeExitCode']!=0:
        parser.error('Capture producer must be stopped')
    try:os.kill(capture['nativePid'],0)
    except ProcessLookupError:pass
    else:parser.error('Capture producer still live')
    arrival=None
    if args.arrival_preparation:
        if args.mode!='register':parser.error('Arrival requires successful home registration')
        arrival_path=args.arrival_preparation.resolve();arrival=guard.bounded_json(arrival_path)
        if not arrival.get('nativeHeroArrivalPrepared') or not arrival.get('originalFilesUnchanged') or arrival.get('heroImported') or arrival.get('sourceRetired'):
            parser.error('Inert actual crossing package required')
        for name,digest in arrival['sourceSha256'].items():
            if sha(ROOT/name)!=digest:parser.error('Arrival preparation source changed')
        checked_path=Path(arrival['homeRegistration']['filename']);checked=guard.bounded_json(checked_path)
        archive_path=Path(arrival['registrationArchive']['filename']);archive=guard.bounded_json(archive_path)
        if sha(checked_path)!=arrival['homeRegistration']['sha256'] or sha(archive_path)!=arrival['registrationArchive']['sha256']:
            parser.error('Registration proof changed')
        if not checked.get('nativeHeroHomeRegistrationQualified') or not archive.get('originalNativeHeroHomeRegistrationQualified'):
            parser.error('Qualified original registration required')
        frozen={str(Path(r['source']).relative_to(ROOT)):r for r in archive['sources']}
        for name,digest in checked['sourceSha256'].items():
            row=frozen.get(name)
            if not row or row['sha256']!=digest or sha(Path(row['preserved']))!=digest:parser.error('Frozen registration generation changed')
        if arrival['sourceWorld']!=capture['heldSave']['checkpoint'] or arrival['options']['sourceClockMs']!=capture['nativeCrossing']['clock'] or arrival['options']['destinationClockMs']!=prep['clock']:
            parser.error('Arrival must use this actual captured journey')
        if arrival['context']['homeAliases'][1]!={'kind':'proxy','unitId':0,'agentId':prep['proposedAgentId']}:
            parser.error('Registered destination alias differs')
        if [r['name'] for r in arrival['packDescriptors']]!=['unit','agent','container','order'] or arrival['options']['attachedUnitBindings']:
            parser.error('Current original reader requires the complete four-record outdoor hero contract')
        checked_attempt=guard.bounded_json(Path(checked['manifest']['filename']))
        if sha(Path(checked['manifest']['filename']))!=checked['manifest']['sha256'] or arrival['destinationWorld']!=checked_attempt['worlds'][1]:
            parser.error('Qualified registered original destination differs')
        for original in [checked_attempt,capture]:
            if not original.get('nativeSessionTerminal') or not original.get('ownedProducerAbsent') or original.get('nativeExitCode')!=0:parser.error('Original producers must be stopped')
            try:os.kill(original['nativePid'],0)
            except ProcessLookupError:pass
            else:parser.error('Original producer remains live')
        for row in [arrival['sourceWorld'],arrival['destinationWorld'],arrival['pack']]:
            path=Path(row['filename'])
            if path.stat().st_size!=row['bytes'] or sha(path)!=row['sha256']:parser.error('Bound arrival bytes changed')
    activation=None
    if args.activation_preparation:
        activation_path=args.activation_preparation.resolve();activation=guard.bounded_json(activation_path)
        if not activation.get('nativeHeroActivationPrepared') or activation.get('destinationActivated') or activation['clock']!=prep['clock']:
            parser.error('Original imported checkpoint home leg required')
        if activation['arrivalPreparation']!=record(arrival_path):parser.error('Activation preparation refers to another import capsule')
        for name,digest in activation['sourceSha256'].items():
            if sha(ROOT/name)!=digest:parser.error('Activation preparation source changed')
        proof_path=Path(activation['proof']['filename']);proof=guard.bounded_json(proof_path)
        archive_path=Path(activation['importArchive']['filename']);archive=guard.bounded_json(archive_path)
        if sha(proof_path)!=activation['proof']['sha256'] or sha(archive_path)!=activation['importArchive']['sha256']:
            parser.error('Import qualification changed')
        if not proof.get('nativeHeroArrivalQualified') or not archive.get('nativeHeroArrivalQualified'):
            parser.error('Qualified original import required')
        frozen={str(Path(r['source']).relative_to(ROOT)):r for r in archive['sources']}
        for name,digest in proof['sourceSha256'].items():
            row=frozen.get(name)
            if not row or row['sha256']!=digest or sha(Path(row['preserved']))!=digest:parser.error('Frozen import generation changed')
        old=guard.bounded_json(Path(proof['manifest']['filename']))
        if sha(Path(proof['manifest']['filename']))!=proof['manifest']['sha256'] or not old.get('nativeSessionTerminal') or not old.get('ownedProducerAbsent'):
            parser.error('Import producer must be stopped')
        try:os.kill(old['nativePid'],0)
        except ProcessLookupError:pass
        else:parser.error('Import producer remains live')
        row=activation['sourceWorld'];leg=activation['leg']
        if row!=proof['importedWorld'] or Path(row['filename']).stat().st_size!=row['bytes'] or sha(Path(row['filename']))!=row['sha256']:
            parser.error('Original imported checkpoint changed')
        if activation['identity']!=arrival['identity'] or leg['region']!=prep['region'] or leg['homeRegion']!=arrival['identity']['registeredHome']['home']['region'] or not leg.get('taskPreserved'):
            parser.error('Activation leg differs from registered home')
        if not all(isinstance(v,int) and 32<=v<=4064 for v in leg['movementPoint'].values()):parser.error('Invalid original movement point')
    compiled={}
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for name,digest in build[group].items():
            if name in compiled:parser.error('Duplicate compiled input')
            compiled[name]=digest
    exe=GAME/'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build['exitCode']!=0 or len(compiled)!=54 or any(sha(ROOT/n)!=h for n,h in compiled.items()):
        parser.error('Current official native build required')
    if sha(exe)!=build['nativeExecutableSha256'] or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256'] or sha(GAME/'original/gog/MajestyHD - Old.exe')!=guard.PIN:
        parser.error('Pinned executable or symbols changed')
    for row in [prep['sourceCheckpoint'],prep['proposal']]:
        path=Path(row['filename']).resolve()
        if not path.is_relative_to(ROOT/'output') or path.stat().st_size!=row['bytes'] or sha(path)!=row['sha256']:
            parser.error('Original checkpoint/proposal changed')
    before=guard.baseline();guard.idle();runner_sha=sha(Path(__file__))
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-hero-home-',dir=GAME/'build'))
    private=run/'native/recomp';(private/'mods').mkdir(parents=True);private_exe=private/'pop_smoke'
    guard.copy(exe,private_exe);private_exe.chmod(0o755);profile=run/'frontier_1_0';profile.mkdir()
    copied=profile/'Documents/My Games/MajestyHD/SaveGame/Frontier_1_0.GMP';guard.copy(Path(prep['sourceCheckpoint']['filename']),copied)
    proposal=profile/'Frontier_Hero_Home.GPL';guard.copy(Path(prep['proposal']['filename']),proposal)
    if arrival:
        pack=profile/'Frontier_Hero_Arrival.pack';guard.copy(Path(arrival['pack']['filename']),pack)
    content=guard.PIN+':'+build['nativeExecutableSha256'];marker=profile/'Frontier_1_0.checkpoint'
    marker.write_text('\n'.join(['checkpoint-v1','0',str(prep['sourceCheckpoint']['bytes']),prep['sourceCheckpoint']['sha256'],content,'']))
    script=run/'hero-home.script';script.write_text('wait 12000\nmove 400 300\nwait 2000\nmove 400 300\n')
    for folder in ['frames','user-mods']:(run/folder).mkdir()
    binding='f'*64 if args.mode=='bad-digest' else prep['proposal']['sha256']
    proposed=prep['proposedAgentId']-1 if args.mode=='wrong-counter' else prep['proposedAgentId']
    flags={'PROFILE_DIR':str(profile),'REGISTRY':str(run/'registry.json'),'RULE_FRONTIER_REGION':'1_0','RULE_FRONTIER_RESTORE':'1',
        'RULE_INVENTORY_COMPAT':'1','CONTENT_IDENTITY':content,'GUEST_ARGS':'-nointro -dochecksums',
        'BROWSER_FRONTIER_HERO_HOME_TEST':'v1','BROWSER_FRONTIER_HERO_HOME_TEST_BINDING':binding,
        'BROWSER_FRONTIER_HERO_HOME_TEST_SOURCE':prep['sourceCheckpoint']['sha256'],'BROWSER_FRONTIER_HERO_HOME_TEST_MODE':args.mode,
        'BROWSER_FRONTIER_HERO_HOME_TEST_CLOCK':str(prep['clock']),'BROWSER_FRONTIER_HERO_HOME_TEST_BYTES':str(prep['proposal']['bytes']),
        'BROWSER_FRONTIER_HERO_HOME_TEST_ID':str(proposed),'SMOKE_SECONDS':'18','SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600',
        'CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    if arrival:
        flags.update({'BROWSER_FRONTIER_HERO_ARRIVAL_TEST':'v1','BROWSER_FRONTIER_HERO_ARRIVAL_TEST_BINDING':arrival['pack']['sha256'],
            'BROWSER_FRONTIER_HERO_ARRIVAL_TEST_BYTES':str(arrival['pack']['bytes']),
            'BROWSER_FRONTIER_HERO_ARRIVAL_TEST_UNIT':str(arrival['selectedOwner']['unitId']),
            'BROWSER_FRONTIER_HERO_ARRIVAL_TEST_AGENT':str(arrival['selectedOwner']['agentId']),
            'BROWSER_FRONTIER_HERO_ARRIVAL_TEST_CLOCK':str(arrival['options']['sourceClockMs'])})
    if activation:
        flags.update({'BROWSER_FRONTIER_HERO_ACTIVATION_TEST':'v1',
            'BROWSER_FRONTIER_HERO_ACTIVATION_TEST_GOAL_X':str(activation['leg']['movementPoint']['x']),
            'BROWSER_FRONTIER_HERO_ACTIVATION_TEST_GOAL_Y':str(activation['leg']['movementPoint']['y'])})
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()})
    meta=dict(version=1,fixture=str(run),profile=str(profile),build=record(build_path),preparation=record(prep_path),
        sourceCheckpoint=record(copied),proposal=record(proposal),compiledSourceSha256=compiled,nativeExecutableSha256=sha(private_exe),
        mode=args.mode,clock=prep['clock'],proposedAgentId=proposed,script=record(script),runnerSha256=runner_sha,
        guardSha256=sha(ROOT/'scripts/lib/native_pair_guard.py'),supervisorSha256=sha(ROOT/'scripts/run-native-regional-home.py'),
        log=str(log),resourceSamples=[],deadlineSeconds=25,rssCeilingBytes=512*1024*1024,logCeilingBytes=4*1024*1024,
        preservedBefore=before,browserUsed=False,nativeProcessesStarted=1,nativeSessionTerminal=False,nativeExitCode=None,
        stopReason=None,nativeHomeRegistrationQualified=False,heroImported=False,ownerTransferred=False,goalComplete=False)
    if arrival:meta.update(arrivalPreparation=record(arrival_path),arrivalPackage=record(pack),nativeHeroArrivalTrialQualified=False)
    if activation:meta.update(activationPreparation=record(activation_path),nativeHeroActivationTrialQualified=False)
    if sha(Path(__file__))!=runner_sha or guard.baseline()!=before:parser.error('Isolation changed before launch')
    guard.idle()
    with log.open('x') as sink:
        process=await asyncio.create_subprocess_exec(str(private_exe),cwd=GAME/'kit',env=env,stdout=sink,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
        meta.update(nativePid=process.pid,startedAtMs=time.time_ns()//1000000);started=time.monotonic()
        print(json.dumps({'nativePid':process.pid,'phase':'paused-home-'+args.mode}),flush=True)
        try:
            while process.returncode is None:
                rows=guard.rows();owned=owned_rows(rows,[process.pid],[process.pid]);elapsed=time.monotonic()-started
                meta['resourceSamples'].append(dict(sampledAtMs=time.time_ns()//1000000,rssBytes=sum(r['rssBytes'] for r in owned)))
                meta['stopReason']=stop_reason(rows,[process.pid],elapsed,25,[log.stat().st_size],groups=[process.pid],expected_producers=1)
                out.write_text(json.dumps(meta,indent=2)+'\n')
                if meta['stopReason']:break
                try:await asyncio.wait_for(asyncio.shield(process.wait()),timeout=2)
                except asyncio.TimeoutError:pass
        finally:
            if process.returncode is None:await stop_owned([process],[process.pid])
        code=await process.wait()
    text=log.read_text() if log.stat().st_size<=4*1024*1024 else '';saved=copied.parent
    labels=['Hero_Home_Before','Hero_Home_Registered','Hero_Home_Reused'] if args.mode=='register' else ['Hero_Home_Before','Hero_Home_Refused']
    if arrival:labels.extend(['Hero_Arrival_Refused','Hero_Arrival_Imported'])
    if activation:labels.extend(['Hero_Activation_Refused','Hero_Activation_Ready','Hero_Activation_Routed','Hero_Activation_Crossed','Hero_Activation_Closed'])
    worlds=[saved/(label+'.GMP') for label in labels]
    expected=f"[frontier] Hero home test completed region=1_0 agent={proposed} clock={prep['clock']} phase=7 ordinary-ticks=0 saved=1 reuse-same=1 duplicate-refused=1 wrong-clock-refused=1 result=pass" if args.mode=='register' else f"[frontier] Hero home test refused mode={args.mode} region=1_0 clock={prep['clock']} phase=7 ordinary-ticks=0 saved=1 result=pass"
    meta.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,
        ownedProducerAbsent=not owned_rows(guard.rows(),[process.pid],[process.pid]),logSha256=sha(log),worlds=[record(p) for p in worlds if p.is_file()],
        copiedCheckpointUnchanged=sha(copied)==prep['sourceCheckpoint']['sha256'],originalCheckpointUnchanged=sha(Path(prep['sourceCheckpoint']['filename']))==prep['sourceCheckpoint']['sha256'],
        proposalUnchanged=sha(proposal)==prep['proposal']['sha256'],originalProposalUnchanged=sha(Path(prep['proposal']['filename']))==prep['proposal']['sha256'],
        preservedAfter=guard.baseline(),nativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'])
    complete=code==0 and meta['ownedProducerAbsent'] and meta['stopReason'] is None and expected in text and len(meta['worlds'])==len(labels) and meta['preservedBefore']==meta['preservedAfter'] and all(meta[k] for k in ['copiedCheckpointUnchanged','originalCheckpointUnchanged','proposalUnchanged','originalProposalUnchanged','nativeExecutableUnchanged'])
    if arrival:
        match=re.search(r'Hero arrival test completed source=(\d+)/(\d+) hero=(\d+) agent=(\d+) proxy=(\d+) clock=(\d+) phase=7 ordinary-ticks=0 saved=1 bad-digest-refused=1 wrong-clock-refused=1 scheduled=0 activated=0 owner-published=0 result=pass',text)
        meta.update(arrivalPackageUnchanged=sha(pack)==arrival['pack']['sha256'],
            originalArrivalPackageUnchanged=sha(Path(arrival['pack']['filename']))==arrival['pack']['sha256'],
            sourceArrivalCheckpointUnchanged=sha(Path(arrival['sourceWorld']['filename']))==arrival['sourceWorld']['sha256'],
            destinationArrivalCheckpointUnchanged=sha(Path(arrival['destinationWorld']['filename']))==arrival['destinationWorld']['sha256'])
        complete=bool(complete and match and all(meta[k] for k in ['arrivalPackageUnchanged','originalArrivalPackageUnchanged','sourceArrivalCheckpointUnchanged','destinationArrivalCheckpointUnchanged']))
        if complete:
            source_id,source_agent,unit_id,agent_id,home_id,clock=map(int,match.groups())
            complete=source_id==arrival['selectedOwner']['unitId'] and source_agent==arrival['selectedOwner']['agentId'] and home_id==proposed and clock==prep['clock']
            meta.update(importedAliases={'unitId':unit_id,'agentId':agent_id,'homeAgentId':home_id})
        meta.update(nativeHeroArrivalTrialQualified=complete,heroImported=complete,destinationActivated=False)
    if activation:
        crossed=re.search(r'Hero active crossing hero=(\d+) agent=(\d+) clock=(\d+) previous-clock=(\d+) previous=(-?\d+),(-?\d+),(-?\d+) accepted=(-?\d+),(-?\d+),(-?\d+) ai=(\d+) other-ai=(\d+) contexts=(\d+) commands=(\d+) ticks=(\d+) footprint=4 drawing=1 queued=1 original-movement=1 phase=3 pending=7 owner-published=0 result=pass',text)
        ended=re.search(r'Hero activation test completed hero=(\d+) agent=(\d+) clock=(\d+) ticks=(\d+) original-pause=1 hooks-removed=1 binding-cleared=1 owner-published=0 result=pass',text)
        complete=bool(complete and crossed and ended and sha(Path(activation['sourceWorld']['filename']))==activation['sourceWorld']['sha256'])
        if complete:
            v=list(map(int,crossed.groups()));e=list(map(int,ended.groups()))
            complete=v[:3]==e[:3] and v[14]==e[3] and v[0]==meta['importedAliases']['unitId'] and v[1]==meta['importedAliases']['agentId']
            meta.update(activeCrossing={'unitId':v[0],'agentId':v[1],'clock':v[2],'previousClock':v[3],
                'previous':dict(zip(['x','y','z'],v[4:7])),'accepted':dict(zip(['x','y','z'],v[7:10])),
                'aiCalls':v[10],'otherAiCalls':v[11],'remoteContexts':v[12],'commandCalls':v[13],'ticks':v[14]},
                activationOriginalCheckpointUnchanged=True)
        meta.update(nativeHeroActivationTrialQualified=complete,destinationActivated=complete)
    meta['nativeHomeRegistrationTrialQualified']=complete;meta['nativeHomeRegistrationQualified']=bool(complete and args.mode=='register')
    meta['nativeHomeRegistrationRefusalQualified']=bool(complete and args.mode!='register');out.write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'qualified':complete,'ownedProducerAbsent':meta['ownedProducerAbsent']}),flush=True)
    raise SystemExit(code or (0 if complete else 1))
if __name__=='__main__':asyncio.run(main())
