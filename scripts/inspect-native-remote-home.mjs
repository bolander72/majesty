#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {checkpointAgents,checkpointAgentQueues,checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
import {encodeRemoteHomeAgent,verifyRemoteHomeAgent} from '../web/world/remote-home.mjs';
const hash=async filename=>(await hashNativeFile(filename)).sha256;
async function json(filename){assert.ok((await stat(filename)).size<=65536);return JSON.parse(await readFile(filename,'utf8'));}
export async function inspectNativeRemoteHome(name,depth=0) {
  assert.ok(depth<=1);const m=await json(name);
  assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.remoteHomeTrialCompleted,m.stopReason],
    [true,false,true,0,true,null]);assert.ok(['create','reload'].includes(m.phase));
  const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-remote-home-');assert.equal(m.profile,join(directory,'frontier_1_0'));
  const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);
  assert.equal(build.nativeBuildQualified,true);assert.equal(await hash(build.log),build.logSha256);
  await verifyConnectedNativeArtifact(m,build);assert.ok(build.finishedAtMs<=m.startedAtMs);
  assert.equal(await hash(m.preparation),m.preparationSha256);const prep=await json(m.preparation);
  assert.equal(prep.remoteHomeProposalPrepared,true);assert.equal(prep.plan.destinationRegion,'1_0');
  assert.equal(prep.registered.record.home.region,'0_0');assert.equal(await hash(prep.homeFilename),prep.registered.sha256);
  assert.equal(await hash(prep.registrationProof),prep.registrationProofSha256);
  assert.equal(await hash(prep.record.filename),prep.record.sha256);
  for(const [n,h] of Object.entries(prep.sourceSha256))assert.equal(await hash(join(workspace,n)),h);
  if(m.phase==='create') {
    assert.equal(m.previousManifest,null);assert.equal(m.source,prep.destination.filename);assert.equal(m.sourceSha256,prep.destination.sha256);
    assert.equal(m.proposal,prep.record.filename);assert.equal(m.proposalSha256,prep.record.sha256);
  } else {
    const previous=await inspectNativeRemoteHome(m.previousManifest,depth+1);assert.equal(previous.phase,'create');
    assert.equal(m.preparation,previous.preparation);assert.equal(m.source,previous.savedWorld.filename);
    assert.equal(m.sourceSha256,previous.savedWorld.sha256);assert.equal(m.proposal,previous.observedRecord.filename);
    assert.equal(m.proposalSha256,previous.observedRecord.sha256);
  }
  assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Remote_Starting_Realm.GMP'));
  for(const [n,h] of Object.entries(m.inputHashes))assert.equal(await hash(join(prep.settingsProfile,n)),h);
  for(const flag of ['originalSourceUnchanged','sourceCopyUnchanged','originalProposalUnchanged','proposalCopyUnchanged','originalSettingsUnchanged'])assert.equal(m[flag],true);
  assert.equal(await hash(m.source),m.sourceSha256);assert.equal(await hash(m.sourceCopy),m.sourceSha256);
  assert.equal(await hash(m.proposal),m.proposalSha256);assert.equal(await hash(join(m.profile,'Remote_Home_Proposal.GPL')),m.proposalSha256);
  assert.equal(m.script,join(directory,'load-remote.script'));assert.equal(await hash(m.script),m.scriptSha256);
  assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);
  const log=await readFile(m.log,'utf8'),rows=log.split('\n').filter(v=>v.startsWith('[streaming] Remote home phase='));assert.equal(rows.length,1);
  const match=rows[0].match(/^\[streaming\] Remote home phase=(create|reload) proposal=(\d+) agent=(\d+) native-id=0 attributes=9 bytes=(\d+) registered=1 pure=1 original-valid=0 serialized-equal=1 state-preserved=1 scheduled=0 hero-imported=0 travel-qualified=0 result=pass$/);
  assert.ok(match);assert.equal(match[1],m.phase);
  const proposal=Number(match[2]),agentId=Number(match[3]),bytes=Number(match[4]);assert.equal(bytes,453);
  assert.ok(agentId>0&&agentId<0x7fffffff);
  if(m.phase==='create'){assert.equal(proposal,100000);assert.notEqual(agentId,proposal);}else assert.equal(agentId,proposal);
  assert.equal(m.observedRecord.filename,join(m.profile,'Remote_Home_Observed.GPL'));
  assert.equal((await hashNativeFile(m.observedRecord.filename,{maximum:1024})).sha256,m.observedRecord.sha256);
  const checked=await verifyRemoteHomeAgent(await stoppedFileSource(m.observedRecord.filename),prep.registered,agentId);
  assert.equal(checked.bytes,bytes);assert.equal(checked.sha256,m.observedRecord.sha256);
  if(m.phase==='create') {
    assert.equal(m.patchedRecord.filename,join(m.profile,'Remote_Home_Input.GPL'));
    assert.equal(await hash(m.patchedRecord.filename),m.observedRecord.sha256);
    assert.deepEqual(new Uint8Array(await readFile(m.patchedRecord.filename)),encodeRemoteHomeAgent(prep.registered.record,agentId));
  } else assert.equal(m.patchedRecord,undefined);
  assert.equal(m.saves.length,2);for(const s of m.saves){const h=await hashNativeFile(s.filename);assert.equal(h.sha256,s.sha256);assert.equal(h.bytes,s.bytes);}
  const saves=m.saves.filter(s=>s.filename!==m.sourceCopy);assert.equal(saves.length,1);const saved=saves[0];
  assert.equal(resolve(saved.filename),join(m.profile,'Documents/My Games/MajestyHD/SaveGame',saved.filename.split('/').at(-1)));
  const source=await stoppedFileSource(saved.filename);let record;
  for await(const a of checkpointAgents(source))if(a.agentId===agentId){assert.ok(!record);record=a;}
  assert.ok(record);assert.equal(record.size,453);
  const raw=await source.readAt(record.offset,record.size);
  assert.deepEqual(raw,encodeRemoteHomeAgent(prep.registered.record,agentId));
  await verifyRemoteHomeAgent({size:raw.length,async readAt(at,n){return raw.slice(at,at+n);}},prep.registered,agentId);
  for await(const q of checkpointAgentQueues(source))assert.ok(q.type!=='queued-agent'||q.agentId!==agentId);
  for await(const u of checkpointUnitAgentLinks(source))assert.notEqual(u.agentId,agentId);
  assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=24);
  for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
  assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=45000);
  return {version:1,phase:m.phase,originalRemoteHomeRecordQualified:true,originalRemoteHomeFullSaveQualified:true,
    originalRemoteHomeReloadQualified:m.phase==='reload',scope:'An inert registered pure GPL identity for the actual guild in another generated region. Original allocation/reader/writer and full-world save preserve all nine identity attributes, without native association, scheduling or treating it as a valid game piece. No hero import, task routing or owner transfer.',
    agentId,bytes,originalValid:0,registeredHomeSha256:prep.registered.sha256,guildEntityId:checked.guildEntityId,
    observedRecord:m.observedRecord,savedWorld:saved,preparation:m.preparation,sourceManifest:resolve(name),sourceManifestSha256:await hash(name),
    nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,
    maxSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),elapsedMs:m.finishedAtMs-m.startedAtMs,
    nativeHeroHomeProjectionQualified:false,remoteHomeRoutingQualified:false,heroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
  const [manifest,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <stopped remote-home manifest> <fresh proof>');
  const r=await inspectNativeRemoteHome(manifest);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({phase:r.phase,originalRemoteHomeRecordQualified:true,originalRemoteHomeFullSaveQualified:true,
    originalRemoteHomeReloadQualified:r.originalRemoteHomeReloadQualified,agentId:r.agentId,bytes:r.bytes,browserUsed:false}));
}
