// Read-only evidence of original cold-load changes. Never normalize saved state.
import assert from 'node:assert/strict';

export function connectedLoadTransformEvents(log, count) {
  assert.ok(Number.isInteger(count) && count >= 3 && count <= 8);
  const starts = [...log.matchAll(/^\[streaming\] Connected load observers visit=(\d+) version=2 installed=3 result=pass$/gm)];
  const ends = [...log.matchAll(/^\[streaming\] Connected load observers visit=(\d+) removed=3 events=(\d+) result=pass$/gm)];
  const events = [...log.matchAll(/^\[streaming\] Connected load transform visit=(\d+) event=(\d+) kind=([123]) caller=([0-9a-f]{8}) self=([0-9a-f]{8}) id=(\d+) before=([0-9a-f]{8}) after=([0-9a-f]{8}) point=(-?\d+),(-?\d+) mask=([0-9a-f]{8}) radius=(\d+) arg0=(\d+) arg1=(\d+) result=pass$/gm)];
  assert.equal(starts.length, count); assert.equal(ends.length, count);
  assert.equal((log.match(/^\[streaming\] Connected load observers /gm) || []).length, count * 2);
  assert.equal((log.match(/^\[streaming\] Connected load transform /gm) || []).length, events.length);
  assert.equal(ends.reduce((sum,end)=>sum+Number(end[2]),0),events.length);
  assert.ok(!/Connected load observer refused/.test(log));
  return starts.map((start, i) => {
    const end = ends[i];
    assert.equal(Number(start[1]), i); assert.equal(Number(end[1]), i);
    assert.ok(start.index < end.index);
    if (i) assert.ok(ends[i-1].index < start.index);
    const found = events.filter(event => Number(event[1]) === i);
    assert.equal(found.length, Number(end[2])); assert.ok(found.length <= 64);
    return found.map((event, index) => {
      assert.equal(Number(event[2]), index + 1);
      assert.ok(event.index > start.index && event.index < end.index);
      const kind = Number(event[3]), before = parseInt(event[7], 16), after = parseInt(event[8], 16);
      const result = {visit:i, event:index+1, kind, caller:event[4], receiver:event[5], id:Number(event[6]),
        before, after, x:Number(event[9]), y:Number(event[10]), mask:parseInt(event[11],16),
        radius:Number(event[12]), arg0:Number(event[13]), arg1:Number(event[14])};
      assert.ok(result.id > 0 && parseInt(result.receiver,16) > 0 && before !== after);
      if (kind === 1) {
        // Retain the original notification choice separately from deselection.
        assert.equal(before & 1, 1); assert.equal(after, before - 1);
        assert.equal(result.arg0, 0); assert.ok([0,1].includes(result.arg1));
      } else if (kind === 2) {
        assert.equal(result.caller, '005b64a0'); assert.equal(result.mask, 1);
        assert.equal((before & 0x80000001) >>> 0, 0);
        assert.equal(after, (before | 0x80000001) >>> 0);
        assert.ok(result.radius > 0 && result.radius <= 128);
        assert.ok((28-result.x-0.5)**2+(126-result.y-0.5)**2 <= result.radius**2);
      } else {
        assert.equal(result.caller, '0043a5cd'); assert.equal(before, 0); assert.equal(after, result.id);
      }
      return result;
    });
  });
}

export function assertSelectionRecordChange(before, after, offset, event) {
  assert.equal(event.kind, 1); assert.equal(before.length, after.length);
  assert.ok(Number.isInteger(offset) && offset >= 0 && offset + 4 <= before.length);
  const previous = Buffer.from(before), loaded = Buffer.from(after);
  assert.equal(previous.readUInt32LE(offset), event.before);
  assert.equal(loaded.readUInt32LE(offset), event.after);
  previous.writeUInt32LE(event.after, offset);
  assert.deepEqual(previous, loaded, 'Fields besides the observed selection bit changed');
}
