// Preserve stopped hero navigation commands. The capsule is inert: path
// placement, native restore and remote-home interception are activation gates.
import {checkpointAttachments} from './checkpoint.mjs';
import {checkpointActorOrderEntries} from './order-entries.mjs';
import {checkpointActorOrderCallbacks} from './order-callbacks.mjs';
import {checkpointOrderUnitReferencePlan} from './order-unit-bindings.mjs';
import {checkpointOrderDispatchClockPlan} from './order-dispatch-clock.mjs';
import {checkpointActorOrderRestoreBounds} from './order-restore-bounds.mjs';
import {checkpointActorOrderNavigation} from './order-navigation.mjs';
import {checkpointHaloOrderCoordinatePlan} from './halo-order-navigation.mjs';
export const MAX_HERO_ARRIVAL_ORDER_ENTRIES=128;

export async function checkpointHeroOrderArrivalPlan(source,unitId,clocks,home,resolveUnitId,navigationRegions=null){
  let attachment;
  for await(const row of checkpointAttachments(source))if(row.kind==='ORDR'&&row.unitId===unitId){
    if(attachment)throw Error('Duplicate hero arrival orders');attachment=row;
  }
  if(!attachment)return null;
  const haloNavigation=navigationRegions?await checkpointHaloOrderCoordinatePlan(source,unitId,navigationRegions):null;
  const banks=[],entries=[],patches=[],deferredNativeHomeReferences=[];
  for await(const row of checkpointActorOrderEntries(source,unitId)){
    if(row.type==='bank')banks.push({bank:row.bank,version:row.version,count:row.count});
    if(row.type!=='entry')continue;
    if(entries.length===MAX_HERO_ARRIVAL_ORDER_ENTRIES||!(haloNavigation?[2,4,7]:[4,7]).includes(row.kind))
      throw Error('Unqualified populated hero arrival command');
    if(row.words[10]!==0&&!(row.kind===7&&row.words[10]===0x1003))
      throw Error('Unqualified hero arrival callback procedure');
    // Kind7 procedure1003 consumes object+20 as a UNIT ID (005e3c91 ->
    // lookup005a10d0). The embedded writer puts it at body word9. Never
    // classify a matching scalar or substitute a local guild for remote home.
    const data=row.words[9];
    if(data){
      // A remote-to-remote hop still carries the original guild's native ID,
      // not the pure proxy's zero backlink. The home-aware caller supplies
      // this ID from the already-verified immutable guild registration.
      const registered=home?.registeredNativeHomeUnitId;
      const homeUnitId=home?.source?.kind==='native'?home.source.unitId:
        home?.source?.kind==='proxy'&&home.source.unitId===0&&Number.isInteger(registered)&&
        registered>0&&registered<=0xffffffff?registered:null;
      if(row.kind!==7||row.words[10]!==0x1003||row.words[11]!==0||!home||
          data!==homeUnitId)
        throw Error('Unresolved hero order user-data reference');
      const site={bank:row.bank,index:row.index,kind:7,procedureId:0x1003,
        offset:row.offset+36,before:data,guildEntityId:home.guildEntityId,homeRegion:home.homeRegion};
      if(home.destination.kind==='native')patches.push({...site,size:4,after:home.destination.unitId});
      else deferredNativeHomeReferences.push({...site,
        activationRequirement:'intercept procedure1003 before original native home lookup'});
    }
    entries.push({bank:row.bank,index:row.index,kind:row.kind,offset:row.offset,size:row.size,
      waypointCount:row.waypointCount,serializedSize:row.serializedSize});
  }
  // Current navigation producers have no non-null script callback. Positive
  // callback agents require complete symbolic closure before import.
  for await(const callback of checkpointActorOrderCallbacks(source,unitId))
    if(callback.scriptId||callback.reservedWords.some(n=>n)||callback.nameWords.some(n=>n)||
        (callback.role!=='base'&&callback.cProcId!==0))
      throw Error('Unqualified hero arrival callback state');
  const references=await checkpointOrderUnitReferencePlan(source,unitId,resolveUnitId);
  patches.push(...references.patches);
  const dispatch=await checkpointOrderDispatchClockPlan(source,unitId,clocks);
  patches.push(...dispatch.patches);
  patches.push(...haloNavigation?.patches??[]);
  const allocation=await checkpointActorOrderRestoreBounds(source,unitId);
  const navigation=[];let waypointCount=0;
  // Exhaust every point but retain only <=256 headers/destinations. The full
  // points remain in the bounded copied record, not another point catalogue.
  for await(const row of checkpointActorOrderNavigation(source,unitId)){
    if(row.field==='waypoint')++waypointCount;else navigation.push(row);
  }
  return {attachment,banks,entries,patches,dispatch,navigation,
    waypointCount,allocationRequestBytes:allocation.allocationRequestBytes,deferredNativeHomeReferences,
    ...(haloNavigation?{haloNavigation}:{}),
    coordinatePolicy:haloNavigation?'translate-absolute-goals-with-halo-origin':'preserve-source-until-destination-navigation-reconciliation',
    completeReferenceClosureQualified:false,completeOrderMigration:false,nativeActivationQualified:false};
}
