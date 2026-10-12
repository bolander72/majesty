// Project bounded saved family clocks together while its selected owner is held.
// This prepares records; native admission, references and travel remain separate.
import {EntityRevisionStore} from './entity-revisions.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAgentValues,checkpointAttachments} from './checkpoint.mjs';
import {checkpointActorOrderEntries} from './family-order-entries.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {Sha256} from './sha256.mjs';
export const MAX_FAMILY_CLOCK_CHILDREN=16;
export const MAX_FAMILY_CLOCK_CONTEXTS=64;
export const MAX_FAMILY_CLOCK_ORDERS=128;
export const MAX_FAMILY_CLOCK_RECORD_BYTES=65536;
export const MAX_FAMILY_CLOCK_TOTAL_BYTES=262144;
const clone=o=>structuredClone(o),hash=b=>new Sha256().update(b).hex();
function failure(message){throw Error(message);}
async function copy(source,range){
  if(!range||range.size<1||range.size>MAX_FAMILY_CLOCK_RECORD_BYTES)failure('Family clock record exceeds bound');
  const b=new Uint8Array(range.size);
  for(let at=0;at<b.length;at+=4096){const n=Math.min(4096,b.length-at),part=await source.readAt(range.offset+at,n);
    if(!(part instanceof Uint8Array)||part.length!==n)failure('Truncated family clock record');b.set(part,at);}return b;
}
function view(bytes){return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);}
export function prepareSelectedActorFamilyClocks(store,request){
  if(!(store instanceof EntityRevisionStore)||store.identity.version!==2)failure('Family clocks require a registered selected owner');
  const o=clone(request);
  if(!o||Object.keys(o).join(',')!=='expectedManifest'||typeof o.expectedManifest!=='string'||o.expectedManifest.length>256)
    failure('Invalid selected family clock request');
  return store.withSelected(async selected=>{
    if(!selected||selected.record.manifest!==o.expectedManifest)failure('Family clock owner revision changed');
    const from=selected.record.state.ownerSide,to=1-from,source=selected.sources[from],destination=selected.sources[to];
    const sourceClockMs=await checkpointSavedClock(source),destinationClockMs=await checkpointSavedClock(destination);
    const actor=await checkpointActorRecords(source,selected.owner.unitId);
    if(actor.unit.family!=='VHCL'||actor.unit.stateFlags&4||actor.unit.parentUnitId)failure('Family clocks require a living outdoor hero');
    const units=[actor.unit],ids=new Set([actor.unit.unitId]);
    for await(const u of checkpointUnitAgentLinks(source)){
      if(u.parentUnitId!==actor.unit.unitId)continue;
      if(units.length>MAX_FAMILY_CLOCK_CHILDREN||ids.has(u.unitId)||u.agentId||u.family!=='VHCL'||u.stateFlags&4)
        failure('Unsupported family clock child');ids.add(u.unitId);units.push(u);
    }
    for await(const u of checkpointUnitAgentLinks(source))if(u.parentUnitId!==actor.unit.unitId&&ids.has(u.parentUnitId))failure('Nested family clock child');
    const records=[],contexts=[],headers=[],patches=[];let total=0;
    const record=async(kind,unitId,range)=>{
      total+=range.size;if(total>MAX_FAMILY_CLOCK_TOTAL_BYTES)failure('Family clock byte budget exceeded');
      const before=await copy(source,range),result={kind,unitId,range:{offset:range.offset,size:range.size},sourceSha256:hash(before),bytes:before};
      records.push(result);return result;
    };
    const script=await record('GPL',actor.unit.unitId,actor.agent),scriptView=view(script.bytes);
    const patch=(r,offset,before,after,detail)=>{
      const relative=offset-r.range.offset;
      if(relative<0||relative+4>r.bytes.length||view(r.bytes).getUint32(relative,true)!==before)failure('Family clock copy precondition differs');
      if(before===after)return;view(r.bytes).setUint32(relative,after,true);
      patches.push({kind:r.kind,unitId:r.unitId,offset,relativeOffset:relative,before,after,...detail});
    };
    for await(const value of checkpointAgentValues(source,actor.agent.agentId))if(value.type===8){
      if(contexts.length===MAX_FAMILY_CLOCK_CONTEXTS||value.flag)failure('Executing or oversized family clock contexts');
      const at=value.stateOffset-script.range.offset;
      if(at<0||at+16>script.bytes.length)failure('Family context outside its record');
      const state=Array.from({length:4},(_,i)=>scriptView.getUint32(at+i*4,true)),[delay,stamp,flags]=state;
      if(flags&0xffffff7c)failure('Unsupported family context flags');
      const paused=Boolean(flags&0x80),active=Boolean(flags&0x7f);let after=stamp,elapsed=null;
      if(active&&!paused){elapsed=(sourceClockMs-stamp)>>>0;after=(destinationClockMs-elapsed)>>>0;
        if(!stamp||!after||delay>0x7fffffff||elapsed>0x7fffffff)failure('Ambiguous family context clock or zero sentinel');}
      contexts.push({attribute:value.attribute,path:[...value.path],offset:value.stateOffset,state,after,elapsed,active,paused});
      patch(script,value.stateOffset+4,stamp,after,{field:'script-context-stamp',attribute:value.attribute,path:[...value.path]});
    }
    const attachments=new Map();for await(const a of checkpointAttachments(source))if(a.kind==='ORDR'&&ids.has(a.unitId)){
      if(attachments.has(a.unitId))failure('Duplicate family order record');attachments.set(a.unitId,a);}
    for(const u of units){
      const attachment=attachments.get(u.unitId);if(!attachment)continue;
      const order=await record('ORDR',u.unitId,attachment);
      for await(const e of checkpointActorOrderEntries(source,u.unitId))if(e.type==='entry'){
        if(headers.length===MAX_FAMILY_CLOCK_ORDERS)failure('Family dispatch clock budget exceeded');
        const word=e.parentVersion===undefined?5:6,when=e.words[word],delta=e.words[word+1],info=e.words[word+2],elapsed=(sourceClockMs-when)>>>0,
          after=(destinationClockMs-elapsed)>>>0,offset=e.offset+word*4;
        headers.push({unitId:u.unitId,bank:e.bank,index:e.index,kind:e.kind,offset,when,after,delta,info,elapsed,dispatchDue:!(info&1)&&delta<=elapsed});
        patch(order,offset,when,after,{field:'common-order-dispatch-stamp',bank:e.bank,index:e.index,orderKind:e.kind});
      }
    }
    for(const r of records)r.sha256=hash(r.bytes);
    return {version:1,scope:'bounded-selected-family-clock-projection',ownerManifest:selected.record.manifest,owner:clone(selected.owner),
      sourceClockMs,destinationClockMs,worlds:clone(selected.record.worlds),unitIds:units.map(u=>u.unitId),contexts,headers,patches,records,totalRecordBytes:total,
      completeOrderMigration:false,completeReferenceClosureQualified:false,nativeActivationQualified:false};
  });
}
