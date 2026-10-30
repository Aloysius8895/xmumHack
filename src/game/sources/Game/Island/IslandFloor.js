import { Floor } from '../World/Floor.js'
import { useGameMaterials } from '../World/Characters.js'

/** Keep the native heightfield/bedrock contract; render authored terrain with native materials. */
export class IslandFloor extends Floor
{
    setVisual()
    {
        this.mesh = this.game.resources.islandModel.scene
        useGameMaterials(this.mesh)
        this.mesh.traverse(child =>
        {
            if(!child.isMesh) return
            child.receiveShadow = true
            child.castShadow = !/Road|town-frontage|town-cross|harbor-approach|garden-|coastal-trail|ridge-path|coast-walk|beach-access/.test(child.name)
        })
        this.game.scene.add(this.mesh)
        for(const b of this.game.island.data.buildings ?? [])
            this.game.objects.add(null, {
                type: 'fixed', position: { x: b.x, y: b.y + b.height / 2, z: b.z },
                colliders: [{ shape: 'cuboid', parameters: [ b.width / 2, b.height / 2, b.depth / 2 ], category: 'object' }]
            })
    }

    // The authored island stays fixed. The original Floor moves a small render patch each frame.
    update() {}
}
