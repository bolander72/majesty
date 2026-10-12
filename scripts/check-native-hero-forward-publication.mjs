#!/usr/bin/env node
// Regression: replay the actual first outbound capture from its preserved
// journal history using the return-aware production publication adapter.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdtemp,open,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {HeroRouteStore,HERO_ROUTE_HEAD} from '../web/world/hero-route-store.mjs';
import {publishHeldNativeHeroArrival} from '../web/world/hero-travel-publication.mjs';
import {Sha256} from '../web/world/sha256.mjs';

const [archiveName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-hero-forward-publication-\d{3}-observed\.json$/);await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async n=>(await hashNativeFile(n)).sha256,json=async n=>{assert.ok((await lstat(n)).size<256*1024);return JSON.parse(await readFile(n,'utf8'));};
const archive=await json(archiveName);assert.equal(archive.nativeConnectedHeroHomeActivationQualified,true);
for(const row of [...archive.sources,...archive.evidence]){assert.equal((await lstat(row.preserved)).size,row.bytes);assert.equal(await hash(row.preserved),row.sha256);}
function evidence(n,digest){const row=archive.evidence.find(v=>v.original===resolve(n));assert.ok(row);assert.equal(row.sha256,digest);return row.preserved;}
const m=await json(evidence(archive.qualification.manifest.filename,archive.qualification.manifest.sha256));
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}}
const first=await json(evidence(m.publication.filename,m.publication.sha256)),second=await json(evidence(m.secondPublication.filename,m.secondPublication.sha256));
assert.equal(JSON.parse(first.capturedManifest).revision,1);
const seed=second.beforeJournal,names=Object.keys(second.beforeJournalSha256).sort();assert.deepEqual((await readdir(seed)).sort(),names);
const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-hero-route-'));
for(const n of names){assert.equal(await hash(join(seed,n)),second.beforeJournalSha256[n]);const f=await open(join(directory,n),'wx');let at=0;
 try{const copy=await hashNativeFile(join(seed,n),{sink:async bytes=>{for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}}});
  assert.equal(copy.sha256,second.beforeJournalSha256[n]);await f.sync();}finally{await f.close();}}
// Only the disposable clone is selected at its actual earlier captured head.
// Original source journal and preserved revision2 history remain untouched.
await writeFile(join(directory,HERO_ROUTE_HEAD),first.capturedManifest);
const stats={},io=await stoppedHeroRouteStorage(directory,stats),store=new HeroRouteStore(io,first.identity,first.identity.contentDigest);
await store.withOwner(async v=>{assert.equal(v.record.manifest,first.capturedManifest);assert.equal(v.owner.region,'0_0');assert.equal(v.entry.world.sha256,first.captured.sha256);});
async function world(row){assert.equal((await lstat(row.filename)).size,row.bytes);assert.equal(await hash(row.filename),row.sha256);
 assert.ok([...archive.snapshots,...archive.journalReferences].some(v=>v.filename===row.filename&&v.sha256===row.sha256));return {source:await stoppedFileSource(row.filename),sha256:row.sha256};}
// Use the exact activated save in the frozen revision2 journal view. That
// immutable reference also binds the earlier native-ready receipt's digest.
const activeWorld={...first.active,filename:join(seed,'Frontier_Hero_Route_1_0_0.GMP')};
assert.equal(second.beforeJournalSha256['Frontier_Hero_Route_1_0_0.GMP'],activeWorld.sha256);
const operationId=new Sha256().update(new TextEncoder().encode(['forward-publication-regression',first.capturedManifest,first.retired.sha256,first.active.sha256].join('|'))).hex();
const request={ready:first.ready,operationId,expectedManifest:first.capturedManifest,sourceRegion:'0_0',sourceAlias:{unitId:508,agentId:25},
 sourceHome:{kind:'native',unitId:469,agentId:7},sourceClock:103500,capturedSha256:first.captured.sha256,
 retiredSource:await world(first.retired),activeSource:await world(activeWorld)};
const published=await publishHeldNativeHeroArrival(store,request);assert.equal(published.ownerRevision,2);
assert.deepEqual(published.owner,{unitId:538,agentId:39});assert.deepEqual(published.home,{kind:'proxy',unitId:0,agentId:38});
const writes=stats.writes,retry=await publishHeldNativeHeroArrival(store,request);assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
await store.withOwner(async v=>{assert.equal(v.owner.region,'1_0');assert.equal(v.entry.world.sha256,first.active.sha256);assert.deepEqual(v.entry.homeAlias,published.home);});
for(const n of names)assert.equal(await hash(join(seed,n)),second.beforeJournalSha256[n]);
const sources=['scripts/check-native-hero-forward-publication.mjs','web/world/hero-travel-publication.mjs','web/world/hero-route-store.mjs','web/world/entity-home-ownership.mjs'];
const sourceSha256={};for(const n of sources)sourceSha256[n]=await hash(n);
const report={version:1,stoppedForwardNativeHeroPublicationQualified:true,archive:{filename:resolve(archiveName),sha256:await hash(archiveName)},
 sourceSha256,directory,published,exactRetryAdditionalWrites:0,stats,originalJournalUnchanged:true,nativeProcessesStarted:0,
 browserUsed:false,liveNativeReceiptConsumed:false,goalComplete:false};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({stoppedForwardNativeHeroPublicationQualified:true,ownerRevision:2,home:published.home,exactRetryAdditionalWrites:0}));
