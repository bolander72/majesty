import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {browserWorldStorage} from './fixtures/browser-world-storage.mjs';
import {world,source,hash} from './fixtures/registered-hero-world.mjs';
import {inspectSavedHeroJourney,inspectHeroEnrollment,enrollHeroJourney,prepareSavedHeroJourney,heroJourneyURL,MAX_JOURNEY_HEROES} from '../web/world/hero-route-launcher.mjs';
import {initializeHeroJourneys} from '../web/world/hero-route-controls.mjs';
import {readNativeHeroRouteIdentity} from '../web/world/hero-route-profile.mjs';
import {nativeHeroRestoreConfig} from '../web/world/hero-route-launch.mjs';

async function setup(){
  const f=await browserWorldStorage({browserContent:true});
  for(const name of [...f.files.keys()])if(name.startsWith(f.routePrefix))f.files.delete(name);
  const bytes=f.worlds[0],native=await f.realms.commit('0_0',{source:source(bytes),sha256:hash(bytes),expectedManifest:null});
  f.calls.length=0;
  const options={locks:f.locks};
  const inspect=()=>inspectSavedHeroJourney(f.profiles,f.world,options);
  const choices=()=>inspectHeroEnrollment(f.profiles,f.world,'0_0',options);
  const enroll=(proposal,extra={})=>enrollHeroJourney(f.profiles,f.world,{content:proposal.content,region:proposal.region,
    expectedNativeManifest:proposal.nativeManifest,guildUnitId:proposal.choices[0].guildUnitId,heroUnitId:proposal.choices[0].heroUnitId},
    {...options,...extra});
  const prepare=summary=>prepareSavedHeroJourney(f.profiles,f.world,request(summary),options);
  return {...f,native,options,inspect,choices,enroll,prepare};
}
function request(value){return {worldId:value.worldId,entityId:value.entityId,region:value.region,content:value.content,
  ownerManifest:value.ownerManifest,nativeManifest:value.nativeManifest};}

test('local identity discovery is metadata-only and preserves missing, busy and incompatible journals',async()=>{
  const f=await setup();assert.equal(await readNativeHeroRouteIdentity(f.profiles,f.world,f.options),null);
  assert.ok(!f.calls.some(c=>c.file?.endsWith('.GMP')||c.create));
  f.busy(true);f.calls.length=0;await assert.rejects(f.inspect(),/Close this world/);assert.ok(f.calls.every(c=>c.lock));f.busy(false);
  const choices=await f.choices();await f.enroll(choices);
  f.calls.length=0;const identity=await readNativeHeroRouteIdentity(f.profiles,f.world,f.options);
  assert.equal(identity.registeredHome.worldId,choices.worldId);assert.ok(!f.calls.some(c=>c.file?.endsWith('.GMP')));
  const native=await f.realms.commit('0_0',{source:source(world(0,true,{variant:1})),sha256:hash(world(0,true,{variant:1})),expectedManifest:f.native.manifest});
  const marker=f.files.get(f.nativePath('Frontier_0_0.checkpoint'));
  f.files.set(f.nativePath('Frontier_0_0.checkpoint'),Buffer.from(marker.toString().replace(f.request.content,'f'.repeat(64)+':'+'e'.repeat(64))));
  const before=new Map(f.files);f.calls.length=0;await assert.rejects(f.inspect(),/different game content/);
  assert.deepEqual(f.files,before);assert.ok(!f.calls.some(c=>c.write));void native;
});

test('launcher discovers reciprocal heroes, registers once, prepares and generates a clean solo resume link',async()=>{
  const f=await setup();assert.equal((await f.inspect()).state,'unregistered');
  const proposed=await f.choices();assert.equal(proposed.choices.length,1);assert.ok(proposed.choices.length<=MAX_JOURNEY_HEROES);
  assert.deepEqual(proposed.choices[0],{guildUnitId:469,heroUnitId:502,playerNumber:0,name:''});
  assert.ok(!f.calls.some(c=>c.write||c.create));f.calls.length=0;
  const enrolled=await f.enroll(proposed);assert.equal(enrolled.idempotent,false);assert.equal(f.calls.filter(c=>c.lock).length,1);
  const summary=await f.inspect();assert.equal(summary.state,'registered');assert.equal(summary.ownerClock,3200);
  f.calls.length=0;const prepared=await f.prepare(summary);assert.equal(f.calls.filter(c=>c.lock).length,1);
  assert.equal(prepared.publication.unchanged,true);assert.equal(prepared.preparation.idempotent,true);
  assert.ok(!f.calls.some(c=>c.write));
  const url=heroJourneyURL(prepared,'http://localhost:8000/world/?world=other&room=private&RECOMP_RULE_FRONTIER_SESSION=v1');
  const config=nativeHeroRestoreConfig(url.search);assert.equal(config.world,f.world);assert.equal(config.worldId,enrolled.worldId);
  assert.equal(config.entityId,enrolled.entityId);assert.equal(url.searchParams.has('room'),false);
  assert.equal(url.searchParams.has('RECOMP_RULE_FRONTIER_SESSION'),false);f.assertBounded();
});

test('preparing from the launcher publishes the latest gameplay save and refuses stale selections',async()=>{
  const f=await setup();await f.enroll(await f.choices());const old=await f.inspect();
  const bytes=world(0,true,{variant:1,savedClock:3300});
  await f.realms.commit('0_0',{source:source(bytes),sha256:hash(bytes),expectedManifest:f.native.manifest});
  f.calls.length=0;await assert.rejects(f.prepare(old),/Native checkpoint changed/);assert.ok(!f.calls.some(c=>c.write));
  const current=await f.inspect();assert.equal(current.nativeClock,3300);assert.equal(current.ownerClock,3200);
  const prepared=await f.prepare(current);assert.equal(prepared.publication.ownerRevision,1);
  assert.equal(prepared.publication.clock,3300);assert.equal(prepared.preparation.sha256,hash(bytes));
  assert.equal((await f.inspect()).ownerClock,3300);
});

for(const phase of ['after-source','before-publish','after-publish'])test(`interrupted launcher enrollment ${phase} is recoverable without another identity`,async()=>{
  const f=await setup(),proposal=await f.choices();
  await assert.rejects(f.enroll(proposal,{boundary:async at=>{if(at===phase)throw Error('interrupted');}}),/interrupted/);
  const summary=await f.inspect();assert.equal(summary.state,phase==='after-publish'?'registered':'incomplete');
  const identity=await readNativeHeroRouteIdentity(f.profiles,f.world,f.options),result=await f.enroll(proposal);
  assert.equal(result.worldId,identity.registeredHome.worldId);assert.equal(result.entityId,identity.entityId);
  assert.equal(result.idempotent,phase==='after-publish');assert.equal((await f.inspect()).state,'registered');f.assertBounded();
});

test('different hero, old snapshot and live-game registration cannot overwrite an existing journal',async()=>{
  const f=await setup(),proposal=await f.choices();await f.enroll(proposal);
  const changed=world(0,true,{uid:503,gid:28,variant:1,savedClock:3300});
  await f.realms.commit('0_0',{source:source(changed),sha256:hash(changed),expectedManifest:f.native.manifest});
  const next=await f.choices(),before=f.snapshot();f.calls.length=0;
  await assert.rejects(f.enroll(next),/identity differs/);assert.deepEqual(f.snapshot(),before);assert.ok(!f.calls.some(c=>c.write||c.create));
  await assert.rejects(f.enroll(proposal),/Saved kingdom changed/);assert.deepEqual(f.snapshot(),before);
  f.busy(true);f.calls.length=0;await assert.rejects(f.enroll(next),/Close this world/);assert.ok(f.calls.every(c=>c.lock));
});

test('cancelled enrollment before publication preserves native saves and the seed can be retried',async()=>{
  const f=await setup(),proposal=await f.choices(),controller=new AbortController();
  const before=new Map([...f.files].filter(([name])=>!name.startsWith(f.routePrefix)));
  await assert.rejects(f.enroll(proposal,{signal:controller.signal,boundary:async phase=>{
    if(phase==='before-publish')controller.abort(Error('closed'));
  }}),/closed/);
  assert.deepEqual(new Map([...f.files].filter(([name])=>!name.startsWith(f.routePrefix))),before);
  assert.equal((await f.inspect()).state,'incomplete');await f.enroll(proposal);
  assert.equal((await f.inspect()).state,'registered');
});

test('missing identity never admits overwriting an orphaned journal',async()=>{
  for(const orphan of ['Frontier_Hero_Route_0_0_0.GMP','Frontier_Hero_Route_Node_0.json','unknown-file']){
    const f=await setup(),proposal=await f.choices();f.files.set(f.routePrefix+orphan,Buffer.from('unregistered'));
    const before=f.snapshot();f.calls.length=0;
    await assert.rejects(f.enroll(proposal),/unregistered files/);
    assert.deepEqual(f.snapshot(),before);assert.ok(!f.calls.some(c=>c.write||c.create));
  }
});

function controls(f){
  const nodes=new Map(),navigations=[],created=[];let current={world:f.world,x:0,y:0};
  function element(tag='node'){return {tag,hidden:true,disabled:true,value:'',textContent:'',children:[],
    appendChild(child){this.children.push(child);},replaceChildren(...children){this.children=children;},
    removeAttribute(name){delete this[name];},hasAttribute(name){return Object.hasOwn(this,name);}};}
  for(const id of ['hero-journey-refresh','hero-journey-heroes','hero-journey-register','hero-journey-prepare','hero-journey-resume','hero-journey-status'])nodes.set('#'+id,element());
  const document={querySelector:id=>nodes.get(id),createElement(tag){const node=element(tag);created.push(node);return node;}};
  const storage={async getDirectory(){return {async getDirectoryHandle(name){assert.equal(name,'majesty');return {
    async getDirectoryHandle(name){assert.equal(name,'profile');return f.profiles;},
  };}};}};
  const handle=initializeHeroJourneys({document,base:'http://localhost:8000/world/?world='+f.world,getCurrent:()=>current,
    storage,locks:f.locks,navigate:async url=>navigations.push(url)});
  return {nodes,navigations,created,handle,select(value){current=value;},refresh:()=>nodes.get('#hero-journey-refresh').onclick(),
    register:()=>nodes.get('#hero-journey-register').onclick(),prepare:()=>nodes.get('#hero-journey-prepare').onclick(),
    resume:()=>nodes.get('#hero-journey-resume').onclick({preventDefault(){}})};
}

test('actual launcher controls register and prepare without auto-opening a game or retaining earlier choices',async()=>{
  const f=await setup(),ui=controls(f);await ui.refresh();
  assert.equal(ui.nodes.get('#hero-journey-heroes').children.length,1);
  assert.equal(ui.nodes.get('#hero-journey-heroes').children[0].textContent,'Hero 1 · Kingdom 1');
  assert.equal(ui.nodes.get('#hero-journey-register').disabled,false);await ui.register();
  assert.equal(ui.nodes.get('#hero-journey-heroes').children.length,0);
  assert.equal(ui.nodes.get('#hero-journey-resume').hidden,false);assert.equal(ui.navigations.length,0);
  await ui.resume();assert.equal(ui.navigations.length,1);assert.equal(nativeHeroRestoreConfig(new URL(ui.navigations[0]).search).world,f.world);
  await ui.refresh();assert.equal(ui.nodes.get('#hero-journey-prepare').disabled,false);
  await ui.prepare();assert.equal(ui.nodes.get('#hero-journey-resume').hidden,false);
  await ui.handle.close();assert.equal(ui.nodes.get('#hero-journey-resume').hasAttribute('href'),false);
  assert.equal(ui.nodes.get('#hero-journey-refresh').onclick,null);
});

test('stale map choices and missing named worlds cannot register or launch',async()=>{
  const f=await setup(),ui=controls(f);await ui.refresh();ui.select({world:f.world,x:1,y:0});f.calls.length=0;
  await ui.register();assert.match(ui.nodes.get('#hero-journey-status').textContent,/Refresh available heroes/);
  assert.ok(!f.calls.some(c=>c.write));assert.equal(ui.navigations.length,0);
  ui.select({world:null,x:0,y:0});await ui.refresh();assert.equal(ui.nodes.get('#hero-journey-refresh').disabled,true);
  assert.equal(ui.nodes.get('#hero-journey-resume').hasAttribute('href'),false);await ui.handle.close();
});

test('page departure cancels a pending launcher operation and stale handlers cannot restart storage',async()=>{
  const f=await setup(),ui=controls(f);let release,entered;
  const ready=new Promise(resolve=>entered=resolve),pending=new Promise(resolve=>release=resolve);
  const lock=f.locks.request;f.locks.request=async(name,options,consume)=>{entered();await pending;return lock(name,options,consume);};
  const stale=ui.nodes.get('#hero-journey-refresh').onclick,job=ui.refresh();await ready;
  const closing=ui.handle.close();assert.equal(ui.nodes.get('#hero-journey-resume').hasAttribute('href'),false);
  release();await job;await closing;const count=f.calls.length;await stale();assert.equal(f.calls.length,count);
  assert.equal(ui.nodes.get('#hero-journey-heroes').children.length,0);
});

test('shipped page exposes stopped-game preparation and keeps journey controls disabled initially',async()=>{
  const html=await readFile('web/world/index.html','utf8');
  assert.match(html,/Save the kingdom and close its game first/);assert.match(html,/Live hero travel between regions is still in development/);
  for(const id of ['hero-journey-refresh','hero-journey-heroes','hero-journey-register','hero-journey-prepare'])assert.match(html,new RegExp('id="'+id+'"[^>]*disabled'));
});
