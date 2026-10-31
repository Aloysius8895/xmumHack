import test from 'node:test'
import assert from 'node:assert/strict'
import { exhibitLayout } from '../../../src/game/sources/Career/ExhibitLayout.js'
import { BuildingScreen } from '../../../src/game/sources/Career/BuildingScreen.js'
import * as THREE from '../../../src/game/node_modules/three/build/three.webgpu.js'

test('the illustrated board fits desktop, laptop and portrait viewports without scaling live text', () =>
{
    for(const [width, height] of [[1920, 1080], [1600, 758], [1366, 768], [900, 593], [390, 844], [320, 568]])
    {
        const board = exhibitLayout(width, height)
        assert.ok(board.left >= 0 && board.top >= 0)
        assert.ok(board.left + board.width <= width)
        assert.ok(board.top + board.height <= height)
        if(!board.compact) assert.equal(board.width / board.height, 1.5)
        else assert.ok(board.height > 500, 'portrait view keeps a tall scrollable reading surface')
    }
})

test('original left and right arrow hit regions follow the camera with the fantasy frame active', () =>
{
    const camera = new THREE.PerspectiveCamera(45, 1600 / 758, 0.1, 100)
    camera.position.z = 8
    camera.updateMatrixWorld(true)
    const hotspots = [-2, 2].map((x, index) =>
    {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1))
        mesh.position.x = x
        return { mesh, button: { dataset: { action: 'building-room', direction: index ? 1 : -1 }, style: {} } }
    })
    const stage = { station: {}, hotspots, game: { viewport: { width: 1600, height: 758 }, view: { camera } },
        ui: { root: { classList: { contains: () => true } }, panelElement: { style: { setProperty() {} } } },
        project: BuildingScreen.prototype.project }
    BuildingScreen.prototype.update.call(stage)
    const positions = hotspots.map(({ button }) => parseFloat(button.style.left))
    assert.ok(positions[0] < 800 && positions[1] > 800)
    assert.ok(hotspots.every(({ button }) => parseFloat(button.style.width) >= 24 && parseFloat(button.style.height) >= 24))
    camera.position.x = 1
    camera.updateMatrixWorld(true)
    BuildingScreen.prototype.update.call(stage)
    assert.ok(hotspots.every(({ button }, index) => parseFloat(button.style.left) < positions[index]))
    assert.equal(stage.ui.panelElement.style.transform, 'none', 'moving the world arrows does not transform the HTML content')
})

test('live fantasy screen follows viewport resize without projecting or scaling form controls', () =>
{
    const style = { setProperty(key, value) { this[key] = value } }
    const stage = { station: {}, game: { viewport: { width: 1600, height: 758 } },
        ui: { root: { classList: { contains: name => name === 'is-fantasy-exhibit' } }, panelElement: { style } } }
    BuildingScreen.prototype.update.call(stage)
    assert.equal(style.transform, 'none')
    assert.equal(style.width, '1107px')
    stage.game.viewport = { width: 390, height: 844 }
    BuildingScreen.prototype.update.call(stage)
    assert.equal(style.width, '382px')
    assert.equal(style.height, '832px')
    assert.equal(style['--exhibit-width'], '382px')
})
