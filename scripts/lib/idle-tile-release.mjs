// Validate stopped original release results; never invoke a guest operation.
import assert from 'node:assert/strict';
export function idleTileReleaseCycles(log,count=4,{afterExit=false}={}){
 assert.equal(count,4);assert.equal(typeof log,'string');assert.ok(Buffer.byteLength(log)<=1024*1024);
 assert.equal(typeof afterExit,'boolean');
 const sweeps=[...log.matchAll(/^\[streaming\] Idle TILE sweep visit=(\d+) eligible=(\d+) freed=(\d+) retained=(\d+) heap-before=(\d+) heap-after=(\d+) clock-same=1 world-same=1 hooks-same=1(?: stage=(idle) world-null=1 hook-depth=0)? result=pass$/gm)];
 const releases=[...log.matchAll(/^\[streaming\] Idle TILE release visit=(\d+) event=(\d+) key=(\d+) descriptor=([0-9a-f]{8}) entry=([0-9a-f]{8}) owner=([0-9a-f]{8}) buffer=([0-9a-f]{8}) references=0 original=004f73a0 freed=([01]) retained=([01]) result=pass$/gm)];
 assert.equal(sweeps.length,count);assert.equal(log.split('\n').filter(l=>l.startsWith('[streaming] Idle TILE sweep ')).length,count);
 assert.equal(log.split('\n').filter(l=>l.startsWith('[streaming] Idle TILE release ')).length,releases.length);
 assert.ok(releases.length<=count*512);
 const events=new Set(),freedEvents=new Set();
 for(const r of releases){
  const key=r[1]+':'+r[2];assert.ok(Number(r[1])<count);
  assert.ok(Number(r[2])>0&&Number(r[2])<=1024&&!events.has(key)&&!freedEvents.has(r[2]));
  events.add(key);if(Number(r[8]))freedEvents.add(r[2]);assert.equal(Number(r[8])+Number(r[9]),1);
  for(const p of r.slice(4,8))assert.ok(parseInt(p,16)>0&&parseInt(p,16)%4===0);
 }
 return sweeps.map((s,i)=>{
  const rows=releases.filter(r=>Number(r[1])===i);assert.equal(Number(s[1]),i);assert.equal(Number(s[2]),rows.length);
  assert.equal(Number(s[3]),rows.reduce((n,r)=>n+Number(r[8]),0));assert.equal(Number(s[4]),rows.reduce((n,r)=>n+Number(r[9]),0));
  assert.equal(Boolean(s[7]),afterExit);
  const saved=log.indexOf(afterExit?`[streaming] World residency exit=${i} `:`[streaming] World persistence snapshot visit=${i} side=${i%2} stage=after `);
  const done=afterExit?(i<count-1?log.indexOf(`[streaming] World residency load=${i+1} `):log.indexOf('all expectations met')):log.indexOf(`[streaming] World checkpoint completed visit=${i} `);
  assert.ok(saved>=0&&done>=0&&s.index>saved&&s.index<done);
  for(const r of rows)assert.ok(r.index>saved&&r.index<s.index);
  if(i)assert.ok(sweeps[i-1].index<saved);
  const before=Number(s[5]),after=Number(s[6]);assert.ok(Number.isSafeInteger(before)&&before>0&&Number.isSafeInteger(after)&&after>0);
  return {visit:i,eligible:Number(s[2]),freed:Number(s[3]),retained:Number(s[4]),heapBefore:before,heapAfter:after,heapReclaimedBytes:before-after};
 });
}
// Counters describe which ownership requirement rejected a tracked buffer.
// They cannot establish safe release for a candidate that never reached it.
export function idleTileCandidateGates(log,cycles){
 assert.equal(cycles.length,4);assert.ok(Buffer.byteLength(log)<=1024*1024);
 const gates=[...log.matchAll(/^\[streaming\] Idle TILE gates visit=(\d+) tracked=(\d+) owners=(\d+) backlinks=(\d+) zero=(\d+) descriptors=(\d+) typed=(\d+) arrays=(\d+) resolved=(\d+) result=pass$/gm)];
 const details=[...log.matchAll(/^\[streaming\] Idle TILE candidate visit=(\d+) event=(\d+) descriptor=([0-9a-f]{8}) type=([0-9a-f]{8}) entries=(\d+) array=([0-9a-f]{8}) result=observed$/gm)];
 assert.equal(gates.length,4);assert.equal(log.split('\n').filter(s=>s.startsWith('[streaming] Idle TILE gates ')).length,4);
 assert.equal(log.split('\n').filter(s=>s.startsWith('[streaming] Idle TILE candidate ')).length,details.length);
 assert.ok(details.length<=16);
 const seen=new Set();
 for(const d of details){
  assert.ok(Number(d[1])<4&&Number(d[2])>0&&Number(d[2])<=1024);
  assert.ok(parseInt(d[3],16)>0&&parseInt(d[3],16)%4===0);
  assert.ok(Number(d[5])<=0xffffffff);
  const key=d[1]+':'+d[2];assert.ok(!seen.has(key));seen.add(key);
 }
 return gates.map((g,i)=>{
  assert.equal(Number(g[1]),i);
  const values=g.slice(2,10).map(Number);assert.ok(values[0]<=512);
  for(let k=1;k<values.length;k++)assert.ok(values[k]<=values[k-1]);
  assert.equal(values.at(-1),cycles[i].eligible);
  const exit=log.indexOf(`[streaming] World residency exit=${i} `),sweep=log.indexOf(`[streaming] Idle TILE sweep visit=${i} `);
  assert.ok(exit>=0&&exit<g.index&&g.index<sweep);
  const rows=details.filter(d=>Number(d[1])===i);assert.equal(rows.length,Math.min(values[4],4));
  for(const d of rows){
   assert.ok(exit<d.index&&d.index<g.index);
   if(!values[5])assert.notEqual(d[4],'454c4954');
   if(values[4]===values[5])assert.equal(d[4],'454c4954');
  }
  return {visit:i,...Object.fromEntries(['tracked','owners','backlinks','zero','descriptors','typed','arrays','resolved'].map((k,n)=>[k,values[n]])),
   descriptorSamples:rows.map(d=>({event:Number(d[2]),descriptor:parseInt(d[3],16),type:parseInt(d[4],16),entries:Number(d[5]),array:parseInt(d[6],16)}))};
 });
}
