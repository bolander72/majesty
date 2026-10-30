"""Native-scale weathered Dark Paladin building and articulated hero artwork.

Extends frozen prior renderers without rewriting historical qualification inputs.
All textures and added geometry are original and deterministic.
"""
import argparse,json,math,random,sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from dark_paladin_scene import setup,Knight,mesh,box,beam,material,render,sphere,cylinder
from dark_paladin_domain import Chapterhouse
from dark_paladin_domain_tiers import expand


def weather(mat,kind):
    n=mat.node_tree.nodes;l=mat.node_tree.links;b=n.get('Principled BSDF')
    for link in list(b.inputs['Base Color'].links)+list(b.inputs['Normal'].links):l.remove(link)
    tex=n.new('ShaderNodeTexCoord');noise=n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value=36 if kind!='cloth' else 85
    noise.inputs['Detail'].default_value=4
    l.new(tex.outputs['Generated'],noise.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB')
    colors={'stone':((.105,.10,.083),(.43,.40,.33)),
            'trim':((.15,.139,.111),(.46,.42,.34)),
            'slate':((.025,.035,.039),(.12,.135,.14)),
            'iron':((.018,.024,.025),(.26,.28,.265)),
            'brass':((.13,.077,.022),(.46,.305,.104)),
            'cloth':((.009,.034,.031),(.028,.117,.103)),
            'wood':((.027,.014,.007),(.115,.063,.023)),
            'chain':((.025,.031,.032),(.16,.17,.16))}
    low,high=colors[kind]
    ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[0].color=(*low,1)
    ramp.color_ramp.elements[1].position=.82;ramp.color_ramp.elements[1].color=(*high,1)
    l.new(noise.outputs['Fac'],ramp.inputs['Fac']);color=ramp.outputs['Color']
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.35
    bump.inputs['Distance'].default_value=.04 if kind in ['stone','trim'] else .012
    l.new(noise.outputs['Fac'],bump.inputs['Height'])
    if kind in ['stone','trim']:
        # Brick courses use world-space XZ/YZ selected by the surface normal.
        geom=n.new('ShaderNodeNewGeometry');sep=n.new('ShaderNodeSeparateXYZ');l.new(geom.outputs['Position'],sep.inputs[0])
        ns=n.new('ShaderNodeSeparateXYZ');l.new(geom.outputs['Normal'],ns.inputs[0])
        ab=n.new('ShaderNodeMath');ab.operation='ABSOLUTE';l.new(ns.outputs['X'],ab.inputs[0])
        xy=n.new('ShaderNodeMix');xy.data_type='FLOAT';l.new(ab.outputs[0],xy.inputs[0]);l.new(sep.outputs['X'],xy.inputs[2]);l.new(sep.outputs['Y'],xy.inputs[3])
        vec=n.new('ShaderNodeCombineXYZ');l.new(xy.outputs[0],vec.inputs['X']);l.new(sep.outputs['Z'],vec.inputs['Y'])
        brick=n.new('ShaderNodeTexBrick');l.new(vec.outputs[0],brick.inputs['Vector'])
        brick.inputs['Scale'].default_value=1;brick.inputs['Brick Width'].default_value=.255
        brick.inputs['Row Height'].default_value=.125;brick.inputs['Mortar Size'].default_value=.007
        brick.inputs['Mortar Smooth'].default_value=.001;brick.inputs['Bias'].default_value=.1
        brick.inputs['Color1'].default_value=(*low,1);brick.inputs['Color2'].default_value=(*high,1)
        brick.inputs['Mortar'].default_value=(.022,.022,.017,1)
        mix=n.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.20
        l.new(brick.outputs['Color'],mix.inputs[1]);l.new(color,mix.inputs[2]);color=mix.outputs[0]
        detail=n.new('ShaderNodeBump');detail.inputs['Strength'].default_value=.65;detail.inputs['Distance'].default_value=.018
        l.new(brick.outputs['Fac'],detail.inputs['Height']);l.new(bump.outputs[0],detail.inputs['Normal']);bump=detail
    if kind=='chain':
        vor=n.new('ShaderNodeTexVoronoi');vor.distance='EUCLIDEAN';vor.inputs['Scale'].default_value=65
        l.new(tex.outputs['Generated'],vor.inputs['Vector']);l.new(vor.outputs['Distance'],bump.inputs['Height'])
        bump.inputs['Strength'].default_value=.7
    l.new(color,b.inputs['Base Color']);l.new(bump.outputs[0],b.inputs['Normal'])
    b.inputs['Roughness'].default_value=.87 if kind not in ['iron','brass','chain'] else .61
    b.inputs['Metallic'].default_value=.55 if kind in ['iron','brass','chain'] else 0


def lighting(scene):
    scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.26
    for o in bpy.data.objects:
        if o.type=='LIGHT':
            o.data.energy={'Warm upper-left key':480,'Soft sky fill':65,'Rear separation':65}[o.name]
            o.data.size=3
    scene.render.resolution_percentage=100
    scene.render.image_settings.compression=20
    scene.render.engine='BLENDER_EEVEE_NEXT'
    if hasattr(scene,'eevee'):scene.eevee.taa_render_samples=16


def guild(level):
    scene,camera=setup(640,'eevee');scene.render.resolution_y=520
    b=Chapterhouse(camera,1)
    if level>=2:expand(b,level)
    # Remove the original oversized surface blocks; the continuous underlying
    # wall receives small individually shaded masonry courses instead.
    for o in list(bpy.data.objects):
        if o.name.startswith(('Front ashlar block','East ashlar block','Overlapping hand-cut slate','Tower masonry course')):
            if o in b.roofs:b.roofs.remove(o)
            bpy.data.objects.remove(o,do_unlink=True)
    for mat in list(bpy.data.materials):
        name=mat.name.lower()
        if any(x in name for x in ['limestone','masonry','stone','quoin','tower dressed','carved surround']):
            weather(mat,'trim' if any(x in name for x in ['carved','dressed']) else 'stone')
        elif any(x in name for x in ['slate','roof']):weather(mat,'slate')
        elif any(x in name for x in ['cloth','standard']):weather(mat,'cloth')
        elif any(x in name for x in ['bronze','bell']):weather(mat,'brass')
        elif 'oak' in name:weather(mat,'wood')
    for o in bpy.data.objects:
        if o.name.startswith('Cut stone courtyard foundation'):
            o.scale.z*=.50
            earth=material('Foundation warm worn stone',(.20,.16,.10));weather(earth,'stone')
            o.data.materials.clear();o.data.materials.append(earth)
    hall=bpy.data.objects['Limestone hall body'];hall.data.materials.clear();hall.data.materials.append(b.stone)
    # Fine overlapping slate courses, authored in one mesh per roof slope.
    rng=random.Random(30);shades=[]
    for i in range(7):
        m=material('Individual weathered slate shade '+str(i),(.045+i*.009,.055+i*.009,.06+i*.009));weather(m,'slate')
        for node in m.node_tree.nodes:
            if node.type=='VALTORGB':
                for e in node.color_ramp.elements:e.color=tuple(c*(.62+i*.13)for c in e.color[:3])+(1,)
        shades.append(m)
    for side in [-1,1]:
        verts=[];faces=[];inds=[]
        for row in range(19):
            x=side*(.025+row*.109);z=4.42-abs(x)*1.70/2.04
            for col in range(29):
                y=-2.30+col*.166+(.077 if row%2 else 0)
                y=min(y,2.40);dx=.145;dy=.161
                j=len(verts)
                z+=rng.uniform(.002,.025)
                verts.extend([(x-side*dx/2,y,z+.016+dx/2*1.70/2.04),(x+side*dx/2,y,z+.016-dx/2*1.70/2.04),(x+side*dx/2,y+dy,z+.016-dx/2*1.70/2.04),(x-side*dx/2,y+dy,z+.016+dx/2*1.70/2.04)])
                faces.append((j,j+1,j+2,j+3));shade=rng.randrange(7);inds.append(shade)
                # Exposed eaves and bottom lips cast native-scale shingle shadows.
                verts.extend([(vx,vy,vz-.024)for vx,vy,vz in verts[j:j+4]])
                for f in [(j,j+4,j+5,j+1),(j+1,j+5,j+6,j+2),(j+2,j+6,j+7,j+3),(j+3,j+7,j+4,j)]:faces.append(f);inds.append(max(0,shade-2))
        o=mesh('Dense hand-laid slate roof '+str(side),verts,faces,shades[0],b.structure)
        for m in shades[1:]:o.data.materials.append(m)
        for p,i in zip(o.data.polygons,inds):p.material_index=i
        b.roofs.append(o)
    # Side gallery becomes a shadowed arcade rather than a blank solid slab.
    if level>=2:
        for y in [-1.25,-.65,-.05]:
            dark=material('Gallery deep arcade '+str(y),(.006,.010,.008))
            box('Gallery deep arched bay',(2.503,y,1.08),(.028,.43,.94),dark,b.structure,.12)
            box('Gallery stone sill',(2.54,y,.55),(.11,.50,.10),b.stone,b.structure,.01)
        for o in bpy.data.objects:
            if o.name.startswith('Gallery recessed lancet'):o.hide_render=True
    # One shared guild mark on banners and hero shield.
    badge=bpy.data.materials['Aged bronze ironwork']
    for o in list(bpy.data.objects):
        if any(n in o.name.lower()for n in ['eclipse emblem','standard eclipse','bronze eclipse']):
            x,y,z=o.location;parent=o.parent
            bpy.data.objects.remove(o,do_unlink=True)
            for dx in [-.06,0,.06]:
                h=.12 if dx else .19
                beam('Chapterhouse sword sigil',(x+dx,y-.015,z-.09),(x+dx,y-.015,z+h),.012,badge,parent)
                mesh('Chapterhouse sword point',[(x+dx-.025,y-.02,z+h-.02),(x+dx+.025,y-.02,z+h-.02),(x+dx,y-.02,z+h+.035)],[(0,1,2)],badge,parent)
    # Larger stained glass aperture and timber gates establish human scale.
    glass=material('Warm chapterhouse windows',(.37,.18,.035))
    bs=glass.node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(.7,.30,.04,1);bs.inputs['Emission Strength'].default_value=.25
    b.arch('Tall amber entrance lancet',0,-2.25,2.30,.23,.62,glass)
    if level==3:
        wood=material('Weathered fortified oak gate',(.10,.05,.018));weather(wood,'wood')
        b.arch('Fortified oak gate leaves',0,-4.30,.25,1.20,.92,wood)
        iron=material('Gate strap black iron',(.025,.025,.018),.4)
        for z in [.61,1.05,1.55]:box('Forged iron gate strap',(0,-4.34,z),(2.28,.04,.07),iron,b.structure,.005)
        for x in [-.94,-.63,-.31,0,.31,.63,.94]:box('Gate individual oak plank joint',(x,-4.35,.92),(.018,.025,1.20),iron,b.structure,.001)
    # Break the clean foundation edge with planted tufts and fallen small stones.
    moss=material('Muted moss',(.035,.052,.016));weather(moss,'cloth')
    for i in range(70):
        side=-1 if i%2 else 1;y=rng.uniform(-4,2.5);x=side*rng.uniform(2.60,2.87)
        o=box('Grounded moss and stone edge',(x,y,.23),(rng.uniform(.05,.15),rng.uniform(.05,.14),.05),moss,b.root,.02)
    lighting(scene);return scene,b


def hero():
    scene,camera=setup(224,'eevee');k=Knight()
    for m in list(bpy.data.materials):
        name=m.name.lower()
        if any(x in name for x in ['iron','steel']):weather(m,'iron')
        elif any(x in name for x in ['bronze','pommel']):weather(m,'brass')
        elif 'cloth' in name:weather(m,'cloth')
    # Native sprites use painted metal contrast rather than dark physically
    # reflective metal, which loses the approved weathering at this small scale.
    for name in ['Dark hammered iron','Worn steel blade','Weathered bronze edges']:
        m=bpy.data.materials[name];bs=m.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Metallic'].default_value=.18;bs.inputs['Roughness'].default_value=.48
        for node in m.node_tree.nodes:
            if node.type=='VALTORGB':
                if name!='Weathered bronze edges':
                    node.color_ramp.elements[0].color=(.035,.043,.044,1)
                    node.color_ramp.elements[1].color=(.43,.46,.43,1)
                node.color_ramp.elements[0].position=.34;node.color_ramp.elements[1].position=.69
    chain=material('Visible linked mail',(.07,.08,.07),.5);weather(chain,'chain')
    for o in bpy.data.objects:
        if o.name.startswith(('Body underarmor','Upper arm plate','Armored thigh')):
            o.data.materials.clear();o.data.materials.append(chain)
        if o.name.startswith(('Iron pauldron','Bronze pauldron rim')):o.scale*=.82
    iron=bpy.data.materials['Dark hammered iron'];edge=bpy.data.materials['Weathered bronze edges']
    # Rounded forged plates replace the old cubic chest and spherical shoulders.
    for o in list(bpy.data.objects):
        if o.name.startswith(('Breastplate','Angular breastplate','Iron pauldron','Bronze pauldron','Closed angular greathelm','Divided front tabard')):
            bpy.data.objects.remove(o,do_unlink=True)
    sphere('Forged rounded cuirass',(0,-.01,.43),(.335,.235,.35),iron,k.torso)
    for side in [-1,1]:
        arm=k.arms[side]
        sphere('Compact articulated pauldron',(0,0,.025),(.19,.20,.14),iron,arm)
        for i in range(3):
            o=sphere('Overlapping shoulder lame',(0,.005,-.06-i*.038),(.18-i*.012,.18-i*.01,.055),iron,arm)
            beam('Pauldron fine brass edging',(-.14, -.14,-.02-i*.04),(.14,-.14,-.02-i*.04),.008,edge,arm)
    verts=[];faces=[];segments=20
    for z,rx,ry in [(0,.215,.185),(.25,.25,.218),(.40,.20,.185),(.49,.085,.09),(.515,.005,.005)]:
        for i in range(segments):
            a=2*math.pi*i/segments;verts.append((rx*math.cos(a),ry*math.sin(a),z))
    for row in range(4):
        for i in range(segments):faces.append((row*segments+i,row*segments+(i+1)%segments,(row+1)*segments+(i+1)%segments,(row+1)*segments+i))
    helmet=mesh('Rounded forged closed greathelm',verts,faces,iron,k.neck)
    for f in helmet.data.polygons:f.use_smooth=True
    # The vertical visor remains black and narrow; crown seams carry the brass.
    for side in [-1,1]:
        verts=[]
        for row in range(6):
            for col in range(5):
                x=side*(.035+col*.041);z=-.04-row*.105
                verts.append((x,-.26-.025*math.sin(col*math.pi/2),z+(.018*math.sin(col*2)if row==5 else 0)))
        faces=[(r*5+c,r*5+c+1,(r+1)*5+c+1,(r+1)*5+c)for r in range(5)for c in range(4)]
        mesh('Folded hanging cloth tabard',verts,faces,bpy.data.materials['Deep teal cloth'],k.hips)
    # Deep folded rear cloth, still driven by the original articulated motion.
    for i,(x,y,z)in enumerate(k.cape_vertices):
        col=i%6;row=i//6;k.cape_vertices[i]=(x,y+(.04 if col%2 else -.03),z+(.035*math.sin(col*3)if row==4 else 0))
    # Replace the asymmetric primitive shield with the approved tall heater form.
    for o in list(k.shield.children):
        if o.type=='MESH':bpy.data.objects.remove(o,do_unlink=True)
    edge=bpy.data.materials['Weathered bronze edges'];cloth=bpy.data.materials['Deep teal cloth']
    outline=[(-.29,.51),(.29,.51),(.27,-.14),(.17,-.42),(0,-.65),(-.17,-.42),(-.27,-.14)]
    mesh('Brass bound heater shield',[(x,-.1,z)for x,z in outline],[tuple(range(7))],edge,k.shield)
    mesh('Weathered teal shield face',[(x*.90,-.115,z*.92)for x,z in outline],[tuple(range(7))],cloth,k.shield)
    for x in [-.16,0,.16]:
        beam('Guild sword sigil shaft',(x,-.13,-.25),(x,-.13,.22 if x else .36),.018,edge,k.shield)
        tip=.22 if x else .36
        mesh('Guild sword sigil point',[(x-.048,-.14,tip-.035),(x+.048,-.14,tip-.035),(x,-.14,tip+.065)],[(0,1,2)],edge,k.shield)
    beam('Sigil lower join',(-.16,-.13,-.25),(0,-.13,-.40),.018,edge,k.shield);beam('Sigil lower join',(0,-.13,-.40),(.16,-.13,-.25),.018,edge,k.shield)
    # A folded shoulder mantle ties cloak and front tabard together.
    mesh('Teal shoulder mantle',[(-.40,-.16,.70),(-.18,-.29,.75),(.25,-.25,.71),(.35,-.13,.58),(.17,-.30,.48),(-.18,-.28,.46),(-.46,-.05,.47)],[(0,1,5,6),(1,2,4,5),(2,3,4)],cloth,k.torso)
    for side in [-1,1]:
        for i in range(3):
            beam('Fine articulated cuirass bands',(side*.08,-.252,.12+i*.07),(side*.29,-.252,.12+i*.07),.008,edge,k.torso)
    lighting(scene)
    bpy.data.lights['Warm upper-left key'].energy=720
    return scene,k


def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);p.add_argument('--kind',choices=['hero','guild'],required=True);p.add_argument('--guild-level',type=int,default=1);p.add_argument('--preview',action='store_true');p.add_argument('--construction-only',action='store_true');p.add_argument('--sets',default='1,8,16,64,96,128');p.add_argument('--directions',default='0,1,2,3,4,5,6,7')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);a.out.mkdir(parents=True,exist_ok=True);records=[]
    scene,obj=hero() if a.kind=='hero' else guild(a.guild_level)
    bpy.ops.wm.save_as_mainfile(filepath=str(a.out/'original-textured-model.blend'))
    if a.kind=='hero':
        counts={1:8,8:1,16:8,64:12,96:16,128:8}
        for state in map(int,a.sets.split(',')):
            for d in map(int,a.directions.split(',')):
                for f in ([0] if a.preview else range(counts[state])):
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
    (a.out/'render-manifest.json').write_text(json.dumps(dict(format='majesty-textured-dark-paladin-v1',level=a.guild_level,kind=a.kind,frames=records,generatedFromOriginalGeometry=True,stockArtUsed=False),indent=2)+'\n')

if __name__=='__main__':main()
