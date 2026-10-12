// Replay only observed ordinary buffer allocations; baseline origins remain unknown.
import assert from 'node:assert/strict';
export function idleTileAllocationCoverage(log,gates){
 assert.equal(typeof log,'string');assert.ok(Buffer.byteLength(log)<=1024*1024);assert.equal(gates.length,4);
 const live=new Map(),boundaries=[];let next=1,allocations=0,frees=0,unknownFrees=0;
 for(const line of log.split('\n')){
  if(line.startsWith('[streaming] World allocation event=')){
   const a=line.match(/^\[streaming\] World allocation event=(\d+) op=alloc address=([0-9a-f]{8}) input=12200 heap-requested=12208 return-pc=0064d5c1 direct-caller=00529e70 direct-callee=0064d59f loads=(\d+) exits=(\d+) clock=(\d+) result=pass$/);
   const f=line.match(/^\[streaming\] World allocation event=(\d+) op=free address=([0-9a-f]{8}) loads=(\d+) exits=(\d+) clock=(\d+) freed=1 result=pass$/);
   const row=a??f;assert.ok(row,'Unknown or unsafe observed allocation event');
   assert.equal(Number(row[1]),next++);assert.ok(next<=1025);
   const address=parseInt(row[2],16);assert.ok(address>0&&address%16===0);
   assert.ok(Number(row[3])<=4&&Number(row[4])<=4&&Number(row[4])<=Number(row[3]));
   assert.ok(Number(row[5])<=0xffffffff);
   if(a){assert.ok(!live.has(address),'Reallocated live observed buffer');live.set(address,Number(row[1]));allocations++;}
   else {if(!live.delete(address))unknownFrees++;frees++;}
   assert.ok(live.size<=512);
  }
  if(line.startsWith('[streaming] Idle TILE gates ')){
   const row=line.match(/^\[streaming\] Idle TILE gates visit=(\d+) tracked=(\d+) owners=\d+ backlinks=\d+ zero=\d+ descriptors=\d+ typed=\d+ arrays=\d+ resolved=\d+ result=pass$/);assert.ok(row);
   const visit=boundaries.length;assert.ok(visit<4);assert.equal(Number(row[1]),visit);
   assert.equal(gates[visit].visit,visit);assert.equal(Number(row[2]),gates[visit].tracked);
   assert.equal(live.size,gates[visit].tracked,'Gate counter omits observed live allocations');
   boundaries.push({visit,knownLiveBuffers:live.size,allocationEvents:next-1});
  }
 }
 assert.equal(boundaries.length,4);assert.ok(allocations>0);
 return {allocationEvents:next-1,allocations,frees,unknownBaselineOrUnobservedFrees:unknownFrees,boundaries,
  knownLiveBuffersAtLogEnd:live.size,knownRequestedBytesAtLogEnd:live.size*12208,
  completeHeapOwnershipQualified:false,safeEvictionQualified:false};
}
