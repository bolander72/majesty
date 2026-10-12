import test from 'node:test';
import assert from 'node:assert/strict';
import {haloRegionLayout,haloTerrainHeight,haloSharedVertex,planHaloActorHandoff,HALO_CORE_CELLS} from '../web/world/halo-region-layout.mjs';
const Q=2048,LOW=64*Q,HIGH=(128*32-64)*Q;
test('ownership cores tile exactly while the original native maps retain a bounded overlap',()=>{
  const a=haloRegionLayout('0_0'),b=haloRegionLayout('1_0');assert.equal(HALO_CORE_CELLS,124);
  assert.equal(a.core.originX+a.core.widthCells*32,b.core.originX);
  assert.equal(a.native.widthCells,128);assert.equal(a.native.originX,-64);
  assert.equal(a.native.originX+128*32-b.native.originX,128);
  assert.deepEqual(haloRegionLayout('-1000000_1000000').core,{originX:-3968000000,originY:3968000000,widthCells:124,heightCells:124});
});
test('accepted movement changes ownership in all four directions while the footprint fits both maps',()=>{
  for(const[direction,key,axis,negative]of [['west','-1_0','x',true],['east','1_0','x',false],['north','0_-1','y',true],['south','0_1','y',false]]){
    const before={x:352*Q+813,y:795*Q+27,z:125678},after={...before};
    before[axis]=negative?LOW+13:HIGH-13;after[axis]=negative?LOW-727:HIGH+727;
    const result=planHaloActorHandoff(before,after,'0_0');assert.equal(result.destinationRegion,key,direction);
    const from=haloRegionLayout('0_0').native,to=haloRegionLayout(key).native;
    for(const[coordinate,origin]of [['x','originX'],['y','originY']]){
      assert.equal(from[origin]*Q+after[coordinate],to[origin]*Q+result.destinationPose[coordinate]);
      assert.equal(result.globalFixed[coordinate]-result.previousGlobalFixed[coordinate],after[coordinate]-before[coordinate]);
    }
    for(const grid of [result.sourceGrid,result.destinationGrid])assert.ok([grid.x,grid.y].every(n=>n>=2&&n<254));
    assert.equal(result.destinationPose.z,after.z);assert.equal(result.ownerPublished,false);assert.equal(result.collisionQualified,false);
  }
});
test('a reverse handoff returns to the same global position without rounding the fractional pose',()=>{
  const previous={x:LOW,y:731*Q+813,z:12345},proposed={...previous,x:LOW-1};
  const outward=planHaloActorHandoff(previous,proposed,'0_0');
  const returned=planHaloActorHandoff(outward.destinationPose,{...outward.destinationPose,x:outward.destinationPose.x+1},'-1_0');
  assert.equal(returned.destinationRegion,'0_0');assert.deepEqual(returned.destinationPose,previous);
  assert.deepEqual(returned.globalFixed,outward.previousGlobalFixed);
});
test('every vertex in the four shared halo strips has an identical world height',()=>{
  for(const origin of [[0,0],[-999999,999999]]){
    const[x,y]=origin,key=`${x}_${y}`;
    for(let along=0;along<=128;++along)for(let overlap=0;overlap<=4;++overlap){
      assert.equal(haloTerrainHeight(key,124+overlap,along),haloTerrainHeight(`${x+1}_${y}`,overlap,along));
      assert.equal(haloTerrainHeight(key,overlap,along),haloTerrainHeight(`${x-1}_${y}`,124+overlap,along));
      assert.equal(haloTerrainHeight(key,along,124+overlap),haloTerrainHeight(`${x}_${y+1}`,along,overlap));
      assert.equal(haloTerrainHeight(key,along,overlap),haloTerrainHeight(`${x}_${y-1}`,along,124+overlap));
    }
  }
  assert.equal(haloSharedVertex(4,32),true);assert.equal(haloSharedVertex(124,32),true);assert.equal(haloSharedVertex(32,5),false);
});
test('wrong selected owner, diagonal travel, physical edges and invalid geometry refuse',()=>{
  const p={x:LOW,y:LOW,z:0};
  assert.throws(()=>planHaloActorHandoff({...p,x:LOW-1},p,'0_0'),/selected halo owner/);
  assert.throws(()=>planHaloActorHandoff(p,{...p,x:LOW-1,y:LOW-1},'0_0'),/cardinal/);
  assert.throws(()=>planHaloActorHandoff(p,{...p,x:0},'0_0'),/footprint/);
  assert.throws(()=>planHaloActorHandoff(p,{...p,x:-1},'0_0'),/source region/);
  assert.throws(()=>planHaloActorHandoff(p,{...p,z:1.5},'0_0'),/source region/);
  for(const key of ['00_0','0_-0','1000001_0'])assert.throws(()=>haloRegionLayout(key));
});
test('interior motion creates no handoff and retained handoff metadata excludes arbitrary caller payloads',()=>{
  const p={x:LOW+100,y:LOW+100,z:0};assert.equal(planHaloActorHandoff(p,{...p,x:p.x+1},'0_0'),null);
  const result=planHaloActorHandoff({...p,x:LOW},{...p,x:LOW-1,unrelated:new Uint8Array(10000)},'0_0');
  assert.deepEqual(Object.keys(result.sourcePose).sort(),['x','y','z']);assert.ok(JSON.stringify(result).length<1024);
});
