// Compare build settings using a test-only copy of the staged resize function.
// Constants are substituted in this model; the served glue is never edited.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,rm} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url),output=new URL('output/conservative-growth-policy-observed.json',root);
await rm(output,{force:true});
const configPath='output/web-memory-policy-config-observed.json';
const config=JSON.parse(await readFile(new URL(configPath,root),'utf8'));
assert.equal(config.qualified,true);assert.equal(config.defaultPolicy,'legacy');
const gluePath='upstream/majesty-recomp/build/web-site/majesty/MajestyRecomp.js';
const glue=await readFile(new URL(gluePath,root),'utf8');
const start=glue.indexOf('function _emscripten_resize_heap(requestedSize) {');
const end=glue.indexOf('\n}\n',start)+2;
assert.ok(start>=0&&end>start&&end-start<8192);
const original=glue.slice(start,end),stepExpression='oldSize * (1 + .2 / cutDown)',capExpression='requestedSize + 100663296';
assert.equal(original.split(stepExpression).length,2);assert.equal(original.split(capExpression).length,2);
const initial=536870912,page=65536,maximum=4294901760,policies={};
for(const [name,policy] of Object.entries(config.policies)){
  const code=original.replace(stepExpression,`oldSize * (1 + ${policy.step} / cutDown)`)
    .replace(capExpression,`requestedSize + ${policy.excessCapBytes}`);
  function run(requested,successAt=1){
    const attempts=[],errors=[];
    const context=vm.createContext({requestedSizeForProbe:requested,HEAPU8:{length:initial},growMemViews(){},
      getHeapMax:()=>maximum,alignMemory:(n,alignment)=>Math.ceil(n/alignment)*alignment,
      growMemory:n=>{attempts.push(n);return attempts.length===successAt;},err:error=>errors.push(error)});
    const accepted=vm.runInContext(code+'\n_emscripten_resize_heap(requestedSizeForProbe)',context,{timeout:1000});
    for(const n of attempts)assert.ok(n>=requested&&n<=maximum&&n%page===0);
    return {requestedBytes:requested,accepted,attemptedCapacitiesBytes:attempts,errorCount:errors.length};
  }
  const first=run(initial+1),retry=run(initial+1,3),refused=run(initial+1,Infinity),large=run(1073741825);
  assert.equal(first.accepted,true);assert.equal(retry.accepted,true);
  assert.equal(refused.accepted,false);assert.equal(refused.errorCount,1);
  assert.deepEqual(refused.attemptedCapacitiesBytes,retry.attemptedCapacitiesBytes);
  assert.deepEqual(large.attemptedCapacitiesBytes,[1073741824+page]);
  policies[name]={first,retry,refused,large};
}
assert.deepEqual(policies.legacy.first.attemptedCapacitiesBytes,[637599744]);
assert.deepEqual(policies.conservative.first.attemptedCapacitiesBytes,[553713664]);
assert.deepEqual(policies.conservative.retry.attemptedCapacitiesBytes,[553713664,
  Math.ceil(initial*41/(40*page))*page,Math.ceil(initial*81/(80*page))*page]);
assert.ok(policies.conservative.retry.attemptedCapacitiesBytes.every((n,i,a)=>i===0||n<a[i-1]));
assert.equal(policies.legacy.first.attemptedCapacitiesBytes[0]-policies.conservative.first.attemptedCapacitiesBytes[0],80*1048576);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sources=[gluePath,'scripts/check-conservative-growth-policy.mjs'];
const hashes={};for(const name of sources)hashes[name]=sha(await readFile(new URL(name,root)));
const report={qualified:true,scope:'numeric model of staged resize function with constants from evaluated CMake policies',
  policies,cases:8,testOnlyConstantsSubstituted:true,servedGlueEdited:false,
  modeledFirstAttemptReductionBytes:80*1048576,nodeVersion:process.versions.node,
  sourceSha256:hashes,evidenceSha256:{[configPath]:sha(await readFile(new URL(configPath,root)))},
  realWasmMemoryAllocated:false,wholeModuleCompiled:false,workerStarted:false,
  nativeBuildRun:false,gameLaunched:false,browserUsed:false,browserMemoryMeasured:false,
  compiledConservativePolicyQualified:false,crashResolved:false};
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,cases:8,modeledFirstAttemptMiB:528.0625,modeledReductionMiB:80,realWasmMemoryAllocated:false}));
