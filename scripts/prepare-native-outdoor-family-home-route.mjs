#!/usr/bin/env node
// Extend the actual family capsule with its canonical registered home binding.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointAgents} from '../web/world/checkpoint.mjs';
import {verifyRemoteHomeAgent} from '../web/world/remote-home.mjs';
import {encodeHomeRecord} from '../web/world/hero-home.mjs';
import {Sha256} from '../web/world/sha256.mjs';
const [input,directory]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async n=>(await hashNativeFile(n)).sha256;
const prep=JSON.parse(await readFile(input,'utf8'));
assert.equal(prep.outdoorFamilyPreparationQualified,true);
for(const[n,h]of Object.entries(prep.sourceSha256))assert.equal(await hash(n),h);
assert.equal(await hash(prep.pairPublication),prep.pairPublicationSha256);
assert.equal(await hash(prep.destination.filename),prep.destination.sha256);
const pair=JSON.parse(await readFile(prep.pairPublication,'utf8')),registeredRecord=pair.identity.registeredHome;
const registered={record:registeredRecord,sha256:new Sha256().update(encodeHomeRecord(registeredRecord)).hex()};
const source=await stoppedFileSource(prep.destination.filename);let proxy;
for await(const a of checkpointAgents(source))if(a.agentId===45)proxy=a;
assert(proxy);assert.equal(proxy.unitId,0);assert(proxy.size<=1024);
const bytes=Buffer.from(await source.readAt(proxy.offset,proxy.size));
const checked=await verifyRemoteHomeAgent({size:bytes.length,async readAt(at,n){return Uint8Array.from(bytes.subarray(at,at+n));}},registered,45);
const out=resolve(directory);await mkdir(out);const records=[];
async function emit(name,b,kind){const filename=join(out,name);await writeFile(filename,b,{flag:'wx'});const row=await hashNativeFile(filename);records.push({filename,bytes:row.bytes,sha256:row.sha256,kind});}
for(const r of prep.records){assert.equal(await hash(r.filename),r.sha256);await emit(basename(r.filename),await readFile(r.filename),r.kind);}
await emit('Family_Route_Proxy_Proposal.GPL',bytes,'registered-home-proxy');
const binding=Buffer.alloc(320);[0x31485246,1,469,7,45,0x31564241,0,0].forEach((v,i)=>binding.writeUInt32LE(v,i*4));
const texts=[pair.identity.entityId,registeredRecord.guildEntityId,registeredRecord.worldId,registeredRecord.contentDigest];
texts.forEach((s,i)=>{assert.match(s,/^[0-9a-f]{64}$/);binding.write(s,32+i*64,64,'ascii');});
binding.write('1_0',288);binding.write('0_0',304);
await emit('Family_Route_Binding.bin',binding,'registered-home-route-binding');
const result={...prep,homeRoutePreparationQualified:true,records,registeredHome:registered,registeredProxy:checked,
  basePreparation:resolve(input),basePreparationSha256:await hash(input),
  sourceSha256:{...prep.sourceSha256,...Object.fromEntries(await Promise.all(['scripts/prepare-native-outdoor-family-home-route.mjs',
    'web/world/remote-home.mjs','web/world/hero-home.mjs'].map(async n=>[n,await hash(n)])))},
  ordinaryAiHomeHoldQualified:false,completeRoutingQualified:false};
await writeFile(join(out,'prepared.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({homeRoutePreparationQualified:true,registeredProxyAgentId:45,proxyBytes:bytes.length,records:records.length}));
