#!/usr/bin/env node
// Independently inspect stopped original generation, disposal and saved returns.
import assert from 'node:assert/strict';
import {readFile,stat,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ownedDirectory,stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {verifyConnectedNativeArtifact} from './lib/connected-native-artifact.mjs';
import {verifyRevisionExport} from './export-native-entity-revision.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {parseRealmManifest} from '../web/world/realm-store.mjs';
const hash=async path=>(await hashNativeFile(path)).sha256;
async function json(path){assert.ok((await stat(path)).size<=256*1024);return JSON.parse(await readFile(path,'utf8'));}
function rows(log,prefix,first){const result=[];let position=0;for(const line of log.split('\n')){
  const at=position;position+=line.length+1;
  if(!line.startsWith(prefix)||first&&!line.slice(prefix.length).startsWith(first+'='))continue;
  const row={position:at};
  for(const token of line.slice(prefix.length).split(' ')){const at=token.indexOf('=');assert.ok(at>0);const k=token.slice(0,at);assert.ok(!Object.hasOwn(row,k));row[k]=token.slice(at+1);}
  result.push(row);
}return result;}
function number(row,key){assert.match(row[key],/^\d+$/);const n=Number(row[key]);assert.ok(Number.isSafeInteger(n));return n;}
function wireHash(words){
  assert.ok(Array.isArray(words)&&words.length===9&&words.every(v=>Number.isInteger(v)&&v>=0&&v<=0xffffffff));
  const bytes=Buffer.alloc(36);words.forEach((v,i)=>bytes.writeUInt32LE(v,i*4));return createHash('sha256').update(bytes).digest('hex');
}
// Contradictory controls use the actual stopped native trace, without another
// game or repeated full-save/receipt parsing. Full inspection still checks data.
export function requireExpansionTrace(m,log){
  const count=m.coordinateRoute.length;assert.ok(count===3||count===5);
  assert.deepEqual(m.coordinateRoute,count===3?['0_0','-1_0','0_0']:['0_0','-1_0','0_0','-1_0','0_0']);
  assert.ok(log.includes('all expectations met'));assert.ok(!/result=fail|SIGSEGV|abort from|exception e06d7363|undeliverable call(?!s: none)/i.test(log));
  const ready=rows(log,'[streaming] World coordinate-ready '),admitted=rows(log,'[streaming] World coordinate-request accepted '),refused=rows(log,'[streaming] World coordinate-request refused ');
  const loads=rows(log,'[streaming] World residency ','load'),exits=rows(log,'[streaming] World residency ','exit');
  const contexts=rows(log,'[frontier] Region context '),generated=rows(log,'[frontier] Region generated '),expansions=rows(log,'[streaming] World expansion admitted ');
  const completed=rows(log,'[streaming] World checkpoint completed '),commits=rows(log,'[streaming] World coordinate-checkpoint ');
  for(const list of [ready,admitted,loads,exits,contexts,completed,commits])assert.equal(list.length,count);
  assert.equal(generated.length,1);assert.equal(expansions.length,1);assert.equal(refused.length,3);
  for(const kind of ['rng','gameplay-rng']){
    const seeds=rows(log,`[streaming] World persistence ${kind} `);
    assert.deepEqual(seeds.map(r=>number(r,'visit')),Array.from({length:count},(_,i)=>i).filter(i=>i!==1));
    for(const row of seeds){assert.equal(row.saved,row.after);assert.equal(row['clock-same'],'1');assert.equal(row['hooks-same'],'1');assert.equal(row.result,'pass');}
  }
  assert.deepEqual(m.actualProbeRefusals,['non-neighbor','partial','stale']);
  assert.equal(m.readyPublications.length,count);assert.equal(m.requestPublications.length,count+3);
  assert.deepEqual([generated[0].key,generated[0].phase,generated[0].pending,generated[0]['hooks-same'],generated[0]['original-preset'],generated[0].result],['-1_0','1','2','1','00446910','pass']);
  assert.deepEqual([expansions[0].visit,expansions[0].target,expansions[0]['marker-absent'],expansions[0]['slots-absent'],expansions[0].result],['0','-1_0','1','2','pass']);
  const bad=m.requestPublications.filter(p=>!['travel','finish'].includes(p.kind));assert.deepEqual(bad.map(p=>p.kind),['stale','partial','non-neighbor']);
  for(let i=0;i<bad.length;++i){const r=refused[i],p=bad[i];assert.equal(r.visit,'0');assert.equal(number(r,'serial'),p.words[2]);assert.equal(r.target,`${p.words[5]|0}_${p.words[6]|0}`);
    assert.equal(p.sha256,wireHash(p.words));for(const k of ['world-same','clock-same','hooks-same','exact'])assert.equal(r[k],'1');assert.equal(r.available,'0');assert.equal(r.result,'pass');assert.ok(r.position<admitted[0].position);}
  const requests=m.requestPublications.filter(p=>['travel','finish'].includes(p.kind));
  for(let i=0;i<count;++i){
    const r=ready[i],a=admitted[i],key=m.coordinateRoute[i],target=m.coordinateRoute[i+1]??key;
    const [sx,sy]=key.split('_').map(Number),[tx,ty]=target.split('_').map(Number);
    const words=[0x32565254,2,i+1,sx>>>0,sy>>>0,sx>>>0,sy>>>0,number(r,'clock'),i+1===count?2:0];
    assert.deepEqual(m.readyPublications[i].words,words);assert.equal(m.readyPublications[i].sha256,wireHash(words));
    const expected=[...words];expected[5]=tx>>>0;expected[6]=ty>>>0;expected[8]=i+1===count?2:1;
    assert.deepEqual(requests[i].words,expected);assert.equal(requests[i].sha256,wireHash(expected));
    assert.equal(requests[i].kind,i+1===count?'finish':'travel');
    assert.deepEqual([number(r,'visit'),number(r,'serial'),r.source,number(r,'operation'),r.result],[i,i+1,key,words[8],'pass']);
    assert.deepEqual([number(a,'visit'),number(a,'serial'),a.source,a.target,number(a,'operation'),a.result],[i,i+1,key,target,expected[8],'pass']);
    for(const k of ['world-same','clock-same','hooks-same','consumed'])assert.equal(a[k],'1');
    assert.equal(contexts[i].key,key);assert.equal(number(contexts[i],'generate'),i===1?1:0);assert.equal(contexts[i]['world-null'],'1');
    assert.equal(number(exits[i],'exit'),i);assert.equal(exits[i]['roots-freed'],'1,1,1,1,1,1');assert.equal(exits[i]['world-null'],'1');assert.equal(exits[i]['heap-valid'],'1');
    assert.equal(commits[i].region,key);assert.equal(commits[i].published,'1');assert.equal(number(commits[i],'visit'),i);
    assert.equal(number(completed[i],'completed-ticks'),m.completedTicksByVisit[i]);
    assert.equal(number(a,'initial-clock'),number(r,'clock'));
    assert.equal(number(a,'current-clock'),number(completed[i],'clock'));
    assert.ok(r.position<a.position&&a.position<commits[i].position&&commits[i].position<exits[i].position);
    if(i)assert.ok(exits[i-1].position<contexts[i].position&&contexts[i].position<r.position);
  }
  assert.ok(expansions[0].position<exits[0].position&&exits[0].position<generated[0].position&&generated[0].position<ready[1].position);
  return {visits:count,refusals:refused.length,generated:generated.length};
}
export async function inspectCoordinateExpansion(name){
  name=resolve(name);const m=await json(name);
  assert.deepEqual([m.version,m.phase,m.coordinateExpansionVersion,m.nativeOnly,m.browserUsed,m.nativeSessionTerminal,m.nativeExitCode,m.stopReason],
    [1,'coordinate-expansion','v1',true,false,true,0,null]);
  assert.ok(Number.isInteger(m.nativePid)&&m.nativePid>0);
  try{process.kill(m.nativePid,0);assert.fail('Native process remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const dir=await ownedDirectory(m.fixture,'actor-arrival-fixture-connected-residency-');assert.equal(m.profile,join(dir,'frontier_0_0'));
  const count=m.coordinateRoute.length;
  assert.deepEqual(m.coordinateRoute,count===3?['0_0','-1_0','0_0']:['0_0','-1_0','0_0','-1_0','0_0']);
  assert.ok(count===3||count===5);
  assert.equal(await hash(m.buildReport),m.buildReportSha256);const build=await json(m.buildReport);
  assert.equal(build.nativeBuildQualified,true);assert.equal(build.exitCode,0);await verifyConnectedNativeArtifact(m,build);
  const runner=resolve('scripts/run-native-coordinate-expansion.py');
  if(await hash(runner)!==m.runnerSha256){
    assert.equal(m.runnerSha256,'1fb04495d6fcba7460325b966a3b56ce9260d3e2cf37909d684781ead08aa18c');
    assert.equal(await hash(resolve('output/native-coordinate-expansion-before-revisit-run-native-coordinate-expansion.py')),m.runnerSha256);
  }
  assert.equal(await hash(m.script),m.scriptSha256);
  assert.equal(m.script,join(dir,'coordinate-expansion.script'));
  assert.equal(await readFile(m.script,'utf8'),'wait 35000\ndump coordinate_expansion_completed\n');
  for(const k of ['publicationUnchanged','receiptUnchanged','originalSelectedWorldsUnchanged','originalSettingsUnchanged','orphanUnchanged','unexploredPathsAbsentBeforeLaunch'])assert.equal(m[k],true);
  assert.equal(await hash(m.receipt),m.receiptSha256);assert.equal(await hash(m.publicationManifest),m.publicationManifestSha256);
  const receipt=await json(m.receipt);assert.equal(receipt.revisionReport,m.publicationManifest);
  const selected=[];for(let side=0;side<2;++side)selected.push(await verifyRevisionExport(m.receipt,side,receipt.worlds[side].sha256));
  assert.deepEqual(selected,m.selectedRevisionExports);assert.equal(selected[0].owner.region,'0_0');assert.equal(selected[0].revision,2);
  for(const[n,digest]of Object.entries(m.inputHashes))assert.equal(await hash(join(m.settingsProfile,n)),digest);
  assert.equal(m.initialHome,join(m.profile,'Residency_Region_0_0.GMP'));assert.equal(m.initialHomeSha256,selected[0].sha256);
  assert.equal(m.coordinateCheckpointContent,'coordinate-v1:'+m.nativeExecutableSha256);
  const initial=parseRealmManifest(m.initialHomeMarker,m.coordinateCheckpointContent);
  assert.deepEqual([initial.slot,initial.sha256,initial.size],[0,selected[0].sha256,(await stat(selected[0].filename)).size]);
  assert.equal(m.unexploredRegion,'-1_0');assert.deepEqual(m.unexploredPaths,['.GMP','_Recovery.GMP','.checkpoint'].map(s=>join(m.profile,'Residency_Region_-1_0'+s)));
  assert.equal(m.preservedOrphan,join(m.profile,'Residency_Region_0_1_Recovery.GMP'));assert.equal(await hash(m.preservedOrphan),m.preservedOrphanSha256);
  assert.deepEqual(await readFile(m.preservedOrphan),Buffer.from([0]));
  assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);
  const log=await readFile(m.log,'utf8');assert.ok(log.includes('all expectations met'));
  requireExpansionTrace(m,log);
  assert.ok(!/result=fail|SIGSEGV|abort from|exception e06d7363|undeliverable call(?!s: none)/i.test(log));
  const ready=rows(log,'[streaming] World coordinate-ready '),admitted=rows(log,'[streaming] World coordinate-request accepted '),refused=rows(log,'[streaming] World coordinate-request refused ');
  const loadRows=rows(log,'[streaming] World residency ','load');
  const exits=rows(log,'[streaming] World residency ','exit');
  const completed=rows(log,'[streaming] World checkpoint completed '),boundaries=rows(log,'[streaming] World checkpoint exit ');
  const snapshots=rows(log,'[streaming] World coordinate-snapshot '),commits=rows(log,'[streaming] World coordinate-checkpoint ');
  const attached=rows(log,'[streaming] World auto-load attached '),contexts=rows(log,'[frontier] Region context '),generated=rows(log,'[frontier] Region generated ');
  const expansions=rows(log,'[streaming] World expansion admitted ');
  for(const list of [ready,admitted,loadRows,exits,completed,boundaries,commits,attached,contexts])assert.equal(list.length,count);
  assert.equal(snapshots.length,count*2);assert.equal(generated.length,1);assert.equal(expansions.length,1);
  assert.deepEqual([generated[0].key,generated[0].phase,generated[0].pending,generated[0]['hooks-same'],generated[0]['original-preset'],generated[0].result],['-1_0','1','2','1','00446910','pass']);
  assert.deepEqual([expansions[0].visit,expansions[0].target,expansions[0]['marker-absent'],expansions[0]['slots-absent'],expansions[0].result],['0','-1_0','1','2','pass']);
  assert.equal(refused.length,3);assert.deepEqual(m.actualProbeRefusals,['non-neighbor','partial','stale']);
  assert.equal(m.requestPublications.length,count+3);assert.equal(m.readyPublications.length,count);
  const bad=m.requestPublications.filter(p=>!['travel','finish'].includes(p.kind));assert.deepEqual(bad.map(p=>p.kind),['stale','partial','non-neighbor']);
  for(let i=0;i<3;++i){const r=refused[i],p=bad[i];assert.equal(r.visit,'0');assert.equal(number(r,'serial'),p.words[2]);assert.equal(r.target,`${p.words[5]|0}_${p.words[6]|0}`);
    for(const k of ['world-same','clock-same','hooks-same','exact'])assert.equal(r[k],'1');assert.equal(r.available,'0');assert.equal(r.result,'pass');assert.ok(r.position<admitted[0].position);}
  const source=await connectedWorldState(selected[0].filename);
  const visits=[],latest=new Map();let previousExit=-1;
  for(let i=0;i<count;++i){
    const key=m.coordinateRoute[i],r=ready[i],a=admitted[i],exit=exits[i],complete=completed[i],boundary=boundaries[i],commit=commits[i],context=contexts[i];
    for(const row of [r,a,exit,complete,boundary,commit,context])assert.equal(row.result,'pass');
    assert.equal(r.source,key);assert.equal(number(r,'serial'),i+1);assert.equal(number(r,'visit'),i);assert.equal(number(a,'visit'),i);
    assert.equal(number(a,'serial'),i+1);assert.equal(a.source,key);assert.equal(a.target,m.coordinateRoute[i+1]??key);assert.equal(number(a,'operation'),i+1===count?2:1);
    for(const k of ['world-same','clock-same','hooks-same','consumed'])assert.equal(a[k],'1');
    assert.equal(context.key,key);assert.equal(number(context,'generate'),i===1?1:0);assert.equal(context['world-null'],'1');
    assert.equal(number(loadRows[i],'load'),i);assert.equal(number(loadRows[i],'extent'),256);
    assert.equal(number(exit,'exit'),i);assert.equal(exit['roots-freed'],'1,1,1,1,1,1');assert.equal(exit['world-null'],'1');assert.equal(exit['heap-valid'],'1');assert.equal(exit['hooks-same'],'1');
    assert.ok(number(exit,'heap-after')<number(exit,'heap-before'));assert.ok(number(exit,'crt-after')<number(exit,'crt-before'));
    const ticks=number(complete,'completed-ticks');assert.ok(ticks>0&&ticks<=200);assert.equal(ticks,m.completedTicksByVisit[i]);
    assert.equal(number(complete,'visit'),i);assert.equal(number(boundary,'visit'),i);assert.equal(boundary.clock,boundary['saved-clock']);assert.equal(boundary.tick,boundary['saved-tick']);
    const options={};
    const before=await connectedWorldState(join(m.profile,`Residency_Visit_${i}_Before.GMP`),options),after=await connectedWorldState(join(m.profile,`Residency_Visit_${i}_After.GMP`),options);
    assert.equal(before.clock,number(r,'clock'));assert.equal(after.clock,number(complete,'clock'));assert.equal(after.clock-before.clock,ticks*50);
    const baseline=latest.get(key)??(key==='0_0'?source:null);
    const comparison=baseline?compareConnectedWorlds(baseline,before):null;
    const beforeRow=snapshots[i*2],afterRow=snapshots[i*2+1];
    for(const[row,stage,value]of [[beforeRow,'before',before],[afterRow,'after',after]]){
      assert.equal(number(row,'visit'),i);assert.equal(row.region,key);assert.equal(row.stage,stage);assert.equal(number(row,'clock'),value.clock);assert.equal(row.result,'pass');assert.equal(row['latest-published'],stage==='after'?'1':'0');}
    assert.equal(number(commit,'visit'),i);assert.equal(commit.region,key);assert.equal(commit.published,'1');
    const final=join(m.profile,`Residency_Visit_${i}_After.GMP`);assert.equal(commit.digest,await hash(final));assert.equal(number(commit,'bytes'),(await stat(final)).size);
    assert.ok(previousExit<context.position&&context.position<attached[i].position&&attached[i].position<r.position&&r.position<a.position&&a.position<commit.position&&commit.position<exit.position);
    assert.equal(attached[i]['world-null'],undefined);assert.equal(attached[i]['hooks-same'],'1');assert.equal(attached[i].world,loadRows[i].world);
    if(i===1){assert.ok(expansions[0].position<exits[0].position&&exits[0].position<generated[0].position&&generated[0].position<attached[1].position);assert.equal(generated[0].world,loadRows[1].world);}
    previousExit=exit.position;latest.set(key,after);visits.push({region:key,before,after,restoredPreviousSave:baseline!==null,comparison,ticks,slot:number(commit,'slot')});
  }
  for(const[key,last]of latest){const marker=join(m.profile,`Residency_Region_${key}.checkpoint`),record=parseRealmManifest(await readFile(marker,'utf8'),m.coordinateCheckpointContent);
    const lastVisit=m.coordinateRoute.lastIndexOf(key),expected=join(m.profile,`Residency_Visit_${lastVisit}_After.GMP`),selectedFile=join(m.profile,`Residency_Region_${key}${record.slot?'_Recovery':''}.GMP`);
    assert.equal(record.size,(await stat(expected)).size);assert.equal(record.sha256,await hash(expected));assert.equal(await hash(selectedFile),record.sha256);assert.equal(last.clock,visits[lastVisit].after.clock);}
  const homeFile=await stoppedFileSource(join(m.profile,'Residency_Visit_0_Before.GMP')),westFile=await stoppedFileSource(join(m.profile,'Residency_Visit_1_Before.GMP'));
  const homeTerrain=await checkpointTerrain(homeFile),westTerrain=await checkpointTerrain(westFile);
  for(let y=0;y<=128;++y)assert.deepEqual(await homeFile.readAt(homeTerrain.heightOffset(0,y),4),await westFile.readAt(westTerrain.heightOffset(128,y),4));
  const seedRows=rows(log,'[streaming] World persistence rng ');assert.equal(seedRows.length,count-1);assert.ok(seedRows.every(r=>r.visit!=='1'));
  return {version:1,qualified:true,actualUnexploredKingdomGenerated:true,generatedKingdomReturnedWithoutRegeneration:count===5,
    comparedSavedReturnsQualified:true,sharedBorderVertices:129,actualRefusals:refused.length,trackedRootFrees:count*6,
    sourceManifest:name,sourceManifestSha256:await hash(name),nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,
    visits,completedTicks:visits.reduce((n,v)=>n+v.ticks,0),durationMs:m.durationMs,maximumSampledRssBytes:Math.max(...m.resourceSamples.map(s=>s.rssBytes)),
    browserUsed:false,continuousBrowserTravelQualified:false,heroCrossingQualified:false,cooperativeActivationQualified:false,
    sustainedNativeMemoryBoundQualified:false,browserMemoryBoundQualified:false,scriptSha256:await hash(new URL(import.meta.url)),
    scope:'One native process creates an actually absent western kingdom through the original preset, plays and returns through digest-verified saves. No browser delivery, spatial hero crossing, co-op activation or sustained memory bound claim.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const[name,out]=process.argv.slice(2);assert.equal(process.argv.length,4);
  const result=await inspectCoordinateExpansion(name);await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified:true,visits:result.visits.length,completedTicks:result.completedTicks,returnedGeneratedKingdom:result.generatedKingdomReturnedWithoutRegeneration}));}
