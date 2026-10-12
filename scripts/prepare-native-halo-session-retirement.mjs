#!/usr/bin/env node
// Read the immutable original held save; publish one bounded private request.
// The original engine removes the family. This never edits custody or a save.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnitAgentLinks,checkpointIncomingAgentReferences,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointHaloAttachedOrderProfile,checkpointHaloCompanionOrderPlan} from '../web/world/halo-companion-orders.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {verifyEntitySnapshot} from '../web/world/entity-ownership.mjs';
const[trialName]=process.argv.slice(2);assert.equal(process.argv.length,3);
const json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const hash=async n=>(await hashNativeFile(n)).sha256;
const m=await json(trialName),p=await json(m.preparation);
assert.ok(['actor-retirement','actor-paging','actor-proxy','actor-epoch','actor-arrival','actor-activation'].includes(m.mode));assert.equal(m.nativeOnly,true);assert.equal(m.browserUsed,false);assert.equal(m.ownerPublished,false);
await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-session-');assert.equal(m.root,join(m.fixture,'native-world-halo'));
assert.equal(await hash(m.preparation),m.preparationSha256);assert.deepEqual(p.selectedOwner,{entityId:p.identity.entityId,region:'0_0',unitId:p.actorCrossing.unitId,agentId:p.actorCrossing.agentId});
for(const[n,h]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(n),h);
const heldName=join(m.root,'frontier_0_0/Documents/My Games/MajestyHD/SaveGame/Halo_Session_Actor_Held_0.GMP');
const held={filename:heldName,...await hashNativeFile(heldName,{maximum:2*1024*1024})},source=await stoppedFileSource(heldName);
const clock=await checkpointSavedClock(source);assert.equal(clock,m.actorHeldRequest.clock);
const hero=p.actorCrossing.unitId,agent=p.actorCrossing.agentId,home=p.actorCrossing.guild,children=[],plans=[];
await verifyRegisteredHeroSnapshot(p.identity,{unitId:hero,agentId:agent},home,source,true,'0_0');
await verifyEntitySnapshot(p.identity,{unitId:hero,agentId:agent},source,true,home);
const units=[];for await(const u of checkpointUnitAgentLinks(source)){if(u.parentUnitId===hero){assert.ok(children.length<3);assert.equal(u.agentId,0);children.push(u.unitId);units.push(u);}}
for(const u of units){const profile=await checkpointHaloAttachedOrderProfile(source,u);assert.ok(profile);
 plans.push(await checkpointHaloCompanionOrderPlan(source,u.unitId,profile,{sourceClockMs:clock,destinationClockMs:0}));}
for await(const u of checkpointUnitAgentLinks(source))assert.ok(!children.includes(u.parentUnitId),'Nested family is not admitted');
for(const r of (await checkpointIncomingAgentReferences(source,agent)).sites)
 assert.ok(r.agentId===agent||(r.agentId===home.agentId&&r.attribute.toLowerCase()==='members'),'External script refers to retiring actor');
const physical=[],homeLinks=[];
for await(const r of checkpointContainerEntries(source))if(r.type==='member'){
 if(r.unitId===hero&&r.groupKind===1)physical.push(r.targetUnitId);
 if(r.unitId===hero&&r.groupKind===101)homeLinks.push(r.targetUnitId);
 if(r.targetUnitId===hero)assert.ok(r.unitId===home.unitId&&r.groupKind===100,'External native membership refers to retiring actor');
 if(children.includes(r.targetUnitId))assert.ok(r.unitId===hero&&r.groupKind===1,'External child membership');
}
assert.deepEqual(physical.sort((a,b)=>a-b),[...children].sort((a,b)=>a-b));assert.deepEqual(homeLinks,[home.unitId]);
assert.equal(await hash(heldName),held.sha256);
for(const[n,h]of Object.entries(p.journalSha256))assert.equal(await hash(join(p.journal,n)),h);
const idsName=join(m.root,'Halo_Session_Actor_Retire.ids'),packetName=join(m.root,'Halo_Session_Actor_Retire.txt'),reportName=join(m.fixture,'Actor_Retirement.preparation.json');
for(const name of [idsName,packetName,reportName])await assert.rejects(lstat(name),e=>e.code==='ENOENT');
const words=[0x31525348,1,clock,hero,agent,home.unitId,home.agentId,children.length,...children,...Array(3-children.length).fill(0),0],ids=Buffer.alloc(48);
words.forEach((n,i)=>ids.writeUInt32LE(n,i*4));await writeFile(idsName,ids,{flag:'wx'});
const packet=`halo-session-actor-retire-v1\n0\n0_0\n${clock}\n${held.sha256}\n${await hash(idsName)}\n`;
const sourceSha256={};for(const n of ['scripts/prepare-native-halo-session-retirement.mjs','web/world/checkpoint.mjs','web/world/halo-companion-orders.mjs','web/world/entity-home-ownership.mjs','web/world/entity-ownership.mjs','scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs'])sourceSha256[n]=await hash(n);
const report={version:1,nativeSessionRetirementPrepared:true,trial:resolve(trialName),held,clock,heroUnitId:hero,agentId:agent,home,children,
 companionPlans:plans,sourceSha256,ids:{filename:idsName,...await hashNativeFile(idsName)},packet:{filename:packetName},
 sourceUnchanged:true,actualJournalUnchanged:true,sourceRetired:false,ownerPublished:false,browserUsed:false,goalComplete:false};
await writeFile(reportName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
await writeFile(packetName+'.tmp',packet,{flag:'wx'});await rename(packetName+'.tmp',packetName);
console.log(JSON.stringify({nativeSessionRetirementPrepared:true,children,report:reportName}));
