#!/usr/bin/env python3
"""Observe original whole-world disposal and replacement, in one native process."""
import argparse,json,os,shutil,subprocess,tempfile,time,runpy
from pathlib import Path
_r=runpy.run_path(str(Path(__file__).with_name('run-native-repeat-return.py')))
ROOT,GAME,SOURCES,sha=(_r[k] for k in ['ROOT','GAME','SOURCES','sha'])
from native_entity_pair import selected_revision_input

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('publication',type=Path);p.add_argument('receipt',type=Path);p.add_argument('build_report',type=Path)
    p.add_argument('--attempt',type=int,required=True);p.add_argument('--persist',action='store_true')
    p.add_argument('--visits',type=int,default=3);p.add_argument('--survivors',action='store_true');p.add_argument('--allocator',action='store_true');p.add_argument('--heap',action='store_true');p.add_argument('--allocation',action='store_true');p.add_argument('--owners',action='store_true');p.add_argument('--pages',action='store_true');p.add_argument('--page-context',action='store_true');a=p.parse_args()
    if a.attempt<=0:p.error('Attempt must be positive')
    if not 3<=a.visits<=32 or (a.visits!=3 and not a.persist):p.error('Extended visits require persistence and a count from3 through32')
    if a.survivors and not a.persist:p.error('Survivor observations require persistence')
    if a.allocator and not a.survivors:p.error('Allocator observations require survivor observations')
    if a.heap and not a.allocator:p.error('Heap observations require allocator observations')
    if a.allocation and not a.heap:p.error('Allocation site observations require all heap/persistence observations')
    if a.owners and not a.allocation:p.error('Buffer owner observations require allocation site observations')
    if a.pages and not a.owners:p.error('Page observations require all owner/cache and persistence observations')
    if a.page_context and not a.pages:p.error('Queue context observations require page observations')
    mode='world-persistence' if a.persist else 'world-residency'
    out=ROOT/f'output/native-{mode}-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if out.exists() or log.exists():p.error('Preserve prior residency attempts')
    rows=subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines()
    if any(Path(r.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for r in rows if len(r.split(None,1))==2):p.error('Another native game/build is live')
    checked=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/prepare-native-repeat-revision-inputs.mjs'),str(a.publication.resolve()),str(a.receipt.resolve()),'1']))
    prior=checked['producer'];source=Path(prior['profile']).resolve()
    if not source.is_relative_to((GAME/'build').resolve()) or source.name!='frontier_0_0':p.error('Require owned original settings')
    build=json.loads(a.build_report.read_text());executable=GAME/'build/recomp/pop_smoke';executable_hash=sha(executable);source_hashes={str(f.relative_to(ROOT)):sha(f) for f in SOURCES}
    if build.get('nativeBuildQualified') is not True or build.get('exitCode')!=0 or source_hashes!=build['nativeSourceSha256'] or executable_hash!=build['nativeExecutableSha256']:p.error('Current build provenance differs')
    frontier_key='upstream/majesty-recomp/browser_frontier.cpp'
    completed_tick=source_hashes[frontier_key]!=prior['nativeSourceSha256'][frontier_key]
    if completed_tick:
        if not a.heap:p.error('Completed-tick qualification requires all heap/persistence observations')
        subprocess.check_call(['node',str(ROOT/'scripts/check-native-completed-adapter.mjs'),source_hashes[frontier_key],prior['nativeSourceSha256'][frontier_key]],stdout=subprocess.DEVNULL)
    config_key='upstream/majesty-recomp/game.toml'
    if source_hashes[config_key]!=prior['nativeSourceSha256'][config_key]:p.error('Pinned configuration differs')
    receipt=json.loads(a.receipt.read_text())
    selected=[selected_revision_input(a.receipt,side,receipt['worlds'][side]['sha256']) for side in [0,1]]
    run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-world-residency-',dir=GAME/'build'));profile=run/'frontier_0_0';profile.mkdir();hashes={}
    for name in ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']:
        if sha(source/name)!=prior['inputHashes'][name]:p.error('Producer settings changed')
        dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,dest);hashes[name]=sha(dest)
        if hashes[name]!=prior['inputHashes'][name]:p.error('Settings changed during copy')
    for side in [0,1]:
        name=f'Residency_Source_{side}.GMP';shutil.copy2(selected[side]['filename'],profile/name);hashes[name]=sha(profile/name)
        if hashes[name]!=selected[side]['sha256'] or (profile/name).stat().st_size!=selected[side]['bytes']:p.error('Committed world changed during copy')
        if a.persist:
            initial=f'Residency_Initial_{side}.GMP';shutil.copy2(profile/name,profile/initial);hashes[initial]=sha(profile/initial)
            if hashes[initial]!=hashes[name]:p.error('Initial copy changed')
    name='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP';dest=profile/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(profile/'Residency_Source_1.GMP',dest);hashes[name]=sha(dest)
    for name in ['user-mods','frames']:(run/name).mkdir()
    script=run/'load-replace.script'
    click=lambda x,y:f'move {x} {y}\nwait 100\nbutton left down\nwait 100\nbutton left up\n'
    delays=[12000 if i%2 else 8000 for i in range(a.visits)]
    script.write_text('wait 10000\n'+''.join(click(92,578)+'wait 1000\n'+click(150,565)+f'wait {delay}\n'+(f'dump residency_menu_{i}\n' if a.visits==3 or i==a.visits-1 else '') for i,delay in enumerate(delays)))
    seconds=60 if a.visits==3 else (10000+sum(delays)+1600*a.visits+999)//1000+20
    for side in [0,1]:
        if selected_revision_input(a.receipt,side,receipt['worlds'][side]['sha256'])!=selected[side]:p.error('Current committed revision changed before launch')
    if source_hashes!={str(f.relative_to(ROOT)):sha(f) for f in SOURCES} or executable_hash!=sha(executable):p.error('Current build changed before launch')
    meta=dict(nativeOnly=True,browserUsed=False,nativeSessionTerminal=False,nativeExitCode=None,worldResidencyProbe=True,worldPersistenceProbe=a.persist,
        loadSequence=[0 if i%2 else 1 for i in range(a.visits)],loadExtents=[512 if i%2 else 256 for i in range(a.visits)],observedTicksPerLoad=20,usesOriginalPhaseRequest=True,usesOriginalDispatcherTeardown=True,
        profile=str(profile),fixture=str(run),log=str(log),inputHashes=hashes,
        publicationReport=str(a.publication.resolve()),publicationReportSha256=checked['publicationReportSha256'],selectedRevisionExports=selected,
        producerManifest=checked['producerManifest'],producerManifestSha256=checked['producerManifestSha256'],
        buildReport=str(a.build_report.resolve()),buildReportSha256=sha(a.build_report),
        nativeSourceSha256=source_hashes,nativeExecutableSha256AtLaunch=executable_hash,
        smokeScript=str(script),smokeScriptSha256=sha(script),smokeSeconds=seconds,clockMode='monotonic',
        observationFunctions=[0x00416050,0x00415e40,0x004170a0,0x00597ad0,0x00597980,0x0064d4b6])
    if completed_tick:meta['completedWorldTickProbe']=True
    out.write_text(json.dumps(meta,indent=2)+'\n')
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')}
    env.update(RECOMP_PROFILE_DIR=str(profile),RECOMP_RULE_FRONTIER_REGION='0_0',RECOMP_RULE_INVENTORY_COMPAT='1',RECOMP_BROWSER_STREAMING_DEBUG='1',RECOMP_BROWSER_STREAMING_WORLD_RESIDENCY_FIXTURE='1',
        RECOMP_GUEST_ARGS='-nointro -dochecksums',RECOMP_SMOKE_SECONDS=str(seconds),RECOMP_SMOKE_WINDOW_INPUT='1',RECOMP_SMOKE_DRAWABLE='800x600',
        RECOMP_CORE_MODS_DIR=str(GAME/'build/recomp/mods/core'),RECOMP_MODS_DIR=str(run/'user-mods'),RECOMP_HOST_DUMP_DIR=str(run/'frames'),RECOMP_SCRIPT=str(script))
    if a.persist:env.update(RECOMP_BROWSER_STREAMING_WORLD_PERSISTENCE_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_DEPARTED_RELOAD_FIXTURE='1',RECOMP_BROWSER_STREAMING_JOINT_EVOLVED_CHECKPOINT_FIXTURE='1')
    if a.survivors:
        env['RECOMP_BROWSER_STREAMING_WORLD_SURVIVOR_FIXTURE']='1'
        meta['worldSurvivorProbe']=True
    if a.allocator:
        env['RECOMP_BROWSER_STREAMING_WORLD_ALLOCATOR_FIXTURE']='1'
        meta['worldAllocatorProbe']=True
    if a.heap:
        runtime_sources=[GAME/'kit/runtime/memory.h',GAME/'kit/runtime/memory.cpp',GAME/'kit/runtime/tests/runtime_tests.cpp']
        meta['nativeHeapRuntimeSourceSha256']={str(f.relative_to(ROOT)):sha(f) for f in runtime_sources}
        if meta['nativeHeapRuntimeSourceSha256']!=build.get('nativeHeapRuntimeSourceSha256'):p.error('Heap runtime source provenance differs from build')
        env['RECOMP_BROWSER_STREAMING_WORLD_HEAP_FIXTURE']='1'
        meta['worldHeapProbe']=True
    if a.allocation:
        env['RECOMP_BROWSER_STREAMING_WORLD_ALLOCATION_FIXTURE']='1'
        meta.update(worldAllocationProbe=True,allocationObservationFunction=0x0064d5dd,
            allocationTargetRequestedBytes=12208,allocationEventLimit=1024,firstWorldLoadAllocationObserved=False,
            allocationCallerLayoutVersion=2)
    if a.owners:
        env['RECOMP_BROWSER_STREAMING_WORLD_OWNER_FIXTURE']='1'
        meta.update(worldOwnerProbe=True,ownerMetadataVersion=2,ownerMetadataRowBytes=72,
            ownerMetadataTargetLimit=512,ownerMetadataMaximumBytes=36904)
    if a.pages:
        env['RECOMP_BROWSER_STREAMING_WORLD_PAGE_FIXTURE']='1'
        meta.update(worldPageAllocationProbe=True,pageObservationFunction=0x0064d5dd,
            pageTargetRequestedBytes=4096,pageEventLimit=1024,firstWorldLoadPageAllocationObserved=False)
    if a.page_context:
        env['RECOMP_BROWSER_STREAMING_WORLD_PAGE_CONTEXT_FIXTURE']='1'
        meta.update(worldPageContextProbe=True,pageContextLayoutVersion=1,pageQueueFunction=0x0049ff10,
            pageQueueAllocationReturn=0x004a009a,pageQueueCallerStackOffset=56)
    if a.visits!=3:
        env['RECOMP_BROWSER_STREAMING_WORLD_RESIDENCY_VISITS']=str(a.visits)
        meta.update(resourceSamplingPeriodSeconds=2,nativeRssCeilingBytes=1024*1024*1024,nativeResourceSamples=[],resourceSamplingErrors=[],resourceSamplingStopReason=None)
    rows=subprocess.check_output(['ps','-axo','pid=,comm='],text=True).splitlines()
    if any(Path(r.split(None,1)[1]).name in ['pop_smoke','clang','clang++','ninja'] for r in rows if len(r.split(None,1))==2):p.error('Another native game/build became live before launch')
    with log.open('x') as f:
        meta['startedAtMs']=time.time_ns()//1000000;process=subprocess.Popen([str(executable)],cwd=GAME/'kit',stdout=f,stderr=subprocess.STDOUT,env=env)
        meta['nativePid']=process.pid;out.write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(dict(nativePid=process.pid,fixture=run.name)),flush=True)
        if a.visits==3:code=process.wait()
        else:
            while process.poll() is None:
                try:
                    values=subprocess.check_output(['ps','-p',str(process.pid),'-o','pid=,rss=,%cpu='],text=True,timeout=2).split()
                    if len(values)!=3 or int(values[0])!=process.pid:raise RuntimeError('Missing exact native resource sample')
                    sample=dict(sampledAtMs=time.time_ns()//1000000,pid=process.pid,rssBytes=int(values[1])*1024,cpuPercent=float(values[2]))
                    if len(meta['nativeResourceSamples'])>=256:raise RuntimeError('Native resource sample limit reached')
                    meta['nativeResourceSamples'].append(sample)
                    if sample['rssBytes']>meta['nativeRssCeilingBytes']:
                        meta['resourceSamplingStopReason']='native-rss-ceiling';process.terminate()
                except (subprocess.SubprocessError,ValueError,RuntimeError) as error:
                    if process.poll() is None:
                        if len(meta['resourceSamplingErrors'])<16:meta['resourceSamplingErrors'].append(type(error).__name__)
                        meta['resourceSamplingStopReason']='resource-sampling-failed';process.terminate()
                out.write_text(json.dumps(meta,indent=2)+'\n')
                try:process.wait(timeout=2)
                except subprocess.TimeoutExpired:pass
            code=process.wait()
    meta.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000);out.write_text(json.dumps(meta,indent=2)+'\n')
    print(json.dumps(dict(nativeExitCode=code,nativeSessionTerminal=True)),flush=True);raise SystemExit(code)
if __name__=='__main__':main()
