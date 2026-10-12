import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {connectedWorldState,compareConnectedWorlds,connectedResidencyCycles} from '../scripts/lib/connected-residency.mjs';

function chunk(tag,version,count,...parts){
  const bytes=Buffer.concat(parts),header=Buffer.alloc(16);
  header.write(tag);header.writeUInt32LE(bytes.length,4);header.writeUInt32LE(version,8);header.writeUInt32LE(count,12);
  return Buffer.concat([header,bytes]);
}
function words(...values){const bytes=Buffer.alloc(values.length*4);values.forEach((value,i)=>bytes.writeUInt32LE(value>>>0,i*4));return bytes;}
function fixture({label='(Random (Beginner)) 0 Days',shade=12,height=0,opaque=0,cell=0,clock=9000,seed=7,gameSeed=71201,day=4,global=1,dormantId=0}={}){
  const map=Buffer.alloc(40);map.writeUInt32LE(128);map.writeUInt32LE(128,4);
  const vertices=Buffer.alloc(129*129*9),cells=Buffer.alloc(128*128*5);
  vertices.writeFloatLE(height,0);vertices[4]=shade;vertices.writeUInt32LE(opaque>>>0,5);cells[0]=cell;
  const metadata=Buffer.concat([Buffer.from(label+'\0Random (Beginner)\0','ascii'),Buffer.alloc(48)]);
  const tail=metadata.indexOf(0,metadata.indexOf(0)+1)+1;
  metadata.writeUInt32LE(clock,tail);[2026,10,0,day,12,0,0,0].forEach((value,i)=>metadata.writeUInt16LE(value,tail+4+i*2));
  metadata.writeUInt32LE(gameSeed,tail+28);
  const envelope=(v,b)=>Buffer.concat([words(b.length+16,v),b,words(0,0xffffffff)]);
  const agent=dormantId?Buffer.concat([words(dormantId),envelope(2,Buffer.concat([
    envelope(0,words(0)),words(0,dormantId),Buffer.from('proxy\0'),words(0),Buffer.from([0]),words(0),Buffer.from([0,0])]))]):Buffer.alloc(0);
  const manager=envelope(2,Buffer.concat([words(0,dormantId?1:0),agent,words(0,0),Buffer.from([0])]));
  const runtime=envelope(3,Buffer.concat([words(seed),manager,words(0)]));
  return Buffer.concat([chunk('VERS',1,0,Buffer.alloc(256)),chunk('SVGD',10,0,metadata),
    chunk('MAP ',0,1,chunk('PRIM',2,0,map)),
    chunk('MTER',0,2,chunk('MVTX',0,1,chunk('PRIM',2,16641,vertices)),chunk('MCEL',0,1,chunk('PRIM',5,16384,cells))),
    ...['BLDG','VHCL','GRND','RWRD','MSGF','OFMP'].map(tag=>chunk(tag,0,0)),
    chunk('ORDR',1,0),chunk('CONT',1,0),
    chunk('GPL ',1,0,runtime),chunk('GSGL',6,0,words(global))]);
}
async function pair(t,first={},second={}){
  const directory=await mkdtemp(join(tmpdir(),'majesty-connected-state-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const a=join(directory,'before.GMP'),b=join(directory,'after.GMP');
  await writeFile(a,fixture(first));await writeFile(b,fixture(second));
  return [await connectedWorldState(a),await connectedWorldState(b)];
}
test('generated-state comparison accepts only cached shading and validated save label/calendar changes',async t=>{
  const[a,b]=await pair(t,{}, {shade:211,label:'Joint_Departed_Reload',day:5});
  assert.deepEqual(compareConnectedWorlds(a,b),{orderContainerPermutations:[],cachedTerrainShadingRebuilt:true});
});
test('a height, opaque vertex bit or cell change remains a primary-state failure',async t=>{
  for(const mutation of [{height:0.5},{opaque:0x80000001},{cell:1}]){
    const[a,b]=await pair(t,{},mutation);assert.throws(()=>compareConnectedWorlds(a,b),/Saved world sections differ/);
  }
});
test('clock and both random generators remain exact replay requirements',async t=>{
  for(const[mutation,message]of [[{clock:9001},/game clock/],[{seed:8},/scripting RNG/],[{gameSeed:71202},/gameplay RNG/]]){
    const[a,b]=await pair(t,{},mutation);assert.throws(()=>compareConnectedWorlds(a,b),message);
  }
});
test('global state is retained even when the terrain and entities are unchanged',async t=>{
  const[a,b]=await pair(t,{}, {global:2});assert.throws(()=>compareConnectedWorlds(a,b),/Saved world sections differ/);
});
test('entity records, schedules and queue selection cannot disappear from a revisit',async t=>{
  const[a,b]=await pair(t);a.records.units[529]={bytes:257,sha256:'before'};b.records.units[529]={bytes:257,sha256:'after'};
  assert.throws(()=>compareConnectedWorlds(a,b),/Saved entities differ/);
  b.records.units[529]={...a.records.units[529]};b.queues[0].push(1);
  assert.throws(()=>compareConnectedWorlds(a,b),/Saved queues differ/);
  b.queues[0].pop();b.activeQueue=1;
  assert.throws(()=>compareConnectedWorlds(a,b));
});
test('invalid timestamp and unsupported zero RNG state reject before comparison',async t=>{
  for(const mutation of [{day:0},{seed:0},{gameSeed:0}])await assert.rejects(pair(t,{},mutation));
});
test('a declared dormant proxy is preserved without accepting omitted or imaginary schedules',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'majesty-dormant-state-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const filename=join(dir,'proxy.GMP');await writeFile(filename,fixture({dormantId:45}));
  await assert.rejects(connectedWorldState(filename),/Incomplete receiving queues/);
  const state=await connectedWorldState(filename,{unscheduledAgents:[45]});
  assert.equal(state.counts.agents,1);assert.ok(state.records.agents[45]);assert.deepEqual(state.queues,[[],[]]);
  for(const ids of [[46],[45,45],[0],Array.from({length:33},(_,i)=>i+1)])await assert.rejects(connectedWorldState(filename,{unscheduledAgents:ids}));
  await writeFile(filename,fixture());await assert.rejects(connectedWorldState(filename,{unscheduledAgents:[45]}),/Incomplete receiving queues/);
});
function cyclesFixture(startSide){
  const visits=[],lines=[];
  for(let i=0;i<3;i++){
    const side=(i+startSide)%2,clock=1000+i*1000;
    visits.push({before:{clock,rng:7,gameplayRng:9,counts:{units:1}},after:{clock:clock+1000}});
    lines.push(
      '[streaming] Original load end result=00000000 visits=1 retained=32 sample-bytes=2304',
      `[streaming] World residency load=${i} extent=256 registry-entries=1 world=00000010 factory=00000020 terrain=00000030 grid=00000040 search=00000050 entries=00000060 heap=10000 blocks=10 crt=10 hooks=3 result=pass`,
      `[streaming] World persistence rng visit=${i} saved=7 before=11 after=7 clock-same=1 hooks-same=1 original-setter=00623720 result=pass`,
      `[streaming] World persistence gameplay-rng visit=${i} saved=9 before=11 after=9 clock-same=1 hooks-same=1 original-setter=004f6710 result=pass`,
      `[streaming] World persistence snapshot visit=${i} side=${side} stage=before clock=${clock} saved=1 state-clock-same=1 hooks-same=1 latest-published=0 copy-bound=4096 result=pass`,
      `[streaming] World persistence snapshot visit=${i} side=${side} stage=after clock=${clock+1000} saved=1 state-clock-same=1 hooks-same=1 latest-published=1 copy-bound=4096 result=pass`,
      `[streaming] World checkpoint completed visit=${i} clock=${clock+1000} tick=20 entry-tick=19 completed-ticks=20 hook-depth=0 baton=1 result=pass`,
      `[streaming] World residency request=${i} observed-ticks=20 pending=4 result=pass`,
      `[streaming] World checkpoint exit visit=${i} clock=${clock+1000} tick=20 saved-clock=${clock+1000} saved-tick=20 result=pass`,
      `[streaming] World residency exit=${i} extent=256 phase=4 pending=1 world-null=1 roots-freed=1,1,1,1,1,1 free-calls=7 heap-before=10000 heap-after=9000 blocks-before=10 blocks-after=9 crt-before=10 crt-after=9 heap-valid=1 hooks-same=1 result=pass`);
  }
  return {visits,log:lines.join('\n')+'\nall expectations met\n'};
}
test('home-first committed travel preserves disposal and snapshot ordering requirements',()=>{
  for(const startSide of [0,1]){
    const {visits,log}=cyclesFixture(startSide);
    assert.deepEqual(connectedResidencyCycles(log,visits,{startSide}).map(c=>c.region),startSide?['1_0','0_0','1_0']:['0_0','1_0','0_0']);
    assert.throws(()=>connectedResidencyCycles(log,visits,{startSide:1-startSide}));
    assert.throws(()=>connectedResidencyCycles(log.replace('roots-freed=1,1,1,1,1,1','roots-freed=1,1,1,1,1,0'),visits,{startSide}));
  }
  const {visits,log}=cyclesFixture(0);
  assert.throws(()=>connectedResidencyCycles(log,visits,{startSide:2}),/Unsupported starting region/);
  assert.throws(()=>connectedResidencyCycles(log,visits,{startSide:0,initializeGeneratedRegions:true}),/original load order/);
});
