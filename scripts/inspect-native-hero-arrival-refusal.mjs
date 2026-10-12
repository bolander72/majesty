#!/usr/bin/env node
// Inspect a stopped original collision refusal, custody and recovery bytes.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';

const [manifestName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-hero-arrival-refusal-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const json=async name=>{assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));};
const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
const hash=async name=>(await hashNativeFile(name)).sha256;
const m=await json(manifestName);
for(const [key,value]of Object.entries({nativeSessionTerminal:true,nativeExitCode:-15,ownedProducerAbsent:true,
 publicationWorkerTerminal:true,publicationWorkerExitCode:1,publicationWorkerAbsent:true,browserUsed:false,
 sourceCheckpointUnchanged:true,copiedCheckpointUnchanged:true,startupFixtureUnchanged:true,nativeExecutableUnchanged:true,
 nativeFreshNeighborTrialQualified:false}))assert.equal(m[key],value,key);
assert.equal(m.stopReason,'owned publication worker failed');assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-binding-');
await ownedDirectory(m.publicationJournal,'actor-arrival-fixture-hero-route-');
for(const [name,digest]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(name),digest);
assert.equal(await hash('scripts/run-native-hero-binding.py'),m.runnerSha256);
assert.equal(await hash('scripts/stage-held-native-hero-generation.mjs'),m.publicationWorkerSha256);
assert.equal(await hash(m.log),m.logSha256);
const log=await readFile(m.log,'utf8');assert.ok(!/invariant failed|abort from the runtime|GplException/.test(log));
const refusals=[...log.matchAll(/^\[frontier\] Hero arrival refused serial=(\d+) source=(\S+) target=(\S+) clock=(\d+) phase=7 pending=0 captured-recovery-preserved=1 owner-published=0$/gm)];
assert.equal(refusals.length,1);const [,serialText,sourceRegion,targetRegion,clockText]=refusals[0],serial=Number(serialText),clock=Number(clockText);
assert.equal(serial,4);assert.equal(sourceRegion,'0_-1');assert.equal(targetRegion,'-1_-1');
const collision=[...log.matchAll(/^\[streaming\] Hero arrival activation refused boundary=collision hero=(\d+) agent=(\d+) grid=(\d+),(\d+) clearance=(\d+) clock=(\d+) phase=7 pending=0 original-query-returned=1 postload=0 drawing=0 scheduled=0 owner-published=0$/gm)];
assert.equal(collision.length,1);const [,unitText,agentText,xText,yText,clearanceText,collisionClock]=collision[0];
assert.equal(Number(collisionClock),clock);assert.ok(Number(clearanceText)>0&&Number(clearanceText)<=255);
assert.ok(log.indexOf(collision[0][0])<log.indexOf(refusals[0][0]));
assert.equal((log.match(/Hero generated neighbor gameplay held serial=/g)??[]).length,3);
assert.ok(!log.includes(`Hero travel publication accepted serial=${serial} `));
assert.ok(!log.includes(`Hero travel resumed serial=${serial} `));
assert.ok(!log.includes(`Hero generated neighbor gameplay held serial=${serial} `));
const requestName=join(m.fixture,'frontier_'+sourceRegion,`Hero_Generation_Request_${serial}.json`),request=await json(requestName);
assert.equal(request.sourceRegion,sourceRegion);assert.equal(request.targetRegion,targetRegion);assert.equal(request.serial,serial);
const captured=await descriptor(join(m.fixture,'frontier_'+sourceRegion,'Documents/My Games/MajestyHD/SaveGame',`Frontier_${sourceRegion}_Recovery.GMP`));
const identity=await json(join(m.publicationJournal,'Frontier_Hero_Route_Identity.json')),stats={};
const store=new HeroRouteStore(await stoppedHeroRouteStorage(m.publicationJournal,stats),identity,identity.contentDigest);
await store.withOwner(async selected=>{
 assert.equal(selected.owner.region,sourceRegion);assert.equal(selected.record.revision,serial*2-1);
 assert.equal(selected.record.manifest,request.ownerManifest);assert.equal(selected.entry.world.sha256,captured.sha256);
 assert.deepEqual(selected.entry.alias,request.sourceAlias);assert.deepEqual(selected.entry.homeAlias,request.homeAlias);
 assert.equal(await checkpointSavedClock(selected.source),request.sourceClock);
 await verifyRegisteredHeroSnapshot(identity,request.sourceAlias,request.homeAlias,selected.source,true,sourceRegion);
});
await assert.rejects(store.withDestination(targetRegion,null,()=>assert.fail('Unpublished arrival selected')),
 /Unvisited hero route region needs a stopped candidate/);
const imported=await descriptor(join(m.fixture,'frontier_'+targetRegion,'Documents/My Games/MajestyHD/SaveGame/Hero_Arrival_Imported.GMP'));
const importedSource=await stoppedFileSource(imported.filename);assert.equal(await checkpointSavedClock(importedSource),clock);
let queueEntries=0;for await(const q of checkpointAgentQueues(importedSource))if(q.type==='queued-agent'&&q.agentId===Number(agentText))queueEntries++;
assert.equal(queueEntries,0);assert.equal(stats.writes??0,0);
const peakAggregateRssBytes=Math.max(...m.resourceSamples.map(s=>s.rssBytes));assert.ok(peakAggregateRssBytes<=m.rssCeilingBytes);
await writeFile(outName,JSON.stringify({version:1,nativeOccupiedArrivalRefusedWithoutAbort:true,manifest:await descriptor(manifestName),
 serial,sourceRegion,targetRegion,clock,clearance:Number(clearanceText),grid:{x:Number(xText),y:Number(yText)},
 unpublishedHero:{unitId:Number(unitText),agentId:Number(agentText),queueEntries},captured,imported,
 selectedCapturedRecoveryVerified:true,capturedRecoveryRegisteredMembershipVerified:true,ownerRevision:serial*2-1,
 unpublishedTargetNotSelected:true,inspectionReadOnly:true,peakAggregateRssBytes,elapsedMs:m.finishedAtMs-m.startedAtMs,
 supervisorTerminatedOwnedProcesses:true,successfulTravelQualified:false,sustainedMemoryQualified:false,
 browserUsed:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeOccupiedArrivalRefusedWithoutAbort:true,selectedCapturedRecoveryVerified:true,
 ownerRevision:serial*2-1,unpublishedTargetNotSelected:true,queueEntries,peakAggregateRssBytes}));
