#!/usr/bin/env node
// Stopped inspection of actual original source retirement/restoration/guild entry.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAgentValues,checkpointAgentQueues,
  checkpointAttachments,checkpointActorRecords,checkpointContainerEntries,checkpointAgentRecord} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
const mem=b=>({size:b.length,async readAt(at,n){assert(n<=4096&&at+n<=b.length);return Uint8Array.from(b.subarray(at,at+n));}});
async function rows(source,iterator,key){const out=new Map();for await(const r of iterator(source)){assert(!out.has(key(r)));out.set(key(r),r);}return out;}
async function bytes(source,r){assert(r.size<=65536);const b=Buffer.alloc(r.size);for(let at=0;at<r.size;at+=4096)b.set(await source.readAt(r.offset+at,Math.min(4096,r.size-at)),at);return b;}
async function exactOthers(a,b,iterator,key,omit){
  const before=await rows(a,iterator,key),after=await rows(b,iterator,key);let compared=0;
  for(const [id,r]of before){if(omit.has(id))continue;assert(after.has(id));assert.deepEqual(await bytes(a,r),await bytes(b,after.get(id)));compared++;}
  return compared;
}
export async function inspectNativeOutdoorFamilyReturn(name,reloadName){
  const m=await json(name);
  assert.deepEqual([m.nativeOnly,m.browserUsed,m.homeReturnFixture,m.phase,m.nativeSessionTerminal,m.nativeExitCode,m.outdoorFamilyTrialCompleted,m.stopReason],
    [true,false,true,'home-return-preparation',true,0,true,null]);
  try{process.kill(m.nativePid,0);throw Error('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const live=await json(reloadName);assert.deepEqual([live.nativeOnly,live.browserUsed,live.homeReturnFixture,live.phase,live.nativeSessionTerminal,live.nativeExitCode,live.outdoorFamilyTrialCompleted,live.stopReason],[true,false,true,'home-return-reload',true,0,true,null]);
  try{process.kill(live.nativePid,0);throw Error('Reload producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  assert.equal(live.previousManifest,resolve(name));assert.equal(await hash(name),live.previousManifestSha256);
  const fixture=await ownedDirectory(m.fixture,'actor-arrival-fixture-outdoor-family-return-');
  assert.equal(m.worldRoot,fixture);assert.equal(m.profile,join(fixture,'frontier_0_0'));
  assert.equal(await hash(m.buildReport),m.buildReportSha256);const build=await json(m.buildReport);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert(build.finishedAtMs<=m.startedAtMs);
  assert.equal(await hash(build.log),build.logSha256);let sourceCount=0;
  for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256']){
    assert.deepEqual(m[group],build[group]);for(const[n,h]of Object.entries(m[group])){assert.equal(await hash(join(workspace,n)),h);sourceCount++;}
  }
  assert.equal(sourceCount,20);assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  assert.equal(m.nativeExecutableSha256,build.nativeExecutableSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
  assert.equal(await hash('scripts/run-native-outdoor-family-return.py'),m.runnerSha256);
  assert.equal(live.runnerSha256,m.runnerSha256);assert.equal(live.nativeExecutableSha256,m.nativeExecutableSha256);
  assert.equal(live.buildReportSha256,m.buildReportSha256);assert.equal(live.preparationSha256,m.preparationSha256);
  for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256'])assert.deepEqual(live[group],m[group]);
  const liveFixture=await ownedDirectory(live.fixture,'actor-arrival-fixture-outdoor-family-return-');assert.equal(live.profile,join(liveFixture,'frontier_0_0'));
  assert.equal(live.worldRoot,liveFixture);assert.equal(await hash(live.script),live.scriptSha256);assert.equal(await readFile(live.script,'utf8'),await readFile(m.script,'utf8'));
  for(const r of live.proposals){assert.equal(r.copied,join(live.profile,basename(r.source)));assert.equal(await hash(r.source),r.sha256);assert.equal(await hash(r.copied),r.sha256);}
  assert.equal(live.proposals.length,13);assert.equal(live.records.length,14);
  for(const r of live.records){assert.equal(r.filename,join(live.profile,basename(r.filename)));const f=await hashNativeFile(r.filename);assert.equal(f.sha256,r.sha256);assert.equal(f.bytes,r.bytes);}
  assert.equal(await hash(m.preparation),m.preparationSha256);const prep=await json(m.preparation);
  assert.equal(prep.homeReturnPreparationQualified,true);assert.deepEqual([prep.sourceClockMs,prep.destinationClockMs,prep.scriptClockAnchorMs],[24250,57650,57650]);
  for(const[n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(n),h);
  for(const key of ['sourceProof','pairPublication','effectClockProof','homeRouteProof','homeRouteArchive','preparation'])assert.equal(await hash(prep[key]),prep[`${key}Sha256`]);
  const route=await json(prep.homeRouteProof),archive=await json(prep.homeRouteArchive);
  assert.equal(route.ordinaryAiHomeHoldQualified,true);assert.equal(route.ordinaryCommandHomeHoldQualified,true);
  assert.equal(archive.artifactPreserved,true);assert.equal(archive.nativeExecutable.sha256,route.nativeExecutableSha256);
  assert.equal(archive.evidence[prep.homeRouteProof].sha256,prep.homeRouteProofSha256);
  assert.equal(await hash(archive.evidence[prep.homeRouteProof].filename),prep.homeRouteProofSha256);
  assert.deepEqual(prep.request,route.homeRequest);assert.equal(prep.request.ownerPublished,false);
  assert.equal(prep.request.pauseAnchorClockMs,24250);assert.equal(prep.request.homeRegion,'0_0');
  assert.equal(m.source,prep.source.filename);assert.equal(await hash(m.source),prep.source.sha256);assert.equal(await hash(m.sourceCopy),prep.source.sha256);
  for(const flag of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged','proposalsUnchanged','donorUnchanged'])assert.equal(m[flag],true);
  assert.equal(m.proposals.length,13);for(const r of prep.records){
    const p=m.proposals.find(p=>p.source===r.filename);assert(p);assert.equal(p.copied,join(m.profile,basename(r.filename)));
    assert.equal(p.sha256,r.sha256);assert.equal(p.bytes,r.bytes);assert.equal(await hash(p.source),p.sha256);assert.equal(await hash(p.copied),p.sha256);
  }
  for(const[n,h]of Object.entries(prep.inputHashes)){assert.equal(await hash(join(prep.settingsProfile,n)),h);assert.equal(await hash(join(m.profile,n)),h);}
  assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await readFile(m.script,'utf8'),'wait 20000\ndump outdoor_family_completed\n');
  assert.equal(await hash(m.log),m.logSha256);assert((await stat(m.log)).size<=1024*1024);
  assert.equal(await hash(live.log),live.logSha256);assert((await stat(live.log)).size<=1024*1024);
  const liveLog=await readFile(live.log,'utf8');assert(liveLog.includes('all expectations met')&&liveLog.includes('undeliverable calls: none'));assert(!/result=fail|abort from|SIGSEGV/.test(liveLog));
  const log=await readFile(m.log,'utf8');assert(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));
  assert(!/result=fail|abort from|SIGSEGV/.test(log));
  assert(log.includes('[streaming] Family return source-retired hero=504 effects=527,528,529 agent=28 guild=469/7 clock=57650 aliases-absent=1 roster-empty=1 other-registry-preserved=1 other-queues-preserved=1 original-removal=1 saved=1 result=pass'));
  const restored=log.match(/^\[streaming\] Family return restored hero=(\d+) effects=(\d+),(\d+),(\d+) agent=(\d+) clock=57650 exact=1 internal-links=3 home=469\/7 source-retired=1 owner-published=0 result=pass$/m);
  assert(restored);const ids=restored.slice(1,5).map(Number),agentId=Number(restored[5]),heroId=ids[0];
  assert(ids.every((id,i)=>id===heroId+i&&id>529));assert(agentId>28);
  assert(log.includes(`[streaming] Family return prepared hero=${heroId} agent=${agentId} guild=469/7 clock=57650 finalized=4 physical=0 drawing=1 native-roster=1 script-roster=1 queued=1 full-load-required=1 ordinary-updates=0 saved=1 owner-published=0 result=pass`));
  assert(log.includes('[streaming] Family return prepared-cleanup requests=42 original-removal=1 aliases-absent=1 roster-empty=1 other-queues-preserved=1 hooks-preserved=1 saved-ready-retained=1 result=pass'));
  assert(liveLog.includes(`[streaming] Family return ready hero=${heroId} agent=${agentId} guild=469/7 clock=57650 finalized=4 physical=4 drawing=1 native-roster=1 script-roster=1 queued=1 guards=0 ordinary-only=1 saved=1 owner-published=0 result=pass`));
  assert.equal(liveLog.split('\n').filter(l=>l==='[streaming] Queue entry lookup target=469 original-guild=1 original-delegated=1').length,1);
  const entered=liveLog.match(/^\[streaming\] Family return entered hero=(\d+) agent=(\d+) guild=469\/7 clock=(\d+) elapsed=(\d+) lookup=1 parent=469 native-rosters=100,2 script-roster=1 queued=1 agent-calls=(\d+) commands=(\d+),(\d+),(\d+),(\d+) other-ai=(\d+) other-commands=(\d+) function=(\S+) ordinary-only=1 saved=1 hooks-removed=1 owner-published=0 result=pass$/m);
  assert(entered);const endClock=Number(entered[3]),elapsed=Number(entered[4]);assert.equal(endClock-57650,elapsed);assert(elapsed>=1000&&elapsed<=6000);
  assert.equal(Number(entered[1]),heroId);assert.equal(Number(entered[2]),agentId);assert(entered.slice(5,12).map(Number).every(n=>n>0&&n<=65536));
  assert.equal(entered[12],'Rest_at_guild');
  assert.equal(m.records.length,29);const names=new Set();for(const r of m.records){
    assert.equal(r.filename,join(m.profile,basename(r.filename)));assert(!names.has(r.filename));names.add(r.filename);
    const a=await hashNativeFile(r.filename,{maximum:65536});assert.equal(a.sha256,r.sha256);assert.equal(a.bytes,r.bytes);
  }
  assert.equal(m.saves.length,3);const worlds={};for(const r of m.saves){
    assert.equal(r.filename,join(m.profile,'Documents/My Games/MajestyHD/SaveGame',basename(r.filename)));
    assert.equal(await hash(r.filename),r.sha256);assert.equal((await stat(r.filename)).size,r.bytes);
    let phase=basename(r.filename).match(/^Family_Return_(Source|Departed|Ready)\.GMP$/)?.[1];if(phase==='Ready')phase='Prepared';assert(phase&&!worlds[phase]);
    worlds[phase]={record:r,source:await stoppedFileSource(r.filename)};
  }
  assert.equal(live.source,worlds.Prepared.record.filename);assert.equal(await hash(live.source),worlds.Prepared.record.sha256);assert.equal(await hash(live.sourceCopy),worlds.Prepared.record.sha256);
  for(const flag of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged','proposalsUnchanged','donorUnchanged'])assert.equal(live[flag],true);
  assert.equal(live.saves.length,2);for(const r of live.saves){
    assert.equal(r.filename,join(live.profile,'Documents/My Games/MajestyHD/SaveGame',basename(r.filename)));assert.equal(await hash(r.filename),r.sha256);
    const phase=basename(r.filename).match(/^Family_Return_(Ready|Entered)\.GMP$/)?.[1];assert(phase&&!worlds[phase]);worlds[phase]={record:r,source:await stoppedFileSource(r.filename)};
  }
  assert.equal(await hash(live.reloadIdentity.filename),live.reloadIdentity.sha256);const identity=await readFile(live.reloadIdentity.filename);
  assert.deepEqual(Array.from({length:12},(_,i)=>identity.readUInt32LE(i*4)),[0x314c5246,1,57650,...ids,agentId,469,7,0,0]);
  const fullReloadUnitsExact=await exactOthers(worlds.Prepared.source,worlds.Ready.source,checkpointUnitAgentLinks,r=>r.unitId,new Set());
  const fullReloadAgentsExact=await exactOthers(worlds.Prepared.source,worlds.Ready.source,checkpointAgents,r=>r.agentId,new Set());
  const fullReloadAttachmentsExact=await exactOthers(worlds.Prepared.source,worlds.Ready.source,checkpointAttachments,r=>`${r.kind}:${r.unitId}`,new Set());
  const input=await stoppedFileSource(m.source);assert.equal(await checkpointSavedClock(input),57650);
  for(const phase of ['Source','Departed','Prepared','Ready'])assert.equal(await checkpointSavedClock(worlds[phase].source),57650);
  assert.equal(await checkpointSavedClock(worlds.Entered.source),endClock);
  const units={},agents={};for(const [phase,w]of Object.entries(worlds)){
    units[phase]=await rows(w.source,checkpointUnitAgentLinks,r=>r.unitId);agents[phase]=await rows(w.source,checkpointAgents,r=>r.agentId);
  }
  const sourceExactUnits=await exactOthers(input,worlds.Source.source,checkpointUnitAgentLinks,r=>r.unitId,new Set());
  const sourceExactAgents=await exactOthers(input,worlds.Source.source,checkpointAgents,r=>r.agentId,new Set());
  for(const phase of ['Departed','Ready','Entered']){
    for(const id of [504,527,528,529])assert(!units[phase].has(id));assert(!agents[phase].has(28));
    assert.equal(units[phase].get(469).agentId,7);assert.equal(agents[phase].get(7).unitId,469);
  }
  assert.equal(units.Departed.size,units.Source.size-4);assert.equal(agents.Departed.size,agents.Source.size-1);
  const otherRetiredUnitsExact=await exactOthers(worlds.Source.source,worlds.Departed.source,checkpointUnitAgentLinks,r=>r.unitId,new Set([504,527,528,529]));
  const otherRetiredAgentsExact=await exactOthers(worlds.Source.source,worlds.Departed.source,checkpointAgents,r=>r.agentId,new Set([7,28]));
  assert.equal(units.Ready.size,units.Source.size);assert.equal(agents.Ready.size,agents.Source.size);
  const record=async n=>{const filename=join(m.profile,n);assert(names.has(filename));return readFile(filename);};
  const sourceIds=[504,527,528,529];for(let i=0;i<4;++i){
    const u=units.Ready.get(ids[i]);assert(u);assert.equal(u.parentUnitId,i?heroId:0);assert.equal(u.agentId,i?0:agentId);
    const expected=Buffer.from(await record(`Family_Proposal_${sourceIds[i]}.UNIT`));expected.writeUInt32LE(i?heroId:0,56);
    if(!i){let at=92+(expected.readUInt32LE(80)?16:0),count=expected.readUInt32LE(at+4);at+=8;let found=0;
      for(let k=0;k<count;++k,at+=8)if(expected.readUInt32LE(at)===0x4541){assert.equal(expected.readUInt32LE(at+4),28);expected.writeUInt32LE(agentId,at+4);found++;}assert.equal(found,1);}
    expected.writeUInt32LE(0,36);assert.deepEqual(await record(`Family_Input_${sourceIds[i]}.UNIT`),expected);
    expected.writeUInt32LE(ids[i],36);assert.deepEqual(await record(`Family_Observed_${sourceIds[i]}.UNIT`),expected);
    assert.deepEqual(await bytes(worlds.Ready.source,u),expected);
    const orders=await record(`Family_Proposal_${sourceIds[i]}_Orders.bin`);assert.deepEqual(await record(`Family_Observed_${sourceIds[i]}_Orders.bin`),orders);
    let a;for await(const r of checkpointAttachments(worlds.Ready.source))if(r.kind==='ORDR'&&r.unitId===ids[i]){assert(!a);a=r;}assert(a);
    assert.deepEqual(Buffer.from(await worlds.Ready.source.readAt(a.primary.offset+16,a.primary.size)),orders);
  }
  const script=await record('Family_Proposal_Agent.GPL'),expected=Buffer.from(script);
  const actor=await checkpointAgentRecord(mem(script));assert.equal(actor.agentId,28);assert.equal(actor.unitId,504);
  // Typed standalone reference offsets remain independent of GMP positions.
  const {checkpointAgentRecordValues}=await import('../web/world/checkpoint.mjs');
  for await(const v of checkpointAgentRecordValues(mem(script)))if(v.type===5&&v.targetAgentId){assert([28,7].includes(v.targetAgentId));expected.writeUInt32LE(v.targetAgentId===28?agentId:7,v.offset);}
  expected.writeUInt32LE(agentId,script.length-24-Buffer.byteLength(actor.name));expected.writeUInt32LE(heroId,script.length-19);
  assert.deepEqual(await record('Family_Input_Agent.GPL'),expected);assert.deepEqual(await record('Family_Observed_Agent.GPL'),expected);
  assert.deepEqual(await bytes(worlds.Ready.source,agents.Ready.get(agentId)),expected);
  const roster=async (source)=>{const out=[];for await(const v of checkpointAgentValues(source,7))if(v.attribute==='members'&&v.type===5)out.push(v.targetAgentId);return out;};
  assert.deepEqual(await roster(worlds.Source.source),[28]);assert.deepEqual(await roster(worlds.Departed.source),[]);
  for(const phase of ['Ready','Entered']){
    assert.deepEqual(await roster(worlds[phase].source),[agentId]);
    let queued=0;for await(const q of checkpointAgentQueues(worlds[phase].source))if(q.type==='queued-agent'&&q.agentId===agentId)queued++;assert.equal(queued,1);
    const members=[];for await(const c of checkpointContainerEntries(worlds[phase].source))if(c.type==='member'&&
        ((c.unitId===469&&c.targetUnitId===heroId)||(c.unitId===heroId&&c.targetUnitId===469)))members.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
    assert.deepEqual(members,phase==='Ready'?[[469,100,heroId,1],[heroId,101,469,1]]:[[469,100,heroId,1],[469,2,heroId,1],[heroId,101,469,1]]);
  }
  assert.equal(units.Entered.get(heroId).parentUnitId,469);let active;
  for await(const v of checkpointAgentValues(worlds.Entered.source,agentId))if(v.attribute==='activescript'&&!v.path.length)active=v;
  assert(active);assert(active.functions.some(f=>f.name==='Rest_at_guild'));
  assert(m.resourceSamples.length&&m.resourceSamples.every(s=>s.pid===m.nativePid&&s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes));
  return {version:1,nativeHomeRequestCandidateConsumed:true,actualOutdoorFamilyHomeRestorationQualified:true,ordinaryGuildEntryQualified:true,
    manifest:resolve(name),manifestSha256:await hash(name),reloadManifest:resolve(reloadName),reloadManifestSha256:await hash(reloadName),fullReloadUnitsExact,fullReloadAgentsExact,fullReloadAttachmentsExact,nativeExecutableSha256:m.nativeExecutableSha256,
    heroId,agentId,effectIds:ids.slice(1),startClockMs:57650,endClockMs:endClock,elapsedMs:elapsed,
    sourceExactUnits,sourceExactAgents,otherRetiredUnitsExact,otherRetiredAgentsExact,
    worlds:Object.fromEntries(Object.entries(worlds).map(([k,v])=>[k,v.record])),request:prep.request,
    maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes),...live.resourceSamples.map(s=>s.rssBytes)),
    sourceSha256:{'scripts/inspect-native-outdoor-family-return.mjs':await hash('scripts/inspect-native-outdoor-family-return.mjs')},
    selectedOwnerPublished:false,seamlessHeroCrossingQualified:false,browserUsed:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const[name,reloadName,out]=process.argv.slice(2);assert.equal(process.argv.length,5);const r=await inspectNativeOutdoorFamilyReturn(name,reloadName);
  await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({actualOutdoorFamilyHomeRestorationQualified:true,ordinaryGuildEntryQualified:true,heroId:r.heroId,agentId:r.agentId,elapsedMs:r.elapsedMs,browserUsed:false}));
}
