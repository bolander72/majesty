#!/usr/bin/env node
// Resolve the registered home from the actual original imported checkpoint.
import assert from 'node:assert/strict';
import {readFile,lstat,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve,dirname,basename,relative} from 'node:path';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {checkpointHaloHomeLeg} from '../web/world/halo-home-route.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const [proofName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));}
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-hero-activation-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const proof=await json(proofName);assert.equal(proof.nativeHeroArrivalQualified,true);assert.equal(proof.destinationActivated,false);
assert.equal(await hash(proof.manifest.filename),proof.manifest.sha256);const m=await json(proof.manifest.filename);
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);
try{process.kill(m.nativePid,0);assert.fail('Import producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
const archiveName=join(workspace,'output/hero-arrival-generation-309/manifest.json'),archive=await json(archiveName);
assert.equal(archive.nativeHeroArrivalQualified,true);
for(const[n,h]of Object.entries(proof.sourceSha256)){const row=archive.sources.find(r=>relative(workspace,r.source)===n);
 assert.ok(row);assert.equal(row.sha256,h);assert.equal(await hash(row.preserved),h);}
assert.equal(await hash(proof.preparation.filename),proof.preparation.sha256);
const p=await json(proof.preparation.filename);
for(const[n,h]of Object.entries(p.sourceSha256))assert.equal(await hash(n),h);
assert.equal(await hash(proof.importedWorld.filename),proof.importedWorld.sha256);
const source=await stoppedFileSource(proof.importedWorld.filename),clock=await checkpointSavedClock(source);
assert.equal(clock,proof.destinationClock);
const leg=await checkpointHaloHomeLeg(source,{identity:p.identity,alias:proof.destinationAliases,homeAlias:proof.homeAlias,region:p.options.haloRegions.destinationRegion});
assert.ok(leg);assert.equal(leg.homeRegion,p.identity.registeredHome.home.region);
assert.equal(leg.nextRegion,p.options.haloRegions.sourceRegion);assert.equal(leg.taskPreserved,true);
assert.ok([leg.movementPoint.x,leg.movementPoint.y].every(n=>Number.isInteger(n)&&n>=32&&n<=4064));
const sourceSha256={},pending=[resolve('scripts/prepare-native-hero-activation.mjs')];
while(pending.length){const filename=pending.pop(),name=relative(workspace,filename);if(sourceSha256[name])continue;
 assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&Object.keys(sourceSha256).length<128);
 const text=await readFile(filename,'utf8');assert.ok(text.length<256*1024);sourceSha256[name]=await hash(filename);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(filename),match[1]));}
assert.equal(await hash(proof.importedWorld.filename),proof.importedWorld.sha256);await mkdir(directory);
const report={version:1,nativeHeroActivationPrepared:true,proof:{filename:resolve(proofName),sha256:await hash(proofName)},
 importArchive:{filename:archiveName,sha256:await hash(archiveName)},arrivalPreparation:proof.preparation,
 sourceWorld:proof.importedWorld,sourceSha256,clock,leg,identity:p.identity,destinationAliases:proof.destinationAliases,homeAlias:proof.homeAlias,
 nativeProcessesStarted:0,browserUsed:false,destinationActivated:false,ownerTransferred:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHeroActivationPrepared:true,clock,homeRegion:leg.homeRegion,nextRegion:leg.nextRegion,movementPoint:leg.movementPoint}));
