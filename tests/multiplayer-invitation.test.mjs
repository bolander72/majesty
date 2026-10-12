import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {settings, selectedInvitation, roomName, invitationURL, gameURL, modeLabel, localSite} from '../web/multiplayer/invitation.mjs';
import {cooperativeWorldSettings} from '../web/multiplayer/cooperative-world.mjs';
import {parseResumeToken, resumeLabel} from '../web/multiplayer/resume-checkpoint.mjs';
import {worldNavigationURL} from '../web/multiplayer/navigation.mjs';

const base='https://game.example/multiplayer/';
const coop={mode:'coop',chapter:2,role:'host',room:'Frontier 2',relay:'wss://relay.example/rooms'};
test('co-op invitation round trip keeps shared rules and chooses a separate recipient profile',()=>{
  const invitation=invitationURL(`${base}?profile=private-host&RECOMP_TRACE_POINTER=1&world=private`,coop);
  assert.equal(invitation.pathname,'/multiplayer/');
  assert.deepEqual([...invitation.searchParams.keys()],['invite','mode','chapter','room','relay','role']);
  const recipient=selectedInvitation(invitation.search),selected=settings(recipient,base);
  assert.equal(recipient.hasProfile,false);assert.equal(selected.role,'guest');
  const game=gameURL(base,selected,'guest-local');
  assert.equal(game.pathname,'/majesty/');assert.equal(game.searchParams.get('profile'),'guest-local');
  assert.equal(game.searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'),'2');
  assert.equal(game.searchParams.get('RECOMP_RULE_INVENTORY_COMPAT'),'1');
  assert.equal(game.searchParams.get('room'),'Frontier 2');
  assert.equal(game.searchParams.get('relay'),'wss://relay.example/rooms');
});
test('competitive invites and game launches omit every cooperative rule',()=>{
  const selected={...coop,mode:'competitive',chapter:null};
  const invitation=invitationURL(base,selected),parsed=selectedInvitation(invitation.search);
  assert.equal(invitation.searchParams.has('chapter'),false);
  const game=gameURL(base,parsed,'competitor');
  assert.equal(game.searchParams.get('mode'),'competitive');
  assert.equal([...game.searchParams.keys()].some(key=>key.startsWith('RECOMP_RULE_')),false);
  assert.equal(modeLabel(settings(parsed,base)),'Competitive skirmish');
  assert.throws(()=>settings({...selected,chapter:1},base),/cannot select a co-op/);
});
test('shared world invitations reproduce every travel rule without the host profile or diagnostics',()=>{
  const world={...coop,world:'expedition-7',region:'-1_2'};
  const invite=invitationURL('https://game.example/majesty/?profile=host-private&RECOMP_TRACE_POINTER=1',world);
  assert.equal(invite.searchParams.get('world'),world.world);
  assert.equal(invite.searchParams.get('region'),world.region);
  assert.equal(invite.searchParams.has('profile'),false);
  assert.equal([...invite.searchParams.keys()].some(key=>key.startsWith('RECOMP_')),false);
  const recipient=settings(selectedInvitation(invite.search),base);
  const host=gameURL(base,world,'local-host'),guest=gameURL(base,recipient,'local-guest');
  const rules=url=>[...url.searchParams].filter(([key])=>key.startsWith('RECOMP_RULE_'));
  assert.deepEqual(rules(host),rules(guest));
  assert.equal(guest.searchParams.get('profile'),'local-guest');
  assert.deepEqual(cooperativeWorldSettings(guest.search),{region:{x:-1,y:2},chapter:2});
  for(const change of [{world:'../private'},{world:'Mixed'},{world:'a'.repeat(41)},
    {region:'01_0'},{region:'1000001_0'},{mode:'competitive',chapter:null}])
    assert.throws(()=>settings({...world,...change},base));
  assert.throws(()=>settings({...coop,region:'1_0'},base));
});
test('invitation parser refuses ambiguous settings, unsupported versions and unsafe profiles',()=>{
  for(const key of ['invite','mode','chapter','world','region','room','relay','role','profile'])
    assert.throws(()=>selectedInvitation(`?${key}=a&${key}=b`));
  assert.throws(()=>selectedInvitation('?invite=2'),/unsupported/);
  assert.throws(()=>selectedInvitation('?profile=..%2Fother'),/profile/);
  for(const change of [{mode:'solo'},{role:'admin'},{chapter:5},{chapter:'01'},{chapter:1.5},{room:'a'.repeat(25)},{room:'<script>'}])
    assert.throws(()=>settings({...coop,...change},base));
  assert.equal(roomName("Mike's room"),"Mike's room");
});
test('shared addresses reject embedded credentials, mixed content and non-network schemes',()=>{
  for(const relay of ['https://relay.example','javascript:alert(1)','wss://user:pass@relay.example/rooms','wss://relay.example/rooms#secret','/rooms','ws://relay.example/rooms'])
    assert.throws(()=>invitationURL(base,{...coop,relay}));
  assert.throws(()=>invitationURL('https://user:pass@game.example/multiplayer/',coop),/credentials/);
  assert.throws(()=>invitationURL('file:///multiplayer/',coop),/HTTP/);
  assert.throws(()=>gameURL(base,coop,'../other'),/profile/);
});
test('defaults use the game host and explicit WebSocket endpoint for both peers',()=>{
  const selected=settings({...coop,relay:''},'http://localhost:8000/multiplayer/');
  assert.equal(selected.relay,'ws://localhost:8002/rooms');
  const invitation=invitationURL('http://localhost:8000/multiplayer/',selected);
  assert.equal(invitation.searchParams.get('relay'),selected.relay);
  assert.equal(settings({...coop,relay:''},base).relay,'wss://game.example/rooms');
  assert.equal(settings({...coop,relay:''},'https://game.example:8443/games/multiplayer/').relay,'wss://game.example:8443/rooms');
  assert.equal(settings({...coop,relay:''},'http://192.168.1.20:8080/multiplayer/').relay,'ws://192.168.1.20:8080/rooms');
  assert.equal(settings({...coop,relay:''},'http://[::1]:8000/multiplayer/').relay,'ws://[::1]:8002/rooms');
  assert.equal(localSite('http://[::1]:8000/'),true);assert.equal(localSite(base),false);
});
test('invitations preserve deployment subdirectories but clear unrelated queries and fragments',()=>{
  const invitation=invitationURL('https://game.example/games/majesty/?profile=private#debug',coop);
  assert.equal(invitation.pathname,'/games/multiplayer/');assert.equal(invitation.hash,'');
  assert.equal(invitation.searchParams.has('profile'),false);
  assert.equal(gameURL('https://game.example/games/multiplayer/',coop).pathname,'/games/majesty/');
});

const launcherSource=await readFile(new URL('../web/multiplayer/launcher.mjs',import.meta.url),'utf8');
const sessionSource=await readFile(new URL('../web/multiplayer/session.mjs',import.meta.url),'utf8');
function node(tag){return {tag,value:'',style:{},attributes:{},children:[],hidden:false,textContent:'',
  appendChild(child){this.children.push(child);return child;},
  addEventListener(name,fn){this[name]=fn;},setAttribute(key,value){this.attributes[key]=value;},
  removeAttribute(key){delete this.attributes[key];if(key==='href')delete this.href;}};}
function setup(search='',options={}){
  const ids=['setup','mode','chapter','chapter-field','world','world-field','region-x','region-y','world-chapter-note','role','room','relay','profile','selection','instructions','play','copy','invite-url','status','reachability','campaign-progress'];
  const ui=Object.fromEntries(ids.map(id=>[id,node(id)])),copied=[];
  runInNewContext(launcherSource.replace(/^import .*;\n/gm,''),{
    selectedInvitation,settings,invitationURL,gameURL,modeLabel,localSite,parseResumeToken,resumeLabel,worldNavigationURL,URL,URLSearchParams,Uint8Array,
    crypto:{getRandomValues(bytes){bytes.set([1,2,3,4]);return bytes;}},
    navigator:{clipboard:options.clipboard ?? {async writeText(value){copied.push(value);}}},
    location:{search,href:`${options.base||base}${search}`},document:{getElementById(id){return ui[id];}}
  });
  return {ui,copied,edit(values){for(const [key,value]of Object.entries(values))ui[key].value=value;ui.setup.input();}};
}
test('actual setup defaults to an isolated host profile and generates a shareable guest link',async()=>{
  const {ui,copied}=setup();
  assert.equal(ui.profile.value,'multiplayer-host');assert.equal(ui.room.value,'Majesty-01020304');
  assert.equal(ui.play.attributes['aria-disabled'],'false');
  assert.equal(new URL(ui.play.href).searchParams.get('profile'),'multiplayer-host');
  await ui.copy.click();assert.deepEqual(copied,[ui['invite-url'].value]);
  const invitation=new URL(copied[0]);assert.equal(invitation.searchParams.has('profile'),false);
  assert.equal(invitation.searchParams.get('role'),'guest');assert.match(ui.status.textContent,/Invitation copied/);
});
test('personal progress link tracks the selected profile without putting it in shared invitations',()=>{
  const app=setup('?mode=coop&chapter=2&profile=alice',{base:'https://game.example/releases/player076/multiplayer/'});
  let progress=new URL(app.ui['campaign-progress'].href);
  assert.equal(progress.pathname,'/releases/player076/campaign/');assert.equal(progress.searchParams.get('profile'),'alice');
  app.edit({profile:'bob',relay:'wss://rooms.example/rooms'});
  progress=new URL(app.ui['campaign-progress'].href);
  assert.equal(progress.searchParams.get('profile'),'bob');assert.equal(progress.searchParams.get('relay'),'wss://rooms.example/rooms');
  assert.equal(new URL(app.ui['invite-url'].value).searchParams.has('profile'),false);
  app.edit({profile:'../bad'});assert.equal(app.ui['campaign-progress'].href,undefined);
  app.edit({profile:''});assert.equal(new URL(app.ui['campaign-progress'].href).searchParams.has('profile'),false);
});
test('progress remains available when a new chapter still needs a new world name',()=>{
  const app=setup('?mode=coop&chapter=3&world=chapter-two&worldChapter=2&region=-1_2&role=guest&room=Our-room&profile=bob');
  assert.equal(app.ui.play.href,undefined);
  const progress=new URL(app.ui['campaign-progress'].href);
  assert.equal(progress.searchParams.get('profile'),'bob');assert.equal(progress.searchParams.get('worldChapter'),'2');
  assert.equal(progress.searchParams.get('world'),'chapter-two');assert.equal(progress.searchParams.get('region'),'-1_2');
  assert.equal(progress.searchParams.get('role'),'guest');assert.equal(progress.searchParams.get('room'),'Our-room');
});
test('actual recipient UI retains mode/room/relay and uses its own local guest profile',()=>{
  const invitation=invitationURL(base,coop),{ui}=setup(invitation.search);
  assert.equal(ui.profile.value,'multiplayer-guest');assert.equal(ui.role.value,'guest');
  assert.equal(ui.chapter.value,'2');assert.equal(ui.room.value,'Frontier 2');
  assert.match(ui.instructions.textContent,/select “Frontier 2”/);
  assert.equal(new URL(ui.play.href).searchParams.get('profile'),'multiplayer-guest');
  assert.equal(new URL(ui.play.href).searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'),'2');
});
test('setup preserves shared world invitations, and competitive mode drops world rules',()=>{
  const invite=invitationURL(base,{...coop,world:'shared-land',region:'1_0'});
  const app=setup(invite.search);
  assert.equal(app.ui.mode.value,'world');
  assert.equal(app.ui.world.value,'shared-land');
  assert.equal(new URL(app.ui.play.href).searchParams.get('RECOMP_RULE_COOP_REGION'),'1_0');
  app.edit({mode:'competitive'});
  assert.equal(app.ui['world-field'].hidden,true);
  assert.equal(new URL(app.ui.play.href).searchParams.has('RECOMP_RULE_COOP_WORLD'),false);
  assert.equal(new URL(app.ui['invite-url'].value).searchParams.has('world'),false);
  app.edit({mode:'coop'});
  assert.equal(new URL(app.ui.play.href).searchParams.has('RECOMP_RULE_COOP_WORLD'),false);
  app.edit({mode:'world'});
  assert.equal(new URL(app.ui.play.href).searchParams.get('RECOMP_RULE_COOP_WORLD'),'shared-land');
  app.edit({world:'../invalid'});assert.equal(app.ui.play.href,undefined);
});
test('explicit world mode launches editable coordinates and recipient reproduces them with its own profile',()=>{
  const app=setup();app.edit({mode:'world',world:'our-frontier','region-x':'-2','region-y':'3'});
  assert.equal(app.ui['world-field'].hidden,false);assert.equal(app.ui.world.required,true);
  const host=new URL(app.ui.play.href);
  assert.deepEqual(cooperativeWorldSettings(host.search),{chapter:1,region:{x:-2,y:3}});
  const invite=new URL(app.ui['invite-url'].value),guest=setup(invite.search);
  assert.equal(invite.searchParams.has('profile'),false);assert.equal(guest.ui.mode.value,'world');
  assert.equal(guest.ui['region-x'].value,'-2');assert.equal(guest.ui['region-y'].value,'3');
  const joined=new URL(guest.ui.play.href);
  assert.equal(joined.searchParams.get('profile'),'multiplayer-guest');
  assert.deepEqual([...host.searchParams].filter(([k])=>k.startsWith('RECOMP_RULE_')),
    [...joined.searchParams].filter(([k])=>k.startsWith('RECOMP_RULE_')));
  app.edit({mode:'coop'});assert.equal(app.ui['region-x'].disabled,true);
  assert.equal(new URL(app.ui.play.href).searchParams.has('RECOMP_RULE_COOP_WORLD'),false);
});
test('world mode refuses an empty name and invalid coordinates before enabling either launch or invitation',()=>{
  const app=setup();app.edit({mode:'world'});assert.equal(app.ui.play.href,undefined);
  assert.equal(app.ui.copy.disabled,true);
  for(const coordinate of ['', '-0', '01', '1.5','1000001','-1000001','1e3']){
    app.edit({world:'valid-world','region-x':coordinate,'region-y':'0'});
    assert.equal(app.ui.play.href,undefined,coordinate);assert.equal(app.ui.copy.disabled,true);
  }
  app.edit({'region-x':'1000000','region-y':'-1000000'});
  assert.equal(new URL(app.ui.play.href).searchParams.get('RECOMP_RULE_COOP_REGION'),'1000000_-1000000');
});
test('chapter navigation retains the previous world but requires a new name before a fresh chapter',()=>{
  const invite=invitationURL(base,{...coop,world:'old-world',region:'1_-2'});
  invite.searchParams.set('worldChapter','1');
  const app=setup(invite.search);
  assert.equal(app.ui.world.value,'old-world');assert.equal(app.ui['region-x'].value,'1');
  assert.equal(app.ui.play.href,undefined);assert.match(app.ui.status.textContent,/preserve the earlier chapter/);
  app.edit({world:'next-world'});assert.equal(new URL(app.ui.play.href).searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'),'2');
  assert.equal(new URL(app.ui['invite-url'].value).searchParams.has('worldChapter'),false);
  const guest=setup(new URL(app.ui['invite-url'].value).search);
  assert.equal(guest.ui.play.attributes['aria-disabled'],'false');
});
test('mode changes rebuild game/invitation links and invalid settings disable both actions',()=>{
  const app=setup();app.edit({mode:'competitive'});
  assert.equal(app.ui['chapter-field'].hidden,true);
  assert.equal(new URL(app.ui.play.href).searchParams.has('RECOMP_RULE_FRONTIER_CHAPTER'),false);
  app.edit({relay:'https://relay.example'});
  assert.equal(app.ui.play.href,undefined);assert.equal(app.ui.copy.disabled,true);assert.equal(app.ui['invite-url'].value,'');
  app.edit({relay:'wss://relay.example/rooms'});assert.equal(app.ui.copy.disabled,false);
  app.edit({profile:'../other'});assert.equal(app.ui.play.href,undefined);assert.equal(app.ui.copy.disabled,true);
});
test('malformed invitation does not launch and clipboard denial leaves a manual-copy field',async()=>{
  const bad=setup('?mode=solo&relay=wss%3A%2F%2Frelay.example%2Frooms');
  assert.equal(bad.ui.play.href,undefined);assert.equal(bad.ui.copy.disabled,true);
  const app=setup('',{clipboard:{async writeText(){throw Error('denied');}}});
  const expected=app.ui['invite-url'].value;await app.ui.copy.click();
  assert.equal(app.ui['invite-url'].value,expected);assert.match(app.ui.status.textContent,/Select and copy/);
});
function gate(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
test('copying never queues duplicates and reports when settings changed during permission handling',async()=>{
  const pending=gate(),copied=[];
  const app=setup('',{clipboard:{async writeText(url){copied.push(url);await pending.promise;}}});
  const first=app.ui.copy.click();await app.ui.copy.click();assert.equal(copied.length,1);
  app.edit({room:'Updated room'});assert.equal(app.ui.copy.disabled,true);
  pending.resolve();await first;assert.match(app.ui.status.textContent,/Previous invitation copied/);
  assert.equal(app.ui.copy.disabled,false);assert.equal(new URL(app.ui['invite-url'].value).searchParams.get('room'),'Updated room');
});
function session(search,options={}){
  const elements=[],events=new Map(),copied=[];
  const createElement=tag=>{const element=node(tag);elements.push(element);return element;};
  const body=createElement('body');
  runInNewContext(sessionSource.replace(/^import .*;\n/gm,''),{
    settings,invitationURL,modeLabel,localSite,cooperativeWorldSettings,URL,URLSearchParams,
    location:{search,href:`https://game.example/majesty/${search}`},
    navigator:{clipboard:options.clipboard??{async writeText(url){copied.push(url);}}},
    document:{body,createElement,addEventListener(name,fn){events.set(name,fn);}}
  });
  return {elements,copied,events,get input(){return elements.find(e=>e.tag==='input');},
    get button(){return elements.find(e=>e.tag==='button');},get status(){return elements.find(e=>e.tag==='output');},
    message(detail){events.get('recomp-runtime-message')?.({detail});}};
}
test('actual game invitation follows the room really created, keeping the co-op chapter and no profile',async()=>{
  const app=session('?RECOMP_RULE_FRONTIER_CHAPTER=2&RECOMP_RULE_INVENTORY_COMPAT=1&profile=private&relay=wss%3A%2F%2Frelay.example%2Frooms');
  assert.equal(app.input.hidden,true);assert.equal(app.button.disabled,true);
  app.message('[network] Created room Actual frontier (0 players)');
  assert.equal(app.input.hidden,false);assert.equal(app.button.disabled,false);
  const invite=new URL(app.input.value);
  assert.equal(invite.searchParams.get('room'),'Actual frontier');assert.equal(invite.searchParams.get('chapter'),'2');
  assert.equal(invite.searchParams.has('profile'),false);
  await app.button.click();assert.deepEqual(app.copied,[invite.href]);
  app.events.get('recomp-match-state')({detail:{state:'playing'}});
  assert.equal(app.elements.find(e=>e.tag==='details').open,false);
});
test('world overlay shares the exact initial world contract and rejects partial or extra rules',()=>{
  const url=gameURL(base,{...coop,world:'shared-land',region:'1_0'},'private-host');
  const app=session(url.search),invite=new URL(app.input.value);
  assert.equal(invite.searchParams.get('world'),'shared-land');
  assert.equal(invite.searchParams.get('region'),'1_0');
  assert.equal(invite.searchParams.has('profile'),false);
  app.message('[network] Created room Actual frontier (0 players)');
  assert.equal(new URL(app.input.value).searchParams.get('world'),'shared-land');
  for(const change of ['partial','duplicate','unknown']) {
    const invalid=new URL(url);
    if(change==='partial')invalid.searchParams.delete('RECOMP_RULE_COOP_CHECKPOINT');
    if(change==='duplicate')invalid.searchParams.append('RECOMP_RULE_COOP_WORLD','other');
    if(change==='unknown')invalid.searchParams.set('RECOMP_RULE_CUSTOM','1');
    const refused=session(invalid.search);assert.equal(refused.input.value,'');assert.equal(refused.button.disabled,true);
  }
});
test('resume setup and live room invitation preserve the same checkpoint hint without the host profile',()=>{
  const token=['v2','2','shared-land','1','0','0','0','40','2000','1','3','d'.repeat(64),
    'a'.repeat(64)+':'+ 'b'.repeat(64),'c'.repeat(64)].join('|');
  const selected={...coop,world:'shared-land',region:'1_0',resume:token};
  const url=gameURL(base,selected,'private-host'),app=session(url.search);
  assert.equal(url.searchParams.get('RECOMP_RULE_COOP_REGION'),'0_0');
  assert.equal(new URL(app.input.value).searchParams.get('region'),'1_0');
  assert.equal(new URL(app.input.value).searchParams.get('resume'),token);
  app.message('[network] Created room Actual restore (2 players)');
  const invite=new URL(app.input.value);
  assert.equal(invite.searchParams.get('resume'),token);
  assert.equal(invite.searchParams.has('profile'),false);
  const launch=setup(invite.search);
  assert.equal(new URL(launch.ui.play.href).searchParams.get('RECOMP_COOP_RESUME'),token);
  assert.match(launch.ui.instructions.textContent,/file transfer/);
  launch.edit({role:'host'});assert.match(launch.ui.instructions.textContent,/WorldResume_shared-land_1_0/);
  const duplicate=new URL(url);duplicate.searchParams.append('RECOMP_COOP_RESUME',token);
  assert.equal(session(duplicate.search).button.disabled,true);
});
test('actual competitive room overlay stays competitive and changes its invite to the joined room',()=>{
  const app=session('?mode=competitive&room=Expected&role=guest&relay=wss%3A%2F%2Frelay.example%2Frooms');
  app.message('[network] Joined room Actual match (1 players)');
  const invite=new URL(app.input.value);assert.equal(invite.searchParams.get('mode'),'competitive');
  assert.equal(invite.searchParams.get('room'),'Actual match');assert.equal(invite.searchParams.has('chapter'),false);
  app.message('[network] Session connection lost');assert.equal(app.input.value,'');assert.equal(app.button.disabled,true);
  app.message('[network] Created room Stale event (0 players)');assert.equal(app.input.value,'');
});
test('overlay refuses inconsistent/duplicate settings and does not run during ordinary solo play',()=>{
  assert.equal(session('').elements.length,1);
  for(const search of ['?room=a&room=b','?mode=competitive&RECOMP_RULE_FRONTIER_CHAPTER=1','?mode=solo&room=Test']){
    const app=session(search);assert.equal(app.input.value,'');assert.equal(app.button.disabled,true);
  }
  const app=session('?mode=competitive&room=Test');
  app.events.get('recomp-runtime-state')({detail:{state:'failed'}});
  assert.equal(app.input.value,'');assert.match(app.status.textContent,/Game stopped/);
});
test('custom gameplay rules cannot silently turn into an incompatible standard invitation',()=>{
  for(const search of ['?mode=competitive&room=Test&RECOMP_RULE_INVENTORY_COMPAT=1',
    '?RECOMP_RULE_FRONTIER_CHAPTER=1&room=Test',
    '?RECOMP_RULE_FRONTIER_CHAPTER=1&RECOMP_RULE_INVENTORY_COMPAT=1&RECOMP_RULE_INVENTORY_COMPAT=1&room=Test',
    '?RECOMP_RULE_FRONTIER_CHAPTER=1&RECOMP_RULE_INVENTORY_COMPAT=1&RECOMP_RULE_CUSTOM=2&room=Test']){
    const app=session(search);assert.equal(app.input.value,'');assert.equal(app.button.disabled,true);
  }
});
test('room changes and session loss during clipboard handling never restore a stale invitation',async()=>{
  const pending=gate();
  const app=session('?mode=competitive&room=Expected',{clipboard:{async writeText(){await pending.promise;}}});
  const copying=app.button.click();
  app.message(`[network] Joined room ${'x'.repeat(25)} (1 players)`);
  assert.equal(app.input.value,'');assert.equal(app.button.disabled,true);
  pending.resolve();await copying;assert.equal(app.input.value,'');assert.equal(app.button.disabled,true);
  app.message('[network] Joined room Valid room (1 players)');assert.equal(app.button.disabled,false);
  const lost=gate();
  const second=session('?mode=competitive&room=Expected',{clipboard:{async writeText(){await lost.promise;}}});
  const oldCopy=second.button.click();second.message('[network] Session connection lost');
  lost.resolve();await oldCopy;assert.equal(second.input.value,'');assert.equal(second.button.disabled,true);
  assert.match(second.status.textContent,/Session ended/);
});
