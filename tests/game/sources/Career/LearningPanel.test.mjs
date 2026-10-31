import assert from 'node:assert/strict'
import test from 'node:test'
import { LEARNING_STRINGS, renderLearningPanel } from '../../../../src/game/sources/Career/LearningPanel.js'

const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const t = (id, vars = {}) => Object.entries(vars).reduce((value, [ key, text ]) => value.replaceAll(`{${key}}`, String(text)), LEARNING_STRINGS[id]?.en ?? id)
const learning = { mode: 'extreme', userOverride: 'extreme', weeklyHours: 10, checkpointDays: 7, appliedMode: 'moderate', evidence: { skills: [] }, checkpointDueAt: '2026-11-07T00:00:00.000Z', canReview: true, checkpoint: { id: 'c', question: '<script>bad()</script>' }, analysis: '<img onerror="bad()">', pending: { id: 'p', mode: 'extreme', summary: '<svg>', preservedTasks: 2, hoursDelta: 1, changes: [ { title: '<script>', why: '<img>', before: '<b>' } ] } }

test('learning panel exposes two choices, checkpoint and explicit confirmation while escaping model/user text', () =>
{
    const html = renderLearningPanel({ learning, roadmap: {} }, { reviewAnswer: '</textarea><script>bad()</script>' }, { t, esc, skillName: id => id })
    for(const action of [ 'learning-mode', 'learning-checkpoint-refresh', 'learning-review', 'learning-apply', 'learning-discard' ]) assert.ok(html.includes(`data-action="${action}"`))
    assert.ok(!html.includes('data-action="learning-checkpoint"'), 'an open check-in shows refresh instead of another start button')
    assert.ok(html.includes('data-mode="moderate"'))
    assert.ok(html.includes('data-mode="extreme" aria-pressed="true"'))
    assert.ok(!html.includes('data-mode="fast"'))
    assert.ok(!html.includes('<script>'))
    assert.ok(!html.includes('<img'))
    assert.ok(html.includes('&lt;/textarea&gt;'))
})

test('new controls and errors have complete three-language labels', () =>
{
    for(const [ id, entry ] of Object.entries(LEARNING_STRINGS)) for(const lang of [ 'zh', 'en', 'ms' ]) assert.ok(entry[lang]?.trim(), `${id}.${lang}`)
})

test('the recommended scenario is pressed by default and its basis shown; an own choice says until when, with no reset button', () =>
{
    const base = { ...learning, pending: null, checkpoint: null, recommendedScenario: 'extreme', recommendationReason: 'Automation share +22.2 points.' }
    const followed = renderLearningPanel({ learning: { ...base, mode: 'extreme', userOverride: null } }, {}, { t, esc, skillName: id => id })
    assert.ok(followed.includes('Recommended from the data: Extreme. Automation share +22.2 points.'))
    assert.ok(followed.includes('data-mode="extreme" aria-pressed="true"'))
    assert.ok(!followed.includes('data-action="learning-default"'))
    assert.ok(!followed.includes('cannot establish development speed'))
    const own = renderLearningPanel({ learning: { ...base, mode: 'moderate', userOverride: 'moderate', overrideUntil: '2026-11-07T00:00:00.000Z' } }, {}, { t, esc, skillName: id => id, locale: 'en-GB' })
    assert.ok(own.includes('data-mode="moderate" aria-pressed="true"'))
    assert.ok(own.includes('You chose Moderate as the planning assumption for this learning cycle; after 07/11/2026 the recommendation applies again'))
    assert.ok(!own.includes('data-action="learning-default"'))
})
