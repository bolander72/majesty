// The same supervised native journey publishes its activated native-guild
// arrival. Preserve revision3 before advancing the real journal to revision4.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,open,rename,readdir,mkdtemp} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './native-generation.mjs';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../../web/world/hero-route-store.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalReady,nativeHeroArrivalPublished,publishHeldNativeHeroArrival} from '../../web/world/hero-travel-publication.mjs';
import {checkpointSavedClock} from '../../web/world/saved-clock.mjs';
import {publishHeldHeroHomeSave} from './publish-held-hero-home-save.mjs';

const descriptor=async filename=>({filename,...await hashNativeFile(filename)});
const operation=v=>createHash('sha256').update(JSON.stringify(v)+'\n').digest('hex');
export async function publishHeldHeroHomeArrival(m,first,second){
 assert.equal(m.publishHome,true);assert.equal(m.activateHome,true);assert.equal(m.nativeSessionTerminal,false);
 const output=join(m.fixture,'home-publication.json');await assert.rejects(lstat(output),e=>e.code==='ENOENT');
 async function log(){process.kill(m.nativePid,0);assert.ok((await lstat(m.log)).size<m.logCeilingBytes);return readFile(m.log,'utf8');}
 let readyPacket;
 for(let i=0;i<160;i++){
  const lines=await log(),matches=[...lines.matchAll(/^\[frontier\] Hero travel publication held receipt=(majesty-hero-travel-ready-v1\|2\|0_0\|\S+) phase=7 pending=0 ordinary-ticks=0$/gm)];
  assert.ok(matches.length<=1);if(matches.length){readyPacket=matches[0][1];break;}await new Promise(r=>setTimeout(r,50));
 }
 assert.ok(readyPacket,'Activated native-home readiness missing');const ready=parseNativeHeroArrivalReady(readyPacket);
 const home=first.identity.registeredHome.home;assert.equal(ready.homeAgentId,home.agentId);assert.equal(ready.clock,103500);
 const profile=join(m.fixture,'frontier_0_0');let marker=await descriptor(join(profile,'Frontier_0_0.checkpoint'));
 const nativeManifest=await readFile(marker.filename,'utf8'),fields=nativeManifest.split('\n');
 assert.ok(fields[1]==='0'||fields[1]==='1');
 assert.equal(nativeManifest,['checkpoint-v1',fields[1],ready.size,ready.sha256,
  '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
 if(m.saveHome){const backup=join(profile,'Hero_Return_Home_Active.checkpoint');await writeFile(backup,nativeManifest,{flag:'wx'});marker=await descriptor(backup);}
 let active=await descriptor(join(profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0'+(fields[1]==='1'?'_Recovery':'')+'.GMP'));
 if(m.repeatDeparture){const backup=join(profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Return_Home_Accepted.GMP'),f=await open(backup,'wx');let at=0;
  try{const copied=await hashNativeFile(active.filename,{sink:async bytes=>{for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}}});assert.equal(copied.sha256,active.sha256);await f.sync();}finally{await f.close();}active=await descriptor(backup);
 }
 const retired=await descriptor(join(m.fixture,'frontier_1_0/Documents/My Games/MajestyHD/SaveGame/Hero_Remote_Source_Retired.GMP'));
 assert.equal(active.bytes,ready.size);assert.equal(active.sha256,ready.sha256);
 assert.equal(await checkpointSavedClock(await stoppedFileSource(retired.filename)),second.held.clock);
 const beforeJournal=await mkdtemp(join(dirname(second.journal),'actor-arrival-fixture-hero-route-before-home-'));
 assert.deepEqual((await readdir(second.journal)).sort(),Object.keys(second.journalSha256).sort());
 for(const[n,h]of Object.entries(second.journalSha256)){
  const f=await open(join(beforeJournal,n),'wx');let at=0;
  try{const result=await hashNativeFile(join(second.journal,n),{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }});assert.equal(result.sha256,h);await f.sync();}finally{await f.close();}
 }
 const stats={},io=await stoppedHeroRouteStorage(second.journal,stats),store=new HeroRouteStore(io,first.identity,first.identity.contentDigest);
 const ackName=join(profile,'Frontier_Hero_Travel_Published.txt');
 async function ack(text){const temp=ackName+'.tmp',f=await open(temp,'wx');
  try{await f.writeFile(text);await f.sync();}finally{await f.close();}await rename(temp,ackName);
  const d=await open(dirname(ackName),'r');try{await d.sync();}finally{await d.close();}}
 const refused=`[frontier] Hero travel publication refused serial=2 region=0_0 clock=${ready.clock} phase=7 pending=0`;
 const accepted='[frontier] Hero travel publication accepted serial=2 region=0_0 ';
 const controls=[],count=text=>text.split(refused).length-1;
 for(const[kind,change]of [['wrong-serial',{serial:1}],['wrong-clock',{clock:ready.clock+50}],
  ['wrong-native-alias',{unitId:ready.unitId+1}],['wrong-native-home',{homeAgentId:second.homeAlias.agentId}],['unpublished-return',{}]]){
  const acknowledgement=nativeHeroArrivalPublished(nativeHeroArrivalReady({...ready,...change}),second.ownerManifest),before=count(await log());
  await ack(acknowledgement);let seen=false;
  for(let i=0;i<60;i++){const lines=await log();assert.ok(!lines.includes(accepted));if(count(lines)>before){seen=true;break;}await new Promise(r=>setTimeout(r,50));}
  assert.equal(seen,true,kind+' not refused by held engine');controls.push({kind,acknowledgement,refusedByEngine:true,clock:ready.clock,phase:7,pending:0});
 }
 const world=async row=>({source:await stoppedFileSource(row.filename),sha256:row.sha256});
 const request={ready:readyPacket,operationId:operation(['native-live-home',second.ownerManifest,retired.sha256,active.sha256]),
  expectedManifest:second.ownerManifest,sourceRegion:'1_0',sourceAlias:{unitId:second.owner.unitId,agentId:second.owner.agentId},
  sourceHome:second.homeAlias,sourceClock:second.held.clock,capturedSha256:second.captured.sha256,
  retiredSource:await world(retired),activeSource:await world(active)};
 const receipt=await publishHeldNativeHeroArrival(store,request);assert.equal(receipt.ownerRevision,4);
 assert.deepEqual(receipt.home,{kind:'native',unitId:home.unitId,agentId:home.agentId});
 const writes=stats.writes,retry=await publishHeldNativeHeroArrival(store,request);assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
 const journalSha256={};for(const n of (await readdir(second.journal)).sort())journalSha256[n]=(await hashNativeFile(join(second.journal,n))).sha256;
 const report={version:1,nativeHeldHeroHomePairPublished:true,nativePid:m.nativePid,fixture:m.fixture,
  firstPublication:await descriptor(join(m.fixture,'publication.json')),secondPublication:await descriptor(join(m.fixture,'second-publication.json')),
  journal:second.journal,beforeJournal,beforeJournalSha256:second.journalSha256,journalSha256,
  expectedManifest:second.ownerManifest,ready:readyPacket,active,retired,marker,nativeManifest,publicationReceipt:receipt,controls,stats,exactRetryWrites:0,
  nativeReceiptConsumed:false,homewardGameplayResumed:false,browserUsed:false,realOPFSDurabilityQualified:false,goalComplete:false};
 // Full evidence precedes the acknowledgement, as on the outward journey.
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});await ack(receipt.acknowledgement);
 console.log(JSON.stringify({nativeHeldHeroHomePairPublished:true,ownerRevision:4,refusedControls:controls.length,acknowledgementWritten:true}));
 if(m.saveHome)await publishHeldHeroHomeSave(m,first,report);
}
