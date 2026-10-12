import {regionKey,selectedRegion} from './region.mjs';
import {selectedWorld,worldName} from './world-name.mjs';

const directions={west:[-1,0],north:[0,-1],south:[0,1],east:[1,0]};
function fields(line,prefix){
  if(!line.startsWith(prefix))return null;
  const value={};
  for(const item of line.slice(prefix.length).split(' ')){
    const at=item.indexOf('=');if(at<1||Object.hasOwn(value,item.slice(0,at)))return null;
    value[item.slice(0,at)]=item.slice(at+1);
  }
  return value;
}

// One trip and one active region, no accumulating route/log/kingdom catalogue.
// Native events, rather than a DOM click or checkpoint acknowledgement alone,
// must confirm disposal and attachment before the UI/storage capability moves.
export class NativeRegionSession {
  #root;#world;#region;#serial=0;#enabled=false;#trip=null;#stopped=false;#releaseRequired=false;#releaseVersion='';
  #crossing=false;#gesture=0;
  constructor(region,root){
    regionKey(region.x,region.y);
    const prefix='/opfs/majesty/profile/native-world-';
    if(region.key!==regionKey(region.x,region.y)||typeof root!=='string'||!root.startsWith(prefix))
      throw new Error('Invalid native region session');
    this.#world=worldName(root.slice(prefix.length));this.#region={...region};this.#root=root;
  }
  get enabled(){return this.#enabled&&!this.#stopped;}
  get busy(){return this.#trip!==null;}
  get consumed(){return this.#trip!==null&&this.#trip.stage!=='queued';}
  queue(direction,destination,mode){
    if(!this.enabled||this.busy||!Object.hasOwn(directions,direction))throw new Error('Native region session is not ready for travel');
    const to=selectedRegion(new URL(destination).search),[dx,dy]=directions[direction];
    if(!to||selectedWorld(new URL(destination).search)!==this.#world||to.key!==regionKey(this.#region.x+dx,this.#region.y+dy)||!['new','saved'].includes(mode))
      throw new Error('Native travel requires the admitted neighbor');
    this.#trip={serial:this.#serial+1,from:this.#region.key,to,direction,url:String(destination),mode,stage:'queued',fallback:false};
  }
  poll(name){
    const trip=this.#trip;if(!this.enabled||trip?.stage!=='queued')return false;
    if(name==='frontier-travel')return true;
    if(name!==`frontier-travel-${trip.direction}`)return false;
    trip.stage='consumed';return true;
  }
  cancel(){if(this.#trip?.stage==='queued')this.#trip=null;}
  stop(){this.#stopped=true;this.#trip=null;}
  message(line){
    if(this.#stopped||typeof line!=='string')return null;
    const enabled=fields(line,'[frontier] Session enabled ');
    if(enabled){
      if(!this.#enabled&&enabled.version==='v1'&&enabled.region===this.#region.key&&enabled.root===this.#root&&
          (enabled.release===undefined||['v1','v2'].includes(enabled.release))){
        this.#enabled=true;this.#releaseVersion=enabled.release??'';this.#releaseRequired=this.#releaseVersion!=='';
        this.#crossing=enabled.crossing==='v1'&&this.#releaseVersion==='v2';return {kind:'enabled'};
      }
      return null;
    }
    const trip=this.#trip;
    const boundary=fields(line,'[frontier] Session boundary ');
    if(this.enabled&&this.#crossing&&boundary&&boundary.serial===String(this.#serial)&&boundary.region===this.#region.key&&
        Object.hasOwn(directions,boundary.direction)&&/^[1-9][0-9]*$/.test(boundary.gesture??'')&&
        Number.isSafeInteger(Number(boundary.gesture))&&Number(boundary.gesture)>this.#gesture){
      this.#gesture=Number(boundary.gesture);return trip?null:{kind:'boundary',direction:boundary.direction};
    }
    if(!this.enabled||!trip)return null;
    if(line===`[frontier] Session destination refused source=${trip.from} target=${trip.to.key}`||
        line===`[frontier] Session checkpoint failed region=${trip.from}`){
      if(trip.stage!=='consumed')return null;
      this.#trip=null;return {kind:'refused'};
    }
    const save=fields(line,'[frontier] Session checkpoint ');
    if(save&&trip.stage==='consumed'&&save.serial===String(trip.serial)&&save.region===trip.from&&
        save.direction===String(Object.keys(directions).indexOf(trip.direction))&&/^[0-9]+$/.test(save.clock)){
      trip.stage='saved';trip.clock=save.clock;return {kind:'saved'};
    }
    const quit=fields(line,'[frontier] Session quit ');
    if(quit&&trip.stage==='saved'&&quit.serial===String(trip.serial)&&quit.region===trip.from&&
        quit['saved-clock']===trip.clock&&quit.clock==='0'&&quit.loading==='0'){
      trip.stage='quit';return {kind:'quit'};
    }
    const release=fields(line,'[frontier] Session released ');
    if(this.#releaseRequired&&release&&trip.stage==='quit'&&release.serial===String(trip.serial)&&release.region===trip.from&&
        release['roots-freed']===(this.#releaseVersion==='v2'?'1,1,1,1,1,1,1,1':'1,1,1,1,1,1')&&release.clock==='0'&&
        (this.#releaseVersion!=='v2'||release['terrain-bytes']==='530456'&&release['spatial-bytes']==='524288')&&
        ['heap-before','heap-after','blocks-before','blocks-after'].every(key=>/^[0-9]+$/.test(release[key]??'')&&Number.isSafeInteger(Number(release[key])))){
      trip.stage='released';return {kind:'released'};
    }
    const unload=fields(line,'[frontier] Session unloaded ');
    if(unload&&trip.stage===(this.#releaseRequired?'released':'quit')&&unload.serial===String(trip.serial)&&unload.source===trip.from&&unload.target===trip.to.key&&
        unload['world-null']==='1'&&unload.profile===`${this.#root}/frontier_${trip.to.key}`){
      trip.stage='unloaded';return {kind:'unloaded'};
    }
    const removed=fields(line,'[frontier] Session release observer removed ');
    if(this.#releaseRequired&&removed&&trip.stage==='unloaded'&&!trip.observerRemoved&&removed.serial===String(trip.serial)&&
        removed['retained-roots']==='0'&&/^[0-9]+$/.test(removed.hooks??'')&&Number.isSafeInteger(Number(removed.hooks))){
      trip.observerRemoved=true;return {kind:'observer-removed'};
    }
    const fallback=fields(line,'[frontier] Session fallback ');
    if(fallback&&trip.stage==='unloaded'&&fallback.serial===String(trip.serial)&&fallback.region===trip.from&&fallback.restored==='0'){
      this.stop();return {kind:'unavailable'};
    }
    if(fallback&&trip.stage==='unloaded'&&fallback.serial===String(trip.serial)&&fallback.region===trip.from&&fallback.restored==='1'){
      trip.fallback=true;return {kind:'fallback'};
    }
    const attach=fields(line,'[frontier] Session attached '),expected=trip.fallback?trip.from:trip.to.key;
    if(attach&&trip.stage==='unloaded'&&(!this.#releaseRequired||trip.observerRemoved)&&attach.serial===String(trip.serial)&&attach.region===expected&&
        attach.mode===(trip.fallback?'saved':trip.mode)&&attach.phase==='1'&&attach.pending==='2'){
      trip.stage='attached';
      const region=trip.fallback?this.#region:trip.to;
      this.#region={...region};this.#serial=trip.serial;
      return {kind:'attached',source:trip.from,region:{...region},serial:trip.serial,mode:attach.mode,fallback:trip.fallback,url:trip.url};
    }
    if(trip.stage==='attached'&&line===`[frontier] Region ${expected} ready`){
      const fallback=trip.fallback;this.#trip=null;return {kind:'ready',fallback};
    }
    if(line===`[frontier] Session unavailable region=${expected}`){this.stop();return {kind:'unavailable'};}
    return null;
  }
}
