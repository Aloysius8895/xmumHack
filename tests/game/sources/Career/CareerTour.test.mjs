import assert from 'node:assert/strict'
import test from 'node:test'
import { CareerTour } from '../../../../src/game/sources/Career/CareerTour.js'
import { travelToBuilding } from '../../../../src/game/sources/Career/BuildingTravel.js'
import { BuildingVisit } from '../../../../src/game/sources/Career/BuildingVisit.js'
import { Events } from '../../../../src/game/sources/Game/Events.js'

test('clicking Profile during the tour opens the real exhibit and advances past the waiting step', () =>
{
    const api = {state: {}, events: new Events()}
    const ui = {touring: true, events: new Events(),
        closeDialogue() {}, setMenuOpen() {}, takeInputs() {},
        openPanel(name) { this.panel = {name}; this.events.trigger('panel', [name]) }}
    const game = {
        inputs: {interactiveButtons: {clearItems() {}, addItems() {}}},
        interactivePoints: {temporaryHidden: true}, modals: {close() {}},
        view: {cinematic: {active: false, start() {this.active = true}}},
    }
    let displayed = false
    const stage = {show() {return {position: {}, target: {}}}, enterDirect() {}, reveal() {displayed = true}}
    const visit = new BuildingVisit(game, ui, stage, () => assert.fail('Tour must open without a delay'))
    game.career = {buildingEntrances: {stations: new Map([['profile', {panel: 'profile'}]]), visit}}
    class HeadlessTour extends CareerTour {
        setElement() {}
        go(index) { this.index = index }
    }
    const tour = new HeadlessTour(api, ui)
    Object.assign(tour, {active: true, waiting: true, index: 1, step: tour.steps[1]})
    ui.root = {dataset: {tourTarget: 'profile'}}
    assert.equal(travelToBuilding(game, ui, 'profile'), true)
    assert.equal(displayed, true)
    assert.equal(visit.active, true)
    assert.equal(ui.panel.name, 'profile')
    assert.equal(tour.index, 2)
    assert.equal(tour.waiting, false)
    assert.equal(ui.root.dataset.tourTarget, undefined)
    const logButton = {}
    ui.root.querySelectorAll = selector => selector.includes('data-panel="log"') ? [logButton] : []
    tour.panel = 'roadmap'
    assert.deepEqual(tour.steps[10].focus(), [logButton], 'the log step targets the menu without leaving the exhibit first')
})

test('desktop exhibit reserves room for Wisp and scrolls the focused action above its speech box', () =>
{
    const keys = ['innerWidth', 'innerHeight', 'requestAnimationFrame']
    const saved = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
    Object.assign(globalThis, {innerWidth: 1920, innerHeight: 900, requestAnimationFrame() {}})
    try
    {
        const classes = {add() {}, remove() {}, contains: name => name === 'is-building-view'}
        const button = {offsetParent: {}, classList: classes, scrollIntoView() {},
            getBoundingClientRect: () => ({left: 600, top: 700, right: 800, bottom: 750, width: 200, height: 50})}
        const panelBody = {style: {}, scrollTop: 0}
        const tour = Object.assign(Object.create(CareerTour.prototype), {
            active: true, waiting: true, step: {focus: () => [button]}, originalPanelPadding: '',
            ui: {root: {classList: classes}, panelBody, panelElement: {contains: () => true}},
            element: {offsetWidth: 600, offsetHeight: 180, style: {}, classList: classes},
            pointer: {style: {}, classList: classes}, spot: {style: {}, classList: classes},
        })
        tour.update()
        assert.ok(parseFloat(panelBody.style.paddingBottom) >= 180)
        assert.ok(panelBody.scrollTop > 0)
        assert.ok(parseFloat(tour.element.style.top) >= 700)
    }
    finally
    {
        keys.forEach((key, index) => saved[index] ? Object.defineProperty(globalThis, key, saved[index]) : delete globalThis[key])
    }
})

// newUser: what the intro username step (CharacterSelect.signIn) got from POST /api/register
function fixture(newUser = true)
{
    let starts = 0
    const tour = Object.assign(Object.create(CareerTour.prototype), {
        api: { state: null }, ui: { game: { reveal: { step: 0 } } },
        active: false, autoStartHandled: false, newUser,
        start() { starts++; this.active = true },
    })
    return { tour, starts: () => starts }
}

test('a new user starts the tour after the character reveal when the API loaded first', () =>
{
    const { tour, starts } = fixture()
    tour.api.state = {}
    tour.maybeStart()
    assert.equal(starts(), 0)
    tour.ui.game.reveal.step = 1
    tour.maybeStart()
    assert.equal(starts(), 0)
    tour.ui.game.reveal.step = 2
    tour.maybeStart()
    assert.equal(starts(), 1)
})

test('slow API loading starts the tour of a new user after the world has already appeared', () =>
{
    const { tour, starts } = fixture()
    tour.ui.game.reveal.step = 2
    tour.maybeStart()
    assert.equal(starts(), 0)
    tour.api.state = {}
    tour.maybeStart()
    assert.equal(starts(), 1)
})

test('a returning username does not get the tour automatically, whatever character is picked', () =>
{
    const { tour, starts } = fixture(false)
    tour.ui.game.reveal.step = 2
    tour.api.state = {}
    tour.maybeStart()
    assert.equal(starts(), 0)
})

test('live state updates do not restart a tour that finished in this visit', () =>
{
    const { tour, starts } = fixture()
    tour.ui.game.reveal.step = 2
    tour.api.state = {}
    tour.maybeStart()
    tour.active = false
    tour.maybeStart()
    assert.equal(starts(), 1)
})
