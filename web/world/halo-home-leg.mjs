// Resolve one original-AI home request into a bounded local navigation goal.
// The native adapter must create and execute original movement, then observe
// a real core crossing before retirement or custody publication is permitted.
import {HeroRouteStore} from './hero-route-store.mjs';
import {registeredHeroHome} from './entity-home-ownership.mjs';
import {haloRegionLayout,planHaloActorHandoff} from './halo-region-layout.mjs';
import {checkpointActorRecords,checkpointAgentValues,checkpointAgentQueues,
  checkpointAttachments,checkpointPlacements} from './checkpoint.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';

const Q=2048,NAV=16,LOW=64,HIGH=4032;
// Choose one cardinal hop without retaining a route or opening intermediate
// saves. Replan after each actual handoff so a distant home costs one leg.
export function planHaloHomeLeg(position,sourceRegion,homeRegion){
  const from=haloRegionLayout(sourceRegion),home=haloRegionLayout(homeRegion);
  const pose={x:position?.x,y:position?.y,z:position?.z};
  if(![pose.x,pose.y,pose.z].every(n=>Number.isInteger(n)&&n>=-0x80000000&&n<=0x7fffffff)||
     ![pose.x,pose.y].every(n=>n>=LOW*Q&&n<HIGH*Q))throw Error('Home leg pose differs from selected halo core');
  if(sourceRegion===homeRegion)return null;
  const dx=home.core.originX-from.core.originX,dy=home.core.originY-from.core.originY;
  const axis=Math.abs(dx)>=Math.abs(dy)?'x':'y',negative=(axis==='x'?dx:dy)<0;
  const direction=axis==='x'?(negative?'west':'east'):(negative?'north':'south');
  const goal={x:pose.x,y:pose.y,z:pose.z};goal[axis]=(negative?LOW-NAV:HIGH+NAV)*Q;
  // This is a prospective goal, not evidence that movement has happened.
  // Reuse the production crossing geometry to check both footprint margins.
  const prospective=planHaloActorHandoff(pose,goal,sourceRegion);
  if(!prospective)throw Error('Home leg does not cross an ownership boundary');
  const to=haloRegionLayout(prospective.destinationRegion);
  const remaining=(Math.abs(dx)+Math.abs(dy))/(from.core.widthCells*32);
  const after=(Math.abs(home.core.originX-to.core.originX)+Math.abs(home.core.originY-to.core.originY))/(from.core.widthCells*32);
  if(after!==remaining-1)throw Error('Home leg does not approach registered home');
  return {version:1,layout:from.version,sourceRegion,homeRegion,destinationRegion:to.key,direction,
    sourcePose:pose,localGoal:{x:goal.x,y:goal.y},
    sourceNavigationGoal:{x:Math.floor(goal.x/(NAV*Q)),y:Math.floor(goal.y/(NAV*Q))},
    remainingRegionHops:remaining,requiresOriginalTerrainSample:true,requiresOriginalMovement:true,
    requiresAcceptedCrossingBeforeHandoff:true,collisionQualified:false,ownerPublished:false};
}

export function readSelectedHaloHomeLeg(store,input,{signal}={}){
  if(!(store instanceof HeroRouteStore))throw Error('Home leg requires a selected hero route store');
  // Capture the revision token before asynchronous reads.
  const expectedManifest=input?.expectedManifest;
  if(!input||Object.keys(input).join(',')!=='expectedManifest'||typeof expectedManifest!=='string'||
     !expectedManifest.length||expectedManifest.length>4096)throw Error('Invalid selected home leg request');
  const identity=store.identity,registered=registeredHeroHome(identity);
  return store.withOwner(async selected=>{
    if(selected.record.manifest!==expectedManifest)throw Error('Home leg owner revision changed');
    if(selected.owner.region===registered.record.home.region)return null;
    const {source,owner,entry}=selected,proxy=entry.homeAlias;
    if(proxy.kind!=='proxy')throw Error('Remote home leg requires registered pure proxy');
    const actor=await checkpointActorRecords(source,owner.unitId);
    if(actor.unit.parentUnitId||actor.unit.stateFlags&4||actor.agent.agentId!==owner.agentId)
      throw Error('Home leg requires an outdoor living owner');
    const fields=new Map();
    for await(const v of checkpointAgentValues(source,owner.agentId)){
      if(v.path.length||!['home','target','taskname','activescript'].includes(v.attribute.toLowerCase()))continue;
      const name=v.attribute.toLowerCase();if(fields.has(name))throw Error('Duplicate home leg task attribute');fields.set(name,v);
    }
    const one=(name,type)=>{const v=fields.get(name);if(!v||v.type!==type)throw Error('Invalid home leg '+name);return v;};
    const task=one('taskname',3);if(task.stringBytes>64)throw Error('Home leg task text exceeds bound');
    const text=await source.readAt(task.offset,task.stringBytes+1);
    if(!(text instanceof Uint8Array)||text.length!==task.stringBytes+1||text.at(-1)!==0||text.subarray(0,-1).includes(0))
      throw Error('Invalid home leg task text');
    if(new TextDecoder('utf-8',{fatal:true}).decode(text.subarray(0,-1))!=='go_home')return null;
    if(one('home',5).targetAgentId!==proxy.agentId||one('target',5).targetAgentId!==proxy.agentId)
      throw Error('Home leg targets another script');
    const active=one('activescript',8);
    if(active.flag||active.functions.length!==1||active.functions[0].slot!==0||active.functions[0].name!=='use_building')
      throw Error('Home leg requires held original building-use request');
    let queued=0;for await(const q of checkpointAgentQueues(source))if(q.type==='queued-agent'&&q.agentId===owner.agentId)queued++;
    if(queued!==1)throw Error('Home leg owner is not uniquely queued');
    for await(const a of checkpointAttachments(source))if(a.unitId===owner.unitId&&a.kind==='ORDR')
      throw Error('Home leg cannot replace existing native orders');
    let pose;for await(const p of checkpointPlacements(source))if(p.unitId===owner.unitId)pose=p.fixedPosition;
    const leg=planHaloHomeLeg(pose,owner.region,registered.record.home.region);
    return {...leg,worldId:registered.record.worldId,contentDigest:identity.contentDigest,
      entityId:identity.entityId,guildEntityId:registered.record.guildEntityId,owner:{...owner},proxy:{...proxy},
      nativeHome:{...registered.record.home},ownerManifest:selected.record.manifest,ownerRevision:selected.record.revision,
      sourceWorld:{...entry.world},sourceClockMs:await checkpointSavedClock(source),continuation:'use_building',
      nativeMovementQualified:false};
  },{signal});
}
