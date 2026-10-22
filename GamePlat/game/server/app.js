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
import { getCareer, useCustom } from './careers.js'
import * as store from './store.js'

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

    'POST /api/integrations/chat': async (save, body) =>
    {
        if(!integrations.CHANNELS.includes(body.channel))
            throw new HttpError(400, 'bad-channel')
        const content = text(body.text, 2000).trim()
        if(!content)
            throw new HttpError(400, 'empty')
        if(!save.roadmap)
            return { log: null, reply: { zh: '先在游戏里生成学习路线，我才能把汇报对应到任务。', en: 'Plan a roadmap in the game first so I can match your reports to tasks.', ms: 'Rancang peta laluan dalam permainan dahulu supaya laporan boleh dipadankan dengan tugasan.' }[lang(save, body)] }
        const classification = await features.classifyLog({ text: content, roadmap: save.roadmap, lang: lang(save, body) })
        const log = game.applyLog(save, { text: content, source: body.channel, classification })
        return { log, reply: classification.reply }
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
 * Returns true when the request was an /api route (handled), false to let the caller continue
 */
export async function handle(request, response)
{
    const url = new URL(request.url, 'http://localhost')
    if(!url.pathname.startsWith('/api/'))
        return false

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
            if(url.pathname === '/api/reset')
            {
                const result = await route()
                const save = store.load()
                useCustom(save)
                return { result, save }
            }

            const save = store.load()
            useCustom(save)
            const result = await ai.demo.run(!integration && body.demo === true, () => route(save, body)) ?? {}
            if(request.method === 'POST')
                store.save(save)
            return { result, save }
        })
        // Workflows and bots only need the result, the game client gets the whole state
        send(response, 200, integration ? payload.result : { ...payload.result, state: game.view(payload.save, ai.status()) })
    }
    catch(error)
    {
        if(error instanceof HttpError || error instanceof IntegrationError)
            send(response, error.status, { error: error.code })
        else if(error instanceof AiError)
            send(response, 502, { error: error.code, detail: error.message.slice(0, 300) })
        else
        {
            console.error('[api]', error)
            send(response, 500, { error: 'server' })
        }
    }
    return true
}
