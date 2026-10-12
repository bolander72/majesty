// Draft-only border reconciliation. Caller supplies immutable/leased stopped
// inputs and an atomic private sink; this never selects a checkpoint or edits
// an existing file. Native shading/nav/actor placement still need validation.
import {checkpointTerrain,VERTEX_BYTES,TERRAIN_WINDOW_SIDE,MAX_NATIVE_MAP_SIDE} from './terrain.mjs';
import {CHECKPOINT_PAGE_BYTES} from './checkpoint.mjs';
import {Sha256} from './sha256.mjs';
import {requireStableNativeHeight} from './native-height.mjs';

export const MAX_RECONCILE_BORDERS=4;
export const MAX_RECONCILE_BORDER_BYTES=MAX_RECONCILE_BORDERS*(TERRAIN_WINDOW_SIDE+1)*VERTEX_BYTES;
const sides=['left','right','top','bottom'];
const vertical=side=>side==='left'||side==='right';
function stripValid(bytes,count){
  if(!(bytes instanceof Uint8Array)||bytes.length!==count*VERTEX_BYTES||bytes.byteOffset!==0||
      !(bytes.buffer instanceof ArrayBuffer)||bytes.buffer.byteLength!==bytes.length)
    throw new Error('Invalid native reconciliation strip');
  const view=new DataView(bytes.buffer);
  for(let index=0;index<count;++index)requireStableNativeHeight(view.getUint32(index*VERTEX_BYTES,true));
  return view;
}
function point(side,index,width,height){
  return vertical(side)?[side==='left'?0:width,index]:[index,side==='top'?0:height];
}
export async function reconcileTerrainHeights({source,borders},sink){
  if(!Array.isArray(borders)||!borders.length||borders.length>MAX_RECONCILE_BORDERS||typeof sink?.write!=='function')
    throw new Error('Invalid native reconciliation request');
  const seen=new Set();
  // Capture scalar metadata before any await; no caller-owned request list is
  // retained or allowed to enlarge the bounded border set during copying.
  const captured=borders.map(border=>{
    const side=border?.side,sourceSide=border?.sourceSide,terrain=border?.terrain;
    const width=terrain?.width,height=terrain?.height,edge=terrain?.edge;
    if(!sides.includes(side)||!sides.includes(sourceSide)||vertical(side)!==vertical(sourceSide)||seen.has(side)||
        ![width,height].every(n=>Number.isSafeInteger(n)&&n>=1&&n<=MAX_NATIVE_MAP_SIDE)||typeof edge!=='function')
      throw new Error('Invalid native reconciliation border');
    seen.add(side);return {side,sourceSide,width,height,edge:edge.bind(terrain)};
  });
  const destination=await checkpointTerrain(source),size=source.size;
  const corners=new Map(),cursors=[];
  for(const border of captured){
    const count=(vertical(border.side)?destination.height:destination.width)+1;
    if(count!==(vertical(border.sourceSide)?border.height:border.width)+1)
      throw new Error('Native reconciliation border dimensions differ');
    const endpoints=[];
    for(const index of [0,count-1]){
      const view=stripValid(await border.edge(border.sourceSide,index,1),1),bits=view.getUint32(0,true);
      const offset=destination.heightOffset(...point(border.side,index,destination.width,destination.height));
      if(corners.has(offset)&&corners.get(offset)!==bits)throw new Error('Conflicting native border corner heights');
      corners.set(offset,bits);endpoints.push(bits);
    }
    let index=0,strip=null,view=null,start=0,length=0;
    cursors.push({async head(){
      if(index===count)return null;
      if(!strip||index>=start+length){
        start=index;length=Math.min(TERRAIN_WINDOW_SIDE+1,count-index);
        strip=null;view=null;
        strip=await border.edge(border.sourceSide,start,length);view=stripValid(strip,length);
      }
      const bits=view.getUint32((index-start)*VERTEX_BYTES,true);
      if((index===0&&bits!==endpoints[0])||(index===count-1&&bits!==endpoints[1]))
        throw new Error('Native reconciliation border changed');
      return {offset:destination.heightOffset(...point(border.side,index,destination.width,destination.height)),bits};
    },advance(){++index;if(index===count){strip=null;view=null;}}});
  }
  const page=new Uint8Array(CHECKPOINT_PAGE_BYTES),hash=new Sha256();
  let pending=null,changedBytes=0,changedVertices=0;
  async function next(){
    const heads=[];
    for(const cursor of cursors)heads.push(await cursor.head());
    let offset=Infinity;for(const head of heads)if(head)offset=Math.min(offset,head.offset);
    if(offset===Infinity)return null;
    const participants=[];let bits;
    for(let index=0;index<heads.length;++index){
      const head=heads[index];if(head?.offset!==offset)continue;
      if(bits!==undefined&&bits!==head.bits)throw new Error('Conflicting native border corner heights');
      bits=head.bits;participants.push(cursors[index]);
    }
    return {offset,bits,participants,changed:false};
  }
  async function fill(at,n){
    if(source.size!==size)throw new Error('Native reconciliation source changed');
    const raw=await source.readAt(at,n);
    if(!(raw instanceof Uint8Array)||raw.length!==n)throw new Error('Truncated native reconciliation source');
    page.set(raw); // Own the page; never mutate a borrowed original buffer.
  }
  for(let at=0;at<size;at+=CHECKPOINT_PAGE_BYTES){
    const n=Math.min(CHECKPOINT_PAGE_BYTES,size-at),end=at+n;await fill(at,n);
    if(!pending)pending=await next();
    while(pending&&pending.offset<end){
      for(let byte=0;byte<4;++byte){
        const offset=pending.offset+byte;if(offset<at||offset>=end)continue;
        const value=(pending.bits>>>(byte*8))&255;
        if(page[offset-at]!==value){++changedBytes;pending.changed=true;page[offset-at]=value;}
      }
      if(pending.offset+4>end)break; // Carry a height straddling a page boundary.
      if(pending.changed)++changedVertices;
      for(const cursor of pending.participants)cursor.advance();
      pending=await next();
    }
    const bytes=page.subarray(0,n);hash.update(bytes);await sink.write(bytes);
  }
  if(pending||source.size!==size)throw new Error('Incomplete or changed native reconciliation source');
  return Object.freeze({size,sha256:hash.hex(),borderCount:captured.length,changedBytes,changedVertices});
}
