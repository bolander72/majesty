export const chapters = [
  {name:'The Frontier Pact', goal:'Keep both allied kingdoms alive for one game day.'},
  {name:'Provision the Expedition', goal:'Each allied kingdom must hold at least 30,100 gold.'},
  {name:'Foundations of the Frontier', goal:'Each allied kingdom must hold at least 35,000 gold.'},
  {name:'Wardens of the Pact', goal:'Each allied kingdom must complete a living Warriors Guild and Temple to Dauros, and hold at least 25,000 gold.'}
];
export function validateProfile(profile) {
  if (typeof profile !== 'string' || (profile !== '' && !/^[a-zA-Z0-9_-]{1,40}$/.test(profile)))
    throw new Error('Use a profile name of up to 40 letters, numbers, underscores or hyphens.');
  return profile;
}
export function selectedProfile(search) {
  const profiles = new URLSearchParams(search).getAll('profile');
  if (profiles.length > 1) throw new Error('Use only one local save profile.');
  return validateProfile(profiles[0] ?? '');
}
function validateChapter(chapter) {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > chapters.length)
    throw new Error('Invalid campaign chapter.');
}
export function chapterURL(chapter, base, profile = '', relay = '') {
  validateChapter(chapter); validateProfile(profile);
  const url = new URL('../majesty/', base);
  url.searchParams.set('RECOMP_RULE_FRONTIER_CHAPTER', chapter);
  url.searchParams.set('RECOMP_RULE_INVENTORY_COMPAT', '1');
  if (profile) url.searchParams.set('profile', profile);
  if (relay) {
    if (!['ws:', 'wss:'].includes(new URL(relay).protocol)) throw new Error('Use a ws:// or wss:// relay URL.');
    url.searchParams.set('relay', relay);
  }
  return url;
}
export async function openProgress(profile = '', storage = globalThis.indexedDB) {
  validateProfile(profile);
  if (!storage) throw new Error('This browser lacks campaign progress storage.');
  return new Promise((resolve,reject)=>{
    // Keep all legacy origin-wide completions in the default profile. Named
    // profiles start independently; never guess which one earned old progress.
    const name = 'majesty-frontier-campaign-v1' + (profile ? `-profile-${profile}` : '');
    let abandoned = false;
    const r=storage.open(name,1);
    r.onupgradeneeded=()=>r.result.createObjectStore('chapters');
    r.onsuccess=()=>{
      const db = r.result;
      if (abandoned) { db.close(); return; }
      db.onversionchange=()=>db.close();
      resolve(db);
    };
    r.onerror=()=>reject(r.error || new Error('Campaign storage could not be opened.'));
    r.onblocked=()=>{abandoned=true;reject(new Error('Close older campaign tabs before opening this profile.'));};
  });
}
export async function completion(db,chapter,write=false){
  validateChapter(chapter);
  return new Promise((resolve,reject)=>{
    const t=db.transaction('chapters',write?'readwrite':'readonly');
    const r=write?t.objectStore('chapters').put(true,chapter):t.objectStore('chapters').get(chapter);
    let result;r.onsuccess=()=>{result=r.result;};
    t.oncomplete=()=>resolve(write?true:result===true);t.onabort=()=>reject(t.error||new Error('Campaign storage failed'));
  });
}
export async function resetCompletion(db,chapter){
  validateChapter(chapter);
  return new Promise((resolve,reject)=>{
    const t=db.transaction('chapters','readwrite');t.objectStore('chapters').delete(chapter);
    t.oncomplete=resolve;t.onabort=()=>reject(t.error||new Error('Campaign storage failed'));
  });
}
