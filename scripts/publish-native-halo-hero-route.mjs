#!/usr/bin/env node
// Join independently observed original source retirement and destination play
// under the real stopped-world journal. This does not launch/import any actor.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdtemp,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {checkpointActorRecords,checkpointAgents} from '../web/world/checkpoint.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {inspectNativeHaloSourceRetirement} from './inspect-native-halo-source-retirement.mjs';
const [manifestName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outputName,/^output\/native-halo-route-publication-\d{3}-observed\.json$/);
await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const sha=v=>createHash('sha256').update(JSON.stringify(v)+'\n').digest('hex');
const departure=await inspectNativeHaloSourceRetirement(manifestName),m=await json(manifestName),prep=await json(m.preparation);
const archive=await json(departure.qualifiedDestinationArchive.filename);
const evidenceRow=archive.evidence.find(r=>r.original.endsWith('/output/native-halo-reload-bundle-001-observed.json'));
assert.ok(evidenceRow);const destinationProof=await json(evidenceRow.preserved);
assert.equal(destinationProof.nativeFreshHaloReloadQualified,true);assert.equal(destinationProof.evolvedClock,1000);
const destinationManifestRow=archive.evidence.find(r=>r.original===destinationProof.manifest);assert.ok(destinationManifestRow);
assert.equal(destinationManifestRow.sha256,destinationProof.manifestSha256);
const dest=await json(destinationManifestRow.preserved);
assert.equal(dest.nativeSessionTerminal,true);assert.equal(dest.nativeExitCode,0);assert.equal(dest.ownedProducerAbsent,true);
try{process.kill(dest.nativePid,0);throw Error('Destination producer is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
const destinationRow=archive.evidence.find(r=>r.original===dest.evolvedCheckpoint.filename);assert.ok(destinationRow);
assert.equal(destinationRow.sha256,dest.evolvedCheckpoint.sha256);
const destination={filename:destinationRow.preserved,bytes:destinationRow.bytes,sha256:destinationRow.sha256};
const before=departure.beforeWorld,after=departure.retiredWorld;
const originals=[resolve(manifestName),m.preparation,before.filename,after.filename,destination.filename,departure.qualifiedDestinationArchive.filename];
const originalHashes={};for(const f of originals)originalHashes[f]=await hash(f);
const source=await stoppedFileSource(before.filename),hero=await checkpointActorRecords(source,481);
assert.equal(hero.agent.agentId,17);
const registration=prep.registered.record,member=registration.members.find(r=>r.unitId===481&&r.agentId===17);assert.ok(member);
const identity={version:2,entityId:member.entityId,contentDigest:registration.contentDigest,regions:['0_0','0_-1'],
  actor:{family:hero.unit.family,description:hero.unit.description,playerNumber:hero.unit.playerNumber},registeredHome:registration};
assert.equal(registeredHeroHome(identity).sha256,prep.registered.sha256);
assert.notEqual(registration.home.originCheckpointSha256,before.sha256,'Do not re-register the crossed save as the origin');
const inputs=[before,after,destination],operationEvidence={sourceManifestSha256:departure.manifestSha256,
  destinationArchiveSha256:departure.qualifiedDestinationArchive.sha256,worlds:inputs.map(r=>r.sha256),identity};
const sourceAlias={unitId:481,agentId:17},destinationAlias={unitId:510,agentId:54};
const sourceHome={kind:'native',unitId:469,agentId:7},destinationHome={kind:'proxy',unitId:0,agentId:53};
const seedRequest={kind:'seed',operationId:sha({operationEvidence,kind:'seed'}),expectedManifest:null,
  regions:['0_0'],aliases:[sourceAlias],homeAliases:[sourceHome],worlds:[{source,sha256:before.sha256}]};
const handoff=expectedManifest=>({kind:'handoff',operationId:sha({operationEvidence,kind:'handoff'}),expectedManifest,
  regions:identity.regions,aliases:[sourceAlias,destinationAlias],homeAliases:[sourceHome,destinationHome],
  worlds:[after,destination].map(r=>({source:null,sha256:r.sha256}))});
async function fresh(){
  const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
  const stats={},io=await stoppedHeroRouteStorage(directory,stats),store=new HeroRouteStore(io,identity,identity.contentDigest);
  const seed=await store.commit(seedRequest),request=handoff(seed.manifest);
  request.worlds[0].source=await stoppedFileSource(after.filename);request.worlds[1].source=await stoppedFileSource(destination.filename);
  return {directory,stats,io,store,seed,request};
}
async function selected(f,region){
  const store=new HeroRouteStore(f.io,identity,identity.contentDigest),state=await store.read();
  assert.equal(state.owner.region,region);assert.equal(state.owner.entityId,identity.entityId);
  assert.deepEqual(store.identity,identity);
  assert.deepEqual({unitId:state.owner.unitId,agentId:state.owner.agentId},region==='0_0'?sourceAlias:destinationAlias);
  return state;
}
const normal=await fresh(),published=await normal.store.commit(normal.request);
assert.equal(published.revision,1);const owner=await selected(normal,'0_-1');
const writes=normal.stats.writes,retry=await normal.store.commit(normal.request);
assert.equal(retry.idempotent,true);assert.equal(retry.manifest,published.manifest);assert.equal(normal.stats.writes,writes);
await normal.store.withDestination('0_0',null,async lease=>{
  assert.deepEqual(lease.regions,['0_-1','0_0']);
  assert.equal(lease.entries[0].world.sha256,destination.sha256);assert.equal(lease.entries[1].world.sha256,after.sha256);
  assert.equal(lease.sources.length,2);
});
const interruptions=[];
for(const stage of ['after-source','after-destination','before-publish','after-publish']){
  const f=await fresh();await assert.rejects(f.store.commit(f.request,async at=>{if(at===stage)throw Error('qualification interruption');}),/qualification interruption/);
  const old=await selected(f,stage==='after-publish'?'0_-1':'0_0'),recovered=await f.store.commit(f.request);
  assert.equal(recovered.idempotent,stage==='after-publish');await selected(f,'0_-1');
  interruptions.push({stage,directory:f.directory,ownerAfterInterruption:old.owner.region,recoveredRevision:recovered.revision,idempotent:recovered.idempotent,stats:f.stats});
}
const corruptions=[];
for(const kind of ['duplicate-source-owner','deleted-destination-target']){
  const f=await fresh();
  if(kind==='duplicate-source-owner'){
    // Evolve a pose byte so the semantic duplicate check, rather than the
    // unchanged-save guard, must reject a second still-live source hero.
    const at=hero.unit.offset+60,value=(await source.readAt(at,1))[0]^1;
    const changed={size:source.size,async readAt(offset,n){const b=await source.readAt(offset,n);
      if(offset<=at&&at<offset+n)b[at-offset]=value;return b;}};
    f.request.worlds[0]={source:changed,sha256:await hashCheckpointSource(changed)};
  }
  else{
    const original=await stoppedFileSource(destination.filename);let target;
    for await(const a of checkpointAgents(original))if(a.agentId===48)target=a;
    assert.ok(target&&!target.deleted);const at=target.nativeIdOffset+4;
    const changed={size:original.size,async readAt(offset,n){const b=await original.readAt(offset,n);
      if(offset<=at&&at<offset+n)b[at-offset]=1;return b;}};
    f.request.worlds[1]={source:changed,sha256:await hashCheckpointSource(changed)};
  }
  let refusal;
  try{await f.store.commit(f.request);}catch(e){refusal=e.message;}
  assert.match(refusal??'',kind==='duplicate-source-owner'?/membership|Retired/:/Missing live region target agent/);
  const unchanged=await selected(f,'0_0');assert.equal(unchanged.record.manifest,f.seed.manifest);
  corruptions.push({kind,refusal,directory:f.directory,selectedOwner:unchanged.owner.region});
}
// A successful source retirement alone must never be mistaken for publication.
const head=await readFile(join(normal.directory,HERO_ROUTE_HEAD),'utf8');assert.equal(head,published.manifest);
for(const [f,h]of Object.entries(originalHashes))assert.equal(await hash(f),h);
for(const s of [normal.stats,...interruptions.map(r=>r.stats)]){
  assert.ok(s.largestRead<=4096&&s.largestWrite<=4096);assert.equal(s.peakReads,1);assert.equal(s.activeReads,0);
}
const slots=(await readdir(normal.directory)).filter(f=>f.endsWith('.GMP'));assert.equal(slots.length,3);
const sourceSha256={};for(const name of ['scripts/publish-native-halo-hero-route.mjs','scripts/inspect-native-halo-source-retirement.mjs',
  'web/world/hero-route-store.mjs','web/world/entity-home-ownership.mjs','web/world/entity-ownership.mjs','web/world/entity-revisions.mjs',
  'web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/order-unit-bindings.mjs','web/world/remote-home.mjs','web/world/transfer-store.mjs',
  'scripts/lib/stopped-hero-route-io.mjs','scripts/lib/stopped-entity-io.mjs','tests/hero-route-store.test.mjs'])sourceSha256[name]=await hash(name);
const report={version:1,stoppedOriginalHaloHandoffPublished:true,
  scope:'One actual stopped northbound hero family handoff selected atomically with immutable registered guild and intact original AI target. No integrated runtime/browser travel.',
  sourceRetirement:departure,destinationProof:{filename:evidenceRow.preserved,sha256:evidenceRow.sha256},
  inputs,identity,directory:normal.directory,selectedOwner:owner.owner,selectedManifest:published.manifest,selectedRevision:1,
  ordinaryAiTargetPreserved:true,sourceAbsentDestinationPresent:true,atomicBothRegionSelection:true,
  retainedCheckpointSlots:slots.length,maximumSlotsPerRegion:2,stats:normal.stats,interruptions,corruptions,
  idempotentRetryWithoutWrites:true,originalHashes,sourceSha256,
  seamlessLiveTravelQualified:false,repeatedReturnTravelQualified:false,sustainedBrowserMemoryBoundQualified:false,
  fullCoopMatchQualified:false,independentInternetQualified:false,browserUsed:false,nativeProcessesStarted:0,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({stoppedOriginalHaloHandoffPublished:true,selectedOwner:owner.owner,interruptions:4,retainedCheckpointSlots:3,browserUsed:false}));
