import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {chapters, selectedProfile, chapterURL, openProgress, completion, resetCompletion} from '../web/campaign/progress.mjs';
import {treasuryProgress,treasuryText} from '../web/campaign/objective-progress.mjs';
import {engineWorldContext,worldNavigationURL,resumedWorldContext} from '../web/multiplayer/navigation.mjs';
import {gameURL} from '../web/multiplayer/invitation.mjs';

test('profile selection matches native names and rejects ambiguous or invalid paths', () => {
  assert.equal(selectedProfile(''), '');
  assert.equal(selectedProfile('?profile='), '');
  for (const name of ['Alice', 'bob-2_', 'a'.repeat(40)])
    assert.equal(selectedProfile(`?profile=${name}`), name);
  for (const search of ['?profile=a&profile=b', '?profile=a&profile=a', '?profile=../bob',
    '?profile=%2Fbob', '?profile=a+b', `?profile=${'a'.repeat(41)}`])
    assert.throws(() => selectedProfile(search), /profile/);
});
test('chapter links keep the selected native profile and required shared rules with relay changes', () => {
  for (const chapter of [1, 2, 3, 4]) {
    const url = chapterURL(chapter, 'http://localhost:8000/campaign/?profile=old', 'alice', 'wss://example.com/rooms');
    assert.equal(url.pathname, '/majesty/');
    assert.equal(url.searchParams.get('profile'), 'alice');
    assert.equal(url.searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'), String(chapter));
    assert.equal(url.searchParams.get('RECOMP_RULE_INVENTORY_COMPAT'), '1');
    assert.equal(url.searchParams.get('relay'), 'wss://example.com/rooms');
  }
  assert.equal(chapterURL(1, 'http://localhost:8000/campaign/', '').searchParams.has('profile'), false);
  for (const relay of ['https://example.com', 'javascript:alert(1)', '/rooms'])
    assert.throws(() => chapterURL(1, 'http://localhost:8000/campaign/', 'alice', relay));
  for (const chapter of [0, 5, 1.5, '1'])
    assert.throws(() => chapterURL(chapter, 'http://localhost:8000/campaign/'), /chapter/);
});
function opening() {
  const requests = [];
  return {requests, storage: {open(name, version) {
    const request = {name, version, result: {closed: false, close() {this.closed = true;}}};
    requests.push(request); return request;
  }}};
}
test('legacy completions remain in the default database while named profiles get distinct databases', async () => {
  const {storage, requests} = opening();
  const pending = ['', 'alice', 'bob', 'Alice'].map(profile => openProgress(profile, storage));
  assert.deepEqual(requests.map(r => r.name), ['majesty-frontier-campaign-v1',
    'majesty-frontier-campaign-v1-profile-alice', 'majesty-frontier-campaign-v1-profile-bob',
    'majesty-frontier-campaign-v1-profile-Alice']);
  for (const r of requests) { assert.equal(r.version, 1); r.onsuccess(); }
  const dbs = await Promise.all(pending);
  for (const db of dbs) { db.onversionchange(); assert.equal(db.closed, true); }
  await assert.rejects(openProgress('../alice', storage), /profile/);
  assert.equal(requests.length, 4, 'invalid profile opens no database');
});
test('blocked opens reject and close a subsequently delivered connection', async () => {
  const {storage, requests} = opening(), pending = openProgress('alice', storage);
  requests[0].onblocked();
  await assert.rejects(pending, /Close older campaign tabs/);
  requests[0].onsuccess(); assert.equal(requests[0].result.closed, true);
});
function transactionFixture() {
  const transactions = [];
  return {transactions, db: {transaction(name, mode) {
    assert.equal(name, 'chapters');
    const t = {mode, requests: [], objectStore() {return Object.fromEntries(['get', 'put', 'delete'].map(op => [op, (...args) => {
      const r = {op, args}; t.requests.push(r); return r;
    }]));}};
    transactions.push(t); return t;
  }}};
}
test('victory and reset publish only after transaction completion; aborts reject', async () => {
  const {db, transactions} = transactionFixture();
  let settled = false;
  const write = completion(db, 1, true).then(value => {settled = true; return value;});
  const t = transactions[0]; assert.equal(t.mode, 'readwrite');
  assert.deepEqual(t.requests[0].args, [true, 1]);
  t.requests[0].onsuccess(); await Promise.resolve(); assert.equal(settled, false);
  t.oncomplete(); assert.equal(await write, true);
  const reset = resetCompletion(db, 1), failed = transactions[1];
  assert.equal(failed.requests[0].op, 'delete');
  failed.error = new Error('disk full'); failed.onabort();
  await assert.rejects(reset, /disk full/);
  const read = completion(db, 1), readTx = transactions[2];
  readTx.requests[0].result = true; readTx.requests[0].onsuccess();
  readTx.onabort(); await assert.rejects(read, /Campaign storage failed/);
  for (const chapter of [0, 5, '1']) {
    await assert.rejects(completion(db, chapter, true), /chapter/);
    await assert.rejects(resetCompletion(db, chapter), /chapter/);
  }
  assert.equal(transactions.length, 3, 'invalid chapters never mutate storage');
});

const sessionSource = await readFile(process.env.MAJESTY_CAMPAIGN_SESSION_SOURCE ?? new URL('../web/campaign/session.mjs', import.meta.url), 'utf8');
function session(search, options = {}) {
  const elements = [], events = new Map(), opened = [], writes = [], connections = [], dispatched = [];
  const failures = {write: !!options.failWrite, open: !!options.failOpen};
  const createElement = tag => {
    const node = {tag, style: {}, children: [], textContent: '', setAttribute() {},
      appendChild(child) {this.children.push(child); return child;}, addEventListener(name, fn) {this[name] = fn;}};
    elements.push(node); return node;
  };
  const document = {body: createElement('body'), createElement, addEventListener(name, fn) {events.set(name, fn);}, dispatchEvent(event) {dispatched.push(event);}};
  runInNewContext(sessionSource.replace(/^import .*;\n/gm, ''), {
    document, location: {search, href: `http://localhost:8000/majesty/${search}`}, URL, URLSearchParams,
    chapters, selectedProfile, chapterURL, engineWorldContext,worldNavigationURL,resumedWorldContext,treasuryProgress,treasuryText,
    CustomEvent: class {constructor(name, init) {this.type = name; this.detail = init.detail;}},
    async openProgress(profile) {
      opened.push(profile);if (options.openGate) await options.openGate;
      if (failures.open) throw new Error('storage blocked');
      const db = options.dbFactory?.() ?? {closed: false, close() {this.closed = true;}};
      connections.push(db);return db;
    },
    async completion(...args) {
      writes.push(args);if (options.writeGate) await options.writeGate;
      if (failures.write) throw new Error('aborted write');
      if (options.commit) return options.commit(...args);
    }
  });
  return {elements, opened, writes, connections, dispatched, failures,
    get db() {return connections.at(-1);},
    get progress() {return elements.filter(e => e.tag === 'output')[1];},
    get retry() {return elements.find(e => e.tag === 'button' && e.textContent === 'Retry local save');},
    get surrender() {return elements.filter(e => e.tag === 'button')[1];},
    poll() {const detail={name:'frontier-surrender',pending:false};events.get('recomp-action-poll')({detail});return detail.pending;},
    stop() {return events.get('recomp-runtime-state')({detail: {state: 'failed'}});},
    message(line) {return events.get('recomp-runtime-message')({detail: line});}};
}
test('a pending original result blocks shared actions and cannot save campaign completion before final victory', async () => {
  const ui=session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=3');
  await ui.message('[campaign] Chapter 3 restored with 2 network kingdoms');
  assert.equal(ui.surrender.disabled,false);
  await ui.message('[campaign] Chapter 3 shared result pending victory for 2 kingdoms');
  assert.equal(ui.dispatched.at(-1).detail.state,'ending');
  assert.equal(ui.surrender.disabled,true);assert.equal(ui.writes.length,0);
  await ui.message('[campaign] Chapter 3 restored with 2 network kingdoms');
  await ui.message('[campaign] Chapter 3 treasury progress: kingdom 1 35000/35000; kingdom 2 35000/35000; ready');
  assert.equal(ui.dispatched.at(-1).detail.state,'ending');
  assert.equal(ui.surrender.disabled,true);assert.equal(ui.writes.length,0);
  await ui.message('[campaign] Chapter 3 shared victory for 2 kingdoms');
  assert.equal(ui.dispatched.at(-1).detail.state,'finished');
  assert.equal(ui.writes.length,1);assert.equal(ui.writes[0][1],3);
});

test('pending and final shared defeat never mark a chapter complete', async () => {
  const ui=session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=3');
  await ui.message('[campaign] Chapter 3 restored with 2 network kingdoms');
  await ui.message('[campaign] Chapter 3 shared result pending defeat for 2 kingdoms');
  assert.equal(ui.dispatched.at(-1).detail.state,'ending');
  await ui.message('[campaign] Chapter 3 shared defeat for 2 kingdoms');
  assert.equal(ui.dispatched.at(-1).detail.state,'finished');assert.equal(ui.writes.length,0);
});
test('treasury display requires a playing party and never records completion from gold alone', async()=>{
  const ui=session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=3');
  const line='[campaign] Chapter 3 treasury progress: kingdom 1 35000/35000; kingdom 2 35005/35000; objective met';
  await ui.message(line);
  const treasury=ui.elements.find(e=>e.tag==='p'&&e.hidden===true);
  assert.equal(treasury.textContent,'');
  await ui.message('[campaign] Chapter 3 restored with 2 network kingdoms');
  await ui.message(line);
  assert.equal(treasury.hidden,false);assert.match(treasury.textContent,/Kingdom 2: 35,005/);
  assert.match(ui.elements.find(e=>e.tag==='output').textContent,/waiting for the shared result/);
  assert.equal(ui.writes.length,0);
  await ui.message('[network] Session connection lost');
  const last=treasury.textContent;
  await ui.message(line.replace('35005','35040'));
  assert.equal(treasury.textContent,last);assert.equal(ui.writes.length,0);
});
test('actual victory adapter writes the selected profile once and returns to the same campaign profile', async () => {
  const ui = session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=1&relay=wss%3A%2F%2Fexample.com%2Frooms');
  await ui.message('[campaign] Chapter 2 shared victory for 2 kingdoms'); assert.equal(ui.writes.length, 0);
  await ui.message('[campaign] Chapter 1 shared defeat for 2 kingdoms'); assert.equal(ui.writes.length, 0);
  await ui.message('[campaign] Chapter 1 shared victory for 2 kingdoms');
  await ui.message('[campaign] Chapter 1 shared victory for 2 kingdoms');
  assert.deepEqual(ui.opened, ['alice']); assert.equal(ui.writes.length, 1); assert.equal(ui.db.closed, true);
  assert.match(ui.progress.textContent, /completion saved locally/);
  assert.equal(ui.retry.hidden, true);assert.equal(ui.retry.disabled, true);
  const back = new URL(ui.elements.find(e => e.tag === 'a').href);
  assert.equal(back.pathname, '/campaign/'); assert.equal(back.searchParams.get('profile'), 'alice');
  assert.equal(back.searchParams.get('relay'), 'wss://example.com/rooms');
});
test('campaign adapter carries the actual room and last resumed region through completion and navigation',async()=>{
  const url=gameURL('http://localhost:8000/multiplayer/',{mode:'coop',chapter:1,world:'our-world',
    region:'0_0',role:'guest',room:'Expected',relay:'ws://localhost:8002/rooms'},'alice');
  const ui=session(url.search);
  const back=ui.elements.find(e=>e.tag==='a'&&e.textContent==='Campaign chapters');
  const setup=ui.elements.find(e=>e.tag==='a'&&e.textContent==='Shared world setup');
  await ui.message('[network] Created room Actual room (0 players)');
  await ui.message('[campaign] Chapter 1 started with 2 network kingdoms');
  await ui.message('[coop-load] Resumed epoch=1 serial=2 region=-1_2');
  for(const link of [back,setup]){
    const parsed=new URL(link.href);
    assert.equal(parsed.searchParams.get('region'),'-1_2');assert.equal(parsed.searchParams.get('role'),'host');
    assert.equal(parsed.searchParams.get('room'),'Actual room');assert.equal(parsed.searchParams.get('profile'),'alice');
  }
  const last=back.href;await ui.message('[coop-load] Resumed epoch=1 serial=3 region=01_0');
  assert.equal(back.href,last);
  await ui.message('[campaign] Chapter 1 shared victory for 2 kingdoms');
  const next=new URL(ui.elements.find(e=>e.tag==='a'&&e.textContent==='Next chapter: Provision the Expedition').href);
  assert.equal(next.pathname,'/multiplayer/');assert.equal(next.searchParams.get('chapter'),'2');
  assert.equal(next.searchParams.get('world'),'our-world');assert.equal(next.searchParams.get('region'),'-1_2');
  assert.equal(next.searchParams.get('worldChapter'),'1');assert.equal(ui.writes.length,1);
  await ui.message('[network] Session connection lost');
  await ui.message('[coop-load] Resumed epoch=1 serial=4 region=3_4');assert.equal(back.href,last);
});

for (const loss of ['[network] Session connection lost', '[network] Session receive queue overflow']) {
  test(`campaign cancels a queued surrender on ${loss} and rejects late results`, async () => {
    const ui=session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=2');
    await ui.message('[campaign] Chapter 2 started with 2 network kingdoms');
    assert.equal(ui.surrender.disabled,false);
    ui.surrender.click();ui.surrender.click();
    assert.equal(ui.surrender.disabled,true);
    await ui.message(loss);
    assert.equal(ui.poll(),false,'no stale shared command reaches the native game');
    assert.match(ui.elements.find(e=>e.tag==='output').textContent,/Session ended/);
    assert.equal(ui.dispatched.filter(e=>e.detail.state==='interrupted').length,1);
    const count=ui.elements.length;
    await ui.message(loss);
    await ui.message('[campaign] Chapter 2 restored with 2 network kingdoms');
    await ui.message('[campaign] Chapter 2 shared victory for 2 kingdoms');
    ui.surrender.click();ui.surrender.click();
    assert.equal(ui.poll(),false);assert.equal(ui.surrender.disabled,true);
    assert.equal(ui.opened.length,0);assert.equal(ui.writes.length,0);
    assert.equal(ui.elements.length,count);assert.equal(ui.dispatched.filter(e=>e.detail.state==='interrupted').length,1);
  });
}
for (const outcome of ['victory','defeat']) {
  test(`shared ${outcome} cancels pending surrender before another native poll`,async()=>{
    const ui=session('?RECOMP_RULE_FRONTIER_CHAPTER=1');
    assert.equal(ui.surrender.disabled,true);ui.surrender.click();ui.surrender.click();
    assert.equal(ui.poll(),false,'waiting lobby cannot queue a surrender');
    await ui.message('[campaign] Chapter 1 started with 2 network kingdoms');
    ui.surrender.click();ui.surrender.click();
    await ui.message(`[campaign] Chapter 1 shared ${outcome} for 2 kingdoms`);
    assert.equal(ui.poll(),false);assert.equal(ui.surrender.disabled,true);
    ui.surrender.click();ui.surrender.click();assert.equal(ui.poll(),false);
    assert.equal(ui.writes.length,outcome==='victory'?1:0);
  });
}
test('a confirmed victory commits through disconnect without enabling shared actions',async()=>{
  const writing=gate(),ui=session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=1',{writeGate:writing.promise});
  await ui.message('[campaign] Chapter 1 started with 2 network kingdoms');
  const saving=ui.message('[campaign] Chapter 1 shared victory for 2 kingdoms');
  await new Promise(resolve=>setImmediate(resolve));
  await ui.message('[network] Session connection lost');
  writing.resolve();await saving;
  assert.match(ui.progress.textContent,/completion saved locally/);
  assert.equal(ui.writes.length,1);assert.equal(ui.db.closed,true);assert.equal(ui.surrender.disabled,true);
  assert.equal(ui.poll(),false);assert.equal(ui.dispatched.at(-1).detail.state,'finished');
});
test('disconnect retains retry for a previously confirmed victory',async()=>{
  const ui=session('?profile=bob&RECOMP_RULE_FRONTIER_CHAPTER=3',{failWrite:true});
  await ui.message('[campaign] Chapter 3 shared victory for 4 kingdoms');
  await ui.message('[network] Session receive queue overflow');
  assert.equal(ui.retry.disabled,false);ui.failures.write=false;
  await ui.retry.click();
  assert.match(ui.progress.textContent,/completion saved locally/);
  assert.equal(ui.writes.length,2);assert.ok(ui.connections.every(db=>db.closed));
  assert.equal(ui.surrender.disabled,true);assert.equal(ui.poll(),false);
});
test('a playing match consumes one confirmed surrender and restoration clears old confirmation',async()=>{
  const ui=session('?RECOMP_RULE_FRONTIER_CHAPTER=2');
  await ui.message('[campaign] Chapter 2 started with 2 network kingdoms');
  ui.surrender.click();assert.equal(ui.poll(),false);
  await ui.message('[campaign] Chapter 2 restored with 2 network kingdoms');
  ui.surrender.click();assert.equal(ui.poll(),false);
  ui.surrender.click();assert.equal(ui.poll(),true);assert.equal(ui.poll(),false);
  const stopped=session('?RECOMP_RULE_FRONTIER_CHAPTER=2');
  await stopped.message('[campaign] Chapter 2 started with 2 network kingdoms');
  stopped.surrender.click();stopped.surrender.click();stopped.stop();
  assert.equal(stopped.poll(),false);assert.equal(stopped.surrender.disabled,true);
});
test('failed victory writes close the connection and allow explicit retry; ambiguous profiles never write', async () => {
  const failed = session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=1', {failWrite: true});
  await failed.message('[campaign] Chapter 1 shared victory for 2 kingdoms');
  assert.equal(failed.db.closed, true);
  assert.match(failed.progress.textContent, /aborted write/);
  assert.equal(failed.retry.hidden, false);assert.equal(failed.retry.disabled, false);
  await failed.message('[campaign] Chapter 1 shared victory for 2 kingdoms');assert.equal(failed.writes.length, 1);
  failed.failures.write = false;await failed.retry.click();assert.equal(failed.writes.length, 2);
  assert.ok(failed.connections.every(db => db.closed));assert.match(failed.progress.textContent, /completion saved locally/);
  const invalid = session('?profile=alice&profile=bob&RECOMP_RULE_FRONTIER_CHAPTER=1');
  await invalid.message('[campaign] Chapter 1 shared victory for 2 kingdoms');
  assert.equal(invalid.opened.length, 0); assert.equal(invalid.writes.length, 0);
  assert.equal(invalid.retry.hidden, true);assert.equal(invalid.retry.disabled, true);
});
function gate() {let resolve;const promise = new Promise(r => {resolve = r;});return {promise, resolve};}
test('duplicate outcomes and retry clicks share one pending open and never queue more writes', async () => {
  const opening = gate(), ui = session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=2', {openGate: opening.promise});
  const saving = ui.message('[campaign] Chapter 2 shared victory for 2 kingdoms');
  const retry = ui.retry.click();
  for (let i=0;i<1000;++i) {
    await ui.message('[campaign] Chapter 2 shared victory for 2 kingdoms');
    assert.equal(ui.retry.click(), retry);
  }
  assert.deepEqual(ui.opened, ['alice']);assert.equal(ui.writes.length, 0);
  assert.equal(ui.retry.hidden, true);assert.equal(ui.retry.disabled, true);
  assert.match(ui.progress.textContent, /Saving chapter/);
  assert.equal(ui.dispatched.filter(event => event.detail.state === 'finished').length, 1);
  opening.resolve();await saving;await retry;
  assert.equal(ui.writes.length, 1);assert.equal(ui.connections.length, 1);assert.equal(ui.db.closed, true);
});
test('confirmed victory remains retryable after the game stops without replaying its result', async () => {
  const ui = session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=1', {failWrite: true});
  await ui.message('[campaign] Chapter 1 shared victory for 2 kingdoms');ui.stop();
  assert.match(ui.elements.find(e => e.tag === 'output').textContent, /Game stopped/);
  assert.match(ui.progress.textContent, /aborted write/);assert.equal(ui.retry.disabled, false);
  ui.failures.write = false;await ui.retry.click();
  assert.match(ui.progress.textContent, /completion saved locally/);assert.equal(ui.retry.hidden, true);
  assert.ok(ui.connections.every(db => db.closed));
  assert.equal(ui.writes.length, 2);
});
test('a pending save settles after game failure while native actions remain disabled', async () => {
  const writing = gate(), ui = session('?profile=bob&RECOMP_RULE_FRONTIER_CHAPTER=3', {writeGate: writing.promise});
  const saving = ui.message('[campaign] Chapter 3 shared victory for 4 kingdoms');
  await new Promise(resolve => setImmediate(resolve));ui.stop();
  assert.match(ui.progress.textContent, /Saving chapter/);assert.equal(ui.db.closed, false);
  writing.resolve();await saving;
  assert.match(ui.progress.textContent, /completion saved locally/);assert.equal(ui.db.closed, true);
  assert.equal(ui.elements.find(e => e.tag === 'button' && e.textContent === 'Surrender together').disabled, true);
  assert.match(ui.elements.find(e => e.tag === 'output').textContent, /Game stopped/);
});
test('storage-open failure is retryable, but defeat and a result received after runtime failure never write', async () => {
  const ui = session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=1', {failOpen: true});
  await ui.message('[campaign] Chapter 1 shared victory for 2 kingdoms');
  assert.match(ui.progress.textContent, /storage blocked/);assert.equal(ui.connections.length, 0);
  ui.failures.open = false;await ui.retry.click();
  assert.equal(ui.opened.length, 2);assert.equal(ui.writes.length, 1);assert.equal(ui.db.closed, true);
  const stopped = session('?RECOMP_RULE_FRONTIER_CHAPTER=1');
  await stopped.message('[campaign] Chapter 1 shared defeat for 2 kingdoms');await stopped.retry.click();
  assert.equal(stopped.progress.hidden, true);stopped.stop();
  await stopped.message('[campaign] Chapter 1 shared victory for 2 kingdoms');
  assert.equal(stopped.opened.length, 0);assert.equal(stopped.writes.length, 0);assert.equal(stopped.retry.hidden, true);
});
test('actual transaction abort preserves a confirmed result for retry and only commit announces completion', async () => {
  const fixture = transactionFixture();
  const ui = session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=1', {
    dbFactory() {return {...fixture.db, closed: false, close() {this.closed = true;}};}, commit: completion
  });
  const first = ui.message('[campaign] Chapter 1 shared victory for 2 kingdoms');
  await new Promise(resolve => setImmediate(resolve));
  const aborted = fixture.transactions[0];aborted.requests[0].onsuccess();
  await Promise.resolve();assert.match(ui.progress.textContent, /Saving chapter/);
  aborted.error = new Error('disk full');aborted.onabort();await first;
  assert.match(ui.progress.textContent, /disk full/);assert.equal(ui.db.closed, true);
  ui.stop();const retry = ui.retry.click();await new Promise(resolve => setImmediate(resolve));
  const committed = fixture.transactions[1];assert.deepEqual(committed.requests[0].args, [true, 1]);
  committed.requests[0].onsuccess();await Promise.resolve();assert.match(ui.progress.textContent, /Saving chapter/);
  committed.oncomplete();await retry;
  assert.match(ui.progress.textContent, /completion saved locally/);assert.ok(ui.connections.every(db => db.closed));
  assert.equal(ui.retry.hidden, true);assert.equal(fixture.transactions.length, 2);
});

test('next chapter appears only after committed victory and preserves profile, relay and shared rules', async () => {
  const fixture=transactionFixture();
  const ui=session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=1&relay=wss%3A%2F%2Fexample.com%2Frooms',{
    dbFactory(){return {...fixture.db,close(){}};},commit:completion
  });
  const onward=ui.elements.filter(e=>e.tag==='a')[1];
  assert.equal(onward.hidden,true);
  await ui.message('[campaign] Chapter 2 shared victory for 2 kingdoms');
  await ui.message('[campaign] Chapter 1 shared defeat for 2 kingdoms');
  assert.equal(onward.hidden,true);
  const saving=ui.message('[campaign] Chapter 1 shared victory for 2 kingdoms');
  await new Promise(resolve=>setImmediate(resolve));
  const tx=fixture.transactions[0];tx.requests[0].onsuccess();
  await Promise.resolve();assert.equal(onward.hidden,true,'a successful request alone cannot offer travel');
  tx.oncomplete();await saving;
  assert.equal(onward.hidden,false);
  const url=new URL(onward.href);
  assert.equal(url.pathname,'/majesty/');
  assert.equal(url.searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'),'2');
  assert.equal(url.searchParams.get('RECOMP_RULE_INVENTORY_COMPAT'),'1');
  assert.equal(url.searchParams.get('profile'),'alice');
  assert.equal(url.searchParams.get('relay'),'wss://example.com/rooms');
  assert.ok(ui.elements.some(e=>/create or join a new room/.test(e.textContent)));
});
test('failed completion keeps continuation hidden until retry commits, including after runtime failure', async () => {
  const ui=session('?profile=bob&RECOMP_RULE_FRONTIER_CHAPTER=2',{failWrite:true});
  const onward=ui.elements.filter(e=>e.tag==='a')[1];
  await ui.message('[campaign] Chapter 2 shared victory for 2 kingdoms');
  assert.equal(onward.hidden,true);ui.stop();
  ui.failures.write=false;await ui.retry.click();
  assert.equal(onward.hidden,false);
  assert.equal(new URL(onward.href).searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'),'3');
});
test('final chapter returns to campaign review without inventing completion for unplayed chapters', async () => {
  const ui=session('?profile=bob&RECOMP_RULE_FRONTIER_CHAPTER=4&relay=ws%3A%2F%2Flocalhost%3A8002');
  await ui.message('[campaign] Chapter 4 shared victory for 2 kingdoms');
  const onward=ui.elements.filter(e=>e.tag==='a')[1],url=new URL(onward.href);
  assert.equal(onward.hidden,false);assert.equal(onward.textContent,'Review campaign progress');
  assert.equal(url.pathname,'/campaign/');assert.equal(url.searchParams.get('profile'),'bob');
  assert.equal(url.searchParams.get('relay'),'ws://localhost:8002');
  assert.equal(url.searchParams.has('RECOMP_RULE_FRONTIER_CHAPTER'),false);
  assert.deepEqual(ui.writes.map(args=>args[1]),[4]);
});

test('Chapter 3 continues to Wardens without inventing its completion', async () => {
  const ui=session('?profile=bob&RECOMP_RULE_FRONTIER_CHAPTER=3');
  await ui.message('[campaign] Chapter 3 shared victory for 2 kingdoms');
  const onward=ui.elements.filter(e=>e.tag==='a')[1];
  assert.equal(onward.textContent,'Next chapter: Wardens of the Pact');
  assert.equal(new URL(onward.href).searchParams.get('RECOMP_RULE_FRONTIER_CHAPTER'),'4');
  assert.deepEqual(ui.writes.map(args=>args[1]),[3]);
});

test('Wardens building readiness waits for native shared victory before committing progress', async () => {
  const ui=session('?profile=alice&RECOMP_RULE_FRONTIER_CHAPTER=4');
  await ui.message('[campaign] Chapter 4 started with 2 network kingdoms');
  await ui.message('[campaign] Chapter 4 treasury progress: kingdom 1 25000/25000; guild=1 dauros=1 readable=1; kingdom 2 25000/25000; guild=1 dauros=1 readable=1; objective met');
  assert.equal(ui.writes.length,0);
  assert.ok(ui.elements.some(e=>/waiting for the shared result/.test(e.textContent)));
  await ui.message('[campaign] Chapter 4 shared victory for 2 kingdoms');
  assert.deepEqual(ui.writes.map(args=>args[1]),[4]);
  await ui.message('[campaign] Chapter 4 shared victory for 2 kingdoms');
  assert.equal(ui.writes.length,1);
});
test('an invalid manual relay cannot turn a saved victory into a navigation link', async () => {
  const ui=session('?RECOMP_RULE_FRONTIER_CHAPTER=1&relay=https%3A%2F%2Fexample.com');
  await ui.message('[campaign] Chapter 1 shared victory for 2 kingdoms');
  assert.match(ui.progress.textContent,/completion saved locally/);
  assert.equal(ui.elements.filter(e=>e.tag==='a')[1].hidden,true);
  assert.ok(ui.elements.some(e=>/choose a valid relay/.test(e.textContent)));
});
