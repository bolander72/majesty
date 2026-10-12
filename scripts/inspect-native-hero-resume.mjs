#!/usr/bin/env node
// Independent complete saved-state qualification of publication, original
// resume, fresh alias sampling and a second accepted crossing in one process.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve,dirname,relative,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalPublished} from '../web/world/hero-travel-publication.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointPlacements,checkpointActorRecords,checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {checkpointHaloHomeLeg} from '../web/world/halo-home-route.mjs';
import {planHaloActorHandoff} from '../web/world/halo-region-layout.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointActorOrderNavigation} from '../web/world/order-navigation.mjs';

const [manifestName,arrivalName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-resume-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
async function bound(r){assert.equal((await lstat(r.filename)).size,r.bytes);assert.equal(await hash(r.filename),r.sha256);}
const m=await json(manifestName),arrival=await json(arrivalName);
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.nativeSelectedHeroResumeBoundaryObserved,true);assert.equal(m.ownerTransferred,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
assert.equal(m.publicationWorkerTerminal,true);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.publicationWorkerAbsent,true);
assert.equal(m.publishArrival,true);assert.equal(m.nativeProcessesStarted,1);assert.equal(m.browserUsed,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
assert.equal(arrival.nativeHeroArrivalQualified,true);assert.equal(arrival.connectedArrivalActivatedQualified,true);
assert.equal(arrival.connectedSourceQualification.nativeSelectedHeroPagingQualified,true);
assert.equal(arrival.manifest.filename,resolve(manifestName));assert.equal(arrival.manifest.sha256,await hash(manifestName));
for(const[n,h]of Object.entries(arrival.sourceSha256))assert.equal(await hash(n),h);
assert.equal(await hash('scripts/publish-held-native-hero-arrival.mjs'),m.publicationWorkerSha256);
await bound(m.publication);await bound(m.publicationInput);await bound(m.arrivalPreparation);
const p=await json(m.publication.filename),preparation=await json(m.arrivalPreparation.filename),ready=parseNativeHeroArrivalReady(p.ready);
assert.equal(p.nativeHeldHeroPairPublished,true);assert.equal(p.nativePid,m.nativePid);assert.equal(p.fixture,m.fixture);
assert.deepEqual(p.compiledSourceSha256,m.compiledSourceSha256);assert.equal(p.nativeExecutableSha256,m.nativeExecutableSha256);
assert.equal(p.input.filename,m.publicationInput.filename);assert.equal(p.input.sha256,m.publicationInput.sha256);
assert.deepEqual(p.identity,preparation.identity);assert.equal(p.exactRetryWrites,0);
for(const[n,h]of Object.entries(p.sourceSha256))assert.equal(await hash(n),h);
for(const r of [p.captured,p.retired,p.active,...m.resumeWorlds])await bound(r);
for(const [a,b]of [[p.captured,arrival.connectedSourceQualification.sourceWorld],[p.retired,arrival.connectedSourceQualification.retiredWorld]]){
 for(const key of ['filename','bytes','sha256'])assert.equal(a[key],b[key]);assert.equal(a.largestRead,Math.min(4096,a.bytes));}
assert.equal(p.active.sha256,ready.sha256);assert.equal(p.active.bytes,ready.size);
const alias={unitId:ready.unitId,agentId:ready.agentId},home={kind:'proxy',unitId:0,agentId:ready.homeAgentId},receipt=p.publicationReceipt;
assert.deepEqual(alias,arrival.destinationAliases);assert.deepEqual(home,arrival.homeAlias);assert.equal(ready.clock,arrival.destinationClock);assert.equal(ready.serial,1);
assert.deepEqual(receipt.owner,alias);assert.deepEqual(receipt.home,home);assert.equal(receipt.ownerRevision,2);
assert.equal(receipt.acknowledgement,nativeHeroArrivalPublished(p.ready,receipt.ownerManifest));
assert.deepEqual(p.controls.map(v=>v.kind),['wrong-serial','wrong-clock','wrong-native-alias','unpublished-pair']);
assert.ok(p.controls.every(v=>v.refusedByEngine&&v.clock===ready.clock&&v.phase===7&&v.pending===0));
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from|GplException/.test(log));
const held='[frontier] Hero travel publication held receipt='+p.ready+' phase=7 pending=0 ordinary-ticks=0';
const refused='[frontier] Hero travel publication refused serial=1 region=1_0 clock='+ready.clock+' phase=7 pending=0';
const accepted='[frontier] Hero travel publication accepted serial=1 region=1_0 clock='+ready.clock+' manifest-sha256='+receipt.ownerManifestSha256+' both-worlds-verified=1 phase=7 pending=3';
const resumed='[frontier] Hero travel resumed serial=1 region=1_0 unit='+alias.unitId+' agent='+alias.agentId+' home=proxy/0/'+home.agentId+' clock='+ready.clock+' manifest-sha256='+receipt.ownerManifestSha256+' original-resume=1 fresh-binding=1 phase=3 pending=0';
assert.equal(log.split(held).length-1,1);assert.equal(log.split(refused).length-1,4);
assert.equal(log.split(accepted).length-1,1);assert.equal(log.split(resumed).length-1,1);
assert.ok(log.indexOf(held)<log.indexOf(refused)&&log.lastIndexOf(refused)<log.indexOf(accepted)&&log.indexOf(accepted)<log.indexOf(resumed));
assert.equal(m.resumeWorlds.length,2);assert.deepEqual(m.resumeWorlds.map(v=>basename(v.filename)),['Hero_Travel_Target_Published.GMP','Hero_Travel_Target_Routed.GMP']);
const crossed=[...log.matchAll(/^\[frontier\] Hero crossing serial=2 region=1_0 target=(\S+) previous-clock=(\d+) clock=(\d+) unit=(\d+) agent=(\d+) previous=(-?\d+,-?\d+,-?\d+) accepted=(-?\d+,-?\d+,-?\d+) phase=3 pending=7 original-tick=1 native-cells=4$/gm)];
assert.equal(crossed.length,1);const c=crossed[0];assert.equal(c[1],'0_0');assert.equal(Number(c[4]),alias.unitId);assert.equal(Number(c[5]),alias.agentId);
const pose=text=>{const n=text.split(',').map(Number);assert.ok(n.length===3&&n.every(Number.isSafeInteger));return {x:n[0],y:n[1],z:n[2]};};
const crossing={serial:2,region:ready.region,target:c[1],previousClock:Number(c[2]),clock:Number(c[3]),unitId:alias.unitId,agentId:alias.agentId,
 previous:pose(c[6]),accepted:pose(c[7])};
assert.equal(crossing.previousClock,crossing.clock-50);const ticks=(crossing.clock-ready.clock)/50;assert.ok(Number.isInteger(ticks)&&ticks>0&&ticks<=40);
const second=[...log.matchAll(/^\[frontier\] Hero save held serial=2 region=1_0 clock=(\d+) slot=([01]) bytes=(\d+) sha256=([0-9a-f]{64}) phase=7 pending=0$/gm)];
assert.equal(second.length,1);assert.equal(Number(second[0][1]),crossing.clock);assert.equal(Number(second[0][2]),0);
let secondWorld={filename:join(m.fixture,'frontier_1_0/Documents/My Games/MajestyHD/SaveGame/Frontier_1_0.GMP'),bytes:Number(second[0][3]),sha256:second[0][4]};
let marker=join(m.fixture,'frontier_1_0/Frontier_1_0.checkpoint');
if(m.pageRepeatNeighbor){
 await bound(m.secondPublication);const preserved=await json(m.secondPublication.filename);
 assert.equal(preserved.nativePid,m.nativePid);assert.equal(preserved.fixture,m.fixture);
 assert.equal(preserved.captured.filename,join(m.fixture,'frontier_1_0/Documents/My Games/MajestyHD/SaveGame/Hero_Remote_Capture_Accepted.GMP'));
 assert.equal(preserved.captured.bytes,secondWorld.bytes);assert.equal(preserved.captured.sha256,secondWorld.sha256);
 assert.equal(preserved.marker.filename,join(m.fixture,'frontier_1_0/Hero_Remote_Capture_Accepted.checkpoint'));
 await bound(preserved.marker);secondWorld=preserved.captured;marker=preserved.marker.filename;
}
await bound(secondWorld);assert.ok(log.indexOf(resumed)<crossed[0].index&&crossed[0].index<second[0].index);
const content=(await json(m.build.filename)).nativeExecutableSha256;
assert.equal(await readFile(marker,'utf8'),['checkpoint-v1','0',secondWorld.bytes,secondWorld.sha256,
 '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+content,''].join('\n'));

const rows=[arrival.connectedActivation.activeWorld,p.active,...m.resumeWorlds,secondWorld],sources=[],states=[],maps=[];
async function records(s){const result=new Map();async function add(key,r){assert.ok(result.size<4096&&!result.has(key));const h=createHash('sha256');
 for(let at=0;at<r.size;at+=4096)h.update(await s.readAt(r.offset+at,Math.min(4096,r.size-at)));result.set(key,{...r,sha256:h.digest('hex')});}
 for await(const r of checkpointUnits(s))await add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))await add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))await add(r.kind+':'+r.unitId,r);return result;}
for(const row of rows){await bound(row);const s=await stoppedFileSource(row.filename);sources.push(s);maps.push(await records(s));
 states.push(await connectedWorldState(row.filename,{unscheduledAgents:[34,home.agentId]}));
 await verifyRegisteredHeroSnapshot(p.identity,alias,home,s,true,ready.region);assert.equal(await checkpointNextAgentId(s),alias.agentId+1);
 const actor=await checkpointActorRecords(s,alias.unitId);assert.equal(actor.unit.agentId,alias.agentId);assert.equal(actor.agent.unitId,alias.unitId);
 assert.equal(actor.agent.deleted,false);assert.equal(actor.unit.parentUnitId,0);assert.equal(actor.unit.stateFlags&4,0);
 for(const k of ['family','description','playerNumber'])assert.equal(actor.unit[k],p.identity.actor[k]);}
assert.deepEqual(states.map(v=>v.clock),[ready.clock,ready.clock,ready.clock,ready.clock,crossing.clock]);
let exactRecordComparisons=0;
function sameRecords(a,b,omit=[]){assert.deepEqual([...a.keys()].sort(),[...b.keys()].sort());
 for(const[key,r]of a)if(!omit.includes(key)){assert.equal(b.get(key).size,r.size);assert.equal(b.get(key).sha256,r.sha256,key);exactRecordComparisons++;}}
for(const [a,b]of [[0,1],[1,2]]){sameRecords(maps[a],maps[b]);assert.deepEqual(states[a].roots,states[b].roots);}
sameRecords(maps[2],maps[3],['ORDR:'+alias.unitId]);
assert.deepEqual(states[2].roots.filter(v=>v.tag!=='ORDR'),states[3].roots.filter(v=>v.tag!=='ORDR'));
const leg=await checkpointHaloHomeLeg(sources[2],{identity:p.identity,alias,homeAlias:home,region:ready.region});assert.equal(leg.nextRegion,crossing.target);
const entries=[],points=[];
for await(const e of checkpointActorOrderEntries(sources[3],alias.unitId))if(e.type==='entry')entries.push({bank:e.bank,index:e.index,kind:e.kind,stamp:e.words[5],count:e.waypointCount});
assert.deepEqual(entries,[{bank:0,index:0,kind:4,stamp:ready.clock,count:0},{bank:1,index:0,kind:7,stamp:ready.clock,count:1}]);
for await(const v of checkpointActorOrderNavigation(sources[3],alias.unitId))if(['destination','waypoint'].includes(v.field))points.push({kind:v.kind,field:v.field,x:v.x,y:v.y});
assert.deepEqual(points,[{kind:4,field:'destination',...leg.movementPoint},{kind:7,field:'waypoint',...leg.movementPoint}]);
const handoff=planHaloActorHandoff(crossing.previous,crossing.accepted,ready.region);assert.equal(handoff.destinationRegion,crossing.target);
let observedPose;for await(const v of checkpointPlacements(sources[4]))if(v.unitId===alias.unitId){assert.equal(observedPose,undefined);observedPose=v.fixedPosition;}
assert.deepEqual(observedPose,crossing.accepted);
assert.deepEqual([...maps[4].keys()].sort(),[...maps[3].keys()].sort());
for(const key of ['GPL:34','GPL:'+home.agentId,'CONT:'+alias.unitId])assert.equal(maps[4].get(key).sha256,maps[3].get(key).sha256);
for(const state of states)assert.equal(state.rawTerrainSha256,states[0].rawTerrainSha256);
const otherUnitsChanged=[...maps[4]].filter(([key,r])=>key.startsWith('UNIT:')&&key!=='UNIT:'+alias.unitId&&r.sha256!==maps[3].get(key).sha256).length;
const otherScriptsChanged=[...maps[4]].filter(([key,r])=>key.startsWith('GPL:')&&key!=='GPL:'+alias.agentId&&r.sha256!==maps[3].get(key).sha256).length;
assert.ok(otherUnitsChanged>0&&otherScriptsChanged>0);

await ownedDirectory(p.journal,'actor-arrival-fixture-hero-route-');assert.equal(p.journal,m.publicationJournal);
// A later captured save legitimately advances the live head. Verify the exact
// preserved revision2 view for this first-arrival proof; the separate second
// publication inspector must qualify the new head and its complete transition.
let arrivalJournal=p.journal;
if(m.publishSecondCapture){
 assert.equal(m.nativeSelectedSecondHeroCapturePublicationObserved,true);await bound(m.secondPublication);
 const second=await json(m.secondPublication.filename);assert.equal(second.nativePid,m.nativePid);assert.equal(second.fixture,m.fixture);
 assert.equal(second.firstPublication.filename,m.publication.filename);assert.equal(second.firstPublication.sha256,m.publication.sha256);
 assert.equal(second.journal,p.journal);assert.deepEqual(second.beforeJournalSha256,p.journalSha256);
 arrivalJournal=await ownedDirectory(second.beforeJournal,'actor-arrival-fixture-hero-route-before-second-');
}
assert.deepEqual((await readdir(arrivalJournal)).sort(),Object.keys(p.journalSha256).sort());
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(arrivalJournal,n)),h);
assert.equal(await readFile(join(arrivalJournal,HERO_ROUTE_HEAD),'utf8'),receipt.ownerManifest);
const stats={},io=await stoppedHeroRouteStorage(arrivalJournal,stats),store=new HeroRouteStore(io,p.identity,p.identity.contentDigest);
let escaped;const opened=[],originalOpen=io.open;io.open=async n=>{opened.push(n);return originalOpen(n);};
await store.withOwner(async selected=>{
 assert.equal(selected.record.manifest,receipt.ownerManifest);assert.equal(selected.record.revision,2);assert.deepEqual(selected.entry.alias,alias);
 assert.deepEqual(selected.entry.homeAlias,home);assert.equal(selected.entry.world.sha256,ready.sha256);assert.equal(await checkpointSavedClock(selected.source),ready.clock);escaped=selected.source;
});await assert.rejects(escaped.readAt(0,16),/lease ended/);
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_1_0_0.GMP']);
for(const[name,r]of [['Frontier_Hero_Route_0_0_0.GMP',p.retired],['Frontier_Hero_Route_0_0_1.GMP',p.captured],['Frontier_Hero_Route_1_0_0.GMP',p.active]])
 assert.equal(await hash(join(arrivalJournal,name)),r.sha256);
let arrivalAck=join(m.fixture,'frontier_1_0/Frontier_Hero_Travel_Published.txt');
if(m.importRepeatNeighbor){await bound(m.repeatNeighborPageInput);const staged=await json(m.repeatNeighborPageInput.filename);
 assert.equal(staged.nativePid,m.nativePid);assert.equal(staged.fixture,m.fixture);
 assert.equal(staged.firstAcknowledgement.filename,join(m.fixture,'frontier_1_0/Hero_Travel_First_Published.txt'));
 await bound(staged.firstAcknowledgement);arrivalAck=staged.firstAcknowledgement.filename;
}
assert.equal(await readFile(arrivalAck,'utf8'),receipt.acknowledgement);
assert.ok(m.resourceSamples.length&&m.resourceSamples.every(v=>v.rssBytes<=m.rssCeilingBytes));
const sourceSha256={...arrival.sourceSha256,...p.sourceSha256},pending=[resolve('scripts/inspect-native-hero-resume.mjs')],seen=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(seen.has(name))continue;seen.add(name);
 assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&seen.size<256);const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);
 const h=await hash(n);if(sourceSha256[name])assert.equal(h,sourceSha256[name]);sourceSha256[name]=h;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,nativeConnectedHeroPublicationResumeQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 arrivalQualification:{filename:resolve(arrivalName),sha256:await hash(arrivalName)},publication:m.publication,sourceSha256,
 originalWorlds:rows,publishedOwner:{entityId:p.identity.entityId,region:ready.region,...alias},homeAlias:home,
 publishedManifest:receipt.ownerManifest,exactRecordComparisons,staleReceiptControls:4,sourceRetired:true,sourceUnloaded:true,
 pairPublishedUnderNativeHold:true,originalResumeQualified:true,freshScalarBindingQualified:true,originalTicks:ticks,
 physicalHomeLeg:leg,secondCrossing:crossing,secondCapturedWorld:secondWorld,handoff,otherUnitsChanged,otherScriptsChanged,
 immutableRegisteredHomePreserved:true,otherTerrainExact:true,ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,
 arrivalJournalVerified:arrivalJournal,secondCapturePublicationObserved:m.publishSecondCapture===true,
 secondCapturePublicationIndependentlyQualified:false,secondDestinationLoaded:false,browserUsed:false,realOPFSDurabilityQualified:false,
 nativeSessionTerminal:true,ownedProducerAbsent:true,publicationWorkerTerminal:true,publicationWorkerAbsent:true,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeAndPublisherRssBytes:Math.max(...m.resourceSamples.map(v=>v.rssBytes)),goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeConnectedHeroPublicationResumeQualified:true,originalTicks:ticks,exactRecordComparisons,
 secondCrossingClock:crossing.clock,secondCapturePublicationObserved:m.publishSecondCapture===true,otherUnitsChanged,otherScriptsChanged}));
