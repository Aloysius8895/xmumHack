import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEARNING_SETTINGS } from './pipeline.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const library = () => fs.readFileSync(path.join(here, 'pipeline.js'), 'utf8').replace(/\r\n/g, '\n').replace(/^export /gm, '')
const id = (name) => crypto.createHash('md5').update(`career-learning:${name}`).digest('hex')
const node = (name, type, position, parameters, extra = {}) => ({ id: id(name), name, type: `n8n-nodes-base.${type}`, typeVersion: { code: 2, httpRequest: 4.2, telegramTrigger: 1.2, if: 2.2, scheduleTrigger: 1.2 }[type] ?? 1, position, parameters, ...extra })
const link = (name) => ({ node: name, type: 'main', index: 0 })
const next = (name) => ({ main: [ [ link(name) ] ] })
const bool = (name, expression) => ({ conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [ { id: id(name), leftValue: expression, rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } } ], combinator: 'and' } })
const base = (name, nodes, connections) => ({ name, nodes, connections, active: false, settings: { executionOrder: 'v1', timezone: 'Asia/Kuala_Lumpur' }, pinData: {}, meta: { templateCredsSetupCompleted: false }, tags: [] })

export function buildTelegramWorkflow()
{
    return base('CareerSphere: Telegram learning reports (existing chatbot)', [
        node('Setup: Telegram bridge', 'stickyNote', [ -40, -300 ], { width: 1480, height: 260, content: '## Telegram → existing CareerSphere chatbot\nInspired by template #9254. This game has ONE local player. Set `ownerTelegramId` in Normalize private update and the SAME single ID in chatbot `TELEGRAM_ALLOWED_USER_IDS`.\n\n1. Select a Telegram credential in Telegram updates. 2. Set chatbotBaseUrl. 3. Select Header Auth in Forward to existing chatbot: `X-Telegram-Bot-Api-Secret-Token` = chatbot `TELEGRAM_WEBHOOK_SECRET`.\n\nSet AI_PROVIDER=deepseek, DEEPSEEK_API_KEY and DEEPSEEK_MODEL=deepseek-flash in BOTH chatbot and game server Secrets (same key); restart both services. The key never belongs in workflow JSON.\n\nChatbot handles classification, confirmation buttons, POST /api/integrations/chat, persistence and replies. n8n does not send a second reply. Attachments receive the existing text-only response. Only one Telegram webhook per bot: activating this workflow replaces the direct Python webhook. Keep chatbot TELEGRAM_BOT_TOKEN set for replies. Public HTTPS WEBHOOK_URL required for n8n.' }),
        node('Telegram updates', 'telegramTrigger', [ 0, 40 ], { updates: [ 'message', 'callback_query' ], additionalFields: {} }, { webhookId: id('telegram-webhook') }),
        node('Normalize private update', 'code', [ 240, 40 ], { jsCode: `const SETTINGS = ${JSON.stringify(LEARNING_SETTINGS, null, 4)}\n${library()}\nreturn $input.all().flatMap(item => { const data = normalizeTelegram(item.json, SETTINGS); return data ? [{json: data}] : []; });` }),
        node('Text report?', 'if', [ 480, 40 ], bool('text', "={{ $json.kind === 'text' }}")),
        node('Text and commands', 'noOp', [ 720, -60 ], {}),
        node('Confirmation callback?', 'if', [ 720, 160 ], bool('callback', "={{ $json.kind === 'callback' }}")),
        node('Confirmation buttons', 'noOp', [ 960, 100 ], {}),
        node('Attachment: text-only reply', 'noOp', [ 960, 300 ], {}),
        node('Forward to existing chatbot', 'httpRequest', [ 1200, 40 ], {
            method: 'POST', url: '={{ $json.chatbotBaseUrl }}/internal/n8n/telegram', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
            sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.update) }}', options: { timeout: 300000 },
        }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
        node('Bridge result (chatbot sends reply)', 'code', [ 1440, 40 ], { jsCode: "return $input.all().map(item => ({json: {status: item.json.status, replyHandledBy: item.json.replyHandledBy, note: 'The existing chatbot classifies messages, calls the game API and sends Telegram replies.'}}));" }),
    ], {
        'Telegram updates': next('Normalize private update'), 'Normalize private update': next('Text report?'),
        'Text report?': { main: [ [ link('Text and commands') ], [ link('Confirmation callback?') ] ] },
        'Text and commands': next('Forward to existing chatbot'),
        'Confirmation callback?': { main: [ [ link('Confirmation buttons') ], [ link('Attachment: text-only reply') ] ] },
        'Confirmation buttons': next('Forward to existing chatbot'), 'Attachment: text-only reply': next('Forward to existing chatbot'),
        'Forward to existing chatbot': next('Bridge result (chatbot sends reply)'),
    })
}

export function buildDigestWorkflow()
{
    return base('CareerSphere: yesterday learning digest (summary only)', [
        node('Setup: daily digest', 'stickyNote', [ -40, -300 ], { width: 1260, height: 260, content: '## Yesterday\'s real reports → daily summary\nDaily 00:05 Asia/Kuala_Lumpur, or manually. Set chatbotBaseUrl and ownerTelegramId in Yesterday and owner.\n\nSelect Header Auth in Build summary from accepted reports: `X-Cron-Token` = chatbot `CRON_TOKEN`. Set chatbot `DIGEST_SCHEDULE_ENABLED=false` so only n8n schedules digests. The SAME single Telegram owner must be in chatbot TELEGRAM_ALLOWED_USER_IDS.\n\nUses the EXISTING /internal/digest/run endpoint with summary_only=true. It selects this owner\'s accepted reports from yesterday, quotes the actual text, and sends POST /api/integrations/digest with skills: []. No second AI, invented evidence, mastery delta or extra points. Empty days skip. Game deduplicates each date.' }),
        node('Every day 00:05 MYT', 'scheduleTrigger', [ 0, 0 ], { rule: { interval: [ { field: 'cronExpression', expression: '5 0 * * *' } ] } }),
        node('Run yesterday now', 'manualTrigger', [ 0, 200 ], {}),
        node('Yesterday and owner', 'code', [ 260, 80 ], { jsCode: `const SETTINGS = ${JSON.stringify(LEARNING_SETTINGS, null, 4)}\n${library()}\nif(!/^\\d+$/.test(String(SETTINGS.ownerTelegramId))) throw new Error('Set ownerTelegramId to the single demo owner.');\nreturn [{json: {...SETTINGS, chatbotBaseUrl: SETTINGS.chatbotBaseUrl.replace(/\\/+$/, ''), date: yesterdayInMalaysia()}}];` }),
        node('Build summary from accepted reports', 'httpRequest', [ 520, 80 ], {
            method: 'POST', url: '={{ $json.chatbotBaseUrl }}/internal/digest/run', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
            sendQuery: true, queryParameters: { parameters: [ { name: 'date', value: '={{ $json.date }}' }, { name: 'summary_only', value: 'true' }, { name: 'telegram_user_id', value: '={{ $json.ownerTelegramId }}' } ] }, options: { timeout: 60000 },
        }, { retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
        node('Digest run summary', 'code', [ 780, 80 ], { jsCode: "const response = $input.first().json; return [{json: {date: $('Yesterday and owner').first().json.date, status: response.ran ? 'saved-or-already-saved' : 'skipped-no-reports', summaryOnly: true, result: response.result}}];" }),
    ], { 'Every day 00:05 MYT': next('Yesterday and owner'), 'Run yesterday now': next('Yesterday and owner'), 'Yesterday and owner': next('Build summary from accepted reports'), 'Build summary from accepted reports': next('Digest run summary') })
}

export function writeLearningWorkflows()
{
    for(const [ name, workflow ] of [ [ 'telegram-learning.workflow.json', buildTelegramWorkflow() ], [ 'daily-digest.workflow.json', buildDigestWorkflow() ] ])
        fs.writeFileSync(path.join(here, name), JSON.stringify(workflow, null, 2) + '\n')
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    writeLearningWorkflows()
