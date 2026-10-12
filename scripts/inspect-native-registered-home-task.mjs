#!/usr/bin/env node
// Read-only local task/identity binding. This creates no selected hero owner,
// remote guild, native process or browser session.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {inspectNativeHomeMotion} from './inspect-native-home-motion.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {decodeHomeRecord,guildHomeFilename,MAX_HOME_RECORD_BYTES} from '../web/world/hero-home.mjs';
import {inspectRegisteredHomeTask} from '../web/world/hero-home-task.mjs';

const [motionManifest,registrationDirectory,output]=process.argv.slice(2);
assert.equal(process.argv.length,5,'Usage: <stopped motion manifest> <existing registration directory> <fresh proof>');
const directory=resolve(registrationDirectory);
assert.equal(directory.slice(0,join(workspace,'output').length+1),join(workspace,'output')+'/');
const registrationPath=join(directory,'registration-observed.json');
assert.ok((await stat(registrationPath)).size<=65536);
const registration=JSON.parse(await readFile(registrationPath,'utf8'));
assert.equal(registration.persistentHomeMetadataQualified,true);
const motion=await inspectNativeHomeMotion(motionManifest),r=registration.registration;
assert.ok((await stat(motionManifest)).size<=65536);
const manifest=JSON.parse(await readFile(motionManifest,'utf8'));
assert.equal(manifest.sourceManifestSha256,registration.sourceManifestSha256);
assert.equal(manifest.initializedSourceSha256,r.home.originCheckpointSha256);
assert.equal(manifest.inputHashes['mod-settings.json'],registration.contentDescriptor.modSettingsSha256);
const filename=join(directory,guildHomeFilename({region:r.home.region,unitId:r.home.unitId,agentId:r.home.agentId}));
const before=await hashNativeFile(filename,{maximum:MAX_HOME_RECORD_BYTES});
assert.equal(before.sha256,registration.canceled.sha256);
const record=decodeHomeRecord(new Uint8Array(await readFile(filename)),{worldId:r.worldId,contentDigest:r.contentDigest,guildEntityId:r.guildEntityId});
assert.equal(record.pending,null);assert.deepEqual(record.members,r.members);
const owner={entityId:r.members[0].entityId,region:r.home.region,unitId:r.members[0].unitId,agentId:r.members[0].agentId};
const tasks=[];
for(const world of motion.worlds) {
  const descriptor=await hashNativeFile(world.filename);assert.equal(descriptor.sha256,world.sha256);
  const request=await inspectRegisteredHomeTask(await stoppedFileSource(world.filename),
    {owner,registered:{record,sha256:before.sha256},worldId:r.worldId,contentDigest:r.contentDigest});
  tasks.push({filename:world.filename,sha256:world.sha256,clock:world.clock,request});
}
assert.deepEqual(tasks.map(t=>t.request?.continuation??null),['travel_to','travel_to',null]);
assert.deepEqual(tasks[0].request,tasks[1].request);
assert.equal((await hashNativeFile(filename)).sha256,before.sha256);
const modulePaths=['web/world/hero-home-task.mjs','web/world/hero-home.mjs','web/world/entity-revisions.mjs'];
const moduleSha256={};for(const p of modulePaths)moduleSha256[p]=(await hashNativeFile(join(workspace,p))).sha256;
const report={version:1,originalLocalHomeTaskIdentityBindingQualified:true,
  scope:'Read-only inspection of the native057 descendants of registered native045 source002. Two held original tasks resolve to the existing stable guild/member IDs. Original local guild entry produces no further return request. The fixture content descriptor remains the native045 registration binding; this does not establish cross-build content compatibility or publish current hero ownership.',
  registrationProof:registrationPath,registrationProofSha256:(await hashNativeFile(registrationPath)).sha256,
  homeFilename:filename,homeSha256:before.sha256,motionManifest:resolve(motionManifest),motionManifestSha256:motion.sourceManifestSha256,
  guildEntityId:r.guildEntityId,heroEntityId:owner.entityId,tasks,moduleSha256,
  selectedNativeHeroOwnerPublished:false,remoteHomeRoutingQualified:false,playerHeroCrossingQualified:false,
  browserUsed:false,nativeProcessesStarted:0,nativeBuildsStarted:0,registryUnchanged:true};
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({originalLocalHomeTaskIdentityBindingQualified:true,requests:tasks.filter(t=>t.request).length,
  completedTaskIgnored:true,registryUnchanged:true,remoteHomeRoutingQualified:false,nativeProcessesStarted:0,browserUsed:false}));
