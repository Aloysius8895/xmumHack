import * as THREE from 'three/webgpu'

export async function loadIsland(game)
{
    if(new URLSearchParams(location.search).get('map') === 'original')
        return null

    const response = await fetch('island/island.json')
    if(!response.ok) throw new Error(`Island metadata: ${response.status}`)
    const data = await response.json()
    const heightResponse = await fetch(data.heightUrl)
    if(!heightResponse.ok) throw new Error(`Island heights: ${heightResponse.status}`)
    const heights = new Float32Array(await heightResponse.arrayBuffer())
    if(heights.length !== data.rows * data.rows) throw new Error('Island height grid size mismatch')
    const resources = await game.resourcesLoader.load([
        ['islandModel', 'island/island.glb', 'gltf'],
        ['islandTerrainTexture', 'island/terrain-data.png', 'texture', value => { value.flipY = false }],
    ])
    Object.assign(game.resources, resources)
    const state = { data, heights }
    state.height = (x, z) =>
    {
        const u = THREE.MathUtils.clamp((x / data.size + 0.5) * (data.rows - 1), 0, data.rows - 1)
        const v = THREE.MathUtils.clamp((z / data.size + 0.5) * (data.rows - 1), 0, data.rows - 1)
        const i = Math.min(data.rows - 2, Math.floor(u)), j = Math.min(data.rows - 2, Math.floor(v))
        const a = u - i, b = v - j, n = data.rows
        return (heights[j*n+i]*(1-a)+heights[j*n+i+1]*a)*(1-b)
            + (heights[(j+1)*n+i]*(1-a)+heights[(j+1)*n+i+1]*a)*b
    }
    state.configure = () =>
    {
        game.resources.terrainTexture = game.resources.islandTerrainTexture
        const positions = new Float32Array(heights.length * 3)
        for(let j = 0; j < data.rows; j++) for(let i = 0; i < data.rows; i++)
        {
            const k = j * data.rows + i
            positions[k*3] = (i / (data.rows-1) - 0.5) * data.size
            positions[k*3+1] = heights[k]
            positions[k*3+2] = (j / (data.rows-1) - 0.5) * data.size
        }
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        game.resources.terrainModel = { scene: { children: [ { geometry } ] } }
        const refs = values =>
        {
            const group = new THREE.Group()
            for(const p of values)
            {
                const obj = new THREE.Object3D()
                obj.position.set(p.x, p.y, p.z)
                obj.rotation.y = p.rotation
                obj.scale.setScalar(p.scale)
                group.add(obj)
            }
            group.updateMatrixWorld(true)
            return { scene: group }
        }
        game.resources.oakTreesReferencesModel = refs(data.trees.filter((_,i) => i%13 !== 0 && i%19 !== 0))
        game.resources.birchTreesReferencesModel = refs(data.trees.filter((_,i) => i%13 === 0))
        game.resources.cherryTreesReferencesModel = refs(data.trees.filter((_,i) => i%19 === 0 && i%13 !== 0))
        game.resources.bushesReferences = refs(data.bushes)
        game.resources.flowersReferencesModel = refs(data.flowers)
    }
    return state
}
