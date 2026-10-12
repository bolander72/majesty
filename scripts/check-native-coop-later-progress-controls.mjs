#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectLaterTargetProgress} from './inspect-native-coop-later-target-progress.mjs';
const [name,output]=process.argv.slice(2);assert.equal(process.argv.length,4);
const m=JSON.parse(await readFile(resolve(name))),positive=await inspectLaterTargetProgress(name);
assert.equal(positive.originalRole,'host');assert.equal(positive.originalClock,1000);
const cases=[
 ['later-observation-disabled',r=>{r.nativeLaterTargetProgressSnapshotRequested=false;}],
 ['later-world-not-saved',r=>{r.originalLaterTargetProgressSaved=false;}],
 ['altered-later-world-custody',r=>{r.laterTargetProgressSnapshot.sha256='0'.repeat(64);}],
 ['earlier-world-presented-as-later',r=>{r.laterTargetProgressSnapshot=r.targetProgressSnapshot;}],
 ['unacknowledged-peer-inputs',r=>{r.originalGuestTargetInputsDelivered=false;}],
];
const scratch=resolve('output/native-multiplayer-lobby-982-observed.json'),results=[];let created=false;
try{for(const [name,mutate]of cases){const copy=structuredClone(m);mutate(copy);
 await writeFile(scratch,JSON.stringify(copy),{flag:'wx'});created=true;
 await assert.rejects(()=>inspectLaterTargetProgress(scratch),undefined,name);
 await unlink(scratch);created=false;results.push({name,passed:true});}}
finally{if(created)await unlink(scratch);}
await writeFile(resolve(output),JSON.stringify({controls:results.length,results,originalClock:1000,
 nativeProcessesStarted:0,browserUsed:false,livePairedSynchronizationQualified:false,
 goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controls:results.length,passed:true,clock:1000,livePaired:false}));
