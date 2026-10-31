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
import * as live from './live.js'
import { createHash } from 'node:crypto'
import { collectedMarket, watchCollectedMarket } from './collected-market.js'
import { attachPostingWatch, checkPostings, acceptPostingRevision, PostingWatchError } from './posting-watch.js'
import { marketCollector, CollectionError } from './market-collection.js'
import { receiveCrawler, CrawlerError } from './crawler-ingestion.js'
import { crawlerStatus } from './crawler-market.js'
import { sampleRefresh, RefreshError } from './crawler-refresh.js'
import { knownListings, loadWindow, refreshIfStale } from './market-window.js'
import * as scenarios from './scenarios.js'
import { noRegretSkeleton, presetOf, skeletonStages } from './no-regret.js'
import { snapshot, updateLog } from './update-log.js'
import { localizePostingSkills } from './posting-skill-localization.js'

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

function displayLanguage(save, request, body)
{
    return lang(save, { lang: LANGS.includes(body.lang) ? body.lang : request.headers['x-career-lang'] })
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
    'GET /api/integrations/market/collection': async () => marketCollector.status(),

    // Future scenario: a preset name, or explicit { k, H } inside the limits (scenarios.js)
    'POST /api/scenario': async (save, body) =>
    {
        if(body.preset !== undefined)
        {
            if(!scenarios.PRESETS[body.preset])
                throw new HttpError(400, 'bad-scenario')
            save.scenario = { preset: body.preset }
        }
        else if(scenarios.validParams(body))
            save.scenario = { k: body.k, H: body.H }
        else
            throw new HttpError(400, 'bad-scenario')
        // The roadmap holds both branches: it follows the scenario unless the player picked a branch
        if(save.roadmap?.chosenBranch && save.roadmap.branchChosenBy !== 'player')
            save.roadmap.chosenBranch = presetOf(scenarios.scenarioOf(save))
        return { scenario: scenarios.scenarioOf(save) }
    },
    'GET /api/forecast': async (save) => ({ forecast: scenarios.forecast(save), compare: scenarios.compare(save) }),
    'GET /api/update-log': async (save) => ({ updateLog: updateLog(save, scenarios.forecast(save)) }),
    // Marks the changes as read: the next log compares with the data as it is now
    'POST /api/update-log/seen': async (save) =>
    {
        save.dataView = snapshot()
        return { updateLog: updateLog(save, scenarios.forecast(save)) }
    },
    // What the player wants to learn, in their words: kept as catalog skills; an empty text clears it
    'POST /api/learning-direction': async (save, body) =>
    {
        if(typeof body.text !== 'string' || body.text.length > 1000)
            throw new HttpError(400, 'bad-learning-direction')
        const text = body.text.trim()
        save.learningDirection = text ? { text, ...await features.mapLearningDirection({ text }), setAt: new Date().toISOString() } : null
        return { learningDirection: save.learningDirection }
    },

    'POST /api/lang': async (save, body) =>
    {
        if(!LANGS.includes(body.lang))
            throw new HttpError(400, 'bad-lang')
        save.lang = body.lang
        try
        {
            return await localizePostingSkills(save, features.translatePostingSkills)
        }
        catch
        {
            // Language selection still works if translation is offline; a later selection retries the repair.
            return { translatedSkills: 0, skillTranslationPending: true }
        }
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
            const sourceUrl = text(body.sourceUrl, 2000).trim()
            if(sourceUrl) posting = attachPostingWatch(posting, sourceUrl)

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
        if(save.target.posting?.monitor?.requiresRegeneration)
            throw new HttpError(409, 'posting-changed-regenerate')
        // No-Regret order (no-regret.js): core skills first, a branch per scenario, skills declining under both last
        const skeleton = noRegretSkeleton(save)
        const layout = skeleton ? skeletonStages(skeleton) : null
        const plan = await features.generateRoadmap({ target: save.target, profile: save.profile, gaps: game.gapsFor(save), lang: lang(save, body), layout: layout?.length ? layout : null })
        save.roadmap = game.buildRoadmap({ ...plan, chosenBranch: presetOf(scenarios.scenarioOf(save)),
            forecastBasis: skeleton && { core: skeleton.core, branches: skeleton.branches, later: skeleton.later, identical: skeleton.identical } })
    },

    'POST /api/roadmap/branch': async (save, body) =>
    {
        if(!save.roadmap?.chosenBranch)
            throw new HttpError(409, 'no-branches')
        if(!scenarios.PRESETS[body.branch])
            throw new HttpError(400, 'bad-branch')
        save.roadmap.chosenBranch = body.branch
        save.roadmap.branchChosenBy = 'player'
        return { chosenBranch: body.branch }
    },

    'POST /api/target/track': async (save, body) =>
    {
        if(save.target?.mode !== 'customise' || !save.target.posting) throw new HttpError(409, 'no-custom-posting')
        save.target.posting = attachPostingWatch(save.target.posting, text(body.sourceUrl, 2000).trim())
        return { tracking: true }
    },

    'POST /api/roadmap/refresh-posting': async (save, body) =>
    {
        const current = save.target?.posting
        const monitor = current?.monitor
        if(!monitor?.pending || !monitor.requiresRegeneration) throw new HttpError(409, 'no-posting-change')
        if(body.revision !== monitor.pending.hash) throw new HttpError(409, 'posting-revision-stale')
        const updated = await features.analyzePosting({ text: `${monitor.pending.title}\n${monitor.pending.company ?? ''}\n${monitor.pending.description}`, file: null,
            careerId: save.target.careerId, profile: save.profile, lang: lang(save, body) })
        const next = structuredClone(save)
        next.target.posting = { ...updated, sourceName: current.sourceName, sourceUrl: current.sourceUrl, monitor: structuredClone(monitor) }
        game.adoptPostingSkills(next)
        const plan = await features.generateRoadmap({ target: next.target, profile: next.profile, gaps: game.gapsFor(next), lang: lang(save, body) })
        next.roadmap = game.buildRoadmap(plan)
        acceptPostingRevision(next.target.posting)
        Object.assign(save, next)
        return { regenerated: true }
    },

    'POST /api/integrations/jobs/check': async (save) =>
    {
        const result = await checkPostings(save)
        const market = collectedMarket()
        return { ...result, market: market ? { source: market.source, collectedAt: market.collectedAt, postings: market.postings, sample: true } : null }
    },

    'GET /api/integrations/jobs/status': async (save) => ({ ...save.automation?.postingWatch,
        targets: [save.target, ...Object.values(save.careers ?? {}).map(item => item.target)].filter(Boolean).map(target => ({ careerId: target.careerId,
            tracking: Boolean(target.posting?.monitor), status: target.posting?.monitor?.status ?? 'missing_source_url', lastCheckedAt: target.posting?.monitor?.lastCheckedAt ?? null })) }),

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

    // Intro username: a name seen for the first time (case-insensitive) is a new user, who gets the beginner tour
    'POST /api/register': async (save, body) =>
    {
        const name = friends.cleanName(body.name)
        if(!name)
            throw new HttpError(400, 'empty-name')
        const key = name.toLocaleLowerCase()
        save.users ??= []
        const newUser = !save.users.some((user) => user.name.toLocaleLowerCase() === key)
        if(newUser)
            save.users.push({ name, registeredAt: new Date().toISOString() })
        save.player.name = name
        return { newUser }
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
    watchCollectedMarket()
    refreshIfStale()
    const url = new URL(request.url, 'http://localhost')
    if(!url.pathname.startsWith('/api/'))
        return false

    // Collection does not mutate player saves. Keep its multi-minute work outside the player transaction queue.
    const sampleRun=/^\/api\/market\/sample\/([\w-]{1,100})$/.exec(url.pathname)
    if((request.method==='POST'&&url.pathname==='/api/market/sample/refresh')||(request.method==='GET'&&sampleRun))
    {
        try
        {
            const origin=request.headers.origin
            if(origin&&new URL(origin).host!==request.headers.host)throw new HttpError(403,'cross-origin-refresh')
            if(request.method==='POST')
            {
                const body=await readBody(request)
                if(!body||Array.isArray(body)||Object.keys(body).some(key=>!['lang','demo'].includes(key)))throw new HttpError(400,'refresh-body-must-be-empty')
                send(response,202,await sampleRefresh.start())
            }
            else send(response,200,await sampleRefresh.poll(sampleRun[1]))
        }
        catch(error)
        {
            send(response,error instanceof RefreshError||error instanceof HttpError?error.status:500,
                {error:error instanceof RefreshError||error instanceof HttpError?error.code:'crawler-refresh-failed',...(error instanceof RefreshError?error.detail:{})})
        }
        return true
    }

    // The daily workflow (n8n) starts a scheduled collection: incremental like Refresh, never held by its cooldown
    const scheduledRun=/^\/api\/integrations\/crawl\/schedule\/([\w-]{1,100})$/.exec(url.pathname)
    if((request.method==='POST'&&url.pathname==='/api/integrations/crawl/schedule')||(request.method==='GET'&&scheduledRun))
    {
        try
        {
            integrations.authorize(request)
            if(request.method==='POST')send(response,202,await sampleRefresh.start({trigger:'schedule'}))
            else send(response,200,await sampleRefresh.poll(scheduledRun[1]))
        }
        catch(error)
        {
            send(response,error instanceof RefreshError||error instanceof IntegrationError?error.status:500,
                {error:error instanceof RefreshError||error instanceof IntegrationError?error.code:'crawler-schedule-failed'})
        }
        return true
    }

    // What the crawler needs for an incremental run when it is started without it (watermark and known listings)
    if(request.method==='GET'&&url.pathname==='/api/integrations/crawler/state')
    {
        try
        {
            integrations.authorize(request)
            const window=await loadWindow()
            send(response,200,{since:window?.lastSuccessfulCollectionAt??null,known:knownListings(window)})
        }
        catch(error)
        {
            send(response,error instanceof IntegrationError?error.status:500,{error:error instanceof IntegrationError?error.code:'crawler-state-failed'})
        }
        return true
    }

    if(url.pathname==='/api/integrations/crawler' && ['POST','GET'].includes(request.method))
    {
        try
        {
            integrations.authorize(request)
            const result=request.method==='GET'?crawlerStatus():await receiveCrawler(await readBody(request),request.headers['idempotency-key'])
            if(request.method==='POST'&&!result.duplicate) live.changed()
            send(response,200,result)
        }
        catch(error)
        {
            send(response,error instanceof CrawlerError||error instanceof IntegrationError||error instanceof HttpError?error.status:500,
                {error:error instanceof CrawlerError||error instanceof IntegrationError||error instanceof HttpError?error.code:'crawler-ingestion-failed'})
        }
        return true
    }

    if(request.method === 'POST' && url.pathname === '/api/integrations/market/collect')
    {
        try
        {
            integrations.authorize(request)
            const body = await readBody(request)
            if(!body || Array.isArray(body) || Object.keys(body).length) throw new HttpError(400, 'collection-body-must-be-empty')
            const result = await marketCollector.run()
            live.changed()
            send(response, 200, result)
        }
        catch(error)
        {
            send(response, error instanceof HttpError || error instanceof IntegrationError ? error.status : 502,
                { error: error instanceof CollectionError || error instanceof IntegrationError || error instanceof HttpError ? error.code : 'collection-failed' })
        }
        return true
    }

    // The web client listens here for changes made elsewhere (live.js)
    if(request.method === 'GET' && url.pathname === '/api/events')
    {
        live.subscribe(request, response)
        return true
    }

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
                save.lang = displayLanguage(loaded.state, request, body)
                useCustom(save)
                const result = { reset: true }
                if(persistence.cloudEnabled())
                    await persistence.commitSave(save, loaded.version, 'save', { result })
                else
                    store.save(save)
                return { result, save }
            }

            const save = loaded.state
            if(!integration && request.method === 'POST')
                save.lang = displayLanguage(save, request, body)
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
        // Every saved change reaches the open game tabs; the tab that made it (its X-Career-Client id) skips the reload
        if(request.method === 'POST')
        {
            const origin = String(request.headers['x-career-client'] ?? '')
            live.changed(!integration && /^[A-Za-z0-9-]{1,64}$/.test(origin) ? origin : null)
        }

        // Workflows and bots only need the result, the game client gets the whole state
        if(integration)
            send(response, 200, payload.result)
        else
        {
            const [ market, trends ] = await Promise.all([
                persistence.loadDocument('market'),
                persistence.loadDocument('trends'),
            ])
            const displaySave = { ...payload.save, lang: displayLanguage(payload.save, request, body) }
            send(response, 200, { ...payload.result, state: game.view(displaySave, ai.status(), { market: market.payload, trends: trends.payload }) })
        }
    }
    catch(error)
    {
        if(error instanceof PostingWatchError)
        {
            send(response, 400, { error: error.code })
            return true
        }
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
