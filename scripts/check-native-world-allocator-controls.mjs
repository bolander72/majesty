#!/usr/bin/env node
// Contradict actual boundary-tag accounting without another native launch.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyWorldAllocator,parseWorldAllocator} from './check-native-world-allocator.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [manifest,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal manifest> <fresh controls report>');
const proof=await verifyWorldAllocator(manifest),m=JSON.parse(await readFile(manifest,'utf8'));
const log=await readFile(m.log,'utf8');assert.equal(sha(log),proof.evidenceSha256[m.log]);
const count=proof.visits.length,rows=log.match(/^\[streaming\] World allocator .*$/gm);assert.equal(rows.length,count*3);
const checks=[];
function refuses(name,bad) {
  assert.notEqual(bad,log);assert.deepEqual(parseWorldAllocator(log,count),proof.visits);
  assert.throws(()=>parseWorldAllocator(bad,count));checks.push({name,unchangedActualPositivePassed:true,refused:true});
}
function changed(name,pattern,replacement,index=rows.length-1) {
  const row=rows[index],bad=row.replace(pattern,replacement);assert.notEqual(bad,row);
  refuses(name,log.replace(row,bad));
}
for(const field of ['heap-same','crt-same','clock-same','hooks-same'])changed('observer changed '+field,new RegExp(field+'=1'),field+'=0');
changed('failed observation',/result=pass/,'result=fail');
changed('wrong visit',/visit=\d+/,'visit='+count);
changed('wrong world lifetime',/world-null=1/,'world-null=0');
changed('unbounded observation time',/elapsed-us=\d+/,'elapsed-us=2000001');
changed('wrong observation stage',/stage=after-exit/,'stage=load');
changed('too many pools',/pools=\d+/,'pools=65');
changed('too many committed groups',/committed-groups=\d+/,'committed-groups=513');
changed('no committed groups',/committed-groups=\d+/,'committed-groups=0');
changed('unbounded header walk',/walked=\d+/,'walked=600001');
changed('missing header walk bound',/ walked=\d+/,'');
changed('table backing too short',/table-bytes=\d+/,'table-bytes=16');
changed('wrong reserved size',/reserved-bytes=\d+/,()=> 'reserved-bytes='+(proof.visits.at(-1).afterExit.reservedBytes+16));
changed('wrong known backing sum',/known-heap-bytes=\d+/,()=> 'known-heap-bytes='+(proof.visits.at(-1).afterExit.knownHeapBytes+16));
changed('wrong other heap residual',/other-heap-bytes=\d+/,()=> 'other-heap-bytes='+(proof.visits.at(-1).afterExit.otherHeapBytes+16));
changed('wrong live count',/live-count=\d+/,()=> 'live-count='+(proof.visits.at(-1).afterExit.liveCount+1));
changed('wrong rounded live bytes',/live-bytes=\d+/,()=> 'live-bytes='+(proof.visits.at(-1).afterExit.liveBytes+16));
changed('wrong free bytes',/free-bytes=\d+/,()=> 'free-bytes='+(proof.visits.at(-1).afterExit.freeBytes+16));
changed('wrong heap block count',/heap-blocks=\d+/,()=> 'heap-blocks='+(proof.visits.at(-1).afterExit.heapBlocks+1));
changed('missing histogram bucket',/classes=([0-9,]+)/,(_,v)=>'classes='+v.split(',').slice(1).join(','));
changed('extra histogram bucket',/(classes=[0-9,]+)/,'$1,0');
changed('changed histogram count',/classes=\d+/,()=> 'classes='+(proof.visits.at(-1).afterExit.classes[0]+1));
changed('invalid histogram number',/classes=\d+/,'classes=NaN');
refuses('missing final allocator observation',log.replace(rows.at(-1)+'\n',''));
refuses('duplicate allocator observation',log+rows.at(-1)+'\n');
const before=rows.at(-2),after=rows.at(-1);
refuses('before-exit allocator observed after exit',log.replace(before+'\n','').replace(after,after+'\n'+before));
const survivor=log.match(new RegExp('^\\[streaming\\] World survivors visit='+(count-1)+' stage=after-exit .*$', 'm'))[0];
refuses('missing paired scripting observation',log.replace(survivor+'\n',''));
const report={qualified:true,scope:'Actual original persistence, scripting observations and allocator accounting requalified; contradictory size/lifetime/accounting/mutation evidence refuses without another native process.',
  sourceManifest:proof.sourceManifest,sourceManifestSha256:proof.sourceManifestSha256,checks,controlsRefused:checks.length,
  browserUsed:false,nativeProcessesStarted:0,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,
  sourceSha256:{...proof.sourceSha256,'scripts/check-native-world-allocator-controls.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:proof.evidenceSha256};
await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,controlsRefused:checks.length}));
