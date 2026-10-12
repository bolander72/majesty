// Scene-owned views expire on publication of a replacement. Iterators keep a
// lease and an index, never a native Map iterator with an obsolete backing table.
export const MAX_SCENE_VIEW_ENTRIES=49;
class SceneIterator {
  #lease;#kind;#index=0;
  constructor(lease,kind){this.#lease=lease;this.#kind=kind;}
  next(){
    if(!this.#lease)return {done:true,value:undefined};
    const item=this.#lease.item(this.#index++,this.#kind);
    if(item.done)this.#lease=null;
    return item;
  }
  return(){this.#lease=null;return {done:true,value:undefined};}
  [Symbol.iterator](){return this;}
}
export class SceneViewLease {
  #map;#keys;
  constructor(map){
    if(!(map instanceof Map)||map.size>MAX_SCENE_VIEW_ENTRIES)throw new Error('Invalid native scene view');
    this.#map=map;this.#keys=Array.from(map.keys());
    const view={has:this.has.bind(this),get:this.get.bind(this),keys:this.keys.bind(this),
      values:this.values.bind(this),entries:this.entries.bind(this),[Symbol.iterator]:this.entries.bind(this)};
    Object.defineProperty(view,'size',{get:this.size.bind(this),enumerable:true});
    this.view=Object.freeze(view);
  }
  size(){return this.#map?.size??0;}
  has(id){return this.#map?.has(id)??false;}
  get(id){return this.#map?.get(id);}
  keys(){return new SceneIterator(this,'keys');}
  values(){return new SceneIterator(this,'values');}
  entries(){return new SceneIterator(this,'entries');}
  item(index,kind){
    if(!this.#map||index>=this.#keys.length)return {done:true,value:undefined};
    const key=this.#keys[index];
    return {done:false,value:kind==='keys'?key:kind==='values'?this.#map.get(key):[key,this.#map.get(key)]};
  }
  revoke(){this.#map=null;this.#keys=[];}
}
