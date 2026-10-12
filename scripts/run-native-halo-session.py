#!/usr/bin/env python3
"""Exercise bound halo revisits and fresh expansion in one supervised private native engine."""
import argparse,asyncio,importlib.util,json,os,re,struct,tempfile,time
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
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('preparation',type=Path);p.add_argument('--attempt',type=int,required=True);p.add_argument('--actor-crossing',action='store_true');p.add_argument('--actor-retirement',action='store_true');p.add_argument('--actor-paging',action='store_true');p.add_argument('--actor-proxy',action='store_true');p.add_argument('--actor-epoch',action='store_true');p.add_argument('--actor-arrival',action='store_true');p.add_argument('--actor-activation',action='store_true')
 p.add_argument('--homeward-paging',action='store_true');p.add_argument('--pointer-paging',action='store_true');p.add_argument('--actor-move',action='store_true');p.add_argument('--saved-actor-paging',action='store_true');p.add_argument('--saved-actor-arrival',action='store_true');p.add_argument('--saved-actor-activation',action='store_true');p.add_argument('--saved-actor-return-page',action='store_true');p.add_argument('--saved-actor-home-arrival',action='store_true');p.add_argument('--saved-actor-home-activation',action='store_true');a=p.parse_args()
 a.saved_actor_home_arrival=a.saved_actor_home_arrival or a.saved_actor_home_activation
 a.saved_actor_return_page=a.saved_actor_return_page or a.saved_actor_home_arrival
 a.saved_actor_activation=a.saved_actor_activation or a.saved_actor_return_page
 a.saved_actor_arrival=a.saved_actor_arrival or a.saved_actor_activation
 a.saved_actor_paging=a.saved_actor_paging or a.saved_actor_arrival
 a.homeward_paging=a.homeward_paging or a.pointer_paging or a.saved_actor_paging
 a.actor_paging=a.actor_paging or a.saved_actor_paging
 a.actor_crossing=a.actor_crossing or a.actor_move
 a.actor_arrival=a.actor_arrival or a.actor_activation
 a.actor_epoch=a.actor_epoch or a.actor_arrival
 a.actor_proxy=a.actor_proxy or a.actor_epoch
 a.actor_paging=a.actor_paging or a.actor_proxy
 a.actor_retirement=a.actor_retirement or a.actor_paging
 a.actor_crossing=a.actor_crossing or a.actor_retirement
 out=ROOT/f'output/native-halo-session-attempt-{a.attempt:03}.json';log=out.with_suffix('.log')
 if a.attempt<1 or out.exists()or log.exists():p.error('Preserve previous attempts')
 home.idle();prep_path=a.preparation.resolve();prep=home.bounded_json(prep_path)
 if a.homeward_paging:
  if not prep.get('homewardSessionPrepared')or prep['selectedRevision']!=6 or prep['route']!=['0_0','1_0','0_0','1_0','0_0']:p.error('Current returned-home paging preparation required')
  if(a.actor_paging and not a.saved_actor_paging)or(a.actor_crossing and(a.pointer_paging or not prep.get('actorCrossing'))):p.error('Returned-home actor mode requires its bound crossing preparation and explicit saved-neighbor admission')
  if a.saved_actor_paging and(a.actor_proxy or a.actor_epoch or not prep.get('savedActorDestination')):p.error('Saved-neighbor paging requires its selected destination; fresh-world proxy/epoch handling is not admitted')
 elif not prep.get('haloSessionPrepared')or prep['selectedRevision']!=4 or prep['route']!=['0_0','0_-1','0_0','1_0','0_0']:p.error('Current selected-home session preparation required')
 for n,h in prep['sourceSha256'].items():
  if sha(ROOT/n)!=h:p.error('Source preparation changed')
 for r in [prep['publicationArchive'],prep['publicationProof'],prep['build']]:
  if sha(r['filename'])!=r['sha256']:p.error('Bound evidence changed')
 build=home.bounded_json(Path(prep['build']['filename']));compiled={}
 for group in ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']:
  for n,h in build[group].items():
   if n in compiled:p.error('Duplicate compiled input')
   compiled[n]=h
 exe=GAME/'build/recomp/pop_smoke'
 if not build.get('nativeBuildQualified')or build['exitCode']!=0 or len(compiled)!=54 or compiled!=prep['compiledSourceSha256']or any(sha(ROOT/n)!=h for n,h in compiled.items()):p.error('Complete current official build required')
 if sha(exe)!=build['nativeExecutableSha256']or sha(GAME/'build/recomp/gen/symbols.json')!=build['nativeSymbolsSha256']or sha(GAME/'original/gog/MajestyHD - Old.exe')!=home.PIN:p.error('Executable/symbol identity changed')
 for r in prep['worlds']:
  if sha(r['filename'])!=r['sha256']or Path(r['filename']).stat().st_size!=r['bytes']:p.error('Prepared world changed')
 journal_before=journal_hashes(prep['journal'])
 if journal_before!=prep['journalSha256']or(Path(prep['journal'])/'Frontier_Hero_Route.checkpoint').read_text()!=prep['selectedManifest']:p.error('Selected journal changed')
 saved_arrival_gate=None
 if a.saved_actor_arrival:
  gate=ROOT/'output/native-halo-saved-actor-generation-288/manifest.json';qualified=home.bounded_json(gate)
  if not qualified.get('nativeSavedActorDestinationPagingQualified')or not qualified.get('savedNeighborArrivalCapsulePrepared')or qualified['selectedRevision']!=6 or qualified['destinationClock']!=3750 or qualified['existingHomeProxy']!=34:p.error('Qualified saved-neighbor source/load/capsule required')
  for row in qualified['sources']+qualified['evidence']:
   if sha(Path(row['preserved']))!=row['sha256']:p.error('Frozen saved-neighbor qualification changed')
  saved_arrival_gate=record(gate)
 saved_activation_gate=None
 if a.saved_actor_activation:
  gate=ROOT/'output/native-halo-saved-arrival-generation-290/manifest.json';qualified=home.bounded_json(gate)
  if not qualified.get('nativeSavedNeighborActorArrivalQualified')or qualified['destinationClock']!=3750 or qualified['existingHomeProxy']!=34 or qualified['exactImportedRecordComparisons']!=4:p.error('Qualified saved import required')
  for row in qualified['sources']+qualified['evidence']:
   if sha(Path(row['preserved']))!=row['sha256']:p.error('Frozen saved import changed')
  saved_activation_gate=record(gate)
 saved_return_gate=None
 if a.saved_actor_return_page:
  gate=ROOT/'output/native-halo-saved-activation-generation-291/manifest.json';qualified=home.bounded_json(gate)
  if not qualified.get('nativeSavedNeighborActorActivationQualified')or not qualified.get('nativeSavedNeighborHomeLegQualified')or qualified['crossingClock']!=4050:p.error('Qualified saved-region activation and accepted return leg required')
  for row in qualified['sources']+qualified['evidence']:
   if sha(Path(row['preserved']))!=row['sha256']:p.error('Frozen saved continuation changed')
  saved_return_gate=record(gate)
 saved_home_gate=None
 if a.saved_actor_home_arrival:
  gate=ROOT/'output/native-halo-saved-return-page-generation-292/manifest.json';qualified=home.bounded_json(gate)
  if not qualified.get('nativeSavedNeighborReturnRetirementQualified')or not qualified.get('nativeSavedNeighborHomeReloadQualified')or not qualified.get('nativeSavedHomeArrivalCapsulePrepared')or qualified['destinationClock']!=103500 or qualified['homeArrivalPackBytes']!=3016:p.error('Qualified saved return retirement/home hold/capsule required')
  for row in qualified['sources']+qualified['evidence']:
   if sha(Path(row['preserved']))!=row['sha256']:p.error('Frozen saved return changed')
  saved_home_gate=record(gate)
 saved_home_activation_gate=None
 if a.saved_actor_home_activation:
  gate=ROOT/'output/native-halo-saved-home-arrival-generation-294/manifest.json';qualified=home.bounded_json(gate)
  if not qualified.get('nativeSavedHomeActorArrivalQualified')or not qualified.get('reciprocalHomeGuildMembershipQualified')or qualified['destinationClock']!=103500 or qualified['exactHomeArrivalRecords']!=4:p.error('Qualified original held home import required')
  for row in qualified['sources']+qualified['evidence']:
   if sha(Path(row['preserved']))!=row['sha256']:p.error('Frozen saved home import changed')
  saved_home_activation_gate=record(gate)
 before=home.baseline();run=Path(tempfile.mkdtemp(prefix='actor-arrival-fixture-halo-world-session-',dir=GAME/'build'))
 private=run/'native/recomp';(private/'mods').mkdir(parents=True);private_exe=private/'pop_smoke';home.copy(exe,private_exe);private_exe.chmod(0o755)
 root=run/'native-world-halo';root.mkdir();profile=root/'frontier_0_0';registry=run/'registry.json'
 content=home.PIN+':'+build['nativeExecutableSha256'];reg=prep['identity']['registeredHome']
 identities=[reg['worldId'],reg['members'][0]['entityId'],reg['guildEntityId'],prep['settingsProducerExecutableSha256']]
 session_layout=root/'Halo_Session.layout';session_layout.write_text('\n'.join(['majesty-halo-session-v1','halo-v1',*identities,content,'']))
 initial=[]
 for source in prep['worlds']:
  pr=root/f"frontier_{source['region']}";pr.mkdir()
  for r in prep['settings']:
   if sha(r['preserved'])!=r['sha256']:p.error('Frozen settings changed')
   home.copy(Path(r['preserved']),pr/r['name'])
  name='Frontier_'+source['region'];copied=pr/f'Documents/My Games/MajestyHD/SaveGame/{name}.GMP';home.copy(Path(source['filename']),copied)
  marker=pr/(name+'.checkpoint');marker.write_text(f"checkpoint-v1\n0\n{source['bytes']}\n{source['sha256']}\n{content}\n")
  layout=pr/'Halo_Restore.layout';layout.write_text('\n'.join(['majesty-halo-reload-v1','halo-v1',source['region'],str(source['bytes']),source['sha256'],*identities,'']))
  initial.append(dict(region=source['region'],world=record(copied),marker=record(marker),layout=record(layout)))
 # A wrong world identity must refuse before the source is saved or disposed.
 north=root/'frontier_0_-1/Halo_Restore.layout';qualified_north='';corrupt_layout=None
 if not a.homeward_paging:
  qualified_north=north.read_text();lines=qualified_north.splitlines();lines[5]='0'*64
  if not a.actor_crossing:north.write_text('\n'.join(lines)+'\n')
  corrupt_layout=record(north)
 for n in ['frames','user-mods','requests']:(run/n).mkdir()
 script=run/'halo-session.script';script.write_text('wait 45000\ndump halo_homeward_session_returned\n' if a.homeward_paging else 'wait 45000\ndump halo_session_actor_held\n' if a.actor_crossing else 'wait 25000\ndump halo_session_returned\n')
 if a.pointer_paging:script.write_text('wait 12000\nmove 799 300\nwait 14000\nmove 1 300\nwait 14000\nmove 400 300\nwait 5000\ndump halo_pointer_session_returned\n')
 flags={'PROFILE_DIR':str(profile),'REGISTRY':str(registry),'RULE_FRONTIER_REGION':'0_0','RULE_FRONTIER_RESTORE':'1',
  'RULE_FRONTIER_SESSION':'v1','RULE_INVENTORY_COMPAT':'1','RULE_FRONTIER_SEEDED_GENERATION':'1','RULE_FRONTIER_CONNECTED_TERRAIN':'v1',
  'BROWSER_FRONTIER_HALO_TERRAIN':'v1','BROWSER_FRONTIER_HALO_RELOAD':'v1','BROWSER_FRONTIER_HALO_SESSION':'v1',
  'BROWSER_FRONTIER_HALO_SESSION_BINDING':sha(session_layout),'BROWSER_FRONTIER_HALO_SESSION_SNAPSHOT':'1',
  'BROWSER_FRONTIER_HALO_SESSION_REQUEST':'v1',
  'GUEST_ARGS':'-nointro -dochecksums','CONTENT_IDENTITY':content,'SMOKE_SECONDS':'51' if a.homeward_paging else '31','SMOKE_WINDOW_INPUT':'1','SMOKE_DRAWABLE':'800x600',
  'CORE_MODS_DIR':str(GAME/'build/recomp/mods/core'),'MODS_DIR':str(run/'user-mods'),'HOST_DUMP_DIR':str(run/'frames'),'SCRIPT':str(script)}
 if a.pointer_paging:flags['RULE_FRONTIER_CROSSING']='v1'
 actor_ids=None;saved_actor_ids=None
 if a.actor_crossing:
  actor=prep['actorCrossing'];guild=actor['guild']
  if actor['sourceClock']!=(94550 if a.homeward_paging else 64150)or actor['sourceClock']!=prep['worlds'][0]['clock']or actor['unitId']!=prep['selectedOwner']['unitId']or actor['agentId']!=prep['selectedOwner']['agentId']or guild!={'kind':'native','unitId':469,'agentId':7}:p.error('Selected registered actor differs')
  ids=root/'Halo_Session_Actor.ids';ids.write_bytes(struct.pack('<9I',0x31415348,1,actor['sourceClock'],actor['unitId'],actor['agentId'],guild['unitId'],guild['agentId'],*actor['bountyPoint']));actor_ids=record(ids)
  flags.pop('BROWSER_FRONTIER_HALO_SESSION_REQUEST');flags.update(BROWSER_FRONTIER_HALO_SESSION_ACTOR='v1',BROWSER_FRONTIER_HALO_SESSION_ACTOR_BINDING=sha(ids),BROWSER_FRONTIER_HALO_EXPLORE_BOUNTY='1000',SMOKE_SECONDS='49')
 if a.actor_retirement:flags['BROWSER_FRONTIER_HALO_SESSION_RETIRE']='v1'
 if a.actor_paging:flags['BROWSER_FRONTIER_HALO_SESSION_ACTOR_PAGE']='v1'
 if a.actor_proxy:flags['BROWSER_FRONTIER_HALO_SESSION_HOME_PROXY']='v1'
 if a.actor_epoch:flags['BROWSER_FRONTIER_HALO_SESSION_DESTINATION_EPOCH']='v1'
 if a.actor_arrival:flags['BROWSER_FRONTIER_HALO_SESSION_ARRIVAL']='v1'
 if a.actor_activation:flags['BROWSER_FRONTIER_HALO_SESSION_ACTIVATE']='v1'
 if a.actor_move:flags['BROWSER_FRONTIER_HALO_SESSION_MOVE']='v1'
 if a.saved_actor_arrival:flags['BROWSER_FRONTIER_HALO_SESSION_SAVED_ARRIVAL']='v1'
 if a.saved_actor_activation:flags['BROWSER_FRONTIER_HALO_SESSION_SAVED_ACTIVATE']='v1'
 if a.saved_actor_return_page:flags['BROWSER_FRONTIER_HALO_SESSION_SAVED_RETURN']='v1'
 if a.saved_actor_home_arrival:flags['BROWSER_FRONTIER_HALO_SESSION_SAVED_HOME_ARRIVAL']='v1'
 if a.saved_actor_home_activation:flags['BROWSER_FRONTIER_HALO_SESSION_SAVED_HOME_ACTIVATE']='v1'
 if a.saved_actor_paging:
  dest=prep['savedActorDestination'];actor=prep['actorCrossing']
  if dest['region']!='1_0'or dest['clock']!=prep['worlds'][1]['clock']or dest['worldSha256']!=prep['worlds'][1]['sha256']or dest['homeAlias']!={'kind':'proxy','unitId':0,'agentId':34}or dest['homePlan']['admission']!='reuse-existing':p.error('Selected saved neighbor differs')
  ids=root/'Halo_Session_Saved.ids';ids.write_bytes(struct.pack('<8I',0x31534448,1,actor['sourceClock'],actor['unitId'],actor['agentId'],dest['clock'],dest['homeAlias']['agentId'],3));saved_actor_ids=record(ids)
  flags.update(BROWSER_FRONTIER_HALO_SESSION_SAVED_DESTINATION='v1',BROWSER_FRONTIER_HALO_SESSION_SAVED_BINDING=sha(ids))
 env={k:v for k,v in os.environ.items()if not k.startswith('RECOMP_')};env.update({'RECOMP_'+k:v for k,v in flags.items()})
 if sha(Path(__file__))!=RUNNER_SHA or home.baseline()!=before or registry.exists():raise RuntimeError('Isolation preflight changed')
 m=dict(version=1,nativeOnly=True,browserUsed=False,fixture=str(run),root=str(root),profile=str(profile),layout='halo-v1',route=prep['route'],
  preparation=str(prep_path),preparationSha256=sha(prep_path),buildReport=prep['build']['filename'],buildReportSha256=prep['build']['sha256'],
  compiledSourceSha256=compiled,nativeExecutableSha256=sha(private_exe),nativeSymbolsSha256=build['nativeSymbolsSha256'],privateNativeExecutable=str(private_exe),
  privateRegistry=str(registry),sessionLayout=record(session_layout),initialWorlds=initial,corruptNorthLayout=corrupt_layout,northLayoutRepair=None,
  runnerSha256=RUNNER_SHA,supervisorSha256=sha(ROOT/'scripts/run-native-regional-home.py'),guardSha256=sha(ROOT/'scripts/lib/native_pair_guard.py'),
  script=str(script),scriptSha256=sha(script),log=str(log),preservedBefore=before,journalBefore=journal_before,resourceSamples=[],
  deadlineSeconds=55 if a.actor_crossing or a.homeward_paging else 35,rssCeilingBytes=512*1024*1024,logCeilingBytes=4*1024*1024,nativeProcessesStarted=1,nativeSessionTerminal=False,
  nativeExitCode=None,stopReason=None,heroTransferred=False,ownerPublished=False,goalComplete=False)
 m['mode']='actor-activation'if a.actor_activation else'actor-arrival'if a.actor_arrival else'actor-epoch'if a.actor_epoch else'actor-proxy'if a.actor_proxy else'actor-paging'if a.actor_paging else'actor-retirement'if a.actor_retirement else'actor-crossing'if a.actor_crossing else'region-paging';m['actorIds']=actor_ids;m['actorHeldRequest']=None;m['actorRetirementRequest']=None;m['actorPagingRequest']=None;m['homeProxyRequest']=None;m['destinationEpochRequest']=None;m['actorArrivalRequest']=None;m['actorActivationRequest']=None
 if a.homeward_paging and not a.actor_crossing:m['mode']='homeward-region-paging'
 m['actorMoveRequested']=a.actor_move;m['savedActorPagingRequested']=a.saved_actor_paging;m['savedActorIds']=saved_actor_ids
 m['savedActorArrivalRequested']=a.saved_actor_arrival;m['savedActorArrivalRequest']=None;m['savedArrivalGate']=saved_arrival_gate
 m['savedActorActivationRequested']=a.saved_actor_activation;m['savedActorActivationRequest']=None;m['savedActivationGate']=saved_activation_gate
 m['savedActorReturnPageRequested']=a.saved_actor_return_page;m['savedActorReturnPageRequest']=None;m['savedReturnGate']=saved_return_gate
 m['savedActorHomeArrivalRequested']=a.saved_actor_home_arrival;m['savedActorHomeArrivalRequest']=None;m['savedHomeArrivalGate']=saved_home_gate
 m['savedActorHomeActivationRequested']=a.saved_actor_home_activation;m['savedActorHomeActivationRequest']=None;m['savedHomeActivationGate']=saved_home_activation_gate
 if a.saved_actor_paging:m['route']=['0_0','1_0']
 if a.pointer_paging:
  m['mode']='pointer-region-paging';m['route']=['0_0','1_0','0_0']
  m['pointerBridgeSourceSha256']={n:sha(ROOT/n)for n in ['scripts/native-halo-pointer-bridge.mjs','web/world/native-session-controls.mjs','web/world/region.mjs','web/world/world-name.mjs']}
  m['pointerBoundaryActions']=[]
 m['namedRequests']=[];phase=0;ready_at=None
 def request(serial,key,direction):
  sequence=len(m['namedRequests'])+1;text=f'halo-session-request-v1\n{sequence}\n{serial}\n{key}\n{direction}\n'
  preserved=run/'requests'/f'request_{sequence:03}.txt';preserved.write_text(text)
  temporary=root/'Halo_Session_Request.tmp';temporary.write_text(text);os.replace(temporary,root/'Halo_Session_Request.txt')
  m['namedRequests'].append(dict(sequence=sequence,serial=serial,region=key,direction=direction,atMs=time.time_ns()//1000000,packet=record(preserved)))
 home.idle()
 with log.open('x')as sink:
  proc=await asyncio.create_subprocess_exec(str(private_exe),cwd=GAME/'kit',env=env,stdout=sink,stderr=asyncio.subprocess.STDOUT,start_new_session=True)
  m.update(nativePid=proc.pid,startedAtMs=time.time_ns()//1000000);start=time.monotonic();print(json.dumps({'nativePid':proc.pid,'phase':'halo-region-session'}),flush=True)
  try:
   while proc.returncode is None:
    rows=home.rows();owned=owned_rows(rows,[proc.pid],[proc.pid]);elapsed=time.monotonic()-start
    m['resourceSamples'].append(dict(sampledAtMs=time.time_ns()//1000000,ownedPids=[r['pid']for r in owned],rssBytes=sum(r['rssBytes']for r in owned)))
    m['stopReason']=stop_reason(rows,[proc.pid],elapsed,m['deadlineSeconds'],[log.stat().st_size],groups=[proc.pid],expected_producers=1)
    if log.stat().st_size<=m['logCeilingBytes']:
     observed=log.read_text()
     if a.pointer_paging:
      boundaries=re.findall(r'^\[frontier\] Session boundary serial=(\d+) region=(\S+) direction=(\S+) gesture=(\d+) ',observed,re.M)
      if len([b for b in boundaries if int(b[0])<2])>len(m['namedRequests']):
       helper=ROOT/'scripts/native-halo-pointer-bridge.mjs'
       if any(sha(ROOT/n)!=h for n,h in m['pointerBridgeSourceSha256'].items()):raise RuntimeError('Pointer bridge source changed')
       child=await asyncio.create_subprocess_exec('node',str(helper),str(log),str(root),stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
       try:result,error=await asyncio.wait_for(child.communicate(),timeout=3)
       except asyncio.TimeoutError:
        child.kill();await child.wait();raise RuntimeError('Pointer bridge exceeded its bound')
       if child.returncode or len(result)>4096:raise RuntimeError('Production pointer session controls refused native boundary')
       actions=json.loads(result)['actions'];m['pointerBoundaryActions']=actions
       if len(actions)!=len(m['namedRequests'])+1:raise RuntimeError('Pointer boundary sequence differs')
       action=actions[-1];request(action['serial'],action['region'],action['direction'])
     if a.actor_crossing and m['actorHeldRequest']is None:
      crossing=re.search(r'Halo hero crossed source=0_0 destination=(\S+) unit=(\d+) agent=(\d+) previous-clock=(\d+) clock=(\d+) ',observed)
      if crossing:
       saved=root/'frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Actor_Crossed_0.GMP'
       if not saved.is_file()or(int(crossing[2]),int(crossing[3]))!=(prep['actorCrossing']['unitId'],prep['actorCrossing']['agentId']):raise RuntimeError('Accepted actor differs')
       text=f"halo-session-actor-hold-v1\n0\n0_0\n{crossing[2]}\n{crossing[3]}\n{crossing[5]}\n{sha(saved)}\n"
       packet=root/'Halo_Session_Actor_Hold.txt';temporary=packet.with_suffix('.tmp');temporary.write_text(text);os.replace(temporary,packet)
       m['actorHeldRequest']=dict(destination=crossing[1],clock=int(crossing[5]),crossed=record(saved),packet=record(packet),atMs=time.time_ns()//1000000)
     if a.actor_retirement and m['actorHeldRequest']and m['actorRetirementRequest']is None and '[frontier] Halo crossing held checkpoint 'in observed:
      out.write_text(json.dumps(m,indent=2)+'\n')
      helper=ROOT/'scripts/prepare-native-halo-session-retirement.mjs'
      prepare=await asyncio.create_subprocess_exec('node',str(helper),str(out),cwd=ROOT,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
      try:result,error=await asyncio.wait_for(prepare.communicate(),timeout=10)
      except asyncio.TimeoutError:
       if prepare.returncode is None:prepare.terminate()
       await prepare.wait();raise RuntimeError('Retirement preparation timed out and was stopped')
      if prepare.returncode or len(result)>2048 or len(error)>4096:raise RuntimeError('Retirement preparation refused: '+error.decode(errors='replace')[:1000])
      row=json.loads(result);receipt=Path(row['report']);m['actorRetirementRequest']=dict(preparation=record(receipt),helperSha256=sha(helper),ids=record(root/'Halo_Session_Actor_Retire.ids'),packet=record(root/'Halo_Session_Actor_Retire.txt'),atMs=time.time_ns()//1000000)
     if a.actor_paging and m['actorRetirementRequest']and m['actorPagingRequest']is None and '[frontier] Halo session retired checkpoint 'in observed:
      retired=root/'frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Actor_Retired_0.GMP'
      if not retired.is_file()or retired.stat().st_size>2*1024*1024:raise RuntimeError('Complete retired source required')
      source=record(retired);destination=m['actorHeldRequest']['destination'];clock=m['actorHeldRequest']['clock']
      if destination!='1_0':raise RuntimeError('Current trial requires the observed eastern crossing')
      text=f"halo-session-actor-page-v1\n0\n0_0\n{destination}\n{clock}\n{source['sha256']}\n"
      packet=root/'Halo_Session_Actor_Page.txt';temporary=packet.with_suffix('.tmp');temporary.write_text(text);os.replace(temporary,packet)
      m['actorPagingRequest']=dict(retired=source,destination=destination,clock=clock,packet=record(packet),atMs=time.time_ns()//1000000)
     if a.actor_epoch and m['actorPagingRequest']and m['destinationEpochRequest']is None and '[frontier] Halo session destination held serial=1 key=1_0 clock=0 'in observed:
      held=root/'frontier_1_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Destination_Held_1.GMP'
      if not held.is_file()or held.stat().st_size>2*1024*1024:raise RuntimeError('Held destination missing')
      world=record(held);text=f"halo-session-destination-epoch-v1\n1\n1_0\n0\n50\n{world['sha256']}\n"
      packet=root/'Halo_Session_Destination_Epoch.txt';temporary=packet.with_suffix('.tmp');temporary.write_text(text);os.replace(temporary,packet)
      m['destinationEpochRequest']=dict(held=world,packet=record(packet),beforeClock=0,afterClock=50,atMs=time.time_ns()//1000000)
     if a.saved_actor_arrival and m['actorPagingRequest']and m['savedActorArrivalRequest']is None and '[frontier] Halo session destination held serial=1 key=1_0 clock=3750 'in observed:
      out.write_text(json.dumps(m,indent=2)+'\n');helper=ROOT/'scripts/prepare-native-halo-saved-arrival.mjs';directory=ROOT/f'output/native-halo-saved-arrival-live-preparation-{a.attempt:03}'
      child=await asyncio.create_subprocess_exec('node',str(helper),str(out),str(directory),'--live',cwd=ROOT,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
      try:result,error=await asyncio.wait_for(child.communicate(),timeout=10)
      except asyncio.TimeoutError:
       child.kill();await child.wait();raise RuntimeError('Saved arrival preparation exceeded its bound')
      if child.returncode or len(result)>4096 or len(error)>4096:raise RuntimeError('Saved arrival preparation refused: '+error.decode(errors='replace')[:1200])
      receipt=directory/'preparation.json';arrival=home.bounded_json(receipt);pack=root/'frontier_1_0/Halo_Session_Saved_Arrival.pack'
      if pack.exists()or not arrival.get('savedNeighborArrivalCapsulePrepared')or not arrival.get('livePreparation')or arrival['pack']['bytes']!=2856:raise RuntimeError('Bound saved arrival package required')
      home.copy(Path(arrival['pack']['filename']),pack)
      if sha(pack)!=arrival['pack']['sha256']:raise RuntimeError('Saved arrival package changed')
      text=f"halo-session-saved-arrival-v1\n1\n1_0\n{arrival['options']['sourceClockMs']}\n3750\n{arrival['sourceWorld']['sha256']}\n{arrival['destinationWorld']['sha256']}\n{arrival['pack']['sha256']}\n2856\n"
      packet=root/'Halo_Session_Saved_Arrival.txt';temporary=packet.with_suffix('.tmp');temporary.write_text(text);os.replace(temporary,packet)
      m['savedActorArrivalRequest']=dict(preparation=record(receipt),helperSha256=sha(helper),pack=record(pack),packet=record(packet),atMs=time.time_ns()//1000000)
     if a.saved_actor_activation and m['savedActorArrivalRequest']and m['savedActorActivationRequest']is None and '[frontier] Halo saved arrival saved serial=1 key=1_0 'in observed:
      out.write_text(json.dumps(m,indent=2)+'\n');helper=ROOT/'scripts/prepare-native-halo-saved-activation.mjs';directory=ROOT/f'output/native-halo-saved-activation-preparation-{a.attempt:03}'
      child=await asyncio.create_subprocess_exec('node',str(helper),str(out),str(directory),cwd=ROOT,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
      try:result,error=await asyncio.wait_for(child.communicate(),timeout=10)
      except asyncio.TimeoutError:
       child.kill();await child.wait();raise RuntimeError('Saved activation preparation exceeded its bound')
      if child.returncode or len(result)>4096 or len(error)>4096:raise RuntimeError('Saved activation preparation refused: '+error.decode(errors='replace')[:1200])
      receipt=directory/'preparation.json';activation=home.bounded_json(receipt);packet=root/'Halo_Session_Saved_Activate.txt'
      if packet.exists()or not activation.get('nativeSavedActorActivationPrepared'):raise RuntimeError('Bound saved activation request required')
      temporary=packet.with_suffix('.tmp');home.copy(Path(activation['packet']['filename']),temporary);os.replace(temporary,packet)
      m['savedActorActivationRequest']=dict(preparation=record(receipt),helperSha256=sha(helper),imported=activation['imported'],packet=record(packet),atMs=time.time_ns()//1000000)
     if a.saved_actor_return_page and m['savedActorActivationRequest']and m['savedActorReturnPageRequest']is None and '[frontier] Halo saved continuation held serial=1 key=1_0 clock=4050 'in observed:
      out.write_text(json.dumps(m,indent=2)+'\n');helper=ROOT/'scripts/prepare-native-halo-saved-return-page.mjs';directory=ROOT/f'output/native-halo-saved-return-page-preparation-{a.attempt:03}'
      child=await asyncio.create_subprocess_exec('node',str(helper),str(out),str(directory),cwd=ROOT,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
      try:result,error=await asyncio.wait_for(child.communicate(),timeout=10)
      except asyncio.TimeoutError:
       child.kill();await child.wait();raise RuntimeError('Saved return paging preparation exceeded its bound')
      if child.returncode or len(result)>4096 or len(error)>4096:raise RuntimeError('Saved return paging refused: '+error.decode(errors='replace')[:1200])
      receipt=directory/'preparation.json';arrival=home.bounded_json(receipt);packet=root/'Halo_Session_Saved_Return_Page.txt'
      if packet.exists()or not arrival.get('nativeSavedActorReturnPagePrepared'):raise RuntimeError('Bound saved return request required')
      temporary=packet.with_suffix('.tmp');home.copy(Path(arrival['packet']['filename']),temporary);os.replace(temporary,packet)
      m['savedActorReturnPageRequest']=dict(preparation=record(receipt),helperSha256=sha(helper),crossed=arrival['crossed'],homeWorld=arrival['homeWorld'],packet=record(packet),atMs=time.time_ns()//1000000)
     if a.saved_actor_home_arrival and m['savedActorReturnPageRequest']and m['savedActorHomeArrivalRequest']is None and '[frontier] Halo saved return home held serial=2 key=0_0 clock=103500 'in observed:
      out.write_text(json.dumps(m,indent=2)+'\n');helper=ROOT/'scripts/prepare-native-halo-saved-home-arrival.mjs';directory=ROOT/f'output/native-halo-saved-home-arrival-live-preparation-{a.attempt:03}'
      child=await asyncio.create_subprocess_exec('node',str(helper),str(out),str(directory),'--live',cwd=ROOT,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
      try:result,error=await asyncio.wait_for(child.communicate(),timeout=10)
      except asyncio.TimeoutError:
       child.kill();await child.wait();raise RuntimeError('Saved home arrival preparation exceeded its bound')
      if child.returncode or len(result)>4096 or len(error)>4096:raise RuntimeError('Saved home arrival refused: '+error.decode(errors='replace')[:1200])
      receipt=directory/'preparation.json';arrival=home.bounded_json(receipt);pack=root/'frontier_0_0/Halo_Saved_Home_Arrival.pack';packet=root/'Halo_Session_Saved_Home_Arrival.txt'
      if pack.exists()or packet.exists()or not arrival.get('nativeSavedHomeArrivalCapsulePrepared')or not arrival.get('livePreparation')or arrival['pack']['bytes']!=3016:raise RuntimeError('Bound saved home arrival package required')
      temporary=pack.with_suffix('.tmp');home.copy(Path(arrival['pack']['filename']),temporary);os.replace(temporary,pack)
      temporary=packet.with_suffix('.tmp');home.copy(Path(arrival['packet']['filename']),temporary);os.replace(temporary,packet)
      m['savedActorHomeArrivalRequest']=dict(preparation=record(receipt),helperSha256=sha(helper),crossed=arrival['sourceWorld'],retired=arrival['retiredWorld'],homeWorld=arrival['homeWorld'],pack=record(pack),packet=record(packet),atMs=time.time_ns()//1000000)
     if a.saved_actor_home_activation and m['savedActorHomeArrivalRequest']and m['savedActorHomeActivationRequest']is None and '[frontier] Halo saved home arrival saved serial=2 key=0_0 'in observed:
      out.write_text(json.dumps(m,indent=2)+'\n');helper=ROOT/'scripts/prepare-native-halo-saved-home-activation.mjs';directory=ROOT/f'output/native-halo-saved-home-activation-preparation-{a.attempt:03}'
      child=await asyncio.create_subprocess_exec('node',str(helper),str(out),str(directory),cwd=ROOT,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
      try:result,error=await asyncio.wait_for(child.communicate(),timeout=10)
      except asyncio.TimeoutError:
       child.kill();await child.wait();raise RuntimeError('Saved home activation preparation exceeded its bound')
      if child.returncode or len(result)>4096 or len(error)>4096:raise RuntimeError('Saved home activation refused: '+error.decode(errors='replace')[:1200])
      receipt=directory/'preparation.json';activation=home.bounded_json(receipt);packet=root/'Halo_Session_Saved_Home_Activate.txt'
      if packet.exists()or not activation.get('nativeSavedHomeActivationPrepared'):raise RuntimeError('Bound saved home activation request required')
      temporary=packet.with_suffix('.tmp');home.copy(Path(activation['packet']['filename']),temporary);os.replace(temporary,packet)
      m['savedActorHomeActivationRequest']=dict(preparation=record(receipt),helperSha256=sha(helper),imported=activation['imported'],packet=record(packet),atMs=time.time_ns()//1000000)
     proxy_boundary='[frontier] Halo session epoch held serial=1 key=1_0 clock=50 'if a.actor_epoch else'[frontier] Halo session destination held serial=1 key=1_0 clock=0 '
     if a.actor_proxy and m['actorPagingRequest']and m['homeProxyRequest']is None and proxy_boundary in observed:
      out.write_text(json.dumps(m,indent=2)+'\n');helper=ROOT/'scripts/prepare-native-halo-session-proxy.mjs'
      prepare=await asyncio.create_subprocess_exec('node',str(helper),str(out),cwd=ROOT,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
      try:result,error=await asyncio.wait_for(prepare.communicate(),timeout=10)
      except asyncio.TimeoutError:
       if prepare.returncode is None:prepare.terminate()
       await prepare.wait();raise RuntimeError('Home proxy preparation timed out and was stopped')
      if prepare.returncode or len(result)>2048 or len(error)>4096:raise RuntimeError('Home proxy preparation refused: '+error.decode(errors='replace')[:1000])
      row=json.loads(result);receipt=Path(row['report']);m['homeProxyRequest']=dict(preparation=record(receipt),helperSha256=sha(helper),proposal=record(root/'frontier_1_0/Halo_Session_Home_Proposal.GPL'),packet=record(root/'Halo_Session_Home_Proxy.txt'),atMs=time.time_ns()//1000000)
     if a.actor_arrival and m['homeProxyRequest']and m['actorArrivalRequest']is None and '[frontier] Halo session proxy ready serial=1 key=1_0 'in observed:
      out.write_text(json.dumps(m,indent=2)+'\n');helper=ROOT/'scripts/prepare-native-halo-session-arrival.mjs'
      directory=ROOT/f'output/native-halo-session-arrival-live-preparation-{a.attempt:03}'
      prepare=await asyncio.create_subprocess_exec('node',str(helper),str(out),str(directory),'--live',cwd=ROOT,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
      try:result,error=await asyncio.wait_for(prepare.communicate(),timeout=10)
      except asyncio.TimeoutError:
       if prepare.returncode is None:prepare.terminate()
       await prepare.wait();raise RuntimeError('Arrival preparation timed out and was stopped')
      if prepare.returncode or len(result)>2048 or len(error)>4096:raise RuntimeError('Arrival preparation refused: '+error.decode(errors='replace')[:1000])
      row=json.loads(result);receipt=Path(row['report']);arrival=home.bounded_json(receipt)
      proposal=root/'frontier_1_0/Halo_Session_Arrival.pack'
      if proposal.exists():raise RuntimeError('Preserve previous arrival package')
      home.copy(Path(arrival['pack']['filename']),proposal)
      if sha(proposal)!=arrival['pack']['sha256']or proposal.stat().st_size!=3786:raise RuntimeError('Arrival package changed')
      text=f"halo-session-arrival-v1\n1\n1_0\n{arrival['options']['sourceClockMs']}\n50\n{arrival['sourceWorld']['sha256']}\n{arrival['destinationWorld']['sha256']}\n{arrival['pack']['sha256']}\n3786\n"
      packet=root/'Halo_Session_Arrival.txt';temporary=packet.with_suffix('.tmp');temporary.write_text(text);os.replace(temporary,packet)
      m['actorArrivalRequest']=dict(preparation=record(receipt),helperSha256=sha(helper),pack=record(proposal),packet=record(packet),atMs=time.time_ns()//1000000)
     if a.actor_activation and m['actorArrivalRequest']and m['actorActivationRequest']is None and '[frontier] Halo session arrival saved serial=1 key=1_0 'in observed:
      imported=root/'frontier_1_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Arrival_Imported_1.GMP'
      if not imported.is_file()or not 0<imported.stat().st_size<=2*1024*1024:raise RuntimeError('Bound imported save missing')
      text=f"halo-session-activate-v1\n1\n1_0\n50\n3550\n{sha(imported)}\n"
      packet=root/'Halo_Session_Activate.txt';temporary=packet.with_suffix('.tmp');temporary.write_text(text);os.replace(temporary,packet)
      m['actorActivationRequest']=dict(imported=record(imported),packet=record(packet),atMs=time.time_ns()//1000000)
     if not a.actor_crossing and not a.homeward_paging and phase==1 and '[frontier] Session destination refused source=0_0 target=0_-1' in observed:
      if '[frontier] Session checkpoint serial='in observed or sha(north)!=corrupt_layout['sha256']:raise RuntimeError('Refusal changed source before correction')
      temporary=north.with_suffix('.repair');temporary.write_text(qualified_north);os.replace(temporary,north)
      m['northLayoutRepair']=dict(afterRefusal=True,beforeCheckpoint=True,atMs=time.time_ns()//1000000,layout=record(north))
      phase=2;ready_at=time.monotonic()
     steps={0:(0,'0_0',1),2:(0,'0_0',1),3:(1,'0_-1',2),4:(2,'0_0',3),5:(3,'1_0',0),6:(4,'0_0',4)}
     if a.homeward_paging:steps={0:(0,'0_0',3),1:(1,'1_0',0),2:(2,'0_0',3),3:(3,'1_0',0)}
     if not a.actor_crossing and not a.pointer_paging and phase in steps:
      serial,key,direction=steps[phase]
      marker=('[frontier] Region 0_0 ready' if phase==0 or (phase==2 and not a.homeward_paging) else f'[frontier] Session attached serial={serial} region={key} ')
      snapshot=root/f'frontier_{key}/Documents/My Games/MajestyHD/SaveGame'/f"Halo_Session_{'Generated' if phase==5 and not a.homeward_paging else 'Reloaded'}_{serial}.GMP"
      if marker in observed and snapshot.is_file():
       if ready_at is None:ready_at=time.monotonic()
       if time.monotonic()-ready_at>=.8:
        request(serial,key,direction);phase+=1;ready_at=None
    out.write_text(json.dumps(m,indent=2)+'\n')
    if m['stopReason']:break
    try:await asyncio.wait_for(asyncio.shield(proc.wait()),timeout=.25)
    except asyncio.TimeoutError:pass
  except Exception as error:
   m['preparationFailure']=f'{type(error).__name__}: {error}'[:1600]
   m['stopReason']='preparation-error'
  finally:
   if proc.returncode is None:await stop_owned([proc],[proc.pid])
  code=await proc.wait()
 files=[record(f)for f in sorted(root.rglob('*'))if f.is_file()and f.suffix in ['.GMP','.GPL','.UNIT','.bin','.pack','.layout','.checkpoint']]
 frames=[record(f)for f in sorted((run/'frames').glob('*.ppm'))]
 m.update(nativeSessionTerminal=True,nativeExitCode=code,finishedAtMs=time.time_ns()//1000000,ownedProducerAbsent=not owned_rows(home.rows(),[proc.pid],[proc.pid]),
  logSha256=sha(log),privateNativeExecutableUnchanged=sha(private_exe)==build['nativeExecutableSha256'],preservedAfter=home.baseline(),journalAfter=journal_hashes(prep['journal']),
  sessionLayoutUnchanged=sha(session_layout)==m['sessionLayout']['sha256'],files=files,frames=frames)
 text=log.read_text()if log.stat().st_size<=m['logCeilingBytes']else ''
 complete=code==0 and m['ownedProducerAbsent']and m['stopReason']is None and m['preservedAfter']==before and m['journalAfter']==journal_before and m['sessionLayoutUnchanged']and bool(m['northLayoutRepair'])and '[frontier] Halo session generated ready serial=3 key=1_0 'in text and '[frontier] Session attached serial=4 region=0_0 mode=saved 'in text
 m['haloSessionTrialCompleted']=complete
 if a.homeward_paging:
  complete=code==0 and m['ownedProducerAbsent']and m['stopReason']is None and m['preservedAfter']==before and m['journalAfter']==journal_before and m['sessionLayoutUnchanged']and len(m['namedRequests'])==4 and '[frontier] Session attached serial=4 region=0_0 mode=saved 'in text
  m['haloHomewardSessionTrialCompleted']=complete
 if a.pointer_paging:
  complete=code==0 and m['ownedProducerAbsent']and m['stopReason']is None and m['preservedAfter']==before and m['journalAfter']==journal_before and m['sessionLayoutUnchanged']and len(m['namedRequests'])==2 and '[frontier] Session attached serial=2 region=0_0 mode=saved 'in text and '[frontier] Session camera arrived serial=2 region=0_0 'in text
  m['haloPointerSessionTrialCompleted']=complete
 if a.actor_crossing:
  complete=code==0 and m['ownedProducerAbsent']and m['stopReason']is None and m['preservedAfter']==before and m['journalAfter']==journal_before and m['sessionLayoutUnchanged']and bool(m['actorHeldRequest'])and '[frontier] Halo crossing held checkpoint 'in text
  m['haloSessionActorTrialCompleted']=complete
 if a.actor_retirement:
  complete=complete and bool(m['actorRetirementRequest'])and '[frontier] Halo session retired checkpoint 'in text
  m['haloSessionActorRetirementTrialCompleted']=complete
 if a.actor_paging:
  destination_clock=prep['savedActorDestination']['clock']if a.saved_actor_paging else 0
  complete=complete and bool(m['actorPagingRequest'])and f'[frontier] Halo session destination held serial=1 key=1_0 clock={destination_clock} phase=7 ordinary-ticks=0 'in text
  m['haloSessionActorPagingTrialCompleted']=complete
 if a.actor_proxy:
  complete=complete and bool(m['homeProxyRequest'])and '[frontier] Halo session proxy ready serial=1 key=1_0 'in text
  m['haloSessionHomeProxyTrialCompleted']=complete
 if a.saved_actor_arrival:
  complete=complete and bool(m['savedActorArrivalRequest'])and '[frontier] Halo saved arrival saved serial=1 key=1_0 'in text
  m['haloSavedActorArrivalTrialCompleted']=complete
 if a.saved_actor_activation:
  complete=complete and bool(m['savedActorActivationRequest'])and '[frontier] Halo saved activation ready serial=1 key=1_0 'in text and '[streaming] Halo saved continuation crossed 'in text and '[frontier] Halo saved continuation held serial=1 key=1_0 'in text
  m['haloSavedActorActivationTrialCompleted']=complete
 if a.saved_actor_return_page:
  complete=complete and bool(m['savedActorReturnPageRequest'])and '[streaming] Halo saved return retired 'in text and '[frontier] Halo saved return home held serial=2 key=0_0 clock=103500 'in text
  m['haloSavedActorReturnPageTrialCompleted']=complete
 if a.saved_actor_home_arrival:
  complete=complete and bool(m['savedActorHomeArrivalRequest'])and '[streaming] Halo saved home arrival imported source=537/37 'in text and '[frontier] Halo saved home arrival saved serial=2 key=0_0 'in text
  m['haloSavedActorHomeArrivalTrialCompleted']=complete
 if a.saved_actor_home_activation:
  complete=complete and bool(m['savedActorHomeActivationRequest'])and '[streaming] Halo saved home continuation 'in text and '[frontier] Halo saved home continuation held serial=2 key=0_0 clock=113500 'in text
  m['haloSavedActorHomeActivationTrialCompleted']=complete
 if a.actor_epoch:
  complete=complete and bool(m['destinationEpochRequest'])and '[frontier] Halo session epoch held serial=1 key=1_0 clock=50 'in text
  m['haloSessionDestinationEpochTrialCompleted']=complete
 if a.actor_arrival:
  complete=complete and bool(m['actorArrivalRequest'])and '[frontier] Halo session arrival saved serial=1 key=1_0 'in text
  m['haloSessionActorArrivalTrialCompleted']=complete
 if a.actor_activation:
  complete=complete and bool(m['actorActivationRequest'])and '[frontier] Halo session activation ready serial=1 key=1_0 clock=50 'in text and '[frontier] Halo session activation evolved serial=1 key=1_0 clock=3550 'in text and '[streaming] Halo session continuation 'in text
  m['haloSessionActorActivationTrialCompleted']=complete
 out.write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'nativeSessionTerminal':True,'exitCode':code,'completed':complete,'ownedProducerAbsent':m['ownedProducerAbsent']}),flush=True)
 raise SystemExit(code or(0 if complete else 1))
if __name__=='__main__':asyncio.run(main())
