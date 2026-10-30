import assert from 'node:assert/strict'
import test from 'node:test'
import { CareerTour } from '../../../../src/game/sources/Career/CareerTour.js'

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
