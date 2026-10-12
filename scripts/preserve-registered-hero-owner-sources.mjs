#!/usr/bin/env node
// Freeze the exact stopped publication's two ownership validators before upgrading them.
import assert from 'node:assert/strict';
import {open,mkdtemp,writeFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {inspectNativeHeroHandoff} from './inspect-native-hero-handoff.mjs';
import {handoffJson} from './lib/registered-hero-handoff.mjs';
const publication=join(workspace,'output/native-hero-handoff-001-published.json');
const publicationSha256='00d5184c535285d3abb7ec5e6fa6f55f7a9d19002fbf2ed40a4f9191c2b18f68';
const expected={
 'web/world/entity-ownership.mjs':'b9f014f309b36ee45d8d9c87039302ea59e7553a15f3599fc887a69d570a2df7',
 'web/world/entity-home-ownership.mjs':'3d4d8d32ae7c23c413a9a11b49876d632fd0dbd3f56f80892f031cbbabdbc8fb'};
const out=join(workspace,'output/native-hero-owner-source-generation-preserved.json');
try{await lstat(out);throw Error('Preserve previous archive');}catch(e){if(e.code!=='ENOENT')throw e;}
assert.equal((await hashNativeFile(publication,{maximum:256*1024})).sha256,publicationSha256);
await inspectNativeHeroHandoff(publication);
const pub=await handoffJson(publication);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-code-'));
const sources={};let largestWrite=0;
for(const [name,sha256]of Object.entries(expected)) {
 assert.equal(pub.sourceSha256[name],sha256);
 const filename=join(directory,name.split('/').at(-1)),f=await open(filename,'wx');let at=0;
 try {
  const h=await hashNativeFile(join(workspace,name),{maximum:64*1024,async sink(b){
   largestWrite=Math.max(largestWrite,b.length);let used=0;
   while(used<b.length){const {bytesWritten}=await f.write(b,used,b.length-used,at);assert.ok(bytesWritten);used+=bytesWritten;at+=bytesWritten;}
  }});
  assert.equal(h.sha256,sha256);await f.sync();assert.deepEqual(await hashNativeFile(filename,{maximum:64*1024}),h);
  sources[name]={filename,...h};
 }finally{await f.close();}
}
await writeFile(out,JSON.stringify({version:1,artifactPreserved:true,publication,publicationSha256,
 directory,sourceSha256:pub.sourceSha256,sources,largestRead:4096,largestWrite,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({artifactPreserved:true,files:2,largestWrite}));
