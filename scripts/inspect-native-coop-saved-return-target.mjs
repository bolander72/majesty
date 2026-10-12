#!/usr/bin/env node
// Full original saved-home writer after the actual reader/rebuild and own Loaded.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectSavedReturnRecipient} from './inspect-native-coop-saved-return-recipient.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {compareHostCheckpointGameplay} from './lib/coop-host-checkpoint-state.mjs';
import {cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(path,cap=2*1024*1024) {
  const s=await stoppedFileSource(path);assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
  for(let i=0;i<b.length;i+=4096)b.set(await s.readAt(i,Math.min(4096,b.length-i)),i);
  return b;
}
export async function inspectSavedReturnTarget(name) {
  const report=resolve(name),raw=await bounded(report),m=JSON.parse(raw);
  const recipient=await inspectSavedReturnRecipient(report,{committed:true});
  assert.equal(m.nativeSavedReturnSnapshotRequested,true);assert.equal(m.originalSavedReturnTargetSaved,true);
  const row=m.savedReturnTargetSnapshot;
  assert.equal(row.path,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_World_Return_Target.GMP'));
  const bytes=await bounded(row.path);assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);
  const before=await connectedWorldState(recipient.importedHome.path),after=await connectedWorldState(row.path);
  assert.equal(before.clock,550);assert.equal(after.clock,550);assert.equal(before.rng,after.rng);
  assert.equal(before.gameplayRng,after.gameplayRng);
  let strictComparison=null,strictComparisonFailure=null;
  try {strictComparison=compareConnectedWorlds(before,after);}catch(e) {
    if(e.code!=='ERR_ASSERTION')throw e;
    strictComparisonFailure=String(e.message).split('\n')[0];
  }
  // This existing audited source-reader comparison retains every gameplay
  // byte and reports only local palace selection/panes/display names apart.
  const gameplayComparison=await compareHostCheckpointGameplay(before,after);
  const kingdoms=await cooperativeKingdoms(row.path,[0,1]);
  assert.equal(kingdoms.length,2);assert.ok(kingdoms.every(k=>k.palace.length===1));
  const log=(await bounded(join(workspace,`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}/native.log`),4*1024*1024)).toString();
  const marker='[coop-return-fixture] Snapshot epoch=1 serial=2 local=2 slot=1 region=0_0 frame=0 clock=550 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0';
  assert.equal(log.split('\n').filter(l=>l===marker).length,1);
  assert.ok(log.indexOf(marker)>log.indexOf('[coop-load] Loaded epoch=1 serial=2 slot=1'));
  assert.ok(!log.includes('[coop-load] Resumed epoch=1 serial=2'));
  return {version:1,report,reportSha256:sha(raw),recipient,
    fullSavedReturnTargetInspectedQualified:true,originalSavedHomeGameplayPreservedQualified:true,
    snapshot:row,originalClock:550,strictComparison,strictComparisonFailure,gameplayComparison,kingdoms,
    verifierInputs:{...recipient.verifierInputs,...Object.fromEntries(await Promise.all([
      'scripts/inspect-native-coop-saved-return-target.mjs','scripts/lib/coop-host-checkpoint-state.mjs'
    ].map(async p=>[p,sha(await readFile(join(workspace,p)))])))},
    sharedReturnResumeQualified:false,livePairedSynchronizationQualified:false,browserUsed:false,goalComplete:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  try {assert.equal(process.argv.length,4);const p=await inspectSavedReturnTarget(process.argv[2]);
    await writeFile(resolve(process.argv[3]),JSON.stringify(p,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({fullSavedHomeGameplayPreserved:true,clock:550,sharedReturnResume:false}));
  }catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],
    at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}
}
