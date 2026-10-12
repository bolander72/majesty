#!/usr/bin/env node
// Read-only handoff admission controls; selected storage must never be written.
import {readFile,writeFile,mkdtemp,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {prepareNativeReturnHandoff} from './prepare-native-return-handoff.mjs';
import {verifyDepartedReload} from './check-native-npc-departed-reload.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const [departureName,departedName,incomingName,output]=process.argv.slice(2);
if(!departureName||!departedName||!incomingName||!output||process.argv.length!==6)throw Error('Usage: <departure> <departed reload> <returned reload> <fresh controls>');
const baseline=await prepareNativeReturnHandoff(departureName,departedName,incomingName),sha=b=>createHash('sha256').update(b).digest('hex'),
  directory=baseline.receipt.revisionDirectory,files=(await readdir(directory)).sort(),hashes={};
for(const name of files)hashes[name]=sha(await readFile(join(directory,name)));
const originals=await Promise.all([departureName,departedName,incomingName].map(async name=>JSON.parse(await readFile(name,'utf8')))),
  owned=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-return-controls-'));
// Rebind the disposable departed manifest to the disposable departure report.
// The independent departed verifier must accept the unchanged copied chain
// before any mutations, so a path/digest mismatch cannot mask a failed control.
const paths=['departure','departed','incoming'].map(name=>join(owned,name+'.json'));
await writeFile(paths[0],JSON.stringify(originals[0])+'\n');
const departedManifest=structuredClone(originals[1].fixture),manifestName=join(owned,'Native_Departed_Manifest.json');
departedManifest.departedCheckpointReport=paths[0];departedManifest.departedCheckpointReportSha256=sha(await readFile(paths[0]));
await writeFile(manifestName,JSON.stringify(departedManifest)+'\n');
originals[1]=await verifyDepartedReload(manifestName);
const cases=[
  ['source removal unqualified',d=>{d.originalUnitAndAgentRemovalQualified=false;}],
  ['old source removal substituted',d=>{delete d.evolvedNpcDeparturePerformed;}],
  ['outgoing queue cleanup absent',d=>{d.savedQueueRemovalQualified=false;}],
  ['outgoing snapshot forged',d=>{d.after.sha256='0'.repeat(64);} ],
  ['surviving actor changed',d=>{d.differences.units.changed=['497'];}],
  ['outgoing membership forged',d=>{d.differences.agents.after=14;}],
  ['outgoing was not selected',d=>{delete d.sourceManifest.selectedRevisionExport;}],
  ['wrong native counter provenance',d=>{d.sourceManifest.nativeSourceSha256={};}],
  ['outgoing queue alias differs',d=>{d.sourceManifest.agentId=80;}],
  ['unfinished source process',d=>{d.sourceManifest.nativeSessionTerminal=false;}],
  ['fresh departed reload absent',(_,q)=>{q.freshDepartedWorldReloadQualified=false;}],
  ['legacy departed world substituted',(_,q)=>{delete q.evolvedDepartedWorldReloadQualified;}],
  ['removed actor resurrected',(_,q)=>{q.roundtrip.records.units['510']={bytes:375,sha256:'0'.repeat(64)};}],
  ['fresh dormant snapshot changed',(_,q)=>{q.roundtrip.sha256='0'.repeat(64);} ],
  ['wrong departure binding',(_,q)=>{q.sourceDepartureReportSha256='0'.repeat(64);} ],
  ['claimed extra preserved record',(_,q)=>{q.unchangedSurvivingEntityRecords=528;}],
  ['departed reload process reused',(_,q)=>{q.fixture.nativePid=baseline.departure.sourceManifest.nativePid;}],
  ['fresh returned reload absent',(_,__,i)=>{i.freshReturnedWorldReloadQualified=false;}],
  ['returned schedule absent',(_,__,i)=>{i.savedQueueReloadWithoutReinsertionQualified=false;}],
  ['returned evolved save absent',(_,__,i)=>{i.originalReturnedEvolvedSaveAfterReloadQualified=false;}],
  ['returned record changed',(_,__,i)=>{i.after.records.Orders.sha256='0'.repeat(64);} ],
  ['returned position rolled back',(_,__,i)=>{i.after.actor.position.x=i.before.actor.position.x;}],
  ['retired receiving alias reused',(_,__,i)=>{i.identity.unitId=2101;}],
  ['wrong returned descriptor',(_,__,i)=>{i.after.actor.description++;}],
  ['missing returned AI actions',(_,__,i)=>{i.originalContextActions=0;}],
  ['returned queue lost',(_,__,i)=>{i.after.queued=0;}],
  ['returned native source changed',(_,__,i)=>{i.sourceSha256['upstream/majesty-recomp/browser_streaming.cpp']='0'.repeat(64);} ],
];
const results=[];
for(const [name,change] of cases) {
  for(const [index,value] of originals.entries())await writeFile(paths[index],JSON.stringify(value)+'\n');
  const positive=await prepareNativeReturnHandoff(...paths);assert.equal(positive.report.qualified,true);
  const [d,q,i]=structuredClone(originals);change(d,q,i);
  for(const [index,value] of [d,q,i].entries())await writeFile(paths[index],JSON.stringify(value)+'\n');
  await assert.rejects(prepareNativeReturnHandoff(...paths));
  assert.deepEqual((await readdir(directory)).sort(),files);
  for(const file of files)assert.equal(sha(await readFile(join(directory,file))),hashes[file]);
  results.push({name,unchangedCopiedChainAccepted:true,rejected:true,allSelectedFilesUnchanged:true});
}
const final=await prepareNativeReturnHandoff(departureName,departedName,incomingName);assert.deepEqual(final.report,baseline.report);
assert.equal(final.stats.largestWrite,0);
await writeFile(output,JSON.stringify({qualified:true,rejected:results.length,cases:results,unchangedOriginalsAccepted:true,
  selectedFiles:files.length,selectedStoreUnchanged:true,largestWrite:0,nativeProcessesStarted:0,browserUsed:false,
  sourceSha256:sha(await readFile(new URL(import.meta.url)))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:results.length,selectedFiles:files.length,selectedStoreUnchanged:true,committed:false}));
