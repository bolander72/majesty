#!/usr/bin/env python3
"""Resume a qualified original halo save in one isolated native process."""
import argparse,asyncio,importlib.util,json,os,tempfile,time
from pathlib import Path
from lib.native_pair_guard import owned_rows,stop_owned,stop_reason
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('regional_home',ROOT/'scripts/run-native-regional-home.py')
home=importlib.util.module_from_spec(spec);spec.loader.exec_module(home)
sha=home.sha;RUNNER_SHA=sha(Path(__file__))
async def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('build_report',type=Path);p.add_argument('archive',type=Path);p.add_argument('--attempt',type=int,required=True);p.add_argument('--observe-crossing',action='store_true');p.add_argument('--explore-bounty',action='store_true');a=p.parse_args()
 if a.explore_bounty and not a.observe_crossing:p.error('Explore bounty requires the outdoor crossing trial')
 out=ROOT/f'output/native-halo-reload-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
 if a.attempt<1 or out.exists() or log.exists():p.error('Require fresh positive attempt')
 home.idle();archive_path=a.archive.resolve();frozen=home.bounded_json(archive_path)
 expected_generation=225 if a.observe_crossing else 224
 required_flag='naturalHeroGuildDepartureQualified' if a.observe_crossing else 'nativeRecruitmentQualified'
 if frozen.get('generation')!=expected_generation or frozen.get(required_flag) is not True:p.error('Qualified frozen source generation required')
 for row in frozen['sources']+frozen['evidence']:
  if sha(row['preserved'])!=row['sha256'] or Path(row['preserved']).stat().st_size!=row['bytes']:p.error('Frozen provenance changed')
 def evidence(original):
  matching=[r for r in frozen['evidence'] if r['original']==str(Path(original).resolve())]
  if len(matching)!=1:p.error('Missing or ambiguous archived evidence')
  return matching[0]
 proof_name='native-halo-reload-001-observed.json' if a.observe_crossing else 'native-halo-recruitment-001-observed.json'
 proof_row=next(r for r in frozen['evidence'] if Path(r['original']).name==proof_name)
 proof=home.bounded_json(Path(proof_row['preserved']))
 if a.observe_crossing:
  if proof.get('naturalOriginalHeroGuildDepartureQualified') is not True or proof['hero']['physicalParentUnitId']!=0 or proof['clocks'][2]!=58850:p.error('Actual outdoor original hero save required')
 else:
  if proof.get('originalNativeHaloRecruitmentQualified') is not True or proof['hero']['physicalParentUnitId']!=469 or proof['sourceClockMs']!=28750:p.error('Actual recruited hero save required')
 prior=home.bounded_json(Path(evidence(proof['manifest'])['preserved']))
 if not prior['nativeSessionTerminal'] or not prior['ownedProducerAbsent'] or any(r['pid']==prior['nativePid'] for r in home.rows()):p.error('Prior producer must be terminal and absent')
 original=proof['evolvedCheckpoint'] if a.observe_crossing else proof['sourceCheckpoint'];source_row=evidence(original['filename']);source=Path(source_row['preserved'])
 source_clock=proof['clocks'][2] if a.observe_crossing else proof['sourceClockMs']
 if source_row['sha256']!=original['sha256'] or source_row['bytes']!=original['bytes']:p.error('Archived source save differs')
 build_path=a.build_report.resolve();build=home.bounded_json(build_path);compiled={}
 for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
  for n,h in build[group].items():
   if n in compiled:p.error('Overlapping compiled sources')
   compiled[n]=h
 exe=GAME/'build/recomp/pop_smoke'
 if not build.get('nativeBuildQualified') or build['exitCode']!=0 or len(compiled)!=53 or any(sha(ROOT/n)!=h for n,h in compiled.items()):p.error('Complete current official build required')
 if sha(exe)!=build['nativeExecutableSha256'] or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256'] or sha(GAME/'original/gog/MajestyHD - Old.exe')!=home.PIN:p.error('Executable identity changed')
 before=home.baseline();run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-halo-world-',dir=GAME/'build'));private=run/'native/recomp';(private/'mods').mkdir(parents=True)
 private_exe=private/'pop_smoke';home.copy(exe,private_exe);private_exe.chmod(0o755)
 profile=run/'frontier_0_0';profile.mkdir();registry=run/'registry.json'
 for n,h in prior['inputHashes'].items():
  row=evidence(Path(prior['profile'] if a.observe_crossing else prior['settingsProfile'])/n)
  if row['sha256']!=h:p.error('Frozen original settings differ')
  home.copy(Path(row['preserved']),profile/n)
 copied=profile/'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP';home.copy(source,copied)
 content=home.PIN+':'+build['nativeExecutableSha256'];marker=profile/'Frontier_0_0.checkpoint'
 marker.write_text(f"checkpoint-v1\n0\n{original['bytes']}\n{original['sha256']}\n{content}\n")
 registered=proof['registeredHome'];layout=profile/'Halo_Restore.layout'
 layout.write_text('\n'.join(['majesty-halo-reload-v1','halo-v1','0_0',str(original['bytes']),original['sha256'],registered['worldId'],registered['members'][0]['entityId'],registered['guildEntityId'],prior['nativeExecutableSha256'],'']))
 for n in ['frames','user-mods']:(run/n).mkdir()
 script=run/'halo-reload.script';script.write_text('wait 12000\ndump halo_motion_visible\nmove 400 300\nwait 18000\naction frontier-checkpoint\nwait 2000\ndump halo_motion_final\n' if a.observe_crossing else 'wait 12000\ndump halo_reload_visible\nmove 400 300\nwait 30000\naction frontier-checkpoint\nwait 2000\ndump halo_reload_evolved\n')
 flags={'PROFILE_DIR':str(profile),'REGISTRY':str(registry),'RULE_FRONTIER_REGION':'0_0','RULE_FRONTIER_RESTORE':'1',
  'RULE_INVENTORY_COMPAT':'1','RULE_FRONTIER_SEEDED_GENERATION':'1','RULE_FRONTIER_CONNECTED_TERRAIN':'v1',
  'BROWSER_FRONTIER_HALO_TERRAIN':'v1','BROWSER_FRONTIER_HALO_RELOAD':'v1','BROWSER_FRONTIER_HALO_RELOAD_SNAPSHOT':'1',
  'BROWSER_FRONTIER_HALO_RESTORE_BINDING':sha(layout),'GUEST_ARGS':'-nointro -dochecksums','CONTENT_IDENTITY':content,
  'SMOKE_SECONDS':'50','SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600','CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),
  'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
 if a.observe_crossing:flags.update({'BROWSER_FRONTIER_HALO_OBSERVE':'v1','BROWSER_FRONTIER_HALO_CROSSING_SNAPSHOT':'1','SMOKE_SECONDS':'35'})
 if a.explore_bounty:flags['BROWSER_FRONTIER_HALO_EXPLORE_BOUNTY']='1000'
 env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()})
 if sha(Path(__file__))!=RUNNER_SHA or home.baseline()!=before or registry.exists():raise RuntimeError('Isolation preflight changed')
 def record(n):return dict(filename=str(n),bytes=n.stat().st_size,sha256=sha(n))
 m=dict(version=1,nativeOnly=True,browserUsed=False,fixture=str(run),profile=str(profile),region='0_0',layout='halo-v1',freshWorld=False,
  archive=str(archive_path),archiveSha256=sha(archive_path),recruitmentProof=proof_row,originalSource=source_row,registeredHome=registered,
  sourceCheckpoint=record(copied),sourceClockMs=source_clock,sourceProducerNativeExecutableSha256=prior['nativeExecutableSha256'],observedCrossing=a.observe_crossing,exploreBounty=a.explore_bounty,
  layoutMetadata=record(layout),initialMarker=record(marker),privateNativeExecutable=str(private_exe),privateRegistry=str(registry),nativeExecutableSha256=sha(private_exe),
  buildReport=str(build_path),buildReportSha256=sha(build_path),compiledSourceSha256=compiled,nativeSymbolsSha256=build['nativeSymbolsSha256'],inputHashes=prior['inputHashes'],
  runnerSha256=RUNNER_SHA,supervisorSha256=sha(ROOT/'scripts/run-native-regional-home.py'),guardSha256=sha(ROOT/'scripts/lib/native_pair_guard.py'),
  script=str(script),scriptSha256=sha(script),log=str(log),preservedBefore=before,resourceSamples=[],deadlineSeconds=55,
  rssCeilingBytes=512*1024*1024,logCeilingBytes=4*1024*1024,nativeProcessesStarted=1,nativeSessionTerminal=False,nativeExitCode=None,stopReason=None,
  ownerPublished=False,heroCrossingQualified=False,goalComplete=False)
 if a.observe_crossing:m['sourceProof']=m.pop('recruitmentProof')
 home.idle()
 with log.open('x') as sink:
  proc=await asyncio.create_subprocess_exec(str(private_exe),cwd=GAME/'kit',env=env,stdout=sink,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
  m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);start=time.monotonic();print(json.dumps({'nativePid':proc.pid,'phase':'halo-save-reload'}),flush=True)
  try:
   while proc.returncode is None:
    rows=home.rows();owned=owned_rows(rows,[proc.pid],[proc.pid]);elapsed=time.monotonic()-start
    m['resourceSamples'].append(dict(sampledAtMs=time.time_ns()//1000000,ownedPids=[r['pid'] for r in owned],rssBytes=sum(r['rssBytes'] for r in owned)))
    m['stopReason']=stop_reason(rows,[proc.pid],elapsed,55,[log.stat().st_size],groups=[proc.pid],expected_producers=1);out.write_text(json.dumps(m,indent=2)+'\n')
    if m['stopReason']:break
    try:await asyncio.wait_for(asyncio.shield(proc.wait()),timeout=2)
    except asyncio.TimeoutError:pass
  finally:
   if proc.returncode is None:await stop_owned([proc],[proc.pid])
  code=await proc.wait()
 loaded=profile/'Documents/My Games/MajestyHD/SaveGame/Halo_Region_Reloaded.GMP';evolved=profile/'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0_Recovery.GMP'
 crossed=profile/'Documents/My Games/MajestyHD/SaveGame/Halo_Hero_Crossed.GMP'
 held=profile/'Documents/My Games/MajestyHD/SaveGame/Halo_Hero_Held.GMP'
 frames=[run/'frames'/f'smoke_{n}_present.ppm' for n in (['halo_motion_visible','halo_motion_final'] if a.observe_crossing else ['halo_reload_visible','halo_reload_evolved'])]
 m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,ownedProducerAbsent=not owned_rows(home.rows(),[proc.pid],[proc.pid]),
  logSha256=sha(log),privateNativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'],preservedAfter=home.baseline(),
  sourceCheckpointUnchanged=sha(copied)==original['sha256'],layoutMetadataUnchanged=sha(layout)==m['layoutMetadata']['sha256'],
  loadedCheckpoint=record(loaded) if loaded.is_file() else None,evolvedCheckpoint=record(evolved) if evolved.is_file() else None,crossingCheckpoint=record(crossed) if crossed.is_file() else None,heldCheckpoint=record(held) if held.is_file() else None,
  finalMarker=record(marker),frames=[record(f) for f in frames if f.is_file()])
 complete=code==0 and m['ownedProducerAbsent'] and m['stopReason'] is None and m['preservedAfter']==before and m['loadedCheckpoint'] is not None and (m['crossingCheckpoint'] and m['heldCheckpoint'] if a.observe_crossing else m['evolvedCheckpoint']) is not None and len(m['frames'])==2
 m['haloReloadTrialCompleted']=complete;out.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'completed':complete,'ownedProducerAbsent':m['ownedProducerAbsent']}),flush=True)
 raise SystemExit(code or (0 if complete else 1))
if __name__=='__main__':asyncio.run(main())
