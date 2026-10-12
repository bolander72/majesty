#!/usr/bin/env node
// Refuse contradictions of actual active queue-call metadata and pinned CALLs.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyPageContext,parsePageContexts,assertQueueCallInstruction} from './check-native-page-context.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const [name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
const p=await verifyPageContext(name),m=JSON.parse(await readFile(name)),actual=(await readFile(m.log)).toString('utf8'),golden=parsePageContexts(actual,p.events),checks=[];
const candidate=golden.find(c=>c.mapLive===0&&c.firstBuffer===0&&c.lastBuffer===0);assert.ok(candidate);
const line=actual.slice(candidate.position,actual.indexOf('\n',candidate.position));
function refuse(label,bad) {
  assert.notEqual(bad,actual);assert.deepEqual(parsePageContexts(actual,p.events),golden);assert.throws(()=>parsePageContexts(bad,p.events));
  checks.push({name:label,actualPositivePassed:true,refused:true});
}
function change(label,pattern,replacement) {refuse(label,actual.replace(line,line.replace(pattern,replacement)));}
change('wrong event ordinal',/event=\d+/,'event=0');
change('unaligned queue',/queue=[0-9a-f]{8}/,'queue=01000005');
change('outside arena queue',/queue=[0-9a-f]{8}/,'queue=ffffffff');
change('outside code caller',/push-caller=[0-9a-f]{8}/,'push-caller=ffffffff');
change('unaligned map',/map=[0-9a-f]{8}/,'map=01000001');
change('unknown heap size sentinel',/map-bytes=\d+/,'map-bytes=4294967295');
change('impossible queue count',/count=\d+/,'count=4294967296');
change('impossible map capacity',/capacity=\d+/,'capacity=4294967296');
change('map lifetime contradicts known byte bounds','map-live=0','map-live=1');
change('read first node from unknown map',/first-buffer=[0-9a-f]{8}/,'first-buffer=01000000');
change('read last node from unknown map',/last-buffer=[0-9a-f]{8}/,'last-buffer=01000000');
change('zero first buffer cannot be live','first-live=0','first-live=1');
change('zero last buffer cannot be live','last-live=0','last-live=1');
change('failed context observation','result=pass','result=fail');
refuse('missing queue context',actual.replace(line+'\n',''));
refuse('duplicated queue context',actual.replace(line,line+'\n'+line));
refuse('malformed extra context',actual+'\n[streaming] World page-context invalid\n');
refuse('context before its actual allocation',actual.replace(line+'\n','').replace(/^\[streaming\] World page observer .*$/m,match=>line+'\n'+match));
for(const caller of p.callers) {
  const valid=Buffer.alloc(5);valid[0]=0xe8;valid.writeInt32LE((0x49ff10-caller.returnPc)|0,1);
  assert.equal(sha(valid),caller.instructionSha256);assertQueueCallInstruction(caller.returnPc,valid);
  const wrongOpcode=Buffer.from(valid);wrongOpcode[0]=0xe9;assert.throws(()=>assertQueueCallInstruction(caller.returnPc,wrongOpcode));
  const wrongTarget=Buffer.from(valid);wrongTarget[1]^=1;assert.throws(()=>assertQueueCallInstruction(caller.returnPc,wrongTarget));
  checks.push({name:'changed queue CALL opcode',actualPositivePassed:true,refused:true},{name:'changed queue CALL target',actualPositivePassed:true,refused:true});
}
const report={qualified:true,scope:'Actual active queue context and nested native persistence/heap/page gates requalified. Contradictory context metadata and pinned queue CALL bytes refuse in copies. The earlier unknown-size sentinel is an explicit negative control. Does not qualify queue lifetime after return or safe retirement.',
  sourceManifest:p.sourceManifest,sourceManifestSha256:p.sourceManifestSha256,controlsRefused:checks.length,checks,queueRetirementQualified:false,wholeBrowserMemoryBoundQualified:false,browserUsed:false,nativeProcessesStarted:0,
  sourceSha256:{...p.sourceSha256,'scripts/check-native-page-context-controls.mjs':sha(await readFile(new URL(import.meta.url)))},evidenceSha256:p.evidenceSha256};
await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({qualified:true,controlsRefused:checks.length}));
