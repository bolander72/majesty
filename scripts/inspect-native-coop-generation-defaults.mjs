#!/usr/bin/env node
// Original stopped saves and actual production generation-default markers.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectCoopWorld} from './inspect-native-coop-world.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {freestyleConfiguration} from './lib/coop-generated-configuration.mjs';
import {checkpointChunks} from '../web/world/checkpoint.mjs';
import {agentSavedScalars} from './inspect-native-gpl-agent-initialization.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';

export async function inspectGenerationDefaults(name) {
  const report=resolve(name),raw=await readFile(report);assert.ok(raw.length<=2*1024*1024);
  const m=JSON.parse(raw),world=await inspectCoopWorld(report);
  const log=await readFile(join(m.profile,'..','native.log'),'utf8');assert.ok(log.length<=4*1024*1024);
  const marker='[network] Original view saved defaults initialized offsets=18,38,3c,40,44 original-constructor=004384b0 saved-reader-preserved=1 result=pass';
  assert.equal(log.split('\n').filter(l=>l===marker).length,1);
  const seeded=[...log.matchAll(/^\[coop-generation\] Original terrain RNG seeded epoch=(\d+) region=([-\d]+_[-\d]+) seed=(\d+) owner=006d8e80 original-setter=004f6710 gameplay-rng-separate=1 result=pass$/gm)];
  const constructed=[...log.matchAll(/^\[coop-generation\] Constructed epoch=(\d+) region=([-\d]+_[-\d]+) seed=(\d+) players=2 extent=128,128 preserved=1$/gm)];
  assert.equal(seeded.length,constructed.length);assert.equal(seeded.length,m.originalLoadedTargetSaved?2:1);
  for(const [i,r]of seeded.entries()) {
    assert.deepEqual(r.slice(1),constructed[i].slice(1));assert.ok(+r[3]>0&&+r[3]<=0x7fffffff);
    assert.ok(r.index<constructed[i].index);
    if(i)assert.ok(constructed[i-1].index<r.index);
  }
  const snapshots=[];
  const targets=m.originalLoadedTargetSaved?[{...m.loadedTargetSnapshot,label:'Coop_World_Target'}]:[];
  for(const snapshot of [...m.worldSnapshots,...targets]) {
    const source=await stoppedFileSource(snapshot.path);let seed,ids;
    assert.equal(source.size,snapshot.bytes);assert.equal(await hashCheckpointSource(source),snapshot.sha256);
    for await(const c of checkpointChunks(source)) {
      if(c.tag==='SVGD') {assert.ok(c.size<=1024);seed=freestyleConfiguration(Buffer.from(await source.readAt(c.offset+16,c.size))).words[12];}
      if(c.tag==='GSGL') {assert.deepEqual([c.version,c.count],[6,0]);assert.ok(c.size>=64);const b=Buffer.from(await source.readAt(c.offset+16,64));ids=[48,52,56,60].map(at=>b.readUInt32LE(at));}
    }
    assert.ok(ids);assert.deepEqual(ids,[0,0,0,0],'Untouched new favorite-view slots must save defined zero IDs');
    const generation=snapshot.label==='Coop_World_Target'?seeded[1]:seeded[0];
    if(snapshot.label==='Coop_World_Target')assert.equal(seed,+generation[3]);
    // The original recipient retains its local setup seed in owning SVGD
    // while GameStart seeds the live source RNGs. Preserve that actual saved
    // field; validate original clock-zero RNG state against generation instead.
    else assert.equal(world.snapshots[0].gameplayRng,+generation[3]);
    const agents=await agentSavedScalars(snapshot.path);assert.ok(agents.every(a=>a.serializedNativeOffset44Value===0));
    snapshots.push({path:snapshot.path,owningConfigurationSeed:seed,generationSeed:+generation[3],newViewFavoriteIds:ids,agents:agents.length,newAgentSavedScalarsZero:true});
  }
  return {version:1,report,reportSha256:createHash('sha256').update(raw).digest('hex'),originalRole:world.originalRole,
    productionSeededGenerations:seeded.map(r=>({epoch:+r[1],region:r[2],seed:+r[3]})),snapshots,
    actualCoopTerrainRngSeedingQualified:true,actualNewViewDefaultsQualified:true,
    crossRoleWorldEqualityQualified:false,legacyValuePreservationQualified:false,browserUsed:false,
    scope:'Actual admitted cooperative original generation uses the same configured seed for its separate terrain RNG, and untouched new favorite-view slots save defined IDs. Cross-role full-world equality and legacy value preservation require separate comparisons.'};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  try {assert.equal(process.argv.length,4);const p=await inspectGenerationDefaults(process.argv[2]);await writeFile(resolve(process.argv[3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({originalRole:p.originalRole,generations:p.productionSeededGenerations.length,snapshots:p.snapshots.length,defaults:true}));}
  catch(e) {console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0]}));process.exitCode=1;}
}
