#!/usr/bin/env node
// Independently check the returned family's original live continuation.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,basename,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentQueues,
  checkpointAgentValues,checkpointContainerEntries,checkpointActorRecords} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const[manifestName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outputName,/^output\/native-halo-return-live-\d{3}-observed\.json$/);
await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const m=await json(manifestName),p=await json(m.preparation);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
assert.equal(m.stopReason,null);assert.equal(m.selectedHaloReturnLiveTrialCompleted,true);assert.equal(m.browserUsed,false);
assert.equal(m.sourceRetired,false);assert.equal(m.ownerPublished,false);assert.equal(m.nativeProcessesStarted,1);
try{process.kill(m.nativePid,0);throw Error('Native producer is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.deepEqual(m.journalBefore,m.journalAfter);
assert.deepEqual(m.journalBefore,p.journalSha256);assert.equal(m.sourceCheckpointUnchanged,true);
assert.equal(m.reloadIdsUnchanged,true);assert.equal(m.layoutMetadataUnchanged,true);assert.equal(m.privateNativeExecutableUnchanged,true);
assert.deepEqual(m.compiledSourceSha256,p.compiledSourceSha256);assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],
 [m.privateNativeExecutable,m.nativeExecutableSha256],[m.log,m.logSha256],
 ['scripts/run-native-halo-return-live.py',m.runnerSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],
 ['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
const build=await json(m.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(build.nativeSymbolsSha256,m.nativeSymbolsSha256);
for(const r of [p.coldArchive,p.coldProof,p.build])assert.equal(await hash(r.filename),r.sha256);
const archive=await json(p.coldArchive.filename);assert.equal(archive.generation,249);assert.equal(archive.nativeHaloReturnImportQualified,true);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
const cold=await json(p.coldProof.filename);assert.equal(cold.originalCleanupQualified,true);
assert.deepEqual(cold.actualNativeUnitIds,[496,497,498]);assert.equal(cold.actualAgentId,22);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.ownerManifest);
assert.equal(m.sourceCheckpoint.sha256,p.world.sha256);assert.equal(m.reloadIds.sha256,p.reloadIds.sha256);
assert.ok((await lstat(m.log)).size<4*1024*1024);const log=await readFile(m.log,'utf8');
assert.ok(!/result=fail|abort from/.test(log));assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.ok(log.includes('Halo return live command before id=496 valid=1 matches=0'));
assert.ok(log.includes('Halo return live command after id=496 valid=1 matches=0'));
assert.ok(log.includes('model-postload-repeated=0 records-rewritten=0 ready-saved=1 owner-published=0 result=pass'));
const rows=[...log.matchAll(/Halo return live evolved hero=496 agent=22 clock=(\d+) ai=(\d+) contexts=(\d+) other-ai=(\d+) commands=(\d+),(\d+),(\d+) changed=(\d+) retired=(\d+),(\d+) initial=(-?\d+),(-?\d+),(-?\d+) accepted=(-?\d+),(-?\d+),(-?\d+) footprint=4 drawing=1 native-home=469\/7 queued=1 evolved-saved=1 original-pause=1 hooks-removed=1 source-retired=0 owner-published=0 result=pass/g)];
assert.equal(rows.length,1);const v=rows[0].slice(1).map(Number);assert.equal(v[0],63650);
for(const i of [1,2,4,5,6,7])assert.ok(v[i]>0&&v[i]<=4096);assert.ok(v[3]>0&&v[3]<=65536);
assert.notDeepEqual(v.slice(10,13),v.slice(13,16));
assert.equal(v[8],62950);assert.ok(v[9]>60650&&v[9]<63650);
for(const[id,clock,calls]of [[497,v[8],v[5]],[498,v[9],v[6]]])
 assert.ok(log.includes(`Halo return live effect retired id=${id} clock=${clock} original-commands=${calls} result=pass`));
assert.equal(m.worlds.length,3);const worlds=[],worldRows=[m.sourceCheckpoint,m.loadedCheckpoint,...m.worlds];
for(const r of worldRows){assert.ok(r);assert.equal(await hash(r.filename),r.sha256);assert.equal((await lstat(r.filename)).size,r.bytes);
 worlds.push(await stoppedFileSource(r.filename));}
for(const[i,r]of m.worlds.entries())assert.equal(basename(r.filename),['Halo_Return_Live_Loaded.GMP','Halo_Return_Live_Ready.GMP','Halo_Return_Live_Evolved.GMP'][i]);
for(const[i,w]of worlds.entries())assert.equal(await checkpointSavedClock(w),i===4?63650:60650);
async function records(w){const map=new Map();const add=(k,r)=>{assert.ok(!map.has(k)&&map.size<4096);map.set(k,r);};
 for await(const r of checkpointUnits(w))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(w))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(w))add(r.kind+':'+r.unitId,r);return map;}
const maps=[];for(const w of worlds)maps.push(await records(w));assert.equal(maps[0].size,494);
let exactRecordComparisons=0;
for(let i=1;i<=3;++i){assert.deepEqual([...maps[i].keys()].sort(),[...maps[0].keys()].sort());
 for(const[k,r]of maps[0]){const t=maps[i].get(k);assert.equal(t.size,r.size,k);
  for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);
   assert.deepEqual(await worlds[i].readAt(t.offset+at,n),await worlds[0].readAt(r.offset+at,n),k);}
  exactRecordComparisons++;}}
async function queues(w){const rows=[];for await(const r of checkpointAgentQueues(w))rows.push(r.type==='queued-agent'?{type:r.type,queue:r.queue,agentId:r.agentId}:{type:r.type,activeQueue:r.activeQueue});return rows;}
const initialQueues=await queues(worlds[0]);assert.equal(initialQueues.filter(q=>q.agentId===22).length,0);
for(const i of [1,2])assert.deepEqual(await queues(worlds[i]),initialQueues);
const readyQueues=await queues(worlds[3]),own=readyQueues.filter(q=>q.agentId===22);assert.equal(own.length,1);assert.equal(own[0].queue,1);
assert.deepEqual(readyQueues.filter(q=>q.agentId!==22),initialQueues);
assert.equal((await queues(worlds[4])).filter(q=>q.agentId===22).length,1);
for(const[i,w]of worlds.entries()){
 const relationships=[];for await(const c of checkpointContainerEntries(w))if(c.type==='member')relationships.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
 for(const row of [[469,100,496,1],[496,101,469,1]])assert.ok(relationships.some(r=>JSON.stringify(r)===JSON.stringify(row)));
 const childRows=relationships.filter(r=>r[0]===496&&r[1]===1);
 assert.deepEqual(childRows,i===4?[]:[[496,1,497,1],[496,1,498,1]]);
 const members=[];for await(const r of checkpointAgentValues(w,7))if(r.attribute==='members')members.push(r);
 assert.equal(members.length,2);assert.equal(members.find(r=>!r.path.length).childCount,1);
 assert.equal(members.find(r=>r.path.length).targetAgentId,22);
 assert.ok(!maps[i].has('UNIT:481'));assert.ok(!maps[i].has('GPL:17'));
 for(const id of [497,498])if(i===4){
  for(const k of maps[i].keys())assert.ok(!['UNIT:'+id,'CONT:'+id,'ORDR:'+id].includes(k));
  for(const r of relationships)assert.ok(r[0]!==id&&r[2]!==id);
  for await(const u of checkpointUnits(w))assert.notEqual(u.primary.words[6],id);
 }
 const hero=await checkpointActorRecords(w,496);assert.equal(hero.agent.agentId,22);assert.equal(hero.unit.parentUnitId,0);
 const entries=[];for await(const e of checkpointActorOrderEntries(w,496))if(e.type==='entry')entries.push(e);
 if(i<4)assert.equal(entries.length,0);else{
  assert.ok(entries.length>0);for(const e of entries){const stamp=e.words[e.parentVersion===undefined?5:6];assert.ok(stamp>=60650&&stamp<=63650);}
  const bytes=await w.readAt(hero.unit.offset+60,12),view=new DataView(bytes.buffer,bytes.byteOffset,12);
  assert.deepEqual([0,4,8].map(at=>view.getInt32(at,true)),v.slice(13,16));
 }
}
const effectEntries=[];for await(const e of checkpointActorOrderEntries(worlds[3],497))if(e.type==='entry')effectEntries.push(e);
assert.equal(effectEntries.length,1);assert.equal(effectEntries[0].kind,9);
assert.equal((effectEntries[0].words[5]+effectEntries[0].words[6])>>>0,v[8]);
assert.equal(m.frames.length,2);for(const r of m.frames){assert.equal(r.bytes,1440015);assert.equal(await hash(r.filename),r.sha256);}
assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
assert.ok(m.finishedAtMs-m.startedAtMs<37000&&m.resourceSamples.length);for(const r of m.resourceSamples)assert.ok(r.rssBytes<=m.rssCeilingBytes);
const sourceSha256={};for(const n of ['scripts/inspect-native-halo-return-live.mjs','scripts/lib/stopped-entity-io.mjs',
 'scripts/lib/native-generation.mjs','web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/saved-clock.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeReturnedHeroContinuationQualified:true,manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,
 coldArchive:p.coldArchive,startClock:60650,endClock:63650,exactLoadedRecords:494,exactRecordComparisons,
 actualNativeUnitIds:[496,497,498],actualAgentId:22,aiCalls:v[1],contextCalls:v[2],otherAiCalls:v[3],commandCalls:v.slice(4,7),
 changedFrames:v[7],effectRetirementClocks:v.slice(8,10),waitDeadlinePreserved:true,heroPoseBefore:v.slice(10,13),heroPoseAfter:v.slice(13,16),
 emptyHeroOrdersPreserved:true,originalAiCreatedHeroOrders:true,originalGuildMembershipPreserved:true,
 originalQueueInsertion:true,unrelatedQueuesPreservedAtReady:true,expiredEffectsAbsent:true,modelPostloadRepeated:false,
 wholeWorlds:worldRows,nativeSessionTerminal:true,nativeExitCode:0,elapsedMs:m.finishedAtMs-m.startedAtMs,
 peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),maximumReadBytes:4096,
 sourceAndJournalUnchanged:true,servedArtifactsUnchanged:true,sourceRetired:false,ownerPublished:false,
 seamlessLiveTravelQualified:false,automaticReturnCrossingQualified:false,browserUsed:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeReturnedHeroContinuationQualified:true,exactLoadedRecords:494,exactRecordComparisons,waitDeadlinePreserved:true,effectRetirementClocks:v.slice(8,10)}));
