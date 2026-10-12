// Common native dispatch age only; no complete order migration or source writes.
import {checkpointActorOrderEntries} from './order-entries.mjs';
export const MAX_ORDER_DISPATCH_CLOCK_SITES=128;
const clock=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff;

// Supply stopped snapshots of original clock 0071c6a8, in milliseconds.
// This preserves unsigned age and the common dispatch test, including wrap and
// zero stamps. Other timers and leaf semantics remain outside this partial plan.
export async function checkpointOrderDispatchClockPlan(source,unitId,options){
  const {sourceClockMs,destinationClockMs}=options??{};
  if(!clock(sourceClockMs)||!clock(destinationClockMs))throw new Error('Invalid native order clock snapshots');
  const headers=[],patches=[];
  for await(const entry of checkpointActorOrderEntries(source,unitId)){
    if(entry.type!=='entry')continue;
    if(headers.length>=MAX_ORDER_DISPATCH_CLOCK_SITES)throw new Error('Native order dispatch clock budget exceeded');
    const whenWord=entry.parentVersion===undefined?5:6,when=entry.words[whenWord],delta=entry.words[whenWord+1],
      rate=entry.words[whenWord-1],info=entry.words[whenWord+2],elapsed=(sourceClockMs-when)>>>0,
      after=(destinationClockMs-elapsed)>>>0,offset=entry.offset+whenWord*4;
    headers.push(Object.freeze({bank:entry.bank,index:entry.index,kind:entry.kind,offset,when,after,
      delta,rate,info,elapsed,dispatchSkipped:Boolean(info&1),dispatchDue:!(info&1)&&delta<=elapsed}));
    if(after!==when)patches.push(Object.freeze({offset,size:4,before:when,after,bank:entry.bank,index:entry.index,kind:entry.kind}));
  }
  return Object.freeze({scope:'native-order-common-dispatch-clock',unitId,sourceClockMs,destinationClockMs,
    completeOrderMigration:false,headers:Object.freeze(headers),patches:Object.freeze(patches)});
}
