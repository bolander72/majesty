import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {recordJourney,recordJourneyArrival,JOURNEY_KEY,MAX_JOURNEY_BYTES} from '../web/world/journey.mjs';
import {nativeRegionURL} from '../web/world/region.mjs';
const site=new URL('../upstream/majesty-recomp/build/frontend-world-candidate071a/site/',import.meta.url);
const moduleURL=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
const bundleURL=moduleURL((await readFile(new URL('../web/backups/bundle.mjs',import.meta.url),'utf8'))
  .replace("'../core.js'",JSON.stringify(new URL('core.js',site).href))
  .replace("'../zip-stream.mjs'",JSON.stringify(new URL('zip-stream.mjs',site).href))
  .replace("'../world/journey-record.mjs'",JSON.stringify(new URL('../web/world/journey-record.mjs',import.meta.url).href)));
const bundle=await import(bundleURL),core=await import(new URL('core.js',site));
const storage=await import(moduleURL((await readFile(new URL('../web/backups/storage.mjs',import.meta.url),'utf8')).replace("'./bundle.mjs'",JSON.stringify(bundleURL))));
const databases=[{name:'majesty-frontier-campaign-v1-profile-alice',version:1,store:'chapters',rows:[[1,true],[3,true],[4,true]]},
  {name:'majesty-native-world-garden',version:1,store:'regions',rows:[['camera-v1',{x:512,y:-256}],['1,-1',{version:1,seed:71201,x:1,y:-1,buildings:[{kind:'tower',x:2,y:5}]}]]}];
async function sample(dbs=databases){return bundle.createBundle([{path:'alice/SaveGame/test.GMP',file:new Blob(['original save bytes'])},{path:'native-world-garden/frontier_1_-1/Frontier_1_-1.checkpoint',file:new Blob(['checkpoint'])}],dbs);}
async function repack(result,mutate){
  const zip=await core.ZipReader.open(result.blob),files=[];
  for(const entry of zip.entries())files.push({name:entry.path,data:new Uint8Array(await new Response(await zip.stream(entry)).arrayBuffer())});
  mutate(files);return core.zipWrite(files);
}
test('complete bundle preserves all profile files, chapter completion, Atlas regions and camera',async()=>{
  const result=await sample(),checked=await bundle.inspectBundle(result.blob);assert.equal(checked.nativeCount,2);assert.equal(checked.databaseCount,2);assert.deepEqual(checked.databases,databases);
  const parts=[];await checked.copyNative(checked.manifest.native[0],{write:b=>parts.push(b)});assert.equal(await new Blob(parts).text(),'original save bytes');
});
test('restore inspection retains summaries and reads one database on demand',async()=>{
  const result=await sample(),checked=await bundle.inspectBundle(result.blob,{retainDatabases:false});
  assert.ok(checked.databases.every(d=>!Object.hasOwn(d,'rows')));
  assert.deepEqual(await checked.readDatabase(checked.manifest.databases[0]),databases[0]);
});
test('native corruption is refused before destination access',async()=>{
  const result=await sample();const bad=await repack(result,files=>files[0].data[0]^=1);
  await assert.rejects(storage.restorePlayer(bad,{root:{getDirectoryHandle(){throw Error('destination touched');}}}),/integrity/);
});
test('manifest traversal, duplicate paths, omitted content and database mismatch are refused',async()=>{
  const result=await sample();
  for(const alter of [
    fs=>{fs[0].name='../escape';},
    fs=>{fs.push(fs[0]);},
    fs=>{fs.push({name:'native/unlisted',data:new Uint8Array([1])});},
    fs=>{const f=fs.find(f=>f.name==='player-backup.json');const m=JSON.parse(new TextDecoder().decode(f.data));m.databases[0].name='majesty-frontier-campaign-v1-profile-bob';f.data=new TextEncoder().encode(JSON.stringify(m));}
  ])await assert.rejects(bundle.inspectBundle(await repack(result,alter)));
});
test('old save ZIPs remain separate and give the existing import path',async()=>{
  await assert.rejects(bundle.inspectBundle(core.zipWrite([{name:'save.GMP',data:new Uint8Array([1])}])),/metadata/);
});
test('malformed campaign and Atlas schemas cannot be imported',()=>{
  for(const value of [
    {...databases[0],rows:[[5,true]]},{...databases[0],rows:[[1,false]]},{...databases[0],rows:[[1,true],[1,true]]},
    {...databases[1],rows:[['camera-v1',{x:Infinity,y:0}]]},{...databases[1],rows:[['01,0',{version:1,seed:1,x:1,y:0,buildings:[]}]]},
    {...databases[1],store:'unknown'},{...databases[1],version:2},{...databases[0],name:'unrelated-private-data'}
  ])assert.throws(()=>bundle.validateDatabase(value));
});
test('hashing is bounded and cancellation is honored',async()=>{
  const source=new Blob([new Uint8Array(200000)]),sizes=[],wrapped={size:source.size,slice(at,end){sizes.push(end-at);return source.slice(at,end);}};
  assert.equal(await bundle.hashBlob(wrapped),core.sha256Hex(new Uint8Array(200000)));assert.ok(Math.max(...sizes)<=65536);
  const controller=new AbortController();controller.abort();await assert.rejects(sampleWithSignal(controller.signal));
});
async function sampleWithSignal(signal){return bundle.createBundle([{path:'a',file:new Blob(['b'])}],[],{signal});}
function memoryDirectory({failWrite}={}){
  function notFound(){const e=Error('missing');e.name='NotFoundError';return e;}
  function dir(){return {kind:'directory',items:new Map(),async*entries(){yield*this.items;},async getDirectoryHandle(name,{create=false}={}){let h=this.items.get(name);if(!h&&create){h=dir();this.items.set(name,h);}if(!h||h.kind!=='directory')throw notFound();return h;},async getFileHandle(name,{create=false}={}){let h=this.items.get(name);if(!h&&create){h={kind:'file',bytes:new Blob(),async getFile(){return this.bytes;},async createWritable(){const target=this,parts=[];return{async write(bytes){if(failWrite?.(name))throw Error('quota test');parts.push(bytes);},async close(){target.bytes=new Blob(parts);},async abort(){}};}};this.items.set(name,h);}if(!h||h.kind!=='file')throw notFound();return h;},async removeEntry(name){if(!this.items.delete(name))throw notFound();}};}
  return dir();
}
const emptyDB={databases:async()=>[]};
const locks={request:async(name,options,consume)=>consume({name})};
async function nativeFile(root,path,text){let d=root;for(const p of ['majesty','profile',...path.split('/').slice(0,-1)])d=await d.getDirectoryHandle(p,{create:true});const w=await(await d.getFileHandle(path.split('/').at(-1),{create:true})).createWritable();await w.write(text);await w.close();}
test('fresh native restore and export reproduce exact bytes and exclude game assets',async()=>{
  const root=memoryDirectory(),result=await sample([]);await storage.restorePlayer(result.blob,{root,storage:emptyDB,locks});
  const game=await root.getDirectoryHandle('majesty');const assets=await game.getDirectoryHandle('game',{create:true});assets.items.set('private-game-asset',{kind:'file',getFile:async()=>new Blob(['asset'])});
  const exported=await storage.exportPlayer({root,storage:emptyDB,locks});assert.deepEqual(exported.manifest.native,result.manifest.native);
  assert.equal(exported.manifest.native.some(f=>f.path.includes('asset')),false);
});
test('completed archive survives native file replacement and cache is explicitly bounded',async()=>{
  const root=memoryDirectory();await nativeFile(root,'alice/save.GMP','before');
  const first=await storage.exportPlayer({root,storage:emptyDB,locks}),digest=await bundle.hashBlob(first.blob);
  await nativeFile(root,'alice/save.GMP','after');assert.equal(await bundle.hashBlob(first.blob),digest);
  await assert.rejects(storage.exportPlayer({root,storage:emptyDB,locks}),/still cached/);
  assert.equal(await storage.clearBackupDownload({root,locks}),true);
  const second=await storage.exportPlayer({root,storage:emptyDB,locks});assert.notEqual(second.manifest.native[0].sha256,first.manifest.native[0].sha256);
});
test('existing save collection and progress conflicts are refused without changes',async()=>{
  const result=await sample([]),root=memoryDirectory();await nativeFile(root,'alice/save.GMP','keep');
  await assert.rejects(storage.restorePlayer(result.blob,{root,storage:emptyDB,locks}),/already has native/);
  assert.equal(await(await(await(await root.getDirectoryHandle('majesty')).getDirectoryHandle('profile')).getDirectoryHandle('alice')).getFileHandle('save.GMP').then(h=>h.getFile()).then(f=>f.text()),'keep');
  const all=await sample();await assert.rejects(storage.restorePlayer(all.blob,{root:memoryDirectory(),storage:{databases:async()=>[{name:databases[0].name}]},locks}),/already exists/);
});
test('unavailable game lease blocks backup and restore',async()=>{
  const root=memoryDirectory(),busy={request:async(name,options,consume)=>consume(null)};
  await assert.rejects(storage.exportPlayer({root,storage:emptyDB,locks:busy}),/Close Majesty/);
  await assert.rejects(storage.restorePlayer((await sample([])).blob,{root,storage:emptyDB,locks:busy}),/Close Majesty/);
});
test('failed native write rolls back new data and preserves game assets',async()=>{
  const root=memoryDirectory({failWrite:name=>name==='test.GMP'}),game=await root.getDirectoryHandle('majesty',{create:true});await game.getDirectoryHandle('game',{create:true});
  await assert.rejects(storage.restorePlayer((await sample([])).blob,{root,storage:emptyDB,locks}),/quota test/);
  assert.ok(game.items.has('game'));assert.equal(game.items.has('profile'),false);assert.equal(game.items.has('.player-restore-v1.json'),false);
});
test('durable interrupted marker blocks startup and isolated recovery clears only new restore files',async()=>{
  const root=memoryDirectory();await nativeFile(root,'alice/save.GMP','partial');const game=await root.getDirectoryHandle('majesty'),marker=await(await game.getFileHandle('.player-restore-v1.json',{create:true})).createWritable();
  await marker.write(JSON.stringify({format:'majesty-player-restore-v1',databases:[],createdDatabases:[],profileCreated:true}));await marker.close();
  await assert.rejects(storage.assertNoPlayerRestore({getDirectory:async()=>root}),/interrupted/);
  assert.equal(await storage.discardInterruptedRestore({root,storage:emptyDB,locks}),true);await storage.assertNoPlayerRestore({getDirectory:async()=>root});assert.equal(game.items.has('profile'),false);
});

async function journeyDatabase(arrive=false){
  const records=new Map(),content='a'.repeat(64)+':'+'b'.repeat(64);
  const base=nativeRegionURL(1,-1,'http://localhost:8000/world/?world=garden').href;
  const target=nativeRegionURL(2,-1,base).href;
  const open=async()=>({write:async(k,v)=>records.set(k,v),read:async k=>records.get(k),close(){}});
  await recordJourney(target,{base,content,open});
  if(arrive)await recordJourneyArrival({search:new URL(target).search,content,open});
  return {...databases[1],rows:[...databases[1].rows,[JOURNEY_KEY,records.get(JOURNEY_KEY)]]};
}
test('actual pending and arrived native travel records survive complete backup inspection unchanged',async()=>{
  for(const arrived of [false,true]){
    const db=await journeyDatabase(arrived),result=await sample([databases[0],db]);
    const checked=await bundle.inspectBundle(result.blob,{retainDatabases:false});
    assert.deepEqual(await checked.readDatabase(checked.manifest.databases[1]),db);
    assert.equal(JSON.parse(db.rows.at(-1)[1]).state,arrived?'active':'pending');
  }
});
test('travel metadata remains bounded, world-bound and validated without accepting arbitrary Atlas text',async()=>{
  const db=await journeyDatabase(),text=db.rows.at(-1)[1],record=JSON.parse(text);
  for(const [key,value,name] of [
    [JOURNEY_KEY,'broken'],[JOURNEY_KEY,'x'.repeat(MAX_JOURNEY_BYTES+1)],
    [JOURNEY_KEY,record],[JOURNEY_KEY,JSON.stringify({...record,world:'other'})],
    [JOURNEY_KEY,JSON.stringify({...record,target:{x:8,y:8}})],
    [JOURNEY_KEY,JSON.stringify({...record,content:'invalid'})],
    [JOURNEY_KEY,text,'majesty-garden'],['unknown-metadata',text],['1,-1',text],
  ])assert.throws(()=>bundle.validateDatabase({...db,name:name??db.name,rows:[[key,value]]}));
});
