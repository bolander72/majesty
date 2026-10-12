#!/usr/bin/env python3
"""Read one complete linked halo bundle in a bounded isolated native process."""
import argparse,asyncio,importlib.util,json,os,struct,tempfile,time
from pathlib import Path
from lib.native_pair_guard import owned_rows,stop_owned,stop_reason
ROOT=Path(__file__).resolve().parents[1];GAME=ROOT/'upstream/majesty-recomp'
spec=importlib.util.spec_from_file_location('regional_home',ROOT/'scripts/run-native-regional-home.py')
home=importlib.util.module_from_spec(spec);spec.loader.exec_module(home)
sha=home.sha;RUNNER_SHA=sha(Path(__file__))

async def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('preparation',type=Path);p.add_argument('--attempt',type=int,required=True);p.add_argument('--activate',action='store_true');p.add_argument('--reload-live',action='store_true');p.add_argument('--retire-source',action='store_true');p.add_argument('--selected-route',type=Path);a=p.parse_args()
 if sum([a.activate,a.reload_live,a.retire_source,bool(a.selected_route)])>1:p.error('Choose activation, fresh reload, selected owner or source retirement')
 region='0_0'if a.retire_source else '0_-1'
 live=a.activate or a.reload_live or bool(a.selected_route)
 out=ROOT/f'output/native-halo-bundle-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
 if a.attempt<1 or out.exists() or log.exists():p.error('Require fresh positive attempt')
 home.idle();prep_path=a.preparation.resolve();prep=home.bounded_json(prep_path)
 if prep.get('nativeReaderReady')is not True or prep.get('readerBuildStatus')!='qualified':p.error('Draft bundle cannot launch: regenerate after the official build succeeds')
 if not prep.get('closedHaloHeroBundlePrepared') or prep['plan']['sourceRegion']!='0_0' or prep['plan']['destinationRegion']!='0_-1':p.error('Current linked northern bundle required')
 for n,h in prep['sourceSha256'].items():
  if sha(ROOT/n)!=h:p.error('Preparation source changed')
 for r in prep['records']+[{'file':prep['pack']}]:
  f=r['file']
  if sha(f['filename'])!=f['sha256'] or Path(f['filename']).stat().st_size!=f['bytes']:p.error('Prepared bytes changed')
 archive_path=Path(prep['archive']['filename']);archive=home.bounded_json(archive_path)
 if sha(archive_path)!=prep['archive']['sha256'] or archive['generation']!=233:p.error('Crossing archive changed')
 for r in archive['sources']+archive['evidence']:
  if sha(r['preserved'])!=r['sha256'] or Path(r['preserved']).stat().st_size!=r['bytes']:p.error('Frozen producer changed')
 cold_archive_path=ROOT/'output/native-halo-bundle-generation-239/manifest.json';cold_archive=None
 if live:
  cold_archive=home.bounded_json(cold_archive_path)
  if not cold_archive.get('nativeLinkedHaloReaderQualified') or not cold_archive.get('originalCleanupQualified') or cold_archive.get('exactRecordCount')!=13:p.error('Qualified linked original-reader archive required')
  for r in cold_archive['sources']+cold_archive['evidence']:
   if sha(r['preserved'])!=r['sha256'] or Path(r['preserved']).stat().st_size!=r['bytes']:p.error('Frozen linked reader changed')
 def evidence(original):
  matches=[r for r in archive['evidence'] if r['original']==str(Path(original).resolve())]
  if len(matches)!=1:p.error('Missing or ambiguous frozen evidence')
  return matches[0]
 neighbor=home.bounded_json(Path(evidence(ROOT/'output/native-halo-region-north-001-observed.json')['preserved']))
 prior=home.bounded_json(Path(evidence(neighbor['manifest'])['preserved']))
 if not prior['nativeSessionTerminal'] or prior['nativeExitCode']!=0 or not prior['ownedProducerAbsent']:p.error('Original north producer is not terminal')
 build_path=Path(prep['build']['filename']);build=home.bounded_json(build_path);compiled={}
 if sha(build_path)!=prep['build']['sha256']:p.error('Build evidence changed')
 for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
  for n,h in build[group].items():
   if n in compiled:p.error('Overlapping native inputs')
   compiled[n]=h
 exe=GAME/'build/recomp/pop_smoke'
 if not build.get('nativeBuildQualified') or build['exitCode']!=0 or len(compiled)!=54 or any(sha(ROOT/n)!=h for n,h in compiled.items()):p.error('Complete current official build required')
 if prep['compiledSourceSha256']!=compiled or sha(exe)!=build['nativeExecutableSha256'] or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256'] or sha(GAME/'original/gog/MajestyHD - Old.exe')!=home.PIN:p.error('Native executable identity changed')
 source=prep['destinationCheckpoint']
 selected_receipt=None;selected_path=None;selected_head=None
 if a.selected_route:
  selected_path=a.selected_route.resolve();selected_receipt=home.bounded_json(selected_path)
  if not selected_receipt.get('selectedOriginalHaloOwnerPrepared') or not selected_receipt.get('nativeReaderReady') or selected_receipt['sourceClock']!=1000 or selected_receipt['expectedEndClock']!=1500:p.error('Qualified selected owner preparation required')
  if any(selected_receipt['build'][k]!=prep['build'][k]for k in ['filename','sha256']) or selected_receipt['compiledSourceSha256']!=compiled:p.error('Selected owner build differs')
  for n,h in selected_receipt['sourceSha256'].items():
   if sha(ROOT/n)!=h:p.error('Selected owner preparation source changed')
  route_dir=Path(selected_receipt['journal']).resolve()
  if not route_dir.is_relative_to(GAME/'build') or not route_dir.name.startswith('actor-arrival-fixture-hero-route-'):p.error('Require owned stopped journal')
  selected_head=route_dir/'Frontier_Hero_Route.checkpoint'
  if selected_head.read_text()!=selected_receipt['selected']['record']['manifest'] or selected_receipt['selected']['owner']['region']!='0_-1':p.error('Selected owner changed')
  for row in [selected_receipt['world'],selected_receipt['reloadIds']]:
   if sha(Path(row['filename']))!=row['sha256'] or Path(row['filename']).stat().st_size!=row['bytes']:p.error('Selected owner payload changed')
  source=selected_receipt['world']
 retired_destination_archive=None
 if a.retire_source:
  dest_path=ROOT/'output/native-halo-reload-generation-244/manifest.json';dest=home.bounded_json(dest_path)
  if not dest.get('nativeFreshHaloReloadQualified') or dest.get('evolvedClock')!=1000:p.error('Qualified destination reload required before retiring source')
  for r in dest['sources']+dest['evidence']:
   if sha(r['preserved'])!=r['sha256'] or Path(r['preserved']).stat().st_size!=r['bytes']:p.error('Frozen destination changed')
  retired_destination_archive=dict(filename=str(dest_path),sha256=sha(dest_path))
  source=prep['sourceCheckpoint']
 live_archive_path=ROOT/'output/native-halo-live-generation-241/manifest.json';live_archive=None;live_proof=None
 if a.reload_live:
  live_archive=home.bounded_json(live_archive_path)
  if not live_archive.get('nativeActivationQualified') or live_archive.get('ordinaryPlayMs')!=500:p.error('Qualified saved live bundle required')
  for r in live_archive['sources']+live_archive['evidence']:
   if sha(r['preserved'])!=r['sha256'] or Path(r['preserved']).stat().st_size!=r['bytes']:p.error('Frozen live generation changed')
  proof_rows=[r for r in live_archive['evidence'] if r['original']==str(ROOT/'output/native-halo-bundle-003-observed.json')]
  if len(proof_rows)!=1:p.error('Missing live proof')
  live_proof=home.bounded_json(Path(proof_rows[0]['preserved']))
  evolved=live_proof['liveEvidence']['worlds'][1]
  source_rows=[r for r in live_archive['evidence'] if r['original']==evolved['filename']]
  if len(source_rows)!=1 or source_rows[0]['sha256']!=evolved['sha256']:p.error('Missing qualified evolved checkpoint')
  source=source_rows[0]
 if sha(source['preserved'])!=source['sha256']:p.error('Northern save changed')
 before=home.baseline();run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-halo-world-bundle-',dir=GAME/'build'))
 private=run/'native/recomp';(private/'mods').mkdir(parents=True);private_exe=private/'pop_smoke';home.copy(exe,private_exe);private_exe.chmod(0o755)
 profile=run/('frontier_'+region);profile.mkdir();registry=run/'registry.json'
 for n,h in prior['inputHashes'].items():
  r=evidence(Path(prior['profile'])/n)
  if r['sha256']!=h:p.error('Frozen settings differ')
  home.copy(Path(r['preserved']),profile/n)
 copied=profile/f'Documents/My Games/MajestyHD/SaveGame/Frontier_{region}.GMP';home.copy(Path(source['preserved']),copied)
 content=home.PIN+':'+build['nativeExecutableSha256'];marker=profile/f'Frontier_{region}.checkpoint'
 marker.write_text(f"checkpoint-v1\n0\n{source['bytes']}\n{source['sha256']}\n{content}\n")
 reg=prep['registered']['record'];layout=profile/'Halo_Restore.layout'
 layout.write_text('\n'.join(['majesty-halo-reload-v1','halo-v1',region,str(source['bytes']),source['sha256'],reg['worldId'],reg['members'][0]['entityId'],reg['guildEntityId'],prior['nativeExecutableSha256'],'']))
 pack=profile/'Halo_Bundle.pack';home.copy(Path(prep['pack']['filename']),pack)
 for n in ['frames','user-mods']:(run/n).mkdir()
 script=run/'halo-bundle.script';script.write_text('wait 12000\ndump halo_bundle_loaded\nmove 400 300\nwait 8000\ndump halo_bundle_final\n')
 flags={'PROFILE_DIR':str(profile),'REGISTRY':str(registry),'RULE_FRONTIER_REGION':region,'RULE_FRONTIER_RESTORE':'1',
  'RULE_INVENTORY_COMPAT':'1','RULE_FRONTIER_SEEDED_GENERATION':'1','RULE_FRONTIER_CONNECTED_TERRAIN':'v1',
  'BROWSER_FRONTIER_HALO_TERRAIN':'v1','BROWSER_FRONTIER_HALO_RELOAD':'v1','BROWSER_FRONTIER_HALO_RELOAD_SNAPSHOT':'1',
  'BROWSER_FRONTIER_HALO_RESTORE_BINDING':sha(layout),'BROWSER_STREAMING_DEBUG':'1',
  'BROWSER_STREAMING_HALO_BUNDLE_IMPORT':'v1','BROWSER_STREAMING_HALO_BUNDLE_BINDING':sha(pack),
  'GUEST_ARGS':'-nointro -dochecksums','CONTENT_IDENTITY':content,'SMOKE_SECONDS':'25','SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600',
  'CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
 env={k:v for k,v in os.environ.items() if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()})
 reload_ids=None
 if live:env['RECOMP_BROWSER_STREAMING_HALO_BUNDLE_LIVE']='1'
 if a.reload_live:
  env.pop('RECOMP_BROWSER_STREAMING_HALO_BUNDLE_IMPORT');env['RECOMP_BROWSER_STREAMING_HALO_BUNDLE_RELOAD']='1'
  reload_ids=profile/'Halo_Live_Reload.ids';reload_ids.write_bytes(struct.pack('<9I',0x31524248,500,*live_proof['actualNativeUnitIds'],*live_proof['actualAgentIds']))
  env['RECOMP_BROWSER_STREAMING_HALO_BUNDLE_RELOAD_BINDING']=sha(reload_ids)
 if a.selected_route:
  env.pop('RECOMP_BROWSER_STREAMING_HALO_BUNDLE_IMPORT');env['RECOMP_BROWSER_STREAMING_HALO_BUNDLE_RELOAD']='1'
  env['RECOMP_BROWSER_STREAMING_HALO_ROUTE_SELECTED']='1'
  reload_ids=profile/'Halo_Live_Reload.ids';home.copy(Path(selected_receipt['reloadIds']['filename']),reload_ids)
  env['RECOMP_BROWSER_STREAMING_HALO_BUNDLE_RELOAD_BINDING']=sha(reload_ids)
 if a.retire_source:
  env.pop('RECOMP_BROWSER_STREAMING_HALO_BUNDLE_IMPORT');env['RECOMP_BROWSER_STREAMING_HALO_SOURCE_RETIRE']='1'
 if sha(Path(__file__))!=RUNNER_SHA or home.baseline()!=before or registry.exists():raise RuntimeError('Isolation preflight changed')
 def record(f):return dict(filename=str(f),bytes=f.stat().st_size,sha256=sha(f))
 m=dict(version=1,nativeOnly=True,browserUsed=False,fixture=str(run),profile=str(profile),region=region,layout='halo-v1',
  preparation=str(prep_path),preparationSha256=sha(prep_path),originalNorth=source,sourceCheckpoint=record(copied),
  buildReport=str(build_path),buildReportSha256=sha(build_path),compiledSourceSha256=compiled,nativeExecutableSha256=sha(private_exe),nativeSymbolsSha256=build['nativeSymbolsSha256'],
  privateNativeExecutable=str(private_exe),privateRegistry=str(registry),pack=record(pack),layoutMetadata=record(layout),
  inputHashes=prior['inputHashes'],runnerSha256=RUNNER_SHA,supervisorSha256=sha(ROOT/'scripts/run-native-regional-home.py'),guardSha256=sha(ROOT/'scripts/lib/native_pair_guard.py'),
  script=str(script),scriptSha256=sha(script),log=str(log),preservedBefore=before,resourceSamples=[],deadlineSeconds=35,
  rssCeilingBytes=512*1024*1024,logCeilingBytes=4*1024*1024,nativeProcessesStarted=1,nativeSessionTerminal=False,nativeExitCode=None,stopReason=None,
  nativeActivationRequested=live,nativeReloadRequested=a.reload_live or bool(a.selected_route),nativeSelectedOwnerRequested=bool(a.selected_route),nativeActivationQualified=False,sourceRetired=False,ownerPublished=False,goalComplete=False,
  selectedOwnerPreparation=dict(filename=str(selected_path),sha256=sha(selected_path))if selected_path else None,
  coldReaderArchive=dict(filename=str(cold_archive_path),sha256=sha(cold_archive_path))if live else None,
  liveProducerArchive=dict(filename=str(live_archive_path),sha256=sha(live_archive_path))if a.reload_live else None,
  nativeSourceRetirementRequested=a.retire_source,qualifiedDestinationArchive=retired_destination_archive,
  reloadIds=record(reload_ids)if reload_ids else None)
 home.idle()
 with log.open('x')as sink:
  proc=await asyncio.create_subprocess_exec(str(private_exe),cwd=GAME/'kit',env=env,stdout=sink,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
  m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);start=time.monotonic();print(json.dumps({'nativePid':proc.pid,'phase':'linked-halo-reader'}),flush=True)
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
 loaded=profile/'Documents/My Games/MajestyHD/SaveGame/Halo_Region_Reloaded.GMP'
 activated=loaded.parent/'Halo_Bundle_Activated.GMP';evolved=loaded.parent/'Halo_Bundle_Evolved.GMP'
 source_before=loaded.parent/'Halo_Source_Before.GMP';source_after=loaded.parent/'Halo_Source_Retired.GMP'
 frames=[run/'frames'/f'smoke_{n}_present.ppm'for n in ['halo_bundle_loaded','halo_bundle_final']]
 m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,ownedProducerAbsent=not owned_rows(home.rows(),[proc.pid],[proc.pid]),
  logSha256=sha(log),privateNativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'],preservedAfter=home.baseline(),
  sourceCheckpointUnchanged=sha(copied)==source['sha256'],packUnchanged=sha(pack)==prep['pack']['sha256'],layoutMetadataUnchanged=sha(layout)==m['layoutMetadata']['sha256'],
  loadedCheckpoint=record(loaded)if loaded.is_file()else None,frames=[record(f)for f in frames if f.is_file()],
  activatedCheckpoint=record(activated)if activated.is_file()else None,evolvedCheckpoint=record(evolved)if evolved.is_file()else None,
  sourceBeforeCheckpoint=record(source_before)if source_before.is_file()else None,retiredSourceCheckpoint=record(source_after)if source_after.is_file()else None)
 if selected_head:m['selectedOwnerManifestUnchanged']=selected_head.read_text()==selected_receipt['selected']['record']['manifest']
 text=log.read_text()if log.stat().st_size<=4*1024*1024 else ''
 endpoint='[streaming] Halo bundle live evolved 'if live else '[streaming] Halo bundle cleanup '
 startpoint='[streaming] Halo route owner reload 'if a.selected_route else '[streaming] Halo bundle fresh reload 'if a.reload_live else '[streaming] Halo bundle records '
 complete=code==0 and m['ownedProducerAbsent'] and m['stopReason']is None and m['preservedAfter']==before and m['sourceCheckpointUnchanged'] and m['packUnchanged'] and m['loadedCheckpoint']is not None and len(m['frames'])==2 and startpoint in text and endpoint in text
 if live:complete=complete and m['activatedCheckpoint']is not None and m['evolvedCheckpoint']is not None
 if a.selected_route:complete=complete and m['selectedOwnerManifestUnchanged']
 if a.retire_source:complete=code==0 and m['ownedProducerAbsent'] and m['stopReason']is None and m['preservedAfter']==before and m['sourceCheckpointUnchanged'] and m['loadedCheckpoint']is not None and len(m['frames'])==2 and m['sourceBeforeCheckpoint']is not None and m['retiredSourceCheckpoint']is not None and '[streaming] Halo source retired 'in text
 m['linkedHaloReaderTrialCompleted']=complete and not live and not a.retire_source;m['linkedHaloLiveTrialCompleted']=complete and live;m['nativeSourceRetirementTrialCompleted']=complete and a.retire_source;out.write_text(json.dumps(m,indent=2)+'\n')
 print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'completed':complete,'ownedProducerAbsent':m['ownedProducerAbsent']}),flush=True)
 raise SystemExit(code or (0 if complete else 1))
if __name__=='__main__':asyncio.run(main())
