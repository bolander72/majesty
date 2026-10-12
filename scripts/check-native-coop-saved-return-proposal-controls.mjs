#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile, writeFile, unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectSavedReturnProposal} from './inspect-native-coop-saved-return-proposal.mjs';

assert.equal(process.argv.length, 4);
const [name, output] = process.argv.slice(2), m = JSON.parse(await readFile(resolve(name)));
const positive = await inspectSavedReturnProposal(name);
const cases = [
  ['missing-first-completion', r => {r.observedProposalEvents.pop();}],
  ['invented-return-commit', r => {r.observedSavedReturnEvents[0].stage = 2;}],
  ['altered-retained-home', r => {r.proposalSourceFiles.find(x => x.path.endsWith('_0.GMP')).sha256 = '0'.repeat(64);}],
  ['altered-progress-checkpoint', r => {r.savedReturnSourceFiles.find(x => x.path.endsWith('_0.GMP')).sha256 = '0'.repeat(64);}],
  ['missing-local-ready', r => {r.proposalProtocolRequests.pop();}],
];
const scratch = resolve('output/native-multiplayer-lobby-985-observed.json'), results = [];
let created = false;
try {
  for (const [name, mutate] of cases) {
    const copy = structuredClone(m); mutate(copy);
    await writeFile(scratch, JSON.stringify(copy), {flag: 'wx'}); created = true;
    await assert.rejects(() => inspectSavedReturnProposal(scratch), undefined, name);
    await unlink(scratch); created = false; results.push({name, passed: true});
  }
} finally {if (created) await unlink(scratch);}
await writeFile(resolve(output), JSON.stringify({controls: results.length, results,
  actualSourceClock: positive.sourceClock, homeUnchanged: true,
  nativeProcessesStarted: 0, browserUsed: false, returnCompleted: false}, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({controls: results.length, passed: true}));
