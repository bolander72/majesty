#!/usr/bin/env node
// Corroborate native outward JSON consumption with independently qualified
// saved graphs, original import/activation and final continued-home progress.
import assert from 'node:assert/strict';
import {readFile,lstat,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {verifyRemoteHomeAgent} from '../web/world/remote-home.mjs';
import {HERO_ARRIVAL_HOME,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT} from '../web/world/hero-arrival-staging.mjs';

const [manifestName,saveName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-proxy-input-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const json=async name=>{assert.ok((await lstat(name)).size<256*1024);return JSON.parse(await readFile(name,'utf8'));};
const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
async function bound(row){const h=await hashNativeFile(row.filename);assert.equal(h.bytes,row.bytes);assert.equal(h.sha256,row.sha256);}
const m=await json(manifestName),q=await json(saveName);
assert.equal(q.nativeConnectedContinuedHeroRepeatHomeSaveQualified,true);
assert.equal(q.manifest.filename,resolve(manifestName));
assert.equal(q.manifest.sha256,(await descriptor(manifestName)).sha256);
for(const [name,sha256]of Object.entries(q.sourceSha256))assert.equal((await hashNativeFile(name)).sha256,sha256);
for(const field of ['selectedHeroBindingTrialQualified','nativeSessionTerminal','publicationWorkerTerminal','nativeSelectedHeroRepeatNeighborArrivalBoundaryObserved',
 'nativeSelectedHeroRepeatNeighborResumeBoundaryObserved','nativeSelectedHeroContinuedRepeatHomeSaveBoundaryObserved'])assert.equal(m[field],true,field);
assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.stopReason,null);
for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const [name,sha256]of Object.entries(m.compiledSourceSha256))assert.equal((await hashNativeFile(name)).sha256,sha256);
for(const row of [m.repeatNeighborPageInput,m.repeatDeparturePublication,m.publication])await bound(row);
const h=await json(m.repeatNeighborPageInput.filename),capture=await json(m.repeatDeparturePublication.filename),
 first=await json(m.publication.filename),arrival=h.neighborArrival,staged=arrival.browserInput;
assert.equal(h.nativePid,m.nativePid);assert.equal(h.fixture,m.fixture);assert.equal(h.journalUnchanged,true);
assert.equal(staged.controlledFilesystemAdapter,true);assert.equal(staged.liveOPFSQualified,false);
await bound(staged.manifest);await bound(arrival.pack);assert.equal(basename(staged.manifest.filename),HERO_ARRIVAL_INPUT);
const text=await readFile(staged.manifest.filename,'utf8');assert.equal(text,staged.staged.inputManifest);
assert.ok(Buffer.byteLength(text)<=4096);const input=JSON.parse(text);assert.equal(JSON.stringify(input)+'\n',text);
assert.equal(input.kind,'majesty-hero-proxy-home-input-v1');assert.equal(input.version,1);assert.equal(input.serial,4);
assert.equal(input.sourceRegion,'0_0');assert.equal(input.targetRegion,'1_0');assert.equal(input.sourceClock,capture.crossing.clock);
assert.equal(input.destinationClock,h.targetClock);assert.deepEqual(input.sourceAlias,capture.publicationReceipt.owner);
assert.deepEqual(input.homeAlias,h.targetEntry.homeAlias);assert.equal(input.homeAlias.unitId,0);assert.equal(input.homeAlias.kind,'proxy');
assert.equal(input.sourceNativeManifest,capture.nativeManifest);assert.equal(input.destinationNativeManifest,h.nativeManifest);
assert.equal(input.ownerManifest,capture.publicationReceipt.ownerManifest);
assert.deepEqual(input.package,{filename:HERO_ARRIVAL_PACKAGE,size:arrival.pack.bytes,sha256:arrival.pack.sha256});
assert.equal(input.home.filename,HERO_ARRIVAL_HOME);assert.equal(input.home.admission,'reuse-existing');
const home=await descriptor(resolve(m.fixture,'frontier_1_0',HERO_ARRIVAL_HOME));
assert.equal(home.bytes,input.home.size);assert.equal(home.sha256,input.home.sha256);
const pure=await verifyRemoteHomeAgent(await stoppedFileSource(home.filename),registeredHeroHome(first.identity),input.homeAlias.agentId);
assert.equal(pure.guildEntityId,first.identity.registeredHome.guildEntityId);
assert.equal(staged.staged.inputSha256,staged.manifest.sha256);assert.equal(staged.staged.packageSha256,arrival.pack.sha256);
assert.deepEqual(staged.stats.closed.map(name=>basename(name)),[HERO_ARRIVAL_HOME,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT]);
assert.equal(staged.stats.activeIO,0);assert.equal(staged.stats.peakIO,1);
assert.ok(staged.stats.largestRead<=4096&&staged.stats.largestWrite<=4096);
for(const field of ['sourceRetired','destinationLoaded','heroImported','ownerTransferred'])assert.equal(staged.staged[field],false);
assert.ok((await lstat(m.log)).size<=m.logCeilingBytes);assert.equal((await hashNativeFile(m.log)).sha256,m.logSha256);
const log=await readFile(m.log,'utf8'),line=`[frontier] Hero proxy home input consumed serial=4 source=0_0 target=1_0 source-clock=${input.sourceClock} target-clock=${input.destinationClock} bytes=${input.package.size} admission=reuse-existing staged-manifests-verified=1 selected-owner-verified=1 immutable-home-record-verified=1 canonical-input=1 control-refusals=8 phase=7 ordinary-ticks=0`;
assert.equal(log.split('\n').filter(l=>l===line).length,1);
for(const later of ['[frontier] Hero travel publication accepted serial=4 region=1_0 ','[frontier] Hero travel resumed serial=4 region=1_0 ']){
 assert.ok(log.includes(later));assert.ok(log.indexOf(line)<log.indexOf(later));
}
// The first region's registration uses the same stager/consumer, with capture
// selected before source retirement. Its fixed input was preserved before the
// later revisit replaced that filename; neither mutable file is historical proof.
assert.equal(m.firstOutwardBrowserInput,true);await bound(first.firstOutwardInput);
const outward=await json(first.firstOutwardInput.filename),fresh=outward.arrival.browserInput;
await bound(first.firstCaptureAcknowledgement);
assert.equal(await readFile(first.firstCaptureAcknowledgement.filename,'utf8'),outward.acknowledgement);
assert.equal(outward.firstOutwardBrowserInputStaged,true);assert.equal(outward.nativePid,m.nativePid);
assert.equal(outward.fixture,m.fixture);assert.deepEqual(outward.identity,first.identity);
for(const row of [outward.captured,outward.marker,outward.target,outward.targetMarker,outward.preservedInput,outward.arrival.pack])await bound(row);
const freshText=await readFile(outward.preservedInput.filename,'utf8'),freshInput=JSON.parse(freshText);
assert.equal(freshText,fresh.staged.inputManifest);assert.equal(JSON.stringify(freshInput)+'\n',freshText);
assert.ok(Buffer.byteLength(freshText)<=4096);assert.equal(freshInput.kind,'majesty-hero-proxy-home-input-v1');
assert.equal(freshInput.version,1);assert.equal(freshInput.serial,1);
assert.equal(freshInput.sourceRegion,'0_0');assert.equal(freshInput.targetRegion,'1_0');
assert.equal(freshInput.sourceClock,outward.crossing.clock);assert.equal(freshInput.destinationClock,outward.targetClock);
assert.deepEqual(freshInput.sourceAlias,outward.owner);assert.deepEqual(outward.owner,first.identity.registeredHome.members.map(v=>({unitId:v.unitId,agentId:v.agentId}))[0]);
assert.deepEqual(freshInput.homeAlias,{kind:'proxy',unitId:0,agentId:outward.homeProposal.proposedAgentId});
assert.equal(freshInput.sourceNativeManifest,outward.nativeManifest);assert.equal(freshInput.destinationNativeManifest,outward.targetManifest);
assert.equal(await readFile(outward.marker.filename,'utf8'),outward.nativeManifest);
assert.equal(await readFile(outward.targetMarker.filename,'utf8'),outward.targetManifest);
assert.equal(freshInput.ownerManifest,outward.ownerManifest);assert.equal(outward.ownerManifest,first.capturedManifest);
assert.equal(outward.publicationReceipt.ownerRevision,1);assert.equal(outward.exactRetryWrites,0);
assert.deepEqual(freshInput.package,{filename:HERO_ARRIVAL_PACKAGE,size:outward.arrival.pack.bytes,sha256:outward.arrival.pack.sha256});
assert.equal(freshInput.home.filename,HERO_ARRIVAL_HOME);assert.equal(freshInput.home.admission,'reserve-new');
assert.equal(freshInput.home.size,home.bytes);assert.equal(freshInput.home.sha256,home.sha256);
assert.equal(fresh.staged.inputSha256,outward.preservedInput.sha256);assert.equal(fresh.manifest.sha256,outward.preservedInput.sha256);
assert.equal(fresh.staged.packageSha256,outward.arrival.pack.sha256);
assert.equal(fresh.controlledFilesystemAdapter,true);assert.equal(fresh.liveOPFSQualified,false);
assert.deepEqual(fresh.stats.closed.map(name=>basename(name)),[HERO_ARRIVAL_HOME,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT]);
assert.equal(fresh.stats.activeIO,0);assert.equal(fresh.stats.peakIO,1);
assert.ok(fresh.stats.largestRead<=4096&&fresh.stats.largestWrite<=4096);
for(const field of ['sourceRetired','destinationLoaded','heroImported','ownerTransferred'])assert.equal(fresh.staged[field],false);
const freshLine=`[frontier] Hero proxy home input consumed serial=1 source=0_0 target=1_0 source-clock=${freshInput.sourceClock} target-clock=${freshInput.destinationClock} bytes=${freshInput.package.size} admission=reserve-new staged-manifests-verified=1 selected-owner-verified=1 immutable-home-record-verified=1 canonical-input=1 control-refusals=8 phase=7 ordinary-ticks=0`;
assert.equal(log.split('\n').filter(l=>l===freshLine).length,1);
const selectedManifestSha256=createHash('sha256').update(outward.ownerManifest).digest('hex');
assert.equal(outward.acknowledgement.trim().split('|').at(-1),selectedManifestSha256);
const selected=`[frontier] Hero first capture selected serial=1 region=0_0 clock=${freshInput.sourceClock} manifest-sha256=${selectedManifestSha256} before-retirement=1 phase=7 pending=0`,
 retired='[frontier] Hero source retirement completed serial=1 region=0_0 ',
 captureRefused=`[frontier] Hero captured publication refused serial=1 region=0_0 clock=${freshInput.sourceClock} phase=7 pending=0`;
assert.equal(outward.controls.length,6);assert.equal(log.split('\n').filter(l=>l===captureRefused).length,6);
for(const control of outward.controls)assert.equal(control.refusedByEngine,true);
assert.ok(log.indexOf(captureRefused)>=0&&log.lastIndexOf(captureRefused)<log.indexOf(selected));
assert.ok(log.indexOf(selected)>=0&&log.indexOf(selected)<log.indexOf(retired));
assert.ok(log.indexOf(retired)<log.indexOf(freshLine));
for(const later of ['[frontier] Hero travel publication accepted serial=1 region=1_0 ','[frontier] Hero travel resumed serial=1 region=1_0 ']){
 assert.ok(log.includes(later));assert.ok(log.indexOf(freshLine)<log.indexOf(later));
}
const request=outward.sourceRequest;assert.ok(request);await bound(request.preservedInput);
assert.equal(await readFile(request.preservedInput.filename,'utf8'),freshText);
assert.equal(request.staged.requestManifest,freshText);assert.equal(request.staged.requestSha256,outward.preservedInput.sha256);
assert.equal(request.staged.requestSize,Buffer.byteLength(freshText));assert.equal(request.staged.nativeActionIssued,false);
assert.equal(request.ordinaryNamedAction,'frontier-hero-travel-1');assert.equal(request.stagedWithoutActionKeptSourceHeld,true);
assert.deepEqual(request.stats.closed.map(name=>basename(name)),['Frontier_Hero_Travel_Request.json']);
assert.equal(request.stats.activeIO,0);assert.equal(request.stats.peakIO,1);
assert.ok(request.stats.largestRead<=4096&&request.stats.largestWrite<=4096);
assert.deepEqual(request.requestControls.map(c=>c.kind),['serial','source-clock','destination-clock','crossing-direction','source-alias',
 'owner-head','source-manifest','destination-manifest','home-alias','package-digest']);
for(const control of request.requestControls)assert.equal(control.refusedByEngine,true);
const departureRefused=`[frontier] Hero departure request refused serial=1 region=0_0 clock=${freshInput.sourceClock} phase=7 pending=0`,
 departureConsumed=`[frontier] Hero departure request consumed serial=1 source=0_0 target=1_0 bytes=${Buffer.byteLength(freshText)} selected-owner-verified=1 crossing-verified=1 destination-input-verified=1 source-retired=1 phase=7 pending=0`;
assert.equal(log.split('\n').filter(l=>l===departureRefused).length,10);
assert.equal(log.split('\n').filter(l=>l===departureConsumed).length,1);
assert.ok(log.lastIndexOf(departureRefused)<log.indexOf(selected));
assert.ok(log.indexOf(retired)<log.indexOf(departureConsumed)&&log.indexOf(departureConsumed)<log.indexOf(freshLine));
assert.ok(log.indexOf(departureConsumed)<log.indexOf('[frontier] Hero travel leaving serial=1 source=0_0 target=1_0 '));
const sourceSha256={};for(const name of ['scripts/inspect-native-hero-proxy-input.mjs','scripts/lib/stage-selected-hero-repeat-neighbor.mjs',
 'scripts/lib/stage-held-first-hero-outward.mjs',
 'web/world/hero-travel-request.mjs','scripts/stage-world.py','web/world/hero-route-launch.mjs',
 'scripts/lib/stage-selected-hero-browser-input.mjs','tests/fixtures/file-profile-storage.mjs','web/world/hero-arrival-staging.mjs',
 'web/world/remote-home.mjs','web/world/entity-home-ownership.mjs','upstream/majesty-recomp/browser_frontier.cpp'])
 sourceSha256[name]=(await hashNativeFile(name)).sha256;
await writeFile(outName,JSON.stringify({version:1,nativeBrowserProxyInputConsumptionQualified:true,
 manifest:await descriptor(manifestName),continuedHomeSave:await descriptor(saveName),sourceSha256,
 input:{serial:4,sourceClock:input.sourceClock,destinationClock:input.destinationClock,sourceAlias:input.sourceAlias,homeAlias:input.homeAlias,
  manifest:staged.manifest,package:input.package,home,pure,admission:'reuse-existing',nativeAdmissionControlRefusals:8},
 originalImportActivationPublicationResumeQualified:true,originalSavedWorldsIndependentlyQualified:true,
 nativeTerminal:true,publicationWorkerTerminal:true,ownedProducersAbsent:true,productionBrowserStagerUsed:true,
 firstOutward:{report:first.firstOutwardInput,manifest:outward.preservedInput,package:freshInput.package,
  admission:'reserve-new',captureReceiptControlRefusals:6,nativeAdmissionControlRefusals:8,captureSelectedBeforeRetirement:true},
 sourceRequestConsumptionQualified:true,sourceRequest:{manifest:request.preservedInput,ordinaryNamedAction:request.ordinaryNamedAction,
  sourceRequestControlRefusals:10,stagingWithoutActionKeptSourceHeld:true,originalRetirementUnloadLoadQualified:true},
 controlledFilesystemAdapter:true,freshProxyInputConsumptionQualified:true,firstOutwardInputConsumptionQualified:true,
 browserUsed:false,liveBrowserTravelQualified:false,OPFSToWasmVisibilityQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeBrowserProxyInputConsumptionQualified:true,admissions:['reserve-new','reuse-existing'],nativeAdmissionRefusals:16,captureReceiptRefusals:6}));
