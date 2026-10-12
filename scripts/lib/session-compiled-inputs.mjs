// Validate complete compiled provenance for stopped region sessions.
import assert from 'node:assert/strict';
export function sessionCompiledSourceHashes(build) {
  const groups = [build.nativeSourceSha256, build.nativeHeapRuntimeSourceSha256,
    build.nativeOrderRuntimeSourceSha256, build.nativeCheckpointRuntimeSourceSha256];
  const compiled = Object.assign({}, ...groups);
  assert.equal(Object.keys(compiled).length,
    groups.reduce((n, group) => n + Object.keys(group ?? {}).length, 0),
    'Compiled source groups must not overlap');
  assert.ok(build.nativeCompiledInputVersion === undefined || build.nativeCompiledInputVersion === 'received-checkpoint-v1');
  const source = build.nativeSourceSha256;
  const has = name => Object.hasOwn(source, 'upstream/majesty-recomp/' + name);
  const checkpointInputs = Object.keys(build.nativeCheckpointRuntimeSourceSha256 ?? {}).length;
  if (checkpointInputs) assert.equal(checkpointInputs, 3);
  // Later native socket/window builds bind these five additional inputs as one
  // complete group. Preserve older tuples; reject partially recorded groups.
  const extra = ['kit/runtime/win32.h', 'kit/runtime/user32.cpp',
    'kit/runtime/imports.cpp', 'kit/runtime/imports.h', 'kit/platform/CMakeLists.txt'];
  const extraInputs = extra.filter(has).length;
  if (extraInputs) assert.equal(extraInputs, extra.length, 'Incomplete window/import/platform provenance');
  // Named native UI requests also change the smoke executor and parser. Bind
  // their complete group without invalidating archived pre-action builds.
  const actions = ['kit/platform/named_actions.h', 'kit/host/script.h',
    'kit/host/script.cpp', 'kit/host/smoke_main.cpp', 'kit/host/CMakeLists.txt'];
  const actionInputs = actions.filter(has).length;
  if (actionInputs) assert.equal(actionInputs, actions.length, 'Incomplete named-action provenance');
  const coopHeaders = ['coop_checkpoint.h', 'coop_transition.h', 'coop_restore.h'].filter(has).length;
  const gateInputs = ['kit/host/input_gate.cpp', 'kit/host/input_gate.h'].filter(has).length;
  if (gateInputs) assert.equal(gateInputs, 2, 'Incomplete keyboard gate provenance');
  const laterInputs = ['coop_connected.h', 'coop_source_abort.h',
    'kit/runtime/user32_internal.h', 'kit/runtime/mods_seam.cpp'].filter(has).length;
  const expected = (build.nativeCompiledInputVersion === 'received-checkpoint-v1'
    ? (has('globals.toml') ? 35 : 34) + Number(has('campaign_objective.h')) +
      Number(has('coop_pause.h')) + coopHeaders + extraInputs : 20) +
    checkpointInputs + actionInputs + laterInputs + gateInputs;
  assert.equal(Object.keys(compiled).length, expected);
  return compiled;
}
