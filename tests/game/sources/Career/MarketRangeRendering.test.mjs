import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as series from '../../../../src/game/sources/Career/MarketSeries.js'
import * as reference from '../../../../src/game/sources/Career/MarketReference.js'
import * as mock from '../../../../src/game/sources/Career/MockMarketHistory.js'
import { t, getLang, pick } from '../../../../src/game/sources/Career/i18n.js'
import { renderSkillTrendSummary } from '../../../../src/game/sources/Career/SkillTrendSummary.js'
import { marketRangeWindow } from '../../../../src/game/sources/Career/MarketWindow.js'

// Exercise the actual panel renderer without loading the WebGL game and its assets in Node.
const source = fs.readFileSync(new URL('../../../../src/game/sources/Career/CareerUI.js', import.meta.url), 'utf8')
const method = source.match(/    renderMarket\(\)\r?\n    \{[\s\S]*?\r?\n    \}/)[0]
const deps = { ...series, ...reference, ...mock, t, getLang, pick,
    marketRangeWindow: (trends, selection) => marketRangeWindow(trends, selection, ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']),
    esc: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
    bar: value => `<i data-bar="${value}"></i>`, icon: () => '', newCareerBadge: () => '',
    renderMarketHistory: () => '', renderSamplingDiagnostics: () => '', renderSkillTrendSummary,
}
const render = new Function(...Object.keys(deps), `return ({${method}}).renderMarket`)(...Object.values(deps))
const statMethod = source.match(/    skillTrendStat\(skillId\)\r?\n    \{[\s\S]*?\r?\n    \}/)[0]
const stat = new Function(...Object.keys(deps), 'periodLabel', `return ({${statMethod}}).skillTrendStat`)(...Object.values(deps), String)
const fixture = () => ({
    drafts: {}, panel: {marketTab: 'ranking', marketFrom: '2024-05', marketTo: '2024-06'},
    state: { careers: [], trends: {
        periods: ['2024-05', '2024-06', '2024-07', '2026-10'],
        careers: [{id: 'a', name: {en: 'Alpha'}, ads: [10, 20, 15, 300]}, {id: 'b', name: {en: 'Beta'}, ads: [30, 15, 30, 1]}],
        skills: [{id: 'sql', name: {en: 'SQL'}, share: [10, 20, 5, 80]}],
    } },
})
const careerSection = html => html.match(/<ol class="career-trend-ranking">([\s\S]*?)<\/ol>/)[1]
const skillSummary = html => html.match(/<section class="career-radar"[\s\S]*?<\/section>/)[0]

test('skill cards display the same selected monthly data after leaving and reopening market', () => {
    const ui = fixture()
    ui.state.skillMarket = {sql: {sample: true, share: 80}}
    render.call(ui)
    ui.panel = {name: 'careers'}
    const june = stat.call(ui, 'sql')
    assert.match(june, /20%/)
    assert.match(june, /↑ 10/)
    assert.match(june, /2024-06/)
    assert.doesNotMatch(june, /80%/)
    assert.doesNotMatch(june, new RegExp(t('market.accumulating')))
    ui.panel = {name: 'market', marketTab: 'skills'}
    assert.match(render.call(ui)[1], /value="2024-06" selected/)
    ui.panel.marketTo = '2024-07'
    render.call(ui)
    ui.panel = {name: 'pet'}
    const july = stat.call(ui, 'sql')
    assert.match(july, /5%/)
    assert.match(july, /↓ 15/)
    assert.match(july, /2024-07/)
})

test('skill card observed zero is displayed and absent history never invents a change', () => {
    const ui = fixture()
    ui.state.trends.skills[0].share = [10, 0, 5, 80]
    render.call(ui)
    assert.match(stat.call(ui, 'sql'), /0% · ↓ 10/)
    ui.state.trends.skills[0].share = [null, null, null, null]
    assert.match(stat.call(ui, 'sql'), new RegExp(t('market.noData')))
    ui.state.trends = {periods: [], skills: []}
    ui.state.skillMarket = {sql: {sample: true, share: 11.7}}
    const fallback = stat.call(ui, 'sql')
    assert.match(fallback, /11\.7% · —/)
    assert.doesNotMatch(fallback, new RegExp(t('market.accumulating')))
})

test('skill summary follows the overview range instead of the independent AI forecast', () => {
    const ui = fixture()
    ui.state.forecast = {scenario: 'moderate', skills: [{id: 'mlops', value: 1.33, status: 'rising'}]}
    ui.state.trends.skills.push({id: 'python', name: {en: 'Python'}, share: [30, 20, 30, 99]})
    ui.panel.marketTab = 'overview'
    render.call(ui)
    ui.panel.marketTab = 'skills'
    const june = skillSummary(render.call(ui)[1])
    assert.match(june.match(/class="is-up"[\s\S]*?<\/div>/)[0], /SQL[\s\S]*\+10\.0/)
    assert.match(june.match(/class="is-down"[\s\S]*?<\/div>/)[0], /Python[\s\S]*-10\.0/)
    assert.doesNotMatch(june, /1\.33|mlops|is-estimate/)
    ui.panel.marketTab = 'overview'
    ui.panel.marketTo = '2024-07'
    render.call(ui)
    ui.panel.marketTab = 'skills'
    const july = skillSummary(render.call(ui)[1])
    assert.match(july.match(/class="is-up"[\s\S]*?<\/div>/)[0], /Python[\s\S]*\+10\.0/)
    assert.match(july.match(/class="is-down"[\s\S]*?<\/div>/)[0], /SQL[\s\S]*-15\.0/)
    assert.notEqual(june, july)
})

test('ranking tab keeps chosen dates and changes ordering, values, filters and sparklines with the range', () => {
    const ui = fixture()
    const june = render.call(ui)[1]
    assert.match(june, /value="2024-06" selected/)
    assert.match(june, /data-market="from"/)
    const first = careerSection(june)
    assert.ok(first.indexOf('Alpha') < first.indexOf('Beta'))
    assert.match(first, /\+100\.0%/)
    assert.doesNotMatch(first, /300/)
    ui.panel.marketTo = '2024-07'
    const july = careerSection(render.call(ui)[1])
    assert.ok(july.indexOf('Beta') < july.indexOf('Alpha'))
    assert.match(july, /-25\.0%/)
    assert.notEqual(first.match(/polyline points="([^"]+)"/)[1], july.match(/polyline points="([^"]+)"/)[1])
    ui.panel.marketFilter = 'rising'
    const filtered = careerSection(render.call(ui)[1])
    assert.match(filtered, /Beta/)
    assert.doesNotMatch(filtered, /Alpha/)
})

test('switching between heatmap, ranking and skills retains the selected endpoint', () => {
    const ui = fixture()
    ui.panel.marketTab = 'overview'
    const heatmap = render.call(ui)[1]
    assert.match(heatmap, /data-period="2024-06"/)
    assert.doesNotMatch(heatmap, /data-period="2026-10"/)
    ui.panel.marketTab = 'skills'
    const june = render.call(ui)[1]
    assert.match(june, /value="2024-06" selected/)
    assert.match(careerSection(june), />20%<\/span>/)
    ui.panel.marketTo = '2024-07'
    assert.match(careerSection(render.call(ui)[1]), />5%<\/span>/)
    ui.panel.marketFrom = '2024-07'
    const single = careerSection(render.call(ui)[1])
    assert.doesNotMatch(single, /<polyline/)
    assert.match(single, /-15/)
})
