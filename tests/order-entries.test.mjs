import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointActorOrderEntries,checkpointActorOrderUnitTargets,MAX_NATIVE_ORDER_FIXED_BYTES,MAX_NATIVE_ORDER_ENTRIES,MAX_NATIVE_ORDER_WAYPOINTS} from '../web/world/order-entries.mjs';
import {checkpointFile} from '../web/world/checkpoint.mjs';
const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b;};
const words=values=>Buffer.concat(values.map(word));
const chunk=(tag,body=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),word(body.length),word(version),word(count),body]);
function entry(kind){
  const lengths={1:33,2:44,4:35,5:44,6:44,7:28,10:30,11:50,13:47};
  const payload=Array(lengths[kind]).fill(0xfedcba98);
  const inherited=[11,13].includes(kind);
  payload.splice(0,inherited?5:4,...(inherited?[1,1,1,2,kind]:[kind===4?5:[1,2].includes(kind)?2:1,1,2,kind]));
  if(kind===4)payload[34]=0;
  if(kind===7)payload[27]=0;
  return Buffer.concat([words([1,kind]),words(payload)]);
}
const banks=(groups=[[],[],[]])=>Buffer.concat(groups.map(entries=>Buffer.concat([words([1,entries.length]),...entries])));
const order=(id,body)=>Buffer.concat([word(id),chunk('ORDR',chunk('PRIM',body,2),0,1)]);
const save=(records=[],padding=0)=>Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('MTER',Buffer.alloc(padding)),
  chunk('ORDR',Buffer.concat(records),1,records.length),chunk('CONT',undefined,1)]);
function source(data){
  const requests=[];let active=0,peak=0;
  return {size:data.length,requests,get peak(){return peak;},async readAt(at,n){
    assert.ok(n<=4096);requests.push([at,n]);peak=Math.max(peak,++active);await Promise.resolve();--active;return data.subarray(at,at+n);
  }};
}
async function collect(input,id=506){const values=[];for await(const value of checkpointActorOrderEntries(input,id))values.push(value);return values;}

test('all three bank positions expose populated layouts without interpreting raw words',async()=>{
  const data=save([order(506,banks([[entry(1)],[entry(2),entry(5)],[]]))]),input=source(data),result=await collect(input);
  assert.deepEqual(result.filter(r=>r.type==='bank').map(r=>[r.bank,r.count]),[[0,1],[1,2],[2,0]]);
  const entries=result.filter(r=>r.type==='entry');assert.deepEqual(entries.map(r=>[r.kind,r.size]),[[1,132],[2,176],[5,176]]);
  for(const e of entries){assert.ok(Object.isFrozen(e)&&Object.isFrozen(e.words));assert.equal(e.words[4],0xfedcba98);assert.equal(Object.hasOwn(e,'targetUnitId'),false);}
  assert.equal(input.peak,1);assert.equal(MAX_NATIVE_ORDER_FIXED_BYTES,200);
  assert.deepEqual(result,await collect(checkpointFile(new Blob([data]))));
});
test('empty/absent orders and unrelated opaque attachments retain their distinct meanings',async()=>{
  assert.deepEqual((await collect(source(save([order(506,banks())])))).map(r=>r.count),[0,0,0]);
  assert.deepEqual(await collect(source(save([order(99,words([77]))]))),[]);
});
test('kind13 preserves its inherited framing and opaque tail before the next bank',async()=>{
  const command=entry(13),data=save([order(506,banks([[command],[entry(6)],[]]))]);
  const parsed=(await collect(source(data))).filter(r=>r.type==='entry');
  assert.deepEqual(parsed.map(r=>[r.kind,r.size,r.bank]),[[13,188,0],[6,176,1]]);
  assert.equal(parsed[0].parentVersion,1);assert.deepEqual(parsed[0].words.slice(45),[0xfedcba98,0xfedcba98]);
  for(const word of [0,1,2,3,4]){
    const bad=Buffer.from(command);bad.writeUInt32LE(99,8+word*4);
    await assert.rejects(collect(source(save([order(506,banks([[bad],[],[]]))]))),/Unsupported/);
  }
  await assert.rejects(collect(source(save([order(506,banks([[command.subarray(0,-4)],[],[]]))]))),/Truncated|Trailing|Unsupported/);
});
test('unsupported kinds and altered version/discriminator words fail closed',async()=>{
  const unsupported=save([order(506,banks([[words([1,3])],[],[]]))]);
  await assert.rejects(collect(source(unsupported)),error=>error.code==='NATIVE_ORDER_KIND_UNSUPPORTED'&&error.kind===3);
  for(const index of [0,1,2,3,4,5]){
    const bad=entry(5);bad.writeUInt32LE(99,index*4);
    await assert.rejects(collect(source(save([order(506,banks([[bad],[],[]]))]))),/Unsupported/);
  }
});

test('additional leaf and inherited layouts preserve every raw word and reject every version mismatch',async()=>{
  const data=save([order(506,banks([[entry(6)],[entry(7),entry(10)],[entry(11)]]))]);
  const entries=(await collect(source(data))).filter(r=>r.type==='entry');
  assert.deepEqual(entries.map(e=>[e.kind,e.size,e.leafVersion,e.baseVersion,e.embeddedVersion]),[
    [6,176,1,1,2],[7,112,1,1,2],[10,120,1,1,2],[11,200,1,1,2]]);
  assert.equal(entries[3].parentVersion,1);assert.equal(entries[3].words[5],0xfedcba98);
  for(const kind of [6,7,10,11])for(let index=0;index<(kind===11?5:4);++index){
    const bad=entry(kind);bad.writeUInt32LE(99,8+index*4);
    await assert.rejects(collect(source(save([order(506,banks([[bad],[],[]]))]))),/Unsupported/);
  }
});
test('a late unsupported entry or duplicate attachment prevents complete structural qualification',async()=>{
  const input=source(save([order(506,banks([[entry(5),words([1,16])],[],[]]))]));
  const iterator=checkpointActorOrderEntries(input,506);
  assert.equal((await iterator.next()).value.type,'bank');assert.equal((await iterator.next()).value.kind,5);
  await assert.rejects(iterator.next(),/kind: 16/);
  await assert.rejects(collect(source(save([order(506,banks()),order(506,banks())]))),/Duplicate/);
});
test('truncated bodies, trailing bytes and declared entry overflow are rejected',async()=>{
  await assert.rejects(collect(source(save([order(506,banks([[entry(2).subarray(0,24)],[],[]]))]))),/Truncated/);
  await assert.rejects(collect(source(save([order(506,Buffer.concat([banks(),word(0)]))]))),/Trailing/);
  await assert.rejects(collect(source(save([order(506,words([1,MAX_NATIVE_ORDER_ENTRIES+1]))]))),/budget/);
  await assert.rejects(collect(source(save([order(506,Buffer.alloc(65536))]))),/oversized/);
});
test('entries crossing a page boundary remain serial and skip dormant terrain',async()=>{
  const padding=4095-272-16-16-4-32-8-8;
  const data=save([order(506,banks([[entry(5)],[],[]]))],padding),input=source(data),result=await collect(input);
  assert.equal(result.find(r=>r.type==='entry').offset,4095);assert.equal(input.peak,1);
  const large=source(save([order(506,banks([[entry(5)],[],[]]))],1024*1024));await collect(large);
  assert.ok(large.requests.reduce((sum,r)=>sum+r[1],0)<16384);
});
test('invalid identities and incomplete body reads never yield a checked entry',async()=>{
  const data=save([order(506,banks([[entry(5)],[],[]]))]);
  for(const id of [0,-1,0x100000000,NaN,'506'])await assert.rejects(collect(source(data),id),/unit ID/);
  const input=source(data),read=input.readAt;input.readAt=async(at,n)=>n===176?new Uint8Array(175):read(at,n);
  await assert.rejects(collect(input),/Truncated/);
});

test('kind four streams path pairs in bounded blocks and rejects unsafe path counts',async()=>{
  const count=600,base=entry(4);base.writeUInt32LE(count,8+34*4);
  const points=Array.from({length:count},(_,i)=>[0x80000000+i,0xffffff00+i]).flat();
  const input=source(save([order(506,banks([[Buffer.concat([base,words(points)])],[],[]]))])),result=await collect(input);
  const header=result.find(r=>r.type==='entry'),path=result.filter(r=>r.type==='waypoint');
  assert.equal(header.waypointCount,count);assert.equal(header.serializedSize,140+count*8);
  assert.deepEqual(path.flatMap(p=>[p.firstWord,p.secondWord]),points.map(n=>n>>>0));
  assert.deepEqual(path.map(p=>p.waypointIndex),Array.from({length:count},(_,i)=>i));
  assert.equal(input.peak,1);assert.ok(input.requests.every(r=>r[1]<=4096));
  const boundary=entry(4);boundary.writeUInt32LE(MAX_NATIVE_ORDER_WAYPOINTS,8+34*4);
  const maximum=source(save([order(506,banks([[Buffer.concat([boundary,Buffer.alloc(MAX_NATIVE_ORDER_WAYPOINTS*8)])],[],[]]))]));
  let streamed=0;
  for await(const value of checkpointActorOrderEntries(maximum,506))if(value.type==='waypoint'){
    assert.equal(value.waypointIndex,streamed++);assert.equal(value.firstWord,0);assert.equal(value.secondWord,0);
  }
  assert.equal(streamed,MAX_NATIVE_ORDER_WAYPOINTS);assert.equal(maximum.peak,1);
  for(const wrong of [MAX_NATIVE_ORDER_WAYPOINTS+1,0xffffffff,count+1]){
    const bad=Buffer.from(base);bad.writeUInt32LE(wrong,8+34*4);
    await assert.rejects(collect(source(save([order(506,banks([[bad],[],[]]))]))),/waypoint budget or boundary/);
  }
});

test('kind seven path framing uses its own count location and the shared streaming limits',async()=>{
  const count=600,base=entry(7);base.writeUInt32LE(count,8+27*4);
  const points=words(Array.from({length:count},(_,i)=>[i,0x80000000+i]).flat());
  const input=source(save([order(506,banks([[],[Buffer.concat([base,points])],[]]))])),values=await collect(input);
  const header=values.find(e=>e.type==='entry'),path=values.filter(e=>e.type==='waypoint');
  assert.equal(header.size,112);assert.equal(header.serializedSize,112+count*8);assert.equal(header.waypointCount,count);
  assert.deepEqual(path.map(p=>[p.waypointIndex,p.firstWord,p.secondWord]),Array.from({length:count},(_,i)=>[i,i,0x80000000+i]));
  assert.equal(input.peak,1);assert.ok(input.requests.every(r=>r[1]<=4096));
  for(const wrong of [MAX_NATIVE_ORDER_WAYPOINTS+1,0xffffffff,count+1]){
    const bad=Buffer.from(base);bad.writeUInt32LE(wrong,8+27*4);
    await assert.rejects(collect(source(save([order(506,banks([[bad],[],[]]))]))),/waypoint budget or boundary/);
  }
});

async function targets(input,id=506){const result=[];for await(const value of checkpointActorOrderUnitTargets(input,id))result.push(value);return result;}
test('target inspection identifies only Follow Unit targets despite identical scalar and callback values',async()=>{
  const commands=[entry(5),entry(6),entry(11),entry(10)];
  // Every opaque word deliberately collides with the target. No numeric search
  // may reinterpret callback, action, inherited, or base fields as UNIT IDs.
  const data=save([order(506,banks([commands.slice(0,2),commands.slice(2),[]]))]),input=source(data);
  const entries=(await collect(source(data))).filter(e=>e.type==='entry'),result=await targets(input);
  assert.deepEqual(result,[{type:'unit-target',unitId:506,bank:0,index:1,kind:6,
    field:'_targetID',targetUnitId:0xfedcba98,offset:entries[1].offset+100,size:4}]);
  assert.ok(Object.isFrozen(result[0]));assert.equal(input.peak,1);
});
test('target values retain unsigned identity and exact byte provenance across banks and page boundaries',async()=>{
  const low=entry(6),high=entry(6),zero=entry(6);
  low.writeUInt32LE(531,8+25*4);high.writeUInt32LE(0xffffffff,8+25*4);zero.writeUInt32LE(0,8+25*4);
  const padding=4095-272-16-16-4-32-8-8;
  const data=save([order(506,banks([[low],[high],[zero]]))],padding),result=await targets(source(data));
  assert.deepEqual(result.map(r=>[r.bank,r.index,r.targetUnitId]),[[0,0,531],[1,0,0xffffffff],[2,0,0]]);
  assert.equal(result[0].offset,4095+100);
  for(const r of result)assert.equal(data.readUInt32LE(r.offset),r.targetUnitId);
  data.writeUInt32LE(9000,result[0].offset);
  assert.equal(result[0].targetUnitId,531); // No retained view into source bytes.
});
test('target iteration still rejects late unsupported orders, duplicate attachments, and malformed versions',async()=>{
  const input=source(save([order(506,banks([[entry(6),words([1,16])],[],[]]))]));
  const iterator=checkpointActorOrderUnitTargets(input,506);
  assert.equal((await iterator.next()).value.targetUnitId,0xfedcba98);
  await assert.rejects(iterator.next(),error=>error.code==='NATIVE_ORDER_KIND_UNSUPPORTED'&&error.kind===16);
  await assert.rejects(targets(source(save([order(506,banks([[entry(6)],[],[]])),order(506,banks())]))),/Duplicate/);
  const bad=entry(6);bad.writeUInt32LE(2,8);
  await assert.rejects(targets(source(save([order(506,banks([[bad],[],[]]))]))),/Unsupported/);
});
test('absent, empty, and unrelated order records expose no target while invalid identities still fail',async()=>{
  for(const records of [[],[order(506,banks())],[order(99,words([77]))]])
    assert.deepEqual(await targets(source(save(records))),[]);
  await assert.rejects(targets(source(save()),0),/unit ID/);
});
