#!/usr/bin/env node
// Stopped original host/guest incoming-command evidence. Starts no game.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectCoopWorld} from './inspect-native-coop-world.mjs';
import {connectedWorldState, compareConnectedWorlds} from './lib/connected-residency.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';

async function report(path) {
  const source = await stoppedFileSource(path);
  assert.ok(source.size > 0 && source.size <= 1024 * 1024);
  const bytes = Buffer.alloc(source.size);
  for (let at=0; at<bytes.length; at+=4096)
    bytes.set(await source.readAt(at, Math.min(4096,bytes.length-at)),at);
  return {value:JSON.parse(bytes), sha256:createHash('sha256').update(bytes).digest('hex')};
}
const [input, output] = process.argv.slice(2);
assert.ok(input && output, 'Use stopped guest report and fresh qualification output');
const guest = await inspectCoopWorld(input), m = (await report(input)).value;
assert.equal(guest.originalGuestIncomingHostPauseSavedQualified, true);
const host = await inspectCoopWorld(m.replaySourceReport);
assert.equal(host.originalRole, 'host');
assert.equal(host.scriptCompleted, true);
assert.equal(host.reportSha256, m.pausedHostInspection.reportSha256);
assert.deepEqual(host.snapshots.map(s=>({frame:s.frame,clock:s.clock})),
  guest.snapshots.map(s=>({frame:s.frame,clock:s.clock})));
const states = await Promise.all([host,guest].map(p=>connectedWorldState(p.snapshots[1].path)));
let strictSerialWorldsMatch = false, comparison = null, comparisonRefusal = null;
try {comparison = compareConnectedWorlds(...states);strictSerialWorldsMatch = true;}
catch (error) {
  if (error.code !== 'ERR_ASSERTION') throw error;
  comparisonRefusal = {code:error.code, message:error.message.slice(0,500)};
}
const result = {version:1, originalGuestIncomingHostPauseSavedQualified:true,
  originalPauseCommandBytesPreserved:true, localNetworkPlayer:2, localKingdomSlot:1,
  originalPauseOwner:1, frame:11, clock:550, originalPhase:7, originalPendingPhase:0,
  actualGuestPartyAndContextRetained:true, originalLocalPauseActionQueued:false,
  originalFullWriterExecuted:true, bothOriginalKingdomsRetained:true,
  host, guest, strictSerialWorldsMatch, comparison, comparisonRefusal,
  peakSampledNativeRssBytes:Math.max(host.peakSampledNativeRssBytes,guest.peakSampledNativeRssBytes),
  maximumReadBytes:4096, browserUsed:false, liveSecondOriginalEngine:false,
  guestSavedRestorationQualified:false, committedCoordinatorExecuted:false,
  sharedSaveLoadResumeQualified:false, pairedSynchronizationQualified:false,
  freshCooperativeNeighborTravelQualified:false, sustainedBrowserResidencyQualified:false,
  goalComplete:false,
  scope:'Serial original engines only. An inspected original host pause/input window settles the original guest at owner1/phase7/frame11/clock550 while preserving local player2/kingdom1 and both full saved kingdoms. Strict serial save comparison is recorded without new normalization. No continuing second world, committed travel votes, shared restoration/resume, browser launch or publication.'};
await writeFile(resolve(output),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({originalGuestIncomingHostPauseSavedQualified:true,
  strictSerialWorldsMatch, peakSampledNativeRssBytes:result.peakSampledNativeRssBytes}));
