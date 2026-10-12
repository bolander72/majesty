#!/usr/bin/env node
// An original UI recruit saved after the action, with its actual reciprocal home.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {inspectNativeHaloRegion} from './inspect-native-halo-region.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAgentValues} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {nativeHeightBits} from '../web/world/native-height.mjs';
import {haloSharedVertex,haloTerrainHeight} from '../web/world/halo-region-layout.mjs';
import {registerCheckpointGuildHome} from '../web/world/hero-home.mjs';
import {verifyRegisteredHeroSnapshot} from '../web/world/entity-home-ownership.mjs';
import {Sha256} from '../web/world/sha256.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
const digest=value=>new Sha256().update(new TextEncoder().encode(JSON.stringify(value))).hex();
export async function inspectNativeHaloRecruitment(name){
  const generation=await inspectNativeHaloRegion(name),m=JSON.parse(await readFile(name,'utf8'));
  assert.equal(m.region,'0_0');assert.equal(m.recruitScripted,true);assert.equal(m.playerCheckpoints.length,1);
  const saved=m.playerCheckpoints[0];assert.equal(saved.filename,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Frontier_0_0.GMP'));
  const info=await hashNativeFile(saved.filename,{maximum:64*1024*1024});assert.equal(info.sha256,saved.sha256);assert.equal(info.bytes,saved.bytes);
  const marker=m.playerCheckpointMarker;assert.equal(marker.filename,join(m.profile,'Frontier_0_0.checkpoint'));
  assert.ok((await stat(marker.filename)).size<=256);assert.equal(await hash(marker.filename),marker.sha256);
  const content='654365fd1bdefa6d7f2349d162869f255388fadcb1bb8db9f7db2f3468dd5542:'+m.nativeExecutableSha256;
  assert.equal(await readFile(marker.filename,'utf8'),`checkpoint-v1\n0\n${saved.bytes}\n${saved.sha256}\n${content}\n`);
  const log=await readFile(m.log,'utf8');
  assert.equal(log.split('\n').filter(l=>l==='[frontier] Region 0_0 checkpoint saved').length,1);
  assert.ok(log.split('\n').includes('[smoke] named action frontier-checkpoint: queued'));
  const source=await stoppedFileSource(saved.filename),clock=await checkpointSavedClock(source);assert.ok(clock>20000);
  const initial=await stoppedFileSource(m.checkpoint.filename),before=[],after=[];
  for await(const u of checkpointUnitAgentLinks(initial))if(u.family==='VHCL'&&u.playerNumber===0&&u.description===0x314c5641)before.push(u);
  for await(const u of checkpointUnitAgentLinks(source))if(u.family==='VHCL'&&u.playerNumber===0&&u.description===0x314c5641)after.push(u);
  assert.equal(before.length,0);assert.equal(after.length,1);const hero=after[0];assert.equal(hero.stateFlags&4,0);
  assert.equal(hero.parentUnitId,469);const actor=await checkpointActorRecords(source,hero.unitId);assert.equal(actor.agent.agentId,hero.agentId);
  let rest,title;
  for await(const v of checkpointAgentValues(source,hero.agentId)){
    if(v.attribute.toLowerCase()==='title'&&!v.path.length){assert.equal(v.type,3);assert.ok(v.stringBytes<=32);title=new TextDecoder().decode(await source.readAt(v.offset,v.stringBytes));}
    if(v.attribute.toLowerCase()==='activescript'&&!v.path.length){assert.equal(v.type,8);assert.deepEqual(v.functions.map(f=>f.name),['Rest_at_guild']);
      const raw=await source.readAt(v.stateOffset,16),view=new DataView(raw.buffer,raw.byteOffset,raw.length);rest=Array.from({length:4},(_,i)=>view.getUint32(i*4,true));}
  }
  assert.equal(title,'Warrior');assert.ok(rest);assert.equal(rest[0],30000);assert.equal(rest[2],2);assert.equal(rest[3],0);
  assert.ok(rest[1]>0&&rest[1]<=clock&&clock-rest[1]<rest[0]);
  const worldId=digest(['majesty-halo-world-v1',m.fixture,m.checkpoint.sha256,generation.layout]),contentDigest=digest(content);
  const registeredHome=await registerCheckpointGuildHome(source,{worldId,contentDigest,region:m.region,guildUnitId:469});
  assert.equal(registeredHome.home.agentId,7);assert.equal(registeredHome.members.length,1);
  const member=registeredHome.members[0];assert.equal(member.unitId,hero.unitId);assert.equal(member.agentId,hero.agentId);
  const identity={entityId:member.entityId,contentDigest,regions:[m.region],actor:{family:'VHCL',playerNumber:0},registeredHome};
  await verifyRegisteredHeroSnapshot(identity,{unitId:hero.unitId,agentId:hero.agentId},{kind:'native',unitId:469,agentId:7},source,true,m.region);
  const terrain=await checkpointTerrain(source);assert.equal(terrain.width,128);assert.equal(terrain.height,128);let shared=0;
  for(let y=0;y<=128;++y){const row=await source.readAt(terrain.heightOffset(0,y),1161),view=new DataView(row.buffer,row.byteOffset,row.length);
    for(let x=0;x<=128;++x)if(haloSharedVertex(x,y)){assert.equal(view.getUint32(x*9,true),nativeHeightBits(haloTerrainHeight(m.region,x,y)));shared++;}}
  assert.equal(shared,2480);assert.equal(await hash(saved.filename),saved.sha256);
  assert.ok(m.recruitFrame);assert.equal(await hash(m.recruitFrame.filename),m.recruitFrame.sha256);
  return {version:1,originalNativeHaloRecruitmentQualified:true,manifest:resolve(name),manifestSha256:await hash(name),generation,
    sourceCheckpoint:saved,sourceClockMs:clock,hero:{unitId:hero.unitId,agentId:hero.agentId,description:hero.description,physicalParentUnitId:hero.parentUnitId},
    registeredHome,originalRest:{delayMs:rest[0],stampMs:rest[1],flags:rest[2],remainderMs:rest[3],expiresClockMs:rest[1]+rest[0]},
    sharedVertices:shared,originalPlayerCheckpointSelected:true,originalHeroAiUnmodified:true,
    cameraFrame:m.frame,recruitFrame:m.recruitFrame,maximumTerrainRowBytes:1161,
    inspectorSha256:await hash('scripts/inspect-native-halo-recruitment.mjs'),
    outdoorHeroQualified:false,nativeActorCrossingQualified:false,ownershipTransferQualified:false,browserUsed:false,goalComplete:false};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const[name,output]=process.argv.slice(2);assert.equal(process.argv.length,4);const result=await inspectNativeHaloRecruitment(name);
  await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({originalNativeHaloRecruitmentQualified:true,hero:result.hero,sourceClockMs:result.sourceClockMs}));
}
