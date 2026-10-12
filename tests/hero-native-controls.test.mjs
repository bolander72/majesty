// Exercise the actual browser controller with a small DOM/event harness.
// Storage APIs are controlled here; their real adapters are tested separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {selectedRegion,atlasURL,neighboringRegionURL} from '../web/world/region.mjs';
import {selectedWorld} from '../web/world/world-name.mjs';
import {nativeHeroRestoreConfig,completedHeroRestoreURL} from '../web/world/hero-route-launch.mjs';
import {NativeHeroSaveSession} from '../web/world/hero-save-session.mjs';
import {nativeHeroArrivalReady,nativeHeroArrivalPublished} from '../web/world/hero-travel-publication.mjs';
import {Sha256} from '../web/world/sha256.mjs';

const hash=text=>new Sha256().update(new TextEncoder().encode(text)).hex();
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
const tick=()=>new Promise(r=>setImmediate(r));
const binding='majesty-hero-runtime-v1|0_0|3200|502|27|42|0|native|469|7|77|'+'a'.repeat(64);
const crossing='[frontier] Hero crossing serial=1 region=0_0 target=1_0 previous-clock=6350 clock=6400 unit=502 agent=27 previous=8257535,1497101,821 accepted=8257537,1497101,821 phase=3 pending=7 original-tick=1 native-cells=4';
const held='[frontier] Hero save held serial=1 region=0_0 clock=6400 slot=1 bytes=4000 sha256='+'b'.repeat(64)+' phase=7 pending=0';
async function harness({stageGate,publicationGate,failPublication=false,generation=false,generatedStageGate,failPreparation=false,earlyGeneratedArrival=false,
 failCapturedPreparation=false,failCapturedPublication=false}={}){
 const elements=[],events=new Map(),globalEvents=new Map(),calls=[];
 function element(tag){const e={tag,children:[],style:{},disabled:false,hidden:false,
  appendChild(child){this.children.push(child);return child;},setAttribute(){}};elements.push(e);return e;}
 const document={body:element('body'),createElement:element,addEventListener(name,fn){events.set(name,fn);}};
 let current=new URL('http://localhost:8000/majesty/?'+new URLSearchParams({world:'controls',profile:'frontier_0_0',
  RECOMP_RULE_FRONTIER_REGION:'0_0',RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1',
  'hero-world':'c'.repeat(64),'hero-entity':'d'.repeat(64),'hero-layout':'halo-v1'}));
 const location={get href(){return current.href;},get search(){return current.search;},replace(){assert.fail('travel reloaded the page');}};
 const history={replaceState(state,title,url){current=new URL(url);calls.push({kind:'url',url:current.href});}};
 const Module={ENV:{RECOMP_FRONTIER_HERO_BINDING:binding,RECOMP_FRONTIER_HERO_HALO_BINDING:'majesty-hero-halo-v1|0_0|'+'a'.repeat(64),
  RECOMP_CONTENT_IDENTITY:'e'.repeat(64)+':'+'f'.repeat(64)}};
 const prepared=generation?{kind:'new',sourceRegion:'0_0',targetRegion:'1_0'}:
  {kind:'saved',sourceRegion:'0_0',targetRegion:'1_0',arrival:{kind:'proxy-home'},home:{kind:'existing'}};
 const generatedPrepared={kind:'generated',serial:1,sourceRegion:'0_0',targetRegion:'1_0',arrival:{kind:'proxy-home',destinationClock:100},home:{kind:'proposal',agentId:45}};
 const input={serial:1,sourceRegion:'0_0',targetRegion:'1_0',sourceClock:6400,
  sourceAlias:{unitId:502,agentId:27},...(generation?{kind:'majesty-hero-generation-input-v1',generation:{layout:'halo-v1'},homeAlias:{kind:'native',unitId:469,agentId:7}}:
  {destinationClock:9000,homeAlias:{kind:'proxy',unitId:0,agentId:45}})},text=JSON.stringify(input)+'\n';
 const request=Object.freeze({serial:1,sourceRegion:'0_0',targetRegion:'1_0',requestManifest:text,requestSize:Buffer.byteLength(text),
  requestSha256:hash(text),nativeAction:generation?'frontier-hero-generate-1':'frontier-hero-travel-1',nativeActionIssued:false});
 const clock=generation?100:9000;
 const native={serial:1,region:'1_0',clock,unitId:602,agentId:37,homeAgentId:45,size:4321,sha256:'9'.repeat(64)};
 const ready=nativeHeroArrivalReady(native),manifest=JSON.stringify({version:1,identitySha256:'1'.repeat(64),revision:2,nodeSha256:'2'.repeat(64)})+'\n';
 const publication={serial:1,region:'1_0',clock,owner:{unitId:602,agentId:37},home:{kind:'proxy',unitId:0,agentId:45},size:4321,sha256:native.sha256,
  ownerManifest:manifest,ownerManifestSha256:hash(manifest),acknowledgement:nativeHeroArrivalPublished(ready,manifest)};
 const receipt={...publication,runtimeBinding:`majesty-hero-runtime-v1|1_0|${clock}|602|37|42|0|proxy|0|45|77|`+native.sha256,
  haloBinding:'majesty-hero-halo-v1|1_0|'+native.sha256};
 const consumed=generation?`[frontier] Hero generation request consumed serial=1 source=0_0 target=1_0 bytes=${request.requestSize} selected-owner-verified=1 crossing-verified=1 target-absent-verified=1 source-retired=1 phase=7 pending=0`:
  `[frontier] Hero departure request consumed serial=1 source=0_0 target=1_0 bytes=${request.requestSize} selected-owner-verified=1 crossing-verified=1 destination-input-verified=1 source-retired=1 phase=7 pending=0`;
 const initialized='[frontier] Hero generation initialized serial=1 source=0_0 target=1_0 clock=100 slot=1 bytes=4000 sha256='+'b'.repeat(64)+' layout=halo-v1 shared-vertices=2480 original-generator=1 original-writer=1 source-roots-cleared=1 phase=7 pending=0 original-ticks=2 hero-imported=0 owner-published=0',
  arrival=`[frontier] Hero travel publication held receipt=${ready} phase=7 pending=0 ordinary-ticks=0`,
  resumed=`[frontier] Hero travel resumed serial=1 region=1_0 unit=602 agent=37 home=proxy/0/45 clock=${clock} manifest-sha256=${hash(manifest)} original-resume=1 fresh-binding=1 phase=3 pending=0`;
 let failures=failPublication?1:0,preparationFailures=failPreparation?1:0;
 const context={document,location,history,Module,URL,URLSearchParams,AbortController,Promise,
  selectedRegion,atlasURL,neighboringRegionURL,selectedWorld,nativeHeroRestoreConfig,completedHeroRestoreURL,NativeHeroSaveSession,
  nativeRegionSessionMode:()=>false,NativeRegionSession:class {},
  addEventListener(name,fn){globalEvents.set(name,fn);},
  recordJourney:async()=>{},recordJourneyArrival:async()=>{},checkNativeDestination:async()=>{},advanceNativeWorldRegion(){assert.fail();},
  confirmNativeHeroGameReady(world,value){calls.push({kind:'ready',world,binding:value});},
  queueNativeHeroGameSave(world,serial,options){calls.push({kind:'queue-save',world,serial,options});},
  async publishNativeHeroGameSave(world,boundary){calls.push({kind:'capture',world,boundary});
   if(failCapturedPublication)throw Error('controlled capture publication failure');return {};},
  async endNativeHeroGameSave(world,serial,options){calls.push({kind:'end',world,serial,options});},
  async restoreNativeHeroTravelHome(world,serial,target){calls.push({kind:'restore',world,serial,target});},
  async prepareNativeHeroTravelArrival(world,serial,target){calls.push({kind:'prepare',world,serial,target});
   if(failCapturedPreparation)throw Error('Actor is outside the destination region');return prepared;},
  async stageNativeHeroTravelArrival(world,serial,value,options){assert.equal(value,generation?generatedPrepared:prepared);calls.push({kind:'stage-target'});
   if(generation&&earlyGeneratedArrival)events.get('recomp-runtime-message')({detail:arrival});
   if(generation&&generatedStageGate)await generatedStageGate.promise;options.signal.throwIfAborted();return {};},
  async stageNativeHeroTravelDeparture(world,serial,value,options){assert.equal(value,prepared);assert.equal(serial,1);
   calls.push({kind:'stage-source'});if(stageGate)await stageGate.promise;options.signal.throwIfAborted();return request;},
  confirmNativeHeroTravelDeparture(world,serial,value,line){assert.equal(value,request);assert.equal(line,consumed);calls.push({kind:'departed'});},
  async stageNativeHeroTravelGeneration(world,serial,value){assert.equal(value,prepared);calls.push({kind:'stage-generation'});return request;},
  confirmNativeHeroGenerationDeparture(world,serial,value,line){assert.equal(value,request);assert.equal(line,consumed);calls.push({kind:'generation-departed'});},
  async prepareNativeHeroGeneratedArrival(world,serial,value,line,options){assert.equal(value,request);assert.equal(line,initialized);
   calls.push({kind:'prepare-generated'});options.signal.throwIfAborted();if(preparationFailures-- >0)throw Error('controlled preparation failure');return generatedPrepared;},
  async publishNativeHeroTravelArrival(world,serial,value,packet,options){assert.equal(value,request);assert.equal(packet,ready);
   calls.push({kind:'publish-arrival'});if(publicationGate)await publicationGate.promise;options.signal.throwIfAborted();
   if(failures-- >0)throw Error('controlled publication failure');return publication;},
  confirmNativeHeroTravelResume(world,serial,value,line){assert.equal(value,request);assert.equal(line,resumed);calls.push({kind:'resumed'});return receipt;},
 };
 const code=(await readFile('web/world/native.mjs','utf8')).replace(/^import .*;\n/gm,'');
 runInNewContext(code,context,{timeout:1000});
 const emit=line=>events.get('recomp-runtime-message')({detail:line});
 const poll=name=>{const detail={name,pending:false};events.get('recomp-action-poll')({detail});return detail.pending;};
 const button=text=>{const b=elements.find(e=>e.tag==='button'&&e.textContent===text);assert.ok(b,text);return b;};
 const status=()=>elements.find(e=>e.tag==='output').textContent;
 emit('[frontier] Selected hero bound region=0_0 unit=502 agent=27 home=469/7 clock=3200 original-registry=1 reciprocal-home=1');
 emit('[frontier] Region 0_0 ready');emit(crossing);emit(held);await tick();await tick();
 return {emit,poll,button,status,calls,location,Module,request,consumed,initialized,arrival,resumed,receipt,
  hide:()=>globalEvents.get('pagehide')()};
}

test('failed neighbor preparation releases the already published capture as saved so the native owner refreshes',async()=>{
 const f=await harness({failCapturedPreparation:true});assert.match(f.status(),/Journey saved.*Resuming this kingdom/);
 assert.equal(f.calls.filter(c=>c.kind==='stage-target'||c.kind==='stage-source').length,0);
 assert.equal(f.poll('frontier-hero-save-finish'),true);assert.equal(f.poll('frontier-hero-save-saved-1'),true);
 assert.equal(f.poll('frontier-hero-save-failed-1'),false);
 f.emit('[frontier] Hero save released serial=1 region=0_0 clock=6400 result=saved phase=7 pending=3');
 f.emit('[frontier] Hero save resumed serial=1 region=0_0 clock=6400 phase=3 pending=0');await tick();await tick();
 assert.equal(f.calls.filter(c=>c.kind==='end').length,1);assert.equal(f.button('Save hero journey').disabled,false);
 f.hide();await tick();
});
test('a failed source publication still releases a failed save rather than claiming a selected capture',async()=>{
 const f=await harness({failCapturedPublication:true});assert.match(f.status(),/Journey publication failed/);
 assert.equal(f.calls.filter(c=>c.kind==='prepare'||c.kind==='restore').length,0);
 assert.equal(f.poll('frontier-hero-save-finish'),true);assert.equal(f.poll('frontier-hero-save-failed-1'),true);
 assert.equal(f.poll('frontier-hero-save-saved-1'),false);f.hide();await tick();
});
test('unexplored travel waits for initialized generation before staging arrival and resuming with fresh IDs',async()=>{
 const f=await harness({generation:true}),travel=f.button('Travel to the neighboring kingdom');
 assert.equal(travel.disabled,false);travel.onclick();await tick();assert.equal(f.calls.filter(c=>c.kind==='stage-generation').length,1);
 assert.equal(f.poll('frontier-hero-travel-1'),false);assert.equal(f.poll('frontier-hero-generate-1'),true);
 assert.equal(f.poll('frontier-hero-generate-1'),false);f.emit(f.consumed);f.emit('[frontier] Region not playing');
 assert.equal(f.poll('frontier-hero-save-finish'),false);assert.equal(f.button('Continue in this kingdom').disabled,true);
 f.emit(f.initialized.replace('clock=100','clock=0'));assert.equal(f.calls.filter(c=>c.kind==='prepare-generated').length,0);
 f.emit(f.initialized);await tick();await tick();assert.equal(f.calls.filter(c=>c.kind==='prepare-generated').length,1);
 assert.equal(f.calls.filter(c=>c.kind==='stage-target').length,1);f.emit(f.arrival);await tick();await tick();f.emit(f.resumed);await tick();
 assert.equal(f.calls.filter(c=>c.kind==='resumed').length,1);assert.equal(new URL(f.location.href).searchParams.get('profile'),'frontier_1_0');
 assert.equal(f.Module.ENV.RECOMP_FRONTIER_HERO_BINDING,f.receipt.runtimeBinding);f.hide();await tick();
});
test('a generated arrival received during input close is buffered until its staging job drains',async()=>{
 const gate=deferred(),f=await harness({generation:true,generatedStageGate:gate,earlyGeneratedArrival:true});
 f.button('Travel to the neighboring kingdom').onclick();await tick();f.poll(f.request.nativeAction);f.emit(f.consumed);f.emit(f.initialized);await tick();
 assert.equal(f.calls.filter(c=>c.kind==='publish-arrival').length,0);gate.resolve();await tick();await tick();
 assert.equal(f.calls.filter(c=>c.kind==='publish-arrival').length,1);f.emit(f.resumed);await tick();assert.equal(f.calls.filter(c=>c.kind==='resumed').length,1);
 f.hide();await tick();
});
test('generated preparation failure offers a retry without continuing or retiring the captured source again',async()=>{
 const f=await harness({generation:true,failPreparation:true});f.button('Travel to the neighboring kingdom').onclick();await tick();
 f.poll(f.request.nativeAction);f.emit(f.consumed);f.emit(f.initialized);await tick();await tick();
 const retry=f.button('Retry preparing the arrival');assert.equal(retry.style.display,'block');assert.equal(retry.disabled,false);
 assert.equal(f.poll('frontier-hero-save-finish'),false);assert.equal(f.button('Continue in this kingdom').disabled,true);
 retry.onclick();await tick();await tick();assert.equal(f.calls.filter(c=>c.kind==='prepare-generated').length,2);
 assert.equal(f.calls.filter(c=>c.kind==='stage-generation').length,1);f.emit(f.arrival);await tick();f.emit(f.resumed);await tick();f.hide();await tick();
});
test('page ending discards a buffered generated arrival and aborts its outstanding staging job',async()=>{
 const gate=deferred(),f=await harness({generation:true,generatedStageGate:gate,earlyGeneratedArrival:true});
 f.button('Travel to the neighboring kingdom').onclick();await tick();f.poll(f.request.nativeAction);f.emit(f.consumed);f.emit(f.initialized);await tick();
 f.hide();gate.resolve();await tick();await tick();
 assert.equal(f.calls.filter(c=>c.kind==='publish-arrival'||c.kind==='resumed').length,0);
 assert.equal(f.calls.filter(c=>c.kind==='end').at(-1).options.abandoned,true);
 assert.equal(f.poll('frontier-hero-save-finish'),false);
});
test('failed original generation preserves recovery and ends the old source controls',async()=>{
 const f=await harness({generation:true});f.button('Travel to the neighboring kingdom').onclick();await tick();
 f.poll(f.request.nativeAction);f.emit(f.consumed);
 f.emit('[frontier] Hero generation load refused serial=1 captured-recovery-preserved=1');await tick();
 assert.match(f.status(),/captured journey is preserved/);assert.equal(f.poll('frontier-hero-save-finish'),false);
 assert.equal(f.calls.filter(c=>c.kind==='end').at(-1).options.abandoned,true);
 assert.equal(f.calls.filter(c=>c.kind==='prepare-generated'||c.kind==='publish-arrival').length,0);f.hide();await tick();
});
for(const generation of [false,true])test(`arrival refusal preserves recovery and stops ${generation?'generated':'saved'} travel controls`,async()=>{
 const f=await harness({generation});f.button('Travel to the neighboring kingdom').onclick();await tick();
 f.poll(f.request.nativeAction);f.emit(f.consumed);
 if(generation){f.emit(f.initialized);await tick();await tick();}
 const refused=`[frontier] Hero arrival refused serial=1 source=0_0 target=1_0 clock=${generation?100:9000} phase=7 pending=0 captured-recovery-preserved=1 owner-published=0`;
 for(const bad of [refused.replace('serial=1','serial=2'),refused.replace('target=1_0','target=0_1'),
  refused.replace('clock=','clock=1'),refused.replace('owner-published=0','owner-published=1'),refused+' extra=1']){
  f.emit(bad);assert.equal(f.calls.filter(c=>c.kind==='end').length,0);
 }
 f.emit(refused);await tick();assert.match(f.status(),/hero could not enter.*captured journey is preserved/);
 assert.equal(f.poll('frontier-hero-save-finish'),false);
 assert.equal(f.calls.filter(c=>c.kind==='end').at(-1).options.abandoned,true);
 f.emit(f.arrival);f.emit(f.resumed);await tick();
 assert.equal(f.calls.filter(c=>c.kind==='publish-arrival'||c.kind==='resumed').length,0);
 assert.equal(new URL(f.location.href).searchParams.get('profile'),'frontier_0_0');f.hide();await tick();
});

test('actual controller stages before issuing one action, publishes arrival and saves again with fresh IDs',async()=>{
 const gate=deferred(),f=await harness({stageGate:gate});
 const travel=f.button('Travel to the neighboring kingdom'),stay=f.button('Continue in this kingdom');
 assert.equal(travel.disabled,false);travel.onclick();await tick();assert.equal(travel.disabled,true);
 assert.equal(f.poll('frontier-hero-travel-1'),false);gate.resolve();await tick();await tick();
 assert.equal(stay.disabled,true);assert.equal(f.poll('frontier-hero-travel-1'),true);
 assert.equal(f.poll('frontier-hero-travel-1'),false);assert.equal(f.poll('frontier-hero-save-finish'),false);
 f.emit(f.consumed);f.emit('[frontier] Region not playing');assert.equal(f.calls.filter(c=>c.kind==='end').length,0);
 f.emit(f.arrival);await tick();await tick();assert.equal(f.calls.filter(c=>c.kind==='publish-arrival').length,1);
 f.emit(f.resumed);await tick();assert.equal(f.calls.filter(c=>c.kind==='resumed').length,1);
 assert.equal(new URL(f.location.href).searchParams.get('profile'),'frontier_1_0');
 assert.equal(f.Module.ENV.RECOMP_FRONTIER_HERO_BINDING,f.receipt.runtimeBinding);
 assert.match(f.status(),/kingdom active/);f.button('Save hero journey').onclick();assert.equal(f.poll('frontier-hero-save'),true);
 assert.equal(f.calls.filter(c=>c.kind==='queue-save').at(-1).serial,2);
 f.emit('[frontier] Hero save held serial=2 region=1_0 clock=9500 slot=0 bytes=4400 sha256='+'8'.repeat(64)+' phase=7 pending=0');
 await tick();assert.equal(f.calls.filter(c=>c.kind==='capture').at(-1).boundary.region,'1_0');
 f.hide();await tick();
});
test('early native resume waits for publication and source loading messages do not abandon travel',async()=>{
 const gate=deferred(),f=await harness({publicationGate:gate});f.button('Travel to the neighboring kingdom').onclick();await tick();
 assert.equal(f.poll(f.request.nativeAction),true);f.emit(f.consumed);f.emit('[frontier] Region not playing');f.emit(f.arrival);
 await tick();f.emit(f.resumed);f.emit('[frontier] Region 1_0 ready');
 assert.equal(f.calls.filter(c=>c.kind==='resumed'||c.kind==='end').length,0);
 gate.resolve();await tick();await tick();assert.equal(f.calls.filter(c=>c.kind==='resumed').length,1);
 assert.equal(f.button('Save hero journey').disabled,false);f.hide();await tick();
});
test('a fast subsequent boundary is replayed after rebind and the old publication job cannot clear its new save job',async()=>{
 const gate=deferred(),f=await harness({publicationGate:gate});f.button('Travel to the neighboring kingdom').onclick();await tick();
 f.poll(f.request.nativeAction);f.emit(f.consumed);f.emit(f.arrival);await tick();f.emit(f.resumed);
 f.emit('[frontier] Hero crossing serial=2 region=1_0 target=0_0 previous-clock=9050 clock=9100 unit=602 agent=37 previous=131073,1497101,821 accepted=131071,1497101,821 phase=3 pending=7 original-tick=1 native-cells=4');
 f.emit('[frontier] Hero save held serial=2 region=1_0 clock=9100 slot=0 bytes=4400 sha256='+'8'.repeat(64)+' phase=7 pending=0');
 assert.equal(f.calls.filter(c=>c.kind==='capture').length,1);
 gate.resolve();await tick();await tick();
 assert.equal(f.calls.filter(c=>c.kind==='resumed').length,1);
 assert.equal(f.calls.filter(c=>c.kind==='queue-save').at(-1).serial,2);
 assert.equal(f.calls.filter(c=>c.kind==='capture').at(-1).boundary.clock,9100);
 assert.equal(f.calls.filter(c=>c.kind==='capture').at(-1).boundary.region,'1_0');f.hide();await tick();
});
test('failed arrival publication offers a retry and never resumes the captured source',async()=>{
 const f=await harness({failPublication:true});f.button('Travel to the neighboring kingdom').onclick();await tick();
 f.poll(f.request.nativeAction);f.emit(f.consumed);f.emit(f.arrival);await tick();await tick();
 const retry=f.button('Retry saving the arrival');assert.equal(retry.style.display,'block');assert.equal(retry.disabled,false);
 assert.equal(f.poll('frontier-hero-save-finish'),false);assert.equal(f.button('Continue in this kingdom').disabled,true);
 retry.onclick();await tick();await tick();f.emit(f.resumed);await tick();
 assert.equal(f.calls.filter(c=>c.kind==='publish-arrival').length,2);assert.equal(f.calls.filter(c=>c.kind==='resumed').length,1);
 f.hide();await tick();
});
test('retry after an early resume and failed close replays the next held crossing with fresh IDs',async()=>{
 const gate=deferred(),f=await harness({publicationGate:gate,failPublication:true});
 f.button('Travel to the neighboring kingdom').onclick();await tick();f.poll(f.request.nativeAction);
 f.emit(f.consumed);f.emit(f.arrival);await tick();f.emit(f.resumed);
 f.emit('[frontier] Hero crossing serial=2 region=1_0 target=0_0 previous-clock=9050 clock=9100 unit=602 agent=37 previous=131073,1497101,821 accepted=131071,1497101,821 phase=3 pending=7 original-tick=1 native-cells=4');
 f.emit('[frontier] Hero save held serial=2 region=1_0 clock=9100 slot=0 bytes=4400 sha256='+'8'.repeat(64)+' phase=7 pending=0');
 gate.resolve();await tick();await tick();assert.equal(f.calls.filter(c=>c.kind==='resumed').length,0);
 const retry=f.button('Retry saving the arrival');assert.equal(retry.disabled,false);retry.onclick();await tick();await tick();
 assert.equal(f.calls.filter(c=>c.kind==='resumed').length,1);
 assert.equal(f.calls.filter(c=>c.kind==='publish-arrival').length,2);
 assert.equal(f.calls.filter(c=>c.kind==='queue-save').at(-1).serial,2);
 assert.equal(f.calls.filter(c=>c.kind==='capture').at(-1).boundary.clock,9100);
 assert.equal(f.calls.filter(c=>c.kind==='capture').at(-1).boundary.region,'1_0');
 assert.equal(f.Module.ENV.RECOMP_FRONTIER_HERO_BINDING,f.receipt.runtimeBinding);f.hide();await tick();
});
test('refusal before retirement restores the source choice, while navigation cancels unissued staging',async()=>{
 const f=await harness();f.button('Travel to the neighboring kingdom').onclick();await tick();f.poll(f.request.nativeAction);
 f.emit('[frontier] Hero departure request refused serial=1 region=0_0 clock=6400 phase=7 pending=0');
 assert.equal(f.button('Continue in this kingdom').disabled,false);f.button('Continue in this kingdom').onclick();
 assert.equal(f.poll('frontier-hero-save-finish'),true);assert.equal(f.poll('frontier-hero-save-saved-1'),true);f.hide();await tick();
 const gate=deferred(),g=await harness({stageGate:gate});g.button('Travel to the neighboring kingdom').onclick();await tick();
 g.hide();gate.resolve();await tick();assert.equal(g.poll(g.request.nativeAction),false);
 assert.equal(g.calls.filter(c=>c.kind==='departed'||c.kind==='publish-arrival').length,0);
});
