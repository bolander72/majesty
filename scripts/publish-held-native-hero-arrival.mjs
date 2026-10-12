#!/usr/bin/env node
// Owned native qualification of the production publication adapter while the
// original destination is held. No browser or second game process is started.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,open,rename,readdir} from 'node:fs/promises';
import {join,resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {parseHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {nativeHeroArrivalReady,parseNativeHeroArrivalReady,nativeHeroArrivalPublished,publishHeldNativeHeroArrival} from '../web/world/hero-travel-publication.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {publishHeldSecondHeroCapture} from './lib/publish-held-second-hero-capture.mjs';
import {stageHeldFirstHeroOutward} from './lib/stage-held-first-hero-outward.mjs';

const [inputName,initialReadyPacket,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
let readyPacket=initialReadyPacket;
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const operation=value=>createHash('sha256').update(JSON.stringify(value)+'\n').digest('hex');
const m=await json(inputName);await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
assert.equal(resolve(outName),join(m.fixture,'publication.json'));await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
assert.equal(m.nativeSessionTerminal,false);assert.equal(m.publishArrival,true);process.kill(m.nativePid,0);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(n),h);
assert.equal(await hash(join(m.fixture,'native/recomp/pop_smoke')),m.nativeExecutableSha256);
const binding=parseHeroRuntimeBinding(m.runtimeBinding);assert.equal(binding.region,'0_0');
assert.equal(await hash(m.arrivalPreparation.filename),m.arrivalPreparation.sha256);
const prepared=await json(m.arrivalPreparation.filename),identity=prepared.identity;
assert.deepEqual({unitId:binding.unitId,agentId:binding.agentId},{unitId:prepared.selectedOwner.unitId,agentId:prepared.selectedOwner.agentId});
const startup=await json(m.startup.filename);assert.equal(await hash(m.startup.filename),m.startup.sha256);
assert.equal(identity.entityId,startup.receipt.owner.entityId);assert.equal(identity.registeredHome.worldId,startup.worldId);
let early,firstCaptureAcknowledgement;
if(m.firstOutwardBrowserInput){
 assert.equal(readyPacket,'await-first-outward');early=await stageHeldFirstHeroOutward(m,startup,prepared);
 for(let i=0;i<160;i++){
  process.kill(m.nativePid,0);assert.ok((await lstat(m.log)).size<m.logCeilingBytes);
  const found=[...(await readFile(m.log,'utf8')).matchAll(/^\[frontier\] Hero travel publication held receipt=(\S+) phase=7 pending=0 ordinary-ticks=0$/gm)];
  assert.ok(found.length<=1);if(found.length){readyPacket=found[0][1];break;}await new Promise(r=>setTimeout(r,50));
 }
 assert.notEqual(readyPacket,'await-first-outward','Original first arrival did not reach publication hold');
 // The source's fixed receipt mailbox will be used by the later home save.
 // Preserve this consumed first receipt and clear that mailbox while its
 // source world is unloaded, so a future held save cannot see a stale packet.
 const consumed=join(m.fixture,'frontier_0_0/Frontier_Hero_Capture_Published.txt'),
  preserved=join(m.fixture,'frontier_0_0/Hero_Travel_First_Capture_Published.txt');
 assert.equal(await readFile(consumed,'utf8'),early.report.acknowledgement);
 await assert.rejects(lstat(preserved),e=>e.code==='ENOENT');await rename(consumed,preserved);
 firstCaptureAcknowledgement={filename:preserved,...await hashNativeFile(preserved)};
}
const ready=parseNativeHeroArrivalReady(readyPacket);
assert.equal(ready.region,'1_0');assert.equal(ready.serial,1);assert.equal(ready.clock,m.destinationClock);
const save=(key,name)=>join(m.fixture,'frontier_'+key,'Documents/My Games/MajestyHD/SaveGame',name+'.GMP');
let capturedName=early?.report.captured.filename??save('0_0','Frontier_0_0_Recovery');
if(m.publishHome&&!early){
 const backup=save('0_0','Hero_Travel_Source_Capture'),f=await open(backup,'wx');let at=0;
 try{await hashNativeFile(capturedName,{sink:async bytes=>{
  for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }});await f.sync();}finally{await f.close();}capturedName=backup;
}
const retiredName=save('0_0','Hero_Source_Retired');let activeName=save('1_0','Frontier_1_0_Recovery');
if(m.importRepeatNeighbor){
 const backup=save('1_0','Hero_Travel_First_Accepted'),f=await open(backup,'wx');let at=0;
 try{await hashNativeFile(activeName,{sink:async bytes=>{
  for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }});await f.sync();}finally{await f.close();}activeName=backup;
}
const descriptor=async filename=>({filename,...await hashNativeFile(filename)});
const captured=await descriptor(capturedName),retired=await descriptor(retiredName),active=await descriptor(activeName);
if(m.pageHome&&!early){
 const marker=join(m.fixture,'frontier_0_0/Frontier_0_0.checkpoint');
 await writeFile(join(m.fixture,'frontier_0_0/Hero_Travel_Source_Capture.checkpoint'),await readFile(marker),{flag:'wx'});
}
assert.equal(active.bytes,ready.size);assert.equal(active.sha256,ready.sha256);
const sourceClock=await checkpointSavedClock(await stoppedFileSource(capturedName));
assert.equal(sourceClock,prepared.options.sourceClockMs);assert.equal(await checkpointSavedClock(await stoppedFileSource(retiredName)),sourceClock);
assert.equal(await checkpointSavedClock(await stoppedFileSource(activeName)),ready.clock);
const stats={},io=await stoppedHeroRouteStorage(m.publicationJournal,stats),store=new HeroRouteStore(io,identity,identity.contentDigest);
const initial=await store.read();assert.equal(initial.record.manifest,early?.report.ownerManifest??startup.receipt.ownerManifest);
const sourceAlias={unitId:binding.unitId,agentId:binding.agentId},sourceHome={kind:'native',unitId:binding.homeUnitId,agentId:binding.homeAgentId};
const world=async r=>({source:await stoppedFileSource(r.filename),sha256:r.sha256});
const capturedManifest=early?.report.ownerManifest??(await store.commit({kind:'save',operationId:operation(['native-held-capture',captured.sha256,initial.record.manifest]),
 expectedManifest:initial.record.manifest,regions:['0_0'],aliases:[sourceAlias],homeAliases:[sourceHome],worlds:[await world(captured)]})).manifest;
const ackName=join(m.fixture,'frontier_1_0/Frontier_Hero_Travel_Published.txt');
async function ack(text){const temp=ackName+'.tmp',f=await open(temp,'wx');
 try{await f.writeFile(text);await f.sync();}finally{await f.close();}await rename(temp,ackName);
 const d=await open(dirname(ackName),'r');try{await d.sync();}finally{await d.close();}}
async function log(){assert.ok((await lstat(m.log)).size<4*1024*1024);return readFile(m.log,'utf8');}
const refusal='[frontier] Hero travel publication refused serial=1 region=1_0 clock='+ready.clock+' phase=7 pending=0';
const count=text=>text.split(refusal).length-1;
const controls=[];
for(const [kind,fields]of [['wrong-serial',{serial:2}],['wrong-clock',{clock:ready.clock+50}],['wrong-native-alias',{unitId:ready.unitId+1}],['unpublished-pair',{}]]){
 const text=nativeHeroArrivalPublished(nativeHeroArrivalReady({...ready,...fields}),capturedManifest),previous=count(await log());
 await ack(text);let observed=false;
 for(let i=0;i<60;i++){process.kill(m.nativePid,0);const lines=await log();
  assert.ok(!lines.includes('[frontier] Hero travel publication accepted '));
  if(count(lines)>previous){observed=true;break;}await new Promise(r=>setTimeout(r,50));}
 assert.equal(observed,true,kind+' not refused by held engine');
 controls.push({kind,acknowledgement:text,refusedByEngine:true,clock:ready.clock,phase:7,pending:0});
}
const request={ready:readyPacket,operationId:operation(['native-held-arrival',capturedManifest,retired.sha256,active.sha256]),
 expectedManifest:capturedManifest,sourceRegion:binding.region,sourceAlias,sourceHome,sourceClock,capturedSha256:captured.sha256,
 retiredSource:await world(retired),activeSource:await world(active)};
const published=await publishHeldNativeHeroArrival(store,request);assert.equal(published.ownerRevision,2);
const writes=stats.writes,retry=await publishHeldNativeHeroArrival(store,request);assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
assert.equal(await readFile(join(m.publicationJournal,HERO_ROUTE_HEAD),'utf8'),published.ownerManifest);
for(const r of [captured,retired,active])assert.equal(await hash(r.filename),r.sha256);
const sourceSha256={},pending=[resolve('scripts/publish-held-native-hero-arrival.mjs')];
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(sourceSha256[name])continue;
 assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&Object.keys(sourceSha256).length<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);sourceSha256[name]=await hash(n);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const journalSha256={};for(const name of (await readdir(m.publicationJournal)).sort())journalSha256[name]=await hash(join(m.publicationJournal,name));
const report={version:1,nativeHeldHeroPairPublished:true,input:{filename:resolve(inputName),sha256:await hash(inputName)},
 nativePid:m.nativePid,fixture:m.fixture,compiledSourceSha256:m.compiledSourceSha256,nativeExecutableSha256:m.nativeExecutableSha256,
 captured,retired,active,identity,capturedManifest,publicationReceipt:published,ready:readyPacket,controls,
 journal:m.publicationJournal,journalSha256,stats,sourceSha256,exactRetryWrites:0,
 firstOutwardInput:early?.descriptor??null,
 firstCaptureAcknowledgement:firstCaptureAcknowledgement??null,
 nativeReceiptConsumed:false,independentNativeResumeQualified:false,browserUsed:false,realOPFSDurabilityQualified:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
// Publication and its complete report precede the acknowledgement write.
await ack(published.acknowledgement);
console.log(JSON.stringify({nativeHeldHeroPairPublished:true,ownerRevision:2,refusedControls:controls.length,acknowledgementWritten:true}));
if(m.publishSecondCapture)await publishHeldSecondHeroCapture(m,report);
