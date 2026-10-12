#!/usr/bin/env node
// Bind the stopped, accepted homeward capsule to an official original reader.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [capsuleName,buildName,directoryName,mode]=process.argv.slice(2);
const activate=mode==='--activate';assert.equal(process.argv.length,activate?6:5);assert.ok(mode===undefined||activate);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-homeward-import-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const r=await json(capsuleName);assert.equal(r.homewardReturnCapsulePrepared,true);assert.equal(r.sourceClock,3750);
assert.equal(r.destinationClock,84550);assert.equal(r.sourceRetired,true);assert.equal(r.ownerPublished,false);
assert.equal(r.readerRevoked,true);assert.equal(r.dormantWorldsOpened,1);assert.equal(r.selected.record.revision,5);
assert.deepEqual(r.selected.owner,{entityId:r.identity.entityId,region:'1_0',unitId:532,agentId:35});
for(const[n,h]of Object.entries(r.sourceSha256))assert.equal(await hash(n),h);
assert.equal(await hash(r.archive.filename),r.archive.sha256);const archive=await json(r.archive.filename);
assert.equal(archive.nativeHomewardSourceRetirementQualified,true);
for(const row of archive.sources.concat(archive.evidence))assert.equal(await hash(row.preserved),row.sha256);
const bound=(n,h)=>{const rows=archive.evidence.filter(x=>x.original===resolve(n));assert.equal(rows.length,1);if(h)assert.equal(rows[0].sha256,h);return rows[0];};
const retirement=await json(r.retirementProof.filename);assert.equal(await hash(r.retirementProof.filename),r.retirementProof.sha256);
const movement=await json(bound(retirement.crossingProof.filename,retirement.crossingProof.sha256).preserved);
const trial=await json(bound(movement.manifest,movement.manifestSha256).preserved);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
try{process.kill(trial.nativePid,0);throw Error('Producer live');}catch(e){if(e.code!=='ESRCH')throw e;}
const base=await json(bound(trial.preparation,trial.preparationSha256).preserved);
let activationGate;
if(activate){const filename=join(workspace,'output/native-halo-homeward-import-generation-281/manifest.json'),gate=await json(filename);
 assert.equal(gate.nativeHaloHomewardImportQualified,true);assert.equal(gate.completeScriptRootsQualified,true);
 assert.equal(gate.selectedRevision,5);assert.equal(gate.destinationClock,84550);assert.equal(gate.nativeActivationQualified,false);
 for(const row of gate.sources.concat(gate.evidence))assert.equal(await hash(row.preserved),row.sha256);
 activationGate={filename,sha256:await hash(filename)};}
const settings=base.settings;for(const row of settings)assert.equal(await hash(row.preserved),row.sha256);
const build=await json(buildName);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
const compiled={};for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
 for(const[n,h]of Object.entries(build[group])){assert.equal(compiled[n],undefined);compiled[n]=h;assert.equal(await hash(n),h);}
assert.equal(Object.keys(compiled).length,54);assert.equal(await hash('upstream/majesty-recomp/build/recomp/pop_smoke'),build.nativeExecutableSha256);
assert.equal(await hash('upstream/majesty-recomp/build/recomp/gen/symbols.json'),build.nativeSymbolsSha256);
for(const row of [r.homeWorld,r.sourceWorld,r.retiredWorld,r.orderPayload,...Object.values(r.records)]){
 assert.equal(await hash(row.filename),row.sha256);assert.equal((await lstat(row.filename)).size,row.bytes);}
for(const[n,h]of Object.entries(r.journalSha256))assert.equal(await hash(join(r.journal,n)),h);
assert.equal(await readFile(join(r.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),r.ownerManifest);
const keys=['unit','agent','container','order'],sizes=[442,1853,84,536];
const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const parts=[...[0x31574848,1,4,3750,84550,532,35,469,7,100000,1000,2915].map(word)];
const records=[];for(let i=0;i<keys.length;i++){const row=r.records[keys[i]],bytes=await readFile(row.filename);assert.equal(bytes.length,sizes[i]);
 records.push({key:keys[i],...row});parts.push(word(i),word(532),word(bytes.length),bytes);}
const pack=Buffer.concat(parts);assert.equal(pack.length,3011);
assert.deepEqual(pack.subarray(pack.length-500),await readFile(r.orderPayload.filename));
await mkdir(directory);const packName=join(directory,'Halo_Homeward.pack');await writeFile(packName,pack,{flag:'wx'});
const sourceSha256={};for(const n of ['scripts/prepare-native-halo-homeward-import.mjs','scripts/prepare-native-halo-homeward-return.mjs',
 'scripts/lib/native-generation.mjs','scripts/lib/stopped-entity-io.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,selectedHaloHomewardImportPrepared:true,nativeReaderReady:true,
 selectedHaloHomewardActivationPrepared:activate,...(activate?{activationGate}:{}),
 capsule:{filename:resolve(capsuleName),sha256:await hash(capsuleName)},archive:r.archive,
 build:{filename:resolve(buildName),sha256:await hash(buildName)},compiledSourceSha256:compiled,
 journal:r.journal,journalSha256:r.journalSha256,ownerManifest:r.ownerManifest,owner:r.selected.owner,identity:r.identity,
 homeWorld:r.homeWorld,pack:{filename:packName,...await hashNativeFile(packName)},records,settings,
 settingsProducerExecutableSha256:base.settingsProducerExecutableSha256,sourceSha256,
 sourceClock:3750,destinationClock:84550,sourceRetired:true,ownerPublished:false,nativeImportQualified:false,
 nativeActivationQualified:false,nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedHaloHomewardImportPrepared:true,records:4,packBytes:pack.length,nativeImportQualified:false}));
