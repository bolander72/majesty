import assert from 'node:assert/strict';
import test from 'node:test';
import {sessionCompiledSourceHashes} from '../scripts/lib/session-compiled-inputs.mjs';

const prefix = 'upstream/majesty-recomp/';
const actions = ['kit/platform/named_actions.h', 'kit/host/script.h',
  'kit/host/script.cpp', 'kit/host/smoke_main.cpp', 'kit/host/CMakeLists.txt'];
// The legacy contract records20 inputs. These fixtures test group admission
// and counting only; real build file hashes are verified by session runners.
function legacy() {
  return {nativeSourceSha256: Object.fromEntries(
    Array.from({length: 20}, (_, i) => [prefix + `legacy-${i}.cpp`, 'a'.repeat(64)]))};
}
function addActions(build, names = actions) {
  for (const name of names) build.nativeSourceSha256[prefix + name] = 'b'.repeat(64);
  return build;
}

test('archived pre-action input counts remain admitted', () => {
  assert.equal(Object.keys(sessionCompiledSourceHashes(legacy())).length, 20);
});

test('all named-action executor/parser/platform inputs are counted', () => {
  assert.equal(Object.keys(sessionCompiledSourceHashes(addActions(legacy()))).length, 25);
});

test('every incomplete named-action group refuses', () => {
  for (const missing of actions) {
    assert.throws(() => sessionCompiledSourceHashes(
      addActions(legacy(), actions.filter(name => name !== missing))),
    /Incomplete named-action provenance/);
  }
  for (const only of actions) {
    assert.throws(() => sessionCompiledSourceHashes(addActions(legacy(), [only])),
      /Incomplete named-action provenance/);
  }
});

test('complete new group cannot hide missing, overlapping or extra inputs', () => {
  const missing = addActions(legacy());
  delete missing.nativeSourceSha256[prefix + 'legacy-0.cpp'];
  assert.throws(() => sessionCompiledSourceHashes(missing));
  const overlap = addActions(legacy());
  overlap.nativeHeapRuntimeSourceSha256 = {
    [prefix + actions[0]]: 'b'.repeat(64)};
  assert.throws(() => sessionCompiledSourceHashes(overlap), /must not overlap/);
  const extra = addActions(legacy());
  extra.nativeSourceSha256[prefix + 'unexpected.cpp'] = 'c'.repeat(64);
  assert.throws(() => sessionCompiledSourceHashes(extra));
});
