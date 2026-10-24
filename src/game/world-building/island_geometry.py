"""Small deterministic Blender mesh helpers; units are metres, Z is up."""
import math
import random

import bpy
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt


def collection(name):
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def material(name, color, roughness=0.8, metallic=0.0):
    result = bpy.data.materials.new(name)
    linear = tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in color)
    result.diffuse_color = (*linear, 1)
    result.use_nodes = True
    node = result.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*linear, 1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    return result


def mesh(name, vertices, faces, target, materials, indices=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    result = bpy.data.objects.new(name, data)
    target.objects.link(result)
    for mat in materials:
        data.materials.append(mat)
    if indices:
        for face, index in zip(data.polygons, indices):
            face.material_index = index
    return result


def relink(obj, target):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    target.objects.link(obj)
    return obj


def box(name, center, size, target, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = relink(bpy.context.object, target)
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 2
    return obj


def beam(name, start, end, radius, target, mat, vertices=8):
    a, b = Vector(start), Vector(end)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                      depth=(b-a).length, location=(a+b)/2)
    obj = relink(bpy.context.object, target)
    obj.name = name
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    obj.data.materials.append(mat)
    return obj


def rock(name, center, size, target, mat, seed):
    rng = random.Random(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=center)
    obj = relink(bpy.context.object, target)
    obj.name = name
    for vertex in obj.data.vertices:
        vertex.co *= rng.uniform(0.83, 1.18)
    obj.scale = size
    obj.rotation_euler[2] = rng.uniform(0, math.tau)
    obj.data.materials.append(mat)
    return obj


def inside(x, y, polygon):
    odd = False
    j = len(polygon)-1
    for i, (xi, yi) in enumerate(polygon):
        xj, yj = polygon[j]
        if (yi > y) != (yj > y) and x < (xj-xi)*(y-yi)/(yj-yi)+xi:
            odd = not odd
        j = i
    return odd


def nearest(x, y, points):
    best = (float('inf'), 0.0, 0, 0.0)
    for i, (a, b) in enumerate(zip(points, points[1:])):
        dx, dy = b[0]-a[0], b[1]-a[1]
        t = max(0, min(1, ((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)))
        distance = math.hypot(x-a[0]-dx*t, y-a[1]-dy*t)
        if distance < best[0]:
            best = (distance, a[2]+(b[2]-a[2])*t, i, t)
    return best


def smooth(a, b, value):
    t = max(0, min(1, (value-a)/(b-a)))
    return t*t*(3-2*t)


def polygon_distance(x, y, poly):
    points = [(p[0], p[1], 0) for p in poly]
    distance = nearest(x, y, points+[points[0]])[0]
    return distance if inside(x, y, poly) else -distance


def sample_route(points, spacing=0.8):
    result = []
    for a, b in zip(points, points[1:]):
        length = math.hypot(b[0]-a[0], b[1]-a[1])
        count = max(1, math.ceil(length/spacing))
        for i in range(count):
            t = i/count
            result.append(tuple(a[k]+(b[k]-a[k])*t for k in range(3)))
    result.append(tuple(points[-1]))
    return result


def strip(name, points, width, target, mat, height=None, offset=0.04):
    # Interpolate between true mitered cross-sections. Averaging tangents at densely
    # sampled corners folds a wide strip back on itself and creates black seams.
    closed = (Vector(points[0])-Vector(points[-1])).length < .001
    offsets=[]
    for i,p in enumerate(points):
        previous = points[i-1] if i else (points[-2] if closed else points[0])
        following = points[i+1] if i<len(points)-1 else (points[1] if closed else points[-1])
        before=Vector((p[0]-previous[0],p[1]-previous[1]))
        after=Vector((following[0]-p[0],following[1]-p[1]))
        if before.length<.001:
            before=after.copy()
        if after.length<.001:
            after=before.copy()
        before.normalize()
        after.normalize()
        n1,n2=Vector((-before.y,before.x)),Vector((-after.y,after.x))
        miter=n1+n2
        miter.normalize()
        offsets.append(miter*(width*.5/max(.4,miter.dot(n2))))
    vertices = []
    columns=max(2,math.ceil(width/.65)+1)
    for i,(a,b) in enumerate(zip(points,points[1:])):
        count=max(1,math.ceil(math.hypot(b[0]-a[0],b[1]-a[1])/.65))
        for j in range(count+(1 if i==len(points)-2 else 0)):
            t=j/count
            p=tuple(a[k]+(b[k]-a[k])*t for k in range(3))
            lateral=offsets[i]*(1-t)+offsets[i+1]*t
            for column in range(columns):
                sign=-1+2*column/(columns-1)
                x,y=p[0]+lateral.x*sign,p[1]+lateral.y*sign
                z=height(x,y) if height else p[2]
                vertices.append((x,y,z+offset))
    faces = [(i*columns+j,(i+1)*columns+j,(i+1)*columns+j+1,i*columns+j+1)
             for i in range(len(vertices)//columns-1) for j in range(columns-1)]
    return mesh(name, vertices, faces, target, [mat])


def terrain_mesh(name, outline, height, target, mats, classify, extra=(), spacing=1.8):
    points = [Vector(p) for p in outline]
    xs, ys = zip(*outline)
    nx = math.ceil((max(xs)-min(xs))/spacing)
    ny = math.ceil((max(ys)-min(ys))/spacing)
    for j in range(ny+1):
        y = min(ys)+j*spacing
        for i in range(nx+1):
            x = min(xs)+(i+0.25*(j % 2))*spacing
            if inside(x, y, outline):
                points.append(Vector((x, y)))
    points.extend(Vector((p[0], p[1])) for p in extra if inside(p[0], p[1], outline))
    vertices2, _, faces, *_ = delaunay_2d_cdt(points, [], [list(range(len(outline)))], 1, 0.0001, False)
    vertices = [(v.x, v.y, height(v.x, v.y)) for v in vertices2]
    indices = []
    for face in faces:
        coords = [vertices[i] for i in face]
        center = tuple(sum(p[k] for p in coords)/len(coords) for k in range(3))
        normal = (Vector(coords[1])-Vector(coords[0])).cross(Vector(coords[2])-Vector(coords[0]))
        normal.normalize()
        indices.append(classify(center, abs(normal.z)))
    return mesh(name, vertices, faces, target, mats, indices)


def ring_mesh(name, inner, outer, inner_z, outer_z, target, mats, seed=1):
    rng = random.Random(seed)
    n = len(inner)
    vertices = [(x, y, inner_z) for x, y in inner]+[(x, y, outer_z) for x, y in outer]
    faces = []
    for i in range(n):
        j = (i+1) % n
        faces.extend([(i, n+i, n+j), (i, n+j, j)])
    return mesh(name, vertices, faces, target, mats, [rng.randrange(len(mats)) for _ in faces])


def ellipse(cx, cy, rx, ry, count=96, seed=0):
    return [(cx+rx*math.cos(t)*(1+0.025*math.sin(7*t+seed)),
             cy+ry*math.sin(t)*(1+0.025*math.sin(9*t+seed)))
            for t in [math.tau*i/count for i in range(count)]]


def round_outline(anchors, subdivisions=5):
    points = []
    n = len(anchors)
    for i in range(n):
        a,b,c,d = [Vector(anchors[j % n]) for j in (i-1,i,i+1,i+2)]
        for j in range(subdivisions):
            t = j/subdivisions
            p = 0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
            points.append(tuple(p))
    area = sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points, points[1:]+points[:1]))
    return points if area > 0 else list(reversed(points))
