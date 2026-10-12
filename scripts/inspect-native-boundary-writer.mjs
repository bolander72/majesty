#!/usr/bin/env node
// Independent stopped checks of actual original-writer controls and region travel.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {requireSessionTrace,requireSessionReadyTrace} from './inspect-native-region-session.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
const hash=async name=>(await hashNativeFile(name)).sha256;
export function requireBoundaryWriterTrace(m,text){
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
  assert.equal(m.nativeRouteCompleted,true);assert.equal(m.readyStateExpected,true);
  const trace=requireSessionTrace(m,text);requireSessionReadyTrace(m,text,trace);
  const fresh=trace.attaches.filter(r=>r.mode==='new');assert.ok(fresh.length>0);
  const prefix='[frontier] Connected boundary writer ';
  const lines=text.split('\n').filter(r=>r.startsWith(prefix));assert.equal(lines.length,fresh.length);
  for(const [i,line]of lines.entries()){
    assert.equal(line,`${prefix}region=${fresh[i].region} edge-controls=8 interior-controls=1 original-writer=00428d70 empty-stores=1 result=pass`);
    const at=text.indexOf(line);assert.ok(at>0&&at<fresh[i].position);
    const pre=text.indexOf(`[frontier] Region ${fresh[i].region} connected terrain comparison stage=pre-placement changed=0 border-changed=0`,at);
    const generation=text.indexOf(`[frontier] Region ${fresh[i].region} connected terrain v1 generation preserved=1`,pre);
    assert.ok(pre>at&&generation>pre&&generation<fresh[i].position);
    if(i)assert.ok(at>fresh[i-1].position);
  }
  return {regions:fresh.map(r=>r.region),boundaryAttempts:fresh.length*8,interiorAttempts:fresh.length,visits:trace.visits};
}
async function main(){
  const [name,restorationName,auditName,out]=process.argv.slice(2);assert.equal(process.argv.length,6);
  const m=JSON.parse(await readFile(name,'utf8'));await ownedDirectory(m.fixture,'actor-arrival-fixture-session-');
  try{process.kill(m.nativePid,0);throw Error('Native producer is live');}catch(error){if(error.code!=='ESRCH')throw error;}
  const text=await readFile(m.log,'utf8'),controls=requireBoundaryWriterTrace(m,text);
  const build=JSON.parse(await readFile(m.buildReport,'utf8'));assert.equal(build.nativeBuildQualified,true);
  assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(await hash(m.log),m.logSha256);
  assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),build.nativeSymbolsSha256);
  assert.equal(await hash('scripts/run-native-region-session.py'),m.runnerSha256);assert.equal(await hash(m.runnerSourceCopy),m.runnerSha256);
  const compiled={...build.nativeSourceSha256,...build.nativeHeapRuntimeSourceSha256,...build.nativeOrderRuntimeSourceSha256};
  assert.equal(Object.keys(compiled).length,20);for(const [n,h]of Object.entries(compiled))assert.equal(await hash(n),h);
  const restored=JSON.parse(await readFile(restorationName,'utf8'));
  assert.equal(restored.manifestSha256,await hash(name));assert.equal(restored.sharedHeightSeamsQualified,true);
  assert.equal(restored.nativeNamedProfilesQualified,true);assert.equal(restored.originalWorldRootReleaseQualified,true);
  const audit=JSON.parse(await readFile(auditName,'utf8'));
  assert.equal(audit.qualified,true);assert.equal(audit.executableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
  assert.equal(audit.entry,'00428d70');assert.equal(audit.argumentBytes,8);assert.equal(audit.instructions.length,12);
  const refusals=[];
  const refuse=(label,replace)=>{assert.throws(()=>requireBoundaryWriterTrace(m,replace(text)));refusals.push(label);};
  refuse('missing real writer controls',s=>s.replace(/^\[frontier\] Connected boundary writer .*\n/m,''));
  refuse('duplicate writer controls',s=>s+s.match(/^\[frontier\] Connected boundary writer .*$/m)[0]+'\n');
  refuse('missing side/corner attempt',s=>s.replace('edge-controls=8','edge-controls=7'));
  refuse('interior edits blocked',s=>s.replace('interior-controls=1','interior-controls=0'));
  refuse('different original writer',s=>s.replace('original-writer=00428d70','original-writer=005f1a40'));
  refuse('occupied world used for controls',s=>s.replace('empty-stores=1','empty-stores=0'));
  refuse('damaged pre-placement heights',s=>s.replace('stage=pre-placement changed=0','stage=pre-placement changed=1'));
  const evidence={};for(const n of [name,m.log,m.buildReport,restorationName,auditName,
    'scripts/audit-native-boundary-writer.py','scripts/inspect-native-boundary-writer.mjs',
    'scripts/inspect-native-region-session.mjs'])evidence[resolve(n)]=await hash(n);
  await writeFile(out,JSON.stringify({version:1,singleVertexBoundaryProtectionQualified:true,...controls,
    nativePid:m.nativePid,compiledSourceSha256:compiled,evidenceSha256:evidence,refusals,
    fullTypedRestorationQualified:restored.fullTypedRestorationQualified,sharedHeightSeamsQualified:true,
    scope:'Actual original writer attempts on all four sides/corners retain their heights; a real interior edit works and restores before actor placement. No occupied terrain repair. Other terrain writers, seamless travel and browser memory remain unqualified.',
    browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({singleVertexBoundaryProtectionQualified:true,...controls,refusals:refusals.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{await main();}catch(error){console.error(String(error.message).slice(0,600));process.exitCode=1;}
}
