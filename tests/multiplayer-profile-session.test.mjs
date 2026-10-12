import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const site = process.env.MAJESTY_MULTIPLAYER_SITE_ROOT;
const {multiplayerProfileConfig, startMultiplayerProfilePlayer} = await import(site
  ? pathToFileURL(resolve(site, 'multiplayer/profile-session.mjs'))
  : new URL('../web/multiplayer/profile-session.mjs', import.meta.url));

const query = (profile = 'host', mode = 'coop') => new URLSearchParams({mode, profile}).toString();
function deferred() {
  let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve};
}
function fixture() {
  const held = new Set(), calls = [], listeners = new Set();
  const events = {
    addEventListener(name, fn) { assert.equal(name, 'pagehide'); listeners.add(fn); },
    removeEventListener(name, fn) { assert.equal(name, 'pagehide'); listeners.delete(fn); },
    hide() { for (const fn of [...listeners]) fn(); },
  };
  const locks = {async request(name, options, consume) {
    calls.push({name, options});
    if (held.has(name)) return consume(null);
    held.add(name); try { return await consume({}); } finally { held.delete(name); }
  }};
  return {held, calls, listeners, events, locks, options: {search: query(), locks, events}};
}

test('co-op and competitive profiles share one local lease; names never become player IDs', () => {
  assert.deepEqual(multiplayerProfileConfig(query()), {profile: 'host', lock: 'majesty-native-profile:majesty:host'});
  assert.deepEqual(multiplayerProfileConfig(query('host', 'competitive')), multiplayerProfileConfig(query()));
  assert.equal(multiplayerProfileConfig('?profile=solo'), null);
  assert.equal(multiplayerProfileConfig('?room=Majesty').lock, 'majesty-native-profile:majesty:');
  assert.notEqual(multiplayerProfileConfig(query('__default__')).lock, multiplayerProfileConfig('?mode=coop').lock);
  assert.equal(multiplayerProfileConfig('?RECOMP_RULE_COOP_CHECKPOINT=v1&profile=p2').profile, 'p2');
});

test('invalid and mixed solo/shared startup rejects before any lock or preparation', async () => {
  const invalid = ['&profile=other', '&RECOMP_PROFILE_DIR=/opfs/elsewhere', '&world=shared',
    '&RECOMP_RULE_FRONTIER_REGION=0_0', '&RECOMP_RULE_FRONTIER_SESSION=v1',
    '&RECOMP_RULE_FRONTIER_HERO_RESTORE=v1', '&RECOMP_BROWSER_FRONTIER_TRANSFER_CASE=committed',
    '&RECOMP_FRONTIER_HERO_BINDING=claimed', '&mode=coop', '&room=a&room=b',
    '&relay=ws://one&relay=ws://two', '&role=host&role=guest',
    '&RECOMP_RULE_COOP_WORLD=a&RECOMP_RULE_COOP_WORLD=b'];
  for (const extra of invalid) {
    const f = fixture();
    await assert.rejects(startMultiplayerProfilePlayer(() => assert.fail('invalid startup prepared'),
      {...f.options, search: query() + extra}));
    assert.equal(f.calls.length, 0); assert.equal(f.listeners.size, 0);
  }
  assert.throws(() => multiplayerProfileConfig('?mode=coop&profile=../personal'));
});

test('a competing local session fails before preparation while a different participant may start', async () => {
  const f = fixture(), entered = deferred();
  void startMultiplayerProfilePlayer((profile, retain) => {
    assert.equal(profile, 'host'); retain(); entered.resolve();
  }, f.options);
  await entered.promise;
  for (const search of [query(), query('host', 'competitive')])
    await assert.rejects(startMultiplayerProfilePlayer(() => assert.fail('busy profile prepared'),
      {...f.options, search}), /profile busy/);
  const guest = deferred();
  void startMultiplayerProfilePlayer((profile, retain) => {
    assert.equal(profile, 'guest'); retain(); guest.resolve();
  }, {...f.options, search: query('guest')});
  await guest.promise;
  assert.equal(f.held.size, 2);
  assert.deepEqual(f.calls[0].options, {mode: 'exclusive', ifAvailable: true});
  f.events.hide(); assert.equal(f.held.size, 2); assert.equal(f.listeners.size, 0);
  f.held.clear();
});

test('unused leases unwind; a departed or completed preparation cannot inject late', async () => {
  const f = fixture(); let retain;
  await assert.rejects(startMultiplayerProfilePlayer((_profile, mark) => { retain = mark; throw Error('preparation failed'); }, f.options), /preparation failed/);
  assert.equal(f.held.size, 0); assert.throws(retain, /no longer/);
  await assert.rejects(startMultiplayerProfilePlayer(() => {}, f.options), /did not retain/);
  assert.equal(f.held.size, 0);
  const waiting = deferred(), release = deferred();
  const startup = startMultiplayerProfilePlayer(async (_profile, mark) => {
    waiting.resolve(); await release.promise; mark();
  }, f.options);
  await waiting.promise; f.events.hide(); release.resolve();
  await assert.rejects(startup, /no longer/);
  assert.equal(f.held.size, 0); assert.equal(f.listeners.size, 0);
});

test('post-injection errors report without releasing a potentially writing engine', async () => {
  const f = fixture(); let retain;
  await assert.rejects(startMultiplayerProfilePlayer((_profile, mark) => {
    retain = mark; mark(); throw Error('script append failed');
  }, f.options), /append failed/);
  assert.equal(f.held.size, 1); assert.throws(retain, /no longer/);
  f.events.hide(); assert.equal(f.held.size, 1);
  await assert.rejects(startMultiplayerProfilePlayer(() => assert.fail('failed engine escaped lease'), f.options), /busy/);
  f.held.clear();
});

test('ordinary startup stays compatible; missing or failing lock APIs never prepare multiplayer', async () => {
  assert.equal(await startMultiplayerProfilePlayer((...args) => { assert.equal(args.length, 0); return 42; },
    {search: '', locks: null, events: null}), 42);
  const f = fixture();
  for (const locks of [null, {request() { throw Error('API failed'); }}]) {
    await assert.rejects(startMultiplayerProfilePlayer(() => assert.fail('unlocked preparation'), {...f.options, locks}));
    assert.equal(f.listeners.size, 0);
  }
  const gate = deferred(), original = f.locks.request;
  f.locks.request = async (...args) => { await gate.promise; return original(...args); };
  const startup = startMultiplayerProfilePlayer(() => assert.fail('departed before lease granted'), f.options);
  f.events.hide(); gate.resolve(); await startup; assert.equal(f.held.size, 0);
});

const raw = (await readFile(site ? resolve(site, 'majesty/index.html') : 'upstream/majesty-recomp/kit/web/player/index.html', 'utf8')).replaceAll('@APP@', 'MajestyRecomp');
const stage = source => spawnSync('python3', ['-c', "import runpy,sys; sys.stdout.write(runpy.run_path('scripts/stage-world.py')['stage_player'](sys.stdin.read()))"], {input: source, encoding: 'utf8'});
const staged = stage(raw); assert.equal(staged.status, 0, staged.stderr);
const body = staged.stdout.match(/<script>([\s\S]*?)<\/script>/)[1];
const bootstrap = body.indexOf('// Frontier startup owns its storage lease');
const script = (body.slice(0, bootstrap) + 'networkManifest = fakeManifest;\n' + body.slice(bootstrap))
  .replace('import("../multiplayer/profile-session.mjs")', 'loadProfileModule()')
  .replace('import("../backups/storage.mjs")', 'loadBackupModule()');
const backupGuard = script.includes('loadBackupModule()');

test('actual staged start locks before hashing/GPU/injection and pins the exact profile through preRun', {timeout: 5000}, async () => {
  assert.equal(stage(staged.stdout).stdout, staged.stdout);
  for (const mode of ['start', 'default', 'busy', 'mixed', 'post-injection-error', 'wrong-game', ...(backupGuard ? ['restore-interrupted'] : [])]) {
    const f = fixture(), done = deferred(), order = [], window = {}, env = {}, messages = [];
    if (mode === 'busy') f.held.add(multiplayerProfileConfig(query()).lock);
    const location = {search: mode === 'default' ? '?mode=competitive' : query() + (mode === 'mixed' ? '&world=bad' : ''),
      pathname: mode === 'wrong-game' ? '/other/' : '/majesty/', protocol: 'http:', hostname: 'localhost'};
    const status = {append() {}, hidden: false};
    Object.defineProperty(status, 'textContent', {set(value) {
      messages.push(value);
      if (/profile busy|solo region|append failure|require Majesty|restore interrupted/.test(value)) done.resolve();
    }});
    const canvas = {addEventListener() {}, focus() {}};
    const document = {getElementById: id => id === 'canvas' ? canvas : status, addEventListener() {}, createElement: () => ({}),
      body: {append(node) {
        assert.equal(f.held.size, 1); assert.equal(node.src, 'MajestyRecomp.js'); order.push('append');
        if (mode === 'post-injection-error') throw Error('append failure');
        // A URL edit after injection must not redirect OPFS outside the lease.
        location.search = '?profile=changed&RECOMP_PROFILE_DIR=/opfs/changed';
        window.Module.ENV = env; for (const fn of window.Module.preRun) fn(); done.resolve();
      }}};
    const folder = {async getDirectoryHandle() { return folder; }, async getFileHandle() { return {}; }};
    const navigator = {storage: {async getDirectory() { assert.equal(f.held.size, 1); order.push('storage'); return folder; }},
      gpu: {async requestAdapter() {
        assert.equal(f.held.size, 1); order.push('GPU');
        return {features: new Set(), limits: {}, async requestDevice() { return {lost: new Promise(() => {}), addEventListener() {}}; }};
      }}};
    void runInNewContext(script, {URLSearchParams, location, document, window, navigator, crossOriginIsolated: true, console, AbortController,
      addEventListener: f.events.addEventListener, removeEventListener: f.events.removeEventListener,
      async fetch() { assert.equal(f.held.size, 1); order.push('games'); return {async json() { return [{id: mode === 'wrong-game' ? 'other' : 'majesty', title: 'Majesty', executable: 'Majesty.exe'}]; }}; },
      async fakeManifest() { assert.equal(f.held.size, 1); order.push('hash'); return {session: 'session', checkpoint: 'content'}; },
      async loadBackupModule() { return {async assertNoPlayerRestore() {
        assert.equal(f.held.size,1); order.push('restore-guard');
        if(mode === 'restore-interrupted') throw Error('restore interrupted');
      }}; },
      async loadProfileModule() { return {startMultiplayerProfilePlayer: start => startMultiplayerProfilePlayer(start, {...f.options, search: location.search})}; }});
    await done.promise;
    if (['busy', 'mixed'].includes(mode)) assert.deepEqual(order, []);
    else if (mode === 'wrong-game') { assert.deepEqual(order, backupGuard ? ['restore-guard'] : []); assert.equal(f.held.size, 0); }
    else if (mode === 'restore-interrupted') { assert.deepEqual(order, ['restore-guard']); assert.equal(f.held.size, 0); }
    else {
      assert.deepEqual(order, [...(backupGuard ? ['restore-guard'] : []), 'games', 'storage', 'hash', 'GPU', 'append']);
      assert.equal(f.held.size, 1);
      if (mode !== 'post-injection-error') assert.equal(env.RECOMP_PROFILE_DIR, '/opfs/majesty/profile' + (mode === 'default' ? '' : '/host'));
    }
    assert.equal(f.listeners.size, 0); f.held.clear();
  }
});
