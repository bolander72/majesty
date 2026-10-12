#!/usr/bin/env node
// Corrupt only owned copies of actual native snapshots; never a player save.
import {readFile,writeFile,open,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifyWorldPersistence,persistenceState,assertSameRegion,parsePersistenceLog,nativeResourceSampling} from './check-native-world-persistence.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointChunks,checkpointAgentQueues,checkpointAttachments} from '../web/world/checkpoint.mjs';
const [manifest,out]=process.argv.slice(2);
if(!manifest||!out||process.argv.length!==4)throw Error('Usage: <terminal persistence manifest> <fresh controls report>');
const proof=await verifyWorldPersistence(manifest),m=proof.fixture;
const count=m.loadSequence.length,last=count-1;
const beforeName=join(m.profile,`Residency_Visit_${last}_Before.GMP`),afterName=join(m.profile,`Residency_Visit_${last-2}_After.GMP`);
const expected=await persistenceState(afterName),actual=await persistenceState(beforeName);
const states=[];for(let i=0;i<count;++i)states.push({before:await persistenceState(join(m.profile,`Residency_Visit_${i}_Before.GMP`)),after:await persistenceState(join(m.profile,`Residency_Visit_${i}_After.GMP`))});
const log=await readFile(m.log,'utf8'),checks=[];
const positive=()=>{assertSameRegion(expected,actual);parsePersistenceLog(log,states);if(count!==3)nativeResourceSampling(m);};
async function refuses(name,fn){positive();await assert.rejects(fn);checks.push({name,unchangedActualPositivePassed:true,refused:true});}
await refuses('stale initial region on revisit',async()=>assertSameRegion(expected,await persistenceState(join(m.profile,`Residency_Initial_${m.loadSequence[last]}.GMP`))));
const source=await stoppedFileSource(beforeName),roots=[];for await(const c of checkpointChunks(source))roots.push(c);
const svg=roots.find(c=>c.tag==='SVGD'),gpl=roots.find(c=>c.tag==='GPL '),nm=roots.find(c=>c.tag==='NMGM'),terrain=roots.find(c=>c.tag==='MTER');
const metadata=Buffer.from(await source.readAt(svg.offset+16,svg.size)),first=metadata.indexOf(0),second=metadata.indexOf(0,first+1);
let selector;for await(const q of checkpointAgentQueues(source))if(q.type==='queue-selector')selector=q;
let order;for await(const a of checkpointAttachments(source))if(a.kind==='ORDR'&&!order)order=a;
assert.ok(selector&&gpl&&nm&&terrain);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-world-persistence-controls-'));
async function corrupt(name,offset,{truncate=false,allowed=false,value}={}) {
  const filename=join(directory,name+'.GMP'),f=await open(filename,'wx');
  try {
    for(let at=0;at<source.size;at+=4096){const b=await source.readAt(at,Math.min(4096,source.size-at));const r=await f.write(b,0,b.length,at);assert.equal(r.bytesWritten,b.length);}
    if(truncate)await f.truncate(source.size-1);
    else {const b=await source.readAt(offset,1),byte=Buffer.from([value??(b[0]^1)]);assert.notEqual(byte[0],b[0]);assert.equal((await f.write(byte,0,1,offset)).bytesWritten,1);}
    await f.sync();
  } finally {await f.close();}
  if(allowed){positive();assertSameRegion(expected,await persistenceState(filename));checks.push({name,unchangedActualPositivePassed:true,allowed:true});}
  else await refuses(name,async()=>assertSameRegion(expected,await persistenceState(filename)));
}
await corrupt('wrong scripting RNG',gpl.offset+24);
await corrupt('wrong gameplay RNG',svg.offset+16+second+29);
await corrupt('wrong game clock',svg.offset+16+second+1);
await corrupt('wrong active queue',selector.offset);
await corrupt('changed object manager',nm.offset+16);
await corrupt('changed dormant terrain',terrain.offset+16);
await corrupt('changed command-container record',order.primary.offset+16);
await corrupt('valid calendar month allowed',svg.offset+16+second+7,{allowed:true,value:metadata.readUInt16LE(second+7)%12+1});
// A calendar change is allowed only when valid: explicitly make month zero.
const invalidCalendar=join(directory,'calendar-zero.GMP'),f=await open(invalidCalendar,'wx');
try {for(let at=0;at<source.size;at+=4096){const b=await source.readAt(at,Math.min(4096,source.size-at));assert.equal((await f.write(b,0,b.length,at)).bytesWritten,b.length);}await f.write(Buffer.from([0,0]),0,2,svg.offset+16+second+7);await f.sync();}finally{await f.close();}
await refuses('calendar month zero',async()=>persistenceState(invalidCalendar));
await corrupt('truncated complete world',0,{truncate:true});
for(const [name,from,to] of [
  ['save did not finish','saved=1 state-clock-same=1','saved=0 state-clock-same=1'],
  ['latest state not published','latest-published=1','latest-published=0'],
  ['scripting RNG not restored','original-setter=00623720','original-setter=004f6710'],
  ['gameplay RNG not restored','original-setter=004f6710','original-setter=00623720'],
  ['world root not freed once','roots-freed=1,1,1,1,1,1','roots-freed=1,1,1,1,1,0'],
  ['missing final cycle request',`request=${last} observed-ticks=20`,`request=${last} observed-ticks=19`],
]){const bad=log.replace(from,to);assert.notEqual(bad,log);await refuses(name,async()=>parsePersistenceLog(bad,states));}
if(count!==3) {
  assert.ok(proof.originalAttachmentContainerSerializationPermutations.length>0,'Need actual observed serialization permutation for the positive control');
  for(const p of proof.originalAttachmentContainerSerializationPermutations) {
    positive();const prior=p.visit<2?await persistenceState(join(m.profile,`Residency_Initial_${p.region}.GMP`)):states[p.visit-2].after;
    assert.equal(assertSameRegion(prior,states[p.visit].before).length,1);checks.push({name:'actual original ID-keyed order-container permutation',visit:p.visit,unchangedActualPositivePassed:true,allowed:true});
  }
  for(const [name,change] of [
    ['resource safety stop',v=>{v.resourceSamplingStopReason='native-rss-ceiling';}],
    ['resource sampling error',v=>{v.resourceSamplingErrors=['Injected'];}],
    ['wrong sampled native PID',v=>{v.nativeResourceSamples[0].pid++;}],
    ['missing middle resource samples',v=>{v.nativeResourceSamples.splice(1,10);}],
    ['stale final resource sample',v=>{v.nativeResourceSamples.splice(-3);}],
    ['resource sample after process exit',v=>{v.nativeResourceSamples.at(-1).sampledAtMs=v.finishedAtMs+1;}],
    ['sampled RSS exceeds safety limit',v=>{v.nativeResourceSamples[0].rssBytes=v.nativeRssCeilingBytes+1;}],
    ['invalid sampled CPU',v=>{v.nativeResourceSamples[0].cpuPercent=-1;}],
  ]){const bad=structuredClone(m);change(bad);await refuses(name,async()=>nativeResourceSampling(bad));}
}
const controlsSourceSha256=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
await writeFile(out,JSON.stringify({qualified:true,sourceManifest:resolve(manifest),sourceManifestSha256:proof.sourceManifestSha256,checks,actualPositiveRecheckedBeforeEachCase:true,directory,largestRead:4096,largestWrite:4096,browserUsed:false,nativeProcessesStarted:0,controlsSourceSha256,sourceSha256:proof.sourceSha256,evidenceSha256:proof.evidenceSha256},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,refused:checks.filter(c=>c.refused).length,allowed:checks.filter(c=>c.allowed).length,nativeProcessesStarted:0}));
