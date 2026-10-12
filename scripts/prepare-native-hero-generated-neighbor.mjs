#!/usr/bin/env node
// Inert preparation from the independently inspected real generated kingdom.
// New bounded import files are separate from both native worlds and custody.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {prepareSelectedHeroGeneratedNeighbor} from './lib/prepare-selected-hero-generated-neighbor.mjs';

const [proofName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-hero-generated-neighbor-preparation-\d{3}\.json$/);
const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
const json=async name=>{assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));};
const proof=await json(proofName);assert.equal(proof.nativeFreshRegionGenerationQualified,true);
assert.equal((await hashNativeFile(proof.manifest.filename)).sha256,proof.manifest.sha256);
const m=await json(proof.manifest.filename),g=await json(m.freshGeneration.filename);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);
for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
for(const row of [g.captured,g.retired,g.generated])assert.deepEqual(await descriptor(row.filename),row);
for(const name of [outName,outName.slice(0,-5)])await assert.rejects(lstat(name),e=>e.code==='ENOENT');
const stats={},store=new HeroRouteStore(await stoppedHeroRouteStorage(m.publicationJournal,stats),g.identity,g.identity.contentDigest);
const head=await store.read(),prepared=await prepareSelectedHeroGeneratedNeighbor(store,m.runtimeBinding,g.crossing,g.generated);
assert.equal((await store.read()).record.manifest,head.record.manifest);assert.equal(stats.writes??0,0);
for(const row of [g.captured,g.retired,g.generated])assert.deepEqual(await descriptor(row.filename),row);
const folder=outName.slice(0,-5);await mkdir(folder);const homePath=join(folder,'Frontier_Hero_Home.GPL'),packPath=join(folder,'Frontier_Hero_Arrival.pack');
assert.ok(prepared.home.record.length<=1024&&prepared.arrival.pack.length<=256*1024);
await writeFile(homePath,prepared.home.record,{flag:'wx'});await writeFile(packPath,prepared.arrival.pack,{flag:'wx'});
await writeFile(outName,JSON.stringify({version:1,originalGeneratedNeighborArrivalPrepared:true,proof:await descriptor(proofName),
 captured:g.captured,retired:g.retired,generated:g.generated,sourceOwnerManifest:head.record.manifest,
 sourceClock:g.crossing.clock,destinationClock:prepared.destinationClock,home:await descriptor(homePath),pack:await descriptor(packPath),
 homePlan:prepared.home.plan,projection:prepared.projection,arrivalPlan:prepared.arrival.plan,options:prepared.arrival.options,
 context:prepared.arrival.context,layouts:prepared.arrival.layouts,ground:prepared.arrival.ground,travel:prepared.arrival.travel,
 packDescriptors:prepared.arrival.packDescriptors,journalStats:stats,originalSavesUnchanged:true,
 nativeHomeRegistered:false,heroImported:false,ownerTransferred:false,browserUsed:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({originalGeneratedNeighborArrivalPrepared:true,homeBytes:prepared.home.record.length,
 packBytes:prepared.arrival.pack.length,destinationClock:prepared.destinationClock}));
