#!/usr/bin/env node
// Corrupt only owned capsule copies; never edit a world or its selected state.
import {readFile,writeFile,mkdtemp,copyFile,open} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {verifyReturnCapsule} from './prepare-native-entity-return.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [reportName,output]=process.argv.slice(2);
if(!reportName||!output||process.argv.length!==4)throw Error('Usage: <current return preparation> <fresh report>');
const original=JSON.parse(await readFile(reportName,'utf8'));
await verifyReturnCapsule(reportName);
const receipt=JSON.parse(await readFile(original.plan.receipt,'utf8'));
const markerName=join(receipt.revisionDirectory,'Frontier_Revision.checkpoint'),marker=await readFile(markerName);
const changes=[
  ['invented native return success',async r=>{r.nativeReturnQualified=true;}],
  ['invented ID reservation',async r=>{r.plan.nativeIdsReserved=true;}],
  ['prematurely concrete self ID',async r=>{r.plan.edits.find(e=>e.reason==='original native ID reservation').after=2142;}],
  ['old revision manifest',async r=>{r.plan.manifest=r.plan.manifest.replace('\n3\n','\n2\n');}],
  ['wrong incoming leader binding',async r=>{r.plan.edits.find(e=>e.reason==='typed command target').after++;}],
  ['stretched return position',async r=>{r.plan.position.after.x++;}],
  ['invented destination ground',async r=>{r.plan.position.after.z++;}],
  ['reuse source path',async r=>{r.plan.navigation.find(e=>e.kind===4).policy='reuse-source-route';}],
  ['freeze context age',async r=>{r.plan.edits.find(e=>e.reason==='live destination clock rebasing').after={destinationClockMinusElapsed:0,rejectZero:true};}],
  ...['Unit','GPL','Orders'].map(name=>['changed '+name+' writer',async r=>{
    const file=await open(join(r.directory,name+'.bin'),'r+');try{await file.write(Buffer.from([0xff]),0,1,0);}finally{await file.close();}
  }]),
  ['changed stored plan',async r=>{const file=await open(join(r.directory,'Return_Plan.json'),'r+');try{await file.write(Buffer.from([0]),0,1,0);}finally{await file.close();}}],
  ['missing verifier provenance',async r=>{r.sourceSha256={};}],
];
const cases=[];
for(const [name,change] of changes) {
  const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-return-controls-')),r=structuredClone(original);r.directory=directory;
  for(const file of ['Unit.bin','GPL.bin','Orders.bin','Return_Plan.json'])await copyFile(join(original.directory,file),join(directory,file));
  await change(r);const copy=join(directory,'Owned_Return_Report.json');await writeFile(copy,JSON.stringify(r)+'\n',{flag:'wx'});
  await assert.rejects(verifyReturnCapsule(copy));assert.deepEqual(await readFile(markerName),marker);
  cases.push({name,rejected:true,selectedManifestUnchanged:true});
}
await writeFile(output,JSON.stringify({qualified:true,cases,rejected:cases.length,selectedManifestUnchanged:true,nativeProcessesStarted:0,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:cases.length,selectedManifestUnchanged:true}));
