import test from 'node:test';
import assert from 'node:assert/strict';
import {blankVersionLabel, prepareMenuText} from '../web/hosting/menu-text.mjs';

test('only the nine placeholder characters change, with all offsets preserved', () => {
  const original = new TextEncoder().encode('menu prefix\x00\x0a\x00\x00\x00Version #\x00\x0b\x00\x00\x00ADJUST SETTINGS\x00');
  const saved = original.slice(), output = blankVersionLabel(original);
  assert.deepEqual(original, saved);
  assert.equal(output.length, original.length);
  const at = new TextDecoder().decode(original).indexOf('Version #');
  assert.deepEqual(output.slice(0, at), original.slice(0, at));
  assert.equal(new TextDecoder().decode(output.slice(at, at + 9)), '         ');
  assert.deepEqual(output.slice(at + 9), original.slice(at + 9));
});

test('missing and duplicated labels are refused', () => {
  assert.throws(() => blankVersionLabel(new Uint8Array(30)), /not found/);
  const one = '\x00\x0a\x00\x00\x00Version #\x00\x0b\x00\x00\x00';
  assert.throws(() => blankVersionLabel(new TextEncoder().encode(one + one)), /Ambiguous/);
});

test('invalid profiles are refused before touching storage', async () => {
  await assert.rejects(prepareMenuText({dataId: 'majesty', profilePath: 'majesty/profile/../game',
    storage: {getDirectory: () => assert.fail()}}), /Invalid menu/);
});
