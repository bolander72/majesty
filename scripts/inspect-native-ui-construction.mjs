#!/usr/bin/env node
// Inspect stopped original UI construction evidence; no game process is started.
import assert from 'node:assert/strict';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {stoppedFileSource,ownedDirectory} from './lib/stopped-entity-io.mjs';
import {checkpointUnits,checkpointPlacements,checkpointAgentValues} from '../web/world/checkpoint.mjs';
const sha=async p=>(await hashNativeFile(p)).sha256;
async function attributes(source,unit){
 const p=unit.components.find(x=>x.tag==='PRIM');assert.equal(p.version,9);
 const word=async at=>{assert.ok(at>=p.offset+16&&at+4<=p.end);const b=await source.readAt(at,4);return new DataView(b.buffer,b.byteOffset,4).getUint32(0,true);};
 const optional=await word(p.offset+64);assert.ok(optional<=1);
 let at=p.offset+76;if(optional){assert.equal(await word(at),1);at+=16;}
 assert.equal(await word(at),1);const count=await word(at+4);assert.ok(count<=256&&at+8+count*8<=p.end);
 let previous=-1;const values={};
 for(let i=0;i<count;i++){
  const key=await word(at+8+i*8),value=await word(at+12+i*8);assert.ok(key>previous);previous=key;
  if([0x4541,0x00555041,0x01425041].includes(key))values[key.toString(16)]=value;
 }
 return {agent:values['4541'],hp:values['555041'],completed:values['1425041']};
}
async function main(){
 const [input,out]=process.argv.slice(2);assert.ok(input&&out);
 try{await stat(out);throw Error('Preserve earlier proof');}catch(e){if(e.code!=='ENOENT')throw e;}
 const m=JSON.parse(await readFile(input,'utf8')),build=JSON.parse(await readFile(m.buildReport,'utf8'));
 assert.equal(m.phase,'construction-ui');assert.equal(m.uiStep,'guild');assert.equal(m.nativeSessionTerminal,true);
 assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);assert.equal(m.constructionUiFramesCaptured,true);
 await verifyConnectedNativeArtifact(m,build);
 await ownedDirectory(m.fixture,'actor-arrival-fixture-construction-ui-');
 for(const [path,digest]of [[m.buildReport,m.buildReportSha256],[m.source,m.sourceSha256],[m.receipt,m.receiptSha256],
  [m.publicationManifest,m.publicationManifestSha256],[m.previousManifest,m.previousManifestSha256],[m.script,m.scriptSha256],[m.log,m.logSha256],
  ['scripts/run-native-construction-ui.py',m.runnerSha256]])assert.equal(await sha(path),digest);
 for(const flag of ['originalSourceUnchanged','originalSettingsUnchanged','publicationUnchanged','receiptUnchanged'])assert.equal(m[flag],true);
 for(const [name,digest]of Object.entries(m.inputHashes))assert.equal(await sha(join(m.settingsProfile,name)),digest);
 const script=await readFile(m.script,'utf8');
 assert.ok(!/^(poke|env|patch|call|simdump|text)\b/m.test(script));
 assert.ok(script.includes('move 750 585')&&script.includes('move 350 265')&&script.includes('move 150 565'));
 assert.ok((await stat(m.log)).size<1024*1024);const log=await readFile(m.log,'utf8');
 assert.ok(log.includes('all expectations met')&&log.includes('guest exit code:    0')&&log.includes('undeliverable calls: none'));
 const queries=[...log.matchAll(/^\[construction\] collision actor=([a-f0-9]{8}) point=(\d+),(\d+) map=(\d+)x(\d+) flags=(1800|1100) result=(\d)$/gm)];
 assert.equal(queries.length,2);assert.equal(queries[0][1],queries[1][1]);
 for(const q of queries){assert.equal(q[2],queries[0][2]);assert.equal(q[3],queries[0][3]);assert.equal(q[4],'256');assert.equal(q[5],'256');assert.equal(q[7],'0');}
 assert.deepEqual(queries.map(q=>q[6]),['1800','1100']);
 const grid={x:Number(queries[0][2]),y:Number(queries[0][3])};assert.ok(grid.x>=16&&grid.x<=240&&grid.y>=16&&grid.y<=240);
 assert.ok(!log.includes('[campaign-fixture]')); // No attribute-toggle fixture.
 const names=['palace_selected','construction_menu','guild_selected','guild_preview','guild_after_placement','construction_saved'];
 for(const name of names){const f=m.frames.find(x=>basename(x.filename)===`smoke_${name}_present.ppm`);assert.ok(f);assert.equal(await sha(f.filename),f.sha256);}
 const duration=m.finishedAtMs-m.startedAtMs,maxRss=Math.max(...m.resourceSamples.map(x=>x.rssBytes));
 assert.ok(duration>0&&duration<=112000&&maxRss<=512*1024*1024);assert.ok(m.resourceSamples.every(x=>x.pid===m.nativePid));
 const original=await stoppedFileSource(m.source),oldIds=new Set();
 for await(const u of checkpointUnits(original)){assert.ok(oldIds.size<4096);oldIds.add(u.primary.words[1]);}
 const saved=m.saves.filter(s=>s.sha256!==m.sourceSha256);assert.equal(saved.length,1,'Require one new original Save Game file');
 const save=saved[0];assert.ok(resolve(save.filename).startsWith(resolve(m.profile)+'/Documents/My Games/MajestyHD/SaveGame/'));
 assert.equal(await sha(save.filename),save.sha256);const source=await stoppedFileSource(save.filename),created=[];let units=0;
 for await(const u of checkpointUnits(source)){
  assert.ok(++units<=4096);
  if(!oldIds.has(u.primary.words[1])&&u.family==='BLDG'&&u.primary.description===0x31564241&&(u.primary.words[5]|0)===0){
   assert.equal(u.primary.words[2]&4,0);const a=await attributes(source,u);assert.ok(a.agent>0&&a.hp>0&&a.hp<=700&&[0,1].includes(a.completed));
   let count=0;for await(const value of checkpointAgentValues(source,a.agent))assert.ok(++count<=512);
   assert.ok(count>0);created.push({id:u.primary.words[1],description:'ABV1',owner:0,...a});
  }
 }
 assert.equal(created.length,1,'Require one newly constructed player-zero Warriors Guild');
 let located=false;
 for await(const p of checkpointPlacements(source))if(p.unitId===created[0].id){assert.equal(located,false);located=true;assert.deepEqual(p.mapPosition,{x:grid.x*16,y:grid.y*16});}
 assert.equal(located,true);
 const report={version:1,validatedPlacement:grid,originalGuildFoundationQualified:true,originalGuildCompletionQualified:created[0].completed===1,
  cooperativeChapterQualified:false,browserUsed:false,observed:created[0],nativePid:m.nativePid,durationMs:duration,maximumSampledRssBytes:maxRss,
  inputSha256:await sha(input),saved:save,scope:'One original solo kingdom, ordinary construction and Save Game mouse input. No co-op roster, shared outcome or browser qualification.',
  sourceSha256:{inspector:await sha('scripts/inspect-native-ui-construction.mjs'),runner:m.runnerSha256}};
 await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({foundation:true,completed:report.originalGuildCompletionQualified,observed:created[0],cooperativeChapterQualified:false}));
}
main().catch(e=>{console.error(JSON.stringify({qualified:false,error:e.message.slice(0,350)}));process.exitCode=1;});
