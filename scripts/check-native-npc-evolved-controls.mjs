#!/usr/bin/env node
// Offline corruptions on copied capture profiles; never change a live engine.
import {readFile,writeFile,mkdtemp,mkdir,copyFile,open} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {workspace} from './lib/stopped-entity-io.mjs';
const run=promisify(execFile),[manifestName,output]=process.argv.slice(2);
if(!manifestName||!output||process.argv.length!==4)throw Error('Usage: <terminal capture manifest> <fresh output>');
const checker=join(workspace,'scripts/check-native-npc-evolved.mjs');
const {stdout}=await run(process.execPath,[checker,manifestName,'--stdout'],{maxBuffer:2*1024*1024}),proof=JSON.parse(stdout),m=proof.fixture;
const owned=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-joint-reload-evolved-controls-'));
const profile=join(owned,'frontier_0_0');await mkdir(profile);
for(const name of [...Object.keys(m.inputHashes),'Joint_Reload_Unit.bin','Joint_Reload_GPL.bin','Joint_Reload_Orders.bin','Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP']) {
  const target=join(profile,name);await mkdir(resolve(target,'..'),{recursive:true});await copyFile(join(m.profile,name),target);
}
const log=await readFile(m.log,'utf8'),cases=[];
async function refuse(name,overrides={},changedLog=log) {
  const logName=join(owned,name+'.log'),reportName=join(owned,name+'.json');
  await writeFile(logName,changedLog);await writeFile(reportName,JSON.stringify({...m,profile,log:logName,...overrides}));
  let reason;
  try{await run(process.execPath,[checker,reportName,'--stdout'],{maxBuffer:2*1024*1024});}
  catch(e){if(e.code!==1)throw e;reason=e.stderr.match(/Error: ([^\n]*)/)?.[1]||'Independent capture/motion validation refused';}
  assert.ok(reason,'Accepted evolved corruption: '+name);cases.push({name,rejected:true,reason});
}
for(const [field,value] of [['captureEvolvedNpc',false],['observeMotion',false],['nativeOnly',false],['browserUsed',true],['nativeSessionTerminal',false],['nativeExitCode',6]])await refuse(field,{[field]:value});
for(const [name,changed] of [
  ['missing-evolved-save',log.replace(/^\[streaming\] Joint evolved checkpoint .*\n/gm,'')],
  ...['queued','saved','state-same','hooks-same'].map(field=>[field+'-zero',log.replace(new RegExp('(Joint evolved checkpoint .*?'+field+'=)1'),(_,prefix)=>prefix+'0')]),
  ['wrong-clock',log.replace(/(Joint evolved checkpoint .*?clock=)\d+/,(_,prefix)=>prefix+'1')],
  ['wrong-position',log.replace(/(Joint evolved checkpoint .*?fixed=)-?\d+/,(_,prefix)=>prefix+'1')],
  ['wrong-owned-unit',log.replace(/(Joint evolved checkpoint unit=)\d+/,(_,prefix)=>prefix+'511')],
]){assert.notEqual(changed,log);await refuse(name,{},changed);}
const save=join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Evolved.GMP');
await copyFile(join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'),save);await refuse('rolled-back-world');
await copyFile(proof.after.filename,save);
const f=await open(save,'r+');try{const b=Buffer.alloc(4);b.writeUInt32LE(proof.agentId+1);await f.write(b,0,4,proof.after.records.GPL.offset);}finally{await f.close();}
await refuse('changed-script-identity');
await writeFile(output,JSON.stringify({qualified:true,rejected:cases.length,cases,nativeProcessesStarted:0,browserUsed:false,originalEvidenceModified:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,rejected:cases.length,nativeProcessesStarted:0,browserUsed:false}));
