// Original Explore flags use the same reciprocal native groups as guilds.
// Validate the flag's native AND script roster before accepting that extra
// relationship. This neither transfers the flag nor supplies a hero home.
import {checkpointActorRecords,checkpointAgentValues,checkpointContainerEntries} from './checkpoint.mjs';
export const MAX_HERO_EXPLORE_ASSOCIATIONS=4;
const MAX_REWARD_HEROES=64,EXPLORE_DESCRIPTION=0x34415241;
export async function verifyExploreRewardAssociation(source,unitId,agentId,flagId,playerNumber){
  const flag=await checkpointActorRecords(source,flagId);
  if(flag.unit.family!=='RWRD'||flag.unit.description!==EXPLORE_DESCRIPTION||
     flag.unit.playerNumber!==playerNumber||flag.unit.parentUnitId||(flag.unit.stateFlags&4)||
     flag.agent.deleted||flag.agent.agentId===agentId)throw Error('Registered hero has another native home');
  let root;const agents=new Set();
  for await(const v of checkpointAgentValues(source,flag.agent.agentId))if(v.attribute.toLowerCase()==='heroes'){
    if(!v.path.length){if(root||v.type!==4)throw Error('Invalid Explore reward script roster');root=v;}
    else {
      if(v.path.length!==1||v.type!==5||!v.targetAgentId||agents.has(v.targetAgentId)||agents.size>=MAX_REWARD_HEROES)
        throw Error('Invalid Explore reward script member');
      agents.add(v.targetAgentId);
    }
  }
  if(!root||root.childCount!==agents.size||!agents.has(agentId))throw Error('Explore reward script membership differs');
  let group;const units=new Set();
  for await(const c of checkpointContainerEntries(source))if(c.unitId===flagId&&c.groupKind===100){
    if(c.groupOwnerUnitId!==flagId)throw Error('Invalid Explore reward native roster owner');
    if(c.type==='group'){if(group)throw Error('Duplicate Explore reward native roster');group=c;}
    else {
      if(!c.targetUnitId||c.flags!==1||units.has(c.targetUnitId)||units.size>=MAX_REWARD_HEROES)
        throw Error('Invalid Explore reward native member');
      units.add(c.targetUnitId);
    }
  }
  if(!group||group.memberCount!==units.size||!units.has(unitId)||units.size!==agents.size)
    throw Error('Explore reward native membership differs');
  const matched=new Set();
  for(const id of units){
    const member=await checkpointActorRecords(source,id);
    if(member.unit.family!=='VHCL'||member.unit.playerNumber!==playerNumber||(member.unit.stateFlags&4)||
       !agents.has(member.agent.agentId)||matched.has(member.agent.agentId))throw Error('Explore reward native and script rosters differ');
    matched.add(member.agent.agentId);
  }
  if(matched.size!==agents.size)throw Error('Explore reward native and script rosters differ');
  return {unitId:flagId,agentId:flag.agent.agentId};
}
