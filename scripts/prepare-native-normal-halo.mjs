// Synthetic geometry only, prepared through the shipped bounded halo adapter.
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {nativeNormalHalo} from '../web/world/terrain-halo.mjs';
import {nativeHeightBits} from '../web/world/native-height.mjs';

const root=resolve(import.meta.dirname,'..');
const height=(x,y)=>((x*13+y*7+Math.floor(x/3)*Math.floor(y/2))%31)*4096||0;
function vertices(wx,wy){
  const vertices=new Uint8Array(33*33*9),view=new DataView(vertices.buffer);
  for(let y=0;y<33;++y)for(let x=0;x<33;++x){
    const at=(y*33+x)*9;view.setUint32(at,nativeHeightBits(height(wx*32+x,wy*32+y)),true);
    vertices[at+4]=17;view.setUint32(at+5,0x12345678,true);
  }
  return {width:32,height:32,vertices};
}
function grid(originX,originY,width,heightCells){
  const heights=[];
  for(let y=0;y<=heightCells;++y)for(let x=0;x<=width;++x)heights.push(height(originX+x,originY+y));
  return {originX,originY,width,height:heightCells,stride:width+1,heights};
}
const cases=[];
for(const [baseX,baseY]of [[0,0],[-2,-1],[-1,-1]]){
  const active=new Map();
  for(let y=baseY-1;y<=baseY+2;++y)for(let x=baseX-1;x<=baseX+2;++x)active.set(`${x},${y}`,vertices(x,y));
  const reference=grid(baseX*32-2,baseY*32-2,68,68),halos=[],independent=[];
  for(const [wx,wy]of [[baseX,baseY],[baseX+1,baseY],[baseX,baseY+1],[baseX+1,baseY+1]]){
    const halo=nativeNormalHalo(active,wx,wy);assert.equal(halo.heights.byteLength,5476);
    const expected=grid(wx*32-2,wy*32-2,36,36);assert.deepEqual([...halo.heights],expected.heights);
    halos.push({...halo,heights:[...halo.heights]});independent.push(grid(wx*32,wy*32,32,32));
  }
  const oneCellBaseline=grid(baseX*32-1,baseY*32-1,34,34);
  cases.push({baseX,baseY,light:[0.3,0.85,0.4],reference,halos,independent,oneCellBaseline});
}
const sourcesSha256={};
for(const name of ['terrain-halo.mjs','native-height.mjs'])sourcesSha256['web/world/'+name]=createHash('sha256').update(await readFile(join(root,'web/world',name))).digest('hex');
await writeFile(join(root,'output/native-normal-halo-inputs.json'),JSON.stringify({synthetic:true,sourcesSha256,cases})+'\n');
console.log(JSON.stringify({passed:true,cases:cases.length,halos:12,haloBytes:5476,activeWindowsPerCase:16,gameLaunches:0}));
