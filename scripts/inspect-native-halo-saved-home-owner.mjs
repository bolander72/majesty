#!/usr/bin/env node
// Independently verify original reload of the journal-selected home owner.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-saved-home-owner-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const m=await json(manifestName),p=await json(m.preparation),publication=await json(p.publicationProof.filename);
assert.equal(m.selectedHaloSavedHomeOwnerTrialCompleted,true);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
assert.equal(m.nativeProcessesStarted,1);try{process.kill(m.nativePid,0);throw Error('Native producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.journalBefore,p.journalSha256);
assert.equal(publication.journalOriginalSavedRoundtripPublished,true);assert.equal(publication.selectedRevision,8);
assert.deepEqual(publication.selectedOwner,p.selected.owner);assert.equal(publication.destinationWorld.sha256,p.world.sha256);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);assert.deepEqual(m.compiledSourceSha256,p.compiledSourceSha256);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256,...publication.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],
 [p.publicationProof.filename,p.publicationProof.sha256],[p.nativeArchive.filename,p.nativeArchive.sha256],
 [m.privateNativeExecutable,m.nativeExecutableSha256],[m.log,m.logSha256],['scripts/run-native-halo-saved-home-owner.py',m.runnerSha256],
 ['scripts/run-native-regional-home.py',m.supervisorSha256],['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
const archive=await json(p.nativeArchive.filename);assert.equal(archive.nativeSavedHomeOriginalGameplayQualified,true);
for(const row of archive.sources.concat(archive.evidence))assert.equal(await hash(row.preserved),row.sha256);
for(const key of ['privateNativeExecutableUnchanged','sourceCheckpointUnchanged','reloadIdsUnchanged','layoutMetadataUnchanged'])assert.equal(m[key],true);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.ownerManifest);
assert.equal(m.worlds.length,3);assert.equal(m.frames.length,2);assert.equal(m.region,'0_0');
const rows=[p.world,m.loadedCheckpoint,...m.worlds],worlds=[],states=[],maps=[];
async function records(s){const map=new Map(),add=(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,row);};
 for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;}
for(const row of [...rows,m.sourceCheckpoint,m.layoutMetadata,m.reloadIds,...m.frames]){
 assert.equal(await hash(row.filename),row.sha256);assert.equal((await lstat(row.filename)).size,row.bytes);}
for(const row of p.settings)assert.equal(await hash(row.preserved),row.sha256);
for(const r of rows){worlds.push(await stoppedFileSource(r.filename));states.push(await connectedWorldState(r.filename));maps.push(await records(worlds.at(-1)));}
assert.deepEqual(states.map(s=>s.clock),[113500,113500,113500,113500,114000]);
let exactRecordComparisons=0;const reloadPermutations=[];
for(let i=1;i<4;++i){reloadPermutations.push(compareConnectedWorlds(states[0],states[i]));
 assert.deepEqual([...maps[0].keys()].sort(),[...maps[i].keys()].sort());
 for(const[key,a]of maps[0]){const b=maps[i].get(key);assert.equal(b.size,a.size,key);
  for(let at=0;at<a.size;at+=4096){const n=Math.min(4096,a.size-at);
   assert.deepEqual(await worlds[i].readAt(b.offset+at,n),await worlds[0].readAt(a.offset+at,n),key);}
  ++exactRecordComparisons;}}
assert.equal(maps[0].size,510);assert.equal(exactRecordComparisons,1530);
assert.equal(states[2].rawTerrainSha256,states[3].rawTerrainSha256);
assert.deepEqual(states[2].roots,states[3].roots);assert.deepEqual(states[2].queues,states[3].queues);
const hero=513,agent=29,poses=[],orderKinds=[];
for(let i=0;i<worlds.length;++i){
 await verifyRegisteredHeroSnapshot(p.identity,{unitId:hero,agentId:agent},{kind:'native',unitId:469,agentId:7},worlds[i],true,'0_0');
 await verifyEntitySnapshot(p.identity,{unitId:hero,agentId:agent},worlds[i],true,{kind:'native',unitId:469,agentId:7});
 assert.equal(states[i].queues.flat().filter(id=>id===agent).length,1);assert.ok(!maps[i].has('UNIT:508')&&!maps[i].has('GPL:25'));
 const unit=maps[i].get('UNIT:'+hero);assert.equal(unit.primary.words[2]&4,0);
 const b=Buffer.from(await worlds[i].readAt(unit.offset+60,20));poses.push([0,4,8,12,16].map(at=>b.readInt32LE(at)));
 const values=[];for await(const v of checkpointAgentValues(worlds[i],agent))values.push(v);
 for(const name of ['home','target'])assert.equal(values.find(v=>v.attribute===name&&!v.path.length).targetAgentId,7);
 const task=values.find(v=>v.attribute==='taskname'&&!v.path.length);assert.equal(task.stringBytes,7);
 assert.equal(Buffer.from(await worlds[i].readAt(task.offset,7)).toString('ascii'),'go_home');
 const kinds=[];for await(const e of checkpointActorOrderEntries(worlds[i],hero))if(e.type==='entry')kinds.push(e.kind);
 orderKinds.push(kinds);assert.deepEqual(kinds,i===4?[4,7]:[2,4,7]);
}
for(const pose of poses.slice(1,4))assert.deepEqual(pose,poses[0]);assert.notDeepEqual(poses[4],poses[0]);
assert.ok((await lstat(m.log)).size<4*1024*1024);const log=await readFile(m.log,'utf8');
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));assert.ok(!/result=fail|abort from|refused boundary=/.test(log));
assert.ok(log.includes('Halo saved home owner reloaded hero=513 agent=29 home=469/7 clock=113500 revision=8 footprint=4 drawing=1 queued=1 orders-admitted=1 imported=0 postload-replayed=0 queue-inserted=0 ungated-ai=1 original-reader=1 owner-published=0 result=pass'));
const endpoints=[...log.matchAll(/Halo saved home owner endpoint clock=114000 ticks=10 ai=(\d+) other-ai=(\d+) contexts=(\d+) building=(\d+) commands=(\d+) moved=1 parent=(\d+) cells=(\d+) drawing=(\d+)/g)];
assert.equal(endpoints.length,1);const counts=endpoints[0].slice(1).map(Number);
for(const i of [0,1,2,4])assert.ok(counts[i]>0&&counts[i]<=65536);
const parent=maps[4].get('UNIT:'+hero).primary.words[6];assert.equal(counts[5],parent);assert.ok(parent===0||parent===469);
assert.equal(counts[6],parent?0:4);assert.equal(counts[7],parent?0:1);
assert.ok(log.includes(`Halo saved home owner evolved hero=513 agent=29 home=469/7 clock=114000 ticks=10 original-ai=1 original-commands=1 moved=1 parent=${parent} queued=1 reciprocal-rosters=1 evolved-saved=1 hooks-removed=1 original-pause=1 owner-published=0 result=pass`));
assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
assert.ok(m.finishedAtMs-m.startedAtMs<37000&&m.resourceSamples.length);for(const r of m.resourceSamples)assert.ok(r.rssBytes<=m.rssCeilingBytes);
const sourceSha256={...p.sourceSha256,'scripts/inspect-native-halo-saved-home-owner.mjs':await hash('scripts/inspect-native-halo-saved-home-owner.mjs'),
 'scripts/lib/connected-residency.mjs':await hash('scripts/lib/connected-residency.mjs')};
const report={version:1,nativeSelectedHaloSavedHomeOwnerQualified:true,
 scope:'Original full reload of journal revision8 selected home, exact saved actor/command state, and ten subsequent original ticks. Continuous browser travel and guild entry are separate.',
 manifest:resolve(manifestName),manifestSha256:await hash(manifestName),publicationProof:p.publicationProof,nativeArchive:p.nativeArchive,
 sourceSha256,wholeWorlds:rows,exactLoadedRecords:510,exactRecordComparisons,reloadPermutations,
 selectedRevision:8,actualNativeUnitId:hero,actualAgentId:agent,home:{unitId:469,agentId:7},
 startClock:113500,endClock:114000,originalTicks:10,originalAiCalls:counts[0],otherAiCalls:counts[1],contextCalls:counts[2],
 buildingUseCalls:counts[3],commandCalls:counts[4],poses,orderKinds,parentUnitId:parent,enteredGuild:parent===469,
 originalCommandsRestored:true,reciprocalGuildMembershipQualified:true,actorImported:false,postloadReplayed:false,queueInserted:false,
 ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,actualJournalUnchanged:true,ownerPublished:false,browserUsed:false,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),
 nativeSessionTerminal:true,nativeExitCode:0,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSelectedHaloSavedHomeOwnerQualified:true,exactRecordComparisons,originalTicks:10}));
