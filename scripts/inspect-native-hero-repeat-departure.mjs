#!/usr/bin/env node
// Independently qualify the second outward original crossing, its selected
// recovery and retirement of the fresh native-guild runtime binding.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {heroContinuedHomeJournalView,heroRepeatedCaptureJournalView} from './lib/hero-captured-journal-view.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {selectedHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';
import {requireCheckpointHeroCrossing} from '../web/world/hero-travel-boundary.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalPublished} from '../web/world/hero-travel-publication.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointChunks,checkpointUnits,checkpointAgents,checkpointAttachments,checkpointPlacements,
 checkpointAgentValues,checkpointContainerEntries,checkpointAgentQueues,checkpointNextAgentId,checkpointAbsentAgentReferences} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {checkpointActorOrderUnitReferences} from '../web/world/order-unit-bindings.mjs';
const [manifestName,saveName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-repeat-departure-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function bound(r){assert.equal((await lstat(r.filename)).size,r.bytes);assert.equal(await hash(r.filename),r.sha256);}
const m=await json(manifestName),q=await json(saveName);
assert.equal(q.nativeConnectedContinuedHeroHomeSaveQualified,true);assert.equal(q.manifest.filename,resolve(manifestName));assert.equal(q.manifest.sha256,await hash(manifestName));
for(const[n,h]of Object.entries(q.sourceSha256))assert.equal(await hash(n),h);
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.repeatDeparture,true);assert.equal(m.nativeSelectedHeroRepeatDepartureBoundaryObserved,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
assert.equal(m.publicationWorkerTerminal,true);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.publicationWorkerAbsent,true);
assert.equal(m.nativeProcessesStarted,1);assert.equal(m.browserUsed,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
for(const row of [m.repeatDeparturePublication,m.homeSavePublication,m.publication,...Object.values(m.repeatRetirementWorlds)])await bound(row);
const first=await json(m.publication.filename),saved=await json(m.homeSavePublication.filename),next=await json(m.repeatDeparturePublication.filename);
assert.equal(next.nativeRepeatedHeroDepartureCapturePublished,true);assert.equal(next.nativePid,m.nativePid);assert.equal(next.fixture,m.fixture);
assert.equal(next.homeSavePublication.filename,m.homeSavePublication.filename);assert.equal(next.homeSavePublication.sha256,m.homeSavePublication.sha256);
assert.equal(next.journal,m.publicationJournal);assert.equal(next.expectedManifest,q.ownerManifest);
assert.equal(await heroContinuedHomeJournalView(m,saved),q.continuedJournalVerified);
const clock=next.held.clock,alias=q.actualAlias,home=q.homeAlias,ready=parseNativeHeroArrivalReady(next.ready),receipt=next.publicationReceipt;
assert.equal(ready.serial,4);assert.equal(ready.region,'0_0');assert.equal(ready.clock,clock);assert.equal(next.held.serial,4);assert.equal(next.held.slot,1);
assert.deepEqual({unitId:ready.unitId,agentId:ready.agentId},alias);assert.equal(ready.homeAgentId,home.agentId);
assert.equal(next.crossing.region,'0_0');assert.equal(next.crossing.target,'1_0');assert.equal(next.crossing.serial,4);
assert.equal(next.crossing.clock,clock);assert.equal(next.crossing.previousClock,clock-50);assert.ok(clock>q.clock&&(clock-q.clock)%50===0&&(clock-q.clock)/50<=40);
assert.deepEqual({unitId:next.crossing.unitId,agentId:next.crossing.agentId},alias);assert.equal(receipt.ownerRevision,6);assert.deepEqual(receipt.owner,alias);assert.deepEqual(receipt.home,home);
for(const row of [next.captured,next.marker,saved.captured,saved.marker])await bound(row);
assert.equal(next.captured.sha256,ready.sha256);assert.equal(next.captured.bytes,ready.size);assert.equal(await readFile(next.marker.filename,'utf8'),next.nativeManifest);
assert.equal(next.nativeManifest,['checkpoint-v1','1',ready.size,ready.sha256,
 '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
const oldIo=await stoppedHeroRouteStorage(next.beforeJournal,{}),oldStore=new HeroRouteStore(oldIo,first.identity,first.identity.contentDigest);
await oldStore.withOwner(async v=>{assert.equal(v.record.manifest,q.ownerManifest);assert.equal(v.record.revision,5);assert.deepEqual(v.entry.alias,alias);assert.deepEqual(v.entry.homeAlias,home);
 assert.equal(await checkpointSavedClock(v.source),q.clock);assert.equal(selectedHeroRuntimeBinding(first.identity,v.entry,q.clock),next.runtimeBinding);});
assert.deepEqual(await requireCheckpointHeroCrossing(await stoppedFileSource(next.captured.filename),next.runtimeBinding,next.crossing),next.travel);
const capturedJournal=await heroRepeatedCaptureJournalView(m,next);assert.deepEqual((await readdir(capturedJournal)).sort(),Object.keys(next.journalSha256).sort());
for(const[n,h]of Object.entries(next.journalSha256))assert.equal(await hash(join(capturedJournal,n)),h);
assert.equal(await readFile(join(capturedJournal,HERO_ROUTE_HEAD),'utf8'),receipt.ownerManifest);
const changed=Object.keys(next.journalSha256).filter(n=>next.journalSha256[n]!==saved.journalSha256[n]).sort();
assert.deepEqual(changed,['Frontier_Hero_Route.checkpoint','Frontier_Hero_Route_0_0_1.GMP','Frontier_Hero_Route_Node_6.json']);
for(const[n,h]of Object.entries(saved.journalSha256))if(!changed.includes(n))assert.equal(next.journalSha256[n],h);
const node=await json(join(capturedJournal,'Frontier_Hero_Route_Node_6.json'));
assert.deepEqual(node.previous,JSON.parse(q.ownerManifest));assert.equal(node.kind,'save');assert.equal(node.ownerRegion,'0_0');assert.equal(node.revision,6);
assert.deepEqual(node.changes,[{region:'0_0',slot:1,alias,homeAlias:home,world:{size:ready.size,sha256:ready.sha256}}]);
const head=JSON.parse(receipt.ownerManifest);assert.equal(head.nodeSha256,await hash(join(capturedJournal,'Frontier_Hero_Route_Node_6.json')));
const io=await stoppedHeroRouteStorage(capturedJournal,{}),store=new HeroRouteStore(io,first.identity,first.identity.contentDigest),opened=[],realOpen=io.open;io.open=async n=>{opened.push(n);return realOpen(n);};let escaped;
await store.withOwner(async v=>{assert.equal(v.record.manifest,receipt.ownerManifest);assert.equal(v.record.revision,6);assert.equal(v.owner.region,'0_0');assert.deepEqual(v.entry.alias,alias);assert.deepEqual(v.entry.homeAlias,home);
 assert.equal(await checkpointSavedClock(v.source),clock);assert.equal(v.entry.world.sha256,ready.sha256);escaped=v.source;});await assert.rejects(escaped.readAt(0,16),/lease ended/);
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_0_1.GMP']);
const rows=[next.captured,...['Hero_Repeat_Source_Before','Hero_Repeat_Source_Refused','Hero_Repeat_Source_Retired'].map(n=>m.repeatRetirementWorlds[n])],sources=[],maps=[],states=[];
async function records(s){const map=new Map(),add=(key,row)=>{assert.ok(!map.has(key)&&map.size<4096);map.set(key,row);};
 for await(const row of checkpointUnits(s))add('UNIT:'+row.primary.words[1],row);for await(const row of checkpointAgents(s))add('GPL:'+row.agentId,row);
 for await(const row of checkpointAttachments(s))add(row.kind+':'+row.unitId,row);return map;}
async function exact(a,ra,b,rb,key){assert.ok(ra&&rb,key);assert.equal(ra.size,rb.size,key);for(let at=0;at<ra.size;at+=4096){const n=Math.min(4096,ra.size-at);assert.deepEqual(await a.readAt(ra.offset+at,n),await b.readAt(rb.offset+at,n),key);}}
for(const row of rows){await bound(row);const source=await stoppedFileSource(row.filename);sources.push(source);maps.push(await records(source));states.push(await connectedWorldState(row.filename));assert.equal(states.at(-1).clock,clock);}
let exactRecordComparisons=0;for(const i of [1,2]){assert.deepEqual([...maps[0].keys()].sort(),[...maps[i].keys()].sort());assert.deepEqual(states[0].roots,states[i].roots);
 for(const[key,row]of maps[0]){await exact(sources[0],row,sources[i],maps[i].get(key),key);exactRecordComparisons++;}}
const before=sources[2],after=sources[3],old=maps[2],now=maps[3],removed=['UNIT:'+alias.unitId,'GPL:'+alias.agentId,'CONT:'+alias.unitId,'ORDR:'+alias.unitId];
for(const key of removed)assert.ok(old.has(key));assert.deepEqual([...now.keys()].sort(),[...old.keys()].filter(k=>!removed.includes(k)).sort());
for(const[key,row]of now)if(!['GPL:'+home.agentId,'CONT:'+home.unitId].includes(key)){await exact(before,old.get(key),after,row,key);exactRecordComparisons++;}
await verifyRegisteredHeroSnapshot(first.identity,alias,home,before,true,'0_0');await verifyRegisteredHeroSnapshot(first.identity,alias,home,after,false,'0_0');
let pose;for await(const row of checkpointPlacements(sources[0]))if(row.unitId===alias.unitId){assert.equal(pose,undefined);pose=row.fixedPosition;}assert.deepEqual(pose,next.crossing.accepted);
const values=[];for await(const v of checkpointAgentValues(before,home.agentId))if(v.attribute==='members')values.push(v);
const list=values.find(v=>!v.path.length),children=values.filter(v=>v.path.length&&v.targetAgentId===alias.agentId);
assert.ok(list&&list.type===4&&list.childCount>0);assert.equal(children.length,1);assert.equal(children[0].type,5);const child=children[0],guild=old.get('GPL:'+home.agentId);
const memberships=[];for await(const v of checkpointContainerEntries(before))if(v.unitId===home.unitId&&v.groupKind===100)memberships.push(v);
const group=memberships.find(v=>v.type==='group'),members=memberships.filter(v=>v.type==='member'&&v.targetUnitId===alias.unitId);
assert.ok(group&&group.memberCount>0);assert.equal(members.length,1);assert.equal(members[0].flags,1);const container=old.get('CONT:'+home.unitId);
const queueRows=[];for await(const v of checkpointAgentQueues(before))if(v.agentId===alias.agentId)queueRows.push(v);assert.equal(queueRows.length,1);const queued=queueRows[0];
async function queues(s){const out=[];for await(const v of checkpointAgentQueues(s))out.push(v.type==='queued-agent'?{type:v.type,queue:v.queue,agentId:v.agentId}:{type:v.type,activeQueue:v.activeQueue});return out;}
assert.deepEqual(await queues(after),(await queues(before)).filter(v=>v.agentId!==alias.agentId));assert.equal(await checkpointNextAgentId(after),await checkpointNextAgentId(before));
assert.equal((await checkpointAbsentAgentReferences(after,alias.agentId)).sites.length,0);
for await(const row of checkpointUnits(after))assert.notEqual(row.primary.words[6],alias.unitId);
for await(const row of checkpointContainerEntries(after))for(const k of ['unitId','groupOwnerUnitId','targetUnitId'])assert.notEqual(row[k],alias.unitId);
let orderReferencesChecked=0;for(const[key,row]of now)if(key.startsWith('ORDR:'))for await(const ref of checkpointActorOrderUnitReferences(after,row.unitId)){assert.notEqual(ref.targetUnitId,alias.unitId);orderReferencesChecked++;}
const changedRoots=['GPL ','VHCL','CONT','ORDR','ORLS'];for(const k of ['clock','rng','gameplayRng','rawTerrainSha256'])assert.equal(states[2][k],states[3][k]);
assert.deepEqual(states[2].roots.filter(v=>!changedRoots.includes(v.tag)),states[3].roots.filter(v=>!changedRoots.includes(v.tag)));
async function roots(s){const map=new Map();for await(const v of checkpointChunks(s))if(changedRoots.includes(v.tag)){assert.ok(!map.has(v.tag));map.set(v.tag,v);}return map;}
const br=await roots(before),ar=await roots(after);
async function reconstructRoot(tag,removals,changes){const b=br.get(tag),a=ar.get(tag);assert.ok(a&&b);assert.equal(a.version,b.version);
 const drops=removals.map(r=>({at:r.offset-b.offset,size:r.size})).sort((x,y)=>x.at-y.at),delta=drops.reduce((n,v)=>n+v.size,0);assert.equal(a.size,b.size-delta);
 const patches=[];for(const[offset,increment]of [[b.offset+4,-delta],...changes]){const bytes=Buffer.from(await before.readAt(offset,4));bytes.writeUInt32LE(bytes.readUInt32LE(0)+increment,0);patches.push({at:offset-b.offset,bytes});}
 let at=0,to=0,index=0;while(at<b.size+16){if(index<drops.length&&at===drops[index].at){at+=drops[index++].size;continue;}
  const n=Math.min(4096,b.size+16-at,index<drops.length?drops[index].at-at:Infinity);assert.ok(n>0);const bytes=Uint8Array.from(await before.readAt(b.offset+at,n));
  for(const p of patches)for(let j=0;j<4;j++)if(p.at+j>=at&&p.at+j<at+n)bytes[p.at+j-at]=p.bytes[j];
  assert.deepEqual(await after.readAt(a.offset+to,n),bytes,tag+' byte '+at);at+=n;to+=n;}assert.equal(index,drops.length);assert.equal(to,a.size+16);
}
for(const[tag,key]of [['VHCL','UNIT:'+alias.unitId],['ORDR','ORDR:'+alias.unitId]]){assert.equal(ar.get(tag).count,br.get(tag).count-1);await reconstructRoot(tag,[old.get(key)],[[br.get(tag).offset+12,-1]]);}
const cont=br.get('CONT');assert.equal(ar.get('CONT').count,cont.count-1);
await reconstructRoot('CONT',[old.get('CONT:'+alias.unitId),{offset:members[0].offset,size:8}],
 [[cont.offset+12,-1],[container.offset+8,-8],[container.primary.offset+4,-8],[group.offset+4,-1]]);
const gpl=br.get('GPL '),agent=old.get('GPL:'+alias.agentId),agentRows=[];for await(const row of checkpointAgents(before))agentRows.push(row);
assert.equal(Buffer.from(await before.readAt(agent.offset-4,4)).readUInt32LE(0),alias.agentId);assert.equal(ar.get('GPL ').count,gpl.count);
const delta=agent.size+4+4+8;
await reconstructRoot('GPL ',[{offset:agent.offset-4,size:agent.size+4},{offset:queued.offset,size:4},{offset:child.typeOffset,size:8}],
 [[gpl.offset+16,-delta],[gpl.offset+28,-delta],[agentRows[0].offset-8,-1],[queued.offset-(queued.index+1)*4,-1],
 [guild.offset,-8],[guild.offset+8,-8],[list.typeOffset+4,-8],[list.typeOffset+12,-1]]);
const or=br.get('ORLS'),ids=[];assert.equal(or.version,1);assert.equal(or.size,(or.count+1)*4);
for(let at=0;at<or.size;at+=4096){const bytes=Buffer.from(await before.readAt(or.offset+16+at,Math.min(4096,or.size-at)));for(let j=0;j<bytes.length;j+=4)ids.push({id:bytes.readUInt32LE(j),offset:or.offset+16+at+j});}
assert.equal(ids.shift().id,0x5244524f);assert.equal(new Set(ids.map(v=>v.id)).size,ids.length);const id=ids.filter(v=>v.id===alias.unitId);assert.equal(id.length,1);assert.equal(ar.get('ORLS').count,or.count-1);
await reconstructRoot('ORLS',[{offset:id[0].offset,size:4}],[[or.offset+12,-1]]);
assert.deepEqual(next.controls.map(v=>v.kind),['wrong-clock','old-native-alias','wrong-guild','changed-capture-digest','previous-home-save']);assert.ok(next.controls.every(v=>v.refusedByEngine&&v.clock===clock&&v.phase===7&&v.pending===0));
assert.equal(next.exactRetryWrites,0);assert.ok(next.stats.largestRead<=4096&&next.stats.largestWrite<=4096&&next.stats.peakReads===1&&next.stats.activeReads===0);
assert.equal(next.acknowledgement,nativeHeroArrivalPublished(next.ready,receipt.ownerManifest).replace(/^majesty-hero-travel-published-v1\|/,'majesty-hero-capture-published-v1|'));
const log=await readFile(m.log,'utf8');assert.equal(await hash(m.log),m.logSha256);assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from|GplException/.test(log));
const resumed=`[frontier] Hero home departure resumed serial=3 region=0_0 unit=${alias.unitId} agent=${alias.agentId} home=${home.unitId}/${home.agentId} clock=${q.clock} original-resume=1 fresh-native-binding=1 phase=3 pending=0 result=pass`;
const move=`[streaming] Selected hero original move unit=${alias.unitId} agent=${alias.agentId} clock=${q.clock} point=4064,272 original-command=005b4870 pose-written=0 task-preserved=1 ungated-ai=1 result=pass`;
const held=`[frontier] Hero save held serial=4 region=0_0 clock=${clock} slot=1 bytes=${ready.size} sha256=${ready.sha256} phase=7 pending=0`;
const refused=`[frontier] Hero captured publication refused serial=4 region=0_0 clock=${clock} phase=7 pending=0`;
const lifetime=`[streaming] Selected native hero lifetime ended unit=${alias.unitId} agent=${alias.agentId} home=${home.unitId}/${home.agentId} clock=${clock} arrival-hooks-removed=0 active-binding-ended=1 result=pass`;
const retired=`[frontier] Hero repeated source retirement completed serial=4 region=0_0 unit=${alias.unitId} agent=${alias.agentId} home=${home.unitId}/${home.agentId} clock=${clock} manifest-sha256=${next.acknowledgement.trim().split('|').at(-1)} captured-journal-selected=1 captured-save-preserved=1 retired-saved=1 wrong-clock-refused=1 wrong-alias-refused=1 wrong-home-refused=1 duplicate-refused=1 active-binding-ended=1 phase=7 pending=0 result=pass`;
for(const line of [resumed,move,held,lifetime,retired])assert.equal(log.split(line).length-1,1);assert.equal(log.split(refused).length-1,5);
assert.ok(log.indexOf(resumed)<log.indexOf(move)&&log.indexOf(move)<log.indexOf(held)&&log.indexOf(held)<log.indexOf(refused)&&log.lastIndexOf(refused)<log.indexOf(lifetime)&&log.indexOf(lifetime)<log.indexOf(retired));
const resources=[...log.matchAll(new RegExp(`^\\[streaming\\] Selected hero retired unit=${alias.unitId} agent=${alias.agentId} home=${home.unitId}/${home.agentId} clock=${clock} .*released-bytes=(\\d+) released-blocks=(\\d+) released-crt=(\\d+) owner-published=0 result=pass$`,'gm'))];
assert.equal(resources.length,1);assert.ok(resources[0].slice(1).map(Number).every(n=>n>0));
let captureAcknowledgement=join(m.fixture,'frontier_0_0/Frontier_Hero_Capture_Published.txt');
if(m.saveRepeatHome){await bound(m.repeatHomePageInput);const stage=await json(m.repeatHomePageInput.filename);
 assert.equal(stage.nativePid,m.nativePid);assert.equal(stage.fixture,m.fixture);await bound(stage.firstRepeatCaptureAcknowledgement);captureAcknowledgement=stage.firstRepeatCaptureAcknowledgement.filename;}
assert.equal(await readFile(captureAcknowledgement,'utf8'),next.acknowledgement);
const sourceSha256={...q.sourceSha256},pending=[resolve('scripts/inspect-native-hero-repeat-departure.mjs')],seen=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(seen.has(name))continue;seen.add(name);assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&seen.size<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);const h=await hash(n);if(sourceSha256[name])assert.equal(sourceSha256[name],h);sourceSha256[name]=h;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,nativeConnectedRepeatedHeroDepartureQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 homeSaveQualification:{filename:resolve(saveName),sha256:await hash(saveName)},sourceSha256,repeatDeparturePublication:m.repeatDeparturePublication,
 actualAlias:alias,homeAlias:home,clock,originalOutwardTicks:(clock-q.clock)/50,crossing:next.crossing,captured:next.captured,retired:rows[3],
 ownerRevision:6,ownerManifest:receipt.ownerManifest,changedJournalFiles:changed,exactRecordComparisons,completeChangedRootsQualified:true,
 nativeGuildRostersRemovedReciprocally:true,remainingQueuesExact:true,noIncomingTypedReferences:true,orderReferencesChecked,
 recoveredCapturePreserved:true,retiredRuntimeBindingEnded:true,refusedNativeReceipts:5,exactRetryWrites:0,
 nativeSessionTerminal:true,publicationWorkerTerminal:true,singleNativeProcess:true,sourceUnloaded:false,nextArrivalImported:false,
 browserUsed:false,realOPFSDurabilityQualified:false,repeatedFullTripsQualified:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeConnectedRepeatedHeroDepartureQualified:true,ownerRevision:6,clock,originalOutwardTicks:(clock-q.clock)/50,exactRecordComparisons,retiredRuntimeBindingEnded:true}));
