#!/usr/bin/env node
// Fresh original loader, exact current NPC writers, saved schedule and gameplay.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifiedNativeSources} from './lib/native-generation.mjs';
import assert from 'node:assert/strict';
import {verifyActiveReturn} from './check-native-return-active.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {returnedMotion} from './lib/native-return-motion.mjs';
import {returnedCheckpoint} from './lib/native-return-checkpoint.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap) {
  const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Returned reload evidence exceeds bound');
  const bytes=Buffer.alloc(s.size);for(let at=0;at<bytes.length;at+=4096)bytes.set(await s.readAt(at,Math.min(4096,bytes.length-at)),at);return bytes;
}
function stopped(pid) {
  if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid native process identity');
  try{process.kill(pid,0);throw Error('Native process is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
}
export async function verifyReturnedReload(manifestName) {
  const bytes=await bounded(manifestName,65536),m=JSON.parse(bytes);
  if(m.nativeOnly!==true||m.browserUsed!==false||m.nativeSessionTerminal!==true||m.nativeExitCode!==0||m.reloadReturnedNpc!==true||
    m.observeMotion!==true||m.reloadScheduledNpc!==true||m.captureEvolvedNpc!==true||m.clockMode!=='monotonic'||m.physicalGridExtent!==512||
    m.activateReturnedNpc!==false||m.departNpc!==false||m.scheduleNpc!==false||m.reloadDepartedNpc!==false||m.privateReturnPacket)
    throw Error('Require separate original returned-world reload without reinsertion or deletion');
  stopped(m.nativePid);const profile=await ownedDirectory(m.profile,'actor-arrival-fixture-return-reload-');
  if(!profile.endsWith('/frontier_0_0'))throw Error('Require copied returned-world profile');
  const pbytes=await bounded(m.sourceReturnReport,65536),p=JSON.parse(pbytes);
  if(sha(pbytes)!==m.sourceReturnReportSha256||p.originalReturnedFullSaveQualified!==true||p.originalReturnActivationQualified!==true)
    throw Error('Returned producer proof changed');
  assertRevalidatedNativeProof(await verifyActiveReturn(p.sourceManifest),p);
  if(p.fixture.nativePid===m.nativePid||p.fixture.profile===profile||p.sourceManifest!==m.sourceManifest||p.sourceManifestSha256!==m.sourceManifestSha256)
    throw Error('Returned reload must use a separate process/profile and exact qualified producer');
  stopped(p.fixture.nativePid);
  assert.deepEqual([m.unitId,m.agentId],[p.identity.unitId,p.identity.agentId]);
  const sources=await verifiedNativeSources(m);
  assert.deepEqual(await verifiedNativeSources(p.fixture),sources,'Returned reload native source provenance differs');
  if(m.nativeExecutableSha256AtLaunch!==p.fixture.nativeExecutableSha256AtLaunch)throw Error('Reload uses another native executable');
  const evidence={};
  for(const [name,digest] of Object.entries(m.inputHashes)) {
    if(name.includes('..')||name.startsWith('/'))throw Error('Invalid owned reload input');
    const source=await stoppedFileSource(join(profile,name)),h=createHash('sha256');
    for(let at=0;at<source.size;at+=4096)h.update(await source.readAt(at,Math.min(4096,source.size-at)));
    assert.equal(h.digest('hex'),digest,'Reload input changed');evidence[join(profile,name)]=digest;
  }
  for(const name of ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav'])
    assert.equal(m.inputHashes[name],p.fixture.inputHashes[name],'Returned settings differ');
  const expected=await bounded(join(profile,'Joint_Reload_Expected.bin'),16);
  assert.equal(expected.length,16);assert.deepEqual(Array.from({length:4},(_,i)=>expected.readUInt32LE(i*4)),[0x31524a4e,1,m.unitId,m.agentId]);
  const log=(await bounded(m.log,1024*1024)).toString('utf8');
  if(!log.includes('all expectations met')||/result=fail|SIGSEGV|exception e06d7363|undeliverable call(?!s: none)/i.test(log))throw Error('Native returned reload or continuation failed');
  if(/^\[streaming\] (Return active|Private return|Joint schedule unit|Joint departure|Joint departed reload)/m.test(log))throw Error('Actor was reinserted or deleted during reload');
  const loaded=[...log.matchAll(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=\d+ sample-bytes=\d+$/gm)];
  if(loaded.length!==1||Number(loaded[0][1])!==p.after.counts.units)throw Error('Missing complete original returned world load');
  for(const line of [`[streaming] Joint reload unit=${m.unitId} agent=${m.agentId} links=1 unit-written=1 script-written=1 commands-equal=1 scratch-released=1 result=pass`,
    `[streaming] Joint scheduled reload unit=${m.unitId} agent=${m.agentId} queued=1 queue-mutated=0 result=pass`])
    if(log.split('\n').filter(l=>l===line).length!==1)throw Error('Missing original current writers/backlinks or untouched saved schedule');
  const before=await returnedCheckpoint(join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'),m);
  assert.equal(before.sha256,p.after.sha256);assert.equal(before.bytes,p.after.bytes);
  assert.equal(before.sha256,m.inputHashes['Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP']);
  for(const key of ['counts','records','actor','queues','activeQueue','orderEntries'])assert.deepEqual(before[key],p.after[key],'Loaded another returned state');
  assert.deepEqual(Object.keys(m.expectedReturnedWriters).sort(),['GPL','Orders','Unit']);
  for(const [kind,r] of Object.entries(before.records)) {
    const inputName=join(profile,`Script_Composed_${kind}_2101_0.bin`),writerName=join(profile,`Joint_Reload_${kind}.bin`),
      input=await bounded(inputName,2048),writer=await bounded(writerName,2048);
    assert.equal(input.length,r.size);assert.equal(sha(input),r.sha256);assert.deepEqual(writer,input,`Original reloaded ${kind} differs from evolved state`);
    assert.deepEqual(m.expectedReturnedWriters[kind],{bytes:r.size,sha256:r.sha256});assert.equal(m.inputHashes[inputName.slice(profile.length+1)],r.sha256);
    evidence[writerName]=sha(writer);
  }
  const motion=returnedMotion(log,{unitId:m.unitId,agentId:m.agentId,clock:p.motionSamples.at(-1)[1],x:before.actor.position.x,y:before.actor.position.y});
  const after=await returnedCheckpoint(join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP'),m);
  assert.deepEqual([after.actor.position.x,after.actor.position.y],[motion.savedX,motion.savedY]);
  for(const key of ['unitId','agentId','family','description','playerNumber'])assert.equal(before.actor[key],after.actor[key]);
  if(before.sha256===after.sha256||before.records.Unit.sha256===after.records.Unit.sha256)throw Error('Fresh returned movement not persisted');
  for(const name of ['scripts/check-native-return-reload.mjs','scripts/run-native-return-reload.py','scripts/prepare-native-evolved-writers.mjs',
    'scripts/lib/native-return-motion.mjs','scripts/lib/native-return-checkpoint.mjs','scripts/lib/revalidate-native-proof.mjs'])sources[name]=sha(await readFile(join(workspace,name)));
  return {qualified:true,scope:'One separate native original returned-world reload: exact evolved UNIT/GPL/Orders writers, saved schedule without reinsertion, 240 further original movement/AI ticks and another original evolved full save. Outgoing owner removal, paired return publication, repeated crossings and browser resources unqualified.',
    fixture:m,sourceManifest:resolve(manifestName),sourceManifestSha256:sha(bytes),sourceReturnReport:m.sourceReturnReport,sourceReturnReportSha256:m.sourceReturnReportSha256,
    identity:{unitId:m.unitId,agentId:m.agentId},before,after,observedTicks:motion.ticks,motionSamples:motion.samples,
    originalDispatchCalls:motion.calls,originalLeafCalls:motion.leaves,originalPathCalls:motion.path,originalAgentCalls:motion.agents,originalContextCalls:motion.contexts,originalContextActions:motion.executed,
    originalLoadedUnits:Number(loaded[0][1]),exactJointWriterRecords:3,freshReturnedWorldReloadQualified:true,savedQueueReloadWithoutReinsertionQualified:true,
    originalAiExecutionQualified:true,actorMovementQualified:true,originalReturnedEvolvedSaveAfterReloadQualified:true,observerHooksRemoved:true,
    completeNativeReturnQualified:false,sourceDestinationOwnershipHandoffQualified:false,continuousPagingQualified:false,wholeBrowserMemoryBoundQualified:false,
    browserUsed:false,nativeProcessesStarted:0,sourceSha256:sources,evidenceSha256:{...evidence,[resolve(manifestName)]:sha(bytes),[m.log]:sha(Buffer.from(log))}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [manifest,output]=process.argv.slice(2);if(!manifest||!output||process.argv.length!==4)throw Error('Usage: <terminal returned reload manifest> <fresh report|--stdout>');
  const report=await verifyReturnedReload(manifest);
  if(output==='--stdout')console.log(JSON.stringify(report));else {
    await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({qualified:true,identity:report.identity,observedTicks:report.observedTicks,originalPathCalls:report.originalPathCalls,originalContextActions:report.originalContextActions,freshReturnedWorldReloadQualified:true}));
  }
}
