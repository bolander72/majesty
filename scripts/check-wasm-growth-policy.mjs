// Extract only the staged resize function; model capacities as numbers.
// No WASM heap, browser, worker, module compilation or native code execution.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,rm} from 'node:fs/promises';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const output=new URL('output/wasm-growth-policy-observed.json',root);
await rm(output,{force:true});
const path='upstream/majesty-recomp/build/web-site/majesty/MajestyRecomp.js';
const glue=await readFile(new URL(path,root),'utf8');
const start=glue.indexOf('function _emscripten_resize_heap(requestedSize) {');
const end=glue.indexOf('\n}\n',start)+2;
assert.ok(start>=0&&end>start);
const code=glue.slice(start,end);
assert.ok(code.length<8192);
assert.equal(glue.indexOf('function _emscripten_resize_heap(requestedSize) {',start+1),-1);
const initial=536870912,maximum=4294901760,page=65536;
function run(name,requested,successAt=1){
  const attempts=[],errors=[];
  const context=vm.createContext({HEAPU8:{length:initial},growMemViews(){},
    getHeapMax:()=>maximum,alignMemory:(n,alignment)=>Math.ceil(n/alignment)*alignment,
    growMemory:size=>{attempts.push(size);return attempts.length===successAt;},err:value=>errors.push(value),
    requestedSizeForProbe:requested});
  const accepted=vm.runInContext(code+'\n_emscripten_resize_heap(requestedSizeForProbe)',context,{timeout:1000});
  for(const capacity of attempts){
    assert.ok(Number.isSafeInteger(capacity)&&capacity%page===0);
    assert.ok(capacity>=requested&&capacity<=maximum);
  }
  return {name,requestedBytes:requested,accepted,attemptedCapacitiesBytes:attempts,errorCount:errors.length};
}
const first=run('one byte beyond initial capacity',initial+1);
assert.deepEqual(first.attemptedCapacitiesBytes,[608*1048576+page]);
assert.equal(first.accepted,true);
const retry=run('first two growth attempts refused',initial+1,3);
// Independent integer-ratio expectations for 10% and 5% retry growth.
assert.deepEqual(retry.attemptedCapacitiesBytes,[608*1048576+page,
  Math.ceil(initial*11/(10*page))*page,Math.ceil(initial*21/(20*page))*page]);
assert.equal(retry.accepted,true);
const refused=run('all growth attempts refused',initial+1,Infinity);
assert.deepEqual(refused.attemptedCapacitiesBytes,retry.attemptedCapacitiesBytes);
assert.equal(refused.accepted,false);assert.equal(refused.errorCount,1);
const unchanged=run('request at current capacity',initial);
assert.equal(unchanged.accepted,false);assert.deepEqual(unchanged.attemptedCapacitiesBytes,[]);
const over=run('request beyond effective heap limit',maximum+1);
assert.equal(over.accepted,false);assert.deepEqual(over.attemptedCapacitiesBytes,[]);assert.equal(over.errorCount,1);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const result={qualified:true,scope:'staged JS resize function with numeric capacities and mocked allocation results',
  cases:[first,retry,refused,unchanged,over],extractedFunctionBytes:Buffer.byteLength(code),
  extractedFunctionSha256:sha(code),nodeVersion:process.versions.node,
  sourceSha256:{[path]:sha(glue),'scripts/check-wasm-growth-policy.mjs':sha(await readFile(new URL('scripts/check-wasm-growth-policy.mjs',root)))},
  realWasmMemoryAllocated:false,wholeModuleCompiled:false,workerStarted:false,
  gameLaunched:false,browserUsed:false,nativeBuildRun:false,
  browserMemoryMeasured:false,crashResolved:false};
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:true,cases:5,firstAttemptMiB:first.attemptedCapacitiesBytes[0]/1048576,realWasmMemoryAllocated:false}));
