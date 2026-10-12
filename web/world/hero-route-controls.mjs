import {inspectSavedHeroJourney,inspectHeroEnrollment,enrollHeroJourney,prepareSavedHeroJourney,heroJourneyURL} from './hero-route-launcher.mjs';
import {regionKey} from './region.mjs';

export function initializeHeroJourneys({document,base,getCurrent,navigate,
  storage=globalThis.navigator?.storage,locks=globalThis.navigator?.locks}={}){
  const node=id=>document.querySelector('#'+id);
  let refresh=node('hero-journey-refresh'),heroes=node('hero-journey-heroes'),register=node('hero-journey-register'),
    prepare=node('hero-journey-prepare'),resume=node('hero-journey-resume'),status=node('hero-journey-status');
  let summary=null,enrollment=null,busy=false,closed=false,closing=null,work=null;
  const controller=new AbortController();
  const options={locks,signal:controller.signal};
  function check(){if(closed)throw Error('Saved hero journeys closed');controller.signal.throwIfAborted();}
  function update(){
    if(!refresh)return;
    refresh.disabled=closed||busy||!getCurrent().world;
    heroes.disabled=closed||busy||!enrollment?.choices.length;
    register.disabled=heroes.disabled;prepare.disabled=closed||busy||summary?.state!=='registered';
  }
  function clear(){summary=null;enrollment=null;heroes.replaceChildren();resume.hidden=true;resume.removeAttribute('href');}
  async function profiles(){
    check();if(typeof storage?.getDirectory!=='function')throw Error('Local game storage unavailable');
    const root=await storage.getDirectory();check();
    const game=await root.getDirectoryHandle('majesty');check();
    const folder=await game.getDirectoryHandle('profile');check();return folder;
  }
  async function run(message,action){
    if(closed||busy)return;
    busy=true;let settle;work=new Promise(resolve=>settle=resolve);update();
    resume.hidden=true;resume.removeAttribute('href');status.textContent=message;
    try{await action();}
    catch(error){if(!closed)status.textContent=`Saved journey stopped: ${error.message}. Existing kingdoms are preserved.`;}
    finally{busy=false;work=null;settle();update();}
  }
  function showPrepared(result){
    check();resume.href=heroJourneyURL(result,base).href;resume.hidden=false;
    status.textContent=`Saved journey ready in region ${result.region.replace('_',', ')}. Resume to load the latest kingdom.`;
  }
  function request(selected){return {worldId:selected.worldId,entityId:selected.entityId,region:selected.region,
    content:selected.content,ownerManifest:selected.ownerManifest,nativeManifest:selected.nativeManifest};}
  refresh.onclick=()=>run('Checking saved hero journey…',async()=>{
    clear();const current=getCurrent();if(!current.world)throw Error('Choose a named world first');
    const folder=await profiles();summary=await inspectSavedHeroJourney(folder,current.world,options);check();
    if(summary.state==='registered'){
      status.textContent=`Registered journey in region ${summary.region.replace('_',', ')}. Prepare it to keep the latest saved kingdom.`;
      return;
    }
    const region=summary.state==='incomplete'?summary.region:regionKey(current.x,current.y);
    enrollment=await inspectHeroEnrollment(folder,current.world,region,options);check();
    for(const [index,hero]of enrollment.choices.entries()){
      const option=document.createElement('option');option.value=String(index);
      option.textContent=`${hero.name||'Hero '+(index+1)} · Kingdom ${hero.playerNumber+1}`;heroes.appendChild(option);
    }
    heroes.value=enrollment.choices.length?'0':'';
    status.textContent=enrollment.choices.length?
      `Choose one saved hero in region ${region.replace('_',', ')} to register this prototype journey.`:
      'No eligible heroes with a verified guild home were found in this saved kingdom.';
  });
  register.onclick=()=>run('Registering saved hero journey…',async()=>{
    const proposal=enrollment,index=Number(heroes.value),hero=proposal?.choices[index],current=getCurrent();
    if(!hero||!Number.isInteger(index)||index<0||current.world!==proposal.world||
        summary?.state!=='incomplete'&&regionKey(current.x,current.y)!==proposal.region)
      throw Error('Refresh available heroes at the selected saved region');
    const folder=await profiles();
    await enrollHeroJourney(folder,proposal.world,{content:proposal.content,region:proposal.region,
      expectedNativeManifest:proposal.nativeManifest,guildUnitId:hero.guildUnitId,heroUnitId:hero.heroUnitId},options);check();
    summary=await inspectSavedHeroJourney(folder,proposal.world,options);check();enrollment=null;heroes.replaceChildren();
    showPrepared(await prepareSavedHeroJourney(folder,proposal.world,request(summary),options));
    summary=null;
  });
  prepare.onclick=()=>run('Preparing the latest saved kingdom…',async()=>{
    const selected=summary;
    if(selected?.state!=='registered'||getCurrent().world!==selected.world)throw Error('Refresh the selected saved journey');
    showPrepared(await prepareSavedHeroJourney(await profiles(),selected.world,request(selected),options));
    summary=null; // Another preparation requires a fresh selected-save token.
  });
  resume.onclick=async event=>{
    event.preventDefault();if(closed||busy||!resume.hasAttribute('href'))return;
    const destination=resume.href;
    await run('Opening saved hero journey…',async()=>{check();await navigate(destination);});
  };
  update();status.textContent=getCurrent().world?'Save and close the game, then check for a saved hero journey.':'Open a named world to prepare a saved hero journey.';
  return {close(){
    if(closing)return closing;
    closed=true;controller.abort(Error('Saved hero journeys closed'));clear();update();
    refresh.onclick=register.onclick=prepare.onclick=resume.onclick=null;
    closing=(async()=>{await work;summary=enrollment=null;refresh=heroes=register=prepare=resume=status=null;
      options.locks=options.signal=null;
      document=base=getCurrent=navigate=storage=locks=null;})();
    return closing;
  }};
}
