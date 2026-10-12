#!/usr/bin/env node
// Read only the selected ARB2 effect's original, unmodified command payloads.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {basename,join} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
const[receiptName,outputName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async f=>(await hashNativeFile(f)).sha256;
const json=async f=>{assert.ok((await lstat(f)).size<256*1024);return JSON.parse(await readFile(f,'utf8'));};
await assert.rejects(lstat(outputName),e=>e.code==='ENOENT');
const receipt=await json(receiptName);assert.equal(receipt.selectedHaloReturnCapsulePrepared,true);
for(const[name,h]of Object.entries(receipt.sourceSha256))assert.equal(await hash(name),h);
const stats={},io=await stoppedHeroRouteStorage(receipt.journal,stats);
io.atomicWrite=async()=>{throw Error('Literal capture may not write selected state');};
const store=new HeroRouteStore(io,receipt.identity,receipt.identity.contentDigest),cases=[],reports=[];
await store.withOwner(async s=>{
 assert.equal(s.record.manifest,receipt.selected.record.manifest);assert.equal(s.owner.unitId,510);assert.equal(s.owner.agentId,54);
 assert.equal(await checkpointSavedClock(s.source),1500);
 const name=`Frontier_Hero_Route_${s.entry.region}_${s.entry.slot}.GMP`;
 assert.equal(await hash(join(receipt.journal,name)),s.entry.world.sha256);
 for await(const e of checkpointActorOrderEntries(s.source,516))if(e.type==='entry'){
  assert.equal(e.bank,1);assert.equal(e.kind,e.index===0?13:5);assert.ok(e.size<=200);
  const bytes=await s.source.readAt(e.offset,e.size),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  assert.deepEqual(Array.from({length:e.words.length},(_,i)=>view.getUint32(i*4,true)),e.words);
  for(const poison of [0x5a,0xc3])cases.push({kind:e.kind,count:0,poison,words:e.words,normalizations:[],
   filename:name,snapshotSha256:s.entry.world.sha256,unitId:516,bank:1,index:e.index,sourceOffset:e.offset,
   payloadBytes:e.size,payloadSha256:await literalDigest(bytes)});
 }
 assert.equal(cases.length,4);
 reports.push({filename:name,sha256:s.entry.world.sha256,fileBytes:s.entry.world.size,entries:4,
  previousFixtureHashMatched:true,fileIdentityUnchanged:true});
});
const names=['web/world/checkpoint.mjs','web/world/order-entries.mjs','web/world/order-read-bounds.mjs','scripts/prepare-native-order-reader-cases.mjs'];
const sourceSha256=Object.fromEntries(await Promise.all(names.map(async n=>[n,await hash(n)])));
await writeFile(outputName,JSON.stringify({qualified:true,literalPayloadsMatched:true,scope:'Unnormalized ARB2 companion commands from selected1500 original save; two stack-poison cases per command',
 sourceSha256,captureScriptSha256:await hash('scripts/capture-native-selected-halo-orders.mjs'),
 returnPreparation:{filename:receiptName,sha256:await hash(receiptName)},cases,reports,stats,gameLaunched:false,browserUsed:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({literalPayloadsMatched:true,cases:4,commands:2,unitId:516,largestRead:stats.largestRead}));
async function literalDigest(bytes){const {createHash}=await import('node:crypto');return createHash('sha256').update(bytes).digest('hex');}
