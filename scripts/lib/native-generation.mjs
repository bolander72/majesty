// Exact stopped native provenance. Fresh launches always use the current build.
import {open,readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {workspace,ownedDirectory} from './stopped-entity-io.mjs';
export const NATIVE_SOURCES=['upstream/majesty-recomp/browser_frontier.cpp','upstream/majesty-recomp/browser_streaming.cpp','upstream/majesty-recomp/game.toml'];
export const PRESERVED_NATIVE_EXECUTABLE='5ff489cacb8cccbb37de14b4b7c54d7348bdbab96d080265fc0c2fad0e11375c';
export const PRESERVED_NATIVE_SOURCES={
  'upstream/majesty-recomp/browser_frontier.cpp':'23491b0aca3130643dbed687e1b7f5727c7659d2e95c326d1ac42c353fb53fd4',
  'upstream/majesty-recomp/browser_streaming.cpp':'5232e3cf3314246a2871e6c48bb769427ccf4d5b5860b51d1cfe75e681c6b299',
  'upstream/majesty-recomp/game.toml':'9a16e9dd00cd4816b1502172b907927b4ab164a63e1a3beb383eb7733bf4cd0c'};
export const GENERATION_REPORT=join(workspace,'output/native-generation-preserved-observed.json');
export async function hashNativeFile(filename,{sink,maximum=128*1024*1024}={}) {
  const f=await open(filename,'r'),before=await f.stat({bigint:true}),h=createHash('sha256');
  try {
    if(!before.isFile()||before.size<1n||before.size>BigInt(maximum))throw Error('Native generation file exceeds bound');
    const buffer=Buffer.alloc(4096);let at=0;
    while(at<Number(before.size)) {
      const n=Math.min(4096,Number(before.size)-at),{bytesRead}=await f.read(buffer,0,n,at);
      if(bytesRead!==n)throw Error('Truncated native generation file');h.update(buffer.subarray(0,n));if(sink)await sink(buffer.subarray(0,n));at+=n;
    }
    const after=await f.stat({bigint:true}),named=await stat(filename,{bigint:true});
    for(const key of ['dev','ino','size','mtimeNs'])if(before[key]!==after[key]||before[key]!==named[key])throw Error('Native generation changed during read');
    return {bytes:Number(before.size),sha256:h.digest('hex'),largestRead:Math.min(4096,Number(before.size))};
  } finally {await f.close();}
}
const INCOMING_EXECUTABLE='fc7641a446db0748ca55460c03f9c11e97f33a6e4e20a3f341890050b6501655';
const INCOMING_SOURCES={...PRESERVED_NATIVE_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'40f86a5fab0bcd414e10b0faf597691f06a697410ea1f5bd5e02678023814d05'};
const COMMITTED_EXECUTABLE='e4321c3c18f49deca1ac1a5c4596d060cd334aac4b078a2755be6f65fbabf984';
const COMMITTED_SOURCES={...PRESERVED_NATIVE_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'287319e322f265c31eab0860c618a902492743544b5baf1b0fbb05707a5509a3'};
const RESIDENCY_EXECUTABLE='464645dbe98f834091b66b5f1ffc0771eb02500abe2f2a1d430f4b8d993fc7f4';
const RESIDENCY_SOURCES={...PRESERVED_NATIVE_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'72b6b03ccb60b4d9a9c3d17a22732f714d3ad125f58749de6b350b57d628f7f1'};
const PERSISTENCE_EXECUTABLE='95211e3f69fcc0a88961aa6ab17d8f8e3dcece1610afeca17eae56d5caa2d94f';
const PERSISTENCE_SOURCES={...PRESERVED_NATIVE_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'c1d45ce0d83696a002721dd299498d1bf834b45dad24ce9f4f9313179743bc7a'};
const JOURNEY_EXECUTABLE='6b98919d33aaa7bbd77e5296193453c6b5240976efec0921ac76f81ab21028cd';
const JOURNEY_SOURCES={...PRESERVED_NATIVE_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'e244e30b9d226036938a71e93de3f5b9c96ab7a2fc0341ded5e77eae3d01c75d'};
const SURVIVOR_EXECUTABLE='f23eebbb360a31a20e8bfe6e913c33d0c995594c30bf142b872fac9d8348ddf6';
const SURVIVOR_SOURCES={...PRESERVED_NATIVE_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'d0735c09d7f4aa7bc66099427cd471cd2b2bcf2a8bea8d66446061de955f8d17'};
const ALLOCATOR_EXECUTABLE='1b9768d006db43945cb1b83900accc77d840c31a6c2db537a491c330807bd141';
const ALLOCATOR_SOURCES={...PRESERVED_NATIVE_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'d4f73f97616abfd173e93fab3379c757a07a6a80205d48f932b8fcee37c903f1'};
const HEAP_EXECUTABLE='dbbd7bf6c144e85c88dcd9a4a8c2434b403b31d74ac7ec415a41d0efa82a172e';
const HEAP_SOURCES={...PRESERVED_NATIVE_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'50abb9828b7e68f4a1802877680cf3bb7863f486a9028144c2202c95df06a150'};
const COMPLETED_EXECUTABLE='f7aea431763cd01d1a18bc51b41372e76f5622176bbca5b7776c9427987efe99';
const COMPLETED_SOURCES={...PRESERVED_NATIVE_SOURCES,
  'upstream/majesty-recomp/browser_frontier.cpp':'bbaaec03f557c04298937a3516c55170c3488cfeb8e4784fc562db826138249d',
  'upstream/majesty-recomp/browser_streaming.cpp':'8d4b7fdc37c2e50dd01364afa13a33eeb5eeda8970f666fc968f6082e090b9c5'};
const ALLOCATION_EXECUTABLE='562b4bfd8038f005c3df189631d05ac6aa6343121f074d14fbcd587093bc0133';
const ALLOCATION_SOURCES={...COMPLETED_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'5c862c62ca20b2e92a05b36366e5218c7d2e4cf9730cae42539b4f01d003c0aa'};
const MALLOC_EXECUTABLE='fda1f00060a907f15eb17b001bf4b016ac9681664f5c5b9bb5da5897fa73fd91';
const MALLOC_SOURCES={...COMPLETED_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'cfa3f1a864ccac665b722d635e09020be80af713e49b4b15ff214bededa35789'};
const OWNER_EXECUTABLE='81d831ddc68443754d06298080f7446a35b9ae2a91c491ab28c42d6510cc2781';
const OWNER_SOURCES={...COMPLETED_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'4756e46a8a1404817a79dc7f2c98c73d2e485d684bb3d55c3f0e4d9fe2a355c9'};
const CACHE_EXECUTABLE='d71f4d8906be1cdcc52d56137f91b9b2b2f34a57574c766c0efed2e196d3e6ff';
const CACHE_SOURCES={...COMPLETED_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'d567b23c41c0b8248768d53c7e6af86d36c443e7f635795b54731a700482a6fa'};
const PAGE_EXECUTABLE='5be5b5bb8609f8165bc39b74aef1fa8161140ca443c41c5e3afc7b29b11184ea';
const PAGE_SOURCES={...COMPLETED_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'05c93f18b2c0d0bf5878ecb79ae4ab88c4c48ebddd256b99b2959648e4590f8e'};
const QUEUE_CONTEXT_EXECUTABLE='042b6e399f31c091cc8c651943c1510d90d297c0184f268617ce23508ba10d62';
const QUEUE_CONTEXT_SOURCES={...COMPLETED_SOURCES,
  'upstream/majesty-recomp/browser_streaming.cpp':'9d683c15eb3eea53f6a357ff49e466e9b0234f2f0c3d264c816152dfc3f12af3'};
const generations=new Map([
  [PRESERVED_NATIVE_EXECUTABLE,{sources:PRESERVED_NATIVE_SOURCES,report:GENERATION_REPORT}],
  [INCOMING_EXECUTABLE,{sources:INCOMING_SOURCES,report:join(workspace,'output/native-repeat-generation-preserved-observed.json')}],
  [COMMITTED_EXECUTABLE,{sources:COMMITTED_SOURCES,report:join(workspace,'output/native-committed-generation-preserved-observed.json')}],
  [RESIDENCY_EXECUTABLE,{sources:RESIDENCY_SOURCES,report:join(workspace,'output/native-residency-generation-preserved-observed.json')}],
  [PERSISTENCE_EXECUTABLE,{sources:PERSISTENCE_SOURCES,report:join(workspace,'output/native-persistence-generation-preserved-observed.json')}],
  [JOURNEY_EXECUTABLE,{sources:JOURNEY_SOURCES,report:join(workspace,'output/native-journey-generation-preserved-observed.json')}],
  [SURVIVOR_EXECUTABLE,{sources:SURVIVOR_SOURCES,report:join(workspace,'output/native-survivor-generation-preserved-observed.json')}],
  [ALLOCATOR_EXECUTABLE,{sources:ALLOCATOR_SOURCES,report:join(workspace,'output/native-allocator-generation-preserved-observed.json')}],
  [HEAP_EXECUTABLE,{sources:HEAP_SOURCES,report:join(workspace,'output/native-heap-generation-preserved-observed.json')}],
  [COMPLETED_EXECUTABLE,{sources:COMPLETED_SOURCES,report:join(workspace,'output/native-completed-generation-preserved-observed.json')}],
  [ALLOCATION_EXECUTABLE,{sources:ALLOCATION_SOURCES,report:join(workspace,'output/native-allocation-generation-preserved-observed.json')}],
  [MALLOC_EXECUTABLE,{sources:MALLOC_SOURCES,report:join(workspace,'output/native-malloc-generation-preserved-observed.json')}],
  [OWNER_EXECUTABLE,{sources:OWNER_SOURCES,report:join(workspace,'output/native-owner-generation-preserved-observed.json')}],
  [CACHE_EXECUTABLE,{sources:CACHE_SOURCES,report:join(workspace,'output/native-cache-generation-preserved-observed.json')}],
  [PAGE_EXECUTABLE,{sources:PAGE_SOURCES,report:join(workspace,'output/native-page-generation-preserved-observed.json')}],
  [QUEUE_CONTEXT_EXECUTABLE,{sources:QUEUE_CONTEXT_SOURCES,report:join(workspace,'output/native-queue-context-generation-preserved-observed.json')}],
]);
const cached=new Map();
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeNs].map(String).join(':');
async function preservedGeneration(executable,expected) {
  if(!cached.has(executable))cached.set(executable,(async()=>{
    const info=await stat(expected.report,{bigint:true});if(!info.isFile()||info.size>16384n)throw Error('Oversized preserved native metadata');
    const metadata=await readFile(expected.report),g=JSON.parse(metadata);
    assert.equal(g.qualified,true);assert.equal(g.version,1);assert.equal(g.nativeExecutable.sha256,executable);
    assert.deepEqual(g.nativeSourceSha256,expected.sources);
    const dir=await ownedDirectory(g.directory,'actor-arrival-fixture-native-generation-'),checks=new Map([[expected.report,stamp(info)]]);
    assert.equal(g.nativeExecutable.filename,join(dir,'pop_smoke'));
    const exe=await hashNativeFile(g.nativeExecutable.filename);assert.equal(exe.sha256,executable);assert.equal(exe.bytes,g.nativeExecutable.bytes);
    checks.set(g.nativeExecutable.filename,stamp(await stat(g.nativeExecutable.filename,{bigint:true})));
    for(const name of NATIVE_SOURCES) {
      const filename=join(dir,name.split('/').at(-1));assert.equal(g.sources[name].filename,filename);
      const file=await hashNativeFile(filename,{maximum:1024*1024});assert.equal(file.sha256,expected.sources[name]);assert.equal(file.bytes,g.sources[name].bytes);
      checks.set(filename,stamp(await stat(filename,{bigint:true})));
    }
    return checks;
  })());
  // Repeated validations avoid rereading89MB but still refuse any archived
  // file or metadata replacement/change within this verifier process.
  for(const [filename,before] of await cached.get(executable))assert.equal(stamp(await stat(filename,{bigint:true})),before,'Preserved generation changed');
}
export async function verifiedNativeSources(m) {
  if(m.nativeOnly!==true||m.browserUsed!==false||m.nativeSessionTerminal!==true||m.nativeExitCode!==0||!Number.isInteger(m.nativePid)||m.nativePid<=0)
    throw Error('Historical native provenance requires a successful terminal process');
  try{process.kill(m.nativePid,0);throw Error('Native evidence process is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
  await ownedDirectory(m.profile,'actor-arrival-fixture-');
  const known=generations.get(m.nativeExecutableSha256AtLaunch);
  if(known) {
    // Only explicitly measured, preserved generations are historical.
    assert.deepEqual(m.nativeSourceSha256,known.sources);
    await preservedGeneration(m.nativeExecutableSha256AtLaunch,known);return {...known.sources};
  }
  const sources={};for(const name of NATIVE_SOURCES)sources[name]=(await hashNativeFile(join(workspace,name),{maximum:1024*1024})).sha256;
  assert.deepEqual(m.nativeSourceSha256,sources,'Current native source differs');
  assert.equal((await hashNativeFile(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke'))).sha256,m.nativeExecutableSha256AtLaunch,'Current native executable differs');
  return sources;
}
