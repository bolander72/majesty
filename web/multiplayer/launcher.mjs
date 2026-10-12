import {selectedInvitation, settings, invitationURL, gameURL, modeLabel, localSite} from './invitation.mjs';
import {parseResumeToken, resumeLabel} from './resume-checkpoint.mjs';
import {worldNavigationURL} from './navigation.mjs';

const ids = ['setup', 'mode', 'chapter', 'chapter-field', 'world', 'world-field', 'region-x', 'region-y', 'world-chapter-note', 'role', 'room', 'relay', 'profile', 'selection', 'instructions', 'play', 'copy', 'invite-url', 'status', 'reachability', 'campaign-progress'];
const ui = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
let incomingError, previousWorld = '', previousChapter = null, incomingResume = '';
try {
  const incoming = selectedInvitation(location.search);
  if (!incoming.room) {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    incoming.room = 'Majesty-' + Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  }
  const selected = settings(incoming, location.href);
  incomingResume = selected.resume || '';
  for (const key of ['mode', 'role', 'room', 'relay']) ui[key].value = selected[key];
  if (selected.world) ui.mode.value = 'world';
  ui.chapter.value = String(selected.chapter || 1);
  ui.world.value = selected.world || '';
  const [x,y] = (selected.region || '0_0').split('_');
  ui['region-x'].value = x; ui['region-y'].value = y;
  previousWorld = selected.world || '';
  const sourceChapters = new URLSearchParams(location.search).getAll('worldChapter');
  if(sourceChapters.length>1 || (sourceChapters.length && !/^[1234]$/.test(sourceChapters[0])))
    throw new Error('Use one valid original world chapter.');
  previousChapter = sourceChapters.length ? Number(sourceChapters[0]) : selected.chapter;
  ui.profile.value = incoming.hasProfile ? incoming.profile : selected.role === 'guest' ? 'multiplayer-guest' : 'multiplayer-host';
} catch (error) { incomingError = error; }

ui.reachability.textContent = localSite(location.href) ?
  'This game address points to this machine. For a partner on another computer, use a game site and relay they can reach before copying the invitation.' :
  'Your partner needs access to this game site and the selected relay, with the same game build and imported content.';

let currentInvitation = '', copying = false;
function update() {
  currentInvitation = '';ui.copy.disabled = true;ui['invite-url'].value = '';
  ui.play.removeAttribute('href');ui.play.setAttribute('aria-disabled', 'true');
  ui['campaign-progress'].removeAttribute('href');ui['campaign-progress'].setAttribute('aria-disabled','true');
  ui['chapter-field'].hidden = ui.mode.value === 'competitive';
  const expanding = ui.mode.value === 'world';
  ui['world-field'].hidden = !expanding; ui.world.required = expanding;
  ui['region-x'].disabled = ui['region-y'].disabled = !expanding;
  try {
    if (incomingError) throw incomingError;
    if (expanding && !ui.world.value) throw new Error('Choose a shared world name before opening the game.');
    let region;
    if(expanding){
      const values=[ui['region-x'].value,ui['region-y'].value];
      if(!values.every(value=>/^(0|-?[1-9]\d*)$/.test(value)))
        throw new Error('Use whole starting-region coordinates between -1,000,000 and 1,000,000.');
      region=values.join('_');
    }
    const selected = settings({mode: expanding ? 'coop' : ui.mode.value, role: ui.role.value,
      chapter: ui.mode.value !== 'competitive' ? ui.chapter.value : null,
      room: ui.room.value, relay: ui.relay.value,
      resume: incomingResume,
      ...(expanding ? {world: ui.world.value, region} : {})}, location.href);
    const game = gameURL(location.href, selected, ui.profile.value);
    const progress = selected.world ? worldNavigationURL(location.href,
      {...selected,worldChapter:previousWorld===selected.world ? previousChapter : selected.chapter},
      ui.profile.value,'campaign') : new URL('../campaign/',location.href);
    if(!selected.world){
      if(ui.profile.value)progress.searchParams.set('profile',ui.profile.value);
      progress.searchParams.set('relay',selected.relay);
    }
    ui['campaign-progress'].href=progress.href;
    ui['campaign-progress'].setAttribute('aria-disabled','false');
    if(expanding && previousWorld===ui.world.value && previousChapter!==null && previousChapter!==Number(ui.chapter.value))
      throw new Error('This chapter starts new kingdoms. Choose a new world name to preserve the earlier chapter’s regions.');
    ui.play.href = game.href;
    ui.play.setAttribute('aria-disabled', 'false');
    ui.play.textContent = selected.role === 'host' ? 'Open game to host' : 'Open game to join';
    ui.selection.textContent = selected.world ? `Expanding world · ${selected.world}` : modeLabel(selected);
    ui.instructions.textContent = selected.role === 'host' ?
      `Choose Multiplayer → Play Over LAN (TCP/IP) → Accept, then Create Game. Name your room “${selected.room}” and send your partner the invitation.` :
      `Choose Multiplayer → Play Over LAN (TCP/IP) → Accept, then select “${selected.room}” in the room list and Join Game.`;
    if (selected.resume) {
      const label = resumeLabel(parseResumeToken(selected.resume));
      ui.instructions.textContent += selected.role === 'host'
        ? ` Load Game → “${label}”. Wait for your partner to join and choose Ready before Start Game.`
        : ' The host loads the saved world. Choose Ready after its file transfer completes; the host then starts both kingdoms together.';
    }
    currentInvitation = invitationURL(location.href, selected).href;
    ui['invite-url'].value = currentInvitation;
    ui.copy.disabled = copying;
    ui.status.textContent = 'Ready. Room creation and joining happen in the game lobby.';
  } catch (error) { ui.status.textContent = error.message; }
}
ui.setup.addEventListener('submit', event => event.preventDefault());
ui.setup.addEventListener('input', () => { incomingError = null;update(); });
ui.setup.addEventListener('change', () => { incomingError = null;update(); });
ui.copy.addEventListener('click', async () => {
  if (!currentInvitation || copying) return;
  const invitation = currentInvitation;copying = true;ui.copy.disabled = true;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Copy the invitation from the link field below.');
    await navigator.clipboard.writeText(invitation);
    ui.status.textContent = invitation === currentInvitation ? 'Invitation copied. Send it to your partner.' : 'Previous invitation copied. Copy again to share the updated settings.';
  } catch { ui.status.textContent = 'Select and copy the invitation from the link field below.'; }
  finally { copying = false;ui.copy.disabled = !currentInvitation; }
});
update();
