#!/usr/bin/env node
// Independent actual saved-state comparison after one-process kingdom visits.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {requestedResidencyCycles} from './lib/requested-region-cycles.mjs';
import {parseMultiwayCoordinateTravel} from './lib/multiway-coordinate-travel.mjs';
import {verifyConnectedInitialization} from './check-native-connected-initialization.mjs';
import {parseAutoMultiwayLoads} from './lib/auto-multiway-region-load.mjs';
import {idleTileReleaseCycles,idleTileCandidateGates} from './lib/idle-tile-release.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
import {checkpointActorRecords,checkpointAgentValues,checkpointAbsentAgentReferences} from '../web/world/checkpoint.mjs';
import {parseRealmManifest} from '../web/world/realm-store.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const hashText=text=>createHash('sha256').update(text).digest('hex');
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
export async function inspectNativeCoordinateMultiway(name){
 name=resolve(name);const m=await json(name);
 assert.deepEqual([m.version,m.phase,m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.stopReason],[1,'coordinate-multiway',true,false,true,0,null]);
 assert.ok(Number.isInteger(m.nativePid)&&m.nativePid>0);
 try{process.kill(m.nativePid,0);throw Error('Native process is still live');}catch(e){if(e.code!=='ESRCH')throw e;}
 const dir=await ownedDirectory(m.fixture,'actor-arrival-fixture-connected-residency-');assert.equal(m.profile,join(dir,'frontier_0_0'));
 const four=!!m.fourthRegionInput,visitCount=four?8:6;
 const route=four?['0_0','0_-1','0_0','0_1','0_0','1_0','0_0','0_-1']:['0_0','0_1','0_0','1_0','0_0','0_1'];
 assert.deepEqual(m.loadSequence,four?[0,3,0,2,0,1,0,3]:[0,2,0,1,0,2]);assert.equal(m.regionRequestVersion,'v2');assert.equal(m.completedTicksByVisit.length,visitCount);assert.ok(m.completedTicksByVisit.every(n=>Number.isInteger(n)&&n>20&&n<=200));
 assert.ok(m.idleTileReleaseVersion==null||['v1','v2'].includes(m.idleTileReleaseVersion));
 const releasing=m.idleTileReleaseVersion!=null,afterExit=m.idleTileReleaseVersion==='v2';
 assert.ok(m.idleTileGateVersion==null||m.idleTileGateVersion===1);
 if(m.idleTileGateVersion===1)assert.ok(afterExit);
 if(releasing){const audit=await json(m.idleTileReleaseAudit);assert.equal(await hash(m.idleTileReleaseAudit),m.idleTileReleaseAuditSha256);
  assert.equal(audit.qualified,true);assert.equal(audit.originalExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  assert.equal(await hash(resolve(afterExit?'scripts/audit-native-idle-tile-array-release.py':'scripts/audit-native-idle-tile-release.py')),audit.scriptSha256);
  assert.equal(Object.keys(audit.fragments).length,afterExit?6:5);assert.equal(audit.contradictoryInstructionControls.length,afterExit?6:5);}
 assert.deepEqual([m.automaticRegionLoadVersion,m.inputActions,m.smokeSeconds],['v1',0,four?55:45]);
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
 const thirdProof=await json(m.thirdInitializationProof);assert.equal(await hash(m.thirdInitializationProof),m.thirdInitializationProofSha256);
 assert.deepEqual(await verifyConnectedInitialization(thirdProof.sourceManifest),thirdProof);
 assert.equal(thirdProof.generatedNeighborInitializationQualified,true);assert.equal(thirdProof.initializedRegionsReturnedWithoutStateChanges,true);
 assert.equal(thirdProof.cycles[2].region,'0_1');assert.deepEqual(m.thirdRegionInput,thirdProof.visits[2].after);
 assert.equal(m.originalThirdKingdomUnchanged,true);assert.equal(m.thirdInitializationProofUnchanged,true);
 assert.equal(await hash(m.thirdRegionInput.filename),m.thirdRegionInput.sha256);
 if(four){
  const north=await json(m.fourthInitializationProof);assert.equal(await hash(m.fourthInitializationProof),m.fourthInitializationProofSha256);
  assert.deepEqual(await verifyConnectedInitialization(north.sourceManifest),north);
  assert.equal(north.generatedNeighborInitializationQualified,true);assert.equal(north.initializedRegionsReturnedWithoutStateChanges,true);
  assert.equal(north.cycles[2].region,'0_-1');assert.deepEqual(m.fourthRegionInput,north.visits[2].after);
  assert.equal(m.originalFourthKingdomUnchanged,true);assert.equal(m.fourthInitializationProofUnchanged,true);
  assert.equal(await hash(m.fourthRegionInput.filename),m.fourthRegionInput.sha256);
 }
 const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);
 assert.deepEqual([build.nativeBuildQualified,build.exitCode,build.command],[true,0,'.venv/bin/python tools/build.py --target smoke --jobs 1']);
 assert.equal(await hash(build.log),build.logSha256);assert.ok(build.finishedAtMs<=m.startedAtMs);
 assert.equal(m.nativeExecutableSha256,build.nativeExecutableSha256);assert.deepEqual(m.nativeSourceSha256,build.nativeSourceSha256);assert.equal(m.nativeSymbolsSha256,build.nativeSymbolsSha256);
 await verifyConnectedNativeArtifact(m,build);
 assert.equal(m.script,join(dir,'coordinate-multiway.script'));assert.equal(await hash(m.script),m.scriptSha256);
 assert.equal(await readFile(m.script,'utf8'),`wait ${four?45000:35000}\ndump coordinate_multiway_completed\n`);
 assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=(four?2:1)*1024*1024);const log=await readFile(m.log,'utf8');
 assert.ok(!/result=fail|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
 const state=(filename,side)=>connectedWorldState(filename,{unscheduledAgents:side===1?[45]:[]});
 const initial=[];for(let side=0;side<2;side++){
  const s=await state(join(m.profile,`Residency_Initial_${side}.GMP`),side);assert.equal(s.sha256,selected[side].sha256);assert.equal(s.bytes,selected[side].bytes);
  assert.equal(await hash(selected[side].filename),selected[side].sha256);initial.push(s);
 }
 assert.deepEqual(initial.map(s=>s.clock),[31800,24250]);assert.deepEqual(initial.map(s=>s.counts),[{units:448,agents:27,attachments:28},{units:443,agents:47,attachments:20}]);
 const third=await state(join(m.profile,'Residency_Initial_0_1.GMP'),2);
 assert.equal(third.sha256,m.thirdRegionInput.sha256);assert.equal(third.bytes,m.thirdRegionInput.bytes);assert.equal(third.clock,10000);
 initial.push(third);
 if(four){
  const north=await state(join(m.profile,'Residency_Initial_0_-1.GMP'),3);
  assert.equal(north.sha256,m.fourthRegionInput.sha256);assert.equal(north.bytes,m.fourthRegionInput.bytes);assert.equal(north.clock,10000);initial.push(north);
 }
 assert.deepEqual(m.coordinateRoute,route);
 const visits=[],comparisons=[],releaseStates=[],latest=[...initial];
 const owner=async pair=>verifyEntityOwnership(receipt.identity,receipt.state.aliases,receipt.state.referenceBindings,
  await Promise.all(pair.slice(0,2).map(async s=>({source:await stoppedFileSource(s.filename)}))),0,receipt.state.homeAliases);
 await owner(initial);
 for(let i=0;i<visitCount;i++){
  const side=m.loadSequence[i],before=await state(join(m.profile,`Residency_Visit_${i}_Before.GMP`),side),after=await state(join(m.profile,`Residency_Visit_${i}_After.GMP`),side);
  assert.equal(before.label,'Joint_Departed_Reload');assert.equal(after.label,'Joint_Evolved');
  comparisons.push({visit:i,region:route[i],...compareConnectedWorlds(latest[side],before)});
  for(const s of [before,after]){
   latest[side]=s;await owner(latest);
   if(!side){await residence(s.filename);assert.equal(s.queues.flat().filter(id=>id===28).length,1);}
   else if(side===1){assert.ok(!s.records.units[554]&&!s.records.units[555]&&!s.records.agents[48]);assert.equal(s.queues.flat().filter(id=>id===45||id===48).length,0);
    assert.deepEqual(s.records.agents[45],initial[1].records.agents[45]);assert.equal((await checkpointAbsentAgentReferences(await stoppedFileSource(s.filename),48)).sites.length,0);}
  }
  visits.push({before,after});
  if(releasing&&!afterExit){
   const released=await state(join(m.profile,`Residency_Visit_${i}_PostRelease.GMP`),side);
   compareConnectedWorlds(after,released);assert.equal(released.rawTerrainSha256,after.rawTerrainSha256);
   const pair=[...latest];pair[side]=released;await owner(pair);releaseStates.push(released);
  }
 }
 const cycles=requestedResidencyCycles(log,visits,{startSide:0}).map((c,i)=>({...c,region:route[i]}));
 const coordinateKeys=four?['0_0','1_0','0_1','0_-1']:['0_0','1_0','0_1'];
 const coordinateCheckpoints=[];
 if(m.coordinateCheckpointVersion!==undefined){
  assert.equal(m.coordinateCheckpointVersion,'v1');assert.equal(m.coordinateCheckpointContent,'coordinate-v1:'+m.nativeExecutableSha256);
  assert.deepEqual(m.initialCoordinateCheckpoints.map(r=>r.region),coordinateKeys);
  const slots=new Map(coordinateKeys.map(key=>[key,0]));
  const expectedFiles=new Map(coordinateKeys.map((key,i)=>[key,[initial[i],null]]));
  for(const [side,key]of coordinateKeys.entries()){
   const initialRecord=m.initialCoordinateCheckpoints[side];
   assert.equal(hashText(initialRecord.manifest),initialRecord.manifestSha256);
   const record=parseRealmManifest(initialRecord.manifest,m.coordinateCheckpointContent);
   assert.deepEqual([record.slot,record.size,record.sha256],[0,initial[side].bytes,initial[side].sha256]);
  }
  const rows=[...log.matchAll(/^\[streaming\] World coordinate-checkpoint visit=(\d+) region=(-?\d+_-?\d+) slot=([01]) bytes=(\d+) digest=([a-f0-9]{64}) published=1 result=pass$/gm)];
  assert.equal(rows.length,visitCount);assert.equal((log.match(/^\[streaming\] World coordinate-checkpoint /gm)||[]).length,visitCount);
  for(let visit=0;visit<visitCount;++visit){
   const row=rows[visit],key=route[visit],slot=1-slots.get(key);slots.set(key,slot);
   expectedFiles.get(key)[slot]=visits[visit].after;
   assert.deepEqual([Number(row[1]),row[2],Number(row[3]),Number(row[4]),row[5]],
    [visit,key,slot,visits[visit].after.bytes,visits[visit].after.sha256]);
   assert.ok(log.indexOf(`[streaming] World coordinate-request accepted visit=${visit} `)<row.index);
   assert.ok(row.index<log.indexOf(`[streaming] World coordinate-snapshot visit=${visit} region=${key} stage=after `));
   coordinateCheckpoints.push({visit,region:key,slot,bytes:Number(row[4]),sha256:row[5]});
  }
  for(const [side,key]of coordinateKeys.entries()){
   const marker=join(m.profile,`Residency_Region_${key}.checkpoint`);assert.ok((await stat(marker)).size<512);
   const record=parseRealmManifest(await readFile(marker,'utf8'),m.coordinateCheckpointContent);
   assert.deepEqual([record.slot,record.size,record.sha256],[slots.get(key),latest[side].bytes,latest[side].sha256]);
   assert.equal(await hash(join(m.profile,`Residency_Region_${key}${record.slot?'_Recovery':''}.GMP`)),latest[side].sha256);
   for(const [slot,expected]of expectedFiles.get(key).entries()){
    assert.ok(expected,'Every supplied coordinate must be visited');
    const filename=join(m.profile,`Residency_Region_${key}${slot?'_Recovery':''}.GMP`);
    assert.equal((await stat(filename)).size,expected.bytes);assert.equal(await hash(filename),expected.sha256);
   }
  }
 }else{
  assert.equal((log.match(/^\[streaming\] World coordinate-checkpoint /gm)||[]).length,0);
  for(const [side,key]of coordinateKeys.entries())assert.equal(await hash(join(m.profile,`Residency_Region_${key}.GMP`)),latest[side].sha256);
 }
 assert.equal(await hash(join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP')),visits[1].after.sha256);
 assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=(four?33:27));
 let previous=m.startedAtMs;for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);assert.ok(s.sampledAtMs>=previous&&s.sampledAtMs<=m.finishedAtMs&&s.sampledAtMs-previous<=4000);previous=s.sampledAtMs;}
 assert.ok(m.finishedAtMs-previous<=4000);assert.ok(m.finishedAtMs-m.startedAtMs<=(four?60000:50000));
 const idleTileRelease=releasing?idleTileReleaseCycles(log,4,{afterExit}):null;
 const idleTileGates=m.idleTileGateVersion===1?idleTileCandidateGates(log,idleTileRelease):null;
 const automaticLoads=parseAutoMultiwayLoads(log,cycles),travelRequests=parseMultiwayCoordinateTravel(log,cycles,m);
 let checkpointFaultProbe=null;
 if(m.checkpointFaultProbe){
  const f=m.checkpointFaultProbe;assert.equal(m.coordinateCheckpointVersion,'v1');assert.ok(four);
  assert.deepEqual([f.region,f.inactiveRegion,f.initialInactiveBytes,f.changedOffset,f.changedXor,f.published,f.trailingRefusalObserved,f.observedRefusal,f.repaired],
   ['0_1','0_-1',0,272,1,true,true,true,true]);
  assert.equal(f.inactiveFile,join(m.profile,'Residency_Region_0_-1_Recovery.GMP'));
  assert.equal(f.original,join(m.profile,'Residency_Initial_0_1.GMP'));assert.equal(f.originalSha256,initial[2].sha256);
  assert.equal(f.damaged,join(m.profile,'Coordinate_Damaged_0_1.GMP'));assert.equal(await hash(f.damaged),f.damagedSha256);
  const original=await stoppedFileSource(f.original),damaged=await stoppedFileSource(f.damaged);assert.equal(damaged.size,original.size);
  for(let at=0;at<original.size;at+=4096){
   const n=Math.min(4096,original.size-at),expected=new Uint8Array(await original.readAt(at,n));
   if(at<=272&&272<at+n)expected[272-at]^=1;
   assert.deepEqual(new Uint8Array(await damaged.readAt(at,n)),expected);
  }
  assert.notEqual(f.damagedSha256,f.originalSha256);
  const publication=m.requestPublications.find(r=>r.kind==='damaged-neighbor'),firstTravel=m.requestPublications.find(r=>r.kind==='travel');
  assert.ok(publication&&firstTravel);assert.ok(f.publishedAtMs>=publication.publishedAtMs);
  assert.ok(f.repairedAtMs>=f.publishedAtMs&&f.repairedAtMs<=firstTravel.publishedAtMs);
  assert.ok(publication.publishedAtMs-m.readyPublications[0].observedAtMs>=1400);
  checkpointFaultProbe={damagedNeighborRefusedBeforeUnload:true,emptyInactiveSlotDidNotReplaceCommittedSave:true,
   source:f.original,sourceSha256:f.originalSha256,damaged:f.damaged,damagedSha256:f.damagedSha256,
   changedOffset:272,changedXor:1,copyReadBound:4096,concurrentFilesystemMutationQualified:false};
 }
 assert.equal(await hash('scripts/run-native-coordinate-multiway.py'),m.runnerSha256);
 const compact=({records,...s})=>s;
 return {version:1,actualRegisteredHeroSameProcessRegionReturnQualified:true,sourceManifest:name,sourceManifestSha256:await hash(name),
  scope:`One native process follows ${route.join(' -> ')}. Every return is compared against its own latest original full save, with RNG/tick/teardown order preserved. Committed-pair hero ownership and guild/rest context remain; each independent generated kingdom has its own actor-ID namespace. ${m.checkpointFaultProbe?'Six':'Five'} actual invalid requests refuse. No actor transfer, browser/co-op activation, spatial hero crossing or sustained native/browser memory bound.`,
  receipt:m.receipt,receiptSha256:m.receiptSha256,publication:m.publicationManifest,publicationSha256:m.publicationManifestSha256,
  loadSequence:route,multiWayNativeCoordinateTravelQualified:true,thirdKingdomInitializedAndRevisited:true,thirdInitializationProof:m.thirdInitializationProof,thirdInitializationProofSha256:m.thirdInitializationProofSha256,initialWorlds:initial.map(compact),comparisons,cycles,automaticLoads,travelRequests,automaticOriginalRegionLifecycleQualified:true,inputActions:0,requestDrivenOriginalRegionLifecycleQualified:true,coordinateDrivenNativeTrialQualified:true,visits:visits.map(v=>({before:compact(v.before),after:compact(v.after)})),
  coordinateCheckpoints,coordinateCheckpointPublicationQualified:m.coordinateCheckpointVersion==='v1',checkpointFaultProbe,
  idleTileRelease,idleTileGates,postReleaseStates:releaseStates.map(compact),actualOriginalIdleTileBufferReleaseQualified:releasing&&idleTileRelease.some(s=>s.freed>0),
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,nativeSymbolsSha256:m.nativeSymbolsSha256,
  maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),durationMs:m.finishedAtMs-m.startedAtMs,
  continuousTravelQualified:false,heroCrossingQualified:false,sustainedNativeMemoryBoundQualified:false,browserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal travel manifest> <fresh proof>');
 const r=await inspectNativeCoordinateMultiway(name);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({actualRegisteredHeroSameProcessRegionReturnQualified:true,cycles:r.cycles.length,maximumSampledRssBytes:r.maximumSampledRssBytes,
  actualOriginalIdleTileBufferReleaseQualified:r.actualOriginalIdleTileBufferReleaseQualified,idleTileRelease:r.idleTileRelease,heroCrossingQualified:false,browserUsed:false}));
}
