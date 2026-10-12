#!/usr/bin/env node
// Compare a fresh original full receiving load and its guarded continuation.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,checkpointAgentQueues,
  checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function rows(source,iterator,key){const out=new Map();for await(const r of iterator(source)){
  const id=key(r);assert(!out.has(id));out.set(id,r);}return out;}
async function bytes(source,r){assert(r.size<=65536);const b=Buffer.alloc(r.size);
  for(let at=0;at<r.size;at+=4096)b.set(await source.readAt(r.offset+at,Math.min(4096,r.size-at)),at);return b;}
async function exact(a,b,iterator,key,omit=new Set(),sameCount=false){
  const before=await rows(a,iterator,key),after=await rows(b,iterator,key);
  if(sameCount)assert.equal(before.size,after.size);let count=0;
  for(const [id,r]of before){if(omit.has(id))continue;assert(after.has(id));assert.deepEqual(await bytes(a,r),await bytes(b,after.get(id)));count++;}return count;
}
export async function inspectNativeOutdoorFamilyReload(name){
  const m=await json(name);assert.deepEqual([m.nativeOnly,m.browserUsed,m.remoteFamilyReload,m.phase,m.nativeSessionTerminal,
    m.nativeExitCode,m.outdoorFamilyTrialCompleted,m.stopReason],[true,false,true,'remote-home-full-reload',true,0,true,null]);
  try{process.kill(m.nativePid,0);throw Error('Reload producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const fixture=await ownedDirectory(m.fixture,'actor-arrival-fixture-outdoor-family-snapshot-');
  assert.equal(m.worldRoot,fixture);assert.equal(m.profile,join(fixture,'frontier_1_0'));
  const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert(build.finishedAtMs<=m.startedAtMs);
  assert.equal(await hash(build.log),build.logSha256);let inputs=0;
  for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256']){
    assert.deepEqual(m[group],build[group]);for(const [n,h]of Object.entries(m[group])){assert.equal(await hash(join(workspace,n)),h);inputs++;}
  }
  assert.equal(inputs,20);assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
  assert.equal(await hash('scripts/run-native-outdoor-family-reload.py'),m.runnerSha256);
  assert.equal(await hash(m.preparation),m.preparationSha256);const prep=await json(m.preparation);
  assert.equal(prep.homeRoutePreparationQualified,true);assert.equal(prep.records.length,13);
  for(const [n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(n),h);
  assert.equal(await hash(m.parentProof),m.parentProofSha256);assert.equal(await hash(m.parentArchive),m.parentArchiveSha256);
  const parent=await json(m.parentProof),archive=await json(m.parentArchive);
  assert.equal(parent.remoteFullWorldSnapshotsQualified,true);assert.equal(archive.artifactPreserved,true);
  assert.equal(archive.remoteFullWorldSnapshotsQualified,true);assert.equal(archive.nativeExecutable.sha256,parent.nativeExecutableSha256);
  const archiveDirectory=await ownedDirectory(archive.directory,'actor-arrival-fixture-outdoor-family-snapshot-generation-');
  assert.equal(archive.nativeExecutable.filename,join(archiveDirectory,'pop_smoke'));
  assert.equal(await hash(archive.nativeExecutable.filename),parent.nativeExecutableSha256);
  assert.equal(Object.keys(archive.sourceHashes).length,20);
  for(const [n,h]of Object.entries(archive.sourceHashes)){
    assert.equal(archive.sources[n].filename,join(archiveDirectory,basename(n)));assert.equal(await hash(archive.sources[n].filename),h);
  }
  for(const n of [m.parentProof,parent.manifest]){
    assert(archive.evidence[n]);assert.equal(await hash(n),archive.evidence[n].sha256);
    assert.equal(await hash(archive.evidence[n].filename),archive.evidence[n].sha256);
  }
  const previous=await json(parent.manifest);assert.equal(await hash(parent.manifest),parent.manifestSha256);
  assert.equal(previous.nativeSessionTerminal,true);assert.equal(previous.nativeExitCode,0);
  try{process.kill(previous.nativePid,0);throw Error('Parent producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  assert.deepEqual({...previous.nativeSourceSha256,...previous.nativeHeapRuntimeSourceSha256,...previous.nativeOrderRuntimeSourceSha256},archive.sourceHashes);
  assert.equal(await hash(m.selectedReceipt),m.selectedReceiptSha256);assert.equal(m.selectedReceiptSha256,previous.selectedReceiptSha256);
  for(let side=0;side<2;side++){
    const r=await verifyRevisionExport(m.selectedReceipt,side,side?prep.destination.sha256:prep.source.sha256);
    assert.deepEqual(r,m.selectedRevisionExports[side]);assert.equal(r.revision,3);
  }
  assert.equal(m.source,parent.worlds.Ready.filename);assert.equal(await hash(m.source),parent.worlds.Ready.sha256);
  assert.equal(await hash(m.sourceCopy),parent.worlds.Ready.sha256);
  assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await readFile(m.script,'utf8'),'wait 20000\ndump outdoor_family_completed\n');
  for(const flag of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged','proposalsUnchanged','donorUnchanged'])assert.equal(m[flag],true);
  assert.equal(m.proposals.length,13);for(const r of prep.records){const p=m.proposals.find(p=>p.source===r.filename);assert(p);
    assert.equal(p.copied,join(m.profile,basename(r.filename)));assert.equal(p.sha256,r.sha256);
    assert.equal(await hash(p.source),r.sha256);assert.equal(await hash(p.copied),r.sha256);}
  for(const [n,h]of Object.entries(prep.inputHashes))assert.equal(await hash(join(prep.settingsProfile,n)),h);
  assert.equal(await hash(m.reloadIdentity.filename),m.reloadIdentity.sha256);
  const identity=await readFile(m.reloadIdentity.filename);assert.equal(identity.length,48);
  const ids=[parent.heroId,...parent.effectIds],agentId=parent.agentId;
  assert.deepEqual(Array.from({length:12},(_,i)=>identity.readUInt32LE(i*4)),[0x314c4d46,1,24250,...ids,agentId,45,0,0,0]);
  assert.equal(await hash(m.log),m.logSha256);assert((await stat(m.log)).size<=1024*1024);
  const log=await readFile(m.log,'utf8');assert(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
  assert(!/result=fail|abort from|SIGSEGV|Family unit stage|Family orders restored/.test(log));
  assert(log.includes(`[streaming] Family reload admitted hero=${ids[0]} agent=${agentId} clock=24250 original-full-load=1 physical=4 drawing=1 queued=1 internal-links=3 guards-before-update=2 owner-published=0 result=pass`));
  const held=log.match(/^\[streaming\] Family route held clock=(\d+) elapsed=(\d+) agent-held=(\d+) commands-held=(\d+),(\d+),(\d+),(\d+) other-ai=(\d+) other-commands=(\d+) records-exact=11 pause-anchor=24250 result=pass$/m);assert(held);
  const counters=held.slice(1).map(Number);assert(counters[1]>=1000&&counters[1]<=6000);assert(counters.slice(2).every(n=>n>0&&n<=65536));
  assert(log.includes('[streaming] Family route cleanup requests=0 original-removal=1 aliases-absent=1 registry-preserved=1 proxy-preserved=1 queues-preserved=1 hooks-removed=1 owner-published=0 result=pass'));
  const recordNames=new Set();for(const r of m.records){assert.equal(r.filename,join(m.profile,basename(r.filename)));assert(!recordNames.has(r.filename));recordNames.add(r.filename);
    const a=await hashNativeFile(r.filename,{maximum:65536});assert.equal(a.sha256,r.sha256);assert.equal(a.bytes,r.bytes);}
  const worlds={},saved={};assert.equal(m.saves.length,3);
  for(const r of m.saves){assert.equal(r.filename,join(m.profile,'Documents/My Games/MajestyHD/SaveGame',basename(r.filename)));
    const phase=basename(r.filename).match(/^Family_Remote_(Ready|Held|Departed)\.GMP$/)?.[1];assert(phase&&!worlds[phase]);
    const a=await hashNativeFile(r.filename);assert.equal(a.sha256,r.sha256);assert.equal(a.bytes,r.bytes);saved[phase]=r;worlds[phase]=await stoppedFileSource(r.filename);}
  const original=await stoppedFileSource(m.source);
  const originalUnits=await rows(original,checkpointUnitAgentLinks,r=>r.unitId),originalAgents=await rows(original,checkpointAgents,r=>r.agentId);
  const originalAttachments=await rows(original,checkpointAttachments,r=>`${r.kind}:${r.unitId}`);
  const fullReloadUnitsExact=await exact(original,worlds.Ready,checkpointUnitAgentLinks,r=>r.unitId,new Set(),true);
  const fullReloadAgentsExact=await exact(original,worlds.Ready,checkpointAgents,r=>r.agentId,new Set(),true);
  const fullReloadAttachmentsExact=await exact(original,worlds.Ready,checkpointAttachments,r=>`${r.kind}:${r.unitId}`,new Set(),true);
  assert.equal(await checkpointSavedClock(worlds.Ready),24250);assert.equal(await checkpointSavedClock(worlds.Held),counters[0]);assert.equal(await checkpointSavedClock(worlds.Departed),counters[0]);
  const units={},agents={};for(const [phase,source]of Object.entries(worlds)){
    units[phase]=await rows(source,checkpointUnitAgentLinks,r=>r.unitId);agents[phase]=await rows(source,checkpointAgents,r=>r.agentId);}
  for(const phase of ['Ready','Held']){
    for(const id of ids){assert(units[phase].has(id));assert.deepEqual(await bytes(worlds[phase],units[phase].get(id)),await bytes(original,originalUnits.get(id)));}
    assert.deepEqual(await bytes(worlds[phase],agents[phase].get(agentId)),await bytes(original,originalAgents.get(agentId)));
    assert.deepEqual(await bytes(worlds[phase],agents[phase].get(45)),await bytes(original,originalAgents.get(45)));
    const attachments=await rows(worlds[phase],checkpointAttachments,r=>`${r.kind}:${r.unitId}`);
    for(const [key,a]of originalAttachments)if(ids.includes(a.unitId)){
      assert(attachments.has(key));assert.deepEqual(await bytes(worlds[phase],attachments.get(key)),await bytes(original,a));}
    let queued=0;for await(const q of checkpointAgentQueues(worlds[phase]))if(q.type==='queued-agent'&&q.agentId===agentId)queued++;assert.equal(queued,1);
  }
  assert.equal(units.Held.size-units.Departed.size,4);assert.equal(agents.Held.size-agents.Departed.size,1);
  for(const id of ids)assert(!units.Departed.has(id));assert(!agents.Departed.has(agentId));
  for await(const q of checkpointAgentQueues(worlds.Departed))if(q.type==='queued-agent')assert.notEqual(q.agentId,agentId);
  for await(const c of checkpointContainerEntries(worlds.Departed))if(c.type==='member')assert(!ids.includes(c.unitId)&&!ids.includes(c.targetUnitId));
  const otherRetiredUnitsExact=await exact(worlds.Held,worlds.Departed,checkpointUnitAgentLinks,r=>r.unitId,new Set(ids));
  const otherRetiredAgentsExact=await exact(worlds.Held,worlds.Departed,checkpointAgents,r=>r.agentId,new Set([agentId]));
  const request=await json(join(m.profile,'Family_Home_Request.json'));assert.deepEqual(request,parent.homeRequest);
  assert.equal(counters[0]-request.requestClockMs,counters[1]);
  assert(m.resourceSamples.length&&m.resourceSamples.every(r=>r.pid===m.nativePid&&r.rssBytes>0&&r.rssBytes<=m.rssCeilingBytes));
  return {version:1,originalReceivingFamilyFullReloadQualified:true,ordinaryGuardedContinuationQualified:true,
    manifest:resolve(name),manifestSha256:await hash(name),parentProof:m.parentProof,parentProofSha256:m.parentProofSha256,
    parentArchive:m.parentArchive,parentArchiveSha256:m.parentArchiveSha256,nativeExecutableSha256:m.nativeExecutableSha256,
    heroId:ids[0],effectIds:ids.slice(1),agentId,startClockMs:24250,endClockMs:counters[0],elapsedMs:counters[1],
    fullReloadUnitsExact,fullReloadAgentsExact,fullReloadAttachmentsExact,otherRetiredUnitsExact,otherRetiredAgentsExact,
    heroCollisionCells:4,drawingMembers:1,queuedAgentEntries:1,guardsBeforeFirstUpdate:2,homeRequest:request,worlds:saved,
    trackedReloadOrderAllocations:0,maximumSampledRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),
    sourceSha256:{'scripts/inspect-native-outdoor-family-reload.mjs':await hash('scripts/inspect-native-outdoor-family-reload.mjs')},
    scope:'Fresh original full receiving-world load restores the saved four-actor family with real hero collision/drawing membership and one AI queue. Two guards are installed before the first update; the family remains held, emits the same home request and is originally retired while other actors run. All initial UNIT/GPL/attachments compare exactly. No selected ownership transaction, active remote script-clock migration, seam crossing or browser activation is qualified.',
    selectedOwnerPublished:false,activeRemoteContinuationQualified:false,seamlessHeroCrossingQualified:false,browserUsed:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);const r=await inspectNativeOutdoorFamilyReload(name);
  await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({originalReceivingFamilyFullReloadQualified:true,
    fullReloadUnitsExact:r.fullReloadUnitsExact,fullReloadAgentsExact:r.fullReloadAgentsExact,fullReloadAttachmentsExact:r.fullReloadAttachmentsExact,
    collisionCells:4,selectedOwnerPublished:false,browserUsed:false}));
}
