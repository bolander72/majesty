#!/usr/bin/env node
// Original native loading of the committed next handoff, active and dormant sides.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {repeatRevisionInputs} from './prepare-native-repeat-revision-inputs.mjs';
import {verifiedNativeSources} from './lib/native-generation.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {returnedCheckpoint} from './lib/native-return-checkpoint.mjs';
import {returnedMotion} from './lib/native-return-motion.mjs';
import {repeatReceivingMembership} from './check-native-repeat-return.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=65536){const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Committed reload metadata exceeds bound');const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;}
export async function verifyRepeatRevisionSide(manifestName,{inputs}={}) {
  const mb=await bounded(manifestName),m=JSON.parse(mb),sources=await verifiedNativeSources(m);
  if(![0,1].includes(m.side)||m.repeatCommittedReload!==true||m.scheduleNpc!==false||m.departNpc!==false||m.activateReturnedNpc!==false||m.privateReturnPacket)throw Error('Require committed reload without insertion/removal');
  const p=inputs??await repeatRevisionInputs(m.publicationReport,m.selectedRevisionExport?.receipt,m.side,{requireCurrent:false}),active=p.active;
  assert.equal(m.active,active);assert.equal(m.observeMotion,active);assert.equal(m.reloadScheduledNpc,active);assert.equal(m.captureEvolvedNpc,active);assert.equal(m.reloadDepartedNpc,!active);
  assert.equal(m.clockMode,active?'monotonic':'pinned');assert.equal(m.physicalGridExtent,p.physicalGridExtent);assert.deepEqual([m.unitId,m.agentId],[p.identity.unitId,p.identity.agentId]);
  assert.equal(m.publicationReport,p.publicationReport);assert.equal(m.publicationReportSha256,p.publicationReportSha256);assert.equal(sha(await bounded(m.publicationReport)),p.publicationReportSha256);
  assert.deepEqual(m.selectedRevisionExport,p.selectedRevisionExport);
  const profile=await ownedDirectory(m.profile,'actor-arrival-fixture-joint-reload-');assert.equal(profile,join(m.fixture,'frontier_0_0'));
  assert.equal(m.producerManifest,p.producerManifest);assert.equal(m.producerManifestSha256,p.producerManifestSha256);
  const producerBytes=await bounded(m.producerManifest);assert.equal(sha(producerBytes),p.producerManifestSha256);assert.deepEqual(JSON.parse(producerBytes),p.producer);
  assert.notEqual(m.nativePid,p.producer.nativePid);assert.notEqual(profile,p.producer.profile);
  for(const name of ['upstream/majesty-recomp/browser_frontier.cpp','upstream/majesty-recomp/game.toml'])assert.equal(sources[name],p.producer.nativeSourceSha256[name]);
  const buildBytes=await bounded(m.buildReport),build=JSON.parse(buildBytes);assert.equal(sha(buildBytes),m.buildReportSha256);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
  assert.deepEqual(build.nativeSourceSha256,sources);assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256AtLaunch);
  const settings=['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav'],worldName='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP',
    names=[...settings,worldName,'Joint_Reload_Expected.bin',...(active?['Unit','GPL','Orders'].map(k=>`Script_Composed_${k}_2101_0.bin`):[])],evidence={};
  assert.deepEqual(Object.keys(m.inputHashes).sort(),names.sort());
  for(const [name,digest] of Object.entries(m.inputHashes)){const file=join(profile,name);assert.equal(await hashCheckpointSource(await stoppedFileSource(file)),digest);evidence[file]=digest;if(settings.includes(name))assert.equal(digest,p.producer.inputHashes[name]);}
  assert.equal(m.inputHashes[worldName],p.selectedRevisionExport.sha256);
  const header=await bounded(join(profile,'Joint_Reload_Expected.bin'),16);assert.equal(header.length,16);assert.deepEqual(Array.from({length:4},(_,i)=>header.readUInt32LE(i*4)),[0x31524a4e,active?1:2,m.unitId,m.agentId]);
  const log=(await bounded(m.log,1024*1024)).toString('utf8');if(!log.includes('all expectations met')||/result=fail|SIGSEGV|exception e06d7363|undeliverable call(?!s: none)/i.test(log)||
    /^\[streaming\] (Return active|Private return|Joint schedule unit|Joint departure)/m.test(log))throw Error('Failed or inserted/deleted committed reload');
  const loaded=[...log.matchAll(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=\d+ sample-bytes=\d+$/gm)];assert.equal(loaded.length,1);assert.equal(Number(loaded[0][1]),p.expectedSnapshot.counts.units);
  let before,after,motion=null,nativeCounters=null;
  if(active) {
    if(/^\[streaming\] Joint departed reload/m.test(log))throw Error('Wrong active reload branch');
    const ids={unitId:m.unitId,agentId:m.agentId,retiredUnitId:p.retiredAlias.unitId,retiredAgentId:p.retiredAlias.agentId};
    before=await returnedCheckpoint(join(profile,worldName),ids);assert.equal(before.sha256,p.expectedSnapshot.sha256);assert.equal(before.bytes,p.expectedSnapshot.bytes);
    for(const key of ['counts','records','actor','queues','activeQueue','orderEntries','queued'])assert.deepEqual(before[key],p.expectedSnapshot[key]);
    assert.deepEqual(Object.keys(m.expectedWriters).sort(),['GPL','Orders','Unit']);
    for(const [kind,r] of Object.entries(before.records)){
      const input=await bounded(join(profile,`Script_Composed_${kind}_2101_0.bin`),2048),file=join(profile,`Joint_Reload_${kind}.bin`),writer=await bounded(file,2048);
      assert.equal(input.length,r.size);assert.equal(sha(input),r.sha256);assert.deepEqual(writer,input);assert.deepEqual(m.expectedWriters[kind],{bytes:r.size,sha256:r.sha256});evidence[file]=sha(writer);
    }
    for(const line of [`[streaming] Joint reload unit=${m.unitId} agent=${m.agentId} links=1 unit-written=1 script-written=1 commands-equal=1 scratch-released=1 result=pass`,
      `[streaming] Joint scheduled reload unit=${m.unitId} agent=${m.agentId} queued=1 queue-mutated=0 result=pass`])assert.equal(log.split('\n').filter(l=>l===line).length,1);
    motion=returnedMotion(log,{unitId:m.unitId,agentId:m.agentId,clock:p.expectedClock,x:before.actor.position.x,y:before.actor.position.y});
    for(const s of motion.samples)if(s[2]>=p.physicalGridExtent*32768||s[3]>=p.physicalGridExtent*32768||s[4]>=p.physicalGridExtent||s[5]>=p.physicalGridExtent)throw Error('Motion escaped actual committed grid');
    after=await returnedCheckpoint(join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP'),ids);assert.deepEqual([after.actor.position.x,after.actor.position.y],[motion.savedX,motion.savedY]);
    for(const key of ['unitId','agentId','family','description','playerNumber'])assert.equal(before.actor[key],after.actor[key]);
    if(before.sha256===after.sha256||before.records.Unit.sha256===after.records.Unit.sha256)throw Error('Committed motion was not saved');
  } else {
    if(/^\[streaming\] (Joint motion|Joint scheduled reload|Joint reload unit)/m.test(log))throw Error('Unexpected dormant gameplay/reinsertion');
    assert.deepEqual(m.expectedWriters,{});before=await repeatReceivingMembership(join(profile,worldName),p.identity);
    after=await repeatReceivingMembership(join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Departed_Reload.GMP'),p.identity);
    assert.equal(before.sha256,p.expectedSnapshot.sha256);assert.equal(before.bytes,p.expectedSnapshot.bytes);
    for(const key of ['counts','records','queues','activeQueue']){assert.deepEqual(before[key],p.expectedSnapshot[key]);assert.deepEqual(after[key],before[key]);}
    const rows=[...log.matchAll(/^\[streaming\] Joint departed reload unit=(\d+) agent=(\d+) unit-absent=1 agent-absent=1 entries=(\d+) queued=(\d+) groups=1 queues-same=1 counters-same=1 native-counter=(\d+) script-counter=(\d+) hooks-same=1 roundtrip-saved=1 result=pass$/gm)];assert.equal(rows.length,1);
    const [unitId,agentId,entries,queued,nativeCounter,scriptCounter]=rows[0].slice(1).map(Number);assert.deepEqual([unitId,agentId,entries,queued],[m.unitId,m.agentId,before.counts.agents,before.counts.agents]);
    if(nativeCounter<unitId||scriptCounter<agentId)throw Error('Dormant committed counters reset');nativeCounters={nativeCounter,scriptCounter};
  }
  for(const name of ['scripts/check-native-repeat-revision-reload.mjs','scripts/run-native-repeat-revision-reload.py','scripts/prepare-native-repeat-revision-inputs.mjs'])sources[name]=sha(await readFile(join(workspace,name)));
  return {qualified:true,scope:active?'Fresh original active load of committed revision6: exact evolved writers, saved schedule without reinsertion, 240 original movement/AI ticks and full evolved save in256 grid. Paired reload, continuous paging and browser resources require further evidence.':'Fresh original dormant load of committed revision6: outgoing alias absent, every surviving record/queue unchanged in full save, original counters/registry/hooks preserved on512 grid. Paired reload, native region disposal and browser resources require further evidence.',
    sourceManifest:resolve(manifestName),sourceManifestSha256:sha(mb),fixture:m,side:m.side,active,identity:p.identity,before,after,nativeCounters,
    ...(motion?{observedTicks:motion.ticks,motionSamples:motion.samples,originalPathCalls:motion.path,originalAgentCalls:motion.agents,originalContextActions:motion.executed}:{}),
    originalCommittedSnapshotReloadQualified:true,savedScheduleWithoutReinsertionQualified:active,originalCommittedGameplayAndFullSaveQualified:active,
    originalDormantAbsenceAndRecordsQualified:!active,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,sourceSha256:sources,
    evidenceSha256:{...evidence,[resolve(manifestName)]:sha(mb),[m.log]:sha(Buffer.from(log)),[after.filename]:after.sha256}};
}
export async function verifyRepeatRevisionPair(side0Name,side1Name) {
  const ms=[JSON.parse(await bounded(side0Name)),JSON.parse(await bounded(side1Name))];assert.equal(ms[0].side,0);assert.equal(ms[1].side,1);
  assert.equal(ms[0].publicationReport,ms[1].publicationReport);assert.equal(ms[0].selectedRevisionExport.receipt,ms[1].selectedRevisionExport.receipt);
  const p=await repeatRevisionInputs(ms[0].publicationReport,ms[0].selectedRevisionExport.receipt,0,{requireCurrent:false});
  const p1={...p,...await repeatRevisionInputs(ms[1].publicationReport,ms[1].selectedRevisionExport.receipt,1,{requireCurrent:false})};
  const sides=[await verifyRepeatRevisionSide(side0Name,{inputs:p}),await verifyRepeatRevisionSide(side1Name,{inputs:p1})];
  const producers=[p.producer,p1.producer],all=[...ms,...producers];
  if(new Set(all.map(m=>m.nativePid)).size!==4||new Set(all.map(m=>m.profile)).size!==4)throw Error('Committed pair reused processes/profiles');
  assert.equal(ms[0].nativeExecutableSha256AtLaunch,ms[1].nativeExecutableSha256AtLaunch);assert.deepEqual(ms[0].nativeSourceSha256,ms[1].nativeSourceSha256);
  for(const m of all)if(!Number.isSafeInteger(m.startedAtMs)||!Number.isSafeInteger(m.finishedAtMs)||m.startedAtMs>m.finishedAtMs)throw Error('Missing actual process times');
  for(let a=0;a<all.length;++a)for(let b=a+1;b<all.length;++b)if(Math.max(all[a].startedAtMs,all[b].startedAtMs)<Math.min(all[a].finishedAtMs,all[b].finishedAtMs))throw Error('Committed native processes overlapped');
  for(let side=0;side<2;++side)if(producers[side].finishedAtMs>ms[side].startedAtMs)throw Error('Committed reload predates producer');
  await verifyEntityOwnership(p.receipt.identity,p.receipt.state.aliases,p.receipt.state.referenceBindings,
    await Promise.all(sides.map(async s=>({source:await stoppedFileSource(s.after.filename),sha256:s.after.sha256}))),1);
  return {qualified:true,scope:'Both actually committed revision6 worlds loaded through the original engine in separate serial current-build processes: one retained active owner, exact saved schedule/gameplay/evolved full save, dormant outgoing absence and unchanged surviving records. Original region unloading, generated adjacent terrain, general journeys and browser resource bounds remain unqualified.',
    active:sides[1],dormant:sides[0],receipt:p.receipt,aliases:p.receipt.state.aliases,owner:p.receipt.owner,
    freshCommittedPairedNativeReloadQualified:true,committedExclusiveOwnershipAfterOriginalReloadQualified:true,
    generalRepeatedJourneysQualified:false,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  if(process.argv[2]==='--pair'){
    const [a,b,out]=process.argv.slice(3);if(!a||!b||!out||process.argv.length!==6)throw Error('Usage: --pair <side0> <side1> <fresh report>');const r=await verifyRepeatRevisionPair(a,b);
    await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,owner:r.owner,observedTicks:r.active.observedTicks,dormantRecords:Object.values(r.dormant.after.counts).reduce((a,b)=>a+b,0),freshCommittedPairedNativeReloadQualified:true}));
  }else{const [m,out]=process.argv.slice(2);if(!m||!out||process.argv.length!==4)throw Error('Usage: <terminal manifest> <fresh report|--stdout>');const r=await verifyRepeatRevisionSide(m);
    if(out==='--stdout')console.log(JSON.stringify(r));else{await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,side:r.side,identity:r.identity,observedTicks:r.observedTicks??0,originalCommittedSnapshotReloadQualified:true}));}}
}
