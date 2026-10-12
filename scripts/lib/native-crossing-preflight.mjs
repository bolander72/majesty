// Known typed incoming references in an already hash-verified stopped world.
import {checkpointUnits,checkpointAgents,checkpointAgentReferencePlan,checkpointUnitAgentLinks,
  checkpointContainerEntries,checkpointAttachments,checkpointAgentQueues} from '../../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from './native-crossing-order-entries.mjs';
const targets=new Map([[2,25],[4,25],[6,25],[11,46]]);
export async function crossingDeparturePreflight(source,{unitId,agentId}) {
  const incoming=[],unsupportedOrders=[];let units=0,agents=0,orderAttachments=0,orderTargets=0,selfReferences=0,actor=0,script=0;
  function reference(value) {if(incoming.length>=256)throw Error('Crossing incoming reference budget exceeded');incoming.push(value);}
  for await(const u of checkpointUnits(source)) {
    if(++units>5000)throw Error('Crossing unit membership budget exceeded');
    if(u.primary.words[1]===unitId){if(u.primary.words[6])throw Error('Crossing actor has a parent');++actor;}
    if(u.primary.words[6]===unitId)reference({kind:'parent',unitId:u.primary.words[1]});
  }
  for await(const a of checkpointAgents(source)) {
    if(++agents>5000)throw Error('Crossing script membership budget exceeded');
    if(a.agentId===agentId){if(a.unitId!==unitId||a.deleted)throw Error('Crossing actor script differs');++script;}
    for(const r of await checkpointAgentReferencePlan(source,a.agentId,id=>id))if(r.before===agentId) {
      if(a.agentId===agentId)++selfReferences;else reference({kind:'script',agentId:a.agentId,attribute:r.attribute,path:r.path});
    }
    if(a.unitId===unitId&&a.agentId!==agentId)reference({kind:'script-native-link',agentId:a.agentId});
  }
  for await(const u of checkpointUnitAgentLinks(source))if(u.agentId===agentId&&u.unitId!==unitId)reference({kind:'native-script-link',unitId:u.unitId});
  for await(const m of checkpointContainerEntries(source))if(m.type==='member'&&(m.targetUnitId===unitId||m.unitId===unitId))
    reference({kind:'container',unitId:m.unitId,targetUnitId:m.targetUnitId});
  let attachments=0;
  for await(const a of checkpointAttachments(source)) {
    if(++attachments>5000)throw Error('Crossing attachment membership budget exceeded');
    if(a.kind!=='ORDR')continue;++orderAttachments;
    try {
      for await(const r of checkpointActorOrderEntries(source,a.unitId)) {
        if(r.type!=='entry'||!targets.has(r.kind))continue;
        if(++orderTargets>65536)throw Error('Crossing order reference budget exceeded');
        if(r.words[targets.get(r.kind)]===unitId&&a.unitId!==unitId)reference({kind:'order',unitId:a.unitId,bank:r.bank,index:r.index,orderKind:r.kind});
      }
    } catch(e) {
      if(e.code!=='NATIVE_ORDER_KIND_UNSUPPORTED')throw e;
      if(unsupportedOrders.length>=256)throw Error('Crossing unsupported command budget exceeded');
      unsupportedOrders.push({unitId:a.unitId,kind:e.kind});
    }
  }
  if(actor!==1||script!==1||selfReferences!==2)throw Error('Unsupported crossing actor/script profile');
  let queuedActor=0,queuedAgents=0;
  for await(const r of checkpointAgentQueues(source))if(r.type==='queued-agent') {
    if(++queuedAgents>5000)throw Error('Crossing queue membership budget exceeded');queuedActor+=r.agentId===agentId;
  }
  if(queuedActor!==1)throw Error('Crossing actor has no unique saved schedule');
  return {qualified:incoming.length===0&&unsupportedOrders.length===0,unitId,agentId,units,agents,attachments,orderAttachments,orderTargets,
    selfReferences,incoming,unsupportedOrders,queuedActor,queuedAgents,completeReferenceClosureQualified:false};
}
