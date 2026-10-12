#!/usr/bin/env node
// Preserve the actually qualified native generation before changing its code.
import {readFile,writeFile,mkdtemp,open,chmod,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyReturnRevisionPair} from './check-native-return-revision-reload.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile,NATIVE_SOURCES,PRESERVED_NATIVE_SOURCES,PRESERVED_NATIVE_EXECUTABLE,GENERATION_REPORT} from './lib/native-generation.mjs';
const [pairName]=process.argv.slice(2);if(process.argv.length!==3)throw Error('Usage: <qualified paired original native reload>');
try{await lstat(GENERATION_REPORT);throw Error('Preserve existing native generation');}catch(e){if(e.code!=='ENOENT')throw e;}
const bytes=await readFile(pairName),p=JSON.parse(bytes);assertRevalidatedNativeProof(await verifyReturnRevisionPair(p.active.sourceManifest,p.absent.sourceManifest),p);
assert.equal(p.active.fixture.nativeExecutableSha256AtLaunch,PRESERVED_NATIVE_EXECUTABLE);
assert.deepEqual(p.active.fixture.nativeSourceSha256,PRESERVED_NATIVE_SOURCES);
const dir=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-native-generation-'));let largestWrite=0;
async function preserve(from,name,maximum) {
  const dest=join(dir,name),f=await open(dest,'wx');let at=0;
  try {
    const copied=await hashNativeFile(from,{maximum,async sink(b){largestWrite=Math.max(largestWrite,b.length);let used=0;
      while(used<b.length){const {bytesWritten}=await f.write(b,used,b.length-used,at);if(!bytesWritten)throw Error('Short native archive write');used+=bytesWritten;at+=bytesWritten;}}});
    await f.sync();const checked=await hashNativeFile(dest,{maximum});assert.deepEqual(checked,copied);return {filename:dest,...copied};
  } finally {await f.close();}
}
const sources={};for(const name of NATIVE_SOURCES) {
  sources[name]=await preserve(join(workspace,name),name.split('/').at(-1),1024*1024);assert.equal(sources[name].sha256,PRESERVED_NATIVE_SOURCES[name]);
}
const nativeExecutable=await preserve(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'),'pop_smoke',128*1024*1024);
assert.equal(nativeExecutable.sha256,PRESERVED_NATIVE_EXECUTABLE);await chmod(nativeExecutable.filename,0o755);
const report={qualified:true,version:1,scope:'Exact measured stopped native generation: three recorded game sources and its actual qualified executable, streamed and rehashed before fixture extension. Other build dependencies, browser artifacts and generic historical generations unqualified.',
  directory:dir,nativeSourceSha256:PRESERVED_NATIVE_SOURCES,sources,nativeExecutable,pairReport:pairName,
  pairReportSha256:createHash('sha256').update(bytes).digest('hex'),largestRead:4096,largestWrite,browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false};
await writeFile(GENERATION_REPORT,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,nativeExecutableBytes:nativeExecutable.bytes,largestRead:4096,largestWrite,retainedFiles:4}));
