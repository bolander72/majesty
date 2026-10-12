#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {parseAutoRegionLoads} from './lib/auto-region-load.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const [heapName,queueName,out]=process.argv.slice(2);assert.equal(process.argv.length,5);
for(const n of [heapName,queueName])assert.ok((await stat(n)).size<=512*1024);
const h=JSON.parse(await readFile(heapName,'utf8')),q=JSON.parse(await readFile(queueName,'utf8'));
assert.equal(h.automaticOriginalRegionLifecycleQualified,true);assert.equal(q.automaticOriginalRegionLifecycleQualified,true);assert.equal(q.actualOriginalOrphanQueueRetirementQualified,true);
assert.equal(h.scriptSha256,await hash('scripts/inspect-native-hero-region-auto-heap.mjs'));assert.equal(q.scriptSha256,await hash('scripts/inspect-native-auto-queue-retirement.mjs'));
for(const [n,d]of Object.entries(h.sourceSha256))assert.equal(await hash(n),d);for(const [n,d]of Object.entries(q.evidenceSha256))assert.equal(await hash(n),d);
const m=JSON.parse(await readFile(h.sourceManifest,'utf8'));assert.equal(await hash(h.sourceManifest),h.sourceManifestSha256);assert.equal(q.sourceManifestSha256,h.sourceManifestSha256);
assert.equal(await hash(m.buildReport),m.buildReportSha256);await verifyConnectedNativeArtifact(m,JSON.parse(await readFile(m.buildReport,'utf8')));
assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await readFile(m.script,'utf8'),'wait 30000\ndump automatic_region_return_completed\n');
const log=await readFile(m.log,'utf8');assert.equal(await hash(m.log),m.logSha256);const cycles=h.savedKingdomEvidence.cycles;
assert.equal(parseAutoRegionLoads(log,cycles).length,4);
const begin=log.match(/^\[streaming\] World auto-load begin visit=1 .*$/m)[0],attached=log.match(/^\[streaming\] World auto-load attached visit=1 .*$/m)[0];
const set=(line,key,value)=>{const t=line.split(' ').find(t=>t.startsWith(key+'='));assert.ok(t);return line.replace(t,key+'='+value);};
const cases=[['missing begin',begin,''],['duplicate begin',begin,begin+'\n'+begin],['missing attach',attached,''],['duplicate attach',attached,attached+'\n'+attached]];
for(const [label,line,key,value]of [
 ['wrong begin visit',begin,'visit','0'],['wrong begin side',begin,'side','0'],['wrong begin phase',begin,'phase','3'],['pending transition at begin',begin,'pending','2'],
 ['previous world still live',begin,'world-null','0'],['unloaded load count mismatch',begin,'loads','0'],['wrong exit count',begin,'exits','0'],['wrong accepted count',begin,'accepted','0'],
 ['changed disposed clock',begin,'clock','0'],['inside hook at load',begin,'hook-depth','1'],['missing scheduler baton',begin,'baton','0'],
 ['wrong attached visit',attached,'visit','0'],['wrong attached side',attached,'side','0'],['wrong attached phase',attached,'phase','3'],['missing pending attachment',attached,'pending','0'],
 ['wrong restored world',attached,'world','01000000'],['wrong next accepted count',attached,'accepted','1'],['changed hooks',attached,'hooks-same','0'],
 ['wrong original attachment',attached,'original-attach','00416050'],['menu was not skipped',attached,'menu-skipped','0'],['failed attachment',attached,'result','fail']])cases.push([label,line,set(line,key,value)]);
for(const type of ['begin','attached']){const last=log.match(new RegExp('^\\[streaming\\] World auto-load '+type+' visit=3 .*$','m'))[0];cases.push(['missing final '+type,last,'']);}
const controls=[];for(const [name,line,alteredLine]of cases){const altered=log.replace(line,alteredLine);assert.notEqual(altered,log);assert.throws(()=>parseAutoRegionLoads(altered,cycles),undefined,name);controls.push({case:name,refused:true});}
const manualName='output/native-hero-region-travel-attempt-010.log',manual=await readFile(manualName,'utf8');assert.throws(()=>parseAutoRegionLoads(manual,cycles));controls.push({case:'actual manual menu trace cannot qualify automatic travel',refused:true});
assert.equal(await hash(m.log),m.logSha256);assert.equal(parseAutoRegionLoads(log,cycles).length,4);
await writeFile(out,JSON.stringify({qualified:true,automaticVisits:4,controls,originalLogUnchanged:true,manualLogSha256:await hash(manualName),
 sourceReports:{[heapName]:await hash(heapName),[queueName]:await hash(queueName)},sourceSha256:{'scripts/lib/auto-region-load.mjs':await hash('scripts/lib/auto-region-load.mjs')},
 browserUsed:false,nativeProcessesStarted:0,scriptSha256:await hash(new URL(import.meta.url))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,contradictoryActualCopiesRefused:controls.length,originalLogUnchanged:true}));
