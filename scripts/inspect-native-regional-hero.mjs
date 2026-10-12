#!/usr/bin/env node
// Complete copied-record comparison for the original generated-region trial.
// Restoration/removal is qualified; the hero was never finalized or scheduled.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointAgentRecord,checkpointAgentRecordValues,checkpointUnitAgentLinks,
  checkpointAgents,checkpointUnits,checkpointAttachments,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
const memory=b=>({size:b.length,async readAt(at,n){assert.ok(n<=4096&&at>=0&&at+n<=b.length);return Uint8Array.from(b.subarray(at,at+n));}});
export async function inspectNativeRegionalHero(manifestName){
  const m=await json(manifestName);
  const effects=m.regionalEffectsTrial===true;
  const moving=m.regionalMotionTrial===true;assert.ok(!moving||effects);
  const saving=m.regionalHeroCheckpointTrial===true;assert.ok(!saving||moving);
  for(const k of ['nativeOnly','nativeSessionTerminal','ownedProducerAbsent','regionalHeroTrialCompleted',
    'originalSourceUnchanged','sourceCopyUnchanged','donorUnchanged','originalSettingsUnchanged','proposalsUnchanged','privateNativeExecutableUnchanged'])assert.equal(m[k],true,k);
  for(const k of ['browserUsed','nativeActivationQualified','ownerPublished','goalComplete'])assert.equal(m[k],false,k);
  assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);assert.equal(m.nativeProcessesStarted,1);
  try{process.kill(m.nativePid,0);throw Error('Original producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
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
  for(const [n,key]of [['scripts/run-native-regional-hero.py','runnerSha256'],['scripts/run-native-regional-home.py','supervisorSha256'],['scripts/lib/native_pair_guard.py','guardSha256']])assert.equal(await hash(n),m[key]);
  assert.equal(await hash(m.preparation),m.preparationSha256);const p=await json(m.preparation);
  assert.equal(p.regionalHeroRuntimeInputsPrepared,true);assert.equal(p.region,m.region);
  assert.equal(p.regionalEffectsInputsPrepared===true,effects);
  if(effects){
    assert.equal(await hash(p.basePreparation),p.basePreparationSha256);
    const base=await json(p.basePreparation);
    assert.deepEqual(p.records.slice(0,10),base.records);
    for(const key of ['checkedCapsule','capsulePreparation','originalGeneratedManifest'])assert.equal(p[key],base[key]);
  }
  for(const[n,h]of Object.entries(p.sourceSha256))assert.equal(await hash(n),h);
  for(const key of ['checkedCapsule','capsulePreparation','originalGeneratedManifest'])assert.equal(await hash(p[key]),p[key+'Sha256']);
  const checked=await json(p.checkedCapsule);assert.equal(checked.originalOutdoorHeroCapsuleBytesQualified,true);
  for(const[n,h]of Object.entries(checked.sourceSha256))assert.equal(await hash(n),h);
  assert.equal(await hash(checked.audit),checked.auditSha256);
  assert.equal(m.source,p.destination.filename);assert.equal(await hash(m.source),p.destination.sha256);
  assert.equal(await hash(m.sourceCopy),p.destination.sha256);assert.equal(await hash(m.donor),p.originalSource.sha256);
  for(const[n,h]of Object.entries(p.inputHashes))assert.equal(await hash(join(m.settingsProfile,n)),h);
  assert.deepEqual(m.preservedBefore,m.preservedAfter);
  for(const[name,before]of Object.entries(m.preservedBefore)){
    if(before===null){await assert.rejects(stat(name),e=>e.code==='ENOENT');continue;}
    const s=await stat(name,{bigint:true});assert.equal(await hash(name),before.sha256);
    assert.equal(Number(s.size),before.bytes);assert.equal(Number(s.ino),before.inode);assert.equal(Number(s.mtimeNs),before.mtimeNs);
  }
  assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await readFile(m.script,'utf8'),`wait ${moving?26000:effects?20000:12000}\ndump regional_hero_restored\n`);
  assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=m.logCeilingBytes);
  const log=await readFile(m.log,'utf8');assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
  assert.ok(!/result=fail|SIGSEGV|abort from|Family allocation refused/.test(log));
  const lines=log.split('\n').filter(l=>l.startsWith('[streaming] Family ')||l.startsWith('[streaming] Regional hero '));assert.equal(lines.length,effects?10:11);
  const sourceIds=[504,527,528,529],requests=[14,10,9,9],bytes=[454,202,161,161],sizes=[300,208,128,128];
  for(let i=0;i<4;++i){
    assert.equal(lines[i*2],`[streaming] Family unit stage source=${sourceIds[i]} status=00000000 complete=1 failure=0`);
    assert.equal(lines[i*2+1],`[streaming] Family orders restored requests=${requests[i]} requested-bytes=${bytes[i]} payload-bytes=${sizes[i]} exact=1 transferred=1 result=pass`);
  }
  const parsed=lines[8].match(/^\[streaming\] Family records hero=(\d+) effects=(\d+),(\d+),(\d+) agent=(\d+) clock=(\d+) exact=1 internal-links=3 home-proxy=(\d+) home-native=0 scheduled=0 finalization=0 owner-published=0 result=pass$/);assert.ok(parsed);
  const [hero,...values]=parsed.slice(1).map(Number),ids=[hero,...values.slice(0,3)],agentId=values[3],clock=values[4],homeAgent=values[5];
  assert.ok(ids.every((n,i)=>n===hero+i&&n>0&&n<0x7ffffffe));assert.equal(clock,p.destinationClockMs);assert.equal(homeAgent,p.homeAgentId);
  assert.equal(lines[9],`[streaming] Regional hero key=${m.region} clock=${clock} home=${homeAgent} source-guild=469 pending-intercept=1 source-position-retained=1 activation=0 result=pass`);
  if(!effects)assert.equal(lines[10],'[streaming] Family cleanup requests=42 original-removal=1 aliases-absent=1 registry-preserved=1 proxy-preserved=1 queues-preserved=1 hooks-removed=1 result=pass');
  const original=await stoppedFileSource(m.source);
  for await(const u of checkpointUnitAgentLinks(original))assert.ok(!ids.includes(u.unitId));
  for await(const a of checkpointAgents(original))assert.notEqual(a.agentId,agentId);
  assert.equal(m.records.length,saving?41:moving?37:effects?36:26);const names=new Set();
  for(const r of m.records){
    assert.equal(r.filename,join(m.profile,basename(r.filename)));assert.ok(!names.has(r.filename));names.add(r.filename);
    const got=await hashNativeFile(r.filename,{maximum:65536});assert.equal(got.sha256,r.sha256);assert.equal(got.bytes,r.bytes);
  }
  assert.equal(m.proposals.length,effects?11:10);
  for(const r of p.records){
    const copied=m.proposals.find(x=>x.filename===r.filename);assert.ok(copied);
    assert.equal(copied.copied,join(m.profile,basename(r.filename)));assert.equal(await hash(r.filename),r.sha256);assert.equal(await hash(copied.copied),r.sha256);
  }
  const record=async n=>{const filename=join(m.profile,n);assert.ok(names.has(filename));return readFile(filename);};
  const completeComparisons=[];
  for(let i=0;i<4;++i){
    const n=sourceIds[i],expected=Buffer.from(await record(`Family_Proposal_${n}.UNIT`));assert.equal(expected.readUInt32LE(36),100000+i);
    expected.writeUInt32LE(0,36);expected.writeUInt32LE(i?hero:0,56);
    if(!i){assert.equal(expected.readUInt32LE(120),1000);expected.writeUInt32LE(agentId,120);}
    assert.deepEqual(await record(`Family_Input_${n}.UNIT`),expected);
    expected.writeUInt32LE(ids[i],36);assert.deepEqual(await record(`Family_Observed_${n}.UNIT`),expected);
    const orders=await record(`Family_Proposal_${n}_Orders.bin`);
    assert.deepEqual(await record(`Family_Observed_${n}_Orders.bin`),orders);
    assert.equal(orders.readUInt32LE(i?44:36),i===0?clock:i===1?clock-50:clock-300);
    completeComparisons.push({sourceUnitId:n,nativeUnitId:ids[i],unitBytes:expected.length,orderPayloadBytes:orders.length});
  }
  // The deferred completion reference remains an explicit original469.
  const heroOrders=await record('Family_Observed_504_Orders.bin');assert.equal(heroOrders.readUInt32LE(208),469);assert.equal(heroOrders.readUInt32LE(212),0x1003);
  const script=await record('Family_Proposal_Agent.GPL'),expected=Buffer.from(script),s=await checkpointAgentRecord(memory(script));
  assert.equal(s.agentId,1000);assert.equal(s.unitId,100000);
  for await(const v of checkpointAgentRecordValues(memory(script)))if(v.type===5&&v.targetAgentId!==null){
    assert.ok([1000,homeAgent].includes(v.bits));expected.writeUInt32LE(v.bits===1000?agentId:homeAgent,v.offset);
  }
  expected.writeUInt32LE(agentId,script.length-24-Buffer.byteLength(s.name));expected.writeUInt32LE(hero,script.length-19);
  assert.deepEqual(await record('Family_Input_Agent.GPL'),expected);assert.deepEqual(await record('Family_Observed_Agent.GPL'),expected);
  const container=Buffer.from(await record('Family_Proposal_Container.bin'));
  assert.deepEqual(Array.from({length:6},(_,i)=>container.readUInt32LE(i*4)),[1,2,1,0,101,100000]);
  container.writeUInt32LE(hero,20);container.writeUInt32LE(hero,36);
  ids.slice(1).forEach((id,i)=>container.writeUInt32LE(id,40+i*8));
  assert.deepEqual(await record('Family_Input_Container.bin'),container);assert.deepEqual(await record('Family_Observed_Container.bin'),container);
  let ordinaryEffects=null,regionalMotion=null,savedMovedHero=null;
  if(effects){
    const capsule=await json(p.capsulePreparation),identity=capsule.identity,home=identity.registeredHome;
    const binding=await record('Regional_Home_Binding.bin'),want=Buffer.alloc(320);
    [0x31485246,2,469,7,homeAgent,0x31564241,0,0].forEach((n,i)=>want.writeUInt32LE(n,i*4));
    [identity.entityId,home.guildEntityId,home.worldId,identity.contentDigest].forEach((s,i)=>{assert.match(s,/^[a-f0-9]{64}$/);want.write(s,32+i*64,'ascii');});
    want.write(m.region,288,'ascii');want.write('0_0',304,'ascii');assert.deepEqual(binding,want);
    const request=JSON.parse(await record('Regional_Home_Request.json'));
    assert.deepEqual(request,{version:1,kind:'registered-home-go_home',entityId:identity.entityId,
      guildEntityId:home.guildEntityId,worldId:home.worldId,contentDigest:identity.contentDigest,
      receivingRegion:m.region,homeRegion:'0_0',heroId:hero,agentId,homeUnitId:469,homeAgentId:7,
      proxyAgentId:homeAgent,proxyNativeId:0,pauseAnchorClockMs:clock,requestClockMs:clock+50,ownerPublished:false});
    for(const suffix of moving?['Hero.GPL','Proxy.GPL']:['Hero.UNIT','Hero.GPL','Hero_Orders.bin','Proxy.GPL'])
      assert.deepEqual(await record(`Regional_Effects_Before_${suffix}`),await record(`Regional_Effects_After_${suffix}`));
    let originalProxy;
    for await(const a of checkpointAgents(original))if(a.agentId===homeAgent){assert.equal(originalProxy,undefined);originalProxy=a;}
    assert.ok(originalProxy);assert.equal(originalProxy.size,453);
    assert.deepEqual(await record('Regional_Effects_Before_Proxy.GPL'),Buffer.from(await original.readAt(originalProxy.offset,originalProxy.size)));
    assert.deepEqual(await record('Regional_Effects_Before_Hero.UNIT'),await record('Family_Observed_504.UNIT'));
    assert.deepEqual(await record('Regional_Effects_Before_Hero.GPL'),await record('Family_Observed_Agent.GPL'));
    assert.deepEqual(await record('Regional_Effects_Before_Hero_Orders.bin'),heroOrders);
    const events=log.split('\n').filter(l=>/^\[streaming\] Regional (?:effects |effect |home held)/.test(l));
    assert.equal(events.length,9);
    assert.ok(events.includes(`[streaming] Regional effects armed hero=${hero} agent=${agentId} clock=${clock} home=${homeAgent} guards=2 effect-ordinary-ticks=1 hero-spatial-finalization=${moving?1:0} owner-published=0 result=pass`));
    assert.ok(events.includes(`[streaming] Regional home held hero=${hero} agent=${agentId} proxy=${homeAgent} clock=${clock+50} before-native-lookup=1 owner-published=0 result=pass`));
    const lifetimes=[450,700,2700];
    for(let i=0;i<3;++i){
      assert.ok(events.includes(`[streaming] Regional effect first index=${i+1} clock=${clock+50} heap-base=0 flags=${i?544:2592} id=${ids[i+1]}`));
      assert.ok(events.includes(`[streaming] Regional effect finished source=${sourceIds[i+1]} id=${ids[i+1]} clock=${clock+lifetimes[i]} elapsed=${lifetimes[i]} flags=2596 original-dispatch=1 result=pass`));
    }
    const cleanup=events.find(l=>l.startsWith('[streaming] Regional effects cleanup '));
    const finished=cleanup?.match(/^\[streaming\] Regional effects cleanup elapsed=(\d+) finished=450,700,2700 hero-held=(\d+) agent-held=(\d+) effect-calls=(\d+),(\d+),(\d+) other-ai=(\d+) other-commands=(\d+) original-removal=1 requests=42 hooks-removed=1 owner-published=0 result=pass$/);
    assert.ok(finished);const duration=Number(finished[1]),counters=finished.slice(2).map(Number);assert.ok(counters.every(n=>n>0));
    assert.ok(duration>=3000&&duration<=(moving?12000:3000)&&duration%50===0);
    assert.deepEqual(counters.slice(2,5),[9,14,54]);
    ordinaryEffects={destinationClockMs:clock,lifetimesMs:lifetimes,ordinaryClockTicks:true,
      originalPostload:true,heroRecordAndOrdersUnchanged:!moving,registeredHomeRequest:request,
      commandCalls:counters.slice(2,5),heroHeld:counters[0],agentHeld:counters[1],otherAgentCalls:counters[5],otherCommandCalls:counters[6]};
    if(moving){
      const motionLines=log.split('\n').filter(l=>l.startsWith('[streaming] Regional motion '));assert.equal(motionLines.length,saving?3:2);
      const before=await record('Regional_Effects_Before_Hero.UNIT'),after=await record('Regional_Effects_After_Hero.UNIT');
      const pose=b=>Array.from({length:5},(_,i)=>b.readInt32LE(60+i*4));
      const originalPose=pose(before),finalPose=pose(after);assert.equal(before.length,442);assert.equal(after.length,442);
      assert.equal(motionLines[0],`[streaming] Regional motion placed hero=${hero} grid=256 cell=${originalPose[3]},${originalPose[4]} footprint=4 fixed=${originalPose[0]},${originalPose[1]},${originalPose[2]} second-postload=4 path-cache-empty=1 queue-held=1 source-local-position-retained=1 global-continuity=0 owner-published=0 result=pass`);
      const summary=motionLines[1].match(/^\[streaming\] Regional motion complete samples=(\d+) path-calls=(\d+) move-calls=(\d+) queue-held=(\d+) first=(\d+),(\d+) last=(\d+),(\d+) path-consumed=1 physical=4 drawing=1 guild-task-held=1 global-continuity=0 owner-published=0 result=pass$/);assert.ok(summary);
      const [sampleCount,pathCalls,moveCalls,queueHeld,firstX,firstY,lastX,lastY]=summary.slice(1).map(Number);
      assert.ok(sampleCount>=2&&sampleCount<=256&&pathCalls>0&&moveCalls>0&&queueHeld>0);
      assert.deepEqual([firstX,firstY],originalPose.slice(0,2));assert.deepEqual([lastX,lastY],finalPose.slice(0,2));
      assert.notDeepEqual([firstX,firstY],[lastX,lastY]);
      const samples=await record('Regional_Motion_Samples.bin');assert.equal(samples.length,sampleCount*24);assert.equal((sampleCount-1)*50,duration);
      const positions=[];
      for(let i=0;i<sampleCount;++i){
        const at=i*24,time=samples.readUInt32LE(at),p=Array.from({length:5},(_,j)=>samples.readInt32LE(at+4+j*4));
        assert.equal(time,clock+i*50);assert.ok(p.slice(0,2).every(n=>n>=0&&n<256*32768));
        assert.ok(p.slice(3).every(n=>n>=0&&n<256));positions.push(p);
      }
      assert.deepEqual(positions[0],originalPose);assert.deepEqual(positions.at(-1),finalPose);
      // The executed Path's goal is native-world space. The original route
      // resolves to its navigation-grid cell; this is destination-local motion.
      const goal=capsule.plan.heroOrders.navigation.find(x=>x.field==='destination');
      assert.ok(goal);assert.deepEqual(finalPose.slice(0,2),[goal.x,goal.y].map(n=>Math.trunc(n/16)*32768));
      const pending=Buffer.from(heroOrders.subarray(156)),emptyBank=Buffer.from(heroOrders.subarray(0,8));emptyBank.writeUInt32LE(0,4);
      assert.equal(heroOrders.readUInt32LE(152),0); // source Path has no cached waypoints
      assert.deepEqual(await record('Regional_Effects_After_Hero_Orders.bin'),Buffer.concat([emptyBank,pending]));
      const differences=[];for(let i=0;i<before.length;++i)if(before[i]!==after[i])differences.push(i);
      // After ordinary route completion all bytes outside position/elevation
      // and saved grid cells must still match the original restored record.
      assert.ok(differences.every(i=>i>=60&&i<80));
      regionalMotion={originalPathCompleted:true,sourceLocalPose:originalPose,destinationLocalPose:finalPose,
        elapsedMs:duration,sampleCount,pathCalls,moveCalls,queueHeld,footprintCells:4,
        pendingQueueBytesUnchanged:true,heroScriptUnchanged:true,changedNativeByteOffsets:differences,
        originalPositionChanged:true,globalContinuityQualified:false,sourceRetired:false,ownerPublished:false};
      if(saving){
        assert.equal(motionLines[2],`[streaming] Regional motion saved hero=${hero} agent=${agentId} clock=${clock+duration} original-whole-world-writer=1 held-records-same=1 owner-published=0 result=pass`);
        for(const suffix of ['Hero.UNIT','Hero.GPL','Hero_Orders.bin','Proxy.GPL'])
          assert.deepEqual(await record(`Regional_Motion_Saved_${suffix}`),await record(`Regional_Effects_After_${suffix}`));
        assert.ok(m.checkpoint);assert.equal(m.checkpoint.filename,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Regional_Hero_Moved.GMP'));
        const saved=m.checkpoint,info=await hashNativeFile(saved.filename,{maximum:64*1024*1024});assert.equal(info.sha256,saved.sha256);assert.equal(info.bytes,saved.bytes);
        const world=await stoppedFileSource(saved.filename);assert.equal(await checkpointSavedClock(world),clock+duration);
        let savedHero,savedAgent,savedProxy,savedOrders;const groups=[];
        for await(const u of checkpointUnits(world)){
          if(u.primary.words[1]===hero){assert.equal(savedHero,undefined);savedHero=u;}
          assert.ok(!ids.slice(1).includes(u.primary.words[1]),'Expired effect must not remain in saved world');
        }
        assert.ok(savedHero);assert.equal(savedHero.size,after.length);assert.deepEqual(Buffer.from(await world.readAt(savedHero.offset,savedHero.size)),after);
        for await(const a of checkpointAgents(world)){
          if(a.agentId===agentId){assert.equal(savedAgent,undefined);savedAgent=a;}
          if(a.agentId===homeAgent){assert.equal(savedProxy,undefined);savedProxy=a;}
        }
        assert.ok(savedAgent&&savedProxy);
        assert.deepEqual(Buffer.from(await world.readAt(savedAgent.offset,savedAgent.size)),await record('Regional_Motion_Saved_Hero.GPL'));
        assert.deepEqual(Buffer.from(await world.readAt(savedProxy.offset,savedProxy.size)),await record('Regional_Motion_Saved_Proxy.GPL'));
        for await(const a of checkpointAttachments(world))if(a.unitId===hero&&a.kind==='ORDR'){assert.equal(savedOrders,undefined);savedOrders=a;}
        assert.ok(savedOrders);assert.equal(savedOrders.size,188);
        assert.deepEqual(Buffer.from(await world.readAt(savedOrders.primary.offset+16,152)),await record('Regional_Motion_Saved_Hero_Orders.bin'));
        for await(const g of checkpointContainerEntries(world))if(g.unitId===hero){assert.equal(g.type,'group');assert.equal(g.groupOwnerUnitId,hero);assert.equal(g.memberCount,0);groups.push(g.groupKind);}
        assert.deepEqual(groups,[101,1]);
        savedMovedHero={...saved,clockMs:clock+duration,heroId:hero,agentId,homeAgentId:homeAgent,
          fullNativeUnitBytesQualified:true,fullScriptAndHomeBytesQualified:true,pendingQueueBytesQualified:true,
          expiredEffectsAbsent:true,emptyHomeAndChildGroupsPreserved:true,producerAbsent:true,
          freshReloadQualified:false,ownerPublished:false};
      }
    }
  }
  assert.ok(m.resourceSamples.length>0&&m.resourceSamples.length<=20);
  assert.ok(m.resourceSamples.every(s=>s.rssBytes<=m.rssCeilingBytes&&s.ownedPids.every(pid=>pid===m.nativePid)));
  const elapsedMs=m.finishedAtMs-m.startedAtMs;assert.ok(elapsedMs<=35000);
  assert.ok(m.frame);assert.equal(await hash(m.frame.filename),m.frame.sha256);
  return {version:1,originalGeneratedRegionHeroRecordsRestored:true,manifest:resolve(manifestName),manifestSha256:await hash(manifestName),
    region:m.region,clock,heroId:hero,effectIds:ids.slice(1),agentId,homeAgentId:homeAgent,
    completeComparisons,scriptRecordBytes:expected.length,containerPayloadBytes:container.length,
    ordinaryEffects,originalRegionalEffectLifetimesQualified:effects,
    regionalMotion,originalRegionalHeroPathExecutionQualified:moving,
    savedMovedHero,originalMovedHeroWholeWorldSaveQualified:saving,
    originalOrderRequestsFreed:42,requestedOrderBytes:978,sourcePositionPreserved:!moving,sourcePositionPreservedAtAdmission:true,pendingHomeReference:469,
    nativeActivationQualified:false,continuousPositionQualified:false,ownerPublished:false,heroTransferred:false,
    peakSampledRssBytes:Math.max(...m.resourceSamples.map(x=>x.rssBytes)),elapsedMs,
    sourceSha256:{'scripts/inspect-native-regional-hero.mjs':await hash(new URL(import.meta.url).pathname),
      'web/world/checkpoint.mjs':await hash('web/world/checkpoint.mjs'),'web/world/saved-clock.mjs':await hash('web/world/saved-clock.mjs')},
    originalInputsAndServedFilesUnchanged:true,browserUsed:false,goalComplete:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const [manifest,output]=process.argv.slice(2);assert.equal(process.argv.length,4);
  const result=await inspectNativeRegionalHero(manifest);await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({originalGeneratedRegionHeroRecordsRestored:true,heroId:result.heroId,effectIds:result.effectIds,
    agentId:result.agentId,originalOrderRequestsFreed:42,nativeActivationQualified:false}));
}
