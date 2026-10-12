// Select the actual first held source before any private native retirement.
// The one existing publisher also stages the production browser input; this
// controlled filesystem exercise does not qualify live OPFS or browser travel.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,open,rename,readdir} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './native-generation.mjs';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './stopped-hero-route-io.mjs';
import {stageSelectedHeroBrowserInput} from './stage-selected-hero-browser-input.mjs';
import {HeroRouteStore} from '../../web/world/hero-route-store.mjs';
import {registeredHeroHome} from '../../web/world/entity-home-ownership.mjs';
import {prepareOrReuseRemoteHomeAgent} from '../../web/world/remote-home-cache.mjs';
import {withProposedRemoteHome} from '../../web/world/remote-home-projection.mjs';
import {prepareSelectedHeroNeighborArrival} from '../../web/world/hero-home-arrival-package.mjs';
import {requireCheckpointHeroCrossing} from '../../web/world/hero-travel-boundary.mjs';
import {publishHeldHeroOwnerCheckpoint} from '../../web/world/hero-owner-checkpoint-publication.mjs';
import {nativeHeroArrivalReady,nativeHeroArrivalPublished} from '../../web/world/hero-travel-publication.mjs';
import {stageNativeHeroTravelRequest,HERO_TRAVEL_REQUEST} from '../../web/world/hero-travel-request.mjs';
import {fileProfileStorage} from '../../tests/fixtures/file-profile-storage.mjs';
const descriptor=async filename=>({filename,...await hashNativeFile(filename)});
const operation=v=>createHash('sha256').update(JSON.stringify(v)+'\n').digest('hex');

export async function stageHeldFirstHeroOutward(m,startup,prepared){
 assert.equal(m.firstOutwardBrowserInput,true);assert.equal(m.nativeSessionTerminal,false);
 const output=join(m.fixture,'first-outward-input.json');await assert.rejects(lstat(output),e=>e.code==='ENOENT');
 async function log(){process.kill(m.nativePid,0);assert.ok((await lstat(m.log)).size<m.logCeilingBytes);return readFile(m.log,'utf8');}
 const lines=await log();assert.ok(!lines.includes('[frontier] Hero source retirement completed serial=1 '));
 const crosses=[...lines.matchAll(/^\[frontier\] Hero crossing serial=1 region=0_0 target=(\S+) previous-clock=(\d+) clock=(\d+) unit=(\d+) agent=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) phase=3 pending=7 original-tick=1 native-cells=4$/gm)],
  saves=[...lines.matchAll(/^\[frontier\] Hero save held serial=1 region=0_0 clock=(\d+) slot=([01]) bytes=(\d+) sha256=([0-9a-f]{64}) phase=7 pending=0$/gm)];
 assert.equal(crosses.length,1);assert.equal(saves.length,1);
 const c=crosses[0],h=saves[0],pose=text=>Object.fromEntries(text.split(',').map((n,i)=>[['x','y','z'][i],Number(n)]));
 assert.ok(c.index<h.index);
 const crossing={serial:1,region:'0_0',target:c[1],previousClock:Number(c[2]),clock:Number(c[3]),unitId:Number(c[4]),agentId:Number(c[5]),previous:pose(c[6]),accepted:pose(c[7])},
  held={serial:1,region:'0_0',clock:Number(h[1]),slot:Number(h[2]),size:Number(h[3]),sha256:h[4]};
 assert.equal(crossing.target,'1_0');assert.equal(held.clock,crossing.clock);assert.equal(held.slot,1);
 const owner={unitId:crossing.unitId,agentId:crossing.agentId},identity=prepared.identity;
 assert.deepEqual(owner,{unitId:startup.receipt.owner.unitId,agentId:startup.receipt.owner.agentId});
 assert.deepEqual(owner,{unitId:prepared.selectedOwner.unitId,agentId:prepared.selectedOwner.agentId});
 const profile=join(m.fixture,'frontier_0_0'),neighbor=join(m.fixture,'frontier_1_0');
 async function copy(source,target){const f=await open(target,'wx');let at=0;
  try{const result=await hashNativeFile(source,{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }});await f.sync();return {filename:target,...result};}finally{await f.close();}}
 const captured=await copy(join(profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0_Recovery.GMP'),
  join(profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Travel_Source_Capture.GMP'));
 assert.equal(captured.bytes,held.size);assert.equal(captured.sha256,held.sha256);
 const nativeManifest=await readFile(join(profile,'Frontier_0_0.checkpoint'),'utf8');
 assert.equal(nativeManifest,['checkpoint-v1','1',held.size,held.sha256,
  '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
 const markerName=join(profile,'Hero_Travel_Source_Capture.checkpoint');await writeFile(markerName,nativeManifest,{flag:'wx'});
 const marker=await descriptor(markerName),travel=await requireCheckpointHeroCrossing(await stoppedFileSource(captured.filename),m.runtimeBinding,crossing);
 const stats={},io=await stoppedHeroRouteStorage(m.publicationJournal,stats),store=new HeroRouteStore(io,identity,identity.contentDigest),
  initial=await store.read();assert.equal(initial.record.manifest,startup.receipt.ownerManifest);
 const sourceHome={kind:'native',unitId:identity.registeredHome.home.unitId,agentId:identity.registeredHome.home.agentId};
 const request=async()=>({operationId:operation(['native-held-capture',captured.sha256,initial.record.manifest]),
  expectedManifest:initial.record.manifest,region:'0_0',alias:owner,homeAlias:sourceHome,
  clock:held.clock,sha256:captured.sha256,source:await stoppedFileSource(captured.filename)});
 const publicationReceipt=await publishHeldHeroOwnerCheckpoint(store,await request());assert.equal(publicationReceipt.ownerRevision,1);
 const writes=stats.writes,retry=await publishHeldHeroOwnerCheckpoint(store,await request());assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
 const target=await copy(m.destinationCopied.filename,join(neighbor,'Hero_Travel_First_Target.GMP')),
  targetManifest=await readFile(join(neighbor,'Frontier_1_0.checkpoint'),'utf8');
 assert.equal(target.bytes,m.destinationCopied.bytes);assert.equal(target.sha256,m.destinationCopied.sha256);
 assert.equal(targetManifest,['checkpoint-v1','0',target.bytes,target.sha256,
  '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
 const targetMarkerName=join(neighbor,'Hero_Travel_First_Target.checkpoint');await writeFile(targetMarkerName,targetManifest,{flag:'wx'});
 const destination=await stoppedFileSource(target.filename),registered=registeredHeroHome(identity),
  fresh=await prepareOrReuseRemoteHomeAgent(destination,registered,{worldId:identity.registeredHome.worldId,
   contentDigest:identity.contentDigest,destinationRegion:'1_0',freshAgentId:prepared.context.homeAliases[1].agentId});
 assert.equal(fresh.plan.admission,'reserve-new');assert.deepEqual(Buffer.from(fresh.record),await readFile(m.proposal.filename));
 let arrival,projection;
 await store.withOwner(async v=>{
  assert.equal(v.record.manifest,publicationReceipt.ownerManifest);assert.deepEqual(v.entry.alias,owner);
  const result=await withProposedRemoteHome(destination,registered,fresh,async projected=>{
   projection=projected.plan;
   return prepareSelectedHeroNeighborArrival(identity,{regions:['0_0','1_0'],entries:[v.entry,
    {region:'1_0',alias:prepared.context.aliases[1],homeAlias:prepared.context.homeAliases[1]}],sources:[v.source,projected.source]},crossing);
  });
  assert.deepEqual(Buffer.from(result.pack),await readFile(m.arrivalPackage.filename));
  for(const key of ['options','context','plan','layouts','ground','totalRecordBytes','packDescriptors'])
   assert.deepEqual(JSON.parse(JSON.stringify(result[key])),prepared[key],key);
  const {pack,...plan}=result;arrival={...plan,pack:await descriptor(m.arrivalPackage.filename)};
 });
 const capture={crossing,owner,ownerManifest:publicationReceipt.ownerManifest,nativeManifest,journal:m.publicationJournal};
 arrival.browserInput=await stageSelectedHeroBrowserInput(m,capture,{region:'1_0',clock:m.destinationClock,
  nativeManifest:targetManifest,homeAlias:prepared.context.homeAliases[1],homeAdmission:'reserve-new',proxyRecord:m.proposal},arrival);
 const preservedInput=await copy(arrival.browserInput.manifest.filename,join(neighbor,'Hero_Travel_First_Input.json'));
 const ackName=join(profile,'Frontier_Hero_Capture_Published.txt');
 async function ack(text){const temp=ackName+'.tmp',f=await open(temp,'wx');
  try{await f.writeFile(text);await f.sync();}finally{await f.close();}await rename(temp,ackName);
  const d=await open(dirname(ackName),'r');try{await d.sync();}finally{await d.close();}}
 const fields={serial:1,region:'0_0',clock:held.clock,...owner,homeAgentId:sourceHome.agentId,size:held.size,sha256:held.sha256},
  packet=(change={},manifest=publicationReceipt.ownerManifest)=>nativeHeroArrivalPublished(nativeHeroArrivalReady({...fields,...change}),manifest)
   .replace(/^majesty-hero-travel-published-v1\|/,'majesty-hero-capture-published-v1|'),
  refusal=`[frontier] Hero captured publication refused serial=1 region=0_0 clock=${held.clock} phase=7 pending=0`,
  count=text=>text.split(refusal).length-1,controls=[];
 for(const[kind,change,manifest]of [['wrong-serial',{serial:2}],['wrong-clock',{clock:held.clock+50}],
  ['wrong-native-alias',{unitId:owner.unitId+1}],['wrong-guild',{homeAgentId:sourceHome.agentId+1}],
  ['changed-capture-digest',{sha256:'0'.repeat(64)}],['unpublished-capture',{},initial.record.manifest]]){
  const text=packet(change,manifest??publicationReceipt.ownerManifest),before=count(await log());await ack(text);let seen=false;
  for(let i=0;i<60;i++){const lines=await log();assert.ok(!lines.includes('[frontier] Hero source retirement completed serial=1 '));
   if(count(lines)>before){seen=true;break;}await new Promise(r=>setTimeout(r,50));}
  assert.equal(seen,true,kind+' not refused before first retirement');controls.push({kind,acknowledgement:text,refusedByEngine:true});
 }
 const journalSha256={};for(const n of (await readdir(m.publicationJournal)).sort())journalSha256[n]=(await hashNativeFile(join(m.publicationJournal,n))).sha256;
 const acknowledgement=packet();
 const requestAdapter=fileProfileStorage(m.fixture,()=>{process.kill(m.nativePid,0);return true;});
 const sourceRequest=await stageNativeHeroTravelRequest(requestAdapter.directory(profile),requestAdapter.directory(neighbor),arrival.browserInput.staged,
  {check(){process.kill(m.nativePid,0);},async validate(){
   assert.equal(await readFile(join(m.publicationJournal,'Frontier_Hero_Route.checkpoint'),'utf8'),publicationReceipt.ownerManifest);
   assert.equal(await readFile(join(profile,'Frontier_0_0.checkpoint'),'utf8'),nativeManifest);
   assert.equal(await readFile(join(neighbor,'Frontier_1_0.checkpoint'),'utf8'),targetManifest);
   for(const row of [captured,target]){const h=await hashNativeFile(row.filename);assert.equal(h.sha256,row.sha256);assert.equal(h.bytes,row.bytes);}
  }});
 const requestBackup=await copy(join(profile,HERO_TRAVEL_REQUEST),join(profile,'Hero_Travel_First_Request.json'));
 await ack(acknowledgement);
 // A selected capture plus staged JSON still cannot retire the source until
 // the separate ordinary named action is issued by the controlled driver.
 await new Promise(r=>setTimeout(r,150));assert.ok(!(await log()).includes('[frontier] Hero source retirement completed serial=1 '));
 async function control(name,text){const temp=name+'.tmp',f=await open(temp,'wx');
  try{await f.writeFile(text);await f.sync();}finally{await f.close();}await rename(temp,name);}
 const refused=`[frontier] Hero departure request refused serial=1 region=0_0 clock=${held.clock} phase=7 pending=0`,
  requestRefusals=text=>text.split(refused).length-1,requestControls=[];let sequence=0;
 const validText=sourceRequest.requestManifest;
 async function action(){++sequence;await control(join(profile,'Frontier_Hero_Departure_Action.txt'),`majesty-hero-departure-action-v1|1|${sequence}\n`);}
 for(const[kind,change]of [
  ['serial',v=>v.serial=2],['source-clock',v=>v.sourceClock++],['destination-clock',v=>v.destinationClock++],
  ['crossing-direction',v=>v.targetRegion='0_1'],['source-alias',v=>v.sourceAlias.unitId++],
  ['owner-head',v=>v.ownerManifest=initial.record.manifest],['source-manifest',v=>v.sourceNativeManifest=v.sourceNativeManifest.replace(held.sha256,'f'.repeat(64))],
  ['destination-manifest',v=>v.destinationNativeManifest=v.destinationNativeManifest.replace(target.sha256,'f'.repeat(64))],
  ['home-alias',v=>v.homeAlias.agentId++],['package-digest',v=>v.package.sha256='f'.repeat(64)]]){
  const value=JSON.parse(validText);change(value);const bad=JSON.stringify(value)+'\n',before=requestRefusals(await log());
  // Match both mailboxes so the shared consumer must check the boundary/
  // journal/world/home/package, rather than just reject differing JSON copies.
  await control(join(neighbor,'Frontier_Hero_Travel_Input.json'),bad);await control(join(profile,HERO_TRAVEL_REQUEST),bad);await action();
  let seen=false;for(let i=0;i<60;i++){const lines=await log();assert.ok(!lines.includes('[frontier] Hero source retirement completed serial=1 '));
   if(requestRefusals(lines)>before){seen=true;break;}await new Promise(r=>setTimeout(r,50));}
  assert.equal(seen,true,kind+' departure request was not refused');requestControls.push({kind,refusedByEngine:true});
 }
 await control(join(neighbor,'Frontier_Hero_Travel_Input.json'),validText);await control(join(profile,HERO_TRAVEL_REQUEST),validText);
 const report={version:1,firstOutwardBrowserInputStaged:true,nativePid:m.nativePid,fixture:m.fixture,
  identity,crossing,held,travel,captured,marker,nativeManifest,owner,journal:m.publicationJournal,journalSha256,
  expectedManifest:initial.record.manifest,ownerManifest:publicationReceipt.ownerManifest,publicationReceipt,
  target,targetMarker:await descriptor(targetMarkerName),targetManifest,targetClock:m.destinationClock,
  homeProposal:fresh.plan,projection,arrival,preservedInput,acknowledgement,controls,stats,exactRetryWrites:0,
  sourceRequest:{staged:sourceRequest,preservedInput:requestBackup,stats:requestAdapter.stats,requestControls,
   stagedWithoutActionKeptSourceHeld:true,ordinaryNamedAction:sourceRequest.nativeAction},
  nativeRetirementAcknowledged:false,sourceUnloaded:false,heroImported:false,browserUsed:false,liveOPFSQualified:false,goalComplete:false};
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});await action();
 return {report,descriptor:await descriptor(output)};
}
