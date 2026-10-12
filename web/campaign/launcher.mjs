import {chapters, openProgress, completion, resetCompletion, selectedProfile, chapterURL} from './progress.mjs';
import {campaignWorldContext,worldNavigationURL} from '../multiplayer/navigation.mjs';

const notice = document.querySelector('#notice');
const profileInput = document.querySelector('#profile');
const relay = document.querySelector('#relay');
const query = new URLSearchParams(location.search);
profileInput.value = query.get('profile') || '';
relay.value = query.get('relay') || '';
let profile, profileError, db, worldContext, worldError;
try { profile = selectedProfile(location.search); }
catch (error) { profileError = error; notice.textContent = error.message; }
try{worldContext=campaignWorldContext(location.search,location.href);}
catch(error){worldError=error;notice.textContent=error.message;}
const worldReturn=document.querySelector('#world-return');
if(worldContext&&!profileError){
  worldReturn.href=worldNavigationURL(location.href,worldContext,profile).href;
  worldReturn.textContent=`Shared world setup: ${worldContext.world} · region ${worldContext.region.replace('_',', ')}`;
  worldReturn.hidden=false;
}
document.querySelector('#profile-state').textContent = profileError ?
  'Choose a valid local profile before playing.' :
  `Local save profile: ${profile || 'Default'}. Chapter completion is separate for each profile. No game login is required.`;

document.querySelector('#profile-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!profileInput.reportValidity()) return;
  const url = new URL(location.href);
  url.searchParams.delete('profile');
  if (profileInput.value) url.searchParams.set('profile', profileInput.value);
  url.searchParams.delete('relay');
  if (relay.value) url.searchParams.set('relay', relay.value);
  location.assign(url.href);
});

if (!profileError) {
  try { db = await openProgress(profile); }
  catch (error) { notice.textContent = `Progress storage unavailable: ${error.message}`; }
}
addEventListener('pagehide', () => db?.close(), {once: true});
const chapterLinks=[], completedChapters=[];
const campaignState=document.querySelector('#campaign-state'), continueLink=document.querySelector('#continue');
let recommendedChapter;
function updateRecommendation(){
  continueLink.hidden=true;recommendedChapter=undefined;
  if(completedChapters.length!==chapters.length||completedChapters.some(value=>value===null)){
    campaignState.textContent='Local progress is unavailable. Choose a chapter below.';return;
  }
  const next=completedChapters.indexOf(false);
  if(next===-1){campaignState.textContent=`All ${chapters.length} chapters completed locally. Choose a chapter below to replay with your partner.`;return;}
  recommendedChapter=next+1;
  campaignState.textContent=`${completedChapters.filter(Boolean).length} of ${chapters.length} chapters completed locally.`;
  continueLink.textContent=`${recommendedChapter===1?'Start campaign':'Continue campaign'}: ${chapters[next].name}`;
  continueLink.hidden=false;
}
for (const [i, chapter] of chapters.entries()) {
  const article = document.createElement('article'), heading = document.createElement('h2');
  const p = document.createElement('p'), state = document.createElement('output'), a = document.createElement('a');
  heading.textContent = `${i + 1}. ${chapter.name}`;
  p.textContent = chapter.goal;
  let completed = null;
  try { if (db) completed = await completion(db, i + 1); }
  catch (error) { notice.textContent = `Progress could not be read: ${error.message}`; }
  completedChapters.push(completed);
  state.textContent = completed ? 'Completed locally' : completed===false ? 'Ready to play' : 'Progress unavailable';
  a.textContent = 'Play this chapter'; a.className = 'play';
  chapterLinks.push(a);
  article.append(heading, p, state, document.createElement('p'), a);
  document.querySelector('#chapters').append(article);
  if (completed) {
    const reset = article.appendChild(document.createElement('button'));
    reset.textContent = `Reset chapter ${i + 1} completion`;
    reset.onclick = async () => {
      reset.disabled = true;
      try { await resetCompletion(db, i + 1); completedChapters[i]=false; state.textContent = 'Ready to play'; reset.remove(); updateRecommendation(); updateLinks(); }
      catch (error) { reset.disabled = false; notice.textContent = `Progress could not be reset: ${error.message}`; }
    };
  }
}
updateRecommendation();
function updateLinks() {
  let relayError;
  try { chapterURL(1, location.href, '', relay.value); }
  catch { relayError = 'Use a ws:// or wss:// relay URL.'; }
  relay.setCustomValidity(relayError || '');
  const links=chapterLinks.map((a,i)=>[a,i+1]);
  if(recommendedChapter)links.push([continueLink,recommendedChapter]);
  for (const [a, number] of links) {
    a.setAttribute('aria-disabled', String(!!(profileError || relayError || worldError)));
    if (profileError || relayError || worldError) { a.removeAttribute('href'); continue; }
    a.href = worldContext?worldNavigationURL(location.href,{...worldContext,relay:relay.value||worldContext.relay},profile,'multiplayer',number).href:
      chapterURL(number, location.href, profile, relay.value).href;
  }
  if(worldContext){
    worldReturn.setAttribute('aria-disabled',String(!!(profileError||relayError||worldError)));
    if(profileError||relayError||worldError)worldReturn.removeAttribute('href');
    else worldReturn.href=worldNavigationURL(location.href,{...worldContext,relay:relay.value||worldContext.relay},profile).href;
  }
}
relay.addEventListener('input', updateLinks);
updateLinks();
