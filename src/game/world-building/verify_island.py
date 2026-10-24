"""Inspect saved Blender and GLB deliverables, including the actual terrain mesh."""
import json
import math
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / 'assets' / 'island-v1'
sys.path.insert(0,str(HERE))
from island_geometry import sample_route

checks = []


def check(name, condition, details):
    checks.append(dict(name=name,passed=bool(condition),details=details))


bpy.ops.wm.open_mainfile(filepath=str(OUT/'island.blend'))
metadata = json.loads((OUT/'navigation.json').read_text(encoding='utf-8'))
expected = ['01_Terrain','02_Beaches_and_Reefs','03_Roads_and_Graded_Paths',
            '04_Bridge_and_Stairs','05_Six_Building_Sites','06_Navigation_Surfaces','90_Preview_Only']
check('editable_collections',all(n in bpy.data.collections for n in expected),expected)
check('metre_units',bpy.context.scene.unit_settings.scale_length==1,'Blender metre scale')
mesh_objects = [o for o in bpy.context.scene.objects if o.type=='MESH']
finite = all(math.isfinite(value) for o in mesh_objects for v in o.data.vertices for value in v.co)
check('finite_mesh_coordinates',finite,len(mesh_objects))
check('six_building_sites',sum(o.name.startswith('Site_') and 'career_id' in o for o in mesh_objects)==6,6)

routes = metadata['routes']
primary = [r for r in routes if r['kind']!='stairs']
check('primary_route_widths',all(r['width']>=3.6 for r in primary),min(r['width'] for r in primary))
max_slope = max(r['max_slope_degrees'] for r in primary)
check('primary_route_gradients',max_slope<=18,dict(max_degrees=max_slope,limit_degrees=18))

# Split segments at route vertices and site centres, including T junctions.
points=[]
def point_id(p):
    key=tuple(round(value,3) for value in p)
    if key not in points:
        points.append(key)
    return points.index(key)
for route in routes:
    for p in route['points']:
        point_id(p)
for site in metadata['building_sites']:
    point_id(site['position'])
spawn=metadata['spawn']['position']
point_id((spawn[0],spawn[1],3.2))
adj={i:set() for i in range(len(points))}
for route in routes:
    for a,b in zip(route['points'],route['points'][1:]):
        a,b=Vector(a),Vector(b)
        delta=b-a
        on=[]
        for i,p in enumerate(points):
            t=(Vector(p)-a).dot(delta)/delta.length_squared
            if -.0001<=t<=1.0001 and (Vector(p)-(a+t*delta)).length<.22:
                on.append((t,i))
        on.sort()
        for (_,i),(_,j) in zip(on,on[1:]):
            adj[i].add(j)
            adj[j].add(i)
start=point_id((spawn[0],spawn[1],3.2))
visited={start}
frontier=[start]
while frontier:
    for neighbor in adj[frontier.pop()]:
        if neighbor not in visited:
            visited.add(neighbor)
            frontier.append(neighbor)
reach={s['id']:point_id(s['position']) in visited for s in metadata['building_sites']}
check('all_sites_connected_to_port',all(reach.values()),reach)
check('all_routes_connected',len(visited)==len(points),dict(reachable=len(visited),total=len(points)))

# Raycast actual land/support meshes beneath route centres and both walking margins.
support=[bpy.data.objects['Island_Main_Continuous_Terrain'],
         bpy.data.objects['Lookout_Islet_Grass'],bpy.data.objects['Port_Arrival_Platform']]
verts=[]
faces=[]
depsgraph=bpy.context.evaluated_depsgraph_get()
for obj in support:
    evaluated=obj.evaluated_get(depsgraph)
    data=evaluated.to_mesh()
    offset=len(verts)
    verts.extend(obj.matrix_world @ v.co for v in data.vertices)
    faces.extend(tuple(offset+i for i in p.vertices) for p in data.polygons)
    evaluated.to_mesh_clear()
bvh=BVHTree.FromPolygons(verts,faces,all_triangles=False)
nav_verts=[]
nav_faces=[]
for obj in bpy.data.collections['06_Navigation_Surfaces'].objects:
    offset=len(nav_verts)
    nav_verts.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
    nav_faces.extend(tuple(offset+i for i in p.vertices) for p in obj.data.polygons)
nav_bvh=BVHTree.FromPolygons(nav_verts,nav_faces,all_triangles=False)
route_bvhs={}
for obj in bpy.data.collections['06_Navigation_Surfaces'].objects:
    if 'route_id' in obj:
        route_bvhs[obj['route_id']]=BVHTree.FromPolygons(
            [obj.matrix_world @ v.co for v in obj.data.vertices],
            [tuple(p.vertices) for p in obj.data.polygons],all_triangles=False)
gaps=[]
max_delta=0
max_center_delta=0
samples=0
for route in primary:
    if route['kind']=='bridge':
        continue
    points_route=sample_route(route['points'],1.2)
    for i,p in enumerate(points_route):
        before=points_route[max(0,i-1)]
        after=points_route[min(len(points_route)-1,i+1)]
        tangent=Vector((after[0]-before[0],after[1]-before[1]))
        tangent.normalize()
        # End caps are open edges. Move numerical ray probes slightly inside the
        # strip so floating point edge classification is not reported as a hole.
        endpoint_inset=.025 if i==0 else -.025 if i==len(points_route)-1 else 0
        for lateral in [-route['width']*.42,0,route['width']*.42]:
            x,y=p[0]-tangent.y*lateral+tangent.x*endpoint_inset,p[1]+tangent.x*lateral+tangent.y*endpoint_inset
            hit,_,_,_=bvh.ray_cast(Vector((x,y,100)),Vector((0,0,-1)),150)
            nav_hit,_,_,_=route_bvhs[route['id']].ray_cast(Vector((x,y,100)),Vector((0,0,-1)),150)
            samples+=1
            # Centerlines must retain designed elevations. At a graded corner,
            # the walking margin follows the actual mitered surface, so compare
            # its exported navigation strip to the underlying terrain instead of
            # assuming an artificial horizontal cross-section through the turn.
            center_delta=abs(hit.z-p[2]) if hit else 100
            if lateral==0:
                max_center_delta=max(max_center_delta,center_delta)
            delta=abs((nav_hit.z-.11)-hit.z) if hit and nav_hit else 100
            max_delta=max(max_delta,delta)
            if delta>.35 or (lateral==0 and center_delta>.30):
                gaps.append(dict(route=route['id'],position=[round(x,2),round(y,2),round(p[2],2)],
                                 terrain_z=round(hit.z,3) if hit else None,delta=round(delta,3)))
check('actual_terrain_supports_routes',not gaps,dict(samples=samples,max_surface_gap_m=round(max_delta,4),max_centerline_height_error_m=round(max_center_delta,4),mismatches=gaps[:30],mismatch_count=len(gaps)))

# Check each actual pad's intended footprint against the terrain mesh.
pad_errors=[]
for site in metadata['building_sites']:
    x,y,z=site['position']
    for dx in [-5,0,5]:
        for dy in [-5,0,5]:
            hit,_,_,_=bvh.ray_cast(Vector((x+dx,y+dy,100)),Vector((0,0,-1)),150)
            if not hit or abs(hit.z-z)>.25:
                pad_errors.append(dict(site=site['id'],offset=[dx,dy],height=hit.z if hit else None))
check('level_supported_building_sites',not pad_errors,pad_errors)

# Verify packaging at byte level before using Blender's independent import path.
glb_path=OUT/'island.glb'
binary=glb_path.read_bytes()
magic,version,total=struct.unpack_from('<4sII',binary,0)
json_length,kind=struct.unpack_from('<I4s',binary,12)
gltf=json.loads(binary[20:20+json_length].decode('utf-8'))
external=[v['uri'] for key in ['buffers','images'] for v in gltf.get(key,[]) if v.get('uri') and not v['uri'].startswith('data:')]
check('self_contained_glb',magic==b'glTF' and version==2 and total==len(binary) and not external,
      dict(bytes=len(binary),external_resources=external))
names=[n.get('name','') for n in gltf.get('nodes',[])]
check('glb_excludes_preview_and_navigation',not any(n.startswith(('Preview_','NAV_')) or '_preview_label' in n for n in names),len(names))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(glb_path))
imported=[o for o in bpy.context.scene.objects if o.type=='MESH']
names=[o.name for o in imported]
check('glb_reimports_with_terrain_and_circulation',
      'Island_Main_Continuous_Terrain' in names and 'Bridge_Deck_Substructure' in names
      and any(n.startswith('Lookout_Step_') for n in names),
      dict(meshes=len(imported),materials=len(bpy.data.materials)))
bounds=[o.matrix_world @ Vector(corner) for o in imported for corner in o.bound_box]
extent=[round(max(v[k] for v in bounds)-min(v[k] for v in bounds),3) for k in range(3)]
check('reasonable_asset_bounds',all(100<extent[k]<300 for k in [0,1]) and 20<extent[2]<80,dict(blender_xyz_metres=extent))
triangles=sum(len(p.vertices)-2 for o in imported for p in o.data.polygons)
report=dict(passed=all(c['passed'] for c in checks),checks=checks,
            imported_visual_meshes=len(imported),imported_triangles=triangles,
            previews={name:(OUT/name).exists() for name in ['preview-southwest.png','preview-overhead.png','preview-northeast.png']},
            limitation='In-game physics, camera and click-to-move are not integrated or tested.')
(OUT/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('ISLAND_VERIFICATION '+json.dumps(report),flush=True)
if not report['passed']:
    raise RuntimeError('Island verification failed; inspect verification.json')
