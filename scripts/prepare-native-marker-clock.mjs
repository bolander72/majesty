#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {inspectGeneratedHero} from './inspect-native-generated-hero.mjs';
import {inspectNativeRemoteHome} from './inspect-native-remote-home.mjs';
import {checkpointAttachments} from '../web/world/checkpoint.mjs';
import {checkpointActorOrderEntries} from '../web/world/order-entries.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';
const [out]=process.argv.slice(2);assert.equal(process.argv.length,3,'Usage: <fresh marker-clock-preparation-NNN directory>');
const directory=resolve(out);assert.equal(dirname(directory),join(workspace,'output'));assert.match(basename(directory),/^marker-clock-preparation-[0-9]{3}$/);
const sourceManifest=join(workspace,'output/native-generated-hero-attempt-002.json'),remoteManifest=join(workspace,'output/native-remote-home-attempt-002.json');
const origin=await inspectGeneratedHero(sourceManifest),remote=await inspectNativeRemoteHome(remoteManifest);
assert.equal(origin.hero.unitId,502);assert.equal(origin.attachedUnits.length,1);assert.equal(origin.attachedUnits[0].unitId,503);
const source=await stoppedFileSource(origin.save.filename),dest=await stoppedFileSource(remote.savedWorld.filename);
const sourceClockMs=await checkpointSavedClock(source),destinationClockMs=await checkpointSavedClock(dest);
assert.deepEqual([sourceClockMs,destinationClockMs],[25800,18250]);
let attachment;for await(const a of checkpointAttachments(source))if(a.kind==='ORDR'&&a.unitId===503)attachment=a;
assert.ok(attachment);assert.equal(attachment.primary.size,208);
const entries=[];for await(const e of checkpointActorOrderEntries(source,503))if(e.type==='entry')entries.push(e);
assert.equal(entries.length,1);const marker=entries[0];assert.deepEqual([marker.bank,marker.index,marker.kind],[1,0,5]);
assert.deepEqual(marker.words.slice(4,12),[100,25800,100,0,0,0,4101,0]);
const originalManifest=JSON.parse(await readFile(sourceManifest,'utf8'));
await mkdir(directory);const filename=join(directory,'Marker_Input_Orders.bin');
await writeFile(filename,await source.readAt(attachment.primary.offset+16,208),{flag:'wx'});
const result={version:1,markerClockPreparationQualified:true,sourceManifest,sourceManifestSha256:origin.sourceManifestSha256,
  remoteManifest,remoteManifestSha256:remote.sourceManifestSha256,source:origin.save,destination:remote.savedWorld,
  sourceClockMs,destinationClockMs,unitId:503,heroUnitId:502,marker:{bank:1,index:0,kind:5,words:marker.words},
  orderPayload:{filename,bytes:208,sha256:(await hashNativeFile(filename)).sha256},settingsProfile:originalManifest.profile,
  inputHashes:originalManifest.inputHashes,browserUsed:false,nativeProcessesStarted:0,sourceSha256:{}};
for(const n of ['scripts/prepare-native-marker-clock.mjs','web/world/order-entries.mjs','web/world/saved-clock.mjs'])
  result.sourceSha256[n]=(await hashNativeFile(join(workspace,n))).sha256;
await writeFile(join(directory,'marker-clock-preparation.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({markerClockPreparationQualified:true,sourceClockMs,destinationClockMs,bytes:208,browserUsed:false}));
