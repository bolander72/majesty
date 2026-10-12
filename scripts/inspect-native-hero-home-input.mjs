#!/usr/bin/env node
// Bind browser-produced JSON inputs to both actual native return imports and
// the completed continued-home save. This does not establish live OPFS/WASM.
import assert from 'node:assert/strict';
import {readFile,lstat,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {HERO_ARRIVAL_PACKAGE} from '../web/world/hero-arrival-staging.mjs';

const [manifestName,saveName,outName]=process.argv.slice(2);assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-home-input-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
async function json(name){assert.ok((await lstat(name)).size<256*1024);return JSON.parse(await readFile(name,'utf8'));}
async function bound(row){const h=await hashNativeFile(row.filename);assert.equal(h.bytes,row.bytes);assert.equal(h.sha256,row.sha256);}
const m=await json(manifestName),q=await json(saveName);
assert.equal(q.nativeConnectedContinuedHeroRepeatHomeSaveQualified,true);
assert.equal(q.manifest.filename,resolve(manifestName));assert.equal(q.manifest.sha256,(await hashNativeFile(manifestName)).sha256);
for(const [name,sha256] of Object.entries(q.sourceSha256))assert.equal((await hashNativeFile(name)).sha256,sha256);
assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
assert.equal(m.publicationWorkerTerminal,true);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.stopReason,null);
for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const [name,sha256] of Object.entries(m.compiledSourceSha256))assert.equal((await hashNativeFile(name)).sha256,sha256);
assert.ok((await lstat(m.log)).size<=m.logCeilingBytes);assert.equal((await hashNativeFile(m.log)).sha256,m.logSha256);
const log=await readFile(m.log,'utf8'),observed=[];
for(const [serial,inputRow,captureRow] of [[2,m.homePageInput,m.secondPublication],[6,m.repeatHomePageInput,m.repeatReturnPublication]]){
 await bound(inputRow);await bound(captureRow);
 const h=await json(inputRow.filename),capture=await json(captureRow.filename),arrival=h.returnArrival,staged=arrival.browserInput;
 assert.equal(h.nativePid,m.nativePid);assert.equal(h.fixture,m.fixture);assert.equal(h.journalUnchanged,true);
 assert.equal(staged.controlledFilesystemAdapter,true);assert.equal(staged.liveOPFSQualified,false);
 await bound(staged.manifest);await bound(arrival.pack);
 const text=await readFile(staged.manifest.filename,'utf8');assert.equal(text,staged.staged.inputManifest);
 assert.ok(Buffer.byteLength(text)<=4096);const input=JSON.parse(text);
 assert.equal(JSON.stringify(input)+'\n',text);assert.equal(input.kind,'majesty-hero-native-home-input-v1');assert.equal(input.version,1);
 assert.equal(input.serial,serial);assert.equal(input.sourceRegion,'1_0');assert.equal(input.targetRegion,'0_0');
 assert.equal(input.sourceClock,capture.crossing.clock);assert.equal(input.destinationClock,h.targetClock??h.homeClock);
 const owner=capture.publicationReceipt?.owner??capture.owner,entry=h.targetEntry??h.homeEntry;
 assert.deepEqual(input.sourceAlias,{unitId:owner.unitId,agentId:owner.agentId});assert.deepEqual(input.homeAlias,entry.homeAlias);
 assert.equal(input.sourceNativeManifest,capture.nativeManifest);assert.equal(input.destinationNativeManifest,h.nativeManifest);
 assert.equal(input.ownerManifest,capture.publicationReceipt?.ownerManifest??capture.ownerManifest);
 assert.deepEqual(input.package,{filename:HERO_ARRIVAL_PACKAGE,size:arrival.pack.bytes,sha256:arrival.pack.sha256});
 assert.equal(staged.staged.inputSha256,staged.manifest.sha256);assert.equal(staged.staged.packageSha256,arrival.pack.sha256);
 assert.equal(staged.stats.activeIO,0);assert.equal(staged.stats.peakIO,1);
 assert.ok(staged.stats.largestRead<=4096&&staged.stats.largestWrite<=4096);
 for(const field of ['sourceRetired','destinationLoaded','heroImported','ownerTransferred'])assert.equal(staged.staged[field],false);
 const line=`[frontier] Hero native home input consumed serial=${serial} source=1_0 target=0_0 source-clock=${input.sourceClock} target-clock=${input.destinationClock} bytes=${input.package.size} staged-manifests-verified=1 selected-owner-verified=1 registered-home-verified=1 canonical-input=1 control-refusals=6 phase=7 ordinary-ticks=0`;
 assert.equal(log.split('\n').filter(l=>l===line).length,1);
 assert.ok(log.indexOf(line)<log.indexOf(`[frontier] Hero travel publication accepted serial=${serial} region=0_0 `));
 assert.ok(log.indexOf(line)<log.indexOf(`[frontier] Hero travel resumed serial=${serial} region=0_0 `));
 observed.push({serial,sourceClock:input.sourceClock,destinationClock:input.destinationClock,
  sourceAlias:input.sourceAlias,homeAlias:input.homeAlias,package:input.package,manifest:staged.manifest,
  nativeAdmissionControlRefusals:6,productionBrowserStagerUsed:true,controlledFilesystemAdapter:true});
}
const sourceSha256={};
for(const name of ['scripts/inspect-native-hero-home-input.mjs','scripts/lib/stage-selected-hero-browser-input.mjs',
 'scripts/lib/stage-selected-hero-home.mjs','scripts/lib/stage-selected-hero-repeat-home.mjs',
 'tests/fixtures/file-profile-storage.mjs','web/world/hero-arrival-staging.mjs','upstream/majesty-recomp/browser_frontier.cpp'])
 sourceSha256[name]=(await hashNativeFile(name)).sha256;
await writeFile(outName,JSON.stringify({version:1,nativeBrowserHomeInputConsumptionQualified:true,
 manifest:{filename:resolve(manifestName),...await hashNativeFile(manifestName)},
 continuedHomeSave:{filename:resolve(saveName),...await hashNativeFile(saveName)},sourceSha256,observed,
 nativeTerminal:true,publicationWorkerTerminal:true,ownedProducersAbsent:true,browserUsed:false,
 nativeReturnImportActivationPublicationResumeQualified:true,liveBrowserTravelQualified:false,
 OPFSToWasmVisibilityQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeBrowserHomeInputConsumptionQualified:true,returns:observed.length,nativeAdmissionRefusals:12}));
