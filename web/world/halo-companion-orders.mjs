// Preserve the Explore flag's animation/marker and its hero's temporary Wait
// effects. Only common dispatch stamps change. Native lifetime/callback and
// actor/reference closure remain activation gates for the containing bundle.
import {checkpointAttachments,checkpointUnitAgentLinks} from './checkpoint.mjs';
import {checkpointActorOrderEntries} from './order-entries.mjs';
import {checkpointOrderDispatchClockPlan} from './order-dispatch-clock.mjs';
import {checkpointActorOrderRestoreBounds} from './order-restore-bounds.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {verifyExploreRewardAssociation} from './reward-membership.mjs';
import {Sha256} from './sha256.mjs';
const profiles=new Map([
  ['explore-flag',{kinds:[12,5],intervals:[150,100],procs:[0x2002,0]}],
  ['wait-arg1',{kinds:[9],intervals:[1000],procs:[4109]}],
  ['wait-arg3',{kinds:[9],intervals:[3000],procs:[4109]}],
  ['wait-arg4',{kinds:[9],intervals:[2500],procs:[4109]}],
  // Actual ARB2 companion in the selected1500 checkpoint. This shape retains
  // both opaque extended-animation parameters (73,0); their semantics and
  // native activation remain unqualified. Never infer UNIT IDs from them.
  ['arb2-extended-marker',{kinds:[13,5],intervals:[100,100],procs:[0,4101],markerState:336,extendedValue:73}],
  // Original selected-hero crossing84550 also contains the reward1000
  // variant. Copy its opaque parameters exactly; neither is a UNIT binding.
  ['arb2-reward-1000',{kinds:[13,5],intervals:[100,100],procs:[0,4101],markerState:336,extendedValue:1000}],
]);
export async function checkpointHaloAttachedOrderProfile(source,unit){
  if(unit.family!=='VHCL'||unit.agentId||unit.playerNumber!==0)return null;
  if(unit.stateFlags===544&&unit.size===151){
    return new Map([[0x31475241,'wait-arg1'],[0x33475241,'wait-arg3'],[0x34475241,'wait-arg4']]).get(unit.description)??null;
  }
  if(unit.stateFlags!==2592||unit.size!==165||unit.description!==0x32425241)return null;
  let value,count=0;
  for await(const row of checkpointActorOrderEntries(source,unit.unitId))if(row.type==='entry'){
    if(++count>2)return null;
    if(row.kind===13){if(value!==undefined)return null;value=row.words[45];}
  }
  return value===73?'arb2-extended-marker':value===1000?'arb2-reward-1000':null;
}
export async function checkpointHaloCompanionOrderPlan(source,unitId,profileName,clocks){
  const profile=profiles.get(profileName);if(!profile)throw Error('Unqualified halo companion profile');
  const banks=[],entries=[];
  for await(const e of checkpointActorOrderEntries(source,unitId)){
    if(e.type==='bank')banks.push(e);
    if(e.type==='entry')entries.push(e);
    if(e.type==='waypoint')throw Error('Unqualified halo companion path');
  }
  if(banks.length!==3||banks.some((b,i)=>b.bank!==i||b.count!==(i===1?profile.kinds.length:0))||
    entries.length!==profile.kinds.length)throw Error('Unqualified halo companion order banks');
  for(let n=0;n<entries.length;++n){
    const e=entries[n],kind=profile.kinds[n],interval=profile.intervals[n];
    if(e.bank!==1||e.index!==n||e.kind!==kind)throw Error('Unqualified halo companion command');
    const inherited=e.parentVersion!==undefined,shift=Number(inherited),whenWord=5+shift;
    const expected=new Map([[0,1],[1,1],[2+shift,2],[3+shift,kind],[4+shift,interval],[6+shift,interval],[10+shift,profile.procs[n]]]);
    if(inherited)expected.set(2,1);
    if(kind===12){expected.set(24,2);expected.set(26,3);
      if(e.words[27]>3||![1,2].includes(e.words[28]))throw Error('Invalid live Explore frame state');
      expected.set(27,e.words[27]);expected.set(28,e.words[28]);
    }
    if(kind===5){expected.set(24,profile.markerState??80);expected.set(28,1);}
    if(kind===13){expected.set(25,80);expected.set(26,1);expected.set(29,1);expected.set(45,profile.extendedValue);}
    if(e.words.some((v,i)=>i!==whenWord&&v!==(expected.get(i)??0)))
      throw Error('Unqualified halo companion callback, timer or frame state');
  }
  const dispatch=await checkpointOrderDispatchClockPlan(source,unitId,clocks);
  if(dispatch.headers.some(h=>h.elapsed>=h.delta||h.dispatchSkipped))
    throw Error('Halo companion is not at a live post-dispatch boundary');
  const allocation=await checkpointActorOrderRestoreBounds(source,unitId);
  return {unitId,profile:profileName,banks,entries,patches:dispatch.patches,dispatch,
    allocationRequestBytes:allocation.allocationRequestBytes,
    commandStatePreserved:true,unsignedDispatchAgePreserved:true,
    originalProjectedLifetimeQualified:false,nativeActivationQualified:false};
}
const digest=b=>new Sha256().update(b).hex();
async function attachmentCopy(source,unitId){
  let selected;
  for await(const a of checkpointAttachments(source))if(a.unitId===unitId&&a.kind==='ORDR'){
    if(selected||a.size>4096)throw Error('Invalid halo companion order record');selected=a;
  }
  if(!selected)throw Error('Missing halo companion orders');
  const bytes=await source.readAt(selected.offset,selected.size);
  if(!(bytes instanceof Uint8Array)||bytes.length!==selected.size)throw Error('Truncated halo companion orders');
  return {attachment:selected,bytes:Uint8Array.from(bytes)};
}
export async function prepareCheckpointHaloCompanionOrders(source,destination,heroUnitId,flagUnitId){
  let hero,flag;const children=[];
  for await(const u of checkpointUnitAgentLinks(source)){
    if(u.unitId===heroUnitId){if(hero)throw Error('Duplicate halo hero');hero=u;}
    if(u.unitId===flagUnitId){if(flag)throw Error('Duplicate halo flag');flag=u;}
    if(u.parentUnitId===heroUnitId){
      if(children.length===2||children.some(c=>c.unitId===u.unitId))throw Error('Unqualified current halo effect family');
      children.push(u);
    }
  }
  if(hero?.family!=='VHCL'||!hero.agentId||hero.parentUnitId||hero.stateFlags&4)
    throw Error('Missing living outdoor halo hero');
  if(flag?.family!=='RWRD'||flag.description!==0x34415241||flag.stateFlags!==545||
    flag.parentUnitId||!flag.agentId||flag.playerNumber!==hero.playerNumber)
    throw Error('Unqualified living halo Explore flag');
  await verifyExploreRewardAssociation(source,heroUnitId,hero.agentId,flagUnitId,hero.playerNumber);
  if(children.length!==2||new Set(children.map(c=>c.description)).size!==2||
    children.some(c=>c.family!=='VHCL'||c.agentId||c.playerNumber!==hero.playerNumber||c.stateFlags!==544||c.size!==151||
      ![0x31475241,0x34475241].includes(c.description)))throw Error('Unqualified current halo effect family');
  const childIds=new Set(children.map(c=>c.unitId));
  const childOccurrences=new Map([...childIds].map(id=>[id,0]));
  for await(const u of checkpointUnitAgentLinks(source)){
    if(childOccurrences.has(u.unitId))childOccurrences.set(u.unitId,childOccurrences.get(u.unitId)+1);
    if(childIds.has(u.parentUnitId)||u.parentUnitId===flagUnitId)throw Error('Unqualified nested halo companion');
  }
  if([...childOccurrences.values()].some(n=>n!==1))throw Error('Duplicate halo effect alias');
  const clocks={sourceClockMs:await checkpointSavedClock(source),destinationClockMs:await checkpointSavedClock(destination)};
  const selected=[{unit:flag,profile:'explore-flag'},...children.map(unit=>({unit,profile:unit.description===0x31475241?'wait-arg1':'wait-arg4'}))];
  const records=[];
  for(const item of selected){
    const first=await attachmentCopy(source,item.unit.unitId),initialHash=digest(first.bytes);
    const plan=await checkpointHaloCompanionOrderPlan(source,item.unit.unitId,item.profile,clocks);
    const second=await attachmentCopy(source,item.unit.unitId);
    if(second.attachment.offset!==first.attachment.offset||digest(second.bytes)!==initialHash)
      throw Error('Halo companion source changed during preparation');
    const prepared=Uint8Array.from(first.bytes),view=new DataView(prepared.buffer),used=new Set();
    for(const p of plan.patches){
      const at=p.offset-first.attachment.offset;
      if(p.size!==4||used.has(at)||at<36||at+4>prepared.length||view.getUint32(at,true)!==p.before)
        throw Error('Invalid halo companion dispatch edit');
      view.setUint32(at,p.after,true);used.add(at);
    }
    const payload=prepared.slice(36);
    records.push({unitId:item.unit.unitId,profile:item.profile,payload,
      plan:{...plan,sourceClockMs:clocks.sourceClockMs,destinationClockMs:clocks.destinationClockMs,
        attachment:first.attachment,originalAttachmentSha256:initialHash,
        preparedAttachmentSha256:digest(prepared),payloadSha256:digest(payload),payloadBytes:payload.length}});
  }
  return {records,sourceClockMs:clocks.sourceClockMs,destinationClockMs:clocks.destinationClockMs,
    nativeActivationQualified:false,sourceRetired:false,ownerPublished:false};
}
