import test from 'node:test';
import assert from 'node:assert/strict';
import {originalMarkerClockTrace} from '../scripts/lib/marker-clock-trace.mjs';
const fixture=(phase='baseline')=>{
 const base=phase==='baseline'?25800:18250;
 const lines=[`[streaming] Marker clock begin phase=${phase} source=25800 destination=18250 actual=25800 unit=503 hero=502 callback=4101 serialized-equal=1`];
 for(let i=0;i<=4;++i){if(i===4)for(const reason of [2,1])lines.push(`[streaming] Marker callback clock=${base+200} reason=${reason} id=4101 original-delegated=1`);
  lines.push(`[streaming] Marker step index=${i} advance=${i*50} clock=${base+i*50} active=${Number(i<4)} leaves=${Math.floor(i/2)} callbacks=${2*Number(i===4)} completion=${Number(i===4)} cleanup=${Number(i===4)} flags=${i===4?2596:2592} clock-restored=1`);}
 lines.push(`[streaming] Marker clock complete phase=${phase} steps=5 leaves=2 callbacks=2 completion=1 cleanup=1 original-leaf=1 original-callback=1 clock-restored=1 hooks-removed=1 hero-transfer=0 result=pass`,'all expectations met');return lines.join('\n');
};
test('both clocks require identical relative original dispatch and completion chronology',()=>{
 const a=originalMarkerClockTrace(fixture()),b=originalMarkerClockTrace(fixture('rebased'));
 assert.equal(a.completionAdvance,200);assert.equal(b.completionAdvance,200);
 assert.deepEqual(a.steps.map(({clock,...s})=>s),b.steps.map(({clock,...s})=>s));
});
test('missing, duplicated, modeled, failed and oversized evidence refuses',()=>{
 const s=fixture();for(const bad of ['',s+s,s.replace('all expectations met',''),s.replace('original-leaf=1','original-leaf=0'),
  s.replace('original-callback=1','original-callback=0'),s+'\nresult=fail',s+'\nundeliverable call at 005abad0','x'.repeat(1024*1024+1)])assert.throws(()=>originalMarkerClockTrace(bad));
});
test('changed chronology, callback reason, frame count, death flag and restored clock refuse',()=>{
 const s=fixture();for(const bad of [s.replace('index=1','index=2'),s.replace('advance=50','advance=100'),
  s.replace('clock=25850','clock=18250'),s.replace('reason=2','reason=3'),s.replace('leaves=1','leaves=0'),
  s.replace('flags=2596','flags=2592'),s.replace('clock-restored=1','clock-restored=0'),
  s.replace('callbacks=2','callbacks=1'),s.replace('cleanup=1','cleanup=0'),s.replace('reason=1','reason=2'),s.replace('hooks-removed=1','hooks-removed=0'),s.replace('hero-transfer=0','hero-transfer=1')])assert.throws(()=>originalMarkerClockTrace(bad));
});
test('incomplete or extra lifecycle transitions and a foreign source clock refuse',()=>{
 const s=fixture();for(const bad of [s.replace(/^.*index=3.*\n/m,''),s.replace('source=25800','source=18250'),
  s.replace('actual=25800','actual=26000'),s.replace('phase=baseline steps=5','phase=rebased steps=5'),s.replace('steps=5','steps=6')])assert.throws(()=>originalMarkerClockTrace(bad));
});
