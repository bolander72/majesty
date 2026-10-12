import test from 'node:test';
import assert from 'node:assert/strict';
import {gameURL,invitationURL} from '../web/multiplayer/invitation.mjs';
import {engineWorldContext,campaignWorldContext,worldNavigationURL,resumedWorldContext} from '../web/multiplayer/navigation.mjs';

const base='https://game.example/releases/world071/majesty/';
const selected={mode:'coop',chapter:1,world:'our-frontier',region:'0_0',role:'host',room:'Our room',relay:'wss://relay.example/rooms'};
test('personal world navigation retains chapter/region/profile/role under versioned deployment paths',()=>{
  const engine=gameURL(base,selected,'alice');engine.searchParams.set('RECOMP_TRACE_POINTER','1');
  const context=engineWorldContext(engine.search,base);
  const moved=resumedWorldContext(context,'[coop-load] Resumed epoch=1 serial=2 region=-1_2',base);
  const campaign=worldNavigationURL(base,moved,'alice','campaign');
  assert.equal(campaign.pathname,'/releases/world071/campaign/');
  assert.equal(campaign.searchParams.get('profile'),'alice');assert.equal(campaign.searchParams.get('role'),'host');
  assert.equal(campaign.searchParams.get('region'),'-1_2');assert.equal(campaign.searchParams.has('RECOMP_TRACE_POINTER'),false);
  const restored=campaignWorldContext(campaign.search,campaign.href);
  const setup=worldNavigationURL(campaign.href,restored,'alice');
  assert.equal(setup.pathname,'/releases/world071/multiplayer/');
  assert.equal(setup.searchParams.get('chapter'),'1');assert.equal(setup.searchParams.get('world'),'our-frontier');
  const next=worldNavigationURL(campaign.href,restored,'alice','multiplayer',2);
  assert.equal(next.searchParams.get('chapter'),'2');assert.equal(next.searchParams.get('worldChapter'),'1');
  const invite=invitationURL(base,selected);
  assert.equal(invite.searchParams.has('profile'),false);assert.equal(invite.searchParams.get('role'),'guest');
});
test('actual joined room and resumed region update personal navigation without mutating initial settings',()=>{
  const joined=resumedWorldContext(selected,'[network] Joined room Real room (1 players)',base);
  assert.equal(joined.room,'Real room');assert.equal(joined.role,'guest');
  assert.equal(selected.role,'host');assert.equal(selected.room,'Our room');
  assert.throws(()=>resumedWorldContext(joined,'[coop-load] Resumed epoch=1 serial=3 region=01_0',base));
  assert.equal(joined.region,'0_0');assert.equal(resumedWorldContext(joined,'unrelated message',base),joined);
});
test('navigation refuses incomplete, ambiguous or additional gameplay settings rather than omitting them',()=>{
  assert.equal(engineWorldContext('',base),null);assert.equal(campaignWorldContext('',base),null);
  const engine=gameURL(base,selected,'alice');
  for(const change of [u=>u.searchParams.delete('RECOMP_RULE_COOP_CHECKPOINT'),
    u=>u.searchParams.append('role','guest'),u=>u.searchParams.set('RECOMP_RULE_EXTRA','1')]){
    const bad=new URL(engine);change(bad);assert.throws(()=>engineWorldContext(bad.search,base));
  }
  const campaign=worldNavigationURL(base,selected,'alice','campaign');
  campaign.searchParams.append('worldChapter','2');assert.throws(()=>campaignWorldContext(campaign.search,base));
  assert.throws(()=>worldNavigationURL(base,selected,'../profile'));
  assert.throws(()=>worldNavigationURL(base,selected,'alice','other'));
});
