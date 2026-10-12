#!/usr/bin/env node
import {readFile,writeFile,mkdtemp,open,chmod,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {hashNativeFile,NATIVE_SOURCES} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [proofName,buildName,outputName]=process.argv.slice(2);
assert.equal(process.argv.length,5,'Usage: <qualified heap report> <build report> <fresh archive report>');
const out=join(workspace,outputName);
try{await lstat(out);throw Error('Preserve previous archive');}catch(e){if(e.code!=='ENOENT')throw e;}
assert.ok((await lstat(proofName)).size<=512*1024);
const proof=JSON.parse(await readFile(proofName,'utf8'));
assert.equal(proof.actualSavedKingdomHeapMetadataQualified,true);
assert.equal(proof.actualRegisteredHeroSameProcessRegionReturnQualified,true);
const manifest=JSON.parse(await readFile(proof.sourceManifest,'utf8'));
assert.equal((await hashNativeFile(proof.sourceManifest)).sha256,proof.sourceManifestSha256);
assert.equal(manifest.nativeSessionTerminal,true);assert.equal(manifest.nativeExitCode,0);
try{process.kill(manifest.nativePid,0);throw Error('Game still live');}catch(e){if(e.code!=='ESRCH')throw e;}
const build=JSON.parse(await readFile(buildName,'utf8'));
assert.equal((await hashNativeFile(buildName)).sha256,manifest.buildReportSha256);
assert.equal(build.nativeExecutableSha256,proof.nativeExecutableSha256);
assert.deepEqual(build.nativeSourceSha256,proof.nativeSourceSha256);
assert.equal((await hashNativeFile(join(workspace,'scripts/inspect-native-hero-region-heap.mjs'))).sha256,proof.scriptSha256);
for(const [n,d]of Object.entries(proof.evidenceSha256))assert.equal((await hashNativeFile(n)).sha256,d);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-native-generation-'));
let largestWrite=0;
async function copy(from,name,maximum) {
 const filename=join(directory,name),f=await open(filename,'wx');let at=0;
 try{
  const h=await hashNativeFile(from,{maximum,async sink(b){largestWrite=Math.max(largestWrite,b.length);let used=0;
   while(used<b.length){const {bytesWritten}=await f.write(b,used,b.length-used,at);assert.ok(bytesWritten);used+=bytesWritten;at+=bytesWritten;}}});
  await f.sync();assert.deepEqual(await hashNativeFile(filename,{maximum}),h);return {filename,...h};
 }finally{await f.close();}
}
const sources={};for(const n of NATIVE_SOURCES){sources[n]=await copy(join(workspace,n),n.split('/').at(-1),1024*1024);assert.equal(sources[n].sha256,proof.nativeSourceSha256[n]);}
const nativeExecutable=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'),'pop_smoke',128*1024*1024);
assert.equal(nativeExecutable.sha256,proof.nativeExecutableSha256);await chmod(nativeExecutable.filename,0o755);
const nativeSymbols=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json'),'symbols.json',32*1024*1024);
assert.equal(nativeSymbols.sha256,build.nativeSymbolsSha256);
await writeFile(out,JSON.stringify({version:1,artifactPreserved:true,directory,sources,nativeSourceSha256:proof.nativeSourceSha256,
 nativeExecutable,nativeSymbols,evidence:{[proof.sourceManifest]:proof.sourceManifestSha256},scope:proof.scope,
 actualRegisteredHeroSameProcessRegionReturnQualified:true,
 nativeHeroHomeProjectionQualified:false,heroCrossingQualified:false,largestRead:4096,largestWrite,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({artifactPreserved:true,largestWrite}));
