#!/usr/bin/env node
// Read-only qualification against the selected original-engine round trip.
// The stopped adapter is serial; this does not qualify browser writer locks.
import assert from 'node:assert/strict';
import {readFile,lstat,writeFile} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {prepareRouteRegisteredHeroArrival} from '../web/world/registered-hero-arrival.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';

const [publicationName,attemptName,outputName]=process.argv.slice(2);
assert.equal(process.argv.length,5);
const output=resolve(outputName);assert.equal(dirname(output),join(workspace,'output'));
assert.match(basename(output),/^hero-route-read-cancellation-native-\d{3}\.json$/);
await assert.rejects(lstat(output),error=>error.code==='ENOENT');
async function json(name){assert.ok((await lstat(name)).size<256*1024);return JSON.parse(await readFile(name,'utf8'));}
const hash=async name=>(await hashNativeFile(name)).sha256;
const proof=await json(publicationName),attempt=await json(attemptName);
assert.equal(proof.journalOriginalSavedRoundtripPublished,true);assert.equal(proof.selectedRevision,8);
assert.equal(attempt.nativeSessionTerminal,true);assert.equal(attempt.nativeExitCode,0);
assert.equal(attempt.stopReason,null);assert.equal(attempt.ownedProducerAbsent,true);
try{process.kill(attempt.nativePid,0);assert.fail('Native fixture producer is live');}catch(error){if(error.code!=='ESRCH')throw error;}
assert.equal(await hash(attempt.preparation),attempt.preparationSha256);
const preparation=await json(attempt.preparation);
assert.equal(resolve(preparation.journal),resolve(proof.journal));
assert.equal(preparation.ownerManifest,proof.selectedManifest);
async function unchanged(){
  for(const [name,digest]of Object.entries(proof.journalSha256))
    assert.equal(await hash(join(proof.journal,name)),digest,name);
}
await unchanged();
const stats={},io=await stoppedHeroRouteStorage(proof.journal,stats),originalOpen=io.open;
let reads=0,opens=0,cancelAt=null;
io.atomicWrite=async()=>assert.fail('Read qualification attempted a write');
io.open=async name=>{
  ++opens;const file=await originalOpen(name);if(!file)return null;
  return {size:file.size,async readAt(at,n){
    ++reads;const bytes=await file.readAt(at,n);cancelAt?.(name);return bytes;
  }};
};
const store=new HeroRouteStore(io,proof.identity,proof.identity.contentDigest);
const selected=await store.read();assert.equal(selected.record.manifest,proof.selectedManifest);
assert.deepEqual(selected.owner,proof.selectedOwner);
const clock=await store.withOwner(({source})=>checkpointSavedClock(source));assert.equal(clock,113500);
const cases=[];
async function cancelRead(label,call,predicate){
  const controller=new AbortController(),reason=new Error(label),initial={opens,reads};let at=null;
  cancelAt=name=>{if(predicate(name)&&!at){at={opens,reads,name};controller.abort(reason);}};
  await assert.rejects(call({signal:controller.signal}),error=>error===reason);
  cancelAt=null;assert.ok(at);assert.equal(opens,at.opens);assert.equal(reads,at.reads);
  cases.push({label,cancelledAt:at.name,opens:opens-initial.opens,reads:reads-initial.reads,
    additionalOpens:0,additionalReads:0});
}
await cancelRead('cancel original owner hashing',options=>store.read(options),name=>name.endsWith('.GMP'));
await cancelRead('cancel saved east arrival admission',options=>prepareRouteRegisteredHeroArrival(store,'1_0',null,
  {expectedManifest:proof.selectedManifest,freshUnitId:600,freshAgentId:80},options),
  name=>name.startsWith('Frontier_Hero_Route_1_0_')&&name.endsWith('.GMP'));
const controller=new AbortController(),reason=new Error('cancel idle owner');let escaped,at;
await assert.rejects(store.withOwner(async selected=>{
  escaped=selected.source;at={opens,reads};controller.abort(reason);
  await assert.rejects(escaped.readAt(0,4),error=>error===reason);return 'obsolete owner';
},{signal:controller.signal}),error=>error===reason);
assert.equal(opens,at.opens);assert.equal(reads,at.reads);
await assert.rejects(escaped.readAt(0,4),/lease ended/);
cases.push({label:'cancel idle original owner',additionalOpens:0,additionalReads:0,readerRevoked:true});
assert.deepEqual(await store.read(),selected);await unchanged();
assert.ok(stats.largestRead<=4096);assert.equal(stats.peakReads,1);assert.equal(stats.activeReads,0);
const sources=['scripts/inspect-hero-route-read-cancellation.mjs','scripts/lib/stopped-hero-route-io.mjs',
  'web/world/checkpoint-lease.mjs','web/world/hero-route-store.mjs','web/world/registered-hero-arrival.mjs',
  'web/world/halo-home-leg.mjs','web/world/realm-session.mjs'];
const sourceSha256={};for(const name of sources)sourceSha256[name]=await hash(name);
await writeFile(output,JSON.stringify({version:1,originalCheckpointReadCancellationQualified:true,
  publication:{filename:resolve(publicationName),sha256:await hash(publicationName)},
  terminalNativeAttempt:{filename:resolve(attemptName),sha256:await hash(attemptName),producerAbsent:true},
  selectedRevision:8,selectedOwner:selected.owner,selectedClock:clock,journalUnchanged:true,
  cases,stats,sourceSha256,writes:0,nativeProcessesStarted:0,browserUsed:false,
  liveBrowserIntegrationQualified:false,cooperativeRegionalOwnershipQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({report:output,cases:cases.length,revision:8,writes:0,largestRead:stats.largestRead}));
