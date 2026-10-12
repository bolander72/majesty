#!/usr/bin/env node
// Preserve the measured incoming generation before extending outgoing departure.
import {readFile,writeFile,mkdtemp,open,chmod,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyRepeatReload} from './check-native-repeat-reload.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
import {hashNativeFile,NATIVE_SOURCES} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [proofName]=process.argv.slice(2);if(process.argv.length!==3)throw Error('Usage: <qualified incoming original reload>');
const output=join(workspace,'output/native-repeat-generation-preserved-observed.json');
try{await lstat(output);throw Error('Preserve prior native generation');}catch(e){if(e.code!=='ENOENT')throw e;}
const proofBytes=await readFile(proofName),p=JSON.parse(proofBytes);assertRevalidatedNativeProof(await verifyRepeatReload(p.sourceManifest),p);
assert.equal(p.fixture.nativeExecutableSha256AtLaunch,'fc7641a446db0748ca55460c03f9c11e97f33a6e4e20a3f341890050b6501655');
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-native-generation-'));let largestWrite=0;
async function copy(from,name,maximum) {
  const filename=join(directory,name),f=await open(filename,'wx');let at=0;
  try {
    const copied=await hashNativeFile(from,{maximum,async sink(b){largestWrite=Math.max(largestWrite,b.length);let used=0;
      while(used<b.length){const {bytesWritten}=await f.write(b,used,b.length-used,at);if(!bytesWritten)throw Error('Short archive write');used+=bytesWritten;at+=bytesWritten;}}});
    await f.sync();assert.deepEqual(await hashNativeFile(filename,{maximum}),copied);return {filename,...copied};
  }finally{await f.close();}
}
const sources={};for(const name of NATIVE_SOURCES){sources[name]=await copy(join(workspace,name),name.split('/').at(-1),1024*1024);assert.equal(sources[name].sha256,p.fixture.nativeSourceSha256[name]);}
const nativeExecutable=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'),'pop_smoke',128*1024*1024);
assert.equal(nativeExecutable.sha256,p.fixture.nativeExecutableSha256AtLaunch);await chmod(nativeExecutable.filename,0o755);
await writeFile(output,JSON.stringify({qualified:true,version:1,scope:'Exact measured incoming native generation: three recorded sources and original executable; independently requalified restoration/activation/reload evidence. No generic native generations or browser artifact claim.',
  directory,sources,nativeSourceSha256:p.fixture.nativeSourceSha256,nativeExecutable,reloadReport:resolve(proofName),reloadReportSha256:createHash('sha256').update(proofBytes).digest('hex'),
  largestRead:4096,largestWrite,browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,nativeExecutableBytes:nativeExecutable.bytes,largestRead:4096,largestWrite}));
