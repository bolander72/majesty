#!/usr/bin/env node
// Full original held third world, independently compared with its saved input.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectSavedRevisitRecipient} from './inspect-native-coop-saved-revisit-recipient.mjs';
import {cooperativeKingdoms} from './inspect-native-coop-world.mjs';
import {connectedWorldState} from './lib/connected-residency.mjs';
import {compareLoadedKingdomGameplay} from './lib/coop-host-checkpoint-state.mjs';
import {stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function bounded(name,cap=2*1024*1024) {
 const s=await stoppedFileSource(name);assert.ok(s.size<=cap);const b=Buffer.alloc(s.size);
 for(let at=0;at<b.length;at+=4096)b.set(await s.readAt(at,Math.min(4096,b.length-at)),at);return b;
}
export async function inspectSavedRevisitTarget(name,baseline) {
 const load=await inspectSavedRevisitRecipient(name,baseline),m=JSON.parse(await bounded(load.report));
 assert.equal(m.nativeLaterTravelSnapshotRequested,true);assert.equal(m.laterTravelTargetSnapshots.length,1);
 const snapshot=m.laterTravelTargetSnapshots[0],expected=join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Coop_World_Travel_Target_3.GMP');
 assert.equal(snapshot.path,expected);const bytes=await bounded(expected);assert.equal(bytes.length,snapshot.bytes);assert.equal(sha(bytes),snapshot.sha256);
 const input=await connectedWorldState(load.target.path),state=await connectedWorldState(expected);
 assert.equal(input.clock,1550);assert.equal(state.clock,1550);
 const kingdoms=await cooperativeKingdoms(expected,[0,1]);
 const levels=kingdoms.map(k=>(k.palace[0].description>>>24)-48);assert.deepEqual(levels,[2,2]);
 const comparison=await compareLoadedKingdomGameplay(input,state,2);
 assert.deepEqual(kingdoms,await cooperativeKingdoms(load.target.path,[0,1]));
 const root=join(workspace,`output/native-multiplayer-lobby-${String(m.attempt).padStart(3,'0')}`),log=(await bounded(join(root,'native.log'),4*1024*1024)).toString();
 const pattern=/^\[coop-travel-target-fixture\] Snapshot epoch=1 serial=3 local=2 slot=1 region=1_0 saved=1 frame=0 clock=1550 original-writer=1 source-retained=1 coordinator-loaded=1 peer-loaded=0 resume-controls=0 live-second-engine=0 heap-bytes=(\d+) blocks=(\d+)$/gm;
 const matches=[...log.matchAll(pattern)];assert.equal(matches.length,1);assert.ok(Number(matches[0][1])>0&&Number(matches[0][2])>0);
 assert.ok(log.indexOf('[coop-load] Loaded epoch=1 serial=3 slot=1')<matches[0].index);
 assert.ok(!log.includes('[coop-load] Resumed epoch=1 serial=3'));
 return {...load,originalRecipientThirdHeldWorldPreservedQualified:true,fullThirdLoadedGameplayComparisonQualified:true,
   targetFullSnapshot:snapshot,fullTargetGameplayComparison:comparison,targetKingdoms:kingdoms,
   thirdHeldResources:{heapBytes:Number(matches[0][1]),blocks:Number(matches[0][2])},
   verifierInputs:{...load.verifierInputs,'scripts/inspect-native-coop-saved-revisit-target.mjs':sha(await readFile(new URL(import.meta.url))),
     'scripts/lib/coop-host-checkpoint-state.mjs':sha(await readFile(new URL('./lib/coop-host-checkpoint-state.mjs',import.meta.url)))}};
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
 try {assert.equal(process.argv.length,5);const proof=await inspectSavedRevisitTarget(process.argv[2],process.argv[3]);
  await writeFile(resolve(process.argv[4]),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({thirdFullHeldGameplayPreserved:true,clock:1550,thirdSharedResume:false}));
 }catch(e){console.error(JSON.stringify({error:e.name,message:String(e.message).split('\n')[0],at:e.stack?.split('\n').filter(l=>l.trim().startsWith('at ')).slice(0,2)}));process.exitCode=1;}
}
