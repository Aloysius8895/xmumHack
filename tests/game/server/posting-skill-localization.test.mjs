import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'posting-languages-'))
process.env.AI_PROVIDER = 'deepseek'
process.env.DEEPSEEK_API_KEY = 'test-key'
process.env.AI_MOCK = '0'
delete process.env.AWS_BACKEND_URL
delete process.env.AWS_BACKEND_TOKEN

const store = await import('../../../src/game/server/store.js')
const { createSave } = store
const game = await import('../../../src/game/server/game.js')
const { SKILLS, useCustom } = await import('../../../src/game/server/careers.js')
const { localizePostingSkills, missingPostingSkillTranslations } = await import('../../../src/game/server/posting-skill-localization.js')
const features = await import('../../../src/game/server/features.js')
const { handle } = await import('../../../src/game/server/app.js')
const originalFetch = globalThis.fetch
const unexpectedFetch = async () => { throw new Error('unexpected AI request in test') }
let fetchMock = unexpectedFetch
// The SDK retains its fetch function when its first client is created.
globalThis.fetch = (...args) => fetchMock(...args)
test.after(() => { globalThis.fetch = originalFetch })

const name = { zh: '数据结构与软件架构', en: 'Data structures and software architecture', ms: 'Struktur data dan seni bina perisian' }
const description = { zh: '掌握数据结构、数据建模与软件架构的基础知识。', en: 'Understand the basics of data structures, data modelling and software architecture.', ms: 'Fahami asas struktur data, pemodelan data dan seni bina perisian.' }

function learner(localized = false)
{
    const save = createSave()
    game.setTarget(save, { careerId: 'ml-engineer', mode: 'customise', posting: {
        title: 'ML Engineer', company: 'Test company', summary: 'Test', requirements: [ {
            text: '具备数据结构、数据建模与软件架构的基础知识', note: '掌握数据结构、数据建模与软件架构的基础知识。',
            skillId: 'other', kind: 'skill', level: 2, priority: 'must', status: 'gap',
            ...(localized ? { skillName: name, skillDescription: description } : {}),
        } ],
    } })
    return save
}

const ai = { mock: false, provider: 'deepseek', keyConfigured: true, model: 'test' }

test('new posting skills expose localized names and descriptions in every language', () =>
{
    const save = learner(true)
    const id = save.target.posting.requirements[0].skillId
    for(const lang of [ 'zh', 'en', 'ms' ])
    {
        save.lang = lang
        const state = game.view(save, ai)
        assert.equal(state.skillNames[id][lang], name[lang])
        assert.equal(state.skillDetails[id].description[lang], description[lang])
        assert.equal(state.pet.skills[0].id, id)
    }
    assert.equal(missingPostingSkillTranslations(save).length, 0)
    assert.equal(save.target.posting.requirements[0].text, '具备数据结构、数据建模与软件架构的基础知识')
})

test('legacy skills are repaired once across active and shelved careers without changing learning data', async () =>
{
    const save = learner()
    const id = save.target.posting.requirements[0].skillId
    save.mastery[id] = 65
    save.profile.skills = [ { id, name: 'Original profile label', level: 2, source: 'manual' } ]
    save.roadmap = { stages: [ { tasks: [ { id: 't1', skillId: id, progress: 70 } ] } ] }
    save.careers.other = { target: structuredClone(save.target) }
    const original = structuredClone(save)
    let requests = 0
    const translate = async (batch) =>
    {
        requests++
        assert.deepEqual(batch.map((skill) => skill.id), [ id ])
        assert.deepEqual(Object.keys(batch[0]).sort(), [ 'description', 'id', 'name' ])
        return [ { id, name, description } ]
    }
    assert.deepEqual(await localizePostingSkills(save, translate), { translatedSkills: 1, skillTranslationPending: false })
    assert.deepEqual(SKILLS[id], name)
    for(const key of [ 'target', 'careers', 'profile', 'mastery', 'roadmap', 'points', 'pet', 'logs' ])
        assert.deepEqual(save[key], original[key], key)
    save.lang = 'ms'
    assert.deepEqual(await localizePostingSkills(save, translate), { translatedSkills: 0, skillTranslationPending: false })
    assert.equal(requests, 1)
    useCustom(save)
    assert.equal(SKILLS[id].en, name.en)
})

test('new extraction can repair an existing legacy skill while retaining its id', () =>
{
    const save = learner()
    const requirement = save.target.posting.requirements[0]
    const id = requirement.skillId
    Object.assign(requirement, { skillName: name, skillDescription: description })
    assert.equal(game.adoptPostingSkills(save), true)
    assert.equal(requirement.skillId, id)
    assert.deepEqual(save.customSkills[id].name, name)
    assert.equal(game.adoptPostingSkills(save), false)
})

test('invalid translations never partially replace saved text; demo mode defers the repair', async () =>
{
    const save = learner()
    const id = save.target.posting.requirements[0].skillId
    const original = structuredClone(save)
    for(const result of [ [], [ { id: 'unknown', name, description } ], [ { id, name: { en: 'Incomplete' }, description } ],
        [ { id, name, description }, { id, name, description } ] ])
    {
        await assert.rejects(localizePostingSkills(save, async () => result))
        assert.deepEqual(save, original)
    }
    assert.deepEqual(await localizePostingSkills(save, async () => null), { translatedSkills: 0, skillTranslationPending: true })
    assert.deepEqual(save, original)
})

function answer(input)
{
    return new Response(JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: 'test', stop_reason: 'tool_use',
        usage: { input_tokens: 1, output_tokens: 1 }, content: [ { type: 'tool_use', id: 'call', name: 'submit_result', input } ],
    }), { status: 200, headers: { 'content-type': 'application/json' } })
}

async function selectLanguage(lang)
{
    const request = Readable.from([ Buffer.from(JSON.stringify({ lang })) ])
    Object.assign(request, { method: 'POST', url: '/api/lang', headers: {} })
    let payload
    const response = { setHeader() {}, end(value) { payload = JSON.parse(value) } }
    await handle(request, response)
    return { status: response.statusCode, ...payload }
}

test('posting analysis requests all three translations in its existing AI call', async () =>
{
    useCustom(createSave())
    let calls = 0
    fetchMock = async (_url, options) =>
    {
        calls++
        const body = JSON.parse(options.body)
        const fields = body.tools[0].input_schema.properties.requirements.items
        assert.deepEqual(fields.properties.skillName.required, [ 'zh', 'en', 'ms' ])
        assert.deepEqual(fields.properties.skillDescription.required, [ 'zh', 'en', 'ms' ])
        assert.match(body.messages[0].content[0].text, /regardless of the player's current language/)
        return answer({ title: 'ML Engineer', company: 'Test', summary: 'Test', suggestedCareerId: 'ml-engineer', requirements: [ {
            text: name.zh, note: description.zh, skillId: 'other', level: 2, priority: 'must', status: 'gap', kind: 'skill',
            skillName: name, skillDescription: description,
        } ] })
    }
    try
    {
        const result = await features.analyzePosting({ text: 'Test posting', careerId: 'ml-engineer', profile: { skills: [] }, lang: 'en' })
        assert.deepEqual(result.requirements[0].skillName, name)
        assert.equal(calls, 1)
    }
    finally { fetchMock = unexpectedFetch }
})

test('language selection persists legacy translations and later switches use the cache', async () =>
{
    const save = learner()
    const id = save.target.posting.requirements[0].skillId
    store.save(save)
    let calls = 0
    fetchMock = async () => { calls++; return answer({ skills: [ { id, name, description } ] }) }
    try
    {
        const first = await selectLanguage('en')
        assert.equal(first.status, 200)
        assert.equal(first.translatedSkills, 1)
        assert.equal(first.state.lang, 'en')
        assert.equal(first.state.skillNames[id].en, name.en)
        const second = await selectLanguage('ms')
        assert.equal(second.state.skillDetails[id].description.ms, description.ms)
        assert.equal(second.translatedSkills, 0)
        assert.equal(calls, 1)
        assert.deepEqual(store.load().customSkills[id].name, name)
    }
    finally { fetchMock = unexpectedFetch }
})

test('offline translation still saves the language and retains original skills for retry', async () =>
{
    const save = learner()
    store.save(save)
    fetchMock = async () => { throw new Error('offline') }
    try
    {
        const result = await selectLanguage('en')
        assert.equal(result.status, 200)
        assert.equal(result.skillTranslationPending, true)
        assert.equal(result.state.lang, 'en')
        assert.deepEqual(store.load().customSkills, save.customSkills)
    }
    finally { fetchMock = unexpectedFetch }
})
