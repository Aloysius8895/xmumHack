import assert from 'node:assert/strict'
import test from 'node:test'
import { Events } from '../../../src/game/sources/Game/Events.js'
import { AreaPanelTransition } from '../../../src/game/sources/Game/World/Areas/AreaPanelTransition.js'

function setup()
{
    const calls = [], scheduled = []
    const filters = new Set([ 'wandering' ])
    const ui = {
        panel: null, events: new Events(), ownsInputs: false,
        takeInputs()
        {
            if(this.ownsInputs) return
            this.ownsInputs = true
            this.previous = [ ...filters ]
            filters.clear(); filters.add('career')
        },
        releaseInputs()
        {
            if(!this.ownsInputs || this.panel) return
            this.ownsInputs = false
            filters.clear(); this.previous.forEach(filter => filters.add(filter))
        },
        openPanel(name) { this.panel = { name }; this.takeInputs(); calls.push(name); this.events.trigger('panel', [ name ]) },
        closePanel() { this.panel = null; this.releaseInputs(); this.events.trigger('panel', [ null ]) },
    }
    const game = {
        career: { ui },
        inputs: { filters, interactiveButtons: { clearItems() {}, addItems() {}, removeItems() {} } },
        interactivePoints: {
            temporaryHidden: false,
            temporaryHide() { this.temporaryHidden = true },
            recover() { this.temporaryHidden = false; calls.push('recover') },
        },
        view: { cinematic: {
            active: false,
            start() { this.active = true; calls.push('camera-in') },
            end() { this.active = false; calls.push('camera-out') },
        } },
    }
    const transition = new AreaPanelTransition(game, {
        panel: 'market', position: {}, target: {},
        delay(seconds, callback)
        {
            const job = { seconds, callback, killed: false, kill() { this.killed = true } }
            scheduled.push(job)
            return job
        },
    })
    return { transition, game, ui, calls, scheduled, filters }
}

test('world interaction finishes the camera entrance before opening Trends', () =>
{
    const s = setup()
    s.transition.open()
    s.transition.open()
    assert.deepEqual(s.calls, [ 'camera-in' ])
    assert.equal(s.scheduled.length, 1)
    assert.equal(s.scheduled[0].seconds, 1.5)
    assert.deepEqual([ ...s.filters ], [ 'career' ])
    s.scheduled[0].callback()
    assert.equal(s.ui.panel.name, 'market')
    s.ui.closePanel()
    assert.deepEqual(s.calls, [ 'camera-in', 'market', 'camera-out', 'recover' ])
    assert.deepEqual([ ...s.filters ], [ 'wandering' ])
})

test('cancel during entrance prevents a delayed panel from reopening', () =>
{
    const s = setup()
    s.transition.open()
    s.transition.cancel()
    assert.equal(s.scheduled[0].killed, true)
    s.scheduled[0].callback()
    assert.equal(s.ui.panel, null)
    assert.equal(s.game.view.cinematic.active, false)
    assert.deepEqual([ ...s.filters ], [ 'wandering' ])
    s.transition.open()
    s.scheduled[1].callback()
    s.transition.cancel()
    assert.equal(s.ui.panel, null)
})

test('switching panels returns the camera without unlocking movement behind the new panel', () =>
{
    const s = setup()
    s.transition.open()
    s.scheduled[0].callback()
    s.ui.openPanel('careers')
    assert.equal(s.transition.active, false)
    assert.equal(s.ui.panel.name, 'careers')
    assert.deepEqual([ ...s.filters ], [ 'career' ])
    s.ui.closePanel()
    assert.deepEqual([ ...s.filters ], [ 'wandering' ])
})

test('a menu-opened panel or another cinematic is not hijacked', () =>
{
    const s = setup()
    s.ui.openPanel('market')
    s.transition.open()
    assert.equal(s.scheduled.length, 0)
    s.ui.closePanel()
    s.game.view.cinematic.active = true
    s.transition.open()
    assert.equal(s.scheduled.length, 0)
})
