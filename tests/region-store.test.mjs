import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserRegionStore, RegionStream, MAX_ACTIVE} from '../web/world/stream.mjs';

function fixture() {
  const transactions = [], store = new BrowserRegionStore();
  store.db = {transaction(name, mode) {
    assert.equal(name, 'regions');assert.equal(mode, 'readonly');
    const requests = [], transaction = {requests, objectStore() {return {get(id) {
      const request = {id};requests.push(request);return request;
    }};}};
    transactions.push(transaction);return transaction;
  }};
  return {store, transactions};
}
test('bounded regional reads share one transaction and resolve only after its completion', async () => {
  const {store,transactions}=fixture();
  const keys=Array.from({length:MAX_ACTIVE},(_,i)=>`${i-24},0`);
  let settled=false;
  const result=store.readMany(keys).then(values=>{settled=true;return values;});
  assert.equal(transactions.length,1);assert.equal(store.readTransactions,1);
  const transaction=transactions[0];
  for(const [i,request] of transaction.requests.entries()) {
    request.result=i===0?undefined:{value:i};request.onsuccess();
  }
  await Promise.resolve();assert.equal(settled,false);
  transaction.oncomplete();
  const values=await result;assert.equal(values.size,MAX_ACTIVE);
  assert.equal(values.has(keys[0]),true);assert.equal(values.get(keys[0]),undefined);
  assert.deepEqual(values.get(keys.at(-1)),{value:MAX_ACTIVE-1});
});
test('aborting after individual successful reads rejects the complete batch', async () => {
  const {store,transactions}=fixture(),result=store.readMany(['0,0','1,0']);
  const transaction=transactions[0],request=transaction.requests[0];
  request.result={value:'must not publish'};request.onsuccess();
  transaction.error=new Error('aborted read');transaction.onabort();
  await assert.rejects(result,/aborted read/);
});
test('invalid or excessive batches open no transaction and empty batches are free', async () => {
  const {store,transactions}=fixture();
  for(const ids of [null,['camera-v1'],['0,0','0,0'],['00,0'],['-0,0'],['1000001,0'],['0,NaN'],Array.from({length:MAX_ACTIVE+1},(_,i)=>`${i},0`)])
    await assert.rejects(store.readMany(ids),/Invalid region read batch/);
  assert.deepEqual(await store.readMany([]),new Map());
  assert.equal(transactions.length,0);assert.equal(store.readTransactions,0);
});
test('bulk handoff loads only missing regions and keeps the old scene on batch failure', async () => {
  let calls=0,fail=false;
  const store={async read(){assert.fail('bulk-capable store must not use single reads');},async write(){},async readMany(ids){
    calls++;assert.ok(ids.length<=MAX_ACTIVE);
    if(fail)throw new Error('batch failed');
    return new Map(ids.map(id=>[id,undefined]));
  }};
  const stream=new RegionStream(store);
  await stream.move(256,256,2048,2048);
  assert.equal(calls,1);
  const previous=stream.active;
  await stream.move(256,256,2048,2048);assert.equal(calls,1,'unchanged view performs no storage read');
  const preserved=stream.active;fail=true;
  await assert.rejects(stream.move(10000,10000,2048,2048),/batch failed/);
  assert.equal(stream.active,preserved);assert.deepEqual(stream.active,previous);
  assert.equal(stream.residentRegions,MAX_ACTIVE);
  fail=false;await stream.move(10000,10000,2048,2048);
  assert.equal(calls,3);assert.ok(!stream.active.has('0,0'));
});
test('an incomplete bulk result cannot silently regenerate a saved region or replace the old scene', async () => {
  let partial=false;
  const saved=new Map([['0,0',{version:1,seed:71201,x:0,y:0,buildings:[{kind:'tower',x:0,y:0}]}]]);
  const store={async readMany(ids){return new Map(ids.filter(id=>!partial||id!=='0,0').map(id=>[id,saved.get(id)]));}};
  const stream=new RegionStream(store);
  await stream.move(256,256,320,568);
  assert.equal(stream.active.get('0,0').buildings.length,1);
  await stream.move(10000,10000,320,568);
  const previous=stream.active;partial=true;
  await assert.rejects(stream.move(256,256,320,568),/Incomplete region read batch/);
  assert.equal(stream.active,previous);
  assert.equal(saved.get('0,0').buildings.length,1);
  partial=false;await stream.move(256,256,320,568);
  assert.notEqual(stream.active,previous);
  assert.equal(stream.active.get('0,0').buildings.length,1);
});
