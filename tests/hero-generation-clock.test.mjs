import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {heroGenerationInitializationClock,checkpointHeroGenerationInitialization} from '../web/world/arrival.mjs';
import {parseNativeHeroGenerationInitialized} from '../web/world/hero-generation-boundary.mjs';
import {checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {stoppedFileSource} from '../scripts/lib/stopped-entity-io.mjs';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';

const context=(age,clock=10000)=>({delay:300,stamp:(clock-age)>>>0,flags:2,flag:0});
test('initialization preserves timer ages and chooses the first safe original tick',()=>{
  assert.deepEqual(heroGenerationInitializationClock([],10000),{clock:100,ticks:2,contexts:0});
  assert.equal(heroGenerationInitializationClock([context(100)],10000).clock,150);
  const contexts=Array.from({length:64},(_,i)=>context((i+2)*50));
  assert.deepEqual(heroGenerationInitializationClock(contexts,10000),{clock:3300,ticks:66,contexts:64});
  const chosen=heroGenerationInitializationClock(contexts,10000).clock;
  for(const c of contexts){const after=(chosen-((10000-c.stamp)>>>0))>>>0;
    assert.notEqual(after,0);assert.equal((chosen-after)>>>0,(10000-c.stamp)>>>0);
    assert.equal(((chosen-after)>>>0)>=c.delay,((10000-c.stamp)>>>0)>=c.delay);}
});
test('inactive and paused timers do not exclude clocks or change their stamps',()=>{
  const contexts=[{...context(100),flags:0},{...context(100),flags:0x82},
    {...context(100),flags:0x80,stamp:0}];
  assert.equal(heroGenerationInitializationClock(contexts,10000).clock,100);
});
test('executing, zero, future, ambiguous and unknown active timer states still refuse',()=>{
  for(const c of [{...context(100),flag:1},{...context(100),stamp:0},
    {...context(100),stamp:10001},{...context(100),delay:0x80000000},
    {...context(100),stamp:(10000-0x80000000)>>>0},{...context(100),flags:4},
    {...context(100),stamp:-1},{...context(100),flags:2.5}])
    assert.throws(()=>heroGenerationInitializationClock([c],10000));
  assert.throws(()=>heroGenerationInitializationClock(Array(65).fill(context(100)),10000));
  for(const clock of [0,-1,0x100000000,NaN])assert.throws(()=>heroGenerationInitializationClock([],clock));
  assert.equal(heroGenerationInitializationClock([context(50,25)],25).clock,100);
});
const request={serial:3,sourceRegion:'1_-1',targetRegion:'0_-1'};
const line=(clock=150,ticks=3)=>`[frontier] Hero generation initialized serial=3 source=1_-1 target=0_-1 clock=${clock} slot=1 bytes=320566 sha256=${'a'.repeat(64)} layout=halo-v1 shared-vertices=2480 original-generator=1 original-writer=1 source-roots-cleared=1 phase=7 pending=0 original-ticks=${ticks} hero-imported=0 owner-published=0`;
test('initialized receipts require coherent bounded original ticks and exact request identity',()=>{
  assert.equal(parseNativeHeroGenerationInitialized(request,line()).clock,150);
  assert.equal(parseNativeHeroGenerationInitialized(request,line(3300,66)).ticks,66);
  for(const [clock,ticks]of [[0,0],[50,1],[150,2],[100,3],[3350,67],['0150',3],[150,'03'],[151,3]])
    assert.throws(()=>parseNativeHeroGenerationInitialized(request,line(clock,ticks)));
  for(const s of [line().replace('serial=3','serial=2'),line().replace('source=1_-1','source=1_0'),
    line().replace('phase=7','phase=3'),line()+' extra=1'])assert.throws(()=>parseNativeHeroGenerationInitialized(request,s));
});

test('actual third-crossing checkpoint excludes100ms without weakening the zero guard',
 {skip:!process.env.MAJESTY_HERO_GENERATION_CLOCK_FAILURE},async()=>{
  const manifest=resolve(process.env.MAJESTY_HERO_GENERATION_CLOCK_FAILURE),m=JSON.parse(await readFile(manifest,'utf8'));
  assert.equal(m.generatedNeighborJourneys,3);assert.equal(m.nativeSessionTerminal,true);
  assert.equal(m.nativeThreeGeneratedNeighborArrivalsQualified,false);
  const log=await readFile(m.log,'utf8');assert.equal(createHash('sha256').update(log).digest('hex'),m.logSha256);
  const crossing=/Hero crossing serial=3 region=1_-1 target=0_-1 previous-clock=(\d+) clock=(\d+) unit=(\d+) agent=(\d+)/.exec(log);
  assert.ok(crossing);const clock=Number(crossing[2]),unitId=Number(crossing[3]),agentId=Number(crossing[4]);
  const held=/Hero save held serial=3 region=1_-1 clock=(\d+) slot=([01]) bytes=(\d+) sha256=([a-f0-9]{64})/.exec(log);
  assert.ok(held);assert.equal(Number(held[1]),clock);
  const filename=join(m.fixture,'frontier_1_-1/Documents/My Games/MajestyHD/SaveGame',
    held[2]==='1'?'Frontier_1_-1_Recovery.GMP':'Frontier_1_-1.GMP');
  const before=await hashNativeFile(filename);assert.equal(before.bytes,Number(held[3]));assert.equal(before.sha256,held[4]);
  const source=await stoppedFileSource(filename),plan=await checkpointHeroGenerationInitialization(source,unitId,clock);
  assert.deepEqual(plan,{clock:150,ticks:3,contexts:12});
  const active=[];
  for await(const value of checkpointAgentValues(source,agentId))if(value.type===8){
    const bytes=await source.readAt(value.stateOffset,16),v=new DataView(bytes.buffer,bytes.byteOffset,16),
      delay=v.getUint32(0,true),stamp=v.getUint32(4,true),flags=v.getUint32(8,true);
    if((flags&0x7f)&&!(flags&0x80)){
      const elapsed=(clock-stamp)>>>0,after=(plan.clock-elapsed)>>>0;
      assert.notEqual(after,0);assert.equal((plan.clock-after)>>>0,elapsed);
      active.push({attribute:value.attribute,delay,stamp,flags,elapsed,after});
    }
  }
  assert.ok(active.some(c=>c.elapsed===100));assert.deepEqual(await hashNativeFile(filename),before);
  await assert.rejects(checkpointHeroGenerationInitialization(source,unitId,clock+50),/clock/);
  if(process.env.MAJESTY_HERO_GENERATION_CLOCK_REPORT)await writeFile(process.env.MAJESTY_HERO_GENERATION_CLOCK_REPORT,
    JSON.stringify({version:1,manifest,source:{filename,...before},sourceClock:clock,unitId,agentId,plan,active,
      originalCaptureUnchanged:true,zeroSentinelGuardPreserved:true,browserUsed:false,nativeProcessesStarted:0,
      nativeAdaptiveInitializationQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
});
