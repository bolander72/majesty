// Supplemental stopped crossing parser: kind9 is the pinned base-only 96-byte leaf.
// Its writer/constructor and poison-independent CPU replays are audited separately.
// Read-only layouts for eight pinned command writers. Raw words are not
// generally classified as targets, timers or portable references. The separate
// narrow target iterator below identifies only kind 6's saved unit target.
// No migration is enabled.
import {checkpointAttachments} from '../../web/world/checkpoint.mjs';
export const MAX_NATIVE_ORDER_RECORD_BYTES=64*1024;
export const MAX_NATIVE_ORDER_ENTRIES=1024;
export const MAX_NATIVE_ORDER_FIXED_BYTES=200;
export const MAX_NATIVE_ORDER_WAYPOINTS=4096;
const layouts=new Map([[1,{bytes:132,version:2}],[2,{bytes:176,version:2}],
  [4,{bytes:140,version:5,pathCountWord:34}],[5,{bytes:176,version:1}],
  [6,{bytes:176,version:1}],[7,{bytes:112,version:1,pathCountWord:27}],
  [9,{bytes:96,version:1}],[10,{bytes:120,version:1}],[11,{bytes:200,version:1,parentVersion:1}]]);

async function words(source,offset,length,limit){
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||length>4096||offset+length>limit)
    throw new Error('Truncated or unbounded native order entry');
  const bytes=await source.readAt(offset,length);
  if(!(bytes instanceof Uint8Array)||bytes.byteLength!==length)throw new Error('Truncated native order read');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),values=[];
  for(let at=0;at<length;at+=4)values.push(view.getUint32(at,true));
  return Object.freeze(values);
}

// Only the Follow Unit target has qualified unit-ID provenance. Other fields
// and other kinds remain unclassified, even when their numeric values match.
// Exhaust this iterator too; yielding a target does not validate later records.
export async function* checkpointActorOrderUnitTargets(source,unitId){
  for await(const entry of checkpointActorOrderEntries(source,unitId)){
    if(entry.type!=='entry'||entry.kind!==6)continue;
    // Original producer: UNIT +0x60 -> order +0x38. Writer 005e2390
    // places it at body word 25; consumer 005e2680 calls lookup 005a10d0.
    yield Object.freeze({type:'unit-target',unitId,bank:entry.bank,index:entry.index,kind:6,
      field:'_targetID',targetUnitId:entry.words[25],offset:entry.offset+100,size:4});
  }
}

// Exhaust this iterator before treating a record as structurally checked:
// unsupported later entries, trailing bytes or duplicate attachments can fail.
export async function* checkpointActorOrderEntries(source,unitId){
  if(!Number.isInteger(unitId)||unitId<=0||unitId>0xffffffff)throw new Error('Invalid native order unit ID');
  let seen=false;
  for await(const attachment of checkpointAttachments(source)){
    if(attachment.kind!=='ORDR'||attachment.unitId!==unitId)continue;
    if(seen)throw new Error('Duplicate native order attachment');
    seen=true;
    if(attachment.components.length!==1||attachment.size>MAX_NATIVE_ORDER_RECORD_BYTES)
      throw new Error('Unsupported or oversized native order record');
    let offset=attachment.primary.offset+16,total=0;
    const limit=attachment.primary.end;
    for(let bank=0;bank<3;++bank){
      const [version,count]=await words(source,offset,8,limit);
      if(version!==1||total+count>MAX_NATIVE_ORDER_ENTRIES)throw new Error('Unsupported native order bank or entry budget');
      yield Object.freeze({type:'bank',unitId,bank,version,count,offset,size:8});
      offset+=8;total+=count;
      for(let index=0;index<count;++index){
        const prefixOffset=offset,[version,kind]=await words(source,offset,8,limit);offset+=8;
        if(version!==1)throw new Error('Unsupported native order entry prefix');
        const layout=layouts.get(kind);
        if(!layout){
          const error=new Error(`Unsupported native order kind: ${kind}`);
          error.code='NATIVE_ORDER_KIND_UNSUPPORTED';error.kind=kind;error.offset=prefixOffset;throw error;
        }
        const values=await words(source,offset,layout.bytes,limit);
        const baseIndex=layout.parentVersion===undefined?1:2;
        if(values[0]!==layout.version||(layout.parentVersion!==undefined&&values[1]!==layout.parentVersion)||
            values[baseIndex]!==1||values[baseIndex+1]!==2||values[baseIndex+2]!==kind)
          throw new Error('Unsupported native order writer layout');
        const hasPath=layout.pathCountWord!==undefined,
          waypointCount=hasPath?values[layout.pathCountWord]:0,pathOffset=offset+layout.bytes;
        if(waypointCount>MAX_NATIVE_ORDER_WAYPOINTS||pathOffset+waypointCount*8>limit)
          throw new Error('Native order waypoint budget or boundary exceeded');
        yield Object.freeze({type:'entry',unitId,bank,index,kind,prefixOffset,offset,size:layout.bytes,
          leafVersion:values[0],baseVersion:values[baseIndex],embeddedVersion:values[baseIndex+1],words:values,
          ...(layout.parentVersion===undefined?{}:{parentVersion:values[1]}),
          ...(hasPath?{waypointCount,pathOffset,serializedSize:layout.bytes+waypointCount*8}:{})});
        offset+=layout.bytes;
        for(let first=0;first<waypointCount;first+=512){
          const count=Math.min(512,waypointCount-first),points=await words(source,offset,count*8,limit);
          for(let point=0;point<count;++point)yield Object.freeze({type:'waypoint',unitId,bank,index,
            waypointIndex:first+point,offset:offset+point*8,firstWord:points[point*2],secondWord:points[point*2+1]});
          offset+=count*8;
        }
      }
    }
    if(offset!==limit)throw new Error('Trailing native order data');
  }
}
