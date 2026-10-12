#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {haloRegionLayout,haloSharedVertex,haloTerrainHeight} from '../web/world/halo-region-layout.mjs';
import {nativeHeightBits} from '../web/world/native-height.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
export async function inspectNativeHaloRegion(name){
  const m=await json(name);
  for(const k of ['nativeOnly','freshWorld','nativeSessionTerminal','ownedProducerAbsent','haloGenerationTrialCompleted','originalSettingsUnchanged','privateNativeExecutableUnchanged'])assert.equal(m[k],true,k);
  for(const k of ['browserUsed','ownerPublished','heroCrossingQualified','goalComplete'])assert.equal(m[k],false,k);
  assert.equal(m.menuOnly,false);assert.equal(m.automaticOriginalPreset,true);
  assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);assert.equal(m.nativeProcessesStarted,1);assert.equal(m.layout,'halo-v1');
  try{process.kill(m.nativePid,0);throw Error('Producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const root=await ownedDirectory(m.fixture,'actor-arrival-fixture-halo-world-');assert.equal(m.profile,join(root,'frontier_'+m.region));
  assert.equal(m.privateNativeExecutable,join(root,'native/recomp/pop_smoke'));assert.equal(await hash(m.privateNativeExecutable),m.nativeExecutableSha256);
  assert.equal(m.privateRegistry,join(root,'registry.json'));assert.equal(await hash(m.buildReport),m.buildReportSha256);const build=await json(m.buildReport);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);assert.ok(build.finishedAtMs<=m.startedAtMs);
  assert.equal(await hash(build.log),build.logSha256);assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);
  const compiled={};for(const group of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
    for(const[n,h]of Object.entries(build[group])){assert.ok(!Object.hasOwn(compiled,n));compiled[n]=h;assert.equal(await hash(join(workspace,n)),h);}
  assert.equal(Object.keys(compiled).length,53);assert.deepEqual(compiled,m.compiledSourceSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),m.nativeSymbolsSha256);
  for(const[n,key]of [['scripts/run-native-halo-region.py','runnerSha256'],['scripts/run-native-regional-home.py','supervisorSha256'],['scripts/lib/native_pair_guard.py','guardSha256']])assert.equal(await hash(n),m[key]);
  assert.equal(await hash(m.settingsPreparation),m.settingsPreparationSha256);
  for(const[n,h]of Object.entries(m.inputHashes))assert.equal(await hash(join(m.settingsProfile,n)),h);
  assert.deepEqual(m.preservedBefore,m.preservedAfter);
  for(const[n,b]of Object.entries(m.preservedBefore)){
    if(b===null){await assert.rejects(stat(n),e=>e.code==='ENOENT');continue;}
    const s=await stat(n,{bigint:true});assert.equal(await hash(n),b.sha256);assert.equal(Number(s.size),b.bytes);assert.equal(Number(s.ino),b.inode);assert.equal(Number(s.mtimeNs),b.mtimeNs);
  }
  assert.equal(await hash(m.script),m.scriptSha256);assert.equal(m.script,join(root,'halo-region.script'));
  const camera='wait 20000\ndump halo_before_camera\nclick left 139 18\nwait 3000\nmove 400 300\nwait 2000\ndump halo_region_generated\n',
    guild=camera+'click left 716 161\nwait 2000\ndump halo_guild_selected\n',
    recruit=guild+'click left 148 384\nwait 3000\ndump halo_recruit_started\nmove 400 300\nwait 13000\naction frontier-checkpoint\nwait 2000\ndump halo_recruit_completed\n';
  for(const k of ['cameraScripted','guildScripted','recruitScripted'])if(m[k]!==undefined)assert.equal(typeof m[k],'boolean');
  if(m.recruitScripted)assert.ok(m.cameraScripted&&m.guildScripted);
  if(m.guildScripted)assert.equal(m.cameraScripted,true);
  assert.equal(await readFile(m.script,'utf8'),m.recruitScripted?recruit:m.guildScripted?guild:m.cameraScripted?camera:'wait 25000\ndump halo_region_generated\n');
  assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=4*1024*1024);const log=await readFile(m.log,'utf8');
  assert.ok(log.includes('all expectations met')&&log.includes('undeliverable calls: none'));assert.ok(!/result=fail|abort from|SIGSEGV|bad conversion/.test(log));
  assert.equal(m.checkpoint.filename,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Halo_Region_Saved.GMP'));
  const info=await hashNativeFile(m.checkpoint.filename,{maximum:64*1024*1024});assert.equal(info.sha256,m.checkpoint.sha256);assert.equal(info.bytes,m.checkpoint.bytes);
  const source=await stoppedFileSource(m.checkpoint.filename),terrain=await checkpointTerrain(source),clock=await checkpointSavedClock(source),layout=haloRegionLayout(m.region);
  assert.equal(terrain.width,128);assert.equal(terrain.height,128);
  const origin=[layout.native.originX/32,layout.native.originY/32];
  const events=log.split('\n').filter(l=>l.startsWith('[frontier] Halo region saved '));assert.equal(events.length,1);
  assert.equal(events[0],`[frontier] Halo region saved key=${m.region} layout=halo-v1 native-cells=128 core-cells=124 halo-cells=2 origin-cells=${origin.join(',')} clock=${clock} fresh-generation=1 original-writer=1 result=pass`);
  assert.ok(log.includes(`[frontier] Region ${m.region} connected terrain v1 installed before players vertices=16641 empty-grid-cells=65536`));
  assert.ok(log.includes(`[frontier] Region ${m.region} connected terrain v1 generation preserved=1`));
  const hooks=log.split('\n').filter(l=>l.startsWith('[frontier] Halo generation hooks '));assert.equal(hooks.length,1);
  const balanced=hooks[0].match(/^\[frontier\] Halo generation hooks initial=(\d+) final=(\d+) boundary-before=0 boundary-after=2 balanced=1$/);
  assert.ok(balanced);assert.equal(Number(balanced[2]),Number(balanced[1])+2);
  let sharedVertices=0,interiorShapedVertices=0;
  for(let y=0;y<=128;++y){const row=await source.readAt(terrain.heightOffset(0,y),129*9),view=new DataView(row.buffer,row.byteOffset,row.byteLength);
    for(let x=0;x<=128;++x){const actual=view.getUint32(x*9,true),expected=nativeHeightBits(haloTerrainHeight(m.region,x,y));
      if(haloSharedVertex(x,y)){assert.equal(actual,expected,`Shared halo ${x},${y}`);sharedVertices++;}else if(actual!==expected)interiorShapedVertices++;}
  }
  assert.equal(sharedVertices,2480);const deadline=m.recruitScripted?55:35;
  assert.equal(m.deadlineSeconds,deadline);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
  assert.ok(m.resourceSamples.length>0&&m.resourceSamples.length<=Math.ceil(deadline/2)+1);
  assert.ok(m.resourceSamples.every(s=>s.rssBytes<=m.rssCeilingBytes&&s.ownedPids.every(pid=>pid===m.nativePid)));
  const elapsedMs=m.finishedAtMs-m.startedAtMs;assert.ok(elapsedMs<=deadline*1000);assert.ok(m.frame);assert.equal(await hash(m.frame.filename),m.frame.sha256);
  return {version:1,originalNativeHaloGenerationQualified:true,manifest:resolve(name),manifestSha256:await hash(name),
    region:m.region,layout,checkpoint:m.checkpoint,savedClockMs:clock,checkedVertices:16641,sharedVertices,interiorShapedVertices,
    maximumTerrainRowBytes:1161,originalFullWorldWriter:true,sourceFilesUnchanged:true,
    peakSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),elapsedMs,
    sourceSha256:Object.fromEntries(await Promise.all(['scripts/inspect-native-halo-region.mjs','web/world/halo-region-layout.mjs','web/world/connected-height.mjs','web/world/native-height.mjs','web/world/terrain.mjs'].map(async n=>[n,await hash(n)]))),
    nativeActorCrossingQualified:false,ownershipTransferQualified:false,browserUsed:false,goalComplete:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const[name,output]=process.argv.slice(2);assert.equal(process.argv.length,4);const result=await inspectNativeHaloRegion(name);
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({originalNativeHaloGenerationQualified:true,region:result.region,sharedVertices:result.sharedVertices}));
}
