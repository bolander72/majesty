import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {parseCheckpoint, resumeToken, parseResumeToken, resumeLabel, prepareResume} from '../web/multiplayer/resume-checkpoint.mjs';
import {settings, invitationURL, gameURL, selectedInvitation} from '../web/multiplayer/invitation.mjs';
import {CooperativeWorldControls, cooperativeWorldSettings} from '../web/multiplayer/cooperative-world.mjs';
import {multiplayerProfileConfig} from '../web/multiplayer/profile-session.mjs';
import {engineWorldContext, resumedWorldContext, worldNavigationURL} from '../web/multiplayer/navigation.mjs';
import {selectedProfile} from '../web/campaign/progress.mjs';

const sha = async blob => createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
const content = 'a'.repeat(64) + ':' + 'b'.repeat(64), rules = 'c'.repeat(64);
const context = {world: 'forest', region: '2_-1', chapter: 3};

test('construction chapter resume retains its own chapter and personal profile', async () => {
  const record=parseCheckpoint(await marker(new Blob(['native'])));
  const token=resumeToken(record,4);
  const selected=settings({...context,chapter:4,resume:token,room:'Wardens',role:'host'},'http://localhost:8000/multiplayer/');
  const play=gameURL('http://localhost:8000/multiplayer/',selected,'alice');
  assert.equal(parseResumeToken(token).chapter,4);
  assert.equal(play.searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'),'4');
  assert.equal(play.searchParams.get('profile'),'alice');
  assert.equal(cooperativeWorldSettings(play.search).chapter,4);
  assert.throws(()=>settings({...selected,chapter:3},play.href),/different.*chapter/);
});
async function marker(blob, changes = {}) {
  return ['majesty-coop-checkpoint-v1', '0', 'forest', content, rules, '2', '-1', '40', '2000',
    '18446744073709551615', String(blob.size), await sha(blob), ''].map((v, i) => changes[i] ?? v).join('\n');
}
const missing = () => Object.assign(Error('Missing'), {name: 'NotFoundError'});
class FileHandle {
  kind = 'file';
  constructor(blob = new Blob()) { this.blob = blob; }
  async getFile() { return this.blob; }
  async createWritable() {
    let parts = [];
    return {write: async value => { assert.ok(value.byteLength <= 65536); parts.push(value); },
      close: async () => { this.blob = new Blob(parts); }, abort: async () => { parts = []; }};
  }
}
class Directory {
  kind = 'directory'; children = new Map();
  async *entries() { yield* this.children; }
  async getDirectoryHandle(name, {create = false} = {}) {
    if (!this.children.has(name) && create) this.children.set(name, new Directory());
    const h = this.children.get(name); if (!h || h.kind !== 'directory') throw missing(); return h;
  }
  async getFileHandle(name, {create = false} = {}) {
    if (!this.children.has(name) && create) this.children.set(name, new FileHandle());
    const h = this.children.get(name); if (!h || h.kind !== 'file') throw missing(); return h;
  }
  async removeEntry(name) { this.children.delete(name); }
}
async function fixture() {
  const root = new Directory(); let dir = root;
  for (const name of ['majesty', 'profile', 'alice', 'Documents', 'My Games', 'SaveGame']) dir = await dir.getDirectoryHandle(name, {create: true});
  const blob = new Blob([new Uint8Array(150000).fill(47)]), text = await marker(blob);
  const m = new FileHandle(new Blob([text])), source = new FileHandle(blob);
  dir.children.set('CoopTransitions_forest_2_-1.checkpoint', m);
  dir.children.set('CoopTransitions_forest_2_-1_0.GMP', source);
  let acquired = 0;
  const locks = {request: async (name, opts, fn) => {
    assert.equal(name, 'majesty-native-profile:majesty:alice');
    assert.deepEqual(opts, {mode: 'exclusive', ifAvailable: true}); acquired++; return fn({});
  }};
  return {root, dir, blob, text, source, m, options: {root, locks, hash: sha, profile: 'alice', context}, acquired: () => acquired};
}
test('native marker and shared token preserve uint64 revision and exact identity', async () => {
  const r = parseCheckpoint(await marker(new Blob(['native']))), token = resumeToken(r, 3);
  assert.equal(parseResumeToken(token).revision, '18446744073709551615');
  assert.equal(resumeLabel(r), `WorldResume_forest_2_-1_${r.sha256.slice(0, 16)}`);
  const selected = settings({...context, room: 'Restore', role: 'host', resume: token}, 'http://localhost:8000/multiplayer/');
  const invite = invitationURL('http://localhost:8000/multiplayer/', selected);
  assert.equal(invite.searchParams.get('resume'), token);
  assert.equal(invite.searchParams.has('profile'), false);
  assert.equal(selectedInvitation(invite.search).resume, token);
  const play = gameURL(invite, selected, 'alice');
  assert.equal(play.searchParams.get('RECOMP_COOP_RESUME'), token);
  assert.equal([...play.searchParams.keys()].filter(k => k.startsWith('RECOMP_RULE_')).includes('RECOMP_RULE_COOP_RESUME'), false);
  assert.equal(multiplayerProfileConfig(play.search).profile, 'alice');
  const unnamed = new URL(play); unnamed.searchParams.delete('profile');
  assert.throws(()=>multiplayerProfileConfig(unnamed.search), /named local profile/);
  const duplicate = new URL(play); duplicate.searchParams.append('RECOMP_COOP_RESUME', token);
  assert.throws(()=>multiplayerProfileConfig(duplicate.search), /only one/);
  const wrong = new URL(play); wrong.searchParams.set('RECOMP_RULE_COOP_REGION', '0_0');
  assert.throws(()=>multiplayerProfileConfig(wrong.search), /complete shared-world settings/);
  const navigation = engineWorldContext(play.search, play);
  assert.equal(worldNavigationURL(play, navigation, 'alice').searchParams.get('resume'), token);
  assert.equal(resumedWorldContext(navigation,'[coop-load] Resumed epoch=1 serial=1 region=3_-1',play).resume, undefined);
  for (const change of [{world: 'other'}, {region: '0_0'}, {chapter: 1}, {mode: 'competitive', chapter: null, world: '', region: ''}])
    assert.throws(() => settings({...selected, ...change}, invite), /resume|world/i);
});
test('malformed markers, numeric overflow and ambiguous tokens are refused', async () => {
  const blob = new Blob(['native']);
  for (const change of [{1: '2'}, {2: '../forest'}, {5: '-0'}, {6: '1000001'}, {7: '4294967296'},
    {8: '02000'}, {9: '0'}, {9: '18446744073709551616'}, {10: '0'}, {10: '67108865'}, {11: 'F'.repeat(64)}])
    assert.throws(() => parseCheckpoint(awaitedMarker(change)), /Invalid/);
  function awaitedMarker(change) {
    const fields = ['majesty-coop-checkpoint-v1','0','forest',content,rules,'2','-1','40','2000','1','6','d'.repeat(64),''];
    return fields.map((v,i)=>change[i]??v).join('\n');
  }
  const text = await marker(blob), token = resumeToken(parseCheckpoint(text), 3);
  for (const value of [text.slice(0,-1), text+'\n', text.replace('forest','forest\0')]) assert.throws(()=>parseCheckpoint(value));
  for (const value of [token+'|extra', token.replace('v2|3','v2|5'), token.replace('v2|','v1|'), token+'\n', 'x'.repeat(513)]) assert.throws(()=>parseResumeToken(value));
});
test('resuming a traveled region preserves every original rule used by the network fingerprint', async () => {
  const record = parseCheckpoint(await marker(new Blob(['native']), {5:'3'}));
  const base = 'http://localhost:8000/multiplayer/';
  const fresh = gameURL(base, settings({...context, room:'Restore', role:'host'}, base), 'alice');
  const token = resumeToken(record, 3, '2_-1');
  const selected = settings({...context, region:'3_-1', room:'Restore', role:'host', resume:token}, base);
  const play = gameURL(base, selected, 'alice');
  const ruleEntries = url => [...url.searchParams].filter(([key])=>key.startsWith('RECOMP_RULE_')).sort();
  assert.deepEqual(ruleEntries(play), ruleEntries(fresh));
  assert.deepEqual(cooperativeWorldSettings(play.search), {region:{x:3,y:-1}, initialRegion:{x:2,y:-1}, chapter:3});
  assert.equal(multiplayerProfileConfig(play.search).profile, 'alice');
  const nav = engineWorldContext(play.search, play);
  assert.equal(nav.region, '3_-1');
  const invite = worldNavigationURL(play, nav, 'alice');
  assert.equal(invite.searchParams.get('region'), '3_-1');
  assert.equal(selectedInvitation(invite.search).resume, token);
  for (const invalid of ['02_-1', '-0_0', '1000001_0']) assert.throws(()=>resumeToken(record,3,invalid));
});
test('resume copy runs under the profile lease, streams bounded chunks and preserves both checkpoint files', async () => {
  const f = await fixture(), result = await prepareResume(f.options);
  assert.equal(f.acquired(), 1); assert.equal(await f.m.blob.text(), f.text);
  assert.equal(await sha(f.source.blob), await sha(f.blob));
  assert.equal(await sha(f.dir.children.get(result.label+'.GMP').blob), result.record.sha256);
  assert.deepEqual(await prepareResume(f.options), result, 'matching immutable copy is reused');
  assert.equal(f.dir.children.size, 3);
});
test('running engine lease, corrupt source and incomplete alias cannot replace saved kingdoms', async () => {
  const f = await fixture();
  await assert.rejects(prepareResume({...f.options, locks: {request: (_n,_o,fn)=>fn(null)}}), /Close/);
  const r = parseCheckpoint(f.text), label = resumeLabel(r)+'.GMP';
  f.dir.children.set(label, new FileHandle(new Blob(['partial'])));
  await assert.rejects(prepareResume(f.options), /preserved/);
  assert.equal(await f.dir.children.get(label).blob.text(), 'partial');
  f.dir.children.delete(label); f.source.blob = new Blob(['corrupt']);
  await assert.rejects(prepareResume(f.options), /do not match/); assert.equal(f.dir.children.size, 2);
});
test('resume preparation refuses the shared default root and any interrupted complete-player restore',async()=>{
  const f=await fixture();
  await assert.rejects(prepareResume({...f.options,profile:''}), /named local profile/);
  const game=await f.root.getDirectoryHandle('majesty');
  game.children.set('.player-restore-v1.json',new FileHandle(new Blob(['interrupted'])));
  await assert.rejects(prepareResume(f.options), /interrupted player backup restore/);
  assert.equal(f.dir.children.size,2);
});
test('no marker, conflicting world and duplicate checkpoint folders are refused before copy', async () => {
  const f = await fixture();
  await assert.rejects(prepareResume({...f.options, context:{...context,world:'other'}}), /No committed/);
  await assert.rejects(prepareResume({...f.options, context:{...context,region:'02_-1'}}), /Invalid/);
  const extra = await f.dir.getDirectoryHandle('other', {create:true});
  extra.children.set('CoopTransitions_forest_2_-1.checkpoint', new FileHandle(new Blob([f.text])));
  await assert.rejects(prepareResume(f.options), /More than one/);
  assert.equal(f.dir.children.size, 3);
});
test('alias count is bounded and failures clean up only the new copy', async () => {
  const f = await fixture();
  for (let i=0;i<64;i++) f.dir.children.set(`WorldResume_old_${i}.GMP`, new FileHandle());
  await assert.rejects(prepareResume(f.options), /64-copy/);
  f.dir.children.delete('WorldResume_old_0.GMP');
  let calls=0;
  await assert.rejects(prepareResume({...f.options, hash: async b => ++calls===2 ? 'f'.repeat(64) : sha(b)}), /verification failed/);
  assert.equal(f.dir.children.size, 65); assert.equal(await f.m.blob.text(), f.text);
});
test('a ninth region resume preserves all older copies and unchanged checkpoint bytes',async()=>{
  const f=await fixture(),older=[];
  for(let i=0;i<8;i++){
    const handle=new FileHandle(new Blob([`older-${i}`]));older.push(handle);
    f.dir.children.set(`WorldResume_old_${i}.GMP`,handle);
  }
  const result=await prepareResume(f.options);
  assert.equal(f.dir.children.size,11);
  for(let i=0;i<8;i++)assert.equal(await older[i].blob.text(),`older-${i}`);
  assert.equal(await sha(f.source.blob),result.record.sha256);assert.equal(await f.m.blob.text(),f.text);
});
test('the byte budget refuses large old copies before writing, without reading their contents',async()=>{
  const f=await fixture();let reads=0;
  const large={kind:'file',async getFile(){reads++;return {size:64*1024*1024,async arrayBuffer(){throw Error('must not read contents');}};}};
  f.dir.children.set('WorldResume_old.GMP',large);
  await assert.rejects(prepareResume(f.options),/64 MiB/);
  assert.equal(reads,1);assert.equal(f.dir.children.size,3);assert.equal(f.dir.children.get('WorldResume_old.GMP'),large);
});
test('a verified existing alias can be reused when the budget is full',async()=>{
  const f=await fixture(),saved=await prepareResume(f.options);
  for(let i=0;i<63;i++)f.dir.children.set(`WorldResume_old_${i}.GMP`,new FileHandle());
  assert.deepEqual(await prepareResume(f.options),saved);assert.equal(f.dir.children.size,66);
});
test('checkpoint replacement during copying cannot produce a resume invitation', async () => {
  const f=await fixture();let reads=0;
  await assert.rejects(prepareResume({...f.options,hash:async b=>{
    const digest=await sha(b);
    if(++reads===2)f.m.blob=new Blob([f.text.replace('\n2000\n','\n2050\n')]);
    return digest;
  }}),/checkpoint changed/);
  assert.equal(await sha(f.source.blob), await sha(f.blob));
});
test('canceled prepare does not create or overwrite any checkpoint file', async () => {
  const f=await fixture(),controller=new AbortController();controller.abort();
  await assert.rejects(prepareResume({...f.options,signal:controller.signal}), /abort/i);
  assert.equal(f.dir.children.size,2);assert.equal(await f.m.blob.text(),f.text);
});
test('save-and-pause requires the actual host and confirmed native pause before exposing a saved checkpoint', () => {
  const c = new CooperativeWorldControls({region:{x:2,y:-1},chapter:3});
  assert.equal(c.requestSave(100), false);
  c.receive('[network] Joined room restore (2 players)'); c.receive('[campaign] Chapter 3 restored with 2 network kingdoms');
  assert.equal(c.requestSave(100), false);
  c.receive('[network] Created room restore (2 players)'); assert.equal(c.requestSave(100), true);
  assert.equal(c.consume('coop-transition-pause',101), true);
  const receipt = `[coop-transition] Checkpoint epoch=1 revision=1 frame=40 clock=2000 bytes=100 digest=${'a'.repeat(64)}`;
  c.receive(receipt); assert.equal(c.saved,null);
  c.receive('[coop-transition] Paused epoch=2 owner=1 frame=40 clock=2000'); c.receive(receipt); assert.equal(c.saved,null);
  c.receive('[coop-transition] Paused epoch=1 owner=1 frame=40 clock=2000'); c.receive(receipt);
  assert.ok(c.saved); assert.equal(c.canTravel,false); assert.match(c.status,/Both players must rejoin/);
});
test('a save receipt must match the paused frame and clock, and failed native resume cannot enable travel',()=>{
  const c=new CooperativeWorldControls({region:{x:0,y:0},chapter:1});
  c.receive('[network] Created room restore (2 players)');c.receive('[campaign] Chapter 1 started with 2 network kingdoms');
  c.requestSave(100);c.consume('coop-transition-pause',101);
  c.receive('[coop-transition] Paused epoch=1 owner=1 frame=40 clock=2000');
  for(const [frame,clock]of [[41,2000],[40,2050]])
    c.receive(`[coop-transition] Checkpoint epoch=1 revision=1 frame=${frame} clock=${clock} bytes=100 digest=${'a'.repeat(64)}`);
  assert.equal(c.saved,null);
  c.receive('[coop-resume] Refused original-read=1 world-attached=0');
  c.receive('[campaign] Chapter 1 restored with 2 network kingdoms');
  assert.equal(c.canTravel,false);assert.equal(c.requestSave(200),false);
});
test('expired or refused pause never claims a new saved checkpoint', () => {
  for (const refusal of [true,false]) {
    const c=new CooperativeWorldControls({region:{x:0,y:0},chapter:1});
    c.receive('[network] Created room restore (2 players)');c.receive('[campaign] Chapter 1 started with 2 network kingdoms');
    c.requestSave(100);
    if(refusal)c.receive('[coop-transition] Request refused stage=saved-world epoch=1');
    else assert.equal(c.consume('coop-transition-pause',10100),false);
    assert.equal(c.saved,null);assert.equal(c.saving,false);assert.equal(c.canTravel,true);
  }
});
test('waiting for a resume partner leaves play and queued actions disabled until native startup confirms both kingdoms',()=>{
  const controls=new CooperativeWorldControls({region:{x:3,y:-1},initialRegion:{x:2,y:-1},chapter:3});
  controls.receive('[network] Created room Restore (1 players)');
  controls.receive('[coop-resume] Waiting for partner before loading');
  assert.equal(controls.canTravel,false);assert.equal(controls.requestSave(100),false);
  assert.equal(controls.stopped,false);assert.match(controls.status,/partner.*Ready/);
  controls.receive('[network] Created room Restore (2 players)');
  assert.equal(controls.canTravel,false);
  controls.receive('[campaign] Chapter 3 restored with 2 network kingdoms');
  assert.equal(controls.canTravel,true);assert.equal(controls.requestSave(200),true);
});

test('actual engine controls expose Save and pause through the native action poll, then a release link; resume page has no game controls',async()=>{
  const source=(await readFile(new URL('../web/multiplayer/cooperative-world.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
  const query=new URLSearchParams({RECOMP_RULE_COOP_REGION_GENERATION:'v1',RECOMP_RULE_COOP_FRESH_GENERATION:'v1',
    RECOMP_RULE_COOP_TRANSITION_PAUSE:'v1',RECOMP_RULE_COOP_CHECKPOINT:'v1',RECOMP_RULE_COOP_SHARED_READ:'v1',
    RECOMP_RULE_COOP_WORLD:'forest',RECOMP_RULE_COOP_REGION:'2_-1',RECOMP_RULE_FRONTIER_CHAPTER:'3',profile:'alice',mode:'coop',room:'Restore',role:'host'});
  function app(path,search=query){
    const elements=[],events=new Map(),timers=new Map();let timerId=0;
    function element(tag){const item={tag,children:[],style:{},hidden:false,
      appendChild(child){this.children.push(child);return child;},setAttribute(){},
      addEventListener(name,fn){this[name]=fn;}};elements.push(item);return item;}
    const reload={textContent:'Reload game',href:'old-launch'};
    const document={body:element('body'),createElement:element,addEventListener:(name,fn)=>events.set(name,fn),
      getElementById(id){return id==='status'?{querySelectorAll(){return [reload];}}:null;}};
    runInNewContext(source,{document,location:{pathname:path,search:'?'+search,href:'http://localhost:8000'+path+'?'+search},
      URL,URLSearchParams,Date,parseResumeToken,resumeLabel,addEventListener(){},
      setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}});
    return{elements,timers,emit:(line)=>events.get('recomp-runtime-message')?.({detail:line}),events,reload};
  }
  const resumedQuery=new URLSearchParams(query);
  const saved=parseCheckpoint(await marker(new Blob(['native']),{9:'15'}));
  resumedQuery.set('RECOMP_COOP_RESUME',resumeToken(saved,3));
  const reminderPage=app('/releases/private/majesty/',resumedQuery);
  const reminder=reminderPage.elements.find(e=>e.textContent?.startsWith('Checkpoint 15:'));
  assert.ok(reminder);assert.ok(reminder.textContent.includes(resumeLabel(saved)));
  assert.equal(reminder.hidden,false);
  assert.equal(reminderPage.elements.find(e=>e.tag==='summary').textContent,'Resume checkpoint 15');
  assert.equal(reminderPage.elements.find(e=>e.textContent==='Save and pause').disabled,true);
  reminderPage.emit('[network] Created room Restore (2 players)');
  reminderPage.emit('[campaign] Chapter 3 restored with 2 network kingdoms');
  assert.equal(reminder.hidden,true);
  assert.equal(reminderPage.elements.find(e=>e.tag==='summary').textContent,'Co-op region 2, -1');
  const page=app('/releases/private/majesty/'),button=page.elements.find(e=>e.textContent==='Save and pause'),link=page.elements.find(e=>e.tag==='a');
  assert.equal(button.disabled,true);assert.equal(link.hidden,true);
  page.emit('[network] Created room Restore (2 players)');page.emit('[campaign] Chapter 3 restored with 2 network kingdoms');
  page.emit('[coop-load] Resumed epoch=1 serial=1 region=3_-1');
  assert.equal(button.disabled,false);button.click();assert.equal(button.disabled,true);
  const detail={name:'coop-transition-pause'};page.events.get('recomp-action-poll')({detail});assert.equal(detail.pending,true);
  page.emit('[coop-transition] Paused epoch=1 owner=1 frame=40 clock=2000');
  page.emit(`[coop-transition] Checkpoint epoch=1 revision=1 frame=40 clock=2000 bytes=100 digest=${'a'.repeat(64)}`);
  assert.equal(link.hidden,false);
  assert.equal(new URL(link.href).pathname,'/releases/private/multiplayer/resume.html');
  assert.equal(new URL(link.href).searchParams.get('profile'),'alice');
  assert.equal(new URL(link.href).searchParams.get('RECOMP_RULE_COOP_REGION'),'2_-1');
  assert.equal(new URL(link.href).searchParams.get('RECOMP_RESUME_REGION'),'3_-1');
  page.emit('[network] Session connection lost');
  assert.equal(page.reload.textContent,'Recover saved world');
  assert.equal(page.reload.href,link.href);
  const guest=app('/releases/private/majesty/');
  guest.emit('[network] Joined room Actual room (1 players)');
  guest.emit('[campaign] Chapter 3 restored with 2 network kingdoms');
  guest.emit('[coop-transition] Pause requested epoch=1 owner=1');
  guest.emit('[coop-transition] Paused epoch=1 owner=1 frame=2377 clock=2089600');
  guest.emit('[coop-transition] Guest paused epoch=1 owner=1 frame=2377 clock=2089600');
  const guestRelease=guest.elements.find(e=>e.tag==='a');
  assert.equal(guestRelease.hidden,false);
  assert.equal(guestRelease.textContent,'Close game and request resume invitation');
  assert.equal(new URL(guestRelease.href).pathname,'/releases/private/multiplayer/reconnect.html');
  assert.equal(new URL(guestRelease.href).searchParams.get('role'),'guest');
  assert.equal(guest.elements.find(e=>e.textContent==='Save and pause').disabled,true);
  guest.emit('[coop-load] Resumed epoch=1 serial=1 region=3_-1');
  assert.equal(guestRelease.hidden,true);
  guest.emit('[network] Session connection lost');
  assert.equal(guest.reload.textContent,'Request resume invitation');
  assert.equal(new URL(guest.reload.href).pathname,'/releases/private/multiplayer/reconnect.html');
  assert.equal(new URL(guest.reload.href).searchParams.get('role'),'guest');
  assert.equal(app('/releases/private/multiplayer/resume.html').elements.filter(e=>e.tag==='button').length,0);
});

test('the actual resume page prepares the traveled checkpoint with the original launch settings',async()=>{
  const f=await fixture();
  f.m.blob=new Blob([await marker(f.blob,{5:'3'})]);
  f.dir.children.delete('CoopTransitions_forest_2_-1.checkpoint');
  f.dir.children.delete('CoopTransitions_forest_2_-1_0.GMP');
  f.dir.children.set('CoopTransitions_forest_3_-1.checkpoint',f.m);
  f.dir.children.set('CoopTransitions_forest_3_-1_0.GMP',f.source);
  const source=(await readFile(new URL('../web/multiplayer/resume-launcher.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
  const initial=gameURL('http://localhost:8000/releases/private/multiplayer/',settings({...context,room:'Restore',role:'host'},'http://localhost:8000/multiplayer/'),'alice');
  initial.pathname='/releases/private/multiplayer/resume.html';
  initial.searchParams.set('RECOMP_RESUME_REGION','3_-1');
  function page(url){
    const ui=Object.fromEntries(['status','prepare','result','host','invitation','instructions','scope'].map(id=>[id,{addEventListener(name,fn){this[name]=fn;}}]));
    const requests=[];
    runInNewContext(source,{document:{getElementById:id=>ui[id]},location:{search:url.search,href:url.href},URL,URLSearchParams,
      engineWorldContext,selectedProfile,settings,invitationURL,gameURL,prepareResume:args=>{requests.push(args);return prepareResume({...f.options,...args});}});
    return {ui,requests};
  }
  const actual=page(initial);assert.notEqual(actual.ui.prepare.disabled,true);
  await actual.ui.prepare.click();
  assert.equal(actual.requests.length,1);
  assert.equal(actual.requests[0].context.region,'3_-1');assert.equal(actual.requests[0].context.initialRegion,'2_-1');
  assert.equal(actual.ui.result.hidden,false);assert.match(actual.ui.status.textContent,/verified/);
  const host=new URL(actual.ui.host.href),invite=new URL(actual.ui.invitation.value);
  assert.equal(host.pathname,'/releases/private/majesty/');
  assert.equal(host.searchParams.get('RECOMP_RULE_COOP_REGION'),'2_-1');
  assert.equal(invite.searchParams.get('region'),'3_-1');assert.equal(invite.searchParams.has('profile'),false);
  assert.match(actual.ui.instructions.textContent,/Ready.*Start Game/);
  for(const change of [url=>url.searchParams.delete('RECOMP_RESUME_REGION'),url=>url.searchParams.append('RECOMP_RESUME_REGION','4_-1'),url=>url.searchParams.set('RECOMP_RESUME_REGION','03_-1')]){
    const invalid=new URL(initial);change(invalid);const rejected=page(invalid);
    assert.equal(rejected.ui.prepare.disabled,true);assert.equal(rejected.requests.length,0);
  }
});
