import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRootPlayer} from '../web/hosting/root-player.mjs';

const catalog = [{id:'majesty',title:'Majesty',defaultContentStorageId:'majesty-lost-trail-v2',contentStorageId:'majesty-lost-trail'},
  {id:'majesty-wayfinder'},{id:'majesty-lost-trail'},{id:'majesty-lost-trail-v2'}];

test('returning players mount stock data despite a stale content-default catalog', async () => {
  let closed=0;
  const result=await prepareRootPlayer({search:'',openClient:async()=>({games:catalog,
    status:async id=>{assert.equal(id,'majesty');return {status:{state:'ready'}};},close:()=>closed++}),
    ensureAssets:()=>assert.fail('No reimport for a cached original game')});
  assert.deepEqual(result,[{id:'majesty',title:'Majesty'}]);assert.equal(closed,1);
  assert.equal(catalog[0].defaultContentStorageId,'majesty-lost-trail-v2');
});

test('retired edition links and managed worlds cannot remount Lost Trail', async () => {
  for(const search of ['?edition=lost-trail-v2&profile=old','?edition=lost-trail-v1',
    '?edition=wayfinder-v1','?room=old&role=host','?world=old']) {
    const result=await prepareRootPlayer({search,openClient:async()=>({games:catalog,
      status:async id=>{assert.equal(id,'majesty');return {status:{state:'ready'}};},close(){}})});
    assert.deepEqual(result,[{id:'majesty',title:'Majesty'}]);
  }
});

test('fresh visitors prepare the original game and keep its profile identity', async () => {
  let imported=false,closed=false;
  const result=await prepareRootPlayer({search:'?profile=my-campaign',openClient:async()=>({games:catalog,
    status:async()=>({status:{state:'notFound'}}),importZip:async id=>{assert.equal(id,'majesty');imported=true;},
    close:()=>{closed=true;}}),ensureAssets:async(id,options)=>{
      assert.equal(id,'majesty');await options.importZip(id,new File(['original'],'game.zip'));
    }});
  assert.equal(imported,true);assert.equal(closed,true);assert.equal(result[0].id,'majesty');
});

test('failed preparation releases its worker without touching content storage', async () => {
  let closed=false;
  await assert.rejects(prepareRootPlayer({search:'',openClient:async()=>({games:catalog,
    status:async()=>{throw Error('Storage unavailable');},close:()=>{closed=true;}})}),/Storage unavailable/);
  assert.equal(closed,true);
});

test('missing original configuration fails without importing a retired edition', async () => {
  let closed=false;
  await assert.rejects(prepareRootPlayer({search:'',openClient:async()=>({games:[{id:'majesty-lost-trail-v2'}],
    status:()=>assert.fail(),close:()=>{closed=true;}})}),/original game configuration/);
  assert.equal(closed,true);
});


test('qualified Alchemist catalog mounts separate data with the original save identity', async () => {
  let closed = false, prepared = false;
  const games = [{id: 'majesty', title: 'Majesty', defaultContentStorageId: 'majesty-alchemist-v1-labels2'},
    {id: 'majesty-alchemist-v1-labels2'}];
  const result = await prepareRootPlayer({search: '', openClient: async () => ({games,
    status: async () => ({status: {state: 'ready'}}), close() {closed = true;}}),
    ensureAssets: async id => {assert.equal(id, 'majesty-alchemist-v1-labels2'); prepared = true;}});
  assert.deepEqual(result, [{id: 'majesty', title: 'Majesty', contentStorageId: 'majesty-alchemist-v1-labels2'}]);
  assert.ok(prepared && closed);
});

test('failed Alchemist preparation cannot launch a partial collection', async () => {
  let closed = false;
  await assert.rejects(prepareRootPlayer({search: '', openClient: async () => ({games: [
    {id: 'majesty', defaultContentStorageId: 'majesty-alchemist-v1-labels2'}, {id: 'majesty-alchemist-v1-labels2'}],
    status: async () => ({status: {state: 'ready'}}), close() {closed = true;}}),
    ensureAssets: async () => {throw Error('Incomplete content');}}), /Incomplete content/);
  assert.ok(closed);
});
