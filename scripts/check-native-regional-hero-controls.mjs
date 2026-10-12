#!/usr/bin/env node
// Changed prepared bytes with matching replacement hashes must still fail the
// independent original-record comparison. All controls run without a game.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {workspace} from './lib/stopped-entity-io.mjs';
const [preparation,audit,output]=process.argv.slice(2);assert.equal(process.argv.length,5);
const original=JSON.parse(await readFile(preparation,'utf8'));
const cases=[['cached-point','order',320],['native-home','order',244],
  ['opaque-unit-state','unit',200],['effect-age','attached_order_528',80],['effect-parent','attached_529',56]];
const outcomes=[];
for(const [name,record,offset]of cases){
  const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-control-'));
  const p=structuredClone(original);p.directory=directory;
  for(const [key,r]of Object.entries(p.records)){
    const b=await readFile(r.filename);if(key===record)b[offset]^=1;
    r.filename=join(directory,key+'.bin');r.sha256=createHash('sha256').update(b).digest('hex');await writeFile(r.filename,b,{flag:'wx'});
  }
  const manifest=join(directory,'preparation.json');await writeFile(manifest,JSON.stringify(p)+'\n',{flag:'wx'});
  const checked=join(directory,'unexpected.json'),run=spawnSync(process.execPath,
    ['scripts/check-native-regional-hero.mjs',manifest,audit,checked],{cwd:workspace,encoding:'utf8',timeout:20000,maxBuffer:65536});
  assert.equal(run.error,undefined);assert.equal(run.signal,null);assert.equal(run.status,1);
  assert.match(run.stderr,/Unexpected copied record bytes:/);assert.ok(!run.stderr.includes('sha256'));
  outcomes.push({name,record,offset,rejected:true,reason:'complete original-record byte comparison',directory});
}
await writeFile(output,JSON.stringify({version:1,preparedRecordContradictionsRefused:true,
  preparation:resolve(preparation),controls:outcomes,browserUsed:false,nativeProcessesStarted:0,
  sourceSha256:{'scripts/check-native-regional-hero-controls.mjs':createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex')}},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({preparedRecordContradictionsRefused:true,controls:outcomes.length,nativeProcessesStarted:0}));
