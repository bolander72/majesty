// Compare serialized vertex records only. Matching is not a qualification of
// navigation, materials, native map replacement or cross-region actor travel.
import {TERRAIN_WINDOW_SIDE,VERTEX_BYTES,MAX_NATIVE_MAP_SIDE} from './terrain.mjs';
import {Sha256} from './sha256.mjs';

export const MAX_SEAM_VERTEX_BYTES=2*(TERRAIN_WINDOW_SIDE+1)*VERTEX_BYTES;
function valid(terrain){
  if(!terrain||typeof terrain.edge!=='function'||![terrain.width,terrain.height].every(n=>
      Number.isSafeInteger(n)&&n>=1&&n<=MAX_NATIVE_MAP_SIDE))throw new Error('Invalid native seam terrain');
}
export async function compareTerrainSeam(first,second,axis){
  valid(first);valid(second);
  if(!['x','y'].includes(axis)||
      (axis==='x'?first.height!==second.height:first.width!==second.width))throw new Error('Invalid native seam dimensions');
  const total=(axis==='x'?first.height:first.width)+1,sides=axis==='x'?['right','left']:['bottom','top'];
  const hashes=[new Sha256(),new Sha256()],mismatchBytes=new Array(VERTEX_BYTES).fill(0);
  let differing=0,heightBytesDiffering=0,otherBytesDiffering=0,shadingByteDiffering=0,opaqueWordDiffering=0,firstMismatch=null;
  for(let start=0;start<total;start+=TERRAIN_WINDOW_SIDE+1){
    const count=Math.min(TERRAIN_WINDOW_SIDE+1,total-start);
    const a=await first.edge(sides[0],start,count),b=await second.edge(sides[1],start,count);
    if(!(a instanceof Uint8Array)||!(b instanceof Uint8Array)||a.length!==count*VERTEX_BYTES||b.length!==a.length||
        a.byteOffset!==0||b.byteOffset!==0||a.buffer.byteLength!==a.length||b.buffer.byteLength!==b.length||
        !(a.buffer instanceof ArrayBuffer)||!(b.buffer instanceof ArrayBuffer))throw new Error('Invalid native seam strip');
    hashes[0].update(a);hashes[1].update(b);
    for(let index=0;index<count;++index){
      let different=false,height=false,other=false,shading=false,word=false;
      for(let byte=0;byte<VERTEX_BYTES;++byte)if(a[index*VERTEX_BYTES+byte]!==b[index*VERTEX_BYTES+byte]){
        ++mismatchBytes[byte];different=true;if(byte<4)height=true;else other=true;
        if(byte===4)shading=true;if(byte>4)word=true;
      }
      if(different){++differing;if(firstMismatch===null)firstMismatch=start+index;}
      if(height)++heightBytesDiffering;if(other)++otherBytesDiffering;
      if(shading)++shadingByteDiffering;if(word)++opaqueWordDiffering;
    }
  }
  return Object.freeze({axis,vertices:total,matching:total-differing,differing,firstMismatch,
    heightBytesDiffering,otherBytesDiffering,
    shadingByteDiffering,opaqueWordDiffering,
    mismatchBytes:Object.freeze(mismatchBytes),firstSha256:hashes[0].hex(),secondSha256:hashes[1].hex()});
}

// The scene calls this only after validating its 32-cell owned window buffers.
// Check visible neighbouring pairs; a missing window remains unavailable.
export function requireExactWindowSeams(windows,bytes=VERTEX_BYTES){
  if(!(windows instanceof Map)||windows.size>49||![4,VERTEX_BYTES].includes(bytes))throw new Error('Invalid native seam window set');
  for(const [id,value]of windows){
    if(value===null)continue;
    const vertices=value?.vertices;
    if(!(vertices instanceof Uint8Array)||vertices.length!==(TERRAIN_WINDOW_SIDE+1)**2*VERTEX_BYTES||
        vertices.byteOffset!==0||!(vertices.buffer instanceof ArrayBuffer)||vertices.buffer.byteLength!==vertices.length)
      throw new Error('Invalid native seam window vertices');
    const [x,y]=id.split(',').map(Number);
    for(const [axis,other]of [['x',windows.get(`${x+1},${y}`)],['y',windows.get(`${x},${y+1}`)]]){
      if(!other)continue;
      for(let vertex=0;vertex<=TERRAIN_WINDOW_SIDE;++vertex){
        const a=(axis==='x'?vertex*(TERRAIN_WINDOW_SIDE+1)+TERRAIN_WINDOW_SIDE:TERRAIN_WINDOW_SIDE*(TERRAIN_WINDOW_SIDE+1)+vertex)*VERTEX_BYTES;
        const b=(axis==='x'?vertex*(TERRAIN_WINDOW_SIDE+1):vertex)*VERTEX_BYTES;
        for(let byte=0;byte<bytes;++byte)if(value.vertices[a+byte]!==other.vertices[b+byte])
          throw new Error(`Native terrain seam differs at ${id} ${axis} vertex ${vertex}`);
      }
    }
  }
}
