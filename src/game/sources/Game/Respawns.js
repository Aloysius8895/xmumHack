import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { insideMap } from './MapBounds.js'
import { ALTAR_ISLAND } from './World/AltarIsland.js'

export class Respawns
{
    constructor(defaultName = 'landing')
    {
        this.game = Game.getInstance()
        this.defaultName = defaultName

        this.setItems()
    }

    setItems()
    {
        this.items = new Map()

        for(const child of this.game.resources.respawnsReferencesModel.scene.children)
        {
            child.rotation.reorder('YXZ')

            let name = child.name.replace(/^respawn(.+)$/i, '$1')

            name = name.charAt(0).toLowerCase() + name.slice(1)

            const item = {
                name: name,
                position: new THREE.Vector3(
                    child.position.x,
                    4,
                    child.position.z
                ),
                rotation: child.rotation.y
            }

            if(!this.game.mapBounds || insideMap(item.position)) this.items.set(name, item)
        }

        // A separate Pet stop beside the landing plaza, not the existing kiosk entrance.
        const landing = this.items.get('landing')
        if(landing)
            this.items.set('pet', {
                name: 'pet',
                position: landing.position.clone().add(new THREE.Vector3(6, 0, 4)),
                rotation: landing.rotation,
            })

        // Altar island (World/AltarIsland.js), on the plateau at the top of its stairs, facing the lagoon
        if(!location.search.includes('noIsland'))
        {
            const { center, diameter, stairs } = ALTAR_ISLAND
            this.items.set('altarIsland', {
                name: 'altarIsland',
                position: new THREE.Vector3(center.x + stairs.to.x * diameter, stairs.top * diameter + 1.5, center.z + stairs.to.z * diameter),
                rotation: Math.PI * 0.5
            })
        }
    }

    getByName(name)
    {
        return this.items.get(name) ?? this.getDefault()
    }

    getDefault()
    {
        return this.items.get(this.defaultName) ?? this.items.get('landing')
    }

    getClosest(position)
    {
        let closestItem = null
        let closestDistance = Infinity

        this.items.forEach((item) =>
        {
            const distance = Math.hypot(item.position.x - position.x, item.position.z - position.z)

            if(distance < closestDistance)
            {
                closestDistance = distance
                closestItem = item
            }
        })

        return closestItem
    }
}
