#!/usr/bin/env node
// Independently inspect stopped original full-world snapshots; never load a game.
import {open,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {checkpointUnits,checkpointAgents,checkpointAttachments,checkpointActorRecords} from '../web/world/checkpoint.mjs';
async function readBounded(filename,limit){const h=await open(filename,'r');try{const s=await h.stat();if(s.size>limit)throw Error('Input exceeds inspection bound');const b=Buffer.alloc(s.size);const r=await h.read(b,0,b.length,0);if(r.bytesRead!==b.length)throw Error('Truncated inspection input');return b;}finally{await h.close();}}
const [manifestName,outputName]=process.argv.slice(2);
if (!manifestName||!outputName) throw Error('Usage: check-native-joint-checkpoint.mjs <terminal native manifest> <fresh report>');
const root=resolve(dirname(new URL(import.meta.url).pathname),'..');
const meta=JSON.parse((await readBounded(manifestName,2*1024*1024)).toString('utf8'));
if(meta.nativeSessionTerminal!==true||meta.nativeExitCode!==0||meta.nativeOnly!==true||meta.jointCheckpoint!==true||meta.nativeIdentity!==true||meta.browserUsed!==false) throw Error('Missing terminal native joint-checkpoint run');
const profile=resolve(meta.profile);
if(!profile.startsWith(join(root,'upstream/majesty-recomp/build/actor-arrival-fixture-'))||!profile.endsWith('/frontier_0_0')) throw Error('Only owned copied native profiles may be inspected');
const log=(await readBounded(meta.log,2*1024*1024)).toString('utf8');
if(!log.includes('[streaming] Joint checkpoint baseline saved=1 result=pass\n')) throw Error('Missing original full-world baseline writer');
const match=log.match(/^\[streaming\] Joint checkpoint actor=2101 trial=0 unit=(\d+) agent=(\d+) saved=1 result=pass$/m);
if(!match) throw Error('Missing live-associated original full-world writer');
const unitId=Number(match[1]),agentId=Number(match[2]);
const sha=data=>createHash('sha256').update(data).digest('hex');
async function inspect(label,populated) {
 const filename=join(profile,'Documents/My Games/MajestyHD/SaveGame',`${label}.GMP`);
 const handle=await open(filename,'r');
 try {
  const stat=await handle.stat();if(stat.size<=0||stat.size>64*1024*1024)throw Error('Invalid world bound');
  let largestRead=0,readBytes=0;
  const source={size:stat.size,async readAt(offset,length){if(length>65536)throw Error('Unbounded read');const b=Buffer.alloc(length);const r=await handle.read(b,0,length,offset);if(r.bytesRead!==length)throw Error('Truncated original checkpoint');largestRead=Math.max(largestRead,length);readBytes+=length;return b;}};
  async function recordHash(record){const hash=createHash('sha256');for(let at=0;at<record.size;at+=4096)hash.update(await source.readAt(record.offset+at,Math.min(4096,record.size-at)));return {bytes:record.size,sha256:hash.digest('hex')};}
  const records={units:{},agents:{},attachments:{}};
  for await(const record of checkpointUnits(source)){const id=record.primary.words[1];if(records.units[id])throw Error('Duplicate UNIT');records.units[id]=await recordHash(record);}
  for await(const record of checkpointAgents(source)){if(records.agents[record.agentId])throw Error('Duplicate GPL');records.agents[record.agentId]=await recordHash(record);}
  let orders;
  for await(const record of checkpointAttachments(source)){const key=`${record.kind}:${record.unitId}`;if(records.attachments[key])throw Error('Duplicate attachment');records.attachments[key]=await recordHash(record);if(record.kind==='ORDR'&&record.unitId===unitId)orders=record;}
  if(populated){
   const {unit,agent}=await checkpointActorRecords(source,unitId);
   if(agent.agentId!==agentId||unit.agentId!==agentId||agent.unitId!==unitId)throw Error('Wrong durable native/script identity');
   for(const [kind,record]of [['Unit',unit],['GPL',agent]]){
    const expected=await readBounded(join(profile,`Script_Composed_${kind}_2101_0.bin`),4096);
    if(record.size!==expected.length||records[kind==='Unit'?'units':'agents'][kind==='Unit'?unitId:agentId].sha256!==sha(expected))throw Error(`Original full-world ${kind} differs from the joint writer`);
   }
   if(!orders)throw Error('Missing durable command attachment');
   const expected=await readBounded(join(profile,'Script_Composed_Orders_2101_0.bin'),2048);
   const length=orders.primary.end-orders.primary.offset-16;
   if(length!==expected.length||sha(await source.readAt(orders.primary.offset+16,length))!==sha(expected))throw Error('Original full-world command graph differs');
  }else if(records.units[unitId]||records.agents[agentId]||records.attachments[`ORDR:${unitId}`])throw Error('Joint identities already existed in baseline');
  const hash=createHash('sha256');for(let at=0;at<stat.size;at+=65536)hash.update(await source.readAt(at,Math.min(65536,stat.size-at)));
  const after=await handle.stat();if(stat.size!==after.size||stat.mtimeMs!==after.mtimeMs||stat.ctimeMs!==after.ctimeMs)throw Error('Checkpoint changed during stopped inspection');
  return {filename,bytes:stat.size,sha256:hash.digest('hex'),largestRead,readBytes,records};
 }finally{await handle.close();}
}
const before=await inspect('Joint_Actor_Before',false),after=await inspect('Joint_Actor_2101_0',true);
const differences={};
for(const kind of ['units','agents','attachments']){
 const old=before.records[kind],next=after.records[kind];const added=[],changed=[],removed=[];let unchanged=0;
 for(const key of Object.keys(old)){if(!next[key])removed.push(key);else if(old[key].sha256!==next[key].sha256)changed.push(key);else ++unchanged;}
 for(const key of Object.keys(next))if(!old[key])added.push(key);
 const expected=kind==='units'?[String(unitId)]:kind==='agents'?[String(agentId)]:[`ORDR:${unitId}`];
 if(removed.length||changed.length||JSON.stringify(added)!==JSON.stringify(expected))throw Error(`Unexpected existing ${kind} mutation or additional records: ${JSON.stringify({added,changed,removed})}`);
 differences[kind]={before:Object.keys(old).length,after:Object.keys(next).length,unchanged,added,changed,removed};
}
const result={qualified:true,scope:'Original full-world checkpoint contains exact jointly linked UNIT/GPL/commands; all existing records byte-identical; fresh reload unqualified',unitId,agentId,sourceManifest:resolve(manifestName),sourceManifestSha256:sha(await readBounded(manifestName,2*1024*1024)),before,after,differences,actualOriginalWholeWorldWriterQualified:true,freshOriginalFullReloadQualified:false,browserUsed:false,nativeProcessesStarted:0};
await writeFile(outputName,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,unitId,agentId,bytes:after.bytes,existingRecordsUnchanged:true,freshReloadQualified:false}));
