#!/usr/bin/env node
// Preserve initialization045 and its actual hero producers before runtime work.
import {readFile,writeFile,mkdtemp,open,chmod,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hashNativeFile,NATIVE_SOURCES} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {inspectConnectedLoadTransforms} from './inspect-native-connected-load-transforms.mjs';
import {inspectGeneratedHero} from './inspect-native-generated-hero.mjs';
const output=join(workspace,'output/native-initialization-generation-045-preserved.json');
try{await lstat(output);throw Error('Preserve previous archive');}catch(e){if(e.code!=='ENOENT')throw e;}
const build=JSON.parse(await readFile(join(workspace,'output/native-world-residency-build-045.json'),'utf8'));
assert.equal(build.nativeBuildQualified,true);
assert.equal(build.nativeExecutableSha256,'064a7bb4596bddc4723a3db04c531268dd4548fc93e05ee50aa5eff7b9939c9b');
const cause=await inspectConnectedLoadTransforms(join(workspace,'output/native-connected-residency-attempt-007.json'),join(workspace,'output/native-connected-load-transforms-setter-audit.json'));
assert.equal(cause.generatedRegionInitializationQualified,true);
for(const attempt of ['002','003'])await inspectGeneratedHero(join(workspace,`output/native-generated-hero-attempt-${attempt}.json`));
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-native-generation-'));
let largestWrite=0;
async function copy(from,name,maximum){
 const filename=join(directory,name),f=await open(filename,'wx');let at=0;
 try{const copied=await hashNativeFile(from,{maximum,async sink(b){largestWrite=Math.max(largestWrite,b.length);let used=0;while(used<b.length){const {bytesWritten}=await f.write(b,used,b.length-used,at);assert.ok(bytesWritten);used+=bytesWritten;at+=bytesWritten;}}});await f.sync();assert.deepEqual(await hashNativeFile(filename,{maximum}),copied);return {filename,...copied};}finally{await f.close();}
}
const sources={};for(const name of NATIVE_SOURCES){sources[name]=await copy(join(workspace,name),name.split('/').at(-1),1024*1024);assert.equal(sources[name].sha256,build.nativeSourceSha256[name]);}
const nativeExecutable=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'),'pop_smoke',128*1024*1024);
assert.equal(nativeExecutable.sha256,build.nativeExecutableSha256);await chmod(nativeExecutable.filename,0o755);
const nativeSymbols=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json'),'symbols.json',32*1024*1024);
assert.equal(nativeSymbols.sha256,build.nativeSymbolsSha256);
const evidence={};for(const name of ['native-world-residency-build-045.json','native-connected-residency-attempt-007.json','native-generated-hero-attempt-002.json','native-generated-hero-attempt-003.json']){const path=join(workspace,'output',name);evidence[path]=createHash('sha256').update(await readFile(path)).digest('hex');}
await writeFile(output,JSON.stringify({version:1,artifactPreserved:true,directory,sources,nativeSourceSha256:build.nativeSourceSha256,nativeExecutable,nativeSymbols,evidence,scope:'Exact native045 generation independently revalidated for zero-tick initialization, warm returns and original hero recruitment. Remote homes, hero crossing and full handoff remain unqualified.',generatedRegionInitializationQualified:true,playerHeroCaptureQualified:true,fullGeneratedRegionHandoffQualified:false,largestRead:4096,largestWrite,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({artifactPreserved:true,bytes:nativeExecutable.bytes,largestRead:4096,largestWrite}));
