#!/usr/bin/env node
// Original saved graphs independently qualify the shared registration primitive.
import assert from 'node:assert/strict';
import {readFile,writeFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {checkpointChunks,checkpointAgents,checkpointAgentQueues,checkpointUnitAgentLinks,
  checkpointNextAgentId} from '../web/world/checkpoint.mjs';
import {checkpointSavedClock} from '../web/world/saved-clock.mjs';

const [manifestName,outName]=process.argv.slice(2);
assert.equal(process.argv.length,4);
assert.match(outName,/^output\/native-hero-home-\d{3}-observed\.json$/);
await assert.rejects(lstat(outName),e=>e.code==='ENOENT');
const hash=async name=>(await hashNativeFile(name)).sha256;
async function json(name){const stat=await lstat(name);assert.ok(stat.isFile()&&stat.size<256*1024);return JSON.parse(await readFile(name,'utf8'));}
async function descriptor(row){assert.ok(row&&typeof row.filename==='string');assert.equal((await lstat(row.filename)).size,row.bytes);assert.equal(await hash(row.filename),row.sha256);}
const m=await json(manifestName);await descriptor(m.preparation);await descriptor(m.build);
const prep=await json(m.preparation.filename);
assert.equal(m.nativeHomeRegistrationTrialQualified,true);assert.equal(m.nativeSessionTerminal,true);
assert.equal(m.nativeExitCode,0);assert.equal(m.ownedProducerAbsent,true);assert.equal(m.stopReason,null);
assert.equal(m.browserUsed,false);assert.equal(m.heroImported,false);assert.equal(m.ownerTransferred,false);
assert.deepEqual(m.preservedBefore,m.preservedAfter);
for(const key of ['copiedCheckpointUnchanged','originalCheckpointUnchanged','proposalUnchanged','originalProposalUnchanged','nativeExecutableUnchanged'])assert.equal(m[key],true);
try{process.kill(m.nativePid,0);throw Error('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
await ownedDirectory(m.fixture,'actor-arrival-fixture-hero-home-');assert.equal(m.profile,join(m.fixture,'frontier_1_0'));
assert.equal(await hash(join(m.fixture,'native/recomp/pop_smoke')),m.nativeExecutableSha256);
assert.equal(Object.keys(m.compiledSourceSha256).length,54);
for(const[name,digest]of Object.entries({...m.compiledSourceSha256,...prep.sourceSha256}))assert.equal(await hash(name),digest);
for(const[name,digest]of [[m.log,m.logSha256],['scripts/run-native-hero-home.py',m.runnerSha256],
 ['scripts/lib/native_pair_guard.py',m.guardSha256],['scripts/run-native-regional-home.py',m.supervisorSha256]])assert.equal(await hash(name),digest);
for(const row of [m.sourceCheckpoint,m.proposal,prep.sourceCheckpoint,prep.proposal,...m.worlds])await descriptor(row);
const register=m.mode==='register';assert.ok(register||['bad-digest','wrong-counter'].includes(m.mode));
assert.equal(m.nativeHomeRegistrationQualified,register);assert.equal(m.nativeHomeRegistrationRefusalQualified,!register);
assert.equal(m.worlds.length,register?3:2);assert.equal(m.clock,prep.clock);
assert.deepEqual(m.worlds.map(r=>basename(r.filename)),register?
 ['Hero_Home_Before.GMP','Hero_Home_Registered.GMP','Hero_Home_Reused.GMP']:['Hero_Home_Before.GMP','Hero_Home_Refused.GMP']);
const id=prep.proposedAgentId;
async function rangeHash(source,offset,size){const h=createHash('sha256');for(let at=0;at<size;at+=4096)h.update(await source.readAt(offset+at,Math.min(4096,size-at)));return h.digest('hex');}
async function state(row){
 const source=await stoppedFileSource(row.filename),roots=[];
 for await(const c of checkpointChunks(source)){
  let offset=c.offset+16,size=c.size;
  let digest;
  // Original reader00436770: two NUL labels, clock, then00501f80's
  // sixteen calendar bytes. Preserve the second label, clock and remaining
  // state; exclude only the save name and validated wall-clock timestamp.
  if(c.tag==='SVGD'){assert.deepEqual([c.version,c.count],[10,0]);assert.ok(size>=35&&size<=1024);
   const bytes=Buffer.from(await source.readAt(offset,size)),a=bytes.indexOf(0),b=bytes.indexOf(0,a+1);
   assert.ok(a>0&&a<128&&b>a+1&&b-a<128&&b+33<=size);
   assert.equal(bytes.subarray(0,a).toString('ascii'),basename(row.filename,'.GMP'));
   const date=Array.from({length:8},(_,i)=>bytes.readUInt16LE(b+5+i*2));
   const [year,month,weekday,day,hour,minute,seconds,millis]=date;
   assert.ok(year>=2000&&year<=2200&&month>=1&&month<=12&&weekday<=6&&day>=1&&day<=31&&hour<24&&minute<60&&seconds<60&&millis<1000);
   const semantic=Buffer.concat([bytes.subarray(a+1,b+5),bytes.subarray(b+21)]);
   size=semantic.length;digest=createHash('sha256').update(semantic).digest('hex');
  }else digest=await rangeHash(source,offset,size);
  roots.push({tag:c.tag,version:c.version,count:c.count,bytes:size,sha256:digest});
 }
 const agents=new Map();for await(const a of checkpointAgents(source)){assert.ok(agents.size<4096&&!agents.has(a.agentId));
  agents.set(a.agentId,{agentId:a.agentId,unitId:a.unitId,deleted:a.deleted,bytes:a.size,
   attributes:a.attributes.declaredCount,functions:a.functionNameCount,sha256:await rangeHash(source,a.offset,a.size)});}
 const queues=[];for await(const q of checkpointAgentQueues(source)){assert.ok(queues.length<8192);const {offset,size,...entry}=q;queues.push(entry);}
 const links=[];for await(const l of checkpointUnitAgentLinks(source)){assert.ok(links.length<4096);links.push([l.unitId,l.agentId]);}
 return {clock:await checkpointSavedClock(source),next:await checkpointNextAgentId(source),roots,agents,queues,links};
}
const states=[];for(const row of m.worlds)states.push(await state(row));
const before=states[0];assert.equal(before.next,id);assert.ok(!before.agents.has(id));
let preservedAgentComparisons=0;
for(let i=1;i<states.length;i++){
 const s=states[i];assert.equal(s.clock,m.clock);assert.equal(before.clock,m.clock);
 assert.equal(s.next,id+Number(register));assert.deepEqual(s.queues,before.queues);assert.deepEqual(s.links,before.links);
 assert.deepEqual(s.roots.filter(r=>r.tag!=='GPL '),before.roots.filter(r=>r.tag!=='GPL '));
 assert.deepEqual([...s.agents.keys()].filter(a=>!register||a!==id),[...before.agents.keys()]);
 for(const[a,record]of before.agents){assert.deepEqual(s.agents.get(a),record);preservedAgentComparisons++;}
 assert.ok(!s.links.some(([,agent])=>agent===id));assert.ok(!s.queues.some(q=>q.agentId===id));
 if(register)assert.deepEqual(s.agents.get(id),{agentId:id,unitId:0,deleted:false,bytes:prep.proposal.bytes,
  attributes:9,functions:0,sha256:prep.proposal.sha256});
 else assert.deepEqual(s.roots,before.roots);
}
if(register)assert.deepEqual(states[1].roots,states[2].roots);
const log=await readFile(m.log,'utf8');assert.ok(log.length<m.logCeilingBytes);
assert.ok(!/result=fail|abort from/.test(log));
assert.ok(log.includes(register?'reuse-same=1 duplicate-refused=1 wrong-clock-refused=1 result=pass':`Hero home test refused mode=${m.mode}`));
assert.ok(m.resourceSamples.length&&m.resourceSamples.every(s=>s.rssBytes<=m.rssCeilingBytes));
const sourceSha256={...prep.sourceSha256,...m.compiledSourceSha256};
for(const name of ['scripts/inspect-native-hero-home.mjs','scripts/lib/stopped-entity-io.mjs','scripts/lib/native-generation.mjs',
 'web/world/checkpoint.mjs','web/world/saved-clock.mjs'])sourceSha256[name]=await hash(name);
const report={version:1,nativeHeroHomeRegistrationQualified:register,nativeHeroHomeRefusalQualified:!register,
 mode:m.mode,manifest:{filename:resolve(manifestName),sha256:await hash(manifestName)},sourceSha256,
 clock:m.clock,proposedAgentId:id,allocationCounters:states.map(s=>s.next),existingAgents:before.agents.size,
 preservedAgentComparisons,originalWorlds:m.worlds,unchangedNonGplRoots:before.roots.length-1,
 originalSerializationEqualsProposal:register,originalQueuesUnchanged:true,nativeBacklinksUnchanged:true,
 referenceScheduled:false,heroImported:false,ownerTransferred:false,browserUsed:false,goalComplete:false,
 nativeSessionTerminal:true,ownedProducerAbsent:true,elapsedMs:m.finishedAtMs-m.startedAtMs,
 peakSampledNativeRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes))};
await writeFile(outName,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({nativeHeroHomeRegistrationQualified:register,nativeHeroHomeRefusalQualified:!register,
 preservedAgentComparisons,clock:m.clock,allocationCounters:report.allocationCounters}));
