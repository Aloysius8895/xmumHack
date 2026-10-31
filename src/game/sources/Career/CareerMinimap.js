import { Game } from '../Game/Game.js'
import { pick, t } from './i18n.js'
import { MAP_WIDTH, MAP_HEIGHT } from '../Game/MapBounds.js'
import { createAltarIslandMapElement, MAP_SEA_COLORS, MAP_SEA_GRADIENTS } from '../Game/World/AltarIsland.js'
import { leaveAtBuilding } from './BuildingTravel.js'

/**
 * Corner minimap centered on the player, gym leaders shown as head avatars (click one to teleport)
 * Same map pictures and world > map conversion as the M map (sources/Game/Map.js), where the leaders also get a marker
 */

const VIEW_METERS = 70 // world width shown by the minimap

export class CareerMinimap
{
    constructor(api, ui, world)
    {
        this.game = Game.getInstance()
        this.api = api
        this.ui = ui
        this.world = world

        this.markers = []
        this.mapMarkers = []

        this.setDom()
        this.setSdgMarker()

        this.world.events.on('npcs', () => this.setMarkers())
        this.world.events.on('npcs-changed', () => this.rebindMarkers())
        this.api.events.on('state', () => this.refresh())

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 15)
    }

    setDom()
    {
        this.element = document.createElement('div')
        this.element.className = 'career-minimap'
        this.element.innerHTML = `
            <button class="career-minimap-open" aria-label="Map"></button>
            <div class="career-minimap-world js-world"></div>
            <div class="career-minimap-markers js-markers"></div>
            <svg class="career-minimap-player js-player" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 20 21 12 16 4 21Z"/></svg>
        `
        this.ui.root.appendChild(this.element)

        this.worldElement = this.element.querySelector('.js-world')
        this.markersElement = this.element.querySelector('.js-markers')
        this.playerElement = this.element.querySelector('.js-player')

        // Empty area opens the big map, avatars teleport
        this.element.querySelector('.career-minimap-open').addEventListener('click', () => this.game.modals.open('map'))
        this.mapPicture = null

        // Altar island, past the original map picture
        if(this.game.mapBounds)
        {
            this.islandElement = createAltarIslandMapElement(this.game.mapBounds)
            this.worldElement.appendChild(this.islandElement)
        }
    }

    avatarHtml(npc)
    {
        return npc.avatar
            ? `<img src="${npc.avatar}" alt="">`
            : `<span>${pick(npc.career.name).slice(0, 1)}</span>`
    }

    setSdgMarker()
    {
        this.sdgMarkers = []
        for(const [parent, className] of [[this.markersElement, 'career-minimap-npc'], [this.game.map.element, 'career-map-npc']])
        {
            const element = document.createElement('button')
            element.type = 'button'
            element.className = `${className} career-sdg-marker`
            element.style.setProperty('--career', '#7046cf')
            element.innerHTML = '<span class="career-sdg-label">SDG</span><em class="career-sdg-caption">SDG</em>'
            element.title = `SDG · ${t('map.teleport')}`
            element.setAttribute('aria-label', element.title)
            element.addEventListener('click', event => {
                event.stopPropagation()
                if(this.ui.touring || this.game.view.cinematic.active) return
                this.game.modals.close()
                leaveAtBuilding(this.game, 'sdg')
            })
            parent.appendChild(element)
            this.sdgMarkers.push(element)
        }
    }

    setMarkers()
    {
        for(const npc of this.world.npcs)
        {
            // Minimap
            const marker = document.createElement('button')
            marker.className = 'career-minimap-npc'
            marker.style.setProperty('--career', npc.career.color)
            marker.innerHTML = this.avatarHtml(npc)
            marker.addEventListener('click', (event) =>
            {
                event.stopPropagation()
                this.world.teleportTo(npc.career.id)
            })
            this.markersElement.appendChild(marker)
            this.markers.push({ npc, element: marker })

            // M map
            const mapMarker = document.createElement('button')
            mapMarker.className = 'career-map-npc'
            mapMarker.style.setProperty('--career', npc.career.color)
            mapMarker.innerHTML = `${this.avatarHtml(npc)}<em></em>`
            mapMarker.addEventListener('click', () => this.world.teleportTo(npc.career.id))
            this.game.map.element.appendChild(mapMarker)
            this.mapMarkers.push({ npc, element: mapMarker })
        }
        this.refresh()
    }

    // A mentor swapped for another career: its color and badge
    rebindMarkers()
    {
        for(const { npc, element } of this.markers)
        {
            element.style.setProperty('--career', npc.career.color)
            element.innerHTML = this.avatarHtml(npc)
        }
        for(const { npc, element } of this.mapMarkers)
        {
            element.style.setProperty('--career', npc.career.color)
            element.innerHTML = `${this.avatarHtml(npc)}<em></em>`
        }
        this.refresh()
    }

    // Labels, language and target highlight
    refresh()
    {
        const target = this.api.state?.target?.careerId

        for(const list of [ this.markers, this.mapMarkers ])
        {
            for(const { npc, element } of list)
            {
                const label = `${t('npc.leader', { career: pick(npc.career.name) })} · ${t('map.teleport')}`
                element.title = label
                element.setAttribute('aria-label', label)
                element.classList.toggle('is-target', npc.career.id === target)
                const name = element.querySelector('em')
                if(name)
                    name.textContent = pick(npc.career.name)
                if(!npc.avatar)
                    element.querySelector('span').textContent = pick(npc.career.name).slice(0, 1)
            }
        }
    }

    update()
    {
        if(!this.game.map)
            return

        // Day / night picture, like the M map
        const picture = this.game.dayCycles.intervalEvents.get('night').inInterval ? 'ui/map/map-night.webp' : 'ui/map/map-day.webp'
        if(picture !== this.mapPicture)
        {
            this.mapPicture = picture
            const night = picture.includes('night')
            this.worldElement.style.backgroundImage = this.game.mapBounds ? `url(${picture}), ${MAP_SEA_GRADIENTS[night ? 'night' : 'day']}` : `url(${picture})`
            this.worldElement.style.backgroundRepeat = this.game.mapBounds ? 'no-repeat, repeat-x' : ''
            this.worldElement.style.backgroundColor = this.game.mapBounds ? MAP_SEA_COLORS[night ? 'night' : 'day'] : ''
            this.islandElement?.setNight(night)
        }

        const size = this.element.clientWidth
        if(!size)
            return
        const worldSize = size * (this.game.mapBounds ? MAP_WIDTH : this.game.terrain.size) / VIEW_METERS
        const worldHeight = size * (this.game.mapBounds ? MAP_HEIGHT : this.game.terrain.size) / VIEW_METERS
        const player = this.game.map.worldToMap(this.game.player.position)

        // View center: the player, but held back at the map edges so the circle never shows past the map (black)
        const halfX = size * 0.5 / worldSize, halfY = size * 0.5 / worldHeight
        const center = {
            x: halfX >= 0.5 ? 0.5 : Math.min(Math.max(player.x, halfX), 1 - halfX),
            y: halfY >= 0.5 ? 0.5 : Math.min(Math.max(player.y, halfY), 1 - halfY),
        }

        // Picture moves under the player
        this.worldElement.style.width = `${worldSize}px`
        this.worldElement.style.height = `${worldHeight}px`
        if(this.game.mapBounds)
        {
            const scale = size / VIEW_METERS, b = this.game.mapBounds
            const pictureSize = this.game.terrain.size * scale
            const picturePosition = `${-(b.minX + this.game.terrain.size / 2) * scale}px ${-(b.minZ + this.game.terrain.size / 2) * scale}px`
            this.worldElement.style.backgroundSize = `${pictureSize}px ${pictureSize}px, ${pictureSize}px ${pictureSize}px`
            this.worldElement.style.backgroundPosition = `${picturePosition}, ${picturePosition}`
        }
        this.worldElement.style.transform = `translate(${size * 0.5 - center.x * worldSize}px, ${size * 0.5 - center.y * worldHeight}px)`
        this.playerElement.style.transform = `translate(calc(${(player.x - center.x) * worldSize}px - 50%), calc(${(player.y - center.y) * worldHeight}px - 50%)) rotate(${Math.PI * 0.5 - this.game.physicalVehicle.yRotation}rad)`

        // Leaders, kept on the rim when out of view
        const radius = size * 0.5 - 16
        for(const { npc, element } of this.markers)
        {
            const position = this.game.map.worldToMap(npc.character.group.position)
            let x = (position.x - center.x) * worldSize
            let y = (position.y - center.y) * worldHeight
            const distance = Math.hypot(x, y)
            const outside = distance > radius
            if(outside)
            {
                x *= radius / distance
                y *= radius / distance
            }
            element.classList.toggle('is-edge', outside)
            element.style.transform = `translate(calc(${size * 0.5 + x}px - 50%), calc(${size * 0.5 + y}px - 50%))`
        }

        // M map markers (percent of the map)
        for(const { npc, element } of this.mapMarkers)
        {
            const position = this.game.map.worldToMap(npc.character.group.position)
            element.style.left = `${position.x * 100}%`
            element.style.top = `${position.y * 100}%`
        }
        const station = this.game.career?.buildingEntrances?.stations.get('sdg')
        if(station)
        {
            const position = this.game.map.worldToMap({x: station.position.x + 1, z: station.position.z + 1})
            let x = (position.x - center.x) * worldSize, y = (position.y - center.y) * worldHeight
            const distance = Math.hypot(x, y)
            if(distance > radius) { x *= radius / distance; y *= radius / distance }
            const [mini, full] = this.sdgMarkers
            mini.classList.toggle('is-edge', distance > radius)
            mini.style.transform = `translate(calc(${size * 0.5 + x}px - 50%), calc(${size * 0.5 + y}px - 50%))`
            full.style.left = `${position.x * 100}%`
            full.style.top = `${position.y * 100}%`
        }
    }
}
