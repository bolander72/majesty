// These messages acknowledge original mutations. A cold checkpoint or a
// caller's preferred dimensions/clock is never an initialized destination.
export function nativeHeroGenerationConsumedLine(request){
 return `[frontier] Hero generation request consumed serial=${request.serial} source=${request.sourceRegion} target=${request.targetRegion} bytes=${request.requestSize} selected-owner-verified=1 crossing-verified=1 target-absent-verified=1 source-retired=1 phase=7 pending=0`;
}
export function parseNativeHeroGenerationInitialized(request,line){
 if(typeof line!=='string'||line.length>1024)throw Error('Missing original generation initialization');
 const match=/^\[frontier\] Hero generation initialized serial=([1-9][0-9]*) source=(-?(?:0|[1-9][0-9]*)_-?(?:0|[1-9][0-9]*)) target=(-?(?:0|[1-9][0-9]*)_-?(?:0|[1-9][0-9]*)) clock=([1-9][0-9]*) slot=([01]) bytes=([1-9][0-9]*) sha256=([a-f0-9]{64}) layout=halo-v1 shared-vertices=2480 original-generator=1 original-writer=1 source-roots-cleared=1 phase=7 pending=0 original-ticks=([1-9][0-9]*) hero-imported=0 owner-published=0$/.exec(line);
 if(!match||match[1]!==String(request.serial)||match[2]!==request.sourceRegion||match[3]!==request.targetRegion||
   !Number.isSafeInteger(Number(match[6]))||Number(match[6])<16||Number(match[6])>64*1024*1024||
   Number(match[8])<2||Number(match[8])>66||Number(match[4])!==Number(match[8])*50)
  throw Error('Generation initialization differs from its staged request');
 return Object.freeze({serial:request.serial,region:request.targetRegion,clock:Number(match[4]),ticks:Number(match[8]),slot:Number(match[5]),size:Number(match[6]),sha256:match[7],line});
}
