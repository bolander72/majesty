#!/usr/bin/env node
// Read-only terminal inspection of stopped saves. No game or browser startup.
import {open,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {compareTerrainSeam,MAX_SEAM_VERTEX_BYTES} from '../web/world/terrain-seam.mjs';

export async function inspectNativeSeam(first,second,axis='x'){
  let largestRead=0,handles=0,handlesHighWater=0;
  const inputs=[];
  for(const filename of [first,second]){
    const initial=await stat(filename);
    if(!initial.isFile()||initial.size<16||initial.size>MAX_CHECKPOINT_BYTES)throw new Error('Invalid stopped native seam input');
    const source={size:initial.size,async readAt(at,n){
      if(!Number.isSafeInteger(at)||!Number.isSafeInteger(n)||at<0||n<0||n>4096||at+n>initial.size)
        throw new Error('Native seam read out of bounds');
      largestRead=Math.max(largestRead,n);const handle=await open(filename,'r');++handles;handlesHighWater=Math.max(handlesHighWater,handles);
      try{const bytes=new Uint8Array(n),{bytesRead}=await handle.read(bytes,0,n,at);return bytes.subarray(0,bytesRead);}
      finally{await handle.close();--handles;}
    }};
    async function digest(){const hash=createHash('sha256');
      for(let at=0;at<source.size;at+=4096){const n=Math.min(4096,source.size-at),bytes=await source.readAt(at,n);
        if(bytes.length!==n)throw new Error('Truncated stopped native seam input');hash.update(bytes);}
      return hash.digest('hex');
    }
    const sha256=await digest();inputs.push({filename,initial,source,digest,sha256});
  }
  const terrains=[];for(const input of inputs)terrains.push(await checkpointTerrain(input.source));
  const seam=await compareTerrainSeam(...terrains,axis);
  for(const input of inputs){
    if(await input.digest()!==input.sha256)throw new Error('Stopped native seam input changed');
    const after=await stat(input.filename),before=input.initial;
    if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)
      throw new Error('Stopped native seam input changed');
  }
  return {seam,inputs:inputs.map((input,index)=>({bytes:input.initial.size,sha256:input.sha256,
    width:terrains[index].width,height:terrains[index].height})),largestRead,handlesHighWater,maxWorkingVertexBytes:MAX_SEAM_VERTEX_BYTES,
    originalFilesUnchanged:true,newGameProcessesLaunched:0,browserUsed:false,
    limitations:'Read-only serialized shared-vertex comparison. Exact record equality is neither material/navigation compatibility nor proof of playable continuous terrain. No game, native map replacement, actor crossing or browser memory qualification.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length<4||process.argv.length>5){console.error('Usage: node scripts/inspect-native-seam.mjs FIRST.GMP SECOND.GMP [x|y]');process.exitCode=1;}
  else try{console.log(JSON.stringify(await inspectNativeSeam(process.argv[2],process.argv[3],process.argv[4]??'x'),null,2));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
