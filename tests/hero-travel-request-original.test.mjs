// Reproduce source requests from the two inputs actually consumed by337.
// All old game/custody files are read-only. New writes use a controlled folder;
// no game, browser, native action or OPFS durability is claimed by this replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,lstat} from 'node:fs/promises';
import {resolve,join,dirname,relative} from 'node:path';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {stoppedFileSource} from '../scripts/lib/stopped-entity-io.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {stageNativeHeroTravelRequest,HERO_TRAVEL_REQUEST} from '../web/world/hero-travel-request.mjs';
import {HERO_ARRIVAL_INPUT,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_HOME} from '../web/world/hero-arrival-staging.mjs';
import {fileProfileStorage} from './fixtures/file-profile-storage.mjs';

const archiveName=process.env.MAJESTY_HERO_REQUEST_ORIGINAL_ARCHIVE;
test('source request reproduces both native337 outward inputs with bounded controlled I/O',
 {skip:!archiveName,timeout:60000},async()=>{
 const root=resolve('.'),out=resolve(process.env.MAJESTY_HERO_REQUEST_ORIGINAL_REPORT);
 assert.equal(dirname(out),resolve('output'));assert.match(out,/hero-browser-travel-request-original-\d{3}\.json$/);
 await assert.rejects(lstat(out),e=>e.code==='ENOENT');
 const json=async name=>{assert.ok((await lstat(name)).size<=1024*1024);return JSON.parse(await readFile(name,'utf8'));};
 const descriptor=async filename=>({filename:resolve(filename),...await hashNativeFile(filename)});
 async function bound(row){const h=await hashNativeFile(row.filename??row.preserved);
  if(row.bytes!==undefined)assert.equal(h.bytes,row.bytes);assert.equal(h.sha256,row.sha256);}
 const archive=await json(archiveName);assert.equal(archive.nativeFirstOutwardInputConsumptionQualified,true);
 async function evidence(name){const row=archive.evidence.find(r=>r.original===resolve(name));assert.ok(row,name);await bound(row);return json(row.preserved);}
 const m=await evidence('output/native-hero-binding-attempt-050.json'),q=await evidence('output/native-hero-proxy-input-004-observed.json');
 assert.equal(m.selectedHeroBindingTrialQualified,true);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.publicationWorkerTerminal,true);
 for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
 for(const [name,sha256]of Object.entries(q.sourceSha256)){
  const row=archive.sources.find(r=>r.original===resolve(name)&&r.sha256===sha256);assert.ok(row,name);await bound(row);
 }
 assert.equal(q.freshProxyInputConsumptionQualified,true);assert.equal(q.firstOutwardInputConsumptionQualified,true);
 const first=await evidence((await evidence(m.publication.filename)).firstOutwardInput.filename),
  repeat=await evidence(m.repeatNeighborPageInput.filename),capture=await evidence(m.repeatDeparturePublication.filename);
 const fixture=await mkdtemp(resolve('upstream/majesty-recomp/build/actor-arrival-fixture-hero-request-replay-'));
 const cases=[];
 for(const [label,staged,inputRow,packRow,sourceRow,targetRow,sourceManifest,targetManifest]of [
  ['first',first.arrival.browserInput.staged,first.preservedInput,first.arrival.pack,first.captured,first.target,first.nativeManifest,first.targetManifest],
  ['repeat',repeat.neighborArrival.browserInput.staged,repeat.neighborArrival.browserInput.manifest,repeat.neighborArrival.pack,
   capture.captured,repeat.target,capture.nativeManifest,repeat.nativeManifest]]){
  for(const row of [inputRow,packRow,sourceRow,targetRow])await bound(row);
  const text=await readFile(inputRow.filename,'utf8'),input=JSON.parse(text);assert.equal(text,staged.inputManifest);
  assert.equal(input.sourceNativeManifest,sourceManifest);assert.equal(input.destinationNativeManifest,targetManifest);
  assert.equal(await checkpointSavedClock(await stoppedFileSource(sourceRow.filename)),input.sourceClock);
  assert.equal(await checkpointSavedClock(await stoppedFileSource(targetRow.filename)),input.destinationClock);
  assert.equal(input.package.size,packRow.bytes);assert.equal(input.package.sha256,packRow.sha256);
  const source=join(fixture,label,'source'),destination=join(fixture,label,'destination');await mkdir(source,{recursive:true});await mkdir(destination);
  await writeFile(join(destination,HERO_ARRIVAL_INPUT),text,{flag:'wx'});
  await writeFile(join(destination,HERO_ARRIVAL_PACKAGE),await readFile(packRow.filename),{flag:'wx'});
  const homeName=join(m.fixture,'frontier_1_0',HERO_ARRIVAL_HOME),home=await descriptor(homeName);
  assert.equal(home.bytes,input.home.size);assert.equal(home.sha256,input.home.sha256);
  await writeFile(join(destination,HERO_ARRIVAL_HOME),await readFile(homeName),{flag:'wx'});
  let held=true;const adapter=fileProfileStorage(fixture,()=>held);
  const options={check(){assert.equal(held,true);},async validate(){for(const row of [inputRow,packRow,sourceRow,targetRow,home])await bound(row);}};
  const request=await stageNativeHeroTravelRequest(adapter.directory(source),adapter.directory(destination),staged,options);
  assert.equal(request.requestManifest,text);assert.equal(request.nativeActionIssued,false);assert.equal(request.sourceRetired,false);
  assert.equal(await readFile(join(source,HERO_TRAVEL_REQUEST),'utf8'),text);
  assert.deepEqual(adapter.stats.closed,[join(source,HERO_TRAVEL_REQUEST)]);
  const writes=adapter.stats.writes,retry=await stageNativeHeroTravelRequest(adapter.directory(source),adapter.directory(destination),staged,options);
  assert.equal(retry.idempotent,true);assert.equal(adapter.stats.writes,writes);assert.equal(adapter.stats.activeIO,0);assert.equal(adapter.stats.peakIO,1);
  assert.ok(adapter.stats.largestRead<=4096&&adapter.stats.largestWrite<=4096);held=false;
  cases.push({label,serial:input.serial,admission:input.home.admission,request:await descriptor(join(source,HERO_TRAVEL_REQUEST)),
   package:packRow,home,source:sourceRow,target:targetRow,stats:adapter.stats,exactRetryWrites:0});
 }
 const sourceSha256={},pending=[resolve('tests/hero-travel-request-original.test.mjs')];
 while(pending.length){const name=pending.pop(),key=relative(root,name);if(sourceSha256[key])continue;
  assert.ok(!key.startsWith('..')&&Object.keys(sourceSha256).length<128);sourceSha256[key]=(await hashNativeFile(name)).sha256;
  const text=await readFile(name,'utf8');for(const match of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g))
   if(match[1].startsWith('.'))pending.push(resolve(dirname(name),match[1]));
 }
 await writeFile(out,JSON.stringify({version:1,originalOutwardRequestStagingQualified:true,archive:await descriptor(archiveName),
  fixture,cases,sourceSha256,productionBrowserRequestStagerUsed:true,controlledFilesystemAdapter:true,
  nativeActionIssued:false,nativeSourceRetirementQualified:false,browserUsed:false,liveOPFSQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
});
