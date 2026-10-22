import * as THREE from 'three/webgpu'
import { Game } from '../Game/Game.js'
import { Events } from '../Game/Events.js'
import { InteractivePoints } from '../Game/InteractivePoints.js'
import { useGameMaterials, fitToHeight } from '../Game/World/Characters.js'
import { pick, t } from './i18n.js'
import { insideMap } from '../Game/MapBounds.js'

/**
 * Gym leader NPCs spread over the map (one per career) and the career pet following the player
 */

const NPC_HEIGHT = 1.35

// Gym leaders stroll around their spot, never into the water (ground under the water level) nor onto obstacles
const WANDER = {
    radius: 5,          // metres around the original spot
    speed: 1.1,         // metres per second
    pause: [ 2, 6 ],    // seconds standing between two walks
    stopDistance: 3.2,  // stop and face the player this close
    maxStep: 0.35,      // ground height change allowed between two samples (benches, trees, cliffs are higher)
    sampleStep: 0.5,
}

// Where each gym leader stands: an area of the map (respawn point) + offset in metres, picked by theme
// model / animation: own rigged model (animation/build.py, shared clips), otherwise a placeholder figure in the career color
// avatar: head portrait for the maps (animation/portrait.py), otherwise a colored badge
export const NPCS = {
    'product-manager':    { respawn: 'career', offset: { x: 2.5, z: 2.5 } },
    'frontend-developer': { respawn: 'projects', offset: { x: 2.5, z: 2.5 }, model: 'characters/npcBoy1/npcBoy1.glb', animation: 'idle', avatar: 'ui/avatars/npcBoy1.png' },
    'ml-engineer':        { respawn: 'lab', offset: { x: 2.5, z: 2.5 } },
    'backend-developer':  { respawn: 'behindTheScene', offset: { x: 2.5, z: 2.5 } },
    'ui-ux-designer':     { respawn: 'social', offset: { x: 2.5, z: 2.5 } },
    'data-analyst':       { respawn: 'achievements', offset: { x: 2.5, z: 2.5 } },
}

const PET_HEIGHT = 0.7

export class CareerWorld
{
    constructor(api, ui)
    {
        this.game = Game.getInstance()
        this.api = api
        this.ui = ui

        this.events = new Events()
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
        for(const career of state.careers)
        {
            const spot = NPCS[career.id]
            if(!spot)
                continue

            const { avatar, ...description } = spot
            const character = this.game.world.characters.add({
                name: `career-${career.id}`,
                rotation: 45, // facing the default camera
                height: NPC_HEIGHT,
                collider: true,
                placeholder: { shirt: career.color, shorts: '#2b2b2b', shoes: '#f4f0e8', hair: '#2a2230' },
                ...description,
            })

            if(character)
                this.npcs.push({ career, character, avatar: avatar ?? null, point: null, wander: { home: null, target: null, pause: 1 + Math.random() * 4, facing: THREE.MathUtils.degToRad(45) } })
        }

        this.events.trigger('npcs', [ this.npcs ])
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
            // Reachable from where the mentor stops to face the player
            npc.point.radius = WANDER.stopDistance + 0.3
        }
    }

    /**
     * Teleport in front of a gym leader (same fade as the game respawn), facing them
     */
    teleportTo(careerId)
    {
        this.game.clickMove?.cancel()
        const npc = this.npcs.find((item) => item.career.id === careerId)
        if(!npc || !npc.character.grounded)
            return

        // From the M map: close it (no-op when nothing is open)
        this.game.modals.close()

        this.game.overlay.show(() =>
        {
            const target = npc.character.group.position
            // 2.2 m toward the camera (+X +Z), facing the NPC (facing 135deg points to -X -Z)
            this.game.physicalVehicle.moveTo(
                { x: target.x + 1.55, y: target.y + this.game.physicalVehicle.halfHeight + 0.3, z: target.z + 1.55 },
                Math.PI * 0.75
            )
            this.game.player.state = 1 // Player.STATE_DEFAULT
            this.game.view.focusPoint.isTracking = true
            this.pet.placed = false
            this.game.overlay.hide()
        })
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

    /**
     * Wandering: pick a reachable spot around home, walk there, pause, repeat. Stops to face the player close by or in dialogue.
     */
    groundAt(x, z, npc)
    {
        const RAPIER = this.game.RAPIER
        const ray = new RAPIER.Ray({ x, y: 50, z }, { x: 0, y: - 1, z: 0 })
        const hit = this.game.physics.world.castRay(ray, 100, true, RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, undefined, npc.character.object?.physical.body)
        return hit ? 50 - hit.timeOfImpact : null
    }

    isWalkable(from, to, npc)
    {
        const distance = Math.hypot(to.x - from.x, to.z - from.z)
        const steps = Math.max(1, Math.ceil(distance / WANDER.sampleStep))
        const waterLevel = this.game.water.surfaceElevation + 0.18
        let previous = from.y
        for(let i = 1; i <= steps; i++)
        {
            const x = from.x + (to.x - from.x) * i / steps
            const z = from.z + (to.z - from.z) * i / steps
            const y = this.groundAt(x, z, npc)
            if(y === null || y < waterLevel || Math.abs(y - previous) > WANDER.maxStep || (this.game.mapBounds && !insideMap({ x, z }, 1)))
                return false
            previous = y
        }
        return true
    }

    updateNpcs(delta)
    {
        const player = this.game.player.position
        for(const npc of this.npcs)
        {
            const { character, wander } = npc
            if(!character.grounded)
                continue

            const position = character.group.position
            if(!wander.home)
                wander.home = position.clone()

            // Talking or player close: stand still and look at the player
            const toPlayer = Math.hypot(player.x - position.x, player.z - position.z)
            const talking = this.ui.dialogue?.careerId === npc.career.id
            let moving = false
            if(talking || toPlayer < WANDER.stopDistance)
            {
                wander.target = null
                wander.pause = Math.max(wander.pause, 1.5)
                this.turnNpc(npc, Math.atan2(player.x - position.x, player.z - position.z), delta)
            }
            else if(wander.pause > 0)
            {
                wander.pause -= delta
            }
            else if(!wander.target)
            {
                // A few tries per frame at most, retry after a short pause otherwise
                for(let i = 0; i < 4 && !wander.target; i++)
                {
                    const angle = Math.random() * Math.PI * 2
                    const radius = 1.5 + Math.random() * (WANDER.radius - 1.5)
                    const target = new THREE.Vector3(wander.home.x + Math.cos(angle) * radius, 0, wander.home.z + Math.sin(angle) * radius)
                    if(Math.hypot(target.x - position.x, target.z - position.z) > 1 && this.isWalkable(position, target, npc))
                        wander.target = target
                }
                if(!wander.target)
                    wander.pause = 1
            }
            else
            {
                const dx = wander.target.x - position.x
                const dz = wander.target.z - position.z
                const remaining = Math.hypot(dx, dz)
                const step = Math.min(remaining, WANDER.speed * delta)
                const nextX = position.x + dx / remaining * step
                const nextZ = position.z + dz / remaining * step
                const y = this.groundAt(nextX, nextZ, npc)

                // Something moved in the way (player crate, other NPC): stop here
                if(y === null || y < this.game.water.surfaceElevation + 0.18 || Math.abs(y - position.y) > WANDER.maxStep)
                {
                    wander.target = null
                    wander.pause = WANDER.pause[0]
                }
                else
                {
                    position.set(nextX, y, nextZ)
                    this.turnNpc(npc, Math.atan2(dx, dz), delta)
                    moving = true
                    if(remaining - step < 0.05)
                    {
                        wander.target = null
                        wander.pause = WANDER.pause[0] + Math.random() * (WANDER.pause[1] - WANDER.pause[0])
                    }
                }
            }

            // Collider, talk prompt and animation follow
            if(moving)
            {
                character.object?.physical.body.setTranslation(position, true)
                npc.point?.setPosition(new THREE.Vector3(position.x, position.y + NPC_HEIGHT + 0.6, position.z))
            }
            if(moving !== wander.moving)
            {
                wander.moving = moving
                this.game.world.characters.play(character.description.name, moving ? 'walk' : character.description.animation)
            }
        }
    }

    turnNpc(npc, angle, delta)
    {
        let difference = angle - npc.wander.facing
        difference = Math.atan2(Math.sin(difference), Math.cos(difference))
        npc.wander.facing += difference * Math.min(1, delta * 6)
        npc.character.group.rotation.y = npc.wander.facing
    }

    update()
    {
        if(this.npcs.length)
        {
            this.createPoints()
            this.updateNpcs(this.game.ticker.deltaScaled / this.game.time.defaultScale)
        }
        this.updatePet()
    }
}
