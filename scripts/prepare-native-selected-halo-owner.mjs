#!/usr/bin/env node
// Export only the authoritative current owner under one bounded journal lease.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir,mkdtemp,open} from 'node:fs/promises';
import {resolve,dirname,join,basename} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {checkpointUnits,checkpointAgents,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
const[archiveName,buildName,directoryName]=process.argv.slice(2);assert.equal(process.argv.length,5);
const directory=resolve(directoryName);assert.equal(dirname(directory),join(workspace,'output'));
assert.match(basename(directory),/^native-selected-halo-owner-preparation-\d{3}$/);
await assert.rejects(lstat(directory),e=>e.code==='ENOENT');
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
const archive=await json(archiveName),build=await json(buildName);
assert.equal(archive.generation,245);assert.equal(archive.stoppedOriginalHaloHandoffPublished,true);
assert.equal(archive.nativeSourceRetirementQualified,true);
for(const r of archive.sources.concat(archive.evidence))assert.equal(await hash(r.preserved),r.sha256);
const publicationRow=archive.evidence.find(r=>r.original.endsWith('/output/native-halo-route-publication-002-observed.json'));assert.ok(publicationRow);
const publication=await json(publicationRow.preserved);assert.equal(publication.selectedRevision,1);
assert.equal(publication.selectedOwner.region,'0_-1');
assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);
const compiled={};for(const g of ['nativeSourceSha256','nativeHeapRuntimeSourceSha256','nativeOrderRuntimeSourceSha256','nativeCheckpointRuntimeSourceSha256'])
  for(const[n,h]of Object.entries(build[g])){assert.equal(compiled[n],undefined);compiled[n]=h;assert.equal(await hash(n),h);}
assert.equal(Object.keys(compiled).length,54);
assert.equal(await hash('upstream/majesty-recomp/build/recomp/pop_smoke'),build.nativeExecutableSha256);
const journal=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
const rows=archive.evidence.filter(r=>dirname(r.original)===publication.directory);assert.equal(rows.length,7);
for(const r of rows){const f=await open(join(journal,basename(r.original)),'wx');let at=0;
  try{await hashNativeFile(r.preserved,{maximum:4*1024*1024,sink:async bytes=>{
    for(let i=0;i<bytes.length;){const{bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }});await f.sync();}finally{await f.close();}
}
await mkdir(directory);const stats={},io=await stoppedHeroRouteStorage(journal,stats),store=new HeroRouteStore(io,publication.identity,publication.identity.contentDigest);
const opened=[],originalOpen=io.open;io.open=async name=>{opened.push(name);return originalOpen(name);};
const worldName=join(directory,'Selected_Owner.GMP');let selected;
await store.withOwner(async value=>{
  assert.equal(value.record.manifest,publication.selectedManifest);assert.deepEqual(value.owner,publication.selectedOwner);
  assert.equal(await checkpointSavedClock(value.source),1000);
  const units=new Map(),agents=new Map();for await(const u of checkpointUnits(value.source))if([510,511,512,513].includes(u.primary.words[1]))units.set(u.primary.words[1],u);
  for await(const a of checkpointAgents(value.source))if([53,54,55].includes(a.agentId))agents.set(a.agentId,a);
  assert.equal(units.has(512),false);assert.equal(units.size,3);assert.equal(agents.size,3);
  assert.equal(units.get(513).primary.words[6],510);assert.equal(agents.get(54).unitId,510);assert.equal(agents.get(55).unitId,511);
  let root;for await(const v of checkpointAgentValues(value.source,55))if(v.attribute.toLowerCase()==='heroes'){
    assert.equal(v.path.length,0);assert.equal(v.type,4);assert.equal(v.childCount,0);root=v;
  }assert.ok(root);
  const file=await open(worldName,'wx');let at=0;
  try{assert.equal(await hashCheckpointSource(value.source,async bytes=>{
    for(let i=0;i<bytes.length;){const{bytesWritten}=await file.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }),value.entry.world.sha256);await file.sync();}finally{await file.close();}
  selected={record:value.record,owner:value.owner,entry:value.entry};
});
assert.deepEqual(opened.filter(n=>n.endsWith('.GMP')),['Frontier_Hero_Route_0_-1_0.GMP']);
const bindingName=join(directory,'Halo_Live_Reload.ids'),binding=Buffer.alloc(44);
[0x31524248,1000,510,511,512,513,53,54,55,4,0].forEach((v,i)=>binding.writeUInt32LE(v,i*4));
await writeFile(bindingName,binding,{flag:'wx'});
const sourceSha256={};for(const name of ['scripts/prepare-native-selected-halo-owner.mjs','web/world/hero-route-store.mjs','web/world/entity-ownership.mjs',
  'web/world/entity-home-ownership.mjs','web/world/checkpoint.mjs','web/world/saved-clock.mjs','web/world/transfer-store.mjs',
  'scripts/lib/stopped-hero-route-io.mjs','scripts/lib/stopped-entity-io.mjs'])sourceSha256[name]=await hash(name);
const report={version:1,selectedOriginalHaloOwnerPrepared:true,archive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
  publication:{filename:publicationRow.preserved,sha256:publicationRow.sha256},build:{filename:resolve(buildName),sha256:await hash(buildName)},
  compiledSourceSha256:compiled,journal,identity:publication.identity,selected,
  world:{filename:worldName,preserved:worldName,bytes:(await lstat(worldName)).size,sha256:await hash(worldName)},
  reloadIds:{filename:bindingName,bytes:44,sha256:await hash(bindingName)},sourceClock:1000,expectedEndClock:1500,
  retiredUnitIds:[512],rewardAssociationPresent:false,dormantWorldsOpened:0,stats,sourceSha256,
  nativeReaderReady:true,nativeProcessesStarted:0,browserUsed:false,nativeReloadQualified:false,goalComplete:false};
await writeFile(join(directory,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({selectedOriginalHaloOwnerPrepared:true,sourceClock:1000,dormantWorldsOpened:0,expiredEffectIncluded:false}));
