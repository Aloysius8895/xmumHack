import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { t, getLang } from '../../../../src/game/sources/Career/i18n.js'

const source = fs.readFileSync(new URL('../../../../src/game/sources/Career/CareerUI.js', import.meta.url), 'utf8')
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const method = source.match(/    renderLog\(\)\r?\n    \{[\s\S]*?\r?\n    \}/)[0]
const render = new Function('t', 'esc', 'getLang', 'pick', `return ({${method}}).renderLog`)(t, esc, getLang, value => typeof value === 'object' ? value.en : value)
const html = entry => render.call({ state: { logs: [{at: '2026-10-31T10:41:45Z', source: 'telegram', text: 'Study', skillIds: ['sql'], verdict: 'learned', ...entry}], roadmap: {} }, drafts: {}, skillName: id => id })[1]

test('learning entries show task identity, before/after, actual gain and points', () => {
    const result = html({advanced: [{taskId: 's1t1', taskTitle: {en: 'SQL joins'}, from: 20, to: 53}], points: 66})
    assert.match(result, /SQL joins/)
    assert.ok(result.includes(t('log.advanced', {from: 20, to: 53})))
    assert.ok(result.includes(t('log.gained', {n: 33})))
    assert.ok(result.includes(t('log.points', {n: 66})))
})

test('unmatched historical entries show zero progress, zero points and an escaped reason', () => {
    const result = html({advanced: [], points: 0, summary: 'No matching task <script>'})
    assert.ok(result.includes(t('log.noAdvance')))
    assert.ok(result.includes(t('log.points', {n: 0})))
    assert.ok(result.includes(t('log.unmatched')))
    assert.match(result, /No matching task &lt;script>/)
    assert.doesNotMatch(result, /<script>/)
})

test('old task entries remain readable after their roadmap was replaced', () => {
    const result = html({advanced: [{taskId: 'old-task', from: 0, to: 33}], points: 66})
    assert.match(result, /old-task/)
    assert.ok(result.includes(t('log.gained', {n: 33})))
})

test('invalid and vague logs explain why no progress was awarded', () => {
    for(const verdict of ['invalid', 'vague']) {
        const result = html({verdict, advanced: [], points: 0})
        assert.ok(result.includes(t(`log.verdict.${verdict}`)))
        assert.ok(result.includes(t('log.noAdvance')))
        assert.ok(!result.includes(t('log.unmatched')))
    }
})
