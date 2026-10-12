#!/usr/bin/env node
// Derive a fresh import from THIS session's held original writer records. The
// preserved return preparation supplies qualified layouts and clock patches;
// no pre-imported world or actor is copied into the receiving home profile.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {workspace,ownedDirectory,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {checkpointActorRecords,checkpointUnitAgentLinks,checkpointAgentRecord,checkpointAgentRecordValues,checkpointAttachments} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256,sha=b=>createHash('sha256').update(b).digest('hex');
async function json(n){assert((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
const memory=b=>({size:b.length,async readAt(at,n){assert(n<=4096&&at+n<=b.length);return Uint8Array.from(b.subarray(at,at+n));}});
export async function deriveNativeSessionHomeImport(m){
  assert(m.liveImport);const root=await ownedDirectory(m.fixture,'actor-arrival-fixture-session-home-');
  assert.equal(m.worldRoot,join(root,'actor-arrival-fixture-outdoor-family-snapshot-bridge/native-world-home'));
  const prep=await json(m.preparation);assert.equal(await hash(m.preparation),m.preparationSha256);
  const homeProof=await json(m.homeProof),homeProducer=await json(homeProof.manifest),templateName=homeProducer.preparation;
  const archive=await json(m.homeArchive);assert.equal(await hash(m.homeArchive),m.homeArchiveSha256);
  async function frozen(n,h){const r=archive.evidence[resolve(n)];assert(r);if(h)assert.equal(r.sha256,h);assert.equal(await hash(n),r.sha256);assert.equal(await hash(r.filename),r.sha256);}
  await frozen(templateName);const template=await json(templateName);assert.equal(template.homeReturnPreparationQualified,true);
  const heldName=join(m.profiles['1_0'],'Documents/My Games/MajestyHD/SaveGame/Family_Remote_Held.GMP');
  const held=await stoppedFileSource(heldName);assert.equal(await checkpointSavedClock(held),26350);
  const heroId=prep.route.owner.unitId,agentId=prep.route.owner.agentId,sourceIds=[504,527,528,529],ids=[heroId,heroId+1,heroId+2,heroId+3];
  const actor=await checkpointActorRecords(held,heroId);assert.equal(actor.agent.agentId,agentId);assert.equal(actor.unit.parentUnitId,0);
  const attachments=new Map();for await(const a of checkpointAttachments(held))if(ids.includes(a.unitId))attachments.set(`${a.kind}:${a.unitId}`,a);
  const units=new Map();for await(const u of checkpointUnitAgentLinks(held))if(ids.includes(u.unitId))units.set(u.unitId,u);assert.equal(units.size,4);
  const captured=[],records=[];
  async function current(suffix){const filename=join(m.profiles['1_0'],'Family_Route_After_'+suffix);assert((await stat(filename)).size<=65536);
    const bytes=await readFile(filename);captured.push({filename,sha256:sha(bytes),bytes:bytes.length});return Buffer.from(bytes);}
  async function emit(name,bytes,details={}){
    const reference=template.records.find(r=>basename(r.filename)===name);assert(reference);await frozen(reference.filename,reference.sha256);
    assert.deepEqual(bytes,await readFile(reference.filename),'Current held record differs from qualified return layout: '+name);
    records.push({name,bytes:Buffer.from(bytes),sha256:sha(bytes),...details});
  }
  for(let i=0;i<4;++i){
    const unit=await current(sourceIds[i]+'.UNIT');const u=units.get(ids[i]);assert(u);
    assert.deepEqual(unit,Buffer.from(await held.readAt(u.offset,u.size)));
    assert.equal(unit.readUInt32LE(36),ids[i]);unit.writeUInt32LE(sourceIds[i],36);
    assert.equal(unit.readUInt32LE(56),i?heroId:0);unit.writeUInt32LE(i?504:0,56);
    if(!i){let at=92+(unit.readUInt32LE(80)?16:0),count=unit.readUInt32LE(at+4);at+=8;let found=0;
      for(let k=0;k<count;++k,at+=8)if(unit.readUInt32LE(at)===0x4541){assert.equal(unit.readUInt32LE(at+4),agentId);unit.writeUInt32LE(28,at+4);found++;}assert.equal(found,1);}
    await emit(`Family_Proposal_${sourceIds[i]}.UNIT`,unit,{kind:'UNIT',currentUnitId:ids[i]});
    const orders=await current(sourceIds[i]+'_Orders.bin'),a=attachments.get(`ORDR:${ids[i]}`);assert(a);
    assert.deepEqual(orders,Buffer.from(await held.readAt(a.primary.offset+16,a.primary.size)));
    const reference=template.records.find(r=>basename(r.filename)===`Family_Proposal_${sourceIds[i]}_Orders.bin`);assert(reference);
    const patches=[];for(const p of reference.clockPatches){assert.equal(orders.readUInt32LE(p.offset),p.before);
      const after=(57650-((prep.pauseAnchorClockMs-p.before)>>>0))>>>0;assert.equal(after,p.after);orders.writeUInt32LE(after,p.offset);patches.push({...p});}
    await emit(`Family_Proposal_${sourceIds[i]}_Orders.bin`,orders,{kind:'ORDR',currentUnitId:ids[i],clockPatches:patches});
  }
  const script=await current('Agent.GPL');assert.deepEqual(script,Buffer.from(await held.readAt(actor.agent.offset,actor.agent.size)));
  const scriptRecord=await checkpointAgentRecord(memory(script));assert.equal(scriptRecord.agentId,agentId);assert.equal(scriptRecord.unitId,heroId);
  const contexts=[];for await(const v of checkpointAgentRecordValues(memory(script))){
    if(v.type===5&&v.targetAgentId){assert([agentId,45].includes(v.targetAgentId));script.writeUInt32LE(v.targetAgentId===agentId?28:7,v.offset);}
    if(v.type===8){assert.equal(v.flag,0);contexts.push({attribute:v.attribute,state:Array.from({length:4},(_,i)=>script.readUInt32LE(v.stateOffset+i*4)),functions:v.functions.map(f=>f.name)});}
  }
  assert.equal(contexts.length,12);assert.deepEqual(contexts.filter(v=>v.state[2]),[{attribute:'activescript',state:[300,57650,2,0],functions:['travel_to']}]);
  script.writeUInt32LE(28,script.length-24-Buffer.byteLength(scriptRecord.name));script.writeUInt32LE(504,script.length-19);
  await emit('Family_Proposal_Agent.GPL',script,{kind:'GPL',currentAgentId:agentId});
  const internal=await current('Container.bin'),cont=attachments.get(`CONT:${heroId}`);assert(cont);
  assert.deepEqual(internal,Buffer.from(await held.readAt(cont.primary.offset+16,cont.primary.size)));
  assert.equal(internal.length,48);assert.equal(internal.readUInt32LE(20),heroId);internal.writeUInt32LE(504,20);
  for(let i=1;i<4;++i){assert.equal(internal.readUInt32LE(16+i*8),ids[i]);internal.writeUInt32LE(sourceIds[i],16+i*8);}
  const full=Buffer.alloc(72);[1,2,1,1,101,504,469,1].forEach((n,i)=>full.writeUInt32LE(n,i*4));internal.copy(full,32,8);
  await emit('Family_Proposal_Container.bin',full,{kind:'CONT-home-and-children'});
  await emit('Family_Source_Container.bin',full,{kind:'CONT-home-and-children'});
  const binding=Buffer.alloc(48);[0x31525246,1,57650,504,28,469,7,24250,heroId,agentId,0,0].forEach((n,i)=>binding.writeUInt32LE(n,i*4));
  await emit('Family_Return_Binding.bin',binding,{kind:'registered-home-binding'});
  return {held:{filename:heldName,sha256:await hash(heldName),bytes:held.size,clock:26350},captured,records,
    templatePreparation:templateName,templatePreparationSha256:await hash(templateName),sourceManifest:prep.selectedManifest,
    sourceUnitIds:ids,sourceAgentId:agentId,pauseAnchorClockMs:prep.pauseAnchorClockMs,homeClockMs:57650};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);const m=await json(name);assert.equal(m.nativeSessionTerminal,false);process.kill(m.nativePid,0);
  const prepared=await deriveNativeSessionHomeImport(m),records=[];
  for(const r of prepared.records){const filename=join(m.profiles['0_0'],r.name);await writeFile(filename,r.bytes,{flag:'wx'});records.push({...r,filename,bytes:r.bytes.length});}
  process.kill(m.nativePid,0);const sourceSha256={};for(const n of ['scripts/prepare-native-session-home-import.mjs','web/world/checkpoint.mjs'])sourceSha256[n]=await hash(join(workspace,n));
  await writeFile(out,JSON.stringify({...prepared,records,version:1,currentSessionHomeImportPrepared:true,nativePid:m.nativePid,nativeAliveBeforeAndAfterPreparation:true,
    sourceSha256,browserUsed:false},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({currentSessionHomeImportPrepared:true,records:records.length,nativePid:m.nativePid}));
}
