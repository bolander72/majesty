// A remote guild goal remains global. Give the original movement engine only
// the next physical leg, then use the accepted crossing for normal handoff.
import {haloRegionLayout,HALO_CORE_CELLS} from './halo-region-layout.mjs';
import {actorRegionCoordinates} from './actor-coordinates.mjs';
import {checkpointActorRecords,checkpointAgentValues,checkpointPlacements} from './checkpoint.mjs';
import {verifyRegisteredHeroSnapshot,registeredHeroHome} from './entity-home-ownership.mjs';
const Q=2048,CORE=HALO_CORE_CELLS*32;
export function planHaloHomeLeg(position,goal,region,homeRegion){
  const from=haloRegionLayout(region),home=haloRegionLayout(homeRegion);
  if(region===homeRegion)throw Error('Home region needs original local navigation');
  if(!goal||![goal.x,goal.y].every(n=>Number.isInteger(n)&&n>=-0x80000000&&n<=0x7fffffff))throw Error('Invalid signed home goal');
  const pose=actorRegionCoordinates(position,from.native,from.native),globalGoal={x:from.native.originX+goal.x,y:from.native.originY+goal.y};
  if(Math.floor(pose.globalFixed.x/(CORE*Q))!==from.core.originX/CORE||Math.floor(pose.globalFixed.y/(CORE*Q))!==from.core.originY/CORE)
    throw Error('Hero pose differs from regional owner');
  // Do not turn an arbitrary foreign point into a request for this guild.
  if(globalGoal.x<home.core.originX||globalGoal.x>=home.core.originX+CORE||globalGoal.y<home.core.originY||globalGoal.y>=home.core.originY+CORE)
    throw Error('Global home goal differs from registered home region');
  const dx=Math.sign(home.core.originX-from.core.originX),dy=Math.sign(home.core.originY-from.core.originY);
  const step=dx?{x:dx,y:0}:{x:0,y:dy},direction=dx?(dx<0?'west':'east'):(dy<0?'north':'south');
  const movementPoint={x:dx?(dx<0?32:4064):pose.world.x,y:dx?pose.world.y:(dy<0?32:4064)};
  return {version:1,layout:'halo-v1',region,homeRegion,nextRegion:`${from.core.originX/CORE+step.x}_${from.core.originY/CORE+step.y}`,
    direction,globalGoal,movementPoint,originalMovementRequired:true,acceptedCrossingRequired:true,ownerPublished:false};
}
export async function checkpointHaloHomeLeg(source,{identity,alias,homeAlias,region}){
  const registered=registeredHeroHome(identity),homeRegion=registered.record.home.region;
  if(region===homeRegion)return null;
  await verifyRegisteredHeroSnapshot(identity,alias,homeAlias,source,true,region);
  const actor=await checkpointActorRecords(source,alias.unitId);
  if(actor.unit.agentId!==alias.agentId||actor.agent.unitId!==alias.unitId||actor.unit.parentUnitId||actor.unit.stateFlags&4)
    throw Error('Remote home leg requires a live outdoor hero');
  for(const key of ['family','description','playerNumber'])if(actor.unit[key]!==identity.actor[key])throw Error('Remote home hero identity differs');
  const fields=new Map();
  for await(const v of checkpointAgentValues(source,alias.agentId))if(!v.path.length&&['home','target','taskname','activescript','destination'].includes(v.attribute.toLowerCase())){
    const key=v.attribute.toLowerCase();if(fields.has(key))throw Error('Duplicate home leg attribute');fields.set(key,v);
  }
  const get=(name,type)=>{const v=fields.get(name);if(!v||v.type!==type)throw Error('Invalid home leg '+name);return v;};
  const task=get('taskname',3);if(task.stringBytes>64)throw Error('Home leg task name exceeds bound');
  const bytes=await source.readAt(task.offset,task.stringBytes+1);
  if(bytes.length!==task.stringBytes+1||bytes.at(-1)!==0)throw Error('Truncated home leg task');
  if(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,-1))!=='go_home')return null;
  if(get('home',5).targetAgentId!==homeAlias.agentId||get('target',5).targetAgentId!==homeAlias.agentId)throw Error('Home leg targets another guild');
  const active=get('activescript',8);
  if(active.flag||active.functions.length!==1||active.functions[0].slot!==0||active.functions[0].name!=='travel_to')throw Error('Unsupported home leg continuation');
  let position;
  for await(const p of checkpointPlacements(source))if(p.unitId===alias.unitId){if(position||p.requiresParentPosition)throw Error('Ambiguous home leg pose');position=p.fixedPosition;}
  if(!position)throw Error('Missing home leg pose');
  const words=get('destination',7).words;
  return {...planHaloHomeLeg(position,{x:words[0]|0,y:words[1]|0},region,homeRegion),alias:structuredClone(alias),homeAlias:structuredClone(homeAlias),taskPreserved:true};
}
