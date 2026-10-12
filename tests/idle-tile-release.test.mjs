import test from 'node:test';
import assert from 'node:assert/strict';
import {idleTileReleaseCycles} from '../scripts/lib/idle-tile-release.mjs';
const release=(visit,event,freed)=>`[streaming] Idle TILE release visit=${visit} event=${event} key=4 descriptor=00000010 entry=00000020 owner=00000030 buffer=00000040 references=0 original=004f73a0 freed=${freed} retained=${1-freed} result=pass`;
function fixture(){const lines=[];for(let i=0;i<4;i++)lines.push(
 `[streaming] World persistence snapshot visit=${i} side=${i%2} stage=after clock=1000 saved=1`,
 release(i,i?2+i:1,i?1:0),
 `[streaming] Idle TILE sweep visit=${i} eligible=1 freed=${i?1:0} retained=${i?0:1} heap-before=20000 heap-after=${i?7000:20000} clock-same=1 world-same=1 hooks-same=1 result=pass`,
 `[streaming] World checkpoint completed visit=${i} clock=1000`);
 return lines.join('\n')+'\n';}
test('original policy retention is counted without a false reclaim claim',()=>{
 const r=idleTileReleaseCycles(fixture());assert.deepEqual(r.map(r=>[r.freed,r.retained,r.heapReclaimedBytes]),[[0,1,0],[1,0,13000],[1,0,13000],[1,0,13000]]);
});
test('repeated denied candidate is allowed until its actual original free',()=>{
 const log=fixture().replace(release(1,3,1),release(1,1,1));assert.equal(idleTileReleaseCycles(log)[1].freed,1);
 assert.throws(()=>idleTileReleaseCycles(log.replace(release(2,4,1),release(2,1,1))));
});
test('missing, duplicate, unsafe or contradictory release evidence refuses',()=>{
 const log=fixture(),r=release(1,3,1);
 for(const bad of [log.replace(r+'\n',''),log.replace(r,r+'\n'+r),log.replace(r,r.replace('references=0','references=1')),
  log.replace(r,r.replace('retained=0','retained=1')),log.replace(r,r.replace('original=004f73a0','original=0064d4b6')),
  log.replace('clock-same=1','clock-same=0'),log.replace('world-same=1','world-same=0'),
  log.replace('eligible=1','eligible=2'),log.replace('descriptor=00000010','descriptor=00000011'),
  log.replace('heap-after=20000','heap-after=0'),log.replace('result=pass','result=fail')]){
  assert.notEqual(bad,log);assert.throws(()=>idleTileReleaseCycles(bad));
 }
});
test('release must follow publication and precede the completed checkpoint boundary',()=>{
 const log=fixture(),r=release(1,3,1);const removed=log.replace(r+'\n','');
 const save='[streaming] World persistence snapshot visit=1';
 assert.throws(()=>idleTileReleaseCycles(removed.replace(save,r+'\n'+save)));
 assert.throws(()=>idleTileReleaseCycles(removed+r+'\n'));
 assert.throws(()=>idleTileReleaseCycles(log,3));
 assert.throws(()=>idleTileReleaseCycles('x'.repeat(1024*1024+1)));
});
test('idle release requires original teardown, no world and no active callback',()=>{
 const lines=[];
 for(let i=0;i<4;i++)lines.push(`[streaming] World residency load=${i} extent=256`,
  `[streaming] World residency exit=${i} extent=256`,release(i,i+1,1),
  `[streaming] Idle TILE sweep visit=${i} eligible=1 freed=1 retained=0 heap-before=20000 heap-after=7000 clock-same=1 world-same=1 hooks-same=1 stage=idle world-null=1 hook-depth=0 result=pass`);
 const log=lines.join('\n')+'\nall expectations met\n';
 assert.equal(idleTileReleaseCycles(log,4,{afterExit:true}).length,4);
 assert.throws(()=>idleTileReleaseCycles(log));
 for(const bad of [log.replace('world-null=1','world-null=0'),log.replace('hook-depth=0','hook-depth=1'),
  log.replace('[streaming] World residency exit=0 extent=256\n',''),
  log.replace('[streaming] World residency exit=0 extent=256',release(0,1,1)+'\n[streaming] World residency exit=0 extent=256').replace(release(0,1,1)+'\n[streaming] Idle TILE sweep','[streaming] Idle TILE sweep')])
  assert.throws(()=>idleTileReleaseCycles(bad,4,{afterExit:true}));
});

test('a zero-candidate sweep qualifies only an observed no-op; missing sweeps refuse',()=>{
 const log=fixture().split('\n').filter(l=>!l.startsWith('[streaming] Idle TILE release ')).join('\n')
  .replaceAll(/eligible=1 freed=[01] retained=[01]/g,'eligible=0 freed=0 retained=0')
  .replaceAll('heap-after=7000','heap-after=20000');
 const cycles=idleTileReleaseCycles(log);
 assert.ok(cycles.every(s=>s.eligible===0&&s.freed===0&&s.heapReclaimedBytes===0));
 assert.throws(()=>idleTileReleaseCycles(log.split('\n').filter(l=>!l.startsWith('[streaming] Idle TILE sweep ')).join('\n')));
});
