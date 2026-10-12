// Original automatic named loading after complete world disposal.
import assert from 'node:assert/strict';
export function parseAutoMultiwayLoads(log,cycles){
 const count=cycles.length;assert.ok(count===6||count===8);
 const begun=[...log.matchAll(/^\[streaming\] World auto-load begin visit=(\d+) side=(\d+) phase=(\d+) pending=(\d+) world-null=1 loads=(\d+) exits=(\d+) accepted=(\d+) clock=(\d+) hook-depth=0 baton=1 result=pass$/gm)];
 const attached=[...log.matchAll(/^\[streaming\] World auto-load attached visit=(\d+) side=(\d+) phase=(\d+) pending=(\d+) world=([0-9a-f]{8}) accepted=(\d+) hooks-same=1 original-attach=00415f30 menu-skipped=1 result=pass$/gm)];
 assert.equal(begun.length,count);assert.equal(attached.length,count);assert.equal((log.match(/^\[streaming\] World auto-load /gm)||[]).length,count*2);
 return cycles.map((cycle,visit)=>{
  const begin=begun[visit],done=attached[visit];
  assert.deepEqual(begin.slice(1,8).map(Number),[visit,visit%2,1,0,visit,visit,visit]);
  assert.deepEqual(done.slice(1,5).map(Number),[visit,visit%2,1,2]);assert.equal(Number(done[6]),visit+1);
  const world=parseInt(done[5],16);assert.equal(world,cycle.roots[0]);
  const original=log.indexOf('[streaming] Original load end ',begin.index),loaded=log.indexOf(`[streaming] World residency load=${visit} `);
  assert.ok(begin.index<original&&original<done.index&&done.index<loaded);
  if(visit){const exit=log.indexOf(`[streaming] World residency exit=${visit-1} `);assert.ok(exit<begin.index);assert.equal(Number(begin[8]),cycles[visit-1].clockAfter);}
  return {visit,side:visit%2,region:cycle.region,world,clockBeforeAttach:Number(begin[8]),originalNamedRead:true,originalContextAttach:true,menuSkipped:true,previousWorldDisposed:true};
 });
}
