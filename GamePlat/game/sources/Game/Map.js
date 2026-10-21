import { clamp } from 'three/src/math/MathUtils.js'
import { Game } from './Game.js'
import { MAP_WIDTH, MAP_HEIGHT, worldToCroppedMap } from './MapBounds.js'
import { createAltarIslandMapElement, MAP_SEA_COLORS, MAP_SEA_GRADIENTS } from './World/AltarIsland.js'

export class Map
{
    constructor()
    {
        this.game = Game.getInstance()

        this.initiated = false
        this.modal = this.game.modals.items.get('map')
        this.element = this.modal.element.querySelector('.js-map-container')
        if(this.game.mapBounds)
        {
            const map = this.element.closest('.map')
            const ratio = MAP_WIDTH / MAP_HEIGHT
            map.style.width = `min(${85 * ratio}vmin, ${900 * ratio}px)`
            map.style.height = 'min(85vmin, 900px)'
            map.style.aspectRatio = `${ratio}`
        }

        this.setInputs()

        this.modal.events.on('open', () =>
        {
            if(!this.initiated)
                this.init()

            this.texture.update()
        })
    }

    init()
    {
        this.initiated = true
        
        this.setLocations()
        this.setPlayer()
        this.setTexture()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 14)
    }

    setLocations()
    {
        this.locations = {}
        this.locations.items = [
            { name: 'Achievements', respawnName: 'achievements', offset: { x: 0, y: -0.01 } },
            { name: 'Altar', respawnName: 'altar', offset: { x: 0, y: -0.05 } },
            { name: 'Island', respawnName: 'altarIsland', offset: { x: 0, y: -0.03 } },
            { name: 'Behind<br /> the scene', respawnName: 'behindTheScene', offset: { x: 0.01, y: 0 } },
            { name: 'Bowling', respawnName: 'bowling', offset: { x: -0.08, y: 0.03 } },
            { name: 'Career', respawnName: 'career', offset: { x: 0, y: -0.06 } },
            { name: 'Circuit', respawnName: 'circuit', offset: { x: -0.08, y: -0.05 } },
            { name: 'Cookie', respawnName: 'cookie', offset: { x: -0.02, y: -0.01 } },
            { name: 'Lab', respawnName: 'lab', offset: { x: -0.03, y: 0 } },
            { name: 'Landing', respawnName: 'landing', offset: { x: 0.02, y: 0 } },
            { name: 'Projects', respawnName: 'projects', offset: { x: 0, y: -0.02 } },
            { name: 'Social', respawnName: 'social', offset: { x: -0.01, y: -0.04 } },
            { name: 'Time Machine', respawnName: 'timeMachine', offset: { x: 0, y: 0 } },
        ]

        this.locations.items = this.locations.items.filter(item => this.game.respawns.items.has(item.respawnName) && (!this.game.mapBounds || item.respawnName !== 'circuit'))
        for(const item of this.locations.items)
        {
            const respawn = this.game.respawns.getByName(item.respawnName)
            const mapPosition = this.worldToMap(respawn.position)

            // HTML
            const html = /* html */`
                <div class="pin"></div>
                <div class="name-container">
                    <div class="name">${item.name}</div>
                </div>
            `

            const element = document.createElement('div')
            element.classList.add('location')
            element.innerHTML = html
            element.style.left = `${(mapPosition.x + item.offset.x)* 100}%`
            element.style.top = `${(mapPosition.y + item.offset.y)* 100}%`
            element.style.zIndex = Math.round(mapPosition.y * 1000)
            
            this.element.append(element)

            element.addEventListener('click', () =>
            {
                this.game.player.respawn(item.respawnName, () =>
                {
                    this.game.view.focusPoint.isTracking = true
                })
                this.game.modals.close()
            })
        }
    }
    
    setPlayer()
    {
        this.player = {}
        this.player.element = this.element.querySelector('.js-player')
        this.player.roundedPosition = { x: 0, y: 0 }
    }
    
    setTexture()
    {
        this.texture = {}
        this.texture.element = this.element.querySelector('.js-texture')
        if(this.game.mapBounds)
        {
            const b = this.game.mapBounds, size = this.game.terrain.size
            Object.assign(this.texture.element.style, {
                width: `${size / MAP_WIDTH * 100}%`, height: `${size / MAP_HEIGHT * 100}%`,
                left: `${-(b.minX + size / 2) / MAP_WIDTH * 100}%`, top: `${-(b.minZ + size / 2) / MAP_HEIGHT * 100}%`
            })

            // Sea past the original map picture, matching its east edge from north to south
            this.texture.seaElement = document.createElement('div')
            Object.assign(this.texture.seaElement.style, {
                position: 'absolute', left: '0', width: '100%', pointerEvents: 'none',
                top: this.texture.element.style.top, height: this.texture.element.style.height
            })
            this.texture.element.before(this.texture.seaElement)

            // Altar island, past the original map picture
            this.texture.islandElement = createAltarIslandMapElement(b)
            this.texture.element.after(this.texture.islandElement)
        }
        this.texture.previousUrl = null

        this.texture.element.addEventListener('load', () =>
        {
            this.texture.element.classList.add('is-visible')
        })
        
        this.texture.update = () =>
        {
            const url = this.game.dayCycles.intervalEvents.get('night').inInterval ? 'ui/map/map-night.webp' : 'ui/map/map-day.webp'

            if(url !== this.texture.previousUrl)
            {
                this.texture.element.classList.remove('is-visible')
                this.texture.previousUrl = url
                this.texture.element.src = url

                if(this.texture.islandElement)
                {
                    const night = url.includes('night')
                    this.element.style.backgroundColor = MAP_SEA_COLORS[night ? 'night' : 'day']
                    this.texture.seaElement.style.backgroundImage = MAP_SEA_GRADIENTS[night ? 'night' : 'day']
                    this.texture.islandElement.setNight(night)
                }
            }
        }
    }

    setInputs()
    {
        // Inputs keyboard
        this.game.inputs.addActions([
            { name: 'map', categories: [ 'modal', 'menu', 'wandering' ], keys: [ 'Keyboard.m', 'Keyboard.KeyM' ] },
        ])
        this.game.inputs.events.on('map', (action) =>
        {
            if(action.active)
            {
                if(!this.modal.isOpen)
                    this.game.modals.open('map')
                else
                    this.game.modals.close()
            }
        })
    }

    worldToMap(coordinates)
    {
        let x = coordinates.x
        let y = typeof coordinates.z !== 'undefined' ? coordinates.z : coordinates.y

        if(this.game.mapBounds)
        {
            return worldToCroppedMap(coordinates)
        }

        x /= this.game.terrain.size
        y /= this.game.terrain.size

        x += 0.5
        y += 0.5

        x = clamp(x, 0, 1)
        y = clamp(y, 0, 1)

        return { x, y }
    }

    update()
    {
        if(!this.modal.isOpen)
            return

        const playerRoundedX = Math.round(this.game.player.position.x)
        const playerRoundedY = Math.round(this.game.player.position.z)

        if(playerRoundedX !== this.player.roundedPosition.x || playerRoundedY !== this.player.roundedPosition.y)
        {
            this.player.roundedPosition.x = playerRoundedX
            this.player.roundedPosition.y = playerRoundedY

            const playerCoordinates = this.worldToMap(this.player.roundedPosition)
            const x = Math.round(playerCoordinates.x * 1000) / 10
            const y = Math.round(playerCoordinates.y * 1000) / 10

            this.player.element.style.left = `${x}%`
            this.player.element.style.top = `${y}%`
            // Only the direction pointer turns, the character portrait stays upright
            this.player.element.style.setProperty('--heading', `${-this.game.physicalVehicle.yRotation}rad`)
        }
    }
}
