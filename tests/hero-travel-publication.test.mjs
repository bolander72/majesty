import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeHeroArrivalReady,parseNativeHeroArrivalReady,nativeHeroArrivalPublished} from '../web/world/hero-travel-publication.mjs';
import {Sha256} from '../web/world/sha256.mjs';

const held={serial:1,region:'1_0',clock:4050,unitId:538,agentId:39,homeAgentId:38,size:332355,sha256:'a'.repeat(64)};
const manifest=JSON.stringify({version:1,identitySha256:'b'.repeat(64),revision:2,nodeSha256:'c'.repeat(64)})+'\n';
const hash=text=>new Sha256().update(new TextEncoder().encode(text)).hex();

test('arrival receipt preserves the exact newly reserved IDs, saved clock and world',()=>{
 const packet=nativeHeroArrivalReady(held);
 assert.equal(packet,`majesty-hero-travel-ready-v1|1|1_0|4050|538|39|38|332355|${held.sha256}`);
 assert.deepEqual(parseNativeHeroArrivalReady(packet),held);assert.ok(Object.isFrozen(parseNativeHeroArrivalReady(packet)));
});
test('a publication acknowledgement binds every held field and the selected head bytes',()=>{
 const ready=nativeHeroArrivalReady(held),ack=nativeHeroArrivalPublished(ready,manifest);
 assert.equal(ack,`majesty-hero-travel-published-v1|1|1_0|4050|538|39|38|332355|${held.sha256}|${hash(manifest)}\n`);
 for(const change of [{serial:2},{region:'2_0'},{clock:4100},{unitId:539},{agentId:40},{homeAgentId:41},{size:332356},{sha256:'d'.repeat(64)}])
  assert.notEqual(nativeHeroArrivalPublished(nativeHeroArrivalReady({...held,...change}),manifest),ack);
 assert.notEqual(nativeHeroArrivalPublished(ready,manifest.replace('"revision":2','"revision":3')),ack);
});
test('native receipts reject ambiguous numbers, noncanonical regions and trailing fields',()=>{
 const packet=nativeHeroArrivalReady(held);
 for(const bad of [packet+'\n',packet+'|extra',packet.replace('|1|','|01|'),packet.replace('|4050|','|4.05e3|'),
  packet.replace('|1_0|','|01_0|'),packet.replace('|1_0|','|1_0/../0_0|'),packet.replace(held.sha256,'A'.repeat(64)),
  packet.replace('|39|38|','|39|39|'),packet.replace('|538|','|0|'),packet.replace('|4050|','|-1|'),'x'.repeat(257)])
  assert.throws(()=>parseNativeHeroArrivalReady(bad));
});
test('published receipts require the canonical journal head, including its newline',()=>{
 const ready=nativeHeroArrivalReady(held);
 for(const bad of ['not a head','{}',manifest.trim(),manifest+'\n',manifest.replace('"revision":2','"revision":-1'),
  manifest.replace('"version":1','"version":2'),manifest.replace('"revision":2','"extra":0,"revision":2')])
  assert.throws(()=>nativeHeroArrivalPublished(ready,bad),/Invalid published hero owner manifest/);
});
test('ready fields reject invalid aliases, oversized worlds and unknown data',()=>{
 for(const change of [{serial:0},{serial:0x100000000},{agentId:0x80000000},{homeAgentId:0},{size:15},
  {size:Number.MAX_SAFE_INTEGER},{region:'1000001_0'},{extra:true}])assert.throws(()=>nativeHeroArrivalReady({...held,...change}));
});
