#!/usr/bin/env node
// Qualify original restoration of the actual committed remote Warrior.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {inspectNativeHeroReturnPreparation} from './prepare-native-hero-return.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,
 checkpointAgentValues,checkpointContainerEntries,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const digest=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function typed(f){const units=new Map(),agents=new Map();for await(const r of checkpointUnitAgentLinks(f)){assert.ok(!units.has(r.unitId));units.set(r.unitId,r);}for await(const r of checkpointAgents(f)){assert.ok(!agents.has(r.agentId));agents.set(r.agentId,r);}return {units,agents};}
async function equal(a,r,b,s){assert.ok(r&&s);assert.equal(r.size,s.size);for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await a.readAt(r.offset+at,n),await b.readAt(s.offset+at,n));}}
export async function inspectNativeHeroReturn(name) {
 const m=await json(name);assert.deepEqual([m.version,m.nativeOnly,m.browserUsed,m.phase,m.nativeSessionTerminal,m.nativeExitCode,m.heroReturnTrialCompleted,m.stopReason],[1,true,false,'return',true,0,true,null]);
 const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-return-');assert.equal(m.profile,join(directory,'frontier_0_0'));
 const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(build.nativeBuildQualified,true);
 assert.equal(await hash(build.log),build.logSha256);await verifyConnectedNativeArtifact(m,build);assert.ok(build.finishedAtMs<=m.startedAtMs);
 const prepared=await inspectNativeHeroReturnPreparation(m.previousManifest);assert.equal(await hash(m.previousManifest),m.previousManifestSha256);
 const pub=await json(prepared.publication);assert.equal(m.publication,prepared.publication);assert.equal(m.publicationSha256,prepared.publicationSha256);
 assert.equal(await hash(m.publication),m.publicationSha256);assert.equal(m.source,pub.inputs[0].filename);assert.equal(m.sourceSha256,pub.inputs[0].sha256);
 assert.equal(await hash(m.source),m.sourceSha256);assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Return_Source.GMP'));
 assert.equal(await hash(m.sourceCopy),m.sourceSha256);const origin=await json(pub.departureManifest);
 assert.equal(m.settingsProfile,origin.profile);assert.deepEqual(m.inputHashes,origin.inputHashes);
 for(const [n,h] of Object.entries(m.inputHashes)){assert.equal(await hash(join(m.settingsProfile,n)),h);assert.equal(await hash(join(m.profile,n)),h);}
 for(const n of ['originalSourceUnchanged','sourceCopyUnchanged','inputCopiesUnchanged','publicationUnchanged','originalSettingsUnchanged'])assert.equal(m[n],true);
 assert.equal(m.inputs.length,3);for(const r of m.inputs){assert.equal(r.bytes,prepared.records[r.key].bytes);assert.equal(r.sha256,prepared.records[r.key].sha256);assert.equal(await hash(r.filename),r.sha256);}
 assert.equal(m.script,join(directory,'load-hero-return.script'));assert.equal(await hash(m.script),m.scriptSha256);
 assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);const log=await readFile(m.log,'utf8');
 assert.ok(log.includes('all expectations met'));assert.ok(!/result=fail|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
 const rows=log.split('\n').filter(l=>l.startsWith('[streaming] Hero return '));assert.equal(rows.length,3);
 assert.equal(rows[0],'[streaming] Hero return stage status=00000000 complete=1 failure=0');
 const savedRow=rows[1].match(/^\[streaming\] Hero return saved hero=(\d+) agent=(\d+) guild=469 guild-agent=7 clock=25800 native-members=1 script-members=1 queued=1 task=go_home function=use_building actor-records-preserved=1 original-full-save=1 owner-published=0 travel-qualified=0 result=pass$/);assert.ok(savedRow);
 const heroId=Number(savedRow[1]),agentId=Number(savedRow[2]);assert.ok(heroId>502&&agentId>27);
 assert.equal(rows[2],'[streaming] Hero return cleanup aliases-absent=1 native-roster-empty=1 script-roster-empty=1 home-preserved=1 other-queues-preserved=1 hooks-preserved=1 result=pass');
 assert.equal(m.saves.length,2);const copied=m.saves.find(r=>r.filename===m.sourceCopy);assert.ok(copied);assert.deepEqual([copied.bytes,copied.sha256],[pub.inputs[0].bytes,pub.inputs[0].sha256]);
 const saved=m.saves.find(r=>r.filename===join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Return_Ready.GMP'));assert.ok(saved);
 assert.deepEqual(await hashNativeFile(saved.filename),{bytes:saved.bytes,sha256:saved.sha256,largestRead:4096});
 const before=await stoppedFileSource(m.source),after=await stoppedFileSource(saved.filename);
 assert.equal(await checkpointSavedClock(before),25800);assert.equal(await checkpointSavedClock(after),25800);
 const a=await typed(before),b=await typed(after);assert.equal(b.units.size,a.units.size+1);assert.equal(b.agents.size,a.agents.size+1);
 for(const [id,r] of a.units)await equal(before,r,after,b.units.get(id));
 for(const [id,r] of a.agents)if(id!==7)await equal(before,r,after,b.agents.get(id));
 for(const [key,range,id] of [['unit',b.units.get(heroId),heroId],['agent',b.agents.get(agentId),agentId]]) {
  const proposal=Buffer.from(await readFile(prepared.records[key].filename)),sourceRange=prepared.plan.ranges[key];
  for(const e of prepared.plan.edits.filter(e=>e.record===key)) {
   const at=e.offset-sourceRange.offset;
   if(e.after===100002)proposal.writeUInt32LE(heroId,at);
   else if(e.after===1002)proposal.writeUInt32LE(agentId,at);
  }
  assert.equal(range.size,proposal.length);assert.deepEqual(await after.readAt(range.offset,range.size),Uint8Array.from(proposal),key+' differs beyond actual reserved aliases');
 }
 const actor=await checkpointActorRecords(after,heroId);assert.equal(actor.unit.agentId,agentId);assert.equal(actor.agent.agentId,agentId);
 const refs=[];let context;for await(const v of checkpointAgentValues(after,agentId)){if(v.type===5)refs.push([v.attribute,v.path,v.targetAgentId]);if(v.type===8&&v.attribute==='activescript')context=v;}
 assert.deepEqual(refs,[['activescript',[1],agentId],['BackTarget',[],null],['home',[],7],
  ['leader',[],null],['palace',[],null],['target',[],7]]);assert.ok(context);
 const clockBytes=await after.readAt(context.stateOffset,16);assert.deepEqual(Array.from({length:4},(_,i)=>new DataView(clockBytes.buffer,clockBytes.byteOffset,16).getUint32(i*4,true)),[300,20850,2,0]);
 const members=[];for await(const c of checkpointContainerEntries(after))if(c.type==='member'&&((c.unitId===469&&c.targetUnitId===heroId)||(c.unitId===heroId&&c.targetUnitId===469)))members.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
 assert.deepEqual(members,[[469,100,heroId,1],[heroId,101,469,1]]);
 const guildBefore=a.agents.get(7),guildAfter=b.agents.get(7);let root;
 for await(const v of checkpointAgentValues(before,7))if(v.attribute==='members'&&!v.path.length)root=v;
 assert.ok(root);assert.equal(root.childCount,0);const input=Buffer.from(await before.readAt(guildBefore.offset,guildBefore.size)),at=root.offset-guildBefore.offset;
 const insert=Buffer.alloc(8);insert.writeUInt32LE(5,0);insert.writeUInt32LE(agentId,4);
 const expected=Buffer.concat([input.subarray(0,at+12),insert,input.subarray(at+12)]);
 expected.writeUInt32LE(input.readUInt32LE(0)+8,0);expected.writeUInt32LE(input.readUInt32LE(8)+8,8);
 expected.writeUInt32LE(input.readUInt32LE(at)+8,at);expected.writeUInt32LE(1,at+8);
 assert.equal(guildAfter.size,expected.length);assert.deepEqual(await after.readAt(guildAfter.offset,guildAfter.size),Uint8Array.from(expected));
 const q=async f=>{const out=[];for await(const r of checkpointAgentQueues(f))if(r.type==='queued-agent')out.push([r.queue,r.agentId]);return out;};
 const queues=await q(after);assert.equal(queues.filter(r=>r[1]===agentId).length,1);assert.deepEqual(queues.filter(r=>r[1]!==agentId),await q(before));
 let container;for await(const r of checkpointAttachments(after))if(r.kind==='CONT'&&r.unitId===heroId)container=r;
 assert.ok(container);const expectedContainer=Buffer.from(await readFile(prepared.records.container.filename));
 expectedContainer.writeUInt32LE(heroId,0);expectedContainer.writeUInt32LE(heroId,56);expectedContainer.writeUInt32LE(heroId,80);
 assert.equal(container.size,84);assert.deepEqual(await after.readAt(container.offset,84),Uint8Array.from(expectedContainer));
 const attachments=async f=>{const out=new Map();for await(const r of checkpointAttachments(f)){const key=r.kind+':'+r.unitId;assert.ok(!out.has(key));out.set(key,r);}return out;};
 const oldAttachments=await attachments(before),newAttachments=await attachments(after);
 assert.equal(newAttachments.size,oldAttachments.size+1);
 for(const [key,r] of oldAttachments)if(key!=='CONT:469')await equal(before,r,after,newAttachments.get(key));
 const oldGuildContainer=oldAttachments.get('CONT:469'),newGuildContainer=newAttachments.get('CONT:469');
 assert.deepEqual([oldGuildContainer.size,newGuildContainer.size],[60,68]);
 const oldGuildBytes=Buffer.from(await before.readAt(oldGuildContainer.offset,60)),newMember=Buffer.alloc(8);
 newMember.writeUInt32LE(heroId,0);newMember.writeUInt32LE(1,4);
 const guildContainerExpected=Buffer.concat([oldGuildBytes,newMember]);
 assert.equal(oldGuildBytes.readUInt32LE(48),0);
 for(const at of [8,24])guildContainerExpected.writeUInt32LE(oldGuildBytes.readUInt32LE(at)+8,at);
 guildContainerExpected.writeUInt32LE(1,48);
 assert.deepEqual(await after.readAt(newGuildContainer.offset,68),Uint8Array.from(guildContainerExpected));
 assert.equal(m.records.length,9);for(const r of m.records){assert.ok(r.filename.startsWith(join(m.profile,'Hero_Return_')));assert.ok(r.bytes<=4096);assert.deepEqual(await hashNativeFile(r.filename),{bytes:r.bytes,sha256:r.sha256,largestRead:r.bytes});}
 for(const [name,r,f] of [['Hero_Return_Agent_Observed.GPL',actor.agent,after],['Hero_Return_Guild_Before.GPL',guildBefore,before],['Hero_Return_Guild_After.GPL',guildAfter,after]]) {
  const actual=m.records.find(r=>r.filename===join(m.profile,name));assert.ok(actual);assert.equal(actual.bytes,r.size);assert.equal(actual.sha256,digest(await f.readAt(r.offset,r.size)));
 }
 assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=18);
 for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
 assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=35000);
 return {version:1,actualRegisteredHeroOriginalNativeHomeImportQualified:true,actualRegisteredHeroOriginalReciprocalRostersQualified:true,
  scope:'Actual committed remote Warrior is restored to its registered guild through original UNIT/GPL/CONT readers and fresh original IDs. One native roster, one typed script roster and one original AI queue are restored. Actor records retain prepared bytes with actual aliases;4950ms script age is preserved, all prior UNIT/GPL records remain exact apart from the one guild member append. Original full save and cleanup qualify the owned native import, not normal AI continuation, source departure, paired return publication, continuous crossing or browser travel.',
  sourceManifest:resolve(name),sourceManifestSha256:await hash(name),preparation:m.previousManifest,preparationSha256:m.previousManifestSha256,
  publication:m.publication,publicationSha256:m.publicationSha256,sourceWorld:pub.inputs[0],savedWorld:saved,
  heroId,agentId,guildId:469,guildAgentId:7,clockMs:25800,activeScriptElapsedMs:4950,
  priorTypedUnitsExact:a.units.size,priorTypedAgentsExact:a.agents.size-1,actorRecordBytes:{unit:actor.unit.size,agent:actor.agent.size,container:84},
  priorAttachmentsExact:oldAttachments.size-1,nativeGuildMemberAddedBytes:8,scriptGuildMemberAddedBytes:8,
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,nativeSymbolsSha256:build.nativeSymbolsSha256,
  maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),heroCrossingQualified:false,remoteHomeRoutingQualified:false,
  pairedReturnPublicationQualified:false,normalReturnedAiContinuationQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
 const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal native return> <fresh proof>');
 const r=await inspectNativeHeroReturn(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({actualRegisteredHeroOriginalNativeHomeImportQualified:true,actualRegisteredHeroOriginalReciprocalRostersQualified:true,heroId:r.heroId,agentId:r.agentId,browserUsed:false}));
}
