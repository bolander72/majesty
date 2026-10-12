#!/usr/bin/env node
// Qualify the actual stopped generated-world visits without ignoring primary changes.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {connectedWorldState,compareConnectedWorlds,connectedResidencyCycles} from './lib/connected-residency.mjs';

const hash=async name=>(await hashNativeFile(name,{maximum:128*1024*1024})).sha256;
async function json(name){assert.ok((await hashNativeFile(name,{maximum:65536})).bytes<=65536);return JSON.parse(await readFile(name,'utf8'));}
function differences(before,after){
  return {changedRootTags:after.roots.filter((root,i)=>JSON.stringify(root)!==JSON.stringify(before.roots[i])).map(root=>root.tag),
    changedRecords:Object.fromEntries(['units','agents','attachments'].map(kind=>[kind,[...new Set([...Object.keys(before.records[kind]),...Object.keys(after.records[kind])])]
      .filter(id=>JSON.stringify(before.records[kind][id])!==JSON.stringify(after.records[kind][id]))])),
    clockSame:before.clock===after.clock,scriptingRngSame:before.rng===after.rng,gameplayRngSame:before.gameplayRng===after.gameplayRng,
    queuesSame:JSON.stringify(before.queues)===JSON.stringify(after.queues)&&before.activeQueue===after.activeQueue};
}
export async function verifyConnectedResidency(name){
  const manifest=await json(name);
  assert.equal(manifest.nativeOnly,true);assert.equal(manifest.browserUsed,false);
  assert.equal(manifest.nativeSessionTerminal,true);assert.equal(manifest.nativeExitCode,0);assert.equal(manifest.stopReason,null);
  assert.equal(manifest.connectedResidencyVersion,'v1');assert.equal(manifest.originalSettingsUnchanged,true);assert.equal(manifest.originalGeneratedSavesUnchanged,true);
  assert.ok(Number.isInteger(manifest.nativePid)&&manifest.nativePid>0);
  try{process.kill(manifest.nativePid,0);throw Error('Native evidence process is still live');}catch(error){if(error.code!=='ESRCH')throw error;}
  const profile=await ownedDirectory(manifest.profile,'actor-arrival-fixture-connected-residency-');
  assert.equal(profile,join(manifest.fixture,'frontier_0_0'));
  const count=manifest.loadSequence.length;
  assert.ok(count>=3&&count<=8);assert.deepEqual(manifest.regions,['0_0','1_0']);
  assert.ok(manifest.generatedRegionInitialization==null||manifest.generatedRegionInitialization==='v1');
  const initializing=manifest.generatedRegionInitialization==='v1';
  if(initializing){assert.ok(count>=4);assert.equal(manifest.connectedLoadTransformObservation,'v2');}
  if(manifest.completedTicksByVisit||initializing)assert.deepEqual(manifest.completedTicksByVisit,
    Array.from({length:count},(_,i)=>initializing&&i<2?0:20));
  assert.deepEqual(manifest.loadSequence,Array.from({length:count},(_,i)=>i%2?0:1));
  assert.deepEqual(manifest.loadExtents,Array(count).fill(256));assert.equal(manifest.observedTicksPerLoad,20);
  const build=await json(manifest.buildReport);
  assert.equal(await hash(manifest.buildReport),manifest.buildReportSha256);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
  assert.ok(['.venv/bin/python tools/build.py --target smoke --jobs 1',
    '.venv/bin/python tools/build.py --target smoke --jobs 1 --regenerate'].includes(build.command));
  assert.equal(await hash(build.log),build.logSha256);assert.ok(build.finishedAtMs<=manifest.startedAtMs);
  assert.deepEqual(manifest.nativeSourceSha256,build.nativeSourceSha256);assert.equal(manifest.nativeExecutableSha256,build.nativeExecutableSha256);
  const symbolFile=await verifyConnectedNativeArtifact(manifest,build);
  if(manifest.connectedLoadTransformObservation==='v2'){
    const symbolInfo=await hashNativeFile(symbolFile,{maximum:32*1024*1024});
    assert.equal(symbolInfo.sha256,build.nativeSymbolsSha256);assert.equal(symbolInfo.sha256,manifest.nativeSymbolsSha256);
    const symbols=JSON.parse(await readFile(symbolFile,'utf8'));
    assert.equal(symbols.exe_sha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
    for(const address of ['005b6a80','005afe20','00438ac0']){
      const found=symbols.functions.filter(entry=>entry.addr===address);
      assert.equal(found.length,1);assert.equal(found[0].kind,'entry');assert.equal(found[0].hookable,true);
    }
  }
  const evidence={};
  for(const name of ['mod-settings.json','Documents/My Games/MajestyHD/MajXPrefs','Documents/My Games/MajestyHD/questdata_majx.sav']){
    const filename=join(profile,name);assert.equal(await hash(filename),manifest.inputHashes[name]);evidence[filename]=manifest.inputHashes[name];
  }
  const initial=[];
  for(let side=0;side<2;++side){
    const original=await json(manifest.regionReports[side]);assert.equal(await hash(manifest.regionReports[side]),manifest.regionReportSha256[side]);
    assert.equal(original.nativeSessionTerminal,true);assert.equal(original.nativeExitCode,0);assert.equal(original.region,manifest.regions[side]);
    assert.equal(original.connectedTerrainVersion,'v1');assert.equal(original.saves.length,1);
    assert.equal(await hash(original.saves[0].filename),original.saves[0].sha256);
    const saved=await connectedWorldState(join(profile,`Residency_Initial_${side}.GMP`));
    assert.equal(saved.sha256,original.saves[0].sha256);assert.equal(saved.bytes,original.saves[0].bytes);
    assert.equal(manifest.inputHashes[`Residency_Initial_${side}.GMP`],saved.sha256);
    assert.equal(manifest.inputHashes[`Residency_Source_${side}.GMP`],saved.sha256);
    initial.push(saved);evidence[saved.filename]=saved.sha256;
  }
  const visits=[];
  for(let i=0;i<count;++i){
    const before=await connectedWorldState(join(profile,`Residency_Visit_${i}_Before.GMP`)),after=await connectedWorldState(join(profile,`Residency_Visit_${i}_After.GMP`));
    assert.equal(before.label,'Joint_Departed_Reload');assert.equal(after.label,'Joint_Evolved');
    visits.push({before,after});evidence[before.filename]=before.sha256;evidence[after.filename]=after.sha256;
  }
  const firstLoads=[],revisits=[];
  for(let i=0;i<count;++i){
    const before=i<2?initial[manifest.loadSequence[i]]:visits[i-2].after;
    if(i<2){
      try{firstLoads.push({visit:i,region:manifest.regions[manifest.loadSequence[i]],statePreserved:true,...compareConnectedWorlds(before,visits[i].before)});}
      catch(error){firstLoads.push({visit:i,region:manifest.regions[manifest.loadSequence[i]],statePreserved:false,...differences(before,visits[i].before)});}
    }else revisits.push({visit:i,region:manifest.regions[manifest.loadSequence[i]],statePreserved:true,...compareConnectedWorlds(before,visits[i].before)});
  }
  for(let side=0;side<2;++side){
    const last=manifest.loadSequence.lastIndexOf(side),filename=join(profile,`Residency_Source_${side}.GMP`);
    assert.equal(await hash(filename),visits[last].after.sha256,'Latest regional publication differs');evidence[filename]=visits[last].after.sha256;
  }
  assert.equal(await hash(join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP')),visits[count-3].after.sha256);
  assert.equal(await hash(manifest.script),manifest.scriptSha256);
  const logInfo=await hashNativeFile(manifest.log,{maximum:1024*1024});
  const cycles=connectedResidencyCycles(await readFile(manifest.log,'utf8'),visits,{initializeGeneratedRegions:initializing});
  assert.equal(manifest.rssCeilingBytes,512*1024*1024);assert.ok(manifest.resourceSamples.length>=3&&manifest.resourceSamples.length<=80);
  let previous=manifest.startedAtMs;
  for(const sample of manifest.resourceSamples){
    assert.equal(sample.pid,manifest.nativePid);assert.ok(sample.rssBytes>0&&sample.rssBytes<=manifest.rssCeilingBytes);
    assert.ok(sample.sampledAtMs>=previous&&sample.sampledAtMs<=manifest.finishedAtMs&&sample.sampledAtMs-previous<=4000);previous=sample.sampledAtMs;
  }
  assert.ok(manifest.finishedAtMs-previous<=4000);
  const firstLoadsPreserved=firstLoads.every(load=>load.statePreserved),bothRevisited=new Set(revisits.map(visit=>visit.region)).size===2;
  const compact=state=>{const{records,...result}=state;return result;};
  return {qualified:firstLoadsPreserved&&bothRevisited,version:1,sourceManifest:resolve(name),sourceManifestSha256:await hash(name),
    scope:'Actual generated solo kingdoms, original completed ticks, native full saves, dispatcher disposal and regional reload. First-load primary changes remain failures; only the audited cached vertex shading byte and original save label/calendar are normalized.',
    firstLoads,revisits,cycles,visits:visits.map(visit=>({before:compact(visit.before),after:compact(visit.after)})),
    originalWholeWorldTeardownQualified:true,allSixRootsFreedEachExit:true,
    firstGeneratedLoadsPreserved:firstLoadsPreserved,bothGeneratedRegionsRevisited:bothRevisited,
    generatedRegionsInitializedWithoutSimulation:initializing,
    initializedRegionsReturnedWithoutStateChanges:initializing&&bothRevisited,
    fullGeneratedRegionHandoffQualified:firstLoadsPreserved&&bothRevisited,
    sampledMaxRssBytes:Math.max(...manifest.resourceSamples.map(sample=>sample.rssBytes)),durationMs:manifest.finishedAtMs-manifest.startedAtMs,
    evidenceSha256:{...evidence,[manifest.log]:logInfo.sha256,[manifest.buildReport]:manifest.buildReportSha256,[manifest.script]:manifest.scriptSha256},
    heroTransferQualified:false,continuousTravelQualified:false,sustainedNativeMemoryBoundQualified:false,browserMemoryBoundQualified:false,
    browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const[name,out]=process.argv.slice(2);if(!name||!out||process.argv.length!==4)throw Error('Usage: <terminal connected residency manifest> <fresh report>');
  const result=await verifyConnectedResidency(name);await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:result.qualified,cycles:result.cycles.length,firstGeneratedLoadsPreserved:result.firstGeneratedLoadsPreserved,bothGeneratedRegionsRevisited:result.bothGeneratedRegionsRevisited}));
}
