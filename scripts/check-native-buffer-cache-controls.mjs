#!/usr/bin/env node
// Negative controls use copies of actual cache observations, with no guest process.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyBufferCache,assertCacheCapture} from './check-native-buffer-cache.mjs';
import {parseOwnerLog} from './check-native-buffer-owners.mjs';
import {parseHeapMetadata} from './check-native-world-heap.mjs';
import {parseMallocAllocationEvents} from './check-native-malloc-sites.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const proof=await verifyBufferCache(name),m=JSON.parse(await readFile(name)),log=(await readFile(m.log)).toString('utf8');
const visits=proof.captures.length/3,events=parseMallocAllocationEvents(log,visits),records=parseOwnerLog(log,visits,72);
const observed=proof.captures.find(c=>c.stage==='after-exit'&&c.backlinked>0&&c.embeddedReadable>0);assert.ok(observed);
const record=records.find(c=>c.visit===observed.visit&&c.stage===observed.stage),actual=await readFile(observed.filename);
const heap=parseHeapMetadata(await readFile(join(m.profile,`Heap_Visit_${record.visit}_${record.stage}.bin`)),record.visit,record.stage);
const check=(bytes,data=heap)=>assertCacheCapture(bytes,record,data,events),golden=check(actual),checks=[];
function refuse(label,bad,data=heap) {
  assert.ok(!bad.equals(actual)||data!==heap);assert.deepEqual(check(actual),golden);assert.throws(()=>check(bad,data));
  checks.push({name:label,actualPositivePassed:true,refused:true});
}
function word(label,at,value) {const b=Buffer.from(actual);b.writeUInt32LE(value>>>0,at);refuse(label,b);}
word('wrong metadata magic',0,0);word('wrong cache schema version',4,1);
word('wrong visit',8,31);word('wrong stage',12,0);word('wrong target size',16,12224);
word('unbounded target capacity',20,513);word('wrong row size',24,60);
word('changed clock',28,golden.clock+1);word('changed hooks',32,golden.hooks+1);
word('changed event count',36,golden.allocationEvents+1);
refuse('truncated cache row',actual.subarray(0,actual.length-4));
refuse('duplicate target cache row',Buffer.concat([actual,actual.subarray(40,112)]));
const row=golden.rows.findIndex(r=>r.storageKind===2&&r.backlink===r.owner&&r.ownerBuffer===r.buffer);assert.ok(row>=0);
const at=40+row*72,r=golden.rows[row];
word('unaligned buffer',at,r.buffer+1);word('wrong surviving event',at+4,0);
word('unaligned owner',at+8,r.owner+1);word('owner flag contradicts allocated payload',at+12,0);
word('invalid CRT owner size',at+16,57);word('wrong interpreted owner type',at+20,0x688a74);
word('invented owner buffer link',at+24,0);word('unaligned cache node',at+28,r.node+1);
word('reading fields in unknown cache storage',at+32,0);
word('wrong available cache bytes',at+36,r.nodeBytes+1);
word('backlinked data size contradicts actual allocation',at+48,r.dataBytes+1);
word('unsupported cache storage kind',at+60,3);
word('large embedded storage cannot be an exact CRT small block',at+60,1);
word('invented containing allocation',at+64,r.storageBase+16);
word('wrong containing allocation size',at+68,r.storageBytes+1);
word('cache fields beyond containing allocation',at+28,r.storageBase+r.storageBytes-4);
const crt=structuredClone(heap);crt.records.find(a=>a.address===r.storageBase).kind=3;
refuse('CRT reservation does not prove interior cache storage',Buffer.from(actual),crt);
const line=log.slice(record.position,log.indexOf('\n',record.position));
function logRefuse(label,bad) {
  assert.notEqual(bad,log);assert.deepEqual(parseOwnerLog(log,visits,72),records);
  assert.throws(()=>parseOwnerLog(bad,visits,72));checks.push({name:label,actualPositivePassed:true,refused:true});
}
for(const key of ['heap-same','clock-same','hooks-same'])logRefuse(`failed ${key}`,log.replace(line,line.replace(`${key}=1`,`${key}=0`)));
logRefuse('wrong world state',log.replace(line,line.replace('world-null=1','world-null=0')));
logRefuse('missing cache observation',log.replace(line+'\n',''));
logRefuse('duplicated cache observation',log.replace(line,line+'\n'+line));
logRefuse('malformed cache observation',log+'\n[streaming] World owners invalid\n');
const report={qualified:true,scope:'Actual original persistence and bounded embedded-cache metadata gates requalified. Contradictory storage bounds, owner/event links and immutable boundary logs refuse using copies. No claim that all plausible altered data can be detected independently of the recorded guest observation.',
  sourceManifest:proof.sourceManifest,sourceManifestSha256:proof.sourceManifestSha256,controlsRefused:checks.length,checks,
  safeCacheEvictionQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,
  sourceSha256:{...proof.sourceSha256,'scripts/check-native-buffer-cache-controls.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:proof.evidenceSha256};
await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,controlsRefused:checks.length}));
