#!/usr/bin/env node
// Refuse false live-publication claims against the actual captured native run.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {verifyNativePausedHomeOwner} from './lib/native-paused-home-owner.mjs';
import {inspectNativeSelectedHomeSession} from './inspect-native-selected-home-session.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const observed=await inspectNativeSelectedHomeSession(name);assert.equal(observed.liveOwner.nativePausedOwnershipPublicationQualified,true);
const m=JSON.parse(await readFile(name,'utf8')),prep=JSON.parse(await readFile(m.preparation,'utf8')),log=await readFile(m.log,'utf8');
const cases=[
  ['wrong transaction nonce',copy=>{copy.liveOwner.nonce='0'.repeat(64);}],
  ['earlier receiving retirement substituted',copy=>{copy.snapshotCaptures[0].clock=26350;}],
  ['home already advanced before publication',copy=>{copy.liveOwner.pausedCapture.clock=57700;}],
  ['wrong acknowledgement',copy=>{copy.liveOwner.acknowledgement=copy.liveOwner.acknowledgement.replace('native-owner-resume-v1','native-owner-resume-v2');}],
  ['missing native delivery liveness',copy=>{copy.liveOwner.publication.nativeAliveAtDelivery=false;}],
  ['resumption before ownership publication',copy=>{copy.liveOwner.publication.deliveredAtMs=m.startedAtMs;}],
];
const refused=[];for(const[label,mutate]of cases){const copy=structuredClone(m);mutate(copy);await assert.rejects(verifyNativePausedHomeOwner(copy,prep,log));refused.push(label);}
const refusal='[frontier] Owner acknowledgement refused serial=1 region=0_0 clock=57650';
await assert.rejects(verifyNativePausedHomeOwner(m,prep,log.replace(refusal,'')));refused.push('missing engine refusal evidence');
await assert.rejects(verifyNativePausedHomeOwner(m,prep,log.replace('Owner resumed serial=1 region=0_0 clock=57650','Owner resumed serial=1 region=0_0 clock=57700')));refused.push('simulation advanced during pause');
await inspectNativeSelectedHomeSession(name);
await writeFile(out,JSON.stringify({version:1,nativePausedHomeOwnerControlsQualified:true,manifest:resolve(name),manifestSha256:(await hashNativeFile(name)).sha256,
  refused,originalInputsUnchanged:true,nativeProcessesStarted:0,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativePausedHomeOwnerControlsQualified:true,refused:refused.length,browserUsed:false}));
