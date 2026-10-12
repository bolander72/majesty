import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,lstat,writeFile,mkdtemp,mkdir,copyFile} from 'node:fs/promises';
import {resolve,basename,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareSelectedHeroHomeArrival} from '../web/world/hero-home-arrival-package.mjs';
import {stoppedFileSource} from '../scripts/lib/stopped-entity-io.mjs';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {CheckpointReadLease} from '../web/world/checkpoint-lease.mjs';
import {stageNativeHeroHomeInput,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT} from '../web/world/hero-arrival-staging.mjs';
import {fileProfileStorage} from './fixtures/file-profile-storage.mjs';
import {restoreSelectedDormantHeroHome} from '../web/world/hero-dormant-home-restore.mjs';
import {HeroRouteStore} from '../web/world/hero-route-store.mjs';
import {NativeRealmStore,realmFiles} from '../web/world/realm-store.mjs';
import {opfsNativeRealmStorage,nativeRealmRelativePath} from '../web/world/realm-profile.mjs';

const archiveName=process.env.MAJESTY_HERO_HOME_PACKAGE_ARCHIVE;
test('browser-compatible return capsule reproduces the original-engine accepted second-return bytes',
 {skip:!archiveName,timeout:60000},async()=>{
  async function json(name){assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));}
  async function bound(row){const h=await hashNativeFile(row.filename??row.preserved);
    assert.equal(h.bytes,row.bytes);assert.equal(h.sha256,row.sha256);}
  const archive=await json(archiveName);assert.equal(archive.nativeConnectedContinuedHeroRepeatHomeSaveQualified,true);
  async function evidence(name){const row=archive.evidence.find(r=>r.original===resolve(name));assert.ok(row,name);
    await bound(row);return json(row.preserved);}
  const qualification=await evidence('output/native-hero-repeat-home-import-002-observed.json');
  assert.equal(qualification.nativeConnectedRepeatedHeroHomeImportQualified,true);
  const m=await evidence('output/native-hero-binding-attempt-044.json');
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);
  for(const pid of [m.nativePid,m.publicationWorkerPid]){
    assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH','Recorded original producers must be absent');
  }
  const first=await evidence(m.publication.filename),capture=await evidence(m.repeatReturnPublication.filename),
    input=await evidence(m.repeatHomePageInput.filename);
  for(const row of [capture.captured,input.target,input.returnArrival.pack]){
    const preserved=archive.snapshots.find(r=>r.filename===row.filename);assert.ok(preserved);assert.equal(preserved.sha256,row.sha256);
    await bound(row);
  }
  const source=await stoppedFileSource(capture.captured.filename),destination=await stoppedFileSource(input.target.filename);
  const lease=new CheckpointReadLease({maximum:2,ended:'Original package test lease ended',bounds:'Original package test read out of bounds',truncated:'Original package test truncated'});
  const selected={regions:['1_0','0_0'],entries:[{region:'1_0',alias:capture.publicationReceipt.owner,
    homeAlias:capture.publicationReceipt.home},input.targetEntry],sources:[lease.source(source),lease.source(destination)]};
  let prepared;
  try{
    prepared=await prepareSelectedHeroHomeArrival(first.identity,selected,capture.crossing);
    const actual=await readFile(input.returnArrival.pack.filename);
    assert.deepEqual(Buffer.from(prepared.pack),actual);assert.equal(actual.length,3016);
    for(const key of ['options','context','plan','layouts','ground','travel','totalRecordBytes','packDescriptors'])
      assert.deepEqual(JSON.parse(JSON.stringify(prepared[key])),input.returnArrival[key],key);
    await assert.rejects(prepareSelectedHeroHomeArrival(first.identity,selected,{...capture.crossing,clock:4651}),/clock differs/);
    await assert.rejects(prepareSelectedHeroHomeArrival(first.identity,selected,{...capture.crossing,unitId:538}),/selected return/);
  }finally{lease.revoke();}
  assert.equal(lease.retainedSources,0);
  await assert.rejects(prepareSelectedHeroHomeArrival(first.identity,selected,capture.crossing),/lease ended/);
  for(const row of [capture.captured,input.target,input.returnArrival.pack])await bound(row);
  const packSha256=createHash('sha256').update(prepared.pack).digest('hex');assert.equal(packSha256,input.returnArrival.pack.sha256);
  // Recreate the real pre-return state: journal 9 selects the retired home,
  // while the original loader still has its earlier live departure capture.
  // All writes are confined to a fresh controlled directory; archived saves
  // remain read-only and no original engine or browser is started.
  const departure=await evidence(m.repeatDeparturePublication.filename);
  for(const row of [departure.captured,departure.marker]){
    assert.ok(archive.snapshots.some(r=>r.filename===row.filename&&r.sha256===row.sha256));await bound(row);
  }
  const historical=new Map();
  for(const [name,sha256] of Object.entries(capture.journalSha256)){
    const row=archive.journalReferences.find(r=>basename(r.filename)===name&&r.sha256===sha256);
    assert.ok(row,`Authenticated historical journal file ${name}`);await bound(row);
    historical.set(name,await stoppedFileSource(row.filename));
  }
  const fixture=await mkdtemp(resolve('output/browser-native-home-restoration-original-'));
  let held=true;const io=fileProfileStorage(fixture,()=>held),locks={async request(name,options,consume){
    assert.equal(held,true);assert.equal(name,'majesty-pair-native-world-original-return');
    assert.ok(['shared','exclusive'].includes(options.mode));assert.equal(options.ifAvailable,true);return consume({});
  }};
  const nativeFile=name=>resolve(fixture,'native-world-original-return',...nativeRealmRelativePath(name));
  for(const [key,row,manifest] of [['1_0',capture.captured,capture.nativeManifest],['0_0',departure.captured,departure.nativeManifest]]){
    const names=realmFiles(key),slot=Number(manifest.split('\n')[1]);
    await mkdir(dirname(nativeFile(names.slots[slot])),{recursive:true});
    await copyFile(row.filename,nativeFile(names.slots[slot]));await writeFile(nativeFile(names.marker),manifest,{flag:'wx'});
  }
  const route=new HeroRouteStore({async withLock(mode,consume){assert.equal(held,true);return consume();},
    async open(name){assert.equal(held,true);return historical.get(name)??null;},async atomicWrite(){throw Error('Read-only historical journal');}},
    first.identity,first.identity.contentDigest);
  const native=new NativeRealmStore(opfsNativeRealmStorage(io.directory(fixture),'original-return',locks),
    {content:capture.nativeManifest.split('\n')[4]});
  const restoreRequest={serial:capture.crossing.serial,sourceRegion:'1_0',targetRegion:'0_0',
    sourceAlias:capture.publicationReceipt.owner,sourceOwnerManifest:capture.publicationReceipt.ownerManifest,
    sourceNativeManifest:capture.nativeManifest,sourceSha256:capture.captured.sha256,sourceSize:capture.captured.bytes,sourceClock:4650};
  const restored=await restoreSelectedDormantHeroHome(route,native,restoreRequest,{check(){assert.equal(held,true);}});
  assert.equal(restored.idempotent,false);assert.equal(restored.clock,104900);assert.equal(restored.sha256,input.target.sha256);
  const homeNames=realmFiles('0_0'),restoredSlot=Number(restored.destinationNativeManifest.split('\n')[1]);
  const restoredFile=nativeFile(homeNames.slots[restoredSlot]),oldFile=nativeFile(homeNames.slots[1-restoredSlot]);
  assert.equal((await hashNativeFile(restoredFile)).sha256,input.target.sha256);
  assert.equal((await hashNativeFile(oldFile)).sha256,departure.captured.sha256);
  assert.equal((await native.read('1_0')).manifest,capture.nativeManifest);
  assert.equal((await route.read()).record.manifest,capture.publicationReceipt.ownerManifest);
  const restoredWrites=io.stats.writes,restoredCloses=io.stats.closed.length;
  assert.deepEqual(io.stats.closed.map(name=>basename(name)).sort(),[homeNames.marker,homeNames.slots[restoredSlot]].sort());
  assert.equal((await restoreSelectedDormantHeroHome(route,native,restoreRequest)).idempotent,true);
  assert.equal(io.stats.writes,restoredWrites);assert.equal(io.stats.closed.length,restoredCloses);
  await route.withDestination('0_0',null,async selected=>{
    const next=await prepareSelectedHeroHomeArrival(first.identity,selected,capture.crossing);
    assert.equal(createHash('sha256').update(next.pack).digest('hex'),packSha256);
  });
  assert.ok(io.stats.largestRead<=4096&&io.stats.largestWrite<=4096);assert.equal(io.stats.activeIO,0);held=false;
  for(const row of [capture.captured,input.target,input.returnArrival.pack,departure.captured,departure.marker])await bound(row);
  for(const source of historical.values())assert.ok(source.size<1024*1024);
  if(process.env.MAJESTY_HERO_HOME_RESTORE_REPORT){
    const name=process.env.MAJESTY_HERO_HOME_RESTORE_REPORT;
    assert.match(name,/^output\/browser-native-home-restoration-\d{3}-original\.json$/);
    await writeFile(name,JSON.stringify({version:1,originalSelectedDormantHomeRestored:true,
      archive:{filename:resolve(archiveName),...await hashNativeFile(archiveName)},fixture,
      restoredHome:{filename:restoredFile,...await hashNativeFile(restoredFile)},
      preservedDeparture:{filename:oldFile,...await hashNativeFile(oldFile)},
      sourceClock:4650,destinationClock:104900,sourceAlias:restoreRequest.sourceAlias,restored,
      originalAcceptedPackageSha256:packSha256,retryWrites:0,stats:io.stats,
      historicalOwnerRevision:9,ownerUnchanged:true,originalSnapshotsUnchanged:true,
      controlledFilesystemAdapter:true,liveBrowserTravelQualified:false,newNativeGameRun:false,browserUsed:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
  }
  if(process.env.MAJESTY_HERO_HOME_STAGE_REPORT){
    const name=process.env.MAJESTY_HERO_HOME_STAGE_REPORT;
    assert.match(name,/^output\/browser-native-home-staging-\d{3}-original\.json$/);
    const fixture=await mkdtemp(resolve('output/browser-native-home-staging-original-'));
    let held=true,validations=0;const io=fileProfileStorage(fixture,()=>held),folder=io.directory(fixture);
    const request={serial:capture.crossing.serial,sourceRegion:'1_0',targetRegion:'0_0',sourceClock:4650,destinationClock:104900,
      sourceAlias:capture.publicationReceipt.owner,homeAlias:input.targetEntry.homeAlias,
      sourceNativeManifest:capture.nativeManifest,destinationNativeManifest:input.nativeManifest,
      ownerManifest:capture.publicationReceipt.ownerManifest,pack:prepared.pack,sha256:packSha256};
    const options={check(){assert.equal(held,true);},async validate(){++validations;
      for(const row of [capture.captured,input.target,input.returnArrival.pack])await bound(row);}};
    const staged=await stageNativeHeroHomeInput(folder,request,options);assert.equal(staged.idempotent,false);
    const packageFile=resolve(fixture,HERO_ARRIVAL_PACKAGE),manifestFile=resolve(fixture,HERO_ARRIVAL_INPUT);
    assert.deepEqual(await readFile(packageFile),Buffer.from(prepared.pack));
    assert.equal(await readFile(manifestFile,'utf8'),staged.inputManifest);
    const writes=io.stats.writes,closed=io.stats.closed.length;
    const retry=await stageNativeHeroHomeInput(folder,request,options);assert.equal(retry.idempotent,true);
    assert.equal(io.stats.writes,writes);assert.equal(io.stats.closed.length,closed);assert.equal(validations,4);
    assert.ok(io.stats.largestRead<=4096&&io.stats.largestWrite<=4096);assert.equal(io.stats.activeIO,0);held=false;
    await writeFile(name,JSON.stringify({version:1,originalAcceptedNativeHomePackageStaged:true,
      archive:{filename:resolve(archiveName),...await hashNativeFile(archiveName)},fixture,
      package:{filename:packageFile,...await hashNativeFile(packageFile)},input:{filename:manifestFile,...await hashNativeFile(manifestFile)},
      sourceClock:4650,destinationClock:104900,nativeSourceAlias:request.sourceAlias,nativeHome:request.homeAlias,
      staged,validations,stats:io.stats,retryWrites:0,originalSnapshotsUnchanged:true,
      controlledFilesystemAdapter:true,liveBrowserImportQualified:false,browserUsed:false,newNativeGameRun:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
  }
  if(process.env.MAJESTY_HERO_HOME_PACKAGE_REPORT){
    const name=process.env.MAJESTY_HERO_HOME_PACKAGE_REPORT;
    assert.match(name,/^output\/browser-native-home-package-\d{3}-original\.json$/);
    await writeFile(name,JSON.stringify({version:1,browserCompatibleNativeHomeCapsuleExact:true,
      archive:{filename:resolve(archiveName),...await hashNativeFile(archiveName)},
      qualification:'native-hero-repeat-home-import-002-observed.json',pack:{size:prepared.pack.length,sha256:packSha256},
      sourceClock:prepared.options.sourceClockMs,destinationClock:prepared.options.destinationClockMs,
      comparedMetadata:['options','context','plan','layouts','ground','travel','totalRecordBytes','packDescriptors'],
      originalSnapshotsUnchanged:true,readersRevoked:true,newNativeGameRun:false,browserUsed:false,
      liveBrowserImportQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
  }
 });
