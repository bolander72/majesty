#!/usr/bin/env node
// Independent full-world verification of original retirement of the current
// remote-home traveller after its second accepted capture is journaled.
import assert from 'node:assert/strict';
import {heroRepeatedReturnJournalView} from './lib/hero-captured-journal-view.mjs';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointChunks,checkpointAgentQueues,
 checkpointContainerEntries,checkpointAbsentAgentReferences,checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderUnitReferences} from '../web/world/order-unit-bindings.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {nativeHeroArrivalReady,nativeHeroArrivalPublished} from '../web/world/hero-travel-publication.mjs';
import {requireCheckpointHeroCrossing} from '../web/world/hero-travel-boundary.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {selectedHeroRuntimeBinding} from '../web/world/hero-runtime-binding.mjs';

const [manifestName,captureName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-repeat-return-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
async function bound(r){assert.equal((await lstat(r.filename)).size,r.bytes);assert.equal(await hash(r.filename),r.sha256);}
const m=await json(manifestName),continued=await json(captureName);
assert.equal(continued.nativeConnectedContinuedHeroNeighborSaveQualified,true);assert.equal(continued.manifest.filename,resolve(manifestName));assert.equal(continued.manifest.sha256,await hash(manifestName));
for(const[n,h]of Object.entries(continued.sourceSha256))assert.equal(await hash(n),h);
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.repeatReturn,true);assert.equal(m.nativeSelectedHeroRepeatReturnBoundaryObserved,true);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
assert.equal(m.publicationWorkerTerminal,true);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.publicationWorkerAbsent,true);
assert.equal(m.nativeProcessesStarted,1);assert.equal(m.browserUsed,false);assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
for(const r of [m.publication,m.repeatReturnPublication,m.repeatNeighborSavePublication])await bound(r);
const p=await json(m.publication.filename),second=await json(m.repeatReturnPublication.filename);
assert.equal(second.nativeRepeatedHeroReturnCapturePublished,true);assert.equal(second.nativePid,m.nativePid);assert.equal(second.fixture,m.fixture);
assert.equal(second.expectedManifest,continued.ownerManifest);assert.equal(second.publicationReceipt.ownerRevision,9);
assert.deepEqual(second.publicationReceipt.owner,continued.actualAlias);assert.deepEqual(second.publicationReceipt.home,continued.homeAlias);
for(const k of ['filename','bytes','sha256'])assert.equal(second.neighborSavePublication[k],m.repeatNeighborSavePublication[k]);
const lines=await readFile(m.log,'utf8'),completions=lines.split('\n').filter(v=>v.startsWith('[frontier] Hero remote source retirement completed serial=6 region=1_0 '));assert.equal(completions.length,1);
const capture={...second,owner:second.publicationReceipt.owner,homeAlias:second.publicationReceipt.home,
 ownerManifest:second.publicationReceipt.ownerManifest,nativeMarker:second.marker,sourceSha256:continued.sourceSha256};
const ack={acknowledgement:second.acknowledgement,controls:second.controls,completion:completions[0]};
assert.deepEqual(await requireCheckpointHeroCrossing(await stoppedFileSource(second.captured.filename),second.runtimeBinding,second.crossing),second.travel);
assert.equal(second.crossing.region,'1_0');assert.equal(second.crossing.target,'0_0');assert.equal(second.crossing.previousClock,second.crossing.clock-50);
assert.ok(second.crossing.clock>continued.clock&&(second.crossing.clock-continued.clock)%50===0&&(second.crossing.clock-continued.clock)/50<=40);
const capturedJournal=await heroRepeatedReturnJournalView(m,second);assert.deepEqual((await readdir(capturedJournal)).sort(),Object.keys(second.journalSha256).sort());
for(const[n,h]of Object.entries(second.journalSha256))assert.equal(await hash(join(capturedJournal,n)),h);
assert.equal(await readFile(join(capturedJournal,HERO_ROUTE_HEAD),'utf8'),capture.ownerManifest);
const node=await json(join(capturedJournal,'Frontier_Hero_Route_Node_9.json'));assert.equal(node.kind,'save');assert.equal(node.ownerRegion,'1_0');assert.equal(node.revision,9);
assert.deepEqual(node.previous,JSON.parse(continued.ownerManifest));assert.deepEqual(node.changes,[{region:'1_0',slot:1,alias:capture.owner,homeAlias:capture.homeAlias,world:{size:capture.captured.bytes,sha256:capture.captured.sha256}}]);
assert.equal(JSON.parse(capture.ownerManifest).nodeSha256,await hash(join(capturedJournal,'Frontier_Hero_Route_Node_9.json')));
assert.deepEqual(second.beforeJournalSha256,(await json(m.repeatNeighborSavePublication.filename)).journalSha256);
for(const[n,h]of Object.entries(second.beforeJournalSha256))assert.equal(await hash(join(second.beforeJournal,n)),h);
const oldStore=new HeroRouteStore(await stoppedHeroRouteStorage(second.beforeJournal,{}),p.identity,p.identity.contentDigest);
await oldStore.withOwner(async v=>{assert.equal(v.record.manifest,continued.ownerManifest);assert.equal(selectedHeroRuntimeBinding(p.identity,v.entry,continued.clock),second.runtimeBinding);});
const store=new HeroRouteStore(await stoppedHeroRouteStorage(capturedJournal,{}),p.identity,p.identity.contentDigest);let escaped;
await store.withOwner(async v=>{assert.equal(v.record.manifest,capture.ownerManifest);assert.deepEqual(v.entry.alias,capture.owner);assert.deepEqual(v.entry.homeAlias,capture.homeAlias);assert.equal(await checkpointSavedClock(v.source),capture.crossing.clock);assert.equal(v.entry.world.sha256,capture.captured.sha256);escaped=v.source;});
await assert.rejects(escaped.readAt(0,16),/lease ended/);assert.equal(second.exactRetryWrites,0);
const alias={unitId:capture.owner.unitId,agentId:capture.owner.agentId},home=capture.homeAlias,clock=capture.crossing.clock;
assert.equal(home.kind,'proxy');assert.equal(home.unitId,0);assert.equal(home.agentId,38);assert.equal(clock,4650);
const readyFields={serial:6,region:'1_0',clock,...alias,homeAgentId:home.agentId,size:capture.captured.bytes,sha256:capture.captured.sha256};
const receipt=(fields,manifest)=>nativeHeroArrivalPublished(nativeHeroArrivalReady(fields),manifest).replace(/^majesty-hero-travel-published-v1\|/,'majesty-hero-capture-published-v1|');
assert.equal(ack.acknowledgement,receipt(readyFields,capture.ownerManifest));
const captureAck=join(m.fixture,'frontier_1_0/Frontier_Hero_Capture_Published.txt');
assert.equal(await readFile(captureAck,'utf8'),ack.acknowledgement);
assert.deepEqual(ack.controls.map(c=>c.kind),['wrong-clock','old-native-alias','wrong-guild','changed-capture-digest','previous-neighbor-save']);
const controlled=[receipt({...readyFields,clock:clock+50},capture.ownerManifest),receipt({...readyFields,unitId:508,agentId:25},capture.ownerManifest),
 receipt({...readyFields,homeAgentId:7},capture.ownerManifest),receipt({...readyFields,sha256:'0'.repeat(64)},capture.ownerManifest),receipt(readyFields,continued.ownerManifest)];
assert.deepEqual(ack.controls.map(c=>c.acknowledgement),controlled);assert.ok(ack.controls.every(c=>c.refusedByEngine&&c.clock===clock&&c.phase===7&&c.pending===0));
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from|GplException/.test(log));
const held='[frontier] Hero save held serial=6 region=1_0 clock='+clock;
const refused='[frontier] Hero captured publication refused serial=6 region=1_0 clock='+clock+' phase=7 pending=0';
assert.equal(log.split(refused).length-1,5);assert.equal(log.split(ack.completion).length-1,1);assert.ok(log.indexOf(held)<log.indexOf(refused)&&log.lastIndexOf(refused)<log.indexOf(ack.completion));
const lifetime=`[streaming] Selected remote hero lifetime ended unit=${alias.unitId} agent=${alias.agentId} proxy=${home.agentId} clock=${clock} proxy-primary-preserved=1 arrival-hooks-removed=1 active-binding-ended=1 result=pass`;
assert.equal(log.split(lifetime).length-1,1);assert.ok(log.lastIndexOf(refused)<log.indexOf(lifetime)&&log.indexOf(lifetime)<log.indexOf(ack.completion));
assert.ok(!/Hero save (?:released|resumed|abandoned) serial=6/.test(log));
assert.ok(ack.completion.endsWith('captured-journal-selected=1 captured-save-preserved=1 retired-saved=1 wrong-clock-refused=1 wrong-alias-refused=1 wrong-home-refused=1 duplicate-refused=1 binding-closed=1 phase=7 pending=0 retired-pair-published=0 result=pass'));
const descriptorRows=[capture.captured,...['Hero_Repeat_Remote_Source_Before','Hero_Repeat_Remote_Source_Refused','Hero_Repeat_Remote_Source_Retired'].map(n=>m.repeatRemoteRetirementWorlds[n])];
const sources=[],maps=[],states=[];
async function records(s){const rows=new Map();const add=(key,r)=>{assert.ok(rows.size<4096&&!rows.has(key));rows.set(key,r);};
 for await(const r of checkpointUnits(s))add('UNIT:'+r.primary.words[1],r);
 for await(const r of checkpointAgents(s))add('GPL:'+r.agentId,r);
 for await(const r of checkpointAttachments(s))add(r.kind+':'+r.unitId,r);return rows;}
async function exact(s,a,t,b,label){assert.ok(a&&b,label);assert.equal(b.size,a.size,label);
 for(let at=0;at<a.size;at+=4096){const n=Math.min(4096,a.size-at);assert.deepEqual(await s.readAt(a.offset+at,n),await t.readAt(b.offset+at,n),label+' byte '+at);}}
for(const row of descriptorRows){await bound(row);assert.ok(row.filename.startsWith(join(m.fixture,'frontier_1_0/Documents/My Games/MajestyHD/SaveGame')+'/'));
 const s=await stoppedFileSource(row.filename);sources.push(s);maps.push(await records(s));states.push(await connectedWorldState(row.filename,{unscheduledAgents:[34,home.agentId]}));
 assert.equal(await checkpointSavedClock(s),clock);}
let exactRecordComparisons=0;
for(let i=1;i<3;i++){assert.deepEqual([...maps[i].keys()].sort(),[...maps[0].keys()].sort());
 for(const[key,r]of maps[0]){await exact(sources[0],r,sources[i],maps[i].get(key),key);exactRecordComparisons++;}assert.deepEqual(states[i].roots,states[0].roots);}
const before=sources[2],after=sources[3],old=maps[2],now=maps[3];
const removed=['UNIT:'+alias.unitId,'GPL:'+alias.agentId,'CONT:'+alias.unitId,'ORDR:'+alias.unitId];
assert.deepEqual([...now.keys()].sort(),[...old.keys()].filter(k=>!removed.includes(k)).sort());
for(const key of removed){assert.ok(old.has(key),key);assert.equal(now.has(key),false,key);}
for(const[key,r]of now){await exact(before,old.get(key),after,r,key);exactRecordComparisons++;}
await verifyRegisteredHeroSnapshot(p.identity,alias,home,after,false,'1_0');
assert.equal((await checkpointAbsentAgentReferences(after,alias.agentId)).sites.length,0);
for await(const r of checkpointUnits(after))assert.notEqual(r.primary.words[6],alias.unitId,'Dangling physical parent');
for await(const r of checkpointContainerEntries(after))for(const k of ['unitId','groupOwnerUnitId','targetUnitId'])assert.notEqual(r[k],alias.unitId,'Dangling container');
let orderReferencesChecked=0;for(const[key,r]of now)if(key.startsWith('ORDR:'))for await(const v of checkpointActorOrderUnitReferences(after,r.unitId)){
 assert.notEqual(v.targetUnitId,alias.unitId,'Dangling typed order reference');orderReferencesChecked++;}
async function queues(s){const out=[];for await(const q of checkpointAgentQueues(s))out.push(q.type==='queued-agent'?{type:q.type,queue:q.queue,agentId:q.agentId}:{type:q.type,activeQueue:q.activeQueue});return out;}
const queueBefore=await queues(before);assert.equal(queueBefore.filter(v=>v.agentId===alias.agentId).length,1);
assert.deepEqual(await queues(after),queueBefore.filter(v=>v.agentId!==alias.agentId));
assert.equal(await checkpointNextAgentId(before),await checkpointNextAgentId(after));
for(const key of ['clock','rng','gameplayRng','rawTerrainSha256'])assert.equal(states[2][key],states[3][key]);
const changed=['VHCL','GPL ','CONT','ORDR','ORLS'];assert.deepEqual(states[3].roots.filter(r=>!changed.includes(r.tag)),states[2].roots.filter(r=>!changed.includes(r.tag)));
async function roots(s){const out=new Map();for await(const r of checkpointChunks(s))if(changed.includes(r.tag)){assert.ok(!out.has(r.tag));out.set(r.tag,r);}return out;}
const br=await roots(before),ar=await roots(after);
async function changedRoot(tag,removals,changes){const b=br.get(tag),a=ar.get(tag);assert.ok(a&&b);assert.equal(a.version,b.version);
 const drops=removals.map(r=>({at:r.offset-b.offset,size:r.size})).sort((x,y)=>x.at-y.at),delta=drops.reduce((n,r)=>n+r.size,0);
 assert.equal(a.size,b.size-delta);const patches=[];
 for(const[offset,increment]of [[b.offset+4,-delta],...changes]){const bytes=Buffer.from(await before.readAt(offset,4));bytes.writeUInt32LE(bytes.readUInt32LE(0)+increment,0);patches.push({at:offset-b.offset,bytes});}
 let at=0,to=0,index=0;while(at<b.size+16){if(index<drops.length&&at===drops[index].at){at+=drops[index++].size;continue;}
  const n=Math.min(4096,b.size+16-at,index<drops.length?drops[index].at-at:Infinity);assert.ok(n>0);const bytes=Uint8Array.from(await before.readAt(b.offset+at,n));
  for(const patch of patches)for(let j=0;j<4;j++)if(patch.at+j>=at&&patch.at+j<at+n)bytes[patch.at+j-at]=patch.bytes[j];
  assert.deepEqual(await after.readAt(a.offset+to,n),bytes,tag+' byte '+at);at+=n;to+=n;}
 assert.equal(index,drops.length);assert.equal(to,a.size+16);
}
for(const[tag,key]of [['VHCL','UNIT:'+alias.unitId],['CONT','CONT:'+alias.unitId],['ORDR','ORDR:'+alias.unitId]]){
 assert.equal(ar.get(tag).count,br.get(tag).count-1);await changedRoot(tag,[old.get(key)],[[br.get(tag).offset+12,-1]]);}
const qs=[];for await(const q of checkpointAgentQueues(before))if(q.agentId===alias.agentId)qs.push(q);assert.equal(qs.length,1);
const q=qs[0],g=br.get('GPL '),agentRows=[];for await(const a of checkpointAgents(before))agentRows.push(a);
const removedAgent=old.get('GPL:'+alias.agentId),gplDelta=removedAgent.size+4+4;
assert.equal(Buffer.from(await before.readAt(removedAgent.offset-4,4)).readUInt32LE(0),alias.agentId);assert.equal(ar.get('GPL ').count,g.count);
await changedRoot('GPL ',[{offset:removedAgent.offset-4,size:removedAgent.size+4},{offset:q.offset,size:4}],
 [[g.offset+16,-gplDelta],[g.offset+28,-gplDelta],[agentRows[0].offset-8,-1],[q.offset-(q.index+1)*4,-1]]);
const or=br.get('ORLS'),ids=[];assert.equal(or.version,1);assert.equal(or.size,(or.count+1)*4);
for(let at=0;at<or.size;at+=4096){const bytes=Buffer.from(await before.readAt(or.offset+16+at,Math.min(4096,or.size-at)));
 for(let j=0;j<bytes.length;j+=4)ids.push({id:bytes.readUInt32LE(j),offset:or.offset+16+at+j});}
assert.equal(ids.shift().id,0x5244524f);assert.equal(new Set(ids.map(v=>v.id)).size,ids.length);const removal=ids.filter(v=>v.id===alias.unitId);assert.equal(removal.length,1);
assert.equal(ar.get('ORLS').count,or.count-1);await changedRoot('ORLS',[{offset:removal[0].offset,size:4}],[[or.offset+12,-1]]);
const resource=[...log.matchAll(/^\[streaming\] Selected hero retired unit=539 agent=40 home=0\/38 clock=4650 .*released-bytes=(\d+) released-blocks=(\d+) released-crt=(\d+) owner-published=0 result=pass$/gm)];
assert.equal(resource.length,1);const released=resource[0].slice(1).map(Number);assert.ok(released.every(n=>n>0));
assert.equal(second.sourceUnloaded,false);assert.equal(second.nextArrivalImported,false);
await bound(capture.captured);await bound(capture.nativeMarker);
assert.deepEqual((await readdir(capturedJournal)).sort(),Object.keys(second.journalSha256).sort());
for(const[n,h]of Object.entries(second.journalSha256))assert.equal(await hash(join(capturedJournal,n)),h);
const sourceSha256={...capture.sourceSha256},pending=[resolve('scripts/inspect-native-hero-repeat-return.mjs')],seen=new Set();
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(seen.has(name))continue;seen.add(name);assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&seen.size<256);
 const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);const h=await hash(n);if(sourceSha256[name])assert.equal(sourceSha256[name],h);sourceSha256[name]=h;
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,capturedJournalIsHistorical:m.publishRepeatHome===true,nativeConnectedRepeatedHeroReturnQualified:true,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},
 captureQualification:{filename:resolve(captureName),sha256:await hash(captureName)},sourceSha256,capturedWorld:capture.captured,retiredWorld:descriptorRows[3],
 ownerManifest:capture.ownerManifest,originalHomewardTicks:(clock-continued.clock)/50,crossing:capture.crossing,clock,removedUnitId:alias.unitId,removedAgentId:alias.agentId,registeredRemoteHome:home,exactRecordComparisons,remainingRecords:now.size,
 allRefusalsPreserveGameplay:true,completeChangedRootsQualified:true,remainingQueuesExact:true,noIncomingTypedReferences:true,orderReferencesChecked,
 remoteHomeRecordExact:true,otherRecordsExact:true,otherRootsExact:true,terrainRngClockExact:true,capturedRecoveryPreserved:true,
 stalePublicationReceiptControls:5,wrongClockAliasHomeRetirementControls:3,duplicateRetirementRefused:true,activeBindingEnded:true,arrivalHooksRemoved:1,
 releasedBytes:released[0],releasedBlocks:released[1],releasedCrtAllocations:released[2],capturedJournalRevision:9,retiredPairPublished:false,sourceUnloaded:false,secondDestinationLoaded:false,
 nativeSessionTerminal:true,ownedProducerAbsent:true,publicationWorkerTerminal:true,publicationWorkerAbsent:true,
 elapsedMs:m.finishedAtMs-m.startedAtMs,peakSampledNativeAndPublisherRssBytes:Math.max(...m.resourceSamples.map(v=>v.rssBytes)),browserUsed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeConnectedRepeatedHeroReturnQualified:true,clock,remainingRecords:now.size,exactRecordComparisons,arrivalHooksRemoved:1,retiredPairPublished:false}));
