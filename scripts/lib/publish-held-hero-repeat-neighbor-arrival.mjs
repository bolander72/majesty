// Select the original activated second arrival together with its current
// retired source, then permit the held engine's fresh proxy binding to resume.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,open,rename,readdir,mkdtemp} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './native-generation.mjs';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../../web/world/saved-clock.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalReady,nativeHeroArrivalPublished,publishHeldNativeHeroArrival} from '../../web/world/hero-travel-publication.mjs';
import {publishHeldHeroRepeatNeighborSave} from './publish-held-hero-repeat-neighbor-save.mjs';
const descriptor=async filename=>({filename,...await hashNativeFile(filename)});
const operation=v=>createHash('sha256').update(JSON.stringify(v)+'\n').digest('hex');
export async function publishHeldHeroRepeatNeighborArrival(m,first,capture,staged){
 assert.equal(m.publishRepeatNeighbor,true);assert.equal(m.importRepeatNeighbor,true);assert.equal(m.nativeSessionTerminal,false);
 const output=join(m.fixture,'repeat-neighbor-publication.json');await assert.rejects(lstat(output),e=>e.code==='ENOENT');
 async function log(){process.kill(m.nativePid,0);assert.ok((await lstat(m.log)).size<m.logCeilingBytes);return readFile(m.log,'utf8');}
 let readyPacket;
 for(let i=0;i<160;i++){
  const lines=await log(),matches=[...lines.matchAll(/^\[frontier\] Hero travel publication held receipt=(majesty-hero-travel-ready-v1\|4\|1_0\|\S+) phase=7 pending=0 ordinary-ticks=0$/gm)];
  assert.ok(matches.length<=1);if(matches.length){readyPacket=matches[0][1];break;}await new Promise(r=>setTimeout(r,50));
 }
 assert.ok(readyPacket,'Activated second neighboring arrival readiness missing');const ready=parseNativeHeroArrivalReady(readyPacket);
 assert.equal(ready.clock,staged.targetClock);assert.equal(ready.homeAgentId,staged.targetEntry.homeAlias.agentId);
 const profile=join(m.fixture,'frontier_1_0');let marker=await descriptor(join(profile,'Frontier_1_0.checkpoint'));
 const nativeManifest=await readFile(marker.filename,'utf8'),fields=nativeManifest.split('\n');assert.ok(fields[1]==='0'||fields[1]==='1');
 assert.equal(nativeManifest,['checkpoint-v1',fields[1],ready.size,ready.sha256,
  '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
 let active=await descriptor(join(profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_1_0'+(fields[1]==='1'?'_Recovery':'')+'.GMP'));
 if(m.saveRepeatNeighbor){
  const markerCopy=join(profile,'Hero_Repeat_Target_Accepted.checkpoint');await writeFile(markerCopy,nativeManifest,{flag:'wx'});marker=await descriptor(markerCopy);
  const backup=join(profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Repeat_Target_Accepted.GMP'),f=await open(backup,'wx');let at=0;
  try{const copied=await hashNativeFile(active.filename,{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }});assert.equal(copied.sha256,active.sha256);await f.sync();}finally{await f.close();}active=await descriptor(backup);
 }
 const retired=await descriptor(join(m.fixture,'frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Hero_Repeat_Source_Retired.GMP'));
 assert.equal(active.sha256,ready.sha256);assert.equal(active.bytes,ready.size);assert.equal(await checkpointSavedClock(await stoppedFileSource(retired.filename)),capture.crossing.clock);
 const beforeJournal=await mkdtemp(join(dirname(capture.journal),'actor-arrival-fixture-hero-route-before-repeat-arrival-'));
 assert.deepEqual((await readdir(capture.journal)).sort(),Object.keys(capture.journalSha256).sort());
 for(const[n,h]of Object.entries(capture.journalSha256)){
  const f=await open(join(beforeJournal,n),'wx');let at=0;
  try{const result=await hashNativeFile(join(capture.journal,n),{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }});assert.equal(result.sha256,h);await f.sync();}finally{await f.close();}
 }
 const stats={},io=await stoppedHeroRouteStorage(capture.journal,stats),store=new HeroRouteStore(io,first.identity,first.identity.contentDigest);
 const ackName=join(profile,'Frontier_Hero_Travel_Published.txt');
 async function ack(text){const temp=ackName+'.tmp',f=await open(temp,'wx');try{await f.writeFile(text);await f.sync();}finally{await f.close();}await rename(temp,ackName);
  const d=await open(dirname(ackName),'r');try{await d.sync();}finally{await d.close();}}
 const refused=`[frontier] Hero travel publication refused serial=4 region=1_0 clock=${ready.clock} phase=7 pending=0`,accepted='[frontier] Hero travel publication accepted serial=4 region=1_0 ';
 const count=text=>text.split(refused).length-1,controls=[];
 for(const[kind,change]of [['previous-departure-serial',{serial:1}],['wrong-clock',{clock:ready.clock+50}],
  ['old-neighbor-alias',{unitId:first.publicationReceipt.owner.unitId,agentId:first.publicationReceipt.owner.agentId}],
  ['native-guild-in-foreign-kingdom',{homeAgentId:first.identity.registeredHome.home.agentId}],['unpublished-second-arrival',{}]]){
  const acknowledgement=nativeHeroArrivalPublished(nativeHeroArrivalReady({...ready,...change}),capture.publicationReceipt.ownerManifest),before=count(await log());
  await ack(acknowledgement);let seen=false;
  for(let i=0;i<60;i++){const lines=await log();assert.ok(!lines.includes(accepted));if(count(lines)>before){seen=true;break;}await new Promise(r=>setTimeout(r,50));}
  assert.equal(seen,true,kind+' not refused before second arrival resume');controls.push({kind,acknowledgement,refusedByEngine:true,clock:ready.clock,phase:7,pending:0});
 }
 const world=async row=>({source:await stoppedFileSource(row.filename),sha256:row.sha256});
 const request={ready:readyPacket,operationId:operation(['native-live-second-neighbor',capture.publicationReceipt.ownerManifest,retired.sha256,active.sha256]),
  expectedManifest:capture.publicationReceipt.ownerManifest,sourceRegion:capture.crossing.region,sourceAlias:capture.publicationReceipt.owner,
  sourceHome:capture.publicationReceipt.home,sourceClock:capture.crossing.clock,capturedSha256:capture.captured.sha256,
  retiredSource:await world(retired),activeSource:await world(active)};
 const zeroWriteControls=[];
 for(const[kind,change]of [['old-source-alias',{sourceAlias:{unitId:508,agentId:25}}],['stale-owner-save',{expectedManifest:capture.expectedManifest}],
  ['wrong-source-home',{sourceHome:{kind:'proxy',unitId:0,agentId:38}}],['wrong-source-clock',{sourceClock:capture.crossing.clock+50}],['changed-capture-digest',{capturedSha256:'0'.repeat(64)}]]){
  const writes=stats.writes??0;await assert.rejects(publishHeldNativeHeroArrival(store,{...request,...change}));assert.equal(stats.writes??0,writes);
  assert.equal((await store.read()).record.manifest,request.expectedManifest);zeroWriteControls.push({kind,refused:true,writes:0});
 }
 const receipt=await publishHeldNativeHeroArrival(store,request);assert.equal(receipt.ownerRevision,7);assert.deepEqual(receipt.home,staged.targetEntry.homeAlias);
 const writes=stats.writes,retry=await publishHeldNativeHeroArrival(store,request);assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
 const journalSha256={};for(const n of (await readdir(capture.journal)).sort())journalSha256[n]=(await hashNativeFile(join(capture.journal,n))).sha256;
 const report={version:1,nativeHeldHeroRepeatNeighborPairPublished:true,nativePid:m.nativePid,fixture:m.fixture,
  departurePublication:await descriptor(join(m.fixture,'repeat-departure-publication.json')),pageInput:await descriptor(join(m.fixture,'repeat-neighbor-page-input.json')),
  journal:capture.journal,beforeJournal,beforeJournalSha256:capture.journalSha256,journalSha256,expectedManifest:request.expectedManifest,
  ready:readyPacket,active,retired,marker,nativeManifest,publicationReceipt:receipt,controls,zeroWriteControls,stats,exactRetryWrites:0,
  nativeReceiptConsumed:false,neighborGameplayResumed:false,browserUsed:false,realOPFSDurabilityQualified:false,repeatedFullTripsQualified:false,goalComplete:false};
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});await ack(receipt.acknowledgement);
 console.log(JSON.stringify({nativeHeldHeroRepeatNeighborPairPublished:true,ownerRevision:7,refusedNativeReceipts:controls.length,zeroWriteControls:zeroWriteControls.length}));
 if(m.saveRepeatNeighbor)await publishHeldHeroRepeatNeighborSave(m,first,report);
}
