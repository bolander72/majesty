#!/usr/bin/env node
// Contradictory copies of actual stopped metadata; never modify its producer.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseHeapMetadata} from './check-native-world-heap.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <qualified hero heap report> <fresh controls report>');
const hash=async n=>(await hashNativeFile(n)).sha256,sha=b=>createHash('sha256').update(b).digest('hex');
async function json(n,maximum=256*1024){assert.ok((await stat(n)).size<=maximum);return JSON.parse(await readFile(n,'utf8'));}
const proof=await json(name,512*1024);assert.equal(proof.actualSavedKingdomHeapMetadataQualified,true);
assert.equal(await hash(proof.sourceManifest),proof.sourceManifestSha256);
const m=await json(proof.sourceManifest),build=await json(m.buildReport);
await verifyConnectedNativeArtifact(m,build);assert.equal(await hash(m.log),m.logSha256);
for(const [n,d] of Object.entries(proof.evidenceSha256))assert.equal(await hash(n),d);
const record=proof.captures.find(c=>c.stage==='after-exit'&&c.heap.sizes.some(r=>r.requestedBytes===229376&&r.count>0));assert.ok(record);
assert.ok((await stat(record.filename)).size<=40+8192*16);
const actual=await readFile(record.filename);assert.equal(sha(actual),record.sha256);
const golden=parseHeapMetadata(actual,record.visit,'after-exit'),checks=[];
function refuse(name,b){assert.notDeepEqual(b,actual);assert.deepEqual(parseHeapMetadata(actual,record.visit,'after-exit'),golden);
 assert.throws(()=>parseHeapMetadata(b,record.visit,'after-exit'));checks.push({name,refused:true,unchangedActualPositivePassed:true});}
function word(name,offset,value){const b=Buffer.from(actual);assert.notEqual(b.readUInt32LE(offset),value);b.writeUInt32LE(value,offset);refuse(name,b);}
word('wrong magic',0,0);word('wrong version',4,1);word('stale visit',8,0);word('wrong stage',12,0);
word('missing live record',16,golden.count-1);word('wrong rounded byte total',20,golden.rounded+16);
word('wrong requested byte total',24,golden.requested+1);word('wrong backing pool count',28,golden.pools+1);
word('misaligned address',40,actual.readUInt32LE(40)+1);word('overlapping live record',56,actual.readUInt32LE(40));
word('outside guest arena',40,0xfffffff0);word('zero rounded storage',44,0);word('wrong requested size',48,actual.readUInt32LE(48)+16);
word('unknown backing classification',52,4);
const reservation=golden.records.findIndex(r=>r.kind===3),control=golden.records.findIndex(r=>r.kind===2),nodeSize=golden.records.findIndex(r=>r.kind===0&&r.requestedBytes===229376);
assert.ok(reservation>=0&&control>=0&&nodeSize>=0);
word('reservation classified as ordinary',40+reservation*16+12,0);
word('control classified as reservation',40+control*16+12,3);
word('ordinary search-sized block classified as CRT backing',40+nodeSize*16+12,3);
refuse('truncated record',actual.subarray(0,actual.length-1));refuse('extra trailing record',Buffer.concat([actual,Buffer.alloc(16)]));
const stale=proof.captures.find(c=>c.stage==='after-exit'&&c.visit!==record.visit);assert.ok(stale);
refuse('actual warm return substituted for initial unload',await readFile(stale.filename));
assert.equal(await hash(record.filename),record.sha256);
const result={version:1,actualHeapMetadataContradictionControlsQualified:true,sourceProof:resolve(name),sourceProofSha256:await hash(name),
 sourceManifest:proof.sourceManifest,sourceManifestSha256:proof.sourceManifestSha256,checks,controlsRefused:checks.length,
 actualMetadataUnchanged:true,browserUsed:false,nativeProcessesStarted:0,scriptSha256:await hash(new URL(import.meta.url)),
 sustainedNativeMemoryBoundQualified:false,browserMemoryBoundQualified:false};
await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({actualHeapMetadataContradictionControlsQualified:true,controlsRefused:checks.length,actualMetadataUnchanged:true}));
