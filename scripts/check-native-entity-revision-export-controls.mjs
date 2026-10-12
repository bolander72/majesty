#!/usr/bin/env node
// Isolated export/receipt corruptions and current versus historical read guards.
import {readFile,writeFile,mkdtemp,mkdir,copyFile,open} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {EntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [proofName,output]=process.argv.slice(2);
if(!proofName||!output||process.argv.length!==4)throw Error('Usage: <qualified revision export> <fresh output>');
const proof=JSON.parse(await readFile(proofName,'utf8')),original=JSON.parse(await readFile(proof.receipt,'utf8'));
if(proof.qualified!==true||proof.revision!==2)throw Error('Require the real second evolved revision export');
const cases=[],changes=[
  ['unknown receipt field',async r=>{r.extra=1;}],
  ['changed manifest revision',async r=>{r.manifest=r.manifest.replace('\n2\n','\n1\n');}],
  ['changed state operation',async r=>{r.state.operationId='f'.repeat(64);}],
  ['changed state aliases',async r=>{r.state.aliases[1].agentId++;}],
  ['changed persistent identity',async r=>{r.identity.entityId='f'.repeat(64);}],
  ['changed current owner',async r=>{r.owner.unitId++;}],
  ['changed publication provenance',async r=>{r.revisionReportSha256='f'.repeat(64);}],
  ['export path escape',async r=>{r.worlds[1].filename=original.worlds[1].filename;}],
  ['damaged destination bytes',async r=>{const f=await open(r.worlds[1].filename,'r+');try{await f.write(Buffer.from([0]),0,1,0);}finally{await f.close();}}],
];
for(const [name,change] of changes) {
  const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-controls-')),r=structuredClone(original);
  for(let i=0;i<2;++i){r.worlds[i].filename=join(directory,i?'Destination.GMP':'Source.GMP');await copyFile(original.worlds[i].filename,r.worlds[i].filename);}
  const receipt=join(directory,'Selected_Entity_Revision.json');await writeFile(receipt,JSON.stringify(r)+'\n',{flag:'wx'});
  await verifyRevisionExport(receipt,1,original.worlds[1].sha256,{requireCurrent:false});
  await change(r);await writeFile(receipt,JSON.stringify(r)+'\n');
  await assert.rejects(verifyRevisionExport(receipt,1,original.worlds[1].sha256,{requireCurrent:false}));cases.push({name,rejected:true});
}
await assert.rejects(verifyRevisionExport(proof.receipt,1,'f'.repeat(64)),/differs/);cases.push({name:'wrong original snapshot digest',rejected:true});

// A separate controlled store starts with the real first evolved world and
// advances to the real second. The live qualification/player stores are intact.
const owned=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-history-controls-')),directory=join(owned,'after-publish');await mkdir(directory);
const report=JSON.parse(await readFile(original.revisionReport,'utf8'));report.fixture=owned;
const reportName=join(owned,'Owned_Control_Report.json'),reportBytes=Buffer.from(JSON.stringify(report)+'\n');await writeFile(reportName,reportBytes,{flag:'wx'});
const captures=[];for(const n of ['native-npc-evolved-checkpoint-observed','native-npc-evolved-second-checkpoint-observed'])captures.push(JSON.parse(await readFile(join(workspace,'output',n+'.json'),'utf8')));
const io=await stoppedRevisionStorage(directory),s=new EntityRevisionStore(io,original.identity,original.identity.contentDigest);
async function request(index,expectedManifest) {
  return {worlds:[{source:await stoppedFileSource(original.worlds[0].filename),sha256:original.worlds[0].sha256},
    {source:await stoppedFileSource(captures[index].after.filename),sha256:captures[index].after.sha256}],
    aliases:original.state.aliases,referenceBindings:original.state.referenceBindings,ownerSide:1,visitedSides:3,
    operationId:String(index+1).repeat(64),kind:index?'save':'seed',expectedManifest};
}
const seed=await s.commit(await request(0,null)),r=structuredClone(original),exportDir=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-export-history-'));
r.manifest=seed.manifest;r.state=seed.state;r.worlds=seed.worlds.map((w,i)=>({...w,filename:join(exportDir,i?'Destination.GMP':'Source.GMP')}));
await copyFile(original.worlds[0].filename,r.worlds[0].filename);await copyFile(captures[0].after.filename,r.worlds[1].filename);
r.revisionDirectory=directory;r.revisionReport=reportName;r.revisionReportSha256=sha(reportBytes);
const receiptName=join(exportDir,'Selected_Entity_Revision.json');await writeFile(receiptName,JSON.stringify(r)+'\n',{flag:'wx'});
const current=await verifyRevisionExport(receiptName,1,r.worlds[1].sha256);
await s.commit(await request(1,seed.manifest));
await assert.rejects(verifyRevisionExport(receiptName,1,r.worlds[1].sha256),/Selected revision changed/);
assert.deepEqual(await verifyRevisionExport(receiptName,1,r.worlds[1].sha256,{requireCurrent:false}),current);
cases.push({name:'stale launch refused after real evolved-state advance; historical receipt retained',rejected:true});
await writeFile(output,JSON.stringify({qualified:true,cases,rejected:cases.length,historicalReceiptAfterAdvanceQualified:true,liveQualificationStoreModified:false,nativeProcessesStarted:0,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:cases.length,historicalReceiptAfterAdvanceQualified:true,nativeProcessesStarted:0,browserUsed:false}));
