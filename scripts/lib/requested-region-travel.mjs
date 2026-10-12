import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
function rows(log,type,keys){return [...log.matchAll(new RegExp('^\\[streaming\\] World '+type+' .*$','gm'))].map(t=>{const r={position:t.index},tokens=t[0].slice(('[streaming] World '+type+' ').length).split(' '),names=keys.split(' ');assert.equal(tokens.length,names.length);
 tokens.forEach((v,i)=>{const at=v.indexOf('=');assert.equal(v.slice(0,at),names[i]);const x=v.slice(at+1);if(names[i]==='result')assert.equal(x,'pass');else{assert.match(x,/^\d+$/);r[names[i]]=Number(x);assert.ok(Number.isSafeInteger(r[names[i]]));}});return r;});}
export function parseRequestedRegionTravel(log,cycles,m){
 const ready=rows(log,'travel-ready','serial visit source target clock operation bytes result'),accepted=rows(log,'travel-request accepted','visit serial source target initial-clock current-clock completed-ticks operation accepted consumed world-same clock-same hooks-same result'),refused=rows(log,'travel-request refused','visit serial source target initial-clock current-clock completed-ticks operation accepted exact world-same clock-same hooks-same result');
 assert.equal(ready.length,4);assert.equal(accepted.length,4);assert.equal(refused.length,2);assert.equal((log.match(/^\[streaming\] World travel-request /gm)||[]).length,6);
 assert.deepEqual(m.requestDelaysMs,[1400,2100,1600,2300]);assert.equal(m.readyPublications.length,4);assert.equal(m.requestPublications.length,6);
 assert.deepEqual(m.requestPublications.map(r=>r.kind),['stale-initial','travel','duplicate-previous','travel','travel','finish']);
 const wire=(words,expectedSha)=>{assert.equal(words.length,7);assert.ok(words.every(n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff));const b=Buffer.alloc(28);words.forEach((v,i)=>b.writeUInt32LE(v,i*4));assert.equal(sha(b),expectedSha);};
 for(const p of [...m.readyPublications,...m.requestPublications])wire(p.words,p.sha256);
 for(let visit=0;visit<4;visit++){
  const c=cycles[visit],r=ready[visit],a=accepted[visit],finish=visit===3,target=finish?visit%2:(visit+1)%2,op=finish?2:1;
  const words=[0x31565254,1,visit+1,visit%2,target,c.clockBefore,op];assert.deepEqual(m.readyPublications[visit].words,words);
  const pub=m.requestPublications.filter(p=>p.kind==='travel'||p.kind==='finish')[visit];assert.deepEqual(pub.words,words);
  assert.ok(pub.publishedAtMs-m.readyPublications[visit].observedAtMs>=m.requestDelaysMs[visit]);
  assert.deepEqual([r.serial,r.visit,r.source,r.target,r.clock,r.operation,r.bytes],[visit+1,visit,visit%2,target,c.clockBefore,op,28]);
  assert.deepEqual([a.visit,a.serial,a.source,a.target,a['initial-clock'],a['current-clock'],a['completed-ticks'],a.operation,a.accepted],[visit,visit+1,visit%2,target,c.clockBefore,c.clockAfter,c.completedTicks,op,visit+1]);
  for(const key of ['consumed','world-same','clock-same','hooks-same'])assert.equal(a[key],1);assert.ok(c.completedTicks>20&&c.completedTicks<=200);assert.equal(m.completedTicksByVisit[visit],c.completedTicks);
  const first=log.indexOf(`[streaming] World residency first-tick load=${visit} `),snapshot=log.indexOf(`[streaming] World persistence snapshot visit=${visit} side=${visit%2} stage=after `);
  assert.ok(r.position<first&&first<a.position&&a.position<snapshot);
  if(!finish){const next=ready[visit+1];assert.equal(next.source,a.target);const exit=log.indexOf(`[streaming] World residency exit=${visit} `);assert.ok(a.position<exit&&exit<next.position);}
 }
 assert.deepEqual(m.requestPublications[0].words,[0x31565254,1,0,0,1,cycles[0].clockBefore,1]);assert.deepEqual(m.requestPublications[2].words,m.requestPublications[1].words);
 refused.forEach((r,i)=>{assert.deepEqual([r.visit,r.serial,r.source,r.target,r['initial-clock'],r.operation,r.accepted,r.exact],[i,i?1:0,0,1,cycles[0].clockBefore,1,i,1]);
  assert.ok(r['completed-ticks']>0&&r['completed-ticks']<cycles[i].completedTicks);assert.equal(r['current-clock'],cycles[i].clockBefore+r['completed-ticks']*50);
  for(const k of ['world-same','clock-same','hooks-same'])assert.equal(r[k],1);assert.ok(ready[i].position<r.position&&r.position<accepted[i].position);});
 return {ready,accepted,refused,fulfilledNeighborRequests:3,finalStopRequests:1};
}
