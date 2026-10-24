import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

// Isolated save directory and demo AI, before the server modules read them
process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'career-map-'))
process.env.AI_MOCK = '1'

const { handle } = await import('../../../src/game/server/app.js')
const store = await import('../../../src/game/server/store.js')
const game = await import('../../../src/game/server/game.js')
const { DEFAULT_MAP, SKILLS, getCareer, useCustom } = await import('../../../src/game/server/careers.js')
const { SKILL_DETAILS } = await import('../../../src/game/server/skill-details.js')

async function call(route, body = {})
{
    const request = Readable.from([ Buffer.from(JSON.stringify(body)) ])
    Object.assign(request, { method: 'POST', url: route, headers: {} })
    let payload = ''
    const response = { statusCode: 0, setHeader() {}, end(text) { payload = text } }
    await handle(request, response)
    return { status: response.statusCode, body: JSON.parse(payload) }
}

test('a career off the map needs the swap confirmed, then takes the spot of the lowest affinity mentor', async () =>
{
    store.reset()
    assert.equal((await call('/api/target', { careerId: 'auditor', mode: 'general' })).body.error, 'not-on-map')

    // SQL in the profile: data analyst, product manager and ML engineer get some affinity, the first spot at 0 goes
    await call('/api/profile/skills', { skills: [ { id: 'sql', name: 'SQL', level: 3 } ] })
    await call('/api/target', { careerId: 'data-analyst', mode: 'general' })

    const result = await call('/api/target', { careerId: 'auditor', mode: 'general', replace: true })
    assert.equal(result.status, 200)
    assert.equal(result.body.replaced, 'frontend-developer')
    const state = result.body.state
    assert.deepEqual(state.map.slots, DEFAULT_MAP.map((id) => id === 'frontend-developer' ? 'auditor' : id))
    assert.equal(state.careers.find((career) => career.id === 'frontend-developer').onMap, false)
    const analyst = state.careers.find((career) => career.id === 'data-analyst')
    assert.equal(analyst.affinity, analyst.match.percent)
    assert.ok(analyst.affinity > 0)
    assert.equal(analyst.saved, true)
})

test('switching back brings the saved pet, affinity and roadmap of a career', async () =>
{
    store.reset()
    await call('/api/target', { careerId: 'data-analyst', mode: 'general' })
    await call('/api/roadmap')
    let save = store.load()
    save.pet.affinity = 40
    save.roadmap.stages[0].tasks[0].progress = 50
    store.save(save)

    await call('/api/target', { careerId: 'frontend-developer', mode: 'general' })
    save = store.load()
    assert.equal(save.pet.careerId, 'frontend-developer')
    assert.equal(save.roadmap, null)
    assert.equal(save.careers['data-analyst'].pet.affinity, 40)

    await call('/api/target', { careerId: 'data-analyst', mode: 'general' })
    save = store.load()
    assert.equal(save.pet.affinity, 40)
    assert.equal(save.roadmap.stages[0].tasks[0].progress, 50)
    assert.equal('data-analyst' in save.careers, false)
    assert.ok(save.careers['frontend-developer'])
})

test('a posting that fits another career waits for the player, who can take the suggestion', async () =>
{
    store.reset()
    // Asked the frontend mentor, but the posting is an audit job (off the map)
    let result = await call('/api/target', { careerId: 'frontend-developer', mode: 'customise', text: 'Audit associate: IFRS accounting, audit sampling, internal control testing' })
    assert.equal(result.body.pending, true)
    let state = result.body.state
    assert.equal(state.target, null)
    assert.equal(state.pending.requestedCareerId, 'frontend-developer')
    assert.equal(state.pending.suggestedCareerId, 'auditor')
    assert.equal(state.pending.replaces, state.map.replaceCandidate)

    result = await call('/api/target/resolve', { choice: 'suggested' })
    state = result.body.state
    assert.equal(result.body.careerId, 'auditor')
    assert.equal(state.target.careerId, 'auditor')
    assert.equal(state.target.mode, 'customise')
    assert.ok(state.map.slots.includes('auditor'))
    assert.equal(state.pending, null)
})

test('the player can keep the career they asked for, or cancel', async () =>
{
    store.reset()
    await call('/api/target', { careerId: 'frontend-developer', mode: 'customise', text: 'Data analyst role: SQL, data cleaning, dashboards' })
    let result = await call('/api/target/resolve', { choice: 'requested' })
    assert.equal(result.body.state.target.careerId, 'frontend-developer')
    assert.ok(result.body.state.target.posting)

    await call('/api/target', { careerId: 'frontend-developer', mode: 'customise', text: 'Data analyst role: SQL, data cleaning, dashboards' })
    result = await call('/api/target/resolve', { choice: 'cancel' })
    assert.equal(result.body.state.pending, null)
    assert.equal((await call('/api/target/resolve', { choice: 'suggested' })).body.error, 'no-pending')
})

test('a posting matching the asked career is set directly', async () =>
{
    store.reset()
    const result = await call('/api/target', { careerId: 'frontend-developer', mode: 'customise', text: 'React developer, JavaScript, HTML CSS' })
    assert.equal(result.body.pending, undefined)
    assert.equal(result.body.state.target.careerId, 'frontend-developer')
})

test('a career the search did not find is generated and kept in the save catalog', async () =>
{
    store.reset()
    const result = await call('/api/careers/generate', { query: 'Pilot' })
    assert.equal(result.status, 200)
    const career = result.body.state.careers.find((item) => item.id === result.body.careerId)
    assert.equal(career.custom, true)
    assert.equal(career.onMap, false)
    assert.equal(career.name.en, 'Pilot')
    assert.deepEqual(career.match.skills.map((skill) => skill.id), [ 'communication', 'project-management' ])
    assert.ok(store.load().customCareers.some((item) => item.id === career.id))
})

test('new skills of a generated career are registered for the save, then dropped with it', () =>
{
    const save = store.createSave()
    const career = game.addCustomCareer(save, {
        name: { zh: '花艺师', en: 'Florist', ms: 'Penggubah bunga' },
        summary: { zh: '设计花艺作品', en: 'Designs flower arrangements', ms: 'Mereka gubahan bunga' },
        skills: [
            { skillId: null, name: { zh: '花材知识', en: 'Flower knowledge', ms: 'Pengetahuan bunga' }, description: { zh: '认识花材的特性与花期。', en: 'Know flowers and their seasons well.', ms: 'Kenali bunga dan musimnya dengan baik.' }, icon: 'layers', difficulty: 2, level: 3, weight: 3 },
            { skillId: 'communication', name: SKILLS.communication, description: SKILLS.communication, icon: 'message', difficulty: 2, level: 2, weight: 2 },
        ],
        demand: 'low',
        effortMonths: [ 3, 6 ],
        petName: 'Petal',
    })
    assert.deepEqual(career.skills.map((skill) => skill.id), [ 'custom-flower-knowledge', 'communication' ])
    assert.equal(SKILLS['custom-flower-knowledge'].en, 'Flower knowledge')
    assert.equal(SKILL_DETAILS['custom-flower-knowledge'].heat, 30)
    assert.equal(getCareer(career.id).name.en, 'Florist')

    useCustom(store.createSave())
    assert.equal(SKILLS['custom-flower-knowledge'], undefined)
    assert.equal(getCareer(career.id), null)
})

test('saves from version 3 get the map fields', () =>
{
    const file = path.join(process.env.SAVE_DIR, 'save.json')
    const old = { ...store.createSave(), version: 3 }
    for(const key of [ 'map', 'careers', 'customCareers', 'customSkills', 'pendingTarget' ])
        delete old[key]
    fs.writeFileSync(file, JSON.stringify(old))
    const save = store.load()
    assert.equal(save.version, store.SAVE_VERSION)
    assert.deepEqual(game.mapSlots(save), DEFAULT_MAP)
    assert.deepEqual(save.careers, {})
    assert.deepEqual(save.customCareers, [])
})
