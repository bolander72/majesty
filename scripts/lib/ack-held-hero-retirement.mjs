// Private native receipt controls for the exact published remote-owner capture.
// Never acknowledge retirement before its immutable publication report exists.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,open,rename} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {nativeHeroArrivalReady,nativeHeroArrivalPublished} from '../../web/world/hero-travel-publication.mjs';
import {hashNativeFile} from './native-generation.mjs';
import {stageSelectedHeroHome} from './stage-selected-hero-home.mjs';
import {stageSelectedHeroPublicDeparture} from './stage-selected-hero-public-departure.mjs';
import {publishHeldHeroHomeArrival} from './publish-held-hero-home-arrival.mjs';

export async function acknowledgeHeldHeroRetirement(m,first,second){
 assert.equal(m.retireRemoteSource,true);assert.equal(second.nativeHeldSecondHeroCapturePublished,true);
 const report=join(m.fixture,'remote-retirement.json');await assert.rejects(lstat(report),e=>e.code==='ENOENT');
 const target=join(m.fixture,'frontier_1_0/Frontier_Hero_Capture_Published.txt');
 const fields={serial:second.held.serial,region:second.held.region,clock:second.held.clock,
  unitId:second.owner.unitId,agentId:second.owner.agentId,homeAgentId:second.homeAlias.agentId,size:second.captured.bytes,sha256:second.captured.sha256};
 const packet=(change={},manifest=second.ownerManifest)=>nativeHeroArrivalPublished(nativeHeroArrivalReady({...fields,...change}),manifest)
  .replace(/^majesty-hero-travel-published-v1\|/,'majesty-hero-capture-published-v1|');
 async function write(text){const temp=target+'.tmp',f=await open(temp,'wx');
  try{await f.writeFile(text);await f.sync();}finally{await f.close();}await rename(temp,target);
  const d=await open(dirname(target),'r');try{await d.sync();}finally{await d.close();}}
 async function lines(){process.kill(m.nativePid,0);assert.ok((await lstat(m.log)).size<m.logCeilingBytes);return readFile(m.log,'utf8');}
 const refused='[frontier] Hero captured publication refused serial=2 region=1_0 clock='+fields.clock+' phase=7 pending=0';
 const completed='[frontier] Hero remote source retirement completed serial=2 region=1_0 unit='+fields.unitId+' agent='+fields.agentId+' proxy='+fields.homeAgentId+' clock='+fields.clock;
 const count=text=>text.split(refused).length-1,controls=[];
 for(const[kind,change,manifest]of [['wrong-clock',{clock:fields.clock+50}],['wrong-native-alias',{unitId:fields.unitId+1}],
  ['wrong-capture-digest',{sha256:'0'.repeat(64)}],['unselected-arrival-head',{},first.publicationReceipt.ownerManifest]]){
  const acknowledgement=packet(change,manifest??second.ownerManifest),before=count(await lines());await write(acknowledgement);let seen=false;
  for(let i=0;i<60;i++){const log=await lines();assert.ok(!log.includes(completed));if(count(log)>before){seen=true;break;}await new Promise(r=>setTimeout(r,50));}
  assert.equal(seen,true,kind+' not refused');controls.push({kind,acknowledgement,refusedByEngine:true,clock:fields.clock,phase:7,pending:0});
 }
 const destination=m.publicTravel?await stageSelectedHeroHome(m,first,second,{beforeDeparture:true}):null;
 const acknowledgement=packet();await write(acknowledgement);
 if(destination)await stageSelectedHeroPublicDeparture(m,second,destination.returnArrival);
 let completion;
 for(let i=0;i<100;i++){const log=await lines();const matches=log.split('\n').filter(v=>v.startsWith(completed));assert.ok(matches.length<=1);
  if(matches.length){completion=matches[0];break;}await new Promise(r=>setTimeout(r,50));}
 assert.ok(completion,'Remote source retirement was not completed');
 for(const r of [second.captured,second.marker]){const actual=await hashNativeFile(r.filename);assert.equal(actual.bytes,r.bytes);assert.equal(actual.sha256,r.sha256);}
 for(const[n,h]of Object.entries(second.journalSha256))assert.equal((await hashNativeFile(join(second.journal,n))).sha256,h);
 const result={version:1,nativeRemoteHeroRetirementAcknowledged:true,nativePid:m.nativePid,fixture:m.fixture,
  secondPublication:{filename:join(m.fixture,'second-publication.json'),...await hashNativeFile(join(m.fixture,'second-publication.json'))},
  acknowledgement,controls,completion,capturedRecoveryPreserved:true,journalUnchanged:true,nativeResumeAcknowledged:false,
  retiredPairPublished:false,sourceUnloaded:false,secondDestinationLoaded:false,browserUsed:false,goalComplete:false};
 await writeFile(report,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({nativeRemoteHeroRetirementAcknowledged:true,clock:fields.clock,refusedControls:controls.length,capturedRecoveryPreserved:true}));
 if(destination)await publishHeldHeroHomeArrival(m,first,second);
 else if(m.pageHome)await stageSelectedHeroHome(m,first,second);
}
