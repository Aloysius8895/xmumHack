import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// Isolated save directory and demo AI, before the server modules read them
process.env.SAVE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'career-log-verdict-'))
process.env.AI_MOCK = '1'

const { classifyLog } = await import('../../../src/game/server/features.js')
const game = await import('../../../src/game/server/game.js')

function save()
{
    return {
        points: 0,
        logs: [],
        roadmap: { stages: [ { id: 's1', title: 'SQL', tasks: [ { id: 't1', title: 'SQL basics', skillId: 'sql', mp: 6, progress: 0 } ] } ] },
    }
}

async function log(target, text)
{
    const classification = await classifyLog({ text, roadmap: target.roadmap, lang: 'zh' })
    return game.applyLog(target, { text, source: 'web', classification })
}

test('greetings, random keys and off-topic logs never move the roadmap', async () =>
{
    const target = save()
    for(const text of [ '你好', 'asdfasdfasdf', 'aaaaaaaaaa', '今天天气很好我去吃饭了' ])
    {
        const entry = await log(target, text)
        assert.equal(entry.verdict, 'invalid', text)
        assert.deepEqual(entry.advanced, [], text)
    }
    assert.equal(target.roadmap.stages[0].tasks[0].progress, 0)
    assert.equal(target.points, 0)
})

test('a skill named without saying what was done is too vague to count', async () =>
{
    const target = save()
    const entry = await log(target, '今天 SQL 查询')
    assert.equal(entry.verdict, 'vague')
    assert.equal(target.roadmap.stages[0].tasks[0].progress, 0)
})

test('a concrete learning log advances its task and scores', async () =>
{
    const target = save()
    const entry = await log(target, '今天学了 2 小时 SQL 查询，做了 3 道练习')
    assert.equal(entry.verdict, 'learned')
    assert.equal(entry.advanced.length, 1)
    assert.equal(target.roadmap.stages[0].tasks[0].progress, 33)
    assert.equal(entry.advanced[0].taskTitle, 'SQL basics')
    assert.equal(entry.advanced[0].skillId, 'sql')
    assert.equal(entry.advanced[0].hours, 2)
    assert.ok(target.points > 0)
})

test('unmatched concrete study stays recorded without inventing progress or points', () =>
{
    const target = save()
    const entry = game.applyLog(target, { text: 'Trained a scikit-learn model for 2 hours', source: 'telegram', classification: {
        verdict: 'learned', summary: 'ML frameworks do not match this SQL roadmap.', items: [{ taskId: 'none', skillId: 'ml-frameworks', hours: 2 }],
    } })
    assert.equal(entry.points, 0)
    assert.deepEqual(entry.advanced, [])
    assert.equal(target.logs[0], entry)
    assert.equal(target.roadmap.stages[0].tasks[0].progress, 0)
})

test('items of a log the AI judged vague or invalid are ignored anyway', () =>
{
    const target = save()
    const entry = game.applyLog(target, { text: 'hello there', source: 'web', classification: { verdict: 'invalid', summary: '', items: [ { taskId: 't1', skillId: 'sql', hours: 5 } ], reply: '' } })
    assert.deepEqual(entry.advanced, [])
    assert.deepEqual(entry.skillIds, [])
})
