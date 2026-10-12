#!/usr/bin/env node
// Contradict actual stopped arrival evidence without launching a game.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {requireSessionTrace} from './inspect-native-region-session.mjs';
const [manifest,out]=process.argv.slice(2);assert.ok(manifest&&out);
const m=JSON.parse(await readFile(manifest,'utf8'));
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);throw Error('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
const text=await readFile(m.log,'utf8');assert.equal(createHash('sha256').update(text).digest('hex'),m.logSha256);
const trace=requireSessionTrace(m,text);assert.equal(trace.cameraArrivals.length,2);
const line=text.split('\n').find(s=>s.startsWith('[frontier] Session camera arrived serial=1 '));
const second=text.split('\n').find(s=>s.startsWith('[frontier] Session camera arrived serial=2 '));
const controls=[];
function reject(name,changed){
  assert.notEqual(changed,text);
  assert.throws(()=>requireSessionTrace(m,changed));controls.push(name);
}
function field(name,key,value,original=line){
  const changed=original.replace(new RegExp(`(^| )${key}=[^ ]+`),`$1${key}=${value}`);
  assert.notEqual(changed,original);reject(name,text.replace(original,changed));
}
field('wrong arrival serial','serial',2);field('wrong destination','region','0_0');
field('wrong incoming direction','direction',3);field('wrong opposite edge','x',0);
field('wrong orthogonal position','y',66);field('wrong source coordinate','source-y',66);
field('empty destination extent','max-x',0);field('out-of-range source','source-x',16777217);
field('new region clock advanced before arrival','clock',50);
field('saved region clock advanced before arrival','clock',+trace.cameraArrivals[1].clock+50,second);
reject('missing arrival',text.replace(line+'\n',''));
reject('duplicated arrival',text.replace(line,line+'\n'+line));
const ready='[frontier] Region -1_0 ready';assert.ok(text.includes(ready));
reject('arrival after ready',text.replace(line+'\n','').replace(ready,ready+'\n'+line));
const attached=text.split('\n').find(s=>s.startsWith('[frontier] Session attached serial=1 '));assert.ok(attached);
reject('arrival before attachment',text.replace(line+'\n','').replace(attached,line+'\n'+attached));
await writeFile(out,JSON.stringify({controlsPassed:controls.length,controls,manifest,logSha256:m.logSha256,
  browserUsed:false,nativeProcessesStarted:0,continuousSpatialTravelQualified:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controlsPassed:controls.length}));
