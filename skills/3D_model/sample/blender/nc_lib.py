"""
Modelling helpers for the Night Canvas parts.

Units are millimetres, Blender Z up. The web page works in metres, Y up; the glTF exporter
turns Blender (x, y, z) into (x, z, -y), so a device point (X, Y, Z) in the page lives at
Blender 1000 * (X, -Z, Y).

Every part is built as closed solids: the page draws section caps from the back faces of
closed meshes, so an open shell would show red through every gap when the device is cut.
"""
import math
import os
import bpy
import bmesh
from mathutils import Vector, Matrix

TAU = math.tau
HERE = bpy.path.abspath("//")

# ------------------------------------------------------------------ materials
# name: (base colour as linear RGB, metallic, roughness). The page swaps each one for its own
# preset by name, so these only need to look right in Blender.
PALETTE = {
    "pcb_tex":    ((1, 1, 1), 0.0, 0.40),
    "campcb_tex": ((1, 1, 1), 0.0, 0.40),
    "mark_chip":  ((1, 1, 1), 0.0, 0.50),
    "mark_metal": ((1, 1, 1), 1.0, 0.24),
    "mark_label": ((1, 1, 1), 0.0, 0.70),
    "chip":       ((0.03, 0.03, 0.033), 0.0, 0.50),
    "substrate":  ((0.06, 0.12, 0.07), 0.0, 0.45),
    "lid":        ((0.67, 0.66, 0.64), 1.0, 0.22),
    "port":       ((0.67, 0.66, 0.64), 1.0, 0.28),
    "tin":        ((0.72, 0.72, 0.71), 1.0, 0.32),
    "gold":       ((1.0, 0.77, 0.34), 1.0, 0.18),
    "black":      ((0.025, 0.025, 0.028), 0.0, 0.45),
    "grey":       ((0.12, 0.12, 0.13), 0.0, 0.50),
    "white":      ((0.5, 0.5, 0.48), 0.0, 0.72),
    "beige":      ((0.78, 0.72, 0.58), 0.0, 0.55),
    "brown":      ((0.16, 0.08, 0.035), 0.0, 0.50),
    "blue":       ((0.04, 0.16, 0.55), 0.0, 0.40),
    "brass":      ((0.91, 0.78, 0.42), 1.0, 0.24),
    "screw":      ((0.24, 0.245, 0.25), 1.0, 0.35),
    "steel":      ((0.56, 0.57, 0.58), 1.0, 0.30),
    "heatsink":   ((0.86, 0.87, 0.88), 1.0, 0.34),
    "cap":        ((0.62, 0.50, 0.30), 0.0, 0.50),
    "ferrite":    ((0.16, 0.16, 0.17), 0.0, 0.55),
    "thermal":    ((0.30, 0.34, 0.40), 0.0, 0.85),
    "lens":       ((0.02, 0.025, 0.05), 0.0, 0.04),
    "led_g":      ((0.05, 0.50, 0.10), 0.0, 0.30),
    "led_r":      ((0.60, 0.03, 0.02), 0.0, 0.30),
    "led_y":      ((0.80, 0.45, 0.02), 0.0, 0.30),
    "wire_red":   ((0.55, 0.05, 0.04), 0.0, 0.40),
    "wire_black": ((0.04, 0.04, 0.045), 0.0, 0.40),
    "wire_yellow": ((0.75, 0.60, 0.12), 0.0, 0.40),
    "wire_blue":  ((0.05, 0.18, 0.60), 0.0, 0.40),
    "sd":         ((0.02, 0.02, 0.025), 0.0, 0.35),
}
TEXTURED = {"pcb_tex": "pcb_pi5.png", "campcb_tex": "atlas.png", "mark_chip": "atlas.png",
            "mark_metal": "atlas.png", "mark_label": "atlas.png"}


def material(name):
    m = bpy.data.materials.get(name)
    if m is not None:
        return m
    col, metal, rough = PALETTE[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*col, 1)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    m.diffuse_color = (*col, 1)
    m.metallic, m.roughness = metal, rough
    if name in TEXTURED:
        path = os.path.normpath(HERE + "tex/" + TEXTURED[name])
        img = next((i for i in bpy.data.images if i.filepath and os.path.normpath(bpy.path.abspath(i.filepath)) == path), None) or bpy.data.images.load(path)
        img.filepath = bpy.path.relpath(path)      # keep the .blend portable with its tex/ folder
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = img
        tn.interpolation = "Cubic"
        tn.location = (-420, 260)
        nt.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
        m.diffuse_color = (0.6, 0.6, 0.6, 1)
    return m


# ------------------------------------------------------------------ collections, empties
def collection(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def clear_collection(c):
    for o in list(c.objects):
        data = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if data is not None and data.users == 0:
            if isinstance(data, bpy.types.Mesh):
                bpy.data.meshes.remove(data)


def empty(name, coll, loc=(0, 0, 0), rot=(0, 0, 0), parent=None, size=5.0):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = "PLAIN_AXES"
    e.empty_display_size = size
    e.location = loc
    e.rotation_euler = rot
    coll.objects.link(e)
    if parent is not None:
        e.parent = parent
    return e


# ------------------------------------------------------------------ small 2D helpers
def rrect(cx, cy, w, h, r, seg=4):
    """rounded rectangle, CCW, as a list of (x, y)"""
    r = max(0.0, min(r, w / 2 - 1e-4, h / 2 - 1e-4))
    if r <= 1e-6:
        return [(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)]
    pts = []
    for (ox, oy, a0) in ((w / 2 - r, -h / 2 + r, -90), (w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((cx + ox + r * math.cos(a), cy + oy + r * math.sin(a)))
    return pts


def circle(cx, cy, r, n=32, a0=0.0):
    return [(cx + r * math.cos(a0 + TAU * k / n), cy + r * math.sin(a0 + TAU * k / n)) for k in range(n)]


def axis_matrix(axis):
    """rotation taking local +Z to the named axis"""
    return {
        "Z": Matrix.Identity(4),
        "-Z": Matrix.Rotation(math.pi, 4, "X"),
        "X": Matrix.Rotation(math.pi / 2, 4, "Y"),
        "-X": Matrix.Rotation(-math.pi / 2, 4, "Y"),
        "Y": Matrix.Rotation(-math.pi / 2, 4, "X"),
        "-Y": Matrix.Rotation(math.pi / 2, 4, "X"),
    }[axis]


def catmull(pts, steps):
    """centripetal-ish Catmull-Rom through pts, `steps` samples per span"""
    P = [Vector(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(steps):
            t = s / steps
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2].copy())
    return out


# ------------------------------------------------------------------ the part builder
class Part:
    """
    One Blender object under construction: a bmesh, the materials its faces use, and the
    cutters to subtract when it is finished. Primitives are built in a scratch bmesh, made
    closed and outward-facing, then copied in.
    """

    def __init__(self, name, mats=None):
        self.name = name
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.verify()
        self.mats = mats if mats is not None else []
        self.fixed = set()          # faces whose UVs were set on purpose (textures)
        self.cutters = []

    def mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    # -------------------------------------------------- scratch -> part
    def _merge(self, t, M=None, fixed_uv=False):
        bmesh.ops.recalc_face_normals(t, faces=list(t.faces))
        if M is not None:
            bmesh.ops.transform(t, matrix=M, verts=list(t.verts))
        tuv = t.loops.layers.uv.active
        fix = t.faces.layers.int.get("fix") if fixed_uv else None
        vmap = {v: self.bm.verts.new(v.co) for v in t.verts}
        for f in t.faces:
            nf = self.bm.faces.new([vmap[v] for v in f.verts])
            nf.material_index = f.material_index
            nf.smooth = f.smooth
            if fix is not None and tuv is not None and f[fix]:
                for l_src, l_dst in zip(f.loops, nf.loops):
                    l_dst[self.uv].uv = l_src[tuv].uv
                self.fixed.add(nf)
        t.free()

    @staticmethod
    def _place(c=(0, 0, 0), axis="Z", rot=None):
        M = axis_matrix(axis)
        if rot is not None:
            M = (rot.to_matrix().to_4x4() if hasattr(rot, "to_matrix") else rot) @ M
        return Matrix.Translation(Vector(c)) @ M

    # -------------------------------------------------- primitives
    def box(self, c, s, mat, r=0.0, segs=2, rot=None, top=None, top_uv=None, sides=None, bottom=None, bottom_uv=None, only_vertical=False):
        """
        box of size s centred on c, edges rounded by r. `top`/`bottom` give the +Z / -Z cap its
        own material, and `top_uv` = (u0, v0, u1, v1) maps that cap onto a rectangle of a texture
        (local +x -> u, +y -> v).
        """
        t = bmesh.new()
        ret = bmesh.ops.create_cube(t, size=1.0)
        for v in ret["verts"]:
            v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
        if r > 0:
            edges = [e for e in t.edges if not only_vertical or abs((e.verts[0].co - e.verts[1].co).normalized().z) > 0.99]
            bmesh.ops.bevel(t, geom=edges, offset=min(r, min(s) / 2 * 0.98), segments=segs, profile=0.5, affect="EDGES", clamp_overlap=True)
        t.normal_update()
        idx = self.mi(mat)
        for f in t.faces:
            f.material_index = idx
        fixed = False
        if top or bottom or sides:
            fix = t.faces.layers.int.new("fix")
            uv = t.loops.layers.uv.verify()
            for f in t.faces:
                n = f.normal
                if top and n.z > 0.999:
                    f.material_index = self.mi(top)
                    if top_uv:
                        u0, v0, u1, v1 = top_uv
                        for l in f.loops:
                            l[uv].uv = (u0 + (l.vert.co.x / s[0] + 0.5) * (u1 - u0), v0 + (l.vert.co.y / s[1] + 0.5) * (v1 - v0))
                        f[fix] = 1
                        fixed = True
                elif bottom and n.z < -0.999:
                    f.material_index = self.mi(bottom)
                    if bottom_uv:
                        u0, v0, u1, v1 = bottom_uv
                        for l in f.loops:
                            l[uv].uv = (u0 + (l.vert.co.x / s[0] + 0.5) * (u1 - u0), v0 + (l.vert.co.y / s[1] + 0.5) * (v1 - v0))
                        f[fix] = 1
                        fixed = True
                elif sides and abs(n.z) < 0.999:
                    f.material_index = self.mi(sides)
        self._merge(t, self._place(c, "Z", rot), fixed_uv=fixed)
        return self

    def prism(self, c, pts, h, mat, axis="Z", rot=None, bevel=0.0, bsegs=2, top=None):
        """2D outline (local x, y) extruded along local +Z from 0 to h, then oriented and moved"""
        t = bmesh.new()
        bot = [t.verts.new((x, y, 0)) for (x, y) in pts]
        tp = [t.verts.new((x, y, h)) for (x, y) in pts]
        t.faces.new(list(reversed(bot)))
        ftop = t.faces.new(tp)
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            t.faces.new((bot[i], bot[j], tp[j], tp[i]))
        bmesh.ops.recalc_face_normals(t, faces=list(t.faces))
        t.normal_update()
        if bevel > 0:
            cap_edges = [e for e in t.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-9]
            bmesh.ops.bevel(t, geom=cap_edges, offset=bevel, segments=bsegs, profile=0.5, affect="EDGES", clamp_overlap=True)
        t.normal_update()
        idx = self.mi(mat)
        for f in t.faces:
            f.material_index = idx
        if top:
            for f in t.faces:
                if f.normal.z > 0.999:
                    f.material_index = self.mi(top)
        self._merge(t, self._place(c, axis, rot))
        return self

    def cyl(self, c, r, h, mat, axis="Z", segs=32, bevel=0.0, bsegs=2, rot=None, r2=None):
        """cylinder (or frustum when r2 is given) centred on c along axis"""
        t = bmesh.new()
        bmesh.ops.create_cone(t, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=h)
        if bevel > 0:
            rims = [e for e in t.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-9 and len(e.link_faces) == 2 and
                    any(len(f.verts) > 4 for f in e.link_faces)]
            bmesh.ops.bevel(t, geom=rims, offset=bevel, segments=bsegs, profile=0.5, affect="EDGES", clamp_overlap=True)
        idx = self.mi(mat)
        for f in t.faces:
            f.material_index = idx
        self._merge(t, self._place(c, axis, rot))
        return self

    def lathe(self, c, prof, mat, segs=32, axis="Z", rot=None, closed=False, a0=0.0):
        """
        revolve a profile of (r, z) points about local Z. Points on the axis (r = 0) become poles.
        With closed=True the profile is a loop (a ring section) and the last point joins the first.
        """
        t = bmesh.new()
        rings = []
        for (r, z) in prof:
            if r < 1e-7:
                rings.append([t.verts.new((0, 0, z))])
            else:
                rings.append([t.verts.new((r * math.cos(a0 + TAU * k / segs), r * math.sin(a0 + TAU * k / segs), z)) for k in range(segs)])
        pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
        for A, B in pairs:
            if len(A) == 1 and len(B) == 1:
                continue
            for k in range(segs):
                k1 = (k + 1) % segs
                if len(A) == 1:
                    t.faces.new((A[0], B[k], B[k1]))
                elif len(B) == 1:
                    t.faces.new((A[k], B[0], A[k1]))
                else:
                    t.faces.new((A[k], A[k1], B[k1], B[k]))
        # close flat open ends that are not on the axis
        if not closed:
            for R in (rings[0], rings[-1]):
                if len(R) > 1:
                    t.faces.new(R)
        bmesh.ops.remove_doubles(t, verts=list(t.verts), dist=1e-6)
        idx = self.mi(mat)
        for f in t.faces:
            f.material_index = idx
        self._merge(t, self._place(c, axis, rot))
        return self

    def tube(self, pts, radius, mat, segs=8, steps=8, smooth=True, raw=False):
        """a round wire swept through pts (Catmull-Rom), capped at both ends"""
        P = [Vector(p) for p in pts] if raw else catmull(pts, steps)
        # drop repeated samples
        Q = [P[0]]
        for p in P[1:]:
            if (p - Q[-1]).length > 1e-5:
                Q.append(p)
        P = Q
        T = [(P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized() for i in range(len(P))]
        ref = Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))
        N = (ref - T[0] * ref.dot(T[0])).normalized()
        t = bmesh.new()
        rings = []
        for i, p in enumerate(P):
            if i > 0:   # parallel transport
                N = (N - T[i] * N.dot(T[i])).normalized()
            B = T[i].cross(N)
            rings.append([t.verts.new(p + radius * (math.cos(TAU * k / segs) * N + math.sin(TAU * k / segs) * B)) for k in range(segs)])
        for A, Bq in zip(rings, rings[1:]):
            for k in range(segs):
                k1 = (k + 1) % segs
                t.faces.new((A[k], A[k1], Bq[k1], Bq[k]))
        t.faces.new(list(reversed(rings[0])))
        t.faces.new(rings[-1])
        idx = self.mi(mat)
        for f in t.faces:
            f.material_index = idx
            f.smooth = smooth
        self._merge(t)
        return self

    def mesh(self, verts, faces, mat, M=None):
        """raw closed mesh from verts and faces"""
        t = bmesh.new()
        vs = [t.verts.new(v) for v in verts]
        for f in faces:
            t.faces.new([vs[i] for i in f])
        idx = self.mi(mat)
        for f in t.faces:
            f.material_index = idx
        self._merge(t, M)
        return self

    def cut(self, cutter):
        """subtract another Part (built with this part's material list) when finishing"""
        self.cutters.append(cutter)
        return self

    # -------------------------------------------------- finish
    def _box_uv(self, bm, uvl, skip=()):
        for f in bm.faces:
            if f in skip:
                continue
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            a, b = [(1, 2), (0, 2), (0, 1)][ax]
            for l in f.loops:
                l[uvl].uv = (l.vert.co[a] / 10.0, l.vert.co[b] / 10.0)

    def _to_mesh(self, bm, name, fixed=()):
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.normal_update()
        uvl = bm.loops.layers.uv.verify()
        self._box_uv(bm, uvl, skip=fixed)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        for m in self.mats:
            me.materials.append(material(m))
        return me

    def finish(self, coll, parent=None, pivot=None, smooth_angle=32.0, solver="EXACT", uv_func=None, local=False):
        """
        Make the object: subtract the cutters, weld, shade smooth with sharp edges past
        smooth_angle, put the origin at pivot (default: bounding-box centre). uv_func(normal, co)
        re-maps every face's UVs after the cuts (used for the textured boards).
        """
        me = self._to_mesh(self.bm, self.name, self.fixed)
        self.bm.free()
        ob = bpy.data.objects.new(self.name, me)
        coll.objects.link(ob)
        for cu in self.cutters:
            cme = cu._to_mesh(cu.bm, self.name + "_cut")
            cu.bm.free()
            cob = bpy.data.objects.new(self.name + "_cut", cme)
            coll.objects.link(cob)
            mod = ob.modifiers.new("cut", "BOOLEAN")
            mod.operation = "DIFFERENCE"
            mod.solver = solver
            mod.object = cob
            if hasattr(mod, "material_mode"):
                mod.material_mode = "INDEX"
            dg = bpy.context.evaluated_depsgraph_get()
            new = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
            ob.modifiers.clear()
            old = ob.data
            ob.data = new
            bpy.data.meshes.remove(old)
            bpy.data.objects.remove(cob, do_unlink=True)
            bpy.data.meshes.remove(cme)
            new.name = self.name
        # final pass: weld, shade smooth with sharp edges past the angle, origin at the pivot
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
        lim = math.radians(smooth_angle)
        for f in bm.faces:
            if not f.smooth:
                f.smooth = True
        for e in bm.edges:
            e.smooth = e.is_manifold and e.calc_face_angle(math.pi) < lim
        if uv_func is not None:
            uvl = bm.loops.layers.uv.verify()
            bm.normal_update()
            for f in bm.faces:
                for l in f.loops:
                    l[uvl].uv = uv_func(f.normal, l.vert.co)
        if pivot is None:
            lo = Vector((min(v.co.x for v in bm.verts), min(v.co.y for v in bm.verts), min(v.co.z for v in bm.verts)))
            hi = Vector((max(v.co.x for v in bm.verts), max(v.co.y for v in bm.verts), max(v.co.z for v in bm.verts)))
            pivot = (lo + hi) / 2
        pivot = Vector(pivot)
        for v in bm.verts:
            v.co -= pivot
        bm.to_mesh(ob.data)
        bm.free()
        ob.location = pivot
        if parent is not None:
            ob.parent = parent
            if not local:
                # geometry was built in world space: hang it under a parent that is only moved, not turned
                bpy.context.view_layer.update()
                ob.location = parent.matrix_world.inverted() @ pivot
        return ob


def check_closed(objs):
    """non-manifold edge count per object (0 = closed solid)"""
    out = {}
    for o in objs:
        if o.type != "MESH":
            continue
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bad = sum(1 for e in bm.edges if not e.is_manifold)
        if bad:
            out[o.name] = bad
        bm.free()
    return out
