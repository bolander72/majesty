#!/usr/bin/env node
// Corroborate original retirement without changing selected custody.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,basename,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentQueues,
 checkpointContainerEntries,checkpointAbsentAgentReferences} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const[manifestName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outputName,/^output\/native-halo-return-source-\d{3}-observed\.json$/);await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const m=await json(manifestName),p=await json(m.preparation);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
assert.equal(m.stopReason,null);assert.equal(m.selectedHaloReturnSourceTrialCompleted,true);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
try{process.kill(m.nativePid,0);throw Error('Source producer is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(m.region,'0_-1');assert.equal(m.nativeProcessesStarted,1);assert.deepEqual(m.preservedBefore,m.preservedAfter);
assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.journalBefore,p.journalSha256);
for(const k of ['sourceCheckpointUnchanged','reloadIdsUnchanged','layoutMetadataUnchanged','privateNativeExecutableUnchanged'])assert.equal(m[k],true);
assert.deepEqual(m.compiledSourceSha256,p.compiledSourceSha256);assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],[m.privateNativeExecutable,m.nativeExecutableSha256],
 [m.log,m.logSha256],['scripts/run-native-halo-return-source.py',m.runnerSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],
 ['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
for(const r of [p.liveArchive,p.liveProof,p.build,p.world,p.reloadIds,p.qualifiedDestination])assert.equal(await hash(r.filename),r.sha256);
const build=await json(m.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(build.nativeSymbolsSha256,m.nativeSymbolsSha256);
const archive=await json(p.liveArchive.filename);assert.equal(archive.generation,252);assert.equal(archive.nativeReturnedHeroContinuationQualified,true);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.ownerManifest);
assert.equal(p.selected.record.manifest,p.ownerManifest);assert.equal(p.selected.record.revision,2);
assert.equal(p.selected.owner.region,'0_-1');assert.deepEqual(p.selected.entry.alias,{unitId:510,agentId:54});
assert.equal(m.sourceCheckpoint.sha256,p.world.sha256);assert.equal(p.selected.entry.world.sha256,p.world.sha256);
assert.ok((await lstat(m.log)).size<4*1024*1024);const log=await readFile(m.log,'utf8');
assert.ok(!/result=fail|abort from/.test(log));assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.equal([...log.matchAll(/Halo return source retired clock=1500 units=510,513,516 agent=54 retained-flag=511\/55 retained-home-proxy=53 aliases-absent=1 released-roster-preserved=1 other-registry-preserved=1 other-queues-preserved=1 original-removal=1 before-after-saved=1 original-pause=1 owner-published=0 result=pass/g)].length,1);
assert.equal(m.worlds.length,2);for(const[i,r]of m.worlds.entries())assert.equal(basename(r.filename),['Halo_Return_Source_Before.GMP','Halo_Return_Source_Retired.GMP'][i]);
const rows=[m.sourceCheckpoint,m.loadedCheckpoint,...m.worlds],worlds=[];
for(const r of rows){assert.ok(r);assert.equal(await hash(r.filename),r.sha256);assert.equal((await lstat(r.filename)).size,r.bytes);
 const w=await stoppedFileSource(r.filename);assert.equal(await checkpointSavedClock(w),1500);worlds.push(w);}
async function records(w){const map=new Map();const add=(k,r)=>{assert.ok(!map.has(k)&&map.size<4096);map.set(k,r);};
 for await(const r of checkpointUnits(w))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(w))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(w))add(r.kind+':'+r.unitId,r);return map;}
async function exact(a,ar,b,br,k){assert.ok(ar&&br,k);assert.equal(ar.size,br.size,k);
 for(let at=0;at<ar.size;at+=4096){const n=Math.min(4096,ar.size-at);assert.deepEqual(await a.readAt(ar.offset+at,n),await b.readAt(br.offset+at,n),k);}}
const maps=[];for(const w of worlds)maps.push(await records(w));let exactLoadedComparisons=0,unrelatedRecordComparisons=0;
for(const i of [1,2]){assert.deepEqual([...maps[i].keys()].sort(),[...maps[0].keys()].sort());
 for(const[k,r]of maps[0]){await exact(worlds[0],r,worlds[i],maps[i].get(k),k);exactLoadedComparisons++;}}
const removed=['UNIT:510','UNIT:513','UNIT:516','GPL:54','CONT:510','ORDR:513','ORDR:516'];
for(const k of removed){assert.ok(maps[0].has(k),k);assert.equal(maps[3].has(k),false,k);}
assert.deepEqual([...maps[3].keys()].sort(),[...maps[0].keys()].filter(k=>!removed.includes(k)).sort());
for(const[k,r]of maps[3]){await exact(worlds[0],maps[0].get(k),worlds[3],r,k);unrelatedRecordComparisons++;}
for(const k of ['UNIT:511','GPL:55','GPL:53','CONT:511','ORDR:511'])assert.ok(maps[3].has(k),k);
assert.equal((await checkpointAbsentAgentReferences(worlds[3],54)).sites.length,0);
for await(const r of checkpointUnits(worlds[3]))assert.ok(![510,513,516,512].includes(r.primary.words[1])&&![510,513,516].includes(r.primary.words[6]));
for await(const r of checkpointContainerEntries(worlds[3]))assert.ok(![510,513,516].includes(r.unitId)&&![510,513,516].includes(r.targetUnitId));
async function queues(w){const rows=[];for await(const r of checkpointAgentQueues(w))rows.push(r.type==='queued-agent'?{type:r.type,queue:r.queue,agentId:r.agentId}:{type:r.type,activeQueue:r.activeQueue});return rows;}
const initialQueues=await queues(worlds[0]);assert.equal(initialQueues.filter(r=>r.agentId===54).length,1);
for(const i of [1,2])assert.deepEqual(await queues(worlds[i]),initialQueues);
assert.deepEqual(await queues(worlds[3]),initialQueues.filter(r=>r.agentId!==54));
assert.equal(m.frames.length,2);for(const r of m.frames){assert.equal(r.bytes,1440015);assert.equal(await hash(r.filename),r.sha256);}
assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
assert.ok(m.finishedAtMs-m.startedAtMs<37000&&m.resourceSamples.length);for(const r of m.resourceSamples)assert.ok(r.rssBytes<=m.rssCeilingBytes);
const sourceSha256={};for(const n of ['scripts/inspect-native-halo-return-source.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
 'web/world/checkpoint.mjs','web/world/saved-clock.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeReturnedSourceRetirementQualified:true,manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,
 qualifiedDestinationArchive:p.liveArchive,qualifiedDestination:p.qualifiedDestination,identity:p.identity,selectedOwner:p.selected.owner,
 selectedManifest:p.ownerManifest,journal:p.journal,sourceClock:1500,qualifiedDestinationClock:63650,
 beforeWorld:rows[2],retiredWorld:rows[3],removedRecords:removed.length,exactLoadedComparisons,unrelatedRecordComparisons,
 originalRemovalQualified:true,otherQueuesPreserved:true,releasedRewardRosterPreserved:true,registeredHomeProxyPreserved:true,
 oldExpiredEffectRestored:false,sourceAndJournalUnchanged:true,servedArtifactsUnchanged:true,
 nativeSessionTerminal:true,nativeExitCode:0,elapsedMs:m.finishedAtMs-m.startedAtMs,
 peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),maximumReadBytes:4096,
 ownerPublished:false,seamlessLiveTravelQualified:false,automaticReturnCrossingQualified:false,browserUsed:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeReturnedSourceRetirementQualified:true,removedRecords:7,exactLoadedComparisons,unrelatedRecordComparisons,selectedOwnerUnchanged:true}));
