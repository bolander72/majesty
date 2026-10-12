#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {parsePageEvents} from './check-native-page-sites.mjs';
import {parsePageContexts} from './check-native-page-context.mjs';
import {parseRepeatedPageOwners,inspectRepeatedQueueRetirementTrace} from './lib/repeated-hero-travel.mjs';
import {parsePageRegistrations} from './inspect-native-page-registration.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [registrationName,retirementName,out]=process.argv.slice(2);assert.equal(process.argv.length,5);
const hash=async n=>(await hashNativeFile(n)).sha256;
async function small(n){assert.ok((await lstat(n)).size<=3*1024*1024);return readFile(n,'utf8');}
async function load(n,field,inspector){
 const report=JSON.parse(await small(n));assert.equal(report[field],true);
 assert.equal(report.scriptSha256,await hash(join(workspace,inspector)));
 assert.equal(report.sourceManifestSha256,await hash(report.sourceManifest));
 const m=JSON.parse(await small(report.sourceManifest));assert.equal(await hash(m.buildReport),m.buildReportSha256);
 await verifyConnectedNativeArtifact(m,JSON.parse(await small(m.buildReport)));
 assert.equal(await hash(m.log),m.logSha256);return {report,m,log:await small(m.log)};
}
const registration=await load(registrationName,'observedRecipientTreeMembershipQualified','scripts/inspect-native-page-registration.mjs');
const retirement=await load(retirementName,'actualOriginalOrphanQueueRetirementQualified','scripts/inspect-native-repeated-queue-retirement.mjs');
function parse(log,release=false,count=4){const e=parsePageEvents(log,count),c=parsePageContexts(log,e),o=parseRepeatedPageOwners(log,e,c,count),r=parsePageRegistrations(log,o);
 return {owners:o,registration:r,...(release?{retirement:inspectRepeatedQueueRetirementTrace(log,e,o,r,count)}:{})};}
const count=retirement.m.loadSequence.length;assert.ok([6,8,10,12].includes(count));
const regPositive=parse(registration.log),releasePositive=parse(retirement.log,true,count);
assert.equal(regPositive.registration.samples.length,106);assert.equal(releasePositive.retirement.retired.length,count-1);
const set=(line,key,value)=>{const token=line.split(' ').find(t=>t.startsWith(key+'='));assert.ok(token);return line.replace(token,key+'='+value);};
const regLine=registration.log.match(/^\[streaming\] World page-registration .*stage=after-exit.*$/m)[0];
const regCases=[['missing registration',null],['duplicate registration',regLine+'\n'+regLine]];
for(const [name,key,value] of [
 ['incomplete tree','complete','0'],['false count','count','2'],['false walk count','walked','2'],
 ['wrong head','head','01000000'],['wrong root','root','01000000'],['false leaf','leaf','01000000'],
 ['wrong queue references','queue-references','0'],['wrong default membership','default-match','1'],
 ['wrong recipient lookup','recipient-queue','01000000'],['wrong recipient node','recipient-node','01000000'],
 ['wrong observed event','event','1'],['wrong descriptor','queue','01000000'],
 ['unknown schema','complete','4294967295']])regCases.push([name,set(regLine,key,value)]);
const nodes=regLine.split(' ').find(t=>t.startsWith('nodes=')).slice(6).split(',');assert.equal(nodes.length,1);
for(const [name,index,value] of [['wrong node parent',2,'01000000'],['tree cycle',1,nodes[0].split(':')[0]],['wrong recipient key',4,'00000002'],['wrong node queue',5,'01000000']]){
 const words=nodes[0].split(':');words[index]=value;regCases.push([name,set(regLine,'nodes',words.join(':'))]);}
const controls=[];
for(const [name,changed]of regCases){const altered=registration.log.replace(regLine,changed??'');assert.notEqual(altered,registration.log);
 assert.throws(()=>parse(altered),undefined,name);controls.push({case:name,source:'registration091',refused:true});}
const candidate=retirement.log.match(/^\[streaming\] World queue-release candidate .*$/m)[0],retired=retirement.log.match(/^\[streaming\] World queue-release retired .*$/m)[0],sweep=retirement.log.match(/^\[streaming\] World queue-release sweep visit=1 .*$/m)[0];
const releaseCases=[['missing candidate',candidate,''],['duplicate candidate',candidate,candidate+'\n'+candidate],['missing retirement',retired,'']];
for(const [name,line,key,value] of [
 ['same-load queue',candidate,'allocation-load','2'],['wrong current load',candidate,'current-load','1'],
 ['registered queue',candidate,'registered','1'],['default queue',candidate,'default-match','1'],['unadmitted queue',candidate,'admitted','0'],
 ['wrong pending message type',candidate,'vtable','00682bc4'],['wrong message payload',candidate,'message-bytes','24'],
 ['front outside buffer',candidate,'front','01000000'],['invalid nested queue',candidate,'nested','00000000'],
 ['wrong original destructor',retired,'original-destructor','00499fc0'],['wrong descriptor delete',retired,'original-delete','00497cf0'],
 ['missing buffer release',retired,'buffer-freed','0'],['missing map release',retired,'map-freed','0'],['missing descriptor release',retired,'descriptor-freed','0'],
 ['changed tree',retired,'tree-same','0'],['changed clock',retired,'clock-same','0'],['changed world',retired,'world-same','0'],['changed hooks',retired,'hooks-same','0'],
 ['no requested-byte reduction',retired,'requested-after',retired.split(' ').find(t=>t.startsWith('requested-before=')).split('=')[1]],
 ['wrong released count',sweep,'released','0'],['wrong retained count',sweep,'retained','0'],['inside hook',sweep,'hook-depth','1'],['missing baton',sweep,'baton','0'],['wrong sweep clock',sweep,'clock','0']])releaseCases.push([name,line,set(line,key,value)]);
for(const type of ['candidate','retired','sweep']){const last=retirement.log.match(new RegExp('^\\[streaming\\] World queue-release '+type+' visit='+(count-1)+' .*$','m'))[0];releaseCases.push(['missing final '+type,last,'']);}
for(const [name,line,changed]of releaseCases){const altered=retirement.log.replace(line,changed);assert.notEqual(altered,retirement.log);
 assert.throws(()=>parse(altered,true,count),undefined,name);controls.push({case:name,source:'repeatedNative092',refused:true});}
for(const t of [registration,retirement])assert.equal(await hash(t.m.log),t.m.logSha256);
assert.equal(parse(registration.log).registration.samples.length,106);assert.equal(parse(retirement.log,true,count).retirement.retired.length,count-1);
await writeFile(out,JSON.stringify({qualified:true,controls,positiveRegistrationSamples:106,positiveRetirementSamples:releasePositive.registration.samples.length,positiveRetirements:count-1,visits:count,
 sourceReports:{[registrationName]:await hash(registrationName),[retirementName]:await hash(retirementName)},
 originalLogsUnchanged:true,browserUsed:false,nativeProcessesStarted:0,scriptSha256:await hash(new URL(import.meta.url))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,contradictoryCopiesRefused:controls.length,originalLogsUnchanged:true}));
