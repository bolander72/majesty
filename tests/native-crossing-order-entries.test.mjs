import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointActorOrderEntries as crossingEntries} from '../scripts/lib/native-crossing-order-entries.mjs';
import {checkpointActorOrderEntries as runtimeEntries} from '../web/world/order-entries.mjs';
const words=vs=>{const b=Buffer.alloc(vs.length*4);vs.forEach((v,i)=>b.writeUInt32LE(v>>>0,i*4));return b;};
const chunk=(tag,b=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([b.length,version,count]),b]);
const body9=()=>words([1,1,2,9,...Array(20).fill(0x11000038)]);
const entry9=()=>Buffer.concat([words([1,9]),body9()]);
const attachment=b=>Buffer.concat([words([2142]),chunk('ORDR',chunk('PRIM',b,2),0,1)]);
const banks=entries=>Buffer.concat([words([1,entries.length]),...entries,words([1,0,1,0])]);
const save=(records,padding=0)=>Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('MTER',Buffer.alloc(padding)),
  chunk('ORDR',Buffer.concat(records),1,records.length),chunk('CONT',undefined,1)]);
function source(data) {return {size:data.length,requests:[],async readAt(at,n){assert.ok(n<=4096);this.requests.push([at,n]);return data.subarray(at,at+n);}};}
async function collect(s,reader=crossingEntries){const result=[];for await(const r of reader(s,2142))result.push(r);return result;}
test('pinned Wait body is exactly96 bytes with opaque base words; runtime and archived parser agree',async()=>{
  const s=source(save([attachment(banks([entry9()]))])),rows=await collect(s),entry=rows.find(r=>r.type==='entry');
  assert.deepEqual([entry.kind,entry.size,entry.leafVersion,entry.baseVersion,entry.embeddedVersion],[9,96,1,1,2]);
  assert.deepEqual(entry.words,[1,1,2,9,...Array(20).fill(0x11000038)]);assert.ok(Object.isFrozen(entry.words));
  assert.equal(Object.hasOwn(entry,'targetUnitId'),false);assert.deepEqual(rows.filter(r=>r.type==='bank').map(r=>r.count),[1,0,0]);
  assert.deepEqual(await collect(s,runtimeEntries),rows);
});
test('Wait can precede a known targeted command without hiding the following target',async()=>{
  const body=[2,1,2,2,...Array(40).fill(0)];body[25]=2142;
  const move=Buffer.concat([words([1,2]),words(body)]),rows=await collect(source(save([attachment(banks([entry9(),move]))])));
  const entries=rows.filter(r=>r.type==='entry');assert.deepEqual(entries.map(e=>[e.kind,e.size]),[[9,96],[2,176]]);assert.equal(entries[1].words[25],2142);
});
test('every Wait version/discriminator guard rejects changed words',async()=>{
  for(const word of [0,1,2,3,4,5]) {
    const e=entry9();e.writeUInt32LE(99,word*4);
    await assert.rejects(collect(source(save([attachment(banks([e]))]))));
  }
});
test('truncated Wait bodies, late unsupported leaves and trailing bytes refuse complete qualification',async()=>{
  await assert.rejects(collect(source(save([attachment(Buffer.concat([words([1,1]),entry9().subarray(0,100)]))]))),/Truncated/);
  await assert.rejects(collect(source(save([attachment(banks([entry9(),words([1,12])]))]))),e=>e.kind===12);
  await assert.rejects(collect(source(save([attachment(Buffer.concat([banks([entry9()]),words([0])]))]))),/Trailing/);
});
test('duplicate attachments and declared membership overflow fail closed',async()=>{
  const record=attachment(banks([entry9()]));await assert.rejects(collect(source(save([record,record]))),/Duplicate/);
  await assert.rejects(collect(source(save([attachment(words([1,1025]))]))),/budget/);
});
test('Wait body crossing page boundaries remains byte exact with bounded reads',async()=>{
  const plain=save([attachment(banks([entry9()]))]),first=(await collect(source(plain))).find(r=>r.type==='entry');
  const input=source(save([attachment(banks([entry9()]))],4095-first.offset)),entry=(await collect(input)).find(r=>r.type==='entry');
  assert.equal(entry.offset,4095);assert.deepEqual(entry.words,first.words);assert.ok(input.requests.every(([,n])=>n<=4096));
});
