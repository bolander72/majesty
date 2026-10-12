import test from 'node:test';
import assert from 'node:assert/strict';
import {world,source,hash} from './fixtures/registered-hero-world.mjs';
import {haloTerrainCheckpoint} from './fixtures/halo-terrain-checkpoint.mjs';
import {boundNativeHeroCrossing,requireCheckpointHeroCrossing} from '../web/world/hero-travel-boundary.mjs';
const Q=2048;
function fixture(axis='x',negative=false,region='0_0',options={}){
  const previous={x:731*Q+13,y:621*Q+29,z:4567},accepted={...previous};
  previous[axis]=negative?64*Q+1:4032*Q-1;accepted[axis]=previous[axis]+(negative?-2:2);
  const [rx,ry]=region.split('_').map(Number),target=`${rx+(axis==='x'?(negative?-1:1):0)}_${ry+(axis==='y'?(negative?-1:1):0)}`;
  const crossing={serial:1,region,target,previousClock:6350,clock:6400,unitId:502,agentId:27,previous,accepted};
  const bytes=Buffer.concat([world(0,true,{savedClock:6400,position:accepted,...options}),haloTerrainCheckpoint(region)]);
  const binding=`majesty-hero-runtime-v1|${region}|3200|502|27|42|0|native|469|7|77|${hash(bytes)}`;
  return {crossing,bytes,binding,source:source(bytes)};
}
test('paused checkpoints verify fractional accepted poses in all four cardinal directions and signed regions',async()=>{
  for(const region of ['0_0','-99_100'])for(const axis of ['x','y'])for(const negative of [false,true]){
    const f=fixture(axis,negative,region),before=Buffer.from(f.bytes),proof=await requireCheckpointHeroCrossing(f.source,f.binding,f.crossing);
    assert.equal(proof.savedActorPositionVerified,true);assert.equal(proof.checkpointClock,6400);
    assert.equal(proof.layout.sharedVertices,2480);assert.equal(proof.handoff.destinationRegion,f.crossing.target);
    assert.equal(proof.handoff.globalFixed[axis]-proof.handoff.previousGlobalFixed[axis],negative?-2:2);
    assert.equal(proof.handoff.destinationPose.z,f.crossing.accepted.z);assert.equal(proof.handoff.collisionQualified,false);
    assert.ok(Object.isFrozen(proof.crossing.accepted));assert.ok(Object.isFrozen(proof.handoff.destinationPose));
    assert.ok(JSON.stringify(proof).length<2048);assert.deepEqual(f.bytes,before);
  }
});
test('malformed, stale and interior crossing requests refuse before reading a checkpoint',async()=>{
  const f=fixture(),reader={size:f.bytes.length,async readAt(){assert.fail('invalid request read saved data');}};
  for(const change of [{serial:0},{serial:1.5},{unitId:999},{agentId:99},{clock:6350},{previousClock:3199},
    {target:'0_1'},{previous:{...f.crossing.accepted}},{accepted:{...f.crossing.accepted,z:0.1}},
    {accepted:{...f.crossing.accepted,y:4032*Q+1}},{extra:new Uint8Array(10000)}]){
    await assert.rejects(requireCheckpointHeroCrossing(reader,f.binding,{...f.crossing,...change}));
  }
  const copied=boundNativeHeroCrossing(f.binding,f.crossing);f.crossing.accepted.x=0;
  assert.equal(copied.accepted.x,4032*Q+1);
});
test('different saved positions, actor associations and original clock refuse without changing any bytes',async()=>{
  const expected=fixture();
  for(const options of [{position:{...expected.crossing.accepted,x:expected.crossing.accepted.x+1}},
    {position:{...expected.crossing.accepted,z:expected.crossing.accepted.z+1}},
    {gid:28},{uid:503},{parent:469},{heroState:516},{savedClock:6450}]){
    const f=fixture('x',false,'0_0',options),before=Buffer.from(f.bytes);
    await assert.rejects(requireCheckpointHeroCrossing(f.source,expected.binding,expected.crossing));
    assert.deepEqual(f.bytes,before);
  }
});
test('cancelling a pending crossing read drains that read and starts no subsequent metadata or terrain I/O',async()=>{
  const f=fixture(),controller=new AbortController();let release,entered,reads=0;
  const pending=new Promise(r=>release=r),started=new Promise(r=>entered=r);
  const reader={size:f.bytes.length,async readAt(at,n){++reads;entered();await pending;return f.source.readAt(at,n);}};
  const job=requireCheckpointHeroCrossing(reader,f.binding,f.crossing,{signal:controller.signal});
  let settled=false;const refused=assert.rejects(job,/closed/).then(()=>settled=true);
  await started;controller.abort(Error('closed'));await new Promise(r=>setImmediate(r));
  assert.equal(settled,false);release();await refused;assert.equal(reads,1);
  await assert.rejects(requireCheckpointHeroCrossing(reader,f.binding,f.crossing,{signal:controller.signal}),/closed/);
  assert.equal(reads,1);
});
