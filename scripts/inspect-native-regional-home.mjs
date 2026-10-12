#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {sessionCompiledSourceHashes} from './lib/session-compiled-inputs.mjs';
import {parseRealmManifest} from '../web/world/realm-store.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {verifyRemoteHomeAgent,encodeRemoteHomeAgent} from '../web/world/remote-home.mjs';
import {checkpointAgents,checkpointAgentQueues,checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
const sha=async p=>(await hashNativeFile(p)).sha256;
async function json(p){assert.ok((await stat(p)).size<=256*1024);return JSON.parse(await readFile(p,'utf8'));}

export async function inspectNativeRegionalHome(name,depth=0){
  assert.ok(depth<=1);const m=await json(name);
  assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.regionalHomeTrialCompleted,m.stopReason,
    m.ownedProducerAbsent,m.canonicalAndServedUnchanged,m.nativeProcessesStarted],
    [true,false,true,0,true,null,true,true,1]);
  assert.ok(['create','reload'].includes(m.phase));assert.equal(m.goalComplete,false);
  try{process.kill(m.nativePid,0);throw Error('Original producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const root=await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-route-runtime-');
  assert.equal(m.profile,join(root,'native-world-hero-route','frontier_'+m.region));assert.notEqual(m.region,'0_0');
  assert.equal(m.privateNativeExecutable,join(root,'native/recomp/pop_smoke'));
  assert.equal(await sha(m.privateNativeExecutable),m.nativeExecutableSha256);
  assert.equal(m.privateRegistry,join(root,'registry.json'));
  const build=await json(m.buildReport);assert.equal(await sha(m.buildReport),m.buildReportSha256);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert.equal(await sha(build.log),build.logSha256);
  assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);assert.equal(build.nativeSymbolsSha256,m.nativeSymbolsSha256);
  assert.deepEqual(sessionCompiledSourceHashes(build),m.compiledSourceSha256);assert.equal(Object.keys(m.compiledSourceSha256).length,53);
  assert.ok(build.finishedAtMs<=m.startedAtMs);
  for(const [n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await sha(join(workspace,n)),h);
  assert.equal(await sha(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
  assert.equal(await sha(join(workspace,'scripts/run-native-regional-home.py')),m.runnerSha256);
  assert.equal(await sha(join(workspace,'scripts/lib/native_pair_guard.py')),m.guardSha256);
  const prep=await json(m.preparation);assert.equal(await sha(m.preparation),m.preparationSha256);
  assert.equal(prep.realFileSeedAndSaveQualified,true);assert.equal(prep.projection.plan.destinationRegion,m.region);
  const original=await json(prep.manifest);assert.equal(await sha(prep.manifest),prep.manifestSha256);
  const receipt=await json(original.receipt);assert.equal(await sha(original.receipt),original.receiptSha256);
  const registered=registeredHeroHome(receipt.identity);
  if(m.phase==='create'){
    assert.equal(m.previousProof,null);
    const region=original.snapshotCaptures.find(r=>r.region===m.region);assert.ok(region);
    assert.equal(m.source,region.file);assert.equal(m.sourceSha256,region.sha256);
    assert.equal(m.proposal,prep.projection.filename);assert.equal(m.proposalSha256,prep.projection.plan.recordSha256);
  }else{
    const previous=await inspectNativeRegionalHome((await json(m.previousProof)).sourceManifest,depth+1);
    const stored=await json(m.previousProof);
    assert.equal(stored.sourceManifestSha256,previous.sourceManifestSha256);
    assert.equal(previous.phase,'create');assert.equal(previous.preparation,m.preparation);
    assert.deepEqual(stored.savedWorld,previous.savedWorld);assert.deepEqual(stored.observedRecord,previous.observedRecord);
    assert.equal(m.source,previous.savedWorld.filename);assert.equal(m.sourceSha256,previous.savedWorld.sha256);
    assert.equal(m.proposal,previous.observedRecord.filename);assert.equal(m.proposalSha256,previous.observedRecord.sha256);
  }
  for(const flag of ['originalSourceUnchanged','sourceCopyUnchanged','originalProposalUnchanged','proposalCopyUnchanged',
    'originalSettingsUnchanged','privateNativeExecutableUnchanged'])assert.equal(m[flag],true);
  assert.equal(await sha(m.source),m.sourceSha256);assert.equal(await sha(m.sourceCopy),m.sourceSha256);
  assert.equal(await sha(m.proposal),m.proposalSha256);assert.equal(await sha(m.proposalCopy),m.proposalSha256);
  for(const [n,h]of Object.entries(m.inputHashes))assert.equal(await sha(join(m.settingsProfile,n)),h);
  assert.deepEqual(m.preservedBefore,m.preservedAfter);
  for(const [n,old]of Object.entries(m.preservedBefore)){
    if(old===null){await assert.rejects(stat(n),e=>e.code==='ENOENT');continue;}
    const st=await stat(n,{bigint:true});assert.equal(await sha(n),old.sha256);assert.equal(Number(st.ino),old.inode);
    // The controller compares full Python integer stamps before/after. JSON
    // numbers are rounded by JS, so compare this field in that same encoding.
    assert.equal(Number(st.mtimeNs),old.mtimeNs);assert.equal(Number(st.size),old.bytes);
  }
  assert.equal(await sha(m.script),m.scriptSha256);assert.equal(await sha(m.log),m.logSha256);
  assert.ok((await stat(m.log)).size<=4*1024*1024);const log=await readFile(m.log,'utf8');
  const rows=log.split('\n').filter(r=>r.startsWith('[streaming] Remote home phase='));assert.equal(rows.length,1);
  const match=rows[0].match(/^\[streaming\] Remote home phase=(create|reload) proposal=(\d+) agent=(\d+) native-id=0 attributes=9 bytes=453 registered=1 pure=1 original-valid=0 serialized-equal=1 state-preserved=1 scheduled=0 hero-imported=0 travel-qualified=0 result=pass$/);
  assert.ok(match);assert.equal(match[1],m.phase);const agentId=Number(match[3]),proposalId=Number(match[2]);
  const regional=log.split('\n').filter(r=>r.startsWith('[streaming] Regional home '));assert.equal(regional.length,1);
  const detail=regional[0].match(/^\[streaming\] Regional home key=([^ ]+) phase=(create|reload) agent=(\d+) counter-before=(\d+) counter-after=(\d+) original-restored=1 owner-published=0 result=pass$/);
  assert.ok(detail);assert.equal(detail[1],m.region);assert.equal(detail[2],m.phase);assert.equal(Number(detail[3]),agentId);
  assert.equal(Number(detail[5]),Number(detail[4])+Number(m.phase==='create'));
  if(m.phase==='create'){assert.equal(proposalId,1001);assert.equal(agentId,Number(detail[4]));assert.notEqual(agentId,proposalId);}
  else assert.equal(agentId,proposalId);
  const requests=log.split('\n').filter(r=>r.startsWith('[smoke] named action frontier-checkpoint:'));
  assert.deepEqual(requests,['[smoke] named action frontier-checkpoint: queued']);
  assert.equal(log.split('\n').filter(r=>r.includes(`Region ${m.region} checkpoint saved`)).length,1);
  assert.ok(!/result=fail|GplException|checksum failure|: refused/.test(log));
  const record=m.observedRecord;assert.equal(record.filename,join(m.profile,'Remote_Home_Observed.GPL'));
  assert.equal(record.bytes,453);assert.equal(await sha(record.filename),record.sha256);
  const checked=await verifyRemoteHomeAgent(await stoppedFileSource(record.filename),registered,agentId);
  assert.equal(checked.sha256,record.sha256);
  if(m.phase==='create'){
    assert.equal(m.patchedRecord.filename,join(m.profile,'Remote_Home_Input.GPL'));
    assert.equal(await sha(m.patchedRecord.filename),record.sha256);
  }else assert.equal(m.patchedRecord,null);
  assert.equal(await sha(m.finalMarker.filename),m.finalMarker.sha256);
  const marker=parseRealmManifest(await readFile(m.finalMarker.filename,'utf8'),m.content);
  const filename=join(m.profile,'Documents/My Games/MajestyHD/SaveGame',`Frontier_${m.region}${marker.slot?'_Recovery':''}.GMP`);
  const saved=m.saves.find(s=>s.filename===filename);assert.ok(saved);assert.equal(saved.sha256,marker.sha256);assert.equal(saved.bytes,marker.size);
  assert.equal(await sha(filename),saved.sha256);const file=await stoppedFileSource(filename);let proxy;
  for await(const a of checkpointAgents(file))if(a.agentId===agentId){assert.ok(!proxy);proxy=a;}
  assert.ok(proxy);assert.equal(proxy.size,453);const bytes=await file.readAt(proxy.offset,proxy.size);
  assert.deepEqual(bytes,encodeRemoteHomeAgent(registered.record,agentId));
  for await(const q of checkpointAgentQueues(file))assert.ok(q.type!=='queued-agent'||q.agentId!==agentId);
  for await(const u of checkpointUnitAgentLinks(file))assert.notEqual(u.agentId,agentId);
  assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.deadlineSeconds,35);assert.equal(m.logCeilingBytes,4*1024*1024);
  assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=20);
  for(const s of m.resourceSamples){assert.deepEqual(s.ownedPids,[m.nativePid]);assert.ok(Number.isFinite(s.rssBytes)&&s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
  assert.ok(m.finishedAtMs>m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=38000);
  assert.ok(m.frame);assert.equal(await sha(m.frame.filename),m.frame.sha256);
  return {version:1,phase:m.phase,region:m.region,regionalHomeFullSaveQualified:true,regionalHomeOriginalReloadQualified:m.phase==='reload',
    agentId,bytes:453,savedWorld:saved,observedRecord:record,preparation:m.preparation,registeredGuildEntityId:registered.record.guildEntityId,
    sourceManifest:resolve(name),sourceManifestSha256:await sha(name),nativeExecutableSha256:m.nativeExecutableSha256,
    peakSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),elapsedMs:m.finishedAtMs-m.startedAtMs,
    scope:'An inert original guild identity restored in a previously generated regional checkpoint, retained by original full-world save and optional fresh reload. No hero import, ownership publication or task routing.',
    browserUsed:false,heroImported:false,continuousHeroCrossingQualified:false,goalComplete:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const [manifest,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
  const result=await inspectNativeRegionalHome(manifest);await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({phase:result.phase,regionalHomeFullSaveQualified:true,regionalHomeOriginalReloadQualified:result.regionalHomeOriginalReloadQualified,
    agentId:result.agentId,peakSampledRssBytes:result.peakSampledRssBytes,heroImported:false}));
}
