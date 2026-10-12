#!/usr/bin/env node
// Validate actual original dispatcher teardown, not a modeled cache release.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {repeatRevisionInputs} from './prepare-native-repeat-revision-inputs.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {verifiedNativeSources} from './lib/native-generation.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits} from '../web/world/checkpoint.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=65536){const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Residency metadata exceeds bound');const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;}
export function parseWorldResidency(log,visitCount=3) {
  assert.ok(Number.isInteger(visitCount)&&visitCount>=3&&visitCount<=32,'Invalid bounded original visit count');
  if(!log.includes('all expectations met')||/result=fail|SIGSEGV|abort from|exception e06d7363|undeliverable call(?!s: none)|residency setup .*refused/i.test(log))throw Error('Failed original residency run');
  const loads=[...log.matchAll(/^\[streaming\] World residency load=(\d+) extent=(\d+) registry-entries=(\d+) world=([0-9a-f]{8}) factory=([0-9a-f]{8}) terrain=([0-9a-f]{8}) grid=([0-9a-f]{8}) search=([0-9a-f]{8}) entries=([0-9a-f]{8}) heap=(\d+) blocks=(\d+) crt=(\d+) hooks=(\d+) result=pass$/gm)];
  const originalLoads=[...log.matchAll(/^\[streaming\] Original load end result=00000000 visits=(\d+) retained=32 sample-bytes=2304$/gm)];
  const requests=[...log.matchAll(/^\[streaming\] World residency request=(\d+) observed-ticks=(\d+) pending=4 result=pass$/gm)];
  const exits=[...log.matchAll(/^\[streaming\] World residency exit=(\d+) extent=(\d+) phase=(\d+) pending=(\d+) world-null=(\d+) roots-freed=(\d+),(\d+),(\d+),(\d+),(\d+),(\d+) free-calls=(\d+) heap-before=(\d+) heap-after=(\d+) blocks-before=(\d+) blocks-after=(\d+) crt-before=(\d+) crt-after=(\d+) heap-valid=(\d+) hooks-same=(\d+) result=pass$/gm)];
  assert.equal(loads.length,visitCount,'Need every original world load');assert.equal(originalLoads.length,visitCount);assert.equal(requests.length,visitCount);assert.equal(exits.length,visitCount);
  const result=[];
  for(let i=0;i<visitCount;++i) {
    const values=loads[i].slice(1).map((v,j)=>j>=3&&j<=8?parseInt(v,16):Number(v));
    const [index,extent,registryEntries]=values,[heap,blocks,crt,hooks]=values.slice(9);
    const roots=loads[i].slice(4,10).map(v=>parseInt(v,16));assert.equal(new Set(roots).size,6);assert.ok(roots.every(v=>v>0));
    assert.equal(index,i);assert.equal(extent,i%2?512:256);assert.ok(registryEntries>0);assert.ok(heap>0&&blocks>0&&crt>0);assert.equal(hooks,Number(loads[0][13]));
    assert.ok(originalLoads[i].index<loads[i].index);if(i)assert.ok(exits[i-1].index<originalLoads[i].index);
    const r=requests[i].slice(1).map(Number);assert.deepEqual(r,[i,20]);
    const e=exits[i].slice(1).map(Number),[exitIndex,exitExtent,phase,pending,nullWorld,...rest]=e;
    const freed=rest.slice(0,6),[freeCalls,heapBefore,heapAfter,blocksBefore,blocksAfter,crtBefore,crtAfter,heapValid,hooksSame]=rest.slice(6);
    assert.deepEqual([exitIndex,exitExtent,phase,pending,nullWorld],[i,extent,4,1,1]);assert.deepEqual(freed,[1,1,1,1,1,1]);
    assert.ok(freeCalls>=6);assert.ok(heapBefore>heapAfter&&blocksBefore>blocksAfter&&crtBefore>crtAfter);assert.equal(heapValid,1);assert.equal(hooksSame,1);
    assert.ok(loads[i].index<requests[i].index&&requests[i].index<exits[i].index);if(i<visitCount-1)assert.ok(exits[i].index<loads[i+1].index);
    result.push({index,extent,registryEntries,units:Number(originalLoads[i][1]),roots,loaded:{heap,blocks,crt,hooks},observedTicks:20,
      freed,freeCalls,before:{heap:heapBefore,blocks:blocksBefore,crt:crtBefore},after:{heap:heapAfter,blocks:blocksAfter,crt:crtAfter},
      releasedHeapBytes:heapBefore-heapAfter,releasedCrtAllocations:crtBefore-crtAfter});
  }
  return result;
}
export async function verifyWorldResidency(manifestName) {
  const mb=await bounded(manifestName),m=JSON.parse(mb),sources=await verifiedNativeSources(m);
  assert.equal(m.worldResidencyProbe,true);assert.deepEqual(m.loadSequence,[1,0,1]);assert.deepEqual(m.loadExtents,[256,512,256]);assert.equal(m.observedTicksPerLoad,20);
  assert.equal(m.usesOriginalPhaseRequest,true);assert.equal(m.usesOriginalDispatcherTeardown,true);
  assert.deepEqual(m.observationFunctions,[0x00416050,0x00415e40,0x004170a0,0x00597ad0,0x00597980,0x0064d4b6]);
  const p=await repeatRevisionInputs(m.publicationReport,m.selectedRevisionExports[1].receipt,1,{requireCurrent:false});
  assert.equal(m.publicationReportSha256,p.publicationReportSha256);assert.equal(m.producerManifest,p.producerManifest);assert.equal(m.producerManifestSha256,p.producerManifestSha256);
  const profile=await ownedDirectory(m.profile,'actor-arrival-fixture-world-residency-');assert.equal(profile,join(m.fixture,'frontier_0_0'));
  assert.notEqual(m.nativePid,p.producer.nativePid);assert.notEqual(profile,p.producer.profile);
  for(const name of ['upstream/majesty-recomp/browser_frontier.cpp','upstream/majesty-recomp/game.toml'])assert.equal(sources[name],p.producer.nativeSourceSha256[name]);
  const bb=await bounded(m.buildReport),build=JSON.parse(bb);assert.equal(sha(bb),m.buildReportSha256);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
  assert.deepEqual(build.nativeSourceSha256,sources);assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256AtLaunch);assert.equal(build.command,'.venv/bin/python tools/build.py --target smoke --jobs 1');
  assert.equal(sha(await bounded(build.log,1024*1024)),build.logSha256);assert.ok(build.finishedAtMs<=m.startedAtMs&&m.startedAtMs<m.finishedAtMs);
  const settings=['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav'],names=[...settings,'Residency_Source_0.GMP','Residency_Source_1.GMP','Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'];
  assert.deepEqual(Object.keys(m.inputHashes).sort(),names.sort());const evidence={};
  for(const name of settings){const f=join(profile,name);assert.equal(await hashCheckpointSource(await stoppedFileSource(f)),m.inputHashes[name]);assert.equal(m.inputHashes[name],p.producer.inputHashes[name]);evidence[f]=m.inputHashes[name];}
  const unitCounts=[];
  for(let side=0;side<2;++side) {
    const exp=await verifyRevisionExport(m.selectedRevisionExports[side].receipt,side,p.receipt.worlds[side].sha256,{requireCurrent:false});assert.deepEqual(exp,m.selectedRevisionExports[side]);
    const name='Residency_Source_'+side+'.GMP',f=join(profile,name),s=await stoppedFileSource(f);
    assert.equal(s.size,exp.bytes);assert.equal(await hashCheckpointSource(s),exp.sha256);assert.equal(m.inputHashes[name],exp.sha256);evidence[f]=exp.sha256;
    let n=0;for await(const u of checkpointUnits(s)){if(++n>5000)throw Error('Native world count exceeds bound');}unitCounts.push(n);
  }
  const finalWorld=join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP');assert.equal(m.inputHashes['Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'],p.receipt.worlds[1].sha256);
  assert.equal(await hashCheckpointSource(await stoppedFileSource(finalWorld)),p.receipt.worlds[1].sha256);evidence[finalWorld]=p.receipt.worlds[1].sha256;
  assert.equal(m.smokeScript,join(m.fixture,'load-replace.script'));assert.equal(sha(await bounded(m.smokeScript)),m.smokeScriptSha256);assert.equal(m.smokeSeconds,60);assert.equal(m.clockMode,'monotonic');
  const lb=await bounded(m.log,1024*1024),cycles=parseWorldResidency(lb.toString('utf8'));
  for(let i=0;i<cycles.length;++i)assert.equal(cycles[i].units,unitCounts[m.loadSequence[i]],'Original registry count differs from committed map');
  for(const name of ['scripts/check-native-world-residency.mjs','scripts/run-native-world-residency.py','scripts/build-native-world-residency.py'])sources[name]=sha(await readFile(join(workspace,name)));
  return {qualified:true,scope:'One native process loads the actual committed256/512/256 maps, runs20 original ticks per load and leaves through the original dispatcher. Delegating original CRT free observation confirms six world/factory/terrain/grid/navigation roots retired once per exit, null world pointer, consistent heap and unchanged observer count. General region residency, seamless travel, opaque references and browser memory remain unqualified.',
    sourceManifest:resolve(manifestName),sourceManifestSha256:sha(mb),fixture:m,cycles,
    originalWholeWorldTeardownAndReloadQualified:true,originalSixWorldRootsFreedQualified:true,
    postUnloadHeapDriftBytes:cycles[2].after.heap-cycles[0].after.heap,postUnloadCrtDriftAllocations:cycles[2].after.crt-cycles[0].after.crt,
    originalBoundedRegionResidencyQualified:false,generalRepeatedJourneysQualified:false,wholeBrowserMemoryBoundQualified:false,
    generatedAdjacentTerrainQualified:false,browserUsed:false,nativeProcessesStarted:0,sourceSha256:sources,
    evidenceSha256:{...evidence,[resolve(manifestName)]:sha(mb),[m.log]:sha(lb),[m.smokeScript]:m.smokeScriptSha256,[m.buildReport]:sha(bb)}};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [name,out]=process.argv.slice(2);if(!name||!out||process.argv.length!==4)throw Error('Usage: <terminal original residency manifest> <fresh report>');
  const r=await verifyWorldResidency(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,cycles:r.cycles.length,releasedHeapBytes:r.cycles.map(c=>c.releasedHeapBytes),postUnloadHeapDriftBytes:r.postUnloadHeapDriftBytes,postUnloadCrtDriftAllocations:r.postUnloadCrtDriftAllocations,originalBoundedRegionResidencyQualified:false}));
}
