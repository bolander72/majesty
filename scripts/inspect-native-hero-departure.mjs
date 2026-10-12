#!/usr/bin/env node
// Original source retirement, before any selected regional owner changes.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {inspectGeneratedHero} from './inspect-native-generated-hero.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAgentValues,
 checkpointAgentQueues,checkpointAttachments,checkpointContainerEntries,checkpointIncomingAgentReferences,
 checkpointInventory} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const digest=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function typed(file){const units=new Map(),agents=new Map();for await(const u of checkpointUnitAgentLinks(file)){assert.ok(!units.has(u.unitId));units.set(u.unitId,u);}
 for await(const a of checkpointAgents(file)){assert.ok(!agents.has(a.agentId));agents.set(a.agentId,a);}return {units,agents};}
async function equal(a,r,b,s){assert.equal(r.size,s.size);assert.ok(r.size<=4096);assert.deepEqual(await a.readAt(r.offset,r.size),await b.readAt(s.offset,s.size));}
export async function inspectNativeHeroDeparture(name) {
 const m=await json(name);assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.heroDepartureTrialCompleted,m.stopReason],
  [true,false,true,0,true,null]);assert.equal(m.phase,'departure');
 const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-departure-');assert.equal(m.profile,join(directory,'frontier_0_0'));
 const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(build.nativeBuildQualified,true);
 assert.equal(await hash(build.log),build.logSha256);await verifyConnectedNativeArtifact(m,build);assert.ok(build.finishedAtMs<=m.startedAtMs);
 assert.equal(await hash(m.previousManifest),m.previousManifestSha256);const origin=await inspectGeneratedHero(m.previousManifest);
 assert.deepEqual([origin.newLivingWarriorCaptureQualified,origin.independentlyPlacedOutsideHome],[true,true]);
 assert.deepEqual([origin.hero.unitId,origin.actor.agent.agentId,origin.home.unit.unitId,origin.home.agent.agentId],[502,27,469,7]);
 assert.equal(m.source,origin.save.filename);assert.equal(m.sourceSha256,origin.save.sha256);assert.equal(await hash(m.source),m.sourceSha256);
 assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Departure_Source.GMP'));assert.equal(await hash(m.sourceCopy),m.sourceSha256);
 for(const f of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged'])assert.equal(m[f],true);
 const previous=await json(m.previousManifest);assert.equal(m.settingsProfile,previous.profile);assert.deepEqual(m.inputHashes,previous.inputHashes);
 for(const [n,h] of Object.entries(m.inputHashes)){assert.equal(await hash(join(m.settingsProfile,n)),h);assert.equal(await hash(join(m.profile,n)),h);}
 assert.equal(m.script,join(directory,'load-hero-departure.script'));assert.equal(await hash(m.script),m.scriptSha256);
 assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);
 const log=await readFile(m.log,'utf8');assert.ok(log.includes('all expectations met'));assert.ok(!/result=fail|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
 assert.deepEqual(log.split('\n').filter(l=>l.startsWith('[streaming] Hero departure ')),[
  '[streaming] Hero departure prepared hero=502 effect=503 agent=27 guild=469 guild-agent=7 clock=25800 members=1 queued=1 physical=1 footprint=4 before-saved=1 result=pass',
  '[streaming] Hero departure removed hero=502 effect=503 agent=27 guild=469 guild-agent=7 clock=25800 members=0 native-members=0 aliases-absent=1 queue-absent=1 other-queues-preserved=1 drawing-absent=1 other-drawing-preserved=1 grid-absent=1 counters-preserved=1 hooks-preserved=1 after-saved=1 owner-published=0 travel-qualified=0 result=pass']);
 assert.equal(m.saves.length,3);const copy=m.saves.find(r=>r.filename===m.sourceCopy);assert.ok(copy);assert.deepEqual([copy.bytes,copy.sha256],[origin.save.bytes,origin.save.sha256]);
 const saves={};for(const label of ['Before','After']) {
  const r=m.saves.find(r=>r.filename===join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Departure_'+label+'.GMP'));assert.ok(r);
  assert.deepEqual(await hashNativeFile(r.filename),{bytes:r.bytes,sha256:r.sha256,largestRead:4096});saves[label]={record:r,file:await stoppedFileSource(r.filename)};
 }
 const source=await stoppedFileSource(m.source),before=saves.Before.file,after=saves.After.file;
 for(const f of [source,before,after])assert.equal(await checkpointSavedClock(f),25800);
 const original=await typed(source),initial=await typed(before),departed=await typed(after);
 assert.equal(initial.units.size,original.units.size);assert.equal(initial.agents.size,original.agents.size);
 // Compare departure against the actual loaded world. Loading this source
 // clears only guild469's derived command-group marker before departure.
 for(const [id,r] of original.units) {
  if(id!==469){await equal(source,r,before,initial.units.get(id));continue;}
  const loaded=initial.units.get(id);assert.equal(r.size,267);assert.equal(loaded.size,r.size);
  const expected=Buffer.from(await source.readAt(r.offset,r.size));
  assert.equal(expected.readUInt32LE(40),513);expected.writeUInt32LE(512,40);
  assert.deepEqual(await before.readAt(loaded.offset,loaded.size),Uint8Array.from(expected));
 }
 for(const [id,r] of original.agents)await equal(source,r,before,initial.agents.get(id));
 assert.equal(departed.units.size,initial.units.size-2);assert.equal(departed.agents.size,initial.agents.size-1);
 for(const id of [502,503])assert.ok(!departed.units.has(id));assert.ok(!departed.agents.has(27));
 for(const [id,r] of initial.units)if(![502,503].includes(id))await equal(before,r,after,departed.units.get(id));
 for(const [id,r] of initial.agents)if(![7,27].includes(id))await equal(before,r,after,departed.agents.get(id));
 const refs=await checkpointIncomingAgentReferences(before,27);
 assert.deepEqual(refs.sites.filter(r=>r.agentId!==27).map(r=>[r.agentId,r.unitId,r.attribute,r.path,r.rootType,r.rootChildCount]),[[7,469,'members',[0],4,1]]);
 let root,child;for await(const v of checkpointAgentValues(before,7))if(v.attribute.toLowerCase()==='members'){if(!v.path.length)root=v;else{assert.equal(child,undefined);child=v;}}
 assert.ok(root&&child);assert.deepEqual([root.type,root.childCount,child.type,child.targetAgentId,child.size],[4,1,5,27,8]);
 const guildBefore=initial.agents.get(7),guildAfter=departed.agents.get(7);
 const input=Buffer.from(await before.readAt(guildBefore.offset,guildBefore.size)),start=child.typeOffset-guildBefore.offset;
 const expected=Buffer.concat([input.subarray(0,start),input.subarray(start+8)]),envelope=root.offset-guildBefore.offset;
 expected.writeUInt32LE(input.readUInt32LE(0)-8,0);expected.writeUInt32LE(input.readUInt32LE(8)-8,8);
 expected.writeUInt32LE(input.readUInt32LE(envelope)-8,envelope);assert.equal(input.readUInt32LE(envelope+8),1);expected.writeUInt32LE(0,envelope+8);
 assert.equal(guildAfter.size,expected.length);assert.deepEqual(await after.readAt(guildAfter.offset,guildAfter.size),Uint8Array.from(expected),'Original guild changed beyond the one member/list envelope removal');
 const remaining=[];for await(const v of checkpointAgentValues(after,7))if(v.attribute.toLowerCase()==='members')remaining.push(v);
 assert.equal(remaining.length,1);assert.deepEqual([remaining[0].path,remaining[0].type,remaining[0].childCount],[[],4,0]);
 for(const [id] of departed.agents)for await(const v of checkpointAgentValues(after,id))assert.ok(!(v.type===5&&v.targetAgentId===27));
 const incomingContainers=[];for await(const c of checkpointContainerEntries(before))if(c.type==='member'&&[502,503].includes(c.targetUnitId))incomingContainers.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
 assert.deepEqual(incomingContainers,[[469,100,502,1],[502,1,503,1]]);
 for await(const c of checkpointContainerEntries(after)){assert.ok(![502,503].includes(c.unitId));if(c.type==='member')assert.ok(![502,503].includes(c.targetUnitId));}
 const beforeQueues=[],afterQueues=[];for await(const q of checkpointAgentQueues(before))if(q.type==='queued-agent')beforeQueues.push([q.queue,q.agentId]);
 for await(const q of checkpointAgentQueues(after))if(q.type==='queued-agent')afterQueues.push([q.queue,q.agentId]);
 assert.equal(beforeQueues.filter(q=>q[1]===27).length,1);assert.deepEqual(afterQueues,beforeQueues.filter(q=>q[1]!==27));
 for await(const u of checkpointUnitAgentLinks(after)){assert.notEqual(u.agentId,27);assert.ok(![502,503].includes(u.parentUnitId));}
 for await(const a of checkpointAttachments(after))assert.ok(![502,503].includes(a.unitId));
 for await(const i of checkpointInventory(after))assert.ok(![502,503].includes(i.ownerUnitId));
 assert.equal(m.records.length,7);const records=new Map();for(const r of m.records){assert.ok(r.filename.startsWith(join(m.profile,'Hero_Departure_')));assert.ok(r.bytes>0&&r.bytes<=4096);assert.ok(!records.has(r.filename));records.set(r.filename,r);
  assert.deepEqual(await hashNativeFile(r.filename),{bytes:r.bytes,sha256:r.sha256,largestRead:r.bytes});}
 for(const [n,r,f] of [
  ['Hero_Departure_Hero_Before.UNIT',initial.units.get(502),before],['Hero_Departure_Effect_Before.UNIT',initial.units.get(503),before],
  ['Hero_Departure_Guild_Before.UNIT',initial.units.get(469),before],['Hero_Departure_Agent_Before.GPL',initial.agents.get(27),before],
  ['Hero_Departure_Guild_Before.GPL',guildBefore,before],['Hero_Departure_Guild_After.UNIT',departed.units.get(469),after],['Hero_Departure_Guild_After.GPL',guildAfter,after]]) {
  const observed=records.get(join(m.profile,n));assert.ok(observed);
  let expected=Buffer.from(await f.readAt(r.offset,r.size));
  if(n.includes('Guild_')&&n.endsWith('.UNIT')) {
   // The standalone writer uses SECD version2; full-world saving uses
   // version1. PRIM is identical, and both standalone guild records are
   // identical. Bind this exact fixture difference, not a general rewrite.
   assert.equal(expected.length,267);assert.equal(expected.toString('ascii',250,254),'SECD');
   assert.deepEqual(Array.from(expected.subarray(254)),[1,0,0,0,1,0,0,0,0,0,0,0,0]);
   expected=Buffer.concat([expected.subarray(0,254),Buffer.from([5,0,0,0,2,0,0,0,0,0,0,0,0,33,0,0,0])]);
   expected.writeUInt32LE(255,4);
  }
  assert.equal(observed.bytes,expected.length);assert.equal(observed.sha256,digest(expected));
 }
 assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=18);assert.equal(m.rssCeilingBytes,512*1024*1024);
 for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
 assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=35000);
 return {version:1,originalRegisteredHeroSourceDepartureQualified:true,originalRegisteredHeroSourceFullSaveQualified:true,
  scope:'Actual recruited Warrior502/GPL27 and attached effect503 leave an owned original source world at clock25800 through original lifecycle. One guild member is removed with original operator5; guild469/GPL7 survives. All retained UNIT/GPL bytes are exact except the one typed8B member removal and its four envelope/count edits. Known typed references, native memberships, actor queues, drawing and grid entries are absent; source actor owner publication remains unchanged until a separate paired commit. No continuous seam travel, native revision reload or browser qualification.',
  sourceManifest:resolve(name),sourceManifestSha256:await hash(name),originManifest:m.previousManifest,originManifestSha256:m.previousManifestSha256,
  sourceWorld:origin.save,beforeWorld:saves.Before.record,afterWorld:saves.After.record,heroId:502,effectId:503,agentId:27,guildId:469,guildAgentId:7,clockMs:25800,
  retainedTypedUnitsExact:departed.units.size,retainedTypedAgentsExact:departed.agents.size-1,guildMemberRemovedBytes:8,guildAfterBytes:guildAfter.size,
  loadNormalization:{unitId:469,relativeOffset:40,before:513,after:512,otherTypedRecordsExact:true},
  standaloneGuildWriter:{primaryExact:true,fullSecondaryVersion:1,standaloneSecondaryVersion:2,fullBytes:267,standaloneBytes:271,beforeAfterExact:true},
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,nativeSymbolsSha256:build.nativeSymbolsSha256,
  maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),nativeProcessTerminal:true,
  ownerPublicationQualified:false,heroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [manifest,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal departure manifest> <fresh proof>');
 const r=await inspectNativeHeroDeparture(manifest);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({originalRegisteredHeroSourceDepartureQualified:true,originalRegisteredHeroSourceFullSaveQualified:true,
  retainedTypedUnitsExact:r.retainedTypedUnitsExact,retainedTypedAgentsExact:r.retainedTypedAgentsExact,ownerPublicationQualified:false,browserUsed:false}));
}
