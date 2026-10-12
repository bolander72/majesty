import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {encodeRemoteHomeAgent,verifyRemoteHomeAgent,prepareRemoteHomeAgent,MAX_REMOTE_HOME_BYTES} from '../web/world/remote-home.mjs';
import {prepareOrReuseRemoteHomeAgent} from '../web/world/remote-home-cache.mjs';
import {encodeHomeRecord} from '../web/world/hero-home.mjs';
import {checkpointAgentRecord,checkpointAgentRecordValues} from '../web/world/checkpoint.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=v=>sha(JSON.stringify(v));
const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b;};
const env=(v,b)=>Buffer.concat([word(b.length+16),word(v),b,word(0),word(-1)]);
const chunk=(tag,b,v=0,count=0)=>Buffer.concat([Buffer.from(tag),word(b.length),word(v),word(count),b]);
function registered(){
  const origin=['a'.repeat(64),'c'.repeat(64),'0_0',469,7,'b'.repeat(64)];
  const record={version:1,worldId:origin[0],contentDigest:origin[1],guildEntityId:json(['majesty-home-guild-v1',...origin]),
    home:{region:'0_0',unitId:469,agentId:7,description:0x31564241,playerNumber:0,originCheckpointSha256:origin[5]},
    members:[{entityId:json(['majesty-home-member-v1',...origin,502,27]),unitId:502,agentId:27}],revision:0,previous:null,pending:null,lastOperation:null};
  return {record,sha256:sha(encodeHomeRecord(record))};
}
const source=b=>({size:b.length,async readAt(at,n){assert.ok(n<=4096);return new Uint8Array(b.subarray(at,at+n));}});
function destination(bytes,{badTail=false,extra=[],queue=[],nativeBacklink=false}={}) {
  const records=[...(bytes?[[1000,bytes]]:[]),...extra].sort((a,b)=>a[0]-b[0]);
  const manager=env(2,Buffer.concat([word(0),word(records.length),...records.flatMap(([id,b])=>[word(id),b]),
    word(queue.length),...queue.map(word),word(0),Buffer.from([badTail?2:0])]));
  const native=[];
  if(nativeBacklink){const header=Buffer.alloc(60);header.writeUInt32LE(1);header.writeUInt32LE(777,4);header.writeUInt32LE(77,16);
    native.push(chunk('BLDG',chunk('UNIT',chunk('PRIM',Buffer.concat([header,word(1),word(1),word(0x4541),word(1000),Buffer.alloc(8)]),9),0,1),0,1));}
  else native.push(chunk('BLDG',Buffer.alloc(0)));
  native.push(...['VHCL','GRND','RWRD','MSGF','OFMP'].map(tag=>chunk(tag,Buffer.alloc(0))));
  return source(Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('GPL ',env(3,Buffer.concat([word(0),manager,word(1001)])),1),...native]));
}
const options=r=>({worldId:r.record.worldId,contentDigest:r.record.contentDigest,destinationRegion:'1_0',freshAgentId:1000});
test('bounded pure record carries exact stable guild identity, no native unit, functions or agent references',async()=>{
  const r=registered(),bytes=encodeRemoteHomeAgent(r.record,1000),saved=await checkpointAgentRecord(source(bytes));
  assert.equal(bytes.length,453);assert.ok(bytes.length<=MAX_REMOTE_HOME_BYTES);
  assert.deepEqual([saved.agentId,saved.unitId,saved.deleted,saved.functionNameCount],[1000,0,false,0]);
  const values=await Array.fromAsync(checkpointAgentRecordValues(source(bytes)));
  assert.equal(values.length,9);assert.ok(values.every(v=>[1,3].includes(v.type)&&v.path.length===0));
  assert.deepEqual(values.map(v=>v.attribute),values.map(v=>v.attribute).sort());
  assert.equal((await verifyRemoteHomeAgent(source(bytes),r,1000)).guildEntityId,r.record.guildEntityId);
  const copied=Buffer.from(bytes);copied.writeUInt32LE(28,copied.length-24);
  assert.equal((await verifyRemoteHomeAgent(source(copied),r,28)).agentId,28);
  await assert.rejects(verifyRemoteHomeAgent(source(copied),r,1000),/inert pure/);
});
test('another-region proposal checks all destination agents and never substitutes a destination guild',async()=>{
  const r=registered(),result=await prepareRemoteHomeAgent(destination(),r,options(r));
  assert.equal(result.plan.destinationRegion,'1_0');assert.equal(result.plan.home.region,'0_0');
  assert.equal(result.plan.identityOffset,result.record.length-24);assert.equal(result.plan.heroCrossingQualified,false);
  await assert.rejects(prepareRemoteHomeAgent(destination(result.record),r,options(r)),/occupied/);
  await assert.rejects(prepareRemoteHomeAgent(destination(null,{badTail:true}),r,options(r)),/tail/);
});
test('same-region, foreign-world, stale registry and malformed proposals refuse before destination reads',async()=>{
  const r=registered(),never={size:1,readAt(){throw Error('unexpected read');}};
  await assert.rejects(prepareRemoteHomeAgent(never,r,{...options(r),destinationRegion:'0_0'}),/another region/);
  await assert.rejects(prepareRemoteHomeAgent(never,r,{...options(r),worldId:'e'.repeat(64)}),/identity|digest/);
  await assert.rejects(prepareRemoteHomeAgent(never,{...r,sha256:'e'.repeat(64)},options(r)),/registration changed/);
  for(const freshAgentId of [0,-1,0x80000000,1.5,'1000'])
    await assert.rejects(prepareRemoteHomeAgent(never,r,{...options(r),freshAgentId}),/proposal/);
});
test('native association, deletion, metadata identity and unsupported extra bytes cannot masquerade as a remote home',async()=>{
  const r=registered(),bytes=encodeRemoteHomeAgent(r.record,1000);
  const bad=[];
  for(const [offset,value] of [[bytes.length-19,469],[bytes.length-15,1]]) {
    const b=Buffer.from(bytes);if(offset===bytes.length-19)b.writeUInt32LE(value,offset);else b[offset]=value;bad.push(b);
  }
  const different=Buffer.from(bytes);const at=different.indexOf(Buffer.from(r.record.guildEntityId));different[at]^=1;bad.push(different);
  bad.push(Buffer.concat([bytes,word(0)]),bytes.subarray(0,-1));
  for(const b of bad)await assert.rejects(verifyRemoteHomeAgent(source(b),r,1000));
  await assert.rejects(verifyRemoteHomeAgent({size:1025,readAt(){throw Error('unexpected read');}},r,1000),/size/);
});
test('caller mutation during reads cannot silently change the decoded persistent identity',async()=>{
  const r=registered(),bytes=encodeRemoteHomeAgent(r.record,1000),before=r.record.guildEntityId;
  let once=false;const input={size:bytes.length,async readAt(at,n){if(!once){once=true;r.record.guildEntityId='e'.repeat(64);}return bytes.slice(at,at+n);}};
  const result=await verifyRemoteHomeAgent(input,r,1000);assert.equal(result.guildEntityId,before);
});
test('reuse keeps the original alias and payload across repeated admission without reserving another ID',async()=>{
  const r=registered(),bytes=encodeRemoteHomeAgent(r.record,1000);
  for(let i=0;i<16;i++) {
    const result=await prepareOrReuseRemoteHomeAgent(destination(bytes),r,{...options(r),freshAgentId:100001+i});
    assert.equal(result.plan.admission,'reuse-existing');assert.equal(result.plan.proposedAgentId,1000);
    assert.deepEqual(result.record,bytes);
  }
  const fresh=await prepareOrReuseRemoteHomeAgent(destination(),r,options(r));assert.equal(fresh.plan.admission,'reserve-new');
});
test('duplicate logical guilds, queued proxies and native backlinks refuse reuse',async()=>{
  const r=registered(),bytes=encodeRemoteHomeAgent(r.record,1000),options2={...options(r),freshAgentId:100000};
  await assert.rejects(prepareOrReuseRemoteHomeAgent(destination(bytes,{extra:[[1001,encodeRemoteHomeAgent(r.record,1001)]]}),r,options2),/Duplicate/);
  await assert.rejects(prepareOrReuseRemoteHomeAgent(destination(bytes,{queue:[1000]}),r,options2),/unscheduled/);
  await assert.rejects(prepareOrReuseRemoteHomeAgent(destination(bytes,{nativeBacklink:true}),r,options2),/native backlink/);
});
test('same guild with a corrupted origin or foreign world refuses rather than allocating a replacement',async()=>{
  const r=registered(),bytes=Buffer.from(encodeRemoteHomeAgent(r.record,1000));
  const start=bytes.indexOf(Buffer.from(r.record.worldId));bytes[start]^=1;
  await assert.rejects(prepareOrReuseRemoteHomeAgent(destination(bytes),r,{...options(r),freshAgentId:100000}),/identity differs/);
  const associated=Buffer.from(encodeRemoteHomeAgent(r.record,1000));associated.writeUInt32LE(469,associated.length-19);
  await assert.rejects(prepareOrReuseRemoteHomeAgent(destination(associated),r,{...options(r),freshAgentId:100000}),/inert pure/);
});
