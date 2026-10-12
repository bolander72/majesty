#!/usr/bin/env node
// Compare the actual selected held save with its new original full-world load,
// guarded evolution and retirement. No fixed-clock rollback is accepted.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {readSelectedRemoteHomeTask} from '../web/world/remote-home-task.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,checkpointAgentQueues,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function rows(s,iterator,key){const out=new Map();for await(const r of iterator(s)){assert(!out.has(key(r)));out.set(key(r),r);}return out;}
async function bytes(s,r){assert(r&&r.size<=65536);const b=Buffer.alloc(r.size);for(let at=0;at<r.size;at+=4096)b.set(await s.readAt(r.offset+at,Math.min(4096,r.size-at)),at);return b;}
async function exact(a,b,iterator,key,omit=new Set(),sameCount=false){
  const before=await rows(a,iterator,key),after=await rows(b,iterator,key);if(sameCount)assert.equal(before.size,after.size);
  let n=0;for(const [id,r]of before)if(!omit.has(id)){assert(after.has(id));assert.deepEqual(await bytes(a,r),await bytes(b,after.get(id)));n++;}return n;
}
export async function inspectNativeSelectedRemoteHome(name){
  const m=await json(name);assert.deepEqual([m.version,m.phase,m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.stopReason],
    [2,'selected-paused-remote-home-reload',true,false,true,0,null]);
  try{process.kill(m.nativePid,0);throw Error('Selected restore producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const fixture=await ownedDirectory(m.fixture,'actor-arrival-fixture-outdoor-family-snapshot-');
  assert.equal(m.profile,join(fixture,'frontier_1_0'));assert.equal(m.worldRoot,fixture);
  const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert(build.finishedAtMs<=m.startedAtMs);
  assert.equal(await hash(build.log),build.logSha256);assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
  assert.deepEqual(m.compiledSourceSha256,{...build.nativeSourceSha256,...build.nativeHeapRuntimeSourceSha256,...build.nativeOrderRuntimeSourceSha256});
  assert.equal(Object.keys(m.compiledSourceSha256).length,20);for(const [n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(join(workspace,n)),h);
  assert.equal(await hash('scripts/run-native-selected-remote-home.py'),m.runnerSha256);
  assert.equal(await hash(m.preparation),m.preparationSha256);const prep=await json(m.preparation);
  assert.equal(prep.selectedRemoteHomePreparation,true);assert.equal(prep.version,2);
  for(const [n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(join(workspace,n)),h);
  assert.equal(await hash(prep.publication),prep.publicationSha256);const pub=await json(prep.publication);
  assert.equal(pub.selectedManifest,prep.selectedManifest);assert.deepEqual(pub.selectedState,prep.selectedState);assert.deepEqual(pub.identity,prep.identity);
  const store=await openEntityRevisionStore(await stoppedRevisionStorage(pub.fixture),prep.identity.contentDigest);
  const route=await readSelectedRemoteHomeTask(store,{expectedManifest:prep.selectedManifest});assert.deepEqual(route,prep.route);
  assert.deepEqual([route.ownerRevision,route.sourceClockMs,prep.pauseAnchorClockMs],[5,25300,24250]);
  assert.equal(pub.homeRequest.pauseAnchorClockMs,prep.pauseAnchorClockMs);
  assert.equal(await hash(m.producerArchive),m.producerArchiveSha256);const archive=await json(m.producerArchive);
  const archiveDirectory=await ownedDirectory(archive.directory,'actor-arrival-fixture-outdoor-family-reload-generation-');
  assert.equal(archive.artifactPreserved,true);assert.deepEqual(archive.sourceHashes,prep.compiledProducerSources);
  assert.equal(archive.nativeExecutable.filename,join(archiveDirectory,'pop_smoke'));
  assert.equal(await hash(archive.nativeExecutable.filename),prep.compiledProducerExecutableSha256);
  for(const [n,h]of Object.entries(archive.sourceHashes)){
    assert.equal(archive.sources[n].filename,join(archiveDirectory,basename(n)));assert.equal(await hash(archive.sources[n].filename),h);
  }
  for(const r of [...prep.worlds,...prep.records]){assert.equal(await hash(r.filename),r.sha256);assert.equal((await stat(r.filename)).size,r.bytes);}
  assert.equal(m.source,prep.worlds[1].filename);assert.equal(await hash(m.sourceCopy),route.sourceWorld.sha256);assert.equal(await hash(m.source),route.sourceWorld.sha256);
  for(const flag of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged','inputRecordsUnchanged'])assert.equal(m[flag],true);
  for(const [n,h]of Object.entries(prep.inputHashes))assert.equal(await hash(join(prep.settingsProfile,n)),h);
  assert.equal(m.proposals.length,2);for(const r of m.proposals){assert.equal(r.filename,join(m.profile,basename(r.filename)));assert.equal(await hash(r.filename),r.sha256);}
  assert.equal(await hash(m.reloadIdentity.filename),m.reloadIdentity.sha256);const identity=await readFile(m.reloadIdentity.filename),hero=route.owner.unitId,agent=route.owner.agentId,ids=[hero,hero+1,hero+2,hero+3];
  assert.equal(identity.length,48);assert.deepEqual(Array.from({length:12},(_,i)=>identity.readUInt32LE(i*4)),[0x314c4d46,2,25300,...ids,agent,45,24250,0,0]);
  assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await readFile(m.script,'utf8'),'wait 20000\ndump selected_home_completed\n');
  assert.equal(await hash(m.log),m.logSha256);assert((await stat(m.log)).size<=1024*1024);const log=await readFile(m.log,'utf8');
  assert(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));assert(!/result=fail|abort from|SIGSEGV|Family unit stage|Family orders restored/.test(log));
  assert(log.includes(`[streaming] Family reload admitted hero=${hero} agent=${agent} clock=25300 original-full-load=1 physical=4 drawing=1 queued=1 internal-links=3 guards-before-update=2 owner-published=0 result=pass`));
  assert(log.includes('[streaming] Family reload clocks version=2 saved=25300 pause-anchor=24250 held-age=1050 result=pass'));
  const held=log.match(/^\[streaming\] Family route held clock=(\d+) elapsed=(\d+) agent-held=(\d+) commands-held=(\d+),(\d+),(\d+),(\d+) other-ai=(\d+) other-commands=(\d+) records-exact=11 pause-anchor=24250 result=pass$/m);assert(held);
  const counts=held.slice(1).map(Number);assert.equal(counts[1],1000);assert(counts.slice(2).every(n=>n>0&&n<=65536));
  assert(log.includes('[streaming] Family route cleanup requests=0 original-removal=1 aliases-absent=1 registry-preserved=1 proxy-preserved=1 queues-preserved=1 hooks-removed=1 owner-published=0 result=pass'));
  const requestFile=join(m.profile,'Family_Home_Request.json'),request=await json(requestFile);
  for(const [k,v]of Object.entries(pub.homeRequest))if(k!=='requestClockMs')assert.deepEqual(request[k],v);
  assert(request.requestClockMs>route.sourceClockMs);assert.equal(request.requestClockMs+1000,counts[0]);
  const worlds={},saved={};assert.equal(m.saves.length,3);
  for(const r of m.saves){const phase=basename(r.filename).match(/^Family_Remote_(Ready|Held|Departed)\.GMP$/)?.[1];assert(phase&&!worlds[phase]);
    assert.equal(r.filename,join(m.profile,'Documents/My Games/MajestyHD/SaveGame',basename(r.filename)));
    assert.equal(await hash(r.filename),r.sha256);assert.equal((await stat(r.filename)).size,r.bytes);worlds[phase]=await stoppedFileSource(r.filename);saved[phase]=r;
  }
  const initial=await stoppedFileSource(m.source);assert.equal(await checkpointSavedClock(initial),25300);assert.equal(await checkpointSavedClock(worlds.Ready),25300);
  for(const phase of ['Held','Departed'])assert.equal(await checkpointSavedClock(worlds[phase]),counts[0]);
  const unitKey=r=>r.unitId,agentKey=r=>r.agentId,attachmentKey=r=>`${r.kind}:${r.unitId}`;
  const readyUnitsExact=await exact(initial,worlds.Ready,checkpointUnitAgentLinks,unitKey,new Set(),true);
  const readyAgentsExact=await exact(initial,worlds.Ready,checkpointAgents,agentKey,new Set(),true);
  const readyAttachmentsExact=await exact(initial,worlds.Ready,checkpointAttachments,attachmentKey,new Set(),true);
  const readyUnits=await rows(worlds.Ready,checkpointUnitAgentLinks,unitKey),heldUnits=await rows(worlds.Held,checkpointUnitAgentLinks,unitKey),departedUnits=await rows(worlds.Departed,checkpointUnitAgentLinks,unitKey);
  const readyAgents=await rows(worlds.Ready,checkpointAgents,agentKey),heldAgents=await rows(worlds.Held,checkpointAgents,agentKey),departedAgents=await rows(worlds.Departed,checkpointAgents,agentKey);
  let familyRecordsExact=0;
  for(const id of ids){assert.equal(readyUnits.get(id).parentUnitId,id===hero?0:hero);
    assert.deepEqual(await bytes(worlds.Ready,readyUnits.get(id)),await bytes(worlds.Held,heldUnits.get(id)));familyRecordsExact++;assert(!departedUnits.has(id));}
  for(const id of [agent,45]){assert.deepEqual(await bytes(worlds.Ready,readyAgents.get(id)),await bytes(worlds.Held,heldAgents.get(id)));familyRecordsExact++;}
  assert(!departedAgents.has(agent));assert.equal(departedUnits.size+4,heldUnits.size);assert.equal(departedAgents.size+1,heldAgents.size);
  const readyAttachments=await rows(worlds.Ready,checkpointAttachments,attachmentKey),heldAttachments=await rows(worlds.Held,checkpointAttachments,attachmentKey);
  for(const key of [...ids.map(id=>`ORDR:${id}`),`CONT:${hero}`]){assert.deepEqual(await bytes(worlds.Ready,readyAttachments.get(key)),await bytes(worlds.Held,heldAttachments.get(key)));familyRecordsExact++;}
  assert.equal(familyRecordsExact,11);
  for(const phase of ['Ready','Held']){let queued=0;for await(const q of checkpointAgentQueues(worlds[phase]))if(q.type==='queued-agent'&&q.agentId===agent)queued++;assert.equal(queued,1);}
  for await(const q of checkpointAgentQueues(worlds.Departed))if(q.type==='queued-agent')assert.notEqual(q.agentId,agent);
  for await(const c of checkpointContainerEntries(worlds.Departed))if(c.type==='member'){assert(!ids.includes(c.unitId));assert(!ids.includes(c.targetUnitId));}
  const otherRetiredUnitsExact=await exact(worlds.Held,worlds.Departed,checkpointUnitAgentLinks,unitKey,new Set(ids));
  const otherRetiredAgentsExact=await exact(worlds.Held,worlds.Departed,checkpointAgents,agentKey,new Set([agent]));
  assert.deepEqual(await bytes(worlds.Held,heldAgents.get(45)),await bytes(worlds.Departed,departedAgents.get(45)));
  const sourceSha256={};for(const file of ['scripts/inspect-native-selected-remote-home.mjs','scripts/run-native-selected-remote-home.py',
    'scripts/prepare-native-selected-remote-home.mjs','web/world/remote-home-task.mjs','web/world/checkpoint.mjs'])sourceSha256[file]=await hash(join(workspace,file));
  return {version:2,nativeSelectedPausedFamilyReloadQualified:true,manifest:resolve(name),manifestSha256:await hash(name),
    nativeExecutableSha256:m.nativeExecutableSha256,compiledSourceSha256:m.compiledSourceSha256,route,request,
    savedClockMs:25300,pauseAnchorClockMs:24250,heldFamilyAgeAtReloadMs:1050,endClockMs:counts[0],worlds:saved,
    readyUnitsExact,readyAgentsExact,readyAttachmentsExact,familyRecordsExact,otherRetiredUnitsExact,otherRetiredAgentsExact,
    collisionCells:4,drawingMembership:1,queueEntries:1,guardsBeforeUpdate:2,sourceSha256,
    scope:'Original full-world restore consumes the exact selected revision5 held world at25300 without rolling it back to the fixture24250 clock. Whole-family guards preserve the prior24250 pause anchor and eleven family records while other actors advance. Original retirement produces a new26350 receiving world with no outgoing owner. This is a native selected-save restore/evolution/retirement step, not a complete live cross-region ownership transaction.',
    selectedOwnerRevisionPublished:false,nativeEngineOwnershipTransactionQualified:false,activeRemoteContinuationQualified:false,
    seamlessHeroCrossingQualified:false,browserUsed:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
  const result=await inspectNativeSelectedRemoteHome(name);await writeFile(resolve(out),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({nativeSelectedPausedFamilyReloadQualified:true,savedClockMs:result.savedClockMs,pauseAnchorClockMs:result.pauseAnchorClockMs,
    readyUnitsExact:result.readyUnitsExact,readyAgentsExact:result.readyAgentsExact,readyAttachmentsExact:result.readyAttachmentsExact,
    familyRecordsExact:result.familyRecordsExact,endClockMs:result.endClockMs,browserUsed:false}));
}
