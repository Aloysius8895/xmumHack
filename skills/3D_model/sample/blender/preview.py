"""
Preview camera and lights for checking the parts (collection PREVIEW, never exported).
    import preview; preview.setup(); preview.shot(path, target=(x, y, z), az=200, el=35, dist=140)
az / el in degrees around the target, dist in mm.
"""
import math
import bpy
from mathutils import Vector

from nc_lib import collection


def setup(res=(1600, 1100)):
    sc = bpy.context.scene
    coll = collection("PREVIEW")
    cam = bpy.data.objects.get("PreviewCam")
    if cam is None:
        cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
        coll.objects.link(cam)
    cam.data.lens = 60
    cam.data.clip_start = 1.0
    cam.data.clip_end = 5000
    sc.camera = cam
    # suns: the scene is modelled in mm, so point/area lights would fall off as if hundreds of metres away
    lights = {
        "Key": ((-0.55, 0.45, 0.70), 3.2, (1.0, 0.96, 0.9)),
        "Fill": ((0.70, 0.35, 0.45), 1.1, (0.85, 0.9, 1.0)),
        "Rim": ((0.15, -0.85, 0.45), 2.2, (1.0, 1.0, 1.0)),
    }
    for name, (dirv, strength, col) in lights.items():
        ob = bpy.data.objects.get("Preview" + name)
        if ob is not None and ob.data.type != "SUN":
            bpy.data.objects.remove(ob, do_unlink=True)
            ob = None
        if ob is None:
            ob = bpy.data.objects.new("Preview" + name, bpy.data.lights.new("Preview" + name + "Sun", "SUN"))
            coll.objects.link(ob)
        ob.data.energy = strength
        ob.data.angle = 0.2
        ob.data.color = col
        ob.rotation_euler = (-Vector(dirv)).to_track_quat("-Z", "Y").to_euler()
    # a soft studio dome for the metals to reflect: dark floor, bright band above the horizon
    w = sc.world
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    bg = nt.nodes.new("ShaderNodeBackground")
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (0.015, 0.016, 0.02, 1)
    els[1].position, els[1].color = 0.62, (0.55, 0.57, 0.6, 1)
    e = els.new(1.0)
    e.color = (0.22, 0.23, 0.26, 1)
    e2 = els.new(0.5)
    e2.color = (0.06, 0.065, 0.075, 1)
    bg.inputs["Strength"].default_value = 1.0
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast" if "AgX - Medium High Contrast" in [i.identifier for i in sc.view_settings.bl_rna.properties["look"].enum_items] else "None"
    try:
        sc.eevee.taa_render_samples = 32
    except AttributeError:
        pass
    return cam


def aim(target=(0, 0, 0), az=200.0, el=35.0, dist=150.0, lens=60):
    cam = bpy.data.objects["PreviewCam"]
    cam.data.lens = lens
    t = Vector(target)
    a, e = math.radians(az), math.radians(el)
    cam.location = t + dist * Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))
    cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
    return cam


def shot(path, **kw):
    aim(**kw)
    sc = bpy.context.scene
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path
