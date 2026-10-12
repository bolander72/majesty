// Read-only native terrain windows. No engine pointers, map replacement or
// terrain-field semantics beyond the pinned serialized record layout.
import {checkpointChunks,MAX_CHECKPOINT_BYTES,CHECKPOINT_PAGE_BYTES} from './checkpoint.mjs';

export const TERRAIN_WINDOW_SIDE=32;
export const VERTEX_BYTES=9,CELL_BYTES=5,MAX_NATIVE_MAP_SIDE=1024;
export const MAX_TERRAIN_WINDOW_BYTES=(TERRAIN_WINDOW_SIDE+1)**2*VERTEX_BYTES+TERRAIN_WINDOW_SIDE**2*CELL_BYTES;
function sourceValid(source){
  if(!source||!Number.isSafeInteger(source.size)||source.size<16||source.size>MAX_CHECKPOINT_BYTES||
      typeof source.readAt!=='function')throw new Error('Invalid native terrain source');
}
async function read(source,offset,length){
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||
      length>CHECKPOINT_PAGE_BYTES||offset+length>source.size)throw new Error('Native terrain read out of bounds');
  const data=await source.readAt(offset,length);
  if(!(data instanceof Uint8Array)||data.length!==length)throw new Error('Truncated native terrain');
  return data;
}
async function header(source,offset,limit){
  if(offset+16>limit)throw new Error('Truncated native terrain header');
  const raw=await read(source,offset,16),view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  const tag=String.fromCharCode(...raw.subarray(0,4)),size=view.getUint32(4,true),end=offset+16+size;
  if(!/^[A-Z ]{4}$/.test(tag)||end>limit)throw new Error('Invalid native terrain boundary');
  return {tag,offset,size,end,version:view.getUint32(8,true),count:view.getUint32(12,true)};
}
async function primary(source,group,version,size,count){
  if(group.version!==0||group.count!==1)throw new Error('Unsupported native terrain container');
  const part=await header(source,group.offset+16,group.end);
  if(part.tag!=='PRIM'||part.version!==version||part.size!==size||part.count!==count||part.end!==group.end)
    throw new Error('Unsupported native terrain primary');
  return part.offset+16;
}
export async function checkpointTerrain(source){
  sourceValid(source);
  const fileSize=source.size;
  let map,terrain;
  for await(const chunk of checkpointChunks(source)){
    if(chunk.tag==='MAP '){if(map)throw new Error('Duplicate native map');map=chunk;}
    if(chunk.tag==='MTER'){if(terrain)throw new Error('Duplicate native terrain');terrain=chunk;}
  }
  if(!map||!terrain)throw new Error('Missing native map terrain');
  const mapOffset=await primary(source,map,2,40,0),raw=await read(source,mapOffset,8);
  const dimensions=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  const width=dimensions.getUint32(0,true),height=dimensions.getUint32(4,true);
  if(!width||!height||width>MAX_NATIVE_MAP_SIDE||height>MAX_NATIVE_MAP_SIDE)
    throw new Error('Unsupported native map dimensions');
  if(terrain.version!==0||terrain.count!==2)throw new Error('Unsupported native terrain group');
  let vertices,cells,at=terrain.offset+16;
  for(let index=0;index<2;++index){
    const group=await header(source,at,terrain.end);
    if(group.tag==='MVTX'&&!vertices){
      const count=(width+1)*(height+1);
      vertices=await primary(source,group,2,count*VERTEX_BYTES,count);
    }else if(group.tag==='MCEL'&&!cells){
      const count=width*height;
      cells=await primary(source,group,5,count*CELL_BYTES,count);
    }else throw new Error('Invalid native terrain children');
    at=group.end;
  }
  if(!vertices||!cells||at!==terrain.end||source.size!==fileSize)
    throw new Error('Incomplete or changed native terrain');
  return new NativeTerrain(source,{width,height,vertices,cells,fileSize});
}
class NativeTerrain {
  #source;
  #layout;
  #reading=false;
  constructor(source,layout){this.#source=source;this.#layout=layout;}
  get width(){return this.#layout.width;}
  get height(){return this.#layout.height;}
  heightOffset(x,y){
    const layout=this.#layout;
    if(![x,y].every(Number.isSafeInteger)||x<0||y<0||x>layout.width||y>layout.height)
      throw new Error('Native terrain height out of bounds');
    if(this.#source.size!==layout.fileSize)throw new Error('Native terrain source changed');
    return layout.vertices+(y*(layout.width+1)+x)*VERTEX_BYTES;
  }
  async edge(side,start,count){
    if(this.#reading)throw new Error('Native terrain reader busy');
    const layout=this.#layout,horizontal=side==='top'||side==='bottom';
    if(!['left','right','top','bottom'].includes(side)||![start,count].every(Number.isSafeInteger)||
        start<0||count<1||count>TERRAIN_WINDOW_SIDE+1||start+count>(horizontal?layout.width:layout.height)+1)
      throw new Error('Native terrain edge out of bounds');
    if(this.#source.size!==layout.fileSize)throw new Error('Native terrain source changed');
    this.#reading=true;
    try{
      const vertices=new Uint8Array(count*VERTEX_BYTES);
      if(horizontal){
        const y=side==='top'?0:layout.height;
        const offset=layout.vertices+(y*(layout.width+1)+start)*VERTEX_BYTES;
        vertices.set(await read(this.#source,offset,vertices.length));
      }else{
        const x=side==='left'?0:layout.width;
        for(let index=0;index<count;++index){
          const offset=layout.vertices+((start+index)*(layout.width+1)+x)*VERTEX_BYTES;
          vertices.set(await read(this.#source,offset,VERTEX_BYTES),index*VERTEX_BYTES);
        }
      }
      if(this.#source.size!==layout.fileSize)throw new Error('Native terrain source changed');
      return vertices;
    }finally{this.#reading=false;}
  }
  async window(x,y,width,height){
    if(this.#reading)throw new Error('Native terrain reader busy');
    const layout=this.#layout;
    if(![x,y,width,height].every(Number.isSafeInteger)||x<0||y<0||width<1||height<1||
        width>TERRAIN_WINDOW_SIDE||height>TERRAIN_WINDOW_SIDE||x+width>layout.width||y+height>layout.height)
      throw new Error('Native terrain window out of bounds');
    if(this.#source.size!==layout.fileSize)throw new Error('Native terrain source changed');
    this.#reading=true;
    try {
      const vertices=new Uint8Array((width+1)*(height+1)*VERTEX_BYTES),cells=new Uint8Array(width*height*CELL_BYTES);
      const vertexRow=(width+1)*VERTEX_BYTES,cellRow=width*CELL_BYTES;
      for(let row=0;row<=height;++row){
        const offset=layout.vertices+((y+row)*(layout.width+1)+x)*VERTEX_BYTES;
        vertices.set(await read(this.#source,offset,vertexRow),row*vertexRow);
      }
      for(let row=0;row<height;++row){
        const offset=layout.cells+((y+row)*layout.width+x)*CELL_BYTES;
        cells.set(await read(this.#source,offset,cellRow),row*cellRow);
      }
      if(this.#source.size!==layout.fileSize)throw new Error('Native terrain source changed');
      return {x,y,width,height,vertices,cells};
    } finally {this.#reading=false;}
  }
}
