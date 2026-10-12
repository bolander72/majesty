#!/usr/bin/env node
// Read-only typed script inspection and an identity reference plan.
import {open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {checkpointAgentValues,checkpointAgentReferencePlan} from '../web/world/checkpoint.mjs';
const [filename,argument] = process.argv.slice(2);
if (!filename || !/^[1-9][0-9]*$/.test(argument ?? ''))
  throw new Error('Usage: node scripts/inspect-native-script-values.mjs <owned GMP> <script agent ID>');
const handle = await open(filename,'r');
try {
  const before = await handle.stat();
  let reads=0,readBytes=0,largestRead=0,total=0,maxDepth=0;
  const source={size:before.size,async readAt(at,length){
    const bytes=new Uint8Array(length),result=await handle.read(bytes,0,length,at);
    ++reads;readBytes+=result.bytesRead;largestRead=Math.max(largestRead,length);
    return bytes.subarray(0,result.bytesRead);
  }};
  const counts={},samples=[],hash=createHash('sha256');
  for await(const record of checkpointAgentValues(source,Number(argument))){
    ++total;maxDepth=Math.max(maxDepth,record.path.length);
    counts[record.kind]=(counts[record.kind]??0)+1;
    hash.update(JSON.stringify(record)+'\n');
    if(record.type===5 && samples.length<32)samples.push({attribute:record.attribute,path:record.path,
      bits:record.bits,targetAgentId:record.targetAgentId,offset:record.offset});
  }
  const identityPlan=await checkpointAgentReferencePlan(source,Number(argument),id=>id);
  const after=await handle.stat();
  if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)
    throw new Error('Checkpoint changed during inspection');
  console.log(JSON.stringify({agentId:Number(argument),fileBytes:before.size,total,maxDepth,counts,samples,
    identityPlan,metadataSha256:hash.digest('hex'),reads,readBytes,largestRead,
    limitations:'Typed script references only; no source writes, native ID/context-word semantics, '
      +'own-ID remapping, engine registration, timers or actor activation.'},null,2));
}finally{await handle.close();}
