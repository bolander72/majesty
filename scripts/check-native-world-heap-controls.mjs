#!/usr/bin/env node
// Mutate only in-memory copies of actual native allocation metadata.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyWorldHeap,parseHeapMetadata} from './check-native-world-heap.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [manifest,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal manifest> <fresh controls report>');
const proof=await verifyWorldHeap(manifest),visit=proof.visits.at(-1),stage='after-exit',file=visit.afterExit.filename;
const actual=await readFile(file);assert.equal(sha(actual),proof.evidenceSha256[file]);
const golden=parseHeapMetadata(actual,visit.visit,stage),checks=[];
function refuses(name,bad) {
  assert.notDeepEqual(bad,actual);assert.deepEqual(parseHeapMetadata(actual,visit.visit,stage),golden);
  assert.throws(()=>parseHeapMetadata(bad,visit.visit,stage));checks.push({name,unchangedActualPositivePassed:true,refused:true});
}
function word(name,at,value){const b=Buffer.from(actual);assert.notEqual(b.readUInt32LE(at),value);b.writeUInt32LE(value,at);refuses(name,b);}
word('wrong format magic',0,0);word('wrong format version',4,1);word('wrong observed visit',8,visit.visit+1);
word('wrong lifetime stage',12,0);word('wrong live record count',16,golden.count+1);
word('wrong rounded byte total',20,golden.rounded+16);word('wrong requested byte total',24,golden.requested+1);
word('wrong CRT pool count',28,golden.pools+1);
word('misaligned guest address',40,actual.readUInt32LE(40)+1);
word('overlapping address',56,actual.readUInt32LE(40));
word('out of guest arena',40,0xfffffff0);word('zero allocation length',44,0);
word('inconsistent requested size',48,actual.readUInt32LE(48)+16);word('unknown owner classification',52,4);
const reserve=golden.records.findIndex(r=>r.kind===3),control=golden.records.findIndex(r=>r.kind===2);assert.ok(reserve>=0&&control>=0);
word('known reservation dropped from backing',40+reserve*16+12,0);
word('control misclassified as reservation',40+control*16+12,3);
refuses('truncated last record',actual.subarray(0,actual.length-1));
refuses('extra trailing record',Buffer.concat([actual,Buffer.alloc(16)]));
const other=await readFile(proof.visits.at(-2).afterExit.filename);refuses('stale previous visit metadata',other);
const report={qualified:true,scope:'Actual original persistence/allocator/full heap metadata requalified; corrupted or stale binary metadata refuses without launching another game.',sourceManifest:proof.sourceManifest,sourceManifestSha256:proof.sourceManifestSha256,checks,controlsRefused:checks.length,
  browserUsed:false,nativeProcessesStarted:0,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,
  sourceSha256:{...proof.sourceSha256,'scripts/check-native-world-heap-controls.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:proof.evidenceSha256};
await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,controlsRefused:checks.length}));
