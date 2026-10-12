import test from 'node:test';
import assert from 'node:assert/strict';
import {idleTileCandidateGates,idleTileReleaseCycles} from '../scripts/lib/idle-tile-release.mjs';
function fixture(){
 const lines=[];
 for(let i=0;i<4;i++)lines.push(`[streaming] World residency exit=${i} extent=256`,
  `[streaming] Idle TILE candidate visit=${i} event=${i+1} descriptor=00000020 type=20424944 entries=100 array=00000040 result=observed`,
  `[streaming] Idle TILE gates visit=${i} tracked=2 owners=1 backlinks=1 zero=1 descriptors=1 typed=0 arrays=0 resolved=0 result=pass`,
  `[streaming] Idle TILE sweep visit=${i} eligible=0 freed=0 retained=0 heap-before=20000 heap-after=20000 clock-same=1 world-same=1 hooks-same=1 stage=idle world-null=1 hook-depth=0 result=pass`,
  ...(i<3?[`[streaming] World residency load=${i+1} extent=256`]:[]));
 return lines.join('\n')+'\nall expectations met\n';
}
const read=log=>idleTileCandidateGates(log,idleTileReleaseCycles(log,4,{afterExit:true}));
test('nonmatching actual resource tags explain a no-op without qualifying release',()=>{
 const gates=read(fixture());assert.equal(gates.length,4);
 for(const g of gates){assert.equal(g.zero,1);assert.equal(g.typed,0);assert.equal(g.resolved,0);assert.equal(g.descriptorSamples[0].type,0x20424944);}
});
test('empty observed candidate sets are admitted without inventing missing evidence',()=>{
 const log=fixture().split('\n').filter(l=>!l.startsWith('[streaming] Idle TILE candidate ')).join('\n')
  .replaceAll('tracked=2 owners=1 backlinks=1 zero=1 descriptors=1','tracked=0 owners=0 backlinks=0 zero=0 descriptors=0');
 assert.ok(read(log).every(g=>g.tracked===0&&g.descriptorSamples.length===0));
 assert.throws(()=>read(log.split('\n').filter(l=>!l.startsWith('[streaming] Idle TILE gates ')).join('\n')));
});
test('contradictory gate admission, sample coverage and counter bounds refuse',()=>{
 const log=fixture();
 for(const bad of [log.replace('tracked=2','tracked=513'),log.replace('owners=1','owners=3'),
  log.replace('resolved=0','resolved=1'),log.replace('type=20424944','type=454c4954'),
  log.replace('typed=0','typed=1'),log.replace('descriptors=1','descriptors=0'),
  log.replace('descriptor=00000020','descriptor=00000021'),log.replace('event=1','event=1025'),
  log.replace('result=observed','result=pass'),log.replace('entries=100','entries=4294967296')]){
  assert.notEqual(bad,log);assert.throws(()=>read(bad));
 }
});
test('duplicate or missing rows and evidence preceding original disposal refuse',()=>{
 const log=fixture(),lines=log.split('\n'),candidate=lines[1],gate=lines[2];
 for(const bad of [log.replace(candidate+'\n',''),log.replace(candidate,candidate+'\n'+candidate),
  log.replace(gate,gate+'\n'+gate),candidate+'\n'+log.replace(candidate+'\n',''),
  gate+'\n'+log.replace(gate+'\n','')])assert.throws(()=>read(bad));
});
