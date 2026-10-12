// Restore a journal-selected dormant home into the original loader's slots.
// The caller owns the injected game's writer lease and guards all native I/O.
// Never load a native departure snapshot that still contains the old traveller.
import {checkpointSavedClock} from './saved-clock.mjs';
import {checkpointUnitAgentLinks} from './checkpoint.mjs';
import {requireCheckpointHaloLayout} from './halo-checkpoint-layout.mjs';
import {registeredHeroHome,registeredHeroRegions,verifyRegisteredHeroSnapshot} from './entity-home-ownership.mjs';
import {verifyEntitySnapshot} from './entity-ownership.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';

export function restoreSelectedDormantHeroHome(route,native,request,options={}){
 if(request?.targetRegion!==registeredHeroHome(route.identity).record.home.region)
  throw Error('Dormant restoration requires its registered home and held source');
 return restoreSelectedDormantHeroRegion(route,native,request,options);
}

// A remote kingdom retains its existing pure guild proxy, but its old native
// departure slot can still contain the traveller just as the origin's can.
export async function restoreSelectedDormantHeroRegion(route,native,request,{signal,check=()=>{},boundary=async()=>{}}={}){
 const r=JSON.parse(JSON.stringify(request)),registered=registeredHeroHome(route.identity),home=registered.record.home;
 const active=()=>{checkCheckpointReadSignal(signal);check();};active();
 if(!Number.isInteger(r.serial)||r.serial<1||r.serial>0xffffffff||
  r.sourceRegion===r.targetRegion||
  !r.sourceAlias||typeof r.sourceOwnerManifest!=='string'||!r.sourceOwnerManifest||
  typeof r.sourceNativeManifest!=='string'||!r.sourceNativeManifest)
  throw Error('Dormant restoration requires its registered home and held source');
 registeredHeroRegions([r.sourceRegion,r.targetRegion]);
 const [sx,sy]=r.sourceRegion.split('_').map(Number),[tx,ty]=r.targetRegion.split('_').map(Number);
 if(Math.abs(sx-tx)+Math.abs(sy-ty)!==1)throw Error('Dormant restoration requires an adjacent saved kingdom');
 const nativeHome=r.targetRegion===home.region;
 return await route.withDestination(r.targetRegion,null,async selected=>{
  active();const [from,to]=selected.entries;
  if(selected.record.manifest!==r.sourceOwnerManifest||from.region!==r.sourceRegion||
   from.alias.unitId!==r.sourceAlias.unitId||from.alias.agentId!==r.sourceAlias.agentId||
   from.world.sha256!==r.sourceSha256||from.world.size!==r.sourceSize||
   (nativeHome?(to.homeAlias.kind!=='native'||to.homeAlias.unitId!==home.unitId||to.homeAlias.agentId!==home.agentId):
    (to.homeAlias.kind!=='proxy'||to.homeAlias.unitId!==0)))
   throw Error('Dormant home restoration differs from its selected captured owner');
  const sourceClock=await checkpointSavedClock(selected.sources[0]),clock=await checkpointSavedClock(selected.sources[1]);active();
  if(sourceClock!==r.sourceClock)throw Error('Dormant home restoration source clock differs');
  await requireCheckpointHaloLayout(selected.sources[1],r.targetRegion,'halo-v1',{signal});active();
  return await native.withRegions([r.sourceRegion,r.targetRegion],async current=>{
   active();const source=current.get(r.sourceRegion),old=current.get(r.targetRegion);
   if(!source||source.record.manifest!==r.sourceNativeManifest||source.record.sha256!==r.sourceSha256||
    source.record.size!==r.sourceSize)throw Error('Held native source changed before dormant home restoration');
   if(old){
    if(await checkpointSavedClock(old.source)>clock)throw Error('Newer native home progress is preserved');active();
    await requireCheckpointHaloLayout(old.source,r.targetRegion,'halo-v1',{signal});active();
    // Accept only this logical hero's earlier home, with its known aliases.
    // The previous selected native slot remains intact after marker rotation.
    let present=false;for await(const unit of checkpointUnitAgentLinks(old.source)){
     active();if(unit.unitId===to.alias.unitId)present=true;
    }
    if(!present&&(old.record.sha256!==to.world.sha256||old.record.size!==to.world.size))
     throw Error('Unselected native home without its known departure alias is preserved');
    await verifyRegisteredHeroSnapshot(route.identity,to.alias,to.homeAlias,old.source,present,r.targetRegion);active();
    await verifyEntitySnapshot(route.identity,to.alias,old.source,present,to.homeAlias);active();
   }
   const record=await native.commit(r.targetRegion,{source:selected.sources[1],sha256:to.world.sha256,
    expectedManifest:old?.record.manifest??null},async phase=>{active();await boundary(phase);active();});active();
   if(record.size!==to.world.size||record.sha256!==to.world.sha256)throw Error('Restored home differs from its selected dormant world');
   return Object.freeze({serial:r.serial,sourceRegion:r.sourceRegion,targetRegion:r.targetRegion,clock,
    destinationNativeManifest:record.manifest,previousNativeManifest:old?.record.manifest??null,
    size:record.size,sha256:record.sha256,idempotent:record.idempotent,homeRestored:nativeHome,regionRestored:true,
    sourceRetired:false,sourceUnloaded:false,heroImported:false,ownerTransferred:false});
  },{signal});
 },{signal});
}
