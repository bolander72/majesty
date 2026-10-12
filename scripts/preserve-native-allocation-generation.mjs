#!/usr/bin/env node
// Preserve the actual qualified save/unload/revisit generation before investigating retained allocations.
import {readFile,writeFile,mkdtemp,open,chmod,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyAllocationSites} from './check-native-allocation-sites.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
import {hashNativeFile,NATIVE_SOURCES} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [proofName]=process.argv.slice(2);if(process.argv.length!==3)throw Error('Usage: <qualified actual persistence report>');
const output=join(workspace,'output/native-allocation-generation-preserved-observed.json');
try{await lstat(output);throw Error('Preserve prior generation');}catch(e){if(e.code!=='ENOENT')throw e;}
const proofBytes=await readFile(proofName),p=JSON.parse(proofBytes),m=JSON.parse(await readFile(p.sourceManifest));assertRevalidatedNativeProof(await verifyAllocationSites(p.sourceManifest),p);
assert.equal(p.originalPerVisitSaveAndRevisitQualified,true);assert.equal(p.visits.length,12);
assert.equal(m.nativeExecutableSha256AtLaunch,'562b4bfd8038f005c3df189631d05ac6aa6343121f074d14fbcd587093bc0133');
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-native-generation-'));let largestWrite=0;
async function copy(from,name,maximum) {
  const filename=join(directory,name),f=await open(filename,'wx');let at=0;
  try {
    const copied=await hashNativeFile(from,{maximum,async sink(b){largestWrite=Math.max(largestWrite,b.length);let used=0;
      while(used<b.length){const {bytesWritten}=await f.write(b,used,b.length-used,at);if(!bytesWritten)throw Error('Short archive write');used+=bytesWritten;at+=bytesWritten;}}});
    await f.sync();assert.deepEqual(await hashNativeFile(filename,{maximum}),copied);return {filename,...copied};
  }finally{await f.close();}
}
const sources={};for(const name of NATIVE_SOURCES){sources[name]=await copy(join(workspace,name),name.split('/').at(-1),1024*1024);assert.equal(sources[name].sha256,m.nativeSourceSha256[name]);}
const nativeExecutable=await copy(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'),'pop_smoke',128*1024*1024);
assert.equal(nativeExecutable.sha256,m.nativeExecutableSha256AtLaunch);await chmod(nativeExecutable.filename,0o755);
await writeFile(output,JSON.stringify({qualified:true,version:1,scope:'Exact independently requalified native twelve-cycle original save/unload/revisit and partial allocation-observation generation; copied executable and three sources with bounded buffers. No browser artifact qualification.',
  directory,sources,nativeSourceSha256:m.nativeSourceSha256,nativeExecutable,reloadReport:resolve(proofName),reloadReportSha256:createHash('sha256').update(proofBytes).digest('hex'),
  largestRead:4096,largestWrite,browserUsed:false,nativeProcessesStarted:0,nativeBuildPerformed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,nativeExecutableBytes:nativeExecutable.bytes,largestRead:4096,largestWrite}));
