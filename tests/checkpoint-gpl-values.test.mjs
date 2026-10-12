import test from 'node:test';
import assert from 'node:assert/strict';
import {checkpointAgentValues, checkpointAgentReferencePlan, checkpointFile,
  checkpointIncomingAgentReferences, checkpointAbsentAgentReferences,
  checkpointAgentRecord, checkpointAgentRecordValues, checkpointAgents,
  MAX_GPL_VALUE_DEPTH, MAX_GPL_VALUE_RECORDS, MAX_GPL_REFERENCE_SITES,
  MAX_GPL_STRING_BYTES} from '../web/world/checkpoint.mjs';

const w = n => {const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b;};
const str = s => Buffer.from(s + '\0');
const env = (v,b) => Buffer.concat([w(b.length+16),w(v),b,w(0),w(-1)]);
const chunk = (tag,b,v=0) => Buffer.concat([Buffer.from(tag),w(b.length),w(v),w(0),b]);
const value = (type,...payload) => Buffer.concat([w(type),...payload]);
const list = children => value(4,env(0,Buffer.concat([w(children.length),...children])));
const fn = (children, names = ['BirthScript', null], flags = [1,1,0]) => value(8,
  w(children.length),...children, Buffer.alloc(16,0x17), Buffer.from([flags[0],flags[1]]),
  ...(names[0] === null ? [] : [str(names[0])]), Buffer.from([flags[2]]),
  ...(names[1] === null ? [] : [str(names[1])]));
function save(attributes, {count=attributes.length, tail, deleted=0} = {}) {
  const attr = env(0,Buffer.concat([w(count),...attributes.flatMap(([name,v])=>[str(name),v])]));
  const agent = env(2,Buffer.concat([attr,w(0),w(9),str(''),w(506),Buffer.from([deleted]),w(0),Buffer.from([0,0])]));
  const manager = env(2,Buffer.concat([w(0),w(1),w(9),agent,tail ?? Buffer.concat([w(0),w(0),Buffer.from([0])])]));
  return Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('GPL ',env(3,Buffer.concat([w(0),manager,w(10)])),1)]);
}
function input(data) {
  let peak=0,inFlight=0,readBytes=0;
  return {size:data.length,get peak(){return peak;},get readBytes(){return readBytes;},
    async readAt(at,len){assert(len<=4096);peak=Math.max(peak,++inFlight);readBytes+=len;
      await Promise.resolve();--inFlight;return data.subarray(at,at+len);}};
}
const collect = async data => Array.fromAsync(checkpointAgentValues(input(data),9));

test('standalone original writer records share complete layout and typed traversal with saves',async()=>{
  const data=save([['home',value(5,w(7))],['taskname',value(3,str('go_home'))],['activescript',fn([],['use_building',null])]]);
  const [agent]=await Array.fromAsync(checkpointAgents(input(data)));
  const raw=data.subarray(agent.offset,agent.offset+agent.size),source=input(raw);
  const record=await checkpointAgentRecord(source);
  assert.deepEqual([record.agentId,record.unitId,record.deleted,record.attributes.declaredCount],[9,506,false,3]);
  const whole=await collect(data),standalone=await Array.fromAsync(checkpointAgentRecordValues(source));
  assert.deepEqual(standalone.map(v=>({attribute:v.attribute,type:v.type,path:v.path,target:v.targetAgentId,functions:v.functions?.map(f=>f.name)})),
    whole.map(v=>({attribute:v.attribute,type:v.type,path:v.path,target:v.targetAgentId,functions:v.functions?.map(f=>f.name)})));
  for(const v of standalone)assert.equal(raw.readUInt32LE(v.typeOffset),v.type);
  assert.equal(source.peak,1);
  for(const bad of [raw.subarray(0,-1),Buffer.concat([raw,w(1)]),Buffer.concat([w(raw.length),w(99),raw.subarray(8)])])
    await assert.rejects(checkpointAgentRecord(input(bad)));
  await assert.rejects(checkpointAgentRecord({size:65537,readAt(){throw Error('must not read');}}),/bound/);
});

test('all nine pinned GPL types preserve primitive bits and typed nested reference locations', async()=>{
  const data=save([['none',value(0)],['integer',value(1,w(-9))],['float',value(2,w(0x7fc00123))],
    ['text',value(3,str('reference 9'))],['list',list([value(5,w(9)),list([value(5,w(12))])])],
    ['invalid',value(5,w(-1))],['bool',value(6,Buffer.from([1]))],['pair',value(7,w(9),w(12))],
    ['function',fn([value(5,w(14)),value(1,w(9))])]]);
  const source=input(data), records=await Array.fromAsync(checkpointAgentValues(source,9));
  assert.equal(source.peak,1);
  assert.deepEqual([...new Set(records.map(r=>r.type))].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7,8]);
  assert.deepEqual(records.filter(r=>r.type===5).map(r=>[r.attribute,r.path,r.targetAgentId]),
    [['list',[0],9],['list',[1,0],12],['invalid',[],null],['function',[0],14]]);
  assert.equal(records.find(r=>r.type===2).bits,0x7fc00123);
  assert.equal(records.find(r=>r.attribute==='integer').value,-9);
  assert.deepEqual(records.find(r=>r.type===7).words,[9,12]);
  assert.equal(records.find(r=>r.type===8).functions[0].name,'BirthScript');
  for(const r of records) assert.equal(data.readUInt32LE(r.typeOffset),r.type);
  assert.deepEqual(await Array.fromAsync(checkpointAgentValues(checkpointFile(new Blob([data])),9)),records);
});

test('reference plan edits only typed positive agent values and preserves source bytes',async()=>{
  const data=save([['number',value(1,w(9))],['string',value(3,str('9'))],['pair',value(7,w(9),w(9))],
    ['list',list([value(5,w(9)),value(5,w(0)),value(5,w(-6))])],['args',fn([value(5,w(9))])]]);
  let calls=0;
  const before=Buffer.from(data), plan=await checkpointAgentReferencePlan(input(data),9,id=>{++calls;return id+100;});
  assert.equal(calls,1);
  assert.equal(plan.length,2);const copy=Buffer.from(data);
  for(const p of plan){assert.equal(p.before,copy.readUInt32LE(p.offset));copy.writeUInt32LE(p.after,p.offset);}
  assert.deepEqual(data,before);
  const records=await collect(copy);
  assert.deepEqual(records.filter(r=>r.type===5).map(r=>r.bits),[109,0,0xfffffffa,109]);
  assert.deepEqual(records.find(r=>r.type===7).words,[9,9]);
  assert.equal(records.find(r=>r.type===1).value,9);
});

test('nested value metadata crosses pages with bounded serial reads and stable yielded records',async()=>{
  const data=save([['padding',value(3,str('x'.repeat(4090)))],['nested',list([fn([list([value(5,w(23))])])])]]);
  const source=input(data), records=await Array.fromAsync(checkpointAgentValues(source,9));
  assert.equal(source.peak,1);assert.deepEqual(records.find(r=>r.type===5).path,[0,0,0]);
  assert.equal(records.find(r=>r.type===3).stringBytes,4090);
  assert(source.readBytes<data.length*4);
});

test('empty lists/function arguments, absent symbolic functions and sentinel references are valid',async()=>{
  const records=await collect(save([['empty',list([])],['context',fn([], [null,'Resume'],[0,0,1])],
    ['none',value(5,w(0))],['invalid',value(5,w(-1))]]));
  assert.equal(records[0].childCount,0);assert.equal(records[1].functions[0].slot,1);
  assert.equal(records[1].functions[0].name,'Resume');assert.equal(records[1].flag,0);
  assert.deepEqual(records.slice(2).map(r=>r.targetAgentId),[null,null]);
});

test('unterminated strings, malformed type/list/context/counts and booleans fail closed',async()=>{
  const badList=value(4,env(0,Buffer.concat([w(1),value(1,w(9)),w(100)])));
  for(const data of [save([['bad',value(9)]]),save([['bad',value(1)]]),save([['bad',value(6,Buffer.from([2]))]]),
    save([['bad',badList]]),save([['bad',value(4,env(1,w(0)))]]),save([['bad',value(4,env(0,w(MAX_GPL_VALUE_RECORDS)))]]),
    save([['bad',value(3,Buffer.alloc(32,97))]]),save([['bad',fn([],[null,null],[2,0,0])]]),
    save([['bad',fn([],[null,null],[0,2,0])]]),save([['bad',fn([],[null,null],[0,0,2])]]),
    save([['valid',value(1,w(7))]],{count:0}),save([],{count:1}),
    save([['valid',value(1,w(7))]],{deleted:1})]) await assert.rejects(collect(data));
});

test('late attribute and manager failures cannot publish a reference plan',async()=>{
  const bad=save([['first',value(5,w(9))],['last',value(99)]]);
  let calls=0;
  await assert.rejects(checkpointAgentReferencePlan(input(bad),9,id=>{++calls;return id+1;}),/type/);
  assert.equal(calls,0);
  const iterator=checkpointAgentValues(input(bad),9);assert.equal((await iterator.next()).value.bits,9);
  await assert.rejects(iterator.next());
  const manager=save([['first',value(5,w(9))]],{tail:Buffer.concat([w(0),w(0),Buffer.from([2])])});
  await assert.rejects(checkpointAgentValues(input(manager),9).next(),/manager/);
  await assert.rejects(checkpointAgentReferencePlan(input(manager),9,id=>id+1));
});

test('nesting and reference-plan limits reject oversized state before publication',async()=>{
  let deep=value(5,w(9));for(let i=0;i<MAX_GPL_VALUE_DEPTH+1;++i)deep=list([deep]);
  await assert.rejects(collect(save([['deep',deep]])),/depth/);
  let valid=value(5,w(9));for(let i=0;i<MAX_GPL_VALUE_DEPTH;++i)valid=list([valid]);
  assert.equal((await collect(save([['valid',valid]]))).filter(r=>r.type===5).length,1);
  const tooMany=save([['list',list(Array.from({length:MAX_GPL_REFERENCE_SITES+1},()=>value(5,w(9))))]]);
  await assert.rejects(checkpointAgentReferencePlan(input(tooMany),9,id=>id+1),/sites/);
});

test('string payloads stream up to the declared byte bound without retaining text',async()=>{
  const data=save([['large',value(3,str('x'.repeat(MAX_GPL_STRING_BYTES-1)))]]), source=input(data);
  const records=await Array.fromAsync(checkpointAgentValues(source,9));
  assert.equal(records.length,1);assert.equal(records[0].stringBytes,MAX_GPL_STRING_BYTES-1);
  assert(!('value' in records[0]));assert.equal(source.peak,1);
  await assert.rejects(collect(save([['large',value(3,str('x'.repeat(MAX_GPL_STRING_BYTES)))]])),/bound/);
});

test('reference resolver rejects missing, invalid or failed destination bindings',async()=>{
  const data=save([['ref',value(5,w(9))]]);
  for(const resolver of [undefined,()=>0,()=>-1,()=>0x80000000,()=>1.5,()=> '99',()=>{throw new Error('no binding');}])
    await assert.rejects(checkpointAgentReferencePlan(input(data),9,resolver));
  for(const id of [0,-1,0x80000000,1.5,'9',10])await assert.rejects(Array.fromAsync(checkpointAgentValues(input(data),id)));
});

test('incoming traversal distinguishes top-level lists, nested lists and function arguments from integer lookalikes', async () => {
  const source = input(save([['members', list([value(5, w(9))])],
    ['nested', list([list([value(5, w(9))])])], ['context', fn([value(5, w(9))])],
    ['number', value(1, w(9))], ['sentinel', value(5, w(-1))]]));
  const result = await checkpointIncomingAgentReferences(source, 9);
  assert.deepEqual(result.sites.map(s => [s.attribute, s.path, s.rootType, s.rootChildCount]),
    [['members', [0], 4, 1], ['nested', [0, 0], 4, 1], ['context', [0], 8, undefined]]);
  assert.ok(result.sites.every(s => s.agentId === 9 && s.unitId === 506 && !s.deleted));
  assert.equal(source.peak, 1);
});

test('incoming traversal cannot return earlier references after late typed or manager corruption', async () => {
  await assert.rejects(checkpointIncomingAgentReferences(input(save([
    ['first', value(5, w(9))], ['last', value(99)]])), 9), /type/);
  await assert.rejects(checkpointIncomingAgentReferences(input(save([['members', list([value(5, w(9))])]],
    {tail: Buffer.concat([w(0), w(0), Buffer.from([2])])})), 9), /manager/);
  await assert.rejects(checkpointIncomingAgentReferences(input(save([], {deleted: 1})), 9), /deleted/);
  await assert.rejects(checkpointIncomingAgentReferences(input(save([])), 10), /Missing/);
  await assert.rejects(checkpointIncomingAgentReferences(input(save([['members', list(
    Array.from({length: MAX_GPL_REFERENCE_SITES + 1}, () => value(5, w(9))))]])), 9), /Too many/);
});

test('absent-target traversal finds dangling typed references and leaves live migration checks strict',async()=>{
  const data=save([['members',list([value(5,w(10)),value(1,w(10))])],['context',fn([value(5,w(10))])],
    ['sentinel',value(5,w(-1))]]),source=input(data);
  const r=await checkpointAbsentAgentReferences(source,10);
  assert.deepEqual(r.sites.map(s=>[s.agentId,s.attribute,s.path,s.rootType]),[[9,'members',[0],4],[9,'context',[0],8]]);
  assert.equal(source.peak,1);await assert.rejects(checkpointIncomingAgentReferences(input(data),10),/Missing/);
  for(const deleted of [0,1])await assert.rejects(checkpointAbsentAgentReferences(input(save([],{deleted})),9),/Expected absent/);
});
test('absent-target traversal refuses late corruption, bad IDs and excessive reference sites',async()=>{
  for(const id of [0,-1,0x80000000,1.5])await assert.rejects(checkpointAbsentAgentReferences(input(save([])),id),/Invalid/);
  await assert.rejects(checkpointAbsentAgentReferences(input(save([['first',value(5,w(10))],['last',value(99)]])),10),/type/);
  await assert.rejects(checkpointAbsentAgentReferences(input(save([],{tail:Buffer.concat([w(0),w(0),Buffer.from([2])])})),10),/manager/);
  await assert.rejects(checkpointAbsentAgentReferences(input(save([['many',list(Array.from({length:MAX_GPL_REFERENCE_SITES+1},()=>value(5,w(10))))]])),10),/Too many/);
});

test('many agents are traversed once with serial bounded reads and only selected references retained', async () => {
  const count = 500, records = [];
  for (let id = 1; id <= count; ++id) {
    const attrs = env(0, Buffer.concat([w(1), str('target'), value(id === 1 ? 5 : 1, w(9))]));
    records.push(Buffer.concat([w(id), env(2, Buffer.concat([attrs, w(0), w(id), str(''),
      w(500 + id), Buffer.from([0]), w(0), Buffer.from([0, 0])]))]));
  }
  const manager = env(2, Buffer.concat([w(0), w(count), ...records, w(0), w(0), Buffer.from([0])]));
  const data = Buffer.concat([chunk('VERS', Buffer.alloc(256), 1),
    chunk('MTER', Buffer.alloc(1024 * 1024)), chunk('GPL ', env(3, Buffer.concat([w(0), manager, w(10)])), 1)]);
  const source = input(data), result = await checkpointIncomingAgentReferences(source, 9);
  assert.equal(result.sites.length, 1); assert.equal(result.sites[0].agentId, 1);
  assert.equal(result.valuesScanned, count); assert.equal(source.peak, 1);
  assert.ok(source.readBytes < 4 * manager.length, 'Manager was repeatedly scanned or dormant terrain was read');
  const absentSource=input(data),absent=await checkpointAbsentAgentReferences(absentSource,count+1);
  assert.equal(absent.sites.length,0);assert.equal(absent.valuesScanned,count);assert.equal(absentSource.peak,1);
  assert.ok(absentSource.readBytes<4*manager.length,'Absence check rescanned agents or dormant terrain');
});
