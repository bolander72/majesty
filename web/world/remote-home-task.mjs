// Resolve a foreign home task by logical registration, then select its stopped
// return snapshots. Engines must pause/capture/restore through their own adapter.
import {EntityRevisionStore} from './entity-revisions.mjs';
import {registeredHeroHome} from './entity-home-ownership.mjs';
import {checkpointActorRecords,checkpointAgentValues} from './checkpoint.mjs';
import {checkpointActorOrderEntries} from './family-order-entries.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
const clone=v=>structuredClone(v),digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const positive=n=>Number.isInteger(n)&&n>0&&n<=0x7fffffff;
function options(store,input,prepare=false){
  if(!(store instanceof EntityRevisionStore)||store.identity.version!==2)throw Error('Remote home requires a registered selected owner');
  const o=clone(input),keys=['expectedManifest',...(prepare?['operationId']:[])];
  if(!o||Object.keys(o).sort().join(',')!==keys.sort().join(',')||typeof o.expectedManifest!=='string'||!o.expectedManifest.length||o.expectedManifest.length>256||
      (prepare&&!digest(o.operationId)))throw Error('Invalid selected remote home request');return o;
}
async function selectedTask(identity,selected,expectedManifest){
  if(!selected||selected.record.manifest!==expectedManifest)throw Error('Remote home owner revision changed');
  const state=selected.record.state,registered=registeredHeroHome(identity),home=registered.record.home;
  const from=state.ownerSide,to=identity.regions.indexOf(home.region);
  if(from===to)return null;
  if(to<0||state.homeAliases[from].kind!=='proxy'||state.homeAliases[to].kind!=='native')throw Error('Remote home destination is not registered');
  const source=selected.sources[from],owner=selected.owner,proxy=state.homeAliases[from],native=state.homeAliases[to];
  const actor=await checkpointActorRecords(source,owner.unitId);
  if(actor.unit.parentUnitId||actor.unit.stateFlags&4||actor.agent.agentId!==owner.agentId)throw Error('Remote home requires an outdoor owner');
  const fields=new Map();
  for await(const v of checkpointAgentValues(source,owner.agentId))if(!v.path.length&&['home','target','taskname','activescript'].includes(v.attribute.toLowerCase())){
    const name=v.attribute.toLowerCase();if(fields.has(name))throw Error('Duplicate remote home task attribute');fields.set(name,v);}
  const one=(name,type)=>{const v=fields.get(name);if(!v||v.type!==type)throw Error('Invalid remote home '+name);return v;};
  const task=one('taskname',3);if(task.stringBytes>64)throw Error('Remote home task name exceeds bound');
  const bytes=await source.readAt(task.offset,task.stringBytes+1);
  if(!(bytes instanceof Uint8Array)||bytes.length!==task.stringBytes+1||bytes.at(-1)!==0||bytes.subarray(0,-1).includes(0))throw Error('Invalid remote home task text');
  if(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,-1))!=='go_home')return null;
  if(one('home',5).targetAgentId!==proxy.agentId||one('target',5).targetAgentId!==proxy.agentId)throw Error('Remote home task targets another script');
  const active=one('activescript',8);
  if(active.flag||active.functions.length!==1||active.functions[0].slot!==0||!['travel_to','use_building'].includes(active.functions[0].name))
    throw Error('Unsupported remote home continuation');
  let queue=null,count=0;
  for await(const e of checkpointActorOrderEntries(source,owner.unitId))if(e.type==='entry'){
    if(++count>128||![4,7].includes(e.kind))throw Error('Unsupported remote home order continuation');
    if(e.kind===7){
      // Pinned Queue/cProc4099: the embedded userData at serialized body word9
      // is a native UNIT ID. Resolve it only inside the actual home region.
      if(queue||e.words[10]!==4099||e.words[9]!==native.unitId)throw Error('Remote home queued building target differs');
      queue={kind:7,cProcId:4099,homeUnitId:native.unitId,targetOffset:e.offset+36,callbackOffset:e.offset+40};
    }
  }
  if(active.functions[0].name==='travel_to'&&!queue)throw Error('Remote home travel lacks its queued home entry');
  return {version:1,kind:'registered-home-region-return',worldId:registered.record.worldId,contentDigest:identity.contentDigest,
    entityId:identity.entityId,guildEntityId:registered.record.guildEntityId,owner:clone(owner),ownerManifest:selected.record.manifest,
    ownerRevision:selected.record.revision,sourceSide:from,homeSide:to,sourceRegion:identity.regions[from],homeRegion:home.region,
    sourceClockMs:await checkpointSavedClock(source),homeClockMs:await checkpointSavedClock(selected.sources[to]),
    sourceWorld:clone(selected.record.worlds[from]),homeWorld:clone(selected.record.worlds[to]),proxy:clone(proxy),nativeHome:clone(native),
    continuation:active.functions[0].name,queuedHome:queue,requiresNativePauseBeforeLookup:true,
    nativeActivationQualified:false};
}
export function readSelectedRemoteHomeTask(store,input){
  const o=options(store,input),identity=store.identity;
  return store.withSelected(selected=>selectedTask(identity,selected,o.expectedManifest));
}
// The producer consumes both leased selected saves and must return separate,
// immutable stopped snapshots with original retirement/restoration complete.
// Keep the returned commit capability for interruption retries; it reuses the
// exact prepared payload and never reruns the native producer on a retry.
export async function prepareSelectedRemoteHomeReturn(store,input,produceStoppedReturn){
  const o=options(store,input,true),identity=store.identity;
  if(typeof produceStoppedReturn!=='function')throw Error('Stopped native home return producer required');
  const prepared=await store.withSelected(async selected=>{
    const route=await selectedTask(identity,selected,o.expectedManifest);if(!route)throw Error('No selected remote home task');
    const result=await produceStoppedReturn({route:clone(route),sources:selected.sources});
    if(!result||Object.keys(result).sort().join(',')!=='freshAgentId,freshUnitId,worlds'||!positive(result.freshUnitId)||!positive(result.freshAgentId)||
       !Array.isArray(result.worlds)||result.worlds.length!==2)throw Error('Invalid stopped native home return result');
    const aliases=clone(selected.record.state.aliases);aliases[route.homeSide]={unitId:result.freshUnitId,agentId:result.freshAgentId};
    const worlds=result.worlds.map(w=>{
      if(!w?.source||typeof w.source.readAt!=='function'||!Number.isSafeInteger(w.source.size)||w.source.size<16||!digest(w.sha256))throw Error('Invalid stopped home return world');
      return {source:w.source,sha256:w.sha256};
    });
    return {route,request:{worlds,aliases,homeAliases:clone(selected.record.state.homeAliases),referenceBindings:clone(selected.record.state.referenceBindings),
      ownerSide:route.homeSide,visitedSides:selected.record.state.visitedSides|(1<<route.homeSide),kind:'handoff',
      expectedManifest:o.expectedManifest,operationId:o.operationId}};
  });
  return {route:clone(prepared.route),async commit(boundary){
    const selected=await store.commit(prepared.request,boundary);
    return {...selected,owner:{entityId:identity.entityId,region:identity.regions[prepared.request.ownerSide],...clone(prepared.request.aliases[prepared.request.ownerSide])}};
  }};
}
