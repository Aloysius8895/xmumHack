import test from 'node:test'
import assert from 'node:assert/strict'
import { Events } from '../../../src/game/sources/Game/Events.js'
import { BuildingVisit } from '../../../src/game/sources/Career/BuildingVisit.js'
import { displaySize, screenTransform, signAspect } from '../../../src/game/sources/Career/ScreenProjection.js'

function setup()
{
    const calls = [], jobs = [], filters = new Set(['wandering'])
    const ui = {
        events: new Events(), panel: null,
        setMenuOpen() {},
        takeInputs() { filters.clear(); filters.add('career') },
        releaseInputs() { if(!this.panel) { filters.clear(); filters.add('wandering') } },
        openPanel(name) { this.panel = { name }; calls.push(name); this.events.trigger('panel', [name]) },
        closePanel() { this.panel = null; this.events.trigger('panel', [null]) },
    }
    const game = {
        inputs: { interactiveButtons: { clearItems() {}, addItems() {}, removeItems() {} } },
        interactivePoints: { temporaryHidden: false, temporaryHide() { this.temporaryHidden = true }, recover() { this.temporaryHidden = false } },
        view: { cinematic: {
            active: false, nonIdealRatioOffset: 10,
            start() { this.active = true; calls.push('zoom') },
            end() { this.active = false; calls.push('return') },
        } },
    }
    const stage = { show() { return { position: {}, target: {} } }, enterDirect() { calls.push('direct') }, reveal() { calls.push('display') }, hide() { calls.push('hide') } }
    const visit = new BuildingVisit(game, ui, stage, (seconds, callback) =>
    {
        const job = { seconds, callback, kill() { this.killed = true } }
        jobs.push(job); return job
    })
    return { visit, game, ui, jobs, calls, filters }
}

test('building camera arrives before the interactive screen opens; internal categories keep it open', () =>
{
    const s = setup()
    assert.equal(s.visit.open({ panel: 'careers' }), true)
    assert.equal(s.visit.open({ panel: 'market' }), false)
    assert.equal(s.ui.panel, null)
    assert.deepEqual([...s.filters], ['career'])
    s.jobs[0].callback()
    assert.deepEqual(s.calls, ['zoom', 'careers', 'display'])
    s.ui.openPanel('roadmap')
    assert.equal(s.visit.active, true)
    s.ui.closePanel()
    assert.equal(s.visit.active, false)
    assert.equal(s.game.view.cinematic.nonIdealRatioOffset, 10)
    assert.deepEqual([...s.filters], ['wandering'])
    assert.equal(s.game.interactivePoints.temporaryHidden, false)
})

test('Escape during zoom cancels pending content; re-entry opens the newly chosen room', () =>
{
    const s = setup()
    s.visit.open({ panel: 'careers' })
    s.visit.cancel()
    s.visit.cancel()
    assert.equal(s.jobs[0].killed, true)
    s.jobs[0].callback()
    assert.equal(s.ui.panel, null)
    s.visit.open({ panel: 'market' })
    s.jobs[0].callback()
    assert.equal(s.ui.panel, null)
    s.jobs[1].callback()
    assert.equal(s.ui.panel.name, 'market')
    s.visit.cancel()
    assert.equal(s.calls.filter(call => call === 'return').length, 2)
})

test('direct menu entry opens content in the same action, with no delayed Enter step', () =>
{
    const s = setup()
    assert.equal(s.visit.open({panel: 'careers'}, {direct: true}), true)
    assert.equal(s.ui.panel.name, 'careers')
    assert.equal(s.jobs.length, 0)
    assert.deepEqual(s.calls, ['zoom', 'direct', 'careers', 'display'])
    s.visit.cancel()
    assert.equal(s.visit.active, false)
    assert.deepEqual([...s.filters], ['wandering'])
})

test('Escape after a category switch uses that category entrance rather than the original start', () =>
{
    const s = setup()
    let destination
    s.game.career = {buildingEntrances: {stations: new Map([
        ['market', {building: 'projects', position: {x: 37, z: 14}}],
    ])}}
    s.game.respawns = {items: new Map([['projects', {position: {y: 4}}]])}
    s.game.physicalVehicle = {moveTo(position) { destination = position }}
    s.game.player = {}
    s.game.view.focusPoint = {}
    s.visit.open({panel: 'careers'}, {direct: true})
    s.ui.openPanel('market')
    s.visit.cancel()
    assert.deepEqual(destination, {x: 38, y: 4, z: 15})
})

test('XZ and XY sign planes keep the same letter proportions', () =>
{
    assert.equal(signAspect({x: 4, y: 0.6, z: 0}), 4 / 0.6)
    assert.equal(signAspect({x: 4, y: 0.000001, z: 0.6}), 4 / 0.6)
    assert.equal(signAspect({x: 0.68, y: 0.8, z: 0}), 0.68 / 0.8)
})

test('projection fits all four screen corners on desktop, perspective and portrait layouts', () =>
{
    for(const points of [
        [{x: 40, y: 80}, {x: 940, y: 80}, {x: 940, y: 680}, {x: 40, y: 680}],
        [{x: 80, y: 90}, {x: 950, y: 40}, {x: 880, y: 710}, {x: 120, y: 650}],
        [{x: 25, y: 110}, {x: 370, y: 115}, {x: 375, y: 650}, {x: 20, y: 660}],
    ])
    {
        const m = screenTransform(points, 1100, 740)
        ;[[0, 0], [1100, 0], [1100, 740], [0, 740]].forEach(([x, y], i) =>
        {
            const divisor = m[3] * x + m[7] * y + 1
            assert.ok(Math.abs((m[0] * x + m[4] * y + m[12]) / divisor - points[i].x) < 1e-6)
            assert.ok(Math.abs((m[1] * x + m[5] * y + m[13]) / divisor - points[i].y) < 1e-6)
        })
    }
    assert.equal(screenTransform([{x: NaN, y: 0}], 1, 1), null)
    for(const viewportWidth of [390, 720, 1920])
    {
        const size = displaySize(viewportWidth)
        assert.equal(size.width / size.height, 16 / 9)
    }
})
