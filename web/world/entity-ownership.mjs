// Known typed ownership/reference checks; callers validate bounded aliases first.
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAgentQueues,checkpointAgentReferencePlan,
  checkpointAbsentAgentReferences,checkpointContainerEntries} from './checkpoint.mjs';
import {checkpointActorOrderUnitReferences} from './order-unit-bindings.mjs';
import {verifyRegisteredHeroHomes} from './entity-home-ownership.mjs';
export async function verifyEntityOwnership(identity,aliases,referenceBindings,input,ownerSide,homeAliases,regions=identity.regions) {
    if(identity.version===2)await verifyRegisteredHeroHomes(identity,aliases,homeAliases,input,ownerSide,regions);
    const records=[];
    for(let side=0;side<2;++side){
      const own=aliases[side],present=side===ownerSide,refs=referenceBindings.map(b=>side?b.destination:b.source);
      const wanted=new Map([[own.unitId,own],...refs.map(a=>[a.unitId,a])]),units=new Map(),agents=new Map();
      for await(const unit of checkpointUnitAgentLinks(input[side].source))if(wanted.has(unit.unitId)){
        if(units.has(unit.unitId))throw Error('Duplicate entity native alias');units.set(unit.unitId,unit);
      }
      const home=identity.version===2?homeAliases[side]:null;
      const wantedAgents=new Set([...wanted.values()].map(a=>a.agentId));
      if(home)wantedAgents.add(home.agentId);
      for await(const agent of checkpointAgents(input[side].source))if(wantedAgents.has(agent.agentId))agents.set(agent.agentId,agent);
      const native=units.get(own.unitId),script=agents.get(own.agentId);
      let queued=0;
      for await(const entry of checkpointAgentQueues(input[side].source))if(entry.type==='queued-agent'&&entry.agentId===own.agentId)++queued;
      if(present){
        const parentAllowed=!native?.parentUnitId||(home?.kind==='native'&&native.parentUnitId===home.unitId);
        if(!native||native.agentId!==own.agentId||!parentAllowed||native.stateFlags&4||!script||script.deleted||script.unitId!==own.unitId||queued!==1||
            native.family!==identity.actor.family||native.description!==identity.actor.description||native.playerNumber!==identity.actor.playerNumber)
          throw Error('Owned entity native/script/scheduling state differs');
        const allowed=new Set([own.agentId,...refs.map(a=>a.agentId)]);
        if(home)allowed.add(home.agentId);
        for(const ref of await checkpointAgentReferencePlan(input[side].source,own.agentId,id=>id))
          if(!allowed.has(ref.before))throw Error('Undeclared entity script reference');
        const allowedUnits=new Set([own.unitId,...refs.map(a=>a.unitId)]);
        if(home?.kind==='native')allowedUnits.add(home.unitId);
        for await(const ref of checkpointActorOrderUnitReferences(input[side].source,own.unitId))
          if(ref.targetUnitId&&!allowedUnits.has(ref.targetUnitId))throw Error('Undeclared entity order reference');
      }else if(native||script||queued)throw Error('Entity owned by both snapshots');
      for(const ref of refs){
        const u=units.get(ref.unitId),a=agents.get(ref.agentId);
        if(!u||u.agentId!==ref.agentId||u.stateFlags&4||!a||a.deleted||a.unitId!==ref.unitId)
          throw Error('Missing declared entity reference binding');
      }
      records.push(units);
    }
    for(const b of referenceBindings){
      const a=records[0].get(b.source.unitId),c=records[1].get(b.destination.unitId);
      if(a.family!==c.family||a.description!==c.description||a.playerNumber!==c.playerNumber||a.playerNumber!==identity.actor.playerNumber)
        throw Error('Incompatible declared entity reference binding');
    }
}

// One checkpoint in a multi-region journal, using the same typed native,
// script, queue and reference rules as the paired store. Home checks are made
// separately by the route store against the immutable registered guild.
export async function verifyEntitySnapshot(identity,alias,source,present,homeAlias) {
    const own=alias;let native,script,queued=0;
    for await(const u of checkpointUnitAgentLinks(source))if(u.unitId===own.unitId){
      if(native)throw Error('Duplicate entity native alias');native=u;
    }
    for await(const a of checkpointAgents(source))if(a.agentId===own.agentId){
      if(script)throw Error('Duplicate entity script alias');script=a;
    }
    for await(const q of checkpointAgentQueues(source))if(q.type==='queued-agent'&&q.agentId===own.agentId)queued++;
    if(!present){
      if(native||script||queued)throw Error('Retired hero alias remains in region');
      for await(const u of checkpointUnitAgentLinks(source))if(u.parentUnitId===own.unitId)
        throw Error('Retired hero retains a physical child');
      for await(const c of checkpointContainerEntries(source))
        if(c.unitId===own.unitId||c.groupOwnerUnitId===own.unitId||c.targetUnitId===own.unitId)
          throw Error('Retired hero retains native membership');
      if((await checkpointAbsentAgentReferences(source,own.agentId)).sites.length)
        throw Error('Retired hero retains an incoming script reference');
      return;
    }
    const home=homeAlias,parentAllowed=!native?.parentUnitId||(home.kind==='native'&&native.parentUnitId===home.unitId);
    if(!native||native.agentId!==own.agentId||!parentAllowed||native.stateFlags&4||!script||script.deleted||
       script.unitId!==own.unitId||queued!==1||native.family!==identity.actor.family||
       native.description!==identity.actor.description||native.playerNumber!==identity.actor.playerNumber)
      throw Error('Owned entity native/script/scheduling state differs');
    // Ordinary AI can select a live target already in this region. Validate
    // the explicit root target's reciprocal native/script identity instead
    // of rewriting it to self/home to satisfy the custody check. Other script
    // references still need an explicit supported meaning; home is immutable.
    let localTarget;
    for(const r of await checkpointAgentReferencePlan(source,own.agentId,id=>id)){
      if(r.before===own.agentId||r.before===home.agentId)continue;
      if(r.attribute.toLowerCase()!=='target'||r.path.length||localTarget)
        throw Error('Undeclared entity script reference');
      let targetAgent,targetUnit;
      for await(const a of checkpointAgents(source))if(a.agentId===r.before)targetAgent=a;
      if(!targetAgent||targetAgent.deleted||!targetAgent.unitId)throw Error('Missing live region target agent');
      for await(const u of checkpointUnitAgentLinks(source))if(u.unitId===targetAgent.unitId){
        if(targetUnit)throw Error('Duplicate region target native alias');targetUnit=u;
      }
      if(!targetUnit||targetUnit.stateFlags&4||targetUnit.agentId!==targetAgent.agentId)
        throw Error('Region target native/script backlink differs');
      localTarget=targetUnit;
    }
    for await(const r of checkpointActorOrderUnitReferences(source,own.unitId))
      if(r.targetUnitId&&r.targetUnitId!==own.unitId&&r.targetUnitId!==localTarget?.unitId&&!(home.kind==='native'&&r.targetUnitId===home.unitId))
        throw Error('Undeclared entity order reference');
}
