// Read-only typed crossing compiler for the supported NPC command profile.
// Original identities/clocks/navigation/placement are pending engine operations.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkpointActorRecords,checkpointUnits,checkpointAttachments,checkpointAgentValues} from '../../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../../web/world/order-entries.mjs';
import {checkpointOrderUnitReferencePlan} from '../../web/world/order-unit-bindings.mjs';
import {checkpointOrderDispatchClockPlan} from '../../web/world/order-dispatch-clock.mjs';
import {checkpointActorOrderStorageRequests} from '../../web/world/order-reservations.mjs';
import {actorRegionCoordinates,actorRegionGridCells} from '../../web/world/actor-coordinates.mjs';
import {checkpointTerrain} from '../../web/world/terrain.mjs';
import {sampleNativeGroundHeight} from '../../web/world/terrain-ground.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const MAX_CROSSING_RECORD_BYTES=4096;
export async function compileNativeCrossing(r,sources,snapshot,clock,geometry) {
  const sourceSide=r.state.ownerSide,alias=r.state.aliases[sourceSide];
  if(![0,1].includes(sourceSide)||!Number.isInteger(clock)||clock<0||clock>0xffffffff||sources.length!==2||geometry.length!==2)
    throw Error('Invalid typed crossing input');
  assert.deepEqual([snapshot.actor.unitId,snapshot.actor.agentId],[alias.unitId,alias.agentId]);
  const c={unitId:alias.unitId,agentId:alias.agentId,clock,after:snapshot};
  const destination=sources[1-sourceSide],source=sources[sourceSide],{unit,agent}=await checkpointActorRecords(source,c.unitId);
  if(unit.parentUnitId||unit.stateFlags&4||unit.family!=='VHCL'||unit.playerNumber!==7)throw Error('Unsupported return actor');
  const terrainFrom=await checkpointTerrain(source),terrainTo=await checkpointTerrain(destination);
  const from=geometry[sourceSide],to=geometry[1-sourceSide];
  if(terrainFrom.width!==from.widthCells||terrainFrom.height!==from.heightCells||terrainTo.width!==to.widthCells||terrainTo.height!==to.heightCells)
    throw Error('Crossing fixture terrain geometry changed');
  const position=actorRegionCoordinates(c.after.actor.position,from,to),groundQ16=await sampleNativeGroundHeight(terrainTo,position.fixed);
  let native,orders;
  for await(const u of checkpointUnits(source))if(u.primary.words[1]===c.unitId)native=u;
  for await(const o of checkpointAttachments(source))if(o.kind==='ORDR'&&o.unitId===c.unitId){if(orders)throw Error('Duplicate return order writer');orders=o;}
  if(!native||!orders)throw Error('Missing return writer');
  const ranges={Unit:{offset:unit.offset,size:unit.size},GPL:{offset:agent.offset,size:agent.size},Orders:{offset:orders.primary.offset+16,size:orders.primary.size}},records={},planEdits=[];
  for(const [kind,range] of Object.entries(ranges)) {
    if(range.size<1||range.size>MAX_CROSSING_RECORD_BYTES)throw Error('Return writer exceeds bound');
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
  for(const binding of r.state.referenceBindings){const a=sourceSide?binding.destination:binding.source,b=sourceSide?binding.source:binding.destination;nativeBindings.set(a.unitId,b.unitId);scriptBindings.set(a.agentId,b.agentId);}
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
  return {records,edits:planEdits,contexts,coordinatePairs,entries,navigation,sourceOrderAllocations:allocations,
    geometry:{from,to,explicitFixtureOriginsOnly:true},
    position:{before:snapshot.actor.position,after:{...position.fixed,z:groundQ16},physicalCells:cells}};
}
