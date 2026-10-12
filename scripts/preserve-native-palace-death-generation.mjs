#!/usr/bin/env node
import {readFile,writeFile,mkdtemp,open,chmod,stat} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {hashNativeFile,NATIVE_SOURCES} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [input,out]=process.argv.slice(2);assert.ok(input&&out);
try{await stat(out);throw Error('Preserve prior generation');}catch(e){if(e.code!=='ENOENT')throw e;}
const proof=JSON.parse(await readFile(input,'utf8')),manifest=JSON.parse(await readFile(proof.sourceManifest,'utf8'));
assert.equal(proof.actualNativePalaceDeathDeclarationQualified,true);assert.equal(proof.qualified,true);
try{process.kill(manifest.nativePid,0);throw Error('Producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(manifest.nativeExitCode,0);assert.equal(manifest.nativeSessionTerminal,true);
const build=JSON.parse(await readFile(manifest.buildReport,'utf8'));
for(const field of ['evidenceSha256','sourceSha256'])for(const [name,sha] of Object.entries(proof[field]))assert.equal((await hashNativeFile(name)).sha256,sha,name);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-native-generation-'));
let largestWrite=0;
async function copy(from,name,maximum){
 const filename=join(directory,name),f=await open(filename,'wx');let at=0;
 try{
  const hash=await hashNativeFile(from,{maximum,async sink(b){largestWrite=Math.max(largestWrite,b.length);let used=0;
   while(used<b.length){const {bytesWritten}=await f.write(b,used,b.length-used,at);assert.ok(bytesWritten);used+=bytesWritten;at+=bytesWritten;}}});
  await f.sync();assert.deepEqual(await hashNativeFile(filename,{maximum}),hash);return {filename,...hash};
 }finally{await f.close();}
}
const sources={};for(const name of NATIVE_SOURCES){sources[name]=await copy(join(workspace,name),name.split('/').at(-1),1024*1024);assert.equal(sources[name].sha256,proof.nativeSourceSha256[name]);}
const nativeExecutable=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'),'pop_smoke',128*1024*1024);
assert.equal(nativeExecutable.sha256,proof.nativeExecutableSha256);await chmod(nativeExecutable.filename,0o755);
const nativeSymbols=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json'),'symbols.json',32*1024*1024);
assert.equal(nativeSymbols.sha256,build.nativeSymbolsSha256);
const nativeCampaign=await copy(join(workspace,'upstream/majesty-recomp/browser_campaign.cpp'),'browser_campaign.cpp',1024*1024);
assert.equal(nativeCampaign.sha256,manifest.nativeCampaignSourceSha256);
await writeFile(out,JSON.stringify({version:1,artifactPreserved:true,directory,sources,nativeSourceSha256:proof.nativeSourceSha256,nativeExecutable,nativeSymbols,nativeCampaign,evidence:{[proof.sourceManifest]:proof.sourceManifestSha256,[input]:(await hashNativeFile(input)).sha256},scope:proof.scope,actualNativePalaceDeathDeclarationQualified:true,cooperativePalaceLossQualified:false,largestRead:4096,largestWrite,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({artifactPreserved:true,largestWrite}));
