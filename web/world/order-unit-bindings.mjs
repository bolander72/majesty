// Only these pinned fields have saved UNIT-ID lookup provenance. This is
// partial reference preparation, not command/actor migration or allocation.
import {checkpointActorOrderEntries} from './order-entries.mjs';
export const MAX_ORDER_UNIT_REFERENCE_SITES=128;
const targets=new Map([[2,25],[4,25],[6,25],[11,46]]);

export async function* checkpointActorOrderUnitReferences(source,unitId){
  for await(const entry of checkpointActorOrderEntries(source,unitId)){
    if(entry.type!=='entry'||!targets.has(entry.kind))continue;
    const word=targets.get(entry.kind);
    yield Object.freeze({type:'unit-target',unitId,bank:entry.bank,index:entry.index,kind:entry.kind,
      field:'_targetID',targetUnitId:entry.words[word],offset:entry.offset+word*4,size:4});
  }
}

// Exhaust all records before consulting already reserved destination IDs.
// Zero means no target and remains zero. Resolvers must not allocate actors.
export async function checkpointOrderUnitReferencePlan(source,unitId,resolveUnitId){
  if(typeof resolveUnitId!=='function')throw new Error('Order unit reference resolver required');
  const sites=[];
  for await(const target of checkpointActorOrderUnitReferences(source,unitId)){
    if(target.targetUnitId===0)continue;
    if(sites.length>=MAX_ORDER_UNIT_REFERENCE_SITES)throw new Error('Order unit reference budget exceeded');
    sites.push(target);
  }
  const bindings=new Map(),destinations=new Map(),patches=[];
  for(const site of sites){
    const before=site.targetUnitId;
    let after=bindings.get(before);
    if(after===undefined){
      after=await resolveUnitId(before);
      if(!Number.isInteger(after)||after<=0||after>0xffffffff)throw new Error('Unresolved order unit reference');
      if(destinations.has(after)&&destinations.get(after)!==before)throw new Error('Ambiguous destination order unit binding');
      bindings.set(before,after);destinations.set(after,before);
    }
    patches.push(Object.freeze({offset:site.offset,size:4,before,after,bank:site.bank,index:site.index,kind:site.kind,field:site.field}));
  }
  return Object.freeze({scope:'order-target-unit-fields',unitId,completeOrderMigration:false,patches:Object.freeze(patches)});
}
