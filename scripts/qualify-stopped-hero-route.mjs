#!/usr/bin/env node
// Read terminal original-native exports, exercise the real-file route store,
// and prepare the missing inert guild projection for a generated neighbor.
// Does not synthesize receiving GMP files, import actors or launch any game.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {prepareOrReuseRemoteHomeAgent} from '../web/world/remote-home-cache.mjs';
import {verifyRemoteHomeAgent} from '../web/world/remote-home.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const [manifestName,reportName]=process.argv.slice(2);assert.equal(process.argv.length,4);
async function json(name){assert.ok((await stat(name)).size<=256*1024);return JSON.parse(await readFile(name,'utf8'));}
const manifest=await json(manifestName),manifestHash=(await hashNativeFile(manifestName)).sha256;
assert.equal(manifest.nativeSessionTerminal,true);assert.equal(manifest.nativeExitCode,0);assert.equal(manifest.stopReason,null);
assert.equal(manifest.originalWorldsUnchanged,true);assert.equal(manifest.receiptUnchanged,true);
assert.equal(manifest.nativeNamedTravelQualified,true);
try{process.kill(manifest.nativePid,0);throw Error('Original producer PID is currently present; do not reuse this proof');}
catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal((await hashNativeFile(manifest.receipt)).sha256,manifest.receiptSha256);
assert.equal((await hashNativeFile(manifest.log)).sha256,manifest.logSha256);
const receipt=await json(manifest.receipt),home=manifest.selectedRevisionExports.find(e=>e.side===0);
const outdoor=manifest.snapshotCaptures.find(e=>e.region==='0_0'),neighbor=manifest.snapshotCaptures.find(e=>e.region==='-1_0');
assert.equal(receipt.identity.version,2);assert.equal(receipt.state.ownerSide,0);
assert.equal(receipt.owner.region,'0_0');assert.ok(home&&outdoor&&neighbor);
const originals=[home.filename,outdoor.file,neighbor.file,manifest.receipt,resolve(manifestName),manifest.log];
const before={};for(const filename of originals)before[filename]=(await hashNativeFile(filename)).sha256;
assert.equal(before[home.filename],home.sha256);assert.equal(before[outdoor.file],outdoor.sha256);
assert.equal(before[neighbor.file],neighbor.sha256);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
const stats={},io=await stoppedHeroRouteStorage(directory,stats),store=new HeroRouteStore(io,receipt.identity,receipt.identity.contentDigest);
const seed=await store.commit({kind:'seed',operationId:'1'.repeat(64),expectedManifest:null,regions:['0_0'],
  aliases:[receipt.state.aliases[0]],homeAliases:[receipt.state.homeAliases[0]],
  worlds:[{source:await stoppedFileSource(home.filename),sha256:home.sha256}]});
const saved=await store.commit({kind:'save',operationId:'2'.repeat(64),expectedManifest:seed.manifest,regions:['0_0'],
  aliases:[receipt.state.aliases[0]],homeAliases:[receipt.state.homeAliases[0]],
  worlds:[{source:await stoppedFileSource(outdoor.file),sha256:outdoor.sha256}]});
const owner=await new HeroRouteStore(io,receipt.identity,receipt.identity.contentDigest).read();
assert.equal(owner.record.manifest,saved.manifest);assert.deepEqual(owner.owner,receipt.owner);
const incoming=await stoppedFileSource(neighbor.file),registered=registeredHeroHome(receipt.identity);
let refusal;
try{
  await store.withDestination(neighbor.region,{source:incoming,sha256:neighbor.sha256,alias:{unitId:100000,agentId:1000},
    homeAlias:{kind:'proxy',unitId:0,agentId:1001}},async()=>{throw Error('Generated neighbor incorrectly admitted without original home projection');});
}catch(e){refusal=e.message;}
assert.equal(refusal,'Missing bounded registered home proxy');
const projection=await prepareOrReuseRemoteHomeAgent(incoming,registered,{worldId:receipt.identity.registeredHome.worldId,
  contentDigest:receipt.identity.contentDigest,destinationRegion:neighbor.region,freshAgentId:1001});
assert.equal(projection.plan.admission,'reserve-new');assert.equal(projection.plan.proposedAgentId,1001);
const projectionFile=join(directory,'Prepared_Remote_Home.bin');
await writeFile(projectionFile,projection.record,{flag:'wx'});
await verifyRemoteHomeAgent(await stoppedFileSource(projectionFile),registered,1001);
assert.equal(await hashCheckpointSource(await stoppedFileSource(projectionFile)),projection.plan.recordSha256);
const preserved={};for(const filename of originals){preserved[filename]=(await hashNativeFile(filename)).sha256===before[filename];assert.equal(preserved[filename],true);}
const sourceFiles=['web/world/hero-route-store.mjs','web/world/entity-home-ownership.mjs','web/world/entity-ownership.mjs',
  'web/world/arrival.mjs','web/world/registered-hero-arrival.mjs','scripts/lib/stopped-hero-route-io.mjs',
  'scripts/qualify-stopped-hero-route.mjs','tests/hero-route-store.test.mjs'];
const sourceSha256={};for(const filename of sourceFiles)sourceSha256[filename]=(await hashNativeFile(filename)).sha256;
const files=await readdir(directory),report={version:1,scope:'Real-file stopped registered-hero custody and generated-neighbor home preparation; no live actor handoff',
  createdAt:new Date().toISOString(),manifest:resolve(manifestName),manifestSha256:manifestHash,originalProducerTerminalAndAbsent:true,
  directory,realFileSeedAndSaveQualified:true,selectedOwner:owner.owner,selectedManifest:saved.manifest,selectedRevision:1,
  generatedNeighborAdmissionRefusal:refusal,projection:{filename:projectionFile,bytes:projection.record.length,plan:projection.plan},
  retainedWorldSlots:files.filter(f=>f.endsWith('.GMP')).length,stats,originalsPreserved:preserved,sourceSha256,
  arbitraryRegionNativeImportQualified:false,continuousHeroCrossingQualified:false,sharedDefeatQualified:false,
  independentInternetQualified:false,sustainedBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,goalComplete:false,
  nextAction:'Reserve and restore the prepared pure-home agent through the original runtime in the generated neighbor before attempting hero import.'};
await writeFile(resolve(reportName),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({realFileSeedAndSaveQualified:true,selectedRevision:1,generatedNeighborAdmissionRefusal:refusal,
  projectionBytes:projection.record.length,largestRead:stats.largestRead,largestWrite:stats.largestWrite,heroCrossingQualified:false}));
