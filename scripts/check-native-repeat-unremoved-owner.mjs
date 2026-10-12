#!/usr/bin/env node
// Real incoming save must not publish while the outgoing original actor remains.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {verifyRepeatReload} from './check-native-repeat-reload.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {assertRevalidatedNativeProof} from './lib/revalidate-native-proof.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
const [reloadName,out]=process.argv.slice(2);if(!reloadName||!out||process.argv.length!==4)throw Error('Usage: <qualified incoming reload> <fresh refusal report>');
const r=JSON.parse(await readFile(reloadName));assertRevalidatedNativeProof(await verifyRepeatReload(r.sourceManifest),r);
const a=JSON.parse(await readFile(r.sourceActiveReport)),capsule=JSON.parse(await readFile(a.fixture.privateReturnPacket.returnReport)),p=capsule.plan,
  receipt=JSON.parse(await readFile(p.receipt));
for(let side=0;side<2;++side)await verifyRevisionExport(p.receipt,side,receipt.worlds[side].sha256);
const hashes={};for(const name of await readdir(receipt.revisionDirectory))hashes[name]=await hashCheckpointSource(await stoppedFileSource(join(receipt.revisionDirectory,name)));
assert.equal(Object.keys(hashes).length,8);
const worlds=[];for(const w of receipt.worlds)worlds.push({source:await stoppedFileSource(w.filename),sha256:w.sha256});
await verifyEntityOwnership(receipt.identity,receipt.state.aliases,receipt.state.referenceBindings,worlds,receipt.state.ownerSide);
const candidate=[worlds[0],{source:await stoppedFileSource(r.after.filename),sha256:r.after.sha256}],aliases=[p.sourceAlias,r.identity];
let reason;try{await verifyEntityOwnership(receipt.identity,aliases,p.referenceBindings,candidate,1);}catch(e){reason=e.message;}
assert.equal(reason,'Entity owned by both snapshots');
for(const [name,digest] of Object.entries(hashes))assert.equal(await hashCheckpointSource(await stoppedFileSource(join(receipt.revisionDirectory,name))),digest);
await writeFile(out,JSON.stringify({qualified:true,scope:'Actual next incoming evolved save is refused as a paired handoff while the canonical outgoing NPC remains; canonical revision5 ownership and all eight files stay unchanged.',
  reloadReport:resolve(reloadName),revision:5,canonicalOwnerSide:0,outgoingAlias:p.sourceAlias,incomingAlias:r.identity,
  canonicalCurrentOwnershipQualified:true,unremovedOwnerPublicationRefused:true,reason,canonicalFilesUnchanged:8,
  committed:false,browserUsed:false,nativeProcessesStarted:0,repeatedGameplayCrossingsQualified:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,unremovedOwnerPublicationRefused:true,canonicalFilesUnchanged:8}));
