import test from 'node:test';
import assert from 'node:assert/strict';
import {CheckpointReadLease} from '../web/world/checkpoint-lease.mjs';

function lease(maximum=49){return new CheckpointReadLease({maximum,
  ended:'lease ended',bounds:'read bounds',truncated:'truncated source'});}
function source(size=8192){return {size,async readAt(at,n){return new Uint8Array(n).fill(at%256);}};}

test('a full native-region lease drops all sources even when callers retain expired readers',async()=>{
  const l=lease(),readers=Array.from({length:49},()=>l.source(source()));
  assert.equal(l.retainedSources,49);assert.throws(()=>l.source(source()),/budget/);
  assert.equal((await readers[48].readAt(4096,4096)).length,4096);
  l.revoke();assert.equal(l.retainedSources,0);l.revoke();
  for(const reader of readers){assert.equal(reader.size,8192);await assert.rejects(reader.readAt(0,1),/lease ended/);}
  assert.throws(()=>l.source(source()),/lease ended/);
});

test('revocation rejects a read already in flight before its bytes reach a caller',async()=>{
  let finish,calls=0;const l=lease(2),reader=l.source({size:4,readAt(){++calls;return new Promise(r=>{finish=r;});}});
  const read=reader.readAt(0,4);assert.equal(calls,1);l.revoke();
  finish(new Uint8Array(4));await assert.rejects(read,/lease ended/);
  await assert.rejects(reader.readAt(0,4),/lease ended/);assert.equal(calls,1);assert.equal(l.retainedSources,0);
});

test('expired readers cannot attach to a later lease with reused source identifiers',async()=>{
  const old=lease(2),reader=old.source(source());old.revoke();
  const next=lease(2),current=next.source(source());
  await assert.rejects(reader.readAt(0,1),/lease ended/);
  assert.deepEqual(await current.readAt(3,1),new Uint8Array([3]));next.revoke();
});

test('invalid and oversized reads perform no backing I/O, and short results are rejected',async()=>{
  let calls=0;const l=lease(2),reader=l.source({size:8192,async readAt(){++calls;return new Uint8Array(1);}});
  for(const args of [[-1,1],[0,4097],[8192,1],[0,NaN],[0,0.5]])await assert.rejects(reader.readAt(...args),/read bounds/);
  assert.equal(calls,0);await assert.rejects(reader.readAt(0,2),/truncated/);assert.equal(calls,1);
  l.revoke();assert.equal(l.retainedSources,0);
});

test('invalid source metadata cannot consume a lease slot',()=>{
  const l=lease(2);
  for(const file of [null,{},source(0),source(Infinity),{size:1,readAt:1}])assert.throws(()=>l.source(file),/Invalid/);
  assert.throws(()=>l.source(source(8),7),/Invalid/);assert.equal(l.retainedSources,0);
  l.revoke();
  for(const maximum of [0,50,Infinity])assert.throws(()=>lease(maximum),/Invalid/);
});
test('cancelling a checkpoint lease rejects a pending result and prevents subsequent backing reads',async()=>{
  const controller=new AbortController();let reads=0,finish;
  const l=new CheckpointReadLease({maximum:1,ended:'lease ended',bounds:'read bounds',truncated:'truncated',signal:controller.signal});
  const reader=l.source({size:4,readAt(){++reads;return new Promise(resolve=>{finish=resolve;});}});
  const pending=assert.rejects(reader.readAt(0,4),/view closed/);
  controller.abort(new Error('view closed'));
  assert.equal(l.retainedSources,0,'cancellation releases backing files before pending I/O settles');
  finish(new Uint8Array(4));await pending;
  await assert.rejects(reader.readAt(0,1),/view closed/);assert.equal(reads,1);
  l.revoke();assert.equal(l.retainedSources,0);await assert.rejects(reader.readAt(0,1),/lease ended/);
});

test('cancellation releases idle checkpoint readers without another read or callback completion',async()=>{
  const controller=new AbortController();let reads=0;
  const l=new CheckpointReadLease({maximum:49,ended:'lease ended',bounds:'read bounds',truncated:'truncated',signal:controller.signal});
  const readers=Array.from({length:49},()=>l.source({size:4,async readAt(){++reads;return new Uint8Array(4);}}));
  assert.equal(l.retainedSources,49);controller.abort(new Error('view closed'));
  assert.equal(l.retainedSources,0);assert.equal(reads,0);
  for(const reader of readers)await assert.rejects(reader.readAt(0,4),/view closed/);
  assert.equal(reads,0);l.revoke();
});

test('normal lease completion unregisters the cancellation listener',()=>{
  const controller=new AbortController(),signal=controller.signal;let added=0,removed=0;
  const add=signal.addEventListener.bind(signal),remove=signal.removeEventListener.bind(signal);
  signal.addEventListener=(...args)=>{++added;return add(...args);};
  signal.removeEventListener=(...args)=>{++removed;return remove(...args);};
  const l=new CheckpointReadLease({maximum:1,ended:'lease ended',bounds:'read bounds',truncated:'truncated',signal});
  l.source(source());assert.equal(added,1);l.revoke();l.revoke();
  assert.equal(removed,1);assert.equal(l.retainedSources,0);
  controller.abort();assert.equal(l.retainedSources,0);
});
