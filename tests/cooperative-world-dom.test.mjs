import test from 'node:test';
import assert from 'node:assert/strict';

test('a save with no further engine polling reaches recovery through one bounded timer', async () => {
  class Element extends EventTarget {
    constructor(tag) { super(); this.tag = tag; this.children = []; this.style = {}; }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute() {}
  }
  const document = new EventTarget(); document.body = new Element('body');
  document.createElement = tag => new Element(tag);
  const query = new URLSearchParams({RECOMP_RULE_COOP_REGION_GENERATION:'v1', RECOMP_RULE_COOP_FRESH_GENERATION:'v1',
    RECOMP_RULE_COOP_TRANSITION_PAUSE:'v1', RECOMP_RULE_COOP_CHECKPOINT:'v1', RECOMP_RULE_COOP_SHARED_READ:'v1',
    RECOMP_RULE_COOP_WORLD:'test-world', RECOMP_RULE_COOP_REGION:'0_0', RECOMP_RULE_FRONTIER_CHAPTER:'1', profile:'alice'});
  const names = ['document','location','addEventListener','setTimeout','clearTimeout'];
  const original = Object.fromEntries(names.map(key => [key, Object.getOwnPropertyDescriptor(globalThis,key)]));
  const oldNow = Date.now, timers = new Map(); let now = 1000, serial = 0;
  try {
    globalThis.document=document;
    globalThis.location={pathname:'/majesty/',href:'http://localhost:8000/majesty/?'+query,search:query.toString()};
    globalThis.addEventListener=()=>{};
    globalThis.setTimeout=(fn,delay)=>{const id=++serial;timers.set(id,{fn,delay});return id;};
    globalThis.clearTimeout=id=>timers.delete(id); Date.now=()=>now;
    await import('../web/multiplayer/cooperative-world.mjs?unpolled-deadline-test');
    const emit=(name,detail)=>{const e=new Event(name);e.detail=detail;document.dispatchEvent(e);return detail;};
    emit('recomp-runtime-message','[network] Created room quiet (0 players)');
    emit('recomp-runtime-message','[campaign] Chapter 1 restored with 2 network kingdoms');
    const panel=document.body.children[0], buttons=panel.children[2].children, resume=panel.children[3];
    buttons[4].dispatchEvent(new Event('click'));
    assert.equal(timers.size,1); assert.equal(buttons[4].disabled,true);
    const [id,timer]=[...timers][0]; assert.equal(timer.delay,10000);
    now=11000;timers.delete(id);timer.fn();
    assert.equal(timers.size,0);assert.equal(resume.hidden,false);
    assert.match(panel.children[1].textContent,/No new checkpoint was confirmed/);
    const url=new URL(resume.href);assert.equal(url.pathname,'/multiplayer/resume.html');
    assert.equal(url.searchParams.get('profile'),'alice');assert.equal(url.searchParams.get('role'),'host');
    assert.equal(emit('recomp-action-poll',{name:'coop-transition-pause',pending:false}).pending,false);
  } finally {
    Date.now=oldNow;
    for(const [key,descriptor] of Object.entries(original)) {
      if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
    }
  }
});

test('idle action polling and unchanged runtime messages perform no DOM writes', async () => {
  let writes = 0;
  class Element extends EventTarget {
    constructor(tag) { super(); this.tag = tag; this.children = []; this.style = {}; }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute() {}
    set textContent(value) { this.text = value; writes++; }
    get textContent() { return this.text; }
    set disabled(value) { this.inactive = value; writes++; }
    get disabled() { return this.inactive; }
  }
  const document = new EventTarget();
  document.body = new Element('body');
  document.createElement = tag => new Element(tag);
  const query = new URLSearchParams({
    RECOMP_RULE_COOP_REGION_GENERATION: 'v1', RECOMP_RULE_COOP_FRESH_GENERATION: 'v1',
    RECOMP_RULE_COOP_TRANSITION_PAUSE: 'v1', RECOMP_RULE_COOP_CHECKPOINT: 'v1',
    RECOMP_RULE_COOP_SHARED_READ: 'v1', RECOMP_RULE_COOP_WORLD: 'test-world',
    RECOMP_RULE_COOP_REGION: '0_0', RECOMP_RULE_FRONTIER_CHAPTER: '1'
  });
  const original = Object.fromEntries(['document', 'location', 'addEventListener'].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try {
    globalThis.document = document;
    globalThis.location = {pathname:'/majesty/',href:'http://localhost:8000/majesty/?'+query,search: query.toString()};
    globalThis.addEventListener = () => {};
    await import('../web/multiplayer/cooperative-world.mjs?dom-test');
    const emit = (name, detail) => {
      const event = new Event(name); event.detail = detail;
      document.dispatchEvent(event); return detail;
    };
    const panel = document.body.children[0], buttons = panel.children[2].children;
    const baseline = writes;
    for (let i = 0; i < 1000; i++) {
      emit('recomp-action-poll', {name: 'coop-travel-east', pending: false});
      emit('recomp-runtime-message', '[network] Waiting for packets');
    }
    assert.equal(writes, baseline);
    emit('recomp-runtime-message', '[network] Created room  (0 players)');
    emit('recomp-runtime-message', '[campaign] Chapter 1 started with 2 network kingdoms');
    assert.equal(buttons[1].disabled, false);
    buttons[1].dispatchEvent(new Event('click'));
    assert.equal(buttons[1].disabled, true);
    const queued = writes;
    for (let i = 0; i < 1000; i++) emit('recomp-action-poll', {name: 'coop-travel-west', pending: false});
    assert.equal(writes, queued);
    assert.equal(emit('recomp-action-poll', {name: 'coop-travel-east', pending: false}).pending, true);
    const consumed = writes;
    assert.equal(emit('recomp-action-poll', {name: 'coop-travel-east', pending: false}).pending, false);
    assert.equal(writes, consumed);
    emit('recomp-runtime-message', '[network] Session connection lost');
    const ended = writes;
    for (let i = 0; i < 1000; i++) emit('recomp-runtime-message', '[network] Waiting for packets');
    assert.equal(writes, ended, 'idle messages must not rewrite recovery controls');
    emit('recomp-runtime-state', {state: 'failed'});
    assert.equal(buttons[1].disabled, true);
    assert.equal(emit('recomp-action-poll', {name: 'coop-travel-east', pending: false}).pending, false);
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
