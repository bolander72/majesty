import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {requireSessionTrace,requireRestoredCameraTrace} from '../scripts/inspect-native-region-session.mjs';
import {connectedWorldState} from '../scripts/lib/connected-residency.mjs';
import {compareCameraArrivalStates} from '../scripts/lib/camera-arrival-state.mjs';
import {stoppedFileSource,workspace} from '../scripts/lib/stopped-entity-io.mjs';
import {checkpointChunks} from '../web/world/checkpoint.mjs';

test('actual original restoration precedes arrival and only its saved camera coordinates change',
  {skip:!process.env.MAJESTY_NATIVE_BEFORE_CAMERA_TRACE},async()=>{
  const name=process.env.MAJESTY_NATIVE_BEFORE_CAMERA_TRACE,raw=await readFile(name),m=JSON.parse(raw);
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
  try{process.kill(m.nativePid,0);assert.fail('Native producer still live');}catch(error){if(error.code!=='ESRCH')throw error;}
  const text=await readFile(m.log,'utf8'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash(text),m.logSha256);
  const trace=requireSessionTrace(m,text),rows=requireRestoredCameraTrace(m,text,trace),refusals=[];
  const rejectTrace=(label,change)=>{
    const meta=structuredClone(m);const changed=change(meta,text)??text;
    assert.throws(()=>requireRestoredCameraTrace(meta,changed,requireSessionTrace(meta,changed)),label);refusals.push(label);
  };
  rejectTrace('missing before-camera capture',meta=>{meta.restoredCaptures.pop();});
  rejectTrace('wrong capture serial',meta=>{meta.restoredCaptures[1].serial=0;});
  rejectTrace('wrong capture clock',meta=>{meta.restoredCaptures[1].clock+=50;});
  rejectTrace('wrong captured camera',meta=>{meta.restoredCaptures[1].cameraX+=1;});
  rejectTrace('missing original capture event',(_,log)=>log.replace(/^\[frontier\] Session restored snapshot .*\n/m,''));
  rejectTrace('duplicate original capture event',(_,log)=>log+log.match(/^\[frontier\] Session restored snapshot .*$/m)[0]+'\n');
  for(const row of rows){
    const original=text.slice(row.position,text.indexOf('\n',row.position));
    for(const [key,value]of [['before-arrival','0'],['ordinary-ticks','1'],['guards','1'],
        ['world-same','0'],['hooks-same','0'],['saved','0']]){
      rejectTrace(`${row.serial}/${key}`,(_,log)=>log.replace(original,original.replace(`${key}=${row[key]}`,`${key}=${value}`)));
    }
    if(+row.serial){
      const arrival=trace.cameraArrivals[+row.serial-1],end=text.indexOf('\n',arrival.position)+1;
      rejectTrace(`${row.serial}/capture after arrival`,(_,log)=>log.slice(0,row.position)+
        log.slice(row.position,end).replace(original+'\n','')+original+'\n'+log.slice(end));
    }
  }
  const results=[];let changedPair;
  for(let i=0;i<rows.length;++i){
    const before=await connectedWorldState(m.restoredCaptures[i].file),after=await connectedWorldState(m.readyCaptures[i].file);
    const origin={x:m.restoredCaptures[i].cameraX,y:m.restoredCaptures[i].cameraY};
    const arrival=i?trace.cameraArrivals[i-1]:null,destination=arrival?{x:+arrival.x,y:+arrival.y}:origin;
    const result=await compareCameraArrivalStates(before,after,origin,destination);results.push({serial:i,...result});
    if(result.cameraChanged)changedPair={before,after,origin,destination};
  }
  assert.ok(changedPair,'Actual input must exercise a changed saved camera');
  const {before,after,origin,destination}=changedPair;
  const rejectState=async(label,change)=>{
    const copy=structuredClone(after);change(copy);
    await assert.rejects(compareCameraArrivalStates(before,copy,origin,destination));refusals.push(label);
  };
  await rejectState('changed game clock',s=>{s.clock+=50;});
  await rejectState('changed scripting RNG',s=>{++s.rng;});
  await rejectState('changed gameplay RNG',s=>{++s.gameplayRng;});
  await rejectState('changed typed unit',s=>{s.records.units[Object.keys(s.records.units)[0]]='0'.repeat(64);});
  await rejectState('changed terrain section',s=>{s.roots.find(r=>r.tag==='MTER').sha256='0'.repeat(64);});
  await assert.rejects(compareCameraArrivalStates(before,after,origin,{...destination,x:destination.x+1}));
  refusals.push('wrong declared arrival origin');

  const directory=await mkdtemp(join(workspace,'upstream/majesty-recomp/build/actor-arrival-fixture-camera-control-'));
  const source=await stoppedFileSource(after.filename);let section;
  for await(const chunk of checkpointChunks(source))if(chunk.tag==='GSGL')section=chunk;
  assert.ok(section&&source.size<=2*1024*1024);
  const bytes=Buffer.alloc(source.size);
  for(let at=0;at<bytes.length;at+=4096)bytes.set(await source.readAt(at,Math.min(4096,bytes.length-at)),at);
  const mutatedFiles=[];
  for(const [label,offset]of [['wrong camera',0],['non-camera saved field',16]]){
    const copy=Buffer.from(bytes);copy[section.offset+16+offset]^=1;
    const filename=join(directory,offset===0?'Wrong_Camera.GMP':'Wrong_Suffix.GMP');await writeFile(filename,copy,{flag:'wx'});
    // Reparse the altered file and its valid new digest, so refusal cannot
    // rely solely on a stale whole-file hash or a fabricated state object.
    const altered=await connectedWorldState(filename);
    await assert.rejects(compareCameraArrivalStates(before,altered,origin,destination));
    refusals.push(label);mutatedFiles.push({filename,sha256:hash(copy),bytes:copy.length});
  }
  assert.equal(hash(await readFile(after.filename)),after.sha256);
  assert.equal(hash(await readFile(name)),hash(raw));assert.equal(hash(await readFile(m.log)),m.logSha256);
  if(process.env.MAJESTY_NATIVE_BEFORE_CAMERA_CONTROLS){
    await writeFile(resolve(process.env.MAJESTY_NATIVE_BEFORE_CAMERA_CONTROLS),JSON.stringify({version:1,
      beforeCameraControlsQualified:true,manifest:resolve(name),manifestSha256:hash(raw),logSha256:m.logSha256,
      transforms:results,refusals,mutatedFiles,browserUsed:false,nativeProcessesStarted:0,
      scope:'Actual stopped full-save pairs and contradictory copies; original input files remain unchanged.'},null,2)+'\n',{flag:'wx'});
  }
});
