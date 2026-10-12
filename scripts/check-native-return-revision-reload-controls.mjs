#!/usr/bin/env node
// Refuse false committed-return reload claims using stopped native evidence.
import {readFile,writeFile,mkdtemp,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {returnRevisionInputs,verifyReturnRevisionSide,verifyReturnRevisionPair} from './check-native-return-revision-reload.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const [activeName,absentName,output]=process.argv.slice(2);
if(process.argv.length!==5)throw Error('Usage: <active terminal manifest> <absent terminal manifest> <fresh output>');
const active=JSON.parse(await readFile(activeName)),absent=JSON.parse(await readFile(absentName)),original=await verifyReturnRevisionPair(activeName,absentName);
const inputs=[];for(let side=0;side<2;++side)inputs.push(await returnRevisionInputs(active.publicationReport,active.selectedRevisionExport.receipt,side,{requireCurrent:false}));
async function storeHashes() {
  const dir=inputs[0].receipt.revisionDirectory,files=(await readdir(dir)).sort(),hashes={};assert.equal(files.length,8);
  for(const name of files)hashes[name]=await hashCheckpointSource(await stoppedFileSource(join(dir,name)));return hashes;
}
const beforeStore=await storeHashes();
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-return-revision-controls-'));
const refused=[];
async function mutation(name,side,change) {
  const base=side?absent:active,file=join(directory,`${name}.json`);
  // Positive copied evidence is checked before EACH refusal, so a bad copied
  // chain or the output path cannot make all controls fail automatically.
  await writeFile(file,JSON.stringify(base)+'\n');await verifyReturnRevisionSide(file,{inputs:inputs[side]});
  const m=structuredClone(base);await change(m);await writeFile(file,JSON.stringify(m)+'\n');
  await assert.rejects(verifyReturnRevisionSide(file,{inputs:inputs[side]}));refused.push(name);
}
const common=[['nonterminal',m=>m.nativeSessionTerminal=false],['exit-failure',m=>m.nativeExitCode=1],['browser-claim',m=>m.browserUsed=true],
  ['actor-reinsert',m=>m.scheduleNpc=true],['actor-delete',m=>m.departNpc=true],['return-activate',m=>m.activateReturnedNpc=true],
  ['actor-identity',m=>m.unitId++],['agent-identity',m=>m.agentId++],['stale-revision',m=>m.selectedRevisionExport.revision--],
  ['another-world',m=>m.selectedRevisionExport.sha256='0'.repeat(64)],['publication-digest',m=>m.publicationReportSha256='0'.repeat(64)],
  ['native-executable',m=>m.nativeExecutableSha256AtLaunch='0'.repeat(64)],['native-source',m=>m.nativeSourceSha256['upstream/majesty-recomp/browser_streaming.cpp']='0'.repeat(64)],
  ['producer-reuse',m=>m.nativePid=inputs[m.side].producer.nativePid],['missing-copy-input',m=>delete m.inputHashes['Joint_Reload_Expected.bin']]];
for(let side=0;side<2;++side)for(const [name,change] of common)await mutation(`${name}-${side}`,side,change);
for(const [name,side,change] of [
  ['active-pinned-clock',0,m=>m.clockMode='pinned'],['active-no-motion',0,m=>m.observeMotion=false],
  ['active-no-schedule-reload',0,m=>m.reloadScheduledNpc=false],['active-no-full-save',0,m=>m.captureEvolvedNpc=false],
  ['active-writer-digest',0,m=>m.expectedWriters.Orders.sha256='0'.repeat(64)],
  ['dormant-clock-advance',1,m=>m.clockMode='monotonic'],['dormant-motion',1,m=>m.observeMotion=true],
  ['dormant-schedule',1,m=>m.reloadScheduledNpc=true],['dormant-save-mode',1,m=>m.captureEvolvedNpc=true],
])await mutation(name,side,change);
const logs=[
  ['wrong-starting-clock',0,l=>l.replace('clock=28000 fixed=','clock=27950 fixed=')],
  ['missing-ai',0,l=>l.replace(/^\[streaming\] Joint script motion completed.*\n/m,'')],
  ['missing-original-loader',0,l=>l.replace(/^\[streaming\] Original load end.*\n/m,'')],
  ['changed-saved-queue',0,l=>l.replace('queued=1 queue-mutated=0 result=pass','queued=1 queue-mutated=1 result=pass')],
  ['missing-absence',1,l=>l.replace('unit-absent=1 agent-absent=1','unit-absent=0 agent-absent=1')],
  ['changed-dormant-counters',1,l=>l.replace('counters-same=1','counters-same=0')],
  ['changed-dormant-queues',1,l=>l.replace('queues-same=1','queues-same=0')],
];
for(const [name,side,change] of logs)await mutation(name,side,async m=>{
  const log=await readFile(m.log,'utf8'),altered=change(log);assert.notEqual(altered,log,'Control must alter native evidence');
  m.log=join(directory,name+'.log');await writeFile(m.log,altered,{flag:'wx'});
});
// Pair-level ordering is checked with unchanged side evidence first.
const activeCopy=join(directory,'pair-active.json'),absentCopy=join(directory,'pair-absent.json');
await writeFile(activeCopy,JSON.stringify(active)+'\n');await writeFile(absentCopy,JSON.stringify(absent)+'\n');
await verifyReturnRevisionPair(activeCopy,absentCopy);
const overlapping={...absent,startedAtMs:active.finishedAtMs-1};await writeFile(absentCopy,JSON.stringify(overlapping)+'\n');
await assert.rejects(verifyReturnRevisionPair(activeCopy,absentCopy));refused.push('parallel-native-process-claim');
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(await readFile(activeName)),original.active.sourceManifestSha256);assert.equal(sha(await readFile(absentName)),original.absent.sourceManifestSha256);
assert.deepEqual(await storeHashes(),beforeStore);
await writeFile(output,JSON.stringify({qualified:true,refused:refused.length,cases:refused,unchangedCopiesQualifiedBeforeEveryRefusal:true,
  actualNativeManifestsUnchanged:true,canonicalStoreUnchanged:true,canonicalStoreSha256:beforeStore,fixture:directory,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,refused:refused.length,actualNativeManifestsUnchanged:true}));
