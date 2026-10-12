import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {fixture,world,source} from './fixtures/registered-hero-world.mjs';

test('saved allocation counter preserves removed identities instead of deriving a free ID from surviving agents',async()=>{
  const f=await fixture();
  for(const nextAgentId of [46,100,10000,0x7fffffff]){
    const bytes=world(1,false,{registration:f.registration,nextAgentId});
    assert.equal(await checkpointNextAgentId(source(bytes)),nextAgentId);
  }
});
test('occupied, zero and overflowing original GPL counters refuse',async()=>{
  const f=await fixture();
  for(const nextAgentId of [0,17,45,0x80000000,0xffffffff])
    await assert.rejects(checkpointNextAgentId(source(world(1,false,{registration:f.registration,nextAgentId}))),/allocation counter/);
});
test('counter decoding exhausts duplicate chunks and malformed manager tails',async()=>{
  const f=await fixture(),bytes=world(1,false,{registration:f.registration}),offset=bytes.indexOf(Buffer.from('GPL '));
  const length=bytes.readUInt32LE(offset+4)+16,duplicate=Buffer.concat([bytes,bytes.subarray(offset,offset+length)]);
  await assert.rejects(checkpointNextAgentId(source(duplicate)),/GPL/);
  const malformed=Buffer.from(bytes),tail=offset+length-21;malformed[tail]=2;
  await assert.rejects(checkpointNextAgentId(source(malformed)),/manager tail/);
});
