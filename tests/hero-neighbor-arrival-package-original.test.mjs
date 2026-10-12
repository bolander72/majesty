import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,lstat,writeFile,mkdtemp} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from '../scripts/lib/native-generation.mjs';
import {stoppedFileSource} from '../scripts/lib/stopped-entity-io.mjs';
import {CheckpointReadLease} from '../web/world/checkpoint-lease.mjs';
import {checkpointChunks,checkpointAgentManagerLayout} from '../web/world/checkpoint.mjs';
import {registeredHeroHome} from '../web/world/entity-home-ownership.mjs';
import {prepareOrReuseRemoteHomeAgent} from '../web/world/remote-home-cache.mjs';
import {withProposedRemoteHome} from '../web/world/remote-home-projection.mjs';
import {prepareSelectedHeroNeighborArrival} from '../web/world/hero-home-arrival-package.mjs';
import {stageNativeHeroProxyInput,HERO_ARRIVAL_HOME,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT} from '../web/world/hero-arrival-staging.mjs';
import {fileProfileStorage} from './fixtures/file-profile-storage.mjs';

const archiveName=process.env.MAJESTY_HERO_NEIGHBOR_PACKAGE_ARCHIVE;
test('browser outward packages reproduce both native imports and the original fresh-home GPL registration',
 {skip:!archiveName,timeout:60000},async()=>{
  async function json(name){assert.ok((await lstat(name)).size<1024*1024);return JSON.parse(await readFile(name,'utf8'));}
  async function bound(row){const h=await hashNativeFile(row.filename??row.preserved);
   assert.equal(h.bytes,row.bytes);assert.equal(h.sha256,row.sha256);}
  const archive=await json(archiveName);assert.equal(archive.nativeBrowserHomeInputConsumptionQualified,true);
  async function evidence(name){const row=archive.evidence.find(r=>r.original===resolve(name));assert.ok(row,name);
   await bound(row);return json(row.preserved);}
  async function snapshot(row){const saved=archive.snapshots.find(r=>r.filename===row.filename&&r.sha256===row.sha256);
   assert.ok(saved,row.filename);assert.equal(saved.bytes,row.bytes);await bound(row);return row;}
  const m=await evidence('output/native-hero-binding-attempt-046.json');
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.publicationWorkerExitCode,0);
  for(const pid of [m.nativePid,m.publicationWorkerPid])assert.throws(()=>process.kill(pid,0),e=>e.code==='ESRCH');
  const firstQualified=await evidence('output/native-hero-arrival-022-observed.json');
  assert.equal(firstQualified.nativeHeroArrivalQualified,true);assert.equal(firstQualified.connectedArrivalActivatedQualified,true);
  const repeatQualified=await evidence('output/native-hero-repeat-neighbor-arrival-006-observed.json');
  assert.equal(repeatQualified.nativeConnectedRepeatedHeroNeighborArrivalResumeQualified,true);
  const first=await evidence(m.publication.filename),firstPreparation=await evidence(m.arrivalPreparation.filename),
   departure=await evidence(m.repeatDeparturePublication.filename),repeat=await evidence(m.repeatNeighborPageInput.filename);
  assert.deepEqual(first.identity,firstPreparation.identity);
  const before=await snapshot(m.arrivalWorlds.find(r=>basename(r.filename)==='Hero_Home_Before.GMP')),
   registeredSave=await snapshot(m.arrivalWorlds.find(r=>basename(r.filename)==='Hero_Home_Registered.GMP'));
  for(const row of [first.captured,m.arrivalPackage,departure.captured,repeat.target,repeat.neighborArrival.pack])await snapshot(row);
  const identity=first.identity,registered=registeredHeroHome(identity),h=registered.record.home;
  async function root(source,tag){let result;for await(const r of checkpointChunks(source))if(r.tag===tag){assert.equal(result,undefined);result=r;}
   assert.ok(result);return result;}
  async function equalRoot(a,b,tag){const x=await root(a,tag),y=await root(b,tag);
   assert.equal(x.size,y.size);assert.equal(x.version,y.version);assert.equal(x.count,y.count);
   for(let at=0;at<x.size+16;at+=4096){const n=Math.min(4096,x.size+16-at);
    assert.deepEqual(await a.readAt(x.offset+at,n),await b.readAt(y.offset+at,n),`${tag} byte ${at}`);}
  }
  const outcomes=[];
  for(const fresh of [true,false]){
   const sourceRow=fresh?first.captured:departure.captured,destinationRow=fresh?before:repeat.target,
    boundary=fresh?m.nativeCrossing:departure.crossing,expected=fresh?m.arrivalPackage:repeat.neighborArrival.pack;
   const lease=new CheckpointReadLease({maximum:2,ended:'Original outward lease ended',bounds:'Outward read out of bounds',truncated:'Truncated outward save'});
   const from=lease.source(await stoppedFileSource(sourceRow.filename)),to=lease.source(await stoppedFileSource(destinationRow.filename));
   let escaped,prepared,projection,home,proposal;
   try{
    const layout=await checkpointAgentManagerLayout(to);
    proposal=await prepareOrReuseRemoteHomeAgent(to,registered,{worldId:registered.record.worldId,
     contentDigest:identity.contentDigest,destinationRegion:'1_0',freshAgentId:layout.nextAgentId});
    assert.equal(proposal.plan.admission,fresh?'reserve-new':'reuse-existing');assert.equal(proposal.plan.proposedAgentId,38);
    home={kind:'proxy',unitId:0,agentId:38};
    async function prepare(destination){return prepareSelectedHeroNeighborArrival(identity,
     {regions:['0_0','1_0'],entries:[{region:'0_0',alias:{unitId:boundary.unitId,agentId:boundary.agentId},
       homeAlias:{kind:'native',unitId:h.unitId,agentId:h.agentId}},
       {region:'1_0',alias:{unitId:100000,agentId:1000},homeAlias:home}],sources:[from,destination]},boundary);}
    if(fresh){
     prepared=await withProposedRemoteHome(to,registered,proposal,async projected=>{
      escaped=projected.source;projection=projected.plan;
      await equalRoot(escaped,await stoppedFileSource(registeredSave.filename),'GPL ');
      return prepare(escaped);
     });
     await assert.rejects(escaped.readAt(0,1),/lease ended/);
     assert.equal(projection.insertedBytes,proposal.record.length+4);assert.equal(projection.retainedPatchBytes,20);
    }else prepared=await prepare(to);
    assert.deepEqual(Buffer.from(prepared.pack),await readFile(expected.filename));
    const old=fresh?firstPreparation:repeat.neighborArrival;
    for(const key of ['options','context','plan','layouts','ground','totalRecordBytes','packDescriptors'])
     assert.deepEqual(JSON.parse(JSON.stringify(prepared[key])),old[key],key);
   }finally{lease.revoke();}
   assert.equal(lease.retainedSources,0);await assert.rejects(from.readAt(0,1),/lease ended/);
   const fixture=await mkdtemp(resolve('output/browser-proxy-home-staging-original-'));let held=true,validations=0;
   const io=fileProfileStorage(fixture,()=>held),packSha256=createHash('sha256').update(prepared.pack).digest('hex');
   const input={serial:boundary.serial,sourceRegion:'0_0',targetRegion:'1_0',sourceClock:boundary.clock,
    destinationClock:prepared.options.destinationClockMs,sourceAlias:{unitId:boundary.unitId,agentId:boundary.agentId},homeAlias:home,
    sourceNativeManifest:fresh?m.heldSave.nativeManifest:departure.nativeManifest,
    destinationNativeManifest:fresh?['checkpoint-v1',0,before.bytes,before.sha256,m.heldSave.nativeManifest.split('\n')[4],''].join('\n'):repeat.nativeManifest,
    ownerManifest:fresh?first.capturedManifest:departure.publicationReceipt.ownerManifest,
    homeAdmission:proposal.plan.admission,homeRecord:proposal.record,homeSha256:proposal.plan.recordSha256,
    pack:prepared.pack,sha256:packSha256};
   assert.ok(input.sourceNativeManifest.startsWith('checkpoint-v1\n'));
   assert.ok(input.destinationNativeManifest.startsWith('checkpoint-v1\n'));
   assert.equal(JSON.parse(input.ownerManifest).revision,fresh?1:departure.publicationReceipt.ownerRevision);
   const options={check(){assert.equal(held,true);},async validate(){assert.equal(held,true);validations++;
    for(const row of [sourceRow,destinationRow,expected])await bound(row);}};
   const staged=await stageNativeHeroProxyInput(io.directory(fixture),input,options);
   assert.equal(staged.idempotent,false);assert.equal(staged.heroImported,false);assert.equal(staged.ownerTransferred,false);
   const request=JSON.parse(staged.inputManifest);assert.equal(request.home.admission,fresh?'reserve-new':'reuse-existing');
   assert.deepEqual(request.homeAlias,home);assert.equal(request.package.sha256,expected.sha256);
   assert.equal((await hashNativeFile(resolve(fixture,HERO_ARRIVAL_HOME))).sha256,proposal.plan.recordSha256);
   assert.equal((await hashNativeFile(resolve(fixture,HERO_ARRIVAL_PACKAGE))).sha256,expected.sha256);
   assert.deepEqual(io.stats.closed.map(n=>basename(n)),[HERO_ARRIVAL_HOME,HERO_ARRIVAL_PACKAGE,HERO_ARRIVAL_INPUT]);
   const writes=io.stats.writes;assert.equal((await stageNativeHeroProxyInput(io.directory(fixture),input,options)).idempotent,true);
   assert.equal(io.stats.writes,writes);assert.equal(validations,4);
   assert.ok(io.stats.largestRead<=4096&&io.stats.largestWrite<=4096);assert.equal(io.stats.peakIO,1);assert.equal(io.stats.activeIO,0);
   held=false;
   outcomes.push({admission:proposal.plan.admission,sourceClock:boundary.clock,destinationClock:prepared.options.destinationClockMs,
    packageBytes:prepared.pack.length,packageSha256:packSha256,homeBytes:proposal.record.length,
    projectedGPLMatchesOriginalRegistration:fresh,projection:projection??null,fixture,stats:io.stats,
    sourceNativeManifest:input.sourceNativeManifest,ownerManifest:input.ownerManifest,
    exactRetryWrites:io.stats.writes-writes,leaseReadersRevoked:true});
   for(const row of [sourceRow,destinationRow,expected])await bound(row);
  }
  if(process.env.MAJESTY_HERO_NEIGHBOR_PACKAGE_REPORT)await writeFile(process.env.MAJESTY_HERO_NEIGHBOR_PACKAGE_REPORT,
   JSON.stringify({version:1,browserNeighborPackageOriginalBytesQualified:true,
    archive:{filename:resolve(archiveName),...await hashNativeFile(archiveName)},outcomes,
    browserUsed:false,nativeProcessesStarted:0,proxyInputNativeConsumptionQualified:false,
    liveBrowserTravelQualified:false,goalComplete:false},null,2)+'\n',{flag:'wx'});
});
