import test from 'node:test';
import assert from 'node:assert/strict';
import {recordJourney,recordJourneyArrival,parseJourney,JOURNEY_KEY,MAX_JOURNEY_BYTES} from '../web/world/journey.mjs';
import {initializeJourney} from '../web/world/journey-controls.mjs';
import {nativeRegionURL,atlasURL} from '../web/world/region.mjs';
import {BrowserRegionStore} from '../web/world/stream.mjs';

const content='a'.repeat(64)+':'+'b'.repeat(64);
const base=nativeRegionURL(0,0,'http://localhost:8000/world/?world=journey&RECOMP_MEMORY_DEBUG=1').href;
const target=nativeRegionURL(0,1,base).href;
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const values=new Map(),calls=[];let held=false,deny=false,closeCount=0;
  async function open(world,options){
    calls.push(['open',world,options]);if(held)throw Error('world busy');held=true;
    return {
      async read(key){calls.push(['read',key]);return values.get(key);},
      async write(key,text){calls.push(['write',key,text]);if(deny)throw Error('quota');values.set(key,text);},
      close(){++closeCount;held=false;},
    };
  }
  return {open,values,calls,get closeCount(){return closeCount;},get held(){return held;},deny(){deny=true;}};
}
test('confirmed departure records signed adjacent coordinates and original content; arrival changes only status',async()=>{
  const f=fixture();
  await recordJourney(target,{base,content,open:f.open});
  const pending=parseJourney(f.values.get(JOURNEY_KEY),'journey');
  assert.deepEqual(pending,{version:1,world:'journey',source:{x:0,y:0},target:{x:0,y:1},state:'pending',content});
  await recordJourneyArrival({search:new URL(target).search,content,open:f.open});
  assert.deepEqual(parseJourney(f.values.get(JOURNEY_KEY),'journey'),{...pending,state:'active'});
  assert.equal(f.closeCount,2);assert.equal(f.held,false);
  const negative=nativeRegionURL(-2,-3,base).href;
  await recordJourney(nativeRegionURL(-2,-4,negative).href,{base:negative,content,open:f.open});
  assert.deepEqual(parseJourney(f.values.get(JOURNEY_KEY),'journey').target,{x:-2,y:-4});
  assert.ok(f.calls.filter(x=>x[0]==='open').every(x=>x[1]==='journey'&&x[2].nativeWorld===true));
});
test('returning to the atlas remembers the current saved region and needs no arrival confirmation',async()=>{
  const f=fixture();await recordJourney(atlasURL(base).href,{base,content,open:f.open});
  const saved=parseJourney(f.values.get(JOURNEY_KEY),'journey');
  assert.equal(saved.state,'active');assert.deepEqual(saved.target,saved.source);
  const before=f.values.get(JOURNEY_KEY);await recordJourneyArrival({search:new URL(base).search,content,open:f.open});
  assert.equal(f.values.get(JOURNEY_KEY),before);assert.equal(f.calls.filter(x=>x[0]==='write').length,1);
});
test('different world, origin, profile, content, non-neighbor and ambiguous destinations cannot open storage',async()=>{
  const f=fixture();
  const changes=[target.replace('world=journey','world=elsewhere'),target.replace('localhost:8000','elsewhere.test'),
    target.replace('frontier_0_1','personal'),target+'&world=elsewhere',nativeRegionURL(1,1,base).href,nativeRegionURL(0,0,base).href,
    target+'&RECOMP_RULE_FRONTIER_CHAPTER=1',target+'&relay=other',target.replace('/majesty/','/different/')];
  for(const destination of changes)await assert.rejects(recordJourney(destination,{base,content,open:f.open}));
  for(const changed of [undefined,'bad','A'.repeat(64)+':'+'b'.repeat(64)])await assert.rejects(recordJourney(target,{base,content:changed,open:f.open}));
  assert.equal(f.calls.length,0);
  for(const extra of ['&RECOMP_RULE_FRONTIER_TRANSFER=1','&RECOMP_PROFILE_DIR=personal','&RECOMP_BROWSER_FRONTIER_TRANSFER_ACTION=commit']){
    await assert.rejects(recordJourney(target,{base:base+extra,content,open:f.open}));
    await assert.rejects(recordJourneyArrival({search:new URL(base+extra).search,content,open:f.open}));
  }
  assert.equal(f.calls.length,0);
  await recordJourney('http://localhost/world/',{base:'http://localhost/majesty/',open:f.open});
  await recordJourneyArrival({search:'',open:f.open});assert.equal(f.calls.length,0,'legacy regions perform no new storage I/O');
});
test('incorrect arrival coordinate and content never replace the pending trip',async()=>{
  const f=fixture();await recordJourney(target,{base,content,open:f.open});const before=f.values.get(JOURNEY_KEY);
  await recordJourneyArrival({search:new URL(base).search,content,open:f.open});assert.equal(f.values.get(JOURNEY_KEY),before);
  await assert.rejects(recordJourneyArrival({search:new URL(target).search,content:'c'.repeat(64)+':'+'d'.repeat(64),open:f.open}),/original game content/);
  assert.equal(f.values.get(JOURNEY_KEY),before);assert.equal(f.held,false);
});
test('failed metadata write closes its lease, preserves the previous trip and does not touch kingdom bytes',async()=>{
  const f=fixture();await recordJourney(target,{base,content,open:f.open});const before=f.values.get(JOURNEY_KEY);
  const sentinel={kingdom:'unchanged'};f.values.set('0,0',sentinel);f.deny();
  await assert.rejects(recordJourney(nativeRegionURL(1,0,base).href,{base,content,open:f.open}),/quota/);
  assert.equal(f.values.get(JOURNEY_KEY),before);assert.equal(f.values.get('0,0'),sentinel);assert.equal(f.closeCount,2);assert.equal(f.held,false);
  await assert.rejects(recordJourneyArrival({search:new URL(target).search,content,open:f.open}),/quota/);
  assert.equal(f.values.get(JOURNEY_KEY),before);assert.equal(f.closeCount,3);
});
test('malformed and incompatible metadata are refused without silently replacing it',async()=>{
  const f=fixture();await recordJourney(target,{base,content,open:f.open});const valid=f.values.get(JOURNEY_KEY),record=JSON.parse(valid);
  for(const text of [null,{},'x'.repeat(MAX_JOURNEY_BYTES+1),'broken',JSON.stringify({...record,world:'other'}),
    JSON.stringify({...record,version:2}),JSON.stringify({...record,unexpected:true}),JSON.stringify({...record,target:{x:2,y:2}}),
    JSON.stringify({...record,source:{x:1000001,y:0}}),JSON.stringify({...record,source:{x:0,y:0,extra:1}}),
    JSON.stringify({...record,state:'completed'}),JSON.stringify({...record,content:'bad'})])assert.throws(()=>parseJourney(text,'journey'));
  f.values.set(JOURNEY_KEY,'broken');await assert.rejects(recordJourneyArrival({search:new URL(target).search,content,open:f.open}));
  assert.equal(f.values.get(JOURNEY_KEY),'broken');assert.equal(f.held,false);
});
test('many region trips retain one bounded record and release every metadata store',async()=>{
  const f=fixture();let here=base;
  for(let i=0;i<1000;i++){
    const there=nativeRegionURL(i+1,0,here).href;await recordJourney(there,{base:here,content,open:f.open});
    await recordJourneyArrival({search:new URL(there).search,content,open:f.open});here=there;
    assert.equal(f.values.size,1);assert.ok(f.values.get(JOURNEY_KEY).length<=MAX_JOURNEY_BYTES);assert.equal(f.held,false);
  }
  assert.equal(f.closeCount,2000);assert.deepEqual(parseJourney(f.values.get(JOURNEY_KEY),'journey').target,{x:1000,y:0});
});
function ui(){
  const nodes=new Map(['source','target','status'].map(id=>['#journey-'+id,{hidden:false,href:'old',textContent:'old',removeAttribute(){delete this.href;}}]));
  return {document:{querySelector:id=>nodes.get(id)},source:nodes.get('#journey-source'),target:nodes.get('#journey-target'),status:nodes.get('#journey-status')};
}
test('Frontier offers both pending destinations and the saved source; each link preserves world and drops private relay settings',async()=>{
  const f=fixture(),u=ui(),destinations=[];await recordJourney(target,{base,content,open:f.open});
  await initializeJourney({...u,world:'journey',base:atlasURL(base).href+'&relay=private',store:{read:async key=>f.values.get(key)},navigate:async href=>destinations.push(href)});
  assert.equal(u.source.hidden,false);assert.equal(u.target.hidden,false);assert.match(u.status.textContent,/not confirmed arrival/);
  const destination=new URL(u.target.href);assert.equal(destination.searchParams.get('world'),'journey');assert.equal(destination.searchParams.has('relay'),false);
  assert.equal(destination.searchParams.get('RECOMP_RULE_FRONTIER_REGION'),'0_1');assert.equal(destination.searchParams.get('RECOMP_RULE_FRONTIER_RESTORE'),'1');
  await u.source.onclick({preventDefault(){}});assert.deepEqual(destinations,[nativeRegionURL(0,0,base).href]);
});
test('recovery links share one navigation flight and cannot launch both kingdoms',async()=>{
  const f=fixture(),u=ui();await recordJourney(target,{base,content,open:f.open});let resolve;const gate=new Promise(r=>resolve=r),destinations=[];
  await initializeJourney({...u,world:'journey',base:atlasURL(base).href,store:{read:async key=>f.values.get(key)},navigate:async href=>{destinations.push(href);await gate;}});
  const flight=u.target.onclick({preventDefault(){}});for(let i=0;i<100;i++)await u.source.onclick({preventDefault(){}});
  assert.equal(destinations.length,1);resolve();await flight;await u.source.onclick({preventDefault(){}});assert.equal(destinations.length,1);
});
test('active journey offers one region; malformed, missing and unnamed records expose no stale links',async()=>{
  const f=fixture();await recordJourney(atlasURL(base).href,{base,content,open:f.open});
  const active=ui();await initializeJourney({...active,world:'journey',base:atlasURL(base).href,store:{read:async()=>f.values.get(JOURNEY_KEY)},navigate:async()=>{throw Error('navigation failed');}});
  assert.equal(active.source.hidden,true);assert.equal(active.target.hidden,false);assert.match(active.status.textContent,/last visited.*last save/);
  await active.target.onclick({preventDefault(){}});assert.match(active.status.textContent,/navigation failed.*preserved/);
  for(const [world,text] of [['journey','broken'],['journey',undefined],[null,undefined]]){
    const u=ui();await initializeJourney({...u,world,base,store:{read:async()=>text},navigate:()=>assert.fail()});
    assert.equal(u.source.hidden,true);assert.equal(u.target.hidden,true);assert.equal(u.source.href,undefined);assert.equal(u.target.href,undefined);
  }
});
test('arrival in a fresh kingdom keeps the last saved source available until another saved departure replaces it',async()=>{
  const f=fixture(),u=ui();await recordJourney(target,{base,content,open:f.open});
  await recordJourneyArrival({search:new URL(target).search,content,open:f.open});
  await initializeJourney({...u,world:'journey',base:atlasURL(base).href,store:{read:async()=>f.values.get(JOURNEY_KEY)},navigate:async()=>{}});
  assert.equal(u.source.hidden,false);assert.equal(u.target.hidden,false);assert.match(u.target.textContent,/Open region 0, 1/);
  assert.match(u.source.textContent,/Reopen saved region 0, 0/);assert.match(u.status.textContent,/progress since the last save is not recorded/);
});
test('repeated metadata store opens remove pagehide listeners and release each lease exactly once',async()=>{
  const names=['navigator','indexedDB','addEventListener','removeEventListener'],original=Object.getOwnPropertyDescriptors(globalThis),listeners=new Set(),held=new Set();let closed=0,released=0;
  try{
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks:{async request(name,options,consume){
      assert.equal(options.ifAvailable,true);if(held.has(name))return consume(null);held.add(name);
      try{return await consume({});}finally{held.delete(name);++released;}
    }}}});
    globalThis.indexedDB={open(){const request={result:{close(){++closed;}}};queueMicrotask(()=>request.onsuccess());return request;}};
    globalThis.addEventListener=(name,fn)=>{assert.equal(name,'pagehide');listeners.add(fn);};
    globalThis.removeEventListener=(name,fn)=>{assert.equal(name,'pagehide');listeners.delete(fn);};
    for(let i=0;i<100;i++){
      const store=await BrowserRegionStore.open('journey',{nativeWorld:true});assert.equal(listeners.size,1);assert.equal(held.size,1);
      store.close();store.close();await turn();assert.equal(listeners.size,0);assert.equal(held.size,0);
    }
    assert.equal(closed,100);assert.equal(released,100);
  }finally{for(const name of names){if(original[name])Object.defineProperty(globalThis,name,original[name]);else delete globalThis[name];}}
});
