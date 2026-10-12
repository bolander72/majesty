import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionRoute,requireSessionTrace,requirePanRouteInput,requireSessionPopulation} from '../scripts/inspect-native-region-session.mjs';

test('cooperative source population requires both original palace and agent witnesses',()=>{
  const state={counts:{units:2,agents:2},records:{units:{511:{},545:{}},agents:{21:{},51:{}}}};
  const witness=[{unitId:511,agentId:21},{unitId:545,agentId:51}];
  assert.doesNotThrow(()=>requireSessionPopulation(state,'0_0',{kingdomWitness:witness}));
  assert.throws(()=>requireSessionPopulation(state,'0_0'));
  for(const invalid of [witness.slice(0,1),[witness[0],witness[0]],
      [witness[0],{unitId:999,agentId:51}],[witness[0],{unitId:545,agentId:999}]])
    assert.throws(()=>requireSessionPopulation(state,'0_0',{kingdomWitness:invalid}));
});

if(process.env.MAJESTY_NATIVE_REBUILD_HOLD_TRACE)test('actual saved-world rebuild stays held through an original paused tick before local resume',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {createHash}=await import('node:crypto');
  const m=JSON.parse(await readFile(process.env.MAJESTY_NATIVE_REBUILD_HOLD_TRACE,'utf8'));
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
  try{process.kill(m.nativePid,0);assert.fail('native producer remains live');}catch(error){if(error.code!=='ESRCH')throw error;}
  const text=await readFile(m.log,'utf8');assert.equal(createHash('sha256').update(text).digest('hex'),m.logSha256);
  const trace=requireSessionTrace(m,text);assert.ok(trace.rebuildHolds.length>=8);
  for(const row of trace.rebuildHolds){
    const end=text.indexOf('\n',row.position),original=text.slice(row.position,end);
    for(const [key,value]of [['load','999'],['region','1_0'],['step','wrong'],['context','00000000'],
        ['phase','3'],['pending','99'],['owner','99'],['frame',String(+row.frame+1)],
        ['clock',String(+row.clock+1)],['gameplay-ticks',String(+row['gameplay-ticks']+1)],
        ['cpu-same','0'],['original','0'],['record-frees','2,2'],['hooks-same','0'],['network','1'],['result','fail']]){
      const changed=original.replace(new RegExp(`(^| )${key}=[^ ]+`),` ${key}=${value}`);
      assert.notEqual(changed,original);assert.throws(()=>requireSessionTrace(m,text.replace(original,changed)),`${row.step}/${key}`);
    }
    assert.throws(()=>requireSessionTrace(m,text.slice(0,row.position)+text.slice(end+1)));
    assert.throws(()=>requireSessionTrace(m,text+original+'\n'));
  }
  const lines=trace.rebuildHolds.slice(0,4).map(row=>text.slice(row.position,text.indexOf('\n',row.position)));
  let reordered=text.replace(lines[0],'__HOLD__').replace(lines[1],lines[0]).replace('__HOLD__',lines[1]);
  assert.throws(()=>requireSessionTrace(m,reordered));
});

test('multi-region route distinguishes new kingdoms from saved returns',()=>{
  const route=['0_0','-1_0','-2_0','-2_-1','-1_-1','-1_0','0_0',
    '-1_0','-2_0','-2_-1','-1_-1','-1_0','0_0'];
  const value=sessionRoute({route});
  assert.equal(value.visits,13);
  assert.deepEqual(value.directions,[0,0,1,3,2,3,0,0,1,3,2,3,4]);
  assert.deepEqual(value.modes,['new','new','new','new','saved','saved',
    'saved','saved','saved','saved','saved','saved']);
});

if(process.env.MAJESTY_NATIVE_LOADED_BINDING_TRACE)test('actual saved graphs select both fixture kingdoms and restore before attachment',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {createHash}=await import('node:crypto');
  const m=JSON.parse(await readFile(process.env.MAJESTY_NATIVE_LOADED_BINDING_TRACE,'utf8'));
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
  try{process.kill(m.nativePid,0);assert.fail('native producer remains live');}catch(error){if(error.code!=='ESRCH')throw error;}
  const text=await readFile(m.log,'utf8');assert.equal(createHash('sha256').update(text).digest('hex'),m.logSha256);
  const trace=requireSessionTrace(m,text);assert.ok(trace.loadedKingdomBindings.length>=2);
  const row=trace.loadedKingdomBindings[0];
  const original=text.slice(row.position,text.indexOf('\n',row.position));
  for(const [key,value]of [['load','1'],['region','1_0'],['context','00000000'],['slots','0,0'],['ids','0,1'],
      ['network','1'],['result','fail'],['graph-restored','0'],['party-restored','0'],['cpu-same','0'],['heap-same','0'],['hooks-same','0']]){
    const changed=original.replace(new RegExp(`(^| )${key}=[^ ]+`),`$1${key}=${value}`);
    assert.notEqual(changed,original);assert.throws(()=>requireSessionTrace(m,text.replace(original,changed)));
  }
  assert.throws(()=>requireSessionTrace(m,text.replace(original+'\n','')));
  assert.throws(()=>requireSessionTrace(m,text+'\n'+original+'\n'));
});

if(process.env.MAJESTY_NATIVE_PAN_ROUTE_TRACE)test('actual departures each require their own original camera edge gesture',async()=>{
  const {readFile}=await import('node:fs/promises');
  const {createHash}=await import('node:crypto');
  const m=JSON.parse(await readFile(process.env.MAJESTY_NATIVE_PAN_ROUTE_TRACE,'utf8'));
  assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
  try{process.kill(m.nativePid,0);assert.fail('native producer remains live');}catch(error){if(error.code!=='ESRCH')throw error;}
  const text=await readFile(m.log,'utf8');assert.equal(createHash('sha256').update(text).digest('hex'),m.logSha256);
  const trace=requireSessionTrace(m,text);assert.equal(trace.boundaries.length,m.route.length-1);
  assert.ok(trace.boundaries.length>=2);
  const input=await readFile(m.script,'utf8');
  assert.equal(createHash('sha256').update(input).digest('hex'),m.scriptSha256);
  assert.ok(requirePanRouteInput(m,input).executableSteps<=512);
  for(const [old,changed]of [['focus on','focus off'],['moveby 400 300','moveby 400 0'],
      ['moveby -2000 0','moveby 2000 0'],['wait 20800','wait 0'],['dump session_completed','dump wrong']]){
    assert.ok(input.includes(old));
    assert.throws(()=>requirePanRouteInput(m,input.replace(old,changed)));
  }
  assert.throws(()=>requirePanRouteInput(m,input+'moveby 0 0\n'));
  const reject=change=>{const bad=structuredClone(m);change(bad);assert.throws(()=>requireSessionTrace(bad,text));};
  reject(bad=>bad.boundaryTriggers.pop());
  reject(bad=>bad.boundaryTriggers[1].serial=0);
  reject(bad=>bad.boundaryTriggers[1].line=bad.boundaryTriggers[0].line);
  reject(bad=>bad.boundaryTriggers[1].observedAtMs=Number.MAX_SAFE_INTEGER);
  reject(bad=>bad.requestPublications.find(p=>p.kind==='boundary'&&p.serial===2).kind='travel');
  // Alter both record and trace so simple line-membership checks cannot hide a
  // forged non-edge, inward input, short hold, replayed gesture or wrong region.
  for(const [i,boundary]of trace.boundaries.entries()){
    const horizontal=['west','east'].includes(boundary.direction);
    const axis=horizontal?'x':'y',delta=horizontal?'dx':'dy';
    const inward=['west','north'].includes(boundary.direction)?'1':'-1';
    for(const [key,value] of [[axis,boundary[axis]===0?'1':'0'],[delta,inward],
        ['held-ms','999'],['gesture','0'],['region','999_999']]){
      const bad=structuredClone(m),old=bad.boundaryTriggers[i].line;
      const changed=old.replace(new RegExp(`(^| )${key}=[^ ]+`),`$1${key}=${value}`);
      assert.notEqual(changed,old);bad.boundaryTriggers[i].line=changed;
      assert.throws(()=>requireSessionTrace(bad,text.replace(old,changed)),`${boundary.direction}/${key}`);
    }
  }
  for(const row of trace.cameraArrivals??[]){
    const original=text.slice(row.position,text.indexOf('\n',row.position));
    for(const [key,value]of [['x',String(+row.x+1)],['y',String(+row.y+1)],
        ['clock',String(+row.clock+50)],['serial','0'],['region','999_999']]){
      const changed=original.replace(new RegExp(`(^| )${key}=[^ ]+`),`$1${key}=${value}`);
      assert.notEqual(changed,original);
      assert.throws(()=>requireSessionTrace(m,text.replace(original,changed)),`${row.direction}/arrival/${key}`);
    }
    assert.throws(()=>requireSessionTrace(m,text.replace(original+'\n','')));
    assert.throws(()=>requireSessionTrace(m,text+original+'\n'));
    const ready=`[frontier] Region ${row.region} ready\n`;
    const at=text.indexOf(ready,row.position);assert.ok(at>row.position);
    const later=text.slice(0,row.position)+text.slice(row.position,at+ready.length).replace(original+'\n','')+
      original+'\n'+text.slice(at+ready.length);
    assert.throws(()=>requireSessionTrace(m,later),'arrival must precede original readiness');
  }
});

test('rejects skipped regions, unbounded routes and probe collisions',()=>{
  for(const route of [[],['0_0','-1_0'],['0_0','-2_0','0_0'],
      ['0_0','0_-1','0_0'],['0_0','0_1','0_0'],
      ['0_0','-01_0','0_0'],['0_0','-1_-1','0_0'],
      ['0_0',...Array(18).fill('0_0')]])assert.throws(()=>sessionRoute({route}));
});

test('manifest direction codes cannot override coordinate adjacency',()=>{
  assert.throws(()=>sessionRoute({route:['0_0','-1_0','0_0'],directions:[3,0,4]}));
  assert.deepEqual(sessionRoute({route:['0_0','-1_0','0_0'],directions:[0,3,4]}).modes,['new','saved']);
});

test('endurance laps preserve one closed route and generate each kingdom only once',()=>{
  const baseRoute=['0_0','-1_0','-2_0','0_0'];
  // A closing move must also be adjacent; a skipped return cannot become valid
  // by repeating the route.
  assert.throws(()=>sessionRoute({baseRoute,routeLaps:4,route:Array(4).fill(baseRoute.slice(0,-1)).flat().concat('0_0')}));
  const base=['0_0','-1_0','-2_0','-1_0','0_0'];
  const route=Array.from({length:4},()=>base.slice(0,-1)).flat().concat('0_0');
  const value=sessionRoute({baseRoute:base,routeLaps:4,route});
  assert.equal(value.visits,17);assert.equal(value.modes.filter(m=>m==='new').length,2);
  assert.equal(value.modes.filter(m=>m==='saved').length,14);assert.equal(value.directions.at(-1),4);
  for(const bad of [0,5,1.5,NaN,'4',true,null])assert.throws(()=>sessionRoute({baseRoute:base,routeLaps:bad,route}));
  assert.throws(()=>sessionRoute({routeLaps:4,route}));
  assert.throws(()=>sessionRoute({baseRoute:base,routeLaps:3,route}));
  const changed=[...route];changed[7]='-3_0';assert.throws(()=>sessionRoute({baseRoute:base,routeLaps:4,route:changed}));
});

test('four thirteen-visit laps admit 49 visits while arbitrary long routes still refuse',()=>{
  const baseRoute=['0_0','-1_0','-2_0','-2_-1','-1_-1','-1_0','0_0',
    '-1_0','-2_0','-2_-1','-1_-1','-1_0','0_0'];
  const route=Array.from({length:4},()=>baseRoute.slice(0,-1)).flat().concat('0_0');
  const value=sessionRoute({baseRoute,routeLaps:4,route});
  assert.equal(value.visits,49);assert.equal(value.modes.filter(m=>m==='new').length,4);
  assert.throws(()=>sessionRoute({route}));
  const longestBase=Array.from({length:17},(_,i)=>i%2?'-1_0':'0_0');
  const longest=Array.from({length:4},()=>longestBase.slice(0,-1)).flat().concat('0_0');
  assert.equal(sessionRoute({baseRoute:longestBase,routeLaps:4,route:longest}).visits,65);
  assert.throws(()=>sessionRoute({baseRoute:longestBase,routeLaps:4,route:longest.concat('-1_0','0_0')}));
});
