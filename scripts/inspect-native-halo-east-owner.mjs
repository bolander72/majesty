#!/usr/bin/env node
// Independent original-load and held remote-home continuation proof.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentValues,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-east-owner-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const m=await json(manifestName),p=await json(m.preparation);
assert.equal(m.selectedHaloEastOwnerTrialCompleted,true);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
try{process.kill(m.nativePid,0);throw Error('Native producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.journalBefore,p.journalSha256);
assert.equal(m.sourceCheckpointUnchanged,true);assert.equal(m.reloadIdsUnchanged,true);assert.equal(m.layoutMetadataUnchanged,true);
assert.equal(m.privateNativeExecutableUnchanged,true);assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],[m.log,m.logSha256],
 [m.privateNativeExecutable,m.nativeExecutableSha256],['scripts/run-native-halo-east-owner.py',m.runnerSha256],
 ['scripts/run-native-regional-home.py',m.supervisorSha256],['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.ownerManifest);
assert.equal(m.sourceCheckpoint.sha256,p.world.sha256);assert.equal(p.selectedRevision,5);assert.equal(p.ownerExportDormantWorldsOpened,0);
const rows=[m.sourceCheckpoint,m.loadedCheckpoint,...m.worlds];assert.equal(rows.length,5);const worlds=[],states=[];
for(const r of rows){assert.ok(r);assert.equal(await hash(r.filename),r.sha256);assert.equal((await lstat(r.filename)).size,r.bytes);
 worlds.push(await stoppedFileSource(r.filename));states.push(await connectedWorldState(r.filename,{unscheduledAgents:[34]}));}
assert.deepEqual(states.map(s=>s.clock),[3550,3550,3550,3550,4050]);
assert.deepEqual(m.worlds.map(r=>basename(r.filename)),['Halo_East_Owner_Loaded.GMP','Halo_East_Owner_Ready.GMP','Halo_East_Owner_Evolved.GMP']);
async function records(w){const map=new Map(),add=(k,r)=>{assert.ok(!map.has(k)&&map.size<4096);map.set(k,r);};
 for await(const r of checkpointUnits(w))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(w))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(w))add(r.kind+':'+r.unitId,r);return map;}
const maps=[];for(const w of worlds)maps.push(await records(w));let exactRecordComparisons=0;
for(let i=1;i<4;i++){compareConnectedWorlds(states[0],states[i]);
 assert.deepEqual([...maps[0].keys()].sort(),[...maps[i].keys()].sort());
 for(const[k,r]of maps[0]){const a=maps[i].get(k);assert.equal(a.size,r.size,k);
  for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await worlds[0].readAt(r.offset+at,n),await worlds[i].readAt(a.offset+at,n),k);}exactRecordComparisons++;}}
for(let i=0;i<5;i++){
 await verifyRegisteredHeroSnapshot(p.identity,{unitId:532,agentId:35},{kind:'proxy',unitId:0,agentId:34},worlds[i],true,'1_0');
 assert.equal(states[i].queues.flat().filter(id=>id===35).length,1);assert.ok(!maps[i].has('ORDR:532'));
 for(const id of [533,534,535])for(const kind of ['UNIT','ORDR','CONT'])assert.ok(!maps[i].has(kind+':'+id));
 for await(const c of checkpointContainerEntries(worlds[i]))if(c.unitId===532&&c.type==='member')assert.ok(![533,534,535].includes(c.targetUnitId));
 const u=maps[i].get('UNIT:532'),bytes=Buffer.from(await worlds[i].readAt(u.offset+60,20));
 assert.deepEqual([0,4,8].map(at=>bytes.readInt32LE(at)),[135015,258194,116930]);assert.deepEqual([12,16].map(at=>bytes.readUInt32LE(at)),[4,8]);
 const values=[];for await(const v of checkpointAgentValues(worlds[i],35))values.push(v);
 for(const name of ['home','target'])assert.equal(values.find(v=>v.attribute===name&&!v.path.length).targetAgentId,34);
 const task=values.find(v=>v.attribute==='taskname'&&!v.path.length);assert.equal(task.stringBytes,7);
 assert.equal(Buffer.from(await worlds[i].readAt(task.offset,7)).toString('ascii'),'go_home');
 const active=values.find(v=>v.attribute==='activescript'&&!v.path.length);assert.ok(active.functions.some(f=>f.name==='use_building'));
}
const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024);assert.ok(!/result=fail|abort from/.test(log));
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.ok(log.includes('Halo east owner ready hero=532 agent=35 proxy=34 clock=3550 revision=5 footprint=4 drawing=1 queued=1 expired-effects=3 hero-bank-absent=1 postload-replayed=0 queues-inserted=0 request-held=1 original-writer=1 owner-published=0 result=pass'));
const endpoints=[...log.matchAll(/Halo east owner evolved hero=532 agent=35 proxy=34 clock=4050 ticks=10 held-ai=(\d+) other-ai=(\d+) footprint=4 drawing=1 queued=1 expired-effects=3 request-preserved=1 evolved-saved=1 original-pause=1 hooks-removed=1 owner-published=0 result=pass/g)];assert.equal(endpoints.length,1);
const held=Number(endpoints[0][1]),other=Number(endpoints[0][2]);assert.ok(held>0&&held<=4096&&other>0&&other<=65536);
for(const r of m.frames){assert.equal(await hash(r.filename),r.sha256);assert.equal(r.bytes,1440015);}assert.equal(m.frames.length,2);
assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length);
for(const r of m.resourceSamples)assert.ok(r.rssBytes<=m.rssCeilingBytes);
const sourceSha256={...p.sourceSha256};for(const n of ['scripts/inspect-native-halo-east-owner.mjs','scripts/lib/connected-residency.mjs',
 'scripts/check-native-repeat-return.mjs','scripts/check-native-world-persistence.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeSelectedEastOwnerReloadQualified:true,manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,
 publicationArchive:p.publicationArchive,selectedRevision:5,selectedOwner:p.selected.owner,startClock:3550,endClock:4050,
 exactLoadedRecords:maps[0].size,exactRecordComparisons,wholeWorlds:rows,heldAiCalls:held,otherAiCalls:other,originalTicks:10,
 originalLoadedSpatialAndQueueState:true,postloadReplayed:false,queuesInserted:false,expiredEffectsAbsent:true,remoteHomeRequestPreserved:true,
 sourceAndJournalUnchanged:true,ownerPublished:false,nativeSessionTerminal:true,nativeExitCode:0,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),
 automaticHomewardMovementQualified:false,browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSelectedEastOwnerReloadQualified:true,exactLoadedRecords:maps[0].size,exactRecordComparisons,heldAiCalls:held,otherAiCalls:other}));
