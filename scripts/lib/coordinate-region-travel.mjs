import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {coordinateTravelReady,coordinateTravelRequest} from '../../web/world/coordinate-travel.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function rows(log,type){return [...log.matchAll(new RegExp('^\\[streaming\\] World '+type+' .*$','gm'))].map(match=>{
  const row={position:match.index};for(const token of match[0].slice(('[streaming] World '+type+' ').length).split(' ')){
    const [key,value]=token.split('=');assert.ok(key&&value&&!Object.hasOwn(row,key));row[key]=value;
  }assert.equal(row.result,'pass');return row;
});}
function n(row,key){assert.match(row[key],/^\d+$/);const value=Number(row[key]);assert.ok(Number.isSafeInteger(value));return value;}
function keys(row,fields){assert.deepEqual(Object.keys(row).sort(),['position',...fields.split(' ')].sort());}
function wire(words,extraBytes=0){assert.equal(words.length,9);assert.ok(words.every(n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff));
  assert.ok(extraBytes===0||extraBytes===1);const bytes=Buffer.alloc(36+extraBytes);words.forEach((value,i)=>bytes.writeUInt32LE(value,i*4));return bytes;}
export function parseCoordinateRegionTravel(log,cycles,m){
  assert.equal(m.regionRequestVersion,'v2');assert.deepEqual(m.coordinateRoute,['0_0','1_0','0_0','1_0']);
  const ready=rows(log,'coordinate-ready'),accepted=rows(log,'coordinate-request accepted'),refused=rows(log,'coordinate-request refused'),activation=rows(log,'coordinate-activation'),snapshots=rows(log,'coordinate-snapshot');
  assert.equal(ready.length,4);assert.equal(accepted.length,4);assert.equal(refused.length,5);assert.equal(activation.length,3);assert.equal(snapshots.length,8);
  assert.equal((log.match(/^\[streaming\] World coordinate-request /gm)||[]).length,9);
  assert.deepEqual(m.requestDelaysMs,[1600,2100,1600,2300]);assert.equal(m.readyPublications.length,4);assert.equal(m.requestPublications.length,9);
  assert.deepEqual(m.requestPublications.map(p=>p.kind),['stale-initial','missing-neighbor','non-neighbor','trailing-byte','travel','duplicate-previous','travel','travel','finish']);
  for(const publication of m.readyPublications)assert.equal(sha(wire(publication.words)),publication.sha256);
  for(const publication of m.requestPublications){assert.equal(publication.bytes,36+publication.extraBytes);assert.equal(sha(wire(publication.words,publication.extraBytes)),publication.sha256);}
  const actual=m.requestPublications.filter(p=>p.kind==='travel'||p.kind==='finish');
  for(let visit=0;visit<4;++visit){
    const c=cycles[visit],r=ready[visit],a=accepted[visit],source=m.coordinateRoute[visit],target=visit===3?source:m.coordinateRoute[visit+1];
    keys(r,'serial visit source clock operation bytes result');keys(a,'visit serial source target initial-clock current-clock completed-ticks operation accepted consumed world-same clock-same hooks-same result');
    assert.deepEqual([n(r,'serial'),n(r,'visit'),r.source,n(r,'clock'),n(r,'operation'),n(r,'bytes')],[visit+1,visit,source,c.clockBefore,visit===3?2:0,36]);
    const raw=wire(m.readyPublications[visit].words),decoded=coordinateTravelReady(raw);assert.equal(decoded.source.x,visit%2);assert.equal(decoded.source.y,0);
    assert.equal(decoded.serial,visit+1);assert.equal(decoded.initialClock,c.clockBefore);assert.equal(decoded.finishOnly,visit===3);
    const request=coordinateTravelRequest(raw,{x:visit===3?visit%2:(visit+1)%2,y:0},{finish:visit===3});assert.deepEqual(Uint8Array.from(wire(actual[visit].words)),request);
    assert.ok(actual[visit].publishedAtMs-m.readyPublications[visit].observedAtMs>=m.requestDelaysMs[visit]);
    assert.deepEqual([n(a,'visit'),n(a,'serial'),a.source,a.target,n(a,'initial-clock'),n(a,'current-clock'),n(a,'completed-ticks'),n(a,'operation'),n(a,'accepted')],
      [visit,visit+1,source,target,c.clockBefore,c.clockAfter,c.completedTicks,visit===3?2:1,visit+1]);
    for(const key of ['consumed','world-same','clock-same','hooks-same'])assert.equal(n(a,key),1);
    assert.equal(m.completedTicksByVisit[visit],c.completedTicks);
    const first=log.indexOf(`[streaming] World residency first-tick load=${visit} `),after=log.indexOf(`[streaming] World persistence snapshot visit=${visit} side=${visit%2} stage=after `);
    assert.ok(r.position<first&&first<a.position&&a.position<after);
    for(let index=0;index<2;++index){const snapshot=snapshots[visit*2+index];keys(snapshot,'visit region stage clock latest-published result');
      assert.deepEqual([n(snapshot,'visit'),snapshot.region,snapshot.stage,n(snapshot,'clock'),n(snapshot,'latest-published')],
        [visit,source,index?'after':'before',index?c.clockAfter:c.clockBefore,index]);
      assert.ok(index?snapshot.position>a.position:snapshot.position<r.position);
    }
    if(visit<3){const next=activation[visit];keys(next,'visit region roots-freed saved-before-switch result');
      assert.deepEqual([n(next,'visit'),next.region,n(next,'roots-freed'),n(next,'saved-before-switch')],[visit+1,target,6,1]);
      const exit=log.indexOf(`[streaming] World residency exit=${visit} `),auto=log.indexOf(`[streaming] World auto-load begin visit=${visit+1} `);
      assert.ok(a.position<exit&&exit<next.position&&next.position<auto&&auto<ready[visit+1].position);
    }
  }
  const bad=m.requestPublications.filter(p=>p.kind!=='travel'&&p.kind!=='finish');
  const expected=actual[0].words;
  for(let i=0;i<bad.length;++i){
    const r=refused[i],publication=bad[i],words=publication.words,visit=i===4?1:0;
    keys(r,'visit serial source target initial-clock current-clock completed-ticks operation accepted exact available world-same clock-same hooks-same result');
    assert.deepEqual([n(r,'visit'),n(r,'serial'),r.source,r.target,n(r,'initial-clock'),n(r,'operation'),n(r,'accepted'),n(r,'exact'),n(r,'available')],
      [visit,words[2],`${words[3]}_${words[4]}`,`${words[5]}_${words[6]}`,words[7],words[8],visit,publication.extraBytes?0:1,0]);
    for(const key of ['world-same','clock-same','hooks-same'])assert.equal(n(r,key),1);
    assert.ok(n(r,'completed-ticks')>0&&n(r,'completed-ticks')<cycles[visit].completedTicks);
    assert.equal(n(r,'current-clock'),cycles[visit].clockBefore+n(r,'completed-ticks')*50);
    assert.ok(ready[visit].position<r.position&&r.position<accepted[visit].position);
    const changed=[...expected];if(i===0)changed[2]=0;if(i===1){changed[5]=0;changed[6]=1;}if(i===2)changed[5]=2;
    assert.deepEqual(words,changed);
    if(i>0&&i<4)assert.ok(publication.publishedAtMs-m.readyPublications[0].observedAtMs>=350*i);
  }
  return {ready,accepted,refused,activation,snapshots,fulfilledNeighborRequests:3,finalStopRequests:1,
    actualRefusals:['stale serial','missing neighbor','non-neighbor','trailing byte','replayed previous request']};
}
