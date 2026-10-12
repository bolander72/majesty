#!/usr/bin/env node
// Verify exact activation and original AI continuation of the saved-east return.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointChunks,
 checkpointAgentValues,checkpointActorRecords} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';

const [importName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-saved-home-activation-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const imported=await json(importName);assert.equal(imported.nativeSavedHomeActorArrivalQualified,true);assert.equal(imported.actorActivated,false);
assert.equal(await hash(imported.manifest),imported.manifestSha256);const m=await json(imported.manifest),p=await json(m.preparation),request=m.savedActorHomeActivationRequest;
for(const key of ['savedActorHomeActivationRequested','haloSavedActorHomeActivationTrialCompleted','nativeSessionTerminal','ownedProducerAbsent'])assert.equal(m[key],true);
assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
try{process.kill(m.nativePid,0);throw Error('Native producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.journalBefore,p.journalSha256);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...imported.sourceSha256,...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [[m.log,m.logSha256],[m.preparation,m.preparationSha256],[m.privateNativeExecutable,m.nativeExecutableSha256],
 ['scripts/run-native-halo-session.py',m.runnerSha256],['scripts/prepare-native-halo-saved-home-activation.mjs',request.helperSha256]])assert.equal(await hash(n),h);
for(const row of [request.preparation,request.packet,request.imported,m.savedHomeActivationGate])assert.equal(await hash(row.filename),row.sha256);
const prep=await json(request.preparation.filename);assert.equal(prep.nativeSavedHomeActivationPrepared,true);assert.equal(prep.ticks,200);
for(const[n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(n),h);
assert.equal(await hash(prep.producer.filename),prep.producer.sha256);const producer=await json(prep.producer.filename);assert.equal(producer.nativeSessionTerminal,false);assert.equal(producer.nativePid,m.nativePid);assert.deepEqual(producer.compiledSourceSha256,m.compiledSourceSha256);
const gate=await json(m.savedHomeActivationGate.filename);assert.equal(gate.generation,294);assert.equal(gate.nativeSavedHomeActorArrivalQualified,true);
for(const row of gate.sources.concat(gate.evidence))assert.equal(await hash(row.preserved),row.sha256);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.selectedManifest);
for(const r of [prep.imported,request.imported])for(const key of ['filename','bytes','sha256'])assert.equal(r[key],imported.wholeWorlds[1][key]);
assert.equal(await readFile(request.packet.filename,'utf8'),`halo-session-saved-home-activate-v1\n2\n0_0\n103500\n113500\n${prep.imported.sha256}\n`);
function file(name){const filename=join(m.root,'frontier_0_0/Documents/My Games/MajestyHD/SaveGame',name),rows=m.files.filter(r=>r.filename===filename);assert.equal(rows.length,1);return rows[0];}
const rows=[imported.wholeWorlds[1],file('Halo_Session_Saved_Home_Ready_2.GMP'),file('Halo_Session_Saved_Home_Evolved_2.GMP')];
const hero=imported.actualNativeUnitId,agent=imported.actualAgentId,worlds=[],states=[],maps=[];
async function records(s){const map=new Map(),add=(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,row);};
 for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;}
for(const[i,r]of rows.entries()){
 assert.equal(await hash(r.filename),r.sha256);assert.equal((await lstat(r.filename)).size,r.bytes);
 worlds.push(await stoppedFileSource(r.filename));states.push(await connectedWorldState(r.filename,{unscheduledAgents:i?[]:[agent]}));
 maps.push(await records(worlds[i]));
 await verifyRegisteredHeroSnapshot(p.identity,{unitId:hero,agentId:agent},{kind:'native',unitId:469,agentId:7},worlds[i],true,'0_0');
 if(i)await verifyEntitySnapshot(p.identity,{unitId:hero,agentId:agent},worlds[i],true,{kind:'native',unitId:469,agentId:7});
}
assert.deepEqual(states.map(s=>s.clock),[103500,103500,113500]);
assert.deepEqual([...maps[0].keys()].sort(),[...maps[1].keys()].sort());
let exactActivationRecords=0;
for(const[key,a]of maps[0]){const b=maps[1].get(key);assert.equal(b.size,a.size,key);
 for(let at=0;at<a.size;at+=4096){const n=Math.min(4096,a.size-at);
  assert.deepEqual(await worlds[1].readAt(b.offset+at,n),await worlds[0].readAt(a.offset+at,n),key);}
 ++exactActivationRecords;}
assert.equal(exactActivationRecords,509);
assert.equal(states[0].rng,states[1].rng);assert.equal(states[0].gameplayRng,states[1].gameplayRng);
assert.equal(states[0].rawTerrainSha256,states[1].rawTerrainSha256);
assert.deepEqual(states[0].roots.filter(r=>r.tag!=='GPL '),states[1].roots.filter(r=>r.tag!=='GPL '));
assert.equal(states[0].activeQueue,states[1].activeQueue);
const own=states[1].queues.map((q,index)=>({index,count:q.filter(id=>id===agent).length}));
assert.equal(own.reduce((n,r)=>n+r.count,0),1);const insertedQueue=own.find(r=>r.count===1).index;
for(let k=0;k<2;++k)assert.deepEqual(states[1].queues[k],k===insertedQueue?[...states[0].queues[k],agent]:states[0].queues[k]);
// Reconstruct every GPL-root byte; only the original pending queue append and
// its four counts/lengths may differ. Reads stay bounded at 4 KiB.
async function root(s,tag){let result;for await(const r of checkpointChunks(s))if(r.tag===tag){assert.equal(result,undefined);result=r;}assert.ok(result);return result;}
const bg=await root(worlds[0],'GPL '),ag=await root(worlds[1],'GPL '),agents=[];
for await(const r of checkpointAgents(worlds[0]))agents.push(r);
const tail=agents.at(-1).offset+agents.at(-1).size;
const countOffset=tail+(insertedQueue?4+4*states[0].queues[0].length:0);
const insertion=countOffset+4+4*states[0].queues[insertedQueue].length;
assert.equal(ag.size,bg.size+4);assert.equal(ag.version,bg.version);assert.equal(ag.count,bg.count);
const patches=[];for(const relative of [4,16,28,countOffset-bg.offset]){
 const bytes=Buffer.from(await worlds[0].readAt(bg.offset+relative,4));
 bytes.writeUInt32LE(bytes.readUInt32LE(0)+(relative===countOffset-bg.offset?1:4));patches.push({relative,bytes});}
assert.equal(Buffer.from(await worlds[1].readAt(ag.offset+insertion-bg.offset,4)).readUInt32LE(),agent);
for(let at=0;at<bg.size+16;){const n=Math.min(4096,bg.size+16-at,at<insertion-bg.offset?insertion-bg.offset-at:Infinity);
 const bytes=Uint8Array.from(await worlds[0].readAt(bg.offset+at,n));
 for(const patch of patches)for(let j=0;j<4;++j){const pos=patch.relative+j-at;if(pos>=0&&pos<n)bytes[pos]=patch.bytes[j];}
 assert.deepEqual(await worlds[1].readAt(ag.offset+at+(at>=insertion-bg.offset?4:0),n),bytes);at+=n;}
const poses=[];
for(let i=0;i<3;++i){assert.equal(states[i].queues.flat().filter(id=>id===agent).length,i?1:0);
 const unit=maps[i].get('UNIT:'+hero);assert.ok(unit);assert.equal(unit.primary.words[2]&4,0);
 const b=Buffer.from(await worlds[i].readAt(unit.offset+60,20));poses.push([0,4,8,12,16].map(at=>b.readInt32LE(at)));
 if(i<2){const kinds=[];for await(const e of checkpointActorOrderEntries(worlds[i],hero))if(e.type==='entry')kinds.push(e.kind);assert.deepEqual(kinds,[2,4,7]);}
}
assert.deepEqual(poses[0],poses[1]);assert.notDeepEqual(poses[1],poses[2]);
const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024&&!/result=fail|abort from|refused boundary=/.test(log));assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.ok(log.includes(`Halo saved home activated hero=${hero} agent=${agent} home=469/7 clock=103500 footprint=4 drawing=1 queued=1 orders-admitted=1 original-collision=1 original-postload=1 completed-model-step-cached=1 ungated-ai=1 owner-published=0 result=pass`));
const observed=[...log.matchAll(/Halo saved home continuation hero=(\d+) agent=(\d+) clock=113500 ticks=(\d+) ai=(\d+) other-ai=(\d+) contexts=(\d+) building=(\d+) commands=(\d+) initial=(-?\d+),(-?\d+),(-?\d+) final=(-?\d+),(-?\d+),(-?\d+) footprint=4 drawing=1 queued=1 rosters=1 ungated-ai=1 hooks-removed=1 owner-published=0 result=pass/g)];assert.equal(observed.length,1);
const values=observed[0].slice(1).map(Number),[id,gid,ticks,ai,otherAi,contexts,building,commands]=values;
assert.deepEqual([id,gid],[hero,agent]);assert.equal(ticks,200);for(const n of [ai,otherAi,commands])assert.ok(n>0&&n<=65536);assert.ok(contexts<=65536&&building<=4096);
assert.deepEqual(values.slice(8,11),poses[1].slice(0,3));assert.deepEqual(values.slice(11,14),poses[2].slice(0,3));
assert.ok(log.includes('Halo saved home continuation held serial=2 key=0_0 clock=113500 phase=3 pending=7 original-writer=1 original-pause=1 ordinary-ticks=200 owner-published=0 result=pass'));
assert.equal(m.deadlineSeconds,55);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.finishedAtMs-m.startedAtMs<57000);for(const r of m.resourceSamples)assert.ok(r.rssBytes<=m.rssCeilingBytes);
// Ordinary movement explores nearby terrain. Reconstruct the whole MTER root,
// allowing only its observed monotonic player-zero explored-bit additions;
// every height, shading byte, other player bit, cell and header stays exact.
const terrains=await Promise.all([worlds[1],worlds[2]].map(checkpointTerrain));
assert.deepEqual(terrains.map(t=>[t.width,t.height]),[[128,128],[128,128]]);
const terrainRoots=await Promise.all([worlds[1],worlds[2]].map(w=>root(w,'MTER')));
assert.deepEqual(terrainRoots.map(r=>[r.size,r.version,r.count]),[...Array(2)].map(()=>[terrainRoots[0].size,terrainRoots[0].version,terrainRoots[0].count]));
const vertexBegin=terrains[0].heightOffset(0,0),vertexEnd=vertexBegin+129*129*9;let exploredBitAdditions=0;
for(let at=0;at<terrainRoots[0].size+16;at+=4096){const n=Math.min(4096,terrainRoots[0].size+16-at),
 before=await worlds[1].readAt(terrainRoots[0].offset+at,n),after=await worlds[2].readAt(terrainRoots[1].offset+at,n);
 for(let k=0;k<n;k++)if(before[k]!==after[k]){
  const absolute=terrainRoots[0].offset+at+k;
  assert.ok(absolute>=vertexBegin&&absolute<vertexEnd&&(absolute-vertexBegin)%9===5);
  assert.equal(before[k]&1,0);assert.equal(after[k],before[k]|1);++exploredBitAdditions;
 }
}
const sourceSha256={...imported.sourceSha256,...prep.sourceSha256,'scripts/inspect-native-halo-saved-home-activation.mjs':await hash('scripts/inspect-native-halo-saved-home-activation.mjs')};
const report={version:1,nativeSavedHomeActorActivationQualified:true,nativeSavedHomeOriginalGameplayQualified:true,importProof:{filename:resolve(importName),sha256:await hash(importName)},
 manifest:imported.manifest,manifestSha256:imported.manifestSha256,sourceSha256,activationPreparation:request.preparation,actualNativeUnitId:hero,actualAgentId:agent,
 worlds:rows,exactActivationRecords,completeActivationRootsQualified:true,activationQueueAppendQualified:true,originalCollisionPostloadQualified:true,originalDrawingQualified:true,originalSchedulerQualified:true,
 homeGuildMembershipPreserved:true,poses,counts:{ticks,ai,otherAi,contexts,building,commands},terrainHeightsExact:16641,terrainOnlyExploredBitAdditions:exploredBitAdditions,
 originalAiUngated:true,originalNativeMovementQualified:true,homeArrivalClock:103500,continuationClock:113500,physicalGuildEntryQualified:false,
 actualJournalUnchanged:true,nativeSessionTerminal:true,nativeExitCode:0,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({nativeSavedHomeActorActivationQualified:true,nativeSavedHomeOriginalGameplayQualified:true,exactActivationRecords,ticks,ai,otherAi,commands}));
