import test from 'node:test';
import assert from 'node:assert/strict';
import {haloTerrainCheckpoint} from './fixtures/halo-terrain-checkpoint.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';

function fixture(key,options){
  const header=Buffer.alloc(272);header.write('VERS');header.writeUInt32LE(256,4);header.writeUInt32LE(1,8);
  const bytes=Buffer.concat([header,haloTerrainCheckpoint(key,options)]),reads=[];
  const source={size:bytes.length,async readAt(at,n){assert.ok(n<=4096);reads.push({at,n});return Uint8Array.from(bytes.subarray(at,at+n));}};
  return {bytes,reads,source};
}
test('explicit halo admission verifies all heights in bounded rows across signed region coordinates',async()=>{
  for(const key of ['0_0','1_0','-1_0','0_-1','-1000000_1000000']){
    const f=fixture(key),before=Buffer.from(f.bytes),result=await requireCheckpointHaloLayout(f.source,key,'halo-v1');
    assert.equal(result.verifiedVertices,16641);assert.equal(result.sharedVertices,2480);assert.equal(result.largestTerrainRead,1161);
    assert.equal(result.key,key);assert.equal(result.core.widthCells,124);assert.equal(result.native.widthCells,128);
    assert.equal(f.reads.filter(r=>r.n===1161).length,129);assert.deepEqual(f.bytes,before);assert.ok(Object.isFrozen(result.native));
  }
});
test('original interior foundation edits remain admissible while shared seam edits are rejected',async()=>{
  const interior=fixture('0_0',{defect:{x:64,y:64,bits:0x3f800000}});
  assert.equal((await requireCheckpointHaloLayout(interior.source,'0_0','halo-v1')).sharedVertices,2480);
  const shared=fixture('0_0',{defect:{x:4,y:64,bits:0x3f800000}});
  await assert.rejects(requireCheckpointHaloLayout(shared.source,'0_0','halo-v1'),/heights differ/);
});
test('legacy extents, a different origin, and corrupted heights cannot be reclassified as halo kingdoms',async()=>{
  for(const [key,options,selected] of [['0_0',{legacy:true},'0_0'],['1_0',{},'0_0'],
    ['0_0',{width:127},'0_0'],['0_0',{defect:{x:64,y:64}},'0_0'],['0_0',{defect:{x:128,y:128,bits:0x80000000}},'0_0']]){
    const f=fixture(key,options),before=Buffer.from(f.bytes);await assert.rejects(requireCheckpointHaloLayout(f.source,selected,'halo-v1'));
    assert.deepEqual(f.bytes,before);
  }
});
test('unsupported recipes and cancelled validation start no terrain I/O; pending reads drain without admitting rows',async()=>{
  const f=fixture('0_0'),controller=new AbortController();
  await assert.rejects(requireCheckpointHaloLayout(f.source,'0_0',null));assert.equal(f.reads.length,0);
  controller.abort(Error('closed'));await assert.rejects(requireCheckpointHaloLayout(f.source,'0_0','halo-v1',{signal:controller.signal}),/closed/);
  assert.equal(f.reads.length,0);
  let unblock,entered;const gate=new Promise(r=>unblock=r),started=new Promise(r=>entered=r),signal=new AbortController();
  const original=f.source.readAt;f.source.readAt=async(at,n)=>{const result=await original(at,n);if(n===1161){entered();await gate;}return result;};
  const pending=requireCheckpointHaloLayout(f.source,'0_0','halo-v1',{signal:signal.signal}),refused=assert.rejects(pending,/ended/);
  await started;signal.abort(Error('ended'));let finished=false;pending.catch(()=>finished=true);
  await Promise.resolve();assert.equal(finished,false);unblock();await refused;
  assert.equal(f.reads.filter(r=>r.n===1161).length,1);
});
