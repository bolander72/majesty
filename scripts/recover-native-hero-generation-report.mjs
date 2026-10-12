#!/usr/bin/env node
// Re-run only the bounded completion checks after a stopped producer's
// generation report exceeded the supervisor's smaller metadata limit.
// Preserve the original report and prove its producers are absent first.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory} from './lib/stopped-entity-io.mjs';

const [inputName,archiveName,outName]=process.argv.slice(2);
assert.equal(process.argv.length,5);
assert.match(outName,/^output\/native-hero-binding-attempt-\d{3}-recovered\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const json=async(name,maximum)=>{
 const stat=await lstat(name);assert.ok(stat.isFile()&&stat.size>0&&stat.size<=maximum);
 return JSON.parse(await readFile(name,'utf8'));
};
const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
const bound=async row=>{
 const current=await descriptor(row.filename);
 assert.equal(current.bytes,row.bytes);assert.equal(current.sha256,row.sha256);
};
const original=await descriptor(inputName),m=await json(inputName,512*1024);
const archive=await json(archiveName,1024*1024);
for(const [key,value] of Object.entries({nativeSessionTerminal:true,nativeExitCode:0,stopReason:null,
 ownedProducerAbsent:true,publicationWorkerTerminal:true,publicationWorkerExitCode:0,
 publicationWorkerAbsent:true,browserUsed:false,nativeProcessesStarted:1,sourceCheckpointUnchanged:true,
 copiedCheckpointUnchanged:true,startupFixtureUnchanged:true,nativeExecutableUnchanged:true,
 bindingBoundaryObserved:true,generateNeighbor:true,arriveGeneratedNeighbor:true,repeatGeneratedNeighbor:true}))
 assert.equal(m[key],value,key);
assert.deepEqual(m.preservedBefore,m.preservedAfter);
assert.equal(m.freshGeneration,undefined);
for(const pid of [m.nativePid,m.publicationWorkerPid])
 assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
await ownedDirectory(m.publicationJournal,'actor-arrival-fixture-hero-route-');
assert.equal(archive.nativeTrialCompleted,true);assert.equal(archive.generatedRegions,0);
const frozenRun=archive.evidence.find(row=>row.source===original.filename);assert.ok(frozenRun);
assert.equal(frozenRun.sha256,original.sha256);assert.equal((await descriptor(frozenRun.preserved)).sha256,original.sha256);
for(const row of [m.build,m.startup,m.sourceCheckpoint,m.script,m.publicationInput])await bound(row);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const [name,digest]of Object.entries(m.compiledSourceSha256))assert.equal((await descriptor(name)).sha256,digest);
for(const [name,digest]of [[m.log,m.logSha256],['scripts/run-native-hero-binding.py',m.runnerSha256],
 ['scripts/stage-held-native-hero-generation.mjs',m.publicationWorkerSha256],
 ['scripts/lib/native_pair_guard.py',m.guardSha256],['scripts/run-native-regional-home.py',m.supervisorSha256],
 [join(m.fixture,'native/recomp/pop_smoke'),m.nativeExecutableSha256]])assert.equal((await descriptor(name)).sha256,digest);
const generated=join(m.fixture,'generation.json'),referenceName=join(resolve(archiveName,'..'),'generation-reference.json');
const reference=await json(referenceName,4096);assert.equal(reference.filename,generated);
await bound(reference);assert.equal((await descriptor(reference.preserved)).sha256,reference.sha256);
assert.ok(reference.bytes>256*1024&&reference.bytes<=512*1024);
const g=await json(generated,512*1024);
assert.equal(g.nativeGenerationHoldObserved,true);assert.equal(g.nativeGenerationInitializedObserved,true);
assert.equal(g.generatedClock,100);assert.equal(g.initializationTicks,2);
assert.equal(g.heroImported,true);assert.equal(g.ownerTransferred,true);
assert.equal(g.nativeGeneratedArrivalGameplayObserved,true);
assert.equal(g.controls.length,6);assert.ok(g.controls.every(c=>c.refusedByEngine===true));
const second=g.repeatedGeneration;
assert.equal(second.nativeGeneratedArrivalGameplayObserved,true);
assert.equal(second.crossing.serial,2);assert.equal(second.crossing.target,'1_-1');
assert.equal(second.published.ownerRevision,4);
const regions=['0_0','1_0','1_-1','0_-1','-1_-1','-2_-1','-3_-1','-4_-1','-5_-1'];
assert.ok(Number.isInteger(m.generatedNeighborJourneys)&&m.generatedNeighborJourneys>=7&&m.generatedNeighborJourneys<=8);
assert.equal(g.additionalGenerations.length,m.generatedNeighborJourneys-2);
for(const [index,leg]of g.additionalGenerations.entries()){
 const serial=index+3;assert.equal(leg.nativeGeneratedArrivalGameplayObserved,true);
 assert.equal(leg.crossing.serial,serial);assert.equal(leg.crossing.region,regions[serial-1]);
 assert.equal(leg.crossing.target,regions[serial]);assert.equal(leg.published.ownerRevision,serial*2);
}
await bound(original);await bound(reference);
const result={...m,freshGeneration:await descriptor(generated),
 nativeFreshNeighborTrialQualified:true,nativeFreshNeighborInitializationQualified:true,
 selectedHeroBindingTrialQualified:true,nativeGeneratedNeighborArrivalQualified:true,
 nativeRepeatedGeneratedNeighborArrivalQualified:true,nativeThreeGeneratedNeighborArrivalsQualified:true,
 qualifiedGeneratedNeighborJourneys:m.generatedNeighborJourneys,
 stoppedCompletionChecksRecovered:true,recoveryOriginal:original,recoveryArchive:await descriptor(archiveName),
 recoveryScriptSha256:(await descriptor('scripts/recover-native-hero-generation-report.mjs')).sha256,
 recoveryReason:'Original supervisor rejected generation metadata above256KiB after normal producer exits; completion checks replayed read-only within512KiB.',
 independentSavedStateVerificationRequired:true,recoveryGameProcessesStarted:0,goalComplete:false};
await writeFile(outName,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({stoppedCompletionChecksRecovered:true,journeys:m.generatedNeighborJourneys,
 independentSavedStateVerificationRequired:true,gameProcessesStarted:0}));
