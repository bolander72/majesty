"""Human-scale Dark Paladin proportions and smoother articulated movement."""
import argparse,json,math,sys
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
from dark_paladin_guild import hero as solid_hero
from dark_paladin_scene import render,sphere,mesh,box,beam,torus

class RefinedKnight:
    def __init__(self,knight):self.k=knight
    def pose(self,state,direction,frame,count):
        k=self.k;k.pose(state,direction,frame,count)
        phase=frame/max(1,count)*2*math.pi;progress=frame/max(1,count-1)
        if state==1:
            k.hips.location.z=k.base_hips.z+.018*math.cos(phase*2)
            for side in [-1,1]:
                step=math.sin(phase+(math.pi if side==1 else 0))
                k.legs[side].rotation_euler.x=step*.35
                k.knees[side].rotation_euler.x=-max(0,step)*.50
                k.arms[side].rotation_euler.x=-.08-step*(.16 if side==-1 else .06)
        elif state==16:
            # Ease into the native eight contact poses rather than snapping
            # the shoulder through abrupt square-edged sword positions.
            p=progress*7;i=min(6,int(p));t=(1-math.cos((p-i)*math.pi))/2
            keys=[-.15,-1.65,-2.25,-.6,.32,.1,-.1,-.15]
            k.arms[-1].rotation_euler.x=keys[i]*(1-t)+keys[i+1]*t
        bpy.context.view_layer.update()

def hero():
    scene,k=solid_hero();scene.render.resolution_x=320;scene.render.resolution_y=320
    k.neck.scale=(.86,.90,.95)
    for side in [-1,1]:
        k.arms[side].location.x=side*.365
        k.legs[side].location.x=side*.165
    for o in list(bpy.data.objects):
        name=o.name
        if name.startswith('Forged rounded cuirass'):o.scale.x*=.88;o.scale.y*=.94
        if name.startswith(('Body underarmor','Waist belt')):o.scale.x*=.86
        if name.startswith('Articulated hip plate'):o.scale.x*=.82;o.scale.y*=.85
        if name.startswith('Greave'):o.scale.x*=.88;o.scale.y*=.88
        if name.startswith('Armored boot'):
            # A small rounded leather boot, with a visible planted toe rather
            # than the enlarged rectangular sabaton of the visibility pass.
            loc=o.location.copy();parent=o.parent;mat=o.data.materials[0]
            bpy.data.objects.remove(o,do_unlink=True)
            sphere('Rounded fitted leather boot',loc,(.137,.215,.10),mat,parent)
        if name.startswith('Boot bronze toe edge'):o.scale.x*=.88
        if name.startswith('Compact articulated pauldron'):o.scale*=.9
        if name.startswith('Overlapping shoulder lame'):o.scale*=.9
    iron=bpy.data.materials['Dark hammered iron'];brass=bpy.data.materials['Weathered bronze edges'];black=bpy.data.materials['Closed visor recess']
    # Sloped cheek plates and a clear narrow visor replace the round toy-like
    # helmet face, retaining a believable enclosed medieval greathelm.
    for o in list(bpy.data.objects):
        if o.name.startswith(('Horizontal closed T visor','Vertical closed T visor','Upper visor bronze border','Bronze visor downstroke','Bronze visor brow','Overlapping shoulder lame','Pauldron fine brass edging')):
            bpy.data.objects.remove(o,do_unlink=True)
    for side in [-1,1]:
        mesh('Forged sloped cheek plate',[(side*.02,-.293,.02),(side*.19,-.239,.04),(side*.21,-.247,.26),(side*.02,-.293,.26)],[(0,1,2,3)],iron,k.neck)
        beam('Fine visor central edging',(side*.023,-.298,.02),(side*.023,-.298,.26),.006,brass,k.neck)
        rim=torus('Pauldron fine oval rim',(0,0,-.045),.168,.006,brass,k.arms[side],rotation=(0,0,0));rim.scale.y=1.08
    box('Narrow medieval eye slit',(0,-.299,.285),(.42,.012,.035),black,k.neck,.002)
    box('Closed visor central recess',(0,-.297,.14),(.027,.012,.24),black,k.neck,.001)
    beam('Subtle forged visor brow',(-.205,-.302,.309),(.205,-.302,.309),.007,brass,k.neck)
    # A single cloth material and gentler physical folds avoid the old broad,
    # straight striped panels that made the cape look like a plastic block.
    for f in k.cape.data.polygons:f.material_index=0;f.use_smooth=True
    heights=[.72,.44,.18,-.08,-.35]
    k.cape_vertices=[(x*.85,.24+(i//6)*.045+.018*math.cos((i%6)*2),heights[i//6]+(.015*math.sin((i%6)*2)if i//6==4 else 0))for i,(x,y,z)in enumerate(k.cape_vertices)]
    # Narrow, less rectangular shield. Keep its readable heraldic identity.
    k.shield.scale=(.84,.95,.88)
    return scene,RefinedKnight(k)

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--preview',action='store_true');p.add_argument('--directions',default='0,1,2,3,4,5,6,7');a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);a.out.mkdir(parents=True,exist_ok=True)
    scene,k=hero();bpy.ops.wm.save_as_mainfile(filepath=str(a.out/'refined-dark-paladin.blend'));rows=[];counts={1:8,8:1,16:8,64:12,96:16,128:8}
    for state,n in counts.items():
        if a.preview and state!=8:continue
        for d in map(int,a.directions.split(',')):
            for f in ([0]if a.preview else range(n)):
                k.pose(state,d,f,n);name=f'{state:03d}-{d}-{f:02d}.png';render(scene,a.out/name);rows.append(dict(state=state,direction=d,frame=f,file=name))
    (a.out/'render-manifest.json').write_text(json.dumps(dict(format='majesty-refined-dark-paladin-v1',frames=rows,generatedFromOriginalGeometry=True,stockArtUsed=False),indent=2)+'\n')
if __name__=='__main__':main()
