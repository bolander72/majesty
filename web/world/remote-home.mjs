// Inert original GPL records representing a registered guild in another region.
// A proposal is not a reserved native ID. It is never queued as a guild script
// and is intentionally not a valid native game piece. Routing must intercept
// building use before the original validity guard.
import {encodeHomeRecord,decodeHomeRecord,guildHomeFilename} from './hero-home.mjs';
import {checkpointAgents,checkpointAgentRecord,checkpointAgentRecordValues} from './checkpoint.mjs';
import {Sha256} from './sha256.mjs';

export const MAX_REMOTE_HOME_BYTES=1024;
const sha=b=>new Sha256().update(b).hex();
const encoder=new TextEncoder();
const word=n=>{const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,true);return b;};
const join=parts=>{const b=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){b.set(p,at);at+=p.length;}return b;};
const string=s=>join([encoder.encode(s),new Uint8Array(1)]);
const envelope=(v,body)=>join([word(body.length+16),word(v),body,word(0),word(0xffffffff)]);
const source=b=>({size:b.length,async readAt(at,n){return b.slice(at,at+n);}});
const fields=r=>[
  ['frontier_proxy','majesty-remote-home-v1'],['world_id',r.worldId],['content_digest',r.contentDigest],
  ['guild_entity_id',r.guildEntityId],['home_region',r.home.region],['home_unit_id',r.home.unitId],
  ['home_agent_id',r.home.agentId],['home_description',r.home.description],['home_player',r.home.playerNumber],
].sort(([a],[b])=>a<b?-1:a>b?1:0);

export function encodeRemoteHomeAgent(record,agentId) {
  // Revalidate the persistent origin chain; caller labels cannot rehome a guild.
  const r=decodeHomeRecord(encodeHomeRecord(record),{worldId:record.worldId,contentDigest:record.contentDigest,guildEntityId:record.guildEntityId});
  if(!Number.isInteger(agentId)||agentId<1||agentId>0x7fffffff)throw Error('Invalid remote home agent proposal');
  const entries=fields(r),attrs=envelope(0,join([word(entries.length),...entries.flatMap(([name,v])=>[
    string(name),word(typeof v==='string'?3:1),typeof v==='string'?string(v):word(v),
  ])]));
  const bytes=envelope(2,join([attrs,word(0),word(agentId),string(''),word(0),new Uint8Array(1),word(0),new Uint8Array(2)]));
  if(bytes.length>MAX_REMOTE_HOME_BYTES)throw Error('Remote home record exceeds bound');
  return bytes;
}

export async function verifyRemoteHomeAgent(input,registered,expectedAgentId) {
  if(!input||!Number.isInteger(input.size)||input.size<56||input.size>MAX_REMOTE_HOME_BYTES)
    throw Error('Invalid remote home record size');
  const original=encodeHomeRecord(registered.record);
  if(sha(original)!==registered.sha256)throw Error('Remote home registration changed');
  const r=decodeHomeRecord(original,{worldId:registered.record.worldId,contentDigest:registered.record.contentDigest,
    guildEntityId:registered.record.guildEntityId});
  const actor=await checkpointAgentRecord(input);
  if(actor.agentId!==expectedAgentId||actor.unitId||actor.deleted||actor.name||actor.functionNameCount||
     actor.attributes.declaredCount!==fields(r).length)throw Error('Remote home must be an inert pure agent');
  const values=[];for await(const v of checkpointAgentRecordValues(input))values.push(v);
  const expected=fields(r);
  if(values.length!==expected.length)throw Error('Invalid remote home attributes');
  for(let i=0;i<values.length;i++) {
    const v=values[i],[name,value]=expected[i];
    if(v.path.length||v.attribute!==name||v.type!==(typeof value==='string'?3:1))throw Error('Remote home attribute differs');
    if(typeof value==='string') {
      const bytes=string(value);if(v.stringBytes!==bytes.length-1)throw Error('Remote home identity differs');
      const actual=await input.readAt(v.offset,bytes.length);
      if(!(actual instanceof Uint8Array)||actual.length!==bytes.length||actual.some((b,n)=>b!==bytes[n]))throw Error('Remote home identity differs');
    } else if(v.bits!==(value>>>0))throw Error('Remote home origin differs');
  }
  const canonical=encodeRemoteHomeAgent(r,expectedAgentId),bytes=await input.readAt(0,input.size);
  if(!(bytes instanceof Uint8Array)||bytes.length!==canonical.length||bytes.some((b,i)=>b!==canonical[i]))
    throw Error('Noncanonical remote home agent');
  return {agentId:actor.agentId,unitId:0,bytes:bytes.length,sha256:sha(bytes),guildEntityId:r.guildEntityId};
}

export async function prepareRemoteHomeAgent(destination,registered,{worldId,contentDigest,destinationRegion,freshAgentId}) {
  const encoded=encodeHomeRecord(registered.record),r=decodeHomeRecord(encoded,
    {worldId,contentDigest,guildEntityId:registered.record.guildEntityId});
  if(sha(encoded)!==registered.sha256)throw Error('Remote home registration changed');
  guildHomeFilename({region:destinationRegion,unitId:r.home.unitId,agentId:r.home.agentId});
  if(destinationRegion===r.home.region)throw Error('Remote home requires another region');
  const bytes=encodeRemoteHomeAgent(r,freshAgentId);
  for await(const a of checkpointAgents(destination))if(a.agentId===freshAgentId)throw Error('Remote home proposal already occupied');
  const checked=await verifyRemoteHomeAgent(source(bytes),registered,freshAgentId);
  return {record:bytes,plan:{version:1,worldId,contentDigest,guildEntityId:r.guildEntityId,home:r.home,
    destinationRegion,proposedAgentId:freshAgentId,identityOffset:bytes.length-24,recordSha256:checked.sha256,
    recordBytes:bytes.length,registeredHomeSha256:registered.sha256,
    requirements:['reserve a fresh original runtime agent ID','register without active queues or native association',
      'intercept registered go_home before the original building-use validity guard',
      'restore the actual home guild and reciprocal rosters before resuming building use'],
    nativeHomeProjectionQualified:false,heroCrossingQualified:false}};
}
