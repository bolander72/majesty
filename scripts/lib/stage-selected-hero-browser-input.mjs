// Exercise the production browser stager inside the private native fixture.
// This controlled filesystem adapter is not live OPFS or browser durability.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {stageNativeHeroHomeInput,stageNativeHeroProxyInput,HERO_ARRIVAL_INPUT} from '../../web/world/hero-arrival-staging.mjs';
import {fileProfileStorage} from '../../tests/fixtures/file-profile-storage.mjs';
import {hashNativeFile} from './native-generation.mjs';
import {realmFiles} from '../../web/world/realm-store.mjs';

export async function stageSelectedHeroBrowserInput(m,capture,target,arrival){
 const fixture=resolve(m.fixture),profile=join(fixture,'frontier_'+target.region),sourceRegion=capture.crossing.region;
 assert.ok(fixture.startsWith(resolve('upstream/majesty-recomp/build/actor-arrival-fixture-hero-binding-')));
 assert.equal(m.nativeSessionTerminal,false);process.kill(m.nativePid,0);
 const owner=capture.publicationReceipt?.owner??capture.owner,
  ownerManifest=capture.publicationReceipt?.ownerManifest??capture.ownerManifest;
 const nativeSource=capture.nativeManifest,nativeTarget=target.nativeManifest;
 assert.ok((await lstat(arrival.pack.filename)).size<=256*1024);
 const pack=new Uint8Array(await readFile(arrival.pack.filename));
 assert.equal((await hashNativeFile(arrival.pack.filename)).sha256,arrival.pack.sha256);
 const proxy=target.homeAlias.kind==='proxy';let proxyInput;
 if(proxy){
  assert.ok(['reserve-new','reuse-existing'].includes(target.homeAdmission));
  const home=target.proxyRecord;assert.ok((await lstat(home.filename)).size<=1024);
  const bytes=new Uint8Array(await readFile(home.filename)),h=await hashNativeFile(home.filename);
  assert.equal(h.bytes,home.bytes);assert.equal(h.sha256,home.sha256);
  proxyInput={homeAdmission:target.homeAdmission,homeRecord:bytes,homeSha256:h.sha256};
 }
 const adapter=fileProfileStorage(fixture,()=>{process.kill(m.nativePid,0);return true;});
 function check(){process.kill(m.nativePid,0);}
 async function validate(){
  check();assert.equal(await readFile(join(capture.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),ownerManifest);
  for(const [region,expected] of [[sourceRegion,nativeSource],[target.region,nativeTarget]]){
   const names=realmFiles(region),folder=join(fixture,'frontier_'+region);
   assert.equal(await readFile(join(folder,names.marker),'utf8'),expected);
   const lines=expected.split('\n'),h=await hashNativeFile(join(folder,'Documents/My Games/MajestyHD/SaveGame',names.slots[Number(lines[1])]));
   assert.equal(h.bytes,Number(lines[2]));assert.equal(h.sha256,lines[3]);
  }check();
 }
 const stage=proxy?stageNativeHeroProxyInput:stageNativeHeroHomeInput;
 const staged=await stage(adapter.directory(profile),{
  serial:capture.crossing.serial,sourceRegion,targetRegion:target.region,sourceClock:capture.crossing.clock,
  destinationClock:target.clock,sourceAlias:{unitId:owner.unitId,agentId:owner.agentId},homeAlias:target.homeAlias,
  sourceNativeManifest:nativeSource,destinationNativeManifest:nativeTarget,ownerManifest,pack,sha256:arrival.pack.sha256,...proxyInput},
  {check,validate});
 assert.equal(adapter.stats.activeIO,0);assert.ok(adapter.stats.largestRead<=4096&&adapter.stats.largestWrite<=4096);
 const filename=join(profile,HERO_ARRIVAL_INPUT);
 return {staged,manifest:{filename,...await hashNativeFile(filename)},stats:adapter.stats,
  controlledFilesystemAdapter:true,liveOPFSQualified:false};
}
