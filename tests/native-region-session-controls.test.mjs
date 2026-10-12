import test from 'node:test';
import assert from 'node:assert/strict';
const moduleRoot=new URL(process.env.MAJESTY_DESTINATION_STAGED==='1'?'../upstream/majesty-recomp/build/web-site/world/':'../web/world/',import.meta.url);
const {NativeRegionSession}=await import(new URL('native-session-controls.mjs',moduleRoot));
const {selectedRegion,nativeRegionURL,neighboringRegionURL,atlasURL}=await import(new URL('region.mjs',moduleRoot));
const root='/opfs/majesty/profile/native-world-fixture';
const base='http://localhost:8000/majesty/?world=fixture&profile=frontier_0_0&RECOMP_RULE_FRONTIER_REGION=0_0&RECOMP_RULE_FRONTIER_SESSION=v1&RECOMP_RULE_FRONTIER_SEEDED_GENERATION=1&RECOMP_RULE_FRONTIER_CONNECTED_TERRAIN=v1';
function session(){const s=new NativeRegionSession(selectedRegion(new URL(base).search),root);return s;}
function enable(s){assert.deepEqual(s.message(`[frontier] Session enabled version=v1 region=0_0 root=${root}`),{kind:'enabled'});}
function save(s,serial,from,direction){return s.message(`[frontier] Session checkpoint serial=${serial} region=${from} clock=33400 direction=${direction}`);}
function quit(s,serial,from){return s.message(`[frontier] Session quit serial=${serial} region=${from} saved-clock=33400 clock=0 loading=0`);}
function unload(s,serial,from,to){return s.message(`[frontier] Session unloaded serial=${serial} source=${from} target=${to} world-null=1 profile=${root}/frontier_${to}`);}
function attach(s,serial,to,mode){return s.message(`[frontier] Session attached serial=${serial} region=${to} mode=${mode} phase=1 pending=2`);}
const released='[frontier] Session released serial=1 region=0_0 roots-freed=1,1,1,1,1,1 heap-before=2000000 heap-after=500000 blocks-before=100 blocks-after=20 clock=0';
const removed='[frontier] Session release observer removed serial=1 hooks=1 retained-roots=0';
test('camera boundary gestures require the advertised contract, current source and fresh sequence',()=>{
  const line='[frontier] Session boundary serial=0 region=0_0 direction=west gesture=1';
  for(const advertisement of ['', ' crossing=v2', ' crossing=v1 release=v1']){
    const s=session();s.message(`[frontier] Session enabled version=v1 region=0_0 root=${root}${advertisement}`);
    assert.equal(s.message(line),null);
  }
  const s=session();s.message(`[frontier] Session enabled version=v1 region=0_0 root=${root} release=v2 crossing=v1`);
  for(const invalid of [line.replace('serial=0','serial=1'),line.replace('region=0_0','region=-1_0'),
      line.replace('direction=west','direction=northwest'),line.replace('gesture=1','gesture=0'),
      line.replace('gesture=1','gesture=NaN'),line.replace('gesture=1','gesture=9007199254740992'),line+' gesture=2'])
    assert.equal(s.message(invalid),null);
  assert.deepEqual(s.message(line),{kind:'boundary',direction:'west'});
  assert.equal(s.message(line),null);
  s.queue('west',neighboringRegionURL('west',base),'new');
  assert.equal(s.message(line.replace('gesture=1','gesture=2')),null);
  s.cancel();assert.equal(s.message(line.replace('gesture=1','gesture=2')),null);
  assert.deepEqual(s.message(line.replace('gesture=1','gesture=3')),{kind:'boundary',direction:'west'});
  s.stop();assert.equal(s.message(line.replace('gesture=1','gesture=4')),null);
});
test('terrain release contract requires both map buffers and preserves six-root engine support',()=>{
  const s=session();assert.equal(s.message(`[frontier] Session enabled version=v1 region=0_0 root=${root} release=v2`).kind,'enabled');
  s.queue('west',neighboringRegionURL('west',base),'new');s.poll('frontier-travel-west');save(s,1,'0_0',0);quit(s,1,'0_0');
  const terrain=released.replace('roots-freed=1,1,1,1,1,1','roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288');
  for(const line of [released,terrain.replace('1,1,1,1,1,1,1,1','1,1,1,1,1,1,0,1'),
      terrain.replace('1,1,1,1,1,1,1,1','1,1,1,1,1,1,1,0'),terrain.replace('terrain-bytes=530456','terrain-bytes=530455')])assert.equal(s.message(line),null);
  assert.equal(unload(s,1,'0_0','-1_0'),null);assert.equal(s.message(terrain).kind,'released');
  assert.equal(unload(s,1,'0_0','-1_0').kind,'unloaded');assert.equal(s.message(removed).kind,'observer-removed');
  assert.equal(attach(s,1,'-1_0','new').kind,'attached');
});
test('advertised release contract requires every root and observer removal before activation',()=>{
  const s=session();assert.equal(s.message(`[frontier] Session enabled version=v1 region=0_0 root=${root} release=v1`).kind,'enabled');
  s.queue('west',neighboringRegionURL('west',base),'new');s.poll('frontier-travel-west');
  assert.equal(s.message(released),null);save(s,1,'0_0',0);quit(s,1,'0_0');
  assert.equal(unload(s,1,'0_0','-1_0'),null);assert.equal(attach(s,1,'-1_0','new'),null);
  for(const line of [released.replace('serial=1','serial=2'),released.replace('region=0_0','region=-1_0'),
      released.replace('1,1,1,1,1,1','1,1,1,1,1,0'),released.replace('heap-after=500000','heap-after=NaN'),
      released.replace('clock=0','clock=1')])assert.equal(s.message(line),null);
  assert.equal(s.message(released).kind,'released');assert.equal(s.message(removed),null);
  assert.equal(unload(s,1,'0_0','-1_0').kind,'unloaded');assert.equal(attach(s,1,'-1_0','new'),null);
  assert.equal(s.message(removed.replace('retained-roots=0','retained-roots=1')),null);
  assert.equal(s.message(removed.replace('serial=1','serial=2')),null);
  assert.equal(s.message(removed).kind,'observer-removed');assert.equal(s.message(removed),null);
  assert.equal(attach(s,1,'-1_0','new').kind,'attached');assert.equal(s.message('[frontier] Region -1_0 ready').kind,'ready');
});
test('versioned URLs preserve session settings and require a named world',()=>{
  const next=neighboringRegionURL('west',base);assert.equal(next.searchParams.get('RECOMP_RULE_FRONTIER_SESSION'),'v1');assert.equal(next.searchParams.get('RECOMP_RULE_FRONTIER_CONNECTED_TERRAIN'),'v1');
  assert.equal(atlasURL(base).searchParams.get('RECOMP_RULE_FRONTIER_SESSION'),'v1');assert.equal(nativeRegionURL(0,0,atlasURL(base)).searchParams.get('RECOMP_RULE_FRONTIER_SESSION'),'v1');
  assert.throws(()=>nativeRegionURL(0,0,base+'&RECOMP_RULE_FRONTIER_SESSION=v1'));
  assert.throws(()=>nativeRegionURL(0,0,base.replace('world=fixture&','')));
});
test('only matching native enablement and an admitted same-world neighbor may queue a trip',()=>{
  const s=session();assert.equal(s.enabled,false);assert.throws(()=>s.queue('west',neighboringRegionURL('west',base),'new'));
  for(const line of [`[frontier] Session enabled version=v2 region=0_0 root=${root}`,`[frontier] Session enabled version=v1 region=1_0 root=${root}`,`[frontier] Session enabled version=v1 region=0_0 root=${root}-other`])assert.equal(s.message(line),null);
  enable(s);assert.equal(s.enabled,true);
  for(const [direction,url,mode]of [['west',neighboringRegionURL('east',base),'new'],['west',neighboringRegionURL('west',base).href.replace('world=fixture','world=other'),'new'],['west',neighboringRegionURL('west',base),'invalid']])assert.throws(()=>s.queue(direction,url,mode));
  s.queue('west',neighboringRegionURL('west',base),'new');assert.equal(s.busy,true);assert.throws(()=>s.queue('west',neighboringRegionURL('west',base),'new'));
});
test('generic polling peeks, the matching direction consumes once, and cancellation can revoke an unconsumed trip',()=>{
  const s=session();enable(s);s.queue('west',neighboringRegionURL('west',base),'new');
  assert.equal(s.poll('frontier-travel'),true);assert.equal(s.poll('frontier-travel'),true);assert.equal(s.poll('frontier-travel-east'),false);assert.equal(s.poll('frontier-checkpoint'),false);
  s.cancel();assert.equal(s.busy,false);assert.equal(s.poll('frontier-travel-west'),false);
  s.queue('west',neighboringRegionURL('west',base),'new');assert.equal(s.poll('frontier-travel-west'),true);assert.equal(s.consumed,true);assert.equal(s.poll('frontier-travel-west'),false);s.cancel();assert.equal(s.busy,true,'a consumed native operation must drain');
});
test('attachment requires acknowledged save, clock/loading reset and world disposal for the exact trip',()=>{
  const s=session();enable(s);s.queue('west',neighboringRegionURL('west',base),'new');
  assert.equal(save(s,1,'0_0',0),null);assert.equal(attach(s,1,'-1_0','new'),null);s.poll('frontier-travel-west');
  assert.equal(save(s,2,'0_0',0),null);assert.equal(save(s,1,'0_0',3),null);assert.equal(save(s,1,'0_0',0).kind,'saved');
  assert.equal(attach(s,1,'-1_0','new'),null);assert.equal(s.message('[frontier] Session quit serial=1 region=0_0 saved-clock=33400 clock=0 loading=1'),null);assert.equal(quit(s,1,'0_0').kind,'quit');
  assert.equal(s.message(`[frontier] Session unloaded serial=1 source=0_0 target=-1_0 world-null=0 profile=${root}/frontier_-1_0`),null);assert.equal(attach(s,1,'-1_0','new'),null);assert.equal(unload(s,1,'0_0','-1_0').kind,'unloaded');
  assert.equal(attach(s,1,'-1_0','saved'),null);const result=attach(s,1,'-1_0','new');assert.equal(result.kind,'attached');assert.equal(result.region.key,'-1_0');assert.equal(result.serial,1);assert.equal(s.busy,true);
  assert.equal(s.message('[frontier] Region 0_0 ready'),null);assert.equal(s.message('[frontier] Region -1_0 ready').kind,'ready');assert.equal(s.busy,false);
});
test('saved return and acknowledged fallback keep native serials in step',()=>{
  const s=session();enable(s);s.queue('west',neighboringRegionURL('west',base),'new');s.poll('frontier-travel-west');save(s,1,'0_0',0);quit(s,1,'0_0');unload(s,1,'0_0','-1_0');attach(s,1,'-1_0','new');s.message('[frontier] Region -1_0 ready');
  const west=neighboringRegionURL('west',base);s.queue('east',neighboringRegionURL('east',west),'saved');s.poll('frontier-travel-east');save(s,2,'-1_0',3);quit(s,2,'-1_0');unload(s,2,'-1_0','0_0');
  assert.equal(attach(s,2,'-1_0','saved'),null);assert.equal(s.message('[frontier] Session fallback serial=2 region=-1_0 restored=1').kind,'fallback');
  const fallback=attach(s,2,'-1_0','saved');assert.equal(fallback.fallback,true);assert.equal(fallback.serial,2);assert.equal(fallback.source,'-1_0');assert.equal(s.message('[frontier] Region -1_0 ready').fallback,true);
  s.queue('east',neighboringRegionURL('east',west),'saved');s.poll('frontier-travel-east');assert.equal(save(s,3,'-1_0',3).kind,'saved');
});
test('native refusal permits retry without advancing serial; failed recovery stops polling',()=>{
  const s=session();enable(s);s.queue('west',neighboringRegionURL('west',base),'new');s.poll('frontier-travel-west');assert.equal(s.message('[frontier] Session destination refused source=0_0 target=-1_0').kind,'refused');assert.equal(s.busy,false);
  s.queue('west',neighboringRegionURL('west',base),'new');s.poll('frontier-travel-west');assert.equal(save(s,1,'0_0',0).kind,'saved');quit(s,1,'0_0');unload(s,1,'0_0','-1_0');
  assert.equal(s.message('[frontier] Session fallback serial=1 region=0_0 restored=0').kind,'unavailable');assert.equal(s.enabled,false);assert.equal(s.busy,false);assert.equal(s.poll('frontier-travel-west'),false);assert.equal(attach(s,1,'-1_0','new'),null);
});
