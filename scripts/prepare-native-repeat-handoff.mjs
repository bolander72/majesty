#!/usr/bin/env node
// Real next crossing: stopped outgoing removal/reload and incoming gameplay/reload.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyRepeatDeparture} from './check-native-repeat-departure.mjs';
import {verifyRepeatDepartedReload} from './check-native-repeat-departed-reload.mjs';
import {verifyRepeatReload} from './check-native-repeat-reload.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {verifiedNativeSources} from './lib/native-generation.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function metadata(name,cap=1024*1024){const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Handoff metadata exceeds bound');const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return {value:JSON.parse(b),sha256:sha(b)};}
export async function prepareRepeatHandoff(departureName,departedName,incomingName,{requireCurrent=true}={}) {
  if(typeof requireCurrent!=='boolean')throw Error('Invalid handoff receipt mode');
  const db=await metadata(departureName),qb=await metadata(departedName),ib=await metadata(incomingName,65536),d=db.value,q=qb.value,i=ib.value;
  assertRevalidatedNativeProof(await verifyRepeatDeparture(d.sourceManifest),d);
  assertRevalidatedNativeProof(await verifyRepeatDepartedReload(q.sourceManifest),q);
  assertRevalidatedNativeProof(await verifyRepeatReload(i.sourceManifest),i);
  assert.equal(q.sourceDepartureReport,resolve(departureName));assert.equal(q.sourceDepartureReportSha256,db.sha256);assert.equal(q.input.sha256,d.after.sha256);
  const outgoingCapsule=(await metadata(d.fixture.crossingCapsule,32768)).value,
    active=(await metadata(i.sourceActiveReport,65536)).value,incomingCapsule=(await metadata(active.fixture.privateReturnPacket.returnReport,32768)).value,p=outgoingCapsule.plan;
  assert.deepEqual(incomingCapsule.plan,p,'Incoming/outgoing crossing plans differ');
  const receipt=(await metadata(p.receipt,8192)).value;assert.equal(receipt.state.revision,5);assert.equal(receipt.state.ownerSide,0);assert.equal(receipt.manifest,p.manifest);
  assert.deepEqual(receipt.state.aliases[0],d.identity);assert.deepEqual(receipt.state.referenceBindings,p.referenceBindings);assert.equal(receipt.identity.entityId,p.entityId);
  for(let side=0;side<2;++side)await verifyRevisionExport(p.receipt,side,receipt.worlds[side].sha256,{requireCurrent});
  for(const key of ['family','description','playerNumber'])assert.equal(i.after.actor[key],receipt.identity.actor[key]);
  const aliases=[d.identity,i.identity],referenceBindings=receipt.state.referenceBindings;
  if(aliases[1].unitId<=receipt.state.aliases[1].unitId||aliases[1].agentId<=receipt.state.aliases[1].agentId)throw Error('Retired incoming alias reused');
  const manifests=[d.fixture,q.fixture,active.fixture,i.fixture];
  if(new Set(manifests.map(m=>m.nativePid)).size!==4||new Set(manifests.map(m=>m.profile)).size!==4)throw Error('Crossing stages reused process/profile');
  const measured=[];for(const m of manifests)measured.push(await verifiedNativeSources(m));
  // The incoming preserved build and outgoing departure build are distinct.
  // They use the same pinned game configuration/frontier; original save bytes
  // and runtime consumers are independently qualified in each exact build.
  for(const name of ['upstream/majesty-recomp/browser_frontier.cpp','upstream/majesty-recomp/game.toml'])
    for(const sources of measured)assert.equal(sources[name],measured[0][name]);
  const times=manifests.map(m=>[m.startedAtMs,m.finishedAtMs]);
  for(const [start,end] of times)if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end)throw Error('Invalid stopped process times');
  for(let a=0;a<times.length;++a)for(let b=a+1;b<times.length;++b)if(Math.max(times[a][0],times[b][0])<Math.min(times[a][1],times[b][1]))throw Error('Native crossing processes overlapped');
  if(d.fixture.finishedAtMs>q.fixture.startedAtMs||active.fixture.finishedAtMs>i.fixture.startedAtMs)throw Error('Reload predates its producer');
  const worlds=[{source:await stoppedFileSource(q.roundtrip.filename),sha256:q.roundtrip.sha256},{source:await stoppedFileSource(i.after.filename),sha256:i.after.sha256}];
  await verifyEntityOwnership(receipt.identity,aliases,referenceBindings,worlds,1);
  const stats={largestRead:0,largestWrite:0,peakReads:0,activeReads:0},store=await openEntityRevisionStore(await stoppedRevisionStorage(receipt.revisionDirectory,stats),receipt.identity.contentDigest);
  assert.deepEqual(store.identity,receipt.identity);const selected=await store.read();if(requireCurrent)assert.equal(selected.record.manifest,receipt.manifest);
  const operationId=sha(Buffer.from(JSON.stringify({manifest:receipt.manifest,outgoingWorld:worlds[0].sha256,incomingWorld:worlds[1].sha256,outgoingManifest:q.sourceManifestSha256,incomingManifest:i.sourceManifestSha256})+'\n'));
  const request={worlds,aliases,referenceBindings,ownerSide:1,visitedSides:receipt.state.visitedSides|2,operationId,kind:'handoff',expectedManifest:receipt.manifest};
  assert.equal((await readdir(receipt.revisionDirectory)).length,8);
  const sources={};for(const name of ['scripts/prepare-native-repeat-handoff.mjs','scripts/check-native-repeat-departure.mjs','scripts/check-native-repeat-departed-reload.mjs','scripts/check-native-repeat-reload.mjs','scripts/lib/native-generation.mjs'])sources[name]=sha(await readFile(join(workspace,name)));
  return {store,request,stats,receipt,departure:d,departed:q,incoming:i,report:{qualified:true,scope:'Read-only next original NPC handoff request from revision5: original outgoing removal/fresh reload, incoming original gameplay/fresh reload, common identity/plan/receipt, fresh incoming aliases and exclusive ownership/known reference bindings in actual candidate saves. No commit, committed paired native reload or continuous region residency claim.',
    departureReport:resolve(departureName),departureReportSha256:db.sha256,departedReloadReport:resolve(departedName),departedReloadReportSha256:qb.sha256,
    incomingReloadReport:resolve(incomingName),incomingReloadReportSha256:ib.sha256,receipt:p.receipt,revisionDirectory:receipt.revisionDirectory,
    previousRevision:5,proposedRevision:6,entityId:receipt.identity.entityId,expectedManifest:receipt.manifest,operationId,kind:'handoff',ownerSide:1,aliases,referenceBindings,
    worlds:worlds.map((w,side)=>({filename:side?i.after.filename:q.roundtrip.filename,bytes:w.source.size,sha256:w.sha256})),
    nativeGenerations:manifests.map(m=>({pid:m.nativePid,executableSha256:m.nativeExecutableSha256AtLaunch,nativeSourceSha256:m.nativeSourceSha256})),
    unchangedOutgoingRecords:q.unchangedOtherRecords,incomingClock:i.motionSamples.at(-1)[1],incomingPosition:i.after.actor.position,
    actualOutgoingRemovalAndReloadQualified:true,actualIncomingGameplayAndReloadQualified:true,candidateExclusiveOwnershipQualified:true,
    committed:false,completeReferenceClosureQualified:false,terrainAdjacencyQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,sourceSha256:sources}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [d,q,i,output]=process.argv.slice(2);if(!d||!q||!i||!output||process.argv.length!==6)throw Error('Usage: <departure> <departed reload> <incoming reload> <fresh preparation>');const p=await prepareRepeatHandoff(d,q,i);
  await writeFile(output,JSON.stringify(p.report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,proposedRevision:6,aliases:p.report.aliases,candidateExclusiveOwnershipQualified:true,committed:false}));
}
