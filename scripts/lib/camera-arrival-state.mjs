// Read-only verification of a deliberate view change between two full saves.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {checkpointChunks} from '../../web/world/checkpoint.mjs';
import {hashCheckpointSource} from '../../web/world/transfer-store.mjs';
import {compareConnectedWorlds} from './connected-residency.mjs';

async function cameraSection(state){
  const source=await stoppedFileSource(state.filename);
  assert.ok(source.size<=2*1024*1024);assert.equal(await hashCheckpointSource(source),state.sha256);
  let found=null;
  for await(const chunk of checkpointChunks(source)){
    if(chunk.tag!=='GSGL')continue;
    assert.equal(found,null);assert.equal(chunk.version,6);assert.equal(chunk.count,0);
    assert.ok(chunk.size>=8&&chunk.size<=65536);
    const full=createHash('sha256'),suffix=createHash('sha256');let camera;
    for(let at=0;at<chunk.size;at+=4096){
      const bytes=Buffer.from(await source.readAt(chunk.offset+16+at,Math.min(4096,chunk.size-at)));
      full.update(bytes);suffix.update(at===0?bytes.subarray(8):bytes);
      if(at===0)camera={x:bytes.readUInt32LE(0),y:bytes.readUInt32LE(4)};
    }
    found={camera,suffixSha256:suffix.digest('hex'),root:{tag:'GSGL',version:6,count:0,bytes:chunk.size,sha256:full.digest('hex')}};
  }
  assert.ok(found);assert.deepEqual(state.roots.filter(r=>r.tag==='GSGL'),[found.root]);
  return found;
}

export async function compareCameraArrivalStates(before,after,expectedBefore,expectedAfter){
  for(const camera of [expectedBefore,expectedAfter]){
    assert.deepEqual(Object.keys(camera).sort(),['x','y']);
    assert.ok(Object.values(camera).every(n=>Number.isSafeInteger(n)&&n>=0&&n<=16777216));
  }
  const a=await cameraSection(before),b=await cameraSection(after);
  assert.deepEqual(a.camera,expectedBefore);assert.deepEqual(b.camera,expectedAfter);
  assert.deepEqual({...a.root,sha256:b.root.sha256},b.root);
  assert.equal(a.suffixSha256,b.suffixSha256,'GSGL changed outside the two original camera coordinates');
  // Only after proving the exact raw prefix and every suffix byte, compare
  // all typed records/queues/RNGs/clocks/sections under the existing contract.
  // Inputs and their root hashes remain unchanged; this is a separate view
  // transform result, never an unchanged-restoration result.
  const restoredView={...after,roots:after.roots.map(r=>r.tag==='GSGL'?{...r,sha256:a.root.sha256}:r)};
  const comparison=compareConnectedWorlds(before,restoredView);
  return {qualified:true,cameraBefore:a.camera,cameraAfter:b.camera,
    cameraChanged:a.camera.x!==b.camera.x||a.camera.y!==b.camera.y,
    cameraPayloadOffsets:[0,4],bytesOutsideCameraUnchanged:true,...comparison};
}
