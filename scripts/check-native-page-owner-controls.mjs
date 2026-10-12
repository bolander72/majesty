#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {parsePageEvents} from './check-native-page-sites.mjs';
import {parsePageContexts} from './check-native-page-context.mjs';
import {parsePageOwners} from './inspect-native-page-owners.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const report=JSON.parse(await readFile(name,'utf8'));assert.equal(report.observedMessageQueueOwnerQualified,true);
const manifest=JSON.parse(await readFile(report.sourceManifest,'utf8'));assert.equal((await hashNativeFile(report.sourceManifest)).sha256,report.sourceManifestSha256);
await verifyConnectedNativeArtifact(manifest,JSON.parse(await readFile(manifest.buildReport,'utf8')));
const log=await readFile(manifest.log,'utf8');assert.equal((await hashNativeFile(manifest.log)).sha256,manifest.logSha256);
const positive=()=>{const e=parsePageEvents(log,4),c=parsePageContexts(log,e);return parsePageOwners(log,e,c);};
assert.equal(positive().samples.length,106);
const parent=log.match(/^\[streaming\] World page-parent .*$/m)[0],owner=log.match(/^\[streaming\] World page-owner .*stage=after-exit.*$/m)[0];
const replace=(line,key,value)=>line.replace(new RegExp(`\\b${key}=[^ ]+`),`${key}=${value}`);
const cases=[
 ['missing parent',log.replace(parent+'\n','')],['changed parent vtable',log.replace(parent,replace(parent,'vtable','00682c64'))],
 ['global mismatch',log.replace(parent,replace(parent,'global','00000000'))],['lock mismatch',log.replace(parent,replace(parent,'lock','00000000'))],
 ['unknown size sentinel',log.replace(parent,replace(parent,'bytes','4294967295'))],['unadmitted parent',log.replace(parent,replace(parent,'admitted','0'))],
 ['missing owner boundary',log.replace(owner+'\n','')],['duplicate owner boundary',log.replace(owner,owner+'\n'+owner)],
 ['wrong buffer',log.replace(owner,replace(owner,'buffer','01000000'))],['wrong descriptor',log.replace(owner,replace(owner,'queue','01000000'))],
 ['wrong owner',log.replace(owner,replace(owner,'parent','01000000'))],['false empty queue',log.replace(owner,replace(owner,'count','0'))],
 ['false descriptor free',log.replace(owner,replace(owner,'queue-freed','1'))],['false parent free',log.replace(owner,replace(owner,'parent-freed','1'))],
 ['wrong first buffer',log.replace(owner,replace(owner,'first-buffer','01000000'))],['wrong last buffer',log.replace(owner,replace(owner,'last-buffer','01000000'))],
 ['wrong map size',log.replace(owner,replace(owner,'map-bytes','0'))],['wrong map capacity',log.replace(owner,replace(owner,'capacity','3'))],
 ['wrong recipient',log.replace(owner,replace(owner,'recipient','2'))],['stale allocation event',log.replace(owner,replace(owner,'event','1'))]
];
const controls=[];for(const [caseName,altered]of cases){assert.notEqual(altered,log);assert.throws(()=>{const e=parsePageEvents(altered,4),c=parsePageContexts(altered,e);parsePageOwners(altered,e,c);},undefined,caseName);controls.push({case:caseName,refused:true});}
assert.equal((await hashNativeFile(manifest.log)).sha256,manifest.logSha256);assert.equal(positive().samples.length,106);
await writeFile(out,JSON.stringify({qualified:true,positiveSamples:106,controls,sourceReport:name,sourceReportSha256:(await hashNativeFile(name)).sha256,
 originalLogSha256:manifest.logSha256,originalUnchanged:true,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,positiveSamples:106,contradictoryCopiesRefused:controls.length,originalUnchanged:true}));
