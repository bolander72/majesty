// Bounded Node/V8 reachability probe of actual scene handoffs. No browser/OPFS.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {setImmediate} from 'node:timers/promises';
import {NativeTerrainScene,MAX_NATIVE_ACTIVE_WINDOWS} from '../web/world/terrain-scene.mjs';

if(typeof global.gc!=='function')throw new Error('Run with node --expose-gc');
const output=new URL('../output/scene-view-retention-observed.json',import.meta.url);
await rm(output,{force:true});
const refs=[],views=[],iterators=[],methods=[],callbacks=[];
let gateCleanup=false,beginCleanup,releaseCleanup;
const cleanupStarted=new Promise(resolve=>{beginCleanup=resolve;}),cleanup=new Promise(resolve=>{releaseCleanup=resolve;});
const provider={async withSnapshot(consume){
  callbacks.push(consume);
  await consume({identity:'same revision',async readWindow(wx,wy){
    const vertices=new Uint8Array(33*33*9),cells=new Uint8Array(32*32*5);
    refs.push(new WeakRef(vertices.buffer),new WeakRef(cells.buffer));
    return {x:0,y:0,width:32,height:32,realmKey:`${wx}_${wy}`,vertices,cells};
  }});
  if(gateCleanup){beginCleanup();await cleanup;}
}};
const scene=new NativeTerrainScene(provider);
await scene.move(16,16,128,128);
for(let cycle=1;cycle<=4;++cycle){
  const old=scene.active;views.push(old);methods.push(old.get,old.values);
  iterators.push(old.keys(),old.values(),old.entries(),old[Symbol.iterator]());
  const begun=old.entries();assert.equal(begun.next().done,false);iterators.push(begun);
  await scene.move(cycle*8192+16,16,128,128);
  assert.equal(old.size,0);assert.equal(old.get('0,0'),undefined);
}
assert.equal(refs.length,5*49*2);
assert.equal(scene.active.size,MAX_NATIVE_ACTIVE_WINDOWS);

function capturedMapControl(){
  const value=new Uint8Array(32),weak=new WeakRef(value),map=new Map([['old',value]]);
  return {weak,view:{get:key=>map.get(key)}};
}
function clearedIteratorControl(){
  const value=new Uint8Array(32),weak=new WeakRef(value),map=new Map([['old',value]]);
  const iterator=map.values();map.clear();return {weak,iterator};
}
const captured=capturedMapControl(),cleared=clearedIteratorControl();
const retired=refs.slice(0,4*49*2),current=refs.slice(4*49*2);
let collected=0,passes=0;
for(;passes<8;++passes){
  await setImmediate();global.gc();await setImmediate();
  collected=retired.filter(ref=>ref.deref()===undefined).length;
  if(collected===retired.length){++passes;break;}
}
assert.equal(collected,392,'Expired actual scene views retained terrain buffers');
for(const iterator of iterators)assert.deepEqual(iterator.next(),{done:true,value:undefined});
assert.ok(current.every(ref=>ref.deref()!==undefined),'Current scene lost owned buffers');
assert.notEqual(captured.weak.deref(),undefined,'Captured-map negative control should retain its value');
assert.notEqual(cleared.weak.deref(),undefined,'A raw iterator over a cleared Map should retain its old table in this V8');
assert.equal(views.length,4);assert.equal(iterators.length,20);assert.equal(methods.length,8);assert.equal(callbacks.length,5);
assert.equal(typeof methods[0],'function');assert.equal(typeof callbacks[0],'function');
assert.equal(typeof captured.view.get,'function');assert.equal(typeof cleared.iterator.next,'function');
// Keep the last published view and fresh, unadvanced iterators while closing
// a fully staged replacement. Neither scene may publish after shutdown.
views.push(scene.active);methods.push(scene.active.get,scene.active.values);
const closedIterators=[scene.active.keys(),scene.active.values(),scene.active.entries(),scene.active[Symbol.iterator]()];
const begun=scene.active.entries();assert.equal(begun.next().done,false);closedIterators.push(begun);
iterators.push(...closedIterators);
gateCleanup=true;
const moving=scene.move(65536,16,128,128);await cleanupStarted;
const rejected=assert.rejects(moving,/scene closed/),closed=scene.close();
assert.equal(scene.active.size,0);assert.equal(scene.residentWindows,98);
releaseCleanup();await Promise.all([rejected,closed]);
assert.equal(scene.residentWindows,0);assert.equal(scene.residentBytes,0);
assert.equal(scene.identity,null);assert.equal(scene.closed,true);
assert.equal(refs.length,6*49*2);
let closedCollected=0,closePasses=0;
for(;closePasses<8;++closePasses){
  await setImmediate();global.gc();await setImmediate();
  closedCollected=refs.slice(4*49*2).filter(ref=>ref.deref()===undefined).length;
  if(closedCollected===196){++closePasses;break;}
}
assert.equal(closedCollected,196,'Closed active and unpublished scenes retained terrain buffers');
assert.ok(refs.every(ref=>ref.deref()===undefined));
for(const iterator of closedIterators)assert.deepEqual(iterator.next(),{done:true,value:undefined});
assert.equal(views.at(-1).size,0);assert.equal(methods.at(-2)('0,0'),undefined);
assert.notEqual(captured.weak.deref(),undefined);assert.notEqual(cleared.weak.deref(),undefined);
const sources=['web/world/scene-view.mjs','web/world/terrain-scene.mjs','scripts/check-scene-view-retention.mjs'];
const sourceSha256={};for(const name of sources)sourceSha256[name]=createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex');
const report={qualified:true,scope:'Node/V8 backing-buffer reachability after actual scene publication and closure',
  nodeVersion:process.versions.node,v8Version:process.versions.v8,scenePublications:5,
  retainedRetiredViews:4,retainedIterators:20,retainedBoundMethods:8,retainedProviderCallbacks:5,
  observedBackingBuffers:588,collectedRetiredBackingBuffers:collected,currentBackingBuffersReachableBeforeClose:98,
  closedSceneBackingBuffersCollected:closedCollected,totalBackingBuffersCollectedAfterClose:588,
  retainedViewsAfterClose:5,retainedIteratorsAfterClose:25,retainedBoundMethodsAfterClose:10,
  retainedProviderCallbacksAfterClose:6,closeGcPasses:closePasses,
  closeDrainedSnapshotCleanup:true,closedSceneIteratorsNotAdvancedUntilAfterGarbageCollection:true,
  gcPasses:passes,capturedMapControlStillRetainsValue:true,clearedRawIteratorControlStillRetainsValue:true,
  retiredIteratorsNotAdvancedUntilAfterGarbageCollection:true,
  payloadBytesPerWindow:33*33*9+32*32*5,sceneResidentBytesHighWater:scene.residentBytesHighWater,
  sourceSha256,browserInspected:false,opfsAccessed:false,gameLaunched:false,nativeBuildRun:false,
  browserMemoryMeasured:false,crashResolved:false,liveNativePagingQualified:false};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,collectedRetiredBackingBuffers:collected,
  retainedRetiredViews:4,retainedIterators:20,totalBackingBuffersCollectedAfterClose:588,gameLaunches:0}));
