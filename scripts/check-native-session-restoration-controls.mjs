#!/usr/bin/env node
// Refuse contradictions in the actual multi-region before-tick trace.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {requireSessionTrace,requireSessionReadyTrace} from './inspect-native-region-session.mjs';
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const raw=await readFile(name,'utf8'),m=JSON.parse(raw),text=await readFile(m.log,'utf8');
const check=(meta,log)=>requireSessionReadyTrace(meta,log,requireSessionTrace(meta,log));
check(m,text);const results=[];
const firstReady=text.match(/^\[frontier\] Session ready snapshot .*$/m)[0];
function changeReady(log,from,to){
  const changed=firstReady.replace(from,to);assert.notEqual(changed,firstReady);
  return log.replace(firstReady,changed);
}
function refuse(label,change){const meta=structuredClone(m);let log=text;
  log=change(meta,log)??log;assert.throws(()=>check(meta,log));results.push(label);}
refuse('absent original ready capture',meta=>{meta.readyCaptures.pop();});
refuse('missing native snapshot event',(_,log)=>log.replace(/^\[frontier\] Session ready snapshot .*\n/m,''));
refuse('duplicate native snapshot event',(_,log)=>log+log.match(/^\[frontier\] Session ready snapshot .*$/m)[0]+'\n');
refuse('gameplay tick before snapshot',(_,log)=>changeReady(log,'ordinary-ticks=0 guards=0','ordinary-ticks=1 guards=0'));
refuse('actor guard substituted for ordinary load',(_,log)=>changeReady(log,'ordinary-ticks=0 guards=0','ordinary-ticks=0 guards=1'));
refuse('wrong ready serial',(_,log)=>log.replace('Session ready snapshot serial=0','Session ready snapshot serial=1'));
refuse('wrong region capture',meta=>{meta.readyCaptures[1].region='0_0';});
refuse('substituted capture clock',meta=>{meta.readyCaptures[0].clock+=50;});
refuse('changed world across writer',(_,log)=>changeReady(log,'guards=0 world-same=1','guards=0 world-same=0'));
refuse('retained diagnostic hook',(_,log)=>changeReady(log,'world-same=1 hooks-same=1 saved=1','world-same=1 hooks-same=0 saved=1'));
refuse('failed original full save',(_,log)=>changeReady(log,'hooks-same=1 saved=1','hooks-same=1 saved=0'));
refuse('duplicate field in native event',(_,log)=>changeReady(log,'ordinary-ticks=0 guards=0','ordinary-ticks=0 ordinary-ticks=0 guards=0'));
refuse('unfinished travel route',meta=>{meta.nativeRouteCompleted=false;});
refuse('ordinary session mislabeled as snapshot probe',meta=>{meta.readyStateExpected=false;});
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(await readFile(name,'utf8'),raw);assert.equal(await readFile(m.log,'utf8'),text);
await writeFile(out,JSON.stringify({version:1,readyTraceControlsQualified:true,refusals:results,
  manifest:resolve(name),manifestSha256:hash(raw),logSha256:hash(text),browserUsed:false,nativeProcessesStarted:0,
  scope:'Contradictory copies of the actual ready trace refuse. Full typed checkpoint equality is checked independently by the region-session inspector.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({readyTraceControlsQualified:true,refusals:results.length}));
