#!/usr/bin/env node
// Independently verify second original disposal and exact saved-home loading
// before any home simulation tick, preserving the published hero recovery.
import assert from 'node:assert/strict';
import {heroCapturedJournalView} from './lib/hero-captured-journal-view.mjs';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointNextAgentId,checkpointChunks} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {requireCheckpointHaloLayout} from '../web/world/halo-checkpoint-layout.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';

const [manifestName,retirementName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-home-paging-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
async function bound(r){assert.equal((await lstat(r.filename)).size,r.bytes);assert.equal(await hash(r.filename),r.sha256);}
const m=await json(manifestName),r=await json(retirementName);
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.pageHome,true);assert.equal(m.nativeSelectedHeroHomePagingBoundaryObserved,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
assert.equal(m.publicationWorkerTerminal,true);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.publicationWorkerAbsent,true);
assert.equal(m.nativeProcessesStarted,1);assert.equal(m.browserUsed,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
assert.equal(r.nativeConnectedRemoteHeroRetirementQualified,true);assert.equal(r.manifest.filename,resolve(manifestName));assert.equal(r.manifest.sha256,await hash(manifestName));
for(const[n,h]of Object.entries(r.sourceSha256))assert.equal(await hash(n),h);
for(const row of [m.homePageInput,m.homePageSnapshot,m.homePagingRefusedSnapshot,m.sourceInputBackup,m.heldSave.marker,m.publication,m.secondPublication])await bound(row);
const p=await json(m.publication.filename),second=await json(m.secondPublication.filename),h=await json(m.homePageInput.filename);
assert.equal(h.selectedHeroHomeStaged,true);assert.equal(h.nativePid,m.nativePid);assert.equal(h.fixture,m.fixture);
assert.equal(h.journal,m.publicationJournal);assert.equal(h.ownerManifest,second.ownerManifest);assert.equal(h.homeEntry.region,'0_0');
assert.deepEqual(h.homeEntry.alias,{unitId:508,agentId:25});assert.deepEqual(h.homeEntry.homeAlias,{kind:'native',unitId:469,agentId:7});
assert.equal(h.homeEntry.world.sha256,p.retired.sha256);assert.equal(h.homeEntry.world.size,p.retired.bytes);
assert.equal(h.homeClock,m.homeClock);assert.equal(h.homeClock,103500);assert.equal(h.journalUnchanged,true);
assert.equal(h.heroImported,false);assert.equal(h.ownerTransferred,false);assert.equal(h.destinationReaderRevoked,true);
assert.ok(h.stats.largestRead<=4096&&h.stats.peakReads===1&&h.stats.activeReads===0);assert.equal(h.stats.writes??0,0);
for(const row of [h.homeSource,h.nativeSlot,h.nativeMarker,h.capturedSourceMarker,p.retired])await bound(row);
assert.equal(h.homeSource.sha256,p.retired.sha256);assert.equal(h.nativeSlot.sha256,p.retired.sha256);
assert.equal(h.capturedSourceMarker.filename,m.heldSave.marker.filename);assert.equal(h.capturedSourceMarker.sha256,m.heldSave.marker.sha256);
assert.equal(await readFile(h.capturedSourceMarker.filename,'utf8'),m.heldSave.nativeManifest);
assert.equal(m.sourceInputBackup.sha256,m.sourceCheckpoint.sha256);assert.equal(m.sourceInputBackup.bytes,m.sourceCheckpoint.bytes);
assert.equal(h.nativeManifest,['checkpoint-v1','0',p.retired.bytes,p.retired.sha256,
 '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
assert.equal(await readFile(h.nativeMarker.filename,'utf8'),h.nativeManifest);
assert.equal(h.request,`majesty-hero-home-ready-v1|2|0_0|${h.homeClock}|${p.retired.bytes}|${p.retired.sha256}\n`);
assert.equal(await readFile(join(m.fixture,'frontier_1_0/Frontier_Hero_Home_Ready.txt'),'utf8'),h.request);
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from|GplException/.test(log));
const released=[...log.matchAll(/^\[frontier\] Session released serial=2 region=1_0 roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288 heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) clock=0$/gm)];
const ended=[...log.matchAll(/^\[frontier\] Session release observer removed serial=2 hooks=\d+ retained-roots=0$/gm)];
const attached=[...log.matchAll(/^\[frontier\] Session attached serial=2 region=0_0 mode=saved phase=1 pending=2$/gm)];
const held=[...log.matchAll(/^\[frontier\] Hero travel target held serial=2 region=0_0 clock=103500 original-load=1 ordinary-ticks=0 source-roots-cleared=1 phase=7 pending=0 owner-published=0 result=pass$/gm)];
assert.equal(released.length,1);assert.equal(ended.length,1);assert.equal(attached.length,1);assert.equal(held.length,1);
assert.ok(released[0].index<ended[0].index&&ended[0].index<attached[0].index&&attached[0].index<held[0].index);
assert.ok(log.indexOf('[frontier] Hero remote source retirement completed serial=2 ')<released[0].index);
assert.ok(log.includes(`Hero home paging admitted serial=2 region=0_0 clock=${h.homeClock} bytes=${p.retired.bytes} sha256=${p.retired.sha256} reused-exit-hook=1 wrong-digest-refused=1 wrong-clock-refused=1 recovery-preserved=1 result=pass`));
assert.equal(log.split('Hero travel saved metadata reset original-destructor=00436680 original-constructor=004365f0 retained-names=0 world-null=1 result=pass').length-1,m.pageRepeatHome?4:m.pageRepeatNeighbor?3:2);
const memory=released[0].slice(1).map(Number);assert.ok(memory[0]>memory[1]&&memory[2]>memory[3]);
const retiredState=await connectedWorldState(r.retiredWorld.filename,{unscheduledAgents:[34,38]}),refusedState=await connectedWorldState(m.homePagingRefusedSnapshot.filename,{unscheduledAgents:[34,38]});
assert.deepEqual(retiredState.roots,refusedState.roots);compareConnectedWorlds(retiredState,refusedState);
const inputState=await connectedWorldState(h.homeSource.filename),heldState=await connectedWorldState(m.homePageSnapshot.filename);
const comparison=compareConnectedWorlds(inputState,heldState);assert.equal(heldState.clock,h.homeClock);assert.equal(inputState.clock,h.homeClock);
assert.equal(heldState.counts.units,inputState.counts.units);
// Original loading can change the ORDR container's record order. Permit only
// that framing difference; verify its header, complete contiguous coverage and
// every keyed record byte below. Other normalized root hashes stay exact.
const rootFraming=roots=>roots.map(v=>v.tag==='ORDR'?{...v,sha256:null}:v);
assert.deepEqual(rootFraming(heldState.roots),rootFraming(inputState.roots));
const input=await stoppedFileSource(h.homeSource.filename),home=await stoppedFileSource(m.homePageSnapshot.filename),refused=await stoppedFileSource(m.homePagingRefusedSnapshot.filename),retired=await stoppedFileSource(r.retiredWorld.filename);
async function orderRoot(s){let root;
 for await(const v of checkpointChunks(s))if(v.tag==='ORDR'){assert.equal(root,undefined);root=v;}
 assert.ok(root);const ids=[];let at=root.offset+16;
 for await(const v of checkpointAttachments(s))if(v.kind==='ORDR'){
  assert.equal(v.offset,at,'ORDR records must cover the complete payload without gaps');
  ids.push(v.unitId);at+=v.size;
 }
 assert.equal(ids.length,root.count);assert.equal(at,root.end);
 return {root,ids,header:await s.readAt(root.offset,16)};
}
const inputOrders=await orderRoot(input),homeOrders=await orderRoot(home);
assert.deepEqual(homeOrders.header,inputOrders.header);
assert.deepEqual([...homeOrders.ids].sort((a,b)=>a-b),[...inputOrders.ids].sort((a,b)=>a-b));
assert.equal(await checkpointSavedClock(home),h.homeClock);assert.equal(await checkpointNextAgentId(input),await checkpointNextAgentId(home));
await verifyRegisteredHeroSnapshot(p.identity,h.homeEntry.alias,h.homeEntry.homeAlias,home,false,'0_0');
const layout=await requireCheckpointHaloLayout(home,'0_0','halo-v1');assert.equal(layout.verifiedVertices,16641);
async function records(s){const result=new Map();const add=(key,v)=>{assert.ok(result.size<4096&&!result.has(key));result.set(key,v);};
 for await(const v of checkpointUnits(s))add('UNIT:'+v.primary.words[1],v);
 for await(const v of checkpointAgents(s))add('GPL:'+v.agentId,v);
 for await(const v of checkpointAttachments(s))add(v.kind+':'+v.unitId,v);return result;}
let exactRecordComparisons=0;
for(const[a,b]of [[retired,refused],[input,home]]){const old=await records(a),now=await records(b);assert.deepEqual([...old.keys()].sort(),[...now.keys()].sort());
 for(const[key,v]of old){const w=now.get(key);assert.equal(w.size,v.size,key);for(let at=0;at<v.size;at+=4096){const n=Math.min(4096,v.size-at);
   assert.deepEqual(await b.readAt(w.offset+at,n),await a.readAt(v.offset+at,n),key+' byte '+at);}exactRecordComparisons++;}}
const capturedJournal=await heroCapturedJournalView(m,second);
assert.deepEqual((await readdir(capturedJournal)).sort(),Object.keys(second.journalSha256).sort());
for(const[n,digest]of Object.entries(second.journalSha256))assert.equal(await hash(join(capturedJournal,n)),digest);
assert.equal(await hash(second.captured.filename),second.captured.sha256);assert.equal(await hash(second.marker.filename),second.marker.sha256);
assert.ok(m.resourceSamples.length&&m.resourceSamples.every(v=>v.rssBytes<=m.rssCeilingBytes));
const sourceSha256={...r.sourceSha256},pending=[resolve('scripts/inspect-native-hero-home-paging.mjs')],seen=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(seen.has(name))continue;seen.add(name);assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&seen.size<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);const digest=await hash(n);if(sourceSha256[name])assert.equal(sourceSha256[name],digest);sourceSha256[name]=digest;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,capturedJournalIsHistorical:m.publishHome===true,nativeConnectedHeroHomePagingQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 retirementQualification:{filename:resolve(retirementName),sha256:await hash(retirementName)},sourceSha256,stagedHome:h.homeSource,heldHome:m.homePageSnapshot,
 homeClock:h.homeClock,registeredHome:h.homeEntry.homeAlias,originalHomeGameplayPreserved:true,homePausedBeforeFirstTick:true,
 exactRecordComparisons,orderRootCompleteRecordPermutationQualified:true,
 orderRootRecordOrderBefore:inputOrders.ids,orderRootRecordOrderAfter:homeOrders.ids,
 loadedHomeActorCount:heldState.counts.units,secondSourceRootsFreed:8,secondSourceRootsClearedBeforeHomeLoad:true,
 secondSourceReleasedHeapBytes:memory[0]-memory[1],secondSourceReleasedHeapBlocks:memory[2]-memory[3],releasedTerrainBytes:530456,releasedSpatialBytes:524288,
 reusedExitHook:true,metadataOwnershipResetQualified:true,wrongDigestClockPreserveRetiredSource:true,sourceInputBackupPreserved:true,capturedSourceMarkerPreserved:true,
 capturedRecoveryPreserved:true,selectedJournalRevision:3,journalUnchanged:true,...comparison,
 heroImported:false,homeActivated:false,returnOwnerTransferred:false,retiredPairPublished:false,browserUsed:false,realOPFSDurabilityQualified:false,
 nativeSessionTerminal:true,ownedProducerAbsent:true,publicationWorkerTerminal:true,publicationWorkerAbsent:true,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeAndPublisherRssBytes:Math.max(...m.resourceSamples.map(v=>v.rssBytes)),goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeConnectedHeroHomePagingQualified:true,homeClock:h.homeClock,exactRecordComparisons,secondSourceRootsFreed:8,heroImported:false}));
