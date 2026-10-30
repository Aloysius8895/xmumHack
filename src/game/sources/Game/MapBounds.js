// Retained east-side island, matched to the user's cropped map reference.
// Keep original source models intact; crop rendering, foliage, physics and map UI together.
import { color, Fn, positionWorld } from 'three/tsl'

// maxX goes past the original terrain (x = 96) to include the altar island, see World/AltarIsland.js
export const MAP_BOUNDS = Object.freeze({ minX: -18, maxX: 160, minZ: -52, maxZ: 84 })
export const MAP_WIDTH = MAP_BOUNDS.maxX - MAP_BOUNDS.minX
export const MAP_HEIGHT = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ

export function worldToCroppedMap(point)
{
    return {
        x: Math.max(0, Math.min(1, (point.x - MAP_BOUNDS.minX) / MAP_WIDTH)),
        y: Math.max(0, Math.min(1, ((point.z ?? point.y) - MAP_BOUNDS.minZ) / MAP_HEIGHT))
    }
}

export function insideMap(point, margin = 0)
{
    const z = point.z ?? point.y
    return point.x >= MAP_BOUNDS.minX + margin && point.x <= MAP_BOUNDS.maxX - margin
        && z >= MAP_BOUNDS.minZ + margin && z <= MAP_BOUNDS.maxZ - margin
}

export function cropFoliage(resources)
{
    for(const name of ['oakTreesReferencesModel','birchTreesReferencesModel','cherryTreesReferencesModel','bushesReferences','flowersReferencesModel'])
    {
        const scene = resources[name]?.scene
        if(!scene) continue
        for(const child of [...scene.children])
            if(!insideMap(child.position, 0.8)) scene.remove(child)
    }
}

export function clipExtraMaterials(scene)
{
    const seen = new Set()
    scene.traverse(child =>
    {
        if(!child.isMesh) return
        for(const material of [child.material].flat())
        {
            if(!material?.isNodeMaterial || material.userData.mapClipped || seen.has(material)) continue
            seen.add(material)
            const clip = () => positionWorld.x.lessThan(MAP_BOUNDS.minX).or(positionWorld.x.greaterThan(MAP_BOUNDS.maxX))
                .or(positionWorld.z.lessThan(MAP_BOUNDS.minZ)).or(positionWorld.z.greaterThan(MAP_BOUNDS.maxZ)).discard()
            if(material.outputNode)
            {
                const output = material.outputNode
                material.outputNode = Fn(() => { clip(); return output })()
            }
            else
            {
                const output = material.colorNode ?? color(material.color)
                material.colorNode = Fn(() => { clip(); return output })()
            }
            material.userData.mapClipped = true
        }
    })
}
