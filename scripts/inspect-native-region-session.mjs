#!/usr/bin/env node
// Inspect stopped named-profile travel, actual native checkpoints and clocks.
// This does not substitute for before/after full-state restoration comparison.
import assert from 'node:assert/strict';
import {readFile,stat,writeFile,lstat,readlink,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ownedDirectory,stoppedFileSource,workspace} from './lib/stopped-entity-io.mjs';
import {hashNativeFile} from './lib/native-generation.mjs';
import {sessionCompiledSourceHashes} from './lib/session-compiled-inputs.mjs';
import {connectedWorldState,compareConnectedWorlds} from './lib/connected-residency.mjs';
import {compareCameraArrivalStates} from './lib/camera-arrival-state.mjs';
import {checkpointTerrain} from '../web/world/terrain.mjs';
import {checkpointActorRecords,checkpointAgentValues,checkpointContainerEntries,checkpointPlacements} from '../web/world/checkpoint.mjs';
import {compareTerrainSeam} from '../web/world/terrain-seam.mjs';
import {parseRealmManifest} from '../web/world/realm-store.mjs';
import {cooperativeKingdoms} from './inspect-native-coop-world.mjs';
const hash=async name=>(await hashNativeFile(name)).sha256;
function rows(text,prefix){const result=[];let position=0;for(const line of text.split('\n')){
  const at=position;position+=line.length+1;if(!line.startsWith(prefix))continue;
  const r={position:at};for(const part of line.slice(prefix.length).split(' ')){
    const i=part.indexOf('=');assert.ok(i>0);const name=part.slice(0,i);assert.ok(!Object.hasOwn(r,name));r[name]=part.slice(i+1);
  }result.push(r);
}return result;}
export function sessionRoute(m){
  const laps=m.routeLaps===undefined?1:m.routeLaps;
  assert.ok(Number.isSafeInteger(laps)&&laps>=1&&laps<=4);
  assert.ok(Array.isArray(m.route)&&m.route.length>=3&&m.route.length<=16*laps+1);
  if(laps>1||m.baseRoute!==undefined){
    assert.ok(Array.isArray(m.baseRoute));sessionRoute({route:m.baseRoute});
    assert.deepEqual(m.route,Array.from({length:laps},()=>m.baseRoute.slice(0,-1)).flat().concat('0_0'));
  }
  assert.equal(m.route[0],'0_0');assert.equal(m.route.at(-1),'0_0');
  const points=m.route.map(key=>{assert.match(key,/^-?\d+_-?\d+$/);const p=key.split('_').map(Number);
    assert.ok(p.every(n=>Number.isSafeInteger(n)&&Math.abs(n)<=1000000));assert.equal(p.join('_'),key);
    assert.ok(!['0_1','0_-1'].includes(key));return p;});
  const directions=points.slice(1).map(([x,y],i)=>{const dx=x-points[i][0],dy=y-points[i][1];
    const code=[[-1,0],[0,-1],[0,1],[1,0]].findIndex(([a,b])=>a===dx&&b===dy);assert.ok(code>=0);return code;});
  directions.push(4);if(m.directions)assert.deepEqual(m.directions,directions);
  const seen=new Set(['0_0']);const modes=m.route.slice(1).map(region=>{const mode=seen.has(region)?'saved':'new';seen.add(region);return mode;});
  return {directions,modes,visits:m.route.length};
}
export function requireSessionIsolationShape(m,fixture){
  assert.equal(m.nativeIsolationVersion,'v1');
  assert.equal(m.nativeExecutable,join(fixture,'native/recomp/pop_smoke'));
  assert.equal(m.privateNativeDirectory,join(fixture,'native/recomp'));
  assert.equal(m.privateRegistry,join(fixture,'registry.json'));
  assert.equal(m.privateRegistryInitiallyAbsent,true);
  assert.equal(m.privateNativeExecutableUnchanged,true);
  assert.equal(m.canonicalNativeStateUnchanged,true);
  assert.deepEqual(Object.keys(m.canonicalNativeStateBefore).sort(),['mods/run.json','registry.json']);
  assert.deepEqual(m.canonicalNativeStateAfter,m.canonicalNativeStateBefore);
}
export function requirePanRouteInput(m,input){
  assert.equal(m.panRoute,true);assert.equal(m.panFirst,true);assert.equal(m.observeCamera,true);
  assert.equal(m.routeLaps,1);
  const {directions,visits}=sessionRoute(m);assert.ok(visits<=5);assert.equal(directions[0],0);
  const vectors=[[-2000,0],[0,-2000],[0,2000],[2000,0]];
  // Keep the two historical input contracts exact. This does not admit an
  // arbitrary shorter script merely because its recorded route completed.
  for(const [version,intervalMs,repetitions,center]of [
      ['legacy-v1',200,200,false],['bounded-v2',400,100,true]]){
    let expected='wait 4000\nfocus on\nmoveby -2000 -2000\nwait 100\nmoveby 400 300\nwait 100\n';
    for(const direction of directions.slice(0,-1)){
      if(center)expected+='moveby -2000 -2000\nmoveby 400 300\n';
      const [dx,dy]=vectors[direction];expected+=`moveby ${dx} ${dy}\nwait ${intervalMs}\n`.repeat(repetitions);
    }
    expected+='moveby -2000 -2000\nmoveby 400 300\nwait 20800\ndump session_completed\n';
    if(input!==expected)continue;
    const executableSteps=input.split('\n').filter(line=>line&&!line.startsWith('wait ')).length;
    assert.ok(executableSteps<=512,'Input exceeds the original host executable-step bound');
    return {version,intervalMs,repetitionsPerDirection:repetitions,executableSteps};
  }
  assert.fail('Input differs from both exact native camera route contracts');
}
export function requireSessionTrace(m,text){
  const {directions,modes,visits}=sessionRoute(m);assert.equal(m.snapshotCaptures.length,visits);
  const saves=rows(text,'[frontier] Session checkpoint '),unloads=rows(text,'[frontier] Session unloaded '),attaches=rows(text,'[frontier] Session attached ');
  const quits=rows(text,'[frontier] Session quit ');
  const seeds=rows(text,'[frontier] Session rng restored '),enabled=rows(text,'[frontier] Session enabled ');
  assert.equal(saves.length,visits);assert.equal(quits.length,visits-1);assert.equal(unloads.length,visits-1);assert.equal(attaches.length,visits-1);
  assert.equal(seeds.length,1+modes.filter(mode=>mode==='saved').length);
  assert.equal(enabled.length,1);assert.equal(enabled[0].version,'v1');assert.equal(enabled[0].root,m.worldRoot);
  const releaseRequired=enabled[0].release!==undefined;if(releaseRequired)assert.ok(['v1','v2'].includes(enabled[0].release));
  const rootsPerTransition=enabled[0].release==='v2'?8:releaseRequired?6:0;
  const releases=rows(text,'[frontier] Session released '),removed=rows(text,'[frontier] Session release observer removed ');
  assert.equal(releases.length,releaseRequired?visits-1:0);assert.equal(removed.length,releaseRequired?visits-1:0);
  assert.ok(!/Session unavailable|Session fallback|Session checkpoint failed|exception e06d7363|result=fail|SIGSEGV|abort from/i.test(text));
  assert.ok(text.includes('all expectations met')&&text.includes('guest exit code:    0')&&text.includes('undeliverable calls: none'));
  const refused=phrase=>{const at=text.indexOf(phrase);assert.ok(at>=0&&at<saves[0].position);};
  refused('Session destination refused source=0_0 target=0_1');
  refused('Session request refused region=0_0 serial=0');
  assert.equal(rows(text,'[frontier] Session request refused ').filter(r=>r.region==='0_0'&&r.serial==='0'&&r.position<saves[0].position).length,2);
  for(let i=0;i<visits;++i){
    const r=saves[i],capture=m.snapshotCaptures[i];assert.equal(+r.serial,i+1);assert.equal(r.region,m.route[i]);
    assert.equal(+r.clock,capture.clock);assert.equal(+r.direction,directions[i]);
    assert.equal(capture.region,r.region);assert.equal(capture.serial,i+1);
    if(i<visits-1){
      const q=quits[i];assert.equal(+q.serial,i+1);assert.equal(q.region,r.region);assert.equal(+q['saved-clock'],+r.clock);
      assert.equal(q.clock,'0');assert.equal(q.loading,'0');assert.ok(r.position<q.position&&q.position<unloads[i].position);
      const u=unloads[i],a=attaches[i];assert.equal(+u.serial,i+1);assert.equal(u.source,m.route[i]);assert.equal(u.target,m.route[i+1]);
      assert.equal(u['world-null'],'1');assert.equal(u.profile,join(m.worldRoot,'frontier_'+m.route[i+1]));
      assert.equal(+a.serial,i+1);assert.equal(a.region,m.route[i+1]);assert.equal(a.mode,modes[i]);
      assert.equal(a.phase,'1');assert.equal(a.pending,'2');assert.ok(r.position<u.position&&u.position<a.position);
      assert.ok(a.position<saves[i+1].position);
      if(releaseRequired){
        const release=releases[i],observer=removed[i];assert.equal(+release.serial,i+1);assert.equal(release.region,r.region);
        assert.equal(release['roots-freed'],Array(rootsPerTransition).fill('1').join(','));assert.equal(release.clock,'0');
        if(rootsPerTransition===8){assert.equal(release['terrain-bytes'],'530456');assert.equal(release['spatial-bytes'],'524288');}
        for(const key of ['heap-before','heap-after','blocks-before','blocks-after']){
          assert.match(release[key],/^[0-9]+$/);assert.ok(Number.isSafeInteger(+release[key]));
        }
        assert.equal(+observer.serial,i+1);assert.match(observer.hooks,/^[0-9]+$/);assert.equal(observer['retained-roots'],'0');
        assert.ok(q.position<release.position&&release.position<u.position&&u.position<observer.position&&observer.position<a.position);
      }
    }
  }
  const travelKinds=['travel','finish',...(m.panFirst?['boundary']:[])];
  const publications=m.requestPublications.filter(r=>travelKinds.includes(r.kind));assert.equal(publications.length,visits);
  for(let i=0;i<visits;++i){const r=publications[i];assert.equal(r.serial,i+1);assert.equal(r.source,m.route[i]);assert.equal(r.direction,+saves[i].direction);
    const packet=`session-request-v1\n${r.serial}\n${r.source}\n${r.direction}\n`;assert.equal(createHash('sha256').update(packet).digest('hex'),r.sha256);}
  assert.deepEqual(m.requestPublications.filter(r=>!travelKinds.includes(r.kind)).map(r=>r.kind),m.symlink?['stale','partial','wrong-source','symlink']:['stale','partial','wrong-source']);
  if(m.symlink)refused('Session destination refused source=0_0 target=0_-1');
  const boundary=m.panFirst?requireBoundaryTrace(m,text,saves[0].position):null;
  const trace={saves,quits,unloads,attaches,seeds,modes,visits,releases,removed,releaseRequired,rootsPerTransition,boundary};
  trace.cameraArrivals=m.cameraArrivalExpected?requireCameraArrivals(m,text,trace):null;
  trace.boundaries=m.panRoute?requireRouteBoundaries(m,text,trace):null;
  trace.outdoorHero=m.outdoorHeroExpected?requireOutdoorHeroTrace(m,text,trace):null;
  trace.queueObservations=m.queueObservationExpected?requireSessionQueueObservations(m,text,trace):null;
  trace.loadedKingdomBindings=m.loadedKingdomBindingExpected?requireLoadedKingdomBindings(m,text,trace):null;
  trace.rebuildHolds=m.rebuildHoldExpected?requireRebuildHolds(m,text,trace):null;
  return trace;
}
export function requireLoadedKingdomBindings(m,text,trace){
  assert.equal(m.loadedKingdomBindingExpected,true);assert.equal(m.readyStateExpected,true);
  const observations=rows(text,'[coop-read-fixture] Loaded binding ');
  const savedVisits=[0,...trace.modes.flatMap((mode,i)=>mode==='saved'?[i+1]:[])];
  assert.equal(observations.length,savedVisits.length);
  for(const [i,r]of observations.entries()){
    assert.deepEqual(Object.keys(r).filter(k=>k!=='position').sort(),
      ['load','region','context','slots','ids','graph-restored','party-restored',
       'cpu-same','heap-same','hooks-same','network','result'].sort());
    assert.equal(r.load,String(i));assert.equal(r.region,m.route[savedVisits[i]]);
    assert.match(r.context,/^[0-9a-f]{8}$/);assert.notEqual(r.context,'00000000');
    assert.equal(r.slots,'0,1');assert.equal(r.ids,'7,8');assert.equal(r.network,'0');assert.equal(r.result,'pass');
    for(const key of ['graph-restored','party-restored','cpu-same','heap-same','hooks-same'])assert.equal(r[key],'1');
    const visit=savedVisits[i];
    assert.ok(r.position<trace.saves[visit].position);
    if(visit){assert.ok(trace.unloads[visit-1].position<r.position);assert.ok(r.position<trace.attaches[visit-1].position);}
  }
  return observations;
}
export function requireRebuildHolds(m,text,trace){
  assert.equal(m.rebuildHoldExpected,true);assert.equal(m.readyStateExpected,true);
  const observations=rows(text,'[coop-rebuild-fixture] Hold ');
  const prepared=m.preparedResumeExpected?rows(text,'[coop-rebuild-fixture] Prepared '):[];
  const savedVisits=[0,...trace.modes.flatMap((mode,i)=>mode==='saved'?[i+1]:[])];
  const ready=rows(text,'[frontier] Session ready snapshot ');
  assert.equal(ready.length,trace.visits);assert.equal(observations.length,savedVisits.length*4);
  if(m.preparedResumeExpected)assert.equal(prepared.length,savedVisits.length);
  const steps=['pending','settled','paused-tick','resume-pending'];
  const fields=['load','region','step','context','phase','pending','owner','frame','clock',
    'gameplay-ticks','cpu-same','original','record-frees','hooks-same','network','result'];
  for(const [i,visit]of savedVisits.entries()){
    const group=observations.slice(i*4,i*4+4);
    for(const [j,r]of group.entries()){
      assert.deepEqual(Object.keys(r).filter(k=>k!=='position').sort(),fields.toSorted());
      assert.equal(r.load,String(i));assert.equal(r.region,m.route[visit]);assert.equal(r.step,steps[j]);
      assert.match(r.context,/^[0-9a-f]{8}$/);assert.notEqual(r.context,'00000000');
      assert.equal(r.phase,j===0?'2':'7');assert.equal(r.pending,j===0?'7':j===3?'3':'0');
      assert.equal(r.owner,j===3?'4294967295':m.preparedResumeExpected?prepared[i].owner:'7');
      assert.equal(r['cpu-same'],'1');assert.equal(r.original,'1');assert.equal(r.network,'0');assert.equal(r.result,'pass');
      assert.equal(r['record-frees'],j===3?'1,1':'0,0');assert.equal(r['hooks-same'],'1');
      for(const key of ['frame','clock','gameplay-ticks']){
        assert.match(r[key],/^(0|[1-9][0-9]*)$/);assert.ok(+r[key]<=0xffffffff);
        assert.equal(r[key],group[0][key]);
      }
      assert.equal(r.context,group[0].context);
      assert.ok(r.position<ready[visit].position);
      if(j)assert.ok(group[j-1].position<r.position);
      if(visit)assert.ok(trace.attaches[visit-1].position<r.position);
    }
    assert.equal(group[0].clock,String(m.readyCaptures[visit].clock));
    if(m.preparedResumeExpected){
      const r=prepared[i];
      assert.equal(r.load,String(i));assert.equal(r.region,m.route[visit]);
      assert.equal(r.owner,r.local);assert.match(r.owner,/^(0|[1-9][0-9]*)$/);
      assert.ok(+r.owner<0xffffffff);
      assert.equal(r['input-return'],'004179a9');assert.equal(r.queued,'1');
      assert.equal(r['direct-dispatch'],'0');assert.equal(r.network,'0');assert.equal(r.result,'pass');
      assert.equal(r.frame,group[0].frame);assert.equal(r.clock,group[0].clock);
      assert.match(r.world,/^[0-9a-f]{8}$/);assert.notEqual(r.world,'00000000');
      assert.ok(group[2].position<r.position&&r.position<group[3].position);
    }
  }
  return observations;
}
export function requireSessionQueueObservations(m,text,trace){
  assert.equal(m.queueObservationExpected,true);assert.equal(m.readyStateExpected,true);
  const observations=rows(text,'[frontier] Session queue observation ');
  // The final save advances the request serial without leaving the kingdom.
  // Normal gameplay continues and provides one post-checkpoint observation.
  assert.equal(observations.length,trace.visits+1);
  const addresses=['parent','queue','buffer','map','default','previous-queue','previous-buffer','previous-map'];
  const fields=['serial','clock',...addresses,'count','tree-count','previous-serial','previous-freed',
    'previous-valid','previous-references','read-only','heap-same','hooks-same','result'];
  for(const [i,r]of observations.entries()){
    assert.deepEqual(Object.keys(r).filter(k=>k!=='position').sort(),fields.toSorted());
    for(const key of addresses)assert.match(r[key],/^[0-9a-f]{8}$/);
    for(const key of ['parent','queue','buffer','map'])assert.notEqual(r[key],'00000000');
    for(const key of ['serial','clock','previous-freed','previous-references'])assert.match(r[key],/^(0|[1-9][0-9]*)$/);
    assert.equal(+r.serial,i);assert.ok(Number.isSafeInteger(+r.clock)&&+r.clock<=0xffffffff);
    assert.equal(r.count,'1');assert.equal(r['tree-count'],'1');
    for(const key of ['read-only','heap-same','hooks-same'])assert.equal(r[key],'1');
    assert.equal(r.result,'pass');assert.ok(['0','1'].includes(r['previous-valid']));
    assert.ok(+r['previous-freed']<=15);assert.ok(+r['previous-references']<=0xffffffff);
    if(i<trace.visits){
      assert.ok(r.position<trace.saves[i].position);assert.ok(+r.clock<=+trace.saves[i].clock);
      if(i>0)assert.ok(trace.attaches[i-1].position<r.position);
    }else{
      assert.ok(trace.saves.at(-1).position<r.position);assert.ok(+r.clock>+trace.saves.at(-1).clock);
      assert.equal(r.parent,observations[i-1].parent);
      assert.equal(r.queue,observations[i-1].queue);
    }
    if(i===0){
      assert.equal(r['previous-serial'],'18446744073709551615');
      for(const key of ['previous-queue','previous-buffer','previous-map'])assert.equal(r[key],'00000000');
      assert.equal(r['previous-freed'],'0');assert.equal(r['previous-valid'],'0');
    }else{
      const prior=observations[i-1];assert.equal(r['previous-serial'],String(i-1));
      for(const key of ['queue','buffer','map'])assert.equal(r['previous-'+key],prior[key]);
      if(r['previous-valid']==='1'){
        assert.equal(r.parent,prior.parent);assert.equal(r['previous-freed'],'0');
        assert.ok(+r['previous-references']<=1);
        assert.equal(+r['previous-references'],Number(r.queue===r['previous-queue']));
      }
    }
    if(r['previous-valid']==='0')assert.equal(r['previous-references'],'4294967295');
  }
  return observations;
}
export function requireOutdoorHeroTrace(m,text,trace){
  assert.equal(m.outdoorHeroExpected,true);assert.ok(m.outdoorHeroObservation);
  const observed=rows(text,'[streaming] Session hero observed ');assert.equal(observed.length,2);
  for(const [i,r]of observed.entries()){
    assert.equal(r.phase,i?'outdoor':'resident');
    for(const [key,value]of Object.entries({serial:'0',region:'0_0',hero:'504',agent:'28',home:'7',guild:'469',
      parent:i?'0':'469',queued:'1',drawing:'1','native-home':'1','original-ai':'1',result:'pass'}))assert.equal(r[key],value);
    for(const key of ['clock','cells','x','y','z']){assert.match(r[key],/^-?(0|[1-9][0-9]*)$/);assert.ok(Number.isSafeInteger(+r[key]));}
    assert.ok(+r.clock>=31800);assert.ok(r.position<trace.saves[0].position);
  }
  assert.equal(observed[0].cells,'0');assert.ok(+observed[1].cells>0&&+observed[1].cells<=256);
  assert.ok(observed[0].position<observed[1].position&&+observed[0].clock<+observed[1].clock);
  const line=text.slice(observed[1].position).split('\n')[0];assert.equal(line,m.outdoorHeroObservation.line);
  const publication=m.requestPublications.find(r=>['boundary','travel'].includes(r.kind));assert.ok(publication);
  assert.ok(m.outdoorHeroObservation.observedAtMs<=publication.publishedAtMs);
  assert.ok(+observed[1].clock<=+trace.saves[0].clock&&+trace.saves[0].clock-+observed[1].clock<=3000);
  return observed[1];
}

export async function requireOutdoorHeroCheckpoint(m,trace,initial){
  if(!trace.outdoorHero)return null;
  const seed=await stoppedFileSource(m.selectedRevisionExports[0].filename),source=await stoppedFileSource(m.snapshotCaptures[0].file);
  const before=await checkpointActorRecords(seed,504),after=await checkpointActorRecords(source,504);
  assert.equal(before.unit.parentUnitId,469);assert.equal(after.unit.parentUnitId,0);
  assert.equal(after.unit.agentId,28);assert.equal(after.unit.family,'VHCL');assert.equal(after.unit.description,0x314c5641);
  const fields=new Map();for await(const v of checkpointAgentValues(seed,28))if(!v.path.length)fields.set(v.attribute,v);
  const rest=fields.get('activescript');assert.equal(rest.type,8);assert.deepEqual(rest.functions.map(v=>v.name),['Rest_at_guild']);
  const bytes=await seed.readAt(rest.stateOffset,16),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const duration=view.getUint32(0,true),start=view.getUint32(4,true);assert.equal(start,26750);assert.equal(duration,30000);
  assert.ok(+trace.outdoorHero.clock>=start+duration&&initial.clock<start+duration);
  let home,roster=0;
  for await(const v of checkpointAgentValues(source,28))if(!v.path.length&&v.attribute==='home')home=v;
  assert.equal(home.type,5);assert.equal(home.targetAgentId,7);
  for await(const v of checkpointAgentValues(source,7))if(v.attribute==='members'&&v.path.length===1&&v.targetAgentId===28)++roster;
  assert.equal(roster,1);
  const native=[];for await(const c of checkpointContainerEntries(source))if(c.type==='member'&&
    ((c.unitId===469&&c.targetUnitId===504)||(c.unitId===504&&c.targetUnitId===469)))native.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
  assert.deepEqual(native,[[469,100,504,1],[504,101,469,1]]);
  let placement;for await(const p of checkpointPlacements(source))if(p.unitId===504)placement=p;
  assert.ok(placement&&!placement.requiresParentPosition&&placement.mapPosition);
  const returnedCapture=m.snapshotCaptures.at(-1);assert.equal(returnedCapture.region,'0_0');
  const returned=await stoppedFileSource(returnedCapture.file),returnedActor=await checkpointActorRecords(returned,504);
  assert.equal(returnedActor.unit.agentId,28);assert.equal(returnedActor.unit.description,0x314c5641);
  assert.ok([0,469].includes(returnedActor.unit.parentUnitId));
  let returnHome,returnSlot=0;
  for await(const v of checkpointAgentValues(returned,28))if(!v.path.length&&v.attribute==='home')returnHome=v;
  assert.equal(returnHome.type,5);assert.equal(returnHome.targetAgentId,7);
  for await(const v of checkpointAgentValues(returned,7))if(v.attribute==='members'&&v.path.length===1&&v.targetAgentId===28)++returnSlot;
  assert.equal(returnSlot,1);
  const returnNative=[];for await(const c of checkpointContainerEntries(returned))if(c.type==='member'&&
    ((c.unitId===469&&c.targetUnitId===504)||(c.unitId===504&&c.targetUnitId===469)))returnNative.push([c.unitId,c.groupKind,c.targetUnitId,c.flags]);
  assert.deepEqual(returnNative,[[469,100,504,1],...(returnedActor.unit.parentUnitId?[[469,2,504,1]]:[]),[504,101,469,1]]);
  return {unitId:504,agentId:28,homeAgentId:7,guildUnitId:469,parentUnitId:0,
    originalRestDeadline:start+duration,observedClock:+trace.outdoorHero.clock,savedClock:m.snapshotCaptures[0].clock,
    fixedPosition:placement.fixedPosition,nativeHomePreserved:true,scriptHomePreserved:true,occupiedGuildSlots:roster,
    savedReturnHeroStateQualified:true,returnedParentUnitId:returnedActor.unit.parentUnitId,
    heroTransferred:false,browserQualified:false};
}
export function requireCameraArrivals(m,text,trace){
  assert.equal(m.observeCamera,true);assert.equal(m.cameraArrivalExpected,true);
  const {directions}=sessionRoute(m),arrivals=rows(text,'[frontier] Session camera arrived '),latest=new Map();
  assert.equal(arrivals.length,trace.visits-1);
  for(let i=0;i<arrivals.length;++i){
    latest.set(m.route[i],+trace.saves[i].clock);
    const row=arrivals[i];assert.equal(+row.serial,i+1);assert.equal(row.region,m.route[i+1]);assert.equal(+row.direction,directions[i]);
    for(const key of ['x','y','max-x','max-y','source-x','source-y','clock']){
      assert.match(row[key],/^(0|[1-9][0-9]*)$/);assert.ok(Number.isSafeInteger(+row[key]));
    }
    for(const key of ['x','y','max-x','max-y','source-x','source-y'])assert.ok(+row[key]<=16777216);
    assert.ok(+row['max-x']>0&&+row['max-y']>0);
    const dx=directions[i],clamp=(n,max)=>Math.min(Math.max(n,0),max);
    assert.equal(+row.x,dx===0?+row['max-x']:dx===3?0:clamp(+row['source-x'],+row['max-x']));
    assert.equal(+row.y,dx===1?+row['max-y']:dx===2?0:clamp(+row['source-y'],+row['max-y']));
    assert.equal(+row.clock,trace.modes[i]==='new'?0:latest.get(row.region));
    assert.ok(trace.attaches[i].position<row.position&&row.position<trace.saves[i+1].position);
    const ready=text.indexOf(`[frontier] Region ${row.region} ready\n`,trace.attaches[i].position);
    assert.ok(row.position<ready&&ready<trace.saves[i+1].position);
    if(i===0&&trace.boundary){assert.equal(+row['source-x'],trace.boundary.x);assert.equal(+row['source-y'],trace.boundary.y);}
  }
  return arrivals;
}
// Require actual original input to reach a clamped edge before the first
// request. This qualifies one native trigger, not seamless/browser travel.
export function requireBoundaryTrace(m,text,firstSavePosition){
  assert.equal(m.observeCamera,true);assert.equal(m.panFirst,true);
  const enabled=rows(text,'[frontier] Session enabled ');
  assert.equal(enabled.length,1);assert.equal(enabled[0].crossing,'v1');assert.equal(enabled[0].release,'v2');
  assert.ok(m.boundaryTrigger&&text.split('\n').includes(m.boundaryTrigger.line));
  const boundaries=rows(text,'[frontier] Session boundary ');
  const row=boundaries[0];assert.ok(row);assert.equal(row.serial,'0');assert.equal(row.region,'0_0');assert.equal(row.direction,'west');
  assert.equal(text.slice(row.position).split('\n')[0],m.boundaryTrigger.line);
  for(const key of ['gesture','x','y','max-x','max-y','dx','dy','held-ms']){
    assert.match(row[key],/^-?(0|[1-9][0-9]*)$/);assert.ok(Number.isSafeInteger(+row[key]));
  }
  assert.ok(+row.gesture>0&&+row['held-ms']>=1000);
  assert.equal(+row.x,0);assert.ok(+row.dx<0&&+row['max-x']>0&&+row['max-y']>0&&+row.y>=0&&+row.y<=+row['max-y']);
  assert.ok(row.position<firstSavePosition);
  // Probe lines share the prose prefix but are a different event type.
  const cameraLine=text.split('\n').find(line=>line.startsWith('[frontier] Session camera serial=0 region=0_0 '));
  assert.ok(cameraLine);const camera=rows(cameraLine,'[frontier] Session camera ')[0];
  assert.ok(text.indexOf(cameraLine)<row.position);assert.equal(camera.valid,'1');assert.equal(camera.kind,'1');assert.equal(camera.vtable,'00680e14');
  const requests=m.requestPublications.filter(r=>['boundary','travel','finish'].includes(r.kind));
  assert.equal(requests[0].kind,'boundary');assert.equal(requests[0].serial,1);assert.equal(requests[0].source,'0_0');assert.equal(requests[0].direction,0);
  assert.equal(requests.filter(r=>r.kind==='boundary').length,m.panRoute?m.route.length-1:1);
  assert.ok(Number.isSafeInteger(m.boundaryTrigger.observedAtMs)&&m.boundaryTrigger.observedAtMs<=requests[0].publishedAtMs);
  return {direction:row.direction,gesture:+row.gesture,x:+row.x,y:+row.y,maxX:+row['max-x'],maxY:+row['max-y'],dx:+row.dx,dy:+row.dy,heldMs:+row['held-ms']};
}
// Every departure must follow its own original input/edge observation, with
// bounded fixture timing. This does not qualify simultaneous adjacent views.
export function requireRouteBoundaries(m,text,trace){
  assert.equal(m.panRoute,true);assert.equal(m.panFirst,true);assert.equal(m.observeCamera,true);
  assert.equal(m.routeLaps,1);assert.ok(trace.visits<=5);
  assert.ok(Array.isArray(m.boundaryTriggers));assert.equal(m.boundaryTriggers.length,trace.visits-1);
  const {directions}=sessionRoute(m),names=['west','north','south','east'];
  const publications=m.requestPublications.filter(r=>['boundary','finish'].includes(r.kind));
  assert.equal(publications.length,trace.visits);
  let lastGesture=0;
  return m.boundaryTriggers.map((observation,i)=>{
    assert.equal(observation.serial,i);assert.ok(text.split('\n').includes(observation.line));
    const parsed=rows(observation.line,'[frontier] Session boundary ');assert.equal(parsed.length,1);
    const row=parsed[0],position=text.indexOf(observation.line+'\n');assert.ok(position>=0);
    assert.equal(row.serial,String(i));assert.equal(row.region,m.route[i]);assert.equal(row.direction,names[directions[i]]);
    for(const key of ['gesture','x','y','max-x','max-y','dx','dy','held-ms']){
      assert.match(row[key],/^-?(0|[1-9][0-9]*)$/);assert.ok(Number.isSafeInteger(+row[key]));
    }
    assert.ok(+row.gesture>lastGesture);lastGesture=+row.gesture;
    assert.ok(+row['held-ms']>=1000&&+row['max-x']>0&&+row['max-y']>0);
    assert.ok(+row.x>=0&&+row.x<=+row['max-x']&&+row.y>=0&&+row.y<=+row['max-y']);
    const d=directions[i];
    if(d===0){assert.equal(+row.x,0);assert.ok(+row.dx<0);}
    if(d===3){assert.equal(+row.x,+row['max-x']);assert.ok(+row.dx>0);}
    if(d===1){assert.equal(+row.y,0);assert.ok(+row.dy<0);}
    if(d===2){assert.equal(+row.y,+row['max-y']);assert.ok(+row.dy>0);}
    assert.ok(position<trace.saves[i].position);
    if(i)assert.ok(trace.attaches[i-1].position<position);
    const publication=publications[i];assert.equal(publication.kind,'boundary');
    assert.equal(publication.serial,i+1);assert.equal(publication.source,row.region);assert.equal(publication.direction,d);
    assert.ok(Number.isSafeInteger(observation.observedAtMs)&&observation.observedAtMs<=publication.publishedAtMs);
    if(trace.cameraArrivals){assert.equal(+trace.cameraArrivals[i]['source-x'],+row.x);assert.equal(+trace.cameraArrivals[i]['source-y'],+row.y);}
    return {serial:i,region:row.region,direction:row.direction,gesture:+row.gesture,x:+row.x,y:+row.y,heldMs:+row['held-ms']};
  });
}
export function requireSessionPopulation(state,region,{kingdomWitness=null}={}){
  assert.ok(state.counts.units>0&&state.counts.agents>0,'A generated kingdom must initialize AI agents');
  if(region==='0_0'){
    if(kingdomWitness){
      assert.equal(kingdomWitness.length,2);
      assert.equal(new Set(kingdomWitness.map(k=>k.unitId)).size,2);
      for(const k of kingdomWitness)assert.ok(k.unitId>0&&k.agentId>0&&state.records.units[k.unitId]&&state.records.agents[k.agentId],
        'Both original cooperative palaces and GPL agents must remain registered');
    }else assert.ok(state.records.units[504]&&state.records.agents[28]);
  }
}
export function requireSessionReadyTrace(m,text,trace){
  assert.equal(m.readyStateExpected,true);assert.equal(m.worldName,'restoration');
  assert.equal(m.nativeRouteCompleted,true);assert.equal(m.readyCaptures.length,trace.visits);
  const captures=rows(text,'[frontier] Session ready snapshot ');
  assert.equal(captures.length,trace.visits);
  for(const [i,row]of captures.entries()){
    const capture=m.readyCaptures[i];
    assert.deepEqual(Object.keys(row).sort(),['position','serial','region','clock','ordinary-ticks','guards','world-same','hooks-same','saved'].sort());
    assert.equal(row.serial,String(i));assert.equal(row.region,m.route[i]);
    assert.match(row.clock,/^(0|[1-9][0-9]*)$/);assert.equal(+row.clock,capture.clock);
    assert.equal(capture.serial,i);assert.equal(capture.region,m.route[i]);
    for(const key of ['ordinary-ticks','guards'])assert.equal(row[key],'0');
    for(const key of ['world-same','hooks-same','saved'])assert.equal(row[key],'1');
    assert.ok(row.position<trace.saves[i].position);
    const regionReady=text.indexOf(`[frontier] Region ${row.region} ready`,i?trace.attaches[i-1].position:0);
    assert.ok(regionReady>=0&&regionReady<row.position);
    if(i)assert.ok(trace.attaches[i-1].position<row.position);
    const seed=trace.seeds.find(r=>r.region===row.region&&r.position>(i?trace.attaches[i-1].position:-1)&&r.position<row.position);
    if(i===0||trace.modes[i-1]==='saved')assert.ok(seed,'Saved RNG restoration must precede ready capture');
  }
  return captures;
}
export function requireRestoredCameraTrace(m,text,trace){
  assert.equal(m.restorationBeforeCameraExpected,true);assert.equal(m.readyStateExpected,true);
  assert.equal(m.cameraArrivalExpected,true);assert.equal(m.nativeRouteCompleted,true);
  const captures=rows(text,'[frontier] Session restored snapshot '),ready=requireSessionReadyTrace(m,text,trace);
  assert.equal(captures.length,trace.visits);assert.equal(m.restoredCaptures.length,trace.visits);
  for(const [i,row]of captures.entries()){
    assert.deepEqual(Object.keys(row).filter(k=>k!=='position').sort(),
      ['serial','region','clock','before-arrival','ordinary-ticks','guards','world-same','hooks-same','camera-x','camera-y','saved'].sort());
    assert.equal(+row.serial,i);assert.equal(row.region,m.route[i]);assert.equal(row.clock,ready[i].clock);
    for(const key of ['before-arrival','world-same','hooks-same','saved'])assert.equal(row[key],'1');
    assert.equal(row['ordinary-ticks'],'0');assert.equal(row.guards,'0');
    const capture=m.restoredCaptures[i];assert.equal(capture.serial,i);assert.equal(capture.region,row.region);
    assert.equal(capture.clock,+row.clock);
    for(const [field,key]of [['cameraX','camera-x'],['cameraY','camera-y']]){
      assert.match(row[key],/^(0|[1-9][0-9]*)$/);assert.ok(+row[key]<=16777216);
      assert.equal(capture[field],+row[key]);
    }
    assert.ok(row.position<ready[i].position);
    if(i)assert.ok(trace.attaches[i-1].position<row.position&&row.position<trace.cameraArrivals[i-1].position);
    const regionReady=text.indexOf(`[frontier] Region ${row.region} ready\n`,i?trace.attaches[i-1].position:0);
    assert.ok(row.position<regionReady);
    if(!i||trace.modes[i-1]==='saved'){
      const seed=trace.seeds.find(r=>r.region===row.region&&r.position>(i?trace.attaches[i-1].position:-1)&&r.position<row.position);
      assert.ok(seed,'Both saved RNGs must restore before the before-camera capture');
    }
  }
  return captures;
}
async function main(){
  const [manifestFile,out]=process.argv.slice(2);assert.ok(manifestFile&&out);
  assert.ok((await stat(manifestFile)).size<=256*1024);
  const m=JSON.parse(await readFile(manifestFile,'utf8'));assert.equal(m.phase,'native-named-region-session');
  assert.equal(m.nativeOnly,true);assert.equal(m.browserUsed,false);assert.equal(m.nativeSessionTerminal,true);assert.equal(m.nativeExitCode,0);assert.equal(m.stopReason,null);
  try{process.kill(m.nativePid,0);throw Error('Native producer remains live');}catch(e){if(e.code!=='ESRCH')throw e;}
  const fixture=await ownedDirectory(m.fixture,'actor-arrival-fixture-session-');assert.equal(m.worldRoot,join(fixture,'native-world-'+(m.worldName??'session')));
  if(m.nativeIsolationVersion!==undefined){
    requireSessionIsolationShape(m,fixture);
    for(const path of [join(fixture,'native'),m.privateNativeDirectory]){
      const s=await lstat(path);assert.ok(s.isDirectory()&&!s.isSymbolicLink());
    }
    assert.ok(!(await lstat(m.nativeExecutable)).isSymbolicLink());
    assert.equal(await hash(m.nativeExecutable),m.nativeExecutableSha256);
    for(const [name,before]of Object.entries(m.canonicalNativeStateBefore)){
      const path=join(workspace,'upstream/majesty-recomp/build/recomp',name);
      if(before===null){await assert.rejects(lstat(path),e=>e.code==='ENOENT');continue;}
      const s=await lstat(path);assert.ok(s.isFile()&&!s.isSymbolicLink());
      assert.equal(await hash(path),before.sha256);assert.equal(s.size,before.bytes);assert.equal(s.ino,before.inode);
    }
  }
  assert.equal(await hash(m.buildReport),m.buildReportSha256);const build=JSON.parse(await readFile(m.buildReport,'utf8'));assert.equal(build.nativeExecutableSha256,m.nativeExecutableSha256);
  assert.deepEqual(build.nativeSourceSha256,m.nativeSourceSha256);
  const archive=m.nativeArtifactArchive?JSON.parse(await readFile(m.nativeArtifactArchive,'utf8')):null;
  for(const [name,digest]of Object.entries(m.nativeSourceSha256))assert.equal(await hash(archive?.sources[name]?.filename??join(workspace,name)),digest);
  assert.equal(await hash(archive?.nativeExecutable.filename??join(workspace,'upstream/majesty-recomp/build/recomp/pop_smoke')),m.nativeExecutableSha256);
  if(m.readyStateExpected){
    const compiled=sessionCompiledSourceHashes(build);
    for(const[n,h]of Object.entries(compiled))assert.equal(await hash(archive?.sources[n]?.filename??join(workspace,n)),h);
    assert.equal(await hash(archive?.nativeSymbols.filename??join(workspace,'upstream/majesty-recomp/build/recomp/gen/symbols.json')),build.nativeSymbolsSha256);
    assert.equal(m.runnerSourceCopy,join(fixture,'Session_Controller_Source.py'));
    assert.equal(await hash(m.runnerSourceCopy),m.runnerSha256);
    const runnerName=resolve('scripts/run-native-region-session.py');
    assert.equal(await hash(archive?.evidence[runnerName]?.filename??runnerName),m.runnerSha256);
  }
  assert.equal(await hash(m.log),m.logSha256);assert.ok((await stat(m.log)).size<=1024*1024);
  const text=await readFile(m.log,'utf8'),trace=requireSessionTrace(m,text),states=[];
  let kingdomWitness=null;
  if(m.stoppedSourceAdmission?.originalCooperativeWorldInspected===true){
    const admission=m.stoppedSourceAdmission;
    assert.equal(admission.sourceType,'original-terminal-coop-progress-snapshot-v1');
    assert.equal(admission.pairedGameplayQualified,false);
    assert.equal(await hash(admission.report),admission.reportSha256);
    const proof=JSON.parse(await readFile(admission.report,'utf8'));
    assert.equal(proof.bothKingdomPalacesBuildingsAndGPLSavedQualified,true);
    assert.equal(proof.snapshots[1].sha256,m.selectedRevisionExports[0].sha256);
    kingdomWitness=proof.snapshots[1].kingdoms.map(k=>{
      assert.equal(k.palace.length,1);return k.palace[0];
    });
  }
  const population=(state,key)=>requireSessionPopulation(state,key,{kingdomWitness});
  if(m.restorationBeforeCameraExpected!==true){
    assert.equal(m.restoredCaptures?.length??0,0);
    assert.equal(rows(text,'[frontier] Session restored snapshot ').length,0);
  }
  let panRouteInput=null;
  if(m.panFirst){
    assert.equal(m.script,join(fixture,'session.script'));
    assert.equal(m.nativeRouteCompleted,true);assert.equal(m.panInput,'guest-mouse-edge');
    assert.equal(await hash(m.script),m.scriptSha256);
    const input=await readFile(m.script,'utf8');
    if(m.panRoute)panRouteInput=requirePanRouteInput(m,input);
    else assert.ok(input.startsWith('wait 4000\nfocus on\nwait 100\nmoveby -2000 -2000\nwait 100\nmoveby 0 300\n'));
  }
  for(let i=0;i<trace.visits;++i){
    const capture=m.snapshotCaptures[i];assert.equal(capture.file,join(fixture,`Session_Saved_${i+1}.GMP`));
    const record=parseRealmManifest(capture.manifest,m.content);assert.equal(record.sha256,capture.sha256);assert.equal(record.size,capture.size);assert.equal(record.slot,capture.slot);
    assert.equal(await hash(capture.file),capture.sha256);const state=await connectedWorldState(capture.file);assert.equal(state.clock,capture.clock);
    population(state,capture.region);
    states.push(state);
  }
  const sourceSeed=parseRealmManifest(m.initialManifest,m.content);
  assert.equal(sourceSeed.sha256,m.selectedRevisionExports[0].sha256);
  const initial=await connectedWorldState(m.selectedRevisionExports[0].filename);
  const cooperativeSourceSnapshots=[];
  if(kingdomWitness){
    for(const capture of [...m.readyCaptures,...m.snapshotCaptures].filter(c=>c.region==='0_0')){
      const kingdoms=await cooperativeKingdoms(capture.file,[0,1]);
      assert.deepEqual(kingdoms.map(k=>k.palace[0].unitId).sort((a,b)=>a-b),kingdomWitness.map(k=>k.unitId).sort((a,b)=>a-b));
      cooperativeSourceSnapshots.push({file:capture.file,serial:capture.serial,clock:capture.clock,
        kingdoms:kingdoms.map(k=>({slot:k.slot,palace:k.palace[0],buildings:k.buildings.length,mobileActors:k.mobileActors.length}))});
    }
  }
  const outdoorHero=await requireOutdoorHeroCheckpoint(m,trace,initial);
  assert.deepEqual([trace.seeds[0].region,+trace.seeds[0].gpl,+trace.seeds[0].game,+trace.seeds[0].clock],['0_0',initial.rng,initial.gameplayRng,initial.clock]);
  // Each saved return resumes its own most recent checkpoint. Fresh kingdoms
  // retain the original generator's seeds and begin at clock zero.
  const latest=new Map(),beforeClocks=[initial.clock];let seedIndex=1;
  for(let i=0;i<trace.visits-1;++i){
    latest.set(m.route[i],i);const next=m.route[i+1],index=latest.get(next);
    if(index===undefined){assert.equal(trace.modes[i],'new');beforeClocks.push(0);continue;}
    assert.equal(trace.modes[i],'saved');const row=trace.seeds[seedIndex++];
    assert.deepEqual([row.region,+row.gpl,+row.game,+row.clock],[next,states[index].rng,states[index].gameplayRng,states[index].clock]);
    assert.ok(trace.attaches[i].position<row.position&&row.position<trace.saves[i+1].position);
    beforeClocks.push(states[index].clock);
  }
  assert.equal(seedIndex,trace.seeds.length);
  let fullRestoration=null;const cameraTransforms=[];
  if(m.readyStateExpected){
    const readyRows=requireSessionReadyTrace(m,text,trace),restored=[];
    const beforeCameraRows=m.restorationBeforeCameraExpected?requireRestoredCameraTrace(m,text,trace):null;
    for(let i=0;i<trace.visits;++i){
      const capture=m.readyCaptures[i];assert.equal(capture.file,join(fixture,`Session_Ready_${i}.GMP`));
      const record=parseRealmManifest(capture.manifest,m.content);
      assert.equal(record.slot,capture.slot);assert.equal(record.sha256,capture.sha256);assert.equal(record.size,capture.size);
      assert.equal(await hash(capture.file),capture.sha256);assert.equal((await stat(capture.file)).size,capture.size);
      const ready=await connectedWorldState(capture.file);assert.equal(ready.clock,beforeClocks[i]);
      assert.equal(+readyRows[i].clock,ready.clock);population(ready,capture.region);
      let loaded=ready;
      if(beforeCameraRows){
        const original=m.restoredCaptures[i];
        assert.equal(original.file,join(fixture,`Session_Restored_${i}.GMP`));
        assert.equal(original.sourceFile,join(m.worldRoot,'frontier_'+m.route[i],'Documents/My Games/MajestyHD/SaveGame',`Frontier_Restored_${i}.GMP`));
        for(const name of [original.file,original.sourceFile]){
          const info=await lstat(name);assert.ok(info.isFile()&&!info.isSymbolicLink());
          assert.equal(await hash(name),original.sha256);assert.equal((await stat(name)).size,original.size);
        }
        loaded=await connectedWorldState(original.file);assert.equal(loaded.clock,beforeClocks[i]);
        population(loaded,capture.region);
        const beforeView={x:original.cameraX,y:original.cameraY};
        const arrival=i?trace.cameraArrivals[i-1]:null,afterView=arrival?{x:+arrival.x,y:+arrival.y}:beforeView;
        cameraTransforms.push({serial:i,region:m.route[i],...await compareCameraArrivalStates(loaded,ready,beforeView,afterView)});
      }
      const priorIndex=m.route.slice(0,i).lastIndexOf(m.route[i]);
      const before=i===0?initial:priorIndex<0?null:states[priorIndex];
      let comparison=null;
      if(before){
        try{comparison={matching:true,...compareConnectedWorlds(before,loaded)};}
        catch(error){
          if(error.code!=='ERR_ASSERTION')throw error;
          const changedRecords=[];
          for(const group of ['units','agents','attachments'])for(const id of new Set([...Object.keys(before.records[group]),...Object.keys(loaded.records[group])]))
            if(JSON.stringify(before.records[group][id])!==JSON.stringify(loaded.records[group][id]))
              changedRecords.push({group,id,before:before.records[group][id]??null,after:loaded.records[group][id]??null});
          comparison={matching:false,reason:error.message.split('\n')[0],changedRecords,
            changedRoots:loaded.roots.filter((r,index)=>JSON.stringify(r)!==JSON.stringify(before.roots[index])).map(r=>r.tag)};
        }
      }
      restored.push({serial:i,region:m.route[i],clock:ready.clock,counts:ready.counts,
        mode:i===0?'saved':trace.modes[i-1],comparedTo:before?(i===0?'initial-selected-world':`Session_Saved_${priorIndex+1}.GMP`):null,
        comparison,comparisonBoundary:beforeCameraRows?'before-arrival':'after-arrival'});
    }
    const compared=restored.filter(r=>r.comparison!==null);
    fullRestoration={qualified:compared.every(r=>r.comparison.matching),restored,comparedLoads:compared.length,
      matchingLoads:compared.filter(r=>r.comparison.matching).length};
  }
  const ticks=states.map((state,i)=>{const elapsed=state.clock-beforeClocks[i];assert.ok(elapsed>0&&elapsed%50===0);return elapsed/50;});
  const firstVisits=new Map(),seams=[];
  for(let i=0;i<trace.visits;++i)if(!firstVisits.has(m.route[i]))firstVisits.set(m.route[i],i);
  const edges=new Set();
  for(let i=0;i<trace.visits-1;++i){
    const a=m.route[i],b=m.route[i+1],pa=a.split('_').map(Number),pb=b.split('_').map(Number),axis=pa[0]===pb[0]?'y':'x';
    const order=pa[axis==='x'?0:1]<pb[axis==='x'?0:1]?[a,b]:[b,a],edge=order.join(':');
    if(edges.has(edge))continue;edges.add(edge);
    const terrain=[];for(const key of order)terrain.push(await checkpointTerrain(await stoppedFileSource(m.snapshotCaptures[firstVisits.get(key)].file)));
    const comparison=await compareTerrainSeam(...terrain,axis);assert.equal(comparison.vertices,129);
    if(!m.readyStateExpected)assert.equal(comparison.heightBytesDiffering,0);
    seams.push({regions:order,...comparison});
  }
  const seam=seams[0];
  for(let i=0;i<trace.visits;++i)latest.set(m.route[i],i);
  for(const [region,index]of latest){
    const directory=join(m.worldRoot,'frontier_'+region),marker=await readFile(join(directory,'Frontier_'+region+'.checkpoint'),'utf8');
    const record=parseRealmManifest(marker,m.content),capture=m.snapshotCaptures[index];assert.equal(record.sha256,capture.sha256);
    assert.equal(await hash(join(directory,'Documents/My Games/MajestyHD/SaveGame','Frontier_'+region+(record.slot?'_Recovery':'')+'.GMP')),record.sha256);
  }
  for(const field of ['publicationUnchanged','receiptUnchanged','originalWorldsUnchanged','originalSettingsUnchanged','orphanUnchanged'])assert.equal(m[field],true);
  if(m.receivedHome){
    assert.equal(m.readyStateExpected,true);assert.equal(m.receivedHomeUnchanged,true);
    const received=m.receivedHome;assert.equal(await hash(received.report),received.reportSha256);
    assert.ok((await stat(received.report)).size<=256*1024);
    const transfer=JSON.parse(await readFile(received.report,'utf8'));
    assert.equal(transfer.realCheckpointPacketTransferQualified,true);
    assert.equal(transfer.testTerminal,true);assert.equal(transfer.exitCode,0);assert.equal(transfer.failures,0);
    assert.equal(transfer.originalSaveUnchanged,true);assert.equal(transfer.copiedSourceUnchanged,true);
    const directory=await ownedDirectory(transfer.fixture,'actor-arrival-fixture-received-checkpoint-');
    assert.equal(received.filename,join(directory,'Received.GMP'));assert.equal(transfer.received,received.filename);
    assert.equal(transfer.receivedSha256,received.sha256);assert.equal(transfer.sourceSha256,received.sha256);
    assert.equal(received.sha256,m.selectedRevisionExports[0].sha256);
    assert.equal(received.bytes,m.selectedRevisionExports[0].bytes);assert.equal(transfer.transferredBytes,received.bytes);
    assert.equal((await stat(received.filename)).size,received.bytes);assert.equal(await hash(received.filename),received.sha256);
    for(const item of transfer.frozenInputs)assert.equal(await hash(item.copy),item.sha256);
    assert.equal(await hash(transfer.testBinary.filename),transfer.testBinary.sha256);
    assert.equal(await hash(transfer.testLog.filename),transfer.testLog.sha256);
  }
  assert.equal(await hash(m.publicationManifest),m.publicationManifestSha256);assert.equal(await hash(m.receipt),m.receiptSha256);
  for(const row of m.selectedRevisionExports)assert.equal(await hash(row.filename),row.sha256);
  for(const [name,digest]of Object.entries(m.inputHashes))assert.equal(await hash(join(m.originalSettings,name)),digest);
  assert.equal(await hash(m.orphan),m.orphanSha256);assert.deepEqual(await readFile(m.orphan),Buffer.from([0]));
  if(m.symlink){
    const vault=join(fixture,'symlink-vault');assert.equal(m.symlink,join(m.worldRoot,'frontier_0_-1'));
    assert.equal(m.symlinkSentinel,join(vault,'preserve.txt'));assert.equal((await lstat(m.symlink)).isSymbolicLink(),true);
    assert.equal(await readlink(m.symlink),vault);assert.deepEqual(await readdir(vault),['preserve.txt']);
    assert.equal(await hash(m.symlinkSentinel),m.symlinkSentinelSha256);assert.equal(m.symlinkSentinelUnchanged,true);
  }
  const samples=m.resourceSamples;assert.ok(samples.length>0);assert.ok(samples.every(r=>r.pid===m.nativePid&&r.rssBytes<=m.rssCeilingBytes));
  const sharedHeightSeamsQualified=seams.every(seam=>seam.heightBytesDiffering===0);
  const qualified=(fullRestoration?.qualified??true)&&sharedHeightSeamsQualified;
  await writeFile(out,JSON.stringify({version:1,qualified,nativePid:m.nativePid,nativeNamedProfilesQualified:true,
    originalGenerateOnceAndSavedReturnsQualified:true,browserQualified:false,fullTypedRestorationCompared:fullRestoration!==null,sustainedMemoryBoundQualified:false,
    nativeDeveloperStateIsolationQualified:m.nativeIsolationVersion==='v1',
    fullTypedRestorationQualified:fullRestoration?.qualified??false,
    restorationBeforeCameraQualified:Boolean(m.restorationBeforeCameraExpected&&fullRestoration?.qualified),
    exactArrivalViewTransformQualified:Boolean(m.restorationBeforeCameraExpected&&cameraTransforms.length===trace.visits),cameraTransforms,
    nativeLoadedKingdomBindingFixtureQualified:Boolean(trace.loadedKingdomBindings&&fullRestoration?.qualified),
    loadedKingdomBindings:trace.loadedKingdomBindings??[],
    nativeRebuiltContextHoldFixtureQualified:Boolean(trace.rebuildHolds&&fullRestoration?.qualified),
    nativePreparedInputResumeFixtureQualified:Boolean(m.preparedResumeExpected&&trace.rebuildHolds&&fullRestoration?.qualified),
    rebuildHolds:trace.rebuildHolds??[],replicatedRebuildResumeQualified:false,
    productionSharedReaderExecuted:false,sharedSaveLoadResumeQualified:false,
    stagedReceivedCheckpointLoadQualified:Boolean(m.receivedHome&&fullRestoration?.qualified),receivedHome:m.receivedHome??null,
    sharedHeightSeamsQualified,
    nativeSingleEngineCooperativeSaveReturnQualified:!!kingdomWitness&&
      fullRestoration.restored.some(r=>r.serial>0&&r.region==='0_0'&&r.mode==='saved')&&
      fullRestoration.restored.filter(r=>r.serial>0&&r.region==='0_0'&&r.mode==='saved').every(r=>r.comparison?.matching===true),
    nativeOtherSavedRegionsExact:fullRestoration===null?null:
      fullRestoration.restored.filter(r=>r.serial>0&&r.region!=='0_0'&&r.mode==='saved').every(r=>r.comparison?.matching===true),
    cooperativeSourceSnapshots,
    fullRestoration,
    nativeSessionQueueObservationQualified:trace.queueObservations!==null,
    queueObservations:trace.queueObservations??[],
    nativeSessionQueueRetirementQualified:false,
    firstNativeCameraBoundaryTriggerQualified:trace.boundary!==null,boundaryTrigger:trace.boundary,continuousSpatialTravelQualified:false,
    allNativeCameraBoundaryTriggersQualified:trace.boundaries!==null,boundaryTriggers:trace.boundaries??[],panRouteInput,
    nativeCameraArrivalBeforeFirstTickQualified:trace.cameraArrivals!==null,
    originalHeroOutdoorDepartureStateQualified:outdoorHero!==null,outdoorHero,
    cameraArrivals:trace.cameraArrivals?.map(row=>({serial:+row.serial,region:row.region,direction:+row.direction,x:+row.x,y:+row.y,maxX:+row['max-x'],maxY:+row['max-y'],sourceX:+row['source-x'],sourceY:+row['source-y'],clock:+row.clock}))??[],
    scope:`${trace.visits} native visits through ${latest.size} regions with real named-profile routing, original generation/load/save/unload, clock/RNG persistence, parsed saved memberships and shared height borders; ${fullRestoration?'all saved loads compared before the first gameplay tick':'no before-first-tick full-state comparison'}.`,
    manifest:resolve(manifestFile),manifestSha256:await hash(manifestFile),nativeExecutableSha256:m.nativeExecutableSha256,nativeSourceSha256:m.nativeSourceSha256,
    visits:states.map((s,i)=>({serial:i+1,region:m.route[i],clock:s.clock,rng:s.rng,gameplayRng:s.gameplayRng,counts:s.counts,completedTicks:ticks[i]})),
    totalCompletedTicks:ticks.reduce((a,b)=>a+b,0),seam,seams,uniqueRegions:latest.size,uniqueKingdoms:latest.size,maximumSampledRssBytes:Math.max(...samples.map(r=>r.rssBytes)),
    originalWorldRootReleaseQualified:trace.releaseRequired,observedRootFrees:trace.releases.length*trace.rootsPerTransition,
    originalTerrainBufferReleaseQualified:trace.rootsPerTransition===8,
    releasedGeometryPayloadBytesPerTransition:trace.rootsPerTransition===8?530456+524288:null,
    disposalHeapSamples:trace.releases.map(row=>({serial:+row.serial,region:row.region,beforeBytes:+row['heap-before'],afterBytes:+row['heap-after'],beforeBlocks:+row['blocks-before'],afterBlocks:+row['blocks-after']})),
    evidenceSha256:{[m.log]:m.logSha256,[manifestFile]:await hash(manifestFile)},sourceSha256:{
      'scripts/inspect-native-region-session.mjs':await hash(new URL(import.meta.url).pathname),
      'scripts/inspect-native-coop-world.mjs':await hash(new URL('./inspect-native-coop-world.mjs',import.meta.url).pathname),
      'scripts/lib/session-compiled-inputs.mjs':await hash(new URL('./lib/session-compiled-inputs.mjs',import.meta.url).pathname),
      'scripts/lib/camera-arrival-state.mjs':await hash(new URL('./lib/camera-arrival-state.mjs',import.meta.url).pathname),
      'scripts/lib/connected-residency.mjs':await hash(new URL('./lib/connected-residency.mjs',import.meta.url).pathname)}},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({qualified,visits:trace.visits,kingdoms:latest.size,ticks:ticks.reduce((a,b)=>a+b,0),
    comparedLoads:fullRestoration?.comparedLoads??0,matchingLoads:fullRestoration?.matchingLoads??0,browserQualified:false}));
  if(!qualified)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{await main();}catch(error){
    console.error(String(error.message).slice(0,600));
    console.error(String(error.stack).split('\n').filter(line=>/^\s+at /.test(line)).slice(0,2).join('\n'));
    process.exitCode=1;
  }
}
