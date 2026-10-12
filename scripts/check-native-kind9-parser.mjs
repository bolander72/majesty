#!/usr/bin/env node
// Compare the supplemental parser to actual bounded original writer replays,
// then fully inspect the Wait command that appeared during original gameplay.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {checkpointActorOrderEntries} from './lib/native-crossing-order-entries.mjs';
import {checkpointActorOrderEntries as legacyEntries} from '../web/world/order-entries.mjs';
import {stoppedFileSource} from './lib/stopped-entity-io.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
const [auditName,receiptName,output]=process.argv.slice(2);if(process.argv.length!==5)throw Error('Usage: <kind9 audit> <current revision receipt> <fresh output>');
const audit=JSON.parse(await readFile(auditName)),receipt=JSON.parse(await readFile(receiptName));
assert.equal(audit.qualified,true);assert.equal(audit.completedCalls,2);assert.equal(audit.fixedBodyBytes,96);
const words=vs=>{const b=Buffer.alloc(vs.length*4);vs.forEach((v,i)=>b.writeUInt32LE(v>>>0,i*4));return b;};
const chunk=(tag,b=Buffer.alloc(0),version=0,count=0)=>Buffer.concat([Buffer.from(tag),words([b.length,version,count]),b]);
async function collect(source,id,reader=checkpointActorOrderEntries){const rows=[];for await(const r of reader(source,id))rows.push(r);return rows;}
let largestRead=0;
for(const replay of audit.replays) {
  assert.deepEqual(replay.words.slice(0,4),[1,1,2,9]);assert.equal(replay.words.length,24);
  const banks=Buffer.concat([words([1,1,1,9]),words(replay.words),words([1,0,1,0])]),
    attachment=Buffer.concat([words([2089]),chunk('ORDR',chunk('PRIM',banks,2),0,1)]),
    data=Buffer.concat([chunk('VERS',Buffer.alloc(256),1),chunk('ORDR',attachment,1,1),chunk('CONT',undefined,1)]);
  const source={size:data.length,async readAt(at,n){assert.ok(n<=4096);largestRead=Math.max(largestRead,n);return data.subarray(at,at+n);}};
  const entries=(await collect(source,2089)).filter(r=>r.type==='entry');assert.equal(entries.length,1);assert.deepEqual(entries[0].words,replay.words);
}
const selected=await verifyRevisionExport(receiptName,0,receipt.worlds[0].sha256),source=await stoppedFileSource(selected.filename),rows=await collect(source,2089),
  waits=rows.filter(r=>r.type==='entry'&&r.kind===9);
assert.equal(waits.length,1);assert.equal(waits[0].size,96);assert.deepEqual(waits[0].words.slice(0,4),[1,1,2,9]);
await assert.rejects(collect(source,2089,legacyEntries),e=>e.code==='NATIVE_ORDER_KIND_UNSUPPORTED'&&e.kind===9);
const sha=b=>createHash('sha256').update(b).digest('hex');
await writeFile(output,JSON.stringify({qualified:true,scope:'Two exact original writer replay payloads and the actual saved UNIT2089 Wait attachment parsed to completion. Base-only kind9 has no leaf UNIT target; opaque callbacks/other reference closure unqualified.',
  originalWriterPayloadsMatched:2,actualSavedWaitsParsed:waits.length,actualUnitId:2089,bodyBytes:96,largestSyntheticRead:largestRead,selectedRevisionExport:selected,
  legacyParserStillRejectsKind9:true,completeReferenceClosureQualified:false,browserUsed:false,nativeProcessesStarted:0,
  auditSha256:sha(await readFile(auditName)),sourceSha256:sha(await readFile(new URL(import.meta.url)))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,originalWriterPayloadsMatched:2,actualSavedWaitsParsed:1,bodyBytes:96}));
