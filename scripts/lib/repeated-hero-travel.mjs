// Extend qualified trace algorithms to twelve visits; preserve the old producers.
import assert from 'node:assert/strict';
import {compareConnectedWorlds} from './connected-residency.mjs';
export function parseRepeatedPageOwners(log,events,contexts,count){
 const parents=[...log.matchAll(/^\[streaming\] World page-parent queue=([0-9a-f]{8}) parent=([0-9a-f]{8}) global=([0-9a-f]{8}) vtable=([0-9a-f]{8}) bytes=(\d+) lock=([0-9a-f]{8}) reference=([0-9a-f]{8}) message=([0-9a-f]{8}) admitted=([01]) result=pass$/gm)];
 assert.equal(parents.length,contexts.length);assert.equal((log.match(/^\[streaming\] World page-parent /gm)||[]).length,parents.length);
 const activeParents=new Map();
 parents.forEach((t,i)=>{const c=contexts[i],e=events.find(e=>e.event===c.event),hex=n=>parseInt(t[n],16),p=hex(2);
  assert.equal(hex(1),c.queue);assert.equal(hex(3),p);assert.equal(hex(4),0x682bc4);assert.equal(Number(t[5]),696);
  assert.equal(hex(6),p+0x138);assert.equal(t[9],'1');assert.ok(t.index<e.position);
  assert.ok(p>=0x1000000&&p<0x10000000&&p%16===0);assert.ok(hex(7)>=0x1000000&&hex(7)<0x10000000&&hex(7)%4===0);
  assert.ok(hex(8)>=0x1000000&&hex(8)<0x10000000&&hex(8)%16===0);activeParents.set(c.event,p);
 });
 const keys='event visit stage buffer queue parent recipient queue-freed parent-freed queue-live parent-live count map capacity map-bytes map-live first-buffer last-buffer default-queue tree-head tree-count buffer-live result'.split(' ');
 const hex=new Set('buffer queue parent map first-buffer last-buffer default-queue tree-head'.split(' '));
 const rows=[...log.matchAll(/^\[streaming\] World page-owner .*$/gm)].map(t=>{
  const r={position:t.index};const tokens=t[0].slice('[streaming] World page-owner '.length).split(' ');assert.equal(tokens.length,keys.length);
  tokens.forEach((v,i)=>{const p=v.indexOf('=');assert.equal(v.slice(0,p),keys[i]);const value=v.slice(p+1),k=keys[i];
   if(k==='stage'||k==='result')r[k]=value;else {assert.match(value,hex.has(k)?/^[0-9a-f]{8}$/:/^\d+$/);r[k]=parseInt(value,hex.has(k)?16:10);assert.ok(Number.isSafeInteger(r[k])&&r[k]<=0xffffffff);}});
  assert.equal(r.result,'pass');assert.ok(['allocation','load','before-exit','after-exit','before-queue-free','before-parent-free'].includes(r.stage));
  for(const k of ['queue-freed','parent-freed','queue-live','parent-live','map-live','buffer-live'])assert.ok(r[k]===0||r[k]===1);
  assert.equal(r['buffer-live'],1);assert.equal(r['queue-live'],1-r['queue-freed']);assert.equal(r['parent-live'],1-r['parent-freed']);
  assert.ok(r.buffer>=0x1000000&&r.buffer<0x10000000&&r.buffer%16===0);assert.ok(r.queue%16===0&&r.parent%16===0);
  if(!r['queue-live'])assert.deepEqual([r.count,r.map,r.capacity,r['map-bytes'],r['map-live'],r['first-buffer'],r['last-buffer']],[0,0,0,0,0,0,0]);
  if(!r['parent-live'])assert.deepEqual([r['default-queue'],r['tree-head'],r['tree-count']],[0,0,0]);
  assert.equal(r['map-live'],Number(r['queue-live']&&r.capacity>0&&r.capacity<=4096&&r.capacity<=Math.floor(r['map-bytes']/4)));
  if(!r['map-live'])assert.deepEqual([r['first-buffer'],r['last-buffer']],[0,0]);
  return r;
 });assert.ok(rows.length>0&&rows.length<=1024);
 const byEvent=new Map(contexts.map(c=>[c.event,c])),live=new Map(),identities=new Map();
 const actions=[...events.map(e=>({...e,kind:'page'})),...rows.map(r=>({...r,kind:'owner'}))].sort((a,b)=>a.position-b.position);
 for(const r of actions){
  if(r.kind==='page'){if(r.op==='alloc'){if(byEvent.has(r.event))live.set(r.address,{event:r.event,queue:byEvent.get(r.event).queue,parent:0,recipient:0,queueFreed:0,parentFreed:0});}else live.delete(r.address);continue;}
  const e=live.get(r.buffer);assert.ok(e,'Owner sample has no observed live allocation');assert.equal(e.event,r.event);assert.equal(e.queue,r.queue);
  if(r.stage==='allocation'){
   assert.equal(e.parent,0);e.parent=r.parent;e.recipient=r.recipient;
   const c=byEvent.get(e.event);assert.equal(c.pushCaller,0x5a4e12);assert.equal(c.prefix,0x41);assert.equal(c.count,0);
   assert.equal(r.parent,activeParents.get(e.event));
   assert.deepEqual([r.count,r.map,r.capacity,r['map-bytes'],r['map-live'],r['first-buffer'],r['last-buffer']],[c.count,c.map,c.capacity,c.mapBytes,c.mapLive,c.firstBuffer,c.lastBuffer]);
   const p=events.find(v=>v.event===e.event);assert.equal(r.visit,p.exits);assert.ok(c.position<r.position);
   identities.set(e.event,{event:e.event,buffer:r.buffer,queue:r.queue,parent:r.parent,recipient:r.recipient,allocationVisit:r.visit});
  }
  assert.ok(e.parent);assert.equal(r.parent,e.parent);assert.equal(r.recipient,e.recipient);
  assert.equal(r['queue-freed'],e.queueFreed);assert.equal(r['parent-freed'],e.parentFreed);
  if(r.stage==='before-queue-free')for(const q of live.values())if(q.queue===r.queue)q.queueFreed=1;
  if(r.stage==='before-parent-free')for(const q of live.values())if(q.parent===r.parent)q.parentFreed=1;
 }
 assert.equal(identities.size,contexts.length);assert.equal(new Set([...identities.values()].map(r=>r.parent)).size,1);
 const captures=[];
 assert.ok(Number.isInteger(count)&&count>=4&&count<=12);
 for(let visit=0;visit<count;visit++)for(const stage of ['load','before-exit','after-exit']){
  const marker=log.indexOf(`[streaming] World allocator visit=${visit} stage=${stage} `);assert.ok(marker>=0);
  const actual=rows.filter(r=>r.visit===visit&&r.stage===stage),expected=new Map();
  for(const e of events){if(e.position>=marker)break;if(e.op==='alloc'){if(byEvent.has(e.event))expected.set(e.address,e.event);}else expected.delete(e.address);}
  assert.deepEqual(actual.map(r=>[r.buffer,r.event]).sort(),[...expected].sort());
  assert.ok(actual.every(r=>r.position<marker));
  if(stage==='before-exit'||stage==='after-exit')for(const r of actual){
   assert.deepEqual([r['queue-live'],r['parent-live'],r.count,r['map-live'],r['map-bytes'],r.capacity],[1,1,1,1,8,2]);
   assert.equal(r['first-buffer'],r.buffer);assert.equal(r['last-buffer'],r.buffer);
  }
  if(visit<count-1||stage!=='after-exit'){const next=log.indexOf('[streaming] World allocator ',marker+1);if(next>=0)assert.ok(actual.every(r=>r.position<next));}
  captures.push({visit,stage,rows:actual});
 }
 return {identities:[...identities.values()],samples:rows,captures,queueFreeSamples:rows.filter(r=>r.stage==='before-queue-free'),parentFreeSamples:rows.filter(r=>r.stage==='before-parent-free')};
}

function rows(log,type,keys,hexKeys){const hex=new Set(hexKeys.split(' '));return [...log.matchAll(new RegExp(`^\\[streaming\\] World queue-release ${type} .*$`,'gm'))].map(t=>{
 const r={position:t.index},tokens=t[0].slice(`[streaming] World queue-release ${type} `.length).split(' '),names=keys.split(' ');assert.equal(tokens.length,names.length);
 tokens.forEach((v,i)=>{const at=v.indexOf('='),k=v.slice(0,at),x=v.slice(at+1);assert.equal(k,names[i]);
 if(k==='result')r[k]=x;else{assert.match(x,hex.has(k)?/^[0-9a-f]{8}$/:/^\d+$/);r[k]=parseInt(x,hex.has(k)?16:10);assert.ok(Number.isSafeInteger(r[k]));}});assert.equal(r.result,'pass');return r;});}
export function inspectRepeatedQueueRetirementTrace(log,events,owners,registration,count){
 const candidates=rows(log,'candidate','visit event queue buffer parent recipient allocation-load current-load registered default-match map front message vtable message-bytes nested admitted result','queue buffer parent map front message vtable nested');
 const retired=rows(log,'retired','visit event queue buffer original-destructor original-delete empty buffer-freed map-freed descriptor-freed tree-same clock-same world-same hooks-same requested-before requested-after result','queue buffer original-destructor original-delete');
 const sweeps=rows(log,'sweep','visit observed retained eligible released clock hook-depth baton result','');
 assert.ok(Number.isInteger(count)&&count>=4&&count<=12);
 assert.equal(sweeps.length,count);assert.equal(candidates.length,count-1);assert.equal(retired.length,count-1);
 assert.equal((log.match(/^\[streaming\] World queue-release /gm)||[]).length,sweeps.length+candidates.length+retired.length);
 const identities=new Map(owners.identities.map(e=>[e.event,e]));
 for(let visit=0;visit<count;visit++){
  const sweep=sweeps[visit];assert.deepEqual([sweep.visit,sweep.observed,sweep.retained,sweep.eligible,sweep.released,sweep['hook-depth'],sweep.baton],[visit,visit?2:1,1,visit?1:0,visit?1:0,0,1]);
  const completed=[...log.matchAll(/^\[streaming\] World checkpoint completed visit=(\d+) clock=(\d+) .*$/gm)].filter(t=>Number(t[1])===visit);assert.equal(completed.length,1);assert.equal(sweep.clock,Number(completed[0][2]));
  const checkpoint=log.indexOf(`[streaming] World checkpoint completed visit=${visit} `);assert.ok(sweep.position<checkpoint);
  const boundary=owners.captures.find(c=>c.visit===visit&&c.stage==='before-exit');assert.equal(boundary.rows.length,1);
  assert.ok(sweep.position<boundary.rows[0].position);
  const active=registration.captures.find(c=>c.visit===visit&&c.stage==='after-exit');assert.equal(active.rows.length,1);
  assert.deepEqual([active.rows[0]['queue-references'],active.rows[0]['default-match']],[1,0]);
  if(!visit)continue;
  const c=candidates[visit-1],r=retired[visit-1],id=identities.get(c.event);assert.ok(id);
  assert.deepEqual([c.visit,c['allocation-load'],c['current-load'],c.registered,c['default-match'],c.admitted],[visit,visit,visit+1,0,0,1]);
  for(const k of ['event','queue','buffer','parent','recipient'])assert.equal(c[k],id[k]);
  assert.equal(id.allocationVisit,visit-1);assert.ok(c.front>=c.buffer&&c.front-c.buffer<=4088&&c.front%8===0);
  assert.deepEqual([c.vtable,c['message-bytes']],[0x682d04,40]);for(const k of ['map','message','nested'])assert.ok(c[k]>=0x1000000&&c[k]<0x10000000&&c[k]%16===0);
  for(const k of ['visit','event','queue','buffer'])assert.equal(r[k],c[k]);assert.ok(c.position<r.position&&r.position<sweep.position);
  assert.deepEqual([r['original-destructor'],r['original-delete']],[0x497cf0,0x645bc0]);
  for(const k of ['empty','buffer-freed','map-freed','descriptor-freed','tree-same','clock-same','world-same','hooks-same'])assert.equal(r[k],1);
  assert.ok(r['requested-before']-r['requested-after']>=4096);
  const frees=events.filter(e=>e.op==='free'&&e.address===c.buffer&&c.position<e.position&&e.position<r.position);assert.equal(frees.length,1);
  const old=registration.samples.filter(t=>t.event===c.event&&t.position<c.position).at(-1);assert.ok(old);
  assert.deepEqual([old.visit,old.stage,old['queue-references'],old['default-match']],[visit,'load',0,0]);
  assert.equal(old['recipient-queue'],active.rows[0].queue);assert.notEqual(old['recipient-queue'],c.queue);
 }
 return {candidates,retired,sweeps};
}

export function repeatedConnectedResidencyCycles(log,visits,{initializeGeneratedRegions=false,startSide=1}={}){
  assert.ok(startSide===0||startSide===1,'Unsupported starting region');
  assert.ok(!initializeGeneratedRegions||startSide===1,'Generated initialization requires its original load order');
  assert.ok(visits.length>=3&&visits.length<=12);
  assert.equal(typeof initializeGeneratedRegions,'boolean');
  if(initializeGeneratedRegions)assert.ok(visits.length>=4,'Both initialized regions must be revisited');
  assert.ok(log.includes('all expectations met'),'Native script did not finish');
  assert.ok(!/result=fail|SIGSEGV|abort from|exception e06d7363|undeliverable call(?!s: none)|residency setup .*refused/i.test(log),'Failed native run');
  const matches=pattern=>[...log.matchAll(pattern)];
  const loads=matches(/^\[streaming\] World residency load=(\d+) extent=(\d+) registry-entries=(\d+) world=([0-9a-f]{8}) factory=([0-9a-f]{8}) terrain=([0-9a-f]{8}) grid=([0-9a-f]{8}) search=([0-9a-f]{8}) entries=([0-9a-f]{8}) heap=(\d+) blocks=(\d+) crt=(\d+) hooks=(\d+) result=pass$/gm);
  const originalLoads=matches(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=32 sample-bytes=2304$/gm);
  const requests=matches(/^\[streaming\] World residency request=(\d+) observed-ticks=(\d+) pending=4 result=pass$/gm);
  const exits=matches(/^\[streaming\] World residency exit=(\d+) extent=(\d+) phase=(\d+) pending=(\d+) world-null=(\d+) roots-freed=(\d+),(\d+),(\d+),(\d+),(\d+),(\d+) free-calls=(\d+) heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) crt-before=(\d+) crt-after=(\d+) heap-valid=(\d+) hooks-same=(\d+) result=pass$/gm);
  const snapshots=matches(/^\[streaming\] World persistence snapshot visit=(\d+) side=(\d+) stage=(before|after) clock=(\d+) saved=1 state-clock-same=1 hooks-same=1 latest-published=(\d+) copy-bound=4096 result=pass$/gm);
  const completed=matches(/^\[streaming\] World checkpoint completed visit=(\d+) clock=(\d+) tick=(\d+) entry-tick=(\d+) completed-ticks=(\d+) hook-depth=0 baton=1 result=pass$/gm);
  const initialized=matches(/^\[streaming\] World checkpoint initialized visit=(\d+) clock=(\d+) tick=(\d+) completed-ticks=0 original-tick-skipped=1 hook-depth=0 baton=1 result=pass$/gm);
  const boundaries=matches(/^\[streaming\] World checkpoint exit visit=(\d+) clock=(\d+) tick=(\d+) saved-clock=(\d+) saved-tick=(\d+) result=pass$/gm);
  const scriptSeeds=matches(/^\[streaming\] World persistence rng visit=(\d+) saved=(\d+) before=(\d+) after=(\d+) clock-same=1 hooks-same=1 original-setter=00623720 result=pass$/gm);
  const gameSeeds=matches(/^\[streaming\] World persistence gameplay-rng visit=(\d+) saved=(\d+) before=(\d+) after=(\d+) clock-same=1 hooks-same=1 original-setter=004f6710 result=pass$/gm);
  for(const rows of [loads,originalLoads,requests,exits,boundaries,scriptSeeds,gameSeeds])assert.equal(rows.length,visits.length,'Incomplete or duplicate native cycle');
  assert.equal(initialized.length,initializeGeneratedRegions?2:0,'Incomplete or unexpected initialization');
  assert.equal(completed.length,visits.length-initialized.length,'Incomplete or unexpected completed ticks');
  assert.equal(matches(/^\[streaming\] World checkpoint (?:initialized|completed) .*$/gm).length,visits.length,'Unrecognized checkpoint boundary');
  assert.equal(snapshots.length,visits.length*2);
  return visits.map(({before,after},i)=>{
    const initializing=initializeGeneratedRegions&&i<2,expectedTicks=initializing?0:20;
    const load=loads[i],exit=exits[i],snapBefore=snapshots[i*2],snapAfter=snapshots[i*2+1];
    const done=initializing?initialized[i]:completed[i-(initializeGeneratedRegions?2:0)],boundary=boundaries[i];
    const roots=load.slice(4,10).map(value=>parseInt(value,16));
    assert.equal(new Set(roots).size,6);assert.ok(roots.every(value=>value>0));
    assert.deepEqual(load.slice(1,3).map(Number),[i,256]);assert.ok(Number(load[3])>0);
    assert.equal(Number(load[13]),Number(loads[0][13]));assert.equal(Number(originalLoads[i][1]),before.counts.units);
    assert.deepEqual(requests[i].slice(1).map(Number),[i,expectedTicks]);
    const values=exit.slice(1).map(Number);
    assert.deepEqual(values.slice(0,11),[i,256,4,1,1,1,1,1,1,1,1]);
    const [freeCalls,heapBefore,heapAfter,blocksBefore,blocksAfter,crtBefore,crtAfter,heapValid,hooksSame]=values.slice(11);
    assert.ok(freeCalls>=6&&heapBefore>heapAfter&&blocksBefore>blocksAfter&&crtBefore>crtAfter);assert.deepEqual([heapValid,hooksSame],[1,1]);
    assert.deepEqual([Number(snapBefore[1]),Number(snapBefore[2]),snapBefore[3],Number(snapBefore[4]),Number(snapBefore[5])],[i,(i+startSide)%2,'before',before.clock,0]);
    assert.deepEqual([Number(snapAfter[1]),Number(snapAfter[2]),snapAfter[3],Number(snapAfter[4]),Number(snapAfter[5])],[i,(i+startSide)%2,'after',after.clock,1]);
    assert.equal(after.clock-before.clock,expectedTicks*50);assert.equal(Number(done[1]),i);assert.equal(Number(done[2]),after.clock);
    if(initializing){
      compareConnectedWorlds(before,after);
      assert.equal(before.rawTerrainSha256,after.rawTerrainSha256,'Initialization writer changed terrain');
      assert.equal(Number(done[3]),0,'Initialization advanced the loaded tick');
      assert.equal(matches(new RegExp(`^\\[streaming\\] World residency first-tick load=${i} .*`,'gm')).length,0,'Initialization entered simulation');
    }else{
      assert.equal(Number(done[3]),Number(done[4])+1);assert.equal(Number(done[5]),20);
    }
    assert.deepEqual(boundary.slice(1).map(Number),[i,after.clock,Number(done[3]),after.clock,Number(done[3])]);
    for(const [seed,wanted] of [[scriptSeeds[i],before.rng],[gameSeeds[i],before.gameplayRng]])assert.deepEqual([Number(seed[1]),Number(seed[2]),Number(seed[4])],[i,wanted,wanted]);
    const ordered=[originalLoads[i],load,scriptSeeds[i],gameSeeds[i],snapBefore,snapAfter,done,requests[i],boundary,exit];
    for(let j=1;j<ordered.length;++j)assert.ok(ordered[j-1].index<ordered[j].index,'Native save/disposal ordering differs');
    if(i)assert.ok(exits[i-1].index<originalLoads[i].index,'Next kingdom loaded before preceding disposal');
    return {visit:i,region:(i+startSide)%2?'1_0':'0_0',roots,freed:[1,1,1,1,1,1],completedTicks:expectedTicks,initializedWithoutSimulation:initializing,clockBefore:before.clock,clockAfter:after.clock,
      units:before.counts.units,postUnloadHeapBytes:heapAfter,postUnloadHeapBlocks:blocksAfter,postUnloadCrtAllocations:crtAfter};
  });
}
