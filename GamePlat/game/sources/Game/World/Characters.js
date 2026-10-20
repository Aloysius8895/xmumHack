import * as THREE from 'three/webgpu'
import { color, texture, vec3, vertexColor } from 'three/tsl'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import characters from '../../data/characters.js'

/**
 * Swap the GLB materials for the game material so characters get the same light, shadows, fog and reveal
 */
export function useGameMaterials(model)
{
    const converted = new Map()

    model.traverse((child) =>
    {
        if(!child.isMesh)
            return

        const source = child.material

        if(!converted.has(source))
        {
            let baseColor = vec3(1)
            if(source.map)
                baseColor = texture(source.map).rgb
            else if(source.vertexColors)
                baseColor = vertexColor().rgb

            converted.set(source, new MeshDefaultMaterial({
                colorNode: baseColor.mul(color(source.color ?? 0xffffff))
            }))
        }

        child.material = converted.get(source)
        child.castShadow = true
        child.receiveShadow = true
    })
}

/**
 * Scale to the wanted height and put the feet at y = 0
 */
export function fitToHeight(object, height)
{
    object.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(object)
    const size = box.max.y - box.min.y

    if(size <= 0)
        return

    const scale = height / size
    object.scale.multiplyScalar(scale)
    object.position.y -= box.min.y * scale
}

export class Characters
{
    constructor()
    {
        this.game = Game.getInstance()
        this.items = new Map()
        this.colorMaterials = new Map()

        for(const description of characters)
            this.add(description)

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)

        if(this.game.debug.active)
            this.setDebug()
    }

    add(_description)
    {
        const description = {
            rotation: 0,
            height: 1,
            animation: null,
            collider: true,
            ..._description
        }

        // Position, absolute or relative to a respawn
        const base = description.position ?? this.game.respawns.getByName(description.respawn)?.position
        if(!base)
        {
            console.warn(`Characters > "${description.name}" needs a position or a valid respawn name`)
            return null
        }
        const offset = description.offset ?? {}

        const character = {
            description: description,
            group: new THREE.Group(),
            placeholder: null,
            model: null,
            mixer: null,
            actions: new Map(),
            currentAction: null,
            grounded: false,
            groundAttempts: 0,
            object: null
        }

        character.group.position.set(base.x + (offset.x ?? 0), 0, base.z + (offset.z ?? 0))
        character.group.rotation.y = THREE.MathUtils.degToRad(description.rotation)
        this.game.scene.add(character.group)

        // Placeholder until the model is loaded
        character.placeholder = this.createPlaceholder(description.placeholder)
        this.fitToHeight(character.placeholder, description.height)
        character.group.add(character.placeholder)

        if(description.model)
            this.loadModel(character)

        this.items.set(description.name, character)

        return character
    }

    loadModel(character)
    {
        const description = character.description

        this.game.resourcesLoader.load([ [ description.name, description.model, 'gltf' ] ])
            .then((resources) =>
            {
                const gltf = resources[description.name]

                // Clone so that several characters can share a file
                const model = cloneSkinned(gltf.scene)
                this.updateMaterials(model)
                this.fitToHeight(model, description.height)

                character.group.remove(character.placeholder)
                character.placeholder = null
                character.group.add(model)
                character.model = model

                if(gltf.animations.length)
                {
                    character.mixer = new THREE.AnimationMixer(model)
                    for(const clip of gltf.animations)
                        character.actions.set(clip.name.toLowerCase(), character.mixer.clipAction(clip))

                    this.play(description.name, description.animation)
                }
            })
            .catch(() =>
            {
                console.info(`Characters > "${description.name}" model not found (${description.model}), showing placeholder`)
            })
    }

    play(name, animationName, fadeDuration = 0.3)
    {
        const character = this.items.get(name)
        if(!character || !character.mixer)
            return

        // Exact name, then partial name (Mixamo clips are often named "Armature|Walk"), then first clip
        const searched = (animationName ?? '').toLowerCase()
        let action = character.actions.get(searched)
        if(!action && searched)
            action = [...character.actions].find(([ key ]) => key.includes(searched))?.[1]
        if(!action)
            action = character.actions.values().next().value

        if(action === character.currentAction)
            return

        action.reset().fadeIn(fadeDuration).play()
        if(character.currentAction)
            character.currentAction.fadeOut(fadeDuration)
        character.currentAction = action
    }

    updateMaterials(model)
    {
        useGameMaterials(model)
    }

    fitToHeight(object, height)
    {
        fitToHeight(object, height)
    }

    getColorMaterial(hex)
    {
        if(!this.colorMaterials.has(hex))
            this.colorMaterials.set(hex, new MeshDefaultMaterial({ colorNode: color(hex) }))

        return this.colorMaterials.get(hex)
    }

    createPlaceholder(_colors = {})
    {
        const colors = {
            skin: '#ffd9b8',
            hair: '#1c1c1c',
            shirt: '#e8322f',
            shorts: '#ffd23f',
            shoes: '#ffd23f',
            ..._colors
        }

        const placeholder = new THREE.Group()
        const body = new THREE.Group()
        const head = new THREE.Group()
        head.position.y = 0.75
        body.add(head)
        placeholder.add(body)
        placeholder.userData.body = body
        placeholder.userData.head = head

        const add = (geometry, hex, x, y, z, parent = body) =>
        {
            const mesh = new THREE.Mesh(geometry, this.getColorMaterial(hex))
            mesh.position.set(x, y, z)
            mesh.castShadow = true
            mesh.receiveShadow = true
            parent.add(mesh)
            return mesh
        }

        for(const side of [ - 1, 1 ])
        {
            // Shoe and leg
            add(new THREE.BoxGeometry(0.11, 0.06, 0.17), colors.shoes, side * 0.08, 0.03, 0.02)
            add(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 12), colors.skin, side * 0.08, 0.13, 0)

            // Arm slightly away from the body and hand
            const arm = add(new THREE.CapsuleGeometry(0.04, 0.16, 4, 8), colors.shirt, side * 0.2, 0.42, 0)
            arm.rotation.z = side * 0.6
            add(new THREE.SphereGeometry(0.04, 12, 8), colors.skin, side * 0.275, 0.31, 0)
        }

        // Shorts and shirt
        add(new THREE.BoxGeometry(0.3, 0.13, 0.2), colors.shorts, 0, 0.25, 0)
        add(new THREE.BoxGeometry(0.32, 0.22, 0.22), colors.shirt, 0, 0.42, 0)

        // Head, facing +Z
        const face = add(new THREE.SphereGeometry(0.25, 32, 20), colors.skin, 0, 0, 0, head)
        face.scale.set(1.12, 0.95, 1)

        const hair = add(new THREE.SphereGeometry(0.262, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), colors.hair, 0, 0.02, - 0.025, head)
        hair.scale.set(1.12, 1, 1)
        hair.rotation.x = - 0.35

        for(const side of [ - 1, 1 ])
        {
            add(new THREE.SphereGeometry(0.05, 12, 8), colors.skin, side * 0.28, - 0.02, 0, head)

            const eye = add(new THREE.SphereGeometry(0.045, 16, 10), '#111111', side * 0.095, 0, 0.225, head)
            eye.scale.set(1, 1.2, 0.5)
            add(new THREE.SphereGeometry(0.014, 8, 6), '#ffffff', side * 0.095 + 0.01, 0.015, 0.245, head)

            const eyebrow = add(new THREE.BoxGeometry(0.1, 0.035, 0.03), '#111111', side * 0.095, 0.085, 0.21, head)
            eyebrow.rotation.z = side * 0.15
        }

        const mouth = add(new THREE.SphereGeometry(0.035, 12, 8), '#8a1f2a', 0, - 0.1, 0.215, head)
        mouth.scale.set(1, 1.2, 0.5)

        return placeholder
    }

    snapToGround(character)
    {
        const RAPIER = this.game.RAPIER
        const position = character.group.position
        const top = 50

        // Static colliders only so benches, crates or the vehicle don't count as ground
        const ray = new RAPIER.Ray({ x: position.x, y: top, z: position.z }, { x: 0, y: - 1, z: 0 })
        const hit = this.game.physics.world.castRay(ray, top * 2, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC)

        // Scene queries only work once physics stepped, so retry for a while
        if(!hit && ++character.groundAttempts < 120)
            return

        if(hit)
            position.y = top - hit.timeOfImpact

        character.grounded = true

        if(character.description.collider)
        {
            const height = character.description.height
            character.object = this.game.objects.add(
                null,
                {
                    type: 'fixed',
                    position: position,
                    rotation: character.group.quaternion,
                    friction: 0.5,
                    colliders: [ { shape: 'cylinder', parameters: [ height * 0.5, height * 0.25 ], position: { x: 0, y: height * 0.5, z: 0 } } ]
                }
            )
        }
    }

    update()
    {
        const delta = this.game.ticker.delta
        const elapsed = this.game.ticker.elapsed

        for(const character of this.items.values())
        {
            if(!character.grounded)
                this.snapToGround(character)

            if(character.mixer)
            {
                character.mixer.update(delta)
            }
            else if(character.placeholder)
            {
                // Idle bounce so the placeholder doesn't look frozen
                character.placeholder.userData.body.position.y = Math.abs(Math.sin(elapsed * 2.5)) * 0.02
                character.placeholder.userData.head.rotation.z = Math.sin(elapsed * 1.5) * 0.08
            }
        }
    }

    setDebug()
    {
        const panel = this.game.debug.panel.addFolder({
            title: '🧍 Characters',
            expanded: true,
        })

        this.game.debug.addButtons(
            panel,
            {
                'log vehicle position': () =>
                {
                    // Drive where a character should stand, click, paste in sources/data/characters.js
                    const position = this.game.player.position
                    const snippet = `position: { x: ${position.x.toFixed(2)}, z: ${position.z.toFixed(2)} },`
                    console.log(snippet)
                    navigator.clipboard?.writeText(snippet).catch(() => {})
                }
            }
        )
    }
}
