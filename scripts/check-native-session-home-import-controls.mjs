#!/usr/bin/env node
// A saved prepared world or incomplete attachment is not a fresh live import.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectNativeSelectedHomeSession} from './inspect-native-selected-home-session.mjs';
import {verifyNativeSessionHomeImport} from './lib/native-session-home-import.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const result=await inspectNativeSelectedHomeSession(name);assert.equal(result.freshHomeActorImportQualified,true);
const m=JSON.parse(await readFile(name,'utf8')),prep=JSON.parse(await readFile(m.preparation,'utf8')),log=await readFile(m.log,'utf8');
const home=JSON.parse(await readFile(m.homeProof,'utf8')),refused=[];
for(const[label,mutate]of [
  ['pre-imported home world used as initial input',copy=>{const r=copy.inputs.find(r=>r.region==='0_0');r.source=home.worlds.Ready.filename;r.sourceSha256=home.worlds.Ready.sha256;}],
  ['preparation producer no longer alive',copy=>{copy.liveImport.preparation.nativeAliveAfterPreparation=false;}],
  ['preserved prepared actor substituted for current preparation',copy=>{copy.liveImport.saves.find(r=>r.filename.endsWith('Family_Return_Ready.GMP')).filename=home.worlds.Ready.filename;}],
  ['current input record damaged',copy=>{copy.liveImport.records.find(r=>r.filename.endsWith('Family_Proposal_527.UNIT')).sha256='0'.repeat(64);}],
]){const copy=structuredClone(m);mutate(copy);await assert.rejects(verifyNativeSessionHomeImport(copy,prep,log));refused.push(label);}
for(const[label,changed]of [
  ['original constructor missing',log.replace('Family unit stage source=528 status=00000000 complete=1 failure=0','Family unit stage source=528 status=00000000 complete=0 failure=0')],
  ['deferred placement claimed ready',log.replace('clock=57650 physical=4 drawing=1 native-home=469/7','clock=57650 physical=0 drawing=1 native-home=469/7')],
  ['original world disposal missing',log.replace('Session released serial=1 region=0_0 roots-freed=1,1,1,1,1,1,1,1','Session released serial=1 region=0_0 roots-freed=0,0,0,0,0,0,0,0')],
  ['ordinary tick before owner publication',log.replace('Session home import ready hero=530 effects=531,532,533 agent=31 clock=57650 physical=4 drawing=1 native-home=469/7 script-roster=1 queued=1 new-this-session=1 ordinary-ticks=0','Session home import ready hero=530 effects=531,532,533 agent=31 clock=57650 physical=4 drawing=1 native-home=469/7 script-roster=1 queued=1 new-this-session=1 ordinary-ticks=1')],
]){await assert.rejects(verifyNativeSessionHomeImport(m,prep,changed));refused.push(label);}
await inspectNativeSelectedHomeSession(name);
await writeFile(out,JSON.stringify({version:1,nativeSessionHomeImportControlsQualified:true,manifest:resolve(name),manifestSha256:(await hashNativeFile(name)).sha256,
  refused,originalInputsUnchanged:true,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeSessionHomeImportControlsQualified:true,refused:refused.length,browserUsed:false}));
