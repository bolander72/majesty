// Ordered original-leaf/callback evidence. This parser does not establish the
// native producer, record bytes, cross-region import or browser behavior.
export function originalMarkerClockTrace(log) {
  if(typeof log!=='string'||log.length>1024*1024||!log.includes('all expectations met')||
     /result=fail|SIGSEGV|abort from|undeliverable call(?!s: none)/i.test(log))throw Error('Incomplete or failed marker clock trace');
  const lines=log.split('\n').filter(l=>l.startsWith('[streaming] Marker '));
  const begin=lines.shift()?.match(/^\[streaming\] Marker clock begin phase=(baseline|rebased) source=25800 destination=18250 actual=(\d+) unit=503 hero=502 callback=4101 serialized-equal=1$/);
  if(!begin)throw Error('Missing original marker start');
  const phase=begin[1],actual=Number(begin[2]),base=phase==='baseline'?25800:18250;
  if(actual<25800||actual>25900)throw Error('Invalid actual marker clock');
  const last=lines.pop()?.match(/^\[streaming\] Marker clock complete phase=(baseline|rebased) steps=(\d+) leaves=(\d+) callbacks=(\d+) completion=1 cleanup=1 original-leaf=1 original-callback=1 clock-restored=1 hooks-removed=1 hero-transfer=0 result=pass$/);
  if(!last||last[1]!==phase)throw Error('Missing original marker completion');
  const steps=[],callbacks=[];let complete=false;
  for(const line of lines) {
    const cb=line.match(/^\[streaming\] Marker callback clock=(\d+) reason=(\d+) id=4101 original-delegated=1$/);
    if(cb) {
      if(complete||callbacks.length>=2||Number(cb[2])!==(callbacks.length?1:2))throw Error('Invalid original marker callback');
      callbacks.push({clock:Number(cb[1]),reason:Number(cb[2])});continue;
    }
    const m=line.match(/^\[streaming\] Marker step index=(\d+) advance=(\d+) clock=(\d+) active=([01]) leaves=(\d+) callbacks=(\d+) completion=([01]) cleanup=([01]) flags=(\d+) clock-restored=1$/);
    if(!m||complete||steps.length>=129)throw Error('Invalid or unbounded original marker step');
    const [index,advance,clock,active,leaves,count,completion,cleanup,flags]=m.slice(1).map(Number);
    if(index!==steps.length||advance!==index*50||clock!==base+advance||leaves!==Math.floor(advance/100)||
       count!==callbacks.length||count!==2*completion||completion!==Number(!active)||cleanup!==completion||
       Boolean(flags&4)!==Boolean(completion)||flags>0xffffffff||
       callbacks.some(cb=>cb.clock!==clock))throw Error('Marker clock/frame/callback chronology differs');
    steps.push({index,advance,clock,active,leaves,callbacks:count,completion,cleanup,flags});complete=!active;
  }
  const end=steps.at(-1);
  if(!complete||!end||end.leaves<1||callbacks.length!==2||Number(last[2])!==steps.length||
     Number(last[3])!==end.leaves||Number(last[4])!==2)throw Error('Marker lifetime did not complete through its original callback');
  return {phase,actualClock:actual,baseClock:base,steps,callbacks,completionAdvance:end.advance,leaves:end.leaves};
}
