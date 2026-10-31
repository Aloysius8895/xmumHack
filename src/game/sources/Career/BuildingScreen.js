import * as THREE from 'three/webgpu'
import { texture } from 'three/tsl'
import gsap from 'gsap'
import { pick, t } from './i18n.js'
import { BUILDING_DESTINATIONS } from './BuildingTravel.js'
import { displaySize, screenTransform, signAspect } from './ScreenProjection.js'

/** The original workshop exhibit: real wooden frame/signs, with the original interactive
 * career content projected onto its screen. No player teleport or replacement floating panel.
 */
export class BuildingScreen
{
    constructor(game, ui)
    {
        Object.assign(this, { game, ui })
        this.area = game.world.areas.projects
        this.surface = this.area.references.items.get('images')[0]
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
        this.controls.innerHTML = '<button type="button" class="building-exhibit-exit" data-action="close">Esc <span>×</span></button>'
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
        const titleText = this.findText('title')
        this.titleFurniture = titleText && { object: titleText, scale: titleText.scale.clone() }
        this.headerFurniture = ['title', 'url'].map(name => {
            const object = this.area.references.items.get(name)?.[0]
            return object && { name, object, scale: object.scale.clone(), position: object.position.clone() }
        }).filter(Boolean)
        const brandRow = this.area.references.items.get('url')?.[0]
        if(brandRow)
        {
            this.brandBoard = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.30),
                new THREE.MeshBasicNodeMaterial({ color: '#35204f', side: THREE.DoubleSide }))
            this.brandBoard.position.z = 0.02
            this.brandBoard.visible = false
            brandRow.add(this.brandBoard)
        }
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
            this.layout()
            const framing = this.framing()
            game.view.cinematic.position.copy(framing.position)
            game.view.cinematic.target.copy(framing.target)
        })
    }

    findText(name)
    {
        let mesh = null
        this.area.references.items.get(name)?.[0]?.traverse(child =>
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
            mesh.geometry = mesh.geometry.clone()
            const uv = mesh.geometry.attributes.uv
            for(let i = 0; i < uv.count; i++)
                uv.setXY(i, uv.getX(i), (row * 192 + 4 + uv.getY(i) * 184) / 2048)
            uv.needsUpdate = true
            mesh.material = this.signMaterial
            this.labels.set(mesh, label)
        }
        if(label.text === text) return
        label.text = text
        const context = this.atlasContext, y = label.row * 192
        context.save()
        context.fillStyle = '#000'
        context.fillRect(0, y, 2048, 192)
        const virtualWidth = label.ratio * 184
        context.translate(0, y + 4)
        context.scale(2048 / virtualWidth, 1)
        context.font = '600 118px Arial, "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif'
        const measured = context.measureText(text).width
        const fontSize = 118 * Math.min(1, virtualWidth * 0.92 / Math.max(measured, 1))
        context.font = `600 ${fontSize}px Arial, "Noto Sans SC", "Microsoft YaHei", "PingFang SC", sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillStyle = '#fff'
        context.fillText(text, virtualWidth / 2, 92)
        context.restore()
        this.atlasTexture.needsUpdate = true
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
        this.area.frustum.alwaysVisible = true
        this.area.frustum.test()
        this.applySideFurniture()
        this.surface.visible = true
        this.layout()
        const { game, ui } = this
        ui.root.classList.add('is-building-view', 'is-building-entering', 'is-workshop-exhibit')
        ui.panelElement.classList.add('is-building-screen')
        game.domElement.classList.add('is-building-visit')
        return this.framing()
    }

    applySideFurniture()
    {
        this.surface.updateWorldMatrix(true, false)
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(this.surface.getWorldQuaternion(new THREE.Quaternion()))
        for(const { object, scale, position } of this.sideFurniture)
        {
            object.scale.copy(scale).multiplyScalar(0.30)
            // Bring the small signs in front of the frame posts instead of letting the posts hide their text.
            object.position.copy(position).addScaledVector(normal, 0.65)
        }
        if(this.titleFurniture) this.titleFurniture.object.scale.copy(this.titleFurniture.scale).multiplyScalar(0.50)
        for(const { name, object, scale, position } of this.headerFurniture ?? [])
        {
            object.scale.copy(scale)
            object.position.copy(position)
            if(name === 'title') object.scale.y *= 0.55
            object.position.y += name === 'title' ? 0.12 : 0.24
        }
        // Counter the board's vertical compression on its caption: letters stay proportional.
        // Blender exports this caption in XZ; local Z is the visible vertical axis.
        if(this.titleFurniture) this.titleFurniture.object.scale.z /= 0.55
        if(this.brandBoard) this.brandBoard.visible = true
    }

    layout()
    {
        // Compact header furniture above leaves room for a taller content screen.
        this.size = displaySize(this.game.viewport.width)
        this.size = { ...this.size, height: this.size.height * 1.18 }
        this.surface.geometry.computeBoundingBox()
        const {min, max} = this.surface.geometry.boundingBox
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
        this.surface.updateWorldMatrix(true, false)
        const center = this.surface.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(this.surface.matrixWorld)
        const quaternion = this.surface.getWorldQuaternion(new THREE.Quaternion())
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion)
        const aspect = this.game.viewport.width / this.game.viewport.height
        const tangent = Math.tan(THREE.MathUtils.degToRad(this.game.view.camera.fov / 2))
        const bounds = new THREE.Box3()
        for(const corner of this.corners ?? []) bounds.expandByPoint(corner.clone().applyMatrix4(this.surface.matrixWorld))
        for(const {object} of this.headerFurniture ?? []) bounds.union(new THREE.Box3().setFromObject(object))
        const height = bounds.isEmpty() ? 0 : bounds.max.y - bounds.min.y
        const distance = Math.max(8.2, height / (2 * tangent * 0.94), 5.4 / (2 * tangent * aspect * 0.94))
        // Keep the camera square to the screen: a flat rectangle and unstretched text.
        const target = center.clone()
        if(!bounds.isEmpty()) target.y = (bounds.min.y + bounds.max.y) / 2
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
        const rooms = Object.keys(BUILDING_DESTINATIONS)
        const index = rooms.indexOf(panel)
        const previous = rooms[(index - 1 + rooms.length) % rooms.length]
        const next = rooms[(index + 1) % rooms.length]
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
        if(this.brandBoard) this.brandBoard.visible = false
        this.station = null
        for(const { object, scale, position } of this.sideFurniture)
        {
            object.scale.copy(scale)
            object.position.copy(position)
        }
        if(this.titleFurniture) this.titleFurniture.object.scale.copy(this.titleFurniture.scale)
        for(const { object, scale, position } of this.headerFurniture ?? [])
        {
            object.scale.copy(scale)
            object.position.copy(position)
        }
        this.area.frustum.alwaysVisible = false
        const { ui } = this
        ui.root.classList.remove('is-building-view', 'is-building-entering', 'is-workshop-exhibit')
        ui.panelElement.classList.remove('is-building-screen')
        for(const property of ['left', 'top', 'width', 'height', 'transform']) ui.panelElement.style.removeProperty(property)
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
        this.surface.updateWorldMatrix(true, false)
        const points = this.corners.map(corner => this.project(corner.clone().applyMatrix4(this.surface.matrixWorld)))
        const matrix = screenTransform(points, this.size.width, this.size.height)
        if(matrix) this.ui.panelElement.style.transform = `matrix3d(${matrix.join(',')})`
        for(const { mesh, button } of this.hotspots)
        {
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
