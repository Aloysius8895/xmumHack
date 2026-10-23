/**
 * /api routes, usable as a Vite middleware (npm run dev) or by server/index.js (production)
 *
 * Requests that change the save run one at a time so a slow AI call can't overwrite another update
 */
import * as ai from './ai.js'
import { AiError } from './ai.js'
import * as features from './features.js'
import * as friends from './friends.js'
import * as game from './game.js'
import * as integrations from './integrations.js'
import { IntegrationError } from './integrations.js'
import * as trends from './trends.js'
import * as persistence from './persistence.js'
import { getCareer, useCustom } from './careers.js'
import { expertCard } from './experts.js'
import { telegramExpert, expertReceipt } from './telegram-expert.js'
import * as store from './store.js'
import { createHash } from 'node:crypto'

const MAX_BODY = 15 * 1024 * 1024 // base64 of a 10 MB file
const MAX_FILE = 10 * 1024 * 1024
const FILE_TYPES = [ 'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'text/plain', 'text/markdown' ]
const LANGS = [ 'zh', 'en', 'ms' ]

class HttpError extends Error
{
    constructor(status, code)
    {
        super(code)
        this.status = status
        this.code = code
    }
}

let queue = Promise.resolve()
function exclusive(task)
{
    const run = queue.then(task, task)
    queue = run.catch(() => {})
    return run
}

function readBody(request)
{
    return new Promise((resolve, reject) =>
    {
        let size = 0
        const chunks = []
        request.on('data', (chunk) =>
        {
            size += chunk.length
            if(size > MAX_BODY)
            {
                reject(new HttpError(413, 'too-large'))
                request.destroy()
                return
            }
            chunks.push(chunk)
        })
        request.on('end', () =>
        {
            if(!chunks.length)
                return resolve({})
            try
            {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
            }
            catch
            {
                reject(new HttpError(400, 'bad-json'))
            }
        })
        request.on('error', reject)
    })
}

function checkFile(file)
{
    if(!file)
        return null
    if(typeof file.data !== 'string' || typeof file.mediaType !== 'string')
        throw new HttpError(400, 'bad-file')
    if(!FILE_TYPES.includes(file.mediaType))
        throw new HttpError(415, 'file-type')
    if(Buffer.byteLength(file.data, 'base64') > MAX_FILE)
        throw new HttpError(413, 'file-too-large')
    return { name: String(file.name ?? 'file').slice(0, 120), mediaType: file.mediaType, data: file.data }
}

function text(value, max = 8000)
{
    return typeof value === 'string' ? value.slice(0, max) : ''
}

function lang(save, body)
{
    return LANGS.includes(body.lang) ? body.lang : save.lang
}

function mytDate()
{
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date())
}

function cloudCommit(path, body, result, save)
{
    if(path === '/api/integrations/expert')
    {
        const receipt = expertReceipt(save, body)
        return { operation: 'save', metadata: { idempotencyKey: `expert:${receipt.key}`, fingerprint: receipt.fingerprint, result } }
    }
    if(path === '/api/integrations/chat')
    {
        if(!body.messageId)
            throw new HttpError(400, 'bad-message-id')
        const content = text(body.text, 2000).trim()
        const receipt = integrations.chatReceipt(save, body, content)
        return {
            operation: 'chat',
            metadata: {
                idempotencyKey: `chat:${receipt.key}`,
                fingerprint: receipt.fingerprint,
                result,
                report: {
                    eventId: body.messageId,
                    userId: body.from,
                    channel: body.channel,
                    date: mytDate(),
                    text: content,
                    log: result.log,
                },
            },
        }
    }
    if(path === '/api/integrations/digest')
    {
        const date = String(body.date ?? mytDate()).slice(0, 10)
        return {
            operation: 'digest',
            metadata: {
                idempotencyKey: `digest:${date}`,
                fingerprint: createHash('sha256').update(date).digest('hex'),
                result,
                // The changes applyDigest kept (known skills, clamped 0-100), not the raw
                // agent input: AWS rejects unknown ids and large deltas that local mode skips or clamps
                digest: {
                    date,
                    summary: String(body.summary ?? ''),
                    skills: (result.digest?.skills ?? []).map((item) => ({ skillId: item.skillId, mastery: item.to })),
                    summaryOnly: body.summaryOnly === true,
                },
            },
        }
    }
    return { operation: 'save', metadata: { result } }
}

/**
 * The mentor question of a request, checked: career, question, earlier turns, attached file, elite or mentor
 */
function mentorQuestion(save, body)
{
    const career = getCareer(String(body.careerId ?? ''))
    if(!career)
        throw new HttpError(404, 'no-career')
    if(body.elite && !expertCard(career.id))
        throw new HttpError(404, 'no-expert')
    const question = text(body.question, 500).trim()
    if(!question)
        throw new HttpError(400, 'no-question')
    // Earlier turns of this conversation: user / assistant alternating, starting with the user
    const history = (Array.isArray(body.history) ? body.history : [])
        .filter((turn) => [ 'user', 'assistant' ].includes(turn?.role) && typeof turn.content === 'string' && turn.content.trim())
        .slice(- 6)
    while(history.length && history[0].role !== 'user')
        history.shift()
    const file = checkFile(body.file) // A screenshot, PDF or text file the player attached or pasted
    // elite: the question goes to the career's distilled industry elite instead of the mentor (experts.js)
    return { career, question, file, history, elite: Boolean(body.elite), profile: save.profile, target: save.target, lang: lang(save, body) }
}

const routes = {
    'GET /api/state': async () =>
    {
        return { ok: true }
    },

    'POST /api/lang': async (save, body) =>
    {
        if(!LANGS.includes(body.lang))
            throw new HttpError(400, 'bad-lang')
        save.lang = body.lang
    },

    'POST /api/profile/extract': async (save, body) =>
    {
        const file = checkFile(body.file)
        if(!text(body.text).trim() && !file)
            throw new HttpError(400, 'empty')
        const result = await features.extractSkills({ text: text(body.text), file, lang: lang(save, body) })
        game.mergeSkills(save.profile, result.skills)
        save.profile.summary = result.summary
        return { summary: result.summary, found: result.skills.length }
    },

    'POST /api/profile/skills': async (save, body) =>
    {
        if(!Array.isArray(body.skills))
            throw new HttpError(400, 'bad-skills')
        game.setSkills(save.profile, body.skills)
    },

    /**
     * A career without a mentor on the map needs replace: true (the player confirmed the swap, see game.replaceCandidate).
     * A posting that fits another career (or none of the catalog) waits in save.pendingTarget for /api/target/resolve
     */
    'POST /api/target': async (save, body) =>
    {
        if(!getCareer(body.careerId))
            throw new HttpError(400, 'bad-career')
        if(!game.isOnMap(save, body.careerId) && body.replace !== true)
            throw new HttpError(409, 'not-on-map')
        const mode = body.mode === 'customise' ? 'customise' : 'general'
        let posting = null
        if(mode === 'customise')
        {
            const file = checkFile(body.file)
            if(!text(body.text, 30000).trim() && !file)
                throw new HttpError(400, 'empty-posting')
            const result = await features.analyzePosting({ text: text(body.text, 30000), file, careerId: body.careerId, profile: save.profile, lang: lang(save, body) })
            posting = { ...result, sourceName: file?.name ?? null }

            if(result.suggestedCareerId !== body.careerId)
            {
                const newCareer = result.suggestedCareerId === 'none' ? await features.generateCareer({ posting, lang: lang(save, body) }) : null
                save.pendingTarget = { requestedCareerId: body.careerId, posting, suggestedCareerId: newCareer ? null : result.suggestedCareerId, newCareer, at: new Date().toISOString() }
                return { posting, pending: true }
            }
        }
        const replaced = game.setTarget(save, { careerId: body.careerId, mode, posting })
        return { posting, replaced }
    },

    // choice: 'suggested' (the career the posting fits, swapped onto the map if needed), 'requested' or 'cancel'
    'POST /api/target/resolve': async (save, body) =>
    {
        const pending = save.pendingTarget
        if(!pending)
            throw new HttpError(409, 'no-pending')
        if(body.choice === 'cancel')
        {
            save.pendingTarget = null
            return { careerId: null }
        }
        if(body.choice !== 'suggested' && body.choice !== 'requested')
            throw new HttpError(400, 'bad-choice')

        const careerId = body.choice === 'requested' ? pending.requestedCareerId
            : pending.newCareer ? game.addCustomCareer(save, pending.newCareer).id
            : pending.suggestedCareerId
        const replaced = game.setTarget(save, { careerId, mode: 'customise', posting: pending.posting })
        return { careerId, replaced }
    },

    // Career the search didn't find, generated by the AI and added to this save's catalog
    'POST /api/careers/generate': async (save, body) =>
    {
        const query = text(body.query, 120).trim()
        if(!query)
            throw new HttpError(400, 'empty')
        const spec = await features.generateCareer({ query, lang: lang(save, body) })
        return { careerId: game.addCustomCareer(save, spec).id }
    },

    'POST /api/roadmap': async (save, body) =>
    {
        if(!save.target)
            throw new HttpError(409, 'no-target')
        const plan = await features.generateRoadmap({ target: save.target, profile: save.profile, gaps: game.gapsFor(save), lang: lang(save, body) })
        save.roadmap = game.buildRoadmap(plan)
    },

    // A career mentor NPC answers the player's own question as a professional of that field, or hands over to the
    // field's distilled industry elite (features.askMentor). The game dialogue uses the streamed version (streams below)
    'POST /api/npc/ask': async (save, body) =>
    {
        const answer = await features.askMentor(mentorQuestion(save, body))
        return { answer }
    },

    'POST /api/task': async (save, body) =>
    {
        if(!game.setTaskDone(save, String(body.taskId), Boolean(body.done)))
            throw new HttpError(404, 'no-task')
    },

    'POST /api/stage/unlock': async (save, body) =>
    {
        if(!game.forceStage(save, String(body.stageId)))
            throw new HttpError(404, 'no-stage')
    },

    'POST /api/log': async (save, body) =>
    {
        const content = text(body.text, 2000).trim()
        if(!content)
            throw new HttpError(400, 'empty')
        if(!save.roadmap)
            throw new HttpError(409, 'no-roadmap')
        const classification = await features.classifyLog({ text: content, roadmap: save.roadmap, lang: lang(save, body) })
        const log = game.applyLog(save, { text: content, source: [ 'web', 'telegram', 'whatsapp' ].includes(body.source) ? body.source : 'web', classification })
        return { log, reply: classification.reply }
    },

    'POST /api/player': async (save, body) =>
    {
        const name = friends.cleanName(body.name)
        if(!name)
            throw new HttpError(400, 'empty-name')
        save.player.name = name
    },

    'POST /api/friends': async (save, body) =>
    {
        const result = friends.addFriend(save, text(body.code, 2000))
        if(result.startsWith('friend-'))
            throw new HttpError(400, result)
        return { friend: result }
    },

    'POST /api/friends/remove': async (save, body) =>
    {
        if(!friends.removeFriend(save, String(body.id)))
            throw new HttpError(404, 'no-friend')
    },

    /**
     * Outside workflows (server/integrations.js), Authorization: Bearer INTEGRATION_TOKEN
     */
    'POST /api/integrations/market': async (save, body) =>
    {
        return integrations.receiveMarket(body)
    },

    // Monthly job ads per career and skill shares for the trends panel (server/trends.js)
    'POST /api/integrations/trends': async (save, body) =>
    {
        return trends.receiveTrends(body, IntegrationError)
    },

    'POST /api/integrations/expert': (save, body) => telegramExpert(save, body),

    'POST /api/integrations/chat': async (save, body) =>
    {
        if(!integrations.CHANNELS.includes(body.channel))
            throw new HttpError(400, 'bad-channel')
        const content = text(body.text, 2000).trim()
        if(!content)
            throw new HttpError(400, 'empty')
        const receipt = integrations.chatReceipt(save, body, content)
        if(receipt?.previous)
            return { ...receipt.previous, duplicate: true }
        if(!save.roadmap)
            return { log: null, reply: { zh: '先在游戏里生成学习路线，我才能把汇报对应到任务。', en: 'Plan a roadmap in the game first so I can match your reports to tasks.', ms: 'Rancang peta laluan dalam permainan dahulu supaya laporan boleh dipadankan dengan tugasan.' }[lang(save, body)] }
        const classification = await features.classifyLog({ text: content, roadmap: save.roadmap, lang: lang(save, body) })
        const log = game.applyLog(save, { text: content, source: body.channel, classification })
        return integrations.rememberChat(save, receipt, { log, reply: classification.reply })
    },

    'POST /api/integrations/digest': async (save, body) =>
    {
        return { digest: integrations.applyDigest(save, body) }
    },

    'POST /api/reset': async () =>
    {
        store.reset()
        return { reset: true }
    },
}

function send(response, status, payload)
{
    response.statusCode = status
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.end(JSON.stringify(payload))
}

/**
 * Streamed routes: newline-delimited JSON events while the answer comes, { text } pieces then { answer } or { error }.
 * They only read the save, so they run outside the save queue (a long answer doesn't hold the other requests)
 */
const streams = {
    'POST /api/npc/ask/stream': (save, body, emit, signal) => features.askMentor({ ...mentorQuestion(save, body), onText: (text) => emit({ text }), signal }),
}

async function stream(request, response, route)
{
    let started = false
    const emit = (event) =>
    {
        if(!started)
        {
            started = true
            response.statusCode = 200
            response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
            response.setHeader('Cache-Control', 'no-store')
            response.setHeader('X-Accel-Buffering', 'no') // Proxies pass each line on at once
        }
        response.write(JSON.stringify(event) + '\n')
    }
    // Dialogue closed meanwhile: stop the AI call instead of paying for an answer nobody reads
    const aborter = new AbortController()
    response.on('close', () =>
    {
        if(!response.writableEnded)
            aborter.abort()
    })

    try
    {
        const body = await readBody(request)
        const loaded = await persistence.loadSave()
        const save = loaded.state
        useCustom(save)
        const answer = await ai.demo.run(body.demo === true, () => route(save, body, emit, aborter.signal))
        emit({ answer })
        response.end()
    }
    catch(error)
    {
        if(aborter.signal.aborted)
            return
        const code = error instanceof HttpError || error instanceof AiError ? error.code : 'server'
        if(code === 'server')
            console.error('[api]', error)
        if(!started)
            return send(response,
                error instanceof HttpError ? error.status : error instanceof AiError ? 502 : error?.name === 'AwsBackendError' ? error.status ?? 502 : 500,
                { error: code })
        emit({ error: code })
        response.end()
    }
}

/**
 * Returns true when the request was an /api route (handled), false to let the caller continue
 */
export async function handle(request, response)
{
    const url = new URL(request.url, 'http://localhost')
    if(!url.pathname.startsWith('/api/'))
        return false

    const streamed = streams[`${request.method} ${url.pathname}`]
    if(streamed)
    {
        await stream(request, response, streamed)
        return true
    }

    const route = routes[`${request.method} ${url.pathname}`]
    if(!route)
    {
        send(response, 404, { error: 'not-found' })
        return true
    }

    const integration = url.pathname.startsWith('/api/integrations/')

    try
    {
        if(integration)
            integrations.authorize(request)

        const body = request.method === 'POST' ? await readBody(request) : {}
        const payload = await exclusive(async () =>
        {
            const loaded = await persistence.loadSave()
            if(url.pathname === '/api/reset')
            {
                const save = store.createSave()
                useCustom(save)
                const result = { reset: true }
                if(persistence.cloudEnabled())
                    await persistence.commitSave(save, loaded.version, 'save', { result })
                else
                    store.reset()
                return { result, save }
            }

            const save = loaded.state
            useCustom(save)
            // Postings customised before their "other" requirements became pet skills
            game.adoptPostingSkills(save)
            let result = await ai.demo.run(!integration && body.demo === true, () => route(save, body)) ?? {}
            if(request.method === 'POST')
            {
                if(persistence.cloudEnabled())
                {
                    const commit = cloudCommit(url.pathname, body, result, save)
                    const saved = await persistence.commitSave(save, loaded.version, commit.operation, commit.metadata)
                    result = saved.result ?? result
                }
                else
                    store.save(save)
            }
            return { result, save }
        })
        // Workflows and bots only need the result, the game client gets the whole state
        if(integration)
            send(response, 200, payload.result)
        else
        {
            const [ market, trends ] = await Promise.all([
                persistence.loadDocument('market'),
                persistence.loadDocument('trends'),
            ])
            send(response, 200, { ...payload.result, state: game.view(payload.save, ai.status(), { market: market.payload, trends: trends.payload }) })
        }
    }
    catch(error)
    {
        if(error instanceof HttpError || error instanceof IntegrationError)
            send(response, error.status, { error: error.code })
        else if(error instanceof AiError)
            send(response, 502, { error: error.code, detail: error.message.slice(0, 300) })
        else if(error?.name === 'AwsBackendError')
            send(response, error.status ?? 502, { error: error.code })
        else
        {
            console.error('[api]', error)
            send(response, 500, { error: 'server' })
        }
    }
    return true
}
