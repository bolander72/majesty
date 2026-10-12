#!/usr/bin/env node
// Contradict actual stopped travel evidence; never generate a gameplay trace.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {requireSessionTrace} from './inspect-native-region-session.mjs';
const [manifestName,observedName,out]=process.argv.slice(2);
assert.ok(manifestName&&observedName&&out);
const hash=async name=>(await hashNativeFile(name)).sha256;
const m=JSON.parse(await readFile(manifestName,'utf8'));
const observed=JSON.parse(await readFile(observedName,'utf8'));
assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
try{process.kill(m.nativePid,0);assert.fail('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
assert.equal(observed.qualified,true);assert.equal(observed.fullTypedRestorationQualified,true);
assert.equal(observed.nativeSessionQueueObservationQualified,true);
assert.equal(observed.manifestSha256,await hash(manifestName));assert.equal(m.logSha256,await hash(m.log));
for(const[name,digest]of Object.entries(observed.sourceSha256))assert.equal(await hash(name),digest);
const text=await readFile(m.log,'utf8'),trace=requireSessionTrace(m,text),rows=trace.queueObservations;
assert.deepEqual(rows,observed.queueObservations);
assert.equal(trace.visits,5);assert.equal(rows.length,6);
const transitions=rows.slice(1,trace.visits);
// Bits0..2 mean the preceding descriptor, map and buffer each reached a
// completed original CRT free. Bit3 (manager) remains clear on this route.
assert.ok(transitions.every(r=>r['previous-freed']==='7'&&r['previous-valid']==='0'));
assert.equal(rows.at(-1)['previous-freed'],'6');
let controls=0;
function refuse(change){const bad=structuredClone(m);const altered=change(bad,text);assert.throws(()=>requireSessionTrace(bad,altered));++controls;}
const line=text.split('\n').find(l=>l.startsWith('[frontier] Session queue observation serial=1 '));assert.ok(line);
for(const[key,value]of [['serial','0'],['clock','4294967296'],['parent','00000000'],
  ['queue','00000000'],['previous-queue','00000000'],['previous-buffer','00000000'],
  ['previous-map','00000000'],['previous-serial','0x0'],['previous-freed','16'],
  ['previous-valid','1'],['previous-references','0'],['count','2'],['tree-count','0'],
  ['read-only','0'],['heap-same','0'],['hooks-same','0'],['result','fail']]){
  const changed=line.replace(new RegExp(`(^| )${key}=[^ ]+`),`$1${key}=${value}`);assert.notEqual(changed,line);
  refuse((bad,t)=>t.replace(line,changed));
}
refuse((bad,t)=>t.replace(line+'\n',''));
refuse((bad,t)=>t.replace(line,line+'\n'+line));
refuse((bad,t)=>t.replace(line,line+' count=1'));
refuse((bad,t)=>t.replace(line,line+' unknown=1'));
const last=text.split('\n').find(l=>l.startsWith('[frontier] Session queue observation serial=5 '));assert.ok(last);
refuse((bad,t)=>t.replace(last,last.replace(/ queue=[^ ]+/,' queue=00000001')));
await writeFile(out,JSON.stringify({version:1,qualified:true,controlsPassed:controls,
  scope:'Five native named-world visits, four unload transitions and one final checkpoint; completed original frees observed, no queue retirement performed.',
  manifest:resolve(manifestName),manifestSha256:await hash(manifestName),observed:resolve(observedName),observedSha256:await hash(observedName),
  log:m.log,logSha256:m.logSha256,nativePid:m.nativePid,nativeProducerAbsent:true,
  completedOriginalQueueFrees:transitions.length,completedOriginalMapFrees:transitions.length+1,
  completedOriginalBufferFrees:transitions.length+1,
  extraQueueCleanupRequiredByThisTrial:false,queueRetirementPerformed:false,
  sustainedMemoryBoundQualified:false,browserUsed:false,
  sources:{'scripts/inspect-native-region-session.mjs':await hash('scripts/inspect-native-region-session.mjs'),
    'scripts/check-native-session-queue-observation.mjs':await hash(new URL(import.meta.url).pathname)}},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({qualified:true,controlsPassed:controls,completedOriginalQueueFrees:transitions.length,queueRetirementPerformed:false}));
