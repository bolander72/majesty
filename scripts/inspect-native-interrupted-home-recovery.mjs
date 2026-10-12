#!/usr/bin/env node
// A second ordinary process must resume the committed pre-acknowledgement home
// with exact saved records and one owner, not construct the hero again.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {inspectInterruptedHomeCheckpoint} from './lib/interrupted-home-checkpoint.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {nativeSavedSeeds} from './lib/native-session-home-import.mjs';
import {checkpointActorOrderEntries} from '../web/world/family-order-entries.mjs';
import {parseRealmManifest} from '../web/world/realm-store.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,checkpointActorRecords,
  checkpointAgentValues,checkpointAgentQueues,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function rows(source,iterator,key){const out=new Map();for await(const r of iterator(source)){assert(!out.has(key(r)));out.set(key(r),r);}return out;}
async function bytes(s,r){assert(r&&r.size<=65536);const b=Buffer.alloc(r.size);for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(r.offset+at,Math.min(4096,b.length-at)),at);return b;}
async function exact(a,b,iterator,key){const before=await rows(a,iterator,key),after=await rows(b,iterator,key);assert.equal(before.size,after.size);
  for(const[id,r]of before){assert(after.has(id));assert.deepEqual(await bytes(a,r),await bytes(b,after.get(id)));}return before.size;}
export async function inspectNativeInterruptedHomeRecovery(name){
  const m=await json(name);assert.deepEqual([m.version,m.phase,m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.stopReason,m.nativeInterruptedHomeRecoveryCompleted],
    [1,'interrupted-home-ordinary-recovery',true,false,true,0,null,true]);
  try{process.kill(m.nativePid,0);throw Error('Recovery producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  assert.notEqual(m.nativePid,m.producerNativePid);
  const root=await ownedDirectory(m.fixture,'actor-arrival-fixture-session-recovery-');assert.equal(m.worldRoot,join(root,'native-world-recovery'));assert.equal(m.profile,join(m.worldRoot,'frontier_0_0'));
  assert.equal(await hash(m.buildReport),m.buildReportSha256);const build=await json(m.buildReport);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert(build.finishedAtMs<=m.startedAtMs);
  assert.equal(await hash(build.log),build.logSha256);assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(build.nativeSymbolsSha256,m.nativeSymbolsSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
  assert.deepEqual(m.compiledSourceSha256,{...build.nativeSourceSha256,...build.nativeHeapRuntimeSourceSha256,...build.nativeOrderRuntimeSourceSha256});assert.equal(Object.keys(m.compiledSourceSha256).length,20);
  for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(join(workspace,n)),h);
  assert.equal(await hash('scripts/run-native-interrupted-home-recovery.py'),m.runnerSha256);for(const[n,h]of Object.entries(m.verificationSourceSha256))assert.equal(await hash(join(workspace,n)),h);
  assert.equal(await hash(m.publication),m.publicationSha256);assert.equal(await hash(m.receipt),m.receiptSha256);
  const checked=await inspectInterruptedHomeCheckpoint(m.publication),pub=checked.report;assert.equal(checked.observed.nativeInterruptedHomeOwnershipQualified,true);
  const producer=await json(pub.nativeSessionManifest);assert.equal(producer.nativePid,m.producerNativePid);assert(producer.finishedAtMs<m.startedAtMs);
  const exports=[];for(let side=0;side<2;side++)exports.push(await verifyRevisionExport(m.receipt,side,pub.selectedState.worlds[side].sha256));assert.deepEqual(exports,m.selectedRevisionExports);
  assert(exports.every(r=>r.revision===6));assert.deepEqual(exports[0].owner,pub.selectedOwner);assert.equal(pub.selectedOwner.region,'0_0');
  const prep=await json(pub.sourcePreparation);assert.equal(m.originalSettings,prep.settingsProfile);assert.deepEqual(m.inputHashes,prep.inputHashes);
  for(const[n,h]of Object.entries(m.inputHashes))assert.equal(await hash(join(m.originalSettings,n)),h);
  for(const flag of ['publicationUnchanged','receiptUnchanged','originalWorldsUnchanged','originalSettingsUnchanged'])assert.equal(m[flag],true);
  assert.equal(m.familyFixtureFlagsEnabled,false);assert.equal(m.nativeAgentOrCommandGuardsEnabled,false);
  const content='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256;assert.equal(m.content,content);
  assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP'));assert.equal(m.sourceCopySha256,exports[0].sha256);
  const initial=await stoppedFileSource(exports[0].filename),remote=await stoppedFileSource(exports[1].filename),startClock=await checkpointSavedClock(initial);assert.equal(startClock,57650);
  const parsed=parseRealmManifest(m.initialManifest,content);assert.deepEqual(parsed,{slot:0,size:exports[0].bytes,sha256:exports[0].sha256,manifest:m.initialManifest});
  assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await readFile(m.script,'utf8'),'wait 18000\ndump interrupted_home_recovery_completed\n');
  assert.equal(await hash(m.log),m.logSha256);assert((await stat(m.log)).size<=1024*1024);const log=await readFile(m.log,'utf8');
  assert(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));assert(!/result=fail|abort from|SIGSEGV|Session fallback|Session unavailable|Family |Owner paused|Owner resumed|Session home import/.test(log));
  const seeds=await nativeSavedSeeds(initial);assert(log.includes(`[frontier] Session rng restored region=0_0 gpl=${seeds.gpl} game=${seeds.game} clock=57650`));
  const ready=m.readyCapture;assert(ready);assert.equal(ready.filename,join(root,'Recovered_Home_Ready.GMP'));assert.equal(await hash(ready.filename),ready.sha256);assert.equal((await stat(ready.filename)).size,ready.bytes);
  const readySource=await stoppedFileSource(ready.filename);assert.equal(await checkpointSavedClock(readySource),startClock);assert.equal(ready.clock,startClock);
  assert.deepEqual(parseRealmManifest(ready.manifest,content),{slot:ready.slot,size:ready.bytes,sha256:ready.sha256,manifest:ready.manifest});
  const readyPos=log.indexOf('[frontier] Recovery ready snapshot region=0_0 clock=57650 ordinary-ticks=0 actor-guards=0 saved=1');assert(readyPos>log.indexOf('[frontier] Region 0_0 ready'));
  const loadedUnitsExact=await exact(initial,readySource,checkpointUnitAgentLinks,r=>r.unitId),loadedAgentsExact=await exact(initial,readySource,checkpointAgents,r=>r.agentId),loadedAttachmentsExact=await exact(initial,readySource,checkpointAttachments,r=>`${r.kind}:${r.unitId}`);
  await verifyEntityOwnership(pub.identity,pub.selectedState.aliases,pub.selectedState.referenceBindings,[{source:readySource},{source:remote}],0,pub.selectedState.homeAliases);
  assert.equal((await checkpointActorRecords(readySource,530)).unit.parentUnitId,0);
  const readyUnits=await rows(readySource,checkpointUnitAgentLinks,r=>r.unitId),effectOrders=new Map(),effectLifetime=[];
  assert([530,531,532,533].every(id=>readyUnits.has(id)));
  for(const id of [531,532,533]){const entries=[];for await(const o of checkpointActorOrderEntries(readySource,id))if(o.type==='entry')entries.push(o);
    assert.equal(entries.length,1);assert([5,9].includes(entries[0].kind));assert.equal(entries[0].words[7],0);effectOrders.set(id,entries[0]);}
  assert.equal(m.snapshotCaptures.length,2);assert.equal(m.requestPublications.length,2);let priorClock=startClock,priorPos=readyPos;const ownership=[];
  for(const [i,r]of m.snapshotCaptures.entries()){
    assert.equal(r.serial,i+1);assert.equal(r.filename,join(root,`Session_Saved_${i+1}.GMP`));assert.equal(await hash(r.filename),r.sha256);assert.equal((await stat(r.filename)).size,r.bytes);
    const source=await stoppedFileSource(r.filename);assert.equal(await checkpointSavedClock(source),r.clock);assert(r.clock>priorClock);priorClock=r.clock;
    assert.deepEqual(parseRealmManifest(r.manifest,content),{slot:r.slot,size:r.bytes,sha256:r.sha256,manifest:r.manifest});
    const request=m.requestPublications[i];assert.equal(request.serial,i+1);assert.equal(request.packet,`session-request-v1\n${i+1}\n0_0\n4\n`);assert.equal(request.sha256,sha(request.packet));
    const pos=log.indexOf(`[frontier] Session checkpoint serial=${i+1} region=0_0 clock=${r.clock} direction=4`);assert(pos>priorPos);priorPos=pos;
    const actor=await checkpointActorRecords(source,530);assert.equal(actor.agent.agentId,31);assert.equal(actor.unit.parentUnitId,469);
    let active;for await(const v of checkpointAgentValues(source,31))if(v.attribute==='activescript'&&!v.path.length)active=v;assert(active&&active.functions.some(f=>f.name==='Rest_at_guild'));
    const members=[];for await(const v of checkpointAgentValues(source,7))if(v.attribute==='members'&&v.type===5)members.push(v.targetAgentId);assert.deepEqual(members,[31]);
    const physical=[];for await(const c of checkpointContainerEntries(source))if(c.type==='member'&&((c.unitId===469&&c.targetUnitId===530)||(c.unitId===530&&c.targetUnitId===469)))physical.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
    assert.deepEqual(physical,[[469,100,530,1],[469,2,530,1],[530,101,469,1]]);let queued=0;for await(const q of checkpointAgentQueues(source))if(q.type==='queued-agent'&&q.agentId===31)queued++;assert.equal(queued,1);
    await verifyEntityOwnership(pub.identity,pub.selectedState.aliases,pub.selectedState.referenceBindings,[{source},{source:remote}],0,pub.selectedState.homeAliases);
    const currentUnits=await rows(source,checkpointUnitAgentLinks,r=>r.unitId);for(const id of currentUnits.keys())assert(![504,527,528,529].includes(id));assert(currentUnits.has(530));
    // Effects are temporary gameplay objects. Preserve every one at load, then
    // permit original expiry only after its qualified common dispatch is due.
    for(const id of [531,532,533]){
      const order=effectOrders.get(id),elapsed=(r.clock-order.words[5])>>>0,due=elapsed>=order.words[6],present=currentUnits.has(id);
      if(order.kind===9)assert.equal(present,!due,'Original Wait effect lifetime differs');
      if(present){const u=currentUnits.get(id);assert.equal(u.parentUnitId,530);assert.equal(u.description,readyUnits.get(id).description);assert.equal(u.agentId,0);}
      else{assert(due);for await(const a of checkpointAttachments(source))assert.notEqual(a.unitId,id);
        for await(const c of checkpointContainerEntries(source))if(c.type==='member'){assert.notEqual(c.unitId,id);assert.notEqual(c.targetUnitId,id);}}
      effectLifetime.push({serial:i+1,unitId:id,kind:order.kind,elapsedMs:elapsed,dispatchDelayMs:order.words[6],present});
    }
    for await(const c of checkpointContainerEntries(source))if(c.type==='member'&&c.unitId===530&&c.groupKind===1){
      assert(currentUnits.has(c.targetUnitId));assert.equal(currentUnits.get(c.targetUnitId).parentUnitId,530);}
    ownership.push({serial:i+1,clockMs:r.clock,ownerUnitId:530,ownerAgentId:31,parentUnitId:469,continuation:'Rest_at_guild',soleOwner:true});
  }
  assert(m.resourceSamples.length&&m.resourceSamples.every(r=>r.pid===m.nativePid&&r.rssBytes>0&&r.rssBytes<=m.rssCeilingBytes));
  const sourceSha256={};for(const n of ['scripts/inspect-native-interrupted-home-recovery.mjs','scripts/run-native-interrupted-home-recovery.py','scripts/lib/interrupted-home-checkpoint.mjs','scripts/lib/native-session-home-import.mjs','scripts/export-native-entity-revision.mjs'])sourceSha256[n]=await hash(join(workspace,n));
  return {version:1,nativeInterruptedHomeOrdinaryRecoveryQualified:true,manifest:resolve(name),manifestSha256:await hash(name),nativeExecutableSha256:m.nativeExecutableSha256,
    producerNativePid:m.producerNativePid,recoveryNativePid:m.nativePid,selectedRevision:6,originalAcknowledgementDelivered:false,
    loadedUnitsExact,loadedAgentsExact,loadedAttachmentsExact,recoveredOwnership:ownership,effectLifetime,startClockMs:startClock,
    homeSavedClocksMs:m.snapshotCaptures.map(r=>r.clock),maximumSampledRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),sourceSha256,
    scope:'After an actual native termination following commit and before acknowledgement, a separate native process loads the durable revision6 home with no import/actor/command guards. Complete saved records match before first tick and ordinary AI enters the guild in two subsequent saves. Other interruption stages, seamless travel, browser/WAN/co-op regional recovery and sustained total resources remain unqualified.',
    browserUsed:false,seamlessHeroCrossingQualified:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);const r=await inspectNativeInterruptedHomeRecovery(name);
  await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({nativeInterruptedHomeOrdinaryRecoveryQualified:true,
    loadedUnitsExact:r.loadedUnitsExact,loadedAgentsExact:r.loadedAgentsExact,loadedAttachmentsExact:r.loadedAttachmentsExact,homeClocks:r.homeSavedClocksMs,browserUsed:false}));
}
