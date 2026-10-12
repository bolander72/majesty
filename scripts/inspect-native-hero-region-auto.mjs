#!/usr/bin/env node
// Independent actual saved-state comparison after one-process kingdom visits.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {connectedWorldState,compareConnectedWorlds,connectedResidencyCycles} from './lib/connected-residency.mjs';
import {parseAutoRegionLoads} from './lib/auto-region-load.mjs';
import {idleTileReleaseCycles,idleTileCandidateGates} from './lib/idle-tile-release.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
import {checkpointActorRecords,checkpointAgentValues,checkpointAbsentAgentReferences} from '../web/world/checkpoint.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
async function residence(filename){
 const f=await stoppedFileSource(filename),a=await checkpointActorRecords(f,504);
 assert.deepEqual([a.unit.agentId,a.unit.parentUnitId,a.unit.description,a.unit.stateFlags],[28,469,0x314c5641,514]);
 const fields=new Map();for await(const v of checkpointAgentValues(f,28))if(!v.path.length&&['home','target','taskname','activescript'].includes(v.attribute))fields.set(v.attribute,v);
 assert.equal(fields.get('home').targetAgentId,7);assert.equal(fields.get('target').targetAgentId,7);assert.equal(fields.get('taskname').stringBytes,0);
 const context=fields.get('activescript');assert.equal(context.type,8);assert.deepEqual(context.functions.map(v=>[v.slot,v.name]),[[0,'Rest_at_guild']]);
 const bytes=await f.readAt(context.stateOffset,16),view=new DataView(bytes.buffer,bytes.byteOffset,16);
 assert.deepEqual(Array.from({length:4},(_,i)=>view.getUint32(i*4,true)),[30000,26750,2,0]);
}
export async function inspectNativeHeroRegionAuto(name){
 name=resolve(name);const m=await json(name);
 assert.deepEqual([m.version,m.phase,m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.stopReason],[1,'hero-region-auto',true,false,true,0,null]);
 assert.ok(Number.isInteger(m.nativePid)&&m.nativePid>0);
 try{process.kill(m.nativePid,0);throw Error('Native process is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
 const dir=await ownedDirectory(m.fixture,'actor-arrival-fixture-connected-residency-');assert.equal(m.profile,join(dir,'frontier_0_0'));
 assert.deepEqual(m.loadSequence,[0,1,0,1]);assert.deepEqual(m.completedTicksByVisit,[20,20,20,20]);
 assert.ok(m.idleTileReleaseVersion==null||['v1','v2'].includes(m.idleTileReleaseVersion));
 const releasing=m.idleTileReleaseVersion!=null,afterExit=m.idleTileReleaseVersion==='v2';
 assert.ok(m.idleTileGateVersion==null||m.idleTileGateVersion===1);
 if(m.idleTileGateVersion===1)assert.ok(afterExit);
 if(releasing){const audit=await json(m.idleTileReleaseAudit);assert.equal(await hash(m.idleTileReleaseAudit),m.idleTileReleaseAuditSha256);
  assert.equal(audit.qualified,true);assert.equal(audit.originalExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  assert.equal(await hash(resolve(afterExit?'scripts/audit-native-idle-tile-array-release.py':'scripts/audit-native-idle-tile-release.py')),audit.scriptSha256);
  assert.equal(Object.keys(audit.fragments).length,afterExit?6:5);assert.equal(audit.contradictoryInstructionControls.length,afterExit?6:5);}
 assert.deepEqual([m.automaticRegionLoadVersion,m.inputActions,m.smokeSeconds],['v1',0,40]);
 const receipt=await json(m.receipt),publication=await json(m.publicationManifest);
 assert.equal(await hash(m.receipt),m.receiptSha256);assert.equal(await hash(m.publicationManifest),m.publicationManifestSha256);
 assert.equal(receipt.revisionReport,m.publicationManifest);assert.equal(receipt.revisionReportSha256,m.publicationManifestSha256);
 assert.equal(receipt.state.revision,2);assert.equal(receipt.state.ownerSide,0);assert.equal(receipt.owner.region,'0_0');
 const selected=[];for(let side=0;side<2;side++)selected.push(await verifyRevisionExport(m.receipt,side,receipt.worlds[side].sha256));
 assert.deepEqual(m.selectedRevisionExports,selected);
 assert.deepEqual(m.previousManifests,[publication.liveManifest,publication.departureManifest]);
 assert.deepEqual(m.previousManifestSha256,[publication.liveManifestSha256,publication.departureManifestSha256]);
 const producers=[];for(let i=0;i<2;i++){assert.equal(await hash(m.previousManifests[i]),m.previousManifestSha256[i]);producers.push(await json(m.previousManifests[i]));}
 assert.equal(m.settingsProfile,producers[0].profile);assert.deepEqual(m.inputHashes,producers[0].inputHashes);assert.deepEqual(m.inputHashes,producers[1].inputHashes);
 for(const[n,h]of Object.entries(m.inputHashes)){assert.equal(await hash(join(m.settingsProfile,n)),h);assert.equal(await hash(join(m.profile,n)),h);}
 for(const flag of ['originalSettingsUnchanged','originalSelectedWorldsUnchanged','publicationUnchanged','receiptUnchanged'])assert.equal(m[flag],true);
 const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);
 assert.deepEqual([build.nativeBuildQualified,build.exitCode,build.command],[true,0,'.venv/bin/python tools/build.py --target smoke --jobs 1']);
 assert.equal(await hash(build.log),build.logSha256);assert.ok(build.finishedAtMs<=m.startedAtMs);
 assert.equal(m.nativeExecutableSha256,build.nativeExecutableSha256);assert.deepEqual(m.nativeSourceSha256,build.nativeSourceSha256);assert.equal(m.nativeSymbolsSha256,build.nativeSymbolsSha256);
 await verifyConnectedNativeArtifact(m,build);
 assert.equal(m.script,join(dir,'hero-region-auto.script'));assert.equal(await hash(m.script),m.scriptSha256);
 assert.equal(await readFile(m.script,'utf8'),'wait 30000\ndump automatic_region_return_completed\n');
 assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);const log=await readFile(m.log,'utf8');
 assert.ok(!/result=fail|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
 const state=(filename,side)=>connectedWorldState(filename,{unscheduledAgents:side?[45]:[]});
 const initial=[];for(let side=0;side<2;side++){
  const s=await state(join(m.profile,`Residency_Initial_${side}.GMP`),side);assert.equal(s.sha256,selected[side].sha256);assert.equal(s.bytes,selected[side].bytes);
  assert.equal(await hash(selected[side].filename),selected[side].sha256);initial.push(s);
 }
 assert.deepEqual(initial.map(s=>s.clock),[31800,24250]);assert.deepEqual(initial.map(s=>s.counts),[{units:448,agents:27,attachments:28},{units:443,agents:47,attachments:20}]);
 const visits=[],comparisons=[],releaseStates=[],latest=[...initial];
 const owner=async pair=>verifyEntityOwnership(receipt.identity,receipt.state.aliases,receipt.state.referenceBindings,
  await Promise.all(pair.map(async s=>({source:await stoppedFileSource(s.filename)}))),0,receipt.state.homeAliases);
 await owner(initial);
 for(let i=0;i<4;i++){
  const side=i%2,before=await state(join(m.profile,`Residency_Visit_${i}_Before.GMP`),side),after=await state(join(m.profile,`Residency_Visit_${i}_After.GMP`),side);
  assert.equal(before.label,'Joint_Departed_Reload');assert.equal(after.label,'Joint_Evolved');
  comparisons.push({visit:i,region:side?'1_0':'0_0',...compareConnectedWorlds(latest[side],before)});
  for(const s of [before,after]){
   latest[side]=s;await owner(latest);
   if(!side){await residence(s.filename);assert.equal(s.queues.flat().filter(id=>id===28).length,1);}
   else{assert.ok(!s.records.units[554]&&!s.records.units[555]&&!s.records.agents[48]);assert.equal(s.queues.flat().filter(id=>id===45||id===48).length,0);
    assert.deepEqual(s.records.agents[45],initial[1].records.agents[45]);assert.equal((await checkpointAbsentAgentReferences(await stoppedFileSource(s.filename),48)).sites.length,0);}
  }
  visits.push({before,after});
  if(releasing&&!afterExit){
   const released=await state(join(m.profile,`Residency_Visit_${i}_PostRelease.GMP`),side);
   compareConnectedWorlds(after,released);assert.equal(released.rawTerrainSha256,after.rawTerrainSha256);
   const pair=[...latest];pair[side]=released;await owner(pair);releaseStates.push(released);
  }
 }
 const cycles=connectedResidencyCycles(log,visits,{startSide:0});
 for(let side=0;side<2;side++)assert.equal(await hash(join(m.profile,`Residency_Source_${side}.GMP`)),latest[side].sha256);
 assert.equal(await hash(join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP')),visits[1].after.sha256);
 assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=24);
 let previous=m.startedAtMs;for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);assert.ok(s.sampledAtMs>=previous&&s.sampledAtMs<=m.finishedAtMs&&s.sampledAtMs-previous<=4000);previous=s.sampledAtMs;}
 assert.ok(m.finishedAtMs-previous<=4000);assert.ok(m.finishedAtMs-m.startedAtMs<=45000);
 const idleTileRelease=releasing?idleTileReleaseCycles(log,4,{afterExit}):null;
 const idleTileGates=m.idleTileGateVersion===1?idleTileCandidateGates(log,idleTileRelease):null;
 const automaticLoads=parseAutoRegionLoads(log,cycles);
 assert.equal(await hash('scripts/run-native-hero-region-auto.py'),m.runnerSha256);
 const compact=({records,...s})=>s;
 return {version:1,actualRegisteredHeroSameProcessRegionReturnQualified:true,sourceManifest:name,sourceManifestSha256:await hash(name),
  scope:'One native process automatically visits committed home, remote, home, remote. Original saves publish latest regional state; original dispatcher unloads each kingdom before the next original load. Every initial/warm saved state, keyed entity, attachment, queue, clock and both RNGs restores exactly apart from previously audited save metadata, terrain shading cache and identical ORDR serialization permutations. Registered hero504/GPL28 remains inside469/GPL7 with original rest context and unique ownership; remote554/GPL48 stays absent and pure45 stays inert. Each visit advances20 original ticks. The native trial invokes the existing original named-loader at the disposed-world front-end boundary, without input or menu selection. This is automatic lifecycle routing, not spatial hero crossing or browser integration.',
  receipt:m.receipt,receiptSha256:m.receiptSha256,publication:m.publicationManifest,publicationSha256:m.publicationManifestSha256,
  loadSequence:['0_0','1_0','0_0','1_0'],comparisons,cycles,automaticLoads,automaticOriginalRegionLifecycleQualified:true,inputActions:0,visits:visits.map(v=>({before:compact(v.before),after:compact(v.after)})),
  idleTileRelease,idleTileGates,postReleaseStates:releaseStates.map(compact),actualOriginalIdleTileBufferReleaseQualified:releasing&&idleTileRelease.some(s=>s.freed>0),
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,nativeSymbolsSha256:m.nativeSymbolsSha256,
  maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),durationMs:m.finishedAtMs-m.startedAtMs,
  continuousTravelQualified:false,heroCrossingQualified:false,sustainedNativeMemoryBoundQualified:false,browserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal travel manifest> <fresh proof>');
 const r=await inspectNativeHeroRegionAuto(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({actualRegisteredHeroSameProcessRegionReturnQualified:true,cycles:r.cycles.length,maximumSampledRssBytes:r.maximumSampledRssBytes,
  actualOriginalIdleTileBufferReleaseQualified:r.actualOriginalIdleTileBufferReleaseQualified,idleTileRelease:r.idleTileRelease,heroCrossingQualified:false,browserUsed:false}));
}
