// Match shipped JavaScript against bounded original x86 observations and
// previously qualified stopped-save drafts, without creating any GMP file.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {nativeHeightQ16,nativeHeightBits,requireStableNativeHeight} from '../web/world/native-height.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {reconcileTerrainHeights} from '../web/world/terrain-reconcile.mjs';

const root=resolve(import.meta.dirname,'..'),load=async name=>JSON.parse(await readFile(join(root,'output',name),'utf8'));
const cpu=await load('native-height-emulated-observed.json');
assert.equal(cpu.executableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
assert.ok(cpu.pinUnchanged&&cpu.unpinnedInputRejectedBeforePeDecode);
for(const value of cpu.vectors){
  if(value.safeRange)assert.equal(nativeHeightQ16(value.bits),value.nativeQ16);
  else assert.throws(()=>nativeHeightQ16(value.bits));
  assert.equal(nativeHeightBits(value.nativeQ16),value.writerBits);
  if(value.stable)requireStableNativeHeight(value.bits);
  else assert.throws(()=>requireStableNativeHeight(value.bits));
}
for(const value of cpu.writerExtremes)assert.equal(nativeHeightBits(value.nativeQ16),value.writerBits);

const summary=await load('actor-transfer-case-summary.json'),fixture=summary.committedFixture;
assert.ok(typeof fixture==='string'&&fixture.startsWith(join(root,'upstream/majesty-recomp/build/actor-arrival-fixture-')));
const originalProof=await load('native-terrain-real-files-observed.json'),draftProof=await load('native-terrain-reconcile-real-files-observed.json');
let largestRead=0,largestWrite=0,openFiles=0,maxOpenFiles=0;
async function source(filename){
  const info=await stat(filename);return {size:info.size,async readAt(at,n){
    assert.ok(n<=4096&&at>=0&&at+n<=info.size);largestRead=Math.max(largestRead,n);
    const fd=await open(filename,'r');++openFiles;maxOpenFiles=Math.max(maxOpenFiles,openFiles);
    try{const bytes=new Uint8Array(n),read=await fd.read(bytes,0,n,at);assert.equal(read.bytesRead,n);return bytes;}
    finally{await fd.close();--openFiles;}
  }};
}
async function digest(input){
  const hash=createHash('sha256');
  for(let at=0;at<input.size;at+=4096)hash.update(await input.readAt(at,Math.min(4096,input.size-at)));
  return hash.digest('hex');
}
const cases=[];
for(const stage of ['Before','After']){
  const names=[`Source_${stage}.GMP`,`Destination_${stage}.GMP`],files=names.map(name=>join(fixture,name));
  const info=await Promise.all(files.map(file=>stat(file))),inputs=[];
  for(let i=0;i<2;++i){
    inputs.push(await source(files[i]));
    assert.equal(await digest(inputs[i]),originalProof.reports.find(r=>r.name===names[i]).report.fileSha256);
  }
  const terrain=await checkpointTerrain(inputs[0]),hash=createHash('sha256');let copied=0;
  const result=await reconcileTerrainHeights({source:inputs[1],borders:[{side:'left',sourceSide:'right',terrain}]},
    {write(bytes){largestWrite=Math.max(largestWrite,bytes.length);copied+=bytes.length;hash.update(bytes);}});
  const previous=draftProof.cases.find(c=>c.stage===stage).report;
  assert.equal(copied,inputs[1].size);assert.deepEqual(result,previous);assert.equal(hash.digest('hex'),previous.sha256);
  for(let i=0;i<2;++i){
    const after=await stat(files[i]);assert.equal(after.size,info[i].size);assert.equal(after.mtimeMs,info[i].mtimeMs);assert.equal(after.ctimeMs,info[i].ctimeMs);
    assert.equal(await digest(inputs[i]),originalProof.reports.find(r=>r.name===names[i]).report.fileSha256);
  }
  cases.push({stage,changedVertices:result.changedVertices,sha256:result.sha256,exactPreviousDraftResult:true,inputsUnchanged:true,gmpWrites:0});
}
assert.equal(openFiles,0);assert.equal(maxOpenFiles,1);
const report={qualification:'shipped height conversion and stopped draft reconciliation; terminal only',
  originalCpuEvidence:'output/native-height-emulated-observed.json',conversionVectors:cpu.vectors.length,writerExtremes:cpu.writerExtremes.length,
  safeRangesMatchOriginal:true,noncanonicalDonorsRejected:true,cases,largestRead,largestWrite,maxOpenFiles,
  sourcesSha256:Object.fromEntries(await Promise.all(['native-height.mjs','terrain-reconcile.mjs'].map(async name=>['web/world/'+name,createHash('sha256').update(await readFile(join(root,'web/world',name))).digest('hex')]))),
  browserLaunches:0,gameLaunches:0,builds:0,
  limitations:['copied GMP data is streamed only to a hash sink; no native reload','no actor-height or normal/shading validation','no generated shared terrain, live paging or co-op handoff qualification']};
await writeFile(join(root,'output/native-height-terminal-qualified.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,conversionVectors:report.conversionVectors,cases:cases.length,largestRead,largestWrite,maxOpenFiles,gmpWrites:0}));
