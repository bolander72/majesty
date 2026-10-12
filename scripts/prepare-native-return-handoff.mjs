#!/usr/bin/env node
// Read-only pairing of real original-engine removal/return states. No commit.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifiedNativeSources} from './lib/native-generation.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {verifyReturnedReload} from './check-native-return-reload.mjs';
import {verifyDepartedReload} from './check-native-npc-departed-reload.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
const run=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
async function metadata(name,maximum=1024*1024) {
  const s=await stoppedFileSource(name);if(s.size>maximum)throw Error('Handoff evidence exceeds bound');
  const bytes=new Uint8Array(s.size);for(let at=0;at<bytes.length;at+=4096)bytes.set(await s.readAt(at,Math.min(4096,bytes.length-at)),at);
  return {value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),sha256:sha(bytes)};
}
function stopped(m) {
  if(m.nativeOnly!==true||m.browserUsed!==false||m.nativeSessionTerminal!==true||m.nativeExitCode!==0||!Number.isInteger(m.nativePid)||m.nativePid<=0)
    throw Error('Require successful stopped original-engine processes');
  try{process.kill(m.nativePid,0);throw Error('Original-engine process is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
}
export async function prepareNativeReturnHandoff(departureName,departedReloadName,incomingReloadName,{requireCurrent=true}={}) {
  if(typeof requireCurrent!=='boolean')throw Error('Invalid handoff receipt mode');
  const departure=await metadata(departureName),departed=await metadata(departedReloadName),incoming=await metadata(incomingReloadName,65536),
    d=departure.value,q=departed.value,i=incoming.value;
  if(d.evolvedNpcDeparturePerformed!==true||d.originalUnitAndAgentRemovalQualified!==true||d.savedQueueRemovalQualified!==true||
    q.evolvedDepartedWorldReloadQualified!==true||q.freshDepartedWorldReloadQualified!==true||
    i.freshReturnedWorldReloadQualified!==true||i.savedQueueReloadWithoutReinsertionQualified!==true||i.originalReturnedEvolvedSaveAfterReloadQualified!==true)
    throw Error('Require real evolved source removal, fresh departed reload and fresh returned gameplay/save');
  const removal=await run(process.execPath,[join(workspace,'scripts/check-native-npc-departure.mjs'),d.sourceReloadReport,'--stdout'],{maxBuffer:2*1024*1024});
  assert.deepEqual(JSON.parse(removal.stdout),d,'Original removal proof changed');
  // Recheck the original loader, not merely the removal report's qualified bit.
  const reload=(await metadata(d.sourceReloadReport)).value;
  const code="import importlib.util,json;from pathlib import Path;s=importlib.util.spec_from_file_location('r','scripts/check-native-joint-reload.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);print(json.dumps(m.verify(Path(__import__('sys').argv[1]).resolve())))";
  const candidates=Object.keys(reload.evidenceSha256).filter(name=>/^output\/native-joint-reload-attempt-\d+\.json$/.test(name));
  if(candidates.length!==1)throw Error('Require the original native reload manifest evidence');
  const reloadManifest=join(workspace,candidates[0]),loadedManifest=await metadata(reloadManifest,65536);
  assert.equal(loadedManifest.sha256,reload.evidenceSha256[candidates[0]]);assert.deepEqual(loadedManifest.value,reload.fixture);
  const loaded=await run('python3',['-c',code,reloadManifest],{cwd:workspace,maxBuffer:2*1024*1024});
  assertRevalidatedNativeProof(JSON.parse(loaded.stdout),reload);
  assert.deepEqual(await verifyDepartedReload(q.sourceManifest),q,'Fresh departed-world proof changed');
  assertRevalidatedNativeProof(await verifyReturnedReload(i.sourceManifest),i);
  if(q.sourceDepartureReport!==resolve(departureName)||q.sourceDepartureReportSha256!==departure.sha256||
    q.input.sha256!==d.after.sha256||q.unchangedSurvivingEntityRecords!==527)
    throw Error('Fresh outgoing reload does not bind the exact removed world');
  const dm=d.sourceManifest,receiptName=dm.selectedRevisionExport?.receipt;
  if(!receiptName||dm.departEvolvedNpc!==true||dm.selectedRevisionExport.side!==1)throw Error('Outgoing actor was not loaded from the selected revision');
  const receipt=(await metadata(receiptName,8192)).value;
  for(let side=0;side<2;++side)await verifyRevisionExport(receiptName,side,receipt.worlds[side].sha256,{requireCurrent});
  const producer=(await metadata(i.fixture.sourceReturnReport,65536)).value,
    capsule=(await metadata(producer.fixture.privateReturnPacket.returnReport,32768)).value;
  if(receipt.state.revision!==3||receipt.state.ownerSide!==1||receipt.identity.entityId!==capsule.plan.entityId||
    capsule.plan.receipt!==receiptName||capsule.plan.manifest!==receipt.manifest||
    capsule.plan.sourceWorld!==receipt.worlds[1].sha256||capsule.plan.destinationWorld!==receipt.worlds[0].sha256||
    capsule.plan.captureReport!==dm.evolvedCheckpointReport||dm.inputHashes['Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP']!==receipt.worlds[1].sha256)
    throw Error('Incoming/outgoing native states do not share the exact selected entity revision');
  assert.deepEqual([dm.unitId,dm.agentId],[receipt.state.aliases[1].unitId,receipt.state.aliases[1].agentId]);
  assert.deepEqual(i.identity,producer.identity && {unitId:producer.identity.unitId,agentId:producer.identity.agentId});
  for(const key of ['family','description','playerNumber'])assert.equal(i.after.actor[key],receipt.identity.actor[key]);
  const manifests=[dm,q.fixture,i.fixture,producer.fixture];for(const m of manifests)stopped(m);
  if(new Set(manifests.map(m=>m.nativePid)).size!==4||new Set(manifests.map(m=>m.profile)).size!==4)throw Error('Return stages reused a native process/profile');
  const sources=await verifiedNativeSources(manifests[0]);
  for(const m of manifests.slice(1))assert.deepEqual(await verifiedNativeSources(m),sources,'Handoff native source differs');
  if(new Set(manifests.map(m=>m.nativeExecutableSha256AtLaunch)).size!==1)throw Error('Return stages use different native executables');
  const aliases=[i.identity,receipt.state.aliases[1]],referenceBindings=receipt.state.referenceBindings,
    worlds=[{source:await stoppedFileSource(i.after.filename),sha256:i.after.sha256},{source:await stoppedFileSource(q.roundtrip.filename),sha256:q.roundtrip.sha256}];
  if(aliases[0].unitId<=receipt.state.aliases[0].unitId||aliases[0].agentId<=receipt.state.aliases[0].agentId)throw Error('Retired receiving aliases were reused');
  await verifyEntityOwnership(receipt.identity,aliases,referenceBindings,worlds,0);
  const stats={largestRead:0,largestWrite:0,peakReads:0,activeReads:0},store=await openEntityRevisionStore(await stoppedRevisionStorage(receipt.revisionDirectory,stats),receipt.identity.contentDigest),selected=await store.read();
  if(requireCurrent)assert.equal(selected.record.manifest,receipt.manifest,'Selected revision changed before return preparation');assert.deepEqual(store.identity,receipt.identity);
  const operationId=sha(new TextEncoder().encode(JSON.stringify({manifest:receipt.manifest,
    removedWorld:worlds[1].sha256,returnedWorld:worlds[0].sha256,outgoingManifestSha256:q.sourceManifestSha256,incomingManifestSha256:i.sourceManifestSha256})+'\n'));
  const request={worlds,aliases,referenceBindings,ownerSide:0,visitedSides:receipt.state.visitedSides|1,operationId,kind:'handoff',expectedManifest:receipt.manifest};
  const files=await readdir(receipt.revisionDirectory);assert.equal(files.length,8);
  for(const name of ['scripts/prepare-native-return-handoff.mjs','scripts/lib/revalidate-native-proof.mjs'])sources[name]=sha(await readFile(join(workspace,name)));
  return {store,request,stats,receipt,departure:d,departed:q,incoming:i,
    report:{qualified:true,scope:'Read-only original native return handoff request: outgoing actor removed/freshly reloaded, returned actor freshly reloaded/evolved, exact common revision/identity/bindings, fresh receiving aliases and exclusive owner in candidate snapshots. No store commit or paired reload of a committed revision.',
      departureReport:resolve(departureName),departureReportSha256:departure.sha256,departedReloadReport:resolve(departedReloadName),departedReloadReportSha256:departed.sha256,
      incomingReloadReport:resolve(incomingReloadName),incomingReloadReportSha256:incoming.sha256,
      revisionDirectory:receipt.revisionDirectory,receipt:receiptName,entityId:receipt.identity.entityId,previousRevision:receipt.state.revision,proposedRevision:receipt.state.revision+1,
      expectedManifest:receipt.manifest,operationId,kind:'handoff',ownerSide:0,aliases,referenceBindings,
      worlds:worlds.map((w,side)=>({filename:side?q.roundtrip.filename:i.after.filename,bytes:w.source.size,sha256:w.sha256})),
      outgoingRecordsPreserved:527,incomingClock:i.motionSamples.at(-1)[1],incomingPosition:i.after.actor.position,
      originalOutgoingRemovalAndReloadQualified:true,originalReturnedGameplayAndSaveQualified:true,candidateExclusiveEntityOwnershipQualified:true,
      selectedStoreUnchanged:true,retainedFiles:files.length,committed:false,sourceDestinationOwnershipHandoffQualified:false,
      completeReferenceClosureQualified:false,terrainAdjacencyQualified:false,continuousPagingQualified:false,wholeBrowserMemoryBoundQualified:false,
      browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false,sourceSha256:sources}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [departure,departed,incoming,output]=process.argv.slice(2);if(!departure||!departed||!incoming||!output||process.argv.length!==6)throw Error('Usage: <outgoing departure> <departed reload> <returned reload> <fresh request report>');
  const p=await prepareNativeReturnHandoff(departure,departed,incoming);
  await writeFile(output,JSON.stringify(p.report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,entityId:p.report.entityId,proposedRevision:p.report.proposedRevision,ownerSide:0,aliases:p.report.aliases,committed:false}));
}
