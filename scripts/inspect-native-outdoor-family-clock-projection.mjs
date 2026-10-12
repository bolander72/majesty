#!/usr/bin/env node
// Verify projected active-clock bytes after original import and guarded saving.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectNativeOutdoorFamilySnapshots} from './inspect-native-outdoor-family-snapshots.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {outdoorHash} from './lib/registered-hero-outdoor-save.mjs';
import {checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/family-order-entries.mjs';
export async function inspectNativeOutdoorFamilyClockProjection(name){
  const native=JSON.parse(await readFile(name,'utf8')),prep=JSON.parse(await readFile(native.preparation,'utf8'));
  assert.equal(prep.familyClockProjectionPrepared,true);assert.equal(prep.clockPlan.contexts.length,12);
  assert.deepEqual(prep.scriptClockProjection.patches.map(p=>[p.before,p.after]),[[57650,24250]]);
  const snapshots=await inspectNativeOutdoorFamilySnapshots(name),observations=[];
  for(const phase of ['Ready','Held']){
    const source=await stoppedFileSource(snapshots.worlds[phase].filename),contexts=[];
    for await(const v of checkpointAgentValues(source,snapshots.agentId))if(v.type===8){
      const b=Buffer.from(await source.readAt(v.stateOffset,16)),state=Array.from({length:4},(_,i)=>b.readUInt32LE(i*4));
      contexts.push({attribute:v.attribute,path:[...v.path],state,functions:v.functions.map(f=>f.name)});
    }
    assert.equal(contexts.length,12);assert.deepEqual(contexts.filter(c=>c.state[2]).map(c=>({attribute:c.attribute,state:c.state,functions:c.functions})),[
      {attribute:'activescript',state:[300,24250,2,0],functions:['travel_to']}]);
    for(const c of contexts.filter(c=>!c.state[2]))assert.deepEqual(c.state,[0,0,0,0]);
    const headers=[];for(const id of [snapshots.heroId,...snapshots.effectIds])for await(const e of checkpointActorOrderEntries(source,id))if(e.type==='entry')
      headers.push({unitId:id,kind:e.kind,stamp:e.words[5],ageAtPauseMs:(24250-e.words[5])>>>0});
    assert.deepEqual(headers.map(h=>[h.kind,h.stamp,h.ageAtPauseMs]),[[4,24250,0],[7,24250,0],[5,24200,50],[9,23950,300],[9,23950,300]]);
    observations.push({phase,world:snapshots.worlds[phase],contexts,headers,originalReadersAndWriters:true});
  }
  assert.deepEqual(observations[0].contexts,observations[1].contexts);assert.deepEqual(observations[0].headers,observations[1].headers);
  const sourceSha256={};for(const n of ['scripts/inspect-native-outdoor-family-clock-projection.mjs','web/world/actor-family-clocks.mjs','web/world/family-order-entries.mjs'])sourceSha256[n]=await outdoorHash(join(workspace,n));
  return {version:1,originalNativeFamilyClockProjectionRestored:true,
    scope:'Runtime preparation jointly projects the actual selected outdoor script/command stamps. Original receiving readers restore the projected active travel_to context and five dispatch stamps, and original Ready/Held writers preserve those bytes and eleven inactive contexts. Both whole-family guards remain installed during the interval; normal remote script execution and continuous crossing are still unqualified.',
    manifest:resolve(name),manifestSha256:await outdoorHash(name),nativeExecutableSha256:snapshots.nativeExecutableSha256,
    preparation:native.preparation,preparationSha256:native.preparationSha256,selectedReceipt:snapshots.selectedReceipt,selectedReceiptSha256:snapshots.selectedReceiptSha256,
    sourceClockMs:57650,destinationClockMs:24250,projectedActiveScriptContexts:1,unchangedInactiveContexts:11,projectedOrderClockSites:5,
    heroId:snapshots.heroId,agentId:snapshots.agentId,effectIds:snapshots.effectIds,observations,
    otherReceivingUnitsPreserved:snapshots.otherRetiredUnitsExact,otherReceivingAgentsPreserved:snapshots.otherRetiredAgentsExact,
    maximumSampledRssBytes:snapshots.maximumSampledRssBytes,sourceSha256,
    activeRemoteContinuationQualified:false,fullReceivingReloadQualified:false,nativeOwnershipActivationQualified:false,seamlessHeroCrossingQualified:false,browserUsed:false};
}
if(resolve(process.argv[1]||'')===resolve(new URL(import.meta.url).pathname)){
  const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);const r=await inspectNativeOutdoorFamilyClockProjection(name);
  await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({originalNativeFamilyClockProjectionRestored:true,scriptContexts:1,orderClockSites:5,
    heroId:r.heroId,agentId:r.agentId,browserUsed:false}));
}
