// Shared, read-only qualification of original 512-grid return motion and AI.
import assert from 'node:assert/strict';
export function returnedMotion(log,{unitId,agentId,clock,x,y}) {
  const one=(pattern,message)=>{const rows=[...log.matchAll(pattern)];if(rows.length!==1)throw Error(message);return rows[0].slice(1).map(Number);};
  const [unit,agent,frame,startClock,startX,startY,hooks]=one(/^\[streaming\] Joint motion begin unit=(\d+) agent=(\d+) frame=(\d+) clock=(\d+) fixed=(-?\d+),(-?\d+) hooks=(\d+) bounded=1$/gm,'Missing unique original return observer');
  assert.deepEqual([unit,agent,startClock,startX,startY,hooks],[unitId,agentId,clock,x,y,6]);
  const samples=[...log.matchAll(/^\[streaming\] Joint motion sample elapsed=(\d+) clock=(\d+) fixed=(-?\d+),(-?\d+) cells=(-?\d+),(-?\d+) physical=(\d+) footprint=(\d+) drawing=(\d+) marker=(\d+) calls=(\d+) leaves=(\d+) path=(\d+) links=(\d+)$/gm)].map(r=>r.slice(1).map(Number));
  assert.deepEqual(samples.map(s=>s[0]),Array.from({length:16},(_,i)=>i*16),'Require complete 240 original ticks');
  for(let i=0;i<samples.length;++i) {
    const [elapsed,now,px,py,cx,cy,physical,footprint,drawing,marker,calls,leaves,path,links]=samples[i];
    if(now!==clock+elapsed*50||px<0||py<0||px>=16777216||py>=16777216||cx<0||cy<0||cx>=512||cy>=512||
      physical!==1||footprint<1||footprint>1024||drawing!==1||!(marker&1)||links!==1||leaves>calls||path>leaves)
      throw Error('Broken returned actor clock, bounds, footprint, drawing, marker or links');
    if(i&&[10,11,12].some(j=>samples[i-1][j]>samples[i][j]))throw Error('Command observation counters regressed');
  }
  assert.deepEqual(samples[0].slice(2,4),[x,y]);assert.deepEqual(samples[0].slice(10,13),[0,0,0]);
  if(new Set(samples.map(s=>s.slice(2,4).join(','))).size<3||samples[0].slice(4,6).join(',')===samples.at(-1).slice(4,6).join(','))throw Error('No original navigation-cell transition');
  const [ticks,calls,returns,leaves,leafReturns,path,changed,physical,drawing,advanced,removed,valid,count]=one(/^\[streaming\] Joint motion completed ticks=(\d+) calls=(\d+) returns=(\d+) leaves=(\d+) leaf-returns=(\d+) path=(\d+) changed=(\d+) physical=(\d+) drawing=(\d+) clock-advanced=(\d+) hooks-removed=(\d+) valid=(\d+) samples=(\d+) result=pass$/gm,'Missing original motion completion');
  if(ticks!==240||!calls||calls!==returns||!leaves||leaves!==leafReturns||!path||changed<1||changed>241||count!==16)
    throw Error('Missing command execution, balanced delegation or bounded completion');
  assert.deepEqual([physical,drawing,advanced,removed,valid],[1,1,1,1,1]);assert.deepEqual([calls,leaves,path],samples.at(-1).slice(10,13));
  const [aiTicks,agents,agentReturns,contexts,contextReturns,executed]=one(/^\[streaming\] Joint script motion completed ticks=(\d+) agent-calls=(\d+) agent-returns=(\d+) contexts=(\d+) context-returns=(\d+) executed=(\d+) hooks-removed=1 result=pass$/gm,'Missing original return AI completion');
  if(aiTicks!==240||!agents||agents!==agentReturns||!contexts||contexts!==contextReturns||!executed||executed>contexts)
    throw Error('Missing original AI actions or unbalanced AI delegation');
  const [savedUnit,savedAgent,savedClock,savedX,savedY]=one(/^\[streaming\] Joint evolved checkpoint unit=(\d+) agent=(\d+) ticks=240 clock=(\d+) fixed=(-?\d+),(-?\d+) queued=1 saved=1 state-same=1 hooks-same=1 result=pass$/gm,'Missing safe original returned full save');
  assert.deepEqual([savedUnit,savedAgent,savedClock,savedX,savedY],[unitId,agentId,...samples.at(-1).slice(1,4)]);
  return {frame,clock,x,y,ticks,calls,leaves,path,samples,agents,contexts,executed,savedClock,savedX,savedY};
}
