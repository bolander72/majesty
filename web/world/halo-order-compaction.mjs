// Remove only a proven consumed Path4 prefix from an already patched bounded
// original-reader record. Source saves remain untouched. Header sizes change;
// capacity, current/future points and every other order byte remain intact.
export function compactConsumedHaloPathRecord(record,attachment,navigation){
 const prefixes=navigation?.consumedPathPrefixes??[];
 if(!prefixes.length)return record;
 if(!(record instanceof Uint8Array)||record.length!==attachment.size||record.length>65536||
    attachment.primary.offset!==attachment.offset+20||attachment.components.length!==1)
   throw Error('Unsupported compacted halo order record');
 const view=new DataView(record.buffer,record.byteOffset,record.byteLength);
 const tag=at=>String.fromCharCode(...record.subarray(at,at+4));
 if(tag(4)!=='ORDR'||tag(20)!=='PRIM'||view.getUint32(8,true)!==record.length-20||
    view.getUint32(24,true)!==record.length-36)throw Error('Halo order framing differs before compaction');
 let removed=0,previous=36;
 const ranges=prefixes.map(p=>{
   const at=p.offset-attachment.offset;
   if(p.kind!==4||p.policy!=='omit-consumed-prefix-preserve-current-and-future'||
      !Number.isInteger(at)||at<previous||!Number.isInteger(p.removedPoints)||p.removedPoints<=0||
      p.removedPoints>p.sourceCursor||p.sourceCursor>p.sourceCount||p.sourceCount>p.capacity||
      p.size!==p.removedPoints*8||at+p.size>record.length||
      p.destinationCursor!==p.sourceCursor-p.removedPoints||p.destinationCount!==p.sourceCount-p.removedPoints||
      view.getUint32(at-20,true)!==p.destinationCursor||view.getUint32(at-4,true)!==p.destinationCount)
     throw Error('Invalid consumed halo path prefix');
   previous=at+p.size;removed+=p.size;return{at,size:p.size};
 });
 const output=new Uint8Array(record.length-removed);let sourceAt=0,targetAt=0;
 for(const r of ranges){output.set(record.subarray(sourceAt,r.at),targetAt);targetAt+=r.at-sourceAt;sourceAt=r.at+r.size;}
 output.set(record.subarray(sourceAt),targetAt);
 const out=new DataView(output.buffer);out.setUint32(8,output.length-20,true);out.setUint32(24,output.length-36,true);
 return output;
}
