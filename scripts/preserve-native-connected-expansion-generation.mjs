#!/usr/bin/env node
// Preserve exact generated-neighbor102 inputs for later runtime development.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,open,chmod,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {hashNativeFile,NATIVE_SOURCES} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [generationName,initializationName,causesName,outputName]=process.argv.slice(2);
assert.equal(process.argv.length,6,'Usage: <generation proof> <initialization proof> <cold-load cause proof> <fresh archive report>');
async function json(name){assert.ok((await stat(name)).size<=512*1024);return JSON.parse(await readFile(name,'utf8'));}
const generation=await json(generationName),initialization=await json(initializationName),causes=await json(causesName);
assert.equal(generation.qualified,true);assert.equal(generation.thirdOriginalKingdomGenerated,true);
assert.equal(initialization.qualified,true);assert.equal(initialization.generatedNeighborInitializationQualified,true);
assert.equal(initialization.firstGeneratedLoadsPreserved,false);assert.equal(initialization.initializedRegionsReturnedWithoutStateChanges,true);
assert.equal(causes.loadTransformCausesQualified,true);assert.equal(causes.generatedRegionInitializationQualified,true);
assert.equal(causes.sourceManifest,initialization.sourceManifest);assert.equal(causes.sourceManifestSha256,initialization.sourceManifestSha256);
const evidence={};for(const [name,proof] of [[generationName,generation],[initializationName,initialization],[causesName,causes]]){
 evidence[name]=(await hashNativeFile(name)).sha256;
 assert.equal((await hashNativeFile(proof.sourceManifest)).sha256,proof.sourceManifestSha256);
 const manifest=await json(proof.sourceManifest);assert.equal(manifest.nativeSessionTerminal,true);assert.equal(manifest.nativeExitCode,0);
 try{process.kill(manifest.nativePid,0);throw Error('Native game still live');}catch(e){if(e.code!=='ESRCH')throw e;}
 for(const [file,digest] of Object.entries(proof.evidenceSha256)){assert.equal((await hashNativeFile(file)).sha256,digest);evidence[file]=digest;}
 for(const [file,digest] of Object.entries(proof.sourceSha256)){assert.equal((await hashNativeFile(file)).sha256,digest);evidence[join(workspace,file)]=digest;}
}
const manifest=await json(generation.sourceManifest),build=await json(manifest.buildReport);
assert.equal((await hashNativeFile(manifest.buildReport)).sha256,manifest.buildReportSha256);
const initManifest=await json(initialization.sourceManifest);assert.equal(initManifest.nativeExecutableSha256,build.nativeExecutableSha256);
assert.deepEqual(initManifest.nativeSourceSha256,build.nativeSourceSha256);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-native-generation-'));
let largestWrite=0;
async function copy(from,name,maximum){
 const filename=join(directory,name),f=await open(filename,'wx');let at=0;
 try{const result=await hashNativeFile(from,{maximum,async sink(bytes){largestWrite=Math.max(largestWrite,bytes.length);let used=0;
  while(used<bytes.length){const{bytesWritten}=await f.write(bytes,used,bytes.length-used,at);assert.ok(bytesWritten);used+=bytesWritten;at+=bytesWritten;}}});
  await f.sync();assert.deepEqual(await hashNativeFile(filename,{maximum}),result);return{filename,...result};
 }finally{await f.close();}
}
const sources={};for(const name of NATIVE_SOURCES){sources[name]=await copy(join(workspace,name),name.split('/').at(-1),1024*1024);assert.equal(sources[name].sha256,build.nativeSourceSha256[name]);}
const nativeExecutable=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'),'pop_smoke',128*1024*1024);
assert.equal(nativeExecutable.sha256,build.nativeExecutableSha256);await chmod(nativeExecutable.filename,0o755);
const nativeSymbols=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json'),'symbols.json',32*1024*1024);
assert.equal(nativeSymbols.sha256,build.nativeSymbolsSha256);
await writeFile(outputName,JSON.stringify({version:1,artifactPreserved:true,directory,sources,nativeSourceSha256:build.nativeSourceSha256,
 nativeExecutable,nativeSymbols,evidence,thirdOriginalKingdomGenerated:true,generatedNeighborInitializationQualified:true,
 firstGeneratedLoadsPreserved:false,multiWayTravelQualified:false,heroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0,
 largestRead:4096,largestWrite,scope:'Exact native102, authentic third generated kingdom, original cold-load cause checks, zero-tick publication and full saved warm-return comparisons. Three-way coordinate travel and browser/multiplayer integration remain unqualified.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({artifactPreserved:true,largestRead:4096,largestWrite}));
