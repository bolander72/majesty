import {test} from 'node:test';import assert from 'node:assert/strict';
import {originalHomeValidityTrace} from '../scripts/lib/home-validity-trace.mjs';
const valid=`[streaming] Home validity id=7 native-id=469 native-loaded=1 deleted=0 reference=1 original-valid=1 unchanged=1 result=pass
[streaming] Home validity id=12 native-id=0 native-loaded=0 deleted=0 reference=1 original-valid=0 unchanged=1 result=pass
[streaming] Home validity id=20 native-id=0 native-loaded=0 deleted=0 reference=1 original-valid=0 unchanged=1 result=pass
[streaming] Home validity boundary clock=8750 aliases=3 scratch=64 home-written=0 pure-agents-scheduled=0 state-preserved=1 result=pass
all expectations met\n`;
test('requires loaded positive control and both registered script-only negative controls',()=>{
 assert.equal(originalHomeValidityTrace(valid).clock,8750);
 for(const text of ['',valid.replace('id=20','id=12'),valid.replace('native-loaded=0','native-loaded=1'),valid.replace('original-valid=0','original-valid=1'),valid.replace('deleted=0','deleted=1'),valid.replace('unchanged=1','unchanged=0'),valid.replace('home-written=0','home-written=1'),valid.replace('clock=8750','clock=4294967296'),valid.replace('all expectations met','')])assert.throws(()=>originalHomeValidityTrace(text));
});
test('refuses repeated, incomplete, failed and oversized trials',()=>{
 for(const text of [valid+valid,valid.replace(/^.*id=20.*\n/m,''),valid+'\nresult=fail',valid+'\nundeliverable call at 00625580','x'.repeat(1024*1024+1)])assert.throws(()=>originalHomeValidityTrace(text));
});
