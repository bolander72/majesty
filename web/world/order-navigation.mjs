// Partial source navigation inspection. No edits or destination path reuse.
import {checkpointActorOrderEntries} from './order-entries.mjs';
export const MAX_ORDER_NAVIGATION_HEADERS=128;
const signed=n=>n|0;

// Fully exhaust before using observations: later records can still reject.
// Native world pairs have 16 units per navigation-grid cell. Grid conversion
// truncates signed division toward zero; coordinates are not IEEE floats.
export async function* checkpointActorOrderNavigation(source,unitId){
  let current,headers=0;
  for await(const entry of checkpointActorOrderEntries(source,unitId)){
    if(entry.type==='entry'){
      current=undefined;
      if(entry.kind!==2&&entry.kind!==4&&entry.kind!==7)continue;
      if(++headers>MAX_ORDER_NAVIGATION_HEADERS)throw new Error('Native order navigation header budget exceeded');
      if(entry.kind===2){
        // Pinned writer005b6df0 copies native+3c/+40/+44 through004f6a90.
        // These are the current Move's Q11 XY and original elevation word;
        // they must shift with the actor, independently of the later Path.
        yield Object.freeze({type:'coordinate',unitId,bank:entry.bank,index:entry.index,kind:2,
          field:'destination',space:'native-fixed',x:signed(entry.words[26]),y:signed(entry.words[27]),
          z:signed(entry.words[28]),offset:entry.offset+104,size:12});
        continue;
      }
      const cursorWord=entry.kind===4?30:25,cursor=signed(entry.words[cursorWord]),count=entry.waypointCount;
      // Canonical source admission, not a claim that every larger exhausted
      // cursor would make the original leaf unsafe in all branches.
      if(cursor<0||cursor>count)throw new Error('Noncanonical native order path cursor');
      const capacity=entry.kind===4?entry.words[32]:10;
      if(capacity>4096||count>capacity)throw new Error('Native order path storage bounds exceeded');
      current={bank:entry.bank,index:entry.index,kind:entry.kind};
      yield Object.freeze({type:'navigation',unitId,...current,cursor,count,capacity,
        cursorOffset:entry.offset+cursorWord*4,pointSpace:entry.kind===4?'navigation-grid':'native-world',
        completeOrderMigration:false});
      if(entry.kind===4)yield Object.freeze({type:'coordinate',unitId,...current,field:'destination',
        space:'native-world',x:signed(entry.words[26]),y:signed(entry.words[27]),offset:entry.offset+104,size:8});
    }else if(entry.type==='waypoint'){
      if(!current||current.bank!==entry.bank||current.index!==entry.index)throw new Error('Unassociated native order waypoint');
      yield Object.freeze({type:'coordinate',unitId,...current,field:'waypoint',waypointIndex:entry.waypointIndex,
        space:current.kind===4?'navigation-grid':'native-world',x:signed(entry.firstWord),y:signed(entry.secondWord),
        offset:entry.offset,size:8});
    }
  }
}
