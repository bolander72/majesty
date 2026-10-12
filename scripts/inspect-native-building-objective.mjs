#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,dirname,basename,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
const sha=async p=>(await hashNativeFile(p)).sha256;
export function observations(log){
 const rows=log.split('\n').filter(x=>x.startsWith('[campaign-fixture]'));
 assert.equal(rows.length,4);
 const start=rows[0].match(/^\[campaign-fixture\] Building baseline owner=0 mask=3 other-owner=1 mask=0 clock=(\d+)$/);
 assert.ok(start);assert.ok(Number(start[1])>=31800&&Number(start[1])<=32000);
 assert.equal(rows[1],'[campaign-fixture] Building construction unit=469 unfinished-mask=2 restored-mask=3 original-setter=00431130');
 assert.equal(rows[2],'[campaign-fixture] Building construction unit=466 unfinished-mask=1 restored-mask=3 original-setter=00431130');
 assert.equal(rows[3],'[campaign-fixture] Building objective completed restored=1 owner-filter=1 unfinished-filter=1 invalid-refused=1 clock-same=1 hooks-same=1 result=pass');
 return {clock:Number(start[1]),guild:469,temple:466,initialMask:3,constructionMasks:[2,1],restoredMask:3};
}
async function main(){
 const [input,out]=process.argv.slice(2);assert.ok(input&&out);
 try{await stat(out);throw Error('Preserve earlier proof');}catch(e){if(e.code!=='ENOENT')throw e;}
 const m=JSON.parse(await readFile(input,'utf8')),build=JSON.parse(await readFile(m.buildReport,'utf8'));
 assert.equal(m.phase,'building-objective');assert.equal(m.side,0);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);
 assert.equal(m.stopReason,null);assert.equal(m.buildingObjectiveTrialCompleted,true);const symbols=await verifyConnectedNativeArtifact(m,build);
 assert.equal(await sha(m.buildReport),m.buildReportSha256);assert.equal(await sha('scripts/run-native-building-objective.py'),m.runnerSha256);
 const campaign='upstream/majesty-recomp/browser_campaign.cpp';
 const archived=basename(dirname(symbols)).startsWith('actor-arrival-fixture-native-generation-');
 const nativeSource=name=>archived?join(dirname(symbols),basename(name)):name;
 assert.equal(m.nativeSourceSha256[campaign],m.nativeCampaignSourceSha256);assert.equal(await sha(nativeSource(campaign)),m.nativeCampaignSourceSha256);
 for(const key of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged','publicationUnchanged','receiptUnchanged'])assert.equal(m[key],true,key);
 for(const [path,expected] of [[m.source,m.sourceSha256],[m.sourceCopy,m.sourceSha256],[m.script,m.scriptSha256],[m.log,m.logSha256],
  [m.receipt,m.receiptSha256],[m.publicationManifest,m.publicationManifestSha256],[m.previousManifest,m.previousManifestSha256]])assert.equal(await sha(path),expected);
 for(const [name,digest]of Object.entries(m.inputHashes))assert.equal(await sha(m.settingsProfile+'/'+name),digest);
 assert.ok((await stat(m.log)).size<2*1024*1024);const log=await readFile(m.log,'utf8'),observed=observations(log);
 const source=await stoppedFileSource(m.sourceCopy),expected=new Map([[469,0x31564241],[466,0x31504241]]),saved=[];
 for await(const u of checkpointUnitAgentLinks(source))if(expected.has(u.unitId)){
  assert.equal(u.family,'BLDG');assert.equal(u.playerNumber,0);assert.equal(u.description,expected.get(u.unitId));saved.push(u.unitId);
 }
 assert.deepEqual(saved.sort((a,b)=>a-b),[466,469]);
 const auditPath='output/native-building-objective-layout-002-observed.json',audit=JSON.parse(await readFile(auditPath,'utf8'));
 assert.equal(audit.qualified,true);assert.equal(audit.pinnedExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
 assert.equal(audit.constructionAttribute,'01425041');assert.equal(Object.keys(audit.fragments).length,6);assert.ok(audit.controls.length>=30&&audit.controls.every(x=>x.refused));
 assert.equal(await sha('scripts/audit-native-building-objective.py'),audit.scriptSha256);assert.equal(await sha(audit.buildingData.filename),audit.buildingData.sha256);
 const controls=[];
 for(const [name,bad]of [
  ['missing required building',log.replace('owner=0 mask=3','owner=0 mask=1')],
  ['wrong owner included',log.replace('other-owner=1 mask=0','other-owner=1 mask=3')],
  ['unfinished guild counted',log.replace('unfinished-mask=2','unfinished-mask=3')],
  ['unfinished temple counted',log.replace('unfinished-mask=1','unfinished-mask=3')],
  ['attribute not restored',log.replace('restored-mask=3','restored-mask=1')],
  ['hooks retained',log.replace('hooks-same=1','hooks-same=0')],
  ['clock changed',log.replace('clock-same=1','clock-same=0')]]){
   assert.notEqual(bad,log);assert.throws(()=>observations(bad));controls.push({name,refused:true});
 }
 const duration=m.finishedAtMs-m.startedAtMs,maxRss=Math.max(...m.resourceSamples.map(x=>x.rssBytes));
 assert.ok(duration<=47000&&maxRss<=m.rssCeilingBytes);assert.ok(m.resourceSamples.every(x=>x.pid===m.nativePid));
 const evidenceSha256={};for(const p of [input,m.buildReport,m.log,m.script,m.source,m.sourceCopy,m.receipt,m.publicationManifest,auditPath])evidenceSha256[resolve(p)]=await sha(p);
 const sourceSha256={};for(const p of ['scripts/inspect-native-building-objective.mjs','scripts/run-native-building-objective.py','scripts/audit-native-building-objective.py','scripts/lib/connected-native-artifact.mjs',...Object.keys(m.nativeSourceSha256).map(nativeSource)])sourceSha256[p]=await sha(p);
 const report={version:1,qualified:true,actualNativeBuildingPredicateQualified:true,cooperativeChapterQualified:false,
  scope:'Production chapter4 building predicate on one owned original solo input; native ownership and construction-flag changes/refusals. No cooperative roster, original construction gameplay, shared outcome, full campaign or browser trial.',
  observed,controls,nativePid:m.nativePid,durationMs:duration,maximumSampledRssBytes:maxRss,evidenceSha256,sourceSha256,browserUsed:false};
 await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,guild:469,temple:466,controls:controls.length,cooperativeChapterQualified:false}));
}
if(process.argv[1]===new URL(import.meta.url).pathname)main().catch(e=>{console.error(JSON.stringify({qualified:false,error:e.message.slice(0,350)}));process.exitCode=1;});
