import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeNormalHalo,MAX_NORMAL_HALO_BYTES,NORMAL_HALO_STRIDE} from '../web/world/terrain-halo.mjs';
import {nativeHeightBits} from '../web/world/native-height.mjs';

const height=(x,y)=>((x*13+y*7+Math.floor(x/3)*Math.floor(y/2))%31)*4096||0;
function fixture(wx=0,wy=0){
  const active=new Map();
  for(let y=wy-1;y<=wy+1;++y)for(let x=wx-1;x<=wx+1;++x){
    const vertices=new Uint8Array(33*33*9),view=new DataView(vertices.buffer);
    for(let j=0;j<33;++j)for(let i=0;i<33;++i){const at=(j*33+i)*9;
      view.setUint32(at,nativeHeightBits(height(x*32+i,y*32+j)),true);
      vertices[at+4]=(x+y+256)&255;view.setUint32(at+5,0xaabbccdd,true);
    }
    active.set(`${x},${y}`,{width:32,height:32,vertices});
  }
  return active;
}
test('normal halo uses nine matching windows and exactly one owned 37-square signed-Q16 grid',()=>{
  const active=fixture(),before=[...active.values()].map(w=>Uint8Array.from(w.vertices));
  const halo=nativeNormalHalo(active,0,0);
  assert.equal(NORMAL_HALO_STRIDE,37);assert.equal(MAX_NORMAL_HALO_BYTES,5476);assert.equal(halo.heights.byteLength,5476);
  assert.equal(halo.width,36);assert.equal(halo.height,36);assert.equal(halo.coreSide,32);assert.equal(halo.coreX,2);assert.equal(halo.coreY,2);
  assert.equal(halo.originX,-2);assert.equal(halo.originY,-2);
  for(let y=0;y<37;++y)for(let x=0;x<37;++x)assert.equal(halo.heights[y*37+x],height(x-2,y-2));
  [...active.values()].forEach((w,i)=>assert.deepEqual(w.vertices,before[i]));
  assert.ok(Object.isFrozen(halo));assert.equal(halo.heights.buffer.byteLength,halo.heights.byteLength);
  // Validate and consume the same captured buffer even with accessor metadata.
  const accessor=fixture(),captured=accessor.get('0,0');let reads=0;
  accessor.set('0,0',{width:32,height:32,get vertices(){++reads;return reads===1?captured.vertices:null;}});
  assert.deepEqual(nativeNormalHalo(accessor,0,0).heights,halo.heights);assert.equal(reads,1);
});
test('negative coordinates and adjacent windows agree across all shared core edges and corners',()=>{
  const halos=new Map();
  for(const [wx,wy]of [[-1,-1],[0,-1],[-1,0],[0,0]])halos.set(`${wx},${wy}`,nativeNormalHalo(fixture(wx,wy),wx,wy));
  for(let i=0;i<=32;++i){
    const topLeft=halos.get('-1,-1').heights,topRight=halos.get('0,-1').heights,bottomLeft=halos.get('-1,0').heights;
    assert.equal(topLeft[(i+2)*37+34],topRight[(i+2)*37+2]);
    assert.equal(topLeft[34*37+i+2],bottomLeft[2*37+i+2]);
  }
  const corners=[halos.get('-1,-1').heights[34*37+34],halos.get('0,-1').heights[34*37+2],
    halos.get('-1,0').heights[2*37+34],halos.get('0,0').heights[2*37+2]];
  assert.ok(corners.every(n=>n===corners[0]));
});
test('missing geometry, conflicting heights and oversized backing buffers reject without mutating the snapshot',()=>{
  for(const kind of ['missing','conflict','oversized']){
    const active=fixture(),original=Uint8Array.from(active.get('0,0').vertices);
    if(kind==='missing')active.delete('-1,-1');
    if(kind==='conflict')new DataView(active.get('-1,0').vertices.buffer).setUint32(32*9,nativeHeightBits(8),true);
    if(kind==='oversized')active.get('-1,-1').vertices=new Uint8Array(33*33*9+1).subarray(0,33*33*9);
    assert.throws(()=>nativeNormalHalo(active,0,0),/unavailable|seam differs|vertices/);
    assert.deepEqual(active.get('0,0').vertices,original);
  }
});
test('noncanonical geometry and invalid windows or coordinates cannot become a completed halo',()=>{
  const active=fixture();new DataView(active.get('0,0').vertices.buffer).setFloat32((20*33+20)*9,0.1,true);
  assert.throws(()=>nativeNormalHalo(active,0,0),/changes on reload/);
  for(const point of [[.5,0],[0,NaN],[Number.MAX_SAFE_INTEGER,0]])assert.throws(()=>nativeNormalHalo(fixture(),...point));
  const invalid=fixture();invalid.get('0,0').width=33;assert.throws(()=>nativeNormalHalo(invalid,0,0),/window/);
  assert.throws(()=>nativeNormalHalo(null,0,0),/halo/);
});
