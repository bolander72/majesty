#!/usr/bin/env node
// Contradictions of the actual completed-tick boundary, using log copies only.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyCompletedCheckpoint,parseCompletedTickLog} from './check-native-completed-checkpoint.mjs';
import {assertCompletedTickAdapter,completedTickAdapterSha,ORIGINAL_FRONTIER_SHA} from './lib/completed-tick-adapter.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const proof=await verifyCompletedCheckpoint(name),m=JSON.parse(await readFile(name));
const visits=proof.heapVisitClocks,actual=(await readFile(m.log)).toString('utf8');
const golden=parseCompletedTickLog(actual,visits),checks=[];
function refuses(label,bad) {
  assert.notEqual(bad,actual);assert.deepEqual(parseCompletedTickLog(actual,visits),golden);
  assert.throws(()=>parseCompletedTickLog(bad,visits));checks.push({name:label,actualPositivePassed:true,refused:true});
}
const complete=actual.match(/^\[streaming\] World checkpoint completed visit=0 .*$/m)[0];
const exit=actual.match(/^\[streaming\] World checkpoint exit visit=0 .*$/m)[0];
const change=(label,line,pattern,replacement)=>refuses(label,actual.replace(line,line.replace(pattern,replacement)));
change('wrong visit',complete,'visit=0','visit=1');
change('save clock drift',complete,/clock=(\d+)/,(_,v)=>`clock=${Number(v)+50}`);
change('incomplete tick',complete,/entry-tick=(\d+)/,(_,v)=>`entry-tick=${Number(v)+1}`);
change('wrong completed tick count',complete,'completed-ticks=20','completed-ticks=19');
change('nested hook save',complete,'hook-depth=0','hook-depth=1');
change('missing guest execution ownership',complete,'baton=1','baton=0');
change('false pass',complete,'result=pass','result=fail');
change('exit clock advance',exit,/ clock=(\d+)/,(_,v)=>` clock=${Number(v)+50}`);
change('exit tick advance',exit,/ tick=(\d+)/,(_,v)=>` tick=${Number(v)+1}`);
change('saved clock mismatch',exit,/saved-clock=(\d+)/,(_,v)=>`saved-clock=${Number(v)+50}`);
change('saved tick mismatch',exit,/saved-tick=(\d+)/,(_,v)=>`saved-tick=${Number(v)+1}`);
refuses('missing completed boundary',actual.replace(complete+'\n',''));
refuses('duplicate completed boundary',actual.replace(complete,complete+'\n'+complete));
refuses('extra malformed boundary',actual+'\n[streaming] World checkpoint exit invalid\n');
refuses('save follows exit',actual.replace(complete,'__BOUNDARY_SWAP__').replace(exit,complete).replace('__BOUNDARY_SWAP__',exit));
const valid=await completedTickAdapterSha();await assertCompletedTickAdapter(valid,ORIGINAL_FRONTIER_SHA);
await assert.rejects(()=>assertCompletedTickAdapter('0'.repeat(64),ORIGINAL_FRONTIER_SHA));
checks.push({name:'unqualified adapter change',actualPositivePassed:true,refused:true});
await assert.rejects(()=>assertCompletedTickAdapter(valid,'0'.repeat(64)));
checks.push({name:'wrong original adapter',actualPositivePassed:true,refused:true});
const report={qualified:true,scope:'Actual original persistence and post-completed-tick clock/dispatch observations independently requalified; altered logs and unrelated adapter hashes refuse. No additional game process.',
 sourceManifest:proof.sourceManifest,sourceManifestSha256:proof.sourceManifestSha256,checks,controlsRefused:checks.length,
 completedTickCheckpointBoundaryQualified:true,continuousTravelQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,
 sourceSha256:{...proof.sourceSha256,'scripts/check-native-completed-checkpoint-controls.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:proof.evidenceSha256};
await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,controlsRefused:checks.length}));
