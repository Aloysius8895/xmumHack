import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from '../../../src/game/node_modules/three/build/three.webgpu.js'
import { exhibitLayout } from '../../../src/game/sources/Career/ExhibitLayout.js'
import { BuildingScreen } from '../../../src/game/sources/Career/BuildingScreen.js'

function classList()
{
    const names = new Set()
    return { names, add: (...items) => items.forEach(item => names.add(item)), remove: (...items) => items.forEach(item => names.delete(item)),
        contains: name => names.has(name), toggle: (name, on) => on ? names.add(name) : names.delete(name) }
}

/** A board-sized screen facing +Z at the origin, a camera and the UI parts the stage touches */
function stage(width = 1600, height = 900)
{
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.25))
    surface.geometry.computeBoundingBox()
    const exhibit = { hidden: 0, restored: 0, hide() { this.hidden++ }, restore() { this.restored++ } }
    const screen = { area: { frustum: { alwaysVisible: false, test() {} } }, surface, exhibit }
    const camera = new THREE.PerspectiveCamera(25, width / height, 0.1, 200)
    const style = { setProperty(key, value) { this[key] = value }, removeProperty(key) { delete this[key] } }
    const screenStage = Object.assign(Object.create(BuildingScreen.prototype), {
        game: { viewport: { width, height }, view: { camera }, domElement: { classList: classList() } },
        ui: { root: { classList: classList() }, panelElement: { style, classList: classList() }, fitBar() {} },
        surface, screen, workshop: screen, sideFurniture: [], hotspots: [], reserve: 0,
    })
    const aim = () =>
    {
        const { position, target } = screenStage.framing()
        camera.position.copy(position)
        camera.lookAt(target)
        camera.updateMatrixWorld(true)
    }
    return { screenStage, screen, exhibit, style, camera, aim }
}

test('the enlarged panel stays below the top bar and inside the viewport', () =>
{
    for(const [width, height] of [[1920, 1080], [1366, 768], [390, 844]])
    {
        const board = exhibitLayout(width, height, 96)
        assert.ok(board.top >= 96, `panel under the bar at ${width}x${height}`)
        assert.ok(board.top + board.height <= height)
        assert.ok(board.left >= 0 && board.left + board.width <= width)
    }
    assert.deepEqual(exhibitLayout(1600, 758, 0), exhibitLayout(1600, 758), 'no bar: unchanged layout')
})

test('board mode projects the panel onto the screen; enlarging centers it and hides the old board meshes', () =>
{
    const { screenStage, exhibit, style, aim } = stage()
    screenStage.station = {}
    screenStage.layout()
    aim()
    screenStage.setZoomed(false, { animate: false })
    assert.equal(screenStage.zoomed, false)
    assert.equal(screenStage.ui.root.classList.contains('is-fantasy-exhibit'), false)
    assert.match(style.transform, /^matrix3d\(/)
    assert.equal(exhibit.hidden, 0, 'the board stays visible behind the projected panel')

    screenStage.reserve = 90
    screenStage.setZoomed(true, { animate: false })
    assert.equal(screenStage.ui.root.classList.contains('is-fantasy-exhibit'), true)
    assert.equal(style.transform, 'none')
    assert.ok(parseFloat(style.top) >= 90, 'enlarged panel starts below the bar')
    assert.equal(exhibit.hidden, 1)

    screenStage.setZoomed(false, { animate: false })
    assert.equal(screenStage.ui.root.classList.contains('is-fantasy-exhibit'), false)
    assert.equal(style.top, undefined, 'board mode drops the centered position')
    assert.match(style.transform, /^matrix3d\(/)
    assert.equal(exhibit.restored, 2)
})

test('the camera keeps the board clear of the top bar', () =>
{
    const height = 900, reserve = 110
    const { screenStage, screen, camera, aim } = stage(1600, height)
    screenStage.layout()
    screenStage.reserve = reserve
    aim()
    const top = Math.min(...screenStage.corners.map(corner => (1 - corner.clone().applyMatrix4(screen.surface.matrixWorld).project(camera).y) * height / 2))
    assert.ok(top >= reserve, `board top ${top} under the bar (${reserve})`)
})

test('a visit starts on the board on wide screens, enlarged on phones, and leaving resets it', () =>
{
    for(const [width, zoomed] of [[1600, false], [390, true]])
    {
        const { screenStage } = stage(width, 844)
        screenStage.screenFor = () => screenStage.workshop
        screenStage.applySideFurniture = () => {}
        screenStage.show({ panel: 'careers', building: 'career' })
        assert.equal(screenStage.zoomed, zoomed, `${width}px`)
        assert.equal(screenStage.ui.root.classList.contains('is-fantasy-exhibit'), zoomed)
        screenStage.setZoomed(!zoomed, { animate: false })
        screenStage.hide()
        assert.equal(screenStage.zoomed, false)
        assert.equal(screenStage.ui.root.classList.contains('is-fantasy-exhibit'), false)
    }
})

test('changing rooms keeps the mode and moves to the screen of the new room', () =>
{
    const { screenStage, screen } = stage()
    const flights = []
    screenStage.fly = framing => flights.push(framing)
    screenStage.station = {}
    screenStage.layout()
    screenStage.setZoomed(true, { animate: false })
    const lab = stage().screen
    screenStage.moveTo(lab)
    assert.equal(screenStage.zoomed, true)
    assert.equal(screenStage.screen, lab)
    assert.equal(screen.exhibit.restored, 1, 'the workshop board comes back')
    assert.equal(lab.exhibit.hidden, 1, 'the new board stays hidden behind the enlarged panel')
    assert.equal(screen.area.frustum.alwaysVisible, false)
    assert.equal(lab.area.frustum.alwaysVisible, true)
    assert.equal(flights.length, 1, 'the camera flies to the new screen')
    assert.equal(screenStage.ui.root.classList.contains('is-plain-board'), true, 'no wooden side signs: the panel shows its own previous/next buttons')
    screenStage.moveTo(screen)
    assert.equal(screenStage.ui.root.classList.contains('is-plain-board'), false)
})
