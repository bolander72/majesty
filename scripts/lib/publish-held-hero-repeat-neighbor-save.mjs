// Save the continued home kingdom in the same supervised native journey.
// Native-ready must name the actual post-gameplay original checkpoint.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat,open,rename,readdir,mkdtemp} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {hashNativeFile} from './native-generation.mjs';
import {stoppedFileSource} from './stopped-entity-io.mjs';
import {stoppedHeroRouteStorage} from './stopped-hero-route-io.mjs';
import {HeroRouteStore} from '../../web/world/hero-route-store.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalReady,nativeHeroArrivalPublished} from '../../web/world/hero-travel-publication.mjs';
import {publishHeldHeroOwnerCheckpoint} from '../../web/world/hero-owner-checkpoint-publication.mjs';
import {publishHeldHeroRepeatReturnCapture} from './publish-held-hero-repeat-return-capture.mjs';
const descriptor=async filename=>({filename,...await hashNativeFile(filename)});
const operation=v=>createHash('sha256').update(JSON.stringify(v)+'\n').digest('hex');
export async function publishHeldHeroRepeatNeighborSave(m,first,home){
 assert.equal(m.saveRepeatNeighbor,true);assert.equal(m.nativeSessionTerminal,false);
 const output=join(m.fixture,'repeat-neighbor-save-publication.json');await assert.rejects(lstat(output),e=>e.code==='ENOENT');
 async function log(){process.kill(m.nativePid,0);assert.ok((await lstat(m.log)).size<m.logCeilingBytes);return readFile(m.log,'utf8');}
 let packet;
 for(let i=0;i<160;i++){const lines=await log(),matches=[...lines.matchAll(/^\[frontier\] Hero repeated neighbor save held receipt=(majesty-hero-travel-ready-v1\|5\|1_0\|\S+) phase=7 pending=0 ordinary-ticks=0$/gm)];
  assert.ok(matches.length<=1);if(matches.length){packet=matches[0][1];break;}await new Promise(r=>setTimeout(r,50));}
 assert.ok(packet,'Continued native-home checkpoint readiness missing');const ready=parseNativeHeroArrivalReady(packet),previous=home.publicationReceipt;
 assert.equal(ready.clock,previous.clock+100);assert.equal(ready.region,'1_0');assert.equal(ready.serial,5);
 assert.deepEqual({unitId:ready.unitId,agentId:ready.agentId},previous.owner);assert.equal(ready.homeAgentId,previous.home.agentId);
 const profile=join(m.fixture,'frontier_1_0');let marker=await descriptor(join(profile,'Frontier_1_0.checkpoint'));
 const nativeManifest=await readFile(marker.filename,'utf8');
 assert.equal(nativeManifest,['checkpoint-v1','0',ready.size,ready.sha256,
  '654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256,''].join('\n'));
 if(m.repeatReturn){const backup=join(profile,'Hero_Repeat_Neighbor_Continued.checkpoint');await writeFile(backup,nativeManifest,{flag:'wx'});marker=await descriptor(backup);}
 const captured=await descriptor(join(profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_1_0.GMP'));
 assert.equal(captured.bytes,ready.size);assert.equal(captured.sha256,ready.sha256);
 const beforeJournal=await mkdtemp(join(dirname(home.journal),'actor-arrival-fixture-hero-route-before-repeat-save-'));
 assert.deepEqual((await readdir(home.journal)).sort(),Object.keys(home.journalSha256).sort());
 for(const[n,h]of Object.entries(home.journalSha256)){const f=await open(join(beforeJournal,n),'wx');let at=0;
  try{const result=await hashNativeFile(join(home.journal,n),{sink:async bytes=>{
   for(let i=0;i<bytes.length;){const {bytesWritten}=await f.write(bytes,i,bytes.length-i,at);assert.ok(bytesWritten);i+=bytesWritten;at+=bytesWritten;}
  }});assert.equal(result.sha256,h);await f.sync();}finally{await f.close();}}
 const stats={},io=await stoppedHeroRouteStorage(home.journal,stats),store=new HeroRouteStore(io,first.identity,first.identity.contentDigest);
 const request=()=>({operationId:operation(['native-continued-neighbor',previous.ownerManifest,captured.sha256]),expectedManifest:previous.ownerManifest,
  region:ready.region,alias:previous.owner,homeAlias:previous.home,clock:ready.clock,sha256:captured.sha256});
 const source=()=>stoppedFileSource(captured.filename),controls=[];
 for(const[kind,change]of [['old-native-alias',{alias:{unitId:508,agentId:25}}],
  ['native-guild-in-foreign-region',{homeAlias:{kind:'native',unitId:469,agentId:7}}],['wrong-held-clock',{clock:ready.clock+1}],
  ['stale-return-head',{expectedManifest:first.publicationReceipt.ownerManifest}],['changed-capture-digest',{sha256:'0'.repeat(64)}]]){
  const writes=stats.writes??0;await assert.rejects(publishHeldHeroOwnerCheckpoint(store,{...request(),...change,source:await source()}));
  assert.equal(stats.writes??0,writes);assert.equal((await store.read()).record.manifest,previous.ownerManifest);
  controls.push({kind,refused:true,additionalWrites:0});
 }
 const ackName=join(profile,'Frontier_Hero_Capture_Published.txt');
 async function ack(text){const temp=ackName+'.tmp',f=await open(temp,'wx');
  try{await f.writeFile(text);await f.sync();}finally{await f.close();}await rename(temp,ackName);
  const d=await open(dirname(ackName),'r');try{await d.sync();}finally{await d.close();}}
 const refused=`[frontier] Hero captured publication refused serial=5 region=1_0 clock=${ready.clock} phase=7 pending=0`;
 const accepted='[frontier] Hero repeated neighbor save accepted serial=5 region=1_0 ',count=v=>v.split(refused).length-1,nativeControls=[];
 const acknowledgement=(change={},manifest=previous.ownerManifest)=>nativeHeroArrivalPublished(nativeHeroArrivalReady({...ready,...change}),manifest)
  .replace(/^majesty-hero-travel-published-v1\|/,'majesty-hero-capture-published-v1|');
 for(const[kind,change]of [['wrong-clock',{clock:ready.clock+50}],['wrong-native-alias',{unitId:ready.unitId+1}],
  ['wrong-native-guild',{homeAgentId:7}],['wrong-checkpoint-digest',{sha256:'0'.repeat(64)}],['unpublished-save',{}]]){
  const text=acknowledgement(change),before=count(await log());await ack(text);let seen=false;
  for(let i=0;i<60;i++){const lines=await log();assert.ok(!lines.includes(accepted));if(count(lines)>before){seen=true;break;}await new Promise(r=>setTimeout(r,50));}
  assert.equal(seen,true,kind+' not refused by held engine');nativeControls.push({kind,acknowledgement:text,refusedByEngine:true,clock:ready.clock,phase:7,pending:0});
 }
 const receipt=await publishHeldHeroOwnerCheckpoint(store,{...request(),source:await source()});assert.equal(receipt.ownerRevision,8);
 const writes=stats.writes,retry=await publishHeldHeroOwnerCheckpoint(store,{...request(),source:await source()});assert.equal(retry.idempotent,true);assert.equal(stats.writes,writes);
 const journalSha256={};for(const n of (await readdir(home.journal)).sort())journalSha256[n]=(await hashNativeFile(join(home.journal,n))).sha256;
 const text=acknowledgement({},receipt.ownerManifest);
 const result={version:1,nativeContinuedHeroNeighborSavePublished:true,nativePid:m.nativePid,fixture:m.fixture,
  neighborPublication:await descriptor(join(m.fixture,'repeat-neighbor-publication.json')),journal:home.journal,beforeJournal,beforeJournalSha256:home.journalSha256,journalSha256,
  expectedManifest:previous.ownerManifest,ready:packet,captured,marker,nativeManifest,publicationReceipt:receipt,acknowledgement:text,
  controls,nativeControls,stats,exactRetryWrites:0,nativeReceiptConsumed:false,neighborContinuedSaveResumed:false,
  browserUsed:false,realOPFSDurabilityQualified:false,repeatedTripsQualified:false,goalComplete:false};
 await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});await ack(text);
 console.log(JSON.stringify({nativeContinuedHeroNeighborSavePublished:true,ownerRevision:8,zeroWriteControls:controls.length,refusedNativeReceipts:nativeControls.length}));
 if(m.repeatReturn)await publishHeldHeroRepeatReturnCapture(m,first,result);
}
