// Storage ownership for unpublished initial banks. No native methods or edits.
import {checkpointActorOrderRestoreBounds} from './order-restore-bounds.mjs';
export const MAX_ORDER_STORAGE_RESERVATIONS=518; // 6 bank/head + 4 * 128 entries.

function key({role,bank,index}){return `${role}:${bank}:${index}`;}
export async function checkpointActorOrderStorageRequests(source,unitId){
  const plan=await checkpointActorOrderRestoreBounds(source,unitId),requests=[];
  const add=(role,bank,index,kind,bytes)=>requests.push(Object.freeze({role,bank,index,kind,bytes}));
  for(let bank=0;bank<plan.banks;++bank){add('bank',bank,null,null,20);add('head',bank,null,null,12);}
  for(const entry of plan.entries){
    const {bank,index,kind}=entry;add('order',bank,index,kind,entry.objectBytes);
    // Retain kind-4's zero-byte request too: original reading still calls malloc.
    if(kind===4||kind===7)add('path',bank,index,kind,entry.pathBytes);
    add('baseName',bank,index,kind,entry.baseNameBytes);
    if(entry.leafNameBytes)add('leafName',bank,index,kind,entry.leafNameBytes);
    add('node',bank,index,kind,entry.nodeBytes);
  }
  if(requests.length>MAX_ORDER_STORAGE_RESERVATIONS||requests.reduce((n,r)=>n+r.bytes,0)!==plan.allocationRequestBytes)
    throw new Error('Invalid native order storage request profile');
  return Object.freeze({plan,requests:Object.freeze(requests)});
}

// Port contract: allocate returns a unique owned word-aligned guest address,
// or zero/null without allocating. Throws have no allocation side effect.
// free completes on normal return (except false); false/throw leave it owned.
// Both methods must operate on guest allocations, never host pointers.
// No construction may run before this promise resolves successfully. Retain an
// immutable stopped source and revalidate the eventual prepared capsule.
export async function reserveCheckpointActorOrderStorage(source,unitId,port){
  if(typeof port?.allocate!=='function'||typeof port?.free!=='function')
    throw new Error('Native order storage allocator port required');
  const allocate=port.allocate.bind(port),free=port.free.bind(port);
  const {plan,requests}=await checkpointActorOrderStorageRequests(source,unitId);
  const blocks=[],live=new Set(),claimed=new Set(),byKey=new Map();
  let phase='reserving',releasePromise=null,untrustedAllocation=null;
  const journal=Object.freeze({scope:'unpublished-initial-order-storage-reservations',plan,requests,
    completeOrderMigration:false,completeNativeMemoryBound:false,
    get phase(){return phase;},get ownedRequestBytes(){return [...live].reduce((n,b)=>n+b.bytes,0);},
    get untrustedAllocation(){return untrustedAllocation;},
    get reservations(){return Object.freeze(blocks.slice());},
    claim(request){
      if(phase!=='reserved')throw new Error('Native order storage journal is not reserved');
      const block=request&&byKey.get(key(request));
      if(!block||['role','bank','index','kind','bytes'].some(name=>block[name]!==request[name]))
        throw new Error('Unexpected native order allocation claim');
      if(claimed.has(block))throw new Error('Native order allocation already claimed');
      claimed.add(block);return block.address;
    },
    assertFullyClaimed(){
      if(phase!=='reserved'||claimed.size!==blocks.length)throw new Error('Unconsumed native order storage reservations');
      return true;
    },
    release(){
      if(releasePromise)return releasePromise;
      if(phase==='released')return Promise.resolve();
      phase='releasing';
      const operation=(async()=>{
        const failures=[];
        for(let i=blocks.length-1;i>=0;--i){
          const block=blocks[i];if(!live.has(block))continue;
          try{
            if(await free(block.address,block.bytes,block)===false)throw new Error('Native order storage free refused');
            live.delete(block);
          }catch(error){failures.push(error);}
        }
        if(untrustedAllocation)failures.push(new Error('Allocator contract violation needs reconciliation'));
        phase=untrustedAllocation?'allocator-contract-violated':live.size?'cleanup-pending':'released';
        if(failures.length)throw new AggregateError(failures,'Native order storage cleanup incomplete');
      })();
      releasePromise=operation.finally(()=>{releasePromise=null;});return releasePromise;
    }});
  try{
    for(const request of requests){
      const address=request.bytes?await allocate(request.bytes,request):0;
      if(request.bytes&&(address===0||address===null))throw new Error('Native order storage reservation failed');
      if(!Number.isInteger(address)||address<0||address>0xffffffff||address%4||address+request.bytes>0x100000000){
        untrustedAllocation=Object.freeze({request,address});
        throw new Error('Native order allocator returned an invalid guest extent');
      }
      if(request.bytes&&blocks.some(b=>b.bytes&&address<b.address+b.bytes&&b.address<address+request.bytes)){
        untrustedAllocation=Object.freeze({request,address});
        throw new Error('Native order allocator returned overlapping storage');
      }
      const block=Object.freeze({...request,address});blocks.push(block);byKey.set(key(block),block);
      if(block.bytes)live.add(block);
    }
    phase='reserved';return journal;
  }catch(error){
    // Preserve the cleanup handle if the allocator cannot release a block yet.
    let cleanupError;try{await journal.release();}catch(failure){cleanupError=failure;}
    const failure=new Error('Could not reserve native order storage',{cause:error});
    failure.cleanup=journal;if(cleanupError)failure.cleanupError=cleanupError;throw failure;
  }
}
