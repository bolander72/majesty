#!/usr/bin/env node
// Verify the journal-selected hero's original movement and complete paused world.
// This is the running source boundary, not destination activation or publication.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointActorRecords,
 checkpointAgentValues,checkpointPlacements} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {haloTerrainHeight,haloSharedVertex,planHaloActorHandoff} from '../web/world/halo-region-layout.mjs';
import {nativeHeightBits} from '../web/world/native-height.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
async function checked(r){assert.equal(await hash(r.filename),r.sha256);if(r.bytes!==undefined)assert.equal((await lstat(r.filename)).size,r.bytes);}
async function records(source){
 const rows=new Map();const add=(k,r)=>{assert.ok(!rows.has(k)&&rows.size<4096);rows.set(k,r);};
 for await(const r of checkpointUnits(source))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(source))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(source))add(r.kind+':'+r.unitId,r);return rows;
}
export async function equalWorlds(before,after,options={}){
 const a=await stoppedFileSource(before.filename),b=await stoppedFileSource(after.filename),am=await records(a),bm=await records(b);
 assert.deepEqual([...am.keys()].sort(),[...bm.keys()].sort());
 for(const[k,r]of am){const s=bm.get(k);assert.equal(s.size,r.size,k);
  for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await a.readAt(r.offset+at,n),await b.readAt(s.offset+at,n),k);}}
 return {records:am.size,...compareConnectedWorlds(await connectedWorldState(before.filename,options),await connectedWorldState(after.filename,options))};
}
async function pose(source,id){let result;for await(const p of checkpointPlacements(source))if(p.unitId===id){assert.equal(result,undefined);result=p;}
 assert.ok(result?.fixedPosition);assert.equal(result.requiresParentPosition,false);return result.fixedPosition;}
async function script(source,id){let result;for await(const v of checkpointAgentValues(source,id))if(v.attribute.toLowerCase()==='activescript'&&!v.path.length){
 assert.equal(result,undefined);assert.equal(v.type,8);result=v.functions.map(f=>f.name);}assert.ok(result?.length);return result;}
export async function inspectNativeHaloSessionActor(manifestName){
 const m=await json(manifestName),p=await json(m.preparation),actor=p.actorCrossing;
 assert.ok(['actor-crossing','actor-retirement','actor-paging','actor-proxy','actor-epoch','actor-arrival','actor-activation'].includes(m.mode));assert.equal(m.haloSessionActorTrialCompleted,true);
 for(const k of ['nativeOnly','nativeSessionTerminal','ownedProducerAbsent','privateNativeExecutableUnchanged','sessionLayoutUnchanged'])assert.equal(m[k],true);
 for(const k of ['browserUsed','heroTransferred','ownerPublished','goalComplete','haloSessionTrialCompleted'])assert.equal(m[k],false);
 assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);assert.equal(m.nativeProcessesStarted,1);assert.deepEqual(m.namedRequests,[]);
 try{process.kill(m.nativePid,0);throw Error('Actor producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
 await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-session-');assert.equal(m.root,join(m.fixture,'native-world-halo'));
 assert.equal(m.profile,join(m.root,'frontier_0_0'));assert.deepEqual(m.preservedBefore,m.preservedAfter);
 assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.journalBefore,p.journalSha256);
 for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
 assert.equal(Object.keys(m.compiledSourceSha256).length,54);assert.deepEqual(m.compiledSourceSha256,p.compiledSourceSha256);
 for(const[n,h]of [[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],[m.privateNativeExecutable,m.nativeExecutableSha256],
  [m.log,m.logSha256],[m.script,m.scriptSha256],['scripts/run-native-halo-session.py',m.runnerSha256],
  ['scripts/run-native-regional-home.py',m.supervisorSha256],['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
 const build=await json(m.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
 assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(build.nativeSymbolsSha256,m.nativeSymbolsSha256);
 for(const r of [p.publicationArchive,p.publicationProof,p.build,...p.worlds,...m.files,...m.frames,m.actorIds,m.actorHeldRequest.crossed,m.actorHeldRequest.packet])await checked(r);
 const archive=await json(p.publicationArchive.filename);
 if(p.selectedRevision===6){assert.equal(p.homewardSessionPrepared,true);assert.equal(archive.nativeSelectedHaloHomewardOwnerQualified,true);assert.equal(archive.selectedRevision,6);assert.equal(actor.sourceClock,94550);assert.deepEqual(p.selectedOwner,{entityId:p.identity.entityId,region:'0_0',unitId:508,agentId:25});}
 else{assert.equal(p.selectedRevision,4);assert.equal(archive.journalSelectedReturnedHomeSavePublished,true);assert.equal(archive.selectedRevision,4);assert.equal(actor.sourceClock,64150);}
 for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
 for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
 assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.selectedManifest);
 assert.deepEqual(p.selectedOwner,{entityId:p.identity.entityId,region:'0_0',unitId:actor.unitId,agentId:actor.agentId});
 assert.deepEqual(p.worlds[0].entry.alias,{unitId:actor.unitId,agentId:actor.agentId});assert.deepEqual(p.worlds[0].entry.homeAlias,actor.guild);
 const ids=await readFile(m.actorIds.filename);assert.equal(ids.length,36);
 assert.deepEqual(Array.from({length:9},(_,i)=>ids.readUInt32LE(i*4)),[0x31415348,1,actor.sourceClock,actor.unitId,actor.agentId,actor.guild.unitId,actor.guild.agentId,...actor.bountyPoint]);
 assert.ok((await lstat(m.log)).size<m.logCeilingBytes);const log=await readFile(m.log,'utf8');
 assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));assert.ok(!/result=fail|abort from|SIGSEGV/.test(log));
 const crosses=[...log.matchAll(/Halo hero crossed source=(\S+) destination=(\S+) unit=(\d+) agent=(\d+) previous-clock=(\d+) clock=(\d+) previous=(-?\d+),(-?\d+),(-?\d+) accepted=(-?\d+),(-?\d+),(-?\d+) projected=(-?\d+),(-?\d+),(-?\d+) native-cells=4 samples=(\d+) changed=(\d+) original-tick=1 original-writer=1 simulation-held=1 source-retired=0 owner-published=0 result=pass/g)];
 assert.equal(crosses.length,1);const c=crosses[0],xyz=start=>Object.fromEntries(['x','y','z'].map((axis,i)=>[axis,Number(c[start+i])])),before=xyz(7),accepted=xyz(10),projected=xyz(13),clock=Number(c[6]);
 assert.equal(c[1],'0_0');assert.deepEqual(c.slice(3,5).map(Number),[actor.unitId,actor.agentId]);assert.equal(Number(c[5])+50,clock);assert.ok(clock>actor.sourceClock);
 const handoff=planHaloActorHandoff(before,accepted,c[1]);assert.equal(handoff.destinationRegion,c[2]);assert.deepEqual(handoff.destinationPose,projected);
 assert.equal(m.actorHeldRequest.destination,c[2]);assert.equal(m.actorHeldRequest.clock,clock);
 assert.equal(await readFile(m.actorHeldRequest.packet.filename,'utf8'),`halo-session-actor-hold-v1\n0\n0_0\n${actor.unitId}\n${actor.agentId}\n${clock}\n${m.actorHeldRequest.crossed.sha256}\n`);
 assert.equal([...log.matchAll(/Halo crossing held checkpoint /g)].length,1);
 assert.ok(log.includes(`Halo crossing held checkpoint clock=${clock} phase=7 original-writer=1 original-paused-ticks=1 result=pass`));
 if(m.actorMoveRequested){
  assert.ok(log.includes(`Halo session original move hero=${actor.unitId} agent=${actor.agentId} clock=${actor.sourceClock} point=4064,${Math.floor(actor.initialPose[1]/2048)} original-command=005b4870 pose-written=0 task-preserved=1 ungated-ai=1 result=pass`));
  assert.ok(!log.includes('Halo bounty created'));
 }else{
  assert.ok(log.includes(`Halo explore bounty queued key=0_0 point=${actor.bountyPoint.join(',')} reward=1000 clock=${actor.sourceClock+50}`));
  const created=[...log.matchAll(/Halo bounty created count=1 clock=(\d+) unit=(\d+) model=34415241 original-return=1/g)];assert.equal(created.length,1);assert.equal(Number(created[0][1]),actor.sourceClock+100);
  const removed=[...log.matchAll(/Halo bounty trace removed=4 sender=(\d+) receiver=(\d+) creator=(\d+) send-ticks=(\d+) retained-worlds=0 result=pass/g)];assert.equal(removed.length,1);assert.deepEqual(removed[0].slice(1,4),['1','1','1']);
 }
 function file(name){const rows=m.files.filter(r=>r.filename===join(m.profile,'Documents/My Games/MajestyHD/SaveGame',name));assert.equal(rows.length,1);return rows[0];}
 const loaded=file('Halo_Session_Reloaded_0.GMP'),crossed=file('Halo_Session_Actor_Crossed_0.GMP'),held=file('Halo_Session_Actor_Held_0.GMP');assert.deepEqual(crossed,m.actorHeldRequest.crossed);
 const reloadComparison=await equalWorlds(p.worlds[0],loaded),heldComparison=await equalWorlds(crossed,held);
 assert.equal(heldComparison.cachedTerrainShadingRebuilt,false);assert.deepEqual(heldComparison.orderContainerPermutations,[]);
 const snapshots=[loaded,crossed,held],sources=await Promise.all(snapshots.map(r=>stoppedFileSource(r.filename)));
 assert.deepEqual(await Promise.all(sources.map(checkpointSavedClock)),[actor.sourceClock,clock,clock]);
 assert.deepEqual(await pose(sources[0],actor.unitId),Object.fromEntries(['x','y','z'].map((axis,i)=>[axis,actor.initialPose[i]])));
 assert.deepEqual(await pose(sources[1],actor.unitId),accepted);assert.deepEqual(await pose(sources[2],actor.unitId),accepted);
 let sharedVertexComparisons=0;
 for(const source of sources){
  await verifyRegisteredHeroSnapshot(p.identity,p.worlds[0].entry.alias,actor.guild,source,true,'0_0');await verifyEntitySnapshot(p.identity,p.worlds[0].entry.alias,source,true,actor.guild);
  const a=await checkpointActorRecords(source,actor.unitId);assert.equal(a.unit.parentUnitId,0);assert.equal(a.agent.agentId,actor.agentId);
  const t=await checkpointTerrain(source);assert.deepEqual([t.width,t.height],[128,128]);
  for(let y=0;y<=128;y++)for(let x=0;x<=128;x++)if(haloSharedVertex(x,y)){
   const b=await source.readAt(t.heightOffset(x,y),4);assert.equal(new DataView(b.buffer,b.byteOffset,4).getUint32(0,true),nativeHeightBits(haloTerrainHeight('0_0',x,y)));sharedVertexComparisons++;}
 }
 assert.equal(sharedVertexComparisons,7440);
 assert.equal(m.deadlineSeconds,55);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.finishedAtMs-m.startedAtMs<55000);
 assert.ok(m.resourceSamples.length&&m.resourceSamples.every(r=>r.rssBytes<=m.rssCeilingBytes&&r.ownedPids.every(id=>id===m.nativePid)));
 const sourceSha256={};for(const n of ['scripts/inspect-native-halo-session-actor.mjs','scripts/lib/connected-residency.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs',
  'web/world/checkpoint.mjs','web/world/halo-region-layout.mjs','web/world/entity-home-ownership.mjs','web/world/entity-ownership.mjs','web/world/saved-clock.mjs','web/world/terrain.mjs','web/world/native-height.mjs'])sourceSha256[n]=await hash(n);
 return {version:1,nativeSelectedHeroCoreCrossingQualified:true,completeHeldWorldQualified:true,originalRewardFlagCreationQualified:!m.actorMoveRequested,originalMovementRequestQualified:!!m.actorMoveRequested,
  manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,selectedOwner:p.selectedOwner,registeredHome:p.identity.registeredHome,
  loadedCheckpoint:loaded,crossingCheckpoint:crossed,heldCheckpoint:held,sourceClock:actor.sourceClock,crossingClock:clock,
  hero:{unitId:actor.unitId,agentId:actor.agentId,previousPose:before,acceptedPose:accepted,initialScript:await script(sources[0],actor.agentId),crossingScript:await script(sources[1],actor.agentId)},
  handoff,reloadComparison,heldComparison,exactRecordComparisons:reloadComparison.records+heldComparison.records,sharedVertexComparisons,
  actorPositionOrAiEdited:false,registeredGuildPreserved:true,actualJournalUnchanged:true,nativeExitCode:0,ownedProducerAbsent:true,
  peakSampledRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),elapsedMs:m.finishedAtMs-m.startedAtMs,
  destinationActivated:false,sourceRetired:false,ownerPublished:false,browserUsed:false,sustainedBrowserMemoryQualified:false,goalComplete:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);assert.match(out,/^output\/native-halo-session-actor-\d{3}-observed\.json$/);
 await assert.rejects(lstat(out),e=>e.code==='ENOENT');const result=await inspectNativeHaloSessionActor(name);
 await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({nativeSelectedHeroCoreCrossingQualified:true,completeHeldWorldQualified:true,destination:result.handoff.destinationRegion,
  crossingClock:result.crossingClock,exactRecordComparisons:result.exactRecordComparisons,sharedVertexComparisons:result.sharedVertexComparisons}));
}
