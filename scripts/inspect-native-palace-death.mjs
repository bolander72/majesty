#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
const sha=async p=>(await hashNativeFile(p)).sha256;
function observation(log){
 const rows=log.split('\n').filter(l=>l.startsWith('[streaming] Palace death '));
 assert.equal(rows.length,3);
 const a=rows[0].match(/^\[streaming\] Palace death trigger unit=(\d+) player=(\d+) hp=(\d+) setter=00431130 attribute=00555041 death-script=original result=pass$/);
 const b=rows[1].match(/^\[streaming\] Palace death original-outcome unit=(\d+) player=(\d+) caller=004265e5 won=0 count=1 result=pass$/);
 const c=rows[2].match(/^\[streaming\] Palace death completed unit=(\d+) player=(\d+) original-declaration=1 outcomes=1 hooks-restored=1 ticks=(\d+) result=pass$/);
 assert.ok(a&&b&&c);assert.equal(a[1],b[1]);assert.equal(a[1],c[1]);assert.equal(a[2],b[2]);assert.equal(a[2],c[2]);
 assert.ok(Number(a[3])>0&&Number(a[3])<=1000000);assert.ok(Number(a[2])<4);assert.ok(Number(c[3])>0&&Number(c[3])<=81);
 return {unit:Number(a[1]),player:Number(a[2]),hpBefore:Number(a[3]),ticks:Number(c[3]),originalOutcomeReturnPc:'004265e5'};
}
async function main(){
 const [input,out]=process.argv.slice(2);assert.ok(input&&out);try{await stat(out);throw Error('Preserve earlier inspection');}catch(e){if(e.code!=='ENOENT')throw e;}
 const m=JSON.parse(await readFile(input,'utf8')),build=JSON.parse(await readFile(m.buildReport,'utf8'));
 assert.equal(m.phase,'palace-death');assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);assert.equal(m.palaceDeathTrialCompleted,true);
 assert.equal(m.side,0);await verifyConnectedNativeArtifact(m,build);assert.equal(await sha(m.buildReport),m.buildReportSha256);
 assert.equal(await sha('scripts/run-native-palace-death.py'),m.runnerSha256);assert.equal(await sha('upstream/majesty-recomp/browser_campaign.cpp'),m.nativeCampaignSourceSha256);
 for(const key of ['originalSourceUnchanged','sourceCopyUnchanged','originalSettingsUnchanged','publicationUnchanged','receiptUnchanged'])assert.equal(m[key],true,key);
 assert.equal(await sha(m.source),m.sourceSha256);assert.equal(await sha(m.sourceCopy),m.sourceSha256);assert.equal(await sha(m.publicationManifest),m.publicationManifestSha256);assert.equal(await sha(m.receipt),m.receiptSha256);
 assert.equal(await sha(m.script),m.scriptSha256);assert.equal(await sha(m.log),m.logSha256);
 const info=await stat(m.log);assert.ok(info.size<2*1024*1024);const log=await readFile(m.log,'utf8'),observed=observation(log);
 const source=await stoppedFileSource(m.sourceCopy);let savedPalace;
 for await(const u of checkpointUnitAgentLinks(source))if(u.unitId===observed.unit)savedPalace=u;
 assert.ok(savedPalace);assert.equal(savedPalace.family,'BLDG');assert.equal(savedPalace.playerNumber,observed.player);
 assert.equal(savedPalace.description&0xffffff,0x4a4241,'The trial must damage a palace, not an outpost that already replaced one');
 const auditPath='output/native-palace-death-layout-001-observed.json',audit=JSON.parse(await readFile(auditPath,'utf8'));
 assert.equal(audit.qualified,true);assert.equal(audit.pinnedExecutableSha256,'654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542');
 assert.equal(await sha('scripts/audit-native-palace-death.py'),audit.scriptSha256);assert.equal(audit.declareLossCallsOutcomeDirectly,true);
 assert.equal(Object.keys(audit.fragments).length,5);assert.equal(audit.controls.length,5);assert.ok(audit.controls.every(x=>x.refused));
 const controls=[];
 for(const [name,copy] of [
  ['wrong declaration caller',log.replace('caller=004265e5','caller=00495ca0')],
  ['already dead target',log.replace(`hp=${observed.hpBefore} setter=`,`hp=0 setter=`)],
  ['victory in place of defeat',log.replace('won=0 count=1','won=1 count=1')],
  ['duplicate result',log.replace('won=0 count=1','won=0 count=2')],
  ['hooks retained',log.replace('hooks-restored=1','hooks-restored=0')],
  ['wrong target',log.replace(`original-outcome unit=${observed.unit}`,`original-outcome unit=${observed.unit+1}`)]]){
  assert.notEqual(copy,log);assert.throws(()=>observation(copy));controls.push({name,refused:true});
 }
 const rss=Math.max(...m.resourceSamples.map(x=>x.rssBytes)),duration=m.finishedAtMs-m.startedAtMs;assert.ok(rss<=m.rssCeilingBytes&&duration<=47000);
 const filenames=[input,m.buildReport,m.log,m.script,m.source,m.sourceCopy,m.receipt,m.publicationManifest,auditPath];
 const evidenceSha256={};for(const p of filenames)evidenceSha256[resolve(p)]=await sha(p);
 const sourceSha256={};for(const p of ['scripts/inspect-native-palace-death.mjs','scripts/run-native-palace-death.py','scripts/audit-native-palace-death.py','web/world/checkpoint.mjs',...Object.keys(m.nativeSourceSha256),'upstream/majesty-recomp/browser_campaign.cpp'])sourceSha256[p]=await sha(p);
 const report={version:1,qualified:true,actualNativePalaceDeathDeclarationQualified:true,scope:'One owned native palace HP-to-original-death-script-to-DeclareLoss-to-original-outcome trial. This is solo engine evidence; shared co-op palace loss and independent internet full matches remain unqualified.',sourceManifest:resolve(input),sourceManifestSha256:await sha(input),nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,observed,savedPalace,controls,maximumSampledRssBytes:rss,durationMs:duration,evidenceSha256,sourceSha256,browserUsed:false,nativeProcessesStarted:0,cooperativePalaceLossQualified:false,competitiveFullMatchQualified:false,browserMemoryBoundQualified:false,scriptSha256:await sha('scripts/inspect-native-palace-death.mjs')};
 await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,unit:observed.unit,originalDeclaration:true,cooperativePalaceLossQualified:false}));
}
main().catch(e=>{console.error(JSON.stringify({qualified:false,error:e.message.slice(0,350)}));process.exitCode=1;});
