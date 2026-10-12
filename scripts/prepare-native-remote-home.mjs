#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {inspectConnectedLoadTransforms} from './inspect-native-connected-load-transforms.mjs';
import {inspectGeneratedHero} from './inspect-native-generated-hero.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {decodeHomeRecord,guildHomeFilename,MAX_HOME_RECORD_BYTES} from '../web/world/hero-home.mjs';
import {prepareRemoteHomeAgent} from '../web/world/remote-home.mjs';
const [output]=process.argv.slice(2);assert.equal(process.argv.length,3,'Usage: <fresh remote-home preparation directory>');
const directory=resolve(output);assert.equal(dirname(directory),join(workspace,'output'));assert.match(basename(directory),/^remote-home-preparation-[0-9]{3}$/);
const regProofPath=join(workspace,'output/hero-home-registration-002/registration-observed.json');
assert.ok((await stat(regProofPath)).size<65536);
const regProof=JSON.parse(await readFile(regProofPath,'utf8')),origin=await inspectGeneratedHero(regProof.sourceManifest);
assert.equal(origin.save.sha256,regProof.registration.home.originCheckpointSha256);
const residencyManifest=join(workspace,'output/native-connected-residency-attempt-007.json');
assert.equal(JSON.parse(await readFile(regProof.sourceManifest,'utf8')).sourceManifest,residencyManifest);
const qualification=await inspectConnectedLoadTransforms(residencyManifest,join(workspace,'output/native-connected-load-transforms-setter-audit.json'));
assert.equal(qualification.generatedRegionInitializationQualified,true);
const residency=JSON.parse(await readFile(residencyManifest,'utf8'));
const destination=join(residency.profile,'Residency_Visit_0_After.GMP'),world=await connectedWorldState(destination);
const homePath=join(dirname(regProofPath),guildHomeFilename({region:'0_0',unitId:469,agentId:7}));
const homeHash=await hashNativeFile(homePath,{maximum:MAX_HOME_RECORD_BYTES});assert.equal(homeHash.sha256,regProof.canceled.sha256);
const r=regProof.registration,registered={record:decodeHomeRecord(new Uint8Array(await readFile(homePath)),
  {worldId:r.worldId,contentDigest:r.contentDigest,guildEntityId:r.guildEntityId}),sha256:homeHash.sha256};
const options={worldId:r.worldId,contentDigest:r.contentDigest,destinationRegion:'1_0',freshAgentId:100000};
const result=await prepareRemoteHomeAgent(await stoppedFileSource(destination),registered,options);
await mkdir(directory);const filename=join(directory,'Remote_Home_Proposal.GPL');await writeFile(filename,result.record,{flag:'wx'});
const report={version:1,remoteHomeProposalPrepared:true,scope:'Inert pure original-GPL representation of the actual registered0_0 guild for the initialized neighboring1_0 world. Proposed agent ID is unreserved; original reader/registration/save/reload remain to qualify. Legacy native045 fixture content binding only; no hero import or owner publication.',
  sourceManifest:regProof.sourceManifest,sourceManifestSha256:regProof.sourceManifestSha256,
  registrationProof:regProofPath,registrationProofSha256:(await hashNativeFile(regProofPath)).sha256,
  registered,homeFilename:homePath,residencyManifest,residencyManifestSha256:(await hashNativeFile(residencyManifest)).sha256,
  destination:{filename:destination,bytes:world.bytes,sha256:world.sha256,clock:world.clock},settingsSource:origin.save.filename,
  settingsProfile:JSON.parse(await readFile(regProof.sourceManifest,'utf8')).profile,
  inputHashes:JSON.parse(await readFile(regProof.sourceManifest,'utf8')).inputHashes,
  record:{filename,bytes:result.record.length,sha256:(await hashNativeFile(filename)).sha256},plan:result.plan,
  sourceSha256:{'web/world/remote-home.mjs':(await hashNativeFile(join(workspace,'web/world/remote-home.mjs'))).sha256},
  nativeProcessesStarted:0,browserUsed:false,heroCrossingQualified:false};
await writeFile(join(directory,'remote-home-preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({remoteHomeProposalPrepared:true,bytes:result.record.length,region:'1_0',nativeProcessesStarted:0,browserUsed:false}));
