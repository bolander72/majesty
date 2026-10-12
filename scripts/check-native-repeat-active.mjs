#!/usr/bin/env node
// Original next-crossing activation, motion/AI and full saves; no handoff commit.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyRepeatRestoration,repeatReceivingMembership} from './check-native-repeat-return.mjs';
import {returnedMotion} from './lib/native-return-motion.mjs';
import {returnedCheckpoint} from './lib/native-return-checkpoint.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function verifyRepeatActive(manifestName) {
  const restored=await verifyRepeatRestoration(manifestName,{active:true}),m=restored.fixture,{unitId,agentId}=restored.identity,
    capsule=JSON.parse(await readFile(m.privateReturnPacket.returnReport)),p=capsule.plan,log=await readFile(m.log,'utf8'),
    initial=await readFile(join(m.profile,'Return_Unit_Observed.bin'));
  const motion=returnedMotion(log,{unitId,agentId,clock:restored.clock,x:initial.readInt32LE(60),y:initial.readInt32LE(64)});
  // The historical motion parser's envelope is512. This receiving map requires
  // the stronger256-cell bounds on every original native sample.
  for(const s of motion.samples)if(s[2]>=256*32768||s[3]>=256*32768||s[4]>=256||s[5]>=256)throw Error('Motion escaped actual receiving grid');
  const directory=join(m.profile,'Documents/My Games/MajestyHD/SaveGame'),ids={unitId,agentId,
    retiredUnitId:p.retiredDestinationAlias.unitId,retiredAgentId:p.retiredDestinationAlias.agentId},
    before=await returnedCheckpoint(join(directory,'Joint_Return_Ready.GMP'),ids),after=await returnedCheckpoint(join(directory,'Joint_Evolved.GMP'),ids);
  const receiving=await repeatReceivingMembership(join(directory,'Joint_Departed_Reload.GMP'),p.retiredDestinationAlias),
    ready=await repeatReceivingMembership(before.filename,p.retiredDestinationAlias);
  for(const kind of Object.keys(receiving.records)) {
    const records={...ready.records[kind]},own=kind==='units'?unitId:kind==='agents'?agentId:'ORDR:'+unitId;
    if(!records[own])throw Error('Missing own original initial save');delete records[own];
    assert.deepEqual(records,receiving.records[kind],'Activation changed other original records');
    assert.equal(before.counts[kind],receiving.counts[kind]+1);
  }
  assert.deepEqual(before.queues.map(q=>q.filter(id=>id!==agentId)),receiving.queues);assert.equal(before.activeQueue,receiving.activeQueue);
  const evidence={...restored.evidenceSha256};
  for(const kind of ['Unit','GPL','Orders']) {
    const file=join(m.profile,`Return_Active_${kind}.bin`),bytes=await readFile(file),r=before.records[kind],source=await stoppedFileSource(before.filename);
    if(bytes.length>2048)throw Error('Unbounded active original writer');
    assert.equal(bytes.length,r.size);assert.equal(sha(bytes),r.sha256);assert.deepEqual(bytes,Buffer.from(await source.readAt(r.offset,r.size)));evidence[file]=sha(bytes);
  }
  assert.deepEqual([before.actor.position.x,before.actor.position.y],[motion.x,motion.y]);
  assert.deepEqual([after.actor.position.x,after.actor.position.y],[motion.savedX,motion.savedY]);
  const receipt=JSON.parse(await readFile(p.receipt));
  for(const key of ['family','description','playerNumber']) {
    assert.equal(before.actor[key],receipt.identity.actor[key]);assert.equal(after.actor[key],before.actor[key]);
  }
  if(before.sha256===after.sha256||before.records.Unit.sha256===after.records.Unit.sha256)throw Error('Original gameplay movement was not saved');
  for(const value of [before,after])evidence[value.filename]=value.sha256;
  return {...restored,scope:'One next-crossing NPC restored and retained in the actual256-grid receiving mission, 240 original movement/AI ticks, unchanged other initial actor/queue records and exact active original writers, followed by an original evolved full save. Outgoing removal, fresh reload, paired ownership publication, continuous paging and browser resources remain unqualified.',
    before,after,observedTicks:motion.ticks,motionSamples:motion.samples,originalPathCalls:motion.path,originalAgentCalls:motion.agents,
    originalContextActions:motion.executed,originalNextCrossingActivationQualified:true,actorMovementQualified:true,originalAiExecutionQualified:true,
    unchangedOtherRecordsOnActivation:restored.receivingWorld.recordsPreserved,otherInitialQueuesPreserved:true,
    originalEvolvedFullSaveQualified:true,observerHooksRemoved:true,originalActorFootprintAndDrawingQualified:true,renderedPixelsQualified:false,
    freshReceivingReloadQualified:false,pairedOwnershipHandoffQualified:false,repeatedGameplayCrossingsQualified:false,
    sourceSha256:{...restored.sourceSha256,'scripts/check-native-repeat-active.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:evidence};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [manifest,output]=process.argv.slice(2);if(!manifest||!output||process.argv.length!==4)throw Error('Usage: <terminal next active manifest> <fresh output|--stdout>');
  const r=await verifyRepeatActive(manifest);
  if(output==='--stdout')console.log(JSON.stringify(r));else {await writeFile(output,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,identity:r.identity,observedTicks:r.observedTicks,originalPathCalls:r.originalPathCalls,originalContextActions:r.originalContextActions,originalEvolvedFullSaveQualified:true}));}
}
