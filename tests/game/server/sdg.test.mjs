import test from 'node:test'
import assert from 'node:assert/strict'
import { CAREERS, EXTRA_CAREERS, SKILL_IDS } from '../../../src/game/server/careers.js'
import { CAREER_SDGS, GOALS, SKILL_TARGETS, TARGETS, careerSdgs, contribution, goalOf } from '../../../src/game/server/sdg.js'
import { createSave } from '../../../src/game/server/store.js'
import * as game from '../../../src/game/server/game.js'

const ai = { mock: true, keyConfigured: false, model: 'test' }

test('every catalog career has authored SDG targets with a reason in each language', () =>
{
    for(const career of [ ...CAREERS, ...EXTRA_CAREERS ])
    {
        const tags = CAREER_SDGS[career.id]
        assert.ok(tags?.length, `${career.id} has no SDG`)
        for(const tag of tags)
        {
            assert.ok(TARGETS[tag.target], `${career.id}: unknown target ${tag.target}`)
            for(const lang of [ 'zh', 'en', 'ms' ])
                assert.ok(tag.why[lang], `${career.id} ${tag.target}: no ${lang} reason`)
        }
    }
})

test('every catalog skill moves at least one known target', () =>
{
    for(const id of SKILL_IDS)
    {
        assert.ok(SKILL_TARGETS[id]?.length, `${id} has no SDG`)
        for(const target of SKILL_TARGETS[id])
            assert.ok(TARGETS[target], `${id}: unknown target ${target}`)
    }
    for(const target of Object.keys(TARGETS))
        assert.ok(GOALS[goalOf(target)], `${target}: unknown goal`)
})

test('a generated career keeps only listed targets, or falls back to its skills', () =>
{
    const save = createSave()
    const career = game.addCustomCareer(save, {
        name: { zh: '太阳能技师', en: 'Solar technician', ms: 'Juruteknik solar' },
        summary: { zh: '', en: '', ms: '' },
        skills: [ { skillId: 'project-management', level: 2, weight: 2 } ],
        demand: 'medium', effortMonths: [ 6, 12 ], petName: 'Sol',
        sdgs: [ { target: '9.1', why: { zh: 'a', en: 'b', ms: 'c' } }, { target: '7.9', why: { zh: '', en: '', ms: '' } } ],
    })
    assert.deepEqual(careerSdgs(career).map((tag) => tag.target), [ '9.1' ])
    assert.deepEqual(careerSdgs({ ...career, id: 'other', sdgs: [] }).map((tag) => tag.target), [ '8.2' ])
})

test('contribution follows the preparation of the skills tagged with each goal', () =>
{
    const career = CAREERS.find((item) => item.id === 'data-analyst')
    const progress = career.skills.map((skill) => ({ id: skill.id, progress: [ 'sql', 'data-cleaning' ].includes(skill.id) ? 100 : 0 }))
    const goals = contribution(career, progress, 30)
    const data = goals.find((item) => item.goal === 17)
    assert.ok(data.career)
    assert.ok(data.progress > 0 && data.progress < 100)
    assert.equal(goals.find((item) => item.goal === 4).progress, 30) // 4.4 has no tagged skill here: whole preparation
})

test('the view tags every career and reports the target career contribution', () =>
{
    const save = createSave()
    assert.equal(game.view(save, ai).sdg.contribution, null)
    game.setTarget(save, { careerId: 'teacher', mode: 'general' })
    const view = game.view(save, ai)
    assert.ok(view.careers.every((career) => career.sdgs.length))
    assert.equal(view.sdg.contribution.careerId, 'teacher')
    assert.ok(view.sdg.contribution.goals.some((item) => item.goal === 4 && item.targets.includes('4.c')))
})
