import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { renderSkillTrendSummary } from '../../../../src/game/sources/Career/SkillTrendSummary.js'
import { t } from '../../../../src/game/sources/Career/i18n.js'

const options = {t, esc: value => String(value), skillName: skill => skill.id, range: 'May–Jul 2024', month: 'Jul 2024', previous: 'Jun 2024'}

test('summary ranks monthly point changes, omits flat/missing rows, and keeps input order unchanged', () => {
    const skills = [{id: 'small', points: 1}, {id: 'large', points: 20}, {id: 'flat', points: 0},
        {id: 'missing', points: null}, {id: 'decline', points: -4}]
    const before = structuredClone(skills)
    const html = renderSkillTrendSummary(skills, options)
    assert.ok(html.indexOf('large') < html.indexOf('small'))
    assert.match(html, /-4\.0/)
    assert.match(html, /May–Jul 2024/)
    assert.match(html, /Jul 2024/)
    assert.match(html, /Jun 2024/)
    assert.doesNotMatch(html, />flat<|>missing</)
    assert.deepEqual(skills, before)
})

test('empty comparisons show no invented rising or declining skills', () => {
    const html = renderSkillTrendSummary([{id: 'unknown', points: null}], options)
    assert.equal(html.split(t('market.skillSummary.none')).length - 1, 2)
    assert.doesNotMatch(html, /<li>|NaN|undefined/)
})

test('summary text exists in all three languages', () => {
    const source = fs.readFileSync(new URL('../../../../src/game/sources/Career/i18n.js', import.meta.url), 'utf8')
    for(const key of ['title', 'rising', 'declining', 'none', 'note']) {
        const line = source.split('\n').find(row => row.includes(`'market.skillSummary.${key}':`))
        for(const lang of ['zh', 'en', 'ms']) assert.match(line, new RegExp(`${lang}: '[^']+'`))
    }
})
