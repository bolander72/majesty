import {chapters,openProgress,completion,selectedProfile,chapterURL} from './progress.mjs';
import {engineWorldContext,worldNavigationURL,resumedWorldContext} from '../multiplayer/navigation.mjs';
import {treasuryProgress,treasuryText} from './objective-progress.mjs';
const query=new URLSearchParams(location.search),mode=query.get('RECOMP_RULE_FRONTIER_CHAPTER');
if(/^[1234]$/.test(mode||'')){
 const number=Number(mode),chapter=chapters[number-1];
 const panel=document.body.appendChild(document.createElement('aside'));
 panel.style.cssText='position:fixed;bottom:8px;right:8px;max-width:min(380px,90vw);padding:10px 14px;background:#162425ef;color:#eee8d0;border:1px solid #9da882;border-radius:6px;font:13px system-ui;pointer-events:none';
 const title=panel.appendChild(document.createElement('strong'));title.textContent=`Chapter ${number}: ${chapter.name}`;
 const goal=panel.appendChild(document.createElement('p'));goal.textContent=chapter.goal;goal.style.margin='6px 0';
 const treasury=panel.appendChild(document.createElement('p'));
 treasury.hidden=true;treasury.style.margin='6px 0';
 treasury.setAttribute('aria-label','Reported kingdom treasuries');
 const state=panel.appendChild(document.createElement('output'));state.setAttribute('role','status');state.textContent='Create or join a room with another player on this chapter.';
 let profile,profileError,worldContext;
 try{profile=selectedProfile(location.search);}catch(error){profileError=error;}
 try{worldContext=engineWorldContext(location.search,location.href);}catch{worldContext=null;}
 const profileLabel=panel.appendChild(document.createElement('p'));
 profileLabel.textContent=profileError?profileError.message:`Local save profile: ${profile||'Default'}`;
 profileLabel.style.margin='6px 0';
 let back,worldSetup;
 if(!profileError){
   back=panel.appendChild(document.createElement('a'));
   const url=new URL('../campaign/',location.href);
   if(profile)url.searchParams.set('profile',profile);
   if(query.get('relay'))url.searchParams.set('relay',query.get('relay'));
   back.href=worldContext?worldNavigationURL(location.href,worldContext,profile,'campaign').href:url.href;
   back.textContent='Campaign chapters';back.style.cssText='display:block;color:#d7db9c;pointer-events:auto';
   if(worldContext){
     worldSetup=panel.appendChild(document.createElement('a'));
     worldSetup.href=worldNavigationURL(location.href,worldContext,profile).href;
     worldSetup.textContent='Shared world setup';worldSetup.style.cssText='display:block;color:#d7db9c;pointer-events:auto';
   }
 }
 // A confirmed victory can be saved after the game/transport stops. Keep one
 // attempt in flight, and retry failures explicitly without replaying gameplay.
 let victory=false,saved=false,saving=null;
 const progress=panel.appendChild(document.createElement('output'));
 progress.setAttribute('role','status');progress.hidden=true;
 progress.style.cssText='margin-top:6px';
 const retry=panel.appendChild(document.createElement('button'));
 retry.type='button';retry.textContent='Retry local save';retry.hidden=true;retry.disabled=true;
 retry.style.cssText='margin-top:8px;pointer-events:auto';
 const onward=panel.appendChild(document.createElement('a'));
 onward.hidden=true;onward.style.cssText='margin-top:8px;color:#d7db9c;pointer-events:auto';
 const onwardNote=panel.appendChild(document.createElement('p'));
 onwardNote.hidden=true;onwardNote.style.margin='6px 0';
 function showContinuation(){
   try{
     if(number<chapters.length){
       onward.href=worldContext?worldNavigationURL(location.href,worldContext,profile,'multiplayer',number+1).href:
         chapterURL(number+1,location.href,profile,query.get('relay')||'').href;
       onward.textContent=`Next chapter: ${chapters[number].name}`;
       onwardNote.textContent=worldContext?
         'The next chapter starts new kingdoms. Your setup is retained; choose a new world name to preserve this chapter’s saved regions. Both players must join the new room.':
         'Both players choose the next chapter, then create or join a new room. Each chapter starts a new kingdom.';
     }else{
       const url=new URL('../campaign/',location.href);
       if(profile)url.searchParams.set('profile',profile);
       if(query.get('relay'))url.searchParams.set('relay',query.get('relay'));
       onward.href=worldContext?worldNavigationURL(location.href,worldContext,profile,'campaign').href:url.href;
       onward.textContent='Review campaign progress';
       onwardNote.textContent='This is the final chapter. You can return to finish or replay any chapter.';
     }
     onward.hidden=false;onward.style.display='block';onwardNote.hidden=false;
   }catch{
     // The completion is still saved if a manually supplied relay is invalid.
     onwardNote.textContent='Return to Campaign chapters and choose a valid relay to continue.';
     onwardNote.hidden=false;
   }
 }
 function saveVictory(){
   if(!victory||saved)return Promise.resolve();
   if(saving)return saving;
   progress.hidden=false;progress.style.display='block';progress.textContent='Shared victory. Saving chapter completion…';
   retry.hidden=true;retry.disabled=true;
   saving=(async()=>{
     let db;
     try{
       if(profileError)throw profileError;
       db=await openProgress(profile);await completion(db,number,true);
       saved=true;progress.textContent='Shared victory. Chapter completion saved locally.';
       showContinuation();
     }catch(error){
       progress.textContent=`Shared victory. Progress could not be saved: ${error.message}`;
       retry.hidden=!!profileError;retry.disabled=!!profileError;
     }finally{db?.close();}
   })().finally(()=>{saving=null;});
   return saving;
 }
 retry.addEventListener('click',saveVictory);
 let pendingSurrender=false,confirmSurrender=false;
 let stopped=false,matchState;
 function publishMatchState(next){
   if(matchState===next)return;
   matchState=next;document.dispatchEvent(new CustomEvent('recomp-match-state',{detail:{state:next}}));
 }
 const surrender=panel.appendChild(document.createElement('button'));
 surrender.textContent='Surrender together';surrender.disabled=true;
 surrender.style.cssText='display:block;margin-top:8px;pointer-events:auto';
 function clearSharedActions(){
   pendingSurrender=false;confirmSurrender=false;surrender.disabled=true;
   surrender.textContent='Surrender together';
 }
 document.addEventListener('recomp-runtime-state',event=>{
   if(event.detail?.state!=='failed')return;
   stopped=true;clearSharedActions();
   if(matchState!=='finished')publishMatchState('interrupted');
   state.textContent='Game stopped; shared actions are unavailable.';
 });
 surrender.addEventListener('click',()=>{
   if(stopped||surrender.disabled||matchState!=='playing')return;
   if(!confirmSurrender){confirmSurrender=true;surrender.textContent='Confirm shared defeat';return;}
   pendingSurrender=true;surrender.disabled=true;surrender.textContent='Surrender requested';
 });
 document.addEventListener('recomp-action-poll',event=>{
   if(!stopped&&matchState==='playing'&&event.detail?.name==='frontier-surrender'&&pendingSurrender){
     pendingSurrender=false;event.detail.pending=true;
   }
 });
 document.addEventListener('recomp-runtime-message',async event=>{
   if(stopped)return;
   const line=event.detail;
   if(worldContext){
     try{
       const nextContext=resumedWorldContext(worldContext,line,location.href);
       if(nextContext!==worldContext){
         worldContext=nextContext;
         if(back)back.href=worldNavigationURL(location.href,worldContext,profile,'campaign').href;
         if(worldSetup)worldSetup.href=worldNavigationURL(location.href,worldContext,profile).href;
       }
     }catch{ /* A malformed runtime line must not alter the last admitted setup. */ }
   }
   if(line==='[network] Session connection lost'||line==='[network] Session receive queue overflow'){
     // Connection loss is terminal for this panel: later queued campaign
     // messages cannot re-enable commands or establish an unconfirmed result.
     // An already confirmed victory keeps its independent storage retry.
     stopped=true;clearSharedActions();
     if(matchState!=='finished')publishMatchState('interrupted');
     state.textContent='Session ended; shared actions are unavailable. Reload to create or join a new room.';
     return;
   }
   if(typeof line!=='string'||!line.startsWith('[campaign]'))return;
   const pendingResult = new RegExp(`^\\[campaign\\] Chapter ${number} shared result pending (victory|defeat) for [2-4] kingdoms$`).exec(line);
   if(pendingResult){
     clearSharedActions();publishMatchState('ending');
     state.textContent=`Shared ${pendingResult[1]} is being settled by the game.`;
     return;
   }
   if(matchState==='ending'&&!new RegExp(`^\\[campaign\\] Chapter ${number} shared (victory|defeat) for [2-4] kingdoms$`).test(line))return;
   const balance=treasuryProgress(line,number);
   if(balance){
     if(matchState!=='playing')return;
     const text=treasuryText(balance);
     if(treasury.textContent!==text)treasury.textContent=text;
     treasury.hidden=false;
     state.textContent=balance.ready
       ? (number===4?'All buildings and treasuries ready; waiting for the shared result.':'All treasuries ready; waiting for the shared result.')
       : (number===4?'Complete both required buildings and gather gold in each allied kingdom.':'Gather gold in each allied kingdom.');
     return;
   }
   state.textContent=line.slice(11);
   if(new RegExp(`^\\[campaign\\] Chapter ${number} (started|restored) with [2-4] network kingdoms$`).test(line)){
     confirmSurrender=false;pendingSurrender=false;surrender.disabled=false;surrender.textContent='Surrender together';
     publishMatchState('playing');
   }
   if(new RegExp(`^\\[campaign\\] Chapter ${number} shared (victory|defeat) for [2-4] kingdoms$`).test(line)){
     clearSharedActions();
     publishMatchState('finished');
   }
   if(new RegExp(`^\\[campaign\\] Chapter ${number} shared victory for [2-4] kingdoms$`).test(line)&&!victory){
     victory=true;await saveVictory();
   }
 });
}
