#!/usr/bin/env node
// Corrupt copied observations in memory; never change a native snapshot or log.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {verifyConnectedResidency} from './check-native-connected-residency.mjs';
import {connectedWorldState,connectedResidencyCycles,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';

const[name,out]=process.argv.slice(2);if(!name||!out||process.argv.length!==4)throw Error('Usage: <terminal connected residency manifest> <fresh controls report>');
const proof=await verifyConnectedResidency(name),manifest=JSON.parse(await readFile(name,'utf8'));
assert.equal(proof.bothGeneratedRegionsRevisited,true);
const visits=[];
for(const visit of proof.visits)visits.push({before:await connectedWorldState(visit.before.filename),after:await connectedWorldState(visit.after.filename)});
const log=await readFile(manifest.log,'utf8');
const initializing=manifest.generatedRegionInitialization==='v1';
const checkCycles=(text,states=visits)=>connectedResidencyCycles(text,states,{initializeGeneratedRegions:initializing});
assert.equal(checkCycles(log).length,visits.length);
const cases=[];
const reject=(label,fn)=>{assert.throws(fn,undefined,label);cases.push({case:label,refused:true});};
const firstLine=pattern=>{const line=log.split('\n').find(line=>pattern.test(line));assert.ok(line,'Missing actual positive control anchor');return line;};
const exit=firstLine(/^\[streaming\] World residency exit=0 /);
const snapshot=firstLine(/^\[streaming\] World persistence snapshot visit=0 .*stage=after /);
const activeVisit=initializing?2:0;
const completed=firstLine(new RegExp(`^\\[streaming\\] World checkpoint completed visit=${activeVisit} `));
for(const[label,changed]of [
  ['missing original disposal',log.replace(exit+'\n','')],
  ['duplicate original disposal',log.replace(exit,exit+'\n'+exit)],
  ['world remains active after disposal',log.replace(exit,exit.replace('world-null=1','world-null=0'))],
  ['a tracked root was not freed',log.replace(exit,exit.replace('roots-freed=1,1,1,1,1,1','roots-freed=1,1,1,1,1,0'))],
  ['a tracked root was freed twice',log.replace(exit,exit.replace('roots-freed=1,1,1,1,1,1','roots-freed=1,1,1,1,1,2'))],
  ['missing saved regional publication',log.replace(snapshot+'\n','')],
  ['checkpoint occurred inside a hook',log.replace(completed,completed.replace('hook-depth=0','hook-depth=1'))],
  ['checkpoint precedes its completed tick',log.replace(completed,completed.replace('entry-tick=19','entry-tick=20'))],
  ['one simulation tick was omitted',log.replace(`request=${activeVisit} observed-ticks=20`,`request=${activeVisit} observed-ticks=19`)],
  ['script did not reach completion',log.replace('all expectations met','incomplete script')],
]){
  assert.notEqual(changed,log);reject(label,()=>checkCycles(changed));
}
if(initializing){
  const initialized=firstLine(/^\[streaming\] World checkpoint initialized visit=0 /);
  for(const[label,changed]of [
    ['missing initialization boundary',log.replace(initialized+'\n','')],
    ['duplicate initialization boundary',log.replace(initialized,initialized+'\n'+initialized)],
    ['original tick was not skipped',log.replace(initialized,initialized.replace('original-tick-skipped=1','original-tick-skipped=0'))],
    ['initialization advanced a simulation tick',log.replace(initialized,initialized.replace(' tick=0 ',' tick=1 '))],
    ['simulation entered before initialization publication',log.replace(initialized,'[streaming] World residency first-tick load=0 tick=0 phase=3 pending=0\n'+initialized)],
    ['initialization logged inside hook',log.replace(initialized,initialized.replace('hook-depth=0','hook-depth=1'))],
  ]){assert.notEqual(changed,log);reject(label,()=>checkCycles(changed));}
  for(const[field,value]of [['clock',visits[0].after.clock+1],['rng',visits[0].after.rng^1],
    ['gameplayRng',visits[0].after.gameplayRng^1],['rawTerrainSha256','0'.repeat(64)]]){
    const changed=structuredClone(visits);changed[0].after[field]=value;
    reject('initialization changed '+field,()=>checkCycles(log,changed));
  }
  const changed=structuredClone(visits),id=Object.keys(changed[0].after.records.units)[0];assert.ok(id);
  changed[0].after.records.units[id].sha256='0'.repeat(64);
  reject('initialization changed actual unit',()=>checkCycles(log,changed));
  const queue=structuredClone(visits);queue[0].after.queues[0].push(1);
  reject('initialization changed schedule queue',()=>checkCycles(log,queue));
}
const before=visits[0].after,after=visits[2].before;
compareConnectedWorlds(before,after);
for(const[field,value]of [['clock',after.clock+1],['rng',after.rng^1],['gameplayRng',after.gameplayRng^1]]){
  const changed=structuredClone(after);changed[field]=value;reject('changed restored '+field,()=>compareConnectedWorlds(before,changed));
}
const unitId=Object.keys(after.records.units)[0],changed=structuredClone(after);
assert.ok(unitId);changed.records.units[unitId].sha256='0'.repeat(64);
reject('changed actual restored unit',()=>compareConnectedWorlds(before,changed));
for(const[file,digest]of Object.entries(proof.evidenceSha256))assert.equal((await hashNativeFile(file)).sha256,digest,'Actual evidence changed during controls');
await writeFile(out,JSON.stringify({version:1,componentControlsQualified:true,sourceManifest:name,sourceManifestSha256:proof.sourceManifestSha256,
  actualCycles:proof.cycles.length,cases,actualEvidenceUnchanged:true,firstGeneratedLoadsPreserved:proof.firstGeneratedLoadsPreserved,
  generatedRegionsInitializedWithoutSimulation:proof.generatedRegionsInitializedWithoutSimulation,
  fullGeneratedRegionHandoffQualified:proof.fullGeneratedRegionHandoffQualified,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({componentControlsQualified:true,refusals:cases.length,fullGeneratedRegionHandoffQualified:proof.fullGeneratedRegionHandoffQualified}));
