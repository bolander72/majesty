#!/usr/bin/env node
// Bind projected clock fields to a fresh physical original full-world reload.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectNativeOutdoorFamilyReload} from './inspect-native-outdoor-family-reload.mjs';
import {inspectNativeOutdoorFamilyClockProjection} from './inspect-native-outdoor-family-clock-projection.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {outdoorHash} from './lib/registered-hero-outdoor-save.mjs';
import {checkpointAgentValues} from '../web/world/checkpoint.mjs';
const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const reload=await inspectNativeOutdoorFamilyReload(name),parent=JSON.parse(await readFile(reload.parentProof,'utf8'));
const native=JSON.parse(await readFile(name,'utf8'));assert.equal(await outdoorHash(name),reload.manifestSha256);
const projected=await inspectNativeOutdoorFamilyClockProjection(parent.manifest);
assert.equal(projected.nativeExecutableSha256,reload.nativeExecutableSha256);
assert.equal(projected.selectedReceiptSha256,native.selectedReceiptSha256);
const observations=[];
for(const phase of ['Ready','Held']){
  const source=await stoppedFileSource(reload.worlds[phase].filename),contexts=[];
  for await(const v of checkpointAgentValues(source,reload.agentId))if(v.type===8){
    const b=Buffer.from(await source.readAt(v.stateOffset,16));contexts.push({attribute:v.attribute,path:[...v.path],
      state:Array.from({length:4},(_,i)=>b.readUInt32LE(i*4)),functions:v.functions.map(f=>f.name)});
  }
  assert.deepEqual(contexts,projected.observations.find(o=>o.phase===phase).contexts);
  observations.push({phase,world:reload.worlds[phase],contexts});
}
const sourceSha256={};for(const n of ['scripts/inspect-native-outdoor-family-clock-reload.mjs','scripts/inspect-native-outdoor-family-clock-projection.mjs',
  'web/world/actor-family-clocks.mjs','web/world/family-order-entries.mjs'])sourceSha256[n]=await outdoorHash(join(workspace,n));
await writeFile(out,JSON.stringify({...reload,version:1,originalNativeFamilyClockProjectionFullReloadQualified:true,
  projectionManifest:projected.manifest,projectionManifestSha256:projected.manifestSha256,
  selectedReceipt:native.selectedReceipt,selectedReceiptSha256:native.selectedReceiptSha256,
  projectedActiveScriptContexts:1,unchangedInactiveContexts:11,projectedOrderClockSites:5,clockObservations:observations,
  sourceSha256:{...reload.sourceSha256,...sourceSha256},
  scope:'A fresh original full-world load preserves the jointly projected active script and five command stamps, all other saved records, real collision/drawing membership and one AI queue entry. Both family guards install before the first update and remain through the hold. This qualifies saved clock restoration, not ordinary remote continuation, live owner publication or continuous spatial crossing.',
  activeRemoteContinuationQualified:false,nativeOwnershipActivationQualified:false,seamlessHeroCrossingQualified:false,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({originalNativeFamilyClockProjectionFullReloadQualified:true,heroId:reload.heroId,agentId:reload.agentId,
  scriptContexts:1,orderClockSites:5,heroCollisionCells:reload.heroCollisionCells,guardsBeforeFirstUpdate:reload.guardsBeforeFirstUpdate,browserUsed:false}));
