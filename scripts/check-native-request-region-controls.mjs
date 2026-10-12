#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {parseRequestedRegionTravel} from './lib/requested-region-travel.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const [heapName,queueName,out]=process.argv.slice(2);assert.equal(process.argv.length,5);
for(const n of [heapName,queueName])assert.ok((await stat(n)).size<=512*1024);
const h=JSON.parse(await readFile(heapName,'utf8')),q=JSON.parse(await readFile(queueName,'utf8'));
assert.equal(h.automaticOriginalRegionLifecycleQualified,true);assert.equal(q.automaticOriginalRegionLifecycleQualified,true);assert.equal(q.actualOriginalOrphanQueueRetirementQualified,true);
assert.equal(h.scriptSha256,await hash('scripts/inspect-native-hero-region-request-heap.mjs'));assert.equal(q.scriptSha256,await hash('scripts/inspect-native-request-queue-retirement.mjs'));
for(const [n,d]of Object.entries(h.sourceSha256))assert.equal(await hash(n),d);for(const [n,d]of Object.entries(q.evidenceSha256))assert.equal(await hash(n),d);
const m=JSON.parse(await readFile(h.sourceManifest,'utf8'));assert.equal(await hash(h.sourceManifest),h.sourceManifestSha256);assert.equal(q.sourceManifestSha256,h.sourceManifestSha256);
assert.equal(await hash(m.buildReport),m.buildReportSha256);await verifyConnectedNativeArtifact(m,JSON.parse(await readFile(m.buildReport,'utf8')));
assert.equal(await hash(m.script),m.scriptSha256);assert.equal(await readFile(m.script,'utf8'),'wait 30000\ndump automatic_region_return_completed\n');
const log=await readFile(m.log,'utf8');assert.equal(await hash(m.log),m.logSha256);const cycles=h.savedKingdomEvidence.cycles;
const positive=parseRequestedRegionTravel(log,cycles,m);assert.equal(positive.fulfilledNeighborRequests,3);assert.equal(positive.finalStopRequests,1);
const ready=log.match(/^\[streaming\] World travel-ready serial=2 .*$/m)[0],accepted=log.match(/^\[streaming\] World travel-request accepted visit=1 .*$/m)[0],refused=log.match(/^\[streaming\] World travel-request refused visit=1 .*$/m)[0];
const set=(line,key,value)=>{const t=line.split(' ').find(t=>t.startsWith(key+'='));assert.ok(t);return line.replace(t,key+'='+value);};
const cases=[['missing ready',ready,''],['duplicate ready',ready,ready+'\n'+ready],['missing accepted',accepted,''],['duplicate accepted',accepted,accepted+'\n'+accepted],['missing actual refusal',refused,'']];
for(const [name,line,key,value]of [
 ['wrong ready serial',ready,'serial','1'],['wrong ready source',ready,'source','0'],['wrong ready target',ready,'target','1'],['wrong loaded clock',ready,'clock','0'],['wrong operation',ready,'operation','2'],['wrong wire bytes',ready,'bytes','24'],
 ['wrong accepted serial',accepted,'serial','1'],['wrong accepted source',accepted,'source','0'],['wrong accepted destination',accepted,'target','1'],['wrong initial clock',accepted,'initial-clock','0'],['wrong saved clock',accepted,'current-clock','0'],
 ['false twentieth-tick exit',accepted,'completed-ticks','20'],['false stop operation',accepted,'operation','2'],['wrong acceptance counter',accepted,'accepted','1'],['unconsumed request',accepted,'consumed','0'],
 ['changed active world',accepted,'world-same','0'],['changed clock on admission',accepted,'clock-same','0'],['changed hooks on admission',accepted,'hooks-same','0'],
 ['wrong stale serial',refused,'serial','2'],['wrong refused clock',refused,'current-clock','0'],['wrong refusal counter',refused,'accepted','2'],['changed world on refusal',refused,'world-same','0'],['changed clock on refusal',refused,'clock-same','0'],['changed hooks on refusal',refused,'hooks-same','0']])cases.push([name,line,set(line,key,value)]);
const controls=[];for(const [name,line,changed]of cases){const altered=log.replace(line,changed);assert.notEqual(altered,log);assert.throws(()=>parseRequestedRegionTravel(altered,cycles,m),undefined,name);controls.push({case:name,refused:true});}
for(const [name,change]of [
 ['wrong emitted bytes',x=>x.requestPublications[1].sha256='0'.repeat(64)],
 ['replayed request declared accepted',x=>x.requestPublications[1].words[2]=0],
 ['wrong readiness bytes',x=>x.readyPublications[1].words[3]=0],
 ['publication before deliberate delay',x=>x.requestPublications[1].publishedAtMs=x.readyPublications[0].observedAtMs],
 ['wrong native observed ticks',x=>x.completedTicksByVisit[0]=20]]){
 const altered=structuredClone(m);change(altered);assert.throws(()=>parseRequestedRegionTravel(log,cycles,altered),undefined,name);controls.push({case:name,refused:true});}
const timedName='output/native-hero-region-auto-attempt-001.log',timed=await readFile(timedName,'utf8');assert.throws(()=>parseRequestedRegionTravel(timed,cycles,m));controls.push({case:'actual timed automatic trace does not qualify request-driven travel',refused:true});
assert.equal(await hash(m.log),m.logSha256);assert.equal(parseRequestedRegionTravel(log,cycles,m).fulfilledNeighborRequests,3);
await writeFile(out,JSON.stringify({qualified:true,fulfilledNeighborRequests:3,finalStops:1,actualStaleRefusals:2,controls,originalLogUnchanged:true,
 sourceReports:{[heapName]:await hash(heapName),[queueName]:await hash(queueName)},timedLogSha256:await hash(timedName),sourceSha256:{'scripts/lib/requested-region-travel.mjs':await hash('scripts/lib/requested-region-travel.mjs')},
 browserUsed:false,nativeProcessesStarted:0,scriptSha256:await hash(new URL(import.meta.url))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,contradictoryCopiesRefused:controls.length,originalLogUnchanged:true}));
