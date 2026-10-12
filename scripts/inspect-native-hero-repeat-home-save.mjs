#!/usr/bin/env node
// Qualify continued gameplay selected by the real live journal and consumed
// by the same original engine, preserving the prior arrival selection as history.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {heroRepeatHomePublishedJournalView} from './lib/hero-captured-journal-view.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {nativeHeroArrivalPublished,parseNativeHeroArrivalReady} from '../web/world/hero-travel-publication.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointPlacements} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
const [manifestName,resumeName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-repeat-home-save-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function bound(r){assert.equal((await lstat(r.filename)).size,r.bytes);assert.equal(await hash(r.filename),r.sha256);}
const m=await json(manifestName),q=await json(resumeName);
assert.equal(q.nativeConnectedRepeatedHeroHomePublicationResumeQualified,true);assert.equal(q.manifest.filename,resolve(manifestName));assert.equal(q.manifest.sha256,await hash(manifestName));
for(const[n,h]of Object.entries(q.sourceSha256))assert.equal(await hash(n),h);
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.saveRepeatHome,true);assert.equal(m.nativeSelectedHeroContinuedRepeatHomeSaveBoundaryObserved,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
assert.equal(m.publicationWorkerTerminal,true);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.publicationWorkerAbsent,true);
assert.equal(m.nativeProcessesStarted,1);assert.equal(m.browserUsed,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
for(const row of [m.repeatHomeSavePublication,m.repeatHomePublication,m.publication,m.repeatHomeResumeWorlds.Hero_Repeat_Return_Home_Played])await bound(row);
const first=await json(m.publication.filename),home=await json(m.repeatHomePublication.filename),saved=await json(m.repeatHomeSavePublication.filename),ready=parseNativeHeroArrivalReady(saved.ready),receipt=saved.publicationReceipt;
assert.equal(saved.nativeContinuedHeroRepeatHomeSavePublished,true);assert.equal(saved.nativePid,m.nativePid);assert.equal(saved.fixture,m.fixture);
assert.equal(saved.homePublication.filename,m.repeatHomePublication.filename);assert.equal(saved.homePublication.sha256,m.repeatHomePublication.sha256);
assert.equal(saved.journal,m.publicationJournal);assert.equal(saved.expectedManifest,q.ownerManifest);assert.equal(saved.expectedManifest,home.publicationReceipt.ownerManifest);
assert.equal(await heroRepeatHomePublishedJournalView(m,home),q.homeJournalVerified);
assert.equal(ready.serial,7);assert.equal(ready.region,'0_0');assert.equal(ready.clock,q.playedClock);assert.equal(ready.clock,q.homeClock+300);
assert.deepEqual({unitId:ready.unitId,agentId:ready.agentId},q.actualAlias);assert.equal(ready.homeAgentId,q.homeAlias.agentId);
assert.deepEqual(receipt.owner,q.actualAlias);assert.deepEqual(receipt.home,q.homeAlias);assert.equal(receipt.ownerRevision,11);
assert.equal(receipt.clock,ready.clock);assert.equal(receipt.sha256,ready.sha256);assert.equal(receipt.size,ready.size);assert.equal(saved.exactRetryWrites,0);
assert.equal(saved.acknowledgement,nativeHeroArrivalPublished(saved.ready,receipt.ownerManifest).replace(/^majesty-hero-travel-published-v1\|/,'majesty-hero-capture-published-v1|'));
for(const row of [saved.captured,saved.marker,home.active,home.marker])await bound(row);
assert.equal(saved.captured.bytes,ready.size);assert.equal(saved.captured.sha256,ready.sha256);assert.equal(await readFile(saved.marker.filename,'utf8'),saved.nativeManifest);
assert.equal(saved.nativeManifest,['checkpoint-v1','1',ready.size,ready.sha256,
 '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
await ownedDirectory(saved.journal,'actor-arrival-fixture-hero-route-');
const continuedJournal=await ownedDirectory(saved.journal,'actor-arrival-fixture-hero-route-');
assert.deepEqual((await readdir(continuedJournal)).sort(),Object.keys(saved.journalSha256).sort());
for(const[n,h]of Object.entries(saved.journalSha256))assert.equal(await hash(join(continuedJournal,n)),h);
assert.equal(await readFile(join(continuedJournal,HERO_ROUTE_HEAD),'utf8'),receipt.ownerManifest);
const changed=Object.keys(saved.journalSha256).filter(n=>saved.journalSha256[n]!==home.journalSha256[n]).sort();
assert.deepEqual(changed,['Frontier_Hero_Route.checkpoint','Frontier_Hero_Route_0_0_0.GMP','Frontier_Hero_Route_Node_11.json']);
for(const[n,h]of Object.entries(home.journalSha256))if(!changed.includes(n))assert.equal(saved.journalSha256[n],h);
const node=await json(join(continuedJournal,'Frontier_Hero_Route_Node_11.json'));
assert.deepEqual(node.previous,JSON.parse(q.ownerManifest));assert.equal(node.kind,'save');assert.equal(node.ownerRegion,ready.region);assert.equal(node.revision,11);
assert.deepEqual(node.changes,[{region:ready.region,slot:0,alias:q.actualAlias,homeAlias:q.homeAlias,world:{size:ready.size,sha256:ready.sha256}}]);
const head=JSON.parse(receipt.ownerManifest);assert.equal(head.revision,11);assert.equal(head.nodeSha256,await hash(join(continuedJournal,'Frontier_Hero_Route_Node_11.json')));
const stats={},io=await stoppedHeroRouteStorage(continuedJournal,stats),store=new HeroRouteStore(io,first.identity,first.identity.contentDigest);
const opened=[],realOpen=io.open;io.open=async n=>{opened.push(n);return realOpen(n);};let escaped,selected;
await store.withOwner(async v=>{
 assert.equal(v.record.manifest,receipt.ownerManifest);assert.equal(v.record.revision,11);assert.equal(v.owner.region,ready.region);assert.equal(v.owner.entityId,first.identity.entityId);
 assert.deepEqual(v.entry.alias,q.actualAlias);assert.deepEqual(v.entry.homeAlias,q.homeAlias);assert.equal(v.entry.world.sha256,ready.sha256);
 assert.equal(await checkpointSavedClock(v.source),ready.clock);selected={record:v.record,entry:v.entry,owner:v.owner};escaped=v.source;
});await assert.rejects(escaped.readAt(0,16),/lease ended/);
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_0.GMP']);
const journalWorld={filename:join(continuedJournal,'Frontier_Hero_Route_0_0_0.GMP'),bytes:ready.size,sha256:ready.sha256};
const rows=[m.repeatHomeResumeWorlds.Hero_Repeat_Return_Home_Played,saved.captured,journalWorld],states=[],maps=[],poses=[];
async function records(s){const map=new Map(),add=async(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);const h=createHash('sha256');
 for(let at=0;at<row.size;at+=4096)h.update(await s.readAt(row.offset+at,Math.min(4096,row.size-at)));map.set(key,{size:row.size,sha256:h.digest('hex')});};
 for await(const row of checkpointUnits(s))await add('UNIT:'+row.primary.words[1],row);
 for await(const row of checkpointAgents(s))await add('GPL:'+row.agentId,row);
 for await(const row of checkpointAttachments(s))await add(row.kind+':'+row.unitId,row);return map;}
for(const row of rows){await bound(row);const source=await stoppedFileSource(row.filename);states.push(await connectedWorldState(row.filename));maps.push(await records(source));
 assert.equal(states.at(-1).clock,ready.clock);await verifyRegisteredHeroSnapshot(first.identity,q.actualAlias,q.homeAlias,source,true,'0_0');
 let pose;for await(const row of checkpointPlacements(source))if(row.unitId===q.actualAlias.unitId){assert.equal(pose,undefined);pose=row.fixedPosition;}poses.push(pose);}
assert.deepEqual(poses,[q.poses[1],q.poses[1],q.poses[1]]);let exactContinuedRecordComparisons=0;
for(const i of [1,2]){compareConnectedWorlds(states[0],states[i]);assert.deepEqual(states[0].roots,states[i].roots);assert.equal(states[0].rawTerrainSha256,states[i].rawTerrainSha256);
 assert.deepEqual([...maps[0].keys()].sort(),[...maps[i].keys()].sort());for(const[key,row]of maps[0]){assert.deepEqual(maps[i].get(key),row,key);exactContinuedRecordComparisons++;}}
assert.deepEqual(saved.controls.map(v=>v.kind),['old-native-alias','old-remote-home','wrong-held-clock','stale-return-head','changed-capture-digest']);assert.ok(saved.controls.every(v=>v.refused&&v.additionalWrites===0));
assert.deepEqual(saved.nativeControls.map(v=>v.kind),['wrong-clock','wrong-native-alias','wrong-native-guild','wrong-checkpoint-digest','unpublished-save']);assert.ok(saved.nativeControls.every(v=>v.refusedByEngine&&v.clock===ready.clock&&v.phase===7&&v.pending===0));
assert.ok(saved.stats.largestRead<=4096&&saved.stats.largestWrite<=4096&&saved.stats.peakReads===1&&saved.stats.activeReads===0);
const log=await readFile(m.log,'utf8');assert.equal(await hash(m.log),m.logSha256);assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from|GplException/.test(log));
const held=`[frontier] Hero repeated home save held receipt=${saved.ready} phase=7 pending=0 ordinary-ticks=0`;
const refused=`[frontier] Hero captured publication refused serial=7 region=0_0 clock=${ready.clock} phase=7 pending=0`;
const accepted=`[frontier] Hero repeated home save accepted serial=7 region=0_0 unit=${ready.unitId} agent=${ready.agentId} home=${q.homeAlias.unitId}/${q.homeAlias.agentId} clock=${ready.clock} manifest-sha256=${saved.acknowledgement.trim().split('|').at(-1)} selected-capture-verified=1 fresh-native-binding=1 phase=7 pending=0 result=pass`;
assert.equal(log.split(held).length-1,1);assert.equal(log.split(refused).length-1,5);assert.equal(log.split(accepted).length-1,1);
assert.ok(log.indexOf(held)<log.indexOf(refused)&&log.lastIndexOf(refused)<log.indexOf(accepted));
let retainedAcknowledgement=saved.acknowledgement;
assert.equal(await readFile(join(m.fixture,'frontier_0_0/Frontier_Hero_Capture_Published.txt'),'utf8'),retainedAcknowledgement);
const sourceSha256={...q.sourceSha256},pending=[resolve('scripts/inspect-native-hero-repeat-home-save.mjs')],seen=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(seen.has(name))continue;seen.add(name);assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&seen.size<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);const h=await hash(n);if(sourceSha256[name])assert.equal(sourceSha256[name],h);sourceSha256[name]=h;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,continuedJournalVerified:continuedJournal,continuedJournalIsHistorical:false,nativeConnectedContinuedHeroRepeatHomeSaveQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 resumeQualification:{filename:resolve(resumeName),sha256:await hash(resumeName)},sourceSha256,homeSavePublication:m.repeatHomeSavePublication,
 ownerManifest:receipt.ownerManifest,ownerRevision:11,selected,clock:ready.clock,actualAlias:q.actualAlias,homeAlias:q.homeAlias,
 originalPlayedWorld:rows[0],nativeCapturedWorld:saved.captured,selectedJournalWorld:journalWorld,exactContinuedRecordComparisons,
 changedJournalFiles:changed,zeroWriteControls:5,refusedNativeReceipts:5,exactRetryWrites:0,
 nativeReceiptConsumed:true,continuedHomeStatePersisted:true,ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,
 nativeSessionTerminal:true,publicationWorkerTerminal:true,singleNativeProcess:true,homeSaveHeldBeforeDeparture:true,homeSaveRemainsPaused:true,
 browserUsed:false,realOPFSDurabilityQualified:false,repeatedTripsQualified:true,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeConnectedContinuedHeroRepeatHomeSaveQualified:true,ownerRevision:11,clock:ready.clock,exactContinuedRecordComparisons,zeroWriteControls:5,refusedNativeReceipts:5}));
