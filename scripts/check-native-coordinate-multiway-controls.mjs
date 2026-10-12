import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseMultiwayCoordinateTravel} from './lib/multiway-coordinate-travel.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const [proofName,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const proof=JSON.parse(await readFile(proofName,'utf8'));assert.equal(proof.multiWayNativeCoordinateTravelQualified,true);
const m=JSON.parse(await readFile(proof.sourceManifest,'utf8'));assert.equal(sha(await readFile(proof.sourceManifest)),proof.sourceManifestSha256);
const log=await readFile(m.log,'utf8');assert.equal(sha(Buffer.from(log)),m.logSha256);
const first=m.coordinateRoute[1],last=m.coordinateRoute.length-1;
const firstTravel=m.requestPublications.findIndex(p=>p.kind==='travel');assert.ok(firstTravel>=0);
const cycles=proof.savedKingdomEvidence.cycles;const passing=parseMultiwayCoordinateTravel(log,cycles,m),controls=[];
function refuse(name,change){const altered=structuredClone(m),text=change(log,altered)??log;
  assert.ok(text!==log||JSON.stringify(altered)!==JSON.stringify(m),'Control did not change actual evidence: '+name);
  assert.throws(()=>parseMultiwayCoordinateTravel(text,cycles,altered),undefined,name);controls.push(name);}
refuse('missing replay refusal',s=>s.replace(/^\[streaming\] World coordinate-request refused visit=1 .*\n/m,''));
refuse('accepted wrong destination',s=>s.replace(/(coordinate-request accepted visit=0 .*?target=)\S+/,'$11_0'));
refuse('accepted stale serial',s=>s.replace(/(coordinate-request accepted visit=0 serial=)1/,'$10'));
refuse('source changed before publication',s=>s.replace('coordinate-snapshot visit=0 region=0_0 stage=after','coordinate-snapshot visit=0 region=1_0 stage=after'));
refuse('missing checkpoint publication',s=>s.replace(/(coordinate-snapshot visit=0 .*?stage=after .*?latest-published=)1/,'$10'));
refuse('activation did not dispose every root',s=>s.replace(`coordinate-activation visit=1 region=${first} roots-freed=6`,`coordinate-activation visit=1 region=${first} roots-freed=5`));
refuse('malformed length claimed exact',s=>s.replace(/^(\[streaming\] World coordinate-request refused .*?exact=)0/m,'$11'));
refuse('wrong readiness operation',s=>s.replace(/(coordinate-ready serial=1 .*?operation=)0/,'$11'));
refuse('extra activation',s=>s+`[streaming] World coordinate-activation visit=${last+1} region=0_0 roots-freed=6 saved-before-switch=1 result=pass\n`);
refuse('request wire digest changed',(_s,c)=>{c.requestPublications[4].sha256='0'.repeat(64);});
refuse('request published before deliberate delay',(_s,c)=>{c.requestPublications[firstTravel].publishedAtMs=c.readyPublications[0].observedAtMs;});
refuse('generated kingdom mislabeled as remote',s=>s.replace(`coordinate-snapshot visit=1 region=${first} stage=before`,'coordinate-snapshot visit=1 region=1_0 stage=before'));
refuse('wrong third saved clock',s=>s.replace(/(coordinate-ready serial=2 .*?clock=)10000/,'$124250'));
refuse('missing third activation',s=>s.replace(/^\[streaming\] World coordinate-activation visit=1 .*\n/m,''));
refuse('final visit missing publication',s=>s.replace(new RegExp('^\\[streaming\\] World coordinate-snapshot visit='+last+' .*stage=after .*\\n','m'),''));
refuse('negative coordinate lost signed decoding',s=>s.replace('target=0_-1','target=0_4294967295'));
if(m.checkpointFaultProbe){
 refuse('missing damaged-neighbor refusal',s=>s.replace(/^\[streaming\] World coordinate-request refused visit=0 serial=1 source=0_0 target=0_1 .*\n/m,''));
 refuse('damaged neighbor claimed available',s=>s.replace(/^(\[streaming\] World coordinate-request refused visit=0 serial=1 source=0_0 target=0_1 .*?available=)0/m,'$11'));
}
const earlier=JSON.parse(await readFile('output/native-coordinate-travel-attempt-002.json','utf8')),
  earlierLog=await readFile(earlier.log,'utf8');assert.throws(()=>parseMultiwayCoordinateTravel(earlierLog,cycles,earlier));controls.push('actual known-pair trace does not qualify three kingdoms');
if(m.fourthRegionInput){
 const previous=JSON.parse(await readFile('output/native-coordinate-multiway-attempt-001.json','utf8'));
 const previousLog=await readFile(previous.log,'utf8');
 assert.throws(()=>parseMultiwayCoordinateTravel(previousLog,cycles,m));
 controls.push('actual three-kingdom trace does not qualify four kingdoms');
}
const sources={};for(const name of ['scripts/check-native-coordinate-multiway-controls.mjs','scripts/lib/multiway-coordinate-travel.mjs','web/world/coordinate-travel.mjs','tests/coordinate-travel.test.mjs'])sources[name]=sha(await readFile(name));
await writeFile(out,JSON.stringify({version:1,qualified:true,sourceManifest:proof.sourceManifest,sourceManifestSha256:proof.sourceManifestSha256,
  logSha256:m.logSha256,sourceSha256:sources,fulfilledNeighborRequests:passing.fulfilledNeighborRequests,actualNativeRefusals:passing.actualRefusals,
  contradictoryActualTraceControls:controls,browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,controls:controls.length,actualNativeRefusals:passing.actualRefusals.length}));
