import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {requireSessionTrace} from '../scripts/inspect-native-region-session.mjs';
const moduleRoot=new URL(process.env.MAJESTY_DESTINATION_STAGED==='1'?'../upstream/majesty-recomp/build/web-site/world/':'../web/world/',import.meta.url);
const {selectedRegion,atlasURL,neighboringRegionURL}=await import(new URL('region.mjs',moduleRoot));
const {selectedWorld}=await import(new URL('world-name.mjs',moduleRoot));
const {nativeRegionSessionMode,startNativeWorldPlayer,advanceNativeWorldRegion,withNativeWorldNeighborRead}=await import(new URL('realm-session.mjs',moduleRoot));
const {NativeRegionSession}=await import(new URL('native-session-controls.mjs',moduleRoot));
const {completedHeroRestoreURL,nativeHeroRestoreConfig}=await import(new URL('hero-route-launch.mjs',moduleRoot));
const {NativeHeroSaveSession}=await import(new URL('hero-save-session.mjs',moduleRoot));

// Run the shipped DOM adapter, with a small document fixture, to exercise
// queued saves and late messages across actual result/menu/ready transitions.
const source=await readFile(new URL('native.mjs',moduleRoot),'utf8');
function controls(extra='',key='0_0',journey={}){
  const elements=[],events=new Map(),navigations=[],updates=[],activations=[];
  const createElement=tag=>{
    const node={tag,children:[],style:{},disabled:false,textContent:'',setAttribute(){},appendChild(child){this.children.push(child);return child;}};
    elements.push(node);return node;
  };
  const document={body:createElement('body'),createElement,addEventListener(name,fn){events.set(name,fn);}};
  const search=`?profile=frontier_${key}&RECOMP_RULE_FRONTIER_REGION=${key}`+extra;
  const location={href:'http://localhost:8000/majesty/'+search,search,replace(url){navigations.push(String(url));}};
  runInNewContext(source.replace(/^import .*;\n/gm,''),{AbortController,completedHeroRestoreURL,nativeHeroRestoreConfig,NativeHeroSaveSession,
    confirmNativeHeroGameReady:journey.heroReady||(()=>{}),queueNativeHeroGameSave:journey.heroQueue||(()=>{}),
    publishNativeHeroGameSave:journey.heroPublish||(()=>Promise.resolve({})),endNativeHeroGameSave:journey.heroEnd||(()=>Promise.resolve()),
    prepareNativeHeroTravel:journey.heroTravel|| (async(...args)=>{
      const admitted=await (journey.heroInspect||(()=>Promise.resolve({kind:'saved'})))(...args);
      args[3].signal.throwIfAborted();
      return admitted.kind==='saved'?await (journey.heroHome||(()=>Promise.resolve({kind:'saved',home:{kind:'existing'}})))(...args):admitted;
    }),
    addEventListener:(name,fn)=>events.set(name,fn),checkNativeDestination:journey.check||(()=>Promise.resolve({kind:'new'})),selectedRegion,atlasURL,neighboringRegionURL,selectedWorld,nativeRegionSessionMode,NativeRegionSession,
    advanceNativeWorldRegion:journey.advance||((...args)=>activations.push(args)),history:{replaceState(_state,_title,url){updates.push(String(url));location.href=String(url);location.search=new URL(url).search;}},document,location,URL,URLSearchParams,
    Module:{ENV:{RECOMP_CONTENT_IDENTITY:'a'.repeat(64)+':'+'b'.repeat(64),RECOMP_FRONTIER_HERO_BINDING:journey.binding,
      RECOMP_FRONTIER_HERO_HALO_BINDING:journey.haloBinding}},
    recordJourney:journey.depart||(()=>Promise.resolve()),recordJourneyArrival:journey.arrive||(()=>Promise.resolve())});
  return {buttons:elements.filter(x=>x.tag==='button'),links:elements.filter(x=>x.tag==='a'),status:elements.find(x=>x.tag==='output'),navigations,updates,activations,location,
    get elementCount(){return elements.length;},
    message(line){events.get('recomp-runtime-message')({detail:line});},
    poll(name='frontier-checkpoint'){const event={detail:{name}};events.get('recomp-action-poll')(event);return event.detail.pending===true;},
    fail(){events.get('recomp-runtime-state')({detail:{state:'failed'}});},hide(){events.get('pagehide')();}};
}

const sessionQuery='&world=session-ui&RECOMP_RULE_FRONTIER_SESSION=v1&RECOMP_RULE_FRONTIER_SEEDED_GENERATION=1&RECOMP_RULE_FRONTIER_CONNECTED_TERRAIN=v1';
const heroQuery='&world=hero-ui&RECOMP_RULE_FRONTIER_RESTORE=1&RECOMP_RULE_FRONTIER_HERO_RESTORE=v1&hero-world='+'c'.repeat(64)+'&hero-entity='+'d'.repeat(64);
const heroBinding='majesty-hero-runtime-v1|0_0|3200|502|27|42|0|native|469|7|77|'+'a'.repeat(64);
const heroBound='[frontier] Selected hero bound region=0_0 unit=502 agent=27 home=469/7 clock=3200 original-registry=1 reciprocal-home=1';
const heroHeld='[frontier] Hero save held serial=1 region=0_0 clock=6400 slot=1 bytes=4000 sha256='+'b'.repeat(64)+' phase=7 pending=0';
const heroHaloBinding='majesty-hero-halo-v1|0_0|'+'a'.repeat(64);
const heroCrossed='[frontier] Hero crossing serial=1 region=0_0 target=1_0 previous-clock=6350 clock=6400 unit=502 agent=27 previous=8257535,1497101,821 accepted=8257537,1497101,821 phase=3 pending=7 original-tick=1 native-cells=4';
function readyHero(ui){ui.message(heroBound);ui.message('[frontier] Region 0_0 ready');}
function resumeHero(ui,result='saved'){
  assert.equal(ui.poll('frontier-hero-save-finish'),true);
  assert.equal(ui.poll(`frontier-hero-save-${result}-1`),true);
  ui.message(`[frontier] Hero save released serial=1 region=0_0 clock=6400 result=${result} phase=7 pending=3`);
  ui.message('[frontier] Hero save resumed serial=1 region=0_0 clock=6400 phase=3 pending=0');
}
test('automatic crossing captures and checks its neighbor while held, then continues only on the explicit control',async()=>{
  let release,admit;const publication=new Promise(r=>release=r),admission=new Promise(r=>admit=r),calls=[];
  const ui=controls(heroQuery+'&hero-layout=halo-v1','0_0',{binding:heroBinding,haloBinding:heroHaloBinding,
    heroQueue:(...args)=>calls.push(['queue',...args]),heroPublish:()=>publication,
    heroInspect:(...args)=>{calls.push(['inspect',...args]);return admission;},heroEnd:()=>{calls.push(['end']);return Promise.resolve();}});
  readyHero(ui);ui.message(heroCrossed);assert.equal(calls.filter(c=>c[0]==='queue').length,1);
  assert.equal(calls[0][3].crossing.accepted.x,8257537);assert.equal(ui.poll('frontier-hero-save'),false);
  ui.message(heroHeld);await new Promise(r=>setImmediate(r));assert.equal(ui.poll('frontier-hero-save-finish'),false);
  release({});await new Promise(r=>setImmediate(r));assert.equal(calls.filter(c=>c[0]==='inspect').length,1);
  assert.equal(calls[1][3],'1_0');assert.equal(ui.buttons[2].disabled,true);assert.equal(ui.poll('frontier-hero-save-finish'),false);
  admit({kind:'saved'});await new Promise(r=>setImmediate(r));
  assert.equal(ui.buttons[2].disabled,false);assert.equal(ui.buttons[0].disabled,true);assert.equal(ui.buttons[1].disabled,true);
  assert.match(ui.status.textContent,/still in development/);assert.equal(ui.navigations.length,0);
  assert.equal(ui.poll('frontier-hero-save-finish'),false);ui.buttons[2].onclick();resumeHero(ui);
  await new Promise(r=>setImmediate(r));assert.equal(ui.navigations.length,0);assert.equal(calls.filter(c=>c[0]==='end').length,1);
  assert.equal(ui.buttons[0].disabled,false);assert.equal(ui.buttons[2].disabled,true);
});
test('neighbor refusal resumes the captured source and page departure cancels pending crossing admission',async()=>{
  for(const mode of ['refused','closed']){
    let release,signal;const admission=new Promise(r=>release=r),ends=[];
    const ui=controls(heroQuery+'&hero-layout=halo-v1','0_0',{binding:heroBinding,haloBinding:heroHaloBinding,
      heroInspect:(_world,_serial,_target,options)=>{signal=options.signal;return mode==='refused'?Promise.reject(Error('neighbor refused')):admission;},
      heroEnd:(...args)=>{ends.push(args);return Promise.resolve();}});
    readyHero(ui);ui.message(heroCrossed);ui.message(heroHeld);await new Promise(r=>setImmediate(r));
    if(mode==='refused'){resumeHero(ui,'failed');await new Promise(r=>setImmediate(r));assert.match(ui.status.textContent,/neighbor refused/);}
    else{ui.hide();assert.equal(signal.aborted,true);release({kind:'saved'});await new Promise(r=>setImmediate(r));
      assert.equal(ui.buttons[2].disabled,true);assert.equal(ui.poll('frontier-hero-save-finish'),false);assert.equal(ends[0][2].abandoned,true);}
    assert.equal(ui.navigations.length,0);assert.equal(ends.length,1);
  }
});
test('crossing holds through registered home preparation and page departure ignores its late record',async()=>{
  for(const mode of ['held','closed','refused']){
    let release,signal;const preparation=new Promise(r=>release=r),calls=[];
    const ui=controls(heroQuery+'&hero-layout=halo-v1','0_0',{binding:heroBinding,haloBinding:heroHaloBinding,
      heroInspect:()=>{calls.push('neighbor');return Promise.resolve({kind:'saved'});},
      heroHome:(_world,serial,target,options)=>{assert.equal(serial,1);assert.equal(target,'1_0');signal=options.signal;calls.push('home');
        return mode==='refused'?Promise.reject(Error('home refused')):preparation;}});
    readyHero(ui);ui.message(heroCrossed);ui.message(heroHeld);await new Promise(r=>setImmediate(r));
    assert.deepEqual(calls,['neighbor','home']);assert.equal(ui.buttons[2].disabled,true);
    if(mode!=='refused')assert.equal(ui.poll('frontier-hero-save-finish'),false);
    if(mode==='refused'){await new Promise(r=>setImmediate(r));resumeHero(ui,'failed');}
    else{
      if(mode==='closed'){ui.hide();assert.equal(signal.aborted,true);}
      release({kind:'saved',home:{kind:'proposal'}});await new Promise(r=>setImmediate(r));
      if(mode==='closed'){assert.equal(ui.buttons[2].disabled,true);assert.equal(ui.poll('frontier-hero-save-finish'),false);}
      else{assert.equal(ui.buttons[2].disabled,false);ui.buttons[2].onclick();resumeHero(ui);}
    }
    assert.equal(ui.navigations.length,0);
  }
});
test('an ungenerated neighbor stays held without inventing a saved native home',async()=>{
  let homes=0;
  const ui=controls(heroQuery+'&hero-layout=halo-v1','0_0',{binding:heroBinding,haloBinding:heroHaloBinding,
    heroInspect:()=>Promise.resolve({kind:'new'}),heroHome:()=>{++homes;assert.fail('no saved native destination');}});
  readyHero(ui);ui.message(heroCrossed);ui.message(heroHeld);await new Promise(r=>setImmediate(r));
  assert.equal(homes,0);assert.equal(ui.buttons[2].disabled,false);assert.equal(ui.navigations.length,0);
  ui.buttons[2].onclick();resumeHero(ui);
});
test('hero controls publish the held boundary and await durable publication plus actual native resume before leaving',async()=>{
  let resolve,finish;const publication=new Promise(r=>resolve=r),completion=new Promise(r=>finish=r),calls=[];
  const ui=controls(heroQuery,'0_0',{binding:heroBinding,heroReady:(...args)=>calls.push(['ready',...args]),
    heroQueue:(...args)=>calls.push(['queue',...args]),heroPublish:(...args)=>{calls.push(['publish',...args]);return publication;},
    heroEnd:(...args)=>{calls.push(['end',...args]);return completion;}});
  ui.message('[frontier] Region 0_0 ready');assert.ok(ui.buttons.every(b=>b.disabled));
  readyHero(ui);assert.equal(calls[0][0],'ready');assert.equal(ui.buttons[0].disabled,false);
  assert.ok(ui.buttons.slice(2).every(b=>b.disabled));await ui.buttons[1].onclick();
  assert.equal(ui.poll(),false);assert.equal(ui.poll('frontier-hero-save'),true);assert.equal(ui.poll('frontier-hero-save'),false);
  ui.message(heroHeld.replace('serial=1','serial=2'));assert.equal(calls.filter(c=>c[0]==='publish').length,0);
  ui.message(heroHeld);await Promise.resolve();assert.equal(calls.filter(c=>c[0]==='publish').length,1);
  assert.equal(calls.find(c=>c[0]==='publish')[2].clock,6400);assert.equal(ui.poll('frontier-hero-save-finish'),false);
  assert.ok(ui.buttons.every(b=>b.disabled));assert.equal(ui.navigations.length,0);
  resolve({clock:6400});await new Promise(r=>setImmediate(r));
  resumeHero(ui);assert.equal(ui.navigations.length,0);assert.ok(ui.buttons.every(b=>b.disabled));
  finish();await new Promise(r=>setImmediate(r));assert.equal(ui.navigations.length,1);assert.equal(calls.filter(c=>c[0]==='end').length,1);
});
for(const synchronous of [false,true])test(`hero publication ${synchronous?'synchronous refusal':'asynchronous failure'} acknowledges failure and resumes without leaving`,async()=>{
  const ui=controls(heroQuery,'0_0',{binding:heroBinding,heroPublish:()=>{
    if(synchronous)throw Error('storage refused');return Promise.reject(Error('storage refused'));
  }});readyHero(ui);await ui.buttons[1].onclick();assert.equal(ui.poll('frontier-hero-save'),true);ui.message(heroHeld);
  await new Promise(r=>setImmediate(r));assert.equal(ui.poll('frontier-hero-save-saved-1'),false);
  resumeHero(ui,'failed');await new Promise(r=>setImmediate(r));
  assert.equal(ui.navigations.length,0);assert.match(ui.status.textContent,/storage refused/);assert.equal(ui.buttons[0].disabled,false);
});
test('hero save completion failure never navigates after a successful native resume',async()=>{
  const ui=controls(heroQuery,'0_0',{binding:heroBinding,heroEnd:()=>Promise.reject(Error('completion refused'))});
  readyHero(ui);await ui.buttons[1].onclick();ui.poll('frontier-hero-save');ui.message(heroHeld);
  await new Promise(r=>setImmediate(r));resumeHero(ui);await new Promise(r=>setImmediate(r));
  assert.equal(ui.navigations.length,0);assert.match(ui.status.textContent,/completion refused/);assert.ok(ui.buttons.every(b=>b.disabled));
});
test('page departure cancels a held hero publication and ignores its late success and resume',async()=>{
  let resolve,signal;const ends=[],publication=new Promise(r=>resolve=r);
  const ui=controls(heroQuery,'0_0',{binding:heroBinding,heroPublish:(_world,_boundary,options)=>{signal=options.signal;return publication;},
    heroEnd:(...args)=>{ends.push(args);return publication;}});
  readyHero(ui);await ui.buttons[1].onclick();ui.poll('frontier-hero-save');ui.message(heroHeld);await Promise.resolve();
  ui.hide();assert.equal(signal.aborted,true);assert.equal(ends.length,1);assert.equal(ends[0][2].abandoned,true);
  resolve({});await new Promise(r=>setImmediate(r));
  assert.equal(ui.poll('frontier-hero-save-finish'),false);assert.equal(ui.poll('frontier-hero-save-saved-1'),false);
  ui.message('[frontier] Hero save resumed serial=1 region=0_0 clock=6400 phase=3 pending=0');
  assert.equal(ui.navigations.length,0);assert.ok(ui.buttons.every(b=>b.disabled));
});
test('selected hero refusal keeps actions disabled despite delayed ready and save messages',()=>{
  for(const refusal of ['checkpoint','binding']){
    const ui=controls();
    ui.message(`[frontier] Selected hero ${refusal} refused region=1_0`);
    assert.doesNotMatch(ui.status.textContent,/saved hero/,'another region cannot refuse this kingdom');
    ui.message(`[frontier] Selected hero ${refusal} refused region=0_0`);
    assert.match(ui.status.textContent,/before its first update/);
    ui.message('[frontier] Region 0_0 ready');ui.message('[frontier] Region 0_0 checkpoint saved');
    assert.ok(ui.buttons.every(button=>button.disabled));assert.equal(ui.poll(),false);assert.equal(ui.navigations.length,0);
    assert.match(ui.status.textContent,/before its first update/);
  }
});
const sessionRoot='/opfs/majesty/profile/native-world-session-ui';
function enableSession(ui){ui.message(`[frontier] Session enabled version=v1 region=0_0 root=${sessionRoot}`);ui.message('[frontier] Region 0_0 ready');}
function sessionLifecycle(ui,serial,source,target,direction,mode='saved',clock=33400){
  ui.message(`[frontier] Session checkpoint serial=${serial} region=${source} clock=${clock} direction=${direction}`);
  ui.message(`[frontier] Session quit serial=${serial} region=${source} saved-clock=${clock} clock=0 loading=0`);
  ui.message(`[frontier] Session unloaded serial=${serial} source=${source} target=${target} world-null=1 profile=${sessionRoot}/frontier_${target}`);
  ui.message(`[frontier] Session attached serial=${serial} region=${target} mode=${mode} phase=1 pending=2`);
}
test('DOM travel cannot move the active region until advertised disposal and observer removal complete',async()=>{
  const ui=controls(sessionQuery,'0_0',{check:async()=>({kind:'new'})});
  ui.message(`[frontier] Session enabled version=v1 region=0_0 root=${sessionRoot} release=v1`);
  ui.message('[frontier] Region 0_0 ready');await ui.buttons[2].onclick();assert.equal(ui.poll('frontier-travel-west'),true);
  sessionLifecycle(ui,1,'0_0','-1_0',0,'new');assert.equal(ui.activations.length,0);assert.equal(ui.updates.length,0);
  ui.message('[frontier] Session released serial=1 region=0_0 roots-freed=1,1,1,1,1,1 heap-before=2000000 heap-after=500000 blocks-before=100 blocks-after=20 clock=0');
  ui.message(`[frontier] Session unloaded serial=1 source=0_0 target=-1_0 world-null=1 profile=${sessionRoot}/frontier_-1_0`);
  ui.message('[frontier] Session attached serial=1 region=-1_0 mode=new phase=1 pending=2');assert.equal(ui.activations.length,0);
  ui.message('[frontier] Session release observer removed serial=1 hooks=1 retained-roots=1');
  ui.message('[frontier] Session attached serial=1 region=-1_0 mode=new phase=1 pending=2');assert.equal(ui.activations.length,0);
  ui.message('[frontier] Session release observer removed serial=1 hooks=1 retained-roots=0');
  ui.message('[frontier] Session attached serial=1 region=-1_0 mode=new phase=1 pending=2');ui.message('[frontier] Region -1_0 ready');
  assert.equal(ui.activations.length,1);assert.equal(ui.updates.length,1);assert.equal(ui.navigations.length,0);assert.ok(ui.buttons.every(button=>!button.disabled));
});
test('same-session travel updates region controls only after native disposal/attachment and revisits without navigation',async()=>{
  const checks=[],trips=[],arrivals=[];
  const ui=controls(sessionQuery,'0_0',{check:async(world,key)=>{checks.push([world,key]);return {kind:checks.length===1?'new':'saved'};},
    depart:async(url,options)=>trips.push([String(url),options.base]),arrive:async(options)=>arrivals.push(options.search)});
  enableSession(ui);const routes=['0_0','-1_0','0_0','-1_0','0_0'];
  for(let i=0;i<4;i++){
    const direction=i%2?'east':'west',index=i%2?5:2;
    await ui.buttons[index].onclick();assert.equal(ui.poll(),false,'session travel does not arm the legacy checkpoint/reload path');
    assert.equal(trips.length,i+1,'destination is durable before the native action is consumed');
    assert.equal(selectedRegion(new URL(trips[i][1]).search).key,routes[i]);
    assert.equal(ui.poll('frontier-travel'),true);assert.equal(ui.poll('frontier-travel'),true);assert.equal(ui.poll(`frontier-travel-${direction}`),true);
    assert.equal(ui.poll(`frontier-travel-${direction}`),false);assert.ok(ui.buttons.every(button=>button.disabled));
    ui.message(`[frontier] Session attached serial=${i+1} region=${routes[i+1]} mode=${i===0?'new':'saved'} phase=1 pending=2`);
    assert.equal(ui.updates.length,i,'an unsolicited attachment cannot move the region');
    sessionLifecycle(ui,i+1,routes[i],routes[i+1],i%2?3:0,i===0?'new':'saved');
    assert.deepEqual(ui.activations[i],['session-ui',routes[i],routes[i+1],i+1]);
    assert.equal(selectedRegion(ui.location.search).key,routes[i+1]);assert.equal(ui.navigations.length,0);assert.equal(ui.updates.length,i+1);
    assert.equal(new URL(ui.location.href).searchParams.get('RECOMP_RULE_FRONTIER_SESSION'),'v1');
    assert.equal(new URL(ui.links.find(link=>link.textContent==='Return to Frontier').href).searchParams.get('at'),routes[i+1]);
    assert.ok(ui.buttons.every(button=>button.disabled),'attachment waits for actual gameplay readiness');
    ui.message(`[frontier] Region ${routes[i]} ready`);assert.ok(ui.buttons.every(button=>button.disabled));
    ui.message(`[frontier] Region ${routes[i+1]} ready`);assert.ok(ui.buttons.every(button=>!button.disabled));
    await Promise.resolve();
  }
  assert.equal(ui.buttons.length,6);assert.equal(ui.links.length,3);assert.deepEqual(checks.map(row=>row[1]),routes.slice(1));
  assert.equal(arrivals.length,5);assert.equal(ui.navigations.length,0);
});
test('native boundary gestures use admitted durable session travel and cannot activate early',async()=>{
  const checks=[],trips=[];let finishWrite;
  const writing=new Promise(resolve=>finishWrite=resolve);
  const ui=controls(sessionQuery,'0_0',{check:async(...args)=>{checks.push(args);return {kind:'new'};},depart:async url=>{trips.push(String(url));await writing;}});
  ui.message(`[frontier] Session enabled version=v1 region=0_0 root=${sessionRoot} release=v2 crossing=v1`);
  ui.message('[frontier] Region 0_0 ready');const nodes=ui.elementCount;
  const boundary='[frontier] Session boundary serial=0 region=0_0 direction=west gesture=1';
  ui.message(boundary);ui.message(boundary);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(checks.length,1);assert.equal(checks[0][1],'-1_0');assert.equal(trips.length,1);
  assert.equal(ui.poll('frontier-travel'),false);assert.equal(ui.activations.length,0);
  finishWrite();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ui.poll('frontier-travel'),true);assert.equal(ui.poll('frontier-travel-west'),true);
  ui.message('[frontier] Session checkpoint serial=1 region=0_0 clock=33400 direction=0');
  ui.message('[frontier] Session quit serial=1 region=0_0 saved-clock=33400 clock=0 loading=0');
  ui.message('[frontier] Session released serial=1 region=0_0 roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288 heap-before=2000000 heap-after=500000 blocks-before=100 blocks-after=20 clock=0');
  ui.message(`[frontier] Session unloaded serial=1 source=0_0 target=-1_0 world-null=1 profile=${sessionRoot}/frontier_-1_0`);
  ui.message('[frontier] Session release observer removed serial=1 hooks=1 retained-roots=0');
  ui.message('[frontier] Session attached serial=1 region=-1_0 mode=new phase=1 pending=2');
  ui.message('[frontier] Region -1_0 ready');
  assert.deepEqual(ui.activations,[['session-ui','0_0','-1_0',1]]);
  assert.equal(ui.elementCount,nodes);assert.equal(ui.navigations.length,0);
});
test('boundary gestures cannot bypass pagehide, multiplayer blocking or a checkpoint refusal',async()=>{
  for(const stop of [ui=>ui.hide(),ui=>ui.message('[frontier] Network region handoff unavailable')]){
    const checks=[];const ui=controls(sessionQuery,'0_0',{check:async(...args)=>{checks.push(args);return {kind:'new'};}});
    ui.message(`[frontier] Session enabled version=v1 region=0_0 root=${sessionRoot} release=v2 crossing=v1`);
    ui.message('[frontier] Region 0_0 ready');stop(ui);
    ui.message('[frontier] Session boundary serial=0 region=0_0 direction=west gesture=1');
    await new Promise(resolve=>setImmediate(resolve));assert.equal(checks.length,0);assert.equal(ui.poll('frontier-travel'),false);
  }
  const ui=controls(sessionQuery,'0_0',{check:async()=>{throw Error('partial checkpoint');}});
  ui.message(`[frontier] Session enabled version=v1 region=0_0 root=${sessionRoot} release=v2 crossing=v1`);
  ui.message('[frontier] Region 0_0 ready');ui.message('[frontier] Session boundary serial=0 region=0_0 direction=west gesture=1');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.poll('frontier-travel'),false);assert.equal(ui.activations.length,0);assert.equal(ui.navigations.length,0);
});
if(process.env.MAJESTY_NATIVE_CAMERA_TRACE)test('actual native camera edge drives the first admitted trip without a button or DOM growth',async()=>{
  const m=JSON.parse(await readFile(process.env.MAJESTY_NATIVE_CAMERA_TRACE,'utf8'));
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
  try{process.kill(m.nativePid,0);assert.fail('native producer remains live');}catch(error){if(error.code!=='ESRCH')throw error;}
  const log=await readFile(m.log,'utf8');assert.equal(createHash('sha256').update(log).digest('hex'),m.logSha256);
  const trace=requireSessionTrace(m,log);assert.ok(trace.boundary);
  const root=`/opfs/majesty/profile/native-world-${m.worldName}`;
  const query=sessionQuery.replace('world=session-ui','world='+m.worldName),locks=[],held=new Set(),activations=[];
  let injected;const started=new Promise(resolve=>injected=resolve);
  startNativeWorldPlayer((_profile,retain)=>{retain();injected();},{search:'?profile=frontier_0_0&RECOMP_RULE_FRONTIER_REGION=0_0'+query,
    events:{addEventListener(){},removeEventListener(){}},locks:{async request(name,options,fn){locks.push([name,options]);held.add(name);return fn({});}}});
  await started;let checks=0,writes=0;
  const ui=controls(query,'0_0',{
    check:async(world,key)=>{assert.equal(world,m.worldName);assert.equal(key,'-1_0');++checks;return {kind:'new'};},
    depart:async()=>{++writes;},advance:(...args)=>{advanceNativeWorldRegion(...args);activations.push(args);}
  });
  const nodes=ui.elementCount;let consumed=false,ready=false;
  for(const raw of log.split('\n')){
    const line=raw.split(m.worldRoot).join(root);ui.message(line);
    if(raw===m.boundaryTrigger.line){
      await new Promise(resolve=>setImmediate(resolve));assert.equal(checks,1);assert.equal(writes,1);
      assert.equal(ui.poll('frontier-travel'),true);assert.equal(ui.poll('frontier-travel-west'),true);consumed=true;
    }
    assert.equal(ui.elementCount,nodes);assert.equal(ui.navigations.length,0);
    if(consumed&&line==='[frontier] Region -1_0 ready'){ready=true;break;}
  }
  assert.equal(ready,true);assert.equal(ui.updates.length,1);
  assert.deepEqual(activations,[[m.worldName,'0_0','-1_0',1]]);
  assert.equal(selectedRegion(ui.location.search).key,'-1_0');assert.ok(ui.buttons.every(button=>!button.disabled));
  assert.equal(locks.length,1);assert.equal(held.size,1);
  const directory={async getDirectoryHandle(){return directory;}},storage={async getDirectory(){return directory;}};
  assert.equal(await withNativeWorldNeighborRead(m.worldName,'0_0',()=>42,{storage}),42);
  await assert.rejects(withNativeWorldNeighborRead(m.worldName,'1_0',()=>42,{storage}),/initialized world/);
  assert.equal(held.size,1);held.clear();
});
test('a session request waits for durable journey storage and cannot survive pagehide while that write drains',async()=>{
  let release;const writing=new Promise(resolve=>release=resolve),trips=[];
  const ui=controls(sessionQuery,'0_0',{check:async()=>({kind:'new'}),depart:async url=>{trips.push(url);await writing;}});enableSession(ui);
  const request=ui.buttons[2].onclick();await new Promise(resolve=>setImmediate(resolve));assert.equal(trips.length,1);
  assert.equal(ui.poll('frontier-travel-west'),false);assert.ok(ui.buttons.every(button=>button.disabled));ui.hide();release();await request;
  assert.equal(ui.poll('frontier-travel'),false);assert.equal(ui.poll('frontier-travel-west'),false);sessionLifecycle(ui,1,'0_0','-1_0',0,'new');
  assert.equal(ui.activations.length,0);assert.equal(ui.updates.length,0);assert.equal(ui.navigations.length,0);
});
test('failed journey storage keeps a native session in the current kingdom and permits a fresh retry',async()=>{
  let fails=true;const ui=controls(sessionQuery,'0_0',{check:async()=>({kind:'new'}),depart:async()=>{if(fails)throw Error('storage full');}});enableSession(ui);
  await ui.buttons[2].onclick();assert.equal(ui.poll('frontier-travel'),false);assert.match(ui.status.textContent,/storage full/);assert.ok(ui.buttons.every(button=>!button.disabled));
  fails=false;await ui.buttons[2].onclick();assert.equal(ui.poll('frontier-travel'),true);assert.equal(ui.poll('frontier-travel-west'),true);
});
test('native re-admission refusal drains the request, restores active journey state and keeps the serial for retry',async()=>{
  const trips=[];const ui=controls(sessionQuery,'0_0',{check:async()=>({kind:'new'}),depart:async(url,options)=>trips.push([String(url),options.base])});enableSession(ui);
  await ui.buttons[2].onclick();ui.poll('frontier-travel-west');ui.message('[frontier] Session destination refused source=0_0 target=-1_0');
  assert.ok(ui.buttons.every(button=>!button.disabled));assert.equal(ui.location.search.includes('REGION=0_0'),true);assert.equal(ui.activations.length,0);
  await new Promise(resolve=>setImmediate(resolve));assert.match(trips[1][0],/\/world\//);
  await ui.buttons[2].onclick();assert.equal(ui.poll('frontier-travel-west'),true);sessionLifecycle(ui,1,'0_0','-1_0',0,'new');
  ui.message('[frontier] Region -1_0 ready');assert.equal(ui.activations.length,1);assert.equal(ui.navigations.length,0);
});
test('native fallback acknowledges the restored source without changing URL and advances its trip serial',async()=>{
  const trips=[];const ui=controls(sessionQuery,'0_0',{check:async()=>({kind:'new'}),depart:async url=>trips.push(String(url))});enableSession(ui);
  await ui.buttons[2].onclick();ui.poll('frontier-travel-west');
  ui.message('[frontier] Session checkpoint serial=1 region=0_0 clock=33400 direction=0');ui.message('[frontier] Session quit serial=1 region=0_0 saved-clock=33400 clock=0 loading=0');
  ui.message(`[frontier] Session unloaded serial=1 source=0_0 target=-1_0 world-null=1 profile=${sessionRoot}/frontier_-1_0`);
  ui.message('[frontier] Session fallback serial=1 region=0_0 restored=1');ui.message('[frontier] Session attached serial=1 region=0_0 mode=saved phase=1 pending=2');
  assert.deepEqual(ui.activations,[['session-ui','0_0','0_0',1]]);assert.equal(ui.updates.length,0);ui.message('[frontier] Region 0_0 ready');assert.match(ui.status.textContent,/previous kingdom is active/);
  await new Promise(resolve=>setImmediate(resolve));assert.match(trips[1],/\/world\//);
  await ui.buttons[2].onclick();ui.poll('frontier-travel-west');sessionLifecycle(ui,2,'0_0','-1_0',0,'new');ui.message('[frontier] Region -1_0 ready');assert.equal(ui.activations[1][3],2);
});
test('old engines without native session enablement retain checkpoint-and-navigation travel',async()=>{
  const ui=controls(sessionQuery,'0_0',{check:async()=>({kind:'new'})});ui.message('[frontier] Region 0_0 ready');
  await ui.buttons[2].onclick();assert.equal(ui.poll('frontier-travel-west'),false);assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint saved');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.navigations.length,1);assert.equal(ui.activations.length,0);assert.equal(new URL(ui.navigations[0]).searchParams.get('RECOMP_RULE_FRONTIER_SESSION'),'v1');
});
if(process.env.MAJESTY_NATIVE_SESSION_TRACE)test('actual stopped native lifecycle trace drives all trips with fixed DOM and one held region capability',async()=>{
  const manifestName=process.env.MAJESTY_NATIVE_SESSION_TRACE;assert.ok((await stat(manifestName)).size<=256*1024);
  const m=JSON.parse(await readFile(manifestName,'utf8'));assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
  try{process.kill(m.nativePid,0);assert.fail('native producer remains live');}catch(error){if(error.code!=='ESRCH')throw error;}
  assert.ok((await stat(m.log)).size<=1024*1024);const log=await readFile(m.log,'utf8');assert.equal(createHash('sha256').update(log).digest('hex'),m.logSha256);
  assert.equal(m.stopReason,null);const trace=requireSessionTrace(m,log),trips=trace.visits-1;
  const world=m.worldName,root=`/opfs/majesty/profile/native-world-${world}`,held=new Set(),locks=[];let injected;
  const started=new Promise(resolve=>injected=resolve),query=sessionQuery.replace('world=session-ui','world='+world);
  const search='?profile=frontier_0_0&RECOMP_RULE_FRONTIER_REGION=0_0'+query;
  startNativeWorldPlayer((_profile,retain)=>{retain();injected();},{search,events:{addEventListener(){},removeEventListener(){}},
    locks:{async request(name,options,fn){locks.push([name,options]);held.add(name);return fn({});}}});await started;
  let prepared=0;const activations=[],journeys=[];
  const ui=controls(query,'0_0',{check:async(selected,key)=>{assert.equal(selected,world);assert.equal(key,m.route[prepared+1]);return {kind:trace.modes[prepared]};},
    depart:async(destination,options)=>{assert.equal(selectedRegion(new URL(options.base).search).key,m.route[prepared]);journeys.push(String(destination));},
    advance:(...args)=>{advanceNativeWorldRegion(...args);activations.push(args);}});
  const elementCount=ui.elementCount;
  for(const raw of log.split('\n')){
    const line=raw.split(m.worldRoot).join(root);
    if(prepared<trips&&line.startsWith(`[frontier] Session checkpoint serial=${prepared+1} region=${m.route[prepared]} `)){
      const code=+trace.saves[prepared].direction,direction=['west','north','south','east'][code];
      await ui.buttons[code+2].onclick();assert.equal(ui.poll(),false);
      assert.equal(ui.poll('frontier-travel'),true);assert.equal(ui.poll(`frontier-travel-${direction}`),true);++prepared;
    }
    ui.message(line);
    assert.equal(ui.elementCount,elementCount);
  }
  assert.equal(prepared,trips);assert.equal(activations.length,trips);assert.equal(journeys.length,trips);assert.equal(ui.updates.length,trips);assert.equal(ui.navigations.length,0);
  assert.equal(selectedRegion(ui.location.search).key,'0_0');assert.ok(ui.buttons.every(button=>!button.disabled));assert.equal(locks.length,1);assert.equal(held.size,1);
  const directory={async getDirectoryHandle(){return directory;}},storage={async getDirectory(){return directory;}};
  assert.equal(await withNativeWorldNeighborRead(world,'-1_0',()=>42,{storage}),42);
  await assert.rejects(withNativeWorldNeighborRead(world,'-2_0',()=>42,{storage}),/initialized world/);
  assert.equal(held.size,1);held.clear();
});
for(const result of ['completed','defeated'])test(`${result} cancels queued region save, ignores late results and permits later playable restoration`,()=>{
  const ui=controls();
  ui.message('[frontier] Region 0_0 checkpoint restored');
  ui.message('[frontier] Region 0_0 ready');
  assert.ok(ui.buttons.every(b=>!b.disabled));
  ui.buttons[1].onclick(); // A requested save-and-leave must not leave after defeat.
  ui.message(`[frontier] Region 0_0 ${result}`);
  assert.ok(ui.buttons.every(b=>b.disabled));
  assert.match(ui.status.textContent,/previous checkpoint is preserved/);
  assert.ok(ui.links.every(a=>a.style.display==='block'));
  assert.equal(ui.poll(),false,'no checkpoint request escapes after the original outcome');
  for(const message of ['saved','failed'])ui.message(`[frontier] Region 0_0 checkpoint ${message}`);
  assert.ok(ui.buttons.every(b=>b.disabled));
  assert.equal(ui.navigations.length,0);
  ui.buttons[0].onclick();
  assert.equal(ui.poll(),false,'even a synthetic click cannot bypass the finished-state guard');
  ui.message('[frontier] Region not playing');
  ui.message('[frontier] Region 0_0 ready');
  assert.ok(ui.buttons.every(b=>!b.disabled));
  ui.buttons[0].onclick();assert.equal(ui.poll(),true);
  ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.ok(ui.buttons.every(b=>!b.disabled));
  assert.equal(ui.navigations.length,0);
});
test('successful save-and-return preserves opted-in diagnostics and drops native profile settings',()=>{
  const ui=controls('&RECOMP_MEMORY_DEBUG=1');
  ui.message('[frontier] Region 0_0 ready');ui.buttons[1].onclick();
  assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.deepEqual(ui.navigations,['http://localhost:8000/world/?RECOMP_MEMORY_DEBUG=1&at=0_0']);
});
test('a finished fresh region does not claim an existing checkpoint or offer automatic restore',()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 checkpoint content unavailable');
  assert.match(ui.status.textContent,/No compatible checkpoint found.*Start a game here/);
  assert.equal(ui.links.find(a=>a.textContent==='Restore previous checkpoint').style.display,'none');
  ui.message('[frontier] Region 0_0 ready');ui.message('[frontier] Region 0_0 defeated');
  assert.doesNotMatch(ui.status.textContent,/previous checkpoint is preserved/);
  assert.equal(ui.links.find(a=>a.textContent==='Restore previous checkpoint').style.display,'none');
  assert.ok(ui.buttons.every(b=>b.disabled));
});
test('runtime failure cancels pending saves and cannot be rearmed by late readiness',()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 ready');ui.buttons[1].onclick();ui.fail();
  ui.message('[frontier] Region 0_0 ready');ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.equal(ui.poll(),false);assert.ok(ui.buttons.every(b=>b.disabled));assert.equal(ui.navigations.length,0);
});

test('failed replacement preserves recovery and cancels save-and-leave navigation',()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 checkpoint restored');ui.message('[frontier] Region 0_0 ready');
  ui.buttons[1].onclick();assert.equal(ui.poll(),true);
  ui.message('[frontier] Region 0_0 checkpoint failed');
  assert.match(ui.status.textContent,/previous checkpoint is preserved/);
  assert.equal(ui.links.find(a=>a.textContent==='Restore previous checkpoint').style.display,'block');
  assert.equal(ui.navigations.length,0);assert.ok(ui.buttons.every(b=>!b.disabled));
  ui.buttons[0].onclick();assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.equal(ui.navigations.length,0,'the retry does not inherit the failed leave request');
});

test('a shared pair cannot queue or publish a one-sided regional replacement',()=>{
  const ui=controls('&RECOMP_RULE_FRONTIER_TRANSFER=1&RECOMP_RULE_FRONTIER_RESTORE=1');
  ui.message('[frontier] Region 0_0 checkpoint restored');
  ui.message('[frontier] Region 0_0 ready');
  assert.ok(ui.buttons.every(b=>b.disabled));
  assert.match(ui.status.textContent,/Shared checkpoint loaded.*single kingdom is unavailable/);
  for(const button of ui.buttons){button.onclick();assert.equal(ui.poll(),false);}
  ui.message('[frontier] Region 0_0 checkpoint saved');
  ui.message('[frontier] Region 0_0 checkpoint failed');
  assert.ok(ui.buttons.every(b=>b.disabled));
  assert.match(ui.status.textContent,/Shared checkpoint loaded/);
  assert.equal(ui.navigations.length,0);
  assert.equal(ui.poll(),false);
});

test('synthetic clicks and unsolicited results cannot arm a region before gameplay is ready',()=>{
  const ui=controls();
  for(const line of [null,'[frontier] Region 0_0 restoring checkpoint','[frontier] Region 0_0 checkpoint restored','[frontier] Region not playing']){
    if(line)ui.message(line);
    const status=ui.status.textContent;
    for(const button of ui.buttons)button.onclick();
    assert.equal(ui.poll(),false);
    for(const result of ['saved','failed'])ui.message(`[frontier] Region 0_0 checkpoint ${result}`);
    assert.ok(ui.buttons.every(b=>b.disabled));
    assert.equal(ui.status.textContent,status);
    assert.equal(ui.navigations.length,0);
  }
});

for(const first of [0,1])test(`save intent ${first} survives repeated readiness, clicks and polls until its consumed result`,()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 ready');ui.buttons[first].onclick();
  ui.message('[frontier] Region 0_0 ready');
  // A result before the engine consumes the request must not finish it.
  for(const result of ['saved','failed'])ui.message(`[frontier] Region 0_0 checkpoint ${result}`);
  assert.match(ui.status.textContent,/Saving the native kingdom/);
  assert.ok(ui.buttons.every(b=>b.disabled));
  ui.buttons[1-first].onclick();assert.equal(ui.poll(),true);
  ui.message('[frontier] Region 0_0 ready');ui.buttons[1-first].onclick();
  assert.ok(ui.buttons.every(b=>b.disabled));assert.equal(ui.poll(),false);
  assert.ok(ui.links.every(a=>a.style.display==='none'));
  ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.equal(ui.navigations.length,first);
  const status=ui.status.textContent;
  ui.message('[frontier] Region 0_0 checkpoint failed');
  assert.equal(ui.status.textContent,status,'duplicate results cannot reopen recovery controls');
});

test('a retry hides and guards all recovery links until native acknowledgement',()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 checkpoint restored');ui.message('[frontier] Region 0_0 ready');
  ui.buttons[1].onclick();assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint failed');
  assert.ok(ui.links.every(a=>a.style.display==='block'));
  ui.buttons[1].onclick();
  const clickLinks=()=>{for(const link of ui.links){let prevented=false;link.onclick({preventDefault(){prevented=true;}});assert.ok(prevented);}};
  clickLinks();assert.equal(ui.navigations.length,0);
  assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 ready');clickLinks();
  assert.ok(ui.links.every(a=>a.style.display==='none'));assert.equal(ui.navigations.length,0);
  ui.message('[frontier] Region 0_0 checkpoint failed');
  assert.match(ui.status.textContent,/previous checkpoint is preserved/);
  assert.ok(ui.links.every(a=>a.style.display==='block'));assert.equal(ui.navigations.length,0);
  ui.links[2].onclick({preventDefault(){}});
  assert.equal(new URL(ui.navigations[0]).searchParams.get('RECOMP_RULE_FRONTIER_RESTORE'),'1');
});

for(const transition of ['Region not playing','Region 0_0 restoring checkpoint','Region 0_0 completed','Region 0_0 defeated','Network region handoff unavailable'])test(`${transition} cancels departure while a consumed save drains`,()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 ready');ui.buttons[1].onclick();assert.equal(ui.poll(),true);
  ui.message(`[frontier] ${transition}`);
  const status=ui.status.textContent;
  assert.ok(ui.buttons.every(b=>b.disabled));assert.ok(ui.links.every(a=>a.style.display==='none'));
  ui.buttons[0].onclick();assert.equal(ui.poll(),false);
  ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.equal(ui.navigations.length,0);assert.equal(ui.status.textContent,status);
  assert.ok(ui.buttons.every(b=>b.disabled));
  ui.message('[frontier] Region 0_0 ready');
  assert.ok(ui.buttons.every(b=>b.disabled===transition.startsWith('Network')));
});

test('a new playable kingdom cannot reuse an abandoned in-flight save or its leave intent',()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 ready');ui.buttons[1].onclick();assert.equal(ui.poll(),true);
  ui.message('[frontier] Region not playing');ui.message('[frontier] Region 0_0 ready');
  ui.buttons[1].onclick();assert.equal(ui.poll(),false);assert.ok(ui.buttons.every(b=>b.disabled));
  ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.equal(ui.navigations.length,0);assert.ok(ui.buttons.every(b=>!b.disabled));
  ui.buttons[0].onclick();assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.equal(ui.navigations.length,0);
});

test('network handoff rejection cancels a queued save and stale readiness cannot unlock it',()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 ready');ui.buttons[1].onclick();
  ui.message('[frontier] Network region handoff unavailable');ui.message('[frontier] Region 0_0 ready');
  assert.ok(ui.buttons.every(b=>b.disabled));assert.equal(ui.poll(),false);
  ui.message('[frontier] Region 0_0 checkpoint saved');assert.equal(ui.navigations.length,0);
  assert.match(ui.status.textContent,/Co-op handoff is still in development/);
});

test('runtime failure permits recovery after a consumed save and ignores late results',()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 checkpoint restored');ui.message('[frontier] Region 0_0 ready');
  ui.buttons[1].onclick();assert.equal(ui.poll(),true);ui.fail();
  const status=ui.status.textContent;
  assert.ok(ui.links.every(a=>a.style.display==='block'));
  for(const result of ['saved','failed'])ui.message(`[frontier] Region 0_0 checkpoint ${result}`);
  assert.ok(ui.buttons.every(b=>b.disabled));assert.equal(ui.status.textContent,status);assert.equal(ui.navigations.length,0);
});

test('confirmed save-and-leave returns to the same named world',async()=>{
  const ui=controls('&world=our-kingdom&RECOMP_MEMORY_DEBUG=1');
  ui.message('[frontier] Region 0_0 ready');ui.buttons[1].onclick();assert.equal(ui.poll(),true);
  ui.message('[frontier] Region 0_0 checkpoint saved');
  await new Promise(resolve=>setImmediate(resolve));
  const destination=new URL(ui.navigations[0]);
  assert.equal(destination.pathname,'/world/');assert.equal(destination.searchParams.get('world'),'our-kingdom');
  assert.equal(destination.searchParams.get('RECOMP_MEMORY_DEBUG'),'1');
  assert.equal(destination.searchParams.has('profile'),false);
  assert.equal(destination.searchParams.get('at'),'0_0');
});

for(const [direction,key] of [['west','-1_0'],['north','0_-1'],['south','0_1'],['east','1_0']])
test(`travel ${direction} saves the current kingdom before replacing it with region ${key}`,async()=>{
  const ui=controls('&world=our-kingdom&RECOMP_MEMORY_DEBUG=1&relay=private');
  const travel=ui.buttons.find(button=>button.textContent===`Save and travel ${direction}`);
  travel.onclick();assert.equal(ui.poll(),false);assert.equal(ui.navigations.length,0);
  ui.message('[frontier] Region 0_0 ready');await travel.onclick();
  assert.ok(ui.buttons.every(button=>button.disabled));assert.equal(ui.navigations.length,0);
  ui.message('[frontier] Region 0_0 checkpoint saved');assert.equal(ui.navigations.length,0,'unsolicited save cannot publish travel');
  assert.equal(ui.poll(),true);assert.equal(ui.poll(),false);
  ui.message('[frontier] Region 0_0 checkpoint saved');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.navigations.length,1);
  const destination=new URL(ui.navigations[0]);
  assert.equal(destination.pathname,'/majesty/');assert.equal(destination.searchParams.get('world'),'our-kingdom');
  assert.equal(destination.searchParams.get('RECOMP_RULE_FRONTIER_REGION'),key);
  assert.equal(destination.searchParams.get('profile'),`frontier_${key}`);
  assert.equal(destination.searchParams.get('RECOMP_RULE_FRONTIER_RESTORE'),'1');
  assert.equal(destination.searchParams.get('RECOMP_RULE_INVENTORY_COMPAT'),'1');
  assert.equal(destination.searchParams.get('RECOMP_MEMORY_DEBUG'),'1');
  assert.equal(destination.searchParams.has('relay'),false);
  ui.message('[frontier] Region 0_0 checkpoint saved');assert.equal(ui.navigations.length,1);
  for(const button of ui.buttons)button.onclick();assert.equal(ui.poll(),false,'page replacement cannot start another save');
  assert.ok(ui.buttons.every(button=>button.disabled));
});
test('a pending regional departure cannot be replaced by another travel click',()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 ready');
  const east=ui.buttons.find(button=>button.textContent==='Save and travel east');
  east.onclick();
  for(let i=0;i<100;i++)for(const button of ui.buttons)button.onclick();
  assert.equal(ui.poll(),true);
  for(const button of ui.buttons)button.onclick();assert.equal(ui.poll(),false);
  ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.equal(ui.navigations.length,1);assert.equal(new URL(ui.navigations[0]).searchParams.get('RECOMP_RULE_FRONTIER_REGION'),'1_0');
});
for(const transition of ['Region not playing','Region 0_0 defeated','Region 0_0 completed','Region 0_0 restoring checkpoint','Network region handoff unavailable'])
test(`travel cancellation during ${transition} drains its save without moving`,()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 ready');
  ui.buttons.find(button=>button.textContent==='Save and travel east').onclick();assert.equal(ui.poll(),true);
  ui.message(`[frontier] ${transition}`);ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.equal(ui.navigations.length,0);assert.ok(ui.buttons.every(button=>button.disabled));
});
test('failed travel remains in the current kingdom and a save-only retry cannot depart',()=>{
  const ui=controls();ui.message('[frontier] Region 0_0 checkpoint restored');ui.message('[frontier] Region 0_0 ready');
  ui.buttons.find(button=>button.textContent==='Save and travel north').onclick();assert.equal(ui.poll(),true);
  ui.message('[frontier] Region 0_0 checkpoint failed');assert.equal(ui.navigations.length,0);
  assert.match(ui.status.textContent,/previous checkpoint is preserved/);
  ui.buttons[0].onclick();assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.equal(ui.navigations.length,0);
});
test('world boundary disables only directions that cannot advance',async()=>{
  const ui=controls('&world=edge','1000000_1000000');ui.message('[frontier] Region 1000000_1000000 ready');
  const east=ui.buttons.find(button=>button.textContent==='East boundary reached');
  const south=ui.buttons.find(button=>button.textContent==='South boundary reached');
  assert.equal(east.disabled,true);assert.equal(south.disabled,true);
  east.onclick();south.onclick();assert.equal(ui.poll(),false);
  const west=ui.buttons.find(button=>button.textContent==='Save and travel west');assert.equal(west.disabled,false);
  await west.onclick();assert.equal(ui.poll(),true);ui.message('[frontier] Region 1000000_1000000 checkpoint saved');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(new URL(ui.navigations[0]).searchParams.get('RECOMP_RULE_FRONTIER_REGION'),'999999_1000000');
});

test('named-world trip waits for arrival metadata and native save, then for durable destination publication',async()=>{
  let arrive,depart;const calls=[];
  const ui=controls('&world=our-kingdom','0_0',{
    arrive(){calls.push('arriving');return new Promise(resolve=>arrive=resolve);},
    depart(destination,options){calls.push('departure');assert.equal(new URL(destination).searchParams.get('RECOMP_RULE_FRONTIER_REGION'),'0_1');
      assert.match(options.content,/^[a-f0-9]{64}:[a-f0-9]{64}$/);return new Promise(resolve=>depart=resolve);},
  });
  ui.message('[frontier] Region 0_0 ready');await ui.buttons.find(button=>button.textContent==='Save and travel south').onclick();
  ui.message('[frontier] Region 0_0 checkpoint saved');assert.deepEqual(calls,['arriving']);assert.equal(ui.navigations.length,0);
  assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint saved');await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,['arriving']);assert.equal(ui.navigations.length,0);
  arrive();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,['arriving','departure']);
  for(const button of ui.buttons)button.onclick();assert.equal(ui.poll(),false);assert.equal(ui.navigations.length,0);
  depart();await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.navigations.length,1);
});
test('failed destination metadata preserves the saved kingdom, restores recovery links and does not navigate',async()=>{
  let count=0;
  const ui=controls('&world=our-kingdom','0_0',{depart(){++count;return Promise.reject(Error('quota exceeded'));}});
  ui.message('[frontier] Region 0_0 ready');await ui.buttons.find(button=>button.textContent==='Save and travel east').onclick();
  assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint saved');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(count,1);assert.equal(ui.navigations.length,0);assert.match(ui.status.textContent,/Kingdom saved.*quota exceeded/);
  assert.ok(ui.buttons.every(button=>!button.disabled));assert.equal(ui.links[2].style.display,'block');
  ui.buttons[0].onclick();assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint saved');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(count,1,'save-only retry cannot inherit the failed trip');assert.equal(ui.navigations.length,0);
});
for(const transition of ['Region 0_0 defeated','Region 0_0 completed','Region not playing','Network region handoff unavailable'])
test(`world departure canceled by ${transition} during metadata I/O cannot navigate after late publication`,async()=>{
  let finish;const ui=controls('&world=our-kingdom','0_0',{depart(){return new Promise(resolve=>finish=resolve);}});
  ui.message('[frontier] Region 0_0 ready');await ui.buttons.find(button=>button.textContent==='Save and travel east').onclick();
  assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint saved');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof finish,'function');ui.message(`[frontier] ${transition}`);const status=ui.status.textContent;
  finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.navigations.length,0);assert.equal(ui.status.textContent,status);
});
test('runtime failure while arrival metadata is outstanding cancels departure before any new record write',async()=>{
  let finish;let writes=0;
  const ui=controls('&world=our-kingdom','0_0',{arrive(){return new Promise(resolve=>finish=resolve);},depart(){++writes;return Promise.resolve();}});
  ui.message('[frontier] Region 0_0 ready');ui.buttons[1].onclick();assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint saved');
  ui.fail();finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(writes,0);assert.equal(ui.navigations.length,0);assert.match(ui.status.textContent,/Game stopped/);
});

test('named-world admission finishes before native saving, coalesces clicks and still requires a successful save acknowledgement',async()=>{
  let finish,calls=0;
  const ui=controls('&world=our-kingdom','0_0',{check(world,key,{content,signal}){
    ++calls;assert.equal(world,'our-kingdom');assert.equal(key,'1_0');assert.equal(signal.aborted,false);
    assert.match(content,/^[a-f0-9]{64}:[a-f0-9]{64}$/);return new Promise(resolve=>finish=resolve);
  }});
  const east=ui.buttons.find(button=>button.textContent==='Save and travel east');
  ui.message('[frontier] Region 0_0 ready');const operation=east.onclick();
  assert.equal(ui.poll(),false);assert.match(ui.status.textContent,/Checking the neighboring kingdom/);
  assert.ok(ui.buttons.every(button=>button.disabled));
  for(let i=0;i<10;i++)for(const button of ui.buttons)button.onclick();
  for(const link of ui.links)link.onclick({preventDefault(){}});
  ui.message('[frontier] Region 0_0 ready');ui.message('[frontier] Region 0_0 checkpoint saved');
  assert.equal(calls,1);assert.equal(ui.poll(),false);assert.equal(ui.navigations.length,0);
  finish();await operation;assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint failed');
  assert.equal(ui.navigations.length,0);assert.ok(ui.buttons.every(button=>!button.disabled));
  ui.buttons[0].onclick();assert.equal(calls,1);assert.equal(ui.poll(),true);
  ui.message('[frontier] Region 0_0 checkpoint saved');await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.navigations.length,0);
});
test('damaged destination refuses before saving; retry can check again and then save and travel',async()=>{
  let calls=0;
  const ui=controls('&world=our-kingdom','0_0',{check(){if(++calls===1)throw Error('Damaged native realm snapshot');return Promise.resolve();}});
  ui.message('[frontier] Region 0_0 ready');const west=ui.buttons.find(button=>button.textContent==='Save and travel west');
  await west.onclick();assert.equal(ui.poll(),false);assert.equal(ui.navigations.length,0);
  assert.match(ui.status.textContent,/Travel unavailable.*Damaged.*current kingdom stays active/);
  assert.ok(ui.buttons.every(button=>!button.disabled));
  ui.message('[frontier] Region 0_0 checkpoint saved');assert.equal(ui.navigations.length,0);
  await west.onclick();assert.equal(calls,2);assert.equal(ui.poll(),true);
  ui.message('[frontier] Region 0_0 checkpoint saved');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ui.navigations.length,1);assert.equal(new URL(ui.navigations[0]).searchParams.get('RECOMP_RULE_FRONTIER_REGION'),'-1_0');
});
for(const transition of ['Region not playing','Region 0_0 defeated','Region 0_0 completed','Region 0_0 restoring checkpoint','Network region handoff unavailable','runtime failure','pagehide'])
test(`destination admission cancelled by ${transition} drains before rearming and suppresses a late result`,async()=>{
  let finish,signal,calls=0;
  const ui=controls('&world=our-kingdom','0_0',{check(world,key,options){++calls;signal=options.signal;return new Promise(resolve=>finish=resolve);}});
  ui.message('[frontier] Region 0_0 ready');const operation=ui.buttons.find(button=>button.textContent==='Save and travel east').onclick();
  if(transition==='runtime failure')ui.fail();else if(transition==='pagehide')ui.hide();else ui.message(`[frontier] ${transition}`);
  assert.equal(signal.aborted,true);const status=ui.status.textContent;
  ui.message('[frontier] Region 0_0 ready');for(const button of ui.buttons)button.onclick();
  for(const link of ui.links)link.onclick({preventDefault(){}});
  assert.equal(calls,1);assert.equal(ui.poll(),false);assert.equal(ui.navigations.length,0);
  assert.ok(ui.buttons.every(button=>button.disabled));
  finish();await operation;assert.equal(ui.poll(),false);assert.equal(ui.navigations.length,0);
  if(!['runtime failure','pagehide','Network region handoff unavailable'].includes(transition)){
    assert.match(ui.status.textContent,/Kingdom active/);
    assert.ok(ui.buttons.every(button=>!button.disabled));ui.buttons[0].onclick();assert.equal(ui.poll(),true);
    ui.message('[frontier] Region 0_0 checkpoint saved');await new Promise(resolve=>setImmediate(resolve));assert.equal(ui.navigations.length,0);
  }else assert.equal(ui.status.textContent,status);
});
test('page departure during durable journey publication suppresses late navigation and recovery clicks',async()=>{
  let finish;const ui=controls('&world=our-kingdom','0_0',{depart(){return new Promise(resolve=>finish=resolve);}});
  ui.message('[frontier] Region 0_0 ready');await ui.buttons.find(button=>button.textContent==='Save and travel east').onclick();
  assert.equal(ui.poll(),true);ui.message('[frontier] Region 0_0 checkpoint saved');await new Promise(resolve=>setImmediate(resolve));
  ui.hide();finish();await new Promise(resolve=>setImmediate(resolve));
  for(const link of ui.links)link.onclick({preventDefault(){}});
  for(const button of ui.buttons)button.onclick();
  assert.equal(ui.navigations.length,0);assert.equal(ui.poll(),false);assert.ok(ui.links.every(link=>link.style.display==='none'));
});
