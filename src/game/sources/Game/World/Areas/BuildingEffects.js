import * as THREE from 'three/webgpu'
import gsap from 'gsap'
import { color, Fn, luminance, mix, positionGeometry, sin, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'
import { updateBuildingMotion } from './BuildingMotion.js'

/** Original ambient props, independent of the retired Lab / Projects content and camera controls. */
export class BuildingEffects
{
    constructor(area)
    {
        this.game = area.game
        this.references = area.references

        if(this.game.debug.active)
            this.debugPanel = this.game.debug.panel.addFolder({ title: 'Building effects', expanded: false })

        const has = (...names) => names.every(name => this.references.items.get(name)?.length)
        if((this.references.items.get('balls')?.length ?? 0) >= 2)
            this.setPendulum()
        if(has('candleFlame'))
            this.setCandleFlames()
        if(has('heat', 'wood', 'liquid'))
            this.setCauldron()
        if(has('blower', 'charcoal'))
            this.setOven()
        if(has('grinder'))
            this.setGrinder()
        if(has('hammer', 'blade'))
            this.setAnvil()
    }

    update()
    {
        updateBuildingMotion(this, this.game.ticker.elapsedScaled)
        this.oven?.thresholdBinding.update()
    }

    setPendulum()
    {
        this.references.items.get('balls')[0].rotation.reorder('YXZ')
        const timeline0 = gsap.timeline({ yoyo: true, repeat: -1 })
        timeline0.to(this.references.items.get('balls')[0].rotation, { x: 0.75, ease: 'power2.out', delay: 0.75, duration: 0.75 })

        const timeline1 = gsap.timeline({ yoyo: true, repeat: -1, delay: 1.5 })
        timeline1.to(this.references.items.get('balls')[1].rotation, { x: -0.75, ease: 'power2.out', delay: 0.75, duration: 0.75 })
    }

    setCandleFlames()
    {
        const meshes = this.references.items.get('candleFlame')

        const baseMaterial = this.game.materials.getFromName('emissiveOrangeRadialGradient')
        const material = new THREE.MeshBasicNodeMaterial({ transparent: true })
        material.outputNode = baseMaterial.outputNode
        material.positionNode = Fn(() =>
        {
            const newPosition = positionGeometry.toVar()

            const wave = sin(this.game.ticker.elapsedScaledUniform.mul(0.3).add(uv().y.mul(3)))
            const strength = uv().y.oneMinus().pow(2).mul(0.06)
            newPosition.x.addAssign(wave.mul(strength))

            return newPosition
        })()

        for(const mesh of meshes)
        {
            mesh.scale.setScalar(0)
            mesh.visible = false

            mesh.material = material
        }

        const setNight = (inInterval) =>
        {
            if(inInterval)
            {
                for(const mesh of meshes)
                {
                    mesh.visible = true
                    gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 10, ease: 'power1.out', overwrite: true })
                }
            }
            else
            {
                for(const mesh of meshes)
                {
                    gsap.to(mesh.scale, { x: 0, y: 0, z: 0, duration: 10, ease: 'power1.in', overwrite: true, onComplete: () =>
                    {
                        mesh.visible = false
                    } })
                }
            }
        }
        this.game.dayCycles.events.on('night', setNight)
        setNight(this.game.dayCycles.intervalEvents.get('night').inInterval)
    }

    setCauldron()
    {
        this.cauldron = {}

        // Heat
        {
            const material = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: true, depthTest: true, depthWrite: false })

            material.outputNode = Fn(() =>
            {
                const noiseUv = uv().mul(vec2(2, 0.2))
                noiseUv.y.addAssign(this.game.ticker.elapsedScaledUniform.mul(0.05))
                const noise = texture(this.game.noises.perlin, noiseUv).r

                const strength = noise.mul(uv().y.pow(2))

                const emissiveMix = strength.smoothstep(0, 1)
                const emissiveColor = mix(color('#ff3e00'), color('#ff8641'), emissiveMix).mul(strength.add(1).mul(2))

                return vec4(vec3(emissiveColor), strength)
            })()

            this.cauldron.heat = this.references.items.get('heat')[0]
            this.cauldron.heat.material = material
            this.cauldron.heat.castShadow = false
        }

        // Burning wood
        {
            const baseMaterial = this.game.materials.getFromName('palette')
            const material = baseMaterial.clone()

            const colorA = uniform(color('#ff6b2b'))
            const colorB = uniform(color('#ff4100'))
            const intensity = uniform(1.25)

            const baseOutput = baseMaterial.outputNode
            material.outputNode = Fn(() =>
            {
                const baseUv = uv(1).toVar()

                const emissiveColor = mix(colorA, colorB, baseUv.sub(0.5).length().mul(2))
                const emissiveOutput = emissiveColor.div(luminance(emissiveColor)).mul(intensity)

                const mixStrength = baseUv.sub(0.5).length().mul(2).pow2()
                const output = mix(baseOutput.rgb, emissiveOutput, mixStrength)

                // return vec4(vec3(mixStrength), 1)
                return vec4(output.rgb, 1)
            })()

            this.cauldron.wood = this.references.items.get('wood')[0]
            this.cauldron.wood.material = material

            if(this.game.debug.active)
            {
                const debugPanel = this.debugPanel.addFolder({
                    title: 'burning wood',
                    expanded: false,
                })
                this.game.debug.addThreeColorBinding(debugPanel, colorA.value, 'colorA')
                this.game.debug.addThreeColorBinding(debugPanel, colorB.value, 'colorB')
            }
        }

        // Liquid
        {
            this.cauldron.liquid = {}

            const colorA = uniform(color('#ff0083'))
            const colorB = uniform(color('#3018eb'))
            const intensity = uniform(1.7)

            const material = new THREE.MeshBasicNodeMaterial({ transparent: true })
            const mixedColor = mix(colorA, colorB, uv().sub(0.5).length().mul(2))
            material.colorNode = mixedColor.div(luminance(mixedColor)).mul(intensity)
            material.fog = false

            this.cauldron.liquid.surface = this.references.items.get('liquid')[0]
            this.cauldron.liquid.surface.material = material

            if(this.game.debug.active)
            {
                const debugPanel = this.debugPanel.addFolder({
                    title: 'cauldron',
                    expanded: false,
                })
                this.game.debug.addThreeColorBinding(debugPanel, colorA.value, 'colorA')
                this.game.debug.addThreeColorBinding(debugPanel, colorB.value, 'colorB')
            }
        }
    }

    setOven()
    {
        this.oven = {}

        // Blower
        this.oven.blower = this.references.items.get('blower')[0]

        // Charcoal
        this.oven.charcoal = this.references.items.get('charcoal')[0]

        this.oven.threshold = uniform(0.2)

        const alphaNode = Fn(() =>
        {
            const baseUv = uv()

            const voronoi = texture(
                this.game.noises.voronoi,
                baseUv
            ).g

            voronoi.subAssign(this.oven.threshold)

            return voronoi
        })()

        const material = new MeshDefaultMaterial({
            colorNode: color(0x6F6A87),
            alphaNode: alphaNode,
            hasWater: false,
            hasLightBounce: false
        })

        this.oven.charcoal.material = material

        // Debug
        this.oven.thresholdBinding = this.game.debug.addManualBinding(
            this.debugPanel,
            this.oven.threshold,
            'value',
            { label: 'ovenThreshold', min: 0, max: 1, step: 0.001 },
            () => - Math.sin(this.game.ticker.elapsedScaled - 0.5) * 0.1 + 0.25
        )
    }

    setGrinder()
    {
        this.grinder = this.references.items.get('grinder')[0]
    }

    setAnvil()
    {
        this.anvil = {}
        this.anvil.frequency = 1
        this.anvil.loopTime = 0

        // Hammer
        this.anvil.hammer = this.references.items.get('hammer')[0]
        this.anvil.hammer.rotation.reorder('ZXY')

        // Blade
        this.anvil.blade = this.references.items.get('blade')[0]

        const material = new MeshDefaultMaterial({
            colorNode: color('#a88c7f')
        })

        const colorA = uniform(color('#ff8641'))
        const colorB = uniform(color('#ff3e00'))
        const intensity = uniform(1.7)

        const baseOutput = material.outputNode
        material.outputNode = Fn(() =>
        {
            const baseUv = uv(1).toVar()

            const emissiveColor = mix(colorA, colorB, uv().sub(0.5).length().mul(10))
            const emissiveOutput = emissiveColor.div(luminance(emissiveColor)).mul(intensity)

            const mixStrength = baseUv.y.smoothstep(0.4, 0.9)
            const output = mix(baseOutput.rgb, emissiveOutput, mixStrength)

            return vec4(output.rgb, 1)
        })()

        this.anvil.blade.material = material
    }

}
