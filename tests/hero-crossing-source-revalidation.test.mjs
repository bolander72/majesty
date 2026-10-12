import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,lstat,mkdir,copyFile,writeFile,realpath} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {fileProfileStorage} from './fixtures/file-profile-storage.mjs';
import {nativeRealmRelativePath} from '../web/world/realm-profile.mjs';
import {heroRouteFilename} from '../web/world/hero-route-profile.mjs';
import {startNativeWorldPlayer} from '../web/world/realm-session.mjs';

const archiveName=process.env.MAJESTY_HERO_STARTUP_REVALIDATION_ARCHIVE;
test('current halo startup preserves the archived journey enrollment and its exact original checkpoint',
 {skip:!archiveName,timeout:60000},async()=>{
  const root=resolve('.'),output=resolve(process.env.MAJESTY_HERO_STARTUP_REVALIDATION_REPORT);
  assert.equal(dirname(output),join(root,'output'));assert.match(basename(output),/^hero-crossing-source-original-\d{3}\.json$/);
  async function json(name){assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));}
  async function bound(row){const filename=row.filename??row.preserved;const h=await hashNativeFile(filename);
    if(row.bytes!==undefined)assert.equal(h.bytes,row.bytes);assert.equal(h.sha256,row.sha256);return filename;}
  const archive=await json(archiveName);assert.equal(archive.nativeConnectedContinuedHeroRepeatHomeSaveQualified,true);
  const row=archive.evidence.find(r=>basename(r.original)==='hero-crossing-source-original-003.json');assert.ok(row);
  await bound(row);assert.equal((await hashNativeFile(row.original)).sha256,row.sha256);
  const original=await json(row.preserved);assert.equal(original.originalSelectedCrossingSourceStartupQualified,true);
  assert.equal(original.independentlyEnrolled,true);assert.equal(original.originalHaloStartupLayoutQualified,true);
  const terminal=await json(await bound(original.terminalAttempt));assert.equal(terminal.nativeSessionTerminal,true);
  assert.equal(terminal.nativeExitCode,0);assert.equal(terminal.ownedProducerAbsent,true);
  for(const pid of [terminal.nativePid,archive.nativePid,archive.publicationWorkerPid])
    assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
  for(const checkpoint of [original.sourceCheckpoint,original.producerOriginalCheckpoint])await bound(checkpoint);
  const oldFixture=resolve(original.fixture);assert.equal(await realpath(oldFixture),oldFixture);
  assert.equal(dirname(oldFixture),join(root,'output'));assert.equal(basename(oldFixture),'hero-crossing-source-original-003');
  const fixture=output.slice(0,-5),receipt=original.receipt,world=receipt.world,lockName='majesty-pair-native-world-'+world;
  for(const name of [output,fixture])await assert.rejects(lstat(name),e=>e.code==='ENOENT');
  const relative='majesty/profile/native-world-'+world,oldWorld=join(oldFixture,relative),newWorld=join(fixture,relative);
  await mkdir(join(newWorld,'hero-route'),{recursive:true});
  for(const [name,sha256] of Object.entries(original.routeHashes)){
    heroRouteFilename(name);const filename=join(oldWorld,'hero-route',name);assert.equal((await hashNativeFile(filename)).sha256,sha256);
    await copyFile(filename,join(newWorld,'hero-route',name));
  }
  const slot=Number(receipt.nativeManifest.split('\n')[1]),checkpoint='Frontier_'+receipt.region+(slot?'_Recovery':'')+'.GMP';
  const nativeRelative=nativeRealmRelativePath(checkpoint),nativeTarget=join(newWorld,...nativeRelative);
  await mkdir(dirname(nativeTarget),{recursive:true});await copyFile(join(oldWorld,...nativeRelative),nativeTarget);
  assert.equal((await hashNativeFile(nativeTarget)).sha256,receipt.sha256);
  const marker=join(newWorld,...nativeRealmRelativePath('Frontier_'+receipt.region+'.checkpoint'));
  assert.equal(await readFile(join(oldWorld,...nativeRealmRelativePath('Frontier_'+receipt.region+'.checkpoint')),'utf8'),receipt.nativeManifest);
  await writeFile(marker,receipt.nativeManifest,{flag:'wx'});
  let held=false;const lockCalls=[],locks={async request(name,options,consume){assert.equal(name,lockName);
    assert.equal(options.ifAvailable,true);assert.ok(['shared','exclusive'].includes(options.mode));lockCalls.push({name,...options});
    if(held)return consume(null);held=true;try{return await consume({});}finally{held=false;}}};
  const adapter=fileProfileStorage(fixture,()=>held),search='?'+new URLSearchParams({world,profile:'frontier_'+receipt.region,
    RECOMP_RULE_FRONTIER_REGION:receipt.region,RECOMP_RULE_FRONTIER_RESTORE:'1',RECOMP_RULE_FRONTIER_HERO_RESTORE:'v1',
    'hero-world':original.worldId,'hero-entity':original.enrollment.entityId,'hero-layout':'halo-v1'});
  let prepared;
  await assert.rejects(startNativeWorldPlayer(async(profile,retain,prepare)=>{
    assert.equal(profile,'native-world-'+world+'/frontier_'+receipt.region);
    prepared=await prepare(original.content,{signal:new AbortController().signal});
    assert.deepEqual(prepared,receipt);throw Error('verified stop before graphics');
  },{search,locks,storage:adapter.storage,events:{addEventListener(){},removeEventListener(){}}}),/verified stop before graphics/);
  assert.equal(held,false);assert.equal(adapter.stats.activeIO,0);assert.equal(adapter.stats.writes,0);assert.equal(adapter.stats.peakIO,1);
  assert.ok(adapter.stats.largestRead<=4096);
  for(const [name,sha256] of Object.entries(original.routeHashes)){
    assert.equal((await hashNativeFile(join(oldWorld,'hero-route',name))).sha256,sha256);
    assert.equal((await hashNativeFile(join(newWorld,'hero-route',name))).sha256,sha256);
  }
  assert.equal((await hashNativeFile(nativeTarget)).sha256,receipt.sha256);
  for(const checkpoint of [original.sourceCheckpoint,original.producerOriginalCheckpoint])await bound(checkpoint);
  const sourceSha256={};
  for(const name of new Set([...Object.keys(original.sourceSha256),'tests/hero-crossing-source-revalidation.test.mjs',
    'web/world/hero-home-arrival-package.mjs','web/world/hero-arrival-staging.mjs','web/world/hero-dormant-home-restore.mjs',
    'web/world/remote-home-projection.mjs','web/world/halo-order-compaction.mjs',
    'web/world/halo-order-navigation.mjs','web/world/hero-order-arrival.mjs']))
    sourceSha256[name]=(await hashNativeFile(resolve(name))).sha256;
  await writeFile(output,JSON.stringify({...original,fixture,receipt:prepared,sourceSha256,lockCalls,stats:adapter.stats,
    projectionWrites:0,currentStartupRevalidated:true,existingEnrollmentPreserved:true,
    originalEnrollment:{filename:row.original,bytes:row.bytes,sha256:row.sha256},
    enrollmentArchive:{filename:resolve(archiveName),...await hashNativeFile(archiveName)},
    realOPFSDurabilityQualified:false,browserUsed:false,nativeProcessesStarted:0,nativeCrossingQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
 });
