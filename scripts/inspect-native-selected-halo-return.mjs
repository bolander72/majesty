#!/usr/bin/env node
// Reproduce inert return preparation from the immutable selected route journal.
import assert from 'node:assert/strict';
import {readFile,lstat,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {prepareSelectedHaloReturn} from './prepare-native-selected-halo-return.mjs';
const [receiptName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const r=await json(receiptName);assert.equal(r.selectedHaloReturnCapsulePrepared,true);
assert.equal(await hash(r.archive.filename),r.archive.sha256);const archive=await json(r.archive.filename);
assert.equal(archive.generation,246);
for(const row of archive.sources.concat(archive.evidence)){assert.equal(await hash(row.preserved),row.sha256);}
const publicationRow=archive.evidence.find(e=>e.preserved===r.publication.filename);assert.ok(publicationRow);
assert.equal(publicationRow.sha256,r.publication.sha256);assert.equal(await hash(r.publication.filename),r.publication.sha256);
const publication=await json(r.publication.filename);assert.deepEqual(r.identity,publication.identity);
const archiveJournal=archive.evidence.filter(e=>dirname(e.original)===publication.directory);assert.equal(archiveJournal.length,9);
assert.deepEqual(Object.fromEntries(archiveJournal.map(e=>[e.original.split('/').at(-1),e.sha256])),r.journalSha256);
for(const [name,h]of Object.entries(r.sourceSha256))assert.equal(await hash(name),h);
assert.equal(await hash(r.inheritedWriterAudit.filename),r.inheritedWriterAudit.sha256);
const audit=await json(r.inheritedWriterAudit.filename);assert.equal(audit.originalCallbackTokenReplayChecks,4);
assert.equal(audit.originalCommonHeaderReplayChecks,2);assert.equal(audit.objectBytes,100);
for(const[name,h]of Object.entries(audit.sourceSha256))assert.equal(await hash(name),h);
const repeated=await prepareSelectedHaloReturn(r.journal,publication);
assert.deepEqual(repeated.prepared.plan,r.plan);assert.deepEqual(repeated.request,r.request);assert.deepEqual(repeated.selected,r.selected);
assert.deepEqual(repeated.ground,r.ground);assert.deepEqual(repeated.journalSha256,r.journalSha256);
assert.equal(r.ground.heightsEqual,true);assert.equal(r.ground.zPreserved,true);
assert.equal(r.byteComparisons,7);assert.equal(repeated.byteComparisons,7);assert.equal(Object.keys(r.records).length,7);
let total=0;for(const[key,row]of Object.entries(r.records)){
 assert.equal(row.filename,join(dirname(resolve(receiptName)),key+'.bin'));assert.equal(await hash(row.filename),row.sha256);
 assert.equal((await lstat(row.filename)).size,row.bytes);assert.ok(row.bytes<=4096);
 assert.deepEqual(Uint8Array.from(await readFile(row.filename)),repeated.prepared.records[key]);total+=row.bytes;
}
assert.equal(total,3308);assert.equal(r.totalRecordBytes,total);
assert.equal(r.nativeReaderReady,false);assert.equal(r.nativeImportQualified,false);assert.equal(r.sourceRetired,false);assert.equal(r.ownerPublished,false);
assert.equal(r.automaticReturnCrossingQualified,false);assert.equal(r.nativeProcessesStarted,0);assert.equal(r.browserUsed,false);
const result={version:1,selectedHaloReturnCapsuleQualified:true,
 scope:'Journal-selected north Warrior510/GPL54 and all current effects513/516 prepare seven inert records for original guild469/GPL7. Clock age, global XY/Z, relative effect pose and opaque animation parameters are preserved. No original import, activation, source removal, owner publication or automatic return crossing is qualified.',
 preparation:{filename:resolve(receiptName),sha256:await hash(receiptName)},owner:repeated.selected.owner,ownerManifest:repeated.selected.record.manifest,
 sourceClock:1500,destinationClock:60650,sourceUnitIds:[510,513,516],records:7,exactRecordComparisons:14,totalRecordBytes:total,
 ground:r.ground,globalPosition:r.plan.haloPlacement.globalFixed,registeredHome:publication.identity.registeredHome,
 sourceWorldsUnchanged:true,selectedOwnerUnchanged:true,allCurrentChildrenIncluded:true,
 maximumReadBytes:repeated.stats.largestRead,peakReads:repeated.stats.peakReads,
 sourceSha256:{...r.sourceSha256,'scripts/inspect-native-selected-halo-return.mjs':await hash('scripts/inspect-native-selected-halo-return.mjs')},
 nativeImportQualified:false,nativeActivationQualified:false,sourceRetired:false,ownerPublished:false,automaticReturnCrossingQualified:false,
 nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
await writeFile(outputName,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedHaloReturnCapsuleQualified:true,records:7,totalRecordBytes:total,allCurrentChildrenIncluded:true,ownerPublished:false}));
