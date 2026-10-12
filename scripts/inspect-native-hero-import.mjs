#!/usr/bin/env node
// Stopped original runtime evidence, not a source/destination owner handoff.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {compareNativeMarkerClocks} from './compare-native-marker-clocks.mjs';
import {inspectGeneratedHero} from './inspect-native-generated-hero.mjs';
import {inspectNativeRemoteHome} from './inspect-native-remote-home.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAgents,checkpointAgentQueues,
  checkpointAttachments,checkpointAgentRecordValues,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {verifyRegisteredHeroProducerSources} from './lib/registered-hero-source-artifact.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
const memory=b=>({size:b.length,async readAt(at,n){assert.ok(n<=4096&&at>=0&&at+n<=b.length);return Uint8Array.from(b.subarray(at,at+n));}});
export async function inspectNativeHeroImport(name) {
 const m=await json(name);
 assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.heroImportTrialCompleted,m.stopReason],
  [true,false,true,0,true,null]);assert.equal(m.phase,'create');
 const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-import-');assert.equal(m.profile,join(directory,'frontier_1_0'));
 const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);
 assert.equal(build.nativeBuildQualified,true);assert.equal(await hash(build.log),build.logSha256);
 await verifyConnectedNativeArtifact(m,build);assert.ok(build.finishedAtMs<=m.startedAtMs);
 const prep=await json(m.preparation);assert.equal(await hash(m.preparation),m.preparationSha256);
 assert.equal(prep.preparedRealRegisteredHeroCapsuleQualified,true);assert.deepEqual(prep.sourceClocksMs,[25800,18250]);
 for(const [n,h] of Object.entries(prep.sourceSha256))assert.equal(await hash(join(workspace,n)),h);
 await compareNativeMarkerClocks(prep.markerClockPair.sourceManifest,prep.markerClockPair.rebasedManifest);
 const seed=await json(prep.seedProof);assert.equal(await hash(prep.seedProof),prep.seedProofSha256);
 assert.equal(seed.initialStoppedHeroOwnerQualified,true);
 await verifyRegisteredHeroProducerSources(seed,prep.seedProof);
 const io=await stoppedRevisionStorage(seed.fixture,{});io.atomicWrite=async()=>{throw Error('Read-only import qualification');};
 const store=await openEntityRevisionStore(io,seed.identity.contentDigest),selected=await store.read();
 assert.equal(selected.record.manifest,seed.selectedManifest);assert.deepEqual(selected.owner,seed.selectedOwner);
 assert.deepEqual(selected.record.worlds.map(w=>w.sha256),seed.inputs.map(w=>w.sha256));
 const origin=await inspectGeneratedHero(prep.originManifest),remote=await inspectNativeRemoteHome(prep.remoteManifest);
 assert.deepEqual(seed.inputs,[origin.save,remote.savedWorld]);assert.equal(m.source,remote.savedWorld.filename);
 assert.equal(m.sourceSha256,remote.savedWorld.sha256);assert.equal(await hash(m.source),m.sourceSha256);
 assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Starting_Realm.GMP'));
 assert.equal(await hash(m.sourceCopy),m.sourceSha256);
 for(const f of ['originalSourceUnchanged','sourceCopyUnchanged','originalProposalsUnchanged','proposalCopiesUnchanged','originalSettingsUnchanged'])assert.equal(m[f],true);
 const names={unit:'Hero_Import_Hero_Proposal.UNIT',agent:'Hero_Import_Agent_Proposal.GPL',container:'Hero_Import_Container_Proposal.bin',
  attached_503:'Hero_Import_Effect_Proposal.UNIT',attached_order_503:'Hero_Import_Orders_Proposal.bin'};
 assert.equal(m.proposals.length,5);
 for(const [k,n] of Object.entries(names)){
  const r=prep.records[k],p=m.proposals.find(p=>p.source===r.filename);assert.ok(p);
  assert.equal(p.copied,join(m.profile,n));assert.equal(p.sha256,r.sha256);assert.equal(p.bytes,r.bytes);
  assert.equal(await hash(p.source),p.sha256);assert.equal(await hash(p.copied),p.sha256);
 }
 for(const [n,h] of Object.entries(m.inputHashes))assert.equal(await hash(join(m.settingsProfile,n)),h);
 assert.equal(m.script,join(directory,'load-hero-import.script'));assert.equal(await hash(m.script),m.scriptSha256);
 assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);
 const log=await readFile(m.log,'utf8');assert.ok(log.includes('all expectations met'));
 assert.ok(!/result=fail|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
 const rows=log.split('\n').filter(l=>l.startsWith('[streaming] Hero import '));assert.equal(rows.length,4);
 assert.equal(rows[0],'[streaming] Hero import stage part=hero status=00000000 complete=1 failure=0');
 assert.equal(rows[1],'[streaming] Hero import stage part=effect status=00000000 complete=1 failure=0');
 const match=rows[2].match(/^\[streaming\] Hero import saved hero=(\d+) effect=(\d+) agent=(\d+) proxy=45 clock=(\d+) exact-records=1 original-finalization=1 scheduled=0 owner-published=0 travel-qualified=0 result=pass$/);
 assert.ok(match);const [heroId,effectId,agentId,clock]=match.slice(1).map(Number);
 assert.ok(heroId>0&&heroId<0x7ffffffe&&effectId===heroId+1&&agentId>45&&agentId<0x7ffffffe);assert.equal(clock,18250);
 assert.equal(rows[3],'[streaming] Hero import cleanup original-removal=1 aliases-absent=1 proxy-preserved=1 queues-preserved=1 hooks-removed=1 result=pass');
 assert.equal(m.saves.length,2);const saved=m.saves.find(s=>s.filename!==m.sourceCopy);assert.ok(saved);
 assert.equal(saved.filename,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Import_Ready.GMP'));
 assert.deepEqual(await hashNativeFile(saved.filename),{bytes:saved.bytes,sha256:saved.sha256,largestRead:4096});
 const file=await stoppedFileSource(saved.filename);assert.equal(await checkpointSavedClock(file),clock);
 const actor=await checkpointActorRecords(file,heroId);assert.equal(actor.agent.agentId,agentId);
 assert.deepEqual([actor.unit.family,actor.unit.description,actor.unit.parentUnitId,actor.unit.stateFlags],['VHCL',0x314c5641,0,512]);
 const children=[];for await(const u of checkpointUnitAgentLinks(file))if(u.parentUnitId===heroId)children.push(u);
 assert.equal(children.length,1);assert.deepEqual([children[0].unitId,children[0].agentId,children[0].description,children[0].stateFlags],[effectId,0,0x33485241,2592]);
 const ranges={unit:actor.unit,agent:actor.agent,attached_503:children[0]};
 for await(const a of checkpointAttachments(file)){
  if(a.kind==='CONT'&&a.unitId===heroId){assert.equal(ranges.container,undefined);ranges.container=a;}
  if(a.kind==='ORDR'&&a.unitId===effectId){assert.equal(ranges.attached_order_503,undefined);ranges.attached_order_503=a;}
 }
 assert.deepEqual(Object.keys(ranges).sort(),Object.keys(prep.records).sort());
 const observations={};
 for(const [k,r] of Object.entries(prep.records)) {
  assert.ok(r.bytes<=4096);assert.equal(await hash(r.filename),r.sha256);
  const expected=Buffer.from(await readFile(r.filename)),range=ranges[k];assert.equal(range.size,r.bytes);
  if(k==='unit'){
   expected.writeUInt32LE(heroId,36);
   const e=prep.plan.edits.find(e=>e.record==='unit'&&e.reason==='native script association');assert.ok(e);
   const at=e.offset-prep.plan.ranges.unit.offset;assert.equal(expected.readUInt32LE(at),1000);expected.writeUInt32LE(agentId,at);
  } else if(k==='agent'){
   const changes=[];for await(const v of checkpointAgentRecordValues(memory(expected)))if(v.type===5&&v.targetAgentId===1000)changes.push(v.offset);
   for(const at of changes)expected.writeUInt32LE(agentId,at);
   assert.equal(expected.readUInt32LE(expected.length-24),1000);expected.writeUInt32LE(agentId,expected.length-24);
   assert.equal(expected.readUInt32LE(expected.length-19),100000);expected.writeUInt32LE(heroId,expected.length-19);
  } else if(k==='attached_503'){expected.writeUInt32LE(effectId,36);expected.writeUInt32LE(heroId,56);}
  else if(k==='container'){for(const at of [0,56,72]){assert.equal(expected.readUInt32LE(at),100000);expected.writeUInt32LE(heroId,at);}
   assert.equal(expected.readUInt32LE(76),100001);expected.writeUInt32LE(effectId,76);
  } else if(k==='attached_order_503'){expected.writeUInt32LE(effectId,0);assert.equal(expected.readUInt32LE(80),clock);}
  assert.deepEqual(await file.readAt(range.offset,range.size),Uint8Array.from(expected),'Original whole save differs: '+k);
  observations[k]={...range,bytes:range.size,sha256:createHash('sha256').update(expected).digest('hex')};
 }
 const queues=[];for await(const q of checkpointAgentQueues(file))if(q.agentId===agentId||q.agentId===45)queues.push(q);
 assert.deepEqual(queues,[]);
 const membership=[];for await(const e of checkpointContainerEntries(file))if(e.unitId===heroId)membership.push(e);
 assert.deepEqual(membership.filter(e=>e.type==='member').map(e=>[e.groupKind,e.targetUnitId]),[[1,effectId]]);
 assert.equal(membership.find(e=>e.type==='group'&&e.groupKind===101).memberCount,0);
 // Every preexisting typed identity survives; the pure home record is exact.
 const before=await stoppedFileSource(m.source),oldUnits=new Map(),newUnits=new Map(),oldAgents=new Map(),newAgents=new Map();
 for await(const u of checkpointUnitAgentLinks(before))oldUnits.set(u.unitId,u);
 for await(const u of checkpointUnitAgentLinks(file))newUnits.set(u.unitId,u);
 for(const [id,u] of oldUnits){const v=newUnits.get(id);assert.ok(v);for(const k of ['family','description','playerNumber','parentUnitId','agentId'])assert.equal(v[k],u[k]);}
 assert.equal(newUnits.size,oldUnits.size+2);
 for await(const a of checkpointAgents(before))oldAgents.set(a.agentId,a);
 for await(const a of checkpointAgents(file))newAgents.set(a.agentId,a);
 assert.equal(newAgents.size,oldAgents.size+1);
 for(const [id,a] of oldAgents){assert.equal(newAgents.get(id)?.unitId,a.unitId);assert.equal(newAgents.get(id)?.deleted,a.deleted);}
 const p=oldAgents.get(45),q=newAgents.get(45);assert.equal(p.size,q.size);
 assert.deepEqual(await before.readAt(p.offset,p.size),await file.readAt(q.offset,q.size));
 assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=18);assert.equal(m.rssCeilingBytes,512*1024*1024);
 for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
 assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=35000);
 return {version:1,originalRegisteredHeroUnscheduledImportQualified:true,originalRegisteredHeroWholeSaveQualified:true,
  scope:'Actual registered hero and attached Newrecruit effect are privately read, assigned fresh native/script identities, linked, finalized and saved by the original runtime in native1_0. Five complete save records exactly match prepared data with audited alias changes; agent stays unscheduled. Original cleanup removes both native actors and agent before ordinary frames resume. Existing typed identities and the pure home record survive. No source departure, native reload, live task routing, continuous crossing or owner publication.',
  sourceManifest:resolve(name),sourceManifestSha256:await hash(name),preparation:m.preparation,preparationSha256:m.preparationSha256,
  heroId,effectId,agentId,proxyId:45,clockMs:clock,observations,savedWorld:saved,
  selectedOwnerUnchanged:true,selectedOwner:selected.owner,selectedOwnerManifest:selected.record.manifest,
  preexistingTypedUnitsPreserved:oldUnits.size,preexistingTypedAgentsPreserved:oldAgents.size,
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,nativeSymbolsSha256:build.nativeSymbolsSha256,
  maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),nativeProcessTerminal:true,
  originalRegisteredHeroReloadQualified:false,heroCrossingQualified:false,ownerPublicationQualified:false,
  remoteHomeRoutingQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [manifest,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal import manifest> <fresh proof>');
 const r=await inspectNativeHeroImport(manifest);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({originalRegisteredHeroUnscheduledImportQualified:true,originalRegisteredHeroWholeSaveQualified:true,
  heroId:r.heroId,effectId:r.effectId,agentId:r.agentId,clockMs:r.clockMs,heroCrossingQualified:false,browserUsed:false}));
}
