import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanEvidence, evidenceIn, localizeProfileEvidence, untranslatedEvidence } from '../../../src/game/server/profile-localization.js'
import { createSave } from '../../../src/game/server/store.js'
import * as game from '../../../src/game/server/game.js'
import { profileSkillNames } from '../../../src/game/server/profile-localization.js'
import { useCustom } from '../../../src/game/server/careers.js'

const zh = '在职业仪表盘项目中用 SQL 汇总职位数据'
const trilingual = { zh, en: 'Used SQL to summarise posting data in a career dashboard project', ms: 'Menggunakan SQL untuk meringkaskan data iklan dalam projek papan pemuka' }

test('evidence is kept in three languages, an older single sentence as written, and read in the chosen language', () =>
{
    assert.deepEqual(cleanEvidence(trilingual), trilingual)
    assert.equal(cleanEvidence(zh), zh)
    assert.equal(cleanEvidence({ zh }), '')                       // a translation missing: no half object
    assert.equal(evidenceIn(trilingual, 'en'), trilingual.en)
    assert.equal(evidenceIn(zh, 'en'), zh)                       // not translated yet: shown as written
    // saving the skill list keeps the three languages (it used to turn them into "[object Object]")
    const profile = { skills: [] }
    game.setSkills(profile, [ { id: 'sql', name: 'SQL', level: 2, evidence: trilingual, source: 'ai' } ])
    assert.deepEqual(profile.skills[0].evidence, trilingual)
    game.mergeSkills(profile, [ { skillId: 'python', name: 'Python', level: 1, evidence: trilingual } ])
    assert.deepEqual(profile.skills[1].evidence, trilingual)
})

test('older single-sentence evidence is translated once, as a whole, and left alone in demo mode', async () =>
{
    const save = createSave()
    save.profile.skills = [ { id: 'sql', name: 'SQL', level: 2, evidence: zh, source: 'ai' }, { id: 'python', name: 'Python', level: 1, evidence: trilingual, source: 'ai' },
        { id: 'excel', name: 'Excel', level: 1, evidence: '', source: 'manual' } ]
    assert.deepEqual(untranslatedEvidence(save), [ { id: '0', text: zh } ])
    // demo mode: nothing changes, retried later
    assert.deepEqual(await localizeProfileEvidence(save, async () => null), { translatedEvidence: 0, evidenceTranslationPending: true })
    assert.equal(save.profile.skills[0].evidence, zh)
    // an incomplete answer changes nothing
    await assert.rejects(localizeProfileEvidence(save, async () => [ { id: '0', evidence: { zh } } ]), /invalid-evidence-translations/)
    assert.equal(save.profile.skills[0].evidence, zh)
    const result = await localizeProfileEvidence(save, async (items) => items.map((item) => ({ id: item.id, evidence: trilingual })))
    assert.deepEqual(result, { translatedEvidence: 1, evidenceTranslationPending: false })
    assert.deepEqual(save.profile.skills[0].evidence, trilingual)
    assert.equal(save.profile.skills[0].level, 2)
    assert.deepEqual(untranslatedEvidence(save), [])
})

test('a legacy null-ID NLP skill uses catalog translations without changing identity or progress', () =>
{
    const save = createSave()
    const name = {zh: '自然语言处理（NLP）', en: 'Natural language processing (NLP)', ms: 'Pemprosesan bahasa semula jadi (NLP)'}
    save.customSkills = {'custom-nlp': {name, detail: {description: name}}}
    save.profile.skills = [{id: null, name: name.zh, level: 2, evidence: trilingual, source: 'ai'}]
    useCustom(save)
    const before = structuredClone(save.profile)
    assert.deepEqual(profileSkillNames(save.profile.skills[0]), name)
    for(const lang of ['zh', 'en', 'ms'])
    {
        save.lang = lang
        const profile = game.view(save, {}).profile
        assert.equal(profile.skills[0].localizedName[lang], name[lang])
        assert.equal(profile.skills[0].id, null)
    }
    assert.deepEqual(save.profile, before)
    useCustom({})
})

test('unknown names gain cached translations and survive profile edits', async () =>
{
    const save = createSave()
    const names = {zh: '量子电路设计', en: 'Quantum circuit design', ms: 'Reka bentuk litar kuantum'}
    save.profile.skills = [{id: null, name: names.zh, level: 2, evidence: trilingual, source: 'ai'}]
    let calls = 0
    await localizeProfileEvidence(save, async items => {
        calls++
        assert.deepEqual(items, [{id: 'name:0', text: names.zh}])
        return [{id: 'name:0', evidence: names}]
    })
    assert.deepEqual(save.profile.skills[0].localizedName, names)
    await localizeProfileEvidence(save, async () => { throw new Error('cached') })
    game.setSkills(save.profile, save.profile.skills)
    assert.deepEqual(save.profile.skills[0].localizedName, names)
    assert.equal(save.profile.skills[0].level, 2)
    assert.equal(calls, 1)
    save.profile.skills[0].name = '另一个技能'
    assert.equal(profileSkillNames(save.profile.skills[0]), null, 'edited names do not reuse stale translations')
})

test('Chinese copies in English or Malay skill-name translations are rejected atomically', async () =>
{
    const save = createSave()
    save.profile.skills = [{id: null, name: '量子电路设计', level: 2, evidence: trilingual}]
    const before = structuredClone(save)
    await assert.rejects(localizeProfileEvidence(save, async () => [{id: 'name:0', evidence: {zh: '量子电路设计', en: '量子电路设计', ms: '量子电路设计'}}]), /invalid-evidence-translations/)
    assert.deepEqual(save, before)
})
