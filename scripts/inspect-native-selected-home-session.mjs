#!/usr/bin/env node
// Check one original native session from selected remote restoration through
// retirement, latest source save, disposal, home restoration and guild entry.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {readSelectedRemoteHomeTask} from '../web/world/remote-home-task.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,
  checkpointAgentQueues,checkpointContainerEntries,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {verifyNativeSessionHomeImport,nativeSavedSeeds} from './lib/native-session-home-import.mjs';
import {verifyNativePausedHomeOwner} from './lib/native-paused-home-owner.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function rows(s,iterator,key){const out=new Map();for await(const r of iterator(s)){assert(!out.has(key(r)));out.set(key(r),r);}return out;}
async function bytes(s,r){assert(r&&r.size<=65536);const b=Buffer.alloc(r.size);for(let at=0;at<r.size;at+=4096)b.set(await s.readAt(r.offset+at,Math.min(4096,r.size-at)),at);return b;}
async function exact(a,b,iterator,key,omit=new Set(),sameCount=false){const before=await rows(a,iterator,key),after=await rows(b,iterator,key);if(sameCount)assert.equal(before.size,after.size);
  let n=0;for(const[id,r]of before)if(!omit.has(id)){assert(after.has(id));assert.deepEqual(await bytes(a,r),await bytes(b,after.get(id)));n++;}return n;}
async function frozenArchive(name,prefix){const a=await json(name),dir=await ownedDirectory(a.directory,prefix);assert.equal(a.artifactPreserved,true);
  assert.equal(Object.keys(a.sourceHashes).length,20);for(const[n,h]of Object.entries(a.sourceHashes)){assert.equal(a.sources[n].filename,join(dir,basename(n)));assert.equal(await hash(a.sources[n].filename),h);}
  assert.equal(a.nativeExecutable.filename,join(dir,'pop_smoke'));assert.equal(await hash(a.nativeExecutable.filename),a.nativeExecutable.sha256);return a;}
async function frozen(a,name,sha){const r=a.evidence[resolve(name)];assert(r);if(sha)assert.equal(r.sha256,sha);assert.equal(await hash(name),r.sha256);assert.equal(await hash(r.filename),r.sha256);}
export async function inspectNativeSelectedHomeSession(name,{interruptedBeforeResume=false}={}){
  assert.equal(typeof interruptedBeforeResume,"boolean");
  const m=await json(name);assert.deepEqual([m.version,m.phase,m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.stopReason,m.selectedHomeSessionCompleted],
    [1,'selected-home-native-session',true,false,true,interruptedBeforeResume?-15:0,interruptedBeforeResume?'intentional-interruption-after-owner-commit':null,!interruptedBeforeResume]);
  if(interruptedBeforeResume){assert.equal(m.intentionalOwnerInterruption,true);assert(m.liveOwner&&m.liveImport);}
  try{process.kill(m.nativePid,0);throw Error('Home session producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const fixture=await ownedDirectory(m.fixture,'actor-arrival-fixture-session-home-');
  assert.equal(m.worldRoot,join(fixture,'actor-arrival-fixture-outdoor-family-snapshot-bridge/native-world-home'));
  for(const region of ['1_0','0_0'])assert.equal(m.profiles[region],join(m.worldRoot,'frontier_'+region));
  const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert(build.finishedAtMs<=m.startedAtMs);
  assert.equal(await hash(build.log),build.logSha256);assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
  assert.deepEqual(m.compiledSourceSha256,{...build.nativeSourceSha256,...build.nativeHeapRuntimeSourceSha256,...build.nativeOrderRuntimeSourceSha256});
  assert.equal(Object.keys(m.compiledSourceSha256).length,20);for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(join(workspace,n)),h);
  assert.equal(await hash('scripts/run-native-selected-home-session.py'),m.runnerSha256);for(const[n,h]of Object.entries(m.controllerDependencies))assert.equal(await hash(join(workspace,n)),h);
  assert.equal(await hash(m.preparation),m.preparationSha256);const prep=await json(m.preparation);assert.equal(prep.selectedRemoteHomePreparation,true);
  for(const[n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(join(workspace,n)),h);
  assert.equal(await hash(prep.publication),prep.publicationSha256);const pub=await json(prep.publication);
  const selectedStore=await openEntityRevisionStore(await stoppedRevisionStorage(pub.fixture),prep.identity.contentDigest);
  const route=await readSelectedRemoteHomeTask(selectedStore,{expectedManifest:prep.selectedManifest});assert.deepEqual(route,prep.route);assert.deepEqual(pub.identity,prep.identity);
  assert.deepEqual(pub.selectedState,prep.selectedState);assert.equal(pub.selectedManifest,prep.selectedManifest);
  assert.equal(await hash(m.receivingArchive),m.receivingArchiveSha256);const receiving=await frozenArchive(m.receivingArchive,'actor-arrival-fixture-outdoor-family-reload-generation-');
  assert.deepEqual(receiving.sourceHashes,prep.compiledProducerSources);assert.equal(receiving.nativeExecutable.sha256,prep.compiledProducerExecutableSha256);
  assert.equal(await hash(m.homeArchive),m.homeArchiveSha256);const archive=await frozenArchive(m.homeArchive,'actor-arrival-fixture-outdoor-family-return-generation-');
  assert.equal(await hash(m.homeProof),m.homeProofSha256);await frozen(archive,m.homeProof);const home=await json(m.homeProof);
  assert.equal(home.actualOutdoorFamilyHomeRestorationQualified,true);assert.equal(home.ordinaryGuildEntryQualified,true);assert.equal(home.nativeExecutableSha256,archive.nativeExecutable.sha256);
  for(const n of [home.manifest,home.reloadManifest])await frozen(archive,n);for(const[n,h]of Object.entries(home.sourceSha256))await frozen(archive,join(workspace,n),h);
  const homeReady=home.worlds.Ready;await frozen(archive,homeReady.filename,homeReady.sha256);assert.equal(home.worlds.Departed.sha256,prep.worlds[0].sha256);
  for(const r of [...prep.worlds,...prep.records]){assert.equal(await hash(r.filename),r.sha256);assert.equal((await stat(r.filename)).size,r.bytes);}
  assert.equal(m.inputs.length,2);for(const[region,r]of [['1_0',prep.worlds[1]],['0_0',m.liveImport?prep.worlds[0]:homeReady]]){
    const input=m.inputs.find(i=>i.region===region);assert.equal(input.source,r.filename);assert.equal(input.sourceSha256,r.sha256);
    const marker=input.initialManifest.split('\n');assert.deepEqual(marker,['checkpoint-v1','0',String(r.bytes),r.sha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,'']);
  }
  for(const flag of ['originalInputsUnchanged','originalSettingsUnchanged','originalProposalsUnchanged'])assert.equal(m[flag],true);
  for(const[n,h]of Object.entries(prep.inputHashes))assert.equal(await hash(join(prep.settingsProfile,n)),h);
  assert.equal(m.proposals.length,2);for(const r of m.proposals){assert.equal(r.filename,join(m.profiles['1_0'],basename(r.filename)));assert.equal(await hash(r.filename),r.sha256);}
  assert.equal(await hash(m.reloadIdentity.filename),m.reloadIdentity.sha256);const id=await readFile(m.reloadIdentity.filename),hero=route.owner.unitId,agent=route.owner.agentId,ids=[hero,hero+1,hero+2,hero+3];
  assert.equal(id.length,48);assert.deepEqual(Array.from({length:12},(_,i)=>id.readUInt32LE(i*4)),[0x314c4d46,2,25300,...ids,agent,45,24250,0,0]);
  assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await readFile(m.script,'utf8'),'wait 30000\ndump selected_home_session_completed\n');
  assert.equal(await hash(m.log),m.logSha256);assert((await stat(m.log)).size<=1024*1024);const log=await readFile(m.log,'utf8');
  if(!interruptedBeforeResume)assert(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));assert(!/result=fail|abort from|SIGSEGV|Session fallback|Session unavailable|destination refused|Family return ready/.test(log));if(!m.liveImport)assert(!/Family unit stage/.test(log));
  const at=[];function ordered(text){const pos=log.indexOf(text);assert(pos>=0,text);assert(!at.length||pos>at.at(-1));at.push(pos);}
  ordered('[streaming] Family reload clocks version=2 saved=25300 pause-anchor=24250 held-age=1050 result=pass');
  ordered('[streaming] Family route held clock=26350 elapsed=1000');ordered('[streaming] Family route cleanup requests=0 original-removal=1 aliases-absent=1 registry-preserved=1 proxy-preserved=1 queues-preserved=1 hooks-removed=1 owner-published=0 result=pass');
  assert.equal(m.snapshotCaptures.length,interruptedBeforeResume?1:3);assert.equal(m.requestPublications.length,interruptedBeforeResume?1:3);
  const captures=m.snapshotCaptures;assert.deepEqual(captures.map(r=>[r.serial,r.region,r.direction]),[[1,'1_0',0],[2,'0_0',4],[3,'0_0',4]].slice(0,interruptedBeforeResume?1:3));
  const sources=[];for(const r of captures){assert.equal(r.filename,join(fixture,`Session_Saved_${r.serial}_${r.region}.GMP`));assert.equal(await hash(r.filename),r.sha256);assert.equal((await stat(r.filename)).size,r.bytes);
    assert.equal(r.manifest.split('\n')[3],r.sha256);const source=await stoppedFileSource(r.filename);assert.equal(await checkpointSavedClock(source),r.clock);sources.push(source);}
  assert(captures[0].clock>=26350&&captures[0].clock-26350<=2000);if(!interruptedBeforeResume)assert(captures[1].clock>57650&&captures[2].clock>captures[1].clock);
  for(const[r,index]of m.requestPublications.map((r,i)=>[r,i])){const region=index?'0_0':'1_0',direction=index?4:0;
    assert.equal(r.packet,`session-request-v1\n${index+1}\n${region}\n${direction}\n`);assert.equal(r.serial,index+1);assert.equal(r.region,region);assert.equal(r.direction,direction);}
  ordered(`[frontier] Session checkpoint serial=1 region=1_0 clock=${captures[0].clock} direction=0`);
  ordered(`[frontier] Session quit serial=1 region=1_0 saved-clock=${captures[0].clock} clock=0 loading=0`);
  ordered('[frontier] Session released serial=1 region=1_0 roots-freed=1,1,1,1,1,1,1,1 terrain-bytes=530456 spatial-bytes=524288');
  ordered(`[frontier] Session unloaded serial=1 source=1_0 target=0_0 world-null=1 profile=${m.profiles['0_0']}`);
  ordered('[frontier] Session release observer removed serial=1 hooks=1 retained-roots=0');ordered('[frontier] Session attached serial=1 region=0_0 mode=saved phase=1 pending=2');
  const homeSeeds=await nativeSavedSeeds(await stoppedFileSource((m.liveImport?prep.worlds[0]:homeReady).filename));
  ordered(`[frontier] Session rng restored region=0_0 gpl=${homeSeeds.gpl} game=${homeSeeds.game} clock=57650`);ordered('[frontier] Region 0_0 ready');
  for(const r of captures.slice(1))ordered(`[frontier] Session checkpoint serial=${r.serial} region=0_0 clock=${r.clock} direction=4`);
  assert.equal(m.familySaves.length,3);const family={};for(const r of m.familySaves){const phase=basename(r.filename).match(/^Family_Remote_(Ready|Held|Departed)\.GMP$/)?.[1];assert(phase&&!family[phase]);assert.equal(await hash(r.filename),r.sha256);family[phase]=await stoppedFileSource(r.filename);}
  const initial=await stoppedFileSource(prep.worlds[1].filename),unitKey=r=>r.unitId,agentKey=r=>r.agentId,attachmentKey=r=>`${r.kind}:${r.unitId}`;
  assert.equal(await checkpointSavedClock(family.Ready),25300);assert.equal(await checkpointSavedClock(family.Held),26350);assert.equal(await checkpointSavedClock(family.Departed),26350);
  const readyUnitsExact=await exact(initial,family.Ready,checkpointUnitAgentLinks,unitKey,new Set(),true);
  const readyAgentsExact=await exact(initial,family.Ready,checkpointAgents,agentKey,new Set(),true);
  const readyAttachmentsExact=await exact(initial,family.Ready,checkpointAttachments,attachmentKey,new Set(),true);
  const ru=await rows(family.Ready,checkpointUnitAgentLinks,unitKey),hu=await rows(family.Held,checkpointUnitAgentLinks,unitKey),ra=await rows(family.Ready,checkpointAgents,agentKey),ha=await rows(family.Held,checkpointAgents,agentKey);
  const rt=await rows(family.Ready,checkpointAttachments,attachmentKey),ht=await rows(family.Held,checkpointAttachments,attachmentKey);let familyRecordsExact=0;
  for(const u of ids){assert.deepEqual(await bytes(family.Ready,ru.get(u)),await bytes(family.Held,hu.get(u)));familyRecordsExact++;}
  for(const a of [agent,45]){assert.deepEqual(await bytes(family.Ready,ra.get(a)),await bytes(family.Held,ha.get(a)));familyRecordsExact++;}
  for(const t of [...ids.map(u=>`ORDR:${u}`),`CONT:${hero}`]){assert.deepEqual(await bytes(family.Ready,rt.get(t)),await bytes(family.Held,ht.get(t)));familyRecordsExact++;}assert.equal(familyRecordsExact,11);
  const otherRetiredUnitsExact=await exact(family.Held,family.Departed,checkpointUnitAgentLinks,unitKey,new Set(ids));
  const otherRetiredAgentsExact=await exact(family.Held,family.Departed,checkpointAgents,agentKey,new Set([agent]));
  const departedUnits=await rows(family.Departed,checkpointUnitAgentLinks,unitKey),departedAgents=await rows(family.Departed,checkpointAgents,agentKey);
  const latestUnits=await rows(sources[0],checkpointUnitAgentLinks,unitKey),latestAgents=await rows(sources[0],checkpointAgents,agentKey);
  for(const u of ids){assert(!departedUnits.has(u));assert(!latestUnits.has(u));}assert(!departedAgents.has(agent));assert(!latestAgents.has(agent));
  for await(const q of checkpointAgentQueues(sources[0]))if(q.type==='queued-agent')assert.notEqual(q.agentId,agent);
  for await(const c of checkpointContainerEntries(sources[0]))if(c.type==='member'){assert(!ids.includes(c.unitId));assert(!ids.includes(c.targetUnitId));}
  const fresh={unitId:home.heroId,agentId:home.agentId},aliases=[fresh,prep.selectedState.aliases[1]],ownership=[];
  assert.deepEqual(fresh,{unitId:530,agentId:31});assert.equal((await checkpointActorRecords(await stoppedFileSource(homeReady.filename),fresh.unitId)).unit.parentUnitId,0);
  for(const [i,source]of sources.entries())if(i){
    const actor=await checkpointActorRecords(source,fresh.unitId);assert.equal(actor.unit.parentUnitId,469);assert.equal(actor.agent.agentId,31);
    let context;const members=[];for await(const v of checkpointAgentValues(source,31))if(!v.path.length&&v.attribute==='activescript')context=v;
    assert(context.functions.some(f=>f.name==='Rest_at_guild'));for await(const v of checkpointAgentValues(source,7))if(v.attribute==='members'&&v.type===5)members.push(v.targetAgentId);assert.deepEqual(members,[31]);
    const physical=[];for await(const c of checkpointContainerEntries(source))if(c.type==='member'&&((c.unitId===469&&c.targetUnitId===530)||(c.unitId===530&&c.targetUnitId===469)))physical.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
    assert.deepEqual(physical,[[469,100,530,1],[469,2,530,1],[530,101,469,1]]);
    await verifyEntityOwnership(prep.identity,aliases,prep.selectedState.referenceBindings,[{source},{source:sources[0]}],0,prep.selectedState.homeAliases);
    ownership.push({serial:captures[i].serial,clockMs:captures[i].clock,ownerUnitId:530,ownerAgentId:31,parentUnitId:469,continuation:'Rest_at_guild',soleOwner:true});
  }
  assert(m.resourceSamples.length&&m.resourceSamples.every(r=>r.pid===m.nativePid&&r.rssBytes>0&&r.rssBytes<=m.rssCeilingBytes));
  const liveOwner=m.liveOwner?await verifyNativePausedHomeOwner(m,prep,log,{interruptedBeforeResume}):null;
  const liveImport=m.liveImport?await verifyNativeSessionHomeImport(m,prep,log,{interruptedBeforeResume}):null;
  const sourceSha256={};for(const n of ['scripts/inspect-native-selected-home-session.mjs','scripts/run-native-selected-home-session.py','scripts/lib/native-paused-home-owner.mjs','scripts/lib/native-session-home-import.mjs','scripts/prepare-native-session-home-import.mjs','web/world/entity-ownership.mjs','web/world/remote-home-task.mjs'])sourceSha256[n]=await hash(join(workspace,n));
  return {version:1,nativeSelectedHomeSessionQualified:!interruptedBeforeResume,nativeInterruptedHomeOwnershipQualified:interruptedBeforeResume,manifest:resolve(name),manifestSha256:await hash(name),nativeExecutableSha256:m.nativeExecutableSha256,
    ...(liveOwner?{liveOwner}:{}),...(liveImport?{liveImport}:{}),compiledSourceSha256:m.compiledSourceSha256,route,sourceClockMs:25300,pauseAnchorClockMs:24250,retiredClockMs:26350,
    receivingSavedClockMs:captures[0].clock,homeStartClockMs:57650,homeSavedClocksMs:captures.slice(1).map(r=>r.clock),
    worldCaptures:captures,homeOwnership:ownership,freshOwner:fresh,readyUnitsExact,readyAgentsExact,readyAttachmentsExact,familyRecordsExact,
    otherRetiredUnitsExact,otherRetiredAgentsExact,trackedWorldRootsFreed:8,maximumSampledRssBytes:Math.max(...m.resourceSamples.map(r=>r.rssBytes)),sourceSha256,
    scope:interruptedBeforeResume?'The fresh-import native engine was intentionally terminated after durable ownership revision6 committed and before its acknowledgement was delivered. This qualifies the committed sole-owner checkpoint; subsequent native recovery is separate.':liveImport?'One native process restores the selected retired home world, imports the current session held family through original readers, saves and fully reloads its new home preparation before any original gameplay tick, commits its paused ownership pair, then resumes ordinary guild entry. This does not qualify seamless spatial travel or browser activation.':'One current native process reloads the exact selected remote save, guards/retire its family, saves the later receiving world, disposes it through original session cleanup, restores an archived fully prepared home world and ordinarily enters its registered guild. Two evolving home saves contain the sole returned owner. The archived home import is reused; fresh live actor import remains unqualified. An optional separately checked paused publication receipt qualifies the native tick/commit/resume boundary only.',
    selectedOwnerRevisionPublished:Boolean(liveOwner),nativeEngineOwnershipTransactionQualified:false,freshHomeActorImportQualified:Boolean(liveImport),
    activeRemoteContinuationQualified:false,seamlessHeroCrossingQualified:false,browserUsed:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);const r=await inspectNativeSelectedHomeSession(name);
  await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({nativeSelectedHomeSessionQualified:true,
    receivingSavedClockMs:r.receivingSavedClockMs,homeSavedClocksMs:r.homeSavedClocksMs,homeOwner:r.freshOwner,trackedWorldRootsFreed:8,browserUsed:false}));
}
