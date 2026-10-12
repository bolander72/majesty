#!/usr/bin/env node
// Bind an exact stopped return capsule, home world and current official build.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,open} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {prepareSelectedHaloReturn} from './prepare-native-selected-halo-return.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const[receiptName,buildName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,5);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-halo-return-import-preparation-\d{3}$/);await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const r=await json(receiptName);assert.equal(r.selectedHaloReturnCapsulePrepared,true);
for(const[n,h]of Object.entries(r.sourceSha256))assert.equal(await hash(n),h);
const archive=await json(r.archive.filename);assert.equal(await hash(r.archive.filename),r.archive.sha256);assert.equal(archive.generation,246);
for(const row of archive.sources.concat(archive.evidence))assert.equal(await hash(row.preserved),row.sha256);
const publication=await json(r.publication.filename);assert.equal(await hash(r.publication.filename),r.publication.sha256);
const repeated=await prepareSelectedHaloReturn(r.journal,publication);assert.deepEqual(repeated.prepared.plan,r.plan);
const build=await json(buildName);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
const compiled={};for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
 for(const[n,h]of Object.entries(build[group])){assert.equal(compiled[n],undefined);compiled[n]=h;assert.equal(await hash(n),h);}
assert.equal(Object.keys(compiled).length,54);assert.equal(await hash('upstream/majesty-recomp/build/recomp/pop_smoke'),build.nativeExecutableSha256);
const storageManifestName='output/native-extended-order-storage-001-preserved/manifest.json',storage=await json(storageManifestName);
assert.equal(storage.nativeTargetsPassed,2);assert.equal(storage.literalOriginalCommandRoundTrips,4);
for(const row of storage.rows)assert.equal(await hash(row.preserved),row.sha256);
for(const n of ['native_order_storage.cpp','native_order_allocation.cpp','native_order_allocation.h','native_order_payload.h']){
 const row=storage.rows.find(x=>x.original===join(workspace,'upstream/majesty-recomp',n));assert.ok(row);assert.equal(await hash(row.original),row.sha256);
}
await mkdir(directory);const homeName=join(directory,'Selected_Home.GMP'),io=await stoppedHeroRouteStorage(r.journal),store=new HeroRouteStore(io,r.identity,r.identity.contentDigest);
let homeEntry;
await store.withDestination('0_0',null,async s=>{
 assert.equal(s.record.manifest,r.selected.record.manifest);assert.equal(await checkpointSavedClock(s.sources[1]),60650);
 const f=await open(homeName,'wx');let at=0;
 try{assert.equal(await hashCheckpointSource(s.sources[1],async bytes=>{
  for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
 }),s.entries[1].world.sha256);await f.sync();}finally{await f.close();}homeEntry=s.entries[1];
});
const order=['unit','agent','container','attached_513','attached_516','attached_order_513','attached_order_516'],tags=[0,1,2,0,0,3,3],ids=[510,510,510,513,516,513,516];
const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const records=[];
for(const[key,meta]of Object.entries(r.records)){
 assert.equal(await hash(meta.filename),meta.sha256);const bytes=repeated.prepared.records[key];assert.deepEqual(Uint8Array.from(await readFile(meta.filename)),bytes);
 records.push({key,bytes:bytes.length,sha256:meta.sha256,filename:meta.filename});
}
const pack=Buffer.concat([...[0x3152484d,1,7,1500,60650,3308].map(word),...order.flatMap((k,i)=>{
 const bytes=repeated.prepared.records[k];return [word(tags[i]),word(ids[i]),word(bytes.length),bytes];
})]);assert.equal(pack.length,3416);
const packName=join(directory,'Halo_Return.pack');await writeFile(packName,pack,{flag:'wx'});
const trialRow=archive.evidence.find(x=>x.original.endsWith('/output/native-halo-bundle-attempt-011.json'));assert.ok(trialRow);
const trial=await json(trialRow.preserved);assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.ownedProducerAbsent,true);
const bundleRow=archive.evidence.find(x=>x.original.endsWith('/native-halo-bundle-preparation-013/preparation.json'));assert.ok(bundleRow);
const bundle=await json(bundleRow.preserved),settingsArchive=await json(bundle.archive.filename);
assert.equal(await hash(bundle.archive.filename),bundle.archive.sha256);assert.equal(settingsArchive.generation,233);
const settings=[];for(const[n,h]of Object.entries(trial.inputHashes)){
 const matches=settingsArchive.evidence.filter(x=>x.original.endsWith('/frontier_0_0/'+n)&&x.sha256===h);
 assert.equal(matches.length,1);const row=matches[0];assert.equal(await hash(row.preserved),h);settings.push({name:n,...row});
}
const sourceNames=['scripts/prepare-native-halo-return-import.mjs','scripts/prepare-native-selected-halo-return.mjs',
 'web/world/hero-route-store.mjs','web/world/registered-hero-arrival.mjs','web/world/arrival.mjs','web/world/halo-companion-orders.mjs',
 'web/world/order-entries.mjs','web/world/order-dispatch-clock.mjs','web/world/order-callbacks.mjs','web/world/order-restore-bounds.mjs',
 'scripts/lib/stopped-hero-route-io.mjs','web/world/checkpoint.mjs'];
const sourceSha256=Object.fromEntries(await Promise.all(sourceNames.map(async n=>[n,await hash(n)])));
const report={version:1,selectedHaloReturnImportPrepared:true,nativeReaderReady:true,
 capsule:{filename:resolve(receiptName),sha256:await hash(receiptName)},build:{filename:resolve(buildName),sha256:await hash(buildName)},compiledSourceSha256:compiled,
 archive:r.archive,storageGate:{filename:resolve(storageManifestName),sha256:await hash(storageManifestName)},
 settingsArchive:{filename:bundle.archive.filename,sha256:bundle.archive.sha256},
 journal:r.journal,journalSha256:r.journalSha256,ownerManifest:r.selected.record.manifest,owner:r.selected.owner,identity:r.identity,
 homeEntry,homeWorld:{filename:homeName,preserved:homeName,...await hashNativeFile(homeName)},pack:{filename:packName,...await hashNativeFile(packName)},
 settings,settingsProducerExecutableSha256:trial.nativeExecutableSha256,records,sourceSha256,
 sourceClock:1500,destinationClock:60650,selectedOwnerUnchanged:true,nativeImportQualified:false,nativeActivationQualified:false,
 sourceRetired:false,ownerPublished:false,nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedHaloReturnImportPrepared:true,records:7,packBytes:3416,homeClock:60650,nativeImportQualified:false}));
