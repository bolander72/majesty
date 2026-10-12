#!/usr/bin/env node
// Qualify the second original import/activation, paired ownership publication,
// and actual resumed ticks using complete saved graphs, not pass logs alone.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {prepareCheckpointRegisteredHeroArrival} from '../web/world/arrival.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointChunks,checkpointAgentQueues,
 checkpointActorRecords,checkpointAgentReferencePlan,checkpointNextAgentId,checkpointPlacements} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointActorOrderUnitReferences} from '../web/world/order-unit-bindings.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {heroRepeatNeighborPublishedJournalView} from './lib/hero-captured-journal-view.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalReady,nativeHeroArrivalPublished} from '../web/world/hero-travel-publication.mjs';

const [manifestName,pagingName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-repeat-neighbor-arrival-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function bound(v){assert.equal((await lstat(v.filename)).size,v.bytes);assert.equal(await hash(v.filename),v.sha256);}
async function bytes(s,offset,size){assert.ok(size<65536);const b=Buffer.alloc(size);for(let at=0;at<size;at+=4096)b.set(await s.readAt(offset+at,Math.min(4096,size-at)),at);return b;}
async function records(s){const map=new Map(),add=(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,row);};
 for await(const row of checkpointUnits(s))add('UNIT:'+row.primary.words[1],row);for await(const row of checkpointAgents(s))add('GPL:'+row.agentId,row);
 for await(const row of checkpointAttachments(s))add(row.kind+':'+row.unitId,row);return map;}
async function root(s,tag){let r;for await(const row of checkpointChunks(s))if(row.tag===tag){assert.equal(r,undefined);r=row;}assert.ok(r);return r;}
async function exact(a,ra,b,rb,key){assert.ok(ra&&rb,key);assert.equal(ra.size,rb.size,key);for(let at=0;at<ra.size;at+=4096){const n=Math.min(4096,ra.size-at);assert.deepEqual(await a.readAt(ra.offset+at,n),await b.readAt(rb.offset+at,n),key);}}
async function queues(s){const rows=[];for await(const q of checkpointAgentQueues(s)){assert.ok(rows.length<8192);rows.push(q);}return rows;}
const semantic=q=>q.type==='queued-agent'?{type:q.type,queue:q.queue,index:q.index,agentId:q.agentId}:{type:q.type,activeQueue:q.activeQueue};
const m=await json(manifestName),q=await json(pagingName);
assert.equal(q.nativeConnectedRepeatedHeroNeighborPagingQualified,true);assert.equal(q.manifest.filename,resolve(manifestName));assert.equal(q.manifest.sha256,await hash(manifestName));
for(const[n,h]of Object.entries(q.sourceSha256))assert.equal(await hash(n),h);
for(const k of ['selectedHeroBindingTrialQualified','importRepeatNeighbor','publishRepeatNeighbor','nativeSelectedHeroRepeatNeighborArrivalBoundaryObserved','nativeSelectedHeroRepeatNeighborResumeBoundaryObserved',
 'nativeSessionTerminal','ownedProducerAbsent','publicationWorkerTerminal','publicationWorkerAbsent'])assert.equal(m[k],true,k);
assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.stopReason,null);assert.equal(m.nativeProcessesStarted,1);assert.equal(m.browserUsed,false);
assert.deepEqual(m.preservedBefore,m.preservedAfter);for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
for(const v of [m.repeatNeighborPageInput,m.repeatNeighborPublication,m.repeatDeparturePublication,m.publication,...Object.values(m.repeatNeighborArrivalWorlds),...Object.values(m.repeatNeighborResumeWorlds)])await bound(v);
const staged=await json(m.repeatNeighborPageInput.filename),capture=await json(m.repeatDeparturePublication.filename),first=await json(m.publication.filename),p=await json(m.repeatNeighborPublication.filename),a=staged.neighborArrival;
assert.equal(p.nativeHeldHeroRepeatNeighborPairPublished,true);assert.equal(p.nativePid,m.nativePid);assert.equal(p.fixture,m.fixture);
for(const [a,b]of [[p.pageInput,m.repeatNeighborPageInput],[p.departurePublication,m.repeatDeparturePublication]]){
 for(const key of ['filename','bytes','sha256'])assert.equal(a[key],b[key]);assert.ok(a.largestRead<=4096);
}
const ready=parseNativeHeroArrivalReady(p.ready),hero=ready.unitId,agent=ready.agentId,home=ready.homeAgentId,alias={unitId:hero,agentId:agent},homeAlias={kind:'proxy',unitId:0,agentId:home};
assert.equal(ready.serial,4);assert.equal(ready.region,'1_0');assert.equal(ready.clock,4350);assert.equal(home,38);
assert.notEqual(hero,first.publicationReceipt.owner.unitId);assert.notEqual(agent,first.publicationReceipt.owner.agentId);
assert.equal(a.options.unitId,capture.crossing.unitId);assert.equal(a.options.sourceClockMs,capture.crossing.clock);assert.equal(a.options.destinationClockMs,4350);
assert.equal(a.options.attachedUnitBindings.length,0);assert.equal(a.options.unitBindings.length,0);assert.deepEqual(a.context.identity,first.identity);
assert.equal(a.request,`majesty-hero-neighbor-arrival-v1|4|1_0|4350|38|${capture.crossing.clock}|${a.pack.bytes}|${a.pack.sha256}\n`);
assert.equal(await readFile(join(m.fixture,'frontier_1_0/Frontier_Hero_Neighbor_Arrival.txt'),'utf8'),a.request);await bound(a.pack);
const captured=await stoppedFileSource(capture.captured.filename),destination=await stoppedFileSource(staged.target.filename);
const prepared=await prepareCheckpointRegisteredHeroArrival(captured,destination,a.options,a.context);assert.deepEqual(prepared.plan,a.plan);
assert.deepEqual(Object.keys(prepared.records).sort(),['agent','container','order','unit']);
const words=values=>{const b=Buffer.alloc(values.length*4);values.forEach((n,i)=>b.writeUInt32LE(n,i*4));return b;};
const expectedPack=Buffer.concat([words([0x3141484d,1,4,capture.crossing.clock,4350,capture.crossing.unitId,capture.crossing.agentId,home,100000,1000,0,a.totalRecordBytes]),
 ...['unit','agent','container','order'].flatMap((n,i)=>[words([i,capture.crossing.unitId,prepared.records[n].length]),Buffer.from(prepared.records[n])])]);
const pack=await stoppedFileSource(a.pack.filename);assert.equal(pack.size,expectedPack.length);assert.deepEqual(await bytes(pack,0,pack.size),expectedPack);
const expected=new Map(),nativeMap=new Map([[100000,hero]]),agentMap=new Map([[1000,agent],[home,home]]);
for(const[name,v]of Object.entries(prepared.records)){
 const b=Buffer.from(v),put=(at,map)=>{const old=b.readUInt32LE(at);assert.ok(map.has(old));b.writeUInt32LE(map.get(old),at);};let key,observed,payload=b;
 if(name==='unit'){put(36,nativeMap);for(const e of a.plan.edits)if(e.record==='unit'&&e.reason==='native script association')put(e.offset-a.plan.ranges.unit.offset,agentMap);key='UNIT:'+hero;observed='Hero_Arrival_Arrival_Unit_Observed.UNIT';}
 else if(name==='agent'){for(const e of a.plan.edits)if(e.record==='agent'){
  if(e.reason==='script identity'||e.reason.startsWith('script:'))put(e.offset-a.plan.ranges.agent.offset,agentMap);
  else if(e.reason==='script native association')put(e.offset-a.plan.ranges.agent.offset,nativeMap);}
  key='GPL:'+agent;observed='Hero_Arrival_Arrival_Agent_Observed.GPL';}
 else if(name==='container'){for(const at of [0,56,72])put(at,nativeMap);key='CONT:'+hero;observed='Hero_Arrival_Arrival_Container_Observed.bin';payload=b.subarray(36);}
 else{assert.equal(name,'order');put(0,nativeMap);key='ORDR:'+hero;observed='Hero_Arrival_Arrival_Orders_Observed.bin';payload=b.subarray(36);}
 expected.set(key,b);const s=await stoppedFileSource(join(m.fixture,'frontier_1_0',observed));assert.deepEqual(await bytes(s,0,s.size),payload,name);
}
const names=['Hero_Repeat_Home_Before','Hero_Repeat_Home_Reused','Hero_Repeat_Arrival_Refused','Hero_Repeat_Arrival_Imported','Hero_Repeat_Activation_Refused','Hero_Repeat_Target_Active'];
const rows=names.map(n=>m.repeatNeighborArrivalWorlds[n]),sources=[],maps=[],states=[];
for(const [i,row]of rows.entries()){const s=await stoppedFileSource(row.filename);sources.push(s);maps.push(await records(s));states.push(await connectedWorldState(row.filename,{unscheduledAgents:i===3||i===4?[34,38,agent]:[34,38]}));}
let exactRecordComparisons=0;
for(const i of [1,2]){assert.deepEqual(states[0].roots,states[i].roots);assert.deepEqual([...maps[0].keys()].sort(),[...maps[i].keys()].sort());
 for(const[key,row]of maps[0]){await exact(sources[0],row,sources[i],maps[i].get(key),key);exactRecordComparisons++;}}
const before=sources[2],after=sources[3],bm=maps[2],am=maps[3];assert.deepEqual([...am.keys()].sort(),[...bm.keys(),...expected.keys()].sort());
for(const[key,b]of expected)assert.deepEqual(await bytes(after,am.get(key).offset,am.get(key).size),b,key);
for(const[key,row]of bm){await exact(before,row,after,am.get(key),key);exactRecordComparisons++;}
for(const s of states){assert.equal(s.clock,4350);assert.equal(s.rng,states[0].rng);assert.equal(s.gameplayRng,states[0].gameplayRng);assert.equal(s.rawTerrainSha256,states[0].rawTerrainSha256);}
assert.equal(await checkpointNextAgentId(before),agent);assert.equal(await checkpointNextAgentId(after),agent+1);
const changed=new Set(['MAP ','GPL ','VHCL','ORDR','CONT','ORLS']);assert.deepEqual(states[2].roots.filter(r=>!changed.has(r.tag)),states[3].roots.filter(r=>!changed.has(r.tag)));
async function comparePatched(a,ar,b,br,patches,insertion=Infinity,insertBytes=Buffer.alloc(0)){
 assert.equal(br.size,ar.size+insertBytes.length);for(let at=0;at<ar.size+16;){const n=Math.min(4096,ar.size+16-at,at<insertion?insertion-at:Infinity),v=Uint8Array.from(await a.readAt(ar.offset+at,n));
  for(const p of patches)for(let i=0;i<p.bytes.length;i++){const k=p.relative+i-at;if(k>=0&&k<n)v[k]=p.bytes[i];}
  assert.deepEqual(await b.readAt(br.offset+at+(at>=insertion?insertBytes.length:0),n),v);at+=n;}
 if(insertBytes.length)assert.deepEqual(await bytes(b,br.offset+insertion,insertBytes.length),insertBytes);
}
const patch=(relative,n)=>({relative,bytes:words([n])});
for(const[tag,key]of [['VHCL','UNIT:'+hero],['ORDR','ORDR:'+hero],['CONT','CONT:'+hero]]){
 const b=await root(before,tag),n=await root(after,tag),added=expected.get(key);assert.equal(n.version,b.version);assert.equal(n.count,b.count+1);
 assert.equal(am.get(key).offset-n.offset,b.size+16);await comparePatched(before,b,after,n,[patch(4,b.size+added.length),patch(12,b.count+1)],b.size+16,added);
}
const mapBefore=await root(before,'MAP '),mapAfter=await root(after,'MAP ');assert.equal(mapBefore.size,56);assert.equal(mapAfter.size,56);
assert.equal((await bytes(before,mapBefore.offset+16+48,4)).readUInt32LE(0),hero-1);await comparePatched(before,mapBefore,after,mapAfter,[patch(16+48,hero)]);
const ordersBefore=await root(before,'ORLS'),ordersAfter=await root(after,'ORLS');assert.equal(ordersBefore.size,(ordersBefore.count+1)*4);
await comparePatched(before,ordersBefore,after,ordersAfter,[patch(4,ordersBefore.size+4),patch(12,ordersBefore.count+1)],ordersBefore.size+16,words([hero]));
const gb=await root(before,'GPL '),ga=await root(after,'GPL '),agents=[];for await(const v of checkpointAgents(before))agents.push(v);
const added=am.get('GPL:'+agent),delta=added.size+4,insertion=agents.at(-1).offset+agents.at(-1).size-gb.offset;assert.ok(agents.at(-1).agentId<agent);
assert.equal(added.offset-4-ga.offset,insertion);const patches=[];
for(const[at,inc,oldExpected]of [[4,delta,gb.size],[16,delta,gb.size],[28,delta,null],[agents[0].offset-8-gb.offset,1,agents.length],[gb.end-12-gb.offset,1,agent]]){
 const old=(await bytes(before,gb.offset+at,4)).readUInt32LE(0);if(oldExpected!==null)assert.equal(old,oldExpected);patches.push(patch(at,old+inc));}
await comparePatched(before,gb,after,ga,patches,insertion,Buffer.concat([words([agent]),expected.get('GPL:'+agent)]));
assert.deepEqual((await queues(before)).map(semantic),(await queues(after)).map(semantic));assert.ok(!(await queues(after)).some(v=>v.agentId===agent));
assert.deepEqual(states[3].roots,states[4].roots);assert.deepEqual([...maps[3].keys()].sort(),[...maps[4].keys()].sort());
for(const i of [4,5])for(const[key,row]of maps[3]){await exact(after,row,sources[i],maps[i].get(key),key);exactRecordComparisons++;}
assert.deepEqual(states[3].roots.filter(r=>r.tag!=='GPL '),states[5].roots.filter(r=>r.tag!=='GPL '));
const oldQueues=await queues(after),activeQueues=await queues(sources[5]),scheduled=activeQueues.filter(v=>v.agentId===agent);assert.equal(scheduled.length,1);const queued=scheduled[0];assert.equal(queued.type,'queued-agent');
assert.deepEqual(activeQueues.filter(v=>v.agentId!==agent).map(semantic),oldQueues.map(semantic));
const activeGpl=await root(sources[5],'GPL '),queueInsertion=queued.offset-activeGpl.offset;
assert.equal(queued.index,oldQueues.filter(v=>v.type==='queued-agent'&&v.queue===queued.queue).length);const activationPatches=[];
for(const[at,inc,oldExpected]of [[4,4,ga.size],[16,4,ga.size],[28,4,null],[queued.offset-(queued.index+1)*4-activeGpl.offset,1,queued.index]]){
 const old=(await bytes(after,ga.offset+at,4)).readUInt32LE(0);if(oldExpected!==null)assert.equal(old,oldExpected);activationPatches.push(patch(at,old+inc));}
await comparePatched(after,ga,sources[5],activeGpl,activationPatches,queueInsertion,words([agent]));
for(const i of [3,5]){await verifyRegisteredHeroSnapshot(first.identity,alias,homeAlias,sources[i],true,'1_0');
 for(const ref of await checkpointAgentReferencePlan(sources[i],agent,id=>id))assert.ok([agent,home].includes(ref.before));
 for await(const ref of checkpointActorOrderUnitReferences(sources[i],hero))assert.ok(!ref.targetUnitId||ref.targetUnitId===hero);}
for(const k of ['clock','rng','gameplayRng','rawTerrainSha256'])assert.equal(states[3][k],states[5][k]);
for(const v of [p.active,p.retired,p.marker])await bound(v);assert.equal(p.active.sha256,ready.sha256);assert.equal(p.active.bytes,ready.size);
assert.equal(p.retired.filename,capture.fixture+'/frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Hero_Repeat_Source_Retired.GMP');
assert.equal(await checkpointSavedClock(await stoppedFileSource(p.retired.filename)),capture.crossing.clock);
assert.equal(await readFile(p.marker.filename,'utf8'),p.nativeManifest);assert.equal(p.expectedManifest,capture.publicationReceipt.ownerManifest);
const receipt=p.publicationReceipt;assert.equal(receipt.ownerRevision,7);assert.deepEqual(receipt.owner,alias);assert.deepEqual(receipt.home,homeAlias);assert.equal(receipt.acknowledgement,nativeHeroArrivalPublished(p.ready,receipt.ownerManifest));
assert.equal(p.exactRetryWrites,0);assert.equal(p.controls.length,5);assert.equal(p.zeroWriteControls.length,5);for(const v of p.zeroWriteControls){assert.equal(v.refused,true);assert.equal(v.writes,0);}
assert.ok(p.stats.largestRead<=4096&&p.stats.largestWrite<=4096&&p.stats.peakReads===1&&p.stats.activeReads===0);
assert.deepEqual(p.beforeJournalSha256,capture.journalSha256);await ownedDirectory(p.beforeJournal,'actor-arrival-fixture-hero-route-before-repeat-arrival-');
for(const[n,h]of Object.entries(p.beforeJournalSha256))assert.equal(await hash(join(p.beforeJournal,n)),h);
const arrivalJournal=await heroRepeatNeighborPublishedJournalView(m,p);
assert.deepEqual((await readdir(arrivalJournal)).sort(),Object.keys(p.journalSha256).sort());for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(arrivalJournal,n)),h);
assert.equal(await readFile(join(arrivalJournal,HERO_ROUTE_HEAD),'utf8'),receipt.ownerManifest);const node=await json(join(arrivalJournal,'Frontier_Hero_Route_Node_7.json'));
assert.deepEqual(node.previous,JSON.parse(p.expectedManifest));assert.equal(node.kind,'handoff');assert.equal(node.ownerRegion,'1_0');assert.equal(node.revision,7);
assert.deepEqual(node.changes.map(v=>({region:v.region,alias:v.alias,homeAlias:v.homeAlias,world:v.world})),[
 {region:'0_0',alias:capture.publicationReceipt.owner,homeAlias:capture.publicationReceipt.home,world:{size:p.retired.bytes,sha256:p.retired.sha256}},
 {region:'1_0',alias,homeAlias,world:{size:p.active.bytes,sha256:p.active.sha256}}]);
const head=JSON.parse(receipt.ownerManifest);assert.equal(head.nodeSha256,await hash(join(arrivalJournal,'Frontier_Hero_Route_Node_7.json')));
const store=new HeroRouteStore(await stoppedHeroRouteStorage(arrivalJournal,{}),first.identity,first.identity.contentDigest);let escaped;
await store.withOwner(async v=>{assert.equal(v.record.manifest,receipt.ownerManifest);assert.deepEqual(v.entry.alias,alias);assert.deepEqual(v.entry.homeAlias,homeAlias);assert.equal(v.entry.world.sha256,p.active.sha256);assert.equal(await checkpointSavedClock(v.source),4350);escaped=v.source;});
await assert.rejects(escaped.readAt(0,16),/lease ended/);
const pausedRows=[p.active,m.repeatNeighborResumeWorlds.Hero_Repeat_Target_Published,m.repeatNeighborResumeWorlds.Hero_Repeat_Target_Routed],paused=[];
for(const row of pausedRows)paused.push(await stoppedFileSource(row.filename));
for(const b of paused.slice(0,2)){const map=await records(b);assert.deepEqual([...maps[5].keys()].sort(),[...map.keys()].sort());
 for(const[key,row]of maps[5]){await exact(sources[5],row,b,map.get(key),key);exactRecordComparisons++;}assert.equal(await checkpointSavedClock(b),4350);}
const routed=await records(paused[2]);for(const[key,row]of maps[5])if(!expected.has(key)){await exact(sources[5],row,paused[2],routed.get(key),key);exactRecordComparisons++;}
const playedRow=m.repeatNeighborResumeWorlds.Hero_Repeat_Target_Played,played=await stoppedFileSource(playedRow.filename);assert.equal(await checkpointSavedClock(played),4450);
await verifyRegisteredHeroSnapshot(first.identity,alias,homeAlias,played,true,'1_0');const actor=await checkpointActorRecords(played,hero);
assert.equal(actor.agent.agentId,agent);assert.equal(actor.unit.agentId,agent);assert.equal(actor.agent.deleted,false);assert.equal(actor.unit.parentUnitId,0);assert.equal(actor.unit.stateFlags&4,0);
for(const k of ['family','description','playerNumber'])assert.equal(actor.unit[k],first.identity.actor[k]);
async function pose(s){let v;for await(const p of checkpointPlacements(s))if(p.unitId===hero){assert.equal(v,undefined);v=p.fixedPosition;}assert.ok(v);return v;}
const routedPose=await pose(paused[2]),playedPose=await pose(played);
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from|GplException/.test(log));
const accepted=`[frontier] Hero travel publication accepted serial=4 region=1_0 clock=4350 manifest-sha256=${receipt.ownerManifestSha256} both-worlds-verified=1 phase=7 pending=3`;
const resumed=`[frontier] Hero travel resumed serial=4 region=1_0 unit=${hero} agent=${agent} home=proxy/0/38 clock=4350 manifest-sha256=${receipt.ownerManifestSha256} original-resume=1 fresh-binding=1 phase=3 pending=0`;
const held=`[frontier] Hero repeated neighbor gameplay held serial=4 region=1_0 unit=${hero} agent=${agent} home=38 start-clock=4350 clock=4450 original-ticks=2 fresh-proxy-binding=1 phase=7 pending=0 saved=1 result=pass`;
for(const text of [accepted,resumed,held])assert.equal(log.split(text).length-1,1);assert.ok(log.indexOf(accepted)<log.indexOf(resumed)&&log.indexOf(resumed)<log.indexOf(held));
assert.equal(log.split('[frontier] Hero travel publication refused serial=4 region=1_0 clock=4350 phase=7 pending=0').length-1,5);
assert.equal(await readFile(join(m.fixture,'frontier_1_0/Frontier_Hero_Travel_Published.txt'),'utf8'),receipt.acknowledgement);
assert.ok(log.includes(`Hero destination home mode=reuse agent=38 bytes=${m.proposal.bytes} counter-before=${agent} counter-after=${agent} native-id=0`));
const sourceSha256={...q.sourceSha256},pending=[resolve('scripts/inspect-native-hero-repeat-neighbor-arrival.mjs')],seen=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(seen.has(name))continue;seen.add(name);assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&seen.size<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);const digest=await hash(n);if(sourceSha256[name])assert.equal(sourceSha256[name],digest);sourceSha256[name]=digest;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,nativeConnectedRepeatedHeroNeighborArrivalResumeQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 pagingQualification:{filename:resolve(pagingName),sha256:await hash(pagingName)},sourceSha256,actualAlias:alias,homeAlias,clock:4350,playedClock:4450,
 originalNeighborTicks:2,exactRecordComparisons,exactImportedRecords:4,completeChangedRootsQualified:true,originalAIScheduled:true,
 existingHomeReusedWithoutAllocation:true,ownerRevision:7,ownerManifest:receipt.ownerManifest,retiredSource:p.retired,activeNeighbor:p.active,playedNeighbor:playedRow,
 routedPose,playedPose,heroPoseChanged:JSON.stringify(routedPose)!==JSON.stringify(playedPose),fiveNativeReceiptsRefused:true,zeroWriteControls:5,exactRetryWrites:0,
 nativeReceiptConsumed:true,freshProxyBindingResumed:true,browserUsed:false,realOPFSDurabilityQualified:false,repeatedFullTripsQualified:false,
 nativeSessionTerminal:true,publicationWorkerTerminal:true,elapsedMs:m.finishedAtMs-m.startedAtMs,
 peakSampledNativeAndPublisherRssBytes:Math.max(...m.resourceSamples.map(v=>v.rssBytes)),goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeConnectedRepeatedHeroNeighborArrivalResumeQualified:true,actualAlias:alias,ownerRevision:7,originalNeighborTicks:2,exactRecordComparisons,heroPoseChanged:report.heroPoseChanged}));
