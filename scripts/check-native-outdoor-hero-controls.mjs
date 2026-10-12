#!/usr/bin/env node
// Contradict the stopped original-AI departure without running an engine.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {requireSessionTrace,requireOutdoorHeroCheckpoint} from './inspect-native-region-session.mjs';
const [manifest,out]=process.argv.slice(2);assert.ok(manifest&&out);
const m=JSON.parse(await readFile(manifest,'utf8'));
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);throw Error('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
const text=await readFile(m.log,'utf8');assert.equal(createHash('sha256').update(text).digest('hex'),m.logSha256);
const trace=requireSessionTrace(m,text);assert.ok(trace.outdoorHero);
const initial={clock:31800};await requireOutdoorHeroCheckpoint(m,trace,initial);
const line=m.outdoorHeroObservation.line,controls=[];
function reject(name,from,to){
  assert.ok(line.includes(from));const changed=line.replace(from,to);assert.notEqual(changed,line);
  assert.throws(()=>requireSessionTrace({...m,outdoorHeroObservation:{...m.outdoorHeroObservation,line:changed}},text.replace(line,changed)));
  controls.push(name);
}
reject('wrong selected hero','hero=504','hero=505');reject('wrong selected agent','agent=28','agent=29');
reject('borrowed guild','guild=469','guild=470');reject('discarded script home','home=7','home=0');
reject('still inside guild','parent=0','parent=469');reject('missing physical footprint','cells=4','cells=0');
reject('unscheduled hero','queued=1','queued=0');reject('drawing absent','drawing=1','drawing=0');
reject('native home absent','native-home=1','native-home=0');reject('non-original movement','original-ai=1','original-ai=0');
const resident=text.split('\n').find(s=>s.startsWith('[streaming] Session hero observed phase=resident '));assert.ok(resident);
assert.throws(()=>requireSessionTrace(m,text.replace(resident+'\n','')));controls.push('missing actual resident predecessor');
const publication=m.requestPublications.find(r=>r.kind==='boundary'||r.kind==='travel');
assert.throws(()=>requireSessionTrace({...m,outdoorHeroObservation:{...m.outdoorHeroObservation,observedAtMs:publication.publishedAtMs+1}},text));controls.push('departure published before observation');
await assert.rejects(requireOutdoorHeroCheckpoint(m,{...trace,outdoorHero:{...trace.outdoorHero,clock:'56700'}},initial));
controls.push('outdoor observation before original rest deadline');
await writeFile(out,JSON.stringify({controlsPassed:controls.length,controls,manifest,logSha256:m.logSha256,
  browserUsed:false,nativeProcessesStarted:0,heroTransferred:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controlsPassed:controls.length}));
