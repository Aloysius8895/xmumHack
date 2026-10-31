import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { SKILL_TARGETS, SKILL_SDG_REASONS, TARGETS, postingSkillSdgs } from '../../../src/game/server/sdg.js'
import { SKILL_DETAILS } from '../../../src/game/server/skill-details.js'
import { SKILLS, useCustom } from '../../../src/game/server/careers.js'

const filled = (text) => [ 'zh', 'en', 'ms' ].every((lang) => typeof text?.[lang] === 'string' && text[lang].trim().length > 5)

test('every catalog skill links to at least one SDG target, each link with a one-line reason in three languages', () =>
{
    for(const id of Object.keys(SKILL_DETAILS))
        assert.ok(SKILL_TARGETS[id]?.length, `${id} has a target`)
    for(const [ id, targets ] of Object.entries(SKILL_TARGETS))
        for(const target of targets)
        {
            assert.ok(TARGETS[target], `${id}: ${target} is a known target`)
            assert.ok(filled(SKILL_SDG_REASONS[id]?.[target]), `${id} ${target} has a reason`)
        }
    for(const [ id, reasons ] of Object.entries(SKILL_SDG_REASONS))
        for(const target of Object.keys(reasons))
            assert.ok(SKILL_TARGETS[id]?.includes(target), `${id}: reason for an unlinked target ${target}`)
})

test('a skill made from a job posting borrows the SDG links of its closest catalog skill, else 4.4', () =>
{
    const borrowed = postingSkillSdgs('ml-frameworks', SKILLS['ml-frameworks'])
    assert.deepEqual(borrowed.targets, SKILL_TARGETS['ml-frameworks'])
    assert.ok(borrowed.reasons['9.5'].en.startsWith(`Close to ${SKILLS['ml-frameworks'].en}: `))
    assert.ok(borrowed.reasons['9.5'].zh.includes(SKILL_SDG_REASONS['ml-frameworks']['9.5'].zh))
    const none = postingSkillSdgs(null, null)
    assert.deepEqual(none.targets, [ '4.4' ])
    assert.ok(filled(none.reasons['4.4']))
})

test('custom skills get their SDG links while a save is active, and lose them with the next save', () =>
{
    const skill = (en, description) => ({ name: { zh: en, en, ms: en }, detail: { icon: 'compass', difficulty: 3, description: { zh: description, en: description, ms: description } } })
    useCustom({ customSkills: {
        'custom-nlp': skill('Natural language processing (NLP)', 'Classifying text datasets with machine learning.'),
        'custom-front-desk': skill('Hotel front desk', 'Check guests in and out.'),
    } })
    assert.deepEqual(SKILL_TARGETS['custom-nlp'], SKILL_TARGETS['ml-frameworks'])
    assert.ok(SKILL_SDG_REASONS['custom-nlp']['9.5'].en.startsWith('Close to '))
    assert.deepEqual(SKILL_TARGETS['custom-front-desk'], [ '4.4' ])
    useCustom({})
    assert.equal(SKILL_TARGETS['custom-nlp'], undefined)
    assert.equal(SKILL_SDG_REASONS['custom-nlp'], undefined)
})

test('skill cards, posting requirements and the SDG panel show the reason of each skill link', () =>
{
    const source = fs.readFileSync(new URL('../../../src/game/sources/Career/CareerUI.js', import.meta.url), 'utf8')
    assert.match(source, /\$\{this\.skillSdgs\(skill\.id\)\}/)
    assert.match(source, /\$\{this\.skillSdgs\(requirement\.skillId\)\}/)
    assert.match(source, /class="career-sdg-reasons"/)
    const game = fs.readFileSync(new URL('../../../src/game/server/game.js', import.meta.url), 'utf8')
    assert.match(game, /skillReasons: SKILL_SDG_REASONS/)
})
