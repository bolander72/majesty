#!/usr/bin/env node
// Actual successful trace as positive; contradictory/unfinished traces refuse.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyWorldResidency,parseWorldResidency} from './check-native-world-residency.mjs';
const [manifest,out]=process.argv.slice(2);if(!manifest||!out||process.argv.length!==4)throw Error('Usage: <terminal residency manifest> <fresh control report>');
const p=await verifyWorldResidency(manifest),log=await readFile(p.fixture.log,'utf8');
assert.deepEqual(parseWorldResidency(log),p.cycles);
const final=p.cycles[2],cases=[
  ['missing-final-unload',s=>s.replace(/^\[streaming\] World residency exit=2 .*\n/m,'')],
  ['world-still-attached',s=>s.replace('world-null=1','world-null=0')],
  ['navigation-root-not-freed',s=>s.replace('roots-freed=1,1,1,1,1,1','roots-freed=1,1,1,1,0,1')],
  ['root-freed-twice',s=>s.replace('roots-freed=1,1,1,1,1,1','roots-freed=1,1,2,1,1,1')],
  ['no-heap-release',s=>s.replace('heap-after='+final.after.heap,'heap-after='+final.before.heap)],
  ['no-crt-release',s=>s.replace('crt-after='+final.after.crt,'crt-after='+final.before.crt)],
  ['inconsistent-heap',s=>s.replace('heap-valid=1','heap-valid=0')],
  ['observer-count-changed',s=>s.replace('hooks-same=1','hooks-same=0')],
  ['wrong-dispatcher-transition',s=>s.replace('observed-ticks=20 pending=4','observed-ticks=20 pending=6')],
  ['unobserved-gameplay',s=>s.replace('observed-ticks=20','observed-ticks=0')],
  ['wrong-world-size',s=>s.replace('load=1 extent=512','load=1 extent=256')],
];
const observed=[];
for(const [name,mutate] of cases) {
  // The unchanged actual stopped run passes immediately before each mutation.
  assert.deepEqual(parseWorldResidency(log),p.cycles);
  const changed=mutate(log);assert.notEqual(changed,log,'Control did not affect actual trace');
  let message;try{parseWorldResidency(changed);}catch(e){message=e.message;}
  assert.ok(message,'Contradictory teardown trace accepted');observed.push({name,refused:true,message});
}
const partialName=resolve('output/native-world-residency-attempt-004.log'),partial=await readFile(partialName,'utf8');
assert.ok(partial.includes('all expectations met')&&partial.includes('[recomp] ExitProcess(0)'));
assert.throws(()=>parseWorldResidency(partial));observed.push({name:'actual-exit-zero-incomplete-cycle',refused:true});
const sha=s=>createHash('sha256').update(s).digest('hex');
assert.equal(await readFile(p.fixture.log,'utf8'),log);assert.equal(await readFile(partialName,'utf8'),partial);
await writeFile(out,JSON.stringify({qualified:true,scope:'Actual independently qualified native trace passes before eleven contradictory trace controls; actual earlier incomplete exit0 run also refuses. No additional native processes, browser use, power-loss or generic paging qualification.',
  sourceManifest:resolve(manifest),sourceManifestSha256:p.sourceManifestSha256,controls:observed,positiveCycles:p.cycles.length,
  evidenceSha256:{[p.fixture.log]:sha(log),[partialName]:sha(partial)},canonicalLogsUnchanged:true,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,controls:observed.length,actualIncompleteExitZeroRefused:true}));
