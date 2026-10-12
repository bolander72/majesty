#!/usr/bin/env node
// Bind original saved-state comparisons to scoped visibility replay evidence.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {requireSessionTrace,requireSessionReadyTrace} from './inspect-native-region-session.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
const hash=async name=>(await hashNativeFile(name)).sha256;
export function requireSavedRevealTrace(m,text){
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
  const trace=requireSessionTrace(m,text),ready=requireSessionReadyTrace(m,text,trace);
  const events=[...text.matchAll(/^\[frontier\] Session UI restored region=([^ ]+) selected=(\d+) rebound=(\d+) reveals=(\d+) removed=3 retained-worlds=0 result=pass$/gm)];
  const saved=ready.filter((r,i)=>i===0||trace.modes[i-1]==='saved');
  assert.equal(events.length,saved.length);
  for(const [i,event]of events.entries()){
    const r=saved[i],serial=+r.serial;assert.equal(event[1],r.region);
    assert.ok(event.index<r.position);
    if(serial)assert.ok(event.index>trace.attaches[serial-1].position);
    assert.equal(+event[3],1);assert.ok(+event[4]>0&&+event[4]<=10000);
    assert.ok(+event[2]<=10000);
  }
  return {loads:saved.length,revealReplaysRetained:events.reduce((n,r)=>n+ +r[4],0),
    selectedFlagsRetained:events.reduce((n,r)=>n+ +r[2],0),visits:trace.visits};
}
async function main(){
  const [name,restorationName,auditName,out]=process.argv.slice(2);assert.equal(process.argv.length,6);
  const m=JSON.parse(await readFile(name,'utf8'));await ownedDirectory(m.fixture,'actor-arrival-fixture-session-');
  try{process.kill(m.nativePid,0);throw Error('Producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const text=await readFile(m.log,'utf8'),controls=requireSavedRevealTrace(m,text);
  const restored=JSON.parse(await readFile(restorationName,'utf8'));
  assert.equal(restored.manifestSha256,await hash(name));assert.equal(restored.fullTypedRestorationCompared,true);
  assert.equal(restored.fullTypedRestorationQualified,true);
  assert.equal(restored.fullRestoration.comparedLoads,controls.loads);
  assert.equal(restored.fullRestoration.matchingLoads,controls.loads);
  assert.equal(restored.originalWorldRootReleaseQualified,true);
  const build=JSON.parse(await readFile(m.buildReport,'utf8'));assert.equal(build.nativeBuildQualified,true);
  assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(await hash(m.log),m.logSha256);
  assert.equal(await hash('scripts/run-native-region-session.py'),m.runnerSha256);
  assert.equal(await hash(m.runnerSourceCopy),m.runnerSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),build.nativeSymbolsSha256);
  const compiled={...build.nativeSourceSha256,...build.nativeHeapRuntimeSourceSha256,...build.nativeOrderRuntimeSourceSha256};
  assert.equal(Object.keys(compiled).length,20);for(const [n,h]of Object.entries(compiled))assert.equal(await hash(n),h);
  const audit=JSON.parse(await readFile(auditName,'utf8'));
  assert.equal(audit.staticQualified,true);assert.equal(audit.zeroMaskSkipsVertexWrite,true);
  assert.equal(audit.primaryFieldsIgnored,false);assert.equal(audit.entry,'005afe20');
  assert.equal(audit.callerReturn,'005b64a0');assert.equal(audit.argumentBytes,12);
  const refusals=[];const refuse=(label,change)=>{assert.throws(()=>requireSavedRevealTrace(m,change(text)));refusals.push(label);};
  refuse('missing replay event',s=>s.replace(/^\[frontier\] Session UI restored .*\n/m,''));
  refuse('duplicate replay event',s=>s+s.match(/^\[frontier\] Session UI restored .*$/m)[0]+'\n');
  refuse('no actual reveal replay',s=>s.replace(/reveals=\d+/,'reveals=0'));
  refuse('wrong loaded region',s=>s.replace('Session UI restored region=0_0','Session UI restored region=1_0'));
  refuse('visibility hook not removed',s=>s.replace('removed=3','removed=2'));
  refuse('retained world identity',s=>s.replace('retained-worlds=0','retained-worlds=1'));
  refuse('target rebind bypassed',s=>s.replace('rebound=1','rebound=0'));
  const evidence={};for(const n of [name,m.log,m.buildReport,restorationName,auditName,
    'scripts/audit-native-saved-reveal.py','scripts/inspect-native-saved-reveal.mjs',
    'scripts/inspect-native-region-session.mjs','scripts/lib/connected-residency.mjs'])evidence[resolve(n)]=await hash(n);
  await writeFile(out,JSON.stringify({version:1,nativeSavedRevealRestorationQualified:true,...controls,
    compiledSourceSha256:compiled,evidenceSha256:evidence,refusals,nativePid:m.nativePid,
    fullTypedRestorationQualified:true,sharedHeightSeamsQualified:restored.sharedHeightSeamsQualified,
    scope:'Original saved-state comparisons pass before any resumed tick; scoped actor reveal replays '
      +'delegate with zero mask and three hooks are removed. Earlier seam failures remain unresolved. '
      +'Ordinary rendered visibility, seamless travel, co-op and browser resource bounds are unqualified.',
    browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({nativeSavedRevealRestorationQualified:true,...controls,refusals:refusals.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{await main();}catch(e){console.error(String(e.message).slice(0,600));process.exitCode=1;}
}
