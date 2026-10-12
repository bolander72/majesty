// Path storage admission only. No allocation, restoration, or arrival hook.
import {checkpointActorOrderEntries,MAX_NATIVE_ORDER_WAYPOINTS} from './order-entries.mjs';
export const NATIVE_KIND_SEVEN_PATH_CAPACITY=10; // Original constructor allocates 0x50 bytes.
export const MAX_ORDER_PATH_STORAGE_BYTES=64*1024;

// Fully validate the attachment before returning a partial storage plan.
// Structural path framing alone does not establish native reader capacity.
export async function checkpointActorOrderReadBounds(source,unitId){
  const paths=[];let pathStorageBytes=0;
  for await(const entry of checkpointActorOrderEntries(source,unitId)){
    if(entry.type!=='entry'||![4,7].includes(entry.kind))continue;
    const capacity=entry.kind===4?entry.words[32]:NATIVE_KIND_SEVEN_PATH_CAPACITY;
    if(capacity>MAX_NATIVE_ORDER_WAYPOINTS||entry.waypointCount>capacity)
      throw new Error('Native order reader path capacity exceeded');
    const bytes=capacity*8;
    if(pathStorageBytes+bytes>MAX_ORDER_PATH_STORAGE_BYTES)
      throw new Error('Native order reader path storage budget exceeded');
    pathStorageBytes+=bytes;
    paths.push(Object.freeze({bank:entry.bank,index:entry.index,kind:entry.kind,
      count:entry.waypointCount,capacity,bytes,countOffset:entry.offset+(entry.kind===4?34:27)*4,
      ...(entry.kind===4?{capacityOffset:entry.offset+128}:{}),pathOffset:entry.pathOffset}));
  }
  return Object.freeze({unitId,scope:'native-order-reader-path-storage',pathStorageBytes,
    paths:Object.freeze(paths),completeOrderMigration:false});
}
