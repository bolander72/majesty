#!/usr/bin/env node
// Native private-stage packet. Paths/identities are verified before any copy;
// symbolic own IDs and clock edits are resolved only by original native methods.
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyReturnCapsule} from './prepare-native-entity-return.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
const [reportName,profileName]=process.argv.slice(2);
if(!reportName||!profileName||process.argv.length!==4)throw Error('Usage: <current return capsule> <owned original-source profile>');
await verifyReturnCapsule(reportName);
const r=JSON.parse(await readFile(reportName,'utf8')),p=r.plan,profile=await ownedDirectory(resolve(profileName),'actor-arrival-fixture-original-source-');
if(!profile.endsWith('/frontier_0_0'))throw Error('Require original-source copied profile');
const words=values=>{const bytes=Buffer.alloc(values.length*4);values.forEach((v,i)=>{if(!Number.isInteger(v)||v<0||v>0xffffffff)throw Error('Invalid return packet word');bytes.writeUInt32LE(v,i*4);});return bytes;};
const edits=p.edits.map(e=>{
  const record=['Unit','GPL','Orders'].indexOf(e.record);let kind=0,value=e.after,nonzero=0;
  if(value==='fresh-unit-id'){kind=1;value=0;}else if(value==='fresh-agent-id'){kind=2;value=0;}
  else if(typeof value==='object'){kind=3;nonzero=Number(value.rejectZero);value=value.destinationClockMinusElapsed;}
  if(record<0||![0,1].includes(nonzero))throw Error('Invalid return edit kind');
  return words([record,e.offset,e.before,kind,value,nonzero]);
});
const records=[];for(const name of ['Unit','GPL','Orders']){const s=await stoppedFileSource(join(r.directory,name+'.bin'));if(s.size>4096)throw Error('Unbounded return packet record');records.push(await s.readAt(0,s.size));}
const bytes=Buffer.concat([words([0x3154524e,1,p.sourceAlias.unitId,p.sourceAlias.agentId,p.retiredDestinationAlias.unitId,p.retiredDestinationAlias.agentId,
  p.sourceClock,...records.map(b=>b.length),edits.length]),...records,...edits]);
if(bytes.length>8192||edits.length>64)throw Error('Return packet exceeds native bound');
await writeFile(join(profile,'Native_Return_Packet.bin'),bytes,{flag:'wx'});
console.log(JSON.stringify({version:1,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
  returnReport:resolve(reportName),returnReportSha256:createHash('sha256').update(await readFile(reportName)).digest('hex'),
  receipt:p.receipt,planSha256:r.planSha256,destinationWorld:p.destinationWorld,sourceWorld:p.sourceWorld,edits:edits.length,
  nativeReturnQualified:false,sourceSha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex')}));
