#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {inspectNativeHeroReturn} from './inspect-native-hero-return.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAgents,checkpointAttachments,
 checkpointAgentValues,checkpointContainerEntries,checkpointAgentQueues} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const digest=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function exact(a,b,iterator,key) {
 const map=async f=>{const out=new Map();for await(const r of iterator(f)){const k=key(r);assert.ok(!out.has(k));out.set(k,r);}return out;};
 const input=await map(a),output=await map(b);assert.deepEqual([...output.keys()],[...input.keys()]);
 for(const [id,r] of input){const s=output.get(id);assert.equal(s.size,r.size);for(let at=0;at<r.size;at+=4096){const n=Math.min(4096,r.size-at);assert.deepEqual(await a.readAt(r.offset+at,n),await b.readAt(s.offset+at,n),'Loaded record differs: '+id);}}
 return output.size;
}
export async function inspectNativeHeroReturnLive(name) {
 const m=await json(name);assert.deepEqual([m.version,m.nativeOnly,m.browserUsed,m.phase,m.nativeSessionTerminal,m.nativeExitCode,m.heroReturnLiveTrialCompleted,m.stopReason],[1,true,false,'return-live',true,0,true,null]);
 const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-return-live-');assert.equal(m.profile,join(directory,'frontier_0_0'));
 const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(build.nativeBuildQualified,true);
 assert.equal(await hash(build.log),build.logSha256);await verifyConnectedNativeArtifact(m,build);assert.ok(build.finishedAtMs<=m.startedAtMs);
 const prior=await inspectNativeHeroReturn(m.previousManifest);assert.equal(await hash(m.previousManifest),m.previousManifestSha256);
 assert.equal(m.source,prior.savedWorld.filename);assert.equal(m.sourceSha256,prior.savedWorld.sha256);assert.equal(await hash(m.source),m.sourceSha256);
 const previous=await json(m.previousManifest);assert.equal(m.settingsProfile,previous.settingsProfile);assert.deepEqual(m.inputHashes,previous.inputHashes);
 for(const [n,h] of Object.entries(m.inputHashes)){assert.equal(await hash(join(m.settingsProfile,n)),h);assert.equal(await hash(join(m.profile,n)),h);}
 assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Return_Live_Source.GMP'));assert.equal(await hash(m.sourceCopy),m.sourceSha256);
 for(const n of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged'])assert.equal(m[n],true);
 assert.equal(m.script,join(directory,'load-hero-return-live.script'));assert.equal(await hash(m.script),m.scriptSha256);
 assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);const log=await readFile(m.log,'utf8');
 assert.ok(log.includes('all expectations met'));assert.ok(!/result=fail|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
 const rows=log.split('\n').filter(l=>l.startsWith('[streaming] Hero return live '));assert.equal(rows.length,3);
 assert.equal(rows[0],'[streaming] Hero return live loaded hero=504 agent=28 guild=469 guild-agent=7 clock=25800 queued=1 footprint=4 drawing=1 local-valid=1 task=go_home function=use_building original-load=1 loaded-saved=1 result=pass');
 const validation=rows[1].match(/^\[streaming\] Hero return live validation clock=31800 agent-returned=(\d+) other-agents=(\d+) contexts=(\d+) building-returned=(\d+) commands=(\d+) moved=0 parent=469 queue-valid=1 queued=1 physical=1 cells=0 drawing-valid=1 draw-count=1 roster-valid=1 roster-count=1$/);assert.ok(validation);
 const counts=validation.slice(1).map(Number);assert.ok(counts.every(n=>n>0&&n<=65536));
 assert.equal(rows[2],`[streaming] Hero return live evolved hero=504 agent=28 guild=469 clock=31800 elapsed=6000 agent-returned=${counts[0]} other-agents=${counts[1]} contexts=${counts[2]} building-returned=${counts[3]} commands=${counts[4]} moved=0 parent=469 queued=1 rosters=1 evolved-saved=1 hooks-removed=1 gate-used=0 travel-qualified=0 result=pass`);
 assert.equal(m.saves.length,3);const copied=m.saves.find(r=>r.filename===m.sourceCopy);assert.ok(copied);assert.deepEqual([copied.bytes,copied.sha256],[prior.savedWorld.bytes,prior.savedWorld.sha256]);
 const saves={};for(const label of ['Loaded','Evolved']){const r=m.saves.find(r=>r.filename===join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Hero_Return_Live_'+label+'.GMP'));assert.ok(r);assert.deepEqual(await hashNativeFile(r.filename),{bytes:r.bytes,sha256:r.sha256,largestRead:4096});saves[label]={record:r,file:await stoppedFileSource(r.filename)};}
 const source=await stoppedFileSource(m.source),loaded=saves.Loaded.file,after=saves.Evolved.file;
 assert.equal(await checkpointSavedClock(source),25800);assert.equal(await checkpointSavedClock(loaded),25800);assert.equal(await checkpointSavedClock(after),31800);
 const loadedTypedUnitsExact=await exact(source,loaded,checkpointUnitAgentLinks,r=>r.unitId),loadedTypedAgentsExact=await exact(source,loaded,checkpointAgents,r=>r.agentId),loadedAttachmentsExact=await exact(source,loaded,checkpointAttachments,r=>r.kind+':'+r.unitId);
 const queues=async f=>{const out=[];for await(const r of checkpointAgentQueues(f))if(r.type==='queued-agent')out.push([r.queue,r.agentId]);return out;};assert.deepEqual(await queues(loaded),await queues(source));assert.equal((await queues(after)).filter(r=>r[1]===28).length,1);
 assert.equal(m.records.length,1);const record=m.records[0];assert.equal(record.filename,join(m.profile,'Hero_Return_Live_Loaded_Agent.GPL'));
 const initial=await checkpointActorRecords(loaded,504);assert.equal(record.bytes,initial.agent.size);assert.equal(record.sha256,digest(await loaded.readAt(initial.agent.offset,initial.agent.size)));assert.deepEqual(await hashNativeFile(record.filename),{bytes:record.bytes,sha256:record.sha256,largestRead:record.bytes});
 const actor=await checkpointActorRecords(after,504);assert.deepEqual([actor.unit.family,actor.unit.description,actor.unit.playerNumber,actor.unit.parentUnitId,actor.unit.stateFlags,actor.unit.agentId,actor.agent.agentId],['VHCL',0x314c5641,0,469,514,28,28]);
 const fields=new Map();for await(const v of checkpointAgentValues(after,28))if(!v.path.length&&['home','target','taskname','activescript'].includes(v.attribute.toLowerCase()))fields.set(v.attribute.toLowerCase(),v);
 for(const n of ['home','target'])assert.equal(fields.get(n).targetAgentId,7);
 assert.equal(fields.get('taskname').type,3);assert.equal(fields.get('taskname').stringBytes,0);
 const context=fields.get('activescript');assert.equal(context.type,8);assert.deepEqual(context.functions.map(f=>[f.slot,f.name]),[[0,'Rest_at_guild']]);
 const b=await after.readAt(context.stateOffset,16);assert.deepEqual(Array.from({length:4},(_,i)=>new DataView(b.buffer,b.byteOffset,16).getUint32(i*4,true)),[30000,26750,2,0]);
 const members=[];for await(const c of checkpointContainerEntries(after))if(c.type==='member'&&((c.unitId===469&&c.targetUnitId===504)||(c.unitId===504&&c.targetUnitId===469)))members.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
 assert.deepEqual(members,[[469,100,504,1],[469,2,504,1],[504,101,469,1]]);
 const roster=[];for await(const v of checkpointAgentValues(after,7))if(v.attribute==='members'&&v.type===5)roster.push(v.targetAgentId);assert.deepEqual(roster,[28]);
 assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=18);
 for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
 assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=35000);
 return {version:1,actualReturnedHeroOriginalAiContinuationQualified:true,actualReturnedHeroOriginalGuildEntryQualified:true,
  scope:'Fresh original load of actual returned504/GPL28 preserves every typed unit/agent/order/container and queue before normal AI. Original unmodified AI runs6000ms, invokes use_building and physically enters registered guild469. Actual evolved save retains native100/2, hero101 and script members, one queue and Rest_at_guild context. All three hooks are observers and removed. No full rest completion, paired return publication, continuous seam, browser gameplay or repeated resource plateau.',
  sourceManifest:resolve(name),sourceManifestSha256:await hash(name),previousManifest:m.previousManifest,previousManifestSha256:m.previousManifestSha256,
  publication:prior.publication,publicationSha256:prior.publicationSha256,sourceWorld:prior.savedWorld,loadedWorld:saves.Loaded.record,evolvedWorld:saves.Evolved.record,
  heroId:504,agentId:28,guildId:469,guildAgentId:7,startClockMs:25800,endClockMs:31800,elapsedMs:6000,
  agentReturns:counts[0],otherAgentReturns:counts[1],contextReturns:counts[2],originalBuildingReturns:counts[3],commandReturns:counts[4],parentUnitId:469,
  loadedTypedUnitsExact,loadedTypedAgentsExact,loadedAttachmentsExact,
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,nativeSymbolsSha256:build.nativeSymbolsSha256,
  maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),pairedReturnPublicationQualified:false,
  fullRestCompletionQualified:false,heroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
 const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal native returned live> <fresh proof>');
 const r=await inspectNativeHeroReturnLive(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({actualReturnedHeroOriginalAiContinuationQualified:true,actualReturnedHeroOriginalGuildEntryQualified:true,elapsedMs:6000,originalBuildingReturns:r.originalBuildingReturns,browserUsed:false}));
}
