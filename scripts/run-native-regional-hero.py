#!/usr/bin/env python3
"""Restore the checked hero family in one private generated-region engine."""
import argparse,asyncio,hashlib,importlib.util,json,os,subprocess,tempfile,time
from pathlib import Path
from lib.native_pair_guard import owned_rows,stop_owned,stop_reason
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('regional_home',ROOT/'scripts/run-native-regional-home.py')
home=importlib.util.module_from_spec(spec);spec.loader.exec_module(home)
sha=home.sha
RUNNER_SHA=sha(Path(__file__))
async def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('build_report',type=Path);parser.add_argument('preparation',type=Path)
    parser.add_argument('--attempt',type=int,required=True)
    parser.add_argument('--motion',action='store_true',help='Admit destination-local footprint and execute Path while holding AI and Queue')
    parser.add_argument('--save',action='store_true',help='Capture an original whole-world checkpoint after route completion')
    parser.add_argument('--reload-from',type=Path,help='Reload a qualified stopped moved-hero whole-world save')
    a=parser.parse_args()
    effects=bool(home.bounded_json(a.preparation).get('regionalEffectsInputsPrepared'))
    if a.motion and not effects:parser.error('Motion requires identity-bound effects preparation')
    if a.save and not a.motion:parser.error('Saved moved hero requires motion')
    if a.reload_from and (a.motion or a.save or not effects):parser.error('Reload uses held hero and identity binding only')
    out=ROOT/f'output/native-regional-hero-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():parser.error('Require fresh positive attempt')
    home.idle();build_path=a.build_report.resolve();build=home.bounded_json(build_path)
    compiled={}
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for n,h in build[group].items():
            if n in compiled:parser.error('Overlapping compiled sources')
            compiled[n]=h
    exe=GAME/'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build['exitCode']!=0 or len(compiled)!=53 or any(sha(ROOT/n)!=h for n,h in compiled.items()):
        parser.error('Complete current official native build required')
    if sha(exe)!=build['nativeExecutableSha256'] or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']:
        parser.error('Current executable or symbols changed')
    if sha(GAME/'original/gog/MajestyHD - Old.exe')!=home.PIN:parser.error('Pinned original executable changed')
    prep_path=a.preparation.resolve();p=home.bounded_json(prep_path)
    if not p.get('regionalHeroRuntimeInputsPrepared') or p['nativeProcessesStarted'] or p['browserUsed'] or p['ownerPublished']:
        parser.error('Require checked inert original-family inputs')
    if any(sha(ROOT/n)!=h for n,h in p['sourceSha256'].items()):parser.error('Preparation source changed')
    for key in ['checkedCapsule','capsulePreparation','originalGeneratedManifest']:
        if sha(p[key])!=p[key+'Sha256']:parser.error('Input proof changed: '+key)
    checked=home.bounded_json(p['checkedCapsule'])
    if sha(checked['audit'])!=checked['auditSha256']:parser.error('Home callback audit changed')
    for n,h in checked['sourceSha256'].items():
        if sha(ROOT/n)!=h:parser.error('Capsule checker source changed')
    old=home.bounded_json(p['originalGeneratedManifest'])
    if not old['nativeSessionTerminal'] or old['nativeExitCode']!=0 or not old['ownedProducerAbsent']:parser.error('Original producer not terminal')
    try:os.kill(old['nativePid'],0)
    except ProcessLookupError:pass
    else:parser.error('Original producer PID remains live')
    region=p['region']
    if region=='0_0' or region!='_'.join(str(int(n)) for n in region.split('_')) or len(region)>24:parser.error('Canonical remote region required')
    source=Path(p['destination']['filename']);donor=Path(p['originalSource']['file'])
    if sha(source)!=p['destination']['sha256'] or sha(donor)!=p['originalSource']['sha256']:parser.error('Original world changed')
    reload_proof=None
    if a.reload_from:
        reload_proof=home.bounded_json(a.reload_from)
        if not reload_proof.get('originalMovedHeroWholeWorldSaveQualified') or reload_proof['ownerPublished'] or reload_proof['browserUsed']:parser.error('Qualified private moved save required')
        for n,h in reload_proof['sourceSha256'].items():
            if sha(ROOT/n)!=h:parser.error('Saved-world checker source changed')
        prior=home.bounded_json(reload_proof['manifest'])
        if sha(Path(reload_proof['manifest']))!=reload_proof['manifestSha256'] or not prior['nativeSessionTerminal'] or prior['nativeExitCode']!=0 or not prior['ownedProducerAbsent']:parser.error('Saved producer not qualified terminal')
        try:os.kill(prior['nativePid'],0)
        except ProcessLookupError:pass
        else:parser.error('Saved producer still live')
        archive=home.bounded_json(ROOT/'output/native-regional-moved-save-generation-211/manifest.json')
        archived={r['original']:r for r in archive['sources']}
        for n,h in prior['compiledSourceSha256'].items():
            r=archived.get(str(ROOT/n))
            if not r or r['sha256']!=h or sha(Path(r['preserved']))!=h:parser.error('Saved compiled closure not preserved')
        if sha(Path(prior['privateNativeExecutable']))!=prior['nativeExecutableSha256'] or sha(Path(prior['log']))!=prior['logSha256']:parser.error('Saved original execution evidence changed')
        source=Path(reload_proof['savedMovedHero']['filename'])
        if sha(source)!=reload_proof['savedMovedHero']['sha256'] or reload_proof['region']!=region or reload_proof['homeAgentId']!=p['homeAgentId']:parser.error('Saved world/binding changed')
    settings=Path(p['settingsProfile'])
    if any(sha(settings/n)!=h for n,h in p['inputHashes'].items()):parser.error('Original settings changed')
    before=home.baseline();run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-regional-hero-runtime-',dir=GAME/'build'))
    private=run/'native/recomp';(private/'mods').mkdir(parents=True);private_exe=private/'pop_smoke'
    home.copy(exe,private_exe);private_exe.chmod(0o755)
    world=run/'native-world-regional-hero';profile=world/('frontier_'+region);profile.mkdir(parents=True)
    for n in p['inputHashes']:home.copy(settings/n,profile/n)
    copied=profile/f'Documents/My Games/MajestyHD/SaveGame/Frontier_{region}.GMP';home.copy(source,copied)
    marker=profile/f'Frontier_{region}.checkpoint';content=home.PIN+':'+build['nativeExecutableSha256']
    marker.write_text('\n'.join(['checkpoint-v1','0',str(copied.stat().st_size),sha(copied),content,'']))
    proposals=[]
    for r in p['records']:
        original=Path(r['filename']);destination=profile/original.name
        if sha(original)!=r['sha256'] or original.stat().st_size!=r['bytes']:parser.error('Prepared family changed')
        home.copy(original,destination);proposals.append({**r,'copied':str(destination)})
    for n in ['frames','user-mods']:(run/n).mkdir()
    script=run/'regional-hero.script';script.write_text(f'wait {26000 if a.motion else 20000 if effects else 12000}\ndump regional_hero_restored\n')
    registry=run/'registry.json'
    flags={'PROFILE_DIR':str(profile),'REGISTRY':str(registry),'RULE_FRONTIER_REGION':region,'RULE_FRONTIER_RESTORE':'1',
        'CONTENT_IDENTITY':content,'RULE_INVENTORY_COMPAT':'1','RULE_FRONTIER_SEEDED_GENERATION':'1',
        'RULE_FRONTIER_CONNECTED_TERRAIN':'v1','RULE_FRONTIER_SESSION':'v1','BROWSER_STREAMING_DEBUG':'1',
        'BROWSER_STREAMING_OUTDOOR_FAMILY_FIXTURE':'region-v1',
        'BROWSER_STREAMING_FAMILY_CLOCK':str(p['destinationClockMs']),'BROWSER_STREAMING_FAMILY_HOME_AGENT':str(p['homeAgentId']),
        'GUEST_ARGS':'-nointro -dochecksums','SMOKE_SECONDS':'30' if a.motion else '25','SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600',
        'CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()})
    if effects:env['RECOMP_BROWSER_STREAMING_REGIONAL_HERO_EFFECTS']='motion-v1' if a.motion else 'v1'
    if a.save:env['RECOMP_BROWSER_STREAMING_REGIONAL_HERO_SAVE_FIXTURE']='1'
    if reload_proof:
        saved=reload_proof['savedMovedHero'];pause=reload_proof['ordinaryEffects']['registeredHomeRequest']['pauseAnchorClockMs']
        env.update(RECOMP_BROWSER_STREAMING_REGIONAL_HERO_RELOAD='v1',RECOMP_BROWSER_STREAMING_FAMILY_CLOCK=str(saved['clockMs']),
            RECOMP_BROWSER_STREAMING_REGIONAL_HERO_ID=str(saved['heroId']),RECOMP_BROWSER_STREAMING_REGIONAL_HERO_AGENT=str(saved['agentId']),
            RECOMP_BROWSER_STREAMING_REGIONAL_HERO_PAUSE_ANCHOR=str(pause))
    if sha(Path(__file__))!=RUNNER_SHA or home.baseline()!=before or registry.exists():raise RuntimeError('Isolation preflight changed')
    m=dict(version=1,nativeOnly=True,browserUsed=False,fixture=str(run),worldRoot=str(world),profile=str(profile),region=region,
        privateNativeExecutable=str(private_exe),privateRegistry=str(registry),nativeExecutableSha256=sha(private_exe),
        buildReport=str(build_path),buildReportSha256=sha(build_path),compiledSourceSha256=compiled,nativeSymbolsSha256=build['nativeSymbolsSha256'],
        runnerSha256=RUNNER_SHA,supervisorSha256=sha(ROOT/'scripts/run-native-regional-home.py'),guardSha256=sha(ROOT/'scripts/lib/native_pair_guard.py'),
        preparation=str(prep_path),preparationSha256=sha(prep_path),proposals=proposals,source=str(source),sourceCopy=str(copied),sourceSha256=sha(source),
        donor=str(donor),donorSha256=sha(donor),settingsProfile=str(settings),inputHashes=p['inputHashes'],preservedBefore=before,
        script=str(script),scriptSha256=sha(script),log=str(log),resourceSamples=[],deadlineSeconds=35,rssCeilingBytes=512*1024*1024,
        logCeilingBytes=4*1024*1024,nativeProcessesStarted=1,nativeSessionTerminal=False,nativeExitCode=None,stopReason=None,
        regionalEffectsTrial=effects,regionalMotionTrial=a.motion,regionalHeroCheckpointTrial=a.save,
        regionalHeroReloadTrial=bool(reload_proof),reloadProof=str(a.reload_from.resolve()) if reload_proof else None,
        reloadProofSha256=sha(a.reload_from) if reload_proof else None,nativeActivationQualified=False,ownerPublished=False,goalComplete=False)
    home.idle()
    with log.open('x') as sink:
        proc=await asyncio.create_subprocess_exec(str(private_exe),cwd=GAME/'kit',env=env,stdout=sink,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
        m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);started=time.monotonic()
        print(json.dumps({'nativePid':proc.pid,'region':region,'phase':'original-family-restore'}),flush=True)
        try:
            while proc.returncode is None:
                rows=home.rows();owned=owned_rows(rows,[proc.pid],[proc.pid]);elapsed=time.monotonic()-started
                m['resourceSamples'].append(dict(sampledAtMs=time.time_ns()//1000000,ownedPids=[r['pid'] for r in owned],rssBytes=sum(r['rssBytes'] for r in owned)))
                m['stopReason']=stop_reason(rows,[proc.pid],elapsed,35,[log.stat().st_size],groups=[proc.pid],expected_producers=1)
                out.write_text(json.dumps(m,indent=2)+'\n')
                if m['stopReason']:break
                try:await asyncio.wait_for(asyncio.shield(proc.wait()),timeout=2)
                except asyncio.TimeoutError:pass
        finally:
            if proc.returncode is None:await stop_owned([proc],[proc.pid])
        code=await proc.wait()
    def record(f):return dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f))
    text=log.read_text();complete=len([l for l in text.splitlines() if l.startswith('[streaming] Regional hero ') and 'result=pass' in l])==1
    if reload_proof:complete=len([l for l in text.splitlines() if l.startswith('[streaming] Regional hero reload armed ') and 'result=pass' in l])==1
    cleanup_prefix='[streaming] Regional effects cleanup ' if effects else '[streaming] Family cleanup '
    if reload_proof:cleanup_prefix='[streaming] Regional hero reload cleanup '
    cleanup=len([l for l in text.splitlines() if l.startswith(cleanup_prefix) and 'result=pass' in l])==1
    checkpoint=profile/'Documents/My Games/MajestyHD/SaveGame/Regional_Hero_Moved.GMP'
    if a.save:complete=complete and checkpoint.is_file() and '[streaming] Regional motion saved ' in text
    m.update(nativeSessionTerminal=True,nativeExitCode=code,ownedProducerAbsent=not owned_rows(home.rows(),[proc.pid],[proc.pid]),
        finishedAtMs=time.time_ns()//1000000,regionalHeroTrialCompleted=complete and cleanup,logSha256=sha(log),
        originalSourceUnchanged=sha(source)==m['sourceSha256'],sourceCopyUnchanged=sha(copied)==m['sourceSha256'],donorUnchanged=sha(donor)==m['donorSha256'],
        originalSettingsUnchanged=all(sha(settings/n)==h for n,h in p['inputHashes'].items()),
        proposalsUnchanged=all(sha(r['filename'])==r['sha256'] and sha(r['copied'])==r['sha256'] for r in proposals),
        privateNativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'],preservedAfter=home.baseline(),
        records=[record(f) for f in sorted([*profile.glob('Family_*'),*profile.glob('Regional_*')])],
        frame=record(run/'frames/smoke_regional_hero_restored_present.ppm') if (run/'frames/smoke_regional_hero_restored_present.ppm').is_file() else None,
        checkpoint=record(checkpoint) if a.save and checkpoint.is_file() else None)
    out.write_text(json.dumps(m,indent=2)+'\n')
    print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'completed':m['regionalHeroTrialCompleted'],'ownedProducerAbsent':m['ownedProducerAbsent']}),flush=True)
    raise SystemExit(code or (0 if complete and cleanup and m['stopReason'] is None and m['preservedAfter']==before and m['ownedProducerAbsent'] else 1))
if __name__=='__main__':asyncio.run(main())
