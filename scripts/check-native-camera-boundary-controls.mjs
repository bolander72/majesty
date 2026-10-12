#!/usr/bin/env node
// Contradict a real stopped camera event; no game or browser is launched.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {requireSessionTrace,requireBoundaryTrace} from './inspect-native-region-session.mjs';
const [manifest,out]=process.argv.slice(2);assert.ok(manifest&&out);
const m=JSON.parse(await readFile(manifest,'utf8'));
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);assert.fail('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
const text=await readFile(m.log,'utf8');assert.equal(createHash('sha256').update(text).digest('hex'),m.logSha256);
const trace=requireSessionTrace(m,text);assert.ok(trace.boundary);const position=trace.saves[0].position;
const controls=[];
function reject(name,from,to){
  const line=m.boundaryTrigger.line;assert.ok(line.includes(from));const changed=line.replace(from,to);
  assert.throws(()=>requireBoundaryTrace({...m,boundaryTrigger:{...m.boundaryTrigger,line:changed}},text.replace(line,changed),position));controls.push(name);
}
const fields=Object.fromEntries(m.boundaryTrigger.line.slice('[frontier] Session boundary '.length).split(' ').map(s=>s.split('=')));
reject('wrong source','region=0_0','region=-1_0');reject('wrong session','serial=0','serial=1');
reject('interior origin',`x=${fields.x} `,'x=1 ');reject('no outward input',`dx=${fields.dx} `,'dx=0 ');
reject('insufficient hold',`held-ms=${fields['held-ms']}`,'held-ms=999');
reject('empty geometry',`max-x=${fields['max-x']} `,'max-x=0 ');
reject('out-of-range origin',`y=${fields.y} `,`y=${+fields['max-y']+1} `);
assert.throws(()=>requireBoundaryTrace(m,text.replace('vtable=00680e14','vtable=0068a784'),position));controls.push('unqualified gameplay camera');
assert.throws(()=>requireBoundaryTrace(m,text.replace('valid=1','valid=0'),position));controls.push('invalid camera');
assert.throws(()=>requireBoundaryTrace({...m,boundaryTrigger:null},text,position));controls.push('missing actual trigger');
await writeFile(out,JSON.stringify({controlsPassed:controls.length,controls,manifest,logSha256:m.logSha256,
  browserUsed:false,nativeProcessesStarted:0,continuousSpatialTravelQualified:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controlsPassed:controls.length}));
