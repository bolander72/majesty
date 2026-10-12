#!/usr/bin/env node
// Qualify the new ownership policy against an actual original-engine resident save, without publishing a return pair.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {inspectNativeHeroReturnLive} from './inspect-native-hero-return-live.mjs';
import {handoffJson} from './lib/registered-hero-handoff.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyEntityOwnership} from '../web/world/entity-ownership.mjs';
import {checkpointContainerEntries} from '../web/world/checkpoint.mjs';
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <returned live manifest> <fresh residence proof>');
const live=await inspectNativeHeroReturnLive(resolve(name));
const seed=await handoffJson(join(workspace,'output/native-hero-owner-seed-001-observed.json'));
const aliases=[{unitId:live.heroId,agentId:live.agentId},seed.aliases[1]],records=[live.evolvedWorld,seed.inputs[1]],input=[];
for(const r of records){const h=await hashNativeFile(r.filename);assert.equal(h.sha256,r.sha256);assert.equal(h.bytes,r.bytes);input.push({source:await stoppedFileSource(r.filename)});}
await verifyEntityOwnership(seed.identity,aliases,[],input,0,seed.homeAliases);
let physical;for await(const c of checkpointContainerEntries(input[0].source))
 if(c.type==='member'&&c.unitId===live.guildId&&c.groupKind===2&&c.targetUnitId===live.heroId){assert.ok(!physical);physical=c;}
assert.ok(physical);const original=input[0].source,flagOffset=physical.offset+4;
const detached={size:original.size,async readAt(at,n){const b=Uint8Array.from(await original.readAt(at,n));
 for(let i=0;i<n;i++)if(at+i>=flagOffset&&at+i<flagOffset+4)b[i]=0;return b;}};
await assert.rejects(verifyEntityOwnership(seed.identity,aliases,[],[{source:detached},input[1]],0,seed.homeAliases),/physical membership/);
const sourceSha256={};for(const n of ['web/world/entity-ownership.mjs','web/world/entity-home-ownership.mjs'])sourceSha256[n]=(await hashNativeFile(join(workspace,n))).sha256;
const report={version:1,actualOriginalReturnedHeroResidenceOwnershipQualified:true,
 scope:'Actual original evolved504/GPL28 in registered guild469/GPL7 passes current ownership policy with its native physical2, logical100/101, script roster and queue. Clearing physical membership flags in a bounded read-only view refuses the candidate. The neighboring save is the initial dormant proxy world, not a retired current remote owner; no return pair is published.',
 liveManifest:live.sourceManifest,liveManifestSha256:live.sourceManifestSha256,identity:seed.identity,aliases,homeAliases:seed.homeAliases,
 candidateWorlds:records,sourceSha256,missingPhysicalMemberRefused:true,originalFilesUnchanged:true,
 pairedReturnPublicationQualified:false,heroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0};
for(const r of records)assert.equal((await hashNativeFile(r.filename)).sha256,r.sha256);
await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({actualOriginalReturnedHeroResidenceOwnershipQualified:true,missingPhysicalMemberRefused:true,pairedReturnPublicationQualified:false,browserUsed:false}));
