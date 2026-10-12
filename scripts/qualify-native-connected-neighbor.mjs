#!/usr/bin/env node
// Qualify an actually generated neighboring kingdom at supplied coordinates.
import assert from 'node:assert/strict';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {regionKey} from '../web/world/region.mjs';
const run=promisify(execFile),sha=async p=>(await hashNativeFile(p)).sha256;
async function json(p){assert.ok((await stat(p)).size<=256*1024);return JSON.parse(await readFile(p,'utf8'));}
async function main(){
 const [input,neighbor,out]=process.argv.slice(2);assert.ok(input&&neighbor&&out&&process.argv.length===5);
 const m=await json(input),n=await json(neighbor),build=await json(m.buildReport);
 await verifyConnectedNativeArtifact(m,build);
 assert.equal(m.connectedTerrainVersion,'v1');assert.equal(m.originalSettingsUnchanged,true);assert.equal(m.stopReason,null);
 const [x,y]=m.region.split('_').map(Number),[nx,ny]=n.region.split('_').map(Number);
 assert.equal(regionKey(x,y),m.region);assert.equal(regionKey(nx,ny),n.region);
 assert.equal(Math.abs(x-nx)+Math.abs(y-ny),1);
 const dir=await ownedDirectory(m.fixture,'actor-arrival-fixture-connected-terrain-');
 assert.equal(m.profile,join(dir,`frontier_${m.region}`));
 for(const [p,d]of [[m.buildReport,m.buildReportSha256],[m.settingsProducer,m.settingsProducerSha256],
  [m.baseScript,m.baseScriptSha256],[m.script,m.scriptSha256]])assert.equal(await sha(p),d);
 const settings=await json(m.settingsProducer);assert.equal(settings.nativeSessionTerminal,true);assert.equal(settings.nativeExitCode,0);
 for(const [name,d]of Object.entries(m.inputHashes)){
  assert.equal(settings.inputHashes[name],d);
  assert.equal(await sha(join(settings.profile,name)),d);assert.equal(await sha(join(m.profile,name)),d);
 }
 assert.ok((await stat(m.log)).size<=1024*1024);const log=await readFile(m.log,'utf8');
 assert.ok(log.includes(`[frontier] Region ${m.region} ready`)&&log.includes('all expectations met'));
 assert.ok(log.includes('undeliverable calls: none')&&log.includes('guest exit code:    0'));
 assert.ok(!/result=fail|construction refused|pre-placement refused|abort from|SIGSEGV/i.test(log));
 const extent=log.split('\n').filter(s=>s.startsWith(`[frontier] Region ${m.region} connected generation extent `));
 assert.equal(extent.length,1);
 const dimensions=extent[0].match(/cells=128,128 landscape=(\d+),(\d+) original-getter=004ae120 world-null=1 seed-same=1 result=pass$/);
 assert.ok(dimensions);
 const durationMs=m.finishedAtMs-m.startedAtMs;assert.ok(durationMs>0&&durationMs<=120000);
 assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>0);
 assert.ok(m.resourceSamples.every(s=>s.pid===m.nativePid&&s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes));
 const terrain=JSON.parse((await run('node',['scripts/inspect-native-connected-terrain.mjs',neighbor,input],
  {cwd:workspace,maxBuffer:65536})).stdout);
 assert.equal(terrain.cases.length,2);assert.deepEqual(terrain.cases.map(c=>c.region),[n.region,m.region]);
 assert.equal(terrain.seams.length,1);assert.equal(terrain.seams[0].vertices,129);assert.equal(terrain.seams[0].matchingHeightBits,true);
 const state=await connectedWorldState(m.saves[0].filename);assert.equal(state.sha256,m.saves[0].sha256);
 assert.ok(state.clock>0&&state.counts.units>0&&state.counts.agents>0);
 const report={version:1,qualified:true,newOriginalNeighborGenerated:true,coordinate:m.region,neighbor:n.region,
  actualLandscapeExtent:dimensions.slice(1).map(Number),connectedExtent:[128,128],terrain,
  generatedSave:{filename:state.filename,bytes:state.bytes,sha256:state.sha256,clock:state.clock,counts:state.counts},
  nativePid:m.nativePid,durationMs,maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),
  inputSha256:await sha(input),neighborSha256:await sha(neighbor),logSha256:await sha(m.log),
  inspectorSha256:await sha('scripts/qualify-native-connected-neighbor.mjs'),nativeExecutableSha256:m.nativeExecutableSha256,
  browserUsed:false,heroCrossingQualified:false,sharedActivationQualified:false,sustainedMemoryBoundQualified:false,
  scope:'Original native generation, gameplay and Save Game at a supplied adjacent coordinate; all saved height vertices and the shared 129-vertex border verified. No spatial actor crossing, browser delivery, cooperative activation or sustained memory bound.'};
 await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({qualified:true,coordinate:m.region,neighbor:n.region,matchingSeam:true,counts:state.counts}));
}
main().catch(e=>{console.error(JSON.stringify({qualified:false,error:e.message.slice(0,350)}));process.exitCode=1;});
