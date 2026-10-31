import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('../../../../src/game/sources/Career/CareerUI.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n') // CRLF checkouts (core.autocrlf)
const card = source.slice(source.indexOf('    renderRoadmapMap('), source.indexOf('    taskResource(task)'))
const method = (name) => source.slice(source.indexOf(`    ${name}(`), source.indexOf('\n    }\n', source.indexOf(`    ${name}(`)) + 6)

test('a roadmap card shows a title, one sentence and a learning link, not the long texts (user decision 2026-10-31)', () =>
{
    assert.ok(card.length > 1000, 'roadmap card found')
    for(const removed of [ "t('roadmap.why')", 'approach.reason', "t('roadmap.covers'", "t('learning.deliverable')", "t('learning.criteria')" ])
        assert.equal(card.includes(removed), false, removed)
    assert.match(card, /<span>\$\{esc\(task\.title\)\}\$\{brief\(task\.why\) \? `<small>\$\{esc\(brief\(task\.why\)\)\}<\/small>` : ''\}<\/span>/)
    assert.match(card, /\$\{this\.taskResource\(task\)\}/)
})

test('the card sentence is the first plain sentence, cut to about 40 Chinese or 90 Latin characters', () =>
{
    const body = card.slice(card.indexOf('const JARGON'), card.indexOf('const activeIndex'))
    const brief = new Function(`${body}; return brief`)()
    assert.equal(brief('用机器学习开发文本系统。岗位是这个技能对应的核心工作。'), '用机器学习开发文本系统。')
    // Older texts: sentences with internal numbers or codes are skipped, nothing shown when all have them
    assert.equal(brief('基础份额最大（34%）。你要能自己讲清 TF-IDF 和词袋。'), '你要能自己讲清 TF-IDF 和词袋。')
    assert.equal(brief('招聘要求 R5（必须，已具备）要求 NLP。项目模型也排在前面（温和情景 +5.2）。'), '')
    assert.equal(brief('Foundation share is the largest (34%). Explain TF-IDF in your own words.'), 'Explain TF-IDF in your own words.')
    assert.equal(brief('一'.repeat(60)).length, 40)
    assert.equal(brief('Use SQL to answer questions. Then more.'), 'Use SQL to answer questions.')
    assert.ok(brief('word '.repeat(40)).length <= 90)
})

test('a task links the resource it picked, falls back to the first, and nothing for prompt-only skills', () =>
{
    const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
    const taskResource = new Function('esc', `return function ${method('taskResource').trim()}`)(esc)
    const ui = { state: { skillDetails: { sql: { resources: [ { title: 'First', url: 'https://a.example/' }, { title: 'Second', url: 'https://b.example/' } ] }, auditing: { resources: [] } } } }
    assert.match(taskResource.call(ui, { skillId: 'sql', resourceIndex: 1 }), /href="https:\/\/b\.example\/"[^>]*target="_blank"[^>]*>📖 Second ↗/)
    assert.match(taskResource.call(ui, { skillId: 'sql', resourceIndex: 7 }), /First/)
    assert.match(taskResource.call(ui, { skillId: 'sql' }), /First/)
    assert.equal(taskResource.call(ui, { skillId: 'auditing' }), '')
})
