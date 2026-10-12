#!/usr/bin/env node
// Verify actual returned-home state across repeated paging in one native process.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
const [manifestName,outName,mode]=process.argv.slice(2);const pointer=mode==='--pointer-paging';
assert.equal(process.argv.length,pointer?5:4);assert.ok(mode===undefined||pointer);
assert.match(outName,pointer?/^output\/native-halo-pointer-session-\d{3}-observed\.json$/:/^output\/native-halo-homeward-session-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const m=await json(manifestName),p=await json(m.preparation);
assert.equal(pointer?m.haloPointerSessionTrialCompleted:m.haloHomewardSessionTrialCompleted,true);assert.equal(m.mode,pointer?'pointer-region-paging':'homeward-region-paging');
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
assert.equal(m.stopReason,null);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);assert.equal(m.heroTransferred,false);
const route=pointer?['0_0','1_0','0_0']:['0_0','1_0','0_0','1_0','0_0'],trips=route.length-1;
assert.equal(m.nativeProcessesStarted,1);assert.deepEqual(m.route,route);
try{process.kill(m.nativePid,0);throw Error('Native producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.deepEqual(m.journalBefore,m.journalAfter);assert.deepEqual(m.journalBefore,p.journalSha256);
assert.equal(m.privateNativeExecutableUnchanged,true);assert.equal(m.sessionLayoutUnchanged,true);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);assert.deepEqual(m.compiledSourceSha256,p.compiledSourceSha256);
for(const[n,h]of Object.entries({...m.compiledSourceSha256,...p.sourceSha256}))assert.equal(await hash(n),h);
for(const[n,h]of [[m.preparation,m.preparationSha256],[m.buildReport,m.buildReportSha256],[m.privateNativeExecutable,m.nativeExecutableSha256],
 [m.log,m.logSha256],[m.script,m.scriptSha256],['scripts/run-native-halo-session.py',m.runnerSha256],
 ['scripts/run-native-regional-home.py',m.supervisorSha256],['scripts/lib/native_pair_guard.py',m.guardSha256]])assert.equal(await hash(n),h);
for(const r of [p.publicationArchive,p.publicationProof,p.build,...p.worlds,m.sessionLayout,...m.files,...m.frames]){
 assert.equal(await hash(r.filename),r.sha256);if(r.bytes!==undefined)assert.equal((await lstat(r.filename)).size,r.bytes);}
const archive=await json(p.publicationArchive.filename);assert.equal(archive.nativeSelectedHaloHomewardOwnerQualified,true);assert.equal(archive.selectedRevision,6);
for(const row of archive.sources.concat(archive.evidence))assert.equal(await hash(row.preserved),row.sha256);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
assert.equal(await readFile(join(p.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),p.selectedManifest);
assert.ok((await lstat(m.log)).size<4*1024*1024);const log=await readFile(m.log,'utf8');
assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
assert.ok(!/result=fail|abort from|Session fallback|Session destination refused/.test(log));
const matches=re=>[...log.matchAll(re)];
const attached=matches(/^\[frontier\] Session attached serial=(\d+) region=(\S+) mode=(\S+) phase=1 pending=2$/gm);
assert.deepEqual(attached.map(r=>r.slice(1)),route.slice(1).map((key,i)=>[String(i+1),key,'saved']));
const departures=matches(/^\[frontier\] Session checkpoint serial=(\d+) region=(\S+) clock=(\d+) direction=(\d+)$/gm);
assert.deepEqual(departures.map(r=>[r[1],r[2],r[4]]),route.slice(0,-1).map((key,i)=>[String(i+1),key,i%2?'0':'3']));
const releases=matches(/^\[frontier\] Session released serial=(\d+) region=(\S+) roots-freed=([^ ]+) terrain-bytes=(\d+) spatial-bytes=(\d+) heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) clock=0$/gm);
assert.deepEqual(releases.map(r=>r.slice(1,6)),departures.map(r=>[r[1],r[2],'1,1,1,1,1,1,1,1','530456','524288']));
for(const r of releases){assert.ok(Number(r[6])>Number(r[7]));assert.ok(Number(r[8])>Number(r[9]));}
const removed=matches(/^\[frontier\] Session release observer removed serial=(\d+) hooks=(\d+) retained-roots=0$/gm);
assert.deepEqual(removed.map(r=>r[1]),Array.from({length:trips},(_,i)=>String(i+1)));assert.equal(new Set(removed.map(r=>r[2])).size,1);
const restores=matches(/^\[frontier\] Halo restore ready key=(\S+) layout=halo-v1 clock=(\d+) shared-vertices=2480 ui-restored=1 rng-restored=1 original-reader=1 original-writer=1 source-sha256=([0-9a-f]{64}) result=pass$/gm);
assert.deepEqual(restores.map(r=>r[1]),m.route);assert.deepEqual(restores.slice(0,2).map(r=>Number(r[2])),[94550,3750]);
assert.equal(m.namedRequests.length,trips);
assert.deepEqual(m.namedRequests.map(r=>[r.serial,r.region,r.direction]),route.slice(0,-1).map((key,i)=>[i,key,i%2?0:3]));
for(const r of m.namedRequests)assert.equal(await hash(r.packet.filename),r.packet.sha256);
function file(key,name){const filename=join(m.root,`frontier_${key}`,name.endsWith('.GMP')?'Documents/My Games/MajestyHD/SaveGame':'',name);
 const rows=m.files.filter(r=>r.filename===filename);assert.equal(rows.length,1,filename);return rows[0];}
const visits=m.route.map((key,i)=>file(key,`Halo_Session_Reloaded_${i}.GMP`));
const leaving=departures.map((r,i)=>file(r[2],`Halo_Session_Departed_${i}.GMP`));
async function records(s){const map=new Map(),add=(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,row);};
 for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return map;}
const comparisons=[];let exactRecordComparisons=0;
for(const[i,a]of route.map((key,i)=>[i,i<2?p.worlds[i]:leaving[i-2]])){
 const before=await stoppedFileSource(a.filename),after=await stoppedFileSource(visits[i].filename),am=await records(before),bm=await records(after);
 assert.deepEqual([...bm.keys()].sort(),[...am.keys()].sort());
 for(const[key,r]of am){const t=bm.get(key);assert.equal(t.size,r.size,key);
  for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await after.readAt(t.offset+at,n),await before.readAt(r.offset+at,n),key);}
  ++exactRecordComparisons;}
 const options=m.route[i]==='1_0'?{unscheduledAgents:[34]}:{};
 comparisons.push({visit:i,region:m.route[i],records:am.size,clock:await checkpointSavedClock(after),
  ...compareConnectedWorlds(await connectedWorldState(a.filename,options),await connectedWorldState(visits[i].filename,options))});
}
const homePoses=[];
for(let i=0;i<visits.length;++i){const s=await stoppedFileSource(visits[i].filename),entry=p.worlds[i%2].entry;
 await verifyRegisteredHeroSnapshot(p.identity,entry.alias,entry.homeAlias,s,i%2===0,m.route[i]);
 await verifyEntitySnapshot(p.identity,entry.alias,s,i%2===0,entry.homeAlias);
 if(i%2===0){const map=await records(s),u=map.get('UNIT:508');assert.ok(u&&!map.has('UNIT:496')&&!map.has('GPL:22'));
  const b=Buffer.from(await s.readAt(u.offset+60,12));homePoses.push([0,4,8].map(at=>b.readInt32LE(at)));}
}
for(let i=1;i<homePoses.length;++i)assert.notDeepEqual(homePoses[i-1],homePoses[i]);
for(const[i,r]of leaving.entries()){
 const clock=await checkpointSavedClock(await stoppedFileSource(r.filename));assert.equal(clock,Number(departures[i][3]));
 assert.ok(clock>comparisons[i].clock);
}
const finalSlots=[];
for(const key of ['0_0','1_0']){
 const lines=(await readFile(file(key,`Frontier_${key}.checkpoint`).filename,'utf8')).split('\n');
 assert.equal(lines.length,6);assert.equal(lines[0],'checkpoint-v1');assert.ok(['0','1'].includes(lines[1]));
 assert.equal(lines[4],`654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:${m.nativeExecutableSha256}`);
 const selected=file(key,`Frontier_${key}${lines[1]==='1'?'_Recovery':''}.GMP`);
 assert.equal(selected.bytes,Number(lines[2]));assert.equal(selected.sha256,lines[3]);
 const reg=p.identity.registeredHome;
 assert.equal(await readFile(file(key,'Halo_Restore.layout').filename,'utf8'),['majesty-halo-reload-v1','halo-v1',key,String(selected.bytes),selected.sha256,reg.worldId,p.identity.entityId,reg.guildEntityId,p.settingsProducerExecutableSha256,''].join('\n'));
 finalSlots.push({region:key,selected,clock:await checkpointSavedClock(await stoppedFileSource(selected.filename))});
}
assert.equal(m.files.filter(r=>/^Frontier_.*\.GMP$/.test(basename(r.filename))).length,4);
assert.equal(m.frames.length,1);assert.equal(m.frames[0].bytes,1440015);
assert.equal(m.deadlineSeconds,55);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
assert.ok(m.finishedAtMs-m.startedAtMs<57000&&m.resourceSamples.length);
const peak=Math.max(...m.resourceSamples.map(s=>s.rssBytes));assert.ok(peak<=m.rssCeilingBytes);
const sourceSha256={...p.sourceSha256};for(const n of ['scripts/inspect-native-halo-homeward-session.mjs','scripts/lib/connected-residency.mjs',
 'scripts/check-native-world-persistence.mjs','scripts/check-native-repeat-return.mjs'])sourceSha256[n]=await hash(n);
let pointerEvidence=null;
if(pointer){
 for(const[n,h]of Object.entries(m.pointerBridgeSourceSha256)){assert.equal(await hash(n),h);sourceSha256[n]=h;}
 const boundaries=matches(/^\[frontier\] Session boundary serial=(\d+) region=(\S+) direction=(\S+) gesture=(\d+) x=(\d+) y=(\d+) max-x=(\d+) max-y=(\d+) dx=(-?\d+) dy=(-?\d+) held-ms=(\d+)$/gm).filter(r=>Number(r[1])<2);
 assert.equal(boundaries.length,2);const arrivals=matches(/^\[frontier\] Session camera arrived serial=(\d+) region=(\S+) direction=(\d+) x=(\d+) y=(\d+) max-x=(\d+) max-y=(\d+) source-x=(\d+) source-y=(\d+) clock=(\d+)$/gm);
 assert.equal(arrivals.length,2);const actions=[];
 for(let i=0;i<2;++i){const b=boundaries[i],a=arrivals[i];
  assert.deepEqual(b.slice(1,4),[String(i),route[i],i?'west':'east']);assert.equal(Number(b[5]),i?0:Number(b[7]));
  assert.ok(i?Number(b[9])<0:Number(b[9])>0);assert.equal(Number(b[10]),0);assert.ok(Number(b[11])>=1000);
  assert.deepEqual(a.slice(1,4),[String(i+1),route[i+1],i?'0':'3']);assert.equal(Number(a[4]),i?Number(a[6]):0);
  assert.equal(Number(a[5]),Math.min(Number(a[7]),Number(b[6])));assert.deepEqual(a.slice(8,10),b.slice(5,7));
  assert.equal(Number(a[10]),comparisons[i+1].clock);
  const named=log.indexOf(`[frontier] Halo session named request sequence=${i+1} serial=${i} region=${route[i]} direction=${i?0:3} queued=1`);
  assert.ok(b.index<named&&named<departures[i].index);
  actions.push({serial:i,region:route[i],direction:i?0:3,gesture:Number(b[4])});
 }
 assert.deepEqual(m.pointerBoundaryActions,actions);
 assert.ok((await readFile(m.script,'utf8')).includes('move 799 300')&&(await readFile(m.script,'utf8')).includes('move 1 300'));
 pointerEvidence={productionSessionControlsUsed:true,boundaries:boundaries.map(r=>r[0]),arrivals:arrivals.map(r=>r[0]),actions,
  originalScrollIntentObserved:true,originalCameraClampObserved:true,originalOppositeEdgeArrivalQualified:true,orthogonalPositionPreserved:true};
}
const report={version:1,nativeHomewardRegionPagingQualified:!pointer,nativePointerDrivenRegionPagingQualified:pointer,
 scope:pointer?'Two real pointer/scroll boundary trips, three saved-region visits and original camera arrival in one native process through the production JS session controls. Browser UI and hero transfer remain separate.':'Five saved-region visits and four original world disposals in one native process. Hero stays in its saved home as the camera pages away; no hero transfer or browser/internet qualification.',
 manifest:resolve(manifestName),manifestSha256:await hash(manifestName),sourceSha256,route:m.route,visits:route.length,originalDisposals:trips,pointerEvidence,
 freedRootsPerDisposal:8,exactRecordComparisons,comparisons,homePoses,finalSlots,retainedCheckpointSlots:4,maximumSlotsPerRegion:2,
 originalHomeHeroContinued:true,sourceJournalUnchanged:true,servedArtifactsUnchanged:true,
 releaseHeaps:releases.map(r=>({serial:Number(r[1]),region:r[2],before:Number(r[6]),after:Number(r[7]),blocksBefore:Number(r[8]),blocksAfter:Number(r[9])})),
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeRssBytes:peak,nativeSessionTerminal:true,nativeExitCode:0,
 selectedRevision:6,heroTransferred:false,ownerPublished:false,browserUsed:false,continuousCameraCrossingQualified:false,
 cooperativeRegionalOwnershipQualified:false,sustainedBrowserMemoryQualified:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHomewardRegionPagingQualified:!pointer,nativePointerDrivenRegionPagingQualified:pointer,visits:route.length,originalDisposals:trips,exactRecordComparisons}));
