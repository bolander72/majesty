// Closed stopped-record preparation for the current Warrior/Explore family.
// IDs remain proposals. Native collision, scheduling and ownership are gates.
import {checkpointActorRecords,checkpointUnits,checkpointUnitAgentLinks,
  checkpointAgents,checkpointAgentValues,checkpointContainerEntries,checkpointAttachments,
  checkpointIncomingAgentReferences,checkpointInventory,checkpointAgentQueues} from './checkpoint.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {prepareCheckpointHaloHeroOrders} from './halo-hero-orders.mjs';
import {prepareCheckpointHaloCompanionOrders} from './halo-companion-orders.mjs';
import {prepareRemoteHomeAgent} from './remote-home.mjs';
import {verifyExploreRewardAssociation} from './reward-membership.mjs';
import {haloRegionLayout} from './halo-region-layout.mjs';
import {actorRegionCoordinates,actorRegionGridCells} from './actor-coordinates.mjs';
import {encodeHomeRecord} from './hero-home.mjs';
import {Sha256} from './sha256.mjs';

const digest=b=>new Sha256().update(b).hex();
const positive=n=>Number.isInteger(n)&&n>0&&n<=0x7fffffff;
const readWord=async(s,at)=>{
  const b=await s.readAt(at,4);if(!(b instanceof Uint8Array)||b.length!==4)throw Error('Truncated halo bundle DWORD');
  return new DataView(b.buffer,b.byteOffset,4).getUint32(0,true);
};
async function copy(source,record){
  if(!record||record.size<16||record.size>4096)throw Error('Halo bundle record exceeds byte budget');
  const b=await source.readAt(record.offset,record.size);
  if(!(b instanceof Uint8Array)||b.length!==record.size)throw Error('Truncated halo bundle record');
  return Uint8Array.from(b);
}
function patchRecord(bytes,record,patches){
  const out=Uint8Array.from(bytes),v=new DataView(out.buffer),used=new Set();
  for(const p of patches){
    const at=p.offset-record.offset;
    if(!Number.isInteger(at)||at<0||at+4>out.length||used.has(at)||v.getUint32(at,true)!==(p.before>>>0))
      throw Error('Changed or overlapping halo bundle field');
    used.add(at);v.setUint32(at,p.after>>>0,true);
  }
  return out;
}
const words=values=>{const b=new Uint8Array(values.length*4),v=new DataView(b.buffer);
  values.forEach((n,i)=>v.setUint32(i*4,n>>>0,true));return b;};

async function agentPlan(source,actor,bindings,freshUnitId,clocks,regions,coordinateAttribute,homeAgentId){
  const record=actor.agent,patches=[],contexts=[];let pairs=0,refs=0,homes=0;
  const add=(offset,before,after,reason)=>patches.push({offset,before,after,reason});
  add(record.identityOffset,record.agentId,bindings.get(record.agentId),'script identity');
  add(record.nativeIdOffset,actor.unit.unitId,freshUnitId,'script native backlink');
  for await(const v of checkpointAgentValues(source,record.agentId)){
    if(homeAgentId!==null&&!v.path.length&&v.attribute.toLowerCase()==='home'){
      if(++homes!==1||v.type!==5||v.targetAgentId!==homeAgentId)
        throw Error('Halo hero script home differs from registration');
    }
    if(v.type===5&&v.targetAgentId!==null){
      if(!bindings.has(v.targetAgentId))throw Error('Unresolved halo bundle script reference');
      if(++refs>64)throw Error('Too many halo bundle script references');
      add(v.offset,v.bits,bindings.get(v.targetAgentId),`script:${v.attribute}`);
    }
    if(v.type===7&&!v.path.length&&v.attribute.toLowerCase()===coordinateAttribute){
      if(++pairs!==1)throw Error('Duplicate halo script destination');
      const x=(await readWord(source,v.offset))|0,y=(await readWord(source,v.offset+4))|0;
      const point=actorRegionCoordinates({x:x*2048,y:y*2048,z:0},regions.from.native,regions.to.native).world;
      add(v.offset,x,point.x,'script destination x');add(v.offset+4,y,point.y,'script destination y');
    }
    if(v.type===8){
      if(v.flag||contexts.length===32)throw Error('Executing or excessive halo script contexts');
      const state=[];for(let n=0;n<4;++n)state.push(await readWord(source,v.stateOffset+n*4));
      const[delay,stamp,flags,remainder]=state,active=Boolean(flags&0x7f),paused=Boolean(flags&0x80);
      if(flags&0xffffff7c)throw Error('Unsupported halo script context flags');
      let elapsed=null,after=stamp;
      if(active&&!paused){
        elapsed=(clocks.sourceClockMs-stamp)>>>0;after=(clocks.destinationClockMs-elapsed)>>>0;
        if(!stamp||!after||delay>0x7fffffff||elapsed>0x7fffffff)
          throw Error('Ambiguous halo script context clock');
        add(v.stateOffset+4,stamp,after,`script dispatch age:${v.attribute}`);
      }
      contexts.push({attribute:v.attribute,path:v.path,delay,stamp,flags,remainder,elapsed,after,
        functions:v.functions.map(f=>f.name)});
    }
  }
  if(Boolean(coordinateAttribute)!==Boolean(pairs))throw Error('Missing halo script destination');
  if(homeAgentId!==null&&homes!==1)throw Error('Missing registered halo hero script home');
  return {patches,contexts,referenceCount:refs};
}

export async function prepareCheckpointHaloHeroBundle(source,destination,options){
  const {heroUnitId,flagUnitId,registered,proposedUnits,proposedAgents,regions}=options??{};
  if(!positive(heroUnitId)||!positive(flagUnitId)||heroUnitId===flagUnitId||
    !Array.isArray(proposedUnits)||proposedUnits.length!==4||!proposedUnits.every(positive)||
    new Set(proposedUnits).size!==4||!Array.isArray(proposedAgents)||proposedAgents.length!==3||
    !proposedAgents.every(positive)||new Set(proposedAgents).size!==3||regions?.version!=='halo-v1')
    throw Error('Invalid halo hero bundle options');
  const from=haloRegionLayout(regions.sourceRegion),to=haloRegionLayout(regions.destinationRegion);
  if(Math.abs(from.native.originX-to.native.originX)+Math.abs(from.native.originY-to.native.originY)!==3968)
    throw Error('Halo bundle requires adjacent cardinal regions');
  const home=registered?.record;
  if(!home||digest(encodeHomeRecord(home))!==registered.sha256||home.home.region!==from.key||
     home.revision||home.pending||!home.members.some(m=>m.unitId===heroUnitId))
    throw Error('Halo bundle requires immutable source guild registration');
  const hero=await checkpointActorRecords(source,heroUnitId),flag=await checkpointActorRecords(source,flagUnitId);
  const member=home.members.find(m=>m.unitId===heroUnitId);
  if(hero.unit.description!==0x314c5641||hero.unit.family!=='VHCL'||hero.unit.size!==442||hero.agent.size!==1843||
    hero.unit.stateFlags!==512||hero.unit.parentUnitId||hero.agent.agentId!==member.agentId||
    hero.unit.playerNumber!==home.home.playerNumber||flag.unit.description!==0x34415241||flag.unit.size!==146||
    flag.agent.size!==443||flag.unit.stateFlags!==545||flag.unit.parentUnitId||flag.unit.playerNumber!==hero.unit.playerNumber)
    throw Error('Unqualified current halo hero/reward record shape');
  await verifyExploreRewardAssociation(source,heroUnitId,hero.agent.agentId,flagUnitId,hero.unit.playerNumber);
  const guild=await checkpointActorRecords(source,home.home.unitId);
  if(guild.unit.family!=='BLDG'||guild.agent.agentId!==home.home.agentId||guild.unit.description!==home.home.description||
     guild.unit.playerNumber!==home.home.playerNumber||guild.unit.stateFlags&4)
    throw Error('Source registered guild differs');
  const companions=await prepareCheckpointHaloCompanionOrders(source,destination,heroUnitId,flagUnitId);
  const effects=companions.records.slice(1).map(r=>r.unitId),ids=[heroUnitId,flagUnitId,...effects],selected=new Map();
  for await(const u of checkpointUnits(source))if(ids.includes(u.primary.words[1])){
    if(selected.has(u.primary.words[1]))throw Error('Duplicate halo bundle UNIT');selected.set(u.primary.words[1],u);
  }
  if(selected.size!==4)throw Error('Missing halo bundle UNIT');
  for await(const u of checkpointUnitAgentLinks(destination))if(proposedUnits.includes(u.unitId))
    throw Error('Occupied halo bundle native proposal');
  for await(const a of checkpointAgents(destination))if(proposedAgents.includes(a.agentId))
    throw Error('Occupied halo bundle script proposal');
  const units=new Map(ids.map((id,i)=>[id,proposedUnits[i]]));
  const agents=new Map([[home.home.agentId,proposedAgents[0]],[hero.agent.agentId,proposedAgents[1]],
    [flag.agent.agentId,proposedAgents[2]]]);
  if(agents.size!==3)throw Error('Overlapping halo bundle script identities');
  const clocks={sourceClockMs:await checkpointSavedClock(source),destinationClockMs:await checkpointSavedClock(destination)};
  const proxy=await prepareRemoteHomeAgent(destination,registered,{worldId:home.worldId,contentDigest:home.contentDigest,
    destinationRegion:to.key,freshAgentId:proposedAgents[0]});
  const records=[],preconditions=[];
  const retain=async(record)=>{const b=await copy(source,record);preconditions.push({record,sha256:digest(b)});return b;};
  for(let i=0;i<4;++i){
    const u=selected.get(ids[i]),prim=u.components.find(c=>c.tag==='PRIM'),base=prim.offset+16;
    if(u.components.length!==(i===1?1:2)||u.primary.words[0]!==(i===1?4:1))
      throw Error('Halo bundle original class/components differ');
    const original=await retain(u),v=new DataView(original.buffer),patches=[];
    const add=(relative,after,reason)=>patches.push({offset:u.offset+relative,before:v.getUint32(relative,true),after,reason});
    add(base-u.offset+4,proposedUnits[i],'native identity');
    if(i>1){
      add(base-u.offset+24,proposedUnits[0],'relative effect parent');
      // Original 005c0c96 -> 005ad420 writes the parent's navigation cell
      // for attached effects. The Q11 pose remains relative to that parent.
      const cells={x:v.getUint32(72,true),y:v.getUint32(76,true)},owner=selected.get(heroUnitId);
      if(cells.x!==await readWord(source,owner.offset+72)||cells.y!==await readWord(source,owner.offset+76))
        throw Error('Halo bundle effect navigation differs from parent');
      const cell=actorRegionGridCells(cells,from.native,to.native);
      add(72,cell.x,'parent-derived saved nav x');add(76,cell.y,'parent-derived saved nav y');
    }
    if(i<2){
      const position={x:v.getInt32(60,true),y:v.getInt32(64,true),z:v.getInt32(68,true)};
      const projected=actorRegionCoordinates(position,from.native,to.native),cell=actorRegionGridCells(
        {x:v.getUint32(72,true),y:v.getUint32(76,true)},from.native,to.native);
      if(Math.floor(position.x/32768)!==v.getUint32(72,true)||Math.floor(position.y/32768)!==v.getUint32(76,true))
        throw Error('Halo bundle saved placement/nav differs');
      add(60,projected.fixed.x,'native x');add(64,projected.fixed.y,'native y');
      add(72,cell.x,'saved nav x');add(76,cell.y,'saved nav y');
      let at=base+60+(await readWord(source,base+48)?16:0),found=false;
      const count=await readWord(source,at+4);at+=8;
      for(let n=0;n<count;++n,at+=8)if(await readWord(source,at)===0x4541){
        const before=await readWord(source,at+4),expected=i?flag.agent.agentId:hero.agent.agentId;
        if(found||before!==expected)throw Error('Halo bundle native script association differs');found=true;
        patches.push({offset:at+4,before,after:agents.get(before),reason:'native script association'});
      }
      if(!found)throw Error('Missing halo bundle native script association');
    }
    const bytes=patchRecord(original,u,patches);
    records.push({name:`Halo_Proposal_${ids[i]}.UNIT`,type:'unit',sourceUnitId:ids[i],proposedUnitId:proposedUnits[i],bytes,
      plan:{patches,originalSha256:digest(original),preparedSha256:digest(bytes)}});
  }
  for(const actor of [hero,flag]){
    const original=await retain(actor.agent),plan=await agentPlan(source,actor,agents,units.get(actor.unit.unitId),clocks,
      {from,to},actor===hero?'destination':null,actor===hero?home.home.agentId:null);
    const bytes=patchRecord(original,actor.agent,plan.patches);
    records.push({name:`Halo_Proposal_${actor.unit.unitId}.GPL`,type:'agent',sourceUnitId:actor.unit.unitId,
      proposedAgentId:agents.get(actor.agent.agentId),bytes,plan:{...plan,originalSha256:digest(original),preparedSha256:digest(bytes)}});
  }
  const retirement={guildUnitId:home.home.unitId,guildAgentId:home.home.agentId,nativeMembership:null,scriptMembership:null};
  const groups=new Map([[heroUnitId,[]],[flagUnitId,[]]]);
  let removedHome=0;
  for await(const c of checkpointContainerEntries(source)){
    if(groups.has(c.unitId)){
      const list=groups.get(c.unitId);
      if(c.type==='group'){
        if(list.length===4||c.groupOwnerUnitId!==c.unitId)throw Error('Invalid halo bundle container owner');
        list.push({...c,members:[]});
      }else{
        const group=list.at(-1);
        if(!group||group.groupKind!==c.groupKind||!c.targetUnitId||c.flags!==1)
          throw Error('Invalid halo bundle container member');
        if(c.unitId===heroUnitId&&c.groupKind===101&&c.targetUnitId===home.home.unitId){++removedHome;continue;}
        if(!units.has(c.targetUnitId))throw Error('Unresolved halo bundle native member');group.members.push(c);
      }
    }else if(c.type==='member'&&ids.includes(c.targetUnitId)){
      if(c.unitId!==home.home.unitId||c.groupKind!==100||c.targetUnitId!==heroUnitId||c.flags!==1||retirement.nativeMembership)
        throw Error('Unresolved external halo bundle native reference');
      retirement.nativeMembership={offset:c.offset,unitId:heroUnitId,flags:c.flags};
    }
  }
  const hg=groups.get(heroUnitId),fg=groups.get(flagUnitId);
  if(removedHome!==1||hg.length!==2||fg.length!==1||!retirement.nativeMembership||
    hg.find(g=>g.groupKind===101)?.members.length!==1||hg.find(g=>g.groupKind===101)?.members[0].targetUnitId!==flagUnitId||
    hg.find(g=>g.groupKind===1)?.members.length!==2||
    hg.find(g=>g.groupKind===1)?.members.some(m=>!effects.includes(m.targetUnitId))||
    fg[0].groupKind!==100||fg[0].members.length!==1||fg[0].members[0].targetUnitId!==heroUnitId)
    throw Error('Halo bundle reciprocal native groups differ');
  for(const[id,list]of groups){
    let attachment;
    for await(const a of checkpointAttachments(source))if(a.unitId===id&&a.kind==='CONT'){
      if(attachment)throw Error('Duplicate halo bundle container record');attachment=a;
    }
    await retain(attachment);
    const bytes=words([1,list.length,...list.flatMap(g=>[1,g.members.length,g.groupKind,units.get(id),
      ...g.members.flatMap(m=>[units.get(m.targetUnitId),m.flags])])]);
    records.push({name:`Halo_Proposal_${id}_Container.bin`,type:'container',sourceUnitId:id,bytes,
      plan:{sourceRange:attachment,groups:list.map(g=>({kind:g.groupKind,members:g.members.map(m=>units.get(m.targetUnitId))})),
        sourceGuildLinkRemoved:id===heroUnitId,preparedSha256:digest(bytes)}});
  }
  for(const actor of [hero,flag]){
    const incoming=await checkpointIncomingAgentReferences(source,actor.agent.agentId);
    for(const site of incoming.sites){
      if(site.deleted)throw Error('Deleted external halo bundle script reference');
      if([hero.agent.agentId,flag.agent.agentId].includes(site.agentId))continue;
      if(actor!==hero||site.agentId!==home.home.agentId||site.unitId!==home.home.unitId||
        site.attribute.toLowerCase()!=='members'||site.rootType!==4||site.path.length!==1||retirement.scriptMembership)
        throw Error('Unresolved external halo bundle script reference');
      retirement.scriptMembership={...site};
    }
  }
  if(!retirement.scriptMembership)throw Error('Missing source guild script membership');
  for await(const item of checkpointInventory(source))if(ids.includes(item.ownerUnitId))
    throw Error('Halo bundle quest inventory is unqualified');
  const queues=[];
  for await(const q of checkpointAgentQueues(source))if(q.type==='queued-agent'&&
      [hero.agent.agentId,flag.agent.agentId].includes(q.agentId)){
    if(queues.length===64)throw Error('Halo bundle schedule exceeds budget');queues.push(q);
  }
  const heroOrders=await prepareCheckpointHaloHeroOrders(source,destination,heroUnitId,regions);
  for(const r of [{unitId:heroUnitId,payload:heroOrders.payload,plan:heroOrders.plan},...companions.records])
    records.push({name:`Halo_Proposal_${r.unitId}_Orders.bin`,type:'orders',sourceUnitId:r.unitId,bytes:r.payload,plan:r.plan});
  records.push({name:'Halo_Proposal_Home.GPL',type:'proxy',bytes:proxy.record,plan:proxy.plan});
  if(records.reduce((n,r)=>n+r.bytes.length,0)>16384)throw Error('Halo bundle total byte budget exceeded');
  for(const p of preconditions)if(digest(await copy(source,p.record))!==p.sha256)
    throw Error('Halo bundle changed during preparation');
  return {records,plan:{version:1,sourceRegion:from.key,destinationRegion:to.key,...clocks,
    sourceUnitIds:ids,proposedUnits,sourceAgentIds:[home.home.agentId,hero.agent.agentId,flag.agent.agentId],proposedAgents,
    registeredHomeSha256:registered.sha256,sourceGuildRetirement:retirement,sourceAgentQueues:queues,
    sourceRecords:preconditions,closedTypedReferencesPrepared:true,proposalIdsReserved:false,
    nativeReaderExecuted:false,destinationCollisionQualified:false,sourceRetired:false,ownerPublished:false,
    nativeActivationQualified:false}};
}
