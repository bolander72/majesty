#!/usr/bin/env node
// Rejected save provenance must never advance the selected ownership manifest.
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {prepareNativeRevisionSave} from './publish-native-entity-revision.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {REVISION_MANIFEST} from '../web/world/entity-revisions.mjs';
const [reloadName,captureName,output]=process.argv.slice(2);
if(!reloadName||!captureName||!output||process.argv.length!==5)throw Error('Usage: <native revision reload> <new save proof> <fresh report>');
const reload=JSON.parse(await readFile(reloadName,'utf8')),capture=JSON.parse(await readFile(captureName,'utf8'));
const returned=reload.freshPairedReturnedRevisionNativeReloadQualified===true;
const p=await prepareNativeRevisionSave(reloadName,captureName);
const selectedFile=join(p.receipt.revisionDirectory,REVISION_MANIFEST),before=await readFile(selectedFile);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-entity-revision-save-controls-'));
const changes=[
  ['unqualified reload',r=>{r[returned?'freshPairedReturnedRevisionNativeReloadQualified':'selectedRevisionNativeReloadQualified']=false;}],
  ['save from unrelated native run',(_,c)=>{c.sourceManifest=returned?reload.absent.sourceManifest:reload.sourceManifest;}],
  ['changed loaded snapshot',(_,c)=>{c.before.sha256='f'.repeat(64);} ],
  ['changed saved snapshot',(_,c)=>{c.after.sha256='f'.repeat(64);} ],
  ['reset saved clock',(_,c)=>{c[returned?'savedClock':'clock']=returned?reload.active.motionSamples[0][1]:reload.evolvedStartingClock;}],
  ['changed native alias',(_,c)=>{c.after.actor.unitId++;}],
  ['invented schedule membership',(_,c)=>{c.after.queued=0;}],
  ['nonterminal native save',(_,c)=>{c.fixture.nativeSessionTerminal=false;}],
];
const cases=[];
for(let i=0;i<changes.length;++i) {
  const [name,change]=changes[i],r=structuredClone(reload),c=structuredClone(capture);change(r,c);
  const rn=join(directory,`reload-${i}.json`),cn=join(directory,`capture-${i}.json`);
  await writeFile(rn,JSON.stringify(reload)+'\n',{flag:'wx'});await writeFile(cn,JSON.stringify(capture)+'\n',{flag:'wx'});
  await prepareNativeRevisionSave(rn,cn);
  await writeFile(rn,JSON.stringify(r)+'\n');await writeFile(cn,JSON.stringify(c)+'\n');
  await assert.rejects(prepareNativeRevisionSave(rn,cn));
  assert.deepEqual(await readFile(selectedFile),before);cases.push({name,rejected:true,selectedManifestUnchanged:true});
}
await writeFile(output,JSON.stringify({qualified:true,cases,rejected:cases.length,selectedManifestUnchanged:true,
  nativeProcessesStarted:0,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:cases.length,selectedManifestUnchanged:true}));
