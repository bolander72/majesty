import test from 'node:test';
import assert from 'node:assert/strict';
import {connectedLoadTransformEvents,assertSelectionRecordChange} from '../scripts/lib/connected-load-transforms.mjs';

const event = '[streaming] Connected load transform visit=0 event=1 kind=2 caller=005b64a0 self=01d59c00 id=549 before=00000080 after=80000081 point=26,123 mask=00000001 radius=3 arg0=0 arg1=0 result=pass';
const trace = [0,1,2,3].map(i => `[streaming] Connected load observers visit=${i} version=2 installed=3 result=pass\n${i===0?event+'\n':''}[streaming] Connected load observers visit=${i} removed=3 events=${i===0?1:0} result=pass`).join('\n');

test('a reveal observation retains separate player and notification bits', () => {
  const visits = connectedLoadTransformEvents(trace,4);
  assert.equal(visits[0][0].after,0x80000081);
  assert.equal(visits[0][0].mask,1); assert.deepEqual(visits.slice(1),[[],[],[]]);
});
test('missing removal, duplicate events and unexplained masks are refused', () => {
  for (const broken of [trace.replace(/.*visit=0 removed=3.*\n/,''),
    trace.replace(event,event+'\n'+event), trace.replace('mask=00000001','mask=00000002'),
    trace.replace('transform visit=0','transform visit=7'),
    trace.replace('point=26,123','point=1,1'), trace.replace('id=549','id=0')])
    assert.throws(()=>connectedLoadTransformEvents(broken,4));
});
test('observed deselection cannot hide another saved unit change or modify input', () => {
  const before=Buffer.alloc(257),after=Buffer.alloc(257);
  before.writeUInt32LE(513,40);after.writeUInt32LE(512,40);
  const untouched=Buffer.from(before),e={kind:1,before:513,after:512};
  assertSelectionRecordChange(before,after,40,e);assert.deepEqual(before,untouched);
  after[41]=1;assert.throws(()=>assertSelectionRecordChange(before,after,40,e));
  after[41]=0;after[100]=1;assert.throws(()=>assertSelectionRecordChange(before,after,40,e));
});
