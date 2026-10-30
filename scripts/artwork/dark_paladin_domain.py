"""Original medieval Gothic chapterhouse, damage states and collapse animation."""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dark_paladin_scene import (PI, setup, material, empty, box, cylinder,
                                sphere, torus, beam, mesh, render)


class Chapterhouse:
    def __init__(self, camera, level=1):
        self.stone = material('Weathered limestone', (.32, .28, .21))
        stone_light = material('Carved warm limestone', (.46, .40, .30))
        stone_dark = material('Mortar and courtyard joints', (.12, .105, .08))
        bronze = material('Aged bronze ironwork', (.30, .20, .075), .45)
        roof = material('Weathered charcoal slate', (.09, .105, .115))
        glass = material('Amber leaded glass', (.48, .30, .075), .1)
        black = material('Deep window and door recess', (.022, .019, .013))
        flame = material('Lantern flame', (.95, .42, .055))
        cloth = material('Faded teal guild banners', (.035, .115, .105))
        timber = material('Seasoned oak doors', (.15, .075, .027))
        # Gentle weathering removes the smooth, machined surface of the first model.
        for mat in [self.stone,stone_light,roof,timber]:
            nodes=mat.node_tree.nodes;links=mat.node_tree.links
            bsdf=nodes.get('Principled BSDF')
            base=tuple(bsdf.inputs['Base Color'].default_value)
            noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=18
            noise.inputs['Detail'].default_value=3
            ramp=nodes.new('ShaderNodeValToRGB')
            ramp.color_ramp.elements[0].color=tuple(c*.72 for c in base[:3])+(1,)
            ramp.color_ramp.elements[1].color=tuple(min(1,c*1.18)for c in base[:3])+(1,)
            links.new(noise.outputs['Fac'],ramp.inputs['Fac'])
            links.new(ramp.outputs['Color'],bsdf.inputs['Base Color'])
            bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.18
            bump.inputs['Distance'].default_value=.035
            links.new(noise.outputs['Fac'],bump.inputs['Height'])
            links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
            bsdf.inputs['Roughness'].default_value=.88
        self.root = empty('Medieval chapterhouse authored architecture')
        self.structure = empty('Collapsing central structure', (0, .60, 0), self.root)
        self.roofs, self.rubble, self.glass = [], [], []
        rng = random.Random(20261030)
        paving = [self.stone, stone_light, material('Worn slate paving', (.22, .22, .18))]
        box('Cut stone courtyard foundation', (0, -.70, .07),
            (5.7, 6.6, .22), stone_dark, self.root, .05)
        for ix in range(10):
            for iy in range(12):
                box('Individual courtyard flagstone', (-2.55 + ix * .565, -3.70 + iy * .54, .205),
                    (.54, .51, .09), paving[rng.randrange(3)], self.root, .025)
        # Traditional rectangular chapter hall with a steep gabled slate roof.
        box('Limestone hall body', (0, .10, 1.55), (3.55, 4.30, 2.50),
            stone_dark, self.structure, .025)
        shades = [self.stone, stone_light,
                  material('Ochre limestone', (.35, .30, .225)),
                  material('Aged gray limestone', (.30, .275, .225))]
        for course in range(7):
            z = .49 + course * .345
            # Visible individual ashlar courses, staggered at each level.
            for i in range(9):
                x = -1.58 + i * .395
                box('Front ashlar block', (x, -2.063, z),
                    (.377, .12, .325), shades[rng.randrange(4)], self.structure, .012)
            for i in range(11):
                y = -1.87 + i * .395
                box('East ashlar block', (1.795, y, z),
                    (.12, .377, .325), shades[rng.randrange(4)], self.structure, .012)
        # End walls under the high roof. Dark roof planes are broken into tiles.
        for y in [-2.08, 2.28]:
            mesh('Medieval stone gable', [(-1.85,y,2.75),(1.85,y,2.75),(0,y,4.34)],
                 [(0,1,2)], self.stone, self.structure)
        for side in [-1, 1]:
            slab = mesh('Pitched slate roof',
                [(0,-2.30,4.42),(side*2.04,-2.30,2.72),
                 (side*2.04,2.48,2.72),(0,2.48,4.42)],[(0,1,2,3)],roof,self.structure)
            self.roofs.append(slab)
            slate_shades = [roof, material('Soft blue slate '+str(side),(.12,.14,.15)),
                            material('Brown weathered slate '+str(side),(.105,.11,.105))]
            for row in range(7):
                x = side * (.16 + row * .285)
                z = 4.42 - abs(x) * 1.70 / 2.04
                for col in range(11):
                    y = -2.10 + col * .414 + (.08 if row%2 else 0)
                    tile = box('Overlapping hand-cut slate', (x,y,z+.025),
                               (.39,.397,.035),slate_shades[rng.randrange(3)],self.structure,.008)
                    tile.rotation_euler.y = side * math.atan(1.70/2.04)
                    self.roofs.append(tile)
            beam('Gable carved verge', (0,-2.34,4.45),(side*2.07,-2.34,2.72),.045,
                 stone_light,self.structure)
        ridge=beam('Clay capped roof ridge',(0,-2.35,4.47),(0,2.52,4.47),.075,
                   roof,self.structure)
        self.roofs.append(ridge)
        # Carved pointed portal, oak doors and warm leaded lancet windows.
        self.arch('Deep entrance recess', 0,-2.16,.34,.68,1.40,black)
        self.arch('Oak entrance doors', 0,-2.185,.36,.53,1.24,timber)
        for side in [-1,1]:
            box('Door iron strap',(side*.27,-2.22,.82),(.48,.035,.055),bronze,self.structure,.005)
            box('Door iron strap',(side*.27,-2.22,1.24),(.48,.035,.055),bronze,self.structure,.005)
            box('Door ring handle',(side*.075,-2.24,.98),(.035,.035,.075),bronze,self.structure,.005)
        self.arch_trim('Carved pointed portal',0,-2.23,.32,.74,1.45,stone_light)
        self.arch('Front stained-glass lancet',0,-2.13,2.36,.27,.51,glass)
        self.arch_trim('Front lancet stone hood',0,-2.19,2.34,.33,.55,stone_light)
        for y in [-.85,.65,1.78]:
            self.side_window(y,glass,stone_light,bronze)
        # Stepped stone buttresses and cloth rather than machined bands.
        for x in [-1.69,1.69]:
            for y in [-2.10,.15,2.24]:
                box('Stepped Gothic buttress',(x,y,1.13),(.34,.42,1.64),stone_light,self.structure,.025)
                box('Buttress upper step',(x,y,2.10),(.26,.31,.35),self.stone,self.structure,.025)
                cap=box('Sloping buttress cap',(x,y,2.32),(.33,.38,.14),roof,self.structure,.02)
                cap.rotation_euler.x=.20
        for side in [-1,1]:
            box('Teal cloth banner',(side*1.03,-2.20,1.97),(.36,.035,.85),cloth,self.structure,.006)
            beam('Banner wooden crossbar',(side*1.03-.23,-2.23,2.41),
                 (side*1.03+.23,-2.23,2.41),.025,timber,self.structure)
            torus('Banner eclipse emblem',(side*1.03,-2.23,2.08),.10,.018,bronze,self.structure)
        # Small square belfry, four openings and a steep pyramid slate cap.
        box('Bell tower stone shaft',(-1.18,1.53,3.39),(.92,.95,2.30),self.stone,self.structure,.025)
        for side in [-1,1]:
            box('Belfry corner pier',(-1.18+side*.40,1.02,4.28),(.15,.16,.65),stone_light,self.structure,.015)
        self.arch('Belfry opening',-1.18,.995,3.94,.25,.34,black)
        bell=cylinder('Bronze medieval bell',(-1.18,1.0,4.12),.15,.23,bronze,self.structure,vertices=16,top=.075)
        self.roofs.append(bell)
        cap=cylinder('Steep belfry slate spire',(-1.18,1.53,4.87),.79,.90,
                     roof,self.structure,vertices=4,top=0)
        cap.rotation_euler.z=PI/4
        self.roofs.append(cap)
        for i in range(3):
            box('Broad entry stair',(0,-2.15-i*.30,.39-i*.07),
                (1.62+i*.20,.88,.17),stone_light,self.root,.025)
        for side in [-1,1]:
            box('Low courtyard side wall',(side*2.73,-.7,.48),(.26,6.5,.63),self.stone,self.root,.025)
            box('Side wall weathered coping',(side*2.73,-.7,.83),(.36,6.55,.12),stone_light,self.root,.025)
            box('Courtyard front wall',(side*1.88,-3.93,.48),(1.70,.25,.63),self.stone,self.root,.025)
            for y in [-3.95,2.4]:
                self.lantern((side*2.73,y),self.root,stone_light,bronze,flame)
        if level >= 2:
            # A carved porch and a proper stained-glass rose mark the second tier.
            for side in [-1,1]:
                cylinder('Porch stone column',(side*.88,-2.69,1.05),.13,1.47,stone_light,self.structure,vertices=12)
                box('Porch carved capital',(side*.88,-2.69,1.80),(.34,.34,.16),stone_light,self.structure,.025)
            porch=mesh('Gabled entrance porch',
                [(-1.07,-2.91,1.91),(1.07,-2.91,1.91),(0,-2.91,2.55),
                 (-1.07,-2.12,1.91),(1.07,-2.12,1.91),(0,-2.12,2.55)],
                [(0,2,5,3),(2,1,4,5),(0,1,2)],roof,self.structure)
            self.roofs.append(porch)
            for side in [-1,1]:
                beam('Porch carved verge',(0,-2.94,2.57),(side*1.08,-2.94,1.90),.055,stone_light,self.structure)
            torus('Gable rose window stone surround',(0,-2.17,3.18),.31,.065,stone_light,self.structure)
            window=cylinder('Gable rose stained glass',(0,-2.155,3.18),.27,.025,glass,self.structure,vertices=24)
            window.rotation_euler.x=PI/2
            self.glass.append(window)
            for a in range(6):
                theta=a*PI/3
                beam('Rose window lead tracery',(0,-2.20,3.18),
                     (.25*math.cos(theta),-2.20,3.18+.25*math.sin(theta)),.014,bronze,self.structure)
        if level >= 3:
            # Crenellated gate piers make the final tier a fortified knightly hall.
            for side in [-1,1]:
                x=side*2.37
                box('Fortified courtyard gate pier',(x,-3.67,1.00),(.63,.65,1.49),self.stone,self.root,.025)
                box('Gate pier cornice',(x,-3.67,1.78),(.77,.79,.14),stone_light,self.root,.025)
                for dx in [-.24,.24]:
                    for dy in [-.24,.24]:
                        box('Hand-cut crenellation',(x+dx,-3.67+dy,1.99),(.25,.26,.33),stone_light,self.root,.018)
                banner=box('Gatehouse hanging banner',(x,-4.01,1.18),(.32,.035,.81),cloth,self.root,.007)
                torus('Gatehouse eclipse badge',(x,-4.04,1.29),.10,.018,bronze,self.root)
        for _ in range(65):
            x, y = rng.uniform(-2.1, 2.1), rng.uniform(-2.5, 1.8)
            rubble = box('Original slate and masonry rubble', (x, y, rng.uniform(.32, .48)),
                         (rng.uniform(.15, .47), rng.uniform(.16, .45), rng.uniform(.12, .31)),
                         roof if rng.random() < .55 else stone_light, self.root, .02)
            rubble.rotation_euler = [rng.uniform(-.5, .5), rng.uniform(-.5, .5), rng.uniform(0, PI)]
            self.rubble.append(rubble)
        # Native ground diamonds use equal axes and approximately 1:2 slopes.
        camera.location = (10, -10.65, 1.35 + math.sqrt(200) / 2)
        camera.rotation_euler = (Vector((0, -.65, 1.35)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.ortho_scale = 12.3

    def arch(self, name, x, y, base, radius, stem, mat):
        # Two curved halves meet at a pointed Gothic crown.
        points=[(x-radius,y,base),(x+radius,y,base),(x+radius,y,base+stem)]
        for i in range(1,9):
            u=i/8
            points.append((x+radius*(1-u),y,base+stem+radius*(2*u-u*u)))
        for i in range(1,9):
            u=i/8
            points.append((x-radius*u,y,base+stem+radius*(1-u*u)))
        obj=mesh(name,points,[tuple(range(len(points)))],mat,self.structure)
        self.glass.append(obj) if 'glass' in name or 'lancet' in name else None
        return obj

    def arch_trim(self,name,x,y,base,radius,stem,mat):
        for side in [-1,1]:
            box(name+' jamb',(x+side*radius,y,base+stem/2),(.13,.14,stem),mat,self.structure,.012)
            for i in range(8):
                u,v=i/8,(i+1)/8
                a=(x+side*radius*(1-u),y,base+stem+radius*(2*u-u*u))
                b=(x+side*radius*(1-v),y,base+stem+radius*(2*v-v*v))
                beam(name+' voussoir',a,b,.073,mat,self.structure)

    def side_window(self,y,glass,stone,bronze):
        # Rotate an original front-facing lancet assembly onto the east wall.
        before=set(bpy.data.objects)
        self.arch('Leaded stained-glass lancet',0,0,1.42,.22,.65,glass)
        self.arch_trim('Lancet stone hood',0,-.03,1.40,.28,.69,stone)
        box('Leaded window vertical', (0,-.045,1.87),(.022,.02,.87),bronze,self.structure,.002)
        for obj in set(bpy.data.objects)-before:
            x0,y0=obj.location.x,obj.location.y
            # Mesh vertices authored in parent coordinates need their own turn.
            if obj.name.startswith('Leaded stained-glass'):
                for v in obj.data.vertices:
                    x1,y1=v.co.x,v.co.y
                    v.co.x=1.87-y1;v.co.y=y+x1
            else:
                obj.location.x=1.87-y0;obj.location.y=y+x0
                obj.rotation_euler.z+=PI/2

    def lantern(self, xy, root, stone, bronze, flame):
        x, y = xy
        box('Courtyard lantern pillar', (x, y, .78), (.35, .35, 1.21), stone, root, .03)
        cylinder('Lantern base', (x, y, 1.45), .18, .07, bronze, root, vertices=8)
        cylinder('Warm enclosed lantern', (x, y, 1.60), .105, .25, flame, root, vertices=8)
        for dx, dy in [(-.11, -.11), (.11, -.11), (-.11, .11), (.11, .11)]:
            beam('Lantern bronze cage', (x + dx, y + dy, 1.47),
                 (x + dx, y + dy, 1.73), .013, bronze, root)
        cylinder('Lantern cap', (x, y, 1.75), .19, .14, bronze, root, vertices=8, top=.04)

    def pose(self, damage=0, collapse=0):
        for i, obj in enumerate(self.roofs):
            obj.hide_render = collapse > .15 or (damage == 1 and i >= 6) or damage == 2
        for i, obj in enumerate(self.rubble):
            obj.hide_render = not (damage > 0 or collapse > .15) or (damage == 1 and i >= 24)
        for obj in self.glass:
            obj.hide_render = damage == 2 or collapse > .15
        self.structure.scale.z = max(.06, 1 - collapse * .90)
        self.structure.rotation_euler = (.16 * collapse, -.11 * collapse, .025 * collapse)
        self.structure.hide_render = collapse > .97
        # Children inherit scale, while courtyard and original rubble stay grounded.
        for obj in self.structure.children_recursive:
            if collapse > .97:
                obj.hide_render = True
            elif obj not in self.roofs and obj not in self.glass:
                obj.hide_render = False
        bpy.context.view_layer.update()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--preview', action='store_true')
    parser.add_argument('--guild-level', type=int, choices=[1,2,3], default=1)
    parser.add_argument('--construction-only', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    args.out.mkdir(parents=True, exist_ok=True)
    scene, camera = setup(640, 'eevee')
    scene.render.resolution_y = 520
    building = Chapterhouse(camera, args.guild_level)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.out / 'dark-paladin-domain.blend'))
    records = []
    if args.construction_only:
        for stage in range(3):
            building.pose(0)
            for obj in bpy.data.objects:
                if obj.type == 'MESH':
                    obj.hide_render = stage == 0 and not obj.name.startswith(
                        ('Cut stone courtyard foundation', 'Individual courtyard flagstone'))
            for obj in building.roofs + building.glass:
                obj.hide_render = True
            building.structure.scale.z = [.08, .42, .80][stage]
            bpy.context.view_layer.update()
            name = f'construction-{stage}.png'
            render(scene, args.out / name)
            records.append(dict(role='construction', stage=stage, file=name))
        (args.out / 'render-manifest.json').write_text(json.dumps(dict(
            format='majesty-original-dark-paladin-construction-v1', frames=records,
            generatedFromOriginalGeometry=True, stockArtUsed=False), indent=2)+'\n')
        return
    for damage in range(3):
        building.pose(damage)
        name = f'damage-{damage}.png'
        render(scene, args.out / name)
        records.append(dict(role='building', damage=damage, file=name))
    if not args.preview:
        for frame in range(42):
            building.pose(2, frame / 41)
            name = f'collapse-{frame:02d}.png'
            render(scene, args.out / name)
            records.append(dict(role='collapse', frame=frame, file=name))
    (args.out / 'render-manifest.json').write_text(json.dumps(dict(
        format='majesty-original-dark-paladin-domain-render-v1',
        renderer=bpy.app.version_string, size=[640, 520], frames=records,
        generatedFromOriginalGeometry=True, stockArtUsed=False), indent=2) + '\n')


if __name__ == '__main__':
    main()
