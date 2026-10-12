#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {workspace,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {originalMarkerClockTrace} from './lib/marker-clock-trace.mjs';
import {inspectGeneratedHero} from './inspect-native-generated-hero.mjs';
import {inspectNativeRemoteHome} from './inspect-native-remote-home.mjs';
import {checkpointUnits} from '../web/world/checkpoint.mjs';
const hash=async n=>(await hashNativeFile(n)).sha256;
async function json(n){assert.ok((await stat(n)).size<=256*1024);return JSON.parse(await readFile(n,'utf8'));}
function chunk(tag,data=Buffer.alloc(0),version=0,count=0){const h=Buffer.alloc(16);h.write(tag);h.writeUInt32LE(data.length,4);h.writeUInt32LE(version,8);h.writeUInt32LE(count,12);return Buffer.concat([h,data]);}
async function unit(bytes,id){
 const world=Buffer.concat([chunk('VERS',Buffer.alloc(256),1),...['BLDG','VHCL','GRND','RWRD','MSGF','OFMP'].map(t=>chunk(t,t==='VHCL'?bytes:undefined,0,t==='VHCL'?1:0))]);
 const file={size:world.length,async readAt(at,n){assert.ok(n<=4096);return Uint8Array.from(world.subarray(at,at+n));}};
 const values=[];for await(const u of checkpointUnits(file))values.push(u);
 assert.equal(values.length,1);assert.equal(values[0].primary.words[1],id);return values[0].primary;
}
export async function inspectNativeMarkerClock(name) {
 const m=await json(name);assert.deepEqual([m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.markerClockTrialCompleted,m.stopReason],[true,false,true,0,true,null]);
 const directory=await ownedDirectory(m.fixture,'actor-arrival-fixture-marker-clock-');assert.equal(m.profile,join(directory,'frontier_0_0'));
 const build=await json(m.buildReport);assert.equal(await hash(m.buildReport),m.buildReportSha256);assert.equal(build.nativeBuildQualified,true);
 assert.equal(await hash(build.log),build.logSha256);await verifyConnectedNativeArtifact(m,build);assert.ok(build.finishedAtMs<=m.startedAtMs);
 assert.equal(await hash(m.preparation),m.preparationSha256);const prep=await json(m.preparation);
 assert.equal(prep.markerClockPreparationQualified,true);assert.deepEqual([prep.sourceClockMs,prep.destinationClockMs],[25800,18250]);
 assert.equal(await hash(prep.sourceManifest),prep.sourceManifestSha256);assert.equal(await hash(prep.remoteManifest),prep.remoteManifestSha256);
 const origin=await inspectGeneratedHero(prep.sourceManifest),remote=await inspectNativeRemoteHome(prep.remoteManifest);
 assert.deepEqual(prep.source,origin.save);assert.deepEqual(prep.destination,remote.savedWorld);
 assert.equal(m.source,prep.source.filename);assert.equal(m.sourceSha256,prep.source.sha256);
 assert.equal(m.proposal,prep.orderPayload.filename);assert.equal(m.proposalSha256,prep.orderPayload.sha256);
 for(const [n,h] of Object.entries(prep.sourceSha256))assert.equal(await hash(join(workspace,n)),h);
 assert.equal(m.sourceCopy,join(m.profile,'Documents/My Games/MajestyHD/SaveGame/Marker_Starting_Realm.GMP'));
 assert.equal(await hash(m.source),m.sourceSha256);assert.equal(await hash(m.sourceCopy),m.sourceSha256);
 assert.equal(await hash(m.proposal),m.proposalSha256);assert.equal(await hash(join(m.profile,'Marker_Input_Orders.bin')),m.proposalSha256);
 for(const flag of ['originalSourceUnchanged','sourceCopyUnchanged','originalProposalUnchanged','proposalCopyUnchanged','originalSettingsUnchanged'])assert.equal(m[flag],true);
 for(const [n,h] of Object.entries(m.inputHashes))assert.equal(await hash(join(prep.settingsProfile,n)),h);
 assert.equal(m.script,join(directory,'load-marker.script'));assert.equal(await hash(m.script),m.scriptSha256);
 assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);
 const trace=originalMarkerClockTrace(await readFile(m.log,'utf8'));assert.equal(trace.phase,m.phase);
 assert.ok(m.records.length<=387);assert.equal(m.records.length,trace.steps.length*3);
 const records=new Map();for(const r of m.records){assert.ok(!records.has(r.filename));records.set(r.filename,r);}
 const samples=[];
 for(const step of trace.steps){const row={...step};
  for(const [part,suffix,id] of [['orders','Orders.bin',0],['effect','Effect.UNIT',503],['hero','Hero.UNIT',502]]) {
   const filename=join(m.profile,`Marker_${String(step.index).padStart(3,'0')}_${suffix}`),r=records.get(filename);assert.ok(r);
   assert.ok(r.bytes<=4096);const actual=await hashNativeFile(filename,{maximum:4096});assert.equal(actual.sha256,r.sha256);assert.equal(actual.bytes,r.bytes);
   const bytes=await readFile(filename);row[part]={...r};
   if(part==='orders') {
    assert.equal(bytes.length,step.active?208:24);
    if(step.active){assert.deepEqual([bytes.readUInt32LE(0),bytes.readUInt32LE(4),bytes.readUInt32LE(8),bytes.readUInt32LE(12),bytes.readUInt32LE(16),bytes.readUInt32LE(20)],[1,0,1,1,1,5]);
     const when=bytes.readUInt32LE(44);assert.equal(when,trace.baseClock+step.leaves*100);row.when=when;
     assert.equal(bytes.readUInt32LE(64),4101);assert.equal(bytes.readUInt32LE(68),0);
     assert.deepEqual([bytes.readUInt32LE(200),bytes.readUInt32LE(204)],[1,0]);
    } else assert.deepEqual(Array.from({length:6},(_,i)=>bytes.readUInt32LE(i*4)),[1,0,1,0,1,0]);
   } else {const u=await unit(bytes,id);row[part].primary=u;if(part==='effect')assert.equal(u.words[2],step.flags);}
  }
  samples.push(row);
 }
 assert.ok(m.resourceSamples.length>=3&&m.resourceSamples.length<=18);assert.equal(m.rssCeilingBytes,512*1024*1024);
 for(const s of m.resourceSamples){assert.equal(s.pid,m.nativePid);assert.ok(s.rssBytes>0&&s.rssBytes<=m.rssCeilingBytes);}
 assert.ok(m.finishedAtMs>=m.startedAtMs&&m.finishedAtMs-m.startedAtMs<=35000);
 return {version:1,originalMarkerClockRunQualified:true,scope:'Actual original Newrecruit marker common dispatch, leaf, callback4101 and order retirement under one native source world with a projected clock base. No destination-world import or hero crossing.',
  phase:m.phase,trace,samples,preparation:m.preparation,sourceManifest:resolve(name),sourceManifestSha256:await hash(name),
  nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,nativeSymbolsSha256:build.nativeSymbolsSha256,
  maxSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),elapsedMs:m.finishedAtMs-m.startedAtMs,
  crossClockMarkerPairQualified:false,heroCrossingQualified:false,browserUsed:false,nativeProcessesStarted:0};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const [manifest,out]=process.argv.slice(2);assert.equal(process.argv.length,4,'Usage: <terminal marker manifest> <fresh proof>');
 const r=await inspectNativeMarkerClock(manifest);await writeFile(out,JSON.stringify(r,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({originalMarkerClockRunQualified:true,phase:r.phase,steps:r.trace.steps.length,completionAdvance:r.trace.completionAdvance,browserUsed:false}));
}
