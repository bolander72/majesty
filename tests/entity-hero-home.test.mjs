import test from 'node:test';
import assert from 'node:assert/strict';
import {EntityRevisionStore,openEntityRevisionStore,encodeRevisionIdentity,encodeEntityRevision,REVISION_IDENTITY} from '../web/world/entity-revisions.mjs';
import {fixture,world} from './fixtures/registered-hero-world.mjs';
const physical=(members,owner=469)=>({kind:2,owner,members});
test('returned hero can save and reopen while physically residing in its original registered guild',async()=>{
  const f=await fixture(),s=f.store();let selected=await s.commit(f.request());
  selected=await s.commit(f.request([world(0,false),world(1,true,{registration:f.registration})],
    {kind:'handoff',ownerSide:1,visitedSides:3,expectedManifest:selected.manifest,operationId:'e'.repeat(64)}));
  const aliases=[{unitId:702,agentId:47},f.aliases[1]];
  const request=f.request([world(0,true,{uid:702,gid:47,parent:469,physicalGroups:[physical([702])]}),world(1,false,{registration:f.registration})],
    {aliases,kind:'handoff',ownerSide:0,visitedSides:3,expectedManifest:selected.manifest,operationId:'f'.repeat(64)});
  const returned=await s.commit(request),reopened=await openEntityRevisionStore(f.io,f.identity.contentDigest);
  assert.deepEqual((await reopened.read()).owner,{entityId:f.identity.entityId,region:'0_0',unitId:702,agentId:47});
  assert.deepEqual(reopened.identity.registeredHome,f.registration);
  assert.equal((await reopened.commit(request)).idempotent,true);assert.equal(returned.state.revision,2);
});
for(const [name,options,pattern]of [
  ['missing physical member',{parent:469},/physical membership/],
  ['outside with physical member',{physicalGroups:[physical([502])]},/physical membership/],
  ['foreign building',{parent:778,physicalGroups:[physical([502])]},/physical parent/],
  ['wrong physical owner',{parent:469,physicalGroups:[physical([502],778)]},/physical roster owner/],
  ['duplicate physical member',{parent:469,physicalGroups:[physical([502,502])]},/physical membership/],
  ['duplicate physical group',{parent:469,physicalGroups:[physical([502]),physical([])]},/physical membership/],
  ['noncanonical member flags',{parent:469,physicalGroups:[physical([{id:502,flags:3}])]},/physical member flags/],
  ['stale origin member after alias change',{uid:702,gid:47,parent:469,physicalGroups:[physical([702,502])]},/physical membership/],
])test(`registered residence refuses ${name} without publishing a save`,async()=>{
  const f=await fixture(),s=f.store(),aliases=[{unitId:options.uid??502,agentId:options.gid??27},f.aliases[1]];
  await assert.rejects(s.commit(f.request([world(0,true,options),f.worlds[1]],{aliases})),pattern);
  // Seed writes its immutable identity first; failed ownership checks never select world/state files.
  assert.deepEqual(f.writes,[REVISION_IDENTITY]);assert.equal(f.files.size,1);
});
test('inactive origin must have no physical hero membership and a remote hero cannot use a local building parent',async()=>{
  const f=await fixture(),s=f.store(),seed=await s.commit(f.request());
  const extra={kind:'handoff',ownerSide:1,visitedSides:3,expectedManifest:seed.manifest,operationId:'e'.repeat(64)};
  await assert.rejects(s.commit(f.request([world(0,false,{physicalGroups:[physical([502])]}),world(1,true,{registration:f.registration})],extra)),/physical membership/);
  await assert.rejects(s.commit(f.request([world(0,false),world(1,true,{registration:f.registration,parent:778})],extra)),/native\/script\/scheduling/);
  assert.equal((await s.read()).record.manifest,seed.manifest);
});
test('explicit hero format seeds an actual native home and a pure neighboring identity under one logical member ID',async()=>{
  const f=await fixture(),s=f.store(),selected=await s.commit(f.request());
  assert.equal(selected.state.version,2);assert.equal(f.files.size,5);
  const reopened=await openEntityRevisionStore(f.io,f.identity.contentDigest);
  assert.deepEqual((await reopened.read()).owner,{entityId:f.identity.entityId,region:'0_0',unitId:502,agentId:27});
  assert.equal(reopened.identity.registeredHome.members.length,1);assert.equal(reopened.identity.registeredHome.home.region,'0_0');
  assert.equal((await s.commit(f.request())).idempotent,true);assert.ok(f.files.get(REVISION_IDENTITY).length<=4096);
});
test('synthetic outward and return ownership preserve the guild, proxy and logical slot with fresh hero aliases',async()=>{
  const f=await fixture(),s=f.store();let selected=await s.commit(f.request());
  selected=await s.commit(f.request([world(0,false),world(1,true,{registration:f.registration})],
    {kind:'handoff',ownerSide:1,visitedSides:3,expectedManifest:selected.manifest,operationId:'e'.repeat(64)}));
  assert.equal((await s.read()).owner.region,'1_0');assert.equal((await s.read()).owner.entityId,f.identity.entityId);
  const aliases=[{unitId:702,agentId:47},f.aliases[1]];
  selected=await s.commit(f.request([world(0,true,{uid:702,gid:47}),world(1,false,{registration:f.registration})],
    {aliases,kind:'handoff',ownerSide:0,visitedSides:3,expectedManifest:selected.manifest,operationId:'f'.repeat(64)}));
  assert.equal((await s.read()).owner.agentId,47);assert.deepEqual(selected.state.homeAliases,f.homeAliases);
  assert.deepEqual(s.identity.registeredHome,f.registration);assert.equal(f.files.size,8);
});
for(const [defect,message] of [['staleScript',/script membership/],['staleNative',/native membership/],
  ['borrowLocal',/borrow a local native home/],['queuedProxy',/proxy is queued/],['wrongProxy',/identity differs/],
  ['proxyBacklink',/native backlink/]])test(`hero handoff refuses ${defect} before publishing another owner`,async()=>{
  const f=await fixture(),s=f.store(),seed=await s.commit(f.request());
  const sourceOptions=['staleScript','staleNative'].includes(defect)?{[defect]:true}:{};
  const remoteOptions={registration:f.registration,...(['staleScript','staleNative'].includes(defect)?{}:{[defect]:true})};
  await assert.rejects(s.commit(f.request([world(0,false,sourceOptions),world(1,true,remoteOptions)],
    {kind:'handoff',ownerSide:1,visitedSides:3,expectedManifest:seed.manifest,operationId:'e'.repeat(64)})),message);
  assert.equal((await s.read()).record.manifest,seed.manifest);assert.equal((await s.read()).owner.region,'0_0');
});
test('wrong script home, mismatched native guild backlink and duplicate owners refuse seed or handoff',async()=>{
  const f=await fixture(),s=f.store();
  await assert.rejects(s.commit(f.request([world(0,true,{homeRef:17}),f.worlds[1]])),/script home differs/);
  await assert.rejects(s.commit(f.request([world(0,true,{badGuildAgent:true}),f.worlds[1]])),/association/);
  const seed=await s.commit(f.request());
  await assert.rejects(s.commit(f.request([world(0,true,{variant:1}),world(1,true,{registration:f.registration})],
    {kind:'handoff',ownerSide:1,visitedSides:3,expectedManifest:seed.manifest,operationId:'e'.repeat(64)})),/membership|both/);
});
for(const at of ['after-source','after-state','before-publish','after-publish'])test(`hero ownership interruption at ${at} selects one complete old or new pair`,async()=>{
  const f=await fixture(),s=f.store(),seed=await s.commit(f.request());
  const request=f.request([world(0,false),world(1,true,{registration:f.registration})],
    {kind:'handoff',ownerSide:1,visitedSides:3,expectedManifest:seed.manifest,operationId:'e'.repeat(64)});
  await assert.rejects(s.commit(request,async step=>{if(step===at)throw Error('interrupted');}),/interrupted/);
  const reopened=await openEntityRevisionStore(f.io,f.identity.contentDigest);
  assert.equal((await reopened.read()).owner.region,at==='after-publish'?'1_0':'0_0');
  assert.equal((await reopened.commit(request)).idempotent,at==='after-publish');
});
test('native-only identities cannot silently gain pure home references; version2 origin and alias bindings are exact',async()=>{
  const f=await fixture(),v1={...f.identity,version:1};delete v1.registeredHome;
  assert.throws(()=>encodeRevisionIdentity({...v1,registeredHome:f.registration}),/identity/);
  await assert.rejects(new EntityRevisionStore(f.io,v1,v1.contentDigest).commit(f.request()),/Native-only/);
  for(const change of [o=>o.entityId='e'.repeat(64),o=>o.registeredHome.home.unitId++,o=>o.regions=['2_0','1_0'],
    o=>o.contentDigest='e'.repeat(64),o=>o.registeredHome.revision=1]) {
    const bad=structuredClone(f.identity);change(bad);assert.throws(()=>encodeRevisionIdentity(bad));
  }
  const seeded=await f.store().commit(f.request()),state=seeded.state;
  for(const change of [o=>o.homeAliases[1].unitId=99,o=>o.homeAliases[0].agentId=27,
    o=>o.homeAliases.push(o.homeAliases[0]),o=>o.homeAliases[1].extra=1]) {
    const bad=structuredClone(state);change(bad);assert.throws(()=>encodeEntityRevision(bad));
  }
});
