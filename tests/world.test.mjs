import test from 'node:test';
import assert from 'node:assert/strict';
import {RegionStream, generate, visibleRegions, MAX_ACTIVE, MAX_RESIDENT, MAX_PENDING, REGION} from '../web/world/stream.mjs';
import {travel} from '../web/world/travel.mjs';
import {nativeRegionURL,selectedRegion,atlasURL,neighboringRegionURL,selectedAtlasRegion} from '../web/world/region.mjs';
import {tileBounds} from '../web/world/render.mjs';
class Store {
  constructor(){this.saved=new Map();}
  async read(id){return structuredClone(this.saved.get(id));}
  async write(id,data){this.saved.set(id,structuredClone(data));}
}
test('native region travel separates save profiles and rejects mismatched or ambiguous identities',()=>{
  for(const [x,y] of [[0,0],[-1,2],[1000000,-1000000]]){
    const url=nativeRegionURL(x,y,'http://localhost:8000/world/');
    assert.equal(url.pathname,'/majesty/');
    assert.deepEqual(selectedRegion(url.search),{key:`${x}_${y}`,x,y,checkpoint:`Frontier_${x}_${y}`});
    assert.equal(url.searchParams.get('profile'),`frontier_${x}_${y}`);
    assert.equal(url.searchParams.get('RECOMP_RULE_FRONTIER_RESTORE'),'1');
    assert.equal(url.searchParams.get('RECOMP_RULE_INVENTORY_COMPAT'),'1');
    assert.equal(url.searchParams.get('RECOMP_RULE_FRONTIER_SEEDED_GENERATION'),'1');
  }
  assert.equal(selectedRegion(''),null);
  assert.throws(()=>selectedRegion('?RECOMP_RULE_FRONTIER_REGION=0_0&RECOMP_RULE_FRONTIER_REGION=1_0&profile=frontier_0_0'));
  assert.throws(()=>selectedRegion('?RECOMP_RULE_FRONTIER_REGION=0_0&profile=frontier_0_0&profile=personal'));
  assert.throws(()=>selectedRegion('?RECOMP_RULE_FRONTIER_REGION=0_0&profile=frontier_0_0&RECOMP_RULE_FRONTIER_RESTORE=1&RECOMP_RULE_FRONTIER_RESTORE=0'));
  assert.throws(()=>selectedRegion('?RECOMP_RULE_FRONTIER_REGION=0_0&profile=frontier_0_0&RECOMP_RULE_FRONTIER_RESTORE=2'));
  for(const search of ['?RECOMP_RULE_FRONTIER_REGION=0_0&profile=personal','?RECOMP_RULE_FRONTIER_REGION=00_0&profile=frontier_00_0','?RECOMP_RULE_FRONTIER_REGION=1000001_0&profile=frontier_1000001_0','?RECOMP_RULE_FRONTIER_REGION=0_0&profile=frontier_0_0&RECOMP_RULE_FRONTIER_CHAPTER=1'])assert.throws(()=>selectedRegion(search));
  assert.throws(()=>nativeRegionURL(1.5,0,'http://localhost:8000/world/'));
});
test('optional memory diagnostics survive regional links without retaining unrelated settings',()=>{
  const base='http://localhost:8000/world/?RECOMP_MEMORY_DEBUG=1&relay=private&profile=personal';
  const native=nativeRegionURL(1,2,base);
  assert.equal(native.searchParams.get('RECOMP_MEMORY_DEBUG'),'1');
  const atlas=atlasURL(native.href);
  assert.equal(atlas.href,'http://localhost:8000/world/?RECOMP_MEMORY_DEBUG=1&at=1_2');
  assert.equal(atlasURL('http://localhost:8000/majesty/?RECOMP_MEMORY_DEBUG=0').search,'');
  assert.equal(nativeRegionURL(1,2,'http://localhost:8000/world/').searchParams.has('RECOMP_MEMORY_DEBUG'),false);
});
test('neighbor routes are reversible and keep the world namespace through long journeys',()=>{
  let current=nativeRegionURL(0,0,'https://game.example/world/?world=journey');
  for(let step=0;step<400;step++)current=neighboringRegionURL('east',current.href);
  assert.equal(selectedRegion(current.search).x,400);
  for(let step=0;step<400;step++)current=neighboringRegionURL('west',current.href);
  assert.equal(selectedRegion(current.search).key,'0_0');
  assert.equal(current.searchParams.get('world'),'journey');
  const edge=nativeRegionURL(-1000000,-1000000,'https://game.example/world/');
  assert.throws(()=>neighboringRegionURL('north',edge.href),/out of range/);
  assert.throws(()=>neighboringRegionURL('west',edge.href),/out of range/);
  assert.throws(()=>neighboringRegionURL('unknown',current.href),/direction/);
  assert.throws(()=>neighboringRegionURL('east','https://game.example/majesty/'),/Open a native region/);
});
test('return-to-atlas destinations preserve exact signed coordinates and reject ambiguity',()=>{
  assert.deepEqual(selectedAtlasRegion('?at=-20_31'),{x:-20,y:31});
  assert.equal(selectedAtlasRegion(''),null);
  for(const search of ['?at=','?at=0_0&at=1_1','?at=00_0','?at=-0_0','?at=1000001_0','?at=NaN_0','?at=0.5_0'])
    assert.throws(()=>selectedAtlasRegion(search));
  const destination=atlasURL(nativeRegionURL(-20,31,'https://game.example/world/?world=journey').href);
  assert.deepEqual(selectedAtlasRegion(destination.search),{x:-20,y:31});
  assert.equal(destination.searchParams.get('world'),'journey');
});
test('atlas view at a legal world edge clips its preload margin instead of failing travel',async()=>{
  for(const [x,y] of [[1000000,1000000],[-1000000,-1000000],[1000000,-1000000],[-1000000,1000000]]){
    const world=new RegionStream(new Store());
    await world.move(x*REGION+REGION/2,y*REGION+REGION/2,2048,2048);
    assert.ok(world.active.has(`${x},${y}`));assert.ok(world.active.size<=MAX_ACTIVE);
    for(const value of world.active.values())assert.ok(Math.abs(value.x)<=1000000&&Math.abs(value.y)<=1000000);
    const preserved=world.active;
    await assert.rejects(world.move((x+Math.sign(x))*REGION+REGION/2,y*REGION+REGION/2,2048,2048),/World boundary/);
    assert.equal(world.active,preserved);
  }
});
test('long journeys retain bounded terrain and restore durable buildings',async()=>{
  const store=new Store(),world=new RegionStream(store);
  await world.move(256,256,1280,720);
  const origin=world.active.get('0,0');
  const tile=origin.tiles.findIndex(v=>v!==2);
  await world.tower(tile%32*16+8,Math.floor(tile/32)*16+8);
  for(let i=1;i<=400;i++){
    await world.move(i*REGION+256,-i*REGION+256,2048,2048);
    assert.ok(world.active.size<=MAX_ACTIVE);
    assert.ok(world.terrainBytes<=MAX_ACTIVE*1024);
  }
  assert.equal(world.active.has('0,0'),false);
  assert.equal(store.saved.size,1,'untouched regions are regenerated, not accumulated');
  await world.move(256,256,1280,720);
  assert.equal(world.active.get('0,0').buildings.length,1);
  const reload=new RegionStream(store);
  await reload.move(256,256,320,568);
  assert.deepEqual(reload.active.get('0,0').buildings,world.active.get('0,0').buildings);
});
test('generation is reproducible across negative coordinates and independent visitation order',()=>{
  for(const [x,y] of [[0,0],[-1,-1],[93000,-800000]])assert.deepEqual(generate(71201,x,y).tiles,generate(71201,x,y).tiles);
  assert.notDeepEqual(generate(71201,2,3).tiles,generate(71202,2,3).tiles);
  assert.ok(visibleRegions(-1,-1,2048,2048).length<=MAX_ACTIVE);
  assert.throws(()=>visibleRegions(0,0,Infinity,100));
  assert.throws(()=>visibleRegions(0,0,2049,100));
  assert.throws(()=>generate(1,1000001,0));
});
test('rendering covers clipped viewport edges and visits only visible terrain tiles',()=>{
  assert.deepEqual(tileBounds(-505,-505,1280,720),{firstX:31,lastX:32,firstY:31,lastY:32});
  assert.deepEqual(tileBounds(1279,719,1280,720),{firstX:0,lastX:1,firstY:0,lastY:1});
  let rendered=0,fullRegions=0;
  const left=256-1280/2,top=256-720/2;
  for(const [x,y] of visibleRegions(256,256,1280,720)){
    const dx=x*REGION-left,dy=y*REGION-top;
    if(dx+REGION<0||dy+REGION<0||dx>1280||dy>720)continue;
    const b=tileBounds(dx,dy,1280,720);
    rendered+=Math.max(0,b.lastX-b.firstX)*Math.max(0,b.lastY-b.firstY);
    fullRegions+=1024;
  }
  assert.equal(rendered,3680);
  assert.ok(rendered<fullRegions/2,'edge clipping removes most tile draw calls in this viewport');
});
test('failed persistence is visible and leaves live state untouched',async()=>{
  const store=new Store(),world=new RegionStream(store);
  await world.move(256,256,320,568);
  const r=world.active.get('0,0'),tile=r.tiles.findIndex(v=>v!==2);
  store.write=async()=>{throw new Error('quota');};
  await assert.rejects(world.tower(tile%32*16+8,Math.floor(tile/32)*16+8),/quota/);
  assert.equal(r.buildings.length,0);
  r.dirty=true;
  await assert.rejects(world.move(10000,10000,320,568),/quota/);
  assert.equal(world.active.get('0,0'),r,'dirty state is retained when eviction write fails');
});
test('overlapping travel requests serialize and settle on the last destination',async()=>{
  const world=new RegionStream(new Store());
  await Promise.all(Array.from({length:40},(_,i)=>world.move(i*REGION,0,1280,720)));
  assert.ok(world.highWater<=MAX_ACTIVE);
  assert.ok(world.active.has('39,0'));
  assert.ok(!world.active.has('0,0'));
});
test('corrupt saved regions cannot allocate unbounded entities',async()=>{
  const store=new Store();store.saved.set('0,0',{version:1,seed:71201,x:0,y:0,buildings:Array(65).fill({kind:'tower',x:0,y:0})});
  await assert.rejects(new RegionStream(store).move(256,256,320,568),/Invalid saved region/);
});

function deferred() {
  let resolve;
  const promise=new Promise(r=>{resolve=r;});
  return {promise,resolve};
}
function dryPoints(region,count) {
  return Array.from(region.tiles.keys()).filter(i=>region.tiles[i]!==2).slice(0,count)
    .map(i=>[region.x*REGION+i%32*16+8,region.y*REGION+Math.floor(i/32)*16+8]);
}
test('concurrent edits persist in order before eviction and survive reload',async()=>{
  const store=new Store(),world=new RegionStream(store);
  await world.move(256,256,320,568);
  const points=dryPoints(world.active.get('0,0'),2);
  await Promise.all([
    world.tower(...points[0]),world.tower(...points[1]),world.move(10000,10000,320,568)
  ]);
  assert.equal(world.active.has('0,0'),false);
  assert.equal(store.saved.get('0,0').buildings.length,2);
  const reload=new RegionStream(store);
  await reload.move(256,256,320,568);
  assert.equal(reload.active.get('0,0').buildings.length,2);
});
test('thousands of pending destinations retain one job and load only the final destination',async()=>{
  const gate=deferred(),started=deferred(),store=new Store();let reads=0;
  store.read=async id=>{if(++reads===1){started.resolve();await gate.promise;}return undefined;};
  const world=new RegionStream(store),first=world.move(256,256,2048,2048);
  await started.promise;
  const pending=world.move(REGION+256,256,2048,2048);
  for(let i=2;i<=10000;i++)assert.equal(world.move(i*REGION+256,256,2048,2048),pending);
  assert.equal(world.pendingOperations,1);
  gate.resolve();await first;
  assert.deepEqual(await pending,{x:10000*REGION+256,y:256});
  assert.ok(reads<=MAX_ACTIVE*2,'superseded destinations do not trigger storage reads');
  assert.equal(world.pendingHighWater,1);
  assert.ok(world.active.has('10000,0'));
  assert.equal(world.active.size,MAX_ACTIVE);
  assert.equal(world.residentHighWater,MAX_RESIDENT);
  assert.equal(world.residentRegions,MAX_ACTIVE);
});
test('building edits separate travel jobs so accepted actions are not reordered',async()=>{
  const gate=deferred(),started=deferred(),store=new Store();let gated=false;
  store.read=async id=>{if(!gated){gated=true;started.resolve();await gate.promise;}return undefined;};
  const world=new RegionStream(store),first=world.move(256,256,320,568);
  await started.promise;
  const point=dryPoints(generate(71201,10,0),1)[0];
  const arrival=world.move(10*REGION+256,256,320,568);
  const edit=world.tower(...point);
  const departure=world.move(20*REGION+256,256,320,568);
  assert.notEqual(arrival,departure);
  gate.resolve();await Promise.all([first,arrival,edit,departure]);
  assert.equal(store.saved.get('10,0').buildings.length,1);
  assert.ok(world.active.has('20,0'));
});
test('bounded action queue rejects overflow without losing accepted edits and recovers',async()=>{
  const store=new Store(),world=new RegionStream(store);
  await world.move(256,256,320,568);
  const points=dryPoints(world.active.get('0,0'),MAX_PENDING+2),gate=deferred(),started=deferred();
  const write=store.write.bind(store);let gated=false;
  store.write=async(id,data)=>{if(!gated){gated=true;started.resolve();await gate.promise;}await write(id,data);};
  const first=world.tower(...points[0]);await started.promise;
  const accepted=points.slice(1,MAX_PENDING+1).map(p=>world.tower(...p));
  await assert.rejects(world.tower(...points[MAX_PENDING+1]),/queue is full/);
  assert.equal(world.pendingOperations,MAX_PENDING);
  gate.resolve();await Promise.all([first,...accepted]);
  assert.equal(store.saved.get('0,0').buildings.length,MAX_PENDING+1);
  assert.equal(world.active.get('0,0').buildings.length,MAX_PENDING+1);
  assert.equal(world.pendingHighWater,MAX_PENDING);
  assert.equal(world.pendingOperations,0);
  await world.tower(...points[MAX_PENDING+1]);
  assert.equal(store.saved.get('0,0').buildings.length,MAX_PENDING+2);
});
test('failed incoming region load leaves the complete old scene intact and allows retry',async()=>{
  const store=new Store(),world=new RegionStream(store);
  await world.move(256,256,2048,2048);
  await world.tower(...dryPoints(world.active.get('0,0'),1)[0]);
  const previous=world.active,read=store.read.bind(store);let reads=0;
  store.read=async id=>{if(++reads===4)throw new Error('read failed');return read(id);};
  await assert.rejects(world.move(10000,10000,2048,2048),/read failed/);
  assert.equal(world.active,previous);
  assert.equal(world.active.get('0,0').buildings.length,1);
  assert.equal(world.residentRegions,MAX_ACTIVE);
  assert.ok(world.residentHighWater<=MAX_RESIDENT);
  store.read=read;await world.move(10000,10000,2048,2048);
  assert.notEqual(world.active,previous);
  assert.ok(world.residentTerrainBytes<=MAX_ACTIVE*1024);
});
test('camera metadata failure still presents the committed scene and preserves buildings',async()=>{
  const store=new Store(),world=new RegionStream(store);
  await world.move(256,256,320,568);
  await world.tower(...dryPoints(world.active.get('0,0'),1)[0]);
  const write=store.write.bind(store);let shown;
  store.write=async(id,value)=>{if(id==='camera-v1')throw new Error('camera quota');await write(id,value);};
  const warning=await travel(world,{x:10000,y:10000},320,568,camera=>{
    assert.ok(world.active.has('19,19'));shown=camera;
  });
  assert.match(warning.message,/camera quota/);
  assert.deepEqual(shown,{x:10000,y:10000});
  assert.equal(store.saved.get('0,0').buildings.length,1);
  const previous=world.active;store.read=async()=>{throw new Error('read failed');};
  await assert.rejects(travel(world,{x:256,y:256},320,568,()=>assert.fail('failed travel must not present')),/read failed/);
  assert.equal(world.active,previous);
});
test('saved building payloads are canonical and duplicate occupied tiles are rejected',async()=>{
  const store=new Store(),base={version:1,seed:71201,x:0,y:0,buildings:[{kind:'tower',x:0,y:0,unused:Array(1000).fill('unused')}]};
  store.saved.set('0,0',base);
  const world=new RegionStream(store);await world.move(256,256,320,568);
  assert.deepEqual(world.active.get('0,0').buildings,[{kind:'tower',x:0,y:0}]);
  assert.deepEqual(world.snapshot(world.active.get('0,0')).buildings,[{kind:'tower',x:0,y:0}]);
  base.buildings.push({kind:'tower',x:0,y:0});store.saved.set('0,0',base);
  await assert.rejects(new RegionStream(store).move(256,256,320,568),/Invalid saved region/);
});
