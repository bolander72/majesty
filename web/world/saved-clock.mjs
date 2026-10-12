// Original saved simulation clock, not wall time or a caller-chosen value.
import {checkpointChunks} from './checkpoint.mjs';
export async function checkpointSavedClock(source) {
  let result;
  for await(const chunk of checkpointChunks(source))if(chunk.tag==='SVGD') {
    if(result!==undefined||chunk.version!==10||chunk.count!==0||chunk.size>1024||chunk.size<35)
      throw Error('Unsupported saved simulation clock');
    const read=await source.readAt(chunk.offset+16,chunk.size);
    if(!(read instanceof Uint8Array)||read.length!==chunk.size)throw Error('Truncated saved simulation clock');
    const bytes=Uint8Array.from(read),first=bytes.indexOf(0),second=bytes.indexOf(0,first+1);
    if(first<1||first>=128||second<=first+1||second-first>=128||second+33>bytes.length)
      throw Error('Invalid saved clock labels');
    result=new DataView(bytes.buffer).getUint32(second+1,true);
  }
  if(result===undefined)throw Error('Missing saved simulation clock');
  return result;
}
