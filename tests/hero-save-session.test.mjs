import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeHeroSaveSession} from '../web/world/hero-save-session.mjs';
import {Sha256} from '../web/world/sha256.mjs';
import {nativeHeroArrivalReady,nativeHeroArrivalPublished} from '../web/world/hero-travel-publication.mjs';
const binding='majesty-hero-runtime-v1|0_0|3200|502|27|42|0|native|469|7|77|'+'a'.repeat(64);
const bound='[frontier] Selected hero bound region=0_0 unit=502 agent=27 home=469/7 clock=3200 original-registry=1 reciprocal-home=1';
const held='[frontier] Hero save held serial=1 region=0_0 clock=6400 slot=1 bytes=4000 sha256='+'b'.repeat(64)+' phase=7 pending=0';
function session(){const s=new NativeHeroSaveSession(binding);assert.equal(s.message(bound).kind,'bound');s.message('[frontier] Region 0_0 ready');return s;}
test('native hero save requires bound readiness, a consumed request, held bytes and both resume acknowledgements',()=>{
  const s=new NativeHeroSaveSession(binding);assert.throws(()=>s.queue());
  assert.equal(s.message(bound.replace('unit=502','unit=999')),null);assert.equal(s.message('[frontier] Region 0_0 ready'),null);
  s.message(bound);assert.throws(()=>s.queue());s.message('[frontier] Region 0_0 ready');
  assert.equal(s.queue(),1);assert.equal(s.message(held),null);assert.throws(()=>s.finish(true));
  assert.equal(s.poll('frontier-hero-save').serial,1);assert.equal(s.poll('frontier-hero-save'),null);
  assert.deepEqual(s.message(held).boundary,{serial:1,region:'0_0',clock:6400,slot:1,size:4000,sha256:'b'.repeat(64)});
  assert.equal(s.poll('frontier-hero-save-finish'),null);s.finish(true);
  assert.equal(s.poll('frontier-hero-save-finish').kind,'finish-ready');assert.equal(s.poll('frontier-hero-save-failed-1'),null);
  assert.equal(s.poll('frontier-hero-save-saved-1').kind,'acknowledged');
  assert.equal(s.message('[frontier] Hero save resumed serial=1 region=0_0 clock=6400 phase=3 pending=0'),null);
  assert.equal(s.message('[frontier] Hero save released serial=1 region=0_0 clock=6400 result=saved phase=7 pending=3').kind,'released');
  assert.equal(s.message('[frontier] Hero save resumed serial=1 region=0_0 clock=6400 phase=3 pending=0').saved,true);
  assert.equal(s.busy,false);assert.equal(s.queue(),2);
});
test('outdated, duplicate and malformed held checkpoints cannot grant publication',()=>{
  const s=session();s.queue();s.poll('frontier-hero-save');
  for(const line of [held.replace('serial=1','serial=2'),held.replace('region=0_0','region=1_0'),
    held.replace('clock=6400','clock=100'),held.replace('slot=1','slot=2'),held.replace('bytes=4000','bytes=67108865'),
    held.replace('phase=7','phase=3'),held.replace('pending=0','pending=3'),held+' serial=1'])assert.equal(s.message(line),null);
  s.message(held);assert.equal(s.message(held),null);assert.throws(()=>s.queue());
});
test('failed publication resumes only after its matching native result; abandonment stops further saves',()=>{
  const s=session();s.queue();s.poll('frontier-hero-save');s.message(held);s.finish(false);
  s.poll('frontier-hero-save-failed-1');
  assert.equal(s.message('[frontier] Hero save released serial=1 region=0_0 clock=6400 result=saved phase=7 pending=3'),null);
  s.message('[frontier] Hero save released serial=1 region=0_0 clock=6400 result=failed phase=7 pending=3');
  assert.equal(s.message('[frontier] Hero save resumed serial=1 region=0_0 clock=6400 phase=3 pending=0').saved,false);
  s.queue();s.poll('frontier-hero-save');
  assert.equal(s.message('[frontier] Hero save abandoned serial=1 region=0_0'),null);
  assert.equal(s.message('[frontier] Hero save abandoned serial=2 region=0_0').kind,'abandoned');
  assert.equal(s.enabled,false);assert.throws(()=>s.queue());assert.equal(s.poll('frontier-hero-save'),null);
});
test('native write failure completes the same serial through the actual resumed event',()=>{
  const s=session();s.queue();s.poll('frontier-hero-save');
  assert.equal(s.message('[frontier] Hero save failed serial=1 region=0_0 clock=6400 phase=7 pending=3').kind,'failed');
  assert.equal(s.busy,true);assert.equal(s.message('[frontier] Hero save resumed serial=1 region=0_0 clock=6400 phase=3 pending=0').saved,false);
  assert.equal(s.queue(),2);
});
const autoCrossing='[frontier] Hero crossing serial=1 region=0_0 target=1_0 previous-clock=6350 clock=6400 unit=502 agent=27 previous=8257535,1497101,821 accepted=8257537,1497101,821 phase=3 pending=7 original-tick=1 native-cells=4';
test('only verified halo sessions accept original crossing messages and bind the held clock',()=>{
  const binding='majesty-hero-runtime-v1|0_0|3200|502|27|42|0|native|469|7|77|'+'a'.repeat(64),halo='majesty-hero-halo-v1|0_0|'+'a'.repeat(64);
  assert.throws(()=>new NativeHeroSaveSession(binding,{haloBinding:halo.replace('0_0','1_0')}));
  for(const enabled of [false,true]){
    const session=new NativeHeroSaveSession(binding,enabled?{haloBinding:halo}:{});
    assert.equal(session.message(autoCrossing),null);
    session.message('[frontier] Selected hero bound region=0_0 unit=502 agent=27 home=469/7 clock=3200 original-registry=1 reciprocal-home=1');
    session.message('[frontier] Region 0_0 ready');
    for(const line of [autoCrossing.replace('unit=502','unit=999'),autoCrossing.replace('clock=6400','clock=6350'),
      autoCrossing.replace('serial=1','serial=2'),autoCrossing.replace('target=1_0','target=0_1'),autoCrossing+' extra=1'])
      assert.equal(session.message(line),null);
    session.queue();const crossing=session.message(autoCrossing);
    if(!enabled){assert.equal(crossing,null);assert.equal(session.poll('frontier-hero-save').kind,'requested');continue;}
    assert.equal(crossing.kind,'crossing');assert.equal(crossing.crossing.accepted.x,8257537);
    assert.equal(session.poll('frontier-hero-save'),null);assert.equal(session.message(autoCrossing),null);
    const held='[frontier] Hero save held serial=1 region=0_0 clock=6400 slot=1 bytes=4000 sha256='+'b'.repeat(64)+' phase=7 pending=0';
    assert.equal(session.message(held.replace('clock=6400','clock=6450')),null);
    assert.equal(session.message('[frontier] Hero save failed serial=1 region=0_0 clock=6450 phase=7 pending=3'),null);
    assert.equal(session.message(held).crossing,crossing.crossing);assert.equal(session.poll('frontier-hero-save-finish'),null);
    session.finish(true);assert.equal(session.poll('frontier-hero-save-saved-1').kind,'acknowledged');
  }
});

const hash=text=>new Sha256().update(new TextEncoder().encode(text)).hex();
function travel(){
 const s=new NativeHeroSaveSession(binding,{haloBinding:'majesty-hero-halo-v1|0_0|'+'a'.repeat(64)});
 s.message(bound);s.message('[frontier] Region 0_0 ready');s.message(autoCrossing);s.message(held);
 const input={serial:1,sourceRegion:'0_0',targetRegion:'1_0',sourceClock:6400,destinationClock:9000,
  sourceAlias:{unitId:502,agentId:27},homeAlias:{kind:'proxy',unitId:0,agentId:45}},text=JSON.stringify(input)+'\n';
 const request={serial:1,sourceRegion:'0_0',targetRegion:'1_0',requestManifest:text,requestSize:Buffer.byteLength(text),
  requestSha256:hash(text),nativeAction:'frontier-hero-travel-1',nativeActionIssued:false};
 const consumed=`[frontier] Hero departure request consumed serial=1 source=0_0 target=1_0 bytes=${request.requestSize} selected-owner-verified=1 crossing-verified=1 destination-input-verified=1 source-retired=1 phase=7 pending=0`;
 const native={serial:1,region:'1_0',clock:9000,unitId:602,agentId:37,homeAgentId:45,size:4321,sha256:'d'.repeat(64)};
 const ready=nativeHeroArrivalReady(native),line=`[frontier] Hero travel publication held receipt=${ready} phase=7 pending=0 ordinary-ticks=0`;
 const manifest=JSON.stringify({version:1,identitySha256:'e'.repeat(64),revision:2,nodeSha256:'f'.repeat(64)})+'\n';
 const publication={serial:1,region:'1_0',clock:9000,owner:{unitId:602,agentId:37},home:input.homeAlias,
  size:4321,sha256:native.sha256,ownerManifest:manifest,ownerManifestSha256:hash(manifest),acknowledgement:nativeHeroArrivalPublished(ready,manifest)};
 const resumed=`[frontier] Hero travel resumed serial=1 region=1_0 unit=602 agent=37 home=proxy/0/45 clock=9000 manifest-sha256=${hash(manifest)} original-resume=1 fresh-binding=1 phase=3 pending=0`;
 const receipt={...publication,runtimeBinding:'majesty-hero-runtime-v1|1_0|9000|602|37|42|0|proxy|0|45|77|'+native.sha256,
  haloBinding:'majesty-hero-halo-v1|1_0|'+native.sha256};
 return {s,request,consumed,line,publication,resumed,receipt};
}
test('travel issues one staged action and rebinds fresh aliases without resetting the save serial',()=>{
 const f=travel();f.s.queueTravel(f.request);assert.equal(f.s.travelling,true);assert.throws(()=>f.s.finish(true));
 assert.equal(f.s.poll('frontier-hero-travel-2'),null);assert.equal(f.s.poll('frontier-hero-save-finish'),null);
 assert.equal(f.s.message(f.consumed),null);
 assert.equal(f.s.poll('frontier-hero-travel-1').kind,'travel-requested');assert.equal(f.s.poll('frontier-hero-travel-1'),null);
 assert.equal(f.s.message(f.line),null);assert.equal(f.s.message(f.consumed).kind,'travel-departed');
 assert.equal(f.s.message(f.consumed),null);assert.equal(f.s.message(f.line).kind,'travel-held');assert.equal(f.s.message(f.line),null);
 assert.equal(f.s.acceptTravelPublication(f.publication),null);assert.throws(()=>f.s.completeTravel(f.receipt));
 assert.equal(f.s.message(f.resumed).kind,'travel-resumed');assert.equal(f.s.message(f.resumed),null);
 f.s.completeTravel(f.receipt);assert.equal(f.s.travelling,false);assert.equal(f.s.busy,false);assert.equal(f.s.queue(),2);
 f.s.poll('frontier-hero-save');assert.equal(f.s.message(held.replace('serial=1','serial=2')),null);
 assert.equal(f.s.message('[frontier] Hero save held serial=2 region=1_0 clock=9500 slot=0 bytes=4400 sha256='+
  'c'.repeat(64)+' phase=7 pending=0').kind,'held');
});
test('a native resume arriving before publication completion is retained until its exact journal head is known',()=>{
 const f=travel();f.s.queueTravel(f.request);f.s.poll(f.request.nativeAction);f.s.message(f.consumed);f.s.message(f.line);
 assert.equal(f.s.message(f.resumed),null);assert.equal(f.s.busy,true);
 assert.equal(f.s.acceptTravelPublication(f.publication).kind,'travel-resumed');f.s.completeTravel(f.receipt);
 assert.equal(f.s.queue(),2);
});
test('refused departure retains the held source and permits retry or continuing there',()=>{
 for(const retry of [false,true]){
  const f=travel();f.s.queueTravel(f.request);f.s.poll(f.request.nativeAction);
  assert.equal(f.s.message('[frontier] Hero departure request refused serial=2 region=0_0 clock=6400 phase=7 pending=0'),null);
  assert.equal(f.s.message('[frontier] Hero departure request refused serial=1 region=0_0 clock=6400 phase=7 pending=0').kind,'travel-refused');
  assert.equal(f.s.travelling,false);
  if(retry){f.s.queueTravel(f.request);assert.equal(f.s.poll(f.request.nativeAction).kind,'travel-requested');}
  else{f.s.finish(true);assert.equal(f.s.poll('frontier-hero-save-saved-1').kind,'acknowledged');}
 }
});
test('altered departure requests, arrival receipts, publication heads and resume aliases cannot enable travel',()=>{
 const f=travel();
 for(const change of [{serial:2},{sourceRegion:'1_0'},{targetRegion:'0_1'},{nativeActionIssued:true},
  {nativeAction:'frontier-hero-travel-2'},{requestSize:1},{requestSha256:'0'.repeat(64)}])assert.throws(()=>f.s.queueTravel({...f.request,...change}));
 f.s.queueTravel(f.request);f.s.poll(f.request.nativeAction);
 for(const line of [f.consumed+' extra=1',f.consumed.replace('source-retired=1','source-retired=0'),f.consumed.replace('target=1_0','target=0_1')])
  assert.equal(f.s.message(line),null);
 f.s.message(f.consumed);
 for(const line of [f.line.replace('|9000|','|9001|'),f.line.replace('|45|','|46|'),f.line.replace('phase=7','phase=3')])assert.equal(f.s.message(line),null);
 f.s.message(f.line);
 for(const change of [{serial:2},{clock:9001},{owner:{unitId:603,agentId:37}},{home:{kind:'native',unitId:469,agentId:7}},
  {ownerManifestSha256:'0'.repeat(64)},{acknowledgement:'wrong'}])assert.throws(()=>f.s.acceptTravelPublication({...f.publication,...change}));
 f.s.acceptTravelPublication(f.publication);
 for(const line of [f.resumed.replace('unit=602','unit=502'),f.resumed.replace('home=proxy/0/45','home=native/469/7'),
  f.resumed.replace(f.publication.ownerManifestSha256,'0'.repeat(64)),f.resumed+' extra=1'])assert.equal(f.s.message(line),null);
 f.s.message(f.resumed);
 assert.throws(()=>f.s.completeTravel({...f.receipt,runtimeBinding:f.receipt.runtimeBinding.replace('|602|','|502|')}));
 f.s.completeTravel(f.receipt);
});
test('stopping queued travel clears its action before native consumption',()=>{
 const f=travel();f.s.queueTravel(f.request);f.s.stop();assert.equal(f.s.poll(f.request.nativeAction),null);
 assert.equal(f.s.message(f.consumed),null);assert.throws(()=>f.s.queue());
});
test('one subsequent crossing and held save survive a delayed publication without retaining unrelated game logs',()=>{
 const f=travel();f.s.queueTravel(f.request);f.s.poll(f.request.nativeAction);f.s.message(f.consumed);f.s.message(f.line);
 f.s.message(f.resumed);
 const crossing='[frontier] Hero crossing serial=2 region=1_0 target=0_0 previous-clock=9050 clock=9100 unit=602 agent=37 previous=131073,1497101,821 accepted=131071,1497101,821 phase=3 pending=7 original-tick=1 native-cells=4';
 const held='[frontier] Hero save held serial=2 region=1_0 clock=9100 slot=0 bytes=4400 sha256='+'7'.repeat(64)+' phase=7 pending=0';
 assert.equal(f.s.message(crossing.replace('serial=2','serial=3')),null);
 assert.equal(f.s.message(crossing),null);assert.equal(f.s.message(held.replace('clock=9100','clock=9200')),null);
 for(let n=0;n<1000;++n)assert.equal(f.s.message('[frontier] unrelated log '+n),null);
 assert.equal(f.s.message(held),null);
 assert.equal(f.s.acceptTravelPublication(f.publication).kind,'travel-resumed');
 const buffered=f.s.completeTravel(f.receipt);assert.deepEqual(buffered,[crossing,held]);assert.equal(Object.isFrozen(buffered),true);
 assert.equal(f.s.message(buffered[0]).serial,2);assert.equal(f.s.message(buffered[1]).boundary.serial,2);
});
