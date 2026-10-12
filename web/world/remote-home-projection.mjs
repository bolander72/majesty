// Read-only view of the pure home that the original runtime will register.
// Retain one <=1028-byte insertion and five DWORD patches, never a copied world.
import {checkpointAgentManagerLayout,MAX_CHECKPOINT_BYTES,MAX_UNIT_RECORDS,CHECKPOINT_PAGE_BYTES} from './checkpoint.mjs';
import {verifyRemoteHomeAgent,MAX_REMOTE_HOME_BYTES} from './remote-home.mjs';
import {checkCheckpointReadSignal} from './checkpoint-lease.mjs';

export async function withProposedRemoteHome(destination,registered,proposal,consume,{signal,check=()=>{}}={}){
 if(!(proposal?.record instanceof Uint8Array)||proposal.record.length<56||proposal.record.length>MAX_REMOTE_HOME_BYTES||
  proposal.plan?.admission!=='reserve-new'||typeof consume!=='function')
  throw Error('Remote home projection requires an inert fresh proposal');
 const record=Uint8Array.from(proposal.record),agentId=proposal.plan.proposedAgentId;
 let active=true;const guard=()=>{if(!active)throw Error('Remote home projection lease ended');checkCheckpointReadSignal(signal);check();};
 guard();
 await verifyRemoteHomeAgent({size:record.length,async readAt(at,n){guard();return record.slice(at,at+n);}},registered,agentId);guard();
 const layout=await checkpointAgentManagerLayout(destination);guard();
 if(layout.nextAgentId!==agentId||agentId>=0x7ffffffe||layout.count>=MAX_UNIT_RECORDS)
  throw Error('Remote home proposal differs from the original allocation counter');
 const insertion=new Uint8Array(4+record.length);new DataView(insertion.buffer).setUint32(0,agentId,true);insertion.set(record,4);
 const size=destination.size+insertion.length;
 if(size>MAX_CHECKPOINT_BYTES)throw Error('Remote home projection exceeds the checkpoint byte budget');
 const patches=[[layout.groupOffset+4,layout.groupSize+insertion.length],
  [layout.runtimeOffset,layout.runtimeSize+insertion.length],[layout.managerOffset,layout.managerSize+insertion.length],
  [layout.countOffset,layout.count+1],[layout.counterOffset,agentId+1]].map(([at,n])=>{
   const bytes=new Uint8Array(4);new DataView(bytes.buffer).setUint32(0,n,true);
   return {at:at>=layout.insertionOffset?at+insertion.length:at,bytes};
  });
 const source={size,async readAt(at,n){
  guard();if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>CHECKPOINT_PAGE_BYTES||at+n>size)
    throw Error('Remote home projection read out of bounds');
  const result=new Uint8Array(n);let copied=0;
  while(copied<n){
   const offset=at+copied,begin=layout.insertionOffset,end=begin+insertion.length;let bytes;
   if(offset>=begin&&offset<end)bytes=insertion.subarray(offset-begin,Math.min(insertion.length,offset-begin+n-copied));
   else{const original=offset<begin?offset:offset-insertion.length,amount=Math.min(n-copied,offset<begin?begin-offset:n-copied);
    bytes=await destination.readAt(original,amount);guard();
    if(!(bytes instanceof Uint8Array)||bytes.length!==amount)throw Error('Truncated remote home projection source');
   }
   result.set(bytes,copied);copied+=bytes.length;
  }
  for(const patch of patches){const start=Math.max(at,patch.at),end=Math.min(at+n,patch.at+4);
   if(end>start)result.set(patch.bytes.subarray(start-patch.at,end-patch.at),start-at);
  }guard();return result;
 }};
 try{return await consume({source,plan:Object.freeze({version:1,agentId,sourceSize:destination.size,projectedSize:size,
   insertedBytes:insertion.length,retainedPatchBytes:20,nativeHomeRegistered:false,worldWritten:false})});}
 finally{active=false;}
}
