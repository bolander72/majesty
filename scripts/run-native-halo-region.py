#!/usr/bin/env python3
"""Generate one fresh native halo map in an isolated, bounded smoke process."""
import argparse,asyncio,importlib.util,json,os,tempfile,time
from pathlib import Path
from lib.native_pair_guard import owned_rows,stop_owned,stop_reason
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('regional_home',ROOT/'scripts/run-native-regional-home.py')
home=importlib.util.module_from_spec(spec);spec.loader.exec_module(home)
sha=home.sha;RUNNER_SHA=sha(Path(__file__))
async def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('build_report',type=Path);p.add_argument('settings_preparation',type=Path)
    p.add_argument('--region',default='0_0');p.add_argument('--attempt',type=int,required=True);p.add_argument('--menu-only',action='store_true');p.add_argument('--camera-test',action='store_true');p.add_argument('--guild-test',action='store_true');p.add_argument('--recruit-test',action='store_true');p.add_argument('--hero-entry-ground-test',action='store_true');a=p.parse_args()
    if a.menu_only and (a.camera_test or a.guild_test or a.recruit_test):p.error('Choose one isolated menu or gameplay trial')
    if a.hero_entry_ground_test and (a.region!='-1_-1' or a.menu_only or a.camera_test or a.guild_test or a.recruit_test):p.error('Ground entry fixture requires only fresh region -1_-1')
    parts=a.region.split('_')
    try:
        coordinates=[int(n) for n in parts]
        if len(coordinates)!=2 or any(abs(n)>1000000 for n in coordinates) or '_'.join(str(n) for n in coordinates)!=a.region:raise ValueError()
    except ValueError:p.error('Canonical bounded region required')
    out=ROOT/f'output/native-halo-region-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
    if a.attempt<1 or out.exists() or log.exists():p.error('Require fresh positive attempt')
    home.idle();build_path=a.build_report.resolve();build=home.bounded_json(build_path);compiled={}
    for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
        for n,h in build[group].items():
            if n in compiled:p.error('Overlapping compiled sources')
            compiled[n]=h
    exe=GAME/'build/recomp/pop_smoke'
    if not build.get('nativeBuildQualified') or build['exitCode']!=0 or len(compiled)!=54 or any(sha(ROOT/n)!=h for n,h in compiled.items()):p.error('Complete current official build required')
    if sha(exe)!=build['nativeExecutableSha256'] or sha(GAME/'original/gog/MajestyHD - Old.exe')!=home.PIN:p.error('Executable identity changed')
    prep_path=a.settings_preparation.resolve();prep=home.bounded_json(prep_path);settings=Path(prep['settingsProfile'])
    if any(sha(settings/n)!=h for n,h in prep['inputHashes'].items()):p.error('Original settings changed')
    before=home.baseline();run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-halo-world-',dir=GAME/'build'))
    private=run/'native/recomp';(private/'mods').mkdir(parents=True);private_exe=private/'pop_smoke';home.copy(exe,private_exe);private_exe.chmod(0o755)
    profile=run/('frontier_'+a.region);profile.mkdir();registry=run/'registry.json'
    for n in prep['inputHashes']:home.copy(settings/n,profile/n)
    for n in ['frames','user-mods']:(run/n).mkdir()
    script=run/'halo-region.script'
    menu='wait 12000\ndump halo_initial_menu\nclick left 92 548\nwait 4000\ndump halo_play_selected\nclick left 298 428\nwait 6000\ndump halo_name_accepted\n'
    # Menu inspection never enables automatic generation. Gameplay geometry
    # uses the previously qualified original Beginner preset at the menu boundary.
    camera='wait 20000\ndump halo_before_camera\nclick left 139 18\nwait 3000\nmove 400 300\nwait 2000\ndump halo_region_generated\n'
    guild=camera+'click left 716 161\nwait 2000\ndump halo_guild_selected\n'
    recruit=guild+'click left 148 384\nwait 3000\ndump halo_recruit_started\nmove 400 300\nwait 13000\naction frontier-checkpoint\nwait 2000\ndump halo_recruit_completed\n'
    script.write_text(menu if a.menu_only else recruit if a.recruit_test else guild if a.guild_test else camera if a.camera_test else 'wait 25000\ndump halo_region_generated\n')
    deadline=60 if a.menu_only else 55 if a.recruit_test else 35
    flags={'PROFILE_DIR':str(profile),'REGISTRY':str(registry),'RULE_FRONTIER_REGION':a.region,'RULE_FRONTIER_RESTORE':'0',
        'RULE_INVENTORY_COMPAT':'1','RULE_FRONTIER_SEEDED_GENERATION':'1','RULE_FRONTIER_CONNECTED_TERRAIN':'v1',
        'BROWSER_FRONTIER_HALO_TERRAIN':'v1','BROWSER_FRONTIER_HALO_SNAPSHOT':'1','GUEST_ARGS':'-nointro -dochecksums',
        'CONTENT_IDENTITY':home.PIN+':'+build['nativeExecutableSha256'],'SMOKE_SECONDS':('50' if a.menu_only or a.recruit_test else '30' if a.guild_test else '25'),'SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600',
        'CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
    if not a.menu_only:flags['BROWSER_FRONTIER_HALO_AUTOGENERATE']='1'
    if a.hero_entry_ground_test:flags['BROWSER_FRONTIER_HERO_ENTRY_GROUND_TEST']='v1'
    if a.recruit_test:flags['BROWSER_FRONTIER_HALO_EVOLVED_SNAPSHOT']='1'
    env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()})
    if sha(Path(__file__))!=RUNNER_SHA or home.baseline()!=before or registry.exists():raise RuntimeError('Isolation preflight changed')
    m=dict(version=1,nativeOnly=True,browserUsed=False,fixture=str(run),profile=str(profile),region=a.region,layout='halo-v1',freshWorld=True,menuOnly=a.menu_only,cameraScripted=a.camera_test or a.guild_test or a.recruit_test,guildScripted=a.guild_test or a.recruit_test,recruitScripted=a.recruit_test,
        privateNativeExecutable=str(private_exe),privateRegistry=str(registry),nativeExecutableSha256=sha(private_exe),
        buildReport=str(build_path),buildReportSha256=sha(build_path),compiledSourceSha256=compiled,nativeSymbolsSha256=build['nativeSymbolsSha256'],
        settingsPreparation=str(prep_path),settingsPreparationSha256=sha(prep_path),settingsProfile=str(settings),inputHashes=prep['inputHashes'],
        runnerSha256=RUNNER_SHA,supervisorSha256=sha(ROOT/'scripts/run-native-regional-home.py'),guardSha256=sha(ROOT/'scripts/lib/native_pair_guard.py'),
        script=str(script),scriptSha256=sha(script),log=str(log),preservedBefore=before,resourceSamples=[],deadlineSeconds=deadline,automaticOriginalPreset=not a.menu_only,
        rssCeilingBytes=512*1024*1024,logCeilingBytes=4*1024*1024,nativeProcessesStarted=1,nativeSessionTerminal=False,nativeExitCode=None,
        stopReason=None,ownerPublished=False,heroCrossingQualified=False,heroEntryGroundFixture=a.hero_entry_ground_test,goalComplete=False)
    home.idle()
    with log.open('x') as sink:
        proc=await asyncio.create_subprocess_exec(str(private_exe),cwd=GAME/'kit',env=env,stdout=sink,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
        m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);start=time.monotonic();print(json.dumps({'nativePid':proc.pid,'region':a.region,'phase':'fresh-halo-generation'}),flush=True)
        try:
            while proc.returncode is None:
                rows=home.rows();owned=owned_rows(rows,[proc.pid],[proc.pid]);elapsed=time.monotonic()-start
                m['resourceSamples'].append(dict(sampledAtMs=time.time_ns()//1000000,ownedPids=[r['pid'] for r in owned],rssBytes=sum(r['rssBytes'] for r in owned)))
                m['stopReason']=stop_reason(rows,[proc.pid],elapsed,deadline,[log.stat().st_size],groups=[proc.pid],expected_producers=1);out.write_text(json.dumps(m,indent=2)+'\n')
                if m['stopReason']:break
                try:await asyncio.wait_for(asyncio.shield(proc.wait()),timeout=2)
                except asyncio.TimeoutError:pass
        finally:
            if proc.returncode is None:await stop_owned([proc],[proc.pid])
        code=await proc.wait()
    def record(n):return dict(filename=str(n),bytes=n.stat().st_size,sha256=sha(n))
    checkpoint=profile/'Documents/My Games/MajestyHD/SaveGame/Halo_Region_Saved.GMP';frame=run/'frames/smoke_halo_region_generated_present.ppm'
    evolved=profile/'Documents/My Games/MajestyHD/SaveGame/Halo_Region_Evolved.GMP'
    recruit_frame=run/'frames/smoke_halo_recruit_completed_present.ppm'
    player_marker=profile/('Frontier_'+a.region+'.checkpoint')
    player_saves=[profile/('Documents/My Games/MajestyHD/SaveGame/Frontier_'+a.region+suffix+'.GMP') for suffix in ['', '_Recovery']]
    m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,ownedProducerAbsent=not owned_rows(home.rows(),[proc.pid],[proc.pid]),
        logSha256=sha(log),originalSettingsUnchanged=all(sha(settings/n)==h for n,h in prep['inputHashes'].items()),
        privateNativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'],preservedAfter=home.baseline(),
        checkpoint=record(checkpoint) if checkpoint.is_file() else None,frame=record(frame) if frame.is_file() else None,
        evolvedCheckpoint=record(evolved) if evolved.is_file() else None,recruitFrame=record(recruit_frame) if recruit_frame.is_file() else None,
        playerCheckpointMarker=record(player_marker) if player_marker.is_file() else None,
        playerCheckpoints=[record(f) for f in player_saves if f.is_file()])
    complete=code==0 and m['ownedProducerAbsent'] and m['stopReason'] is None and m['preservedAfter']==before and m['checkpoint'] is not None and (not a.recruit_test or (m['playerCheckpointMarker'] is not None and len(m['playerCheckpoints'])==1 and m['recruitFrame'] is not None))
    m['haloGenerationTrialCompleted']=complete;out.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'completed':complete,'ownedProducerAbsent':m['ownedProducerAbsent']}),flush=True)
    raise SystemExit(code or (0 if complete else 1))
if __name__=='__main__':asyncio.run(main())
