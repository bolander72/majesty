#!/usr/bin/env node
// Export the exact inert home record from a qualified captured journey. Native
// execution is separate; old capture code is checked against its frozen source.
import assert from 'node:assert/strict';
import {readFile,lstat,mkdir,writeFile,realpath} from 'node:fs/promises';
import {resolve,dirname,basename,join,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {fileProfileStorage} from '../tests/fixtures/file-profile-storage.mjs';
import {openNativeHeroRouteStore} from '../web/world/hero-route-profile.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {encodeRemoteHomeAgent,verifyRemoteHomeAgent} from '../web/world/remote-home.mjs';
import {nativeHeroContentDigest} from '../web/world/hero-route-launch.mjs';
import {checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';

const [proofName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async name=>(await hashNativeFile(name)).sha256;
const json=async name=>{assert.ok((await lstat(name)).size<256*1024);return JSON.parse(await readFile(name,'utf8'));};
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-hero-home-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const proof=await json(proofName),home=proof.homePreparation;
assert.equal(proof.originalNativeCrossingCapturePublicationQualified,true);assert.equal(proof.originalFilesUnchanged,true);
assert.ok(home&&home.correctRegisteredGuildVerified&&home.originalNeighborPreserved);assert.equal(home.additionalWrites,0);
assert.equal(home.sourceRetired,false);assert.equal(home.destinationActivated,false);assert.equal(home.ownerTransferred,false);
assert.equal(home.home.kind,'proposal');assert.equal(home.home.plan.nativeHomeProjectionQualified,false);
assert.equal(await hash(proof.startup.filename),proof.startup.sha256);const startup=await json(proof.startup.filename);
assert.equal(startup.originalSelectedCrossingSourceStartupQualified,true);
for(const [name,digest]of Object.entries(startup.sourceSha256))assert.equal(await hash(join(workspace,name)),digest,name);
assert.equal(await hash(proof.nativeAttempt.filename),proof.nativeAttempt.sha256);
const attempt=await json(proof.nativeAttempt.filename);
assert.equal(attempt.nativeSelectedHeroCrossingQualified,true);assert.equal(attempt.nativeSessionTerminal,true);
assert.equal(attempt.nativeExitCode,0);assert.equal(attempt.ownedProducerAbsent,true);
try{process.kill(attempt.nativePid,0);assert.fail('Native capture producer is live');}catch(error){if(error.code!=='ESRCH')throw error;}
// Capture307 is historical after a native change. Its immutable archived code
// and stopped original output remain exact; do not weaken current build gates.
const archiveName=join(workspace,'output/hero-crossing-capture-generation-307/manifest.json'),archive=await json(archiveName);
assert.equal(archive.actualNativeBoundaryCrossingCaptureQualified,true);
assert.deepEqual(attempt.compiledSourceSha256,archive.compiledSourceSha256);
for(const [name,digest]of Object.entries(attempt.compiledSourceSha256)){
  const row=archive.sources.find(row=>relative(workspace,row.source)===name);assert.ok(row);
  assert.equal(row.sha256,digest);assert.equal(await hash(row.preserved),digest,name);
}
assert.equal(await hash(attempt.heldSave.checkpoint.filename),attempt.heldSave.sha256);
const fixture=resolve(proof.fixture);assert.equal(dirname(fixture),join(workspace,'output'));
assert.match(basename(fixture),/^hero-live-save-original-\d{3}$/);assert.equal(await realpath(fixture),fixture);
const world=proof.receipt.world,lockName='majesty-pair-native-world-'+world;let held=false;
const locks={async request(name,options,consume){assert.equal(name,lockName);assert.equal(options.mode,'shared');
  assert.equal(options.ifAvailable,true);assert.equal(held,false);held=true;try{return await consume({});}finally{held=false;}}};
const io=fileProfileStorage(fixture,()=>held),profiles=io.directory(join(fixture,'majesty/profile'));
const route=await openNativeHeroRouteStore(profiles,world,{worldId:startup.worldId,entityId:proof.receipt.owner.entityId,
  contentDigest:nativeHeroContentDigest(startup.content)},{locks});
let registered,record;
await route.withOwner(async selected=>{
  assert.equal(selected.record.manifest,proof.publication.ownerManifest);
  assert.equal(selected.entry.world.sha256,attempt.heldSave.sha256);
  assert.equal(await checkpointSavedClock(selected.source),attempt.nativeCrossing.clock);
  registered=registeredHeroHome(route.identity);record=encodeRemoteHomeAgent(registered.record,home.home.agentId);
  assert.equal(registered.record.worldId,startup.worldId);
});
assert.equal(io.stats.writes,0);assert.equal(io.stats.activeIO,0);assert.equal(io.stats.peakIO,1);
const verified=await verifyRemoteHomeAgent({size:record.length,async readAt(at,n){return record.slice(at,at+n);}},registered,home.home.agentId);
assert.equal(verified.sha256,home.home.sha256);assert.equal(verified.guildEntityId,home.home.plan.guildEntityId);
const neighbor=proof.travel.neighbor;
assert.equal(await realpath(neighbor.filename),resolve(neighbor.filename));assert.equal(await hash(neighbor.filename),neighbor.sha256);
assert.equal((await lstat(neighbor.filename)).size,neighbor.bytes);
const source=await stoppedFileSource(neighbor.filename);
assert.equal(await checkpointSavedClock(source),home.home.clock);
assert.equal(await checkpointNextAgentId(source),home.home.agentId);
await mkdir(directory);const filename=join(directory,'Frontier_Hero_Home.GPL');await writeFile(filename,record,{flag:'wx'});
assert.equal(await hash(filename),home.home.sha256);assert.equal(await hash(neighbor.filename),neighbor.sha256);
const sourceSha256={},pending=[resolve('scripts/prepare-native-hero-home.mjs')];
while(pending.length){const filename=pending.pop(),name=relative(workspace,filename);if(sourceSha256[name])continue;
  assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&Object.keys(sourceSha256).length<128);
  assert.ok((await lstat(filename)).size<256*1024);const text=await readFile(filename,'utf8');sourceSha256[name]=await hash(filename);
  for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(filename),match[1]));
}
await writeFile(join(directory,'preparation.json'),JSON.stringify({version:1,nativeHeroHomePrepared:true,
  proof:{filename:resolve(proofName),sha256:await hash(proofName)},captureArchive:{filename:archiveName,sha256:await hash(archiveName)},
  stoppedCaptureAttempt:proof.nativeAttempt,sourceCheckpoint:neighbor,region:proof.travel.admission.targetRegion,
  clock:home.home.clock,proposedAgentId:home.home.agentId,proposal:{filename,...await hashNativeFile(filename)},
  registered,plan:home.home.plan,sourceSha256,originalFilesUnchanged:true,browserUsed:false,nativeProcessesStarted:0,
  runtimeRegistered:false,heroImported:false,ownerTransferred:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHeroHomePrepared:true,clock:home.home.clock,proposedAgentId:home.home.agentId,bytes:record.length}));
