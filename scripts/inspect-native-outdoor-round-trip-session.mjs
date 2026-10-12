#!/usr/bin/env node
// Verify a fresh ordinary load of the actual selected final home, without guards.
import assert from 'node:assert/strict';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {guardedHandoffHash} from './lib/guarded-outdoor-handoff.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
import {checkpointActorRecords,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {parseRealmManifest} from '../web/world/realm-store.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
export async function inspectNativeOutdoorRoundTripSession(name){
  const m=await json(name);assert.deepEqual([m.phase,m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.stopReason,m.nativeSelectedRoundTripSessionCompleted],
    ['selected-outdoor-round-trip-session',true,false,true,0,null,true]);
  try{process.kill(m.nativePid,0);throw Error('Native producer still running');}catch(e){if(e.code!=='ESRCH')throw e;}
  const fixture=await ownedDirectory(m.fixture,'actor-arrival-fixture-session-round-trip-');
  assert.equal(m.worldRoot,join(fixture,'native-world-round-trip'));assert.equal(m.profile,join(m.worldRoot,'frontier_0_0'));
  const build=await json(m.buildReport);assert.equal(await guardedHandoffHash(m.buildReport),m.buildReportSha256);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert(build.finishedAtMs<=m.startedAtMs);
  assert.equal(await guardedHandoffHash(build.log),build.logSha256);
  const sources={...build.nativeSourceSha256,...build.nativeHeapRuntimeSourceSha256,...build.nativeOrderRuntimeSourceSha256};
  assert.deepEqual(m.compiledSourceSha256,sources);assert.equal(Object.keys(sources).length,20);
  for(const[n,h]of Object.entries(sources))assert.equal(await guardedHandoffHash(join(workspace,n)),h);
  assert.equal(await guardedHandoffHash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  assert.equal(m.nativeExecutableSha256,build.nativeExecutableSha256);
  assert.equal(await guardedHandoffHash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
  assert.equal(m.nativeSymbolsSha256,build.nativeSymbolsSha256);
  assert.equal(await guardedHandoffHash('scripts/run-native-outdoor-round-trip-session.py'),m.runnerSha256);
  assert.equal(m.familyFixtureFlagsEnabled,false);assert.equal(m.nativeAgentOrCommandGuardsEnabled,false);
  assert.equal(await guardedHandoffHash(m.publication),m.publicationSha256);assert.equal(await guardedHandoffHash(m.receipt),m.receiptSha256);
  const publication=await json(m.publication),receipt=await json(m.receipt);
  assert.equal(publication.actualGuardedOutdoorRoundTripPublished,true);assert.equal(publication.guardedHomeRequestPending,false);
  assert.equal(receipt.revisionReport,m.publication);assert.equal(receipt.revisionReportSha256,m.publicationSha256);
  const exports=[];for(let i=0;i<2;i++)exports.push(await verifyRevisionExport(m.receipt,i,receipt.worlds[i].sha256));
  assert.deepEqual(exports,m.selectedRevisionExports);assert(exports.every(e=>e.revision===7));
  const initial=await connectedWorldState(exports[0].filename);assert.equal(initial.clock,58650);
  const expectedContent='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256;
  assert.equal(m.content,expectedContent);assert.deepEqual(parseRealmManifest(m.initialManifest,m.content),{
    slot:0,size:exports[0].bytes,sha256:exports[0].sha256,manifest:m.initialManifest});
  assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP'));
  assert.equal(m.sourceCopySha256,exports[0].sha256);
  assert.equal(m.script,join(fixture,'session.script'));assert.equal(await guardedHandoffHash(m.script),m.scriptSha256);
  assert.equal(await readFile(m.script,'utf8'),'wait 25000\ndump round_trip_session_completed\n');
  for(const k of ['publicationUnchanged','receiptUnchanged','originalWorldsUnchanged','originalSettingsUnchanged'])assert.equal(m[k],true);
  for(const[n,h]of Object.entries(m.inputHashes)){
    assert.equal(await guardedHandoffHash(join(m.originalSettings,n)),h);assert.equal(await guardedHandoffHash(join(m.profile,n)),h);}
  assert.equal(await guardedHandoffHash(m.log),m.logSha256);assert((await stat(m.log)).size<=1024*1024);
  const log=await readFile(m.log,'utf8');assert(log.includes('all expectations met')&&log.includes('guest exit code:    0')&&log.includes('undeliverable calls: none'));
  assert(!/result=fail|SIGSEGV|abort from|Session unavailable|Session fallback|Session checkpoint failed|Family (route|return|snapshot)/i.test(log));
  assert(log.includes('[frontier] Session enabled version=v1 region=0_0 root='+m.worldRoot+' release=v2'));
  assert(log.includes(`[frontier] Session rng restored region=0_0 gpl=${initial.rng} game=${initial.gameplayRng} clock=58650`));
  assert.equal(log.split('\n').filter(l=>l==='[frontier] Region 0_0 ready').length,1);
  assert(!/Session quit|Session unloaded|Session attached|Session released/.test(log));
  const saves=[...log.matchAll(/^\[frontier\] Session checkpoint serial=(\d+) region=0_0 clock=(\d+) direction=4$/gm)];
  assert.equal(saves.length,2);assert.equal(m.snapshotCaptures.length,2);assert.equal(m.requestPublications.length,2);
  const dormant=await stoppedFileSource(exports[1].filename),observations=[];let previousClock=initial.clock;
  for(let i=0;i<2;i++){
    const r=m.snapshotCaptures[i],q=m.requestPublications[i],serial=i+1;
    assert.equal(r.serial,serial);assert.equal(r.filename,join(fixture,`Session_Saved_${serial}.GMP`));
    assert.equal(await guardedHandoffHash(r.filename),r.sha256);assert.equal((await stat(r.filename)).size,r.bytes);
    assert.equal(q.serial,serial);assert.equal(q.packet,`session-request-v1\n${serial}\n0_0\n4\n`);assert.equal(q.sha256,sha(q.packet));
    assert.deepEqual(saves[i].slice(1).map(Number),[serial,r.clock]);
    assert.deepEqual(parseRealmManifest(r.manifest,m.content),{slot:r.slot,size:r.bytes,sha256:r.sha256,manifest:r.manifest});
    assert.equal(r.slot,serial%2);const state=await connectedWorldState(r.filename);assert.equal(state.clock,r.clock);assert(state.clock>previousClock);previousClock=state.clock;
    assert.equal(state.rawTerrainSha256,initial.rawTerrainSha256);
    const source=await stoppedFileSource(r.filename),identity=receipt.identity,selected=receipt.state;
    await verifyEntityOwnership(identity,selected.aliases,selected.referenceBindings,[{source},{source:dormant}],0,selected.homeAliases);
    const hero=await checkpointActorRecords(source,530);assert(hero.unit&&hero.agent);assert.equal(hero.agent.agentId,31);
    let active;for await(const v of checkpointAgentValues(source,31))if(v.attribute==='activescript'&&!v.path.length)active=v;
    assert(active?.functions.length);observations.push({serial,clockMs:state.clock,elapsedSinceInputMs:state.clock-initial.clock,heroId:530,agentId:31,
      parentUnitId:hero.unit.parentUnitId,activeFunctions:active.functions.map(f=>f.name),world:r,ownershipValidated:true});
  }
  assert.equal(await readFile(join(m.profile,'Frontier_0_0.checkpoint'),'utf8'),m.snapshotCaptures[1].manifest);
  const latest=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP');assert.equal(await guardedHandoffHash(latest),m.snapshotCaptures[1].sha256);
  assert(m.resourceSamples.length&&m.resourceSamples.every(s=>s.pid===m.nativePid&&s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes));
  return {version:1,nativeSelectedFinalHomeOrdinaryContinuationQualified:true,
    scope:'Actual current revision7 export loads through the ordinary original named-world session with no family fixture or AI/command guard. Both original clocks/RNGs restore and two evolving saves preserve the registered sole home owner, real guild membership and scheduling. This qualifies stopped-selection native loading and short ordinary continuation, not a live cross-region transaction, a browser launch, or sustained resource bounds.',
    manifest:resolve(name),manifestSha256:await guardedHandoffHash(name),nativeExecutableSha256:m.nativeExecutableSha256,
    inputRevision:7,owner:receipt.owner,startClockMs:initial.clock,endClockMs:previousClock,observations,
    maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),
    sourceSha256:{'scripts/inspect-native-outdoor-round-trip-session.mjs':await guardedHandoffHash('scripts/inspect-native-outdoor-round-trip-session.mjs'),
      'scripts/export-native-entity-revision.mjs':await guardedHandoffHash('scripts/export-native-entity-revision.mjs')},
    nativeEngineOwnershipTransactionQualified:false,selectedOwnerRevisionPublished:false,seamlessHeroCrossingQualified:false,sustainedMemoryBoundsQualified:false,browserUsed:false};
}
if(resolve(process.argv[1]||'')===resolve(new URL(import.meta.url).pathname)){
  const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);const r=await inspectNativeOutdoorRoundTripSession(name);
  await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({nativeSelectedFinalHomeOrdinaryContinuationQualified:true,inputRevision:r.inputRevision,
    startClockMs:r.startClockMs,endClockMs:r.endClockMs,saves:r.observations.length,browserUsed:false}));
}
