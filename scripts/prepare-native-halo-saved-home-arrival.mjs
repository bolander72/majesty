#!/usr/bin/env node
// Prepare the actual saved-east return for the original held home reader.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {resolve,join,dirname,basename,relative} from 'node:path';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {prepareCheckpointRegisteredHeroArrival} from '../web/world/arrival.mjs';
import {execFileSync} from 'node:child_process';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
import {checkpointAbsentAgentReferences} from '../web/world/checkpoint.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';
const [proofName,directoryName,mode]=process.argv.slice(2),live=mode==='--live';assert.equal(process.argv.length,live?5:4);assert.ok(mode===undefined||live);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),live?/^native-halo-saved-home-arrival-live-preparation-\d{3}$/:/^native-halo-saved-home-arrival-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
let proof,m,p,producerBytes;
if(live){
 producerBytes=await readFile(proofName);assert.ok(producerBytes.length<256*1024);m=JSON.parse(producerBytes);p=await json(m.preparation);
 assert.equal(m.nativeOnly,true);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);assert.equal(m.savedActorHomeArrivalRequested,true);
 assert.equal(m.nativeSessionTerminal,false);assert.equal(m.nativeExitCode,null);process.kill(m.nativePid,0);
 assert.equal(execFileSync('/bin/ps',['-p',String(m.nativePid),'-o','comm='],{encoding:'utf8',maxBuffer:2048}).trim(),m.privateNativeExecutable);
 assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-session-');
 assert.equal(m.root,join(m.fixture,'native-world-halo'));assert.equal(await hash(m.preparation),m.preparationSha256);assert.equal(Object.keys(m.compiledSourceSha256).length,54);
 const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024);
 assert.ok(log.includes('Halo saved return home held serial=2 key=0_0 clock=103500 phase=7 ordinary-ticks=0 source-retired=1 incoming-imported=0'));
 assert.ok(log.includes('Halo saved return retired hero=537 agent=37 proxy=34 clock=4050 original-removal=1 aliases-absent=1'));
 const saved=async(region,name)=>{const filename=join(m.root,'frontier_'+region,'Documents/My Games/MajestyHD/SaveGame',name);return{filename,...await hashNativeFile(filename,{maximum:2*1024*1024})};};
 proof={sourceSha256:{},manifest:resolve(proofName),manifestSha256:await hash(proofName),
  beforeWorld:await saved('1_0','Halo_Session_Saved_Continuation_Crossed_1.GMP'),retiredWorld:await saved('1_0','Halo_Session_Saved_Return_Retired_1.GMP'),heldHome:await saved('0_0','Halo_Session_Return_Home_Held_2.GMP')};
}else{
proof=await json(proofName);assert.equal(proof.nativeSavedNeighborReturnRetirementQualified,true);assert.equal(proof.nativeSavedNeighborHomeReloadQualified,true);
assert.equal(proof.incomingActorImported,false);assert.equal(proof.ownerPublished,false);assert.equal(proof.sourceClock,4050);assert.equal(proof.destinationClock,103500);
assert.equal(await hash(proof.manifest),proof.manifestSha256);m=await json(proof.manifest);p=await json(m.preparation);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
try{process.kill(m.nativePid,0);throw Error('Native producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
}
for(const[n,h]of Object.entries({...proof.sourceSha256,...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const r of [proof.beforeWorld,proof.retiredWorld,proof.heldHome])assert.equal(await hash(r.filename),r.sha256);
const source=await stoppedFileSource(proof.beforeWorld.filename),home=await stoppedFileSource(proof.heldHome.filename);
const retired=await stoppedFileSource(proof.retiredWorld.filename);
assert.equal(await checkpointSavedClock(source),4050);assert.equal(await checkpointSavedClock(retired),4050);assert.equal(await checkpointSavedClock(home),103500);
await verifyEntitySnapshot(p.identity,{unitId:537,agentId:37},source,true,{kind:'proxy',unitId:0,agentId:34});
await verifyRegisteredHeroSnapshot(p.identity,{unitId:537,agentId:37},{kind:'proxy',unitId:0,agentId:34},source,true,'1_0');
await verifyEntitySnapshot(p.identity,{unitId:537,agentId:37},retired,false,{kind:'proxy',unitId:0,agentId:34});
await verifyRegisteredHeroSnapshot(p.identity,{unitId:537,agentId:37},{kind:'proxy',unitId:0,agentId:34},retired,false,'1_0');
assert.equal((await checkpointAbsentAgentReferences(retired,37)).sites.length,0);
await verifyEntitySnapshot(p.identity,{unitId:508,agentId:25},home,false,{kind:'native',unitId:469,agentId:7});
await verifyRegisteredHeroSnapshot(p.identity,{unitId:508,agentId:25},{kind:'native',unitId:469,agentId:7},home,false,'0_0');
const options={unitId:537,freshUnitId:100000,freshAgentId:1000,unitBindings:[],attachedUnitBindings:[],sourceClockMs:4050,destinationClockMs:103500,
 haloRegions:{version:'halo-v1',sourceRegion:'1_0',destinationRegion:'0_0'}};
const context={identity:p.identity,regions:['1_0','0_0'],ownerSide:0,aliases:[{unitId:537,agentId:37},{unitId:100000,agentId:1000}],
 homeAliases:[{kind:'proxy',unitId:0,agentId:34},{kind:'native',unitId:469,agentId:7}],referenceBindings:[]};
const prepared=await prepareCheckpointRegisteredHeroArrival(source,home,options,context),plan=prepared.plan;
assert.deepEqual(Object.keys(prepared.records).sort(),['agent','container','order','unit']);
assert.equal(plan.registeredHome.destination.unitId,469);assert.equal(plan.registeredHome.destination.agentId,7);
assert.equal(plan.haloPlacement.remoteHomeRoutingRequired,false);
assert.deepEqual(plan.haloPlacement.sourceFixed,{x:120063,y:557056,z:85977});
assert.deepEqual(plan.haloPlacement.destinationFixed,{x:8246527,y:557056,z:85977});
assert.deepEqual(plan.haloPlacement.destinationGrid,{x:251,y:17});
assert.deepEqual(plan.heroOrders.entries.map(e=>e.kind),[2,4,7]);
const heights=[await sampleNativeGroundHeight(await checkpointTerrain(source),plan.haloPlacement.sourceFixed),
 await sampleNativeGroundHeight(await checkpointTerrain(home),plan.haloPlacement.destinationFixed)];assert.equal(heights[0],heights[1]);
// Independently reconstruct every original byte through only declared edits
// and the one reciprocal registered-home container insertion.
for(const [key,range]of Object.entries(plan.ranges)){
 const bytes=Uint8Array.from(await source.readAt(range.offset,range.size)),view=new DataView(bytes.buffer);
 for(const e of plan.edits.filter(e=>e.record===key)){const at=e.offset-range.offset;assert.equal(view.getUint32(at,true),e.before);view.setUint32(at,e.after,true);}
 const t=plan.containerTransforms.find(t=>t.record===key);let expected=bytes;
 if(t){assert.equal(key,'container');assert.equal(t.removeBytes,0);assert.deepEqual(t.insertWords,[469,1]);
  const insertion=new Uint8Array(8),v=new DataView(insertion.buffer);v.setUint32(0,469,true);v.setUint32(4,1,true);
  const at=t.offset-range.offset;expected=new Uint8Array(bytes.length+8);expected.set(bytes.subarray(0,at));expected.set(insertion,at);expected.set(bytes.subarray(at),at+8);
 }
 assert.deepEqual(prepared.records[key],expected);
}
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
const sourceSha256={},pending=[resolve('scripts/prepare-native-halo-saved-home-arrival.mjs')];
while(pending.length){const name=pending.pop(),rel=relative(workspace,name);if(sourceSha256[rel])continue;
 assert.ok(!rel.startsWith('..')&&!rel.startsWith('/')&&Object.keys(sourceSha256).length<128);assert.ok((await lstat(name)).size<256*1024);
 const text=await readFile(name,'utf8');sourceSha256[rel]=await hash(name);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(name),match[1]));
}
await mkdir(directory);const records={};let totalRecordBytes=0;
for(const[name,bytes]of Object.entries(prepared.records)){
 assert.ok(bytes.length<=4096);totalRecordBytes+=bytes.length;const filename=join(directory,name+'.bin');await writeFile(filename,bytes,{flag:'wx'});records[name]={filename,...await hashNativeFile(filename)};
}
assert.deepEqual(Object.fromEntries(Object.entries(records).map(([k,r])=>[k,r.bytes])),{unit:442,agent:1850,order:544,container:84});assert.equal(totalRecordBytes,2920);
const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;};
const pack=Buffer.concat([words([0x31524848,1,4,4050,103500,537,37,469,7,100000,1000,2920]),
 ...['unit','agent','container','order'].flatMap((name,i)=>[words([i,537,prepared.records[name].length]),Buffer.from(prepared.records[name])])]);
assert.equal(pack.length,3016);const packName=join(directory,'Halo_Session_Saved_Home_Arrival.pack');await writeFile(packName,pack,{flag:'wx'});
for(const r of [proof.beforeWorld,proof.retiredWorld,proof.heldHome])assert.equal(await hash(r.filename),r.sha256);
let reference={filename:resolve(proofName),sha256:await hash(proofName)},packet;
if(live){
 assert.equal(reference.sha256,proof.manifestSha256);process.kill(m.nativePid,0);
 const producer=join(directory,'Producer.before.json');await writeFile(producer,producerBytes,{flag:'wx'});reference={filename:producer,sha256:proof.manifestSha256,producerManifest:resolve(proofName)};
 const filename=join(directory,'Halo_Session_Saved_Home_Arrival.txt');
 await writeFile(filename,`halo-session-saved-home-arrival-v1\n2\n0_0\n4050\n103500\n${proof.beforeWorld.sha256}\n${proof.heldHome.sha256}\n${await hash(packName)}\n3016\n`,{flag:'wx'});packet={filename,...await hashNativeFile(filename)};
}
const report={version:1,nativeSavedHomeArrivalCapsulePrepared:true,livePreparation:live,proof:reference,packet,compiledSourceSha256:m.compiledSourceSha256,
 sourceWorld:proof.beforeWorld,retiredWorld:proof.retiredWorld,homeWorld:proof.heldHome,identity:p.identity,options,context,plan,
 records,totalRecordBytes,pack:{filename:packName,...await hashNativeFile(packName)},ground:{sourceHeight:heights[0],destinationHeight:heights[1],zPreserved:true},sourceSha256,
 originalRecordComparisons:4,journal:p.journal,journalSha256:p.journalSha256,selectedRevision:6,
 nativeProcessesStarted:0,browserUsed:false,actorImported:false,homeActivated:false,ownerPublished:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSavedHomeArrivalCapsulePrepared:true,records:4,totalRecordBytes,packBytes:pack.length,sourceClock:4050,destinationClock:103500}));
