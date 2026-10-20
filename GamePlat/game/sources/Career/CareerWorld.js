import * as THREE from 'three/webgpu'
import { Game } from '../Game/Game.js'
import { InteractivePoints } from '../Game/InteractivePoints.js'
import { useGameMaterials, fitToHeight } from '../Game/World/Characters.js'
import { pick, t } from './i18n.js'

/**
 * Career Plaza (one gym leader NPC per career near the spawn) and the career pet following the player
 */

// Plaza in front of the landing spawn, toward where the camera looks (View spherical theta = 45deg)
const PLAZA = { respawn: 'landing', distance: 4.5, spacing: 2.2 }

const NPC_HEIGHT = 1.35
const PET_HEIGHT = 0.7

export class CareerWorld
{
    constructor(api, ui)
    {
        this.game = Game.getInstance()
        this.api = api
        this.ui = ui

        this.npcs = []
        this.setPet()

        this.api.events.on('state', (state, previous) =>
        {
            if(!this.npcs.length)
                this.setNpcs(state)
            this.syncPet(state)
        })

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 11)
    }

    /**
     * NPCs: placeholder figures in the career colors (sources/Game/World/Characters.js), talk prompt once grounded
     */
    setNpcs(state)
    {
        const forward = new THREE.Vector2(- 1, - 1).normalize()
        const right = new THREE.Vector2(forward.y * - 1, forward.x)
        const count = state.careers.length

        state.careers.forEach((career, index) =>
        {
            const along = (index - (count - 1) / 2) * PLAZA.spacing
            const bend = Math.abs(along) * 0.25 // slight arc facing the spawn
            const offset = forward.clone().multiplyScalar(PLAZA.distance + bend).add(right.clone().multiplyScalar(along))

            const character = this.game.world.characters.add({
                name: `career-${career.id}`,
                respawn: PLAZA.respawn,
                offset: { x: offset.x, z: offset.y },
                rotation: 45,
                height: NPC_HEIGHT,
                collider: true,
                placeholder: { shirt: career.color, shorts: '#2b2b2b', shoes: '#f4f0e8', hair: '#2a2230' },
            })

            if(character)
                this.npcs.push({ career, character, point: null })
        })
    }

    createPoints()
    {
        for(const npc of this.npcs)
        {
            if(npc.point || !npc.character.grounded)
                continue

            const position = npc.character.group.position.clone()
            position.y += NPC_HEIGHT + 0.6

            npc.point = this.game.interactivePoints.create(
                position,
                pick(npc.career.name),
                InteractivePoints.ALIGN_RIGHT,
                InteractivePoints.STATE_CONCEALED,
                () =>
                {
                    this.game.inputs.interactiveButtons.clearItems()
                    this.ui.openDialogue(npc.career.id)
                },
                () => this.game.inputs.interactiveButtons.addItems([ 'interact' ]),
                () => this.game.inputs.interactiveButtons.removeItems([ 'interact' ]),
                () => this.game.inputs.interactiveButtons.removeItems([ 'interact' ]),
            )
        }
    }

    // Labels are drawn once, a language change draws new ones
    relabel()
    {
        for(const npc of this.npcs)
        {
            if(!npc.point)
                continue
            npc.point.hide()
            npc.point = null
        }
    }

    /**
     * Pet: model per species (animation/pets/build.py), follows and hops in code
     */
    setPet()
    {
        this.pet = {
            species: null,
            group: new THREE.Group(),
            body: new THREE.Group(),
            model: null,
            position: new THREE.Vector3(),
            facing: 0,
            hop: 0,
            celebrate: 0,
            cheer: 0,
            placed: false,
        }
        this.pet.group.add(this.pet.body)
        this.pet.group.visible = false
        this.game.scene.add(this.pet.group)
    }

    async syncPet(state)
    {
        const species = state.pet?.species ?? null
        if(species === this.pet.species)
            return
        this.pet.species = species

        if(this.pet.model)
        {
            this.pet.body.remove(this.pet.model)
            this.pet.model = null
        }
        this.pet.group.visible = false
        if(!species)
            return

        const resources = await this.game.resourcesLoader.load([ [ `pet-${species}`, `pets/${species}.glb`, 'gltf' ] ])
        if(this.pet.species !== species)
            return

        const model = resources[`pet-${species}`].scene.clone(true)
        useGameMaterials(model)
        fitToHeight(model, PET_HEIGHT)
        this.pet.model = model
        this.pet.body.add(model)
        this.pet.group.visible = true
        this.pet.placed = false
    }

    celebratePet()
    {
        this.pet.celebrate = 1
    }

    cheerPet()
    {
        this.pet.cheer = 1
    }

    updatePet()
    {
        const pet = this.pet
        if(!pet.model)
            return

        const physical = this.game.physicalVehicle
        const delta = this.game.ticker.deltaScaled / this.game.time.defaultScale
        const elapsed = this.game.ticker.elapsed

        // Beside and slightly behind the player, so the camera sees it whichever way the player walks
        const feet = new THREE.Vector3(physical.position.x, physical.position.y - physical.halfHeight, physical.position.z)
        const behind = new THREE.Vector3(- Math.cos(physical.facing), 0, Math.sin(physical.facing))
        const side = new THREE.Vector3(behind.z, 0, - behind.x)
        const target = feet.clone().addScaledVector(behind, 0.7).addScaledVector(side, 0.95)

        if(!pet.placed || pet.position.distanceTo(target) > 12)
        {
            pet.position.copy(target)
            pet.placed = true
        }

        const previous = pet.position.clone()
        pet.position.x += (target.x - pet.position.x) * Math.min(1, delta * 5)
        pet.position.z += (target.z - pet.position.z) * Math.min(1, delta * 5)
        pet.position.y += (target.y - pet.position.y) * Math.min(1, delta * 8)

        // Face where it goes, or the player when idle
        const moved = Math.hypot(pet.position.x - previous.x, pet.position.z - previous.z) / Math.max(delta, 1e-4)
        const look = moved > 0.3 ? new THREE.Vector2(pet.position.x - previous.x, pet.position.z - previous.z) : new THREE.Vector2(feet.x - pet.position.x, feet.z - pet.position.z)
        if(look.lengthSq() > 1e-6)
        {
            const wanted = Math.atan2(look.x, look.y) // model faces +Z
            let angle = wanted - pet.facing
            angle = Math.atan2(Math.sin(angle), Math.cos(angle))
            pet.facing += angle * Math.min(1, delta * 8)
        }

        // Hop while moving, breathe while idle, squash on landing (skills/game/game-feel)
        let height = 0
        let squash = 0
        if(moved > 0.3)
        {
            pet.hop += delta * Math.min(14, 6 + moved * 1.5)
            const wave = Math.sin(pet.hop)
            height = Math.abs(wave) * 0.18
            squash = Math.max(0, 0.25 - Math.abs(wave)) * 0.6
        }
        else
        {
            squash = - Math.sin(elapsed * 3) * 0.02
        }

        // Cheer: one hop. Celebrate: three hops with a spin
        let spin = 0
        if(pet.cheer > 0)
        {
            pet.cheer = Math.max(0, pet.cheer - delta * 2)
            height += Math.sin((1 - pet.cheer) * Math.PI) * 0.35
        }
        if(pet.celebrate > 0)
        {
            pet.celebrate = Math.max(0, pet.celebrate - delta * 0.5)
            const progress = 1 - pet.celebrate
            height += Math.abs(Math.sin(progress * Math.PI * 3)) * 0.6
            spin = progress * Math.PI * 4
        }

        pet.group.position.set(pet.position.x, pet.position.y + height, pet.position.z)
        pet.group.rotation.y = pet.facing + spin
        pet.body.scale.set(1 + squash, 1 - squash, 1 + squash)
    }

    update()
    {
        if(this.npcs.length)
            this.createPoints()
        this.updatePet()
    }
}
