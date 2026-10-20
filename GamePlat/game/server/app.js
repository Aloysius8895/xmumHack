/**
 * /api routes, usable as a Vite middleware (npm run dev) or by server/index.js (production)
 *
 * Requests that change the save run one at a time so a slow AI call can't overwrite another update
 */
import * as ai from './ai.js'
import { AiError } from './ai.js'
import * as features from './features.js'
import * as game from './game.js'
import { getCareer } from './careers.js'
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

    'POST /api/target': async (save, body) =>
    {
        if(!getCareer(body.careerId))
            throw new HttpError(400, 'bad-career')
        const mode = body.mode === 'customise' ? 'customise' : 'general'
        let posting = null
        if(mode === 'customise')
        {
            const file = checkFile(body.file)
            if(!text(body.text, 30000).trim() && !file)
                throw new HttpError(400, 'empty-posting')
            const result = await features.analyzePosting({ text: text(body.text, 30000), file, careerId: body.careerId, profile: save.profile, lang: lang(save, body) })
            posting = { ...result, sourceName: file?.name ?? null }
        }
        game.setTarget(save, { careerId: body.careerId, mode, posting })
        return { posting }
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

    'POST /api/gym/start': async (save, body) =>
    {
        const check = game.canChallenge(save, String(body.stageId))
        if(!check.ok)
            throw new HttpError(409, check.reason)
        const result = await features.createChallenge({ stage: check.stage, target: save.target, lang: lang(save, body) })
        const challenge = game.startChallenge(save, check.stage, result.questions)
        return { challengeId: challenge.id }
    },

    'POST /api/gym/submit': async (save, body) =>
    {
        const challenge = save.challenges.find((item) => item.id === body.challengeId && !item.result)
        if(!challenge)
            throw new HttpError(404, 'no-challenge')
        const answers = challenge.questions.map((_, index) => text(body.answers?.[index], 3000))
        const stage = save.roadmap?.stages.find((item) => item.id === challenge.stageId)
        if(!stage)
            throw new HttpError(409, 'no-stage')
        const grading = await features.gradeChallenge({ stage, questions: challenge.questions, answers, lang: lang(save, body) })
        return { result: game.finishChallenge(save, challenge, grading, answers) }
    },

    'POST /api/gym/abandon': async (save, body) =>
    {
        save.challenges = save.challenges.filter((item) => item.result || item.id !== body.challengeId)
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

    try
    {
        const body = request.method === 'POST' ? await readBody(request) : {}
        const payload = await exclusive(async () =>
        {
            if(url.pathname === '/api/reset')
                return { result: await route() , save: store.load() }

            const save = store.load()
            const result = await route(save, body) ?? {}
            if(request.method === 'POST')
                store.save(save)
            return { result, save }
        })
        send(response, 200, { ...payload.result, state: game.view(payload.save, ai.status()) })
    }
    catch(error)
    {
        if(error instanceof HttpError)
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
