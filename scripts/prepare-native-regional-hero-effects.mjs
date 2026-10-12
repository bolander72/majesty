#!/usr/bin/env node
// Bind the dormant guild gate to the checked capsule's immutable identity.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const [input,output]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async p=>(await hashNativeFile(p)).sha256;
const p=JSON.parse(await readFile(input,'utf8'));
assert.equal(p.regionalHeroRuntimeInputsPrepared,true);
for(const[n,h]of Object.entries(p.sourceSha256))assert.equal(await hash(n),h);
assert.equal(await hash(p.capsulePreparation),p.capsulePreparationSha256);
const capsule=JSON.parse(await readFile(p.capsulePreparation,'utf8')),identity=capsule.identity,home=identity.registeredHome;
assert.equal(identity.version,2);assert.equal(home.home.region,'0_0');assert.equal(home.home.unitId,469);assert.equal(home.home.agentId,7);
assert.ok(p.region.length<16&&p.region!=='0_0');assert.equal(capsule.registeredHomeAgentId,p.homeAgentId);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-regional-effects-input-'));
const bytes=Buffer.alloc(320);
[0x31485246,2,469,7,p.homeAgentId,0x31564241,0,0].forEach((v,i)=>bytes.writeUInt32LE(v,i*4));
for(const [i,s]of [identity.entityId,home.guildEntityId,home.worldId,identity.contentDigest].entries()){
  assert.match(s,/^[a-f0-9]{64}$/);bytes.write(s,32+i*64,'ascii');
}
bytes.write(p.region,288,'ascii');bytes.write('0_0',304,'ascii');
const filename=join(directory,'Regional_Home_Binding.bin');await writeFile(filename,bytes,{flag:'wx'});
const record={filename,bytes:320,sha256:await hash(filename)};
await writeFile(output,JSON.stringify({...p,regionalEffectsInputsPrepared:true,directory,
  records:[...p.records,record],basePreparation:resolve(input),basePreparationSha256:await hash(input),
  sourceSha256:{...p.sourceSha256,'scripts/prepare-native-regional-hero-effects.mjs':await hash(new URL(import.meta.url).pathname)},
  scope:'Ordinary effect dispatch with both hero ingress paths held before native guild use. No spatial finalization or world owner handoff.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({regionalEffectsInputsPrepared:true,region:p.region,homeAgentId:p.homeAgentId,records:p.records.length+1}));
