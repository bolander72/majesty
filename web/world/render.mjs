import {SIDE,TILE,REGION} from './stream.mjs';
export function tileBounds(dx,dy,width,height){
  return {
    firstX:Math.max(0,Math.floor(-dx/TILE)),lastX:Math.min(SIDE,Math.ceil((width-dx)/TILE)),
    firstY:Math.max(0,Math.floor(-dy/TILE)),lastY:Math.min(SIDE,Math.ceil((height-dy)/TILE)),
  };
}

const colors=['#607759','#344e3a','#33535c'];

// Draw only the visible tiles from the current bounded scene. Adjacent ground
// cells share a rectangle, and disjoint tree circles share one path per region.
// No raster cache, extra canvas or terrain copy survives this paint.
export function paintGeneratedWorld(ctx,active,camera,width,height){
  const left=camera.x-width/2,top=camera.y-height/2;
  for(const r of active.values()){
    const dx=r.x*REGION-left,dy=r.y*REGION-top;
    if(dx+REGION<0||dy+REGION<0||dx>width||dy>height)continue;
    const {firstX,lastX,firstY,lastY}=tileBounds(dx,dy,width,height);
    for(let y=firstY;y<lastY;++y){
      let start=firstX;
      for(let x=firstX+1;x<=lastX;++x){
        if(x<lastX&&r.tiles[y*SIDE+x]===r.tiles[y*SIDE+start])continue;
        ctx.fillStyle=colors[r.tiles[y*SIDE+start]];
        ctx.fillRect(dx+start*TILE,dy+y*TILE,(x-start)*TILE,TILE);
        start=x;
      }
    }
    let trees=false;
    for(let y=firstY;y<lastY;++y)for(let x=firstX;x<lastX;++x){
      if(r.tiles[y*SIDE+x]!==1)continue;
      if(!trees){ctx.beginPath();trees=true;}
      const cx=dx+x*TILE+8,cy=dy+y*TILE+8;
      ctx.moveTo(cx+5,cy); // Start a subpath; joining circles would fill gaps.
      ctx.arc(cx,cy,5,0,Math.PI*2);
    }
    if(trees){ctx.fillStyle='#253f2c';ctx.fill();ctx.beginPath();}
    ctx.strokeStyle='#abc09a33';ctx.strokeRect(dx,dy,REGION,REGION);
    ctx.fillStyle='#e3e7bf';ctx.font='12px system-ui';ctx.fillText(`Region ${r.x}, ${r.y}`,dx+8,dy+20);
    for(const b of r.buildings){
      const x=dx+b.x*TILE,y=dy+b.y*TILE;
      if(x+19<=0||y+18<=0||x-3>=width||y-15>=height)continue;
      ctx.fillStyle='#262d29';ctx.fillRect(x-2,y-5,20,23);
      ctx.fillStyle='#d7cba1';ctx.fillRect(x,y-3,16,19);
      ctx.fillStyle='#a75545';ctx.beginPath();ctx.moveTo(x-3,y-3);ctx.lineTo(x+8,y-15);ctx.lineTo(x+19,y-3);ctx.fill();
    }
  }
}
