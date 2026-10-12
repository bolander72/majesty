import test from 'node:test';
import assert from 'node:assert/strict';
import {idleTileAllocationCoverage} from '../scripts/lib/idle-tile-allocation-coverage.mjs';
const alloc=(e,p)=>`[streaming] World allocation event=${e} op=alloc address=${p} input=12200 heap-requested=12208 return-pc=0064d5c1 direct-caller=00529e70 direct-callee=0064d59f loads=1 exits=1 clock=32800 result=pass`;
const free=(e,p)=>`[streaming] World allocation event=${e} op=free address=${p} loads=1 exits=1 clock=32800 freed=1 result=pass`;
const gate=(v,n)=>`[streaming] Idle TILE gates visit=${v} tracked=${n} owners=0 backlinks=0 zero=0 descriptors=0 typed=0 arrays=0 resolved=0 result=pass`;
const gates=[0,1,0,0].map((tracked,visit)=>({visit,tracked}));
const fixture=()=>[gate(0,0),free(1,'00000030'),alloc(2,'00000010'),gate(1,1),free(3,'00000010'),gate(2,0),gate(3,0),alloc(4,'00000020')].join('\n');
test('known survivors reconcile at every sweep while later menu allocations remain visible',()=>{
 const r=idleTileAllocationCoverage(fixture(),gates);
 assert.deepEqual(r.boundaries.map(b=>b.knownLiveBuffers),[0,1,0,0]);
 assert.equal(r.unknownBaselineOrUnobservedFrees,1);assert.equal(r.knownLiveBuffersAtLogEnd,1);assert.equal(r.knownRequestedBytesAtLogEnd,12208);
 assert.equal(r.completeHeapOwnershipQualified,false);assert.equal(r.safeEvictionQualified,false);
});
test('missing events, altered original callers and unsuccessful frees refuse',()=>{
 const log=fixture();
 for(const bad of [log.replace(alloc(2,'00000010')+'\n',''),log.replace('direct-caller=00529e70','direct-caller=00529e71'),
  log.replace('input=12200','input=100'),log.replace('freed=1','freed=0'),log.replace('event=2','event=5'),
  log.replace('address=00000010','address=00000011'),log.replace('result=pass','result=fail'),
  log.replace('loads=1 exits=1','loads=1 exits=2')])assert.throws(()=>idleTileAllocationCoverage(bad,gates));
});
test('a live address cannot be allocated twice; legitimate freed-address reuse is admitted',()=>{
 const log=fixture().replace(free(3,'00000010'),alloc(3,'00000010'));
 assert.throws(()=>idleTileAllocationCoverage(log,gates));
 const reuse=fixture().replace(alloc(4,'00000020'),alloc(4,'00000010'));
 assert.equal(idleTileAllocationCoverage(reuse,gates).knownLiveBuffersAtLogEnd,1);
});
test('missing, duplicate or contradictory sweep coverage refuses',()=>{
 const log=fixture();
 for(const bad of [log.replace(gate(1,1)+'\n',''),log.replace(gate(1,1),gate(1,1)+'\n'+gate(1,1)),
  log.replace(gate(1,1),gate(1,0)),log.replace(gate(2,0),gate(0,0))])assert.throws(()=>idleTileAllocationCoverage(bad,gates));
 assert.throws(()=>idleTileAllocationCoverage(log,gates.map(g=>({...g,tracked:0}))));
 assert.throws(()=>idleTileAllocationCoverage('x'.repeat(1024*1024+1),gates));
});
