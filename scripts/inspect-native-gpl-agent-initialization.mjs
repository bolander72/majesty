#!/usr/bin/env node
// Stopped original new-world saves; retain every actual serialized agent word.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {checkpointAgents} from '../web/world/checkpoint.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {inspectCoopWorld} from './inspect-native-coop-world.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function agentSavedScalars(filename){
 const source=await stoppedFileSource(resolve(filename)),rows=[];
 for await(const agent of checkpointAgents(source)){
  const word=Buffer.from(await source.readAt(agent.nativeIdOffset+5,4)).readUInt32LE(0);
  rows.push({agentId:agent.agentId,unitId:agent.unitId,serializedNativeOffset44Value:word});
 }
 assert.ok(rows.length>0&&rows.length<=5000);return rows;
}
export async function inspectNewAgentScalars(name){
 const path=resolve(name),raw=await readFile(path);assert.ok(raw.length<=2*1024*1024);
 const m=JSON.parse(raw),world=await inspectCoopWorld(path),snapshots=[];
 const log=await readFile(join(m.profile,'..','native.log'),'utf8');assert.ok(log.length<=4*1024*1024);
 const marker='[network] Original GPL agent saved scalar initialized offset=2c value=0 original-constructor=00625e70 saved-reader-preserved=1 result=pass';
 assert.equal(log.split('\n').filter(l=>l===marker).length,1);
 for(const snapshot of [...m.worldSnapshots,...(m.originalLoadedTargetSaved?[m.loadedTargetSnapshot]:[])]){
  const rows=await agentSavedScalars(snapshot.path);assert.ok(rows.every(r=>r.serializedNativeOffset44Value===0),'New agents must serialize zero in the formerly undefined field');
  snapshots.push({...snapshot,agentCount:rows.length,allSavedScalarsZero:true});
 }
 return{version:1,report:path,reportSha256:sha(raw),originalRole:world.originalRole,snapshots,actualNewAgentInitializationQualified:true,originalSavedReaderValuePreservationQualified:false,browserUsed:false,liveSecondOriginalEngine:false,scope:'Original new cooperative source/target worlds serialize deterministic newly constructed agent values. Existing saved-value preservation is qualified separately through original reader/regression evidence.'};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{assert.equal(process.argv.length,4);const p=await inspectNewAgentScalars(process.argv[2]);await writeFile(resolve(process.argv[3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({originalRole:p.originalRole,snapshots:p.snapshots.map(s=>({agents:s.agentCount,allSavedScalarsZero:true})),newAgentInitialization:true}));}catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0]}));process.exitCode=1;}}
