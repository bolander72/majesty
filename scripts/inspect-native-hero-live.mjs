#!/usr/bin/env node
// A real original destination actor runs; this is not a regional owner cutover.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {inspectNativeHeroReload} from './inspect-native-hero-reload.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAgents,checkpointAgentValues,
 checkpointAgentQueues,checkpointAttachments,checkpointContainerEntries} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const digest=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function ranges(file) {
 const actor=await checkpointActorRecords(file,554);assert.equal(actor.agent.agentId,48);
 const r={unit:actor.unit,agent:actor.agent},children=[];
 for await(const u of checkpointUnitAgentLinks(file))if(u.parentUnitId===554)children.push(u);
 assert.equal(children.length,1);assert.equal(children[0].unitId,555);r.attached_503=children[0];
 for await(const a of checkpointAttachments(file)) {
  const key=a.kind==='CONT'&&a.unitId===554?'container':a.kind==='ORDR'&&a.unitId===555?'attached_order_503':null;
  if(key){assert.equal(r[key],undefined);r[key]=a;}
 }
 return r;
}
async function proxy(file) {
 let r;for await(const a of checkpointAgents(file))if(a.agentId===45){assert.equal(r,undefined);r=a;}
 assert.ok(r);assert.deepEqual([r.unitId,r.deleted,r.size],[0,false,453]);return r;
}
export async function inspectNativeHeroLive(name) {
 const m=await json(name);
 assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.heroLiveTrialCompleted,m.stopReason],
  [true,false,true,0,true,null]);assert.equal(m.phase,'live');
 const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-live-');assert.equal(m.profile,join(directory,'frontier_1_0'));
 const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);
 assert.equal(build.nativeBuildQualified,true);assert.equal(await hash(build.log),build.logSha256);
 await verifyConnectedNativeArtifact(m,build);assert.ok(build.finishedAtMs<=m.startedAtMs);
 assert.equal(await hash(m.previousManifest),m.previousManifestSha256);
 const prior=await inspectNativeHeroReload(m.previousManifest);
 assert.deepEqual([prior.originalRegisteredHeroReloadQualified,prior.originalRegisteredHeroReloadWholeSaveQualified],[true,true]);
 assert.deepEqual([prior.heroId,prior.effectId,prior.agentId,prior.proxyId,prior.clockMs],[554,555,48,45,18250]);
 assert.equal(m.source,prior.savedWorld.filename);assert.equal(m.sourceSha256,prior.savedWorld.sha256);assert.equal(await hash(m.source),m.sourceSha256);
 assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Live_Source.GMP'));
 assert.equal(await hash(m.sourceCopy),m.sourceSha256);
 for(const f of ['originalSourceUnchanged','sourceCopyUnchanged','inputCopiesUnchanged','originalSettingsUnchanged'])assert.equal(m[f],true);
 const original=await stoppedFileSource(m.source),inputNames={unit:'Hero_Live_Hero_Input.UNIT',agent:'Hero_Live_Agent_Input.GPL',
  attached_503:'Hero_Live_Effect_Input.UNIT',attached_order_503:'Hero_Live_Orders_Input.bin'};
 assert.equal(m.inputs.length,5);
 for(const [k,n] of Object.entries(inputNames)) {
  const source=prior.observations[k],r=m.inputs.find(r=>r.copied===join(m.profile,n));assert.ok(r);
  const offset=source.offset+(k==='attached_order_503'?36:0),bytes=source.bytes-(k==='attached_order_503'?36:0);
  assert.deepEqual([r.sourceOffset,r.bytes],[offset,bytes]);assert.ok(bytes<=4096);
  assert.equal(r.sha256,digest(await original.readAt(offset,bytes)));
  assert.deepEqual(await hashNativeFile(r.copied),{bytes,sha256:r.sha256,largestRead:Math.min(bytes,4096)});
 }
 const identity=m.inputs.find(r=>r.copied===join(m.profile,'Hero_Live_Identity.bin'));assert.ok(identity);
 assert.deepEqual([identity.sourceOffset,identity.bytes],[null,16]);const ids=Buffer.alloc(16);
 [554,555,48,18250].forEach((id,i)=>ids.writeUInt32LE(id,i*4));assert.deepEqual(await readFile(identity.copied),ids);assert.equal(await hash(identity.copied),identity.sha256);
 const previous=await json(m.previousManifest);assert.equal(m.settingsProfile,previous.settingsProfile);assert.deepEqual(m.inputHashes,previous.inputHashes);
 for(const [n,h] of Object.entries(m.inputHashes)){assert.equal(await hash(join(m.settingsProfile,n)),h);assert.equal(await hash(join(m.profile,n)),h);}
 assert.equal(m.script,join(directory,'load-hero-live.script'));assert.equal(await hash(m.script),m.scriptSha256);
 assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);
 const log=await readFile(m.log,'utf8');assert.ok(log.includes('all expectations met'));
 assert.ok(!/result=fail|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
 const rows=log.split('\n').filter(l=>l.startsWith('[streaming] Hero live '));assert.equal(rows.length,9);
 assert.equal(rows[0],'[streaming] Hero live loaded hero=554 effect=555 agent=48 proxy=45 clock=18250 grid=256 physical=1 footprint=4 drawing=1 draw-count=1');
 assert.equal(rows[1],'[streaming] Hero live admission-before valid=1 matches=0 marker=0 bank-valid=1 bank-owner=1 bank-count=1');
 const admitted=rows[2].match(/^\[streaming\] Hero live admission-after valid=1 matches=1 kept-before=(\d+) kept-after=(\d+) hash-same=1 marker=1$/);
 assert.ok(admitted);assert.equal(admitted[1],admitted[2]);
 assert.equal(rows[3],'[streaming] Hero live effect-admitted effect=555 original-notify=1 before=0 after=1 other-members-preserved=1 marker=1 result=pass');
 assert.equal(rows[4],'[streaming] Hero live activated hero=554 agent=48 clock=18250 physical=1 drawing=1 queued=1 other-queues-preserved=1 actor-same=1 script-same=1 ready-saved=1 owner-published=0 result=pass');
 const request=rows[5].match(/^\[streaming\] Hero live remote-request hero=554 agent=48 home=45 target=45 task=go_home function=use_building clock=(\d+) before-dead-guard=1 owner-published=0 result=pass$/);
 assert.ok(request);const requestClock=Number(request[1]);assert.ok(requestClock>18250&&requestClock<24250);
 const validation=rows[6].match(/^\[streaming\] Hero live validation clock=24250 elapsed=6000 agent-returned=(\d+) other-agents=(\d+) context-returned=(\d+) effect-commands=(\d+) queue-ok=1 queued=1 view-ok=1 home=45 physical=1 footprint=4 drawing=1 draw-count=1 effect-present=0 effect-flags=0$/);assert.ok(validation);
 const evolved=rows[7].match(/^\[streaming\] Hero live evolved hero=554 agent=48 clock=24250 elapsed=6000 agent-returned=(\d+) other-agents=(\d+) context-returned=(\d+) hero-commands=(\d+) effect-commands=(\d+) effect-absent=1 physical=1 footprint=4 drawing=1 queued=1 remote-requested=1 remote-held=(\d+) evolved-saved=1 owner-published=0 travel-qualified=0 result=pass$/);assert.ok(evolved);
 const [agentReturns,otherAgents,contextReturns,heroCommands,effectCommands,heldCalls]=evolved.slice(1).map(Number);
 assert.ok([agentReturns,otherAgents,contextReturns,heroCommands,effectCommands,heldCalls].every(n=>n>0&&n<=65536));
 assert.deepEqual(validation.slice(1).map(Number),[agentReturns,otherAgents,contextReturns,effectCommands]);
 assert.equal(rows[8],'[streaming] Hero live cleanup original-removal=1 aliases-absent=1 queue-absent=1 drawing-absent=1 proxy-preserved=1 hooks-removed=1 result=pass');
 const audit=join(workspace,'output/native-restored-order-group-instruction-audit-001.json');
 await promisify(execFile)(join(workspace,'upstream/majesty-recomp/.venv/bin/python'),[join(workspace,'scripts/audit-native-restored-order-group.py'),'--verify-report',audit],{maxBuffer:4096});
 assert.equal(m.records.length,10);
 const recordMap=new Map();
 for(const r of m.records){assert.ok(r.filename.startsWith(join(m.profile,'Hero_Live_')));assert.ok(r.bytes>0&&r.bytes<=4096);assert.ok(!recordMap.has(r.filename));recordMap.set(r.filename,r);
  assert.deepEqual(await hashNativeFile(r.filename),{bytes:r.bytes,sha256:r.sha256,largestRead:r.bytes});}
 for(const r of m.inputs){const found=recordMap.get(r.copied);assert.ok(found);assert.deepEqual([found.bytes,found.sha256],[r.bytes,r.sha256]);}
 const get=n=>{const r=recordMap.get(join(m.profile,n));assert.ok(r);return r;};
 const p=await proxy(original),originalProxy=await original.readAt(p.offset,p.size);
 for(const n of ['Hero_Live_Home_Before.GPL','Hero_Live_Home_After.GPL']){
  const r=get(n);assert.equal(r.bytes,p.size);assert.equal(r.sha256,digest(originalProxy));
 }
 const heldBefore=get('Hero_Live_Remote_Held_Before.GPL'),heldAfter=get('Hero_Live_Remote_Held_After.GPL'),agentAfter=get('Hero_Live_Agent_After.GPL');
 assert.deepEqual([heldBefore.bytes,heldBefore.sha256],[heldAfter.bytes,heldAfter.sha256]);assert.deepEqual([agentAfter.bytes,agentAfter.sha256],[heldAfter.bytes,heldAfter.sha256]);
 assert.equal(m.saves.length,3);const sourceCopy=m.saves.find(r=>r.filename===m.sourceCopy);assert.ok(sourceCopy);
 assert.deepEqual([sourceCopy.bytes,sourceCopy.sha256],[prior.savedWorld.bytes,prior.savedWorld.sha256]);
 const saves={};
 for(const label of ['Ready','Evolved']) {
  const r=m.saves.find(r=>r.filename===join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Live_'+label+'.GMP'));assert.ok(r);
  assert.deepEqual(await hashNativeFile(r.filename),{bytes:r.bytes,sha256:r.sha256,largestRead:4096});saves[label]={record:r,file:await stoppedFileSource(r.filename)};
 }
 const ready=saves.Ready.file,after=saves.Evolved.file;
 assert.equal(await checkpointSavedClock(ready),18250);assert.equal(await checkpointSavedClock(after),24250);
 const readyRanges=await ranges(ready);assert.deepEqual(Object.keys(readyRanges).sort(),Object.keys(prior.observations).sort());
 for(const [k,r] of Object.entries(readyRanges)){const expected=prior.observations[k];assert.equal(r.size,expected.bytes);assert.deepEqual(await ready.readAt(r.offset,r.size),await original.readAt(expected.offset,expected.bytes),'Ready actor record differs: '+k);}
 const actor=await checkpointActorRecords(after,554);assert.deepEqual([actor.unit.family,actor.unit.description,actor.unit.agentId,actor.unit.parentUnitId,actor.unit.stateFlags,actor.agent.agentId],['VHCL',0x314c5641,48,0,512,48]);
 assert.equal(actor.agent.size,agentAfter.bytes);assert.equal(digest(await after.readAt(actor.agent.offset,actor.agent.size)),agentAfter.sha256);
 const fields=new Map();for await(const v of checkpointAgentValues(after,48))if(!v.path.length&&['home','target','taskname','activescript'].includes(v.attribute.toLowerCase())){assert.ok(!fields.has(v.attribute.toLowerCase()));fields.set(v.attribute.toLowerCase(),v);}
 for(const n of ['home','target']){assert.equal(fields.get(n)?.type,5);assert.equal(fields.get(n)?.targetAgentId,45);}
 const task=fields.get('taskname');assert.equal(task?.type,3);assert.equal(task.stringBytes,7);assert.equal(new TextDecoder().decode(await after.readAt(task.offset,7)),'go_home');
 const active=fields.get('activescript');assert.equal(active?.type,8);assert.deepEqual(active.functions.map(f=>[f.slot,f.name]),[[0,'use_building']]);
 for(const f of [ready,after]) {
  const q=[];for await(const row of checkpointAgentQueues(f))if([45,48].includes(row.agentId))q.push(row.agentId);assert.deepEqual(q,[48]);
  const home=await proxy(f);assert.deepEqual(await f.readAt(home.offset,home.size),originalProxy);
 }
 let afterUnits=0;for await(const u of checkpointUnitAgentLinks(after)){assert.notEqual(u.unitId,555);assert.notEqual(u.parentUnitId,554);assert.notEqual(u.agentId,45);afterUnits++;}
 for await(const a of checkpointAttachments(after))assert.ok(!(a.kind==='ORDR'&&a.unitId===555));
 for await(const c of checkpointContainerEntries(after))if(c.unitId===554&&c.type==='member')assert.ok(![1,101].includes(c.groupKind));
 assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=18);assert.equal(m.rssCeilingBytes,512*1024*1024);
 for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
 assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=35000);
 return {version:1,originalRegisteredHeroLiveReloadQualified:true,originalRegisteredHeroLoadedFootprintQualified:true,
  originalRestoredEffectCommandAdmissionQualified:true,originalRegisteredRemoteHomeRequestGateQualified:true,
  scope:'Fresh original destination load of the actual registered Warrior is spatially/render linked, admitted to one original AI queue and runs for6000ms. Restored recruit commands enter the original ORDR group via native notification; original normal ticks finish and remove the effect. Real go_home/use_building is caught before the pure-home dead guard; complete settled GPL stays identical while other agents run. Original ready/evolved full saves and cleanup qualify this native lifecycle, not source departure, selected owner publication, remote return routing, continuous travel, multiplayer or browser resources.',
  sourceManifest:resolve(name),sourceManifestSha256:await hash(name),previousManifest:m.previousManifest,previousManifestSha256:m.previousManifestSha256,
  sourceWorld:prior.savedWorld,readyWorld:saves.Ready.record,evolvedWorld:saves.Evolved.record,heroId:554,effectId:555,agentId:48,proxyId:45,
  startClockMs:18250,endClockMs:24250,requestClockMs:requestClock,elapsedMs:6000,agentReturns,otherAgents,contextReturns,heroCommands,effectCommands,heldCalls,afterTypedUnits:afterUnits,
  heldAgent:heldAfter,instructionAudit:audit,instructionAuditSha256:await hash(audit),
  selectedOwnerUnchanged:prior.selectedOwnerUnchanged,selectedOwner:prior.selectedOwner,selectedOwnerManifest:prior.selectedOwnerManifest,
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,nativeSymbolsSha256:build.nativeSymbolsSha256,
  maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),nativeProcessTerminal:true,
  heroCrossingQualified:false,ownerPublicationQualified:false,remoteHomeRoutingQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [manifest,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal live manifest> <fresh proof>');
 const r=await inspectNativeHeroLive(manifest);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({originalRegisteredHeroLiveReloadQualified:true,originalRestoredEffectCommandAdmissionQualified:true,
  originalRegisteredRemoteHomeRequestGateQualified:true,elapsedMs:r.elapsedMs,heroCrossingQualified:false,browserUsed:false}));
}
