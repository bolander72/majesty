import {resumeToken} from '../web/multiplayer/resume-checkpoint.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {hostResumeReminder, cooperativeWorldSettings, CooperativeWorldControls, cooperativeRecoveryURL} from '../web/multiplayer/cooperative-world.mjs';

const query = new URLSearchParams({
  RECOMP_RULE_COOP_REGION_GENERATION: 'v1', RECOMP_RULE_COOP_FRESH_GENERATION: 'v1',
  RECOMP_RULE_COOP_TRANSITION_PAUSE: 'v1', RECOMP_RULE_COOP_CHECKPOINT: 'v1',
  RECOMP_RULE_COOP_SHARED_READ: 'v1', RECOMP_RULE_COOP_WORLD: 'test-world',
  RECOMP_RULE_COOP_REGION: '0_0', RECOMP_RULE_FRONTIER_CHAPTER: '1', role: 'host'
});
function controls() { return new CooperativeWorldControls(cooperativeWorldSettings(query)); }
function start(s, host = true) {
  s.receive(`[network] ${host ? 'Created room 35 (0 players)' : 'Joined room 35 (1 players)'}`);
  s.receive('[campaign] Chapter 1 started with 2 network kingdoms');
}

test('an unpolled save expires into recovery without confirming or replaying a checkpoint', () => {
  const s = controls(); start(s);
  assert.equal(s.requestSave(100), true);
  assert.equal(s.expire(NaN), false);
  assert.equal(s.expire(10099), false);
  assert.equal(s.expire(10100), true);
  assert.equal(s.pending, null); assert.equal(s.saved, null);
  assert.equal(s.canTravel, false); assert.equal(s.recoverable, true);
  assert.match(s.status, /No new checkpoint was confirmed/);
  assert.equal(s.consume('coop-transition-pause', 10101), false);
  s.receive('[coop-transition] Paused epoch=1 owner=1 frame=50 clock=5000');
  s.receive('[coop-transition] Checkpoint epoch=1 revision=13 frame=50 clock=5000 bytes=100 digest=' + 'a'.repeat(64));
  assert.equal(s.saved, null, 'late messages cannot turn a timed-out request into a confirmed save');
});

test('a consumed native pause is not abandoned by the unpolled-request deadline', () => {
  const s = controls(); start(s); s.requestSave(100);
  assert.equal(s.consume('coop-transition-pause', 101), true);
  assert.equal(s.expire(100000), false);
  assert.equal(s.saving, true); assert.equal(s.stopped, false);
  s.receive('[coop-transition] Paused epoch=1 owner=1 frame=50 clock=5000');
  s.receive('[coop-transition] Checkpoint epoch=1 revision=13 frame=50 clock=5000 bytes=100 digest=' + 'a'.repeat(64));
  assert.equal(s.saved.revision, '13'); assert.equal(s.recoverable, false);
});

test('an original result dialog disables actions before final fanout without confirming victory early', () => {
  for (const outcome of ['victory', 'defeat']) {
    const s = controls(); start(s); s.requestSave(100);
    s.receive(`[campaign] Chapter 1 shared result pending ${outcome} for 2 kingdoms`);
    assert.equal(s.ending, true); assert.equal(s.pending, null);
    assert.equal(s.saved, null); assert.equal(s.canTravel, false);
    assert.equal(s.stopped, false, 'the final native result must still be received');
    start(s); s.receive('[coop-load] Resumed epoch=1 serial=1 region=0_0');
    assert.equal(s.canTravel, false, 'stale start/resume metadata cannot restart an ending match');
    assert.equal(s.consume('coop-transition-pause', 101), false);
    s.receive(`[campaign] Chapter 1 shared ${outcome} for 2 kingdoms`);
    assert.equal(s.ending, false); assert.equal(s.stopped, true);
    assert.equal(s.recoverable, outcome === 'defeat');
  }
});

test('guest release observes a settled native pause without claiming a host checkpoint or gaining authority', () => {
  const guest = new CooperativeWorldControls({region: {x: 0, y: 0}, chapter: 3});
  guest.receive('[network] Joined room cold073-live (1 players)');
  guest.receive('[campaign] Chapter 3 restored with 2 network kingdoms');
  guest.receive('[coop-transition] Pause requested epoch=1 owner=1');
  guest.receive('[coop-transition] Paused epoch=1 owner=1 frame=2377 clock=2089600');
  guest.receive('[coop-transition] Checkpoint epoch=1 revision=9 frame=2377 clock=2089600 bytes=555160 digest=e9f8d0d229296e78b4faa25e9200009e0cd130ee2d6da84e5235befbd9703b64');
  assert.equal(guest.saved, null);
  assert.equal(guest.guestPaused, null);
  guest.receive('[coop-transition] Guest paused epoch=1 owner=1 frame=2377 clock=2089600');
  assert.deepEqual(guest.guestPaused, {epoch: '1', frame: '2377', clock: '2089600'});
  assert.equal(guest.saved, null);
  assert.equal(guest.requestSave(100), false);
  assert.equal(guest.canTravel, false);
  const url = cooperativeRecoveryURL('https://game.example/majesty/?profile=guest&RECOMP_COOP_RESUME=old', guest);
  assert.equal(url.pathname, '/multiplayer/reconnect.html');
  assert.equal(url.searchParams.get('role'), 'guest');
  assert.match(guest.status, /host to confirm the saved checkpoint/);
  guest.receive('[coop-transition] Guest resumed epoch=2');
  assert.notEqual(guest.guestPaused, null);
  guest.receive('[coop-transition] Guest resumed epoch=1');
  assert.equal(guest.guestPaused, null);
  assert.equal(guest.canTravel, false);
  guest.receive('[coop-transition] Guest paused epoch=1 owner=1 frame=2377 clock=2089600');
  guest.receive('[coop-load] Attached epoch=1 serial=1 region=1_0');
  assert.equal(guest.guestPaused, null);
  guest.receive('[coop-load] Resumed epoch=1 serial=1 region=1_0');
  assert.deepEqual(guest.region, {x: 1, y: 0});
  assert.equal(guest.canTravel, false);
  const host=controls();start(host);
  host.receive('[coop-transition] Guest paused epoch=1 owner=1 frame=40 clock=2000');
  assert.equal(host.guestPaused,null);assert.equal(host.canTravel,true);
});

test('captured unnamed native lobby enables host saving while the guest stays read-only',()=>{
  const host=new CooperativeWorldControls({region:{x:0,y:0},chapter:3});
  const guest=new CooperativeWorldControls({region:{x:0,y:0},chapter:3});
  // Actual Chapter3 browser lobby output, preserved without ignored run files.
  host.receive('[network] Created room  (0 players)');
  guest.receive('[network] Joined room  (1 players)');
  for(const peer of [host,guest]) peer.receive('[campaign] Chapter 3 started with 2 network kingdoms');
  assert.equal(host.canTravel,true);assert.equal(guest.canTravel,false);
  assert.equal(host.requestSave(100),true);assert.equal(guest.requestSave(100),false);
  assert.equal(host.consume('coop-transition-pause',101),true);
  host.receive('[coop-transition] Paused epoch=1 owner=1 frame=40 clock=2000');
  host.receive(`[coop-transition] Checkpoint epoch=1 revision=1 frame=40 clock=2000 bytes=100 digest=${'a'.repeat(64)}`);
  assert.equal(host.saved.revision,'1');assert.equal(host.canTravel,false);
  assert.equal(guest.saved,null);
});

test('unnamed room parsing still rejects malformed host announcements',()=>{
  for(const line of ['[network] Created room (0 players)','[network] Created room  (5 players)',
    '[network] Created room  (0 players) extra','[network] Created room \n (0 players)']){
    const peer=controls();peer.receive(line);peer.receive('[campaign] Chapter 1 started with 2 network kingdoms');
    assert.equal(peer.canTravel,false);assert.equal(peer.requestSave(100),false);
  }
});

test('disconnect recovery selects the latest committed coordinate and preserves the original rules, not a stale launch token',()=>{
  const host=controls();start(host);host.receive('[coop-load] Resumed epoch=1 serial=1 region=1_0');
  host.receive('[network] Session connection lost');
  assert.equal(host.canTravel,false);assert.equal(host.recoverable,true);
  const base='https://game.example/releases/r/majesty/?'+query+'&profile=local-host&room=old-room&relay=wss%3A%2F%2Fgame.example%2Frooms&RECOMP_COOP_RESUME=outdated';
  const url=cooperativeRecoveryURL(base,host);
  assert.equal(url.pathname,'/releases/r/multiplayer/resume.html');
  assert.equal(url.searchParams.get('RECOMP_RULE_COOP_REGION'),'0_0');
  assert.equal(url.searchParams.get('RECOMP_RESUME_REGION'),'1_0');
  assert.equal(url.searchParams.get('profile'),'local-host');
  assert.equal(url.searchParams.get('room'),'35');
  assert.equal(url.searchParams.has('RECOMP_COOP_RESUME'),false);
  host.receive('[campaign] Chapter 1 restored with 2 network kingdoms');assert.equal(host.canTravel,false);
});

test('guest disconnect recovery never creates a host invitation or starts a replacement world',()=>{
  const guest=controls();start(guest,false);guest.receive('[network] Session receive queue overflow');
  const url=cooperativeRecoveryURL('https://game.example/majesty/?'+query+'&profile=guest',guest);
  assert.equal(url.pathname,'/multiplayer/reconnect.html');
  assert.equal(url.searchParams.get('role'),'guest');
  assert.equal(url.searchParams.get('profile'),'guest');assert.equal(guest.saved,null);
  const ended=controls();start(ended);ended.receive('[campaign] Chapter 1 shared victory for 2 kingdoms');
  ended.receive('[network] Session connection lost');assert.equal(ended.recoverable,false);
});

test('travel requires one complete, canonical region contract', () => {
  assert.deepEqual(cooperativeWorldSettings(query), {region: {x: 0, y: 0}, chapter: 1});
  assert.equal(cooperativeWorldSettings(''), null);
  for (const key of [...query.keys()].filter(key => key !== 'role')) {
    const missing = new URLSearchParams(query); missing.delete(key);
    assert.equal(cooperativeWorldSettings(missing), null, key);
    const duplicate = new URLSearchParams(query); duplicate.append(key, query.get(key));
    assert.equal(cooperativeWorldSettings(duplicate), null, key);
  }
  for (const [key, values] of [
    ['RECOMP_RULE_COOP_REGION', ['01_0', '-0_0', '1000001_0', '0.1_0', '0_0\n']],
    ['RECOMP_RULE_COOP_WORLD', ['', 'Mixed', '../world', 'x'.repeat(41)]],
    ['RECOMP_RULE_FRONTIER_CHAPTER', ['0', '5', '01']]
  ]) for (const value of values) {
    const invalid = new URLSearchParams(query); invalid.set(key, value);
    assert.equal(cooperativeWorldSettings(invalid), null, `${key}=${value}`);
  }
});

test('URL role alone cannot authorize travel; native room host and shared start can', () => {
  const host = controls();
  assert.equal(host.request('east', 100), false);
  host.receive('[campaign] Chapter 1 started with 1 network kingdoms');
  assert.equal(host.canTravel, false);
  start(host); assert.equal(host.canTravel, true);
  const guest = controls(); start(guest, false);
  assert.equal(guest.canTravel, false);
  assert.equal(guest.request('east', 100), false);
});

test('travel is consumed once only by its matching poll and expires without replay', () => {
  const s = controls(); start(s);
  assert.equal(s.request('east', 100), true);
  assert.equal(s.request('west', 101), false);
  assert.equal(s.consume('coop-travel-west', 102), false);
  assert.equal(s.consume('coop-travel-east', NaN), false);
  assert.equal(s.consume('coop-travel-east', 103), true);
  assert.equal(s.consume('coop-travel-east', 104), false);
  s.receive('[coop-transition] Request refused: unsettled');
  assert.equal(s.request('north', 1000), true);
  assert.equal(s.consume('coop-travel-north', 11000), false);
  assert.equal(s.canTravel, true);
  assert.equal(s.consume('coop-travel-north', 11001), false);
});

test('attachment and loading remain paused until shared resume updates the region', () => {
  const s = controls(); start(s); s.request('east', 100); s.consume('coop-travel-east', 101);
  for (const line of ['[coop-transition] Pause requested epoch=1', '[coop-load] Ready epoch=1',
    '[coop-load] Attached epoch=1', '[coop-load] Loaded epoch=1']) {
    s.receive(line); assert.equal(s.canTravel, false);
    s.receive('[campaign] Chapter 1 restored with 2 network kingdoms');
    assert.equal(s.canTravel, false, 'restored chapter metadata cannot grant shared resume');
    assert.deepEqual(s.region, {x: 0, y: 0});
  }
  s.receive('[coop-load] Resumed epoch=1 serial=1 region=01_0');
  assert.equal(s.canTravel, false);
  s.receive('[coop-load] Resumed epoch=1 serial=1 region=1_0');
  assert.equal(s.canTravel, true); assert.deepEqual(s.region, {x: 1, y: 0});
  assert.equal(s.request('west', 200), true);
});

test('existing world refusal explains saved progress and clears travel without pausing', () => {
  const s = controls(); start(s); s.request('east', 100);
  s.receive('[coop-transition] Request refused stage=saved-world epoch=1');
  assert.equal(s.pending, null);
  assert.equal(s.busy, false);
  assert.equal(s.canTravel, true);
  assert.deepEqual(s.region, {x: 0, y: 0});
  assert.match(s.status, /saved progress.*new world name/);
  assert.equal(s.consume('coop-travel-east', 101), false);
});

test('readback refusal explains why travel cannot use a replay', () => {
  const s = controls(); start(s); s.request('east', 100);
  s.receive('[coop-transition] Request refused stage=readback epoch=1');
  assert.equal(s.pending, null); assert.equal(s.busy, false);
  assert.deepEqual(s.region, {x: 0, y: 0});
  assert.match(s.status, /playing a replay/);
  assert.equal(s.consume('coop-travel-east', 101), false);
});

test('canceled travel keeps the source and waits for its exact original resume', () => {
  for (const reason of ['Canceled', 'Unavailable']) for (const host of [true, false]) {
    const s = controls(); start(s, host);
    if (host) { s.request('east', 100); s.consume('coop-travel-east', 101); }
    s.receive('[coop-load] Source resumed epoch=1 serial=2 region=0_0');
    assert.equal(s.canceled, null, 'a resume without cancellation grants no recovery');
    s.receive(`[coop-load] ${reason} epoch=1 serial=2 source=1_0`);
    assert.equal(s.canceled, null, 'a different source cannot cancel this region');
    s.receive(`[coop-load] ${reason} epoch=1 serial=2 source=0_0`);
    assert.equal(s.busy, true); assert.equal(s.canTravel, false);
    assert.equal(s.pending, null); assert.match(s.status, /Waiting/);
    s.receive('[coop-transition] Proposal refused epoch=1 direction=1,0');
    assert.match(s.status, /Waiting/, 'proposal refusal retains the recovery message');
    for (const line of [
      '[coop-load] Source resume queued epoch=1 serial=2',
      '[coop-load] Source resumed epoch=2 serial=2 region=0_0',
      '[coop-load] Source resumed epoch=1 serial=3 region=0_0',
      '[coop-load] Source resumed epoch=1 serial=2 region=1_0',
      '[coop-load] Source resumed epoch=1 serial=2 region=00_0',
      '[coop-load] Canceled epoch=1 serial=3 source=0_0',
      '[coop-load] Resumed epoch=1 serial=2 region=1_0'
    ]) {
      s.receive(line); assert.equal(s.canTravel, false);
      assert.deepEqual(s.canceled, {epoch: '1', serial: '2'});
      assert.deepEqual(s.region, {x: 0, y: 0});
    }
    s.receive('[coop-load] Source resumed epoch=1 serial=2 region=0_0');
    assert.equal(s.canceled, null); assert.equal(s.busy, false);
    assert.equal(s.canTravel, host); assert.deepEqual(s.region, {x: 0, y: 0});
    assert.match(s.status, /Both kingdoms resumed/);
  }
});

test('connection loss during cancellation permanently revokes recovery', () => {
  const s = controls(); start(s); s.request('north', 100);
  s.receive('[coop-load] Canceled epoch=1 serial=2 source=0_0');
  s.receive('[network] Session connection lost');
  s.receive('[coop-load] Source resumed epoch=1 serial=2 region=0_0');
  assert.equal(s.canTravel, false); assert.equal(s.playing, false);
  assert.equal(s.canceled, null); assert.equal(s.stopped, true);
});

test('rejection, failure and chapter completion revoke queued travel', () => {
  for (const line of ['[coop-load] Rejected epoch=1', '[coop-transfer] Rejected: mismatch',
    '[network] Session connection lost', '[network] Session receive queue overflow',
    '[campaign] Chapter 1 shared victory for 2 kingdoms', '[campaign] Chapter 1 shared defeat for 2 kingdoms']) {
    const s = controls(); start(s); s.request('east', 100); s.receive(line);
    assert.equal(s.canTravel, false); assert.equal(s.pending, null);
    assert.equal(s.consume('coop-travel-east', 101), false);
    start(s); assert.equal(s.canTravel, false, 'a stopped page must rejoin before another operation');
  }
});

test('resume guidance selects the token alias even when an older alias sorts ahead', () => {
  const saved = {world:'test-world',x:0,y:0,frame:1,clock:2,revision:'15',bytes:32,
    sha256:'1'.repeat(64),content:'a'.repeat(64)+':'+ 'b'.repeat(64),rules:'c'.repeat(64)};
  const search = new URLSearchParams(query);
  search.set('RECOMP_COOP_RESUME', resumeToken(saved,1));
  assert.deepEqual(hostResumeReminder(search), {revision:'15',label:'WorldResume_test-world_0_0_'+ '1'.repeat(16),
    text:'Checkpoint 15: choose Load Game → “WorldResume_test-world_0_0_'+ '1'.repeat(16)+'”.'});
  search.set('role','guest'); assert.equal(hostResumeReminder(search),null);
  search.set('role','host');search.append('role','host');assert.equal(hostResumeReminder(search),null);
  search.delete('role');search.set('role','host');search.set('RECOMP_RULE_COOP_WORLD','other-world');
  assert.equal(hostResumeReminder(search),null);
  search.set('RECOMP_RULE_COOP_WORLD','test-world');search.set('RECOMP_COOP_RESUME','invalid');
  assert.equal(hostResumeReminder(search),null);
});
