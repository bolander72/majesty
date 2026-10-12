// Explicit registered-hero home checks for revision identity version 2.
// This validates stopped snapshots; it does not migrate or activate a hero.
import {encodeHomeRecord,decodeHomeRecord,MAX_REGISTERED_GUILD_MEMBERS} from './hero-home.mjs';
import {verifyRemoteHomeAgent,MAX_REMOTE_HOME_BYTES} from './remote-home.mjs';
import {checkpointActorRecords,checkpointAgentValues,checkpointAgents,
  checkpointAgentQueues,checkpointContainerEntries,checkpointUnitAgentLinks} from './checkpoint.mjs';
import {Sha256} from './sha256.mjs';
import {regionKey} from './region.mjs';
import {verifyExploreRewardAssociation,MAX_HERO_EXPLORE_ASSOCIATIONS} from './reward-membership.mjs';
const hash=b=>new Sha256().update(b).hex();
const keys=(v,n)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...n].sort().join(',');
const positive=(n,max=0xffffffff)=>Number.isInteger(n)&&n>0&&n<=max;

export function registeredHeroHome(identity) {
  const r=identity.registeredHome,encoded=encodeHomeRecord(r);
  const record=decodeHomeRecord(encoded,{worldId:r.worldId,contentDigest:identity.contentDigest,guildEntityId:r.guildEntityId});
  if(record.revision||record.pending||record.lastOperation||!record.members.some(m=>m.entityId===identity.entityId)||
     identity.actor.family!=='VHCL'||identity.actor.playerNumber!==record.home.playerNumber||
     !identity.regions.includes(record.home.region))throw Error('Invalid registered hero origin identity');
  return {record,sha256:hash(encoded)};
}
export function canonicalHeroHomeAliases(input) {
  if(!Array.isArray(input)||input.length!==2)throw Error('Invalid hero home aliases');
  return input.map(a=>{
    if(!keys(a,['kind','unitId','agentId'])||!['native','proxy'].includes(a.kind)||!positive(a.agentId,0x7fffffff)||
       (a.kind==='native'?!positive(a.unitId):a.unitId!==0))throw Error('Invalid hero home alias');
    return {kind:a.kind,unitId:a.unitId,agentId:a.agentId};
  });
}

export function registeredHeroRegions(regions) {
  if(!Array.isArray(regions)||regions.length!==2||regions[0]===regions[1])throw Error('Invalid registered hero route regions');
  return regions.map(r=>{
    if(typeof r!=='string'||r.length>24)throw Error('Invalid registered hero route region');
    const p=r.split('_').map(Number);
    if(p.length!==2||regionKey(...p)!==r)throw Error('Invalid registered hero route region');return r;
  });
}

// The immutable identity binds the origin guild. A route can inspect other
// regions without changing that identity or borrowing a local guild.
export async function verifyRegisteredHeroHomes(identity,aliases,homeAliases,input,ownerSide,regions=identity.regions) {
  regions=registeredHeroRegions(regions);
  const registered=registeredHeroHome(identity),r=registered.record;
  const subject=r.members.find(m=>m.entityId===identity.entityId),homes=canonicalHeroHomeAliases(homeAliases);
  for(let side=0;side<2;side++) {
    await verifyHomeSnapshot(registered,subject,aliases[side],homes[side],input[side].source,side===ownerSide,regions[side]);
  }
}
export async function verifyRegisteredHeroSnapshot(identity,alias,homeAlias,source,present,region) {
  const registered=registeredHeroHome(identity),r=registered.record;
  // Keep the same alias validation as the existing paired format.
  const h=canonicalHeroHomeAliases([homeAlias,homeAlias])[0];
  registeredHeroRegions([region,region==='0_0'?'1_0':'0_0']);
  if(typeof present!=='boolean')throw Error('Invalid registered hero presence');
  return verifyHomeSnapshot(registered,r.members.find(m=>m.entityId===identity.entityId),alias,h,source,present,region);
}
async function verifyHomeSnapshot(registered,subject,own,h,source,present,region) {
    const r=registered.record,atHome=region===r.home.region;
    if(h.agentId===own.agentId||h.unitId===own.unitId)throw Error('Hero home alias collides with owner');
    if(atHome) {
      if(h.kind!=='native'||h.unitId!==r.home.unitId||h.agentId!==r.home.agentId)
        throw Error('Home region requires the actual registered native guild');
      const guild=await checkpointActorRecords(source,h.unitId);
      if(guild.agent.agentId!==h.agentId||guild.unit.family!=='BLDG'||guild.unit.description!==r.home.description||
         guild.unit.playerNumber!==r.home.playerNumber||(guild.unit.stateFlags&4))throw Error('Registered home guild differs');
      let root,rosterCount=0,memberCount=0,staleCount=0;const seen=new Set();
      for await(const v of checkpointAgentValues(source,h.agentId))if(v.attribute.toLowerCase()==='members') {
        if(!v.path.length){if(root||v.type!==4)throw Error('Invalid registered home script roster');root=v;}
        else {
          if(v.path.length!==1||v.type!==5||!v.targetAgentId||seen.has(v.targetAgentId)||++rosterCount>MAX_REGISTERED_GUILD_MEMBERS)
            throw Error('Unsupported registered home script roster');
          seen.add(v.targetAgentId);if(v.targetAgentId===own.agentId)memberCount++;
          if(subject.agentId!==own.agentId&&v.targetAgentId===subject.agentId)staleCount++;
        }
      }
      if(!root||root.childCount!==rosterCount||memberCount!==Number(present)||staleCount)
        throw Error('Registered hero script membership differs from owner');
      let resident=false;
      if(present) {
        const hero=await checkpointActorRecords(source,own.unitId);
        if(hero.unit.parentUnitId&&hero.unit.parentUnitId!==h.unitId)
          throw Error('Registered hero physical parent differs from home');
        resident=hero.unit.parentUnitId===h.unitId;
      }
      let groups=0,nativeMembers=0,staleMembers=0,parents=0,parentMembers=0;
      let physicalGroups=0,physicalMembers=0,stalePhysicalMembers=0;
      const rewards=new Set();
      for await(const c of checkpointContainerEntries(source)) {
        if(c.unitId===h.unitId&&c.groupKind===100) {
          if(c.groupOwnerUnitId!==h.unitId)throw Error('Invalid registered native roster owner');
          if(c.type==='group')groups++;
          else if(c.targetUnitId===own.unitId){if(c.flags!==1)throw Error('Invalid registered native member flags');nativeMembers++;}
          else if(subject.unitId!==own.unitId&&c.targetUnitId===subject.unitId)staleMembers++;
        }
        if(c.unitId===h.unitId&&c.groupKind===2) {
          if(c.groupOwnerUnitId!==h.unitId)throw Error('Invalid registered physical roster owner');
          if(c.type==='group')physicalGroups++;
          else if(c.targetUnitId===own.unitId){if(c.flags!==1)throw Error('Invalid registered physical member flags');physicalMembers++;}
          else if(subject.unitId!==own.unitId&&c.targetUnitId===subject.unitId)stalePhysicalMembers++;
        }
        if(present&&c.unitId===own.unitId&&c.groupKind===101) {
          if(c.groupOwnerUnitId!==own.unitId)throw Error('Invalid registered hero parent owner');
          if(c.type==='group')parents++;
          else if(c.targetUnitId===h.unitId&&c.flags===1)parentMembers++;
          else if(c.targetUnitId){
            if(c.flags!==1||rewards.has(c.targetUnitId)||rewards.size>=MAX_HERO_EXPLORE_ASSOCIATIONS)
              throw Error('Invalid registered hero reward association');
            await verifyExploreRewardAssociation(source,own.unitId,own.agentId,c.targetUnitId,r.home.playerNumber);
            rewards.add(c.targetUnitId);
          }
        }
      }
      if(groups>1||(present&&groups!==1)||nativeMembers!==Number(present)||staleMembers||
         (present&&(parents!==1||parentMembers!==1)))throw Error('Registered hero native membership differs from owner');
      if(physicalGroups>1||physicalMembers!==Number(resident)||stalePhysicalMembers)
        throw Error('Registered hero physical membership differs from residence');
    } else {
      if(h.kind!=='proxy')throw Error('Remote region requires a registered pure home proxy');
      let proxy;
      for await(const a of checkpointAgents(source))if(a.agentId===h.agentId)proxy=a;
      if(!proxy||proxy.size>MAX_REMOTE_HOME_BYTES)throw Error('Missing bounded registered home proxy');
      const bytes=await source.readAt(proxy.offset,proxy.size);
      if(!(bytes instanceof Uint8Array)||bytes.length!==proxy.size)throw Error('Truncated registered home proxy');
      const copied=Uint8Array.from(bytes);
      await verifyRemoteHomeAgent({size:copied.length,async readAt(at,n){return copied.slice(at,at+n);}},registered,h.agentId);
      for await(const q of checkpointAgentQueues(source))if(q.type==='queued-agent'&&q.agentId===h.agentId)
        throw Error('Registered home proxy is queued');
      for await(const u of checkpointUnitAgentLinks(source))if(u.agentId===h.agentId)
        throw Error('Registered home proxy has a native backlink');
      if(present){
        let groups=0;const rewards=new Set();
        for await(const c of checkpointContainerEntries(source))if(c.unitId===own.unitId&&c.groupKind===101){
          if(c.groupOwnerUnitId!==own.unitId)throw Error('Invalid remote hero association owner');
          if(c.type==='group'){
            if(++groups>1)throw Error('Duplicate remote hero association group');
          }else{
            if(!c.targetUnitId||c.flags!==1||rewards.has(c.targetUnitId)||rewards.size>=MAX_HERO_EXPLORE_ASSOCIATIONS)
              throw Error('Invalid remote hero reward association');
            try{
              await verifyExploreRewardAssociation(source,own.unitId,own.agentId,c.targetUnitId,r.home.playerNumber);
            }catch(cause){throw Error('Remote hero cannot borrow a local native home',{cause});}
            rewards.add(c.targetUnitId);
          }
        }
      }
    }
    if(present) {
      let home;
      for await(const v of checkpointAgentValues(source,own.agentId))if(!v.path.length&&v.attribute.toLowerCase()==='home') {
        if(home||v.type!==5||v.targetAgentId!==h.agentId)throw Error('Registered hero script home differs');home=v;
      }
      if(!home)throw Error('Registered hero has no script home');
    }
}
