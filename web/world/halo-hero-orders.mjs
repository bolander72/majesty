// A bounded original-reader payload, prepared while both worlds are stopped.
// Actor/reward import, native collision, source retirement and ownership are
// separate gates. No prepared bytes are written back to either world here.
import {checkpointAttachments} from './checkpoint.mjs';
import {checkpointActorOrderNavigation} from './order-navigation.mjs';
import {checkpointHeroOrderArrivalPlan} from './hero-order-arrival.mjs';
import {checkpointSavedClock} from './saved-clock.mjs';
import {checkpointTerrain} from './terrain.mjs';
import {sampleNativeGroundHeight} from './terrain-ground.mjs';
import {haloRegionLayout} from './halo-region-layout.mjs';
import {actorRegionCoordinates} from './actor-coordinates.mjs';
import {Sha256} from './sha256.mjs';
import {compactConsumedHaloPathRecord} from './halo-order-compaction.mjs';

async function copy(source,range){
  if(range.size>65536)throw Error('Halo order payload exceeds byte budget');
  const out=new Uint8Array(range.size);
  for(let at=0;at<out.length;at+=4096){
    const count=Math.min(4096,out.length-at),bytes=await source.readAt(range.offset+at,count);
    if(!(bytes instanceof Uint8Array)||bytes.length!==count)throw Error('Truncated halo order copy');
    out.set(bytes,at);
  }
  return out;
}
const digest=b=>new Sha256().update(b).hex();
export async function prepareCheckpointHaloHeroOrders(source,destination,unitId,regions,home=null,resolveUnitId=()=>{
  throw Error('Unresolved halo order target');
}){
  let attachment;
  for await(const a of checkpointAttachments(source))if(a.kind==='ORDR'&&a.unitId===unitId){
    if(attachment)throw Error('Duplicate halo hero orders');attachment=a;
  }
  if(!attachment)throw Error('Missing halo hero orders');
  const original=await copy(source,attachment),beforeDigest=digest(original);
  const clocks={sourceClockMs:await checkpointSavedClock(source),destinationClockMs:await checkpointSavedClock(destination)};
  const plan=await checkpointHeroOrderArrivalPlan(source,unitId,clocks,home,resolveUnitId,regions);
  if(plan.attachment.offset!==attachment.offset||plan.attachment.size!==attachment.size)
    throw Error('Halo order record changed during preparation');
  const sourceTerrain=await checkpointTerrain(source),destinationTerrain=await checkpointTerrain(destination);
  if([sourceTerrain,destinationTerrain].some(t=>t.width!==128||t.height!==128))
    throw Error('Halo order terrain dimensions differ from explicit layout');
  const from=haloRegionLayout(regions.sourceRegion).native,to=haloRegionLayout(regions.destinationRegion).native;
  let groundSamples=0,moveGoals=0;
  for await(const point of checkpointActorOrderNavigation(source,unitId)){
    if(point.type!=='coordinate')continue;
    if(point.kind===4&&point.field==='waypoint'&&plan.haloNavigation.consumedPathPrefixes.some(p=>
      p.bank===point.bank&&p.index===point.index&&point.waypointIndex<p.removedPoints))continue;
    const scale=point.space==='native-fixed'?1:point.space==='navigation-grid'?32768:2048;
    const fixed={x:point.x*scale,y:point.y*scale,z:point.z??0};
    const projected=actorRegionCoordinates(fixed,from,to).fixed;
    const before=await sampleNativeGroundHeight(sourceTerrain,fixed),after=await sampleNativeGroundHeight(destinationTerrain,projected);
    if(before!==after)throw Error('Halo order ground differs across saved maps');
    if(point.kind===2){
      if(fixed.z!==before)throw Error('In-flight Move goal differs from original ground');
      ++moveGoals;
    }
    ++groundSamples;
  }
  if(digest(await copy(source,attachment))!==beforeDigest)throw Error('Halo order source changed during preparation');
  let prepared=Uint8Array.from(original);const view=new DataView(prepared.buffer),patched=new Set();
  const payloadRange={offset:attachment.primary.offset+16,size:attachment.primary.size};
  for(const p of plan.patches){
    if(p.size!==4||p.offset<payloadRange.offset||p.offset+4>payloadRange.offset+payloadRange.size||patched.has(p.offset))
      throw Error('Overlapping or out-of-payload halo order edit');
    const at=p.offset-attachment.offset;
    if(view.getUint32(at,true)!==p.before)throw Error('Halo order field changed after planning');
    view.setUint32(at,p.after,true);patched.add(p.offset);
  }
  prepared=compactConsumedHaloPathRecord(prepared,attachment,plan.haloNavigation);
  const removed=original.length-prepared.length;
  const start=payloadRange.offset-attachment.offset,payload=prepared.slice(start,start+payloadRange.size-removed);
  return {payload,preparedAttachment:prepared,plan:{...plan,
    sourceClockMs:clocks.sourceClockMs,destinationClockMs:clocks.destinationClockMs,
    originalAttachmentSha256:beforeDigest,preparedAttachmentSha256:digest(prepared),
    payloadSha256:digest(payload),payloadRange:{...payloadRange,size:payloadRange.size-removed},groundSamples,moveGoals,
    savedCoordinateGroundContinuityQualified:true,destinationCollisionQualified:false,
    sourceRetired:false,ownerPublished:false,nativeActivationQualified:false}};
}
