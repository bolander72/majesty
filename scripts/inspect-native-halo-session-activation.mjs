#!/usr/bin/env node
// Verify the original activation boundary and the complete saved continuation.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointChunks,
  checkpointAgentValues,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';

const [arrivalName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-session-activation-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const arrival=await json(arrivalName);assert.equal(arrival.nativeRunningActorArrivalQualified,true);
assert.equal(await hash(arrival.manifest),arrival.manifestSha256);
const m=await json(arrival.manifest),p=await json(m.preparation);
assert.equal(m.mode,'actor-activation');assert.equal(m.haloSessionActorActivationTrialCompleted,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
assert.equal(m.stopReason,null);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
try{process.kill(m.nativePid,0);throw Error('Native producer is live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.deepEqual(m.journalBefore,m.journalAfter);
assert.deepEqual(m.journalBefore,p.journalSha256);assert.equal(m.privateNativeExecutableUnchanged,true);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...arrival.sourceSha256,...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [[m.log,m.logSha256],[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],
 [m.privateNativeExecutable,m.nativeExecutableSha256],['scripts/run-native-halo-session.py',m.runnerSha256]])assert.equal(await hash(n),h);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
const request=m.actorActivationRequest;
for(const r of [request.imported,request.packet])assert.equal(await hash(r.filename),r.sha256);
assert.deepEqual(request.imported,arrival.importedWorld);
assert.equal(await readFile(request.packet.filename,'utf8'),`halo-session-activate-v1\n1\n1_0\n50\n3550\n${arrival.importedWorld.sha256}\n`);
function file(name){const filename=join(m.root,'frontier_1_0/Documents/My Games/MajestyHD/SaveGame',name);
 const rows=m.files.filter(r=>r.filename===filename);assert.equal(rows.length,1);return rows[0];}
const worldRows=['Before','Ready','Evolved'].map(stage=>file(`Halo_Session_Activation_${stage}_1.GMP`));
const worlds=[],states=[];const {unitId:hero,agentId:agent,attachedUnitIds:effects}=arrival.destinationAliases;
const proxy=arrival.proxyAgentId;
for(const r of worldRows){assert.equal(await hash(r.filename),r.sha256);assert.ok(r.bytes<=2*1024*1024);
 worlds.push(await stoppedFileSource(r.filename));states.push(await connectedWorldState(r.filename,{unscheduledAgents:r===worldRows[0]?[proxy,agent]:[proxy]}));}
assert.deepEqual(states.map(s=>s.clock),[50,50,3550]);
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
assert.equal(maps[1].has('ORDR:'+hero),false);
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

const readyEntries=[];
for(const id of effects){const entries=[];for await(const e of checkpointActorOrderEntries(worlds[1],id))if(e.type==='entry')entries.push(e);
 readyEntries.push(entries);assert.ok(entries.length>0);
 for(const k of ['UNIT','ORDR'])assert.ok(!maps[2].has(k+':'+id),'Expired effect remains in saved world');}
assert.deepEqual(readyEntries.map(entries=>entries.map(e=>e.kind)),[[13,5],[9],[9]]);
const waitDeadlines=readyEntries.slice(1).map(entries=>(entries[0].words[5]+entries[0].words[6])>>>0);
for(let i=0;i<3;i++){
 await verifyRegisteredHeroSnapshot(p.identity,{unitId:hero,agentId:agent},{kind:'proxy',unitId:0,agentId:proxy},worlds[i],true,'1_0');
 assert.equal(states[i].queues.flat().filter(id=>id===agent).length,i?1:0);
 const proxyRecord=maps[i].get('GPL:'+proxy);assert.ok(proxyRecord);
 assert.deepEqual(await worlds[i].readAt(proxyRecord.offset,proxyRecord.size),new Uint8Array(await readFile(join(m.root,'frontier_1_0/Halo_Session_Home_Observed.GPL'))));
 const children=[];for await(const c of checkpointContainerEntries(worlds[i]))if(c.unitId===hero&&c.groupKind===1&&c.type==='member')children.push(c.targetUnitId);
 assert.deepEqual(children,i===2?[]:effects);
 const values=[];for await(const v of checkpointAgentValues(worlds[i],agent))values.push(v);
 for(const name of ['home','target'])assert.equal(values.find(v=>v.attribute===name&&!v.path.length).targetAgentId,proxy);
 const task=values.find(v=>v.attribute==='taskname'&&!v.path.length);assert.equal(task.stringBytes,7);
 const text=Buffer.from(await worlds[i].readAt(task.offset,7));assert.equal(text.toString('ascii'),'go_home');
 const unit=maps[i].get('UNIT:'+hero);assert.ok(unit);
 const pose=Buffer.from(await worlds[i].readAt(unit.offset+60,20));
 assert.deepEqual([0,4,8].map(at=>pose.readInt32LE(at)),[135015,258194,116930]);
 assert.deepEqual([12,16].map(at=>pose.readUInt32LE(at)),[4,8]);
}
assert.ok((await lstat(m.log)).size<4*1024*1024);const log=await readFile(m.log,'utf8');
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.ok(!/result=fail|abort from/.test(log));
assert.ok(log.includes(`Halo session activated hero=${hero} agent=${agent} effects=${effects.join(',')} proxy=${proxy} clock=50 footprint=4 drawing=1 queued=1 original-collision=1 original-first-postload=4 completed-model-step-cached=4 original-second-postload=4 effect-orders-admitted=3 hero-bank-absent=1 remote-guard=1 owner-published=0 result=pass`));
const endpoint=[...log.matchAll(/Halo session activation endpoint clock=3550 ai=(\d+) held-ai=(\d+) contexts=(\d+) other-ai=(\d+) commands=(\d+),(\d+),(\d+),(\d+) retired=(\d+),(\d+),(\d+) samples=70/g)];assert.equal(endpoint.length,1);
const counts=endpoint[0].slice(1).map(Number);for(const n of counts.slice(0,4))assert.ok(n>0&&n<=65536);
for(const n of counts.slice(5,8))assert.ok(n>0&&n<=4096);
const retired=counts.slice(8);assert.deepEqual(retired.slice(1),waitDeadlines);
for(let k=0;k<3;k++)assert.ok(log.includes(`Halo session effect retired unit=${effects[k]} index=${k+1} clock=${retired[k]} original-commands=${counts[5+k]} result=pass`));
assert.ok(log.includes(`Halo session continuation hero=${hero} agent=${agent} proxy=${proxy} clock=3550 ticks=70 footprint=4 drawing=1 queued=1 original-ai=1 original-effect-lifetimes=3 remote-home-before-guard=1 request-held=1 other-ai-running=1 hooks-removed=1 owner-published=0 result=pass`));
assert.ok(log.includes('Halo session activation evolved serial=1 key=1_0 clock=3550 phase=3 pending=7 original-writer=1 original-pause=1 ordinary-ticks=71 owner-published=0 result=pass'));
assert.equal(m.deadlineSeconds,55);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
assert.ok(m.resourceSamples.length);for(const r of m.resourceSamples)assert.ok(r.rssBytes<=m.rssCeilingBytes);
const sourceSha256={...arrival.sourceSha256,'scripts/inspect-native-halo-session-activation.mjs':await hash('scripts/inspect-native-halo-session-activation.mjs')};
const report={version:1,nativeRunningActorActivationQualified:true,manifest:arrival.manifest,manifestSha256:arrival.manifestSha256,
 arrivalProof:{filename:resolve(arrivalName),sha256:await hash(arrivalName)},sourceSha256,destinationAliases:arrival.destinationAliases,
 proxyAgentId:proxy,worlds:worldRows,exactActivationRecords,completeActivationRootsQualified:true,originalAiCalls:counts[0],heldAiCalls:counts[1],
 contextCalls:counts[2],otherAiCalls:counts[3],commandCalls:counts.slice(4,8),effectRetirementClocks:retired,waitDeadlinesPreserved:true,
 originalTicks:70,originalSpatialAndDrawingActivationQualified:true,remoteHomeRequestPreserved:true,expiredEffectsAbsent:true,
 sourceRetired:true,sourceUnloaded:true,destinationAttached:true,destinationActivated:true,ownerPublished:false,actualJournalUnchanged:true,
 peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),elapsedMs:m.finishedAtMs-m.startedAtMs,
 nativeSessionTerminal:true,nativeExitCode:0,browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeRunningActorActivationQualified:true,exactActivationRecords,originalTicks:70,effectRetirementClocks:retired}));
