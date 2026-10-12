#!/usr/bin/env node
import {readFile,writeFile,mkdtemp,open,chmod,stat} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {hashNativeFile,NATIVE_SOURCES} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [trialFile,proofFile,out]=process.argv.slice(2);assert.ok(trialFile&&proofFile&&out);
try{await stat(out);throw Error('Preserve earlier archive');}catch(e){if(e.code!=='ENOENT')throw e;}
const trial=JSON.parse(await readFile(trialFile,'utf8')),proof=JSON.parse(await readFile(proofFile,'utf8'));
assert.equal(proof.qualified,true);assert.equal(proof.actualNativeBuildingPredicateQualified,true);
assert.equal(trial.nativeSessionTerminal,true);assert.equal(trial.nativeExitCode,0);assert.equal(trial.nativePid,proof.nativePid);
assert.equal(trial.buildingObjectiveTrialCompleted,true);
try{process.kill(trial.nativePid,0);throw Error('Producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
for(const field of ['evidenceSha256','sourceSha256'])for(const [name,digest]of Object.entries(proof[field]))assert.equal((await hashNativeFile(name)).sha256,digest);
const names=[...NATIVE_SOURCES,'upstream/majesty-recomp/browser_campaign.cpp'];
assert.deepEqual(Object.keys(trial.nativeSourceSha256).sort(),names.slice().sort());
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-native-generation-'));
let largestWrite=0;
async function copy(from,name,maximum){
 const filename=join(directory,name),f=await open(filename,'wx');let at=0;
 try{
  const hash=await hashNativeFile(from,{maximum,async sink(bytes){largestWrite=Math.max(largestWrite,bytes.length);let used=0;
   while(used<bytes.length){const {bytesWritten}=await f.write(bytes,used,bytes.length-used,at);assert.ok(bytesWritten);used+=bytesWritten;at+=bytesWritten;}}});
  await f.sync();assert.deepEqual(await hashNativeFile(filename,{maximum}),hash);return {filename,...hash};
 }finally{await f.close();}
}
const sources={};for(const name of names){sources[name]=await copy(join(workspace,name),name.split('/').at(-1),1024*1024);assert.equal(sources[name].sha256,trial.nativeSourceSha256[name]);}
const nativeExecutable=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'),'pop_smoke',128*1024*1024);
assert.equal(nativeExecutable.sha256,trial.nativeExecutableSha256);await chmod(nativeExecutable.filename,0o755);
const build=JSON.parse(await readFile(trial.buildReport,'utf8'));
const nativeSymbols=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json'),'symbols.json',32*1024*1024);assert.equal(nativeSymbols.sha256,build.nativeSymbolsSha256);
const inspectorSources={};for(const name of ['scripts/inspect-native-building-objective.mjs','scripts/run-native-building-objective.py','scripts/audit-native-building-objective.py'])
 inspectorSources[name]=await copy(join(workspace,name),name.split('/').at(-1),1024*1024);
await writeFile(out,JSON.stringify({version:1,artifactPreserved:true,directory,sources,nativeSourceSha256:trial.nativeSourceSha256,
 nativeExecutable,nativeSymbols,inspectorSources,evidence:{[trialFile]:(await hashNativeFile(trialFile)).sha256,[proofFile]:(await hashNativeFile(proofFile)).sha256},
 actualNativeBuildingPredicateQualified:true,cooperativeChapterQualified:false,scope:proof.scope,largestWrite,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({artifactPreserved:true,largestWrite,sources:names.length}));
