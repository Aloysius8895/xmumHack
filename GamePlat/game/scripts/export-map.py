"""
Export map collections from resources/folio-2025.blend to static/ with the settings the game expects.

From GamePlat/game:
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background resources/folio-2025.blend --python scripts/export-map.py -- areas benches
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" --background resources/folio-2025.blend --python scripts/export-map.py -- all

Or inside Blender: Scripting tab > Open this file > Run Script (exports every collection below).
Save the .blend first when running from the command line, the export reads the saved file.
"""
import os
import sys

import bpy

# Collection in the .blend > file in static/
TARGETS = {
    'areas': 'areas/areas.glb',
    'benches': 'benches/benches.glb',
    'bricks': 'bricks/bricks.glb',
    'bushes': 'bushes/bushesReferences.glb',
    'explosiveCrates': 'explosiveCrates/explosiveCrates.glb',
    'fences': 'fences/fences.glb',
    'flowers': 'flowers/flowersReferences.glb',
    'lanterns': 'lanterns/lanterns.glb',
    'poleLights': 'poleLights/poleLights.glb',
    'respawns': 'respawns/respawnsReferences.glb',
    'scenery.002': 'scenery/scenery.glb',
    'terrain': 'terrain/terrain.glb',
    'tornado': 'tornado/tornadoPathReferences.glb',
    'visual.002': 'birchTrees/birchTreesVisual.glb',
    'references': 'birchTrees/birchTreesReferences.glb',
    'visual.004': 'oakTrees/oakTreesVisual.glb',
    'references.002': 'oakTrees/oakTreesReferences.glb',
    'visual.005': 'cherryTrees/cherryTreesVisual.glb',
    'references.003': 'cherryTrees/cherryTreesReferences.glb',
}

# The game only reads transforms from *References.glb files, so they are exported without normals and UVs like the originals
POSITIONS_ONLY = { name for name, path in TARGETS.items() if path.endswith('References.glb') }


def find_layer_collection(layer_collection, name):
    if layer_collection.collection.name == name:
        return layer_collection
    for child in layer_collection.children:
        found = find_layer_collection(child, name)
        if found:
            return found
    return None


def export(name, path):
    view_layer = bpy.context.view_layer
    layer_collection = find_layer_collection(view_layer.layer_collection, name)
    if layer_collection is None:
        print(f'export-map > collection "{name}" not found, skipped')
        return

    # Some collections (tornado) are excluded from the view layer to keep the viewport clean
    # Only touch the flag when needed: setting it also re-includes excluded child collections
    excluded = layer_collection.exclude
    if excluded:
        layer_collection.exclude = False

    view_layer.active_layer_collection = layer_collection
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_active_collection=True,
        use_active_collection_with_nested=True,
        use_visible=True,           # Hidden helpers (rail curves, archives) stay out, invisible colliders and refs are exported
        export_extras=True,         # Custom properties read by the game: category, mass, friction, preventAutoAdd...
        export_yup=True,
        use_mesh_edges=True,        # Two-vertex reference lines (waterfall particles) are read by the code
        use_mesh_vertices=True,
        export_skins=False,         # The game expects plain meshes
        export_normals=name not in POSITIONS_ONLY,
        export_texcoords=name not in POSITIONS_ONLY,
        export_gn_mesh=name in POSITIONS_ONLY,      # Tree references are geometry nodes instances
        export_draco_mesh_compression_enable=False,  # Compression is done later by "npm run compress"
    )

    if excluded:
        layer_collection.exclude = True
    print(f'export-map > {name} -> {path}')


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

    output = os.path.normpath(os.path.join(os.path.dirname(bpy.data.filepath), '..', 'static'))
    if '--out' in args:
        index = args.index('--out')
        output = args[index + 1]
        del args[index:index + 2]

    names = list(TARGETS) if not args or args == ['all'] else args
    unknown = [name for name in names if name not in TARGETS]
    if unknown:
        print(f'export-map > unknown collections {unknown}, known: {list(TARGETS)}')
        names = [name for name in names if name in TARGETS]

    previous = bpy.context.view_layer.active_layer_collection
    for name in names:
        export(name, os.path.join(output, TARGETS[name]))
    bpy.context.view_layer.active_layer_collection = previous


main()
