import test from 'node:test';
import assert from 'node:assert/strict';
import {editionFor,prepareEditionProfile,startEditionPlayer} from '../web/content/edition-session.mjs';

test('ordinary and retired edition URLs use the original game collection',()=>{
  for(const search of ['?profile=mine','?edition=lost-trail-v1','?edition=lost-trail-v2&profile=old',
    '?edition=wayfinder-v1','?edition=wayfinder-v1&room=existing'])assert.equal(editionFor(search),null);
});

test('malformed or unknown editions remain invalid',()=>{
  for(const search of ['?edition=unknown','?edition=lost-trail-v2&edition=unknown'])
    assert.throws(()=>editionFor(search),/supported content edition/);
});

test('old deep links start without reading or changing their archived content/profile files',async()=>{
  for(const id of ['wayfinder-v1','lost-trail-v1','lost-trail-v2']){
    let started=false;
    await startEditionPlayer(()=>{started=true;},{search:'?edition='+id+'&profile=old',
      storage:{getDirectory:()=>assert.fail('Archived files stay untouched')},
      locks:{request:()=>assert.fail('No retired profile initialization')},events:new EventTarget()});
    assert.equal(started,true);
  }
});

test('the archive verifier still refuses corrupt resources before creating a profile',async()=>{
  let created=false;
  const resource={getFileHandle:async()=>({getFile:async()=>new Blob(['wrong-resource'])})};
  const game={getFileHandle:async()=>({}),getDirectoryHandle:async()=>resource};
  const storage={getDirectoryHandle:async(name,options)=>{
    if(options.create)created=true;
    return name==='majesty-wayfinder'?{getDirectoryHandle:async()=>game}:{};
  }};
  await assert.rejects(prepareEditionProfile(storage,{id:'wayfinder-v1',storageId:'majesty-wayfinder',profile:'old'}),/verified Wayfinder game ZIP/);
  assert.equal(created,false);
});
