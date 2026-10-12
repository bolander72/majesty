import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {checkpointUnitAgentLinks} from '../web/world/checkpoint.mjs';
import {checkpointNewrecruitMarkerClockPlan} from '../web/world/newrecruit-marker-clock.mjs';

// Private original records stay in ignored native fixtures. Portable runs skip
// these integration cases when the original producer is absent; they do not
// replace that evidence with fabricated effect bytes or a test bypass.
async function bounded(name, maximum) {
  assert.ok((await stat(name)).size <= maximum); return readFile(name);
}
let producer;
try {
  producer = JSON.parse(await bounded(new URL('../output/native-marker-clock-attempt-004.json', import.meta.url), 256*1024));
  assert.equal(producer.nativeSessionTerminal, true); assert.equal(producer.nativeExitCode, 0);
} catch(e) { if(e.code !== 'ENOENT') throw e; }
const skip = !producer && 'Requires original native004 marker records';
const chunk = (tag, data=Buffer.alloc(0), version=0, count=0) => {
  const h=Buffer.alloc(16); h.write(tag); h.writeUInt32LE(data.length,4);
  h.writeUInt32LE(version,8); h.writeUInt32LE(count,12); return Buffer.concat([h,data]);
};
async function input(index=0, change) {
  const prefix=`Marker_${String(index).padStart(3,'0')}_`;
  const pick=suffix=>producer.records.find(r=>r.filename.endsWith(prefix+suffix)).filename;
  const effect=Buffer.from(await bounded(pick('Effect.UNIT'),4096));
  const orders=Buffer.from(await bounded(pick('Orders.bin'),4096));
  change?.(effect,orders);
  const owner=Buffer.alloc(4); owner.writeUInt32LE(effect.readUInt32LE(36));
  const bytes=Buffer.concat([chunk('VERS',Buffer.alloc(256),1),
    ...['BLDG','VHCL','GRND','RWRD','MSGF','OFMP'].map(t=>chunk(t,t==='VHCL'?effect:undefined,0,t==='VHCL'?1:0)),
    chunk('ORDR',Buffer.concat([owner,chunk('ORDR',chunk('PRIM',orders,2),0,1)]),1,1),chunk('CONT',undefined,1)]);
  let maxRead=0,active=0,peak=0;
  const source={size:bytes.length,async readAt(at,n) {
    assert.ok(n<=4096&&at>=0&&at+n<=bytes.length); maxRead=Math.max(maxRead,n); peak=Math.max(peak,++active);
    await Promise.resolve(); --active; return Uint8Array.from(bytes.subarray(at,at+n));
  }};
  let child; for await(const u of checkpointUnitAgentLinks(source)) child=u;
  return {source,child,bytes,effect,orders,stats:()=>({maxRead,peak})};
}
const clocks={sourceClockMs:25800,destinationClockMs:18250};

test('all twelve original living frame states preserve dispatch age with one timestamp patch', {skip}, async()=>{
  for(let index=0;index<24;++index) {
    const f=await input(index),before=Buffer.from(f.bytes),advance=index*50;
    const p=await checkpointNewrecruitMarkerClockPlan(f.source,f.child,
      {sourceClockMs:25800+advance,destinationClockMs:18250+advance});
    assert.equal(p.effectState,Math.floor(index/2)); assert.equal(p.elapsed,advance%100);
    assert.equal(p.patches.length,1); assert.equal(p.patches[0].before,25800+Math.floor(advance/100)*100);
    assert.equal(p.patches[0].after,18250+Math.floor(advance/100)*100);
    assert.equal(p.destinationImportQualified,false); assert.equal(p.completeOrderMigration,false);
    assert.deepEqual(f.bytes,before); assert.ok(f.stats().maxRead<=4096); assert.equal(f.stats().peak,1);
  }
});
test('native ID and physical parent aliases are the only excluded UNIT fingerprint fields', {skip}, async()=>{
  const f=await input(0,e=>{e.writeUInt32LE(100001,36);e.writeUInt32LE(100000,56);});
  assert.equal((await checkpointNewrecruitMarkerClockPlan(f.source,f.child,clocks)).effectState,0);
  for(const at of [40,44,48,52,60,64,68,72,76,84,88,100,120,150]) {
    const changed=await input(0,e=>{e[at]^=1;});
    await assert.rejects(checkpointNewrecruitMarkerClockPlan(changed.source,changed.child,clocks),/Unqualified/);
  }
  const dead=await input(24); await assert.rejects(checkpointNewrecruitMarkerClockPlan(dead.source,dead.child,clocks),/Unqualified/);
});
test('unknown flags, callbacks, opaque command bytes and a different bank refuse', {skip}, async()=>{
  for(let i=0;i<44;++i) {
    if(i===5) continue;
    const f=await input(0,(_,o)=>o.writeUInt32LE((o.readUInt32LE(24+i*4)+1)>>>0,24+i*4));
    await assert.rejects(checkpointNewrecruitMarkerClockPlan(f.source,f.child,clocks));
  }
  const f=await input(0,(_,o)=>{const body=Buffer.from(o.subarray(24,200));o.fill(0);o.writeUInt32LE(1,0);o.writeUInt32LE(1,4);
    o.writeUInt32LE(1,8);o.writeUInt32LE(5,12);body.copy(o,16);o.writeUInt32LE(1,192);o.writeUInt32LE(1,200);});
  await assert.rejects(checkpointNewrecruitMarkerClockPlan(f.source,f.child,clocks));
});
test('due, future and ambiguous ages refuse, and bounded pending age is preserved', {skip}, async()=>{
  const f=await input();
  for(const sourceClockMs of [25799,25900,0xffffffff,-1,NaN])
    await assert.rejects(checkpointNewrecruitMarkerClockPlan(f.source,f.child,{...clocks,sourceClockMs}));
  const p=await checkpointNewrecruitMarkerClockPlan(f.source,f.child,{sourceClockMs:25899,destinationClockMs:18250});
  assert.equal(p.elapsed,99); assert.equal(p.patches[0].after,18151);
  assert.equal((18250-p.patches[0].after)>>>0,(25899-p.patches[0].before)>>>0);
});
test('changed effect identity, timestamp, framing or bank bytes invalidate qualification', {skip}, async()=>{
  for(const changed of ['identity','timestamp','framing','payload']) {
    const f=await input(); let seen=0;
    const source={size:f.source.size,async readAt(at,n) {
      const b=await f.source.readAt(at,n);
      if(changed==='identity'&&at===f.child.offset&&n===151)new DataView(b.buffer).setUint32(36,504,true);
      // The clock iterator rereads this fixed entry after shape validation.
      if(changed==='timestamp'&&n===176&&++seen===2)new DataView(b.buffer).setUint32(20,25801,true);
      if(changed==='framing'&&n===244)new DataView(b.buffer).setUint32(16,2,true);
      if(changed==='payload'&&n===244)new DataView(b.buffer).setUint32(40,1,true);
      return b;
    }};
    await assert.rejects(checkpointNewrecruitMarkerClockPlan(source,f.child,clocks),/changed|Unqualified/);
  }
});
