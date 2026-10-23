import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { normalizeTelegram, yesterdayInMalaysia } from './pipeline.js'
import { buildTelegramWorkflow, buildDigestWorkflow } from './build-workflows.mjs'

const settings = { chatbotBaseUrl: 'http://localhost:8000/', ownerTelegramId: '123' }
const message = { message_id: 2, from: { id: 123 }, chat: { type: 'private', id: 123 }, text: '练习 SQL 两小时' }

test('Telegram ingress keeps original IDs, text and callbacks; attachments do not become reports', () =>
{
    const update = { update_id: 10, message }
    const result = normalizeTelegram(update, settings)
    assert.equal(result.kind, 'text')
    assert.equal(result.eventId, 'tg:10')
    assert.equal(result.chatbotBaseUrl, 'http://localhost:8000')
    assert.deepEqual(result.update, update)
    assert.equal(normalizeTelegram({ update_id: 11, callback_query: { from: { id: 123 }, message, data: 'report_yes' } }, settings).kind, 'callback')
    assert.equal(normalizeTelegram({ update_id: 12, message: { ...message, text: undefined, photo: [] } }, settings).kind, 'attachment')
})

test('private demo owner is required; edits, groups, other users and malformed updates are ignored', () =>
{
    assert.throws(() => normalizeTelegram({}, { ...settings, ownerTelegramId: '' }), /single demo owner/)
    assert.equal(normalizeTelegram({ update_id: 1, edited_message: message }, settings), null)
    assert.equal(normalizeTelegram({ update_id: 1, message: { ...message, chat: { type: 'group' } } }, settings), null)
    assert.equal(normalizeTelegram({ update_id: 1, message: { ...message, from: { id: 456 } } }, settings), null)
    assert.equal(normalizeTelegram({ message }, settings), null)
})

test('daily date uses yesterday in Malaysia across UTC, month and year boundaries', () =>
{
    assert.equal(yesterdayInMalaysia(new Date('2026-10-23T16:05:00Z')), '2026-10-23')
    assert.equal(yesterdayInMalaysia(new Date('2026-10-31T16:05:00Z')), '2026-10-31')
    assert.equal(yesterdayInMalaysia(new Date('2026-12-31T16:05:00Z')), '2026-12-31')
})

test('exports are deterministic and Code nodes execute inside the n8n function sandbox', () =>
{
    for(const [ filename, workflow ] of [ [ 'telegram-learning.workflow.json', buildTelegramWorkflow() ], [ 'daily-digest.workflow.json', buildDigestWorkflow() ] ])
    {
        assert.deepEqual(JSON.parse(fs.readFileSync(new URL(filename, import.meta.url), 'utf8')), workflow)
        assert.equal(workflow.settings.timezone, 'Asia/Kuala_Lumpur')
        assert.equal(workflow.active, false)
        const names = new Set(workflow.nodes.map((node) => node.name))
        for(const output of Object.values(workflow.connections))
            for(const edge of output.main.flat())
                assert.ok(names.has(edge.node))
        for(const node of workflow.nodes.filter((node) => node.type.endsWith('.code')))
            assert.doesNotThrow(() => new Function('$input', '$', node.parameters.jsCode))
    }
    const workflow = buildTelegramWorkflow()
    const code = workflow.nodes.find((node) => node.name === 'Normalize private update').parameters.jsCode.replace('"ownerTelegramId": ""', '"ownerTelegramId": "123"')
    const run = new Function('$input', code)
    const result = run({ all: () => [ { json: { update_id: 1, message } } ] })
    assert.equal(result[0].json.kind, 'text')
    const daily = buildDigestWorkflow().nodes.find((node) => node.name === 'Yesterday and owner').parameters.jsCode.replace('"ownerTelegramId": ""', '"ownerTelegramId": "123"')
    assert.match(new Function(daily)()[0].json.date, /^\d{4}-\d{2}-\d{2}$/)
})
