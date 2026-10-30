import * as THREE from 'three/webgpu'
import { cameraPosition, clamp, color, dot, float, Fn, interleavedGradientNoise, luminance, mix, normalWorld, positionWorld, screenCoordinate, smoothstep, step, texture, uniform, vec3, vec4 } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { AltarIslandFoliage, AltarIslandGrassMask } from './AltarIslandFoliage.js'

/**
 * Walkable island in the sea east of the altar (static/altarIsland/altarIsland.glb)
 * Shared with the minimaps and world-building/build_altar_island_map.py (keep them in sync)
 */
export const ALTAR_ISLAND = Object.freeze({
    center: Object.freeze({ x: 127, z: - 10 }),
    diameter: 60, // Source trees end up ~3 m tall
    mirrorX: true, // Big mountain to the north (away from the south-east camera), lagoon opening to the south
    mapHalfSize: 34, // Half size in metres of the top-down map picture (island + shallow water halo)
    // Stairs from the lagoon up to the plateau south of the big mountain, facing the camera
    // In diameters, x / z from the center, top height above the waterline
    stairs: Object.freeze({ from: Object.freeze({ x: 0.1, z: 0.025 }), to: Object.freeze({ x: 0.1, z: - 0.1667 }), top: 0.068, width: 0.05 }),
    // No grass / bushes, in diameters from the centre, above a height over the waterline: the stone arch
    bareAreas: Object.freeze([ Object.freeze({ minX: - 0.125, maxX: 0.15, minZ: 0.117, maxZ: 0.25, above: 0.042 }) ]),
})

// Sea colours of the map pictures next to their east edge, shown past the original terrain
export const MAP_SEA_COLORS = Object.freeze({ day: '#334156', night: '#0c2059' })

// The picture's sea gets lighter from north to south, so a flat colour leaves a seam at its east edge
// Sampled down the last columns of ui/map/map-*.webp, laid over the picture's height (repeat-x)
export const MAP_SEA_GRADIENTS = Object.freeze({
    day: 'linear-gradient(#253041 0%, #2b3647 12.5%, #313c4c 25%, #343f52 37.5%, #384255 50%, #3a4458 62.5%, #3a4659 75%, #3c475a 87.5%, #3b4659 100%)',
    night: 'linear-gradient(#061748 0%, #071b4e 12.5%, #0b1d55 25%, #0b1f5b 37.5%, #0e225d 50%, #0c2461 62.5%, #0e2461 75%, #0f2463 87.5%, #0e2461 100%)',
})

/**
 * Island picture for the minimap and the M map, positioned in percent of the cropped map (MAP_BOUNDS)
 */
export function createAltarIslandMapElement(bounds)
{
    const element = document.createElement('img')
    element.src = 'altarIsland/altarIslandMap.webp'
    element.alt = ''
    const width = bounds.maxX - bounds.minX
    const height = bounds.maxZ - bounds.minZ
    const half = ALTAR_ISLAND.mapHalfSize
    Object.assign(element.style, {
        position: 'absolute',
        left: `${(ALTAR_ISLAND.center.x - half - bounds.minX) / width * 100}%`,
        top: `${(ALTAR_ISLAND.center.z - half - bounds.minZ) / height * 100}%`,
        width: `${half * 2 / width * 100}%`,
        height: `${half * 2 / height * 100}%`,
        pointerEvents: 'none',
    })
    element.setNight = (night) =>
    {
        element.style.filter = night ? 'brightness(0.5) saturate(0.8)' : ''
    }
    return element
}

/**
 * The source mesh is ~0.3 units wide and includes its own sea plate at local y ≈ -0.022,
 * which is sunk just under the game water and removed so the game sea shows through.
 * Rendered with the game colours (terrain dirt / grass / shore gradient, palette stone),
 * picked per texel by static/altarIsland/altarIslandStyle.png (world-building/build_altar_island_style.py)
 * The AI trees are removed from the model (world-building/remove_altar_island_trees.py), see AltarIslandFoliage
 */
export class AltarIsland
{
    constructor()
    {
        this.game = Game.getInstance()

        this.seaPlateLevel = - 0.019 // Local y just above the baked sea plate
        this.lagoonFloor = - 0.7 // Walkable shallow floor under the discarded sea plate
        this.seaFloor = - 1.5 // Same as the terrain edge and the floor outside the original terrain

        this.setModel()
        this.grassMask = new AltarIslandGrassMask(this.game.water.surfaceElevation - 0.05)
        this.setMaterial()
        this.setPhysical()
        this.setStairs()

        this.foliage = new AltarIslandFoliage(this)
    }

    setModel()
    {
        this.model = this.game.resources.altarIslandModel.scene
        this.model.updateMatrixWorld(true)
        const box = new THREE.Box3().setFromObject(this.model)
        const sourceWidth = Math.max(box.max.x - box.min.x, box.max.z - box.min.z)

        this.scale = ALTAR_ISLAND.diameter / sourceWidth
        this.model.scale.set(ALTAR_ISLAND.mirrorX ? - this.scale : this.scale, this.scale, this.scale)
        this.model.position.set(
            ALTAR_ISLAND.center.x,
            this.game.water.surfaceElevation - 0.05 - this.seaPlateLevel * this.scale,
            ALTAR_ISLAND.center.z
        )
        this.model.updateMatrixWorld(true)

        this.removeSeaPlate()
        this.game.scene.add(this.model)
    }

    // Drop the triangles under the water (baked sea plate, bumpy down to ~0.9 m under), so they neither render nor cast shadows
    removeSeaPlate()
    {
        const cut = this.game.water.surfaceElevation - 0.05
        const vertex = new THREE.Vector3()
        this.model.traverse(child =>
        {
            if(!child.isMesh)
                return

            const geometry = child.geometry
            const position = geometry.attributes.position
            const heights = new Float32Array(position.count)
            for(let i = 0; i < position.count; i++)
                heights[i] = vertex.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld).y

            const index = geometry.index
            const count = index ? index.count : position.count
            const kept = []
            for(let i = 0; i < count; i += 3)
            {
                const a = index ? index.getX(i) : i
                const b = index ? index.getX(i + 1) : i + 1
                const c = index ? index.getX(i + 2) : i + 2
                if(Math.max(heights[a], heights[b], heights[c]) > cut)
                    kept.push(a, b, c)
            }
            geometry.setIndex(kept)
        })
    }

    setMaterial()
    {
        const materials = new Map()
        const waterline = this.game.water.surfaceElevationUniform.sub(0.05)
        this.occlusionVisibility = this.getOcclusionVisibility()
        const visible = step(waterline, positionWorld.y).mul(this.occlusionVisibility)
        const styleTexture = this.game.resources.altarIslandStyleTexture

        // Palette stone and cherry tree colours of the original world
        this.colors = {}
        this.colors.stoneLow = uniform(color('#7c7691'))
        this.colors.stoneHigh = uniform(color('#c8c2c1'))
        this.colors.cherryA = uniform(color('#ff6d6d'))
        this.colors.cherryB = uniform(color('#ff9990'))

        this.model.traverse(child =>
        {
            if(!child.isMesh)
                return

            const source = child.material
            if(!materials.has(source))
            {
                const colorNode = Fn(() =>
                {
                    const weights = texture(styleTexture).rgb
                    const detail = smoothstep(0.15, 0.75, luminance(texture(source.map).rgb))

                    // Ground like the terrain: dirt and grass, shore gradient toward the water
                    const depth = clamp(waterline.add(0.8).sub(positionWorld.y).div(2.5), 0, 0.35)
                    const grass = this.grassMask.node() // Same patches as the grass blades
                    const ground = this.game.terrain.colorNode(vec4(0, grass, depth, 0))

                    // Stone on the cliffs and wherever the texture is rock
                    const stone = mix(this.colors.stoneLow, this.colors.stoneHigh, detail)
                    const flat = smoothstep(0.55, 0.8, normalWorld.y)
                    const shore = float(1).sub(smoothstep(0.4, 1.2, positionWorld.y.sub(waterline))) // Beaches, like the terrain coasts
                    const groundAmount = weights.r.add(weights.g).clamp(0, 1).mul(flat).max(shore)
                    const finalColor = mix(stone, ground, groundAmount).toVar()

                    // Cherry foliage
                    finalColor.assign(mix(finalColor, mix(this.colors.cherryA, this.colors.cherryB, detail), weights.b))

                    return finalColor
                })()

                materials.set(source, new MeshDefaultMaterial({
                    colorNode,
                    alphaNode: visible,
                    clipToMapBounds: false,
                }))

                // Only the colour map is still sampled
                source.metalnessMap?.dispose()
                source.roughnessMap?.dispose()
            }

            child.material = materials.get(source)
            child.castShadow = false // ~90k triangles would be drawn again in the shadow pass, core shadows still shade the cliffs
            child.receiveShadow = true
        })

        if(this.game.debug.active)
        {
            const debugPanel = this.game.debug.panel.addFolder({ title: '🏝️ Altar island', expanded: false })
            for(const name in this.colors)
                this.game.debug.addThreeColorBinding(debugPanel, this.colors[name].value, name)
        }
    }

    /**
     * Dithered hole where the island stands between the camera and the player
     * Only parts higher than the player are cut, so the ground around the player stays
     */
    getOcclusionVisibility()
    {
        this.occlusion = {}
        this.occlusion.radius = 2.6
        this.occlusion.target = uniform(new THREE.Vector3())

        this.game.ticker.events.on('tick', () =>
        {
            if(this.game.player)
                this.occlusion.target.value.copy(this.game.player.position)
        })

        return Fn(() =>
        {
            const head = this.occlusion.target.add(vec3(0, 1, 0))
            const toHead = head.sub(cameraPosition)
            const length = toHead.length()
            const direction = toHead.div(length)
            const along = dot(positionWorld.sub(cameraPosition), direction)
            const distance = positionWorld.sub(cameraPosition.add(direction.mul(clamp(along, 0, length)))).length()

            const inside = float(1).sub(smoothstep(this.occlusion.radius * 0.5, this.occlusion.radius, distance))
            const inFront = step(along, length.sub(1))
            const above = smoothstep(0.3, 1, positionWorld.y.sub(this.occlusion.target.y))
            const hidden = inside.mul(inFront).mul(above)

            return step(interleavedGradientNoise(screenCoordinate.xy), float(1).sub(hidden.mul(1.05)))
        })()
    }

    setPhysical()
    {
        const colliders = []

        // Island, only the triangles above the discarded sea plate
        const cut = this.lagoonFloor + 0.1
        const vertex = new THREE.Vector3()
        this.model.traverse(child =>
        {
            if(!child.isMesh)
                return

            const position = child.geometry.attributes.position
            const vertices = new Float32Array(position.count * 3)
            for(let i = 0; i < position.count; i++)
            {
                vertex.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld)
                vertices[i * 3 + 0] = vertex.x
                vertices[i * 3 + 1] = vertex.y
                vertices[i * 3 + 2] = vertex.z
            }

            const index = child.geometry.index
            const count = index ? index.count : position.count
            const indices = []
            for(let i = 0; i < count; i += 3)
            {
                const a = index ? index.getX(i) : i
                const b = index ? index.getX(i + 1) : i + 1
                const c = index ? index.getX(i + 2) : i + 2
                if(Math.max(vertices[a * 3 + 1], vertices[b * 3 + 1], vertices[c * 3 + 1]) > cut)
                    indices.push(a, b, c)
            }

            colliders.push({ shape: 'trimesh', parameters: [ vertices, new Uint32Array(indices) ], category: 'floor' })
        })

        // Shallow floor under the lagoon, sloping down to the sea floor around the island
        const size = ALTAR_ISLAND.diameter + 20
        const rows = Math.round(size / 0.5) + 1
        const heights = new Float32Array(rows * rows)
        const innerRadius = ALTAR_ISLAND.diameter * 0.5
        const outerRadius = innerRadius + 8
        for(let indexX = 0; indexX < rows; indexX++)
        {
            for(let indexZ = 0; indexZ < rows; indexZ++)
            {
                const distance = Math.hypot((indexX / (rows - 1) - 0.5) * size, (indexZ / (rows - 1) - 0.5) * size)
                const ramp = THREE.MathUtils.smoothstep(distance, innerRadius, outerRadius)
                heights[indexZ + indexX * rows] = THREE.MathUtils.lerp(this.lagoonFloor, this.seaFloor - 0.1, ramp)
            }
        }
        colliders.push({
            shape: 'heightfield',
            parameters: [ rows - 1, rows - 1, heights, { x: size, y: 1, z: size } ],
            position: { x: ALTAR_ISLAND.center.x, y: 0, z: ALTAR_ISLAND.center.z },
            category: 'floor'
        })

        // Sea floor east of the original terrain (it ends at x = terrain.size / 2)
        const b = this.game.mapBounds
        const terrainEdge = this.game.terrain.size * 0.5
        if(b && b.maxX > terrainEdge)
        {
            const halfWidth = (b.maxX - terrainEdge) * 0.5 + 2
            const halfDepth = (b.maxZ - b.minZ) * 0.5 + 2
            colliders.push({
                shape: 'cuboid',
                parameters: [ halfWidth, 1, halfDepth ],
                position: { x: terrainEdge + halfWidth, y: this.seaFloor - 1, z: (b.minZ + b.maxZ) * 0.5 },
                category: 'floor'
            })
        }

        this.game.objects.add(
            null,
            {
                type: 'fixed',
                friction: 0.2,
                restitution: 0,
                colliders
            }
        )
    }
    setStairs()
    {
        const { stairs, center, diameter } = ALTAR_ISLAND
        const waterline = this.game.water.surfaceElevation - 0.05
        const bottom = this.lagoonFloor
        const top = waterline + stairs.top * diameter
        const width = stairs.width * diameter
        const landing = 1.5

        const start = new THREE.Vector3(center.x + stairs.from.x * diameter, bottom, center.z + stairs.from.z * diameter)
        const end = new THREE.Vector3(center.x + stairs.to.x * diameter, top, center.z + stairs.to.z * diameter)
        const length = Math.hypot(end.x - start.x, end.z - start.z)

        // Group local +z goes up the stairs
        this.stairs = new THREE.Group()
        this.stairs.position.copy(start)
        this.stairs.rotation.y = Math.atan2(end.x - start.x, end.z - start.z)
        this.game.scene.add(this.stairs)

        // Visual, steps of ~25 cm that follow the slope
        const material = new MeshDefaultMaterial({
            colorNode: mix(color('#a87762'), color('#ffcf8b'), step(0.5, normalWorld.y)), // Floor slab colours
            clipToMapBounds: false
        })
        const rise = top - bottom
        const count = Math.ceil(rise / 0.25)
        const depth = - 1
        for(let i = 0; i < count; i++)
        {
            const stepTop = (i + 0.5) / count * rise
            const stepStart = i / count * length
            const stepLength = length + landing - stepStart
            const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(width, stepTop - depth, stepLength), material)
            stepMesh.position.set(0, (stepTop + depth) * 0.5, stepStart + stepLength * 0.5)
            stepMesh.castShadow = true
            stepMesh.receiveShadow = true
            this.stairs.add(stepMesh)
        }
        this.stairs.updateMatrixWorld(true)
        this.stairsArea = new THREE.Box3().setFromObject(this.stairs)

        // Physical, smooth slope with a landing, as a convex hull in world space
        const points = []
        for(const x of [ - width * 0.5, width * 0.5 ])
        {
            for(const [ z, y ] of [ [ 0, 0 ], [ length, rise ], [ length + landing, rise ], [ length + landing, depth ], [ 0, depth ] ])
            {
                const point = new THREE.Vector3(x, y, z).applyMatrix4(this.stairs.matrixWorld)
                points.push(point.x, point.y, point.z)
            }
        }

        this.game.objects.add(
            null,
            {
                type: 'fixed',
                friction: 0.4,
                restitution: 0,
                colliders: [ { shape: 'hull', parameters: [ new Float32Array(points) ], category: 'floor' } ]
            }
        )
    }
}
