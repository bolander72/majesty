// Reuse one inert projection per logical guild in a selected destination save.
// Sequential bounded record inspection; never cache an agent pointer across a
// native world unload. The caller must keep the selected snapshot read lease.
import {encodeHomeRecord,decodeHomeRecord,guildHomeFilename} from './hero-home.mjs';
import {checkpointAgents,checkpointAgentRecordValues,checkpointAgentQueues,checkpointUnitAgentLinks} from './checkpoint.mjs';
import {prepareRemoteHomeAgent,verifyRemoteHomeAgent,MAX_REMOTE_HOME_BYTES} from './remote-home.mjs';
import {Sha256} from './sha256.mjs';
const hash=b=>new Sha256().update(b).hex();
export async function prepareOrReuseRemoteHomeAgent(destination,registered,options) {
  const o={...options},encoded=encodeHomeRecord(registered.record);
  const r=decodeHomeRecord(encoded,{worldId:o.worldId,contentDigest:o.contentDigest,guildEntityId:registered.record.guildEntityId});
  const captured={record:r,sha256:registered.sha256};
  if(hash(encoded)!==captured.sha256)throw Error('Remote home registration changed');
  guildHomeFilename({region:o.destinationRegion,unitId:r.home.unitId,agentId:r.home.agentId});
  if(o.destinationRegion===r.home.region)throw Error('Remote home requires another region');
  let selected;
  for await(const a of checkpointAgents(destination)) {
    if(a.deleted||a.size>MAX_REMOTE_HOME_BYTES)continue;
    const read=await destination.readAt(a.offset,a.size);
    if(!(read instanceof Uint8Array)||read.length!==a.size)throw Error('Truncated remote home candidate');
    const bytes=Uint8Array.from(read);
    const input={size:bytes.length,async readAt(at,n){return bytes.slice(at,at+n);}};
    let sameGuild=false;
    for await(const v of checkpointAgentRecordValues(input))if(v.attribute==='guild_entity_id'&&!v.path.length&&v.type===3&&v.stringBytes===64) {
      const text=new TextDecoder('utf-8',{fatal:true}).decode(await input.readAt(v.offset,64));
      if(text===r.guildEntityId)sameGuild=true;
    }
    if(!sameGuild)continue;
    if(selected)throw Error('Duplicate remote home guild projections');
    const checked=await verifyRemoteHomeAgent(input,captured,a.agentId);
    selected={record:Uint8Array.from(bytes),checked};
  }
  if(!selected) {
    const result=await prepareRemoteHomeAgent(destination,captured,o);
    result.plan.admission='reserve-new';return result;
  }
  const id=selected.checked.agentId;
  for await(const q of checkpointAgentQueues(destination))if(q.type==='queued-agent'&&q.agentId===id)
    throw Error('Remote home projection must remain unscheduled');
  for await(const u of checkpointUnitAgentLinks(destination))if(u.agentId===id)
    throw Error('Remote home projection has a native backlink');
  return {record:selected.record,plan:{version:1,admission:'reuse-existing',worldId:r.worldId,contentDigest:r.contentDigest,
    guildEntityId:r.guildEntityId,home:r.home,destinationRegion:o.destinationRegion,proposedAgentId:id,
    identityOffset:selected.record.length-24,recordSha256:selected.checked.sha256,recordBytes:selected.record.length,
    registeredHomeSha256:captured.sha256,requirements:['retain the existing unscheduled pure home identity',
      'intercept registered go_home before the original building-use validity guard',
      'restore the actual home guild and reciprocal rosters before resuming building use'],
    nativeHomeProjectionQualified:false,heroCrossingQualified:false}};
}
