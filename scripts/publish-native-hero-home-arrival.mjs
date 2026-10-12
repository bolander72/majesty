#!/usr/bin/env node
// Qualify returned-owner paired publication using the actual connected native
// saves in disposable journals. No live acknowledgement or browser claim.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir,mkdtemp,open} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {nativeHeroArrivalReady,publishHeldNativeHeroArrival} from '../web/world/hero-travel-publication.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {Sha256} from '../web/world/sha256.mjs';

const [archiveName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-hero-home-publication-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function bound(v){assert.equal((await lstat(v.filename)).size,v.bytes);assert.equal(await hash(v.filename),v.sha256);}
const archive=await json(archiveName);assert.equal(archive.nativeConnectedHeroHomeActivationQualified,true);
const proof=archive.qualification;assert.equal(proof.nativeConnectedHeroHomeActivationQualified,true);
for(const row of [...archive.sources,...archive.evidence]){await bound({filename:row.preserved,bytes:row.bytes,sha256:row.sha256});}
function evidence(n,digest){const row=archive.evidence.find(v=>v.original===resolve(n));assert.ok(row);if(digest)assert.equal(row.sha256,digest);return row.preserved;}
const m=await json(evidence(proof.manifest.filename,proof.manifest.sha256));
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.publicationWorkerTerminal,true);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
const first=await json(evidence(m.publication.filename,m.publication.sha256)),second=await json(evidence(m.secondPublication.filename,m.secondPublication.sha256));
const identity=first.identity,captured=second.captured,retired=m.remoteSourceRetirementSaves.Hero_Remote_Source_Retired,active=proof.activeWorld;
const imported=m.homeArrivalWorlds.Hero_Return_Home_Imported,absent=m.homePageSnapshot;
const sourceAlias={unitId:538,agentId:39},sourceHome={kind:'proxy',unitId:0,agentId:38},targetAlias=proof.actualAlias,targetHome=proof.homeAlias;
assert.deepEqual(targetAlias,{unitId:513,agentId:29});assert.deepEqual(targetHome,{kind:'native',unitId:469,agentId:7});
for(const row of [captured,retired,active,imported,absent]){
 await bound(row);assert.ok(archive.snapshots.some(v=>v.filename===row.filename&&v.sha256===row.sha256&&v.bytes===row.bytes));
}
const seed=second.journal,seedNames=Object.keys(second.journalSha256).sort();
async function unchangedSeed(){assert.deepEqual((await readdir(seed)).sort(),seedNames);
 for(const [n,digest]of Object.entries(second.journalSha256))assert.equal(await hash(join(seed,n)),digest);
 for(const row of [captured,retired,active,imported,absent])await bound(row);
}
const operation=parts=>new Sha256().update(new TextEncoder().encode(parts.join('|'))).hex();
async function world(row){return {source:await stoppedFileSource(row.filename),sha256:row.sha256};}
const ready=row=>nativeHeroArrivalReady({serial:2,region:'0_0',clock:103500,...targetAlias,homeAgentId:7,size:row.bytes,sha256:row.sha256});
async function cloneCaptured(){await unchangedSeed();const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
 for(const n of seedNames){const f=await open(join(directory,n),'wx');let at=0;
  try{const result=await hashNativeFile(join(seed,n),{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }});assert.equal(result.sha256,second.journalSha256[n]);await f.sync();}finally{await f.close();}}
 const stats={},io=await stoppedHeroRouteStorage(directory,stats),store=new HeroRouteStore(io,identity,identity.contentDigest);
 return {directory,stats,io,store};
}
async function request(){return {ready:ready(active),operationId:operation(['native-home-return',second.ownerManifest,retired.sha256,active.sha256]),
 expectedManifest:second.ownerManifest,sourceRegion:'1_0',sourceAlias,sourceHome,sourceClock:4350,capturedSha256:captured.sha256,
 retiredSource:await world(retired),activeSource:await world(active)};}
async function owner(f,published){const store=new HeroRouteStore(f.io,identity,identity.contentDigest);let result,escaped;
 await store.withOwner(async v=>{assert.equal(v.owner.region,published?'0_0':'1_0');assert.equal(v.owner.entityId,identity.entityId);
  assert.equal(v.record.revision,published?4:3);assert.deepEqual(v.entry.alias,published?targetAlias:sourceAlias);
  assert.deepEqual(v.entry.homeAlias,published?targetHome:sourceHome);assert.equal(v.entry.world.sha256,(published?active:captured).sha256);
  assert.equal(await checkpointSavedClock(v.source),published?103500:4350);result={owner:v.owner,entry:v.entry,record:v.record};escaped=v.source;
 });await assert.rejects(escaped.readAt(0,16),/lease ended/);return result;
}
const refusals=[];
for(const [kind,change]of [
 ['east-still-owns',async r=>{r.retiredSource=await world(captured);} ],
 ['home-before-import',async r=>{r.activeSource=await world(absent);r.ready=ready(absent);} ],
 ['home-before-activation',async r=>{r.activeSource=await world(imported);r.ready=ready(imported);} ],
 ['wrong-registered-home',async r=>{r.ready=nativeHeroArrivalReady({serial:2,region:'0_0',clock:103500,...targetAlias,homeAgentId:38,size:active.bytes,sha256:active.sha256});} ],
 ['stale-selected-head',async r=>{r.expectedManifest=first.publicationReceipt.ownerManifest;assert.equal(JSON.parse(r.expectedManifest).revision,2);} ],
 ['wrong-source-clock',async r=>{r.sourceClock++;} ],
 ['changed-captured-digest',async r=>{r.capturedSha256='0'.repeat(64);} ]
]){const f=await cloneCaptured(),r=await request();await change(r);const writes=f.stats.writes??0;
 await assert.rejects(publishHeldNativeHeroArrival(f.store,r));assert.equal(f.stats.writes??0,writes);await owner(f,false);
 refusals.push({kind,directory:f.directory,additionalWrites:0,capturedOwnerPreserved:true});}
const interruptions=[];
for(const stage of ['after-source','after-destination','before-publish','after-publish']){
 const f=await cloneCaptured(),r=await request();
 await assert.rejects(publishHeldNativeHeroArrival(f.store,r,{boundary:at=>{if(at===stage)throw Error('native home publication interruption');}}),/native home publication interruption/);
 const selected=await owner(f,stage==='after-publish'),retry=await publishHeldNativeHeroArrival(f.store,r);
 assert.equal(retry.ownerRevision,4);assert.equal(retry.idempotent,stage==='after-publish');await owner(f,true);
 interruptions.push({stage,directory:f.directory,selectedRevisionAfterInterruption:selected.record.revision,recoveredRevision:4,idempotent:retry.idempotent,completePairSelected:true,stats:f.stats});
}
const cancellations=[];
for(const stage of ['before-publish','after-publish']){const f=await cloneCaptured(),r=await request(),controller=new AbortController(),reason=Error('native home publication cancelled');
 await assert.rejects(publishHeldNativeHeroArrival(f.store,r,{signal:controller.signal,boundary:at=>{if(at===stage)controller.abort(reason);}}),e=>e===reason);
 const selected=await owner(f,stage==='after-publish'),writes=f.stats.writes;
 const retry=await publishHeldNativeHeroArrival(f.store,r);assert.equal(retry.ownerRevision,4);
 if(stage==='after-publish')assert.equal(f.stats.writes,writes);await owner(f,true);
 cancellations.push({stage,directory:f.directory,acknowledgementProduced:false,selectedRevisionAfterCancellation:selected.record.revision,recoveredRevision:4,idempotent:retry.idempotent,stats:f.stats});
}
const actual=await cloneCaptured(),r=await request(),published=await publishHeldNativeHeroArrival(actual.store,r);
assert.equal(published.ownerRevision,4);assert.deepEqual(published.home,targetHome);
const selected=await owner(actual,true),writes=actual.stats.writes,retry=await publishHeldNativeHeroArrival(actual.store,r);
assert.equal(retry.idempotent,true);assert.equal(actual.stats.writes,writes);
const names=(await readdir(actual.directory)).sort(),journalSha256={};for(const n of names)journalSha256[n]=await hash(join(actual.directory,n));
const changed=names.filter(n=>journalSha256[n]!==second.journalSha256[n]);assert.equal(changed.length,4);
assert.ok(changed.includes('Frontier_Hero_Route.checkpoint')&&changed.includes('Frontier_Hero_Route_Node_4.json'));
for(const n of seedNames.filter(n=>!changed.includes(n)))assert.equal(journalSha256[n],second.journalSha256[n]);
const opened=[],openSource=actual.io.open;actual.io.open=async n=>{opened.push(n);return openSource(n);};await owner(actual,true);
assert.equal(opened.filter(n=>n.endsWith('.GMP')).length,1);assert.ok(opened.find(n=>n.endsWith('.GMP')).startsWith('Frontier_Hero_Route_0_0_'));
for(const stats of [actual.stats,...interruptions.map(v=>v.stats),...cancellations.map(v=>v.stats)]){
 assert.ok(stats.largestRead<=4096&&stats.largestWrite<=4096&&stats.peakReads===1&&stats.activeReads===0);
}await unchangedSeed();
const sourceSha256={},pending=[resolve('scripts/publish-native-hero-home-arrival.mjs')];
while(pending.length){const n=pending.pop(),name=relative(workspace,n);if(sourceSha256[name])continue;
 assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&Object.keys(sourceSha256).length<128);const text=await readFile(n,'utf8');assert.ok(text.length<256*1024);sourceSha256[name]=await hash(n);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(n),match[1]));}
const report={version:1,stoppedConnectedNativeHeroHomePublicationQualified:true,archive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 nativeActivationManifest:proof.manifest,sourceSha256,identity,captured,retired,active,sourceAlias,sourceHome,targetAlias,targetHome,
 ready:r.ready,published,selected,actualJournal:actual.directory,journalSha256,changedJournalFiles:changed,
 seedJournal:seed,seedJournalSha256:second.journalSha256,refusals,interruptions,cancellations,stats:actual.stats,
 exactRetryAdditionalWrites:0,ownerExportDormantWorldsOpened:0,ownerReaderRevoked:true,originalJournalAndSnapshotsUnchanged:true,
 nativeProcessesStarted:0,browserUsed:false,realOPFSDurabilityQualified:false,liveNativeReceiptConsumed:false,homewardGameplayResumed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({stoppedConnectedNativeHeroHomePublicationQualified:true,ownerRevision:4,targetAlias,targetHome,zeroWriteRefusals:refusals.length,
 interruptedStages:interruptions.length,cancellationStages:cancellations.length,changedJournalFiles:changed.length,liveNativeReceiptConsumed:false}));
