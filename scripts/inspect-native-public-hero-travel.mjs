#!/usr/bin/env node
// Independently inspect all four shared source consumers and actual saved
// ownership. Destination activation still uses owned native fixture drivers.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {parseHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalPublished} from '../web/world/hero-travel-publication.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointAbsentAgentReferences,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';

const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-public-hero-travel-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async name=>(await hashNativeFile(name)).sha256;
const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
async function json(name){assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));}
async function bound(row){assert.equal((await lstat(row.filename)).size,row.bytes);assert.equal(await hash(row.filename),row.sha256);}
const m=await json(manifestName);assert.equal(m.publicTravel,true);assert.equal(m.publicSourceDepartureJourneyQualified,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
assert.equal(m.publicationWorkerTerminal,true);assert.equal(m.publicationWorkerExitCode,0);
assert.equal(m.ownedProducerAbsent,true);assert.equal(m.publicationWorkerAbsent,true);
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.equal(m.startupFixtureUnchanged,true);
assert.equal(m.browserUsed,false);assert.equal(m.nativeProcessesStarted,1);
for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const [name,digest]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(name),digest);
await bound(m.build);const build=await json(m.build.filename);
assert.equal(await hash(join(m.fixture,'native/recomp/pop_smoke')),build.nativeExecutableSha256);
assert.equal(m.nativeExecutableSha256,build.nativeExecutableSha256);
assert.equal(await hash(m.log),m.logSha256);assert.ok((await lstat(m.log)).size<m.logCeilingBytes);
const log=await readFile(m.log,'utf8');assert.ok(!/result=fail|invariant failed|abort from|GplException/.test(log));
const first=await json(join(m.fixture,'publication.json')),identity=first.identity,initial=parseHeroRuntimeBinding(m.runtimeBinding),cases=[];
assert.deepEqual(m.publicDepartureJourney.legs.map(v=>v.serial),[1,2,4,6]);
let previousArrival=null;
for(const [index,leg]of m.publicDepartureJourney.legs.entries()){
 await bound(leg.capture);await bound(leg.pair);
 const capture=await json(leg.capture.filename),pair=await json(leg.pair.filename),request=leg.request,input=JSON.parse(request.requestManifest);
 assert.equal(Buffer.byteLength(request.requestManifest),request.requestSize);
 const requestFile=leg.serial===1?capture.sourceRequest.preservedInput:
  (await json(join(m.fixture,`public-departure-${String(leg.serial).padStart(3,'0')}.json`))).preservedRequest;
 await bound(requestFile);assert.equal(await readFile(requestFile.filename,'utf8'),request.requestManifest);
 assert.equal(await hash(requestFile.filename),request.requestSha256);
 assert.equal(request.nativeAction,`frontier-hero-travel-${leg.serial}`);assert.equal(request.nativeActionIssued,false);
 assert.equal(input.serial,leg.serial);assert.equal(input.sourceRegion,leg.source);assert.equal(input.targetRegion,leg.target);
 assert.equal(input.sourceClock,capture.crossing.clock);assert.equal(input.destinationClock,pair.publicationReceipt.clock);
 const alias={unitId:capture.crossing.unitId,agentId:capture.crossing.agentId};assert.deepEqual(input.sourceAlias,alias);
 const home=leg.serial===1?{kind:initial.homeKind,unitId:initial.homeUnitId,agentId:initial.homeAgentId}:previousArrival.home;
 if(previousArrival)assert.deepEqual(alias,previousArrival.owner);
 assert.equal(input.ownerManifest,capture.ownerManifest??capture.publicationReceipt.ownerManifest);
 assert.equal(input.sourceNativeManifest,capture.nativeManifest);
 if(leg.serial===1){assert.equal(input.home.admission,'reserve-new');assert.equal(capture.sourceRequest.requestControls.length,10);
  assert.ok(capture.sourceRequest.requestControls.every(v=>v.refusedByEngine));}
 if(leg.serial===4)assert.equal(input.home.admission,'reuse-existing');
 if([2,6].includes(leg.serial))assert.equal(input.kind,'majesty-hero-native-home-input-v1');
 const ready=parseNativeHeroArrivalReady(pair.ready),p=pair.publicationReceipt;
 assert.equal(ready.serial,leg.serial);assert.equal(ready.region,leg.target);
 assert.deepEqual(p.owner,{unitId:ready.unitId,agentId:ready.agentId});assert.deepEqual(p.home,input.homeAlias);
 assert.equal(p.acknowledgement,nativeHeroArrivalPublished(pair.ready,p.ownerManifest));
 assert.equal(p.ownerRevision,[2,4,7,10][index]);
 const captured=capture.captured,retired=pair.retired,active=pair.active;
 for(const row of [captured,retired,active]){await bound(row);assert.ok(row.filename.startsWith(m.fixture+'/'));}
 const a=await stoppedFileSource(captured.filename),b=await stoppedFileSource(retired.filename),c=await stoppedFileSource(active.filename);
 assert.equal(await checkpointSavedClock(a),input.sourceClock);assert.equal(await checkpointSavedClock(b),input.sourceClock);
 assert.equal(await checkpointSavedClock(c),ready.clock);assert.equal(active.bytes,ready.size);assert.equal(active.sha256,ready.sha256);
 await verifyRegisteredHeroSnapshot(identity,alias,home,a,true,leg.source);
 await verifyRegisteredHeroSnapshot(identity,alias,home,b,false,leg.source);
 await verifyRegisteredHeroSnapshot(identity,p.owner,p.home,c,true,leg.target);
 assert.equal((await checkpointAbsentAgentReferences(b,alias.agentId)).sites.length,0);
 let activeEntries=0;for await(const q of checkpointAgentQueues(c))if(q.type==='queued-agent'&&q.agentId===p.owner.agentId)activeEntries++;
 assert.equal(activeEntries,1);
 const geometry=await requireCheckpointHaloLayout(c,leg.target,'halo-v1');assert.equal(geometry.verifiedVertices,16641);
 const boundaries=[`[frontier] Hero crossing serial=${leg.serial} region=${leg.source} target=${leg.target} `,
  `[frontier] Hero save held serial=${leg.serial} region=${leg.source} clock=${input.sourceClock} `,
  leg.consumed,`[frontier] Session released serial=${index+1} region=${leg.source} roots-freed=1,1,1,1,1,1,1,1`,
  `[frontier] Session attached serial=${index+1} region=${leg.target} mode=saved`,
  `[frontier] Hero travel publication held receipt=${pair.ready} phase=7 pending=0 ordinary-ticks=0`,leg.resumed];
 const positions=boundaries.map(line=>{assert.equal(log.split(line).length-1,1,line);return log.indexOf(line);});
 assert.deepEqual(positions,[...positions].sort((a,b)=>a-b));
 cases.push({serial:leg.serial,source:leg.source,target:leg.target,captured,retired,active,request:requestFile,
  sourceAlias:alias,arrivalAlias:p.owner,arrivalHome:p.home,sourceClock:input.sourceClock,targetClock:ready.clock,
  ownerRevision:p.ownerRevision,registeredSnapshotsVerified:3,retiredAgentReferences:0,activeQueueEntries:activeEntries,
  geometry,ordinarySourceActionConsumed:true,allSourceRootsFreed:true});previousArrival=p;
}
await bound(m.publicDepartureJourney.finalSave);
const final=await json(m.publicDepartureJourney.finalSave.filename),p=final.publicationReceipt;await bound(final.captured);
assert.equal(p.region,'0_0');assert.equal(p.clock,105200);assert.equal(p.ownerRevision,11);
assert.equal(await checkpointSavedClock(await stoppedFileSource(final.captured.filename)),p.clock);
const stats={},store=new HeroRouteStore(await stoppedHeroRouteStorage(final.journal,stats),identity,identity.contentDigest);
let dormant;
await store.withDestination('1_0',null,async selected=>{
 assert.equal(selected.record.manifest,p.ownerManifest);assert.deepEqual(selected.entries[0].alias,p.owner);
 assert.deepEqual(selected.entries[0].homeAlias,{kind:'native',unitId:initial.homeUnitId,agentId:initial.homeAgentId});
 assert.equal(await checkpointSavedClock(selected.sources[0]),p.clock);
 assert.equal(selected.entries[1].world.sha256,cases.at(-1).retired.sha256);
 await verifyRegisteredHeroSnapshot(identity,cases.at(-1).sourceAlias,{kind:'proxy',unitId:0,agentId:38},selected.sources[1],false,'1_0');
 dormant={region:'1_0',world:selected.entries[1].world,clock:await checkpointSavedClock(selected.sources[1])};
});assert.equal(dormant.clock,4650);assert.equal(stats.writes??0,0);
const sourceSha256={...m.compiledSourceSha256},pending=[resolve('scripts/inspect-native-public-hero-travel.mjs')];
while(pending.length){const name=pending.pop(),key=relative(workspace,name);if(sourceSha256[key])continue;
 assert.ok(!key.startsWith('..')&&Object.keys(sourceSha256).length<256);sourceSha256[key]=await hash(name);
 for(const match of (await readFile(name,'utf8')).matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))
  if(match[1].startsWith('.'))pending.push(resolve(dirname(name),match[1]));
}
await writeFile(outName,JSON.stringify({version:1,nativePublicSourceTravelQualified:true,manifest:await descriptor(manifestName),
 cases,finalOwner:p.owner,finalOwnerManifest:p.ownerManifest,finalClock:p.clock,finalRevision:p.ownerRevision,dormant,
 sourceSha256,destinationUsesOwnedNativeTestDrivers:true,newBrowserPublisherReceiptConsumed:false,
 browserUsed:false,liveOPFSDurabilityQualified:false,sustainedBrowserMemoryQualified:false,newRegionGenerationQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativePublicSourceTravelQualified:true,sourceActions:cases.length,registeredSnapshotsVerified:12,finalClock:p.clock,dormantClock:dormant.clock}));
