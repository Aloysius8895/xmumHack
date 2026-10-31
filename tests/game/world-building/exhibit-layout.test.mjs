import test from 'node:test'
import assert from 'node:assert/strict'
import { exhibitLayout } from '../../../src/game/sources/Career/ExhibitLayout.js'
import { BuildingScreen } from '../../../src/game/sources/Career/BuildingScreen.js'
import { LegacyExhibit } from '../../../src/game/sources/Career/LegacyExhibit.js'

test('the centered panel leaves room for desktop arrows and fits portrait viewports', () =>
{
    for(const [width, height] of [[1920, 1080], [1600, 758], [1366, 768], [900, 593], [390, 844], [320, 568]])
    {
        const board = exhibitLayout(width, height)
        assert.ok(board.left >= 0 && board.top >= 0)
        assert.ok(board.left + board.width <= width)
        assert.ok(board.top + board.height <= height)
        if(!board.compact) { assert.ok(board.left >= 80, 'side arrows fit inside the viewport'); assert.ok(board.height <= height * 0.87, 'show the game background above and below'); }
        else assert.ok(board.height > 500, 'portrait view keeps a tall scrollable reading surface')
    }
})

test('retired board and side signs are hidden without hiding the workshop or surrounding world', () =>
{
    const frame = { name: 'Cube.065', visible: true }
    const oven = { name: 'refOven', visible: true }
    const screen = { visible: true }, previous = { visible: true }, next = { visible: false }
    const exhibit = new LegacyExhibit({ objects: { items: [frame, oven].map(object3D => ({ visual: { object3D } })) },
        references: { items: new Map([['images', [screen]], ['previous', [previous]], ['next', [next]]]) } })
    exhibit.hide()
    assert.ok([frame, screen, previous, next].every(part => part.visible === false))
    assert.equal(oven.visible, true)
    frame.visible = true // A scene visibility pass must not bring the retired board back while viewing.
    exhibit.hide()
    assert.equal(frame.visible, false)
    exhibit.restore()
    assert.equal(frame.visible, true)
    assert.equal(previous.visible, true)
    assert.equal(next.visible, false, 'restore preserves a previously hidden part')
    assert.equal(oven.visible, true)
})

test('live fantasy screen follows viewport resize without projecting or scaling form controls', () =>
{
    const style = { setProperty(key, value) { this[key] = value } }
    const stage = { station: {}, game: { viewport: { width: 1600, height: 758 } },
        ui: { root: { classList: { contains: name => name === 'is-fantasy-exhibit' } }, panelElement: { style } } }
    BuildingScreen.prototype.update.call(stage)
    assert.equal(style.transform, 'none')
    assert.equal(style.width, '1312px')
    stage.game.viewport = { width: 390, height: 844 }
    BuildingScreen.prototype.update.call(stage)
    assert.equal(style.width, '366px')
    assert.equal(style.height, '776px')
    assert.equal(style['--exhibit-width'], '366px')
})
