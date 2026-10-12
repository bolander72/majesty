#!/usr/bin/env node
// Independently qualify original retirement of the selected remote owner.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {inspectNativeHeroHandoff} from './inspect-native-hero-handoff.mjs';
import {checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,checkpointAgentValues,
 checkpointAgentQueues,checkpointContainerEntries,checkpointIncomingAgentReferences,checkpointInventory,
 checkpointChunks} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const digest=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function ranges(file,iterator,key){const out=new Map();for await(const r of iterator(file)){const k=key(r);assert.ok(!out.has(k));out.set(k,r);}return out;}
async function equal(a,r,b,s){assert.ok(r&&s);assert.equal(r.size,s.size);for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await a.readAt(r.offset+at,n),await b.readAt(s.offset+at,n));}}
async function records(file){return {units:await ranges(file,checkpointUnitAgentLinks,r=>r.unitId),
 agents:await ranges(file,checkpointAgents,r=>r.agentId),attachments:await ranges(file,checkpointAttachments,r=>r.kind+':'+r.unitId)};}
const queues=async file=>{const out=[];for await(const q of checkpointAgentQueues(file))if(q.type==='queued-agent')out.push([q.queue,q.agentId]);return out;};
export async function inspectNativeRemoteHeroDeparture(name) {
 const m=await json(name);assert.deepEqual([m.version,m.nativeOnly,m.browserUsed,m.phase,m.nativeSessionTerminal,m.nativeExitCode,m.remoteHeroDepartureTrialCompleted,m.stopReason],
  [1,true,false,'remote-departure',true,0,true,null]);
 const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-remote-hero-departure-');assert.equal(m.profile,join(directory,'frontier_1_0'));
 const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(build.nativeBuildQualified,true);
 assert.equal(await hash(build.log),build.logSha256);await verifyConnectedNativeArtifact(m,build);assert.ok(build.finishedAtMs<=m.startedAtMs);
 const prior=await inspectNativeHeroHandoff(m.previousManifest);assert.equal(await hash(m.previousManifest),m.previousManifestSha256);
 assert.deepEqual([prior.selectedOwner.region,prior.selectedOwner.unitId,prior.selectedOwner.agentId],['1_0',554,48]);
 assert.equal(m.source,prior.inputs[1].filename);assert.equal(m.sourceSha256,prior.inputs[1].sha256);assert.equal(await hash(m.source),m.sourceSha256);
 const pub=await json(m.previousManifest),live=await json(pub.liveManifest);assert.equal(m.liveManifest,pub.liveManifest);
 assert.equal(await hash(m.liveManifest),m.liveManifestSha256);assert.equal(m.liveManifestSha256,pub.liveManifestSha256);
 assert.equal(m.settingsProfile,live.settingsProfile);assert.deepEqual(m.inputHashes,live.inputHashes);
 for(const [n,h]of Object.entries(m.inputHashes)){assert.equal(await hash(join(m.settingsProfile,n)),h);assert.equal(await hash(join(m.profile,n)),h);}
 assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Remote_Departure_Source.GMP'));assert.equal(await hash(m.sourceCopy),m.sourceSha256);
 for(const n of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged'])assert.equal(m[n],true);
 assert.equal(m.script,join(directory,'load-remote-hero-departure.script'));assert.equal(await hash(m.script),m.scriptSha256);
 assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);const log=await readFile(m.log,'utf8');
 assert.ok(log.includes('all expectations met'));assert.ok(!/result=fail|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
 assert.deepEqual(log.split('\n').filter(l=>l.startsWith('[streaming] Remote hero departure ')),[
  '[streaming] Remote hero departure loaded hero=554 agent=48 proxy=45 clock=24250 queued=1 footprint=4 drawing=1 task=go_home function=use_building original-load=1 before-saved=1 result=pass',
  '[streaming] Remote hero departure removed hero=554 agent=48 proxy=45 clock=24250 aliases-absent=1 queue-absent=1 other-queues-preserved=1 drawing-absent=1 other-drawing-preserved=1 grid-absent=1 order-members-preserved=1 proxy-preserved=1 counters-preserved=1 hooks-preserved=1 after-saved=1 owner-published=0 travel-qualified=0 result=pass']);
 assert.equal(m.saves.length,3);const copied=m.saves.find(r=>r.filename===m.sourceCopy);assert.deepEqual(copied, {filename:m.sourceCopy,bytes:prior.inputs[1].bytes,sha256:m.sourceSha256});
 const saves={};for(const label of ['Before','After']){const r=m.saves.find(r=>r.filename===join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Remote_Departure_'+label+'.GMP'));assert.ok(r);
  assert.deepEqual(await hashNativeFile(r.filename),{bytes:r.bytes,sha256:r.sha256,largestRead:4096});saves[label]={record:r,file:await stoppedFileSource(r.filename)};}
 const source=await stoppedFileSource(m.source),before=saves.Before.file,after=saves.After.file;
 for(const f of [source,before,after])assert.equal(await checkpointSavedClock(f),24250);
 const original=await records(source),loaded=await records(before),departed=await records(after);
 for(const k of ['units','agents','attachments']){assert.deepEqual([...loaded[k].keys()],[...original[k].keys()]);for(const [id,r]of original[k])await equal(source,r,before,loaded[k].get(id));}
 assert.deepEqual([loaded.units.size,loaded.agents.size,loaded.attachments.size],[444,48,21]);
 assert.deepEqual([...departed.units.keys()],[...loaded.units.keys()].filter(id=>id!==554));
 assert.deepEqual([...departed.agents.keys()],[...loaded.agents.keys()].filter(id=>id!==48));
 assert.deepEqual([...departed.attachments.keys()],[...loaded.attachments.keys()].filter(id=>id!=='CONT:554'));
 for(const k of ['units','agents','attachments'])for(const [id,r]of departed[k])await equal(before,loaded[k].get(id),after,r);
 assert.equal(loaded.units.get(554).parentUnitId,0);assert.equal(loaded.units.get(554).agentId,48);
 const refs=await checkpointIncomingAgentReferences(before,48);assert.deepEqual(refs.sites.map(r=>[r.agentId,r.unitId,r.attribute,r.path]),[[48,554,'activescript',[1]]]);
 const task=[];for await(const v of checkpointAgentValues(before,48))if(!v.path.length&&['home','target','taskname','activescript'].includes(v.attribute))task.push(v);
 for(const n of ['home','target'])assert.equal(task.find(v=>v.attribute===n).targetAgentId,45);
 assert.equal(task.find(v=>v.attribute==='activescript').functions[0].name,'use_building');
 for(const f of [before,after])for await(const c of checkpointContainerEntries(f))if(c.type==='member')assert.notEqual(c.targetUnitId,554);
 const beforeQueues=await queues(before);assert.equal(beforeQueues.filter(q=>q[1]===48).length,1);
 assert.deepEqual(beforeQueues,await queues(source));assert.deepEqual(await queues(after),beforeQueues.filter(q=>q[1]!==48));
 for await(const a of checkpointAgents(after))for await(const v of checkpointAgentValues(after,a.agentId))if(v.type===5)assert.notEqual(v.targetAgentId,48);
 for await(const u of checkpointUnitAgentLinks(after)){assert.notEqual(u.agentId,48);assert.notEqual(u.parentUnitId,554);}
 for await(const i of checkpointInventory(after))assert.notEqual(i.ownerUnitId,554);
 const roots=async f=>{const out=[];for await(const r of checkpointChunks(f))out.push(r);return out;};
 const beforeRoots=await roots(before),afterRoots=await roots(after),unchangedRoots=[];
 // PLYR legitimately repeats for each kingdom. Preserve ordered occurrences.
 assert.deepEqual(afterRoots.map(r=>r.tag),beforeRoots.map(r=>r.tag));
 for(const [index,r]of beforeRoots.entries())if(!['VERS','SVGD','GPL ','VHCL','CONT'].includes(r.tag)) {
  const s=afterRoots[index];assert.deepEqual([s.version,s.count],[r.version,r.count]);
  await equal(before,{offset:r.offset,size:r.size+16},after,{offset:s.offset,size:s.size+16});unchangedRoots.push({index,tag:r.tag});
 }
 assert.equal(m.records.length,4);
 for(const [label,r]of [['Hero_Before.UNIT',loaded.units.get(554)],['Agent_Before.GPL',loaded.agents.get(48)],
  ['Home_Before.GPL',loaded.agents.get(45)],['Home_After.GPL',departed.agents.get(45)]]){
  const filename=join(m.profile,'Remote_Departure_'+label),record=m.records.find(r=>r.filename===filename);assert.ok(record);assert.equal(record.bytes,r.size);assert.ok(r.size<=4096);
  const h=await hashNativeFile(filename);assert.equal(h.bytes,record.bytes);assert.equal(h.sha256,record.sha256);
  assert.equal(record.sha256,digest(await (label==='Home_After.GPL'?after:before).readAt(r.offset,r.size)));
 }
 assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=18);
 for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
 assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=35000);
 return {version:1,actualSelectedRemoteHeroOriginalDepartureQualified:true,actualSelectedRemoteHeroDepartedFullSaveQualified:true,
  scope:'Fresh original load preserves every selected remote typed record and queue. Original retirement removes554/GPL48, its container, queue, drawing and grid entries at24250, preserving pure home45, all retained units/agents/attachments, other queues and unchanged gameplay roots. No paired return publication, continuous seam travel or browser qualification.',
  sourceManifest:resolve(name),sourceManifestSha256:await hash(name),publication:m.previousManifest,publicationSha256:m.previousManifestSha256,
  selectedOwner:prior.selectedOwner,selectedManifest:prior.selectedManifest,identity:prior.identity,
  sourceWorld:prior.inputs[1],beforeWorld:saves.Before.record,afterWorld:saves.After.record,
  heroId:554,agentId:48,proxyId:45,clockMs:24250,loadedTypedUnitsExact:444,loadedTypedAgentsExact:48,loadedAttachmentsExact:21,
  retainedTypedUnitsExact:departed.units.size,retainedTypedAgentsExact:departed.agents.size,retainedAttachmentsExact:departed.attachments.size,
  unchangedGameplayRoots:unchangedRoots,proxyBytesExact:departed.agents.get(45).size,
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,nativeSymbolsSha256:build.nativeSymbolsSha256,
  maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),pairedReturnPublicationQualified:false,
  heroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal remote departure> <fresh proof>');
 const r=await inspectNativeRemoteHeroDeparture(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({actualSelectedRemoteHeroOriginalDepartureQualified:true,retainedUnits:r.retainedTypedUnitsExact,retainedAgents:r.retainedTypedAgentsExact,pairedReturnPublicationQualified:false,browserUsed:false}));
}
