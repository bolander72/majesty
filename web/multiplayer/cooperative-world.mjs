import {parseResumeToken, resumeLabel} from './resume-checkpoint.mjs';

const directions = ['west', 'east', 'north', 'south'];
const flags = ['COOP_REGION_GENERATION', 'COOP_FRESH_GENERATION',
  'COOP_TRANSITION_PAUSE', 'COOP_CHECKPOINT', 'COOP_SHARED_READ'];

export function cooperativeWorldSettings(search) {
  const query = new URLSearchParams(search);
  if (!query.has('RECOMP_RULE_COOP_FRESH_GENERATION')) return null;
  for (const flag of flags) {
    const key = `RECOMP_RULE_${flag}`;
    if (query.getAll(key).length !== 1 || query.get(key) !== 'v1') return null;
  }
  if (query.getAll('RECOMP_RULE_COOP_REGION').length !== 1 ||
      query.getAll('RECOMP_RULE_COOP_WORLD').length !== 1 ||
      !/^[a-z0-9-]{1,40}$/.test(query.get('RECOMP_RULE_COOP_WORLD') || '') ||
      query.getAll('RECOMP_RULE_FRONTIER_CHAPTER').length !== 1 ||
      !/^[1-4]$/.test(query.get('RECOMP_RULE_FRONTIER_CHAPTER') || '')) return null;
  const region = coordinate(query.get('RECOMP_RULE_COOP_REGION'));
  if (!region) return null;
  const chapter = Number(query.get('RECOMP_RULE_FRONTIER_CHAPTER'));
  if (query.has('RECOMP_COOP_RESUME')) {
    if (query.getAll('RECOMP_COOP_RESUME').length !== 1) return null;
    try {
      const saved = parseResumeToken(query.get('RECOMP_COOP_RESUME'));
      if (saved.world !== query.get('RECOMP_RULE_COOP_WORLD') || saved.chapter !== chapter ||
          saved.initialRegion !== `${region.x}_${region.y}`) return null;
      return {region:{x:saved.x,y:saved.y},initialRegion:region,chapter};
    } catch { return null; }
  }
  return {region, chapter};
}
// Present the verified token's immutable file name; lobby ordering is unrelated
// to checkpoint recency. This reminder grants no gameplay authority.
export function hostResumeReminder(search) {
  const query = new URLSearchParams(search);
  if (query.getAll('role').length !== 1 || query.get('role') !== 'host' ||
      !query.has('RECOMP_COOP_RESUME') || !cooperativeWorldSettings(search)) return null;
  const saved = parseResumeToken(query.get('RECOMP_COOP_RESUME'));
  return {revision: saved.revision, label: resumeLabel(saved),
    text: `Checkpoint ${saved.revision}: choose Load Game → “${resumeLabel(saved)}”.`};
}

function coordinate(value) {
  if (!/^(0|-?[1-9]\d*)_(0|-?[1-9]\d*)$/.test(value || '')) return null;
  const [x, y] = value.split('_').map(Number);
  return [x, y].every(n => Number.isSafeInteger(n) && Math.abs(n) <= 1000000) ? {x, y} : null;
}

// UI authority comes from the joined-room announcement. The engine separately
// verifies the exact host, party and settled pause before accepting any action.
export class CooperativeWorldControls {
  constructor(settings) {
    this.region = settings.region;
    this.initialRegion = settings.initialRegion ?? settings.region;
    this.chapter = settings.chapter;
    this.host = false; this.playing = false; this.busy = false; this.stopped = false;
    this.pending = null; this.canceled = null;
    this.saving = false; this.pauseEpoch = null; this.saved = null;
    this.guestPaused = null;
    this.recoverable = false; this.room = null;
    this.ending = false;
    this.status = 'Create or join a co-op room. The host chooses when to travel.';
  }
  get canTravel() { return this.host && this.playing && !this.busy && !this.canceled && !this.stopped; }
  request(direction, now) {
    if (!this.canTravel || !directions.includes(direction) || !Number.isSafeInteger(now)) return false;
    this.pending = {action: `coop-travel-${direction}`, expires: now + 10000};
    this.busy = true; this.status = `Requesting travel ${direction}…`;
    return true;
  }
  requestSave(now) {
    if (!this.canTravel || !Number.isSafeInteger(now)) return false;
    this.pending = {action: 'coop-transition-pause', expires: now + 10000};
    this.saving = true; this.pauseEpoch = null; this.saved = null;
    this.busy = true; this.status = 'Requesting a shared pause and checkpoint…';
    return true;
  }
  consume(action, now) {
    if (this.stopped || !this.pending || action !== this.pending.action || !Number.isSafeInteger(now)) return false;
    const pending = this.pending; this.pending = null;
    if (now >= pending.expires) {
      this.busy = false; this.saving = false; this.status = 'Request expired. You can try again.';
      return false;
    }
    this.status = this.saving ? 'Waiting for both kingdoms to pause before saving…' : 'Saving the current region before travel…';
    return true;
  }
  expire(now) {
    // The original result dialog can stop action polling. An unconsumed
    // request still has its original deadline; it must not wait forever or
    // become a save confirmation. Consumed native pauses are left alone.
    if (this.stopped || !this.pending || !Number.isSafeInteger(now) || now < this.pending.expires) return false;
    this.recoverable = true;
    this.saving = false; this.pauseEpoch = null; this.saved = null;
    this.stop('The game did not acknowledge the request. No new checkpoint was confirmed. Close this game to check the last committed checkpoint. Later unsaved moves are not included.');
    return true;
  }
  stop(message) {
    this.stopped = true; this.playing = false; this.busy = false; this.pending = null; this.canceled = null;
    this.status = message;
  }
  receive(line) {
    if (typeof line !== 'string' || line.length > 512 || this.stopped) return;
    const result = new RegExp(`^\\[campaign\\] Chapter ${this.chapter} shared (victory|defeat) for [2-4] kingdoms$`).exec(line);
    if (result) {
      this.ending = false;
      this.recoverable = result[1] === 'defeat';
      this.stop(this.recoverable
        ? 'Shared defeat. Close this game to check the last committed checkpoint. Later unsaved moves are not included.'
        : 'Chapter finished. Choose the next chapter to continue.');
      return;
    }
    const pendingResult = new RegExp(`^\\[campaign\\] Chapter ${this.chapter} shared result pending (victory|defeat) for [2-4] kingdoms$`).exec(line);
    if (pendingResult) {
      this.ending = true; this.playing = false; this.busy = true; this.pending = null;
      this.saving = false; this.pauseEpoch = null; this.saved = null; this.guestPaused = null;
      this.recoverable = pendingResult[1] === 'defeat';
      this.status = this.recoverable
        ? 'The game is settling a shared defeat. No new checkpoint was confirmed. Close this game to check the last committed checkpoint.'
        : 'The game is settling a shared victory. Saving and travel are unavailable until the result finishes.';
      return;
    }
    if (this.ending) return;
    // The original lobby permits an empty native session name. Creation still
    // identifies its host; the engine independently checks command authority.
    const joined = /^\[network\] (Created|Joined) room (.*) \([0-4] players\)$/.exec(line);
    if (joined) { this.host = joined[1] === 'Created'; this.room = joined[2]; }
    if (!this.playing && !this.busy &&
        new RegExp(`^\\[campaign\\] Chapter ${this.chapter} (started|restored) with [2-4] network kingdoms$`).test(line)) {
      this.playing = true; this.busy = false;
      this.status = this.host ? 'Both kingdoms are playing. Choose a neighboring region.' : 'Both kingdoms are playing. The host chooses the next region.';
    }
    if (line.startsWith('[coop-transition] Pause requested') || line.startsWith('[coop-load] Ready')) {
      this.busy = true; this.status = this.saving ? 'Waiting for the shared pause and native save…' : 'Kingdoms paused. Preparing shared travel…';
    }
    const paused = /^\[coop-transition\] Paused epoch=([1-9]\d*) owner=\d+ frame=(\d+) clock=(\d+)$/.exec(line);
    if (paused && this.saving && !this.pending) {
      this.pauseEpoch = {epoch: paused[1], frame: paused[2], clock: paused[3]};
      this.saved = null; this.busy = true;
    }
    const checkpoint = /^\[coop-transition\] Checkpoint epoch=([1-9]\d*) revision=([1-9]\d*) frame=(\d+) clock=(\d+) bytes=([1-9]\d*) digest=([a-f0-9]{64})$/.exec(line);
    if (checkpoint && this.saving && checkpoint[1] === this.pauseEpoch?.epoch &&
        checkpoint[3] === this.pauseEpoch.frame && checkpoint[4] === this.pauseEpoch.clock) {
      this.saved = {epoch: checkpoint[1], revision: checkpoint[2], frame: checkpoint[3],
        clock: checkpoint[4], bytes: checkpoint[5], sha256: checkpoint[6]};
      this.saving = false;
      this.status = 'Checkpoint saved. Close this game to prepare a resume invitation. Both players must rejoin before continuing.';
    }
    const guestPaused = /^\[coop-transition\] Guest paused epoch=([1-9]\d*) owner=([1-9]\d*) frame=(\d+) clock=(\d+)$/.exec(line);
    if (guestPaused && !this.host && this.playing) {
      this.guestPaused = {epoch: guestPaused[1], frame: guestPaused[3], clock: guestPaused[4]};
      this.busy = true;
      this.status = 'Shared game paused. Wait for the host to confirm the saved checkpoint, then close this game and ask for a resume invitation.';
    }
    const guestResumed = /^\[coop-transition\] Guest resumed epoch=([1-9]\d*)$/.exec(line);
    if (guestResumed && guestResumed[1] === this.guestPaused?.epoch) {
      this.guestPaused = null; this.busy = false;
      this.status = 'Both kingdoms are playing. The host chooses the next region.';
    }
    if (line.startsWith('[coop-load] Attached') || line.startsWith('[coop-load] Loaded')) {
      this.saved = null; this.pauseEpoch = null; this.guestPaused = null;
      this.busy = true; this.status = 'Region loaded. Waiting for both kingdoms to resume…';
    }
    const resumed = /^\[coop-load\] Resumed epoch=\d+ serial=\d+ region=(.+)$/.exec(line);
    if (resumed && !this.canceled) {
      const region = coordinate(resumed[1]);
      if (region) {
        this.saved = null; this.pauseEpoch = null; this.guestPaused = null;
        this.region = region; this.playing = true; this.busy = false; this.pending = null;
        this.status = 'Both kingdoms resumed in this region.';
      }
    }
    const canceled = /^\[coop-load\] (?:Canceled|Unavailable) epoch=([1-9]\d*) serial=([1-9]\d*) source=(.+)$/.exec(line);
    if (canceled && this.playing && !this.canceled) {
      const region = coordinate(canceled[3]);
      if (region && region.x === this.region.x && region.y === this.region.y) {
        this.canceled = {epoch: canceled[1], serial: canceled[2]};
        this.pending = null; this.busy = true;
        this.status = 'Travel canceled. Waiting for both kingdoms to resume here…';
      }
    }
    const sourceResumed = /^\[coop-load\] Source resumed epoch=([1-9]\d*) serial=([1-9]\d*) region=(.+)$/.exec(line);
    if (sourceResumed && this.canceled && sourceResumed[1] === this.canceled.epoch &&
        sourceResumed[2] === this.canceled.serial) {
      const region = coordinate(sourceResumed[3]);
      if (region && region.x === this.region.x && region.y === this.region.y) {
        this.canceled = null; this.busy = false; this.pending = null;
        this.status = 'Travel canceled. Both kingdoms resumed in this region.';
      }
    }
    if (line.startsWith('[coop-transition] Request refused')) {
      this.pending = null; this.busy = false; this.saving = false; this.pauseEpoch = null;
      this.status = line.startsWith('[coop-transition] Request refused stage=saved-world ')
        ? 'Travel is blocked to protect saved progress. Choose a new world name for a fresh game.'
        : line.startsWith('[coop-transition] Request refused stage=readback ')
        ? 'Travel is unavailable while playing a replay.'
        : 'Travel is unavailable in the current game state.';
    }
    if (line.startsWith('[coop-transition] Proposal refused') || line.startsWith('[coop-transition] Checkpoint refused')) {
      this.pending = null; this.busy = true; this.saving = false;
      if (!this.canceled) this.status = 'Saving or travel stopped while the kingdoms were paused. No new resume checkpoint was confirmed.';
    }
    if (line === '[network] Session connection lost' || line === '[network] Session receive queue overflow') {
      this.recoverable = true;
      this.stop(this.host
        ? 'Connection ended. Close this game to recover the last committed checkpoint. Later unsaved moves are not included.'
        : 'Connection ended. Close this game and ask the host for a new resume invitation. Later unsaved moves are not included.');
    }
    if (line.startsWith('[coop-load] Rejected') || line.startsWith('[coop-transfer] Rejected'))
      this.stop('Shared travel stopped. Rejoin a room before continuing.');
    if (line.startsWith('[coop-resume] Refused '))
      this.stop('The selected save could not be verified as this world’s checkpoint. Close the game and prepare its resume file again.');
    if (line === '[coop-resume] Waiting for partner before loading') {
      this.playing = false; this.busy = false; this.pending = null;
      this.status = 'Waiting for your partner to join and choose Ready. The host can then choose Start Game.';
    }
  }
}

// Resolve the latest committed save after releasing the engine, rather than
// replaying an old launch token. Guest recovery never promotes a guest to host.
export function cooperativeRecoveryURL(base, controls) {
  const original = new URL(base), query = original.searchParams;
  const url = new URL(controls.host ? '../multiplayer/resume.html' : '../multiplayer/reconnect.html', original);
  url.search = original.search;
  url.searchParams.delete('RECOMP_COOP_RESUME');
  url.searchParams.set('RECOMP_RESUME_REGION', `${controls.region.x}_${controls.region.y}`);
  url.searchParams.set('role', controls.host ? 'host' : 'guest');
  const room = controls.room || query.get('room');
  if (room) url.searchParams.set('room', room);
  return url;
}

if (typeof document !== 'undefined' && /\/majesty\/(?:index\.html)?$/.test(location.pathname)) {
  const settings = cooperativeWorldSettings(location.search);
  if (settings) {
    const controls = new CooperativeWorldControls(settings);
    const panel = document.body.appendChild(document.createElement('details'));
    panel.setAttribute('aria-label', 'Co-op world'); panel.open = true;
    panel.style.cssText = 'position:fixed;top:40px;right:8px;z-index:20;box-sizing:border-box;width:min(360px,calc(100vw - 16px));max-height:40dvh;overflow:auto;padding:10px 14px;background:#162425ef;color:#eee8d0;border:1px solid #9da882;border-radius:6px;font:13px system-ui';
    panel.addEventListener('toggle', () => {
      panel.style.width = panel.open ? 'min(360px,calc(100vw - 16px))' : 'max-content';
      panel.style.maxWidth = 'calc(100vw - 16px)';
    });
    const title = panel.appendChild(document.createElement('summary'));
    const status = panel.appendChild(document.createElement('p')); status.setAttribute('role', 'status');
    const buttons = panel.appendChild(document.createElement('div'));
    buttons.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px';
    const items = directions.map(direction => {
      const button = buttons.appendChild(document.createElement('button'));
      button.type = 'button'; button.textContent = `Travel ${direction}`;
      button.style.cssText = 'min-height:44px;padding:8px';
      button.addEventListener('click', () => { if (controls.request(direction, Date.now())) armRequestDeadline(); refresh(); });
      return button;
    });
    const save = buttons.appendChild(document.createElement('button'));
    save.type = 'button'; save.textContent = 'Save and pause';
    save.style.cssText = 'grid-column:1/-1;min-height:44px;padding:8px';
    save.addEventListener('click', () => { if (controls.requestSave(Date.now())) armRequestDeadline(); refresh(); });
    items.push(save);
    const resume = panel.appendChild(document.createElement('a'));
    resume.textContent = 'Close game and prepare resume'; resume.hidden = true;
    resume.style.cssText = 'margin-top:10px;color:#eee8d0';
    const requestedResume = hostResumeReminder(location.search);
    const reminder = requestedResume ? panel.appendChild(document.createElement('p')) : null;
    if (reminder) {
      reminder.setAttribute('role', 'note');
      reminder.textContent = requestedResume.text;
      reminder.style.cssText = 'overflow-wrap:anywhere';
    }
    let lastTitle, lastStatus, lastEnabled;
    let requestTimer = null;
    function armRequestDeadline() {
      if (requestTimer !== null) clearTimeout(requestTimer);
      const pending = controls.pending;
      if (!pending) { requestTimer = null; return; }
      requestTimer = setTimeout(() => {
        requestTimer = null;
        if (controls.expire(Date.now())) refresh();
        else if (controls.pending === pending) armRequestDeadline();
      }, Math.max(0, pending.expires - Date.now()));
    }
    function refresh() {
      if (!controls.pending && requestTimer !== null) { clearTimeout(requestTimer); requestTimer = null; }
      const showReminder = requestedResume && !controls.playing && !controls.stopped && !controls.ending;
      if (reminder && reminder.hidden === Boolean(showReminder)) reminder.hidden = !showReminder;
      const nextTitle = showReminder ? `Resume checkpoint ${requestedResume.revision}`
        : `Co-op region ${controls.region.x}, ${controls.region.y}`;
      if (lastTitle !== nextTitle) title.textContent = lastTitle = nextTitle;
      if (lastStatus !== controls.status) status.textContent = lastStatus = controls.status;
      const hideResume = !controls.saved && !controls.recoverable && !controls.guestPaused;
      if (resume.hidden !== hideResume) resume.hidden = hideResume;
      if (controls.saved || controls.recoverable || controls.guestPaused) {
        const nextHref = cooperativeRecoveryURL(location.href, controls).href;
        if (resume.href !== nextHref) resume.href = nextHref;
        if (controls.guestPaused && !controls.host) {
          resume.textContent = 'Close game and request resume invitation';
          if (!panel.open) panel.open = true;
        }
        if (controls.recoverable) {
          const nextText = controls.host ? 'Close game and recover checkpoint' : 'Close game and request resume invitation';
          if (resume.textContent !== nextText) resume.textContent = nextText;
          if (!panel.open) panel.open = true;
          // The player has already created its session-ended overlay before
          // dispatching this event. Replace its stale same-URL reload action.
          const overlay = document.getElementById?.('status');
          for (const link of overlay?.querySelectorAll('a') || []) {
            if (link.textContent === 'Reload game') {
              link.href = resume.href; link.textContent = controls.host ? 'Recover saved world' : 'Request resume invitation';
            }
          }
        }
      }
      if (lastEnabled !== controls.canTravel) {
        lastEnabled = controls.canTravel;
        for (const button of items) button.disabled = !lastEnabled;
      }
    }
    document.addEventListener('recomp-runtime-message', event => { controls.receive(event.detail); refresh(); });
    document.addEventListener('recomp-action-poll', event => {
      if (!controls.pending || event.detail?.name !== controls.pending.action) return;
      if (controls.consume(event.detail?.name, Date.now())) event.detail.pending = true;
      refresh();
    });
    document.addEventListener('recomp-runtime-state', event => {
      if (event.detail?.state === 'failed') { controls.stop('Game stopped. Reload before continuing.'); refresh(); }
    });
    addEventListener('pagehide', () => {
      controls.stop('Session closed.');
      if (requestTimer !== null) clearTimeout(requestTimer);
      requestTimer = null;
    });
    refresh();
  }
}
