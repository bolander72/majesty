import {settings, invitationURL, modeLabel, localSite} from './invitation.mjs';
import {cooperativeWorldSettings} from './cooperative-world.mjs';

const query = new URLSearchParams(location.search);
if (query.has('room') || query.has('mode') || query.has('RECOMP_RULE_FRONTIER_CHAPTER')) {
  let selected, error;
  try {
    for (const key of ['room', 'mode', 'relay', 'role', 'RECOMP_RULE_FRONTIER_CHAPTER', 'RECOMP_RULE_INVENTORY_COMPAT', 'RECOMP_COOP_RESUME'])
      if (query.getAll(key).length > 1) throw new Error(`Use only one ${key} setting.`);
    const chapter = query.get('RECOMP_RULE_FRONTIER_CHAPTER');
    const mode = chapter ? 'coop' : query.get('mode') || 'competitive';
    const world = cooperativeWorldSettings(query);
    if (chapter && query.has('mode') && query.get('mode') !== 'coop') throw new Error('This invitation mixes co-op and competitive settings.');
    for (const [key, value] of query) {
      if (!key.startsWith('RECOMP_RULE_')) continue;
      if (key === 'RECOMP_RULE_FRONTIER_CHAPTER' || (chapter && key === 'RECOMP_RULE_INVENTORY_COMPAT' && value === '1')) continue;
      if (world && /^RECOMP_RULE_COOP_(REGION_GENERATION|FRESH_GENERATION|TRANSITION_PAUSE|CHECKPOINT|SHARED_READ|WORLD|REGION)$/.test(key)) continue;
      throw new Error('This session has custom rules. Match those rules with your partner before joining.');
    }
    if (chapter && query.get('RECOMP_RULE_INVENTORY_COMPAT') !== '1')
      throw new Error('Open this chapter through Campaign chapters to share its current rule settings.');
    // A campaign launched directly may not have created/named its room yet.
    selected = settings({mode, chapter, role: query.get('role') || 'host',
      room: query.get('room') || 'Majesty', relay: query.get('relay') || '', resume: query.get('RECOMP_COOP_RESUME') || '',
      ...(world ? {world: query.get('RECOMP_RULE_COOP_WORLD'), region: `${world.region.x}_${world.region.y}`} : {})}, location.href);
  } catch (failure) { error = failure.message; }
  const panel = document.body.appendChild(document.createElement('details'));
  panel.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);box-sizing:border-box;max-width:min(360px,calc(100vw - 16px));max-height:40vh;overflow:auto;padding:10px 14px;background:#162425ef;color:#eee8d0;border:1px solid #9da882;border-radius:6px;font:13px system-ui';
  panel.open = Boolean(query.get('room') || error);
  panel.appendChild(document.createElement('summary')).textContent = 'Multiplayer invitation';
  const title = panel.appendChild(document.createElement('p'));
  title.textContent = selected ? modeLabel(selected) : 'Invitation unavailable';
  const status = panel.appendChild(document.createElement('output'));status.setAttribute('role', 'status');
  if (localSite(location.href)) panel.appendChild(document.createElement('p')).textContent =
    'For a partner on another computer, use a game site and relay they can reach before sharing this invitation.';
  const input = panel.appendChild(document.createElement('input'));
  input.readOnly = true;input.setAttribute('aria-label', 'Invitation link');
  input.style.cssText = 'box-sizing:border-box;width:100%;margin:8px 0;padding:8px';
  const copy = panel.appendChild(document.createElement('button'));copy.type = 'button';copy.textContent = 'Copy invitation';
  copy.style.cssText = 'min-height:44px;padding:8px 12px';
  let current = '', copying = false, stopped = false, roomSupported = true;
  function refresh() {
    current = !stopped && roomSupported && selected && query.get('room') ? invitationURL(location.href, selected).href : '';
    input.value = current;input.hidden = !current;copy.disabled = !current || copying;
  }
  status.textContent = error || (query.get('room') ?
    selected.role === 'guest' ? `Join “${selected.room}” through Multiplayer → Play Over LAN (TCP/IP).` :
      `Create a room named “${selected.room}” through Multiplayer → Play Over LAN (TCP/IP).` :
    'Create or join a multiplayer room to get its invitation.');
  refresh();
  copy.addEventListener('click', async () => {
    if (!current || copying) return;
    const invitation = current;copying = true;copy.disabled = true;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(invitation);
      status.textContent = stopped ? 'Session ended. Start a new room to invite your partner again.' :
        invitation === current ? 'Invitation copied. Your partner selects this room in the game lobby.' : 'Room changed. Copy its updated invitation.';
    } catch { status.textContent = 'Select and copy the invitation from the link field.'; }
    finally { copying = false;refresh(); }
  });
  document.addEventListener('recomp-runtime-message', event => {
    if (event.detail === '[network] Session connection lost' || event.detail === '[network] Session receive queue overflow') {
      stopped = true;refresh();status.textContent = 'Session ended. Start a new room to invite your partner again.';return;
    }
    if (stopped || !selected || typeof event.detail !== 'string' || event.detail.length > 512) return;
    const match = /^\[network\] (Created|Joined) room (.+) \([0-9]{1,2} players\)$/.exec(event.detail);
    if (!match) return;
    try {
      selected = settings({...selected, room: match[2], role: match[1] === 'Joined' ? 'guest' : 'host'}, location.href);
      roomSupported = true;
      query.set('room', selected.room);
      status.textContent = `${match[1]} “${selected.room}”. Guest chooses Ready; host chooses Start Game.`;
      refresh();
    } catch { roomSupported = false;refresh();status.textContent = 'Room joined. Share its name with your partner in the game lobby.'; }
  });
  document.addEventListener('recomp-match-state', event => {
    if (event.detail?.state === 'playing') panel.open = false;
  });
  document.addEventListener('recomp-runtime-state', event => {
    if (event.detail?.state !== 'failed') return;
    stopped = true;refresh();status.textContent = 'Game stopped. Reload before starting another room.';
  });
}
