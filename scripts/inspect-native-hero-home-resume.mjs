#!/usr/bin/env node
// Verify the live revision4 pair, its native acknowledgement and actual six
// home gameplay ticks independently of the worker and native pass labels.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {heroCapturedJournalView,heroHomePublishedJournalView} from './lib/hero-captured-journal-view.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalPublished} from '../web/world/hero-travel-publication.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointPlacements,checkpointActorRecords} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';

const [manifestName,activationName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-home-resume-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function bound(r){assert.equal((await lstat(r.filename)).size,r.bytes);assert.equal(await hash(r.filename),r.sha256);}
const m=await json(manifestName),q=await json(activationName);
assert.equal(q.nativeConnectedHeroHomeActivationQualified,true);assert.equal(q.manifest.filename,resolve(manifestName));assert.equal(q.manifest.sha256,await hash(manifestName));
for(const[n,h]of Object.entries(q.sourceSha256))assert.equal(await hash(n),h);
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.publishHome,true);assert.equal(m.nativeSelectedHeroHomeResumeBoundaryObserved,true);
assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.publicationWorkerTerminal,true);
assert.equal(m.ownedProducerAbsent,true);assert.equal(m.publicationWorkerAbsent,true);assert.equal(m.nativeProcessesStarted,1);assert.equal(m.browserUsed,false);
assert.equal(m.stopReason,null);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(n),h);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
for(const row of [m.homePublication,m.publication,m.secondPublication,...Object.values(m.homeResumeWorlds)])await bound(row);
const p=await json(m.publication.filename),s=await json(m.secondPublication.filename),h=await json(m.homePublication.filename);
assert.equal(h.nativeHeldHeroHomePairPublished,true);assert.equal(h.nativePid,m.nativePid);assert.equal(h.fixture,m.fixture);
assert.equal(h.journal,m.publicationJournal);assert.equal(h.journal,s.journal);assert.equal(h.expectedManifest,s.ownerManifest);
assert.equal(h.firstPublication.sha256,m.publication.sha256);assert.equal(h.secondPublication.sha256,m.secondPublication.sha256);
const historical=await heroCapturedJournalView(m,s);assert.equal(historical,h.beforeJournal);
const ready=parseNativeHeroArrivalReady(h.ready),r=h.publicationReceipt;
assert.equal(ready.serial,2);assert.equal(ready.region,'0_0');assert.equal(ready.clock,q.homeClock);
assert.deepEqual({unitId:ready.unitId,agentId:ready.agentId},q.actualAlias);assert.equal(ready.homeAgentId,q.homeAlias.agentId);
assert.deepEqual(r.owner,q.actualAlias);assert.deepEqual(r.home,q.homeAlias);assert.equal(r.ownerRevision,4);
assert.equal(r.acknowledgement,nativeHeroArrivalPublished(h.ready,r.ownerManifest));assert.equal(h.exactRetryWrites,0);
assert.ok(h.stats.largestRead<=4096&&h.stats.largestWrite<=4096&&h.stats.peakReads===1&&h.stats.activeReads===0);
for(const row of [h.active,h.retired,h.marker,s.captured,s.marker])await bound(row);
assert.equal(h.active.bytes,ready.size);assert.equal(h.active.sha256,ready.sha256);assert.equal(h.retired.sha256,m.remoteSourceRetirementSaves.Hero_Remote_Source_Retired.sha256);
assert.equal(await readFile(h.marker.filename,'utf8'),h.nativeManifest);
assert.equal(h.nativeManifest,['checkpoint-v1','1',ready.size,ready.sha256,
 '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
const homeJournal=await heroHomePublishedJournalView(m,h);
assert.deepEqual((await readdir(homeJournal)).sort(),Object.keys(h.journalSha256).sort());
for(const[n,digest]of Object.entries(h.journalSha256))assert.equal(await hash(join(homeJournal,n)),digest);
assert.equal(await readFile(join(homeJournal,HERO_ROUTE_HEAD),'utf8'),r.ownerManifest);
const changed=Object.keys(h.journalSha256).filter(n=>h.journalSha256[n]!==s.journalSha256[n]).sort();
assert.deepEqual(changed,['Frontier_Hero_Route.checkpoint','Frontier_Hero_Route_0_0_1.GMP','Frontier_Hero_Route_1_0_0.GMP','Frontier_Hero_Route_Node_4.json']);
assert.ok(Object.keys(s.journalSha256).every(n=>changed.includes(n)||h.journalSha256[n]===s.journalSha256[n]));
const node=await json(join(homeJournal,'Frontier_Hero_Route_Node_4.json'));
assert.equal(node.kind,'handoff');assert.equal(node.ownerRegion,'0_0');assert.equal(node.revision,4);assert.deepEqual(node.previous,JSON.parse(s.ownerManifest));
assert.deepEqual(node.changes,[{region:'1_0',slot:0,alias:{unitId:s.owner.unitId,agentId:s.owner.agentId},homeAlias:s.homeAlias,world:{size:h.retired.bytes,sha256:h.retired.sha256}},
 {region:'0_0',slot:1,alias:q.actualAlias,homeAlias:q.homeAlias,world:{size:h.active.bytes,sha256:h.active.sha256}}]);
const stats={},io=await stoppedHeroRouteStorage(homeJournal,stats),store=new HeroRouteStore(io,p.identity,p.identity.contentDigest);
const opened=[],realOpen=io.open;io.open=async n=>{opened.push(n);return realOpen(n);};let escaped;
await store.withOwner(async v=>{assert.equal(v.record.manifest,r.ownerManifest);assert.equal(v.record.revision,4);assert.equal(v.owner.region,'0_0');
 assert.equal(v.owner.entityId,p.identity.entityId);assert.deepEqual(v.entry.alias,q.actualAlias);assert.deepEqual(v.entry.homeAlias,q.homeAlias);
 assert.equal(v.entry.world.sha256,ready.sha256);assert.equal(await checkpointSavedClock(v.source),ready.clock);escaped=v.source;
});await assert.rejects(escaped.readAt(0,16),/lease ended/);
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_1.GMP']);
const rows=[q.activeWorld,h.active,m.homeResumeWorlds.Hero_Return_Home_Published,m.homeResumeWorlds.Hero_Return_Home_Played],sources=[],states=[],maps=[];
async function records(s){const map=new Map(),add=async(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);const digest=createHash('sha256');
 for(let at=0;at<row.size;at+=4096)digest.update(await s.readAt(row.offset+at,Math.min(4096,row.size-at)));map.set(key,{size:row.size,sha256:digest.digest('hex')});};
 for await(const row of checkpointUnits(s))await add('UNIT:'+row.primary.words[1],row);
 for await(const row of checkpointAgents(s))await add('GPL:'+row.agentId,row);
 for await(const row of checkpointAttachments(s))await add(row.kind+':'+row.unitId,row);return map;}
for(const row of rows){await bound(row);const source=await stoppedFileSource(row.filename);sources.push(source);maps.push(await records(source));
 states.push(await connectedWorldState(row.filename));await verifyRegisteredHeroSnapshot(p.identity,q.actualAlias,q.homeAlias,source,true,'0_0');
 const actor=await checkpointActorRecords(source,q.actualAlias.unitId);assert.equal(actor.agent.agentId,q.actualAlias.agentId);assert.equal(actor.agent.deleted,false);
 assert.equal(actor.unit.parentUnitId,0);for(const k of ['family','description','playerNumber'])assert.equal(actor.unit[k],p.identity.actor[k]);}
assert.deepEqual(states.map(v=>v.clock),[ready.clock,ready.clock,ready.clock,ready.clock+300]);
let exactPausedRecordComparisons=0;
for(const i of [1,2]){compareConnectedWorlds(states[0],states[i]);assert.deepEqual(states[0].roots,states[i].roots);
 assert.deepEqual([...maps[i].keys()].sort(),[...maps[0].keys()].sort());for(const[key,row]of maps[0]){assert.deepEqual(maps[i].get(key),row,key);exactPausedRecordComparisons++;}}
const poses=[];for(const source of [sources[2],sources[3]]){let pose;for await(const row of checkpointPlacements(source))if(row.unitId===q.actualAlias.unitId){assert.equal(pose,undefined);pose=row.fixedPosition;}assert.ok(pose);poses.push(pose);}
assert.notDeepEqual(poses[0],poses[1]);assert.ok(poses[1].x<poses[0].x,'Returned native-home hero must continue its inward physical leg');
assert.equal(states[3].rawTerrainSha256,states[2].rawTerrainSha256);
const changedRecords=[...maps[3]].filter(([key,row])=>JSON.stringify(row)!==JSON.stringify(maps[2].get(key))).map(([key])=>key);
assert.ok(changedRecords.includes('UNIT:'+q.actualAlias.unitId));assert.ok(changedRecords.includes('GPL:'+q.actualAlias.agentId));
const log=await readFile(m.log,'utf8');assert.equal(await hash(m.log),m.logSha256);assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from|GplException/.test(log));
assert.deepEqual(h.controls.map(v=>v.kind),['wrong-serial','wrong-clock','wrong-native-alias','wrong-native-home','unpublished-return']);assert.ok(h.controls.every(v=>v.refusedByEngine&&v.phase===7&&v.pending===0&&v.clock===ready.clock));
const held=`[frontier] Hero travel publication held receipt=${h.ready} phase=7 pending=0 ordinary-ticks=0`;
const refused=`[frontier] Hero travel publication refused serial=2 region=0_0 clock=${ready.clock} phase=7 pending=0`;
const accepted=`[frontier] Hero travel publication accepted serial=2 region=0_0 clock=${ready.clock} manifest-sha256=${r.ownerManifestSha256} both-worlds-verified=1 phase=7 pending=3`;
const resumed=`[frontier] Hero travel resumed serial=2 region=0_0 unit=${ready.unitId} agent=${ready.agentId} home=native/${q.homeAlias.unitId}/${q.homeAlias.agentId} clock=${ready.clock} manifest-sha256=${r.ownerManifestSha256} original-resume=1 fresh-binding=1 phase=3 pending=0`;
const played=`[frontier] Hero return home gameplay held serial=2 region=0_0 unit=${ready.unitId} agent=${ready.agentId} home=${q.homeAlias.unitId}/${q.homeAlias.agentId} from-clock=${ready.clock} clock=${ready.clock+300} ticks=6 original-gameplay=1 fresh-native-binding=1 phase=7 pending=0 result=pass`;
for(const line of [held,accepted,resumed,played])assert.equal(log.split(line).length-1,1);assert.equal(log.split(refused).length-1,5);
assert.ok(log.indexOf(held)<log.indexOf(refused)&&log.lastIndexOf(refused)<log.indexOf(accepted)&&log.indexOf(accepted)<log.indexOf(resumed)&&log.indexOf(resumed)<log.indexOf(played));
let firstReturnAck=join(m.fixture,'frontier_0_0/Frontier_Hero_Travel_Published.txt');
if(m.publishRepeatHome){await bound(m.repeatHomePageInput);const stage=await json(m.repeatHomePageInput.filename);
 assert.equal(stage.nativePid,m.nativePid);assert.equal(stage.fixture,m.fixture);await bound(stage.firstReturnAcknowledgement);firstReturnAck=stage.firstReturnAcknowledgement.filename;}
assert.equal(await readFile(firstReturnAck,'utf8'),r.acknowledgement);
const sourceSha256={...q.sourceSha256},pending=[resolve('scripts/inspect-native-hero-home-resume.mjs')],seen=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(seen.has(name))continue;seen.add(name);assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&seen.size<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);const digest=await hash(n);if(sourceSha256[name])assert.equal(sourceSha256[name],digest);sourceSha256[name]=digest;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,homeJournalVerified:homeJournal,homeJournalIsHistorical:m.saveHome===true,nativeConnectedHeroHomePublicationResumeQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 activationQualification:{filename:resolve(activationName),sha256:await hash(activationName)},sourceSha256,homePublication:m.homePublication,
 actualAlias:q.actualAlias,homeAlias:q.homeAlias,ownerRevision:4,ownerManifest:r.ownerManifest,homeClock:ready.clock,playedClock:ready.clock+300,
 exactPausedRecordComparisons,changedGameplayRecords:changedRecords,poses,originalHomeTicks:6,refusedNativeReceipts:5,
 changedJournalFiles:changed,liveNativeReceiptConsumed:true,homewardGameplayResumed:true,originalNativeGuildAIGuarded:false,
 dormantWorldsOpenedByOwnerExport:0,ownerReaderRevoked:true,singleNativeProcess:true,nativeSessionTerminal:true,publicationWorkerTerminal:true,
 browserUsed:false,realOPFSDurabilityQualified:false,repeatedTripsQualified:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeConnectedHeroHomePublicationResumeQualified:true,ownerRevision:4,originalHomeTicks:6,exactPausedRecordComparisons,refusedNativeReceipts:5}));
