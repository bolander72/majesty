// Recompute historical preparation with current readers before a new native run.
// Immutable reports/assets remain read-only; emit only fresh numbered outputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,lstat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative,basename} from 'node:path';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {stoppedFileSource} from '../scripts/lib/stopped-entity-io.mjs';
import {verifyRemoteHomeAgent} from '../web/world/remote-home.mjs';
import {prepareOrReuseRemoteHomeAgent} from '../web/world/remote-home-cache.mjs';
import {prepareSelectedHeroNeighborArrival} from '../web/world/hero-home-arrival-package.mjs';
import {checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';

const archiveName=process.env.MAJESTY_HERO_PREPARATION_REVALIDATION_ARCHIVE;
test('current readers reproduce authenticated native home and hero preparation before a fresh game run',
 {skip:!archiveName,timeout:60000},async()=>{
 const root=resolve('.'),homeDir=resolve(process.env.MAJESTY_HERO_PREPARATION_REVALIDATION_HOME),
  arrivalDir=resolve(process.env.MAJESTY_HERO_PREPARATION_REVALIDATION_ARRIVAL);
 for(const [dir,pattern]of [[homeDir,/^native-hero-home-preparation-\d{3}$/],[arrivalDir,/^native-hero-arrival-preparation-\d{3}$/]]){
  assert.equal(dirname(dir),resolve('output'));assert.match(basename(dir),pattern);await assert.rejects(lstat(dir),e=>e.code==='ENOENT');
 }
 const json=async path=>{assert.ok((await lstat(path)).size<1024*1024);return JSON.parse(await readFile(path,'utf8'));};
 const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
 async function bound(row){const actual=await hashNativeFile(row.filename??row.preserved);if(row.bytes!==undefined)assert.equal(actual.bytes,row.bytes);
  assert.equal(actual.sha256,row.sha256);}
 const archive=await json(archiveName);assert.equal(archive.nativeBrowserHomeInputConsumptionQualified,true);
 async function evidence(name){const row=archive.evidence.find(r=>r.original===resolve(name));assert.ok(row,name);await bound(row);return {row,value:await json(row.preserved)};}
 const home=await evidence('output/native-hero-home-preparation-001/preparation.json'),
  arrival=await evidence('output/native-hero-arrival-preparation-001/preparation.json'),
  native=await evidence('output/native-hero-binding-attempt-046.json');
 assert.equal(native.value.nativeSessionTerminal,true);assert.equal(native.value.nativeExitCode,0);
 for(const pid of [native.value.nativePid,native.value.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
 for(const old of [home.value,arrival.value])for(const [name,sha256]of Object.entries(old.sourceSha256)){
  if((await hashNativeFile(resolve(name))).sha256===sha256)continue;
  const row=archive.sources.find(r=>(r.original??r.source)===resolve(name)&&r.sha256===sha256);assert.ok(row,`Frozen preparation source ${name}`);await bound(row);
 }
 for(const row of [home.value.sourceCheckpoint,home.value.proposal,arrival.value.sourceWorld,arrival.value.destinationWorld,arrival.value.pack]){
  assert.ok(archive.snapshots.some(r=>r.filename===row.filename&&r.sha256===row.sha256));await bound(row);
 }
 const h=home.value,p=arrival.value,destination=await stoppedFileSource(h.sourceCheckpoint.filename);
 assert.equal(await checkpointSavedClock(destination),h.clock);assert.equal(await checkpointNextAgentId(destination),h.proposedAgentId);
 const fresh=await prepareOrReuseRemoteHomeAgent(destination,h.registered,{worldId:h.registered.record.worldId,
  contentDigest:h.registered.record.contentDigest,destinationRegion:h.region,freshAgentId:h.proposedAgentId});
 assert.deepEqual(fresh.plan,h.plan);assert.deepEqual(Buffer.from(fresh.record),await readFile(h.proposal.filename));
 await verifyRemoteHomeAgent({size:fresh.record.length,async readAt(at,n){return fresh.record.slice(at,at+n);}},h.registered,h.proposedAgentId);
 assert.deepEqual(p.identity.registeredHome,h.registered.record);
 const prepared=await prepareSelectedHeroNeighborArrival(p.identity,{regions:p.context.regions,
  entries:p.context.regions.map((region,i)=>({region,alias:p.context.aliases[i],homeAlias:p.context.homeAliases[i]})),
  sources:[await stoppedFileSource(p.sourceWorld.filename),await stoppedFileSource(p.destinationWorld.filename)]},native.value.nativeCrossing);
 assert.deepEqual(Buffer.from(prepared.pack),await readFile(p.pack.filename));
 for(const key of ['options','context','plan','layouts','ground','totalRecordBytes','packDescriptors'])
  assert.deepEqual(JSON.parse(JSON.stringify(prepared[key])),p[key],key);
 const sourceSha256={},pending=[resolve('tests/hero-native-preparation-revalidation.test.mjs')];
 while(pending.length){const path=pending.pop(),name=relative(root,path);if(sourceSha256[name])continue;
  assert.ok(!name.startsWith('..')&&Object.keys(sourceSha256).length<128);
  const text=await readFile(path,'utf8');assert.ok(Buffer.byteLength(text)<1024*1024);sourceSha256[name]=(await hashNativeFile(path)).sha256;
  for(const match of text.matchAll(/^\s*(?:import\s*(?:\{[^}]*\}|\*\s+as\s+\w+|[\w$]+)\s+from\s*|export\s*(?:\{[^}]*\}|\*)\s+from\s*|import\s*)['"]([^'"\n]+)['"]/gm))
   if(match[1].startsWith('.'))pending.push(resolve(dirname(path),match[1]));
 }
 await mkdir(homeDir);await mkdir(arrivalDir);
 const homeFile=resolve(homeDir,'Frontier_Hero_Home.GPL'),packFile=resolve(arrivalDir,'Frontier_Hero_Arrival.pack');
 await writeFile(homeFile,fresh.record,{flag:'wx'});await writeFile(packFile,prepared.pack,{flag:'wx'});
 const provenance={archive:await descriptor(archiveName),originalHomePreparation:{filename:home.row.original,bytes:home.row.bytes,sha256:home.row.sha256},
  originalArrivalPreparation:{filename:arrival.row.original,bytes:arrival.row.bytes,sha256:arrival.row.sha256},
  exactOriginalHomeBytes:true,exactOriginalPackageAndPlan:true,nativeProcessesStarted:0,browserUsed:false};
 await writeFile(resolve(homeDir,'preparation.json'),JSON.stringify({...h,proposal:await descriptor(homeFile),
  plan:fresh.plan,sourceSha256,preparationRevalidation:provenance},null,2)+'\n',{flag:'wx'});
 await writeFile(resolve(arrivalDir,'preparation.json'),JSON.stringify({...p,pack:await descriptor(packFile),
  ...Object.fromEntries(['options','context','plan','layouts','ground','totalRecordBytes','packDescriptors'].map(k=>[k,prepared[k]])),
  sourceSha256,preparationRevalidation:provenance},null,2)+'\n',{flag:'wx'});
});
