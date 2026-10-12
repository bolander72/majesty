#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectNativeSelectedHomeSession} from './inspect-native-selected-home-session.mjs';
import {inspectInterruptedHomeCheckpoint} from './lib/interrupted-home-checkpoint.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const observed=await inspectNativeSelectedHomeSession(name,{interruptedBeforeResume:true});
assert.equal(observed.nativeInterruptedHomeOwnershipQualified,true);assert.equal(observed.freshHomeActorImportQualified,true);
const m=JSON.parse(await readFile(name,'utf8')),prep=JSON.parse(await readFile(m.preparation,'utf8'));
const pub=JSON.parse(await readFile(m.liveOwner.publication.filename,'utf8')),sourceSha256={};
for(const n of ['scripts/qualify-native-interrupted-home-checkpoint.mjs','scripts/lib/interrupted-home-checkpoint.mjs','scripts/inspect-native-selected-home-session.mjs',
  'scripts/lib/native-paused-home-owner.mjs','scripts/lib/native-session-home-import.mjs','web/world/entity-revisions.mjs','web/world/entity-ownership.mjs'])sourceSha256[n]=(await hashNativeFile(join(workspace,n))).sha256;
await writeFile(out,JSON.stringify({version:1,nativeInterruptedHomeCheckpointQualified:true,
  nativeSessionManifest:resolve(name),nativeSessionManifestSha256:observed.manifestSha256,fixture:m.liveOwner.directory,identity:prep.identity,
  previousManifest:prep.selectedManifest,selectedManifest:pub.selectedManifest,selectedState:pub.selectedState,selectedOwner:pub.selectedOwner,inputs:pub.inputs,
  sourcePreparation:m.preparation,sourcePreparationSha256:m.preparationSha256,originalEngineAcknowledgementDelivered:false,originalEngineExitCode:-15,
  freshHomeActorImportQualified:true,sourceSha256,browserUsed:false,nativeProcessesStarted:0,
  scope:'The supervised native engine was terminated after durable revision6 publication and before acknowledgement delivery. The sole home owner and its current-session fresh import are independently checked. Loading and ordinary recovery in another process remain a separate requirement.'},null,2)+'\n',{flag:'wx'});
await inspectInterruptedHomeCheckpoint(out);console.log(JSON.stringify({nativeInterruptedHomeCheckpointQualified:true,revision:6,owner:pub.selectedOwner,browserUsed:false}));
