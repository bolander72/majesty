#!/usr/bin/env node
// Contradictory saved progression must fail without touching player files.
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectTargetProgress,inspectTargetProgressPair} from './inspect-native-coop-target-progress.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {compareProgressGameplay,advisorNotificationClocks} from './lib/coop-progress-checkpoint-state.mjs';
import {checkpointChunks} from '../web/world/checkpoint.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
const [hostName,guestName,output]=process.argv.slice(2);assert.equal(process.argv.length,5);
const pair=await inspectTargetProgressPair(hostName,guestName);
const states=await Promise.all([pair.host,pair.guest].map(p=>connectedWorldState(p.snapshot.path)));
const level=(pair.host.kingdoms[0].palace[0].description>>>24)-48,results=[];
const comparisonCases=[
 ['held-world-clock',s=>{s[1].clock=0;}],
 ['different-positive-clock',s=>{s[1].clock=550;}],
 ['different-script-rng',s=>{s[1].rng^=1;}],
 ['different-gameplay-rng',s=>{s[1].gameplayRng^=1;}],
 ['changed-world-custody',s=>{s[1].sha256='0'.repeat(64);}],
 ['changed-terrain-gameplay',s=>{s[1].roots.find(r=>r.tag==='MTER').sha256='0'.repeat(64);}],
 ['changed-gpl-contents',s=>{s[1].roots.find(r=>r.tag==='GPL ').sha256='0'.repeat(64);}],
 ['changed-agent-record',s=>{Object.values(s[1].records.agents)[0].sha256='0'.repeat(64);}],
 ['changed-unit-record',s=>{const selected=pair.guest.kingdoms[1].palace[0].unitId;const id=Object.keys(s[1].records.units).find(id=>Number(id)!==selected);assert.ok(id);s[1].records.units[id].sha256='0'.repeat(64);}],
];
for(const [name,mutate]of comparisonCases){const copy=structuredClone(states);mutate(copy);await assert.rejects(()=>compareProgressGameplay(...copy,level),undefined,name);results.push({name,passed:true});}
const source=await stoppedFileSource(pair.host.snapshot.path);let globals;
for await(const chunk of checkpointChunks(source))if(chunk.tag==='GSGL')globals=Buffer.from(await source.readAt(chunk.offset+16,chunk.size));
assert.ok(globals);advisorNotificationClocks(globals,0);
const advisorCases=[
 ['advisor-version-changed',b=>{b.writeUInt32LE(2,226);return b;}],
 ['advisor-timeout-changed',b=>{b.writeUInt32LE(20001,230);return b;}],
 ['advisor-auxiliary-state-changed',b=>{b.writeUInt32LE(1,234);return b;}],
 ['advisor-local-clock-changed',b=>{b.writeUInt32LE(501,238);return b;}],
 ['advisor-remote-clock-changed',b=>{b.writeUInt32LE(500,420);return b;}],
 ['advisor-enabled-state-changed',b=>{b.writeUInt32LE(0,242);return b;}],
 ['advisor-layout-truncated',b=>b.subarray(0,b.length-1)],
];
for(const [name,mutate]of advisorCases){assert.throws(()=>advisorNotificationClocks(mutate(Buffer.from(globals)),0),undefined,name);results.push({name,passed:true});}
assert.throws(()=>advisorNotificationClocks(globals,2));results.push({name:'unsupported-advisor-local-slot',passed:true});
const metadata=JSON.parse(await readFile(resolve(hostName))),scratch=resolve('output/native-multiplayer-lobby-979-observed.json');
const evidenceCases=[
 ['progress-observation-disabled',r=>{r.nativeTargetProgressSnapshotRequested=false;}],
 ['progress-file-not-saved',r=>{r.originalTargetProgressSaved=false;}],
 ['changed-progress-digest',r=>{r.targetProgressSnapshot.sha256='0'.repeat(64);}],
 ['changed-progress-size',r=>{r.targetProgressSnapshot.bytes++;}],
 ['borrowed-held-target',r=>{r.targetProgressSnapshot=r.loadedTargetSnapshot;}],
 ['borrowed-departure-snapshot',r=>{r.targetProgressSnapshot=r.worldSnapshots[1];}],
];
let created=false;
try{for(const [name,mutate]of evidenceCases){const copy=structuredClone(metadata);mutate(copy);await writeFile(scratch,JSON.stringify(copy),{flag:'wx'});created=true;
 await assert.rejects(()=>inspectTargetProgress(scratch),undefined,name);await unlink(scratch);created=false;results.push({name,passed:true});}}
finally{if(created)await unlink(scratch);}
await writeFile(resolve(output),JSON.stringify({controls:results.length,results,positiveOriginalClock:500,
 recordedRolePostResumeGameplayEqualityQualified:true,livePairedSynchronizationQualified:false,
 nativeProcessesStarted:0,browserUsed:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controls:results.length,passed:true,livePaired:false}));
