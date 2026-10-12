#!/usr/bin/env node
// Bind original receiving-world saves to the actual selected outdoor source.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {inspectNativeOutdoorFamilyHomeRoute} from './inspect-native-outdoor-family-home-route.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,checkpointAgentQueues,
  checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function rows(source,iterator,key){const out=new Map();for await(const r of iterator(source)){
  const id=key(r);assert(!out.has(id));out.set(id,r);}return out;}
async function bytes(source,r){assert(r.size<=65536);const b=Buffer.alloc(r.size);
  for(let at=0;at<r.size;at+=4096)b.set(await source.readAt(r.offset+at,Math.min(4096,r.size-at)),at);return b;}
async function exactOthers(a,b,iterator,key,omit=new Set()){
  const before=await rows(a,iterator,key),after=await rows(b,iterator,key);let count=0;
  for(const [id,r]of before){if(omit.has(id))continue;assert(after.has(id));
    assert.deepEqual(await bytes(a,r),await bytes(b,after.get(id)));count++;}return count;
}
export async function inspectNativeOutdoorFamilySnapshots(name){
  const route=await inspectNativeOutdoorFamilyHomeRoute(name,{snapshots:true}),m=await json(name),prep=await json(m.preparation);
  assert.equal(await hash(m.selectedReceipt),m.selectedReceiptSha256);
  assert.equal(m.selectedRevisionExports.length,2);
  const exports=[];for(let side=0;side<2;side++){
    const r=await verifyRevisionExport(m.selectedReceipt,side,side?prep.destination.sha256:prep.source.sha256);
    assert.deepEqual(r,m.selectedRevisionExports[side]);assert.equal(r.revision,3);
    assert.deepEqual([r.owner.region,r.owner.unitId,r.owner.agentId],['0_0',504,28]);exports.push(r);
  }
  assert.equal(m.sourceSha256,exports[1].sha256);
  const worlds={},saved={};assert.equal(m.saves.length,4);
  for(const r of m.saves){
    assert.equal(r.filename,join(m.profile,'Documents/My Games/MajestyHD/SaveGame',basename(r.filename)));
    const phase=basename(r.filename).match(/^Family_Remote_(Source|Ready|Held|Departed)\.GMP$/)?.[1];assert(phase&&!worlds[phase]);
    const actual=await hashNativeFile(r.filename);assert.equal(actual.sha256,r.sha256);assert.equal(actual.bytes,r.bytes);
    worlds[phase]=await stoppedFileSource(r.filename);saved[phase]=r;
  }
  const initial=await stoppedFileSource(m.source);
  assert.equal(await checkpointSavedClock(initial),24250);
  for(const phase of ['Source','Ready'])assert.equal(await checkpointSavedClock(worlds[phase]),24250);
  const heldClock=await checkpointSavedClock(worlds.Held);assert.equal(heldClock,route.homeRequest.requestClockMs+route.heldWorldElapsedMs);
  assert.equal(await checkpointSavedClock(worlds.Departed),heldClock);
  const sourceExactUnits=await exactOthers(initial,worlds.Source,checkpointUnitAgentLinks,r=>r.unitId);
  const sourceExactAgents=await exactOthers(initial,worlds.Source,checkpointAgents,r=>r.agentId);
  const sourceExactAttachments=await exactOthers(initial,worlds.Source,checkpointAttachments,r=>`${r.kind}:${r.unitId}`);
  const units={},agents={};for(const [phase,source]of Object.entries(worlds)){
    units[phase]=await rows(source,checkpointUnitAgentLinks,r=>r.unitId);
    agents[phase]=await rows(source,checkpointAgents,r=>r.agentId);
  }
  const ids=[route.heroId,...route.effectIds],sourceIds=[504,527,528,529];
  for(const id of ids)assert(!units.Source.has(id));assert(!agents.Source.has(route.agentId));
  assert.equal(units.Ready.size,units.Source.size+4);assert.equal(agents.Ready.size,agents.Source.size+1);
  assert.equal(units.Held.size,units.Departed.size+4);assert.equal(agents.Held.size,agents.Departed.size+1);
  const originalUnitsPreserved=await exactOthers(worlds.Source,worlds.Ready,checkpointUnitAgentLinks,r=>r.unitId);
  const originalAgentsPreserved=await exactOthers(worlds.Source,worlds.Ready,checkpointAgents,r=>r.agentId);
  const record=async n=>readFile(join(m.profile,n));
  for(const phase of ['Ready','Held']){
    const source=worlds[phase],attachments=await rows(source,checkpointAttachments,r=>`${r.kind}:${r.unitId}`);
    for(let i=0;i<4;i++){
      assert(units[phase].has(ids[i]));assert.equal(units[phase].get(ids[i]).parentUnitId,i?ids[0]:0);
      assert.deepEqual(await bytes(source,units[phase].get(ids[i])),await record(`Family_Route_Before_${sourceIds[i]}.UNIT`));
      const a=attachments.get(`ORDR:${ids[i]}`);assert(a);assert(a.primary.size<=4096);
      assert.deepEqual(Buffer.from(await source.readAt(a.primary.offset+16,a.primary.size)),await record(`Family_Route_Before_${sourceIds[i]}_Orders.bin`));
    }
    assert.deepEqual(await bytes(source,agents[phase].get(route.agentId)),await record('Family_Route_Before_Agent.GPL'));
    assert.deepEqual(await bytes(source,agents[phase].get(45)),await record('Family_Route_Proxy_Proposal.GPL'));
    const container=attachments.get(`CONT:${ids[0]}`);assert(container);
    assert.deepEqual(Buffer.from(await source.readAt(container.primary.offset+16,container.primary.size)),await record('Family_Route_Before_Container.bin'));
    let queued=0;for await(const r of checkpointAgentQueues(source))if(r.type==='queued-agent'&&r.agentId===route.agentId)queued++;
    assert.equal(queued,1);
  }
  for(const id of ids)assert(!units.Departed.has(id));assert(!agents.Departed.has(route.agentId));
  for await(const q of checkpointAgentQueues(worlds.Departed))if(q.type==='queued-agent')assert.notEqual(q.agentId,route.agentId);
  for await(const c of checkpointContainerEntries(worlds.Departed))if(c.type==='member'){
    assert(!ids.includes(c.unitId));assert(!ids.includes(c.targetUnitId));}
  const otherRetiredUnitsExact=await exactOthers(worlds.Held,worlds.Departed,checkpointUnitAgentLinks,r=>r.unitId,new Set(ids));
  const otherRetiredAgentsExact=await exactOthers(worlds.Held,worlds.Departed,checkpointAgents,r=>r.agentId,new Set([route.agentId]));
  return {...route,version:1,remoteFullWorldSnapshotsQualified:true,selectedOutdoorSourceRevision:3,selectedReceipt:m.selectedReceipt,
    selectedReceiptSha256:m.selectedReceiptSha256,selectedRevisionExports:exports,worlds:saved,
    sourceExactUnits,sourceExactAgents,sourceExactAttachments,originalUnitsPreserved,originalAgentsPreserved,
    otherRetiredUnitsExact,otherRetiredAgentsExact,receivingReadyClockMs:24250,receivingHeldClockMs:heldClock,
    sourceSha256:{...route.sourceSha256,'scripts/inspect-native-outdoor-family-snapshots.mjs':await hash('scripts/inspect-native-outdoor-family-snapshots.mjs')},
    scope:'Four actual original receiving-world saves bind the selected revision3 outdoor source to the restored guarded family. Ready and held snapshots contain its complete native/script/order/container records and one queue entry. Original retirement removes all four aliases and its script while preserving other complete units/scripts. Full saved-family native reload, collision admission, script-clock migration, selected outgoing handoff and seamless crossing remain unqualified.',
    fullReceivingReloadQualified:false,selectedOwnerPublished:false,heroTransferred:false,browserUsed:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
  const r=await inspectNativeOutdoorFamilySnapshots(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({remoteFullWorldSnapshotsQualified:true,saves:4,heroId:r.heroId,agentId:r.agentId,
    sourceExactUnits:r.sourceExactUnits,otherRetiredUnitsExact:r.otherRetiredUnitsExact,selectedOwnerPublished:false,browserUsed:false}));
}
