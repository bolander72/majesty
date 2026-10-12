#!/usr/bin/env node
// Exercise the selected real hero pair without launching an engine or changing
// either world. Cross-clock marker lifetime remains deliberately unqualified.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {workspace} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {inspectGeneratedHero} from './inspect-native-generated-hero.mjs';
import {inspectNativeRemoteHome} from './inspect-native-remote-home.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {prepareSelectedRegisteredHeroArrival} from '../web/world/registered-hero-arrival.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const [seedName,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <seed proof> <fresh proof>');
assert.ok((await lstat(seedName)).size<65536);
const seed=JSON.parse(await readFile(seedName,'utf8'));
assert.equal(seed.initialStoppedHeroOwnerQualified,true);
for(const [n,h] of Object.entries(seed.sourceSha256))assert.equal((await hashNativeFile(join(workspace,n))).sha256,h);
const origin=await inspectGeneratedHero(seed.originManifest),remote=await inspectNativeRemoteHome(seed.remoteManifest);
assert.deepEqual(seed.inputs,[origin.save,remote.savedWorld]);
const stats={},io=await stoppedRevisionStorage(seed.fixture,stats);
io.atomicWrite=async()=>{throw Error('Read-only actual hero arrival check');};
const store=await openEntityRevisionStore(io,seed.identity.contentDigest),selected=await store.read();
assert.equal(selected.record.manifest,seed.selectedManifest);assert.deepEqual(selected.owner,seed.selectedOwner);
const before={};for(const name of await readdir(seed.fixture))before[name]=(await hashNativeFile(join(seed.fixture,name))).sha256;
const clocks=await store.withSelected(async s=>{
  const result=[];for(const input of s.sources)result.push(await checkpointSavedClock(input));return result;
});
assert.notEqual(clocks[0],clocks[1]);assert.equal(origin.attachedUnits.length,1);
const request={expectedManifest:selected.record.manifest,freshUnitId:100000,freshAgentId:1000,
  attachedUnitBindings:[{from:origin.attachedUnits[0].unitId,to:100001}]};
let refusal;
try{await prepareSelectedRegisteredHeroArrival(store,request);throw Error('Unexpected cross-clock hero capsule');}
catch(e){assert.match(e.message,/Attached arrival orders require marker commands and equal simulation clocks/);refusal=e.message;}
for(const [name,h] of Object.entries(before))assert.equal((await hashNativeFile(join(seed.fixture,name))).sha256,h);
assert.deepEqual(await readdir(seed.fixture),Object.keys(before));assert.ok(stats.largestRead<=4096&&stats.peakReads===1);
const report={version:1,scope:'Selected real recruited source002 and native059 neighboring proxy save reach the attached marker cross-clock refusal. No capsule is exposed or ownership/world state changed. Explicit home-aware migration is synthetic-qualified only.',
  selectedRealHeroPairChecked:true,sourceClocksMs:clocks,owner:selected.owner,ownerManifest:selected.record.manifest,
  attachedUnitId:origin.attachedUnits[0].unitId,refusal,retainedFiles:Object.keys(before).length,
  sourceWorldsUnchanged:true,selectedOwnerUnchanged:true,largestRead:stats.largestRead,peakReads:stats.peakReads,
  seedProof:resolve(seedName),seedProofSha256:(await hashNativeFile(seedName)).sha256,
  originManifest:seed.originManifest,remoteManifest:seed.remoteManifest,sourceSha256:{},
  nativeProcessesStarted:0,nativeBuildPerformed:false,browserUsed:false,
  crossClockAttachedMarkerQualified:false,heroCrossingQualified:false,remoteHomeRoutingQualified:false};
for(const name of ['web/world/arrival.mjs','web/world/registered-hero-arrival.mjs','web/world/saved-clock.mjs',
  'scripts/inspect-native-registered-hero-arrival.mjs'])report.sourceSha256[name]=(await hashNativeFile(join(workspace,name))).sha256;
await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedRealHeroPairChecked:true,sourceClocksMs:clocks,refusal,sourceWorldsUnchanged:true,browserUsed:false}));
