import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointEmptyActorOrders} from '../web/world/orders.mjs';
import {checkpointFile} from '../web/world/checkpoint.mjs';

const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b;};
const words=values=>Buffer.concat(values.map(word));
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),word(body.length),word(version),word(count),body]);
const empty=()=>words([1,0,1,0,1,0]);
const order=(id,body=empty(),extra=[])=>Buffer.concat([word(id),chunk('ORDR',Buffer.concat([chunk('PRIM',body,2),...extra]),0,1+extra.length)]);
const save=(records=[],padding=0)=>Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('MTER',Buffer.alloc(padding)),
  chunk('ORDR',Buffer.concat(records),1,records.length),chunk('CONT',undefined,1)]);
function source(data){
  const reads=[];return {size:data.length,reads,async readAt(at,n){reads.push([at,n]);assert.ok(n<=4096);return data.subarray(at,at+n);}};
}

test('empty actor order banks preserve ranges and support Blob adapters',async()=>{
  const data=save([order(506)]),a=await checkpointEmptyActorOrders(source(data),506),
    b=await checkpointEmptyActorOrders(checkpointFile(new Blob([data])),506);
  assert.deepEqual(a,b);assert.deepEqual(a.banks,[0,1,2].map(bank=>({bank,version:1,count:0})));
  assert.equal(a.attachment.size,60);
});
test('only selected actor banks are interpreted, with absent orders returning null',async()=>{
  const data=save([order(99,words([0xf0000000])),order(506)]);
  assert.ok(await checkpointEmptyActorOrders(source(data),506));
  assert.equal(await checkpointEmptyActorOrders(source(data),507),null);
});
test('active banks, unknown versions, wrong sizes and extra components fail closed',async()=>{
  for(let i=0;i<6;++i){
    const values=[1,0,1,0,1,0];values[i]=i%2?1:2;
    await assert.rejects(checkpointEmptyActorOrders(source(save([order(506,words(values))])),506),/orders/);
  }
  for(const body of [empty().subarray(0,20),Buffer.concat([empty(),word(0)])])
    await assert.rejects(checkpointEmptyActorOrders(source(save([order(506,body)])),506),/orders/);
  await assert.rejects(checkpointEmptyActorOrders(source(save([order(506,empty(),[chunk('SECD')])])),506),/orders/);
});
test('duplicate actor orders and invalid trailing attachment groups are rejected',async()=>{
  await assert.rejects(checkpointEmptyActorOrders(source(save([order(506),order(506)])),506),/Duplicate/);
  const data=save([order(506)]);data.writeUInt32LE(1,data.length-4);
  await assert.rejects(checkpointEmptyActorOrders(source(data),506),/Truncated/);
});
test('page-crossing order banks retain the 4096-byte I/O bound and skip dormant terrain',async()=>{
  // Order body starts at VERS(272)+MTER header/payload+root16+ID4+two headers32.
  const data=save([order(506)],4095-272-16-16-4-32),input=source(data);
  const result=await checkpointEmptyActorOrders(input,506);
  assert.equal(result.attachment.primary.offset+16,4095);assert.equal(result.banks.length,3);
  const large=source(save([order(506)],1024*1024));await checkpointEmptyActorOrders(large,506);
  assert.ok(large.reads.reduce((n,r)=>n+r[1],0)<16384);
});
test('invalid unit IDs and truncated direct bank reads never return partial data',async()=>{
  const input=source(save([order(506)]));
  for(const id of [0,-1,0x100000000,1.5,NaN,'506'])await assert.rejects(checkpointEmptyActorOrders(input,id),/unit ID/);
  const normal=input.readAt;input.readAt=async(at,n)=>n===24?new Uint8Array(23):normal(at,n);
  await assert.rejects(checkpointEmptyActorOrders(input,506),/Truncated/);
});
