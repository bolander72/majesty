// Inspect an original return-home task, without dispatching, moving or changing
// a hero. Remote home projection is still unsupported. Ownership comes from a
// selected EntityRevisionStore, never from a class/player or numeric ID match.
import {EntityRevisionStore} from './entity-revisions.mjs';
import {encodeHomeRecord,decodeHomeRecord,guildHomeFilename,MAX_REGISTERED_GUILD_MEMBERS} from './hero-home.mjs';
import {checkpointActorRecords,checkpointAgentValues,checkpointAgentQueues,
  checkpointContainerEntries} from './checkpoint.mjs';
import {Sha256} from './sha256.mjs';

const hash=b=>new Sha256().update(b).hex();
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const positive=(v,max=0xffffffff)=>Number.isInteger(v)&&v>0&&v<=max;
const clone=v=>JSON.parse(JSON.stringify(v));

// A pure checkpoint inspector: its owner argument must already have been
// bound to the input. Use readRegisteredHomeTask for persistent owner selection.
export async function inspectRegisteredHomeTask(source,{owner,registered,worldId,contentDigest}) {
  const encoded=encodeHomeRecord(registered?.record),sha256=hash(encoded);
  const r=decodeHomeRecord(encoded,{worldId,contentDigest,guildEntityId:registered.record.guildEntityId});
  if(sha256!==registered.sha256)throw Error('Registered home selection changed');
  owner=clone(owner);
  if(Object.keys(owner).sort().join(',')!=='agentId,entityId,region,unitId'||!digest(owner.entityId)||
     !positive(owner.unitId)||!positive(owner.agentId,0x7fffffff))throw Error('Invalid home task owner');
  guildHomeFilename({region:owner.region,unitId:owner.unitId,agentId:owner.agentId});
  if(!r.members.some(m=>m.entityId===owner.entityId))throw Error('Selected owner is not a registered home member');
  if(owner.region!==r.home.region)throw Error('Remote native home projection and return routing are not qualified');
  if(r.pending)throw Error('Registered home travel already pending');
  const actor=await checkpointActorRecords(source,owner.unitId);
  if(actor.agent.agentId!==owner.agentId||actor.unit.family!=='VHCL'||actor.unit.playerNumber!==r.home.playerNumber||
     (actor.unit.stateFlags&4))throw Error('Home task native owner differs');
  const fields=new Map();
  for await(const v of checkpointAgentValues(source,owner.agentId)) {
    if(v.path.length||!['home','target','taskname','activescript'].includes(v.attribute.toLowerCase()))continue;
    const name=v.attribute.toLowerCase();if(fields.has(name))throw Error('Duplicate home task attribute');fields.set(name,v);
  }
  const one=(name,type)=>{const v=fields.get(name);if(!v||v.type!==type)throw Error('Invalid home task '+name);return v;};
  const task=one('taskname',3);
  if(task.stringBytes>64)throw Error('Home task name exceeds bound');
  const text=await source.readAt(task.offset,task.stringBytes+1);
  if(!(text instanceof Uint8Array)||text.length!==task.stringBytes+1||text.at(-1)!==0||text.subarray(0,-1).includes(0))
    throw Error('Invalid home task text');
  if(new TextDecoder('utf-8',{fatal:true}).decode(text.subarray(0,-1))!=='go_home')return null;
  const functions=one('activescript',8).functions;
  if(functions.length!==1||functions[0].slot!==0||!['use_building','travel_to'].includes(functions[0].name))
    throw Error('Unsupported home task continuation');
  if(one('home',5).targetAgentId!==r.home.agentId||one('target',5).targetAgentId!==r.home.agentId||actor.unit.parentUnitId!==0)
    throw Error('Home task does not target its registered native guild');
  let queued=0;
  for await(const row of checkpointAgentQueues(source))if(row.type==='queued-agent'&&row.agentId===owner.agentId)queued++;
  if(queued!==1)throw Error('Home task owner is not uniquely queued');
  const guild=await checkpointActorRecords(source,r.home.unitId);
  if(guild.agent.agentId!==r.home.agentId||guild.unit.family!=='BLDG'||guild.unit.description!==r.home.description||
     guild.unit.playerNumber!==r.home.playerNumber||(guild.unit.stateFlags&4))throw Error('Registered native guild differs');
  let roster,memberCount=0,heroCount=0;const seen=new Set();
  for await(const v of checkpointAgentValues(source,r.home.agentId))if(v.attribute.toLowerCase()==='members') {
    if(!v.path.length){if(roster||v.type!==4)throw Error('Invalid home guild roster');roster=v;}
    else {
      if(v.path.length!==1||v.type!==5||!v.targetAgentId||seen.has(v.targetAgentId)||++memberCount>MAX_REGISTERED_GUILD_MEMBERS)
        throw Error('Unsupported home guild roster');
      seen.add(v.targetAgentId);if(v.targetAgentId===owner.agentId)heroCount++;
    }
  }
  if(!roster||roster.childCount!==memberCount||heroCount!==1)throw Error('Home task missing reciprocal script membership');
  const links=[{unitId:r.home.unitId,kind:100,target:owner.unitId},{unitId:owner.unitId,kind:101,target:r.home.unitId}];
  const groups=[0,0],members=[0,0];
  for await(const v of checkpointContainerEntries(source))for(const [i,link] of links.entries()) {
    if(v.unitId!==link.unitId||v.groupKind!==link.kind)continue;
    if(v.groupOwnerUnitId!==link.unitId)throw Error('Invalid home task reciprocal owner');
    if(v.type==='group')groups[i]++;
    else if(v.targetUnitId===link.target){if(v.flags!==1)throw Error('Invalid home task reciprocal flags');members[i]++;}
  }
  if([...groups,...members].some(n=>n!==1))throw Error('Home task missing reciprocal native membership');
  return {version:1,kind:'local-home',worldId,contentDigest,heroEntityId:owner.entityId,guildEntityId:r.guildEntityId,
    owner,home:{region:r.home.region,unitId:r.home.unitId,agentId:r.home.agentId},task:'go_home',
    continuation:functions[0].name,homeRevision:r.revision,homeSha256:sha256,occupiedSlots:r.members.length};
}

// Home records and selected owner files must reside on this store's adapter,
// sharing its lock. Both are checked inside one read scope, with no nested lock
// or directory scan. The returned plan is read-only; a later commit must CAS
// both returned revision tokens before modifying native or persisted state.
export function readRegisteredHomeTask(store,options) {
  if(!(store instanceof EntityRevisionStore))throw Error('Home task requires a selected entity revision store');
  const o=clone(options),identity=store.identity;
  if(!digest(o.worldId)||!digest(o.guildEntityId)||!digest(o.expectedHomeSha256)||
     typeof o.expectedManifest!=='string'||o.expectedManifest.length>256)throw Error('Invalid selected home task request');
  const filename=guildHomeFilename(o.homeAlias);
  return store.withSelectedMetadata(filename,async selected=>{
    if(!selected)throw Error('Missing selected home task owner');
    if(selected.record.manifest!==o.expectedManifest)throw Error('Home task owner revision changed');
    if(!selected.metadata||hash(selected.metadata)!==o.expectedHomeSha256)throw Error('Home task home revision changed');
    const registered={record:decodeHomeRecord(selected.metadata,{worldId:o.worldId,contentDigest:identity.contentDigest,
      guildEntityId:o.guildEntityId}),sha256:o.expectedHomeSha256};
    const h=registered.record.home;
    if(guildHomeFilename({region:h.region,unitId:h.unitId,agentId:h.agentId})!==filename)throw Error('Home task lookup alias differs');
    const request=await inspectRegisteredHomeTask(selected.sources[selected.record.state.ownerSide],
      {owner:selected.owner,registered,worldId:o.worldId,contentDigest:identity.contentDigest});
    return {request,ownerManifest:selected.record.manifest,ownerRevision:selected.record.revision,
      sourceWorld:clone(selected.record.worlds[selected.record.state.ownerSide])};
  });
}
