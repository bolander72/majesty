#!/usr/bin/env node
// Verify journal-selected original reload without re-import or queue repair.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentQueues,checkpointActorRecords} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
const[manifestName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outputName,/^output\/native-halo-return-owner-\d{3}-observed\.json$/);await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const m=await json(manifestName),p=await json(m.preparation);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
assert.equal(m.stopReason,null);assert.equal(m.selectedHaloReturnOwnerTrialCompleted,true);assert.equal(m.browserUsed,false);
assert.equal(m.ownerPublished,false);assert.equal(m.nativeProcessesStarted,1);
try{process.kill(m.nativePid,0);throw Error('Owner producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.journalBefore,p.journalSha256);
for(const k of ['sourceCheckpointUnchanged','reloadIdsUnchanged','layoutMetadataUnchanged','privateNativeExecutableUnchanged'])assert.equal(m[k],true);
assert.equal(p.selected.record.revision,3);assert.equal(p.selected.record.manifest,p.ownerManifest);
assert.deepEqual(p.selected.owner,{entityId:p.identity.entityId,region:'0_0',unitId:496,agentId:22});
assert.equal(p.dormantWorldsOpened,0);assert.equal(p.ownerReaderRevoked,true);assert.equal(p.stats.peakReads,1);assert.ok(p.stats.largestRead<=4096);
assert.deepEqual(m.compiledSourceSha256,p.compiledSourceSha256);assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],[m.privateNativeExecutable,m.nativeExecutableSha256],
 [m.log,m.logSha256],[m.script,m.scriptSha256],['scripts/run-native-halo-return-owner.py',m.runnerSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],
 ['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
for(const r of [p.publicationArchive,p.publicationProof,p.build,p.world,p.reloadIds])assert.equal(await hash(r.filename),r.sha256);
const build=await json(m.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(build.nativeSymbolsSha256,m.nativeSymbolsSha256);
const archive=await json(p.publicationArchive.filename);assert.equal(archive.stoppedOriginalHaloReturnPublished,true);assert.equal(archive.selectedRevision,3);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.ownerManifest);
assert.equal(m.sourceCheckpoint.sha256,p.world.sha256);assert.equal(p.selected.entry.world.sha256,p.world.sha256);
assert.ok((await lstat(m.log)).size<4*1024*1024);const log=await readFile(m.log,'utf8');
assert.ok(!/result=fail|abort from/.test(log));assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.ok(log.includes('Halo return owner ready hero=496 agent=22 clock=63650 selected=1 original-load=1 imported=0 expired-effects-restored=0 queue-added=0 commands-repaired=0 model-postload-repeated=0 ready-saved=1 owner-published=0 result=pass'));
const matches=[...log.matchAll(/Halo return owner evolved hero=496 agent=22 clock=(\d+) ai=(\d+) contexts=(\d+) other-ai=(\d+) commands=(\d+) changed=(\d+) initial=(-?\d+),(-?\d+),(-?\d+) accepted=(-?\d+),(-?\d+),(-?\d+) parent=(\d+) footprint=(\d+) drawing=(\d+) native-home=469\/7 queued=1 expired-effects-restored=0 evolved-saved=1 original-pause=1 hooks-removed=1 owner-published=0 result=pass/g)];
assert.equal(matches.length,1);const v=matches[0].slice(1).map(Number);assert.equal(v[0],64150);
for(const i of [1,2,4,5])assert.ok(v[i]>0&&v[i]<=4096);assert.ok(v[3]>0&&v[3]<=65536);
assert.notDeepEqual(v.slice(6,9),v.slice(9,12));assert.ok([0,469].includes(v[12]));assert.equal(v[13],v[12]?0:4);
assert.ok(v[14]<=1);if(!v[12])assert.equal(v[14],1);
assert.equal(m.worlds.length,3);for(const[i,r]of m.worlds.entries())assert.equal(basename(r.filename),['Halo_Return_Owner_Loaded.GMP','Halo_Return_Owner_Ready.GMP','Halo_Return_Owner_Evolved.GMP'][i]);
const worldRows=[m.sourceCheckpoint,m.loadedCheckpoint,...m.worlds],worlds=[];
for(const[i,r]of worldRows.entries()){assert.ok(r);assert.equal(await hash(r.filename),r.sha256);assert.equal((await lstat(r.filename)).size,r.bytes);
 const w=await stoppedFileSource(r.filename);assert.equal(await checkpointSavedClock(w),i===4?64150:63650);worlds.push(w);}
async function records(w){const map=new Map();const add=(k,r)=>{assert.ok(!map.has(k)&&map.size<4096);map.set(k,r);};
 for await(const r of checkpointUnits(w))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(w))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(w))add(r.kind+':'+r.unitId,r);return map;}
const maps=[];for(const w of worlds)maps.push(await records(w));assert.ok(maps[0].size>400&&maps[0].size<1024);let exactRecordComparisons=0;
for(const i of [1,2,3]){assert.deepEqual([...maps[i].keys()].sort(),[...maps[0].keys()].sort());
 for(const[k,r]of maps[0]){const t=maps[i].get(k);assert.equal(t.size,r.size,k);
  for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await worlds[i].readAt(t.offset+at,n),await worlds[0].readAt(r.offset+at,n),k);}
  exactRecordComparisons++;}}
async function queues(w){const rows=[];for await(const r of checkpointAgentQueues(w))rows.push(r.type==='queued-agent'?{type:r.type,queue:r.queue,agentId:r.agentId}:{type:r.type,activeQueue:r.activeQueue});return rows;}
const initial=await queues(worlds[0]);assert.equal(initial.filter(q=>q.agentId===22).length,1);
for(const i of [1,2,3])assert.deepEqual(await queues(worlds[i]),initial);
for(const[i,w]of worlds.entries()){
 for(const k of maps[i].keys())assert.ok(!['UNIT:481','GPL:17','UNIT:497','CONT:497','ORDR:497','UNIT:498','CONT:498','ORDR:498'].includes(k));
 for await(const u of checkpointUnits(w))assert.ok(![497,498].includes(u.primary.words[6]));
 await verifyRegisteredHeroSnapshot(p.identity,p.selected.entry.alias,p.selected.entry.homeAlias,w,true,'0_0');
 await verifyEntitySnapshot(p.identity,p.selected.entry.alias,w,true,p.selected.entry.homeAlias);
 const actor=await checkpointActorRecords(w,496);assert.equal(actor.agent.agentId,22);assert.equal(actor.unit.parentUnitId,i===4?v[12]:0);
 const entries=[];for await(const e of checkpointActorOrderEntries(w,496))if(e.type==='entry')entries.push(e);
 assert.ok(entries.length);if(i<4)assert.deepEqual(entries.map(e=>e.kind),[2,4,7]);
 if(i===4){const bytes=await w.readAt(actor.unit.offset+60,12),view=new DataView(bytes.buffer,bytes.byteOffset,12);
  assert.deepEqual([0,4,8].map(at=>view.getInt32(at,true)),v.slice(9,12));
  assert.ok(entries.some(e=>{const stamp=e.words[e.parentVersion===undefined?5:6];return stamp>=63650&&stamp<=64150;}));}
}
assert.equal(m.frames.length,2);for(const r of m.frames){assert.equal(r.bytes,1440015);assert.equal(await hash(r.filename),r.sha256);}
assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
assert.ok(m.finishedAtMs-m.startedAtMs<37000&&m.resourceSamples.length);for(const r of m.resourceSamples)assert.ok(r.rssBytes<=m.rssCeilingBytes);
const sourceSha256={};for(const n of ['scripts/inspect-native-halo-return-owner.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
 'web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/saved-clock.mjs','web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,journalSelectedReturnedHomeReloadQualified:true,manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,
 publicationArchive:p.publicationArchive,identity:p.identity,selectedOwner:p.selected.owner,selectedManifest:p.ownerManifest,
 selectedRevision:3,startClock:63650,endClock:64150,exactLoadedRecords:maps[0].size,exactRecordComparisons,
 aiCalls:v[1],contextCalls:v[2],otherAiCalls:v[3],commandCalls:v[4],changedFrames:v[5],heroPoseBefore:v.slice(6,9),heroPoseAfter:v.slice(9,12),
 parentUnitId:v[12],footprint:v[13],drawingMembership:v[14],expiredEffectsRestored:false,actorImported:false,
 queueAdded:false,commandsRepaired:false,modelPostloadRepeated:false,loadedQueuesUnchanged:true,originalAiAndCommandsContinued:true,
 originalGuildMembershipPreserved:true,dormantWorldsOpened:0,ownerReaderRevoked:true,
 wholeWorlds:worldRows,evolvedWorld:m.worlds[2],sourceAndJournalUnchanged:true,servedArtifactsUnchanged:true,
 nativeSessionTerminal:true,nativeExitCode:0,elapsedMs:m.finishedAtMs-m.startedAtMs,
 peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),maximumReadBytes:4096,
 ownerPublished:false,seamlessLiveTravelQualified:false,automaticReturnCrossingQualified:false,browserUsed:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({journalSelectedReturnedHomeReloadQualified:true,exactLoadedRecords:maps[0].size,exactRecordComparisons,evolvedClock:64150,expiredEffectsRestored:false}));
