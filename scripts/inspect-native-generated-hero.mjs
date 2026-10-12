#!/usr/bin/env node
// Read an original UI-recruited hero and its observed saved dependencies.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {stoppedFileSource,ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {inspectConnectedLoadTransforms} from './inspect-native-connected-load-transforms.mjs';
import {checkpointUnits,checkpointPlacements,checkpointActorRecords,checkpointAgents,
  checkpointAgentValues,checkpointContainerEntries,checkpointInventory,checkpointAgentQueues,
  checkpointAttachments} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from './lib/native-crossing-order-entries.mjs';

const hash=async filename=>(await hashNativeFile(filename)).sha256;
async function metadata(name){
  const info=await hashNativeFile(name,{maximum:65536});
  return {value:JSON.parse(await readFile(name,'utf8')),sha256:info.sha256};
}
const WARRIOR=0x314c5641,GUILD=0x31564241;
async function string(source,value){
  assert.equal(value.type,3);assert.ok(value.stringBytes<=128);
  const bytes=Buffer.from(await source.readAt(value.offset,value.stringBytes+1));
  assert.equal(bytes.at(-1),0);assert.ok(!bytes.subarray(0,-1).includes(0));
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,-1));
}
export async function inspectGeneratedHero(manifestName){
  const {value:m,sha256:manifestSha256}=await metadata(manifestName);
  assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.stopReason],[true,false,true,0,null]);
  assert.deepEqual([m.diagnosticHooksRequested,m.fixtureActorChangesRequested,m.initializedSourceUnchanged,m.originalSettingsUnchanged],[false,false,true,true]);
  assert.deepEqual(m.recruitAt,[150,385]);assert.ok(Number.isInteger(m.nativePid)&&m.nativePid>0);
  try{process.kill(m.nativePid,0);throw Error('Native hero producer still live');}catch(error){if(error.code!=='ESRCH')throw error;}
  const fixture=await ownedDirectory(m.fixture,'actor-arrival-fixture-generated-hero-');
  assert.equal(m.profile,join(fixture,'frontier_0_0'));assert.equal(m.script,join(fixture,'recruit-save.script'));
  const {value:origin}=await metadata(m.sourceManifest);assert.equal(await hash(m.sourceManifest),m.sourceManifestSha256);
  const init=await inspectConnectedLoadTransforms(m.sourceManifest,join(workspace,'output/native-connected-load-transforms-setter-audit.json'));
  assert.equal(init.generatedRegionInitializationQualified,true);
  assert.equal(m.initializedSource,join(origin.profile,'Residency_Visit_1_After.GMP'));
  assert.equal(await hash(m.initializedSource),m.initializedSourceSha256);
  assert.equal(await hash(join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Starting_Realm.GMP')),m.initializedSourceSha256);
  const {value:build}=await metadata(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
  assert.deepEqual(m.nativeSourceSha256,build.nativeSourceSha256);assert.equal(m.nativeExecutableSha256,build.nativeExecutableSha256);
  await verifyConnectedNativeArtifact(m,build);
  for(const[name,digest]of Object.entries(m.inputHashes)){
    assert.equal(origin.inputHashes[name],digest);assert.equal(await hash(join(origin.profile,name)),digest);assert.equal(await hash(join(m.profile,name)),digest);
  }
  assert.equal(await hash(m.script),m.scriptSha256);
  const recruitWait=m.recruitWaitMs??10000;assert.ok(Number.isInteger(recruitWait)&&recruitWait>=10000&&recruitWait<=25000);
  const script=await readFile(m.script,'utf8');assert.ok(script.includes(`move 150 385\nwait 100\nbutton left down\nwait 100\nbutton left up\nwait ${recruitWait}\n`));
  const log=await readFile(m.log,'utf8');assert.ok(log.length<1024*1024&&log.includes('all expectations met'));
  assert.ok(!/result=fail|World residency|Connected load observers|SIGSEGV|abort from|undeliverable call(?!s: none)/i.test(log));
  assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=50);
  for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
  assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=95000);
  assert.equal(m.saves.length,2);
  for(const s of m.saves){assert.ok(s.filename.startsWith(join(m.profile,'Documents/My Games/MajestyHD/SaveGame/')));assert.equal(await hash(s.filename),s.sha256);}
  const produced=m.saves.filter(s=>!s.filename.endsWith('Hero_Starting_Realm.GMP'));assert.equal(produced.length,1);
  const source=await stoppedFileSource(produced[0].filename),before=await stoppedFileSource(m.initializedSource);
  const priorIds=new Set();for await(const u of checkpointUnits(before))priorIds.add(u.primary.words[1]);
  const candidates=[];for await(const u of checkpointPlacements(source))if(u.playerNumber===0&&u.description===WARRIOR&&!priorIds.has(u.unitId))candidates.push(u);
  assert.equal(candidates.length,1,'Require one newly recruited player-zero Warrior');
  const hero=candidates[0],actor=await checkpointActorRecords(source,hero.unitId);
  assert.equal(hero.family,'VHCL');
  const outsideHome=hero.parentUnitId===0&&!hero.requiresParentPosition;
  if(outsideHome)assert.ok(hero.mapPosition&&hero.mapPosition.x>=0&&hero.mapPosition.x<4096&&hero.mapPosition.y>=0&&hero.mapPosition.y<4096);
  const agentIds=new Set();for await(const a of checkpointAgents(source)){assert.ok(!agentIds.has(a.agentId));agentIds.add(a.agentId);}
  const references=[],labels={},contexts=[];let values=0;
  for await(const v of checkpointAgentValues(source,actor.unit.agentId)){
    assert.ok(++values<=512,'Hero script value budget exceeded');
    if(v.type===3&&!v.path.length&&['type','subtype'].includes(v.attribute.toLowerCase()))labels[v.attribute.toLowerCase()]=await string(source,v);
    if(v.type===5){if(v.targetAgentId!==null)assert.ok(agentIds.has(v.targetAgentId),'Unresolved observed hero script reference');
      references.push({attribute:v.attribute,path:v.path,bits:v.bits,targetAgentId:v.targetAgentId,offset:v.offset});}
    if(v.type===8)contexts.push({attribute:v.attribute,path:v.path,flag:v.flag,functions:v.functions.map(f=>({name:f.name,slot:f.slot}))});
  }
  assert.deepEqual(labels,{subtype:'hero',type:'hero'});
  assert.ok(contexts.some(c=>c.attribute.toLowerCase()==='basicscript'&&c.functions.some(f=>f.name==='warrior_tree')),
    'Recruited Warrior has no original decision-tree context');
  const home=references.filter(r=>r.attribute.toLowerCase()==='home'&&!r.path.length);
  assert.equal(home.length,1);assert.ok(home[0].targetAgentId>0);
  let homeUnit;for await(const u of checkpointAgents(source))if(u.agentId===home[0].targetAgentId){assert.ok(!homeUnit);homeUnit=u.unitId;}
  const guild=await checkpointActorRecords(source,homeUnit);assert.equal(guild.unit.family,'BLDG');
  assert.equal(guild.unit.description,GUILD);assert.equal(guild.unit.playerNumber,hero.playerNumber);
  if(!outsideHome){assert.equal(hero.parentUnitId,homeUnit);assert.equal(hero.requiresParentPosition,true);assert.equal(hero.mapPosition,null);}
  const containers=[];for await(const c of checkpointContainerEntries(source))if(c.unitId===hero.unitId||c.targetUnitId===hero.unitId)containers.push(c);
  assert.equal(containers.filter(c=>c.type==='member'&&c.unitId===hero.unitId&&c.groupKind===101&&c.targetUnitId===homeUnit).length,1);
  assert.equal(containers.filter(c=>c.type==='member'&&c.unitId===homeUnit&&c.groupKind===100&&c.targetUnitId===hero.unitId).length,1);
  const children=[];for await(const u of checkpointUnits(source))if(u.primary.words[6]===hero.unitId)children.push({unitId:u.primary.words[1],family:u.family,description:u.primary.description,offset:u.offset,bytes:u.size});
  assert.ok(children.length<=16,'Unexpected hero attached-unit budget');
  assert.deepEqual(containers.filter(c=>c.type==='member'&&c.unitId===hero.unitId&&c.groupKind===1)
    .map(c=>c.targetUnitId).sort((a,b)=>a-b),children.map(c=>c.unitId).sort((a,b)=>a-b),
    'Attached-unit group and physical child records differ');
  for(const c of children)assert.equal(containers.filter(r=>r.type==='member'&&r.unitId===hero.unitId&&r.groupKind===1&&r.targetUnitId===c.unitId).length,1);
  const inventory=[];for await(const r of checkpointInventory(source))if(r.ownerUnitId===hero.unitId)inventory.push(r);
  const schedules=[];for await(const r of checkpointAgentQueues(source))if(r.type==='queued-agent'&&r.agentId===actor.unit.agentId)schedules.push(r);
  assert.equal(schedules.length,1,'Hero is not uniquely scheduled');
  const orders=[];for await(const r of checkpointAttachments(source))if(r.kind==='ORDR'&&r.unitId===hero.unitId)orders.push(r);
  assert.ok(orders.length<=1);const entries=[];
  if(orders.length)for await(const r of checkpointActorOrderEntries(source,hero.unitId))if(r.type==='entry')entries.push({kind:r.kind,bank:r.bank,index:r.index,offset:r.offset,bytes:r.size});
  const frames={};for(const filename of m.frames){assert.ok(filename.startsWith(join(fixture,'frames/')));frames[filename]=await hash(filename);}
  return {version:1,newLivingWarriorCaptureQualified:true,scope:'One player-zero Warrior recruited and saved through the original native UI from an independently qualified initialized kingdom. Observed typed associations are retained; complete reference closure and cross-region hero transfer remain unqualified.',
    sourceManifest:resolve(manifestName),sourceManifestSha256:manifestSha256,save:produced[0],hero,actor,home:guild,
    labels,typedScriptReferences:references,scriptContexts:contexts,containers,attachedUnits:children,inventory,schedules,orders,orderEntries:entries,
    independentlyPlacedOutsideHome:outsideHome,requiresOriginalBuildingExitBeforeTravel:!outsideHome,
    frameSha256:frames,maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),durationMs:m.finishedAtMs-m.startedAtMs,
    initializationInputsUnchanged:true,completeReferenceClosureQualified:false,heroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const[manifest,out]=process.argv.slice(2);if(process.argv.length!==4)throw Error('Usage: <terminal original recruitment manifest> <fresh report>');
  const result=await inspectGeneratedHero(manifest);await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({newLivingWarriorCaptureQualified:true,unitId:result.hero.unitId,agentId:result.actor.unit.agentId,homeUnitId:result.home.unit.unitId,attachedUnits:result.attachedUnits.length,heroCrossingQualified:false}));
}
