#!/usr/bin/env node
// Corroborate one original pure-home insertion in the held neighbour.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {inspectNativeHaloSessionActorPaging} from './inspect-native-halo-session-actor-paging.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {haloTerrainHeight,haloSharedVertex} from '../web/world/halo-region-layout.mjs';
import {nativeHeightBits} from '../web/world/native-height.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {verifyRemoteHomeAgent,encodeRemoteHomeAgent} from '../web/world/remote-home.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentQueues,checkpointUnitAgentLinks,checkpointChunks} from '../web/world/checkpoint.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const[trialName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-session-proxy-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const m=await json(trialName);assert.ok(['actor-proxy','actor-epoch','actor-arrival','actor-activation'].includes(m.mode));const expectedClock=m.mode==='actor-proxy'?0:50;assert.equal(m.haloSessionHomeProxyTrialCompleted,true);
const paging=await inspectNativeHaloSessionActorPaging(trialName),request=m.homeProxyRequest;
for(const r of [request.preparation,request.proposal,request.packet])assert.equal(await hash(r.filename),r.sha256);
assert.equal(await hash('scripts/prepare-native-halo-session-proxy.mjs'),request.helperSha256);
const p=await json(request.preparation.filename);assert.equal(p.nativeSessionHomeProxyPrepared,true);
for(const[n,h]of Object.entries(p.sourceSha256))assert.equal(await hash(n),h);
const epochWorld=expectedClock?m.files.find(r=>r.filename===join(m.root,'frontier_1_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Destination_Epoch_1.GMP')):paging.heldWorld;assert.ok(epochWorld);
for(const k of ['filename','bytes','sha256'])assert.equal(p.held[k],epochWorld[k]);assert.equal(p.held.largestRead,4096);assert.equal(p.clock,expectedClock);
const registered=p.registered;assert.deepEqual(registered.record,paging.crossing.registeredHome);assert.equal(p.proposal.bytes,453);
assert.deepEqual(await readFile(request.proposal.filename),Buffer.from(encodeRemoteHomeAgent(registered.record,1000)));
assert.equal(await readFile(request.packet.filename,'utf8'),`halo-session-home-proxy-v1\n1\n1_0\n${expectedClock}\n${p.held.sha256}\n${p.proposal.sha256}\n453\n`);
const log=await readFile(m.log,'utf8'),rows=[...log.matchAll(/Halo session home proxy proposal=(\d+) agent=(\d+) bytes=(\d+) counter-before=(\d+) counter-after=(\d+) native-id=0 attributes=9 pure=1 original-valid=0 serialized-equal=1 registry-preserved=1 queues-preserved=1 clock=(\d+) phase=7 scheduled=0 hero-imported=0 owner-published=0 result=pass/g)];
assert.equal(rows.length,1);const row=rows[0],id=Number(row[2]);assert.equal(row[1],'1000');assert.equal(row[3],'453');assert.equal(Number(row[4]),id);assert.equal(Number(row[5]),id+1);assert.equal(Number(row[6]),expectedClock);
assert.ok(log.includes(`Halo session proxy ready serial=1 key=1_0 agent=${id} clock=${expectedClock} phase=7 original-writer=1 ordinary-ticks=${Number(Boolean(expectedClock))} hero-imported=0 owner-published=0 result=pass`));
function file(name){const filename=join(m.root,'frontier_1_0',name.endsWith('.GMP')?'Documents/My Games/MajestyHD/SaveGame':'',name),r=m.files.filter(r=>r.filename===filename);assert.equal(r.length,1);return r[0];}
const patched=file('Halo_Session_Home_Input.GPL'),observed=file('Halo_Session_Home_Observed.GPL'),ready=file('Halo_Session_Proxy_Ready_1.GMP');
assert.equal(patched.sha256,observed.sha256);assert.equal(patched.bytes,453);
await verifyRemoteHomeAgent(await stoppedFileSource(observed.filename),registered,id);
assert.deepEqual(await readFile(observed.filename),Buffer.from(encodeRemoteHomeAgent(registered.record,id)));
const beforeWorld=file('Halo_Session_Proxy_Before_1.GMP'),before=await stoppedFileSource(beforeWorld.filename),after=await stoppedFileSource(ready.filename);
async function records(s){const map=new Map(),add=(k,v)=>{assert.ok(!map.has(k)&&map.size<4096);map.set(k,v);};
 for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;}
const bm=await records(before),am=await records(after);assert.ok(!bm.has('GPL:'+id));
assert.deepEqual([...am.keys()].sort(),[...bm.keys(),'GPL:'+id].sort());
let unrelatedRecordComparisons=0;
for(const[k,r]of bm){const ar=am.get(k);assert.equal(ar.size,r.size,k);
 for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await before.readAt(r.offset+at,n),await after.readAt(ar.offset+at,n),k);}unrelatedRecordComparisons++;
}
const added=am.get('GPL:'+id);assert.equal(added.size,453);assert.equal(added.unitId,0);
assert.deepEqual(await after.readAt(added.offset,added.size),new Uint8Array(await readFile(observed.filename)));
async function queues(s){const rows=[];for await(const r of checkpointAgentQueues(s))rows.push(r.type==='queued-agent'?{type:r.type,queue:r.queue,agentId:r.agentId}:{type:r.type,activeQueue:r.activeQueue});return rows;}
assert.deepEqual(await queues(before),await queues(after));for(const q of await queues(after))assert.notEqual(q.agentId,id);
for await(const u of checkpointUnitAgentLinks(after))assert.notEqual(u.agentId,id);
await verifyRegisteredHeroSnapshot((await json(m.preparation)).identity,{unitId:100000,agentId:1001},{kind:'proxy',unitId:0,agentId:id},after,false,'1_0');
const bs=await connectedWorldState(beforeWorld.filename),as=await connectedWorldState(ready.filename,{unscheduledAgents:[id]});
assert.equal(bs.clock,expectedClock);assert.equal(as.clock,expectedClock);assert.equal(bs.rng,as.rng);assert.equal(bs.gameplayRng,as.gameplayRng);assert.equal(bs.rawTerrainSha256,as.rawTerrainSha256);
assert.deepEqual(bs.roots.filter(r=>r.tag!=='GPL '),as.roots.filter(r=>r.tag!=='GPL '));
// Reconstruct the entire affected GPL root as an ordered map insertion and
// five explicit DWORD changes. No other definitions, queues or bytes may change.
async function gpl(s){let result;for await(const r of checkpointChunks(s))if(r.tag==='GPL '){assert.equal(result,undefined);result=r;}assert.ok(result);return result;}
const bg=await gpl(before),ag=await gpl(after),agents=[];for await(const r of checkpointAgents(before))agents.push(r);
assert.ok(agents.length);const last=agents.at(-1);assert.ok(last.agentId<id);
const insertion=last.offset+last.size-bg.offset,delta=457;assert.equal(added.offset-4-ag.offset,insertion);assert.equal(ag.size,bg.size+delta);
const key=await after.readAt(added.offset-4,4);assert.equal(new DataView(key.buffer,key.byteOffset,4).getUint32(0,true),id);
const patches=[];
for(const[relative,increment,expected]of [[4,delta,bg.size],[16,delta,bg.size],[28,delta,null],[agents[0].offset-8-bg.offset,1,agents.length],[bg.end-12-bg.offset,1,id]]){
 const b=await before.readAt(bg.offset+relative,4),v=new DataView(b.buffer,b.byteOffset,4),old=v.getUint32(0,true);if(expected!==null)assert.equal(old,expected);
 const bytes=new Uint8Array(4);new DataView(bytes.buffer).setUint32(0,old+increment,true);patches.push({relative,bytes});
}
for(let at=0;at<bg.size+16;){const n=Math.min(4096,bg.size+16-at,at<insertion?insertion-at:Infinity),expected=Uint8Array.from(await before.readAt(bg.offset+at,n));
 for(const p of patches)for(let j=0;j<4;j++){const relative=p.relative+j-at;if(relative>=0&&relative<n)expected[relative]=p.bytes[j];}
 assert.deepEqual(await after.readAt(ag.offset+at+(at>=insertion?delta:0),n),expected);at+=n;
}
let destinationEpochQualified=false;
if(expectedClock){
 assert.equal(m.haloSessionDestinationEpochTrialCompleted,true);const r=m.destinationEpochRequest;
 for(const f of [r.held,r.packet])assert.equal(await hash(f.filename),f.sha256);
 assert.deepEqual(r.held,paging.heldWorld);assert.equal(r.beforeClock,0);assert.equal(r.afterClock,50);
 assert.equal(await readFile(r.packet.filename,'utf8'),`halo-session-destination-epoch-v1\n1\n1_0\n0\n50\n${r.held.sha256}\n`);
 const resume=[...log.matchAll(/Halo session epoch resume serial=1 key=1_0 clock=0 phase=7 pending=3 original-resume=1 ticks-permitted=1 result=pass/g)];
 const tick=[...log.matchAll(/Halo session epoch tick serial=1 key=1_0 before-clock=0 clock=50 phase=3 pending=7 original-tick=1 original-pause=1 ticks-permitted=0 result=pass/g)];
 const hold=[...log.matchAll(/Halo session epoch held serial=1 key=1_0 clock=50 phase=7 ordinary-ticks=1 original-writer=1 original-clock=1 actor-imported=0 owner-published=0 result=pass/g)];
 for(const rows of [resume,tick,hold])assert.equal(rows.length,1);assert.ok(resume[0].index<tick[0].index&&tick[0].index<hold[0].index&&hold[0].index<row.index);
 const epoch=await stoppedFileSource(epochWorld.filename);assert.equal(await checkpointSavedClock(epoch),50);
 const terrain=await checkpointTerrain(epoch);assert.deepEqual([terrain.width,terrain.height],[128,128]);let heights=0;
 for(let y=0;y<=128;y++)for(let x=0;x<=128;x++)if(haloSharedVertex(x,y)){
  const b=await epoch.readAt(terrain.heightOffset(x,y),4);assert.equal(new DataView(b.buffer,b.byteOffset,4).getUint32(0,true),nativeHeightBits(haloTerrainHeight('1_0',x,y)));heights++;
 }assert.equal(heights,2480);destinationEpochQualified=true;
}
const sourceSha256={...paging.sourceSha256,...p.sourceSha256};sourceSha256['scripts/inspect-native-halo-session-proxy.mjs']=await hash('scripts/inspect-native-halo-session-proxy.mjs');
const report={version:1,nativeRunningDestinationProxyQualified:true,nativeRunningActorPagingQualified:true,nativeRunningSourceRetirementQualified:true,nativeSelectedHeroCoreCrossingQualified:true,completeHeldWorldQualified:true,
 manifest:resolve(trialName),manifestSha256:await hash(trialName),sourceSha256,paging,crossing:paging.crossing,retirement:paging.retirement,
 removedRecords:paging.removedRecords,unrelatedRecordComparisons:paging.unrelatedRecordComparisons,proxyUnrelatedRecordComparisons:unrelatedRecordComparisons,
 destinationEpochQualified,destinationClock:expectedClock,destinationEpochWorld:expectedClock?epochWorld:null,proxyAgentId:id,proxyPreparation:request.preparation,registered,patchedRecord:patched,observedRecord:observed,proxyBeforeWorld:beforeWorld,proxyReadyWorld:ready,
 exactRootInsertionQualified:true,proxyPureAndUnscheduled:true,homeIdentityPreserved:true,otherWorldRootsAndRngExact:true,rawTerrainExact:true,betweenInsertionSnapshotsTicks:0,
 sourceRetired:true,sourceUnloaded:true,destinationAttached:true,destinationSimulationHeld:true,destinationActorImported:false,destinationActivated:false,
 actualJournalUnchanged:true,nativeSessionTerminal:true,nativeExitCode:0,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeRunningDestinationProxyQualified:true,proxyAgentId:id,proxyUnrelatedRecordComparisons:unrelatedRecordComparisons,destinationEpochQualified,destinationClock:expectedClock,heroImported:false}));
