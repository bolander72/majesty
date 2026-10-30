"""Original guild life/damage animation and open-front level-three architecture."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from dark_paladin_guild import guild as prior_guild,stone_floor,scaffold as prior_scaffold
from dark_paladin_textured import weather
from dark_paladin_scene import box,beam,mesh,material,render,cylinder,sphere


def guild(level):
    # Level three extends level two, deliberately excluding the former huge gate.
    scene,b=prior_guild(min(level,2));scene.camera.data.ortho_scale=14.0;scene.camera.location.z+=.50
    stone=b.stone;slate=bpy.data.materials['Weathered charcoal slate']
    if level==3:
        stone_floor(b,'Open level three courtyard',-3.65,3.75,-4.85,3.85)
        box('Upper rear training wing',(-.35,3.04,2.10),(3.60,1.35,2.65),stone,b.structure,.025)
        cap=box('Training wing slate roof',(-.35,3.04,3.51),(3.84,1.55,.16),slate,b.structure,.02);cap.rotation_euler.x=.12;b.roofs.append(cap)
        x,y=-3.02,2.66
        box('Rear watchtower stone shaft',(x,y,2.26),(1.12,1.15,3.96),stone,b.structure,.025)
        box('Rear watchtower carved cornice',(x,y,4.30),(1.32,1.35,.17),stone,b.structure,.02)
        cap=cylinder('Rear watchtower steep slate cap',(x,y,4.79),.95,.85,slate,b.structure,vertices=4,top=0);cap.rotation_euler.z=math.pi/4;b.roofs.append(cap)
        dark=material('Watchtower recessed lancet',(.012,.014,.012))
        b.arch('Watchtower front lancet',x,y-.59,3.24,.22,.55,dark)
        for yy in [2.8,3.35]:box('Upper wing east window',(1.465,yy,2.58),(.025,.22,.71),dark,b.structure,.015)
        # Low perimeter walls frame the expanded site without hiding the hall.
        for side in [-1,1]:
            xx=-3.54 if side==-1 else 3.72
            box('Low outer courtyard side wall',(xx,-.48,.52),(.18,8.45,.58),stone,b.root,.02)
            box('Low open forecourt corner',(xx,-4.63,.67),(.48,.48,.90),stone,b.root,.02)
    # Remove the older static flame meshes. All visible life and fire is authored
    # below in the appropriate animated state, with small attached sconces.
    for o in bpy.data.objects:
        if o.name.startswith('Warm enclosed lantern'):o.hide_render=True
    bronze=bpy.data.materials['Aged bronze ironwork']
    for x in [-.92,.92]:
        box('Guild front torch mounting plate',(x,-2.25,1.15),(.15,.055,.26),bronze,b.structure,.012)
        beam('Guild attached torch bracket',(x,-2.29,1.04),(x,-2.46,1.38),.028,bronze,b.structure)
        cylinder('Guild torch basket',(x,-2.46,1.39),.075,.10,bronze,b.structure,vertices=8)
    return scene,b


def dynamic_objects():
    out=[]
    for o in bpy.data.objects:
        if o.type!='MESH':continue
        cloth=any(any(k in m.name.lower()for k in ['cloth','standard','banner'])for m in o.data.materials)
        sigil=o.name.startswith(('Chapterhouse sword','Banner eclipse','Tower standard eclipse','Tower bronze eclipse'))
        if cloth or sigil:out.append(o)
    return out


def hide_dynamic():
    for o in dynamic_objects():o.hide_render=True
    for o in bpy.data.objects:
        if o.name.startswith('Warm enclosed lantern'):o.hide_render=True


def custom_scaffold(b,target,stage):
    if target==2:return prior_scaffold(b,target,stage)
    oak=material('Original rear works scaffold oak',(.27,.16,.07));weather(oak,'wood')
    for x,y,w,d,h in [(-3.02,2.66,1.65,1.7,4.75),(-.35,3.04,4.0,1.8,3.8)]:
        for xx in [x-w/2,x+w/2]:
            for yy in [y-d/2,y+d/2]:beam('Rear works upright',(xx,yy,.22),(xx,yy,h),.05,oak,b.root)
        for z in [1.12,2.25,3.38,4.5]:
            if z>h:continue
            for yy in [y-d/2,y+d/2]:
                box('Rear works plank platform',(x,yy,z),(w+.12,.30,.07),oak,b.root,.008)
                beam('Rear works cross brace',(x-w/2,yy,z+.12),(x+w/2,yy,min(h,z+1.0)),.035,oak,b.root)
        for i in range(12):
            z=.3+i*.25
            beam('Rear works ladder rung',(x-.15,y-d/2-.2,z),(x+.15,y-d/2-.2,z),.023,oak,b.root)
        for dx in [-.15,.15]:beam('Rear works ladder rail',(x+dx,y-d/2-.2,.2),(x+dx,y-d/2-.2,3.3),.028,oak,b.root)
    if stage==1:
        box('Watchtower ongoing masonry',(-3.02,2.66,1.5),(1.12,1.15,2.45),b.stone,b.structure,.025)
        box('Training wing ongoing masonry',(-.35,3.04,1.35),(3.60,1.35,2.1),b.stone,b.structure,.025)


class Life:
    def __init__(self,scene,b,level,damage):
        self.scene=scene;self.cloth=dynamic_objects()if damage<2 else []
        self.rest={o:[v.co.copy()for v in o.data.vertices]for o in self.cloth}
        for o in bpy.data.objects:
            if o.type=='MESH':o.hide_render=o not in self.cloth
        self.flames=[];self.smoke=[]
        outer=material('Original amber flame',(.95,.22,.025));inner=material('Original golden flame core',(1,.65,.12))
        for mat,color,strength in [(outer,(1,.13,.008,1),1.4),(inner,(1,.48,.035,1),2.3)]:
            bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=color;bs.inputs['Emission Strength'].default_value=strength
        sites=[(-.92,-2.46,1.44,.25),(.92,-2.46,1.44,.25)]
        if damage:
            sites+=[(.65,-2.12,2.75,.62),(1.83,.55,2.67,.58)]
        if damage==2:sites+=[(-1.15,-1.5,.65,.75),(2.3,-.65,.75,.65)]
        for j,(x,y,z,h)in enumerate(sites):
            for core,mat in [(False,outer),(True,inner)]:
                r=.055 if j<2 else .13
                vertices=[(math.cos(i*math.pi/4)*r,math.sin(i*math.pi/4)*r,0)for i in range(8)]+[(math.cos(i*math.pi/4)*r*.66,math.sin(i*math.pi/4)*r*.66,h*.55)for i in range(8)]+[(.015,0,h)]
                faces=[(i,(i+1)%8,8+(i+1)%8,8+i)for i in range(8)]+[(8+i,8+(i+1)%8,16)for i in range(8)]
                o=mesh('Original guild flame '+str(j),vertices,faces,mat)
                o.location=(x,y,z);o.scale=(.58,.58,.70)if core else(1,1,1)
                self.flames.append((o,o.scale.copy(),j,h))
        if damage:
            soot=material('Original soft smoke',(.09,.085,.075));bs=soot.node_tree.nodes.get('Principled BSDF');bs.inputs['Alpha'].default_value=.65
            for j in range(6 if damage==1 else 10):
                o=sphere('Original rising damage smoke',(.7,-2.0,3.2),(.12,.13,.16),soot)
                self.smoke.append((o,j))
    def pose(self,frame):
        phase=2*math.pi*frame/20
        for o,rest in self.rest.items():
            inv=o.matrix_world.inverted().to_3x3()
            for v,co in zip(o.data.vertices,rest):
                world=o.matrix_world@co
                delta=Vector((0,.035*math.sin(phase+world.z*5+world.x*2),.008*math.sin(phase+world.x*4)))
                v.co=co+inv@delta
        for o,scale,j,h in self.flames:
            wave=1+.13*math.sin(phase*2+j)+.07*math.sin(phase*3+j*.7)
            o.scale=(scale.x*(1+.08*math.sin(phase+j)),scale.y,scale.z*wave)
            o.rotation_euler.y=.12*math.sin(phase+j)
        for o,j in self.smoke:
            t=(frame/20+j/len(self.smoke))%1
            o.location=(.65+.28*math.sin(t*4+j),-2.0+.13*math.cos(j),2.9+t*1.6)
            size=.09+.16*t;o.scale=(size,size*.85,size*1.18)
            o.hide_render=t>.88
        bpy.context.view_layer.update()


def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--guild-level',type=int,choices=[1,2,3],required=True);p.add_argument('--kind',choices=['building','life','upgrade','construction'],default='building');p.add_argument('--preview',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);a.out.mkdir(parents=True,exist_ok=True);rows=[]
    if a.kind=='life':
        for damage in range(3):
            scene,b=guild(a.guild_level);b.pose(damage);life=Life(scene,b,a.guild_level,damage)
            for f in ([0,5]if a.preview else range(20)):
                life.pose(f);name=f'life-{damage}-{f:02d}.png';render(scene,a.out/name);rows.append(dict(role='life',damage=damage,frame=f,file=name))
    elif a.kind=='upgrade':
        for stage in range(3):
            scene,b=guild(a.guild_level if stage==2 else a.guild_level-1);b.pose(0);custom_scaffold(b,a.guild_level,stage)
            name=f'upgrade-{stage}.png';render(scene,a.out/name);rows.append(dict(role='upgrade',stage=stage,file=name))
    else:
        scene,b=guild(a.guild_level);bpy.ops.wm.save_as_mainfile(filepath=str(a.out/'original-open-guild.blend'))
        if a.kind=='construction':
            for stage in range(3):
                b.pose(0)
                for o in bpy.data.objects:
                    if o.type=='MESH':o.hide_render=stage==0 and not o.name.startswith(('Cut stone courtyard foundation','Individual courtyard flagstone','Grounded'))
                for o in b.roofs+b.glass:o.hide_render=True
                b.structure.scale.z=[.08,.42,.80][stage];name=f'construction-{stage}.png';render(scene,a.out/name);rows.append(dict(role='construction',stage=stage,file=name))
        else:
            for damage in range(3):
                b.pose(damage);hide_dynamic();name=f'damage-{damage}.png';render(scene,a.out/name);rows.append(dict(role='building',damage=damage,file=name))
            if not a.preview:
                for f in range(42):
                    b.pose(2,f/41);hide_dynamic();name=f'collapse-{f:02d}.png';render(scene,a.out/name);rows.append(dict(role='collapse',frame=f,file=name))
    (a.out/'render-manifest.json').write_text(json.dumps(dict(format='majesty-original-guild-life-v1',level=a.guild_level,kind=a.kind,frames=rows,stockAnimationPixelsUsed=False),indent=2)+'\n')
if __name__=='__main__':main()
