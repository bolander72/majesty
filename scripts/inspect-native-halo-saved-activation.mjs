#!/usr/bin/env node
// Check actual original activation and the accepted remote-home return leg.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointChunks,checkpointAgentValues,checkpointActorRecords} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
import {checkpointHaloHomeLeg} from '../web/world/halo-home-route.mjs';
import {planHaloActorHandoff} from '../web/world/halo-region-layout.mjs';
import {checkpointActorOrderEntries} from '../web/world/family-order-entries.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
const [arrivalName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-saved-activation-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const arrival=await json(arrivalName);assert.equal(arrival.nativeSavedNeighborActorArrivalQualified,true);
assert.equal(await hash(arrival.manifest),arrival.manifestSha256);
const m=await json(arrival.manifest),p=await json(m.preparation),request=m.savedActorActivationRequest;
assert.equal(m.savedActorActivationRequested,true);assert.equal(m.haloSavedActorActivationTrialCompleted,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.deepEqual(m.journalBefore,m.journalAfter);
try{process.kill(m.nativePid,0);throw Error('Native producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
for(const[n,h]of Object.entries({...arrival.sourceSha256,...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const r of [request.preparation,request.packet,request.imported,m.savedActivationGate])assert.equal(await hash(r.filename),r.sha256);
const gate=await json(m.savedActivationGate.filename);assert.equal(gate.generation,290);assert.equal(gate.nativeSavedNeighborActorArrivalQualified,true);
for(const r of gate.sources.concat(gate.evidence))assert.equal(await hash(r.preserved),r.sha256);
const prep=await json(request.preparation.filename);assert.equal(prep.nativeSavedActorActivationPrepared,true);
for(const[n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(n),h);
assert.equal(await hash('scripts/prepare-native-halo-saved-activation.mjs'),request.helperSha256);
assert.equal(await hash(prep.producer.filename),prep.producer.sha256);const producer=await json(prep.producer.filename);
assert.equal(producer.nativePid,m.nativePid);assert.equal(producer.nativeSessionTerminal,false);assert.deepEqual(producer.compiledSourceSha256,m.compiledSourceSha256);
for(const r of [prep.imported,request.imported])for(const key of ['filename','bytes','sha256'])assert.equal(r[key],arrival.importedWorld[key]);
assert.equal(await readFile(request.packet.filename,'utf8'),`halo-session-saved-activate-v1\n1\n1_0\n3750\n32\n272\n0_0\n${arrival.importedWorld.sha256}\n`);
const {unitId:hero,agentId:agent}=arrival.destinationAliases,proxy=34,alias={unitId:hero,agentId:agent},homeAlias={kind:'proxy',unitId:0,agentId:proxy};
function file(name){const filename=join(m.root,'frontier_1_0/Documents/My Games/MajestyHD/SaveGame',name),rows=m.files.filter(r=>r.filename===filename);assert.equal(rows.length,1);return rows[0];}
const worldRows=[arrival.importedWorld,file('Halo_Session_Saved_Activation_Ready_1.GMP'),file('Halo_Session_Saved_Route_Ready_1.GMP'),file('Halo_Session_Saved_Continuation_Crossed_1.GMP')],worlds=[],states=[];
for(const[i,r]of worldRows.entries()){
 assert.equal(await hash(r.filename),r.sha256);worlds.push(await stoppedFileSource(r.filename));
 states.push(await connectedWorldState(r.filename,{unscheduledAgents:i?[proxy]:[proxy,agent]}));
}
assert.deepEqual(states.slice(0,3).map(s=>s.clock),[3750,3750,3750]);
assert.deepEqual(await checkpointHaloHomeLeg(worlds[0],{identity:p.identity,alias,homeAlias,region:'1_0'}),prep.route);
assert.deepEqual(prep.route.movementPoint,{x:32,y:272});assert.equal(prep.route.nextRegion,'0_0');
async function records(source){const map=new Map(),add=(k,r)=>{assert.ok(!map.has(k)&&map.size<4096);map.set(k,r);};
 for await(const r of checkpointUnits(source))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(source))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(source))add(r.kind+':'+r.unitId,r);return map;}
const maps=[];for(const w of worlds)maps.push(await records(w));
assert.deepEqual([...maps[0].keys()].sort(),[...maps[1].keys()].sort());
let exactActivationRecords=0;
for(const[k,r]of maps[0]){const t=maps[1].get(k);assert.equal(r.size,t.size,k);
 for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);
  assert.deepEqual(await worlds[0].readAt(r.offset+at,n),await worlds[1].readAt(t.offset+at,n),k);}
 exactActivationRecords++;}
assert.equal(maps[1].has('ORDR:'+hero),true);
assert.equal(states[0].rng,states[1].rng);assert.equal(states[0].gameplayRng,states[1].gameplayRng);
assert.equal(states[0].rawTerrainSha256,states[1].rawTerrainSha256);
assert.deepEqual(states[0].roots.filter(r=>r.tag!=='GPL '),states[1].roots.filter(r=>r.tag!=='GPL '));
assert.equal(states[0].activeQueue,states[1].activeQueue);
const ownQueues=states[1].queues.map((q,index)=>({index,count:q.filter(id=>id===agent).length}));
assert.equal(ownQueues.reduce((n,r)=>n+r.count,0),1);
const insertedQueue=ownQueues.find(r=>r.count===1).index;
for(let k=0;k<2;k++)assert.deepEqual(states[1].queues[k],k===insertedQueue?[...states[0].queues[k],agent]:states[0].queues[k]);
// Reconstruct the entire GPL root: only its three envelope sizes, one queue
// count, and the original pending-list append may change at activation.
async function root(source,tag){let found;for await(const r of checkpointChunks(source))if(r.tag===tag){assert.equal(found,undefined);found=r;}assert.ok(found);return found;}
const bg=await root(worlds[0],'GPL '),ag=await root(worlds[1],'GPL '),agents=[];
for await(const r of checkpointAgents(worlds[0]))agents.push(r);
const tail=agents.at(-1).offset+agents.at(-1).size;
const countOffset=tail+(insertedQueue?4+4*states[0].queues[0].length:0);
const insertion=countOffset+4+4*states[0].queues[insertedQueue].length;
assert.equal(ag.size,bg.size+4);assert.equal(ag.version,bg.version);assert.equal(ag.count,bg.count);
const patches=[];for(const relative of [4,16,28,countOffset-bg.offset]){
 const bytes=Buffer.from(await worlds[0].readAt(bg.offset+relative,4));
 bytes.writeUInt32LE(bytes.readUInt32LE(0)+(relative===countOffset-bg.offset?1:4));patches.push({relative,bytes});}
const added=Buffer.from(await worlds[1].readAt(ag.offset+insertion-bg.offset,4));assert.equal(added.readUInt32LE(0),agent);
for(let at=0;at<bg.size+16;){const n=Math.min(4096,bg.size+16-at,at<insertion-bg.offset?insertion-bg.offset-at:Infinity);
 const bytes=Uint8Array.from(await worlds[0].readAt(bg.offset+at,n));
 for(const patch of patches)for(let j=0;j<4;j++){const position=patch.relative+j-at;if(position>=0&&position<n)bytes[position]=patch.bytes[j];}
 assert.deepEqual(await worlds[1].readAt(ag.offset+at+(at>=insertion-bg.offset?4:0),n),bytes);at+=n;}

// The original movement request may replace only the hero's command bank.
// No original tick ran between Ready and RouteReady; keep all other records,
// roots, queues, RNG and terrain exact rather than accepting a broad diff.
assert.deepEqual([...maps[1].keys()].sort(),[...maps[2].keys()].sort());
let exactRouteRecords=0;
for(const[k,r]of maps[1])if(k!=='ORDR:'+hero){const t=maps[2].get(k);assert.equal(t.size,r.size,k);
 for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await worlds[2].readAt(t.offset+at,n),await worlds[1].readAt(r.offset+at,n),k);}exactRouteRecords++;
}
assert.deepEqual(states[2].roots.filter(r=>r.tag!=='ORDR'),states[1].roots.filter(r=>r.tag!=='ORDR'));
assert.deepEqual(states[2].queues,states[1].queues);assert.equal(states[2].rng,states[1].rng);assert.equal(states[2].gameplayRng,states[1].gameplayRng);
const entries=[];for await(const e of checkpointActorOrderEntries(worlds[2],hero))if(e.type==='entry')entries.push(e);
assert.ok(entries.length>0&&entries.length<=3);
for(let i=1;i<4;i++){
 await verifyEntitySnapshot(p.identity,alias,worlds[i],true,homeAlias);
 await verifyRegisteredHeroSnapshot(p.identity,alias,homeAlias,worlds[i],true,'1_0');
 const home=maps[i].get('GPL:34'),old=maps[0].get('GPL:34');assert.equal(home.size,old.size);
 assert.deepEqual(await worlds[i].readAt(home.offset,home.size),await worlds[0].readAt(old.offset,old.size));
 assert.equal(states[i].queues.flat().filter(id=>id===agent).length,1);
 const fields=new Map();for await(const v of checkpointAgentValues(worlds[i],agent))if(!v.path.length)fields.set(v.attribute.toLowerCase(),v);
 const task=fields.get('taskname');assert.equal(task.type,3);assert.equal(task.stringBytes,7);assert.equal(Buffer.from(await worlds[i].readAt(task.offset,8)).toString('ascii'),'go_home\0');
 for(const name of ['home','target'])assert.equal(fields.get(name).targetAgentId,34);
 assert.deepEqual(fields.get('destination').words,[(-608)>>>0,160]);
 assert.equal(fields.get('activescript').functions[0].name,'travel_to');
 if(i<3)assert.equal(states[i].rawTerrainSha256,states[0].rawTerrainSha256);
}
// Ordinary movement explores nearby terrain. Reconstruct the whole MTER root,
// allowing only its observed monotonic player-zero explored-bit additions;
// every height, shading byte, other player bit, cell and header stays exact.
const terrains=await Promise.all([worlds[2],worlds[3]].map(checkpointTerrain));
assert.deepEqual(terrains.map(t=>[t.width,t.height]),[[128,128],[128,128]]);
const terrainRoots=await Promise.all([worlds[2],worlds[3]].map(w=>root(w,'MTER')));
assert.deepEqual(terrainRoots.map(r=>[r.size,r.version,r.count]),[...Array(2)].map(()=>[terrainRoots[0].size,terrainRoots[0].version,terrainRoots[0].count]));
const vertexBegin=terrains[0].heightOffset(0,0),vertexEnd=vertexBegin+129*129*9;let exploredBitAdditions=0;
for(let at=0;at<terrainRoots[0].size+16;at+=4096){const n=Math.min(4096,terrainRoots[0].size+16-at),
 before=await worlds[2].readAt(terrainRoots[0].offset+at,n),after=await worlds[3].readAt(terrainRoots[1].offset+at,n);
 for(let k=0;k<n;k++)if(before[k]!==after[k]){
  const absolute=terrainRoots[0].offset+at+k;
  assert.ok(absolute>=vertexBegin&&absolute<vertexEnd&&(absolute-vertexBegin)%9===5);
  assert.equal(before[k]&1,0);assert.equal(after[k],before[k]|1);++exploredBitAdditions;
 }
}
const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024);
const rows=[...log.matchAll(/Halo saved continuation crossed hero=(\d+) agent=(\d+) proxy=34 clock=(\d+) previous-clock=(\d+) previous=(-?\d+),(-?\d+),(-?\d+) accepted=(-?\d+),(-?\d+),(-?\d+) ai=(\d+) other-ai=(\d+) contexts=(\d+) commands=(\d+) ticks=(\d+) original-movement=1 physical=4 drawing=1 task-preserved=1 owner-published=0 result=pass/g)];
assert.equal(rows.length,1);const row=rows[0].slice(1).map(Number),[unitId,agentId,clock,previousClock]=row;
assert.deepEqual([unitId,agentId],[hero,agent]);assert.equal(clock,previousClock+50);assert.equal(clock,states[3].clock);
const previous=Object.fromEntries(['x','y','z'].map((k,i)=>[k,row[4+i]])),accepted=Object.fromEntries(['x','y','z'].map((k,i)=>[k,row[7+i]]));
const handoff=planHaloActorHandoff(previous,accepted,'1_0');assert.equal(handoff.destinationRegion,prep.route.nextRegion);
const actor=await checkpointActorRecords(worlds[3],hero),bytes=Buffer.from(await worlds[3].readAt(actor.unit.offset+60,12));
assert.deepEqual([0,4,8].map(at=>bytes.readInt32LE(at)),Object.values(accepted));
assert.notDeepEqual(previous,accepted);assert.equal(accepted.y,557056);assert.ok(clock>3750&&clock<=6750);
const [ai,otherAi,contexts,commands,ticks]=row.slice(10);for(const n of [ai,otherAi,contexts,commands])assert.ok(n>0&&n<=65536);
assert.equal(ticks,(clock-3750)/50);assert.ok(ticks<=60);
assert.ok(log.includes(`Halo saved home leg hero=${hero} agent=${agent} proxy=34 clock=3750 point=32,272 next=0_0 original-command=005b4870 pose-written=0 task-preserved=1 owner-published=0 result=pass`));
assert.ok(log.includes(`Halo saved continuation held serial=1 key=1_0 clock=${clock} phase=3 pending=7 original-writer=1 original-pause=1 owner-published=0 result=pass`));
const sourceSha256={...arrival.sourceSha256,...prep.sourceSha256,'scripts/inspect-native-halo-saved-activation.mjs':await hash('scripts/inspect-native-halo-saved-activation.mjs')};
const report={version:1,nativeSavedNeighborActorActivationQualified:true,nativeSavedNeighborHomeLegQualified:true,
 arrivalProof:{filename:resolve(arrivalName),sha256:await hash(arrivalName)},manifest:arrival.manifest,manifestSha256:arrival.manifestSha256,
 sourceSha256,activationPreparation:request.preparation,destinationAliases:alias,homeAlias,worlds:worldRows,
 exactActivationRecords,exactRouteRecords,completeActivationRootsQualified:true,activationQueueAppendQualified:true,
 route:prep.route,acceptedCrossing:handoff,crossingClock:clock,counts:{ai,otherAi,contexts,commands,ticks},
 originalCollisionPostloadQualified:true,originalDrawingQualified:true,originalSchedulerQualified:true,originalNativeMovementQualified:true,
 existingHomeProxyExact:true,logicalHomeGoalPreserved:true,remoteTravelToRoutedBeforeLocalLookup:true,
 terrainHeightsExact:16641,terrainOnlyExploredBitAdditions:exploredBitAdditions,
 actualJournalUnchanged:true,nativeSessionTerminal:true,nativeExitCode:0,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSavedNeighborActorActivationQualified:true,nativeSavedNeighborHomeLegQualified:true,exactActivationRecords,exactRouteRecords,clock,ticks}));
