#!/usr/bin/env node
// Corroborate original source removal after the running accepted crossing.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {inspectNativeHaloSessionActor} from './inspect-native-halo-session-actor.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentValues,
 checkpointAgentQueues,checkpointContainerEntries,checkpointAbsentAgentReferences,checkpointChunks} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderUnitReferences} from '../web/world/order-unit-bindings.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
async function records(s){const map=new Map(),add=(k,v)=>{assert.ok(!map.has(k)&&map.size<4096);map.set(k,v);};
 for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;}
async function exact(a,ar,b,br,key){assert.equal(ar.size,br.size,key);
 for(let at=0;at<ar.size;at+=4096){const n=Math.min(4096,ar.size-at);assert.deepEqual(await a.readAt(ar.offset+at,n),await b.readAt(br.offset+at,n),key);}}
async function rosterPatch(a,ar,b,br,drop,patches){
 assert.ok(ar.size<=4096&&drop>=0&&drop+8<=ar.size);const bytes=await a.readAt(ar.offset,ar.size),expected=new Uint8Array(ar.size-8);
 expected.set(bytes.subarray(0,drop));expected.set(bytes.subarray(drop+8),drop);const v=new DataView(expected.buffer);
 for(const[at,delta]of patches){assert.ok(at+4<=drop);v.setUint32(at,v.getUint32(at,true)+delta,true);}
 assert.equal(br.size,expected.length);assert.deepEqual(await b.readAt(br.offset,br.size),expected);
}
export async function inspectNativeHaloSessionRetirement(trialName) {
const m=await json(trialName);assert.ok(['actor-retirement','actor-paging','actor-proxy','actor-epoch','actor-arrival','actor-activation'].includes(m.mode));assert.equal(m.haloSessionActorRetirementTrialCompleted,true);
const crossing=await inspectNativeHaloSessionActor(trialName),request=m.actorRetirementRequest;
for(const r of [request.preparation,request.ids,request.packet])assert.equal(await hash(r.filename),r.sha256);
assert.equal(await hash('scripts/prepare-native-halo-session-retirement.mjs'),request.helperSha256);
const p=await json(request.preparation.filename);assert.equal(p.nativeSessionRetirementPrepared,true);assert.equal(p.clock,crossing.crossingClock);
for(const k of ['filename','bytes','sha256'])assert.equal(p.held[k],crossing.heldCheckpoint[k]);assert.equal(p.held.largestRead,4096);
for(const[n,h]of Object.entries(p.sourceSha256))assert.equal(await hash(n),h);
const ids=[p.heroUnitId,...p.children];assert.equal(new Set(ids).size,ids.length);assert.ok(ids.length<=4);
const retiredName=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Halo_Session_Actor_Retired_0.GMP'),rows=m.files.filter(r=>r.filename===retiredName);assert.equal(rows.length,1);
const retired=rows[0];assert.equal(await hash(retired.filename),retired.sha256);
const before=await stoppedFileSource(p.held.filename),after=await stoppedFileSource(retired.filename);
assert.equal(await checkpointSavedClock(before),p.clock);assert.equal(await checkpointSavedClock(after),p.clock);
const bm=await records(before),am=await records(after),removed=[];
for(const[k,r]of bm)if((k.startsWith('UNIT:')&&ids.includes(r.primary.words[1]))||k==='GPL:'+p.agentId||
 ((k.startsWith('CONT:')||k.startsWith('ORDR:'))&&ids.includes(r.unitId)))removed.push(k);
assert.ok(removed.includes('GPL:'+p.agentId));for(const id of ids)assert.ok(removed.includes('UNIT:'+id));
assert.deepEqual([...am.keys()].sort(),[...bm.keys()].filter(k=>!removed.includes(k)).sort());
let unrelatedRecordComparisons=0;for(const[k,r]of am)if(k!=='GPL:'+p.home.agentId&&k!=='CONT:'+p.home.unitId){
 await exact(before,bm.get(k),after,r,k);unrelatedRecordComparisons++;}
const values=[];for await(const v of checkpointAgentValues(before,p.home.agentId))if(v.attribute.toLowerCase()==='members')values.push(v);
assert.equal(values.length,2);const child=values.find(v=>v.path.length),root=values.find(v=>!v.path.length);
assert.deepEqual(child.path,[0]);assert.equal(child.type,5);assert.equal(child.targetAgentId,p.agentId);assert.equal(root.type,4);assert.equal(root.childCount,1);
const ga=bm.get('GPL:'+p.home.agentId),gb=am.get('GPL:'+p.home.agentId),list=root.typeOffset-ga.offset;
await rosterPatch(before,ga,after,gb,child.typeOffset-ga.offset,[[0,-8],[8,-8],[list+4,-8],[list+12,-1]]);
const memberships=[];for await(const v of checkpointContainerEntries(before))if(v.unitId===p.home.unitId&&v.groupKind===100)memberships.push(v);
assert.equal(memberships.length,2);const group=memberships.find(v=>v.type==='group'),member=memberships.find(v=>v.type==='member');
assert.equal(group.memberCount,1);assert.equal(member.targetUnitId,p.heroUnitId);assert.equal(member.flags,1);
const ca=bm.get('CONT:'+p.home.unitId),cb=am.get('CONT:'+p.home.unitId);
await rosterPatch(before,ca,after,cb,member.offset-ca.offset,[[8,-8],[ca.primary.offset-ca.offset+4,-8],[group.offset-ca.offset+4,-1]]);
assert.equal((await checkpointAbsentAgentReferences(after,p.agentId)).sites.length,0);
for await(const r of checkpointUnits(after))assert.ok(!ids.includes(r.primary.words[6]));
for await(const r of checkpointContainerEntries(after))assert.ok(!ids.includes(r.unitId)&&!ids.includes(r.groupOwnerUnitId)&&!ids.includes(r.targetUnitId));
for(const[k,r]of am)if(k.startsWith('ORDR:'))for await(const ref of checkpointActorOrderUnitReferences(after,r.unitId))assert.ok(!ids.includes(ref.targetUnitId));
async function queues(s){const q=[];for await(const r of checkpointAgentQueues(s))q.push(r.type==='queued-agent'?{type:r.type,queue:r.queue,agentId:r.agentId}:{type:r.type,activeQueue:r.activeQueue});return q;}
const beforeQueues=await queues(before);assert.equal(beforeQueues.filter(r=>r.agentId===p.agentId).length,1);
assert.deepEqual(await queues(after),beforeQueues.filter(r=>r.agentId!==p.agentId));
const bs=await connectedWorldState(p.held.filename),as=await connectedWorldState(retired.filename);
assert.equal(bs.rng,as.rng);assert.equal(bs.gameplayRng,as.gameplayRng);assert.equal(bs.rawTerrainSha256,as.rawTerrainSha256);
// UNIT records live in their family roots. Their complete remaining bytes
// were compared above; validate the enclosing count/size subtraction too.
const bv=bs.roots.filter(r=>r.tag==='VHCL'),av=as.roots.filter(r=>r.tag==='VHCL');assert.equal(bv.length,1);assert.equal(av.length,1);
assert.equal(bv[0].count-av[0].count,ids.length);assert.equal(bv[0].bytes-av[0].bytes,ids.reduce((n,id)=>n+bm.get('UNIT:'+id).size,0));
// ORLS is the ordered native command-registration list. Original005b2e70
// registers kind5244524f; preserve its kind, order and every other member.
async function orderRegistrations(s){let result;for await(const c of checkpointChunks(s))if(c.tag==='ORLS'){
 assert.equal(result,undefined);assert.equal(c.version,1);assert.ok(c.count<=4096);assert.equal(c.size,(c.count+1)*4);
 const words=[];for(let at=0;at<c.size;at+=4096){const b=await s.readAt(c.offset+16+at,Math.min(4096,c.size-at)),v=new DataView(b.buffer,b.byteOffset,b.length);
  for(let i=0;i<b.length;i+=4)words.push(v.getUint32(i,true));}
 assert.equal(words.shift(),0x5244524f);assert.equal(new Set(words).size,words.length);result=words;
 }assert.ok(result);return result;}
const beforeRegistrations=await orderRegistrations(before),afterRegistrations=await orderRegistrations(after);
for(const id of beforeRegistrations)assert.ok(bm.has('UNIT:'+id));for(const id of afterRegistrations)assert.ok(am.has('UNIT:'+id));
assert.deepEqual(afterRegistrations,beforeRegistrations.filter(id=>!ids.includes(id)));
const unchangedRoots=s=>s.roots.filter(r=>!['VHCL','GPL ','CONT','ORDR','ORLS'].includes(r.tag));assert.deepEqual(unchangedRoots(bs),unchangedRoots(as));
const log=await readFile(m.log,'utf8');assert.ok(log.includes(`Halo session actor retired unit=${p.heroUnitId} agent=${p.agentId} children=${p.children.length} clock=${p.clock} phase=7 aliases-absent=1 roster-empty=1 other-registry-preserved=1 other-queues-preserved=1 original-removal=1 owner-published=0 result=pass`));
assert.ok(log.includes(`Halo session retired checkpoint clock=${p.clock} phase=7 original-writer=1 source-journal-unchanged=1 owner-published=0 result=pass`));
const sourceSha256={...crossing.sourceSha256,...p.sourceSha256};for(const n of ['scripts/inspect-native-halo-session-retirement.mjs','scripts/lib/connected-residency.mjs','web/world/order-unit-bindings.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeRunningSourceRetirementQualified:true,nativeSelectedHeroCoreCrossingQualified:true,completeHeldWorldQualified:true,
 manifest:resolve(trialName),manifestSha256:await hash(trialName),sourceSha256,crossing,retirementPreparation:request.preparation,
 beforeWorld:p.held,retiredWorld:retired,removedRecords:removed,unrelatedRecordComparisons,sourceClock:p.clock,
 originalRemovalQualified:true,guildOnlyExpectedRosterChanges:true,remainingQueuesExact:true,noIncomingTypedReferences:true,
 terrainAndOtherWorldRootsExact:true,remainingOrderRegistrationsExact:true,rngPreserved:true,actualJournalUnchanged:true,nativeSessionTerminal:true,nativeExitCode:0,
 sourceRetired:true,destinationActivated:false,ownerPublished:false,browserUsed:false,goalComplete:false};
return report;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const[trialName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
 assert.match(outName,/^output\/native-halo-session-retirement-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
 const report=await inspectNativeHaloSessionRetirement(trialName);await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({nativeRunningSourceRetirementQualified:true,removedRecords:report.removedRecords.length,unrelatedRecordComparisons:report.unrelatedRecordComparisons,ownerPublished:false}));
}
