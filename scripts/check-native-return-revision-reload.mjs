#!/usr/bin/env node
// Original-engine loading of both worlds of one committed native return.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifiedNativeSources} from './lib/native-generation.mjs';
import assert from 'node:assert/strict';
import {prepareNativeReturnHandoff} from './prepare-native-return-handoff.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {returnedCheckpoint} from './lib/native-return-checkpoint.mjs';
import {returnedMotion} from './lib/native-return-motion.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const settings=['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav'];
async function bounded(name,cap=1024*1024) {
  const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Revision reload metadata exceeds bound');
  const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;
}
function stopped(m) {
  if(m.nativeOnly!==true||m.browserUsed!==false||m.nativeSessionTerminal!==true||m.nativeExitCode!==0||!Number.isInteger(m.nativePid)||m.nativePid<=0)
    throw Error('Require successful terminal native process');
  try{process.kill(m.nativePid,0);throw Error('Native process is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
}
export async function returnRevisionInputs(publicationName,receiptName,side,{requireCurrent=true}={}) {
  if(![0,1].includes(side))throw Error('Invalid return revision side');
  const pb=await bounded(publicationName),publication=JSON.parse(pb),r=JSON.parse(await bounded(receiptName,8192)),old=publication.preparation;
  if(publication.qualified!==true||publication.originalNativeReturnOwnershipPublicationQualified!==true||!old)throw Error('Require native return publication');
  const p=await prepareNativeReturnHandoff(old.departureReport,old.departedReloadReport,old.incomingReloadReport,{requireCurrent:false});
  assertRevalidatedNativeProof(p.report,old);
  assert.equal(r.manifest,publication.manifest);assert.deepEqual(r.identity,p.receipt.identity);
  assert.equal(r.revisionDirectory,p.receipt.revisionDirectory);assert.equal(publication.revisionDirectory,r.revisionDirectory);
  assert.deepEqual(r.owner,publication.owner);assert.equal(r.state.revision,p.receipt.state.revision+1);
  assert.equal(publication.previousRevision,p.receipt.state.revision);assert.equal(publication.revision,r.state.revision);
  assert.equal(r.state.previous,sha(Buffer.from(p.receipt.manifest)));assert.equal(r.state.operationId,p.request.operationId);
  assert.equal(r.state.kind,'handoff');assert.equal(r.state.ownerSide,0);assert.equal(r.state.visitedSides,p.request.visitedSides);
  assert.deepEqual(r.state.aliases,p.request.aliases);assert.deepEqual(publication.aliases,r.state.aliases);
  assert.deepEqual(r.state.referenceBindings,p.request.referenceBindings);
  const worlds=p.request.worlds.map(w=>({size:w.source.size,sha256:w.sha256}));
  assert.deepEqual(r.state.worlds,worlds);assert.deepEqual(publication.worlds,worlds);
  const exports=[];for(let i=0;i<2;++i)exports.push(await verifyRevisionExport(receiptName,i,worlds[i].sha256,{requireCurrent}));
  const producer=side?p.departed.fixture:p.incoming.fixture;stopped(producer);
  const saved=side?p.departed.roundtrip:p.incoming.after;
  assert.equal(saved.sha256,worlds[side].sha256);assert.equal(saved.bytes,worlds[side].size);
  return {publicationSha256:sha(pb),selectedRevisionExport:exports[side],producer,
    identity:r.state.aliases[side],incomingClock:p.report.incomingClock,
    expectedRecords:side?null:saved.records,expectedSnapshot:saved,receipt:r,
    otherSide:{selectedRevisionExport:exports[1-side],producer:side?p.incoming.fixture:p.departed.fixture,
      identity:r.state.aliases[1-side],expectedRecords:side?p.incoming.after.records:null,
      expectedSnapshot:side?p.incoming.after:p.departed.roundtrip}};
}
async function absentSnapshot(filename,expected,unitId,agentId) {
  const s=await stoppedFileSource(filename),records={units:{},agents:{},attachments:{}},counts={};
  for(const [kind,it,key] of [['units',checkpointUnits(s),r=>String(r.primary.words[1])],['agents',checkpointAgents(s),r=>String(r.agentId)],
    ['attachments',checkpointAttachments(s),r=>r.kind+':'+r.unitId]]) {
    let count=0;
    for await(const r of it) {
      const id=key(r);if(++count>5000||Object.hasOwn(records[kind],id))throw Error('Invalid dormant membership');
      const h=createHash('sha256');for(let at=0;at<r.size;at+=4096)h.update(await s.readAt(r.offset+at,Math.min(4096,r.size-at)));
      records[kind][id]={bytes:r.size,sha256:h.digest('hex')};
    }
    counts[kind]=count;assert.deepEqual(records[kind],expected.records[kind],'Dormant entity records changed');
  }
  if(records.units[unitId]||records.agents[agentId]||records.attachments['ORDR:'+unitId])throw Error('Outgoing actor resurrected');
  const queues=[[],[]],seen=new Set();let activeQueue;
  for await(const r of checkpointAgentQueues(s)) {
    if(r.type==='queue-selector'){if(activeQueue!==undefined)throw Error('Duplicate queue selector');activeQueue=r.activeQueue;}
    else {if(seen.has(r.agentId)||!records.agents[r.agentId])throw Error('Invalid dormant saved queue');seen.add(r.agentId);queues[r.queue].push(r.agentId);}
  }
  assert.equal(seen.size,counts.agents);assert.deepEqual(queues,expected.queues);assert.equal(activeQueue,expected.activeQueue);
  return {filename,bytes:s.size,sha256:await hashCheckpointSource(s),counts,records,queues,activeQueue};
}
export async function verifyReturnRevisionSide(manifestName,{inputs}={}) {
  const mb=await bounded(manifestName,65536),m=JSON.parse(mb);stopped(m);
  if(![0,1].includes(m.side)||m.reloadCommittedReturn!==true||m.scheduleNpc!==false||m.departNpc!==false||m.activateReturnedNpc!==false||m.privateReturnPacket)
    throw Error('Require committed return reload without insertion/deletion');
  const side=m.side,p=inputs??await returnRevisionInputs(m.publicationReport,m.selectedRevisionExport?.receipt,side,{requireCurrent:false});
  assert.equal(sha(await bounded(m.publicationReport)),p.publicationSha256);assert.equal(m.publicationReportSha256,p.publicationSha256);
  assert.deepEqual(m.selectedRevisionExport,p.selectedRevisionExport);assert.deepEqual([m.unitId,m.agentId],[p.identity.unitId,p.identity.agentId]);
  const profile=await ownedDirectory(m.profile,'actor-arrival-fixture-joint-reload-');
  if(!profile.endsWith('/frontier_0_0')||profile!==join(m.fixture,'frontier_0_0'))throw Error('Invalid committed reload profile');
  const producerBytes=await bounded(m.producerManifest,65536);
  assert.equal(m.producerManifestSha256,sha(producerBytes));assert.deepEqual(JSON.parse(producerBytes),p.producer);
  if(m.nativePid===p.producer.nativePid||profile===p.producer.profile)throw Error('Reload reused producer process/profile');
  assert.deepEqual(await verifiedNativeSources(m),await verifiedNativeSources(p.producer),'Committed reload native source provenance differs');
  assert.equal(m.nativeExecutableSha256AtLaunch,p.producer.nativeExecutableSha256AtLaunch);
  assert.equal(m.clockMode,side?'pinned':'monotonic');assert.equal(m.observeMotion,!side);assert.equal(m.reloadScheduledNpc,!side);
  assert.equal(m.captureEvolvedNpc,!side);assert.equal(m.reloadDepartedNpc,!!side);assert.equal(m.physicalGridExtent,side?256:512);
  const required=[...settings,'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP','Joint_Reload_Expected.bin',
    ...(!side?['Script_Composed_Unit_2101_0.bin','Script_Composed_GPL_2101_0.bin','Script_Composed_Orders_2101_0.bin']:[])];
  assert.deepEqual(Object.keys(m.inputHashes).sort(),required.sort());
  for(const name of required) {
    const s=await stoppedFileSource(join(profile,name));assert.equal(await hashCheckpointSource(s),m.inputHashes[name],'Copied reload input changed');
    if(settings.includes(name))assert.equal(m.inputHashes[name],p.producer.inputHashes[name]);
  }
  const expected=await bounded(join(profile,'Joint_Reload_Expected.bin'),16);assert.equal(expected.length,16);
  assert.deepEqual(Array.from({length:4},(_,i)=>expected.readUInt32LE(i*4)),[0x31524a4e,side?2:1,m.unitId,m.agentId]);
  const log=(await bounded(m.log)).toString('utf8');
  if(!log.includes('all expectations met')||/result=fail|SIGSEGV|exception e06d7363|undeliverable call(?!s: none)/i.test(log))throw Error('Original committed reload failed');
  if(/^\[streaming\] (Return active|Private return|Joint schedule unit|Joint departure)/m.test(log))throw Error('Actor inserted/deleted during committed reload');
  const loaded=[...log.matchAll(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=\d+ sample-bytes=\d+$/gm)];
  if(loaded.length!==1)throw Error('Missing complete original loader');
  const beforeName=join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP');let before,after,motion,nativeCounters;
  if(!side) {
    for(const line of [`[streaming] Joint reload unit=${m.unitId} agent=${m.agentId} links=1 unit-written=1 script-written=1 commands-equal=1 scratch-released=1 result=pass`,
      `[streaming] Joint scheduled reload unit=${m.unitId} agent=${m.agentId} queued=1 queue-mutated=0 result=pass`])
      assert.equal(log.split('\n').filter(l=>l===line).length,1,'Missing exact original writers or untouched saved queue');
    if(/^\[streaming\] Joint departed reload/m.test(log))throw Error('Wrong absent actor mode');
    before=await returnedCheckpoint(beforeName,m);
    for(const key of ['bytes','sha256','counts','records','actor','queues','activeQueue','orderEntries'])assert.deepEqual(before[key],p.expectedSnapshot[key]);
    const writers={};for(const [kind,r] of Object.entries(before.records)) {
      const input=await bounded(join(profile,`Script_Composed_${kind}_2101_0.bin`),2048),written=await bounded(join(profile,`Joint_Reload_${kind}.bin`),2048);
      assert.equal(input.length,r.size);assert.equal(sha(input),r.sha256);assert.deepEqual(written,input,'Original writer changed saved '+kind);
      writers[kind]={bytes:r.size,sha256:r.sha256};
    }
    assert.deepEqual(m.expectedWriters,writers);
    motion=returnedMotion(log,{unitId:m.unitId,agentId:m.agentId,clock:p.incomingClock,x:before.actor.position.x,y:before.actor.position.y});
    after=await returnedCheckpoint(join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP'),m);
    assert.deepEqual([after.actor.position.x,after.actor.position.y],[motion.savedX,motion.savedY]);
    for(const key of ['unitId','agentId','family','description','playerNumber'])assert.equal(after.actor[key],before.actor[key]);
    if(before.sha256===after.sha256||before.records.Unit.sha256===after.records.Unit.sha256)throw Error('Original gameplay not persisted');
  } else {
    if(/^\[streaming\] Joint (reload unit|scheduled reload|motion begin)/m.test(log))throw Error('Dormant reload ran actor/motion mode');
    assert.deepEqual(m.expectedWriters,{});
    before=await absentSnapshot(beforeName,p.expectedSnapshot,m.unitId,m.agentId);
    after=await absentSnapshot(join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Departed_Reload.GMP'),p.expectedSnapshot,m.unitId,m.agentId);
    const rows=[...log.matchAll(/^\[streaming\] Joint departed reload unit=(\d+) agent=(\d+) unit-absent=1 agent-absent=1 entries=(\d+) queued=(\d+) groups=1 queues-same=1 counters-same=1 native-counter=(\d+) script-counter=(\d+) hooks-same=1 roundtrip-saved=1 result=pass$/gm)];
    assert.equal(rows.length,1);const [u,a,entries,queued,nc,sc]=rows[0].slice(1).map(Number);
    assert.deepEqual([u,a,entries,queued],[m.unitId,m.agentId,before.counts.agents,before.counts.agents]);
    assert.ok(nc>=u&&sc>=a);nativeCounters={nativeCounter:nc,scriptCounter:sc};
  }
  assert.equal(Number(loaded[0][1]),before.counts.units);assert.equal(before.bytes,p.selectedRevisionExport.bytes);assert.equal(before.sha256,p.selectedRevisionExport.sha256);
  assert.equal(m.inputHashes['Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'],before.sha256);
  return {qualified:true,side,fixture:m,sourceManifest:resolve(manifestName),sourceManifestSha256:sha(mb),before,after,
    originalLoadedUnits:Number(loaded[0][1]),...(side?{unchangedSurvivingEntityRecords:Object.values(before.counts).reduce((a,b)=>a+b,0),nativeCounters}:
      {observedTicks:motion.ticks,motionSamples:motion.samples,originalPathCalls:motion.path,originalContextActions:motion.executed,savedClock:motion.savedClock}),
    nativeOriginalCommittedSnapshotReloadQualified:true,browserUsed:false};
}
export async function verifyReturnRevisionPair(activeName,absentName) {
  const am=JSON.parse(await bounded(activeName,65536)),dm=JSON.parse(await bounded(absentName,65536));
  assert.deepEqual([am.side,dm.side],[0,1]);assert.equal(am.publicationReport,dm.publicationReport);
  assert.equal(am.selectedRevisionExport?.receipt,dm.selectedRevisionExport?.receipt);
  const inputs=await returnRevisionInputs(am.publicationReport,am.selectedRevisionExport.receipt,0,{requireCurrent:false});
  const active=await verifyReturnRevisionSide(activeName,{inputs});
  // Reuse the two snapshots/producers actually audited together above, without
  // reopening unchecked metadata to construct the departed side.
  const other={...inputs,...inputs.otherSide};
  const absent=await verifyReturnRevisionSide(absentName,{inputs:other});
  await verifyEntityOwnership(inputs.receipt.identity,inputs.receipt.state.aliases,inputs.receipt.state.referenceBindings,
    [{source:await stoppedFileSource(active.after.filename)},{source:await stoppedFileSource(absent.after.filename)}],0);
  for(const key of ['receiptSha256','manifest','owner','revision','identitySha256','stateSha256','revisionReportSha256'])
    assert.deepEqual(am.selectedRevisionExport[key],dm.selectedRevisionExport[key]);
  const stages=[am,dm,inputs.producer,other.producer];
  assert.equal(new Set(stages.map(m=>m.nativePid)).size,4);assert.equal(new Set(stages.map(m=>m.profile)).size,4);
  assert.equal(new Set(stages.map(m=>m.nativeExecutableSha256AtLaunch)).size,1);
  // The active run must have ended before the dormant process started.
  assert.ok(Number.isSafeInteger(am.finishedAtMs)&&Number.isSafeInteger(dm.startedAtMs)&&am.finishedAtMs<=dm.startedAtMs);
  const sources={};for(const name of ['scripts/check-native-return-revision-reload.mjs','scripts/run-native-return-revision-reload.py',
    'scripts/lib/native-return-checkpoint.mjs','scripts/lib/native-return-motion.mjs'])sources[name]=sha(await readFile(join(workspace,name)));
  return {qualified:true,scope:'Both worlds of one committed original native return loaded in separate serial original-engine processes: exact active writers/saved schedule, 240 more original motion/AI ticks/full save, and dormant actor absence with every surviving record/queue preserved. Continuous gameplay paging and browser memory remain unqualified.',
    revision:inputs.receipt.state.revision,owner:inputs.receipt.owner,receipt:inputs.selectedRevisionExport.receipt,receiptSha256:inputs.selectedRevisionExport.receiptSha256,
    publicationReport:am.publicationReport,publicationReportSha256:inputs.publicationSha256,active,absent,
    freshPairedReturnedRevisionNativeReloadQualified:true,originalReturnedGameplayAndSaveQualified:true,departedNpcAbsenceAfterReloadQualified:true,
    exclusiveEntityOwnershipAfterNativeReloadQualified:true,
    repeatedGameplayCrossingsQualified:false,continuousPagingQualified:false,simultaneousNativeRegionsQualified:false,wholeBrowserMemoryBoundQualified:false,
    browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,sourceSha256:sources};
}
if(resolve(process.argv[1]||'')===resolve(new URL(import.meta.url).pathname)) {
  if(process.argv[2]==='--inputs') {
    const [publication,receipt,side]=process.argv.slice(3);if(process.argv.length!==6||! /^[01]$/.test(side))throw Error('Usage: --inputs <publication> <current receipt> <side>');
    console.log(JSON.stringify(await returnRevisionInputs(publication,receipt,Number(side))));
  } else {
    const [active,absent,output]=process.argv.slice(2);if(process.argv.length!==5)throw Error('Usage: <active terminal manifest> <absent terminal manifest> <fresh output|--stdout>');
    const report=await verifyReturnRevisionPair(active,absent);
    if(output==='--stdout')console.log(JSON.stringify(report));else {
      await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
      console.log(JSON.stringify({qualified:true,revision:report.revision,observedTicks:report.active.observedTicks,originalAiActions:report.active.originalContextActions,
        unchangedDormantRecords:report.absent.unchangedSurvivingEntityRecords,freshPairedReturnedRevisionNativeReloadQualified:true}));
    }
  }
}
