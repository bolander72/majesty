import {selectedRegion, atlasURL, neighboringRegionURL} from './region.mjs';
import {selectedWorld} from './world-name.mjs';
import {recordJourney,recordJourneyArrival} from './journey.mjs';
import {checkNativeDestination} from './native-destination.mjs';
import {nativeRegionSessionMode,advanceNativeWorldRegion,confirmNativeHeroGameReady,queueNativeHeroGameSave,publishNativeHeroGameSave,endNativeHeroGameSave,prepareNativeHeroTravelArrival,stageNativeHeroTravelArrival,stageNativeHeroTravelDeparture,confirmNativeHeroTravelDeparture,publishNativeHeroTravelArrival,confirmNativeHeroTravelResume,restoreNativeHeroTravelHome,stageNativeHeroTravelGeneration,confirmNativeHeroGenerationDeparture,prepareNativeHeroGeneratedArrival} from './realm-session.mjs';
import {NativeRegionSession} from './native-session-controls.mjs';
import {completedHeroRestoreURL,nativeHeroRestoreConfig} from './hero-route-launch.mjs';
import {NativeHeroSaveSession} from './hero-save-session.mjs';
let region,error,world,sessionMode,heroConfig;
try{region=selectedRegion(location.search);world=selectedWorld(location.search);sessionMode=nativeRegionSessionMode(location.search);heroConfig=nativeHeroRestoreConfig(location.search);}catch(e){error=e.message;region=null;}
if(region||error){
 const session=sessionMode?new NativeRegionSession(region,`/opfs/majesty/profile/native-world-${world}`):null;
 const panel=document.body.appendChild(document.createElement('aside'));
 panel.style.cssText='position:fixed;bottom:8px;right:8px;max-width:min(360px,90vw);max-height:calc(100dvh - 16px);overflow:auto;box-sizing:border-box;padding:10px 14px;background:#162425ef;color:#eee8d0;border:1px solid #9da882;border-radius:6px;font:13px system-ui;pointer-events:none';
 const details=panel.appendChild(document.createElement('details'));
 details.style.pointerEvents='auto';details.open=Boolean(error);
 const title=details.appendChild(document.createElement('summary'));title.textContent=region?`Frontier region ${region.x}, ${region.y}`:'Frontier region unavailable';
 const automatic=region&&new URLSearchParams(location.search).get('RECOMP_RULE_FRONTIER_RESTORE')==='1';
 const jointCheckpoint=new URLSearchParams(location.search).get('RECOMP_RULE_FRONTIER_TRANSFER')==='1';
 const help=details.appendChild(document.createElement('p'));help.textContent=error||(automatic?'Your saved kingdom will resume automatically. If this region has no checkpoint, start a game here.':`Start a game here, or use Load Game to restore ${region.checkpoint}.`);
 const state=details.appendChild(document.createElement('output'));state.setAttribute('role','status');state.textContent=error||'Waiting for a single-player game.';
 let pending=false,inFlight=false,accepted=false,playable=false,networkBlocked=false,departure=null,departing=false,stopped=false,finished=false,hasCheckpoint=false,exitsWanted=true,menu,atlas,resume;
 const neighbors=[];
 let lifecycleRevision=0,arrivalAttempted=false,arrival=Promise.resolve(),checking=null,pageGone=false;
 let heroSession=null,heroController=null,heroToken=0,heroJob=null,heroDestination=null,heroError=null;
 let heroCrossing=null,heroContinue=null,heroTravel=null,heroRetryArrival=null,heroArrival=null;
 let heroGenerated=null,heroRetryGeneration=null,heroArrivalWaiting=null;
 function prepareGeneratedHero(transition){
   if(pageGone||stopped||heroJob!==null)return;
   const controller=heroController;heroGenerated=transition;heroError=null;
   state.textContent='New kingdom ready. Preparing your hero’s arrival…';
   const job=Promise.resolve().then(()=>prepareNativeHeroGeneratedArrival(world,transition.serial,transition.request,transition.line,
     {layout:'halo-v1',signal:controller.signal})).then(async prepared=>{
       if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
       heroSession.acceptGeneratedPreparation(prepared);
       await stageNativeHeroTravelArrival(world,transition.serial,prepared,{signal:controller.signal});
       if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
       heroGenerated=null;state.textContent='Arrival prepared. Waiting for your hero to enter the new kingdom…';
     }).catch(error=>{
       if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
       heroError=error.message;state.textContent=`Arrival preparation unavailable: ${error.message}. Your captured journey is preserved. Retry preparing the arrival.`;
     }).finally(()=>{if(heroJob===job){heroJob=null;refreshControls();
       if(heroArrivalWaiting){const waiting=heroArrivalWaiting;heroArrivalWaiting=null;heroGenerated=null;publishHeroArrival(waiting);}}});
   heroJob=job;refreshControls();
 }
 function completeHeroTravel(transition){
   const receipt=confirmNativeHeroTravelResume(world,transition.serial,transition.request,transition.line);
   const buffered=heroSession.completeTravel(receipt);
   const url=new URL(location.href);url.searchParams.set('RECOMP_RULE_FRONTIER_REGION',receipt.region);
   url.searchParams.set('profile','frontier_'+receipt.region);history.replaceState(null,'',url);
   region=selectedRegion(url.search);++lifecycleRevision;
   heroToken=0;heroCrossing=null;heroArrival=null;heroController=null;heroError=null;heroDestination=null;heroGenerated=null;heroArrivalWaiting=null;
   finished=false;playable=true;hasCheckpoint=true;exitsWanted=false;arrivalAttempted=true;
   if(globalThis.Module?.ENV){globalThis.Module.ENV.RECOMP_FRONTIER_HERO_BINDING=receipt.runtimeBinding;
     globalThis.Module.ENV.RECOMP_FRONTIER_HERO_HALO_BINDING=receipt.haloBinding;
     globalThis.Module.ENV.RECOMP_FRONTIER_HERO_OWNER_MANIFEST=receipt.ownerManifest;}
   updateRegionControls();rememberCurrentRegion();state.textContent='Hero arrived. Journey saved; kingdom active.';
   for(const line of buffered)runtimeMessage({detail:line});
 }
 function publishHeroArrival(transition){
   if(pageGone||stopped)return;
   if(heroJob!==null){heroArrivalWaiting=transition;return;}
   const controller=heroController??new AbortController();heroController=controller;heroArrival=transition;heroError=null;
   state.textContent='Hero loaded. Saving both kingdoms before continuing…';
   const job=Promise.resolve().then(()=>publishNativeHeroTravelArrival(world,transition.serial,transition.request,transition.ready,
     {signal:controller.signal})).then(receipt=>{
       if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
       const resumed=heroSession.acceptTravelPublication(receipt);
       if(resumed)completeHeroTravel(resumed);
       else state.textContent='Journey saved. Waiting for the kingdom to resume…';
     }).catch(error=>{
       if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
       heroError=error.message;state.textContent=`Arrival save unavailable: ${error.message}. Recovery checkpoints are preserved. Retry saving the arrival.`;
     }).finally(()=>{if(heroJob===job){heroJob=null;refreshControls();}});
   heroJob=job;refreshControls();
 }
 function busy(){return pending||inFlight||departing||checking!==null||session?.busy||heroSession?.busy||heroJob!==null;}
 function stopHeroJourney(){
   heroSession?.stop();heroController?.abort();heroDestination=null;heroCrossing=null;heroArrival=null;heroGenerated=null;heroArrivalWaiting=null;
   if(heroToken){
     const serial=heroToken;heroToken=0;
     const ended=endNativeHeroGameSave(world,serial,{abandoned:true}).catch(()=>{});
     const job=ended.finally(()=>{if(heroJob===job){heroJob=null;refreshControls();}});heroJob=job;
   }
 }
 function depart(destination,saved=false){
   departing=true;refreshControls();
   const revision=lifecycleRevision;
   function go(){
     if(pageGone){departing=false;refreshControls();return;}
     if(saved&&(revision!==lifecycleRevision||!playable||stopped||finished||networkBlocked)){departing=false;refreshControls();return;}
     try{location.replace(destination);}
     catch(error){departing=false;refreshControls();state.textContent=`Could not open destination: ${error.message}. Saved checkpoints remain available.`;}
   }
   if(saved&&world){
     state.textContent='Kingdom saved. Remembering your destination…';
     arrival.then(()=>{
       if(revision!==lifecycleRevision||!playable||stopped||finished||networkBlocked)return;
       return recordJourney(destination,{base:location.href,content:globalThis.Module?.ENV?.RECOMP_CONTENT_IDENTITY});
     }).then(go).catch(error=>{
       departing=false;
       if(revision===lifecycleRevision){exitsWanted=true;state.textContent=`Kingdom saved, but travel could not be remembered: ${error.message}. Stay here and retry, or return to Frontier using the link.`;}
       refreshControls();
     });
   }else go();
 }
 function navigate(destination,requiresCheckpoint=false){if(!pageGone&&exitsWanted&&!busy()&&(!requiresCheckpoint||hasCheckpoint))depart(destination);}
 if(region){
   menu=details.appendChild(document.createElement('a'));menu.textContent='Open region menu without restoring';
   menu.style.cssText='display:block;margin:6px 0;color:#eee8d0';
   const destination=new URL(location.href);destination.searchParams.delete('RECOMP_RULE_FRONTIER_RESTORE');menu.href=destination;
   menu.onclick=e=>{e.preventDefault();navigate(menu.href);};
   atlas=details.appendChild(document.createElement('a'));atlas.textContent='Return to Frontier';
   atlas.style.cssText=menu.style.cssText;atlas.href=atlasURL(location.href);
   atlas.onclick=e=>{e.preventDefault();navigate(atlas.href);};
   resume=details.appendChild(document.createElement('a'));resume.textContent='Restore previous checkpoint';
   resume.style.cssText=menu.style.cssText;resume.style.display='none';
   const savedDestination=new URL(location.href);savedDestination.searchParams.set('RECOMP_RULE_FRONTIER_RESTORE','1');resume.href=savedDestination;
   resume.onclick=e=>{e.preventDefault();navigate(resume.href,true);};
 }
 function refreshControls(){
   const blocked=Boolean(!playable||busy()||stopped||finished||jointCheckpoint||networkBlocked||heroConfig&&!heroSession?.enabled);
   save.disabled=leave.disabled=blocked;
   for(const {button,destination} of neighbors)button.disabled=blocked||!destination||Boolean(heroConfig);
   const show=!pageGone&&exitsWanted&&!busy();
   for(const link of [menu,atlas])if(link)link.style.display=show?'block':'none';
   if(resume)resume.style.display=show&&hasCheckpoint?'block':'none';
   if(heroContinue){heroContinue.style.display=heroCrossing?'block':'none';
     heroContinue.disabled=!heroCrossing||heroJob!==null||pageGone||stopped||!heroSession?.enabled||heroSession.travelling;}
   if(heroTravel){const available=heroCrossing?.arrival||heroCrossing?.kind==='new';heroTravel.style.display=available?'block':'none';
     heroTravel.disabled=!available||heroJob!==null||pageGone||stopped||!heroSession?.enabled||heroSession.travelling;}
   if(heroRetryArrival){heroRetryArrival.style.display=heroArrival&&heroError?'block':'none';
     heroRetryArrival.disabled=!heroArrival||!heroError||heroJob!==null||pageGone||stopped;}
   if(heroRetryGeneration){heroRetryGeneration.style.display=heroGenerated&&heroError?'block':'none';
     heroRetryGeneration.disabled=!heroGenerated||!heroError||heroJob!==null||pageGone||stopped;}
 }
 // Native results have no request ID. Drain a consumed request before accepting
 // another, even when a menu/result/loading transition cancels its departure.
 function cancelSave(){++lifecycleRevision;playable=false;pending=false;accepted=false;departure=null;checking?.abort();session?.cancel();heroSession?.cancel();}
 const save=details.appendChild(document.createElement('button')),leave=details.appendChild(document.createElement('button'));
 save.textContent=heroConfig?'Save hero journey':'Save region checkpoint';leave.textContent=heroConfig?'Save journey and return to Frontier':'Save and return to Frontier';
 for(const b of [save,leave]){b.disabled=true;b.style.cssText='display:block;margin-top:8px;pointer-events:auto';}
 if(heroConfig?.haloLayout){
   heroContinue=details.appendChild(document.createElement('button'));
   heroContinue.textContent='Continue in this kingdom';heroContinue.disabled=true;heroContinue.style.cssText=save.style.cssText;heroContinue.style.display='none';
   heroContinue.onclick=()=>{
     if(!heroCrossing||heroJob!==null||pageGone||stopped||!heroSession?.enabled||heroSession.travelling)return;
     heroSession.finish(true);heroCrossing=null;refreshControls();state.textContent='Crossing captured and journey saved. Resuming this kingdom…';
   };
   heroTravel=details.appendChild(document.createElement('button'));
   heroTravel.textContent='Travel to the neighboring kingdom';heroTravel.disabled=true;heroTravel.style.cssText=save.style.cssText;heroTravel.style.display='none';
   heroTravel.onclick=()=>{
     if((!heroCrossing?.arrival&&heroCrossing?.kind!=='new')||heroJob!==null||pageGone||stopped||!heroSession?.enabled||heroSession.travelling)return;
     const prepared=heroCrossing,controller=heroController,serial=heroToken;heroError=null;
     state.textContent='Checking the saved crossing before travel…';
     const job=Promise.resolve().then(()=>prepared.kind==='new'?
       stageNativeHeroTravelGeneration(world,serial,prepared,{signal:controller.signal}):
       stageNativeHeroTravelDeparture(world,serial,prepared,{signal:controller.signal})).then(request=>{
       if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
       heroSession.queueTravel(request);state.textContent='Travel prepared. Waiting for the hero to depart…';
     }).catch(error=>{
       if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
       heroError=error.message;state.textContent=`Travel unavailable: ${error.message}. Your captured journey is preserved. Retry or continue here.`;
     }).finally(()=>{if(heroJob===job){heroJob=null;refreshControls();if(heroGenerated)prepareGeneratedHero(heroGenerated);}});
     heroJob=job;refreshControls();
   };
   heroRetryArrival=details.appendChild(document.createElement('button'));
   heroRetryArrival.textContent='Retry saving the arrival';heroRetryArrival.disabled=true;
   heroRetryArrival.style.cssText=save.style.cssText;heroRetryArrival.style.display='none';
   heroRetryArrival.onclick=()=>{if(heroArrival&&heroError&&heroJob===null&&!pageGone&&!stopped)publishHeroArrival(heroArrival);};
   heroRetryGeneration=details.appendChild(document.createElement('button'));
   heroRetryGeneration.textContent='Retry preparing the arrival';heroRetryGeneration.disabled=true;
   heroRetryGeneration.style.cssText=save.style.cssText;heroRetryGeneration.style.display='none';
   heroRetryGeneration.onclick=()=>{if(heroGenerated&&heroError&&heroJob===null&&!pageGone&&!stopped)prepareGeneratedHero(heroGenerated);};
 }
 function queueSave(destination){pending=true;departure=destination;refreshControls();state.textContent='Saving the native kingdom…';}
 async function request(destination=null,neighbor=false,direction=null){
   if(!playable||busy()||stopped||finished||!region||jointCheckpoint||networkBlocked)return;
   if(heroConfig){
     if(neighbor||!heroSession?.enabled)return;
     heroSession.queue();heroDestination=destination;heroError=null;refreshControls();
     state.textContent='Pausing the kingdom to save your hero journey…';return;
   }
   if(!neighbor||!world){queueSave(destination);return;}
   const controller=new AbortController(),revision=lifecycleRevision;checking=controller;refreshControls();
   state.textContent='Checking the neighboring kingdom…';
   try{
     const target=selectedRegion(new URL(destination).search);
     const selected=await checkNativeDestination(world,target.key,{content:globalThis.Module?.ENV?.RECOMP_CONTENT_IDENTITY,signal:controller.signal});
     if(session?.enabled){
       await arrival;
       if(revision!==lifecycleRevision||!playable||stopped||finished||networkBlocked||pageGone)return;
       state.textContent='Remembering your destination…';
       await recordJourney(destination,{base:location.href,content:globalThis.Module?.ENV?.RECOMP_CONTENT_IDENTITY});
     }
     if(revision===lifecycleRevision&&playable&&!stopped&&!finished&&!networkBlocked){
       checking=null;
       if(session?.enabled){session.queue(direction,destination,selected.kind);state.textContent='Saving and traveling to the neighboring kingdom…';}
       else queueSave(destination);
     }
   }catch(error){
     if(revision===lifecycleRevision){exitsWanted=true;state.textContent=`Travel unavailable: ${error.message}. Your current kingdom stays active.`;}
   }finally{
     if(checking===controller){
       checking=null;
       if(revision!==lifecycleRevision&&playable&&!stopped&&!finished&&!networkBlocked)
         state.textContent='Kingdom active. Save before leaving this region.';
     }
     refreshControls();
   }
 }
 save.onclick=()=>request();leave.onclick=()=>{if(region)request(atlasURL(location.href).href);};
 if(region){
   const travelHelp=details.appendChild(document.createElement('p'));
   travelHelp.textContent=heroConfig?'At a kingdom boundary, travel with your hero or continue here. New neighboring kingdoms are created as you explore.':'Save and explore a neighboring region. Each region keeps its own kingdom; heroes do not cross yet. Saved kingdoms resume when you return.';
   const travel=details.appendChild(document.createElement('div'));
   travel.style.cssText='display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px';
   for(const direction of ['west','north','south','east']){
     const button=travel.appendChild(document.createElement('button'));
     button.type='button';button.textContent=`Save and travel ${direction}`;
     button.style.cssText='min-height:44px;padding:8px;pointer-events:auto';
     let destination=null;
     try{destination=neighboringRegionURL(direction,location.href).href;}
     catch{button.textContent=`${direction[0].toUpperCase()+direction.slice(1)} boundary reached`;}
     const entry={button,destination,direction};neighbors.push(entry);
     button.onclick=()=>{if(entry.destination)return request(entry.destination,true,entry.direction);};
   }
 }
 refreshControls();
 addEventListener('pagehide',()=>{pageGone=true;stopped=true;cancelSave();session?.stop();stopHeroJourney();refreshControls();});
 document.addEventListener('recomp-runtime-state',event=>{
   if(event.detail?.state!=='failed')return;
   stopped=true;details.open=true;exitsWanted=true;cancelSave();session?.stop();stopHeroJourney();inFlight=false;refreshControls();
   state.textContent='Game stopped; checkpoint controls are unavailable.';
 });
 document.addEventListener('recomp-action-poll',event=>{
   if(playable&&!stopped&&!finished&&!networkBlocked&&heroSession){
     const action=heroSession.poll(event.detail?.name);
     if(action){
       try{if(action.kind==='requested'){queueNativeHeroGameSave(world,action.serial);heroToken=action.serial;}event.detail.pending=true;}
       catch(error){stopHeroJourney();state.textContent=`Journey save unavailable: ${error.message}.`;refreshControls();}
     }
   }
   if(playable&&!stopped&&!finished&&!networkBlocked&&session?.poll(event.detail?.name))event.detail.pending=true;
   if(event.detail?.name==='frontier-checkpoint'&&pending&&playable&&!stopped&&!finished&&!networkBlocked){pending=false;inFlight=true;accepted=true;event.detail.pending=true;}
 });
 const controlMessages=new Set();
 function updateRegionControls(){
   controlMessages.clear();
   for(const message of ['restoring checkpoint','checkpoint restored','checkpoint unavailable','checkpoint content unavailable','ready','completed','defeated','checkpoint saved','checkpoint failed'])controlMessages.add(`[frontier] Region ${region?.key} ${message}`);
   controlMessages.add('[frontier] Region not playing');controlMessages.add('[frontier] Network region handoff unavailable');
   if(!region)return;
   title.textContent=`Frontier region ${region.x}, ${region.y}`;
   const open=new URL(location.href);open.searchParams.delete('RECOMP_RULE_FRONTIER_RESTORE');menu.href=open.href;
   for(const key of ['RECOMP_RULE_FRONTIER_HERO_RESTORE','hero-world','hero-entity','hero-layout'])open.searchParams.delete(key);menu.href=open.href;
   atlas.href=atlasURL(location.href).href;
   const saved=new URL(location.href);saved.searchParams.set('RECOMP_RULE_FRONTIER_RESTORE','1');
   if(heroConfig){saved.searchParams.set('RECOMP_RULE_FRONTIER_HERO_RESTORE','v1');saved.searchParams.set('hero-world',heroConfig.worldId);saved.searchParams.set('hero-entity',heroConfig.entityId);}
   if(heroConfig?.haloLayout)saved.searchParams.set('hero-layout',heroConfig.haloLayout);
   resume.href=saved.href;
   for(const entry of neighbors){
     try{entry.destination=neighboringRegionURL(entry.direction,location.href).href;entry.button.textContent=`Save and travel ${entry.direction}`;}
     catch{entry.destination=null;entry.button.textContent=`${entry.direction[0].toUpperCase()+entry.direction.slice(1)} boundary reached`;}
   }
 }
 updateRegionControls();
 function rememberCurrentRegion(){
   const revision=lifecycleRevision,base=location.href;
   arrival=arrival.then(()=>recordJourney(atlasURL(base).href,{base,content:globalThis.Module?.ENV?.RECOMP_CONTENT_IDENTITY})).catch(error=>{
     if(revision===lifecycleRevision&&!busy()&&!stopped)state.textContent=`Kingdom active. Travel recovery could not be updated: ${error.message}.`;
   });
 }
 function runtimeMessage(event){
   const line=event.detail;if(stopped||typeof line!=='string'||!region)return;
   if(heroConfig){
     try{
       let heroTransition;
       if(!heroSession&&line.startsWith('[frontier] Selected hero bound ')){
         const candidate=new NativeHeroSaveSession(globalThis.Module?.ENV?.RECOMP_FRONTIER_HERO_BINDING,
           {haloBinding:globalThis.Module?.ENV?.RECOMP_FRONTIER_HERO_HALO_BINDING});
         heroTransition=candidate.message(line);if(heroTransition?.kind==='bound')heroSession=candidate;
       }else heroTransition=heroSession?.message(line);
       if(heroTransition?.kind==='ready')confirmNativeHeroGameReady(world,globalThis.Module?.ENV?.RECOMP_FRONTIER_HERO_BINDING);
       if(heroTransition?.kind==='travel-departed'){
         confirmNativeHeroTravelDeparture(world,heroTransition.serial,heroTransition.request,heroTransition.line);
         playable=false;heroCrossing=null;state.textContent='Hero departing. Loading the neighboring kingdom…';
       }
       if(heroTransition?.kind==='generation-departed'){
         confirmNativeHeroGenerationDeparture(world,heroTransition.serial,heroTransition.request,heroTransition.line);
         playable=false;heroCrossing=null;state.textContent='Hero departing. Creating the neighboring kingdom…';
       }
       if(heroTransition?.kind==='generation-held'){
         heroGenerated=heroTransition;if(heroJob===null)prepareGeneratedHero(heroTransition);
       }
       if(heroTransition?.kind==='generation-failed'||heroTransition?.kind==='travel-failed'){
         stopHeroJourney();playable=false;exitsWanted=true;
         state.textContent=heroTransition.kind==='travel-failed'?
           'Your hero could not enter the neighboring kingdom. Your captured journey is preserved. Return to Frontier to restore it.':
           'The new kingdom could not load. Your captured journey is preserved. Return to Frontier to restore it.';
       }
       if(heroTransition?.kind==='travel-held')publishHeroArrival(heroTransition);
       if(heroTransition?.kind==='travel-resumed')completeHeroTravel(heroTransition);
       if(heroTransition?.kind==='travel-refused'){
         heroError='departure refused';state.textContent='Travel was refused before departure. Your hero stays here. Retry or continue in this kingdom.';
       }
       if(heroTransition?.kind==='crossing'){
         queueNativeHeroGameSave(world,heroTransition.serial,{crossing:heroTransition.crossing});
         heroToken=heroTransition.serial;heroDestination=null;heroError=null;details.open=true;
         state.textContent='Hero reached a kingdom boundary. Capturing the paused crossing…';
       }
       if(heroTransition?.kind==='held'){
         const controller=new AbortController();heroController=controller;state.textContent='Kingdom paused. Saving your hero journey…';
         let capturePublished=false;
         const operation=Promise.resolve().then(()=>publishNativeHeroGameSave(world,heroTransition.boundary,{signal:controller.signal}));
         const job=operation.then(async result=>{
           if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
           capturePublished=true;hasCheckpoint=true;
           if(heroTransition.crossing){
             state.textContent='Crossing saved. Checking the neighboring kingdom…';
             await restoreNativeHeroTravelHome(world,heroTransition.boundary.serial,heroTransition.crossing.target,
               {layout:'halo-v1',signal:controller.signal});
             if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
             const prepared=await prepareNativeHeroTravelArrival(world,heroTransition.boundary.serial,heroTransition.crossing.target,
               {layout:'halo-v1',signal:controller.signal});
             if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
             if(prepared.arrival){
               state.textContent=prepared.arrival.kind==='native-home'?
                 'Preparing the returned hero for its original guild…':'Preparing your hero for the neighboring kingdom…';
               await stageNativeHeroTravelArrival(world,heroTransition.boundary.serial,prepared,{signal:controller.signal});
               if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
             }
             heroCrossing=prepared;
             state.textContent=prepared.arrival?'Crossing saved. Travel with your hero to the neighboring kingdom, or continue here.':
               'Crossing saved. Travel with your hero to create the neighboring kingdom, or continue here.';
           }else{heroSession.finish(true);state.textContent='Journey saved. Resuming the kingdom…';}
         }).catch(error=>{
           if(pageGone||stopped||heroController!==controller||controller.signal.aborted)return;
           heroError=error.message;heroSession.finish(capturePublished);
           state.textContent=capturePublished?
             'Journey saved. The neighboring journey could not be prepared. Resuming this kingdom…':
             'Journey publication failed. Resuming with saved checkpoints preserved…';
         }).finally(()=>{if(heroJob===job){heroJob=null;refreshControls();}});
         heroJob=job;
       }
       if(heroTransition?.kind==='resumed'){
         const destination=heroTransition.saved?heroDestination:null;heroDestination=null;heroController=null;
         let endedSuccessfully=false;
         const ended=endNativeHeroGameSave(world,heroTransition.serial);
         const job=ended.then(()=>{
           if(pageGone||stopped)return;
           endedSuccessfully=true;
           exitsWanted=true;state.textContent=heroTransition.saved?'Hero journey and kingdom saved.':`Journey save failed: ${heroError||'native checkpoint unavailable'}. Your previous journey remains available.`;
         }).catch(error=>{heroSession.stop();exitsWanted=true;state.textContent=`Journey save completion unavailable: ${error.message}. Saved checkpoints remain available.`;})
           .finally(()=>{if(heroJob===job){heroJob=null;refreshControls();if(endedSuccessfully&&destination&&!pageGone&&!stopped)depart(destination,true);}});
         heroJob=job;heroToken=0;
       }
       if(heroTransition?.kind==='failed'){heroError='native checkpoint unavailable';state.textContent='Checkpoint unavailable. Resuming the kingdom…';}
       if(heroTransition?.kind==='abandoned'){stopHeroJourney();exitsWanted=true;state.textContent='The journey save was interrupted when the kingdom left its paused state. Saved checkpoints remain available.';}
       if(heroTransition)refreshControls();
     }catch(error){stopHeroJourney();state.textContent=`Journey controls unavailable: ${error.message}. Saved checkpoints remain available.`;refreshControls();}
   }
   // The old kingdom's menu/loading messages are expected during disposal.
   // The exact travel receipt/resume events above own this transition.
   if(heroSession?.travelling)return;
   if(line===`[frontier] Selected hero checkpoint refused region=${region.key}`||
      line===`[frontier] Selected hero binding refused region=${region.key}`){
     stopped=true;details.open=true;exitsWanted=true;cancelSave();session?.stop();stopHeroJourney();inFlight=false;refreshControls();
     state.textContent='The saved hero could not be matched to this kingdom. Gameplay is held before its first update. Return to Frontier and prepare the saved journey again.';
     return;
   }
   const transition=session?.message(line);
   if(transition?.kind==='boundary'){
     if(playable&&!busy()&&!stopped&&!finished&&!networkBlocked&&!jointCheckpoint){
       const entry=neighbors.find(value=>value.direction===transition.direction);
       if(entry?.destination)void request(entry.destination,true,entry.direction);
     }
     return;
   }
   if(transition?.kind==='attached'){
     try{
       advanceNativeWorldRegion(world,transition.source,transition.region.key,transition.serial);
       if(!transition.fallback)history.replaceState(null,'',transition.url);
       region=transition.region;hasCheckpoint=transition.mode==='saved';arrivalAttempted=false;
       ++lifecycleRevision;playable=false;pending=false;accepted=false;departure=null;
       updateRegionControls();state.textContent='Loading the neighboring kingdom…';
     }catch(error){stopped=true;session.stop();exitsWanted=true;state.textContent=`Travel controls stopped: ${error.message}. Saved kingdoms remain available.`;}
   }
   if(transition?.kind==='refused'){
     exitsWanted=true;state.textContent='Travel could not complete. Your current kingdom and previous checkpoints remain available.';rememberCurrentRegion();
   }
   if(transition?.kind==='saved')hasCheckpoint=true;
   if(transition?.kind==='unavailable'){stopped=true;exitsWanted=true;state.textContent='The neighboring kingdom could not load. Saved checkpoints remain available.';}
   if(transition)refreshControls();
   if(stopped||!controlMessages.has(line))return;
   if(line===`[frontier] Region ${region.key} restoring checkpoint`){cancelSave();networkBlocked=false;exitsWanted=false;details.open=true;state.textContent='Restoring your saved kingdom…';}
   if(line===`[frontier] Region ${region.key} checkpoint restored`){cancelSave();hasCheckpoint=true;state.textContent='Saved kingdom loaded. Preparing the region…';}
   if(line===`[frontier] Region ${region.key} checkpoint unavailable`){cancelSave();exitsWanted=true;details.open=true;state.textContent='No checkpoint could be restored. Start a game or use Load Game.';}
   if(line===`[frontier] Region ${region.key} checkpoint content unavailable`){cancelSave();exitsWanted=true;details.open=true;state.textContent='No compatible checkpoint found for this region. Start a game here, or load an older save and save a new region checkpoint. Saves made with different mods need the original mods restored.';}
   if(line===`[frontier] Region ${region.key} ready`&&!networkBlocked){
     const completed=completedHeroRestoreURL(location.href);
     if(completed){history.replaceState(null,'',completed.href);updateRegionControls();}
     finished=false;playable=!jointCheckpoint;details.open=true;help.hidden=true;exitsWanted=jointCheckpoint;
     if(!busy())state.textContent=jointCheckpoint?'Shared checkpoint loaded. Saving changes from this single kingdom is unavailable.':transition?.fallback?'Travel could not complete. Your previous kingdom is active.':'Kingdom active. Save before leaving this region.';
     else if(inFlight&&!accepted)state.textContent='Waiting for the previous checkpoint result before saving this kingdom.';
     if(world&&playable&&!arrivalAttempted){
       arrivalAttempted=true;const revision=lifecycleRevision;
       if(transition?.fallback)rememberCurrentRegion();
       else arrival=recordJourneyArrival({search:location.search,content:globalThis.Module?.ENV?.RECOMP_CONTENT_IDENTITY}).catch(error=>{
         if(revision===lifecycleRevision&&!busy())state.textContent=`Kingdom active. Travel recovery could not be updated: ${error.message}. Save before leaving this region.`;
       });
     }
   }
   if(line===`[frontier] Region ${region.key} completed`||line===`[frontier] Region ${region.key} defeated`){finished=true;cancelSave();stopHeroJourney();details.open=true;exitsWanted=true;state.textContent=`${line.endsWith(' completed')?'Mission complete':'Kingdom defeated'}. ${hasCheckpoint?'Your previous checkpoint is preserved. Restore it or return to Frontier.':'Region saving is disabled. Return to Frontier or open the region menu.'}`;}
   if(line==='[frontier] Region not playing'){finished=false;networkBlocked=false;cancelSave();stopHeroJourney();exitsWanted=true;state.textContent='Start a game or restore the region checkpoint.';}
   if(line==='[frontier] Network region handoff unavailable'){networkBlocked=true;cancelSave();state.textContent='Region travel currently supports single-player kingdoms. Co-op handoff is still in development.';}
   if(line===`[frontier] Region ${region.key} checkpoint saved`||line===`[frontier] Region ${region.key} checkpoint failed`){
     if(!inFlight)return;
     const valid=accepted&&playable&&!finished&&!jointCheckpoint&&!networkBlocked;
     const destination=valid?departure:null,saved=line.endsWith(' saved');
     inFlight=false;accepted=false;departure=null;
     if(valid){
       if(saved){hasCheckpoint=true;exitsWanted=false;state.textContent='Native kingdom checkpoint saved.';}
       else{exitsWanted=true;state.textContent=hasCheckpoint?'Checkpoint failed. Your previous checkpoint is preserved. Retry or restore it.':'Checkpoint failed. Stay here and retry before leaving.';}
     }else if(playable&&!networkBlocked)state.textContent='Kingdom active. Save before leaving this region.';
     refreshControls();
     if(destination&&saved)depart(destination,true);
     return;
   }
   refreshControls();
 }
 document.addEventListener('recomp-runtime-message',runtimeMessage);
}
