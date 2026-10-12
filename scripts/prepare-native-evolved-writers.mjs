#!/usr/bin/env node
// Exact bounded expected UNIT/GPL/command writers from a copied evolved GMP.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {checkpointActorRecords,checkpointAttachments} from '../web/world/checkpoint.mjs';
import {hashCheckpointSource} from '../web/world/transfer-store.mjs';
import {workspace,stoppedFileSource} from './lib/stopped-entity-io.mjs';
const [reportName,profileName,mode]=process.argv.slice(2),returned=mode==='--returned';
if(!reportName||!profileName||mode&&!returned||process.argv.length!==(returned?5:4))throw Error('Usage: <evolved proof> <owned fresh profile> [--returned]');
const proof=JSON.parse(await readFile(reportName,'utf8')),profile=resolve(profileName);
if(proof.qualified!==true||(returned?proof.originalReturnedFullSaveQualified!==true:proof.originalEvolvedFullSaveQualified!==true)||!profile.startsWith(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-'+(returned?'return-reload-':'joint-reload-')))||!profile.endsWith('/frontier_0_0'))throw Error('Require qualified evolved save and owned copied profile');
const source=await stoppedFileSource(join(profile,'Documents/My Games/MajestyHD/SaveGame/Joint_Reload.GMP'));
if(source.size!==(returned?proof.after.bytes:proof.after.size)||await hashCheckpointSource(source)!==proof.after.sha256)throw Error('Copied evolved checkpoint differs');
const {unitId,agentId}=returned?proof.identity:proof;
const {unit,agent}=await checkpointActorRecords(source,unitId);let orders;
for await(const r of checkpointAttachments(source))if(r.kind==='ORDR'&&r.unitId===unitId){if(orders)throw Error('Duplicate evolved commands');orders=r;}
if(unit.agentId!==agentId||agent.agentId!==agentId||!orders)throw Error('Wrong evolved actor');
const ranges={Unit:{offset:unit.offset,size:unit.size},GPL:{offset:agent.offset,size:agent.size},Orders:{offset:orders.primary.offset+16,size:orders.primary.size}},output={};
for(const [kind,r] of Object.entries(ranges)) {
  if(r.size<1||r.size>2048)throw Error('Unsupported evolved writer extent');
  const bytes=await source.readAt(r.offset,r.size),sha256=createHash('sha256').update(bytes).digest('hex');
  if(sha256!==proof.after.records[kind].sha256)throw Error('Evolved actor range changed');
  await writeFile(join(profile,`Script_Composed_${kind}_2101_0.bin`),bytes,{flag:'wx'});output[kind]={bytes:r.size,sha256};
}
console.log(JSON.stringify(output));
