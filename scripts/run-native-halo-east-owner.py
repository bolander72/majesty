#!/usr/bin/env python3
"""Reload and resume the journal-selected eastern owner in one supervised private native game."""
import argparse,asyncio,importlib.util,json,os,tempfile,time
from pathlib import Path
from lib.native_pair_guard import owned_rows,stop_owned,stop_reason
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('native_home_guard',ROOT/'scripts/run-native-regional-home.py')
home=importlib.util.module_from_spec(spec);spec.loader.exec_module(home);sha=home.sha;RUNNER_SHA=sha(Path(__file__))
def record(f):return dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f))
def journal_hashes(directory):
 d=Path(directory).resolve()
 if not d.is_relative_to(GAME/'build')or not d.name.startswith('actor-arrival-fixture-hero-route-'):raise RuntimeError('Require owned selected journal')
 return{f.name:sha(f)for f in sorted(d.iterdir())if f.is_file()}
async def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('preparation',type=Path);p.add_argument('--attempt',type=int,required=True);a=p.parse_args()
 out=ROOT/f'output/native-halo-east-owner-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
 if a.attempt<1 or out.exists()or log.exists():p.error('Preserve previous attempts')
 home.idle();prep_path=a.preparation.resolve();prep=home.bounded_json(prep_path)
 if not prep.get('selectedHaloEastOwnerPrepared')or not prep.get('ownerReaderRevoked')or prep['ownerExportDormantWorldsOpened']!=0 or prep['startClock']!=3550 or prep['endClock']!=4050:p.error('Qualified selected-eastern owner preparation required')
 for n,h in prep['sourceSha256'].items():
  if sha(ROOT/n)!=h:p.error('Source preparation changed')
 for r in [prep['publicationArchive'],prep['publicationProof'],prep['build']]:
  if sha(r['filename'])!=r['sha256']:p.error('Bound evidence changed')
 archive=home.bounded_json(Path(prep['publicationArchive']['filename']))
 if not archive.get('journalRunningHaloHandoffPublished')or archive.get('selectedRevision')!=5:p.error('Stopped homeward publication gate absent')
 for r in archive['sources']+archive['evidence']:
  if sha(r['preserved'])!=r['sha256']:p.error('Frozen publication gate changed')
 proof=home.bounded_json(Path(prep['publicationProof']['filename']))
 if not proof.get('journalRunningHaloHandoffPublished')or proof['selectedRevision']!=5 or prep['selected']['entry']['alias']!={'unitId':532,'agentId':35} or proof['selectedOwner']!=prep['selected']['owner']:p.error('Actual saved aliases differ')
 build=home.bounded_json(Path(prep['build']['filename']));compiled={}
 for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
  for n,h in build[group].items():
   if n in compiled:p.error('Duplicate compiled input')
   compiled[n]=h
 exe=GAME/'build/recomp/pop_smoke'
 if not build.get('nativeBuildQualified')or build['exitCode']!=0 or len(compiled)!=54 or compiled!=prep['compiledSourceSha256']or any(sha(ROOT/n)!=h for n,h in compiled.items()):p.error('Complete current official build required')
 if sha(exe)!=build['nativeExecutableSha256']or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']or sha(GAME/'original/gog/MajestyHD - Old.exe')!=home.PIN:p.error('Executable/symbol identity changed')
 for r in [prep['world'],prep['reloadIds']]:
  if sha(r['filename'])!=r['sha256']or Path(r['filename']).stat().st_size!=r['bytes']:p.error('Prepared save/identity changed')
 journal_before=journal_hashes(prep['journal'])
 if journal_before!=prep['journalSha256']or(Path(prep['journal'])/'Frontier_Hero_Route.checkpoint').read_text()!=prep['ownerManifest']:p.error('Selected journal changed')
 before=home.baseline();run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-halo-world-east-owner-',dir=GAME/'build'))
 private=run/'native/recomp';(private/'mods').mkdir(parents=True);private_exe=private/'pop_smoke';home.copy(exe,private_exe);private_exe.chmod(0o755)
 profile=run/'frontier_1_0';profile.mkdir();registry=run/'registry.json'
 for r in prep['settings']:
  if sha(r['preserved'])!=r['sha256']:p.error('Frozen settings changed')
  home.copy(Path(r['preserved']),profile/r['name'])
 source=prep['world'];copied=profile/'Documents/My Games/MajestyHD/SaveGame/Frontier_1_0.GMP';home.copy(Path(source['filename']),copied)
 content=home.PIN+':'+build['nativeExecutableSha256'];marker=profile/'Frontier_1_0.checkpoint'
 marker.write_text(f"checkpoint-v1\n0\n{source['bytes']}\n{source['sha256']}\n{content}\n")
 if marker.stem!=copied.stem or not marker.is_file():raise RuntimeError('Source region save and marker disagree')
 reg=prep['identity']['registeredHome'];layout=profile/'Halo_Restore.layout'
 layout.write_text('\n'.join(['majesty-halo-reload-v1','halo-v1','1_0',str(source['bytes']),source['sha256'],reg['worldId'],reg['members'][0]['entityId'],reg['guildEntityId'],prep['settingsProducerExecutableSha256'],'']))
 ids=profile/'Halo_East_Owner.ids';home.copy(Path(prep['reloadIds']['filename']),ids)
 for n in ['frames','user-mods']:(run/n).mkdir()
 script=run/'halo-east-owner.script';script.write_text('wait 12000\ndump halo_east_owner_loaded\nmove 400 300\nwait 10000\ndump halo_east_owner_final\n')
 flags={'PROFILE_DIR':str(profile),'REGISTRY':str(registry),'RULE_FRONTIER_REGION':'1_0','RULE_FRONTIER_RESTORE':'1',
  'RULE_INVENTORY_COMPAT':'1','RULE_FRONTIER_SEEDED_GENERATION':'1','RULE_FRONTIER_CONNECTED_TERRAIN':'v1',
  'BROWSER_FRONTIER_HALO_TERRAIN':'v1','BROWSER_FRONTIER_HALO_RELOAD':'v1','BROWSER_FRONTIER_HALO_RELOAD_SNAPSHOT':'1',
  'BROWSER_FRONTIER_HALO_RESTORE_BINDING':sha(layout),'BROWSER_STREAMING_DEBUG':'1','BROWSER_STREAMING_HALO_EAST_OWNER':'1',
  'BROWSER_STREAMING_HALO_EAST_OWNER_BINDING':sha(ids),'GUEST_ARGS':'-nointro -dochecksums','CONTENT_IDENTITY':content,
  'SMOKE_SECONDS':'27','SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600','CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),
  'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
 env={k:v for k,v in os.environ.items()if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()})
 if sha(Path(__file__))!=RUNNER_SHA or home.baseline()!=before or registry.exists():raise RuntimeError('Isolation preflight changed')
 m=dict(version=1,nativeOnly=True,browserUsed=False,fixture=str(run),profile=str(profile),region='1_0',layout='halo-v1',
  preparation=str(prep_path),preparationSha256=sha(prep_path),buildReport=prep['build']['filename'],buildReportSha256=prep['build']['sha256'],
  compiledSourceSha256=compiled,nativeExecutableSha256=sha(private_exe),nativeSymbolsSha256=build['nativeSymbolsSha256'],privateNativeExecutable=str(private_exe),
  privateRegistry=str(registry),sourceCheckpoint=record(copied),layoutMetadata=record(layout),reloadIds=record(ids),
  runnerSha256=RUNNER_SHA,supervisorSha256=sha(ROOT/'scripts/run-native-regional-home.py'),guardSha256=sha(ROOT/'scripts/lib/native_pair_guard.py'),
  script=str(script),scriptSha256=sha(script),log=str(log),preservedBefore=before,journalBefore=journal_before,resourceSamples=[],
  deadlineSeconds=35,rssCeilingBytes=512*1024*1024,logCeilingBytes=4*1024*1024,nativeProcessesStarted=1,nativeSessionTerminal=False,
  nativeExitCode=None,stopReason=None,nativeActivationQualified=False,sourceRetired=False,ownerPublished=False,goalComplete=False)
 home.idle()
 with log.open('x')as sink:
  proc=await asyncio.create_subprocess_exec(str(private_exe),cwd=GAME/'kit',env=env,stdout=sink,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
  m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);start=time.monotonic();print(json.dumps({'nativePid':proc.pid,'phase':'eastern-owner-reload'}),flush=True)
  try:
   while proc.returncode is None:
    rows=home.rows();owned=owned_rows(rows,[proc.pid],[proc.pid]);elapsed=time.monotonic()-start
    m['resourceSamples'].append(dict(sampledAtMs=time.time_ns()//1000000,ownedPids=[r['pid']for r in owned],rssBytes=sum(r['rssBytes']for r in owned)))
    m['stopReason']=stop_reason(rows,[proc.pid],elapsed,35,[log.stat().st_size],groups=[proc.pid],expected_producers=1);out.write_text(json.dumps(m,indent=2)+'\n')
    if m['stopReason']:break
    try:await asyncio.wait_for(asyncio.shield(proc.wait()),timeout=2)
    except asyncio.TimeoutError:pass
  finally:
   if proc.returncode is None:await stop_owned([proc],[proc.pid])
  code=await proc.wait()
 saved=copied.parent;worlds=[saved/(n+'.GMP')for n in ['Halo_East_Owner_Loaded','Halo_East_Owner_Ready','Halo_East_Owner_Evolved']]
 loaded=saved/'Halo_Region_Reloaded.GMP';frames=[run/'frames'/f'smoke_{n}_present.ppm'for n in ['halo_east_owner_loaded','halo_east_owner_final']]
 m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,ownedProducerAbsent=not owned_rows(home.rows(),[proc.pid],[proc.pid]),
  logSha256=sha(log),privateNativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'],preservedAfter=home.baseline(),journalAfter=journal_hashes(prep['journal']),
  sourceCheckpointUnchanged=sha(copied)==source['sha256'],reloadIdsUnchanged=sha(ids)==prep['reloadIds']['sha256'],layoutMetadataUnchanged=sha(layout)==m['layoutMetadata']['sha256'],
  loadedCheckpoint=record(loaded)if loaded.is_file()else None,worlds=[record(f)for f in worlds if f.is_file()],frames=[record(f)for f in frames if f.is_file()])
 text=log.read_text()if log.stat().st_size<=4*1024*1024 else ''
 complete=code==0 and m['ownedProducerAbsent']and m['stopReason']is None and m['preservedAfter']==before and m['journalAfter']==journal_before and m['sourceCheckpointUnchanged']and m['reloadIdsUnchanged']and m['layoutMetadataUnchanged']and m['loadedCheckpoint']is not None and len(m['worlds'])==3 and len(m['frames'])==2 and '[streaming] Halo east owner ready 'in text and '[streaming] Halo east owner evolved 'in text
 m['selectedHaloEastOwnerTrialCompleted']=complete;out.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'completed':complete,'ownedProducerAbsent':m['ownedProducerAbsent']}),flush=True)
 raise SystemExit(code or(0 if complete else 1))
if __name__=='__main__':asyncio.run(main())
