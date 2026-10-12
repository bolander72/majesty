#!/usr/bin/env node
// Verify the fourth original unload/load using the current retired source and
// the journal's actual saved home; neither a new owner nor browser proof.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {heroRepeatedReturnJournalView} from './lib/hero-captured-journal-view.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointChunks,checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';

const [manifestName,returnName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-repeat-home-paging-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function bound(v){assert.equal((await lstat(v.filename)).size,v.bytes);assert.equal(await hash(v.filename),v.sha256);}
const m=await json(manifestName),q=await json(returnName);
assert.equal(q.nativeConnectedRepeatedHeroReturnQualified,true);assert.equal(q.manifest.filename,resolve(manifestName));assert.equal(q.manifest.sha256,await hash(manifestName));
for(const[n,h]of Object.entries(q.sourceSha256))assert.equal(await hash(n),h);
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.pageRepeatHome,true);assert.equal(m.nativeSelectedHeroRepeatHomePagingBoundaryObserved,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
assert.equal(m.publicationWorkerTerminal,true);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.publicationWorkerAbsent,true);
assert.equal(m.nativeProcessesStarted,1);assert.equal(m.browserUsed,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
for(const row of [m.repeatHomePageInput,m.repeatHomeHeld,m.repeatHomePagingRefused,m.repeatReturnPublication,m.publication,m.repeatNeighborPublication,q.retiredWorld])await bound(row);
const first=await json(m.publication.filename),home=await json(m.repeatNeighborPublication.filename),capture=await json(m.repeatReturnPublication.filename),staged=await json(m.repeatHomePageInput.filename);
assert.equal(staged.selectedHeroRepeatHomeStaged,true);assert.equal(staged.nativePid,m.nativePid);assert.equal(staged.fixture,m.fixture);
assert.equal(staged.journal,capture.journal);assert.equal(staged.ownerManifest,q.ownerManifest);
assert.equal(staged.targetEntry.region,'0_0');assert.deepEqual(staged.targetEntry.homeAlias,{kind:'native',unitId:469,agentId:7});
assert.equal(staged.targetEntry.world.sha256,home.retired.sha256);assert.equal(staged.targetEntry.world.size,home.retired.bytes);
assert.equal(staged.targetClock,104900);assert.equal(staged.journalUnchanged,true);assert.equal(staged.heroImported,false);assert.equal(staged.ownerTransferred,false);
assert.equal(staged.destinationReaderRevoked,true);assert.ok(staged.stats.largestRead<=4096&&staged.stats.peakReads===1&&staged.stats.activeReads===0);assert.equal(staged.stats.writes??0,0);
for(const row of [staged.target,staged.nativeSlot,staged.nativeMarker,home.retired,capture.captured,capture.marker])await bound(row);
assert.equal(staged.target.sha256,home.retired.sha256);assert.equal(staged.nativeSlot.sha256,home.retired.sha256);
assert.equal(staged.nativeManifest,['checkpoint-v1','1',home.retired.bytes,home.retired.sha256,
 '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
assert.equal(await readFile(staged.nativeMarker.filename,'utf8'),staged.nativeManifest);
assert.equal(staged.request,`majesty-hero-home-ready-v1|6|0_0|104900|${home.retired.bytes}|${home.retired.sha256}\n`);
assert.equal(await readFile(join(m.fixture,'frontier_1_0/Frontier_Hero_Repeat_Home_Ready.txt'),'utf8'),staged.request);
assert.equal(await readFile(capture.marker.filename,'utf8'),capture.nativeManifest);
const capturedJournal=await heroRepeatedReturnJournalView(m,capture);
assert.deepEqual((await readdir(capturedJournal)).sort(),Object.keys(capture.journalSha256).sort());
for(const[n,h]of Object.entries(capture.journalSha256))assert.equal(await hash(join(capturedJournal,n)),h);
assert.equal(await readFile(join(capturedJournal,HERO_ROUTE_HEAD),'utf8'),q.ownerManifest);
const stats={},io=await stoppedHeroRouteStorage(capturedJournal,stats),store=new HeroRouteStore(io,first.identity,first.identity.contentDigest);let escaped;
await store.withDestination('0_0',null,async v=>{
 assert.equal(v.record.manifest,q.ownerManifest);assert.equal(v.record.revision,9);assert.equal(v.owner.region,'1_0');
 assert.deepEqual(v.entries[0].alias,{unitId:q.removedUnitId,agentId:q.removedAgentId});assert.equal(await checkpointSavedClock(v.sources[0]),q.clock);
 assert.deepEqual(v.entries[1],staged.targetEntry);assert.equal(await checkpointSavedClock(v.sources[1]),staged.targetClock);escaped=v.sources[1];
});await assert.rejects(escaped.readAt(0,16),/lease ended/);assert.equal(stats.writes??0,0);
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from|GplException/.test(log));
const released=[...log.matchAll(/^\[frontier\] Session released serial=4 region=1_0 roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288 heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) clock=0$/gm)];
const ended=[...log.matchAll(/^\[frontier\] Session release observer removed serial=4 hooks=\d+ retained-roots=0$/gm)];
const attached=[...log.matchAll(/^\[frontier\] Session attached serial=4 region=0_0 mode=saved phase=1 pending=2$/gm)];
const held=[...log.matchAll(/^\[frontier\] Hero travel target held serial=4 region=0_0 clock=104900 original-load=1 ordinary-ticks=0 source-roots-cleared=1 phase=7 pending=0 owner-published=0 result=pass$/gm)];
for(const list of [released,ended,attached,held])assert.equal(list.length,1);
assert.ok(log.indexOf('[frontier] Hero remote source retirement completed serial=6 region=1_0 ')<released[0].index);
assert.ok(released[0].index<ended[0].index&&ended[0].index<attached[0].index&&attached[0].index<held[0].index);
assert.ok(log.includes(`Hero home paging admitted serial=6 region=0_0 clock=104900 bytes=${home.retired.bytes} sha256=${home.retired.sha256} reused-exit-hook=1 wrong-digest-refused=1 wrong-clock-refused=1 recovery-preserved=1 result=pass`));
if(!m.publishRepeatHome)assert.ok(!log.includes('Hero travel resumed serial=6 '));
const memory=released[0].slice(1).map(Number);assert.ok(memory[0]>memory[1]&&memory[2]>memory[3]);
const paths=[q.retiredWorld.filename,m.repeatHomePagingRefused.filename,staged.target.filename,m.repeatHomeHeld.filename];
const states=[];for(const [i,path]of paths.entries())states.push(await connectedWorldState(path,i<2?{unscheduledAgents:[34,38]}:{}));
assert.equal(states[0].clock,q.clock);assert.equal(states[1].clock,q.clock);assert.equal(states[2].clock,104900);assert.equal(states[3].clock,104900);
assert.deepEqual(states[0].roots,states[1].roots);compareConnectedWorlds(states[0],states[1]);
const comparison=compareConnectedWorlds(states[2],states[3]);
const framed=roots=>roots.map(v=>v.tag==='ORDR'?{...v,sha256:null}:v);assert.deepEqual(framed(states[2].roots),framed(states[3].roots));
const sources=[];for(const path of paths)sources.push(await stoppedFileSource(path));
async function records(s){const result=new Map(),add=(key,v)=>{assert.ok(!result.has(key)&&result.size<4096);result.set(key,v);};
 for await(const v of checkpointUnits(s))add('UNIT:'+v.primary.words[1],v);for await(const v of checkpointAgents(s))add('GPL:'+v.agentId,v);
 for await(const v of checkpointAttachments(s))add(v.kind+':'+v.unitId,v);return result;}
let exactRecordComparisons=0;
for(const [a,b]of [[sources[0],sources[1]],[sources[2],sources[3]]]){
 const old=await records(a),now=await records(b);assert.deepEqual([...old.keys()].sort(),[...now.keys()].sort());
 for(const[key,v]of old){const w=now.get(key);assert.equal(w.size,v.size,key);
  for(let at=0;at<v.size;at+=4096){const n=Math.min(4096,v.size-at);assert.deepEqual(await b.readAt(w.offset+at,n),await a.readAt(v.offset+at,n),key);}exactRecordComparisons++;}
}
async function orderRoot(s){let root;for await(const v of checkpointChunks(s))if(v.tag==='ORDR'){assert.equal(root,undefined);root=v;}assert.ok(root);
 const ids=[];let at=root.offset+16;for await(const v of checkpointAttachments(s))if(v.kind==='ORDR'){assert.equal(v.offset,at);ids.push(v.unitId);at+=v.size;}
 assert.equal(ids.length,root.count);assert.equal(at,root.end);return {ids,header:await s.readAt(root.offset,16)};}
const inputOrders=await orderRoot(sources[2]),loadedOrders=await orderRoot(sources[3]);assert.deepEqual(inputOrders.header,loadedOrders.header);
assert.deepEqual([...inputOrders.ids].sort((a,b)=>a-b),[...loadedOrders.ids].sort((a,b)=>a-b));
assert.equal(await checkpointNextAgentId(sources[2]),await checkpointNextAgentId(sources[3]));
await verifyRegisteredHeroSnapshot(first.identity,{unitId:q.removedUnitId,agentId:q.removedAgentId},q.registeredRemoteHome,sources[1],false,'1_0');
await verifyRegisteredHeroSnapshot(first.identity,staged.targetEntry.alias,staged.targetEntry.homeAlias,sources[3],false,'0_0');
const layout=await requireCheckpointHaloLayout(sources[3],'0_0','halo-v1');assert.equal(layout.verifiedVertices,16641);
const sourceSha256={...q.sourceSha256},pending=[resolve('scripts/inspect-native-hero-repeat-home-paging.mjs')],seen=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(seen.has(name))continue;seen.add(name);assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&seen.size<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);const digest=await hash(n);if(sourceSha256[name])assert.equal(sourceSha256[name],digest);sourceSha256[name]=digest;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,nativeConnectedRepeatedHeroHomePagingQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 returnQualification:{filename:resolve(returnName),sha256:await hash(returnName)},sourceSha256,currentRetiredSource:q.retiredWorld,loadedHome:m.repeatHomeHeld,
 stagedHome:staged.target,targetClock:104900,exactRecordComparisons,currentRetirementBound:true,fourthSourceRootsFreed:8,
 fourthSourceReleasedHeapBytes:memory[0]-memory[1],fourthSourceReleasedHeapBlocks:memory[2]-memory[3],releasedTerrainBytes:530456,releasedSpatialBytes:524288,
 savedHomeGameplayPreserved:true,homePausedBeforeFirstTick:true,orderRootCompleteRecordPermutationQualified:true,
 wrongDigestClockPreserveCurrentRetiredSource:true,destinationReaderRevoked:true,capturedRecoveryPreserved:true,selectedJournalRevision:9,journalUnchanged:true,...comparison,
 sourceUnloaded:true,nextArrivalImported:false,ownerTransferred:false,browserUsed:false,realOPFSDurabilityQualified:false,repeatedFullTripsQualified:false,
 nativeSessionTerminal:true,publicationWorkerTerminal:true,elapsedMs:m.finishedAtMs-m.startedAtMs,
 peakSampledNativeAndPublisherRssBytes:Math.max(...m.resourceSamples.map(v=>v.rssBytes)),goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeConnectedRepeatedHeroHomePagingQualified:true,targetClock:104900,exactRecordComparisons,fourthSourceRootsFreed:8,nextArrivalImported:false}));
