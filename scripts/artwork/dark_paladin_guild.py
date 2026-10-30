"""Solid articulated heroes, larger cumulative guilds and standing upgrade works.

Extend frozen qualified producers; keep earlier release source receipts intact.
"""
import argparse,json,math,sys
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from dark_paladin_textured import hero as prior_hero,guild as prior_guild,weather
from dark_paladin_scene import box,beam,mesh,material,render,cylinder


def hero():
    scene,k=prior_hero()
    boots=material('Opaque dark leather boots',(.025,.019,.012));weather(boots,'wood')
    shin=material('Solid dark forged greaves',(.12,.14,.14));weather(shin,'iron')
    b=shin.node_tree.nodes.get('Principled BSDF');b.inputs['Metallic'].default_value=.1
    for n in shin.node_tree.nodes:
        if n.type=='VALTORGB':
            n.color_ramp.elements[0].color=(.045,.052,.052,1)
            n.color_ramp.elements[1].color=(.29,.31,.29,1)
    for o in bpy.data.objects:
        if o.name.startswith('Armored thigh'):
            o.data.materials.clear();o.data.materials.append(bpy.data.materials['Dark hammered iron'])
        if o.name.startswith('Greave'):
            o.scale.x*=1.32;o.scale.y*=1.32;o.data.materials.clear();o.data.materials.append(shin)
        if o.name.startswith('Armored boot'):
            o.scale.x*=1.26;o.scale.y*=1.15;o.scale.z*=1.22
            o.data.materials.clear();o.data.materials.append(boots)
        if o.name.startswith('Folded hanging cloth tabard'):
            for v in o.data.vertices:v.co.z=max(v.co.z,-.36)
    # End the cloak above the knees so both articulated shins and feet read
    # from behind, instead of merging into the cloth silhouette.
    k.cape_vertices=[(x,y,max(z,-.35))for x,y,z in k.cape_vertices]
    for m in bpy.data.materials:
        if m.use_nodes:
            bs=m.node_tree.nodes.get('Principled BSDF')
            if bs:
                bs.inputs['Alpha'].default_value=1
                bs.inputs['Transmission Weight'].default_value=0
    return scene,k


def stone_floor(b,name,xmin,xmax,ymin,ymax):
    root=b.root;stone=b.stone
    box(name+' base',((xmin+xmax)/2,(ymin+ymax)/2,.10),(xmax-xmin,ymax-ymin,.16),stone,root,.025)
    # The old floor remains intact. Additional flags visibly widen the site.
    for x in range(math.ceil((xmax-xmin)/.40)):
        for y in range(math.ceil((ymax-ymin)/.40)):
            xx=xmin+.20+x*.40;yy=ymin+.20+y*.40
            if xx>xmax-.1 or yy>ymax-.1:continue
            if -2.8<xx<2.8 and -3.9<yy<2.55:continue
            box(name+' extra worn flag',(xx,yy,.21),(.385,.385,.07),stone,root,.012)


def guild(level):
    scene,b=prior_guild(level);scene.camera.data.ortho_scale=13.5
    roof=bpy.data.materials['Weathered charcoal slate'];stone=b.stone
    # A connected side hall and rear range expand the actual pictured footprint.
    # Their geometry is present unchanged in both levels two and three.
    if level>=2:
        stone_floor(b,'Level two additional courtyard',-2.85,3.75,-4.05,3.4)
        box('Additional east chapter wing',(3.03,.10,1.03),(1.23,2.65,1.62),stone,b.structure,.025)
        cap=box('East wing weathered slate cover',(3.03,.10,1.94),(1.42,2.86,.16),roof,b.structure,.02)
        cap.rotation_euler.y=.22;b.roofs.append(cap)
        box('Rear chapter range',(0,2.82,1.01),(3.68,1.13,1.54),stone,b.structure,.025)
        cap=box('Rear range slate cover',(0,2.82,1.89),(3.90,1.35,.16),roof,b.structure,.02);b.roofs.append(cap)
        for y in [-.7,.1,.9]:
            dark=material('East chapter wing recess '+str(y),(.008,.010,.008))
            box('East wing deep window',(3.655,y,1.10),(.028,.23,.68),dark,b.structure,.02)
        box('Extended east boundary coping',(3.74,-.10,.56),(.20,6.30,.69),stone,b.root,.02)
    if level>=3:
        stone_floor(b,'Level three fortified forecourt',-3.52,3.75,-4.90,3.4)
        for side in [-1,1]:
            x=side*3.42
            box('Outer fortified forecourt corner',(x,-4.57,1.04),(.72,.72,1.56),stone,b.structure,.025)
            box('Outer corner coping',(x,-4.57,1.89),(.91,.91,.15),stone,b.structure,.02)
            for dx in [-.28,.28]:
                for dy in [-.28,.28]:box('Outer corner battlement',(x+dx,-4.57+dy,2.08),(.23,.23,.30),stone,b.structure,.012)
            box('Extended forecourt front wall',(side*2.55,-4.84,.64),(1.25,.20,.93),stone,b.root,.02)
            box('Extended forecourt outer wall',(x,-.75,.56),(.20,7.6,.75),stone,b.root,.02)
    return scene,b


def scaffold(b,target,stage):
    oak=material('Upgrade seasoned oak scaffolding',(.30,.16,.055));weather(oak,'wood')
    # Readable warm timber, lighter than the stone behind it at game scale.
    for n in oak.node_tree.nodes:
        if n.type=='VALTORGB':
            n.color_ramp.elements[0].color=(.12,.065,.025,1)
            n.color_ramp.elements[1].color=(.43,.27,.12,1)
    root=b.root
    zones=[(1.82,1.35,1.85,2.0,5.35),(3.04,.10,1.65,3.0,2.65)]if target==2 else [(-2.08,-3.78,1.55,1.65,3.65),(2.08,-3.78,1.55,1.65,3.65)]
    for zindex,(x,y,w,d,h)in enumerate(zones):
        for xx in [x-w/2,x+w/2]:
            for yy in [y-d/2,y+d/2]:beam('Upgrade scaffold vertical',(xx,yy,.25),(xx,yy,h),.052,oak,root)
        for height in [1.18,2.30,3.45,4.58]:
            if height>h:continue
            for yy in [y-d/2,y+d/2]:
                beam('Upgrade scaffold cross rail',(x-w/2,yy,height),(x+w/2,yy,height),.042,oak,root)
                box('Upgrade plank work platform',(x,yy,height-.06),(w+.14,.34,.075),oak,root,.008)
            for xx in [x-w/2,x+w/2]:beam('Upgrade scaffold side rail',(xx,y-d/2,height),(xx,y+d/2,height),.042,oak,root)
        for xx in [x-w/2,x+w/2]:
            beam('Upgrade scaffold diagonal brace',(xx,y-d/2,.35),(xx,y+d/2,min(h,2.8)),.04,oak,root)
        # Native-looking ladder with individual rungs, leaning against the work.
        yy=y-d/2-.22
        for dx in [-.15,.15]:beam('Upgrade ladder upright',(x+dx,yy-.45,.22),(x+dx,yy,min(h,3.4)),.028,oak,root)
        for i in range(10):
            t=i/10;zz=.38+t*(min(h,3.4)-.38)
            beam('Upgrade ladder rung',(x-.15,yy-.45*(1-t),zz),(x+.15,yy-.45*(1-t),zz),.022,oak,root)
    if stage==1:
        # Partial additions grow within the timber while the prior hall stands.
        if target==2:box('Bell tower ongoing masonry',(1.82,1.35,1.5),(1.14,1.22,2.35),b.stone,b.structure,.025)
        else:
            for x in [-2.08,2.08]:box('Gate tower ongoing masonry',(x,-3.78,1.05),(1.04,1.04,1.52),b.stone,b.structure,.025)


def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--kind',choices=['hero','guild','upgrade'],required=True);p.add_argument('--guild-level',type=int,default=1);p.add_argument('--preview',action='store_true');p.add_argument('--construction-only',action='store_true');p.add_argument('--sets',default='1,8,16,64,96,128');p.add_argument('--directions',default='0,1,2,3,4,5,6,7')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);a.out.mkdir(parents=True,exist_ok=True);records=[]
    if a.kind=='upgrade':
        for stage in range(3):
            scene,b=guild(a.guild_level if stage==2 else a.guild_level-1);b.pose(0);scaffold(b,a.guild_level,stage)
            name=f'upgrade-{stage}.png';render(scene,a.out/name);records.append(dict(role='upgrade',stage=stage,file=name))
    else:
        scene,obj=hero()if a.kind=='hero'else guild(a.guild_level)
        bpy.ops.wm.save_as_mainfile(filepath=str(a.out/'original-guild-model.blend'))
        if a.kind=='hero':
            counts={1:8,8:1,16:8,64:12,96:16,128:8}
            for state in map(int,a.sets.split(',')):
                for d in map(int,a.directions.split(',')):
                    for f in ([0]if a.preview else range(counts[state])):
                        if a.preview and state!=8:continue
                        obj.pose(state,d,f,counts[state]);name=f'{state:03d}-{d}-{f:02d}.png';render(scene,a.out/name);records.append(dict(state=state,direction=d,frame=f,file=name))
        elif a.construction_only:
            for stage in range(3):
                obj.pose(0)
                for o in bpy.data.objects:
                    if o.type=='MESH':o.hide_render=stage==0 and not o.name.startswith(('Cut stone courtyard foundation','Individual courtyard flagstone','Grounded'))
                for o in obj.roofs+obj.glass:o.hide_render=True
                obj.structure.scale.z=[.08,.42,.80][stage];name=f'construction-{stage}.png';render(scene,a.out/name);records.append(dict(role='construction',stage=stage,file=name))
        else:
            for damage in range(3):
                obj.pose(damage);name=f'damage-{damage}.png';render(scene,a.out/name);records.append(dict(role='building',damage=damage,file=name))
            if not a.preview:
                for f in range(42):
                    obj.pose(2,f/41);name=f'collapse-{f:02d}.png';render(scene,a.out/name);records.append(dict(role='collapse',frame=f,file=name))
    (a.out/'render-manifest.json').write_text(json.dumps(dict(format='majesty-dark-paladin-guild-v1',kind=a.kind,level=a.guild_level,frames=records,generatedFromOriginalGeometry=True,stockArtUsed=False),indent=2)+'\n')
if __name__=='__main__':main()
