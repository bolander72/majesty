#!/usr/bin/env node
import {readFile,writeFile,mkdtemp,open,chmod,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {hashNativeFile,NATIVE_SOURCES} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {inspectNativeRemoteHome} from './inspect-native-remote-home.mjs';
const out=join(workspace,'output/native-remote-home-generation-059-preserved.json');
try{await lstat(out);throw Error('Preserve previous archive');}catch(e){if(e.code!=='ENOENT')throw e;}
const proof=await inspectNativeRemoteHome(join(workspace,'output/native-remote-home-attempt-002.json'));
assert.equal(proof.originalRemoteHomeReloadQualified,true);
assert.equal(proof.nativeExecutableSha256,'6b66f3e04300906f44a01c1796d0cc364d6635eda01a560d22b86bcf4fc7c13e');
const build=JSON.parse(await readFile(join(workspace,'output/native-world-residency-build-059.json'),'utf8'));
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
  nativeExecutable,nativeSymbols,evidence:{[proof.sourceManifest]:proof.sourceManifestSha256},
  scope:'Exact native059 original registration/serialization/full-save/reload of one unscheduled pure remote-guild identity in initialized1_0, preserving actual registered0_0 guild metadata. No hero import, return routing or regional ownership transfer.',
  originalRemoteHomeRecordQualified:true,originalRemoteHomeFullSaveQualified:true,originalRemoteHomeReloadQualified:true,
  nativeHeroHomeProjectionQualified:false,heroCrossingQualified:false,largestRead:4096,largestWrite,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({artifactPreserved:true,largestWrite}));
