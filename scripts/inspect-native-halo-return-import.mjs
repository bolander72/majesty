#!/usr/bin/env node
// Corroborate original-engine return import with independently rebound GMPs.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {prepareSelectedHaloReturn} from './prepare-native-selected-halo-return.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentValues,
  checkpointAgentQueues,checkpointContainerEntries,checkpointAbsentAgentReferences} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const[manifestName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outputName,/^output\/native-halo-return-import-\d{3}-observed\.json$/);
await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const m=await json(manifestName),p=await json(m.preparation),capsule=await json(p.capsule.filename);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
assert.equal(m.stopReason,null);assert.equal(m.selectedHaloReturnImportTrialCompleted,true);assert.equal(m.browserUsed,false);
assert.equal(m.nativeActivationQualified,false);assert.equal(m.ownerPublished,false);assert.equal(m.sourceRetired,false);
assert.deepEqual(m.preservedAfter,m.preservedBefore);assert.deepEqual(m.journalAfter,m.journalBefore);
assert.deepEqual(m.journalBefore,p.journalSha256);assert.equal(m.nativeProcessesStarted,1);
try{process.kill(m.nativePid,0);throw Error('Native evidence producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.match(basename(m.fixture),/^actor-arrival-fixture-halo-world-return-/);assert.equal(m.profile,join(m.fixture,'frontier_0_0'));
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256,...capsule.sourceSha256}))assert.equal(await hash(n),h);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);assert.deepEqual(m.compiledSourceSha256,p.compiledSourceSha256);
for(const[n,h]of [[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],
 [m.privateNativeExecutable,m.nativeExecutableSha256],[m.log,m.logSha256],[p.capsule.filename,p.capsule.sha256],
 ['scripts/run-native-halo-return-import.py',m.runnerSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],
 ['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
const build=await json(m.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(build.nativeSymbolsSha256,m.nativeSymbolsSha256);
for(const r of [p.archive,p.storageGate,p.settingsArchive])assert.equal(await hash(r.filename),r.sha256);
const archive=await json(p.archive.filename);assert.equal(archive.generation,246);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
const storage=await json(p.storageGate.filename);assert.equal(storage.nativeTargetsPassed,2);
for(const r of storage.rows)assert.equal(await hash(r.preserved),r.sha256);
assert.equal(m.sourceCheckpointUnchanged,true);assert.equal(m.packUnchanged,true);assert.equal(m.layoutMetadataUnchanged,true);
assert.equal(m.privateNativeExecutableUnchanged,true);assert.equal(m.sourceCheckpoint.sha256,p.homeWorld.sha256);
for(const r of [p.homeWorld,p.pack,m.sourceCheckpoint,m.pack,m.layoutMetadata,...p.records]){
 assert.equal(await hash(r.filename),r.sha256);assert.equal((await lstat(r.filename)).size,r.bytes);
}
const publication=await json(capsule.publication.filename);assert.equal(await hash(capsule.publication.filename),capsule.publication.sha256);
const repeated=await prepareSelectedHaloReturn(p.journal,publication);assert.deepEqual(repeated.prepared.plan,capsule.plan);
assert.deepEqual(repeated.journalSha256,p.journalSha256);assert.equal(repeated.selected.record.manifest,p.ownerManifest);
assert.equal(repeated.stats.peakReads,1);assert.ok(repeated.stats.largestRead<=4096);
assert.ok((await lstat(m.log)).size<4*1024*1024);const log=await readFile(m.log,'utf8');
assert.ok(!/result=fail|abort from/.test(log));assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.ok(log.includes('Halo return models original-helper-postload=3 drawing-preserved=1 queues-preserved=1 saved-state-rewritten=0 result=pass'));
const rows=[...log.matchAll(/Halo return records hero=(\d+) agent=(\d+) effects=(\d+),(\d+) home=469\/7 clock=60650 records=7 exact=1 native-roster=1 script-roster=1 scheduled=0 activation=0 source-retired=0 owner-published=0 result=pass/g)];
assert.equal(rows.length,1);const[hero,agent,effect1,effect2]=rows[0].slice(1).map(Number),ids=[hero,effect1,effect2];
assert.equal(new Set(ids).size,3);for(const id of ids)assert.ok(id>481);assert.ok(agent>17);
assert.ok(log.includes('Halo return cleanup requests=23 aliases-absent=1 native-roster-empty=1 script-roster-empty=1 registry-preserved=1 queues-preserved=1 original-removal=1 hooks-removed=1 result=pass'));
for(const id of [510,513,516])assert.ok(log.includes(`Halo return stage source=${id} status=00000000 complete=1 failure=0`));
const nativeMap=new Map([[100000,hero],[100001,effect1],[100002,effect2],[469,469]]),agentMap=new Map([[1000,agent],[7,7]]);
const checked=[],expected=new Map();let standaloneComparisons=0;
for(const r of p.records){
 const raw=Uint8Array.from(await readFile(r.filename));assert.deepEqual(raw,repeated.prepared.records[r.key]);
 const bytes=Uint8Array.from(raw),v=new DataView(bytes.buffer);let key,name,standalone=bytes;
 const put=(at,map)=>{const before=v.getUint32(at,true);assert.ok(map.has(before));v.setUint32(at,map.get(before),true);};
 if(r.key==='unit'||r.key.startsWith('attached_')&&!r.key.startsWith('attached_order_')){
  const id=r.key==='unit'?hero:r.key==='attached_513'?effect1:effect2;put(36,nativeMap);
  if(r.key!=='unit')put(56,nativeMap);
  for(const e of capsule.plan.edits)if(e.record===r.key&&e.reason==='native script association')put(e.offset-capsule.plan.ranges[r.key].offset,agentMap);
  key='UNIT:'+id;name=`Halo_Return_Observed_${r.key==='unit'?510:r.key.slice(9)}.UNIT`;
 }else if(r.key==='agent'){
  for(const e of capsule.plan.edits)if(e.record==='agent'){
   if(e.reason==='script identity'||e.reason.startsWith('script:'))put(e.offset-capsule.plan.ranges.agent.offset,agentMap);
   else if(e.reason==='script native association')put(e.offset-capsule.plan.ranges.agent.offset,nativeMap);
  }
  key='GPL:'+agent;name='Halo_Return_Agent_Observed.GPL';
 }else if(r.key==='container'){
  put(0,nativeMap);let at=44;assert.equal(v.getUint32(36,true),1);assert.equal(v.getUint32(40,true),2);
  for(let g=0;g<2;++g){const n=v.getUint32(at+4,true);put(at+12,nativeMap);at+=16;
   for(let j=0;j<n;++j,at+=8){put(at,nativeMap);assert.equal(v.getUint32(at+4,true),1);}
  }
  assert.equal(at,bytes.length);key='CONT:'+hero;name='Halo_Return_Container_Observed.bin';standalone=bytes.subarray(36);
 }else{
  assert.ok(r.key==='attached_order_513'||r.key==='attached_order_516');put(0,nativeMap);
  key='ORDR:'+(r.key==='attached_order_513'?effect1:effect2);name=`Halo_Return_Observed_${r.key.slice(15)}_Orders.bin`;standalone=bytes.subarray(36);
 }
 const filename=join(m.profile,name);assert.equal((await lstat(filename)).size,standalone.length);
 assert.deepEqual(Uint8Array.from(await readFile(filename)),standalone,r.key);standaloneComparisons++;
 assert.ok(!expected.has(key));expected.set(key,bytes);checked.push({key,filename,...await hashNativeFile(filename)});
}
assert.equal(expected.size,7);
async function records(w){const map=new Map();const add=(key,r)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,r);};
 for await(const u of checkpointUnits(w))add('UNIT:'+u.primary.words[1],u);
 for await(const a of checkpointAgents(w))add('GPL:'+a.agentId,a);
 for await(const a of checkpointAttachments(w))add(a.kind+':'+a.unitId,a);return map;
}
async function exact(a,ar,b,br,key){assert.ok(ar&&br,key);assert.equal(br.size,ar.size,key);
 for(let at=0;at<ar.size;at+=4096){const n=Math.min(4096,ar.size-at);assert.deepEqual(await b.readAt(br.offset+at,n),await a.readAt(ar.offset+at,n),key);}
}
const worlds=[];assert.equal(m.worlds.length,3);
for(const[i,r]of m.worlds.entries()){
 assert.equal(basename(r.filename),['Halo_Return_Before.GMP','Halo_Return_Imported.GMP','Halo_Return_Cleaned.GMP'][i]);
 assert.equal(await hash(r.filename),r.sha256);assert.equal((await lstat(r.filename)).size,r.bytes);
 const w=await stoppedFileSource(r.filename);assert.equal(await checkpointSavedClock(w),60650);worlds.push(w);
}
const maps=[];for(const w of worlds)maps.push(await records(w));
assert.deepEqual([...maps[1].keys()].sort(),[...maps[0].keys(),...expected.keys()].sort());
assert.deepEqual([...maps[2].keys()].sort(),[...maps[0].keys()].sort());
let savedRecordComparisons=0,unrelatedRecordComparisons=0,cleanupRecordComparisons=0;
for(const[key,bytes]of expected){const r=maps[1].get(key);assert.ok(r,key);assert.equal(r.size,bytes.length);
 assert.deepEqual(await worlds[1].readAt(r.offset,r.size),bytes,'Imported whole save '+key);savedRecordComparisons++;
}
for(const[key,r]of maps[0]){
 if(key!=='GPL:7'&&key!=='CONT:469'){await exact(worlds[0],r,worlds[1],maps[1].get(key),key);unrelatedRecordComparisons++;}
 await exact(worlds[0],r,worlds[2],maps[2].get(key),'Cleanup '+key);cleanupRecordComparisons++;
}
// Reconstruct both guild records by inserting only the original member. No
// unrelated field, callback, saved timer or quest state may change.
let root;for await(const v of checkpointAgentValues(worlds[0],7))if(v.attribute==='members'&&!v.path.length)root=v;
assert.ok(root&&root.type===4&&root.childCount===0);
const guild=maps[0].get('GPL:7'),list=root.typeOffset-guild.offset,drop=list+16;
async function inserted(w,r,key,offset,words,patches){
 assert.ok(r.size<=4096);const old=await w.readAt(r.offset,r.size),next=new Uint8Array(old.length+8);
 next.set(old.subarray(0,offset));next.set(old.subarray(offset),offset+8);const v=new DataView(next.buffer);
 words.forEach((word,i)=>v.setUint32(offset+4*i,word,true));
 for(const[at,delta]of patches)v.setUint32(at,v.getUint32(at,true)+delta,true);
 const found=maps[1].get(key);assert.equal(found.size,next.length);assert.deepEqual(await worlds[1].readAt(found.offset,found.size),next,key);
}
await inserted(worlds[0],guild,'GPL:7',drop,[5,agent],[[0,8],[8,8],[list+4,8],[list+12,1]]);
const members=[];for await(const v of checkpointAgentValues(worlds[1],7))if(v.attribute==='members')members.push(v);
assert.equal(members.length,2);const memberRoot=members.find(v=>!v.path.length),memberChild=members.find(v=>v.path.length);
assert.equal(memberRoot.childCount,1);assert.deepEqual(memberChild.path,[0]);assert.equal(memberChild.targetAgentId,agent);
let group;for await(const c of checkpointContainerEntries(worlds[0]))if(c.unitId===469&&c.groupKind===100&&c.type==='group')group=c;
assert.ok(group);assert.equal(group.memberCount,0);const cont=maps[0].get('CONT:469'),at=group.offset-cont.offset;
await inserted(worlds[0],cont,'CONT:469',at+16,[hero,1],[[8,8],[cont.primary.offset-cont.offset+4,8],[at+4,1]]);
const relationships=[];for await(const c of checkpointContainerEntries(worlds[1]))if(c.type==='member'&&[469,hero].includes(c.unitId))relationships.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
for(const row of [[469,100,hero,1],[hero,101,469,1],[hero,1,effect1,1],[hero,1,effect2,1]])assert.ok(relationships.some(r=>JSON.stringify(r)===JSON.stringify(row)));
async function queues(w){const q=[];for await(const r of checkpointAgentQueues(w))q.push(r.type==='queued-agent'?{type:r.type,queue:r.queue,agentId:r.agentId}:{type:r.type,activeQueue:r.activeQueue});return q;}
assert.deepEqual(await queues(worlds[1]),await queues(worlds[0]));assert.deepEqual(await queues(worlds[2]),await queues(worlds[0]));
assert.equal((await checkpointAbsentAgentReferences(worlds[2],agent)).sites.length,0);
for await(const u of checkpointUnits(worlds[2]))assert.ok(!ids.includes(u.primary.words[6]));
for await(const c of checkpointContainerEntries(worlds[2]))assert.ok(!ids.includes(c.unitId)&&!ids.includes(c.targetUnitId));
assert.equal(m.frames.length,2);for(const r of m.frames){assert.equal(r.bytes,1440015);assert.equal(await hash(r.filename),r.sha256);}
assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
assert.ok(m.finishedAtMs-m.startedAtMs<37000&&m.resourceSamples.length);for(const r of m.resourceSamples)assert.ok(r.rssBytes<=m.rssCeilingBytes);
const sourceSha256={};for(const n of ['scripts/inspect-native-halo-return-import.mjs','scripts/lib/stopped-entity-io.mjs',
 'scripts/lib/native-generation.mjs','scripts/prepare-native-selected-halo-return.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeHaloReturnImportQualified:true,
 scope:'Selected1500 Warrior and all current effects imported into its stopped60650 home; original model resolution, exact seven standalone/whole-save records, original reciprocal guild membership and cleanup. No spatial/AI activation or custody publication.',
 manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,records:checked,actualNativeUnitIds:ids,actualAgentId:agent,
 sourceClock:1500,destinationClock:60650,standaloneRecordComparisons:standaloneComparisons,savedRecordComparisons,
 unrelatedRecordComparisons,cleanupRecordComparisons,wholeWorlds:m.worlds,originalHelperPostloadExecuted:true,
 savedModelIndicesPreserved:true,reciprocalGuildMembershipQualified:true,originalCleanupQualified:true,freedCommandReservations:23,
 sourceAndJournalUnchanged:true,queuesUnchanged:true,servedArtifactsUnchanged:true,nativeSessionTerminal:true,nativeExitCode:0,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),
 maximumReadBytes:4096,peakWorldReads:1,nativeActivationQualified:false,sourceRetired:false,ownerPublished:false,
 automaticReturnCrossingQualified:false,browserUsed:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHaloReturnImportQualified:true,standaloneRecordComparisons:standaloneComparisons,savedRecordComparisons,
 unrelatedRecordComparisons,cleanupRecordComparisons,originalCleanupQualified:true}));
