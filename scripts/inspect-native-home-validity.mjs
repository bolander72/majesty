#!/usr/bin/env node
// Independently check the actual stopped original validity trial and inputs.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {inspectConnectedLoadTransforms} from './inspect-native-connected-load-transforms.mjs';
import {originalHomeValidityTrace} from './lib/home-validity-trace.mjs';
import {checkpointAgents,checkpointActorRecords} from '../web/world/checkpoint.mjs';
const hash=async p=>(await hashNativeFile(p)).sha256;
async function json(p){assert.ok((await stat(p)).size<=65536);return JSON.parse(await readFile(p,'utf8'));}
export async function inspectNativeHomeValidity(name){
 const m=await json(name);assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.stopReason],[true,false,true,0,null]);
 assert.equal(m.homeValidityFixture,'v1');assert.equal(m.homeValidityTrialCompleted,true);
 assert.equal(m.initializedSourceUnchanged,true);assert.equal(m.sourceCopyUnchanged,true);assert.equal(m.originalSettingsUnchanged,true);
 const dir=await ownedDirectory(m.fixture,'actor-arrival-fixture-home-validity-');assert.equal(m.profile,join(dir,'frontier_0_0'));
 assert.equal(m.script,join(dir,'load-home.script'));assert.equal(await hash(m.script),m.scriptSha256);
 const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
 assert.equal(await hash(build.log),build.logSha256);assert.ok(build.finishedAtMs<=m.startedAtMs);
 await verifyConnectedNativeArtifact(m,build);
 assert.equal(await hash(m.sourceManifest),m.sourceManifestSha256);
 const origin=await json(m.sourceManifest);assert.equal(m.initializedSource,join(origin.profile,'Residency_Visit_1_After.GMP'));
 const initial=await inspectConnectedLoadTransforms(m.sourceManifest,join(workspace,'output/native-connected-load-transforms-setter-audit.json'));
 assert.equal(initial.generatedRegionInitializationQualified,true);
 assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Home_Starting_Realm.GMP'));
 assert.equal(await hash(m.initializedSource),m.initializedSourceSha256);assert.equal(await hash(m.sourceCopy),m.initializedSourceSha256);
 for(const [n,d]of Object.entries(m.inputHashes)){assert.equal(origin.inputHashes[n],d);assert.equal(await hash(join(origin.profile,n)),d);assert.equal(await hash(join(m.profile,n)),d);}
 assert.ok((await stat(m.log)).size<=1024*1024);assert.equal(await hash(m.log),m.logSha256);
 const trial=originalHomeValidityTrace(await readFile(m.log,'utf8'));
 const source=await stoppedFileSource(m.initializedSource);const agents=[];
 for await(const a of checkpointAgents(source))if([7,12,20].includes(a.agentId))agents.push({agentId:a.agentId,unitId:a.unitId,deleted:a.deleted});
 assert.deepEqual(agents,[{agentId:7,unitId:469,deleted:false},{agentId:12,unitId:0,deleted:false},{agentId:20,unitId:0,deleted:false}]);
 const guild=await checkpointActorRecords(source,469);assert.equal(guild.unit.family,'BLDG');assert.equal(guild.unit.description,0x31564241);assert.equal(guild.unit.playerNumber,0);
 assert.equal(m.rssCeilingBytes,512*1024*1024);assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=40);
 for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
 assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=62000);
 const audit=join(workspace,'output/native-home-validity-instruction-audit.json');
 await promisify(execFile)(join(workspace,'upstream/majesty-recomp/.venv/bin/python'),[join(workspace,'scripts/audit-native-home-validity.py'),'--verify-report',audit],{maxBuffer:4096});
 return {version:1,originalHomeValidityBoundaryQualified:true,remoteHomeProjectionQualified:false,playerHeroCrossingQualified:false,scope:'Original validity helper rejects positive registered pure GPL agents while accepting the loaded Warriors Guild. Original scripts reject these as dead before building use. This readonly experiment establishes the required routing boundary, not a remote-home implementation.',trial,sourceManifest:resolve(name),sourceManifestSha256:await hash(name),instructionAudit:audit,instructionAuditSha256:await hash(audit),initializedSource:m.initializedSource,initializedSourceSha256:m.initializedSourceSha256,nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,maxSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),elapsedMs:m.finishedAtMs-m.startedAtMs,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [manifest,out]=process.argv.slice(2);if(process.argv.length!==4)throw Error('Usage: <stopped manifest> <fresh proof>');
 const r=await inspectNativeHomeValidity(manifest);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({originalHomeValidityBoundaryQualified:true,remoteHomeProjectionQualified:false,maxSampledRssBytes:r.maxSampledRssBytes}));
}
