#!/usr/bin/env node
// Offline refusals on owned export copies; never touch active engine profiles.
import {readFile,writeFile,mkdtemp,copyFile,open,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {verifyExport} from './export-native-entity-pair.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [proofName,output] = process.argv.slice(2);
if (!proofName || !output || process.argv.length !== 4) throw Error('Usage: <qualified export report> <fresh output>');
const proof=JSON.parse(await readFile(proofName,'utf8'));
if(!proof.qualified)throw Error('Require qualified selected export');
const original=JSON.parse(await readFile(proof.receipt,'utf8')),cases=[];
const changes=[
  ['foreign receipt field',async r=>{r.extra=1;}],
  ['changed published manifest',async r=>{r.manifest=r.manifest.replace('\n1\n1\n','\n0\n1\n');}],
  ['changed entity owner',async r=>{r.owner.unitId++;}],
  ['changed ledger provenance',async r=>{r.ledgerSha256='f'.repeat(64);}],
  ['changed qualification provenance',async r=>{r.pairReportSha256='f'.repeat(64);}],
  ['foreign pair directory',async r=>{r.pairDirectory=resolve(r.pairDirectory,'../before-publish');}],
  ['exported path escape',async r=>{r.worlds[1].filename=original.worlds[1].filename;}],
  ['missing destination copy',async r=>{await rm(r.worlds[1].filename);}],
  ['damaged source bytes',async r=>{const f=await open(r.worlds[0].filename,'r+');try{await f.write(Buffer.from([0]),0,1,0);}finally{await f.close();}}],
  ['damaged destination bytes',async r=>{const f=await open(r.worlds[1].filename,'r+');try{await f.write(Buffer.from([0]),0,1,0);}finally{await f.close();}}],
];
for(const [name,change] of changes) {
  const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-export-controls-'));
  const r=structuredClone(original);
  for(let i=0;i<2;++i){r.worlds[i].filename=join(directory,i?'Destination.GMP':'Source.GMP');await copyFile(original.worlds[i].filename,r.worlds[i].filename);}
  const receipt=join(directory,'Selected_Entity_Pair.json');
  await writeFile(receipt,JSON.stringify(r)+'\n',{flag:'wx'});
  await verifyExport(receipt,0,original.worlds[0].sha256); // good copy before fault
  await change(r);await writeFile(receipt,JSON.stringify(r)+'\n');
  let reason;try{await verifyExport(receipt,0,original.worlds[0].sha256);}catch(e){reason=e.message;}
  assert.ok(reason,'Accepted corruption: '+name);cases.push({name,rejected:true,reason});
}
await assert.rejects(verifyExport(proof.receipt,0,'f'.repeat(64)),/differs/);
cases.push({name:'wrong expected engine snapshot',rejected:true});
await writeFile(output,JSON.stringify({qualified:true,cases,rejected:cases.length,nativeProcessesStarted:0,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:cases.length,nativeProcessesStarted:0,browserUsed:false}));
