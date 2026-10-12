#!/usr/bin/env python3
"""Return an actual remote owner to a journal-selected visited kingdom."""
import argparse,asyncio,importlib.util,json,os,re,tempfile,time
from pathlib import Path
from lib.native_pair_guard import owned_rows,stop_owned,stop_reason

ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('remote_restore_guard',ROOT/'scripts/run-native-regional-home.py')
guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard);sha=guard.sha
def record(path):
    path=Path(path).resolve();return dict(filename=str(path),bytes=path.stat().st_size,sha256=sha(path))

async def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('build',type=Path);p.add_argument('preparation',type=Path)
    p.add_argument('--attempt',type=int,required=True);a=p.parse_args()
    out=ROOT/f'output/native-hero-remote-backtrack-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():p.error('Preserve earlier trials')
    guard.idle();build_path=a.build.resolve();prep_path=a.preparation.resolve()
    build=guard.bounded_json(build_path);prep=guard.bounded_json(prep_path)
    if not prep.get('originalRemoteOwnerRestorePrepared') or prep.get('sourceOwnerRevision') not in (16,17) or prep.get('region')!='-5_-1':
        p.error('Require the actual stopped eighth-region owner')
    source_clock=prep.get('clock')
    if not isinstance(source_clock,int) or isinstance(source_clock,bool) or not 100<=source_clock<=0xffffffff:
        p.error('Require the verified selected saved clock')
    if prep['sourceOwnerRevision']==17 and not prep.get('progressedHeldOwnerPublished'):
        p.error('Require the actual published held owner save')
    motion_required=not (prep['sourceOwnerRevision']==17 and prep.get('originalHeroOrderEntries')==[])
    inputs=[prep[k] for k in ['archive','producer','inspection','sourceCheckpoint','sourceHead','identity']]
    preparation_script=prep.get('preparationScript')
    if preparation_script:
        if Path(preparation_script['filename']).resolve()!=ROOT/'scripts/prepare-native-hero-progressed-owner-restore.mjs':
            p.error('Unexpected progressed preparation script')
        inputs+=[preparation_script,*prep['originalJournalInputs'],prep['originalSourceHead']]
    if any(record(r['filename'])!=r for r in inputs) or (not preparation_script and sha(ROOT/'scripts/prepare-native-hero-remote-owner-restore.mjs')!=prep['preparationScriptSha256']):
        p.error('Prepared original inputs changed')
    original=json.loads(Path(prep['producer']['filename']).read_text())
    if not original['nativeSessionTerminal'] or not original['ownedProducerAbsent'] or original['nativeExitCode']!=0 or ('publicationWorkerPid' in original and not original['publicationWorkerAbsent']):
        p.error('Original producers are not terminal')
    for pid in [original['nativePid']]+([original['publicationWorkerPid']] if 'publicationWorkerPid' in original else []):
        try:os.kill(pid,0)
        except ProcessLookupError:pass
        else:p.error('Original producer is still present')
    compiled={}
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for name,digest in build[group].items():
            if name in compiled:p.error('Duplicate compiled input')
            compiled[name]=digest
    exe=GAME/'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build['exitCode']!=0 or len(compiled)!=54 or any(sha(ROOT/n)!=h for n,h in compiled.items()):
        p.error('Require the complete current official native build')
    if sha(exe)!=build['nativeExecutableSha256'] or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256'] or sha(GAME/'original/gog/MajestyHD - Old.exe')!=guard.PIN:
        p.error('Pinned executable or symbols changed')
    before=guard.baseline();run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-hero-binding-',dir=GAME/'build'))
    private=run/'native/recomp';(private/'mods').mkdir(parents=True);private_exe=private/'pop_smoke';guard.copy(exe,private_exe);private_exe.chmod(0o755)
    profile=run/'frontier_-5_-1';profile.mkdir();source=Path(prep['sourceCheckpoint']['filename'])
    settings=[];settings_profile=Path(prep.get('settingsProfile',str(Path(original['fixture'])/'frontier_0_0')))
    if settings_profile not in [Path(original['fixture'])/'frontier_0_0',Path(original['fixture'])/'frontier_-5_-1']:
        p.error('Settings must belong to the original producer')
    for name in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
        file=settings_profile/name
        if file.is_file():
            if file.is_symlink() or file.stat().st_size>1024*1024:p.error('Unexpected source settings')
            settings.append(record(file));guard.copy(file,profile/name)
    inputs+=settings
    copied=profile/'Documents/My Games/MajestyHD/SaveGame/Frontier_-5_-1.GMP';copied.parent.mkdir(parents=True);guard.copy(source,copied)
    journal=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-hero-route-backtrack-',dir=GAME/'build'));source_journal=Path(prep['sourceJournal'])
    journal_before={};total=0
    for file in sorted(source_journal.iterdir()):
        if file.is_symlink() or not file.is_file():p.error('Unexpected original journal entry')
        total+=file.stat().st_size
        if len(journal_before)>=128 or file.stat().st_size>1024*1024 or total>32*1024*1024:p.error('Original journal exceeds copy bound')
        journal_before[file.name]=sha(file);guard.copy(file,journal/file.name)
    if sha(journal/'Frontier_Hero_Route.checkpoint')!=prep['sourceHead']['sha256']:p.error('Copied head differs')
    content=guard.PIN+':'+build['nativeExecutableSha256']
    marker=profile/'Frontier_-5_-1.checkpoint'
    marker.write_text('\n'.join(['checkpoint-v1','0',str(prep['sourceCheckpoint']['bytes']),prep['sourceCheckpoint']['sha256'],content,'']))
    for name in ['user-mods','frames']:(run/name).mkdir()
    script=run/'remote-owner-restore.script'
    script.write_text('wait 45000\naction frontier-hero-travel-1\nwait 20000\ndump remote_backtrack_held\nmove 400 300\n')
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    flags=dict(PROFILE_DIR=str(profile),NATIVE_REGISTRY=str(run/'registry.json'),RULE_FRONTIER_REGION='-5_-1',
        RULE_FRONTIER_RESTORE='1',RULE_FRONTIER_HERO_RESTORE='v1',RULE_INVENTORY_COMPAT='1',
        FRONTIER_HERO_BINDING=prep['runtimeBinding'],FRONTIER_HERO_HALO_BINDING=prep['haloBinding'],
        FRONTIER_HERO_OWNER_MANIFEST=prep['ownerManifest'],CONTENT_IDENTITY=content,
        BROWSER_FRONTIER_HERO_PUBLICATION_TEST='v1',BROWSER_FRONTIER_HERO_PUBLICATION_JOURNAL=str(journal),
        BROWSER_FRONTIER_HERO_REMOTE_RESTORE_TEST='v1',BROWSER_FRONTIER_HERO_REMOTE_BACKTRACK_TEST='v1',
        BROWSER_FRONTIER_HERO_PAGE_TEST='v1',BROWSER_FRONTIER_HERO_PAGE_SNAPSHOT='1',GUEST_ARGS='-nointro -dochecksums',SMOKE_SECONDS='68',
        SMOKE_WINDOW_INPUT='1',SMOKE_DRAWABLE='800x600',CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),
        MODS_DIR=str(run/'user-mods'),HOST_DUMP_DIR=str(run/'frames'),SCRIPT=str(script))
    env.update({'RECOMP_'+k:v for k,v in flags.items()})
    m=dict(version=1,fixture=str(run),profile=str(profile),journal=str(journal),build=record(build_path),
        preparation=record(prep_path),originalInputs=inputs,settingsInputs=settings,sourceJournalBefore=journal_before,copiedSource=record(copied),
        copiedJournalHead=record(journal/'Frontier_Hero_Route.checkpoint'),compiledSourceSha256=compiled,
        nativeExecutableSha256=build['nativeExecutableSha256'],script=record(script),runnerSha256=sha(Path(__file__)),
        guardSha256=sha(ROOT/'scripts/lib/native_pair_guard.py'),supervisorSha256=sha(ROOT/'scripts/run-native-regional-home.py'),
        log=str(log),resourceSamples=[],deadlineSeconds=75,rssCeilingBytes=512*1024*1024,logCeilingBytes=4*1024*1024,
        preservedBefore=before,controlledNativeContentLabel=content,originalGMPBytesChanged=False,
        browserUsed=False,nativeProcessesStarted=1,nativeSessionTerminal=False,nativeExitCode=None,stopReason=None,
        nativeRemoteOwnerRestoreQualified=False,nativeRemoteBacktrackQualified=False,remoteBacktrack=True,sourceClock=source_clock,sourceOwnerRevision=prep['sourceOwnerRevision'],motionRequired=motion_required,ownerTransferred=False,goalComplete=False)
    guard.idle()
    worker_log=out.with_suffix('.publication.log');worker_file=ROOT/'scripts/stage-native-hero-remote-backtrack.mjs'
    m.update(publicationWorkerScript=record(worker_file),publicationLog=str(worker_log))
    with log.open('x') as stream,worker_log.open('x') as worker_stream:
        process=await asyncio.create_subprocess_exec(str(private_exe),cwd=GAME/'kit',env=env,stdout=stream,stderr=stream,start_new_session=True)
        m.update(nativePid=process.pid,startedAtMs=time.time_ns()//1000000);started=time.monotonic()
        out.write_text(json.dumps(m,indent=2)+'\n')
        worker=await asyncio.create_subprocess_exec('node','--max-old-space-size=96',str(worker_file),str(out),cwd=ROOT,env={k:v for k,v in env.items() if not k.startswith('RECOMP_')},stdout=worker_stream,stderr=worker_stream,start_new_session=True)
        m['publicationWorkerPid']=worker.pid
        print(json.dumps(dict(nativePid=process.pid,workerPid=worker.pid,phase='return-to-visited-kingdom')),flush=True)
        try:
            while process.returncode is None:
                rows=guard.rows();owned=owned_rows(rows,[process.pid,worker.pid],[process.pid,worker.pid])
                m['resourceSamples'].append(dict(sampledAtMs=time.time_ns()//1000000,rssBytes=sum(r['rssBytes'] for r in owned)))
                m['stopReason']=stop_reason(rows,[process.pid,worker.pid],time.monotonic()-started,75,[log.stat().st_size,worker_log.stat().st_size],groups=[process.pid,worker.pid],expected_producers=2)
                out.write_text(json.dumps(m,indent=2)+'\n')
                if worker.returncode is not None and worker.returncode!=0:m['stopReason']='publication-worker-failed'
                if m['stopReason']:break
                try:await asyncio.wait_for(asyncio.shield(process.wait()),timeout=2)
                except asyncio.TimeoutError:pass
        finally:
            if process.returncode is None or worker.returncode is None:await stop_owned([process,worker],[process.pid,worker.pid])
        code=await process.wait();worker_code=await worker.wait()
    text=log.read_text() if log.stat().st_size<=m['logCeilingBytes'] else ''
    held=re.findall(r'Hero save held serial=([12]) region=-5_-1 clock=(\d+) slot=([01]) bytes=(\d+) sha256=([0-9a-f]{64}) phase=7 pending=0',text)
    m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,logSha256=sha(log),
        ownedProducerAbsent=not owned_rows(guard.rows(),[process.pid],[process.pid]),publicationWorkerAbsent=not owned_rows(guard.rows(),[worker.pid],[worker.pid]),publicationWorkerExitCode=worker_code,publicationLogSha256=sha(worker_log),preservedAfter=guard.baseline(),
        originalInputsUnchanged=all(record(r['filename'])==r for r in inputs),
        sourceJournalUnchanged={f.name:sha(f) for f in sorted(source_journal.iterdir()) if f.is_file()}==journal_before,
        copiedJournalUnchanged={f.name:sha(f) for f in sorted(journal.iterdir()) if f.is_file()}==journal_before,
        nativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'])
    if len(held)==1:
        serial,clock,slot,size,digest=held[-1];saved=copied.parent/('Frontier_-5_-1'+('_Recovery' if slot=='1' else '')+'.GMP')
        m['savedCheckpoint']=record(saved);m['savedClock']=int(clock)
        assert m['savedCheckpoint']['bytes']==int(size) and m['savedCheckpoint']['sha256']==digest
    proof=run/'backtrack.json'
    if proof.is_file():
        observed=guard.bounded_json(proof);m['backtrack']=record(proof)
        m['nativeRemoteBacktrackQualified']=bool(observed.get('nativeRemoteBacktrackCompleted') and
            code==0 and worker_code==0 and not m['stopReason'] and m['ownedProducerAbsent'] and m['publicationWorkerAbsent'] and
            m['preservedBefore']==m['preservedAfter'] and m['originalInputsUnchanged'] and m['sourceJournalUnchanged'] and
            m['nativeExecutableUnchanged'] and observed['receipt']['ownerRevision']==19 and
            observed['otherSevenDormantEntriesUnchanged'] and 'Remote backtrack gameplay held region=-4_-1 ' in text and
            'Selected hero binding refused' not in text and 'undeliverable calls: none' in text)
    out.write_text(json.dumps(m,indent=2)+'\n')
    print(json.dumps(dict(nativeRemoteBacktrackQualified=m['nativeRemoteBacktrackQualified'],nativeExitCode=code,producerAbsent=m['ownedProducerAbsent'])))
    raise SystemExit(code or (0 if m['nativeRemoteBacktrackQualified'] else 1))

if __name__=='__main__':asyncio.run(main())
