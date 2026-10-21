"""Reference-led terrain; Blender geometry with metadata for the existing game renderer.

Blender uses (x, -game_z, game_y). The exported GLB is game Y-up in metres.
No changes to the game's art direction are baked into this asset.
"""
import json
import math
from pathlib import Path
import random
import struct
import sys

import bpy
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from island_geometry import (box,beam,collection,material,mesh,nearest,inside,
    polygon_distance,rock,round_outline,smooth,strip)

GAME=HERE.parent
OUT=GAME/'static'/'island'
SOURCE=GAME.parent/'assets'/'island-v2'
OUT.mkdir(parents=True,exist_ok=True)
SOURCE.mkdir(parents=True,exist_ok=True)
RNG=random.Random(63081)
SIZE=192
N=257
STEP=SIZE/(N-1)

# Asymmetric western town, a deep south-west port bay and a separate volcano lobe.
SHORE=round_outline([(-74,-22),(-70,-34),(-60,-41),(-56,-55),(-47,-68),
    (-33,-75),(-15,-74),(0,-81),(15,-76),(32,-79),(45,-68),(47,-54),
    (55,-44),(50,-29),(54,-15),(47,-3),(55,10),(58,25),(51,39),
    (38,43),(25,40),(20,48),(26,58),(20,72),(6,79),(-9,75),(-18,65),
    (-21,51),(-17,40),(-26,33),(-36,28),(-47,24),(-58,23),(-60,13),
    (-72,12),(-78,4),(-77,-10)],4)
LOW=[(-24,-46),(-5,-67),(21,-69),(41,-58),(46,-36),(43,-16),
     (49,6),(43,24),(29,36),(9,31),(-4,19),(-18,6),(-22,-14)]
MID=[(-23,-52),(-13,-63),(3,-60),(19,-51),(24,-37),(16,-20),
     (21,-6),(11,2),(-5,-1),(-17,-16),(-24,-32)]
HIGH=[(-37,-66),(-24,-72),(-11,-66),(-9,-57),(-18,-48),(-34,-47),(-40,-55)]


def curve(anchors):
    result=[]
    for i,(a,b) in enumerate(zip(anchors,anchors[1:])):
        p=Vector(anchors[max(0,i-1)][:2]);q=Vector(a[:2]);r=Vector(b[:2]);s=Vector(anchors[min(len(anchors)-1,i+2)][:2])
        count=max(3,math.ceil((r-q).length/2))
        for j in range(count):
            t=j/count
            v=.5*(2*q+(-p+r)*t+(2*p-5*q+4*r-s)*t*t+(-p+3*q-3*r+s)*t*t*t)
            result.append([v.x,v.y,a[2]+(b[2]-a[2])*t])
    return result+[list(anchors[-1])]


ROUTES=[
    dict(id='town-frontage',kind='road',width=4.8,points=curve([(-66,-23,.4),(-55,-17,.4),(-40,-10,.4),(-24,3,.4),(-17,16,.4),(0,24,.4),(18,24,.4)])),
    dict(id='town-cross-street',kind='road',width=4.8,points=curve([(-55,-17,.4),(-56,-3,.4),(-57,10,.4),(-54,20,.4)])),
    dict(id='harbor-approach',kind='road',width=4.8,points=curve([(-56,-3,.4),(-65,-2,.4),(-73,3,.4)])),
    dict(id='west-coast-walk',kind='path',width=3,points=curve([(-66,-23,.4),(-60,-35,1),(-51,-44,3.5),(-43,-54,8),(-33,-61,12.6)])),
    dict(id='garden-ascent',kind='path',width=3.1,points=curve([(18,24,.4),(30,24,2),(38,18,4),(39,8,5.2),(30,0,5.2),(18,-1,5.2),(9,-9,6.5),(4,-21,9.7)])),
    dict(id='garden-loop',kind='path',width=3,points=curve([(4,-21,9.7),(-6,-24,9.7),(-7,-33,9.7),(2,-40,9.7),(12,-34,9.7),(13,-25,9.7),(4,-21,9.7)])),
    dict(id='east-coastal-trail',kind='path',width=3.1,points=curve([(39,8,5.2),(46,-3,5.2),(43,-15,5.2),(38,-29,5.2),(39,-41,6.5),(35,-50,10),(29,-54,14)])),
    dict(id='upper-ridge-path',kind='path',width=3,points=curve([(-7,-33,9.7),(-17,-40,10),(-24,-48,11.5),(-33,-61,12.6),(-24,-65,12.6)])),
    dict(id='beach-access',kind='path',width=2.5,points=curve([(30,24,2),(39,29,1),(47,32,.22)])),
]
SITES=[dict(id='product-manager',respawn='career',x=-45,z=-10),
       dict(id='frontend-developer',respawn='projects',x=-33,z=-5),
       dict(id='backend-developer',respawn='behindTheScene',x=-6,z=21),
       dict(id='data-analyst',respawn='achievements',x=-59,z=-27),
       dict(id='ui-ux-designer',respawn='social',x=31,z=8),
       dict(id='ml-engineer',respawn='lab',x=2,z=-31)]


def routes_nearest(x,z):
    best=(999,0,None)
    for route in ROUTES:
        d,h,_,_=nearest(x,z,route['points'])
        if d-route['width']/2<best[0]:
            best=(d-route['width']/2,h,route)
    return best


def land_height(x,z):
    d=polygon_distance(x,z,SHORE)
    if d < -7:
        return -2.5
    h=-1.5+1.9*smooth(-4,3,d)
    h+=4.8*smooth(-.8,1.3,polygon_distance(x,z,LOW))
    h+=4.5*smooth(-.8,1.3,polygon_distance(x,z,MID))
    h+=12.2*smooth(-.8,1.4,polygon_distance(x,z,HIGH))
    # Large NE headland; rock pillars taper at several heights, not one cone.
    q=math.hypot((x-30)/17,(z+62)/20)
    if q<1.1:
        headland=5.2+19*(1-smooth(.42,1.05,q))
        h=max(h,headland)
    # The recognisable dormant volcano occupies its own southern peninsula.
    q=math.hypot((x-2)/22,(z-57)/20)
    if q<1.08:
        angle=math.atan2(z-57,x-2)
        ridge=17.7+(.7*math.sin(13*angle)+.4*math.sin(21*angle))*smooth(.25,.5,q)
        v=2.1+ridge*smooth(.28,.47,q) if q<.48 else .4+ridge*(1-smooth(.48,1.03,q))
        h=max(h,v)
    if d<3:
        h=-1.5+(h+1.5)*smooth(-4,3,d)
    # Low, irregular rocks under the turf round silhouette without faceted colour patches.
    h+=.13*math.sin(x*.27)*math.sin(z*.31)*smooth(2,7,d)
    distance,elevation,route=routes_nearest(x,z)
    width=1.3 if route and route['kind']=='road' else .8
    w=1-smooth(width,width+1.7,distance)
    h=h*(1-w)+elevation*w
    for site in SITES:
        sx,sz=site['x'],site['z']
        if abs(x-sx)<5 and abs(z-sz)<5:
            sh=.4 if site['id'] not in ('ui-ux-designer','ml-engineer') else 5.2 if site['id']=='ui-ux-designer' else 9.7
            w=1-smooth(3,5,math.hypot(x-sx,z-sz))
            h=h*(1-w)+sh*w
    # Port platform is flush with the town plain.
    if -81<x<-62 and -6<z<11:
        h=max(h,.4)
    return h


print('REFERENCE_ISLAND: building terrain grid',flush=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections): bpy.data.collections.remove(c)
terrain_col=collection('01_Reference_Terrain')
paths_col=collection('02_Curved_Roads')
rocks_col=collection('03_Reef_Arcs_and_Islets')
town_col=collection('04_Town_Shells')
staging=collection('90_Preview_Only')
turf=material('native_turf',(0.72,.71,.18))
stone=material('native_rock',(.49,.41,.33))
sand=material('native_sand',(1,.69,.34))
pathmat=material('native_path',(1,.81,.55))
asphalt=material('native_road',(.22,.19,.22))
paint=material('native_road_paint',(.96,.79,.38))
concrete=material('native_paving',(.76,.69,.57))
basalt=material('native_basalt',(.24,.25,.26))
timber=material('native_timber',(.46,.28,.17))
heights=[]
vertices=[]
for j in range(N):
    z=-SIZE/2+j*STEP
    for i in range(N):
        x=-SIZE/2+i*STEP
        h=land_height(x,z)
        heights.append(h)
        vertices.append((x,-z,h))
faces=[];indices=[]
for j in range(N-1):
    for i in range(N-1):
        a=j*N+i;b=a+1;c=a+N;d=c+1
        # Reverse from world XZ into Blender XY so normals face upwards.
        for face in [(a,c,b),(b,c,d)]:
            faces.append(face)
            hs=[heights[k] for k in face]
            grade=(max(hs)-min(hs))/STEP
            center_h=sum(hs)/3
            indices.append(1 if grade>.72 and center_h>.8 else 2 if center_h<.24 else 0)
ground=mesh('ReferenceIslandGround',vertices,faces,terrain_col,[turf,stone,sand],indices)
ground['island_role']='ground'
for p in ground.data.polygons:p.use_smooth=True


def game_surface(x,blender_y):return land_height(x,-blender_y)


print('REFERENCE_ISLAND: curved routes and port',flush=True)
for route in ROUTES:
    points=[(p[0],-p[1],p[2]) for p in route['points']]
    obj=strip(route['id'],points,route['width'],paths_col,
              asphalt if route['kind']=='road' else pathmat,game_surface,offset=.07)
    obj['island_role']='road' if route['kind']=='road' else 'path'
    obj.visible_shadow=False
    if route['kind']=='road':
        for i in range(2,len(points)-2,4):
            obj=strip('Road_Dash',points[i:i+2],.12,paths_col,paint,game_surface,offset=.085)
            obj['island_role']='paint';obj.visible_shadow=False
box('Port_Quay',(-72,-2,-.15),(19,17,1.1),town_col,concrete,.15)
for x in [-80,-75,-70,-65]:
    box('Quay_Bollard',(x,-10,.65),(.3,.3,.5),town_col,basalt,.08)

# Small shells establish town scale and the reference's frontage; separate, replaceable assets.
wall=material('native_town_plaster',(.92,.78,.57))
brick=material('native_town_brick',(.67,.37,.24))
blue=material('native_roof_blue',(.25,.43,.58))
tile=material('native_roof_tile',(.65,.33,.23))
glass=material('native_window',(.24,.34,.39))
buildings=[]


def building(name,x,z,w,d,h,roofmat,bodymat):
    y=land_height(x,z)
    buildings.append(dict(name=name,x=x,z=z,y=y,width=w,depth=d,height=h))
    box(name+'_walls',(x,-z,y+h/2),(w,d,h),town_col,bodymat,.10)
    # Pitched roof with overhang, avoiding flat Lego-like blocks.
    v=[(-w/2-.35,-d/2-.35,0),(w/2+.35,-d/2-.35,0),(w/2+.35,d/2+.35,0),(-w/2-.35,d/2+.35,0),
       (0,-d/2-.35,1.5),(0,d/2+.35,1.5)]
    obj=mesh(name+'_roof',[(x+a,-z+b,y+h+c) for a,b,c in v],[(0,1,4),(3,5,2),(0,4,5,3),(1,2,5,4),(0,3,2,1)],town_col,[roofmat])
    for level in range(max(1,int(h/2.6))):
        for k in range(max(2,int(w/1.8))):
            xx=x-w*.34+k*w*.68/max(1,int(w/1.8)-1)
            box(name+'_window',(xx,-z+d/2+.018,y+1.3+level*2.6),(.75,.055,.95),town_col,glass,.04)
    box(name+'_door',(x,-z+d/2+.04,y+1.05),(1.1,.09,2.1),town_col,timber,.05)


building('Blue_Roof_Port',-74,5,11,6,4.0,blue,wall)
for args in [('West_House',-63,-24,6,5,4.2,blue,wall),
             ('Town_Studio',-48,-17,7,6,6.6,tile,brick),
             ('Town_Hall',-39,-10,7,6,4.8,blue,wall),
             ('Corner_House',-57,5,5,5,4.5,tile,wall),
             ('Frontage_Block',-25,9,6,5,8.0,tile,brick),
             ('Frontage_Block_B',-18,16,5,5,7.0,tile,brick),
             ('Coastal_House',12,22,6,5,4.0,blue,wall)]:
    building(*args)

# Irregular arc around the volcano lagoon, open at the port; not a uniform perimeter.
for i in range(55):
    t=math.radians(4+211*i/54)
    x=10+57*math.cos(t)+RNG.uniform(-1.1,1.1)
    z=48+36*math.sin(t)+RNG.uniform(-1.1,1.1)
    if inside(x,z,SHORE) or i%12 in [3,4]:continue
    rock('Volcanic_Reef',(x,-z,-.25),(RNG.uniform(1.3,3.0),RNG.uniform(1,2.2),RNG.uniform(.7,2.0)),rocks_col,basalt,400+i)
for cx,cz,rx,rz in [(65,48,5.8,4.5),(50,72,7,5),(61,-53,3.8,3.2)]:
    # Low satellite beaches and rock clusters, with independent, nonuniform silhouettes.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=1,location=(cx,-cz,-.7))
    obj=bpy.context.object
    for old in list(obj.users_collection):old.objects.unlink(obj)
    rocks_col.objects.link(obj);obj.name='Offshore_Sand_Islet';obj.scale=(rx,rz,1.1);obj.data.materials.append(sand)
    for p in obj.data.polygons:p.use_smooth=True
    for k in range(3):rock('Islet_Basalt',(cx+RNG.uniform(-rx,rx),-cz+RNG.uniform(-rz,rz),0),(1.1,1.0,1.2),rocks_col,basalt,600+k+int(cx))

# Exact grid for native Rapier heightfield and TSL grass placement.
(OUT/'heights.f32').write_bytes(struct.pack('<'+'f'*len(heights),*heights))

def sampled(x,z):
    i=max(0,min(N-2,int((x+96)/STEP)));j=max(0,min(N-2,int((z+96)/STEP)))
    tx=(x+96)/STEP-i;tz=(z+96)/STEP-j
    return (heights[j*N+i]*(1-tx)+heights[j*N+i+1]*tx)*(1-tz)+(heights[(j+1)*N+i]*(1-tx)+heights[(j+1)*N+i+1]*tx)*tz


def slope(x,z):
    return math.hypot(sampled(x+.5,z)-sampled(x-.5,z),sampled(x,z+.5)-sampled(x,z-.5))

# Native terrain mask: R paving, G grass coverage, B water depth (same shader contract).
pixels=[];map_pixels=[]
for j in range(N):
    for i in range(N):
        x,z=-96+i*STEP,-96+j*STEP
        h=heights[j*N+i];sd=polygon_distance(x,z,SHORE)
        distance,_,route=routes_nearest(x,z)
        grass=smooth(.23,.7,h)*(1-smooth(.45,.9,slope(x,z)))*smooth(.3,1.0,distance)
        volcano=math.hypot((x-2)/22,(z-57)/20)
        if volcano<.72:grass*=.08
        water=max(0,min(1,-h/2.5))
        paving=(1-smooth(0,1,distance)) if route and route['kind']=='road' else 0
        pixels.extend([paving,grass,water,1])
        rgb=(.07,.22,.38) if h<-.8 else (.20,.62,.64) if h<.05 else (.90,.69,.36) if h<.3 else (.67,.65,.23) if grass>.35 else (.58,.43,.28)
        if distance<0:rgb=(.23,.20,.24) if route['kind']=='road' else (.89,.66,.34)
        if volcano<.7:rgb=(.34,.30,.25)
        map_pixels.extend([*rgb,1])


def save_image(name,values,filename,flip=False):
    image=bpy.data.images.new(name,width=N,height=N,alpha=True)
    image.colorspace_settings.name='Non-Color'
    if flip:
        values=[v for j in range(N-1,-1,-1) for v in values[j*N*4:(j+1)*N*4]]
    image.pixels.foreach_set(values)
    image.filepath_raw=str(OUT/filename);image.file_format='PNG';image.save()


# PNG first row maps to texture v=0 when the loader uses flipY=false.
save_image('Native_terrain_data',pixels,'terrain-data.png',flip=True)
save_image('Island_map',map_pixels,'map.png',flip=True)

foliage=[];bushes=[];flowers=[]
for _ in range(13500):
    x,z=RNG.uniform(-72,52),RNG.uniform(-77,72)
    h=sampled(x,z);distance,_,_=routes_nearest(x,z)
    if h<.32 or slope(x,z)>.50 or distance<2.0:continue
    if math.hypot((x-2)/22,(z-57)/20)<.9:continue
    if any(math.hypot(x-s['x'],z-s['z'])<5 for s in SITES):continue
    if -67<x<-20 and -32<z<23:continue
    if len(foliage)<430 and RNG.random()<.19:
        foliage.append(dict(x=x,y=h,z=z,scale=RNG.uniform(.65,1.10),rotation=RNG.uniform(0,math.tau)))
    elif len(bushes)<650:
        bushes.append(dict(x=x,y=h+.55,z=z,scale=RNG.uniform(.45,1.05),rotation=RNG.uniform(0,math.tau)))
    if len(flowers)<85 and h>4 and RNG.random()<.16:flowers.append(dict(x=x,y=h,z=z,scale=1,rotation=0))

for site in SITES:site['y']=sampled(site['x'],site['z'])
data=dict(version=2,size=SIZE,rows=N,heightUrl='island/heights.f32',
    groundName='ReferenceIslandGround',routes=ROUTES,sites=SITES,trees=foliage,bushes=bushes,flowers=flowers,buildings=buildings,
    spawn=dict(x=-67,y=1.6,z=1),source='Six supplied island reference views; layout recreated, existing game renderer retained.')
(OUT/'island.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')

print('REFERENCE_ISLAND: saving editable project and game asset',flush=True)
for obj in list(terrain_col.objects)+list(paths_col.objects)+list(rocks_col.objects)+list(town_col.objects):
    if obj.type=='MESH':obj.select_set(True)
bpy.context.scene.unit_settings.system='METRIC'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'reference-island.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'island.glb'),export_format='GLB',export_apply=True,
    export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
print(json.dumps(dict(vertices=len(vertices),triangles=len(faces),trees=len(foliage),bushes=len(bushes),output=str(OUT))),flush=True)
