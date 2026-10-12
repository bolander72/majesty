import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {reconcileTerrainHeights,MAX_RECONCILE_BORDER_BYTES} from '../web/world/terrain-reconcile.mjs';

function chunk(tag,version,count,...parts){
  const body=Buffer.concat(parts),head=Buffer.alloc(16);head.write(tag);head.writeUInt32LE(body.length,4);
  head.writeUInt32LE(version,8);head.writeUInt32LE(count,12);return Buffer.concat([head,body]);
}
function fixture(width=65,height=33,{flat=null,padding=0}={}){
  const dimensions=Buffer.alloc(40);dimensions.writeUInt32LE(width);dimensions.writeUInt32LE(height,4);
  const records=Buffer.alloc((width+1)*(height+1)*9);
  for(let y=0;y<=height;++y)for(let x=0;x<=width;++x){
    const at=(y*(width+1)+x)*9;records.writeFloatLE(flat??(x+y*3)/8,at);records[at+4]=129;records.writeUInt32LE(0x12345678,at+5);
  }
  const bytes=Buffer.concat([chunk('VERS',1,0,Buffer.alloc(256,17)),chunk('META',0,0,Buffer.alloc(padding,19)),
    chunk('MAP ',0,1,chunk('PRIM',2,0,dimensions)),chunk('MTER',0,2,
      chunk('MVTX',0,1,chunk('PRIM',2,(width+1)*(height+1),records)),
      chunk('MCEL',0,1,chunk('PRIM',5,width*height,Buffer.alloc(width*height*5,201)))),chunk('TAIL',7,0,Buffer.alloc(317,55))]);
  let largestRead=0;
  const source={size:bytes.length,async readAt(at,n){largestRead=Math.max(largestRead,n);return bytes.subarray(at,at+n);}};
  return {bytes,source,get largestRead(){return largestRead;}};
}
async function copy(target,borders){
  const parts=[];let largestWrite=0;
  const report=await reconcileTerrainHeights({source:target.source,borders},{async write(bytes){
    largestWrite=Math.max(largestWrite,bytes.length);parts.push(Buffer.from(bytes));
  }});
  return {bytes:Buffer.concat(parts),report,largestWrite};
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('border reconciliation changes only the selected four-byte heights and preserves original bytes',async()=>{
  const target=fixture(),donor=fixture(33,33,{flat:7}),terrain=await checkpointTerrain(target.source),other=await checkpointTerrain(donor.source);
  const original=Buffer.from(target.bytes),expected=Buffer.from(original);
  for(let y=0;y<=33;++y)expected.writeFloatLE(7,terrain.heightOffset(0,y));
  const result=await copy(target,[{side:'left',sourceSide:'right',terrain:other}]);
  assert.deepEqual(result.bytes,expected);assert.deepEqual(target.bytes,original);
  assert.equal(result.report.size,original.length);assert.equal(result.report.sha256,sha(expected));
  assert.equal(result.report.changedVertices,34);assert.equal(result.report.borderCount,1);
  assert.equal(result.report.changedBytes,expected.reduce((n,b,i)=>n+(b!==original[i]),0));
  assert.ok(target.largestRead<=4096);assert.ok(donor.largestRead<=4096);assert.ok(result.largestWrite<=4096);
  assert.equal(MAX_RECONCILE_BORDER_BYTES,1188);
});
test('all four borders merge shared corners once, preserve interiors and retry with identical output',async()=>{
  const target=fixture(32,32),donor=fixture(32,32,{flat:7}),terrain=await checkpointTerrain(target.source),other=await checkpointTerrain(donor.source);
  const borders=['left','right','top','bottom'].map(side=>({side,sourceSide:side,terrain:other}));
  const expected=Buffer.from(target.bytes);
  for(let y=0;y<=32;++y)for(let x=0;x<=32;++x)if(x===0||y===0||x===32||y===32)expected.writeFloatLE(7,terrain.heightOffset(x,y));
  const first=await copy(target,borders),second=await copy(target,borders);assert.deepEqual(first.bytes,expected);assert.deepEqual(second.report,first.report);
  const edited={source:{size:first.bytes.length,readAt:async(at,n)=>first.bytes.subarray(at,at+n)}};
  const repeated=await copy(edited,borders);assert.equal(repeated.report.changedVertices,0);assert.equal(repeated.report.changedBytes,0);
  assert.equal(repeated.report.sha256,first.report.sha256);assert.deepEqual(repeated.bytes,first.bytes);
});
test('a four-byte height split across a 4096-byte page is copied exactly once',async()=>{
  const target=fixture(65,33,{padding:3686}),donor=fixture(33,33,{flat:7}),terrain=await checkpointTerrain(target.source);
  assert.equal(terrain.heightOffset(0,0),4094);const expected=Buffer.from(target.bytes);
  for(let y=0;y<=33;++y)expected.writeFloatLE(7,terrain.heightOffset(0,y));
  const result=await copy(target,[{side:'left',sourceSide:'right',terrain:await checkpointTerrain(donor.source)}]);
  assert.deepEqual(result.bytes,expected);assert.equal(result.report.changedVertices,34);assert.equal(result.report.sha256,sha(expected));
});
test('conflicting corner donors and invalid border dimensions reject before any sink write',async()=>{
  const target=fixture(32,32),one=await checkpointTerrain(fixture(32,32,{flat:1}).source),two=await checkpointTerrain(fixture(32,32,{flat:2}).source);
  for(const borders of [[{side:'left',sourceSide:'right',terrain:one},{side:'top',sourceSide:'bottom',terrain:two}],
    [{side:'left',sourceSide:'right',terrain:await checkpointTerrain(fixture(32,33).source)}],
    [{side:'left',sourceSide:'top',terrain:one}],Array.from({length:5},()=>({side:'left',sourceSide:'right',terrain:one})),
    [{side:'left',sourceSide:'right',terrain:one},{side:'left',sourceSide:'right',terrain:one}]]){
    let writes=0;await assert.rejects(reconcileTerrainHeights({source:target.source,borders},{write(){++writes;}}));assert.equal(writes,0);
  }
});
test('nonfinite or oversized donor strips, sink failures and changed sources produce no completed draft',async()=>{
  const target=fixture(32,32),baseline=Buffer.from(target.bytes);
  for(const mode of ['nonfinite','oversized']){
    const bad={width:32,height:32,async edge(side,start,count){const bytes=new Uint8Array(count*9+(mode==='oversized'?1:0));
      if(mode==='nonfinite')new DataView(bytes.buffer).setFloat32(0,NaN,true);return bytes.subarray(0,count*9);}};
    let writes=0;await assert.rejects(reconcileTerrainHeights({source:target.source,borders:[{side:'left',sourceSide:'right',terrain:bad}]},{write(){++writes;}}));
    assert.equal(writes,0);
  }
  const border={side:'left',sourceSide:'right',terrain:await checkpointTerrain(fixture(32,32,{flat:7}).source)};
  await assert.rejects(reconcileTerrainHeights({source:target.source,borders:[border]},{write(){throw Error('sink failed');}}),/sink failed/);
  await assert.rejects(reconcileTerrainHeights({source:target.source,borders:[border]},{write(){++target.source.size;}}),/source changed/);
  --target.source.size;assert.deepEqual(target.bytes,baseline);
});
test('request mutation during asynchronous parsing cannot change the captured border operation',async()=>{
  const target=fixture(32,32),donor=await checkpointTerrain(fixture(32,32,{flat:7}).source);
  const border={side:'left',sourceSide:'right',terrain:donor},borders=[border],read=target.source.readAt;
  let altered=false;target.source.readAt=async(at,n)=>{if(!altered){altered=true;border.side='bottom';borders.push(border);}return read(at,n);};
  const result=await copy(target,borders),terrain=await checkpointTerrain(target.source);
  assert.equal(result.report.borderCount,1);assert.equal(result.bytes.readFloatLE(terrain.heightOffset(0,1)),7);
  assert.equal(result.bytes.readFloatLE(terrain.heightOffset(1,32)),(1+32*3)/8);
});
test('unsafe native height conversion rejects a border without changing either input or publishing a draft',async()=>{
  const target=fixture(32,32),original=Buffer.from(target.bytes);
  for(const height of [32768,-32768.00390625,0.1,-0,1/131072]){
    const donor=fixture(32,32,{flat:height}),donorBefore=Buffer.from(donor.bytes);let writes=0;
    await assert.rejects(reconcileTerrainHeights({source:target.source,borders:[
      {side:'left',sourceSide:'right',terrain:await checkpointTerrain(donor.source)},
    ]},{write(){++writes;}}),/signed Q16 range|changes on reload/);
    assert.equal(writes,0);assert.deepEqual(target.bytes,original);assert.deepEqual(donor.bytes,donorBefore);
  }
});
test('a noncanonical interior border point aborts streaming before a completed result',async()=>{
  const target=fixture(32,70),donor=fixture(32,70,{flat:7}),terrain=await checkpointTerrain(donor.source);
  donor.bytes.writeFloatLE(0.1,terrain.heightOffset(32,50));const original=Buffer.from(target.bytes),parts=[];
  await assert.rejects(reconcileTerrainHeights({source:target.source,borders:[{side:'left',sourceSide:'right',terrain}]},
    {write(bytes){parts.push(Buffer.from(bytes));}}),/changes on reload/);
  assert.ok(parts.length>0,'private staging may begin before an unsafe later strip is discovered');
  assert.ok(Buffer.concat(parts).length<target.bytes.length,'there is no completed draft result');
  assert.deepEqual(target.bytes,original);
});
