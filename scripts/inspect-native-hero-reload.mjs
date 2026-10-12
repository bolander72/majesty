#!/usr/bin/env node
// Original full-load/full-save evidence; the selected source owner stays put.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {inspectNativeHeroImport} from './inspect-native-hero-import.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAgents,checkpointAgentQueues,
  checkpointAttachments,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
export async function inspectNativeHeroReload(name) {
 const m=await json(name);
 assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.heroReloadTrialCompleted,m.stopReason],
  [true,false,true,0,true,null]);assert.equal(m.phase,'reload');
 const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-reload-');assert.equal(m.profile,join(directory,'frontier_1_0'));
 const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);
 assert.equal(build.nativeBuildQualified,true);assert.equal(await hash(build.log),build.logSha256);
 await verifyConnectedNativeArtifact(m,build);assert.ok(build.finishedAtMs<=m.startedAtMs);
 assert.equal(await hash(m.previousManifest),m.previousManifestSha256);
 const prior=await inspectNativeHeroImport(m.previousManifest);
 assert.deepEqual([prior.originalRegisteredHeroUnscheduledImportQualified,prior.originalRegisteredHeroWholeSaveQualified],[true,true]);
 assert.deepEqual([prior.heroId,prior.effectId,prior.agentId,prior.proxyId,prior.clockMs],[554,555,48,45,18250]);
 assert.equal(m.source,prior.savedWorld.filename);assert.equal(m.sourceSha256,prior.savedWorld.sha256);
 assert.equal(await hash(m.source),m.sourceSha256);
 assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Reload_Source.GMP'));
 assert.equal(await hash(m.sourceCopy),m.sourceSha256);
 for(const f of ['originalSourceUnchanged','sourceCopyUnchanged','inputCopiesUnchanged','originalSettingsUnchanged'])assert.equal(m[f],true);
 const original=await stoppedFileSource(m.source);
 const inputs={unit:'Hero_Reload_Hero_Input.UNIT',agent:'Hero_Reload_Agent_Input.GPL',
  attached_503:'Hero_Reload_Effect_Input.UNIT',attached_order_503:'Hero_Reload_Orders_Input.bin'};
 assert.equal(m.inputs.length,5);
 for(const [k,n] of Object.entries(inputs)) {
  const source=prior.observations[k],r=m.inputs.find(r=>r.copied===join(m.profile,n));assert.ok(r);
  const offset=source.offset+(k==='attached_order_503'?36:0),bytes=source.bytes-(k==='attached_order_503'?36:0);
  assert.deepEqual([r.sourceOffset,r.bytes],[offset,bytes]);assert.ok(bytes<=4096);
  const expected=await original.readAt(offset,bytes);
  assert.equal(r.sha256,createHash('sha256').update(expected).digest('hex'));
  assert.deepEqual(await hashNativeFile(r.copied),{bytes,sha256:r.sha256,largestRead:Math.min(bytes,4096)});
 }
 const identity=m.inputs.find(r=>r.copied===join(m.profile,'Hero_Reload_Identity.bin'));assert.ok(identity);
 assert.deepEqual([identity.sourceOffset,identity.bytes],[null,16]);
 const idBytes=Buffer.alloc(16);[554,555,48,18250].forEach((id,i)=>idBytes.writeUInt32LE(id,i*4));
 assert.deepEqual(await readFile(identity.copied),idBytes);assert.equal(await hash(identity.copied),identity.sha256);
 const previous=await json(m.previousManifest);assert.equal(m.settingsProfile,previous.settingsProfile);assert.deepEqual(m.inputHashes,previous.inputHashes);
 for(const [n,h] of Object.entries(m.inputHashes)){
  assert.equal(await hash(join(m.settingsProfile,n)),h);assert.equal(await hash(join(m.profile,n)),h);
 }
 assert.equal(m.script,join(directory,'load-hero-reload.script'));assert.equal(await hash(m.script),m.scriptSha256);
 assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);
 const log=await readFile(m.log,'utf8');assert.ok(log.includes('all expectations met'));
 assert.ok(!/result=fail|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
 assert.deepEqual(log.split('\n').filter(l=>l.startsWith('[streaming] Hero reload ')),[
  '[streaming] Hero reload saved hero=554 effect=555 agent=48 proxy=45 clock=18250 links=1 exact-records=1 original-full-load=1 scheduled=0 owner-published=0 travel-qualified=0 result=pass',
  '[streaming] Hero reload cleanup original-removal=1 aliases-absent=1 proxy-preserved=1 hooks-removed=1 result=pass']);
 const observed={unit:'Hero_Reload_Hero_Observed.UNIT',agent:'Hero_Reload_Agent_Observed.GPL',attached_503:'Hero_Reload_Effect_Observed.UNIT'};
 assert.equal(m.records.length,8);
 for(const [k,n] of Object.entries(observed)) {
  const source=prior.observations[k],r=m.records.find(r=>r.filename===join(m.profile,n));assert.ok(r);
  assert.deepEqual([r.bytes,r.sha256],[source.bytes,source.sha256]);
  assert.deepEqual(await hashNativeFile(r.filename),{bytes:r.bytes,sha256:r.sha256,largestRead:Math.min(r.bytes,4096)});
 }
 for(const i of m.inputs){const r=m.records.find(r=>r.filename===i.copied);assert.ok(r);assert.deepEqual([r.bytes,r.sha256],[i.bytes,i.sha256]);}
 assert.equal(m.saves.length,2);const saved=m.saves.find(s=>s.filename!==m.sourceCopy);assert.ok(saved);
 assert.equal(saved.filename,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Reload_Ready.GMP'));
 assert.deepEqual(await hashNativeFile(saved.filename),{bytes:saved.bytes,sha256:saved.sha256,largestRead:4096});
 const file=await stoppedFileSource(saved.filename);assert.equal(await checkpointSavedClock(file),prior.clockMs);
 const actor=await checkpointActorRecords(file,prior.heroId);assert.equal(actor.agent.agentId,prior.agentId);
 const ranges={unit:actor.unit,agent:actor.agent},children=[];
 for await(const u of checkpointUnitAgentLinks(file))if(u.parentUnitId===prior.heroId)children.push(u);
 assert.equal(children.length,1);assert.equal(children[0].unitId,prior.effectId);ranges.attached_503=children[0];
 for await(const a of checkpointAttachments(file)) {
  const key=a.kind==='CONT'&&a.unitId===prior.heroId?'container':a.kind==='ORDR'&&a.unitId===prior.effectId?'attached_order_503':null;
  if(key){assert.equal(ranges[key],undefined);ranges[key]=a;}
 }
 assert.deepEqual(Object.keys(ranges).sort(),Object.keys(prior.observations).sort());
 const observations={};
 for(const [k,source] of Object.entries(prior.observations)) {
  const r=ranges[k];assert.equal(r.size,source.bytes);assert.ok(r.size<=4096);
  const bytes=await file.readAt(r.offset,r.size);assert.deepEqual(bytes,await original.readAt(source.offset,source.bytes),'Original re-save differs: '+k);
  observations[k]={...r,bytes:r.size,sha256:createHash('sha256').update(bytes).digest('hex')};
 }
 const queues=[];for await(const q of checkpointAgentQueues(file))if(q.agentId===48||q.agentId===45)queues.push(q);assert.deepEqual(queues,[]);
 const members=[];for await(const e of checkpointContainerEntries(file))if(e.unitId===554)members.push(e);
 assert.deepEqual(members.filter(e=>e.type==='member').map(e=>[e.groupKind,e.targetUnitId]),[[1,555]]);
 assert.equal(members.find(e=>e.type==='group'&&e.groupKind===101).memberCount,0);
 const oldUnits=new Map(),newUnits=new Map(),oldAgents=new Map(),newAgents=new Map();
 for await(const u of checkpointUnitAgentLinks(original))oldUnits.set(u.unitId,u);
 for await(const u of checkpointUnitAgentLinks(file))newUnits.set(u.unitId,u);
 assert.equal(newUnits.size,oldUnits.size);
 for(const [id,u] of oldUnits){const v=newUnits.get(id);assert.ok(v);for(const k of ['family','description','playerNumber','parentUnitId','agentId'])assert.equal(v[k],u[k]);}
 for await(const a of checkpointAgents(original))oldAgents.set(a.agentId,a);
 for await(const a of checkpointAgents(file))newAgents.set(a.agentId,a);
 assert.equal(newAgents.size,oldAgents.size);
 for(const [id,a] of oldAgents){assert.equal(newAgents.get(id)?.unitId,a.unitId);assert.equal(newAgents.get(id)?.deleted,a.deleted);}
 const p=oldAgents.get(45),q=newAgents.get(45);assert.equal(p.size,q.size);
 assert.deepEqual(await original.readAt(p.offset,p.size),await file.readAt(q.offset,q.size));
 assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=18);assert.equal(m.rssCeilingBytes,512*1024*1024);
 for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
 assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=35000);
 return {version:1,originalRegisteredHeroReloadQualified:true,originalRegisteredHeroReloadWholeSaveQualified:true,
  scope:'Fresh original whole-world load restores native hero 554, attached Newrecruit effect 555, script agent 48 and pure home 45 in native region 1_0. Original writers and full re-save match all five imported records byte for byte; actor and home stay unscheduled. Original cleanup removes both native actors and agent. No simulation, task routing, source departure, owner publication, continuous crossing or browser qualification.',
  sourceManifest:resolve(name),sourceManifestSha256:await hash(name),previousManifest:m.previousManifest,previousManifestSha256:m.previousManifestSha256,
  sourceWorld:prior.savedWorld,savedWorld:saved,observations,heroId:554,effectId:555,agentId:48,proxyId:45,clockMs:18250,
  selectedOwnerUnchanged:prior.selectedOwnerUnchanged,selectedOwner:prior.selectedOwner,selectedOwnerManifest:prior.selectedOwnerManifest,
  preexistingTypedUnitsPreserved:oldUnits.size,preexistingTypedAgentsPreserved:oldAgents.size,
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,nativeSymbolsSha256:build.nativeSymbolsSha256,
  maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),nativeProcessTerminal:true,
  heroCrossingQualified:false,ownerPublicationQualified:false,remoteHomeRoutingQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [manifest,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal reload manifest> <fresh proof>');
 const r=await inspectNativeHeroReload(manifest);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({originalRegisteredHeroReloadQualified:true,originalRegisteredHeroReloadWholeSaveQualified:true,
  heroId:r.heroId,effectId:r.effectId,agentId:r.agentId,clockMs:r.clockMs,heroCrossingQualified:false,browserUsed:false}));
}
