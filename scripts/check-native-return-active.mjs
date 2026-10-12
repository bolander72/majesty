#!/usr/bin/env node
// Qualify a stopped, original-engine return activation and evolved full save.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyReturnRestoration} from './check-native-private-return.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointActorRecords,
  checkpointPlacements,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {returnedMotion} from './lib/native-return-motion.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function verifyActiveReturn(manifestName) {
  const restored=await verifyReturnRestoration(manifestName,{active:true}),m=restored.fixture;
  const {unitId,agentId}=restored.identity,log=await readFile(m.log,'utf8');
  const initial=await readFile(join(m.profile,'Return_Unit_Observed.bin'));
  const {frame,clock,x,y,ticks,calls,leaves,path,samples,agents,contexts,executed,savedClock,savedX,savedY}=
    returnedMotion(log,{unitId,agentId,clock:restored.clock,x:initial.readInt32LE(60),y:initial.readInt32LE(64)});
  async function inspect(label) {
    const filename=join(m.profile,'Documents/My Games/MajestyHD/SaveGame',label+'.GMP'),source=await stoppedFileSource(filename);
    const counts={},ranges={};
    for(const [kind,iterator,key] of [['units',checkpointUnits(source),r=>r.primary.words[1]],['agents',checkpointAgents(source),r=>r.agentId],
      ['attachments',checkpointAttachments(source),r=>r.kind+':'+r.unitId]]) {
      const seen=new Set();
      for await(const r of iterator) {
        const id=key(r);if(seen.size>=5000||seen.has(id))throw Error('Invalid returned-world membership');seen.add(id);
        if(kind==='units'&&id===m.unitId||kind==='agents'&&id===m.agentId||kind==='attachments'&&id==='ORDR:'+m.unitId)
          throw Error('Retired receiving identity resurrected');
        if(kind==='attachments'&&id==='ORDR:'+unitId)ranges.Orders={offset:r.primary.offset+16,size:r.primary.size};
      }
      counts[kind]=seen.size;
    }
    const {unit,agent}=await checkpointActorRecords(source,unitId);
    if(unit.agentId!==agentId||agent.agentId!==agentId||agent.unitId!==unitId||unit.parentUnitId||unit.stateFlags&4)throw Error('Broken saved return identity or live state');
    ranges.Unit={offset:unit.offset,size:unit.size};ranges.GPL={offset:agent.offset,size:agent.size};
    if(Object.keys(ranges).length!==3)throw Error('Missing returned actor records');
    const records={};
    for(const [kind,r] of Object.entries(ranges)) {
      if(r.size<1||r.size>2048)throw Error('Returned record exceeds bound');
      const bytes=await source.readAt(r.offset,r.size);records[kind]={...r,sha256:sha(bytes)};
      if(label==='Joint_Return_Ready')assert.deepEqual(Buffer.from(bytes),await readFile(join(m.profile,`Return_Active_${kind}.bin`)),`Original active ${kind} full-save writer differs`);
    }
    let position,activeQueue,queued=0;const queues=[[],[]],seen=new Set();
    for await(const r of checkpointPlacements(source))if(r.unitId===unitId)position=r.fixedPosition;
    for await(const r of checkpointAgentQueues(source)) {
      if(r.type==='queue-selector')activeQueue=r.activeQueue;
      else {if(seen.has(r.agentId))throw Error('Duplicate saved queue member');seen.add(r.agentId);queues[r.queue].push(r.agentId);queued+=r.agentId===agentId;}
    }
    if(queued!==1||!position)throw Error('Returned actor missing saved position or unique queue');
    const orderEntries=[];for await(const r of checkpointActorOrderEntries(source,unitId))if(r.type==='entry')orderEntries.push({bank:r.bank,index:r.index,kind:r.kind});
    return {filename,bytes:source.size,sha256:await hashCheckpointSource(source),counts,records,actor:{unitId,agentId,family:unit.family,description:unit.description,playerNumber:unit.playerNumber,position},queued,queues,activeQueue,orderEntries};
  }
  const before=await inspect('Joint_Return_Ready'),after=await inspect('Joint_Evolved');
  assert.deepEqual(before.counts,{units:1960,agents:71,attachments:83});
  // Before original simulation resumes, insertion must leave every other
  // saved unit, GPL agent and attachment byte-for-byte unchanged.
  async function survivingRecords(filename,excludeNewActor) {
    const source=await stoppedFileSource(filename),records={};
    for(const [kind,iterator,key] of [['units',checkpointUnits(source),r=>r.primary.words[1]],['agents',checkpointAgents(source),r=>r.agentId],
      ['attachments',checkpointAttachments(source),r=>r.kind+':'+r.unitId]]) {
      records[kind]={};let count=0;
      for await(const r of iterator) {
        const id=key(r);if(excludeNewActor&&(kind==='units'&&id===unitId||kind==='agents'&&id===agentId||kind==='attachments'&&id==='ORDR:'+unitId))continue;
        if(++count>5000||Object.hasOwn(records[kind],id))throw Error('Invalid surviving return record');
        const h=createHash('sha256');for(let at=0;at<r.size;at+=4096)h.update(await source.readAt(r.offset+at,Math.min(4096,r.size-at)));
        records[kind][id]={bytes:r.size,sha256:h.digest('hex')};
      }
    }
    return records;
  }
  assert.deepEqual(await survivingRecords(before.filename,true),await survivingRecords(restored.receivingWorld.snapshot.filename,false),'Return activation changed unrelated saved actor records');
  const receivingSource=await stoppedFileSource(restored.receivingWorld.snapshot.filename),receivingQueues=[[],[]];let receivingSelector;
  for await(const r of checkpointAgentQueues(receivingSource))if(r.type==='queue-selector')receivingSelector=r.activeQueue;else receivingQueues[r.queue].push(r.agentId);
  assert.deepEqual(before.queues.map(q=>q.filter(id=>id!==agentId)),receivingQueues,'Return activation changed other saved queues');
  assert.equal(before.activeQueue,receivingSelector);
  assert.deepEqual([before.actor.position.x,before.actor.position.y],[x,y]);
  assert.deepEqual([after.actor.position.x,after.actor.position.y],[savedX,savedY]);
  if(before.sha256===after.sha256||before.records.Unit.sha256===after.records.Unit.sha256)throw Error('Returned movement did not persist');
  const capsule=JSON.parse(await readFile(m.privateReturnPacket.returnReport,'utf8'));
  const evolvedProducer=JSON.parse(await readFile(capsule.plan.captureReport,'utf8'));
  for(const phase of [before,after])for(const key of ['family','description','playerNumber'])assert.equal(phase.actor[key],evolvedProducer.after.actor[key]);
  assert.deepEqual(before.orderEntries,[{bank:0,index:0,kind:2},{bank:0,index:1,kind:4},{bank:1,index:0,kind:6}]);
  return {...restored,scope:'One original native returned NPC activated in the receiving world, 240 original movement/AI ticks, exact original active writers in the initial full save and current position/identity/orders/queue in an evolved full save. Fresh reload, outgoing owner removal, paired publication, repeated journeys and browser resources unqualified.',
    before,after,frame,observedTicks:ticks,motionSamples:samples,originalDispatchCalls:calls,originalLeafCalls:leaves,originalPathCalls:path,
    originalAgentCalls:agents,originalContextCalls:contexts,originalContextActions:executed,
    commands:{...restored.commands,inFlightMoveLinkExecutionQualified:true},originalReturnActivationQualified:true,
    actorMovementQualified:true,originalAiExecutionQualified:true,physicalMembershipOfDeclaredFootprintQualified:true,drawingRegistrationQualified:true,
    observerHooksRemoved:true,originalReturnedFullSaveQualified:true,saveDoesNotMutateObservedStateQualified:true,
    unchangedOtherRecordsOnReturnActivation:2111,otherSavedQueuesOnReturnActivationPreserved:true,
    freshReturnedWorldReloadQualified:false,renderedPixelsQualified:false,
    changedActorWriters:Object.keys(after.records).filter(k=>after.records[k].sha256!==before.records[k].sha256),
    sourceSha256:{...restored.sourceSha256,'scripts/check-native-return-active.mjs':sha(await readFile(new URL(import.meta.url))),
      'scripts/lib/native-return-motion.mjs':sha(await readFile(new URL('./lib/native-return-motion.mjs',import.meta.url))),
      'scripts/check-native-npc-departed-reload.mjs':sha(await readFile(new URL('./check-native-npc-departed-reload.mjs',import.meta.url)))}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [manifest,output]=process.argv.slice(2);if(!manifest||!output||process.argv.length!==4)throw Error('Usage: <terminal returned actor manifest> <fresh report|--stdout>');
  const report=await verifyActiveReturn(manifest);
  if(output==='--stdout')console.log(JSON.stringify(report));else {
    await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({qualified:true,identity:report.identity,observedTicks:report.observedTicks,originalContextActions:report.originalContextActions,counts:report.after.counts,freshReturnedWorldReloadQualified:false}));
  }
}
