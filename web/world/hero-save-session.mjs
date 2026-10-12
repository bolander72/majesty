import {parseHeroRuntimeBinding,parseHeroHaloBinding} from './hero-runtime-binding.mjs';
import {boundNativeHeroCrossing} from './hero-travel-boundary.mjs';
import {parseNativeHeroArrivalReady,nativeHeroArrivalPublished} from './hero-travel-publication.mjs';
import {Sha256} from './sha256.mjs';
import {nativeHeroGenerationConsumedLine,parseNativeHeroGenerationInitialized} from './hero-generation-boundary.mjs';

function fields(line,prefix){
  if(typeof line!=='string'||line.length>1024||!line.startsWith(prefix))return null;
  const value={};
  for(const item of line.slice(prefix.length).split(' ')){
    const at=item.indexOf('=');if(at<1||Object.hasOwn(value,item.slice(0,at)))return null;
    value[item.slice(0,at)]=item.slice(at+1);
  }
  return value;
}
const uint=(text,max=0xffffffff)=>typeof text==='string'&&/^(0|[1-9][0-9]*)$/.test(text)&&Number(text)<=max;

// One pending pause/save/resume. A DOM click never establishes a save boundary.
export class NativeHeroSaveSession {
  #binding;#runtimeBinding;#halo=false;#bound=false;#ready=false;#serial=0;#trip=null;#stopped=false;
  constructor(binding,{haloBinding}={}){this.#binding=parseHeroRuntimeBinding(binding);this.#runtimeBinding=binding;
    if(haloBinding!==undefined){parseHeroHaloBinding(haloBinding,binding);this.#halo=true;}}
  get enabled(){return this.#bound&&this.#ready&&!this.#stopped;}
  get busy(){return this.#trip!==null;}
  get travelling(){return Boolean(this.#trip?.request);}
  queueTravel(request){
    const t=this.#trip,generating=request?.nativeAction===`frontier-hero-generate-${t?.serial}`;
    if(!this.enabled||t?.stage!=='held'||!t.crossing||!request||request.serial!==t.serial||
      request.sourceRegion!==this.#binding.region||request.targetRegion!==t.crossing.target||request.nativeActionIssued!==false||
      (!generating&&request.nativeAction!==`frontier-hero-travel-${t.serial}`)||typeof request.requestManifest!=='string'||request.requestManifest.length>4096)
      throw Error('Travel requires its staged native crossing request');
    const bytes=new TextEncoder().encode(request.requestManifest),input=JSON.parse(request.requestManifest);
    if(bytes.length!==request.requestSize||new Sha256().update(bytes).hex()!==request.requestSha256||input.serial!==t.serial||
      input.sourceRegion!==request.sourceRegion||input.targetRegion!==request.targetRegion||input.sourceClock!==Number(t.clock)||
      input.sourceAlias?.unitId!==this.#binding.unitId||input.sourceAlias?.agentId!==this.#binding.agentId||
      !['native','proxy'].includes(input.homeAlias?.kind)||(!generating&&!Number.isInteger(input.destinationClock))||
      (generating&&(input.kind!=='majesty-hero-generation-input-v1'||input.generation?.layout!=='halo-v1'||
        input.homeAlias.kind!==this.#binding.homeKind||input.homeAlias.unitId!==this.#binding.homeUnitId||input.homeAlias.agentId!==this.#binding.homeAgentId)))
      throw Error('Travel request differs from its held crossing');
    t.request=request;t.generating=generating;t.targetClock=generating?null:input.destinationClock;
    t.home=generating?null:{...input.homeAlias};t.stage='travel-queued';
  }
  acceptGeneratedPreparation(prepared){
    const t=this.#trip;
    if(!t?.generating||!['generation-preparing','travel-departed'].includes(t.stage)||prepared?.kind!=='generated'||
      prepared.serial!==t.serial||prepared.sourceRegion!==this.#binding.region||prepared.targetRegion!==t.request.targetRegion||
      prepared.arrival?.kind!=='proxy-home'||prepared.arrival.destinationClock!==t.initialized.clock||
      !Number.isInteger(prepared.home?.agentId)||prepared.home.agentId<=0||prepared.home.agentId>0x7fffffff)
      throw Error('Generated preparation differs from its initialized kingdom');
    t.targetClock=prepared.arrival.destinationClock;t.home={kind:'proxy',unitId:0,agentId:prepared.home.agentId};t.stage='travel-departed';
  }
  acceptTravelPublication(receipt){
    const t=this.#trip,r=t?.arrival;
    if(!r||!['travel-publishing','travel-awaiting-resume'].includes(t.stage)||receipt?.serial!==t.serial||receipt.region!==r.region||
      receipt.clock!==r.clock||receipt.owner?.unitId!==r.unitId||receipt.owner?.agentId!==r.agentId||
      JSON.stringify(receipt.home)!==JSON.stringify(t.home)||receipt.size!==r.size||receipt.sha256!==r.sha256||
      nativeHeroArrivalPublished(t.ready,receipt.ownerManifest)!==receipt.acknowledgement||
      new Sha256().update(new TextEncoder().encode(receipt.ownerManifest)).hex()!==receipt.ownerManifestSha256)
      throw Error('Published travel differs from its native arrival');
    t.published={...receipt,owner:{...receipt.owner},home:{...receipt.home}};t.stage='travel-awaiting-resume';
    return t.resumeLine?this.message(t.resumeLine):null;
  }
  completeTravel(receipt){
    const t=this.#trip,p=t?.published;
    if(t?.stage!=='travel-resume-observed'||!p)throw Error('Travel has no confirmed native resume');
    const b=parseHeroRuntimeBinding(receipt?.runtimeBinding);
    parseHeroHaloBinding(receipt?.haloBinding,receipt.runtimeBinding);
    if(b.region!==p.region||b.clock!==p.clock||b.unitId!==p.owner.unitId||b.agentId!==p.owner.agentId||
      b.homeKind!==p.home.kind||b.homeUnitId!==p.home.unitId||b.homeAgentId!==p.home.agentId||b.sha256!==p.sha256||
      b.description!==this.#binding.description||b.playerNumber!==this.#binding.playerNumber||b.homeDescription!==this.#binding.homeDescription)
      throw Error('Resumed hero differs from its published fresh binding');
    const buffered=Object.freeze([t.nextCrossing,t.nextHeld].filter(Boolean));
    this.#binding=b;this.#runtimeBinding=receipt.runtimeBinding;this.#halo=true;this.#trip=null;
    return buffered;
  }
  queue(){
    if(!this.enabled||this.busy||this.#serial===0xffffffff)throw Error('Saved hero is not ready for another journey save');
    this.#trip={serial:this.#serial+1,stage:'queued'};return this.#trip.serial;
  }
  cancel(){if(this.#trip?.stage==='queued')this.#trip=null;}
  stop(){this.#stopped=true;this.#trip=null;}
  finish(saved){
    if(this.#trip?.stage!=='held'||typeof saved!=='boolean')throw Error('Hero save has no native held boundary');
    this.#trip.stage='finished';this.#trip.saved=saved;
  }
  poll(name){
    const t=this.#trip;if(!t||this.#stopped)return null;
    if(t.stage==='travel-queued'&&name===t.request.nativeAction){t.stage='travel-requested';return {kind:'travel-requested',serial:t.serial};}
    if(name==='frontier-hero-save'&&t.stage==='queued'){
      t.stage='consumed';this.#serial=t.serial;return {kind:'requested',serial:t.serial};
    }
    if(name==='frontier-hero-save-finish'&&t.stage==='finished')return {kind:'finish-ready',serial:t.serial};
    if(t.stage==='finished'&&name===`frontier-hero-save-${t.saved?'saved':'failed'}-${t.serial}`){
      t.stage='acknowledged';return {kind:'acknowledged',serial:t.serial};
    }
    return null;
  }
  message(line){
    if(this.#stopped)return null;
    const b=this.#binding,enabled=fields(line,'[frontier] Selected hero bound ');
    if(enabled&&!this.#bound&&enabled.region===b.region&&enabled.unit===String(b.unitId)&&enabled.agent===String(b.agentId)&&
        enabled.home===`${b.homeUnitId}/${b.homeAgentId}`&&enabled.clock===String(b.clock)&&
        enabled['original-registry']==='1'&&enabled['reciprocal-home']==='1'){
      this.#bound=true;return {kind:'bound'};
    }
    if(this.#bound&&!this.#ready&&line===`[frontier] Region ${b.region} ready`){this.#ready=true;return {kind:'ready'};}
    const crossing=fields(line,'[frontier] Hero crossing ');
    if(this.enabled&&this.#halo&&(!this.#trip||this.#trip.stage==='queued')&&crossing&&
        Object.keys(crossing).sort().join(',')==='accepted,agent,clock,native-cells,original-tick,pending,phase,previous,previous-clock,region,serial,target,unit'&&
        ['serial','unit','agent','previous-clock','clock'].every(k=>uint(crossing[k]))&&
        Number(crossing.serial)===this.#serial+1&&crossing.phase==='3'&&crossing.pending==='7'&&crossing['original-tick']==='1'&&crossing['native-cells']==='4'){
      function pose(text){const numbers=text.split(',').map(Number);
        if(numbers.length!==3||numbers.some((n,i)=>String(n)!==text.split(',')[i]))throw Error('Noncanonical native hero pose');
        return {x:numbers[0],y:numbers[1],z:numbers[2]};}
      let accepted;
      try{accepted=boundNativeHeroCrossing(this.#runtimeBinding,{serial:Number(crossing.serial),region:crossing.region,target:crossing.target,
        previousClock:Number(crossing['previous-clock']),clock:Number(crossing.clock),unitId:Number(crossing.unit),agentId:Number(crossing.agent),
        previous:pose(crossing.previous),accepted:pose(crossing.accepted)});}catch{return null;}
      this.#serial=accepted.serial;this.#trip={serial:accepted.serial,stage:'consumed',crossing:accepted};
      return {kind:'crossing',serial:accepted.serial,crossing:accepted};
    }
    const t=this.#trip;if(!this.enabled||!t)return null;
    if(t.request){
      const request=t.request;
      if(t.stage==='travel-departed'&&line===`[frontier] Hero arrival refused serial=${t.serial} source=${request.sourceRegion} target=${request.targetRegion} clock=${t.targetClock} phase=7 pending=0 captured-recovery-preserved=1 owner-published=0`){
        this.stop();return {kind:'travel-failed',serial:t.serial};
      }
      if(t.generating){
        if(['travel-requested','generation-departed','generation-preparing','travel-departed'].includes(t.stage)&&
          (line===`[frontier] Hero generation recovery failed serial=${t.serial} captured-recovery-preserved=1`||
           line===`[frontier] Hero generation load refused serial=${t.serial} captured-recovery-preserved=1`)){
          this.stop();return {kind:'generation-failed',serial:t.serial};
        }
        if(t.stage==='travel-requested'&&line===`[frontier] Hero generation request refused serial=${t.serial} region=${b.region} clock=${t.clock} source-held=1`){
          t.stage='held';delete t.request;return {kind:'travel-refused',serial:t.serial};
        }
        if(t.stage==='travel-requested'&&line===nativeHeroGenerationConsumedLine(request)){
          t.stage='generation-departed';return {kind:'generation-departed',serial:t.serial,request,line};
        }
        if(t.stage==='generation-departed'){
          let initialized;try{initialized=parseNativeHeroGenerationInitialized(request,line);}catch{return null;}
          t.initialized=initialized;t.stage='generation-preparing';
          return {kind:'generation-held',serial:t.serial,request,line};
        }
      }
      // A fast hero can reach another boundary after the engine resumes but
      // before the browser's publication promise returns. Retain at most that
      // next crossing and held save, then replay them after the fresh rebind.
      if(t.resumeLine&&t.arrival&&typeof line==='string'&&line.length<=1024){
        const r=t.arrival,nextBinding=['majesty-hero-runtime-v1',r.region,r.clock,r.unitId,r.agentId,
          b.description,b.playerNumber,t.home.kind,t.home.unitId,t.home.agentId,b.homeDescription,r.sha256].join('|');
        if(!t.nextCrossing&&line.startsWith('[frontier] Hero crossing ')){
          const next=new NativeHeroSaveSession(nextBinding,{haloBinding:`majesty-hero-halo-v1|${r.region}|${r.sha256}`});
          next.#bound=true;next.#ready=true;next.#serial=t.serial;
          const accepted=next.message(line);
          if(accepted?.kind==='crossing'){t.nextCrossing=line;t.nextClock=accepted.crossing.clock;}
          return null;
        }
        const held=fields(line,'[frontier] Hero save held ');
        if(t.nextCrossing&&!t.nextHeld&&held&&held.serial===String(t.serial+1)&&held.region===r.region&&
          held.clock===String(t.nextClock)&&uint(held.slot,1)&&uint(held.bytes,64*1024*1024)&&Number(held.bytes)>=16&&
          /^[a-f0-9]{64}$/.test(held.sha256??'')&&held.phase==='7'&&held.pending==='0'){
          t.nextHeld=line;return null;
        }
      }
      if(t.stage==='travel-requested'&&line===`[frontier] Hero departure request refused serial=${t.serial} region=${b.region} clock=${t.clock} phase=7 pending=0`){
        t.stage='held';delete t.request;return {kind:'travel-refused',serial:t.serial};
      }
      if(t.stage==='travel-requested'&&line===`[frontier] Hero departure request consumed serial=${t.serial} source=${request.sourceRegion} target=${request.targetRegion} bytes=${request.requestSize} selected-owner-verified=1 crossing-verified=1 destination-input-verified=1 source-retired=1 phase=7 pending=0`){
        t.stage='travel-departed';return {kind:'travel-departed',serial:t.serial,request,line};
      }
      const prefix='[frontier] Hero travel publication held receipt=',suffix=' phase=7 pending=0 ordinary-ticks=0';
      if(t.stage==='travel-departed'&&typeof line==='string'&&line.length<=1024&&line.startsWith(prefix)&&line.endsWith(suffix)){
        const packet=line.slice(prefix.length,-suffix.length);let ready;try{ready=parseNativeHeroArrivalReady(packet);}catch{return null;}
        if(ready.serial!==t.serial||ready.region!==request.targetRegion||ready.clock!==t.targetClock||ready.homeAgentId!==t.home.agentId)return null;
        t.arrival=ready;t.ready=packet;t.stage='travel-publishing';return {kind:'travel-held',serial:t.serial,request,ready:packet};
      }
      const resumed=fields(line,'[frontier] Hero travel resumed '),r=t.arrival;
      if(resumed&&r&&['travel-publishing','travel-awaiting-resume'].includes(t.stage)&&
        Object.keys(resumed).sort().join(',')==='agent,clock,fresh-binding,home,manifest-sha256,original-resume,pending,phase,region,serial,unit'&&
        resumed.serial===String(t.serial)&&resumed.region===r.region&&resumed.clock===String(r.clock)&&
        resumed.unit===String(r.unitId)&&resumed.agent===String(r.agentId)&&
        resumed.home===`${t.home.kind}/${t.home.unitId}/${t.home.agentId}`&&/^[a-f0-9]{64}$/.test(resumed['manifest-sha256'])&&
        resumed['original-resume']==='1'&&resumed['fresh-binding']==='1'&&resumed.phase==='3'&&resumed.pending==='0'){
        if(!t.published){t.resumeLine=line;return null;}
        if(resumed['manifest-sha256']!==t.published.ownerManifestSha256)return null;
        t.stage='travel-resume-observed';return {kind:'travel-resumed',serial:t.serial,request,line};
      }
      return null;
    }
    const held=fields(line,'[frontier] Hero save held ');
    if(held&&t.stage==='consumed'&&held.serial===String(t.serial)&&held.region===b.region&&
        uint(held.clock)&&Number(held.clock)>=b.clock&&uint(held.slot,1)&&uint(held.bytes,64*1024*1024)&&Number(held.bytes)>=16&&
        /^[a-f0-9]{64}$/.test(held.sha256??'')&&held.phase==='7'&&held.pending==='0'&&(!t.crossing||Number(held.clock)===t.crossing.clock)){
      t.stage='held';t.clock=held.clock;
      return {kind:'held',...(t.crossing?{crossing:t.crossing}:{}),boundary:Object.freeze({serial:t.serial,region:b.region,clock:Number(held.clock),
        slot:Number(held.slot),size:Number(held.bytes),sha256:held.sha256})};
    }
    const failed=fields(line,'[frontier] Hero save failed ');
    if(failed&&t.stage==='consumed'&&failed.serial===String(t.serial)&&failed.region===b.region&&
        uint(failed.clock)&&failed.phase==='7'&&failed.pending==='3'&&(!t.crossing||Number(failed.clock)===t.crossing.clock)){
      t.stage='resuming';t.clock=failed.clock;t.saved=false;return {kind:'failed',serial:t.serial};
    }
    const released=fields(line,'[frontier] Hero save released ');
    if(released&&t.stage==='acknowledged'&&released.serial===String(t.serial)&&released.region===b.region&&
        released.clock===t.clock&&released.result===(t.saved?'saved':'failed')&&released.phase==='7'&&released.pending==='3'){
      t.stage='resuming';return {kind:'released',serial:t.serial};
    }
    const resumed=fields(line,'[frontier] Hero save resumed ');
    if(resumed&&t.stage==='resuming'&&resumed.serial===String(t.serial)&&resumed.region===b.region&&
        resumed.clock===t.clock&&resumed.phase==='3'&&resumed.pending==='0'){
      const saved=t.saved;this.#trip=null;return {kind:'resumed',serial:t.serial,saved};
    }
    const abandoned=fields(line,'[frontier] Hero save abandoned ');
    if(abandoned&&abandoned.serial===String(t.serial)&&abandoned.region===b.region){
      this.stop();return {kind:'abandoned',serial:t.serial};
    }
    return null;
  }
}
