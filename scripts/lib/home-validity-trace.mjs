import assert from 'node:assert/strict';
export function originalHomeValidityTrace(log){
 if(typeof log!=='string'||log.length>1024*1024)throw Error('Unbounded home-validity log');
 assert.ok(!/result=fail|SIGSEGV|abort from|undeliverable call(?!s: none)/i.test(log));
 assert.ok(log.includes('all expectations met'));
 const rows=[...log.matchAll(/^\[streaming\] Home validity id=(\d+) native-id=(\d+) native-loaded=(\d+) deleted=(\d+) reference=(\d+) original-valid=(\d+) unchanged=(\d+) result=(\w+)$/gm)]
  .map(m=>({agentId:+m[1],unitId:+m[2],nativeLoaded:+m[3],deleted:+m[4],reference:+m[5],valid:+m[6],unchanged:+m[7],result:m[8]}));
 assert.deepEqual(rows,[
  {agentId:7,unitId:469,nativeLoaded:1,deleted:0,reference:1,valid:1,unchanged:1,result:'pass'},
  {agentId:12,unitId:0,nativeLoaded:0,deleted:0,reference:1,valid:0,unchanged:1,result:'pass'},
  {agentId:20,unitId:0,nativeLoaded:0,deleted:0,reference:1,valid:0,unchanged:1,result:'pass'}]);
 const boundaries=[...log.matchAll(/^\[streaming\] Home validity boundary clock=(\d+) aliases=3 scratch=64 home-written=0 pure-agents-scheduled=0 state-preserved=1 result=pass$/gm)];
 assert.equal(boundaries.length,1);const clock=+boundaries[0][1];assert.ok(Number.isInteger(clock)&&clock>0&&clock<=0xffffffff);
 return {clock,rows,scratchBytes:64,homeWritten:false,pureAgentsScheduled:false};
}
