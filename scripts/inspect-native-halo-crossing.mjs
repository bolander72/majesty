#!/usr/bin/env node
// Qualify an original accepted core crossing and its held, saved source world.
// Destination construction, collision, retirement and ownership are later gates.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointActorRecords,checkpointPlacements,checkpointAgentValues,checkpointChunks} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {haloTerrainHeight,haloSharedVertex,planHaloActorHandoff} from '../web/world/halo-region-layout.mjs';
import {nativeHeightBits} from '../web/world/native-height.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function file(row){const h=await hashNativeFile(row.filename??row.preserved,{maximum:128*1024*1024});assert.equal(h.bytes,row.bytes);assert.equal(h.sha256,row.sha256);}
async function recordEqual(a,b,ra,rb){assert.equal(ra.size,rb.size);assert.ok(ra.size<=4096);assert.deepEqual(await a.readAt(ra.offset,ra.size),await b.readAt(rb.offset,rb.size));}
async function pose(s,id){let p;for await(const v of checkpointPlacements(s))if(v.unitId===id){assert.equal(p,undefined);p=v;}assert.ok(p?.fixedPosition);assert.equal(p.requiresParentPosition,false);return p.fixedPosition;}
async function script(s,id){let names;for await(const v of checkpointAgentValues(s,id))if(v.attribute.toLowerCase()==='activescript'&&!v.path.length){assert.equal(names,undefined);assert.equal(v.type,8);names=v.functions.map(f=>f.name);}assert.ok(names);return names;}
async function rng(s){const out={};for await(const c of checkpointChunks(s)){
 if(c.tag==='GPL '){assert.equal(out.gpl,undefined);const b=await s.readAt(c.offset+16,12);out.gpl=new DataView(b.buffer,b.byteOffset,b.length).getUint32(8,true);}
 if(c.tag==='SVGD'){assert.equal(out.game,undefined);assert.ok(c.size<=1024);const b=await s.readAt(c.offset+16,c.size),i=b.indexOf(0,b.indexOf(0)+1);assert.ok(i>0&&i+33<=b.length);out.game=new DataView(b.buffer,b.byteOffset,b.length).getUint32(i+29,true);}
 }assert.ok(out.game&&out.gpl);return out;}
export async function inspectNativeHaloCrossing(name){
 const m=await json(name);
 for(const k of ['nativeOnly','nativeSessionTerminal','ownedProducerAbsent','haloReloadTrialCompleted','privateNativeExecutableUnchanged','sourceCheckpointUnchanged','layoutMetadataUnchanged','observedCrossing','exploreBounty'])assert.equal(m[k],true);
 for(const k of ['browserUsed','freshWorld','ownerPublished','heroCrossingQualified','goalComplete'])assert.equal(m[k],false);
 assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);assert.equal(m.nativeProcessesStarted,1);assert.equal(m.sourceClockMs,58850);assert.equal(m.region,'0_0');assert.equal(m.layout,'halo-v1');
 const {stdout}=await promisify(execFile)('ps',['-axo','pid=,comm='],{maxBuffer:1024*1024});assert.ok(!stdout.split('\n').some(l=>Number(l.trim().split(/\s+/,1)[0])===m.nativePid));
 await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-');assert.equal(m.profile,join(m.fixture,'frontier_0_0'));
 assert.equal(await hash(m.archive),m.archiveSha256);const archive=await json(m.archive);assert.equal(archive.generation,225);assert.equal(archive.naturalHeroGuildDepartureQualified,true);
 for(const r of [...archive.sources,...archive.evidence])await file(r);
 await file(m.sourceProof);const previous=await json(m.sourceProof.preserved);assert.equal(previous.naturalOriginalHeroGuildDepartureQualified,true);assert.deepEqual(previous.registeredHome,m.registeredHome);assert.equal(m.sourceCheckpoint.sha256,previous.evolvedCheckpoint.sha256);await file(m.originalSource);
 assert.equal(await hash(m.buildReport),m.buildReportSha256);const build=await json(m.buildReport),compiled={};assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
 for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])for(const[n,h]of Object.entries(build[group])){assert.equal(compiled[n],undefined);compiled[n]=h;}
 assert.equal(Object.keys(compiled).length,53);assert.deepEqual(m.compiledSourceSha256,compiled);for(const[n,h]of Object.entries(compiled))assert.equal(await hash(join(workspace,n)),h);
 assert.equal(m.nativeExecutableSha256,build.nativeExecutableSha256);assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
 for(const[n,h]of [[m.script,m.scriptSha256],[m.log,m.logSha256],['scripts/run-native-halo-reload.py',m.runnerSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
 assert.equal(await readFile(m.script,'utf8'),'wait 12000\ndump halo_motion_visible\nmove 400 300\nwait 18000\naction frontier-checkpoint\nwait 2000\ndump halo_motion_final\n');
 assert.deepEqual(m.preservedBefore,m.preservedAfter);for(const[n,s]of Object.entries(m.preservedBefore)){if(s===null){await assert.rejects(stat(n),e=>e.code==='ENOENT');continue;}const t=await stat(n,{bigint:true});assert.equal(await hash(n),s.sha256);assert.equal(Number(t.size),s.bytes);assert.equal(Number(t.ino),s.inode);assert.equal(Number(t.mtimeNs),s.mtimeNs);}
 const home=m.registeredHome;assert.equal(home.members.length,1);const member=home.members[0];assert.equal(member.unitId,481);assert.equal(member.agentId,17);
 await file(m.layoutMetadata);assert.equal(await readFile(m.layoutMetadata.filename,'utf8'),['majesty-halo-reload-v1','halo-v1',m.region,String(m.sourceCheckpoint.bytes),m.sourceCheckpoint.sha256,home.worldId,member.entityId,home.guildEntityId,m.sourceProducerNativeExecutableSha256,''].join('\n'));
 const names={sourceCheckpoint:'Frontier_0_0.GMP',loadedCheckpoint:'Halo_Region_Reloaded.GMP',crossingCheckpoint:'Halo_Hero_Crossed.GMP',heldCheckpoint:'Halo_Hero_Held.GMP'};
 for(const[k,n]of Object.entries(names)){assert.equal(m[k].filename,join(m.profile,'Documents/My Games/MajestyHD/SaveGame',n));await file(m[k]);}
 await file(m.finalMarker);await file(m.initialMarker);assert.equal(m.finalMarker.sha256,m.initialMarker.sha256);assert.equal(await readFile(m.finalMarker.filename,'utf8'),`checkpoint-v1\n0\n${m.sourceCheckpoint.bytes}\n${m.sourceCheckpoint.sha256}\n654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:${m.nativeExecutableSha256}\n`);
 assert.ok((await stat(m.log)).size<=m.logCeilingBytes);const log=await readFile(m.log,'utf8');assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));assert.ok(!/result=fail|abort from|SIGSEGV|bad conversion/.test(log));
 assert.ok(log.includes(`[frontier] Halo restore ready key=0_0 layout=halo-v1 clock=58850 shared-vertices=2480 ui-restored=1 rng-restored=1 original-reader=1 original-writer=1 source-sha256=${m.sourceCheckpoint.sha256} result=pass`));
 assert.ok(log.includes('Halo explore bounty queued key=0_0 point=3072,32 reward=1000 clock=58900 batch-before=0 batch-after=1 original-ui-helper=0043ef50 original-message=004a7960 original-send=005a45c0 hero-ai-edited=0 result=pass'));
 const cross=[...log.matchAll(/Halo hero crossed source=0_0 destination=(\S+) unit=481 agent=17 previous-clock=(\d+) clock=(\d+) previous=(-?\d+),(-?\d+),(-?\d+) accepted=(-?\d+),(-?\d+),(-?\d+) projected=(-?\d+),(-?\d+),(-?\d+) native-cells=4 samples=(\d+) changed=(\d+) original-tick=1 original-writer=1 simulation-held=1 source-retired=0 owner-published=0 result=pass/g)];assert.equal(cross.length,1);
 const c=cross[0],xyz=start=>Object.fromEntries(['x','y','z'].map((axis,i)=>[axis,Number(c[start+i])])),before=xyz(4),accepted=xyz(7),projected=xyz(10),crossingClock=Number(c[3]);
 assert.equal(Number(c[2])+50,crossingClock);const handoff=planHaloActorHandoff(before,accepted,m.region);assert.equal(handoff.destinationRegion,c[1]);assert.deepEqual(handoff.destinationPose,projected);
 assert.ok(log.includes(`[frontier] Halo crossing held checkpoint clock=${crossingClock} phase=7 original-writer=1 original-paused-ticks=1 result=pass`));
 const trace=[...log.matchAll(/Halo bounty trace removed=4 sender=(\d+) receiver=(\d+) creator=(\d+) send-ticks=(\d+) retained-worlds=0 result=pass/g)];assert.equal(trace.length,1);assert.deepEqual(trace[0].slice(1,4),['1','1','1']);assert.equal(Number(trace[0][4]),Number(c[13]));
 const created=[...log.matchAll(/Halo bounty created count=1 clock=(\d+) unit=(\d+) model=34415241 original-return=1/g)];assert.equal(created.length,1);assert.equal(Number(created[0][1]),58950);const flagId=Number(created[0][2]);
 const sources=await Promise.all(Object.keys(names).map(k=>stoppedFileSource(m[k].filename))),clocks=await Promise.all(sources.map(checkpointSavedClock));assert.deepEqual(clocks,[58850,58850,crossingClock,crossingClock]);assert.deepEqual(await rng(sources[0]),await rng(sources[1]));
 const actors=await Promise.all(sources.map(s=>checkpointActorRecords(s,481)));for(const a of actors){assert.equal(a.agent.agentId,17);assert.equal(a.unit.description,827086401);assert.equal(a.unit.playerNumber,0);assert.equal(a.unit.parentUnitId,0);assert.equal(a.unit.stateFlags&4,0);}
 for(const kind of ['unit','agent']){await recordEqual(sources[0],sources[1],actors[0][kind],actors[1][kind]);await recordEqual(sources[2],sources[3],actors[2][kind],actors[3][kind]);}
 const guilds=await Promise.all(sources.slice(0,2).map(s=>checkpointActorRecords(s,469)));for(const kind of ['unit','agent'])await recordEqual(sources[0],sources[1],guilds[0][kind],guilds[1][kind]);
 const identity={entityId:member.entityId,contentDigest:home.contentDigest,regions:[m.region],actor:{family:'VHCL',playerNumber:0},registeredHome:home};for(const s of sources)await verifyRegisteredHeroSnapshot(identity,{unitId:481,agentId:17},{kind:'native',unitId:469,agentId:7},s,true,m.region);
 assert.deepEqual(await pose(sources[2],481),accepted);assert.deepEqual(await pose(sources[3],481),accepted);assert.deepEqual(await script(sources[0],17),['travel_to_exp']);const crossingScript=await script(sources[2],17);assert.ok(crossingScript.length);
 const flag=await checkpointActorRecords(sources[2],flagId);assert.equal(flag.unit.family,'RWRD');assert.equal(flag.unit.description,876696129);assert.equal(flag.unit.playerNumber,0);assert.equal(flag.unit.parentUnitId,0);const flagPose=await pose(sources[2],flagId);assert.equal(flagPose.x,3072*2048);assert.equal(flagPose.y,32*2048);
 const terrain=await Promise.all(sources.map(checkpointTerrain));for(const t of terrain){assert.equal(t.width,128);assert.equal(t.height,128);}let shared=0;
 for(let y=0;y<=128;++y){const rows=await Promise.all(sources.map((s,i)=>s.readAt(terrain[i].heightOffset(0,y),1161)));for(let x=0;x<=128;++x){const values=rows.map(row=>new DataView(row.buffer,row.byteOffset,row.length).getUint32(x*9,true));assert.equal(values[0],values[1]);if(haloSharedVertex(x,y)){const expected=nativeHeightBits(haloTerrainHeight(m.region,x,y));for(const v of values)assert.equal(v,expected);++shared;}}}assert.equal(shared,2480);
 assert.equal(m.frames.length,2);for(const f of m.frames)await file(f);assert.equal(m.deadlineSeconds,55);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.finishedAtMs-m.startedAtMs<=55000);assert.ok(m.resourceSamples.length&&m.resourceSamples.every(s=>s.rssBytes<=m.rssCeilingBytes&&s.ownedPids.every(p=>p===m.nativePid)));
 const verifierSourceSha256=Object.fromEntries(await Promise.all(['scripts/inspect-native-halo-crossing.mjs','scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs','web/world/terrain.mjs','web/world/halo-region-layout.mjs','web/world/native-height.mjs','web/world/entity-home-ownership.mjs','web/world/reward-membership.mjs','web/world/hero-home.mjs'].map(async n=>[n,await hash(n)])));
 return {version:1,nativeOriginalActorCoreCrossingQualified:true,originalRewardFlagCreationQualified:true,simulationHeldAtSavedCrossingQualified:true,manifest:resolve(name),manifestSha256:await hash(name),sourceCheckpoint:m.sourceCheckpoint,loadedCheckpoint:m.loadedCheckpoint,crossingCheckpoint:m.crossingCheckpoint,heldCheckpoint:m.heldCheckpoint,registeredHome:home,clocks,hero:{unitId:481,agentId:17,previousPose:before,acceptedPose:accepted,activeScript:crossingScript},handoff,flag:{unitId:flagId,agentId:flag.agent.agentId,description:flag.unit.description,fixedPosition:flagPose},heroRecordsExactBeforeTicks:true,heroRecordsExactWhileHeld:true,registeredGuildMembershipPreserved:true,originalRewardMembershipPreserved:true,savedRngExactBeforeTicks:true,allSavedHeightsExactBeforeTicks:true,sharedVertices:shared,nativeExitCode:0,ownedProducerAbsent:true,peakSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),elapsedMs:m.finishedAtMs-m.startedAtMs,inspectorSha256:await hash('scripts/inspect-native-halo-crossing.mjs'),verifierSourceSha256,maximumReadBytes:4096,destinationImportQualified:false,destinationCollisionQualified:false,sourceRetired:false,ownershipTransferQualified:false,browserUsed:false,goalComplete:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const[name,output]=process.argv.slice(2);assert.equal(process.argv.length,4);const result=await inspectNativeHaloCrossing(name);await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({nativeOriginalActorCoreCrossingQualified:true,originalRewardFlagCreationQualified:true,simulationHeldAtSavedCrossingQualified:true,clocks:result.clocks,destination:result.handoff.destinationRegion,elapsedMs:result.elapsedMs}));
}
