#!/usr/bin/env node
// Stopped evidence for selection/global UI persistence, with full failures retained.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {requireSessionTrace,requireSessionReadyTrace} from './inspect-native-region-session.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {checkpointUnits} from '../web/world/checkpoint.mjs';
const hash=async name=>(await hashNativeFile(name)).sha256;
const [name,restorationName,auditName,out]=process.argv.slice(2);
assert.equal(process.argv.length,6);
const m=JSON.parse(await readFile(name,'utf8'));
await ownedDirectory(m.fixture,'actor-arrival-fixture-session-');
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);throw Error('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
const text=await readFile(m.log,'utf8'),trace=requireSessionTrace(m,text),ready=requireSessionReadyTrace(m,text,trace);
const events=[...text.matchAll(/^\[frontier\] Session UI restored region=([^ ]+) selected=(\d+) rebound=(\d+) removed=2 retained-worlds=0 result=pass$/gm)];
const restored=JSON.parse(await readFile(restorationName,'utf8'));
assert.equal(restored.manifestSha256,await hash(name));assert.equal(restored.fullTypedRestorationCompared,true);
assert.equal(restored.fullRestoration.restored.length,trace.visits);
const saved=restored.fullRestoration.restored.filter(r=>r.mode==='saved');
assert.equal(events.length,saved.length);
const loads=[];
for(const [i,r] of saved.entries()){
  const event=events[i];assert.equal(event[1],r.region);
  assert.ok(event.index<ready[r.serial].position);
  if(r.serial)assert.ok(event.index>trace.attaches[r.serial-1].position);
  assert.equal(+event[3],1,'The original camera target rebind must be exercised');
  const comparison=r.comparison;assert.ok(comparison);
  if(!comparison.matching){
    assert.deepEqual(comparison.changedRecords,[],'A saved actor field still changes');
    assert.ok(comparison.changedRoots.every(tag=>tag==='MTER'||tag==='ORDR'),
      'A saved global UI or actor payload still changes');
  }
  const previous=m.route.slice(0,r.serial).lastIndexOf(r.region);
  const file=r.serial===0?m.selectedRevisionExports[0].filename:m.snapshotCaptures[previous].file;
  const source=await stoppedFileSource(file);let selected=0;
  for await(const unit of checkpointUnits(source))if(unit.primary.words[2]&1)++selected;
  assert.equal(+event[2],selected,'Every saved selected flag must survive the reset iteration');
  loads.push({serial:r.serial,region:r.region,selectedFlagsRetained:selected,originalTargetRebinds:+event[3],
    fullStateMatching:comparison.matching});
}
assert.ok(loads.some(r=>r.selectedFlagsRetained>0));
const build=JSON.parse(await readFile(m.buildReport,'utf8'));
assert.equal(build.nativeBuildQualified,true);assert.equal(await hash(m.buildReport),m.buildReportSha256);
assert.equal(await hash(m.log),m.logSha256);
assert.equal(await hash('scripts/run-native-region-session.py'),m.runnerSha256);
assert.equal(await hash(m.runnerSourceCopy),m.runnerSha256);
assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),build.nativeSymbolsSha256);
const compiled={...build.nativeSourceSha256,...build.nativeHeapRuntimeSourceSha256,...build.nativeOrderRuntimeSourceSha256};
assert.equal(Object.keys(compiled).length,20);for(const [n,h]of Object.entries(compiled))assert.equal(await hash(n),h);
const audit=JSON.parse(await readFile(auditName,'utf8'));
assert.equal(audit.staticQualified,true);assert.equal(audit.primaryFieldsIgnored,false);
assert.equal(audit.selectionCaller,'005ba8aa');assert.equal(audit.redundantTargetCaller,'0043a5cd');
assert.equal(audit.checkedInstructions.length,25);
const evidence={};for(const n of [name,m.log,m.buildReport,restorationName,auditName,
  'scripts/audit-native-session-ui-restoration.py','scripts/inspect-native-session-ui-restoration.mjs',
  'scripts/inspect-native-region-session.mjs','scripts/lib/connected-residency.mjs'])evidence[resolve(n)]=await hash(n);
await writeFile(out,JSON.stringify({version:1,nativeSessionUiPersistenceQualified:true,loads,
  compiledSourceSha256:compiled,evidenceSha256:evidence,nativePid:m.nativePid,
  fullTypedRestorationQualified:restored.fullTypedRestorationQualified,
  sharedHeightSeamsQualified:restored.sharedHeightSeamsQualified,
  scope:'Saved actor records and the complete GSGL UI payload survive nine original loads. '
    +'Original methods run and two temporary hooks are removed before Ready/ticks. '
    +'Terrain failures remain separate. Rendered UI, browser play and multiplayer are unqualified.',
  browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSessionUiPersistenceQualified:true,loads:loads.length,
  selectedFlagsRetained:loads.reduce((n,r)=>n+r.selectedFlagsRetained,0),
  fullTypedRestorationQualified:restored.fullTypedRestorationQualified}));
