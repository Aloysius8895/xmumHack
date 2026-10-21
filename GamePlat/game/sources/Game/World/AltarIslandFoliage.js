import * as THREE from 'three/webgpu'
import { atan, attribute, cameraPosition, color, float, Fn, positionWorld, rotateUV, step, texture, uniform, uniformArray, varying, vec2, vec3, vertexIndex } from 'three/tsl'
import { alea } from 'seedrandom'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { Trees } from './Trees.js'
import { Foliage } from './Foliage.js'
import treesData from './altarIslandTrees.json'
import { ALTAR_ISLAND } from './AltarIsland.js'

const rng = new alea('altarIsland')

/**
 * Grass patches of the altar island, like the grass areas of the terrain (terrain data green channel)
 * Smooth noise blobs over the island, none on the bare areas (stone arch)
 * Used by the island ground colour (texture) and the blades (sample)
 */
export class AltarIslandGrassMask
{
    constructor(waterline)
    {
        this.waterline = waterline
        this.size = ALTAR_ISLAND.diameter + 8
        this.min = new THREE.Vector2(ALTAR_ISLAND.center.x - this.size * 0.5, ALTAR_ISLAND.center.z - this.size * 0.5)
        this.resolution = 256

        // Value noise grid
        this.gridSize = 64
        this.grid = new Float32Array(this.gridSize * this.gridSize)
        for(let i = 0; i < this.grid.length; i++)
            this.grid[i] = rng()

        // Bare areas, in metres from the island centre
        this.bareAreas = ALTAR_ISLAND.bareAreas.map(area => ({
            minX: ALTAR_ISLAND.center.x + area.minX * ALTAR_ISLAND.diameter,
            maxX: ALTAR_ISLAND.center.x + area.maxX * ALTAR_ISLAND.diameter,
            minZ: ALTAR_ISLAND.center.z + area.minZ * ALTAR_ISLAND.diameter,
            maxZ: ALTAR_ISLAND.center.z + area.maxZ * ALTAR_ISLAND.diameter,
            above: waterline + area.above * ALTAR_ISLAND.diameter,
        }))

        // Texture for the ground colour
        const data = new Uint8Array(this.resolution * this.resolution * 4)
        const cell = this.size / this.resolution
        for(let j = 0; j < this.resolution; j++)
        {
            for(let i = 0; i < this.resolution; i++)
            {
                const value = Math.round(this.noiseMask(this.min.x + (i + 0.5) * cell, this.min.y + (j + 0.5) * cell) * 255)
                data.set([ value, value, value, 255 ], (j * this.resolution + i) * 4)
            }
        }
        this.texture = new THREE.DataTexture(data, this.resolution, this.resolution)
        this.texture.minFilter = THREE.LinearFilter
        this.texture.magFilter = THREE.LinearFilter
        this.texture.needsUpdate = true
    }

    valueNoise(x, z)
    {
        const n = this.gridSize
        const xi = Math.floor(x), zi = Math.floor(z)
        const xf = x - xi, zf = z - zi
        const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
        const value = (i, j) => this.grid[(((j % n) + n) % n) * n + (((i % n) + n) % n)]
        return THREE.MathUtils.lerp(
            THREE.MathUtils.lerp(value(xi, zi), value(xi + 1, zi), u),
            THREE.MathUtils.lerp(value(xi, zi + 1), value(xi + 1, zi + 1), u),
            v
        )
    }

    noiseMask(x, z)
    {
        const noise = this.valueNoise(x / 9, z / 9) * 0.65 + this.valueNoise(x / 3.5 + 17, z / 3.5 + 31) * 0.35
        return THREE.MathUtils.smoothstep(noise, 0.5, 0.6)
    }

    isBare(point)
    {
        return this.bareAreas.some(area => point.x > area.minX && point.x < area.maxX && point.z > area.minZ && point.z < area.maxZ && point.y > area.above)
    }

    sample(point)
    {
        return this.isBare(point) ? 0 : this.noiseMask(point.x, point.z)
    }

    // Grass amount node at positionWorld, for the island ground colour
    node()
    {
        const uv = positionWorld.xz.sub(vec2(this.min.x, this.min.y)).div(this.size)
        const amount = texture(this.texture, uv).r.toVar()
        for(const area of this.bareAreas)
        {
            const inside = step(area.minX, positionWorld.x).mul(step(positionWorld.x, area.maxX))
                .mul(step(area.minZ, positionWorld.z)).mul(step(positionWorld.z, area.maxZ))
                .mul(step(area.above, positionWorld.y))
            amount.mulAssign(float(1).sub(inside))
        }
        return amount
    }
}

/**
 * Original world trees, bushes and grass on the altar island
 * Trees replace the AI trees removed from the model (world-building/remove_altar_island_trees.py)
 * Bushes and grass blades follow the grass patches (AltarIslandGrassMask) on the flat tops
 */
export class AltarIslandFoliage
{
    constructor(island)
    {
        this.game = Game.getInstance()
        this.island = island
        this.mask = island.grassMask

        this.setSurface()
        this.setTrees()
        this.setBushes()
        this.setGrass()
        this.setVisibility()
    }

    // Only draw the island foliage when the camera looks around the island (foliage meshes are never frustum culled)
    setVisibility()
    {
        const meshes = [ this.cherryTrees.bodies, this.cherryTrees.leaves.mesh, this.oakTrees.bodies, this.oakTrees.leaves.mesh, this.bushes.mesh, this.grass ]
        const center = new THREE.Vector3(this.island.model.position.x, 0, this.island.model.position.z)
        const range = ALTAR_ISLAND.diameter * 0.5 + 45 // Island radius + view margin
        let visible = true

        this.game.ticker.events.on('tick', () =>
        {
            const focus = this.game.view.focusPoint.position
            const near = Math.hypot(focus.x - center.x, focus.z - center.z) < range
            if(near === visible)
                return
            visible = near
            for(const mesh of meshes)
                mesh.visible = near
        })
    }

    // Flat tops of the island in world space
    setSurface()
    {
        const minimumHeight = this.game.water.surfaceElevation + 0.8
        this.surface = []
        const a = new THREE.Vector3()
        const b = new THREE.Vector3()
        const c = new THREE.Vector3()
        const normal = new THREE.Vector3()

        this.island.model.traverse(child =>
        {
            if(!child.isMesh)
                return

            const position = child.geometry.attributes.position
            const index = child.geometry.index
            for(let i = 0; i < index.count; i += 3)
            {
                a.fromBufferAttribute(position, index.getX(i)).applyMatrix4(child.matrixWorld)
                b.fromBufferAttribute(position, index.getX(i + 1)).applyMatrix4(child.matrixWorld)
                c.fromBufferAttribute(position, index.getX(i + 2)).applyMatrix4(child.matrixWorld)
                normal.subVectors(b, a).cross(c.clone().sub(a))
                const area = normal.length() * 0.5
                if(area < 0.001 || Math.abs(normal.y) / (area * 2) < 0.85 || (a.y + b.y + c.y) / 3 < minimumHeight)
                    continue

                const center = a.clone().add(b).add(c).divideScalar(3)
                this.surface.push({ a: a.clone(), b: b.clone(), c: c.clone(), area, grass: this.mask.sample(center) })
            }
        })

        // Keep clear of the stairs
        const stairs = this.island.stairsArea
        if(stairs)
            this.surface = this.surface.filter(({ a }) => stairs.distanceToPoint(a) > 1)
    }

    sample(weight, count)
    {
        const cumulated = []
        let total = 0
        for(const triangle of this.surface)
        {
            total += triangle.area * weight(triangle)
            cumulated.push(total)
        }

        const points = []
        for(let i = 0; i < count; i++)
        {
            const target = rng() * total
            let low = 0, high = cumulated.length - 1
            while(low < high)
            {
                const middle = (low + high) >> 1
                if(cumulated[middle] < target) low = middle + 1
                else high = middle
            }
            const { a, b, c } = this.surface[low]
            let r1 = rng(), r2 = rng()
            if(r1 + r2 > 1)
            {
                r1 = 1 - r1
                r2 = 1 - r2
            }
            points.push(a.clone().addScaledVector(b.clone().sub(a), r1).addScaledVector(c.clone().sub(a), r2))
        }
        return points
    }

    setTrees()
    {
        this.treePositions = []
        const references = { cherry: [], oak: [] }
        for(const tree of treesData)
        {
            const reference = new THREE.Object3D()
            reference.position.set(tree.x, tree.y, tree.z).applyMatrix4(this.island.model.matrixWorld)
            reference.position.y -= 0.2 // Hide the trunk stub left in the model
            reference.rotation.y = rng() * Math.PI * 2
            reference.scale.setScalar(0.8 + rng() * 0.3)
            reference.updateMatrix()
            reference.updateMatrixWorld(true)
            references[tree.kind].push(reference)
            this.treePositions.push(reference.position.clone())
        }

        this.cherryTrees = new Trees('Altar island cherry trees', this.game.resources.cherryTreesVisualModel.scene, references.cherry, '#ff6d6d', '#ff9990')
        this.oakTrees = new Trees('Altar island oak trees', this.game.resources.oakTreesVisualModel.scene, references.oak, '#b4b536', '#d8cf3b')
    }

    setBushes()
    {
        const references = []
        for(const point of this.sample(triangle => 0.15 + triangle.grass, 400))
        {
            if(references.length >= 40)
                break
            if(this.mask.isBare(point))
                continue
            if(this.treePositions.some(tree => Math.hypot(tree.x - point.x, tree.z - point.z) < 2.2))
                continue
            if(references.some(bush => Math.hypot(bush.position.x - point.x, bush.position.z - point.z) < 3))
                continue

            const reference = new THREE.Object3D()
            const scale = 0.55 + rng() * 0.45
            reference.position.copy(point)
            reference.position.y += scale * 0.8
            reference.scale.setScalar(scale)
            references.push(reference)
        }

        this.bushes = new Foliage(references, uniform(color('#b4b536')), uniform(color('#d8cf3b')))
    }

    // Same blades and sizes as World/Grass.js, but static in the island grass patches instead of a patch following the camera
    setGrass()
    {
        const density = 18 // Blades per m² in the patches (World/Grass.js ~16.5)
        const area = this.surface.reduce((sum, triangle) => sum + triangle.area, 0)
        const blades = []
        for(const point of this.sample(() => 1, Math.round(area * density)))
        {
            const amount = this.mask.sample(point)
            if(amount > 0.15)
                blades.push([ point, amount ])
        }

        const position = new Float32Array(blades.length * 9)
        const heightRandomness = new Float32Array(blades.length * 3)
        const grassAmount = new Float32Array(blades.length * 3)
        for(let i = 0; i < blades.length; i++)
        {
            const [ point, amount ] = blades[i]
            const randomness = rng()
            for(let j = 0; j < 3; j++)
            {
                position.set([ point.x, point.y, point.z ], (i * 3 + j) * 3)
                heightRandomness[i * 3 + j] = randomness
                grassAmount[i * 3 + j] = amount
            }
        }
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
        geometry.setAttribute('heightRandomness', new THREE.Float32BufferAttribute(heightRandomness, 1))
        geometry.setAttribute('grassAmount', new THREE.Float32BufferAttribute(grassAmount, 1))
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(ALTAR_ISLAND.center.x, 0, ALTAR_ISLAND.center.z), ALTAR_ISLAND.diameter)

        const vertexLoopIndex = varying(vertexIndex.toFloat().mod(3))
        const tipness = varying(step(vertexLoopIndex, 0.5))
        const bladeWidth = uniform(0.17) // World/Grass.js values at the default view
        const bladeHeight = uniform(1)
        const bladeHeightRandomness = uniform(0.6)
        const bladeShape = uniformArray([ 0, 1, 1, 0, - 1, 0 ]) // Tip, left side, right side

        const material = new MeshDefaultMaterial({
            colorNode: this.game.terrain.grassColorUniform,
            normalNode: vec3(0, 1, 0),
            alphaNode: this.island.occlusionVisibility,
            hasWater: false,
            hasLightBounce: false,
            shadowNode: tipness.oneMinus(),
            clipToMapBounds: false,
        })

        material.positionNode = Fn(() =>
        {
            const base = attribute('position')
            const amount = attribute('grassAmount')

            // Height, smaller on the patch edges like the terrain grass
            const heightVariation = texture(this.game.noises.perlin, base.xz.mul(0.0321)).r.add(0.5)
            const height = bladeHeight
                .mul(bladeHeightRandomness.mul(attribute('heightRandomness')).add(bladeHeightRandomness.oneMinus()))
                .mul(heightVariation)
                .mul(amount)

            // Shape, facing the camera
            const shape = vec3(
                bladeShape.element(vertexLoopIndex.mul(2)).mul(bladeWidth).mul(amount),
                bladeShape.element(vertexLoopIndex.mul(2).add(1)).mul(height),
                0
            )
            const vertexPosition = base.add(shape).toVar()
            const angleToCamera = atan(base.z.sub(cameraPosition.z), base.x.sub(cameraPosition.x)).add(- Math.PI * 0.5)
            vertexPosition.xz.assign(rotateUV(vertexPosition.xz, angleToCamera, base.xz))

            // Wind
            const wind = this.game.wind.offsetNode(base.xz).mul(tipness).mul(height).mul(2)
            vertexPosition.addAssign(vec3(wind.x, 0, wind.y))

            return vertexPosition
        })()

        this.grass = new THREE.Mesh(geometry, material)
        this.grass.receiveShadow = true
        this.game.scene.add(this.grass)

        if(this.game.debug.active)
        {
            const debugPanel = this.game.debug.panel.addFolder({ title: '🌱 Altar island grass', expanded: false })
            debugPanel.addBinding(bladeWidth, 'value', { label: 'bladeWidth', min: 0, max: 1, step: 0.001 })
            debugPanel.addBinding(bladeHeight, 'value', { label: 'bladeHeight', min: 0, max: 2, step: 0.001 })
        }
    }
}
