#!/usr/bin/env node
// Verify actual second-writer controls and preserve broader route outcomes.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {requireBoundaryWriterTrace} from './inspect-native-boundary-writer.mjs';
import {requireSessionTrace} from './inspect-native-region-session.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {ownedDirectory,workspace} from './lib/stopped-entity-io.mjs';
const hash=async name=>(await hashNativeFile(name)).sha256;
export function requireBoundaryDeltaTrace(m,text){
  const original=requireBoundaryWriterTrace(m,text),trace=requireSessionTrace(m,text);
  const fresh=trace.attaches.filter(r=>r.mode==='new'),prefix='[frontier] Connected boundary delta writer ';
  const lines=text.split('\n').filter(r=>r.startsWith(prefix));assert.equal(lines.length,fresh.length);
  for(const [i,line]of lines.entries()){
    assert.equal(line,`${prefix}region=${fresh[i].region} edge-controls=8 interior-controls=1 original-writer=005f1a40 virtual-slot=32 empty-stores=1 result=pass`);
    const at=text.indexOf(line),first=text.indexOf(`[frontier] Connected boundary writer region=${fresh[i].region} `);
    const pre=text.indexOf(`[frontier] Region ${fresh[i].region} connected terrain comparison stage=pre-placement changed=0 border-changed=0`,at);
    assert.ok(first>=0&&first<at&&at<pre&&pre<fresh[i].position);
    if(i)assert.ok(at>fresh[i-1].position);
  }
  return {...original,deltaBoundaryAttempts:fresh.length*8,deltaInteriorAttempts:fresh.length};
}
async function main(){
  const [name,restorationName,auditName,out]=process.argv.slice(2);assert.equal(process.argv.length,6);
  const m=JSON.parse(await readFile(name,'utf8'));await ownedDirectory(m.fixture,'actor-arrival-fixture-session-');
  try{process.kill(m.nativePid,0);throw Error('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const text=await readFile(m.log,'utf8'),controls=requireBoundaryDeltaTrace(m,text);
  const build=JSON.parse(await readFile(m.buildReport,'utf8'));assert.equal(build.nativeBuildQualified,true);
  assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(await hash(m.log),m.logSha256);
  assert.equal(await hash('scripts/run-native-region-session.py'),m.runnerSha256);
  assert.equal(await hash(m.runnerSourceCopy),m.runnerSha256);
  assert.equal(await hash(join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  const symbolFile=join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json');
  assert.equal(await hash(symbolFile),build.nativeSymbolsSha256);
  const symbols=JSON.parse(await readFile(symbolFile,'utf8'));
  const entry=symbols.functions.find(r=>r.addr==='005f1a40');assert.ok(entry);
  assert.equal(entry.kind,'entry');assert.equal(entry.provenance,'config');assert.equal(entry.hookable,true);
  const compiled={...build.nativeSourceSha256,...build.nativeHeapRuntimeSourceSha256,...build.nativeOrderRuntimeSourceSha256};
  assert.equal(Object.keys(compiled).length,20);for(const [n,h]of Object.entries(compiled))assert.equal(await hash(n),h);
  const restored=JSON.parse(await readFile(restorationName,'utf8'));
  assert.equal(restored.manifestSha256,await hash(name));assert.equal(restored.fullTypedRestorationCompared,true);
  assert.equal(restored.nativeNamedProfilesQualified,true);assert.equal(restored.originalWorldRootReleaseQualified,true);
  const audit=JSON.parse(await readFile(auditName,'utf8'));
  assert.equal(audit.staticQualified,true);assert.equal(audit.entry,'005f1a40');assert.equal(audit.instructions.length,52);
  assert.equal(audit.virtualSlot,32);assert.equal(audit.argumentBytes,12);
  assert.deepEqual(audit.directHeightStores,['005f1a97','005f1ada']);
  const refusals=[];const refuse=(label,change)=>{assert.throws(()=>requireBoundaryDeltaTrace(m,change(text)));refusals.push(label);};
  refuse('missing delta controls',s=>s.replace(/^\[frontier\] Connected boundary delta writer .*\n/m,''));
  refuse('duplicate delta controls',s=>s+s.match(/^\[frontier\] Connected boundary delta writer .*$/m)[0]+'\n');
  refuse('wrong original virtual method',s=>s.replace('original-writer=005f1a40','original-writer=005f1f30'));
  refuse('wrong virtual slot',s=>s.replace('virtual-slot=32','virtual-slot=28'));
  refuse('incomplete boundary controls',s=>s.replace(/(Connected boundary delta writer .*?)edge-controls=8/,'$1edge-controls=7'));
  refuse('interior delta blocked',s=>s.replace(/(Connected boundary delta writer .*?)interior-controls=1/,'$1interior-controls=0'));
  refuse('occupied actor stores',s=>s.replace(/(Connected boundary delta writer .*?)empty-stores=1/,'$1empty-stores=0'));
  const evidence={};for(const n of [name,m.log,m.buildReport,restorationName,auditName,
    'scripts/audit-native-terrain-delta-writer.py','scripts/inspect-native-boundary-delta-writer.mjs',
    'scripts/inspect-native-boundary-writer.mjs','scripts/inspect-native-region-session.mjs'])evidence[resolve(n)]=await hash(n);
  await writeFile(out,JSON.stringify({version:1,terrainDeltaBoundaryProtectionQualified:true,...controls,
    nativePid:m.nativePid,compiledSourceSha256:compiled,evidenceSha256:evidence,refusals,
    fullTypedRestorationQualified:restored.fullTypedRestorationQualified,
    sharedHeightSeamsQualified:restored.sharedHeightSeamsQualified,
    scope:'Actual original virtual delta calls preserve four sides/corners and allow an interior edit before actor placement. '
      +'No occupied height repair. Historical seam causes, other writers, coordinated edits, navigation and browser memory are unqualified.',
    browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({terrainDeltaBoundaryProtectionQualified:true,...controls,refusals:refusals.length}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{await main();}catch(e){console.error(String(e.message).slice(0,600));process.exitCode=1;}
}
