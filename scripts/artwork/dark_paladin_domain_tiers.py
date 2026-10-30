"""Add unmistakable medieval expansion tiers to the preserved original hall."""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
from dark_paladin_scene import setup,material,box,cylinder,beam,torus,render
from dark_paladin_domain import Chapterhouse


def expand(building,level):
    root=building.structure
    stone=building.stone
    trim=material('Tower dressed limestone',(.41,.35,.26))
    mortar=material('Tower recessed mortar',(.115,.10,.075))
    slate=material('Tower dark weathered slate',(.075,.095,.105))
    recess=material('Tower Gothic window recess',(.016,.021,.018))
    bronze=material('Tower aged bronze bell',(.38,.245,.08),.45)
    cloth=material('Tower faded teal standards',(.025,.13,.12))
    # This substantial attached tower rises above the right eave. Its silhouette
    # remains inside the original courtyard and the existing camera bounds.
    x,y=1.82,1.35
    box('Level two attached bell tower',(x,y,2.28),(1.14,1.22,3.94),stone,root,.035)
    for side in [-1,1]:
        box('Bell tower corner quoin',(x+side*.50,y-.60,2.28),(.15,.16,3.95),trim,root,.018)
    for row in range(8):
        box('Tower masonry course',(x,y, .49+row*.46),(1.16,1.24,.025),mortar,root,.003)
    box('Tower upper cornice',(x,y,4.25),(1.34,1.40,.18),trim,root,.025)
    building.arch('Bell chamber pointed opening',x,y-.622,3.35,.31,.44,recess)
    building.arch_trim('Bell chamber carved surround',x,y-.66,3.32,.36,.47,trim)
    cylinder('Visible tower bell',(x,y-.65,3.65),.17,.28,bronze,root,vertices=16,top=.08)
    cap=cylinder('Tall pitched tower roof',(x,y,4.73),.99,.80,slate,root,vertices=4,top=0)
    cap.rotation_euler.z=math.pi/4;building.roofs.append(cap)
    finial=cylinder('Tower roof iron finial',(x,y,5.20),.045,.23,bronze,root,vertices=8,top=0)
    building.roofs.append(finial)
    box('Long tower cloth standard',(x,y-.655,2.43),(.48,.025,1.12),cloth,root,.008)
    torus('Tower standard eclipse',(x,y-.68,2.57),.14,.025,bronze,root)
    # A visible side gallery broadens the level-two building rather than
    # replacing its original nave, doorway, belfry, banners or courtyard.
    box('Attached east gallery',(2.06,-.65,1.05),(.85,2.05,1.48),stone,root,.025)
    gallery=box('Gallery sloping slate roof',(2.05,-.65,1.95),(1.02,2.20,.14),slate,root,.018)
    gallery.rotation_euler.y=.31;building.roofs.append(gallery)
    for yy in [-1.22,-.55,.13]:
        box('Gallery recessed lancet',(2.501,yy,1.18),(.025,.19,.64),recess,root,.01)
    if level==3:
        # The third tier adds a full fortified gate with two high crenellated
        # towers. The level-two hall and attached bell tower remain intact.
        for side in [-1,1]:
            xx,yy=side*2.08,-3.78
            box('Level three fortified gate tower',(xx,yy,1.48),(1.04,1.04,2.38),stone,root,.035)
            box('Gate tower dressed base',(xx,yy,.45),(1.18,1.18,.28),trim,root,.025)
            box('Gate tower cornice',(xx,yy,2.73),(1.22,1.22,.18),trim,root,.025)
            for dx in [-.43,0,.43]:
                for dy in [-.43,.43]:
                    box('Gate tower crenellation',(xx+dx,yy+dy,2.99),(.27,.26,.40),trim,root,.018)
            for yy2 in [yy-.15,yy+.15]:
                box('Gate tower side battlement',(xx+side*.43,yy2,2.99),(.27,.24,.40),trim,root,.018)
            box('Gate tower arrow slit',(xx,yy-.53,1.85),(.11,.025,.51),recess,root,.006)
            box('Gate tower hanging teal banner',(xx,yy-.55,1.03),(.52,.025,.76),cloth,root,.008)
            torus('Gate tower bronze eclipse',(xx,yy-.58,1.12),.14,.025,bronze,root)
        building.arch_trim('Fortified arched gate',0,-4.31,.28,1.42,1.00,trim)
        bridge=box('Gate parapet walkway',(0,-3.78,2.77),(3.25,.68,.16),stone,root,.025)
        for xx in [-1.10,-.55,0,.55,1.10]:
            box('Gate walkway battlement',(xx,-4.08,3.00),(.30,.20,.36),trim,root,.016)
    return building


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--guild-level',type=int,choices=[2,3],required=True)
    parser.add_argument('--preview',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);args.out.mkdir(parents=True,exist_ok=True)
    scene,camera=setup(640,'eevee');scene.render.resolution_y=520
    building=expand(Chapterhouse(camera,2),args.guild_level)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.out/'dark-paladin-domain.blend'))
    frames=[]
    for damage in range(3):
        building.pose(damage);name=f'damage-{damage}.png';render(scene,args.out/name)
        frames.append({'role':'building','damage':damage,'file':name})
    if not args.preview:
        for frame in range(42):
            building.pose(2,frame/41);name=f'collapse-{frame:02d}.png';render(scene,args.out/name)
            frames.append({'role':'collapse','frame':frame,'file':name})
    (args.out/'render-manifest.json').write_text(json.dumps({'format':'majesty-dark-paladin-expanded-tiers-v1','level':args.guild_level,'frames':frames,'originalHallPreserved':True,'stockArtworkUsed':False},indent=2)+'\n')


if __name__=='__main__':main()
