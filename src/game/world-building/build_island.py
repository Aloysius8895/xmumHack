"""Build an editable tropical island without touching any existing Blender session.

blender --background --factory-startup --python-exit-code 1 --python build_island.py
"""
import json
import math
import os
from pathlib import Path
import random
import sys
import time

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from island_geometry import (beam, box, collection, ellipse, inside, material, mesh,
    nearest, polygon_distance, rock, round_outline, ring_mesh, sample_route,
    smooth, strip, terrain_mesh)

OUT = HERE.parents[1] / 'assets' / 'island-v1'
OUT.mkdir(parents=True, exist_ok=True)
START = time.time()
RNG = random.Random(7419)

# Routes share endpoints. Ramps are embedded into the height field, not floating ribbons.
ROUTES = [
    dict(id='town-loop', kind='road', width=6.4, points=[
        (-65,-44,3.2),(-65,-16,3.2),(-65,17,3.2),(-61,42,3.2),
        (-44,56,3.2),(-32,41,3.2),(-31,12,3.2),(-32,-36,3.2),(-42,-44,3.2),(-65,-44,3.2)]),
    dict(id='port-link', kind='road', width=6.4, points=[(-65,-44,3.2),(-72,-54,3.2),(-80,-64,3.2)]),
    dict(id='terrace-ramp-1', kind='ramp', width=4.2, points=[
        (-32,-36,3.2),(-22,-37,4.0),(-12,-36,6.2),(0,-31,8.4),(12,-24,10.6)]),
    dict(id='east-garden-trail', kind='path', width=4.2, points=[
        (12,-24,10.6),(42,-24,10.6),(57,-9,10.6),(55,8,10.6),
        (64,15,10.6),(65,30,10.6),(58,46,10.6)]),
    dict(id='terrace-ramp-2', kind='ramp', width=4.2, points=[
        (55,8,10.6),(45,10,12.0),(38,21,14.8),(32,31,17.4),(32,38,18.4),(24,38,20)]),
    dict(id='central-garden-trail', kind='path', width=4.2, points=[
        (24,38,20),(17,32,20),(14,20,20),(0,18,20),(-11,27,20),(-4,38,20),(24,38,20)]),
    dict(id='terrace-ramp-3', kind='ramp', width=4.2, points=[
        (-4,38,20),(-17,44,22),(-23,54,24),(-18,64,26.5),(-7,70,29)]),
    dict(id='summit-garden-trail', kind='path', width=4.2, points=[
        (-7,70,29),(-3,81,29),(8,86,29),(15,78,29),(8,68,29),(-7,70,29)]),
    dict(id='data-entry', kind='path', width=3.6, points=[(-65,-16,3.2),(-55,-16,3.2)]),
    dict(id='frontend-entry', kind='path', width=3.6, points=[(-65,17,3.2),(-53,17,3.2)]),
    dict(id='product-entry', kind='path', width=3.6, points=[(-44,56,3.2),(-48,46,3.2)]),
    dict(id='backend-entry', kind='path', width=3.6, points=[(34,-24,10.6),(34,-17,10.6)]),
    dict(id='bridge-approach', kind='path', width=4.2, points=[(57,-9,10.6),(65,-12,10.6),(69,-24,10.6)]),
    dict(id='lookout-stairs', kind='stairs', width=4.2, points=[(24,38,20),(24,48,20),(31,51,20),(42,58,29)]),
    dict(id='lookout-landing', kind='path', width=4.2, points=[(42,58,29),(43,63,29)]),
    dict(id='tidal-bridge', kind='bridge', width=4.2, points=[(69,-24,10.6),(91,-24,10.6)]),
    dict(id='islet-trail', kind='path', width=4.2, points=[(91,-24,10.6),(98,-24,10.6)]),
]

SITES = [
    dict(id='data-analyst', label='01 / DATA', position=(-55,-16,3.2), size=(13,13)),
    dict(id='frontend-developer', label='02 / FRONTEND', position=(-53,17,3.2), size=(13,13)),
    dict(id='product-manager', label='03 / PRODUCT', position=(-48,46,3.2), size=(13,13)),
    dict(id='backend-developer', label='04 / BACKEND', position=(34,-17,10.6), size=(13,13)),
    dict(id='ui-ux-designer', label='05 / DESIGN', position=(14,20,20), size=(13,13)),
    dict(id='ml-engineer', label='06 / AI LAB', position=(-3,81,29), size=(13,13)),
]

OUTLINE = round_outline([
    (-77,-46),(-80,-10),(-72,29),(-60,58),(-47,79),(-24,94),(2,103),
    (31,102),(52,93),(69,75),(77,50),(78,22),(74,-5),(71,-32),(60,-55),
    (42,-72),(19,-91),(-6,-96),(-29,-86),(-47,-65),(-65,-57)], 6)

LOW = [(-18,-56),(41,-59),(62,-40),(71,-15),(70,29),(61,60),
       (44,84),(16,94),(-8,86),(-29,65),(-28,28),(-13,2),(-20,-23)]
MID = [(-25,12),(-18,-1),(8,1),(33,7),(45,24),(44,45),(30,61),
       (8,74),(-20,70),(-33,54),(-35,32)]
HIGH = [(-24,58),(-12,55),(9,59),(22,70),(20,86),(11,95),(-11,92),(-24,80)]


def base_height(x, y):
    coast = polygon_distance(x, y, OUTLINE)
    h = 0.7 + 2.5*smooth(0, 5, coast)
    h += 7.4*smooth(-1, 1.1, polygon_distance(x,y,LOW))
    h += 9.4*smooth(-1, 1.1, polygon_distance(x,y,MID))
    h += 9*smooth(-1, 1.1, polygon_distance(x,y,HIGH))
    # A faceted northern sea cliff, with a separate south-facing lookout ledge.
    t = math.sqrt(((x-42)/23)**2 + ((y-72)/27)**2)
    mountain = (1-smooth(0.35, 1.05, t))*27
    h = max(h, 10.6+mountain) if t < 1.1 else h
    # Dormant caldera: rough radial rim with a genuine depressed crater interior.
    dx,dy = (x-1)/28, (y+66)/25
    r = math.hypot(dx,dy)
    if r < 1.1:
        angle = math.atan2(dy,dx)
        rim = 24+1.0*math.sin(13*angle)+0.6*math.sin(21*angle)
        if r<.56:
            caldera = 5.2+(rim-2)*smooth(.34,.56,r)
        else:
            caldera = 3.2+rim*(1-smooth(.56,1.08,r))
        h = max(h,caldera)
    # Keep the sandy perimeter below the rocky cliffs.
    return 0.7+(h-0.7)*smooth(0,3.4,coast)


def height(x,y):
    h = base_height(x,y)
    # Flatten sites and lookout before cutting paths, so paths and ground agree.
    for site in SITES:
        px,py,pz = site['position']
        distance = max(abs(x-px)-site['size'][0]/2, abs(y-py)-site['size'][1]/2)
        weight = 1-smooth(0,2.7,distance)
        h = h*(1-weight)+pz*weight
    distance = math.hypot(x-43,y-63)
    weight = 1-smooth(6,9,distance)
    h = h*(1-weight)+29*weight
    # Pick the closest corridor, avoiding order-dependent intersections.
    best = None
    for route in ROUTES:
        if route['kind'] == 'bridge' or route['id'] == 'islet-trail':
            continue
        distance,z,_,_ = nearest(x,y,route['points'])
        half = route['width']/2
        # Reserve the full sidewalk and miter clearance before blending to cliffs.
        clearance=1.8 if route['kind']=='road' else 1.05
        weight = 1-smooth(half+clearance,half+clearance+2.5,distance)
        if weight > 0 and (best is None or distance-half < best[0]):
            best = (distance-half,z,weight)
    if best:
        _,z,weight = best
        h = h*(1-weight)+z*weight
    return h


def camera(name, location, target, ortho):
    data = bpy.data.cameras.new(name)
    data.type = 'ORTHO'
    data.ortho_scale = ortho
    obj = bpy.data.objects.new(name,data)
    staging.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    return obj


def text(name, body, center, size, mat):
    data = bpy.data.curves.new(name,'FONT')
    data.body = body
    data.align_x = 'CENTER'
    data.align_y = 'CENTER'
    data.size = size
    data.extrude = 0.005
    obj = bpy.data.objects.new(name,data)
    staging.objects.link(obj)
    obj.location = center
    data.materials.append(mat)
    return obj


print('ISLAND: preparing scene', flush=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for old in list(bpy.data.collections):
    bpy.data.collections.remove(old)

land = collection('01_Terrain')
coast = collection('02_Beaches_and_Reefs')
roads = collection('03_Roads_and_Graded_Paths')
structure = collection('04_Bridge_and_Stairs')
sites = collection('05_Six_Building_Sites')
nav = collection('06_Navigation_Surfaces')
staging = collection('90_Preview_Only')

grass = [material('Grass / fern',(.23,.43,.16)), material('Grass / meadow',(.33,.54,.20)),
         material('Grass / sunlit',(.41,.60,.25)), material('Grass / moss',(.18,.35,.16))]
stone = [material('Cliff / umber',(.28,.27,.20)),material('Cliff / warm',(.37,.35,.26)),
         material('Cliff / light',(.45,.42,.30)),material('Cliff / dark',(.23,.25,.21))]
sand = [material('Sand / honey',(.78,.62,.34)), material('Sand / light',(.89,.75,.47)),
        material('Sand / wet',(.64,.57,.38))]
asphalt = material('Road / blue slate',(.12,.17,.20))
concrete = material('Paving / pale stone',(.64,.66,.58))
pathmat = material('Trail / golden earth',(.71,.51,.25))
pathborder = material('Trail shoulder / sand',(.63,.46,.25))
white = material('Road paint / ivory',(.93,.87,.68))
yellow = material('Road paint / amber',(.95,.67,.19))
wood = material('Bridge / honey timber',(.36,.21,.105))
woodlight = material('Bridge / deck',(.57,.37,.19))
iron = material('Rail / charcoal',(.12,.18,.19),metallic=.35)
reefmat = material('Reef / basalt',(.12,.17,.19))
foam = material('Foam / sea glass',(.63,.90,.85))
watermat = material('Ocean / deep turquoise',(.035,.29,.41),roughness=.28)
shallowmat = material('Ocean / shallow turquoise',(.045,.55,.57),roughness=.38)
navmat = material('Navigation / debug cyan',(.1,.8,.9))


def classify(p, nz):
    x,y,z = p
    if polygon_distance(x,y,OUTLINE)<3.3 and z<3.5:
        return 8+(int(abs(x+y)*7) % 2)
    r = math.hypot((x-1)/28,(y+66)/25)
    variation=math.sin(x*.13)+math.sin(y*.09)+.6*math.sin((x+y)*.17)
    if nz<.73 or r<.72:
        return 4+(0 if variation<-.6 else 1 if variation<.7 else 2)
    return 0 if variation<-.8 else 1 if variation<1.2 else 2


extra = []
for route in ROUTES:
    if route['kind'] != 'bridge':
        for p in sample_route(route['points'],1):
            extra.extend([(p[0]+dx,p[1]+dy) for dx,dy in [(0,0),(2.8,0),(-2.8,0),(0,2.8),(0,-2.8)]])

print('ISLAND: triangulating terraces and continuous ramp corridors', flush=True)
terrain = terrain_mesh('Island_Main_Continuous_Terrain', OUTLINE,height,land,
                       grass+stone+sand,classify,extra,spacing=1.7)
terrain['role'] = 'continuous land surface; Z-up metres'
terrain['walkable_note'] = 'Use exported route graph and navigation surfaces; cliffs are not walkable.'

# Shore bands wrap the same irregular outline, keeping all shores editable.
beach_outer = [(x*1.045,y*1.035) for x,y in OUTLINE]
shelf_outer = [(x*1.12,y*1.10) for x,y in OUTLINE]
ring_mesh('Beach_Continuous_Sand_Apron',OUTLINE,beach_outer,.7,.16,coast,sand[:2])
ring_mesh('Shore_Submerged_Sand_Shelf',beach_outer,shelf_outer,.16,-1.4,coast,[sand[2]])
bottom = [(x,y) for x,y in OUTLINE]
ring_mesh('Island_Submerged_Rock_Edge',OUTLINE,bottom,.7,-3.5,land,stone)
foam_inner = [(x*1.048,y*1.038) for x,y in OUTLINE]
foam_outer = [(x*1.055,y*1.044) for x,y in OUTLINE]
ring_mesh('Shoreline_Foam_Accent',foam_inner,foam_outer,.20,.20,staging,[foam])

# Dock: flat arrival platform and retaining piers, separate from the natural shore.
box('Port_Arrival_Platform',(-78,-59,2.2),(29,28,2.0),structure,concrete,.28)
for x in [-90,-78,-66]:
    for y in [-71,-49]:
        box('Port_Stone_Pier',(x,y,.1),(2.2,2.2,5.0),structure,stone[1],.12)
for x in [-89,-85,-81,-77,-73,-69]:
    box('Port_Quayside_Inlay',(x,-71.8,3.23),(2.2,.3,.04),roads,white)

terrain_bvh=BVHTree.FromPolygons([v.co for v in terrain.data.vertices],
                               [tuple(p.vertices) for p in terrain.data.polygons],all_triangles=True)


def surface_height(x,y):
    """Project surfaces onto the actual triangulated mesh rather than its analytic source."""
    hit,_,_,_=terrain_bvh.ray_cast(Vector((x,y,100)),Vector((0,0,-1)),150)
    z=hit.z if hit else height(x,y)
    if -92.5<x<-63.5 and -73<y<-45:
        z=max(z,3.2)
    return z

print('ISLAND: building roads, paths, bridge and staircase', flush=True)
for route in ROUTES:
    kind,points,width = route['kind'],route['points'],route['width']
    if kind in ('bridge','stairs') or route['id']=='islet-trail':
        continue
    # Road hierarchy: pale pedestrian margins, asphalt, dashed centre paint.
    if kind == 'road':
        strip(route['id']+'_sidewalk',points,width+1.8,roads,concrete,surface_height,offset=.08)
        strip(route['id']+'_asphalt',points,width,roads,asphalt,surface_height,offset=.13)
        for a,b in zip(points,points[1:]):
            length = math.hypot(b[0]-a[0],b[1]-a[1])
            for start in range(2,int(length)-2,5):
                p = tuple(a[k]+(b[k]-a[k])*start/length for k in range(3))
                q = tuple(a[k]+(b[k]-a[k])*(start+2)/length for k in range(3))
                strip('Road_Center_Dash',[p,q],.14,roads,yellow,surface_height,offset=.15)
    else:
        strip(route['id']+'_shoulder',points,width+.65,roads,pathborder,surface_height,offset=.055)
        strip(route['id']+'_surface',points,width,roads,pathmat,surface_height,offset=.11)

# Six real level building pads; typography belongs only to the presentation collection.
for site in SITES:
    x,y,z = site['position']
    w,d = site['size']
    pad = box('Site_'+site['id'],(x,y,z+.035),(w,d,.07),sites,concrete,.14)
    pad['career_id'] = site['id']
    pad['usable_dimensions_m'] = list(site['size'])
    pad['suggested_entrance'] = 'south; align actual building with approach after import'
    for dx,dy in [(-w/2,-d/2),(w/2,-d/2),(-w/2,d/2),(w/2,d/2)]:
        box('Site_Corner_Inlay',(x+dx*.94,y+dy*.94,z+.08),(1.1,1.1,.045),sites,white,.05)
    text(site['id']+'_preview_label',site['label'],(x,y,z+.12),1.15,iron)

# Broad stone stairs have exact-height treads and a matching hidden navigation slope.
stair = next(r for r in ROUTES if r['kind']=='stairs')
strip('Lookout_Stair_Approach',stair['points'][:-1],4.2,roads,pathmat,surface_height,offset=.11)
a,b = Vector(stair['points'][-2]),Vector(stair['points'][-1])
direction = b-a
horizontal = Vector((direction.x,direction.y,0))
length = horizontal.length
horizontal.normalize()
count = math.ceil((b.z-a.z)/.18)
run = length/count
rise = (b.z-a.z)/count
for i in range(count):
    center = a+horizontal*((i+.5)*run)
    top = a.z+(i+1)*rise+.07
    block = box(f'Lookout_Step_{i+1:02}',(center.x,center.y,top-.18),(run+.025,4.2,.36),structure,concrete,.025)
    block.rotation_euler[2] = math.atan2(direction.y,direction.x)
for sign in [-1,1]:
    normal = Vector((-horizontal.y,horizontal.x,0))*sign*2.3
    beam('Lookout_Handrail',a+normal+Vector((0,0,1.12)),b+normal+Vector((0,0,1.12)),.075,structure,iron)
    for i in range(0,count+1,7):
        p = a+direction*(i/count)+normal
        beam('Lookout_Rail_Post',p,p+Vector((0,0,1.12)),.07,structure,iron)
strip('NAV_Lookout_Smooth_Ramp',stair['points'],4.2,nav,navmat,offset=.07)

# Bridge crosses water to an independent rock-and-grass lookout islet.
islet_outline = ellipse(99,-24,12,11,count=72,seed=4)
outer = [(99+(x-99)*1.13,-24+(y+24)*1.13) for x,y in islet_outline]
ring_mesh('Lookout_Islet_Rock_Cliff',islet_outline,outer,10.6,.1,land,stone,seed=4)
mesh('Lookout_Islet_Grass',[(x,y,10.6) for x,y in islet_outline],
     [tuple(range(len(islet_outline)))],land,[grass[1]])
strip('Islet_Lookout_Trail',[(91,-24,10.6),(98,-24,10.6)],4.2,roads,pathmat,offset=.055)
bridge_a,bridge_b = Vector((69,-24,10.6)),Vector((91,-24,10.6))
box('Bridge_Deck_Substructure',(80,-24,10.28),(22,4.7,.5),structure,wood,.06)
for i in range(55):
    box(f'Bridge_Timber_Plank_{i+1:02}',(69+(i+.5)*.4,-24,10.6),(.36,4.6,.20),structure,woodlight,.035)
for y in [-26.4,-21.6]:
    beam('Bridge_Top_Rail',(69,y,11.85),(91,y,11.85),.12,structure,wood)
    beam('Bridge_Lower_Rail',(69,y,11.2),(91,y,11.2),.075,structure,wood)
    for x in range(69,92,2):
        beam('Bridge_Rail_Post',(x,y,10.4),(x,y,12.0),.12,structure,wood)
for x in [70,90]:
    for y in [-25.7,-22.3]:
        beam('Bridge_Shore_Support',(x,y,.1),(x,y,10.3),.5,structure,stone[1])
strip('NAV_Bridge_Deck',[(69,-24,10.72),(91,-24,10.72)],4.2,nav,navmat,offset=0)

# Reefs repeat around the caldera and coastline, with gaps retaining readable beaches.
for i in range(52):
    t = math.tau*i/52
    x = 8+103*math.cos(t)
    y = 4+113*math.sin(t)
    if x < -65 and y < -32:
        continue  # open port approach
    if x>78 and -38<y<-9:
        continue  # bridge/islet clearance
    if i % 8==3:
        continue
    rx = RNG.uniform(1.8,3.9)
    rock('Offshore_Basalt_Reef',(x,y,.0),(rx,RNG.uniform(1.6,3.1),RNG.uniform(1.6,3.0)),coast,reefmat,100+i)
for i in range(24):
    t = math.tau*i/24
    x,y = 99+15*math.cos(t),-24+14*math.sin(t)
    if x<91 and abs(y+24)<4:
        continue
    rock('Lookout_Islet_Shore_Rock',(x,y,.2),(1.5,1.4,1.6),coast,reefmat,200+i)

# Dedicated navigation strips are construction aids, excluded from beauty renders.
for route in ROUTES:
    if route['kind'] in ('stairs','bridge'):
        continue
    nav_height = None if route['id'] in ('islet-trail','port-link') else surface_height
    obj = strip('NAV_'+route['id'],route['points'],route['width'],nav,navmat,nav_height,offset=.11)
    obj['route_id'] = route['id']
for obj in nav.objects:
    obj.hide_render = True
    obj.hide_set(True)
    obj.display_type = 'WIRE'

# Thin road/path overlays are paint/paving, not elevated occluders. Duplicate
# coplanar fragments at junctions otherwise create false black shadow speckles.
for obj in roads.objects:
    obj.visible_shadow=False
    obj['cast_shadow']=False
for obj in sites.objects:
    obj.visible_shadow=False
    obj['cast_shadow']=False

print('ISLAND: staging presentation and saving source', flush=True)
box('Preview_Ocean',(0,0,-1.65),(2000,2000,.2),staging,watermat)
# A broad submerged colored shelf creates turquoise shallow water, separate from export.
shallow = ellipse(4,2,123,133,count=144)
mesh('Preview_Lagoon_Color',[(x,y,-1.48) for x,y in shallow],[tuple(range(len(shallow)))],staging,[shallowmat])

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 1400
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.68,.82,1.0,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .65
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
lightdata = bpy.data.lights.new('Sun / soft afternoon','SUN')
lightdata.energy = 2.3
lightdata.angle = math.radians(14)
light = bpy.data.objects.new('Sun / soft afternoon',lightdata)
staging.objects.link(light)
light.rotation_euler = (math.radians(26),math.radians(-22),math.radians(-35))
camera_main = camera('Camera / southwest',(-240,-290,270),(4,3,8),292)
camera_top = camera('Camera / overhead',(4,3,420),(4,3,0),290)
camera_back = camera('Camera / northeast',(270,280,250),(4,3,9),292)
scene.camera = camera_main
scene['asset_title'] = 'Career Island / terrain and circulation / v1'
scene['reference_note'] = 'Inspired by six supplied views of one island; no claim of geometric reconstruction.'
scene['game_integration_status'] = 'Standalone asset, not wired into the game.'
scene['coordinate_system'] = 'Blender Z-up metres; GLB export converts to Y-up.'
scene['navigation_note'] = 'Walk strips are design aids; game physics/pathfinding integration is still required.'

# Make the file open on the island in material view, with a readable camera frame.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance = 290
            area.spaces.active.region_3d.view_location = (4,3,8)
            area.spaces.active.region_3d.view_rotation = camera_main.rotation_euler.to_quaternion()
            area.spaces.active.shading.type = 'MATERIAL'
            area.spaces.active.clip_end = 3000

readme = bpy.data.texts.new('README - ISLAND DELIVERY')
readme.write('Editable island terrain and circulation. Units: metres, Z-up.\n'
             'Collections 01-05 are visual assets. 06 contains hidden navigation aids.\n'
             '90 is preview-only: water, labels, light and cameras.\n'
             'Six flat 13 x 13 m sites reserve room for future career buildings.\n'
             'No buildings, trees or click-to-move implementation are included.\n'
             'Main and auxiliary routes are documented in navigation.json.\n'
             'Rebuild with world-building/build_island.py.\n')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'island.blend'))

# Export only visible geometry, excluding staging and hidden navigation aids.
bpy.ops.object.select_all(action='DESELECT')
for target in [land,coast,roads,structure,sites]:
    for obj in target.objects:
        obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'island.glb'),export_format='GLB',
    use_selection=True,export_apply=True,export_extras=True,export_cameras=False,
    export_lights=False,export_yup=True,export_animations=False)

# Export nav aids separately, with temporary visibility only for exporter selection.
bpy.ops.object.select_all(action='DESELECT')
for obj in nav.objects:
    obj.hide_set(False)
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'navigation.glb'),export_format='GLB',
    use_selection=True,export_apply=True,export_extras=True,export_animations=False)
for obj in nav.objects:
    obj.hide_set(True)
bpy.ops.object.select_all(action='DESELECT')

route_data = []
for route in ROUTES:
    slopes = [math.degrees(math.atan2(abs(b[2]-a[2]),math.hypot(b[0]-a[0],b[1]-a[1])))
              for a,b in zip(route['points'],route['points'][1:])]
    route_data.append({**route,'max_slope_degrees':round(max(slopes),4),
        'surface_offset_m': .12 if route['kind']=='bridge' else .13 if route['kind']=='road' else .11,
        'requires_stair_navigation':route['kind']=='stairs'})
metadata = dict(schema='career-island-terrain/v1',units='metres',
    coordinate_system='Blender Z-up; (x,y,z) becomes (x,z,-y) in exported glTF',
    character_reference_height_m=1.5,building_sites=SITES,routes=route_data,
    spawn=dict(position=(-80,-64,3.34),route='port-link'),
    primary_route_slope_limit_degrees=18,
    note='Route centerlines and nav strips prepare integration; no game collision or runtime pathfinding is installed.')
(OUT/'navigation.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')

# Preserve delivery state after selection/temporary navigation visibility changes.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'island.blend'))
for cam,filename in [(camera_main,'preview-southwest.png'),(camera_top,'preview-overhead.png'),(camera_back,'preview-northeast.png')]:
    scene.camera=cam
    scene.render.filepath=str(OUT/filename)
    print(f'ISLAND: rendering {filename}',flush=True)
    bpy.ops.render.render(write_still=True)

print(json.dumps({'output':str(OUT),'objects':len(bpy.data.objects),
    'elapsed_seconds':round(time.time()-START,1)}),flush=True)
