#!/usr/bin/env node
// Independently qualify saved original world state across a real unload/revisit.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseWorldResidency} from './check-native-world-residency.mjs';
import {repeatRevisionInputs} from './prepare-native-repeat-revision-inputs.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {verifiedNativeSources,hashNativeFile} from './lib/native-generation.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {repeatReceivingMembership} from './check-native-repeat-return.mjs';
import {returnedCheckpoint} from './lib/native-return-checkpoint.mjs';
import {checkpointChunks} from '../web/world/checkpoint.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=65536) {
  const s=await stoppedFileSource(name);if(s.size>cap)throw Error('Persistence evidence exceeds bound');
  const b=Buffer.alloc(s.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;
}
async function rangeHash(s,at,length) {
  const h=createHash('sha256');for(let n=0;n<length;n+=4096)h.update(await s.readAt(at+n,Math.min(4096,length-n)));return h.digest('hex');
}
export async function persistenceState(name) {
  const s=await stoppedFileSource(name);assert.ok(s.size<=2*1024*1024);
  const roots=[];let clock,rng,gameplayRng,label,date;
  for await(const c of checkpointChunks(s)) {
    // Original files repeat object-manager sections. Preserve their ordered
    // sequence in equality; only SVGD and the GPL runtime are singletons.
    if(['SVGD','GPL '].includes(c.tag))assert.ok(!roots.some(r=>r.tag===c.tag),'Duplicate persistence singleton');
    let digest=await rangeHash(s,c.offset+16,c.size),size=c.size;
    if(c.tag==='SVGD') {
      assert.deepEqual([c.version,c.count],[10,0]);assert.ok(c.size<=1024);
      const b=Buffer.from(await s.readAt(c.offset+16,c.size));
      const first=b.indexOf(0),second=b.indexOf(0,first+1);
      assert.ok(first>0&&first<128&&second>first+1&&second-first<128&&second+21<=b.length);
      label=b.subarray(0,first).toString('ascii');assert.match(label,/^[A-Za-z0-9_ ]+$/);
      clock=b.readUInt32LE(second+1);
      // Original SVGD reader00436770: two NUL strings, saved game clock,
      // then00501f80 reads exactly16 bytes of calendar metadata. Exclude
      // only the label and this validated timestamp from replay equality.
      date=Array.from({length:8},(_,i)=>b.readUInt16LE(second+5+i*2));
      const [year,month,weekday,day,hour,minute,seconds,millis]=date;
      assert.ok(year>=2000&&year<=2200&&month>=1&&month<=12&&weekday<=6&&day>=1&&day<=31&&hour<24&&minute<60&&seconds<60&&millis<1000);
      assert.ok(second+33<=b.length);gameplayRng=b.readUInt32LE(second+29);
      const semantic=Buffer.concat([b.subarray(first+1,second+5),b.subarray(second+21)]);
      digest=sha(semantic);size=semantic.length;
    } else if(c.tag==='GPL ') {
      assert.deepEqual([c.version,c.count],[1,0]);assert.ok(c.size>=40);
      const b=Buffer.from(await s.readAt(c.offset+16,12)),end=Buffer.from(await s.readAt(c.end-8,8));
      assert.deepEqual([b.readUInt32LE(0),b.readUInt32LE(4),end.readUInt32LE(0),end.readUInt32LE(4)],[c.size,3,0,0xffffffff]);rng=b.readUInt32LE(8);
    }
    roots.push({tag:c.tag,version:c.version,count:c.count,bytes:size,sha256:digest});
  }
  assert.ok(clock!==undefined&&rng!==undefined&&gameplayRng!==undefined);
  const membership=await repeatReceivingMembership(name);
  return {filename:name,bytes:s.size,sha256:membership.sha256,clock,rng,gameplayRng,label,date,roots,
    counts:membership.counts,records:membership.records,queues:membership.queues,activeQueue:membership.activeQueue};
}
export function assertSameRegion(a,b) {
  assert.equal(b.clock,a.clock,'Restored game clock differs');
  assert.equal(b.rng,a.rng,'Restored scripting RNG differs');
  assert.equal(b.gameplayRng,a.gameplayRng,'Restored gameplay RNG differs');
  assert.deepEqual(b.records,a.records,'Saved entities differ');
  assert.deepEqual(b.queues,a.queues,'Saved queues differ');assert.equal(b.activeQueue,a.activeQueue);
  const permutations=[];
  const roots=b.roots.map((root,index)=>{
    const prior=a.roots[index];
    if(root.tag==='ORDR'&&prior?.tag==='ORDR'&&root.sha256!==prior.sha256) {
      // Original005b1cf0 resolves the saved Unit+60 prefix through005a10d0
      // and passes that owner to005c1f30. Record ordinal is not identity.
      // The bounded attachment parser consumes the whole root payload and
      // rejects duplicate IDs. Every keyed record was compared above: allow
      // only their serialization permutation, preserving header/count/size
      // and all command/within-container ordering and bytes.
      assert.equal(Object.keys(a.records.attachments).filter(k=>k.startsWith('ORDR:')).length,root.count);
      assert.deepEqual({...root,sha256:prior.sha256},prior,'Order-container header differs');
      permutations.push({tag:root.tag,count:root.count,bytes:root.bytes,beforeSha256:prior.sha256,afterSha256:root.sha256});
      return {...root,sha256:prior.sha256};
    }
    return root;
  });
  assert.deepEqual(roots,a.roots,'Saved world sections differ beyond validated metadata or identical ID-keyed ORDR serialization order');
  return permutations;
}
export function nativeResourceSampling(m) {
  assert.equal(m.resourceSamplingPeriodSeconds,2);assert.equal(m.nativeRssCeilingBytes,1024*1024*1024);assert.equal(m.resourceSamplingStopReason,null);assert.deepEqual(m.resourceSamplingErrors,[]);
  assert.ok(m.nativeResourceSamples.length>=3&&m.nativeResourceSamples.length<=256);
  let previous=m.startedAtMs;
  for(const sample of m.nativeResourceSamples){assert.equal(sample.pid,m.nativePid);assert.ok(Number.isInteger(sample.sampledAtMs)&&sample.sampledAtMs>=previous&&sample.sampledAtMs<=m.finishedAtMs);assert.ok(sample.sampledAtMs-previous<=4000,'Native resource sampling gap exceeds4 seconds');assert.ok(Number.isInteger(sample.rssBytes)&&sample.rssBytes>0&&sample.rssBytes<=m.nativeRssCeilingBytes);assert.ok(Number.isFinite(sample.cpuPercent)&&sample.cpuPercent>=0&&sample.cpuPercent<=1000);previous=sample.sampledAtMs;}
  assert.ok(m.finishedAtMs-previous<=4000,'Final native resource sample is stale');
  return {sampleCount:m.nativeResourceSamples.length,method:'ps exact PID rss KiB and percent CPU every2 seconds; samples do not establish maxima between observations',sampledMaxRssBytes:Math.max(...m.nativeResourceSamples.map(s=>s.rssBytes)),sampledMaxCpuPercent:Math.max(...m.nativeResourceSamples.map(s=>s.cpuPercent)),durationMs:m.finishedAtMs-m.startedAtMs};
}
export function parsePersistenceLog(log,states) {
  const count=states.length,cycles=parseWorldResidency(log,count);
  const snapshots=[...log.matchAll(/^\[streaming\] World persistence snapshot visit=(\d+) side=(\d+) stage=(before|after) clock=(\d+) saved=1 state-clock-same=1 hooks-same=1 latest-published=(\d+) copy-bound=4096 result=pass$/gm)];
  const seeds=[...log.matchAll(/^\[streaming\] World persistence rng visit=(\d+) saved=(\d+) before=(\d+) after=(\d+) clock-same=1 hooks-same=1 original-setter=00623720 result=pass$/gm)];
  const gameSeeds=[...log.matchAll(/^\[streaming\] World persistence gameplay-rng visit=(\d+) saved=(\d+) before=(\d+) after=(\d+) clock-same=1 hooks-same=1 original-setter=004f6710 result=pass$/gm)];
  assert.equal(snapshots.length,count*2);assert.equal(seeds.length,count);assert.equal(gameSeeds.length,count);
  for(let i=0;i<count;++i) {
    const before=snapshots[i*2],after=snapshots[i*2+1],seed=seeds[i];
    assert.deepEqual([Number(before[1]),Number(before[2]),before[3],Number(before[5])],[i,(i+1)%2,'before',0]);
    assert.deepEqual([Number(after[1]),Number(after[2]),after[3],Number(after[5])],[i,(i+1)%2,'after',1]);
    assert.equal(Number(before[4]),states[i].before.clock);assert.equal(Number(after[4]),states[i].after.clock);
    assert.equal(states[i].after.clock-states[i].before.clock,1000,'Need20 completed original50ms ticks');
    assert.equal(Number(seed[1]),i);assert.equal(Number(seed[2]),states[i].before.rng);assert.equal(Number(seed[4]),states[i].before.rng);
    const gameSeed=gameSeeds[i];assert.equal(Number(gameSeed[1]),i);assert.equal(Number(gameSeed[2]),states[i].before.gameplayRng);assert.equal(Number(gameSeed[4]),states[i].before.gameplayRng);
    const request=log.indexOf(`[streaming] World residency request=${i} `),exit=log.indexOf(`[streaming] World residency exit=${i} `);
    assert.ok(seed.index<gameSeed.index&&gameSeed.index<before.index&&before.index<after.index&&after.index<request&&request<exit);
    if(i<count-1)assert.ok(exit<seeds[i+1].index);
  }
  return cycles;
}
export async function verifyWorldPersistence(manifestName) {
  const mb=await bounded(manifestName),m=JSON.parse(mb),sources=await verifiedNativeSources(m);
  assert.equal(m.worldResidencyProbe,true);assert.equal(m.worldPersistenceProbe,true);
  const count=m.loadSequence.length;assert.ok(Number.isInteger(count)&&count>=3&&count<=32);
  assert.deepEqual(m.loadSequence,Array.from({length:count},(_,i)=>i%2?0:1));assert.deepEqual(m.loadExtents,Array.from({length:count},(_,i)=>i%2?512:256));assert.equal(m.observedTicksPerLoad,20);
  assert.equal(m.usesOriginalPhaseRequest,true);assert.equal(m.usesOriginalDispatcherTeardown,true);
  assert.deepEqual(m.observationFunctions,[0x00416050,0x00415e40,0x004170a0,0x00597ad0,0x00597980,0x0064d4b6]);
  const p=await repeatRevisionInputs(m.publicationReport,m.selectedRevisionExports[1].receipt,1,{requireCurrent:false});
  assert.equal(m.publicationReportSha256,p.publicationReportSha256);assert.equal(m.producerManifest,p.producerManifest);assert.equal(m.producerManifestSha256,p.producerManifestSha256);
  const profile=await ownedDirectory(m.profile,'actor-arrival-fixture-world-residency-');assert.equal(profile,join(m.fixture,'frontier_0_0'));
  assert.notEqual(m.nativePid,p.producer.nativePid);assert.notEqual(profile,p.producer.profile);
  const frontier='upstream/majesty-recomp/browser_frontier.cpp';
  if(m.completedWorldTickProbe===true) {
    assert.equal(m.worldHeapProbe,true);
    const {assertCompletedTickAdapter}=await import('./lib/completed-tick-adapter.mjs');
    await assertCompletedTickAdapter(sources[frontier],p.producer.nativeSourceSha256[frontier]);
  } else assert.equal(sources[frontier],p.producer.nativeSourceSha256[frontier]);
  assert.equal(sources['upstream/majesty-recomp/game.toml'],p.producer.nativeSourceSha256['upstream/majesty-recomp/game.toml']);
  const bb=await bounded(m.buildReport),build=JSON.parse(bb);assert.equal(sha(bb),m.buildReportSha256);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
  assert.deepEqual(build.nativeSourceSha256,sources);assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256AtLaunch);assert.equal(build.command,'.venv/bin/python tools/build.py --target smoke --jobs 1');
  assert.equal(sha(await bounded(build.log,1024*1024)),build.logSha256);assert.ok(build.finishedAtMs<=m.startedAtMs&&m.startedAtMs<m.finishedAtMs);
  const settings=['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav'];
  assert.deepEqual(Object.keys(m.inputHashes).sort(),[...settings,'Residency_Source_0.GMP','Residency_Source_1.GMP','Residency_Initial_0.GMP','Residency_Initial_1.GMP','Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'].sort());
  const evidence={};
  for(const name of settings){const f=join(profile,name);assert.equal(await hashCheckpointSource(await stoppedFileSource(f)),m.inputHashes[name]);assert.equal(m.inputHashes[name],p.producer.inputHashes[name]);evidence[f]=m.inputHashes[name];}
  const initial=[];
  for(let side=0;side<2;++side) {
    const exp=await verifyRevisionExport(m.selectedRevisionExports[side].receipt,side,p.receipt.worlds[side].sha256,{requireCurrent:false});assert.deepEqual(exp,m.selectedRevisionExports[side]);
    const f=join(profile,`Residency_Initial_${side}.GMP`),state=await persistenceState(f);
    assert.equal(state.bytes,exp.bytes);assert.equal(state.sha256,exp.sha256);
    assert.equal(m.inputHashes[`Residency_Initial_${side}.GMP`],exp.sha256);assert.equal(m.inputHashes[`Residency_Source_${side}.GMP`],exp.sha256);
    initial.push(state);evidence[f]=state.sha256;
  }
  assert.equal(m.inputHashes['Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'],initial[1].sha256);
  const visits=[];
  for(let i=0;i<count;++i) {
    const pair={};for(const stage of ['Before','After']){const state=await persistenceState(join(profile,`Residency_Visit_${i}_${stage}.GMP`));assert.equal(state.label,stage==='Before'?'Joint_Departed_Reload':'Joint_Evolved');pair[stage.toLowerCase()]=state;evidence[state.filename]=state.sha256;}
    visits.push(pair);
  }
  const permutations=[];
  for(let i=0;i<count;++i)for(const change of assertSameRegion(i<2?initial[m.loadSequence[i]]:visits[i-2].after,visits[i].before))permutations.push({visit:i,region:m.loadSequence[i],...change});
  if(permutations.length) {
    const name=join(workspace,'output/native-world-attachment-keying-observed.json'),bytes=await bounded(name),audit=JSON.parse(bytes);
    assert.equal(audit.qualified,true);assert.equal(audit.version,1);assert.equal(audit.reader.start,0x5b1cf0);assert.equal(audit.reader.end,0x5b1dc8);assert.equal(audit.reader.instructions,71);
    assert.equal(audit.originalExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
    assert.equal(audit.originalExecutableSha256,(await hashNativeFile(join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe'))).sha256);
    assert.equal(audit.scriptSha256,sha(await bounded(join(workspace,'scripts/audit-native-attachment-keying.py'))));
    assert.equal(audit.contradictoryInstructionControls.length,3);evidence[name]=sha(bytes);
  }
  const last0=count%2?count-2:count-1,last1=count%2?count-1:count-2;
  for(const [name,expected] of [['Residency_Source_0.GMP',visits[last0].after],['Residency_Source_1.GMP',visits[last1].after],['Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP',visits[count-3].after]]) {
    const f=join(profile,name),digest=await hashCheckpointSource(await stoppedFileSource(f));assert.equal(digest,expected.sha256,'Final regional publication differs');evidence[f]=digest;
  }
  for(const state of [initial[0],...visits.filter((v,i)=>i%2).flatMap(v=>[v.before,v.after])])assert.ok(!state.records.units[2142]&&!state.records.agents[72]&&!state.records.attachments['ORDR:2142'],'Dormant transferred actor resurrected');
  const actor=[];
  for(let i=0;i<count;i+=2)for(const stage of ['before','after'])actor.push(await returnedCheckpoint(visits[i][stage].filename,{unitId:532,agentId:85,retiredUnitId:510,retiredAgentId:79}));
  for(let i=2;i<actor.length;i+=2)assert.deepEqual(actor[i-1].actor.position,actor[i].actor.position);
  assert.ok(actor.some((a,i)=>i%2&&JSON.stringify(a.actor.position)!==JSON.stringify(actor[i-1].actor.position)),'No actual continued actor movement');
  assert.equal(m.smokeScript,join(m.fixture,'load-replace.script'));assert.equal(sha(await bounded(m.smokeScript)),m.smokeScriptSha256);
  const expectedSeconds=count===3?60:Math.ceil((10000+Array.from({length:count},(_,i)=>i%2?12000:8000).reduce((a,b)=>a+b,0)+1600*count)/1000)+20;
  assert.equal(m.smokeSeconds,expectedSeconds);assert.equal(m.clockMode,'monotonic');
  const lb=await bounded(m.log,1024*1024),cycles=parsePersistenceLog(lb.toString('utf8'),visits);
  for(let i=0;i<count;++i)assert.equal(cycles[i].units,visits[i].before.counts.units);
  for(const name of ['scripts/check-native-world-persistence.mjs','scripts/run-native-world-residency.py','scripts/build-native-world-residency.py'])sources[name]=sha(await readFile(join(workspace,name)));
  const compact=s=>{const {records,...state}=s;return {...state,recordDigest:sha(JSON.stringify(records))};};
  const extended={};
  if(count!==3) {
    extended.nativeResourceSampling=nativeResourceSampling(m);
    extended.originalAttachmentContainerSerializationPermutations=permutations;
    extended.retainedAllocationVisits=cycles.map(c=>({visit:c.index,region:m.loadSequence[c.index],postUnloadHeapBytes:c.after.heap,postUnloadHeapBlocks:c.after.blocks,postUnloadCrtAllocations:c.after.crt}));
    extended.extendedPerVisitPersistenceQualified=true;
  }
  return {qualified:true,scope:count===3?'Three actual solo native loads with20 completed ticks each, original saves before every unload, exact persisted regional revisit including scripting RNG and every world section except validated save labels/calendar timestamps. Six roots retire once per exit. Sustained residency, continuous/generated adjacent worlds and browser/co-op integration remain unqualified.':count+' actual solo native loads with20 completed ticks each, original saves before every unload and every revisited region semantically preserved, including both RNG states, every entity/queue, saved sections, and every ID-keyed order-container byte. Validated save labels/calendar timestamps and an audited original ID-keyed ORDR container serialization permutation are recorded separately. Six roots retire once per exit. Sustained residency, continuous/generated adjacent worlds and browser/co-op integration remain unqualified.',
    sourceManifest:resolve(manifestName),sourceManifestSha256:sha(mb),fixture:m,cycles,initial:initial.map(compact),visits:visits.map(v=>({before:compact(v.before),after:compact(v.after)})),actor:actor.map(a=>a.actor),
    originalPerVisitSaveAndRevisitQualified:true,savedScriptingRngRestorationQualified:true,savedGameplayRngRestorationQualified:true,originalWholeWorldTeardownAndReloadQualified:true,
    originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,generatedAdjacentTerrainQualified:false,continuousTravelQualified:false,coopRegionHandoffQualified:false,
    browserUsed:false,nativeProcessesStarted:0,sourceSha256:sources,evidenceSha256:{...evidence,[resolve(manifestName)]:sha(mb),[m.log]:sha(lb),[m.buildReport]:sha(bb),[m.smokeScript]:m.smokeScriptSha256},...extended};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [name,out]=process.argv.slice(2);if(!name||!out||process.argv.length!==4)throw Error('Usage: <terminal persistence manifest> <fresh report>');
  const r=await verifyWorldPersistence(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,cycles:r.cycles.length,revisitedClock:r.visits[2].before.clock,revisitedRng:r.visits[2].before.rng,counts:r.visits[2].before.counts,originalBoundedRegionResidencyQualified:false}));
}
