#!/usr/bin/env node
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {workspace} from './lib/stopped-entity-io.mjs';
const [captureName,output]=process.argv.slice(2);
if(!captureName||!output||process.argv.length!==4)throw Error('Usage: <evolved capture> <fresh report>');
const original=JSON.parse(await readFile(captureName,'utf8')),run=promisify(execFile),script=join(workspace,'scripts/inspect-native-npc-departure.mjs');
const valid=JSON.parse((await run(process.execPath,[script,resolve(captureName),'--stdout','--evolved'],{maxBuffer:65536})).stdout);
assert.equal(valid.qualified,true);assert.equal(valid.evolvedSource,true);assert.equal(valid.queuedActor,1);assert.deepEqual(valid.incoming,[]);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-evolved-departure-controls-'));
const changes=[
  ['unqualified evolved capture',r=>{r.originalEvolvedFullSaveQualified=false;}],
  ['altered saved digest',r=>{r.after.sha256='f'.repeat(64);} ],
  ['altered saved world counts',r=>{r.after.counts.units++;}],
  ['invented terminal state',r=>{r.fixture.nativeSessionTerminal=false;}],
  ['altered own script alias',r=>{r.agentId++;}],
  ['altered saved schedule',r=>{r.after.queued=0;}],
];
const cases=[];
for(const [i,[name,change]] of changes.entries()) {
  const r=structuredClone(original);change(r);const file=join(directory,`capture-${i}.json`);await writeFile(file,JSON.stringify(r)+'\n',{flag:'wx'});
  await assert.rejects(run(process.execPath,[script,file,'--stdout','--evolved'],{maxBuffer:65536}));cases.push({name,rejected:true});
}
await writeFile(output,JSON.stringify({qualified:true,cases,rejected:cases.length,nativeProcessesStarted:0,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:cases.length}));
