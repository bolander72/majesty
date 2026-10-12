import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {savedAtlasStore,openNativeAtlas,moveNativeAtlas,paintNativeAtlas,NATIVE_ATLAS_CELL} from '../web/world/native-atlas.mjs';
import {NativeTerrainScene} from '../web/world/terrain-scene.mjs';
import {realmTerrainProvider} from '../web/world/realm-terrain.mjs';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {pathToFileURL} from 'node:url';
import * as streaming from '../web/world/stream.mjs';
import {nativeRegionURL,selectedAtlasRegion} from '../web/world/region.mjs';
const viewRoot=process.env.MAJESTY_WORLD_VIEW_ROOT;
const {tileBounds,paintGeneratedWorld}=await import(viewRoot?pathToFileURL(`${viewRoot}/render.mjs`).href:'../web/world/render.mjs');
import {travel as commitTravel} from '../web/world/travel.mjs';
import {CameraCheckpointWriter} from '../web/world/camera-checkpoint.mjs';
import {selectedWorld} from '../web/world/world-name.mjs';
import {NATIVE_ATLAS_SPAN} from '../web/world/native-atlas.mjs';

function chunk(tag,version,count,...parts){
  const body=Buffer.concat(parts),head=Buffer.alloc(16);head.write(tag);head.writeUInt32LE(body.length,4);head.writeUInt32LE(version,8);head.writeUInt32LE(count,12);
  return Buffer.concat([head,body]);
}
function saved(height,placements=[]){
  const map=Buffer.alloc(40);map.writeUInt32LE(128);map.writeUInt32LE(128,4);
  const vertices=Buffer.alloc(129*129*9);
  for(let i=0;i<129*129;++i)vertices.writeFloatLE(height,i*9);
  return Buffer.concat([chunk('VERS',1,0,Buffer.alloc(256)),chunk('MAP ',0,1,chunk('PRIM',2,0,map)),
    chunk('MTER',0,2,chunk('MVTX',0,1,chunk('PRIM',2,129*129,vertices)),chunk('MCEL',0,1,chunk('PRIM',5,128*128,Buffer.alloc(128*128*5)))),
    ...['BLDG','VHCL','GRND','RWRD','MSGF','OFMP'].map(family=>{
      const units=placements.filter(unit=>unit.family===family).map(unit=>{
        const bytes=Buffer.alloc(40);bytes.writeUInt32LE(unit.id,4);bytes.writeInt32LE(unit.owner??0,20);
        bytes.writeInt32LE(unit.x*65536,28);bytes.writeInt32LE(unit.y*65536,32);
        return chunk('UNIT',0,1,chunk('PRIM',9,0,bytes));
      });return chunk(family,0,units.length,...units);
    })]);
}
function fixture(){
  const files=new Map(),calls=[];let busy=false,largestRead=0;
  const io={async withLock(mode,fn){calls.push({lock:mode});if(busy)throw new Error('world busy');busy=true;try{return await fn();}finally{busy=false;}},
    async open(name){assert.ok(busy,'all reads occur under the shared world lease');calls.push({file:name});
      const bytes=files.get(name);return bytes?{size:bytes.length,async readAt(at,n){assert.ok(busy);largestRead=Math.max(largestRead,n);return bytes.subarray(at,at+n);}}:null;}};
  return {files,calls,io,get busy(){return busy;},get largestRead(){return largestRead;},
    select(key,height,content='saved-assets',placements=[]){
      const bytes=saved(height,placements),hash=createHash('sha256').update(bytes).digest('hex');files.set(`Frontier_${key}.GMP`,bytes);
      files.set(`Frontier_${key}.checkpoint`,Buffer.from(`checkpoint-v1\n0\n${bytes.length}\n${hash}\n${content}\n`));
    }};
}
function context(){
  const rectangles=[],labels=[];
  return {rectangles,labels,fillRect(x,y,w,h){rectangles.push({x,y,w,h,color:this.fillStyle});},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(text,x,y){labels.push({text,x,y});}};
}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
for(const phase of ['manifest','slot-open','digest','terrain']){
  test(`closing a saved atlas during ${phase} stops further I/O and drains the world lease`,{timeout:10000},async()=>{
    const f=fixture();f.select('0_0',32);f.select('1_0',96);
    const original=f.io.open,entered=deferred(),finish=deferred();
    let blocked=false,digestFinished=false,reads=0;
    f.io.open=async name=>{
      const file=await original(name);if(!file)return null;
      if(phase==='slot-open'&&!blocked&&name.endsWith('.GMP')){
        blocked=true;entered.resolve();await finish.promise;
      }
      return {size:file.size,async readAt(at,n){
        ++reads;
        const match=phase==='manifest'?name.endsWith('.checkpoint'):
          name.endsWith('.GMP')&&(phase==='digest'||phase==='terrain'&&digestFinished);
        if(match&&!blocked){blocked=true;entered.resolve();await finish.promise;}
        const raw=await file.readAt(at,n);
        if(name.endsWith('.GMP')&&at+n===file.size)digestFinished=true;
        return raw;
      }};
    };
    const scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(f.io),{includeUnits:true}));
    const moving=assert.rejects(scene.move(128,64,128,128),/scene closed/);
    await entered.promise;
    const queued=assert.rejects(scene.move(256,64,128,128),/scene closed/);
    let settled=false;const closed=scene.close();closed.then(()=>{settled=true;});
    const before={reads,opens:f.calls.filter(c=>c.file).length};
    await Promise.resolve();assert.equal(f.busy,true);assert.equal(settled,false);
    assert.equal(scene.active.size,0);
    finish.resolve();await Promise.all([moving,queued,closed]);
    assert.equal(reads,before.reads,'no subsequent read after cancellation');
    assert.equal(f.calls.filter(c=>c.file).length,before.opens,'no subsequent file opened');
    assert.equal(f.busy,false);assert.equal(scene.residentBytes,0);assert.equal(scene.pendingOperations,0);
    assert.ok(f.largestRead<=4096);assert.equal(scene.windowReads,0);
  });
}
test('a saved atlas closed while acquiring its lock opens no files',{timeout:10000},async()=>{
  const f=fixture();f.select('0_0',32);
  const acquire=deferred(),entered=deferred(),original=f.io.withLock;
  f.io.withLock=async(mode,fn)=>{entered.resolve();await acquire.promise;return original(mode,fn);};
  const scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(f.io)));
  const moving=assert.rejects(scene.move(64,64,128,128),/scene closed/);
  await entered.promise;const closing=scene.close();acquire.resolve();await Promise.all([moving,closing]);
  assert.equal(f.calls.filter(c=>c.file).length,0);assert.equal(f.busy,false);assert.equal(scene.residentBytes,0);
});
test('a leased saved-map reader still rejects a source whose size changes during hashing',async()=>{
  const f=fixture();f.select('0_0',32);const original=f.io.open;
  f.io.open=async name=>{
    const file=await original(name);if(!file||!name.endsWith('.GMP'))return file;
    const changing={size:file.size,async readAt(at,n){const bytes=await file.readAt(at,n);if(at===0)++changing.size;return bytes;}};
    return changing;
  };
  await assert.rejects(savedAtlasStore(f.io).withRegions(['0_0'],()=>assert.fail('changed source supplied')),/Damaged/);
  assert.equal(f.busy,false);
});
test('actual saved-map adapter discovers identities, reads requested terrain under one lease and expires sources',async()=>{
  const f=fixture();f.select('0_0',32);f.select('1_0',96);
  const store=savedAtlasStore(f.io),scene=new NativeTerrainScene(realmTerrainProvider(store));
  await scene.move(128,64,128,128);
  assert.equal(f.calls.filter(x=>x.lock).length,1,'identity discovery and all terrain reads share one lease');
  assert.ok(f.largestRead<=4096);assert.equal(f.busy,false);
  assert.ok([...scene.active.values()].some(w=>w?.realmKey==='0_0'));
  assert.ok([...scene.active.values()].some(w=>w?.realmKey==='1_0'));
  let source;
  await store.withRegions(['0_0'],selected=>{source=selected.get('0_0').source;});
  await assert.rejects(source.readAt(0,1),/lease ended/);
});
test('missing checkpoints remain empty and do not create or enumerate saved regions',async()=>{
  const f=fixture(),scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(f.io)));
  await scene.move(64,64,128,128);
  assert.ok([...scene.active.values()].every(w=>w===null));assert.equal(scene.activeBytes,0);
  assert.equal(f.files.size,0);assert.ok(f.calls.filter(x=>x.file).every(x=>x.file.endsWith('.checkpoint')));
  const ctx=context();assert.deepEqual(paintNativeAtlas(ctx,scene,{x:256,y:256},512,512),{cells:0,windows:0});
  assert.equal(ctx.rectangles.length,0);
});
test('local panning uses the captured snapshot without hashing or rereading native saves',async()=>{
  const f=fixture();f.select('0_0',32);
  const scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(f.io)));
  await moveNativeAtlas(scene,64,64,128,128);const before=f.calls.length,windows=scene.windowReads,active=scene.active;
  for(let step=1;step<=25;++step)assert.deepEqual(await moveNativeAtlas(scene,64+step/10,64+step/10,128,128),{x:64+step/10,y:64+step/10});
  assert.equal(f.calls.length,before);assert.equal(scene.windowReads,windows);assert.equal(scene.active,active);
  await moveNativeAtlas(scene,96,64,128,128);assert.ok(f.calls.length>before);
  const calls=f.calls.length;await assert.rejects(moveNativeAtlas(scene,64,64,129,128),/viewport/);assert.equal(f.calls.length,calls);
});
test('bad identity, corrupted saves and busy worlds retain the last complete scene',async()=>{
  const f=fixture();f.select('0_0',32);
  const scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(f.io)));await scene.move(64,64,128,128);
  const previous=scene.active;
  f.select('1_0',96,'different-assets');
  await assert.rejects(scene.move(128,64,128,128),/manifest identity/);assert.equal(scene.active,previous);
  f.select('1_0',96);f.files.get('Frontier_1_0.GMP')[0]^=1;
  await assert.rejects(scene.move(128,64,128,128),/Damaged/);assert.equal(scene.active,previous);
  await f.io.withLock('exclusive',async()=>{
    const reads=f.calls.filter(x=>x.file).length;
    await assert.rejects(scene.move(64,64,128,128),/busy/);
    assert.equal(f.calls.filter(x=>x.file).length,reads);assert.equal(scene.active,previous);
  });
});
test('invalid read sets and oversized markers are rejected before consuming terrain',async()=>{
  const f=fixture(),store=savedAtlasStore(f.io);
  for(const keys of [null,['0_0','0_0'],['../0_0'],Array.from({length:50},(_,i)=>`${i}_0`)])
    await assert.rejects(store.withRegions(keys,()=>assert.fail('invalid selection accepted')));
  assert.equal(f.calls.length,0);
  f.files.set('Frontier_0_0.checkpoint',Buffer.alloc(512));
  await assert.rejects(store.withRegions(['0_0'],()=>assert.fail('oversized metadata accepted')),/manifest size/);
  assert.equal(f.largestRead,0);
});
test('heightmap paints visible saved cells, clips offscreen windows and never draws unknown regions',async()=>{
  const f=fixture();f.select('0_0',32);f.select('1_0',96);
  const scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(f.io)));await scene.move(128,64,128,128);
  const ctx=context(),result=paintNativeAtlas(ctx,scene,{x:512,y:256},512,512);
  assert.equal(result.cells,128*128);assert.equal(result.windows,16);
  assert.equal(ctx.rectangles.length,512,'flat saved windows batch each row, reducing16384 terrain calls to512');
  assert.equal(ctx.rectangles.reduce((area,r)=>area+r.w*r.h,0),512*512,'the same complete visible area is covered');
  const colors=new Set(ctx.rectangles.map(r=>r.color));assert.equal(colors.size,2,'different serialized altitudes appear differently');
  for(const r of ctx.rectangles){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=512&&r.y+r.h<=512);assert.ok(r.w>0&&r.w%NATIVE_ATLAS_CELL===0);assert.equal(r.h,NATIVE_ATLAS_CELL);}
  const partial=context();assert.equal(paintNativeAtlas(partial,scene,{x:514,y:258},13,11).cells,15);
  assert.ok(partial.rectangles.every(r=>r.x<13&&r.y<11&&r.x+r.w>0&&r.y+r.h>0));
});
test('batched terrain keeps every altitude bin and partial-camera cell colour without new buffers',()=>{
  const vertices=new Uint8Array(33*33*9),view=new DataView(vertices.buffer);
  const heights=[-1000,-32,0,15,16,31,32,64,10000,NaN,Infinity,-Infinity];
  for(let y=0;y<33;++y)for(let x=0;x<33;++x)view.setFloat32((y*33+x)*9,heights[(Math.floor(x/3)+y)%heights.length],true);
  const scene={active:new Map([['0,0',{x:0,y:0,realmKey:'0_0',vertices}]])};
  const before=vertices.slice(),camera={x:35.5,y:28.25},width=73,height=41;
  const ctx=context(),result=paintNativeAtlas(ctx,scene,camera,width,height);
  let expectedCells=0;
  for(let y=0;y<32;++y)for(let x=0;x<32;++x){
    const dx=x*4-camera.x+width/2,dy=y*4-camera.y+height/2;
    if(dx>=width||dy>=height||dx+4<=0||dy+4<=0)continue;
    ++expectedCells;
    const altitude=view.getFloat32((y*33+x)*9,true);
    const bin=Math.max(0,Math.min(31,Math.floor(8+altitude/16)));
    const expected=Number.isFinite(altitude)?`hsl(${150-bin*2} 22% ${21+bin}%)`:'#925b87';
    const covering=ctx.rectangles.filter(r=>dx>=r.x&&dy===r.y&&dx+4<=r.x+r.w&&r.h===4);
    assert.equal(covering.length,1,'every intersecting cell belongs to exactly one row rectangle');
    assert.equal(covering[0].color,expected);
  }
  assert.equal(result.cells,expectedCells);assert.ok(ctx.rectangles.length<expectedCells);
  assert.deepEqual(vertices,before);
});
test('nonfinite serialized heights receive an explicit unavailable color without new terrain allocations',async()=>{
  const f=fixture();f.select('0_0',NaN);
  const scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(f.io)));await scene.move(64,64,128,128);
  const bytes=scene.activeBytes,ctx=context();paintNativeAtlas(ctx,scene,{x:256,y:256},512,512);
  assert.ok(ctx.rectangles.every(r=>r.color==='#925b87'));assert.equal(scene.activeBytes,bytes);
});
test('browser entry selects only named Majesty profiles, never creates directories and uses the engine world lock',async()=>{
  const calls=[],missing=()=>Object.assign(new Error('missing'),{name:'NotFoundError'});
  const directory=path=>({async getDirectoryHandle(name,options){assert.equal(options,undefined);calls.push({directory:path+'/'+name});return directory(path+'/'+name);},
    async getFileHandle(name,options){assert.equal(options,undefined);calls.push({file:path+'/'+name});throw missing();}});
  const storage={async getDirectory(){return directory('');}},locks={async request(name,options,fn){calls.push({lock:name,...options});return fn({});}};
  const scene=await openNativeAtlas('our-world',{storage,locks});await scene.move(64,64,128,128);
  assert.equal(calls.find(c=>c.lock).lock,'majesty-pair-native-world-our-world');
  assert.ok(calls.filter(c=>c.lock).every(c=>c.mode==='shared'&&c.ifAvailable===true));
  assert.deepEqual(calls.slice(0,2),[{directory:'/majesty'},{directory:'/majesty/profile'}]);
  assert.ok(calls.filter(c=>c.file).every(c=>c.file.startsWith('/majesty/profile/native-world-our-world/frontier_')));
  const before=calls.length;await assert.rejects(openNativeAtlas('../other',{storage,locks}),/world name/);assert.equal(calls.length,before);
});

const viewSource=await readFile(viewRoot?`${viewRoot}/view.mjs`:new URL('../web/world/view.mjs',import.meta.url),'utf8');
async function viewFixture({search='?world=our-world',fail=false,saved=null,hideDuringJourney=false}={}){
  const f=fixture();f.select('0_0',32,'saved-assets',[{family:'BLDG',id:10,x:20,y:20},{family:'VHCL',id:11,owner:1,x:40,y:20}]);
  let opens=0,scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(f.io),{includeUnits:true}));
  const nodes=new Map(),frames=[],events=new Map(),writes=[],navigations=[],backups=[],catalogs=[],heroes=[];
  let failCamera=false,opening=null;
  const ctx={setTransform(){},fillRect(){},beginPath(){},arc(){},fill(){},strokeRect(){},moveTo(){},lineTo(){},stroke(){},fillText(){}};
  for(const id of ['world','stats','notice','x','y','native','west','east','north','south','home','build','terrain','travel','map-info']){
    nodes.set('#'+id,{style:{},disabled:id==='terrain',textContent:id==='terrain'?'Show saved Majesty terrain':'',value:0,
      getContext:()=>ctx,setPointerCapture(){},removeAttribute(name){delete this[name];},hasAttribute(name){return name in this;}});
  }
  const store={readTransactions:0,async read(){return saved;},async readMany(keys){++this.readTransactions;return new Map(keys.map(k=>[k,null]));},async write(key,value){if(failCamera&&key==='camera-v1')throw new Error('camera quota');writes.push({key,value});}};
  const sandbox={...streaming,BrowserRegionStore:{open:async()=>store},nativeRegionURL,selectedAtlasRegion,tileBounds,paintGeneratedWorld,commitTravel,CameraCheckpointWriter,selectedWorld,NATIVE_ATLAS_CELL,NATIVE_ATLAS_SPAN,
    openNativeAtlas:async()=>{++opens;if(fail)throw new Error('storage denied');if(opening){opening.entered.resolve();await opening.finish.promise;}return scene;},moveNativeAtlas,paintNativeAtlas,
    initializeRegionBackups(options){options.closed=0;backups.push(options);return {async close(){++options.closed;}};},
    initializeHeroJourneys(options){options.closed=0;heroes.push(options);return {async close(){++options.closed;}};},
    initializeRealmCatalog(options){options.closed=0;catalogs.push(options);return {async close(){++options.closed;}};},
    initializeJourney:async()=>{if(hideDuringJourney)events.get('pagehide')();},
    document:{querySelector:key=>nodes.get(key),querySelectorAll:()=>[...nodes.values()]},location:{search,href:'http://localhost:8000/world/'+search,replace(url){navigations.push(String(url));}},
    innerWidth:1920,innerHeight:1080,devicePixelRatio:1,requestAnimationFrame(fn){frames.push(fn);},addEventListener(name,fn){events.set(name,fn);}};
  // Evaluate the shipped module and its handlers, retaining only a test await
  // handle. The production scene/renderer and RegionStream remain unchanged.
  const handle=await runInNewContext('(async()=>{'+viewSource.replace(/^import .*;\n/gm,'')+'\nreturn {settled:()=>!busy,flushCamera:()=>cameraWriter.flush()};})()',sandbox);
  function paint(){while(frames.length)frames.shift()();}
  paint();await handle.flushCamera();
  return {nodes,writes,navigations,backups,catalogs,heroes,f,store,get opens(){return opens;},get scene(){return scene;},get frames(){return frames.length;},
    failCamera(){failCamera=true;},restoreCamera(){failCamera=false;},
    hide(){events.get('pagehide')();},
    delayOpening(){opening={entered:deferred(),finish:deferred()};return opening;},
    async toggle(){await nodes.get('#terrain').onclick();paint();},
    async settle(){paint();for(let i=0;i<50&&!handle.settled();++i)await new Promise(resolve=>setImmediate(resolve));assert.ok(handle.settled());paint();await handle.flushCamera();},
    resize(w,h){sandbox.innerWidth=w;sandbox.innerHeight=h;events.get('resize')();},
    clickNative(){return nodes.get('#native').onclick({preventDefault(){},currentTarget:nodes.get('#native')});},
    failReading(){f.files.get('Frontier_0_0.GMP')[0]^=1;},
    restoreReading(){f.select('0_0',32);},
    resetScene(){scene=new NativeTerrainScene(realmTerrainProvider(savedAtlasStore(f.io),{includeUnits:true}));}};
}
test('leaving the world closes catalog controls, reduces canvas backing dimensions and blocks stale selections',async()=>{
  const ui=await viewFixture();assert.equal(ui.catalogs.length,1);
  assert.ok(ui.nodes.get('#world').width>1);ui.hide();
  assert.equal(ui.catalogs[0].closed,1);assert.equal(ui.nodes.get('#world').width,1);assert.equal(ui.nodes.get('#world').height,1);
  assert.equal(ui.backups[0].closed,1);
  assert.equal(ui.heroes[0].closed,1);
  await assert.rejects(ui.catalogs[0].onSelect(2,3),/World view closed/);assert.equal(ui.opens,0);
  ui.hide();assert.equal(ui.catalogs[0].closed,1);assert.equal(ui.backups[0].closed,1);assert.equal(ui.heroes[0].closed,1);
});
test('departure during journey initialization cannot create new map controls',async()=>{
  const ui=await viewFixture({hideDuringJourney:true});assert.equal(ui.catalogs.length,0);assert.equal(ui.backups.length,0);assert.equal(ui.heroes.length,0);
  assert.equal(ui.nodes.get('#world').width,1);assert.equal(ui.nodes.get('#world').height,1);
});
test('departed map handlers cannot restart map work, resize backing storage or change notices',async()=>{
  const ui=await viewFixture(),canvas=ui.nodes.get('#world');
  ui.nodes.get('#build').onclick();const notice=ui.nodes.get('#notice').textContent;
  ui.hide();const writes=ui.writes.length,reads=ui.store.readTransactions;
  ui.nodes.get('#build').onclick();await canvas.onpointerdown({clientX:100,clientY:100,pointerId:1});
  ui.nodes.get('#east').onclick();ui.resize(3840,2160);await ui.toggle();await ui.settle();
  assert.equal(ui.nodes.get('#notice').textContent,notice);assert.equal(ui.writes.length,writes);
  assert.equal(ui.store.readTransactions,reads);assert.equal(ui.opens,0);
  assert.equal(canvas.width,1);assert.equal(canvas.height,1);
});
test('shipped saved destination selection loads distant native terrain and preserves world-specific play links',async()=>{
  const ui=await viewFixture();assert.equal(ui.catalogs.length,1);assert.equal(ui.catalogs[0].getWorld(),'our-world');
  ui.f.select('39_-2',96,'saved-assets',[{family:'BLDG',id:50,x:20,y:20}]);
  await ui.catalogs[0].onSelect(39,-2);await ui.settle();
  assert.match(ui.nodes.get('#stats').textContent,/Region 39, -2 · saved altitude map/);
  assert.ok([...ui.scene.active.values()].some(w=>w?.realmKey==='39_-2'));
  assert.ok(ui.scene.active.size<=49);assert.ok(ui.scene.residentHighWater<=98);
  const url=new URL(ui.nodes.get('#native').href);assert.equal(url.searchParams.get('world'),'our-world');
  assert.equal(url.searchParams.get('profile'),'frontier_39_-2');assert.equal(ui.navigations.length,0);
});
test('selecting the displayed saved kingdom refreshes its terrain while pointer panning retains the captured view',async()=>{
  const ui=await viewFixture();await ui.toggle();
  const old=ui.scene.active.get('0,0'),opens=ui.f.calls.length;
  assert.equal(new DataView(old.vertices.buffer).getFloat32(0,true),32);
  ui.f.select('0_0',96,'saved-assets',[{family:'BLDG',id:51,x:20,y:20,owner:1}]);
  const canvas=ui.nodes.get('#world');
  canvas.onpointerdown({pointerId:1,clientX:0,clientY:0});
  canvas.onpointermove({pointerId:1,clientX:-5,clientY:0});
  canvas.onpointerup({pointerId:1});await ui.settle();
  assert.equal(ui.f.calls.length,opens,'ordinary panning performs no saved-world I/O');
  assert.equal(ui.scene.active.get('0,0'),old);
  await ui.catalogs[0].onSelect(0,0);await ui.settle();
  assert.ok(ui.f.calls.length>opens,'explicit saved selection verifies the current checkpoint');
  const fresh=ui.scene.active.get('0,0');assert.notEqual(fresh,old);
  assert.equal(new DataView(fresh.vertices.buffer).getFloat32(0,true),96);
  assert.equal(fresh.markers[0],51);assert.equal(fresh.markers[1],1);
  assert.ok(ui.scene.active.size<=49);assert.ok(ui.scene.residentHighWater<=98);
  assert.equal(ui.navigations.length,0);assert.ok(ui.writes.every(w=>w.key==='camera-v1'));
});
test('refreshing the displayed saved kingdom refuses damaged bytes and preserves its complete view',async()=>{
  const ui=await viewFixture();await ui.toggle();
  const previous=ui.scene.active,link=ui.nodes.get('#native').href,opens=ui.f.calls.length;
  ui.failReading();
  await assert.rejects(ui.catalogs[0].onSelect(0,0),/Map travel did not complete/);await ui.settle();
  assert.ok(ui.f.calls.length>opens);assert.equal(ui.scene.active,previous);
  assert.equal(ui.nodes.get('#native').href,link);assert.equal(ui.navigations.length,0);
  assert.match(ui.nodes.get('#notice').textContent,/Travel stopped.*Damaged/);
});
test('shipped page departure closes a saved atlas even when it is still opening',{timeout:10000},async()=>{
  const ui=await viewFixture(),opening=ui.delayOpening(),toggles=ui.toggle();
  await opening.entered.promise;ui.hide();opening.finish.resolve();await toggles;
  assert.equal(ui.scene.closed,true);assert.equal(ui.scene.residentBytes,0);
  assert.equal(ui.f.calls.filter(c=>c.file).length,0);
  await ui.toggle();ui.resize(800,600);await ui.settle();
  assert.equal(ui.opens,1);assert.equal(ui.frames,0);assert.equal(ui.navigations.length,0);
});
test('shipped page departure cancels actual saved-world hashing before it paints',{timeout:10000},async()=>{
  const ui=await viewFixture(),entered=deferred(),finish=deferred(),original=ui.f.io.open;
  let blocked=false,reads=0;
  ui.f.io.open=async name=>{
    const file=await original(name);if(!file)return null;
    return {size:file.size,async readAt(at,n){
      ++reads;if(!blocked&&name.endsWith('.GMP')){blocked=true;entered.resolve();await finish.promise;}
      return file.readAt(at,n);
    }};
  };
  const toggles=ui.toggle();await entered.promise;ui.hide();
  let released=false;const closing=ui.scene.close();closing.then(()=>{released=true;});
  const before=reads;await Promise.resolve();assert.equal(ui.f.busy,true);assert.equal(released,false);
  finish.resolve();await Promise.all([toggles,closing]);
  assert.equal(reads,before);assert.equal(ui.f.busy,false);assert.equal(ui.scene.residentBytes,0);
  assert.doesNotMatch(ui.nodes.get('#stats').textContent,/saved altitude map/);
  assert.equal(ui.navigations.length,0);assert.equal(ui.frames,0);
});
test('shipped saved destination selection reports a failed terrain load without launching a game',async()=>{
  const ui=await viewFixture({fail:true});
  await assert.rejects(ui.catalogs[0].onSelect(-21,3),/Saved terrain could not be loaded/);await ui.settle();
  assert.equal(ui.navigations.length,0);assert.match(ui.nodes.get('#notice').textContent,/storage denied/);
});
test('shipped backup wiring follows the committed camera rather than unsubmitted travel fields',async()=>{
  const ui=await viewFixture();assert.equal(ui.backups.length,1);
  const options=ui.backups[0];assert.equal(options.base,'http://localhost:8000/world/?world=our-world');
  assert.equal(options.getCurrent().world,'our-world');assert.equal(options.getCurrent().x,0);assert.equal(options.getCurrent().y,0);
  ui.nodes.get('#x').value=99;ui.nodes.get('#y').value=99;assert.equal(options.getCurrent().x,0);
  ui.nodes.get('#east').onclick();await ui.settle();assert.equal(options.getCurrent().x,1);assert.equal(options.getCurrent().y,0);
});
test('shipped pointer handling loads only the final destination in a frame and saves it on release',async()=>{
  const ui=await viewFixture(),canvas=ui.nodes.get('#world'),reads=ui.store.readTransactions,writes=ui.writes.length;
  canvas.onpointerdown({pointerId:1,clientX:0,clientY:0});
  for(let i=1;i<=1000;++i)canvas.onpointermove({pointerId:1,clientX:-i*10,clientY:0});
  assert.equal(ui.frames,1);assert.equal(ui.store.readTransactions,reads);assert.equal(ui.writes.length,writes);
  await ui.settle();
  assert.equal(ui.store.readTransactions,reads+1,'one footprint load, rather than a read batch per pointer event');
  assert.deepEqual(ui.writes.at(-1).value,{x:10256,y:256});
  canvas.onpointermove({pointerId:1,clientX:-11000,clientY:0});
  canvas.onpointerup({pointerId:1});await ui.settle();
  assert.deepEqual(ui.writes.at(-1).value,{x:11256,y:256});
  assert.match(ui.nodes.get('#stats').textContent,/Region 21, 0/);
});
test('camera write failure leaves the committed map playable and retries the newest position',async()=>{
  const ui=await viewFixture();ui.failCamera();
  ui.nodes.get('#east').onclick();await assert.rejects(ui.settle(),/camera quota/);
  assert.match(ui.nodes.get('#stats').textContent,/Region 1, 0/);
  assert.match(ui.nodes.get('#notice').textContent,/view position could not be saved.*camera quota/);
  assert.equal(ui.nodes.get('#build').disabled,false);
  ui.restoreCamera();ui.nodes.get('#east').onclick();await ui.settle();
  assert.deepEqual(ui.writes.at(-1).value,{x:1280,y:256});
  assert.equal(ui.nodes.get('#notice').textContent,'');
});
test('a delayed camera failure does not erase a newer world action error',async()=>{
  const ui=await viewFixture();ui.failCamera();
  ui.nodes.get('#east').onclick();
  await new Promise(resolve=>setImmediate(resolve));
  ui.nodes.get('#notice').textContent='Travel stopped: read failed. Saved regions are preserved.';
  await assert.rejects(ui.settle(),/camera quota/);
  assert.equal(ui.nodes.get('#notice').textContent,'Travel stopped: read failed. Saved regions are preserved.');
  ui.restoreCamera();await ui.settle();
});
test('shipped Frontier controls switch saved-map mode, preserve native region links and keep 4K buffers bounded',async()=>{
  const ui=await viewFixture();assert.equal(ui.nodes.get('#terrain').disabled,false);
  await ui.toggle();
  assert.match(ui.nodes.get('#stats').textContent,/saved altitude map.*one canvas/);
  assert.match(ui.nodes.get('#map-info').textContent,/building squares.*unit markers/);
  assert.equal([...ui.scene.active.values()].filter(Boolean).reduce((n,w)=>n+w.markers.length/5,0),2);
  assert.equal(ui.nodes.get('#build').disabled,true);assert.equal(ui.opens,1);
  assert.ok(ui.nodes.get('#world').width<=4096&&ui.nodes.get('#world').height<=4096);
  ui.resize(3840,2160);await ui.settle();
  assert.equal(ui.nodes.get('#world').width,3840);assert.equal(ui.nodes.get('#world').height,2160);
  assert.ok(ui.scene.active.size<=49);assert.ok(ui.scene.residentBytesHighWater<=1462258);
  ui.nodes.get('#x').value=1;ui.nodes.get('#y').value=0;
  ui.nodes.get('#travel').onsubmit({preventDefault(){}});await ui.settle();
  assert.match(ui.nodes.get('#stats').textContent,/Region 1, 0/);
  await ui.clickNative();
  const native=new URL(ui.navigations[0]);assert.equal(native.searchParams.get('world'),'our-world');assert.equal(native.searchParams.get('RECOMP_RULE_FRONTIER_REGION'),'1_0');
  const oldScene=ui.scene,oldView=oldScene.active,oldIterator=oldView.values();
  await ui.toggle();assert.equal(ui.nodes.get('#build').disabled,false);
  assert.equal(oldScene.closed,true);assert.equal(oldScene.residentBytes,0);
  assert.equal(oldView.size,0);assert.deepEqual(oldIterator.next(),{done:true,value:undefined});
  await assert.rejects(moveNativeAtlas(oldScene,128,64,128,128),/scene closed/);
  assert.doesNotMatch(ui.nodes.get('#stats').textContent,/saved altitude map/);
  ui.resetScene();await ui.toggle();assert.equal(ui.opens,2,'the released native scene is reconstructed when selected again');
  assert.ok(ui.writes.every(w=>w.key==='camera-v1'),'saved-map navigation never writes native checkpoints or experiment buildings');
});
test('failed saved-map selection keeps the generated view and its controls intact',async()=>{
  const ui=await viewFixture({fail:true}),stats=ui.nodes.get('#stats').textContent;
  await ui.toggle();
  assert.equal(ui.nodes.get('#stats').textContent,stats);assert.equal(ui.nodes.get('#build').disabled,false);
  assert.match(ui.nodes.get('#notice').textContent,/Map view unchanged: storage denied/);
  assert.equal(ui.nodes.get('#terrain').textContent,'Show saved Majesty terrain');
});
test('failed native movement leaves the camera, selected region link and complete scene unchanged',async()=>{
  const ui=await viewFixture();await ui.toggle();const scene=ui.scene.active,link=String(ui.nodes.get('#native').href);
  ui.failReading();ui.nodes.get('#east').onclick();await ui.settle();
  assert.equal(ui.scene.active,scene);assert.equal(String(ui.nodes.get('#native').href),link);
  assert.match(ui.nodes.get('#notice').textContent,/Travel stopped.*Damaged/);
  ui.restoreReading();ui.nodes.get('#east').onclick();await ui.settle();
  assert.match(ui.nodes.get('#stats').textContent,/Region 1, 0/);
});
test('the unnamed experiment cannot open a native saved-map profile',async()=>{
  const ui=await viewFixture({search:''});assert.equal(ui.nodes.get('#terrain').disabled,true);
  await ui.toggle();assert.equal(ui.opens,0);assert.doesNotMatch(ui.nodes.get('#stats').textContent,/saved altitude map/);
});
test('returning from a distant kingdom centers the atlas there instead of restoring an old camera',async()=>{
  const ui=await viewFixture({search:'?world=our-world&at=-20_31',saved:{x:256,y:256}});
  assert.match(ui.nodes.get('#stats').textContent,/Region -20, 31/);
  assert.equal(ui.nodes.get('#x').value,-20);assert.equal(ui.nodes.get('#y').value,31);
  assert.equal(new URL(ui.nodes.get('#native').href).searchParams.get('RECOMP_RULE_FRONTIER_REGION'),'-20_31');
  assert.deepEqual(JSON.parse(JSON.stringify(ui.writes.at(-1))),{key:'camera-v1',value:{x:-20*512+256,y:31*512+256}});
  const remembered=await viewFixture({saved:{x:5*512+256,y:-3*512+256}});
  assert.match(remembered.nodes.get('#stats').textContent,/Region 5, -3/);
});
