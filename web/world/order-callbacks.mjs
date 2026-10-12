// Pinned callback-field inspection and partial agent-ID plans only. This does
// not qualify an entire command, edit a source, or enable populated arrivals.
import {checkpointActorOrderEntries} from './order-entries.mjs';
export const MAX_ORDER_CALLBACK_AGENT_SITES=128;
const leafCallbacks=new Map([[2,{word:30,role:'missile'}],[5,{word:29,role:'marker'}],
  [6,{word:30,role:'follow'}],[11,{word:30,role:'marker'}],[13,{word:30,role:'marker'}]]);

// Exhaust before relying on inspection: later malformed orders still reject.
export async function* checkpointActorOrderCallbacks(source,unitId){
  for await(const entry of checkpointActorOrderEntries(source,unitId)){
    if(entry.type!=='entry')continue;
    const parts=[{word:entry.parentVersion===undefined?10:11,role:'base'},leafCallbacks.get(entry.kind)].filter(Boolean);
    for(const {word,role}of parts){
      const offset=entry.offset+word*4;
      // Original 005ae440 copies cProcID/scriptID into words 0/1 and a
      // 32-byte name into words 6..13. Reserved words and name stay opaque.
      yield Object.freeze({type:'callback',unitId,bank:entry.bank,index:entry.index,kind:entry.kind,role,
        cProcId:entry.words[word],scriptId:entry.words[word+1],offset,size:56,
        scriptIdOffset:offset+4,reservedWords:Object.freeze(entry.words.slice(word+2,word+6)),
        nameWords:Object.freeze(entry.words.slice(word+6,word+14))});
    }
  }
}

// Resolve only after the entire record passes. Resolvers must look up already
// reserved IDs, not allocate actors. This partial plan covers callback script
// fields only; positive leaf callback IDs remain unqualified and are rejected.
// Target/clock/path/other-kind semantics remain separate gates.
export async function checkpointOrderCallbackAgentPlan(source,unitId,resolveAgentId){
  if(typeof resolveAgentId!=='function')throw new Error('Order callback agent resolver required');
  const sites=[];
  for await(const callback of checkpointActorOrderCallbacks(source,unitId)){
    const before=callback.scriptId;
    if(before===0)continue;
    if(callback.role!=='base')throw new Error('Unqualified leaf callback script reference');
    if(before>0x7fffffff)throw new Error('Unsupported order callback script agent ID');
    if(sites.length>=MAX_ORDER_CALLBACK_AGENT_SITES)throw new Error('Order callback reference budget exceeded');
    sites.push({offset:callback.scriptIdOffset,size:4,before,bank:callback.bank,index:callback.index,
      kind:callback.kind,role:callback.role});
  }
  const bindings=new Map(),destinations=new Map(),patches=[];
  for(const site of sites){
    let after=bindings.get(site.before);
    if(after===undefined){
      after=await resolveAgentId(site.before);
      if(!Number.isInteger(after)||after<=0||after>0x7fffffff)
        throw new Error('Unresolved order callback script reference');
      if(destinations.has(after)&&destinations.get(after)!==site.before)
        throw new Error('Ambiguous destination order callback agent binding');
      bindings.set(site.before,after);destinations.set(after,site.before);
    }
    patches.push(Object.freeze({...site,after}));
  }
  return Object.freeze({scope:'base-order-callback-agent-fields',unitId,
    completeOrderMigration:false,patches:Object.freeze(patches)});
}
