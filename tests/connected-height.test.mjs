import test from 'node:test';
import assert from 'node:assert/strict';
import {connectedHeightQ16,CONNECTED_REGION_CELLS} from '../web/world/connected-height.mjs';
import {requireStableNativeHeight} from '../web/world/native-height.mjs';

test('globally addressed neighboring regions share every height and all four corners across negative and distant coordinates',()=>{
  for(const [rx,ry]of [[0,0],[-1,0],[0,-1],[-1,-1],[999999,-999999],[-1000000,1000000]]){
    const height=(x,y,px,py)=>connectedHeightQ16(x*CONNECTED_REGION_CELLS+px,y*CONNECTED_REGION_CELLS+py);
    for(let at=0;at<=128;++at){
      assert.equal(height(rx,ry,128,at),height(rx+1,ry,0,at));
      assert.equal(height(rx,ry,at,128),height(rx,ry+1,at,0));
    }
    assert.equal(height(rx,ry,128,128),height(rx+1,ry+1,0,0));
  }
});
test('gentle generated heights retain exact original Q16 serialization and avoid a flat or repeating per-region pattern',()=>{
  const bytes=new ArrayBuffer(4),view=new DataView(bytes);let minimum=Infinity,maximum=-Infinity;
  const fingerprints=[];
  for(const [rx,ry]of [[0,0],[1,0],[-1,0]]){
    let hash=2166136261;
    for(let y=0;y<=128;++y)for(let x=0;x<=128;++x){
      const value=connectedHeightQ16(rx*128+x,ry*128+y);
      minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);
      assert.ok(Number.isInteger(value)&&value>=-4*65536&&value<=4*65536);
      view.setFloat32(0,value/65536,true);requireStableNativeHeight(view.getUint32(0,true));
      hash=Math.imul(hash^value,16777619)>>>0;
    }
    fingerprints.push(hash);
  }
  assert.ok(minimum<0&&maximum>0);assert.equal(new Set(fingerprints).size,3);
});
test('invalid, unsafe and fractional global coordinates reject rather than aliasing another world vertex',()=>{
  for(const [x,y]of [[NaN,0],[0,Infinity],[1.5,0],[2**31,0],[0,-(2**31)],[Number.MAX_SAFE_INTEGER,0]])
    assert.throws(()=>connectedHeightQ16(x,y),/coordinate/);
});
