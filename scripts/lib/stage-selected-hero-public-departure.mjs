// Queue the ordinary named request only after the production source stager
// authenticates this already prepared destination in the owned native fixture.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {fileProfileStorage} from '../../tests/fixtures/file-profile-storage.mjs';
import {stageNativeHeroTravelRequest,HERO_TRAVEL_REQUEST} from '../../web/world/hero-travel-request.mjs';
import {realmFiles} from '../../web/world/realm-store.mjs';
import {hashNativeFile} from './native-generation.mjs';

export async function stageSelectedHeroPublicDeparture(m,capture,arrival){
 assert.equal(m.publicTravel,true);assert.equal(m.nativeSessionTerminal,false);process.kill(m.nativePid,0);
 const staged=arrival.browserInput.staged,input=JSON.parse(staged.inputManifest),serial=capture.crossing.serial;
 assert.ok([2,4,6].includes(serial));assert.equal(input.serial,serial);
 const source=join(m.fixture,'frontier_'+input.sourceRegion),target=join(m.fixture,'frontier_'+input.targetRegion),
  adapter=fileProfileStorage(m.fixture,()=>{process.kill(m.nativePid,0);return true;});
 function check(){process.kill(m.nativePid,0);}
 async function validate(){
  check();assert.equal(await readFile(join(capture.journal,'Frontier_Hero_Route.checkpoint'),'utf8'),input.ownerManifest);
  for(const [key,manifest]of [[input.sourceRegion,input.sourceNativeManifest],[input.targetRegion,input.destinationNativeManifest]]){
   const names=realmFiles(key),profile=join(m.fixture,'frontier_'+key);
   assert.equal(await readFile(join(profile,names.marker),'utf8'),manifest);
   const fields=manifest.split('\n'),digest=await hashNativeFile(join(profile,'Documents/My Games/MajestyHD/SaveGame',names.slots[Number(fields[1])]));
   assert.equal(digest.bytes,Number(fields[2]));assert.equal(digest.sha256,fields[3]);
  }check();
 }
 const request=await stageNativeHeroTravelRequest(adapter.directory(source),adapter.directory(target),staged,{check,validate});
 const bytes=await readFile(join(source,HERO_TRAVEL_REQUEST)),preserved=join(source,`Hero_Public_Travel_Request_${serial}.json`);
 await writeFile(preserved,bytes,{flag:'wx'});assert.equal(bytes.toString(),request.requestManifest);
 assert.equal(adapter.stats.activeIO,0);assert.ok(adapter.stats.largestRead<=4096&&adapter.stats.largestWrite<=4096);
 const log=await readFile(m.log,'utf8');assert.ok(!log.includes(`[frontier] Hero departure request consumed serial=${serial} `));
 const out=join(m.fixture,`public-departure-${String(serial).padStart(3,'0')}.json`);await assert.rejects(lstat(out),e=>e.code==='ENOENT');
 await writeFile(out,JSON.stringify({version:1,serial,nativePid:m.nativePid,fixture:m.fixture,request,
  preservedRequest:{filename:preserved,...await hashNativeFile(preserved)},stats:adapter.stats,
  stagedBeforeRetirement:true,stagingWithoutActionKeptSourceHeld:true,browserUsed:false,liveOPFSQualified:false},null,2)+'\n',{flag:'wx'});
 const action=join(source,'Frontier_Hero_Departure_Action.txt');
 await writeFile(action+'.tmp',`majesty-hero-departure-action-v1|${serial}|1\n`,{flag:'wx'});await rename(action+'.tmp',action);
 return {filename:out,...await hashNativeFile(out)};
}
