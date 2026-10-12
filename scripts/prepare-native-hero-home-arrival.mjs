#!/usr/bin/env node
// Prepare a return capsule from the actual selected second capture and dormant
// home, authenticated against the immutable native generation. No game launch.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {resolve,dirname,basename,join,relative} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {workspace} from './lib/stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './lib/stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {prepareSelectedHeroHomeArrival} from './lib/prepare-selected-hero-home-arrival.mjs';

const [proofName,outName]=process.argv.slice(2);assert.equal(process.argv.length,4);
const hash=async name=>(await hashNativeFile(name)).sha256;
async function json(name){assert.ok((await lstat(name)).size<256*1024);return JSON.parse(await readFile(name,'utf8'));}
async function bound(row){assert.equal((await lstat(row.filename)).size,row.bytes);assert.equal(await hash(row.filename),row.sha256);}
const out=resolve(outName);assert.equal(dirname(out),join(workspace,'output'));
assert.match(basename(out),/^native-hero-home-arrival-preparation-\d{3}$/);await assert.rejects(lstat(out),e=>e.code==='ENOENT');
const proof=await json(proofName);assert.equal(proof.nativeConnectedHeroHomePagingQualified,true);
assert.equal(await hash(proof.manifest.filename),proof.manifest.sha256);
const m=await json(proof.manifest.filename);
for(const pid of [m.nativePid,m.publicationWorkerPid]){try{process.kill(pid,0);assert.fail('Owned producer is live');}catch(e){if(e.code!=='ESRCH')throw e;}}
assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);
const archiveName=join(workspace,'output/hero-home-paging-generation-320/manifest.json');
const archive=await json(archiveName);assert.equal(archive.nativeConnectedHeroHomePagingQualified,true);
assert.deepEqual(archive.compiledInputs,m.compiledSourceSha256);
for(const [name,digest]of Object.entries(proof.sourceSha256)){
 const row=archive.sources.find(v=>relative(workspace,v.original)===name);assert.ok(row);assert.equal(row.sha256,digest);
 assert.equal(await hash(row.preserved),digest);
 // Historical native sources may advance; production planner inputs must
 // still match the qualified checkpoint format used by this preparation.
 if(name.startsWith('web/world/'))assert.equal(await hash(name),digest);
}
await bound(m.publication);await bound(m.secondPublication);
const first=await json(m.publication.filename),second=await json(m.secondPublication.filename);
const stats={},storage=await stoppedHeroRouteStorage(second.journal,stats),store=new HeroRouteStore(storage,first.identity,first.identity.contentDigest);
let prepared,entries,escaped;
await store.withDestination(first.identity.registeredHome.home.region,null,async v=>{
 assert.equal(v.record.manifest,second.ownerManifest);assert.equal(v.entries[0].world.sha256,second.captured.sha256);
 assert.equal(v.entries[1].world.sha256,proof.stagedHome.sha256);
 prepared=await prepareSelectedHeroHomeArrival(first.identity,v,second.crossing);entries=v.entries;escaped=v.sources[1];
});await assert.rejects(escaped.readAt(0,16),/lease ended/);
assert.equal(stats.writes??0,0);assert.equal(stats.activeReads,0);assert.equal(stats.peakReads,1);assert.ok(stats.largestRead<=4096);
for(const [n,digest]of Object.entries(second.journalSha256))assert.equal(await hash(join(second.journal,n)),digest);
const sourceSha256={},pending=[resolve('scripts/prepare-native-hero-home-arrival.mjs')];
while(pending.length){const filename=pending.pop(),name=relative(workspace,filename);if(sourceSha256[name])continue;
 assert.ok(!name.startsWith('..')&&!name.startsWith('/')&&Object.keys(sourceSha256).length<128);
 const text=await readFile(filename,'utf8');assert.ok(text.length<256*1024);sourceSha256[name]=await hash(filename);
 for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))if(match[1].startsWith('.'))pending.push(resolve(dirname(filename),match[1]));}
await mkdir(out);const filename=join(out,'Frontier_Hero_Arrival.pack');await writeFile(filename,prepared.pack,{flag:'wx'});
const {pack,...plan}=prepared;
const report={version:1,nativeHeroHomeArrivalPrepared:true,proof:{filename:resolve(proofName),sha256:await hash(proofName)},
 archive:{filename:archiveName,sha256:await hash(archiveName)},manifest:proof.manifest,sourceSha256,
 selectedManifest:second.ownerManifest,entries,...plan,pack:{filename,...await hashNativeFile(filename)},stats,
 destinationReaderRevoked:true,journalUnchanged:true,heroImported:false,homeActivated:false,
 ownerTransferred:false,nativeProcessesStarted:0,browserUsed:false,goalComplete:false};
await writeFile(join(out,'preparation.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHeroHomeArrivalPrepared:true,records:plan.packDescriptors,sourceClock:plan.options.sourceClockMs,
 destinationClock:plan.options.destinationClockMs,packBytes:pack.length,home:plan.plan.registeredHome,heroImported:false}));
