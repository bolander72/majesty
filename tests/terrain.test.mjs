import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkpointTerrain,TERRAIN_WINDOW_SIDE,VERTEX_BYTES,CELL_BYTES,MAX_TERRAIN_WINDOW_BYTES} from '../web/world/terrain.mjs';
import {CHECKPOINT_PAGE_BYTES,MAX_CHECKPOINT_BYTES} from '../web/world/checkpoint.mjs';
import {PairedCheckpointStore} from '../web/world/transfer-store.mjs';
import {compareTerrainSeam,MAX_SEAM_VERTEX_BYTES} from '../web/world/terrain-seam.mjs';

function chunk(tag,version,count,...parts){
  const payload=Buffer.concat(parts),header=Buffer.alloc(16);
  header.write(tag);header.writeUInt32LE(payload.length,4);header.writeUInt32LE(version,8);header.writeUInt32LE(count,12);
  return Buffer.concat([header,payload]);
}
function fixture(width=65,height=33){
  const map=Buffer.alloc(40);map.writeUInt32LE(width);map.writeUInt32LE(height,4);
  const vertices=Buffer.alloc((width+1)*(height+1)*VERTEX_BYTES),cells=Buffer.alloc(width*height*CELL_BYTES);
  for(let y=0;y<=height;++y)for(let x=0;x<=width;++x){
    const at=(y*(width+1)+x)*VERTEX_BYTES;
    vertices.writeFloatLE((x-y)/4,at);vertices[at+4]=(x^y)&255;vertices.writeUInt32LE(y*65536+x,at+5);
  }
  for(let y=0;y<height;++y)for(let x=0;x<width;++x){
    const at=(y*width+x)*CELL_BYTES;cells.set([x&255,y&255,(x+y)&255,(x^y)&255,200],at);
  }
  const vers=chunk('VERS',1,0,Buffer.alloc(256)),m=chunk('MAP ',0,1,chunk('PRIM',2,0,map));
  const v=chunk('MVTX',0,1,chunk('PRIM',2,(width+1)*(height+1),vertices));
  const c=chunk('MCEL',0,1,chunk('PRIM',5,width*height,cells));
  const buffer=Buffer.concat([vers,m,chunk('MTER',0,2,v,c)]),reads=[];
  const positions={map:vers.length,mapPrimary:vers.length+16,mapBody:vers.length+32,
    terrain:vers.length+m.length,vertex:vers.length+m.length+16,
    vertexPrimary:vers.length+m.length+32,cell:vers.length+m.length+16+v.length,
    cellPrimary:vers.length+m.length+32+v.length};
  const source={size:buffer.length,async readAt(at,n){assert.ok(n<=CHECKPOINT_PAGE_BYTES);reads.push({at,n});return buffer.subarray(at,at+n);}};
  return {width,height,buffer,vertices,cells,source,reads,positions};
}
function expected(f,x,y,width,height){
  const vertices=[],cells=[];
  for(let row=y;row<=y+height;++row){const at=(row*(f.width+1)+x)*VERTEX_BYTES;vertices.push(f.vertices.subarray(at,at+(width+1)*VERTEX_BYTES));}
  for(let row=y;row<y+height;++row){const at=(row*f.width+x)*CELL_BYTES;cells.push(f.cells.subarray(at,at+width*CELL_BYTES));}
  return {vertices:Buffer.concat(vertices),cells:Buffer.concat(cells)};
}
function expectedEdge(f,side,start,count){
  const rows=[];
  for(let index=0;index<count;++index){
    const horizontal=side==='top'||side==='bottom';
    const x=horizontal?start+index:side==='left'?0:f.width;
    const y=horizontal?side==='top'?0:f.height:start+index;
    const at=(y*(f.width+1)+x)*VERTEX_BYTES;rows.push(f.vertices.subarray(at,at+VERTEX_BYTES));
  }
  return Buffer.concat(rows);
}
test('native edge strips read every boundary endpoint with at most 33 packed vertices',async()=>{
  const f=fixture(),terrain=await checkpointTerrain(f.source);f.reads.length=0;
  for(const side of ['left','right','top','bottom']){
    const total=(side==='left'||side==='right'?f.height:f.width)+1;
    for(let start=0;start<total;start+=33){const count=Math.min(33,total-start),bytes=await terrain.edge(side,start,count);
      assert.deepEqual(Buffer.from(bytes),expectedEdge(f,side,start,count));assert.ok(bytes.length<=297);
      assert.equal(bytes.buffer.byteLength,bytes.length);assert.equal(bytes.byteOffset,0);
    }
  }
  assert.ok(f.reads.every(r=>r.n<=297));assert.equal(MAX_SEAM_VERTEX_BYTES,594);
  const before=f.reads.length;
  for(const args of [['unknown',0,1],['left',-1,1],['right',0,34],['top',65,2],['bottom',0,0],['left',0,NaN]])
    await assert.rejects(terrain.edge(...args),/out of bounds/);
  assert.equal(f.reads.length,before);
});
test('seam comparison covers both axes, unequal perpendicular dimensions and the final vertex',async()=>{
  for(const axis of ['x','y']){
    const first=fixture(),second=axis==='x'?fixture(33,33):fixture(65,65),sides=axis==='x'?['right','left']:['bottom','top'];
    const total=(axis==='x'?first.height:first.width)+1;
    const edge=expectedEdge(first,sides[0],0,total),body=second.positions.vertexPrimary+16;
    for(let index=0;index<total;++index){
      const vertex=axis==='x'?index*(second.width+1):index;
      edge.copy(second.buffer,body+vertex*VERTEX_BYTES,index*VERTEX_BYTES,(index+1)*VERTEX_BYTES);
    }
    const a=await checkpointTerrain(first.source),b=await checkpointTerrain(second.source),matched=await compareTerrainSeam(a,b,axis);
    assert.equal(matched.differing,0);assert.equal(matched.matching,total);assert.equal(matched.firstMismatch,null);
    assert.equal(matched.firstSha256,createHash('sha256').update(edge).digest('hex'));assert.equal(matched.secondSha256,matched.firstSha256);
    const last=axis==='x'?(total-1)*(second.width+1):total-1;second.buffer[body+last*VERTEX_BYTES+8]^=1;
    const changed=await compareTerrainSeam(a,b,axis);assert.equal(changed.differing,1);assert.equal(changed.firstMismatch,total-1);
    assert.deepEqual(changed.mismatchBytes,[0,0,0,0,0,0,0,0,1]);assert.notEqual(changed.firstSha256,changed.secondSha256);
    assert.equal(changed.heightBytesDiffering,0);assert.equal(changed.otherBytesDiffering,1);
    assert.equal(changed.shadingByteDiffering,0);assert.equal(changed.opaqueWordDiffering,1);
  }
});
test('edge and window reads share one busy state and failed strips permit retry',async()=>{
  const f=fixture(),terrain=await checkpointTerrain(f.source),read=f.source.readAt;
  let release,entered;const gate=new Promise(r=>{release=r;}),started=new Promise(r=>{entered=r;});let blocked=false;
  f.source.readAt=async(at,n)=>{if(!blocked){blocked=true;entered();await gate;}return read(at,n);};
  const edge=terrain.edge('right',0,33);await started;
  await assert.rejects(terrain.edge('left',0,33),/busy/);await assert.rejects(terrain.window(0,0,32,32),/busy/);
  release();await edge;
  f.source.readAt=async(at,n)=>(await read(at,n)).subarray(1);await assert.rejects(terrain.edge('left',0,33),/Truncated/);
  f.source.readAt=read;assert.equal((await terrain.window(0,0,1,1)).width,1);
  f.source.readAt=async(at,n)=>{++f.source.size;return read(at,n);};await assert.rejects(terrain.edge('top',0,1),/changed/);
  --f.source.size;f.source.readAt=read;assert.equal((await terrain.edge('top',0,1)).length,9);
});
test('seam comparison rejects incompatible layouts and oversized backing buffers',async()=>{
  const f=fixture(),terrain=await checkpointTerrain(f.source),before=f.reads.length;
  const noRead={width:65,height:32,edge(){assert.fail('invalid layout read');}};
  await assert.rejects(compareTerrainSeam(terrain,noRead,'x'),/dimensions/);
  await assert.rejects(compareTerrainSeam(terrain,terrain,'z'),/dimensions/);
  assert.equal(f.reads.length,before);
  const oversized={width:65,height:33,async edge(side,start,count){return new Uint8Array(count*9+1).subarray(0,count*9);}};
  await assert.rejects(compareTerrainSeam(oversized,oversized,'x'),/strip/);
});
test('native windows select exact row ranges and include the far edge vertices',async()=>{
  const f=fixture(),terrain=await checkpointTerrain(f.source);
  assert.equal(terrain.width,65);assert.equal(terrain.height,33);
  for(const [x,y,width,height]of [[0,0,32,32],[32,0,32,32],[64,0,1,32],[0,32,32,1],[64,32,1,1],[17,9,12,13]]){
    const window=await terrain.window(x,y,width,height),target=expected(f,x,y,width,height);
    assert.deepEqual(Buffer.from(window.vertices),target.vertices);assert.deepEqual(Buffer.from(window.cells),target.cells);
    assert.equal(window.vertices.length,(width+1)*(height+1)*VERTEX_BYTES);
    assert.ok(window.vertices.length+window.cells.length<=MAX_TERRAIN_WINDOW_BYTES);
  }
  assert.ok(f.reads.every(r=>r.n<=CHECKPOINT_PAGE_BYTES));
});
test('adjacent windows share identical edge vertices without overlapping their cells',async()=>{
  const f=fixture(),terrain=await checkpointTerrain(f.source),left=await terrain.window(0,0,32,32),right=await terrain.window(32,0,32,32);
  for(let y=0;y<=32;++y){
    const at=(y*33+32)*VERTEX_BYTES,other=y*33*VERTEX_BYTES;
    assert.deepEqual(left.vertices.subarray(at,at+VERTEX_BYTES),right.vertices.subarray(other,other+VERTEX_BYTES));
  }
  assert.equal(left.cells[0],0);assert.equal(right.cells[0],32);
});
test('invalid windows reject before allocating or reading incoming terrain',async()=>{
  const f=fixture(),terrain=await checkpointTerrain(f.source),before=f.reads.length;
  for(const args of [[-1,0,1,1],[0,0,33,1],[0,0,1,33],[65,0,1,1],[0,33,1,1],[0,0,0,1],[0,0,1,0],[0.5,0,1,1],[NaN,0,1,1],[0,0,Infinity,1]])
    await assert.rejects(terrain.window(...args),/out of bounds/);
  assert.equal(f.reads.length,before);assert.equal(TERRAIN_WINDOW_SIDE,32);
  assert.equal(MAX_TERRAIN_WINDOW_BYTES,14921);
});
test('unsupported versions, counts and dimensions reject instead of guessing a layout',async()=>{
  const mutations=[['mapPrimary',8,1],['vertexPrimary',8,1],['cellPrimary',8,4],
    ['map',12,2],['terrain',12,3],['vertexPrimary',12,1],['cellPrimary',12,1],
    ['mapBody',0,0],['mapBody',0,1025],['mapBody',4,0],['mapBody',4,1025]];
  for(const [name,offset,value]of mutations){
    const f=fixture();f.buffer.writeUInt32LE(value,f.positions[name]+offset);
    await assert.rejects(checkpointTerrain(f.source));
  }
});
test('missing, duplicate and wrong terrain children cannot silently replace stored terrain',async()=>{
  const f=fixture();
  const use=buffer=>({size:buffer.length,async readAt(at,n){return buffer.subarray(at,at+n);}});
  await assert.rejects(checkpointTerrain(use(f.buffer.subarray(0,f.positions.terrain))),/Missing/);
  const duplicateMap=Buffer.concat([f.buffer,f.buffer.subarray(f.positions.map,f.positions.terrain)]);
  await assert.rejects(checkpointTerrain(use(duplicateMap)),/Duplicate native map/);
  const duplicateTerrain=Buffer.concat([f.buffer,f.buffer.subarray(f.positions.terrain)]);
  await assert.rejects(checkpointTerrain(use(duplicateTerrain)),/Duplicate native terrain/);
  for(const tag of ['MVTX','XXXX']){
    const g=fixture();g.buffer.write(tag,g.positions.cell);
    await assert.rejects(checkpointTerrain(g.source),/children/);
  }
  const g=fixture();g.source.size-=1;await assert.rejects(checkpointTerrain(g.source));
});
test('oversized sources are rejected before any input read',async()=>{
  for(const size of [MAX_CHECKPOINT_BYTES+1,NaN,15])
    await assert.rejects(checkpointTerrain({size,readAt(){assert.fail('invalid source read');}}),/Invalid/);
});
test('one incoming window is accepted without queueing; failed reads release the busy state',async()=>{
  const f=fixture(),terrain=await checkpointTerrain(f.source),read=f.source.readAt;
  let finish,entered;const gate=new Promise(r=>{finish=r;}),started=new Promise(r=>{entered=r;});let blocked=false;
  f.source.readAt=async(at,n)=>{if(!blocked){blocked=true;entered();await gate;}return read(at,n);};
  const first=terrain.window(0,0,32,32);await started;
  await assert.rejects(terrain.window(32,0,32,32),/busy/);
  finish();await first;
  f.source.readAt=async(at,n)=>(await read(at,n)).subarray(1);
  await assert.rejects(terrain.window(0,0,32,32),/Truncated/);
  f.source.readAt=read;assert.equal((await terrain.window(32,0,32,32)).x,32);
});
test('source length changes invalidate the read while previous returned windows stay independent',async()=>{
  const f=fixture(),terrain=await checkpointTerrain(f.source),first=await terrain.window(0,0,1,1);
  const original=first.vertices.slice(),read=f.source.readAt;let count=0;
  f.source.readAt=async(at,n)=>{if(++count===3)++f.source.size;return read(at,n);};
  await assert.rejects(terrain.window(0,0,32,32),/changed/);
  --f.source.size;f.source.readAt=read;
  const next=await terrain.window(0,0,1,1);next.vertices.fill(0);
  assert.deepEqual(first.vertices,original);
});
test('opaque terrain bytes are preserved without inventing material or flag semantics',async()=>{
  const f=fixture(),vertexBody=f.positions.vertexPrimary+16,cellBody=f.positions.cellPrimary+16;
  f.buffer.writeUInt32LE(0x7fc00001,vertexBody);f.buffer[vertexBody+4]=255;f.buffer.writeUInt32LE(0xffffffff,vertexBody+5);
  f.buffer.fill(255,cellBody,cellBody+5);
  const terrain=await checkpointTerrain(f.source),window=await terrain.window(0,0,1,1);
  assert.equal(new DataView(window.vertices.buffer).getUint32(0,true),0x7fc00001);
  assert.deepEqual(window.vertices.subarray(4,9),new Uint8Array(5).fill(255));
  assert.deepEqual(window.cells,new Uint8Array(5).fill(255));
});
test('terrain window extraction holds the selected pair lease and cannot reuse readers after it ends',async()=>{
  const f=fixture(),files=new Map();let locked=false;
  const io={
    async withLock(mode,consume){if(locked)throw new Error('busy');locked=true;try{return await consume();}finally{locked=false;}},
    async open(name){const bytes=files.get(name);return bytes?{size:bytes.length,async readAt(at,n){return bytes.subarray(at,at+n);}}:null;},
    async atomicWrite(name,produce){const pieces=[];await produce({write:async bytes=>pieces.push(Buffer.from(bytes))});files.set(name,Buffer.concat(pieces));},
  };
  const store=new PairedCheckpointStore(io,{regions:['0_0','1_0'],content:'terrain-lease-fixture'});
  const world={source:f.source,sha256:createHash('sha256').update(f.buffer).digest('hex')};
  const request={worlds:[world,world],moved:false,expectedManifest:null};
  await store.commit(request);
  let terrain;
  await store.withSelected(async({sources})=>{
    terrain=await checkpointTerrain(sources[0]);
    const window=await terrain.window(32,0,32,32),target=expected(f,32,0,32,32);
    assert.deepEqual(Buffer.from(window.vertices),target.vertices);
    await assert.rejects(store.commit(request),/busy/);
  });
  await assert.rejects(terrain.window(32,0,32,32),/lease ended/);
  assert.equal(locked,false);
});
