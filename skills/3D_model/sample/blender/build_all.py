"""
Rebuild every part, save the .blend, export the GLB and pack it for the web page.

Run inside Blender (the scene NightCanvas_Parts of night-canvas-parts.blend):
    import sys; sys.path.insert(0, r"<this folder>")
    import build_all; build_all.run()
Regenerate the textures first if pi5_layout.py or atlas_layout.py changed:
    python make_textures.py
"""
import base64
import importlib
import os

import bpy

import build_pi5
import build_cooler
import build_camera

HERE = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.join(HERE, "night-canvas-parts.glb")
JS = os.path.join(HERE, "..", "machine", "night-canvas-parts.glb.js")


def build():
    out = {}
    for m in (build_pi5, build_cooler, build_camera):
        importlib.reload(m)
        out[m.__name__] = m.build()
    return out


def export():
    vl = bpy.context.view_layer
    for o in vl.objects:
        o.select_set(False)
    for cname in ("PI5", "COOLER", "CAMERA"):
        for o in bpy.data.collections[cname].all_objects:
            o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=GLB, export_format="GLB", use_selection=True, use_active_scene=True, export_apply=True, export_yup=True,
        export_texcoords=True, export_normals=True, export_materials="EXPORT",
        export_image_format="JPEG", export_jpeg_quality=90, export_image_quality=90,
        export_meshopt_compression_enable=True, export_meshopt_extension="EXT_meshopt_compression",
        export_cameras=False, export_lights=False, export_extras=False)
    for o in vl.objects:
        o.select_set(False)
    return os.path.getsize(GLB)


def pack():
    """the page opens from file://, where fetch() of a local .glb is blocked; a <script> is not"""
    data = base64.b64encode(open(GLB, "rb").read()).decode("ascii")
    with open(JS, "w", encoding="ascii") as f:
        f.write("// Night Canvas parts (Raspberry Pi 5, Active Cooler, Camera Module 3) as a base64 GLB.\n")
        f.write("// Built in Blender from 3D_model/sample/blender/ (build_all.py); do not edit by hand.\n")
        f.write("window.NC_PARTS_GLB = '" + data + "'\n")
    return os.path.getsize(JS)


def run():
    r = build()
    bpy.ops.wm.save_mainfile()
    r["glb_bytes"] = export()
    r["js_bytes"] = pack()
    return r
