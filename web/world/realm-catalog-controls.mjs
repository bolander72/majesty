import {openNativeRealmCatalog} from './realm-catalog.mjs';

export function initializeRealmCatalog({document,getWorld,onSelect,open=openNativeRealmCatalog}={}){
  const node=id=>document.querySelector('#'+id);
  let next=node('kingdom-list-next'),refresh=node('kingdom-list-refresh'),
    list=node('kingdom-list'),status=node('kingdom-list-status');
  let catalog=null,busy=false,done=false,rows=[],closed=false,closing=null,work=null,generation=0;
  function update(){
    if(!next)return;
    next.disabled=closed||busy||!getWorld()||done;refresh.disabled=closed||busy||!getWorld();
    for(const {button,item}of rows)button.disabled=busy||item.state!=='saved';
  }
  function start(){
    busy=true;let settle;work=new Promise(resolve=>{settle=resolve;});update();
    return ()=>{busy=false;work=null;settle();update();};
  }
  function clearRows(){
    ++generation;
    for(const {button}of rows){button.disabled=true;button.onclick=null;}
    rows=[];list?.replaceChildren();
  }
  async function page(reset){
    if(closed||busy||!getWorld()||done&&!reset)return;
    const finish=start();status.textContent='Reading saved kingdoms…';
    try{
      catalog??=await open(getWorld());
      if(closed){await catalog.close();return;}
      if(reset)await catalog.reset();
      if(closed)return;
      const result=await catalog.page(),replacement=[];
      if(closed)return;
      clearRows();const current=generation;
      for(const item of result.items){
        const li=document.createElement('li'),button=document.createElement('button');
        button.textContent=item.state==='saved'?`Show saved region ${item.x}, ${item.y}`:`Region ${item.x}, ${item.y} · save unavailable`;
        button.onclick=async()=>{
          if(closed||current!==generation||busy||item.state!=='saved')return;
          const finish=start();status.textContent=`Opening saved terrain for ${item.x}, ${item.y}…`;
          try{await onSelect(item.x,item.y);if(!closed)status.textContent=`Showing saved region ${item.x}, ${item.y}. Use “Play this region in Majesty” to resume.`;}
          catch(error){if(!closed)status.textContent=`Could not show region: ${error.message}. Its saved files are preserved.`;}
          finally{finish();}
        };
        li.appendChild(button);replacement.push({li,button,item});
      }
      list.replaceChildren(...replacement.map(row=>row.li));rows=replacement;done=result.done;
      next.textContent='Next saved kingdoms';
      status.textContent=result.items.length?`${result.items.length} saved entries shown.${done?' End of list.':' More entries available.'}`:
        done?'No more saved kingdoms.':'No saved kingdoms in this batch. Continue with Next.';
    }catch(error){if(!closed)status.textContent=`Saved kingdom list stopped: ${error.message}. Refresh to try again.`;}
    finally{finish();}
  }
  next.onclick=()=>page(false);refresh.onclick=()=>page(true);update();
  return {async dispose(){
    if(closed)return closing;
    if(busy)throw new Error('Saved kingdom list busy');
    const finish=start();
    try{await catalog?.reset();if(!closed){catalog=null;done=false;clearRows();}}
    finally{finish();}
  },close(){
    if(closing)return closing;
    closed=true;clearRows();update();next.onclick=refresh.onclick=null;
    const stopping=catalog?.close(),pending=work;
    closing=(async()=>{
      await Promise.allSettled([stopping,pending]);
      try{await catalog?.close();}
      finally{catalog=null;rows=[];next=refresh=list=status=null;document=getWorld=onSelect=open=null;}
    })();
    return closing;
  }};
}
