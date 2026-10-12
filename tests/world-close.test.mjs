import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const {RegionStream,REGION}=await import(process.env.MAJESTY_WORLD_STREAM_MODULE?
  pathToFileURL(process.env.MAJESTY_WORLD_STREAM_MODULE).href:'../web/world/stream.mjs');
function gate(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function store(){return {saved:new Map(),reads:0,writes:0,
  async read(id){++this.reads;return this.saved.get(id);},
  async write(id,value){++this.writes;this.saved.set(id,structuredClone(value));}};}

test('closing an idle world releases its regions and refuses later work',async()=>{
  const io=store(),world=new RegionStream(io);
  await world.move(256,256,512,512);
  assert.ok(world.active.size>0);
  const close=world.close();assert.equal(world.close(),close);await close;
  assert.equal(world.closed,true);assert.equal(world.active.size,0);
  assert.equal(world.residentRegions,0);assert.equal(world.residentTerrainBytes,0);
  assert.equal(world.pendingOperations,0);assert.equal(world.store,null);
  const counts=[io.reads,io.writes];
  await assert.rejects(world.move(256,256,512,512),/closed/);
  await assert.rejects(world.tower(256,256),/closed/);
  assert.deepEqual([io.reads,io.writes],counts);
});

test('close during a bulk read drains one operation without publishing or starting queued work',async()=>{
  const io=store(),reading=gate();
  const world=new RegionStream(io);
  await world.move(256,256,512,512);
  let loaded,finished=false;
  io.readMany=async ids=>{++io.reads;await reading.promise;loaded=new Map(ids.map(id=>[id,null]));return loaded;};
  const move=world.move(20*REGION,0,512,512);
  const queuedTower=world.tower(20*REGION,0);
  const queuedMove=world.move(30*REGION,0,512,512);
  const outcomes=Promise.allSettled([move,queuedTower,queuedMove]);
  const reads=io.reads,close=world.close();close.then(()=>finished=true);
  await Promise.resolve();assert.equal(finished,false);
  assert.equal(world.pendingOperations,0);assert.equal(world.closed,true);
  reading.resolve();const results=await outcomes;await close;
  assert.ok(results.every(r=>r.status==='rejected'&&/closed/.test(r.reason.message)));
  assert.equal(io.reads,reads);assert.equal(io.writes,0);
  assert.equal(loaded.size,0);assert.equal(world.active.size,0);
  assert.equal(world.residentRegions,0);assert.equal(world.store,null);
});

test('close during a sequential read prevents the next region read',async()=>{
  const io=store(),reading=gate(),world=new RegionStream(io);
  io.read=async()=>{++io.reads;await reading.promise;return null;};
  const moving=world.move(256,256,512,512),outcome=Promise.allSettled([moving]);
  const close=world.close();reading.resolve();
  assert.equal((await outcome)[0].status,'rejected');await close;
  assert.equal(io.reads,1);assert.equal(world.active.size,0);assert.equal(world.residentRegions,0);
});

test('an accepted tower save finishes durably before shutdown releases its state',async()=>{
  const io=store(),world=new RegionStream(io);
  await world.move(256,256,512,512);
  const region=world.active.get('0,0'),tile=region.tiles.findIndex(t=>t!==2);
  const x=(tile%32)*16+1,y=Math.floor(tile/32)*16+1;
  const writing=gate(),original=io.write.bind(io);
  io.write=async(...args)=>{await writing.promise;return original(...args);};
  const tower=world.tower(x,y),queued=world.move(50*REGION,0,512,512);
  const queuedOutcome=Promise.allSettled([queued]);
  let finished=false;const close=world.close();close.then(()=>finished=true);
  await Promise.resolve();assert.equal(finished,false);assert.equal(io.writes,0);
  writing.resolve();await tower;await close;
  assert.equal((await queuedOutcome)[0].status,'rejected');
  assert.equal(io.writes,1);assert.equal(io.saved.get('0,0').buildings.length,1);
  assert.equal(world.active.size,0);assert.equal(world.residentRegions,0);
  const reloaded=new RegionStream(io);await reloaded.move(256,256,512,512);
  assert.deepEqual(reloaded.active.get('0,0').buildings,io.saved.get('0,0').buildings);
  await reloaded.close();
});

test('a failed accepted save preserves the previous checkpoint and still completes shutdown',async()=>{
  const io=store(),world=new RegionStream(io);
  await world.move(256,256,512,512);
  const region=world.active.get('0,0'),tile=region.tiles.findIndex(t=>t!==2);
  io.saved.set('0,0',world.snapshot(region));
  const previous=structuredClone(io.saved.get('0,0')),writing=gate();
  io.write=async()=>{await writing.promise;throw Error('quota exceeded');};
  const tower=world.tower((tile%32)*16+1,Math.floor(tile/32)*16+1);
  const outcome=Promise.allSettled([tower]),close=world.close();
  writing.resolve();assert.match((await outcome)[0].reason.message,/quota exceeded/);await close;
  assert.deepEqual(io.saved.get('0,0'),previous);
  assert.equal(world.active.size,0);assert.equal(world.residentRegions,0);assert.equal(world.store,null);
});

test('the actual map page shuts down its stream before a late storage result can allocate terrain',async()=>{
  const source=await readFile(process.env.MAJESTY_WORLD_VIEW_MODULE??new URL('../web/world/view.mjs',import.meta.url),'utf8');
  const io=store(),reading=gate(),events=new Map(),nodes=new Map();let world,initializers=0;
  io.readMany=async ids=>{++io.reads;await reading.promise;return new Map(ids.map(id=>[id,null]));};
  const element=id=>{
    if(!nodes.has(id))nodes.set(id,{style:{},value:'',textContent:'',disabled:false,
      getContext(){return {};},removeAttribute(name){delete this[name];}});
    return nodes.get(id);
  };
  const finished=runInNewContext(`(async()=>{${source.replace(/^import .*;\n/gm,'')}})()`,{
    RegionStream:class extends RegionStream{constructor(...args){super(...args);world=this;}},
    BrowserRegionStore:{async open(){return io;}},REGION,
    CameraCheckpointWriter:class{schedule(){}async flush(){}},
    selectedWorld:()=>null,selectedAtlasRegion:()=>null,
    initializeJourney:async()=>{++initializers;},initializeRegionBackups:()=>{++initializers;},
    initializeRealmCatalog:()=>{++initializers;},
    document:{querySelector:element,querySelectorAll:()=>[]},
    addEventListener:(name,fn)=>events.set(name,fn),requestAnimationFrame:()=>{},
    innerWidth:800,innerHeight:600,devicePixelRatio:1,
    location:{search:'',href:'http://localhost:8000/world/'}
  });
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(world);assert.equal(io.reads,2,'one camera read and one region batch');
  const count=nodes.size;events.get('pagehide')();assert.equal(world.closed,true);
  const drained=world.close();reading.resolve();await finished;await drained;
  assert.equal(world.active.size,0);assert.equal(world.residentRegions,0);
  assert.equal(world.highWater,0);assert.equal(world.residentHighWater,0);
  assert.equal(io.reads,2);assert.equal(initializers,0);assert.equal(nodes.size,count);
});
