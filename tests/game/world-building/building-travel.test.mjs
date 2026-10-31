import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BUILDING_DESTINATIONS, travelToBuilding, leaveAtBuilding } from '../../../src/game/sources/Career/BuildingTravel.js'

test('walking entrances still exist in the retained playable map asset', () =>
{
    const bytes = readFileSync(new URL('../../../src/game/static/respawns/respawnsReferences-compressed.glb', import.meta.url))
    const asset = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
    const retained = asset.nodes.filter(node =>
    {
        const [x, , z] = node.translation ?? []
        return x >= -18 && x <= 160 && z >= -52 && z <= 84
    }).map(node => node.name.replace(/^respawn/, '').replace(/^./, letter => letter.toLowerCase()))
    for(const building of Object.values(BUILDING_DESTINATIONS)) assert.ok(retained.includes(building))
})

test('the original workshop provides the display and all physical navigation furniture', () =>
{
    const bytes = readFileSync(new URL('../../../src/game/static/areas/areas-compressed.glb', import.meta.url))
    const asset = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
    const root = asset.nodes.find(node => node.name === 'projects')
    const nodes = []
    const visit = node => { nodes.push(node); (node.children ?? []).forEach(index => visit(asset.nodes[index])) }
    visit(root)
    for(const name of ['refImages', 'refTitle', 'refUrl', 'refPrevious', 'refNext', 'refAttributes',
        'refArrowPreviousProject', 'refArrowNextProject', 'refArrowPreviousImage', 'refArrowNextImage', 'refPagination'])
        assert.ok(nodes.some(node => node.name === name), `Missing exhibit furniture: ${name}`)
    const screen = nodes.find(node => node.name === 'refImages')
    const primitive = asset.meshes[screen.mesh].primitives[0]
    assert.ok(primitive.attributes.TEXCOORD_0 !== undefined)
    const bounds = asset.accessors[primitive.attributes.POSITION]
    assert.ok(Math.abs((bounds.max[0] - bounds.min[0]) / (bounds.max[1] - bounds.min[1]) - 16 / 9) < 1e-6)
})

function setup()
{
    const calls = []
    const stations = new Map(Object.keys(BUILDING_DESTINATIONS).map(panel => [panel, {panel}]))
    const visit = { active: false, open(station, options) { calls.push([station.panel, options]); return true } }
    const ui = {
        closeDialogue() {}, setMenuOpen() {},
        openPanel(panel) { calls.push(['content', panel]) },
    }
    const game = {
        career: { buildingEntrances: { stations, visit } },
        view: { cinematic: { active: false } }, modals: { close() {} },
        player: { respawn() { assert.fail('Menu must not teleport the player') } },
        physicalVehicle: { moveTo() { assert.fail('Menu must not move the player') } },
        overlay: { show() { assert.fail('Menu must not stop at the map') } },
    }
    return { game, ui, calls, visit }
}

test('every menu opens its exhibit immediately, without a map stop, Enter, or player movement', () =>
{
    const s = setup()
    for(const panel of Object.keys(BUILDING_DESTINATIONS))
    {
        assert.equal(travelToBuilding(s.game, s.ui, panel), true)
        assert.deepEqual(s.calls.at(-1), [panel, { direct: true }])
    }
})

test('switching rooms while viewing the exhibit changes content without restarting the camera', () =>
{
    const s = setup()
    s.visit.active = true
    s.game.view.cinematic.active = true
    assert.equal(travelToBuilding(s.game, s.ui, 'market'), true)
    assert.deepEqual(s.calls, [['content', 'market']])
})

test('unknown rooms, tours and unrelated cinematics are not hijacked', () =>
{
    const s = setup()
    assert.equal(travelToBuilding(s.game, s.ui, 'unknown'), false)
    s.ui.touring = true
    assert.equal(travelToBuilding(s.game, s.ui, 'careers'), false)
    s.ui.touring = false
    s.game.view.cinematic.active = true
    assert.equal(travelToBuilding(s.game, s.ui, 'careers'), false)
    assert.deepEqual(s.calls, [])
})

test('exit places the character at the selected category, without reloading or resetting the game', () =>
{
    let destination, moves = 0
    const game = {
        career: { buildingEntrances: { stations: new Map([
            ['careers', {building: 'career', position: {x: 26, z: 9}}],
            ['market', {building: 'projects', position: {x: 37, z: 14}}],
        ]) }, world: {pet: {placed: true}} },
        respawns: {items: new Map([['career', {position: {y: 4}}], ['projects', {position: {y: 4}}]])},
        physicalVehicle: {moveTo(position) { destination = position; moves++ }},
        player: {state: 0}, view: {focusPoint: {position: {x: 0, y: 0, z: 0}}},
        reset() { assert.fail('Exit must not reset the game') },
    }
    assert.equal(leaveAtBuilding(game, 'careers'), true)
    assert.deepEqual(destination, {x: 27, y: 4, z: 10})
    assert.equal(leaveAtBuilding(game, 'market'), true)
    assert.deepEqual(destination, {x: 38, y: 4, z: 15})
    assert.equal(game.view.focusPoint.position.x, 38)
    assert.equal(game.player.state, 1)
    assert.equal(game.career.world.pet.placed, false)
    assert.equal(leaveAtBuilding(game, 'unknown'), false)
    assert.equal(moves, 2)
})
