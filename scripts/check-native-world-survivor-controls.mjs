#!/usr/bin/env node
// Contradict the actual survivor observations, without another game launch.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseWorldSurvivors,verifyWorldSurvivors} from './check-native-world-survivors.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [manifest,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal persistence manifest> <fresh controls report>');
const proof=await verifyWorldSurvivors(manifest),m=JSON.parse(await readFile(manifest,'utf8'));
const log=await readFile(m.log,'utf8');assert.equal(sha(log),proof.evidenceSha256[m.log]);
const count=proof.visits.length,rows=log.match(/^\[streaming\] World survivors .*$/gm);assert.equal(rows.length,count*3);
const checks=[];
function refuses(name,bad) {
  assert.notEqual(bad,log);assert.deepEqual(parseWorldSurvivors(log,count),proof.visits);
  assert.throws(()=>parseWorldSurvivors(bad,count));checks.push({name,unchangedActualPositivePassed:true,refused:true});
}
function changed(name,pattern,replacement,index=rows.length-1) {
  const row=rows[index],bad=row.replace(pattern,replacement);assert.notEqual(bad,row);
  refuses(name,log.replace(row,bad));
}
for(const field of ['heap-same','crt-same','clock-same','hooks-same'])changed('observer changed '+field,new RegExp(field+'=1'),field+'=0');
changed('failed observation',/result=pass/,'result=fail');
changed('runtime replaced',/runtime=([0-9a-f]{8})/,(_,v)=>'runtime='+((parseInt(v,16)^4)>>>0).toString(16).padStart(8,'0'));
changed('surviving manager replaced',/managers=([0-9a-f]{8})/,(_,v)=>'managers='+((parseInt(v,16)^4)>>>0).toString(16).padStart(8,'0'));
changed('required manager absent',/managers=[0-9a-f]{8}/,'managers=00000000');
if(proof.visits[0].loaded.managers[1]===0)changed('absent registry carries nonzero count',/trees=(\d+),\d+/,'trees=$1,1');
changed('unexpected registry count',/trees=\d+/,'trees=100001');
changed('wrong tree vector length',/(trees=[0-9,]+)/,'$1,0');
changed('wrong free vector length',/(free-used=[0-9,]+)/,'$1,0');
changed('wrong manager vector length',/(managers=[0-9a-f,]+)/,'$1,00000004');
changed('invalid guest address',/runtime=[0-9a-f]{8}/,'runtime=fffffffff');
changed('wrong observed visit',/visit=\d+/,'visit='+count);
changed('wrong world lifetime',/world-null=1/,'world-null=0');
changed('wrong observation stage',/stage=after-exit/,'stage=load');
changed('missing batch capacity',/ batch-cap=\d+/,'');
changed('batch used beyond capacity',/batch-used=\d+/,()=> 'batch-used='+(proof.visits.at(-1).afterExit.batchCapacity+1));
changed('batch capacity outside observer bound',/batch-cap=\d+/,'batch-cap=262145');
changed('free count exceeds capacity',/free-used=\d+/,()=> 'free-used='+(proof.visits.at(-1).afterExit.freeCapacity[0]+1));
changed('incorrect backing byte sum',/vector-bytes=\d+/,()=> 'vector-bytes='+(proof.visits.at(-1).afterExit.vectorBytes+4));
refuses('missing final observation',log.replace(rows.at(-1)+'\n',''));
refuses('duplicate observation',log+rows.at(-1)+'\n');
const before=rows.at(-2),after=rows.at(-1);
refuses('before-exit observer reordered after exit',log.replace(before+'\n','').replace(after,after+'\n'+before));
const report={qualified:true,scope:'Actual full persistence and survivor observations requalified; contradictory lifetime, counter, ownership and mutation evidence refuses without launching another game.',
  sourceManifest:proof.sourceManifest,sourceManifestSha256:proof.sourceManifestSha256,checks,controlsRefused:checks.length,
  browserUsed:false,nativeProcessesStarted:0,originalBoundedRegionResidencyQualified:false,wholeBrowserMemoryBoundQualified:false,
  sourceSha256:{...proof.sourceSha256,'scripts/check-native-world-survivor-controls.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:proof.evidenceSha256};
await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,controlsRefused:checks.length}));
