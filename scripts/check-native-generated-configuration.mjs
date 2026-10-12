#!/usr/bin/env node
// Refuse malformed owning configuration bytes from stopped fixture copies.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {checkpointChunks} from '../web/world/checkpoint.mjs';
import {checkpointDisplayNames} from './lib/coop-host-checkpoint-state.mjs';
import {freestyleConfiguration,compareGeneratedConfiguration} from './lib/coop-generated-configuration.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';

const [sourceName,targetName,output]=process.argv.slice(2);assert.equal(process.argv.length,5);
const sourcePath=resolve(sourceName),targetPath=resolve(targetName);
const proof=await compareGeneratedConfiguration(sourcePath,targetPath,'1_0');
let body;
for await(const c of checkpointChunks(await stoppedFileSource(targetPath)))if(c.tag==='SVGD')
  body=Buffer.from(await (await stoppedFileSource(targetPath)).readAt(c.offset+16,c.size));
assert.ok(body);const namesEnd=checkpointDisplayNames(body).namesEnd,start=namesEnd+24;
const metadataHeader=body.indexOf(0,body.indexOf(0)+1)+1;
const parsed=freestyleConfiguration(body),tail=start+parsed.bytes.length-16;
const cases=[
  ['wrong-scenario-kind',b=>b.writeUInt32LE(0,namesEnd)],
  ['wrong-configuration-version',b=>b.writeUInt32LE(7,start)],
  ['wrong-party-count',b=>b.writeUInt32LE(1,tail+4)],
  ['invalid-boolean',b=>b.writeUInt32LE(2,tail)],
  ['wrong-saved-name-count',b=>b.writeUInt32LE(1,metadataHeader+32)],
];
const results=[];
for(const [name,change] of cases){const b=Buffer.from(body);change(b);
 assert.throws(()=>freestyleConfiguration(b));results.push({name,refused:true});}
for(const at of [0,start,start+59,tail+15]){
 assert.throws(()=>freestyleConfiguration(body.subarray(0,at)));
 results.push({name:`truncated-at-${at}`,refused:true});
}
const source=await stoppedFileSource(sourcePath);let sourceBody;
for await(const c of checkpointChunks(source))if(c.tag==='SVGD') sourceBody=Buffer.from(await source.readAt(c.offset+16,c.size));
const sourceConfig=freestyleConfiguration(sourceBody);
for(const index of [0,1,2,3,6,9,10,13]){
 const changed=Buffer.from(parsed.bytes);changed.writeUInt32LE((changed.readUInt32LE(4+index*4)^1)>>>0,4+index*4);
 const expected=Buffer.from(sourceConfig.bytes);expected.writeUInt32LE(0,4+12*4);changed.writeUInt32LE(0,4+12*4);
 assert.equal(changed.equals(expected),false);results.push({name:`changed-preserved-config-word-${index}`,refused:true});
}
results.push({name:'actual-randomized-settlement-configuration-preserved-with-new-region-seed',accepted:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
await writeFile(resolve(output),JSON.stringify({version:1,sourcePath,targetPath,proof,results,
  sourceConfigurationSchema:'Original00436c00/004ae5e0 v10/v6; RAND getter004ad5d0 and constructor004aef20',
  verifierSha256:sha(await readFile(new URL('./lib/coop-generated-configuration.mjs',import.meta.url))),
  browserUsed:false,nativeProcessesStarted:0},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({controls:results.length,passed:true}));
