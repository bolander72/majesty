#!/usr/bin/env node
// Mutate owned copies, with an unchanged positive before every refusal.
import {readFile,writeFile,mkdtemp,copyFile,open,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {verifyRepeatCrossingCapsule} from './prepare-native-repeat-crossing.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const [reportName,output]=process.argv.slice(2);if(process.argv.length!==4)throw Error('Usage: <current repeat capsule> <fresh output>');
const original=JSON.parse(await readFile(reportName)),receipt=JSON.parse(await readFile(original.plan.receipt));
await verifyRepeatCrossingCapsule(reportName);
async function canonical() {
  const dir=receipt.revisionDirectory,names=(await readdir(dir)).sort(),hashes={};assert.equal(names.length,8);
  for(const name of names)hashes[name]=await hashCheckpointSource(await stoppedFileSource(join(dir,name)));return hashes;
}
const before=await canonical(),changes=[
  ['invented runtime crossing',r=>r.nativeCrossingQualified=true],['invented ID reservation',r=>r.plan.nativeIdsReserved=true],
  ['claimed edits applied',r=>r.plan.patchesApplied=true],['reset current clock',r=>r.plan.sourceClock=28000],
  ['retired source identity',r=>r.plan.sourceAlias={unitId:2101,agentId:37}],['wrong receiving alias',r=>r.plan.retiredDestinationAlias.unitId++],
  ['wrong source side',r=>r.plan.sourceSide=1],['stale revision',r=>r.plan.revision--],['stale source world',r=>r.plan.sourceWorld='0'.repeat(64)],
  ['changed grounded landing',r=>r.plan.position.after.z++],['stretched coordinates',r=>r.plan.position.after.y++],
  ['reuse source route',r=>r.plan.navigation.find(n=>n.kind===4).policy='reuse-source-route'],
  ['concrete own ID',r=>r.plan.edits.find(e=>e.reason==='original native ID reservation').after=532],
  ['wrong leader binding',r=>r.plan.edits.find(e=>e.reason==='typed command target').after++],
  ['frozen live context age',r=>r.plan.edits.find(e=>e.reason==='live destination clock rebasing').after.destinationClockMinusElapsed=0],
  ['invented departure clearance',r=>r.plan.departure.queuedActor=0],['unbound Wait evidence',r=>r.plan.kind9Audit.sha256='0'.repeat(64)],
  ['missing source provenance',r=>r.sourceSha256={}],
  ...['Unit','GPL','Orders','Crossing_Plan'].map(name=>['changed stored '+name,async r=>{
    const f=await open(join(r.directory,name+(name==='Crossing_Plan'?'.json':'.bin')),'r+');try{await f.write(Buffer.from([0xff]),0,1,0);}finally{await f.close();}
  }]),
];
const cases=[];
for(const [name,change] of changes) {
  const dir=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-repeat-crossing-controls-')),r=structuredClone(original);r.directory=dir;
  for(const file of ['Unit.bin','GPL.bin','Orders.bin','Crossing_Plan.json'])await copyFile(join(original.directory,file),join(dir,file));
  const copy=join(dir,'Owned_Crossing_Report.json');await writeFile(copy,JSON.stringify(r)+'\n',{flag:'wx'});
  await verifyRepeatCrossingCapsule(copy);await change(r);await writeFile(copy,JSON.stringify(r)+'\n');
  await assert.rejects(verifyRepeatCrossingCapsule(copy));assert.deepEqual(await canonical(),before);cases.push({name,rejected:true,canonicalStoreUnchanged:true});
}
await writeFile(output,JSON.stringify({qualified:true,rejected:cases.length,cases,unchangedCopiesQualifiedBeforeEveryRefusal:true,canonicalStoreUnchanged:true,
  canonicalStoreSha256:before,nativeProcessesStarted:0,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:cases.length,canonicalStoreUnchanged:true}));
