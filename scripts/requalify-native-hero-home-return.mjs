#!/usr/bin/env node
// Requalify a terminal completed second return whose launch driver counted
// only two generic home-ready events. Preserve all original run evidence.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
const [input,output]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(input,/^output\/native-hero-binding-attempt-\d{3}\.json$/);
assert.ok(new RegExp('^'+input.slice(0,-5)+'-requalified(?:-[0-9]{3})?\\.json$').test(output));
await assert.rejects(lstat(output),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256;
async function bound(r){assert.equal((await lstat(r.filename)).size,r.bytes);assert.equal(await hash(r.filename),r.sha256);}
const m=JSON.parse(await readFile(input,'utf8'));
assert.equal(m.publishRepeatHome,true);assert.equal(m.selectedHeroBindingTrialQualified,false);
for(const key of ['nativeSessionTerminal','publicationWorkerTerminal','ownedProducerAbsent','publicationWorkerAbsent',
 'sourceCheckpointUnchanged','copiedCheckpointUnchanged','startupFixtureUnchanged','nativeExecutableUnchanged',
 'nativeHeroHeldCaptureQualified','nativeSourceRetirementBoundaryObserved'])assert.equal(m[key],true,key);
assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);assert.equal(m.stopReason,null);
assert.deepEqual(m.preservedBefore,m.preservedAfter);assert.equal(m.nativeProcessesStarted,1);assert.equal(m.browserUsed,false);
assert.equal(m.deadlineSeconds,55);assert.equal(m.rssCeilingBytes,512*1024*1024);assert.equal(m.logCeilingBytes,4*1024*1024);
assert.ok(m.resourceSamples.length&&m.resourceSamples.every(r=>r.rssBytes<=m.rssCeilingBytes));
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
for(const key of Object.keys(m).filter(k=>/^nativeSelected.*(?:BoundaryObserved|Qualified)$/.test(k)))assert.equal(m[key],true,key);
assert.equal(m.nativeSelectedHeroRepeatHomeResumeBoundaryObserved,true);
assert.equal(m.bindingBoundaryObserved,false);assert.equal(m.nativeHeroSaveHandshakeQualified,false);
const runnerName=input.replace(/\.json$/,'-runtime.py');
let runtime;try{runtime=await readFile(runnerName);}catch(e){if(e.code!=='ENOENT')throw e;runtime=await readFile('scripts/run-native-hero-binding.py');await writeFile(runnerName,runtime,{flag:'wx'});}
assert.equal(await hash(runnerName),m.runnerSha256);
for(const [name,digest]of Object.entries(m.compiledSourceSha256))assert.equal(await hash(name),digest);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);await bound(m.script);
const log=await readFile(m.log,'utf8');assert.equal(await hash(m.log),m.logSha256);
assert.ok(log.length<m.logCeilingBytes&&!/result=fail|invariant failed|abort from|GplException/.test(log));
const fields=m.runtimeBinding.split('|');assert.equal(fields.length,12);assert.equal(fields[0],'majesty-hero-runtime-v1');
const selected=`[frontier] Selected hero bound region=${fields[1]} unit=${fields[3]} agent=${fields[4]} home=${fields[8]}/${fields[9]} clock=${fields[2]} original-registry=1 reciprocal-home=1`;
assert.equal(log.split(selected).length-1,1);assert.equal(log.split('[frontier] Region 0_0 ready').length-1,3);
for(const [serial,clock]of [[2,103500],[4,104900]]){
 const line=`[frontier] Hero travel target held serial=${serial} region=0_0 clock=${clock} original-load=1 ordinary-ticks=0 source-roots-cleared=1 phase=7 pending=0 owner-published=0 result=pass`;
 assert.equal(log.split(line).length-1,1);
}
const held=m.heldSave;await bound(held.checkpoint);await bound(held.marker);
assert.equal(await readFile(held.marker.filename,'utf8'),held.nativeManifest);assert.equal(held.clock>Number(fields[2]),true);
assert.equal(held.slot,1);assert.equal(held.checkpoint.sha256,held.sha256);assert.equal(held.checkpoint.bytes,held.size);
const retirement=`[frontier] Hero source retirement completed serial=1 region=0_0 unit=${fields[3]} agent=${fields[4]} clock=${held.clock} captured-save-preserved=1 retired-saved=1 wrong-clock-refused=1 wrong-alias-refused=1 duplicate-refused=1 binding-closed=1 phase=7 pending=0 owner-published=0 result=pass`;
assert.equal(log.split(retirement).length-1,1);

const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
const corrected={...m,bindingBoundaryObserved:true,selectedHeroBindingTrialQualified:true,
 postprocessingRequalification:{version:1,original:await descriptor(input),runtimeRunner:await descriptor(runnerName),
 tool:await descriptor('scripts/requalify-native-hero-home-return.mjs'),genericHomeReadyEvents:3,
 reason:'Initial home plus two explicitly qualified saved-home reloads; launch driver expected only two generic ready events.',
 nativeProcessesStarted:0,originalRunPreserved:true,goalComplete:false}};
await writeFile(output,JSON.stringify(corrected,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({terminalSecondReturnRequalified:true,originalRunPreserved:true,nativeProcessesStarted:0,output}));
