#!/usr/bin/env node
// Contradict actual stopped travel evidence; reject the earlier empty-AI world.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {requireSessionTrace,requireSessionPopulation} from './inspect-native-region-session.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const [manifestName,failedName,out]=process.argv.slice(2);
assert.equal(process.argv.length,5,'Usage: <current stopped session> <earlier zero-agent session> <fresh report>');
const m=JSON.parse(await readFile(manifestName,'utf8')),failed=JSON.parse(await readFile(failedName,'utf8'));
for(const item of [m,failed]){
  assert.equal(item.nativeSessionTerminal,true);assert.equal(item.nativeExitCode,0);
  try{process.kill(item.nativePid,0);throw Error('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  assert.equal((await hashNativeFile(item.log)).sha256,item.logSha256);
}
const text=await readFile(m.log,'utf8');const trace=requireSessionTrace(m,text);
const controls=[];
function reject(name,changed){if(changed===text)throw Error(`Control did not change the trace: ${name}`);assert.throws(()=>requireSessionTrace(m,changed));controls.push(name);}
reject('missing source checkpoint',text.replace(/^.*Session checkpoint serial=1.*\n/m,''));
reject('missing complete quit lifecycle',text.replace(/^.*Session quit serial=1.*\n/m,''));
reject('save-loading mode retained',text.replace('clock=0 loading=0','clock=0 loading=1'));
reject('world remains live at profile switch',text.replace('world-null=1','world-null=0'));
reject('wrong named save profile',text.replace('target=-1_0 world-null=1 profile='+m.worldRoot+'/frontier_-1_0','target=-1_0 world-null=1 profile='+m.worldRoot+'/frontier_0_0'));
reject('regenerate previously saved kingdom',text.replace('region=0_0 mode=saved','region=0_0 mode=new'));
reject('missing partial-save refusal',text.replace(/^.*Session destination refused source=0_0 target=0_1.*\n/m,''));
reject('missing wrong-source refusal',text.replace(/^.*Session request refused region=0_0 serial=0.*\n/m,''));
reject('missing symlink refusal',text.replace(/^.*Session destination refused source=0_0 target=0_-1.*\n/gm,''));
reject('duplicate initialization event',text+text.split('\n').find(line=>line.startsWith('[frontier] Session enabled '))+'\n');
const savedSeedLine=text.split('\n').findLast(line=>line.startsWith('[frontier] Session rng restored '));
assert.ok(trace.seeds.length>=2&&savedSeedLine);
reject('missing RNG restoration',text.replace(savedSeedLine+'\n',''));
if(/ release=v[12]/.test(text)){
  reject('missing observed root disposal',text.replace(/^.*Session released serial=1 .*\n/m,''));
  reject('retained spatial table',text.replace('roots-freed=1,1,1,1,1,1','roots-freed=1,1,1,1,1,0'));
  reject('release acknowledged for wrong source',text.replace('Session released serial=1 region=0_0','Session released serial=1 region=-1_0'));
  reject('release acknowledged for wrong trip',text.replace('Session released serial=1','Session released serial=2'));
  reject('missing temporary observer removal',text.replace(/^.*Session release observer removed serial=1 .*\n/m,''));
  reject('retained observer identities',text.replace('retained-roots=0','retained-roots=1'));
  const release=text.split('\n').find(line=>line.startsWith('[frontier] Session released serial=1 '));
  reject('release before quit acknowledgement',release+'\n'+text.replace(release+'\n',''));
  if(text.includes(' release=v2')){
    reject('terrain cell buffer retained',text.replace('roots-freed=1,1,1,1,1,1,1,1','roots-freed=1,1,1,1,1,1,0,1'));
    reject('terrain vertex buffer retained',text.replace('roots-freed=1,1,1,1,1,1,1,1','roots-freed=1,1,1,1,1,1,1,0'));
    reject('terrain release downgraded to six roots',text.replace('roots-freed=1,1,1,1,1,1,1,1','roots-freed=1,1,1,1,1,1'));
    reject('wrong terrain geometry payload',text.replace('terrain-bytes=530456','terrain-bytes=530455'));
  }
}
const capture=failed.snapshotCaptures.find(row=>row.region==='-1_0');assert.ok(capture);
assert.equal((await hashNativeFile(capture.file)).sha256,capture.sha256);
const empty=await connectedWorldState(capture.file);assert.equal(empty.counts.units,438);assert.equal(empty.counts.agents,0);
assert.throws(()=>requireSessionPopulation(empty,'-1_0'));controls.push('actual original zero-agent generated kingdom');
const healthy=m.snapshotCaptures.find(row=>row.region==='-1_0');assert.equal((await hashNativeFile(healthy.file)).sha256,healthy.sha256);
const initialized=await connectedWorldState(healthy.file);requireSessionPopulation(initialized,'-1_0');
// A generated kingdom's population is not a fixed constant across trials.
// Require its actual serialized agents to be scheduled exactly once instead.
const scheduled=initialized.queues.flat();
assert.equal(scheduled.length,initialized.counts.agents);assert.equal(new Set(scheduled).size,scheduled.length);
assert.deepEqual(scheduled.map(String).sort(),Object.keys(initialized.records.agents).sort());
const evidenceSha256={};for(const name of [manifestName,failedName,m.log,failed.log,capture.file,healthy.file])evidenceSha256[resolve(name)]=(await hashNativeFile(name)).sha256;
await writeFile(out,JSON.stringify({version:1,controlsPassed:controls.length,controls,healthyAgents:initialized.counts.agents,
  earlierEmptyWorldRejected:true,healthyAgentsScheduledExactlyOnce:true,evidenceSha256,browserUsed:false,nativeProcessesStarted:0,
  scope:'Contradictions of the real native named-session lifecycle trace and the actual prior zero-agent save; browser gameplay and memory bounds remain unqualified.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controlsPassed:controls.length,earlierEmptyWorldRejected:true}));
