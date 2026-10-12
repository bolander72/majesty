#!/usr/bin/env node
// Independently qualify the current proxy owner's second captured save and
// its exact journal publication after connected original resume.
import assert from 'node:assert/strict';
import {heroCapturedJournalView} from './lib/hero-captured-journal-view.mjs';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {selectedHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {requireCheckpointHeroCrossing} from '../web/world/hero-travel-boundary.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';

const [manifestName,resumeName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-second-publication-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
async function bound(r){assert.equal((await lstat(r.filename)).size,r.bytes);assert.equal(await hash(r.filename),r.sha256);}
const m=await json(manifestName),q=await json(resumeName);
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.publishSecondCapture,true);assert.equal(m.nativeSelectedSecondHeroCapturePublicationObserved,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
assert.equal(m.publicationWorkerTerminal,true);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.publicationWorkerAbsent,true);
assert.equal(m.nativeProcessesStarted,1);assert.equal(m.browserUsed,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');await bound(m.publication);await bound(m.secondPublication);
assert.equal(q.nativeConnectedHeroPublicationResumeQualified,true);assert.equal(q.manifest.filename,resolve(manifestName));assert.equal(q.manifest.sha256,await hash(manifestName));
assert.equal(q.secondCapturePublicationObserved,true);assert.equal(q.secondCapturePublicationIndependentlyQualified,false);
for(const[n,h]of Object.entries(q.sourceSha256))assert.equal(await hash(n),h);
const p=await json(m.publication.filename),s=await json(m.secondPublication.filename);
assert.equal(s.nativeHeldSecondHeroCapturePublished,true);assert.equal(s.fixture,m.fixture);assert.equal(s.nativePid,m.nativePid);
assert.equal(s.firstPublication.filename,m.publication.filename);assert.equal(s.firstPublication.sha256,m.publication.sha256);
assert.equal(s.journal,p.journal);assert.equal(s.journal,m.publicationJournal);assert.equal(s.beforeJournal,q.arrivalJournalVerified);
assert.deepEqual(s.beforeJournalSha256,p.journalSha256);assert.equal(s.expectedManifest,p.publicationReceipt.ownerManifest);
assert.deepEqual(s.crossing,q.secondCrossing);assert.deepEqual(s.homeAlias,q.homeAlias);
for(const k of ['filename','bytes','sha256'])assert.equal(s.captured[k],q.secondCapturedWorld[k]);
await bound(s.captured);await bound(s.marker);assert.equal(s.held.clock,q.secondCrossing.clock);
assert.equal(s.held.serial,2);assert.equal(s.held.region,'1_0');assert.equal(s.held.slot,0);assert.equal(s.held.size,s.captured.bytes);assert.equal(s.held.sha256,s.captured.sha256);
assert.equal(await readFile(s.marker.filename,'utf8'),s.nativeManifest);
assert.equal(s.nativeManifest,['checkpoint-v1',s.held.slot,s.held.size,s.held.sha256,
 '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
assert.equal(s.ownerRevision,3);assert.equal(s.exactRetryWrites,0);assert.equal(s.capturedWhileNativeHeld,true);assert.equal(s.nativeResumeAcknowledged,false);
assert.equal(s.sourceRetired,false);assert.equal(s.secondDestinationLoaded,false);assert.equal(s.browserUsed,false);assert.equal(s.realOPFSDurabilityQualified,false);
assert.deepEqual(s.controls.map(c=>c.kind),['old-native-alias','old-native-home','stale-manifest','wrong-held-clock','wrong-held-position']);
assert.ok(s.controls.every(c=>c.refused&&c.writes===0));assert.ok(s.stats.largestRead<=4096&&s.stats.largestWrite<=4096&&s.stats.peakReads===1&&s.stats.activeReads===0);
const before=await ownedDirectory(s.beforeJournal,'actor-arrival-fixture-hero-route-before-second-');
assert.deepEqual((await readdir(before)).sort(),Object.keys(p.journalSha256).sort());
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(before,n)),h);
const oldIO=await stoppedHeroRouteStorage(before),oldStore=new HeroRouteStore(oldIO,p.identity,p.identity.contentDigest);
let oldEntry;
await oldStore.withOwner(async v=>{
 assert.equal(v.record.manifest,s.expectedManifest);assert.equal(v.record.revision,2);assert.equal(v.entry.region,s.held.region);
 assert.deepEqual(v.entry.alias,p.publicationReceipt.owner);assert.deepEqual(v.entry.homeAlias,s.homeAlias);
 assert.equal(await checkpointSavedClock(v.source),p.publicationReceipt.clock);oldEntry=v.entry;
 assert.equal(selectedHeroRuntimeBinding(p.identity,v.entry,p.publicationReceipt.clock),s.selectedBinding);
});
const actualTravel=await requireCheckpointHeroCrossing(await stoppedFileSource(s.captured.filename),s.selectedBinding,s.crossing);
assert.deepEqual(actualTravel,s.travel);assert.equal(actualTravel.savedActorPositionVerified,true);
const journal=await heroCapturedJournalView(m,s);
assert.deepEqual((await readdir(journal)).sort(),Object.keys(s.journalSha256).sort());
for(const[n,h]of Object.entries(s.journalSha256))assert.equal(await hash(join(journal,n)),h);
assert.equal(await readFile(join(journal,HERO_ROUTE_HEAD),'utf8'),s.ownerManifest);
const changes=(await readdir(journal)).filter(n=>s.journalSha256[n]!==p.journalSha256[n]).sort();
assert.deepEqual(changes,['Frontier_Hero_Route.checkpoint','Frontier_Hero_Route_1_0_1.GMP','Frontier_Hero_Route_Node_3.json']);
for(const[n,h]of Object.entries(p.journalSha256))if(n!==HERO_ROUTE_HEAD)assert.equal(s.journalSha256[n],h);
const node=await json(join(journal,'Frontier_Hero_Route_Node_3.json')),oldHead=JSON.parse(s.expectedManifest),newHead=JSON.parse(s.ownerManifest);
assert.deepEqual(node.previous,oldHead);assert.equal(node.kind,'save');assert.equal(node.ownerRegion,s.held.region);assert.equal(node.revision,3);assert.equal(node.changes.length,1);
assert.equal(newHead.revision,3);assert.equal(newHead.identitySha256,oldHead.identitySha256);assert.equal(newHead.nodeSha256,await hash(join(journal,'Frontier_Hero_Route_Node_3.json')));
const expectedEntry={...oldEntry,slot:1,world:{size:s.captured.bytes,sha256:s.captured.sha256}};assert.deepEqual(node.changes[0],expectedEntry);
const stats={},io=await stoppedHeroRouteStorage(journal,stats),store=new HeroRouteStore(io,p.identity,p.identity.contentDigest);
const opened=[],realOpen=io.open;io.open=async n=>{opened.push(n);return realOpen(n);};let escaped;
await store.withOwner(async v=>{
 assert.equal(v.record.manifest,s.ownerManifest);assert.equal(v.record.revision,3);assert.deepEqual(v.entry,expectedEntry);
 assert.deepEqual(v.owner,s.owner);assert.equal(v.owner.entityId,p.identity.entityId);assert.equal(v.owner.region,'1_0');
 assert.equal(await checkpointSavedClock(v.source),s.held.clock);escaped=v.source;
});await assert.rejects(escaped.readAt(0,16),/lease ended/);
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_1_0_1.GMP']);
assert.equal(await hash(join(journal,'Frontier_Hero_Route_1_0_1.GMP')),s.captured.sha256);
const log=await readFile(m.log,'utf8');assert.ok(!/Hero save (?:released|resumed|abandoned) serial=2/.test(log));
let firstAck=join(m.fixture,'frontier_1_0/Frontier_Hero_Travel_Published.txt');
if(m.importRepeatNeighbor){await bound(m.repeatNeighborPageInput);const staged=await json(m.repeatNeighborPageInput.filename);
 assert.equal(staged.nativePid,m.nativePid);assert.equal(staged.fixture,m.fixture);
 assert.equal(staged.firstAcknowledgement.filename,join(m.fixture,'frontier_1_0/Hero_Travel_First_Published.txt'));
 await bound(staged.firstAcknowledgement);firstAck=staged.firstAcknowledgement.filename;
}
assert.equal(await readFile(firstAck,'utf8'),p.publicationReceipt.acknowledgement);
assert.ok(m.resourceSamples.length&&m.resourceSamples.every(v=>v.rssBytes<=m.rssCeilingBytes));
const sourceSha256={...q.sourceSha256},pending=[resolve('scripts/inspect-native-hero-second-publication.mjs')],seen=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(seen.has(name))continue;seen.add(name);assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&seen.size<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);const h=await hash(n);if(sourceSha256[name])assert.equal(sourceSha256[name],h);sourceSha256[name]=h;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,capturedJournalIsHistorical:m.publishHome===true,nativeConnectedSecondHeroCapturePublicationQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 resumeQualification:{filename:resolve(resumeName),sha256:await hash(resumeName)},firstPublication:m.publication,secondPublication:m.secondPublication,
 sourceSha256,crossing:s.crossing,captured:s.captured,nativeMarker:s.marker,journal,ownerManifest:s.ownerManifest,ownerRevision:3,owner:s.owner,homeAlias:s.homeAlias,
 unchangedPriorJournalFiles:Object.keys(p.journalSha256).length-1,changedJournalFiles:changes,zeroWriteControls:5,exactRetryWrites:0,
 currentOwnerOnlyExport:true,ownerReaderRevoked:true,secondCapturePublished:true,secondSourceRetired:false,secondDestinationLoaded:false,
 sourceProfilesPreserved:true,nativeSessionTerminal:true,ownedProducerAbsent:true,publicationWorkerTerminal:true,publicationWorkerAbsent:true,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeAndPublisherRssBytes:Math.max(...m.resourceSamples.map(v=>v.rssBytes)),
 browserUsed:false,realOPFSDurabilityQualified:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeConnectedSecondHeroCapturePublicationQualified:true,ownerRevision:3,clock:s.held.clock,zeroWriteControls:5,changedJournalFiles:changes.length}));
