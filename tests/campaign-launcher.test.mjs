import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {chapters,selectedProfile,chapterURL} from '../web/campaign/progress.mjs';
import {campaignWorldContext,worldNavigationURL} from '../web/multiplayer/navigation.mjs';

const source=await readFile(new URL('../web/campaign/launcher.mjs',import.meta.url),'utf8');
async function launcher(search,finished,options={}){
  const elements=[],nodes=new Map(),opened=[],resets=[];
  const make=tag=>{
    const node={tag,style:{},children:[],attributes:{},textContent:'',hidden:false,value:'',
      appendChild(child){this.children.push(child);return child;},
      append(...children){this.children.push(...children);},
      setAttribute(name,value){this.attributes[name]=value;},
      removeAttribute(name){delete this.attributes[name];if(name==='href')delete this.href;},
      addEventListener(name,fn){this[name]=fn;},setCustomValidity(value){this.validity=value;},
      reportValidity(){return true;},remove(){this.removed=true;}};
    elements.push(node);return node;
  };
  for(const id of ['notice','profile','relay','profile-state','profile-form','chapters','campaign-state','continue','world-return'])nodes.set(`#${id}`,make(id==='continue'?'a':'div'));
  const db={close(){}};
  await runInNewContext(`(async()=>{${source.replace(/^import .*;\n/gm,'')}})()`,{
    document:{querySelector(key){return nodes.get(key);},createElement:make},
    location:{search,href:`https://game.example/campaign/${search}`,assign(){}},
    URL,URLSearchParams,chapters,selectedProfile,chapterURL,campaignWorldContext,worldNavigationURL,addEventListener(){},
    async openProgress(profile){opened.push(profile);if(options.openFailure)throw Error('storage blocked');return db;},
    async completion(_db,chapter){if(options.readFailure===chapter)throw Error('read failed');return finished[chapter-1] ?? false;},
    async resetCompletion(_db,chapter){if(options.resetFailure)throw Error('reset aborted');resets.push(chapter);}
  });
  return {elements,nodes,opened,resets,get next(){return nodes.get('#continue');},get state(){return nodes.get('#campaign-state');},get relay(){return nodes.get('#relay');}};
}
test('campaign recommends the earliest unfinished chapter and preserves each original chapter link',async()=>{
  for(const [finished,next] of [[[false,false,false],1],[[true,false,false],2],[[true,true,false],3],[[false,true,true],1]]){
    const ui=await launcher('?profile=alice&relay=wss%3A%2F%2Frelay.example%2Frooms',finished);
    assert.deepEqual(ui.opened,['alice']);assert.equal(ui.next.hidden,false);
    const url=new URL(ui.next.href);
    assert.equal(url.searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'),String(next));
    assert.equal(url.searchParams.get('RECOMP_RULE_INVENTORY_COMPAT'),'1');
    assert.equal(url.searchParams.get('profile'),'alice');
    assert.equal(url.searchParams.get('relay'),'wss://relay.example/rooms');
    const individual=ui.elements.filter(e=>e.textContent==='Play this chapter');
    assert.deepEqual(individual.map(e=>new URL(e.href).searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER')),['1','2','3','4']);
  }
});
test('all completed chapters show replay, and a successful reset updates recommendation',async()=>{
  const ui=await launcher('?profile=bob',[true,true,true,true]);
  assert.equal(ui.next.hidden,true);assert.match(ui.state.textContent,/All 4 chapters completed locally/);
  const reset=ui.elements.find(e=>e.textContent==='Reset chapter 2 completion');await reset.onclick();
  assert.deepEqual(ui.resets,[2]);assert.equal(reset.removed,true);assert.equal(ui.next.hidden,false);
  assert.equal(new URL(ui.next.href).searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'),'2');
  assert.match(ui.state.textContent,/3 of 4/);
});
test('failed resets keep completed progress and the existing recommendation',async()=>{
  const ui=await launcher('',[true,true,false],{resetFailure:true});
  const reset=ui.elements.find(e=>e.textContent==='Reset chapter 1 completion');await reset.onclick();
  assert.equal(reset.removed,undefined);assert.equal(reset.disabled,false);assert.deepEqual(ui.resets,[]);
  assert.equal(new URL(ui.next.href).searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'),'3');
});
test('unknown stored progress cannot masquerade as an unfinished or completed campaign',async()=>{
  for(const options of [{openFailure:true},{readFailure:2}]){
    const ui=await launcher('',[true,true,true,true],options);
    assert.equal(ui.next.hidden,true);assert.match(ui.state.textContent,/progress is unavailable/);
    assert.equal(ui.elements.filter(e=>e.textContent==='Progress unavailable').length,options.openFailure?4:1);
  }
  const invalid=await launcher('?profile=a&profile=b',[false,false,false]);
  assert.deepEqual(invalid.opened,[]);assert.equal(invalid.next.hidden,true);
});
test('relay edits update both recommendation and chapter links, refusing invalid protocols',async()=>{
  const ui=await launcher('?profile=alice',[true,false,false]);
  const links=[ui.next,...ui.elements.filter(e=>e.textContent==='Play this chapter')];
  ui.relay.value='https://relay.example';ui.relay.input();
  for(const link of links){assert.equal(link.href,undefined);assert.equal(link.attributes['aria-disabled'],'true');}
  ui.relay.value='wss://relay.example/rooms';ui.relay.input();
  for(const link of links){
    assert.equal(link.attributes['aria-disabled'],'false');
    assert.equal(new URL(link.href).searchParams.get('relay'),'wss://relay.example/rooms');
    assert.equal(new URL(link.href).searchParams.get('profile'),'alice');
  }
  assert.equal(new URL(ui.next.href).searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'),'2');
});
test('world-aware campaign links retain the actual region, local profile and original chapter in setup',async()=>{
  const search='?mode=coop&chapter=1&world=our-world&region=-2_3&role=guest&room=Our+room&profile=alice&relay=wss%3A%2F%2Frelay.example%2Frooms&worldChapter=1';
  const ui=await launcher(search,[true,false,false]);
  const next=new URL(ui.next.href);assert.equal(next.pathname,'/multiplayer/');
  for(const [key,value]of Object.entries({world:'our-world',region:'-2_3',profile:'alice',role:'guest',chapter:'2',worldChapter:'1'}))
    assert.equal(next.searchParams.get(key),value);
  const back=ui.nodes.get('#world-return');assert.equal(back.hidden,false);
  assert.equal(new URL(back.href).searchParams.get('chapter'),'1');
  ui.relay.value='https://bad.example';ui.relay.input();assert.equal(back.href,undefined);assert.equal(ui.next.href,undefined);
  ui.relay.value='wss://new.example/rooms';ui.relay.input();
  assert.equal(new URL(back.href).searchParams.get('relay'),'wss://new.example/rooms');
  assert.equal(new URL(ui.next.href).searchParams.get('world'),'our-world');
});
