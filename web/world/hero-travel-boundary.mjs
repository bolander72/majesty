// A crossing is only a request until the paused original checkpoint confirms
// its actor and position. This module never moves, retires or imports a unit.
import {parseHeroRuntimeBinding} from './hero-runtime-binding.mjs';
import {planHaloActorHandoff} from './halo-region-layout.mjs';
import {requireCheckpointHaloLayout} from './halo-checkpoint-layout.mjs';
import {checkpointActorRecords,checkpointPlacements} from './checkpoint.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';

const keys=(o,list)=>o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).sort().join(',')===[...list].sort().join(',');
const uint=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;
function pose(value){
  if(!keys(value,['x','y','z'])||!Object.values(value).every(n=>Number.isInteger(n)&&n>=-0x80000000&&n<=0x7fffffff))
    throw Error('Invalid native hero crossing position');
  return Object.freeze({x:value.x,y:value.y,z:value.z});
}
// Copy scalars before any await; a caller cannot change an accepted position
// while storage or the game's held save is being checked.
export function copyNativeHeroCrossing(value){
  if(!keys(value,['serial','region','target','previousClock','clock','unitId','agentId','previous','accepted'])||
      ![value.serial,value.previousClock,value.clock,value.unitId,value.agentId].every(uint)||
      !value.serial||!value.unitId||!value.agentId||value.agentId>0x7fffffff||value.clock<=value.previousClock)
    throw Error('Invalid native hero crossing boundary');
  const previous=pose(value.previous),accepted=pose(value.accepted);
  const plan=planHaloActorHandoff(previous,accepted,value.region);
  if(!plan||plan.destinationRegion!==value.target)throw Error('Native hero crossing differs from its cardinal destination');
  return Object.freeze({serial:value.serial,region:value.region,target:value.target,previousClock:value.previousClock,
    clock:value.clock,unitId:value.unitId,agentId:value.agentId,previous,accepted});
}
export function boundNativeHeroCrossing(runtimeBinding,value){
  const binding=parseHeroRuntimeBinding(runtimeBinding),crossing=copyNativeHeroCrossing(value);
  if(crossing.region!==binding.region||crossing.unitId!==binding.unitId||crossing.agentId!==binding.agentId||
      crossing.previousClock<binding.clock)throw Error('Native hero crossing differs from its prepared owner');
  return crossing;
}
export async function requireCheckpointHeroCrossing(source,runtimeBinding,value,{signal}={}){
  const binding=parseHeroRuntimeBinding(runtimeBinding),crossing=boundNativeHeroCrossing(runtimeBinding,value);
  checkCheckpointReadSignal(signal);
  const backing=source;
  source={size:backing?.size,async readAt(at,n){
    checkCheckpointReadSignal(signal);const bytes=await backing.readAt(at,n);checkCheckpointReadSignal(signal);return bytes;
  }};
  const clock=await checkpointSavedClock(source);checkCheckpointReadSignal(signal);
  if(clock!==crossing.clock)throw Error('Native hero crossing checkpoint differs from its accepted tick');
  const actor=await checkpointActorRecords(source,binding.unitId);checkCheckpointReadSignal(signal);
  if(actor.unit.family!=='VHCL'||actor.unit.agentId!==binding.agentId||actor.unit.description!==binding.description||
      actor.unit.playerNumber!==binding.playerNumber||actor.unit.parentUnitId||actor.unit.stateFlags&4)
    throw Error('Native hero crossing requires its living outdoor saved actor');
  let placement;
  for await(const unit of checkpointPlacements(source)){
    checkCheckpointReadSignal(signal);
    if(unit.unitId!==binding.unitId)continue;
    if(placement)throw Error('Duplicate native hero crossing placement');
    placement=unit;
  }
  if(!placement||['x','y','z'].some(k=>placement.fixedPosition[k]!==crossing.accepted[k]))
    throw Error('Native hero crossing checkpoint differs from its accepted position');
  const layout=await requireCheckpointHaloLayout(source,binding.region,'halo-v1',{signal});
  checkCheckpointReadSignal(signal);
  const plan=planHaloActorHandoff(crossing.previous,crossing.accepted,crossing.region);
  // Retain bounded geometry, never a reader, checkpoint bytes or native graph.
  for(const v of Object.values(plan))if(v&&typeof v==='object')Object.freeze(v);
  return Object.freeze({crossing,layout,handoff:Object.freeze(plan),checkpointClock:clock,savedActorPositionVerified:true});
}
