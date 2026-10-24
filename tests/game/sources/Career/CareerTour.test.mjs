import assert from 'node:assert/strict'
import test from 'node:test'
import { CareerTour } from '../../../../src/game/sources/Career/CareerTour.js'

function fixture(seen = null)
{
    let starts = 0
    const tour = Object.assign(Object.create(CareerTour.prototype), {
        api: { state: null }, ui: { game: { reveal: { step: 0 } } },
        active: false, autoStartHandled: false,
        start() { starts++; this.active = true },
    })
    globalThis.localStorage = { getItem: () => seen }
    return { tour, starts: () => starts }
}

test.afterEach(() => { delete globalThis.localStorage })

test('first visit starts after character reveal when the API loaded first', () =>
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

test('slow API loading starts the first tour after the world has already appeared', () =>
{
    const { tour, starts } = fixture()
    tour.ui.game.reveal.step = 2
    tour.maybeStart()
    assert.equal(starts(), 0)
    tour.api.state = {}
    tour.maybeStart()
    assert.equal(starts(), 1)
})

test('completed or skipped tours do not automatically repeat for returning visitors', () =>
{
    const { tour, starts } = fixture('1')
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

test('unavailable browser storage still allows one beginner tour per visit', () =>
{
    const { tour, starts } = fixture()
    globalThis.localStorage.getItem = () => { throw new Error('Storage disabled') }
    tour.ui.game.reveal.step = 2
    tour.api.state = {}
    tour.maybeStart()
    tour.active = false
    tour.maybeStart()
    assert.equal(starts(), 1)
})
