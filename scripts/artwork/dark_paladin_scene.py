"""Original articulated Dark Paladin model and deterministic directional renders.

Run with the pinned local Blender background renderer, never the game compiler.
Geometry is authored here from the approved concept; no stock character mesh,
sprite, texture or animation is used. Native conversion is a separate step.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

PI = math.pi


def material(name, color, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = .52
    if metallic:
        noise = mat.node_tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 24
        noise.inputs['Detail'].default_value = 2
        ramp = mat.node_tree.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*(v * .70 for v in color), 1)
        ramp.color_ramp.elements[1].color = (*(min(1, v * 1.25) for v in color), 1)
        mat.node_tree.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
        mat.node_tree.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


def empty(name, location=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


def finish(obj, name, location, scale, mat, parent, bevel=0):
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.scale = scale
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('Forged edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 1
    return obj


def box(name, location, scale, mat, parent=None, bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1)
    return finish(bpy.context.object, name, location, scale, mat, parent, bevel)


def sphere(name, location, scale, mat, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6)
    obj = finish(bpy.context.object, name, location, scale, mat, parent)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def cylinder(name, location, radius, depth, mat, parent=None, vertices=12, top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
                                   radius2=radius if top is None else top, depth=depth)
    return finish(bpy.context.object, name, location, (1, 1, 1), mat, parent)


def mesh(name, vertices, faces, mat, parent=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    return obj


def torus(name, location, radius, tube, mat, parent=None, rotation=(PI / 2, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=6,
                                   major_radius=radius, minor_radius=tube)
    obj = finish(bpy.context.object, name, location, (1, 1, 1), mat, parent)
    obj.rotation_euler = rotation
    return obj


def beam(name, start, end, width, mat, parent=None):
    delta = Vector(end) - Vector(start)
    obj = cylinder(name, (Vector(end) + Vector(start)) / 2, width, delta.length,
                   mat, parent, vertices=8)
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return obj


def setup(size, renderer):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if renderer == 'eevee' else 'BLENDER_WORKBENCH'
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 20
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.studiolight_rotate_z = -.45
    scene.display.shading.studio_light = 'paint.sl'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = 'BOTH'
    scene.display.shading.curvature_ridge_factor = 1.2
    scene.display.shading.curvature_valley_factor = .8
    scene.display.shading.show_specular_highlight = True
    scene.display.render_aa = '16'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.world.color = (.22, .22, .22)
    camera_data = bpy.data.cameras.new('Orthographic native sprite camera')
    camera = bpy.data.objects.new('Orthographic native sprite camera', camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0, -8, 5.2)
    target = Vector((0, 0, 1.3))
    camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = 4.4
    scene.camera = camera
    if renderer == 'eevee':
        if hasattr(scene.eevee, 'taa_render_samples'):
            scene.eevee.taa_render_samples = 16
        scene.world.use_nodes = True
        background = scene.world.node_tree.nodes.get('Background')
        background.inputs['Color'].default_value = (.16, .18, .19, 1)
        background.inputs['Strength'].default_value = .5
        for name, location, energy, color in [
                ('Warm upper-left key', (-3, -4, 7), 650, (1, .88, .68)),
                ('Soft sky fill', (4, -2, 5), 300, (.68, .79, 1)),
                ('Rear separation', (-2, 4, 5), 400, (.86, .90, 1))]:
            light_data = bpy.data.lights.new(name, 'AREA')
            light_data.energy = energy
            light_data.color = color
            light_data.shape = 'DISK'
            light_data.size = 4
            obj = bpy.data.objects.new(name, light_data)
            bpy.context.collection.objects.link(obj)
            obj.location = location
            obj.rotation_euler = (Vector((0, 0, 1)) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    return scene, camera


class Knight:
    def __init__(self):
        iron = material('Dark hammered iron', (.075, .091, .096), .8)
        edge = material('Weathered bronze edges', (.42, .285, .105), .75)
        bright = material('Worn steel blade', (.49, .53, .51), .9)
        leather = material('Leather and articulated joints', (.063, .047, .031))
        black = material('Closed visor recess', (.006, .009, .009))
        cloth = material('Deep teal cloth', (.025, .12, .135))
        cloth_light = material('Teal cloth fold', (.04, .16, .17))
        glow = material('Verdigris ward', (.12, .50, .35))
        self.root = empty('Knight orientation')
        self.fall = empty('Fall pivot', parent=self.root)
        self.hips = empty('Pelvis', (0, 0, 1.04), self.fall)
        self.torso = empty('Torso', parent=self.hips)
        box('Body underarmor', (0, 0, .25), (.57, .34, .55), leather, self.torso)
        box('Breastplate', (0, -.025, .43), (.69, .42, .67), iron, self.torso)
        breast = mesh('Angular breastplate face',
                     [(-.31, -.248, .68), (.31, -.248, .68), (.22, -.29, .16),
                      (-.22, -.29, .16), (0, -.32, .40)],
                     [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], iron, self.torso)
        for a, b in [((-.30, -.255, .68), (-.22, -.30, .16)),
                     ((.30, -.255, .68), (.22, -.30, .16))]:
            beam('Breastplate bronze seam', a, b, .012, edge, self.torso)
        box('Waist belt', (0, -.015, .02), (.66, .41, .105), leather, self.hips)
        box('Bronze belt buckle', (0, -.238, .02), (.105, .045, .095), edge, self.hips)
        for side in [-1, 1]:
            tasset = box('Articulated hip plate', (side * .245, .015, -.18),
                         (.20, .36, .37), iron, self.hips)
            tasset.rotation_euler[1] = -side * .12
            box('Divided front tabard', (side * .095, -.26, -.28),
                (.16, .045, .51), cloth, self.hips, .01)
        self.neck = empty('Neck', (0, 0, .82), self.torso)
        cylinder('Bronze gorget', (0, -.005, -.02), .27, .105, edge, self.neck)
        cylinder('Iron gorget', (0, -.015, .025), .25, .12, iron, self.neck)
        # The closed helm is an original faceted mesh, not a stock Paladin head.
        rings = [(.0, .225, .185), (.28, .285, .225), (.47, .185, .18)]
        verts = []
        for z, rx, ry in rings:
            for i in range(8):
                angle = 2 * PI * i / 8 + PI / 8
                verts.append((rx * math.cos(angle), ry * math.sin(angle), z))
        faces = [tuple(range(7, -1, -1)), tuple(range(16, 24))]
        faces += [(r * 8 + i, r * 8 + (i + 1) % 8,
                   (r + 1) * 8 + (i + 1) % 8, (r + 1) * 8 + i)
                  for r in range(2) for i in range(8)]
        mesh('Closed angular greathelm', verts, faces, iron, self.neck)
        cylinder('Lower helm bronze rim', (0, 0, .018), .235, .028, edge,
                 self.neck, vertices=8).scale[1] = .83
        box('Horizontal closed T visor', (0, -.219, .285), (.49, .028, .057), black,
            self.neck, .005)
        box('Vertical closed T visor', (0, -.215, .145), (.045, .029, .25), black,
            self.neck, .003)
        box('Upper visor bronze border', (0, -.232, .321), (.48, .014, .018), edge,
            self.neck, .003)
        for side in [-1, 1]:
            box('Bronze visor downstroke', (side * .035, -.229, .143),
                (.014, .013, .25), edge, self.neck, .003)
            box('Bronze visor brow', (side * .14, -.229, .248), (.18, .014, .015),
                edge, self.neck, .003)
        beam('Helmet crown ridge', (0, -.17, .46), (0, .16, .46), .018, edge, self.neck)
        self.arms, self.forearms = {}, {}
        for side in [-1, 1]:
            arm = empty('Sword shoulder' if side == -1 else 'Shield shoulder',
                        (side * .43, 0, .64), self.torso)
            self.arms[side] = arm
            sphere('Bronze pauldron rim', (0, 0, -.015), (.25, .235, .22), edge, arm)
            sphere('Iron pauldron', (0, -.01, .02), (.23, .22, .20), iron, arm)
            cylinder('Upper arm plate', (0, 0, -.23), .125, .34, iron, arm, top=.155)
            elbow = empty('Elbow', (0, 0, -.40), arm)
            self.forearms[side] = elbow
            sphere('Elbow hinge', (0, 0, 0), (.14, .14, .12), edge, elbow)
            cylinder('Gauntlet bracer', (0, 0, -.17), .105, .32, iron, elbow, top=.13)
            sphere('Closed gauntlet', (0, -.015, -.36), (.115, .11, .12), iron, elbow)
        self.sword = empty('Longsword grip', (0, -.02, -.39), self.forearms[-1])
        cylinder('Sword grip', (0, 0, .035), .035, .19, leather, self.sword)
        sphere('Bronze sword pommel', (0, 0, .15), (.06, .045, .06), edge, self.sword)
        beam('Crescent crossguard left', (-.20, 0, -.08), (0, 0, -.02), .025,
             edge, self.sword)
        beam('Crescent crossguard right', (0, 0, -.02), (.20, 0, -.08), .025,
             edge, self.sword)
        mesh('Longsword diamond blade',
             [(-.062, 0, -.08), (0, -.024, -.08), (.062, 0, -.08), (0, .024, -.08),
              (-.052, 0, -.81), (0, -.014, -.81), (.052, 0, -.81), (0, .014, -.81),
              (0, 0, -.97)],
             [(i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i)for i in range(4)] +
             [(4 + i, 4 + (i + 1) % 4, 8)for i in range(4)], bright, self.sword)
        self.shield = empty('Asymmetric eclipse tower shield',
                            (0, -.20, -.12), self.forearms[1])
        outline = [(-.30, .49), (.24, .66), (.32, .29), (.28, -.43),
                   (.06, -.67), (-.24, -.52)]
        verts = [(x, y, z)for y in [0, -.09]for x, z in outline]
        count = len(outline)
        faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
        faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count)
                  for i in range(count)]
        mesh('Bronze tower shield rim', verts, faces, edge, self.shield)
        mesh('Iron shield inset', [(x * .88, -.10, z * .90)for x, z in outline],
             [tuple(range(count))], iron, self.shield)
        torus('Eclipse shield emblem', (0, -.115, -.015), .18, .026, edge, self.shield)
        box('Eclipse dividing stroke', (.01, -.14, -.015), (.025, .018, .45),
            edge, self.shield, .005)
        self.ward = empty('Verdigris ward', (0, -.17, 0), self.shield)
        for radius in [.25, .34]:
            torus('Shield ward ring', (0, 0, 0), radius, .014, glow, self.ward)
        self.legs, self.knees = {}, {}
        for side in [-1, 1]:
            thigh = empty('Hip hinge', (side * .185, 0, -.05), self.hips)
            self.legs[side] = thigh
            cylinder('Armored thigh', (0, 0, -.20), .145, .39, iron, thigh, top=.18)
            knee = empty('Knee hinge', (0, 0, -.42), thigh)
            self.knees[side] = knee
            sphere('Knee bronze rim', (0, -.045, 0), (.16, .14, .14), edge, knee)
            sphere('Knee plate', (0, -.085, .015), (.14, .13, .13), iron, knee)
            cylinder('Greave', (0, 0, -.20), .105, .37, iron, knee, top=.135)
            box('Armored boot', (0, -.085, -.40), (.25, .40, .17), iron, knee, .08)
            box('Boot bronze toe edge', (0, -.265, -.39), (.24, .025, .095),
                edge, knee, .01)
        # Two panels and a central split remain legible in rear walk frames.
        self.cape_vertices = []
        xs = [-.46, -.29, -.07, .07, .29, .46]
        zs = [.72, .40, .06, -.30, -.63]
        for row, z in enumerate(zs):
            for x in xs:
                self.cape_vertices.append((x * (.78 + row * .055), .24 + row * .035, z))
        faces = [(row * 6 + col, row * 6 + col + 1, (row + 1) * 6 + col + 1,
                  (row + 1) * 6 + col)for row in range(4)for col in range(5)
                 if not(col == 2 and row >= 2)]
        self.cape = mesh('Split teal cloak', self.cape_vertices, faces, cloth, self.torso)
        self.cape.data.materials.append(cloth_light)
        for i, polygon in enumerate(self.cape.data.polygons):
            polygon.material_index = i % 3 == 0
        sphere('Eclipse cloak clasp', (-.24, -.255, .67), (.07, .025, .07), edge, self.torso)
        self.base_hips = self.hips.location.copy()

    def pose(self, state, direction, frame, count):
        phase = frame / max(1, count) * 2 * PI
        progress = frame / max(1, count - 1)
        self.root.rotation_euler = (0, 0, direction * PI / 4)
        self.fall.location = (0, 0, 0)
        self.fall.rotation_euler = (0, 0, 0)
        self.hips.location = self.base_hips
        self.torso.rotation_euler = (0, 0, 0)
        self.neck.rotation_euler = (0, 0, 0)
        for side in [-1, 1]:
            self.arms[side].rotation_euler = (-.08, side * .12, 0)
            self.forearms[side].rotation_euler = (-.15, 0, 0)
            self.legs[side].rotation_euler = (0, side * .04, 0)
            self.knees[side].rotation_euler = (0, 0, 0)
        self.sword.rotation_euler = (0, -.08, 0)
        self.shield.rotation_euler = (.08, -.10, 0)
        self.ward.scale = (0, 0, 0)
        if state == 1:
            self.hips.location.z += .025 * math.cos(phase * 2)
            for side in [-1, 1]:
                step = math.sin(phase + (PI if side == 1 else 0))
                self.legs[side].rotation_euler.x = step * .43
                self.knees[side].rotation_euler.x = -max(0, step) * .62
                self.arms[side].rotation_euler.x = -.08 - step * (.22 if side == -1 else .08)
        elif state == 16:
            # A committed downstroke at the middle contact phase, then recovery.
            index = min(7, round(progress * 7))
            self.arms[-1].rotation_euler.x = [-.15, -1.8, -2.6, -.6, .4, .1, -.1, -.15][index]
            self.forearms[-1].rotation_euler.x = [-.15, -.5, -.8, -.1, .1, 0, -.1, -.15][index]
            self.arms[-1].rotation_euler.z = [-.05, -.25, -.4, .15, .4, .2, .05, -.05][index]
            self.torso.rotation_euler.z = -.22 * math.sin(progress * 2 * PI)
            self.arms[1].rotation_euler.x = -.30
        elif state in [64, 128]:
            cast = math.sin(progress * PI)
            self.arms[1].rotation_euler.x = -.15 - .80 * cast
            self.forearms[1].rotation_euler.x = -.2 - .45 * cast
            self.arms[-1].rotation_euler.x = -.30 - .5 * cast
            self.torso.rotation_euler.x = -.05 * cast
            self.ward.scale = (cast, cast, cast)
            if state == 64:
                self.hips.location.z -= .10 * cast
                self.ward.scale *= 1.5
        elif state == 96:
            drop = min(1, max(0, (progress - .05) / .85))
            self.hips.location.z -= .12 * math.sin(drop * PI)
            self.fall.rotation_euler.x = drop * 1.48
            self.fall.location.y = .35 * drop
            self.arms[-1].rotation_euler.z = -.45 * drop
            self.arms[1].rotation_euler.z = .35 * drop
            self.knees[-1].rotation_euler.x = -.45 * math.sin(drop * PI)
        for i, vertex in enumerate(self.cape.data.vertices):
            x, y, z = self.cape_vertices[i]
            row = i // 6
            vertex.co = (x, y + math.sin(phase + row * .8) * row * .014,
                         z + math.sin(phase + x * 3) * row * .006)
        bpy.context.view_layer.update()


def render(scene, path):
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--preview', action='store_true')
    parser.add_argument('--sets', default='1,8,16,64,96,128')
    parser.add_argument('--renderer', choices=['workbench', 'eevee'], default='workbench')
    parser.add_argument('--directions', default='0,1,2,3,4,5,6,7')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    args.out.mkdir(parents=True, exist_ok=True)
    scene, camera = setup(384 if args.preview else 224, args.renderer)
    knight = Knight()
    bpy.ops.wm.save_as_mainfile(filepath=str(args.out / 'dark-paladin-model.blend'))
    counts = {1: 8, 8: 1, 16: 8, 64: 12, 96: 16, 128: 8}
    records = []
    for state in map(int, args.sets.split(',')):
        for direction in map(int, args.directions.split(',')):
            for frame in ([0] if args.preview else range(counts[state])):
                if args.preview and state != 8:
                    continue
                name = f'{state:03d}-{direction}-{frame:02d}.png'
                knight.pose(state, direction, frame, counts[state])
                render(scene, args.out / name)
                records.append(dict(state=state, direction=direction, frame=frame, file=name))
    (args.out / 'render-manifest.json').write_text(json.dumps(dict(
        format='majesty-original-dark-paladin-directional-render-v1',
        renderer=bpy.app.version_string, size=scene.render.resolution_x,
        cameraOrthoScale=camera.data.ortho_scale, frames=records,
        generatedFromOriginalGeometry=True, stockArtUsed=False), indent=2) + '\n')


if __name__ == '__main__':
    main()
