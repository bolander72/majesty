#!/usr/bin/env node
// Independent saved-state and accepted original movement qualification.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve,basename,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {stoppedFileSource,workspace,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointChunks,checkpointAgentQueues,
 checkpointActorRecords,checkpointPlacements,checkpointNextAgentId,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {checkpointHaloHomeLeg} from '../web/world/halo-home-route.mjs';
import {planHaloActorHandoff} from '../web/world/halo-region-layout.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointActorOrderNavigation} from '../web/world/order-navigation.mjs';

const [manifestName,importName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-activation-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function bound(r){assert.equal((await lstat(r.filename)).size,r.bytes);assert.equal(await hash(r.filename),r.sha256);}
const m=await json(manifestName),imported=await json(importName);
assert.equal(m.nativeHeroActivationTrialQualified,true);assert.equal(m.destinationActivated,true);assert.equal(m.ownerTransferred,false);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
assert.equal(m.stopReason,null);assert.equal(m.browserUsed,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
try{process.kill(m.nativePid,0);assert.fail('Activation producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(imported.nativeHeroArrivalQualified,true);assert.equal(imported.manifest.filename,resolve(manifestName));
assert.equal(imported.manifest.sha256,await hash(manifestName));
await bound(m.activationPreparation);await bound(m.arrivalPreparation);const p=await json(m.arrivalPreparation.filename),a=await json(m.activationPreparation.filename);
for(const[n,h]of Object.entries({...imported.sourceSha256,...a.sourceSha256,...m.compiledSourceSha256}))assert.equal(await hash(n),h);
assert.equal(await hash('scripts/run-native-hero-home.py'),m.runnerSha256);assert.equal(await hash(m.log),m.logSha256);
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-home-');assert.equal(m.profile,join(m.fixture,'frontier_1_0'));
for(const row of m.worlds)await bound(row);await bound(a.sourceWorld);
assert.equal(m.activationOriginalCheckpointUnchanged,true);assert.equal(m.worlds.length,10);
assert.deepEqual(m.worlds.slice(5).map(r=>basename(r.filename)),['Hero_Activation_Refused.GMP','Hero_Activation_Ready.GMP','Hero_Activation_Routed.GMP','Hero_Activation_Crossed.GMP','Hero_Activation_Closed.GMP']);
const {unitId:hero,agentId:agent,homeAgentId:proxy}=m.importedAliases,alias={unitId:hero,agentId:agent},home={kind:'proxy',unitId:0,agentId:proxy};
const sources=[],states=[],maps=[];
async function digest(s,offset,size){const h=createHash('sha256');for(let at=0;at<size;at+=4096)h.update(await s.readAt(offset+at,Math.min(4096,size-at)));return h.digest('hex');}
async function records(s){const map=new Map(),add=async(key,r)=>{assert.ok(map.size<4096&&!map.has(key));map.set(key,{...r,sha256:await digest(s,r.offset,r.size)});};
 for await(const r of checkpointUnits(s))await add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))await add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))await add(r.kind+':'+r.unitId,r);return map;}
for(let i=4;i<10;i++){
 const s=await stoppedFileSource(m.worlds[i].filename);sources.push(s);maps.push(await records(s));
 states.push(await connectedWorldState(m.worlds[i].filename,{unscheduledAgents:i<6?[34,proxy,agent]:[34,proxy]}));
 await verifyRegisteredHeroSnapshot(p.identity,alias,home,s,true,p.options.haloRegions.destinationRegion);
 assert.equal(await checkpointNextAgentId(s),agent+1);const actor=await checkpointActorRecords(s,hero);
 assert.equal(actor.unit.agentId,agent);assert.equal(actor.agent.unitId,hero);assert.equal(actor.agent.deleted,false);
 assert.equal(actor.unit.parentUnitId,0);assert.equal(actor.unit.stateFlags&4,0);
 for(const key of ['family','description','playerNumber'])assert.equal(actor.unit[key],p.identity.actor[key]);
}
assert.deepEqual(states.map(s=>s.clock),[m.clock,m.clock,m.clock,m.clock,m.activeCrossing.clock,m.activeCrossing.clock]);
let exactRecordComparisons=0;
function sameRecords(before,after,omit=[]){assert.deepEqual([...before.keys()].sort(),[...after.keys()].sort());
 for(const[key,r]of before)if(!omit.includes(key)){assert.equal(after.get(key).size,r.size);assert.equal(after.get(key).sha256,r.sha256,key);exactRecordComparisons++;}}
sameRecords(maps[0],maps[1]);assert.deepEqual(states[0].roots,states[1].roots); // invalid activation requests
sameRecords(maps[1],maps[2]);assert.deepEqual(states[1].roots.filter(r=>r.tag!=='GPL '),states[2].roots.filter(r=>r.tag!=='GPL '));
async function queues(s){const rows=[];for await(const q of checkpointAgentQueues(s)){assert.ok(rows.length<8192);rows.push(q);}return rows;}
const beforeQueues=await queues(sources[1]),readyQueues=await queues(sources[2]),added=readyQueues.filter(q=>q.agentId===agent);
assert.equal(added.length,1);assert.ok(!beforeQueues.some(q=>q.agentId===agent));
const semantic=q=>q.type==='queued-agent'?{type:q.type,queue:q.queue,index:q.index,agentId:q.agentId}:{type:q.type,activeQueue:q.activeQueue};
assert.deepEqual(readyQueues.filter(q=>q.agentId!==agent).map(semantic),beforeQueues.map(semantic));
async function root(s,tag){let result;for await(const c of checkpointChunks(s))if(c.tag===tag){assert.equal(result,undefined);result=c;}assert.ok(result);return result;}
const bg=await root(sources[1],'GPL '),ag=await root(sources[2],'GPL '),q=added[0],insertion=q.offset-ag.offset;
assert.equal(ag.size,bg.size+4);assert.equal(ag.version,bg.version);assert.equal(ag.count,bg.count);
assert.equal(q.index,beforeQueues.filter(v=>v.type==='queued-agent'&&v.queue===q.queue).length);
const patches=[];for(const[relative,increment,expected]of [[4,4,bg.size],[16,4,bg.size],[28,4,null],
 [q.offset-(q.index+1)*4-ag.offset,1,q.index]]){
 const old=Buffer.from(await sources[1].readAt(bg.offset+relative,4)).readUInt32LE(0);if(expected!==null)assert.equal(old,expected);
 const bytes=Buffer.alloc(4);bytes.writeUInt32LE(old+increment);patches.push({relative,bytes});}
assert.equal(Buffer.from(await sources[2].readAt(q.offset,4)).readUInt32LE(0),agent);
for(let at=0;at<bg.size+16;){const n=Math.min(4096,bg.size+16-at,at<insertion?insertion-at:Infinity),bytes=Uint8Array.from(await sources[1].readAt(bg.offset+at,n));
 for(const p of patches)for(let j=0;j<4;j++){const relative=p.relative+j-at;if(relative>=0&&relative<n)bytes[relative]=p.bytes[j];}
 assert.deepEqual(await sources[2].readAt(ag.offset+at+(at>=insertion?4:0),n),bytes);at+=n;}
const leg=await checkpointHaloHomeLeg(sources[2],{identity:p.identity,alias,homeAlias:home,region:p.options.haloRegions.destinationRegion});
assert.deepEqual(leg.movementPoint,a.leg.movementPoint);assert.equal(leg.homeRegion,a.leg.homeRegion);assert.equal(leg.nextRegion,a.leg.nextRegion);
sameRecords(maps[2],maps[3],['ORDR:'+hero]);assert.deepEqual(states[2].roots.filter(r=>r.tag!=='ORDR'),states[3].roots.filter(r=>r.tag!=='ORDR'));
const oldOrders=await root(sources[2],'ORDR'),routedOrders=await root(sources[3],'ORDR');
assert.equal(oldOrders.version,routedOrders.version);assert.equal(oldOrders.count,routedOrders.count);
assert.equal(routedOrders.size-oldOrders.size,maps[3].get('ORDR:'+hero).size-maps[2].get('ORDR:'+hero).size);
const routedEntries=[],routedPoints=[],evolvedEntries=[];
for await(const e of checkpointActorOrderEntries(sources[3],hero))if(e.type==='entry')routedEntries.push({bank:e.bank,index:e.index,kind:e.kind,stamp:e.words[5],count:e.waypointCount});
assert.deepEqual(routedEntries,[{bank:0,index:0,kind:4,stamp:m.clock,count:0},{bank:1,index:0,kind:7,stamp:m.clock,count:1}]);
for await(const n of checkpointActorOrderNavigation(sources[3],hero))if(n.field==='destination'||n.field==='waypoint')routedPoints.push({kind:n.kind,field:n.field,x:n.x,y:n.y});
assert.deepEqual(routedPoints,[{kind:4,field:'destination',...a.leg.movementPoint},{kind:7,field:'waypoint',...a.leg.movementPoint}]);
const crossed=m.activeCrossing;assert.equal(crossed.unitId,hero);assert.equal(crossed.agentId,agent);
assert.equal(crossed.clock-m.clock,crossed.ticks*50);assert.ok(crossed.ticks>0&&crossed.ticks<=40);
assert.equal(crossed.previousClock,crossed.clock-50);
for(const key of ['aiCalls','otherAiCalls','remoteContexts','commandCalls'])assert.ok(crossed[key]>0&&crossed[key]<=65536);
const handoff=planHaloActorHandoff(crossed.previous,crossed.accepted,p.options.haloRegions.destinationRegion);
assert.equal(handoff.destinationRegion,a.leg.nextRegion);
const [fromX,fromY]=handoff.sourceRegion.split('_').map(Number),[toX,toY]=handoff.destinationRegion.split('_').map(Number);
assert.deepEqual([toX-fromX,toY-fromY],{west:[-1,0],east:[1,0],north:[0,-1],south:[0,1]}[a.leg.direction]);
let pose;for await(const v of checkpointPlacements(sources[4]))if(v.unitId===hero){assert.ok(!pose);pose=v.fixedPosition;}
assert.deepEqual(pose,crossed.accepted);assert.equal(pose.x<64*2048,true);
for await(const e of checkpointActorOrderEntries(sources[4],hero))if(e.type==='entry')evolvedEntries.push({bank:e.bank,index:e.index,kind:e.kind,stamp:e.words[5],count:e.waypointCount??null});
assert.deepEqual(evolvedEntries.map(e=>[e.bank,e.index,e.kind]),[[0,0,2],[0,1,4],[1,0,7]]);
assert.equal(evolvedEntries[0].stamp,crossed.clock);assert.equal(evolvedEntries[1].stamp,m.clock);assert.equal(evolvedEntries[2].stamp,m.clock);
for(const s of states){assert.equal(s.rawTerrainSha256,states[0].rawTerrainSha256);assert.equal(s.counts.agents,states[0].counts.agents);}
assert.deepEqual(states[4].records.units,states[5].records.units);sameRecords(maps[4],maps[5]);assert.deepEqual(states[4].roots,states[5].roots);
for(const key of ['GPL:34','GPL:'+proxy,'CONT:'+hero])assert.equal(maps[4].get(key).sha256,maps[3].get(key).sha256);
const otherUnitsChanged=[...maps[4]].filter(([key,r])=>key.startsWith('UNIT:')&&key!=='UNIT:'+hero&&r.sha256!==maps[3].get(key).sha256).length;
const otherScriptsChanged=[...maps[4]].filter(([key,r])=>key.startsWith('GPL:')&&key!=='GPL:'+agent&&r.sha256!==maps[3].get(key).sha256).length;
assert.ok(otherUnitsChanged>0&&otherScriptsChanged>0);
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from|GplException/.test(log));
assert.ok(log.includes('footprint=4 drawing=1 queued=1 orders-admitted=1 original-collision=1 original-postload=1'));
assert.ok(log.includes('original-pause=1 hooks-removed=1 binding-cleared=1 owner-published=0 result=pass'));
assert.ok(log.includes('undeliverable calls: none'));assert.ok(m.resourceSamples.every(s=>s.rssBytes<=m.rssCeilingBytes));
const sourceSha256={...imported.sourceSha256,...a.sourceSha256},pending=[resolve('scripts/inspect-native-hero-activation.mjs')];
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(sourceSha256[name])continue;
 assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&Object.keys(sourceSha256).length<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);sourceSha256[name]=await hash(n);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,nativeHeroActivationQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 importQualification:{filename:resolve(importName),sha256:await hash(importName)},sourceSha256,
 activationPreparation:m.activationPreparation,originalWorlds:m.worlds.slice(4),destinationAliases:alias,homeAlias:home,
 startClock:m.clock,endClock:crossed.clock,originalTicks:crossed.ticks,exactRecordComparisons,otherUnitsChanged,otherScriptsChanged,
 originalCollisionAndPostloadQualified:true,physicalCells:4,drawingRegistered:true,aiScheduled:true,
 logicalRegisteredHomePreserved:true,physicalRoute:leg,acceptedCrossing:crossed,handoff,
 activeAiCalls:crossed.aiCalls,otherAiCalls:crossed.otherAiCalls,remoteContexts:crossed.remoteContexts,commandCalls:crossed.commandCalls,
 originalPauseQualified:true,hookAndBindingCleanupQualified:true,sourceRetired:false,sourceUnloaded:false,ownerTransferred:false,
 browserUsed:false,goalComplete:false,nativeSessionTerminal:true,ownedProducerAbsent:true,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes))};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHeroActivationQualified:true,originalTicks:crossed.ticks,exactRecordComparisons,otherUnitsChanged,otherScriptsChanged,
 activeAiCalls:crossed.aiCalls,otherAiCalls:crossed.otherAiCalls,endClock:crossed.clock,ownerTransferred:false}));
