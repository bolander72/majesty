#!/usr/bin/env node
// Exercise actual next handoff requests on owned copies, preserving canonical state.
import {readFile,writeFile,mkdtemp,mkdir,readdir,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {prepareRepeatHandoff} from './prepare-native-repeat-handoff.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedRevisionStorage} from './lib/stopped-revision-io.mjs';
import {openEntityRevisionStore} from '../web/world/entity-revisions.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const [d,q,i,out]=process.argv.slice(2);if(!d||!q||!i||!out||process.argv.length!==6)throw Error('Usage: <departure> <departed reload> <incoming reload> <fresh controls>');
const p=await prepareRepeatHandoff(d,q,i),canonical=p.receipt.revisionDirectory,names=await readdir(canonical);assert.equal(names.length,8);
const hashes={};for(const name of names)hashes[name]=await hashCheckpointSource(await stoppedFileSource(join(canonical,name)));
const fixture=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-repeat-controls-')),directory=join(fixture,'after-publish');await mkdir(directory);
async function reset(){for(const name of names)await copyFile(join(canonical,name),join(directory,name));}
async function digests(){const value={};for(const name of names)value[name]=await hashCheckpointSource(await stoppedFileSource(join(directory,name)));return value;}
const mutations=[
  ['outgoing-owner-still-present',r=>{r.worlds[0]={source:null,sha256:p.receipt.worlds[0].sha256};}],
  ['retired-incoming-unit-reused',r=>{r.aliases[1].unitId=p.receipt.state.aliases[1].unitId;}],
  ['retired-incoming-agent-reused',r=>{r.aliases[1].agentId=p.receipt.state.aliases[1].agentId;}],
  ['owner-not-switched',r=>{r.ownerSide=0;}],
  ['wrong-native-world-digest',r=>{r.worlds[1].sha256='0'.repeat(64);}],
  ['wrong-reference-leader',r=>{r.referenceBindings[0].destination.unitId+=1;}],
  ['stale-compare-and-swap',r=>{r.expectedManifest=r.expectedManifest.replace('\n5\n','\n4\n');}],
];
const results=[];
for(const [name,mutate] of mutations){
  await reset();const stats={},store=await openEntityRevisionStore(await stoppedRevisionStorage(directory,stats),p.receipt.identity.contentDigest);
  const positive=await store.commit(p.request);assert.equal(positive.revision,6);assert.equal((await store.read()).record.state.ownerSide,1);
  await reset();const before=await digests(),negativeStats={},negativeStore=await openEntityRevisionStore(await stoppedRevisionStorage(directory,negativeStats),p.receipt.identity.contentDigest),selectedBefore=await negativeStore.read();
  const r={...p.request,worlds:p.request.worlds.map(w=>({...w})),aliases:structuredClone(p.request.aliases),referenceBindings:structuredClone(p.request.referenceBindings)};mutate(r);
  if(name==='outgoing-owner-still-present')r.worlds[0].source=await stoppedFileSource(p.receipt.worlds[0].filename);
  let reason;try{await negativeStore.commit(r);}catch(e){reason=String(e.message).slice(0,160);}
  if(!reason)throw Error('Accepted corrupted next native handoff '+name);
  const after=await digests(),selectedAfter=await negativeStore.read();assert.deepEqual(selectedAfter,selectedBefore,'Rejected staging changed the selected save');
  const slot=selectedBefore.record.slot,protectedNames=['Frontier_Revision.checkpoint','Frontier_Revision_Identity.json',`Frontier_Revision_State_${slot}.json`,
    `Frontier_Revision_Source_${slot}.GMP`,`Frontier_Revision_Destination_${slot}.GMP`];
  for(const file of protectedNames)assert.equal(after[file],before[file],'Rejected write changed a selected file');
  const changed=names.filter(file=>after[file]!==before[file]);
  if(name==='wrong-native-world-digest')assert.deepEqual(changed,[`Frontier_Revision_Source_${1-slot}.GMP`]);else assert.deepEqual(changed,[]);
  assert.equal((await readdir(directory)).length,8);assert.ok(stats.largestRead<=4096&&stats.largestWrite<=4096&&stats.peakReads===1);
  results.push({name,unchangedCopiedRequestCommittedBeforeMutation:true,refused:true,selectedCopiedSaveUnchanged:true,inactiveStagingFilesChanged:changed,reason});console.log(JSON.stringify({completed:results.length,total:mutations.length,name,refused:true}));
}
for(const name of names)assert.equal(await hashCheckpointSource(await stoppedFileSource(join(canonical,name))),hashes[name]);
await writeFile(out,JSON.stringify({qualified:true,scope:'Seven invalid actual next handoff requests on owned store copies; each follows a successful unchanged copied commit. Every selected copied save and all eight canonical files stay unchanged. A bad incoming digest changes only an inactive outgoing staging file; no selected-manifest publication occurs.',
  fixture,controls:results,canonicalFilesUnchanged:8,browserUsed:false,nativeProcessesStarted:0,wholeBrowserMemoryBoundQualified:false},null,2)+'\n',{flag:'wx'});
