import {settings, invitationURL, selectedInvitation} from './invitation.mjs';
import {cooperativeWorldSettings} from './cooperative-world.mjs';
import {validateProfile} from '../campaign/progress.mjs';

// These are personal navigation links. Shared invitations still exclude profiles.
export function engineWorldContext(search, base) {
  const query = new URLSearchParams(search);
  if (!query.has('RECOMP_RULE_COOP_WORLD')) return null;
  const rules=new Set(['RECOMP_RULE_FRONTIER_CHAPTER','RECOMP_RULE_INVENTORY_COMPAT',
    'RECOMP_RULE_COOP_WORLD','RECOMP_RULE_COOP_REGION','RECOMP_RULE_COOP_REGION_GENERATION',
    'RECOMP_RULE_COOP_FRESH_GENERATION','RECOMP_RULE_COOP_TRANSITION_PAUSE',
    'RECOMP_RULE_COOP_CHECKPOINT','RECOMP_RULE_COOP_SHARED_READ']);
  if([...query.keys()].some(key=>key.startsWith('RECOMP_RULE_')&&!rules.has(key)))
    throw new Error('This world uses additional gameplay settings. Its setup cannot be recreated by this launcher.');
  const admitted = cooperativeWorldSettings(search);
  if (!admitted || query.getAll('RECOMP_RULE_INVENTORY_COMPAT').length !== 1 ||
      query.get('RECOMP_RULE_INVENTORY_COMPAT') !== '1')
    throw new Error('The shared world settings are incomplete. Return to multiplayer setup.');
  const one = (key, fallback='') => {
    const values=query.getAll(key);
    if(values.length>1)throw new Error(`Use only one ${key} setting.`);
    return values[0] ?? fallback;
  };
  if(one('mode','coop')!=='coop')throw new Error('Shared worlds require co-op play.');
  return settings({mode:'coop',chapter:admitted.chapter,world:one('RECOMP_RULE_COOP_WORLD'),
    region:`${admitted.region.x}_${admitted.region.y}`,role:one('role','host'),
    room:one('room','Majesty'),relay:one('relay'),resume:one('RECOMP_COOP_RESUME')},base);
}

export function campaignWorldContext(search, base) {
  const query=new URLSearchParams(search);
  if(!query.has('world'))return null;
  const selected=settings(selectedInvitation(search),base);
  const previous=query.getAll('worldChapter');
  if(previous.length>1 || (previous.length && !/^[1234]$/.test(previous[0])))
    throw new Error('Use one valid original world chapter.');
  return {...selected,worldChapter:previous.length ? Number(previous[0]) : selected.chapter};
}

export function worldNavigationURL(base, context, profile='', destination='multiplayer', chapter=context.chapter) {
  validateProfile(profile);
  if(!['campaign','multiplayer'].includes(destination))throw new Error('Invalid world navigation destination.');
  const selected=settings({...context,chapter,resume:chapter===context.chapter ? context.resume : ''},base);
  if(!selected.world)throw new Error('Choose a shared world for world navigation.');
  // Reuse invitation's validated shared field serialization, then restore this
  // player's role/profile. No diagnostic flags or arbitrary queries are copied.
  const url=invitationURL(base,selected);
  url.pathname=new URL(`../${destination}/`,base).pathname;
  url.searchParams.delete('invite');url.searchParams.set('role',selected.role);
  url.searchParams.set('worldChapter',String(context.worldChapter ?? context.chapter));
  if(profile)url.searchParams.set('profile',profile);
  return url;
}

export function resumedWorldContext(context, line, base) {
  if(!context || typeof line!=='string' || line.length>512)return context;
  const resume=/^\[coop-load\] Resumed epoch=\d+ serial=\d+ region=(.+)$/.exec(line);
  if(resume)return settings({...context,region:resume[1],resume:''},base);
  const room=/^\[network\] (Created|Joined) room (.+) \([0-4] players\)$/.exec(line);
  if(room)return settings({...context,room:room[2],role:room[1]==='Created'?'host':'guest'},base);
  return context;
}
