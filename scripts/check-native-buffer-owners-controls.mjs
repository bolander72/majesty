#!/usr/bin/env node
// Contradict observed owner metadata without changing fixture files or launching a game.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyBufferOwners,parseOwnerMetadata,parseOwnerLog} from './check-native-buffer-owners.mjs';
import {parseHeapMetadata} from './check-native-world-heap.mjs';
import {parseMallocAllocationEvents} from './check-native-malloc-sites.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const proof=await verifyBufferOwners(name),m=JSON.parse(await readFile(name)),log=(await readFile(m.log)).toString('utf8');
const events=parseMallocAllocationEvents(log,proof.captures.length/3),records=parseOwnerLog(log,proof.captures.length/3);
const record=records.find(r=>r.stage==='after-exit'&&r.linked>0);assert.ok(record,'Require an actually observed owner buffer link');
const actual=await readFile(join(m.profile,record.filename));
const heap=parseHeapMetadata(await readFile(join(m.profile,`Heap_Visit_${record.visit}_${record.stage}.bin`)),record.visit,record.stage);
function check(bytes) {
  const r=parseOwnerMetadata(bytes,record.visit,record.stage,heap,events,record.position);
  for(const key of ['targets','tracked','linked','referenced','clock','hooks'])assert.equal(r[key],record[key]);
  return r;
}
const golden=check(actual),checks=[];
function refuse(label,bad) {
  assert.notDeepEqual(bad,actual);assert.deepEqual(check(actual),golden);assert.throws(()=>check(bad));
  checks.push({name:label,actualPositivePassed:true,refused:true});
}
function word(label,at,value) {const bad=Buffer.from(actual);bad.writeUInt32LE(value>>>0,at);refuse(label,bad);}
word('wrong metadata magic',0,0);word('unsupported metadata version',4,2);
word('wrong visit',8,31);word('wrong stage',12,0);word('wrong target size',16,12224);
word('unbounded target capacity',20,513);word('wrong row length',24,64);
word('changed captured clock',28,golden.clock+1);word('changed installed hooks',32,golden.hooks+1);
word('changed event count',36,golden.allocationEvents+1);
refuse('truncated row',actual.subarray(0,actual.length-4));
refuse('extra target row',Buffer.concat([actual,actual.subarray(40,100)]));
const row=golden.rows.findIndex(r=>r.ownerLive&&r.ownerBuffer===r.buffer);assert.ok(row>=0);
const at=40+row*60;
word('unaligned buffer',at,actual.readUInt32LE(at)+1);
word('wrong buffer allocation event',at+4,0);
word('unaligned owner candidate',at+8,actual.readUInt32LE(at+8)+1);
word('owner lifetime flag contradicts live block size',at+12,0);
word('invalid CRT owner payload',at+16,57);
word('wrong owner type with interpreted fields',at+20,0x688a74);
word('invented owner buffer link',at+24,0);
word('unaligned embedded cache node',at+28,actual.readUInt32LE(at+28)+1);
word('cache lifetime flag contradicts block size',at+32,1);
word('read references from unqualified cache entry',at+44,1);
const line=log.slice(record.position,log.indexOf('\n',record.position));
function logRefuse(label,bad) {
  assert.notEqual(bad,log);assert.deepEqual(parseOwnerLog(log,proof.captures.length/3),records);
  assert.throws(()=>parseOwnerLog(bad,proof.captures.length/3));checks.push({name:label,actualPositivePassed:true,refused:true});
}
logRefuse('failed heap immutability',log.replace(line,line.replace('heap-same=1','heap-same=0')));
logRefuse('failed clock immutability',log.replace(line,line.replace('clock-same=1','clock-same=0')));
logRefuse('failed hook immutability',log.replace(line,line.replace('hooks-same=1','hooks-same=0')));
logRefuse('wrong world state',log.replace(line,line.replace('world-null=1','world-null=0')));
logRefuse('missing owner capture',log.replace(line+'\n',''));
logRefuse('duplicate owner capture',log.replace(line,line+'\n'+line));
logRefuse('malformed extra owner capture',log+'\n[streaming] World owners invalid\n');
const r={qualified:true,scope:'Actual native owner metadata and all nested save/revisit/heap/caller gates requalified; contradictory metadata and immutable-boundary logs refuse in memory. Embedded cache-entry references remain unknown in this probe.',
  sourceManifest:proof.sourceManifest,sourceManifestSha256:proof.sourceManifestSha256,controlsRefused:checks.length,checks,
  allocationOwnershipQualified:false,safeCacheEvictionQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,
  sourceSha256:{...proof.sourceSha256,'scripts/check-native-buffer-owners-controls.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:proof.evidenceSha256};
await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,controlsRefused:checks.length}));
