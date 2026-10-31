import * as THREE from 'three/webgpu'
import { color, float, Fn, instancedArray, mix, normalWorld, positionGeometry, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { Inputs } from '../../Inputs/Inputs.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'
import { GuildLeaderboard } from '../GuildLeaderboard.js'

export class LandingArea extends Area
{
    constructor(model)
    {
        // Keep the old map's transform as the attachment reference for the guild parchment.
        const kioskSurface = model.children.find((child) => child.isMesh && child.material.name === 'stylizedMap')
        kioskSurface?.removeFromParent()

        super(model)

        this.localTime = uniform(0)
        if(kioskSurface)
            this.guildLeaderboard = new GuildLeaderboard(this, kioskSurface)

        this.setLetters()
        this.setKiosk()
        this.setControls()
        this.setBonfire()
        this.setAchievement()
    }

    setLetters()
    {
        const references = this.references.items.get('letters')

        this.setChillLetters(references)

        for(const reference of references)
        {
            const physical = reference.userData.object.physical
            physical.colliders[0].setActiveEvents(this.game.RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
            physical.colliders[0].setContactForceEventThreshold(5)
            physical.onCollision = (force, position) =>
            {
                this.game.audio.groups.get('hitBrick').playRandomNext(force, position)
            }
        }
    }

    /**
     * "BRUNO SIMON" > "CHILL CHILL": the same 10 physical letters (mass, sounds, reset), new glyphs from
     * static/areas/chillLetters.glb (world-building/build_chill_letters.mjs), cuboids fitted to the glyphs
     * and the letters spaced again along their line, centred on the original sign
     */
    setChillLetters(references)
    {
        const word = 'CHILLCHILL'
        const letterGap = 0.19 // Original spacing between letters and between the two words
        const wordGap = 0.51

        const glyphs = new Map()
        for(const child of this.game.resources.chillLettersModel.scene.children)
        {
            child.geometry.computeBoundingBox()
            glyphs.set(child.name.replace('letter', ''), child.geometry)
        }

        const objects = references.map((reference) => reference.userData.object)
        this.chillLetters = objects // Mentors walking on the landing keep away from them (Career/CareerWorld.js)
        const rotation = new THREE.Quaternion().copy(objects[0].physical.body.rotation())
        const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(rotation) // Reading direction, letters local +X
        const along = (object) => new THREE.Vector3().copy(object.physical.body.translation()).dot(direction)
        objects.sort((a, b) => along(a) - along(b))

        // Original sign extent
        const first = objects[0], last = objects[objects.length - 1]
        const start = new THREE.Vector3().copy(first.physical.body.translation()).addScaledVector(direction, - first.physical.colliders[0].halfExtents().x)
        const end = new THREE.Vector3().copy(last.physical.body.translation()).addScaledVector(direction, last.physical.colliders[0].halfExtents().x)
        const middle = start.clone().add(end).multiplyScalar(0.5)

        // New layout
        const widths = [ ...word ].map((letter) => glyphs.get(letter).boundingBox.max.x - glyphs.get(letter).boundingBox.min.x)
        const total = widths.reduce((sum, width) => sum + width, 0) + letterGap * (word.length - 2) + wordGap
        let offset = - total / 2

        objects.forEach((object, index) =>
        {
            const width = widths[index]
            const position = middle.clone().addScaledVector(direction, offset + width / 2)
            position.y = object.physical.body.translation().y
            offset += width + (index === 4 ? wordGap : letterGap)

            // Visual
            object.visual.object3D.geometry = glyphs.get(word[index])
            object.visual.object3D.position.copy(position)

            // Physical
            const collider = object.physical.colliders[0]
            const halfExtents = collider.halfExtents()
            collider.setHalfExtents({ x: width / 2, y: halfExtents.y, z: halfExtents.z })
            collider.setTranslationWrtParent({ x: 0, y: 0, z: 0 })
            object.physical.body.setTranslation(position, false)
            Object.assign(object.physical.initialState.position, { x: position.x, y: position.y, z: position.z }) // Reset puts the letters back here
        })
    }

    setKiosk()
    {
        // Interactive point
        const interactivePoint = this.interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('kioskInteractivePoint')[0].position,
            'Leaderboard',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                // The kiosk is the friends leaderboard (Career, server/friends.js), the map stays on the M key
                this.game.inputs.interactiveButtons.clearItems()
                this.game.career?.ui.openPanel('leaderboard')
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        // this.game.map.items.get('map').events.on('close', () =>
        // {
        //     interactivePoint.show()
        // })
    }

    setControls()
    {
        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('controlsInteractivePoint')[0].position,
            'Controls',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.menu.open('controls')
                interactivePoint.hide()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        // Menu instance
        const menuInstance = this.game.menu.items.get('controls')

        menuInstance.events.on('close', () =>
        {
            interactivePoint.show()
        })

        menuInstance.events.on('open', () =>
        {
            if(this.game.inputs.mode === Inputs.MODE_GAMEPAD)
                menuInstance.tabs.goTo('gamepad')
            else if(this.game.inputs.mode === Inputs.MODE_MOUSEKEYBOARD)
                menuInstance.tabs.goTo('mouse-keyboard')
            else if(this.game.inputs.mode === Inputs.MODE_TOUCH)
                menuInstance.tabs.goTo('touch')
        })
    }

    setBonfire()
    {
        const position = this.references.items.get('bonfireHashes')[0].position

        // Particles
        let particles = null
        {
            const emissiveMaterial = this.game.materials.getFromName('emissiveOrangeRadialGradient')
    
            const count = 30
            const elevation = uniform(5)
            const positions = new Float32Array(count * 3)
            const scales = new Float32Array(count)
    
    
            for(let i = 0; i < count; i++)
            {
                const i3 = i * 3
    
                const angle = Math.PI * 2 * Math.random()
                const radius = Math.pow(Math.random(), 1.5) * 1
                positions[i3 + 0] = Math.cos(angle) * radius
                positions[i3 + 1] = Math.random()
                positions[i3 + 2] = Math.sin(angle) * radius
    
                scales[i] = 0.02 + Math.random() * 0.06
            }
            
            const positionAttribute = instancedArray(positions, 'vec3').toAttribute()
            const scaleAttribute = instancedArray(scales, 'float').toAttribute()
    
            const material = new THREE.SpriteNodeMaterial()
            material.outputNode = emissiveMaterial.outputNode
    
            const progress = float(0).toVar()
    
            material.positionNode = Fn(() =>
            {
                const newPosition = positionAttribute.toVar()
                progress.assign(newPosition.y.add(this.localTime.mul(newPosition.y)).fract())
    
                newPosition.y.assign(progress.mul(elevation))
                newPosition.xz.addAssign(this.game.wind.direction.mul(progress))
    
                const progressHide = step(0.8, progress).mul(100)
                newPosition.y.addAssign(progressHide)
                
                return newPosition
            })()
            material.scaleNode = Fn(() =>
            {
                const progressScale = progress.remapClamp(0.5, 1, 1, 0)
                return scaleAttribute.mul(progressScale)
            })()
    
            const geometry = new THREE.CircleGeometry(0.5, 8)
    
            particles = new THREE.Mesh(geometry, material)
            particles.visible = false
            particles.position.copy(position)
            particles.count = count
            this.game.scene.add(particles)
        }

        // Hashes
        {
            const alphaNode = Fn(() =>
            {
                const baseUv = uv(1)
                const distanceToCenter = baseUv.sub(0.5).length()
    
                const voronoi = texture(
                    this.game.noises.voronoi,
                    baseUv
                ).g
    
                voronoi.subAssign(distanceToCenter.remap(0, 0.5, 0.3, 0))
    
                return voronoi
            })()
    
            const material = new MeshDefaultMaterial({
                colorNode: color(0x6F6A87),
                alphaNode: alphaNode,
                hasWater: false,
                hasLightBounce: false
            })
    
            const mesh = this.references.items.get('bonfireHashes')[0]
            mesh.material = material
        }

        // Burn
        const burn = this.references.items.get('bonfireBurn')[0]
        burn.visible = false

        // Interactive point
        this.game.interactivePoints.create(
            this.references.items.get('bonfireInteractivePoint')[0].position,
            'Res(e)t',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.reset()

                gsap.delayedCall(2, () =>
                {
                    // Bonfire
                    particles.visible = true
                    burn.visible = true
                    this.game.ticker.wait(2, () =>
                    {
                        particles.geometry.boundingSphere.center.y = 2
                        particles.geometry.boundingSphere.radius = 2
                    })

                    // Sound
                    this.game.audio.groups.get('campfire').items[0].positions.push(position)
                })
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'landing')
        })
        this.events.on('boundingOut', () =>
        {
            this.game.achievements.setProgress('landingLeave', 1)
        })
    }

    update()
    {
        this.localTime.value += this.game.ticker.deltaScaled * 0.1
    }
}
