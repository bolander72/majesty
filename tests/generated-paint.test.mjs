import test from 'node:test';
import assert from 'node:assert/strict';
const {paintGeneratedWorld}=await import(process.env.MAJESTY_GENERATED_RENDER_MODULE??'../web/world/render.mjs');
import {generate,REGION,SIDE,TILE} from '../web/world/stream.mjs';

// Record vector operations and independently sample their filled areas. This
// checks the visible map's colours/forest gaps, rather than its batching loop.
function context(){
  const fills=[];let path=[];
  const ctx={fills,rectangles:0,pathFills:0,labels:0,
    fillRect(x,y,w,h){++this.rectangles;fills.push({color:this.fillStyle,rect:[x,y,w,h]});},
    beginPath(){path=[];},moveTo(x,y){path.push({move:[x,y]});},
    arc(x,y,r){path.push({circle:[x,y,r]});},lineTo(x,y){path.push({line:[x,y]});},
    fill(){++this.pathFills;fills.push({color:this.fillStyle,path:path.slice()});},
    strokeRect(){},fillText(){++this.labels;},
    sample(x,y){
      let color;
      for(const fill of fills){
        if(fill.rect){const [rx,ry,w,h]=fill.rect;if(x>=rx&&y>=ry&&x<rx+w&&y<ry+h)color=fill.color;}
        else for(const step of fill.path){
          if(step.circle){const [cx,cy,r]=step.circle;if((x-cx)**2+(y-cy)**2<r*r)color=fill.color;}
        }
      }
      return color;
    }};
  return ctx;
}
const ground=['#607759','#344e3a','#33535c'];
for(const [rx,ry,offsetX,offsetY,width,height] of [[0,0,0,0,512,512],[-2,3,491,477,21,35],[4,-6,35.5,52.25,75,59]]){
  test(`clipped generated terrain and separate tree circles retain map colours at ${rx},${ry}`,()=>{
    const region=generate(71201,rx,ry),ctx=context();
    const camera={x:rx*REGION+offsetX+width/2,y:ry*REGION+offsetY+height/2};
    paintGeneratedWorld(ctx,new Map([['region',region]]),camera,width,height);
    let probes=0;
    for(let j=0;j<SIDE;++j)for(let i=0;i<SIDE;++i){
      for(const [px,py,tree] of [[2,2,false],[8,8,true],[14,8,false]]){
        const x=i*TILE+px-offsetX,y=j*TILE+py-offsetY;
        if(x<0||y<0||x>=width||y>=height)continue;
        const type=region.tiles[j*SIDE+i];
        assert.equal(ctx.sample(x,y),tree&&type===1?'#253f2c':ground[type]);++probes;
      }
    }
    assert.ok(probes>0);
    for(const fill of ctx.fills.filter(f=>f.path))for(let at=0;at<fill.path.length;++at){
      if(!fill.path[at].circle||at===0)continue;
      const [x,y,r]=fill.path[at].circle;
      assert.deepEqual(fill.path[at-1],{move:[x+r,y]},'each tree has a separate subpath');
    }
  });
}
test('uniform terrain needs 32 ground rectangles and an entire forest needs one tree fill',()=>{
  for(const type of [0,1,2]){
    const region=generate(71201,0,0);region.tiles.fill(type);
    const ctx=context();paintGeneratedWorld(ctx,new Map([['0,0',region]]),{x:256,y:256},512,512);
    assert.equal(ctx.rectangles,32,'one rectangle per visible row, previously 1024');
    assert.equal(ctx.pathFills,type===1?1:0,'previously one fill per forest tile');
    if(type===1)assert.equal(ctx.fills.at(-1).path.filter(p=>p.circle).length,1024);
  }
});
test('an offscreen resident region is not visited or painted',()=>{
  let accessed=false;
  const invisible={x:40,y:-40,get tiles(){accessed=true;throw Error('offscreen terrain read');}};
  const ctx=context();paintGeneratedWorld(ctx,new Map([['offscreen',invisible]]),{x:256,y:256},512,512);
  assert.equal(accessed,false);assert.equal(ctx.fills.length,0);assert.equal(ctx.labels,0);
});
test('offscreen towers are culled while a roof overlapping the viewport remains visible',()=>{
  const region=generate(71201,0,0);region.tiles.fill(0);
  region.buildings=[{x:20,y:20},{x:1,y:4}];
  const ctx=context();paintGeneratedWorld(ctx,new Map([['0,0',region]]),{x:32,y:32},64,64);
  assert.equal(ctx.fills.filter(f=>f.color==='#a75545').length,1);
  assert.deepEqual(ctx.fills.find(f=>f.color==='#a75545').path,
    [{move:[13,61]},{line:[24,49]},{line:[35,61]}]);
});
