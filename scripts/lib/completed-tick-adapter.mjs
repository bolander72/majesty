// Admit only the exact post-original callback added to the qualified adapter.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {workspace,ownedDirectory} from './stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const ORIGINAL_FRONTIER_SHA='23491b0aca3130643dbed687e1b7f5727c7659d2e95c326d1ac42c353fb53fd4';
export async function completedTickAdapterSha() {
  const g=JSON.parse(await readFile(join(workspace,'output/native-heap-generation-preserved-observed.json')));
  assert.equal(g.qualified,true);assert.equal(g.version,1);
  assert.equal(g.nativeExecutable.sha256,'dbbd7bf6c144e85c88dcd9a4a8c2434b403b31d74ac7ec415a41d0efa82a172e');
  const dir=await ownedDirectory(g.directory,'actor-arrival-fixture-native-generation-');
  const before=await readFile(join(dir,'browser_frontier.cpp'));assert.equal(sha(before),ORIGINAL_FRONTIER_SHA);
  let source=before.toString('utf8');
  const declaration='extern "C" void majesty_browser_streaming_joint_motion_tick(X86 *);';
  const call='  majesty_browser_frontier_frame(c);\n  fn_00417730(c);\n}';
  assert.equal(source.split(declaration).length,2);assert.equal(source.split(call).length,2);
  source=source.replace(declaration,declaration+'\nextern "C" void majesty_browser_streaming_world_completed_tick(X86 *);');
  source=source.replace(call,'  majesty_browser_frontier_frame(c);\n  fn_00417730(c);\n  // Native residency saves after the complete original tick, before the\n  // dispatcher can consume a pending exit. It is disabled in browser builds.\n  majesty_browser_streaming_world_completed_tick(c);\n}');
  return sha(Buffer.from(source));
}
export async function assertCompletedTickAdapter(current,prior) {
  assert.equal(prior,ORIGINAL_FRONTIER_SHA,'Unexpected original frontier adapter');
  assert.equal(current,await completedTickAdapterSha(),'Unqualified frontier adapter change');
}
