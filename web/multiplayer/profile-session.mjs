import {selectedProfile} from '../campaign/progress.mjs';
import {cooperativeWorldSettings} from './cooperative-world.mjs';
import {validateResumeContext} from './resume-checkpoint.mjs';

// Profiles belong to this machine, not the network roster. Peers on different
// machines may use the same name; two local engines must not write one profile.
export function multiplayerProfileConfig(search) {
  const query = new URLSearchParams(search);
  const selected = [...query].some(([key]) =>
    ['room', 'mode', 'role', 'RECOMP_RULE_FRONTIER_CHAPTER'].includes(key) ||
    key.startsWith('RECOMP_RULE_COOP_'));
  if (!selected) return null;
  const profile = selectedProfile(search);
  if (query.has('RECOMP_PROFILE_DIR')) throw Error('Multiplayer requires its selected local save profile.');
  if (query.has('world') || [...query].some(([key]) =>
      key.startsWith('RECOMP_RULE_FRONTIER_') && key !== 'RECOMP_RULE_FRONTIER_CHAPTER' ||
      key.startsWith('RECOMP_BROWSER_FRONTIER_') || key.startsWith('RECOMP_FRONTIER_HERO_')))
    throw Error('Shared multiplayer worlds cannot use solo region startup settings.');
  for (const key of new Set([...query.keys()])) {
    if ((['room', 'mode', 'role', 'relay', 'RECOMP_RULE_FRONTIER_CHAPTER', 'RECOMP_COOP_RESUME'].includes(key) ||
        key.startsWith('RECOMP_RULE_COOP_')) && query.getAll(key).length !== 1)
      throw Error(`Use only one ${key} setting.`);
  }
  if (query.has('RECOMP_COOP_RESUME')) {
    if (!profile) throw Error('Choose a named local profile to resume a shared world.');
    const resumed = cooperativeWorldSettings(query);
    if (!resumed || query.get('mode') !== 'coop' ||
        query.getAll('RECOMP_RULE_INVENTORY_COMPAT').length !== 1 ||
        query.get('RECOMP_RULE_INVENTORY_COMPAT') !== '1')
      throw Error('A resume checkpoint requires complete shared-world settings.');
    validateResumeContext(query.get('RECOMP_COOP_RESUME'), {
      world: query.get('RECOMP_RULE_COOP_WORLD'), region: `${resumed.region.x}_${resumed.region.y}`,
      chapter: query.get('RECOMP_RULE_FRONTIER_CHAPTER')});
  }
  return Object.freeze({profile, lock: `majesty-native-profile:majesty:${profile}`});
}

// Start under the lease before content hashing, OPFS sync, GPU or WASM setup.
// Injection commits ownership for the document lifetime. Startup failures and
// pagehide never prove that an injected engine's workers have stopped writing.
export async function startMultiplayerProfilePlayer(start, {
  search = location.search, locks = navigator.locks, events = window,
} = {}) {
  if (typeof start !== 'function') throw Error('Invalid multiplayer player startup.');
  const config = multiplayerProfileConfig(search);
  if (!config) return start();
  if (!locks || typeof locks.request !== 'function' ||
      !events || typeof events.addEventListener !== 'function' || typeof events.removeEventListener !== 'function')
    throw Error('Multiplayer profile storage locking unavailable.');
  let closing = false;
  const hide = () => { closing = true; };
  events.addEventListener('pagehide', hide);
  let reportFailure;
  const failure = new Promise((_, reject) => { reportFailure = reject; });
  try {
    const lease = locks.request(config.lock, {mode: 'exclusive', ifAvailable: true}, async lock => {
      if (!lock) throw Error('Local save profile busy; choose another profile or close its other multiplayer game.');
      if (closing) return;
      let injected = false, preparing = true;
      const retain = () => {
        if (!preparing || closing || injected) throw Error('Multiplayer profile injection is no longer available.');
        injected = true;
        events.removeEventListener('pagehide', hide);
      };
      try {
        await start(config.profile, retain);
        if (!injected) throw Error('Multiplayer player did not retain its profile before native injection.');
      } catch (error) {
        if (!injected) throw error;
        reportFailure(error);
      } finally { preparing = false; }
      await new Promise(() => {});
    });
    return await Promise.race([lease, failure]);
  } finally { events.removeEventListener('pagehide', hide); }
}
