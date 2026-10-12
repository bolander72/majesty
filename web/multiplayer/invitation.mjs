import {chapters, chapterURL, selectedProfile, validateProfile} from '../campaign/progress.mjs';
import {cooperativeWorldSettings} from './cooperative-world.mjs';
import {validateResumeContext, parseResumeToken} from './resume-checkpoint.mjs';

const worldFlags = ['COOP_REGION_GENERATION', 'COOP_FRESH_GENERATION',
  'COOP_TRANSITION_PAUSE', 'COOP_CHECKPOINT', 'COOP_SHARED_READ'];

function worldRules(world, region, chapter) {
  const query = new URLSearchParams({RECOMP_RULE_COOP_WORLD: world,
    RECOMP_RULE_COOP_REGION: region, RECOMP_RULE_FRONTIER_CHAPTER: chapter});
  for (const flag of worldFlags) query.set(`RECOMP_RULE_${flag}`, 'v1');
  if (!cooperativeWorldSettings(query)) throw new Error('Use a shared world name of up to 40 lowercase letters, numbers or hyphens and a valid region.');
  return query;
}

function one(query, key, fallback = '') {
  const values = query.getAll(key);
  if (values.length > 1) throw new Error(`Use only one ${key} setting.`);
  return values[0] ?? fallback;
}

export function roomName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 _'-]{0,23}$/.test(value))
    throw new Error('Use a room name of up to 24 letters, numbers, spaces, apostrophes, underscores or hyphens.');
  return value;
}

export function settings(value, base) {
  const mode = value.mode || 'coop', role = value.role || 'host';
  if (!['coop', 'competitive'].includes(mode)) throw new Error('Choose co-op or competitive play.');
  if (!['host', 'guest'].includes(role)) throw new Error('Choose host or guest.');
  let chapter = null;
  if (mode === 'coop') {
    if (!/^[1234]$/.test(String(value.chapter ?? 1))) throw new Error('Choose a campaign chapter.');
    chapter = Number(value.chapter ?? 1);
  } else if (value.chapter !== null && value.chapter !== undefined && value.chapter !== '') {
    throw new Error('Competitive play cannot select a co-op chapter.');
  }
  const site = new URL(base);
  if (!['http:', 'https:'].includes(site.protocol)) throw new Error('Open the game on an HTTP or HTTPS site.');
  if (site.username || site.password) throw new Error('Use a game site address without embedded credentials.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname);
  const defaultRelay = new URL('/rooms', site);
  defaultRelay.protocol = site.protocol === 'https:' ? 'wss:' : 'ws:';
  if (local) defaultRelay.port = '8002';
  const relay = new URL(value.relay || defaultRelay.href);
  if (!['ws:', 'wss:'].includes(relay.protocol) || relay.username || relay.password || relay.hash)
    throw new Error('Use a ws:// or wss:// relay URL without credentials or a fragment.');
  if (site.protocol === 'https:' && relay.protocol !== 'wss:') throw new Error('An HTTPS game site needs a wss:// relay.');
  const selected = {mode, role, chapter, room: roomName(value.room), relay: relay.href};
  if (value.world !== undefined && value.world !== '') {
    if (mode !== 'coop' || typeof value.world !== 'string') throw new Error('Shared world travel requires co-op play.');
    selected.world = value.world; selected.region = value.region ?? '0_0';
    worldRules(selected.world, selected.region, chapter);
  } else if (value.region !== undefined && value.region !== '') {
    throw new Error('A shared region requires a shared world name.');
  }
  if (value.resume !== undefined && value.resume !== '') {
    validateResumeContext(value.resume, selected);
    selected.resume = value.resume;
  }
  return selected;
}

export function selectedInvitation(search) {
  const query = new URLSearchParams(search);
  const version = one(query, 'invite', '1');
  if (version !== '1') throw new Error('This invitation version is unsupported.');
  return {mode: one(query, 'mode', 'coop'), chapter: one(query, 'chapter') || null,
    room: one(query, 'room'), relay: one(query, 'relay'), role: one(query, 'role', 'host'),
    world: one(query, 'world'), region: one(query, 'region'), resume: one(query, 'resume'),
    profile: selectedProfile(search), hasProfile: query.has('profile')};
}

// Serialize shared session settings explicitly. Never copy the host's profile,
// debug flags, solo restore parameters, passwords or unrelated URL contents.
// A shared co-op world carries its explicitly selected initial coordinate.
export function invitationURL(base, value) {
  const selected = settings(value, base), url = new URL('../multiplayer/', base);
  url.searchParams.set('invite', '1');
  url.searchParams.set('mode', selected.mode);
  if (selected.chapter !== null) url.searchParams.set('chapter', selected.chapter);
  if (selected.world) {
    url.searchParams.set('world', selected.world);
    url.searchParams.set('region', selected.region);
  }
  if (selected.resume) url.searchParams.set('resume', selected.resume);
  url.searchParams.set('room', selected.room);
  url.searchParams.set('relay', selected.relay);
  url.searchParams.set('role', 'guest');
  return url;
}

export function gameURL(base, value, profile = '') {
  const selected = settings(value, base);
  validateProfile(profile);
  const url = selected.mode === 'coop' ? chapterURL(selected.chapter, base, profile, selected.relay) : new URL('../majesty/', base);
  if (profile) url.searchParams.set('profile', profile);
  url.searchParams.set('relay', selected.relay);
  url.searchParams.set('mode', selected.mode);
  url.searchParams.set('room', selected.room);
  url.searchParams.set('role', selected.role);
  const initialRegion = selected.resume ? parseResumeToken(selected.resume).initialRegion : selected.region;
  if (selected.world) for (const [key, value] of worldRules(selected.world, initialRegion, selected.chapter))
    url.searchParams.set(key, value);
  if (selected.resume) url.searchParams.set('RECOMP_COOP_RESUME', selected.resume);
  return url;
}

export function modeLabel(selected) {
  return selected.mode === 'coop' ? `Co-op chapter ${selected.chapter}: ${chapters[selected.chapter - 1].name}` : 'Competitive skirmish';
}

export function localSite(base) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname);
}
