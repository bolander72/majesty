import assert from 'node:assert/strict';
import {compareConnectedWorlds} from './connected-residency.mjs';
export function requestedResidencyCycles(log,visits,{initializeGeneratedRegions=false,startSide=1}={}){
  assert.ok(startSide===0||startSide===1,'Unsupported starting region');
  assert.ok(!initializeGeneratedRegions||startSide===1,'Generated initialization requires its original load order');
  assert.ok(visits.length>=3&&visits.length<=8);
  assert.equal(typeof initializeGeneratedRegions,'boolean');
  if(initializeGeneratedRegions)assert.ok(visits.length>=4,'Both initialized regions must be revisited');
  assert.ok(log.includes('all expectations met'),'Native script did not finish');
  assert.ok(!/result=fail|SIGSEGV|abort from|exception e06d7363|undeliverable call(?!s: none)|residency setup .*refused/i.test(log),'Failed native run');
  const matches=pattern=>[...log.matchAll(pattern)];
  const loads=matches(/^\[streaming\] World residency load=(\d+) extent=(\d+) registry-entries=(\d+) world=([0-9a-f]{8}) factory=([0-9a-f]{8}) terrain=([0-9a-f]{8}) grid=([0-9a-f]{8}) search=([0-9a-f]{8}) entries=([0-9a-f]{8}) heap=(\d+) blocks=(\d+) crt=(\d+) hooks=(\d+) result=pass$/gm);
  const originalLoads=matches(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=32 sample-bytes=2304$/gm);
  const requests=matches(/^\[streaming\] World residency request=(\d+) observed-ticks=(\d+) pending=4 result=pass$/gm);
  const exits=matches(/^\[streaming\] World residency exit=(\d+) extent=(\d+) phase=(\d+) pending=(\d+) world-null=(\d+) roots-freed=(\d+),(\d+),(\d+),(\d+),(\d+),(\d+) free-calls=(\d+) heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) crt-before=(\d+) crt-after=(\d+) heap-valid=(\d+) hooks-same=(\d+) result=pass$/gm);
  const snapshots=matches(/^\[streaming\] World persistence snapshot visit=(\d+) side=(\d+) stage=(before|after) clock=(\d+) saved=1 state-clock-same=1 hooks-same=1 latest-published=(\d+) copy-bound=4096 result=pass$/gm);
  const completed=matches(/^\[streaming\] World checkpoint completed visit=(\d+) clock=(\d+) tick=(\d+) entry-tick=(\d+) completed-ticks=(\d+) hook-depth=0 baton=1 result=pass$/gm);
  const initialized=matches(/^\[streaming\] World checkpoint initialized visit=(\d+) clock=(\d+) tick=(\d+) completed-ticks=0 original-tick-skipped=1 hook-depth=0 baton=1 result=pass$/gm);
  const boundaries=matches(/^\[streaming\] World checkpoint exit visit=(\d+) clock=(\d+) tick=(\d+) saved-clock=(\d+) saved-tick=(\d+) result=pass$/gm);
  const scriptSeeds=matches(/^\[streaming\] World persistence rng visit=(\d+) saved=(\d+) before=(\d+) after=(\d+) clock-same=1 hooks-same=1 original-setter=00623720 result=pass$/gm);
  const gameSeeds=matches(/^\[streaming\] World persistence gameplay-rng visit=(\d+) saved=(\d+) before=(\d+) after=(\d+) clock-same=1 hooks-same=1 original-setter=004f6710 result=pass$/gm);
  for(const rows of [loads,originalLoads,requests,exits,boundaries,scriptSeeds,gameSeeds])assert.equal(rows.length,visits.length,'Incomplete or duplicate native cycle');
  assert.equal(initialized.length,initializeGeneratedRegions?2:0,'Incomplete or unexpected initialization');
  assert.equal(completed.length,visits.length-initialized.length,'Incomplete or unexpected completed ticks');
  assert.equal(matches(/^\[streaming\] World checkpoint (?:initialized|completed) .*$/gm).length,visits.length,'Unrecognized checkpoint boundary');
  assert.equal(snapshots.length,visits.length*2);
  return visits.map(({before,after},i)=>{
    const initializing=initializeGeneratedRegions&&i<2,expectedTicks=initializing?0:(after.clock-before.clock)/50;
    assert.ok(Number.isInteger(expectedTicks)&&expectedTicks>0&&expectedTicks<=200);
    const load=loads[i],exit=exits[i],snapBefore=snapshots[i*2],snapAfter=snapshots[i*2+1];
    const done=initializing?initialized[i]:completed[i-(initializeGeneratedRegions?2:0)],boundary=boundaries[i];
    const roots=load.slice(4,10).map(value=>parseInt(value,16));
    assert.equal(new Set(roots).size,6);assert.ok(roots.every(value=>value>0));
    assert.deepEqual(load.slice(1,3).map(Number),[i,256]);assert.ok(Number(load[3])>0);
    assert.equal(Number(load[13]),Number(loads[0][13]));assert.equal(Number(originalLoads[i][1]),before.counts.units);
    assert.deepEqual(requests[i].slice(1).map(Number),[i,expectedTicks]);
    const values=exit.slice(1).map(Number);
    assert.deepEqual(values.slice(0,11),[i,256,4,1,1,1,1,1,1,1,1]);
    const [freeCalls,heapBefore,heapAfter,blocksBefore,blocksAfter,crtBefore,crtAfter,heapValid,hooksSame]=values.slice(11);
    assert.ok(freeCalls>=6&&heapBefore>heapAfter&&blocksBefore>blocksAfter&&crtBefore>crtAfter);assert.deepEqual([heapValid,hooksSame],[1,1]);
    assert.deepEqual([Number(snapBefore[1]),Number(snapBefore[2]),snapBefore[3],Number(snapBefore[4]),Number(snapBefore[5])],[i,(i+startSide)%2,'before',before.clock,0]);
    assert.deepEqual([Number(snapAfter[1]),Number(snapAfter[2]),snapAfter[3],Number(snapAfter[4]),Number(snapAfter[5])],[i,(i+startSide)%2,'after',after.clock,1]);
    assert.equal(after.clock-before.clock,expectedTicks*50);assert.equal(Number(done[1]),i);assert.equal(Number(done[2]),after.clock);
    if(initializing){
      compareConnectedWorlds(before,after);
      assert.equal(before.rawTerrainSha256,after.rawTerrainSha256,'Initialization writer changed terrain');
      assert.equal(Number(done[3]),0,'Initialization advanced the loaded tick');
      assert.equal(matches(new RegExp(`^\\[streaming\\] World residency first-tick load=${i} .*`,'gm')).length,0,'Initialization entered simulation');
    }else{
      assert.equal(Number(done[3]),Number(done[4])+1);assert.equal(Number(done[5]),expectedTicks);
    }
    assert.deepEqual(boundary.slice(1).map(Number),[i,after.clock,Number(done[3]),after.clock,Number(done[3])]);
    for(const [seed,wanted] of [[scriptSeeds[i],before.rng],[gameSeeds[i],before.gameplayRng]])assert.deepEqual([Number(seed[1]),Number(seed[2]),Number(seed[4])],[i,wanted,wanted]);
    const ordered=[originalLoads[i],load,scriptSeeds[i],gameSeeds[i],snapBefore,snapAfter,done,requests[i],boundary,exit];
    for(let j=1;j<ordered.length;++j)assert.ok(ordered[j-1].index<ordered[j].index,'Native save/disposal ordering differs');
    if(i)assert.ok(exits[i-1].index<originalLoads[i].index,'Next kingdom loaded before preceding disposal');
    return {visit:i,region:(i+startSide)%2?'1_0':'0_0',roots,freed:[1,1,1,1,1,1],completedTicks:expectedTicks,initializedWithoutSimulation:initializing,clockBefore:before.clock,clockAfter:after.clock,
      units:before.counts.units,postUnloadHeapBytes:heapAfter,postUnloadHeapBlocks:blocksAfter,postUnloadCrtAllocations:crtAfter};
  });
}
