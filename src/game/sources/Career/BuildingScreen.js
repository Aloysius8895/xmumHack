import * as THREE from 'three/webgpu'
import { texture } from 'three/tsl'
import gsap from 'gsap'
import { pick, t } from './i18n.js'
import { BUILDING_DESTINATIONS } from './BuildingTravel.js'
import { displaySize, screenTransform, signAspect } from './ScreenProjection.js'
import { exhibitLayout } from './ExhibitLayout.js'
import { LegacyExhibit } from './LegacyExhibit.js'

// Share of the view the board fills in board mode: the building stays visible around it (enlarging is for reading)
const BOARD_FILL = 0.66
const ZOOM_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21M10.5 7.5v6M7.5 10.5h6"/></svg>'

/** Shared workshop visit: keep the camera and navigation lifecycle while presenting live
 * career content in the viewport-fitted illustrated fantasy frame.
 */
export class BuildingScreen
{
    constructor(game, ui)
    {
        Object.assign(this, { game, ui })
        this.area = game.world.areas.projects
        this.surface = this.area.references.items.get('images')[0]
        this.legacyExhibit = new LegacyExhibit(this.area)
        // The workshop's signs carry the captions; the camera frames the visited building's own screen when it has one.
        this.workshop = { area: this.area, surface: this.surface, exhibit: this.legacyExhibit }
        this.screens = new Map([[this.area, this.workshop]])
        this.screen = this.workshop
        this.labels = new Map()
        // One atlas/material for all wooden sign captions: changing categories only redraws text,
        // rather than compiling new GPU materials when a room opens for the first time.
        this.atlas = document.createElement('canvas')
        this.atlas.width = this.atlas.height = 2048
        this.atlasContext = this.atlas.getContext('2d')
        this.atlasContext.fillStyle = '#000'
        this.atlasContext.fillRect(0, 0, 2048, 2048)
        this.atlasTexture = new THREE.CanvasTexture(this.atlas)
        this.atlasTexture.flipY = false
        this.atlasTexture.generateMipmaps = false
        this.atlasTexture.minFilter = this.atlasTexture.magFilter = THREE.LinearFilter
        this.signMaterial = new THREE.MeshBasicNodeMaterial({ color: '#f1e9ff', transparent: true, depthWrite: false, side: THREE.DoubleSide })
        this.signMaterial.opacityNode = texture(this.atlasTexture).r
        this.controls = document.createElement('div')
        this.controls.className = 'building-exhibit-controls building-only'
        this.controls.innerHTML = `<div class="building-exhibit-actions">
            <button type="button" class="building-exhibit-zoom" data-action="building-zoom">${ZOOM_ICON}</button>
            <button type="button" class="building-exhibit-exit" data-action="close">Esc <span>×</span></button>
        </div>`
        this.zoomed = false
        ui.root.appendChild(this.controls)
        this.hotspots = []
        this.bindArrow('arrowPreviousProject', 'building-room', -1)
        this.bindArrow('arrowNextProject', 'building-room', 1)
        this.bindArrow('arrowPreviousImage', 'building-page', -1)
        this.bindArrow('arrowNextImage', 'building-page', 1)
        const pagination = this.area.references.items.get('pagination')?.[0]?.children[0]
        pagination?.children.filter(child => /^plane/.test(child.name)).forEach((mesh, index) =>
            this.addHotspot(mesh, 'building-dot', { index }))
        this.setLabel(this.findText('url'), 'KerjayaKu · Team Chill Chill')
        this.replaceTemplateLabel()
        this.clearLegacyBlackboard()
        this.setLabel(this.findText('title'), 'KerjayaKu')
        this.setLabel(this.findText('previous'), t('menu.profile'))
        this.setLabel(this.findText('next'), t('menu.market'))
        const attributes = this.area.references.items.get('attributes')?.[0]
        for(const [name, text] of Object.entries({role: t('menu.careers'), at: 'KerjayaKu', with: 'Team Chill Chill'}))
            attributes?.children.find(child => child.name === name)?.traverse(child =>
            {
                if(child.isMesh && /^text/.test(child.name)) this.setLabel(child, text)
            })
        this.sideFurniture = ['previous', 'next'].map(name => this.area.references.items.get(name)?.[0])
            .filter(Boolean).map(object => ({ object, scale: object.scale.clone(), position: object.position.clone() }))
        Object.assign(this.workshop, this.header(this.area))
        // White arrow icons stay visible against the purple blocks, regardless of the day/night tint.
        this.arrowMaterial = new THREE.MeshBasicNodeMaterial({color: '#ffffff'})
        for(const name of ['arrowPreviousProject', 'arrowNextProject', 'arrowPreviousImage', 'arrowNextImage'])
            this.area.references.items.get(name)?.[0]?.traverse(child => { if(child.isMesh) child.material = this.arrowMaterial })
        document.fonts?.ready.then(() =>
        {
            for(const [mesh, label] of this.labels)
            {
                const text = label.text
                label.text = null
                this.setLabel(mesh, text)
            }
        })
        this.onPanel = () => this.syncContent()
        ui.events.on('panel', this.onPanel)
        game.ticker.events.on('tick', () => this.update(), 997)
        game.viewport.events.on('change', () =>
        {
            if(!this.station) return
            this.reserve = this.topReserve()
            this.layout()
            const framing = this.framing()
            game.view.cinematic.position.copy(framing.position)
            game.view.cinematic.target.copy(framing.target)
        })
    }

    findText(name, area = this.area)
    {
        let mesh = null
        area.references.items.get(name)?.[0]?.traverse(child =>
        {
            if(child.isMesh && /^text/.test(child.name)) mesh ??= child
        })
        return mesh
    }

    setLabel(mesh, text)
    {
        if(!mesh) return
        let label = this.labels.get(mesh)
        if(!label)
        {
            mesh.geometry.computeBoundingBox()
            const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3())
            const row = this.labels.size
            if(row >= 10) return
            label = { row, text: null, ratio: signAspect(size) }
            this.mapRow(mesh, row)
            this.labels.set(mesh, label)
        }
        const context = this.atlasContext, y = label.row * 192
        const family = 'Arial, "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif'
        context.font = `600 118px ${family}`
        const sideLabels = [this.findText('previous'), this.findText('next')]
        const isSideLabel = sideLabels.includes(mesh)
        let availableWidth = label.ratio * 184
        let measured = context.measureText(text).width
        if(isSideLabel)
        {
            // Fit every category once, so shorter names never grow between rooms.
            availableWidth = Math.min(...sideLabels.filter(Boolean).map(side => {
                side.geometry.computeBoundingBox()
                return signAspect(side.geometry.boundingBox.getSize(new THREE.Vector3())) * 184
            }))
            measured = Math.max(...Object.keys(BUILDING_DESTINATIONS)
                .map(panel => context.measureText(t(`menu.${panel}`)).width))
        }
        const widthFill = isSideLabel ? 0.99 : 0.92
        const fontSize = 118 * Math.min(1, availableWidth * widthFill / Math.max(measured, 1))
        if(label.text === text && label.fontSize === fontSize) return
        label.text = text
        label.fontSize = fontSize
        context.save()
        context.fillStyle = '#000'
        context.fillRect(0, y, 2048, 192)
        const virtualWidth = label.ratio * 184
        context.translate(0, y + 4)
        context.scale(2048 / virtualWidth, 1)
        context.font = `600 ${fontSize}px ${family}`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillStyle = '#fff'
        context.fillText(text, virtualWidth / 2, 92)
        context.restore()
        this.atlasTexture.needsUpdate = true
    }

    /** Point a sign's caption at one atlas row */
    mapRow(mesh, row)
    {
        mesh.geometry = mesh.geometry.clone()
        const uv = mesh.geometry.attributes.uv
        for(let i = 0; i < uv.count; i++)
            uv.setXY(i, uv.getX(i), (row * 192 + 4 + uv.getY(i) * 184) / 2048)
        uv.needsUpdate = true
        mesh.material = this.signMaterial
    }

    /** A sign that always reads like another one (same size) shows that sign's atlas row, without a row of its own */
    shareLabel(mesh, source)
    {
        const label = this.labels.get(source)
        if(mesh && label && !this.labels.has(mesh)) this.mapRow(mesh, label.row)
    }

    /** Title and brand planks above a screen, with their original transforms to restore after a visit */
    header(area)
    {
        const titleText = this.findText('title', area)
        const brandRow = area.references.items.get('url')?.[0]
        let brandBoard = null
        if(brandRow)
        {
            brandBoard = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.30),
                new THREE.MeshBasicNodeMaterial({ color: '#35204f', side: THREE.DoubleSide }))
            brandBoard.position.z = 0.02
            brandBoard.visible = false
            brandRow.add(brandBoard)
        }
        return {
            titleText: titleText && { object: titleText, scale: titleText.scale.clone() },
            header: ['title', 'url'].map(name => {
                const object = area.references.items.get(name)?.[0]
                return object && { name, object, scale: object.scale.clone(), position: object.position.clone() }
            }).filter(Boolean),
            brandBoard,
        }
    }

    clearLegacyBlackboard()
    {
        const board = this.area.references.items.get('blackBoard')?.[0]
        if(!board) return
        // Its three original control-label textures were stripped. Add our own single label.
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.8), new THREE.MeshBasicNodeMaterial())
        plane.name = 'textKerjayaKuControls'
        plane.position.set(0.34, 1, 0.035)
        board.add(plane)
        this.setLabel(plane, '←   →   Esc')
    }

    replaceTemplateLabel()
    {
        // Replace the old portfolio's "DISTINCTIONS" lettering on its existing wooden plank.
        const word = this.area.references.items.get('el')?.find(mesh => mesh.isMesh && mesh.parent === this.game.scene)
        if(!word) return
        word.geometry.computeBoundingBox()
        const bounds = word.geometry.boundingBox
        const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3())
        word.geometry = new THREE.PlaneGeometry(size.x, Math.max(size.y, 0.12)).translate(center.x, center.y, bounds.max.z + 0.01)
        this.setLabel(word, 'SDG IMPACT')
    }

    bindArrow(reference, action, direction)
    {
        const mesh = this.area.references.items.get(reference)?.[0]
        if(mesh) this.addHotspot(mesh, action, { direction })
    }

    addHotspot(mesh, action, data)
    {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'building-exhibit-hit'
        button.dataset.action = action
        Object.assign(button.dataset, data)
        this.controls.appendChild(button)
        this.hotspots.push({ mesh, button, data })
    }

    show(station)
    {
        this.station = station
        this.screen = this.screenFor(station)
        this.screen.area.frustum.alwaysVisible = true
        this.screen.area.frustum.test()
        if(this.screen === this.workshop) this.applySideFurniture()
        this.applyHeader(this.screen)
        this.screen.surface.visible = true
        const { game, ui } = this
        ui.root.classList.add('is-building-view', 'is-building-entering', 'is-workshop-exhibit')
        ui.panelElement.classList.add('is-building-screen')
        // A screen without the workshop's wooden side signs gets the panel's own previous/next buttons
        ui.root.classList.toggle('is-plain-board', this.screen !== this.workshop)
        game.domElement.classList.add('is-building-visit')
        ui.fitBar()
        this.reserve = this.topReserve()
        this.layout()
        // Phones start enlarged: projected onto the board, the text would be too small to read.
        this.setZoomed(game.viewport.width < 600, { animate: false })
        return this.framing()
    }

    /** Height kept clear for the top navigation bar, which stays on screen in buildings */
    topReserve()
    {
        const bottom = this.ui.rail?.offsetHeight ? this.ui.rail.getBoundingClientRect().bottom : 0
        return bottom > 0 ? Math.min(bottom + 12, this.game.viewport.height * 0.4) : 0
    }

    /**
     * Board mode projects the live panel onto the building's screen, enlarged mode centers it over the view. Kept while
     * changing rooms, reset when leaving. The switch pops out of (or back into) the board's on-screen rectangle.
     */
    setZoomed(zoomed, { animate = true } = {})
    {
        const panel = this.ui.panelElement
        this.zoomAnimation?.cancel()
        this.zoomAnimation = null
        const from = animate ? this.boardRect() : null
        const motion = from && panel.animate && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        const apply = (on) =>
        {
            this.zoomed = on
            this.ui.root.classList.toggle('is-fantasy-exhibit', on)
            if(on) this.screen.exhibit.hide()
            else
            {
                this.screen.exhibit.restore()
                for(const property of ['left', 'top', '--exhibit-width']) panel.style.removeProperty(property)
                this.layout()
            }
            this.update()
        }
        if(zoomed || !motion) apply(zoomed)
        if(!motion) return
        const box = exhibitLayout(this.game.viewport.width, this.game.viewport.height, this.reserve)
        const board = `translate(${from.left - box.left}px, ${from.top - box.top}px) scale(${from.width / box.width}, ${from.height / box.height})`
        const frames = [ { transform: board, opacity: 0.6 }, { transform: 'none', opacity: 1 } ]
        const animation = this.zoomAnimation = panel.animate(zoomed ? frames : frames.reverse(), { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' })
        animation.onfinish = () =>
        {
            if(this.zoomAnimation !== animation) return
            if(!zoomed) apply(false)
            animation.cancel()
            this.zoomAnimation = null
        }
    }

    /** On-screen rectangle of the building's screen, null outside a visit */
    boardRect()
    {
        if(!this.station || !this.corners) return null
        const surface = this.screen.surface
        surface.updateWorldMatrix(true, false)
        const points = this.corners.map(corner => this.project(corner.clone().applyMatrix4(surface.matrixWorld)))
        const left = Math.min(...points.map(p => p.x)), top = Math.min(...points.map(p => p.y))
        const width = Math.max(...points.map(p => p.x)) - left, height = Math.max(...points.map(p => p.y)) - top
        return width > 0 && height > 0 ? { left, top, width, height } : null
    }

    /** Changing rooms inside a visit: fly to the new room's own screen when it has another one (Profile: the lab) */
    moveTo(screen)
    {
        const previous = this.screen
        previous.exhibit.restore()
        this.restoreHeader(previous)
        previous.area.frustum.alwaysVisible = false
        this.screen = screen
        screen.area.frustum.alwaysVisible = true
        screen.area.frustum.test()
        if(screen === this.workshop) this.applySideFurniture()
        this.applyHeader(screen)
        this.ui.root.classList.toggle('is-plain-board', screen !== this.workshop)
        screen.surface.visible = true
        if(this.zoomed) screen.exhibit.hide()
        this.layout()
        this.fly(this.framing())
    }

    fly({ position, target })
    {
        const cinematic = this.game.view.cinematic
        this.dolly?.kill()
        this.dolly = gsap.to(cinematic.position, { x: position.x, y: position.y, z: position.z, duration: 1.2, ease: 'power2.inOut', overwrite: true })
        gsap.to(cinematic.target, { x: target.x, y: target.y, z: target.z, duration: 1.2, ease: 'power2.inOut', overwrite: true })
    }

    /** The station's own building when it has a screen (Profile: the lab), otherwise the shared workshop. */
    screenFor(station)
    {
        const area = this.game.world.areas[station.building]
        const surface = area?.references.items.get('images')?.[0]
        if(!surface) return this.workshop
        if(!this.screens.has(area))
        {
            this.screens.set(area, { area, surface, exhibit: new LegacyExhibit(area), ...this.header(area) })
            // Its title and brand planks repeat the workshop's captions (current room, team name)
            for(const name of [ 'title', 'url' ]) this.shareLabel(this.findText(name, area), this.findText(name))
        }
        return this.screens.get(area)
    }

    applySideFurniture()
    {
        this.surface.updateWorldMatrix(true, false)
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.surface.getWorldQuaternion(new THREE.Quaternion()))
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.surface.getWorldQuaternion(new THREE.Quaternion()))
        const center = this.surface.getWorldPosition(new THREE.Vector3())
        for(const { object, scale, position } of this.sideFurniture)
        {
            object.scale.copy(scale).multiplyScalar(0.40)
            // Bring the small signs in front of the frame posts instead of letting the posts hide their text.
            object.position.copy(position).addScaledVector(normal, 0.65)
            const side = Math.sign(position.clone().sub(center).dot(right))
            object.position.addScaledVector(right, -side * 0.07)
        }
    }

    /** Compact title and brand planks above the visited screen */
    applyHeader(screen)
    {
        const title = screen.titleText
        if(title) title.object.scale.copy(title.scale).multiplyScalar(0.50)
        for(const { name, object, scale, position } of screen.header ?? [])
        {
            object.scale.copy(scale)
            object.position.copy(position)
            if(name === 'title') object.scale.y *= 0.55
            object.position.y += name === 'title' ? 0.12 : 0.24
        }
        // Counter the board's vertical compression on its caption: letters stay proportional.
        // Blender exports this caption in XZ; local Z is the visible vertical axis.
        if(title) title.object.scale.z /= 0.55
        if(screen.brandBoard) screen.brandBoard.visible = true
    }

    restoreHeader(screen)
    {
        if(screen.brandBoard) screen.brandBoard.visible = false
        if(screen.titleText) screen.titleText.object.scale.copy(screen.titleText.scale)
        for(const { object, scale, position } of screen.header ?? [])
        {
            object.scale.copy(scale)
            object.position.copy(position)
        }
    }

    layout()
    {
        // Compact header furniture above leaves room for a taller content screen.
        this.size = displaySize(this.game.viewport.width)
        this.size = { ...this.size, height: this.size.height * 1.18 }
        const surface = this.screen.surface
        surface.geometry.computeBoundingBox()
        const {min, max} = surface.geometry.boundingBox
        const z = max.z + 0.015
        const top = max.y + (max.y - min.y) * 0.10
        const bottom = min.y - (max.y - min.y) * 0.08
        this.corners = [new THREE.Vector3(min.x, top, z), new THREE.Vector3(max.x, top, z),
            new THREE.Vector3(max.x, bottom, z), new THREE.Vector3(min.x, bottom, z)]
        this.ui.panelElement.style.width = `${this.size.width}px`
        this.ui.panelElement.style.height = `${this.size.height}px`
    }

    framing()
    {
        const surface = this.screen.surface
        surface.updateWorldMatrix(true, false)
        const center = surface.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(surface.matrixWorld)
        const quaternion = surface.getWorldQuaternion(new THREE.Quaternion())
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion)
        const aspect = this.game.viewport.width / this.game.viewport.height
        const tangent = Math.tan(THREE.MathUtils.degToRad(this.game.view.camera.fov / 2))
        const bounds = new THREE.Box3()
        for(const corner of this.corners ?? []) bounds.expandByPoint(corner.clone().applyMatrix4(surface.matrixWorld))
        for(const {object} of this.screen.header ?? []) bounds.union(new THREE.Box3().setFromObject(object))
        const height = bounds.isEmpty() ? 0 : bounds.max.y - bounds.min.y
        // The top navigation bar keeps its height: fit the board in the view below it
        const viewportHeight = this.game.viewport.height
        const reserve = this.reserve ?? 0
        const free = (viewportHeight - reserve) / viewportHeight
        const distance = Math.max(8.2, height / (2 * tangent * BOARD_FILL * free), 5.4 / (2 * tangent * aspect * BOARD_FILL))
        // Keep the camera square to the screen: a flat rectangle and unstretched text.
        const target = center.clone()
        if(!bounds.isEmpty()) target.y = (bounds.min.y + bounds.max.y) / 2
        // Raising camera and target together lowers the board by half the bar's height on screen
        target.y += reserve * distance * tangent / viewportHeight
        const position = target.clone().addScaledVector(normal, distance)
        return { position, target }
    }

    enterDirect(position, target)
    {
        const cinematic = this.game.view.cinematic
        gsap.killTweensOf(cinematic, 'progress')
        cinematic.progress = 1
        const start = position.clone().sub(target).multiplyScalar(1.12).add(target)
        cinematic.position.copy(start)
        this.dolly?.kill()
        this.dolly = gsap.to(cinematic.position, { x: position.x, y: position.y, z: position.z,
            duration: 0.85, ease: 'power2.out', overwrite: true })
    }

    syncContent()
    {
        if(!this.station || !this.ui.panel) return
        const panel = this.ui.panel.name
        const screen = this.screenFor({ building: BUILDING_DESTINATIONS[panel] })
        if(screen !== this.screen) this.moveTo(screen)
        const rooms = Object.keys(BUILDING_DESTINATIONS)
        const index = rooms.indexOf(panel)
        const previous = rooms[(index - 1 + rooms.length) % rooms.length]
        const next = rooms[(index + 1) % rooms.length]
        const previousRoom = this.ui.panelElement.querySelector('.js-exhibit-previous')
        const nextRoom = this.ui.panelElement.querySelector('.js-exhibit-next')
        if(previousRoom) previousRoom.textContent = t(`menu.${previous}`)
        if(nextRoom) nextRoom.textContent = t(`menu.${next}`)
        this.setLabel(this.findText('title'), this.ui.panelTitle.textContent)
        this.setLabel(this.findText('previous'), t(`menu.${previous}`))
        this.setLabel(this.findText('next'), t(`menu.${next}`))
        const attributes = this.area.references.items.get('attributes')?.[0]
        for(const [name, value] of Object.entries({ role: t(`menu.${panel}`), at: 'KerjayaKu', with: 'Team Chill Chill' }))
        {
            const group = attributes?.children.find(child => child.name === name)
            group?.traverse(child => { if(child.isMesh && /^text/.test(child.name)) this.setLabel(child, value) })
        }
        const exit = this.controls.querySelector('.building-exhibit-exit')
        exit.setAttribute('aria-label', t('common.close'))
        const zoom = this.controls.querySelector('.building-exhibit-zoom')
        zoom.setAttribute('aria-label', t('exhibit.zoomIn'))
        zoom.title = t('exhibit.zoomIn')
        for(const { button, data } of this.hotspots)
        {
            if(button.dataset.action === 'building-room')
            {
                const caption = t(`menu.${data.direction < 0 ? previous : next}`)
                button.setAttribute('aria-label', caption)
            }
            else if(button.dataset.action === 'building-dot')
            {
                const heading = this.ui.buildingHeadings?.[data.index]
                const career = this.ui.state?.careers[data.index]
                button.setAttribute('aria-label', heading?.textContent ?? (career ? pick(career.name) : String(data.index + 1)))
            }
            else button.setAttribute('aria-label', data.direction < 0 ? '←' : '→')
        }
    }

    reveal()
    {
        this.ui.root.classList.remove('is-building-entering')
        this.syncContent()
        this.update()
    }

    hide()
    {
        this.dolly?.kill()
        this.zoomAnimation?.cancel()
        this.zoomAnimation = null
        this.zoomed = false
        this.station = null
        this.screen.exhibit.restore()
        this.restoreHeader(this.screen)
        for(const { object, scale, position } of this.sideFurniture)
        {
            object.scale.copy(scale)
            object.position.copy(position)
        }
        this.screen.area.frustum.alwaysVisible = false
        const { ui } = this
        ui.root.classList.remove('is-building-view', 'is-building-entering', 'is-workshop-exhibit', 'is-fantasy-exhibit', 'is-plain-board')
        ui.panelElement.classList.remove('is-building-screen')
        this.reserve = 0
        for(const property of ['left', 'top', 'width', 'height', 'transform', '--exhibit-width']) ui.panelElement.style.removeProperty(property)
        this.game.domElement.classList.remove('is-building-visit')
        ui.fitBar()
    }

    project(point)
    {
        const p = point.project(this.game.view.camera)
        return {x: (p.x + 1) * this.game.viewport.width / 2, y: (1 - p.y) * this.game.viewport.height / 2}
    }

    update()
    {
        if(!this.station) return
        // The frame and live HTML share one viewport rectangle. The camera still visits the
        // workshop, but reading and hitting controls no longer depend on projected mesh bounds.
        if(this.ui.root.classList.contains('is-fantasy-exhibit'))
        {
            const bounds = exhibitLayout(this.game.viewport.width, this.game.viewport.height, this.reserve)
            Object.assign(this.ui.panelElement.style, {
                left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`,
                height: `${bounds.height}px`, transform: 'none',
            })
            this.ui.panelElement.style.setProperty('--exhibit-width', `${bounds.width}px`)
            return
        }
        else
        {
            const surface = this.screen.surface
            surface.updateWorldMatrix(true, false)
            const points = this.corners.map(corner => this.project(corner.clone().applyMatrix4(surface.matrixWorld)))
            const matrix = screenTransform(points, this.size.width, this.size.height)
            if(matrix) this.ui.panelElement.style.transform = `matrix3d(${matrix.join(',')})`
        }
        // World-space arrows still need live hit regions, including while the HTML board
        // uses viewport layout. Keep them aligned throughout camera movement and resizing.
        for(const { mesh, button } of this.hotspots ?? [])
        {
            // The side signs and arrows belong to the workshop: no hit regions while another building is shown
            button.hidden = this.screen !== this.workshop
            if(button.hidden) continue
            const bounds = new THREE.Box3().setFromObject(mesh)
            const corners = []
            for(const x of [bounds.min.x, bounds.max.x])
                for(const y of [bounds.min.y, bounds.max.y])
                    for(const z of [bounds.min.z, bounds.max.z]) corners.push(this.project(new THREE.Vector3(x, y, z)))
            const left = Math.min(...corners.map(p => p.x)), top = Math.min(...corners.map(p => p.y))
            const width = Math.max(24, Math.max(...corners.map(p => p.x)) - left)
            const height = Math.max(24, Math.max(...corners.map(p => p.y)) - top)
            Object.assign(button.style, {left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`})
        }
    }
}
