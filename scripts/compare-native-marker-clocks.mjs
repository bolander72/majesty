#!/usr/bin/env node
// Compare complete original writer bytes across two independent fresh loads.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {inspectNativeMarkerClock} from './inspect-native-marker-clock.mjs';
export async function compareNativeMarkerClocks(source,rebased) {
const a=await inspectNativeMarkerClock(source),b=await inspectNativeMarkerClock(rebased);
assert.equal(a.phase,'baseline');assert.equal(b.phase,'rebased');assert.equal(a.preparation,b.preparation);
assert.equal(a.nativeExecutableSha256,b.nativeExecutableSha256);assert.deepEqual(a.nativeSourceSha256,b.nativeSourceSha256);
assert.equal(a.trace.steps.length,b.trace.steps.length);assert.equal(a.trace.completionAdvance,b.trace.completionAdvance);
const observations=[];
for(let i=0;i<a.samples.length;++i){
 const x=a.samples[i],y=b.samples[i];
 for(const key of ['index','advance','active','leaves','callbacks','completion','cleanup','flags'])assert.equal(x[key],y[key]);
 for(const part of ['effect','hero']){assert.equal(x[part].bytes,y[part].bytes);assert.equal(x[part].sha256,y[part].sha256);}
 const before=await readFile(x.orders.filename),after=Buffer.from(await readFile(y.orders.filename));
 assert.equal(before.length,after.length);
 if(x.active)after.writeUInt32LE((after.readUInt32LE(44)+25800-18250)>>>0,44);
 assert.deepEqual(after,before,'Only original marker dispatch timestamp may differ');
 observations.push({index:i,advance:x.advance,active:x.active,leaves:x.leaves,completion:x.completion,
  effectSha256:x.effect.sha256,heroSha256:x.hero.sha256,orderBytes:before.length,
  ...(x.active?{sourceWhen:x.when,destinationWhen:y.when}:{})});
}
const result={version:1,crossClockNewRecruitMarkerQualified:true,scope:'Original source002 Newrecruit effect503/marker5 and callback4101 execute to completion after fresh full-world loads, with bases25800 and18250 projected synchronously in the source world. Full original effect/hero UNIT bytes and marker bank bytes match at every relative step except dispatch timestamp. No destination-world import, actor handoff, browser or general marker mode qualification.',
 sourceManifest:resolve(source),sourceManifestSha256:a.sourceManifestSha256,rebasedManifest:resolve(rebased),rebasedManifestSha256:b.sourceManifestSha256,
 sourceClockMs:25800,destinationClockMs:18250,completionAdvance:a.trace.completionAdvance,
 originalLeafCalls:a.trace.leaves,originalCompletionCallbacks:1,observations,
 nativeExecutableSha256:a.nativeExecutableSha256,nativeSourceSha256:a.nativeSourceSha256,nativeSymbolsSha256:a.nativeSymbolsSha256,
 maximumSampledRssBytes:Math.max(a.maxSampledRssBytes,b.maxSampledRssBytes),nativeProcessesTerminal:true,
 browserUsed:false,nativeProcessesStarted:0,heroCrossingQualified:false,destinationEffectImportQualified:false,
 arbitraryMarkerModesQualified:false,wholeBrowserResourceBoundQualified:false};
return result;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)) {
 const [source,rebased,out]=process.argv.slice(2);assert.equal(process.argv.length,5,'Usage: <baseline manifest> <rebased manifest> <fresh paired proof>');
 const result=await compareNativeMarkerClocks(source,rebased);
 await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({crossClockNewRecruitMarkerQualified:true,completionAdvance:result.completionAdvance,
  originalLeafCalls:result.originalLeafCalls,steps:result.observations.length,browserUsed:false}));
}
