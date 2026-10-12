#!/usr/bin/env node
// Bounded original-writer capsule for the evolved NPC's return. Own IDs, clocks,
// paths and terrain admission remain pending original-engine runtime operations.
import {readFile,writeFile,lstat,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {workspace,stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {checkpointActorRecords,checkpointUnits,checkpointAttachments,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointOrderUnitReferencePlan} from '../web/world/order-unit-bindings.mjs';
import {checkpointOrderDispatchClockPlan} from '../web/world/order-dispatch-clock.mjs';
import {checkpointActorOrderStorageRequests} from '../web/world/order-reservations.mjs';
import {actorRegionCoordinates,actorRegionGridCells} from '../web/world/actor-coordinates.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {sampleNativeGroundHeight} from '../web/world/terrain-ground.mjs';
const run=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
export const MAX_RETURN_RECORD_BYTES=4096,MAX_RETURN_PLAN_BYTES=32768;
const CODE_SOURCES=['scripts/prepare-native-entity-return.mjs','scripts/export-native-entity-revision.mjs','scripts/lib/stopped-entity-io.mjs',
  'web/world/actor-coordinates.mjs','web/world/order-unit-bindings.mjs','web/world/order-dispatch-clock.mjs','web/world/checkpoint.mjs',
  'web/world/terrain-ground.mjs','web/world/terrain.mjs','web/world/native-height.mjs','web/world/order-entries.mjs',
  'web/world/order-reservations.mjs','web/world/order-restore-bounds.mjs','web/world/order-read-bounds.mjs',
  'web/world/entity-revisions.mjs','web/world/entity-ownership.mjs','web/world/transfer-store.mjs','web/world/checkpoint-lease.mjs'];
async function jsonFile(filename,maximum=65536) {
  const source=await stoppedFileSource(filename);if(source.size>maximum)throw Error('Return metadata exceeds bound');
  const bytes=new Uint8Array(source.size);for(let at=0;at<source.size;at+=4096)bytes.set(await source.readAt(at,Math.min(4096,source.size-at)),at);
  return {value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),sha256:sha(bytes)};
}
export async function prepareEntityReturn(receiptName,captureName,{requireCurrent=true}={}) {
  if(typeof requireCurrent!=='boolean')throw Error('Invalid return receipt verification mode');
  const r=(await jsonFile(receiptName,8192)).value,proof=await jsonFile(captureName),c=proof.value;
  if(r.state.ownerSide!==1||r.state.revision!==3||r.identity.regions.join(',')!=='0_0,1_0'||
      c.originalEvolvedFullSaveQualified!==true||c.unitId!==510||c.agentId!==79)throw Error('Require the current evolved NPC return fixture');
  const {stdout}=await run(process.execPath,[join(workspace,'scripts/check-native-npc-evolved.mjs'),c.sourceManifest,'--stdout'],{cwd:workspace,maxBuffer:2*1024*1024});
  assert.deepEqual(JSON.parse(stdout),c);
  const selected=[];for(let side=0;side<2;++side)selected.push(await verifyRevisionExport(receiptName,side,r.worlds[side].sha256,{requireCurrent}));
  if(selected[1].sha256!==c.after.sha256||selected[1].bytes!==c.after.size)throw Error('Return capsule would use stale gameplay');
  if(c.fixture.nativeSessionTerminal!==true||c.fixture.nativeExitCode!==0||!Number.isInteger(c.fixture.nativePid)||c.fixture.nativePid<=0)throw Error('Require a terminal native source');
  try{process.kill(c.fixture.nativePid,0);throw Error('Native source is still running');}catch(e){if(e.code!=='ESRCH')throw e;}
  let largestRead=0,reads=0,activeReads=0,peakReads=0;
  const sources=[];for(const w of selected){const file=await stoppedFileSource(w.filename);sources.push({size:file.size,async readAt(at,n){
    if(n>4096)throw Error('Unbounded return read');largestRead=Math.max(largestRead,n);++reads;peakReads=Math.max(peakReads,++activeReads);
    try{return await file.readAt(at,n);}finally{--activeReads;}
  }});}
  const destination=sources[0],source=sources[1],{unit,agent}=await checkpointActorRecords(source,c.unitId);
  if(unit.parentUnitId||unit.stateFlags&4||unit.family!=='VHCL'||unit.playerNumber!==7)throw Error('Unsupported return actor');
  const terrainFrom=await checkpointTerrain(source),terrainTo=await checkpointTerrain(destination);
  if(terrainFrom.width!==128||terrainFrom.height!==128||terrainTo.width!==256||terrainTo.height!==256)throw Error('Return fixture terrain geometry changed');
  // Same explicit origins as the forward fixture. These two mission terrains
  // have not been proven adjacent parts of one generated world.
  const from={originX:4096,originY:0,widthCells:128,heightCells:128},to={originX:0,originY:0,widthCells:256,heightCells:256};
  const position=actorRegionCoordinates(c.after.actor.position,from,to),groundQ16=await sampleNativeGroundHeight(terrainTo,position.fixed);
  let native,orders;
  for await(const u of checkpointUnits(source))if(u.primary.words[1]===c.unitId)native=u;
  for await(const o of checkpointAttachments(source))if(o.kind==='ORDR'&&o.unitId===c.unitId){if(orders)throw Error('Duplicate return order writer');orders=o;}
  if(!native||!orders)throw Error('Missing return writer');
  const ranges={Unit:{offset:unit.offset,size:unit.size},GPL:{offset:agent.offset,size:agent.size},Orders:{offset:orders.primary.offset+16,size:orders.primary.size}},records={},planEdits=[];
  for(const [kind,range] of Object.entries(ranges)) {
    if(range.size<1||range.size>MAX_RETURN_RECORD_BYTES)throw Error('Return writer exceeds bound');
    const bytes=await source.readAt(range.offset,range.size);
    assert.equal(sha(bytes),c.after.records[kind].sha256);assert.equal(range.size,c.after.records[kind].size);
    records[kind]=bytes;
  }
  const word=(kind,at)=>new DataView(records[kind].buffer,records[kind].byteOffset,records[kind].length).getUint32(at,true);
  function edit(kind,absolute,before,after,reason) {
    const offset=absolute-ranges[kind].offset;
    if(!Number.isInteger(offset)||offset<0||offset+4>records[kind].length||word(kind,offset)!==(before>>>0))throw Error('Return edit precondition differs');
    if(planEdits.some(e=>e.record===kind&&e.offset===offset))throw Error('Overlapping return edit');
    planEdits.push({record:kind,offset,before:before>>>0,after,reason});
  }
  const primary=native.components.find(p=>p.tag==='PRIM'),base=primary.offset+16;
  edit('Unit',base+4,unit.unitId,'fresh-unit-id','original native ID reservation');
  for(let axis=0;axis<3;++axis){const k=['x','y','z'][axis],after=axis===2?groundQ16:position.fixed[k];edit('Unit',base+28+axis*4,c.after.actor.position[k],after>>>0,'grounded position '+k);}
  const originalCells={x:word('Unit',base+40-ranges.Unit.offset)|0,y:word('Unit',base+44-ranges.Unit.offset)|0},cells=actorRegionGridCells(originalCells,from,to);
  edit('Unit',base+40,originalCells.x,cells.x,'physical cell x');edit('Unit',base+44,originalCells.y,cells.y,'physical cell y');
  let at=base+60+(word('Unit',base+48-ranges.Unit.offset)?16:0),eaSites=0;
  if(word('Unit',at-ranges.Unit.offset)!==1)throw Error('Unsupported return attribute map');
  const count=word('Unit',at+4-ranges.Unit.offset);at+=8;
  if(count>128||at+count*8>primary.end)throw Error('Return native attribute budget');
  for(let i=0;i<count;++i,at+=8)if(word('Unit',at-ranges.Unit.offset)===0x4541){edit('Unit',at+4,unit.agentId,'fresh-agent-id','EA association');++eaSites;}
  if(eaSites!==1)throw Error('Missing unique return EA');
  const nativeBindings=new Map(),scriptBindings=new Map();
  for(const binding of r.state.referenceBindings){nativeBindings.set(binding.destination.unitId,binding.source.unitId);scriptBindings.set(binding.destination.agentId,binding.source.agentId);}
  let values=0;const contexts=[],coordinatePairs=[];
  for await(const v of checkpointAgentValues(source,unit.agentId)) {
    if(++values>256)throw Error('Return GPL value budget');
    if(v.type===5&&v.targetAgentId!==null) {
      const after=v.bits===unit.agentId?'fresh-agent-id':scriptBindings.get(v.bits);
      if(after===undefined)throw Error('Unresolved return GPL binding');edit('GPL',v.offset,v.bits,after,'typed agent reference '+v.attribute);
    } else if(v.type===7) {
      if(v.path.length||!['destination','Coord_Home'].includes(v.attribute))throw Error('Unclassified return coordinate pair');
      if(v.attribute==='Coord_Home') {if(v.words.some(n=>n!==0))throw Error('Unmapped return home coordinates');coordinatePairs.push({attribute:v.attribute,policy:'preserve-zero-home-sentinel'});continue;}
      const p=actorRegionCoordinates({x:(v.words[0]|0)*2048,y:(v.words[1]|0)*2048,z:0},from,to);
      for(let axis=0;axis<2;++axis)edit('GPL',v.offset+axis*4,v.words[axis],p.world[['x','y'][axis]],'destination world coordinate');
      coordinatePairs.push({attribute:v.attribute,before:v.words.map(n=>n|0),after:[p.world.x,p.world.y]});
    } else if(v.type===8) {
      if(contexts.length>=16||v.flag)throw Error('Running or excessive return function contexts');
      const raw=await source.readAt(v.stateOffset,16),view=new DataView(raw.buffer,raw.byteOffset,16),state=Array.from({length:4},(_,i)=>view.getUint32(i*4,true));
      const [delay,stamp,flags]=state,active=Boolean(flags&0x7f),paused=Boolean(flags&0x80),elapsed=(c.clock-stamp)>>>0;
      if(flags&0xffffff7c||active&&!paused&&(!stamp||delay>0x7fffffff||elapsed>0x7fffffff))throw Error('Unsupported return context clock');
      if(active&&!paused)edit('GPL',v.stateOffset+4,stamp,{destinationClockMinusElapsed:elapsed,rejectZero:true},'live destination clock rebasing');
      contexts.push({attribute:v.attribute,path:v.path,state,active,paused,functions:v.functions.map(({name,slot})=>({name,slot}))});
    }
  }
  edit('GPL',agent.offset+agent.size-24-new TextEncoder().encode(agent.name).length,unit.agentId,'fresh-agent-id','script own identity');
  edit('GPL',agent.offset+agent.size-19,unit.unitId,'fresh-unit-id','script native association');
  const refs=await checkpointOrderUnitReferencePlan(source,unit.unitId,id=>id===unit.unitId?unit.unitId:nativeBindings.get(id));
  for(const ref of refs.patches)edit('Orders',ref.offset,ref.before,ref.before===unit.unitId?'fresh-unit-id':ref.after,'typed command target');
  const clocks=await checkpointOrderDispatchClockPlan(source,unit.unitId,{sourceClockMs:c.clock,destinationClockMs:c.clock});
  for(const h of clocks.headers)edit('Orders',h.offset,h.when,{destinationClockMinusElapsed:h.elapsed,rejectZero:false},'common command dispatch age');
  const entries=[],navigation=[];
  for await(const row of checkpointActorOrderEntries(source,unit.unitId))if(row.type==='entry') {
    if(entries.length>=16||![2,4,6].includes(row.kind))throw Error('Unsupported return command profile');
    entries.push({bank:row.bank,index:row.index,kind:row.kind,offset:row.offset-ranges.Orders.offset});
    if(row.kind===4) {
      const projected=actorRegionCoordinates({x:(row.words[26]|0)*2048,y:(row.words[27]|0)*2048,z:0},from,to);
      edit('Orders',row.offset+104,row.words[26],projected.world.x,'path goal x');edit('Orders',row.offset+108,row.words[27],projected.world.y,'path goal y');
      navigation.push({bank:row.bank,index:row.index,kind:4,cursor:row.words[30]|0,count:row.waypointCount,capacity:row.words[32],
        policy:'discard-source-route-and-run-original-destination-Path',pathOffset:row.pathOffset-ranges.Orders.offset,pathBytes:row.waypointCount*8});
    } else if(row.kind===2) {
      const goal=actorRegionCoordinates({x:row.words[26]|0,y:row.words[27]|0,z:row.words[28]|0},from,to);
      navigation.push({bank:row.bank,index:row.index,kind:2,goalBefore:{x:row.words[26]|0,y:row.words[27]|0,z:row.words[28]|0},
        goalAfter:{x:goal.fixed.x,y:goal.fixed.y,z:await sampleNativeGroundHeight(terrainTo,goal.fixed)},
        policy:'original-in-flight-Move-coordinate-setter-and-path-link-restoration'});
    }
  }
  const allocations=await checkpointActorOrderStorageRequests(source,unit.unitId);
  const plan={version:1,entityId:r.identity.entityId,revision:r.state.revision,manifest:r.manifest,receipt:resolve(receiptName),receiptSha256:selected[0].receiptSha256,
    captureReport:resolve(captureName),captureReportSha256:proof.sha256,sourceClock:c.clock,sourceSide:1,destinationSide:0,
    sourceAlias:r.state.aliases[1],retiredDestinationAlias:r.state.aliases[0],sourceWorld:selected[1].sha256,destinationWorld:selected[0].sha256,
    geometry:{from,to,explicitFixtureOriginsOnly:true},position:{before:c.after.actor.position,after:{...position.fixed,z:groundQ16},physicalCells:cells},
    records:Object.fromEntries(Object.entries(records).map(([name,b])=>[name,{size:b.length,sha256:sha(b)}])),edits:planEdits,
    contexts,coordinatePairs,entries,navigation,sourceOrderAllocations:allocations,
    pending:['Reserve original destination IDs beyond retired IDs and live counters; revalidate every pending field before applying.',
      'Resolve original script functions/descriptions and capture destination clock at the stopped insertion boundary.',
      'Use original class collision/ground checks, discard source routes and construct destination paths and Move links.',
      'Restore and schedule privately before original publication; remove outgoing actor and commit both worlds together.'],
    nativeIdsReserved:false,patchesApplied:false,nativeReturnQualified:false,completeReferenceClosureQualified:false,terrainAdjacencyQualified:false,wholeBrowserMemoryBoundQualified:false};
  const planBytes=Buffer.from(JSON.stringify(plan)+'\n');if(planBytes.length>MAX_RETURN_PLAN_BYTES)throw Error('Return plan exceeds bound');
  // Recheck the selection after all preparation; files remain untouched.
  for(let side=0;side<2;++side)await verifyRevisionExport(receiptName,side,r.worlds[side].sha256,{requireCurrent});
  return {plan,planBytes,records,io:{largestRead,peakReads,reads}};
}
export async function verifyReturnCapsule(reportName,{requireCurrent=true}={}) {
  const r=(await jsonFile(reportName)).value;
  if(r.qualified!==true||r.nativeReturnQualified!==false||r.nativeProcessesStarted!==0||r.browserUsed!==false||r.nativeBuildPerformed!==false)
    throw Error('Invalid return capsule qualification');
  const directory=await ownedDirectory(r.directory,'actor-arrival-fixture-entity-return-');
  const p=await prepareEntityReturn(r.plan.receipt,r.plan.captureReport,{requireCurrent});
  assert.deepEqual(r.plan,p.plan);assert.equal(r.planBytes,p.planBytes.length);assert.equal(r.planSha256,sha(p.planBytes));assert.deepEqual(r.io,p.io);
  assert.deepEqual(Object.keys(r.sourceSha256).sort(),[...CODE_SOURCES].sort());
  for(const name of CODE_SOURCES) {
    const current=sha(await readFile(join(workspace,name)));
    // Preserve independently reconstructable version1 stopped evidence from
    // before receipt-history support. Fresh preparation/launch always requires
    // current code and a current receipt. This hash was measured before editing.
    if(!requireCurrent&&name==='scripts/prepare-native-entity-return.mjs'&&
      r.sourceSha256[name]==='fd79d3fd2cdce38a09ed81e274c25b1bd06f1a09f265bca1ed7e46026c5dc39c')continue;
    assert.equal(r.sourceSha256[name],current);
  }
  const planSource=await stoppedFileSource(join(directory,'Return_Plan.json'));
  if(planSource.size>MAX_RETURN_PLAN_BYTES||planSource.size!==p.planBytes.length)throw Error('Invalid stored return plan size');
  const stored=new Uint8Array(planSource.size);for(let at=0;at<stored.length;at+=4096)stored.set(await planSource.readAt(at,Math.min(4096,stored.length-at)),at);
  assert.deepEqual(stored,new Uint8Array(p.planBytes));
  for(const [name,bytes] of Object.entries(p.records)) {
    const source=await stoppedFileSource(join(directory,name+'.bin'));
    if(source.size!==bytes.length||source.size>MAX_RETURN_RECORD_BYTES)throw Error('Invalid stored return writer extent');
    assert.deepEqual(await source.readAt(0,source.size),bytes);
  }
  return {qualified:true,revision:r.plan.revision,entityId:r.plan.entityId,planSha256:r.planSha256,nativeReturnQualified:false};
}
async function main() {
  if(['--verify','--verify-historical'].includes(process.argv[2])) {
    if(process.argv.length!==4)throw Error('Usage: --verify <return report>');
    console.log(JSON.stringify(await verifyReturnCapsule(process.argv[3],{requireCurrent:process.argv[2]==='--verify'})));return;
  }
  const [receipt,capture,basename]=process.argv.slice(2);
  if(!receipt||!capture||!basename||process.argv.length!==5||!/^[a-z][a-z0-9-]*$/.test(basename))throw Error('Usage: <current revision receipt> <evolved capture proof> <fresh output basename>');
  const output=join(workspace,'output',basename+'.json');try{await lstat(output);throw Error('Preserve previous return preparation');}catch(e){if(e.code!=='ENOENT')throw e;}
  const p=await prepareEntityReturn(receipt,capture),directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-return-'));
  for(const [name,bytes] of Object.entries(p.records))await writeFile(join(directory,name+'.bin'),bytes,{flag:'wx'});
  await writeFile(join(directory,'Return_Plan.json'),p.planBytes,{flag:'wx'});
  const result={qualified:true,scope:'Read-only bounded current NPC return capsule, typed relocations and destination terrain samples. No allocation, edits, native return or ownership change.',
    directory,plan:p.plan,planSha256:sha(p.planBytes),planBytes:p.planBytes.length,io:p.io,
    nativeProcessesStarted:0,browserUsed:false,nativeBuildPerformed:false,nativeReturnQualified:false,sourceSha256:{}};
  for(const name of CODE_SOURCES)result.sourceSha256[name]=sha(await readFile(join(workspace,name)));
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,revision:p.plan.revision,records:p.plan.records,edits:p.plan.edits.length,largestRead:p.io.largestRead,nativeReturnQualified:false}));
}
if(resolve(process.argv[1]||'')===resolve(new URL(import.meta.url).pathname))await main();
