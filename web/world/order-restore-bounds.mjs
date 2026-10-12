// Initial bank/object/path/name allocation-request admission. No native allocation.
import {checkpointActorOrderEntries,MAX_NATIVE_ORDER_WAYPOINTS} from './order-entries.mjs';
import {NATIVE_KIND_SEVEN_PATH_CAPACITY} from './order-read-bounds.mjs';
export const MAX_ORDER_RESTORE_REQUEST_BYTES=64*1024;
export const MAX_ORDER_RESTORE_ENTRIES=128;
export const NATIVE_ORDER_OBJECT_REQUEST_BYTES=Object.freeze({1:88,2:92,4:100,5:92,6:92,7:72,9:52,10:76,11:112,12:72,13:100});
const bankBytes=20,sentinelBytes=12,nodeBytes=12;
const leafTokens=new Map([[2,30],[5,29],[6,30],[11,30],[13,30]]);

// Caller must retain an immutable stopped source and revalidate any prepared
// copy before loading. This is requested storage for the qualified initial
// empty-name profile, excluding allocator overhead and all actor/world state.
export async function checkpointActorOrderRestoreBounds(source,unitId){
  const entries=[],parts={bankObjectBytes:0,sentinelBytes:0,orderObjectBytes:0,nodeBytes:0,pathBytes:0,baseNameBytes:0,leafNameBytes:0};
  let banks=0,total=0;
  for await(const row of checkpointActorOrderEntries(source,unitId)){
    if(row.type==='bank'){
      ++banks;parts.bankObjectBytes+=bankBytes;parts.sentinelBytes+=sentinelBytes;total+=bankBytes+sentinelBytes;
    }else if(row.type==='entry'){
      if(entries.length>=MAX_ORDER_RESTORE_ENTRIES)throw new Error('Native order restore entry budget exceeded');
      // Canonical empty names still allocate a one-byte NUL. Nonempty strings
      // and a leading NUL with opaque suffix bytes are not qualified.
      const tokens=[row.parentVersion===undefined?10:11,leafTokens.get(row.kind)].filter(n=>n!==undefined);
      if(tokens.some(at=>row.words.slice(at+6,at+14).some(n=>n!==0)))
        throw new Error('Unqualified native order restore name storage');
      const objectBytes=NATIVE_ORDER_OBJECT_REQUEST_BYTES[row.kind];
      if(objectBytes===undefined)throw new Error('Unsupported native order allocation profile');
      const hasPath=row.kind===4||row.kind===7,
        capacity=row.kind===4?row.words[32]:row.kind===7?NATIVE_KIND_SEVEN_PATH_CAPACITY:0;
      if(hasPath&&(capacity>MAX_NATIVE_ORDER_WAYPOINTS||row.waypointCount>capacity))
        throw new Error('Native order restore path capacity exceeded');
      const pathBytes=capacity*8,baseNameBytes=1,leafNameBytes=leafTokens.has(row.kind)?1:0;
      parts.orderObjectBytes+=objectBytes;parts.nodeBytes+=nodeBytes;parts.pathBytes+=pathBytes;
      parts.baseNameBytes+=baseNameBytes;parts.leafNameBytes+=leafNameBytes;
      total+=objectBytes+nodeBytes+pathBytes+baseNameBytes+leafNameBytes;
      entries.push(Object.freeze({bank:row.bank,index:row.index,kind:row.kind,offset:row.offset,
        objectBytes,nodeBytes,pathBytes,baseNameBytes,leafNameBytes,...(hasPath?{capacity,count:row.waypointCount}:{} )}));
    }
    if(total>MAX_ORDER_RESTORE_REQUEST_BYTES)throw new Error('Native order restore allocation request budget exceeded');
  }
  return Object.freeze({scope:'initial-empty-name-order-bank-allocation-requests',unitId,banks,
    allocationRequestBytes:total,parts:Object.freeze(parts),entries:Object.freeze(entries),
    namePolicy:'canonical-empty',completeNativeMemoryBound:false,completeOrderMigration:false});
}
