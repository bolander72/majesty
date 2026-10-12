#!/usr/bin/env node
// Qualify a genuinely generated third kingdom and both existing height seams.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
const run=promisify(execFile),hash=async p=>(await hashNativeFile(p)).sha256;
async function json(p){assert.ok((await stat(p)).size<=256*1024);return JSON.parse(await readFile(p,'utf8'));}
const [manifestName,auditName,outName]=process.argv.slice(2);
assert.equal(process.argv.length,5,'Usage: <terminal 0_1 generation> <extent audit> <fresh proof>');
const m=await json(manifestName),audit=await json(auditName);
assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.stopReason,m.region,m.originalSettingsUnchanged],
  [true,false,true,0,null,'0_1',true]);
assert.ok(Number.isInteger(m.nativePid)&&m.nativePid>0);
try{process.kill(m.nativePid,0);throw Error('Game still live');}catch(e){if(e.code!=='ESRCH')throw e;}
const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-connected-terrain-');
assert.equal(m.profile,join(directory,'frontier_0_1'));
assert.equal(m.connectedTerrainVersion,'v1');
assert.equal(audit.qualified,true);assert.equal(audit.originalSetter,'004ae140');assert.equal(audit.originalExtentGetter,'004ae120');
assert.equal(audit.landscapeOverridesRequestedExtent,true);
assert.equal(audit.checkedInstructions.length,28);assert.equal(audit.contradictoryInstructionControls.length,11);
assert.ok(audit.contradictoryInstructionControls.every(c=>c.refused===true));
assert.equal(audit.scriptSha256,await hash('scripts/audit-native-connected-extent.py'));
// Re-decode the pinned input rather than accepting an audit's own assertions.
await run(join(workspace,'upstream/majesty-recomp/.venv/bin/python'),['-c',
  "import importlib.util,json,hashlib,sys;from pathlib import Path;"+
  "s=importlib.util.spec_from_file_location('extent','scripts/audit-native-connected-extent.py');"+
  "x=importlib.util.module_from_spec(s);s.loader.exec_module(x);"+
  "b=(x.ROOT/'upstream/majesty-recomp/original/gog/MajestyHD - Old.exe').read_bytes();"+
  "assert hashlib.sha256(b).hexdigest()==x.PIN;"+
  "a=json.loads(Path(sys.argv[1]).read_text());assert a['originalExecutableSha256']==x.PIN;"+
  "assert x.verify_paths(b)[1]==a['checkedInstructions']",resolve(auditName)],{cwd:workspace,maxBuffer:8192});
const build=await json(m.buildReport);
assert.equal(await hash(m.buildReport),m.buildReportSha256);
assert.deepEqual([build.nativeBuildQualified,build.exitCode,build.command],[true,0,'.venv/bin/python tools/build.py --target smoke --jobs 1']);
assert.equal(await hash(build.log),build.logSha256);assert.ok(build.finishedAtMs<=m.startedAtMs);
await verifyConnectedNativeArtifact(m,build);
assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await hash(m.baseScript),m.baseScriptSha256);
const settings=await json(m.settingsProducer);assert.equal(await hash(m.settingsProducer),m.settingsProducerSha256);
assert.equal(settings.nativeSessionTerminal,true);assert.equal(settings.nativeExitCode,0);
const inputs={};for(const [name,digest] of Object.entries(m.inputHashes)){
 assert.equal(settings.inputHashes[name],digest);
 for(const directory of [m.profile,settings.profile]){const p=join(directory,name);assert.equal(await hash(p),digest);inputs[p]=digest;}
}
assert.ok((await stat(m.log)).size<=1024*1024);const log=await readFile(m.log,'utf8');
assert.ok(log.includes('[frontier] Region 0_1 connected generation extent cells=128,128 landscape=256,256 original-getter=004ae120 world-null=1 seed-same=1 result=pass'));
assert.ok(log.includes('[frontier] Region 0_1 ready'));assert.ok(log.includes('all expectations met'));
assert.ok(!/result=fail|construction refused|pre-placement refused|abort from|SIGSEGV|undeliverable call(?!s: none)/i.test(log));
assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=65);
assert.ok(m.resourceSamples.every(s=>s.pid===m.nativePid&&s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes));
assert.ok(m.finishedAtMs-m.startedAtMs<=120000);
const reports=['output/native-connected-terrain-attempt-011.json','output/native-connected-terrain-attempt-012.json',resolve(manifestName)];
const inspected=JSON.parse((await run('node',['scripts/inspect-native-connected-terrain.mjs',...reports],{cwd:workspace,maxBuffer:65536})).stdout);
assert.deepEqual(inspected.cases.map(c=>c.region),['0_0','1_0','0_1']);
assert.deepEqual(inspected.seams.map(s=>[s.firstRegion,s.secondRegion,s.vertices,s.matchingHeightBits]),[['0_0','1_0',129,true],['0_0','0_1',129,true]]);
const state=await connectedWorldState(m.saves[0].filename);assert.equal(state.sha256,m.saves[0].sha256);
assert.ok(state.clock>0&&state.counts.units>0&&state.counts.agents>0);
const evidence={...inputs,[resolve(manifestName)]:await hash(manifestName),[resolve(auditName)]:await hash(auditName),
 [m.log]:await hash(m.log),[m.buildReport]:m.buildReportSha256,[m.script]:m.scriptSha256};
for(const report of reports){const original=await json(report);evidence[resolve(report)]=await hash(report);for(const s of original.saves)evidence[s.filename]=s.sha256;}
const sourceSha256={};for(const p of ['scripts/qualify-native-connected-expansion.mjs','scripts/audit-native-connected-extent.py',
 'scripts/inspect-native-connected-terrain.mjs','scripts/run-native-connected-terrain.py','web/world/connected-height.mjs','web/world/native-height.mjs'])sourceSha256[p]=await hash(p);
const proof={version:1,qualified:true,thirdOriginalKingdomGenerated:true,sourceManifest:resolve(manifestName),
 sourceManifestSha256:await hash(manifestName),nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,
 coordinate:'0_1',actualLandscapeExtent:[256,256],connectedExtent:[128,128],originalGenerationAndSave:true,
 originalInputsUnchanged:true,terrain:inspected,generatedSave:{filename:state.filename,sha256:state.sha256,bytes:state.bytes,clock:state.clock,counts:state.counts},
 durationMs:m.finishedAtMs-m.startedAtMs,maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),
 evidenceSha256:evidence,sourceSha256,browserUsed:false,nativeProcessesStarted:0,
 thirdKingdomInitializedAndRevisited:false,multiWayTravelQualified:false,heroCrossingQualified:false,
 sustainedNativeMemoryBoundQualified:false,browserMemoryBoundQualified:false,
 scope:'Fresh original native 0_1 kingdom with bounded extent, original gameplay/save and exact shared saved heights. Cold-load initialization, multi-way travel, material/light seams, actor crossing, co-op, browser and sustained memory bounds remain unqualified.'};
await writeFile(outName,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,coordinate:proof.coordinate,matchingSeams:inspected.seams.length,counts:state.counts,clock:state.clock,multiWayTravelQualified:false}));
