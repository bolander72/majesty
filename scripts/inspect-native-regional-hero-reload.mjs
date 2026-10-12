#!/usr/bin/env node
// Fresh-process proof: inspect actual restored records, not a controller flag.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
function absent(pid){try{process.kill(pid,0);throw Error('Producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
export async function inspectNativeRegionalHeroReload(manifestName){
  const m=await json(manifestName);
  for(const k of ['nativeOnly','nativeSessionTerminal','ownedProducerAbsent','regionalHeroTrialCompleted','regionalEffectsTrial','regionalHeroReloadTrial',
    'originalSourceUnchanged','sourceCopyUnchanged','donorUnchanged','originalSettingsUnchanged','proposalsUnchanged','privateNativeExecutableUnchanged'])assert.equal(m[k],true,k);
  for(const k of ['browserUsed','nativeActivationQualified','ownerPublished','goalComplete','regionalMotionTrial','regionalHeroCheckpointTrial'])assert.equal(m[k],false,k);
  assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);assert.equal(m.nativeProcessesStarted,1);absent(m.nativePid);
  const fixture=await ownedDirectory(m.fixture,'actor-arrival-fixture-regional-hero-runtime-');
  assert.equal(m.worldRoot,join(fixture,'native-world-regional-hero'));assert.equal(m.profile,join(m.worldRoot,'frontier_'+m.region));
  assert.equal(m.privateNativeExecutable,join(fixture,'native/recomp/pop_smoke'));assert.equal(m.privateRegistry,join(fixture,'registry.json'));
  assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);
  assert.equal(await hash(m.buildReport),m.buildReportSha256);const build=await json(m.buildReport);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert.ok(build.finishedAtMs<=m.startedAtMs);
  assert.equal(await hash(build.log),build.logSha256);assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);
  const compiled={};for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256']){
    for(const[n,h]of Object.entries(build[group])){assert.ok(!Object.hasOwn(compiled,n));compiled[n]=h;assert.equal(await hash(join(workspace,n)),h);}
  }
  assert.equal(Object.keys(compiled).length,53);assert.deepEqual(compiled,m.compiledSourceSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe')),'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  for(const[n,k]of [['scripts/run-native-regional-hero.py','runnerSha256'],['scripts/run-native-regional-home.py','supervisorSha256'],['scripts/lib/native_pair_guard.py','guardSha256']])assert.equal(await hash(n),m[k]);
  assert.equal(await hash(m.reloadProof),m.reloadProofSha256);const proof=await json(m.reloadProof);
  assert.equal(proof.originalMovedHeroWholeWorldSaveQualified,true);assert.equal(proof.ownerPublished,false);assert.equal(proof.browserUsed,false);
  for(const[n,h]of Object.entries(proof.sourceSha256))assert.equal(await hash(n),h);
  assert.equal(await hash(proof.manifest),proof.manifestSha256);const prior=await json(proof.manifest);
  assert.equal(prior.nativeSessionTerminal,true);assert.equal(prior.nativeExitCode,0);assert.equal(prior.ownedProducerAbsent,true);absent(prior.nativePid);
  assert.equal(await hash(prior.privateNativeExecutable),prior.nativeExecutableSha256);assert.equal(await hash(prior.log),prior.logSha256);
  const archive=await json(join(workspace,'output/native-regional-moved-save-generation-211/manifest.json'));
  const preserved=new Map(archive.sources.map(r=>[r.original,r]));
  assert.equal(Object.keys(prior.compiledSourceSha256).length,53);
  for(const[n,h]of Object.entries(prior.compiledSourceSha256)){const r=preserved.get(join(workspace,n));assert.ok(r);assert.equal(r.sha256,h);assert.equal(await hash(r.preserved),h);}
  const saved=proof.savedMovedHero;assert.equal(proof.region,m.region);assert.equal(m.source,saved.filename);
  assert.equal(await hash(m.source),saved.sha256);assert.equal(await hash(m.sourceCopy),saved.sha256);assert.equal(m.sourceSha256,saved.sha256);
  assert.equal(m.checkpoint,null);
  assert.equal(await hash(m.preparation),m.preparationSha256);const p=await json(m.preparation);
  assert.equal(p.regionalHeroRuntimeInputsPrepared,true);assert.equal(p.regionalEffectsInputsPrepared,true);assert.equal(p.region,m.region);assert.equal(p.homeAgentId,saved.homeAgentId);
  assert.equal(await hash(p.basePreparation),p.basePreparationSha256);const base=await json(p.basePreparation);assert.deepEqual(p.records.slice(0,10),base.records);
  for(const[n,h]of Object.entries(p.sourceSha256))assert.equal(await hash(n),h);
  for(const k of ['checkedCapsule','capsulePreparation','originalGeneratedManifest'])assert.equal(await hash(p[k]),p[k+'Sha256']);
  const checked=await json(p.checkedCapsule);assert.equal(checked.originalOutdoorHeroCapsuleBytesQualified,true);
  for(const[n,h]of Object.entries(checked.sourceSha256))assert.equal(await hash(n),h);
  assert.equal(await hash(checked.audit),checked.auditSha256);
  assert.equal(await hash(p.destination.filename),p.destination.sha256);assert.equal(await hash(m.donor),p.originalSource.sha256);
  for(const[n,h]of Object.entries(p.inputHashes))assert.equal(await hash(join(m.settingsProfile,n)),h);
  assert.deepEqual(m.preservedBefore,m.preservedAfter);
  for(const[n,b]of Object.entries(m.preservedBefore)){
    if(b===null){await assert.rejects(stat(n),e=>e.code==='ENOENT');continue;}
    const s=await stat(n,{bigint:true});assert.equal(await hash(n),b.sha256);assert.equal(Number(s.size),b.bytes);assert.equal(Number(s.ino),b.inode);assert.equal(Number(s.mtimeNs),b.mtimeNs);
  }
  assert.equal(m.records.length,20);const names=new Set();
  for(const r of m.records){assert.equal(r.filename,join(m.profile,basename(r.filename)));assert.ok(!names.has(r.filename));names.add(r.filename);
    const got=await hashNativeFile(r.filename,{maximum:65536});assert.equal(got.sha256,r.sha256);assert.equal(got.bytes,r.bytes);}
  assert.equal(m.proposals.length,11);
  for(const r of p.records){const copy=m.proposals.find(x=>x.filename===r.filename);assert.ok(copy);assert.equal(copy.copied,join(m.profile,basename(r.filename)));assert.equal(await hash(r.filename),r.sha256);assert.equal(await hash(copy.copied),r.sha256);}
  const record=async n=>{const path=join(m.profile,n);assert.ok(names.has(path));return readFile(path);};
  const world=await stoppedFileSource(m.source);assert.equal(await checkpointSavedClock(world),saved.clockMs);
  let hero,agent,proxy,orders;const groups=[];
  for await(const u of checkpointUnits(world)){
    if(u.primary.words[1]===saved.heroId){assert.equal(hero,undefined);hero=u;}
    assert.ok(!proof.effectIds.includes(u.primary.words[1]),'Expired effects returned');
  }
  for await(const a of checkpointAgents(world)){
    if(a.agentId===saved.agentId){assert.equal(agent,undefined);agent=a;}
    if(a.agentId===saved.homeAgentId){assert.equal(proxy,undefined);proxy=a;}
  }
  for await(const a of checkpointAttachments(world))if(a.unitId===saved.heroId&&a.kind==='ORDR'){assert.equal(orders,undefined);orders=a;}
  for await(const g of checkpointContainerEntries(world))if(g.unitId===saved.heroId){assert.equal(g.type,'group');assert.equal(g.memberCount,0);groups.push(g.groupKind);}
  assert.deepEqual(groups,[101,1]);assert.ok(hero&&agent&&proxy&&orders);assert.equal(hero.size,442);assert.equal(agent.size,1850);assert.equal(proxy.size,453);assert.equal(orders.size,188);
  const raw={
    'Hero.UNIT':Buffer.from(await world.readAt(hero.offset,hero.size)),
    'Hero.GPL':Buffer.from(await world.readAt(agent.offset,agent.size)),
    'Proxy.GPL':Buffer.from(await world.readAt(proxy.offset,proxy.size)),
    'Hero_Orders.bin':Buffer.from(await world.readAt(orders.primary.offset+16,152)),
  };
  for(const[suffix,bytes]of Object.entries(raw))for(const phase of ['Before','After'])assert.deepEqual(await record(`Regional_Reload_${phase}_${suffix}`),bytes,suffix+' '+phase);
  const pose=Array.from({length:5},(_,i)=>raw['Hero.UNIT'].readInt32LE(60+i*4));assert.deepEqual(pose,proof.regionalMotion.destinationLocalPose);
  assert.equal(raw['Hero_Orders.bin'].readUInt32LE(4),0);assert.equal(raw['Hero_Orders.bin'].readUInt32LE(8),1);assert.equal(raw['Hero_Orders.bin'].readUInt32LE(12),1);
  const capsule=await json(p.capsulePreparation),identity=capsule.identity,home=identity.registeredHome;
  const binding=Buffer.alloc(320);[0x31485246,2,469,7,saved.homeAgentId,0x31564241,0,0].forEach((v,i)=>binding.writeUInt32LE(v,i*4));
  [identity.entityId,home.guildEntityId,home.worldId,identity.contentDigest].forEach((v,i)=>binding.write(v,32+i*64,'ascii'));
  binding.write(m.region,288,'ascii');binding.write('0_0',304,'ascii');assert.deepEqual(await record('Regional_Home_Binding.bin'),binding);
  const anchor=proof.ordinaryEffects.registeredHomeRequest.pauseAnchorClockMs;
  const request=JSON.parse(await record('Regional_Home_Request.json'));
  assert.deepEqual(request,{...proof.ordinaryEffects.registeredHomeRequest,requestClockMs:saved.clockMs+50});assert.equal(request.pauseAnchorClockMs,anchor);
  assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await readFile(m.script,'utf8'),'wait 20000\ndump regional_hero_restored\n');
  assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=m.logCeilingBytes);const log=await readFile(m.log,'utf8');
  assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));assert.ok(!/result=fail|SIGSEGV|abort from|Family allocation refused/.test(log));
  assert.ok(!log.includes('Family unit stage '),'Reload must not import duplicate actors');
  const events=log.split('\n').filter(l=>/^\[streaming\] Regional (?:hero reload |home held )/.test(l));assert.equal(events.length,3);
  assert.equal(events[0],`[streaming] Regional hero reload armed hero=${saved.heroId} agent=${saved.agentId} home=${saved.homeAgentId} clock=${saved.clockMs} pause-anchor=${anchor} physical=4 drawing=1 queued=1 imported=0 guards=2 native-cache=1 owner-published=0 result=pass`);
  assert.equal(events[1],`[streaming] Regional home held hero=${saved.heroId} agent=${saved.agentId} proxy=${saved.homeAgentId} clock=${saved.clockMs+50} before-native-lookup=1 owner-published=0 result=pass`);
  const cleanup=events[2].match(/^\[streaming\] Regional hero reload cleanup elapsed=3000 hero-held=(\d+) agent-held=(\d+) other-ai=(\d+) other-commands=(\d+) original-removal=1 hooks-removed=1 owner-published=0 result=pass$/);
  assert.ok(cleanup);assert.ok(cleanup.slice(1).map(Number).every(n=>n>0));
  assert.equal(m.deadlineSeconds,35);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
  assert.ok(m.resourceSamples.length>0&&m.resourceSamples.length<=20);assert.ok(m.resourceSamples.every(s=>s.rssBytes<=m.rssCeilingBytes&&s.ownedPids.every(pid=>pid===m.nativePid)));
  const elapsedMs=m.finishedAtMs-m.startedAtMs;assert.ok(elapsedMs<=35000);assert.ok(m.frame);assert.equal(await hash(m.frame.filename),m.frame.sha256);
  return {version:1,originalMovedHeroFreshReloadQualified:true,manifest:resolve(manifestName),manifestSha256:await hash(manifestName),
    savedProof:m.reloadProof,savedProofSha256:m.reloadProofSha256,region:m.region,heroId:saved.heroId,agentId:saved.agentId,homeAgentId:saved.homeAgentId,
    worldClockMs:saved.clockMs,pauseAnchorClockMs:anchor,destinationLocalPose:pose,ordinaryElapsedMs:3000,
    completeRecordComparisons:8,pendingQueueBytes:152,originalRegistrationRestored:true,duplicateImport:false,
    guildTaskHeld:true,originalCleanupQualified:true,globalContinuityQualified:false,sourceRetired:false,ownerPublished:false,
    peakSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),elapsedMs,
    sourceSha256:Object.fromEntries(await Promise.all(['scripts/inspect-native-regional-hero-reload.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs'].map(async n=>[n,await hash(n)]))),
    originalInputsAndServedFilesUnchanged:true,browserUsed:false,goalComplete:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const[manifest,output]=process.argv.slice(2);assert.equal(process.argv.length,4);const result=await inspectNativeRegionalHeroReload(manifest);
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({originalMovedHeroFreshReloadQualified:true,heroId:result.heroId,completeRecordComparisons:result.completeRecordComparisons}));
}
