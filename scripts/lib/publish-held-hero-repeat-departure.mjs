// Follow the actual continued-home owner into a second outward crossing in
// this same native journey; select recovery before permitting live retirement.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,open,rename,readdir,mkdtemp} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './native-generation.mjs';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../../web/world/hero-route-store.mjs';
import {selectedHeroRuntimeBinding} from '../../web/world/hero-runtime-binding.mjs';
import {requireCheckpointHeroCrossing} from '../../web/world/hero-travel-boundary.mjs';
import {nativeHeroArrivalReady,nativeHeroArrivalPublished} from '../../web/world/hero-travel-publication.mjs';
import {publishHeldHeroOwnerCheckpoint} from '../../web/world/hero-owner-checkpoint-publication.mjs';
import {stageSelectedHeroRepeatNeighbor} from './stage-selected-hero-repeat-neighbor.mjs';
import {stageSelectedHeroPublicDeparture} from './stage-selected-hero-public-departure.mjs';
import {publishHeldHeroRepeatNeighborArrival} from './publish-held-hero-repeat-neighbor-arrival.mjs';
const descriptor=async filename=>({filename,...await hashNativeFile(filename)});
const operation=v=>createHash('sha256').update(JSON.stringify(v)+'\n').digest('hex');
export async function publishHeldHeroRepeatDeparture(m,first,saved){
 assert.equal(m.repeatDeparture,true);assert.equal(m.nativeSessionTerminal,false);
 const output=join(m.fixture,'repeat-departure-publication.json');await assert.rejects(lstat(output),e=>e.code==='ENOENT');
 const stats={},io=await stoppedHeroRouteStorage(saved.journal,stats),store=new HeroRouteStore(io,first.identity,first.identity.contentDigest);
 const previous=saved.publicationReceipt;
 const binding=await store.withOwner(async v=>{assert.equal(v.record.manifest,previous.ownerManifest);
  assert.deepEqual(v.entry.alias,previous.owner);assert.deepEqual(v.entry.homeAlias,previous.home);return selectedHeroRuntimeBinding(first.identity,v.entry,previous.clock);});
 async function log(){process.kill(m.nativePid,0);assert.ok((await lstat(m.log)).size<m.logCeilingBytes);return readFile(m.log,'utf8');}
 let crossing,held;
 for(let i=0;i<160;i++){const lines=await log();
  const crosses=[...lines.matchAll(/^\[frontier\] Hero crossing serial=4 region=0_0 target=(\S+) previous-clock=(\d+) clock=(\d+) unit=(\d+) agent=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) phase=3 pending=7 original-tick=1 native-cells=4$/gm)];
  const saves=[...lines.matchAll(/^\[frontier\] Hero save held serial=4 region=0_0 clock=(\d+) slot=([01]) bytes=(\d+) sha256=([0-9a-f]{64}) phase=7 pending=0$/gm)];
  assert.ok(crosses.length<=1&&saves.length<=1);
  if(crosses.length&&saves.length){const c=crosses[0],h=saves[0],pose=text=>Object.fromEntries(text.split(',').map((n,i)=>[['x','y','z'][i],Number(n)]));
   assert.ok(c.index<h.index);crossing={serial:4,region:'0_0',target:c[1],previousClock:Number(c[2]),clock:Number(c[3]),unitId:Number(c[4]),agentId:Number(c[5]),previous:pose(c[6]),accepted:pose(c[7])};
   held={serial:4,region:'0_0',clock:Number(h[1]),slot:Number(h[2]),size:Number(h[3]),sha256:h[4]};break;}
  await new Promise(r=>setTimeout(r,50));
 }
 assert.ok(crossing&&held,'Repeated original outward crossing and held capture missing');assert.equal(crossing.target,'1_0');assert.equal(held.clock,crossing.clock);
 assert.deepEqual({unitId:crossing.unitId,agentId:crossing.agentId},previous.owner);assert.equal(held.slot,1);
 const profile=join(m.fixture,'frontier_0_0');let captured=await descriptor(join(profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0_Recovery.GMP'));
 let marker=await descriptor(join(profile,'Frontier_0_0.checkpoint'));const nativeManifest=await readFile(marker.filename,'utf8');
 assert.equal(captured.sha256,held.sha256);assert.equal(captured.bytes,held.size);
 assert.equal(nativeManifest,['checkpoint-v1','1',held.size,held.sha256,
  '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
 if(m.pageRepeatHome){
  // The later dormant-home reload reuses slot1 for the selected retired save.
  // Preserve this actual captured save and marker before exposing their report.
  const backup=join(profile,'Hero_Repeat_Departure_Accepted.GMP'),f=await open(backup,'wx');let at=0;
  try{const result=await hashNativeFile(captured.filename,{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }});assert.equal(result.sha256,captured.sha256);assert.equal(result.bytes,captured.bytes);await f.sync();}finally{await f.close();}
  captured=await descriptor(backup);
  const markerBackup=join(profile,'Hero_Repeat_Departure_Accepted.checkpoint');await writeFile(markerBackup,nativeManifest,{flag:'wx'});marker=await descriptor(markerBackup);
 }
 const travel=await requireCheckpointHeroCrossing(await stoppedFileSource(captured.filename),binding,crossing);
 const beforeJournal=await mkdtemp(join(dirname(saved.journal),'actor-arrival-fixture-hero-route-before-repeat-'));
 assert.deepEqual((await readdir(saved.journal)).sort(),Object.keys(saved.journalSha256).sort());
 for(const[n,h]of Object.entries(saved.journalSha256)){const f=await open(join(beforeJournal,n),'wx');let at=0;
  try{const result=await hashNativeFile(join(saved.journal,n),{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }});assert.equal(result.sha256,h);await f.sync();}finally{await f.close();}}
 const request=async()=>({operationId:operation(['native-repeat-capture',previous.ownerManifest,captured.sha256]),expectedManifest:previous.ownerManifest,
  region:crossing.region,alias:previous.owner,homeAlias:previous.home,clock:crossing.clock,sha256:captured.sha256,source:await stoppedFileSource(captured.filename)});
 const receipt=await publishHeldHeroOwnerCheckpoint(store,await request());assert.equal(receipt.ownerRevision,6);
 const writes=stats.writes,retry=await publishHeldHeroOwnerCheckpoint(store,await request());assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
 const ready=nativeHeroArrivalReady({serial:4,region:'0_0',clock:held.clock,...previous.owner,homeAgentId:previous.home.agentId,size:held.size,sha256:held.sha256});
 const ackName=join(profile,'Frontier_Hero_Capture_Published.txt');
 async function ack(text){const temp=ackName+'.tmp',f=await open(temp,'wx');
  try{await f.writeFile(text);await f.sync();}finally{await f.close();}await rename(temp,ackName);
  const d=await open(dirname(ackName),'r');try{await d.sync();}finally{await d.close();}}
 const fields={serial:4,region:'0_0',clock:held.clock,...previous.owner,homeAgentId:previous.home.agentId,size:held.size,sha256:held.sha256};
 const packet=(change={},manifest=receipt.ownerManifest)=>nativeHeroArrivalPublished(nativeHeroArrivalReady({...fields,...change}),manifest)
  .replace(/^majesty-hero-travel-published-v1\|/,'majesty-hero-capture-published-v1|');
 const refused=`[frontier] Hero captured publication refused serial=4 region=0_0 clock=${held.clock} phase=7 pending=0`;
 const completed='[frontier] Hero repeated source retirement completed serial=4 region=0_0 ',count=v=>v.split(refused).length-1,controls=[];
 for(const[kind,change,manifest]of [['wrong-clock',{clock:held.clock+50}],['old-native-alias',{unitId:508,agentId:25}],
  ['wrong-guild',{homeAgentId:38}],['changed-capture-digest',{sha256:'0'.repeat(64)}],['previous-home-save',{},previous.ownerManifest]]){
  const text=packet(change,manifest??receipt.ownerManifest),before=count(await log());await ack(text);let seen=false;
  for(let i=0;i<60;i++){const lines=await log();assert.ok(!lines.includes(completed));if(count(lines)>before){seen=true;break;}await new Promise(r=>setTimeout(r,50));}
  assert.equal(seen,true,kind+' not refused before retirement');controls.push({kind,acknowledgement:text,refusedByEngine:true,clock:held.clock,phase:7,pending:0});
 }
 const journalSha256={};for(const n of (await readdir(saved.journal)).sort())journalSha256[n]=(await hashNativeFile(join(saved.journal,n))).sha256;
 const acknowledgement=packet();
 const report={version:1,nativeRepeatedHeroDepartureCapturePublished:true,nativePid:m.nativePid,fixture:m.fixture,
  homeSavePublication:await descriptor(join(m.fixture,'home-save-publication.json')),journal:saved.journal,beforeJournal,beforeJournalSha256:saved.journalSha256,journalSha256,
  expectedManifest:previous.ownerManifest,runtimeBinding:binding,crossing,held,travel,captured,marker,nativeManifest,publicationReceipt:receipt,
  ready,acknowledgement,controls,stats,exactRetryWrites:0,nativeRetirementAcknowledged:false,sourceUnloaded:false,nextArrivalImported:false,
  browserUsed:false,realOPFSDurabilityQualified:false,goalComplete:false};
 // Native mutation is allowed only after the entire published recovery report.
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 const destination=m.publicTravel?await stageSelectedHeroRepeatNeighbor(m,first,report,{beforeDeparture:true}):null;
 await ack(acknowledgement);
 if(destination)await stageSelectedHeroPublicDeparture(m,report,destination.neighborArrival);
 console.log(JSON.stringify({nativeRepeatedHeroDepartureCapturePublished:true,ownerRevision:6,clock:held.clock,refusedNativeReceipts:controls.length}));
 if(destination)await publishHeldHeroRepeatNeighborArrival(m,first,report,destination);
 else if(m.pageRepeatNeighbor)await stageSelectedHeroRepeatNeighbor(m,first,report);
}
