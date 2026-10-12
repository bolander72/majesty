import {createHash} from 'node:crypto';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointActorRecords,
  checkpointPlacements,checkpointAgentQueues} from '../../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../../web/world/order-entries.mjs';
import {hashCheckpointSource} from '../../web/world/transfer-store.mjs';
export async function returnedCheckpoint(filename,{unitId,agentId,retiredUnitId=2101,retiredAgentId=37}) {
  const source=await stoppedFileSource(filename),counts={},ranges={};
  for(const [kind,iterator,key] of [['units',checkpointUnits(source),r=>r.primary.words[1]],['agents',checkpointAgents(source),r=>r.agentId],
    ['attachments',checkpointAttachments(source),r=>r.kind+':'+r.unitId]]) {
    const seen=new Set();
    for await(const r of iterator) {
      const id=key(r);if(seen.size>=5000||seen.has(id))throw Error('Invalid returned-world record membership');seen.add(id);
      if(kind==='units'&&id===retiredUnitId||kind==='agents'&&id===retiredAgentId||kind==='attachments'&&id==='ORDR:'+retiredUnitId)
        throw Error('Retired receiving identity resurrected');
      if(kind==='attachments'&&id==='ORDR:'+unitId)ranges.Orders={offset:r.primary.offset+16,size:r.primary.size};
    }
    counts[kind]=seen.size;
  }
  const {unit,agent}=await checkpointActorRecords(source,unitId);
  if(unit.agentId!==agentId||agent.agentId!==agentId||agent.unitId!==unitId||unit.parentUnitId||unit.stateFlags&4)throw Error('Invalid returned saved identity or live state');
  ranges.Unit={offset:unit.offset,size:unit.size};ranges.GPL={offset:agent.offset,size:agent.size};
  if(Object.keys(ranges).length!==3)throw Error('Missing saved return commands');
  const records={};
  for(const [kind,r] of Object.entries(ranges)) {
    if(r.size<1||r.size>2048)throw Error('Returned record exceeds bound');
    records[kind]={...r,sha256:createHash('sha256').update(await source.readAt(r.offset,r.size)).digest('hex')};
  }
  let position,activeQueue,queued=0;const queues=[[],[]],seen=new Set();
  for await(const r of checkpointPlacements(source))if(r.unitId===unitId)position=r.fixedPosition;
  for await(const r of checkpointAgentQueues(source)) {
    if(r.type==='queue-selector')activeQueue=r.activeQueue;
    else {if(seen.has(r.agentId))throw Error('Duplicate saved queue member');seen.add(r.agentId);queues[r.queue].push(r.agentId);queued+=r.agentId===agentId;}
  }
  if(queued!==1||!position)throw Error('Returned actor lacks saved position or unique schedule');
  const orderEntries=[];for await(const r of checkpointActorOrderEntries(source,unitId))if(r.type==='entry')orderEntries.push({bank:r.bank,index:r.index,kind:r.kind});
  return {filename,bytes:source.size,sha256:await hashCheckpointSource(source),counts,records,
    actor:{unitId,agentId,family:unit.family,description:unit.description,playerNumber:unit.playerNumber,position},queued,queues,activeQueue,orderEntries};
}
