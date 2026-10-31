import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { rankDelta, renderAssumptions, renderCardScore, renderScenarioBar, renderScoreBreakdown, renderSkillRadar } from '../../../../src/game/sources/Career/ScenarioView.js'
import { t } from '../../../../src/game/sources/Career/i18n.js'

const esc = (value) => String(value)
const skillName = (id) => ({ sql: 'SQL', python: 'Python', excel: 'Excel' })[id] ?? id
const skill = (id, value, status, exposure = true) => ({ id, required: 3, current: 1, gap: 2, weight: 3, value, status,
    parts: { demand: 1, automationLoss: 0.12, augmentationGain: 0.08 },
    sources: { demand: null, exposure: exposure ? { taskCount: 4, name: 'Anthropic Economic Index' } : null } })
const state = (scenario = 'moderate', thin = false) => ({
    scenario: { scenario },
    forecast: { scenario, params: { k: 0.6, H: 3 }, adoptionRate: 0.302,
        sources: { exposure: { name: 'Anthropic Economic Index', url: 'https://x', license: 'CC-BY', downloadedAt: '2026-10-30' }, momentum: { months: 1 } },
        skills: [ skill('sql', 1.1, 'rising'), skill('python', 1.2, 'rising'), skill('excel', 0.8, 'declining') ],
        careers: [ { careerId: 'data-analyst', rank: 1, score: 38, fit: 0.3, outlook: 0.45, weights: { fit: 0.6, outlook: 0.4 }, confidence: 'low', thinProfile: thin,
            skills: [ skill('sql', 1.1, 'rising'), skill('excel', 0.8, 'declining', false) ], raise: [ { skillId: 'sql', gain: 8 } ] } ] },
    scenarioCompare: { 'data-analyst': { moderate: { score: 38, rank: 1 }, fast: { score: 35, rank: 3 } } },
    skillStatus: { excel: { moderate: 'declining', fast: 'declining' }, sql: { moderate: 'rising', fast: 'declining' } },
})

test('the toggle marks the current scenario, always says estimate, and asks for skills when the profile is thin', () =>
{
    const html = renderScenarioBar(state(), { t, esc })
    assert.match(html, /data-preset="moderate" aria-pressed="true"/)
    assert.match(html, /data-preset="fast" aria-pressed="false"/)
    assert.match(html, /估算/)
    assert.doesNotMatch(html, /补充档案/)
    assert.match(renderScenarioBar(state('moderate', true), { t, esc }), /data-panel="profile"/)
})

test('a card shows the score, the rank change against the other scenario and low confidence', () =>
{
    assert.equal(rankDelta(state(), 'data-analyst'), 2)          // 3rd under fast, 1st under moderate
    assert.equal(rankDelta(state('fast'), 'data-analyst'), - 2)
    const html = renderCardScore(state(), 'data-analyst', { t, esc })
    assert.match(html, /匹配分 38/)
    assert.match(html, /↑2/)
    assert.match(html, /低置信/)
    assert.equal(renderCardScore(state(), 'chef', { t, esc }), '')
})

test('why this score: the formula with the numbers, each skill with its parts, how to raise it, no source said', () =>
{
    const html = renderScoreBreakdown(state(), 'data-analyst', { t, esc, skillName })
    assert.match(html, /匹配分 38 = 技能契合度 30 × 60% \+ 职业前景 45 × 40%/)
    assert.match(html, /SQL[\s\S]*↑ 1\.10/)
    assert.match(html, /学会SQL：\+8 分/)
    assert.match(html, /无来源/)           // excel has no exposure source
})

test('the assumptions card states the parameters, the formula, the sources and the limits', () =>
{
    const html = renderAssumptions(state(), { t, esc })
    assert.match(html, /k = 0\.6/)
    assert.match(html, /30%/)
    assert.match(html, /未满 3 个月/)
    assert.match(html, /不是数据/)
    assert.match(html, /最后的决定由你做/)
})

test('the skill radar lists rising and declining skills, and those declining under both scenarios', () =>
{
    const html = renderSkillRadar(state(), { t, esc, skillName })
    assert.match(html, /Python[\s\S]*SQL/)                    // rising, highest first
    assert.match(html, /两个情景下都在下降[\s\S]*Excel/)
    assert.doesNotMatch(html.split('两个情景下都在下降')[1], /SQL/)
})

test('every scenario text exists in the three languages', () =>
{
    const source = fs.readFileSync(new URL('../../../../src/game/sources/Career/i18n.js', import.meta.url), 'utf8')
    const used = [ ...fs.readFileSync(new URL('../../../../src/game/sources/Career/ScenarioView.js', import.meta.url), 'utf8').matchAll(/t\('(scenario\.[\w.]+)'/g) ].map((match) => match[1])
    for(const key of [ ...new Set([ ...used, 'scenario.moderate', 'scenario.fast', 'scenario.customName', 'scenario.status.rising', 'scenario.status.stable', 'scenario.status.declining' ]) ])
    {
        const line = source.split('\n').find((row) => row.includes(`'${key}':`))
        assert.ok(line, key)
        for(const lang of [ 'zh', 'en', 'ms' ])
            assert.match(line, new RegExp(`${lang}: '[^']+'`), `${key}.${lang}`)
    }
})
