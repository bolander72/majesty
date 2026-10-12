#!/usr/bin/env node
// Independent original homeward movement and accepted halo crossing proof.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentValues,checkpointContainerEntries,checkpointChunks} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {planHaloActorHandoff} from '../web/world/halo-region-layout.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointActorOrderNavigation} from '../web/world/order-navigation.mjs';
const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-halo-home-leg-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const m=await json(manifestName),p=await json(m.preparation);
assert.equal(m.selectedHaloHomeLegTrialCompleted,true);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
try{process.kill(m.nativePid,0);throw Error('Native producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.journalBefore,p.journalSha256);
assert.equal(m.sourceCheckpointUnchanged,true);assert.equal(m.reloadIdsUnchanged,true);assert.equal(m.layoutMetadataUnchanged,true);assert.equal(m.homeLegIdsUnchanged,true);assert.equal(await hash(m.homeLegIds.filename),p.homeLegIds.sha256);
assert.equal(m.privateNativeExecutableUnchanged,true);assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],[m.log,m.logSha256],
 [m.privateNativeExecutable,m.nativeExecutableSha256],['scripts/run-native-halo-home-leg.py',m.runnerSha256],
 ['scripts/run-native-regional-home.py',m.supervisorSha256],['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.ownerManifest);
assert.equal(m.sourceCheckpoint.sha256,p.world.sha256);assert.equal(p.selectedRevision,5);assert.equal(p.ownerExportDormantWorldsOpened,0);
assert.equal(p.selectedHaloHomeLegPrepared,true);assert.equal(p.homeLeg.ownerManifest,p.ownerManifest);
assert.equal(p.homeLeg.ownerRevision,5);assert.equal(p.homeLeg.sourceWorld.sha256,p.world.sha256);
assert.equal(p.homeLeg.sourceRegion,'1_0');assert.equal(p.homeLeg.homeRegion,'0_0');assert.equal(p.homeLeg.direction,'west');
assert.equal(p.homeLeg.nativeHome.unitId,469);assert.equal(p.homeLeg.nativeHome.agentId,7);
assert.deepEqual(p.homeLeg.localGoal,{x:98304,y:258194});assert.equal(p.homeLeg.nativeMovementQualified,false);
const packet=await readFile(m.homeLegIds.filename);assert.equal(packet.length,56);
assert.deepEqual(Array.from({length:14},(_,i)=>packet.readUInt32LE(i*4)),[0x314c4848,1,3550,13550,532,35,34,5,48,126,1,0,0,0]);
const auditName=resolve('output/native-home-leg-instruction-audit-001.json'),audit=await json(auditName);
assert.equal(audit.pinnedCoordinateMoveQualified,true);assert.equal(audit.nativeEntry,0x5b4870);assert.equal(audit.stackArgumentBytes,20);
assert.equal(await hash('upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'),audit.executableSha256);
for(const[n,h]of Object.entries(audit.sourceSha256))assert.equal(await hash(n),h);
const rows=[m.sourceCheckpoint,m.loadedCheckpoint,...m.worlds];assert.equal(rows.length,5);const worlds=[],states=[];
for(const r of rows){assert.ok(r);assert.equal(await hash(r.filename),r.sha256);assert.equal((await lstat(r.filename)).size,r.bytes);
 worlds.push(await stoppedFileSource(r.filename));states.push(await connectedWorldState(r.filename,{unscheduledAgents:[34]}));}
assert.deepEqual(states.map(s=>s.clock),[3550,3550,3550,3550,3750]);
assert.deepEqual(m.worlds.map(r=>basename(r.filename)),['Halo_Home_Leg_Loaded.GMP','Halo_Home_Leg_Ready.GMP','Halo_Home_Leg_Crossed.GMP']);
async function records(w){const map=new Map(),add=(k,r)=>{assert.ok(!map.has(k)&&map.size<4096);map.set(k,r);};
 for await(const r of checkpointUnits(w))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(w))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(w))add(r.kind+':'+r.unitId,r);return map;}
const maps=[];for(const w of worlds)maps.push(await records(w));let exactRecordComparisons=0;
for(let i=1;i<4;i++){if(i<3)compareConnectedWorlds(states[0],states[i]);
 assert.deepEqual([...maps[0].keys()].sort(),[...maps[i].keys()].filter(k=>i<3||k!=='ORDR:532').sort());
 for(const[k,r]of maps[0]){const a=maps[i].get(k);assert.equal(a.size,r.size,k);
  for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await worlds[0].readAt(r.offset+at,n),await worlds[i].readAt(a.offset+at,n),k);}exactRecordComparisons++;}}
for(let i=0;i<5;i++){
 await verifyRegisteredHeroSnapshot(p.identity,{unitId:532,agentId:35},{kind:'proxy',unitId:0,agentId:34},worlds[i],true,'1_0');
 assert.equal(states[i].queues.flat().filter(id=>id===35).length,1);assert.equal(maps[i].has('ORDR:532'),i>=3);
 for(const id of [533,534,535])for(const kind of ['UNIT','ORDR','CONT'])assert.ok(!maps[i].has(kind+':'+id));
 for await(const c of checkpointContainerEntries(worlds[i]))if(c.unitId===532&&c.type==='member')assert.ok(![533,534,535].includes(c.targetUnitId));
 const u=maps[i].get('UNIT:532'),bytes=Buffer.from(await worlds[i].readAt(u.offset+60,20));
 if(i<4){assert.deepEqual([0,4,8].map(at=>bytes.readInt32LE(at)),[135015,258194,116930]);assert.deepEqual([12,16].map(at=>bytes.readUInt32LE(at)),[4,8]);}
 else {assert.deepEqual([0,4,8].map(at=>bytes.readInt32LE(at)),[125384,250634,117986]);assert.deepEqual([12,16].map(at=>bytes.readUInt32LE(at)),[3,7]);}
 const values=[];for await(const v of checkpointAgentValues(worlds[i],35))values.push(v);
 for(const name of ['home','target'])assert.equal(values.find(v=>v.attribute===name&&!v.path.length).targetAgentId,34);
 const task=values.find(v=>v.attribute==='taskname'&&!v.path.length);assert.equal(task.stringBytes,7);
 assert.equal(Buffer.from(await worlds[i].readAt(task.offset,7)).toString('ascii'),'go_home');
 const active=values.find(v=>v.attribute==='activescript'&&!v.path.length);assert.ok(active.functions.some(f=>f.name==='use_building'));
}
const log=await readFile(m.log,'utf8');assert.ok(log.length<4*1024*1024);assert.ok(!/result=fail|abort from/.test(log));
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.ok(log.includes('Halo home leg ready hero=532 agent=35 proxy=34 clock=3550 goal=48,126 original-move=1 pose-written=0 request-preserved=1 owner-published=0 result=pass'));
const endpoints=[...log.matchAll(/Halo home leg crossed hero=532 agent=35 proxy=34 clock=(\d+) ticks=(\d+) held-ai=(\d+) other-ai=(\d+) commands=(\d+) before=(-?\d+),(-?\d+),(-?\d+) after=(-?\d+),(-?\d+),(-?\d+) footprint=4 drawing=1 queued=1 request-preserved=1 original-pause=1 hooks-removed=1 owner-published=0 result=pass/g)];assert.equal(endpoints.length,1);
const values=endpoints[0].slice(1).map(Number),[clock,ticks,held,other,commands,...positions]=values;
assert.equal(clock,3750);assert.equal(ticks,4);assert.equal(clock-3550,ticks*50);
assert.ok(held>0&&held<=4096&&other>0&&other<=65536&&commands>0&&commands<=65536);
assert.deepEqual(positions,[135015,258194,116930,125384,250634,117986]);
const handoff=planHaloActorHandoff({x:positions[0],y:positions[1],z:positions[2]},
 {x:positions[3],y:positions[4],z:positions[5]},'1_0');
assert.equal(handoff.destinationRegion,'0_0');assert.equal(handoff.globalFixed.x<handoff.previousGlobalFixed.x,true);
assert.deepEqual(handoff.destinationPose,{x:8251848,y:250634,z:117986});
// Arming changes only the new original ORDR record and its registration.
assert.equal(states[2].rng,states[3].rng);assert.equal(states[2].gameplayRng,states[3].gameplayRng);
assert.deepEqual(states[2].queues,states[3].queues);assert.equal(states[2].activeQueue,states[3].activeQueue);
assert.deepEqual(states[2].roots.filter(r=>!['ORDR','ORLS'].includes(r.tag)),states[3].roots.filter(r=>!['ORDR','ORLS'].includes(r.tag)));
async function root(w,tag){let found;for await(const c of checkpointChunks(w))if(c.tag===tag){assert.equal(found,undefined);found=c;}assert.ok(found);return found;}
async function registrations(w){const c=await root(w,'ORLS');assert.equal(c.version,1);assert.ok(c.count<=4096);assert.equal(c.size,(c.count+1)*4);
 const words=[];for(let at=0;at<c.size;at+=4096){const b=Buffer.from(await w.readAt(c.offset+16+at,Math.min(4096,c.size-at)));for(let i=0;i<b.length;i+=4)words.push(b.readUInt32LE(i));}
 assert.equal(words.shift(),0x5244524f);assert.equal(new Set(words).size,words.length);return words;}
assert.deepEqual(await registrations(worlds[3]),[...await registrations(worlds[2]),532]);
const beforeOrders=await root(worlds[2],'ORDR'),readyOrders=await root(worlds[3],'ORDR');
assert.equal(readyOrders.version,beforeOrders.version);assert.equal(readyOrders.count,beforeOrders.count+1);
assert.equal(readyOrders.size,beforeOrders.size+maps[3].get('ORDR:532').size);
// Holding AI must preserve its complete original serialized contexts, not just
// selected home fields. The native command runner remains free to move it.
for(const key of ['GPL:35','GPL:34']){const a=maps[0].get(key),b=maps[4].get(key);assert.equal(a.size,b.size);
 for(let at=0;at<a.size;at+=4096){const n=Math.min(4096,a.size-at);assert.deepEqual(await worlds[0].readAt(a.offset+at,n),await worlds[4].readAt(b.offset+at,n));}}
const banks=[];for(const i of [3,4]){const entries=[];
 for await(const e of checkpointActorOrderEntries(worlds[i],532))if(e.type==='entry'){
  assert.ok([2,4,7].includes(e.kind));assert.equal(e.words[9],0);assert.equal(e.words[10],0);
  assert.ok(e.words[5]>=3550&&e.words[5]<=clock);entries.push({bank:e.bank,index:e.index,kind:e.kind,stamp:e.words[5],count:e.waypointCount});}
 banks.push(entries);}
assert.deepEqual(banks[0].map(e=>[e.bank,e.index,e.kind,e.stamp,e.count]),[[0,0,4,3550,0],[1,0,7,3550,1]]);
assert.deepEqual(banks[1].map(e=>[e.bank,e.index,e.kind,e.stamp,e.count??null]),[[0,0,2,3750,null],[0,1,4,3550,2],[1,0,7,3550,1]]);
const navigation=[];for await(const n of checkpointActorOrderNavigation(worlds[4],532))navigation.push(n);
const path=navigation.find(n=>n.type==='navigation'&&n.kind===4);assert.deepEqual([path.cursor,path.count,path.capacity],[1,2,10]);
assert.deepEqual(navigation.filter(n=>n.kind===4&&n.field==='waypoint').map(n=>[n.x,n.y]),[[4,8],[3,7]]);
assert.deepEqual(navigation.filter(n=>[4,7].includes(n.kind)&&n.field==='destination').map(n=>[n.x,n.y]),[[48,126]]);
const queue=navigation.find(n=>n.type==='navigation'&&n.kind===7);assert.deepEqual([queue.cursor,queue.count,queue.capacity],[1,1,10]);
for(const r of m.frames){assert.equal(await hash(r.filename),r.sha256);assert.equal(r.bytes,1440015);}assert.equal(m.frames.length,2);
assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length);
for(const r of m.resourceSamples)assert.ok(r.rssBytes<=m.rssCeilingBytes);
const sourceSha256={...p.sourceSha256};for(const n of ['scripts/inspect-native-halo-home-leg.mjs','scripts/lib/connected-residency.mjs',
 'scripts/check-native-repeat-return.mjs','scripts/check-native-world-persistence.mjs',
 'web/world/order-entries.mjs','web/world/order-navigation.mjs','scripts/audit-native-home-leg.py'])sourceSha256[n]=await hash(n);
const report={version:1,nativeSelectedHaloHomeLegQualified:true,manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,
 publicationArchive:p.publicationArchive,nativeMoveAudit:{filename:auditName,sha256:await hash(auditName)},
 selectedRevision:5,selectedOwner:p.selected.owner,startClock:3550,endClock:clock,
 exactLoadedRecords:maps[0].size,exactRecordComparisons,wholeWorlds:rows,heldAiCalls:held,otherAiCalls:other,originalTicks:ticks,
 originalLoadedSpatialAndQueueState:true,postloadReplayed:false,queuesInserted:false,expiredEffectsAbsent:true,remoteHomeRequestPreserved:true,
 sourceAndJournalUnchanged:true,ownerPublished:false,nativeSessionTerminal:true,nativeExitCode:0,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),
 originalHomewardMovementQualified:true,homeRegionRestored:false,handoff,banks,commandCalls:commands,browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSelectedHaloHomeLegQualified:true,exactLoadedRecords:maps[0].size,exactRecordComparisons,heldAiCalls:held,otherAiCalls:other}));
