#!/usr/bin/env node
// Separate original load of the actual next-crossing evolved save and schedule.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyRepeatActive} from './check-native-repeat-active.mjs';
import {verifiedNativeSources} from './lib/native-generation.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {returnedCheckpoint} from './lib/native-return-checkpoint.mjs';
import {returnedMotion} from './lib/native-return-motion.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=65536) {
  const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Reload evidence exceeds bound');
  const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;
}
export async function verifyRepeatReload(manifestName) {
  const mb=await bounded(manifestName),m=JSON.parse(mb),sources=await verifiedNativeSources(m);
  if(m.repeatReceivingReload!==true||m.observeMotion!==true||m.reloadScheduledNpc!==true||m.captureEvolvedNpc!==true||m.activateReturnedNpc!==false||
    m.departNpc!==false||m.scheduleNpc!==false||m.reloadDepartedNpc!==false||m.clockMode!=='monotonic'||m.physicalGridExtent!==256||m.privateReturnPacket)
    throw Error('Require separate receiving reload without reinsertion/deletion');
  const profile=await ownedDirectory(m.profile,'actor-arrival-fixture-joint-reload-');assert.equal(profile,join(m.fixture,'frontier_0_0'));
  const pb=await bounded(m.sourceActiveReport),p=JSON.parse(pb);assert.equal(sha(pb),m.sourceActiveReportSha256);
  assertRevalidatedNativeProof(await verifyRepeatActive(p.sourceManifest),p);
  assert.notEqual(m.nativePid,p.fixture.nativePid);assert.notEqual(profile,p.fixture.profile);
  assert.deepEqual([m.unitId,m.agentId],[p.identity.unitId,p.identity.agentId]);assert.deepEqual(m.nativeSourceSha256,p.fixture.nativeSourceSha256);
  assert.equal(m.nativeExecutableSha256AtLaunch,p.fixture.nativeExecutableSha256AtLaunch);
  const settings=['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav'],worldName='Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP',
    writerNames=['Unit','GPL','Orders'].map(k=>`Script_Composed_${k}_2101_0.bin`);
  assert.deepEqual(Object.keys(m.inputHashes).sort(),[...settings,worldName,'Joint_Reload_Expected.bin',...writerNames].sort());
  const evidence={};for(const [name,digest] of Object.entries(m.inputHashes)) {
    const file=join(profile,name);assert.equal(await hashCheckpointSource(await stoppedFileSource(file)),digest);evidence[file]=digest;
    if(settings.includes(name))assert.equal(digest,p.fixture.inputHashes[name]);
  }
  assert.equal(m.inputHashes[worldName],p.after.sha256);
  const header=await bounded(join(profile,'Joint_Reload_Expected.bin'),16);assert.equal(header.length,16);
  assert.deepEqual(Array.from({length:4},(_,i)=>header.readUInt32LE(i*4)),[0x31524a4e,1,m.unitId,m.agentId]);
  const capsule=JSON.parse(await bounded(p.fixture.privateReturnPacket.returnReport,32768)),ids={unitId:m.unitId,agentId:m.agentId,
    retiredUnitId:capsule.plan.retiredDestinationAlias.unitId,retiredAgentId:capsule.plan.retiredDestinationAlias.agentId},directory=join(profile,'Documents/My Games/MajestyHD/SaveGame'),
    before=await returnedCheckpoint(join(directory,'Joint_Reload.GMP'),ids);
  assert.equal(before.sha256,p.after.sha256);assert.equal(before.bytes,p.after.bytes);
  for(const key of ['counts','records','actor','queues','activeQueue','orderEntries','queued'])assert.deepEqual(before[key],p.after[key]);
  assert.deepEqual(Object.keys(m.expectedWriters).sort(),['GPL','Orders','Unit']);
  for(const [kind,r] of Object.entries(before.records)) {
    const input=await bounded(join(profile,`Script_Composed_${kind}_2101_0.bin`),2048),file=join(profile,`Joint_Reload_${kind}.bin`),writer=await bounded(file,2048);
    assert.equal(input.length,r.size);assert.equal(sha(input),r.sha256);assert.deepEqual(writer,input);assert.deepEqual(m.expectedWriters[kind],{bytes:r.size,sha256:r.sha256});evidence[file]=sha(writer);
  }
  const log=(await bounded(m.log,1024*1024)).toString('utf8');
  if(!log.includes('all expectations met')||/result=fail|SIGSEGV|exception e06d7363|undeliverable call(?!s: none)/i.test(log)||
    /^\[streaming\] (Return active|Private return|Joint schedule unit|Joint departure|Joint departed reload)/m.test(log))throw Error('Failed or reinserted receiving reload');
  const loaded=[...log.matchAll(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=\d+ sample-bytes=\d+$/gm)];assert.equal(loaded.length,1);assert.equal(Number(loaded[0][1]),before.counts.units);
  for(const line of [`[streaming] Joint reload unit=${m.unitId} agent=${m.agentId} links=1 unit-written=1 script-written=1 commands-equal=1 scratch-released=1 result=pass`,
    `[streaming] Joint scheduled reload unit=${m.unitId} agent=${m.agentId} queued=1 queue-mutated=0 result=pass`])assert.equal(log.split('\n').filter(l=>l===line).length,1);
  const motion=returnedMotion(log,{unitId:m.unitId,agentId:m.agentId,clock:p.motionSamples.at(-1)[1],x:before.actor.position.x,y:before.actor.position.y});
  for(const s of motion.samples)if(s[2]>=256*32768||s[3]>=256*32768||s[4]>=256||s[5]>=256)throw Error('Reload motion escaped receiving grid');
  const after=await returnedCheckpoint(join(directory,'Joint_Evolved.GMP'),ids);assert.deepEqual([after.actor.position.x,after.actor.position.y],[motion.savedX,motion.savedY]);
  for(const key of ['unitId','agentId','family','description','playerNumber'])assert.equal(before.actor[key],after.actor[key]);
  if(before.sha256===after.sha256||before.records.Unit.sha256===after.records.Unit.sha256)throw Error('Fresh movement not saved');
  for(const name of ['scripts/check-native-repeat-reload.mjs','scripts/run-native-repeat-reload.py','scripts/lib/revalidate-native-proof.mjs'])sources[name]=sha(await readFile(join(workspace,name)));
  return {qualified:true,scope:'Separate original receiving-world reload of the actual next-crossing evolved save: exact current writers and untouched saved schedule, 240 further original movement/AI ticks and another original full save within256 grid. Outgoing removal, paired handoff, repeated published crossings, original region disposal and browser resources remain unqualified.',
    sourceManifest:resolve(manifestName),sourceManifestSha256:sha(mb),fixture:m,sourceActiveReport:m.sourceActiveReport,sourceActiveReportSha256:m.sourceActiveReportSha256,
    identity:p.identity,before,after,observedTicks:motion.ticks,motionSamples:motion.samples,originalPathCalls:motion.path,originalAgentCalls:motion.agents,originalContextActions:motion.executed,
    freshReceivingReloadQualified:true,savedScheduleWithoutReinsertionQualified:true,exactJointWriterRecords:3,actorMovementQualified:true,originalAiExecutionQualified:true,
    originalEvolvedFullSaveAfterReloadQualified:true,observerHooksRemoved:true,pairedOwnershipHandoffQualified:false,repeatedGameplayCrossingsQualified:false,wholeBrowserMemoryBoundQualified:false,
    browserUsed:false,nativeProcessesStarted:0,sourceSha256:sources,evidenceSha256:{...evidence,[resolve(manifestName)]:sha(mb),[m.log]:sha(Buffer.from(log)),[after.filename]:after.sha256}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [manifest,output]=process.argv.slice(2);if(!manifest||!output||process.argv.length!==4)throw Error('Usage: <terminal receiving reload manifest> <fresh output|--stdout>');
  const r=await verifyRepeatReload(manifest);if(output==='--stdout')console.log(JSON.stringify(r));else {
    await writeFile(output,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,identity:r.identity,observedTicks:r.observedTicks,originalPathCalls:r.originalPathCalls,originalContextActions:r.originalContextActions,freshReceivingReloadQualified:true}));}
}
