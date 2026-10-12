// Prepare from one selected owner pair while both checkpoint leases are held.
// Returned records are an inert bounded capsule, not imported original actors.
import {EntityRevisionStore} from './entity-revisions.mjs';
import {prepareCheckpointRegisteredHeroArrival} from './arrival.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {HeroRouteStore} from './hero-route-store.mjs';
const clone=v=>JSON.parse(JSON.stringify(v));
export function prepareSelectedRegisteredHeroArrival(store,request) {
  if(!(store instanceof EntityRevisionStore)||store.identity.version!==2)
    throw Error('Registered hero arrival requires a selected version2 owner store');
  const o=clone(request),identity=store.identity;
  if(typeof o.expectedManifest!=='string'||o.expectedManifest.length>256||
     Object.keys(o).some(k=>!['expectedManifest','freshUnitId','freshAgentId','unitBindings','attachedUnitBindings'].includes(k)))
    throw Error('Invalid selected registered hero arrival request');
  return store.withSelected(async selected=>{
    if(!selected||selected.record.manifest!==o.expectedManifest)throw Error('Registered hero owner revision changed');
    const state=selected.record.state,from=state.ownerSide,to=1-from;
    const source=selected.sources[from],destination=selected.sources[to];
    const sourceClockMs=await checkpointSavedClock(source),destinationClockMs=await checkpointSavedClock(destination);
    const prepared=await prepareCheckpointRegisteredHeroArrival(source,destination,
      {unitId:selected.owner.unitId,freshUnitId:o.freshUnitId,freshAgentId:o.freshAgentId,
        unitBindings:o.unitBindings??[],attachedUnitBindings:o.attachedUnitBindings??[],sourceClockMs,destinationClockMs},
      {identity,aliases:state.aliases,homeAliases:state.homeAliases,referenceBindings:state.referenceBindings,ownerSide:from});
    return {...prepared,selectedOwner:clone(selected.owner),ownerManifest:selected.record.manifest,
      ownerRevision:selected.record.revision,worlds:clone(selected.record.worlds)};
  });
}

// The same original actor/home preparation, now against any journal-selected
// destination. The origin identity and guild registration never change.
export function prepareRouteRegisteredHeroArrival(store,destinationRegion,candidate,request,{signal}={}){
  if(!(store instanceof HeroRouteStore))throw Error('Registered hero route requires a route store');
  const o=clone(request),identity=store.identity;
  if(typeof o.expectedManifest!=='string'||o.expectedManifest.length>4096||
     Object.keys(o).some(k=>!['expectedManifest','freshUnitId','freshAgentId','unitBindings','attachedUnitBindings','navigationLayout'].includes(k))||
     (o.navigationLayout!==undefined&&o.navigationLayout!=='halo-v1'))
    throw Error('Invalid registered hero route arrival request');
  return store.withDestination(destinationRegion,candidate,async selected=>{
    if(selected.record.manifest!==o.expectedManifest)throw Error('Registered hero owner revision changed');
    const [source,destination]=selected.sources;
    const prepared=await prepareCheckpointRegisteredHeroArrival(source,destination,
      {unitId:selected.owner.unitId,freshUnitId:o.freshUnitId,freshAgentId:o.freshAgentId,unitBindings:o.unitBindings??[],
        attachedUnitBindings:o.attachedUnitBindings??[],sourceClockMs:await checkpointSavedClock(source),
        destinationClockMs:await checkpointSavedClock(destination),
        ...(o.navigationLayout?{haloRegions:{version:o.navigationLayout,sourceRegion:selected.regions[0],destinationRegion:selected.regions[1]}}:{})},
      {identity,regions:selected.regions,ownerSide:0,aliases:selected.entries.map(e=>e.alias),
        homeAliases:selected.entries.map(e=>e.homeAlias),referenceBindings:[]});
    return {...prepared,selectedOwner:clone(selected.owner),ownerManifest:selected.record.manifest,
      ownerRevision:selected.record.revision,regions:clone(selected.regions),worlds:selected.entries.map(e=>clone(e.world))};
  },{signal});
}
