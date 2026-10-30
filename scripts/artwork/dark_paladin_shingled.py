"""Matching hand-laid slate roofs and a level-three church steeple.

Extend the frozen original-animation renderer; retain its native-scale camera,
hero assets, event animation, cumulative halls and open forecourt.
"""
import math,random,sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
import dark_paladin_guild_life as prior
from dark_paladin_scene import box,cylinder,mesh,beam,material
from dark_paladin_textured import weather
original_guild=prior.guild
original_scaffold=prior.custom_scaffold


def slate_faces(b,obj,shades):
    """Lay staggered, overlapping slates on each upward roof face in its plane."""
    rng=random.Random('slate:'+obj.name);verts=[];faces=[];indices=[]
    for face in obj.data.polygons:
        normal=face.normal.normalized()
        if normal.z<.10:continue
        points=[obj.data.vertices[i].co.copy()for i in face.vertices]
        # Object-space horizontal contours keep courses level on pyramids too.
        gravity=obj.matrix_world.inverted().to_3x3()@Vector((0,0,-1))
        down=gravity-normal*gravity.dot(normal)
        if down.length<.1:down=Vector((1,0,0))
        down.normalize();across=down.cross(normal).normalized();origin=points[0]
        poly=[Vector(((p-origin).dot(across),(p-origin).dot(down)))for p in points]
        # Transform object-scaled lengths to authored world shingle dimensions.
        world=obj.matrix_world.to_3x3();sx=(world@across).length;sy=(world@down).length
        row=.13/sy;width=.166/sx;gap=.008/sx
        lo=min(p.y for p in poly);hi=max(p.y for p in poly)
        def clip(subject,a,c):
            edge=c-a
            orient=sum(poly[i].x*poly[(i+1)%len(poly)].y-poly[(i+1)%len(poly)].x*poly[i].y for i in range(len(poly)))
            sign=1 if orient>0 else -1
            def dist(p):return sign*(edge.x*(p.y-a.y)-edge.y*(p.x-a.x))
            out=[]
            for i,p in enumerate(subject):
                q=subject[(i+1)%len(subject)];dp,dq=dist(p),dist(q)
                if dp>=-1e-7:out.append(p)
                if(dp>=0)!=(dq>=0):out.append(p+(q-p)*(dp/(dp-dq)))
            return out
        for r in range(math.ceil((hi-lo)/row)):
            v=lo+r*row;left=min(p.x for p in poly)-width+(width*.5 if r%2 else 0);right=max(p.x for p in poly)
            for col in range(math.ceil((right-left)/width)):
                u=left+col*width
                shape=[Vector((u+gap,v)),Vector((u+width-gap,v)),Vector((u+width-gap,min(hi,v+row*1.15))),Vector((u+gap,min(hi,v+row*1.15)))]
                for i in range(len(poly)):
                    if not shape:break
                    shape=clip(shape,poly[i],poly[(i+1)%len(poly)])
                if len(shape)<3:continue
                shade=rng.randrange(len(shades));base=len(verts);lift=(.015+.012*(r%2))/(world@normal).length
                for p in shape:verts.append(origin+across*p.x+down*p.y+normal*lift)
                faces.append(tuple(range(base,len(verts))));indices.append(shade)
                # A dark exposed lower edge gives slates readable thickness.
                n=len(shape)
                for p in shape:verts.append(origin+across*p.x+down*p.y+normal*(lift-.018/(world@normal).length))
                for i in range(n):faces.append((base+i,base+(i+1)%n,base+n+(i+1)%n,base+n+i));indices.append(max(0,shade-2))
    if not faces:return
    out=mesh('Matching hand-laid shingles '+obj.name,verts,faces,shades[0],obj)
    for mat in shades[1:]:out.data.materials.append(mat)
    for face,index in zip(out.data.polygons,indices):face.material_index=index
    # Parent to the cap so native damage/collapse transforms remain coherent.
    out.matrix_parent_inverse.identity()
    return out


def guild(level):
    scene,b=original_guild(level)
    if level==3:
        # The extra watchtower is replaced by a steeple rising from the nave.
        for o in list(bpy.data.objects):
            if o.name.startswith(('Rear watchtower','Watchtower front lancet')):
                for group in [b.roofs,b.glass]:
                    if o in group:group.remove(o)
                bpy.data.objects.remove(o,do_unlink=True)
        stone=b.stone;slate=bpy.data.materials['Weathered charcoal slate'];bronze=bpy.data.materials['Aged bronze ironwork']
        x,y=0,.55
        box('Steeple roof saddle',(x,y,4.32),(1.05,1.06,.30),stone,b.structure,.025)
        box('Steeple bell chamber',(x,y,4.94),(.86,.90,1.18),stone,b.structure,.025)
        box('Steeple carved cornice',(x,y,5.55),(1.06,1.10,.14),stone,b.structure,.018)
        dark=material('Steeple bell opening shadow',(.009,.013,.012))
        b.arch('Steeple pointed bell opening',x,y-.46,4.56,.25,.42,dark)
        box('Steeple east bell opening',(x+.44,y,4.94),(.018,.34,.62),dark,b.structure,.06)
        bell=cylinder('Steeple aged bronze bell',(x,y-.45,4.91),.145,.24,bronze,b.structure,vertices=16,top=.065);b.roofs.append(bell)
        cap=cylinder('Steeple steep slate spire',(x,y,6.16),.83,1.12,slate,b.structure,vertices=4,top=0);cap.rotation_euler.z=math.pi/4;b.roofs.append(cap)
        finial=cylinder('Steeple forged ridge finial',(x,y,6.80),.026,.25,bronze,b.structure,vertices=8,top=0);b.roofs.append(finial)
    bpy.context.view_layer.update()
    shades=[bpy.data.materials['Individual weathered slate shade '+str(i)]for i in range(7)]
    names=('Steep belfry slate spire','Tall pitched tower roof','Gallery sloping slate roof','East wing weathered slate cover','Rear range slate cover','Training wing slate roof','Steeple steep slate spire','Gabled entrance porch')
    shingles=[]
    for obj in list(bpy.data.objects):
        if obj.type=='MESH'and obj.name.startswith(names):
            tile=slate_faces(b,obj,shades)
            if tile:shingles.append((obj,tile));b.roofs.append(tile)
    pose=b.pose
    def shingled_pose(damage=0,collapse=0):
        pose(damage,collapse)
        for roof,tile in shingles:tile.hide_render=roof.hide_render
    b.pose=shingled_pose
    return scene,b


def scaffold(b,target,stage):
    if target!=3:return original_scaffold(b,target,stage)
    # Work rises above the existing roof instead of around a rear watchtower.
    oak=material('Steeple works scaffold oak',(.27,.16,.07));weather(oak,'wood')
    for x in [-.72,.72]:
        for y in [-.15,1.26]:beam('Steeple scaffold upright',(x,y,3.45),(x,y,5.82),.045,oak,b.structure)
    for z in [4.15,4.95,5.66]:
        for y in [-.15,1.26]:
            box('Steeple scaffold plank deck',(0,y,z),(1.60,.28,.065),oak,b.structure,.008)
            beam('Steeple scaffold diagonal',(-.72,y,z+.05),(.72,y,min(z+.65,5.82)),.032,oak,b.structure)
    if stage==1:box('Steeple ongoing bell chamber',(0,.55,4.67),(.86,.90,.65),b.stone,b.structure,.02)


if __name__=='__main__':
    prior.guild=guild;prior.custom_scaffold=scaffold;prior.main()
