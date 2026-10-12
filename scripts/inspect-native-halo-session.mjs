#!/usr/bin/env node
// Independently compare original full-world saves across the stopped session.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointActorRecords} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {haloTerrainHeight,haloSharedVertex} from '../web/world/halo-region-layout.mjs';
import {nativeHeightBits} from '../web/world/native-height.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
const [manifestName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outputName,/^output\/native-halo-session-\d{3}-observed\.json$/);await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const m=await json(manifestName),p=await json(m.preparation);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
assert.equal(m.stopReason,null);assert.equal(m.haloSessionTrialCompleted,true);assert.equal(m.browserUsed,false);
assert.equal(m.heroTransferred,false);assert.equal(m.ownerPublished,false);assert.equal(m.nativeProcessesStarted,1);
try{process.kill(m.nativePid,0);throw Error('Session producer still live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.journalBefore,p.journalSha256);
assert.equal(m.privateNativeExecutableUnchanged,true);assert.equal(m.sessionLayoutUnchanged,true);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);assert.deepEqual(m.compiledSourceSha256,p.compiledSourceSha256);
for(const[n,h]of [[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],[m.privateNativeExecutable,m.nativeExecutableSha256],
 [m.log,m.logSha256],[m.script,m.scriptSha256],['scripts/run-native-halo-session.py',m.runnerSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],
 ['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
const build=await json(m.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(build.nativeSymbolsSha256,m.nativeSymbolsSha256);
for(const r of [p.publicationArchive,p.publicationProof,p.build,...p.worlds])assert.equal(await hash(r.filename),r.sha256);
const archive=await json(p.publicationArchive.filename);assert.equal(archive.journalSelectedReturnedHomeSavePublished,true);assert.equal(archive.selectedRevision,4);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.selectedManifest);
assert.ok((await lstat(m.log)).size<4*1024*1024);const log=await readFile(m.log,'utf8');
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));assert.ok(!/result=fail|abort from/.test(log));
const match=re=>[...log.matchAll(re)];
const attached=match(/^\[frontier\] Session attached serial=(\d+) region=(\S+) mode=(\S+) phase=1 pending=2$/gm);
assert.deepEqual(attached.map(r=>r.slice(1)),[['1','0_-1','saved'],['2','0_0','saved'],['3','1_0','new'],['4','0_0','saved']]);
const departures=match(/^\[frontier\] Session checkpoint serial=(\d+) region=(\S+) clock=(\d+) direction=(\d+)$/gm);
assert.deepEqual(departures.map(r=>[r[1],r[2],r[4]]),[['1','0_0','1'],['2','0_-1','2'],['3','0_0','3'],['4','1_0','0']]);
const releases=match(/^\[frontier\] Session released serial=(\d+) region=(\S+) roots-freed=([^ ]+) terrain-bytes=(\d+) spatial-bytes=(\d+) heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) clock=0$/gm);
assert.deepEqual(releases.map(r=>r.slice(1,6)),departures.map(r=>[r[1],r[2],'1,1,1,1,1,1,1,1','530456','524288']));
const removals=match(/^\[frontier\] Session release observer removed serial=(\d+) hooks=(\d+) retained-roots=0$/gm);
assert.deepEqual(removals.map(r=>r[1]),['1','2','3','4']);assert.equal(new Set(removals.map(r=>r[2])).size,1);
const restores=match(/^\[frontier\] Halo restore ready key=(\S+) layout=halo-v1 clock=(\d+) shared-vertices=2480 ui-restored=1 rng-restored=1 original-reader=1 original-writer=1 source-sha256=([0-9a-f]{64}) result=pass$/gm);
assert.deepEqual(restores.map(r=>r[1]),['0_0','0_-1','0_0','0_0']);assert.deepEqual(restores.slice(0,2).map(r=>Number(r[2])),[64150,1500]);
const clear=match(/^\[frontier\] Halo session saved names cleared entries=(\d+) original-destroy=004373e0 world-null=1 result=pass$/gm);
assert.deepEqual(clear.map(r=>Number(r[1])),[0,1,1,1]);
const requests=match(/^\[frontier\] Halo session named request sequence=(\d+) serial=(\d+) region=(\S+) direction=(\d+) queued=1$/gm);
assert.deepEqual(requests.map(r=>r.slice(1)),[['1','0','0_0','1'],['2','0','0_0','1'],['3','1','0_-1','2'],['4','2','0_0','3'],['5','3','1_0','0'],['6','4','0_0','4']]);
assert.equal(m.namedRequests.length,6);for(const r of m.namedRequests)assert.equal(await hash(r.packet.filename),r.packet.sha256);
const refusals=match(/^\[frontier\] Session destination refused source=(\S+) target=(\S+)$/gm);assert.deepEqual(refusals.map(r=>r.slice(1)),[['0_0','0_-1']]);
assert.ok(refusals[0].index<departures[0].index&&m.northLayoutRepair.afterRefusal&&m.northLayoutRepair.beforeCheckpoint);
assert.equal(m.northLayoutRepair.layout.sha256,m.initialWorlds[1].layout.sha256);
for(const r of m.files){assert.equal(await hash(r.filename),r.sha256);assert.equal((await lstat(r.filename)).size,r.bytes);}
function file(key,name){const filename=join(m.root,`frontier_${key}`,name.endsWith('.GMP')?'Documents/My Games/MajestyHD/SaveGame':'',name);
 const rows=m.files.filter(r=>r.filename===filename);assert.equal(rows.length,1,filename);return rows[0];}
const visits=[file('0_0','Halo_Session_Reloaded_0.GMP'),file('0_-1','Halo_Session_Reloaded_1.GMP'),file('0_0','Halo_Session_Reloaded_2.GMP'),file('1_0','Halo_Session_Generated_3.GMP'),file('0_0','Halo_Session_Reloaded_4.GMP')];
const leaving=departures.map((r,i)=>file(r[2],`Halo_Session_Departed_${i}.GMP`));
async function records(source){const rows=new Map();const add=(k,r)=>{assert.ok(!rows.has(k)&&rows.size<4096);rows.set(k,r);};
 for await(const r of checkpointUnits(source))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(source))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(source))add(r.kind+':'+r.unitId,r);return rows;}
let exactRecordComparisons=0;const comparisons=[];
for(const [i,a]of [[0,p.worlds[0]],[1,p.worlds[1]],[2,leaving[0]],[4,leaving[2]]]){
 const before=await stoppedFileSource(a.filename),after=await stoppedFileSource(visits[i].filename),am=await records(before),bm=await records(after);
 assert.deepEqual([...bm.keys()].sort(),[...am.keys()].sort());
 for(const[k,r]of am){const t=bm.get(k);assert.equal(t.size,r.size,k);
  for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await after.readAt(t.offset+at,n),await before.readAt(r.offset+at,n),k);}
  exactRecordComparisons++;}
 // The frozen northern home proxy53 is intentionally dormant and has never
 // joined an AI queue. Preserve exactly that exception in both snapshots.
 const options=i===1?{unscheduledAgents:[53]}:{};
 const result=compareConnectedWorlds(await connectedWorldState(a.filename,options),await connectedWorldState(visits[i].filename,options));
 comparisons.push({visit:i,region:m.route[i],records:am.size,clock:await checkpointSavedClock(after),...result});
}
assert.equal(await checkpointSavedClock(await stoppedFileSource(visits[3].filename)),0);
for(const [i,r]of leaving.entries())assert.equal(await checkpointSavedClock(await stoppedFileSource(r.filename)),Number(departures[i][3]));
assert.ok(Number(departures[0][3])>64150&&Number(departures[1][3])>1500&&Number(departures[2][3])>Number(departures[0][3])&&Number(departures[3][3])>0);
let sharedVertexComparisons=0;
for(const [i,r]of visits.entries()){
 const source=await stoppedFileSource(r.filename),terrain=await checkpointTerrain(source);assert.deepEqual([terrain.width,terrain.height],[128,128]);
 for(let y=0;y<=128;y++)for(let x=0;x<=128;x++)if(haloSharedVertex(x,y)){
  const b=await source.readAt(terrain.heightOffset(x,y),4);assert.equal(new DataView(b.buffer,b.byteOffset,4).getUint32(0,true),nativeHeightBits(haloTerrainHeight(m.route[i],x,y)));sharedVertexComparisons++;}
 if(m.route[i]==='0_0'){
  await verifyRegisteredHeroSnapshot(p.identity,p.worlds[0].entry.alias,p.worlds[0].entry.homeAlias,source,true,'0_0');
  await verifyEntitySnapshot(p.identity,p.worlds[0].entry.alias,source,true,p.worlds[0].entry.homeAlias);
 }else if(i===1){await verifyRegisteredHeroSnapshot(p.identity,p.worlds[1].entry.alias,p.worlds[1].entry.homeAlias,source,false,'0_-1');}
}
assert.equal(sharedVertexComparisons,12400);
const finalSlots=[];
for(const key of ['0_0','0_-1','1_0']){
 const marker=await readFile(file(key,`Frontier_${key}.checkpoint`).filename,'utf8'),lines=marker.split('\n');assert.equal(lines.length,6);
 assert.equal(lines[0],'checkpoint-v1');assert.ok(['0','1'].includes(lines[1]));assert.equal(lines[4],homeContent());
 const selected=file(key,`Frontier_${key}${lines[1]==='1'?'_Recovery':''}.GMP`);assert.equal(selected.bytes,Number(lines[2]));assert.equal(selected.sha256,lines[3]);
 const layout=await readFile(file(key,'Halo_Restore.layout').filename,'utf8');const reg=p.identity.registeredHome;
 assert.equal(layout,['majesty-halo-reload-v1','halo-v1',key,String(selected.bytes),selected.sha256,reg.worldId,p.identity.entityId,reg.guildEntityId,p.settingsProducerExecutableSha256,''].join('\n'));
 finalSlots.push({region:key,selected,clock:await checkpointSavedClock(await stoppedFileSource(selected.filename))});
}
function homeContent(){return '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256;}
assert.equal(m.files.filter(r=>/^Frontier_.*\.GMP$/.test(basename(r.filename))).length,6);
assert.equal(m.frames.length,1);for(const r of m.frames){assert.equal(r.bytes,1440015);assert.equal(await hash(r.filename),r.sha256);}
assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.finishedAtMs-m.startedAtMs<37000);
const peak=Math.max(...m.resourceSamples.map(r=>r.rssBytes));assert.ok(peak<=m.rssCeilingBytes);
const sourceSha256={};for(const n of ['scripts/inspect-native-halo-session.mjs','scripts/lib/connected-residency.mjs','scripts/lib/native-generation.mjs',
 'scripts/lib/stopped-entity-io.mjs','scripts/check-native-world-persistence.mjs','scripts/check-native-repeat-return.mjs','web/world/checkpoint.mjs',
 'web/world/entity-home-ownership.mjs','web/world/entity-ownership.mjs','web/world/saved-clock.mjs','web/world/terrain.mjs','web/world/halo-region-layout.mjs','web/world/native-height.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeHaloSessionQualified:true,manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,
 route:m.route,visits:5,originalDisposals:4,freedRootsPerDisposal:8,layoutIdentityRefusals:1,exactRecordComparisons,sharedVertexComparisons,
 comparisons,finalSlots,retainedCheckpointSlots:6,maximumSlotsPerRegion:2,originalPlayerNameCleanup:true,sourceJournalUnchanged:true,servedArtifactsUnchanged:true,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeRssBytes:peak,releaseHeaps:releases.map(r=>({serial:Number(r[1]),region:r[2],before:Number(r[6]),after:Number(r[7])})),
 nativeSessionTerminal:true,nativeExitCode:0,heroTransferred:false,ownerPublished:false,browserUsed:false,
 continuousCameraCrossingQualified:false,cooperativeRegionalOwnershipQualified:false,sustainedBrowserMemoryQualified:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHaloSessionQualified:true,visits:5,originalDisposals:4,exactRecordComparisons,sharedVertexComparisons}));
